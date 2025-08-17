/**
 * Advanced Plugin Lifecycle Management System
 * Handles automated installation, updates, health monitoring, and recovery
 */

import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import { pluginPerformanceEngine } from '../plugin-performance/PerformanceOptimizationEngine';

const execAsync = promisify(exec);

export interface PluginLifecycleState {
  pluginId: string;
  version: string;
  state: 'installing' | 'installed' | 'starting' | 'running' | 'stopping' | 'stopped' | 'updating' | 'error' | 'rollback';
  previousState?: string;
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  dependencies: PluginDependency[];
  installationTime: number;
  lastHealthCheck: string;
  recoveryAttempts: number;
  rollbackVersion?: string;
  automationRules: AutomationRule[];
}

export interface PluginDependency {
  id: string;
  version: string;
  required: boolean;
  status: 'satisfied' | 'missing' | 'incompatible' | 'outdated';
  conflictsWith?: string[];
}

export interface AutomationRule {
  type: 'auto-update' | 'auto-restart' | 'auto-scale' | 'auto-rollback';
  condition: string;
  action: string;
  enabled: boolean;
  priority: number;
}

export interface LifecycleEvent {
  pluginId: string;
  eventType: 'state-change' | 'health-change' | 'dependency-change' | 'automation-triggered';
  timestamp: string;
  details: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface RecoveryStrategy {
  name: string;
  description: string;
  conditions: string[];
  actions: RecoveryAction[];
  priority: number;
  estimatedRecoveryTime: number;
}

export interface RecoveryAction {
  type: 'restart' | 'rollback' | 'reinstall' | 'resource-cleanup' | 'dependency-fix';
  parameters: Record<string, any>;
  timeout: number;
}

export class AdvancedPluginLifecycleManager extends EventEmitter {
  private lifecycleStates = new Map<string, PluginLifecycleState>();
  private recoveryStrategies = new Map<string, RecoveryStrategy[]>();
  private automationEngine?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private eventLog: LifecycleEvent[] = [];
  
  private readonly maxRecoveryAttempts = 3;
  private readonly healthCheckFrequency = 30000; // 30 seconds
  private readonly automationFrequency = 10000; // 10 seconds

  constructor() {
    super();
    this.startLifecycleManagement();
    this.setupRecoveryStrategies();
  }

  /**
   * Start comprehensive lifecycle management
   */
  private async startLifecycleManagement(): Promise<void> {
    console.log('[LifecycleManager] Starting advanced plugin lifecycle management');

    // Health monitoring loop
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        console.error('[LifecycleManager] Health check error:', error);
      }
    }, this.healthCheckFrequency);

    // Automation engine loop
    this.automationEngine = setInterval(async () => {
      try {
        await this.executeAutomationRules();
      } catch (error) {
        console.error('[LifecycleManager] Automation error:', error);
      }
    }, this.automationFrequency);

    // Listen to performance engine events
    pluginPerformanceEngine.on('performanceDegradation', (data) => {
      this.handlePerformanceDegradation(data);
    });

    pluginPerformanceEngine.on('criticalPerformance', (data) => {
      this.handleCriticalPerformance(data);
    });
  }

  /**
   * Setup recovery strategies
   */
  private setupRecoveryStrategies(): void {
    // Memory leak recovery
    this.addRecoveryStrategy({
      name: 'memory-leak-recovery',
      description: 'Handles memory leak detection and recovery',
      conditions: ['memory_usage > 80%', 'memory_growth > 10% per hour'],
      actions: [
        { type: 'restart', parameters: { graceful: true }, timeout: 30000 },
        { type: 'resource-cleanup', parameters: { force: true }, timeout: 10000 }
      ],
      priority: 1,
      estimatedRecoveryTime: 45
    });

    // High CPU recovery
    this.addRecoveryStrategy({
      name: 'high-cpu-recovery',
      description: 'Handles sustained high CPU usage',
      conditions: ['cpu_usage > 90%', 'duration > 5 minutes'],
      actions: [
        { type: 'restart', parameters: { graceful: false }, timeout: 20000 },
        { type: 'resource-cleanup', parameters: {}, timeout: 10000 }
      ],
      priority: 2,
      estimatedRecoveryTime: 30
    });

    // Dependency failure recovery
    this.addRecoveryStrategy({
      name: 'dependency-failure-recovery',
      description: 'Handles dependency conflicts and failures',
      conditions: ['dependency_status == "missing"', 'dependency_status == "incompatible"'],
      actions: [
        { type: 'dependency-fix', parameters: { autoResolve: true }, timeout: 60000 },
        { type: 'rollback', parameters: { targetVersion: 'last-stable' }, timeout: 90000 }
      ],
      priority: 3,
      estimatedRecoveryTime: 120
    });

    // Error rate recovery
    this.addRecoveryStrategy({
      name: 'high-error-rate-recovery',
      description: 'Handles sustained high error rates',
      conditions: ['error_rate > 10%', 'duration > 2 minutes'],
      actions: [
        { type: 'restart', parameters: { graceful: true }, timeout: 30000 },
        { type: 'rollback', parameters: { targetVersion: 'previous' }, timeout: 60000 }
      ],
      priority: 2,
      estimatedRecoveryTime: 60
    });
  }

  /**
   * Register a plugin for lifecycle management
   */
  async registerPlugin(
    pluginId: string, 
    version: string, 
    dependencies: PluginDependency[] = []
  ): Promise<void> {
    const lifecycleState: PluginLifecycleState = {
      pluginId,
      version,
      state: 'installing',
      health: 'unknown',
      dependencies,
      installationTime: Date.now(),
      lastHealthCheck: new Date().toISOString(),
      recoveryAttempts: 0,
      automationRules: this.getDefaultAutomationRules()
    };

    this.lifecycleStates.set(pluginId, lifecycleState);
    
    this.logEvent({
      pluginId,
      eventType: 'state-change',
      timestamp: new Date().toISOString(),
      details: { newState: 'installing', version },
      severity: 'info'
    });

    console.log(`[LifecycleManager] Registered plugin ${pluginId}@${version} for lifecycle management`);
  }

  /**
   * Install plugin with comprehensive lifecycle management
   */
  async installPlugin(
    pluginId: string, 
    version: string, 
    config: any = {}
  ): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      await this.registerPlugin(pluginId, version);
      const state = this.lifecycleStates.get(pluginId)!;
      
      // 1. Dependency resolution
      const dependencyCheck = await this.resolveDependencies(pluginId);
      if (!dependencyCheck.success) {
        state.state = 'error';
        return { success: false, message: `Dependency resolution failed: ${dependencyCheck.error}` };
      }

      // 2. Security validation
      const securityCheck = await this.validateSecurity(pluginId, version);
      if (!securityCheck.passed) {
        state.state = 'error';
        return { success: false, message: `Security validation failed: ${securityCheck.issues}` };
      }

      // 3. Compatibility check
      const compatibilityCheck = await this.checkCompatibility(pluginId, version);
      if (!compatibilityCheck.compatible) {
        state.state = 'error';
        return { success: false, message: `Compatibility check failed: ${compatibilityCheck.reason}` };
      }

      // 4. Install with monitoring
      state.state = 'installing';
      const installResult = await this.performInstallation(pluginId, version, config);
      
      if (!installResult.success) {
        state.state = 'error';
        return installResult;
      }

      // 5. Post-installation validation
      state.state = 'starting';
      const startupResult = await this.validateStartup(pluginId);
      
      if (startupResult.success) {
        state.state = 'running';
        state.health = 'healthy';
        
        this.logEvent({
          pluginId,
          eventType: 'state-change',
          timestamp: new Date().toISOString(),
          details: { newState: 'running', installationTime: Date.now() - state.installationTime },
          severity: 'info'
        });
      } else {
        state.state = 'error';
        await this.initiateRecovery(pluginId, 'startup-failure');
      }

      return {
        success: startupResult.success,
        message: startupResult.success ? 
          `Plugin ${pluginId}@${version} installed and running successfully` :
          `Plugin installation completed but startup failed: ${startupResult.error}`,
        details: {
          installationTime: Date.now() - state.installationTime,
          dependenciesResolved: dependencyCheck.resolved,
          securityValidated: securityCheck.passed,
          compatibilityChecked: compatibilityCheck.compatible
        }
      };

    } catch (error) {
      const state = this.lifecycleStates.get(pluginId);
      if (state) {
        state.state = 'error';
      }
      
      console.error(`[LifecycleManager] Plugin installation failed for ${pluginId}:`, error);
      return { 
        success: false, 
        message: `Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Perform health checks on all managed plugins
   */
  private async performHealthChecks(): Promise<void> {
    for (const [pluginId, state] of this.lifecycleStates.entries()) {
      if (state.state === 'running') {
        try {
          const healthResult = await this.checkPluginHealth(pluginId);
          const previousHealth = state.health;
          state.health = healthResult.health;
          state.lastHealthCheck = new Date().toISOString();

          if (previousHealth !== state.health) {
            this.logEvent({
              pluginId,
              eventType: 'health-change',
              timestamp: new Date().toISOString(),
              details: { previousHealth, newHealth: state.health, metrics: healthResult.metrics },
              severity: state.health === 'healthy' ? 'info' : state.health === 'degraded' ? 'warning' : 'error'
            });

            // Trigger recovery if unhealthy
            if (state.health === 'unhealthy') {
              await this.initiateRecovery(pluginId, 'health-degradation');
            }
          }
        } catch (error) {
          console.error(`[LifecycleManager] Health check failed for ${pluginId}:`, error);
          state.health = 'unknown';
        }
      }
    }
  }

  /**
   * Check individual plugin health
   */
  private async checkPluginHealth(pluginId: string): Promise<{ health: string; metrics: any }> {
    try {
      // Get performance metrics
      const performanceMetrics = pluginPerformanceEngine.getPluginMetrics(pluginId);
      
      if (!performanceMetrics) {
        return { health: 'unknown', metrics: null };
      }

      // Determine health based on multiple factors
      let health: string = 'healthy';
      
      if (performanceMetrics.performanceScore < 30 || 
          performanceMetrics.errorRate > 20 || 
          performanceMetrics.impactPercentage > 50) {
        health = 'unhealthy';
      } else if (performanceMetrics.performanceScore < 60 || 
                 performanceMetrics.errorRate > 5 || 
                 performanceMetrics.impactPercentage > 20) {
        health = 'degraded';
      }

      return { health, metrics: performanceMetrics };
    } catch (error) {
      return { health: 'unknown', metrics: null };
    }
  }

  /**
   * Execute automation rules
   */
  private async executeAutomationRules(): Promise<void> {
    for (const [pluginId, state] of this.lifecycleStates.entries()) {
      for (const rule of state.automationRules) {
        if (rule.enabled && await this.evaluateCondition(pluginId, rule.condition)) {
          try {
            await this.executeAutomationAction(pluginId, rule.action);
            
            this.logEvent({
              pluginId,
              eventType: 'automation-triggered',
              timestamp: new Date().toISOString(),
              details: { rule: rule.type, condition: rule.condition, action: rule.action },
              severity: 'info'
            });
          } catch (error) {
            console.error(`[LifecycleManager] Automation action failed for ${pluginId}:`, error);
          }
        }
      }
    }
  }

  /**
   * Evaluate automation condition
   */
  private async evaluateCondition(pluginId: string, condition: string): Promise<boolean> {
    try {
      const metrics = pluginPerformanceEngine.getPluginMetrics(pluginId);
      const state = this.lifecycleStates.get(pluginId);
      
      if (!metrics || !state) return false;

      // Simple condition evaluation (in production, use a proper expression evaluator)
      const context = {
        cpu_usage: metrics.cpuUsage,
        memory_usage: metrics.memoryUsage,
        error_rate: metrics.errorRate,
        response_time: metrics.responseTime,
        health: state.health,
        state: state.state
      };

      // Basic condition matching
      if (condition.includes('cpu_usage >')) {
        const threshold = parseFloat(condition.split('>')[1].trim());
        return context.cpu_usage > threshold;
      }
      
      if (condition.includes('memory_usage >')) {
        const threshold = parseFloat(condition.split('>')[1].trim());
        return context.memory_usage > threshold;
      }
      
      if (condition.includes('error_rate >')) {
        const threshold = parseFloat(condition.split('>')[1].trim());
        return context.error_rate > threshold;
      }
      
      if (condition.includes('health ==')) {
        const value = condition.split('==')[1].trim().replace(/['"]/g, '');
        return context.health === value;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Execute automation action
   */
  private async executeAutomationAction(pluginId: string, action: string): Promise<void> {
    switch (action) {
      case 'restart':
        await this.restartPlugin(pluginId);
        break;
      case 'scale-up':
        await this.scalePlugin(pluginId, 'up');
        break;
      case 'scale-down':
        await this.scalePlugin(pluginId, 'down');
        break;
      case 'update':
        await this.updatePlugin(pluginId);
        break;
      case 'rollback':
        await this.rollbackPlugin(pluginId);
        break;
      default:
        console.log(`[LifecycleManager] Unknown automation action: ${action}`);
    }
  }

  /**
   * Initiate recovery for a plugin
   */
  private async initiateRecovery(pluginId: string, reason: string): Promise<void> {
    const state = this.lifecycleStates.get(pluginId);
    if (!state) return;

    if (state.recoveryAttempts >= this.maxRecoveryAttempts) {
      console.log(`[LifecycleManager] Max recovery attempts reached for ${pluginId}. Manual intervention required.`);
      this.emit('recoveryFailed', { pluginId, reason, attempts: state.recoveryAttempts });
      return;
    }

    state.recoveryAttempts++;
    console.log(`[LifecycleManager] Initiating recovery for ${pluginId} (attempt ${state.recoveryAttempts}/${this.maxRecoveryAttempts}). Reason: ${reason}`);

    // Get applicable recovery strategies
    const strategies = this.getRecoveryStrategies(pluginId, reason);
    
    for (const strategy of strategies) {
      try {
        console.log(`[LifecycleManager] Applying recovery strategy: ${strategy.name}`);
        const success = await this.executeRecoveryStrategy(pluginId, strategy);
        
        if (success) {
          state.recoveryAttempts = 0; // Reset on successful recovery
          
          this.logEvent({
            pluginId,
            eventType: 'state-change',
            timestamp: new Date().toISOString(),
            details: { recovery: true, strategy: strategy.name, reason },
            severity: 'info'
          });
          
          console.log(`[LifecycleManager] Recovery successful for ${pluginId} using strategy: ${strategy.name}`);
          this.emit('recoverySuccess', { pluginId, strategy: strategy.name, reason });
          return;
        }
      } catch (error) {
        console.error(`[LifecycleManager] Recovery strategy ${strategy.name} failed for ${pluginId}:`, error);
      }
    }

    console.log(`[LifecycleManager] All recovery strategies failed for ${pluginId}`);
    this.emit('recoveryPartialFailure', { pluginId, reason, attempts: state.recoveryAttempts });
  }

  /**
   * Get recovery strategies for a plugin and reason
   */
  private getRecoveryStrategies(pluginId: string, reason: string): RecoveryStrategy[] {
    const strategies = this.recoveryStrategies.get(pluginId) || [];
    
    // Filter strategies based on reason and conditions
    return strategies
      .filter(strategy => this.isStrategyApplicable(strategy, reason))
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Check if recovery strategy is applicable
   */
  private isStrategyApplicable(strategy: RecoveryStrategy, reason: string): boolean {
    const reasonMap: Record<string, string[]> = {
      'health-degradation': ['memory-leak-recovery', 'high-cpu-recovery', 'high-error-rate-recovery'],
      'startup-failure': ['dependency-failure-recovery', 'high-error-rate-recovery'],
      'performance-critical': ['memory-leak-recovery', 'high-cpu-recovery']
    };

    const applicableStrategies = reasonMap[reason] || [];
    return applicableStrategies.includes(strategy.name);
  }

  /**
   * Execute recovery strategy
   */
  private async executeRecoveryStrategy(pluginId: string, strategy: RecoveryStrategy): Promise<boolean> {
    console.log(`[LifecycleManager] Executing recovery strategy: ${strategy.name} for ${pluginId}`);
    
    for (const action of strategy.actions) {
      try {
        const success = await this.executeRecoveryAction(pluginId, action);
        if (!success) {
          return false;
        }
      } catch (error) {
        console.error(`[LifecycleManager] Recovery action ${action.type} failed:`, error);
        return false;
      }
    }

    // Wait for recovery to take effect
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify recovery success
    return await this.verifyRecovery(pluginId);
  }

  /**
   * Execute individual recovery action
   */
  private async executeRecoveryAction(pluginId: string, action: RecoveryAction): Promise<boolean> {
    console.log(`[LifecycleManager] Executing recovery action: ${action.type} for ${pluginId}`);
    
    switch (action.type) {
      case 'restart':
        return await this.restartPlugin(pluginId, action.parameters.graceful);
      case 'rollback':
        return await this.rollbackPlugin(pluginId, action.parameters.targetVersion);
      case 'reinstall':
        return await this.reinstallPlugin(pluginId);
      case 'resource-cleanup':
        return await this.cleanupResources(pluginId, action.parameters.force);
      case 'dependency-fix':
        return await this.fixDependencies(pluginId, action.parameters.autoResolve);
      default:
        console.log(`[LifecycleManager] Unknown recovery action: ${action.type}`);
        return false;
    }
  }

  /**
   * Verify recovery success
   */
  private async verifyRecovery(pluginId: string): Promise<boolean> {
    try {
      const healthResult = await this.checkPluginHealth(pluginId);
      return healthResult.health === 'healthy' || healthResult.health === 'degraded';
    } catch {
      return false;
    }
  }

  /**
   * Handle performance degradation events
   */
  private async handlePerformanceDegradation(data: any): Promise<void> {
    const { pluginId, metrics } = data;
    
    this.logEvent({
      pluginId,
      eventType: 'state-change',
      timestamp: new Date().toISOString(),
      details: { event: 'performance-degradation', metrics },
      severity: 'warning'
    });

    // Check if recovery is needed
    if (metrics.performanceScore < 40) {
      await this.initiateRecovery(pluginId, 'health-degradation');
    }
  }

  /**
   * Handle critical performance events
   */
  private async handleCriticalPerformance(data: any): Promise<void> {
    const { pluginId, metrics } = data;
    
    this.logEvent({
      pluginId,
      eventType: 'state-change',
      timestamp: new Date().toISOString(),
      details: { event: 'critical-performance', metrics },
      severity: 'critical'
    });

    // Immediate recovery for critical issues
    await this.initiateRecovery(pluginId, 'performance-critical');
  }

  // Implementation stubs for plugin operations
  private async performInstallation(pluginId: string, version: string, config: any): Promise<any> {
    // Integrate with existing plugin installer
    return { success: true, message: `Installed ${pluginId}@${version}` };
  }

  private async validateStartup(pluginId: string): Promise<any> {
    // Wait for plugin to start and validate
    await new Promise(resolve => setTimeout(resolve, 5000));
    return { success: true };
  }

  private async restartPlugin(pluginId: string, graceful: boolean = true): Promise<boolean> {
    console.log(`[LifecycleManager] Restarting plugin ${pluginId} (graceful: ${graceful})`);
    return true;
  }

  private async scalePlugin(pluginId: string, direction: 'up' | 'down'): Promise<boolean> {
    console.log(`[LifecycleManager] Scaling plugin ${pluginId} ${direction}`);
    return true;
  }

  private async updatePlugin(pluginId: string): Promise<boolean> {
    console.log(`[LifecycleManager] Updating plugin ${pluginId}`);
    return true;
  }

  private async rollbackPlugin(pluginId: string, targetVersion?: string): Promise<boolean> {
    console.log(`[LifecycleManager] Rolling back plugin ${pluginId} to ${targetVersion || 'previous version'}`);
    return true;
  }

  private async reinstallPlugin(pluginId: string): Promise<boolean> {
    console.log(`[LifecycleManager] Reinstalling plugin ${pluginId}`);
    return true;
  }

  private async cleanupResources(pluginId: string, force: boolean): Promise<boolean> {
    console.log(`[LifecycleManager] Cleaning up resources for ${pluginId} (force: ${force})`);
    return true;
  }

  private async fixDependencies(pluginId: string, autoResolve: boolean): Promise<boolean> {
    console.log(`[LifecycleManager] Fixing dependencies for ${pluginId} (auto-resolve: ${autoResolve})`);
    return true;
  }

  private async resolveDependencies(pluginId: string): Promise<any> {
    return { success: true, resolved: [] };
  }

  private async validateSecurity(pluginId: string, version: string): Promise<any> {
    return { passed: true, issues: [] };
  }

  private async checkCompatibility(pluginId: string, version: string): Promise<any> {
    return { compatible: true, reason: null };
  }

  /**
   * Get default automation rules
   */
  private getDefaultAutomationRules(): AutomationRule[] {
    return [
      {
        type: 'auto-restart',
        condition: 'health == "unhealthy"',
        action: 'restart',
        enabled: true,
        priority: 1
      },
      {
        type: 'auto-scale',
        condition: 'cpu_usage > 80',
        action: 'scale-up',
        enabled: true,
        priority: 2
      },
      {
        type: 'auto-rollback',
        condition: 'error_rate > 15',
        action: 'rollback',
        enabled: true,
        priority: 3
      }
    ];
  }

  /**
   * Add recovery strategy
   */
  private addRecoveryStrategy(strategy: RecoveryStrategy): void {
    // Add to all plugins or specific plugin strategies
    if (!this.recoveryStrategies.has('global')) {
      this.recoveryStrategies.set('global', []);
    }
    this.recoveryStrategies.get('global')!.push(strategy);
  }

  /**
   * Log lifecycle event
   */
  private logEvent(event: LifecycleEvent): void {
    this.eventLog.push(event);
    
    // Keep only last 1000 events
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-1000);
    }
    
    this.emit('lifecycleEvent', event);
  }

  /**
   * Get lifecycle state for plugin
   */
  getPluginState(pluginId: string): PluginLifecycleState | null {
    return this.lifecycleStates.get(pluginId) || null;
  }

  /**
   * Get all managed plugins
   */
  getAllManagedPlugins(): Map<string, PluginLifecycleState> {
    return this.lifecycleStates;
  }

  /**
   * Get event log
   */
  getEventLog(pluginId?: string): LifecycleEvent[] {
    if (pluginId) {
      return this.eventLog.filter(event => event.pluginId === pluginId);
    }
    return this.eventLog;
  }

  /**
   * Stop lifecycle management
   */
  stopLifecycleManagement(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    
    if (this.automationEngine) {
      clearInterval(this.automationEngine);
      this.automationEngine = undefined;
    }
  }
}

// Export singleton instance
export const advancedLifecycleManager = new AdvancedPluginLifecycleManager();