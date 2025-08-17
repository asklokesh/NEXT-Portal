/**
 * Visual Workflow Builder - Drag-and-Drop Service Catalog Interface
 * Inspired by Spotify Portal's no-code approach with advanced capabilities
 */

'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  Panel,
  NodeToolbar,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Save, 
  Download, 
  Upload, 
  Trash2, 
  Copy, 
  Settings, 
  Database, 
  Server, 
  Globe, 
  MessageSquare, 
  Zap, 
  GitBranch,
  Eye,
  Users,
  Bot,
  Sparkles,
  Code2,
  FileText
} from 'lucide-react';

import { noCatalogEngine, WorkflowNode, WorkflowEdge, ServiceWorkflow } from '@/lib/service-catalog/nocode-catalog-engine';

// Custom Node Components
const ServiceNode = ({ id, data, isConnectable }: any) => {
  const [showConfig, setShowConfig] = useState(false);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'service': return <Server className="w-4 h-4" />;
      case 'api': return <Globe className="w-4 h-4" />;
      case 'database': return <Database className="w-4 h-4" />;
      case 'queue': return <MessageSquare className="w-4 h-4" />;
      case 'cache': return <Zap className="w-4 h-4" />;
      case 'function': return <Code2 className="w-4 h-4" />;
      case 'gateway': return <GitBranch className="w-4 h-4" />;
      default: return <Server className="w-4 h-4" />;
    }
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'service': return 'bg-blue-500';
      case 'api': return 'bg-green-500';
      case 'database': return 'bg-purple-500';
      case 'queue': return 'bg-orange-500';
      case 'cache': return 'bg-red-500';
      case 'function': return 'bg-yellow-500';
      case 'gateway': return 'bg-pink-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <>
      <NodeToolbar isVisible={showConfig} position={Position.Top}>
        <Card className="w-64">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{data.label} Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue={data.label} className="h-8" />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" placeholder="Service description..." className="h-16" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setShowConfig(false)}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setShowConfig(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      </NodeToolbar>

      <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
      
      <div 
        className={`px-4 py-2 shadow-md rounded-md border-2 border-stone-400 ${getNodeColor(data.type)} text-white min-w-[140px] cursor-pointer`}
        onClick={() => setShowConfig(!showConfig)}
      >
        <div className="flex items-center gap-2">
          {getNodeIcon(data.type)}
          <div className="text-sm font-medium">{data.label}</div>
        </div>
        {data.config && (
          <div className="text-xs mt-1 opacity-75">
            {data.type} • {data.config.framework || data.config.type || 'default'}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
    </>
  );
};

// Node types configuration
const nodeTypes = {
  service: ServiceNode,
  api: ServiceNode,
  database: ServiceNode,
  queue: ServiceNode,
  cache: ServiceNode,
  function: ServiceNode,
  gateway: ServiceNode,
};

// Service templates for drag-and-drop
const serviceTemplates = [
  {
    type: 'service',
    label: 'Web Service',
    icon: Server,
    description: 'HTTP/REST web service',
    config: { framework: 'express', port: 3000 }
  },
  {
    type: 'api',
    label: 'API Gateway',
    icon: Globe,
    description: 'API management and routing',
    config: { protocol: 'REST', version: 'v1' }
  },
  {
    type: 'database',
    label: 'Database',
    icon: Database,
    description: 'Persistent data storage',
    config: { type: 'postgresql', version: 'latest' }
  },
  {
    type: 'queue',
    label: 'Message Queue',
    icon: MessageSquare,
    description: 'Asynchronous messaging',
    config: { type: 'rabbitmq' }
  },
  {
    type: 'cache',
    label: 'Cache',
    icon: Zap,
    description: 'In-memory caching',
    config: { type: 'redis' }
  },
  {
    type: 'function',
    label: 'Function',
    icon: Code2,
    description: 'Serverless function',
    config: { runtime: 'nodejs18', memory: '256MB' }
  },
  {
    type: 'gateway',
    label: 'Gateway',
    icon: GitBranch,
    description: 'Traffic routing and load balancing',
    config: { type: 'nginx' }
  }
];

interface VisualWorkflowBuilderProps {
  initialWorkflow?: ServiceWorkflow;
  onSave?: (workflow: ServiceWorkflow) => void;
  onDeploy?: (workflow: ServiceWorkflow) => void;
  collaborative?: boolean;
}

export function VisualWorkflowBuilder({
  initialWorkflow,
  onSave,
  onDeploy,
  collaborative = false
}: VisualWorkflowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [activeTab, setActiveTab] = useState('design');
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [aiSuggestions, setAISuggestions] = useState<any[]>([]);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Initialize workflow if provided
  useEffect(() => {
    if (initialWorkflow) {
      setWorkflowName(initialWorkflow.name);
      setWorkflowDescription(initialWorkflow.description);
      setNodes(initialWorkflow.nodes as Node[]);
      setEdges(initialWorkflow.edges as Edge[]);
    }
  }, [initialWorkflow, setNodes, setEdges]);

  // Generate AI suggestions based on current workflow
  useEffect(() => {
    if (nodes.length > 0) {
      generateAISuggestions();
    }
  }, [nodes, edges]);

  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) {
        return;
      }

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const template = serviceTemplates.find(t => t.type === type);
      if (!template) return;

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { 
          label: template.label,
          type: template.type,
          config: template.config
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const generateAISuggestions = async () => {
    // Mock AI suggestions based on workflow analysis
    const suggestions = [
      {
        id: 'add-monitoring',
        type: 'improvement',
        title: 'Add Monitoring',
        description: 'Consider adding monitoring and observability to your services',
        action: 'Add monitoring stack',
        priority: 'medium'
      },
      {
        id: 'add-cache',
        type: 'performance',
        title: 'Add Caching Layer',
        description: 'Adding a cache can improve response times',
        action: 'Add Redis cache',
        priority: 'low'
      }
    ];

    setAISuggestions(suggestions);
  };

  const handleSave = async () => {
    const workflow: ServiceWorkflow = {
      id: initialWorkflow?.id || `workflow-${Date.now()}`,
      name: workflowName,
      description: workflowDescription,
      nodes: nodes as WorkflowNode[],
      edges: edges as WorkflowEdge[],
      metadata: {
        createdBy: 'current-user',
        createdAt: initialWorkflow?.metadata.createdAt || new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        tags: []
      },
      deployment: {
        environment: 'development',
        status: 'draft'
      }
    };

    try {
      const workflowId = await noCatalogEngine.createWorkflow(workflow);
      console.log('Workflow saved:', workflowId);
      onSave?.(workflow);
    } catch (error) {
      console.error('Failed to save workflow:', error);
    }
  };

  const handleDeploy = async () => {
    const workflow: ServiceWorkflow = {
      id: initialWorkflow?.id || `workflow-${Date.now()}`,
      name: workflowName,
      description: workflowDescription,
      nodes: nodes as WorkflowNode[],
      edges: edges as WorkflowEdge[],
      metadata: {
        createdBy: 'current-user',
        createdAt: initialWorkflow?.metadata.createdAt || new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        tags: []
      },
      deployment: {
        environment: 'development',
        status: 'deploying'
      }
    };

    onDeploy?.(workflow);
  };

  const generateCode = async () => {
    setIsGeneratingCode(true);
    
    // Mock code generation based on workflow
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockCode = `
# Generated Infrastructure Code

## Docker Compose
\`\`\`yaml
version: '3.8'
services:
${nodes.map(node => `  ${node.data.label.toLowerCase().replace(/\s+/g, '-')}:
    image: ${node.data.type}:latest
    ports:
      - "${node.data.config?.port || 3000}:${node.data.config?.port || 3000}"
`).join('')}
\`\`\`

## Kubernetes Manifests
\`\`\`yaml
${nodes.map(node => `---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${node.data.label.toLowerCase().replace(/\s+/g, '-')}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${node.data.label.toLowerCase().replace(/\s+/g, '-')}
  template:
    metadata:
      labels:
        app: ${node.data.label.toLowerCase().replace(/\s+/g, '-')}
    spec:
      containers:
      - name: ${node.data.label.toLowerCase().replace(/\s+/g, '-')}
        image: ${node.data.type}:latest
        ports:
        - containerPort: ${node.data.config?.port || 3000}
`).join('')}
\`\`\`
`;

    setGeneratedCode(mockCode);
    setIsGeneratingCode(false);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Service Palette */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold mb-2">Service Catalog</h2>
          <p className="text-sm text-gray-600">Drag and drop services to build your architecture</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
          </TabsList>

          <TabsContent value="design" className="flex-1 p-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="workflow-name">Workflow Name</Label>
                <Input
                  id="workflow-name"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  placeholder="Enter workflow name..."
                />
              </div>
              <div>
                <Label htmlFor="workflow-description">Description</Label>
                <Textarea
                  id="workflow-description"
                  value={workflowDescription}
                  onChange={(e) => setWorkflowDescription(e.target.value)}
                  placeholder="Describe your workflow..."
                  className="h-20"
                />
              </div>
              <Separator />
              <div>
                <h3 className="font-medium mb-3">Available Services</h3>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {serviceTemplates.map((template) => (
                      <Card
                        key={template.type}
                        className="cursor-grab active:cursor-grabbing hover:bg-gray-50"
                        draggable
                        onDragStart={(event) => onDragStart(event, template.type)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <template.icon className="w-5 h-5 text-gray-600" />
                            <div>
                              <div className="text-sm font-medium">{template.label}</div>
                              <div className="text-xs text-gray-500">{template.description}</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="config" className="flex-1 p-4">
            {selectedNode ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{selectedNode.data.label}</CardTitle>
                  <CardDescription>Configure service properties</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="service-name">Service Name</Label>
                    <Input
                      id="service-name"
                      defaultValue={selectedNode.data.label}
                    />
                  </div>
                  <div>
                    <Label htmlFor="service-type">Service Type</Label>
                    <Select defaultValue={selectedNode.data.type}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceTemplates.map(template => (
                          <SelectItem key={template.type} value={template.type}>
                            {template.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedNode.data.config && (
                    <div className="space-y-2">
                      <Label>Configuration</Label>
                      <div className="text-sm bg-gray-100 p-2 rounded">
                        <pre>{JSON.stringify(selectedNode.data.config, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="text-center text-gray-500 mt-8">
                <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a service to configure its properties</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="code" className="flex-1 p-4">
            <div className="space-y-4">
              <Button 
                onClick={generateCode} 
                disabled={isGeneratingCode || nodes.length === 0}
                className="w-full"
              >
                {isGeneratingCode ? (
                  <>
                    <Bot className="w-4 h-4 mr-2 animate-spin" />
                    Generating Code...
                  </>
                ) : (
                  <>
                    <Code2 className="w-4 h-4 mr-2" />
                    Generate Infrastructure Code
                  </>
                )}
              </Button>
              {generatedCode && (
                <ScrollArea className="h-96 w-full border rounded-md p-4">
                  <pre className="text-xs">{generatedCode}</pre>
                </ScrollArea>
              )}
            </div>
          </TabsContent>

          <TabsContent value="ai" className="flex-1 p-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <h3 className="font-medium">AI Suggestions</h3>
              </div>
              <div className="space-y-3">
                {aiSuggestions.map((suggestion) => (
                  <Card key={suggestion.id}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium">{suggestion.title}</h4>
                            <Badge variant={suggestion.priority === 'high' ? 'destructive' : 'secondary'}>
                              {suggestion.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600">{suggestion.description}</p>
                        </div>
                        <Button size="sm" variant="outline" className="ml-2">
                          Apply
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {aiSuggestions.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">AI suggestions will appear as you build your workflow</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">{workflowName}</h1>
            <Badge variant="outline">{nodes.length} services</Badge>
            {collaborative && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span className="text-sm">{collaborators.length} collaborators</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setActiveTab('ai')}>
              <Eye className="w-4 h-4 mr-1" />
              Preview
            </Button>
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button size="sm" onClick={handleDeploy} disabled={nodes.length === 0}>
              <Play className="w-4 h-4 mr-1" />
              Deploy
            </Button>
          </div>
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={(_, node) => setSelectedNode(node)}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <MiniMap />
            <Background variant="dots" gap={12} size={1} />
            
            <Panel position="bottom-left">
              <Card className="w-64">
                <CardContent className="p-3">
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>Nodes: {nodes.length}</div>
                    <div>Connections: {edges.length}</div>
                    <div>Status: {nodes.length > 0 ? 'Ready to deploy' : 'Add services to begin'}</div>
                  </div>
                </CardContent>
              </Card>
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

export default function VisualWorkflowBuilderWrapper(props: VisualWorkflowBuilderProps) {
  return (
    <ReactFlowProvider>
      <VisualWorkflowBuilder {...props} />
    </ReactFlowProvider>
  );
}