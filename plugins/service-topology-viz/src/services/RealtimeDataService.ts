/**
 * Realtime Data Service
 * WebSocket-based service for real-time topology updates
 */

import { io, Socket } from 'socket.io-client';
import { 
  ServiceNode, 
  ServiceRelationship, 
  TopologyEvent,
  TopologyEventType,
  HealthStatus,
  ServiceMetrics
} from '../types';

interface RealtimeConfig {
  reconnection: boolean;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  timeout: number;
  autoConnect: boolean;
  transports: string[];
}

interface EventHandlers {
  nodeUpdate: Array<(update: NodeUpdate) => void>;
  edgeUpdate: Array<(update: EdgeUpdate) => void>;
  healthChange: Array<(change: HealthChange) => void>;
  metricUpdate: Array<(update: MetricUpdate) => void>;
  incident: Array<(incident: IncidentEvent) => void>;
  deployment: Array<(deployment: DeploymentEvent) => void>;
  error: Array<(error: ErrorEvent) => void>;
  connect: Array<() => void>;
  disconnect: Array<() => void>;
}

interface NodeUpdate {
  type: 'add' | 'update' | 'remove';
  node?: ServiceNode;
  nodeId?: string;
  timestamp: Date;
}

interface EdgeUpdate {
  type: 'add' | 'update' | 'remove';
  edge?: ServiceRelationship;
  edgeId?: string;
  timestamp: Date;
}

interface HealthChange {
  nodeId: string;
  nodeName: string;
  previousHealth: HealthStatus;
  health: HealthStatus;
  timestamp: Date;
}

interface MetricUpdate {
  nodeId: string;
  metrics: Partial<ServiceMetrics>;
  timestamp: Date;
}

interface IncidentEvent {
  nodeId: string;
  incident: any;
  timestamp: Date;
}

interface DeploymentEvent {
  nodeId: string;
  status: 'started' | 'completed' | 'failed';
  version: string;
  timestamp: Date;
}

interface ErrorEvent {
  message: string;
  code?: string;
  timestamp: Date;
}

export class RealtimeDataService {
  private socket: Socket | null = null;
  private endpoint: string;
  private config: RealtimeConfig;
  private eventHandlers: EventHandlers;
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: TopologyEvent[] = [];
  private maxQueueSize: number = 1000;
  private metrics: {
    messagesReceived: number;
    messagesSent: number;
    bytesReceived: number;
    bytesSent: number;
    latency: number[];
    connectionTime?: Date;
    disconnectionTime?: Date;
  };

  constructor(
    endpoint: string,
    config: Partial<RealtimeConfig> = {}
  ) {
    this.endpoint = endpoint;
    this.config = {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 5000,
      timeout: 20000,
      autoConnect: false,
      transports: ['websocket', 'polling'],
      ...config
    };

    this.eventHandlers = {
      nodeUpdate: [],
      edgeUpdate: [],
      healthChange: [],
      metricUpdate: [],
      incident: [],
      deployment: [],
      error: [],
      connect: [],
      disconnect: []
    };

    this.metrics = {
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      latency: []
    };
  }

  /**
   * Connect to the WebSocket server
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create socket connection
        this.socket = io(this.endpoint, {
          reconnection: this.config.reconnection,
          reconnectionAttempts: this.config.reconnectionAttempts,
          reconnectionDelay: this.config.reconnectionDelay,
          timeout: this.config.timeout,
          autoConnect: this.config.autoConnect,
          transports: this.config.transports
        });

        // Setup event listeners
        this.setupSocketListeners();

        // Connect
        this.socket.connect();

        // Set timeout for connection
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, this.config.timeout);

        // Wait for connection
        this.socket.once('connect', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.metrics.connectionTime = new Date();
          this.startHeartbeat();
          this.processQueuedMessages();
          this.emit('connect');
          resolve();
        });

        this.socket.once('connect_error', (error) => {
          clearTimeout(timeout);
          this.handleError({
            message: `Connection error: ${error.message}`,
            code: 'CONNECTION_ERROR',
            timestamp: new Date()
          });
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    if (this.socket) {
      this.isConnected = false;
      this.metrics.disconnectionTime = new Date();
      this.stopHeartbeat();
      this.socket.disconnect();
      this.socket = null;
      this.emit('disconnect');
    }
  }

  /**
   * Setup socket event listeners
   */
  private setupSocketListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.metrics.connectionTime = new Date();
      this.startHeartbeat();
      this.processQueuedMessages();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      this.metrics.disconnectionTime = new Date();
      this.stopHeartbeat();
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, attempt reconnect
        this.attemptReconnect();
      }
    });

    this.socket.on('error', (error) => {
      this.handleError({
        message: `Socket error: ${error}`,
        timestamp: new Date()
      });
    });

    // Topology events
    this.socket.on('topology:nodeAdded', (data) => {
      this.handleTopologyEvent({
        type: TopologyEventType.NODE_ADDED,
        timestamp: new Date(data.timestamp),
        data: data.node
      });
    });

    this.socket.on('topology:nodeUpdated', (data) => {
      this.handleTopologyEvent({
        type: TopologyEventType.NODE_UPDATED,
        timestamp: new Date(data.timestamp),
        data: data.node
      });
    });

    this.socket.on('topology:nodeRemoved', (data) => {
      this.handleTopologyEvent({
        type: TopologyEventType.NODE_REMOVED,
        timestamp: new Date(data.timestamp),
        data: data.nodeId
      });
    });

    this.socket.on('topology:edgeAdded', (data) => {
      this.handleTopologyEvent({
        type: TopologyEventType.EDGE_ADDED,
        timestamp: new Date(data.timestamp),
        data: data.edge
      });
    });

    this.socket.on('topology:edgeUpdated', (data) => {
      this.handleTopologyEvent({
        type: TopologyEventType.EDGE_UPDATED,
        timestamp: new Date(data.timestamp),
        data: data.edge
      });
    });

    this.socket.on('topology:edgeRemoved', (data) => {
      this.handleTopologyEvent({
        type: TopologyEventType.EDGE_REMOVED,
        timestamp: new Date(data.timestamp),
        data: data.edgeId
      });
    });

    // Health events
    this.socket.on('health:changed', (data) => {
      this.handleTopologyEvent({
        type: TopologyEventType.HEALTH_CHANGED,
        timestamp: new Date(data.timestamp),
        data: data
      });
    });

    // Metric events
    this.socket.on('metrics:updated', (data) => {
      this.handleTopologyEvent({
        type: TopologyEventType.METRIC_UPDATED,
        timestamp: new Date(data.timestamp),
        data: data
      });
    });

    // Incident events
    this.socket.on('incident:created', (data) => {
      this.handleTopologyEvent({
        type: TopologyEventType.INCIDENT_CREATED,
        timestamp: new Date(data.timestamp),
        data: data
      });
    });

    this.socket.on('incident:resolved', (data) => {
      this.handleTopologyEvent({
        type: TopologyEventType.INCIDENT_RESOLVED,
        timestamp: new Date(data.timestamp),
        data: data
      });
    });

    // Deployment events
    this.socket.on('deployment:started', (data) => {
      this.handleTopologyEvent({
        type: TopologyEventType.DEPLOYMENT_STARTED,
        timestamp: new Date(data.timestamp),
        data: data
      });
    });

    this.socket.on('deployment:completed', (data) => {
      this.handleTopologyEvent({
        type: TopologyEventType.DEPLOYMENT_COMPLETED,
        timestamp: new Date(data.timestamp),
        data: data
      });
    });

    // Bulk updates
    this.socket.on('topology:bulkUpdate', (data) => {
      this.handleBulkUpdate(data);
    });

    // Heartbeat
    this.socket.on('pong', () => {
      const latency = Date.now() - this.lastPingTime;
      this.metrics.latency.push(latency);
      
      // Keep only last 100 latency measurements
      if (this.metrics.latency.length > 100) {
        this.metrics.latency.shift();
      }
    });
  }

  /**
   * Handle topology events
   */
  private handleTopologyEvent(event: TopologyEvent): void {
    this.metrics.messagesReceived++;
    this.metrics.bytesReceived += JSON.stringify(event).length;

    if (!this.isConnected) {
      // Queue events when disconnected
      this.queueMessage(event);
      return;
    }

    switch (event.type) {
      case TopologyEventType.NODE_ADDED:
        this.emit('nodeUpdate', {
          type: 'add',
          node: event.data as ServiceNode,
          timestamp: event.timestamp
        });
        break;

      case TopologyEventType.NODE_UPDATED:
        this.emit('nodeUpdate', {
          type: 'update',
          node: event.data as ServiceNode,
          timestamp: event.timestamp
        });
        break;

      case TopologyEventType.NODE_REMOVED:
        this.emit('nodeUpdate', {
          type: 'remove',
          nodeId: event.data as string,
          timestamp: event.timestamp
        });
        break;

      case TopologyEventType.EDGE_ADDED:
        this.emit('edgeUpdate', {
          type: 'add',
          edge: event.data as ServiceRelationship,
          timestamp: event.timestamp
        });
        break;

      case TopologyEventType.EDGE_UPDATED:
        this.emit('edgeUpdate', {
          type: 'update',
          edge: event.data as ServiceRelationship,
          timestamp: event.timestamp
        });
        break;

      case TopologyEventType.EDGE_REMOVED:
        this.emit('edgeUpdate', {
          type: 'remove',
          edgeId: event.data as string,
          timestamp: event.timestamp
        });
        break;

      case TopologyEventType.HEALTH_CHANGED:
        this.emit('healthChange', event.data as HealthChange);
        break;

      case TopologyEventType.METRIC_UPDATED:
        this.emit('metricUpdate', event.data as MetricUpdate);
        break;

      case TopologyEventType.INCIDENT_CREATED:
      case TopologyEventType.INCIDENT_RESOLVED:
        this.emit('incident', event.data as IncidentEvent);
        break;

      case TopologyEventType.DEPLOYMENT_STARTED:
      case TopologyEventType.DEPLOYMENT_COMPLETED:
        this.emit('deployment', event.data as DeploymentEvent);
        break;
    }
  }

  /**
   * Handle bulk updates
   */
  private handleBulkUpdate(data: any): void {
    if (data.nodes) {
      data.nodes.forEach((node: ServiceNode) => {
        this.emit('nodeUpdate', {
          type: 'update',
          node,
          timestamp: new Date()
        });
      });
    }

    if (data.edges) {
      data.edges.forEach((edge: ServiceRelationship) => {
        this.emit('edgeUpdate', {
          type: 'update',
          edge,
          timestamp: new Date()
        });
      });
    }
  }

  /**
   * Queue messages when disconnected
   */
  private queueMessage(event: TopologyEvent): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      // Remove oldest message if queue is full
      this.messageQueue.shift();
    }
    this.messageQueue.push(event);
  }

  /**
   * Process queued messages after reconnection
   */
  private processQueuedMessages(): void {
    while (this.messageQueue.length > 0) {
      const event = this.messageQueue.shift();
      if (event) {
        this.handleTopologyEvent(event);
      }
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
        this.attemptReconnect();
      });
    }, this.config.reconnectionDelay);
  }

  /**
   * Start heartbeat
   */
  private lastPingTime: number = 0;
  
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.socket && this.isConnected) {
        this.lastPingTime = Date.now();
        this.socket.emit('ping');
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Send a message to the server
   */
  public send(event: string, data: any): void {
    if (!this.socket || !this.isConnected) {
      console.warn('Cannot send message: not connected');
      return;
    }

    this.socket.emit(event, data);
    this.metrics.messagesSent++;
    this.metrics.bytesSent += JSON.stringify(data).length;
  }

  /**
   * Subscribe to a specific room or topic
   */
  public subscribe(topic: string): void {
    this.send('subscribe', { topic });
  }

  /**
   * Unsubscribe from a topic
   */
  public unsubscribe(topic: string): void {
    this.send('unsubscribe', { topic });
  }

  /**
   * Request full topology snapshot
   */
  public requestSnapshot(): void {
    this.send('topology:requestSnapshot', {});
  }

  /**
   * Request historical data
   */
  public requestHistoricalData(start: Date, end: Date): void {
    this.send('topology:requestHistorical', {
      start: start.toISOString(),
      end: end.toISOString()
    });
  }

  /**
   * Add event listener
   */
  public on<K extends keyof EventHandlers>(
    event: K,
    handler: EventHandlers[K][number]
  ): void {
    (this.eventHandlers[event] as any[]).push(handler);
  }

  /**
   * Remove event listener
   */
  public off<K extends keyof EventHandlers>(
    event: K,
    handler: EventHandlers[K][number]
  ): void {
    const handlers = this.eventHandlers[event] as any[];
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Emit event to handlers
   */
  private emit<K extends keyof EventHandlers>(
    event: K,
    ...args: Parameters<EventHandlers[K][number]>
  ): void {
    const handlers = this.eventHandlers[event] as any[];
    handlers.forEach(handler => {
      try {
        handler(...args);
      } catch (error) {
        console.error(`Error in ${event} handler:`, error);
      }
    });
  }

  /**
   * Handle errors
   */
  private handleError(error: ErrorEvent): void {
    console.error('RealtimeDataService error:', error);
    this.emit('error', error);
  }

  /**
   * Get connection status
   */
  public getStatus(): {
    connected: boolean;
    metrics: typeof this.metrics;
    queueSize: number;
  } {
    return {
      connected: this.isConnected,
      metrics: { ...this.metrics },
      queueSize: this.messageQueue.length
    };
  }

  /**
   * Get average latency
   */
  public getAverageLatency(): number {
    if (this.metrics.latency.length === 0) return 0;
    
    const sum = this.metrics.latency.reduce((a, b) => a + b, 0);
    return sum / this.metrics.latency.length;
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      messagesReceived: 0,
      messagesSent: 0,
      bytesReceived: 0,
      bytesSent: 0,
      latency: [],
      connectionTime: this.metrics.connectionTime,
      disconnectionTime: this.metrics.disconnectionTime
    };
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    this.disconnect();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.eventHandlers = {
      nodeUpdate: [],
      edgeUpdate: [],
      healthChange: [],
      metricUpdate: [],
      incident: [],
      deployment: [],
      error: [],
      connect: [],
      disconnect: []
    };
    
    this.messageQueue = [];
  }
}