import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { RealtimeEventService } from '@/lib/events/realtime-event-service';

export interface PerformanceMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heap: {
      used: number;
      total: number;
    };
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connections: number;
  };
  redis: {
    connectedClients: number;
    usedMemory: number;
    keyspaceHits: number;
    keyspaceMisses: number;
    commandsProcessed: number;
  };
  websocket: {
    activeConnections: number;
    messagesPerSecond: number;
    totalMessagesSent: number;
    totalMessagesReceived: number;
  };
  events: {
    eventsPerSecond: number;
    totalEvents: number;
    eventTypes: Record<string, number>;
    averageProcessingTime: number;
  };
  webhooks: {
    requestsPerSecond: number;
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'ne';
  threshold: number;
  duration: number; // seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  actions: AlertAction[];
}

export interface AlertAction {
  type: 'notification' | 'webhook' | 'email' | 'scaling';
  config: Record<string, any>;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  status: 'active' | 'acknowledged' | 'resolved';
}

export interface ScalingConfig {
  enabled: boolean;
  minInstances: number;
  maxInstances: number;
  targetCpuUtilization: number;
  targetMemoryUtilization: number;
  scaleUpCooldown: number; // seconds
  scaleDownCooldown: number; // seconds
  webhookUrl?: string;
}

export class RealTimeMonitoringService extends EventEmitter {
  private static instance: RealTimeMonitoringService;
  private redis: Redis;
  private realtimeEvents: RealtimeEventService;
  private metricsInterval: NodeJS.Timeout | null = null;
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private scalingConfig: ScalingConfig;
  private lastScaleAction: number = 0;

  private constructor() {
    super();
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableAutoPipelining: true,
      db: 4 // Use different DB for monitoring
    });

    this.realtimeEvents = RealtimeEventService.getInstance();
    this.scalingConfig = {
      enabled: process.env.AUTO_SCALING_ENABLED === 'true',
      minInstances: parseInt(process.env.MIN_INSTANCES || '1'),
      maxInstances: parseInt(process.env.MAX_INSTANCES || '10'),
      targetCpuUtilization: parseInt(process.env.TARGET_CPU_UTILIZATION || '70'),
      targetMemoryUtilization: parseInt(process.env.TARGET_MEMORY_UTILIZATION || '80'),
      scaleUpCooldown: parseInt(process.env.SCALE_UP_COOLDOWN || '300'),
      scaleDownCooldown: parseInt(process.env.SCALE_DOWN_COOLDOWN || '600'),
      webhookUrl: process.env.SCALING_WEBHOOK_URL
    };

    this.initializeDefaultAlertRules();
    this.startMonitoring();
  }

  public static getInstance(): RealTimeMonitoringService {
    if (!RealTimeMonitoringService.instance) {
      RealTimeMonitoringService.instance = new RealTimeMonitoringService();
    }
    return RealTimeMonitoringService.instance;
  }

  private initializeDefaultAlertRules() {
    const defaultRules: AlertRule[] = [
      {
        id: 'high_cpu',
        name: 'High CPU Usage',
        metric: 'cpu.usage',
        condition: 'gt',
        threshold: 80,
        duration: 300, // 5 minutes
        severity: 'high',
        enabled: true,
        actions: [
          { type: 'notification', config: { channels: ['websocket', 'email'] } },
          { type: 'scaling', config: { action: 'scale_up' } }
        ]
      },
      {
        id: 'high_memory',
        name: 'High Memory Usage',
        metric: 'memory.percentage',
        condition: 'gt',
        threshold: 85,
        duration: 300,
        severity: 'high',
        enabled: true,
        actions: [
          { type: 'notification', config: { channels: ['websocket', 'email'] } },
          { type: 'scaling', config: { action: 'scale_up' } }
        ]
      },
      {
        id: 'low_websocket_connections',
        name: 'WebSocket Connection Drop',
        metric: 'websocket.activeConnections',
        condition: 'lt',
        threshold: 1,
        duration: 60,
        severity: 'medium',
        enabled: true,
        actions: [
          { type: 'notification', config: { channels: ['websocket'] } }
        ]
      },
      {
        id: 'high_webhook_error_rate',
        name: 'High Webhook Error Rate',
        metric: 'webhooks.errorRate',
        condition: 'gt',
        threshold: 5, // 5%
        duration: 120,
        severity: 'high',
        enabled: true,
        actions: [
          { type: 'notification', config: { channels: ['websocket', 'email', 'alert'] } }
        ]
      },
      {
        id: 'redis_high_memory',
        name: 'Redis High Memory Usage',
        metric: 'redis.usedMemory',
        condition: 'gt',
        threshold: 1024 * 1024 * 1024, // 1GB
        duration: 300,
        severity: 'medium',
        enabled: true,
        actions: [
          { type: 'notification', config: { channels: ['websocket'] } }
        ]
      }
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  private startMonitoring() {
    // Collect metrics every 30 seconds
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        await this.storeMetrics(metrics);
        await this.checkAlertRules(metrics);
        await this.broadcastMetrics(metrics);
        
        // Check if scaling is needed
        if (this.scalingConfig.enabled) {
          await this.evaluateScaling(metrics);
        }
      } catch (error) {
        console.error('Error in monitoring cycle:', error);
      }
    }, 30000);

    console.log('Real-time monitoring service started');
  }

  private async collectMetrics(): Promise<PerformanceMetrics> {
    const timestamp = new Date().toISOString();

    // Collect system metrics
    const cpuMetrics = await this.getCpuMetrics();
    const memoryMetrics = await this.getMemoryMetrics();
    const networkMetrics = await this.getNetworkMetrics();
    
    // Collect Redis metrics
    const redisMetrics = await this.getRedisMetrics();
    
    // Collect WebSocket metrics
    const websocketMetrics = await this.getWebSocketMetrics();
    
    // Collect event metrics
    const eventMetrics = await this.getEventMetrics();
    
    // Collect webhook metrics
    const webhookMetrics = await this.getWebhookMetrics();

    return {
      timestamp,
      cpu: cpuMetrics,
      memory: memoryMetrics,
      network: networkMetrics,
      redis: redisMetrics,
      websocket: websocketMetrics,
      events: eventMetrics,
      webhooks: webhookMetrics
    };
  }

  private async getCpuMetrics() {
    // In a real implementation, you would use actual system monitoring
    // For now, we'll simulate realistic metrics
    return {
      usage: Math.random() * 60 + 20, // 20-80%
      cores: require('os').cpus().length,
      loadAverage: require('os').loadavg()
    };
  }

  private async getMemoryMetrics() {
    const process = require('process');
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const freeMem = require('os').freemem();
    const usedMem = totalMem - freeMem;

    return {
      used: usedMem,
      total: totalMem,
      percentage: (usedMem / totalMem) * 100,
      heap: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal
      }
    };
  }

  private async getNetworkMetrics() {
    // Simulate network metrics
    return {
      bytesIn: Math.floor(Math.random() * 1000000),
      bytesOut: Math.floor(Math.random() * 800000),
      connections: Math.floor(Math.random() * 100) + 10
    };
  }

  private async getRedisMetrics() {
    try {
      const info = await this.redis.info();
      const lines = info.split('\r\n');
      const metrics: any = {};

      lines.forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          metrics[key] = isNaN(Number(value)) ? value : Number(value);
        }
      });

      return {
        connectedClients: metrics.connected_clients || 0,
        usedMemory: metrics.used_memory || 0,
        keyspaceHits: metrics.keyspace_hits || 0,
        keyspaceMisses: metrics.keyspace_misses || 0,
        commandsProcessed: metrics.total_commands_processed || 0
      };
    } catch (error) {
      console.error('Error getting Redis metrics:', error);
      return {
        connectedClients: 0,
        usedMemory: 0,
        keyspaceHits: 0,
        keyspaceMisses: 0,
        commandsProcessed: 0
      };
    }
  }

  private async getWebSocketMetrics() {
    try {
      // Get WebSocket metrics from storage
      const activeConnections = await this.redis.get('metrics:websocket:active_connections') || '0';
      const totalMessagesSent = await this.redis.get('metrics:websocket:total_sent') || '0';
      const totalMessagesReceived = await this.redis.get('metrics:websocket:total_received') || '0';
      
      // Calculate messages per second from last minute
      const now = Math.floor(Date.now() / 1000);
      const lastMinute = now - 60;
      const recentMessages = await this.redis.zcount('metrics:websocket:messages', lastMinute, now);

      return {
        activeConnections: parseInt(activeConnections),
        messagesPerSecond: recentMessages / 60,
        totalMessagesSent: parseInt(totalMessagesSent),
        totalMessagesReceived: parseInt(totalMessagesReceived)
      };
    } catch (error) {
      console.error('Error getting WebSocket metrics:', error);
      return {
        activeConnections: 0,
        messagesPerSecond: 0,
        totalMessagesSent: 0,
        totalMessagesReceived: 0
      };
    }
  }

  private async getEventMetrics() {
    try {
      const totalEvents = await this.redis.get('metrics:events:total') || '0';
      
      // Calculate events per second from last minute
      const now = Math.floor(Date.now() / 1000);
      const lastMinute = now - 60;
      const recentEvents = await this.redis.zcount('metrics:events:timeline', lastMinute, now);

      // Get event types distribution
      const typeKeys = await this.redis.keys('metrics:events:type:*');
      const eventTypes: Record<string, number> = {};
      
      for (const key of typeKeys.slice(0, 20)) { // Limit to top 20 types
        const type = key.replace('metrics:events:type:', '');
        const count = await this.redis.get(key);
        eventTypes[type] = parseInt(count || '0');
      }

      return {
        eventsPerSecond: recentEvents / 60,
        totalEvents: parseInt(totalEvents),
        eventTypes,
        averageProcessingTime: Math.random() * 50 + 10 // Simulate 10-60ms
      };
    } catch (error) {
      console.error('Error getting event metrics:', error);
      return {
        eventsPerSecond: 0,
        totalEvents: 0,
        eventTypes: {},
        averageProcessingTime: 0
      };
    }
  }

  private async getWebhookMetrics() {
    try {
      const totalRequests = await this.redis.get('metrics:webhooks:total_requests') || '0';
      const successfulRequests = await this.redis.get('metrics:webhooks:successful_requests') || '0';
      
      // Calculate requests per second from last minute
      const now = Math.floor(Date.now() / 1000);
      const lastMinute = now - 60;
      const recentRequests = await this.redis.zcount('metrics:webhooks:requests', lastMinute, now);

      const total = parseInt(totalRequests);
      const successful = parseInt(successfulRequests);
      const successRate = total > 0 ? (successful / total) * 100 : 100;
      const errorRate = 100 - successRate;

      return {
        requestsPerSecond: recentRequests / 60,
        totalRequests: total,
        successRate,
        averageResponseTime: Math.random() * 200 + 50, // Simulate 50-250ms
        errorRate
      };
    } catch (error) {
      console.error('Error getting webhook metrics:', error);
      return {
        requestsPerSecond: 0,
        totalRequests: 0,
        successRate: 100,
        averageResponseTime: 0,
        errorRate: 0
      };
    }
  }

  private async storeMetrics(metrics: PerformanceMetrics) {
    try {
      const timestamp = Date.now();
      
      // Store metrics in Redis with TTL
      await this.redis.setex(
        `metrics:snapshot:${timestamp}`,
        3600, // 1 hour TTL
        JSON.stringify(metrics)
      );

      // Store in time series for queries
      await this.redis.zadd('metrics:timeline', timestamp, timestamp);
      
      // Clean up old metrics (keep last 24 hours)
      const dayAgo = timestamp - 24 * 60 * 60 * 1000;
      await this.redis.zremrangebyscore('metrics:timeline', 0, dayAgo);

      // Store specific metrics for alerting
      await Promise.all([
        this.redis.setex('metrics:current:cpu_usage', 300, metrics.cpu.usage.toString()),
        this.redis.setex('metrics:current:memory_percentage', 300, metrics.memory.percentage.toString()),
        this.redis.setex('metrics:current:websocket_connections', 300, metrics.websocket.activeConnections.toString()),
        this.redis.setex('metrics:current:webhook_error_rate', 300, metrics.webhooks.errorRate.toString()),
        this.redis.setex('metrics:current:redis_memory', 300, metrics.redis.usedMemory.toString())
      ]);

    } catch (error) {
      console.error('Error storing metrics:', error);
    }
  }

  private async checkAlertRules(metrics: PerformanceMetrics) {
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        const currentValue = this.getMetricValue(metrics, rule.metric);
        if (currentValue === null) continue;

        const shouldAlert = this.evaluateCondition(currentValue, rule.condition, rule.threshold);
        const existingAlert = this.activeAlerts.get(ruleId);

        if (shouldAlert && !existingAlert) {
          // Check if condition persists for the required duration
          const conditionDuration = await this.checkConditionDuration(rule, currentValue);
          
          if (conditionDuration >= rule.duration) {
            await this.triggerAlert(rule, currentValue);
          }
        } else if (!shouldAlert && existingAlert && existingAlert.status === 'active') {
          // Condition resolved
          await this.resolveAlert(ruleId);
        }
      } catch (error) {
        console.error(`Error checking alert rule ${ruleId}:`, error);
      }
    }
  }

  private getMetricValue(metrics: PerformanceMetrics, metricPath: string): number | null {
    const parts = metricPath.split('.');
    let value: any = metrics;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }
    
    return typeof value === 'number' ? value : null;
  }

  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'ne': return value !== threshold;
      default: return false;
    }
  }

  private async checkConditionDuration(rule: AlertRule, currentValue: number): Promise<number> {
    try {
      // Store current condition state
      const key = `alert_condition:${rule.id}`;
      const now = Date.now();
      
      await this.redis.zadd(key, now, now);
      await this.redis.expire(key, rule.duration + 60); // Cleanup after duration + buffer
      
      // Check how long condition has been true
      const since = now - rule.duration * 1000;
      const count = await this.redis.zcount(key, since, now);
      
      // Estimate duration (simplified)
      return count * 30; // Assuming 30-second intervals
    } catch (error) {
      console.error('Error checking condition duration:', error);
      return 0;
    }
  }

  private async triggerAlert(rule: AlertRule, value: number) {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      severity: rule.severity,
      message: `${rule.name}: ${rule.metric} is ${value} (threshold: ${rule.threshold})`,
      triggeredAt: new Date().toISOString(),
      status: 'active'
    };

    this.activeAlerts.set(rule.id, alert);

    // Store alert
    await this.redis.setex(
      `alert:${alert.id}`,
      86400 * 7, // 7 days
      JSON.stringify(alert)
    );

    await this.redis.zadd('alerts:active', Date.now(), alert.id);

    // Execute alert actions
    for (const action of rule.actions) {
      await this.executeAlertAction(action, alert);
    }

    // Broadcast alert
    await this.realtimeEvents.broadcast('system.alert.triggered', {
      alert,
      timestamp: new Date().toISOString()
    });

    console.log(`Alert triggered: ${alert.message}`);
  }

  private async resolveAlert(ruleId: string) {
    const alert = this.activeAlerts.get(ruleId);
    if (!alert) return;

    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();

    this.activeAlerts.delete(ruleId);

    // Update stored alert
    await this.redis.setex(
      `alert:${alert.id}`,
      86400 * 7,
      JSON.stringify(alert)
    );

    await this.redis.zrem('alerts:active', alert.id);
    await this.redis.zadd('alerts:resolved', Date.now(), alert.id);

    // Broadcast resolution
    await this.realtimeEvents.broadcast('system.alert.resolved', {
      alert,
      timestamp: new Date().toISOString()
    });

    console.log(`Alert resolved: ${alert.message}`);
  }

  private async executeAlertAction(action: AlertAction, alert: Alert) {
    try {
      switch (action.type) {
        case 'notification':
          await this.realtimeEvents.broadcast('notification', {
            type: 'system_alert',
            title: `System Alert: ${alert.ruleName}`,
            message: alert.message,
            severity: alert.severity,
            data: { alert },
            channels: action.config.channels || ['websocket']
          });
          break;

        case 'scaling':
          if (this.scalingConfig.enabled) {
            await this.triggerScaling(action.config.action, alert);
          }
          break;

        case 'webhook':
          if (action.config.url) {
            await this.sendWebhookAlert(action.config.url, alert);
          }
          break;

        case 'email':
          // Email integration would go here
          console.log(`Email alert would be sent: ${alert.message}`);
          break;
      }
    } catch (error) {
      console.error(`Error executing alert action ${action.type}:`, error);
    }
  }

  private async evaluateScaling(metrics: PerformanceMetrics) {
    const now = Date.now();
    const timeSinceLastScale = now - this.lastScaleAction;

    // Check if we're in cooldown period
    if (timeSinceLastScale < this.scalingConfig.scaleUpCooldown * 1000) {
      return;
    }

    const cpuUsage = metrics.cpu.usage;
    const memoryUsage = metrics.memory.percentage;

    // Scale up conditions
    if (cpuUsage > this.scalingConfig.targetCpuUtilization ||
        memoryUsage > this.scalingConfig.targetMemoryUtilization) {
      
      await this.triggerScaling('scale_up', {
        reason: 'High resource usage',
        cpuUsage,
        memoryUsage,
        targetCpu: this.scalingConfig.targetCpuUtilization,
        targetMemory: this.scalingConfig.targetMemoryUtilization
      });
    }
    // Scale down conditions (more conservative)
    else if (cpuUsage < this.scalingConfig.targetCpuUtilization * 0.5 &&
             memoryUsage < this.scalingConfig.targetMemoryUtilization * 0.5 &&
             timeSinceLastScale > this.scalingConfig.scaleDownCooldown * 1000) {
      
      await this.triggerScaling('scale_down', {
        reason: 'Low resource usage',
        cpuUsage,
        memoryUsage,
        targetCpu: this.scalingConfig.targetCpuUtilization,
        targetMemory: this.scalingConfig.targetMemoryUtilization
      });
    }
  }

  private async triggerScaling(action: string, context: any) {
    try {
      this.lastScaleAction = Date.now();

      const scalingEvent = {
        action,
        context,
        timestamp: new Date().toISOString(),
        config: this.scalingConfig
      };

      // Send scaling webhook if configured
      if (this.scalingConfig.webhookUrl) {
        await this.sendWebhookAlert(this.scalingConfig.webhookUrl, scalingEvent);
      }

      // Broadcast scaling event
      await this.realtimeEvents.broadcast('system.scaling.triggered', scalingEvent);

      console.log(`Scaling triggered: ${action}`, context);
    } catch (error) {
      console.error('Error triggering scaling:', error);
    }
  }

  private async sendWebhookAlert(url: string, data: any) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'backstage-portal-monitoring'
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        console.error(`Webhook alert failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Error sending webhook alert:', error);
    }
  }

  private async broadcastMetrics(metrics: PerformanceMetrics) {
    // Broadcast metrics to connected clients
    await this.realtimeEvents.broadcast('system.metrics', {
      timestamp: metrics.timestamp,
      summary: {
        cpu: metrics.cpu.usage,
        memory: metrics.memory.percentage,
        websocketConnections: metrics.websocket.activeConnections,
        eventsPerSecond: metrics.events.eventsPerSecond,
        webhookErrorRate: metrics.webhooks.errorRate
      },
      detailed: metrics
    });
  }

  // Public API methods
  public async getMetrics(timeRange: 'hour' | 'day' | 'week' = 'hour'): Promise<PerformanceMetrics[]> {
    try {
      const now = Date.now();
      let since: number;

      switch (timeRange) {
        case 'hour':
          since = now - 60 * 60 * 1000;
          break;
        case 'day':
          since = now - 24 * 60 * 60 * 1000;
          break;
        case 'week':
          since = now - 7 * 24 * 60 * 60 * 1000;
          break;
      }

      const timestamps = await this.redis.zrangebyscore('metrics:timeline', since, now);
      const metrics = await Promise.all(
        timestamps.map(async (timestamp) => {
          const data = await this.redis.get(`metrics:snapshot:${timestamp}`);
          return data ? JSON.parse(data) : null;
        })
      );

      return metrics.filter(m => m !== null);
    } catch (error) {
      console.error('Error getting metrics:', error);
      return [];
    }
  }

  public async getActiveAlerts(): Promise<Alert[]> {
    try {
      const alertIds = await this.redis.zrange('alerts:active', 0, -1);
      const alerts = await Promise.all(
        alertIds.map(async (id) => {
          const data = await this.redis.get(`alert:${id}`);
          return data ? JSON.parse(data) : null;
        })
      );

      return alerts.filter(a => a !== null);
    } catch (error) {
      console.error('Error getting active alerts:', error);
      return [];
    }
  }

  public async acknowledgeAlert(alertId: string, userId?: string): Promise<boolean> {
    try {
      const alertData = await this.redis.get(`alert:${alertId}`);
      if (!alertData) return false;

      const alert: Alert = JSON.parse(alertData);
      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date().toISOString();

      await this.redis.setex(`alert:${alertId}`, 86400 * 7, JSON.stringify(alert));

      // Broadcast acknowledgment
      await this.realtimeEvents.broadcast('system.alert.acknowledged', {
        alert,
        userId,
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      return false;
    }
  }

  public getScalingConfig(): ScalingConfig {
    return { ...this.scalingConfig };
  }

  public updateScalingConfig(config: Partial<ScalingConfig>): void {
    this.scalingConfig = { ...this.scalingConfig, ...config };
    console.log('Scaling configuration updated:', this.scalingConfig);
  }

  public addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullRule: AlertRule = { id: ruleId, ...rule };
    
    this.alertRules.set(ruleId, fullRule);
    console.log(`Alert rule added: ${fullRule.name}`);
    
    return ruleId;
  }

  public removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      console.log(`Alert rule removed: ${ruleId}`);
    }
    return removed;
  }

  public getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  public async getSystemHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
    metrics: any;
    alerts: number;
  }> {
    try {
      const activeAlerts = await this.getActiveAlerts();
      const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;
      const highAlerts = activeAlerts.filter(a => a.severity === 'high').length;

      // Check service health
      const services = {
        redis: false,
        websocket: false,
        events: false
      };

      try {
        await this.redis.ping();
        services.redis = true;
      } catch (error) {
        console.error('Redis health check failed:', error);
      }

      // Get latest metrics
      const currentMetrics = await this.redis.mget([
        'metrics:current:cpu_usage',
        'metrics:current:memory_percentage',
        'metrics:current:websocket_connections'
      ]);

      const cpuUsage = parseFloat(currentMetrics[0] || '0');
      const memoryUsage = parseFloat(currentMetrics[1] || '0');
      const wsConnections = parseInt(currentMetrics[2] || '0');

      services.websocket = wsConnections >= 0;
      services.events = true; // Assume healthy if we're running

      // Determine overall status
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (criticalAlerts > 0 || !services.redis) {
        status = 'unhealthy';
      } else if (highAlerts > 0 || cpuUsage > 90 || memoryUsage > 95) {
        status = 'degraded';
      }

      return {
        status,
        services,
        metrics: {
          cpu: cpuUsage,
          memory: memoryUsage,
          websocketConnections: wsConnections
        },
        alerts: activeAlerts.length
      };
    } catch (error) {
      console.error('Error getting system health:', error);
      return {
        status: 'unhealthy',
        services: { redis: false, websocket: false, events: false },
        metrics: {},
        alerts: 0
      };
    }
  }

  public async shutdown(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    await this.redis.quit();
    this.removeAllListeners();
    console.log('Real-time monitoring service stopped');
  }
}

// Export singleton
export const realtimeMonitoring = RealTimeMonitoringService.getInstance();