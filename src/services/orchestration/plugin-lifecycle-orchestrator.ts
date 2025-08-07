/**
 * Plugin Lifecycle Orchestration Service
 * Enterprise-grade orchestration following Spotify's Portal architecture patterns
 * Manages complete plugin operation control with state validation, error handling, and recovery
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import {
  PluginLifecycleStateMachine,
  PluginLifecycleState,
  PluginLifecycleEvent,
  LifecycleContext,
  StateTransitionResult,
  pluginStateMachineRegistry
} from './plugin-lifecycle-state-machine';

// Plugin orchestration configuration
export const OrchestrationConfigSchema = z.object({
  maxConcurrentOperations: z.number().default(10),
  defaultTimeout: z.number().default(300000), // 5 minutes
  retryAttempts: z.number().default(3),
  retryDelay: z.number().default(5000),
  healthCheckInterval: z.number().default(60000), // 1 minute
  enableAutoRecovery: z.boolean().default(true),
  enableResourceOptimization: z.boolean().default(true),
  enablePerformanceMonitoring: z.boolean().default(true),
  enableAuditLogging: z.boolean().default(true),
  rollbackStrategy: z.enum(['immediate', 'graceful', 'manual']).default('graceful'),
  resourceLimits: z.object({
    maxCpuPercent: z.number().default(80),
    maxMemoryMB: z.number().default(2048),
    maxStorageMB: z.number().default(5120)
  }).optional(),
  tenantIsolation: z.object({
    enabled: z.boolean().default(false),
    defaultResourceQuota: z.record(z.number()).optional()
  }).optional()
});

export type OrchestrationConfig = z.infer<typeof OrchestrationConfigSchema>;

// Plugin operation request
export const PluginOperationRequestSchema = z.object({
  operationId: z.string(),
  pluginId: z.string(),
  operation: z.enum(['install', 'uninstall', 'start', 'stop', 'restart', 'update', 'configure']),
  version: z.string().optional(),
  tenantId: z.string().optional(),
  userId: z.string(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal'),
  configuration: z.record(z.any()).optional(),
  resources: z.object({
    cpu: z.number().optional(),
    memory: z.number().optional(),
    storage: z.number().optional(),
    replicas: z.number().optional()
  }).optional(),
  dependencies: z.array(z.string()).optional(),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  metadata: z.record(z.any()).optional(),
  rollbackOnFailure: z.boolean().default(true),
  skipDependencyCheck: z.boolean().default(false),
  dryRun: z.boolean().default(false)
});

export type PluginOperationRequest = z.infer<typeof PluginOperationRequestSchema>;

// Operation result
export interface PluginOperationResult {
  operationId: string;
  pluginId: string;
  operation: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  finalState: PluginLifecycleState;
  stateTransitions: StateTransitionResult[];
  logs: string[];
  metrics: {
    resourcesAllocated: Record<string, number>;
    performanceMetrics: Record<string, number>;
    healthScore: number;
  };
  error?: Error;
  rollbackExecuted?: boolean;
  warnings: string[];
}

// Operation queue entry
interface QueuedOperation {
  request: PluginOperationRequest;
  priority: number;
  enqueuedAt: Date;
  startedAt?: Date;
  resolve: (result: PluginOperationResult) => void;
  reject: (error: Error) => void;
}

// Dependency graph node
interface DependencyNode {
  pluginId: string;
  dependencies: Set<string>;
  dependents: Set<string>;
  state: PluginLifecycleState;
}

/**
 * Plugin Lifecycle Orchestrator
 * Manages complete plugin operation control with enterprise-grade reliability
 */
export class PluginLifecycleOrchestrator extends EventEmitter {
  private config: OrchestrationConfig;
  private operationQueue: QueuedOperation[] = [];
  private activeOperations: Map<string, QueuedOperation> = new Map();
  private operationHistory: Map<string, PluginOperationResult> = new Map();
  private dependencyGraph: Map<string, DependencyNode> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private resourceMonitor: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config?: Partial<OrchestrationConfig>) {
    super();
    this.config = OrchestrationConfigSchema.parse(config || {});
    this.initializeOrchestrator();
  }

  // Initialize orchestrator services
  private initializeOrchestrator(): void {
    // Start health monitoring
    if (this.config.enablePerformanceMonitoring) {
      this.startHealthMonitoring();
    }

    // Start resource monitoring
    if (this.config.enableResourceOptimization) {
      this.startResourceMonitoring();
    }

    // Listen to global state machine events
    pluginStateMachineRegistry.getGlobalEventEmitter().on('pluginStateChanged', (event) => {
      this.handlePluginStateChange(event);
    });

    pluginStateMachineRegistry.getGlobalEventEmitter().on('pluginTransitionFailed', (event) => {
      this.handlePluginTransitionFailure(event);
    });

    // Start operation queue processor
    this.processOperationQueue();
  }

  // Execute plugin operation with full orchestration
  async executeOperation(request: PluginOperationRequest): Promise<PluginOperationResult> {
    // Validate request
    try {
      PluginOperationRequestSchema.parse(request);
    } catch (error) {
      throw new Error(`Invalid operation request: ${error}`);
    }

    // Check if orchestrator is shutting down
    if (this.isShuttingDown) {
      throw new Error('Orchestrator is shutting down, no new operations accepted');
    }

    const startTime = new Date();
    this.emit('operationRequested', { request, timestamp: startTime });

    try {
      // Check operation dependencies
      if (!request.skipDependencyCheck) {
        await this.validateOperationDependencies(request);
      }

      // Check resource availability
      if (this.config.enableResourceOptimization) {
        await this.validateResourceRequirements(request);
      }

      // Execute operation through state machine
      const result = await this.executeOperationInternal(request, startTime);
      
      // Store operation result
      this.operationHistory.set(request.operationId, result);
      
      // Emit success event
      this.emit('operationCompleted', result);
      
      return result;

    } catch (error) {
      // Create failure result
      const failureResult: PluginOperationResult = {
        operationId: request.operationId,
        pluginId: request.pluginId,
        operation: request.operation,
        success: false,
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime.getTime(),
        finalState: PluginLifecycleState.ERROR,
        stateTransitions: [],
        logs: [`Operation failed: ${error}`],
        metrics: {
          resourcesAllocated: {},
          performanceMetrics: {},
          healthScore: 0
        },
        error: error as Error,
        warnings: []
      };

      // Store failure result
      this.operationHistory.set(request.operationId, failureResult);
      
      // Emit failure event
      this.emit('operationFailed', failureResult);
      
      throw error;
    }
  }

  // Queue operation for batch processing
  async queueOperation(request: PluginOperationRequest): Promise<PluginOperationResult> {
    return new Promise((resolve, reject) => {
      const queuedOperation: QueuedOperation = {
        request,
        priority: this.getPriorityValue(request.priority),
        enqueuedAt: new Date(),
        resolve,
        reject
      };

      // Insert operation in priority order
      this.insertOperationInQueue(queuedOperation);
      
      this.emit('operationQueued', { 
        operationId: request.operationId, 
        position: this.operationQueue.length 
      });
    });
  }

  // Execute batch operations with dependency ordering
  async executeBatchOperations(
    requests: PluginOperationRequest[],
    options: {
      parallelism?: number;
      failFast?: boolean;
      dependencyOrder?: boolean;
    } = {}
  ): Promise<PluginOperationResult[]> {
    const { parallelism = 3, failFast = false, dependencyOrder = true } = options;
    
    // Order operations by dependencies if requested
    const orderedRequests = dependencyOrder 
      ? await this.orderOperationsByDependencies(requests)
      : requests;

    const results: PluginOperationResult[] = [];
    const errors: Error[] = [];

    // Process operations in batches
    for (let i = 0; i < orderedRequests.length; i += parallelism) {
      const batch = orderedRequests.slice(i, i + parallelism);
      
      const batchPromises = batch.map(request => 
        this.executeOperation(request).catch(error => {
          if (failFast) throw error;
          errors.push(error);
          return null;
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(r => r !== null) as PluginOperationResult[]);

      // Stop processing if failFast is enabled and there are errors
      if (failFast && errors.length > 0) {
        throw errors[0];
      }
    }

    // Throw aggregated errors if any
    if (errors.length > 0) {
      throw new Error(`Batch operation failed with ${errors.length} errors: ${errors.map(e => e.message).join(', ')}`);
    }

    return results;
  }

  // Get operation status
  getOperationStatus(operationId: string): PluginOperationResult | null {
    return this.operationHistory.get(operationId) || null;
  }

  // Get all plugin states
  getAllPluginStates(): Record<string, PluginLifecycleState> {
    return pluginStateMachineRegistry.getStateSummary();
  }

  // Get plugin operation history
  getPluginHistory(pluginId: string): PluginOperationResult[] {
    return Array.from(this.operationHistory.values())
      .filter(result => result.pluginId === pluginId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  // Cancel operation
  async cancelOperation(operationId: string): Promise<boolean> {
    // Remove from queue if not started
    const queueIndex = this.operationQueue.findIndex(op => op.request.operationId === operationId);
    if (queueIndex >= 0) {
      const operation = this.operationQueue.splice(queueIndex, 1)[0];
      operation.reject(new Error('Operation cancelled'));
      this.emit('operationCancelled', { operationId });
      return true;
    }

    // Try to cancel active operation
    const activeOperation = this.activeOperations.get(operationId);
    if (activeOperation) {
      // Force stop the plugin if it's in a running state
      const stateMachine = pluginStateMachineRegistry.getStateMachine(activeOperation.request.pluginId);
      if (stateMachine.getCurrentState() === PluginLifecycleState.RUNNING) {
        try {
          await stateMachine.transition(PluginLifecycleEvent.STOP, {
            pluginId: activeOperation.request.pluginId,
            version: activeOperation.request.version || '0.0.0',
            userId: 'system',
            timestamp: new Date(),
            metadata: { cancellation: true }
          });
          return true;
        } catch (error) {
          return false;
        }
      }
    }

    return false;
  }

  // Execute internal operation logic
  private async executeOperationInternal(
    request: PluginOperationRequest,
    startTime: Date
  ): Promise<PluginOperationResult> {
    const logs: string[] = [`Starting ${request.operation} operation for plugin ${request.pluginId}`];
    const stateTransitions: StateTransitionResult[] = [];
    const warnings: string[] = [];
    let rollbackExecuted = false;

    try {
      // Get or create state machine for the plugin
      const stateMachine = pluginStateMachineRegistry.getStateMachine(request.pluginId);
      
      // Create lifecycle context
      const context: LifecycleContext = {
        pluginId: request.pluginId,
        version: request.version || '0.0.0',
        tenantId: request.tenantId,
        userId: request.userId,
        timestamp: new Date(),
        metadata: request.metadata,
        dependencies: request.dependencies,
        resources: request.resources,
        configuration: request.configuration,
        environment: request.environment
      };

      logs.push(`Created lifecycle context for ${request.pluginId}`);

      // Map operation to lifecycle event
      const event = this.mapOperationToEvent(request.operation);
      logs.push(`Mapped operation ${request.operation} to event ${event}`);

      // Execute state transition
      const transitionResult = await stateMachine.transition(event, context, {
        timeout: this.config.defaultTimeout,
        retries: this.config.retryAttempts,
        dryRun: request.dryRun
      });

      stateTransitions.push(transitionResult);
      logs.push(...transitionResult.logs);

      if (!transitionResult.success && request.rollbackOnFailure) {
        logs.push('Attempting rollback due to failure...');
        try {
          const rollbackResult = await this.executeRollback(stateMachine, context, request);
          if (rollbackResult) {
            stateTransitions.push(rollbackResult);
            logs.push(...rollbackResult.logs);
            rollbackExecuted = true;
          }
        } catch (rollbackError) {
          warnings.push(`Rollback failed: ${rollbackError}`);
        }
      }

      // Update dependency graph
      this.updateDependencyGraph(request.pluginId, request.dependencies || [], stateMachine.getCurrentState());

      // Collect metrics
      const metrics = await this.collectOperationMetrics(request.pluginId, startTime);

      // Create result
      const result: PluginOperationResult = {
        operationId: request.operationId,
        pluginId: request.pluginId,
        operation: request.operation,
        success: transitionResult.success,
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime.getTime(),
        finalState: stateMachine.getCurrentState(),
        stateTransitions,
        logs,
        metrics,
        error: transitionResult.error,
        rollbackExecuted,
        warnings
      };

      return result;

    } catch (error) {
      logs.push(`Operation execution failed: ${error}`);
      throw error;
    }
  }

  // Validate operation dependencies
  private async validateOperationDependencies(request: PluginOperationRequest): Promise<void> {
    if (!request.dependencies || request.dependencies.length === 0) {
      return;
    }

    const pluginStates = this.getAllPluginStates();
    const missingDependencies: string[] = [];
    const unhealthyDependencies: string[] = [];

    for (const dependencyId of request.dependencies) {
      const dependencyState = pluginStates[dependencyId];
      
      if (!dependencyState || dependencyState === PluginLifecycleState.INACTIVE) {
        missingDependencies.push(dependencyId);
      } else if (dependencyState === PluginLifecycleState.ERROR) {
        unhealthyDependencies.push(dependencyId);
      }
    }

    if (missingDependencies.length > 0) {
      throw new Error(`Missing dependencies: ${missingDependencies.join(', ')}`);
    }

    if (unhealthyDependencies.length > 0) {
      throw new Error(`Unhealthy dependencies: ${unhealthyDependencies.join(', ')}`);
    }
  }

  // Validate resource requirements
  private async validateResourceRequirements(request: PluginOperationRequest): Promise<void> {
    if (!request.resources || !this.config.resourceLimits) {
      return;
    }

    const limits = this.config.resourceLimits;
    const required = request.resources;

    if (required.cpu && required.cpu > limits.maxCpuPercent) {
      throw new Error(`CPU requirement (${required.cpu}%) exceeds limit (${limits.maxCpuPercent}%)`);
    }

    if (required.memory && required.memory > limits.maxMemoryMB) {
      throw new Error(`Memory requirement (${required.memory}MB) exceeds limit (${limits.maxMemoryMB}MB)`);
    }

    if (required.storage && required.storage > limits.maxStorageMB) {
      throw new Error(`Storage requirement (${required.storage}MB) exceeds limit (${limits.maxStorageMB}MB)`);
    }
  }

  // Map operation string to lifecycle event
  private mapOperationToEvent(operation: string): PluginLifecycleEvent {
    const mapping: Record<string, PluginLifecycleEvent> = {
      'install': PluginLifecycleEvent.INSTALL,
      'uninstall': PluginLifecycleEvent.UNINSTALL,
      'start': PluginLifecycleEvent.START,
      'stop': PluginLifecycleEvent.STOP,
      'restart': PluginLifecycleEvent.RESTART,
      'update': PluginLifecycleEvent.UPDATE,
      'configure': PluginLifecycleEvent.CONFIGURE
    };

    const event = mapping[operation.toLowerCase()];
    if (!event) {
      throw new Error(`Unknown operation: ${operation}`);
    }

    return event;
  }

  // Execute rollback
  private async executeRollback(
    stateMachine: PluginLifecycleStateMachine,
    context: LifecycleContext,
    request: PluginOperationRequest
  ): Promise<StateTransitionResult | null> {
    const rollbackStrategy = this.config.rollbackStrategy;
    
    switch (rollbackStrategy) {
      case 'immediate':
        return await this.executeImmediateRollback(stateMachine, context);
      case 'graceful':
        return await this.executeGracefulRollback(stateMachine, context);
      case 'manual':
        // Manual rollback requires external intervention
        return null;
      default:
        return null;
    }
  }

  // Execute immediate rollback
  private async executeImmediateRollback(
    stateMachine: PluginLifecycleStateMachine,
    context: LifecycleContext
  ): Promise<StateTransitionResult | null> {
    try {
      // Force stop and uninstall
      if (stateMachine.getCurrentState() === PluginLifecycleState.RUNNING) {
        await stateMachine.transition(PluginLifecycleEvent.STOP, context, { forceTransition: true });
      }
      
      return await stateMachine.transition(PluginLifecycleEvent.UNINSTALL, context, { forceTransition: true });
    } catch (error) {
      return null;
    }
  }

  // Execute graceful rollback
  private async executeGracefulRollback(
    stateMachine: PluginLifecycleStateMachine,
    context: LifecycleContext
  ): Promise<StateTransitionResult | null> {
    try {
      const currentState = stateMachine.getCurrentState();
      
      // Gracefully stop if running
      if (currentState === PluginLifecycleState.RUNNING) {
        const stopResult = await stateMachine.transition(PluginLifecycleEvent.STOP, context);
        if (stopResult.success) {
          // Wait a moment for graceful shutdown
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      // Rollback to previous version if available
      if (context.rollbackData && context.rollbackData.previousVersion) {
        const rollbackContext = {
          ...context,
          version: context.rollbackData.previousVersion,
          metadata: { ...context.metadata, isRollback: true }
        };
        
        return await stateMachine.transition(PluginLifecycleEvent.UPDATE, rollbackContext);
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  // Update dependency graph
  private updateDependencyGraph(
    pluginId: string,
    dependencies: string[],
    state: PluginLifecycleState
  ): void {
    let node = this.dependencyGraph.get(pluginId);
    
    if (!node) {
      node = {
        pluginId,
        dependencies: new Set(),
        dependents: new Set(),
        state
      };
      this.dependencyGraph.set(pluginId, node);
    }
    
    // Update dependencies
    node.dependencies.clear();
    dependencies.forEach(dep => {
      node!.dependencies.add(dep);
      
      // Update dependent's dependents set
      let depNode = this.dependencyGraph.get(dep);
      if (!depNode) {
        depNode = {
          pluginId: dep,
          dependencies: new Set(),
          dependents: new Set(),
          state: PluginLifecycleState.INACTIVE
        };
        this.dependencyGraph.set(dep, depNode);
      }
      depNode.dependents.add(pluginId);
    });
    
    node.state = state;
  }

  // Order operations by dependencies
  private async orderOperationsByDependencies(
    requests: PluginOperationRequest[]
  ): Promise<PluginOperationRequest[]> {
    // Build temporary dependency graph
    const graph = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();
    
    requests.forEach(request => {
      graph.set(request.pluginId, new Set(request.dependencies || []));
      inDegree.set(request.pluginId, request.dependencies?.length || 0);
    });

    // Topological sort
    const result: PluginOperationRequest[] = [];
    const queue: string[] = [];
    
    // Find nodes with no dependencies
    for (const [pluginId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(pluginId);
      }
    }
    
    while (queue.length > 0) {
      const pluginId = queue.shift()!;
      const request = requests.find(r => r.pluginId === pluginId);
      if (request) {
        result.push(request);
      }
      
      // Update in-degrees of dependents
      for (const [otherPluginId, deps] of graph.entries()) {
        if (deps.has(pluginId)) {
          deps.delete(pluginId);
          const newDegree = (inDegree.get(otherPluginId) || 0) - 1;
          inDegree.set(otherPluginId, newDegree);
          
          if (newDegree === 0) {
            queue.push(otherPluginId);
          }
        }
      }
    }
    
    // Check for circular dependencies
    if (result.length !== requests.length) {
      throw new Error('Circular dependency detected in plugin operations');
    }
    
    return result;
  }

  // Collect operation metrics
  private async collectOperationMetrics(
    pluginId: string,
    startTime: Date
  ): Promise<PluginOperationResult['metrics']> {
    // Simulate metrics collection - in production, integrate with actual monitoring
    return {
      resourcesAllocated: {
        cpu: Math.random() * 100,
        memory: Math.random() * 1024,
        storage: Math.random() * 512
      },
      performanceMetrics: {
        operationDuration: Date.now() - startTime.getTime(),
        throughput: Math.random() * 100,
        errorRate: Math.random() * 5
      },
      healthScore: Math.random() * 100
    };
  }

  // Process operation queue
  private async processOperationQueue(): Promise<void> {
    setInterval(async () => {
      if (this.isShuttingDown || this.operationQueue.length === 0) {
        return;
      }

      // Process operations up to the concurrency limit
      const availableSlots = this.config.maxConcurrentOperations - this.activeOperations.size;
      if (availableSlots <= 0) {
        return;
      }

      const operationsToProcess = this.operationQueue
        .splice(0, Math.min(availableSlots, this.operationQueue.length));

      for (const operation of operationsToProcess) {
        operation.startedAt = new Date();
        this.activeOperations.set(operation.request.operationId, operation);
        
        // Execute operation asynchronously
        this.executeOperation(operation.request)
          .then(result => {
            operation.resolve(result);
          })
          .catch(error => {
            operation.reject(error);
          })
          .finally(() => {
            this.activeOperations.delete(operation.request.operationId);
          });
      }
    }, 1000); // Check every second
  }

  // Insert operation in priority queue
  private insertOperationInQueue(operation: QueuedOperation): void {
    let insertIndex = this.operationQueue.length;
    
    // Find insertion point based on priority
    for (let i = 0; i < this.operationQueue.length; i++) {
      if (operation.priority > this.operationQueue[i].priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.operationQueue.splice(insertIndex, 0, operation);
  }

  // Get priority value for sorting
  private getPriorityValue(priority: string): number {
    const values = { critical: 4, high: 3, normal: 2, low: 1 };
    return values[priority as keyof typeof values] || 2;
  }

  // Handle plugin state changes
  private handlePluginStateChange(event: any): void {
    this.emit('pluginStateUpdated', event);
    
    // Update dependency graph
    if (this.dependencyGraph.has(event.pluginId)) {
      const node = this.dependencyGraph.get(event.pluginId)!;
      node.state = event.toState;
    }
  }

  // Handle plugin transition failures
  private handlePluginTransitionFailure(event: any): void {
    this.emit('pluginTransitionError', event);
    
    // Trigger auto-recovery if enabled
    if (this.config.enableAutoRecovery) {
      this.triggerAutoRecovery(event.pluginId);
    }
  }

  // Trigger auto-recovery
  private async triggerAutoRecovery(pluginId: string): Promise<void> {
    try {
      const stateMachine = pluginStateMachineRegistry.getStateMachine(pluginId);
      const currentState = stateMachine.getCurrentState();
      
      if (currentState === PluginLifecycleState.ERROR) {
        // Attempt recovery
        await stateMachine.transition(PluginLifecycleEvent.RECOVER, {
          pluginId,
          version: '0.0.0',
          userId: 'auto-recovery',
          timestamp: new Date(),
          metadata: { autoRecovery: true }
        });
      }
    } catch (error) {
      this.emit('autoRecoveryFailed', { pluginId, error });
    }
  }

  // Start health monitoring
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  // Start resource monitoring
  private startResourceMonitoring(): void {
    this.resourceMonitor = setInterval(() => {
      this.monitorResourceUsage();
    }, 30000); // Monitor every 30 seconds
  }

  // Perform health checks on all plugins
  private async performHealthChecks(): Promise<void> {
    const pluginStates = this.getAllPluginStates();
    
    for (const [pluginId, state] of Object.entries(pluginStates)) {
      if (state === PluginLifecycleState.RUNNING) {
        // Simulate health check - integrate with actual health monitoring
        const isHealthy = Math.random() > 0.1; // 90% healthy
        
        if (!isHealthy) {
          const stateMachine = pluginStateMachineRegistry.getStateMachine(pluginId);
          try {
            await stateMachine.transition(PluginLifecycleEvent.HEALTH_CHECK_FAIL, {
              pluginId,
              version: '0.0.0',
              userId: 'health-monitor',
              timestamp: new Date(),
              metadata: { healthCheck: true }
            });
          } catch (error) {
            // Health check transition failed
            this.emit('healthCheckFailed', { pluginId, error });
          }
        }
      }
    }
  }

  // Monitor resource usage
  private async monitorResourceUsage(): Promise<void> {
    // Simulate resource monitoring - integrate with actual resource monitoring
    const pluginStates = this.getAllPluginStates();
    
    for (const pluginId of Object.keys(pluginStates)) {
      const resourceUsage = {
        cpu: Math.random() * 100,
        memory: Math.random() * 1024,
        storage: Math.random() * 512
      };
      
      this.emit('resourceUsageUpdated', { pluginId, resourceUsage });
      
      // Check if resource limits are exceeded
      if (this.config.resourceLimits) {
        const limits = this.config.resourceLimits;
        if (resourceUsage.cpu > limits.maxCpuPercent ||
            resourceUsage.memory > limits.maxMemoryMB ||
            resourceUsage.storage > limits.maxStorageMB) {
          this.emit('resourceLimitExceeded', { pluginId, resourceUsage, limits });
        }
      }
    }
  }

  // Get orchestrator statistics
  getStatistics(): {
    totalOperations: number;
    activeOperations: number;
    queuedOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageOperationDuration: number;
    pluginStates: Record<string, number>;
  } {
    const operations = Array.from(this.operationHistory.values());
    const successful = operations.filter(op => op.success).length;
    const failed = operations.length - successful;
    
    const avgDuration = operations.length > 0 
      ? operations.reduce((sum, op) => sum + op.duration, 0) / operations.length 
      : 0;
    
    const pluginStates = this.getAllPluginStates();
    const stateCount: Record<string, number> = {};
    Object.values(pluginStates).forEach(state => {
      stateCount[state] = (stateCount[state] || 0) + 1;
    });
    
    return {
      totalOperations: operations.length,
      activeOperations: this.activeOperations.size,
      queuedOperations: this.operationQueue.length,
      successfulOperations: successful,
      failedOperations: failed,
      averageOperationDuration: avgDuration,
      pluginStates: stateCount
    };
  }

  // Graceful shutdown
  async shutdown(timeout: number = 30000): Promise<void> {
    this.isShuttingDown = true;
    
    // Stop accepting new operations
    this.emit('shuttingDown');
    
    // Wait for active operations to complete
    const startTime = Date.now();
    while (this.activeOperations.size > 0 && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Force stop remaining operations
    for (const operation of this.activeOperations.values()) {
      operation.reject(new Error('Orchestrator shutdown'));
    }
    this.activeOperations.clear();
    
    // Reject queued operations
    for (const operation of this.operationQueue) {
      operation.reject(new Error('Orchestrator shutdown'));
    }
    this.operationQueue.length = 0;
    
    // Stop monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = null;
    }
    
    // Clean up resources
    this.removeAllListeners();
    this.dependencyGraph.clear();
    
    this.emit('shutdown');
  }
}

// Export singleton instance
let orchestratorInstance: PluginLifecycleOrchestrator | null = null;

export function getPluginLifecycleOrchestrator(config?: Partial<OrchestrationConfig>): PluginLifecycleOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new PluginLifecycleOrchestrator(config);
  }
  return orchestratorInstance;
}

export { PluginLifecycleOrchestrator };