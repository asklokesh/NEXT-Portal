/**
 * Self-Service Action Service
 * Manages and executes self-service actions
 */

import { v4 as uuidv4 } from 'uuid';
import {
  SelfServiceAction,
  ActionExecution,
  ActionExecutionStatus,
  ActionExecutionResult,
  ActionExecutionLog,
  ActionApprovalRequest,
  ActionCategory,
  ActionContext,
} from './types';

/**
 * Action execution handler interface
 */
interface ActionHandler {
  execute(
    action: SelfServiceAction,
    parameters: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ActionExecutionResult>;

  checkStatus?(
    action: SelfServiceAction,
    executionId: string
  ): Promise<ActionExecutionStatus>;
}

/**
 * Execution context
 */
interface ExecutionContext {
  executionId: string;
  userId: string;
  entityRef?: string;
  environment?: string;
  addLog: (level: string, message: string, data?: Record<string, unknown>) => void;
}

/**
 * Self-Service Action Service
 */
export class ActionService {
  private actions: Map<string, SelfServiceAction> = new Map();
  private executions: Map<string, ActionExecution> = new Map();
  private approvals: Map<string, ActionApprovalRequest> = new Map();
  private handlers: Map<string, ActionHandler> = new Map();
  private executionLocks: Map<string, Set<string>> = new Map();

  constructor() {
    this.initializeDefaultActions();
    this.registerHandlers();
  }

  /**
   * Initialize default actions
   */
  private initializeDefaultActions(): void {
    const defaultActions: SelfServiceAction[] = [
      {
        id: 'deploy-service',
        name: 'Deploy Service',
        description: 'Deploy or redeploy a service to the specified environment',
        category: 'deployment',
        context: 'service',
        enabled: true,
        visibility: 'public',
        execution: {
          type: 'github-workflow',
          githubWorkflow: {
            owner: '${entity.spec.owner}',
            repo: '${entity.metadata.name}',
            workflow: 'deploy.yml',
            inputs: {
              environment: '${parameters.environment}',
              version: '${parameters.version}',
            },
          },
          polling: {
            enabled: true,
            interval: 5000,
            maxAttempts: 60,
          },
        },
        parameters: [
          {
            name: 'environment',
            title: 'Environment',
            type: 'environment-picker',
            required: true,
            environments: ['dev', 'staging', 'production'],
          },
          {
            name: 'version',
            title: 'Version',
            description: 'Docker image tag or commit SHA',
            type: 'string',
            required: true,
            default: 'latest',
          },
        ],
        validation: {
          requiresConfirmation: true,
          confirmationMessage: 'Are you sure you want to deploy this service?',
          riskLevel: 'medium',
        },
        ui: {
          buttonVariant: 'primary',
          buttonText: 'Deploy',
          icon: 'rocket',
          quickAction: true,
        },
        metadata: {
          owner: 'platform-team',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          totalExecutions: 1523,
          successRate: 98.2,
          averageExecutionTime: 180000,
        },
        tags: ['deployment', 'ci-cd', 'production'],
      },
      {
        id: 'restart-service',
        name: 'Restart Service',
        description: 'Restart all pods of a service in the specified environment',
        category: 'maintenance',
        context: 'service',
        enabled: true,
        visibility: 'public',
        execution: {
          type: 'kubernetes',
          kubernetes: {
            namespace: '${entity.metadata.namespace}',
            resource: 'deployment',
            action: 'restart',
          },
        },
        parameters: [
          {
            name: 'environment',
            title: 'Environment',
            type: 'environment-picker',
            required: true,
            environments: ['dev', 'staging', 'production'],
          },
        ],
        validation: {
          requiresConfirmation: true,
          riskLevel: 'low',
        },
        ui: {
          buttonVariant: 'secondary',
          icon: 'refresh-cw',
          quickAction: true,
        },
        metadata: {
          owner: 'platform-team',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          totalExecutions: 3421,
          successRate: 99.5,
          averageExecutionTime: 30000,
        },
        tags: ['maintenance', 'kubernetes', 'operations'],
      },
      {
        id: 'scale-service',
        name: 'Scale Service',
        description: 'Scale the number of replicas for a service',
        category: 'infrastructure',
        context: 'service',
        enabled: true,
        visibility: 'public',
        execution: {
          type: 'kubernetes',
          kubernetes: {
            namespace: '${entity.metadata.namespace}',
            resource: 'deployment',
            action: 'scale',
          },
        },
        parameters: [
          {
            name: 'environment',
            title: 'Environment',
            type: 'environment-picker',
            required: true,
          },
          {
            name: 'replicas',
            title: 'Replicas',
            description: 'Number of desired replicas',
            type: 'number',
            required: true,
            default: 3,
            validation: {
              min: 1,
              max: 50,
            },
          },
        ],
        validation: {
          requiresConfirmation: true,
          riskLevel: 'medium',
        },
        limits: {
          maxConcurrent: 1,
          perEntity: {
            cooldown: 60000,
          },
        },
        ui: {
          icon: 'maximize-2',
        },
        metadata: {
          owner: 'platform-team',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          totalExecutions: 892,
          successRate: 97.8,
          averageExecutionTime: 15000,
        },
        tags: ['scaling', 'kubernetes', 'infrastructure'],
      },
      {
        id: 'rollback-deployment',
        name: 'Rollback Deployment',
        description: 'Rollback to a previous deployment version',
        category: 'deployment',
        context: 'service',
        enabled: true,
        visibility: 'public',
        execution: {
          type: 'kubernetes',
          kubernetes: {
            namespace: '${entity.metadata.namespace}',
            resource: 'deployment',
            action: 'rollback',
          },
        },
        parameters: [
          {
            name: 'environment',
            title: 'Environment',
            type: 'environment-picker',
            required: true,
          },
          {
            name: 'revision',
            title: 'Revision',
            description: 'Revision number to rollback to (0 = previous)',
            type: 'number',
            required: false,
            default: 0,
          },
        ],
        validation: {
          requiresConfirmation: true,
          confirmationMessage: 'This will rollback the deployment. Are you sure?',
          riskLevel: 'high',
          requiresReasonInput: true,
        },
        requiresApproval: false,
        ui: {
          buttonVariant: 'warning',
          icon: 'rotate-ccw',
        },
        metadata: {
          owner: 'platform-team',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          totalExecutions: 234,
          successRate: 99.1,
          averageExecutionTime: 45000,
        },
        tags: ['deployment', 'rollback', 'recovery'],
      },
      {
        id: 'create-pagerduty-incident',
        name: 'Create PagerDuty Incident',
        description: 'Create a new incident in PagerDuty for this service',
        category: 'observability',
        context: 'service',
        enabled: true,
        visibility: 'public',
        execution: {
          type: 'http',
          http: {
            url: 'https://api.pagerduty.com/incidents',
            method: 'POST',
            headers: {
              'Authorization': 'Token token=${secrets.PAGERDUTY_API_KEY}',
              'Content-Type': 'application/json',
            },
            body: {
              incident: {
                type: 'incident',
                title: '${parameters.title}',
                service: {
                  id: '${entity.metadata.annotations["pagerduty.com/service-id"]}',
                  type: 'service_reference',
                },
                urgency: '${parameters.urgency}',
                body: {
                  type: 'incident_body',
                  details: '${parameters.description}',
                },
              },
            },
          },
        },
        parameters: [
          {
            name: 'title',
            title: 'Incident Title',
            type: 'string',
            required: true,
          },
          {
            name: 'description',
            title: 'Description',
            type: 'string',
            required: true,
            ui: {
              widget: 'textarea',
            },
          },
          {
            name: 'urgency',
            title: 'Urgency',
            type: 'select',
            required: true,
            default: 'high',
            options: [
              { label: 'High', value: 'high' },
              { label: 'Low', value: 'low' },
            ],
          },
        ],
        ui: {
          buttonVariant: 'danger',
          icon: 'alert-triangle',
        },
        metadata: {
          owner: 'platform-team',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          totalExecutions: 156,
          successRate: 99.8,
          averageExecutionTime: 2000,
        },
        tags: ['incident', 'pagerduty', 'alerting'],
      },
      {
        id: 'run-database-migration',
        name: 'Run Database Migration',
        description: 'Execute pending database migrations',
        category: 'database',
        context: 'service',
        enabled: true,
        visibility: 'restricted',
        allowedRoles: ['admin', 'dba', 'senior-engineer'],
        execution: {
          type: 'github-workflow',
          githubWorkflow: {
            owner: '${entity.spec.owner}',
            repo: '${entity.metadata.name}',
            workflow: 'migration.yml',
            inputs: {
              environment: '${parameters.environment}',
              dryRun: '${parameters.dryRun}',
            },
          },
        },
        parameters: [
          {
            name: 'environment',
            title: 'Environment',
            type: 'environment-picker',
            required: true,
          },
          {
            name: 'dryRun',
            title: 'Dry Run',
            description: 'Preview changes without applying',
            type: 'boolean',
            required: false,
            default: true,
          },
        ],
        validation: {
          requiresConfirmation: true,
          confirmationMessage: 'Database migrations can cause data loss. Are you sure?',
          riskLevel: 'critical',
          requiresReasonInput: true,
          preChecks: [
            {
              name: 'backup-exists',
              description: 'Verify recent backup exists',
              type: 'http',
              config: {
                url: '${backupService}/status/${entity.metadata.name}',
              },
              failureAction: 'block',
            },
          ],
        },
        requiresApproval: true,
        approvers: ['dba-team', 'tech-lead'],
        ui: {
          buttonVariant: 'danger',
          icon: 'database',
        },
        metadata: {
          owner: 'platform-team',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          totalExecutions: 89,
          successRate: 96.5,
          averageExecutionTime: 120000,
        },
        tags: ['database', 'migration', 'critical'],
      },
      {
        id: 'provision-environment',
        name: 'Provision Environment',
        description: 'Provision a new ephemeral environment for testing',
        category: 'infrastructure',
        context: 'service',
        enabled: true,
        visibility: 'public',
        execution: {
          type: 'terraform',
          terraform: {
            workspace: '${parameters.environment}-${entity.metadata.name}',
            operation: 'apply',
            variables: {
              service_name: '${entity.metadata.name}',
              ttl: '${parameters.ttl}',
            },
          },
        },
        parameters: [
          {
            name: 'environment',
            title: 'Environment Name',
            type: 'string',
            required: true,
            validation: {
              pattern: '^[a-z0-9-]+$',
              message: 'Only lowercase letters, numbers, and hyphens allowed',
              maxLength: 20,
            },
          },
          {
            name: 'ttl',
            title: 'Time to Live',
            description: 'Hours until automatic cleanup',
            type: 'select',
            required: true,
            default: '24',
            options: [
              { label: '4 hours', value: '4' },
              { label: '8 hours', value: '8' },
              { label: '24 hours', value: '24' },
              { label: '72 hours', value: '72' },
            ],
          },
        ],
        limits: {
          maxConcurrent: 3,
          maxPerDay: 10,
        },
        ui: {
          icon: 'cloud',
          buttonText: 'Create Environment',
        },
        metadata: {
          owner: 'platform-team',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          totalExecutions: 567,
          successRate: 94.3,
          averageExecutionTime: 300000,
        },
        tags: ['infrastructure', 'ephemeral', 'testing'],
      },
      {
        id: 'run-security-scan',
        name: 'Run Security Scan',
        description: 'Trigger a comprehensive security scan of the service',
        category: 'security',
        context: 'service',
        enabled: true,
        visibility: 'public',
        execution: {
          type: 'http',
          http: {
            url: '${securityService}/scan',
            method: 'POST',
            body: {
              repo: '${entity.metadata.annotations["github.com/repo"]}',
              branch: '${parameters.branch}',
              scanTypes: '${parameters.scanTypes}',
            },
          },
          polling: {
            enabled: true,
            interval: 10000,
            maxAttempts: 120,
          },
        },
        parameters: [
          {
            name: 'branch',
            title: 'Branch',
            type: 'string',
            required: true,
            default: 'main',
          },
          {
            name: 'scanTypes',
            title: 'Scan Types',
            type: 'multiselect',
            required: true,
            default: ['sast', 'dependencies'],
            options: [
              { label: 'SAST (Static Analysis)', value: 'sast' },
              { label: 'Dependencies', value: 'dependencies' },
              { label: 'Secrets Detection', value: 'secrets' },
              { label: 'Container Scanning', value: 'container' },
              { label: 'IaC Scanning', value: 'iac' },
            ],
          },
        ],
        ui: {
          icon: 'shield',
          buttonText: 'Start Scan',
        },
        metadata: {
          owner: 'security-team',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
          totalExecutions: 2341,
          successRate: 99.7,
          averageExecutionTime: 420000,
        },
        tags: ['security', 'scanning', 'compliance'],
      },
    ];

    defaultActions.forEach((action) => {
      this.actions.set(action.id, action);
    });
  }

  /**
   * Register action handlers
   */
  private registerHandlers(): void {
    // HTTP handler
    this.handlers.set('http', {
      execute: async (action, parameters, context) => {
        const config = action.execution.http;
        if (!config) {
          return { success: false, error: { code: 'NO_CONFIG', message: 'HTTP config missing' } };
        }

        context.addLog('info', `Making HTTP ${config.method} request to ${config.url}`);

        // In production, this would make actual HTTP requests
        // Simulating successful execution
        await new Promise((resolve) => setTimeout(resolve, 1000));

        context.addLog('info', 'HTTP request completed successfully');

        return {
          success: true,
          message: 'Action executed successfully',
          outputs: {
            statusCode: 200,
            response: { status: 'ok' },
          },
        };
      },
    });

    // GitHub Workflow handler
    this.handlers.set('github-workflow', {
      execute: async (action, parameters, context) => {
        const config = action.execution.githubWorkflow;
        if (!config) {
          return { success: false, error: { code: 'NO_CONFIG', message: 'GitHub workflow config missing' } };
        }

        context.addLog('info', `Triggering GitHub workflow: ${config.workflow}`);
        context.addLog('info', `Repository: ${config.owner}/${config.repo}`);

        // Simulate workflow trigger
        await new Promise((resolve) => setTimeout(resolve, 2000));

        return {
          success: true,
          message: 'Workflow triggered successfully',
          outputs: {
            runId: `run-${Date.now()}`,
            workflowUrl: `https://github.com/${config.owner}/${config.repo}/actions`,
          },
          links: [
            {
              label: 'View Workflow Run',
              url: `https://github.com/${config.owner}/${config.repo}/actions`,
              icon: 'github',
            },
          ],
        };
      },
    });

    // Kubernetes handler
    this.handlers.set('kubernetes', {
      execute: async (action, parameters, context) => {
        const config = action.execution.kubernetes;
        if (!config) {
          return { success: false, error: { code: 'NO_CONFIG', message: 'Kubernetes config missing' } };
        }

        context.addLog('info', `Executing Kubernetes ${config.action} on ${config.resource}`);
        context.addLog('info', `Namespace: ${config.namespace}`);

        // Simulate k8s operation
        await new Promise((resolve) => setTimeout(resolve, 1500));

        return {
          success: true,
          message: `${config.action} completed successfully`,
          outputs: {
            resource: config.resource,
            namespace: config.namespace,
            action: config.action,
          },
        };
      },
    });

    // Terraform handler
    this.handlers.set('terraform', {
      execute: async (action, parameters, context) => {
        const config = action.execution.terraform;
        if (!config) {
          return { success: false, error: { code: 'NO_CONFIG', message: 'Terraform config missing' } };
        }

        context.addLog('info', `Running Terraform ${config.operation}`);
        context.addLog('info', `Workspace: ${config.workspace}`);

        // Simulate terraform operation
        await new Promise((resolve) => setTimeout(resolve, 5000));

        return {
          success: true,
          message: `Terraform ${config.operation} completed`,
          outputs: {
            workspace: config.workspace,
            operation: config.operation,
            resourcesCreated: 5,
            resourcesModified: 2,
          },
        };
      },
    });
  }

  /**
   * Get all actions
   */
  async getActions(filters?: {
    category?: ActionCategory;
    context?: ActionContext;
    entityType?: string;
    searchQuery?: string;
    onlyEnabled?: boolean;
  }): Promise<SelfServiceAction[]> {
    let actions = Array.from(this.actions.values());

    if (filters?.onlyEnabled !== false) {
      actions = actions.filter((a) => a.enabled);
    }

    if (filters?.category) {
      actions = actions.filter((a) => a.category === filters.category);
    }

    if (filters?.context) {
      actions = actions.filter((a) => a.context === filters.context);
    }

    if (filters?.entityType) {
      actions = actions.filter(
        (a) => !a.allowedEntityTypes || a.allowedEntityTypes.includes(filters.entityType!)
      );
    }

    if (filters?.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      actions = actions.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.description.toLowerCase().includes(query) ||
          a.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    return actions;
  }

  /**
   * Get a single action by ID
   */
  async getAction(id: string): Promise<SelfServiceAction | undefined> {
    return this.actions.get(id);
  }

  /**
   * Create a new action
   */
  async createAction(action: Omit<SelfServiceAction, 'id'>): Promise<SelfServiceAction> {
    const id = uuidv4();
    const newAction: SelfServiceAction = {
      ...action,
      id,
      metadata: {
        ...action.metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalExecutions: 0,
        successRate: 0,
      },
    };
    this.actions.set(id, newAction);
    return newAction;
  }

  /**
   * Update an action
   */
  async updateAction(id: string, updates: Partial<SelfServiceAction>): Promise<SelfServiceAction | undefined> {
    const action = this.actions.get(id);
    if (!action) return undefined;

    const updated: SelfServiceAction = {
      ...action,
      ...updates,
      id, // Ensure ID doesn't change
      metadata: {
        ...action.metadata,
        ...updates.metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    this.actions.set(id, updated);
    return updated;
  }

  /**
   * Delete an action
   */
  async deleteAction(id: string): Promise<boolean> {
    return this.actions.delete(id);
  }

  /**
   * Execute an action
   */
  async executeAction(
    actionId: string,
    parameters: Record<string, unknown>,
    userId: string,
    options?: {
      entityRef?: string;
      environment?: string;
      skipApproval?: boolean;
    }
  ): Promise<ActionExecution> {
    const action = this.actions.get(actionId);
    if (!action) {
      throw new Error(`Action not found: ${actionId}`);
    }

    if (!action.enabled) {
      throw new Error('Action is disabled');
    }

    // Check execution limits
    await this.checkLimits(action, options?.entityRef);

    // Validate parameters
    this.validateParameters(action, parameters);

    // Create execution record
    const executionId = uuidv4();
    const execution: ActionExecution = {
      id: executionId,
      actionId: action.id,
      actionName: action.name,
      entityRef: options?.entityRef,
      environment: options?.environment,
      status: 'pending',
      triggeredBy: userId,
      triggerType: 'manual',
      parameters,
      startedAt: new Date().toISOString(),
      logs: [],
    };

    // Check if approval is required
    if (action.requiresApproval && !options?.skipApproval) {
      execution.status = 'pending';
      execution.approvalStatus = 'pending';

      // Create approval request
      const approvalRequest: ActionApprovalRequest = {
        id: uuidv4(),
        executionId,
        action,
        requestedBy: userId,
        requestedAt: new Date().toISOString(),
        parameters,
        entityRef: options?.entityRef,
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
      };
      this.approvals.set(approvalRequest.id, approvalRequest);
      this.executions.set(executionId, execution);

      return execution;
    }

    // Execute the action
    this.executions.set(executionId, execution);
    this.runExecution(execution, action).catch(console.error);

    return execution;
  }

  /**
   * Run the actual execution
   */
  private async runExecution(execution: ActionExecution, action: SelfServiceAction): Promise<void> {
    execution.status = 'running';
    this.executions.set(execution.id, execution);

    const logs: ActionExecutionLog[] = [];
    const addLog = (level: string, message: string, data?: Record<string, unknown>) => {
      logs.push({
        timestamp: new Date().toISOString(),
        level: level as ActionExecutionLog['level'],
        message,
        data,
      });
    };

    const context: ExecutionContext = {
      executionId: execution.id,
      userId: execution.triggeredBy,
      entityRef: execution.entityRef,
      environment: execution.environment,
      addLog,
    };

    try {
      // Add execution lock
      this.addExecutionLock(action.id, execution.entityRef || 'global');

      addLog('info', `Starting execution of action: ${action.name}`);

      // Get handler
      const handler = this.handlers.get(action.execution.type);
      if (!handler) {
        throw new Error(`No handler for execution type: ${action.execution.type}`);
      }

      // Execute
      const result = await handler.execute(action, execution.parameters, context);

      execution.result = result;
      execution.status = result.success ? 'completed' : 'failed';
      execution.completedAt = new Date().toISOString();
      execution.duration =
        new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime();

      addLog(result.success ? 'info' : 'error', `Execution ${result.success ? 'completed' : 'failed'}`);

      // Update action metadata
      const actionRecord = this.actions.get(action.id);
      if (actionRecord) {
        actionRecord.metadata.totalExecutions++;
        actionRecord.metadata.lastExecutedAt = execution.completedAt;
        if (result.success) {
          actionRecord.metadata.successRate =
            ((actionRecord.metadata.successRate * (actionRecord.metadata.totalExecutions - 1) + 100) /
              actionRecord.metadata.totalExecutions);
        } else {
          actionRecord.metadata.successRate =
            (actionRecord.metadata.successRate * (actionRecord.metadata.totalExecutions - 1)) /
            actionRecord.metadata.totalExecutions;
        }
        if (execution.duration) {
          actionRecord.metadata.averageExecutionTime = actionRecord.metadata.averageExecutionTime
            ? (actionRecord.metadata.averageExecutionTime + execution.duration) / 2
            : execution.duration;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `Execution failed: ${message}`);

      execution.status = 'failed';
      execution.completedAt = new Date().toISOString();
      execution.result = {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message,
        },
      };
    } finally {
      execution.logs = logs;
      this.executions.set(execution.id, execution);
      this.removeExecutionLock(action.id, execution.entityRef || 'global');
    }
  }

  /**
   * Check execution limits
   */
  private async checkLimits(action: SelfServiceAction, entityRef?: string): Promise<void> {
    const limits = action.limits;
    if (!limits) return;

    // Check concurrent executions
    if (limits.maxConcurrent) {
      const locks = this.executionLocks.get(action.id);
      if (locks && locks.size >= limits.maxConcurrent) {
        throw new Error('Maximum concurrent executions reached');
      }
    }

    // Check per-entity limits
    if (limits.perEntity?.maxConcurrent && entityRef) {
      const locks = this.executionLocks.get(action.id);
      if (locks && locks.has(entityRef)) {
        throw new Error('Action is already running for this entity');
      }
    }
  }

  /**
   * Validate action parameters
   */
  private validateParameters(action: SelfServiceAction, parameters: Record<string, unknown>): void {
    for (const param of action.parameters) {
      const value = parameters[param.name];

      // Check required
      if (param.required && (value === undefined || value === null || value === '')) {
        throw new Error(`Required parameter missing: ${param.title}`);
      }

      if (value === undefined || value === null) continue;

      // Check validation rules
      if (param.validation) {
        if (param.validation.pattern) {
          const regex = new RegExp(param.validation.pattern);
          if (!regex.test(String(value))) {
            throw new Error(param.validation.message || `Invalid format for ${param.title}`);
          }
        }

        if (typeof value === 'number') {
          if (param.validation.min !== undefined && value < param.validation.min) {
            throw new Error(`${param.title} must be at least ${param.validation.min}`);
          }
          if (param.validation.max !== undefined && value > param.validation.max) {
            throw new Error(`${param.title} must be at most ${param.validation.max}`);
          }
        }

        if (typeof value === 'string') {
          if (param.validation.minLength && value.length < param.validation.minLength) {
            throw new Error(`${param.title} must be at least ${param.validation.minLength} characters`);
          }
          if (param.validation.maxLength && value.length > param.validation.maxLength) {
            throw new Error(`${param.title} must be at most ${param.validation.maxLength} characters`);
          }
        }
      }
    }
  }

  /**
   * Add execution lock
   */
  private addExecutionLock(actionId: string, key: string): void {
    if (!this.executionLocks.has(actionId)) {
      this.executionLocks.set(actionId, new Set());
    }
    this.executionLocks.get(actionId)!.add(key);
  }

  /**
   * Remove execution lock
   */
  private removeExecutionLock(actionId: string, key: string): void {
    this.executionLocks.get(actionId)?.delete(key);
  }

  /**
   * Get execution by ID
   */
  async getExecution(id: string): Promise<ActionExecution | undefined> {
    return this.executions.get(id);
  }

  /**
   * Get executions for an action
   */
  async getExecutions(filters?: {
    actionId?: string;
    entityRef?: string;
    status?: ActionExecutionStatus;
    triggeredBy?: string;
    limit?: number;
  }): Promise<ActionExecution[]> {
    let executions = Array.from(this.executions.values());

    if (filters?.actionId) {
      executions = executions.filter((e) => e.actionId === filters.actionId);
    }

    if (filters?.entityRef) {
      executions = executions.filter((e) => e.entityRef === filters.entityRef);
    }

    if (filters?.status) {
      executions = executions.filter((e) => e.status === filters.status);
    }

    if (filters?.triggeredBy) {
      executions = executions.filter((e) => e.triggeredBy === filters.triggeredBy);
    }

    // Sort by start time descending
    executions.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    if (filters?.limit) {
      executions = executions.slice(0, filters.limit);
    }

    return executions;
  }

  /**
   * Approve an action
   */
  async approveAction(
    approvalId: string,
    reviewerId: string,
    approved: boolean,
    comment?: string
  ): Promise<ActionApprovalRequest | undefined> {
    const approval = this.approvals.get(approvalId);
    if (!approval) return undefined;

    approval.status = approved ? 'approved' : 'rejected';
    approval.reviewedBy = reviewerId;
    approval.reviewedAt = new Date().toISOString();
    approval.reviewComment = comment;

    this.approvals.set(approvalId, approval);

    // Update execution
    const execution = this.executions.get(approval.executionId);
    if (execution) {
      execution.approvalStatus = approval.status;
      execution.approvedBy = reviewerId;

      if (approved) {
        // Execute the action
        const action = this.actions.get(execution.actionId);
        if (action) {
          this.runExecution(execution, action).catch(console.error);
        }
      } else {
        execution.status = 'cancelled';
        execution.completedAt = new Date().toISOString();
      }

      this.executions.set(execution.id, execution);
    }

    return approval;
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals(approverId?: string): Promise<ActionApprovalRequest[]> {
    let approvals = Array.from(this.approvals.values()).filter(
      (a) => a.status === 'pending'
    );

    // Filter by approver if specified
    // In production, this would check if approverId is in action.approvers

    return approvals;
  }

  /**
   * Get quick actions for an entity
   */
  async getQuickActions(entityType: string): Promise<SelfServiceAction[]> {
    const actions = await this.getActions({
      context: 'service',
      entityType,
    });

    return actions.filter((a) => a.ui?.quickAction);
  }
}

// Singleton instance
let actionServiceInstance: ActionService | null = null;

export function getActionService(): ActionService {
  if (!actionServiceInstance) {
    actionServiceInstance = new ActionService();
  }
  return actionServiceInstance;
}

export default ActionService;
