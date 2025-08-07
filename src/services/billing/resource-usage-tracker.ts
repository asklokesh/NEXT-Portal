import { PrismaClient, ResourceType, Prisma } from '@prisma/client';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as process from 'process';
import { performance } from 'perf_hooks';

interface ResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  apiCalls: number;
  containerCount: number;
  activeUsers: number;
  pluginExecutions: number;
  buildMinutes: number;
  deploymentCount: number;
}

interface UsageRecord {
  organizationId: string;
  pluginId?: string;
  subscriptionId?: string;
  metrics: ResourceMetrics;
  timestamp: Date;
  period: 'hourly' | 'daily' | 'monthly';
}

interface UsageAlert {
  organizationId: string;
  resourceType: ResourceType;
  currentUsage: number;
  limit: number;
  percentage: number;
  severity: 'info' | 'warning' | 'critical';
}

export class ResourceUsageTracker extends EventEmitter {
  private prisma: PrismaClient;
  private metricsCollectors: Map<string, NodeJS.Timer>;
  private usageCache: Map<string, ResourceMetrics>;
  private alertThresholds: Map<string, number>;

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
    this.metricsCollectors = new Map();
    this.usageCache = new Map();
    this.alertThresholds = new Map([
      ['cpu', 80],
      ['memory', 85],
      ['disk', 90],
      ['api', 95],
    ]);
  }

  /**
   * Start tracking resource usage for an organization
   */
  async startTracking(organizationId: string, interval: number = 60000): Promise<void> {
    if (this.metricsCollectors.has(organizationId)) {
      console.log(`Already tracking organization: ${organizationId}`);
      return;
    }

    const collector = setInterval(async () => {
      await this.collectMetrics(organizationId);
    }, interval);

    this.metricsCollectors.set(organizationId, collector);
    console.log(`Started tracking organization: ${organizationId}`);
  }

  /**
   * Stop tracking resource usage for an organization
   */
  stopTracking(organizationId: string): void {
    const collector = this.metricsCollectors.get(organizationId);
    if (collector) {
      clearInterval(collector);
      this.metricsCollectors.delete(organizationId);
      console.log(`Stopped tracking organization: ${organizationId}`);
    }
  }

  /**
   * Collect metrics for an organization
   */
  private async collectMetrics(organizationId: string): Promise<void> {
    try {
      const metrics = await this.gatherResourceMetrics(organizationId);
      await this.recordUsage(organizationId, metrics);
      await this.checkUsageLimits(organizationId, metrics);
      this.usageCache.set(organizationId, metrics);
    } catch (error) {
      console.error(`Error collecting metrics for ${organizationId}:`, error);
      this.emit('error', { organizationId, error });
    }
  }

  /**
   * Gather actual resource metrics
   */
  private async gatherResourceMetrics(organizationId: string): Promise<ResourceMetrics> {
    // CPU Usage
    const cpuUsage = this.getCPUUsage();

    // Memory Usage
    const memoryUsage = this.getMemoryUsage();

    // Disk Usage (simplified - would need actual storage tracking)
    const diskUsage = await this.getDiskUsage(organizationId);

    // Network Usage (simplified - would need actual network monitoring)
    const { networkIn, networkOut } = await this.getNetworkUsage(organizationId);

    // API Calls
    const apiCalls = await this.getAPICallCount(organizationId);

    // Container Count
    const containerCount = await this.getContainerCount(organizationId);

    // Active Users
    const activeUsers = await this.getActiveUserCount(organizationId);

    // Plugin Executions
    const pluginExecutions = await this.getPluginExecutionCount(organizationId);

    // Build Minutes
    const buildMinutes = await this.getBuildMinutes(organizationId);

    // Deployment Count
    const deploymentCount = await this.getDeploymentCount(organizationId);

    return {
      cpuUsage,
      memoryUsage,
      diskUsage,
      networkIn,
      networkOut,
      apiCalls,
      containerCount,
      activeUsers,
      pluginExecutions,
      buildMinutes,
      deploymentCount,
    };
  }

  /**
   * Get CPU usage percentage
   */
  private getCPUUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return Math.min(100, Math.max(0, usage));
  }

  /**
   * Get memory usage percentage
   */
  private getMemoryUsage(): number {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    return Math.round((usedMemory / totalMemory) * 100);
  }

  /**
   * Get disk usage for organization (GB)
   */
  private async getDiskUsage(organizationId: string): Promise<number> {
    // Query database for storage used by organization's services
    const services = await this.prisma.service.count({
      where: {
        team: {
          members: {
            some: {
              user: {
                // This would need proper organization association
                id: { not: undefined }
              }
            }
          }
        }
      }
    });

    // Simplified calculation - would need actual file storage tracking
    return services * 0.5; // Assume 0.5 GB per service
  }

  /**
   * Get network usage for organization (GB)
   */
  private async getNetworkUsage(organizationId: string): Promise<{ networkIn: number; networkOut: number }> {
    // This would integrate with actual network monitoring tools
    // For now, return mock data based on API usage
    const apiCalls = await this.getAPICallCount(organizationId);
    
    return {
      networkIn: apiCalls * 0.001, // 1 KB per API call average
      networkOut: apiCalls * 0.005, // 5 KB per API call average
    };
  }

  /**
   * Get API call count for organization
   */
  private async getAPICallCount(organizationId: string): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Count audit logs as a proxy for API calls
    const apiCallCount = await this.prisma.auditLog.count({
      where: {
        timestamp: { gte: oneDayAgo },
        // Would need proper organization association
      }
    });

    return apiCallCount;
  }

  /**
   * Get container count for organization
   */
  private async getContainerCount(organizationId: string): Promise<number> {
    // Count active plugin deployments
    const deployments = await this.prisma.pluginDeployment.count({
      where: {
        status: 'DEPLOYED',
        // Would need proper organization association
      }
    });

    return deployments;
  }

  /**
   * Get active user count for organization
   */
  private async getActiveUserCount(organizationId: string): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const activeUsers = await this.prisma.user.count({
      where: {
        lastLogin: { gte: oneDayAgo },
        // Would need proper organization association
      }
    });

    return activeUsers;
  }

  /**
   * Get plugin execution count for organization
   */
  private async getPluginExecutionCount(organizationId: string): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const executions = await this.prisma.templateExecution.count({
      where: {
        startedAt: { gte: oneDayAgo },
        // Would need proper organization association
      }
    });

    return executions;
  }

  /**
   * Get build minutes for organization
   */
  private async getBuildMinutes(organizationId: string): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const deployments = await this.prisma.deployment.findMany({
      where: {
        startedAt: { gte: oneDayAgo },
        completedAt: { not: null },
        // Would need proper organization association
      },
      select: {
        startedAt: true,
        completedAt: true,
      }
    });

    let totalMinutes = 0;
    deployments.forEach(deployment => {
      if (deployment.completedAt) {
        const duration = deployment.completedAt.getTime() - deployment.startedAt.getTime();
        totalMinutes += duration / (1000 * 60); // Convert to minutes
      }
    });

    return Math.round(totalMinutes);
  }

  /**
   * Get deployment count for organization
   */
  private async getDeploymentCount(organizationId: string): Promise<number> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const deployments = await this.prisma.deployment.count({
      where: {
        startedAt: { gte: oneDayAgo },
        // Would need proper organization association
      }
    });

    return deployments;
  }

  /**
   * Record usage in database
   */
  private async recordUsage(organizationId: string, metrics: ResourceMetrics): Promise<void> {
    const now = new Date();
    
    // Get organization's subscription
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        organizationId,
        status: 'ACTIVE',
      }
    });

    // Record different resource types
    const usageRecords: Prisma.ResourceUsageCreateManyInput[] = [
      {
        organizationId,
        subscriptionId: subscription?.id,
        resourceType: ResourceType.COMPUTE_HOURS,
        quantity: new Prisma.Decimal(metrics.cpuUsage / 100), // Convert to hours
        unit: 'hours',
        cost: new Prisma.Decimal(0), // Will be calculated by billing engine
        period: now,
      },
      {
        organizationId,
        subscriptionId: subscription?.id,
        resourceType: ResourceType.STORAGE_GB,
        quantity: new Prisma.Decimal(metrics.diskUsage),
        unit: 'GB',
        cost: new Prisma.Decimal(0),
        period: now,
      },
      {
        organizationId,
        subscriptionId: subscription?.id,
        resourceType: ResourceType.NETWORK_GB,
        quantity: new Prisma.Decimal(metrics.networkIn + metrics.networkOut),
        unit: 'GB',
        cost: new Prisma.Decimal(0),
        period: now,
      },
      {
        organizationId,
        subscriptionId: subscription?.id,
        resourceType: ResourceType.API_CALLS,
        quantity: new Prisma.Decimal(metrics.apiCalls),
        unit: 'calls',
        cost: new Prisma.Decimal(0),
        period: now,
      },
      {
        organizationId,
        subscriptionId: subscription?.id,
        resourceType: ResourceType.CONTAINERS,
        quantity: new Prisma.Decimal(metrics.containerCount),
        unit: 'containers',
        cost: new Prisma.Decimal(0),
        period: now,
      },
      {
        organizationId,
        subscriptionId: subscription?.id,
        resourceType: ResourceType.USERS,
        quantity: new Prisma.Decimal(metrics.activeUsers),
        unit: 'users',
        cost: new Prisma.Decimal(0),
        period: now,
      },
    ];

    await this.prisma.resourceUsage.createMany({
      data: usageRecords,
    });

    this.emit('usage-recorded', { organizationId, metrics, timestamp: now });
  }

  /**
   * Check usage against limits and trigger alerts
   */
  private async checkUsageLimits(organizationId: string, metrics: ResourceMetrics): Promise<void> {
    // Get organization's subscription and plan
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        organizationId,
        status: 'ACTIVE',
      },
      include: {
        plan: true,
      }
    });

    if (!subscription || !subscription.plan.limits) {
      return;
    }

    const limits = subscription.plan.limits as any;
    const alerts: UsageAlert[] = [];

    // Check compute usage
    if (limits.computeHours) {
      const usage = metrics.cpuUsage;
      const percentage = (usage / limits.computeHours) * 100;
      if (percentage > this.alertThresholds.get('cpu')!) {
        alerts.push({
          organizationId,
          resourceType: ResourceType.COMPUTE_HOURS,
          currentUsage: usage,
          limit: limits.computeHours,
          percentage,
          severity: percentage > 95 ? 'critical' : percentage > 85 ? 'warning' : 'info',
        });
      }
    }

    // Check storage usage
    if (limits.storageGB) {
      const percentage = (metrics.diskUsage / limits.storageGB) * 100;
      if (percentage > this.alertThresholds.get('disk')!) {
        alerts.push({
          organizationId,
          resourceType: ResourceType.STORAGE_GB,
          currentUsage: metrics.diskUsage,
          limit: limits.storageGB,
          percentage,
          severity: percentage > 95 ? 'critical' : percentage > 85 ? 'warning' : 'info',
        });
      }
    }

    // Check API calls
    if (limits.apiCalls) {
      const percentage = (metrics.apiCalls / limits.apiCalls) * 100;
      if (percentage > this.alertThresholds.get('api')!) {
        alerts.push({
          organizationId,
          resourceType: ResourceType.API_CALLS,
          currentUsage: metrics.apiCalls,
          limit: limits.apiCalls,
          percentage,
          severity: percentage > 95 ? 'critical' : percentage > 85 ? 'warning' : 'info',
        });
      }
    }

    // Create billing alerts in database
    for (const alert of alerts) {
      await this.createBillingAlert(alert);
    }

    if (alerts.length > 0) {
      this.emit('usage-alerts', alerts);
    }
  }

  /**
   * Create billing alert in database
   */
  private async createBillingAlert(alert: UsageAlert): Promise<void> {
    await this.prisma.billingAlert.create({
      data: {
        organizationId: alert.organizationId,
        type: 'UNUSUAL_USAGE',
        threshold: new Prisma.Decimal(alert.limit),
        currentValue: new Prisma.Decimal(alert.currentUsage),
        message: `${alert.resourceType} usage at ${alert.percentage.toFixed(1)}% of limit`,
        severity: alert.severity === 'critical' ? 'CRITICAL' : 
                  alert.severity === 'warning' ? 'WARNING' : 'INFO',
      }
    });
  }

  /**
   * Get current usage for an organization
   */
  async getCurrentUsage(organizationId: string): Promise<ResourceMetrics | null> {
    return this.usageCache.get(organizationId) || null;
  }

  /**
   * Get usage history for an organization
   */
  async getUsageHistory(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    resourceType?: ResourceType
  ): Promise<any[]> {
    const where: Prisma.ResourceUsageWhereInput = {
      organizationId,
      period: {
        gte: startDate,
        lte: endDate,
      }
    };

    if (resourceType) {
      where.resourceType = resourceType;
    }

    const usage = await this.prisma.resourceUsage.findMany({
      where,
      orderBy: { period: 'asc' },
    });

    return usage;
  }

  /**
   * Get usage summary for an organization
   */
  async getUsageSummary(
    organizationId: string,
    period: 'daily' | 'weekly' | 'monthly'
  ): Promise<any> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const usage = await this.prisma.resourceUsage.groupBy({
      by: ['resourceType'],
      where: {
        organizationId,
        period: {
          gte: startDate,
          lte: now,
        }
      },
      _sum: {
        quantity: true,
        cost: true,
      },
      _avg: {
        quantity: true,
      },
      _max: {
        quantity: true,
      },
    });

    return {
      period,
      startDate,
      endDate: now,
      summary: usage,
    };
  }

  /**
   * Cleanup old usage records
   */
  async cleanupOldRecords(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await this.prisma.resourceUsage.deleteMany({
      where: {
        period: { lt: cutoffDate },
      }
    });

    console.log(`Cleaned up ${result.count} old usage records`);
    return result.count;
  }

  /**
   * Stop all tracking
   */
  stopAll(): void {
    for (const [orgId, collector] of this.metricsCollectors) {
      clearInterval(collector);
    }
    this.metricsCollectors.clear();
    this.usageCache.clear();
    console.log('Stopped all resource tracking');
  }
}