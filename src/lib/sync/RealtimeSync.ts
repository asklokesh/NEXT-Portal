import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { z } from 'zod';
import { webhookManager } from './WebhookManager';

// Event schemas
const RealtimeEventSchema = z.object({
  type: z.string(),
  data: z.record(z.any()),
  timestamp: z.number(),
  source: z.string(),
  entityId: z.string().optional(),
  namespace: z.string().optional(),
  team: z.string().optional(),
  userId: z.string().optional(),
});

const SubscriptionSchema = z.object({
  room: z.string(),
  filters: z.object({
    entityTypes: z.array(z.string()).optional(),
    namespaces: z.array(z.string()).optional(),
    teams: z.array(z.string()).optional(),
    eventTypes: z.array(z.string()).optional(),
  }).optional(),
});

export type RealtimeEvent = z.infer<typeof RealtimeEventSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;

export interface ConnectionInfo {
  id: string;
  userId?: string;
  connectedAt: number;
  lastActivity: number;
  subscriptions: Set<string>;
  metadata: Record<string, any>;
}

export interface RoomStats {
  name: string;
  connectionCount: number;
  messageCount: number;
  lastActivity: number;
}

export class RealtimeSync {
  private io: SocketIOServer;
  private connections = new Map<string, ConnectionInfo>();
  private roomFilters = new Map<string, Subscription['filters']>();
  private messageQueue = new Map<string, RealtimeEvent[]>();
  private stats = {
    totalConnections: 0,
    activeConnections: 0,
    messagesProcessed: 0,
    roomsActive: 0,
  };

  constructor(
    server: HTTPServer,
    private options: {
      cors?: {
        origin: string | string[];
        credentials?: boolean;
      };
      maxConnections?: number;
      heartbeatInterval?: number;
      heartbeatTimeout?: number;
      messageQueueSize?: number;
      cleanupInterval?: number;
    } = {}
  ) {
    this.options = {
      maxConnections: 1000,
      heartbeatInterval: 25000, // 25 seconds
      heartbeatTimeout: 60000, // 60 seconds
      messageQueueSize: 100,
      cleanupInterval: 300000, // 5 minutes
      ...options,
    };

    this.io = new SocketIOServer(server, {
      cors: this.options.cors || {
        origin: process.env.NODE_ENV === 'production' 
          ? process.env.FRONTEND_URL || 'https://your-domain.com'
          : ['http://localhost:3000', 'http://localhost:4400'],
        credentials: true,
      },
      pingInterval: this.options.heartbeatInterval,
      pingTimeout: this.options.heartbeatTimeout,
      maxHttpBufferSize: 1e6, // 1MB
      transports: ['websocket', 'polling'],
    });

    this.initializeSocketHandlers();
    this.startCleanupTasks();
    this.integrateMockWebhookManager();
  }

  private initializeSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    this.io.engine.on('initial_headers', (headers, request) => {
      headers['X-Powered-By'] = 'Backstage-IDP-RealtimeSync';
    });
  }

  private handleConnection(socket: any): void {
    const connectionId = socket.id;
    const clientIp = socket.handshake.address;
    
    // Connection limit check
    if (this.connections.size >= this.options.maxConnections!) {
      console.warn(`Connection limit reached, rejecting connection from ${clientIp}`);
      socket.emit('error', { message: 'Connection limit reached' });
      socket.disconnect(true);
      return;
    }

    // Initialize connection info
    const connectionInfo: ConnectionInfo = {
      id: connectionId,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      subscriptions: new Set(),
      metadata: {
        ip: clientIp,
        userAgent: socket.handshake.headers['user-agent'],
      },
    };

    this.connections.set(connectionId, connectionInfo);
    this.stats.totalConnections++;
    this.stats.activeConnections++;

    console.log(`Client connected: ${connectionId} (${this.stats.activeConnections} active)`);

    // Authentication (if token provided)
    socket.on('authenticate', async (data: { token?: string; userId?: string }) => {
      try {
        if (data.token) {
          // Validate JWT token here if needed
          connectionInfo.userId = data.userId;
          connectionInfo.metadata.authenticated = true;
          socket.emit('authenticated', { success: true });
        }
      } catch (error) {
        socket.emit('authentication_error', { 
          message: error instanceof Error ? error.message : 'Authentication failed' 
        });
      }
    });

    // Room subscription
    socket.on('subscribe', async (subscription: Subscription) => {
      try {
        const validatedSub = SubscriptionSchema.parse(subscription);
        await this.subscribeToRoom(socket, connectionInfo, validatedSub);
      } catch (error) {
        socket.emit('subscription_error', { 
          message: error instanceof Error ? error.message : 'Invalid subscription' 
        });
      }
    });

    // Room unsubscription
    socket.on('unsubscribe', (roomName: string) => {
      this.unsubscribeFromRoom(socket, connectionInfo, roomName);
    });

    // Heartbeat/ping handling
    socket.on('ping', () => {
      connectionInfo.lastActivity = Date.now();
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Request current state
    socket.on('request_state', async (roomName: string) => {
      await this.sendCurrentState(socket, roomName);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(connectionId, reason);
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${connectionId}:`, error);
    });

    // Send welcome message
    socket.emit('connected', {
      connectionId,
      timestamp: Date.now(),
      capabilities: ['catalog_sync', 'template_updates', 'plugin_status', 'health_monitoring'],
    });
  }

  private async subscribeToRoom(socket: any, connectionInfo: ConnectionInfo, subscription: Subscription): Promise<void> {
    const { room, filters } = subscription;

    // Leave existing room if subscribed
    if (connectionInfo.subscriptions.has(room)) {
      socket.leave(room);
    }

    // Store filters for this room
    if (filters) {
      this.roomFilters.set(room, filters);
    }

    // Join the new room
    socket.join(room);
    connectionInfo.subscriptions.add(room);
    connectionInfo.lastActivity = Date.now();

    console.log(`Client ${connectionInfo.id} subscribed to room: ${room}`);

    // Send any queued messages for this room
    await this.sendQueuedMessages(socket, room);

    // Acknowledge subscription
    socket.emit('subscribed', { 
      room, 
      timestamp: Date.now(),
      queuedMessages: this.messageQueue.get(room)?.length || 0,
    });
  }

  private unsubscribeFromRoom(socket: any, connectionInfo: ConnectionInfo, roomName: string): void {
    socket.leave(roomName);
    connectionInfo.subscriptions.delete(roomName);
    connectionInfo.lastActivity = Date.now();

    console.log(`Client ${connectionInfo.id} unsubscribed from room: ${roomName}`);
    socket.emit('unsubscribed', { room: roomName, timestamp: Date.now() });
  }

  private handleDisconnection(connectionId: string, reason: string): void {
    const connectionInfo = this.connections.get(connectionId);
    if (connectionInfo) {
      console.log(`Client disconnected: ${connectionId}, reason: ${reason}`);
      this.connections.delete(connectionId);
      this.stats.activeConnections--;
    }
  }

  /**
   * Broadcast event to all relevant subscribers
   */
  async broadcastEvent(event: RealtimeEvent): Promise<void> {
    const validatedEvent = RealtimeEventSchema.parse(event);
    
    // Determine target rooms based on event data
    const targetRooms = this.determineTargetRooms(validatedEvent);

    for (const room of targetRooms) {
      await this.sendToRoom(room, validatedEvent);
    }

    this.stats.messagesProcessed++;
  }

  /**
   * Send event to specific room
   */
  async sendToRoom(roomName: string, event: RealtimeEvent): Promise<void> {
    const roomFilters = this.roomFilters.get(roomName);
    
    // Apply filters if they exist
    if (roomFilters && !this.passesFilters(event, roomFilters)) {
      return;
    }

    const room = this.io.to(roomName);
    const clientsInRoom = await this.io.in(roomName).allSockets();

    if (clientsInRoom.size === 0) {
      // Queue message if no active clients
      this.queueMessage(roomName, event);
      return;
    }

    room.emit('event', event);
    console.log(`Broadcasted ${event.type} to room ${roomName} (${clientsInRoom.size} clients)`);
  }

  /**
   * Send direct message to specific connection
   */
  sendToConnection(connectionId: string, event: RealtimeEvent): void {
    const socket = this.io.sockets.sockets.get(connectionId);
    if (socket) {
      socket.emit('event', event);
    }
  }

  /**
   * Get real-time statistics
   */
  getStats(): typeof this.stats & { rooms: RoomStats[] } {
    const rooms: RoomStats[] = [];
    
    for (const [roomName] of this.roomFilters) {
      const sockets = this.io.sockets.adapter.rooms.get(roomName);
      rooms.push({
        name: roomName,
        connectionCount: sockets?.size || 0,
        messageCount: this.messageQueue.get(roomName)?.length || 0,
        lastActivity: Date.now(), // TODO: Track actual last activity per room
      });
    }

    return {
      ...this.stats,
      rooms,
    };
  }

  /**
   * Get active connections info
   */
  getConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  /**
   * Force disconnect a connection
   */
  disconnectConnection(connectionId: string, reason: string = 'admin_disconnect'): void {
    const socket = this.io.sockets.sockets.get(connectionId);
    if (socket) {
      socket.emit('force_disconnect', { reason });
      socket.disconnect(true);
    }
  }

  private determineTargetRooms(event: RealtimeEvent): string[] {
    const rooms: string[] = [];

    // Global room - all events
    rooms.push('global');

    // Entity-specific rooms
    if (event.entityId) {
      rooms.push(`entity:${event.entityId}`);
    }

    // Namespace-specific rooms
    if (event.namespace) {
      rooms.push(`namespace:${event.namespace}`);
    }

    // Team-specific rooms
    if (event.team) {
      rooms.push(`team:${event.team}`);
    }

    // Event type rooms
    rooms.push(`event:${event.type}`);

    // Source-specific rooms
    rooms.push(`source:${event.source}`);

    return rooms;
  }

  private passesFilters(event: RealtimeEvent, filters: Subscription['filters']): boolean {
    if (!filters) return true;

    // Check event type filter
    if (filters.eventTypes && !filters.eventTypes.includes(event.type)) {
      return false;
    }

    // Check namespace filter
    if (filters.namespaces && event.namespace && !filters.namespaces.includes(event.namespace)) {
      return false;
    }

    // Check team filter
    if (filters.teams && event.team && !filters.teams.includes(event.team)) {
      return false;
    }

    return true;
  }

  private queueMessage(roomName: string, event: RealtimeEvent): void {
    if (!this.messageQueue.has(roomName)) {
      this.messageQueue.set(roomName, []);
    }

    const queue = this.messageQueue.get(roomName)!;
    queue.push(event);

    // Limit queue size
    if (queue.length > this.options.messageQueueSize!) {
      queue.shift(); // Remove oldest message
    }
  }

  private async sendQueuedMessages(socket: any, roomName: string): Promise<void> {
    const queuedMessages = this.messageQueue.get(roomName);
    if (queuedMessages && queuedMessages.length > 0) {
      for (const message of queuedMessages) {
        socket.emit('event', message);
      }
      
      // Clear the queue after sending
      this.messageQueue.delete(roomName);
      console.log(`Sent ${queuedMessages.length} queued messages to client in room ${roomName}`);
    }
  }

  private async sendCurrentState(socket: any, roomName: string): Promise<void> {
    // This would fetch current state from your data store
    // For now, we'll send a placeholder
    const currentState = {
      type: 'state_snapshot',
      data: {
        room: roomName,
        timestamp: Date.now(),
        // Add actual state data here based on room type
      },
      timestamp: Date.now(),
      source: 'realtime_sync',
    };

    socket.emit('current_state', currentState);
  }

  private startCleanupTasks(): void {
    // Clean up stale connections and queued messages
    const cleanup = () => {
      const now = Date.now();
      const staleThreshold = this.options.heartbeatTimeout! * 2;

      // Clean up stale connections
      for (const [connectionId, info] of this.connections.entries()) {
        if (now - info.lastActivity > staleThreshold) {
          console.log(`Cleaning up stale connection: ${connectionId}`);
          this.disconnectConnection(connectionId, 'stale_connection');
        }
      }

      // Clean up old queued messages
      for (const [roomName, messages] of this.messageQueue.entries()) {
        const validMessages = messages.filter(msg => 
          now - msg.timestamp < 3600000 // Keep messages for 1 hour
        );
        
        if (validMessages.length !== messages.length) {
          this.messageQueue.set(roomName, validMessages);
        }
      }

      this.stats.roomsActive = this.messageQueue.size;
    };

    setInterval(cleanup, this.options.cleanupInterval!);

    // Log stats periodically
    setInterval(() => {
      console.log('RealtimeSync Stats:', this.getStats());
    }, 60000); // Every minute
  }

  private integrateMockWebhookManager(): void {
    // Integration with WebhookManager for webhook events
    const originalSendEvent = webhookManager.sendEvent.bind(webhookManager);
    
    webhookManager.sendEvent = async (eventType: string, payload: Record<string, any>) => {
      // Send to webhooks
      await originalSendEvent(eventType, payload);
      
      // Also broadcast to WebSocket clients
      await this.broadcastEvent({
        type: eventType,
        data: payload,
        timestamp: Date.now(),
        source: 'webhook_manager',
      });
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down RealtimeSync...');
    
    // Notify all clients of shutdown
    this.io.emit('server_shutdown', { 
      message: 'Server is shutting down', 
      timestamp: Date.now() 
    });

    // Close all connections
    this.io.close();
    
    console.log('RealtimeSync shutdown complete');
  }
}

// Export for use in API routes and server setup
export default RealtimeSync;