/**
 * KPI Management Engine
 * Comprehensive framework for defining, tracking, and alerting on custom metrics
 * Supports complex formulas, thresholds, and anomaly detection
 */

import { EventEmitter } from 'events';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import * as math from 'mathjs';

// KPI Definition Schemas
const KPIDefinitionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  category: z.enum([
    'BUSINESS', 'TECHNICAL', 'OPERATIONAL', 'FINANCIAL', 
    'CUSTOMER', 'PRODUCT', 'SECURITY', 'COMPLIANCE'
  ]),
  formula: z.string().min(1),
  unit: z.string().optional(),
  format: z.enum(['NUMBER', 'PERCENTAGE', 'CURRENCY', 'DURATION', 'BYTES']).default('NUMBER'),
  frequency: z.enum(['REAL_TIME', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY']).default('HOURLY'),
  target: z.number().optional(),
  thresholds: z.object({
    critical: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
    warning: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
    good: z.object({ min: z.number().optional(), max: z.number().optional() }).optional()
  }).optional(),
  aggregation: z.enum(['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'MEDIAN', 'P95', 'P99']).default('SUM'),
  timeWindow: z.string().default('1h'), // 1h, 1d, 1w, 1m
  dependencies: z.array(z.string()).default([]),
  tenantId: z.string().optional(),
  isActive: z.boolean().default(true),
  tags: z.array(z.string()).default([])
});

const AlertConfigSchema = z.object({
  id: z.string().optional(),
  kpiId: z.string(),
  name: z.string(),
  condition: z.enum(['THRESHOLD', 'TREND', 'ANOMALY', 'CUSTOM']),
  parameters: z.record(z.any()),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  channels: z.array(z.enum(['EMAIL', 'SLACK', 'WEBHOOK', 'SMS', 'DASHBOARD'])),
  throttleMinutes: z.number().min(0).default(60),
  enabled: z.boolean().default(true)
});

export type KPIDefinition = z.infer<typeof KPIDefinitionSchema>;
export type AlertConfig = z.infer<typeof AlertConfigSchema>;

export interface KPIValue {
  id: string;
  kpiId: string;
  value: number;
  formattedValue: string;
  timestamp: Date;
  dimensions?: Record<string, any>;
  metadata?: Record<string, any>;
  status: 'GOOD' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
}

export interface KPITrend {
  kpiId: string;
  direction: 'UP' | 'DOWN' | 'STABLE';
  changePercent: number;
  changeValue: number;
  period: string;
  confidence: number;
}

export interface AnomalyDetection {
  kpiId: string;
  timestamp: Date;
  actualValue: number;
  expectedValue: number;
  deviation: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  description: string;
}

export interface KPIDashboard {
  id: string;
  name: string;
  description?: string;
  kpis: KPIDashboardItem[];
  layout: DashboardLayout;
  filters: DashboardFilter[];
  refreshInterval: number; // seconds
  permissions: string[];
}

export interface KPIDashboardItem {
  kpiId: string;
  position: { x: number; y: number; w: number; h: number };
  visualization: 'GAUGE' | 'CHART' | 'TABLE' | 'SPARKLINE' | 'NUMBER';
  config: Record<string, any>;
}

export interface DashboardLayout {
  columns: number;
  rowHeight: number;
  margin: [number, number];
}

export interface DashboardFilter {
  field: string;
  type: 'DATE_RANGE' | 'SELECT' | 'MULTI_SELECT' | 'TEXT';
  options?: string[];
  defaultValue?: any;
}

/**
 * KPI Management Engine
 */
export class KPIManagementEngine extends EventEmitter {
  private kpiDefinitions: Map<string, KPIDefinition> = new Map();
  private alertConfigs: Map<string, AlertConfig> = new Map();
  private calculationCache: Map<string, any> = new Map();
  private anomalyDetector: AnomalyDetector;
  private trendAnalyzer: TrendAnalyzer;
  private alertManager: AlertManager;

  constructor() {
    super();
    this.anomalyDetector = new AnomalyDetector();
    this.trendAnalyzer = new TrendAnalyzer();
    this.alertManager = new AlertManager(this);
    
    this.loadKPIDefinitions();
    this.startCalculationScheduler();
  }

  /**
   * Define a new KPI
   */
  async defineKPI(kpiDef: Omit<KPIDefinition, 'id'>): Promise<KPIDefinition> {
    // Validate definition
    const validated = KPIDefinitionSchema.parse(kpiDef);
    
    // Generate ID if not provided
    const id = `kpi-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const kpi: KPIDefinition = { ...validated, id };

    // Validate formula syntax
    await this.validateFormula(kpi.formula);

    // Check dependencies
    await this.validateDependencies(kpi.dependencies);

    // Store definition
    await prisma.customKPI.create({
      data: {
        id: kpi.id,
        name: kpi.name,
        displayName: kpi.displayName,
        description: kpi.description || '',
        category: kpi.category,
        formula: kpi.formula,
        unit: kpi.unit || '',
        format: kpi.format,
        frequency: kpi.frequency,
        target: kpi.target,
        thresholds: kpi.thresholds || {},
        aggregation: kpi.aggregation,
        timeWindow: kpi.timeWindow,
        dependencies: kpi.dependencies,
        tenantId: kpi.tenantId,
        isActive: kpi.isActive,
        tags: kpi.tags
      }
    });

    this.kpiDefinitions.set(kpi.id!, kpi);
    this.emit('kpi-defined', kpi);

    return kpi;
  }

  /**
   * Calculate KPI value
   */
  async calculateKPI(
    kpiId: string,
    timestamp: Date = new Date(),
    dimensions?: Record<string, any>
  ): Promise<KPIValue> {
    const kpi = this.kpiDefinitions.get(kpiId);
    if (!kpi) {
      throw new Error(`KPI not found: ${kpiId}`);
    }

    const cacheKey = `${kpiId}-${timestamp.getTime()}-${JSON.stringify(dimensions)}`;
    
    // Check cache first
    if (this.calculationCache.has(cacheKey)) {
      return this.calculationCache.get(cacheKey);
    }

    try {
      // Prepare calculation context
      const context = await this.buildCalculationContext(kpi, timestamp, dimensions);
      
      // Execute formula
      const value = this.executeFormula(kpi.formula, context);
      
      // Format value
      const formattedValue = this.formatValue(value, kpi.format, kpi.unit);
      
      // Determine status based on thresholds
      const status = this.evaluateStatus(value, kpi.thresholds);

      const kpiValue: KPIValue = {
        id: `value-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        kpiId,
        value,
        formattedValue,
        timestamp,
        dimensions,
        status
      };

      // Cache result
      this.calculationCache.set(cacheKey, kpiValue);
      
      // Store in database
      await this.storeKPIValue(kpiValue);
      
      // Check for alerts
      await this.checkAlerts(kpiValue);
      
      this.emit('kpi-calculated', kpiValue);
      return kpiValue;

    } catch (error) {
      this.emit('kpi-calculation-error', { kpiId, error });
      throw error;
    }
  }

  /**
   * Build calculation context with available metrics
   */
  private async buildCalculationContext(
    kpi: KPIDefinition,
    timestamp: Date,
    dimensions?: Record<string, any>
  ): Promise<Record<string, any>> {
    const context: Record<string, any> = {};
    
    // Add time-based variables
    context.NOW = timestamp;
    context.HOUR = timestamp.getHours();
    context.DAY = timestamp.getDate();
    context.MONTH = timestamp.getMonth() + 1;
    context.YEAR = timestamp.getFullYear();
    
    // Add dimension variables
    if (dimensions) {
      Object.assign(context, dimensions);
    }

    // Calculate time window boundaries
    const timeWindow = this.parseTimeWindow(kpi.timeWindow);
    const startTime = new Date(timestamp.getTime() - timeWindow);
    
    // Load dependent KPI values
    for (const depKpiId of kpi.dependencies) {
      const depValues = await this.getKPIHistory(depKpiId, startTime, timestamp);
      context[depKpiId] = depValues;
      context[`${depKpiId}_CURRENT`] = depValues[depValues.length - 1]?.value || 0;
      context[`${depKpiId}_AVG`] = this.average(depValues.map(v => v.value));
      context[`${depKpiId}_SUM`] = depValues.reduce((sum, v) => sum + v.value, 0);
    }

    // Load base metrics
    const baseMetrics = await this.loadBaseMetrics(startTime, timestamp, dimensions);
    Object.assign(context, baseMetrics);

    return context;
  }

  /**
   * Execute formula using math.js
   */
  private executeFormula(formula: string, context: Record<string, any>): number {
    try {
      // Create a scoped math evaluator
      const expr = math.compile(formula);
      const result = expr.evaluate(context);
      
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error(`Formula result is not a valid number: ${result}`);
      }
      
      return result;
    } catch (error) {
      throw new Error(`Formula execution failed: ${error}`);
    }
  }

  /**
   * Load base metrics for calculations
   */
  private async loadBaseMetrics(
    startTime: Date,
    endTime: Date,
    dimensions?: Record<string, any>
  ): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};
    
    // Build where clause
    const whereClause: any = {
      timestamp: { gte: startTime, lte: endTime }
    };
    
    if (dimensions?.tenantId) {
      whereClause.metadata = {
        path: ['tenantId'],
        equals: dimensions.tenantId
      };
    }

    // Load different metric types
    const [
      apiCalls,
      activeUsers,
      responseTime,
      errorCount,
      storageUsage
    ] = await Promise.all([
      this.aggregateMetric('API_CALLS', whereClause),
      this.aggregateMetric('ACTIVE_USERS', whereClause),
      this.aggregateMetric('RESPONSE_TIME', whereClause),
      this.aggregateMetric('ERROR_COUNT', whereClause),
      this.aggregateMetric('STORAGE_GB', whereClause)
    ]);

    // Standard metric variables
    metrics.API_CALLS = apiCalls.sum;
    metrics.API_CALLS_AVG = apiCalls.avg;
    metrics.ACTIVE_USERS = activeUsers.sum;
    metrics.ACTIVE_USERS_AVG = activeUsers.avg;
    metrics.RESPONSE_TIME_AVG = responseTime.avg;
    metrics.RESPONSE_TIME_P95 = responseTime.p95;
    metrics.ERROR_COUNT = errorCount.sum;
    metrics.ERROR_RATE = apiCalls.sum > 0 ? (errorCount.sum / apiCalls.sum) * 100 : 0;
    metrics.STORAGE_GB = storageUsage.sum;

    // Time-based variables
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    metrics.HOURS = hours;
    metrics.MINUTES = hours * 60;

    return metrics;
  }

  /**
   * Aggregate metrics from database
   */
  private async aggregateMetric(
    metricType: string,
    whereClause: any
  ): Promise<{ sum: number; avg: number; count: number; p95: number }> {
    const result = await prisma.metricDataPoint.aggregate({
      where: {
        ...whereClause,
        source: metricType
      },
      _sum: { value: true },
      _avg: { value: true },
      _count: { value: true }
    });

    // For percentiles, we need a separate query
    const p95Result = await prisma.$queryRaw`
      SELECT PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) as p95
      FROM metric_data_points
      WHERE source = ${metricType} 
      AND timestamp >= ${whereClause.timestamp.gte}
      AND timestamp <= ${whereClause.timestamp.lte}
    ` as any[];

    return {
      sum: result._sum.value || 0,
      avg: result._avg.value || 0,
      count: result._count.value || 0,
      p95: p95Result[0]?.p95 || 0
    };
  }

  /**
   * Configure alert for KPI
   */
  async configureAlert(alertConfig: Omit<AlertConfig, 'id'>): Promise<AlertConfig> {
    const validated = AlertConfigSchema.parse(alertConfig);
    const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const alert: AlertConfig = { ...validated, id };

    await prisma.kpiAlert.create({
      data: {
        id: alert.id,
        kpiId: alert.kpiId,
        name: alert.name,
        condition: alert.condition,
        parameters: alert.parameters,
        severity: alert.severity,
        channels: alert.channels,
        throttleMinutes: alert.throttleMinutes,
        enabled: alert.enabled
      }
    });

    this.alertConfigs.set(alert.id!, alert);
    this.emit('alert-configured', alert);

    return alert;
  }

  /**
   * Analyze KPI trends
   */
  async analyzeKPITrends(
    kpiId: string,
    period: '1h' | '1d' | '1w' | '1m' = '1d'
  ): Promise<KPITrend> {
    const kpi = this.kpiDefinitions.get(kpiId);
    if (!kpi) {
      throw new Error(`KPI not found: ${kpiId}`);
    }

    return await this.trendAnalyzer.analyze(kpiId, period);
  }

  /**
   * Detect anomalies in KPI values
   */
  async detectAnomalies(
    kpiId: string,
    lookbackDays: number = 30
  ): Promise<AnomalyDetection[]> {
    const kpi = this.kpiDefinitions.get(kpiId);
    if (!kpi) {
      throw new Error(`KPI not found: ${kpiId}`);
    }

    return await this.anomalyDetector.detect(kpiId, lookbackDays);
  }

  /**
   * Create KPI dashboard
   */
  async createDashboard(dashboard: Omit<KPIDashboard, 'id'>): Promise<KPIDashboard> {
    const id = `dashboard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newDashboard: KPIDashboard = { ...dashboard, id };

    await prisma.kpiDashboard.create({
      data: {
        id: newDashboard.id,
        name: newDashboard.name,
        description: newDashboard.description || '',
        kpis: newDashboard.kpis,
        layout: newDashboard.layout,
        filters: newDashboard.filters,
        refreshInterval: newDashboard.refreshInterval,
        permissions: newDashboard.permissions
      }
    });

    this.emit('dashboard-created', newDashboard);
    return newDashboard;
  }

  /**
   * Get KPI performance summary
   */
  async getKPIPerformance(kpiId: string, days: number = 30): Promise<{
    current: KPIValue | null;
    trend: KPITrend;
    anomalies: AnomalyDetection[];
    alerts: number;
    availability: number;
  }> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const [current, trend, anomalies, alertCount, availability] = await Promise.all([
      this.getCurrentKPIValue(kpiId),
      this.analyzeKPITrends(kpiId, '1d'),
      this.detectAnomalies(kpiId, days),
      this.getAlertCount(kpiId, startDate, endDate),
      this.calculateKPIAvailability(kpiId, startDate, endDate)
    ]);

    return {
      current,
      trend,
      anomalies,
      alerts: alertCount,
      availability
    };
  }

  // Helper methods and utilities
  private parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/^(\d+)([hHdDwWmM])$/);
    if (!match) throw new Error(`Invalid time window: ${timeWindow}`);
    
    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      case 'm': return value * 30 * 24 * 60 * 60 * 1000;
      default: throw new Error(`Invalid time unit: ${unit}`);
    }
  }

  private formatValue(value: number, format: string, unit?: string): string {
    const formatted = (() => {
      switch (format) {
        case 'PERCENTAGE':
          return `${value.toFixed(2)}%`;
        case 'CURRENCY':
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
          }).format(value);
        case 'DURATION':
          return `${value.toFixed(2)}ms`;
        case 'BYTES':
          return this.formatBytes(value);
        default:
          return value.toLocaleString();
      }
    })();
    
    return unit ? `${formatted} ${unit}` : formatted;
  }

  private formatBytes(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  private evaluateStatus(
    value: number, 
    thresholds?: KPIDefinition['thresholds']
  ): KPIValue['status'] {
    if (!thresholds) return 'UNKNOWN';
    
    if (thresholds.critical) {
      if ((thresholds.critical.min && value < thresholds.critical.min) ||
          (thresholds.critical.max && value > thresholds.critical.max)) {
        return 'CRITICAL';
      }
    }
    
    if (thresholds.warning) {
      if ((thresholds.warning.min && value < thresholds.warning.min) ||
          (thresholds.warning.max && value > thresholds.warning.max)) {
        return 'WARNING';
      }
    }
    
    return 'GOOD';
  }

  private average(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private async validateFormula(formula: string): Promise<void> {
    try {
      // Test compilation
      math.compile(formula);
    } catch (error) {
      throw new Error(`Invalid formula syntax: ${error}`);
    }
  }

  private async validateDependencies(dependencies: string[]): Promise<void> {
    for (const depId of dependencies) {
      if (!this.kpiDefinitions.has(depId)) {
        // Check if it exists in database
        const exists = await prisma.customKPI.findUnique({
          where: { id: depId }
        });
        if (!exists) {
          throw new Error(`Dependency KPI not found: ${depId}`);
        }
      }
    }
  }

  private async loadKPIDefinitions(): Promise<void> {
    const kpis = await prisma.customKPI.findMany({
      where: { isActive: true }
    });

    for (const kpi of kpis) {
      this.kpiDefinitions.set(kpi.id, kpi as any);
    }
  }

  private startCalculationScheduler(): void {
    // Schedule regular KPI calculations based on frequency
    setInterval(async () => {
      for (const [kpiId, kpi] of this.kpiDefinitions) {
        if (this.shouldCalculateNow(kpi)) {
          try {
            await this.calculateKPI(kpiId);
          } catch (error) {
            console.error(`Failed to calculate KPI ${kpiId}:`, error);
          }
        }
      }
    }, 60000); // Check every minute
  }

  private shouldCalculateNow(kpi: KPIDefinition): boolean {
    const now = new Date();
    const lastCalc = this.getLastCalculation(kpi.id!);
    
    if (!lastCalc) return true;
    
    const timeDiff = now.getTime() - lastCalc.getTime();
    
    switch (kpi.frequency) {
      case 'REAL_TIME': return timeDiff > 60000; // 1 minute
      case 'HOURLY': return timeDiff > 3600000; // 1 hour
      case 'DAILY': return timeDiff > 86400000; // 1 day
      case 'WEEKLY': return timeDiff > 604800000; // 1 week
      case 'MONTHLY': return timeDiff > 2592000000; // 30 days
      default: return false;
    }
  }

  private getLastCalculation(kpiId: string): Date | null {
    // Implementation to get last calculation time
    return null; // Placeholder
  }

  private async storeKPIValue(kpiValue: KPIValue): Promise<void> {
    await prisma.kpiTracking.create({
      data: {
        id: kpiValue.id,
        kpiId: kpiValue.kpiId,
        value: kpiValue.value,
        formattedValue: kpiValue.formattedValue,
        timestamp: kpiValue.timestamp,
        dimensions: kpiValue.dimensions || {},
        metadata: kpiValue.metadata || {},
        status: kpiValue.status
      }
    });
  }

  private async checkAlerts(kpiValue: KPIValue): Promise<void> {
    const alerts = Array.from(this.alertConfigs.values())
      .filter(alert => alert.kpiId === kpiValue.kpiId && alert.enabled);
    
    for (const alert of alerts) {
      await this.alertManager.checkAlert(alert, kpiValue);
    }
  }

  private async getKPIHistory(
    kpiId: string,
    startTime: Date,
    endTime: Date
  ): Promise<KPIValue[]> {
    const values = await prisma.kpiTracking.findMany({
      where: {
        kpiId,
        timestamp: { gte: startTime, lte: endTime }
      },
      orderBy: { timestamp: 'asc' }
    });

    return values.map(v => ({
      id: v.id,
      kpiId: v.kpiId,
      value: v.value,
      formattedValue: v.formattedValue,
      timestamp: v.timestamp,
      dimensions: v.dimensions as Record<string, any>,
      metadata: v.metadata as Record<string, any>,
      status: v.status as KPIValue['status']
    }));
  }

  private async getCurrentKPIValue(kpiId: string): Promise<KPIValue | null> {
    const value = await prisma.kpiTracking.findFirst({
      where: { kpiId },
      orderBy: { timestamp: 'desc' }
    });

    if (!value) return null;

    return {
      id: value.id,
      kpiId: value.kpiId,
      value: value.value,
      formattedValue: value.formattedValue,
      timestamp: value.timestamp,
      dimensions: value.dimensions as Record<string, any>,
      metadata: value.metadata as Record<string, any>,
      status: value.status as KPIValue['status']
    };
  }

  private async getAlertCount(
    kpiId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    return await prisma.alertHistory.count({
      where: {
        kpiId,
        timestamp: { gte: startDate, lte: endDate }
      }
    });
  }

  private async calculateKPIAvailability(
    kpiId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const totalMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    const values = await this.getKPIHistory(kpiId, startDate, endDate);
    
    if (values.length === 0) return 0;
    
    const successfulValues = values.filter(v => v.status !== 'CRITICAL').length;
    return (successfulValues / values.length) * 100;
  }
}

/**
 * Anomaly Detection Service
 */
class AnomalyDetector {
  async detect(kpiId: string, lookbackDays: number): Promise<AnomalyDetection[]> {
    // Simplified anomaly detection - in production, use ML algorithms
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    
    // Get historical data
    const values = await prisma.kpiTracking.findMany({
      where: {
        kpiId,
        timestamp: { gte: startDate, lte: endDate }
      },
      orderBy: { timestamp: 'asc' }
    });

    if (values.length < 10) return []; // Need sufficient data
    
    const anomalies: AnomalyDetection[] = [];
    const valueArray = values.map(v => v.value);
    const mean = valueArray.reduce((a, b) => a + b, 0) / valueArray.length;
    const stdDev = Math.sqrt(
      valueArray.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / valueArray.length
    );

    // Simple z-score based anomaly detection
    for (const value of values) {
      const zScore = Math.abs((value.value - mean) / stdDev);
      
      if (zScore > 3) { // 3 standard deviations
        anomalies.push({
          kpiId,
          timestamp: value.timestamp,
          actualValue: value.value,
          expectedValue: mean,
          deviation: zScore,
          severity: zScore > 4 ? 'HIGH' : zScore > 3.5 ? 'MEDIUM' : 'LOW',
          confidence: Math.min(zScore / 4, 1),
          description: `Value ${value.value} deviates significantly from expected ${mean.toFixed(2)}`
        });
      }
    }

    return anomalies;
  }
}

/**
 * Trend Analysis Service
 */
class TrendAnalyzer {
  async analyze(kpiId: string, period: string): Promise<KPITrend> {
    const timeWindow = this.parseTimeWindow(period);
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - timeWindow);
    const midDate = new Date(endDate.getTime() - timeWindow / 2);

    const [recentValues, olderValues] = await Promise.all([
      this.getAverageValue(kpiId, midDate, endDate),
      this.getAverageValue(kpiId, startDate, midDate)
    ]);

    const changeValue = recentValues - olderValues;
    const changePercent = olderValues !== 0 ? (changeValue / olderValues) * 100 : 0;
    
    const direction = changePercent > 5 ? 'UP' : 
                     changePercent < -5 ? 'DOWN' : 'STABLE';

    return {
      kpiId,
      direction,
      changePercent,
      changeValue,
      period,
      confidence: 0.85 // Simplified confidence calculation
    };
  }

  private parseTimeWindow(period: string): number {
    switch (period) {
      case '1h': return 60 * 60 * 1000;
      case '1d': return 24 * 60 * 60 * 1000;
      case '1w': return 7 * 24 * 60 * 60 * 1000;
      case '1m': return 30 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  private async getAverageValue(
    kpiId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const result = await prisma.kpiTracking.aggregate({
      where: {
        kpiId,
        timestamp: { gte: startDate, lte: endDate }
      },
      _avg: { value: true }
    });

    return result._avg.value || 0;
  }
}

/**
 * Alert Management Service
 */
class AlertManager {
  private engine: KPIManagementEngine;
  private throttleMap: Map<string, Date> = new Map();

  constructor(engine: KPIManagementEngine) {
    this.engine = engine;
  }

  async checkAlert(alert: AlertConfig, kpiValue: KPIValue): Promise<void> {
    // Check throttling
    if (this.isThrottled(alert.id!, alert.throttleMinutes)) {
      return;
    }

    const shouldAlert = await this.evaluateAlertCondition(alert, kpiValue);
    
    if (shouldAlert) {
      await this.fireAlert(alert, kpiValue);
      this.throttleMap.set(alert.id!, new Date());
    }
  }

  private async evaluateAlertCondition(
    alert: AlertConfig,
    kpiValue: KPIValue
  ): Promise<boolean> {
    switch (alert.condition) {
      case 'THRESHOLD':
        return this.evaluateThreshold(alert.parameters, kpiValue.value);
      case 'TREND':
        return await this.evaluateTrend(alert.parameters, kpiValue);
      case 'ANOMALY':
        return await this.evaluateAnomaly(alert.parameters, kpiValue);
      case 'CUSTOM':
        return this.evaluateCustom(alert.parameters, kpiValue);
      default:
        return false;
    }
  }

  private evaluateThreshold(parameters: any, value: number): boolean {
    const { operator, threshold } = parameters;
    
    switch (operator) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'gte': return value >= threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      case 'ne': return value !== threshold;
      default: return false;
    }
  }

  private async evaluateTrend(parameters: any, kpiValue: KPIValue): Promise<boolean> {
    // Implementation for trend-based alerts
    return false; // Placeholder
  }

  private async evaluateAnomaly(parameters: any, kpiValue: KPIValue): Promise<boolean> {
    // Implementation for anomaly-based alerts
    return false; // Placeholder
  }

  private evaluateCustom(parameters: any, kpiValue: KPIValue): boolean {
    // Implementation for custom alert conditions
    return false; // Placeholder
  }

  private async fireAlert(alert: AlertConfig, kpiValue: KPIValue): Promise<void> {
    // Store alert in history
    await prisma.alertHistory.create({
      data: {
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        kpiId: kpiValue.kpiId,
        alertId: alert.id!,
        severity: alert.severity,
        message: `KPI ${kpiValue.kpiId} triggered ${alert.condition} alert`,
        value: kpiValue.value,
        timestamp: new Date()
      }
    });

    // Send notifications
    for (const channel of alert.channels) {
      await this.sendNotification(channel, alert, kpiValue);
    }

    this.engine.emit('alert-fired', { alert, kpiValue });
  }

  private async sendNotification(
    channel: string,
    alert: AlertConfig,
    kpiValue: KPIValue
  ): Promise<void> {
    // Implementation for different notification channels
    switch (channel) {
      case 'EMAIL':
        // Send email notification
        break;
      case 'SLACK':
        // Send Slack notification
        break;
      case 'WEBHOOK':
        // Send webhook notification
        break;
      case 'SMS':
        // Send SMS notification
        break;
      case 'DASHBOARD':
        // Show dashboard notification
        break;
    }
  }

  private isThrottled(alertId: string, throttleMinutes: number): boolean {
    const lastAlert = this.throttleMap.get(alertId);
    if (!lastAlert) return false;
    
    const now = new Date();
    const timeDiff = now.getTime() - lastAlert.getTime();
    return timeDiff < (throttleMinutes * 60 * 1000);
  }
}

export default KPIManagementEngine;