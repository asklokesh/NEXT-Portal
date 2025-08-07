import { EventEmitter } from 'events';
import { Logger } from '@/lib/logger';
import { NotificationChannel, NotificationPriority, NotificationType, CommunicationConfig } from './communications-config';

export interface NotificationMessage {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  subject: string;
  content: string;
  metadata: Record<string, any>;
  templateId?: string;
  templateData?: Record<string, any>;
  scheduledAt?: Date;
  expiresAt?: Date;
  tags: string[];
  correlationId?: string;
  aggregationKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationRule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'gt' | 'lt' | 'in';
  value: any;
  type: 'user' | 'message' | 'time' | 'frequency';
}

export interface RuleAction {
  type: 'route' | 'suppress' | 'escalate' | 'delay' | 'aggregate' | 'transform';
  parameters: Record<string, any>;
}

export interface NotificationQueue {
  id: string;
  name: string;
  priority: NotificationPriority;
  maxSize: number;
  processingRate: number;
  retryPolicy: RetryPolicy;
  deadLetterQueue?: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface NotificationDelivery {
  id: string;
  messageId: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
  attempt: number;
  deliveredAt?: Date;
  failedAt?: Date;
  error?: string;
  metadata: Record<string, any>;
}

export enum DeliveryStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired'
}

export class NotificationEngine extends EventEmitter {
  private readonly logger = new Logger('NotificationEngine');
  private readonly messages = new Map<string, NotificationMessage>();
  private readonly deliveries = new Map<string, NotificationDelivery>();
  private readonly rules: NotificationRule[] = [];
  private readonly queues = new Map<string, NotificationQueue>();
  private processingInterval?: NodeJS.Timeout;
  private aiModel?: any; // AI model for intelligent processing

  constructor(private config: CommunicationConfig) {
    super();
    this.initializeQueues();
    this.startProcessing();
  }

  private initializeQueues(): void {
    const queues: NotificationQueue[] = [
      {
        id: 'critical',
        name: 'Critical Notifications',
        priority: NotificationPriority.CRITICAL,
        maxSize: 1000,
        processingRate: 100,
        retryPolicy: {
          maxAttempts: 5,
          initialDelay: 1000,
          maxDelay: 30000,
          backoffMultiplier: 2,
          jitter: true
        }
      },
      {
        id: 'urgent',
        name: 'Urgent Notifications',
        priority: NotificationPriority.URGENT,
        maxSize: 5000,
        processingRate: 50,
        retryPolicy: {
          maxAttempts: 3,
          initialDelay: 2000,
          maxDelay: 60000,
          backoffMultiplier: 2,
          jitter: true
        }
      },
      {
        id: 'normal',
        name: 'Normal Notifications',
        priority: NotificationPriority.NORMAL,
        maxSize: 10000,
        processingRate: 25,
        retryPolicy: {
          maxAttempts: 2,
          initialDelay: 5000,
          maxDelay: 120000,
          backoffMultiplier: 2,
          jitter: true
        }
      },
      {
        id: 'low',
        name: 'Low Priority Notifications',
        priority: NotificationPriority.LOW,
        maxSize: 20000,
        processingRate: 10,
        retryPolicy: {
          maxAttempts: 1,
          initialDelay: 10000,
          maxDelay: 300000,
          backoffMultiplier: 1.5,
          jitter: true
        }
      }
    ];

    queues.forEach(queue => this.queues.set(queue.id, queue));
  }

  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processQueues();
    }, 1000);
  }

  public async createNotification(message: Partial<NotificationMessage>): Promise<NotificationMessage> {
    const notification: NotificationMessage = {
      id: message.id || this.generateId(),
      userId: message.userId!,
      type: message.type || NotificationType.INFO,
      priority: message.priority || NotificationPriority.NORMAL,
      channels: message.channels || [this.config.defaultChannel],
      subject: message.subject!,
      content: message.content!,
      metadata: message.metadata || {},
      templateId: message.templateId,
      templateData: message.templateData,
      scheduledAt: message.scheduledAt,
      expiresAt: message.expiresAt,
      tags: message.tags || [],
      correlationId: message.correlationId,
      aggregationKey: message.aggregationKey,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Apply notification rules
    await this.applyRules(notification);

    // Store notification
    this.messages.set(notification.id, notification);

    // Emit event
    this.emit('notificationCreated', notification);

    this.logger.info('Notification created', {
      id: notification.id,
      type: notification.type,
      priority: notification.priority
    });

    return notification;
  }

  public async scheduleNotification(message: NotificationMessage, scheduledAt: Date): Promise<void> {
    message.scheduledAt = scheduledAt;
    this.messages.set(message.id, message);

    this.emit('notificationScheduled', message);
    this.logger.info('Notification scheduled', {
      id: message.id,
      scheduledAt
    });
  }

  public async cancelNotification(messageId: string): Promise<boolean> {
    const message = this.messages.get(messageId);
    if (!message) {
      return false;
    }

    // Cancel pending deliveries
    for (const [deliveryId, delivery] of this.deliveries.entries()) {
      if (delivery.messageId === messageId && delivery.status === DeliveryStatus.PENDING) {
        delivery.status = DeliveryStatus.CANCELLED;
        this.deliveries.set(deliveryId, delivery);
      }
    }

    // Remove from storage
    this.messages.delete(messageId);

    this.emit('notificationCancelled', message);
    this.logger.info('Notification cancelled', { id: messageId });

    return true;
  }

  public addRule(rule: NotificationRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
    
    this.emit('ruleAdded', rule);
    this.logger.info('Notification rule added', { id: rule.id, name: rule.name });
  }

  public removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(rule => rule.id === ruleId);
    if (index === -1) {
      return false;
    }

    const removedRule = this.rules.splice(index, 1)[0];
    this.emit('ruleRemoved', removedRule);
    this.logger.info('Notification rule removed', { id: ruleId });

    return true;
  }

  private async applyRules(message: NotificationMessage): Promise<void> {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const matches = await this.evaluateRuleConditions(rule.conditions, message);
      if (matches) {
        await this.executeRuleActions(rule.actions, message);
        this.logger.debug('Rule applied', { ruleId: rule.id, messageId: message.id });
      }
    }
  }

  private async evaluateRuleConditions(conditions: RuleCondition[], message: NotificationMessage): Promise<boolean> {
    for (const condition of conditions) {
      if (!await this.evaluateCondition(condition, message)) {
        return false;
      }
    }
    return true;
  }

  private async evaluateCondition(condition: RuleCondition, message: NotificationMessage): Promise<boolean> {
    let value: any;

    switch (condition.type) {
      case 'message':
        value = this.getMessageField(message, condition.field);
        break;
      case 'user':
        value = await this.getUserField(message.userId, condition.field);
        break;
      case 'time':
        value = new Date();
        break;
      case 'frequency':
        value = await this.getNotificationFrequency(message.userId, condition.field);
        break;
      default:
        return false;
    }

    return this.compareValues(value, condition.operator, condition.value);
  }

  private getMessageField(message: NotificationMessage, field: string): any {
    const fields: Record<string, any> = {
      'type': message.type,
      'priority': message.priority,
      'subject': message.subject,
      'content': message.content,
      'channels': message.channels,
      'tags': message.tags
    };

    return fields[field] || message.metadata[field];
  }

  private async getUserField(userId: string, field: string): Promise<any> {
    // Implementation would fetch user data from database
    // For now, return mock data
    return null;
  }

  private async getNotificationFrequency(userId: string, timeWindow: string): Promise<number> {
    // Implementation would calculate notification frequency
    // For now, return 0
    return 0;
  }

  private compareValues(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'contains':
        return String(actual).includes(String(expected));
      case 'startsWith':
        return String(actual).startsWith(String(expected));
      case 'endsWith':
        return String(actual).endsWith(String(expected));
      case 'regex':
        return new RegExp(expected).test(String(actual));
      case 'gt':
        return Number(actual) > Number(expected);
      case 'lt':
        return Number(actual) < Number(expected);
      case 'in':
        return Array.isArray(expected) ? expected.includes(actual) : false;
      default:
        return false;
    }
  }

  private async executeRuleActions(actions: RuleAction[], message: NotificationMessage): Promise<void> {
    for (const action of actions) {
      await this.executeRuleAction(action, message);
    }
  }

  private async executeRuleAction(action: RuleAction, message: NotificationMessage): Promise<void> {
    switch (action.type) {
      case 'route':
        if (action.parameters.channels) {
          message.channels = action.parameters.channels;
        }
        break;
      case 'suppress':
        message.channels = [];
        break;
      case 'escalate':
        message.priority = action.parameters.priority || NotificationPriority.URGENT;
        break;
      case 'delay':
        if (action.parameters.delay) {
          message.scheduledAt = new Date(Date.now() + action.parameters.delay);
        }
        break;
      case 'aggregate':
        message.aggregationKey = action.parameters.key || message.type;
        break;
      case 'transform':
        if (action.parameters.template) {
          message.templateId = action.parameters.template;
        }
        break;
    }
  }

  private async processQueues(): Promise<void> {
    for (const [queueId, queue] of this.queues.entries()) {
      await this.processQueue(queue);
    }
  }

  private async processQueue(queue: NotificationQueue): Promise<void> {
    const messages = Array.from(this.messages.values())
      .filter(msg => this.getQueueForPriority(msg.priority) === queue.id)
      .filter(msg => !msg.scheduledAt || msg.scheduledAt <= new Date())
      .slice(0, queue.processingRate);

    for (const message of messages) {
      await this.processMessage(message);
    }
  }

  private getQueueForPriority(priority: NotificationPriority): string {
    switch (priority) {
      case NotificationPriority.CRITICAL:
        return 'critical';
      case NotificationPriority.URGENT:
        return 'urgent';
      case NotificationPriority.NORMAL:
        return 'normal';
      case NotificationPriority.LOW:
        return 'low';
      default:
        return 'normal';
    }
  }

  private async processMessage(message: NotificationMessage): Promise<void> {
    try {
      // Create deliveries for each channel
      for (const channel of message.channels) {
        const delivery: NotificationDelivery = {
          id: this.generateId(),
          messageId: message.id,
          channel,
          status: DeliveryStatus.PENDING,
          attempt: 0,
          metadata: {}
        };

        this.deliveries.set(delivery.id, delivery);
        this.emit('deliveryCreated', delivery);
      }

      // Remove from processing queue
      this.messages.delete(message.id);

      this.logger.debug('Message processed', {
        id: message.id,
        channels: message.channels.length
      });
    } catch (error) {
      this.logger.error('Failed to process message', { error, messageId: message.id });
    }
  }

  public async getNotificationStats(): Promise<any> {
    const totalMessages = this.messages.size;
    const totalDeliveries = this.deliveries.size;
    
    const deliveriesByStatus = Array.from(this.deliveries.values()).reduce((acc, delivery) => {
      acc[delivery.status] = (acc[delivery.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const messagesByPriority = Array.from(this.messages.values()).reduce((acc, message) => {
      acc[message.priority] = (acc[message.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalMessages,
      totalDeliveries,
      deliveriesByStatus,
      messagesByPriority,
      queueSizes: Object.fromEntries(
        Array.from(this.queues.entries()).map(([id, queue]) => [
          id,
          Array.from(this.messages.values()).filter(msg => 
            this.getQueueForPriority(msg.priority) === id
          ).length
        ])
      )
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public shutdown(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.removeAllListeners();
  }
}