// Data Pipeline Monitoring and Alerting System

import { 
  PipelineExecution, 
  ExecutionStatus, 
  MonitoringAlert, 
  AlertType,
  ExecutionMetrics,
  SLAConfig,
  ContactInfo 
} from './types';

/**
 * Pipeline Monitoring Service
 */
export class PipelineMonitoringService {
  private metrics: Map<string, PipelineMetrics[]> = new Map();
  private alerts: Map<string, MonitoringAlert[]> = new Map();
  private alertRules: Map<string, AlertRule[]> = new Map();
  private dashboards: Map<string, MonitoringDashboard> = new Map();

  /**
   * Track pipeline execution
   */
  trackExecution(execution: PipelineExecution): void {
    const pipelineMetrics = this.metrics.get(execution.pipelineId) || [];
    
    const metrics: PipelineMetrics = {
      pipelineId: execution.pipelineId,
      executionId: execution.id,
      timestamp: execution.startTime,
      status: execution.status,
      duration: execution.duration || 0,
      recordsProcessed: execution.metrics.rowsProcessed,
      bytesProcessed: execution.metrics.bytesProcessed,
      cpuUsage: execution.metrics.cpuUsage,
      memoryUsage: execution.metrics.memoryUsage,
      errorRate: execution.status === ExecutionStatus.FAILED ? 1 : 0,
      throughput: execution.duration ? execution.metrics.rowsProcessed / (execution.duration / 1000) : 0
    };

    pipelineMetrics.push(metrics);
    
    // Keep only last 1000 executions
    if (pipelineMetrics.length > 1000) {
      pipelineMetrics.shift();
    }
    
    this.metrics.set(execution.pipelineId, pipelineMetrics);

    // Check alert rules
    this.evaluateAlertRules(execution.pipelineId, metrics);
  }

  /**
   * Create alert rule
   */
  createAlertRule(rule: AlertRule): void {
    const pipelineRules = this.alertRules.get(rule.pipelineId) || [];
    pipelineRules.push(rule);
    this.alertRules.set(rule.pipelineId, pipelineRules);
  }

  /**
   * Get pipeline metrics
   */
  getMetrics(pipelineId: string, timeRange?: TimeRange): PipelineMetrics[] {
    const metrics = this.metrics.get(pipelineId) || [];
    
    if (!timeRange) {
      return metrics;
    }

    return metrics.filter(m => 
      m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
    );
  }

  /**
   * Get aggregated metrics
   */
  getAggregatedMetrics(pipelineId: string, timeRange: TimeRange): AggregatedMetrics {
    const metrics = this.getMetrics(pipelineId, timeRange);
    
    if (metrics.length === 0) {
      return {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        successRate: 0,
        averageDuration: 0,
        averageThroughput: 0,
        totalRecordsProcessed: 0,
        totalBytesProcessed: 0,
        peakCpuUsage: 0,
        peakMemoryUsage: 0
      };
    }

    const successfulExecutions = metrics.filter(m => m.status === ExecutionStatus.SUCCESS).length;
    const failedExecutions = metrics.filter(m => m.status === ExecutionStatus.FAILED).length;

    return {
      totalExecutions: metrics.length,
      successfulExecutions,
      failedExecutions,
      successRate: (successfulExecutions / metrics.length) * 100,
      averageDuration: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
      averageThroughput: metrics.reduce((sum, m) => sum + m.throughput, 0) / metrics.length,
      totalRecordsProcessed: metrics.reduce((sum, m) => sum + m.recordsProcessed, 0),
      totalBytesProcessed: metrics.reduce((sum, m) => sum + m.bytesProcessed, 0),
      peakCpuUsage: Math.max(...metrics.map(m => m.cpuUsage)),
      peakMemoryUsage: Math.max(...metrics.map(m => m.memoryUsage))
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(pipelineId?: string): MonitoringAlert[] {
    if (pipelineId) {
      return (this.alerts.get(pipelineId) || []).filter(alert => !alert.resolved);
    }

    const allAlerts: MonitoringAlert[] = [];
    for (const alerts of this.alerts.values()) {
      allAlerts.push(...alerts.filter(alert => !alert.resolved));
    }

    return allAlerts;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    for (const [pipelineId, alerts] of this.alerts.entries()) {
      const alert = alerts.find(a => a.id === alertId);
      if (alert) {
        alert.resolved = true;
        alert.resolvedAt = new Date();
        break;
      }
    }
  }

  /**
   * Create monitoring dashboard
   */
  createDashboard(config: DashboardConfig): MonitoringDashboard {
    const dashboard: MonitoringDashboard = {
      id: config.id,
      name: config.name,
      description: config.description,
      panels: config.panels,
      layout: config.layout,
      refreshInterval: config.refreshInterval || 30000,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.dashboards.set(config.id, dashboard);
    return dashboard;
  }

  /**
   * Get dashboard data
   */
  getDashboardData(dashboardId: string): DashboardData {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const data: DashboardData = {
      dashboardId,
      timestamp: new Date(),
      panels: {}
    };

    for (const panel of dashboard.panels) {
      data.panels[panel.id] = this.generatePanelData(panel);
    }

    return data;
  }

  /**
   * Evaluate alert rules
   */
  private evaluateAlertRules(pipelineId: string, metrics: PipelineMetrics): void {
    const rules = this.alertRules.get(pipelineId) || [];

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const shouldAlert = this.shouldTriggerAlert(rule, metrics);
      
      if (shouldAlert) {
        const alert = this.createAlert(rule, metrics);
        const pipelineAlerts = this.alerts.get(pipelineId) || [];
        pipelineAlerts.push(alert);
        this.alerts.set(pipelineId, pipelineAlerts);

        // Send alert notification
        this.sendAlertNotification(alert, rule.contacts);
      }
    }
  }

  /**
   * Check if alert should be triggered
   */
  private shouldTriggerAlert(rule: AlertRule, metrics: PipelineMetrics): boolean {
    switch (rule.type) {
      case AlertType.PIPELINE_FAILURE:
        return metrics.status === ExecutionStatus.FAILED;
      
      case AlertType.SLA_BREACH:
        return metrics.duration > rule.threshold;
      
      case AlertType.HIGH_LATENCY:
        return metrics.duration > rule.threshold;
      
      case AlertType.RESOURCE_USAGE:
        return metrics.cpuUsage > rule.threshold || metrics.memoryUsage > rule.threshold;
      
      case AlertType.DATA_DRIFT:
        // Compare with historical metrics
        const historicalMetrics = this.getMetrics(metrics.pipelineId).slice(-10);
        const avgThroughput = historicalMetrics.reduce((sum, m) => sum + m.throughput, 0) / historicalMetrics.length;
        return Math.abs(metrics.throughput - avgThroughput) / avgThroughput > (rule.threshold / 100);
      
      default:
        return false;
    }
  }

  /**
   * Create alert
   */
  private createAlert(rule: AlertRule, metrics: PipelineMetrics): MonitoringAlert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      pipelineId: metrics.pipelineId,
      type: rule.type,
      severity: rule.severity,
      message: this.generateAlertMessage(rule, metrics),
      timestamp: new Date(),
      resolved: false,
      metadata: {
        ruleId: rule.id,
        executionId: metrics.executionId,
        threshold: rule.threshold,
        actualValue: this.getMetricValue(rule.metric, metrics)
      }
    };
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, metrics: PipelineMetrics): string {
    const actualValue = this.getMetricValue(rule.metric, metrics);
    
    switch (rule.type) {
      case AlertType.PIPELINE_FAILURE:
        return `Pipeline ${metrics.pipelineId} execution failed`;
      
      case AlertType.SLA_BREACH:
        return `Pipeline ${metrics.pipelineId} exceeded SLA: ${actualValue}ms > ${rule.threshold}ms`;
      
      case AlertType.HIGH_LATENCY:
        return `High latency detected for pipeline ${metrics.pipelineId}: ${actualValue}ms`;
      
      case AlertType.RESOURCE_USAGE:
        return `High resource usage for pipeline ${metrics.pipelineId}: CPU ${metrics.cpuUsage}%, Memory ${metrics.memoryUsage}%`;
      
      case AlertType.DATA_DRIFT:
        return `Data drift detected for pipeline ${metrics.pipelineId}: throughput changed by ${actualValue}%`;
      
      default:
        return `Alert triggered for pipeline ${metrics.pipelineId}`;
    }
  }

  /**
   * Get metric value based on type
   */
  private getMetricValue(metric: string, metrics: PipelineMetrics): number {
    switch (metric) {
      case 'duration':
        return metrics.duration;
      case 'throughput':
        return metrics.throughput;
      case 'cpuUsage':
        return metrics.cpuUsage;
      case 'memoryUsage':
        return metrics.memoryUsage;
      case 'recordsProcessed':
        return metrics.recordsProcessed;
      default:
        return 0;
    }
  }

  /**
   * Send alert notification
   */
  private async sendAlertNotification(alert: MonitoringAlert, contacts: ContactInfo[]): Promise<void> {
    for (const contact of contacts) {
      try {
        switch (contact.type) {
          case 'email':
            await this.sendEmailAlert(contact.value, alert);
            break;
          case 'slack':
            await this.sendSlackAlert(contact.value, alert);
            break;
          case 'pagerduty':
            await this.sendPagerDutyAlert(contact.value, alert);
            break;
        }
      } catch (error) {
        console.error(`Failed to send ${contact.type} alert:`, error);
      }
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(email: string, alert: MonitoringAlert): Promise<void> {
    // Mock email sending
    console.log(`Sending email alert to ${email}: ${alert.message}`);
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(webhook: string, alert: MonitoringAlert): Promise<void> {
    // Mock Slack notification
    console.log(`Sending Slack alert to ${webhook}: ${alert.message}`);
  }

  /**
   * Send PagerDuty alert
   */
  private async sendPagerDutyAlert(integrationKey: string, alert: MonitoringAlert): Promise<void> {
    // Mock PagerDuty incident
    console.log(`Creating PagerDuty incident with key ${integrationKey}: ${alert.message}`);
  }

  /**
   * Generate panel data
   */
  private generatePanelData(panel: DashboardPanel): any {
    switch (panel.type) {
      case 'line_chart':
        return this.generateTimeSeriesData(panel);
      case 'bar_chart':
        return this.generateBarChartData(panel);
      case 'pie_chart':
        return this.generatePieChartData(panel);
      case 'stat':
        return this.generateStatData(panel);
      case 'table':
        return this.generateTableData(panel);
      default:
        return {};
    }
  }

  /**
   * Generate time series data
   */
  private generateTimeSeriesData(panel: DashboardPanel): TimeSeriesData {
    // Mock time series data
    const now = new Date();
    const dataPoints: Array<{ timestamp: Date; value: number }> = [];
    
    for (let i = 23; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      dataPoints.push({
        timestamp,
        value: Math.random() * 100
      });
    }

    return {
      series: [{
        name: panel.title,
        data: dataPoints
      }]
    };
  }

  /**
   * Generate bar chart data
   */
  private generateBarChartData(panel: DashboardPanel): BarChartData {
    return {
      categories: ['Success', 'Failed', 'Running'],
      series: [{
        name: 'Pipeline Status',
        data: [85, 10, 5]
      }]
    };
  }

  /**
   * Generate pie chart data
   */
  private generatePieChartData(panel: DashboardPanel): PieChartData {
    return {
      series: [{
        name: 'Pipeline Types',
        data: [
          { name: 'ETL', value: 45 },
          { name: 'Streaming', value: 30 },
          { name: 'ML', value: 25 }
        ]
      }]
    };
  }

  /**
   * Generate stat data
   */
  private generateStatData(panel: DashboardPanel): StatData {
    return {
      value: 42,
      unit: 'pipelines',
      trend: 'up',
      change: 12.5
    };
  }

  /**
   * Generate table data
   */
  private generateTableData(panel: DashboardPanel): TableData {
    return {
      columns: ['Pipeline', 'Status', 'Duration', 'Records'],
      rows: [
        ['user-etl-daily', 'Success', '5m 23s', '1,234,567'],
        ['orders-streaming', 'Running', '45s', '789,012'],
        ['ml-training', 'Failed', '2h 15m', '0']
      ]
    };
  }
}

/**
 * Real-time Monitoring Agent
 */
export class MonitoringAgent {
  private collectors: Map<string, MetricCollector> = new Map();
  private isRunning = false;
  private interval: NodeJS.Timeout | null = null;

  /**
   * Register metric collector
   */
  registerCollector(name: string, collector: MetricCollector): void {
    this.collectors.set(name, collector);
  }

  /**
   * Start monitoring
   */
  start(intervalMs: number = 30000): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.interval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    console.log('Monitoring agent started');
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log('Monitoring agent stopped');
  }

  /**
   * Collect metrics from all collectors
   */
  private async collectMetrics(): Promise<void> {
    const timestamp = new Date();
    
    for (const [name, collector] of this.collectors.entries()) {
      try {
        const metrics = await collector.collect();
        
        // Process and store metrics
        this.processMetrics(name, metrics, timestamp);
      } catch (error) {
        console.error(`Error collecting metrics from ${name}:`, error);
      }
    }
  }

  /**
   * Process collected metrics
   */
  private processMetrics(collectorName: string, metrics: CollectedMetric[], timestamp: Date): void {
    // Process and potentially send to monitoring service
    console.log(`Collected ${metrics.length} metrics from ${collectorName} at ${timestamp}`);
    
    for (const metric of metrics) {
      // Here you would typically send to a time series database like InfluxDB or CloudWatch
      this.storeMetric(collectorName, metric, timestamp);
    }
  }

  /**
   * Store metric (mock implementation)
   */
  private storeMetric(source: string, metric: CollectedMetric, timestamp: Date): void {
    // Mock storage - in reality, send to monitoring backend
    console.log(`Storing metric: ${source}.${metric.name} = ${metric.value} at ${timestamp}`);
  }
}

/**
 * Custom Metric Collectors
 */
export class AirflowMetricCollector implements MetricCollector {
  private airflowUrl: string;

  constructor(airflowUrl: string) {
    this.airflowUrl = airflowUrl;
  }

  async collect(): Promise<CollectedMetric[]> {
    // Mock Airflow metrics collection
    return [
      { name: 'dag_runs_total', value: 150, tags: { status: 'success' } },
      { name: 'dag_runs_total', value: 12, tags: { status: 'failed' } },
      { name: 'task_instances_total', value: 1245, tags: { state: 'success' } },
      { name: 'scheduler_heartbeat', value: Date.now(), tags: {} }
    ];
  }
}

export class KafkaMetricCollector implements MetricCollector {
  private brokers: string[];

  constructor(brokers: string[]) {
    this.brokers = brokers;
  }

  async collect(): Promise<CollectedMetric[]> {
    // Mock Kafka metrics collection
    return [
      { name: 'kafka_messages_in_rate', value: 1250.5, tags: { topic: 'user-events' } },
      { name: 'kafka_messages_out_rate', value: 1248.2, tags: { topic: 'user-events' } },
      { name: 'kafka_consumer_lag', value: 150, tags: { group: 'processing-group' } },
      { name: 'kafka_partition_size', value: 1024000, tags: { topic: 'user-events', partition: '0' } }
    ];
  }
}

export class FlinkMetricCollector implements MetricCollector {
  private jobManagerUrl: string;

  constructor(jobManagerUrl: string) {
    this.jobManagerUrl = jobManagerUrl;
  }

  async collect(): Promise<CollectedMetric[]> {
    // Mock Flink metrics collection
    return [
      { name: 'flink_records_in_rate', value: 2500.0, tags: { job: 'streaming-job' } },
      { name: 'flink_records_out_rate', value: 2498.5, tags: { job: 'streaming-job' } },
      { name: 'flink_backpressure', value: 0.1, tags: { job: 'streaming-job' } },
      { name: 'flink_checkpoint_duration', value: 1200, tags: { job: 'streaming-job' } }
    ];
  }
}

/**
 * Type definitions
 */
export interface PipelineMetrics {
  pipelineId: string;
  executionId: string;
  timestamp: Date;
  status: ExecutionStatus;
  duration: number;
  recordsProcessed: number;
  bytesProcessed: number;
  cpuUsage: number;
  memoryUsage: number;
  errorRate: number;
  throughput: number;
}

export interface AlertRule {
  id: string;
  pipelineId: string;
  name: string;
  type: AlertType;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  contacts: ContactInfo[];
  conditions?: AlertCondition[];
}

export interface AlertCondition {
  field: string;
  operator: string;
  value: any;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface AggregatedMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageDuration: number;
  averageThroughput: number;
  totalRecordsProcessed: number;
  totalBytesProcessed: number;
  peakCpuUsage: number;
  peakMemoryUsage: number;
}

export interface MonitoringDashboard {
  id: string;
  name: string;
  description: string;
  panels: DashboardPanel[];
  layout: DashboardLayout;
  refreshInterval: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardConfig {
  id: string;
  name: string;
  description: string;
  panels: DashboardPanel[];
  layout: DashboardLayout;
  refreshInterval?: number;
}

export interface DashboardPanel {
  id: string;
  type: 'line_chart' | 'bar_chart' | 'pie_chart' | 'stat' | 'table';
  title: string;
  description?: string;
  query: string;
  timeRange?: TimeRange;
  refreshInterval?: number;
  position: PanelPosition;
  size: PanelSize;
}

export interface DashboardLayout {
  columns: number;
  rows: number;
}

export interface PanelPosition {
  x: number;
  y: number;
}

export interface PanelSize {
  width: number;
  height: number;
}

export interface DashboardData {
  dashboardId: string;
  timestamp: Date;
  panels: Record<string, any>;
}

export interface TimeSeriesData {
  series: Array<{
    name: string;
    data: Array<{ timestamp: Date; value: number }>;
  }>;
}

export interface BarChartData {
  categories: string[];
  series: Array<{
    name: string;
    data: number[];
  }>;
}

export interface PieChartData {
  series: Array<{
    name: string;
    data: Array<{ name: string; value: number }>;
  }>;
}

export interface StatData {
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  change: number;
}

export interface TableData {
  columns: string[];
  rows: string[][];
}

export interface MetricCollector {
  collect(): Promise<CollectedMetric[]>;
}

export interface CollectedMetric {
  name: string;
  value: number;
  tags: Record<string, string>;
}

/**
 * Anomaly Detection Engine
 */
export class AnomalyDetectionEngine {
  private models: Map<string, AnomalyModel> = new Map();

  /**
   * Train anomaly detection model
   */
  trainModel(pipelineId: string, historicalMetrics: PipelineMetrics[]): void {
    const model = this.createStatisticalModel(historicalMetrics);
    this.models.set(pipelineId, model);
  }

  /**
   * Detect anomalies in current metrics
   */
  detectAnomalies(pipelineId: string, currentMetrics: PipelineMetrics): AnomalyResult {
    const model = this.models.get(pipelineId);
    if (!model) {
      throw new Error(`No model found for pipeline ${pipelineId}`);
    }

    const anomalies: Anomaly[] = [];

    // Check duration anomaly
    const durationScore = this.calculateAnomalyScore(currentMetrics.duration, model.duration);
    if (durationScore > model.threshold) {
      anomalies.push({
        type: 'duration',
        score: durationScore,
        expected: model.duration.mean,
        actual: currentMetrics.duration,
        severity: this.getSeverity(durationScore)
      });
    }

    // Check throughput anomaly
    const throughputScore = this.calculateAnomalyScore(currentMetrics.throughput, model.throughput);
    if (throughputScore > model.threshold) {
      anomalies.push({
        type: 'throughput',
        score: throughputScore,
        expected: model.throughput.mean,
        actual: currentMetrics.throughput,
        severity: this.getSeverity(throughputScore)
      });
    }

    return {
      pipelineId,
      timestamp: new Date(),
      anomalies,
      overallScore: Math.max(...anomalies.map(a => a.score), 0)
    };
  }

  /**
   * Create statistical model from historical data
   */
  private createStatisticalModel(metrics: PipelineMetrics[]): AnomalyModel {
    const durations = metrics.map(m => m.duration);
    const throughputs = metrics.map(m => m.throughput);

    return {
      threshold: 2.0, // 2 standard deviations
      duration: this.calculateStatistics(durations),
      throughput: this.calculateStatistics(throughputs),
      createdAt: new Date()
    };
  }

  /**
   * Calculate statistics for a metric
   */
  private calculateStatistics(values: number[]): MetricStatistics {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      variance,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  /**
   * Calculate anomaly score
   */
  private calculateAnomalyScore(value: number, stats: MetricStatistics): number {
    return Math.abs(value - stats.mean) / stats.stdDev;
  }

  /**
   * Get severity based on anomaly score
   */
  private getSeverity(score: number): 'low' | 'medium' | 'high' {
    if (score > 3.0) return 'high';
    if (score > 2.5) return 'medium';
    return 'low';
  }
}

export interface AnomalyModel {
  threshold: number;
  duration: MetricStatistics;
  throughput: MetricStatistics;
  createdAt: Date;
}

export interface MetricStatistics {
  mean: number;
  variance: number;
  stdDev: number;
  min: number;
  max: number;
}

export interface AnomalyResult {
  pipelineId: string;
  timestamp: Date;
  anomalies: Anomaly[];
  overallScore: number;
}

export interface Anomaly {
  type: string;
  score: number;
  expected: number;
  actual: number;
  severity: 'low' | 'medium' | 'high';
}

/**
 * SLA Monitor
 */
export class SLAMonitor {
  private slaConfigs: Map<string, SLAConfig> = new Map();

  /**
   * Set SLA configuration for pipeline
   */
  setSLA(pipelineId: string, sla: SLAConfig): void {
    this.slaConfigs.set(pipelineId, sla);
  }

  /**
   * Check SLA compliance
   */
  checkCompliance(execution: PipelineExecution): SLAResult {
    const sla = this.slaConfigs.get(execution.pipelineId);
    if (!sla) {
      return {
        pipelineId: execution.pipelineId,
        executionId: execution.id,
        compliant: true,
        violations: []
      };
    }

    const violations: SLAViolation[] = [];

    // Check runtime SLA
    if (execution.duration && execution.duration > sla.expectedRuntime * 60 * 1000) {
      violations.push({
        type: 'runtime',
        expected: sla.expectedRuntime * 60 * 1000,
        actual: execution.duration,
        severity: 'high'
      });
    }

    // Check failure SLA
    if (execution.status === ExecutionStatus.FAILED) {
      violations.push({
        type: 'failure',
        expected: 'success',
        actual: 'failed',
        severity: 'critical'
      });
    }

    return {
      pipelineId: execution.pipelineId,
      executionId: execution.id,
      compliant: violations.length === 0,
      violations
    };
  }
}

export interface SLAResult {
  pipelineId: string;
  executionId: string;
  compliant: boolean;
  violations: SLAViolation[];
}

export interface SLAViolation {
  type: string;
  expected: any;
  actual: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}