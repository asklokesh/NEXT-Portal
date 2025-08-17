import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { WebSocketService } from '@/lib/websocket/WebSocketService';

export interface RealtimeEvent {
  id: string;
  type: string;
  data: any;
  timestamp: string;
  source: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface EventSubscription {
  id: string;
  patterns: string[];
  callback: (event: RealtimeEvent) => void | Promise<void>;
  tenantId?: string;
  userId?: string;
}

export class RealtimeEventService extends EventEmitter {
  private static instance: RealtimeEventService;
  private redis: Redis;
  private pubRedis: Redis;
  private subRedis: Redis;
  private subscriptions: Map<string, EventSubscription> = new Map();
  private wsService: WebSocketService;
  private isConnected: boolean = false;

  private constructor() {
    super();
    this.initializeRedis();
    this.wsService = WebSocketService.getInstance();
    this.setupEventHandlers();
  }

  public static getInstance(): RealtimeEventService {
    if (!RealtimeEventService.instance) {
      RealtimeEventService.instance = new RealtimeEventService();
    }
    return RealtimeEventService.instance;
  }

  private initializeRedis() {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableAutoPipelining: true,
    };

    // Main Redis client for general operations
    this.redis = new Redis({ ...redisConfig, db: 1 });

    // Separate clients for pub/sub (Redis requirement)
    this.pubRedis = new Redis({ ...redisConfig, db: 1 });
    this.subRedis = new Redis({ ...redisConfig, db: 1 });

    this.setupRedisHandlers();
  }

  private setupRedisHandlers() {
    this.redis.on('connect', () => {
      console.log('RealtimeEventService: Redis connected');
      this.isConnected = true;
      this.emit('connected');
    });

    this.redis.on('error', (error) => {
      console.error('RealtimeEventService: Redis error:', error);
      this.isConnected = false;
      this.emit('error', error);
    });

    this.redis.on('close', () => {
      console.log('RealtimeEventService: Redis connection closed');
      this.isConnected = false;
      this.emit('disconnected');
    });

    // Subscribe to all real-time events
    this.subRedis.psubscribe('realtime:*');
    this.subRedis.on('pmessage', this.handleRedisMessage.bind(this));
  }

  private setupEventHandlers() {
    // Forward events to WebSocket service for real-time updates
    this.on('event', (event: RealtimeEvent) => {
      this.wsService.broadcast(event.type, event.data, {
        tenantId: event.tenantId,
        userId: event.userId,
        metadata: event.metadata
      });
    });
  }

  private async handleRedisMessage(pattern: string, channel: string, message: string) {
    try {
      const event: RealtimeEvent = JSON.parse(message);
      
      // Process internal subscriptions
      for (const subscription of this.subscriptions.values()) {
        if (this.matchesPattern(event.type, subscription.patterns)) {
          // Check tenant/user filtering
          if (subscription.tenantId && event.tenantId !== subscription.tenantId) {
            continue;
          }
          if (subscription.userId && event.userId !== subscription.userId) {
            continue;
          }

          try {
            await subscription.callback(event);
          } catch (error) {
            console.error(`Error in event subscription ${subscription.id}:`, error);
          }
        }
      }

      // Emit event for internal handlers
      this.emit('event', event);
      this.emit(event.type, event);

    } catch (error) {
      console.error('Error processing Redis message:', error);
    }
  }

  private matchesPattern(eventType: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(eventType);
      }
      return pattern === eventType;
    });
  }

  // Public API methods
  public async broadcast(eventType: string, data: any, options: {
    tenantId?: string;
    userId?: string;
    source?: string;
    metadata?: Record<string, any>;
  } = {}): Promise<void> {
    if (!this.isConnected) {
      console.warn('RealtimeEventService: Not connected to Redis, queuing event');
      // Could implement event queuing here
      return;
    }

    const event: RealtimeEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
      source: options.source || 'system',
      tenantId: options.tenantId,
      userId: options.userId,
      metadata: options.metadata
    };

    try {
      // Publish to Redis for distribution
      await this.pubRedis.publish(`realtime:${eventType}`, JSON.stringify(event));
      
      // Store event in history (with TTL)
      await this.redis.setex(
        `event_history:${event.id}`,
        3600, // 1 hour TTL
        JSON.stringify(event)
      );

      // Update event metrics
      await this.updateEventMetrics(eventType, options.tenantId);

    } catch (error) {
      console.error('Error broadcasting event:', error);
      throw error;
    }
  }

  public subscribe(
    patterns: string[],
    callback: (event: RealtimeEvent) => void | Promise<void>,
    options: {
      tenantId?: string;
      userId?: string;
    } = {}
  ): string {
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      patterns,
      callback,
      tenantId: options.tenantId,
      userId: options.userId
    });

    return subscriptionId;
  }

  public unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  public async getEventHistory(
    eventType?: string,
    tenantId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<RealtimeEvent[]> {
    try {
      // Simple implementation - in production, you'd want more sophisticated querying
      const pattern = eventType ? `event_history:*${eventType}*` : 'event_history:*';
      const keys = await this.redis.keys(pattern);
      
      const events = await Promise.all(
        keys.slice(offset, offset + limit).map(async (key) => {
          const eventData = await this.redis.get(key);
          return eventData ? JSON.parse(eventData) : null;
        })
      );

      return events
        .filter(event => event !== null)
        .filter(event => !tenantId || event.tenantId === tenantId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    } catch (error) {
      console.error('Error fetching event history:', error);
      return [];
    }
  }

  private async updateEventMetrics(eventType: string, tenantId?: string) {
    try {
      const now = new Date();
      const hourKey = `metrics:events:${eventType}:${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}:${now.getHours()}`;
      const dayKey = `metrics:events:${eventType}:${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      
      await Promise.all([
        this.redis.incr(hourKey),
        this.redis.expire(hourKey, 86400), // 24 hour TTL
        this.redis.incr(dayKey),
        this.redis.expire(dayKey, 86400 * 7), // 7 day TTL
      ]);

      if (tenantId) {
        const tenantKey = `metrics:tenant:${tenantId}:events:${eventType}:${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
        await this.redis.incr(tenantKey);
        await this.redis.expire(tenantKey, 86400 * 30); // 30 day TTL
      }
    } catch (error) {
      console.error('Error updating event metrics:', error);
    }
  }

  public async getEventMetrics(
    eventType?: string,
    tenantId?: string,
    timeRange: 'hour' | 'day' | 'week' = 'day'
  ): Promise<Record<string, number>> {
    try {
      const now = new Date();
      const patterns: string[] = [];

      if (timeRange === 'hour') {
        for (let i = 0; i < 24; i++) {
          const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
          const key = eventType 
            ? `metrics:events:${eventType}:${hour.getFullYear()}-${hour.getMonth() + 1}-${hour.getDate()}:${hour.getHours()}`
            : `metrics:events:*:${hour.getFullYear()}-${hour.getMonth() + 1}-${hour.getDate()}:${hour.getHours()}`;
          patterns.push(key);
        }
      } else if (timeRange === 'day') {
        for (let i = 0; i < 7; i++) {
          const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const key = eventType
            ? `metrics:events:${eventType}:${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`
            : `metrics:events:*:${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
          patterns.push(key);
        }
      }

      const metrics: Record<string, number> = {};
      
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        for (const key of keys) {
          const value = await this.redis.get(key);
          metrics[key] = parseInt(value || '0', 10);
        }
      }

      return metrics;
    } catch (error) {
      console.error('Error fetching event metrics:', error);
      return {};
    }
  }

  // Plugin-specific convenience methods
  public async broadcastPluginEvent(
    eventType: string,
    pluginId: string,
    data: any,
    options: {
      tenantId?: string;
      userId?: string;
      priority?: 'low' | 'normal' | 'high' | 'critical';
    } = {}
  ): Promise<void> {
    await this.broadcast(`plugin.${eventType}`, {
      pluginId,
      ...data
    }, {
      ...options,
      source: 'plugin-system',
      metadata: {
        pluginId,
        priority: options.priority || 'normal',
        category: 'plugin'
      }
    });
  }

  public async broadcastQualityEvent(
    eventType: string,
    repositoryId: string,
    qualityData: any,
    options: {
      tenantId?: string;
      commitId?: string;
    } = {}
  ): Promise<void> {
    await this.broadcast(`quality.${eventType}`, {
      repositoryId,
      commitId: options.commitId,
      ...qualityData
    }, {
      tenantId: options.tenantId,
      source: 'quality-system',
      metadata: {
        repositoryId,
        commitId: options.commitId,
        category: 'quality'
      }
    });
  }

  public async broadcastSecurityEvent(
    eventType: string,
    data: any,
    options: {
      tenantId?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      repositoryId?: string;
    } = {}
  ): Promise<void> {
    await this.broadcast(`security.${eventType}`, data, {
      tenantId: options.tenantId,
      source: 'security-system',
      metadata: {
        severity: options.severity || 'medium',
        repositoryId: options.repositoryId,
        category: 'security',
        requiresAlert: (options.severity === 'high' || options.severity === 'critical')
      }
    });
  }

  // Health and monitoring
  public async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      redis: boolean;
      subscriptions: number;
      websocket: boolean;
      lastEvent?: string;
    };
  }> {
    try {
      // Check Redis connectivity
      await this.redis.ping();
      
      // Check WebSocket service
      const wsHealthy = this.wsService.isHealthy();
      
      const details = {
        redis: this.isConnected,
        subscriptions: this.subscriptions.size,
        websocket: wsHealthy,
        lastEvent: undefined as string | undefined
      };

      // Get last event timestamp
      try {
        const keys = await this.redis.keys('event_history:*');
        if (keys.length > 0) {
          const lastKey = keys[keys.length - 1];
          const eventData = await this.redis.get(lastKey);
          if (eventData) {
            const event = JSON.parse(eventData);
            details.lastEvent = event.timestamp;
          }
        }
      } catch (error) {
        console.warn('Could not fetch last event timestamp:', error);
      }

      const status = (details.redis && details.websocket) ? 'healthy' : 
                    (details.redis || details.websocket) ? 'degraded' : 'unhealthy';

      return { status, details };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          redis: false,
          subscriptions: this.subscriptions.size,
          websocket: false
        }
      };
    }
  }

  public async shutdown(): Promise<void> {
    console.log('Shutting down RealtimeEventService...');
    
    // Clear subscriptions
    this.subscriptions.clear();
    
    // Close Redis connections
    await Promise.all([
      this.redis.quit(),
      this.pubRedis.quit(),
      this.subRedis.quit()
    ]);
    
    this.removeAllListeners();
    console.log('RealtimeEventService shutdown complete');
  }
}

// Export singleton instance
export const realtimeEventService = RealtimeEventService.getInstance();