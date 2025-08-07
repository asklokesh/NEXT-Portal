/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { EventEmitter } from 'events';

import { metricsService } from './metrics';

import type { ServiceMetrics, DashboardMetrics } from './metrics';

export interface RealtimeUpdate {
 type: 'metrics' | 'deployment' | 'alert' | 'health';
 entityRef?: string;
 data: any;
 timestamp: string;
}

class RealtimeDataService extends EventEmitter {
 private intervals: Map<string, NodeJS.Timeout> = new Map();
 private subscribers: Set<string> = new Set();
 private isStarted: boolean = false;
 private updateInterval: number = 5000; // 5 seconds

 constructor() {
 super();
 }

 start() {
 if (this.isStarted) return;
 
 this.isStarted = true;
 console.log('Starting real-time data service');
 
 // Start global metrics updates
 this.startMetricsUpdates();
 
 // Start simulated events
 this.startSimulatedEvents();
 }

 stop() {
 if (!this.isStarted) return;
 
 this.isStarted = false;
 console.log('Stopping real-time data service');
 
 // Clear all intervals
 this.intervals.forEach(interval => clearInterval(interval));
 this.intervals.clear();
 
 // Clear subscribers
 this.subscribers.clear();
 }

 subscribe(entityRef: string) {
 this.subscribers.add(entityRef);
 console.log(`Subscribed to updates for ${entityRef}`);
 
 // Start entity-specific updates
 this.startEntityUpdates(entityRef);
 }

 unsubscribe(entityRef: string) {
 this.subscribers.delete(entityRef);
 console.log(`Unsubscribed from updates for ${entityRef}`);
 
 // Stop entity-specific updates
 this.stopEntityUpdates(entityRef);
 }

 private startMetricsUpdates() {
 const interval = setInterval(async () => {
 try {
 // Get current dashboard metrics
 const metrics = await metricsService.getDashboardMetrics();
 
 // Emit metrics update
 this.emit('metrics', {
 type: 'metrics',
 data: metrics,
 timestamp: new Date().toISOString()
 } as RealtimeUpdate);

 // Emit individual service updates
 metrics.services.forEach(service => {
 if (this.subscribers.has(service.entityRef)) {
 this.emit('service-metrics', {
 type: 'metrics',
 entityRef: service.entityRef,
 data: service,
 timestamp: new Date().toISOString()
 } as RealtimeUpdate);
 }
 });

 } catch (error) {
 console.error('Failed to fetch metrics update:', error);
 }
 }, this.updateInterval);

 this.intervals.set('global-metrics', interval);
 }

 private startEntityUpdates(entityRef: string) {
 if (this.intervals.has(`entity-${entityRef}`)) return;

 const interval = setInterval(async () => {
 try {
 const metrics = await metricsService.getServiceMetrics(entityRef);
 
 this.emit('entity-update', {
 type: 'metrics',
 entityRef,
 data: metrics,
 timestamp: new Date().toISOString()
 } as RealtimeUpdate);

 } catch (error) {
 console.error(`Failed to fetch updates for ${entityRef}:`, error);
 }
 }, this.updateInterval);

 this.intervals.set(`entity-${entityRef}`, interval);
 }

 private stopEntityUpdates(entityRef: string) {
 const intervalKey = `entity-${entityRef}`;
 const interval = this.intervals.get(intervalKey);
 
 if (interval) {
 clearInterval(interval);
 this.intervals.delete(intervalKey);
 }
 }

 private startSimulatedEvents() {
 // Simulate deployment events
 const deploymentInterval = setInterval(() => {
 if (Math.random() > 0.7) { // 30% chance every interval
 this.simulateDeployment();
 }
 }, 15000); // Every 15 seconds

 // Simulate alert events
 const alertInterval = setInterval(() => {
 if (Math.random() > 0.8) { // 20% chance every interval
 this.simulateAlert();
 }
 }, 20000); // Every 20 seconds

 // Simulate health changes
 const healthInterval = setInterval(() => {
 if (Math.random() > 0.9) { // 10% chance every interval
 this.simulateHealthChange();
 }
 }, 30000); // Every 30 seconds

 this.intervals.set('deployments', deploymentInterval);
 this.intervals.set('alerts', alertInterval);
 this.intervals.set('health', healthInterval);
 }

 private simulateDeployment() {
 const services = ['user-service', 'auth-service', 'payment-service', 'notification-service'];
 const randomService = services[Math.floor(Math.random() * services.length)];
 const entityRef = `Component:default/${randomService}`;
 
 const deployment = {
 id: `deploy-${Date.now()}`,
 entityRef,
 version: `v1.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`,
 status: 'in_progress',
 timestamp: new Date().toISOString(),
 deployer: ['alice', 'bob', 'charlie', 'david'][Math.floor(Math.random() * 4)]
 };

 this.emit('deployment', {
 type: 'deployment',
 entityRef,
 data: deployment,
 timestamp: new Date().toISOString()
 } as RealtimeUpdate);

 // Simulate deployment completion after 2-5 seconds
 const completionTime = 2000 + Math.random() * 3000;
 setTimeout(() => {
 const completedDeployment = {
 ...deployment,
 status: Math.random() > 0.1 ? 'success' : 'failed'
 };

 this.emit('deployment', {
 type: 'deployment',
 entityRef,
 data: completedDeployment,
 timestamp: new Date().toISOString()
 } as RealtimeUpdate);
 }, completionTime);
 }

 private simulateAlert() {
 const services = ['user-service', 'auth-service', 'payment-service', 'notification-service'];
 const randomService = services[Math.floor(Math.random() * services.length)];
 const entityRef = `Component:default/${randomService}`;
 
 const alertTypes = [
 { severity: 'warning', title: 'High Memory Usage', message: 'Memory usage exceeded 80% threshold' },
 { severity: 'error', title: 'High Error Rate', message: 'Error rate increased to 5.2%' },
 { severity: 'critical', title: 'Service Unavailable', message: 'Service is not responding to health checks' },
 { severity: 'info', title: 'Deployment Complete', message: 'New version deployed successfully' }
 ];
 
 const randomAlert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
 
 const alert = {
 id: `alert-${Date.now()}`,
 entityRef,
 severity: randomAlert.severity,
 title: randomAlert.title,
 message: randomAlert.message,
 timestamp: new Date().toISOString(),
 acknowledged: false
 };

 this.emit('alert', {
 type: 'alert',
 entityRef,
 data: alert,
 timestamp: new Date().toISOString()
 } as RealtimeUpdate);
 }

 private simulateHealthChange() {
 const services = ['user-service', 'auth-service', 'payment-service', 'notification-service'];
 const randomService = services[Math.floor(Math.random() * services.length)];
 const entityRef = `Component:default/${randomService}`;
 
 const healthStates = ['healthy', 'degraded', 'unhealthy'];
 const randomHealth = healthStates[Math.floor(Math.random() * healthStates.length)];
 
 this.emit('health', {
 type: 'health',
 entityRef,
 data: { health: randomHealth },
 timestamp: new Date().toISOString()
 } as RealtimeUpdate);
 }

 // Widget-specific data updates
 async getWidgetRealtimeData(widgetId: string, widgetType: string, config: any): Promise<any> {
 return await metricsService.getWidgetData(widgetType, config);
 }

 // Simulate metric spikes for demo purposes
 simulateMetricSpike(entityRef: string, metric: string, multiplier: number = 2) {
 this.emit('metric-spike', {
 type: 'metrics',
 entityRef,
 data: { metric, multiplier },
 timestamp: new Date().toISOString()
 } as RealtimeUpdate);
 }

 // Get current connection status
 isConnected(): boolean {
 return this.isStarted;
 }

 // Get subscriber count
 getSubscriberCount(): number {
 return this.subscribers.size;
 }
}

// Export singleton instance
export const realtimeService = new RealtimeDataService();

// Auto-start when in demo mode
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
 realtimeService.start();
}