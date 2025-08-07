/**
 * DataLoader Implementation for N+1 Query Optimization
 */

import DataLoader from 'dataloader';
import { PrismaClient } from '@prisma/client';
import { DataLoaders } from '../types';

export function createDataLoaders(prisma: PrismaClient): DataLoaders {
  return {
    userLoader: createUserLoader(prisma),
    serviceLoader: createServiceLoader(prisma),
    templateLoader: createTemplateLoader(prisma),
    pluginLoader: createPluginLoader(prisma),
    organizationLoader: createOrganizationLoader(prisma),
    teamLoader: createTeamLoader(prisma),
    notificationLoader: createNotificationLoader(prisma),
    auditLogLoader: createAuditLogLoader(prisma),
  };
}

function createUserLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(
    async (userIds) => {
      const users = await prisma.user.findMany({
        where: { id: { in: [...userIds] } },
      });
      
      const userMap = new Map(users.map(user => [user.id, user]));
      return userIds.map(id => userMap.get(id) || null);
    },
    {
      cacheKeyFn: (key) => key,
      maxBatchSize: 100,
    }
  );
}

function createServiceLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(
    async (serviceIds) => {
      const services = await prisma.service.findMany({
        where: { id: { in: [...serviceIds] } },
        include: {
          metadata: true,
          tags: true,
        },
      });
      
      const serviceMap = new Map(services.map(service => [service.id, service]));
      return serviceIds.map(id => serviceMap.get(id) || null);
    },
    {
      cacheKeyFn: (key) => key,
      maxBatchSize: 100,
    }
  );
}

function createTemplateLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(
    async (templateIds) => {
      const templates = await prisma.template.findMany({
        where: { id: { in: [...templateIds] } },
        include: {
          parameters: true,
          steps: true,
        },
      });
      
      const templateMap = new Map(templates.map(template => [template.id, template]));
      return templateIds.map(id => templateMap.get(id) || null);
    },
    {
      cacheKeyFn: (key) => key,
      maxBatchSize: 100,
    }
  );
}

function createPluginLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(
    async (pluginIds) => {
      const plugins = await prisma.plugin.findMany({
        where: { id: { in: [...pluginIds] } },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 1,
          },
          dependencies: true,
          configuration: true,
        },
      });
      
      const pluginMap = new Map(plugins.map(plugin => [plugin.id, plugin]));
      return pluginIds.map(id => pluginMap.get(id) || null);
    },
    {
      cacheKeyFn: (key) => key,
      maxBatchSize: 100,
    }
  );
}

function createOrganizationLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(
    async (orgIds) => {
      const organizations = await prisma.organization.findMany({
        where: { id: { in: [...orgIds] } },
        include: {
          teams: true,
          members: true,
        },
      });
      
      const orgMap = new Map(organizations.map(org => [org.id, org]));
      return orgIds.map(id => orgMap.get(id) || null);
    },
    {
      cacheKeyFn: (key) => key,
      maxBatchSize: 100,
    }
  );
}

function createTeamLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(
    async (teamIds) => {
      const teams = await prisma.team.findMany({
        where: { id: { in: [...teamIds] } },
        include: {
          members: true,
          services: true,
        },
      });
      
      const teamMap = new Map(teams.map(team => [team.id, team]));
      return teamIds.map(id => teamMap.get(id) || null);
    },
    {
      cacheKeyFn: (key) => key,
      maxBatchSize: 100,
    }
  );
}

function createNotificationLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(
    async (notificationIds) => {
      const notifications = await prisma.notification.findMany({
        where: { id: { in: [...notificationIds] } },
        include: {
          recipient: true,
          metadata: true,
        },
      });
      
      const notificationMap = new Map(
        notifications.map(notification => [notification.id, notification])
      );
      return notificationIds.map(id => notificationMap.get(id) || null);
    },
    {
      cacheKeyFn: (key) => key,
      maxBatchSize: 100,
    }
  );
}

function createAuditLogLoader(prisma: PrismaClient) {
  return new DataLoader<string, any>(
    async (auditLogIds) => {
      const auditLogs = await prisma.auditLog.findMany({
        where: { id: { in: [...auditLogIds] } },
        include: {
          user: true,
          metadata: true,
        },
      });
      
      const auditLogMap = new Map(
        auditLogs.map(auditLog => [auditLog.id, auditLog])
      );
      return auditLogIds.map(id => auditLogMap.get(id) || null);
    },
    {
      cacheKeyFn: (key) => key,
      maxBatchSize: 100,
    }
  );
}

// Advanced DataLoader with caching and metrics
export class EnhancedDataLoader<K, V> extends DataLoader<K, V> {
  private hits = 0;
  private misses = 0;
  private batchCount = 0;
  
  constructor(
    batchLoadFn: DataLoader.BatchLoadFn<K, V>,
    options?: DataLoader.Options<K, V>
  ) {
    const wrappedBatchLoadFn: DataLoader.BatchLoadFn<K, V> = async (keys) => {
      this.batchCount++;
      const startTime = Date.now();
      
      try {
        const results = await batchLoadFn(keys);
        const duration = Date.now() - startTime;
        
        // Track metrics
        results.forEach(result => {
          if (result !== null && result !== undefined) {
            this.hits++;
          } else {
            this.misses++;
          }
        });
        
        // Log slow queries
        if (duration > 100) {
          console.warn(`Slow DataLoader batch: ${duration}ms for ${keys.length} keys`);
        }
        
        return results;
      } catch (error) {
        console.error('DataLoader batch error:', error);
        throw error;
      }
    };
    
    super(wrappedBatchLoadFn, options);
  }
  
  getMetrics() {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses) || 0,
      batchCount: this.batchCount,
    };
  }
  
  resetMetrics() {
    this.hits = 0;
    this.misses = 0;
    this.batchCount = 0;
  }
}