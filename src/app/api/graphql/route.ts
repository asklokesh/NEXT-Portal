/**
 * GraphQL API Route
 * Next.js App Router integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { createPubSub } from '@/lib/graphql/subscriptions';
import { createDataLoaders } from '@/lib/graphql/dataloaders';
import { GraphQLCache } from '@/lib/graphql/cache';
import { ComplexityPlugin } from '@/lib/graphql/complexity';
import { GraphQLContext } from '@/lib/graphql/types';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';

// Initialize Prisma
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Initialize Redis
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Initialize PubSub
const pubsub = createPubSub({
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Initialize Cache
const cache = new GraphQLCache({
  redis,
  defaultTTL: 300,
  enableQueryCaching: true,
  enableFieldCaching: true,
});

// Create schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// Create Apollo Server
const apolloServer = new ApolloServer<GraphQLContext>({
  schema,
  introspection: process.env.NODE_ENV !== 'production',
  plugins: [
    ComplexityPlugin({
      maxDepth: 10,
      maxComplexity: 1000,
      onComplete: (complexity) => {
        console.log(`Query complexity: ${complexity}`);
      },
    }),
  ],
  formatError: (error) => {
    // Log errors
    console.error('GraphQL Error:', error);
    
    // Format error for client
    return {
      message: error.message,
      code: error.extensions?.code || 'INTERNAL_ERROR',
      path: error.path,
      timestamp: new Date().toISOString(),
    };
  },
});

// Create context function
async function createContext(req: NextRequest): Promise<GraphQLContext> {
  const requestId = req.headers.get('x-request-id') || generateRequestId();
  const startTime = Date.now();
  
  // Get user from session/token
  const user = await getUserFromRequest(req);
  const permissions = user ? await loadUserPermissions(user.id) : undefined;
  
  return {
    req: req as any,
    res: NextResponse as any,
    prisma,
    pubsub,
    dataloaders: createDataLoaders(prisma),
    user,
    permissions,
    requestId,
    startTime,
    cache,
  };
}

// Create Next.js handler
const handler = startServerAndCreateNextHandler(apolloServer, {
  context: createContext,
});

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

// WebSocket handler for subscriptions
export async function SOCKET(request: NextRequest) {
  // WebSocket handling for subscriptions
  // This would typically be handled by a separate WebSocket server
  return new NextResponse('WebSocket endpoint', { status: 501 });
}

// Helper functions
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function getUserFromRequest(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return null;
  }
  
  try {
    // Verify JWT token
    const decoded = await verifyToken(token);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        roles: true,
        organizations: true,
      },
    });
    
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles.map(r => r.name),
      organizations: user.organizations.map(o => o.id),
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

async function loadUserPermissions(userId: string) {
  // Load permissions from database
  const permissions = await prisma.permission.findMany({
    where: {
      roles: {
        some: {
          users: {
            some: { id: userId },
          },
        },
      },
    },
  });
  
  const permissionSet = new Set(permissions.map(p => p.name));
  
  return {
    canRead: (resource: string) => 
      permissionSet.has(`read:${resource}`) || permissionSet.has('admin'),
    canWrite: (resource: string) => 
      permissionSet.has(`write:${resource}`) || permissionSet.has('admin'),
    canDelete: (resource: string) => 
      permissionSet.has(`delete:${resource}`) || permissionSet.has('admin'),
    canExecute: (action: string) => 
      permissionSet.has(`execute:${action}`) || permissionSet.has('admin'),
    isAdmin: permissionSet.has('admin'),
  };
}

async function verifyToken(token: string) {
  // Implement JWT verification
  // This is a placeholder - integrate with your auth system
  return {
    userId: 'user_123',
    email: 'user@example.com',
  };
}