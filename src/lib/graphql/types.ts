/**
 * GraphQL Type Definitions
 */

import { Request, Response } from 'express';
import { PubSub } from 'graphql-subscriptions';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import DataLoader from 'dataloader';
import { PrismaClient } from '@prisma/client';

export interface GraphQLContext {
  req: Request;
  res: Response;
  prisma: PrismaClient;
  pubsub: PubSub | RedisPubSub;
  dataloaders: DataLoaders;
  user?: AuthenticatedUser;
  permissions?: UserPermissions;
  requestId: string;
  startTime: number;
  cache: CacheManager;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  tenantId?: string;
  organizations?: string[];
}

export interface UserPermissions {
  canRead: (resource: string) => boolean;
  canWrite: (resource: string) => boolean;
  canDelete: (resource: string) => boolean;
  canExecute: (action: string) => boolean;
  isAdmin: boolean;
}

export interface DataLoaders {
  userLoader: DataLoader<string, any>;
  serviceLoader: DataLoader<string, any>;
  templateLoader: DataLoader<string, any>;
  pluginLoader: DataLoader<string, any>;
  organizationLoader: DataLoader<string, any>;
  teamLoader: DataLoader<string, any>;
  notificationLoader: DataLoader<string, any>;
  auditLogLoader: DataLoader<string, any>;
}

export interface CacheManager {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any, ttl?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
  flush: () => Promise<void>;
}

export interface PaginationArgs {
  first?: number;
  after?: string;
  last?: number;
  before?: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

export interface Edge<T> {
  node: T;
  cursor: string;
}

export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface FilterInput {
  field: string;
  operator: FilterOperator;
  value: any;
}

export enum FilterOperator {
  EQ = 'EQ',
  NEQ = 'NEQ',
  GT = 'GT',
  GTE = 'GTE',
  LT = 'LT',
  LTE = 'LTE',
  IN = 'IN',
  NIN = 'NIN',
  LIKE = 'LIKE',
  REGEX = 'REGEX',
  EXISTS = 'EXISTS',
}

export interface SortInput {
  field: string;
  direction: SortDirection;
}

export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

export interface SubscriptionEvent<T = any> {
  type: SubscriptionEventType;
  payload: T;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

export enum SubscriptionEventType {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  NOTIFICATION = 'NOTIFICATION',
  REALTIME_UPDATE = 'REALTIME_UPDATE',
}

export interface GraphQLMetrics {
  queryDepth: number;
  queryComplexity: number;
  resolverDuration: number;
  dataLoaderHits: number;
  dataLoaderMisses: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

export interface GraphQLError {
  message: string;
  code: string;
  path?: string[];
  extensions?: Record<string, any>;
}