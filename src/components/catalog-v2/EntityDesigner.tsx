'use client';

/**
 * Visual Entity Designer - Revolutionary drag-and-drop interface
 * Making Backstage's static YAML editing look primitive
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  Panel,
  ConnectionMode,
  Position,
  NodeChange,
  EdgeChange,
  Connection,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Database, 
  Globe, 
  Server, 
  Code, 
  Users, 
  Shield, 
  Settings,
  Plus,
  Save,
  Download,
  Upload,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { EntityType, HealthState, RelationshipType, GraphEntity } from '@/lib/catalog-v2/graph-model';

// Custom Node Types
const nodeTypes = {
  'entity-node': EntityNode,
  'system-node': SystemNode,
  'domain-node': DomainNode
};

// Entity Node Component
function EntityNode({ data, selected }: { data: any; selected: boolean }) {
  const getIcon = (type: EntityType) => {
    switch (type) {
      case EntityType.SERVICE:
        return <Server className="w-4 h-4" />;
      case EntityType.API:
        return <Code className="w-4 h-4" />;
      case EntityType.WEBSITE:
        return <Globe className="w-4 h-4" />;
      case EntityType.DATABASE:
        return <Database className="w-4 h-4" />;
      case EntityType.GROUP:
        return <Users className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  const getHealthColor = (health: HealthState) => {
    switch (health) {
      case HealthState.HEALTHY:
        return 'bg-green-100 border-green-300 text-green-800';
      case HealthState.WARNING:
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case HealthState.CRITICAL:
        return 'bg-red-100 border-red-300 text-red-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getHealthIcon = (health: HealthState) => {
    switch (health) {
      case HealthState.HEALTHY:
        return <CheckCircle className="w-3 h-3" />;
      case HealthState.WARNING:
        return <AlertTriangle className="w-3 h-3" />;
      case HealthState.CRITICAL:
        return <AlertTriangle className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  return (
    <Card className={`min-w-48 max-w-64 ${selected ? 'ring-2 ring-blue-500' : ''} ${getHealthColor(data.health)}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getIcon(data.type)}
            <CardTitle className="text-sm font-semibold truncate">
              {data.label}
            </CardTitle>
          </div>
          <div className="flex items-center space-x-1">
            {getHealthIcon(data.health)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <Badge variant="secondary" className="text-xs">
            {data.type}
          </Badge>
          {data.owner && (
            <p className="text-xs text-gray-600">
              Owner: {data.owner}
            </p>
          )}
          {data.description && (
            <p className="text-xs text-gray-500 truncate">
              {data.description}
            </p>
          )}
          <div className="flex justify-between text-xs text-gray-500">
            <span>{data.health}</span>
            <span>{data.compliance?.score || 0}% compliant</span>
          </div>
        </div>
      </CardContent>
      
      {/* Connection Handles */}
      <Handle type="target" position={Position.Left} className="w-3 h-3" />
      <Handle type="source" position={Position.Right} className="w-3 h-3" />
    </Card>
  );
}

// System Node Component (groups services)
function SystemNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <Card className={`min-w-80 min-h-60 bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-dashed border-blue-300 ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <CardHeader>
        <CardTitle className="text-lg font-bold text-blue-800 flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-blue-600 mb-2">{data.description}</p>
        <Badge className="bg-blue-200 text-blue-800">System</Badge>
        <div className="mt-4 text-xs text-blue-600">
          Drop services here to group them
        </div>
      </CardContent>
    </Card>
  );
}

// Domain Node Component (highest level grouping)
function DomainNode({ data, selected }: { data: any; selected: boolean }) {
  return (
    <Card className={`min-w-96 min-h-80 bg-gradient-to-br from-purple-50 to-pink-100 border-2 border-dashed border-purple-300 ${selected ? 'ring-2 ring-purple-500' : ''}`}>
      <CardHeader>
        <CardTitle className="text-xl font-bold text-purple-800 flex items-center">
          <Shield className="w-6 h-6 mr-2" />
          {data.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-purple-600 mb-2">{data.description}</p>
        <Badge className="bg-purple-200 text-purple-800">Domain</Badge>
        <div className="mt-4 text-xs text-purple-600">
          Drop systems and services here
        </div>
      </CardContent>
    </Card>
  );
}

// Handle component
function Handle({ type, position, className }: { type: string; position: any; className?: string }) {
  return (
    <div 
      className={`absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full ${className}`}
      style={{
        [position === Position.Left ? 'left' : 'right']: '-6px',
        top: '50%',
        transform: 'translateY(-50%)'
      }}
    />
  );
}

// Entity Palette Component
function EntityPalette({ onAddEntity }: { onAddEntity: (type: EntityType) => void }) {
  const entityTypes = [
    { type: EntityType.SERVICE, icon: Server, label: 'Service', color: 'bg-blue-500' },
    { type: EntityType.API, icon: Code, label: 'API', color: 'bg-green-500' },
    { type: EntityType.WEBSITE, icon: Globe, label: 'Website', color: 'bg-purple-500' },
    { type: EntityType.DATABASE, icon: Database, label: 'Database', color: 'bg-orange-500' },
    { type: EntityType.SYSTEM, icon: Settings, label: 'System', color: 'bg-indigo-500' },
    { type: EntityType.DOMAIN, icon: Shield, label: 'Domain', color: 'bg-pink-500' }
  ];

  return (
    <Card className="w-64 h-full">
      <CardHeader>
        <CardTitle className="text-sm font-semibold flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Entity Palette
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {entityTypes.map(({ type, icon: Icon, label, color }) => (
            <Button
              key={type}
              variant="outline"
              className="h-16 flex flex-col items-center justify-center space-y-1 hover:bg-gray-50"
              onClick={() => onAddEntity(type)}
            >
              <div className={`p-1 rounded ${color}`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Properties Panel Component
function PropertiesPanel({ 
  selectedElement, 
  onUpdateElement 
}: { 
  selectedElement: any; 
  onUpdateElement: (updates: any) => void;
}) {
  if (!selectedElement) {
    return (
      <Card className="w-80 h-full">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Select an element to edit properties</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-80 h-full overflow-y-auto">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">
          {selectedElement.type === 'node' ? 'Entity Properties' : 'Relationship Properties'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedElement.type === 'node' ? (
          <NodeProperties node={selectedElement} onUpdate={onUpdateElement} />
        ) : (
          <EdgeProperties edge={selectedElement} onUpdate={onUpdateElement} />
        )}
      </CardContent>
    </Card>
  );
}

// Node Properties Component
function NodeProperties({ node, onUpdate }: { node: any; onUpdate: (updates: any) => void }) {
  const [name, setName] = useState(node.data?.label || '');
  const [description, setDescription] = useState(node.data?.description || '');
  const [owner, setOwner] = useState(node.data?.owner || '');

  const handleUpdate = () => {
    onUpdate({
      id: node.id,
      data: {
        ...node.data,
        label: name,
        description,
        owner
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleUpdate}
          className="w-full p-2 border border-gray-300 rounded text-sm"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleUpdate}
          className="w-full p-2 border border-gray-300 rounded text-sm h-20 resize-none"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Owner</label>
        <input
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          onBlur={handleUpdate}
          className="w-full p-2 border border-gray-300 rounded text-sm"
        />
      </div>

      <Separator />

      <div>
        <label className="block text-sm font-medium mb-2">Health Status</label>
        <Badge className={node.data?.health === HealthState.HEALTHY ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
          {node.data?.health || 'Unknown'}
        </Badge>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Compliance Score</label>
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full" 
              style={{ width: `${node.data?.compliance?.score || 0}%` }}
            />
          </div>
          <span className="text-sm">{node.data?.compliance?.score || 0}%</span>
        </div>
      </div>
    </div>
  );
}

// Edge Properties Component
function EdgeProperties({ edge, onUpdate }: { edge: any; onUpdate: (updates: any) => void }) {
  const [label, setLabel] = useState(edge.label || '');

  const handleUpdate = () => {
    onUpdate({
      id: edge.id,
      label,
      data: {
        ...edge.data,
        label
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Relationship Type</label>
        <Badge variant="secondary">{edge.data?.type || 'DEPENDS_ON'}</Badge>
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-1">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleUpdate}
          className="w-full p-2 border border-gray-300 rounded text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Confidence</label>
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full" 
              style={{ width: `${edge.data?.confidence || 80}%` }}
            />
          </div>
          <span className="text-sm">{edge.data?.confidence || 80}%</span>
        </div>
      </div>
    </div>
  );
}

// Main Entity Designer Component
export function EntityDesigner() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const { setViewport, getViewport } = useReactFlow();

  // Handle adding new entities
  const onAddEntity = useCallback((type: EntityType) => {
    const id = `${type.toLowerCase()}-${Date.now()}`;
    const newNode: Node = {
      id,
      type: type === EntityType.DOMAIN ? 'domain-node' : 
            type === EntityType.SYSTEM ? 'system-node' : 'entity-node',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: {
        label: `New ${type}`,
        type,
        description: `A new ${type.toLowerCase()} entity`,
        health: HealthState.HEALTHY,
        owner: 'unassigned',
        compliance: { score: 85 }
      }
    };

    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  // Handle connections between nodes
  const onConnect = useCallback(
    (params: Connection) => {
      const edge: Edge = {
        ...params,
        id: `edge-${params.source}-${params.target}`,
        type: 'smoothstep',
        label: 'depends on',
        data: {
          type: RelationshipType.DEPENDS_ON,
          confidence: 80
        }
      };
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges]
  );

  // Handle element selection
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: any) => {
      if (selectedNodes.length > 0) {
        setSelectedElement({ type: 'node', ...selectedNodes[0] });
      } else if (selectedEdges.length > 0) {
        setSelectedElement({ type: 'edge', ...selectedEdges[0] });
      } else {
        setSelectedElement(null);
      }
    },
    []
  );

  // Handle element updates
  const onUpdateElement = useCallback((updates: any) => {
    if (updates.source !== undefined) {
      // It's an edge
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === updates.id ? { ...edge, ...updates } : edge
        )
      );
    } else {
      // It's a node
      setNodes((nds) =>
        nds.map((node) =>
          node.id === updates.id ? { ...node, ...updates } : node
        )
      );
    }
  }, [setNodes, setEdges]);

  // Save design
  const onSave = useCallback(() => {
    const design = {
      nodes,
      edges,
      viewport: getViewport()
    };
    
    // In a real implementation, this would save to the graph database
    console.log('Saving design:', design);
    
    // For now, save to localStorage
    localStorage.setItem('catalog-design', JSON.stringify(design));
  }, [nodes, edges, getViewport]);

  // Load design
  const onLoad = useCallback(() => {
    const saved = localStorage.getItem('catalog-design');
    if (saved) {
      const design = JSON.parse(saved);
      setNodes(design.nodes || []);
      setEdges(design.edges || []);
      if (design.viewport) {
        setViewport(design.viewport);
      }
    }
  }, [setNodes, setEdges, setViewport]);

  // Auto-layout
  const onAutoLayout = useCallback(() => {
    // Simple circular layout for demo
    const centerX = 400;
    const centerY = 300;
    const radius = 200;
    
    setNodes((nds) =>
      nds.map((node, index) => ({
        ...node,
        position: {
          x: centerX + radius * Math.cos((2 * Math.PI * index) / nds.length),
          y: centerY + radius * Math.sin((2 * Math.PI * index) / nds.length)
        }
      }))
    );
  }, [setNodes]);

  // Load initial data
  useEffect(() => {
    // Load sample data
    const sampleNodes: Node[] = [
      {
        id: 'user-service',
        type: 'entity-node',
        position: { x: 200, y: 100 },
        data: {
          label: 'User Service',
          type: EntityType.SERVICE,
          description: 'Handles user authentication and profile management',
          health: HealthState.HEALTHY,
          owner: 'platform-team',
          compliance: { score: 92 }
        }
      },
      {
        id: 'user-db',
        type: 'entity-node',
        position: { x: 200, y: 300 },
        data: {
          label: 'User Database',
          type: EntityType.DATABASE,
          description: 'PostgreSQL database storing user data',
          health: HealthState.HEALTHY,
          owner: 'platform-team',
          compliance: { score: 88 }
        }
      }
    ];

    const sampleEdges: Edge[] = [
      {
        id: 'user-service-db',
        source: 'user-service',
        target: 'user-db',
        type: 'smoothstep',
        label: 'stores in',
        data: {
          type: RelationshipType.STORES_IN,
          confidence: 95
        }
      }
    ];

    setNodes(sampleNodes);
    setEdges(sampleEdges);
  }, [setNodes, setEdges]);

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Entity Palette */}
      <div className="flex-shrink-0 p-4">
        <EntityPalette onAddEntity={onAddEntity} />
      </div>

      {/* Main Design Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          connectionMode={ConnectionMode.Loose}
          fitView
          className="bg-white"
        >
          <Background />
          <Controls />
          <MiniMap />
          
          {/* Toolbar */}
          <Panel position="top-left" className="space-x-2">
            <Button size="sm" onClick={onSave}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={onLoad}>
              <Upload className="w-4 h-4 mr-2" />
              Load
            </Button>
            <Button size="sm" variant="outline" onClick={onAutoLayout}>
              <Zap className="w-4 h-4 mr-2" />
              Auto Layout
            </Button>
          </Panel>

          {/* Stats Panel */}
          <Panel position="top-right">
            <Card className="w-64">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Catalog Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Entities:</span>
                  <Badge variant="secondary">{nodes.length}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Relationships:</span>
                  <Badge variant="secondary">{edges.length}</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Compliance:</span>
                  <Badge className="bg-green-100 text-green-800">
                    {Math.round(nodes.reduce((acc, n) => acc + (n.data?.compliance?.score || 0), 0) / Math.max(nodes.length, 1))}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Panel>
        </ReactFlow>
      </div>

      {/* Properties Panel */}
      <div className="flex-shrink-0 p-4">
        <PropertiesPanel 
          selectedElement={selectedElement}
          onUpdateElement={onUpdateElement}
        />
      </div>
    </div>
  );
}

// Wrapper component with ReactFlow provider
export default function EntityDesignerWrapper() {
  return (
    <ReactFlowProvider>
      <EntityDesigner />
    </ReactFlowProvider>
  );
}