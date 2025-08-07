/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, no-console */

import { EventEmitter } from 'events';

import type { WebSocketMessage, WebSocketSubscription } from '../types';

export class DashboardWebSocketService extends EventEmitter {
 private ws: WebSocket | null = null;
 private url: string;
 private reconnectTimeout: number = 5000;
 private reconnectAttempts: number = 0;
 private maxReconnectAttempts: number = 10;
 private subscriptions: Map<string, WebSocketSubscription> = new Map();
 private heartbeatInterval: NodeJS.Timeout | null = null;
 private isIntentionallyClosed: boolean = false;

 constructor(url: string) {
 super();
 this.url = url;
 }

 connect(): void {
 if (this.ws?.readyState === WebSocket.OPEN) {
 return;
 }

 this.isIntentionallyClosed = false;
 
 try {
 this.ws = new WebSocket(this.url);
 this.setupEventHandlers();
 } catch (error) {
 console.error('WebSocket connection error:', error);
 this.scheduleReconnect();
 }
 }

 disconnect(): void {
 this.isIntentionallyClosed = true;
 this.cleanup();
 }

 private setupEventHandlers(): void {
 if (!this.ws) return;

 this.ws.onopen = () => {
 console.log('WebSocket connected');
 this.reconnectAttempts = 0;
 this.emit('connected');
 this.startHeartbeat();
 this.resubscribeAll();
 };

 this.ws.onmessage = (event) => {
 try {
 const message: WebSocketMessage = JSON.parse(event.data);
 this.handleMessage(message);
 } catch (error) {
 console.error('Failed to parse WebSocket message:', error);
 }
 };

 this.ws.onerror = (error) => {
 console.error('WebSocket error:', error);
 this.emit('error', error);
 };

 this.ws.onclose = () => {
 console.log('WebSocket disconnected');
 this.emit('disconnected');
 this.cleanup();
 
 if (!this.isIntentionallyClosed) {
 this.scheduleReconnect();
 }
 };
 }

 private handleMessage(message: WebSocketMessage): void {
 // Emit type-specific events
 this.emit(`${message.type}:${message.action}`, message.payload);
 
 // Emit widget-specific events
 if (message.payload.widgetId) {
 this.emit(`widget:${message.payload.widgetId}`, message);
 }
 
 // Emit metric-specific events
 if (message.payload.metric) {
 this.emit(`metric:${message.payload.metric}`, message.payload);
 }
 }

 subscribe(subscription: WebSocketSubscription): string {
 const subscriptionId = `${subscription.dashboardId}-${Date.now()}`;
 this.subscriptions.set(subscriptionId, subscription);
 
 if (this.ws?.readyState === WebSocket.OPEN) {
 this.send({
 type: 'subscribe',
 payload: subscription
 });
 }
 
 return subscriptionId;
 }

 unsubscribe(subscriptionId: string): void {
 const subscription = this.subscriptions.get(subscriptionId);
 if (subscription && this.ws?.readyState === WebSocket.OPEN) {
 this.send({
 type: 'unsubscribe',
 payload: { subscriptionId }
 });
 }
 this.subscriptions.delete(subscriptionId);
 }

 send(data: any): void {
 if (this.ws?.readyState === WebSocket.OPEN) {
 this.ws.send(JSON.stringify(data));
 } else {
 console.warn('WebSocket is not connected');
 }
 }

 private startHeartbeat(): void {
 this.stopHeartbeat();
 this.heartbeatInterval = setInterval(() => {
 if (this.ws?.readyState === WebSocket.OPEN) {
 this.send({ type: 'ping' });
 }
 }, 30000); // 30 seconds
 }

 private stopHeartbeat(): void {
 if (this.heartbeatInterval) {
 clearInterval(this.heartbeatInterval);
 this.heartbeatInterval = null;
 }
 }

 private resubscribeAll(): void {
 this.subscriptions.forEach((subscription) => {
 this.send({
 type: 'subscribe',
 payload: subscription
 });
 });
 }

 private scheduleReconnect(): void {
 if (this.reconnectAttempts >= this.maxReconnectAttempts) {
 console.error('Max reconnection attempts reached');
 this.emit('maxReconnectAttemptsReached');
 return;
 }

 this.reconnectAttempts++;
 const delay = this.reconnectTimeout * Math.pow(1.5, this.reconnectAttempts - 1);
 
 console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
 
 setTimeout(() => {
 if (!this.isIntentionallyClosed) {
 this.connect();
 }
 }, delay);
 }

 private cleanup(): void {
 this.stopHeartbeat();
 
 if (this.ws) {
 this.ws.onopen = null;
 this.ws.onmessage = null;
 this.ws.onerror = null;
 this.ws.onclose = null;
 this.ws.close();
 this.ws = null;
 }
 }

 isConnected(): boolean {
 return this.ws?.readyState === WebSocket.OPEN;
 }
}

// Singleton instance
let wsService: DashboardWebSocketService | null = null;

export function getWebSocketService(url?: string): DashboardWebSocketService {
 if (!wsService && url) {
 wsService = new DashboardWebSocketService(url);
 }
 
 if (!wsService) {
 throw new Error('WebSocket service not initialized');
 }
 
 return wsService;
}

export function initializeWebSocketService(url: string): DashboardWebSocketService {
 if (wsService) {
 wsService.disconnect();
 }
 
 wsService = new DashboardWebSocketService(url);
 return wsService;
}