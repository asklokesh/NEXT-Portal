/**
 * Enhanced Data Pipeline with Quality Validation and Real-time Processing
 * Implements Lambda architecture for real-time and batch processing
 */

import { EventEmitter } from 'events';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { createHash } from 'crypto';

// Data Quality Schema Definitions
const MetricSchema = z.object({
  id: z.string().uuid().optional(),
  source: z.string().min(1),
  timestamp: z.date(),
  metricType: z.enum([
    'COUNTER', 'GAUGE', 'HISTOGRAM', 'TIMER',
    'BUSINESS_KPI', 'USER_EVENT', 'SYSTEM_METRIC'
  ]),
  name: z.string().min(1),
  value: z.number().finite(),
  unit: z.string().optional(),
  dimensions: z.record(z.string(), z.any()).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  tenantId: z.string().min(1),
  userId: z.string().optional()
});

const DataQualityRule = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['COMPLETENESS', 'ACCURACY', 'CONSISTENCY', 'TIMELINESS', 'UNIQUENESS']),
  expression: z.string(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  threshold: z.number().min(0).max(100),
  enabled: z.boolean().default(true)
});

export type MetricInput = z.infer<typeof MetricSchema>;
export type DataQualityRule = z.infer<typeof DataQualityRule>;

export interface DataPipelineConfig {
  batchSize: number;
  flushInterval: number;
  retryAttempts: number;
  qualityThreshold: number;
  enableRealTime: boolean;
  enableLineageTracking: boolean;
}

export interface DataQualityReport {
  timestamp: Date;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  qualityScore: number;
  issues: DataQualityIssue[];
  ruleResults: Map<string, QualityRuleResult>;
}

export interface DataQualityIssue {
  id: string;
  ruleId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  affectedRecords: number;
  suggestedFix: string;
}

export interface QualityRuleResult {
  ruleId: string;
  passed: boolean;
  score: number;
  affectedRecords: string[];
  executionTime: number;
}

export interface DataLineage {
  recordId: string;
  source: string;
  transformations: LineageStep[];
  timestamp: Date;
  checksum: string;
}

export interface LineageStep {
  step: string;
  transformation: string;
  inputChecksum: string;
  outputChecksum: string;
  timestamp: Date;
}

/**
 * Enhanced Data Pipeline with Quality Validation
 */
export class EnhancedDataPipeline extends EventEmitter {
  private config: DataPipelineConfig;
  private batchBuffer: MetricInput[] = [];
  private qualityRules: Map<string, DataQualityRule> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private streamingProcessor: StreamingProcessor;
  private lineageTracker: LineageTracker;

  constructor(config: Partial<DataPipelineConfig> = {}) {
    super();
    
    this.config = {
      batchSize: 1000,
      flushInterval: 5000, // 5 seconds
      retryAttempts: 3,
      qualityThreshold: 95.0,
      enableRealTime: true,
      enableLineageTracking: true,
      ...config
    };

    this.streamingProcessor = new StreamingProcessor(this);
    this.lineageTracker = new LineageTracker();
    
    this.initializeQualityRules();
    this.startFlushTimer();
  }

  /**
   * Ingest metric with validation and quality checks
   */
  async ingestMetric(metric: MetricInput): Promise<{ success: boolean; issues?: string[] }> {
    try {
      // Schema validation
      const validatedMetric = MetricSchema.parse({
        ...metric,
        timestamp: metric.timestamp || new Date()
      });

      // Data quality validation
      const qualityResult = await this.validateDataQuality(validatedMetric);
      
      if (qualityResult.score < this.config.qualityThreshold) {
        this.emit('quality-violation', {
          metric: validatedMetric,
          issues: qualityResult.issues
        });
        
        return {
          success: false,
          issues: qualityResult.issues.map(i => i.description)
        };
      }

      // Add to batch buffer
      this.batchBuffer.push(validatedMetric);

      // Real-time processing
      if (this.config.enableRealTime) {
        await this.streamingProcessor.process(validatedMetric);
      }

      // Data lineage tracking
      if (this.config.enableLineageTracking) {
        await this.lineageTracker.track(validatedMetric);
      }

      // Flush if batch is full
      if (this.batchBuffer.length >= this.config.batchSize) {
        await this.flushBatch();
      }

      this.emit('metric-ingested', validatedMetric);
      return { success: true };

    } catch (error) {
      this.emit('ingestion-error', { metric, error });
      return {
        success: false,
        issues: [error instanceof Error ? error.message : 'Unknown validation error']
      };
    }
  }

  /**
   * Validate data quality against configured rules
   */
  private async validateDataQuality(metric: MetricInput): Promise<{
    score: number;
    issues: DataQualityIssue[];
  }> {
    const issues: DataQualityIssue[] = [];
    let passedRules = 0;
    let totalRules = 0;

    for (const [ruleId, rule] of this.qualityRules) {
      if (!rule.enabled) continue;
      
      totalRules++;
      const result = await this.executeQualityRule(rule, metric);
      
      if (result.passed) {
        passedRules++;
      } else {
        issues.push({
          id: `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ruleId,
          severity: rule.severity,
          description: `Quality rule '${rule.name}' failed`,
          affectedRecords: 1,
          suggestedFix: this.getSuggestedFix(rule, metric)
        });
      }
    }

    const score = totalRules > 0 ? (passedRules / totalRules) * 100 : 100;
    
    return { score, issues };
  }

  /**
   * Execute a quality rule against a metric
   */
  private async executeQualityRule(
    rule: DataQualityRule, 
    metric: MetricInput
  ): Promise<QualityRuleResult> {
    const startTime = Date.now();
    
    try {
      let passed = false;
      
      switch (rule.type) {
        case 'COMPLETENESS':
          passed = this.checkCompleteness(metric, rule.expression);
          break;
        case 'ACCURACY':
          passed = this.checkAccuracy(metric, rule.expression);
          break;
        case 'CONSISTENCY':
          passed = await this.checkConsistency(metric, rule.expression);
          break;
        case 'TIMELINESS':
          passed = this.checkTimeliness(metric, rule.expression);
          break;
        case 'UNIQUENESS':
          passed = await this.checkUniqueness(metric, rule.expression);
          break;
      }

      return {
        ruleId: rule.id,
        passed,
        score: passed ? 100 : 0,
        affectedRecords: passed ? [] : [metric.id || 'unknown'],
        executionTime: Date.now() - startTime
      };

    } catch (error) {
      return {
        ruleId: rule.id,
        passed: false,
        score: 0,
        affectedRecords: [metric.id || 'unknown'],
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * Data quality check implementations
   */
  private checkCompleteness(metric: MetricInput, expression: string): boolean {
    // Check for required fields based on expression
    const requiredFields = expression.split(',').map(f => f.trim());
    
    for (const field of requiredFields) {
      const value = this.getNestedValue(metric, field);
      if (value === null || value === undefined || value === '') {
        return false;
      }
    }
    
    return true;
  }

  private checkAccuracy(metric: MetricInput, expression: string): boolean {
    // Validate data format and ranges
    try {
      const checks = JSON.parse(expression);
      
      for (const [field, rules] of Object.entries(checks)) {
        const value = this.getNestedValue(metric, field);
        const fieldRules = rules as any;
        
        if (fieldRules.min !== undefined && value < fieldRules.min) return false;
        if (fieldRules.max !== undefined && value > fieldRules.max) return false;
        if (fieldRules.pattern && !new RegExp(fieldRules.pattern).test(String(value))) return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  private async checkConsistency(metric: MetricInput, expression: string): Promise<boolean> {
    // Check consistency against historical data
    const checks = JSON.parse(expression);
    
    for (const [field, rule] of Object.entries(checks)) {
      const currentValue = this.getNestedValue(metric, field);
      const ruleConfig = rule as any;
      
      if (ruleConfig.type === 'deviation') {
        const historicalAvg = await this.getHistoricalAverage(
          metric.name, 
          field, 
          ruleConfig.period || '1h'
        );
        
        const deviation = Math.abs(currentValue - historicalAvg) / historicalAvg;
        if (deviation > (ruleConfig.threshold || 0.5)) {
          return false;
        }
      }
    }
    
    return true;
  }

  private checkTimeliness(metric: MetricInput, expression: string): boolean {
    const maxAgeMs = parseInt(expression) * 1000;
    const age = Date.now() - metric.timestamp.getTime();
    return age <= maxAgeMs;
  }

  private async checkUniqueness(metric: MetricInput, expression: string): Promise<boolean> {
    const fields = expression.split(',').map(f => f.trim());
    const checksum = this.calculateChecksum(fields.map(f => this.getNestedValue(metric, f)));
    
    // Check for duplicates in the last hour
    const duplicateExists = await prisma.metricDataPoint.findFirst({
      where: {
        source: metric.source,
        timestamp: {
          gte: new Date(Date.now() - 60 * 60 * 1000)
        },
        metadata: {
          path: ['checksum'],
          equals: checksum
        }
      }
    });
    
    return !duplicateExists;
  }

  /**
   * Flush batch to persistent storage
   */
  private async flushBatch(): Promise<void> {
    if (this.batchBuffer.length === 0 || this.isProcessing) return;
    
    this.isProcessing = true;
    const batch = [...this.batchBuffer];
    this.batchBuffer = [];
    
    try {
      // Prepare batch for insertion
      const records = batch.map(metric => ({
        id: metric.id || undefined,
        source: metric.source,
        timestamp: metric.timestamp,
        value: metric.value,
        labels: metric.dimensions || {},
        metadata: {
          ...metric.metadata,
          metricType: metric.metricType,
          unit: metric.unit,
          tenantId: metric.tenantId,
          userId: metric.userId
        }
      }));

      // Batch insert with transaction
      await prisma.$transaction(async (tx) => {
        await tx.metricDataPoint.createMany({
          data: records,
          skipDuplicates: true
        });

        // Update aggregations
        await this.updateAggregations(tx, batch);
      });

      this.emit('batch-flushed', { count: batch.length });

    } catch (error) {
      // Retry logic
      this.emit('batch-error', { batch, error });
      
      // Put failed records back in buffer for retry
      this.batchBuffer.unshift(...batch);
      
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Update real-time aggregations
   */
  private async updateAggregations(tx: any, batch: MetricInput[]): Promise<void> {
    const aggregationGroups = new Map<string, MetricInput[]>();
    
    // Group by tenant and metric type
    for (const metric of batch) {
      const key = `${metric.tenantId}:${metric.name}`;
      if (!aggregationGroups.has(key)) {
        aggregationGroups.set(key, []);
      }
      aggregationGroups.get(key)!.push(metric);
    }

    // Update aggregations for each group
    for (const [key, metrics] of aggregationGroups) {
      const [tenantId, metricName] = key.split(':');
      
      const sum = metrics.reduce((acc, m) => acc + m.value, 0);
      const count = metrics.length;
      const avg = sum / count;
      const min = Math.min(...metrics.map(m => m.value));
      const max = Math.max(...metrics.map(m => m.value));
      
      const hourKey = this.getHourKey(new Date());
      
      await tx.hourlyAggregation.upsert({
        where: {
          tenantId_metricName_hourKey: {
            tenantId,
            metricName,
            hourKey
          }
        },
        update: {
          sum: { increment: sum },
          count: { increment: count },
          min: { set: Math.min(min, Number(min)) },
          max: { set: Math.max(max, Number(max)) },
          lastUpdated: new Date()
        },
        create: {
          tenantId,
          metricName,
          hourKey,
          sum,
          count,
          avg,
          min,
          max,
          timestamp: new Date(),
          lastUpdated: new Date()
        }
      });
    }
  }

  /**
   * Initialize default quality rules
   */
  private initializeQualityRules(): void {
    const defaultRules: DataQualityRule[] = [
      {
        id: 'completeness-basic',
        name: 'Basic Completeness',
        type: 'COMPLETENESS',
        expression: 'source,timestamp,value,tenantId',
        severity: 'HIGH',
        threshold: 100,
        enabled: true
      },
      {
        id: 'accuracy-numeric-range',
        name: 'Numeric Range Validation',
        type: 'ACCURACY',
        expression: '{"value": {"min": -1000000, "max": 1000000}}',
        severity: 'MEDIUM',
        threshold: 95,
        enabled: true
      },
      {
        id: 'timeliness-max-age',
        name: 'Maximum Age Check',
        type: 'TIMELINESS',
        expression: '300', // 5 minutes
        severity: 'MEDIUM',
        threshold: 90,
        enabled: true
      },
      {
        id: 'uniqueness-source-timestamp',
        name: 'Source-Timestamp Uniqueness',
        type: 'UNIQUENESS',
        expression: 'source,timestamp,name',
        severity: 'LOW',
        threshold: 99,
        enabled: true
      }
    ];

    for (const rule of defaultRules) {
      this.qualityRules.set(rule.id, rule);
    }
  }

  /**
   * Utility methods
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private calculateChecksum(values: any[]): string {
    const data = JSON.stringify(values.sort());
    return createHash('md5').update(data).digest('hex');
  }

  private getHourKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
  }

  private async getHistoricalAverage(
    metricName: string, 
    field: string, 
    period: string
  ): Promise<number> {
    // Implementation for historical average calculation
    // This would query aggregated data from the database
    return 0; // Placeholder
  }

  private getSuggestedFix(rule: DataQualityRule, metric: MetricInput): string {
    switch (rule.type) {
      case 'COMPLETENESS':
        return 'Ensure all required fields are populated before submission';
      case 'ACCURACY':
        return 'Validate data formats and ranges before ingestion';
      case 'TIMELINESS':
        return 'Submit metrics closer to the event time';
      case 'UNIQUENESS':
        return 'Check for duplicate submissions and implement deduplication';
      default:
        return 'Review data quality requirements';
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushBatch().catch(error => 
        this.emit('flush-error', error)
      );
    }, this.config.flushInterval);
  }

  /**
   * Add custom quality rule
   */
  addQualityRule(rule: DataQualityRule): void {
    this.qualityRules.set(rule.id, rule);
    this.emit('quality-rule-added', rule);
  }

  /**
   * Get data quality report
   */
  async getQualityReport(
    startDate: Date, 
    endDate: Date
  ): Promise<DataQualityReport> {
    // Implementation for quality report generation
    return {
      timestamp: new Date(),
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      qualityScore: 100,
      issues: [],
      ruleResults: new Map()
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    await this.flushBatch();
    await this.streamingProcessor.shutdown();
  }
}

/**
 * Real-time streaming processor
 */
class StreamingProcessor {
  private pipeline: EnhancedDataPipeline;

  constructor(pipeline: EnhancedDataPipeline) {
    this.pipeline = pipeline;
  }

  async process(metric: MetricInput): Promise<void> {
    // Real-time aggregations
    await this.updateRealTimeAggregations(metric);
    
    // Real-time alerts
    await this.checkAlertThresholds(metric);
    
    // Real-time ML feature updates
    await this.updateMLFeatures(metric);
  }

  private async updateRealTimeAggregations(metric: MetricInput): Promise<void> {
    // Update in-memory aggregations for real-time dashboards
    this.pipeline.emit('real-time-update', {
      tenantId: metric.tenantId,
      metricName: metric.name,
      value: metric.value,
      timestamp: metric.timestamp
    });
  }

  private async checkAlertThresholds(metric: MetricInput): Promise<void> {
    // Check for alert conditions
    // This would trigger real-time alerts based on thresholds
  }

  private async updateMLFeatures(metric: MetricInput): Promise<void> {
    // Update ML model features for anomaly detection
    // This would feed into the analytics engine
  }

  async shutdown(): Promise<void> {
    // Cleanup streaming resources
  }
}

/**
 * Data lineage tracker
 */
class LineageTracker {
  async track(metric: MetricInput): Promise<void> {
    const checksum = createHash('sha256')
      .update(JSON.stringify(metric))
      .digest('hex');

    const lineage: DataLineage = {
      recordId: metric.id || checksum,
      source: metric.source,
      transformations: [],
      timestamp: new Date(),
      checksum
    };

    // Store lineage information
    // Implementation would store this in a lineage tracking system
  }
}

export default EnhancedDataPipeline;