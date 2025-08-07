/**
 * Plugin Lifecycle State Machine
 * Comprehensive state management following enterprise-grade orchestration patterns
 * Implements state transitions with validation, rollback capabilities, and error handling
 */

import { EventEmitter } from 'events';
import { z } from 'zod';

// Plugin lifecycle states following Spotify's Portal architecture
export enum PluginLifecycleState {
  INACTIVE = 'inactive',
  INSTALLING = 'installing', 
  INSTALLED = 'installed',
  CONFIGURING = 'configuring',
  STARTING = 'starting',
  RUNNING = 'running',
  UPDATING = 'updating',
  RESTARTING = 'restarting',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  UNINSTALLING = 'uninstalling',
  ERROR = 'error',
  MAINTENANCE = 'maintenance'
}

// State transition events
export enum PluginLifecycleEvent {
  INSTALL = 'install',
  CONFIGURE = 'configure', 
  START = 'start',
  STOP = 'stop',
  RESTART = 'restart',
  UPDATE = 'update',
  UNINSTALL = 'uninstall',
  ERROR = 'error',
  RECOVER = 'recover',
  ENTER_MAINTENANCE = 'enter_maintenance',
  EXIT_MAINTENANCE = 'exit_maintenance',
  HEALTH_CHECK_PASS = 'health_check_pass',
  HEALTH_CHECK_FAIL = 'health_check_fail'
}

// Lifecycle context schema
export const LifecycleContextSchema = z.object({
  pluginId: z.string(),
  version: z.string(),
  tenantId: z.string().optional(),
  userId: z.string(),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional(),
  rollbackData: z.any().optional(),
  dependencies: z.array(z.string()).optional(),
  resources: z.object({
    cpu: z.number().optional(),
    memory: z.number().optional(),
    storage: z.number().optional(),
    replicas: z.number().optional()
  }).optional(),
  configuration: z.record(z.any()).optional(),
  environment: z.enum(['development', 'staging', 'production']).default('development')
});

export type LifecycleContext = z.infer<typeof LifecycleContextSchema>;

// State transition result
export interface StateTransitionResult {
  success: boolean;
  fromState: PluginLifecycleState;
  toState: PluginLifecycleState;
  event: PluginLifecycleEvent;
  timestamp: Date;
  duration: number;
  context: LifecycleContext;
  error?: Error;
  rollbackData?: any;
  logs: string[];
  metrics?: {
    resourcesAllocated?: any;
    performanceMetrics?: any;
    healthScore?: number;
  };
}

// State validation rules
export interface StateValidationRule {
  fromState: PluginLifecycleState;
  toState: PluginLifecycleState; 
  event: PluginLifecycleEvent;
  validate: (context: LifecycleContext) => Promise<boolean>;
  preconditions?: string[];
  postconditions?: string[];
}

// Rollback strategy
export interface RollbackStrategy {
  canRollback: (fromState: PluginLifecycleState, context: LifecycleContext) => boolean;
  execute: (context: LifecycleContext, rollbackData: any) => Promise<StateTransitionResult>;
  maxAttempts: number;
  timeout: number;
}

/**
 * Plugin Lifecycle State Machine
 * Enterprise-grade state management with validation, rollback, and recovery
 */
export class PluginLifecycleStateMachine extends EventEmitter {
  private currentState: PluginLifecycleState = PluginLifecycleState.INACTIVE;
  private stateHistory: Array<{
    state: PluginLifecycleState;
    timestamp: Date;
    event?: PluginLifecycleEvent;
    context?: LifecycleContext;
  }> = [];
  private transitionRules: Map<string, StateValidationRule> = new Map();
  private rollbackStrategies: Map<PluginLifecycleState, RollbackStrategy> = new Map();
  private transitionLocks: Set<string> = new Set();
  private transitionTimeout: number = 300000; // 5 minutes default
  private maxRetries: number = 3;

  constructor(
    private pluginId: string,
    initialState: PluginLifecycleState = PluginLifecycleState.INACTIVE
  ) {
    super();
    this.currentState = initialState;
    this.initializeStateTransitionRules();
    this.initializeRollbackStrategies();
    this.recordStateChange(initialState, undefined, { 
      pluginId, 
      version: '0.0.0', 
      userId: 'system', 
      timestamp: new Date() 
    } as LifecycleContext);
  }

  // Get current state
  getCurrentState(): PluginLifecycleState {
    return this.currentState;
  }

  // Get state history
  getStateHistory(): typeof this.stateHistory {
    return [...this.stateHistory];
  }

  // Check if transition is valid
  canTransition(event: PluginLifecycleEvent, context: LifecycleContext): boolean {
    const targetState = this.getTargetState(this.currentState, event);
    if (!targetState) return false;

    const ruleKey = `${this.currentState}-${event}-${targetState}`;
    return this.transitionRules.has(ruleKey);
  }

  // Execute state transition with full validation and rollback support
  async transition(
    event: PluginLifecycleEvent,
    context: LifecycleContext,
    options: {
      timeout?: number;
      retries?: number;
      forceTransition?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<StateTransitionResult> {
    const startTime = Date.now();
    const fromState = this.currentState;
    const targetState = this.getTargetState(fromState, event);
    const transitionId = `${this.pluginId}-${Date.now()}`;
    
    // Validate context
    try {
      LifecycleContextSchema.parse(context);
    } catch (error) {
      return this.createFailureResult(fromState, fromState, event, startTime, context, 
        new Error(`Invalid context: ${error}`));
    }

    // Check if transition is allowed
    if (!options.forceTransition && !targetState) {
      return this.createFailureResult(fromState, fromState, event, startTime, context,
        new Error(`Invalid transition: ${fromState} -> ${event}`));
    }

    if (!targetState) {
      return this.createFailureResult(fromState, fromState, event, startTime, context,
        new Error(`No target state found for ${fromState} -> ${event}`));
    }

    // Check for concurrent transitions
    if (this.transitionLocks.has(this.pluginId)) {
      return this.createFailureResult(fromState, fromState, event, startTime, context,
        new Error(`Transition already in progress for plugin ${this.pluginId}`));
    }

    // Dry run mode
    if (options.dryRun) {
      const validation = await this.validateTransition(fromState, targetState, event, context);
      return {
        success: validation.success,
        fromState,
        toState: targetState,
        event,
        timestamp: new Date(startTime),
        duration: 0,
        context,
        error: validation.error,
        logs: [`Dry run: ${fromState} -> ${targetState} via ${event}`, ...validation.logs]
      };
    }

    // Lock transition
    this.transitionLocks.add(this.pluginId);
    
    try {
      // Set timeout
      const timeout = options.timeout || this.transitionTimeout;
      const maxRetries = options.retries || this.maxRetries;

      let lastError: Error | undefined;
      
      // Retry logic
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await Promise.race([
            this.executeTransitionWithValidation(fromState, targetState, event, context, attempt),
            this.createTimeoutPromise(timeout, fromState, targetState, event, context)
          ]);

          if (result.success) {
            this.currentState = targetState;
            this.recordStateChange(targetState, event, context);
            this.emit('stateChanged', result);
            this.emit(`${event}Success`, result);
            return result;
          }

          lastError = result.error;
          
          // If not the last attempt, wait before retry
          if (attempt < maxRetries) {
            const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }

        } catch (error) {
          lastError = error as Error;
        }
      }

      // All attempts failed, initiate rollback if possible
      const rollbackResult = await this.attemptRollback(fromState, context, lastError);
      
      const failureResult = this.createFailureResult(fromState, this.currentState, event, 
        startTime, context, lastError || new Error('All retry attempts failed'));
      
      this.emit('stateTransitionFailed', failureResult);
      this.emit(`${event}Failed`, failureResult);
      
      return failureResult;

    } finally {
      // Always unlock
      this.transitionLocks.delete(this.pluginId);
    }
  }

  // Execute transition with full validation
  private async executeTransitionWithValidation(
    fromState: PluginLifecycleState,
    targetState: PluginLifecycleState,
    event: PluginLifecycleEvent,
    context: LifecycleContext,
    attempt: number
  ): Promise<StateTransitionResult> {
    const startTime = Date.now();
    const logs: string[] = [`Starting transition attempt ${attempt}: ${fromState} -> ${targetState} via ${event}`];

    try {
      // Pre-transition validation
      const validation = await this.validateTransition(fromState, targetState, event, context);
      logs.push(...validation.logs);

      if (!validation.success) {
        return this.createFailureResult(fromState, fromState, event, startTime, context, 
          validation.error, logs);
      }

      // Execute pre-transition hooks
      logs.push('Executing pre-transition hooks...');
      const preHooks = await this.executePreTransitionHooks(fromState, targetState, event, context);
      logs.push(...preHooks.logs);
      
      if (!preHooks.success) {
        return this.createFailureResult(fromState, fromState, event, startTime, context,
          preHooks.error, logs);
      }

      // Execute the actual state transition logic
      logs.push('Executing state transition logic...');
      const transitionResult = await this.executeStateTransitionLogic(fromState, targetState, event, context);
      logs.push(...transitionResult.logs);

      if (!transitionResult.success) {
        return this.createFailureResult(fromState, fromState, event, startTime, context,
          transitionResult.error, logs);
      }

      // Execute post-transition hooks
      logs.push('Executing post-transition hooks...');
      const postHooks = await this.executePostTransitionHooks(fromState, targetState, event, context);
      logs.push(...postHooks.logs);

      if (!postHooks.success) {
        // Post-hooks failed, but transition may have succeeded - this is a warning case
        logs.push(`Warning: Post-transition hooks failed: ${postHooks.error?.message}`);
      }

      // Create success result
      const result: StateTransitionResult = {
        success: true,
        fromState,
        toState: targetState,
        event,
        timestamp: new Date(startTime),
        duration: Date.now() - startTime,
        context,
        logs,
        rollbackData: transitionResult.rollbackData,
        metrics: transitionResult.metrics
      };

      logs.push(`Transition completed successfully in ${result.duration}ms`);
      return result;

    } catch (error) {
      logs.push(`Transition failed: ${error}`);
      return this.createFailureResult(fromState, fromState, event, startTime, context,
        error as Error, logs);
    }
  }

  // Initialize state transition rules
  private initializeStateTransitionRules(): void {
    const rules: Array<Omit<StateValidationRule, 'validate'> & { 
      validate?: (context: LifecycleContext) => Promise<boolean> 
    }> = [
      // From INACTIVE
      { fromState: PluginLifecycleState.INACTIVE, toState: PluginLifecycleState.INSTALLING, event: PluginLifecycleEvent.INSTALL },
      
      // From INSTALLING
      { fromState: PluginLifecycleState.INSTALLING, toState: PluginLifecycleState.INSTALLED, event: PluginLifecycleEvent.HEALTH_CHECK_PASS },
      { fromState: PluginLifecycleState.INSTALLING, toState: PluginLifecycleState.ERROR, event: PluginLifecycleEvent.ERROR },
      
      // From INSTALLED
      { fromState: PluginLifecycleState.INSTALLED, toState: PluginLifecycleState.CONFIGURING, event: PluginLifecycleEvent.CONFIGURE },
      { fromState: PluginLifecycleState.INSTALLED, toState: PluginLifecycleState.UNINSTALLING, event: PluginLifecycleEvent.UNINSTALL },
      
      // From CONFIGURING
      { fromState: PluginLifecycleState.CONFIGURING, toState: PluginLifecycleState.STARTING, event: PluginLifecycleEvent.START },
      { fromState: PluginLifecycleState.CONFIGURING, toState: PluginLifecycleState.ERROR, event: PluginLifecycleEvent.ERROR },
      
      // From STARTING
      { fromState: PluginLifecycleState.STARTING, toState: PluginLifecycleState.RUNNING, event: PluginLifecycleEvent.HEALTH_CHECK_PASS },
      { fromState: PluginLifecycleState.STARTING, toState: PluginLifecycleState.ERROR, event: PluginLifecycleEvent.ERROR },
      
      // From RUNNING
      { fromState: PluginLifecycleState.RUNNING, toState: PluginLifecycleState.STOPPING, event: PluginLifecycleEvent.STOP },
      { fromState: PluginLifecycleState.RUNNING, toState: PluginLifecycleState.RESTARTING, event: PluginLifecycleEvent.RESTART },
      { fromState: PluginLifecycleState.RUNNING, toState: PluginLifecycleState.UPDATING, event: PluginLifecycleEvent.UPDATE },
      { fromState: PluginLifecycleState.RUNNING, toState: PluginLifecycleState.MAINTENANCE, event: PluginLifecycleEvent.ENTER_MAINTENANCE },
      { fromState: PluginLifecycleState.RUNNING, toState: PluginLifecycleState.ERROR, event: PluginLifecycleEvent.HEALTH_CHECK_FAIL },
      
      // From UPDATING
      { fromState: PluginLifecycleState.UPDATING, toState: PluginLifecycleState.RUNNING, event: PluginLifecycleEvent.HEALTH_CHECK_PASS },
      { fromState: PluginLifecycleState.UPDATING, toState: PluginLifecycleState.ERROR, event: PluginLifecycleEvent.ERROR },
      
      // From RESTARTING
      { fromState: PluginLifecycleState.RESTARTING, toState: PluginLifecycleState.RUNNING, event: PluginLifecycleEvent.HEALTH_CHECK_PASS },
      { fromState: PluginLifecycleState.RESTARTING, toState: PluginLifecycleState.ERROR, event: PluginLifecycleEvent.ERROR },
      
      // From STOPPING
      { fromState: PluginLifecycleState.STOPPING, toState: PluginLifecycleState.STOPPED, event: PluginLifecycleEvent.HEALTH_CHECK_PASS },
      
      // From STOPPED
      { fromState: PluginLifecycleState.STOPPED, toState: PluginLifecycleState.STARTING, event: PluginLifecycleEvent.START },
      { fromState: PluginLifecycleState.STOPPED, toState: PluginLifecycleState.UNINSTALLING, event: PluginLifecycleEvent.UNINSTALL },
      
      // From MAINTENANCE
      { fromState: PluginLifecycleState.MAINTENANCE, toState: PluginLifecycleState.RUNNING, event: PluginLifecycleEvent.EXIT_MAINTENANCE },
      
      // From ERROR
      { fromState: PluginLifecycleState.ERROR, toState: PluginLifecycleState.INACTIVE, event: PluginLifecycleEvent.RECOVER },
      { fromState: PluginLifecycleState.ERROR, toState: PluginLifecycleState.UNINSTALLING, event: PluginLifecycleEvent.UNINSTALL },
      
      // From UNINSTALLING
      { fromState: PluginLifecycleState.UNINSTALLING, toState: PluginLifecycleState.INACTIVE, event: PluginLifecycleEvent.HEALTH_CHECK_PASS }
    ];

    // Add default validation for all rules
    rules.forEach(rule => {
      const ruleKey = `${rule.fromState}-${rule.event}-${rule.toState}`;
      this.transitionRules.set(ruleKey, {
        ...rule,
        validate: rule.validate || this.defaultValidation.bind(this)
      } as StateValidationRule);
    });
  }

  // Initialize rollback strategies
  private initializeRollbackStrategies(): void {
    // Installation rollback
    this.rollbackStrategies.set(PluginLifecycleState.INSTALLING, {
      canRollback: () => true,
      execute: async (context: LifecycleContext, rollbackData: any) => {
        return await this.transition(PluginLifecycleEvent.UNINSTALL, context, { forceTransition: true });
      },
      maxAttempts: 3,
      timeout: 60000
    });

    // Update rollback
    this.rollbackStrategies.set(PluginLifecycleState.UPDATING, {
      canRollback: (fromState: PluginLifecycleState, context: LifecycleContext) => {
        return context.rollbackData && context.rollbackData.previousVersion;
      },
      execute: async (context: LifecycleContext, rollbackData: any) => {
        // Rollback to previous version
        const rollbackContext = {
          ...context,
          version: rollbackData.previousVersion,
          metadata: { ...context.metadata, isRollback: true }
        };
        return await this.transition(PluginLifecycleEvent.UPDATE, rollbackContext, { forceTransition: true });
      },
      maxAttempts: 2,
      timeout: 120000
    });
  }

  // Default validation implementation
  private async defaultValidation(context: LifecycleContext): Promise<boolean> {
    // Basic validation checks
    if (!context.pluginId || !context.userId) {
      return false;
    }

    // Check if plugin exists for non-installation operations
    if (this.currentState !== PluginLifecycleState.INACTIVE && 
        this.currentState !== PluginLifecycleState.INSTALLING) {
      // Plugin should exist in some registry or storage
      return true; // Simplified for now
    }

    return true;
  }

  // Get target state for a given event from current state
  private getTargetState(fromState: PluginLifecycleState, event: PluginLifecycleEvent): PluginLifecycleState | null {
    for (const [key, rule] of this.transitionRules.entries()) {
      if (key.startsWith(`${fromState}-${event}-`)) {
        return rule.toState;
      }
    }
    return null;
  }

  // Validate state transition
  private async validateTransition(
    fromState: PluginLifecycleState,
    targetState: PluginLifecycleState,
    event: PluginLifecycleEvent,
    context: LifecycleContext
  ): Promise<{ success: boolean; error?: Error; logs: string[] }> {
    const logs: string[] = [];
    
    try {
      const ruleKey = `${fromState}-${event}-${targetState}`;
      const rule = this.transitionRules.get(ruleKey);
      
      if (!rule) {
        return {
          success: false,
          error: new Error(`No transition rule found for ${ruleKey}`),
          logs
        };
      }

      logs.push(`Validating transition: ${fromState} -> ${targetState} via ${event}`);
      
      const isValid = await rule.validate(context);
      
      if (!isValid) {
        return {
          success: false,
          error: new Error(`Validation failed for transition ${ruleKey}`),
          logs
        };
      }

      logs.push('Transition validation passed');
      return { success: true, logs };

    } catch (error) {
      return {
        success: false,
        error: error as Error,
        logs
      };
    }
  }

  // Execute pre-transition hooks
  private async executePreTransitionHooks(
    fromState: PluginLifecycleState,
    targetState: PluginLifecycleState,
    event: PluginLifecycleEvent,
    context: LifecycleContext
  ): Promise<{ success: boolean; error?: Error; logs: string[] }> {
    const logs: string[] = [];
    
    try {
      // Emit pre-transition event
      this.emit('beforeStateTransition', { fromState, targetState, event, context });
      logs.push('Pre-transition hooks executed successfully');
      return { success: true, logs };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        logs
      };
    }
  }

  // Execute actual state transition logic (to be implemented by subclasses or injected)
  private async executeStateTransitionLogic(
    fromState: PluginLifecycleState,
    targetState: PluginLifecycleState,
    event: PluginLifecycleEvent,
    context: LifecycleContext
  ): Promise<{ success: boolean; error?: Error; logs: string[]; rollbackData?: any; metrics?: any }> {
    const logs: string[] = [];
    
    // This is where the actual plugin lifecycle operations would be executed
    // For now, we'll simulate the operation
    logs.push(`Executing ${event} operation: ${fromState} -> ${targetState}`);
    
    // Simulate operation time based on transition type
    const operationTime = this.getOperationTime(event);
    await new Promise(resolve => setTimeout(resolve, operationTime));
    
    logs.push(`${event} operation completed`);
    
    return {
      success: true,
      logs,
      rollbackData: { previousState: fromState, timestamp: new Date() },
      metrics: { operationTime, resourcesUsed: {} }
    };
  }

  // Execute post-transition hooks
  private async executePostTransitionHooks(
    fromState: PluginLifecycleState,
    targetState: PluginLifecycleState,
    event: PluginLifecycleEvent,
    context: LifecycleContext
  ): Promise<{ success: boolean; error?: Error; logs: string[] }> {
    const logs: string[] = [];
    
    try {
      // Emit post-transition event
      this.emit('afterStateTransition', { fromState, targetState, event, context });
      logs.push('Post-transition hooks executed successfully');
      return { success: true, logs };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        logs
      };
    }
  }

  // Attempt rollback on failure
  private async attemptRollback(
    fromState: PluginLifecycleState,
    context: LifecycleContext,
    error?: Error
  ): Promise<StateTransitionResult | null> {
    const strategy = this.rollbackStrategies.get(fromState);
    
    if (!strategy || !strategy.canRollback(fromState, context)) {
      return null;
    }

    try {
      const rollbackResult = await strategy.execute(context, context.rollbackData);
      this.emit('rollbackExecuted', { fromState, context, result: rollbackResult });
      return rollbackResult;
    } catch (rollbackError) {
      this.emit('rollbackFailed', { fromState, context, error: rollbackError });
      return null;
    }
  }

  // Create timeout promise
  private async createTimeoutPromise(
    timeout: number,
    fromState: PluginLifecycleState,
    targetState: PluginLifecycleState,
    event: PluginLifecycleEvent,
    context: LifecycleContext
  ): Promise<StateTransitionResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`State transition timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  // Create failure result
  private createFailureResult(
    fromState: PluginLifecycleState,
    toState: PluginLifecycleState,
    event: PluginLifecycleEvent,
    startTime: number,
    context: LifecycleContext,
    error?: Error,
    logs: string[] = []
  ): StateTransitionResult {
    return {
      success: false,
      fromState,
      toState,
      event,
      timestamp: new Date(startTime),
      duration: Date.now() - startTime,
      context,
      error,
      logs
    };
  }

  // Record state change in history
  private recordStateChange(
    state: PluginLifecycleState,
    event?: PluginLifecycleEvent,
    context?: LifecycleContext
  ): void {
    this.stateHistory.push({
      state,
      timestamp: new Date(),
      event,
      context
    });

    // Keep only last 100 entries
    if (this.stateHistory.length > 100) {
      this.stateHistory.shift();
    }
  }

  // Get estimated operation time for different events
  private getOperationTime(event: PluginLifecycleEvent): number {
    const times = {
      [PluginLifecycleEvent.INSTALL]: 30000,
      [PluginLifecycleEvent.UNINSTALL]: 15000,
      [PluginLifecycleEvent.START]: 10000,
      [PluginLifecycleEvent.STOP]: 5000,
      [PluginLifecycleEvent.RESTART]: 15000,
      [PluginLifecycleEvent.UPDATE]: 45000,
      [PluginLifecycleEvent.CONFIGURE]: 5000
    };
    
    return times[event] || 1000;
  }

  // Get detailed state info
  getStateInfo(): {
    current: PluginLifecycleState;
    canTransitionTo: Array<{ state: PluginLifecycleState; event: PluginLifecycleEvent }>;
    history: typeof this.stateHistory;
    isLocked: boolean;
  } {
    const canTransitionTo: Array<{ state: PluginLifecycleState; event: PluginLifecycleEvent }> = [];
    
    for (const [key, rule] of this.transitionRules.entries()) {
      if (key.startsWith(`${this.currentState}-`)) {
        canTransitionTo.push({
          state: rule.toState,
          event: rule.event
        });
      }
    }

    return {
      current: this.currentState,
      canTransitionTo,
      history: [...this.stateHistory],
      isLocked: this.transitionLocks.has(this.pluginId)
    };
  }

  // Force state (for recovery scenarios)
  forceState(state: PluginLifecycleState, context: LifecycleContext): void {
    const previousState = this.currentState;
    this.currentState = state;
    this.recordStateChange(state, undefined, context);
    
    this.emit('stateForced', {
      from: previousState,
      to: state,
      context,
      timestamp: new Date()
    });
  }

  // Cleanup resources
  destroy(): void {
    this.removeAllListeners();
    this.transitionLocks.clear();
    this.transitionRules.clear();
    this.rollbackStrategies.clear();
    this.stateHistory.length = 0;
  }
}

// Factory function for creating state machines
export function createPluginLifecycleStateMachine(
  pluginId: string,
  initialState?: PluginLifecycleState
): PluginLifecycleStateMachine {
  return new PluginLifecycleStateMachine(pluginId, initialState);
}

// Plugin state machine registry for managing multiple plugins
export class PluginStateMachineRegistry {
  private stateMachines: Map<string, PluginLifecycleStateMachine> = new Map();
  private globalEventEmitter = new EventEmitter();

  // Get or create state machine for plugin
  getStateMachine(pluginId: string, initialState?: PluginLifecycleState): PluginLifecycleStateMachine {
    let stateMachine = this.stateMachines.get(pluginId);
    
    if (!stateMachine) {
      stateMachine = createPluginLifecycleStateMachine(pluginId, initialState);
      
      // Forward all events to global emitter
      stateMachine.on('stateChanged', (result) => {
        this.globalEventEmitter.emit('pluginStateChanged', { pluginId, ...result });
      });
      
      stateMachine.on('stateTransitionFailed', (result) => {
        this.globalEventEmitter.emit('pluginTransitionFailed', { pluginId, ...result });
      });

      this.stateMachines.set(pluginId, stateMachine);
    }
    
    return stateMachine;
  }

  // Remove state machine
  removeStateMachine(pluginId: string): boolean {
    const stateMachine = this.stateMachines.get(pluginId);
    if (stateMachine) {
      stateMachine.destroy();
      this.stateMachines.delete(pluginId);
      return true;
    }
    return false;
  }

  // Get all state machines
  getAllStateMachines(): Map<string, PluginLifecycleStateMachine> {
    return new Map(this.stateMachines);
  }

  // Get global event emitter for cross-plugin events
  getGlobalEventEmitter(): EventEmitter {
    return this.globalEventEmitter;
  }

  // Get summary of all plugin states
  getStateSummary(): Record<string, PluginLifecycleState> {
    const summary: Record<string, PluginLifecycleState> = {};
    for (const [pluginId, stateMachine] of this.stateMachines) {
      summary[pluginId] = stateMachine.getCurrentState();
    }
    return summary;
  }

  // Cleanup all state machines
  destroy(): void {
    for (const stateMachine of this.stateMachines.values()) {
      stateMachine.destroy();
    }
    this.stateMachines.clear();
    this.globalEventEmitter.removeAllListeners();
  }
}

// Export singleton registry
export const pluginStateMachineRegistry = new PluginStateMachineRegistry();