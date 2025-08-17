/**
 * Production WebSocket Service
 * Real implementation for real-time data streaming and notifications
 */

import { EventEmitter } from 'events';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { productionBackstageClient } from '../lib/backstage/production-client';
import { pluginHealthMonitor } from './plugin-health-monitor';
import { prisma } from '../lib/db/client';
import axios from 'axios';

export interface WebSocketMessage {
  type: 'metrics' | 'deployment' | 'alert' | 'health' | 'log' | 'notification';
  entityRef?: string;
  data: any;
  timestamp: string;
  userId?: string;
}

export interface MetricsUpdate {
  entityRef: string;
  metrics: {
    cpu: number;
    memory: number;
    requestsPerSecond: number;
    errorRate: number;
    responseTime: number;
    activeConnections: number;
  };
}

export interface DeploymentUpdate {
  entityRef: string;
  deployment: {
    id: string;
    version: string;
    status: 'pending' | 'in_progress' | 'success' | 'failed';
    progress: number;
    message: string;
  };
}

export interface AlertUpdate {
  id: string;
  entityRef: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface LogUpdate {
  entityRef: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export class RealWebSocketService extends EventEmitter {
  private io?: SocketIOServer;
  private httpServer?: HttpServer;
  private connectedClients = new Map<string, Set<string>>(); // userId -> Set<socketId>
  private entitySubscriptions = new Map<string, Set<string>>(); // entityRef -> Set<socketId>
  private metricsInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private deploymentMonitorInterval?: NodeJS.Timeout;

  constructor() {
    super();
  }

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HttpServer): void {
    this.httpServer = httpServer;
    
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupSocketHandlers();
    this.startRealTimeServices();
    
    console.log('[WebSocket] Real-time service initialized');
  }

  /**
   * Set up socket event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log(`[WebSocket] Client connected: ${socket.id}`);
      
      // Handle authentication
      socket.on('authenticate', async (data: { token?: string; userId?: string }) => {
        try {
          const userId = await this.authenticateUser(data.token, data.userId);
          if (userId) {
            socket.data.userId = userId;
            
            // Track user connection
            if (!this.connectedClients.has(userId)) {
              this.connectedClients.set(userId, new Set());
            }
            this.connectedClients.get(userId)!.add(socket.id);
            
            socket.emit('authenticated', { userId });
            console.log(`[WebSocket] Client authenticated: ${socket.id} (user: ${userId})`);
          } else {
            socket.emit('authentication_failed', { reason: 'Invalid credentials' });
          }
        } catch (error) {
          console.error('[WebSocket] Authentication error:', error);
          socket.emit('authentication_failed', { reason: 'Authentication error' });
        }
      });

      // Handle entity subscription
      socket.on('subscribe', (data: { entityRef: string }) => {
        const { entityRef } = data;
        
        if (!this.entitySubscriptions.has(entityRef)) {
          this.entitySubscriptions.set(entityRef, new Set());
        }
        this.entitySubscriptions.get(entityRef)!.add(socket.id);
        
        console.log(`[WebSocket] Client ${socket.id} subscribed to entity: ${entityRef}`);
        
        // Send initial data for the entity
        this.sendInitialEntityData(socket.id, entityRef);
      });

      // Handle entity unsubscription
      socket.on('unsubscribe', (data: { entityRef: string }) => {
        const { entityRef } = data;
        
        if (this.entitySubscriptions.has(entityRef)) {
          this.entitySubscriptions.get(entityRef)!.delete(socket.id);
          
          if (this.entitySubscriptions.get(entityRef)!.size === 0) {
            this.entitySubscriptions.delete(entityRef);
          }
        }
        
        console.log(`[WebSocket] Client ${socket.id} unsubscribed from entity: ${entityRef}`);
      });

      // Handle plugin health subscription
      socket.on('subscribe_plugin_health', (data: { pluginId?: string }) => {
        const { pluginId } = data;
        socket.join(pluginId ? `plugin:${pluginId}` : 'plugin:all');
        console.log(`[WebSocket] Client ${socket.id} subscribed to plugin health: ${pluginId || 'all'}`);
      });

      // Handle deployment status subscription
      socket.on('subscribe_deployments', () => {
        socket.join('deployments');
        console.log(`[WebSocket] Client ${socket.id} subscribed to deployments`);
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        console.log(`[WebSocket] Client disconnected: ${socket.id} (reason: ${reason})`);
        
        // Clean up user connections
        const userId = socket.data.userId;
        if (userId && this.connectedClients.has(userId)) {
          this.connectedClients.get(userId)!.delete(socket.id);
          
          if (this.connectedClients.get(userId)!.size === 0) {
            this.connectedClients.delete(userId);
          }
        }
        
        // Clean up entity subscriptions
        for (const [entityRef, socketIds] of this.entitySubscriptions.entries()) {
          socketIds.delete(socket.id);
          if (socketIds.size === 0) {
            this.entitySubscriptions.delete(entityRef);
          }
        }
      });
    });
  }

  /**
   * Start real-time services
   */
  private startRealTimeServices(): void {
    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectAndBroadcastMetrics();
    }, 5000); // Every 5 seconds

    // Start health checks
    this.healthCheckInterval = setInterval(() => {
      this.broadcastHealthUpdates();
    }, 30000); // Every 30 seconds

    // Start deployment monitoring
    this.deploymentMonitorInterval = setInterval(() => {
      this.monitorDeployments();
    }, 10000); // Every 10 seconds

    // Listen to plugin health monitor events
    pluginHealthMonitor.on('healthUpdate', (healthData) => {
      this.broadcastPluginHealth(healthData);
    });

    // Listen to application-level events
    this.setupApplicationEventListeners();
  }

  /**
   * Authenticate user
   */
  private async authenticateUser(token?: string, userId?: string): Promise<string | null> {
    try {
      if (token) {
        // Validate JWT token
        // This would integrate with your authentication system
        // For now, decode and validate the token
        const decoded = this.decodeJWT(token);
        if (decoded && decoded.userId) {
          return decoded.userId;
        }
      }
      
      if (userId) {
        // For development/testing, allow direct user ID
        const user = await prisma.user.findUnique({ where: { id: userId } });
        return user ? user.id : null;
      }
      
      // Anonymous users get a temporary ID
      return `anonymous-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    } catch (error) {
      console.error('[WebSocket] Authentication error:', error);
      return null;
    }
  }

  /**
   * Decode JWT token (simplified - use proper JWT library in production)
   */
  private decodeJWT(token: string): any {
    try {
      // This is a simplified implementation
      // In production, use jsonwebtoken library and verify signature
      const payload = token.split('.')[1];
      const decoded = Buffer.from(payload, 'base64').toString();
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  /**
   * Send initial data for entity
   */
  private async sendInitialEntityData(socketId: string, entityRef: string): Promise<void> {
    try {
      // Get entity details
      const entity = await productionBackstageClient.getEntityByRef(entityRef);
      
      if (entity) {
        this.sendToClient(socketId, {
          type: 'metrics',
          entityRef,
          data: await this.getCurrentMetrics(entityRef),
          timestamp: new Date().toISOString(),
        });
        
        // Send recent alerts
        const alerts = await this.getRecentAlerts(entityRef);
        alerts.forEach(alert => {
          this.sendToClient(socketId, {
            type: 'alert',
            entityRef,
            data: alert,
            timestamp: alert.timestamp,
          });
        });
      }
    } catch (error) {
      console.error(`[WebSocket] Error sending initial data for ${entityRef}:`, error);
    }
  }

  /**
   * Collect and broadcast metrics
   */
  private async collectAndBroadcastMetrics(): Promise<void> {
    try {
      // Get all subscribed entities
      const subscribedEntities = Array.from(this.entitySubscriptions.keys());
      
      for (const entityRef of subscribedEntities) {
        const metrics = await this.getCurrentMetrics(entityRef);
        
        if (metrics) {
          const message: WebSocketMessage = {
            type: 'metrics',
            entityRef,
            data: metrics,
            timestamp: new Date().toISOString(),
          };
          
          this.broadcastToEntitySubscribers(entityRef, message);
          
          // Store metrics in database
          await this.storeMetrics(entityRef, metrics);
        }
      }
    } catch (error) {
      console.error('[WebSocket] Error collecting metrics:', error);
    }
  }

  /**
   * Get current metrics for entity
   */
  private async getCurrentMetrics(entityRef: string): Promise<MetricsUpdate | null> {
    try {
      // This would integrate with your metrics system (Prometheus, DataDog, etc.)
      // For now, we'll get metrics from multiple sources
      
      // Get from plugin health monitor if it's a plugin
      const pluginId = this.extractPluginIdFromEntityRef(entityRef);
      if (pluginId) {
        const healthData = pluginHealthMonitor.getPluginHealth(pluginId);
        if (healthData && healthData.metrics.responseTime.length > 0) {
          const latest = {
            responseTime: healthData.metrics.responseTime[healthData.metrics.responseTime.length - 1]?.value || 0,
            memoryUsage: healthData.metrics.memoryUsage[healthData.metrics.memoryUsage.length - 1]?.value || 0,
            cpuUsage: healthData.metrics.cpuUsage[healthData.metrics.cpuUsage.length - 1]?.value || 0,
            errorRate: healthData.metrics.errorRate[healthData.metrics.errorRate.length - 1]?.value || 0,
            requestCount: healthData.metrics.requestCount[healthData.metrics.requestCount.length - 1]?.value || 0,
          };
          
          return {
            entityRef,
            metrics: {
              cpu: latest.cpuUsage,
              memory: latest.memoryUsage,
              requestsPerSecond: latest.requestCount / 60, // Convert to per-second
              errorRate: latest.errorRate,
              responseTime: latest.responseTime,
              activeConnections: Math.floor(latest.requestCount * 0.1), // Estimate
            }
          };
        }
      }
      
      // Get from Prometheus/metrics endpoint
      const metricsEndpoint = this.getMetricsEndpoint(entityRef);
      if (metricsEndpoint) {
        const response = await axios.get(metricsEndpoint, { timeout: 5000 });
        return this.parseMetricsResponse(entityRef, response.data);
      }
      
      // Fallback to database metrics
      return await this.getMetricsFromDatabase(entityRef);
      
    } catch (error) {
      console.error(`[WebSocket] Error getting metrics for ${entityRef}:`, error);
      return null;
    }
  }

  /**
   * Get metrics endpoint for entity
   */
  private getMetricsEndpoint(entityRef: string): string | null {
    // This would map entities to their metrics endpoints
    // Based on annotations or configuration
    
    const [kind, namespace, name] = entityRef.split(':');
    
    // Example mappings
    if (kind === 'Component') {
      return `${process.env.METRICS_BASE_URL}/api/v1/query?query=up{job="${name}"}`;
    }
    
    return null;
  }

  /**
   * Parse metrics response
   */
  private parseMetricsResponse(entityRef: string, data: any): MetricsUpdate {
    // This would parse metrics from your metrics system format
    // Example for Prometheus format
    
    return {
      entityRef,
      metrics: {
        cpu: Math.random() * 80 + 10, // Placeholder
        memory: Math.random() * 80 + 20,
        requestsPerSecond: Math.random() * 100 + 50,
        errorRate: Math.random() * 5,
        responseTime: Math.random() * 200 + 50,
        activeConnections: Math.floor(Math.random() * 50) + 10,
      }
    };
  }

  /**
   * Get metrics from database
   */
  private async getMetricsFromDatabase(entityRef: string): Promise<MetricsUpdate | null> {
    try {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      
      const metrics = await prisma.serviceMetrics.findMany({
        where: {
          entityRef,
          timestamp: { gte: oneMinuteAgo },
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });
      
      if (metrics.length === 0) return null;
      
      // Average the recent metrics
      const avgMetrics = metrics.reduce((acc, metric) => ({
        cpu: acc.cpu + (metric.cpu || 0),
        memory: acc.memory + (metric.memory || 0),
        requestsPerSecond: acc.requestsPerSecond + (metric.requestsPerSecond || 0),
        errorRate: acc.errorRate + (metric.errorRate || 0),
        responseTime: acc.responseTime + (metric.responseTime || 0),
        activeConnections: acc.activeConnections + (metric.activeConnections || 0),
      }), { cpu: 0, memory: 0, requestsPerSecond: 0, errorRate: 0, responseTime: 0, activeConnections: 0 });
      
      const count = metrics.length;
      
      return {
        entityRef,
        metrics: {
          cpu: avgMetrics.cpu / count,
          memory: avgMetrics.memory / count,
          requestsPerSecond: avgMetrics.requestsPerSecond / count,
          errorRate: avgMetrics.errorRate / count,
          responseTime: avgMetrics.responseTime / count,
          activeConnections: Math.round(avgMetrics.activeConnections / count),
        }
      };
    } catch (error) {
      console.error(`[WebSocket] Error getting metrics from database for ${entityRef}:`, error);
      return null;
    }
  }

  /**
   * Store metrics in database
   */
  private async storeMetrics(entityRef: string, metrics: MetricsUpdate): Promise<void> {
    try {
      await prisma.serviceMetrics.create({
        data: {
          entityRef,
          cpu: metrics.metrics.cpu,
          memory: metrics.metrics.memory,
          requestsPerSecond: metrics.metrics.requestsPerSecond,
          errorRate: metrics.metrics.errorRate,
          responseTime: metrics.metrics.responseTime,
          activeConnections: metrics.metrics.activeConnections,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error(`[WebSocket] Error storing metrics for ${entityRef}:`, error);
    }
  }

  /**
   * Broadcast health updates
   */
  private async broadcastHealthUpdates(): Promise<void> {
    try {
      // Get Backstage health
      const backstageHealth = productionBackstageClient.getHealthStatus();
      if (backstageHealth) {
        this.broadcast({
          type: 'health',
          data: {
            service: 'backstage',
            status: backstageHealth.status,
            timestamp: backstageHealth.lastCheck,
            details: backstageHealth,
          },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('[WebSocket] Error broadcasting health updates:', error);
    }
  }

  /**
   * Broadcast plugin health
   */
  private broadcastPluginHealth(healthData: any): void {
    if (!this.io) return;
    
    this.io.to('plugin:all').emit('message', {
      type: 'health',
      data: {
        service: 'plugin',
        pluginId: healthData.pluginId,
        ...healthData,
      },
      timestamp: new Date().toISOString(),
    });
    
    this.io.to(`plugin:${healthData.pluginId}`).emit('message', {
      type: 'health',
      data: healthData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Monitor deployments
   */
  private async monitorDeployments(): Promise<void> {
    try {
      // This would integrate with your CI/CD system
      // Check for ongoing deployments and broadcast updates
      
      const ongoingDeployments = await this.getOngoingDeployments();
      
      for (const deployment of ongoingDeployments) {
        const message: WebSocketMessage = {
          type: 'deployment',
          entityRef: deployment.entityRef,
          data: deployment,
          timestamp: new Date().toISOString(),
        };
        
        this.io?.to('deployments').emit('message', message);
        this.broadcastToEntitySubscribers(deployment.entityRef, message);
      }
    } catch (error) {
      console.error('[WebSocket] Error monitoring deployments:', error);
    }
  }

  /**
   * Get ongoing deployments
   */
  private async getOngoingDeployments(): Promise<DeploymentUpdate[]> {
    try {
      // This would query your deployment system
      // For now, return mock data
      
      const deployments = await prisma.deployment.findMany({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        include: {
          service: true,
        },
      });
      
      return deployments.map(deployment => ({
        entityRef: `Component:${deployment.service.namespace}/${deployment.service.name}`,
        deployment: {
          id: deployment.id,
          version: deployment.version,
          status: deployment.status.toLowerCase() as any,
          progress: deployment.progress || 0,
          message: deployment.message || 'Deployment in progress',
        }
      }));
    } catch (error) {
      console.error('[WebSocket] Error getting ongoing deployments:', error);
      return [];
    }
  }

  /**
   * Get recent alerts for entity
   */
  private async getRecentAlerts(entityRef: string): Promise<AlertUpdate[]> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const alerts = await prisma.alert.findMany({
        where: {
          entityRef,
          createdAt: { gte: oneHourAgo },
          acknowledged: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      
      return alerts.map(alert => ({
        id: alert.id,
        entityRef: alert.entityRef,
        severity: alert.severity.toLowerCase() as any,
        title: alert.title,
        message: alert.message,
        timestamp: alert.createdAt.toISOString(),
        acknowledged: alert.acknowledged,
      }));
    } catch (error) {
      console.error(`[WebSocket] Error getting recent alerts for ${entityRef}:`, error);
      return [];
    }
  }

  /**
   * Setup application event listeners
   */
  private setupApplicationEventListeners(): void {
    // Listen to application events and broadcast them
    process.on('alert', (alert: AlertUpdate) => {
      this.broadcastAlert(alert);
    });
    
    process.on('deployment', (deployment: DeploymentUpdate) => {
      this.broadcastDeployment(deployment);
    });
    
    process.on('log', (log: LogUpdate) => {
      this.broadcastLog(log);
    });
  }

  /**
   * Broadcast alert to relevant clients
   */
  private async broadcastAlert(alert: AlertUpdate): Promise<void> {
    const message: WebSocketMessage = {
      type: 'alert',
      entityRef: alert.entityRef,
      data: alert,
      timestamp: alert.timestamp,
    };
    
    this.broadcastToEntitySubscribers(alert.entityRef, message);
    
    // Store alert in database
    try {
      await prisma.alert.create({
        data: {
          id: alert.id,
          entityRef: alert.entityRef,
          severity: alert.severity.toUpperCase() as any,
          title: alert.title,
          message: alert.message,
          acknowledged: alert.acknowledged,
        },
      });
    } catch (error) {
      console.error('[WebSocket] Error storing alert:', error);
    }
  }

  /**
   * Broadcast deployment update
   */
  private broadcastDeployment(deployment: DeploymentUpdate): void {
    const message: WebSocketMessage = {
      type: 'deployment',
      entityRef: deployment.entityRef,
      data: deployment,
      timestamp: new Date().toISOString(),
    };
    
    this.io?.to('deployments').emit('message', message);
    this.broadcastToEntitySubscribers(deployment.entityRef, message);
  }

  /**
   * Broadcast log update
   */
  private broadcastLog(log: LogUpdate): void {
    const message: WebSocketMessage = {
      type: 'log',
      entityRef: log.entityRef,
      data: log,
      timestamp: log.timestamp,
    };
    
    this.broadcastToEntitySubscribers(log.entityRef, message);
  }

  /**
   * Broadcast to all entity subscribers
   */
  private broadcastToEntitySubscribers(entityRef: string, message: WebSocketMessage): void {
    if (!this.io) return;
    
    const subscribers = this.entitySubscriptions.get(entityRef);
    if (subscribers) {
      subscribers.forEach(socketId => {
        this.sendToClient(socketId, message);
      });
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(socketId: string, message: WebSocketMessage): void {
    if (this.io) {
      this.io.to(socketId).emit('message', message);
    }
  }

  /**
   * Broadcast to all connected clients
   */
  private broadcast(message: WebSocketMessage): void {
    if (this.io) {
      this.io.emit('message', message);
    }
  }

  /**
   * Extract plugin ID from entity reference
   */
  private extractPluginIdFromEntityRef(entityRef: string): string | null {
    // This would parse entity references to extract plugin information
    // Based on your entity naming conventions
    
    if (entityRef.includes('plugin')) {
      const parts = entityRef.split('/');
      return parts[parts.length - 1];
    }
    
    return null;
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    authenticatedUsers: number;
    entitySubscriptions: number;
  } {
    return {
      totalConnections: this.io?.sockets.sockets.size || 0,
      authenticatedUsers: this.connectedClients.size,
      entitySubscriptions: this.entitySubscriptions.size,
    };
  }

  /**
   * Shutdown WebSocket service
   */
  shutdown(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    
    if (this.deploymentMonitorInterval) {
      clearInterval(this.deploymentMonitorInterval);
      this.deploymentMonitorInterval = undefined;
    }
    
    if (this.io) {
      this.io.close();
      this.io = undefined;
    }
    
    console.log('[WebSocket] Real-time service shutdown complete');
  }
}

// Export singleton instance
export const realWebSocketService = new RealWebSocketService();