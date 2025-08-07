import { EventEmitter } from 'events';
import { Logger } from '@/lib/logger';
import { NotificationMessage, NotificationPriority, NotificationType } from './notification-engine';
import { NotificationChannel, CommunicationConfig } from './communications-config';

export interface EscalationPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  triggers: EscalationTrigger[];
  levels: EscalationLevel[];
  maxLevels: number;
  cooldownPeriod: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationTrigger {
  type: 'time' | 'priority' | 'failure' | 'acknowledgment' | 'custom';
  condition: TriggerCondition;
  parameters: Record<string, any>;
}

export interface TriggerCondition {
  field: string;
  operator: 'equals' | 'gt' | 'lt' | 'contains' | 'timeout';
  value: any;
}

export interface EscalationLevel {
  level: number;
  name: string;
  delay: number;
  targets: EscalationTarget[];
  actions: EscalationAction[];
  acknowledgeTimeout: number;
  maxAttempts: number;
}

export interface EscalationTarget {
  type: 'user' | 'group' | 'role' | 'external';
  id: string;
  channels: NotificationChannel[];
  priority: number;
}

export interface EscalationAction {
  type: 'notify' | 'create_incident' | 'webhook' | 'execute_script' | 'page';
  parameters: Record<string, any>;
}

export interface EscalationInstance {
  id: string;
  policyId: string;
  messageId: string;
  currentLevel: number;
  status: EscalationStatus;
  startedAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;
  attempts: EscalationAttempt[];
  metadata: Record<string, any>;
}

export interface EscalationAttempt {
  level: number;
  targetId: string;
  channel: NotificationChannel;
  attemptedAt: Date;
  status: AttemptStatus;
  response?: string;
  responseTime?: number;
}

export enum EscalationStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

export enum AttemptStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  ACKNOWLEDGED = 'acknowledged',
  FAILED = 'failed',
  TIMEOUT = 'timeout'
}

export interface OnCallSchedule {
  id: string;
  name: string;
  timezone: string;
  rotations: ScheduleRotation[];
  overrides: ScheduleOverride[];
  enabled: boolean;
}

export interface ScheduleRotation {
  id: string;
  name: string;
  users: string[];
  rotationType: 'daily' | 'weekly' | 'monthly';
  rotationLength: number;
  startTime: string;
  restrictions?: TimeRestriction[];
}

export interface ScheduleOverride {
  id: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  reason: string;
}

export interface TimeRestriction {
  days: number[]; // 0-6, Sunday=0
  startTime: string;
  endTime: string;
}

export class EscalationManager extends EventEmitter {
  private readonly logger = new Logger('EscalationManager');
  private readonly policies: EscalationPolicy[] = [];
  private readonly instances = new Map<string, EscalationInstance>();
  private readonly schedules: OnCallSchedule[] = [];
  private escalationTimer?: NodeJS.Timeout;
  private readonly activeTimers = new Map<string, NodeJS.Timeout>();

  constructor(private config: CommunicationConfig) {
    super();
    this.initializeDefaultPolicies();
    this.startEscalationProcessor();
  }

  private initializeDefaultPolicies(): void {
    const defaultPolicies: EscalationPolicy[] = [
      {
        id: 'critical-alert-escalation',
        name: 'Critical Alert Escalation',
        description: 'Escalation for critical priority alerts',
        enabled: true,
        triggers: [
          {
            type: 'priority',
            condition: {
              field: 'priority',
              operator: 'equals',
              value: NotificationPriority.CRITICAL
            },
            parameters: {}
          }
        ],
        levels: [
          {
            level: 1,
            name: 'On-call Engineer',
            delay: 0,
            targets: [
              {
                type: 'role',
                id: 'on-call-engineer',
                channels: [NotificationChannel.SMS, NotificationChannel.PUSH],
                priority: 1
              }
            ],
            actions: [
              {
                type: 'notify',
                parameters: { 
                  template: 'critical-alert',
                  requireAcknowledgment: true
                }
              }
            ],
            acknowledgeTimeout: 300000, // 5 minutes
            maxAttempts: 3
          },
          {
            level: 2,
            name: 'Engineering Manager',
            delay: 300000, // 5 minutes
            targets: [
              {
                type: 'role',
                id: 'engineering-manager',
                channels: [NotificationChannel.SMS, NotificationChannel.EMAIL],
                priority: 1
              }
            ],
            actions: [
              {
                type: 'notify',
                parameters: { template: 'escalated-alert' }
              },
              {
                type: 'create_incident',
                parameters: { severity: 'high' }
              }
            ],
            acknowledgeTimeout: 600000, // 10 minutes
            maxAttempts: 2
          },
          {
            level: 3,
            name: 'Executive Team',
            delay: 900000, // 15 minutes
            targets: [
              {
                type: 'role',
                id: 'executive-team',
                channels: [NotificationChannel.SMS, NotificationChannel.EMAIL],
                priority: 1
              }
            ],
            actions: [
              {
                type: 'notify',
                parameters: { template: 'executive-alert' }
              },
              {
                type: 'page',
                parameters: { service: 'executive-paging' }
              }
            ],
            acknowledgeTimeout: 1800000, // 30 minutes
            maxAttempts: 1
          }
        ],
        maxLevels: 3,
        cooldownPeriod: 3600000, // 1 hour
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'failure-escalation',
        name: 'Delivery Failure Escalation',
        description: 'Escalation for repeated delivery failures',
        enabled: true,
        triggers: [
          {
            type: 'failure',
            condition: {
              field: 'failureCount',
              operator: 'gt',
              value: 3
            },
            parameters: { timeWindow: 1800000 } // 30 minutes
          }
        ],
        levels: [
          {
            level: 1,
            name: 'Platform Team',
            delay: 0,
            targets: [
              {
                type: 'group',
                id: 'platform-team',
                channels: [NotificationChannel.SLACK, NotificationChannel.EMAIL],
                priority: 1
              }
            ],
            actions: [
              {
                type: 'notify',
                parameters: { template: 'delivery-failure' }
              }
            ],
            acknowledgeTimeout: 900000, // 15 minutes
            maxAttempts: 2
          }
        ],
        maxLevels: 1,
        cooldownPeriod: 1800000, // 30 minutes
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    this.policies.push(...defaultPolicies);
  }

  private startEscalationProcessor(): void {
    this.escalationTimer = setInterval(() => {
      this.processActiveEscalations();
    }, 30000); // Process every 30 seconds
  }

  public async triggerEscalation(message: NotificationMessage): Promise<string | null> {
    const matchingPolicies = this.findMatchingPolicies(message);
    
    if (matchingPolicies.length === 0) {
      return null;
    }

    // Use the highest priority policy
    const policy = matchingPolicies[0];
    
    // Check cooldown period
    if (this.isInCooldown(policy.id, message.userId)) {
      this.logger.info('Escalation in cooldown period', {
        policyId: policy.id,
        userId: message.userId
      });
      return null;
    }

    const escalationInstance: EscalationInstance = {
      id: this.generateId(),
      policyId: policy.id,
      messageId: message.id,
      currentLevel: 1,
      status: EscalationStatus.ACTIVE,
      startedAt: new Date(),
      attempts: [],
      metadata: {
        originalMessage: message,
        policyName: policy.name
      }
    };

    this.instances.set(escalationInstance.id, escalationInstance);

    // Start escalation process
    await this.executeEscalationLevel(escalationInstance, policy.levels[0]);

    this.emit('escalationStarted', escalationInstance, policy);
    this.logger.info('Escalation started', {
      id: escalationInstance.id,
      policyId: policy.id,
      messageId: message.id
    });

    return escalationInstance.id;
  }

  private findMatchingPolicies(message: NotificationMessage): EscalationPolicy[] {
    return this.policies
      .filter(policy => policy.enabled)
      .filter(policy => this.evaluateTriggers(policy.triggers, message))
      .sort((a, b) => b.levels[0]?.targets[0]?.priority || 0 - a.levels[0]?.targets[0]?.priority || 0);
  }

  private evaluateTriggers(triggers: EscalationTrigger[], message: NotificationMessage): boolean {
    return triggers.some(trigger => this.evaluateTrigger(trigger, message));
  }

  private evaluateTrigger(trigger: EscalationTrigger, message: NotificationMessage): boolean {
    const condition = trigger.condition;
    
    let value: any;
    switch (condition.field) {
      case 'priority':
        value = message.priority;
        break;
      case 'type':
        value = message.type;
        break;
      case 'failureCount':
        value = this.getFailureCount(message.userId, trigger.parameters.timeWindow);
        break;
      default:
        value = message.metadata[condition.field];
    }

    return this.evaluateCondition(condition, value);
  }

  private evaluateCondition(condition: TriggerCondition, actualValue: any): boolean {
    switch (condition.operator) {
      case 'equals':
        return actualValue === condition.value;
      case 'gt':
        return Number(actualValue) > Number(condition.value);
      case 'lt':
        return Number(actualValue) < Number(condition.value);
      case 'contains':
        return String(actualValue).includes(String(condition.value));
      default:
        return false;
    }
  }

  private getFailureCount(userId: string, timeWindow: number): number {
    // Implementation would query delivery failure history
    // For now, return mock data
    return 0;
  }

  private isInCooldown(policyId: string, userId: string): boolean {
    const policy = this.policies.find(p => p.id === policyId);
    if (!policy) return false;

    const recentEscalations = Array.from(this.instances.values())
      .filter(instance => 
        instance.policyId === policyId && 
        instance.metadata.originalMessage?.userId === userId &&
        instance.status === EscalationStatus.RESOLVED
      )
      .sort((a, b) => (b.resolvedAt?.getTime() || 0) - (a.resolvedAt?.getTime() || 0));

    if (recentEscalations.length === 0) return false;

    const lastResolution = recentEscalations[0].resolvedAt;
    if (!lastResolution) return false;

    return (Date.now() - lastResolution.getTime()) < policy.cooldownPeriod;
  }

  private async executeEscalationLevel(
    instance: EscalationInstance, 
    level: EscalationLevel
  ): Promise<void> {
    try {
      // Execute actions
      for (const action of level.actions) {
        await this.executeEscalationAction(action, instance, level);
      }

      // Notify targets
      for (const target of level.targets) {
        await this.notifyEscalationTarget(target, instance, level);
      }

      // Set acknowledgment timeout
      if (level.acknowledgeTimeout > 0) {
        const timeout = setTimeout(() => {
          this.handleAcknowledgmentTimeout(instance.id, level.level);
        }, level.acknowledgeTimeout);

        this.activeTimers.set(`${instance.id}-${level.level}`, timeout);
      }

      this.emit('escalationLevelExecuted', instance, level);
      this.logger.info('Escalation level executed', {
        instanceId: instance.id,
        level: level.level
      });

    } catch (error) {
      this.logger.error('Failed to execute escalation level', {
        error,
        instanceId: instance.id,
        level: level.level
      });
    }
  }

  private async executeEscalationAction(
    action: EscalationAction,
    instance: EscalationInstance,
    level: EscalationLevel
  ): Promise<void> {
    switch (action.type) {
      case 'notify':
        // Notification will be handled by notifyEscalationTarget
        break;
      case 'create_incident':
        await this.createIncident(instance, action.parameters);
        break;
      case 'webhook':
        await this.callWebhook(instance, action.parameters);
        break;
      case 'execute_script':
        await this.executeScript(instance, action.parameters);
        break;
      case 'page':
        await this.sendPage(instance, action.parameters);
        break;
    }
  }

  private async notifyEscalationTarget(
    target: EscalationTarget,
    instance: EscalationInstance,
    level: EscalationLevel
  ): Promise<void> {
    const targetUsers = await this.resolveTarget(target);

    for (const userId of targetUsers) {
      for (const channel of target.channels) {
        const attempt: EscalationAttempt = {
          level: level.level,
          targetId: userId,
          channel,
          attemptedAt: new Date(),
          status: AttemptStatus.PENDING
        };

        instance.attempts.push(attempt);

        try {
          // Create escalation notification
          const escalationMessage: NotificationMessage = {
            id: this.generateId(),
            userId,
            type: NotificationType.ALERT,
            priority: NotificationPriority.URGENT,
            channels: [channel],
            subject: `ESCALATION: ${instance.metadata.originalMessage?.subject}`,
            content: this.buildEscalationContent(instance, level),
            metadata: {
              escalation: true,
              escalationId: instance.id,
              level: level.level,
              originalMessage: instance.metadata.originalMessage
            },
            tags: ['escalation', `level-${level.level}`],
            createdAt: new Date(),
            updatedAt: new Date()
          };

          this.emit('escalationNotification', escalationMessage);
          attempt.status = AttemptStatus.SENT;

        } catch (error) {
          attempt.status = AttemptStatus.FAILED;
          this.logger.error('Failed to send escalation notification', {
            error,
            instanceId: instance.id,
            targetId: userId
          });
        }
      }
    }

    this.instances.set(instance.id, instance);
  }

  private async resolveTarget(target: EscalationTarget): Promise<string[]> {
    switch (target.type) {
      case 'user':
        return [target.id];
      case 'group':
        return await this.getGroupMembers(target.id);
      case 'role':
        return await this.getRoleMembers(target.id);
      case 'external':
        return [target.id]; // External contacts
      default:
        return [];
    }
  }

  private async getGroupMembers(groupId: string): Promise<string[]> {
    // Implementation would fetch group members from database
    // For now, return mock data
    return [`user-${groupId}-1`, `user-${groupId}-2`];
  }

  private async getRoleMembers(roleId: string): Promise<string[]> {
    // Implementation would fetch role members, considering on-call schedules
    switch (roleId) {
      case 'on-call-engineer':
        return await this.getOnCallUsers('engineering');
      case 'engineering-manager':
        return ['eng-manager-1'];
      case 'executive-team':
        return ['cto-1', 'ceo-1'];
      default:
        return [];
    }
  }

  private async getOnCallUsers(department: string): Promise<string[]> {
    // Implementation would determine current on-call users based on schedules
    // For now, return mock data
    return ['oncall-user-1'];
  }

  private buildEscalationContent(instance: EscalationInstance, level: EscalationLevel): string {
    const originalMessage = instance.metadata.originalMessage;
    
    return `
ESCALATION ALERT - Level ${level.level}: ${level.name}

Original Alert: ${originalMessage?.subject}
Priority: ${originalMessage?.priority}
Time: ${instance.startedAt.toISOString()}

Message: ${originalMessage?.content}

This is an escalated alert that requires immediate attention.
Please acknowledge this alert to stop further escalation.

Escalation ID: ${instance.id}
    `.trim();
  }

  private async createIncident(instance: EscalationInstance, parameters: Record<string, any>): Promise<void> {
    // Implementation would integrate with incident management system
    this.logger.info('Creating incident', {
      instanceId: instance.id,
      severity: parameters.severity
    });
  }

  private async callWebhook(instance: EscalationInstance, parameters: Record<string, any>): Promise<void> {
    // Implementation would call configured webhook
    this.logger.info('Calling escalation webhook', {
      instanceId: instance.id,
      url: parameters.url
    });
  }

  private async executeScript(instance: EscalationInstance, parameters: Record<string, any>): Promise<void> {
    // Implementation would execute configured script
    this.logger.info('Executing escalation script', {
      instanceId: instance.id,
      script: parameters.script
    });
  }

  private async sendPage(instance: EscalationInstance, parameters: Record<string, any>): Promise<void> {
    // Implementation would integrate with paging service
    this.logger.info('Sending page', {
      instanceId: instance.id,
      service: parameters.service
    });
  }

  public async acknowledgeEscalation(
    instanceId: string, 
    acknowledgedBy: string, 
    response?: string
  ): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.status !== EscalationStatus.ACTIVE) {
      return false;
    }

    instance.status = EscalationStatus.ACKNOWLEDGED;
    instance.acknowledgedAt = new Date();
    instance.acknowledgedBy = acknowledgedBy;

    // Clear any active timers
    this.clearInstanceTimers(instanceId);

    this.instances.set(instanceId, instance);

    this.emit('escalationAcknowledged', instance, acknowledgedBy);
    this.logger.info('Escalation acknowledged', {
      instanceId,
      acknowledgedBy,
      level: instance.currentLevel
    });

    return true;
  }

  public async resolveEscalation(
    instanceId: string, 
    resolvedBy: string, 
    resolution?: string
  ): Promise<boolean> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return false;
    }

    instance.status = EscalationStatus.RESOLVED;
    instance.resolvedAt = new Date();
    instance.resolvedBy = resolvedBy;

    // Clear any active timers
    this.clearInstanceTimers(instanceId);

    this.instances.set(instanceId, instance);

    this.emit('escalationResolved', instance, resolvedBy);
    this.logger.info('Escalation resolved', {
      instanceId,
      resolvedBy
    });

    return true;
  }

  private handleAcknowledgmentTimeout(instanceId: string, level: number): void {
    const instance = this.instances.get(instanceId);
    if (!instance || instance.status !== EscalationStatus.ACTIVE) {
      return;
    }

    const policy = this.policies.find(p => p.id === instance.policyId);
    if (!policy) {
      return;
    }

    // Move to next escalation level
    if (instance.currentLevel < policy.maxLevels) {
      instance.currentLevel++;
      const nextLevel = policy.levels[instance.currentLevel - 1];
      
      if (nextLevel) {
        setTimeout(() => {
          this.executeEscalationLevel(instance, nextLevel);
        }, nextLevel.delay);

        this.emit('escalationLevelTimeout', instance, level);
        this.logger.info('Escalation level timeout, moving to next level', {
          instanceId,
          fromLevel: level,
          toLevel: instance.currentLevel
        });
      }
    } else {
      // Max levels reached
      instance.status = EscalationStatus.EXPIRED;
      this.instances.set(instanceId, instance);

      this.emit('escalationExpired', instance);
      this.logger.warn('Escalation expired - max levels reached', {
        instanceId,
        maxLevels: policy.maxLevels
      });
    }
  }

  private processActiveEscalations(): void {
    const activeInstances = Array.from(this.instances.values())
      .filter(instance => instance.status === EscalationStatus.ACTIVE);

    for (const instance of activeInstances) {
      // Check for stale escalations
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - instance.startedAt.getTime() > maxAge) {
        instance.status = EscalationStatus.EXPIRED;
        this.clearInstanceTimers(instance.id);
        this.instances.set(instance.id, instance);

        this.emit('escalationExpired', instance);
        this.logger.warn('Escalation expired due to age', {
          instanceId: instance.id
        });
      }
    }
  }

  private clearInstanceTimers(instanceId: string): void {
    for (const [key, timer] of this.activeTimers.entries()) {
      if (key.startsWith(instanceId)) {
        clearTimeout(timer);
        this.activeTimers.delete(key);
      }
    }
  }

  public addPolicy(policy: EscalationPolicy): void {
    this.policies.push(policy);
    this.emit('policyAdded', policy);
    this.logger.info('Escalation policy added', { id: policy.id, name: policy.name });
  }

  public removePolicy(policyId: string): boolean {
    const index = this.policies.findIndex(p => p.id === policyId);
    if (index === -1) return false;

    const removedPolicy = this.policies.splice(index, 1)[0];
    this.emit('policyRemoved', removedPolicy);
    this.logger.info('Escalation policy removed', { id: policyId });

    return true;
  }

  public getEscalationStats(): any {
    const activeEscalations = Array.from(this.instances.values())
      .filter(instance => instance.status === EscalationStatus.ACTIVE);

    const statusCounts = Array.from(this.instances.values()).reduce((acc, instance) => {
      acc[instance.status] = (acc[instance.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalPolicies: this.policies.length,
      activePolicies: this.policies.filter(p => p.enabled).length,
      totalEscalations: this.instances.size,
      activeEscalations: activeEscalations.length,
      statusBreakdown: statusCounts,
      averageResolutionTime: this.calculateAverageResolutionTime()
    };
  }

  private calculateAverageResolutionTime(): number {
    const resolvedInstances = Array.from(this.instances.values())
      .filter(instance => instance.status === EscalationStatus.RESOLVED && instance.resolvedAt);

    if (resolvedInstances.length === 0) return 0;

    const totalTime = resolvedInstances.reduce((sum, instance) => {
      const resolutionTime = instance.resolvedAt!.getTime() - instance.startedAt.getTime();
      return sum + resolutionTime;
    }, 0);

    return totalTime / resolvedInstances.length;
  }

  private generateId(): string {
    return `esc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public shutdown(): void {
    if (this.escalationTimer) {
      clearInterval(this.escalationTimer);
    }

    // Clear all active timers
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();

    this.removeAllListeners();
  }
}