import { EventEmitter } from 'events';
import { io, Socket } from 'socket.io-client';

export interface WebSocketMessage {
  id: string;
  type: string;
  data: any;
  timestamp: string;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface BroadcastOptions {
  tenantId?: string;
  userId?: string;
  room?: string;
  metadata?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

export interface ClientInfo {
  id: string;
  tenantId?: string;
  userId?: string;
  rooms: Set<string>;
  lastSeen: Date;
  metadata?: Record<string, any>;
}

export class EnhancedWebSocketService extends EventEmitter {
  private static instance: EnhancedWebSocketService;
  private socket: Socket | null = null;
  private clientId: string;
  private tenantId?: string;
  private userId?: string;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 1000;
  private subscriptions: Map<string, Set<string>> = new Map(); // topic -> rooms
  private messageBuffer: WebSocketMessage[] = [];
  private maxBufferSize: number = 500;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionUrl: string;
  private authToken?: string;

  private constructor() {
    super();
    this.clientId = this.generateClientId();
    this.connectionUrl = this.getWebSocketUrl();
  }

  public static getInstance(): EnhancedWebSocketService {
    if (!EnhancedWebSocketService.instance) {
      EnhancedWebSocketService.instance = new EnhancedWebSocketService();
    }
    return EnhancedWebSocketService.instance;
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getWebSocketUrl(): string {
    if (typeof window === 'undefined') return '';
    
    // Use environment variable or default
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    if (wsUrl) return wsUrl;

    // Fallback to current host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}`;
  }

  public async connect(options: {
    tenantId?: string;
    userId?: string;
    authToken?: string;
    metadata?: Record<string, any>;
  } = {}): Promise<void> {
    if (this.isConnected && this.socket?.connected) {
      return;
    }

    this.tenantId = options.tenantId;
    this.userId = options.userId;
    this.authToken = options.authToken;

    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.connectionUrl, {
          autoConnect: false,
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: this.reconnectDelay,
          auth: {
            clientId: this.clientId,
            tenantId: this.tenantId,
            userId: this.userId,
            token: this.authToken,
            metadata: options.metadata
          },
          transports: ['websocket', 'polling']
        });

        this.setupEventHandlers(resolve, reject);
        this.socket.connect();

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        reject(error);
      }
    });
  }

  private setupEventHandlers(resolve: () => void, reject: (error: any) => void) {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Enhanced WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit('connected');
      resolve();

      // Resubscribe to all active subscriptions
      this.resubscribeAll();

      // Send buffered messages
      this.flushMessageBuffer();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Enhanced WebSocket disconnected:', reason);
      this.isConnected = false;
      this.stopHeartbeat();
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Enhanced WebSocket connection error:', error);
      this.emit('error', error);
      if (this.reconnectAttempts === 0) {
        reject(error);
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`Enhanced WebSocket reconnected after ${attemptNumber} attempts`);
      this.emit('reconnected', attemptNumber);
    });

    this.socket.on('message', this.handleMessage.bind(this));

    // Plugin-specific events
    this.socket.on('plugin.update', this.handlePluginUpdate.bind(this));
    this.socket.on('plugin.install', this.handlePluginInstall.bind(this));
    this.socket.on('plugin.quality', this.handlePluginQuality.bind(this));
    this.socket.on('plugin.security', this.handlePluginSecurity.bind(this));

    // System events
    this.socket.on('catalog.refresh', this.handleCatalogRefresh.bind(this));
    this.socket.on('notification', this.handleNotification.bind(this));
    this.socket.on('health.update', this.handleHealthUpdate.bind(this));
  }

  private handleMessage(message: WebSocketMessage) {
    try {
      // Add to buffer for replay capability
      this.addToBuffer(message);

      // Emit to local handlers
      this.emit('message', message);
      this.emit(message.type, message);

      // Call specific handlers based on message type
      switch (message.type) {
        case 'plugin.repository.updated':
          this.handlePluginRepositoryUpdate(message);
          break;
        case 'plugin.quality.evaluation_started':
          this.handleQualityEvaluationStarted(message);
          break;
        case 'plugin.security.scan_triggered':
          this.handleSecurityScanTriggered(message);
          break;
        case 'catalog.refresh_triggered':
          this.handleCatalogRefreshTriggered(message);
          break;
        default:
          // Generic message handling
          this.emit('generic_message', message);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  private handlePluginUpdate(data: any) {
    this.emit('plugin.update', data);
    console.log('Plugin updated:', data);
  }

  private handlePluginInstall(data: any) {
    this.emit('plugin.install', data);
    console.log('Plugin installation update:', data);
  }

  private handlePluginQuality(data: any) {
    this.emit('plugin.quality', data);
    console.log('Plugin quality update:', data);
  }

  private handlePluginSecurity(data: any) {
    this.emit('plugin.security', data);
    console.log('Plugin security update:', data);
  }

  private handleCatalogRefresh(data: any) {
    this.emit('catalog.refresh', data);
    console.log('Catalog refresh triggered:', data);
  }

  private handleNotification(data: any) {
    this.emit('notification', data);
    console.log('Notification received:', data);
  }

  private handleHealthUpdate(data: any) {
    this.emit('health.update', data);
    console.log('Health update:', data);
  }

  // Enhanced plugin-specific handlers
  private handlePluginRepositoryUpdate(message: WebSocketMessage) {
    const data = message.data;
    this.emit('plugin.repository.updated', {
      repository: data.repository,
      branch: data.branch,
      commits: data.commits,
      isMainBranch: data.isMainBranch,
      catalogFilesChanged: data.catalogFilesChanged,
      hasPackageChanges: data.hasPackageChanges,
      timestamp: message.timestamp
    });
  }

  private handleQualityEvaluationStarted(message: WebSocketMessage) {
    const data = message.data;
    this.emit('quality.evaluation.started', {
      repository: data.repository,
      commitId: data.commitId,
      reason: data.reason,
      timestamp: message.timestamp
    });
  }

  private handleSecurityScanTriggered(message: WebSocketMessage) {
    const data = message.data;
    this.emit('security.scan.triggered', {
      repository: data.repository,
      reason: data.reason,
      commitId: data.commitId,
      files: data.files,
      timestamp: message.timestamp
    });
  }

  private handleCatalogRefreshTriggered(message: WebSocketMessage) {
    const data = message.data;
    this.emit('catalog.refresh.triggered', {
      repository: data.repository,
      branch: data.branch,
      reason: data.reason,
      affectedFiles: data.affectedFiles,
      timestamp: message.timestamp
    });
  }

  public disconnect(): void {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.subscriptions.clear();
  }

  public broadcast(type: string, data: any, options: BroadcastOptions = {}): void {
    const message: WebSocketMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: new Date().toISOString(),
      tenantId: options.tenantId || this.tenantId,
      userId: options.userId || this.userId,
      metadata: {
        ...options.metadata,
        priority: options.priority || 'normal',
        clientId: this.clientId
      }
    };

    if (this.isConnected && this.socket) {
      if (options.room) {
        this.socket.to(options.room).emit('message', message);
      } else {
        this.socket.emit('broadcast', message);
      }
    } else {
      // Buffer message if not connected
      this.addToBuffer(message);
    }
  }

  public subscribe(topic: string, room?: string): void {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
    }
    
    const rooms = this.subscriptions.get(topic)!;
    if (room) {
      rooms.add(room);
    }

    if (this.isConnected && this.socket) {
      this.socket.emit('subscribe', { topic, room });
    }
  }

  public unsubscribe(topic: string, room?: string): void {
    if (room) {
      const rooms = this.subscriptions.get(topic);
      if (rooms) {
        rooms.delete(room);
        if (rooms.size === 0) {
          this.subscriptions.delete(topic);
        }
      }
    } else {
      this.subscriptions.delete(topic);
    }

    if (this.isConnected && this.socket) {
      this.socket.emit('unsubscribe', { topic, room });
    }
  }

  public joinRoom(room: string): void {
    if (this.isConnected && this.socket) {
      this.socket.emit('join_room', room);
    }
  }

  public leaveRoom(room: string): void {
    if (this.isConnected && this.socket) {
      this.socket.emit('leave_room', room);
    }
  }

  // Plugin-specific subscription methods
  public subscribeToPluginUpdates(pluginId?: string): () => void {
    const topic = pluginId ? `plugin.${pluginId}.*` : 'plugin.*';
    this.subscribe(topic);
    return () => this.unsubscribe(topic);
  }

  public subscribeToQualityUpdates(repositoryId?: string): () => void {
    const topic = repositoryId ? `quality.${repositoryId}.*` : 'quality.*';
    this.subscribe(topic);
    return () => this.unsubscribe(topic);
  }

  public subscribeToSecurityUpdates(severity?: 'low' | 'medium' | 'high' | 'critical'): () => void {
    const topic = severity ? `security.${severity}.*` : 'security.*';
    this.subscribe(topic);
    return () => this.unsubscribe(topic);
  }

  public subscribeToCatalogUpdates(): () => void {
    this.subscribe('catalog.*');
    return () => this.unsubscribe('catalog.*');
  }

  public subscribeToNotifications(userId?: string): () => void {
    const topic = userId ? `notification.user.${userId}` : 'notification.*';
    this.subscribe(topic);
    return () => this.unsubscribe(topic);
  }

  // Real-time plugin installation progress
  public subscribeToInstallationProgress(taskId: string): () => void {
    const topic = `installation.${taskId}`;
    this.subscribe(topic);
    return () => this.unsubscribe(topic);
  }

  // Enhanced methods for plugin portal features
  public triggerPluginRefresh(pluginId: string): void {
    this.broadcast('plugin.refresh', { pluginId }, { priority: 'high' });
  }

  public triggerQualityEvaluation(repositoryId: string, commitId?: string): void {
    this.broadcast('quality.evaluate', { repositoryId, commitId }, { priority: 'high' });
  }

  public triggerSecurityScan(repositoryId: string, type: string = 'full'): void {
    this.broadcast('security.scan', { repositoryId, type }, { priority: 'high' });
  }

  public reportHealthStatus(componentId: string, status: any): void {
    this.broadcast('health.report', { componentId, status }, { priority: 'normal' });
  }

  // Utility methods
  public isHealthy(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  public getConnectionStatus(): {
    connected: boolean;
    clientId: string;
    tenantId?: string;
    userId?: string;
    subscriptions: number;
    bufferedMessages: number;
  } {
    return {
      connected: this.isConnected,
      clientId: this.clientId,
      tenantId: this.tenantId,
      userId: this.userId,
      subscriptions: this.subscriptions.size,
      bufferedMessages: this.messageBuffer.length
    };
  }

  public getMessageHistory(limit: number = 50): WebSocketMessage[] {
    return this.messageBuffer.slice(-limit);
  }

  private addToBuffer(message: WebSocketMessage): void {
    this.messageBuffer.push(message);
    if (this.messageBuffer.length > this.maxBufferSize) {
      this.messageBuffer.shift(); // Remove oldest message
    }
  }

  private flushMessageBuffer(): void {
    if (!this.isConnected || !this.socket) return;

    const pendingMessages = this.messageBuffer.filter(msg => 
      msg.metadata?.clientId === this.clientId && !msg.metadata?.sent
    );

    pendingMessages.forEach(message => {
      if (this.socket) {
        this.socket.emit('buffered_message', message);
        if (message.metadata) {
          message.metadata.sent = true;
        }
      }
    });
  }

  private resubscribeAll(): void {
    for (const [topic, rooms] of this.subscriptions.entries()) {
      if (rooms.size === 0) {
        this.subscribe(topic);
      } else {
        for (const room of rooms) {
          this.subscribe(topic, room);
        }
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.socket) {
        this.socket.emit('ping', {
          clientId: this.clientId,
          timestamp: new Date().toISOString()
        });
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Cleanup method
  public async destroy(): Promise<void> {
    this.disconnect();
    this.removeAllListeners();
    this.messageBuffer.length = 0;
    this.subscriptions.clear();
  }
}

// Export singleton instance
export const enhancedWebSocketService = EnhancedWebSocketService.getInstance();