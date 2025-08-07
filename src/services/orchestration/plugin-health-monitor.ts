/**
 * Comprehensive Plugin Health Check Automation
 * Enterprise-grade health monitoring with multiple probe types (readiness, liveness, startup)
 * Supports Kubernetes-style probes with circuit breakers and automatic recovery
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getPluginServiceDiscovery, ServiceInstance } from './plugin-service-discovery';
import { 
  pluginStateMachineRegistry, 
  PluginLifecycleEvent, 
  PluginLifecycleState 
} from './plugin-lifecycle-state-machine';

// Health probe types following Kubernetes patterns
export enum ProbeType {
  STARTUP = 'startup',       // Initial startup check
  READINESS = 'readiness',   // Ready to serve traffic
  LIVENESS = 'liveness'      // Still alive and functioning
}

// Probe execution methods
export enum ProbeMethod {
  HTTP = 'http',
  TCP = 'tcp',
  GRPC = 'grpc',
  COMMAND = 'command',
  CUSTOM = 'custom'
}

// Health probe configuration
export const HealthProbeConfigSchema = z.object({
  name: z.string(),
  type: z.nativeEnum(ProbeType),
  method: z.nativeEnum(ProbeMethod),
  enabled: z.boolean().default(true),
  
  // HTTP probe configuration
  http: z.object({
    path: z.string().default('/health'),
    port: z.number().optional(),
    scheme: z.enum(['http', 'https']).default('http'),
    headers: z.record(z.string()).optional(),
    expectedStatusCodes: z.array(z.number()).default([200]),
    expectedBody: z.string().optional(),
    timeout: z.number().default(5000)
  }).optional(),
  
  // TCP probe configuration
  tcp: z.object({
    port: z.number(),
    timeout: z.number().default(3000)
  }).optional(),
  
  // gRPC probe configuration
  grpc: z.object({
    port: z.number(),
    service: z.string().optional(),
    timeout: z.number().default(5000)
  }).optional(),
  
  // Command probe configuration
  command: z.object({
    exec: z.array(z.string()),
    timeout: z.number().default(10000),
    workingDirectory: z.string().optional(),
    environment: z.record(z.string()).optional()
  }).optional(),
  
  // Custom probe function
  customProbe: z.function().args(z.any()).returns(z.promise(z.boolean())).optional(),
  
  // Timing configuration
  initialDelaySeconds: z.number().default(0),
  periodSeconds: z.number().default(10),
  timeoutSeconds: z.number().default(5),
  successThreshold: z.number().default(1),
  failureThreshold: z.number().default(3),
  
  // Circuit breaker configuration
  circuitBreaker: z.object({
    enabled: z.boolean().default(true),
    failureThreshold: z.number().default(5),
    recoveryTimeout: z.number().default(30000),
    halfOpenMaxCalls: z.number().default(3)
  }).optional(),
  
  // Retry configuration
  retryPolicy: z.object({
    maxRetries: z.number().default(3),
    retryDelay: z.number().default(1000),
    backoffMultiplier: z.number().default(2),
    maxRetryDelay: z.number().default(10000)
  }).optional()
});

export type HealthProbeConfig = z.infer<typeof HealthProbeConfigSchema>;

// Health check result
export interface HealthCheckResult {
  pluginId: string;
  serviceId: string;
  probeType: ProbeType;
  success: boolean;
  timestamp: Date;
  duration: number;
  details: {
    statusCode?: number;
    responseBody?: string;
    error?: string;
    metrics?: Record<string, number>;
  };
  attempt: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
}

// Circuit breaker states
export enum CircuitBreakerState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing, not allowing requests
  HALF_OPEN = 'half_open' // Testing if service recovered
}

// Circuit breaker instance
interface CircuitBreaker {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime: Date;
  nextAttemptTime: Date;
  halfOpenCalls: number;
}

// Health monitor configuration
export const HealthMonitorConfigSchema = z.object({
  enabled: z.boolean().default(true),
  globalHealthCheckInterval: z.number().default(30000),
  maxConcurrentChecks: z.number().default(50),
  enableCircuitBreakers: z.boolean().default(true),
  enableAutoRecovery: z.boolean().default(true),
  enableMetrics: z.boolean().default(true),
  enableAlerting: z.boolean().default(true),
  alertThresholds: z.object({
    errorRate: z.number().default(10), // percentage
    responseTime: z.number().default(5000), // milliseconds
    consecutiveFailures: z.number().default(5)
  }).optional(),
  retentionPeriod: z.number().default(86400000), // 24 hours
  cleanupInterval: z.number().default(3600000)   // 1 hour
});

export type HealthMonitorConfig = z.infer<typeof HealthMonitorConfigSchema>;

// Plugin health status
export interface PluginHealthStatus {
  pluginId: string;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  probeResults: Map<string, HealthCheckResult>;
  circuitBreakers: Map<string, CircuitBreaker>;
  metrics: {
    totalChecks: number;
    successRate: number;
    averageResponseTime: number;
    uptime: number;
    lastHealthyTime: Date;
    lastUnhealthyTime: Date;
  };
  lastUpdated: Date;
}

/**
 * Comprehensive Plugin Health Monitor
 * Implements Kubernetes-style health probes with circuit breakers and recovery
 */
export class PluginHealthMonitor extends EventEmitter {
  private config: HealthMonitorConfig;
  private httpClient: AxiosInstance;
  private pluginProbes: Map<string, HealthProbeConfig[]> = new Map();
  private pluginHealthStatus: Map<string, PluginHealthStatus> = new Map();
  private activeChecks: Map<string, Promise<HealthCheckResult>> = new Map();
  private healthHistory: Map<string, HealthCheckResult[]> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<HealthMonitorConfig>) {
    super();
    this.config = HealthMonitorConfigSchema.parse(config || {});
    this.initializeMonitor();
  }

  // Initialize health monitor
  private initializeMonitor(): void {
    // Initialize HTTP client for health checks
    this.httpClient = axios.create({
      timeout: 10000,
      validateStatus: () => true // Don't throw on HTTP errors
    });

    // Start global monitoring if enabled
    if (this.config.enabled) {
      this.startGlobalMonitoring();
    }

    // Start cleanup process
    this.startCleanupProcess();

    // Listen to service discovery events
    const serviceDiscovery = getPluginServiceDiscovery();
    serviceDiscovery.on('serviceRegistered', (service: ServiceInstance) => {
      this.onServiceRegistered(service);
    });

    serviceDiscovery.on('serviceDeregistered', (service: ServiceInstance) => {
      this.onServiceDeregistered(service);
    });
  }

  // Register health probes for a plugin
  async registerPluginProbes(pluginId: string, probes: HealthProbeConfig[]): Promise<void> {
    // Validate probes
    for (const probe of probes) {
      try {
        HealthProbeConfigSchema.parse(probe);
      } catch (error) {
        throw new Error(`Invalid probe configuration for ${probe.name}: ${error}`);
      }
    }

    this.pluginProbes.set(pluginId, probes);
    
    // Initialize health status
    if (!this.pluginHealthStatus.has(pluginId)) {
      this.initializePluginHealthStatus(pluginId);
    }

    // Start monitoring for this plugin
    this.startPluginMonitoring(pluginId);
    
    this.emit('probesRegistered', { pluginId, probes });
  }

  // Unregister health probes for a plugin
  async unregisterPluginProbes(pluginId: string): Promise<void> {
    this.pluginProbes.delete(pluginId);
    this.pluginHealthStatus.delete(pluginId);
    this.healthHistory.delete(pluginId);
    
    this.emit('probesUnregistered', { pluginId });
  }

  // Execute health check for a specific probe
  async executeHealthCheck(
    pluginId: string,
    probeName: string,
    serviceId?: string
  ): Promise<HealthCheckResult> {
    const probes = this.pluginProbes.get(pluginId);
    if (!probes) {
      throw new Error(`No probes registered for plugin ${pluginId}`);
    }

    const probe = probes.find(p => p.name === probeName);
    if (!probe) {
      throw new Error(`Probe ${probeName} not found for plugin ${pluginId}`);
    }

    if (!probe.enabled) {
      throw new Error(`Probe ${probeName} is disabled for plugin ${pluginId}`);
    }

    // Check circuit breaker
    if (this.config.enableCircuitBreakers) {
      const circuitBreaker = this.getCircuitBreaker(pluginId, probeName);
      if (!this.canExecuteCheck(circuitBreaker)) {
        throw new Error(`Circuit breaker is open for ${pluginId}:${probeName}`);
      }
    }

    const checkKey = `${pluginId}:${probeName}:${serviceId || 'default'}`;
    
    // Prevent concurrent checks for the same probe
    if (this.activeChecks.has(checkKey)) {
      return await this.activeChecks.get(checkKey)!;
    }

    // Create and store the check promise
    const checkPromise = this.executeProbeInternal(pluginId, probe, serviceId);
    this.activeChecks.set(checkKey, checkPromise);

    try {
      const result = await checkPromise;
      this.processHealthCheckResult(result);
      return result;
    } finally {
      this.activeChecks.delete(checkKey);
    }
  }

  // Get health status for a plugin
  getPluginHealthStatus(pluginId: string): PluginHealthStatus | null {
    return this.pluginHealthStatus.get(pluginId) || null;
  }

  // Get health status for all plugins
  getAllHealthStatuses(): Map<string, PluginHealthStatus> {
    return new Map(this.pluginHealthStatus);
  }

  // Get health history for a plugin
  getHealthHistory(pluginId: string, limit?: number): HealthCheckResult[] {
    const history = this.healthHistory.get(pluginId) || [];
    return limit ? history.slice(-limit) : [...history];
  }

  // Execute probe internally with retry logic
  private async executeProbeInternal(
    pluginId: string,
    probe: HealthProbeConfig,
    serviceId?: string
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const healthStatus = this.pluginHealthStatus.get(pluginId);
    const probeKey = `${probe.type}:${probe.name}`;
    const previousResult = healthStatus?.probeResults.get(probeKey);
    
    const baseResult: Partial<HealthCheckResult> = {
      pluginId,
      serviceId: serviceId || 'unknown',
      probeType: probe.type,
      timestamp: new Date(),
      consecutiveFailures: previousResult?.consecutiveFailures || 0,
      consecutiveSuccesses: previousResult?.consecutiveSuccesses || 0,
      attempt: 1
    };

    // Initial delay
    if (probe.initialDelaySeconds > 0) {
      await new Promise(resolve => setTimeout(resolve, probe.initialDelaySeconds * 1000));
    }

    let lastError: Error | null = null;
    const retryPolicy = probe.retryPolicy || { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2, maxRetryDelay: 10000 };

    // Execute with retry logic
    for (let attempt = 1; attempt <= retryPolicy.maxRetries; attempt++) {
      try {
        const success = await this.executeProbeMethod(pluginId, probe, serviceId);
        const duration = Date.now() - startTime;

        const result: HealthCheckResult = {
          ...baseResult,
          success,
          duration,
          attempt,
          consecutiveFailures: success ? 0 : (baseResult.consecutiveFailures! + 1),
          consecutiveSuccesses: success ? (baseResult.consecutiveSuccesses! + 1) : 0,
          details: {
            metrics: { duration, attempt }
          }
        } as HealthCheckResult;

        if (success || attempt === retryPolicy.maxRetries) {
          return result;
        }

      } catch (error) {
        lastError = error as Error;
        
        if (attempt < retryPolicy.maxRetries) {
          const delay = Math.min(
            retryPolicy.retryDelay * Math.pow(retryPolicy.backoffMultiplier, attempt - 1),
            retryPolicy.maxRetryDelay
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    const duration = Date.now() - startTime;
    return {
      ...baseResult,
      success: false,
      duration,
      attempt: retryPolicy.maxRetries,
      consecutiveFailures: baseResult.consecutiveFailures! + 1,
      consecutiveSuccesses: 0,
      details: {
        error: lastError?.message || 'Health check failed',
        metrics: { duration, attempts: retryPolicy.maxRetries }
      }
    } as HealthCheckResult;
  }

  // Execute probe method based on type
  private async executeProbeMethod(
    pluginId: string,
    probe: HealthProbeConfig,
    serviceId?: string
  ): Promise<boolean> {
    switch (probe.method) {
      case ProbeMethod.HTTP:
        return await this.executeHttpProbe(pluginId, probe, serviceId);
      case ProbeMethod.TCP:
        return await this.executeTcpProbe(pluginId, probe, serviceId);
      case ProbeMethod.GRPC:
        return await this.executeGrpcProbe(pluginId, probe, serviceId);
      case ProbeMethod.COMMAND:
        return await this.executeCommandProbe(pluginId, probe);
      case ProbeMethod.CUSTOM:
        return await this.executeCustomProbe(pluginId, probe);
      default:
        throw new Error(`Unsupported probe method: ${probe.method}`);
    }
  }

  // Execute HTTP probe
  private async executeHttpProbe(
    pluginId: string,
    probe: HealthProbeConfig,
    serviceId?: string
  ): Promise<boolean> {
    if (!probe.http) {
      throw new Error('HTTP probe configuration is required');
    }

    // Get service information
    const serviceDiscovery = getPluginServiceDiscovery();
    let targetService: ServiceInstance | null = null;

    if (serviceId) {
      targetService = serviceDiscovery.getService(serviceId);
    } else {
      const services = await serviceDiscovery.getPluginServices(pluginId);
      targetService = services.find(s => s.status === 'healthy') || services[0] || null;
    }

    if (!targetService) {
      throw new Error(`No service found for plugin ${pluginId}`);
    }

    const { host, port, protocol } = targetService.registration;
    const httpConfig = probe.http;
    const url = `${httpConfig.scheme || protocol}://${host}:${httpConfig.port || port}${httpConfig.path}`;

    try {
      const response = await this.httpClient.get(url, {
        headers: httpConfig.headers,
        timeout: httpConfig.timeout,
        signal: AbortSignal.timeout(httpConfig.timeout)
      });

      // Check status code
      const isValidStatus = httpConfig.expectedStatusCodes.includes(response.status);
      if (!isValidStatus) {
        return false;
      }

      // Check response body if expected
      if (httpConfig.expectedBody) {
        const bodyMatches = typeof response.data === 'string' 
          ? response.data.includes(httpConfig.expectedBody)
          : JSON.stringify(response.data).includes(httpConfig.expectedBody);
        
        if (!bodyMatches) {
          return false;
        }
      }

      return true;

    } catch (error) {
      return false;
    }
  }

  // Execute TCP probe
  private async executeTcpProbe(
    pluginId: string,
    probe: HealthProbeConfig,
    serviceId?: string
  ): Promise<boolean> {
    if (!probe.tcp) {
      throw new Error('TCP probe configuration is required');
    }

    // Get service information
    const serviceDiscovery = getPluginServiceDiscovery();
    let targetService: ServiceInstance | null = null;

    if (serviceId) {
      targetService = serviceDiscovery.getService(serviceId);
    } else {
      const services = await serviceDiscovery.getPluginServices(pluginId);
      targetService = services.find(s => s.status === 'healthy') || services[0] || null;
    }

    if (!targetService) {
      throw new Error(`No service found for plugin ${pluginId}`);
    }

    const { host } = targetService.registration;
    const { port, timeout } = probe.tcp;

    return new Promise<boolean>((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      
      let resolved = false;
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(false);
        }
      }, timeout);

      socket.on('connect', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          socket.destroy();
          resolve(true);
        }
      });

      socket.on('error', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          socket.destroy();
          resolve(false);
        }
      });

      socket.connect(port, host);
    });
  }

  // Execute gRPC probe (simplified implementation)
  private async executeGrpcProbe(
    pluginId: string,
    probe: HealthProbeConfig,
    serviceId?: string
  ): Promise<boolean> {
    if (!probe.grpc) {
      throw new Error('gRPC probe configuration is required');
    }

    // For now, fall back to TCP probe for gRPC services
    // In a full implementation, use gRPC health checking protocol
    const tcpProbe: HealthProbeConfig = {
      ...probe,
      method: ProbeMethod.TCP,
      tcp: {
        port: probe.grpc.port,
        timeout: probe.grpc.timeout
      }
    };

    return await this.executeTcpProbe(pluginId, tcpProbe, serviceId);
  }

  // Execute command probe
  private async executeCommandProbe(
    pluginId: string,
    probe: HealthProbeConfig
  ): Promise<boolean> {
    if (!probe.command) {
      throw new Error('Command probe configuration is required');
    }

    return new Promise<boolean>((resolve) => {
      const { spawn } = require('child_process');
      const { exec, timeout, workingDirectory, environment } = probe.command;

      const child = spawn(exec[0], exec.slice(1), {
        cwd: workingDirectory,
        env: { ...process.env, ...environment },
        timeout
      });

      child.on('close', (code: number) => {
        resolve(code === 0);
      });

      child.on('error', () => {
        resolve(false);
      });
    });
  }

  // Execute custom probe
  private async executeCustomProbe(
    pluginId: string,
    probe: HealthProbeConfig
  ): Promise<boolean> {
    if (!probe.customProbe) {
      throw new Error('Custom probe function is required');
    }

    try {
      return await probe.customProbe({ pluginId, probe });
    } catch (error) {
      return false;
    }
  }

  // Process health check result
  private processHealthCheckResult(result: HealthCheckResult): void {
    const { pluginId } = result;
    
    // Update plugin health status
    const healthStatus = this.pluginHealthStatus.get(pluginId);
    if (healthStatus) {
      const probeKey = `${result.probeType}:${result.probeType}`;
      healthStatus.probeResults.set(probeKey, result);
      healthStatus.lastUpdated = new Date();
      
      // Update metrics
      healthStatus.metrics.totalChecks++;
      if (result.success) {
        healthStatus.metrics.lastHealthyTime = result.timestamp;
      } else {
        healthStatus.metrics.lastUnhealthyTime = result.timestamp;
      }
      
      // Calculate success rate
      const allResults = Array.from(healthStatus.probeResults.values());
      const successCount = allResults.filter(r => r.success).length;
      healthStatus.metrics.successRate = (successCount / allResults.length) * 100;
      
      // Calculate average response time
      const totalTime = allResults.reduce((sum, r) => sum + r.duration, 0);
      healthStatus.metrics.averageResponseTime = totalTime / allResults.length;
      
      // Update overall status
      healthStatus.overallStatus = this.calculateOverallStatus(healthStatus);
      
      // Update circuit breaker
      if (this.config.enableCircuitBreakers) {
        this.updateCircuitBreaker(pluginId, result);
      }
    }
    
    // Store in history
    this.storeHealthResult(result);
    
    // Emit events
    this.emit('healthCheckCompleted', result);
    
    if (result.success) {
      this.emit('healthCheckPassed', result);
    } else {
      this.emit('healthCheckFailed', result);
      
      // Check if alerting is needed
      if (this.config.enableAlerting) {
        this.checkAlertConditions(result);
      }
    }
    
    // Trigger auto-recovery if needed
    if (this.config.enableAutoRecovery && !result.success) {
      this.triggerAutoRecovery(result);
    }
  }

  // Calculate overall status based on probe results
  private calculateOverallStatus(healthStatus: PluginHealthStatus): PluginHealthStatus['overallStatus'] {
    const results = Array.from(healthStatus.probeResults.values());
    
    if (results.length === 0) {
      return 'unknown';
    }
    
    // Check for liveness probe failures (critical)
    const livenessResults = results.filter(r => r.probeType === ProbeType.LIVENESS);
    if (livenessResults.some(r => !r.success)) {
      return 'unhealthy';
    }
    
    // Check startup probes
    const startupResults = results.filter(r => r.probeType === ProbeType.STARTUP);
    if (startupResults.length > 0 && startupResults.some(r => !r.success)) {
      return 'unhealthy';
    }
    
    // Check readiness probes
    const readinessResults = results.filter(r => r.probeType === ProbeType.READINESS);
    if (readinessResults.some(r => !r.success)) {
      return 'degraded';
    }
    
    // Check for partial failures
    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  // Get or create circuit breaker
  private getCircuitBreaker(pluginId: string, probeName: string): CircuitBreaker {
    const healthStatus = this.pluginHealthStatus.get(pluginId);
    if (!healthStatus) {
      throw new Error(`No health status found for plugin ${pluginId}`);
    }
    
    const key = probeName;
    let circuitBreaker = healthStatus.circuitBreakers.get(key);
    
    if (!circuitBreaker) {
      circuitBreaker = {
        state: CircuitBreakerState.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailureTime: new Date(0),
        nextAttemptTime: new Date(0),
        halfOpenCalls: 0
      };
      healthStatus.circuitBreakers.set(key, circuitBreaker);
    }
    
    return circuitBreaker;
  }

  // Check if health check can be executed based on circuit breaker
  private canExecuteCheck(circuitBreaker: CircuitBreaker): boolean {
    const now = new Date();
    
    switch (circuitBreaker.state) {
      case CircuitBreakerState.CLOSED:
        return true;
      
      case CircuitBreakerState.OPEN:
        return now >= circuitBreaker.nextAttemptTime;
      
      case CircuitBreakerState.HALF_OPEN:
        return circuitBreaker.halfOpenCalls < 3; // Max 3 calls in half-open state
      
      default:
        return false;
    }
  }

  // Update circuit breaker state
  private updateCircuitBreaker(pluginId: string, result: HealthCheckResult): void {
    const probe = this.pluginProbes.get(pluginId)?.find(p => p.type === result.probeType);
    if (!probe || !probe.circuitBreaker?.enabled) {
      return;
    }
    
    const circuitBreaker = this.getCircuitBreaker(pluginId, probe.name);
    const breakerConfig = probe.circuitBreaker!;
    
    if (result.success) {
      circuitBreaker.successCount++;
      
      if (circuitBreaker.state === CircuitBreakerState.HALF_OPEN) {
        // Successful call in half-open state
        if (circuitBreaker.successCount >= 3) {
          // Move to closed state
          circuitBreaker.state = CircuitBreakerState.CLOSED;
          circuitBreaker.failureCount = 0;
          circuitBreaker.halfOpenCalls = 0;
        }
      } else if (circuitBreaker.state === CircuitBreakerState.CLOSED) {
        // Reset failure count on success
        circuitBreaker.failureCount = 0;
      }
      
    } else {
      circuitBreaker.failureCount++;
      circuitBreaker.lastFailureTime = new Date();
      
      if (circuitBreaker.state === CircuitBreakerState.CLOSED) {
        // Check if we should open the circuit
        if (circuitBreaker.failureCount >= breakerConfig.failureThreshold) {
          circuitBreaker.state = CircuitBreakerState.OPEN;
          circuitBreaker.nextAttemptTime = new Date(Date.now() + breakerConfig.recoveryTimeout);
          this.emit('circuitBreakerOpened', { pluginId, probeName: probe.name });
        }
      } else if (circuitBreaker.state === CircuitBreakerState.HALF_OPEN) {
        // Failure in half-open state, go back to open
        circuitBreaker.state = CircuitBreakerState.OPEN;
        circuitBreaker.nextAttemptTime = new Date(Date.now() + breakerConfig.recoveryTimeout);
        circuitBreaker.halfOpenCalls = 0;
      }
    }
    
    // Check for state transitions
    if (circuitBreaker.state === CircuitBreakerState.OPEN && 
        new Date() >= circuitBreaker.nextAttemptTime) {
      circuitBreaker.state = CircuitBreakerState.HALF_OPEN;
      circuitBreaker.halfOpenCalls = 0;
      circuitBreaker.successCount = 0;
      this.emit('circuitBreakerHalfOpened', { pluginId, probeName: probe.name });
    }
  }

  // Store health result in history
  private storeHealthResult(result: HealthCheckResult): void {
    let history = this.healthHistory.get(result.pluginId);
    if (!history) {
      history = [];
      this.healthHistory.set(result.pluginId, history);
    }
    
    history.push(result);
    
    // Keep only recent history
    const maxHistoryLength = 1000;
    if (history.length > maxHistoryLength) {
      history.splice(0, history.length - maxHistoryLength);
    }
  }

  // Check alert conditions
  private checkAlertConditions(result: HealthCheckResult): void {
    if (!this.config.alertThresholds) {
      return;
    }
    
    const thresholds = this.config.alertThresholds;
    const healthStatus = this.pluginHealthStatus.get(result.pluginId);
    
    if (!healthStatus) {
      return;
    }
    
    // Check error rate
    if (healthStatus.metrics.successRate < (100 - thresholds.errorRate)) {
      this.emit('alertTriggered', {
        type: 'error_rate',
        pluginId: result.pluginId,
        value: healthStatus.metrics.successRate,
        threshold: 100 - thresholds.errorRate
      });
    }
    
    // Check response time
    if (healthStatus.metrics.averageResponseTime > thresholds.responseTime) {
      this.emit('alertTriggered', {
        type: 'response_time',
        pluginId: result.pluginId,
        value: healthStatus.metrics.averageResponseTime,
        threshold: thresholds.responseTime
      });
    }
    
    // Check consecutive failures
    if (result.consecutiveFailures >= thresholds.consecutiveFailures) {
      this.emit('alertTriggered', {
        type: 'consecutive_failures',
        pluginId: result.pluginId,
        value: result.consecutiveFailures,
        threshold: thresholds.consecutiveFailures
      });
    }
  }

  // Trigger auto-recovery
  private async triggerAutoRecovery(result: HealthCheckResult): Promise<void> {
    const { pluginId } = result;
    
    // Check if auto-recovery should be triggered
    if (result.consecutiveFailures >= 5) {
      try {
        const stateMachine = pluginStateMachineRegistry.getStateMachine(pluginId);
        
        // Attempt restart
        await stateMachine.transition(PluginLifecycleEvent.RESTART, {
          pluginId,
          version: '0.0.0',
          userId: 'health-monitor',
          timestamp: new Date(),
          metadata: { autoRecovery: true, reason: 'health_check_failure' }
        });
        
        this.emit('autoRecoveryTriggered', { pluginId, reason: 'health_check_failure' });
        
      } catch (error) {
        this.emit('autoRecoveryFailed', { pluginId, error });
      }
    }
  }

  // Initialize plugin health status
  private initializePluginHealthStatus(pluginId: string): void {
    const healthStatus: PluginHealthStatus = {
      pluginId,
      overallStatus: 'unknown',
      probeResults: new Map(),
      circuitBreakers: new Map(),
      metrics: {
        totalChecks: 0,
        successRate: 100,
        averageResponseTime: 0,
        uptime: 0,
        lastHealthyTime: new Date(),
        lastUnhealthyTime: new Date(0)
      },
      lastUpdated: new Date()
    };
    
    this.pluginHealthStatus.set(pluginId, healthStatus);
  }

  // Start global monitoring
  private startGlobalMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performGlobalHealthChecks();
    }, this.config.globalHealthCheckInterval);
  }

  // Perform global health checks
  private async performGlobalHealthChecks(): Promise<void> {
    const checkPromises: Promise<void>[] = [];
    
    for (const [pluginId, probes] of this.pluginProbes.entries()) {
      for (const probe of probes) {
        if (probe.enabled) {
          const promise = this.executeHealthCheck(pluginId, probe.name)
            .catch(error => {
              // Log error but don't fail the global check
              this.emit('healthCheckError', { pluginId, probeName: probe.name, error });
            });
          
          checkPromises.push(promise as Promise<void>);
          
          // Limit concurrent checks
          if (checkPromises.length >= this.config.maxConcurrentChecks) {
            await Promise.allSettled(checkPromises);
            checkPromises.length = 0;
          }
        }
      }
    }
    
    // Wait for remaining checks
    if (checkPromises.length > 0) {
      await Promise.allSettled(checkPromises);
    }
  }

  // Start plugin monitoring
  private async startPluginMonitoring(pluginId: string): Promise<void> {
    const probes = this.pluginProbes.get(pluginId);
    if (!probes) {
      return;
    }
    
    // Start individual probe monitoring
    for (const probe of probes) {
      if (probe.enabled && probe.periodSeconds > 0) {
        this.startProbeMonitoring(pluginId, probe);
      }
    }
  }

  // Start individual probe monitoring
  private startProbeMonitoring(pluginId: string, probe: HealthProbeConfig): void {
    const interval = setInterval(async () => {
      try {
        await this.executeHealthCheck(pluginId, probe.name);
      } catch (error) {
        this.emit('healthCheckError', { pluginId, probeName: probe.name, error });
      }
    }, probe.periodSeconds * 1000);
    
    // Store interval for cleanup
    const intervalKey = `${pluginId}:${probe.name}`;
    // In a full implementation, store intervals for proper cleanup
  }

  // Handle service registration
  private onServiceRegistered(service: ServiceInstance): void {
    const { pluginId } = service.registration;
    
    // If plugin doesn't have probes yet, create default ones
    if (!this.pluginProbes.has(pluginId)) {
      const defaultProbes = this.createDefaultProbes(service);
      this.registerPluginProbes(pluginId, defaultProbes);
    }
  }

  // Handle service deregistration
  private onServiceDeregistered(service: ServiceInstance): void {
    // Plugin health monitoring will be cleaned up when plugin is unregistered
  }

  // Create default health probes for a service
  private createDefaultProbes(service: ServiceInstance): HealthProbeConfig[] {
    const probes: HealthProbeConfig[] = [];
    const { registration } = service;
    
    // Default HTTP liveness probe
    if (registration.protocol === 'http' || registration.protocol === 'https') {
      probes.push({
        name: 'http-liveness',
        type: ProbeType.LIVENESS,
        method: ProbeMethod.HTTP,
        http: {
          path: '/health',
          port: registration.port,
          scheme: registration.protocol as 'http' | 'https',
          expectedStatusCodes: [200]
        },
        periodSeconds: 30,
        timeoutSeconds: 5,
        failureThreshold: 3
      });
      
      // Default HTTP readiness probe
      probes.push({
        name: 'http-readiness',
        type: ProbeType.READINESS,
        method: ProbeMethod.HTTP,
        http: {
          path: '/ready',
          port: registration.port,
          scheme: registration.protocol as 'http' | 'https',
          expectedStatusCodes: [200]
        },
        periodSeconds: 10,
        timeoutSeconds: 3,
        failureThreshold: 1
      });
    } else {
      // Default TCP probe for non-HTTP services
      probes.push({
        name: 'tcp-liveness',
        type: ProbeType.LIVENESS,
        method: ProbeMethod.TCP,
        tcp: {
          port: registration.port
        },
        periodSeconds: 30,
        timeoutSeconds: 3,
        failureThreshold: 3
      });
    }
    
    return probes;
  }

  // Start cleanup process
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  // Perform cleanup of old data
  private performCleanup(): void {
    const cutoffTime = new Date(Date.now() - this.config.retentionPeriod);
    
    // Clean up health history
    for (const [pluginId, history] of this.healthHistory.entries()) {
      const filtered = history.filter(result => result.timestamp > cutoffTime);
      if (filtered.length !== history.length) {
        this.healthHistory.set(pluginId, filtered);
      }
    }
  }

  // Get health monitor statistics
  getStatistics(): {
    totalPlugins: number;
    totalProbes: number;
    activeChecks: number;
    healthyPlugins: number;
    unhealthyPlugins: number;
    circuitBreakersOpen: number;
  } {
    let totalProbes = 0;
    let healthyPlugins = 0;
    let unhealthyPlugins = 0;
    let circuitBreakersOpen = 0;
    
    for (const probes of this.pluginProbes.values()) {
      totalProbes += probes.length;
    }
    
    for (const healthStatus of this.pluginHealthStatus.values()) {
      if (healthStatus.overallStatus === 'healthy') {
        healthyPlugins++;
      } else if (healthStatus.overallStatus === 'unhealthy') {
        unhealthyPlugins++;
      }
      
      for (const circuitBreaker of healthStatus.circuitBreakers.values()) {
        if (circuitBreaker.state === CircuitBreakerState.OPEN) {
          circuitBreakersOpen++;
        }
      }
    }
    
    return {
      totalPlugins: this.pluginProbes.size,
      totalProbes,
      activeChecks: this.activeChecks.size,
      healthyPlugins,
      unhealthyPlugins,
      circuitBreakersOpen
    };
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Wait for active checks to complete
    await Promise.allSettled(Array.from(this.activeChecks.values()));
    
    // Clean up resources
    this.pluginProbes.clear();
    this.pluginHealthStatus.clear();
    this.activeChecks.clear();
    this.healthHistory.clear();
    
    this.removeAllListeners();
    this.emit('shutdown');
  }
}

// Export singleton instance
let healthMonitorInstance: PluginHealthMonitor | null = null;

export function getPluginHealthMonitor(config?: Partial<HealthMonitorConfig>): PluginHealthMonitor {
  if (!healthMonitorInstance) {
    healthMonitorInstance = new PluginHealthMonitor(config);
  }
  return healthMonitorInstance;
}