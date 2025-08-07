import { EventEmitter } from 'events';
import { Logger } from '@/lib/logger';
import { NotificationChannel, NotificationType, NotificationPriority } from './communications-config';

export interface UserPreferences {
  userId: string;
  globalSettings: GlobalPreferences;
  channelSettings: ChannelPreferences;
  typeSettings: TypePreferences;
  scheduleSettings: SchedulePreferences;
  filterSettings: FilterPreferences;
  subscriptions: NotificationSubscription[];
  metadata: PreferenceMetadata;
  version: number;
  lastUpdated: Date;
}

export interface GlobalPreferences {
  enabled: boolean;
  timezone: string;
  locale: string;
  digestMode: boolean;
  quietHoursEnabled: boolean;
  doNotDisturb: boolean;
  maxNotificationsPerHour: number;
  maxNotificationsPerDay: number;
}

export interface ChannelPreferences {
  [NotificationChannel.EMAIL]: ChannelPreference;
  [NotificationChannel.SLACK]: ChannelPreference;
  [NotificationChannel.TEAMS]: ChannelPreference;
  [NotificationChannel.SMS]: ChannelPreference;
  [NotificationChannel.WEBHOOK]: ChannelPreference;
  [NotificationChannel.PUSH]: ChannelPreference;
  [NotificationChannel.DISCORD]: ChannelPreference;
}

export interface ChannelPreference {
  enabled: boolean;
  priority: number;
  fallback: boolean;
  quietHours?: QuietHours;
  rateLimit?: ChannelRateLimit;
  customSettings: Record<string, any>;
}

export interface QuietHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
  exceptions: NotificationType[];
  weekdays: number[];
}

export interface ChannelRateLimit {
  maxPerMinute: number;
  maxPerHour: number;
  maxPerDay: number;
}

export interface TypePreferences {
  [key: string]: TypePreference;
}

export interface TypePreference {
  enabled: boolean;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  immediateDelivery: boolean;
  digestEligible: boolean;
  escalationEnabled: boolean;
}

export interface SchedulePreferences {
  workingHours: WorkingHours;
  weekends: WeekendSettings;
  holidays: HolidaySettings;
  timeZone: string;
}

export interface WorkingHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  weekdays: number[];
  immediateTypes: NotificationType[];
}

export interface WeekendSettings {
  enabled: boolean;
  emergencyOnly: boolean;
  allowedTypes: NotificationType[];
}

export interface HolidaySettings {
  enabled: boolean;
  emergencyOnly: boolean;
  customHolidays: Holiday[];
}

export interface Holiday {
  name: string;
  date: string;
  recurring: boolean;
}

export interface FilterPreferences {
  keywords: KeywordFilter[];
  senders: SenderFilter[];
  content: ContentFilter[];
  customRules: CustomFilterRule[];
}

export interface KeywordFilter {
  keyword: string;
  action: 'block' | 'allow' | 'priority' | 'channel';
  parameters?: Record<string, any>;
}

export interface SenderFilter {
  senderId: string;
  action: 'block' | 'allow' | 'priority';
  parameters?: Record<string, any>;
}

export interface ContentFilter {
  pattern: string;
  type: 'regex' | 'contains' | 'exact';
  action: 'block' | 'allow' | 'modify';
  parameters?: Record<string, any>;
}

export interface CustomFilterRule {
  id: string;
  name: string;
  conditions: FilterCondition[];
  action: FilterAction;
  enabled: boolean;
}

export interface FilterCondition {
  field: string;
  operator: string;
  value: any;
}

export interface FilterAction {
  type: string;
  parameters: Record<string, any>;
}

export interface NotificationSubscription {
  id: string;
  name: string;
  description: string;
  type: NotificationType;
  source: string;
  enabled: boolean;
  channels: NotificationChannel[];
  filters: SubscriptionFilter[];
  metadata: Record<string, any>;
}

export interface SubscriptionFilter {
  field: string;
  operator: string;
  value: any;
}

export interface PreferenceMetadata {
  source: 'user' | 'admin' | 'system';
  lastLoginAt?: Date;
  engagementScore: number;
  learningEnabled: boolean;
  preferencesLocked: boolean;
}

export interface PreferenceUpdate {
  userId: string;
  field: string;
  value: any;
  reason?: string;
  source: 'user' | 'system' | 'admin';
}

export interface PreferenceStats {
  totalUsers: number;
  activeUsers: number;
  channelPopularity: Record<NotificationChannel, number>;
  typePopularity: Record<NotificationType, number>;
  averageSubscriptions: number;
  digestModeUsers: number;
}

export class PreferenceManager extends EventEmitter {
  private readonly logger = new Logger('PreferenceManager');
  private readonly userPreferences = new Map<string, UserPreferences>();
  private readonly defaultPreferences: UserPreferences;

  constructor() {
    super();
    this.defaultPreferences = this.createDefaultPreferences();
    this.startPreferenceSync();
  }

  private createDefaultPreferences(): UserPreferences {
    return {
      userId: '',
      globalSettings: {
        enabled: true,
        timezone: 'UTC',
        locale: 'en-US',
        digestMode: false,
        quietHoursEnabled: false,
        doNotDisturb: false,
        maxNotificationsPerHour: 10,
        maxNotificationsPerDay: 50
      },
      channelSettings: {
        [NotificationChannel.EMAIL]: {
          enabled: true,
          priority: 1,
          fallback: true,
          quietHours: {
            enabled: false,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'UTC',
            exceptions: [NotificationType.ALERT, NotificationType.ERROR],
            weekdays: [1, 2, 3, 4, 5]
          },
          customSettings: {}
        },
        [NotificationChannel.SLACK]: {
          enabled: false,
          priority: 2,
          fallback: false,
          quietHours: {
            enabled: true,
            startTime: '18:00',
            endTime: '09:00',
            timezone: 'UTC',
            exceptions: [NotificationType.ALERT],
            weekdays: [1, 2, 3, 4, 5]
          },
          customSettings: {}
        },
        [NotificationChannel.TEAMS]: {
          enabled: false,
          priority: 3,
          fallback: false,
          customSettings: {}
        },
        [NotificationChannel.SMS]: {
          enabled: false,
          priority: 4,
          fallback: false,
          rateLimit: {
            maxPerMinute: 1,
            maxPerHour: 5,
            maxPerDay: 10
          },
          customSettings: {}
        },
        [NotificationChannel.WEBHOOK]: {
          enabled: false,
          priority: 5,
          fallback: false,
          customSettings: {}
        },
        [NotificationChannel.PUSH]: {
          enabled: false,
          priority: 6,
          fallback: false,
          quietHours: {
            enabled: true,
            startTime: '22:00',
            endTime: '08:00',
            timezone: 'UTC',
            exceptions: [NotificationType.ALERT],
            weekdays: [0, 1, 2, 3, 4, 5, 6]
          },
          customSettings: {}
        },
        [NotificationChannel.DISCORD]: {
          enabled: false,
          priority: 7,
          fallback: false,
          customSettings: {}
        }
      },
      typeSettings: {
        [NotificationType.ALERT]: {
          enabled: true,
          channels: [NotificationChannel.EMAIL, NotificationChannel.SMS],
          priority: NotificationPriority.URGENT,
          immediateDelivery: true,
          digestEligible: false,
          escalationEnabled: true
        },
        [NotificationType.ERROR]: {
          enabled: true,
          channels: [NotificationChannel.EMAIL],
          priority: NotificationPriority.HIGH,
          immediateDelivery: true,
          digestEligible: false,
          escalationEnabled: false
        },
        [NotificationType.WARNING]: {
          enabled: true,
          channels: [NotificationChannel.EMAIL],
          priority: NotificationPriority.NORMAL,
          immediateDelivery: false,
          digestEligible: true,
          escalationEnabled: false
        },
        [NotificationType.INFO]: {
          enabled: true,
          channels: [NotificationChannel.EMAIL],
          priority: NotificationPriority.NORMAL,
          immediateDelivery: false,
          digestEligible: true,
          escalationEnabled: false
        },
        [NotificationType.SUCCESS]: {
          enabled: true,
          channels: [NotificationChannel.EMAIL],
          priority: NotificationPriority.LOW,
          immediateDelivery: false,
          digestEligible: true,
          escalationEnabled: false
        },
        [NotificationType.DIGEST]: {
          enabled: true,
          channels: [NotificationChannel.EMAIL],
          priority: NotificationPriority.LOW,
          immediateDelivery: false,
          digestEligible: false,
          escalationEnabled: false
        },
        [NotificationType.MARKETING]: {
          enabled: false,
          channels: [NotificationChannel.EMAIL],
          priority: NotificationPriority.LOW,
          immediateDelivery: false,
          digestEligible: true,
          escalationEnabled: false
        },
        [NotificationType.SYSTEM]: {
          enabled: true,
          channels: [NotificationChannel.EMAIL],
          priority: NotificationPriority.NORMAL,
          immediateDelivery: false,
          digestEligible: true,
          escalationEnabled: false
        }
      },
      scheduleSettings: {
        workingHours: {
          enabled: false,
          startTime: '09:00',
          endTime: '17:00',
          weekdays: [1, 2, 3, 4, 5],
          immediateTypes: [NotificationType.ALERT, NotificationType.ERROR]
        },
        weekends: {
          enabled: true,
          emergencyOnly: false,
          allowedTypes: [NotificationType.ALERT, NotificationType.ERROR]
        },
        holidays: {
          enabled: true,
          emergencyOnly: true,
          customHolidays: []
        },
        timeZone: 'UTC'
      },
      filterSettings: {
        keywords: [],
        senders: [],
        content: [],
        customRules: []
      },
      subscriptions: [],
      metadata: {
        source: 'system',
        engagementScore: 0.5,
        learningEnabled: true,
        preferencesLocked: false
      },
      version: 1,
      lastUpdated: new Date()
    };
  }

  private startPreferenceSync(): void {
    // Periodic sync with database
    setInterval(() => {
      this.syncPreferences();
    }, 300000); // Every 5 minutes
  }

  public async getUserPreferences(userId: string): Promise<UserPreferences> {
    let preferences = this.userPreferences.get(userId);
    
    if (!preferences) {
      // Load from database or create default
      preferences = await this.loadUserPreferences(userId);
      this.userPreferences.set(userId, preferences);
    }

    return preferences;
  }

  private async loadUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      // In a real implementation, this would load from database
      // For now, return default preferences with user ID
      const preferences = { ...this.defaultPreferences };
      preferences.userId = userId;
      return preferences;
    } catch (error) {
      this.logger.error('Failed to load user preferences', { userId, error });
      const preferences = { ...this.defaultPreferences };
      preferences.userId = userId;
      return preferences;
    }
  }

  public async updateUserPreferences(
    userId: string, 
    updates: Partial<UserPreferences>,
    source: 'user' | 'system' | 'admin' = 'user'
  ): Promise<UserPreferences> {
    const preferences = await this.getUserPreferences(userId);
    
    // Merge updates
    const updatedPreferences: UserPreferences = {
      ...preferences,
      ...updates,
      version: preferences.version + 1,
      lastUpdated: new Date()
    };

    // Validate preferences
    this.validatePreferences(updatedPreferences);

    // Store updated preferences
    this.userPreferences.set(userId, updatedPreferences);

    // Emit update event
    this.emit('preferencesUpdated', {
      userId,
      preferences: updatedPreferences,
      source
    });

    // Persist to database
    await this.saveUserPreferences(updatedPreferences);

    this.logger.info('User preferences updated', {
      userId,
      source,
      version: updatedPreferences.version
    });

    return updatedPreferences;
  }

  private validatePreferences(preferences: UserPreferences): void {
    // Validate timezone
    if (!this.isValidTimezone(preferences.globalSettings.timezone)) {
      throw new Error('Invalid timezone');
    }

    // Validate channels are enabled
    const enabledChannels = Object.entries(preferences.channelSettings)
      .filter(([_, settings]) => settings.enabled)
      .map(([channel]) => channel);

    if (enabledChannels.length === 0) {
      throw new Error('At least one channel must be enabled');
    }

    // Validate rate limits
    for (const [channel, settings] of Object.entries(preferences.channelSettings)) {
      if (settings.rateLimit) {
        if (settings.rateLimit.maxPerMinute > settings.rateLimit.maxPerHour) {
          throw new Error(`Invalid rate limit for ${channel}: per-minute exceeds per-hour`);
        }
        if (settings.rateLimit.maxPerHour > settings.rateLimit.maxPerDay) {
          throw new Error(`Invalid rate limit for ${channel}: per-hour exceeds per-day`);
        }
      }
    }
  }

  private isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  private async saveUserPreferences(preferences: UserPreferences): Promise<void> {
    try {
      // In a real implementation, this would save to database
      this.logger.debug('Preferences saved', { userId: preferences.userId });
    } catch (error) {
      this.logger.error('Failed to save preferences', { 
        userId: preferences.userId, 
        error 
      });
    }
  }

  public async updateChannelPreference(
    userId: string,
    channel: NotificationChannel,
    settings: Partial<ChannelPreference>
  ): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    preferences.channelSettings[channel] = {
      ...preferences.channelSettings[channel],
      ...settings
    };

    await this.updateUserPreferences(userId, preferences);
  }

  public async updateTypePreference(
    userId: string,
    type: NotificationType,
    settings: Partial<TypePreference>
  ): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    preferences.typeSettings[type] = {
      ...preferences.typeSettings[type],
      ...settings
    };

    await this.updateUserPreferences(userId, preferences);
  }

  public async addSubscription(
    userId: string,
    subscription: Omit<NotificationSubscription, 'id'>
  ): Promise<string> {
    const preferences = await this.getUserPreferences(userId);
    const subscriptionId = this.generateId();
    
    const newSubscription: NotificationSubscription = {
      ...subscription,
      id: subscriptionId
    };

    preferences.subscriptions.push(newSubscription);
    await this.updateUserPreferences(userId, preferences);

    this.logger.info('Subscription added', {
      userId,
      subscriptionId,
      type: subscription.type
    });

    return subscriptionId;
  }

  public async removeSubscription(userId: string, subscriptionId: string): Promise<boolean> {
    const preferences = await this.getUserPreferences(userId);
    const index = preferences.subscriptions.findIndex(sub => sub.id === subscriptionId);
    
    if (index === -1) {
      return false;
    }

    const removed = preferences.subscriptions.splice(index, 1)[0];
    await this.updateUserPreferences(userId, preferences);

    this.logger.info('Subscription removed', {
      userId,
      subscriptionId,
      type: removed.type
    });

    return true;
  }

  public async getEligibleChannels(
    userId: string,
    notificationType: NotificationType,
    priority: NotificationPriority
  ): Promise<NotificationChannel[]> {
    const preferences = await this.getUserPreferences(userId);

    // Check global settings
    if (!preferences.globalSettings.enabled || preferences.globalSettings.doNotDisturb) {
      return [];
    }

    // Check type settings
    const typeSettings = preferences.typeSettings[notificationType];
    if (!typeSettings?.enabled) {
      return [];
    }

    // Filter channels based on preferences and quiet hours
    const eligibleChannels: NotificationChannel[] = [];

    for (const channel of typeSettings.channels) {
      const channelSettings = preferences.channelSettings[channel];
      
      if (!channelSettings.enabled) {
        continue;
      }

      // Check quiet hours
      if (this.isInQuietHours(channelSettings.quietHours, notificationType)) {
        continue;
      }

      // Check rate limits
      if (await this.exceedsRateLimit(userId, channel, channelSettings.rateLimit)) {
        continue;
      }

      eligibleChannels.push(channel);
    }

    // Sort by priority
    return eligibleChannels.sort((a, b) => {
      const priorityA = preferences.channelSettings[a].priority;
      const priorityB = preferences.channelSettings[b].priority;
      return priorityA - priorityB;
    });
  }

  private isInQuietHours(quietHours?: QuietHours, type?: NotificationType): boolean {
    if (!quietHours?.enabled) {
      return false;
    }

    // Check exceptions
    if (type && quietHours.exceptions.includes(type)) {
      return false;
    }

    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    // Check if current day is included
    if (!quietHours.weekdays.includes(currentDay)) {
      return false;
    }

    const startTime = this.parseTime(quietHours.startTime);
    const endTime = this.parseTime(quietHours.endTime);

    // Handle overnight quiet hours
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }

  private parseTime(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private async exceedsRateLimit(
    userId: string,
    channel: NotificationChannel,
    rateLimit?: ChannelRateLimit
  ): Promise<boolean> {
    if (!rateLimit) {
      return false;
    }

    // In a real implementation, this would check against recent notification history
    // For now, return false (no rate limit exceeded)
    return false;
  }

  public async shouldDeliverImmediately(
    userId: string,
    notificationType: NotificationType
  ): Promise<boolean> {
    const preferences = await this.getUserPreferences(userId);
    const typeSettings = preferences.typeSettings[notificationType];
    
    if (!typeSettings) {
      return false;
    }

    // Check if digest mode is enabled globally
    if (preferences.globalSettings.digestMode && typeSettings.digestEligible) {
      return false;
    }

    return typeSettings.immediateDelivery;
  }

  public async isDigestEligible(
    userId: string,
    notificationType: NotificationType
  ): Promise<boolean> {
    const preferences = await this.getUserPreferences(userId);
    const typeSettings = preferences.typeSettings[notificationType];
    
    return typeSettings?.digestEligible || false;
  }

  public async applyFilters(
    userId: string,
    message: any
  ): Promise<{ allowed: boolean; modified?: any; reason?: string }> {
    const preferences = await this.getUserPreferences(userId);
    const filters = preferences.filterSettings;

    // Apply keyword filters
    for (const filter of filters.keywords) {
      const content = `${message.subject} ${message.content}`.toLowerCase();
      if (content.includes(filter.keyword.toLowerCase())) {
        switch (filter.action) {
          case 'block':
            return { allowed: false, reason: `Blocked by keyword: ${filter.keyword}` };
          case 'priority':
            message.priority = filter.parameters?.priority || message.priority;
            break;
          case 'channel':
            message.channels = filter.parameters?.channels || message.channels;
            break;
        }
      }
    }

    // Apply sender filters
    for (const filter of filters.senders) {
      if (message.senderId === filter.senderId) {
        switch (filter.action) {
          case 'block':
            return { allowed: false, reason: `Blocked sender: ${filter.senderId}` };
          case 'priority':
            message.priority = filter.parameters?.priority || message.priority;
            break;
        }
      }
    }

    // Apply content filters
    for (const filter of filters.content) {
      let matches = false;
      const content = `${message.subject} ${message.content}`;

      switch (filter.type) {
        case 'exact':
          matches = content === filter.pattern;
          break;
        case 'contains':
          matches = content.includes(filter.pattern);
          break;
        case 'regex':
          matches = new RegExp(filter.pattern).test(content);
          break;
      }

      if (matches) {
        switch (filter.action) {
          case 'block':
            return { allowed: false, reason: `Blocked by content filter` };
          case 'modify':
            if (filter.parameters?.replacement) {
              message.content = message.content.replace(
                new RegExp(filter.pattern, 'g'), 
                filter.parameters.replacement
              );
            }
            break;
        }
      }
    }

    // Apply custom rules
    for (const rule of filters.customRules) {
      if (!rule.enabled) continue;

      const matches = this.evaluateCustomRule(rule, message);
      if (matches) {
        // Apply rule action
        // Implementation would depend on the specific rule action
      }
    }

    return { allowed: true, modified: message };
  }

  private evaluateCustomRule(rule: CustomFilterRule, message: any): boolean {
    // Simple rule evaluation - would be more sophisticated in production
    return rule.conditions.every(condition => {
      const value = this.getMessageValue(message, condition.field);
      return this.evaluateCondition(condition, value);
    });
  }

  private getMessageValue(message: any, field: string): any {
    // Extract value from message based on field path
    const parts = field.split('.');
    let value = message;
    for (const part of parts) {
      value = value?.[part];
    }
    return value;
  }

  private evaluateCondition(condition: FilterCondition, value: any): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return String(value).includes(String(condition.value));
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      default:
        return false;
    }
  }

  private async syncPreferences(): Promise<void> {
    try {
      // Sync preferences with database
      this.logger.debug('Preferences synced');
    } catch (error) {
      this.logger.error('Failed to sync preferences', { error });
    }
  }

  public async getPreferenceStats(): Promise<PreferenceStats> {
    const allPreferences = Array.from(this.userPreferences.values());

    const channelPopularity: Record<NotificationChannel, number> = {
      [NotificationChannel.EMAIL]: 0,
      [NotificationChannel.SLACK]: 0,
      [NotificationChannel.TEAMS]: 0,
      [NotificationChannel.SMS]: 0,
      [NotificationChannel.WEBHOOK]: 0,
      [NotificationChannel.PUSH]: 0,
      [NotificationChannel.DISCORD]: 0
    };

    const typePopularity: Record<NotificationType, number> = {
      [NotificationType.ALERT]: 0,
      [NotificationType.ERROR]: 0,
      [NotificationType.WARNING]: 0,
      [NotificationType.INFO]: 0,
      [NotificationType.SUCCESS]: 0,
      [NotificationType.DIGEST]: 0,
      [NotificationType.MARKETING]: 0,
      [NotificationType.SYSTEM]: 0
    };

    let totalSubscriptions = 0;
    let digestModeUsers = 0;
    let activeUsers = 0;

    for (const preferences of allPreferences) {
      if (preferences.globalSettings.enabled) {
        activeUsers++;
      }

      if (preferences.globalSettings.digestMode) {
        digestModeUsers++;
      }

      // Count channel preferences
      Object.entries(preferences.channelSettings).forEach(([channel, settings]) => {
        if (settings.enabled) {
          channelPopularity[channel as NotificationChannel]++;
        }
      });

      // Count type preferences
      Object.entries(preferences.typeSettings).forEach(([type, settings]) => {
        if (settings.enabled) {
          typePopularity[type as NotificationType]++;
        }
      });

      totalSubscriptions += preferences.subscriptions.length;
    }

    return {
      totalUsers: allPreferences.length,
      activeUsers,
      channelPopularity,
      typePopularity,
      averageSubscriptions: allPreferences.length > 0 ? totalSubscriptions / allPreferences.length : 0,
      digestModeUsers
    };
  }

  public async exportUserPreferences(userId: string): Promise<string> {
    const preferences = await this.getUserPreferences(userId);
    return JSON.stringify(preferences, null, 2);
  }

  public async importUserPreferences(userId: string, data: string): Promise<void> {
    try {
      const preferences = JSON.parse(data) as UserPreferences;
      preferences.userId = userId;
      preferences.lastUpdated = new Date();
      
      this.validatePreferences(preferences);
      await this.updateUserPreferences(userId, preferences, 'user');
    } catch (error) {
      throw new Error(`Failed to import preferences: ${error}`);
    }
  }

  private generateId(): string {
    return `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public shutdown(): void {
    this.removeAllListeners();
  }
}