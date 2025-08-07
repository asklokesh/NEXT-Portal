'use client';

/**
 * Dependency Graph Component
 * 
 * Interactive visualization of plugin dependencies with conflict resolution,
 * installation order display, and resolution strategy selection.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ReactFlow, Node, Edge, Controls, Background, useNodesState, useEdgesState, ConnectionMode } from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info, 
  Download, 
  Settings, 
  Zap, 
  Clock,
  GitBranch,
  Package,
  AlertCircle
} from 'lucide-react';

import { DependencyResolver } from '@/lib/plugins/DependencyResolver';
import { CompatibilityChecker } from '@/lib/plugins/CompatibilityChecker';
import { 
  Plugin, 
  DependencyConflict, 
  ResolutionStrategy, 
  ConflictResolution,
  DependencyGraphProps,
  ResolutionResult
} from '@/lib/plugins/types';

interface DependencyGraphState {
  plugins: Plugin[];
  resolver: DependencyResolver;
  compatibilityChecker: CompatibilityChecker;
  resolutionResult: ResolutionResult | null;
  selectedPlugin: string | null;
  selectedConflict: DependencyConflict | null;
  isResolving: boolean;
  strategy: ResolutionStrategy;
  showConflictDialog: boolean;
  showInstallDialog: boolean;
  installationProgress: number;
}

// Custom node component for plugins
const PluginNode = ({ data }: { data: any }) => {
  const { plugin, conflicts, resolved, onClick } = data;
  
  const getStatusColor = () => {
    if (conflicts > 0) return 'destructive';
    if (resolved) return 'default';
    return 'secondary';
  };

  const getStatusIcon = () => {
    if (conflicts > 0) return <XCircle className="w-4 h-4" />;
    if (resolved) return <CheckCircle className="w-4 h-4" />;
    return <Package className="w-4 h-4" />;
  };

  return (
    <Card 
      className={`min-w-[200px] cursor-pointer transition-all hover:shadow-md ${
        conflicts > 0 ? 'border-red-300 bg-red-50' : 
        resolved ? 'border-green-300 bg-green-50' : 
        'border-gray-300'
      }`}
      onClick={() => onClick(plugin.id)}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium text-sm">{plugin.name}</span>
          </div>
          <Badge variant={getStatusColor()} className="text-xs">
            {plugin.version}
          </Badge>
        </div>
        
        <div className="text-xs text-gray-600 mb-2">
          {plugin.type || 'extension'}
        </div>
        
        {conflicts > 0 && (
          <div className="flex items-center gap-1 text-red-600">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-xs">{conflicts} conflicts</span>
          </div>
        )}
        
        {plugin.dependencies && plugin.dependencies.length > 0 && (
          <div className="flex items-center gap-1 text-gray-500 mt-1">
            <GitBranch className="w-3 h-3" />
            <span className="text-xs">{plugin.dependencies.length} deps</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Node types
const nodeTypes = {
  plugin: PluginNode,
};

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  plugins = [],
  selectedPlugin,
  onPluginSelect,
  onConflictResolve,
  showConflicts = true,
  interactive = true,
  layout = 'hierarchical'
}) => {
  const [state, setState] = useState<DependencyGraphState>({
    plugins,
    resolver: new DependencyResolver(plugins),
    compatibilityChecker: new CompatibilityChecker(),
    resolutionResult: null,
    selectedPlugin: selectedPlugin || null,
    selectedConflict: null,
    isResolving: false,
    strategy: 'strict',
    showConflictDialog: false,
    showInstallDialog: false,
    installationProgress: 0
  });

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Generate graph layout
  const generateLayout = useCallback((graphData: any, layoutType: string) => {
    const { nodes: graphNodes, edges: graphEdges } = graphData;
    
    const newNodes: Node[] = graphNodes.map((node: any, index: number) => {
      let position = { x: 0, y: 0 };
      
      switch (layoutType) {
        case 'hierarchical':
          // Simple hierarchical layout
          const level = calculateNodeLevel(node.id, graphEdges);
          position = {
            x: (index % 4) * 250,
            y: level * 150
          };
          break;
          
        case 'circular':
          // Circular layout
          const angle = (index / graphNodes.length) * 2 * Math.PI;
          const radius = Math.max(200, graphNodes.length * 30);
          position = {
            x: Math.cos(angle) * radius + 400,
            y: Math.sin(angle) * radius + 300
          };
          break;
          
        case 'force':
        default:
          // Simple grid layout as fallback
          position = {
            x: (index % 5) * 200,
            y: Math.floor(index / 5) * 120
          };
          break;
      }

      return {
        id: node.id,
        type: 'plugin',
        position,
        data: {
          plugin: state.plugins.find(p => p.id === node.id),
          conflicts: node.conflicts,
          resolved: node.resolved,
          onClick: handlePluginClick
        }
      };
    });

    const newEdges: Edge[] = graphEdges.map((edge: any) => ({
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      style: {
        stroke: edge.type === 'optional' ? '#9CA3AF' : '#374151',
        strokeWidth: 2,
        strokeDasharray: edge.type === 'optional' ? '5,5' : 'none'
      },
      markerEnd: {
        type: 'arrowclosed',
        color: edge.type === 'optional' ? '#9CA3AF' : '#374151'
      },
      label: edge.type === 'optional' ? 'optional' : undefined,
      labelStyle: { fontSize: 10, fontWeight: 500 }
    }));

    return { nodes: newNodes, edges: newEdges };
  }, [state.plugins]);

  // Calculate node level for hierarchical layout
  const calculateNodeLevel = (nodeId: string, edges: any[]): number => {
    const incomingEdges = edges.filter(edge => edge.target === nodeId);
    if (incomingEdges.length === 0) return 0;
    
    const parentLevels = incomingEdges.map(edge => 
      calculateNodeLevel(edge.source, edges)
    );
    
    return Math.max(...parentLevels) + 1;
  };

  // Handle plugin click
  const handlePluginClick = useCallback((pluginId: string) => {
    setState(prev => ({ ...prev, selectedPlugin: pluginId }));
    onPluginSelect?.(pluginId);
  }, [onPluginSelect]);

  // Handle strategy change
  const handleStrategyChange = useCallback((newStrategy: ResolutionStrategy) => {
    setState(prev => ({ ...prev, strategy: newStrategy }));
  }, []);

  // Resolve dependencies
  const resolveDependencies = useCallback(async () => {
    setState(prev => ({ ...prev, isResolving: true }));
    
    try {
      const result = await state.resolver.resolveDependencies(undefined, {
        strategy: state.strategy,
        autoInstall: false
      });
      
      setState(prev => ({ ...prev, resolutionResult: result, isResolving: false }));
      
      // Update graph with resolution results
      const graphData = state.resolver.getGraphVisualization();
      const { nodes: newNodes, edges: newEdges } = generateLayout(graphData, layout);
      setNodes(newNodes);
      setEdges(newEdges);
      
    } catch (error) {
      console.error('Failed to resolve dependencies:', error);
      setState(prev => ({ ...prev, isResolving: false }));
    }
  }, [state.resolver, state.strategy, generateLayout, layout, setNodes, setEdges]);

  // Handle conflict resolution
  const handleConflictResolve = useCallback((conflict: DependencyConflict, resolution: ConflictResolution) => {
    onConflictResolve?.(conflict, resolution);
    setState(prev => ({ 
      ...prev, 
      showConflictDialog: false, 
      selectedConflict: null 
    }));
  }, [onConflictResolve]);

  // Install plugins in order
  const installPlugins = useCallback(async () => {
    if (!state.resolutionResult?.resolved) return;
    
    setState(prev => ({ ...prev, showInstallDialog: true, installationProgress: 0 }));
    
    const { installationOrder } = state.resolutionResult;
    const progressStep = 100 / installationOrder.length;
    
    for (let i = 0; i < installationOrder.length; i++) {
      const pluginId = installationOrder[i];
      
      // Simulate installation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setState(prev => ({ 
        ...prev, 
        installationProgress: (i + 1) * progressStep 
      }));
    }
    
    // Complete installation
    setTimeout(() => {
      setState(prev => ({ 
        ...prev, 
        showInstallDialog: false, 
        installationProgress: 0 
      }));
    }, 1000);
  }, [state.resolutionResult]);

  // Initialize graph
  useEffect(() => {
    if (plugins.length > 0) {
      const resolver = new DependencyResolver(plugins);
      const graphData = resolver.getGraphVisualization();
      const { nodes: newNodes, edges: newEdges } = generateLayout(graphData, layout);
      
      setNodes(newNodes);
      setEdges(newEdges);
      
      setState(prev => ({ 
        ...prev, 
        plugins, 
        resolver,
        compatibilityChecker: new CompatibilityChecker()
      }));
    }
  }, [plugins, layout, generateLayout, setNodes, setEdges]);

  // Auto-resolve on strategy or plugins change
  useEffect(() => {
    if (plugins.length > 0) {
      resolveDependencies();
    }
  }, [plugins, state.strategy]);

  const selectedPluginData = useMemo(() => {
    return state.selectedPlugin ? 
      state.plugins.find(p => p.id === state.selectedPlugin) : null;
  }, [state.selectedPlugin, state.plugins]);

  const conflictSummary = useMemo(() => {
    if (!state.resolutionResult) return null;
    
    const { conflicts } = state.resolutionResult;
    const criticalCount = conflicts.filter(c => c.severity === 'critical').length;
    const warningCount = conflicts.filter(c => c.severity === 'warning').length;
    
    return { total: conflicts.length, critical: criticalCount, warning: warningCount };
  }, [state.resolutionResult]);

  return (
    <div className="w-full h-full flex flex-col space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between p-4 bg-white border rounded-lg">
        <div className="flex items-center space-x-4">
          <Select value={state.strategy} onValueChange={handleStrategyChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Resolution Strategy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="strict">Strict</SelectItem>
              <SelectItem value="permissive">Permissive</SelectItem>
              <SelectItem value="latest">Latest</SelectItem>
              <SelectItem value="compatible">Compatible</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            onClick={resolveDependencies} 
            disabled={state.isResolving}
            className="flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {state.isResolving ? 'Resolving...' : 'Resolve'}
          </Button>
          
          {state.resolutionResult?.resolved && (
            <Button 
              onClick={installPlugins}
              variant="default"
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Install All
            </Button>
          )}
        </div>
        
        {conflictSummary && (
          <div className="flex items-center space-x-2">
            {conflictSummary.critical > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                {conflictSummary.critical} Critical
              </Badge>
            )}
            {conflictSummary.warning > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {conflictSummary.warning} Warnings
              </Badge>
            )}
            {conflictSummary.total === 0 && (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                All Resolved
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 flex gap-4">
        {/* Main Graph */}
        <div className="flex-1 border rounded-lg overflow-hidden">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Strict}
            fitView
            className="bg-gray-50"
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        {/* Side Panel */}
        <div className="w-80 space-y-4">
          {/* Plugin Details */}
          {selectedPluginData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Plugin Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="font-medium">{selectedPluginData.name}</div>
                  <div className="text-sm text-gray-600">{selectedPluginData.description}</div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Version</span>
                  <Badge>{selectedPluginData.version}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Type</span>
                  <Badge variant="outline">{selectedPluginData.type || 'extension'}</Badge>
                </div>
                
                {selectedPluginData.dependencies && selectedPluginData.dependencies.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-600 mb-2">Dependencies</div>
                    <div className="space-y-1">
                      {selectedPluginData.dependencies.map(dep => (
                        <div key={dep.id} className="flex items-center justify-between text-sm">
                          <span>{dep.id}</span>
                          <Badge variant="outline" className="text-xs">{dep.version}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Resolution Results */}
          {state.resolutionResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Resolution Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="summary">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
                    <TabsTrigger value="order">Install Order</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="summary" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Status</span>
                      <Badge variant={state.resolutionResult.resolved ? "default" : "destructive"}>
                        {state.resolutionResult.resolved ? "Resolved" : "Has Conflicts"}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Strategy</span>
                      <Badge variant="outline">{state.resolutionResult.strategy}</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Resolution Time</span>
                      <span className="text-sm text-gray-600">
                        {state.resolutionResult.performance.resolutionTimeMs}ms
                      </span>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="conflicts" className="space-y-2">
                    {state.resolutionResult.conflicts.length === 0 ? (
                      <div className="text-center text-gray-500 py-4">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        No conflicts found
                      </div>
                    ) : (
                      state.resolutionResult.conflicts.map((conflict, index) => (
                        <Alert key={index} className={`${
                          conflict.severity === 'critical' ? 'border-red-300 bg-red-50' :
                          conflict.severity === 'warning' ? 'border-yellow-300 bg-yellow-50' :
                          'border-blue-300 bg-blue-50'
                        }`}>
                          <AlertCircle className="w-4 h-4" />
                          <AlertDescription className="text-sm">
                            <div className="font-medium">{conflict.type} conflict</div>
                            <div className="text-gray-600">{conflict.pluginId}</div>
                            {conflict.suggestions.length > 0 && (
                              <div className="mt-1 text-xs">
                                Suggestion: {conflict.suggestions[0]}
                              </div>
                            )}
                          </AlertDescription>
                        </Alert>
                      ))
                    )}
                  </TabsContent>
                  
                  <TabsContent value="order" className="space-y-2">
                    {state.resolutionResult.installationOrder.map((pluginId, index) => (
                      <div key={pluginId} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                        <Badge variant="outline" className="text-xs">{index + 1}</Badge>
                        <span className="text-sm flex-1">{pluginId}</span>
                        <Clock className="w-3 h-3 text-gray-400" />
                      </div>
                    ))}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Installation Progress Dialog */}
      <Dialog open={state.showInstallDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Installing Plugins
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Progress value={state.installationProgress} className="w-full" />
            <div className="text-sm text-center text-gray-600">
              {Math.round(state.installationProgress)}% complete
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DependencyGraph;