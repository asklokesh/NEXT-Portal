/**
 * Core Visualization Engine for Service Topology
 * 
 * This module provides the core visualization engine that combines D3.js 
 * for advanced graph calculations with React Flow for interactive rendering.
 */

import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
  Panel,
  SelectionMode,
  NodeTypes,
  EdgeTypes,
  Node,
  Edge,
  Connection,
  addEdge,
  MarkerType,
  ReactFlowInstance
} from 'reactflow';
import * as d3 from 'd3';

import 'reactflow/dist/style.css';

import {
  ServiceTopologyNode,
  ServiceTopologyEdge,
  TopologyViewConfig,
  LayoutType,
  ArchitectureLayer,
  ServiceTopologyProps,
  PerformanceConfig,
  ViewportBounds
} from '../types';

import { ServiceNode } from '../nodes/ServiceNode';
import { APINode } from '../nodes/APINode';
import { DatabaseNode } from '../nodes/DatabaseNode';
import { GroupNode } from '../nodes/GroupNode';
import { ServiceEdge } from '../edges/ServiceEdge';
import { DataFlowEdge } from '../edges/DataFlowEdge';

import { LayoutEngine } from './LayoutEngine';
import { SearchEngine } from './SearchEngine';
import { FilterEngine } from './FilterEngine';
import { PerformanceOptimizer } from './PerformanceOptimizer';

// =============================================
// NODE AND EDGE TYPE DEFINITIONS
// =============================================

const nodeTypes: NodeTypes = {
  service: ServiceNode,
  api: APINode,
  database: DatabaseNode,
  group: GroupNode,
  queue: ServiceNode,
  gateway: ServiceNode,
  external: ServiceNode,
  domain: GroupNode,
};

const edgeTypes: EdgeTypes = {
  dependency: ServiceEdge,
  'api-call': ServiceEdge,
  'data-flow': DataFlowEdge,
  ownership: ServiceEdge,
  group: ServiceEdge,
};

// =============================================
// DEFAULT CONFIGURATIONS
// =============================================

const defaultConfig: TopologyViewConfig = {
  layout: 'hierarchical',
  layers: [
    ArchitectureLayer.PRESENTATION,
    ArchitectureLayer.APPLICATION,
    ArchitectureLayer.BUSINESS,
    ArchitectureLayer.PERSISTENCE,
    ArchitectureLayer.DATABASE
  ],
  filters: {
    kinds: [],
    namespaces: [],
    teams: [],
    tags: [],
    status: [],
    health: [],
    criticality: [],
    layers: [],
    search: '',
    customFilters: []
  },
  display: {
    showLabels: true,
    showMetrics: true,
    showHealth: true,
    showRelations: true,
    nodeSize: 'medium',
    edgeThickness: 'medium',
    colorScheme: {
      name: 'default',
      nodes: {
        service: '#3B82F6',
        api: '#10B981',
        database: '#F59E0B',
        queue: '#8B5CF6',
        gateway: '#EF4444',
        external: '#6B7280',
        group: '#EC4899',
        domain: '#14B8A6'
      },
      edges: {
        dependency: '#64748B',
        'api-call': '#10B981',
        'data-flow': '#3B82F6',
        ownership: '#F59E0B',
        group: '#EC4899'
      },
      backgrounds: {
        light: '#FFFFFF',
        dark: '#1F2937'
      },
      text: {
        primary: '#111827',
        secondary: '#6B7280'
      }
    },
    theme: 'auto',
    animations: true,
    clustering: false
  },
  interactions: {
    zoom: true,
    pan: true,
    select: true,
    multiSelect: true,
    drag: true,
    hover: true,
    doubleClick: 'drill-down',
    rightClick: 'context-menu'
  },
  annotations: {
    enabled: true,
    showAll: false,
    categories: ['note', 'warning', 'info', 'issue'],
    permissions: {
      create: true,
      edit: true,
      delete: true,
      share: true
    }
  }
};

const performanceConfig: PerformanceConfig = {
  virtualization: true,
  lodEnabled: true,
  maxVisibleNodes: 500,
  clusteringThreshold: 100,
  renderingEngine: 'canvas',
  animationDuration: 300,
  debounceDelay: 150,
  cacheSize: 1000
};

// =============================================
// MAIN VISUALIZATION ENGINE COMPONENT
// =============================================

interface VisualizationEngineProps extends ServiceTopologyProps {
  onReady?: (instance: ReactFlowInstance) => void;
}

const VisualizationEngineInner: React.FC<VisualizationEngineProps> = ({
  initialNodes = [],
  initialEdges = [],
  config: userConfig,
  height = 600,
  width,
  onNodeClick,
  onEdgeClick,
  onSelectionChange,
  onConfigChange,
  enableRealtime = false,
  enableCollaboration = false,
  enableExport = false,
  enableSearch = true,
  className,
  style,
  theme = 'auto',
  onReady
}) => {
  // =============================================
  // STATE AND REFS
  // =============================================
  
  const [nodes, setNodes, onNodesChange] = useNodesState<ServiceTopologyNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<ServiceTopologyEdge>([]);
  const [config, setConfig] = useState<TopologyViewConfig>({ 
    ...defaultConfig, 
    ...userConfig 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [viewport, setViewport] = useState<ViewportBounds>({ 
    x: 0, 
    y: 0, 
    width: width || 800, 
    height, 
    zoom: 1 
  });
  
  const reactFlowInstance = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutEngineRef = useRef<LayoutEngine>();
  const searchEngineRef = useRef<SearchEngine>();
  const filterEngineRef = useRef<FilterEngine>();
  const performanceOptimizerRef = useRef<PerformanceOptimizer>();
  
  // =============================================
  // ENGINE INITIALIZATION
  // =============================================
  
  useEffect(() => {
    // Initialize engines
    layoutEngineRef.current = new LayoutEngine({
      algorithm: config.layout,
      animate: config.display.animations,
      performance: performanceConfig
    });
    
    searchEngineRef.current = new SearchEngine({
      indexFields: ['label', 'name', 'description', 'tags'],
      fuzzyThreshold: 0.6,
      maxResults: 50
    });
    
    filterEngineRef.current = new FilterEngine();
    
    performanceOptimizerRef.current = new PerformanceOptimizer(performanceConfig);
    
    // Notify parent component that engine is ready
    if (onReady && reactFlowInstance) {
      onReady(reactFlowInstance);
    }
  }, [config.layout, config.display.animations, onReady, reactFlowInstance]);
  
  // =============================================
  // DATA PROCESSING AND LAYOUT
  // =============================================
  
  const processedNodes = useMemo(() => {
    if (!filterEngineRef.current || !performanceOptimizerRef.current) {
      return initialNodes;
    }
    
    // Apply filters
    let filtered = filterEngineRef.current.applyFilters(initialNodes, config.filters);
    
    // Apply performance optimizations (virtualization, clustering)
    filtered = performanceOptimizerRef.current.optimizeNodes(filtered, viewport);
    
    return filtered;
  }, [initialNodes, config.filters, viewport]);
  
  const processedEdges = useMemo(() => {
    if (!filterEngineRef.current || !performanceOptimizerRef.current) {
      return initialEdges;
    }
    
    // Filter edges based on visible nodes
    const visibleNodeIds = new Set(processedNodes.map(n => n.id));
    let filtered = initialEdges.filter(
      edge => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
    
    // Apply edge filters
    filtered = filterEngineRef.current.applyEdgeFilters(filtered, config.filters);
    
    // Apply performance optimizations
    filtered = performanceOptimizerRef.current.optimizeEdges(filtered, viewport);
    
    return filtered;
  }, [initialEdges, processedNodes, config.filters, viewport]);
  
  // =============================================
  // LAYOUT CALCULATION
  // =============================================
  
  useEffect(() => {
    if (!layoutEngineRef.current || processedNodes.length === 0) return;
    
    const applyLayout = async () => {
      setIsLoading(true);
      
      try {
        const layoutResult = await layoutEngineRef.current!.calculateLayout(
          processedNodes,
          processedEdges,
          {
            width: viewport.width,
            height: viewport.height,
            layers: config.layers
          }
        );
        
        setNodes(layoutResult.nodes);
        setEdges(layoutResult.edges);
        
        // Auto-fit view if this is the initial load
        if (processedNodes.length > 0 && viewport.zoom === 1) {
          setTimeout(() => {
            reactFlowInstance.fitView({ padding: 50, duration: 800 });
          }, 100);
        }
      } catch (error) {
        console.error('Layout calculation failed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    applyLayout();
  }, [processedNodes, processedEdges, config.layout, config.layers, viewport.width, viewport.height, reactFlowInstance, setNodes, setEdges]);
  
  // =============================================
  // EVENT HANDLERS
  // =============================================
  
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (onNodeClick) {
      onNodeClick(node as ServiceTopologyNode, event);
    }
  }, [onNodeClick]);
  
  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    if (onEdgeClick) {
      onEdgeClick(edge as ServiceTopologyEdge, event);
    }
  }, [onEdgeClick]);
  
  const handleSelectionChange = useCallback((params: { nodes: Node[], edges: Edge[] }) => {
    if (onSelectionChange) {
      onSelectionChange(
        params.nodes.map(n => n.id),
        params.edges.map(e => e.id)
      );
    }
  }, [onSelectionChange]);
  
  const handleConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );
  
  const handleViewportChange = useCallback((newViewport: { x: number; y: number; zoom: number }) => {
    setViewport(prev => ({
      ...prev,
      ...newViewport
    }));
  }, []);
  
  const handlePaneContextMenu = useCallback((event: React.MouseEvent) => {
    if (config.interactions.rightClick === 'context-menu') {
      event.preventDefault();
      // Show context menu (implement based on your UI framework)
      console.log('Context menu at:', { x: event.clientX, y: event.clientY });
    }
  }, [config.interactions.rightClick]);
  
  // =============================================
  // CONFIGURATION UPDATES
  // =============================================
  
  const updateConfig = useCallback((updates: Partial<TopologyViewConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    
    if (onConfigChange) {
      onConfigChange(newConfig);
    }
  }, [config, onConfigChange]);
  
  // =============================================
  // RENDER
  // =============================================
  
  const containerStyle: React.CSSProperties = {
    width: width || '100%',
    height: height,
    position: 'relative',
    background: config.display.theme === 'dark' 
      ? config.display.colorScheme.backgrounds.dark 
      : config.display.colorScheme.backgrounds.light,
    ...style
  };
  
  return (
    <div 
      ref={containerRef}
      className={`topology-visualization-engine ${className || ''}`}
      style={containerStyle}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onSelectionChange={handleSelectionChange}
        onPaneContextMenu={handlePaneContextMenu}
        onViewportChange={handleViewportChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: 'dependency',
          markerEnd: { type: MarkerType.ArrowClosed, width: 20, height: 20 },
          style: { strokeWidth: 2 }
        }}
        minZoom={0.1}
        maxZoom={4}
        snapToGrid={false}
        snapGrid={[15, 15]}
        connectionLineType="smoothstep"
        selectionMode={config.interactions.multiSelect ? SelectionMode.Partial : SelectionMode.Full}
        panOnDrag={config.interactions.pan}
        zoomOnScroll={config.interactions.zoom}
        zoomOnPinch={config.interactions.zoom}
        zoomOnDoubleClick={false}
        selectNodesOnDrag={false}
        multiSelectionKeyCode="Shift"
        deleteKeyCode="Delete"
        fitView={false}
        attributionPosition="bottom-left"
      >
        {/* Background Pattern */}
        <Background 
          color={config.display.theme === 'dark' ? '#374151' : '#E5E7EB'} 
          gap={20} 
          size={1}
          variant="dots"
        />
        
        {/* Navigation Controls */}
        <Controls 
          position="top-right"
          showZoom={config.interactions.zoom}
          showFitView={true}
          showInteractive={true}
          fitViewOptions={{ padding: 50, duration: 800 }}
        />
        
        {/* Mini Map */}
        {config.display.clustering && (
          <MiniMap
            position="bottom-right"
            nodeColor={(node) => {
              const serviceNode = node as ServiceTopologyNode;
              return config.display.colorScheme.nodes[serviceNode.type] || '#64748B';
            }}
            nodeStrokeWidth={2}
            pannable
            zoomable
            ariaLabel="Topology mini map"
          />
        )}
        
        {/* Loading Overlay */}
        {isLoading && (
          <Panel position="center">
            <div className="flex items-center justify-center p-4 bg-white rounded-lg shadow-lg border">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
              <span className="text-sm font-medium text-gray-700">
                Calculating layout...
              </span>
            </div>
          </Panel>
        )}
        
        {/* Performance Stats (Debug Mode) */}
        {process.env.NODE_ENV === 'development' && (
          <Panel position="top-left">
            <div className="bg-black bg-opacity-75 text-white text-xs p-2 rounded">
              <div>Nodes: {nodes.length}</div>
              <div>Edges: {edges.length}</div>
              <div>Layout: {config.layout}</div>
              <div>Zoom: {viewport.zoom.toFixed(2)}</div>
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
};

// =============================================
// WRAPPED COMPONENT WITH PROVIDER
// =============================================

export const VisualizationEngine: React.FC<VisualizationEngineProps> = (props) => {
  return (
    <ReactFlowProvider>
      <VisualizationEngineInner {...props} />
    </ReactFlowProvider>
  );
};

export default VisualizationEngine;