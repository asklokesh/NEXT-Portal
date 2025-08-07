import { z } from 'zod';
import cron from 'node-cron';
import { EventEmitter } from 'events';
import { addDays, addMonths, isBefore, isAfter, parseISO } from 'date-fns';

// Lifecycle stage definitions
export enum LifecycleStage {
  EXPERIMENTAL = 'experimental',
  BETA = 'beta',
  PRODUCTION = 'production',
  MATURE = 'mature',
  DEPRECATED = 'deprecated',
  RETIRED = 'retired'
}

export enum TransitionTrigger {
  MANUAL = 'manual',
  AUTOMATED = 'automated',
  SCHEDULED = 'scheduled',
  METRIC_BASED = 'metric_based',
  TIME_BASED = 'time_based'
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  AUTO_APPROVED = 'auto_approved'
}

// Schemas for validation
export const LifecycleMetricsSchema = z.object({
  usage: z.object({
    dailyActiveUsers: z.number().min(0),
    monthlyActiveUsers: z.number().min(0),
    apiCallsPerDay: z.number().min(0),
    errorRate: z.number().min(0).max(1),
    averageResponseTime: z.number().min(0)
  }),
  health: z.object({
    uptime: z.number().min(0).max(1),
    availability: z.number().min(0).max(1),
    reliability: z.number().min(0).max(1),
    performance: z.number().min(0).max(1)
  }),
  business: z.object({
    costPerMonth: z.number().min(0),
    revenue: z.number().min(0),
    strategicValue: z.enum(['low', 'medium', 'high', 'critical']),
    businessCriticality: z.enum(['low', 'medium', 'high', 'critical'])
  }),
  maintenance: z.object({
    securityVulnerabilities: z.number().min(0),
    technicalDebt: z.enum(['low', 'medium', 'high', 'critical']),
    lastUpdate: z.string().datetime(),
    dependencyRisk: z.enum(['low', 'medium', 'high', 'critical'])
  })
});

export const LifecycleEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.string(),
  namespace: z.string(),
  currentStage: z.nativeEnum(LifecycleStage),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metrics: LifecycleMetricsSchema,
  owners: z.array(z.string()),
  stakeholders: z.array(z.string())
});

export const TransitionHistorySchema = z.object({
  id: z.string(),
  entityId: z.string(),
  fromStage: z.nativeEnum(LifecycleStage),
  toStage: z.nativeEnum(LifecycleStage),
  trigger: z.nativeEnum(TransitionTrigger),
  triggeredBy: z.string(),
  timestamp: z.string().datetime(),
  approvalStatus: z.nativeEnum(ApprovalStatus),
  approvedBy: z.string().optional(),
  reason: z.string(),
  ruleId: z.string().optional(),
  rollbackId: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export const DeprecationScheduleSchema = z.object({
  id: z.string(),
  entityId: z.string(),
  scheduledDate: z.string().datetime(),
  notificationDates: z.array(z.string().datetime()),
  reason: z.string(),
  migrationPlan: z.string().optional(),
  replacementService: z.string().optional(),
  approvals: z.array(z.object({
    approver: z.string(),
    status: z.nativeEnum(ApprovalStatus),
    timestamp: z.string().datetime(),
    comments: z.string().optional()
  })),
  createdBy: z.string(),
  createdAt: z.string().datetime()
});

export type LifecycleMetrics = z.infer<typeof LifecycleMetricsSchema>;
export type LifecycleEntity = z.infer<typeof LifecycleEntitySchema>;
export type TransitionHistory = z.infer<typeof TransitionHistorySchema>;
export type DeprecationSchedule = z.infer<typeof DeprecationScheduleSchema>;

// Lifecycle Manager Interface
export interface ILifecycleManager {
  // Entity management
  registerEntity(entity: Omit<LifecycleEntity, 'createdAt' | 'updatedAt'>): Promise<LifecycleEntity>;
  updateEntity(id: string, updates: Partial<LifecycleEntity>): Promise<LifecycleEntity>;
  getEntity(id: string): Promise<LifecycleEntity | null>;
  getEntitiesByStage(stage: LifecycleStage): Promise<LifecycleEntity[]>;
  
  // Metrics integration
  updateMetrics(entityId: string, metrics: LifecycleMetrics): Promise<void>;
  getMetricsHistory(entityId: string, days?: number): Promise<LifecycleMetrics[]>;
  
  // Transition management
  requestTransition(
    entityId: string, 
    toStage: LifecycleStage, 
    reason: string, 
    triggeredBy: string,
    trigger?: TransitionTrigger,
    metadata?: Record<string, any>
  ): Promise<TransitionHistory>;
  approveTransition(transitionId: string, approver: string, comments?: string): Promise<void>;
  rejectTransition(transitionId: string, approver: string, reason: string): Promise<void>;
  
  // Deprecation scheduling
  scheduleDeprecation(schedule: Omit<DeprecationSchedule, 'id' | 'createdAt'>): Promise<DeprecationSchedule>;
  updateDeprecationSchedule(id: string, updates: Partial<DeprecationSchedule>): Promise<DeprecationSchedule>;
  getDeprecationSchedule(entityId: string): Promise<DeprecationSchedule | null>;
  
  // Automated operations
  startAutomatedChecks(): void;
  stopAutomatedChecks(): void;
  processScheduledTransitions(): Promise<void>;
  
  // Audit and history
  getTransitionHistory(entityId?: string): Promise<TransitionHistory[]>;
  exportAuditLog(startDate: string, endDate: string): Promise<string>;
}

export class LifecycleManager extends EventEmitter implements ILifecycleManager {
  private entities = new Map<string, LifecycleEntity>();
  private metricsHistory = new Map<string, LifecycleMetrics[]>();
  private transitions = new Map<string, TransitionHistory>();
  private deprecationSchedules = new Map<string, DeprecationSchedule>();
  private cronJob: cron.ScheduledTask | null = null;
  private isAutomatedChecksEnabled = false;

  constructor() {
    super();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.on('stage_changed', this.handleStageChange.bind(this));
    this.on('metrics_updated', this.handleMetricsUpdate.bind(this));
    this.on('deprecation_scheduled', this.handleDeprecationScheduled.bind(this));
  }

  async registerEntity(entity: Omit<LifecycleEntity, 'createdAt' | 'updatedAt'>): Promise<LifecycleEntity> {
    const now = new Date().toISOString();
    const fullEntity: LifecycleEntity = {
      ...entity,
      createdAt: now,
      updatedAt: now
    };

    // Validate entity
    const validatedEntity = LifecycleEntitySchema.parse(fullEntity);
    this.entities.set(validatedEntity.id, validatedEntity);

    this.emit('entity_registered', validatedEntity);
    
    return validatedEntity;
  }

  async updateEntity(id: string, updates: Partial<LifecycleEntity>): Promise<LifecycleEntity> {
    const entity = this.entities.get(id);
    if (!entity) {
      throw new Error(`Entity with id ${id} not found`);
    }

    const updatedEntity: LifecycleEntity = {
      ...entity,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const validatedEntity = LifecycleEntitySchema.parse(updatedEntity);
    this.entities.set(id, validatedEntity);

    this.emit('entity_updated', validatedEntity, entity);
    
    return validatedEntity;
  }

  async getEntity(id: string): Promise<LifecycleEntity | null> {
    return this.entities.get(id) || null;
  }

  async getEntitiesByStage(stage: LifecycleStage): Promise<LifecycleEntity[]> {
    return Array.from(this.entities.values()).filter(entity => entity.currentStage === stage);
  }

  async updateMetrics(entityId: string, metrics: LifecycleMetrics): Promise<void> {
    const validatedMetrics = LifecycleMetricsSchema.parse(metrics);
    
    if (!this.metricsHistory.has(entityId)) {
      this.metricsHistory.set(entityId, []);
    }
    
    const history = this.metricsHistory.get(entityId)!;
    history.push({
      ...validatedMetrics,
      timestamp: new Date().toISOString()
    } as any);

    // Keep only last 90 days of metrics
    const ninetyDaysAgo = addDays(new Date(), -90);
    const filteredHistory = history.filter(metric => 
      isAfter(parseISO((metric as any).timestamp), ninetyDaysAgo)
    );
    this.metricsHistory.set(entityId, filteredHistory);

    // Update entity metrics
    const entity = this.entities.get(entityId);
    if (entity) {
      entity.metrics = validatedMetrics;
      entity.updatedAt = new Date().toISOString();
      this.entities.set(entityId, entity);
    }

    this.emit('metrics_updated', entityId, validatedMetrics);
  }

  async getMetricsHistory(entityId: string, days = 30): Promise<LifecycleMetrics[]> {
    const history = this.metricsHistory.get(entityId) || [];
    const cutoffDate = addDays(new Date(), -days);
    
    return history.filter(metric => 
      isAfter(parseISO((metric as any).timestamp), cutoffDate)
    );
  }

  async requestTransition(
    entityId: string,
    toStage: LifecycleStage,
    reason: string,
    triggeredBy: string,
    trigger = TransitionTrigger.MANUAL,
    metadata?: Record<string, any>
  ): Promise<TransitionHistory> {
    const entity = this.entities.get(entityId);
    if (!entity) {
      throw new Error(`Entity with id ${entityId} not found`);
    }

    // Validate transition is allowed
    const isValidTransition = this.isValidTransition(entity.currentStage, toStage);
    if (!isValidTransition) {
      throw new Error(`Invalid transition from ${entity.currentStage} to ${toStage}`);
    }

    const transitionId = `transition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const transition: TransitionHistory = {
      id: transitionId,
      entityId,
      fromStage: entity.currentStage,
      toStage,
      trigger,
      triggeredBy,
      timestamp: new Date().toISOString(),
      approvalStatus: this.requiresApproval(entity.currentStage, toStage) ? 
        ApprovalStatus.PENDING : ApprovalStatus.AUTO_APPROVED,
      reason,
      metadata
    };

    const validatedTransition = TransitionHistorySchema.parse(transition);
    this.transitions.set(transitionId, validatedTransition);

    // Auto-approve if no approval required
    if (validatedTransition.approvalStatus === ApprovalStatus.AUTO_APPROVED) {
      await this.executeTransition(transitionId);
    }

    this.emit('transition_requested', validatedTransition);
    
    return validatedTransition;
  }

  async approveTransition(transitionId: string, approver: string, comments?: string): Promise<void> {
    const transition = this.transitions.get(transitionId);
    if (!transition) {
      throw new Error(`Transition with id ${transitionId} not found`);
    }

    if (transition.approvalStatus !== ApprovalStatus.PENDING) {
      throw new Error(`Transition ${transitionId} is not pending approval`);
    }

    transition.approvalStatus = ApprovalStatus.APPROVED;
    transition.approvedBy = approver;
    if (comments) {
      transition.metadata = { ...transition.metadata, approvalComments: comments };
    }

    this.transitions.set(transitionId, transition);
    await this.executeTransition(transitionId);

    this.emit('transition_approved', transition);
  }

  async rejectTransition(transitionId: string, approver: string, reason: string): Promise<void> {
    const transition = this.transitions.get(transitionId);
    if (!transition) {
      throw new Error(`Transition with id ${transitionId} not found`);
    }

    transition.approvalStatus = ApprovalStatus.REJECTED;
    transition.approvedBy = approver;
    transition.metadata = { ...transition.metadata, rejectionReason: reason };

    this.transitions.set(transitionId, transition);
    this.emit('transition_rejected', transition);
  }

  private async executeTransition(transitionId: string): Promise<void> {
    const transition = this.transitions.get(transitionId);
    if (!transition) {
      throw new Error(`Transition with id ${transitionId} not found`);
    }

    const entity = this.entities.get(transition.entityId);
    if (!entity) {
      throw new Error(`Entity with id ${transition.entityId} not found`);
    }

    const previousStage = entity.currentStage;
    entity.currentStage = transition.toStage;
    entity.updatedAt = new Date().toISOString();
    
    this.entities.set(entity.id, entity);
    this.emit('stage_changed', entity, previousStage, transition);
  }

  async scheduleDeprecation(schedule: Omit<DeprecationSchedule, 'id' | 'createdAt'>): Promise<DeprecationSchedule> {
    const scheduleId = `deprecation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullSchedule: DeprecationSchedule = {
      ...schedule,
      id: scheduleId,
      createdAt: new Date().toISOString()
    };

    const validatedSchedule = DeprecationScheduleSchema.parse(fullSchedule);
    this.deprecationSchedules.set(scheduleId, validatedSchedule);

    this.emit('deprecation_scheduled', validatedSchedule);
    
    return validatedSchedule;
  }

  async updateDeprecationSchedule(id: string, updates: Partial<DeprecationSchedule>): Promise<DeprecationSchedule> {
    const schedule = this.deprecationSchedules.get(id);
    if (!schedule) {
      throw new Error(`Deprecation schedule with id ${id} not found`);
    }

    const updatedSchedule = { ...schedule, ...updates };
    const validatedSchedule = DeprecationScheduleSchema.parse(updatedSchedule);
    this.deprecationSchedules.set(id, validatedSchedule);

    this.emit('deprecation_schedule_updated', validatedSchedule);
    
    return validatedSchedule;
  }

  async getDeprecationSchedule(entityId: string): Promise<DeprecationSchedule | null> {
    return Array.from(this.deprecationSchedules.values())
      .find(schedule => schedule.entityId === entityId) || null;
  }

  startAutomatedChecks(): void {
    if (this.isAutomatedChecksEnabled) {
      return;
    }

    // Run automated checks every hour
    this.cronJob = cron.schedule('0 * * * *', async () => {
      await this.processScheduledTransitions();
      await this.runAutomatedRules();
      await this.processDeprecationNotifications();
    });

    this.isAutomatedChecksEnabled = true;
    this.emit('automated_checks_started');
  }

  stopAutomatedChecks(): void {
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
    }
    this.isAutomatedChecksEnabled = false;
    this.emit('automated_checks_stopped');
  }

  async processScheduledTransitions(): Promise<void> {
    const now = new Date();
    
    for (const schedule of this.deprecationSchedules.values()) {
      const scheduledDate = parseISO(schedule.scheduledDate);
      
      if (isBefore(scheduledDate, now)) {
        const entity = this.entities.get(schedule.entityId);
        if (entity && entity.currentStage !== LifecycleStage.DEPRECATED) {
          await this.requestTransition(
            schedule.entityId,
            LifecycleStage.DEPRECATED,
            `Automated deprecation: ${schedule.reason}`,
            'system',
            TransitionTrigger.SCHEDULED
          );
        }
      }
    }
  }

  private async runAutomatedRules(): Promise<void> {
    // This will be implemented by LifecycleRules
    this.emit('automated_rules_check');
  }

  private async processDeprecationNotifications(): Promise<void> {
    const now = new Date();
    
    for (const schedule of this.deprecationSchedules.values()) {
      for (const notificationDate of schedule.notificationDates) {
        const date = parseISO(notificationDate);
        if (isBefore(date, now) && isAfter(date, addDays(now, -1))) {
          this.emit('deprecation_notification_due', schedule);
        }
      }
    }
  }

  async getTransitionHistory(entityId?: string): Promise<TransitionHistory[]> {
    const allTransitions = Array.from(this.transitions.values());
    
    if (entityId) {
      return allTransitions.filter(transition => transition.entityId === entityId);
    }
    
    return allTransitions.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  async exportAuditLog(startDate: string, endDate: string): Promise<string> {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    const transitions = Array.from(this.transitions.values())
      .filter(transition => {
        const transitionDate = parseISO(transition.timestamp);
        return isAfter(transitionDate, start) && isBefore(transitionDate, end);
      });

    const auditLog = {
      exportDate: new Date().toISOString(),
      dateRange: { startDate, endDate },
      totalTransitions: transitions.length,
      transitions: transitions.map(transition => ({
        ...transition,
        entityName: this.entities.get(transition.entityId)?.name
      }))
    };

    return JSON.stringify(auditLog, null, 2);
  }

  private isValidTransition(fromStage: LifecycleStage, toStage: LifecycleStage): boolean {
    const validTransitions: Record<LifecycleStage, LifecycleStage[]> = {
      [LifecycleStage.EXPERIMENTAL]: [LifecycleStage.BETA, LifecycleStage.RETIRED],
      [LifecycleStage.BETA]: [LifecycleStage.PRODUCTION, LifecycleStage.EXPERIMENTAL, LifecycleStage.RETIRED],
      [LifecycleStage.PRODUCTION]: [LifecycleStage.MATURE, LifecycleStage.DEPRECATED],
      [LifecycleStage.MATURE]: [LifecycleStage.DEPRECATED],
      [LifecycleStage.DEPRECATED]: [LifecycleStage.RETIRED, LifecycleStage.PRODUCTION], // Allow revival
      [LifecycleStage.RETIRED]: [] // No transitions from retired
    };

    return validTransitions[fromStage]?.includes(toStage) || false;
  }

  private requiresApproval(fromStage: LifecycleStage, toStage: LifecycleStage): boolean {
    // Require approval for production transitions and deprecations
    const requiresApprovalTransitions = [
      { from: LifecycleStage.BETA, to: LifecycleStage.PRODUCTION },
      { from: LifecycleStage.PRODUCTION, to: LifecycleStage.DEPRECATED },
      { from: LifecycleStage.MATURE, to: LifecycleStage.DEPRECATED },
      { from: LifecycleStage.DEPRECATED, to: LifecycleStage.RETIRED }
    ];

    return requiresApprovalTransitions.some(
      transition => transition.from === fromStage && transition.to === toStage
    );
  }

  private handleStageChange(entity: LifecycleEntity, previousStage: LifecycleStage, transition: TransitionHistory): void {
    console.log(`Entity ${entity.name} transitioned from ${previousStage} to ${entity.currentStage}`);
    
    // Trigger follow-up actions based on new stage
    if (entity.currentStage === LifecycleStage.DEPRECATED) {
      this.scheduleRetirement(entity);
    }
  }

  private handleMetricsUpdate(entityId: string, metrics: LifecycleMetrics): void {
    // Trigger automated rules based on metrics
    this.emit('metrics_threshold_check', entityId, metrics);
  }

  private handleDeprecationScheduled(schedule: DeprecationSchedule): void {
    console.log(`Deprecation scheduled for entity ${schedule.entityId} on ${schedule.scheduledDate}`);
  }

  private async scheduleRetirement(entity: LifecycleEntity): Promise<void> {
    // Schedule retirement 6 months after deprecation
    const retirementDate = addMonths(new Date(), 6);
    
    // This would integrate with the deprecation scheduling system
    console.log(`Auto-scheduling retirement for ${entity.name} on ${retirementDate.toISOString()}`);
  }
}

// Singleton instance
export const lifecycleManager = new LifecycleManager();

export default LifecycleManager;