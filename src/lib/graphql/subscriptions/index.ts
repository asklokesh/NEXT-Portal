/**
 * Real-time Subscriptions with Redis PubSub
 */

import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';
import { withFilter } from 'graphql-subscriptions';

export interface SubscriptionConfig {
  redisUrl: string;
  retryStrategy?: (times: number) => number;
}

export function createPubSub(config: SubscriptionConfig): RedisPubSub {
  const options = {
    retryStrategy: config.retryStrategy || ((times: number) => Math.min(times * 50, 2000)),
    enableOfflineQueue: true,
    maxRetriesPerRequest: 3,
  };

  const publisher = new Redis(config.redisUrl, options);
  const subscriber = new Redis(config.redisUrl, options);

  // Handle connection events
  publisher.on('connect', () => console.log('Redis Publisher connected'));
  publisher.on('error', (err) => console.error('Redis Publisher error:', err));
  subscriber.on('connect', () => console.log('Redis Subscriber connected'));
  subscriber.on('error', (err) => console.error('Redis Subscriber error:', err));

  return new RedisPubSub({
    publisher,
    subscriber,
    reviver: (key, value) => {
      // Custom reviver for Date objects
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        return new Date(value);
      }
      return value;
    },
  });
}

// Subscription Topics
export enum SubscriptionTopic {
  // Service events
  SERVICE_CREATED = 'SERVICE_CREATED',
  SERVICE_UPDATED = 'SERVICE_UPDATED',
  SERVICE_DELETED = 'SERVICE_DELETED',
  SERVICE_STATUS_CHANGED = 'SERVICE_STATUS_CHANGED',
  SERVICE_HEALTH_CHANGED = 'SERVICE_HEALTH_CHANGED',
  
  // Plugin events
  PLUGIN_INSTALLED = 'PLUGIN_INSTALLED',
  PLUGIN_UPDATED = 'PLUGIN_UPDATED',
  PLUGIN_UNINSTALLED = 'PLUGIN_UNINSTALLED',
  PLUGIN_STATUS_CHANGED = 'PLUGIN_STATUS_CHANGED',
  
  // Template events
  TEMPLATE_CREATED = 'TEMPLATE_CREATED',
  TEMPLATE_UPDATED = 'TEMPLATE_UPDATED',
  TEMPLATE_DELETED = 'TEMPLATE_DELETED',
  TEMPLATE_EXECUTED = 'TEMPLATE_EXECUTED',
  
  // Notification events
  NOTIFICATION_CREATED = 'NOTIFICATION_CREATED',
  NOTIFICATION_READ = 'NOTIFICATION_READ',
  NOTIFICATION_DELETED = 'NOTIFICATION_DELETED',
  
  // Workflow events
  WORKFLOW_STARTED = 'WORKFLOW_STARTED',
  WORKFLOW_COMPLETED = 'WORKFLOW_COMPLETED',
  WORKFLOW_FAILED = 'WORKFLOW_FAILED',
  WORKFLOW_STEP_COMPLETED = 'WORKFLOW_STEP_COMPLETED',
  
  // Cost events
  COST_ALERT_TRIGGERED = 'COST_ALERT_TRIGGERED',
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  
  // Metrics events
  METRIC_THRESHOLD_EXCEEDED = 'METRIC_THRESHOLD_EXCEEDED',
  ANOMALY_DETECTED = 'ANOMALY_DETECTED',
  
  // Deployment events
  DEPLOYMENT_STARTED = 'DEPLOYMENT_STARTED',
  DEPLOYMENT_COMPLETED = 'DEPLOYMENT_COMPLETED',
  DEPLOYMENT_FAILED = 'DEPLOYMENT_FAILED',
  DEPLOYMENT_ROLLED_BACK = 'DEPLOYMENT_ROLLED_BACK',
}

// Subscription Filters
export const subscriptionFilters = {
  byUser: (userId: string) => 
    withFilter(
      () => true,
      (payload, variables, context) => {
        return payload.userId === userId || context.user?.id === userId;
      }
    ),
    
  byOrganization: (organizationId: string) =>
    withFilter(
      () => true,
      (payload, variables, context) => {
        return payload.organizationId === organizationId ||
               context.user?.organizations?.includes(organizationId);
      }
    ),
    
  byTeam: (teamId: string) =>
    withFilter(
      () => true,
      (payload, variables, context) => {
        return payload.teamId === teamId ||
               context.user?.teams?.includes(teamId);
      }
    ),
    
  byService: (serviceId: string) =>
    withFilter(
      () => true,
      (payload, variables) => {
        return payload.serviceId === serviceId ||
               variables.serviceId === serviceId;
      }
    ),
    
  byPermission: (permission: string) =>
    withFilter(
      () => true,
      (payload, variables, context) => {
        return context.permissions?.canRead(permission);
      }
    ),
};

// Subscription Manager
export class SubscriptionManager {
  private pubsub: RedisPubSub;
  private subscriptions: Map<string, Set<string>> = new Map();
  
  constructor(pubsub: RedisPubSub) {
    this.pubsub = pubsub;
  }
  
  async publish<T = any>(
    topic: SubscriptionTopic,
    payload: T,
    metadata?: Record<string, any>
  ): Promise<void> {
    const event = {
      type: topic,
      payload,
      timestamp: new Date(),
      metadata,
    };
    
    await this.pubsub.publish(topic, event);
    
    // Track subscription metrics
    this.trackPublication(topic);
  }
  
  async subscribe(
    userId: string,
    topics: SubscriptionTopic[]
  ): Promise<void> {
    for (const topic of topics) {
      if (!this.subscriptions.has(topic)) {
        this.subscriptions.set(topic, new Set());
      }
      this.subscriptions.get(topic)!.add(userId);
    }
  }
  
  async unsubscribe(
    userId: string,
    topics?: SubscriptionTopic[]
  ): Promise<void> {
    if (topics) {
      for (const topic of topics) {
        this.subscriptions.get(topic)?.delete(userId);
      }
    } else {
      // Unsubscribe from all topics
      for (const subscribers of this.subscriptions.values()) {
        subscribers.delete(userId);
      }
    }
  }
  
  getSubscriptionStats() {
    const stats: Record<string, number> = {};
    
    for (const [topic, subscribers] of this.subscriptions.entries()) {
      stats[topic] = subscribers.size;
    }
    
    return stats;
  }
  
  private trackPublication(topic: SubscriptionTopic) {
    // Implement metrics tracking
    console.log(`Published event to topic: ${topic}`);
  }
}

// Real-time Event Aggregator
export class EventAggregator {
  private events: Map<string, any[]> = new Map();
  private maxEventsPerKey = 100;
  
  addEvent(key: string, event: any) {
    if (!this.events.has(key)) {
      this.events.set(key, []);
    }
    
    const events = this.events.get(key)!;
    events.push(event);
    
    // Limit number of events
    if (events.length > this.maxEventsPerKey) {
      events.shift();
    }
  }
  
  getEvents(key: string, limit?: number): any[] {
    const events = this.events.get(key) || [];
    return limit ? events.slice(-limit) : events;
  }
  
  clearEvents(key?: string) {
    if (key) {
      this.events.delete(key);
    } else {
      this.events.clear();
    }
  }
  
  getEventCount(key?: string): number {
    if (key) {
      return this.events.get(key)?.length || 0;
    }
    
    let total = 0;
    for (const events of this.events.values()) {
      total += events.length;
    }
    return total;
  }
}