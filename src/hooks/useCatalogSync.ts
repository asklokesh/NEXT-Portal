/**
 * React hook for catalog synchronization
 * Provides real-time updates and sync status for catalog components
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSyncEngine, type useSyncEngine } from '@/lib/sync/RealtimeSyncEngine';
import type { Entity } from '@/services/backstage/types/entities';

interface SyncStatus {
 connected: boolean;
 method: 'websocket' | 'polling' | 'none';
 lastSync: Date | null;
 syncing: boolean;
 error: string | null;
}

interface UseCatalogSyncOptions {
 autoStart?: boolean;
 onEntityUpdated?: (entity: Entity) => void;
 onEntityDeleted?: (entityRef: string) => void;
 onCatalogRefreshed?: () => void;
 entityFilter?: (entityRef: string) => boolean;
}

interface UseCatalogSyncReturn {
 status: SyncStatus;
 triggerSync: () => Promise<void>;
 startSync: () => Promise<void>;
 stopSync: () => void;
 addCustomListener: (id: string, callback: (event: any) => void) => void;
 removeCustomListener: (id: string) => void;
}

export function useCatalogSync(options: UseCatalogSyncOptions = {}): UseCatalogSyncReturn {
 const {
 autoStart = true,
 onEntityUpdated,
 onEntityDeleted,
 onCatalogRefreshed,
 entityFilter,
 } = options;

 const [status, setStatus] = useState<SyncStatus>({
 connected: false,
 method: 'none',
 lastSync: null,
 syncing: false,
 error: null,
 });

 const syncEngine = useRef(getSyncEngine());
 const listenerIds = useRef<string[]>([]);

 // Update status from sync engine
 const updateStatus = useCallback(() => {
 const engineStatus = syncEngine.current.getStatus();
 setStatus(prev => ({
 ...prev,
 connected: engineStatus.connected,
 method: engineStatus.method,
 lastSync: engineStatus.lastSync,
 }));
 }, []);

 // Setup event listeners
 useEffect(() => {
 const engine = syncEngine.current;

 // Main sync listener
 const mainListenerId = 'catalog-sync-main';
 engine.addListener(
 mainListenerId,
 (event) => {
 updateStatus();

 switch (event.type) {
 case 'entity.created':
 case 'entity.updated':
 if (event.data && onEntityUpdated) {
 if (!entityFilter || entityFilter(event.entityRef || '')) {
 onEntityUpdated(event.data);
 }
 }
 break;

 case 'entity.deleted':
 if (event.entityRef && onEntityDeleted) {
 if (!entityFilter || entityFilter(event.entityRef)) {
 onEntityDeleted(event.entityRef);
 }
 }
 break;

 case 'catalog.refreshed':
 if (onCatalogRefreshed) {
 onCatalogRefreshed();
 }
 break;
 }
 },
 (event) => {
 // Filter events if needed
 if (entityFilter && event.entityRef) {
 return entityFilter(event.entityRef);
 }
 return true;
 }
 );

 listenerIds.current.push(mainListenerId);

 // Status update listener
 const statusListenerId = 'catalog-sync-status';
 engine.addListener(statusListenerId, () => {
 updateStatus();
 });

 listenerIds.current.push(statusListenerId);

 // Cleanup
 return () => {
 listenerIds.current.forEach(id => {
 engine.removeListener(id);
 });
 listenerIds.current = [];
 };
 }, [onEntityUpdated, onEntityDeleted, onCatalogRefreshed, entityFilter, updateStatus]);

 // Start sync engine
 const startSync = useCallback(async () => {
 try {
 setStatus(prev => ({ ...prev, syncing: true, error: null }));
 await syncEngine.current.start();
 updateStatus();
 } catch (error) {
 console.error('Failed to start sync engine:', error);
 setStatus(prev => ({
 ...prev,
 syncing: false,
 error: error instanceof Error ? error.message : 'Failed to start sync',
 }));
 } finally {
 setStatus(prev => ({ ...prev, syncing: false }));
 }
 }, [updateStatus]);

 // Stop sync engine
 const stopSync = useCallback(() => {
 syncEngine.current.stop();
 updateStatus();
 }, [updateStatus]);

 // Trigger manual sync
 const triggerSync = useCallback(async () => {
 try {
 setStatus(prev => ({ ...prev, syncing: true, error: null }));
 await syncEngine.current.triggerSync();
 updateStatus();
 } catch (error) {
 console.error('Failed to trigger sync:', error);
 setStatus(prev => ({
 ...prev,
 error: error instanceof Error ? error.message : 'Failed to trigger sync',
 }));
 } finally {
 setStatus(prev => ({ ...prev, syncing: false }));
 }
 }, [updateStatus]);

 // Add custom listener
 const addCustomListener = useCallback((id: string, callback: (event: any) => void) => {
 syncEngine.current.addListener(id, callback);
 listenerIds.current.push(id);
 }, []);

 // Remove custom listener
 const removeCustomListener = useCallback((id: string) => {
 syncEngine.current.removeListener(id);
 listenerIds.current = listenerIds.current.filter(listenerId => listenerId !== id);
 }, []);

 // Auto-start if enabled
 useEffect(() => {
 if (autoStart) {
 startSync();
 }

 // Cleanup on unmount
 return () => {
 if (autoStart) {
 stopSync();
 }
 };
 }, [autoStart, startSync, stopSync]);

 // Update status periodically
 useEffect(() => {
 const interval = setInterval(updateStatus, 5000); // Update every 5 seconds
 return () => clearInterval(interval);
 }, [updateStatus]);

 return {
 status,
 triggerSync,
 startSync,
 stopSync,
 addCustomListener,
 removeCustomListener,
 };
}

/**
 * Hook for simple catalog refresh functionality
 */
export function useCatalogRefresh(): {
 refreshing: boolean;
 refresh: () => Promise<void>;
 lastRefresh: Date | null;
} {
 const [refreshing, setRefreshing] = useState(false);
 const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

 const refresh = useCallback(async () => {
 setRefreshing(true);
 try {
 const syncEngine = getSyncEngine();
 await syncEngine.triggerSync();
 setLastRefresh(new Date());
 } finally {
 setRefreshing(false);
 }
 }, []);

 return {
 refreshing,
 refresh,
 lastRefresh,
 };
}

/**
 * Hook for monitoring sync connection status
 */
export function useSyncStatus(): {
 connected: boolean;
 method: 'websocket' | 'polling' | 'none';
 lastSync: Date | null;
 retries: number;
} {
 const [status, setStatus] = useState(() => getSyncEngine().getStatus());

 useEffect(() => {
 const engine = getSyncEngine();
 const listenerId = 'sync-status-monitor';

 engine.addListener(listenerId, () => {
 setStatus(engine.getStatus());
 });

 // Update immediately
 setStatus(engine.getStatus());

 // Update periodically
 const interval = setInterval(() => {
 setStatus(engine.getStatus());
 }, 2000);

 return () => {
 engine.removeListener(listenerId);
 clearInterval(interval);
 };
 }, []);

 return status;
}