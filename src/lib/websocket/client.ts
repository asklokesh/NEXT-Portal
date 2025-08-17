/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { EventEmitter } from 'events';
import { io, Socket } from 'socket.io-client';

import { toast } from 'react-hot-toast';

export interface WebSocketMessage {
 type: 'metrics' | 'deployment' | 'alert' | 'health' | 'log';
 entityRef?: string;
 data: any;
 timestamp: string;
}

export interface MetricsUpdate {
 entityRef: string;
 metrics: {
 cpu: number;
 memory: number;
 requestsPerSecond: number;
 errorRate: number;
 responseTime: number;
 activeConnections: number;
 };
}

export interface DeploymentUpdate {
 entityRef: string;
 deployment: {
 id: string;
 version: string;
 status: 'pending' | 'in_progress' | 'success' | 'failed';
 progress: number;
 message: string;
 };
}

export interface AlertUpdate {
 id: string;
 entityRef: string;
 severity: 'info' | 'warning' | 'error' | 'critical';
 title: string;
 message: string;
 timestamp: string;
 acknowledged: boolean;
}

class WebSocketClient extends EventEmitter {
 private socket: Socket | null = null;
 private url: string;
 private reconnectTimeout: number = 5000;
 private reconnectAttempts: number = 0;
 private maxReconnectAttempts: number = 10;
 private isIntentionallyClosed: boolean = false;
 private subscriptions: Set<string> = new Set();
 private demoMode: boolean = false;
 private demoIntervals: Map<string, NodeJS.Timeout> = new Map();

 constructor() {
 super();
 const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:4403';
 this.url = wsUrl;
 this.demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || true; // Enable demo mode by default
 }

 connect() {
 if (this.demoMode) {
 this.startDemoMode();
 return;
 }

 try {
 this.socket = io(this.url, {
 autoConnect: false,
 reconnection: true,
 reconnectionAttempts: this.maxReconnectAttempts,
 reconnectionDelay: this.reconnectTimeout,
 });
 
 this.socket.on('connect', () => {
 console.log('WebSocket connected via Socket.IO');
 this.reconnectAttempts = 0;
 this.emit('connected');
 
 // Resubscribe to previous subscriptions
 this.subscriptions.forEach(entityRef => {
 this.subscribe(entityRef);
 });
 });

 this.socket.on('message', (message: WebSocketMessage) => {
 this.handleMessage(message);
 });

 this.socket.on('connect_error', (error) => {
 console.error('WebSocket connection error:', error);
 // Only emit error if there are listeners to handle it
 if (this.listenerCount('error') > 0) {
 this.emit('error', error);
 } else {
 console.error('WebSocket connection error - no error handlers registered');
 }
 });

 this.socket.on('disconnect', (reason) => {
 console.log('WebSocket disconnected:', reason);
 this.emit('disconnected');
 });

 // Connect the socket
 this.socket.connect();
 } catch (error) {
 console.error('Failed to connect WebSocket:', error);
 if (this.listenerCount('error') > 0) {
 this.emit('error', error instanceof Error ? error : new Error('Failed to connect WebSocket'));
 }
 }
 }

 disconnect() {
 this.isIntentionallyClosed = true;
 
 if (this.demoMode) {
 this.stopDemoMode();
 return;
 }
 
 if (this.socket) {
 this.socket.disconnect();
 this.socket = null;
 }
 }

 subscribe(entityRef: string) {
 this.subscriptions.add(entityRef);
 
 if (this.demoMode) {
 this.startDemoDataForEntity(entityRef);
 return;
 }
 
 if (this.socket && this.socket.connected) {
 this.socket.emit('subscribe', { entityRef });
 }
 }

 unsubscribe(entityRef: string) {
 this.subscriptions.delete(entityRef);
 
 if (this.demoMode) {
 this.stopDemoDataForEntity(entityRef);
 return;
 }
 
 if (this.socket && this.socket.connected) {
 this.socket.emit('unsubscribe', { entityRef });
 }
 }

 private handleMessage(message: WebSocketMessage) {
 switch (message.type) {
 case 'metrics':
 this.emit('metrics', message.data as MetricsUpdate);
 break;
 case 'deployment':
 this.emit('deployment', message.data as DeploymentUpdate);
 this.showDeploymentNotification(message.data);
 break;
 case 'alert':
 this.emit('alert', message.data as AlertUpdate);
 this.showAlertNotification(message.data);
 break;
 case 'health':
 this.emit('health', message.data);
 break;
 case 'log':
 this.emit('log', message.data);
 break;
 default:
 console.warn('Unknown message type:', message.type);
 }
 }

 private showDeploymentNotification(deployment: DeploymentUpdate) {
 const { status, version } = deployment.deployment;
 
 switch (status) {
 case 'in_progress':
 toast.loading(`Deploying ${version}...`, { id: deployment.deployment.id });
 break;
 case 'success':
 toast.success(`Successfully deployed ${version}!`, { id: deployment.deployment.id });
 break;
 case 'failed':
 toast.error(`Failed to deploy ${version}`, { id: deployment.deployment.id });
 break;
 }
 }

 private showAlertNotification(alert: AlertUpdate) {
 if (alert.acknowledged) return;
 
 switch (alert.severity) {
 case 'critical':
 toast.error(alert.message, { duration: 10000 });
 break;
 case 'error':
 toast.error(alert.message);
 break;
 case 'warning':
 toast(alert.message, { icon: 'WARNING' });
 break;
 case 'info':
 toast(alert.message, { icon: 'INFO' });
 break;
 }
 }


 // Demo mode implementation
 private startDemoMode() {
 console.log('WebSocket running in demo mode');
 this.emit('connected');
 
 // Simulate random alerts
 setInterval(() => {
 const alerts: AlertUpdate[] = [
 {
 id: `alert-${Date.now()}`,
 entityRef: 'Component:default/user-service',
 severity: 'warning',
 title: 'High Memory Usage',
 message: 'Memory usage exceeded 80% threshold',
 timestamp: new Date().toISOString(),
 acknowledged: false,
 },
 {
 id: `alert-${Date.now()}`,
 entityRef: 'Component:default/payment-service',
 severity: 'error',
 title: 'High Error Rate',
 message: 'Error rate increased to 5.2%',
 timestamp: new Date().toISOString(),
 acknowledged: false,
 },
 ];
 
 if (Math.random() > 0.7) {
 const randomAlert = alerts[Math.floor(Math.random() * alerts.length)];
 this.emit('alert', randomAlert);
 }
 }, 10000);
 }

 private stopDemoMode() {
 this.demoIntervals.forEach(interval => clearInterval(interval));
 this.demoIntervals.clear();
 }

 private startDemoDataForEntity(entityRef: string) {
 if (this.demoIntervals.has(entityRef)) return;
 
 // Simulate metrics updates
 const metricsInterval = setInterval(() => {
 const metrics: MetricsUpdate = {
 entityRef,
 metrics: {
 cpu: Math.random() * 60 + 20 + Math.sin(Date.now() / 10000) * 10,
 memory: Math.random() * 40 + 40 + Math.cos(Date.now() / 8000) * 5,
 requestsPerSecond: Math.random() * 500 + 300 + Math.sin(Date.now() / 5000) * 100,
 errorRate: Math.random() * 2 + Math.sin(Date.now() / 15000),
 responseTime: Math.random() * 50 + 80 + Math.cos(Date.now() / 7000) * 20,
 activeConnections: Math.floor(Math.random() * 30) + 20,
 },
 };
 
 this.emit('metrics', metrics);
 }, 2000);
 
 // Simulate occasional deployments
 const deploymentInterval = setInterval(() => {
 if (Math.random() > 0.9) {
 const deploymentId = `deploy-${Date.now()}`;
 const deployment: DeploymentUpdate = {
 entityRef,
 deployment: {
 id: deploymentId,
 version: `v1.2.${Math.floor(Math.random() * 10)}`,
 status: 'in_progress',
 progress: 0,
 message: 'Starting deployment...',
 },
 };
 
 this.emit('deployment', deployment);
 
 // Simulate deployment progress
 let progress = 0;
 const progressInterval = setInterval(() => {
 progress += 20;
 deployment.deployment.progress = progress;
 
 if (progress >= 100) {
 deployment.deployment.status = Math.random() > 0.1 ? 'success' : 'failed';
 deployment.deployment.message = deployment.deployment.status === 'success' 
 ? 'Deployment completed successfully' 
 : 'Deployment failed: Connection timeout';
 this.emit('deployment', deployment);
 clearInterval(progressInterval);
 } else {
 deployment.deployment.message = `Deploying... ${progress}%`;
 this.emit('deployment', deployment);
 }
 }, 1000);
 }
 }, 30000);
 
 // Store intervals for cleanup
 this.demoIntervals.set(entityRef, metricsInterval);
 this.demoIntervals.set(`${entityRef}-deployment`, deploymentInterval);
 }

 private stopDemoDataForEntity(entityRef: string) {
 const metricsInterval = this.demoIntervals.get(entityRef);
 const deploymentInterval = this.demoIntervals.get(`${entityRef}-deployment`);
 
 if (metricsInterval) {
 clearInterval(metricsInterval);
 this.demoIntervals.delete(entityRef);
 }
 
 if (deploymentInterval) {
 clearInterval(deploymentInterval);
 this.demoIntervals.delete(`${entityRef}-deployment`);
 }
 }
}

// Export singleton instance
export const wsClient = new WebSocketClient();

// Helper hook for React components
import { useEffect, useState } from 'react';

export function useWebSocket() {
 const [isConnected, setIsConnected] = useState(false);

 useEffect(() => {
 const handleConnect = () => setIsConnected(true);
 const handleDisconnect = () => setIsConnected(false);

 wsClient.on('connected', handleConnect);
 wsClient.on('disconnected', handleDisconnect);

 // Connect if not already connected
 if (!isConnected) {
 wsClient.connect();
 }

 return () => {
 wsClient.off('connected', handleConnect);
 wsClient.off('disconnected', handleDisconnect);
 };
 }, []);

 return { isConnected, client: wsClient };
}