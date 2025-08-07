import { KubernetesApi } from '@kubernetes/client-node';
import { EventEmitter } from 'events';
import { ProgressiveDeployment, MetricResult } from './types';

export class RollbackManager extends EventEmitter {
  private k8sApi: KubernetesApi;
  private activeMonitors = new Map<string, NodeJS.Timeout>();
  private rollbackThresholds: Map<string, RollbackConfig> = new Map();

  constructor(k8sApi: KubernetesApi) {
    super();
    this.k8sApi = k8sApi;
  }

  async initialize(deployment: ProgressiveDeployment): Promise<void> {
    const config = this.createRollbackConfig(deployment);
    this.rollbackThresholds.set(deployment.id, config);
    
    if (deployment.config.rollback.automatic) {
      await this.startAutomaticMonitoring(deployment);
    }
    
    this.emit('rollbackInitialized', { deployment, config });
  }

  async performRollback(deployment: ProgressiveDeployment, reason?: string): Promise<void> {
    this.emit('rollbackStarted', { deployment, reason });
    
    try {
      // Stop monitoring during rollback
      await this.stopMonitoring(deployment.id);
      
      // Execute rollback based on deployment strategy
      await this.executeRollback(deployment, reason);
      
      // Update deployment status
      deployment.status = 'failed';
      deployment.metadata.rollbackReason = reason;
      deployment.metadata.rolledBackAt = new Date().toISOString();
      
      this.emit('rollbackCompleted', { deployment, reason });
      
    } catch (error) {
      this.emit('rollbackFailed', { deployment, error, reason });
      throw error;
    }
  }

  async checkRollbackConditions(deployment: ProgressiveDeployment, metrics: MetricResult[]): Promise<{
    shouldRollback: boolean;
    reason?: string;
    triggeredMetric?: MetricResult;
  }> {
    const config = this.rollbackThresholds.get(deployment.id);
    if (!config) {
      return { shouldRollback: false };
    }

    // Check error rate threshold (primary condition)
    const errorRateMetric = metrics.find(m => 
      m.name.toLowerCase().includes('error_rate') || 
      m.name.toLowerCase().includes('error_ratio')
    );
    
    if (errorRateMetric && errorRateMetric.value > config.errorRateThreshold) {
      return {
        shouldRollback: true,
        reason: `Error rate ${(errorRateMetric.value * 100).toFixed(2)}% exceeds threshold ${(config.errorRateThreshold * 100).toFixed(2)}%`,
        triggeredMetric: errorRateMetric
      };
    }

    // Check latency thresholds
    const latencyMetric = metrics.find(m => 
      m.name.toLowerCase().includes('latency') || 
      m.name.toLowerCase().includes('response_time') ||
      m.name.toLowerCase().includes('duration')
    );
    
    if (latencyMetric && latencyMetric.value > config.latencyThreshold) {
      return {
        shouldRollback: true,
        reason: `Latency ${latencyMetric.value}ms exceeds threshold ${config.latencyThreshold}ms`,
        triggeredMetric: latencyMetric
      };
    }

    // Check availability threshold
    const availabilityMetric = metrics.find(m => 
      m.name.toLowerCase().includes('availability') || 
      m.name.toLowerCase().includes('uptime')
    );
    
    if (availabilityMetric && availabilityMetric.value < config.availabilityThreshold) {
      return {
        shouldRollback: true,
        reason: `Availability ${(availabilityMetric.value * 100).toFixed(2)}% below threshold ${(config.availabilityThreshold * 100).toFixed(2)}%`,
        triggeredMetric: availabilityMetric
      };
    }

    // Check custom SLI/SLO violations
    for (const sli of config.customSLIs) {
      const metric = metrics.find(m => m.name === sli.metricName);
      if (metric) {
        const violatesThreshold = this.checkSLIViolation(metric, sli);
        if (violatesThreshold) {
          return {
            shouldRollback: true,
            reason: `SLI ${sli.metricName} violation: ${metric.value} ${sli.operator} ${sli.threshold}`,
            triggeredMetric: metric
          };
        }
      }
    }

    // Check consecutive failures
    const consecutiveFailures = this.getConsecutiveFailures(deployment.id, metrics);
    if (consecutiveFailures >= config.consecutiveFailureLimit) {
      return {
        shouldRollback: true,
        reason: `Consecutive failures (${consecutiveFailures}) exceeded limit (${config.consecutiveFailureLimit})`
      };
    }

    return { shouldRollback: false };
  }

  async triggerEmergencyRollback(deployment: ProgressiveDeployment, reason: string): Promise<void> {
    this.emit('emergencyRollback', { deployment, reason });
    
    // Immediate rollback without waiting for normal rollback procedures
    await this.performRollback(deployment, `EMERGENCY: ${reason}`);
  }

  async pauseAutomaticRollback(deploymentId: string): Promise<void> {
    const timer = this.activeMonitors.get(deploymentId);
    if (timer) {
      clearInterval(timer);
      this.activeMonitors.delete(deploymentId);
    }
    
    this.emit('automaticRollbackPaused', { deploymentId });
  }

  async resumeAutomaticRollback(deployment: ProgressiveDeployment): Promise<void> {
    await this.startAutomaticMonitoring(deployment);
    this.emit('automaticRollbackResumed', { deployment });
  }

  async stopMonitoring(deploymentId: string): Promise<void> {
    const timer = this.activeMonitors.get(deploymentId);
    if (timer) {
      clearInterval(timer);
      this.activeMonitors.delete(deploymentId);
    }
    
    this.rollbackThresholds.delete(deploymentId);
    this.emit('monitoringStopped', { deploymentId });
  }

  getRollbackHistory(deploymentId: string): RollbackHistoryEntry[] {
    // In a real implementation, this would query from a database
    return [];
  }

  private createRollbackConfig(deployment: ProgressiveDeployment): RollbackConfig {
    const config = deployment.config;
    
    return {
      errorRateThreshold: config.rollback.threshold || 0.01, // 1% default
      latencyThreshold: 5000, // 5 seconds default
      availabilityThreshold: 0.99, // 99% uptime
      consecutiveFailureLimit: 3,
      timeWindowMinutes: 5,
      customSLIs: config.analysis.metrics.map(metric => ({
        metricName: metric.name,
        threshold: metric.threshold,
        operator: metric.comparison,
        windowMinutes: 5
      })),
      automaticRollback: config.rollback.automatic,
      rollbackTimeout: this.parseTimeout(config.rollback.timeout || '5m')
    };
  }

  private async startAutomaticMonitoring(deployment: ProgressiveDeployment): Promise<void> {
    const config = this.rollbackThresholds.get(deployment.id);
    if (!config || !config.automaticRollback) {
      return;
    }

    // Check every 30 seconds
    const interval = setInterval(async () => {
      try {
        await this.checkAndTriggerRollback(deployment);
      } catch (error) {
        this.emit('monitoringError', { deployment, error });
      }
    }, 30000);

    this.activeMonitors.set(deployment.id, interval);
  }

  private async checkAndTriggerRollback(deployment: ProgressiveDeployment): Promise<void> {
    // Skip if deployment is not running
    if (deployment.status !== 'running') {
      return;
    }

    // Get current metrics from monitoring system
    const metrics = await this.getCurrentMetrics(deployment);
    
    const rollbackCheck = await this.checkRollbackConditions(deployment, metrics);
    
    if (rollbackCheck.shouldRollback) {
      await this.performRollback(deployment, rollbackCheck.reason);
    }
  }

  private async getCurrentMetrics(deployment: ProgressiveDeployment): Promise<MetricResult[]> {
    // This would integrate with your monitoring system (Prometheus, Datadog, etc.)
    // For now, return mock metrics
    return [
      {
        name: 'error_rate',
        value: Math.random() * 0.02, // 0-2% error rate
        threshold: 0.01,
        status: 'success',
        timestamp: new Date()
      },
      {
        name: 'response_time_p99',
        value: Math.random() * 3000 + 500, // 500-3500ms
        threshold: 2000,
        status: 'success',
        timestamp: new Date()
      },
      {
        name: 'availability',
        value: 0.999 - (Math.random() * 0.01), // 99-99.9%
        threshold: 0.99,
        status: 'success',
        timestamp: new Date()
      }
    ];
  }

  private async executeRollback(deployment: ProgressiveDeployment, reason?: string): Promise<void> {
    const { strategy } = deployment.config;
    
    switch (strategy) {
      case 'canary':
        await this.rollbackCanary(deployment);
        break;
      case 'blue-green':
        await this.rollbackBlueGreen(deployment);
        break;
      case 'feature-flag':
        await this.rollbackFeatureFlag(deployment);
        break;
      case 'ab-testing':
        await this.rollbackABTest(deployment);
        break;
      default:
        throw new Error(`Unsupported rollback strategy: ${strategy}`);
    }
    
    // Record rollback event
    await this.recordRollbackEvent(deployment, reason);
  }

  private async rollbackCanary(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Route all traffic back to stable version
    await this.updateIstioTrafficRouting(deployment, {
      stable: 100,
      canary: 0
    });
    
    // Scale down canary deployment
    if (deployment.metadata.canaryDeployment) {
      await this.k8sApi.scaleDeployment(
        service.namespace,
        deployment.metadata.canaryDeployment,
        0
      );
    }
    
    // Delete canary resources if using Flagger/Argo
    if (process.env.FLAGGER_ENABLED === 'true') {
      await this.k8sApi.deleteCustomResource(
        'flagger.app/v1beta1',
        'canaries',
        service.namespace,
        service.name
      );
    } else if (process.env.ARGO_ROLLOUTS_ENABLED === 'true') {
      await this.k8sApi.patchCustomResource(
        'argoproj.io/v1alpha1',
        'rollouts',
        service.namespace,
        service.name,
        {
          spec: {
            abort: true
          }
        }
      );
    }
  }

  private async rollbackBlueGreen(deployment: ProgressiveDeployment): Promise<void> {
    const { service } = deployment.config;
    
    // Route all traffic back to blue (stable)
    await this.updateIstioTrafficRouting(deployment, {
      stable: 100,
      canary: 0
    });
    
    // Delete green deployment
    await this.k8sApi.deleteDeployment(service.namespace, `${service.name}-green`);
    await this.k8sApi.deleteService(service.namespace, `${service.name}-green`);
  }

  private async rollbackFeatureFlag(deployment: ProgressiveDeployment): Promise<void> {
    const flagName = deployment.metadata.featureFlagName;
    if (!flagName) {
      throw new Error('Feature flag name not found in deployment metadata');
    }
    
    // Disable feature flag to route all traffic to stable version
    await this.disableFeatureFlag(flagName);
  }

  private async rollbackABTest(deployment: ProgressiveDeployment): Promise<void> {
    const testName = deployment.metadata.abTestName;
    if (!testName) {
      throw new Error('A/B test name not found in deployment metadata');
    }
    
    // Stop A/B test and route all traffic to control (stable) version
    await this.stopABTest(testName);
    
    // Update traffic routing
    await this.updateIstioTrafficRouting(deployment, {
      stable: 100,
      canary: 0
    });
  }

  private async updateIstioTrafficRouting(deployment: ProgressiveDeployment, weights: any): Promise<void> {
    const { service } = deployment.config;
    
    const virtualServiceUpdate = {
      spec: {
        http: [{
          route: [
            {
              destination: {
                host: `${service.name}.${service.namespace}.svc.cluster.local`,
                subset: 'stable'
              },
              weight: weights.stable
            },
            {
              destination: {
                host: `${service.name}.${service.namespace}.svc.cluster.local`,
                subset: 'canary'
              },
              weight: weights.canary
            }
          ].filter(route => route.weight > 0)
        }]
      }
    };

    await this.k8sApi.patchCustomResource(
      'networking.istio.io/v1beta1',
      'virtualservices',
      service.namespace,
      `${service.name}-vs`,
      virtualServiceUpdate
    );
  }

  private async disableFeatureFlag(flagName: string): Promise<void> {
    // This would integrate with your feature flag provider
    // Implementation depends on the provider (LaunchDarkly, Flagsmith, etc.)
    console.log(`Disabling feature flag: ${flagName}`);
  }

  private async stopABTest(testName: string): Promise<void> {
    // This would integrate with your A/B testing platform
    console.log(`Stopping A/B test: ${testName}`);
  }

  private checkSLIViolation(metric: MetricResult, sli: SLIConfig): boolean {
    switch (sli.operator) {
      case '>':
        return metric.value > sli.threshold;
      case '<':
        return metric.value < sli.threshold;
      case '>=':
        return metric.value >= sli.threshold;
      case '<=':
        return metric.value <= sli.threshold;
      case '==':
        return metric.value === sli.threshold;
      default:
        return false;
    }
  }

  private getConsecutiveFailures(deploymentId: string, metrics: MetricResult[]): number {
    // In a real implementation, this would track failure counts over time
    const failedMetrics = metrics.filter(m => m.status === 'failure');
    return failedMetrics.length;
  }

  private async recordRollbackEvent(deployment: ProgressiveDeployment, reason?: string): Promise<void> {
    const rollbackEntry: RollbackHistoryEntry = {
      id: `rollback-${Date.now()}`,
      deploymentId: deployment.id,
      timestamp: new Date(),
      reason: reason || 'Manual rollback',
      previousVersion: deployment.metadata.previousVersion || 'unknown',
      rollbackVersion: deployment.config.service.version,
      triggeredBy: 'automatic',
      success: true
    };
    
    // In a real implementation, store this in a database
    this.emit('rollbackRecorded', rollbackEntry);
  }

  private parseTimeout(timeout: string): number {
    const match = timeout.match(/^(\d+)([smh])$/);
    if (!match) return 300000; // Default 5 minutes
    
    const [, value, unit] = match;
    const num = parseInt(value, 10);
    
    switch (unit) {
      case 's': return num * 1000;
      case 'm': return num * 60 * 1000;
      case 'h': return num * 60 * 60 * 1000;
      default: return 300000;
    }
  }

  // Public methods for manual rollback triggers
  async enableManualRollback(deploymentId: string): Promise<void> {
    const deployment = this.findDeployment(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }
    
    deployment.metadata.manualRollbackEnabled = true;
    this.emit('manualRollbackEnabled', { deploymentId });
  }

  async disableManualRollback(deploymentId: string): Promise<void> {
    const deployment = this.findDeployment(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }
    
    deployment.metadata.manualRollbackEnabled = false;
    this.emit('manualRollbackDisabled', { deploymentId });
  }

  private findDeployment(deploymentId: string): ProgressiveDeployment | null {
    // In a real implementation, this would query from storage
    return null;
  }
}

interface RollbackConfig {
  errorRateThreshold: number;
  latencyThreshold: number;
  availabilityThreshold: number;
  consecutiveFailureLimit: number;
  timeWindowMinutes: number;
  customSLIs: SLIConfig[];
  automaticRollback: boolean;
  rollbackTimeout: number;
}

interface SLIConfig {
  metricName: string;
  threshold: number;
  operator: '>' | '<' | '>=' | '<=' | '==';
  windowMinutes: number;
}

interface RollbackHistoryEntry {
  id: string;
  deploymentId: string;
  timestamp: Date;
  reason: string;
  previousVersion: string;
  rollbackVersion: string;
  triggeredBy: 'automatic' | 'manual' | 'emergency';
  success: boolean;
  error?: string;
}