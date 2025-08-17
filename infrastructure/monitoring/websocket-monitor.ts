#!/usr/bin/env tsx
/**
 * WebSocket Monitoring and Health Check Service
 * Provides real-time monitoring, alerting, and performance metrics
 */

import { Redis } from 'ioredis';
import winston from 'winston';
import { EventEmitter } from 'events';

interface WebSocketMetrics {
  timestamp: Date;
  totalConnections: number;
  activeConnections: number;
  messageRate: number;
  errorRate: number;
  responseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  workerStatus: Record<string, WorkerStatus>;
}

interface WorkerStatus {
  id: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  connections: number;
  uptime: number;
  lastSeen: Date;
  memoryUsage: number;
  cpuUsage: number;
}

interface Alert {
  id: string;
  type: 'connection_spike' | 'high_error_rate' | 'worker_failure' | 'memory_leak' | 'response_time';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data: any;
  timestamp: Date;
  resolved: boolean;
}

export class WebSocketMonitor extends EventEmitter {
  private redis: Redis;
  private logger: winston.Logger;
  private metrics: WebSocketMetrics[] = [];
  private alerts: Alert[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private alertingInterval?: NodeJS.Timeout;
  
  // Thresholds
  private readonly THRESHOLDS = {
    MAX_CONNECTIONS: 10000,
    MAX_ERROR_RATE: 0.05, // 5%
    MAX_RESPONSE_TIME: 1000, // 1 second
    MAX_MEMORY_USAGE: 0.8, // 80%
    MAX_CPU_USAGE: 0.9, // 90%
    WORKER_TIMEOUT: 60000, // 1 minute
  };

  constructor(redisUrl: string) {
    super();
    
    this.redis = new Redis(redisUrl);
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/websocket-monitor.log' }),
        new winston.transports.Console()
      ],
    });

    this.setupRedisListeners();
  }

  start() {
    this.logger.info('Starting WebSocket monitoring service');
    
    // Start monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, 10000); // Every 10 seconds

    // Start alerting
    this.alertingInterval = setInterval(() => {
      this.checkAlerts();
    }, 30000); // Every 30 seconds

    // Start periodic cleanup
    setInterval(() => {
      this.cleanupOldData();
    }, 300000); // Every 5 minutes
  }

  stop() {
    this.logger.info('Stopping WebSocket monitoring service');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.alertingInterval) {
      clearInterval(this.alertingInterval);
    }

    this.redis.disconnect();
  }

  private setupRedisListeners() {
    this.redis.subscribe('websocket:metrics', 'websocket:workers', 'websocket:alerts');
    
    this.redis.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        
        switch (channel) {
          case 'websocket:metrics':
            this.handleMetricsUpdate(data);
            break;
          case 'websocket:workers':
            this.handleWorkerUpdate(data);
            break;
          case 'websocket:alerts':
            this.handleAlertUpdate(data);
            break;
        }
      } catch (error) {
        this.logger.error('Error parsing Redis message', { channel, error: error.message });
      }
    });
  }

  private async collectMetrics() {
    try {
      // Get connection statistics
      const connectionStats = await this.getConnectionStats();
      
      // Get worker status
      const workerStatus = await this.getWorkerStatus();
      
      // Get system metrics
      const systemMetrics = await this.getSystemMetrics();
      
      const metrics: WebSocketMetrics = {
        timestamp: new Date(),
        totalConnections: connectionStats.total,
        activeConnections: connectionStats.active,
        messageRate: connectionStats.messageRate,
        errorRate: connectionStats.errorRate,
        responseTime: connectionStats.avgResponseTime,
        memoryUsage: systemMetrics.memoryUsage,
        cpuUsage: systemMetrics.cpuUsage,
        workerStatus: workerStatus,
      };

      this.metrics.push(metrics);
      
      // Store in Redis for persistence
      await this.redis.zadd(
        'websocket:metrics:timeseries',
        Date.now(),
        JSON.stringify(metrics)
      );

      // Emit metrics event
      this.emit('metrics', metrics);
      
      this.logger.debug('Metrics collected', {
        connections: metrics.activeConnections,
        messageRate: metrics.messageRate,
        errorRate: metrics.errorRate
      });

    } catch (error) {
      this.logger.error('Error collecting metrics', { error: error.message });
    }
  }

  private async getConnectionStats() {
    const stats = await this.redis.hgetall('websocket:stats');
    
    return {
      total: parseInt(stats.total_connections || '0'),
      active: parseInt(stats.active_connections || '0'),
      messageRate: parseFloat(stats.message_rate || '0'),
      errorRate: parseFloat(stats.error_rate || '0'),
      avgResponseTime: parseFloat(stats.avg_response_time || '0'),
    };
  }

  private async getWorkerStatus(): Promise<Record<string, WorkerStatus>> {
    const workers = await this.redis.hgetall('websocket:workers');
    const status: Record<string, WorkerStatus> = {};
    
    for (const [workerId, workerData] of Object.entries(workers)) {
      try {
        const data = JSON.parse(workerData);
        status[workerId] = {
          id: workerId,
          status: this.determineWorkerHealth(data),
          connections: data.connections || 0,
          uptime: data.uptime || 0,
          lastSeen: new Date(data.lastSeen),
          memoryUsage: data.memoryUsage || 0,
          cpuUsage: data.cpuUsage || 0,
        };
      } catch (error) {
        this.logger.error('Error parsing worker data', { workerId, error: error.message });
      }
    }
    
    return status;
  }

  private async getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memoryUsage: (memUsage.heapUsed / memUsage.heapTotal),
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
    };
  }

  private determineWorkerHealth(data: any): 'healthy' | 'degraded' | 'unhealthy' {
    const now = Date.now();
    const lastSeen = new Date(data.lastSeen).getTime();
    const timeSinceLastSeen = now - lastSeen;
    
    if (timeSinceLastSeen > this.THRESHOLDS.WORKER_TIMEOUT) {
      return 'unhealthy';
    }
    
    if (data.errorRate > this.THRESHOLDS.MAX_ERROR_RATE ||
        data.memoryUsage > this.THRESHOLDS.MAX_MEMORY_USAGE) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  private async checkAlerts() {
    const latestMetrics = this.metrics[this.metrics.length - 1];
    if (!latestMetrics) return;

    // Check connection spike
    if (latestMetrics.activeConnections > this.THRESHOLDS.MAX_CONNECTIONS) {
      this.createAlert('connection_spike', 'high', 
        `Active connections (${latestMetrics.activeConnections}) exceeded threshold (${this.THRESHOLDS.MAX_CONNECTIONS})`,
        { connections: latestMetrics.activeConnections }
      );
    }

    // Check error rate
    if (latestMetrics.errorRate > this.THRESHOLDS.MAX_ERROR_RATE) {
      this.createAlert('high_error_rate', 'critical',
        `Error rate (${(latestMetrics.errorRate * 100).toFixed(2)}%) exceeded threshold (${(this.THRESHOLDS.MAX_ERROR_RATE * 100).toFixed(2)}%)`,
        { errorRate: latestMetrics.errorRate }
      );
    }

    // Check response time
    if (latestMetrics.responseTime > this.THRESHOLDS.MAX_RESPONSE_TIME) {
      this.createAlert('response_time', 'medium',
        `Response time (${latestMetrics.responseTime}ms) exceeded threshold (${this.THRESHOLDS.MAX_RESPONSE_TIME}ms)`,
        { responseTime: latestMetrics.responseTime }
      );
    }

    // Check memory usage
    if (latestMetrics.memoryUsage > this.THRESHOLDS.MAX_MEMORY_USAGE) {
      this.createAlert('memory_leak', 'high',
        `Memory usage (${(latestMetrics.memoryUsage * 100).toFixed(2)}%) exceeded threshold (${(this.THRESHOLDS.MAX_MEMORY_USAGE * 100).toFixed(2)}%)`,
        { memoryUsage: latestMetrics.memoryUsage }
      );
    }

    // Check worker health
    for (const [workerId, worker] of Object.entries(latestMetrics.workerStatus)) {
      if (worker.status === 'unhealthy') {
        this.createAlert('worker_failure', 'critical',
          `Worker ${workerId} is unhealthy`,
          { workerId, workerStatus: worker }
        );
      }
    }
  }

  private createAlert(type: Alert['type'], severity: Alert['severity'], message: string, data: any) {
    const alert: Alert = {
      id: `${type}_${Date.now()}`,
      type,
      severity,
      message,
      data,
      timestamp: new Date(),
      resolved: false,
    };

    // Check if similar alert already exists
    const existingAlert = this.alerts.find(a => 
      a.type === type && !a.resolved && 
      Date.now() - a.timestamp.getTime() < 300000 // 5 minutes
    );

    if (!existingAlert) {
      this.alerts.push(alert);
      
      // Store in Redis
      this.redis.zadd('websocket:alerts', Date.now(), JSON.stringify(alert));
      
      // Emit alert event
      this.emit('alert', alert);
      
      this.logger.warn('Alert created', {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message
      });
    }
  }

  private cleanupOldData() {
    // Keep only last 24 hours of metrics
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > oneDayAgo);
    
    // Clean up Redis data
    this.redis.zremrangebyscore('websocket:metrics:timeseries', 0, oneDayAgo);
    this.redis.zremrangebyscore('websocket:alerts', 0, oneDayAgo);
    
    // Resolve old alerts
    this.alerts = this.alerts.filter(a => {
      if (Date.now() - a.timestamp.getTime() > 3600000) { // 1 hour
        a.resolved = true;
      }
      return Date.now() - a.timestamp.getTime() < oneDayAgo;
    });
  }

  // Public methods for external access
  public getLatestMetrics(): WebSocketMetrics | null {
    return this.metrics[this.metrics.length - 1] || null;
  }

  public getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  public getMetricsHistory(hours: number = 1): WebSocketMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.metrics.filter(m => m.timestamp.getTime() > cutoff);
  }

  public async getHealthStatus() {
    const latestMetrics = this.getLatestMetrics();
    if (!latestMetrics) {
      return { status: 'unknown', reason: 'No metrics available' };
    }

    const activeAlerts = this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
    
    if (criticalAlerts.length > 0) {
      return {
        status: 'unhealthy',
        reason: 'Critical alerts active',
        alerts: criticalAlerts.length
      };
    }

    const highAlerts = activeAlerts.filter(a => a.severity === 'high');
    if (highAlerts.length > 0) {
      return {
        status: 'degraded',
        reason: 'High severity alerts active',
        alerts: highAlerts.length
      };
    }

    const unhealthyWorkers = Object.values(latestMetrics.workerStatus)
      .filter(w => w.status === 'unhealthy').length;
      
    if (unhealthyWorkers > 0) {
      return {
        status: 'degraded',
        reason: `${unhealthyWorkers} unhealthy workers`,
        unhealthyWorkers
      };
    }

    return {
      status: 'healthy',
      connections: latestMetrics.activeConnections,
      workers: Object.keys(latestMetrics.workerStatus).length
    };
  }
}

// CLI usage
if (require.main === module) {
  const monitor = new WebSocketMonitor(process.env.REDIS_URL || 'redis://localhost:6379');
  
  monitor.on('metrics', (metrics) => {
    console.log('Metrics collected:', {
      connections: metrics.activeConnections,
      messageRate: metrics.messageRate,
      errorRate: metrics.errorRate
    });
  });

  monitor.on('alert', (alert) => {
    console.log('Alert:', alert);
  });

  monitor.start();

  process.on('SIGINT', () => {
    monitor.stop();
    process.exit(0);
  });
}