import { useEffect, useState, useCallback, useRef } from 'react';
import { webSocketService, type EntityUpdate, type MetricsUpdate, type DeploymentUpdate, type HealthUpdate } from '@/lib/websocket/WebSocketService';

// Hook for WebSocket connection status
export function useWebSocketConnection() {
 const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
 const [error, setError] = useState<string | null>(null);

 useEffect(() => {
 const connectWebSocket = async () => {
 try {
 setConnectionState('connecting');
 setError(null);
 await webSocketService.connect();
 setConnectionState('connected');
 } catch (err) {
 console.error('WebSocket connection failed:', err);
 setError(err instanceof Error ? err.message : 'Connection failed');
 setConnectionState('error');
 }
 };

 connectWebSocket();

 // Cleanup on unmount
 return () => {
 webSocketService.disconnect();
 };
 }, []);

 // Poll connection state
 useEffect(() => {
 const interval = setInterval(() => {
 const currentState = webSocketService.getConnectionState();
 setConnectionState(currentState);
 }, 1000);

 return () => clearInterval(interval);
 }, []);

 const reconnect = useCallback(async () => {
 try {
 setConnectionState('connecting');
 setError(null);
 await webSocketService.connect();
 setConnectionState('connected');
 } catch (err) {
 console.error('WebSocket reconnection failed:', err);
 setError(err instanceof Error ? err.message : 'Reconnection failed');
 setConnectionState('error');
 }
 }, []);

 return {
 connectionState,
 isConnected: connectionState === 'connected',
 error,
 reconnect
 };
}

// Hook for real-time entity updates
export function useEntityUpdates() {
 const [updates, setUpdates] = useState<EntityUpdate[]>([]);
 const [lastUpdate, setLastUpdate] = useState<EntityUpdate | null>(null);

 useEffect(() => {
 const unsubscribe = webSocketService.subscribeToEntityUpdates((update) => {
 setLastUpdate(update);
 setUpdates(prev => [update, ...prev.slice(0, 99)]); // Keep last 100 updates
 });

 return unsubscribe;
 }, []);

 const clearUpdates = useCallback(() => {
 setUpdates([]);
 setLastUpdate(null);
 }, []);

 return {
 updates,
 lastUpdate,
 clearUpdates
 };
}

// Hook for real-time metrics updates
export function useMetricsUpdates(entityRef: string) {
 const [metrics, setMetrics] = useState<MetricsUpdate['metrics'] | null>(null);
 const [lastUpdated, setLastUpdated] = useState<string | null>(null);
 const entityRefRef = useRef(entityRef);

 useEffect(() => {
 entityRefRef.current = entityRef;
 }, [entityRef]);

 useEffect(() => {
 if (!entityRef) return;

 const unsubscribe = webSocketService.subscribeToMetricsUpdates(entityRef, (update) => {
 if (update.entityRef === entityRefRef.current) {
 setMetrics(update.metrics);
 setLastUpdated(new Date().toISOString());
 }
 });

 return unsubscribe;
 }, [entityRef]);

 return {
 metrics,
 lastUpdated,
 hasData: metrics !== null
 };
}

// Hook for real-time deployment updates
export function useDeploymentUpdates(entityRef: string) {
 const [deployments, setDeployments] = useState<DeploymentUpdate['deployment'][]>([]);
 const [lastDeployment, setLastDeployment] = useState<DeploymentUpdate['deployment'] | null>(null);
 const entityRefRef = useRef(entityRef);

 useEffect(() => {
 entityRefRef.current = entityRef;
 }, [entityRef]);

 useEffect(() => {
 if (!entityRef) return;

 const unsubscribe = webSocketService.subscribeToDeploymentUpdates(entityRef, (update) => {
 if (update.entityRef === entityRefRef.current) {
 setLastDeployment(update.deployment);
 setDeployments(prev => {
 // Replace existing deployment or add new one
 const existingIndex = prev.findIndex(d => d.id === update.deployment.id);
 if (existingIndex >= 0) {
 const newDeployments = [...prev];
 newDeployments[existingIndex] = update.deployment;
 return newDeployments;
 }
 return [update.deployment, ...prev];
 });
 }
 });

 return unsubscribe;
 }, [entityRef]);

 return {
 deployments,
 lastDeployment,
 hasDeployments: deployments.length > 0
 };
}

// Hook for real-time health updates
export function useHealthUpdates(entityRef: string) {
 const [health, setHealth] = useState<HealthUpdate['health'] | null>(null);
 const [healthHistory, setHealthHistory] = useState<HealthUpdate['health'][]>([]);
 const entityRefRef = useRef(entityRef);

 useEffect(() => {
 entityRefRef.current = entityRef;
 }, [entityRef]);

 useEffect(() => {
 if (!entityRef) return;

 const unsubscribe = webSocketService.subscribeToHealthUpdates(entityRef, (update) => {
 if (update.entityRef === entityRefRef.current) {
 setHealth(update.health);
 setHealthHistory(prev => [update.health, ...prev.slice(0, 49)]); // Keep last 50 health updates
 }
 });

 return unsubscribe;
 }, [entityRef]);

 return {
 health,
 healthHistory,
 hasHealthData: health !== null
 };
}

// Hook for catalog-wide updates
export function useCatalogUpdates() {
 const [catalogUpdates, setCatalogUpdates] = useState<EntityUpdate[]>([]);
 const [lastCatalogUpdate, setLastCatalogUpdate] = useState<EntityUpdate | null>(null);
 const [entitiesCount, setEntitiesCount] = useState({ created: 0, updated: 0, deleted: 0 });

 useEffect(() => {
 const unsubscribe = webSocketService.subscribeToCatalogUpdates((update) => {
 setLastCatalogUpdate(update);
 setCatalogUpdates(prev => [update, ...prev.slice(0, 199)]); // Keep last 200 updates
 
 // Update counters
 setEntitiesCount(prev => ({
 ...prev,
 [update.changeType]: prev[update.changeType] + 1
 }));
 });

 return unsubscribe;
 }, []);

 const clearCatalogUpdates = useCallback(() => {
 setCatalogUpdates([]);
 setLastCatalogUpdate(null);
 setEntitiesCount({ created: 0, updated: 0, deleted: 0 });
 }, []);

 return {
 catalogUpdates,
 lastCatalogUpdate,
 entitiesCount,
 clearCatalogUpdates
 };
}

// Generic hook for custom WebSocket subscriptions
export function useWebSocketSubscription<T>(
 messageType: string,
 handler: (data: T) => void,
 deps: React.DependencyList = []
) {
 useEffect(() => {
 const unsubscribe = webSocketService.subscribe(messageType, (message) => {
 handler(message.data as T);
 });

 return unsubscribe;
 }, deps);
}

// Hook for sending WebSocket messages
export function useWebSocketSender() {
 const send = useCallback((type: string, data: any, entityRef?: string) => {
 webSocketService.send({
 type,
 data,
 entityRef
 });
 }, []);

 return { send };
}