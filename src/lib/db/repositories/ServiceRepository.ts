/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import type { Service, ServiceType, Lifecycle, Prisma } from '@prisma/client';
import { prisma } from '../client';

export interface CreateServiceData {
 name: string;
 displayName: string;
 description?: string;
 type: ServiceType;
 lifecycle: Lifecycle;
 namespace?: string;
 system?: string;
 domain?: string;
 ownerId: string;
 teamId: string;
 gitRepo?: string;
 gitBranch?: string;
 apiVersion?: string;
 tags?: string[];
 labels?: any;
 annotations?: any;
}

export interface UpdateServiceData {
 displayName?: string;
 description?: string;
 type?: ServiceType;
 lifecycle?: Lifecycle;
 system?: string;
 domain?: string;
 ownerId?: string;
 teamId?: string;
 gitRepo?: string;
 gitBranch?: string;
 apiVersion?: string;
 tags?: string[];
 labels?: any;
 annotations?: any;
 isActive?: boolean;
}

export interface ServiceWithRelations extends Service {
 owner: {
 id: string;
 name: string;
 email: string;
 };
 team: {
 id: string;
 name: string;
 displayName: string;
 };
 dependencies: Array<{
 id: string;
 dependsOnId: string;
 dependencyType: string;
 dependsOn: {
 id: string;
 name: string;
 displayName: string;
 type: ServiceType;
 };
 }>;
 dependents: Array<{
 id: string;
 serviceId: string;
 dependencyType: string;
 service: {
 id: string;
 name: string;
 displayName: string;
 type: ServiceType;
 };
 }>;
 healthChecks: Array<{
 id: string;
 name: string;
 type: string;
 isEnabled: boolean;
 results: Array<{
 status: string;
 responseTime: number | null;
 checkedAt: Date;
 }>;
 }>;
 metrics: Array<{
 id: string;
 name: string;
 value: number;
 unit: string | null;
 timestamp: Date;
 }>;
 costs: Array<{
 id: string;
 provider: string;
 cost: any; // Decimal
 currency: string;
 date: Date;
 }>;
}

export class ServiceRepository {
 async create(data: CreateServiceData): Promise<Service> {
 return prisma.service.create({
 data: {
 ...data,
 namespace: data.namespace || 'default',
 gitBranch: data.gitBranch || 'main',
 tags: data.tags || [],
 },
 });
 }

 async findById(id: string): Promise<ServiceWithRelations | null> {
 return prisma.service.findUnique({
 where: { id },
 include: {
 owner: {
 select: {
 id: true,
 name: true,
 email: true,
 },
 },
 team: {
 select: {
 id: true,
 name: true,
 displayName: true,
 },
 },
 dependencies: {
 include: {
 dependsOn: {
 select: {
 id: true,
 name: true,
 displayName: true,
 type: true,
 },
 },
 },
 },
 dependents: {
 include: {
 service: {
 select: {
 id: true,
 name: true,
 displayName: true,
 type: true,
 },
 },
 },
 },
 healthChecks: {
 where: { isEnabled: true },
 include: {
 results: {
 take: 1,
 orderBy: { checkedAt: 'desc' },
 },
 },
 },
 metrics: {
 take: 10,
 orderBy: { timestamp: 'desc' },
 },
 costs: {
 take: 30,
 orderBy: { date: 'desc' },
 },
 },
 }) as Promise<ServiceWithRelations | null>;
 }

 async findByName(name: string): Promise<Service | null> {
 return prisma.service.findUnique({
 where: { name },
 });
 }

 async findMany(options?: {
 skip?: number;
 take?: number;
 where?: Prisma.ServiceWhereInput;
 orderBy?: Prisma.ServiceOrderByWithRelationInput;
 include?: Prisma.ServiceInclude;
 }): Promise<ServiceWithRelations[]> {
 return prisma.service.findMany({
 ...options,
 include: {
 owner: {
 select: {
 id: true,
 name: true,
 email: true,
 },
 },
 team: {
 select: {
 id: true,
 name: true,
 displayName: true,
 },
 },
 healthChecks: {
 where: { isEnabled: true },
 include: {
 results: {
 take: 1,
 orderBy: { checkedAt: 'desc' },
 },
 },
 },
 metrics: {
 take: 5,
 orderBy: { timestamp: 'desc' },
 },
 ...options?.include,
 },
 }) as Promise<ServiceWithRelations[]>;
 }

 async findByOwner(ownerId: string): Promise<Service[]> {
 return prisma.service.findMany({
 where: {
 ownerId,
 isActive: true,
 },
 orderBy: { updatedAt: 'desc' },
 });
 }

 async findByTeam(teamId: string): Promise<Service[]> {
 return prisma.service.findMany({
 where: {
 teamId,
 isActive: true,
 },
 include: {
 owner: {
 select: {
 id: true,
 name: true,
 email: true,
 },
 },
 },
 orderBy: { updatedAt: 'desc' },
 });
 }

 async update(id: string, data: UpdateServiceData): Promise<Service> {
 return prisma.service.update({
 where: { id },
 data,
 });
 }

 async delete(id: string): Promise<Service> {
 return prisma.service.update({
 where: { id },
 data: {
 isActive: false,
 },
 });
 }

 async hardDelete(id: string): Promise<Service> {
 return prisma.service.delete({
 where: { id },
 });
 }

 async count(where?: Prisma.ServiceWhereInput): Promise<number> {
 return prisma.service.count({ where });
 }

 async search(query: string, options?: {
 skip?: number;
 take?: number;
 type?: ServiceType;
 lifecycle?: Lifecycle;
 ownerId?: string;
 teamId?: string;
 }): Promise<ServiceWithRelations[]> {
 const where: Prisma.ServiceWhereInput = {
 AND: [
 {
 OR: [
 { name: { contains: query, mode: 'insensitive' } },
 { displayName: { contains: query, mode: 'insensitive' } },
 { description: { contains: query, mode: 'insensitive' } },
 { tags: { has: query } },
 ],
 },
 { isActive: true },
 ...(options?.type ? [{ type: options.type }] : []),
 ...(options?.lifecycle ? [{ lifecycle: options.lifecycle }] : []),
 ...(options?.ownerId ? [{ ownerId: options.ownerId }] : []),
 ...(options?.teamId ? [{ teamId: options.teamId }] : []),
 ],
 };

 return this.findMany({
 where,
 skip: options?.skip,
 take: options?.take,
 orderBy: { updatedAt: 'desc' },
 });
 }

 async getServiceStats(): Promise<{
 total: number;
 byType: Record<ServiceType, number>;
 byLifecycle: Record<Lifecycle, number>;
 healthy: number;
 unhealthy: number;
 }> {
 const [total, services, healthStats] = await Promise.all([
 this.count({ isActive: true }),
 prisma.service.groupBy({
 by: ['type', 'lifecycle'],
 where: { isActive: true },
 _count: true,
 }),
 prisma.healthCheckResult.groupBy({
 by: ['status'],
 where: {
 checkedAt: {
 gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
 },
 },
 _count: true,
 }),
 ]);

 const byType = services.reduce((acc, item) => {
 acc[item.type] = (acc[item.type] || 0) + item._count;
 return acc;
 }, {} as Record<ServiceType, number>);

 const byLifecycle = services.reduce((acc, item) => {
 acc[item.lifecycle] = (acc[item.lifecycle] || 0) + item._count;
 return acc;
 }, {} as Record<Lifecycle, number>);

 const healthy = healthStats
 .filter(stat => stat.status === 'HEALTHY')
 .reduce((sum, stat) => sum + stat._count, 0);

 const unhealthy = healthStats
 .filter(stat => ['DEGRADED', 'UNHEALTHY'].includes(stat.status))
 .reduce((sum, stat) => sum + stat._count, 0);

 return {
 total,
 byType,
 byLifecycle,
 healthy,
 unhealthy,
 };
 }

 async addDependency(serviceId: string, dependsOnId: string, type: string, description?: string): Promise<void> {
 await prisma.serviceDependency.create({
 data: {
 serviceId,
 dependsOnId,
 dependencyType: type as any,
 description,
 },
 });
 }

 async removeDependency(serviceId: string, dependsOnId: string): Promise<void> {
 await prisma.serviceDependency.deleteMany({
 where: {
 serviceId,
 dependsOnId,
 },
 });
 }

 async getDependencyGraph(serviceId: string, depth = 3): Promise<any> {
 // Recursive function to build dependency graph
 const buildGraph = async (id: string, currentDepth: number, visited = new Set()): Promise<any> => {
 if (currentDepth <= 0 || visited.has(id)) {
 return null;
 }

 visited.add(id);

 const service = await prisma.service.findUnique({
 where: { id },
 include: {
 dependencies: {
 include: {
 dependsOn: true,
 },
 },
 },
 });

 if (!service) return null;

 const dependencies = await Promise.all(
 service.dependencies.map(dep =>
 buildGraph(dep.dependsOnId, currentDepth - 1, new Set(visited))
 )
 );

 return {
 ...service,
 dependencies: dependencies.filter(Boolean),
 };
 };

 return buildGraph(serviceId, depth);
 }
}