'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GitBranch,
  Network,
  Activity,
  Database,
  Cloud,
  Package,
  Layers,
  AlertTriangle,
  Info,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Download,
  Filter,
  Search,
  Settings,
  Eye,
  EyeOff,
  RefreshCw,
  Play,
  Pause,
  Clock,
  Calendar,
  User,
  Shield,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Circle,
  Square,
  Triangle,
  Hexagon,
  Star,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from '@/services/backstage/types/entities';

interface EntityLineageProps {
  entity: Entity;
  entities: Entity[];
  onEntityClick?: (entity: Entity) => void;
  className?: string;
  maxDepth?: number;
}

interface LineageNode {
  id: string;
  entity: Entity;
  level: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  parents: string[];
  children: string[];
  type: 'source' | 'transform' | 'sink' | 'process' | 'storage';
  metadata?: {
    lastUpdate?: string;
    dataVolume?: string;
    frequency?: string;
    quality?: number;
    latency?: number;
  };
}

interface LineageLink {
  source: string;
  target: string;
  type: 'data-flow' | 'dependency' | 'transformation' | 'trigger';
  metadata?: {
    protocol?: string;
    format?: string;
    volume?: string;
    frequency?: string;
  };
}

interface LineageView {
  upstream: LineageNode[];
  downstream: LineageNode[];
  current: LineageNode;
  links: LineageLink[];
}

const NODE_TYPES = {
  source: { icon: Database, color: 'text-blue-600 bg-blue-100' },
  transform: { icon: Activity, color: 'text-purple-600 bg-purple-100' },
  sink: { icon: Cloud, color: 'text-green-600 bg-green-100' },
  process: { icon: Zap, color: 'text-orange-600 bg-orange-100' },
  storage: { icon: Package, color: 'text-gray-600 bg-gray-100' },
};

const LINK_TYPES = {
  'data-flow': { color: '#3B82F6', style: 'solid', animated: true },
  'dependency': { color: '#8B5CF6', style: 'dashed', animated: false },
  'transformation': { color: '#10B981', style: 'solid', animated: true },
  'trigger': { color: '#F59E0B', style: 'dotted', animated: false },
};

export function EntityLineage({
  entity,
  entities,
  onEntityClick,
  className,
  maxDepth = 5,
}: EntityLineageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lineageView, setLineageView] = useState<LineageView | null>(null);
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null);
  const [viewMode, setViewMode] = useState<'horizontal' | 'vertical' | 'radial'>('horizontal');
  const [showMetadata, setShowMetadata] = useState(true);
  const [animateFlow, setAnimateFlow] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set([0, 1, 2]));
  const [loading, setLoading] = useState(true);
  const [dataFlowDirection, setDataFlowDirection] = useState<'forward' | 'backward'>('forward');

  // Build lineage data from entity relationships
  useEffect(() => {
    const buildLineage = async () => {
      setLoading(true);
      
      const visited = new Set<string>();
      const upstream: LineageNode[] = [];
      const downstream: LineageNode[] = [];
      const links: LineageLink[] = [];
      
      const currentId = entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`;
      const current: LineageNode = {
        id: currentId,
        entity,
        level: 0,
        parents: [],
        children: [],
        type: determineNodeType(entity),
        metadata: extractMetadata(entity),
      };
      
      visited.add(currentId);
      
      // Traverse upstream (dependencies, data sources)
      const traverseUpstream = (e: Entity, level: number) => {
        if (level > maxDepth) return;
        
        const nodeId = e.metadata.uid || `${e.kind}-${e.metadata.name}`;
        
        // Find dependencies
        if (e.spec?.dependsOn) {
          const deps = Array.isArray(e.spec.dependsOn) ? e.spec.dependsOn : [e.spec.dependsOn];
          deps.forEach((dep: string) => {
            const depEntity = entities.find(ent => 
              ent.metadata.name === dep || ent.metadata.uid === dep
            );
            
            if (depEntity && !visited.has(depEntity.metadata.uid || dep)) {
              const depId = depEntity.metadata.uid || `${depEntity.kind}-${depEntity.metadata.name}`;
              visited.add(depId);
              
              const node: LineageNode = {
                id: depId,
                entity: depEntity,
                level: -(level + 1),
                parents: [],
                children: [nodeId],
                type: determineNodeType(depEntity),
                metadata: extractMetadata(depEntity),
              };
              
              upstream.push(node);
              
              links.push({
                source: depId,
                target: nodeId,
                type: 'dependency',
                metadata: {
                  protocol: depEntity.spec?.protocol as string,
                  format: depEntity.spec?.format as string,
                },
              });
              
              traverseUpstream(depEntity, level + 1);
            }
          });
        }
        
        // Find consumed APIs
        if (e.spec?.consumesApis) {
          e.spec.consumesApis.forEach((api: string) => {
            const apiEntity = entities.find(ent => 
              ent.metadata.name === api && ent.kind === 'API'
            );
            
            if (apiEntity && !visited.has(apiEntity.metadata.uid || api)) {
              const apiId = apiEntity.metadata.uid || `${apiEntity.kind}-${apiEntity.metadata.name}`;
              visited.add(apiId);
              
              const node: LineageNode = {
                id: apiId,
                entity: apiEntity,
                level: -(level + 1),
                parents: [],
                children: [nodeId],
                type: 'source',
                metadata: extractMetadata(apiEntity),
              };
              
              upstream.push(node);
              
              links.push({
                source: apiId,
                target: nodeId,
                type: 'data-flow',
                metadata: {
                  protocol: apiEntity.spec?.type as string,
                  format: apiEntity.spec?.definition?.format as string,
                },
              });
            }
          });
        }
      };
      
      // Traverse downstream (dependents, data consumers)
      const traverseDownstream = (e: Entity, level: number) => {
        if (level > maxDepth) return;
        
        const nodeId = e.metadata.uid || `${e.kind}-${e.metadata.name}`;
        
        // Find dependents
        entities.forEach(otherEntity => {
          if (otherEntity.spec?.dependsOn) {
            const deps = Array.isArray(otherEntity.spec.dependsOn) 
              ? otherEntity.spec.dependsOn 
              : [otherEntity.spec.dependsOn];
            
            if (deps.includes(e.metadata.name) || deps.includes(nodeId)) {
              const otherId = otherEntity.metadata.uid || `${otherEntity.kind}-${otherEntity.metadata.name}`;
              
              if (!visited.has(otherId)) {
                visited.add(otherId);
                
                const node: LineageNode = {
                  id: otherId,
                  entity: otherEntity,
                  level: level + 1,
                  parents: [nodeId],
                  children: [],
                  type: determineNodeType(otherEntity),
                  metadata: extractMetadata(otherEntity),
                };
                
                downstream.push(node);
                
                links.push({
                  source: nodeId,
                  target: otherId,
                  type: 'data-flow',
                  metadata: {
                    volume: '~1GB/day',
                    frequency: 'real-time',
                  },
                });
                
                traverseDownstream(otherEntity, level + 1);
              }
            }
          }
        });
        
        // Find provided APIs consumers
        if (e.spec?.providesApis) {
          e.spec.providesApis.forEach((api: string) => {
            entities.forEach(otherEntity => {
              if (otherEntity.spec?.consumesApis?.includes(api)) {
                const otherId = otherEntity.metadata.uid || `${otherEntity.kind}-${otherEntity.metadata.name}`;
                
                if (!visited.has(otherId)) {
                  visited.add(otherId);
                  
                  const node: LineageNode = {
                    id: otherId,
                    entity: otherEntity,
                    level: level + 1,
                    parents: [nodeId],
                    children: [],
                    type: determineNodeType(otherEntity),
                    metadata: extractMetadata(otherEntity),
                  };
                  
                  downstream.push(node);
                  
                  links.push({
                    source: nodeId,
                    target: otherId,
                    type: 'data-flow',
                    metadata: {
                      protocol: 'REST',
                      format: 'JSON',
                    },
                  });
                  
                  traverseDownstream(otherEntity, level + 1);
                }
              }
            });
          });
        }
      };
      
      traverseUpstream(entity, 0);
      traverseDownstream(entity, 0);
      
      setLineageView({
        upstream,
        downstream,
        current,
        links,
      });
      
      setLoading(false);
    };
    
    buildLineage();
  }, [entity, entities, maxDepth]);

  // Determine node type based on entity
  const determineNodeType = (entity: Entity): LineageNode['type'] => {
    if (entity.kind === 'API') return 'source';
    if (entity.kind === 'Component') {
      if (entity.spec?.type === 'service') return 'process';
      if (entity.spec?.type === 'database') return 'storage';
      if (entity.spec?.type === 'library') return 'transform';
    }
    if (entity.kind === 'Resource') return 'storage';
    if (entity.kind === 'System') return 'sink';
    return 'process';
  };

  // Extract metadata from entity
  const extractMetadata = (entity: Entity) => {
    return {
      lastUpdate: entity.metadata.annotations?.['backstage.io/last-update'] || 
                  new Date().toISOString(),
      dataVolume: entity.metadata.annotations?.['backstage.io/data-volume'] || 
                  '~100MB/day',
      frequency: entity.metadata.annotations?.['backstage.io/update-frequency'] || 
                 'daily',
      quality: Math.random() * 100,
      latency: Math.random() * 1000,
    };
  };

  // Filter nodes based on search and type
  const filteredLineage = useMemo(() => {
    if (!lineageView) return null;
    
    let filteredUpstream = lineageView.upstream;
    let filteredDownstream = lineageView.downstream;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredUpstream = lineageView.upstream.filter(node =>
        node.entity.metadata.name.toLowerCase().includes(query) ||
        node.entity.kind.toLowerCase().includes(query)
      );
      filteredDownstream = lineageView.downstream.filter(node =>
        node.entity.metadata.name.toLowerCase().includes(query) ||
        node.entity.kind.toLowerCase().includes(query)
      );
    }
    
    if (filterType !== 'all') {
      filteredUpstream = filteredUpstream.filter(node => node.type === filterType);
      filteredDownstream = filteredDownstream.filter(node => node.type === filterType);
    }
    
    // Filter by expanded levels
    filteredUpstream = filteredUpstream.filter(node => 
      expandedLevels.has(Math.abs(node.level))
    );
    filteredDownstream = filteredDownstream.filter(node =>
      expandedLevels.has(node.level)
    );
    
    return {
      ...lineageView,
      upstream: filteredUpstream,
      downstream: filteredDownstream,
    };
  }, [lineageView, searchQuery, filterType, expandedLevels]);

  // Handle node click
  const handleNodeClick = useCallback((node: LineageNode) => {
    setSelectedNode(node);
    if (onEntityClick) {
      onEntityClick(node.entity);
    }
  }, [onEntityClick]);

  // Toggle level expansion
  const toggleLevel = (level: number) => {
    const newExpanded = new Set(expandedLevels);
    if (newExpanded.has(level)) {
      newExpanded.delete(level);
    } else {
      newExpanded.add(level);
    }
    setExpandedLevels(newExpanded);
  };

  // Export lineage as image
  const exportLineage = () => {
    // Implementation would export the SVG as image
    console.log('Export lineage');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!filteredLineage) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No lineage data available for this entity
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Filter by type */}
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.keys(NODE_TYPES).map(type => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* View mode */}
              <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="View mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">Horizontal</SelectItem>
                  <SelectItem value="vertical">Vertical</SelectItem>
                  <SelectItem value="radial">Radial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              {/* Options */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowMetadata(!showMetadata)}
                title={showMetadata ? "Hide metadata" : "Show metadata"}
              >
                {showMetadata ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setAnimateFlow(!animateFlow)}
                title={animateFlow ? "Pause animation" : "Play animation"}
              >
                {animateFlow ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={exportLineage}
                title="Export as image"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Additional options */}
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={animateFlow}
                onCheckedChange={setAnimateFlow}
              />
              <Label className="text-sm">Animate Data Flow</Label>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-sm">
              {Object.entries(NODE_TYPES).map(([type, config]) => {
                const Icon = config.icon;
                return (
                  <div key={type} className="flex items-center gap-1">
                    <div className={cn("p-1 rounded", config.color)}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <span className="capitalize">{type}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Lineage Visualization */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              <div ref={containerRef} className="relative h-[600px] overflow-auto bg-gray-50 dark:bg-gray-900">
                {/* SVG Visualization would go here */}
                <div className="p-8">
                  <div className="flex items-center justify-between">
                    {/* Upstream */}
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-muted-foreground mb-4">
                        Upstream ({filteredLineage.upstream.length})
                      </h4>
                      <div className="space-y-2">
                        {filteredLineage.upstream.slice(0, 5).map(node => {
                          const NodeIcon = NODE_TYPES[node.type].icon;
                          return (
                            <div
                              key={node.id}
                              onClick={() => handleNodeClick(node)}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                                "hover:bg-white dark:hover:bg-gray-800",
                                selectedNode?.id === node.id && "ring-2 ring-blue-500"
                              )}
                            >
                              <div className={cn("p-2 rounded", NODE_TYPES[node.type].color)}>
                                <NodeIcon className="w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-sm">{node.entity.metadata.name}</div>
                                <div className="text-xs text-muted-foreground">{node.entity.kind}</div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Current Entity */}
                    <div className="px-8">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300" />
                        </div>
                        <div className="relative flex justify-center">
                          <div
                            className={cn(
                              "bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-blue-500",
                              "shadow-lg cursor-pointer"
                            )}
                            onClick={() => handleNodeClick(filteredLineage.current)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                                <Database className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <div className="font-semibold">{entity.metadata.name}</div>
                                <div className="text-sm text-muted-foreground">{entity.kind}</div>
                              </div>
                            </div>
                            {showMetadata && filteredLineage.current.metadata && (
                              <div className="mt-3 pt-3 border-t text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Quality</span>
                                  <span>{filteredLineage.current.metadata.quality?.toFixed(0)}%</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Volume</span>
                                  <span>{filteredLineage.current.metadata.dataVolume}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Downstream */}
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-muted-foreground mb-4">
                        Downstream ({filteredLineage.downstream.length})
                      </h4>
                      <div className="space-y-2">
                        {filteredLineage.downstream.slice(0, 5).map(node => {
                          const NodeIcon = NODE_TYPES[node.type].icon;
                          return (
                            <div
                              key={node.id}
                              onClick={() => handleNodeClick(node)}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                                "hover:bg-white dark:hover:bg-gray-800",
                                selectedNode?.id === node.id && "ring-2 ring-blue-500"
                              )}
                            >
                              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                              <div className={cn("p-2 rounded", NODE_TYPES[node.type].color)}>
                                <NodeIcon className="w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-sm">{node.entity.metadata.name}</div>
                                <div className="text-xs text-muted-foreground">{node.entity.kind}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Details Panel */}
        <div className="space-y-4">
          {selectedNode ? (
            <>
              {/* Selected Node Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {(() => {
                      const Icon = NODE_TYPES[selectedNode.type].icon;
                      return <Icon className="h-5 w-5" />;
                    })()}
                    {selectedNode.entity.metadata.name}
                  </CardTitle>
                  <CardDescription>
                    {selectedNode.entity.kind} • Level {Math.abs(selectedNode.level)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Description</div>
                    <div className="text-sm">
                      {selectedNode.entity.metadata.description || 'No description'}
                    </div>
                  </div>
                  
                  {selectedNode.metadata && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Data Quality</span>
                          <Badge variant={
                            selectedNode.metadata.quality! > 90 ? 'default' :
                            selectedNode.metadata.quality! > 70 ? 'secondary' : 'destructive'
                          }>
                            {selectedNode.metadata.quality?.toFixed(0)}%
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Volume</span>
                          <span>{selectedNode.metadata.dataVolume}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Frequency</span>
                          <span>{selectedNode.metadata.frequency}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Latency</span>
                          <span>{selectedNode.metadata.latency?.toFixed(0)}ms</span>
                        </div>
                      </div>
                    </>
                  )}
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Parents: </span>
                      <span className="font-medium">{selectedNode.parents.length}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Children: </span>
                      <span className="font-medium">{selectedNode.children.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Data Flow Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    Data Flow
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Direction</span>
                    <Badge variant="outline">
                      {dataFlowDirection === 'forward' ? 'Forward' : 'Backward'}
                    </Badge>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Incoming</div>
                    {filteredLineage.links
                      .filter(link => link.target === selectedNode.id)
                      .slice(0, 3)
                      .map((link, idx) => {
                        const sourceNode = [...filteredLineage.upstream, filteredLineage.current]
                          .find(n => n.id === link.source);
                        return sourceNode ? (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <ArrowRight className="w-3 h-3" />
                            <span>{sourceNode.entity.metadata.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {link.type}
                            </Badge>
                          </div>
                        ) : null;
                      })}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Outgoing</div>
                    {filteredLineage.links
                      .filter(link => link.source === selectedNode.id)
                      .slice(0, 3)
                      .map((link, idx) => {
                        const targetNode = [...filteredLineage.downstream, filteredLineage.current]
                          .find(n => n.id === link.target);
                        return targetNode ? (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <ArrowLeft className="w-3 h-3" />
                            <span>{targetNode.entity.metadata.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {link.type}
                            </Badge>
                          </div>
                        ) : null;
                      })}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Network className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a Node</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Click on any node to view its details and data flow information
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default EntityLineage;