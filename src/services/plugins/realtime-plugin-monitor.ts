/**
 * Real-Time Plugin Monitoring & Auto-Recovery System
 * 
 * Comprehensive monitoring system with health checks, performance metrics,
 * auto-recovery, and intelligent alerting for plugin deployments
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import axios from 'axios';
import WebSocket from 'ws';
import { z } from 'zod';

// Monitoring Schema Definitions
export const HealthCheckSchema = z.object({
  pluginId: z.string(),
  tenantId: z.string(),
  deploymentId: z.string(),
  timestamp: z.date(),
  status: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  responseTime: z.number(),
  error: z.string().optional(),
  metadata: z.record(z.any()).default({})
});

export type HealthCheck = z.infer<typeof HealthCheckSchema>;

export const MetricSchema = z.object({
  pluginId: z.string(),
  tenantId: z.string(),
  deploymentId: z.string(),
  timestamp: z.date(),
  name: z.string(),
  value: z.number(),
  unit: z.string(),
  tags: z.record(z.string()).default({}),
  dimensions: z.record(z.string()).default({})
});

export type Metric = z.infer<typeof MetricSchema>;

export const AlertSchema = z.object({
  id: z.string(),
  pluginId: z.string(),
  tenantId: z.string(),
  deploymentId: z.string(),
  severity: z.enum(['info', 'warning', 'critical', 'emergency']),
  title: z.string(),
  description: z.string(),
  condition: z.string(),
  value: z.number().optional(),
  threshold: z.number().optional(),
  timestamp: z.date(),
  resolved: z.boolean().default(false),
  resolvedAt: z.date().optional(),
  resolvedBy: z.string().optional(),
  acknowledged: z.boolean().default(false),
  acknowledgedAt: z.date().optional(),
  acknowledgedBy: z.string().optional(),
  suppressUntil: z.date().optional(),
  metadata: z.record(z.any()).default({})
});

export type Alert = z.infer<typeof AlertSchema>;

export interface MonitoringConfiguration {
  pluginId: string;
  tenantId: string;
  deploymentId: string;
  enabled: boolean;
  healthCheck: {
    enabled: boolean;
    endpoint: string;
    interval: number;
    timeout: number;
    successThreshold: number;
    failureThreshold: number;
    expectedStatus: number[];
    expectedBody?: string;
  };
  metrics: {
    enabled: boolean;
    endpoint?: string;
    interval: number;
    customMetrics: Array<{
      name: string;
      query: string;
      unit: string;
      description: string;
    }>;
  };
  alerts: Array<{
    name: string;
    condition: string;
    threshold: number;
    severity: 'info' | 'warning' | 'critical' | 'emergency';
    duration: number;
    enabled: boolean;
    actions: Array<{
      type: 'email' | 'slack' | 'webhook' | 'auto-recovery';
      config: Record<string, any>;
    }>;
  }>;
  autoRecovery: {
    enabled: boolean;
    maxAttempts: number;
    strategies: Array<{
      name: string;
      conditions: string[];
      actions: Array<{
        type: 'restart' | 'scale' | 'rollback' | 'notify';
        config: Record<string, any>;
      }>;
    }>;
  };
}

export interface PluginHealth {
  pluginId: string;
  tenantId: string;
  deploymentId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastCheck: Date;
  uptime: number;
  responseTime: {
    current: number;
    average: number;
    p95: number;
    p99: number;
  };
  errorRate: number;
  throughput: number;
  availability: number;
  trends: {
    responseTime: number[];
    errorRate: number[];
    throughput: number[];
  };
  incidents: Array<{
    id: string;
    timestamp: Date;
    severity: string;
    description: string;
    resolved: boolean;
    duration?: number;
  }>;
}

export interface MonitoringDashboard {
  overview: {
    totalPlugins: number;
    healthyPlugins: number;
    degradedPlugins: number;
    unhealthyPlugins: number;
    activeAlerts: number;
    autoRecoveryAttempts: number;
  };
  plugins: PluginHealth[];
  alerts: Alert[];
  metrics: {
    systemMetrics: Metric[];
    customMetrics: Metric[];
  };
  events: Array<{
    timestamp: Date;
    type: string;
    pluginId: string;
    tenantId: string;
    message: string;
    severity: string;
  }>;
}

class RealTimePluginMonitor extends EventEmitter {
  private monitoringConfigs: Map<string, MonitoringConfiguration> = new Map();
  private healthChecks: Map<string, HealthCheck[]> = new Map();
  private metrics: Map<string, Metric[]> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private pluginHealth: Map<string, PluginHealth> = new Map();
  private wsClients: Set<WebSocket> = new Set();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private autoRecoveryAttempts: Map<string, number> = new Map();

  constructor() {
    super();
    this.startWebSocketServer();
    this.startBackgroundTasks();
  }

  /**
   * Register a plugin for monitoring
   */
  async registerPlugin(config: MonitoringConfiguration): Promise<void> {
    const key = this.getPluginKey(config.pluginId, config.tenantId, config.deploymentId);
    
    console.log(`Registering plugin for monitoring: ${key}`);
    
    this.monitoringConfigs.set(key, config);
    
    // Initialize health tracking
    this.pluginHealth.set(key, {
      pluginId: config.pluginId,
      tenantId: config.tenantId,
      deploymentId: config.deploymentId,
      status: 'unknown',
      lastCheck: new Date(),
      uptime: 0,
      responseTime: { current: 0, average: 0, p95: 0, p99: 0 },
      errorRate: 0,
      throughput: 0,
      availability: 100,
      trends: { responseTime: [], errorRate: [], throughput: [] },
      incidents: []
    });

    // Start monitoring if enabled
    if (config.enabled) {
      await this.startMonitoring(key);
    }

    this.emit('plugin-registered', config);
  }

  /**
   * Unregister a plugin from monitoring
   */
  async unregisterPlugin(pluginId: string, tenantId: string, deploymentId: string): Promise<void> {
    const key = this.getPluginKey(pluginId, tenantId, deploymentId);
    
    console.log(`Unregistering plugin from monitoring: ${key}`);
    
    // Stop monitoring
    await this.stopMonitoring(key);
    
    // Clean up data
    this.monitoringConfigs.delete(key);
    this.healthChecks.delete(key);
    this.metrics.delete(key);
    this.pluginHealth.delete(key);
    this.autoRecoveryAttempts.delete(key);
    
    // Clean up alerts
    for (const [alertId, alert] of this.alerts) {
      if (alert.pluginId === pluginId && alert.tenantId === tenantId && alert.deploymentId === deploymentId) {
        this.alerts.delete(alertId);
      }
    }

    this.emit('plugin-unregistered', { pluginId, tenantId, deploymentId });
  }

  /**
   * Get real-time health status for a plugin
   */
  getPluginHealth(pluginId: string, tenantId: string, deploymentId: string): PluginHealth | null {
    const key = this.getPluginKey(pluginId, tenantId, deploymentId);
    return this.pluginHealth.get(key) || null;
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get monitoring dashboard data
   */
  getDashboard(): MonitoringDashboard {
    const plugins = Array.from(this.pluginHealth.values());
    const alerts = Array.from(this.alerts.values());
    
    return {
      overview: {
        totalPlugins: plugins.length,
        healthyPlugins: plugins.filter(p => p.status === 'healthy').length,
        degradedPlugins: plugins.filter(p => p.status === 'degraded').length,
        unhealthyPlugins: plugins.filter(p => p.status === 'unhealthy').length,
        activeAlerts: alerts.filter(a => !a.resolved).length,
        autoRecoveryAttempts: Array.from(this.autoRecoveryAttempts.values()).reduce((sum, attempts) => sum + attempts, 0)
      },
      plugins,
      alerts: alerts.slice(-100), // Last 100 alerts
      metrics: {
        systemMetrics: this.getSystemMetrics(),
        customMetrics: this.getCustomMetrics()
      },
      events: this.getRecentEvents()
    };
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    this.alerts.set(alertId, alert);
    this.emit('alert-acknowledged', alert);
    this.broadcastUpdate('alert-acknowledged', alert);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    this.alerts.set(alertId, alert);
    this.emit('alert-resolved', alert);
    this.broadcastUpdate('alert-resolved', alert);
  }

  /**
   * Suppress an alert for a specific duration
   */
  async suppressAlert(alertId: string, duration: number): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.suppressUntil = new Date(Date.now() + duration);
    this.alerts.set(alertId, alert);
    
    this.emit('alert-suppressed', alert);
  }

  /**
   * Trigger manual recovery for a plugin
   */
  async triggerRecovery(
    pluginId: string, 
    tenantId: string, 
    deploymentId: string, 
    strategy?: string
  ): Promise<void> {
    const key = this.getPluginKey(pluginId, tenantId, deploymentId);
    const config = this.monitoringConfigs.get(key);
    
    if (!config) {
      throw new Error(`Plugin ${key} not found in monitoring`);
    }

    console.log(`Triggering manual recovery for ${key} with strategy: ${strategy || 'default'}`);
    
    await this.executeRecovery(config, strategy);
  }

  /**
   * Private methods
   */
  private async startMonitoring(key: string): Promise<void> {
    const config = this.monitoringConfigs.get(key);
    if (!config || !config.enabled) return;

    // Start health check monitoring
    if (config.healthCheck.enabled) {
      const healthInterval = setInterval(async () => {
        await this.performHealthCheck(config);
      }, config.healthCheck.interval);

      this.monitoringIntervals.set(`${key}-health`, healthInterval);
    }

    // Start metrics collection
    if (config.metrics.enabled) {
      const metricsInterval = setInterval(async () => {
        await this.collectMetrics(config);
      }, config.metrics.interval);

      this.monitoringIntervals.set(`${key}-metrics`, metricsInterval);
    }

    console.log(`Started monitoring for ${key}`);
  }

  private async stopMonitoring(key: string): Promise<void> {
    // Clear health check interval
    const healthInterval = this.monitoringIntervals.get(`${key}-health`);
    if (healthInterval) {
      clearInterval(healthInterval);
      this.monitoringIntervals.delete(`${key}-health`);
    }

    // Clear metrics interval
    const metricsInterval = this.monitoringIntervals.get(`${key}-metrics`);
    if (metricsInterval) {
      clearInterval(metricsInterval);
      this.monitoringIntervals.delete(`${key}-metrics`);
    }

    console.log(`Stopped monitoring for ${key}`);
  }

  private async performHealthCheck(config: MonitoringConfiguration): Promise<void> {
    const key = this.getPluginKey(config.pluginId, config.tenantId, config.deploymentId);
    const startTime = Date.now();

    try {
      const response = await axios.get(config.healthCheck.endpoint, {
        timeout: config.healthCheck.timeout,
        validateStatus: (status) => config.healthCheck.expectedStatus.includes(status)
      });

      const responseTime = Date.now() - startTime;
      const isHealthy = config.healthCheck.expectedStatus.includes(response.status);
      
      // Check response body if specified
      if (config.healthCheck.expectedBody && isHealthy) {
        const bodyMatches = response.data.includes(config.healthCheck.expectedBody);
        if (!bodyMatches) {
          throw new Error('Response body does not match expected content');
        }
      }

      const healthCheck: HealthCheck = {
        pluginId: config.pluginId,
        tenantId: config.tenantId,
        deploymentId: config.deploymentId,
        timestamp: new Date(),
        status: 'healthy',
        responseTime,
        metadata: {
          statusCode: response.status,
          responseSize: JSON.stringify(response.data).length
        }
      };

      await this.processHealthCheck(healthCheck);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const healthCheck: HealthCheck = {
        pluginId: config.pluginId,
        tenantId: config.tenantId,
        deploymentId: config.deploymentId,
        timestamp: new Date(),
        status: 'unhealthy',
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {}
      };

      await this.processHealthCheck(healthCheck);
    }
  }

  private async processHealthCheck(healthCheck: HealthCheck): Promise<void> {
    const key = this.getPluginKey(healthCheck.pluginId, healthCheck.tenantId, healthCheck.deploymentId);
    
    // Store health check
    const checks = this.healthChecks.get(key) || [];
    checks.push(healthCheck);
    
    // Keep only last 1000 checks
    if (checks.length > 1000) {
      checks.splice(0, checks.length - 1000);
    }
    
    this.healthChecks.set(key, checks);

    // Update plugin health
    await this.updatePluginHealth(key, healthCheck);

    // Check for alerts
    await this.evaluateAlerts(key, healthCheck);

    // Broadcast update
    this.broadcastUpdate('health-check', healthCheck);

    this.emit('health-check', healthCheck);
  }

  private async updatePluginHealth(key: string, healthCheck: HealthCheck): Promise<void> {
    const health = this.pluginHealth.get(key);
    if (!health) return;

    const checks = this.healthChecks.get(key) || [];
    const recentChecks = checks.slice(-100); // Last 100 checks

    // Update status
    health.status = healthCheck.status;
    health.lastCheck = healthCheck.timestamp;

    // Calculate response time metrics
    const responseTimes = recentChecks.map(c => c.responseTime);
    health.responseTime.current = healthCheck.responseTime;
    health.responseTime.average = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
    health.responseTime.p95 = this.percentile(responseTimes, 0.95);
    health.responseTime.p99 = this.percentile(responseTimes, 0.99);

    // Calculate error rate
    const healthyChecks = recentChecks.filter(c => c.status === 'healthy').length;
    health.errorRate = ((recentChecks.length - healthyChecks) / recentChecks.length) * 100;

    // Calculate availability (last 24 hours)
    const last24Hours = checks.filter(c => c.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000));
    const healthyLast24h = last24Hours.filter(c => c.status === 'healthy').length;
    health.availability = last24Hours.length > 0 ? (healthyLast24h / last24Hours.length) * 100 : 100;

    // Update trends
    health.trends.responseTime.push(health.responseTime.current);
    health.trends.errorRate.push(health.errorRate);
    
    // Keep only last 100 trend points
    if (health.trends.responseTime.length > 100) {
      health.trends.responseTime.splice(0, 1);
      health.trends.errorRate.splice(0, 1);
    }

    this.pluginHealth.set(key, health);
  }

  private async collectMetrics(config: MonitoringConfiguration): Promise<void> {
    const key = this.getPluginKey(config.pluginId, config.tenantId, config.deploymentId);
    
    try {
      // Collect custom metrics if endpoint is provided
      if (config.metrics.endpoint) {
        const response = await axios.get(config.metrics.endpoint, { timeout: 10000 });
        
        for (const customMetric of config.metrics.customMetrics) {
          const value = this.extractMetricValue(response.data, customMetric.query);
          
          const metric: Metric = {
            pluginId: config.pluginId,
            tenantId: config.tenantId,
            deploymentId: config.deploymentId,
            timestamp: new Date(),
            name: customMetric.name,
            value,
            unit: customMetric.unit,
            tags: { type: 'custom' },
            dimensions: { source: 'plugin-endpoint' }
          };

          await this.storeMetric(key, metric);
        }
      }

      // Collect system metrics
      await this.collectSystemMetrics(config);

    } catch (error) {
      console.error(`Failed to collect metrics for ${key}:`, error);
    }
  }

  private async collectSystemMetrics(config: MonitoringConfiguration): Promise<void> {
    const key = this.getPluginKey(config.pluginId, config.tenantId, config.deploymentId);
    const health = this.pluginHealth.get(key);
    
    if (!health) return;

    const systemMetrics: Metric[] = [
      {
        pluginId: config.pluginId,
        tenantId: config.tenantId,
        deploymentId: config.deploymentId,
        timestamp: new Date(),
        name: 'response_time',
        value: health.responseTime.current,
        unit: 'ms',
        tags: { type: 'system' },
        dimensions: { source: 'health-check' }
      },
      {
        pluginId: config.pluginId,
        tenantId: config.tenantId,
        deploymentId: config.deploymentId,
        timestamp: new Date(),
        name: 'error_rate',
        value: health.errorRate,
        unit: 'percent',
        tags: { type: 'system' },
        dimensions: { source: 'health-check' }
      },
      {
        pluginId: config.pluginId,
        tenantId: config.tenantId,
        deploymentId: config.deploymentId,
        timestamp: new Date(),
        name: 'availability',
        value: health.availability,
        unit: 'percent',
        tags: { type: 'system' },
        dimensions: { source: 'calculated' }
      }
    ];

    for (const metric of systemMetrics) {
      await this.storeMetric(key, metric);
    }
  }

  private async storeMetric(key: string, metric: Metric): Promise<void> {
    const metrics = this.metrics.get(key) || [];
    metrics.push(metric);
    
    // Keep only last 10000 metrics per plugin
    if (metrics.length > 10000) {
      metrics.splice(0, metrics.length - 10000);
    }
    
    this.metrics.set(key, metrics);
    this.emit('metric-collected', metric);
  }

  private async evaluateAlerts(key: string, healthCheck: HealthCheck): Promise<void> {
    const config = this.monitoringConfigs.get(key);
    if (!config) return;

    for (const alertConfig of config.alerts) {
      if (!alertConfig.enabled) continue;

      const shouldAlert = await this.evaluateAlertCondition(alertConfig, healthCheck, key);
      
      if (shouldAlert) {
        await this.createAlert(config, alertConfig, healthCheck);
      }
    }
  }

  private async evaluateAlertCondition(alertConfig: any, healthCheck: HealthCheck, key: string): Promise<boolean> {
    // Simple condition evaluation - in production this would be more sophisticated
    switch (alertConfig.condition) {
      case 'response_time_high':
        return healthCheck.responseTime > alertConfig.threshold;
      
      case 'error_rate_high':
        const health = this.pluginHealth.get(key);
        return health ? health.errorRate > alertConfig.threshold : false;
      
      case 'availability_low':
        const pluginHealth = this.pluginHealth.get(key);
        return pluginHealth ? pluginHealth.availability < alertConfig.threshold : false;
      
      case 'status_unhealthy':
        return healthCheck.status === 'unhealthy';
      
      default:
        return false;
    }
  }

  private async createAlert(
    config: MonitoringConfiguration, 
    alertConfig: any, 
    healthCheck: HealthCheck
  ): Promise<void> {
    const alertId = this.generateAlertId();
    
    const alert: Alert = {
      id: alertId,
      pluginId: config.pluginId,
      tenantId: config.tenantId,
      deploymentId: config.deploymentId,
      severity: alertConfig.severity,
      title: alertConfig.name,
      description: `Alert triggered: ${alertConfig.condition}`,
      condition: alertConfig.condition,
      value: this.getAlertValue(alertConfig, healthCheck),
      threshold: alertConfig.threshold,
      timestamp: new Date(),
      resolved: false,
      acknowledged: false,
      metadata: {
        alertConfig,
        healthCheck
      }
    };

    this.alerts.set(alertId, alert);
    this.emit('alert-created', alert);
    this.broadcastUpdate('alert-created', alert);

    // Execute alert actions
    for (const action of alertConfig.actions) {
      await this.executeAlertAction(action, config, alert);
    }
  }

  private async executeAlertAction(action: any, config: MonitoringConfiguration, alert: Alert): Promise<void> {
    switch (action.type) {
      case 'auto-recovery':
        if (config.autoRecovery.enabled) {
          await this.executeRecovery(config);
        }
        break;
      
      case 'email':
        await this.sendEmailNotification(action.config, alert);
        break;
      
      case 'slack':
        await this.sendSlackNotification(action.config, alert);
        break;
      
      case 'webhook':
        await this.sendWebhookNotification(action.config, alert);
        break;
    }
  }

  private async executeRecovery(config: MonitoringConfiguration, strategyName?: string): Promise<void> {
    const key = this.getPluginKey(config.pluginId, config.tenantId, config.deploymentId);
    const attempts = this.autoRecoveryAttempts.get(key) || 0;

    if (attempts >= config.autoRecovery.maxAttempts) {
      console.log(`Max recovery attempts reached for ${key}`);
      return;
    }

    const strategy = strategyName 
      ? config.autoRecovery.strategies.find(s => s.name === strategyName)
      : config.autoRecovery.strategies[0];

    if (!strategy) {
      console.log(`No recovery strategy found for ${key}`);
      return;
    }

    console.log(`Executing recovery strategy '${strategy.name}' for ${key} (attempt ${attempts + 1})`);

    this.autoRecoveryAttempts.set(key, attempts + 1);

    for (const action of strategy.actions) {
      try {
        await this.executeRecoveryAction(action, config);
      } catch (error) {
        console.error(`Recovery action failed for ${key}:`, error);
      }
    }

    this.emit('auto-recovery-executed', {
      pluginId: config.pluginId,
      tenantId: config.tenantId,
      deploymentId: config.deploymentId,
      strategy: strategy.name,
      attempt: attempts + 1
    });
  }

  private async executeRecoveryAction(action: any, config: MonitoringConfiguration): Promise<void> {
    switch (action.type) {
      case 'restart':
        // Integration with deployment orchestrator to restart plugin
        console.log(`Restarting plugin ${config.pluginId} for tenant ${config.tenantId}`);
        break;
      
      case 'scale':
        // Integration with deployment orchestrator to scale plugin
        console.log(`Scaling plugin ${config.pluginId} for tenant ${config.tenantId}`);
        break;
      
      case 'rollback':
        // Integration with deployment orchestrator to rollback plugin
        console.log(`Rolling back plugin ${config.pluginId} for tenant ${config.tenantId}`);
        break;
      
      case 'notify':
        console.log(`Sending notification for ${config.pluginId}`);
        break;
    }
  }

  private startWebSocketServer(): void {
    const wss = new WebSocket.Server({ port: 8080 });
    
    wss.on('connection', (ws) => {
      console.log('New WebSocket client connected');
      this.wsClients.add(ws);
      
      // Send initial dashboard data
      ws.send(JSON.stringify({
        type: 'dashboard-data',
        data: this.getDashboard()
      }));
      
      ws.on('close', () => {
        this.wsClients.delete(ws);
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.wsClients.delete(ws);
      });
    });
    
    console.log('WebSocket server started on port 8080');
  }

  private broadcastUpdate(type: string, data: any): void {
    const message = JSON.stringify({ type, data, timestamp: new Date() });
    
    for (const client of this.wsClients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('Failed to send WebSocket message:', error);
          this.wsClients.delete(client);
        }
      }
    }
  }

  private startBackgroundTasks(): void {
    // Periodic cleanup
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000); // Every hour

    // Send periodic dashboard updates
    setInterval(() => {
      this.broadcastUpdate('dashboard-update', this.getDashboard());
    }, 30 * 1000); // Every 30 seconds

    // Reset auto-recovery attempts daily
    setInterval(() => {
      this.autoRecoveryAttempts.clear();
    }, 24 * 60 * 60 * 1000); // Every 24 hours
  }

  private cleanupOldData(): void {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    // Clean up old health checks
    for (const [key, checks] of this.healthChecks) {
      const recentChecks = checks.filter(check => check.timestamp > cutoffDate);
      this.healthChecks.set(key, recentChecks);
    }

    // Clean up old metrics
    for (const [key, metrics] of this.metrics) {
      const recentMetrics = metrics.filter(metric => metric.timestamp > cutoffDate);
      this.metrics.set(key, recentMetrics);
    }

    // Clean up resolved alerts older than 30 days
    const alertCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    for (const [alertId, alert] of this.alerts) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt < alertCutoff) {
        this.alerts.delete(alertId);
      }
    }
  }

  private getPluginKey(pluginId: string, tenantId: string, deploymentId: string): string {
    return `${tenantId}:${pluginId}:${deploymentId}`;
  }

  private generateAlertId(): string {
    return createHash('md5').update(`alert-${Date.now()}-${Math.random()}`).digest('hex').substring(0, 12);
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }

  private extractMetricValue(data: any, query: string): number {
    // Simple JSON path extraction - in production use JSONPath library
    try {
      const paths = query.split('.');
      let value = data;
      for (const path of paths) {
        value = value[path];
      }
      return Number(value) || 0;
    } catch {
      return 0;
    }
  }

  private getAlertValue(alertConfig: any, healthCheck: HealthCheck): number {
    switch (alertConfig.condition) {
      case 'response_time_high':
        return healthCheck.responseTime;
      default:
        return 0;
    }
  }

  private getSystemMetrics(): Metric[] {
    const allMetrics: Metric[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics.filter(m => m.tags.type === 'system').slice(-10));
    }
    return allMetrics;
  }

  private getCustomMetrics(): Metric[] {
    const allMetrics: Metric[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics.filter(m => m.tags.type === 'custom').slice(-10));
    }
    return allMetrics;
  }

  private getRecentEvents(): Array<{
    timestamp: Date;
    type: string;
    pluginId: string;
    tenantId: string;
    message: string;
    severity: string;
  }> {
    // This would typically come from an event store
    return [];
  }

  private async sendEmailNotification(config: any, alert: Alert): Promise<void> {
    console.log(`Sending email notification for alert ${alert.id}`);
    // Email implementation would go here
  }

  private async sendSlackNotification(config: any, alert: Alert): Promise<void> {
    console.log(`Sending Slack notification for alert ${alert.id}`);
    // Slack implementation would go here
  }

  private async sendWebhookNotification(config: any, alert: Alert): Promise<void> {
    console.log(`Sending webhook notification for alert ${alert.id}`);
    try {
      await axios.post(config.url, {
        alert,
        timestamp: new Date()
      }, { timeout: 10000 });
    } catch (error) {
      console.error('Webhook notification failed:', error);
    }
  }
}

// Export singleton instance
export const realTimePluginMonitor = new RealTimePluginMonitor();
export default RealTimePluginMonitor;