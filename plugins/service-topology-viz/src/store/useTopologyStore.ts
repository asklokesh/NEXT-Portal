/**
 * Topology Store
 * Zustand-based state management for topology visualization
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  ServiceNode,
  ServiceRelationship,
  VisualizationConfig,
  PerformanceConfig,
  FilterConfig,
  LayoutType,
  RenderMode,
  ViewMode,
  LevelOfDetail,
  ClusteringAlgorithm,
  SelectionMode,
  CacheStrategy,
  Environment,
  ServiceType,
  HealthState,
  CriticalityLevel
} from '../types';

interface TopologyState {
  // Data
  nodes: ServiceNode[];
  edges: ServiceRelationship[];
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  
  // Configuration
  config: VisualizationConfig;
  performanceConfig: PerformanceConfig;
  filters: FilterConfig;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  sidebarOpen: boolean;
  detailsPanelOpen: boolean;
  searchQuery: string;
  
  // History
  history: Array<{ nodes: ServiceNode[]; edges: ServiceRelationship[] }>;
  historyIndex: number;
  maxHistorySize: number;
  
  // Actions - Data
  setNodes: (nodes: ServiceNode[]) => void;
  setEdges: (edges: ServiceRelationship[]) => void;
  addNode: (node: ServiceNode) => void;
  updateNode: (nodeId: string, updates: Partial<ServiceNode>) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: ServiceRelationship) => void;
  updateEdge: (edgeId: string, updates: Partial<ServiceRelationship>) => void;
  removeEdge: (edgeId: string) => void;
  
  // Actions - Selection
  selectNode: (nodeId: string, multi?: boolean) => void;
  deselectNode: (nodeId: string) => void;
  clearNodeSelection: () => void;
  selectEdge: (edgeId: string, multi?: boolean) => void;
  deselectEdge: (edgeId: string) => void;
  clearEdgeSelection: () => void;
  clearAllSelections: () => void;
  
  // Actions - Highlighting
  highlightNode: (nodeId: string) => void;
  unhighlightNode: (nodeId: string) => void;
  clearNodeHighlights: () => void;
  highlightEdge: (edgeId: string) => void;
  unhighlightEdge: (edgeId: string) => void;
  clearEdgeHighlights: () => void;
  highlightPath: (nodeIds: string[]) => void;
  highlightConnections: (nodeId: string) => void;
  
  // Actions - Configuration
  updateConfig: (updates: Partial<VisualizationConfig>) => void;
  updatePerformanceConfig: (updates: Partial<PerformanceConfig>) => void;
  updateFilters: (filters: FilterConfig) => void;
  resetConfig: () => void;
  
  // Actions - UI
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setDetailsPanelOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  
  // Actions - History
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  
  // Actions - Batch Operations
  batchUpdate: (updates: {
    nodes?: ServiceNode[];
    edges?: ServiceRelationship[];
    config?: Partial<VisualizationConfig>;
    filters?: FilterConfig;
  }) => void;
  
  // Actions - Computed
  getFilteredNodes: () => ServiceNode[];
  getFilteredEdges: () => ServiceRelationship[];
  getNodeById: (nodeId: string) => ServiceNode | undefined;
  getEdgeById: (edgeId: string) => ServiceRelationship | undefined;
  getNodesByType: (type: ServiceType) => ServiceNode[];
  getNodesByHealth: (health: HealthState) => ServiceNode[];
  getCriticalNodes: () => ServiceNode[];
  getIncidentNodes: () => ServiceNode[];
  getConnectedNodes: (nodeId: string) => ServiceNode[];
  getUpstreamNodes: (nodeId: string) => ServiceNode[];
  getDownstreamNodes: (nodeId: string) => ServiceNode[];
}

const defaultConfig: VisualizationConfig = {
  layout: LayoutType.FORCE_DIRECTED,
  renderMode: RenderMode.WEBGL,
  viewMode: ViewMode.LOGICAL,
  filters: {},
  clustering: {
    enabled: false,
    algorithm: ClusteringAlgorithm.HIERARCHICAL,
    threshold: 0.5,
    groupBy: []
  },
  animation: {
    enabled: true,
    duration: 300,
    easing: 'easeInOut',
    particleEffects: true,
    trafficAnimation: true,
    healthPulse: true
  },
  interaction: {
    zoom: {
      enabled: true,
      min: 0.1,
      max: 10,
      wheelSensitivity: 0.001,
      doubleTapZoom: true
    },
    pan: true,
    rotate: true,
    select: SelectionMode.SINGLE,
    hover: {
      enabled: true,
      delay: 200,
      showTooltip: true,
      highlightConnections: true,
      dimOthers: true
    },
    contextMenu: true,
    keyboardShortcuts: true
  },
  performance: {
    maxNodes: 1000,
    maxEdges: 5000,
    levelOfDetail: LevelOfDetail.HIGH,
    culling: {
      frustum: true,
      occlusion: false,
      distance: true,
      backface: true
    },
    batching: true,
    instancing: true,
    workers: true,
    caching: {
      enabled: true,
      ttl: 300000,
      maxSize: 100,
      strategy: CacheStrategy.LRU
    }
  }
};

const defaultPerformanceConfig: PerformanceConfig = {
  maxNodes: 1000,
  maxEdges: 5000,
  levelOfDetail: LevelOfDetail.HIGH,
  culling: {
    frustum: true,
    occlusion: false,
    distance: true,
    backface: true
  },
  batching: true,
  instancing: true,
  workers: true,
  caching: {
    enabled: true,
    ttl: 300000,
    maxSize: 100,
    strategy: CacheStrategy.LRU
  }
};

export const useTopologyStore = create<TopologyState>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // Initial state
          nodes: [],
          edges: [],
          selectedNodeIds: new Set(),
          selectedEdgeIds: new Set(),
          highlightedNodeIds: new Set(),
          highlightedEdgeIds: new Set(),
          config: defaultConfig,
          performanceConfig: defaultPerformanceConfig,
          filters: {},
          isLoading: false,
          error: null,
          sidebarOpen: true,
          detailsPanelOpen: false,
          searchQuery: '',
          history: [],
          historyIndex: -1,
          maxHistorySize: 50,

          // Actions - Data
          setNodes: (nodes) => set((state) => {
            state.nodes = nodes;
          }),

          setEdges: (edges) => set((state) => {
            state.edges = edges;
          }),

          addNode: (node) => set((state) => {
            state.nodes.push(node);
          }),

          updateNode: (nodeId, updates) => set((state) => {
            const index = state.nodes.findIndex(n => n.id === nodeId);
            if (index !== -1) {
              Object.assign(state.nodes[index], updates);
            }
          }),

          removeNode: (nodeId) => set((state) => {
            state.nodes = state.nodes.filter(n => n.id !== nodeId);
            state.edges = state.edges.filter(e => 
              e.source !== nodeId && e.target !== nodeId
            );
            state.selectedNodeIds.delete(nodeId);
            state.highlightedNodeIds.delete(nodeId);
          }),

          addEdge: (edge) => set((state) => {
            state.edges.push(edge);
          }),

          updateEdge: (edgeId, updates) => set((state) => {
            const index = state.edges.findIndex(e => e.id === edgeId);
            if (index !== -1) {
              Object.assign(state.edges[index], updates);
            }
          }),

          removeEdge: (edgeId) => set((state) => {
            state.edges = state.edges.filter(e => e.id !== edgeId);
            state.selectedEdgeIds.delete(edgeId);
            state.highlightedEdgeIds.delete(edgeId);
          }),

          // Actions - Selection
          selectNode: (nodeId, multi = false) => set((state) => {
            if (!multi && state.config.interaction.select === SelectionMode.SINGLE) {
              state.selectedNodeIds.clear();
            }
            state.selectedNodeIds.add(nodeId);
          }),

          deselectNode: (nodeId) => set((state) => {
            state.selectedNodeIds.delete(nodeId);
          }),

          clearNodeSelection: () => set((state) => {
            state.selectedNodeIds.clear();
          }),

          selectEdge: (edgeId, multi = false) => set((state) => {
            if (!multi && state.config.interaction.select === SelectionMode.SINGLE) {
              state.selectedEdgeIds.clear();
            }
            state.selectedEdgeIds.add(edgeId);
          }),

          deselectEdge: (edgeId) => set((state) => {
            state.selectedEdgeIds.delete(edgeId);
          }),

          clearEdgeSelection: () => set((state) => {
            state.selectedEdgeIds.clear();
          }),

          clearAllSelections: () => set((state) => {
            state.selectedNodeIds.clear();
            state.selectedEdgeIds.clear();
          }),

          // Actions - Highlighting
          highlightNode: (nodeId) => set((state) => {
            state.highlightedNodeIds.add(nodeId);
          }),

          unhighlightNode: (nodeId) => set((state) => {
            state.highlightedNodeIds.delete(nodeId);
          }),

          clearNodeHighlights: () => set((state) => {
            state.highlightedNodeIds.clear();
          }),

          highlightEdge: (edgeId) => set((state) => {
            state.highlightedEdgeIds.add(edgeId);
          }),

          unhighlightEdge: (edgeId) => set((state) => {
            state.highlightedEdgeIds.delete(edgeId);
          }),

          clearEdgeHighlights: () => set((state) => {
            state.highlightedEdgeIds.clear();
          }),

          highlightPath: (nodeIds) => set((state) => {
            state.highlightedNodeIds.clear();
            state.highlightedEdgeIds.clear();
            
            nodeIds.forEach(id => state.highlightedNodeIds.add(id));
            
            for (let i = 0; i < nodeIds.length - 1; i++) {
              const edge = state.edges.find(e => 
                e.source === nodeIds[i] && e.target === nodeIds[i + 1]
              );
              if (edge) {
                state.highlightedEdgeIds.add(edge.id);
              }
            }
          }),

          highlightConnections: (nodeId) => set((state) => {
            state.highlightedNodeIds.clear();
            state.highlightedEdgeIds.clear();
            state.highlightedNodeIds.add(nodeId);
            
            state.edges.forEach(edge => {
              if (edge.source === nodeId || edge.target === nodeId) {
                state.highlightedEdgeIds.add(edge.id);
                state.highlightedNodeIds.add(
                  edge.source === nodeId ? edge.target : edge.source
                );
              }
            });
          }),

          // Actions - Configuration
          updateConfig: (updates) => set((state) => {
            Object.assign(state.config, updates);
          }),

          updatePerformanceConfig: (updates) => set((state) => {
            Object.assign(state.performanceConfig, updates);
          }),

          updateFilters: (filters) => set((state) => {
            state.filters = filters;
          }),

          resetConfig: () => set((state) => {
            state.config = defaultConfig;
            state.performanceConfig = defaultPerformanceConfig;
          }),

          // Actions - UI
          setLoading: (loading) => set((state) => {
            state.isLoading = loading;
          }),

          setError: (error) => set((state) => {
            state.error = error;
          }),

          setSidebarOpen: (open) => set((state) => {
            state.sidebarOpen = open;
          }),

          setDetailsPanelOpen: (open) => set((state) => {
            state.detailsPanelOpen = open;
          }),

          setSearchQuery: (query) => set((state) => {
            state.searchQuery = query;
          }),

          // Actions - History
          pushHistory: () => set((state) => {
            // Remove any history after current index
            state.history = state.history.slice(0, state.historyIndex + 1);
            
            // Add current state to history
            state.history.push({
              nodes: [...state.nodes],
              edges: [...state.edges]
            });
            
            // Limit history size
            if (state.history.length > state.maxHistorySize) {
              state.history.shift();
            } else {
              state.historyIndex++;
            }
          }),

          undo: () => set((state) => {
            if (state.historyIndex > 0) {
              state.historyIndex--;
              const snapshot = state.history[state.historyIndex];
              state.nodes = snapshot.nodes;
              state.edges = snapshot.edges;
            }
          }),

          redo: () => set((state) => {
            if (state.historyIndex < state.history.length - 1) {
              state.historyIndex++;
              const snapshot = state.history[state.historyIndex];
              state.nodes = snapshot.nodes;
              state.edges = snapshot.edges;
            }
          }),

          clearHistory: () => set((state) => {
            state.history = [];
            state.historyIndex = -1;
          }),

          // Actions - Batch Operations
          batchUpdate: (updates) => set((state) => {
            if (updates.nodes) state.nodes = updates.nodes;
            if (updates.edges) state.edges = updates.edges;
            if (updates.config) Object.assign(state.config, updates.config);
            if (updates.filters) state.filters = updates.filters;
          }),

          // Computed getters
          getFilteredNodes: () => {
            const state = get();
            let filtered = [...state.nodes];

            // Apply filters
            if (state.filters.environments?.length) {
              filtered = filtered.filter(n => 
                state.filters.environments!.includes(n.environment!)
              );
            }

            if (state.filters.serviceTypes?.length) {
              filtered = filtered.filter(n => 
                state.filters.serviceTypes!.includes(n.type)
              );
            }

            if (state.filters.healthStates?.length) {
              filtered = filtered.filter(n => 
                state.filters.healthStates!.includes(n.health.status)
              );
            }

            if (state.filters.tags?.length) {
              filtered = filtered.filter(n => 
                n.tags.some(tag => state.filters.tags!.includes(tag))
              );
            }

            if (state.filters.owners?.length) {
              filtered = filtered.filter(n => 
                state.filters.owners!.includes(n.owner!)
              );
            }

            if (state.filters.criticalityLevels?.length) {
              filtered = filtered.filter(n => 
                state.filters.criticalityLevels!.includes(n.metadata.criticality!)
              );
            }

            // Apply search query
            if (state.searchQuery) {
              const query = state.searchQuery.toLowerCase();
              filtered = filtered.filter(n => 
                n.name.toLowerCase().includes(query) ||
                n.metadata.description?.toLowerCase().includes(query) ||
                n.tags.some(tag => tag.toLowerCase().includes(query))
              );
            }

            return filtered;
          },

          getFilteredEdges: () => {
            const state = get();
            const filteredNodes = state.getFilteredNodes();
            const nodeIds = new Set(filteredNodes.map(n => n.id));
            
            return state.edges.filter(e => 
              nodeIds.has(e.source) && nodeIds.has(e.target)
            );
          },

          getNodeById: (nodeId) => {
            return get().nodes.find(n => n.id === nodeId);
          },

          getEdgeById: (edgeId) => {
            return get().edges.find(e => e.id === edgeId);
          },

          getNodesByType: (type) => {
            return get().nodes.filter(n => n.type === type);
          },

          getNodesByHealth: (health) => {
            return get().nodes.filter(n => n.health.status === health);
          },

          getCriticalNodes: () => {
            return get().nodes.filter(n => 
              n.metadata.criticality === CriticalityLevel.CRITICAL
            );
          },

          getIncidentNodes: () => {
            return get().nodes.filter(n => 
              n.health.incidents && n.health.incidents.length > 0
            );
          },

          getConnectedNodes: (nodeId) => {
            const state = get();
            const connected = new Set<string>();
            
            state.edges.forEach(edge => {
              if (edge.source === nodeId) connected.add(edge.target);
              if (edge.target === nodeId) connected.add(edge.source);
            });
            
            return Array.from(connected)
              .map(id => state.getNodeById(id))
              .filter(Boolean) as ServiceNode[];
          },

          getUpstreamNodes: (nodeId) => {
            const state = get();
            const upstream = new Set<string>();
            
            state.edges.forEach(edge => {
              if (edge.target === nodeId) upstream.add(edge.source);
            });
            
            return Array.from(upstream)
              .map(id => state.getNodeById(id))
              .filter(Boolean) as ServiceNode[];
          },

          getDownstreamNodes: (nodeId) => {
            const state = get();
            const downstream = new Set<string>();
            
            state.edges.forEach(edge => {
              if (edge.source === nodeId) downstream.add(edge.target);
            });
            
            return Array.from(downstream)
              .map(id => state.getNodeById(id))
              .filter(Boolean) as ServiceNode[];
          }
        }))
      ),
      {
        name: 'topology-store',
        partialize: (state) => ({
          config: state.config,
          performanceConfig: state.performanceConfig,
          filters: state.filters,
          sidebarOpen: state.sidebarOpen
        })
      }
    )
  )
);