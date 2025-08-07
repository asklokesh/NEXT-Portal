/**
 * Real-time Data Integration Provider
 * 
 * Provides real-time data updates for service topology visualization
 * using WebSocket connections, polling strategies, and data transformation.
 */

import React, { 
  createContext, 
  useContext, 
  useReducer, 
  useEffect, 
  useCallback, 
  useMemo,
  useRef
} from 'react';
import {
  ServiceTopologyNode,
  ServiceTopologyEdge,
  TopologyEvent,
  TopologyEventType,
  RealtimeConfig,
  RealtimeSubscription,
  TopologyDataSource,
  DataSourceConfig
} from '../types';

// =============================================
// REAL-TIME DATA STATE MANAGEMENT
// =============================================

interface RealtimeDataState {
  nodes: Map<string, ServiceTopologyNode>;
  edges: Map<string, ServiceTopologyEdge>;
  events: TopologyEvent[];
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastUpdate: Date;
  subscriptions: Map<string, RealtimeSubscription>;
  dataSources: Map<string, TopologyDataSource>;
  metrics: {
    eventsReceived: number;
    nodesUpdated: number;
    edgesUpdated: number;
    updateFrequency: number;
    lastEventTime: Date | null;
  };
}

type RealtimeDataAction =
  | { type: 'SET_CONNECTION_STATUS'; status: RealtimeDataState['connectionStatus'] }
  | { type: 'ADD_NODES'; nodes: ServiceTopologyNode[] }
  | { type: 'UPDATE_NODES'; nodes: Partial<ServiceTopologyNode>[] }
  | { type: 'REMOVE_NODES'; nodeIds: string[] }
  | { type: 'ADD_EDGES'; edges: ServiceTopologyEdge[] }
  | { type: 'UPDATE_EDGES'; edges: Partial<ServiceTopologyEdge>[] }
  | { type: 'REMOVE_EDGES'; edgeIds: string[] }
  | { type: 'ADD_EVENT'; event: TopologyEvent }
  | { type: 'CLEAR_EVENTS' }
  | { type: 'ADD_SUBSCRIPTION'; subscription: RealtimeSubscription }
  | { type: 'REMOVE_SUBSCRIPTION'; subscriptionId: string }
  | { type: 'ADD_DATA_SOURCE'; dataSource: TopologyDataSource }
  | { type: 'UPDATE_DATA_SOURCE'; dataSource: Partial<TopologyDataSource> }
  | { type: 'UPDATE_METRICS'; metrics: Partial<RealtimeDataState['metrics']> };

// =============================================
// REDUCER
// =============================================

const realtimeDataReducer = (
  state: RealtimeDataState,
  action: RealtimeDataAction
): RealtimeDataState => {
  switch (action.type) {
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.status };

    case 'ADD_NODES':
      const newNodes = new Map(state.nodes);
      action.nodes.forEach(node => newNodes.set(node.id, node));
      return { 
        ...state, 
        nodes: newNodes, 
        lastUpdate: new Date(),
        metrics: { 
          ...state.metrics, 
          nodesUpdated: state.metrics.nodesUpdated + action.nodes.length 
        }
      };

    case 'UPDATE_NODES':
      const updatedNodes = new Map(state.nodes);
      action.nodes.forEach(nodeUpdate => {
        const existingNode = updatedNodes.get(nodeUpdate.id!);
        if (existingNode) {
          updatedNodes.set(nodeUpdate.id!, { ...existingNode, ...nodeUpdate });
        }
      });
      return { 
        ...state, 
        nodes: updatedNodes, 
        lastUpdate: new Date(),
        metrics: { 
          ...state.metrics, 
          nodesUpdated: state.metrics.nodesUpdated + action.nodes.length 
        }
      };

    case 'REMOVE_NODES':
      const filteredNodes = new Map(state.nodes);
      action.nodeIds.forEach(nodeId => filteredNodes.delete(nodeId));
      return { ...state, nodes: filteredNodes, lastUpdate: new Date() };

    case 'ADD_EDGES':
      const newEdges = new Map(state.edges);
      action.edges.forEach(edge => newEdges.set(edge.id, edge));
      return { 
        ...state, 
        edges: newEdges, 
        lastUpdate: new Date(),
        metrics: { 
          ...state.metrics, 
          edgesUpdated: state.metrics.edgesUpdated + action.edges.length 
        }
      };

    case 'UPDATE_EDGES':
      const updatedEdges = new Map(state.edges);
      action.edges.forEach(edgeUpdate => {
        const existingEdge = updatedEdges.get(edgeUpdate.id!);
        if (existingEdge) {
          updatedEdges.set(edgeUpdate.id!, { ...existingEdge, ...edgeUpdate });
        }
      });
      return { 
        ...state, 
        edges: updatedEdges, 
        lastUpdate: new Date(),
        metrics: { 
          ...state.metrics, 
          edgesUpdated: state.metrics.edgesUpdated + action.edges.length 
        }
      };

    case 'REMOVE_EDGES':
      const filteredEdges = new Map(state.edges);
      action.edgeIds.forEach(edgeId => filteredEdges.delete(edgeId));
      return { ...state, edges: filteredEdges, lastUpdate: new Date() };

    case 'ADD_EVENT':
      const events = [action.event, ...state.events.slice(0, 999)]; // Keep last 1000 events
      return { 
        ...state, 
        events, 
        lastUpdate: new Date(),
        metrics: {
          ...state.metrics,
          eventsReceived: state.metrics.eventsReceived + 1,
          lastEventTime: action.event.timestamp
        }
      };

    case 'CLEAR_EVENTS':
      return { ...state, events: [] };

    case 'ADD_SUBSCRIPTION':
      const newSubscriptions = new Map(state.subscriptions);
      newSubscriptions.set(action.subscription.eventTypes.join(','), action.subscription);
      return { ...state, subscriptions: newSubscriptions };

    case 'REMOVE_SUBSCRIPTION':
      const filteredSubscriptions = new Map(state.subscriptions);
      filteredSubscriptions.delete(action.subscriptionId);
      return { ...state, subscriptions: filteredSubscriptions };

    case 'ADD_DATA_SOURCE':
      const newDataSources = new Map(state.dataSources);
      newDataSources.set(action.dataSource.id, action.dataSource);
      return { ...state, dataSources: newDataSources };

    case 'UPDATE_DATA_SOURCE':
      const updatedDataSources = new Map(state.dataSources);
      const existingDataSource = updatedDataSources.get(action.dataSource.id!);
      if (existingDataSource) {
        updatedDataSources.set(action.dataSource.id!, { ...existingDataSource, ...action.dataSource });
      }
      return { ...state, dataSources: updatedDataSources };

    case 'UPDATE_METRICS':
      return {
        ...state,
        metrics: { ...state.metrics, ...action.metrics }
      };

    default:
      return state;
  }
};

// =============================================
// CONTEXT
// =============================================

interface RealtimeDataContextValue {
  // State
  nodes: ServiceTopologyNode[];
  edges: ServiceTopologyEdge[];
  events: TopologyEvent[];
  connectionStatus: RealtimeDataState['connectionStatus'];
  metrics: RealtimeDataState['metrics'];
  
  // Actions
  subscribe: (subscription: Omit<RealtimeSubscription, 'callback'> & { 
    callback: (event: TopologyEvent) => void 
  }) => () => void;
  addDataSource: (dataSource: TopologyDataSource) => void;
  updateDataSource: (id: string, updates: Partial<TopologyDataSource>) => void;
  clearEvents: () => void;
  
  // Connection management
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
}

const RealtimeDataContext = createContext<RealtimeDataContextValue | null>(null);

// =============================================
// WEBSOCKET MANAGER
// =============================================

class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: RealtimeConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  
  constructor(
    config: RealtimeConfig,
    private onEvent: (event: TopologyEvent) => void,
    private onStatusChange: (status: RealtimeDataState['connectionStatus']) => void
  ) {
    this.config = config;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    
    this.onStatusChange('connecting');
    
    try {
      this.ws = new WebSocket(this.config.websocketUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.onStatusChange('connected');
        this.reconnectAttempts = 0;
        this.startPing();
        
        // Subscribe to configured event types
        this.config.subscriptions.forEach(subscription => {
          this.subscribe(subscription);
        });
      };
      
      this.ws.onmessage = (event) => {
        try {
          const topologyEvent: TopologyEvent = JSON.parse(event.data);
          this.onEvent(topologyEvent);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.reason);
        this.onStatusChange('disconnected');
        this.stopPing();
        
        if (!event.wasClean && this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onStatusChange('error');
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.onStatusChange('error');
    }
  }

  disconnect(): void {
    this.stopPing();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );
    
    this.reconnectAttempts++;
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private subscribe(subscription: RealtimeSubscription): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        eventTypes: subscription.eventTypes,
        filters: subscription.filters
      }));
    }
  }
}

// =============================================
// DATA SOURCE MANAGER
// =============================================

class DataSourceManager {
  private sources: Map<string, TopologyDataSource> = new Map();
  private pollingTimers: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(
    private onDataUpdate: (nodes: ServiceTopologyNode[], edges: ServiceTopologyEdge[]) => void
  ) {}

  addSource(source: TopologyDataSource): void {
    this.sources.set(source.id, source);
    
    if (source.config.refreshInterval > 0) {
      this.startPolling(source);
    }
    
    // Initial data fetch
    this.fetchData(source);
  }

  removeSource(sourceId: string): void {
    const timer = this.pollingTimers.get(sourceId);
    if (timer) {
      clearInterval(timer);
      this.pollingTimers.delete(sourceId);
    }
    
    this.sources.delete(sourceId);
  }

  private startPolling(source: TopologyDataSource): void {
    const timer = setInterval(() => {
      this.fetchData(source);
    }, source.config.refreshInterval * 1000);
    
    this.pollingTimers.set(source.id, timer);
  }

  private async fetchData(source: TopologyDataSource): Promise<void> {
    try {
      switch (source.type) {
        case 'catalog':
          await this.fetchCatalogData(source);
          break;
        case 'kubernetes':
          await this.fetchKubernetesData(source);
          break;
        case 'prometheus':
          await this.fetchPrometheusData(source);
          break;
        case 'custom':
          await this.fetchCustomData(source);
          break;
      }
    } catch (error) {
      console.error(`Failed to fetch data from source ${source.id}:`, error);
    }
  }

  private async fetchCatalogData(source: TopologyDataSource): Promise<void> {
    // Implement Backstage catalog data fetching
    if (!source.config.endpoint) return;
    
    const response = await fetch(`${source.config.endpoint}/entities`, {
      headers: {
        'Content-Type': 'application/json',
        ...source.config.customHeaders
      }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const entities = await response.json();
    const { nodes, edges } = this.transformCatalogData(entities);
    
    this.onDataUpdate(nodes, edges);
  }

  private async fetchKubernetesData(source: TopologyDataSource): Promise<void> {
    // Implement Kubernetes data fetching
    // This would typically use the Kubernetes API
  }

  private async fetchPrometheusData(source: TopologyDataSource): Promise<void> {
    // Implement Prometheus metrics fetching
    if (!source.config.endpoint) return;
    
    const query = source.config.query || 'up';
    const response = await fetch(
      `${source.config.endpoint}/api/v1/query?query=${encodeURIComponent(query)}`
    );
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const result = await response.json();
    // Transform Prometheus metrics into node/edge updates
    this.applyMetricsToNodes(result.data.result);
  }

  private async fetchCustomData(source: TopologyDataSource): Promise<void> {
    // Implement custom data source fetching
    if (!source.config.endpoint) return;
    
    const response = await fetch(source.config.endpoint, {
      headers: source.config.customHeaders
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    
    // Apply custom transformation if specified
    if (source.config.transformation) {
      // Execute transformation function
      // This would be a more complex implementation in practice
    }
  }

  private transformCatalogData(entities: any[]): { nodes: ServiceTopologyNode[]; edges: ServiceTopologyEdge[] } {
    const nodes: ServiceTopologyNode[] = [];
    const edges: ServiceTopologyEdge[] = [];
    
    entities.forEach(entity => {
      // Transform Backstage entity to ServiceTopologyNode
      const node: ServiceTopologyNode = {
        id: `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`,
        type: entity.kind.toLowerCase() as any,
        position: { x: 0, y: 0 }, // Will be positioned by layout engine
        data: {
          entity,
          label: entity.metadata.name,
          kind: entity.kind,
          namespace: entity.metadata.namespace || 'default',
          name: entity.metadata.name,
          title: entity.metadata.title,
          description: entity.metadata.description,
          color: '#3B82F6',
          icon: 'service',
          size: 'medium',
          shape: 'rectangle',
          health: {
            status: 'healthy',
            score: 100,
            checks: [],
            lastCheck: new Date(),
            trends: []
          },
          status: {
            deployment: 'deployed',
            version: '1.0.0',
            environment: 'production'
          },
          lastUpdated: new Date(),
          metrics: {
            cpu: { current: 0, average: 0, peak: 0, unit: '%', trend: 'stable', history: [] },
            memory: { current: 0, average: 0, peak: 0, unit: 'MB', trend: 'stable', history: [] },
            disk: { current: 0, average: 0, peak: 0, unit: 'GB', trend: 'stable', history: [] },
            network: { 
              inbound: { current: 0, average: 0, peak: 0, unit: 'Mbps', trend: 'stable', history: [] },
              outbound: { current: 0, average: 0, peak: 0, unit: 'Mbps', trend: 'stable', history: [] },
              connections: 0 
            },
            requests: { rps: 0, p50: 0, p95: 0, p99: 0, totalRequests: 0 },
            errors: { rate: 0, count: 0, by4xx: 0, by5xx: 0, topErrors: [] },
            custom: {}
          },
          relationships: [],
          layer: 'application' as any,
          owner: entity.spec?.owner,
          team: entity.metadata.annotations?.['team'] || entity.spec?.owner,
          tags: entity.metadata.tags || [],
          criticality: 'medium',
          lifecycle: entity.spec?.lifecycle || 'production',
          focused: false,
          selected: false,
          highlighted: false,
          collapsed: false,
          customProperties: {}
        }
      };
      
      nodes.push(node);
      
      // Extract relationships and create edges
      if (entity.relations) {
        entity.relations.forEach((relation: any) => {
          const edge: ServiceTopologyEdge = {
            id: `${node.id}-${relation.type}-${relation.targetRef}`,
            source: node.id,
            target: relation.targetRef,
            type: 'dependency',
            data: {
              label: relation.type,
              relation: relation.type,
              direction: 'unidirectional',
              color: '#64748B',
              thickness: 2,
              style: 'solid',
              healthy: true,
              lastActive: new Date(),
              tags: [],
              encrypted: false
            }
          };
          
          edges.push(edge);
        });
      }
    });
    
    return { nodes, edges };
  }

  private applyMetricsToNodes(metrics: any[]): void {
    // Apply Prometheus metrics to existing nodes
    // This would update node health, CPU, memory, etc.
  }

  destroy(): void {
    this.pollingTimers.forEach(timer => clearInterval(timer));
    this.pollingTimers.clear();
    this.sources.clear();
  }
}

// =============================================
// PROVIDER COMPONENT
// =============================================

interface RealtimeDataProviderProps {
  config?: Partial<RealtimeConfig>;
  children: React.ReactNode;
  initialNodes?: ServiceTopologyNode[];
  initialEdges?: ServiceTopologyEdge[];
}

export const RealtimeDataProvider: React.FC<RealtimeDataProviderProps> = ({
  config,
  children,
  initialNodes = [],
  initialEdges = []
}) => {
  // State
  const [state, dispatch] = useReducer(realtimeDataReducer, {
    nodes: new Map(initialNodes.map(n => [n.id, n])),
    edges: new Map(initialEdges.map(e => [e.id, e])),
    events: [],
    connectionStatus: 'disconnected',
    lastUpdate: new Date(),
    subscriptions: new Map(),
    dataSources: new Map(),
    metrics: {
      eventsReceived: 0,
      nodesUpdated: 0,
      edgesUpdated: 0,
      updateFrequency: 0,
      lastEventTime: null
    }
  });

  // Managers
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const dataSourceManagerRef = useRef<DataSourceManager | null>(null);

  // Initialize managers
  useEffect(() => {
    const realtimeConfig: RealtimeConfig = {
      enabled: true,
      websocketUrl: 'ws://localhost:8080/ws',
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      subscriptions: [],
      ...config
    };

    // Initialize WebSocket manager
    if (realtimeConfig.enabled && realtimeConfig.websocketUrl) {
      wsManagerRef.current = new WebSocketManager(
        realtimeConfig,
        (event) => dispatch({ type: 'ADD_EVENT', event }),
        (status) => dispatch({ type: 'SET_CONNECTION_STATUS', status })
      );
    }

    // Initialize data source manager
    dataSourceManagerRef.current = new DataSourceManager(
      (nodes, edges) => {
        dispatch({ type: 'ADD_NODES', nodes });
        dispatch({ type: 'ADD_EDGES', edges });
      }
    );

    return () => {
      wsManagerRef.current?.disconnect();
      dataSourceManagerRef.current?.destroy();
    };
  }, [config]);

  // Event handlers
  const handleEvent = useCallback((event: TopologyEvent) => {
    dispatch({ type: 'ADD_EVENT', event });
    
    // Process different event types
    switch (event.type) {
      case 'node-updated':
        dispatch({ 
          type: 'UPDATE_NODES', 
          nodes: [event.data as Partial<ServiceTopologyNode>] 
        });
        break;
      case 'edge-updated':
        dispatch({ 
          type: 'UPDATE_EDGES', 
          edges: [event.data as Partial<ServiceTopologyEdge>] 
        });
        break;
      case 'health-changed':
        // Update node health
        const nodeUpdate = {
          id: event.source,
          data: {
            health: event.data as any
          }
        };
        dispatch({ type: 'UPDATE_NODES', nodes: [nodeUpdate as any] });
        break;
    }
  }, []);

  // Context value
  const contextValue = useMemo<RealtimeDataContextValue>(() => ({
    // State
    nodes: Array.from(state.nodes.values()),
    edges: Array.from(state.edges.values()),
    events: state.events,
    connectionStatus: state.connectionStatus,
    metrics: state.metrics,
    
    // Actions
    subscribe: (subscription) => {
      const fullSubscription: RealtimeSubscription = {
        ...subscription,
        callback: handleEvent
      };
      
      dispatch({ type: 'ADD_SUBSCRIPTION', subscription: fullSubscription });
      
      return () => {
        dispatch({ 
          type: 'REMOVE_SUBSCRIPTION', 
          subscriptionId: subscription.eventTypes.join(',') 
        });
      };
    },
    
    addDataSource: (dataSource) => {
      dispatch({ type: 'ADD_DATA_SOURCE', dataSource });
      dataSourceManagerRef.current?.addSource(dataSource);
    },
    
    updateDataSource: (id, updates) => {
      dispatch({ type:'UPDATE_DATA_SOURCE', dataSource: { id, ...updates } });
    },
    
    clearEvents: () => {
      dispatch({ type: 'CLEAR_EVENTS' });
    },
    
    // Connection management
    connect: () => {
      wsManagerRef.current?.connect();
    },
    
    disconnect: () => {
      wsManagerRef.current?.disconnect();
    },
    
    reconnect: () => {
      wsManagerRef.current?.disconnect();
      setTimeout(() => wsManagerRef.current?.connect(), 1000);
    }
  }), [state, handleEvent]);

  return (
    <RealtimeDataContext.Provider value={contextValue}>
      {children}
    </RealtimeDataContext.Provider>
  );
};

// =============================================
// HOOK
// =============================================

export const useRealtimeData = (): RealtimeDataContextValue => {
  const context = useContext(RealtimeDataContext);
  if (!context) {
    throw new Error('useRealtimeData must be used within a RealtimeDataProvider');
  }
  return context;
};