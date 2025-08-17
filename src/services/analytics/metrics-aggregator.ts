import { EventEmitter } from 'events';
import { prisma } from '@/lib/prisma';
import { GitHubService } from '@/services/integrations/github';
import { JiraService } from '@/services/integrations/jira';
import { PrometheusClient } from '@/services/monitoring/prometheus';

interface MetricSource {
  type: 'git' | 'cicd' | 'ticketing' | 'monitoring' | 'custom';
  name: string;
  endpoint?: string;
  credentials?: any;
  pollInterval?: number;
}

interface TimeSeriesDataPoint {
  timestamp: Date;
  value: number;
  labels?: Map<string, string>;
}

interface AggregatedMetric {
  name: string;
  source: string;
  period: {
    start: Date;
    end: Date;
  };
  dataPoints: TimeSeriesDataPoint[];
  statistics: {
    min: number;
    max: number;
    mean: number;
    median: number;
    stdDev: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  trends: {
    direction: 'up' | 'down' | 'stable';
    changePercent: number;
    velocity: number;
  };
}

interface MetricFormula {
  id: string;
  name: string;
  description: string;
  formula: string;
  inputs: string[];
  unit: string;
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
}

export class MetricsAggregator extends EventEmitter {
  private sources: Map<string, MetricSource> = new Map();
  private metrics: Map<string, AggregatedMetric> = new Map();
  private formulas: Map<string, MetricFormula> = new Map();
  private collectionJobs: Map<string, NodeJS.Timeout> = new Map();
  private retentionPolicy: Map<string, number> = new Map();
  
  private githubService: GitHubService;
  private jiraService: JiraService;
  private prometheusClient: PrometheusClient;

  constructor() {
    super();
    this.githubService = new GitHubService();
    this.jiraService = new JiraService();
    this.prometheusClient = new PrometheusClient();
    this.initializeDefaultFormulas();
    this.setDefaultRetentionPolicies();
  }

  private initializeDefaultFormulas() {
    const defaultFormulas: MetricFormula[] = [
      {
        id: 'deployment-frequency',
        name: 'Deployment Frequency',
        description: 'Number of deployments per day',
        formula: 'deployments.count / days',
        inputs: ['deployments.count'],
        unit: 'deployments/day',
        aggregation: 'avg'
      },
      {
        id: 'lead-time',
        name: 'Lead Time for Changes',
        description: 'Time from code commit to production',
        formula: 'deployment.timestamp - commit.timestamp',
        inputs: ['deployment.timestamp', 'commit.timestamp'],
        unit: 'hours',
        aggregation: 'avg'
      },
      {
        id: 'mttr',
        name: 'Mean Time to Restore',
        description: 'Time to restore service after incident',
        formula: 'incident.resolved_at - incident.created_at',
        inputs: ['incident.resolved_at', 'incident.created_at'],
        unit: 'hours',
        aggregation: 'avg'
      },
      {
        id: 'change-failure-rate',
        name: 'Change Failure Rate',
        description: 'Percentage of deployments causing failures',
        formula: '(failed_deployments / total_deployments) * 100',
        inputs: ['failed_deployments', 'total_deployments'],
        unit: '%',
        aggregation: 'avg'
      },
      {
        id: 'code-review-time',
        name: 'Code Review Time',
        description: 'Average time to review pull requests',
        formula: 'pr.merged_at - pr.created_at',
        inputs: ['pr.merged_at', 'pr.created_at'],
        unit: 'hours',
        aggregation: 'avg'
      },
      {
        id: 'build-success-rate',
        name: 'Build Success Rate',
        description: 'Percentage of successful builds',
        formula: '(successful_builds / total_builds) * 100',
        inputs: ['successful_builds', 'total_builds'],
        unit: '%',
        aggregation: 'avg'
      }
    ];

    defaultFormulas.forEach(formula => {
      this.formulas.set(formula.id, formula);
    });
  }

  private setDefaultRetentionPolicies() {
    this.retentionPolicy.set('raw', 7);
    this.retentionPolicy.set('hourly', 30);
    this.retentionPolicy.set('daily', 90);
    this.retentionPolicy.set('weekly', 365);
    this.retentionPolicy.set('monthly', 1095);
  }

  async addSource(source: MetricSource): Promise<void> {
    this.sources.set(source.name, source);
    
    if (source.pollInterval) {
      this.startCollection(source);
    }

    await prisma.metricSource.create({
      data: {
        name: source.name,
        type: source.type,
        config: source
      }
    });

    this.emit('source-added', source);
  }

  private startCollection(source: MetricSource) {
    const interval = source.pollInterval || 60000;
    
    const job = setInterval(async () => {
      try {
        await this.collectFromSource(source);
      } catch (error) {
        this.emit('collection-error', { source: source.name, error });
      }
    }, interval);

    this.collectionJobs.set(source.name, job);
  }

  private async collectFromSource(source: MetricSource) {
    let data: any;

    switch (source.type) {
      case 'git':
        data = await this.collectGitMetrics(source);
        break;
      case 'cicd':
        data = await this.collectCICDMetrics(source);
        break;
      case 'ticketing':
        data = await this.collectTicketingMetrics(source);
        break;
      case 'monitoring':
        data = await this.collectMonitoringMetrics(source);
        break;
      case 'custom':
        data = await this.collectCustomMetrics(source);
        break;
    }

    await this.processRawData(source.name, data);
  }

  private async collectGitMetrics(source: MetricSource): Promise<any> {
    const metrics = {
      commits: await this.githubService.getCommits(),
      pullRequests: await this.githubService.getPullRequests(),
      branches: await this.githubService.getBranches(),
      contributors: await this.githubService.getContributors()
    };

    return metrics;
  }

  private async collectCICDMetrics(source: MetricSource): Promise<any> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const [builds, deployments, tests] = await Promise.all([
      prisma.build.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.deployment.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.testRun.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } }
      })
    ]);

    return { builds, deployments, tests };
  }

  private async collectTicketingMetrics(source: MetricSource): Promise<any> {
    const metrics = {
      issues: await this.jiraService.getIssues(),
      sprints: await this.jiraService.getSprints(),
      velocity: await this.jiraService.getVelocity(),
      burndown: await this.jiraService.getBurndown()
    };

    return metrics;
  }

  private async collectMonitoringMetrics(source: MetricSource): Promise<any> {
    const queries = [
      'rate(http_requests_total[5m])',
      'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))',
      'rate(errors_total[5m])',
      'up'
    ];

    const results = await Promise.all(
      queries.map(query => this.prometheusClient.query(query))
    );

    return {
      requestRate: results[0],
      latencyP95: results[1],
      errorRate: results[2],
      availability: results[3]
    };
  }

  private async collectCustomMetrics(source: MetricSource): Promise<any> {
    if (!source.endpoint) {
      throw new Error(`No endpoint configured for source ${source.name}`);
    }

    const response = await fetch(source.endpoint, {
      headers: source.credentials || {}
    });

    return await response.json();
  }

  private async processRawData(sourceName: string, data: any) {
    const timestamp = new Date();
    const processed: TimeSeriesDataPoint[] = [];

    if (Array.isArray(data)) {
      data.forEach(item => {
        processed.push({
          timestamp,
          value: this.extractValue(item),
          labels: this.extractLabels(item)
        });
      });
    } else if (typeof data === 'object') {
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'number') {
          processed.push({
            timestamp,
            value,
            labels: new Map([['metric', key]])
          });
        }
      });
    }

    await this.storeMetrics(sourceName, processed);
    await this.aggregateMetrics(sourceName, processed);
  }

  private extractValue(item: any): number {
    if (typeof item === 'number') return item;
    if (item.value !== undefined) return item.value;
    if (item.count !== undefined) return item.count;
    if (item.duration !== undefined) return item.duration;
    return 0;
  }

  private extractLabels(item: any): Map<string, string> {
    const labels = new Map<string, string>();
    
    if (item.labels) {
      Object.entries(item.labels).forEach(([key, value]) => {
        labels.set(key, String(value));
      });
    }
    
    if (item.team) labels.set('team', item.team);
    if (item.service) labels.set('service', item.service);
    if (item.environment) labels.set('environment', item.environment);
    
    return labels;
  }

  private async storeMetrics(sourceName: string, dataPoints: TimeSeriesDataPoint[]) {
    const records = dataPoints.map(dp => ({
      source: sourceName,
      timestamp: dp.timestamp,
      value: dp.value,
      labels: Object.fromEntries(dp.labels || new Map())
    }));

    await prisma.metricDataPoint.createMany({ data: records });
    await this.enforceRetention(sourceName);
  }

  private async enforceRetention(sourceName: string) {
    const retentionDays = this.retentionPolicy.get('raw') || 7;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    await prisma.metricDataPoint.deleteMany({
      where: {
        source: sourceName,
        timestamp: { lt: cutoffDate }
      }
    });
  }

  async aggregateMetrics(
    sourceName: string,
    dataPoints: TimeSeriesDataPoint[],
    period: { start: Date; end: Date } = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date()
    }
  ): Promise<AggregatedMetric> {
    const statistics = this.calculateStatistics(dataPoints);
    const trends = this.analyzeTrends(dataPoints);

    const aggregated: AggregatedMetric = {
      name: `${sourceName}-aggregated`,
      source: sourceName,
      period,
      dataPoints,
      statistics,
      trends
    };

    this.metrics.set(aggregated.name, aggregated);
    await this.persistAggregatedMetric(aggregated);

    this.emit('metrics-aggregated', aggregated);
    return aggregated;
  }

  private calculateStatistics(dataPoints: TimeSeriesDataPoint[]): any {
    const values = dataPoints.map(dp => dp.value).sort((a, b) => a - b);
    
    if (values.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stdDev: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0
      };
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      min: values[0],
      max: values[values.length - 1],
      mean,
      median: this.percentile(values, 50),
      stdDev,
      p50: this.percentile(values, 50),
      p75: this.percentile(values, 75),
      p90: this.percentile(values, 90),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99)
    };
  }

  private percentile(sortedValues: number[], p: number): number {
    const index = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private analyzeTrends(dataPoints: TimeSeriesDataPoint[]): any {
    if (dataPoints.length < 2) {
      return {
        direction: 'stable',
        changePercent: 0,
        velocity: 0
      };
    }

    const values = dataPoints.map(dp => dp.value);
    const timestamps = dataPoints.map(dp => dp.timestamp.getTime());
    
    const regression = this.linearRegression(timestamps, values);
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const changePercent = ((lastValue - firstValue) / firstValue) * 100;

    let direction: 'up' | 'down' | 'stable';
    if (regression.slope > 0.01) direction = 'up';
    else if (regression.slope < -0.01) direction = 'down';
    else direction = 'stable';

    return {
      direction,
      changePercent,
      velocity: regression.slope
    };
  }

  private linearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  private async persistAggregatedMetric(metric: AggregatedMetric) {
    await prisma.aggregatedMetric.create({
      data: {
        name: metric.name,
        source: metric.source,
        period: metric.period,
        statistics: metric.statistics,
        trends: metric.trends,
        dataPointCount: metric.dataPoints.length
      }
    });
  }

  async calculateCustomMetric(formulaId: string): Promise<number> {
    const formula = this.formulas.get(formulaId);
    if (!formula) {
      throw new Error(`Formula ${formulaId} not found`);
    }

    const inputValues = await this.gatherInputValues(formula.inputs);
    const result = this.evaluateFormula(formula.formula, inputValues);

    await this.storeCalculatedMetric(formulaId, result);
    return result;
  }

  private async gatherInputValues(inputs: string[]): Promise<Map<string, number>> {
    const values = new Map<string, number>();

    for (const input of inputs) {
      const value = await this.fetchMetricValue(input);
      values.set(input, value);
    }

    return values;
  }

  private async fetchMetricValue(metricPath: string): Promise<number> {
    const [source, metric] = metricPath.split('.');
    
    const latestDataPoint = await prisma.metricDataPoint.findFirst({
      where: {
        source,
        labels: {
          path: ['metric'],
          equals: metric
        }
      },
      orderBy: { timestamp: 'desc' }
    });

    return latestDataPoint?.value || 0;
  }

  private evaluateFormula(formula: string, inputs: Map<string, number>): number {
    let evaluatedFormula = formula;
    
    inputs.forEach((value, key) => {
      evaluatedFormula = evaluatedFormula.replace(new RegExp(key, 'g'), value.toString());
    });

    try {
      return Function('"use strict"; return (' + evaluatedFormula + ')')();
    } catch (error) {
      console.error('Formula evaluation error:', error);
      return 0;
    }
  }

  private async storeCalculatedMetric(formulaId: string, value: number) {
    await prisma.calculatedMetric.create({
      data: {
        formulaId,
        value,
        timestamp: new Date()
      }
    });
  }

  async createRollingAverage(
    metricName: string,
    windowSize: number,
    unit: 'minutes' | 'hours' | 'days' = 'hours'
  ): Promise<TimeSeriesDataPoint[]> {
    const windowMs = this.getWindowMilliseconds(windowSize, unit);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - windowMs * 10);

    const dataPoints = await this.getMetricDataPoints(metricName, startTime, endTime);
    const rollingAverage: TimeSeriesDataPoint[] = [];

    for (let i = 0; i < dataPoints.length; i++) {
      const windowStart = new Date(dataPoints[i].timestamp.getTime() - windowMs);
      const windowPoints = dataPoints.filter(
        dp => dp.timestamp >= windowStart && dp.timestamp <= dataPoints[i].timestamp
      );

      if (windowPoints.length > 0) {
        const avgValue = windowPoints.reduce((sum, dp) => sum + dp.value, 0) / windowPoints.length;
        rollingAverage.push({
          timestamp: dataPoints[i].timestamp,
          value: avgValue
        });
      }
    }

    return rollingAverage;
  }

  private getWindowMilliseconds(size: number, unit: string): number {
    switch (unit) {
      case 'minutes':
        return size * 60 * 1000;
      case 'hours':
        return size * 60 * 60 * 1000;
      case 'days':
        return size * 24 * 60 * 60 * 1000;
      default:
        return size * 60 * 60 * 1000;
    }
  }

  private async getMetricDataPoints(
    metricName: string,
    startTime: Date,
    endTime: Date
  ): Promise<TimeSeriesDataPoint[]> {
    const dataPoints = await prisma.metricDataPoint.findMany({
      where: {
        source: metricName,
        timestamp: {
          gte: startTime,
          lte: endTime
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    return dataPoints.map(dp => ({
      timestamp: dp.timestamp,
      value: dp.value,
      labels: new Map(Object.entries(dp.labels as any))
    }));
  }

  async detectAnomalies(
    metricName: string,
    threshold: number = 3
  ): Promise<{
    anomalies: TimeSeriesDataPoint[];
    bounds: { upper: number; lower: number };
  }> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const dataPoints = await this.getMetricDataPoints(metricName, startTime, endTime);
    const values = dataPoints.map(dp => dp.value);
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );
    
    const upperBound = mean + threshold * stdDev;
    const lowerBound = mean - threshold * stdDev;
    
    const anomalies = dataPoints.filter(
      dp => dp.value > upperBound || dp.value < lowerBound
    );

    await this.storeAnomalies(metricName, anomalies);

    return {
      anomalies,
      bounds: { upper: upperBound, lower: lowerBound }
    };
  }

  private async storeAnomalies(metricName: string, anomalies: TimeSeriesDataPoint[]) {
    const records = anomalies.map(anomaly => ({
      metric: metricName,
      timestamp: anomaly.timestamp,
      value: anomaly.value,
      type: 'statistical',
      severity: this.calculateAnomalySeverity(anomaly.value)
    }));

    await prisma.metricAnomaly.createMany({ data: records });
  }

  private calculateAnomalySeverity(value: number): 'low' | 'medium' | 'high' {
    return 'medium';
  }

  async correlateMetrics(
    metric1: string,
    metric2: string,
    period: { start: Date; end: Date }
  ): Promise<{
    correlation: number;
    relationship: 'strong' | 'moderate' | 'weak' | 'none';
  }> {
    const [data1, data2] = await Promise.all([
      this.getMetricDataPoints(metric1, period.start, period.end),
      this.getMetricDataPoints(metric2, period.start, period.end)
    ]);

    const correlation = this.calculateCorrelation(
      data1.map(d => d.value),
      data2.map(d => d.value)
    );

    let relationship: 'strong' | 'moderate' | 'weak' | 'none';
    const absCorr = Math.abs(correlation);
    
    if (absCorr > 0.7) relationship = 'strong';
    else if (absCorr > 0.4) relationship = 'moderate';
    else if (absCorr > 0.2) relationship = 'weak';
    else relationship = 'none';

    return { correlation, relationship };
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    if (denomX === 0 || denomY === 0) return 0;
    return numerator / Math.sqrt(denomX * denomY);
  }

  async exportMetrics(
    format: 'csv' | 'json' | 'prometheus',
    options: {
      metrics?: string[];
      period?: { start: Date; end: Date };
      includeStatistics?: boolean;
    } = {}
  ): Promise<string> {
    const metrics = options.metrics || Array.from(this.metrics.keys());
    const data: any[] = [];

    for (const metricName of metrics) {
      const metric = this.metrics.get(metricName);
      if (!metric) continue;

      if (options.period) {
        const filtered = metric.dataPoints.filter(
          dp => dp.timestamp >= options.period!.start && dp.timestamp <= options.period!.end
        );
        data.push({ ...metric, dataPoints: filtered });
      } else {
        data.push(metric);
      }
    }

    switch (format) {
      case 'csv':
        return this.exportToCSV(data);
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'prometheus':
        return this.exportToPrometheus(data);
      default:
        return JSON.stringify(data);
    }
  }

  private exportToCSV(data: any[]): string {
    const headers = ['timestamp', 'metric', 'value', 'source'];
    const rows: string[] = [headers.join(',')];

    data.forEach(metric => {
      metric.dataPoints.forEach((dp: TimeSeriesDataPoint) => {
        rows.push([
          dp.timestamp.toISOString(),
          metric.name,
          dp.value.toString(),
          metric.source
        ].join(','));
      });
    });

    return rows.join('\n');
  }

  private exportToPrometheus(data: any[]): string {
    const lines: string[] = [];

    data.forEach(metric => {
      const metricName = metric.name.replace(/[^a-zA-Z0-9_]/g, '_');
      
      lines.push(`# HELP ${metricName} ${metric.name}`);
      lines.push(`# TYPE ${metricName} gauge`);
      
      metric.dataPoints.forEach((dp: TimeSeriesDataPoint) => {
        const labels = Array.from(dp.labels || new Map())
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        
        const labelString = labels ? `{${labels}}` : '';
        lines.push(`${metricName}${labelString} ${dp.value} ${dp.timestamp.getTime()}`);
      });
    });

    return lines.join('\n');
  }

  async createDashboard(
    name: string,
    metrics: string[],
    refreshInterval: number = 60000
  ): Promise<void> {
    const dashboard = {
      id: `dashboard-${Date.now()}`,
      name,
      metrics,
      refreshInterval,
      createdAt: new Date()
    };

    await prisma.metricDashboard.create({ data: dashboard });
    
    this.emit('dashboard-created', dashboard);
  }

  cleanup() {
    this.collectionJobs.forEach(job => clearInterval(job));
    this.collectionJobs.clear();
  }
}