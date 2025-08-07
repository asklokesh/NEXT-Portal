'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import dynamic from 'next/dynamic';
import {
 Network,
 GitBranch,
 AlertTriangle,
 Info,
 ZoomIn,
 ZoomOut,
 Maximize2,
 Download,
 Filter,
 Layers,
 Activity,
 Shield,
 Database,
 Cloud,
 Globe,
 Package,
 Zap,
 Target,
 ArrowRight,
 Share2,
 AlertCircle,
 CheckCircle,
 Loader2,
 Search,
 Settings,
 Eye,
 EyeOff,
 RefreshCw,
 Play,
 Pause,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from '@/services/backstage/types/entities';

// Dynamically import ForceGraph3D to avoid SSR issues
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
 ssr: false,
 loading: () => (
 <div className="flex items-center justify-center h-[600px]">
 <Loader2 className="h-8 w-8 animate-spin" />
 </div>
 ),
});

interface DependencyGraphProps {
 entities: Entity[];
 onEntityClick?: (entity: Entity) => void;
 className?: string;
}

interface ExtendedEntity extends Entity {
 metrics?: {
 health?: number;
 };
}

interface GraphNode {
 id: string;
 name: string;
 type: string;
 entity: ExtendedEntity;
 health?: number;
 dependencies: string[];
 dependents: string[];
 impactScore: number;
 criticalPath: boolean;
}

interface GraphLink {
 source: string;
 target: string;
 type: 'depends-on' | 'provides' | 'consumes' | 'parent-of';
 strength: number;
}

interface ImpactAnalysis {
 directImpact: string[];
 indirectImpact: string[];
 criticalPaths: string[][];
 riskScore: number;
 affectedTeams: string[];
 estimatedDowntime: number;
}

const NODE_COLORS = {
 Component: '#3B82F6', // Blue
 API: '#10B981', // Green
 Resource: '#F59E0B', // Yellow
 System: '#8B5CF6', // Purple
 Domain: '#EC4899', // Pink
 Group: '#6B7280', // Gray
};

const HEALTH_COLORS = {
 healthy: '#10B981',
 degraded: '#F59E0B',
 unhealthy: '#EF4444',
 unknown: '#6B7280',
};

export function DependencyGraph({ entities, onEntityClick, className }: DependencyGraphProps) {
 const fgRef = useRef<any>();
 const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({
 nodes: [],
 links: [],
 });
 const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
 const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
 const [impactAnalysis, setImpactAnalysis] = useState<ImpactAnalysis | null>(null);
 const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
 const [showLabels, setShowLabels] = useState(true);
 const [highlightDependencies, setHighlightDependencies] = useState(true);
 const [animateLinks, setAnimateLinks] = useState(true);
 const [filterType, setFilterType] = useState<string>('all');
 const [searchQuery, setSearchQuery] = useState('');
 const [layoutType, setLayoutType] = useState<'force' | 'radial' | 'hierarchical'>('force');

 // Build graph data from entities
 useEffect(() => {
 const nodes: GraphNode[] = [];
 const links: GraphLink[] = [];
 const nodeMap = new Map<string, GraphNode>();

 // Create nodes
 entities.forEach((entity) => {
 const nodeId = entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`;
 const extEntity = entity as ExtendedEntity;
 const node: GraphNode = {
 id: nodeId,
 name: entity.metadata.name,
 type: entity.kind,
 entity: extEntity,
 health: extEntity.metrics?.health || Math.random() * 100,
 dependencies: [],
 dependents: [],
 impactScore: 0,
 criticalPath: false,
 };
 nodes.push(node);
 nodeMap.set(nodeId, node);
 });

 // Create links based on relationships
 entities.forEach((entity) => {
 const sourceId = entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`;
 const sourceNode = nodeMap.get(sourceId);
 if (!sourceNode) return;

 // Parse dependencies from spec
 if (entity.spec?.dependsOn) {
 const deps = Array.isArray(entity.spec.dependsOn) 
 ? entity.spec.dependsOn 
 : [entity.spec.dependsOn];
 
 deps.forEach((dep: string) => {
 const targetNode = nodes.find(n => n.name === dep || n.id === dep);
 if (targetNode) {
 links.push({
 source: sourceId,
 target: targetNode.id,
 type: 'depends-on',
 strength: 1,
 });
 sourceNode.dependencies.push(targetNode.id);
 targetNode.dependents.push(sourceId);
 }
 });
 }

 // Parse API relationships
 if (entity.spec?.providesApis) {
 entity.spec.providesApis.forEach((api: string) => {
 const apiNode = nodes.find(n => n.name === api && n.type === 'API');
 if (apiNode) {
 links.push({
 source: sourceId,
 target: apiNode.id,
 type: 'provides',
 strength: 0.8,
 });
 }
 });
 }

 if (entity.spec?.consumesApis) {
 entity.spec.consumesApis.forEach((api: string) => {
 const apiNode = nodes.find(n => n.name === api && n.type === 'API');
 if (apiNode) {
 links.push({
 source: apiNode.id,
 target: sourceId,
 type: 'consumes',
 strength: 0.8,
 });
 sourceNode.dependencies.push(apiNode.id);
 apiNode.dependents.push(sourceId);
 }
 });
 }

 // System relationships
 if (entity.spec?.system) {
 const systemNode = nodes.find(n => n.name === entity.spec.system && n.type === 'System');
 if (systemNode) {
 links.push({
 source: systemNode.id,
 target: sourceId,
 type: 'parent-of',
 strength: 0.5,
 });
 }
 }
 });

 // Calculate impact scores and critical paths
 nodes.forEach((node) => {
 node.impactScore = calculateImpactScore(node, nodeMap);
 node.criticalPath = isOnCriticalPath(node, nodeMap);
 });

 setGraphData({ nodes, links });
 }, [entities]);

 // Calculate impact score based on dependencies
 const calculateImpactScore = (node: GraphNode, nodeMap: Map<string, GraphNode>): number => {
 const visited = new Set<string>();
 const calculateDownstream = (nodeId: string, depth: number = 0): number => {
 if (visited.has(nodeId) || depth > 5) return 0;
 visited.add(nodeId);
 
 const currentNode = nodeMap.get(nodeId);
 if (!currentNode) return 0;
 
 let score = currentNode.dependents.length * Math.pow(0.8, depth);
 currentNode.dependents.forEach(depId => {
 score += calculateDownstream(depId, depth + 1);
 });
 
 return score;
 };
 
 return calculateDownstream(node.id);
 };

 // Check if node is on critical path
 const isOnCriticalPath = (node: GraphNode, nodeMap: Map<string, GraphNode>): boolean => {
 // A node is on critical path if it has high impact and is a dependency for critical services
 return node.impactScore > 5 || node.dependents.length > 3;
 };

 // Perform impact analysis for selected node
 const analyzeImpact = useCallback((node: GraphNode) => {
 if (!graphData.nodes.length) return;

 const directImpact: string[] = [];
 const indirectImpact: string[] = [];
 const visited = new Set<string>();
 const affectedTeams = new Set<string>();

 // BFS to find all impacted nodes
 const queue = [{ id: node.id, depth: 0 }];
 visited.add(node.id);

 while (queue.length > 0) {
 const { id, depth } = queue.shift()!;
 const currentNode = graphData.nodes.find(n => n.id === id);
 if (!currentNode) continue;

 currentNode.dependents.forEach(depId => {
 if (!visited.has(depId)) {
 visited.add(depId);
 const depNode = graphData.nodes.find(n => n.id === depId);
 if (depNode) {
 if (depth === 0) {
 directImpact.push(depId);
 } else {
 indirectImpact.push(depId);
 }
 if (depNode.entity.spec?.owner) {
 affectedTeams.add(depNode.entity.spec.owner);
 }
 queue.push({ id: depId, depth: depth + 1 });
 }
 }
 });
 }

 // Find critical paths
 const criticalPaths = findCriticalPaths(node, graphData.nodes);

 // Calculate risk score
 const riskScore = 
 directImpact.length * 10 + 
 indirectImpact.length * 5 + 
 (node.criticalPath ? 20 : 0) +
 (100 - (node.health || 0)) * 0.3;

 // Estimate downtime (mock calculation)
 const estimatedDowntime = Math.round(
 (directImpact.length * 15 + indirectImpact.length * 5) * 
 (node.health ? (100 - node.health) / 100 : 1)
 );

 setImpactAnalysis({
 directImpact,
 indirectImpact,
 criticalPaths,
 riskScore: Math.min(100, Math.round(riskScore)),
 affectedTeams: Array.from(affectedTeams),
 estimatedDowntime,
 });
 }, [graphData]);

 // Find critical paths from node
 const findCriticalPaths = (startNode: GraphNode, nodes: GraphNode[]): string[][] => {
 const paths: string[][] = [];
 const visited = new Set<string>();

 const dfs = (nodeId: string, path: string[]) => {
 if (path.length > 5) return; // Limit depth
 
 const node = nodes.find(n => n.id === nodeId);
 if (!node) return;

 if (node.dependents.length === 0) {
 if (path.length > 2) {
 paths.push([...path]);
 }
 return;
 }

 node.dependents.forEach(depId => {
 if (!visited.has(depId)) {
 visited.add(depId);
 dfs(depId, [...path, depId]);
 visited.delete(depId);
 }
 });
 };

 dfs(startNode.id, [startNode.id]);
 return paths.slice(0, 5); // Return top 5 critical paths
 };

 // Filter nodes based on search and type
 const filteredData = useMemo(() => {
 let filteredNodes = graphData.nodes;
 let filteredLinks = graphData.links;

 if (searchQuery) {
 const query = searchQuery.toLowerCase();
 filteredNodes = graphData.nodes.filter(node => 
 node.name.toLowerCase().includes(query) ||
 node.type.toLowerCase().includes(query)
 );
 const nodeIds = new Set(filteredNodes.map(n => n.id));
 filteredLinks = graphData.links.filter(link => 
 nodeIds.has(link.source) && nodeIds.has(link.target)
 );
 }

 if (filterType !== 'all') {
 filteredNodes = filteredNodes.filter(node => node.type === filterType);
 const nodeIds = new Set(filteredNodes.map(n => n.id));
 filteredLinks = filteredLinks.filter(link => 
 nodeIds.has(link.source) && nodeIds.has(link.target)
 );
 }

 return { nodes: filteredNodes, links: filteredLinks };
 }, [graphData, searchQuery, filterType]);

 // Handle node click
 const handleNodeClick = useCallback((node: any) => {
 const graphNode = graphData.nodes.find(n => n.id === node.id);
 if (graphNode) {
 setSelectedNode(graphNode);
 analyzeImpact(graphNode);
 if (onEntityClick) {
 onEntityClick(graphNode.entity);
 }
 }
 }, [graphData, analyzeImpact, onEntityClick]);

 // Node color based on health
 const getNodeColor = useCallback((node: any) => {
 if (highlightDependencies && selectedNode) {
 if (node.id === selectedNode.id) return '#EF4444'; // Red for selected
 if (selectedNode.dependencies.includes(node.id)) return '#3B82F6'; // Blue for dependencies
 if (selectedNode.dependents.includes(node.id)) return '#10B981'; // Green for dependents
 return '#E5E7EB'; // Gray for others
 }

 const graphNode = graphData.nodes.find(n => n.id === node.id);
 if (!graphNode) return '#6B7280';

 if (graphNode.health) {
 if (graphNode.health >= 90) return HEALTH_COLORS.healthy;
 if (graphNode.health >= 70) return HEALTH_COLORS.degraded;
 return HEALTH_COLORS.unhealthy;
 }

 return NODE_COLORS[graphNode.type as keyof typeof NODE_COLORS] || '#6B7280';
 }, [selectedNode, highlightDependencies, graphData]);

 // Export graph as image
 const exportGraph = useCallback(() => {
 if (fgRef.current) {
 const dataUrl = fgRef.current.renderer().domElement.toDataURL('image/png');
 const link = document.createElement('a');
 link.href = dataUrl;
 link.download = 'dependency-graph.png';
 link.click();
 }
 }, []);

 // Get entity types for filter
 const entityTypes = useMemo(() => {
 const types = new Set(entities.map(e => e.kind));
 return Array.from(types);
 }, [entities]);

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
 placeholder="Search nodes..."
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
 {entityTypes.map(type => (
 <SelectItem key={type} value={type}>{type}</SelectItem>
 ))}
 </SelectContent>
 </Select>

 {/* Layout type */}
 <Select value={layoutType} onValueChange={(v: any) => setLayoutType(v)}>
 <SelectTrigger className="w-[150px]">
 <SelectValue placeholder="Layout" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="force">Force Layout</SelectItem>
 <SelectItem value="radial">Radial Layout</SelectItem>
 <SelectItem value="hierarchical">Hierarchical</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="flex items-center gap-2">
 {/* View mode toggle */}
 <div className="flex items-center gap-2 border rounded-md p-1">
 <Button
 variant={viewMode === '3d' ? 'default' : 'ghost'}
 size="sm"
 onClick={() => setViewMode('3d')}
 className="h-7 px-2"
 >
 3D
 </Button>
 <Button
 variant={viewMode === '2d' ? 'default' : 'ghost'}
 size="sm"
 onClick={() => setViewMode('2d')}
 className="h-7 px-2"
 >
 2D
 </Button>
 </div>

 {/* Options */}
 <Button
 variant="outline"
 size="icon"
 onClick={() => setShowLabels(!showLabels)}
 title={showLabels ? "Hide labels" : "Show labels"}
 >
 {showLabels ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
 </Button>

 <Button
 variant="outline"
 size="icon"
 onClick={() => setAnimateLinks(!animateLinks)}
 title={animateLinks ? "Pause animation" : "Play animation"}
 >
 {animateLinks ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
 </Button>

 <Button
 variant="outline"
 size="icon"
 onClick={exportGraph}
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
 checked={highlightDependencies}
 onCheckedChange={setHighlightDependencies}
 />
 <Label className="text-sm">Highlight Dependencies</Label>
 </div>

 {/* Legend */}
 <div className="flex items-center gap-4 text-sm">
 <div className="flex items-center gap-1">
 <div className="w-3 h-3 rounded-full bg-blue-500" />
 <span>Dependencies</span>
 </div>
 <div className="flex items-center gap-1">
 <div className="w-3 h-3 rounded-full bg-green-500" />
 <span>Dependents</span>
 </div>
 <div className="flex items-center gap-1">
 <div className="w-3 h-3 rounded-full bg-red-500" />
 <span>Selected</span>
 </div>
 <div className="flex items-center gap-1">
 <div className="w-3 h-3 rounded-full bg-yellow-500" />
 <span>Critical Path</span>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
 {/* Graph */}
 <div className="lg:col-span-2">
 <Card>
 <CardContent className="p-0">
 <div className="relative h-[600px] bg-gray-50 dark:bg-gray-900">
 <ForceGraph3D
 ref={fgRef}
 graphData={filteredData}
 width={undefined}
 height={600}
 nodeId="id"
 nodeLabel={showLabels ? "name" : undefined}
 nodeColor={getNodeColor}
 nodeOpacity={0.9}
 nodeRelSize={6}
 nodeVal={(node: any) => {
 const graphNode = graphData.nodes.find(n => n.id === node.id);
 return graphNode ? Math.max(1, graphNode.impactScore) : 1;
 }}
 linkColor={(link: any) => {
 if (highlightDependencies && selectedNode) {
 if (link.source.id === selectedNode.id || link.target.id === selectedNode.id) {
 return link.type === 'depends-on' ? '#3B82F6' : '#10B981';
 }
 }
 return '#94A3B8';
 }}
 linkWidth={2}
 linkOpacity={0.5}
 linkDirectionalParticles={animateLinks ? 2 : 0}
 linkDirectionalParticleSpeed={0.005}
 onNodeClick={handleNodeClick}
 onNodeHover={(node: any) => {
 const graphNode = node ? graphData.nodes.find(n => n.id === node.id) : null;
 setHoveredNode(graphNode || null);
 }}
 cooldownTicks={100}
 d3Force={layoutType === 'radial' ? 'radial' : undefined}
 />

 {/* Controls overlay */}
 <div className="absolute top-4 right-4 flex flex-col gap-2">
 <Button
 variant="secondary"
 size="icon"
 onClick={() => fgRef.current?.zoomToFit(400)}
 title="Fit to view"
 >
 <Maximize2 className="h-4 w-4" />
 </Button>
 </div>

 {/* Hover info */}
 {hoveredNode && (
 <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 max-w-xs">
 <h4 className="font-medium">{hoveredNode.name}</h4>
 <div className="text-sm text-muted-foreground mt-1">
 <p>Type: {hoveredNode.type}</p>
 <p>Health: {hoveredNode.health?.toFixed(0)}%</p>
 <p>Dependencies: {hoveredNode.dependencies.length}</p>
 <p>Dependents: {hoveredNode.dependents.length}</p>
 <p>Impact Score: {hoveredNode.impactScore.toFixed(1)}</p>
 </div>
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Impact Analysis Panel */}
 <div className="space-y-4">
 {selectedNode ? (
 <>
 {/* Selected Node Info */}
 <Card>
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <Target className="h-5 w-5" />
 {selectedNode.name}
 </CardTitle>
 <CardDescription>
 {selectedNode.type} • {selectedNode.entity.metadata.description || 'No description'}
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Health</span>
 <div className="flex items-center gap-2">
 <Badge variant={
 selectedNode.health && selectedNode.health >= 90 ? 'default' :
 selectedNode.health && selectedNode.health >= 70 ? 'secondary' : 'destructive'
 }>
 {selectedNode.health?.toFixed(0)}%
 </Badge>
 </div>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Owner</span>
 <span className="text-sm">{selectedNode.entity.spec?.owner || 'Unknown'}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">Impact Score</span>
 <Badge variant={selectedNode.impactScore > 5 ? 'destructive' : 'secondary'}>
 {selectedNode.impactScore.toFixed(1)}
 </Badge>
 </div>
 {selectedNode.criticalPath && (
 <Alert>
 <AlertTriangle className="h-4 w-4" />
 <AlertDescription>
 This service is on a critical path
 </AlertDescription>
 </Alert>
 )}
 </CardContent>
 </Card>

 {/* Impact Analysis */}
 {impactAnalysis && (
 <Card>
 <CardHeader>
 <CardTitle className="text-lg flex items-center gap-2">
 <Zap className="h-5 w-5" />
 Impact Analysis
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {/* Risk Score */}
 <div>
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium">Risk Score</span>
 <span className="text-sm font-medium">{impactAnalysis.riskScore}%</span>
 </div>
 <div className="w-full bg-gray-200 rounded-full h-2">
 <div
 className={cn("h-2 rounded-full", {
 'bg-green-500': impactAnalysis.riskScore < 30,
 'bg-yellow-500': impactAnalysis.riskScore < 70,
 'bg-red-500': impactAnalysis.riskScore >= 70,
 })}
 style={{ width: `${impactAnalysis.riskScore}%` }}
 />
 </div>
 </div>

 <Separator />

 {/* Direct Impact */}
 <div>
 <h4 className="text-sm font-medium mb-2">Direct Impact ({impactAnalysis.directImpact.length})</h4>
 <div className="flex flex-wrap gap-1">
 {impactAnalysis.directImpact.slice(0, 5).map(nodeId => {
 const node = graphData.nodes.find(n => n.id === nodeId);
 return node ? (
 <Badge key={nodeId} variant="destructive" className="text-xs">
 {node.name}
 </Badge>
 ) : null;
 })}
 {impactAnalysis.directImpact.length > 5 && (
 <Badge variant="outline" className="text-xs">
 +{impactAnalysis.directImpact.length - 5} more
 </Badge>
 )}
 </div>
 </div>

 {/* Indirect Impact */}
 {impactAnalysis.indirectImpact.length > 0 && (
 <div>
 <h4 className="text-sm font-medium mb-2">Indirect Impact ({impactAnalysis.indirectImpact.length})</h4>
 <div className="flex flex-wrap gap-1">
 {impactAnalysis.indirectImpact.slice(0, 5).map(nodeId => {
 const node = graphData.nodes.find(n => n.id === nodeId);
 return node ? (
 <Badge key={nodeId} variant="secondary" className="text-xs">
 {node.name}
 </Badge>
 ) : null;
 })}
 {impactAnalysis.indirectImpact.length > 5 && (
 <Badge variant="outline" className="text-xs">
 +{impactAnalysis.indirectImpact.length - 5} more
 </Badge>
 )}
 </div>
 </div>
 )}

 <Separator />

 {/* Metrics */}
 <div className="space-y-2">
 <div className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">Affected Teams</span>
 <span className="font-medium">{impactAnalysis.affectedTeams.length}</span>
 </div>
 <div className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">Est. Downtime</span>
 <span className="font-medium">{impactAnalysis.estimatedDowntime} min</span>
 </div>
 <div className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">Critical Paths</span>
 <span className="font-medium">{impactAnalysis.criticalPaths.length}</span>
 </div>
 </div>

 {/* Critical Paths */}
 {impactAnalysis.criticalPaths.length > 0 && (
 <>
 <Separator />
 <div>
 <h4 className="text-sm font-medium mb-2">Critical Paths</h4>
 <div className="space-y-1">
 {impactAnalysis.criticalPaths.slice(0, 3).map((path, idx) => (
 <div key={idx} className="text-xs text-muted-foreground flex items-center gap-1">
 {path.map((nodeId, i) => {
 const node = graphData.nodes.find(n => n.id === nodeId);
 return (
 <React.Fragment key={nodeId}>
 {i > 0 && <ArrowRight className="h-3 w-3" />}
 <span>{node?.name || nodeId}</span>
 </React.Fragment>
 );
 })}
 </div>
 ))}
 </div>
 </div>
 </>
 )}
 </CardContent>
 </Card>
 )}
 </>
 ) : (
 <Card>
 <CardContent className="flex flex-col items-center justify-center py-12">
 <Network className="h-12 w-12 text-muted-foreground mb-4" />
 <h3 className="text-lg font-medium mb-2">Select a Node</h3>
 <p className="text-sm text-muted-foreground text-center">
 Click on any node in the graph to view its dependencies and analyze potential impact
 </p>
 </CardContent>
 </Card>
 )}
 </div>
 </div>
 </div>
 );
}

// Export a static placeholder for SSR
export default function DependencyGraphWrapper(props: DependencyGraphProps) {
 return <DependencyGraph {...props} />;
}