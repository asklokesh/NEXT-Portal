import { prisma } from '@/lib/prisma';
import { dashboardCache, CacheKeys } from './cache';
import { costService } from '../cost/CostService';
import { dashboardCache, CacheKeys } from './cache';

export interface ServiceMetrics {
    entityRef: string;
    name: string;
    namespace: string;
    type: string;
    owner: string;
    health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown' | 'error' | 'warning'; // Broaden to support all
    metrics: {
        cpu: number;
        memory: number;
        requestsPerSecond: number;
        errorRate: number;
        responseTime: number;
        activeConnections: number;
        uptime: number;
        lastDeployment?: string;
    };
    status: {
        level: string;
        message: string;
        items: Array<{
            type: string;
            level: string;
            message: string;
        }>;
    };
}

export interface DashboardMetrics {
    services: ServiceMetrics[];
    summary: {
        totalServices: number;
        healthyServices: number;
        degradedServices: number;
        unhealthyServices: number;
        totalRequests: number;
        avgResponseTime: number;
        avgErrorRate: number;
        totalDeployments: number;
    };
    alerts: Array<{
        id: string;
        entityRef: string;
        severity: 'info' | 'warning' | 'error' | 'critical';
        title: string;
        message: string;
        timestamp: string;
    }>;
    deployments: Array<{
        id: string;
        entityRef: string;
        version: string;
        status: 'pending' | 'in_progress' | 'success' | 'failed';
        timestamp: string;
        deployer: string;
    }>;
}

class MetricsService {

    async getServiceMetrics(entityRef: string): Promise<ServiceMetrics> {
        // For MVP, we mock single service fetch or query DB by name
        return {
            entityRef,
            name: entityRef.split('/').pop() || 'unknown',
            namespace: 'default',
            type: 'service',
            owner: 'team-a',
            health: 'healthy',
            metrics: {
                cpu: 45,
                memory: 120,
                requestsPerSecond: 10,
                errorRate: 0.1,
                responseTime: 150,
                activeConnections: 5,
                uptime: 99.9,
                lastDeployment: new Date().toISOString()
            },
            status: { level: 'ok', message: 'Healthy', items: [] }
        };
    }

    async getDashboardMetrics(entityRefs?: string[], filterByOwnership: boolean = false): Promise<DashboardMetrics> {
        let servicesList;

        if (entityRefs && entityRefs.length > 0) {
            // Ideally filter by ID, for now fetch all
            servicesList = await prisma.service.findMany();
        } else {
            servicesList = await prisma.service.findMany();
        }

        // Map Prisma Service to ServiceMetrics
        const services: ServiceMetrics[] = servicesList.map((svc, index) => {
            // Mock status based on arbitrary logic or random for demo diversity if needed, 
            // but let's make it slightly deterministic
            const isHealthy = index % 5 !== 0; 
            const health = isHealthy ? 'healthy' : 'unhealthy';
            
            return {
                entityRef: `service:${svc.name}`,
                name: svc.name,
                namespace: 'default',
                type: svc.type.toString().toLowerCase(),
                owner: svc.ownerId || 'unknown',
                health: health, // diverse status based on score
                metrics: {
                    cpu: Math.random() * 80,
                    memory: Math.random() * 80,
                    requestsPerSecond: Math.floor(Math.random() * 10000),
                    errorRate: isHealthy ? 0.1 : 5.0,
                    responseTime: Math.floor(Math.random() * 100) + 20,
                    activeConnections: Math.floor(Math.random() * 50),
                    uptime: 99.9,
                    lastDeployment: svc.updatedAt.toISOString()
                },
                status: {
                    level: isHealthy ? 'ok' : 'error',
                    message: isHealthy ? 'Operating normally' : 'Critical issues',
                    items: []
                }
            };
        });

        const summary = this.calculateSummary(services);
        const alerts = this.generateAlerts(services);
        const deployments = this.generateDeployments(services);

        return {
            services,
            summary,
            alerts,
            deployments
        };
    }

    private calculateSummary(services: ServiceMetrics[]): DashboardMetrics['summary'] {
        const healthCounts = services.reduce((acc, service) => {
            acc[service.health] = (acc[service.health] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const totalRequests = services.reduce((sum, s) => sum + s.metrics.requestsPerSecond, 0);
        const avgResponseTime = services.length > 0
            ? services.reduce((sum, s) => sum + s.metrics.responseTime, 0) / services.length
            : 0;
        const avgErrorRate = services.length > 0
            ? services.reduce((sum, s) => sum + s.metrics.errorRate, 0) / services.length
            : 0;

        return {
            totalServices: services.length,
            healthyServices: healthCounts['healthy'] || 0,
            degradedServices: healthCounts['degraded'] || 0,
            unhealthyServices: healthCounts['unhealthy'] || 0,
            totalRequests: Math.round(totalRequests),
            avgResponseTime: Math.round(avgResponseTime),
            avgErrorRate: parseFloat(avgErrorRate.toFixed(2)),
            totalDeployments: Math.floor(Math.random() * 10) + 5
        };
    }

    private generateAlerts(services: ServiceMetrics[]): DashboardMetrics['alerts'] {
        const alerts: DashboardMetrics['alerts'] = [];
        services.forEach(service => {
            if (service.health === 'unhealthy' || service.metrics.errorRate > 1.5) {
                alerts.push({
                    id: `alert-${service.entityRef}-error`,
                    entityRef: service.entityRef,
                    severity: 'error',
                    title: 'High Error Rate',
                    message: `Error rate is ${service.metrics.errorRate.toFixed(1)}%`,
                    timestamp: new Date().toISOString()
                });
            }
        });
        return alerts.slice(0, 10);
    }

    private generateDeployments(services: ServiceMetrics[]): DashboardMetrics['deployments'] {
        const deployments: DashboardMetrics['deployments'] = [];
        const recentServices = services.slice(0, 5);
        recentServices.forEach((service, index) => {
            deployments.push({
                id: `deploy-${service.entityRef}-${Date.now()}`,
                entityRef: service.entityRef,
                version: `v1.${Math.floor(Math.random() * 20)}`,
                status: index === 0 ? 'in_progress' : 'success',
                timestamp: new Date().toISOString(),
                deployer: 'autobot'
            });
        });
        return deployments;
    }

    async getWidgetData(widgetType: string, config: any): Promise<any> {
        switch (widgetType) {
            case 'metric':
                return this.getMetricWidgetData(config);
            case 'chart':
                return this.getChartWidgetData(config);
            case 'serviceHealth':
                return this.getServiceHealthWidgetData(config);
            case 'deployment':
                return this.getDeploymentWidgetData(config);
            case 'table':
        return this.getTableWidgetData(config);
      case 'clusterStatus':
        return this.getClusterStatusWidgetData(config);
      case 'cost':
        return this.getCostWidgetData(config);
      default:
        throw new Error(`Unknown widget type: ${widgetType}`);
    }
  }

  private async getCostWidgetData(config: any): Promise<any> {
      // Fetch some services to generate cost for
      const services = await prisma.service.findMany({ take: 5 });
      const costs = await costService.getCostsForServices(services);
      
      const totalCost = costs.reduce((sum, c) => sum + c.totalMonthlyCost, 0);
      
      return {
          totalMonthlyCost: totalCost,
          currency: 'USD',
          topSpenders: costs.sort((a, b) => b.totalMonthlyCost - a.totalMonthlyCost).map(c => ({
              name: c.entityRef.replace('service:', ''),
              cost: c.totalMonthlyCost,
              trend: c.trend
          }))
      };
  }

  private async getClusterStatusWidgetData(config: any): Promise<any> {
    const clusters = await prisma.service.findMany({
        where: {
            type: {
                equals: 'INFRASTRUCTURE', 
                mode: 'insensitive' // Ensure we catch 'infrastructure' or 'INFRASTRUCTURE'
            }
        }
    });

    if (clusters.length === 0) {
        // Return some mock data if no clusters found, to show the widget working
        return {
            clusters: [
                { name: 'demo-cluster-us-east', region: 'us-east-1', nodes: 15, status: 'active' },
                { name: 'demo-cluster-eu-west', region: 'eu-west-1', nodes: 8, status: 'active' }
            ]
        };
    }

    return {
        clusters: clusters.map(c => ({
            name: c.name,
            region: c.tags.find(t => t.startsWith('us-') || t.startsWith('eu-') || t.startsWith('ap-')) || 'unknown',
            nodes: Math.floor(Math.random() * 50) + 5, // Mock node count as it's not in DB yet
            status: 'active'
        }))
    };
  }

  private async getMetricWidgetData(config: any): Promise<any> {
        const metrics = await this.getDashboardMetrics();
        const metric = config.metric || 'totalServices';
        switch (metric) {
            case 'totalServices':
                return {
                    value: metrics.summary.totalServices,
                    previousValue: metrics.summary.totalServices - 1,
                    trend: 'up',
                    changePercent: 10
                };
            case 'healthyServices':
                return {
                    value: metrics.summary.healthyServices,
                    previousValue: metrics.summary.healthyServices,
                    trend: 'neutral',
                    changePercent: 0
                };
            case 'errorRate':
                return {
                    value: metrics.summary.avgErrorRate,
                    previousValue: metrics.summary.avgErrorRate + 0.1,
                    trend: 'down',
                    changePercent: -5
                };
            default:
                return { value: 0 };
        }
    }

    private async getChartWidgetData(config: any): Promise<any> {
        return { data: [] }; // Mock empty chart
    }

    private async getServiceHealthWidgetData(config: any): Promise<any> {
        const metrics = await this.getDashboardMetrics();
        return {
            services: metrics.services.map(s => ({
                id: s.entityRef,
                name: s.name,
                status: s.health,
                uptime: s.metrics.uptime,
                responseTime: s.metrics.responseTime,
                errorRate: s.metrics.errorRate,
                lastChecked: new Date()
            }))
        };
    }

    private async getDeploymentWidgetData(config: any): Promise<any> {
        const metrics = await this.getDashboardMetrics();
        return { deployments: metrics.deployments };
    }

    private async getTableWidgetData(config: any): Promise<any> {
        const metrics = await this.getDashboardMetrics();
        return {
            columns: [
                { key: 'name', label: 'Service' },
                { key: 'health', label: 'Health' },
                { key: 'requests', label: 'Req/s' }
            ],
            rows: metrics.services.map(s => ({
                name: s.name,
                health: s.health,
                requests: s.metrics.requestsPerSecond.toFixed(0)
            }))
        };
    }
}

export const metricsService = new MetricsService();