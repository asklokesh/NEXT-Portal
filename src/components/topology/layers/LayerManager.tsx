/**
 * Layer Manager for Multi-Layer Architecture Visualization
 * 
 * Manages different architecture layers (logical, physical, network)
 * and provides layer switching, filtering, and visualization controls.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { 
  ArchitectureLayer, 
  ServiceTopologyNode, 
  ServiceTopologyEdge,
  TopologyViewConfig 
} from '../types';
import { 
  Layers,
  Eye,
  EyeOff,
  Settings,
  Filter,
  RotateCcw,
  Maximize2,
  Minimize2,
  Palette,
  Grid3X3,
  Network,
  Server,
  Database,
  Shield,
  Monitor,
  Building,
  Workflow
} from 'lucide-react';

// =============================================
// LAYER CONFIGURATION
// =============================================

interface LayerConfig {
  layer: ArchitectureLayer;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  visible: boolean;
  opacity: number;
  zIndex: number;
}

interface LayerView {
  id: string;
  name: string;
  description: string;
  layers: ArchitectureLayer[];
  layoutType: 'hierarchical' | 'force-directed' | 'layered';
  primaryLayer: ArchitectureLayer;
}

const DEFAULT_LAYER_CONFIGS: LayerConfig[] = [
  {
    layer: ArchitectureLayer.PRESENTATION,
    name: 'Presentation',
    description: 'User interfaces, web apps, mobile apps',
    icon: Monitor,
    color: '#3B82F6',
    visible: true,
    opacity: 1.0,
    zIndex: 9
  },
  {
    layer: ArchitectureLayer.APPLICATION,
    name: 'Application',
    description: 'Application services, business logic',
    icon: Server,
    color: '#10B981',
    visible: true,
    opacity: 1.0,
    zIndex: 8
  },
  {
    layer: ArchitectureLayer.BUSINESS,
    name: 'Business',
    description: 'Domain services, business rules',
    icon: Building,
    color: '#F59E0B',
    visible: true,
    opacity: 1.0,
    zIndex: 7
  },
  {
    layer: ArchitectureLayer.PERSISTENCE,
    name: 'Persistence',
    description: 'Data access, repositories',
    icon: Database,
    color: '#8B5CF6',
    visible: true,
    opacity: 1.0,
    zIndex: 6
  },
  {
    layer: ArchitectureLayer.DATABASE,
    name: 'Database',
    description: 'Databases, data stores',
    icon: Database,
    color: '#EF4444',
    visible: true,
    opacity: 1.0,
    zIndex: 5
  },
  {
    layer: ArchitectureLayer.INFRASTRUCTURE,
    name: 'Infrastructure',
    description: 'Platform services, cloud resources',
    icon: Grid3X3,
    color: '#6B7280',
    visible: false,
    opacity: 0.7,
    zIndex: 4
  },
  {
    layer: ArchitectureLayer.NETWORK,
    name: 'Network',
    description: 'Load balancers, gateways, networking',
    icon: Network,
    color: '#14B8A6',
    visible: false,
    opacity: 0.8,
    zIndex: 3
  },
  {
    layer: ArchitectureLayer.SECURITY,
    name: 'Security',
    description: 'Auth services, security policies',
    icon: Shield,
    color: '#DC2626',
    visible: false,
    opacity: 0.9,
    zIndex: 2
  },
  {
    layer: ArchitectureLayer.MONITORING,
    name: 'Monitoring',
    description: 'Observability, logging, metrics',
    icon: Monitor,
    color: '#7C3AED',
    visible: false,
    opacity: 0.8,
    zIndex: 1
  }
];

const PREDEFINED_VIEWS: LayerView[] = [
  {
    id: 'application',
    name: 'Application View',
    description: 'Focus on application and business layers',
    layers: [
      ArchitectureLayer.PRESENTATION,
      ArchitectureLayer.APPLICATION,
      ArchitectureLayer.BUSINESS,
      ArchitectureLayer.PERSISTENCE
    ],
    layoutType: 'hierarchical',
    primaryLayer: ArchitectureLayer.APPLICATION
  },
  {
    id: 'infrastructure',
    name: 'Infrastructure View',
    description: 'Focus on infrastructure and platform',
    layers: [
      ArchitectureLayer.APPLICATION,
      ArchitectureLayer.DATABASE,
      ArchitectureLayer.INFRASTRUCTURE,
      ArchitectureLayer.NETWORK
    ],
    layoutType: 'force-directed',
    primaryLayer: ArchitectureLayer.INFRASTRUCTURE
  },
  {
    id: 'security',
    name: 'Security View',
    description: 'Focus on security and compliance',
    layers: [
      ArchitectureLayer.APPLICATION,
      ArchitectureLayer.DATABASE,
      ArchitectureLayer.SECURITY,
      ArchitectureLayer.NETWORK
    ],
    layoutType: 'layered',
    primaryLayer: ArchitectureLayer.SECURITY
  },
  {
    id: 'observability',
    name: 'Observability View',
    description: 'Focus on monitoring and observability',
    layers: [
      ArchitectureLayer.APPLICATION,
      ArchitectureLayer.MONITORING,
      ArchitectureLayer.INFRASTRUCTURE
    ],
    layoutType: 'force-directed',
    primaryLayer: ArchitectureLayer.MONITORING
  },
  {
    id: 'complete',
    name: 'Complete View',
    description: 'All layers visible',
    layers: Object.values(ArchitectureLayer),
    layoutType: 'layered',
    primaryLayer: ArchitectureLayer.APPLICATION
  }
];

// =============================================
// LAYER MANAGER PROPS
// =============================================

interface LayerManagerProps {
  nodes: ServiceTopologyNode[];
  edges: ServiceTopologyEdge[];
  config: TopologyViewConfig;
  onConfigChange: (config: Partial<TopologyViewConfig>) => void;
  onNodesChange: (nodes: ServiceTopologyNode[]) => void;
  onEdgesChange: (edges: ServiceTopologyEdge[]) => void;
  className?: string;
}

// =============================================
// LAYER CONTROL COMPONENT
// =============================================

const LayerControl: React.FC<{
  config: LayerConfig;
  onToggle: (layer: ArchitectureLayer, visible: boolean) => void;
  onOpacityChange: (layer: ArchitectureLayer, opacity: number) => void;
  nodeCount: number;
}> = ({ config, onToggle, onOpacityChange, nodeCount }) => {
  const IconComponent = config.icon;

  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
      <button
        className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
          config.visible ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'
        }`}
        onClick={() => onToggle(config.layer, !config.visible)}
        title={config.visible ? 'Hide layer' : 'Show layer'}
      >
        <IconComponent 
          className={`w-5 h-5 ${config.visible ? 'text-blue-600' : 'text-gray-400'}`} 
        />
      </button>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-medium text-gray-800">{config.name}</h4>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            {nodeCount}
          </span>
        </div>
        <p className="text-xs text-gray-500 line-clamp-2">{config.description}</p>
      </div>

      {config.visible && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Opacity</span>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={config.opacity}
            onChange={(e) => onOpacityChange(config.layer, parseFloat(e.target.value))}
            className="w-16"
          />
          <span className="text-xs text-gray-600 w-8">
            {Math.round(config.opacity * 100)}%
          </span>
        </div>
      )}

      <button
        className={`p-2 rounded-lg transition-colors ${
          config.visible ? 'hover:bg-gray-100' : 'text-gray-400'
        }`}
        onClick={() => onToggle(config.layer, !config.visible)}
        disabled={!config.visible}
      >
        {config.visible ? (
          <Eye className="w-4 h-4 text-gray-600" />
        ) : (
          <EyeOff className="w-4 h-4 text-gray-400" />
        )}
      </button>
    </div>
  );
};

// =============================================
// VIEW SELECTOR COMPONENT
// =============================================

const ViewSelector: React.FC<{
  currentView: LayerView | null;
  onViewChange: (view: LayerView) => void;
}> = ({ currentView, onViewChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Workflow className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-medium text-gray-800">
          {currentView?.name || 'Select View'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-2">
            {PREDEFINED_VIEWS.map((view) => (
              <button
                key={view.id}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  currentView?.id === view.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                }`}
                onClick={() => {
                  onViewChange(view);
                  setIsOpen(false);
                }}
              >
                <div className="font-medium text-sm text-gray-800 mb-1">{view.name}</div>
                <div className="text-xs text-gray-500 line-clamp-2">{view.description}</div>
                <div className="text-xs text-blue-600 mt-1">
                  {view.layers.length} layers • {view.layoutType}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================
// MAIN LAYER MANAGER COMPONENT
// =============================================

export const LayerManager: React.FC<LayerManagerProps> = ({
  nodes,
  edges,
  config,
  onConfigChange,
  onNodesChange,
  onEdgesChange,
  className
}) => {
  const [layerConfigs, setLayerConfigs] = useState<LayerConfig[]>(DEFAULT_LAYER_CONFIGS);
  const [currentView, setCurrentView] = useState<LayerView | null>(PREDEFINED_VIEWS[0]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate node counts per layer
  const layerNodeCounts = useMemo(() => {
    const counts = new Map<ArchitectureLayer, number>();
    
    Object.values(ArchitectureLayer).forEach(layer => {
      counts.set(layer, 0);
    });
    
    nodes.forEach(node => {
      const layer = node.data.layer;
      counts.set(layer, (counts.get(layer) || 0) + 1);
    });
    
    return counts;
  }, [nodes]);

  // Filter nodes and edges based on visible layers
  const { visibleNodes, visibleEdges } = useMemo(() => {
    const visibleLayerSet = new Set(
      layerConfigs.filter(config => config.visible).map(config => config.layer)
    );
    
    const filteredNodes = nodes.filter(node => visibleLayerSet.has(node.data.layer));
    const visibleNodeIds = new Set(filteredNodes.map(node => node.id));
    
    const filteredEdges = edges.filter(edge => 
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
    
    return { 
      visibleNodes: filteredNodes, 
      visibleEdges: filteredEdges 
    };
  }, [nodes, edges, layerConfigs]);

  // Handle layer visibility toggle
  const handleLayerToggle = useCallback((layer: ArchitectureLayer, visible: boolean) => {
    setLayerConfigs(prev => 
      prev.map(config => 
        config.layer === layer ? { ...config, visible } : config
      )
    );
    
    // Update configuration
    onConfigChange({
      layers: visible 
        ? [...config.layers, layer]
        : config.layers.filter(l => l !== layer)
    });
  }, [config.layers, onConfigChange]);

  // Handle opacity change
  const handleOpacityChange = useCallback((layer: ArchitectureLayer, opacity: number) => {
    setLayerConfigs(prev => 
      prev.map(config => 
        config.layer === layer ? { ...config, opacity } : config
      )
    );
  }, []);

  // Handle view change
  const handleViewChange = useCallback((view: LayerView) => {
    setCurrentView(view);
    
    // Update layer visibility based on view
    setLayerConfigs(prev => 
      prev.map(config => ({
        ...config,
        visible: view.layers.includes(config.layer)
      }))
    );
    
    // Update configuration
    onConfigChange({
      layers: view.layers,
      layout: view.layoutType,
      display: {
        ...config.display,
        clustering: view.layers.length > 6
      }
    });
  }, [config.display, onConfigChange]);

  // Reset to default view
  const handleReset = useCallback(() => {
    setLayerConfigs(DEFAULT_LAYER_CONFIGS);
    setCurrentView(PREDEFINED_VIEWS[0]);
    onConfigChange({
      layers: PREDEFINED_VIEWS[0].layers,
      layout: PREDEFINED_VIEWS[0].layoutType
    });
  }, [onConfigChange]);

  // Show/hide all layers
  const handleToggleAll = useCallback(() => {
    const allVisible = layerConfigs.every(config => config.visible);
    const newVisibility = !allVisible;
    
    setLayerConfigs(prev => 
      prev.map(config => ({ ...config, visible: newVisibility }))
    );
    
    onConfigChange({
      layers: newVisibility ? Object.values(ArchitectureLayer) : []
    });
  }, [layerConfigs, onConfigChange]);

  // Apply layer effects to nodes and edges
  React.useEffect(() => {
    // Apply opacity and z-index to nodes based on layer configuration
    const updatedNodes = visibleNodes.map(node => {
      const layerConfig = layerConfigs.find(config => config.layer === node.data.layer);
      if (!layerConfig) return node;
      
      return {
        ...node,
        style: {
          ...node.style,
          opacity: layerConfig.opacity,
          zIndex: layerConfig.zIndex
        }
      };
    });
    
    // Apply layer-based styling to edges
    const updatedEdges = visibleEdges.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) return edge;
      
      const sourceLayerConfig = layerConfigs.find(c => c.layer === sourceNode.data.layer);
      const targetLayerConfig = layerConfigs.find(c => c.layer === targetNode.data.layer);
      
      const minOpacity = Math.min(
        sourceLayerConfig?.opacity || 1,
        targetLayerConfig?.opacity || 1
      );
      
      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: minOpacity
        }
      };
    });
    
    onNodesChange(updatedNodes);
    onEdgesChange(updatedEdges);
  }, [visibleNodes, visibleEdges, layerConfigs, nodes, onNodesChange, onEdgesChange]);

  return (
    <div className={`layer-manager ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-800">Architecture Layers</h3>
          </div>
          
          <div className="text-sm text-gray-500">
            {layerConfigs.filter(c => c.visible).length} of {layerConfigs.length} layers visible
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ViewSelector 
            currentView={currentView}
            onViewChange={handleViewChange}
          />
          
          <button
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={handleToggleAll}
            title={layerConfigs.every(c => c.visible) ? 'Hide all layers' : 'Show all layers'}
          >
            {layerConfigs.every(c => c.visible) ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
          
          <button
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={handleReset}
            title="Reset to default view"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          
          <button
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse panel' : 'Expand panel'}
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Layer Controls */}
      {isExpanded && (
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
          {layerConfigs.map((config) => (
            <LayerControl
              key={config.layer}
              config={config}
              onToggle={handleLayerToggle}
              onOpacityChange={handleOpacityChange}
              nodeCount={layerNodeCounts.get(config.layer) || 0}
            />
          ))}
        </div>
      )}

      {/* Layer Legend */}
      {!isExpanded && (
        <div className="flex items-center gap-2 p-4 overflow-x-auto">
          {layerConfigs.filter(config => config.visible).map((config) => {
            const IconComponent = config.icon;
            const nodeCount = layerNodeCounts.get(config.layer) || 0;
            
            return (
              <div
                key={config.layer}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg whitespace-nowrap"
                style={{ opacity: config.opacity }}
              >
                <IconComponent 
                  className="w-4 h-4" 
                  style={{ color: config.color }}
                />
                <span className="text-sm font-medium text-gray-800">{config.name}</span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  {nodeCount}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LayerManager;