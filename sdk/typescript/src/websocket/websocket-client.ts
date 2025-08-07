import { EventEmitter } from 'eventemitter3';
import WebSocket from 'ws';

import { AuthManager } from '../auth/auth-manager';
import { 
  WebSocketMessage, 
  WebSocketEventMessage, 
  WebSocketCommandMessage,
  EventType,
  AnyEvent,
  EventHandler,
  EventSubscription
} from '../types';

export interface WebSocketClientConfig {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
}

export interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  attempts: number;
  lastError?: string;
}

export class BackstageWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: WebSocketClientConfig;
  private authManager: AuthManager;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectionTimer: NodeJS.Timeout | null = null;
  private subscriptions: Map<string, EventSubscription> = new Map();
  private messageQueue: WebSocketMessage[] = [];
  private status: ConnectionStatus = {
    connected: false,
    reconnecting: false,
    attempts: 0,
  };

  constructor(config: WebSocketClientConfig, authManager: AuthManager) {
    super();
    this.config = {
      reconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      connectionTimeout: 10000,
      ...config,
    };
    this.authManager = authManager;
  }

  /**
   * Connect to WebSocket server
   */
  public async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      try {
        const authHeader = this.authManager.getAuthHeader();
        const headers: Record<string, string> = {
          'User-Agent': '@backstage-idp/sdk-typescript/1.0.0',
        };

        if (authHeader) {
          if (authHeader.startsWith('Bearer')) {
            headers['Authorization'] = authHeader;
          } else {
            headers['X-API-Key'] = authHeader;
          }
        }

        this.ws = new WebSocket(this.config.url, {
          headers,
        });

        // Connection timeout
        this.connectionTimer = setTimeout(() => {
          if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
            this.ws.terminate();
            reject(new Error('Connection timeout'));
          }
        }, this.config.connectionTimeout);

        this.ws.onopen = () => {
          this.clearConnectionTimer();
          this.status = {
            connected: true,
            reconnecting: false,
            attempts: 0,
          };
          this.reconnectAttempts = 0;
          
          this.emit('connected');
          this.setupHeartbeat();
          this.processMessageQueue();
          resolve();
        };

        this.ws.onclose = (event) => {
          this.clearConnectionTimer();
          this.clearHeartbeat();
          this.status.connected = false;
          
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          if (this.config.reconnect && this.reconnectAttempts < this.config.maxReconnectAttempts!) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          this.clearConnectionTimer();
          const errorMsg = `WebSocket error: ${error.message || 'Unknown error'}`;
          this.status.lastError = errorMsg;
          this.emit('error', new Error(errorMsg));
          
          if (this.ws?.readyState === WebSocket.CONNECTING) {
            reject(new Error(errorMsg));
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data.toString());
        };

      } catch (error) {
        this.clearConnectionTimer();
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.clearReconnectTimer();
    this.clearHeartbeat();
    this.clearConnectionTimer();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.status = {
      connected: false,
      reconnecting: false,
      attempts: 0,
    };
    
    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }

  /**
   * Send message to server
   */
  public send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later sending
      this.messageQueue.push(message);
      
      // Try to connect if not connected
      if (!this.status.connected && !this.status.reconnecting) {
        this.connect().catch(error => {
          this.emit('error', error);
        });
      }
    }
  }

  /**
   * Subscribe to events
   */
  public subscribe<T extends AnyEvent = AnyEvent>(
    eventType: EventType | EventType[],
    handler: EventHandler<T>,
    options?: { once?: boolean; priority?: number }
  ): string {
    const subscription: EventSubscription = {
      id: this.generateSubscriptionId(),
      eventType,
      handler: handler as EventHandler,
      options,
    };

    this.subscriptions.set(subscription.id, subscription);

    // Send subscription message to server
    this.send({
      type: 'command',
      payload: {
        command: 'subscribe',
        data: {
          eventTypes: Array.isArray(eventType) ? eventType : [eventType],
          subscriptionId: subscription.id,
        },
      },
      timestamp: new Date().toISOString(),
    });

    return subscription.id;
  }

  /**
   * Unsubscribe from events
   */
  public unsubscribe(subscriptionId: string): void {
    if (this.subscriptions.has(subscriptionId)) {
      this.subscriptions.delete(subscriptionId);

      // Send unsubscribe message to server
      this.send({
        type: 'command',
        payload: {
          command: 'unsubscribe',
          data: {
            subscriptionId,
          },
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Send command to server
   */
  public sendCommand(command: string, data?: any): void {
    const message: WebSocketCommandMessage = {
      type: 'command',
      payload: {
        command,
        data,
      },
      id: this.generateMessageId(),
      timestamp: new Date().toISOString(),
    };

    this.send(message);
  }

  /**
   * Get connection status
   */
  public getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  /**
   * Get active subscriptions count
   */
  public getSubscriptionsCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);

      switch (message.type) {
        case 'event':
          this.handleEventMessage(message as WebSocketEventMessage);
          break;
        
        case 'response':
          this.emit('response', message.payload);
          break;
        
        case 'error':
          this.emit('error', new Error(message.payload.message));
          break;

        default:
          this.emit('message', message);
      }

    } catch (error) {
      this.emit('error', new Error('Failed to parse WebSocket message'));
    }
  }

  /**
   * Handle event messages
   */
  private handleEventMessage(message: WebSocketEventMessage): void {
    const event = message.payload as AnyEvent;

    // Find matching subscriptions
    for (const [id, subscription] of this.subscriptions) {
      const eventTypes = Array.isArray(subscription.eventType) 
        ? subscription.eventType 
        : [subscription.eventType];

      if (eventTypes.includes(event.type)) {
        try {
          subscription.handler(event);
          
          // Remove one-time subscriptions
          if (subscription.options?.once) {
            this.unsubscribe(id);
          }
        } catch (error) {
          this.emit('handlerError', { subscriptionId: id, error });
        }
      }
    }

    // Emit event for general listeners
    this.emit('event', event);
    this.emit(event.type, event);
  }

  /**
   * Setup heartbeat
   */
  private setupHeartbeat(): void {
    this.clearHeartbeat();

    if (this.config.heartbeatInterval) {
      this.heartbeatTimer = setInterval(() => {
        this.sendCommand('ping');
      }, this.config.heartbeatInterval);
    }
  }

  /**
   * Clear heartbeat timer
   */
  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (!this.config.reconnect) return;

    this.status.reconnecting = true;
    this.status.attempts = this.reconnectAttempts + 1;
    this.emit('reconnecting', { attempt: this.reconnectAttempts + 1 });

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      
      try {
        await this.connect();
      } catch (error) {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
          this.status.reconnecting = false;
          this.emit('reconnectFailed', { attempts: this.reconnectAttempts });
        }
      }
    }, this.config.reconnectInterval);
  }

  /**
   * Clear reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Clear connection timer
   */
  private clearConnectionTimer(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift()!;
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Dispose of the client
   */
  public dispose(): void {
    this.disconnect();
    this.subscriptions.clear();
    this.messageQueue.length = 0;
    this.removeAllListeners();
  }
}