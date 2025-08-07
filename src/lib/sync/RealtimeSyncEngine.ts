/**
 * Real-time Sync Engine for Backstage Catalog
 * Handles event-driven updates, WebSocket connections, and data synchronization
 */

import type { Entity } from '@/services/backstage/types/entities';

interface SyncEvent {
 type: 'entity.created' | 'entity.updated' | 'entity.deleted' | 'catalog.refreshed';
 timestamp: string;
 entityRef?: string;
 data?: Entity;
 source: 'backstage' | 'webhook' | 'manual';
}

interface SyncConfig {
 enabled: boolean;
 websocketUrl?: string;
 pollInterval?: number;
 retryAttempts?: number;
 retryDelay?: number;
}

interface SyncListener {
 id: string;
 callback: (event: SyncEvent) => void;
 filter?: (event: SyncEvent) => boolean;
}

export class RealtimeSyncEngine {
 private config: SyncConfig;
 private listeners: Map<string, SyncListener> = new Map();
 private websocket: WebSocket | null = null;
 private pollTimer: NodeJS.Timeout | null = null;
 private lastSync: Date | null = null;
 private connectionRetries = 0;
 private isConnected = false;

 constructor(config: SyncConfig) {
 this.config = {
 enabled: true,
 pollInterval: 30000, // 30 seconds
 retryAttempts: 5,
 retryDelay: 2000, // 2 seconds
 ...config,
 };
 }

 /**
 * Start the sync engine
 */
 async start(): Promise<void> {
 if (!this.config.enabled) {
 console.log('RealtimeSyncEngine: Sync is disabled');
 return;
 }

 console.log('RealtimeSyncEngine: Starting sync engine...');

 // Try WebSocket connection first
 if (this.config.websocketUrl) {
 await this.connectWebSocket();
 }

 // Fallback to polling if WebSocket fails or not configured
 if (!this.isConnected) {
 this.startPolling();
 }

 this.lastSync = new Date();
 }

 /**
 * Stop the sync engine
 */
 stop(): void {
 console.log('RealtimeSyncEngine: Stopping sync engine...');

 if (this.websocket) {
 this.websocket.close();
 this.websocket = null;
 }

 if (this.pollTimer) {
 clearInterval(this.pollTimer);
 this.pollTimer = null;
 }

 this.isConnected = false;
 this.connectionRetries = 0;
 }

 /**
 * Add event listener
 */
 addListener(
 id: string,
 callback: (event: SyncEvent) => void,
 filter?: (event: SyncEvent) => boolean
 ): void {
 this.listeners.set(id, { id, callback, filter });
 }

 /**
 * Remove event listener
 */
 removeListener(id: string): void {
 this.listeners.delete(id);
 }

 /**
 * Emit event to all listeners
 */
 private emit(event: SyncEvent): void {
 for (const listener of this.listeners.values()) {
 if (!listener.filter || listener.filter(event)) {
 try {
 listener.callback(event);
 } catch (error) {
 console.error(`RealtimeSyncEngine: Error in listener ${listener.id}:`, error);
 }
 }
 }
 }

 /**
 * Connect to WebSocket for real-time updates
 */
 private async connectWebSocket(): Promise<void> {
 if (!this.config.websocketUrl) return;

 try {
 this.websocket = new WebSocket(this.config.websocketUrl);

 this.websocket.onopen = () => {
 console.log('RealtimeSyncEngine: WebSocket connected');
 this.isConnected = true;
 this.connectionRetries = 0;

 // Send authentication if needed
 this.websocket?.send(JSON.stringify({
 type: 'auth',
 token: this.getAuthToken(),
 }));

 // Subscribe to catalog events
 this.websocket?.send(JSON.stringify({
 type: 'subscribe',
 topics: ['catalog.*'],
 }));
 };

 this.websocket.onmessage = (event) => {
 try {
 const data = JSON.parse(event.data);
 this.handleWebSocketMessage(data);
 } catch (error) {
 console.error('RealtimeSyncEngine: Failed to parse WebSocket message:', error);
 }
 };

 this.websocket.onclose = (event) => {
 console.log('RealtimeSyncEngine: WebSocket disconnected:', event.code, event.reason);
 this.isConnected = false;
 this.websocket = null;

 // Attempt reconnection
 if (this.connectionRetries < (this.config.retryAttempts || 5)) {
 this.connectionRetries++;
 console.log(`RealtimeSyncEngine: Attempting reconnection ${this.connectionRetries}...`);
 
 setTimeout(() => {
 this.connectWebSocket();
 }, this.config.retryDelay);
 } else {
 console.log('RealtimeSyncEngine: Max reconnection attempts reached, falling back to polling');
 this.startPolling();
 }
 };

 this.websocket.onerror = (error) => {
 console.error('RealtimeSyncEngine: WebSocket error:', error);
 };

 } catch (error) {
 console.error('RealtimeSyncEngine: Failed to connect WebSocket:', error);
 }
 }

 /**
 * Handle WebSocket messages
 */
 private handleWebSocketMessage(data: any): void {
 if (data.type === 'ping') {
 // Respond to ping
 this.websocket?.send(JSON.stringify({ type: 'pong' }));
 return;
 }

 if (data.type === 'catalog_event') {
 const syncEvent: SyncEvent = {
 type: data.event_type,
 timestamp: data.timestamp || new Date().toISOString(),
 entityRef: data.entity_ref,
 data: data.entity,
 source: 'backstage',
 };

 this.emit(syncEvent);
 }
 }

 /**
 * Start polling for updates
 */
 private startPolling(): void {
 if (this.pollTimer) {
 clearInterval(this.pollTimer);
 }

 console.log(`RealtimeSyncEngine: Starting polling every ${this.config.pollInterval}ms`);

 this.pollTimer = setInterval(() => {
 this.pollForUpdates();
 }, this.config.pollInterval);

 // Initial poll
 this.pollForUpdates();
 }

 /**
 * Poll for catalog updates
 */
 private async pollForUpdates(): Promise<void> {
 try {
 const lastSyncParam = this.lastSync ? `?since=${this.lastSync.toISOString()}` : '';
 const response = await fetch(`/api/catalog/entities${lastSyncParam}`, {
 headers: {
 'Accept': 'application/json',
 'Authorization': this.getAuthToken() ? `Bearer ${this.getAuthToken()}` : '',
 },
 });

 if (!response.ok) {
 throw new Error(`Polling failed: ${response.status} ${response.statusText}`);
 }

 const data = await response.json();
 
 if (data.items && data.items.length > 0) {
 // Emit catalog refresh event
 this.emit({
 type: 'catalog.refreshed',
 timestamp: new Date().toISOString(),
 source: 'manual',
 });
 }

 this.lastSync = new Date();
 } catch (error) {
 console.error('RealtimeSyncEngine: Polling error:', error);
 }
 }

 /**
 * Get authentication token
 */
 private getAuthToken(): string | null {
 // In a real implementation, this would get the token from your auth system
 return process.env.BACKSTAGE_API_TOKEN || localStorage.getItem('auth_token') || null;
 }

 /**
 * Manually trigger a sync
 */
 async triggerSync(): Promise<void> {
 console.log('RealtimeSyncEngine: Manual sync triggered');
 
 this.emit({
 type: 'catalog.refreshed',
 timestamp: new Date().toISOString(),
 source: 'manual',
 });
 }

 /**
 * Check if sync engine is connected
 */
 isActive(): boolean {
 return this.isConnected || !!this.pollTimer;
 }

 /**
 * Get sync status
 */
 getStatus(): {
 connected: boolean;
 method: 'websocket' | 'polling' | 'none';
 lastSync: Date | null;
 retries: number;
 } {
 return {
 connected: this.isConnected,
 method: this.isConnected ? 'websocket' : this.pollTimer ? 'polling' : 'none',
 lastSync: this.lastSync,
 retries: this.connectionRetries,
 };
 }
}

// Singleton instance
let syncEngineInstance: RealtimeSyncEngine | null = null;

/**
 * Get or create sync engine instance
 */
export function getSyncEngine(config?: Partial<SyncConfig>): RealtimeSyncEngine {
 if (!syncEngineInstance) {
 const defaultConfig: SyncConfig = {
 enabled: true,
 websocketUrl: process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:4410`,
 pollInterval: 30000,
 retryAttempts: 5,
 retryDelay: 2000,
 };

 syncEngineInstance = new RealtimeSyncEngine({
 ...defaultConfig,
 ...config,
 });
 }

 return syncEngineInstance;
}

/**
 * Utility hook for React components
 */
export function useSyncEngine(config?: Partial<SyncConfig>) {
 const engine = getSyncEngine(config);
 
 return {
 engine,
 addListener: engine.addListener.bind(engine),
 removeListener: engine.removeListener.bind(engine),
 triggerSync: engine.triggerSync.bind(engine),
 getStatus: engine.getStatus.bind(engine),
 isActive: engine.isActive.bind(engine),
 };
}