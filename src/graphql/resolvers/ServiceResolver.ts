/**
 * Service Resolver with DataLoader Integration
 */

import {
  Resolver,
  Query,
  Mutation,
  Subscription,
  Arg,
  Args,
  Ctx,
  Authorized,
  FieldResolver,
  Root,
  ID,
  Int,
} from 'type-graphql';
import { Service, ServiceConnection, ServiceStats, ServiceStatus, ServiceType } from '../schema/types/Service';
import { GraphQLContext } from '../../lib/graphql/types';
import { PaginationArgs, FilterArgs, SortArgs } from './args';
import { CreateServiceInput, UpdateServiceInput } from './inputs/ServiceInput';
import { withCache } from '../cache/decorators';
import { trackMetrics } from '../monitoring/decorators';
import { validateInput } from '../validation/decorators';

@Resolver(() => Service)
export class ServiceResolver {
  @Query(() => Service, { nullable: true })
  @Authorized()
  @withCache({ ttl: 300 })
  @trackMetrics()
  async service(
    @Arg('id', () => ID) id: string,
    @Ctx() ctx: GraphQLContext
  ): Promise<Service | null> {
    // Use DataLoader for efficient batching
    return ctx.dataloaders.serviceLoader.load(id);
  }

  @Query(() => ServiceConnection)
  @Authorized()
  @withCache({ ttl: 60 })
  @trackMetrics()
  async services(
    @Args() pagination: PaginationArgs,
    @Args() filters: FilterArgs,
    @Args() sort: SortArgs,
    @Ctx() ctx: GraphQLContext
  ): Promise<ServiceConnection> {
    const { prisma } = ctx;
    
    // Build query with filters
    const where = buildWhereClause(filters);
    const orderBy = buildOrderByClause(sort);
    
    // Get total count
    const totalCount = await prisma.service.count({ where });
    
    // Get paginated results
    const services = await prisma.service.findMany({
      where,
      orderBy,
      take: pagination.first || 20,
      skip: pagination.after ? 1 : 0,
      cursor: pagination.after ? { id: pagination.after } : undefined,
    });
    
    // Build connection response
    return {
      edges: services.map(service => ({
        node: service,
        cursor: service.id,
      })),
      pageInfo: {
        hasNextPage: services.length === (pagination.first || 20),
        hasPreviousPage: !!pagination.after,
        startCursor: services[0]?.id,
        endCursor: services[services.length - 1]?.id,
      },
      totalCount,
    };
  }

  @Query(() => ServiceStats)
  @Authorized()
  @withCache({ ttl: 300 })
  @trackMetrics()
  async serviceStats(@Ctx() ctx: GraphQLContext): Promise<ServiceStats> {
    const { prisma } = ctx;
    
    const [total, statusCounts, typeCounts] = await Promise.all([
      prisma.service.count(),
      prisma.service.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.service.groupBy({
        by: ['type'],
        _count: true,
      }),
    ]);
    
    return {
      total,
      active: statusCounts.find(s => s.status === ServiceStatus.ACTIVE)?._count || 0,
      inactive: statusCounts.find(s => s.status === ServiceStatus.INACTIVE)?._count || 0,
      deprecated: statusCounts.find(s => s.status === ServiceStatus.DEPRECATED)?._count || 0,
      byType: typeCounts.map(t => ({
        type: t.type as ServiceType,
        count: t._count,
      })),
    };
  }

  @Mutation(() => Service)
  @Authorized('ADMIN', 'SERVICE_OWNER')
  @validateInput()
  @trackMetrics()
  async createService(
    @Arg('input') input: CreateServiceInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<Service> {
    const { prisma, user, pubsub } = ctx;
    
    // Create service with audit log
    const service = await prisma.$transaction(async (tx) => {
      const newService = await tx.service.create({
        data: {
          ...input,
          ownerId: user!.id,
          version: 1,
        },
      });
      
      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: user!.id,
          action: 'CREATE_SERVICE',
          resourceType: 'SERVICE',
          resourceId: newService.id,
          metadata: input,
        },
      });
      
      return newService;
    });
    
    // Publish subscription event
    await pubsub.publish('SERVICE_CREATED', {
      serviceCreated: service,
    });
    
    // Invalidate cache
    await ctx.cache.del('services:*');
    
    return service;
  }

  @Mutation(() => Service)
  @Authorized('ADMIN', 'SERVICE_OWNER')
  @validateInput()
  @trackMetrics()
  async updateService(
    @Arg('id', () => ID) id: string,
    @Arg('input') input: UpdateServiceInput,
    @Ctx() ctx: GraphQLContext
  ): Promise<Service> {
    const { prisma, user, pubsub } = ctx;
    
    // Check ownership
    const existing = await prisma.service.findUnique({
      where: { id },
    });
    
    if (!existing) {
      throw new Error('Service not found');
    }
    
    if (existing.ownerId !== user!.id && !ctx.permissions?.isAdmin) {
      throw new Error('Unauthorized');
    }
    
    // Update service with version bump
    const service = await prisma.$transaction(async (tx) => {
      const updated = await tx.service.update({
        where: { id },
        data: {
          ...input,
          version: { increment: 1 },
        },
      });
      
      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: user!.id,
          action: 'UPDATE_SERVICE',
          resourceType: 'SERVICE',
          resourceId: id,
          metadata: { before: existing, after: input },
        },
      });
      
      return updated;
    });
    
    // Publish subscription event
    await pubsub.publish('SERVICE_UPDATED', {
      serviceUpdated: service,
    });
    
    // Invalidate cache
    await ctx.cache.del(`service:${id}`);
    await ctx.cache.del('services:*');
    
    return service;
  }

  @Mutation(() => Boolean)
  @Authorized('ADMIN')
  @trackMetrics()
  async deleteService(
    @Arg('id', () => ID) id: string,
    @Ctx() ctx: GraphQLContext
  ): Promise<boolean> {
    const { prisma, user, pubsub } = ctx;
    
    await prisma.$transaction(async (tx) => {
      // Soft delete
      await tx.service.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: ServiceStatus.DEPRECATED,
        },
      });
      
      // Create audit log
      await tx.auditLog.create({
        data: {
          userId: user!.id,
          action: 'DELETE_SERVICE',
          resourceType: 'SERVICE',
          resourceId: id,
        },
      });
    });
    
    // Publish subscription event
    await pubsub.publish('SERVICE_DELETED', {
      serviceDeleted: id,
    });
    
    // Invalidate cache
    await ctx.cache.del(`service:${id}`);
    await ctx.cache.del('services:*');
    
    return true;
  }

  @Subscription(() => Service, {
    topics: 'SERVICE_CREATED',
  })
  @Authorized()
  serviceCreated(@Root() service: Service): Service {
    return service;
  }

  @Subscription(() => Service, {
    topics: 'SERVICE_UPDATED',
    filter: ({ payload, args, context }) => {
      // Filter based on user permissions or subscriptions
      return true;
    },
  })
  @Authorized()
  serviceUpdated(@Root() service: Service): Service {
    return service;
  }

  @Subscription(() => ID, {
    topics: 'SERVICE_DELETED',
  })
  @Authorized()
  serviceDeleted(@Root() id: string): string {
    return id;
  }

  // Field Resolvers for nested data
  @FieldResolver()
  async owner(
    @Root() service: Service,
    @Ctx() ctx: GraphQLContext
  ) {
    return ctx.dataloaders.userLoader.load(service.ownerId);
  }

  @FieldResolver()
  async dependencies(
    @Root() service: Service,
    @Ctx() ctx: GraphQLContext
  ) {
    return ctx.prisma.dependency.findMany({
      where: { serviceId: service.id },
    });
  }

  @FieldResolver()
  async plugins(
    @Root() service: Service,
    @Ctx() ctx: GraphQLContext
  ) {
    const servicePlugins = await ctx.prisma.servicePlugin.findMany({
      where: { serviceId: service.id },
      include: { plugin: true },
    });
    return servicePlugins.map(sp => sp.plugin);
  }

  @FieldResolver()
  async health(
    @Root() service: Service,
    @Ctx() ctx: GraphQLContext
  ) {
    // Get latest health check from monitoring service
    const healthCheck = await ctx.prisma.healthCheck.findFirst({
      where: { serviceId: service.id },
      orderBy: { createdAt: 'desc' },
    });
    
    return healthCheck || {
      state: 'UNKNOWN',
      message: 'No health data available',
      checks: [],
      lastChecked: new Date(),
    };
  }
}

// Helper functions
function buildWhereClause(filters: FilterArgs) {
  const where: any = {};
  
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  
  if (filters.status) {
    where.status = filters.status;
  }
  
  if (filters.type) {
    where.type = filters.type;
  }
  
  if (filters.tags && filters.tags.length > 0) {
    where.tags = { hasSome: filters.tags };
  }
  
  return where;
}

function buildOrderByClause(sort: SortArgs) {
  const orderBy: any = {};
  
  if (sort.field) {
    orderBy[sort.field] = sort.direction.toLowerCase();
  } else {
    orderBy.createdAt = 'desc';
  }
  
  return orderBy;
}