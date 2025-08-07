import { z } from 'zod';
import { EventEmitter } from 'events';
import { addDays, addMonths, isBefore, isAfter, parseISO } from 'date-fns';
import { 
  LifecycleStage, 
  TransitionTrigger, 
  LifecycleEntity, 
  LifecycleMetrics,
  lifecycleManager 
} from './LifecycleManager';

// Rule condition types
export enum RuleConditionType {
  METRIC_THRESHOLD = 'metric_threshold',
  TIME_BASED = 'time_based',
  HEALTH_CHECK = 'health_check',
  USAGE_PATTERN = 'usage_pattern',
  DEPENDENCY_CHECK = 'dependency_check',
  COMPLIANCE_CHECK = 'compliance_check',
  CUSTOM = 'custom'
}

export enum RuleOperator {
  GREATER_THAN = 'gt',
  LESS_THAN = 'lt',
  GREATER_THAN_OR_EQUAL = 'gte',
  LESS_THAN_OR_EQUAL = 'lte',
  EQUALS = 'eq',
  NOT_EQUALS = 'neq',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  IN = 'in',
  NOT_IN = 'not_in'
}

export enum RuleAction {
  TRANSITION_TO_STAGE = 'transition_to_stage',
  SEND_NOTIFICATION = 'send_notification',
  CREATE_TICKET = 'create_ticket',
  SCHEDULE_DEPRECATION = 'schedule_deprecation',
  UPDATE_METADATA = 'update_metadata',
  TRIGGER_WORKFLOW = 'trigger_workflow'
}

export enum RulePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RuleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}

// Schema definitions
export const RuleConditionSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(RuleConditionType),
  field: z.string(),
  operator: z.nativeEnum(RuleOperator),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.any())]),
  metadata: z.record(z.any()).optional()
});

export const RuleActionSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(RuleAction),
  parameters: z.record(z.any()),
  metadata: z.record(z.any()).optional()
});

export const LifecycleRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  priority: z.nativeEnum(RulePriority),
  status: z.nativeEnum(RuleStatus),
  conditions: z.array(RuleConditionSchema),
  conditionLogic: z.enum(['AND', 'OR']).default('AND'),
  actions: z.array(RuleActionSchema),
  applicableStages: z.array(z.nativeEnum(LifecycleStage)),
  entityFilters: z.object({
    kinds: z.array(z.string()).optional(),
    namespaces: z.array(z.string()).optional(),
    owners: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional()
  }).optional(),
  cooldownPeriod: z.number().min(0).default(0), // Minutes
  maxExecutions: z.number().min(1).optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  createdBy: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastExecuted: z.string().datetime().optional(),
  executionCount: z.number().min(0).default(0),
  manualOverrideEnabled: z.boolean().default(true)
});

export const RuleExecutionLogSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  entityId: z.string(),
  timestamp: z.string().datetime(),
  conditions: z.array(z.object({
    conditionId: z.string(),
    result: z.boolean(),
    actualValue: z.any(),
    expectedValue: z.any()
  })),
  overallResult: z.boolean(),
  actionsExecuted: z.array(z.string()),
  executionTime: z.number().min(0),
  errors: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

export type RuleCondition = z.infer<typeof RuleConditionSchema>;
export type RuleAction = z.infer<typeof RuleActionSchema>;
export type LifecycleRule = z.infer<typeof LifecycleRuleSchema>;
export type RuleExecutionLog = z.infer<typeof RuleExecutionLogSchema>;

// Rule Engine Interface
export interface ILifecycleRulesEngine {
  // Rule management
  createRule(rule: Omit<LifecycleRule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<LifecycleRule>;
  updateRule(id: string, updates: Partial<LifecycleRule>): Promise<LifecycleRule>;
  deleteRule(id: string): Promise<void>;
  getRule(id: string): Promise<LifecycleRule | null>;
  getRules(filters?: { status?: RuleStatus; priority?: RulePriority; stage?: LifecycleStage }): Promise<LifecycleRule[]>;
  
  // Rule execution
  evaluateRules(entity: LifecycleEntity): Promise<RuleExecutionLog[]>;
  evaluateRule(rule: LifecycleRule, entity: LifecycleEntity): Promise<RuleExecutionLog>;
  executeRuleActions(rule: LifecycleRule, entity: LifecycleEntity): Promise<void>;
  
  // Manual overrides
  enableManualOverride(ruleId: string, entityId: string, reason: string, overriddenBy: string): Promise<void>;
  disableManualOverride(ruleId: string, entityId: string): Promise<void>;
  getManualOverrides(ruleId?: string): Promise<any[]>;
  
  // Monitoring and analytics
  getRuleExecutionHistory(ruleId?: string, days?: number): Promise<RuleExecutionLog[]>;
  getRulePerformanceMetrics(ruleId: string): Promise<any>;
  exportRuleConfiguration(): Promise<string>;
  importRuleConfiguration(config: string): Promise<void>;
}

export class LifecycleRulesEngine extends EventEmitter implements ILifecycleRulesEngine {
  private rules = new Map<string, LifecycleRule>();
  private executionLogs = new Map<string, RuleExecutionLog>();
  private manualOverrides = new Map<string, any[]>();
  private lastExecutionTime = new Map<string, Date>();

  constructor() {
    super();
    this.setupDefaultRules();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen to lifecycle manager events
    lifecycleManager.on('metrics_updated', this.handleMetricsUpdate.bind(this));
    lifecycleManager.on('entity_updated', this.handleEntityUpdate.bind(this));
    lifecycleManager.on('automated_rules_check', this.runAutomatedEvaluation.bind(this));
  }

  async createRule(rule: Omit<LifecycleRule, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<LifecycleRule> {
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const fullRule: LifecycleRule = {
      ...rule,
      id: ruleId,
      createdAt: now,
      updatedAt: now,
      executionCount: 0
    };

    const validatedRule = LifecycleRuleSchema.parse(fullRule);
    this.rules.set(ruleId, validatedRule);

    this.emit('rule_created', validatedRule);
    return validatedRule;
  }

  async updateRule(id: string, updates: Partial<LifecycleRule>): Promise<LifecycleRule> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule with id ${id} not found`);
    }

    const updatedRule: LifecycleRule = {
      ...rule,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const validatedRule = LifecycleRuleSchema.parse(updatedRule);
    this.rules.set(id, validatedRule);

    this.emit('rule_updated', validatedRule);
    return validatedRule;
  }

  async deleteRule(id: string): Promise<void> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule with id ${id} not found`);
    }

    this.rules.delete(id);
    this.emit('rule_deleted', rule);
  }

  async getRule(id: string): Promise<LifecycleRule | null> {
    return this.rules.get(id) || null;
  }

  async getRules(filters?: { status?: RuleStatus; priority?: RulePriority; stage?: LifecycleStage }): Promise<LifecycleRule[]> {
    let rules = Array.from(this.rules.values());

    if (filters) {
      if (filters.status) {
        rules = rules.filter(rule => rule.status === filters.status);
      }
      if (filters.priority) {
        rules = rules.filter(rule => rule.priority === filters.priority);
      }
      if (filters.stage) {
        rules = rules.filter(rule => rule.applicableStages.includes(filters.stage!));
      }
    }

    return rules.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  async evaluateRules(entity: LifecycleEntity): Promise<RuleExecutionLog[]> {
    const applicableRules = await this.getApplicableRules(entity);
    const executionLogs: RuleExecutionLog[] = [];

    for (const rule of applicableRules) {
      try {
        const log = await this.evaluateRule(rule, entity);
        executionLogs.push(log);

        if (log.overallResult) {
          await this.executeRuleActions(rule, entity);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id} for entity ${entity.id}:`, error);
      }
    }

    return executionLogs;
  }

  async evaluateRule(rule: LifecycleRule, entity: LifecycleEntity): Promise<RuleExecutionLog> {
    const startTime = Date.now();
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check cooldown period
    if (rule.cooldownPeriod > 0) {
      const lastExecution = this.lastExecutionTime.get(rule.id);
      if (lastExecution && Date.now() - lastExecution.getTime() < rule.cooldownPeriod * 60 * 1000) {
        return this.createExecutionLog(logId, rule, entity, [], false, Date.now() - startTime, ['Rule in cooldown period']);
      }
    }

    // Check execution limits
    if (rule.maxExecutions && rule.executionCount >= rule.maxExecutions) {
      return this.createExecutionLog(logId, rule, entity, [], false, Date.now() - startTime, ['Maximum executions reached']);
    }

    // Check validity period
    const now = new Date();
    if (rule.validFrom && isBefore(now, parseISO(rule.validFrom))) {
      return this.createExecutionLog(logId, rule, entity, [], false, Date.now() - startTime, ['Rule not yet valid']);
    }
    if (rule.validUntil && isAfter(now, parseISO(rule.validUntil))) {
      return this.createExecutionLog(logId, rule, entity, [], false, Date.now() - startTime, ['Rule expired']);
    }

    // Check manual override
    const overrideKey = `${rule.id}_${entity.id}`;
    if (this.manualOverrides.has(overrideKey)) {
      return this.createExecutionLog(logId, rule, entity, [], false, Date.now() - startTime, ['Manual override active']);
    }

    // Evaluate conditions
    const conditionResults = [];
    const errors: string[] = [];

    for (const condition of rule.conditions) {
      try {
        const result = await this.evaluateCondition(condition, entity);
        conditionResults.push(result);
      } catch (error) {
        errors.push(`Condition ${condition.id}: ${error}`);
        conditionResults.push({
          conditionId: condition.id,
          result: false,
          actualValue: null,
          expectedValue: condition.value
        });
      }
    }

    // Apply condition logic
    const overallResult = rule.conditionLogic === 'AND' 
      ? conditionResults.every(r => r.result)
      : conditionResults.some(r => r.result);

    // Update execution tracking
    rule.executionCount++;
    rule.lastExecuted = new Date().toISOString();
    this.rules.set(rule.id, rule);
    this.lastExecutionTime.set(rule.id, new Date());

    const executionLog = this.createExecutionLog(
      logId, 
      rule, 
      entity, 
      conditionResults, 
      overallResult, 
      Date.now() - startTime, 
      errors
    );

    this.executionLogs.set(logId, executionLog);
    this.emit('rule_evaluated', executionLog);

    return executionLog;
  }

  async executeRuleActions(rule: LifecycleRule, entity: LifecycleEntity): Promise<void> {
    for (const action of rule.actions) {
      try {
        await this.executeAction(action, entity, rule);
      } catch (error) {
        console.error(`Error executing action ${action.id} for rule ${rule.id}:`, error);
        this.emit('action_error', { rule, action, entity, error });
      }
    }
  }

  async enableManualOverride(ruleId: string, entityId: string, reason: string, overriddenBy: string): Promise<void> {
    const overrideKey = `${ruleId}_${entityId}`;
    const override = {
      ruleId,
      entityId,
      reason,
      overriddenBy,
      timestamp: new Date().toISOString()
    };

    if (!this.manualOverrides.has(overrideKey)) {
      this.manualOverrides.set(overrideKey, []);
    }
    
    this.manualOverrides.get(overrideKey)!.push(override);
    this.emit('manual_override_enabled', override);
  }

  async disableManualOverride(ruleId: string, entityId: string): Promise<void> {
    const overrideKey = `${ruleId}_${entityId}`;
    this.manualOverrides.delete(overrideKey);
    this.emit('manual_override_disabled', { ruleId, entityId });
  }

  async getManualOverrides(ruleId?: string): Promise<any[]> {
    const allOverrides = Array.from(this.manualOverrides.entries())
      .flatMap(([key, overrides]) => overrides);

    if (ruleId) {
      return allOverrides.filter(override => override.ruleId === ruleId);
    }

    return allOverrides;
  }

  async getRuleExecutionHistory(ruleId?: string, days = 30): Promise<RuleExecutionLog[]> {
    const cutoffDate = addDays(new Date(), -days);
    let logs = Array.from(this.executionLogs.values())
      .filter(log => isAfter(parseISO(log.timestamp), cutoffDate));

    if (ruleId) {
      logs = logs.filter(log => log.ruleId === ruleId);
    }

    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async getRulePerformanceMetrics(ruleId: string): Promise<any> {
    const logs = await this.getRuleExecutionHistory(ruleId);
    
    const totalExecutions = logs.length;
    const successfulExecutions = logs.filter(log => log.overallResult).length;
    const averageExecutionTime = logs.reduce((sum, log) => sum + log.executionTime, 0) / totalExecutions || 0;
    const errorRate = logs.filter(log => log.errors && log.errors.length > 0).length / totalExecutions || 0;

    return {
      ruleId,
      totalExecutions,
      successfulExecutions,
      successRate: successfulExecutions / totalExecutions || 0,
      averageExecutionTime,
      errorRate,
      lastExecution: logs[0]?.timestamp
    };
  }

  async exportRuleConfiguration(): Promise<string> {
    const config = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      rules: Array.from(this.rules.values())
    };

    return JSON.stringify(config, null, 2);
  }

  async importRuleConfiguration(config: string): Promise<void> {
    try {
      const parsed = JSON.parse(config);
      
      for (const ruleData of parsed.rules) {
        const { id, createdAt, updatedAt, executionCount, ...ruleWithoutIds } = ruleData;
        await this.createRule(ruleWithoutIds);
      }

      this.emit('rules_imported', { count: parsed.rules.length });
    } catch (error) {
      throw new Error(`Failed to import rule configuration: ${error}`);
    }
  }

  private async getApplicableRules(entity: LifecycleEntity): Promise<LifecycleRule[]> {
    const allRules = Array.from(this.rules.values());
    
    return allRules.filter(rule => {
      // Check if rule is enabled and active
      if (!rule.enabled || rule.status !== RuleStatus.ACTIVE) {
        return false;
      }

      // Check if rule applies to current stage
      if (!rule.applicableStages.includes(entity.currentStage)) {
        return false;
      }

      // Check entity filters
      if (rule.entityFilters) {
        if (rule.entityFilters.kinds && !rule.entityFilters.kinds.includes(entity.kind)) {
          return false;
        }
        if (rule.entityFilters.namespaces && !rule.entityFilters.namespaces.includes(entity.namespace)) {
          return false;
        }
        if (rule.entityFilters.owners && !rule.entityFilters.owners.some(owner => entity.owners.includes(owner))) {
          return false;
        }
      }

      return true;
    });
  }

  private async evaluateCondition(condition: RuleCondition, entity: LifecycleEntity): Promise<any> {
    const actualValue = this.getFieldValue(condition.field, entity);
    
    let result = false;
    
    switch (condition.operator) {
      case RuleOperator.GREATER_THAN:
        result = actualValue > condition.value;
        break;
      case RuleOperator.LESS_THAN:
        result = actualValue < condition.value;
        break;
      case RuleOperator.GREATER_THAN_OR_EQUAL:
        result = actualValue >= condition.value;
        break;
      case RuleOperator.LESS_THAN_OR_EQUAL:
        result = actualValue <= condition.value;
        break;
      case RuleOperator.EQUALS:
        result = actualValue === condition.value;
        break;
      case RuleOperator.NOT_EQUALS:
        result = actualValue !== condition.value;
        break;
      case RuleOperator.CONTAINS:
        result = String(actualValue).includes(String(condition.value));
        break;
      case RuleOperator.NOT_CONTAINS:
        result = !String(actualValue).includes(String(condition.value));
        break;
      case RuleOperator.IN:
        result = Array.isArray(condition.value) && condition.value.includes(actualValue);
        break;
      case RuleOperator.NOT_IN:
        result = Array.isArray(condition.value) && !condition.value.includes(actualValue);
        break;
    }

    return {
      conditionId: condition.id,
      result,
      actualValue,
      expectedValue: condition.value
    };
  }

  private getFieldValue(fieldPath: string, entity: LifecycleEntity): any {
    const parts = fieldPath.split('.');
    let value: any = entity;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private async executeAction(action: RuleAction, entity: LifecycleEntity, rule: LifecycleRule): Promise<void> {
    switch (action.type) {
      case RuleAction.TRANSITION_TO_STAGE:
        await this.executeTransitionAction(action, entity, rule);
        break;
      case RuleAction.SEND_NOTIFICATION:
        await this.executeSendNotificationAction(action, entity, rule);
        break;
      case RuleAction.CREATE_TICKET:
        await this.executeCreateTicketAction(action, entity, rule);
        break;
      case RuleAction.SCHEDULE_DEPRECATION:
        await this.executeScheduleDeprecationAction(action, entity, rule);
        break;
      case RuleAction.UPDATE_METADATA:
        await this.executeUpdateMetadataAction(action, entity, rule);
        break;
      case RuleAction.TRIGGER_WORKFLOW:
        await this.executeTriggerWorkflowAction(action, entity, rule);
        break;
    }
  }

  private async executeTransitionAction(action: RuleAction, entity: LifecycleEntity, rule: LifecycleRule): Promise<void> {
    const targetStage = action.parameters.targetStage as LifecycleStage;
    const reason = action.parameters.reason || `Automated transition triggered by rule: ${rule.name}`;

    await lifecycleManager.requestTransition(
      entity.id,
      targetStage,
      reason,
      'system',
      TransitionTrigger.AUTOMATED,
      { ruleId: rule.id, actionId: action.id }
    );
  }

  private async executeSendNotificationAction(action: RuleAction, entity: LifecycleEntity, rule: LifecycleRule): Promise<void> {
    // This would integrate with the notification system
    this.emit('send_notification', {
      recipients: action.parameters.recipients || entity.stakeholders,
      subject: action.parameters.subject || `Rule triggered for ${entity.name}`,
      message: action.parameters.message || `Rule "${rule.name}" has been triggered for entity ${entity.name}`,
      entity,
      rule
    });
  }

  private async executeCreateTicketAction(action: RuleAction, entity: LifecycleEntity, rule: LifecycleRule): Promise<void> {
    // This would integrate with ticketing systems
    this.emit('create_ticket', {
      title: action.parameters.title || `Action required for ${entity.name}`,
      description: action.parameters.description || `Rule "${rule.name}" requires attention`,
      assignee: action.parameters.assignee || entity.owners[0],
      priority: action.parameters.priority || rule.priority,
      entity,
      rule
    });
  }

  private async executeScheduleDeprecationAction(action: RuleAction, entity: LifecycleEntity, rule: LifecycleRule): Promise<void> {
    const daysUntilDeprecation = action.parameters.daysUntilDeprecation || 90;
    const scheduledDate = addDays(new Date(), daysUntilDeprecation);

    await lifecycleManager.scheduleDeprecation({
      entityId: entity.id,
      scheduledDate: scheduledDate.toISOString(),
      notificationDates: [
        addDays(scheduledDate, -30).toISOString(),
        addDays(scheduledDate, -7).toISOString(),
        addDays(scheduledDate, -1).toISOString()
      ],
      reason: action.parameters.reason || `Automated deprecation scheduled by rule: ${rule.name}`,
      migrationPlan: action.parameters.migrationPlan,
      replacementService: action.parameters.replacementService,
      approvals: [],
      createdBy: 'system'
    });
  }

  private async executeUpdateMetadataAction(action: RuleAction, entity: LifecycleEntity, rule: LifecycleRule): Promise<void> {
    // This would update entity metadata
    this.emit('update_metadata', {
      entityId: entity.id,
      updates: action.parameters.updates,
      rule
    });
  }

  private async executeTriggerWorkflowAction(action: RuleAction, entity: LifecycleEntity, rule: LifecycleRule): Promise<void> {
    // This would trigger external workflows
    this.emit('trigger_workflow', {
      workflowId: action.parameters.workflowId,
      parameters: action.parameters.workflowParameters || {},
      entity,
      rule
    });
  }

  private createExecutionLog(
    id: string,
    rule: LifecycleRule,
    entity: LifecycleEntity,
    conditions: any[],
    overallResult: boolean,
    executionTime: number,
    errors?: string[]
  ): RuleExecutionLog {
    return {
      id,
      ruleId: rule.id,
      entityId: entity.id,
      timestamp: new Date().toISOString(),
      conditions,
      overallResult,
      actionsExecuted: overallResult ? rule.actions.map(a => a.id) : [],
      executionTime,
      errors
    };
  }

  private async handleMetricsUpdate(entityId: string, metrics: LifecycleMetrics): Promise<void> {
    const entity = await lifecycleManager.getEntity(entityId);
    if (entity) {
      await this.evaluateRules(entity);
    }
  }

  private async handleEntityUpdate(entity: LifecycleEntity): Promise<void> {
    await this.evaluateRules(entity);
  }

  private async runAutomatedEvaluation(): Promise<void> {
    // Get all entities and evaluate rules
    const allStages = Object.values(LifecycleStage);
    for (const stage of allStages) {
      const entities = await lifecycleManager.getEntitiesByStage(stage);
      for (const entity of entities) {
        await this.evaluateRules(entity);
      }
    }
  }

  private setupDefaultRules(): void {
    // Set up some default rules for common scenarios
    this.createDefaultHealthCheckRule();
    this.createDefaultUsageRule();
    this.createDefaultDeprecationRule();
    this.createDefaultSecurityRule();
  }

  private async createDefaultHealthCheckRule(): Promise<void> {
    await this.createRule({
      name: 'Auto-deprecate unhealthy services',
      description: 'Automatically deprecate services with poor health metrics',
      enabled: true,
      priority: RulePriority.HIGH,
      status: RuleStatus.ACTIVE,
      conditions: [
        {
          id: 'uptime_check',
          type: RuleConditionType.HEALTH_CHECK,
          field: 'metrics.health.uptime',
          operator: RuleOperator.LESS_THAN,
          value: 0.95
        },
        {
          id: 'error_rate_check',
          type: RuleConditionType.METRIC_THRESHOLD,
          field: 'metrics.usage.errorRate',
          operator: RuleOperator.GREATER_THAN,
          value: 0.1
        }
      ],
      conditionLogic: 'OR',
      actions: [
        {
          id: 'notify_owners',
          type: RuleAction.SEND_NOTIFICATION,
          parameters: {
            subject: 'Service health degraded',
            message: 'Your service is showing poor health metrics and may need attention'
          }
        }
      ],
      applicableStages: [LifecycleStage.PRODUCTION, LifecycleStage.MATURE],
      cooldownPeriod: 1440, // 24 hours
      createdBy: 'system'
    });
  }

  private async createDefaultUsageRule(): Promise<void> {
    await this.createRule({
      name: 'Auto-deprecate unused services',
      description: 'Automatically flag services with no usage for deprecation',
      enabled: true,
      priority: RulePriority.MEDIUM,
      status: RuleStatus.ACTIVE,
      conditions: [
        {
          id: 'daily_users_check',
          type: RuleConditionType.USAGE_PATTERN,
          field: 'metrics.usage.dailyActiveUsers',
          operator: RuleOperator.EQUALS,
          value: 0
        },
        {
          id: 'api_calls_check',
          type: RuleConditionType.USAGE_PATTERN,
          field: 'metrics.usage.apiCallsPerDay',
          operator: RuleOperator.EQUALS,
          value: 0
        }
      ],
      conditionLogic: 'AND',
      actions: [
        {
          id: 'schedule_deprecation',
          type: RuleAction.SCHEDULE_DEPRECATION,
          parameters: {
            daysUntilDeprecation: 90,
            reason: 'Service has no active usage'
          }
        }
      ],
      applicableStages: [LifecycleStage.PRODUCTION, LifecycleStage.MATURE],
      cooldownPeriod: 10080, // 1 week
      createdBy: 'system'
    });
  }

  private async createDefaultDeprecationRule(): Promise<void> {
    await this.createRule({
      name: 'Auto-retire deprecated services',
      description: 'Automatically retire services that have been deprecated for 6 months',
      enabled: true,
      priority: RulePriority.HIGH,
      status: RuleStatus.ACTIVE,
      conditions: [
        {
          id: 'deprecation_time_check',
          type: RuleConditionType.TIME_BASED,
          field: 'updatedAt',
          operator: RuleOperator.LESS_THAN,
          value: addMonths(new Date(), -6).toISOString()
        }
      ],
      conditionLogic: 'AND',
      actions: [
        {
          id: 'transition_to_retired',
          type: RuleAction.TRANSITION_TO_STAGE,
          parameters: {
            targetStage: LifecycleStage.RETIRED,
            reason: 'Automated retirement after 6 months of deprecation'
          }
        }
      ],
      applicableStages: [LifecycleStage.DEPRECATED],
      cooldownPeriod: 43200, // 30 days
      createdBy: 'system'
    });
  }

  private async createDefaultSecurityRule(): Promise<void> {
    await this.createRule({
      name: 'Security vulnerability alert',
      description: 'Alert when services have security vulnerabilities',
      enabled: true,
      priority: RulePriority.CRITICAL,
      status: RuleStatus.ACTIVE,
      conditions: [
        {
          id: 'security_vulnerabilities_check',
          type: RuleConditionType.COMPLIANCE_CHECK,
          field: 'metrics.maintenance.securityVulnerabilities',
          operator: RuleOperator.GREATER_THAN,
          value: 0
        }
      ],
      conditionLogic: 'AND',
      actions: [
        {
          id: 'create_security_ticket',
          type: RuleAction.CREATE_TICKET,
          parameters: {
            title: 'Security vulnerabilities detected',
            description: 'Service has security vulnerabilities that need immediate attention',
            priority: 'critical'
          }
        }
      ],
      applicableStages: Object.values(LifecycleStage),
      cooldownPeriod: 60, // 1 hour
      createdBy: 'system'
    });
  }
}

// Singleton instance
export const lifecycleRulesEngine = new LifecycleRulesEngine();

export default LifecycleRulesEngine;