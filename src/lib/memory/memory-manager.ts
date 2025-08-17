/**
 * Memory Management and Optimization System
 * Enterprise-grade memory management for WebSocket connections, event queues, and caching
 */

import { EventEmitter } from 'events';
import { Server as SocketIOServer } from 'socket.io';
import { createHash } from 'crypto';

// Memory configuration
const MEMORY_CONFIG = {
  // WebSocket connection limits
  websocket: {
    maxConnections: 10000,
    maxConnectionsPerTenant: 1000,
    maxConnectionsPerUser: 50,
    connectionTimeout: 30000,
    heartbeatInterval: 25000,
    maxEventQueueSize: 1000,
    maxMessageSize: 1024 * 1024, // 1MB
  },
  
  // Event queue management
  eventQueue: {
    maxQueueSize: 10000,
    maxEventAge: 300000, // 5 minutes
    batchSize: 100,
    flushInterval: 1000, // 1 second
    maxRetries: 3,
  },
  
  // Memory monitoring
  monitoring: {
    checkInterval: 30000, // 30 seconds
    warningThreshold: 0.8, // 80% memory usage
    criticalThreshold: 0.9, // 90% memory usage
    gcInterval: 300000, // 5 minutes
  },
  
  // Cache management
  cache: {
    maxMemoryUsage: 512 * 1024 * 1024, // 512MB
    evictionPolicy: 'lru',
    checkInterval: 60000, // 1 minute
  }
};

interface ConnectionInfo {
  id: string;
  userId?: string;
  tenantId?: string;
  connectedAt: number;
  lastActivity: number;
  messageCount: number;
  eventQueue: QueuedEvent[];
}

interface QueuedEvent {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retryCount: number;
  tenantId?: string;
  userId?: string;
}

interface MemoryStats {
  used: number;
  total: number;
  usage: number;
  connections: number;
  eventQueues: number;
  averageQueueSize: number;
  memoryLeaks: number;
}

class MemoryManager extends EventEmitter {
  private static instance: MemoryManager;
  private connections: Map<string, ConnectionInfo> = new Map();
  private eventQueues: Map<string, QueuedEvent[]> = new Map();
  private tenantConnections: Map<string, Set<string>> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private gcInterval: NodeJS.Timeout | null = null;
  private eventProcessingInterval: NodeJS.Timeout | null = null;
  private memoryStats: MemoryStats = {
    used: 0,
    total: 0,
    usage: 0,
    connections: 0,
    eventQueues: 0,
    averageQueueSize: 0,
    memoryLeaks: 0
  };

  private constructor() {
    super();
    this.setMaxListeners(0); // Remove listener limit
    this.startMonitoring();
    this.startEventProcessing();
    this.startPeriodicGC();
  }

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  /**
   * WebSocket Connection Management
   */
  async registerConnection(
    connectionId: string,
    userId?: string,
    tenantId?: string
  ): Promise<boolean> {
    // Check global connection limit
    if (this.connections.size >= MEMORY_CONFIG.websocket.maxConnections) {
      console.warn('Global WebSocket connection limit reached');
      return false;
    }

    // Check tenant-specific limits
    if (tenantId) {
      const tenantConnections = this.tenantConnections.get(tenantId) || new Set();
      if (tenantConnections.size >= MEMORY_CONFIG.websocket.maxConnectionsPerTenant) {
        console.warn(`Tenant ${tenantId} connection limit reached`);
        return false;
      }
    }

    // Check user-specific limits
    if (userId) {
      const userConnections = this.userConnections.get(userId) || new Set();
      if (userConnections.size >= MEMORY_CONFIG.websocket.maxConnectionsPerUser) {
        console.warn(`User ${userId} connection limit reached`);
        return false;
      }
    }

    // Register the connection
    const connectionInfo: ConnectionInfo = {
      id: connectionId,
      userId,
      tenantId,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      eventQueue: []
    };

    this.connections.set(connectionId, connectionInfo);

    // Track tenant connections
    if (tenantId) {
      const tenantConnections = this.tenantConnections.get(tenantId) || new Set();
      tenantConnections.add(connectionId);
      this.tenantConnections.set(tenantId, tenantConnections);
    }

    // Track user connections
    if (userId) {
      const userConnections = this.userConnections.get(userId) || new Set();
      userConnections.add(connectionId);
      this.userConnections.set(userId, userConnections);
    }

    this.emit('connectionRegistered', { connectionId, userId, tenantId });
    return true;
  }

  /**
   * Unregister WebSocket connection
   */
  async unregisterConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from tenant tracking
    if (connection.tenantId) {
      const tenantConnections = this.tenantConnections.get(connection.tenantId);
      if (tenantConnections) {
        tenantConnections.delete(connectionId);
        if (tenantConnections.size === 0) {
          this.tenantConnections.delete(connection.tenantId);
        }
      }
    }

    // Remove from user tracking
    if (connection.userId) {
      const userConnections = this.userConnections.get(connection.userId);
      if (userConnections) {
        userConnections.delete(connectionId);
        if (userConnections.size === 0) {
          this.userConnections.delete(connection.userId);
        }
      }
    }

    // Clean up event queue
    if (connection.eventQueue.length > 0) {
      console.log(`Cleaning up ${connection.eventQueue.length} queued events for connection ${connectionId}`);
    }

    this.connections.delete(connectionId);
    this.emit('connectionUnregistered', { connectionId });
  }

  /**
   * Update connection activity
   */
  updateConnectionActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = Date.now();
      connection.messageCount++;
    }
  }

  /**
   * Event Queue Management
   */
  async queueEvent(event: Omit<QueuedEvent, 'id' | 'timestamp' | 'retryCount'>): Promise<boolean> {
    const queueId = event.tenantId || 'global';
    const queue = this.eventQueues.get(queueId) || [];

    // Check queue size limit
    if (queue.length >= MEMORY_CONFIG.eventQueue.maxQueueSize) {
      console.warn(`Event queue ${queueId} is full, dropping oldest events`);
      // Remove oldest events
      queue.splice(0, MEMORY_CONFIG.eventQueue.batchSize);
    }

    const queuedEvent: QueuedEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now(),
      retryCount: 0
    };

    queue.push(queuedEvent);
    this.eventQueues.set(queueId, queue);

    this.emit('eventQueued', queuedEvent);
    return true;
  }

  /**
   * Process event queues
   */
  private async processEventQueues(): Promise<void> {
    const now = Date.now();
    
    for (const [queueId, queue] of this.eventQueues.entries()) {
      if (queue.length === 0) continue;

      // Remove expired events
      const validEvents = queue.filter(event => 
        now - event.timestamp <= MEMORY_CONFIG.eventQueue.maxEventAge
      );

      if (validEvents.length !== queue.length) {
        console.log(`Removed ${queue.length - validEvents.length} expired events from queue ${queueId}`);
        this.eventQueues.set(queueId, validEvents);
      }

      // Process events in batches
      const eventsToProcess = validEvents.splice(0, MEMORY_CONFIG.eventQueue.batchSize);
      
      for (const event of eventsToProcess) {
        try {
          await this.processEvent(event);
          this.emit('eventProcessed', event);
        } catch (error) {
          console.error('Event processing error:', error);
          
          // Retry logic
          if (event.retryCount < MEMORY_CONFIG.eventQueue.maxRetries) {
            event.retryCount++;
            validEvents.push(event); // Re-queue for retry
          } else {
            console.error(`Event ${event.id} failed after ${event.retryCount} retries`);
            this.emit('eventFailed', event);
          }
        }
      }
    }
  }

  /**
   * Process individual event
   */
  private async processEvent(event: QueuedEvent): Promise<void> {
    // Find target connections
    const targetConnections = this.findTargetConnections(event);
    
    if (targetConnections.length === 0) {
      // No active connections for this event
      return;
    }

    // Send event to target connections
    for (const connectionId of targetConnections) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.eventQueue.push(event);
        
        // Limit per-connection queue size
        if (connection.eventQueue.length > MEMORY_CONFIG.websocket.maxEventQueueSize) {
          connection.eventQueue.splice(0, connection.eventQueue.length - MEMORY_CONFIG.websocket.maxEventQueueSize);
        }
      }
    }
  }

  /**
   * Find target connections for an event
   */
  private findTargetConnections(event: QueuedEvent): string[] {
    const connections: string[] = [];

    if (event.tenantId) {
      // Send to all connections for this tenant
      const tenantConnections = this.tenantConnections.get(event.tenantId);
      if (tenantConnections) {
        connections.push(...Array.from(tenantConnections));
      }
    } else if (event.userId) {
      // Send to all connections for this user
      const userConnections = this.userConnections.get(event.userId);
      if (userConnections) {
        connections.push(...Array.from(userConnections));
      }
    } else {
      // Global event - send to all connections
      connections.push(...Array.from(this.connections.keys()));
    }

    return connections;
  }

  /**
   * Memory Monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.updateMemoryStats();
      this.checkMemoryUsage();
      this.cleanupStaleConnections();
    }, MEMORY_CONFIG.monitoring.checkInterval);
  }

  private updateMemoryStats(): void {
    const memUsage = process.memoryUsage();
    
    this.memoryStats = {
      used: memUsage.heapUsed,
      total: memUsage.heapTotal,
      usage: memUsage.heapUsed / memUsage.heapTotal,
      connections: this.connections.size,
      eventQueues: this.eventQueues.size,
      averageQueueSize: this.calculateAverageQueueSize(),
      memoryLeaks: this.detectMemoryLeaks()
    };

    this.emit('memoryStats', this.memoryStats);
  }

  private checkMemoryUsage(): void {
    const usage = this.memoryStats.usage;

    if (usage >= MEMORY_CONFIG.monitoring.criticalThreshold) {
      console.error(`Critical memory usage: ${(usage * 100).toFixed(2)}%`);
      this.emit('memoryWarning', { level: 'critical', usage });
      this.performEmergencyCleanup();
    } else if (usage >= MEMORY_CONFIG.monitoring.warningThreshold) {
      console.warn(`High memory usage: ${(usage * 100).toFixed(2)}%`);
      this.emit('memoryWarning', { level: 'warning', usage });
      this.performOptimization();
    }
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleConnections: string[] = [];

    for (const [connectionId, connection] of this.connections.entries()) {
      if (now - connection.lastActivity > MEMORY_CONFIG.websocket.connectionTimeout) {
        staleConnections.push(connectionId);
      }
    }

    for (const connectionId of staleConnections) {
      console.log(`Removing stale connection: ${connectionId}`);
      this.unregisterConnection(connectionId);
    }
  }

  /**
   * Memory Optimization
   */
  private performOptimization(): void {
    // Clean up empty event queues
    for (const [queueId, queue] of this.eventQueues.entries()) {
      if (queue.length === 0) {
        this.eventQueues.delete(queueId);
      }
    }

    // Limit connection event queues
    for (const connection of this.connections.values()) {
      if (connection.eventQueue.length > MEMORY_CONFIG.websocket.maxEventQueueSize / 2) {
        connection.eventQueue.splice(0, connection.eventQueue.length - MEMORY_CONFIG.websocket.maxEventQueueSize / 2);
      }
    }

    // Trigger garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  private performEmergencyCleanup(): void {
    console.log('Performing emergency memory cleanup');

    // Clear all event queues
    this.eventQueues.clear();

    // Clear connection event queues
    for (const connection of this.connections.values()) {
      connection.eventQueue = [];
    }

    // Close oldest connections if still over limit
    const sortedConnections = Array.from(this.connections.entries())
      .sort(([, a], [, b]) => a.lastActivity - b.lastActivity);

    const connectionsToClose = Math.floor(this.connections.size * 0.1); // Close 10% of connections
    for (let i = 0; i < connectionsToClose; i++) {
      const [connectionId] = sortedConnections[i];
      this.unregisterConnection(connectionId);
    }

    // Force garbage collection
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Periodic Garbage Collection
   */
  private startPeriodicGC(): void {
    this.gcInterval = setInterval(() => {
      if (global.gc) {
        global.gc();
        console.log('Performed periodic garbage collection');
      }
    }, MEMORY_CONFIG.monitoring.gcInterval);
  }

  /**
   * Event Processing
   */
  private startEventProcessing(): void {
    this.eventProcessingInterval = setInterval(() => {
      this.processEventQueues();
    }, MEMORY_CONFIG.eventQueue.flushInterval);
  }

  /**
   * Utility Methods
   */
  private generateEventId(): string {
    return createHash('md5')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex');
  }

  private calculateAverageQueueSize(): number {
    if (this.eventQueues.size === 0) return 0;
    
    const totalSize = Array.from(this.eventQueues.values())
      .reduce((sum, queue) => sum + queue.length, 0);
    
    return totalSize / this.eventQueues.size;
  }

  private detectMemoryLeaks(): number {
    // Simple heuristic: connections that have been idle for too long
    const now = Date.now();
    let leaks = 0;
    
    for (const connection of this.connections.values()) {
      if (now - connection.lastActivity > MEMORY_CONFIG.websocket.connectionTimeout * 2) {
        leaks++;
      }
    }
    
    return leaks;
  }

  /**
   * Public API
   */
  getConnectionInfo(connectionId: string): ConnectionInfo | undefined {
    return this.connections.get(connectionId);
  }

  getConnectionsByTenant(tenantId: string): ConnectionInfo[] {
    const connectionIds = this.tenantConnections.get(tenantId) || new Set();
    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter(Boolean) as ConnectionInfo[];
  }

  getConnectionsByUser(userId: string): ConnectionInfo[] {
    const connectionIds = this.userConnections.get(userId) || new Set();
    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter(Boolean) as ConnectionInfo[];
  }

  getMemoryStats(): MemoryStats {
    return { ...this.memoryStats };
  }

  getDetailedStats(): any {
    return {
      memory: this.memoryStats,
      connections: {
        total: this.connections.size,
        byTenant: Object.fromEntries(
          Array.from(this.tenantConnections.entries())
            .map(([tenantId, connections]) => [tenantId, connections.size])
        ),
        byUser: Object.fromEntries(
          Array.from(this.userConnections.entries())
            .map(([userId, connections]) => [userId, connections.size])
        )
      },
      eventQueues: {
        total: this.eventQueues.size,
        totalEvents: Array.from(this.eventQueues.values())
          .reduce((sum, queue) => sum + queue.length, 0),
        averageSize: this.calculateAverageQueueSize()
      }
    };
  }

  /**
   * Cleanup
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.gcInterval) {
      clearInterval(this.gcInterval);
    }
    
    if (this.eventProcessingInterval) {
      clearInterval(this.eventProcessingInterval);
    }

    this.connections.clear();
    this.eventQueues.clear();
    this.tenantConnections.clear();
    this.userConnections.clear();
    
    this.removeAllListeners();
    console.log('Memory manager shut down');
  }
}

export default MemoryManager;
export { ConnectionInfo, QueuedEvent, MemoryStats, MEMORY_CONFIG };