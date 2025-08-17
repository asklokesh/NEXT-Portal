/**
 * Comprehensive Health Monitoring System
 * 
 * This system provides real-time monitoring, issue detection, and automated resolution
 * for the entire platform infrastructure.
 */

import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import axios from 'axios';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'critical' | 'down';
  message: string;
  timestamp: string;
  metrics?: Record<string, any>;
  responseTime?: number;
}

export interface SystemMetrics {
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  database: {
    connections: number;
    queryTime: number;
    status: string;
  };
  cache: {
    hitRate: number;
    memory: number;
    keys: number;
  };
}

export interface ServiceHealth {
  service: string;
  status: HealthStatus;
  lastCheck: string;
  consecutiveFailures: number;
  alertSent: boolean;
}

export interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  service: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
  actions?: string[];
}

export class ComprehensiveHealthMonitor extends EventEmitter {
  private prisma: PrismaClient | null = null;
  private redis: Redis | null = null;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private services: Map<string, ServiceHealth> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private metrics: SystemMetrics | null = null;
  
  private readonly CHECK_INTERVALS = {
    database: 30 * 1000,    // 30 seconds
    cache: 60 * 1000,       // 1 minute
    backstage: 120 * 1000,  // 2 minutes
    external: 300 * 1000,   // 5 minutes
    system: 15 * 1000,      // 15 seconds
  };

  private readonly ALERT_THRESHOLDS = {
    database: { failureCount: 3, responseTime: 2000 },
    memory: { percentage: 85, critical: 95 },
    cpu: { usage: 80, critical: 95 },
    cache: { hitRate: 0.7 },
    backstage: { responseTime: 5000, failureCount: 5 }
  };

  constructor() {
    super();
    this.initializeConnections();
    this.startMonitoring();
  }

  private async initializeConnections() {
    try {
      // Initialize Prisma
      this.prisma = new PrismaClient();
      
      // Initialize Redis
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      this.redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      console.log('[HealthMonitor] Connections initialized');
    } catch (error) {
      console.error('[HealthMonitor] Failed to initialize connections:', error);
    }
  }

  public startMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.performHealthChecks();
      await this.collectSystemMetrics();
      await this.evaluateAlerts();
    }, this.CHECK_INTERVALS.system);

    console.log('[HealthMonitor] Monitoring started');
  }

  public stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('[HealthMonitor] Monitoring stopped');
  }

  private async performHealthChecks() {
    const checks = [
      this.checkDatabase(),
      this.checkCache(),
      this.checkBackstage(),
      this.checkWebSocket(),
      this.checkNextJS(),
    ];

    await Promise.all(checks);
  }

  private async checkDatabase(): Promise<void> {
    const serviceName = 'database';
    const startTime = Date.now();
    
    try {
      if (!this.prisma) throw new Error('Prisma client not initialized');
      
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;
      
      const status: HealthStatus = {
        status: responseTime > this.ALERT_THRESHOLDS.database.responseTime ? 'degraded' : 'healthy',
        message: `Database responsive in ${responseTime}ms`,
        timestamp: new Date().toISOString(),
        responseTime,
      };

      this.updateServiceHealth(serviceName, status);
      
    } catch (error: any) {
      const status: HealthStatus = {
        status: 'critical',
        message: `Database connection failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };

      this.updateServiceHealth(serviceName, status);
      await this.createAlert({
        severity: 'critical',
        title: 'Database Connection Failed',
        description: `Cannot connect to PostgreSQL database: ${error.message}`,
        service: serviceName,
        actions: [
          'Check if PostgreSQL server is running',
          'Verify DATABASE_URL configuration',
          'Check network connectivity',
          'Review database connection pool settings'
        ]
      });
    }
  }

  private async checkCache(): Promise<void> {
    const serviceName = 'cache';
    const startTime = Date.now();
    
    try {
      if (!this.redis) throw new Error('Redis client not initialized');
      
      await this.redis.ping();
      const responseTime = Date.now() - startTime;
      
      // Get cache statistics
      const info = await this.redis.info('stats');
      const keyspaceInfo = await this.redis.info('keyspace');
      
      const status: HealthStatus = {
        status: 'healthy',
        message: `Cache operational in ${responseTime}ms`,
        timestamp: new Date().toISOString(),
        responseTime,
        metrics: {
          info: info,
          keyspace: keyspaceInfo
        }
      };

      this.updateServiceHealth(serviceName, status);
      
    } catch (error: any) {
      const status: HealthStatus = {
        status: 'degraded',
        message: `Cache connection failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };

      this.updateServiceHealth(serviceName, status);
      await this.createAlert({
        severity: 'medium',
        title: 'Cache Connection Issues',
        description: `Redis cache not responding: ${error.message}`,
        service: serviceName,
        actions: [
          'Check if Redis server is running',
          'Verify REDIS_URL configuration',
          'Review Redis memory usage',
          'Check for Redis configuration issues'
        ]
      });
    }
  }

  private async checkBackstage(): Promise<void> {
    const serviceName = 'backstage';
    const startTime = Date.now();
    
    try {
      const backstageUrl = process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:7007';
      const response = await axios.get(`${backstageUrl}/api/catalog/entities?limit=1`, {
        timeout: 5000,
        headers: {
          'User-Agent': 'HealthMonitor/1.0'
        }
      });
      
      const responseTime = Date.now() - startTime;
      const isHealthy = response.status === 200 && responseTime < this.ALERT_THRESHOLDS.backstage.responseTime;
      
      const status: HealthStatus = {
        status: isHealthy ? 'healthy' : 'degraded',
        message: `Backstage API ${isHealthy ? 'healthy' : 'slow'} (${responseTime}ms)`,
        timestamp: new Date().toISOString(),
        responseTime,
        metrics: {
          statusCode: response.status,
          entities: response.data.length || 0
        }
      };

      this.updateServiceHealth(serviceName, status);
      
    } catch (error: any) {
      const status: HealthStatus = {
        status: error.code === 'ECONNREFUSED' ? 'down' : 'critical',
        message: `Backstage API failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };

      this.updateServiceHealth(serviceName, status);
      await this.createAlert({
        severity: 'high',
        title: 'Backstage API Unavailable',
        description: `Cannot reach Backstage backend: ${error.message}`,
        service: serviceName,
        actions: [
          'Check if Backstage backend is running on port 7007',
          'Verify BACKSTAGE_BACKEND_URL configuration',
          'Check Backstage application logs',
          'Review CommonJS/ESModule compatibility issues'
        ]
      });
    }
  }

  private async checkWebSocket(): Promise<void> {
    const serviceName = 'websocket';
    const startTime = Date.now();
    
    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL?.replace('ws://', 'http://') || 'http://localhost:4403';
      const response = await axios.get(`${wsUrl}/health`, { timeout: 3000 });
      
      const responseTime = Date.now() - startTime;
      
      const status: HealthStatus = {
        status: response.status === 200 ? 'healthy' : 'degraded',
        message: `WebSocket server healthy (${responseTime}ms)`,
        timestamp: new Date().toISOString(),
        responseTime,
      };

      this.updateServiceHealth(serviceName, status);
      
    } catch (error: any) {
      const status: HealthStatus = {
        status: 'degraded',
        message: `WebSocket server check failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };

      this.updateServiceHealth(serviceName, status);
    }
  }

  private async checkNextJS(): Promise<void> {
    const serviceName = 'nextjs';
    const startTime = Date.now();
    
    try {
      const response = await axios.get('http://localhost:4400/api/health', { timeout: 5000 });
      const responseTime = Date.now() - startTime;
      
      const healthData = response.data;
      const overallStatus = healthData.status;
      
      const status: HealthStatus = {
        status: overallStatus === 'healthy' ? 'healthy' : 
                overallStatus === 'degraded' ? 'degraded' : 'critical',
        message: `Next.js app ${overallStatus} (${responseTime}ms)`,
        timestamp: new Date().toISOString(),
        responseTime,
        metrics: healthData.services
      };

      this.updateServiceHealth(serviceName, status);
      
    } catch (error: any) {
      const status: HealthStatus = {
        status: 'critical',
        message: `Next.js app failed: ${error.message}`,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
      };

      this.updateServiceHealth(serviceName, status);
    }
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      const process = await import('process');
      const { performance } = require('perf_hooks');
      
      const memoryUsage = process.memoryUsage();
      const loadAverage = require('os').loadavg();
      
      this.metrics = {
        uptime: Math.floor(process.uptime()),
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)
        },
        cpu: {
          usage: 0, // Would need more complex calculation
          loadAverage: loadAverage
        },
        database: {
          connections: 0, // Would need to query Prisma connection pool
          queryTime: 0,
          status: this.services.get('database')?.status.status || 'unknown'
        },
        cache: {
          hitRate: 0, // Would need Redis stats
          memory: 0,
          keys: 0
        }
      };

      // Check memory alerts
      if (this.metrics.memory.percentage > this.ALERT_THRESHOLDS.memory.critical) {
        await this.createAlert({
          severity: 'critical',
          title: 'Critical Memory Usage',
          description: `Memory usage at ${this.metrics.memory.percentage}%`,
          service: 'system',
          actions: [
            'Restart application to free memory',
            'Check for memory leaks',
            'Scale up server resources',
            'Review memory optimization opportunities'
          ]
        });
      } else if (this.metrics.memory.percentage > this.ALERT_THRESHOLDS.memory.percentage) {
        await this.createAlert({
          severity: 'medium',
          title: 'High Memory Usage',
          description: `Memory usage at ${this.metrics.memory.percentage}%`,
          service: 'system',
          actions: [
            'Monitor memory usage trends',
            'Consider scaling resources',
            'Review application memory patterns'
          ]
        });
      }

    } catch (error) {
      console.error('[HealthMonitor] Failed to collect system metrics:', error);
    }
  }

  private updateServiceHealth(serviceName: string, status: HealthStatus) {
    const existing = this.services.get(serviceName);
    
    const serviceHealth: ServiceHealth = {
      service: serviceName,
      status,
      lastCheck: new Date().toISOString(),
      consecutiveFailures: status.status === 'healthy' ? 0 : 
                          (existing?.consecutiveFailures || 0) + 1,
      alertSent: existing?.alertSent || false
    };

    this.services.set(serviceName, serviceHealth);
    this.emit('healthUpdate', { service: serviceName, health: serviceHealth });
  }

  private async createAlert(alertData: Omit<Alert, 'id' | 'timestamp' | 'resolved'>) {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      resolved: false,
      ...alertData
    };

    this.alerts.set(alert.id, alert);
    this.emit('newAlert', alert);

    console.warn(`[HealthMonitor] ALERT [${alert.severity.toUpperCase()}]: ${alert.title}`);
    console.warn(`[HealthMonitor] Service: ${alert.service}`);
    console.warn(`[HealthMonitor] Description: ${alert.description}`);
    
    if (alert.actions && alert.actions.length > 0) {
      console.warn(`[HealthMonitor] Suggested actions:`);
      alert.actions.forEach((action, index) => {
        console.warn(`[HealthMonitor]   ${index + 1}. ${action}`);
      });
    }

    // Auto-resolve some alerts after a delay
    if (alert.severity === 'low' || alert.severity === 'medium') {
      setTimeout(() => this.tryAutoResolveAlert(alert.id), 300000); // 5 minutes
    }

    return alert;
  }

  private async tryAutoResolveAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) return;

    const service = this.services.get(alert.service);
    if (service && service.status.status === 'healthy') {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      this.emit('alertResolved', alert);
      console.info(`[HealthMonitor] Auto-resolved alert: ${alert.title}`);
    }
  }

  private async evaluateAlerts() {
    // Clean up old resolved alerts
    const now = Date.now();
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved) {
        const resolvedTime = new Date(alert.resolvedAt!).getTime();
        if (now - resolvedTime > 24 * 60 * 60 * 1000) { // 24 hours
          this.alerts.delete(id);
        }
      }
    }
  }

  // Public API methods
  public getSystemHealth(): {
    status: string;
    services: ServiceHealth[];
    metrics: SystemMetrics | null;
    alerts: Alert[];
  } {
    const services = Array.from(this.services.values());
    const criticalServices = services.filter(s => s.status.status === 'critical' || s.status.status === 'down');
    const degradedServices = services.filter(s => s.status.status === 'degraded');
    
    let overallStatus = 'healthy';
    if (criticalServices.length > 0) {
      overallStatus = 'critical';
    } else if (degradedServices.length > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      services,
      metrics: this.metrics,
      alerts: Array.from(this.alerts.values()).filter(a => !a.resolved)
    };
  }

  public async resolveAlert(alertId: string) {
    const alert = this.alerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      this.emit('alertResolved', alert);
      return alert;
    }
    return null;
  }

  public getServiceHealth(serviceName: string): ServiceHealth | null {
    return this.services.get(serviceName) || null;
  }

  public async shutdown() {
    this.stopMonitoring();
    
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
    
    if (this.redis) {
      await this.redis.disconnect();
    }
    
    console.log('[HealthMonitor] Shutdown complete');
  }
}

// Export singleton instance
export const healthMonitor = new ComprehensiveHealthMonitor();
export default healthMonitor;