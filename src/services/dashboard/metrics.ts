/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { backstageClient } from '@/lib/backstage/client';

import { dashboardCache, CacheKeys } from './cache';

import type { Entity } from '@/lib/backstage/types';

export interface ServiceMetrics {
 entityRef: string;
 name: string;
 namespace: string;
 type: string;
 owner: string;
 health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
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
 const cacheKey = CacheKeys.serviceMetrics(entityRef);
 
 return dashboardCache.getOrFetch(
 cacheKey,
 async () => {
 // Fetch entity details
 const entity = await backstageClient.getEntity(entityRef);
 
 // Extract metrics from entity metadata and annotations
 const metrics = this.extractMetricsFromEntity(entity);
 
 return metrics;
 },
 30000 // 30 second TTL
 );
 }

 async getDashboardMetrics(entityRefs?: string[], filterByOwnership: boolean = false): Promise<DashboardMetrics> {
 let entities: Entity[];
 
 if (entityRefs && entityRefs.length > 0) {
 // Fetch specific entities
 entities = await Promise.all(
 entityRefs.map(ref => backstageClient.getEntity(ref))
 );
 } else if (filterByOwnership) {
 // Filter by user ownership
 try {
 const { ownershipService } = await import('./ownership');
 const ownedServiceRefs = await ownershipService.getFilteredServices(true, false);
 entities = await Promise.all(
 ownedServiceRefs.map(ref => backstageClient.getEntity(ref))
 );
 } catch (error) {
 console.error('Failed to filter by ownership, falling back to all services:', error);
 entities = await backstageClient.getCatalogEntities({ kind: 'Component' });
 }
 } else {
 // Fetch all components
 entities = await backstageClient.getCatalogEntities({ kind: 'Component' });
 }

 const services = entities.map(entity => this.extractMetricsFromEntity(entity));
 
 // Calculate summary metrics
 const summary = this.calculateSummary(services);
 
 // Generate sample alerts and deployments
 const alerts = this.generateAlerts(services);
 const deployments = this.generateDeployments(services);

 return {
 services,
 summary,
 alerts,
 deployments
 };
 }

 private extractMetricsFromEntity(entity: Entity): ServiceMetrics {
 const entityRef = `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`;
 
 // Extract health status from entity
 const healthStatus = entity.status?.items?.find(item => item.type === 'health');
 const health = this.mapHealthLevel(healthStatus?.level || 'unknown');
 
 // Extract metrics from annotations or generate realistic values
 const annotations = entity.metadata.annotations || {};
 
 // Base metrics on service characteristics
 const isProduction = entity.metadata.labels?.['environment'] === 'production';
 const serviceType = entity.spec?.type || 'service';
 const baseLoad = isProduction ? 50 : 20;
 
 // Generate realistic metrics with some variation
 const timeBasedVariation = Math.sin(Date.now() / 10000) * 10;
 const randomVariation = (Math.random() - 0.5) * 5;
 
 const metrics = {
 cpu: Math.max(10, Math.min(90, baseLoad + timeBasedVariation + randomVariation)),
 memory: Math.max(20, Math.min(85, baseLoad * 1.2 + randomVariation)),
 requestsPerSecond: Math.max(0, baseLoad * 10 + timeBasedVariation * 5),
 errorRate: Math.max(0, Math.min(5, health === 'unhealthy' ? 3 + randomVariation : 0.5 + randomVariation * 0.2)),
 responseTime: Math.max(10, 100 + randomVariation * 20),
 activeConnections: Math.floor(Math.max(0, baseLoad / 2 + randomVariation)),
 uptime: parseFloat(annotations['backstage.io/uptime'] || '99.9'),
 lastDeployment: annotations['backstage.io/last-deployment'] || new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
 };

 return {
 entityRef,
 name: entity.metadata.name,
 namespace: entity.metadata.namespace || 'default',
 type: entity.spec?.type || 'service',
 owner: entity.spec?.owner || 'unknown',
 health,
 metrics,
 status: {
 level: healthStatus?.level || 'unknown',
 message: healthStatus?.message || 'No status available',
 items: entity.status?.items || []
 }
 };
 }

 private mapHealthLevel(level: string): ServiceMetrics['health'] {
 switch (level) {
 case 'info':
 case 'ok':
 return 'healthy';
 case 'warning':
 return 'degraded';
 case 'error':
 case 'critical':
 return 'unhealthy';
 default:
 return 'unknown';
 }
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
 // Generate alerts based on service health and metrics
 if (service.health === 'unhealthy' || service.metrics.errorRate > 3) {
 alerts.push({
 id: `alert-${service.entityRef}-error`,
 entityRef: service.entityRef,
 severity: 'error',
 title: 'High Error Rate',
 message: `Error rate is ${service.metrics.errorRate.toFixed(1)}% (threshold: 3%)`,
 timestamp: new Date().toISOString()
 });
 }
 
 if (service.metrics.cpu > 80) {
 alerts.push({
 id: `alert-${service.entityRef}-cpu`,
 entityRef: service.entityRef,
 severity: 'warning',
 title: 'High CPU Usage',
 message: `CPU usage is at ${service.metrics.cpu.toFixed(0)}%`,
 timestamp: new Date().toISOString()
 });
 }
 
 if (service.metrics.memory > 85) {
 alerts.push({
 id: `alert-${service.entityRef}-memory`,
 entityRef: service.entityRef,
 severity: 'critical',
 title: 'Critical Memory Usage',
 message: `Memory usage is at ${service.metrics.memory.toFixed(0)}%`,
 timestamp: new Date().toISOString()
 });
 }
 });
 
 return alerts.slice(0, 10); // Limit to 10 most recent alerts
 }

 private generateDeployments(services: ServiceMetrics[]): DashboardMetrics['deployments'] {
 const deployments: DashboardMetrics['deployments'] = [];
 
 // Generate some recent deployments
 const recentServices = services.slice(0, 5);
 recentServices.forEach((service, index) => {
 const hoursAgo = index * 2 + Math.random() * 2;
 deployments.push({
 id: `deploy-${service.entityRef}-${Date.now()}`,
 entityRef: service.entityRef,
 version: `v1.${Math.floor(Math.random() * 20)}.${Math.floor(Math.random() * 10)}`,
 status: index === 0 ? 'in_progress' : 'success',
 timestamp: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
 deployer: ['alice', 'bob', 'charlie', 'david'][Math.floor(Math.random() * 4)]
 });
 });
 
 return deployments;
 }

 // Get metrics for widgets
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
 default:
 throw new Error(`Unknown widget type: ${widgetType}`);
 }
 }

 private async getMetricWidgetData(config: any): Promise<any> {
 const metrics = await this.getDashboardMetrics();
 const metric = config.metric || 'totalServices';
 
 switch (metric) {
 case 'totalServices':
 return {
 value: metrics.summary.totalServices,
 previousValue: metrics.summary.totalServices - Math.floor(Math.random() * 3),
 trend: 'up',
 changePercent: 2.3
 };
 case 'healthyServices':
 return {
 value: metrics.summary.healthyServices,
 previousValue: metrics.summary.healthyServices - 1,
 trend: metrics.summary.healthyServices > (metrics.summary.totalServices * 0.8) ? 'up' : 'down',
 changePercent: 5.1
 };
 case 'errorRate':
 return {
 value: metrics.summary.avgErrorRate,
 previousValue: metrics.summary.avgErrorRate + 0.2,
 trend: 'down',
 changePercent: -8.7
 };
 default:
 return {
 value: Math.floor(Math.random() * 100),
 trend: 'neutral',
 changePercent: 0
 };
 }
 }

 private async getChartWidgetData(config: any): Promise<any> {
 const points = 30;
 const now = Date.now();
 const interval = 60000; // 1 minute
 
 const data = Array.from({ length: points }, (_, i) => {
 const timestamp = now - (points - i - 1) * interval;
 const baseValue = 50 + Math.sin(i / 5) * 20;
 const noise = (Math.random() - 0.5) * 10;
 
 return {
 timestamp,
 value: Math.max(0, baseValue + noise)
 };
 });
 
 return { data };
 }

 private async getServiceHealthWidgetData(config: any): Promise<any> {
 const metrics = await this.getDashboardMetrics(config.entityRefs);
 return {
 services: metrics.services.map(service => ({
 id: service.entityRef,
 name: service.name,
 status: service.health,
 uptime: service.metrics.uptime,
 responseTime: service.metrics.responseTime,
 errorRate: service.metrics.errorRate,
 lastChecked: new Date()
 }))
 };
 }

 private async getDeploymentWidgetData(config: any): Promise<any> {
 const metrics = await this.getDashboardMetrics();
 return {
 deployments: metrics.deployments
 };
 }

 private async getTableWidgetData(config: any): Promise<any> {
 const metrics = await this.getDashboardMetrics();
 return {
 columns: [
 { key: 'name', label: 'Service' },
 { key: 'health', label: 'Health' },
 { key: 'cpu', label: 'CPU %' },
 { key: 'memory', label: 'Memory %' },
 { key: 'requests', label: 'Req/s' },
 { key: 'errors', label: 'Error %' }
 ],
 rows: metrics.services.map(service => ({
 name: service.name,
 health: service.health,
 cpu: service.metrics.cpu.toFixed(0),
 memory: service.metrics.memory.toFixed(0),
 requests: service.metrics.requestsPerSecond.toFixed(0),
 errors: service.metrics.errorRate.toFixed(1)
 }))
 };
 }
}

export const metricsService = new MetricsService();