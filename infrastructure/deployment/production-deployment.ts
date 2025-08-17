/**
 * Production Deployment Orchestrator
 * Manages complete production deployment with health checks, monitoring, and rollback capabilities
 */

import { ProductionDatabaseManager, createProductionDatabaseConfig } from '../database/production-database';
import { RedisClusterManager, createRedisClusterConfig } from '../redis/redis-cluster';
import { SecurityManager, createSecurityConfig } from '../security/ssl-security-config';
import { WebSocketMonitor } from '../monitoring/websocket-monitor';
import { DatabaseBackupManager, createBackupConfig } from '../database/backup-automation';
import express from 'express';
import https from 'https';
import http from 'http';
import winston from 'winston';
import { EventEmitter } from 'events';
import cluster from 'cluster';
import os from 'os';

interface DeploymentConfig {
  app: {
    name: string;
    version: string;
    environment: 'production' | 'staging' | 'development';
    port: number;
    sslPort: number;
    workers: number;
    gracefulShutdownTimeout: number;
  };
  health: {
    enabled: boolean;
    path: string;
    interval: number;
    timeout: number;
    retries: number;
  };
  monitoring: {
    enabled: boolean;
    metricsPath: string;
    alerting: {
      enabled: boolean;
      webhookUrl?: string;
      channels: string[];
    };
  };
  deployment: {
    strategy: 'rolling' | 'blue-green' | 'canary';
    maxUnavailable: number;
    readinessTimeout: number;
    livenessTimeout: number;
    preStopHook?: string;
    postStartHook?: string;
  };
  resources: {
    memory: {
      limit: string;
      request: string;
    };
    cpu: {
      limit: string;
      request: string;
    };
  };
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: 'healthy' | 'degraded' | 'unhealthy';
    redis: 'healthy' | 'degraded' | 'unhealthy';
    websocket: 'healthy' | 'degraded' | 'unhealthy';
    security: 'healthy' | 'degraded' | 'unhealthy';
    backup: 'healthy' | 'degraded' | 'unhealthy';
  };
  uptime: number;
  version: string;
  environment: string;
  timestamp: Date;
  details?: any;
}

export class ProductionDeploymentManager extends EventEmitter {
  private config: DeploymentConfig;
  private logger: winston.Logger;
  private app: express.Application;
  private httpServer?: http.Server;
  private httpsServer?: https.Server;
  
  // Infrastructure components
  private databaseManager?: ProductionDatabaseManager;
  private redisManager?: RedisClusterManager;
  private securityManager?: SecurityManager;
  private wsMonitor?: WebSocketMonitor;
  private backupManager?: DatabaseBackupManager;
  
  private startTime: Date = new Date();
  private isShuttingDown: boolean = false;

  constructor(config: DeploymentConfig, app: express.Application) {
    super();
    this.config = config;
    this.app = app;
    this.setupLogger();
  }

  private setupLogger() {
    this.logger = winston.createLogger({
      level: this.config.app.environment === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { 
        service: 'production-deployment',
        version: this.config.app.version,
        environment: this.config.app.environment
      },
      transports: [
        new winston.transports.File({ filename: 'logs/deployment-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/deployment.log' }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ],
    });
  }

  public async start(): Promise<void> {
    this.logger.info('Starting production deployment', {
      version: this.config.app.version,
      environment: this.config.app.environment,
      workers: this.config.app.workers
    });

    try {
      // Initialize infrastructure components in order
      await this.initializeDatabaseManager();
      await this.initializeRedisManager();
      await this.initializeSecurityManager();
      await this.initializeWebSocketMonitor();
      await this.initializeBackupManager();

      // Configure application middleware
      this.configureApplication();

      // Set up health checks and monitoring
      this.setupHealthChecks();
      this.setupMonitoring();

      // Start servers
      await this.startServers();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      // Run post-start hooks
      if (this.config.deployment.postStartHook) {
        await this.runHook(this.config.deployment.postStartHook, 'post-start');
      }

      this.logger.info('Production deployment started successfully', {
        httpPort: this.config.app.port,
        httpsPort: this.config.app.sslPort,
        pid: process.pid
      });

      this.emit('started');

    } catch (error) {
      this.logger.error('Failed to start production deployment', { error: error.message });
      await this.shutdown();
      throw error;
    }
  }

  private async initializeDatabaseManager(): Promise<void> {
    this.logger.info('Initializing database manager');
    
    const dbConfig = createProductionDatabaseConfig();
    this.databaseManager = new ProductionDatabaseManager(dbConfig);
    
    this.databaseManager.on('error', (error) => {
      this.logger.error('Database error', error);
      this.emit('databaseError', error);
    });

    this.databaseManager.on('healthCheckFailed', (error) => {
      this.logger.error('Database health check failed', error);
      this.emit('healthCheckFailed', { component: 'database', error });
    });

    await this.databaseManager.initialize();
    this.logger.info('Database manager initialized');
  }

  private async initializeRedisManager(): Promise<void> {
    this.logger.info('Initializing Redis cluster manager');
    
    const redisConfig = createRedisClusterConfig();
    this.redisManager = new RedisClusterManager(redisConfig);
    
    this.redisManager.on('error', (error) => {
      this.logger.error('Redis error', error);
      this.emit('redisError', error);
    });

    this.redisManager.on('highMemoryUsage', (data) => {
      this.logger.warn('Redis high memory usage', data);
      this.emit('redisAlert', { type: 'memory', data });
    });

    await this.redisManager.connect();
    this.logger.info('Redis cluster manager initialized');
  }

  private async initializeSecurityManager(): Promise<void> {
    this.logger.info('Initializing security manager');
    
    const securityConfig = createSecurityConfig();
    this.securityManager = new SecurityManager(securityConfig, this.redisManager?.client as any);
    
    this.securityManager.on('incident', (incident) => {
      this.logger.warn('Security incident', incident);
      this.emit('securityIncident', incident);
    });

    this.securityManager.on('criticalIncident', (incident) => {
      this.logger.error('Critical security incident', incident);
      this.emit('criticalSecurityIncident', incident);
    });

    this.securityManager.startMonitoring();
    this.logger.info('Security manager initialized');
  }

  private async initializeWebSocketMonitor(): Promise<void> {
    this.logger.info('Initializing WebSocket monitor');
    
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.wsMonitor = new WebSocketMonitor(redisUrl);
    
    this.wsMonitor.on('alert', (alert) => {
      this.logger.warn('WebSocket alert', alert);
      this.emit('webSocketAlert', alert);
    });

    this.wsMonitor.start();
    this.logger.info('WebSocket monitor initialized');
  }

  private async initializeBackupManager(): Promise<void> {
    this.logger.info('Initializing backup manager');
    
    const backupConfig = createBackupConfig();
    this.backupManager = new DatabaseBackupManager(backupConfig);
    
    this.backupManager.start();
    this.logger.info('Backup manager initialized');
  }

  private configureApplication(): void {
    this.logger.info('Configuring application middleware');

    // Configure security middleware
    if (this.securityManager) {
      this.securityManager.configureExpress(this.app);
    }

    // Add deployment-specific middleware
    this.app.use((req, res, next) => {
      res.setHeader('X-App-Version', this.config.app.version);
      res.setHeader('X-Environment', this.config.app.environment);
      res.setHeader('X-Instance-Id', process.env.HOSTNAME || 'unknown');
      next();
    });

    this.logger.info('Application middleware configured');
  }

  private setupHealthChecks(): void {
    if (!this.config.health.enabled) {
      return;
    }

    this.logger.info('Setting up health checks');

    this.app.get(this.config.health.path, async (req, res) => {
      try {
        const healthStatus = await this.getHealthStatus();
        
        const statusCode = healthStatus.status === 'healthy' ? 200 :
                          healthStatus.status === 'degraded' ? 200 : 503;

        res.status(statusCode).json(healthStatus);

      } catch (error) {
        this.logger.error('Health check failed', { error: error.message });
        res.status(503).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date()
        });
      }
    });

    this.app.get('/readiness', async (req, res) => {
      // Readiness check - is the app ready to serve traffic?
      try {
        if (this.isShuttingDown) {
          return res.status(503).json({ status: 'shutting_down' });
        }

        const healthStatus = await this.getHealthStatus();
        const isReady = healthStatus.status !== 'unhealthy';

        res.status(isReady ? 200 : 503).json({
          status: isReady ? 'ready' : 'not_ready',
          health: healthStatus
        });

      } catch (error) {
        res.status(503).json({
          status: 'not_ready',
          error: error.message
        });
      }
    });

    this.app.get('/liveness', (req, res) => {
      // Liveness check - is the app still alive?
      if (this.isShuttingDown) {
        return res.status(503).json({ status: 'shutting_down' });
      }

      res.json({
        status: 'alive',
        uptime: Date.now() - this.startTime.getTime(),
        timestamp: new Date()
      });
    });

    this.logger.info('Health checks configured');
  }

  private setupMonitoring(): void {
    if (!this.config.monitoring.enabled) {
      return;
    }

    this.logger.info('Setting up monitoring endpoints');

    this.app.get(this.config.monitoring.metricsPath, async (req, res) => {
      try {
        const metrics = await this.collectMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Set up alerting if configured
    if (this.config.monitoring.alerting.enabled) {
      this.setupAlerting();
    }

    this.logger.info('Monitoring configured');
  }

  private setupAlerting(): void {
    const checkInterval = 60000; // 1 minute

    setInterval(async () => {
      try {
        const healthStatus = await this.getHealthStatus();
        
        if (healthStatus.status === 'unhealthy') {
          await this.sendAlert('critical', 'Application unhealthy', {
            status: healthStatus,
            environment: this.config.app.environment,
            version: this.config.app.version
          });
        } else if (healthStatus.status === 'degraded') {
          await this.sendAlert('warning', 'Application degraded', {
            status: healthStatus,
            environment: this.config.app.environment
          });
        }

      } catch (error) {
        this.logger.error('Alert check failed', { error: error.message });
      }
    }, checkInterval);
  }

  private async sendAlert(severity: string, message: string, data: any): Promise<void> {
    this.logger.warn('Sending alert', { severity, message, data });

    if (this.config.monitoring.alerting.webhookUrl) {
      try {
        const response = await fetch(this.config.monitoring.alerting.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            severity,
            message,
            data,
            timestamp: new Date().toISOString(),
            source: 'production-deployment-manager'
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

      } catch (error) {
        this.logger.error('Failed to send webhook alert', { error: error.message });
      }
    }

    this.emit('alert', { severity, message, data });
  }

  private async startServers(): Promise<void> {
    this.logger.info('Starting HTTP/HTTPS servers');

    // Start HTTP server
    this.httpServer = http.createServer(this.app);
    
    this.httpServer.on('error', (error) => {
      this.logger.error('HTTP server error', { error: error.message });
      this.emit('serverError', { type: 'http', error });
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer!.listen(this.config.app.port, () => {
        this.logger.info(`HTTP server listening on port ${this.config.app.port}`);
        resolve();
      });

      this.httpServer!.on('error', reject);
    });

    // Start HTTPS server if SSL is enabled
    if (this.securityManager) {
      this.httpsServer = this.securityManager.createHTTPSServer(this.app);
      
      if (this.httpsServer) {
        this.httpsServer.on('error', (error) => {
          this.logger.error('HTTPS server error', { error: error.message });
          this.emit('serverError', { type: 'https', error });
        });

        await new Promise<void>((resolve, reject) => {
          this.httpsServer!.listen(this.config.app.sslPort, () => {
            this.logger.info(`HTTPS server listening on port ${this.config.app.sslPort}`);
            resolve();
          });

          this.httpsServer!.on('error', reject);
        });
      }
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`Received ${signal}, starting graceful shutdown`);
      this.isShuttingDown = true;

      try {
        await this.shutdown();
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', { reason, promise });
      shutdown('unhandledRejection');
    });
  }

  private async runHook(hook: string, type: string): Promise<void> {
    this.logger.info(`Running ${type} hook: ${hook}`);
    
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout, stderr } = await execAsync(hook, { timeout: 30000 });
      
      this.logger.info(`${type} hook completed`, { stdout, stderr });
      
    } catch (error) {
      this.logger.error(`${type} hook failed`, { error: error.message });
      throw error;
    }
  }

  private async getHealthStatus(): Promise<HealthStatus> {
    const checks = {
      database: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      redis: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      websocket: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      security: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      backup: 'healthy' as 'healthy' | 'degraded' | 'unhealthy'
    };

    // Check database health
    if (this.databaseManager) {
      const dbHealth = await this.databaseManager.getHealthStatus();
      checks.database = dbHealth.status as any;
    }

    // Check Redis health
    if (this.redisManager) {
      const redisHealth = await this.redisManager.getHealthStatus();
      checks.redis = redisHealth.status === 'healthy' ? 'healthy' : 
                     redisHealth.status === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    // Check WebSocket health
    if (this.wsMonitor) {
      const wsHealth = await this.wsMonitor.getHealthStatus();
      checks.websocket = wsHealth.status as any;
    }

    // Check security status
    if (this.securityManager) {
      const securityStatus = await this.securityManager.getSecurityStatus();
      checks.security = securityStatus.status as any;
    }

    // Check backup status
    if (this.backupManager) {
      const backupStatus = await this.backupManager.getBackupStatus();
      checks.backup = backupStatus.lastFullBackup ? 'healthy' : 'degraded';
    }

    // Determine overall status
    const statuses = Object.values(checks);
    const overall = statuses.some(s => s === 'unhealthy') ? 'unhealthy' :
                   statuses.some(s => s === 'degraded') ? 'degraded' : 'healthy';

    return {
      status: overall,
      checks,
      uptime: Date.now() - this.startTime.getTime(),
      version: this.config.app.version,
      environment: this.config.app.environment,
      timestamp: new Date()
    };
  }

  private async collectMetrics(): Promise<any> {
    const metrics: any = {
      app: {
        name: this.config.app.name,
        version: this.config.app.version,
        environment: this.config.app.environment,
        uptime: Date.now() - this.startTime.getTime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        pid: process.pid
      },
      timestamp: new Date()
    };

    // Collect database metrics
    if (this.databaseManager) {
      const dbMetrics = this.databaseManager.getLatestMetrics();
      if (dbMetrics) {
        metrics.database = dbMetrics;
      }
    }

    // Collect Redis metrics
    if (this.redisManager) {
      const redisMetrics = this.redisManager.getLatestMetrics();
      if (redisMetrics) {
        metrics.redis = redisMetrics;
      }
    }

    // Collect WebSocket metrics
    if (this.wsMonitor) {
      const wsMetrics = this.wsMonitor.getLatestMetrics();
      if (wsMetrics) {
        metrics.websocket = wsMetrics;
      }
    }

    // Collect security metrics
    if (this.securityManager) {
      const securityMetrics = this.securityManager.getSecurityMetrics();
      if (securityMetrics) {
        metrics.security = securityMetrics;
      }
    }

    return metrics;
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down production deployment');
    this.isShuttingDown = true;

    const shutdownPromises: Promise<void>[] = [];
    const timeout = this.config.app.gracefulShutdownTimeout;

    // Run pre-stop hook
    if (this.config.deployment.preStopHook) {
      try {
        await this.runHook(this.config.deployment.preStopHook, 'pre-stop');
      } catch (error) {
        this.logger.error('Pre-stop hook failed', { error: error.message });
      }
    }

    // Stop accepting new connections
    if (this.httpServer) {
      shutdownPromises.push(new Promise((resolve) => {
        this.httpServer!.close(() => {
          this.logger.info('HTTP server closed');
          resolve();
        });
      }));
    }

    if (this.httpsServer) {
      shutdownPromises.push(new Promise((resolve) => {
        this.httpsServer!.close(() => {
          this.logger.info('HTTPS server closed');
          resolve();
        });
      }));
    }

    // Stop infrastructure components
    if (this.backupManager) {
      this.backupManager.stop();
    }

    if (this.wsMonitor) {
      this.wsMonitor.stop();
    }

    if (this.securityManager) {
      this.securityManager.stopMonitoring();
    }

    if (this.redisManager) {
      shutdownPromises.push(this.redisManager.disconnect());
    }

    if (this.databaseManager) {
      shutdownPromises.push(this.databaseManager.shutdown());
    }

    // Wait for all components to shut down
    const shutdownPromise = Promise.all(shutdownPromises);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Shutdown timeout')), timeout);
    });

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
      this.logger.info('Production deployment shut down successfully');
      this.emit('shutdown');
    } catch (error) {
      this.logger.error('Error during shutdown', { error: error.message });
      throw error;
    }
  }
}

// Configuration factory
export function createDeploymentConfig(): DeploymentConfig {
  const workers = parseInt(process.env.WORKERS || '0') || os.cpus().length;

  return {
    app: {
      name: process.env.APP_NAME || 'saas-idp-platform',
      version: process.env.APP_VERSION || '1.0.0',
      environment: (process.env.NODE_ENV as any) || 'production',
      port: parseInt(process.env.PORT || '4400'),
      sslPort: parseInt(process.env.SSL_PORT || '4443'),
      workers,
      gracefulShutdownTimeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '30000'),
    },
    health: {
      enabled: process.env.HEALTH_CHECKS_ENABLED !== 'false',
      path: process.env.HEALTH_PATH || '/health',
      interval: parseInt(process.env.HEALTH_INTERVAL || '30000'),
      timeout: parseInt(process.env.HEALTH_TIMEOUT || '5000'),
      retries: parseInt(process.env.HEALTH_RETRIES || '3'),
    },
    monitoring: {
      enabled: process.env.MONITORING_ENABLED !== 'false',
      metricsPath: process.env.METRICS_PATH || '/metrics',
      alerting: {
        enabled: process.env.ALERTING_ENABLED === 'true',
        webhookUrl: process.env.ALERT_WEBHOOK_URL,
        channels: (process.env.ALERT_CHANNELS || '').split(',').filter(Boolean),
      },
    },
    deployment: {
      strategy: (process.env.DEPLOYMENT_STRATEGY as any) || 'rolling',
      maxUnavailable: parseInt(process.env.MAX_UNAVAILABLE || '1'),
      readinessTimeout: parseInt(process.env.READINESS_TIMEOUT || '30000'),
      livenessTimeout: parseInt(process.env.LIVENESS_TIMEOUT || '30000'),
      preStopHook: process.env.PRE_STOP_HOOK,
      postStartHook: process.env.POST_START_HOOK,
    },
    resources: {
      memory: {
        limit: process.env.MEMORY_LIMIT || '2Gi',
        request: process.env.MEMORY_REQUEST || '1Gi',
      },
      cpu: {
        limit: process.env.CPU_LIMIT || '2000m',
        request: process.env.CPU_REQUEST || '1000m',
      },
    },
  };
}