/**
 * Service Topology Visualization Component
 * 
 * Main component that combines all topology visualization features:
 * - Interactive service maps with D3.js and React Flow
 * - Real-time data updates
 * - Multi-layer architecture visualization
 * - Advanced filtering and search
 * - Performance optimization
 * - Collaboration features
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { 
  ServiceTopologyProps,
  ServiceTopologyNode,
  ServiceTopologyEdge,
  TopologyViewConfig,
  SearchQuery,
  PathFindingQuery
} from './types';

// Core Components
import { VisualizationEngine } from './engine/VisualizationEngine';
import { LayerManager } from './layers/LayerManager';
import { RealtimeDataProvider, useRealtimeData } from './integration/RealtimeDataProvider';

// UI Components
import {
  Search,
  Filter,
  Settings,
  Share2,
  Download,
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Move3D,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Users,
  Layers,
  Eye,
  EyeOff
} from 'lucide-react';

// =============================================
// SEARCH AND FILTER PANEL
// =============================================

const SearchFilterPanel: React.FC<{
  onSearch: (query: SearchQuery) => void;
  onPathFind: (query: PathFindingQuery) => void;
  isVisible: boolean;
  onToggle: () => void;
}> = ({ onSearch, onPathFind, isVisible, onToggle }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  const handleSearch = useCallback(() => {
    if (!searchTerm.trim()) return;

    const query: SearchQuery = {
      text: searchTerm,
      filters: selectedFilters.map(filter => ({
        field: 'tags',
        operator: 'contains',
        value: filter
      })),
      scope: 'both',
      options: {
        fuzzy: true,
        caseSensitive: false,
        wholeWord: false,
        includeMetadata: true,
        maxResults: 50,
        timeout: 5000
      }
    };

    onSearch(query);
  }, [searchTerm, selectedFilters, onSearch]);

  if (!isVisible) {
    return (
      <button
        className="fixed top-4 left-4 z-50 p-3 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50"
        onClick={onToggle}
      >
        <Search className="w-5 h-5 text-gray-600" />
      </button>
    );
  }

  return (
    <div className="fixed top-4 left-4 z-50 w-80 bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Search & Filter</h3>
          <button
            className="p-1 hover:bg-gray-100 rounded-lg"
            onClick={onToggle}
          >
            <Minimize2 className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <div className="relative mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search services, APIs, databases..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        </div>

        <button
          onClick={handleSearch}
          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
      </div>

      <div className="p-4">
        <h4 className="text-sm font-medium text-gray-800 mb-2">Quick Filters</h4>
        <div className="flex flex-wrap gap-2">
          {['critical', 'api', 'database', 'unhealthy', 'production'].map(filter => (
            <button
              key={filter}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                selectedFilters.includes(filter)
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => {
                setSelectedFilters(prev =>
                  prev.includes(filter)
                    ? prev.filter(f => f !== filter)
                    : [...prev, filter]
                );
              }}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// =============================================
// CONTROL PANEL
// =============================================

const ControlPanel: React.FC<{
  config: TopologyViewConfig;
  onConfigChange: (config: Partial<TopologyViewConfig>) => void;
  onExport: () => void;
  onReset: () => void;
  connectionStatus: string;
  metrics: any;
}> = ({ config, onConfigChange, onExport, onReset, connectionStatus, metrics }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isExpanded) {
    return (
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        <button
          className="p-3 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50"
          onClick={() => setIsExpanded(true)}
        >
          <Settings className="w-5 h-5 text-gray-600" />
        </button>
        
        {/* Connection Status Indicator */}
        <div className={`p-2 rounded-lg shadow-lg border ${
          connectionStatus === 'connected' ? 'bg-green-50 border-green-200' :
          connectionStatus === 'connecting' ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        }`}>
          {connectionStatus === 'connected' && <CheckCircle className="w-4 h-4 text-green-600" />}
          {connectionStatus === 'connecting' && <Clock className="w-4 h-4 text-yellow-600 animate-spin" />}
          {connectionStatus === 'disconnected' && <AlertCircle className="w-4 h-4 text-red-600" />}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 w-80 bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Controls</h3>
          <button
            className="p-1 hover:bg-gray-100 rounded-lg"
            onClick={() => setIsExpanded(false)}
          >
            <Minimize2 className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Layout Controls */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Layout</label>
          <select
            value={config.layout}
            onChange={(e) => onConfigChange({ layout: e.target.value as any })}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="hierarchical">Hierarchical</option>
            <option value="force-directed">Force-Directed</option>
            <option value="circular">Circular</option>
            <option value="layered">Layered</option>
            <option value="grid">Grid</option>
            <option value="tree">Tree</option>
            <option value="organic">Organic</option>
          </select>
        </div>

        {/* Display Options */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Display</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.display.showLabels}
                onChange={(e) => onConfigChange({
                  display: { ...config.display, showLabels: e.target.checked }
                })}
              />
              <span className="text-sm text-gray-700">Show Labels</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.display.showMetrics}
                onChange={(e) => onConfigChange({
                  display: { ...config.display, showMetrics: e.target.checked }
                })}
              />
              <span className="text-sm text-gray-700">Show Metrics</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.display.showHealth}
                onChange={(e) => onConfigChange({
                  display: { ...config.display, showHealth: e.target.checked }
                })}
              />
              <span className="text-sm text-gray-700">Show Health</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.display.animations}
                onChange={(e) => onConfigChange({
                  display: { ...config.display, animations: e.target.checked }
                })}
              />
              <span className="text-sm text-gray-700">Animations</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onExport}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm">Export</span>
          </button>
          <button
            onClick={onReset}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm">Reset</span>
          </button>
        </div>
      </div>

      {/* Status Information */}
      <div className="p-4">
        <h4 className="text-sm font-medium text-gray-800 mb-2">Status</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Connection:</span>
            <div className={`flex items-center gap-1 ${
              connectionStatus === 'connected' ? 'text-green-600' :
              connectionStatus === 'connecting' ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {connectionStatus === 'connected' && <CheckCircle className="w-3 h-3" />}
              {connectionStatus === 'connecting' && <Clock className="w-3 h-3 animate-spin" />}
              {connectionStatus !== 'connected' && connectionStatus !== 'connecting' && <AlertCircle className="w-3 h-3" />}
              <span className="capitalize">{connectionStatus}</span>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Events Received:</span>
            <span className="font-medium">{metrics?.eventsReceived || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Nodes Updated:</span>
            <span className="font-medium">{metrics?.nodesUpdated || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Last Update:</span>
            <span className="font-medium">
              {metrics?.lastEventTime ? new Date(metrics.lastEventTime).toLocaleTimeString() : 'Never'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================
// MAIN TOPOLOGY COMPONENT INNER
// =============================================

const ServiceTopologyInner: React.FC<ServiceTopologyProps> = ({
  initialNodes = [],
  initialEdges = [],
  config: userConfig,
  height = 600,
  width,
  onNodeClick,
  onEdgeClick,
  onSelectionChange,
  onConfigChange,
  enableRealtime = true,
  enableCollaboration = false,
  enableExport = true,
  enableSearch = true,
  className,
  style,
  theme = 'auto'
}) => {
  // Get real-time data
  const { 
    nodes, 
    edges, 
    connectionStatus, 
    metrics,
    subscribe,
    addDataSource 
  } = useRealtimeData();

  // State
  const [config, setConfig] = useState<TopologyViewConfig>({
    layout: 'hierarchical',
    layers: [],
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
        nodes: {},
        edges: {},
        backgrounds: {},
        text: {}
      },
      theme: theme,
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
      enabled: enableCollaboration,
      showAll: false,
      categories: ['note', 'warning', 'info', 'issue'],
      permissions: {
        create: true,
        edit: true,
        delete: true,
        share: true
      }
    },
    ...userConfig
  });

  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showLayerManager, setShowLayerManager] = useState(true);
  const [currentNodes, setCurrentNodes] = useState<ServiceTopologyNode[]>(initialNodes);
  const [currentEdges, setCurrentEdges] = useState<ServiceTopologyEdge[]>(initialEdges);

  // Merge initial data with real-time data
  const allNodes = useMemo(() => {
    const nodeMap = new Map<string, ServiceTopologyNode>();
    
    // Start with initial nodes
    initialNodes.forEach(node => nodeMap.set(node.id, node));
    
    // Override with real-time nodes
    nodes.forEach(node => nodeMap.set(node.id, node));
    
    // Add current nodes
    currentNodes.forEach(node => nodeMap.set(node.id, node));
    
    return Array.from(nodeMap.values());
  }, [initialNodes, nodes, currentNodes]);

  const allEdges = useMemo(() => {
    const edgeMap = new Map<string, ServiceTopologyEdge>();
    
    // Start with initial edges
    initialEdges.forEach(edge => edgeMap.set(edge.id, edge));
    
    // Override with real-time edges
    edges.forEach(edge => edgeMap.set(edge.id, edge));
    
    // Add current edges
    currentEdges.forEach(edge => edgeMap.set(edge.id, edge));
    
    return Array.from(edgeMap.values());
  }, [initialEdges, edges, currentEdges]);

  // Handle configuration changes
  const handleConfigChange = useCallback((updates: Partial<TopologyViewConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    
    if (onConfigChange) {
      onConfigChange(newConfig);
    }
  }, [config, onConfigChange]);

  // Handle search
  const handleSearch = useCallback((query: SearchQuery) => {
    // Implement search functionality
    console.log('Search query:', query);
  }, []);

  // Handle path finding
  const handlePathFind = useCallback((query: PathFindingQuery) => {
    // Implement path finding functionality
    console.log('Path finding query:', query);
  }, []);

  // Handle export
  const handleExport = useCallback(() => {
    // Implement export functionality
    console.log('Exporting topology...');
  }, []);

  // Handle reset
  const handleReset = useCallback(() => {
    setCurrentNodes(initialNodes);
    setCurrentEdges(initialEdges);
    setConfig(prevConfig => ({
      ...prevConfig,
      layout: 'hierarchical',
      layers: []
    }));
  }, [initialNodes, initialEdges]);

  // Initialize data sources
  useEffect(() => {
    if (enableRealtime) {
      // Add default data sources
      addDataSource({
        id: 'backstage-catalog',
        name: 'Backstage Catalog',
        type: 'catalog',
        config: {
          endpoint: '/api/catalog',
          refreshInterval: 30,
          timeout: 5000,
          retries: 3
        },
        status: {
          connected: false,
          lastSync: new Date(),
          recordsCount: 0,
          syncDuration: 0
        },
        lastSync: new Date()
      });
    }
  }, [enableRealtime, addDataSource]);

  return (
    <div 
      className={`service-topology relative ${className || ''}`}
      style={{ width: width || '100%', height, ...style }}
    >
      {/* Main Visualization */}
      <VisualizationEngine
        initialNodes={allNodes}
        initialEdges={allEdges}
        config={config}
        height={height}
        width={width}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onSelectionChange={onSelectionChange}
        onConfigChange={handleConfigChange}
        enableRealtime={enableRealtime}
        enableCollaboration={enableCollaboration}
        enableExport={enableExport}
        enableSearch={enableSearch}
        theme={theme}
      />

      {/* Layer Manager */}
      {showLayerManager && (
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200">
          <LayerManager
            nodes={allNodes}
            edges={allEdges}
            config={config}
            onConfigChange={handleConfigChange}
            onNodesChange={setCurrentNodes}
            onEdgesChange={setCurrentEdges}
          />
        </div>
      )}

      {/* Search Panel */}
      {enableSearch && (
        <SearchFilterPanel
          onSearch={handleSearch}
          onPathFind={handlePathFind}
          isVisible={showSearchPanel}
          onToggle={() => setShowSearchPanel(!showSearchPanel)}
        />
      )}

      {/* Control Panel */}
      <ControlPanel
        config={config}
        onConfigChange={handleConfigChange}
        onExport={handleExport}
        onReset={handleReset}
        connectionStatus={connectionStatus}
        metrics={metrics}
      />

      {/* Layer Toggle Button */}
      <button
        className="absolute bottom-4 right-4 z-40 p-3 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50"
        onClick={() => setShowLayerManager(!showLayerManager)}
        title={showLayerManager ? 'Hide layers' : 'Show layers'}
      >
        <Layers className="w-5 h-5 text-gray-600" />
      </button>
    </div>
  );
};

// =============================================
// MAIN COMPONENT WITH PROVIDERS
// =============================================

export const ServiceTopology: React.FC<ServiceTopologyProps> = (props) => {
  return (
    <ReactFlowProvider>
      <RealtimeDataProvider
        initialNodes={props.initialNodes}
        initialEdges={props.initialEdges}
        config={{
          enabled: props.enableRealtime !== false,
          websocketUrl: 'ws://localhost:8080/ws',
          reconnectInterval: 5000,
          maxReconnectAttempts: 10,
          subscriptions: []
        }}
      >
        <ServiceTopologyInner {...props} />
      </RealtimeDataProvider>
    </ReactFlowProvider>
  );
};

export default ServiceTopology;