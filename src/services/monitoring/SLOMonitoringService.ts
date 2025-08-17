/**
 * Advanced SLO Monitoring Service
 * Enterprise-grade monitoring with automated rollback triggers and circuit breaker patterns
 */

import { EventEmitter } from 'events';
import { getSafePrismaClient } from '@/lib/db/safe-client';

// SLO Definition Types
export interface ServiceLevelObjective {
  id: string;
  name: string;
  description: string;
  target: number; // percentage (e.g., 99.9 for 99.9%)
  metric: SLOMetric;
  window: TimeWindow;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  tags: Record<string, string>;
}

export interface SLOMetric {
  type: 'availability' | 'latency' | 'error_rate' | 'throughput' | 'custom';
  query: string;
  aggregation: 'avg' | 'sum' | 'max' | 'min' | 'p50' | 'p95' | 'p99' | 'p999';
  threshold: {
    warning: number;
    critical: number;
  };
  unit: string;
}

export interface TimeWindow {
  duration: number; // minutes
  type: 'rolling' | 'calendar';
  burnRate: number; // multiplier for error budget consumption
}

// SLO Status Types
export interface SLOStatus {
  slo: ServiceLevelObjective;
  currentValue: number;
  target: number;
  errorBudget: number;
  errorBudgetRemaining: number;
  burnRate: number;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  violations: SLOViolation[];
  lastUpdated: Date;
}

export interface SLOViolation {
  id: string;
  sloId: string;
  deploymentId?: string;
  pluginId?: string;
  severity: 'warning' | 'critical';
  value: number;
  threshold: number;
  startTime: Date;
  endTime?: Date;
  duration: number; // seconds
  resolved: boolean;
  actionsTaken: string[];
}

// Circuit Breaker Types
export interface CircuitBreakerConfig {
  failureThreshold: number; // number of failures to trip
  timeoutDuration: number; // seconds to wait before retry
  monitoringWindow: number; // minutes to track failures
  halfOpenMaxCalls: number; // max calls in half-open state
}

export enum CircuitBreakerState {
  CLOSED = 'closed', // Normal operation
  OPEN = 'open',     // Blocking calls
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export interface CircuitBreaker {
  id: string;
  pluginId: string;
  deploymentId?: string;
  state: CircuitBreakerState;
  config: CircuitBreakerConfig;
  failureCount: number;
  lastFailureTime?: Date;
  lastStateChange: Date;
  halfOpenCalls: number;
}

// Alert Types
export interface SLOAlert {
  id: string;
  sloId: string;
  violationId: string;
  severity: 'warning' | 'critical';
  title: string;
  description: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
  channels: AlertChannel[];
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'pagerduty';
  endpoint: string;
  config: Record<string, any>;
}

// Metrics Collection
export interface MetricsCollector {
  name: string;
  type: 'prometheus' | 'datadog' | 'cloudwatch' | 'custom';
  config: Record<string, any>;
  enabled: boolean;
}

export class SLOMonitoringService extends EventEmitter {
  private prisma = getSafePrismaClient();
  private slos = new Map<string, ServiceLevelObjective>();
  private sloStatuses = new Map<string, SLOStatus>();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private collectors: MetricsCollector[] = [];

  constructor() {
    super();
    this.initializeService();
  }

  private async initializeService() {
    console.log('Initializing SLO Monitoring Service...');
    
    // Load SLOs from configuration
    await this.loadSLOsFromConfig();
    
    // Initialize default collectors
    this.initializeMetricsCollectors();
    
    // Start monitoring loop
    this.startMonitoring();
    
    this.emit('service_initialized');
  }

  /**
   * SLO Management
   */
  async createSLO(slo: Omit<ServiceLevelObjective, 'id'>): Promise<ServiceLevelObjective> {
    const newSLO: ServiceLevelObjective = {
      id: `slo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...slo
    };

    this.slos.set(newSLO.id, newSLO);
    await this.persistSLO(newSLO);

    // Initialize status tracking
    this.sloStatuses.set(newSLO.id, {
      slo: newSLO,
      currentValue: 0,
      target: newSLO.target,
      errorBudget: 100 - newSLO.target,
      errorBudgetRemaining: 100 - newSLO.target,
      burnRate: 0,
      status: 'unknown',
      violations: [],
      lastUpdated: new Date()
    });

    this.emit('slo_created', newSLO);
    return newSLO;
  }

  async updateSLO(id: string, updates: Partial<ServiceLevelObjective>): Promise<ServiceLevelObjective | null> {
    const existingSLO = this.slos.get(id);
    if (!existingSLO) return null;

    const updatedSLO = { ...existingSLO, ...updates };
    this.slos.set(id, updatedSLO);
    await this.persistSLO(updatedSLO);

    this.emit('slo_updated', updatedSLO);
    return updatedSLO;
  }

  async deleteSLO(id: string): Promise<boolean> {
    if (!this.slos.has(id)) return false;

    this.slos.delete(id);
    this.sloStatuses.delete(id);
    await this.removeSLOFromStorage(id);

    this.emit('slo_deleted', id);
    return true;
  }

  getSLO(id: string): ServiceLevelObjective | null {
    return this.slos.get(id) || null;
  }

  getAllSLOs(): ServiceLevelObjective[] {
    return Array.from(this.slos.values());
  }

  getSLOStatus(id: string): SLOStatus | null {
    return this.sloStatuses.get(id) || null;
  }

  getAllSLOStatuses(): SLOStatus[] {
    return Array.from(this.sloStatuses.values());
  }

  /**
   * Circuit Breaker Management
   */
  createCircuitBreaker(
    pluginId: string, 
    config: CircuitBreakerConfig,
    deploymentId?: string
  ): CircuitBreaker {
    const breakerId = `cb_${pluginId}_${Date.now()}`;
    
    const circuitBreaker: CircuitBreaker = {
      id: breakerId,
      pluginId,
      deploymentId,
      state: CircuitBreakerState.CLOSED,
      config,
      failureCount: 0,
      lastStateChange: new Date(),
      halfOpenCalls: 0
    };

    this.circuitBreakers.set(breakerId, circuitBreaker);
    this.emit('circuit_breaker_created', circuitBreaker);
    
    return circuitBreaker;
  }

  async recordFailure(pluginId: string, error: Error, deploymentId?: string): Promise<void> {
    // Find circuit breaker for this plugin
    const breaker = Array.from(this.circuitBreakers.values())
      .find(cb => cb.pluginId === pluginId && 
                 (!deploymentId || cb.deploymentId === deploymentId));

    if (!breaker) return;

    breaker.failureCount++;
    breaker.lastFailureTime = new Date();

    // Check if we should trip the circuit breaker
    if (breaker.state === CircuitBreakerState.CLOSED && 
        breaker.failureCount >= breaker.config.failureThreshold) {
      await this.tripCircuitBreaker(breaker.id);
    }

    // Check SLO violations
    await this.checkSLOViolationsForPlugin(pluginId, deploymentId);
  }

  async recordSuccess(pluginId: string, deploymentId?: string): Promise<void> {
    const breaker = Array.from(this.circuitBreakers.values())
      .find(cb => cb.pluginId === pluginId && 
                 (!deploymentId || cb.deploymentId === deploymentId));

    if (!breaker) return;

    if (breaker.state === CircuitBreakerState.HALF_OPEN) {
      breaker.halfOpenCalls++;
      
      // Reset to closed if enough successful calls
      if (breaker.halfOpenCalls >= breaker.config.halfOpenMaxCalls) {
        await this.closeCircuitBreaker(breaker.id);
      }
    }
  }

  private async tripCircuitBreaker(breakerId: string): Promise<void> {
    const breaker = this.circuitBreakers.get(breakerId);
    if (!breaker) return;

    breaker.state = CircuitBreakerState.OPEN;
    breaker.lastStateChange = new Date();

    this.emit('circuit_breaker_tripped', breaker);
    
    // Schedule automatic retry
    setTimeout(() => {
      this.moveToHalfOpen(breakerId);
    }, breaker.config.timeoutDuration * 1000);

    // Trigger automatic rollback if this is a deployment
    if (breaker.deploymentId) {
      await this.triggerAutomaticRollback(
        breaker.deploymentId, 
        `Circuit breaker tripped: ${breaker.failureCount} failures`
      );
    }
  }

  private async moveToHalfOpen(breakerId: string): Promise<void> {
    const breaker = this.circuitBreakers.get(breakerId);
    if (!breaker || breaker.state !== CircuitBreakerState.OPEN) return;

    breaker.state = CircuitBreakerState.HALF_OPEN;
    breaker.halfOpenCalls = 0;
    breaker.lastStateChange = new Date();

    this.emit('circuit_breaker_half_open', breaker);
  }

  private async closeCircuitBreaker(breakerId: string): Promise<void> {
    const breaker = this.circuitBreakers.get(breakerId);
    if (!breaker) return;

    breaker.state = CircuitBreakerState.CLOSED;
    breaker.failureCount = 0;
    breaker.halfOpenCalls = 0;
    breaker.lastStateChange = new Date();
    breaker.lastFailureTime = undefined;

    this.emit('circuit_breaker_closed', breaker);
  }

  /**
   * SLO Monitoring and Violation Detection
   */
  private async startMonitoring(): Promise<void> {
    const monitoringInterval = 30000; // 30 seconds

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkAllSLOs();
      } catch (error) {
        console.error('SLO monitoring error:', error);
        this.emit('monitoring_error', error);
      }
    }, monitoringInterval);

    console.log(`SLO monitoring started with ${monitoringInterval}ms interval`);
  }

  private async checkAllSLOs(): Promise<void> {
    for (const slo of this.slos.values()) {
      if (!slo.enabled) continue;
      
      try {
        await this.checkSLO(slo.id);
      } catch (error) {
        console.error(`Failed to check SLO ${slo.id}:`, error);
      }
    }
  }

  private async checkSLO(sloId: string): Promise<void> {
    const slo = this.slos.get(sloId);
    const status = this.sloStatuses.get(sloId);
    
    if (!slo || !status) return;

    // Collect current metric value
    const currentValue = await this.collectMetricValue(slo);
    
    // Update status
    status.currentValue = currentValue;
    status.lastUpdated = new Date();
    
    // Calculate error budget
    const errorBudget = 100 - slo.target;
    const errorBudgetUsed = Math.max(0, currentValue - slo.target);
    status.errorBudgetRemaining = Math.max(0, errorBudget - errorBudgetUsed);
    
    // Calculate burn rate
    status.burnRate = errorBudgetUsed / errorBudget;

    // Determine status
    const previousStatus = status.status;
    if (currentValue >= slo.metric.threshold.critical) {
      status.status = 'critical';
    } else if (currentValue >= slo.metric.threshold.warning) {
      status.status = 'warning';
    } else {
      status.status = 'healthy';
    }

    // Check for violations
    if (status.status !== 'healthy' && previousStatus === 'healthy') {
      await this.createSLOViolation(slo, currentValue);
    } else if (status.status === 'healthy' && previousStatus !== 'healthy') {
      await this.resolveSLOViolations(sloId);
    }

    this.emit('slo_status_updated', status);
  }

  private async collectMetricValue(slo: ServiceLevelObjective): Promise<number> {
    // Mock metric collection - in production would integrate with Prometheus, DataDog, etc.
    switch (slo.metric.type) {
      case 'availability':
        return 99.5 + Math.random() * 0.4; // 99.5-99.9%
        
      case 'latency':
        return 50 + Math.random() * 100; // 50-150ms
        
      case 'error_rate':
        return Math.random() * 2; // 0-2%
        
      case 'throughput':
        return 1000 + Math.random() * 500; // 1000-1500 req/min
        
      default:
        return Math.random() * 100;
    }
  }

  private async createSLOViolation(slo: ServiceLevelObjective, value: number): Promise<void> {
    const violation: SLOViolation = {
      id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sloId: slo.id,
      severity: value >= slo.metric.threshold.critical ? 'critical' : 'warning',
      value,
      threshold: value >= slo.metric.threshold.critical ? 
        slo.metric.threshold.critical : slo.metric.threshold.warning,
      startTime: new Date(),
      duration: 0,
      resolved: false,
      actionsTaken: []
    };

    const status = this.sloStatuses.get(slo.id);
    if (status) {
      status.violations.push(violation);
    }

    // Create alert
    await this.createSLOAlert(violation);

    // Trigger automatic actions
    await this.handleSLOViolation(violation);

    this.emit('slo_violation_created', violation);
  }

  private async resolveSLOViolations(sloId: string): Promise<void> {
    const status = this.sloStatuses.get(sloId);
    if (!status) return;

    const unresolvedViolations = status.violations.filter(v => !v.resolved);
    const now = new Date();

    for (const violation of unresolvedViolations) {
      violation.resolved = true;
      violation.endTime = now;
      violation.duration = (now.getTime() - violation.startTime.getTime()) / 1000;
      
      this.emit('slo_violation_resolved', violation);
    }
  }

  private async checkSLOViolationsForPlugin(pluginId: string, deploymentId?: string): Promise<void> {
    // Check all SLOs that might be affected by this plugin
    const relevantSLOs = Array.from(this.slos.values()).filter(slo => 
      slo.tags.pluginId === pluginId || 
      slo.tags.deploymentId === deploymentId
    );

    for (const slo of relevantSLOs) {
      await this.checkSLO(slo.id);
    }
  }

  private async handleSLOViolation(violation: SLOViolation): Promise<void> {
    const slo = this.slos.get(violation.sloId);
    if (!slo) return;

    const actions: string[] = [];

    // Automatic rollback for critical violations on deployments
    if (violation.severity === 'critical' && violation.deploymentId) {
      await this.triggerAutomaticRollback(
        violation.deploymentId,
        `Critical SLO violation: ${slo.name} (${violation.value.toFixed(2)})`
      );
      actions.push('automatic_rollback_triggered');
    }

    // Scale down traffic for warning violations
    if (violation.severity === 'warning' && violation.deploymentId) {
      await this.reduceCanaryTraffic(violation.deploymentId, 50); // Reduce by 50%
      actions.push('canary_traffic_reduced');
    }

    violation.actionsTaken = actions;
  }

  /**
   * Integration with Deployment Controller
   */
  private async triggerAutomaticRollback(deploymentId: string, reason: string): Promise<void> {
    try {
      // This would integrate with the CanaryDeploymentController
      const response = await fetch('/api/plugins/canary-deployment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deploymentId,
          action: 'rollback',
          reason,
          automated: true
        }),
      });

      if (response.ok) {
        console.log(`Automatic rollback triggered for deployment ${deploymentId}: ${reason}`);
        this.emit('automatic_rollback_triggered', { deploymentId, reason });
      }
    } catch (error) {
      console.error('Failed to trigger automatic rollback:', error);
    }
  }

  private async reduceCanaryTraffic(deploymentId: string, reductionPercentage: number): Promise<void> {
    // This would integrate with traffic routing system
    console.log(`Reducing canary traffic for deployment ${deploymentId} by ${reductionPercentage}%`);
    this.emit('canary_traffic_reduced', { deploymentId, reductionPercentage });
  }

  /**
   * Alerting System
   */
  private async createSLOAlert(violation: SLOViolation): Promise<void> {
    const slo = this.slos.get(violation.sloId);
    if (!slo) return;

    const alert: SLOAlert = {
      id: `alert_${violation.id}`,
      sloId: violation.sloId,
      violationId: violation.id,
      severity: violation.severity,
      title: `SLO Violation: ${slo.name}`,
      description: `${slo.name} has exceeded ${violation.severity} threshold. Current value: ${violation.value.toFixed(2)}, Threshold: ${violation.threshold}`,
      timestamp: new Date(),
      acknowledged: false,
      resolved: false,
      channels: this.getAlertChannelsForSLO(slo)
    };

    await this.sendAlert(alert);
    this.emit('slo_alert_created', alert);
  }

  private getAlertChannelsForSLO(slo: ServiceLevelObjective): AlertChannel[] {
    // Mock alert channels - would be configurable
    return [
      {
        type: 'slack',
        endpoint: '#platform-alerts',
        config: { webhook: 'https://hooks.slack.com/services/...' }
      },
      {
        type: 'email',
        endpoint: 'platform-team@company.com',
        config: {}
      }
    ];
  }

  private async sendAlert(alert: SLOAlert): Promise<void> {
    console.log(`🚨 SLO Alert: ${alert.title} - ${alert.description}`);
    
    // In production, would integrate with actual alerting systems
    for (const channel of alert.channels) {
      switch (channel.type) {
        case 'slack':
          await this.sendSlackAlert(alert, channel);
          break;
        case 'email':
          await this.sendEmailAlert(alert, channel);
          break;
        case 'webhook':
          await this.sendWebhookAlert(alert, channel);
          break;
      }
    }
  }

  private async sendSlackAlert(alert: SLOAlert, channel: AlertChannel): Promise<void> {
    // Mock Slack integration
    console.log(`📱 Slack alert sent to ${channel.endpoint}: ${alert.title}`);
  }

  private async sendEmailAlert(alert: SLOAlert, channel: AlertChannel): Promise<void> {
    // Mock email integration
    console.log(`📧 Email alert sent to ${channel.endpoint}: ${alert.title}`);
  }

  private async sendWebhookAlert(alert: SLOAlert, channel: AlertChannel): Promise<void> {
    // Mock webhook integration
    console.log(`🔗 Webhook alert sent to ${channel.endpoint}: ${alert.title}`);
  }

  /**
   * Configuration and Setup
   */
  private async loadSLOsFromConfig(): Promise<void> {
    // Default SLOs for plugin deployments
    const defaultSLOs: Omit<ServiceLevelObjective, 'id'>[] = [
      {
        name: 'Plugin Availability',
        description: 'Plugin must be available 99.9% of the time',
        target: 99.9,
        metric: {
          type: 'availability',
          query: 'up{job="plugin"}',
          aggregation: 'avg',
          threshold: { warning: 99.5, critical: 99.0 },
          unit: '%'
        },
        window: { duration: 60, type: 'rolling', burnRate: 1.0 },
        severity: 'critical',
        enabled: true,
        tags: {}
      },
      {
        name: 'Plugin Response Time',
        description: 'Plugin response time should be under 500ms (p95)',
        target: 500,
        metric: {
          type: 'latency',
          query: 'histogram_quantile(0.95, plugin_response_time_seconds)',
          aggregation: 'p95',
          threshold: { warning: 800, critical: 1000 },
          unit: 'ms'
        },
        window: { duration: 30, type: 'rolling', burnRate: 2.0 },
        severity: 'warning',
        enabled: true,
        tags: {}
      },
      {
        name: 'Plugin Error Rate',
        description: 'Plugin error rate should be under 1%',
        target: 1,
        metric: {
          type: 'error_rate',
          query: 'sum(rate(plugin_errors_total[5m])) / sum(rate(plugin_requests_total[5m])) * 100',
          aggregation: 'avg',
          threshold: { warning: 2, critical: 5 },
          unit: '%'
        },
        window: { duration: 15, type: 'rolling', burnRate: 3.0 },
        severity: 'critical',
        enabled: true,
        tags: {}
      }
    ];

    for (const sloConfig of defaultSLOs) {
      await this.createSLO(sloConfig);
    }
  }

  private initializeMetricsCollectors(): void {
    this.collectors = [
      {
        name: 'prometheus',
        type: 'prometheus',
        config: { endpoint: 'http://prometheus:9090' },
        enabled: true
      },
      {
        name: 'application_metrics',
        type: 'custom',
        config: { source: 'internal' },
        enabled: true
      }
    ];
  }

  /**
   * Storage Operations
   */
  private async persistSLO(slo: ServiceLevelObjective): Promise<void> {
    // In production, would save to database
    console.log(`Persisting SLO: ${slo.name}`);
  }

  private async removeSLOFromStorage(id: string): Promise<void> {
    // In production, would remove from database
    console.log(`Removing SLO: ${id}`);
  }

  /**
   * Public API
   */
  async getHealthDashboard() {
    const sloStatuses = this.getAllSLOStatuses();
    const circuitBreakers = Array.from(this.circuitBreakers.values());
    
    return {
      slos: sloStatuses.map(status => ({
        id: status.slo.id,
        name: status.slo.name,
        target: status.target,
        current: status.currentValue,
        status: status.status,
        errorBudget: status.errorBudgetRemaining,
        violations: status.violations.length
      })),
      circuitBreakers: circuitBreakers.map(cb => ({
        id: cb.id,
        pluginId: cb.pluginId,
        state: cb.state,
        failureCount: cb.failureCount
      })),
      overall: {
        healthy: sloStatuses.filter(s => s.status === 'healthy').length,
        warning: sloStatuses.filter(s => s.status === 'warning').length,
        critical: sloStatuses.filter(s => s.status === 'critical').length,
        total: sloStatuses.length
      }
    };
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('SLO Monitoring Service stopped');
  }
}

export default SLOMonitoringService;