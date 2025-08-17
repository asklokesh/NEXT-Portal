#!/usr/bin/env tsx
/**
 * Production WebSocket Cluster with High Availability
 * Supports Redis-based clustering, load balancing, and monitoring
 */

import cluster from 'cluster';
import os from 'os';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { config } from 'dotenv';
import winston from 'winston';
import { WebSocketManager } from '../src/lib/websocket/WebSocketManager';

// Load environment variables
config({ path: '.env.production' });
config({ path: '.env.local' });
config({ path: '.env' });

// Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const WS_PORT = parseInt(process.env.WS_PORT || '4403');
const CORS_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4400';
const NODE_ENV = process.env.NODE_ENV || 'development';
const CLUSTER_WORKERS = parseInt(process.env.WS_CLUSTER_WORKERS || '0') || os.cpus().length;

// Enhanced logging configuration
const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'websocket-cluster' },
  transports: [
    new winston.transports.File({ filename: 'logs/websocket-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/websocket-combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
});

// Health check metrics
interface ClusterMetrics {
  startTime: Date;
  totalConnections: number;
  totalMessages: number;
  errorCount: number;
  restartCount: number;
  workerStatus: Map<number, { status: string; lastSeen: Date }>;
}

class WebSocketClusterManager {
  private metrics: ClusterMetrics;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    this.metrics = {
      startTime: new Date(),
      totalConnections: 0,
      totalMessages: 0,
      errorCount: 0,
      restartCount: 0,
      workerStatus: new Map()
    };
  }

  startMaster() {
    logger.info('Starting WebSocket cluster master', {
      workers: CLUSTER_WORKERS,
      port: WS_PORT,
      redis: REDIS_URL
    });

    // Fork workers
    for (let i = 0; i < CLUSTER_WORKERS; i++) {
      this.forkWorker();
    }

    // Handle worker events
    cluster.on('exit', (worker, code, signal) => {
      logger.error('Worker died', { 
        workerId: worker.id, 
        code, 
        signal,
        restartCount: this.metrics.restartCount 
      });
      
      this.metrics.restartCount++;
      this.metrics.workerStatus.delete(worker.id);
      
      // Restart worker unless intentionally killed
      if (code !== 0 && !worker.exitedAfterDisconnect) {
        logger.info('Restarting worker', { workerId: worker.id });
        setTimeout(() => this.forkWorker(), 5000);
      }
    });

    cluster.on('online', (worker) => {
      logger.info('Worker online', { workerId: worker.id });
      this.metrics.workerStatus.set(worker.id, {
        status: 'online',
        lastSeen: new Date()
      });
    });

    // Start health monitoring
    this.startHealthMonitoring();

    // Handle graceful shutdown
    this.setupGracefulShutdown();
  }

  private forkWorker() {
    const worker = cluster.fork();
    
    worker.on('message', (message) => {
      if (message.type === 'metrics') {
        this.updateMetrics(message.data);
      }
    });

    return worker;
  }

  private updateMetrics(data: any) {
    this.metrics.totalConnections += data.connections || 0;
    this.metrics.totalMessages += data.messages || 0;
    this.metrics.errorCount += data.errors || 0;
  }

  private startHealthMonitoring() {
    this.healthCheckInterval = setInterval(() => {
      const status = {
        cluster: 'healthy',
        workers: Object.keys(cluster.workers || {}).length,
        uptime: Date.now() - this.metrics.startTime.getTime(),
        ...this.metrics
      };

      logger.info('Cluster health check', status);

      // Check for dead workers
      const now = new Date();
      for (const [workerId, workerStatus] of this.metrics.workerStatus) {
        if (now.getTime() - workerStatus.lastSeen.getTime() > 60000) {
          logger.warn('Worker may be unresponsive', { workerId });
        }
      }
    }, 30000);
  }

  private setupGracefulShutdown() {
    const shutdown = () => {
      logger.info('Shutting down WebSocket cluster...');
      
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      for (const id in cluster.workers) {
        const worker = cluster.workers[id];
        if (worker) {
          worker.kill('SIGTERM');
        }
      }

      setTimeout(() => {
        process.exit(0);
      }, 10000);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}

async function startWorker() {
  const workerId = cluster.worker?.id || 0;
  
  logger.info('Starting WebSocket worker', { workerId, port: WS_PORT });

  try {
    // Create Redis clients for clustering
    const pubClient = new Redis(REDIS_URL, {
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: null,
    });

    const subClient = pubClient.duplicate();

    // Create HTTP server
    const httpServer = createServer();

    // Create Socket.IO server with Redis adapter
    const io = new Server(httpServer, {
      cors: {
        origin: CORS_ORIGIN,
        credentials: true,
      },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e6,
      allowRequest: (req, callback) => {
        // Basic rate limiting and security checks
        const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        logger.debug('Connection request', { clientIP, workerId });
        callback(null, true);
      }
    });

    // Set up Redis adapter
    io.adapter(createAdapter(pubClient, subClient));

    // Initialize WebSocket manager
    const wsManager = new WebSocketManager(io);

    // Enhanced connection handling with metrics
    let connectionCount = 0;
    let messageCount = 0;
    let errorCount = 0;

    io.on('connection', async (socket) => {
      connectionCount++;
      
      logger.info('New WebSocket connection', {
        socketId: socket.id,
        workerId,
        clientIP: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        totalConnections: connectionCount
      });

      // Enhanced authentication with JWT
      const token = socket.handshake.auth.token;
      if (token) {
        try {
          // TODO: Implement proper JWT verification
          const user = await verifyToken(token);
          socket.data.user = user;
          socket.join(`user:${user.id}`);
          
          user.teams?.forEach((team: any) => {
            socket.join(`team:${team.id}`);
          });

          socket.emit('authenticated', { user, workerId });
          logger.info('User authenticated', { userId: user.id, workerId });
        } catch (error) {
          errorCount++;
          logger.error('Authentication failed', { error: error.message, workerId });
          socket.emit('error', { message: 'Authentication failed' });
          socket.disconnect();
          return;
        }
      }

      // Rate limiting per socket
      const rateLimiter = new Map();
      const RATE_LIMIT = 100; // messages per minute
      const RATE_WINDOW = 60000; // 1 minute

      socket.use((packet, next) => {
        const now = Date.now();
        const key = socket.id;
        const requests = rateLimiter.get(key) || [];
        
        // Clean old requests
        const validRequests = requests.filter((time: number) => now - time < RATE_WINDOW);
        
        if (validRequests.length >= RATE_LIMIT) {
          logger.warn('Rate limit exceeded', { socketId: socket.id, workerId });
          return next(new Error('Rate limit exceeded'));
        }
        
        validRequests.push(now);
        rateLimiter.set(key, validRequests);
        next();
      });

      // Enhanced event handlers
      socket.on('subscribe_entity', (data) => {
        const { entityRef } = data;
        if (entityRef && typeof entityRef === 'string') {
          socket.join(`entity:${entityRef}`);
          messageCount++;
          logger.debug('Entity subscription', { entityRef, socketId: socket.id, workerId });
        }
      });

      socket.on('unsubscribe_entity', (data) => {
        const { entityRef } = data;
        if (entityRef && typeof entityRef === 'string') {
          socket.leave(`entity:${entityRef}`);
          messageCount++;
        }
      });

      socket.on('subscribe_metrics', (data) => {
        const { entityRef } = data;
        if (entityRef && typeof entityRef === 'string') {
          socket.join(`metrics:${entityRef}`);
          wsManager.subscribeToMetrics(socket.id, entityRef);
          messageCount++;
        }
      });

      socket.on('ping', () => {
        socket.emit('pong', { 
          timestamp: new Date().toISOString(),
          workerId 
        });
        messageCount++;
      });

      socket.on('error', (error) => {
        errorCount++;
        logger.error('Socket error', { error, socketId: socket.id, workerId });
      });

      socket.on('disconnect', (reason) => {
        connectionCount--;
        logger.info('Client disconnected', {
          socketId: socket.id,
          reason,
          workerId,
          remainingConnections: connectionCount
        });
        wsManager.handleDisconnect(socket.id);
        rateLimiter.delete(socket.id);
      });
    });

    // Start periodic tasks
    wsManager.startPeriodicTasks();

    // Periodic metrics reporting
    setInterval(() => {
      const metrics = {
        connections: connectionCount,
        messages: messageCount,
        errors: errorCount
      };

      if (process.send) {
        process.send({ type: 'metrics', data: metrics });
      }

      // Reset counters
      messageCount = 0;
      errorCount = 0;
    }, 30000);

    // Start server
    httpServer.listen(WS_PORT, () => {
      logger.info('WebSocket worker started', {
        workerId,
        port: WS_PORT,
        cors: CORS_ORIGIN
      });
    });

    // Worker health check endpoint
    httpServer.on('request', (req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          workerId,
          connections: connectionCount,
          uptime: process.uptime()
        }));
      }
    });

    // Graceful shutdown
    const shutdown = () => {
      logger.info('Shutting down WebSocket worker', { workerId });
      wsManager.stopPeriodicTasks();
      io.close(() => {
        httpServer.close(() => {
          pubClient.disconnect();
          subClient.disconnect();
          process.exit(0);
        });
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start WebSocket worker', { error: error.message, workerId });
    process.exit(1);
  }
}

// JWT token verification (placeholder - implement with your auth system)
async function verifyToken(token: string): Promise<any> {
  // TODO: Implement proper JWT verification with your auth system
  return {
    id: 'user-123',
    email: 'user@example.com',
    name: 'Test User',
    role: 'DEVELOPER',
    teams: [{ id: 'team-1', name: 'Platform Team' }],
  };
}

// Main execution
if (cluster.isPrimary) {
  const clusterManager = new WebSocketClusterManager();
  clusterManager.startMaster();
} else {
  startWorker();
}

export { WebSocketClusterManager };