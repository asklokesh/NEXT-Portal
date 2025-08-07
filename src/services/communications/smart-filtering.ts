import { EventEmitter } from 'events';
import { Logger } from '@/lib/logger';
import { NotificationMessage, NotificationType, NotificationPriority } from './notification-engine';
import { CommunicationConfig } from './communications-config';

export interface FilterRule {
  id: string;
  name: string;
  description: string;
  priority: number;
  enabled: boolean;
  conditions: FilterCondition[];
  action: FilterAction;
  createdAt: Date;
  updatedAt: Date;
}

export interface FilterCondition {
  field: string;
  operator: 'equals' | 'contains' | 'regex' | 'gt' | 'lt' | 'in' | 'timeWindow';
  value: any;
  weight: number;
}

export interface FilterAction {
  type: 'suppress' | 'aggregate' | 'delay' | 'priority' | 'route';
  parameters: Record<string, any>;
}

export interface AggregationRule {
  id: string;
  name: string;
  groupBy: string[];
  timeWindow: number;
  maxMessages: number;
  aggregationTemplate: string;
  enabled: boolean;
}

export interface MessageCluster {
  id: string;
  key: string;
  messages: NotificationMessage[];
  firstMessageAt: Date;
  lastMessageAt: Date;
  aggregated: boolean;
  aggregatedMessage?: NotificationMessage;
}

export interface NoisePattern {
  pattern: string;
  frequency: number;
  timeWindow: number;
  confidence: number;
  lastSeen: Date;
  suppressed: boolean;
}

export interface UserBehaviorProfile {
  userId: string;
  preferences: {
    channels: string[];
    timePreferences: TimePreference[];
    quietHours: QuietHours;
    frequency: FrequencyPreference;
  };
  engagement: {
    openRate: number;
    clickRate: number;
    responseRate: number;
    averageResponseTime: number;
  };
  patterns: {
    activeHours: number[];
    preferredChannels: Record<string, number>;
    categoryPreferences: Record<string, number>;
  };
  lastUpdated: Date;
}

export interface TimePreference {
  type: NotificationType;
  preferredTimes: string[];
  timezone: string;
}

export interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
  exceptions: NotificationType[];
}

export interface FrequencyPreference {
  maxPerHour: number;
  maxPerDay: number;
  digestPreferred: boolean;
  immediateTypes: NotificationType[];
}

export class SmartFilteringEngine extends EventEmitter {
  private readonly logger = new Logger('SmartFilteringEngine');
  private readonly filterRules: FilterRule[] = [];
  private readonly aggregationRules: AggregationRule[] = [];
  private readonly messageClusters = new Map<string, MessageCluster>();
  private readonly noisePatterns: NoisePattern[] = [];
  private readonly userProfiles = new Map<string, UserBehaviorProfile>();
  private readonly messageHistory: NotificationMessage[] = [];
  private aiModel?: any; // AI model for pattern detection

  constructor(private config: CommunicationConfig) {
    super();
    this.initializeDefaultRules();
    this.startPatternDetection();
  }

  private initializeDefaultRules(): void {
    // Default noise reduction rules
    const defaultRules: FilterRule[] = [
      {
        id: 'duplicate-suppression',
        name: 'Duplicate Message Suppression',
        description: 'Suppress duplicate messages within 5 minutes',
        priority: 100,
        enabled: true,
        conditions: [
          {
            field: 'subject',
            operator: 'equals',
            value: '{{previous.subject}}',
            weight: 0.8
          },
          {
            field: 'content',
            operator: 'equals',
            value: '{{previous.content}}',
            weight: 0.2
          }
        ],
        action: {
          type: 'suppress',
          parameters: { timeWindow: 300000 }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'low-priority-aggregation',
        name: 'Low Priority Aggregation',
        description: 'Aggregate low priority messages',
        priority: 50,
        enabled: true,
        conditions: [
          {
            field: 'priority',
            operator: 'equals',
            value: NotificationPriority.LOW,
            weight: 1.0
          }
        ],
        action: {
          type: 'aggregate',
          parameters: { 
            timeWindow: 1800000, // 30 minutes
            maxMessages: 10
          }
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    this.filterRules.push(...defaultRules);

    // Default aggregation rules
    const defaultAggregationRules: AggregationRule[] = [
      {
        id: 'error-aggregation',
        name: 'Error Message Aggregation',
        groupBy: ['type', 'userId'],
        timeWindow: 600000, // 10 minutes
        maxMessages: 5,
        aggregationTemplate: 'error-digest',
        enabled: true
      },
      {
        id: 'info-digest',
        name: 'Information Digest',
        groupBy: ['userId', 'tags'],
        timeWindow: 3600000, // 1 hour
        maxMessages: 20,
        aggregationTemplate: 'info-digest',
        enabled: true
      }
    ];

    this.aggregationRules.push(...defaultAggregationRules);
  }

  private startPatternDetection(): void {
    setInterval(() => {
      this.detectNoisePatterns();
      this.updateUserProfiles();
      this.cleanupOldData();
    }, 300000); // Every 5 minutes
  }

  public async processMessage(message: NotificationMessage): Promise<NotificationMessage | null> {
    try {
      // Store message in history
      this.messageHistory.push(message);
      
      // Apply filtering rules
      const filterResult = await this.applyFilters(message);
      if (filterResult.suppressed) {
        this.emit('messageSuppressed', message, filterResult.reason);
        return null;
      }

      // Apply smart aggregation
      const aggregationResult = await this.applyAggregation(message);
      if (aggregationResult.aggregated) {
        this.emit('messageAggregated', message, aggregationResult.clusterId);
        return aggregationResult.aggregatedMessage || null;
      }

      // Apply user behavior optimization
      const optimizedMessage = await this.applyUserBehaviorOptimization(message);

      // Update user engagement tracking
      this.trackMessageSent(optimizedMessage);

      return optimizedMessage;
    } catch (error) {
      this.logger.error('Error processing message', { error, messageId: message.id });
      return message; // Return original message on error
    }
  }

  private async applyFilters(message: NotificationMessage): Promise<{ suppressed: boolean; reason?: string }> {
    for (const rule of this.filterRules.sort((a, b) => b.priority - a.priority)) {
      if (!rule.enabled) continue;

      const matches = await this.evaluateFilterRule(rule, message);
      if (matches) {
        const action = await this.executeFilterAction(rule.action, message);
        if (action.suppressed) {
          return { suppressed: true, reason: `Rule: ${rule.name}` };
        }
      }
    }

    return { suppressed: false };
  }

  private async evaluateFilterRule(rule: FilterRule, message: NotificationMessage): Promise<boolean> {
    let totalWeight = 0;
    let matchWeight = 0;

    for (const condition of rule.conditions) {
      totalWeight += condition.weight;
      
      if (await this.evaluateFilterCondition(condition, message)) {
        matchWeight += condition.weight;
      }
    }

    // Require 80% weighted match
    return (matchWeight / totalWeight) >= 0.8;
  }

  private async evaluateFilterCondition(condition: FilterCondition, message: NotificationMessage): Promise<boolean> {
    const value = this.getMessageFieldValue(message, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        return this.resolveValue(condition.value, message) === value;
      case 'contains':
        return String(value).includes(String(this.resolveValue(condition.value, message)));
      case 'regex':
        return new RegExp(condition.value).test(String(value));
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'timeWindow':
        return this.isWithinTimeWindow(message, condition.value);
      default:
        return false;
    }
  }

  private getMessageFieldValue(message: NotificationMessage, field: string): any {
    const fields: Record<string, any> = {
      'id': message.id,
      'userId': message.userId,
      'type': message.type,
      'priority': message.priority,
      'subject': message.subject,
      'content': message.content,
      'channels': message.channels,
      'tags': message.tags,
      'createdAt': message.createdAt
    };

    return fields[field] || message.metadata[field];
  }

  private resolveValue(value: string, message: NotificationMessage): any {
    if (typeof value === 'string' && value.includes('{{previous.')) {
      const field = value.replace('{{previous.', '').replace('}}', '');
      const previousMessage = this.getPreviousMessage(message.userId);
      return previousMessage ? this.getMessageFieldValue(previousMessage, field) : null;
    }
    return value;
  }

  private getPreviousMessage(userId: string): NotificationMessage | null {
    const userMessages = this.messageHistory
      .filter(msg => msg.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return userMessages.length > 1 ? userMessages[1] : null;
  }

  private isWithinTimeWindow(message: NotificationMessage, timeWindowMs: number): boolean {
    const now = Date.now();
    const messageTime = message.createdAt.getTime();
    return (now - messageTime) <= timeWindowMs;
  }

  private async executeFilterAction(action: FilterAction, message: NotificationMessage): Promise<{ suppressed: boolean }> {
    switch (action.type) {
      case 'suppress':
        return { suppressed: true };
      case 'delay':
        if (action.parameters.delay) {
          message.scheduledAt = new Date(Date.now() + action.parameters.delay);
        }
        return { suppressed: false };
      case 'priority':
        if (action.parameters.priority) {
          message.priority = action.parameters.priority;
        }
        return { suppressed: false };
      case 'route':
        if (action.parameters.channels) {
          message.channels = action.parameters.channels;
        }
        return { suppressed: false };
      default:
        return { suppressed: false };
    }
  }

  private async applyAggregation(message: NotificationMessage): Promise<{
    aggregated: boolean;
    clusterId?: string;
    aggregatedMessage?: NotificationMessage;
  }> {
    for (const rule of this.aggregationRules) {
      if (!rule.enabled) continue;

      const clusterKey = this.generateClusterKey(message, rule.groupBy);
      const cluster = this.messageClusters.get(clusterKey);

      if (cluster) {
        cluster.messages.push(message);
        cluster.lastMessageAt = new Date();

        if (cluster.messages.length >= rule.maxMessages ||
            (Date.now() - cluster.firstMessageAt.getTime()) >= rule.timeWindow) {
          
          const aggregatedMessage = await this.createAggregatedMessage(cluster, rule);
          cluster.aggregated = true;
          cluster.aggregatedMessage = aggregatedMessage;

          return {
            aggregated: true,
            clusterId: cluster.id,
            aggregatedMessage
          };
        }

        return { aggregated: true, clusterId: cluster.id };
      } else {
        const newCluster: MessageCluster = {
          id: this.generateId(),
          key: clusterKey,
          messages: [message],
          firstMessageAt: new Date(),
          lastMessageAt: new Date(),
          aggregated: false
        };

        this.messageClusters.set(clusterKey, newCluster);
        return { aggregated: true, clusterId: newCluster.id };
      }
    }

    return { aggregated: false };
  }

  private generateClusterKey(message: NotificationMessage, groupBy: string[]): string {
    const values = groupBy.map(field => {
      const value = this.getMessageFieldValue(message, field);
      return Array.isArray(value) ? value.sort().join(',') : String(value);
    });
    return values.join('|');
  }

  private async createAggregatedMessage(
    cluster: MessageCluster, 
    rule: AggregationRule
  ): Promise<NotificationMessage> {
    const firstMessage = cluster.messages[0];
    
    return {
      id: this.generateId(),
      userId: firstMessage.userId,
      type: firstMessage.type,
      priority: firstMessage.priority,
      channels: firstMessage.channels,
      subject: `Digest: ${rule.name} (${cluster.messages.length} messages)`,
      content: this.generateAggregatedContent(cluster.messages, rule.aggregationTemplate),
      metadata: {
        ...firstMessage.metadata,
        aggregated: true,
        originalMessageCount: cluster.messages.length,
        aggregationRule: rule.id
      },
      templateId: rule.aggregationTemplate,
      templateData: {
        messages: cluster.messages,
        count: cluster.messages.length,
        timeRange: {
          from: cluster.firstMessageAt,
          to: cluster.lastMessageAt
        }
      },
      tags: [...new Set(cluster.messages.flatMap(msg => msg.tags))],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  private generateAggregatedContent(messages: NotificationMessage[], template: string): string {
    // Simple aggregation logic - would be enhanced with template engine
    const summary = messages.map((msg, index) => 
      `${index + 1}. ${msg.subject}`
    ).join('\n');

    return `Message Summary (${messages.length} messages):\n\n${summary}`;
  }

  private async applyUserBehaviorOptimization(message: NotificationMessage): Promise<NotificationMessage> {
    const userProfile = this.userProfiles.get(message.userId);
    if (!userProfile) {
      return message;
    }

    // Optimize delivery time based on user activity patterns
    const optimizedMessage = { ...message };

    // Check quiet hours
    if (this.isInQuietHours(userProfile.preferences.quietHours)) {
      if (!userProfile.preferences.quietHours.exceptions.includes(message.type)) {
        optimizedMessage.scheduledAt = this.getNextActiveTime(userProfile);
      }
    }

    // Optimize channel selection based on user preferences
    const preferredChannels = this.getPreferredChannels(userProfile, message.type);
    if (preferredChannels.length > 0) {
      optimizedMessage.channels = preferredChannels;
    }

    return optimizedMessage;
  }

  private isInQuietHours(quietHours: QuietHours): boolean {
    if (!quietHours.enabled) return false;

    const now = new Date();
    const start = this.parseTime(quietHours.start);
    const end = this.parseTime(quietHours.end);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    if (start <= end) {
      return currentMinutes >= start && currentMinutes <= end;
    } else {
      return currentMinutes >= start || currentMinutes <= end;
    }
  }

  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private getNextActiveTime(userProfile: UserBehaviorProfile): Date {
    // Simple implementation - would be enhanced with timezone support
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // Default to 9 AM next day
    return tomorrow;
  }

  private getPreferredChannels(userProfile: UserBehaviorProfile, messageType: NotificationType): any[] {
    const preferences = userProfile.patterns.preferredChannels;
    const typePreferences = userProfile.patterns.categoryPreferences;

    // Simple scoring system
    const channelScores: Record<string, number> = {};
    
    Object.entries(preferences).forEach(([channel, score]) => {
      channelScores[channel] = score;
    });

    // Boost score for message type preferences
    if (typePreferences[messageType]) {
      Object.keys(channelScores).forEach(channel => {
        channelScores[channel] *= (1 + typePreferences[messageType] * 0.5);
      });
    }

    // Return top channels
    return Object.entries(channelScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([channel]) => channel);
  }

  private trackMessageSent(message: NotificationMessage): void {
    // Track message for user behavior analysis
    this.emit('messageTracked', message);
  }

  private detectNoisePatterns(): void {
    // Analyze recent messages for noise patterns
    const recentMessages = this.messageHistory.slice(-1000);
    const patterns = this.analyzeMessagePatterns(recentMessages);

    patterns.forEach(pattern => {
      const existingPattern = this.noisePatterns.find(p => p.pattern === pattern.pattern);
      if (existingPattern) {
        existingPattern.frequency = pattern.frequency;
        existingPattern.lastSeen = new Date();
        existingPattern.confidence = Math.min(existingPattern.confidence + 0.1, 1.0);
      } else {
        this.noisePatterns.push({
          ...pattern,
          lastSeen: new Date(),
          suppressed: false
        });
      }
    });
  }

  private analyzeMessagePatterns(messages: NotificationMessage[]): NoisePattern[] {
    // Simple pattern detection - would be enhanced with ML
    const patterns: NoisePattern[] = [];
    const subjectCounts: Record<string, number> = {};
    const timeWindow = 3600000; // 1 hour

    messages.forEach(message => {
      const subject = message.subject.toLowerCase();
      subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
    });

    Object.entries(subjectCounts).forEach(([subject, count]) => {
      if (count >= 10) { // Threshold for noise
        patterns.push({
          pattern: subject,
          frequency: count,
          timeWindow,
          confidence: Math.min(count / 50, 1.0)
        });
      }
    });

    return patterns;
  }

  private updateUserProfiles(): void {
    // Update user behavior profiles based on recent activity
    const recentMessages = this.messageHistory.slice(-500);
    const userActivity: Record<string, NotificationMessage[]> = {};

    recentMessages.forEach(message => {
      if (!userActivity[message.userId]) {
        userActivity[message.userId] = [];
      }
      userActivity[message.userId].push(message);
    });

    Object.entries(userActivity).forEach(([userId, messages]) => {
      this.updateUserProfile(userId, messages);
    });
  }

  private updateUserProfile(userId: string, messages: NotificationMessage[]): void {
    let profile = this.userProfiles.get(userId);
    
    if (!profile) {
      profile = {
        userId,
        preferences: {
          channels: [],
          timePreferences: [],
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00',
            timezone: 'UTC',
            exceptions: [NotificationType.ALERT, NotificationType.ERROR]
          },
          frequency: {
            maxPerHour: 10,
            maxPerDay: 50,
            digestPreferred: false,
            immediateTypes: [NotificationType.ALERT, NotificationType.ERROR]
          }
        },
        engagement: {
          openRate: 0,
          clickRate: 0,
          responseRate: 0,
          averageResponseTime: 0
        },
        patterns: {
          activeHours: [],
          preferredChannels: {},
          categoryPreferences: {}
        },
        lastUpdated: new Date()
      };
    }

    // Update patterns based on recent messages
    messages.forEach(message => {
      const hour = message.createdAt.getHours();
      if (!profile!.patterns.activeHours.includes(hour)) {
        profile!.patterns.activeHours.push(hour);
      }

      // Update channel preferences
      message.channels.forEach(channel => {
        profile!.patterns.preferredChannels[channel] = 
          (profile!.patterns.preferredChannels[channel] || 0) + 1;
      });

      // Update category preferences
      profile!.patterns.categoryPreferences[message.type] = 
        (profile!.patterns.categoryPreferences[message.type] || 0) + 1;
    });

    profile.lastUpdated = new Date();
    this.userProfiles.set(userId, profile);
  }

  private cleanupOldData(): void {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    // Clean old messages
    const recentIndex = this.messageHistory.findIndex(
      msg => msg.createdAt.getTime() > oneWeekAgo
    );
    if (recentIndex > 0) {
      this.messageHistory.splice(0, recentIndex);
    }

    // Clean old clusters
    for (const [key, cluster] of this.messageClusters.entries()) {
      if (cluster.lastMessageAt.getTime() < oneWeekAgo) {
        this.messageClusters.delete(key);
      }
    }

    // Clean old noise patterns
    this.noisePatterns.forEach((pattern, index) => {
      if (pattern.lastSeen.getTime() < oneWeekAgo) {
        this.noisePatterns.splice(index, 1);
      }
    });
  }

  public addFilterRule(rule: FilterRule): void {
    this.filterRules.push(rule);
    this.filterRules.sort((a, b) => b.priority - a.priority);
    this.emit('filterRuleAdded', rule);
  }

  public removeFilterRule(ruleId: string): boolean {
    const index = this.filterRules.findIndex(rule => rule.id === ruleId);
    if (index === -1) return false;

    const removedRule = this.filterRules.splice(index, 1)[0];
    this.emit('filterRuleRemoved', removedRule);
    return true;
  }

  public addAggregationRule(rule: AggregationRule): void {
    this.aggregationRules.push(rule);
    this.emit('aggregationRuleAdded', rule);
  }

  public getFilteringStats(): any {
    return {
      filterRules: this.filterRules.length,
      aggregationRules: this.aggregationRules.length,
      activeClusters: this.messageClusters.size,
      detectedNoisePatterns: this.noisePatterns.length,
      userProfiles: this.userProfiles.size,
      messageHistory: this.messageHistory.length
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}