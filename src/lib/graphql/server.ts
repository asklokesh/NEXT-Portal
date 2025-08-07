/**
 * GraphQL Server Configuration
 * Apollo Server with Express integration
 */

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalPlayground } from '@apollo/server/plugin/landingPage/default';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { Server } from 'http';
import { Express } from 'express';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';
import { GraphQLContext } from './types';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { createDataLoaders } from './dataloaders';
import { applyMiddleware } from './middleware';
import { createRateLimiter } from './rate-limiting';
import { ComplexityPlugin } from './complexity';
import { CachePlugin } from './cache';
import { MonitoringPlugin } from './monitoring';
import { ErrorHandlingPlugin } from './errors';
import { AuthenticationPlugin } from './auth';
import { PrismaClient } from '@prisma/client';

export interface GraphQLServerConfig {
  app: Express;
  httpServer: Server;
  prisma: PrismaClient;
  redisUrl?: string;
  enablePlayground?: boolean;
  enableIntrospection?: boolean;
  maxQueryDepth?: number;
  maxQueryComplexity?: number;
  rateLimitWindow?: number;
  rateLimitMax?: number;
}

export async function createGraphQLServer(config: GraphQLServerConfig) {
  const {
    app,
    httpServer,
    prisma,
    redisUrl = process.env.REDIS_URL || 'redis://localhost:6379',
    enablePlayground = process.env.NODE_ENV !== 'production',
    enableIntrospection = process.env.NODE_ENV !== 'production',
    maxQueryDepth = 10,
    maxQueryComplexity = 1000,
    rateLimitWindow = 60000, // 1 minute
    rateLimitMax = 100,
  } = config;

  // Create Redis clients for PubSub
  const redisPublisher = new Redis(redisUrl);
  const redisSubscriber = new Redis(redisUrl);

  // Create PubSub instance
  const pubsub = new RedisPubSub({
    publisher: redisPublisher,
    subscriber: redisSubscriber,
  });

  // Create executable schema
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  // Create WebSocket server for subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  // Create rate limiter
  const rateLimiter = createRateLimiter({
    windowMs: rateLimitWindow,
    max: rateLimitMax,
  });

  // Create context function
  const createContext = async ({ req, res }: any): Promise<GraphQLContext> => {
    const requestId = req.headers['x-request-id'] || generateRequestId();
    const startTime = Date.now();

    // Get authenticated user from request
    const user = await authenticateUser(req);
    const permissions = user ? await loadUserPermissions(user.id) : undefined;

    return {
      req,
      res,
      prisma,
      pubsub,
      dataloaders: createDataLoaders(prisma),
      user,
      permissions,
      requestId,
      startTime,
      cache: createCacheManager(redisUrl),
    };
  };

  // Set up WebSocket server for subscriptions
  const serverCleanup = useServer(
    {
      schema,
      context: createContext,
      onConnect: async (ctx) => {
        console.log('WebSocket client connected');
        // Validate connection params if needed
        return true;
      },
      onDisconnect: async (ctx) => {
        console.log('WebSocket client disconnected');
      },
    },
    wsServer
  );

  // Create Apollo Server
  const apolloServer = new ApolloServer<GraphQLContext>({
    schema,
    introspection: enableIntrospection,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      enablePlayground && ApolloServerPluginLandingPageLocalPlayground(),
      ComplexityPlugin({ maxDepth: maxQueryDepth, maxComplexity: maxQueryComplexity }),
      CachePlugin(),
      MonitoringPlugin(),
      ErrorHandlingPlugin(),
      AuthenticationPlugin(),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ].filter(Boolean),
  });

  // Start Apollo Server
  await apolloServer.start();

  // Apply middleware
  app.use(
    '/graphql',
    applyMiddleware([
      rateLimiter,
      expressMiddleware(apolloServer, {
        context: createContext,
      }),
    ])
  );

  console.log('GraphQL server ready at /graphql');
  console.log('GraphQL subscriptions ready at ws://localhost:4000/graphql');

  return {
    apolloServer,
    wsServer,
    pubsub,
    cleanup: async () => {
      await apolloServer.stop();
      await serverCleanup.dispose();
      redisPublisher.disconnect();
      redisSubscriber.disconnect();
    },
  };
}

// Helper functions
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function authenticateUser(req: any) {
  // Extract token from headers
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  try {
    // Verify and decode token
    // This should integrate with your auth system
    const decoded = await verifyToken(token);
    return decoded;
  } catch (error) {
    return null;
  }
}

async function loadUserPermissions(userId: string) {
  // Load user permissions from database or cache
  // This should integrate with your RBAC system
  return {
    canRead: (resource: string) => true,
    canWrite: (resource: string) => true,
    canDelete: (resource: string) => false,
    canExecute: (action: string) => true,
    isAdmin: false,
  };
}

function createCacheManager(redisUrl: string) {
  const redis = new Redis(redisUrl);
  
  return {
    get: async (key: string) => {
      const value = await redis.get(key);
      return value ? JSON.parse(value) : null;
    },
    set: async (key: string, value: any, ttl = 3600) => {
      await redis.setex(key, ttl, JSON.stringify(value));
    },
    del: async (key: string) => {
      await redis.del(key);
    },
    flush: async () => {
      await redis.flushdb();
    },
  };
}

async function verifyToken(token: string) {
  // Implement token verification logic
  // This is a placeholder - integrate with your auth system
  return {
    id: 'user_123',
    email: 'user@example.com',
    name: 'Test User',
    roles: ['developer'],
  };
}