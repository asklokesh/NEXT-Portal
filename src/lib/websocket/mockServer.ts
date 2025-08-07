// Mock WebSocket server for development and testing
// This simulates real-time updates that would come from a Backstage backend

import type { EntityUpdate, MetricsUpdate, DeploymentUpdate, HealthUpdate } from './WebSocketService';

interface MockWebSocketServer {
 clients: Set<WebSocket>;
 intervalIds: Set<NodeJS.Timeout>;
 start: () => void;
 stop: () => void;
 simulateEntityUpdate: (entityRef: string) => void;
 simulateMetricsUpdate: (entityRef: string) => void;
 simulateDeploymentStart: (entityRef: string) => void;
 simulateHealthChange: (entityRef: string, level: 'info' | 'warning' | 'error') => void;
}

class MockWebSocketServerImpl implements MockWebSocketServer {
 clients = new Set<WebSocket>();
 intervalIds = new Set<NodeJS.Timeout>();
 private isRunning = false;

 start() {
 if (this.isRunning) return;
 this.isRunning = true;

 console.log('Mock WebSocket server started');

 // Simulate periodic metrics updates
 const metricsInterval = setInterval(() => {
 this.simulateRandomMetricsUpdates();
 }, 5000); // Every 5 seconds
 this.intervalIds.add(metricsInterval);

 // Simulate occasional entity updates
 const entityInterval = setInterval(() => {
 this.simulateRandomEntityUpdates();
 }, 30000); // Every 30 seconds
 this.intervalIds.add(entityInterval);

 // Simulate deployment events
 const deploymentInterval = setInterval(() => {
 this.simulateRandomDeployments();
 }, 60000); // Every minute
 this.intervalIds.add(deploymentInterval);

 // Simulate health changes
 const healthInterval = setInterval(() => {
 this.simulateRandomHealthChanges();
 }, 45000); // Every 45 seconds
 this.intervalIds.add(healthInterval);
 }

 stop() {
 if (!this.isRunning) return;
 this.isRunning = false;

 console.log('Mock WebSocket server stopped');

 // Clear all intervals
 this.intervalIds.forEach(id => clearInterval(id));
 this.intervalIds.clear();

 // Close all client connections
 this.clients.forEach(client => {
 if (client.readyState === WebSocket.OPEN) {
 client.close();
 }
 });
 this.clients.clear();
 }

 addClient(client: WebSocket) {
 this.clients.add(client);
 console.log(`Mock WebSocket client connected. Total clients: ${this.clients.size}`);

 // Send welcome message
 this.sendToClient(client, {
 type: 'connected',
 data: { message: 'Connected to mock WebSocket server' },
 timestamp: new Date().toISOString()
 });

 client.addEventListener('close', () => {
 this.clients.delete(client);
 console.log(`Mock WebSocket client disconnected. Total clients: ${this.clients.size}`);
 });

 client.addEventListener('message', (event) => {
 try {
 const message = JSON.parse(event.data);
 this.handleClientMessage(client, message);
 } catch (error) {
 console.error('Error parsing client message:', error);
 }
 });
 }

 private handleClientMessage(client: WebSocket, message: any) {
 switch (message.type) {
 case 'ping':
 this.sendToClient(client, {
 type: 'pong',
 data: {},
 timestamp: new Date().toISOString()
 });
 break;
 case 'subscribe_metrics':
 console.log(`Client subscribed to metrics for ${message.entityRef}`);
 // Start sending metrics updates for this entity
 this.simulateMetricsUpdate(message.entityRef);
 break;
 case 'subscribe_deployments':
 console.log(`Client subscribed to deployments for ${message.entityRef}`);
 break;
 case 'subscribe_health':
 console.log(`Client subscribed to health for ${message.entityRef}`);
 break;
 case 'subscribe_catalog':
 console.log('Client subscribed to catalog updates');
 break;
 }
 }

 private sendToClient(client: WebSocket, message: any) {
 if (client.readyState === WebSocket.OPEN) {
 client.send(JSON.stringify(message));
 }
 }

 private broadcast(message: any) {
 this.clients.forEach(client => {
 this.sendToClient(client, message);
 });
 }

 simulateEntityUpdate(entityRef: string) {
 const [kind, namespaceAndName] = entityRef.split(':');
 const [namespace, name] = namespaceAndName.split('/');

 const update: EntityUpdate = {
 kind,
 namespace,
 name,
 changeType: 'updated',
 data: {
 apiVersion: 'backstage.io/v1alpha1',
 kind,
 metadata: {
 name,
 namespace,
 title: `${name} Service`,
 description: `Updated ${name} service description at ${new Date().toLocaleTimeString()}`,
 tags: ['service', 'updated'],
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'platform-team',
 system: 'core-platform'
 }
 }
 };

 this.broadcast({
 type: 'entity_update',
 data: update,
 timestamp: new Date().toISOString()
 });

 this.broadcast({
 type: 'catalog_update',
 data: update,
 timestamp: new Date().toISOString()
 });
 }

 simulateMetricsUpdate(entityRef: string) {
 const update: MetricsUpdate = {
 entityRef,
 metrics: {
 cpu: Math.random() * 100,
 memory: Math.random() * 100,
 requests: Math.floor(Math.random() * 1000) + 100,
 errors: Math.floor(Math.random() * 10),
 responseTime: Math.random() * 300 + 50
 }
 };

 this.broadcast({
 type: 'metrics_update',
 data: update,
 timestamp: new Date().toISOString()
 });
 }

 simulateDeploymentStart(entityRef: string) {
 const deploymentId = `deploy-${Date.now()}`;
 const version = `v1.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`;
 
 // Start deployment
 const startUpdate: DeploymentUpdate = {
 entityRef,
 deployment: {
 id: deploymentId,
 version,
 environment: ['production', 'staging', 'development'][Math.floor(Math.random() * 3)],
 status: 'in_progress',
 startTime: new Date().toISOString()
 }
 };

 this.broadcast({
 type: 'deployment_update',
 data: startUpdate,
 timestamp: new Date().toISOString()
 });

 // Simulate deployment completion after random delay
 setTimeout(() => {
 const endUpdate: DeploymentUpdate = {
 entityRef,
 deployment: {
 ...startUpdate.deployment,
 status: Math.random() > 0.8 ? 'failed' : 'success',
 endTime: new Date().toISOString()
 }
 };

 this.broadcast({
 type: 'deployment_update',
 data: endUpdate,
 timestamp: new Date().toISOString()
 });
 }, Math.random() * 30000 + 10000); // 10-40 seconds
 }

 simulateHealthChange(entityRef: string, level: 'info' | 'warning' | 'error') {
 const messages = {
 info: ['Service is healthy', 'All systems operational', 'Performance optimal'],
 warning: ['High response times detected', 'Memory usage elevated', 'Some endpoints slow'],
 error: ['Service unavailable', 'Critical error detected', 'Health check failed']
 };

 const update: HealthUpdate = {
 entityRef,
 health: {
 level,
 message: messages[level][Math.floor(Math.random() * messages[level].length)],
 timestamp: new Date().toISOString()
 }
 };

 this.broadcast({
 type: 'health_update',
 data: update,
 timestamp: new Date().toISOString()
 });
 }

 private simulateRandomMetricsUpdates() {
 // Simulate metrics for some common service entity refs
 const commonServices = [
 'Component:default/user-service',
 'Component:default/payment-service',
 'Component:default/notification-service',
 'Component:default/analytics-service',
 'Component:default/auth-service'
 ];

 commonServices.forEach(entityRef => {
 this.simulateMetricsUpdate(entityRef);
 });
 }

 private simulateRandomEntityUpdates() {
 const commonServices = [
 'Component:default/user-service',
 'Component:default/payment-service',
 'Component:default/notification-service'
 ];

 const randomService = commonServices[Math.floor(Math.random() * commonServices.length)];
 this.simulateEntityUpdate(randomService);
 }

 private simulateRandomDeployments() {
 const commonServices = [
 'Component:default/user-service',
 'Component:default/payment-service',
 'Component:default/notification-service'
 ];

 const randomService = commonServices[Math.floor(Math.random() * commonServices.length)];
 this.simulateDeploymentStart(randomService);
 }

 private simulateRandomHealthChanges() {
 const commonServices = [
 'Component:default/user-service',
 'Component:default/payment-service',
 'Component:default/notification-service',
 'Component:default/analytics-service'
 ];

 const randomService = commonServices[Math.floor(Math.random() * commonServices.length)];
 const levels: ('info' | 'warning' | 'error')[] = ['info', 'warning', 'error'];
 const randomLevel = levels[Math.floor(Math.random() * levels.length)];
 
 this.simulateHealthChange(randomService, randomLevel);
 }
}

// Export singleton instance
export const mockWebSocketServer = new MockWebSocketServerImpl();

// Auto-start in development mode
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
 // Start the mock server when the module loads
 setTimeout(() => {
 mockWebSocketServer.start();
 }, 1000);
}