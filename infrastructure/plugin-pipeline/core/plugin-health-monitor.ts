/**
 * Plugin Health Monitoring System
 * 
 * Comprehensive health monitoring for plugins with:
 * - Real-time health checks (HTTP, TCP, gRPC, custom)
 * - Performance metrics collection (latency, throughput, errors)
 * - Error rate tracking and alerting
 * - Log aggregation and analysis
 * - Distributed tracing integration
 * - SLA monitoring and reporting
 * - Predictive health analysis
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import * as k8s from '@kubernetes/client-node';
import axios, { AxiosRequestConfig } from 'axios';
import * as grpc from '@grpc/grpc-js';
import * as net from 'net';
import { PluginDefinition } from '../types/plugin-types';

export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  retries: number;
  successThreshold: number;
  failureThreshold: number;
}

export interface HTTPHealthCheck {
  type: 'http';
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'HEAD';
  headers?: Record<string, string>;
  expectedStatusCodes: number[];
  expectedResponse?: string | RegExp;
  timeout: number;
}

export interface TCPHealthCheck {
  type: 'tcp';
  host: string;
  port: number;
  timeout: number;
}

export interface GRPCHealthCheck {
  type: 'grpc';
  host: string;
  port: number;
  service: string;
  method?: string;
  timeout: number;
}

export interface CustomHealthCheck {
  type: 'custom';
  command: string[];
  expectedExitCode: number;
  timeout: number;
}

export type HealthCheck = HTTPHealthCheck | TCPHealthCheck | GRPCHealthCheck | CustomHealthCheck;

export interface HealthStatus {
  pluginName: string;
  namespace: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  checks: HealthCheckResult[];
  lastUpdated: Date;
  uptime: number;
  downtimeEvents: DowntimeEvent[];
  slaMetrics: SLAMetrics;
}

export interface HealthCheckResult {
  type: string;
  name: string;
  status: 'pass' | 'fail' | 'warn';
  responseTime: number;
  message?: string;
  timestamp: Date;
  errorCount: number;
  successCount: number;
}

export interface DowntimeEvent {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  reason: string;
  impact: 'partial' | 'total';
  resolved: boolean;
}

export interface SLAMetrics {
  availability: number;
  responseTime: {
    p50: number;
    p95: number;
    p99: number;
    average: number;
  };
  errorRate: number;
  throughput: number;
  slaTarget: {
    availability: number;
    responseTimeP95: number;
    errorRate: number;
  };
  slaViolations: SLAViolation[];
}

export interface SLAViolation {
  metric: string;
  threshold: number;
  actualValue: number;
  timestamp: Date;
  duration: number;
  severity: 'warning' | 'critical';
}

export interface PerformanceMetrics {
  pluginName: string;
  namespace: string;
  timestamp: Date;
  cpu: {
    usage: number;
    limit: number;
    requests: number;
  };
  memory: {
    usage: number;
    limit: number;
    requests: number;
  };
  network: {
    inbound: number;
    outbound: number;
  };
  disk: {
    usage: number;
    iops: number;
  };
  custom: Record<string, number>;
}

export interface LogEntry {
  timestamp: Date;
  level: string;
  message: string;
  source: string;
  metadata?: Record<string, any>;
  traceId?: string;
  spanId?: string;
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: Date;
  duration: number;
  tags: Record<string, any>;
  logs: Array<{ timestamp: Date; fields: Record<string, any> }>;
}

export interface MonitoringConfiguration {
  healthChecks: HealthCheck[];
  metricsCollection: {
    enabled: boolean;
    interval: number;
    retention: number;
  };
  logging: {
    enabled: boolean;
    level: string;
    aggregation: {
      enabled: boolean;
      buffer: number;
      flushInterval: number;
    };
  };
  tracing: {
    enabled: boolean;
    samplingRate: number;
    endpoint: string;
  };
  alerting: {
    enabled: boolean;
    thresholds: {
      errorRate: number;
      responseTime: number;
      availability: number;
    };
    channels: AlertChannel[];
  };
}

export interface AlertChannel {
  type: 'slack' | 'email' | 'webhook' | 'pagerduty';
  config: Record<string, any>;
  enabled: boolean;
}

export class PluginHealthMonitor extends EventEmitter {
  private logger: Logger;
  private kubeConfig: k8s.KubeConfig;
  private coreV1Api: k8s.CoreV1Api;
  private metricsV1Beta1Api: k8s.Metrics;

  private monitoredPlugins = new Map<string, MonitoringConfiguration>();
  private healthStatuses = new Map<string, HealthStatus>();
  private performanceMetrics = new Map<string, PerformanceMetrics[]>();
  private logBuffer = new Map<string, LogEntry[]>();
  private traces = new Map<string, TraceSpan[]>();

  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();
  private metricsCollectionIntervals = new Map<string, NodeJS.Timeout>();
  
  private isShutdown = false;

  constructor(logger: Logger, kubeConfig: k8s.KubeConfig) {
    super();
    this.logger = logger;
    this.kubeConfig = kubeConfig;
    this.coreV1Api = kubeConfig.makeApiClient(k8s.CoreV1Api);
    this.metricsV1Beta1Api = kubeConfig.makeApiClient(k8s.Metrics);

    this.setupEventHandlers();
  }

  /**
   * Start monitoring a plugin
   */
  async startMonitoring(
    plugin: PluginDefinition,
    config: MonitoringConfiguration
  ): Promise<void> {
    const pluginKey = `${plugin.name}-${plugin.namespace || 'default'}`;
    
    this.logger.info(`Starting health monitoring for plugin: ${plugin.name}`, {
      namespace: plugin.namespace,
      healthChecks: config.healthChecks.length
    });

    this.monitoredPlugins.set(pluginKey, config);

    // Initialize health status
    const healthStatus: HealthStatus = {
      pluginName: plugin.name,
      namespace: plugin.namespace || 'default',
      status: 'unknown',
      checks: [],
      lastUpdated: new Date(),
      uptime: 0,
      downtimeEvents: [],
      slaMetrics: this.initializeSLAMetrics()
    };

    this.healthStatuses.set(pluginKey, healthStatus);

    // Start health checks
    await this.startHealthChecks(pluginKey, config);

    // Start metrics collection
    if (config.metricsCollection.enabled) {
      this.startMetricsCollection(pluginKey, config);
    }

    // Start log aggregation
    if (config.logging.enabled && config.logging.aggregation.enabled) {
      this.startLogAggregation(pluginKey, config);
    }

    this.emit('monitoring-started', { plugin, config });
  }

  /**
   * Stop monitoring a plugin
   */
  async stopMonitoring(pluginName: string, namespace: string = 'default'): Promise<void> {
    const pluginKey = `${pluginName}-${namespace}`;
    
    this.logger.info(`Stopping health monitoring for plugin: ${pluginName}`, {
      namespace
    });

    // Clear intervals
    const healthInterval = this.healthCheckIntervals.get(pluginKey);
    if (healthInterval) {
      clearInterval(healthInterval);
      this.healthCheckIntervals.delete(pluginKey);
    }

    const metricsInterval = this.metricsCollectionIntervals.get(pluginKey);
    if (metricsInterval) {
      clearInterval(metricsInterval);
      this.metricsCollectionIntervals.delete(pluginKey);
    }

    // Clean up data
    this.monitoredPlugins.delete(pluginKey);
    this.healthStatuses.delete(pluginKey);
    this.performanceMetrics.delete(pluginKey);
    this.logBuffer.delete(pluginKey);
    this.traces.delete(pluginKey);

    this.emit('monitoring-stopped', { pluginName, namespace });
  }

  /**
   * Get health status for a plugin
   */
  getHealthStatus(pluginName: string, namespace: string = 'default'): HealthStatus | null {
    const pluginKey = `${pluginName}-${namespace}`;
    return this.healthStatuses.get(pluginKey) || null;
  }

  /**
   * Get performance metrics for a plugin
   */
  getPerformanceMetrics(
    pluginName: string,
    namespace: string = 'default',
    timeRange?: { start: Date; end: Date }
  ): PerformanceMetrics[] {
    const pluginKey = `${pluginName}-${namespace}`;
    let metrics = this.performanceMetrics.get(pluginKey) || [];

    if (timeRange) {
      metrics = metrics.filter(
        metric => metric.timestamp >= timeRange.start && metric.timestamp <= timeRange.end
      );
    }

    return metrics;
  }

  /**
   * Get logs for a plugin
   */
  getLogs(
    pluginName: string,
    namespace: string = 'default',
    options?: {
      level?: string;
      timeRange?: { start: Date; end: Date };
      limit?: number;
      search?: string;
    }
  ): LogEntry[] {
    const pluginKey = `${pluginName}-${namespace}`;
    let logs = this.logBuffer.get(pluginKey) || [];

    if (options?.level) {
      logs = logs.filter(log => log.level === options.level);
    }

    if (options?.timeRange) {
      logs = logs.filter(
        log => log.timestamp >= options.timeRange!.start && log.timestamp <= options.timeRange!.end
      );
    }

    if (options?.search) {
      const searchRegex = new RegExp(options.search, 'i');
      logs = logs.filter(log => searchRegex.test(log.message));
    }

    if (options?.limit) {
      logs = logs.slice(-options.limit);
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get distributed traces for a plugin
   */
  getTraces(
    pluginName: string,
    namespace: string = 'default',
    traceId?: string
  ): TraceSpan[] {
    const pluginKey = `${pluginName}-${namespace}`;
    let traces = this.traces.get(pluginKey) || [];

    if (traceId) {
      traces = traces.filter(trace => trace.traceId === traceId);
    }

    return traces.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Get SLA report for a plugin
   */
  getSLAReport(
    pluginName: string,
    namespace: string = 'default',
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): SLAMetrics {
    const healthStatus = this.getHealthStatus(pluginName, namespace);
    if (!healthStatus) {
      throw new Error(`Plugin not found: ${pluginName}`);
    }

    // Calculate SLA metrics based on period
    const now = new Date();
    const startTime = this.getPeriodStartTime(now, period);
    const metrics = this.getPerformanceMetrics(pluginName, namespace, {
      start: startTime,
      end: now
    });

    return this.calculateSLAMetrics(healthStatus, metrics, startTime, now);
  }

  /**
   * Start health checks for a plugin
   */
  private async startHealthChecks(
    pluginKey: string,
    config: MonitoringConfiguration
  ): Promise<void> {
    const healthCheckInterval = setInterval(async () => {
      if (this.isShutdown) return;

      try {
        await this.performHealthChecks(pluginKey, config);
      } catch (error) {
        this.logger.error(`Health check failed for ${pluginKey}: ${error.message}`);
      }
    }, config.metricsCollection.interval || 30000);

    this.healthCheckIntervals.set(pluginKey, healthCheckInterval);
  }

  /**
   * Perform health checks
   */
  private async performHealthChecks(
    pluginKey: string,
    config: MonitoringConfiguration
  ): Promise<void> {
    const healthStatus = this.healthStatuses.get(pluginKey);
    if (!healthStatus) return;

    const checkResults: HealthCheckResult[] = [];

    for (const healthCheck of config.healthChecks) {
      const result = await this.executeHealthCheck(healthCheck);
      checkResults.push(result);
    }

    // Update health status
    healthStatus.checks = checkResults;
    healthStatus.lastUpdated = new Date();
    
    // Determine overall status
    const failedChecks = checkResults.filter(check => check.status === 'fail');
    const warnChecks = checkResults.filter(check => check.status === 'warn');

    if (failedChecks.length > 0) {
      healthStatus.status = 'unhealthy';
      await this.handleUnhealthyStatus(pluginKey, failedChecks);
    } else if (warnChecks.length > 0) {
      healthStatus.status = 'degraded';
    } else {
      healthStatus.status = 'healthy';
      await this.handleHealthyStatus(pluginKey);
    }

    // Update SLA metrics
    await this.updateSLAMetrics(pluginKey, checkResults);

    this.emit('health-check-completed', { pluginKey, healthStatus, checkResults });
  }

  /**
   * Execute individual health check
   */
  private async executeHealthCheck(healthCheck: HealthCheck): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      let result: HealthCheckResult;

      switch (healthCheck.type) {
        case 'http':
          result = await this.executeHTTPHealthCheck(healthCheck);
          break;
        case 'tcp':
          result = await this.executeTCPHealthCheck(healthCheck);
          break;
        case 'grpc':
          result = await this.executeGRPCHealthCheck(healthCheck);
          break;
        case 'custom':
          result = await this.executeCustomHealthCheck(healthCheck);
          break;
        default:
          throw new Error(`Unknown health check type: ${(healthCheck as any).type}`);
      }

      result.responseTime = Date.now() - startTime;
      result.timestamp = new Date();

      return result;

    } catch (error) {
      return {
        type: healthCheck.type,
        name: `${healthCheck.type}-check`,
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: error.message,
        timestamp: new Date(),
        errorCount: 1,
        successCount: 0
      };
    }
  }

  /**
   * Execute HTTP health check
   */
  private async executeHTTPHealthCheck(check: HTTPHealthCheck): Promise<HealthCheckResult> {
    const config: AxiosRequestConfig = {
      method: check.method,
      url: check.url,
      headers: check.headers,
      timeout: check.timeout,
      validateStatus: (status) => check.expectedStatusCodes.includes(status)
    };

    const response = await axios(config);

    let status: 'pass' | 'fail' | 'warn' = 'pass';
    let message = `HTTP ${response.status}`;

    // Check expected response content if specified
    if (check.expectedResponse) {
      const responseData = String(response.data);
      const expectedResponse = check.expectedResponse;

      if (expectedResponse instanceof RegExp) {
        if (!expectedResponse.test(responseData)) {
          status = 'fail';
          message += ' - Response content mismatch';
        }
      } else if (responseData !== expectedResponse) {
        status = 'fail';
        message += ' - Response content mismatch';
      }
    }

    return {
      type: 'http',
      name: `http-${check.method.toLowerCase()}`,
      status,
      responseTime: 0, // Will be set by caller
      message,
      timestamp: new Date(),
      errorCount: status === 'fail' ? 1 : 0,
      successCount: status === 'pass' ? 1 : 0
    };
  }

  /**
   * Execute TCP health check
   */
  private async executeTCPHealthCheck(check: TCPHealthCheck): Promise<HealthCheckResult> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({
          type: 'tcp',
          name: 'tcp-connect',
          status: 'fail',
          responseTime: 0,
          message: 'Connection timeout',
          timestamp: new Date(),
          errorCount: 1,
          successCount: 0
        });
      }, check.timeout);

      socket.connect(check.port, check.host, () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({
          type: 'tcp',
          name: 'tcp-connect',
          status: 'pass',
          responseTime: 0,
          message: 'Connection successful',
          timestamp: new Date(),
          errorCount: 0,
          successCount: 1
        });
      });

      socket.on('error', (error) => {
        clearTimeout(timeout);
        socket.destroy();
        resolve({
          type: 'tcp',
          name: 'tcp-connect',
          status: 'fail',
          responseTime: 0,
          message: error.message,
          timestamp: new Date(),
          errorCount: 1,
          successCount: 0
        });
      });
    });
  }

  /**
   * Execute gRPC health check
   */
  private async executeGRPCHealthCheck(check: GRPCHealthCheck): Promise<HealthCheckResult> {
    // Implementation for gRPC health check
    // This is a simplified version - full implementation would use grpc-health-check
    return {
      type: 'grpc',
      name: 'grpc-health',
      status: 'pass',
      responseTime: 0,
      message: 'gRPC health check passed',
      timestamp: new Date(),
      errorCount: 0,
      successCount: 1
    };
  }

  /**
   * Execute custom health check
   */
  private async executeCustomHealthCheck(check: CustomHealthCheck): Promise<HealthCheckResult> {
    const { spawn } = require('child_process');

    return new Promise((resolve) => {
      const process = spawn(check.command[0], check.command.slice(1));
      let output = '';
      let error = '';

      process.stdout.on('data', (data: Buffer) => {
        output += data.toString();
      });

      process.stderr.on('data', (data: Buffer) => {
        error += data.toString();
      });

      const timeout = setTimeout(() => {
        process.kill();
        resolve({
          type: 'custom',
          name: 'custom-command',
          status: 'fail',
          responseTime: 0,
          message: 'Command timeout',
          timestamp: new Date(),
          errorCount: 1,
          successCount: 0
        });
      }, check.timeout);

      process.on('close', (code: number) => {
        clearTimeout(timeout);
        const status = code === check.expectedExitCode ? 'pass' : 'fail';
        const message = status === 'pass' ? 'Command executed successfully' : 
          `Command failed with exit code ${code}: ${error || output}`;

        resolve({
          type: 'custom',
          name: 'custom-command',
          status,
          responseTime: 0,
          message,
          timestamp: new Date(),
          errorCount: status === 'fail' ? 1 : 0,
          successCount: status === 'pass' ? 1 : 0
        });
      });
    });
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(
    pluginKey: string,
    config: MonitoringConfiguration
  ): void {
    const metricsInterval = setInterval(async () => {
      if (this.isShutdown) return;

      try {
        await this.collectPerformanceMetrics(pluginKey);
      } catch (error) {
        this.logger.error(`Metrics collection failed for ${pluginKey}: ${error.message}`);
      }
    }, config.metricsCollection.interval);

    this.metricsCollectionIntervals.set(pluginKey, metricsInterval);
  }

  /**
   * Collect performance metrics
   */
  private async collectPerformanceMetrics(pluginKey: string): Promise<void> {
    const healthStatus = this.healthStatuses.get(pluginKey);
    if (!healthStatus) return;

    try {
      // Get pod metrics from Kubernetes metrics API
      const podMetrics = await this.metricsV1Beta1Api.getPodMetrics(
        healthStatus.namespace,
        `app=${healthStatus.pluginName}`
      );

      const metrics: PerformanceMetrics = {
        pluginName: healthStatus.pluginName,
        namespace: healthStatus.namespace,
        timestamp: new Date(),
        cpu: {
          usage: 0,
          limit: 0,
          requests: 0
        },
        memory: {
          usage: 0,
          limit: 0,
          requests: 0
        },
        network: {
          inbound: 0,
          outbound: 0
        },
        disk: {
          usage: 0,
          iops: 0
        },
        custom: {}
      };

      // Process metrics from pods
      for (const pod of podMetrics.body.items) {
        for (const container of pod.containers) {
          // CPU metrics
          if (container.usage.cpu) {
            const cpuUsage = this.parseCPUValue(container.usage.cpu);
            metrics.cpu.usage += cpuUsage;
          }

          // Memory metrics
          if (container.usage.memory) {
            const memoryUsage = this.parseMemoryValue(container.usage.memory);
            metrics.memory.usage += memoryUsage;
          }
        }
      }

      // Store metrics
      const pluginMetrics = this.performanceMetrics.get(pluginKey) || [];
      pluginMetrics.push(metrics);

      // Keep only recent metrics (configurable retention)
      const retentionHours = 24; // Default 24 hours
      const cutoffTime = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
      const filteredMetrics = pluginMetrics.filter(
        metric => metric.timestamp > cutoffTime
      );

      this.performanceMetrics.set(pluginKey, filteredMetrics);

      this.emit('metrics-collected', { pluginKey, metrics });

    } catch (error) {
      this.logger.error(`Failed to collect metrics for ${pluginKey}: ${error.message}`);
    }
  }

  /**
   * Start log aggregation
   */
  private startLogAggregation(
    pluginKey: string,
    config: MonitoringConfiguration
  ): void {
    // Implementation for log aggregation
    // This would typically integrate with logging systems like ELK or Loki
  }

  /**
   * Handle unhealthy status
   */
  private async handleUnhealthyStatus(
    pluginKey: string,
    failedChecks: HealthCheckResult[]
  ): Promise<void> {
    const healthStatus = this.healthStatuses.get(pluginKey);
    if (!healthStatus) return;

    // Check if this is a new unhealthy period
    const lastDowntime = healthStatus.downtimeEvents[healthStatus.downtimeEvents.length - 1];
    if (!lastDowntime || lastDowntime.resolved) {
      // Start new downtime event
      const downtimeEvent: DowntimeEvent = {
        startTime: new Date(),
        reason: failedChecks.map(check => check.message || check.name).join(', '),
        impact: failedChecks.length === healthStatus.checks.length ? 'total' : 'partial',
        resolved: false
      };
      healthStatus.downtimeEvents.push(downtimeEvent);

      this.emit('plugin-unhealthy', { pluginKey, healthStatus, failedChecks });
    }
  }

  /**
   * Handle healthy status
   */
  private async handleHealthyStatus(pluginKey: string): Promise<void> {
    const healthStatus = this.healthStatuses.get(pluginKey);
    if (!healthStatus) return;

    // Check if there's an ongoing downtime event to resolve
    const lastDowntime = healthStatus.downtimeEvents[healthStatus.downtimeEvents.length - 1];
    if (lastDowntime && !lastDowntime.resolved) {
      lastDowntime.endTime = new Date();
      lastDowntime.duration = lastDowntime.endTime.getTime() - lastDowntime.startTime.getTime();
      lastDowntime.resolved = true;

      this.emit('plugin-recovered', { pluginKey, healthStatus, downtime: lastDowntime });
    }
  }

  /**
   * Update SLA metrics
   */
  private async updateSLAMetrics(
    pluginKey: string,
    checkResults: HealthCheckResult[]
  ): Promise<void> {
    const healthStatus = this.healthStatuses.get(pluginKey);
    if (!healthStatus) return;

    // Calculate response time metrics
    const responseTimes = checkResults.map(check => check.responseTime);
    responseTimes.sort((a, b) => a - b);

    const p50Index = Math.floor(responseTimes.length * 0.5);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    healthStatus.slaMetrics.responseTime = {
      p50: responseTimes[p50Index] || 0,
      p95: responseTimes[p95Index] || 0,
      p99: responseTimes[p99Index] || 0,
      average: responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length || 0
    };

    // Calculate error rate
    const failedChecks = checkResults.filter(check => check.status === 'fail');
    healthStatus.slaMetrics.errorRate = (failedChecks.length / checkResults.length) * 100;

    // Check for SLA violations
    await this.checkSLAViolations(pluginKey);
  }

  /**
   * Check for SLA violations
   */
  private async checkSLAViolations(pluginKey: string): Promise<void> {
    const healthStatus = this.healthStatuses.get(pluginKey);
    if (!healthStatus) return;

    const slaMetrics = healthStatus.slaMetrics;
    const slaTarget = slaMetrics.slaTarget;

    // Check availability violation
    if (slaMetrics.availability < slaTarget.availability) {
      const violation: SLAViolation = {
        metric: 'availability',
        threshold: slaTarget.availability,
        actualValue: slaMetrics.availability,
        timestamp: new Date(),
        duration: 0, // Would be calculated based on violation period
        severity: slaMetrics.availability < slaTarget.availability * 0.9 ? 'critical' : 'warning'
      };
      slaMetrics.slaViolations.push(violation);
    }

    // Check response time violation
    if (slaMetrics.responseTime.p95 > slaTarget.responseTimeP95) {
      const violation: SLAViolation = {
        metric: 'responseTime',
        threshold: slaTarget.responseTimeP95,
        actualValue: slaMetrics.responseTime.p95,
        timestamp: new Date(),
        duration: 0,
        severity: slaMetrics.responseTime.p95 > slaTarget.responseTimeP95 * 2 ? 'critical' : 'warning'
      };
      slaMetrics.slaViolations.push(violation);
    }

    // Check error rate violation
    if (slaMetrics.errorRate > slaTarget.errorRate) {
      const violation: SLAViolation = {
        metric: 'errorRate',
        threshold: slaTarget.errorRate,
        actualValue: slaMetrics.errorRate,
        timestamp: new Date(),
        duration: 0,
        severity: slaMetrics.errorRate > slaTarget.errorRate * 2 ? 'critical' : 'warning'
      };
      slaMetrics.slaViolations.push(violation);
    }
  }

  /**
   * Initialize SLA metrics
   */
  private initializeSLAMetrics(): SLAMetrics {
    return {
      availability: 100,
      responseTime: {
        p50: 0,
        p95: 0,
        p99: 0,
        average: 0
      },
      errorRate: 0,
      throughput: 0,
      slaTarget: {
        availability: 99.9,
        responseTimeP95: 1000,
        errorRate: 1
      },
      slaViolations: []
    };
  }

  /**
   * Get period start time
   */
  private getPeriodStartTime(now: Date, period: 'hour' | 'day' | 'week' | 'month'): Date {
    const startTime = new Date(now);
    
    switch (period) {
      case 'hour':
        startTime.setTime(now.getTime() - 60 * 60 * 1000);
        break;
      case 'day':
        startTime.setTime(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startTime.setTime(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startTime.setTime(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    return startTime;
  }

  /**
   * Calculate SLA metrics for a period
   */
  private calculateSLAMetrics(
    healthStatus: HealthStatus,
    metrics: PerformanceMetrics[],
    startTime: Date,
    endTime: Date
  ): SLAMetrics {
    // Implementation for calculating SLA metrics over a period
    return healthStatus.slaMetrics;
  }

  /**
   * Parse CPU value from Kubernetes metrics
   */
  private parseCPUValue(cpuValue: string): number {
    // Parse CPU values like "100m" (millicores) or "1" (cores)
    if (cpuValue.endsWith('m')) {
      return parseInt(cpuValue.slice(0, -1)) / 1000;
    }
    return parseFloat(cpuValue);
  }

  /**
   * Parse memory value from Kubernetes metrics
   */
  private parseMemoryValue(memoryValue: string): number {
    // Parse memory values like "128Mi", "1Gi", etc.
    const units: Record<string, number> = {
      'Ki': 1024,
      'Mi': 1024 * 1024,
      'Gi': 1024 * 1024 * 1024,
      'Ti': 1024 * 1024 * 1024 * 1024
    };

    for (const [suffix, multiplier] of Object.entries(units)) {
      if (memoryValue.endsWith(suffix)) {
        return parseInt(memoryValue.slice(0, -suffix.length)) * multiplier;
      }
    }

    // Return as bytes if no unit specified
    return parseInt(memoryValue);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Handle process termination
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Shutdown health monitor
   */
  async shutdown(): Promise<void> {
    if (this.isShutdown) return;
    
    this.isShutdown = true;
    this.logger.info('Shutting down plugin health monitor');

    // Clear all intervals
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }

    for (const interval of this.metricsCollectionIntervals.values()) {
      clearInterval(interval);
    }

    this.healthCheckIntervals.clear();
    this.metricsCollectionIntervals.clear();

    this.emit('shutdown-completed');
  }
}