import { prisma } from './client';
import { cache, cacheKeys } from '../cache/redis';
import type { Prisma } from '@prisma/client';

/**
 * Optimized query utilities with caching and efficient loading
 */

// Service queries
export const serviceQueries = {
 /**
 * Get services with pagination and filtering
 */
 async getServices({
 page = 1,
 limit = 50,
 filters = {},
 include = {},
 }: {
 page?: number;
 limit?: number;
 filters?: {
 type?: string;
 lifecycle?: string;
 teamId?: string;
 ownerId?: string;
 tags?: string[];
 search?: string;
 };
 include?: Prisma.ServiceInclude;
 }) {
 const skip = (page - 1) * limit;
 
 // Build where clause
 const where: Prisma.ServiceWhereInput = {
 isActive: true,
 ...(filters.type && { type: filters.type }),
 ...(filters.lifecycle && { lifecycle: filters.lifecycle }),
 ...(filters.teamId && { teamId: filters.teamId }),
 ...(filters.ownerId && { ownerId: filters.ownerId }),
 ...(filters.tags?.length && { tags: { hasSome: filters.tags } }),
 ...(filters.search && {
 OR: [
 { name: { contains: filters.search, mode: 'insensitive' } },
 { displayName: { contains: filters.search, mode: 'insensitive' } },
 { description: { contains: filters.search, mode: 'insensitive' } },
 ],
 }),
 };
 
 // Try cache first
 const cacheKey = `services:${JSON.stringify({ page, limit, filters })}`;
 const cached = await cache.get(cacheKey);
 if (cached) return cached;
 
 // Parallel queries for better performance
 const [services, total] = await Promise.all([
 prisma.service.findMany({
 where,
 skip,
 take: limit,
 orderBy: { createdAt: 'desc' },
 include: {
 owner: {
 select: { id: true, name: true, email: true, avatar: true },
 },
 team: {
 select: { id: true, name: true, displayName: true },
 },
 ...include,
 },
 }),
 prisma.service.count({ where }),
 ]);
 
 const result = {
 data: services,
 pagination: {
 page,
 limit,
 total,
 totalPages: Math.ceil(total / limit),
 },
 };
 
 // Cache for 5 minutes
 await cache.set(cacheKey, result, 300);
 
 return result;
 },
 
 /**
 * Get service by ID with relations
 */
 async getServiceById(id: string, include?: Prisma.ServiceInclude) {
 const cacheKey = cacheKeys.service(id);
 const cached = await cache.get(cacheKey);
 if (cached) return cached;
 
 const service = await prisma.service.findUnique({
 where: { id },
 include: {
 owner: {
 select: { id: true, name: true, email: true, avatar: true },
 },
 team: {
 select: { id: true, name: true, displayName: true },
 },
 dependencies: {
 include: {
 dependsOn: {
 select: { id: true, name: true, displayName: true, type: true },
 },
 },
 },
 dependents: {
 include: {
 service: {
 select: { id: true, name: true, displayName: true, type: true },
 },
 },
 },
 ...include,
 },
 });
 
 if (service) {
 await cache.set(cacheKey, service, 600); // 10 minutes
 }
 
 return service;
 },
 
 /**
 * Get service health summary
 */
 async getServiceHealth(serviceId: string, hours = 24) {
 const cacheKey = `service:${serviceId}:health:${hours}h`;
 const cached = await cache.get(cacheKey);
 if (cached) return cached;
 
 const since = new Date();
 since.setHours(since.getHours() - hours);
 
 const healthChecks = await prisma.serviceHealthCheck.findMany({
 where: { serviceId, isEnabled: true },
 include: {
 results: {
 where: { checkedAt: { gte: since } },
 orderBy: { checkedAt: 'desc' },
 take: 100,
 },
 },
 });
 
 // Calculate health metrics
 const summary = healthChecks.map(check => {
 const results = check.results;
 const healthy = results.filter(r => r.status === 'HEALTHY').length;
 const total = results.length;
 const uptime = total > 0 ? (healthy / total) * 100 : 0;
 const avgResponseTime = results.reduce((acc, r) => acc + (r.responseTime || 0), 0) / total || 0;
 
 return {
 id: check.id,
 name: check.name,
 type: check.type,
 uptime,
 avgResponseTime,
 lastCheck: results[0],
 };
 });
 
 await cache.set(cacheKey, summary, 300); // 5 minutes
 
 return summary;
 },
};

// Cost queries
export const costQueries = {
 /**
 * Get aggregated costs by service
 */
 async getServiceCosts({
 startDate,
 endDate,
 groupBy = 'service',
 }: {
 startDate: Date;
 endDate: Date;
 groupBy?: 'service' | 'provider' | 'region';
 }) {
 const cacheKey = `costs:${startDate.toISOString()}:${endDate.toISOString()}:${groupBy}`;
 const cached = await cache.get(cacheKey);
 if (cached) return cached;
 
 // Use raw query for better performance
 const result = await prisma.$queryRaw`
 SELECT 
 ${Prisma.sql`${groupBy}`} as group_key,
 SUM(cost::numeric) as total_cost,
 currency,
 COUNT(DISTINCT serviceId) as service_count,
 COUNT(*) as record_count
 FROM service_costs
 WHERE date >= ${startDate} AND date <= ${endDate}
 GROUP BY ${Prisma.sql`${groupBy}`}, currency
 ORDER BY total_cost DESC
 `;
 
 await cache.set(cacheKey, result, 3600); // 1 hour
 
 return result;
 },
 
 /**
 * Get cost trends
 */
 async getCostTrends({
 serviceId,
 days = 30,
 }: {
 serviceId?: string;
 days?: number;
 }) {
 const endDate = new Date();
 const startDate = new Date();
 startDate.setDate(startDate.getDate() - days);
 
 const cacheKey = `costs:trends:${serviceId || 'all'}:${days}d`;
 const cached = await cache.get(cacheKey);
 if (cached) return cached;
 
 const where: Prisma.ServiceCostWhereInput = {
 date: { gte: startDate, lte: endDate },
 ...(serviceId && { serviceId }),
 };
 
 const costs = await prisma.serviceCost.groupBy({
 by: ['date'],
 where,
 _sum: { cost: true },
 orderBy: { date: 'asc' },
 });
 
 await cache.set(cacheKey, costs, 1800); // 30 minutes
 
 return costs;
 },
};

// Analytics queries
export const analyticsQueries = {
 /**
 * Get deployment frequency
 */
 async getDeploymentFrequency(days = 30) {
 const since = new Date();
 since.setDate(since.getDate() - days);
 
 const cacheKey = `analytics:deployments:${days}d`;
 const cached = await cache.get(cacheKey);
 if (cached) return cached;
 
 const deployments = await prisma.deployment.groupBy({
 by: ['serviceId', 'environment'],
 where: {
 startedAt: { gte: since },
 status: 'DEPLOYED',
 },
 _count: true,
 });
 
 await cache.set(cacheKey, deployments, 1800);
 
 return deployments;
 },
 
 /**
 * Get service metrics summary
 */
 async getMetricsSummary(serviceId: string, hours = 24) {
 const since = new Date();
 since.setHours(since.getHours() - hours);
 
 const cacheKey = `analytics:metrics:${serviceId}:${hours}h`;
 const cached = await cache.get(cacheKey);
 if (cached) return cached;
 
 // Use aggregation for better performance
 const metrics = await prisma.serviceMetric.groupBy({
 by: ['name', 'type'],
 where: {
 serviceId,
 timestamp: { gte: since },
 },
 _avg: { value: true },
 _min: { value: true },
 _max: { value: true },
 _count: true,
 });
 
 await cache.set(cacheKey, metrics, 300);
 
 return metrics;
 },
};

// Notification queries
export const notificationQueries = {
 /**
 * Get notifications with efficient pagination
 */
 async getNotifications({
 userId,
 page = 1,
 limit = 20,
 unreadOnly = false,
 }: {
 userId: string;
 page?: number;
 limit?: number;
 unreadOnly?: boolean;
 }) {
 const skip = (page - 1) * limit;
 
 const where: Prisma.NotificationWhereInput = {
 userId,
 archived: false,
 ...(unreadOnly && { read: false }),
 };
 
 const [notifications, total, unreadCount] = await Promise.all([
 prisma.notification.findMany({
 where,
 skip,
 take: limit,
 orderBy: [
 { pinned: 'desc' },
 { createdAt: 'desc' },
 ],
 }),
 prisma.notification.count({ where }),
 prisma.notification.count({
 where: { userId, read: false, archived: false },
 }),
 ]);
 
 return {
 data: notifications,
 pagination: {
 page,
 limit,
 total,
 totalPages: Math.ceil(total / limit),
 },
 unreadCount,
 };
 },
 
 /**
 * Mark notifications as read in batch
 */
 async markAsRead(userId: string, notificationIds: string[]) {
 return prisma.notification.updateMany({
 where: {
 id: { in: notificationIds },
 userId,
 },
 data: { read: true },
 });
 },
};

// Search queries
export const searchQueries = {
 /**
 * Full-text search across entities
 */
 async search({
 query,
 entityTypes = ['service', 'template', 'document'],
 limit = 20,
 }: {
 query: string;
 entityTypes?: string[];
 limit?: number;
 }) {
 const cacheKey = `search:${query}:${entityTypes.join(',')}:${limit}`;
 const cached = await cache.get(cacheKey);
 if (cached) return cached;
 
 // Use PostgreSQL full-text search with trigram similarity
 const results = await prisma.$queryRaw`
 SELECT 
 entityType,
 entityId,
 title,
 content,
 tags,
 similarity(title, ${query}) as title_similarity,
 similarity(content, ${query}) as content_similarity
 FROM search_index
 WHERE 
 entityType = ANY(${entityTypes})
 AND (
 title ILIKE ${'%' + query + '%'}
 OR content ILIKE ${'%' + query + '%'}
 OR ${query} = ANY(tags)
 OR similarity(title, ${query}) > 0.3
 OR similarity(content, ${query}) > 0.2
 )
 ORDER BY 
 GREATEST(
 similarity(title, ${query}),
 similarity(content, ${query}) * 0.5
 ) DESC
 LIMIT ${limit}
 `;
 
 await cache.set(cacheKey, results, 300);
 
 return results;
 },
};