/**
 * Plugin Metrics Service
 * 
 * Comprehensive metrics collection and analysis for plugin ecosystem
 * Provides real-time and historical metrics for plugin usage, performance, and health
 */

import { EventEmitter } from 'events';

export interface PluginMetrics {
  pluginId: string;
  pluginName: string;
  version: string;
  timestamp: Date;
  
  // Usage Metrics
  installations: number;
  activeUsers: number;
  apiCalls: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  
  // Performance Metrics
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  throughput: number;
  errorRate: number;
  successRate: number;
  
  // Resource Utilization
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkBandwidth: number;
  cacheHitRate: number;
  
  // Health Metrics
  healthScore: number;
  availability: number;
  uptime: number;
  crashRate: number;
  restartCount: number;
  
  // Business Metrics
  revenue: number;
  cost: number;
  roi: number;
  userSatisfaction: number;
  churnRate: number;
}

export interface AggregatedMetrics {
  totalPlugins: number;
  totalInstallations: number;
  totalActiveUsers: number;
  totalApiCalls: number;
  avgHealthScore: number;
  avgResponseTime: number;
  totalRevenue: number;
  totalCost: number;
  criticalIssues: number;
  warnings: number;
}

export interface PluginTrend {
  pluginId: string;
  timeRange: string;
  trendData: {
    timestamp: Date;
    value: number;
    metric: string;
  }[];
  trendDirection: 'up' | 'down' | 'stable';
  changePercentage: number;
}

export interface PluginAnomaly {
  pluginId: string;
  metric: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
  description: string;
  expectedValue: number;
  actualValue: number;
  deviation: number;
  recommendation: string;
}

export interface PluginDependency {
  pluginId: string;
  dependencies: {
    pluginId: string;
    version: string;
    required: boolean;
    impact: 'low' | 'medium' | 'high';
  }[];
  dependents: {
    pluginId: string;
    version: string;
  }[];
}

export interface AlertRule {
  id: string;
  name: string;
  pluginId?: string;
  metric: string;
  condition: 'greater' | 'less' | 'equal' | 'between';
  threshold: number | [number, number];
  duration: number; // in seconds
  severity: 'info' | 'warning' | 'error' | 'critical';
  channels: ('email' | 'slack' | 'pagerduty' | 'webhook')[];
  enabled: boolean;
}

export interface PluginInsight {
  pluginId: string;
  type: 'optimization' | 'warning' | 'recommendation' | 'prediction';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  suggestedAction: string;
  potentialSavings?: number;
  confidence: number;
}

class PluginMetricsService extends EventEmitter {
  private metricsCache: Map<string, PluginMetrics[]> = new Map();
  private anomalies: PluginAnomaly[] = [];
  private alertRules: AlertRule[] = [];
  private insights: PluginInsight[] = [];
  private aggregatedMetrics: AggregatedMetrics | null = null;
  private lastUpdate: Date = new Date();
  
  constructor() {
    super();
    this.initializeDefaultAlertRules();
    this.startMetricsCollection();
  }
  
  private initializeDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        metric: 'errorRate',
        condition: 'greater',
        threshold: 5,
        duration: 300,
        severity: 'critical',
        channels: ['email', 'slack'],
        enabled: true,
      },
      {
        id: 'low-availability',
        name: 'Low Availability',
        metric: 'availability',
        condition: 'less',
        threshold: 99.5,
        duration: 600,
        severity: 'error',
        channels: ['email', 'pagerduty'],
        enabled: true,
      },
      {
        id: 'high-response-time',
        name: 'High Response Time',
        metric: 'avgResponseTime',
        condition: 'greater',
        threshold: 1000,
        duration: 300,
        severity: 'warning',
        channels: ['slack'],
        enabled: true,
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        metric: 'memoryUsage',
        condition: 'greater',
        threshold: 90,
        duration: 600,
        severity: 'warning',
        channels: ['email'],
        enabled: true,
      },
    ];
  }
  
  private startMetricsCollection(): void {
    // Simulate real-time metrics collection
    setInterval(() => {
      this.collectMetrics();
      this.detectAnomalies();
      this.generateInsights();
      this.checkAlerts();
      this.emit('metrics-updated', this.getLatestMetrics());
    }, 30000); // Every 30 seconds
  }
  
  private collectMetrics(): void {
    const plugins = this.getPluginList();
    
    plugins.forEach(plugin => {
      const metrics = this.generatePluginMetrics(plugin);
      
      if (!this.metricsCache.has(plugin.id)) {
        this.metricsCache.set(plugin.id, []);
      }
      
      const pluginMetrics = this.metricsCache.get(plugin.id)!;
      pluginMetrics.push(metrics);
      
      // Keep only last 1000 data points
      if (pluginMetrics.length > 1000) {
        pluginMetrics.shift();
      }
    });
    
    this.updateAggregatedMetrics();
    this.lastUpdate = new Date();
  }
  
  private generatePluginMetrics(plugin: any): PluginMetrics {
    const baseMetrics = {
      pluginId: plugin.id,
      pluginName: plugin.name,
      version: plugin.version,
      timestamp: new Date(),
      
      // Usage Metrics
      installations: Math.floor(Math.random() * 10000) + 100,
      activeUsers: Math.floor(Math.random() * 5000) + 50,
      apiCalls: Math.floor(Math.random() * 100000) + 1000,
      dailyActiveUsers: Math.floor(Math.random() * 1000) + 10,
      weeklyActiveUsers: Math.floor(Math.random() * 3000) + 30,
      monthlyActiveUsers: Math.floor(Math.random() * 5000) + 50,
      
      // Performance Metrics
      avgResponseTime: Math.random() * 200 + 50,
      p50ResponseTime: Math.random() * 150 + 40,
      p95ResponseTime: Math.random() * 500 + 200,
      p99ResponseTime: Math.random() * 1000 + 500,
      throughput: Math.random() * 1000 + 100,
      errorRate: Math.random() * 5,
      successRate: 95 + Math.random() * 5,
      
      // Resource Utilization
      cpuUsage: Math.random() * 80 + 10,
      memoryUsage: Math.random() * 70 + 20,
      diskUsage: Math.random() * 60 + 10,
      networkBandwidth: Math.random() * 100 + 10,
      cacheHitRate: Math.random() * 30 + 70,
      
      // Health Metrics
      healthScore: Math.random() * 30 + 70,
      availability: 99 + Math.random(),
      uptime: Math.random() * 30 * 24 * 3600, // in seconds
      crashRate: Math.random() * 2,
      restartCount: Math.floor(Math.random() * 5),
      
      // Business Metrics
      revenue: Math.random() * 10000,
      cost: Math.random() * 5000,
      roi: Math.random() * 200 - 50,
      userSatisfaction: Math.random() * 2 + 3,
      churnRate: Math.random() * 10,
    };
    
    return baseMetrics;
  }
  
  private updateAggregatedMetrics(): void {
    const allMetrics = Array.from(this.metricsCache.values())
      .map(metrics => metrics[metrics.length - 1])
      .filter(Boolean);
    
    if (allMetrics.length === 0) {
      return;
    }
    
    this.aggregatedMetrics = {
      totalPlugins: allMetrics.length,
      totalInstallations: allMetrics.reduce((sum, m) => sum + m.installations, 0),
      totalActiveUsers: allMetrics.reduce((sum, m) => sum + m.activeUsers, 0),
      totalApiCalls: allMetrics.reduce((sum, m) => sum + m.apiCalls, 0),
      avgHealthScore: allMetrics.reduce((sum, m) => sum + m.healthScore, 0) / allMetrics.length,
      avgResponseTime: allMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / allMetrics.length,
      totalRevenue: allMetrics.reduce((sum, m) => sum + m.revenue, 0),
      totalCost: allMetrics.reduce((sum, m) => sum + m.cost, 0),
      criticalIssues: allMetrics.filter(m => m.healthScore < 50 || m.errorRate > 10).length,
      warnings: allMetrics.filter(m => m.healthScore < 70 || m.errorRate > 5).length,
    };
  }
  
  private detectAnomalies(): void {
    this.anomalies = [];
    
    this.metricsCache.forEach((metrics, pluginId) => {
      if (metrics.length < 10) return;
      
      const latestMetric = metrics[metrics.length - 1];
      const historicalMetrics = metrics.slice(-10, -1);
      
      // Check for response time anomalies
      const avgHistoricalResponseTime = historicalMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / historicalMetrics.length;
      const responseTimeDeviation = Math.abs(latestMetric.avgResponseTime - avgHistoricalResponseTime) / avgHistoricalResponseTime;
      
      if (responseTimeDeviation > 0.5) {
        this.anomalies.push({
          pluginId,
          metric: 'avgResponseTime',
          severity: responseTimeDeviation > 1 ? 'critical' : responseTimeDeviation > 0.75 ? 'high' : 'medium',
          detectedAt: new Date(),
          description: `Response time deviation detected: ${(responseTimeDeviation * 100).toFixed(1)}% from normal`,
          expectedValue: avgHistoricalResponseTime,
          actualValue: latestMetric.avgResponseTime,
          deviation: responseTimeDeviation,
          recommendation: 'Review recent changes and check for performance bottlenecks',
        });
      }
      
      // Check for error rate anomalies
      const avgHistoricalErrorRate = historicalMetrics.reduce((sum, m) => sum + m.errorRate, 0) / historicalMetrics.length;
      if (latestMetric.errorRate > avgHistoricalErrorRate * 2 && latestMetric.errorRate > 1) {
        this.anomalies.push({
          pluginId,
          metric: 'errorRate',
          severity: latestMetric.errorRate > 10 ? 'critical' : latestMetric.errorRate > 5 ? 'high' : 'medium',
          detectedAt: new Date(),
          description: 'Unusual increase in error rate detected',
          expectedValue: avgHistoricalErrorRate,
          actualValue: latestMetric.errorRate,
          deviation: (latestMetric.errorRate - avgHistoricalErrorRate) / avgHistoricalErrorRate,
          recommendation: 'Check error logs and recent deployments',
        });
      }
    });
  }
  
  private generateInsights(): void {
    this.insights = [];
    
    this.metricsCache.forEach((metrics, pluginId) => {
      const latestMetric = metrics[metrics.length - 1];
      if (!latestMetric) return;
      
      // Cost optimization insights
      if (latestMetric.cpuUsage < 20 && latestMetric.memoryUsage < 30) {
        this.insights.push({
          pluginId,
          type: 'optimization',
          title: 'Resource Over-provisioning Detected',
          description: 'This plugin is using minimal resources. Consider scaling down to save costs.',
          impact: 'medium',
          suggestedAction: 'Review resource allocation and consider using smaller instance types',
          potentialSavings: latestMetric.cost * 0.3,
          confidence: 0.85,
        });
      }
      
      // Performance optimization insights
      if (latestMetric.cacheHitRate < 60) {
        this.insights.push({
          pluginId,
          type: 'recommendation',
          title: 'Low Cache Hit Rate',
          description: 'Cache hit rate is below optimal levels, which may impact performance.',
          impact: 'medium',
          suggestedAction: 'Review caching strategy and consider implementing more aggressive caching',
          confidence: 0.9,
        });
      }
      
      // Predictive insights
      if (metrics.length > 20) {
        const recentTrend = this.calculateTrend(metrics.slice(-20).map(m => m.activeUsers));
        if (recentTrend > 0.2) {
          this.insights.push({
            pluginId,
            type: 'prediction',
            title: 'Growing User Base',
            description: 'User adoption is increasing rapidly. Consider scaling resources proactively.',
            impact: 'high',
            suggestedAction: 'Plan for capacity increase to handle growing demand',
            confidence: 0.75,
          });
        }
      }
    });
  }
  
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgY = sumY / n;
    
    return avgY > 0 ? slope / avgY : 0;
  }
  
  private checkAlerts(): void {
    this.alertRules.forEach(rule => {
      if (!rule.enabled) return;
      
      this.metricsCache.forEach((metrics, pluginId) => {
        if (rule.pluginId && rule.pluginId !== pluginId) return;
        
        const recentMetrics = metrics.slice(-Math.ceil(rule.duration / 30));
        if (recentMetrics.length === 0) return;
        
        const violations = recentMetrics.filter(metric => {
          const value = (metric as any)[rule.metric];
          if (rule.condition === 'greater') {
            return value > rule.threshold;
          } else if (rule.condition === 'less') {
            return value < rule.threshold;
          } else if (rule.condition === 'equal') {
            return value === rule.threshold;
          } else if (rule.condition === 'between' && Array.isArray(rule.threshold)) {
            return value >= rule.threshold[0] && value <= rule.threshold[1];
          }
          return false;
        });
        
        if (violations.length === recentMetrics.length && violations.length > 0) {
          this.triggerAlert(rule, pluginId, violations[violations.length - 1]);
        }
      });
    });
  }
  
  private triggerAlert(rule: AlertRule, pluginId: string, metric: PluginMetrics): void {
    const alert = {
      ruleId: rule.id,
      pluginId,
      metric: rule.metric,
      value: (metric as any)[rule.metric],
      threshold: rule.threshold,
      severity: rule.severity,
      timestamp: new Date(),
      message: `Alert: ${rule.name} triggered for plugin ${pluginId}`,
    };
    
    this.emit('alert', alert);
    
    // Send notifications to configured channels
    rule.channels.forEach(channel => {
      this.sendNotification(channel, alert);
    });
  }
  
  private sendNotification(channel: string, alert: any): void {
    // Implementation would integrate with actual notification services
    console.log(`Sending ${channel} notification:`, alert);
  }
  
  private getPluginList(): any[] {
    // Mock plugin list - in production, this would fetch from database
    return [
      { id: 'catalog', name: 'Catalog Plugin', version: '1.2.3' },
      { id: 'scaffolder', name: 'Scaffolder Plugin', version: '2.0.1' },
      { id: 'techdocs', name: 'TechDocs Plugin', version: '1.5.0' },
      { id: 'kubernetes', name: 'Kubernetes Plugin', version: '3.1.0' },
      { id: 'github-actions', name: 'GitHub Actions Plugin', version: '1.0.5' },
      { id: 'cost-insights', name: 'Cost Insights Plugin', version: '2.2.0' },
      { id: 'rollbar', name: 'Rollbar Plugin', version: '1.1.0' },
      { id: 'sentry', name: 'Sentry Plugin', version: '1.3.2' },
    ];
  }
  
  // Public Methods
  
  public getLatestMetrics(pluginId?: string): PluginMetrics[] {
    if (pluginId) {
      const metrics = this.metricsCache.get(pluginId);
      return metrics ? [metrics[metrics.length - 1]] : [];
    }
    
    return Array.from(this.metricsCache.values())
      .map(metrics => metrics[metrics.length - 1])
      .filter(Boolean);
  }
  
  public getHistoricalMetrics(pluginId: string, timeRange: string): PluginMetrics[] {
    const metrics = this.metricsCache.get(pluginId) || [];
    const now = Date.now();
    
    const ranges: Record<string, number> = {
      '1h': 3600000,
      '6h': 21600000,
      '24h': 86400000,
      '7d': 604800000,
      '30d': 2592000000,
    };
    
    const rangeMs = ranges[timeRange] || 86400000;
    const cutoff = now - rangeMs;
    
    return metrics.filter(m => m.timestamp.getTime() > cutoff);
  }
  
  public getAggregatedMetrics(): AggregatedMetrics | null {
    return this.aggregatedMetrics;
  }
  
  public getAnomalies(severity?: string): PluginAnomaly[] {
    if (severity) {
      return this.anomalies.filter(a => a.severity === severity);
    }
    return this.anomalies;
  }
  
  public getInsights(pluginId?: string): PluginInsight[] {
    if (pluginId) {
      return this.insights.filter(i => i.pluginId === pluginId);
    }
    return this.insights;
  }
  
  public getPluginTrends(pluginId: string, metric: string, timeRange: string): PluginTrend {
    const metrics = this.getHistoricalMetrics(pluginId, timeRange);
    
    const trendData = metrics.map(m => ({
      timestamp: m.timestamp,
      value: (m as any)[metric],
      metric,
    }));
    
    const trendValue = this.calculateTrend(trendData.map(d => d.value));
    const changePercentage = trendData.length > 1
      ? ((trendData[trendData.length - 1].value - trendData[0].value) / trendData[0].value) * 100
      : 0;
    
    return {
      pluginId,
      timeRange,
      trendData,
      trendDirection: trendValue > 0.05 ? 'up' : trendValue < -0.05 ? 'down' : 'stable',
      changePercentage,
    };
  }
  
  public getDependencyGraph(pluginId?: string): PluginDependency[] {
    // Mock dependency data - in production, this would be calculated from actual plugin configs
    const dependencies: PluginDependency[] = [
      {
        pluginId: 'catalog',
        dependencies: [
          { pluginId: 'scaffolder', version: '2.0.0', required: true, impact: 'high' },
          { pluginId: 'techdocs', version: '1.0.0', required: false, impact: 'medium' },
        ],
        dependents: [
          { pluginId: 'kubernetes', version: '3.0.0' },
          { pluginId: 'cost-insights', version: '2.0.0' },
        ],
      },
      {
        pluginId: 'scaffolder',
        dependencies: [
          { pluginId: 'catalog', version: '1.0.0', required: true, impact: 'high' },
        ],
        dependents: [
          { pluginId: 'github-actions', version: '1.0.0' },
        ],
      },
    ];
    
    if (pluginId) {
      return dependencies.filter(d => d.pluginId === pluginId);
    }
    return dependencies;
  }
  
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
  }
  
  public updateAlertRule(ruleId: string, updates: Partial<AlertRule>): void {
    const index = this.alertRules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.alertRules[index] = { ...this.alertRules[index], ...updates };
    }
  }
  
  public deleteAlertRule(ruleId: string): void {
    this.alertRules = this.alertRules.filter(r => r.id !== ruleId);
  }
  
  public getAlertRules(): AlertRule[] {
    return this.alertRules;
  }
  
  public exportMetrics(pluginId?: string, format: 'json' | 'csv' = 'json'): string {
    const metrics = pluginId 
      ? this.metricsCache.get(pluginId) || []
      : Array.from(this.metricsCache.values()).flat();
    
    if (format === 'json') {
      return JSON.stringify(metrics, null, 2);
    }
    
    // CSV export
    if (metrics.length === 0) return '';
    
    const headers = Object.keys(metrics[0]).join(',');
    const rows = metrics.map(m => Object.values(m).join(','));
    
    return [headers, ...rows].join('\n');
  }
}

// Singleton instance
let instance: PluginMetricsService | null = null;

export function getPluginMetricsService(): PluginMetricsService {
  if (!instance) {
    instance = new PluginMetricsService();
  }
  return instance;
}

export default PluginMetricsService;