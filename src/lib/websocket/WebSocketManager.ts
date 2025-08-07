import { Server, Socket } from 'socket.io';
import { backstageClient } from '@/lib/backstage/real-client';
import { prisma } from '@/lib/db/client';
import type { Entity } from '@backstage/catalog-model';

interface MetricsSubscription {
 socketId: string;
 entityRef: string;
}

interface CachedMetrics {
 entityRef: string;
 metrics: any;
 timestamp: number;
}

export class WebSocketManager {
 private io: Server;
 private metricsSubscriptions: Map<string, Set<string>> = new Map(); // entityRef -> Set<socketId>
 private metricsCache: Map<string, CachedMetrics> = new Map();
 private metricsCacheTTL = 5000; // 5 seconds
 private metricsInterval: NodeJS.Timeout | null = null;
 private catalogInterval: NodeJS.Timeout | null = null;
 private healthInterval: NodeJS.Timeout | null = null;

 constructor(io: Server) {
 this.io = io;
 }

 startPeriodicTasks() {
 // Metrics updates every 5 seconds
 this.metricsInterval = setInterval(() => {
 this.broadcastMetricsUpdates();
 }, 5000);

 // Catalog change detection every 30 seconds
 this.catalogInterval = setInterval(() => {
 this.checkCatalogChanges();
 }, 30000);

 // Health checks every 10 seconds
 this.healthInterval = setInterval(() => {
 this.broadcastHealthUpdates();
 }, 10000);
 }

 stopPeriodicTasks() {
 if (this.metricsInterval) clearInterval(this.metricsInterval);
 if (this.catalogInterval) clearInterval(this.catalogInterval);
 if (this.healthInterval) clearInterval(this.healthInterval);
 }

 subscribeToMetrics(socketId: string, entityRef: string) {
 if (!this.metricsSubscriptions.has(entityRef)) {
 this.metricsSubscriptions.set(entityRef, new Set());
 }
 this.metricsSubscriptions.get(entityRef)!.add(socketId);

 // Send cached metrics if available
 const cached = this.metricsCache.get(entityRef);
 if (cached && Date.now() - cached.timestamp < this.metricsCacheTTL) {
 const socket = this.io.sockets.sockets.get(socketId);
 if (socket) {
 socket.emit('metrics_update', {
 type: 'metrics_update',
 data: {
 entityRef,
 metrics: cached.metrics,
 },
 timestamp: new Date().toISOString(),
 });
 }
 }
 }

 unsubscribeFromMetrics(socketId: string, entityRef: string) {
 const sockets = this.metricsSubscriptions.get(entityRef);
 if (sockets) {
 sockets.delete(socketId);
 if (sockets.size === 0) {
 this.metricsSubscriptions.delete(entityRef);
 }
 }
 }

 handleDisconnect(socketId: string) {
 // Clean up all subscriptions for this socket
 this.metricsSubscriptions.forEach((sockets, entityRef) => {
 sockets.delete(socketId);
 if (sockets.size === 0) {
 this.metricsSubscriptions.delete(entityRef);
 }
 });
 }

 private async broadcastMetricsUpdates() {
 // Get all subscribed entity refs
 const entityRefs = Array.from(this.metricsSubscriptions.keys());
 if (entityRefs.length === 0) return;

 // Fetch metrics for all subscribed entities
 for (const entityRef of entityRefs) {
 try {
 const metrics = await this.fetchEntityMetrics(entityRef);
 
 // Cache the metrics
 this.metricsCache.set(entityRef, {
 entityRef,
 metrics,
 timestamp: Date.now(),
 });

 // Broadcast to subscribed sockets
 this.io.to(`metrics:${entityRef}`).emit('metrics_update', {
 type: 'metrics_update',
 data: {
 entityRef,
 metrics,
 },
 timestamp: new Date().toISOString(),
 });
 } catch (error) {
 console.error(`Failed to fetch metrics for ${entityRef}:`, error);
 }
 }
 }

 private async fetchEntityMetrics(entityRef: string): Promise<any> {
 // In a real implementation, this would fetch from monitoring systems
 // For now, generate mock metrics
 return {
 cpu: Math.random() * 100,
 memory: Math.random() * 100,
 requests: Math.floor(Math.random() * 1000) + 100,
 errors: Math.floor(Math.random() * 50),
 responseTime: Math.random() * 300 + 50,
 errorRate: Math.random() * 10,
 };
 }

 private async checkCatalogChanges() {
 try {
 // In a real implementation, this would:
 // 1. Query Backstage for recent changes
 // 2. Compare with cached state
 // 3. Emit updates for changed entities

 // For now, simulate occasional updates
 if (Math.random() > 0.7) {
 const mockUpdate = {
 kind: 'Component',
 namespace: 'default',
 name: `service-${Math.floor(Math.random() * 10)}`,
 changeType: 'updated' as const,
 data: {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: `service-${Math.floor(Math.random() * 10)}`,
 namespace: 'default',
 annotations: {
 'backstage.io/edit-time': new Date().toISOString(),
 },
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'platform-team',
 },
 },
 };

 this.io.to('catalog:updates').emit('catalog_update', {
 type: 'catalog_update',
 data: mockUpdate,
 timestamp: new Date().toISOString(),
 });
 }
 } catch (error) {
 console.error('Failed to check catalog changes:', error);
 }
 }

 private async broadcastHealthUpdates() {
 // Get all connected sockets with entity subscriptions
 const entityRefs = new Set<string>();
 
 this.io.sockets.sockets.forEach((socket) => {
 socket.rooms.forEach((room) => {
 if (room.startsWith('entity:')) {
 entityRefs.add(room.replace('entity:', ''));
 }
 });
 });

 for (const entityRef of entityRefs) {
 try {
 const health = await this.fetchEntityHealth(entityRef);
 
 this.io.to(`entity:${entityRef}`).emit('health_update', {
 type: 'health_update',
 data: {
 entityRef,
 health,
 },
 timestamp: new Date().toISOString(),
 });
 } catch (error) {
 console.error(`Failed to fetch health for ${entityRef}:`, error);
 }
 }
 }

 private async fetchEntityHealth(entityRef: string): Promise<any> {
 // In a real implementation, this would check actual health endpoints
 // For now, generate mock health status
 const statuses = ['healthy', 'degraded', 'unhealthy'];
 const status = statuses[Math.floor(Math.random() * statuses.length)];
 
 return {
 status,
 level: status === 'healthy' ? 'info' : status === 'degraded' ? 'warning' : 'error',
 message: `Service is ${status}`,
 timestamp: new Date().toISOString(),
 checks: {
 database: Math.random() > 0.1,
 api: Math.random() > 0.05,
 dependencies: Math.random() > 0.2,
 },
 };
 }

 // Emit custom events
 emitEntityUpdate(entityRef: string, update: any) {
 this.io.to(`entity:${entityRef}`).emit('entity_update', {
 type: 'entity_update',
 data: update,
 timestamp: new Date().toISOString(),
 });
 }

 emitCatalogUpdate(update: any) {
 this.io.to('catalog:updates').emit('catalog_update', {
 type: 'catalog_update',
 data: update,
 timestamp: new Date().toISOString(),
 });
 }

 emitDeploymentUpdate(entityRef: string, deployment: any) {
 this.io.to(`entity:${entityRef}`).emit('deployment_update', {
 type: 'deployment_update',
 data: {
 entityRef,
 deployment,
 },
 timestamp: new Date().toISOString(),
 });
 }

 // Broadcast to specific users or teams
 notifyUser(userId: string, notification: any) {
 this.io.to(`user:${userId}`).emit('notification', {
 type: 'notification',
 data: notification,
 timestamp: new Date().toISOString(),
 });
 }

 notifyTeam(teamId: string, notification: any) {
 this.io.to(`team:${teamId}`).emit('team_notification', {
 type: 'team_notification',
 data: notification,
 timestamp: new Date().toISOString(),
 });
 }
}