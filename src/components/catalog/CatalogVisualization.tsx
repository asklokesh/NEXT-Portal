'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from '@/components/ui/card';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
 Network,
 GitBranch,
 Layers,
 BarChart3,
 PieChart,
 Activity,
 Users,
 Building2,
 Workflow,
 Download,
 Maximize2,
 Filter,
 Palette,
 Eye,
 EyeOff,
 ZoomIn,
 ZoomOut,
 Move,
 Settings,
 RefreshCw
} from 'lucide-react';
import {
 Tooltip,
 TooltipContent,
 TooltipProvider,
 TooltipTrigger,
} from '@/components/ui/tooltip';
import { catalogClient } from '@/services/backstage/clients/catalog.client';
import type { Entity } from '@/services/backstage/types/entities';

// Dynamically import heavy visualization libraries
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
 ssr: false,
 loading: () => <div className="flex items-center justify-center h-96">Loading 3D visualization...</div>
});

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
 ssr: false,
 loading: () => <div className="flex items-center justify-center h-96">Loading visualization...</div>
});

const Sankey = dynamic(() => import('@nivo/sankey').then(m => m.ResponsiveSankey), {
 ssr: false,
 loading: () => <div className="flex items-center justify-center h-96">Loading flow diagram...</div>
});

const Treemap = dynamic(() => import('@nivo/treemap').then(m => m.ResponsiveTreeMap), {
 ssr: false,
 loading: () => <div className="flex items-center justify-center h-96">Loading treemap...</div>
});

interface CatalogVisualizationProps {
 entities?: Entity[];
}

interface GraphNode {
 id: string;
 name: string;
 kind: string;
 type?: string;
 owner?: string;
 lifecycle?: string;
 group?: string;
 size?: number;
 color?: string;
 x?: number;
 y?: number;
 z?: number;
}

interface GraphLink {
 source: string;
 target: string;
 type: string;
 strength?: number;
}

type VisualizationType = 'dependency-2d' | 'dependency-3d' | 'hierarchy' | 'flow' | 'ownership';
type ColorScheme = 'kind' | 'lifecycle' | 'owner' | 'health' | 'type';
type LayoutAlgorithm = 'force' | 'radial' | 'hierarchical' | 'circular';

export function CatalogVisualization({ entities = [] }: CatalogVisualizationProps) {
 const [visualizationType, setVisualizationType] = useState<VisualizationType>('dependency-2d');
 const [colorScheme, setColorScheme] = useState<ColorScheme>('kind');
 const [layoutAlgorithm, setLayoutAlgorithm] = useState<LayoutAlgorithm>('force');
 const [graphData, setGraphData] = useState<{ nodes: GraphNode[], links: GraphLink[] }>({ nodes: [], links: [] });
 const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
 const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
 const [isLoading, setIsLoading] = useState(true);
 const [show3D, setShow3D] = useState(false);
 const [showLabels, setShowLabels] = useState(true);
 const [nodeSize, setNodeSize] = useState([10]);
 const [linkDistance, setLinkDistance] = useState([50]);
 const [chargeStrength, setChargeStrength] = useState([-100]);
 const [filterDepth, setFilterDepth] = useState([2]);

 // Process entities into graph data
 useEffect(() => {
 processGraphData();
 }, [entities, colorScheme]);

 const processGraphData = useCallback(async () => {
 setIsLoading(true);
 
 const nodes: GraphNode[] = [];
 const links: GraphLink[] = [];
 const nodeMap = new Map<string, GraphNode>();

 // Create nodes
 for (const entity of entities) {
 const nodeId = `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`;
 const node: GraphNode = {
 id: nodeId,
 name: entity.metadata.name,
 kind: entity.kind,
 type: entity.spec?.type as string,
 owner: entity.spec?.owner as string,
 lifecycle: entity.spec?.lifecycle as string,
 group: getNodeGroup(entity, colorScheme),
 size: getNodeSize(entity),
 color: getNodeColor(entity, colorScheme),
 };
 
 nodes.push(node);
 nodeMap.set(nodeId, node);
 }

 // Create links from relations
 for (const entity of entities) {
 const sourceId = `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`;
 
 if (entity.relations) {
 for (const relation of entity.relations) {
 const targetId = relation.targetRef;
 
 // Only add link if both nodes exist
 if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
 links.push({
 source: sourceId,
 target: targetId,
 type: relation.type,
 strength: getRelationStrength(relation.type),
 });
 }
 }
 }
 }

 setGraphData({ nodes, links });
 setIsLoading(false);
 }, [entities, colorScheme]);

 const getNodeGroup = (entity: Entity, scheme: ColorScheme): string => {
 switch (scheme) {
 case 'kind':
 return entity.kind;
 case 'lifecycle':
 return entity.spec?.lifecycle as string || 'unknown';
 case 'owner':
 return entity.spec?.owner as string || 'unknown';
 case 'type':
 return entity.spec?.type as string || 'unknown';
 case 'health':
 return 'healthy'; // Would be from metrics
 default:
 return 'default';
 }
 };

 const getNodeSize = (entity: Entity): number => {
 // Size based on number of relations
 const relationCount = entity.relations?.length || 0;
 return Math.max(10, Math.min(30, 10 + relationCount * 2));
 };

 const getNodeColor = (entity: Entity, scheme: ColorScheme): string => {
 const colors = {
 Component: '#3b82f6',
 API: '#10b981',
 System: '#8b5cf6',
 Domain: '#f59e0b',
 Resource: '#ef4444',
 Group: '#6366f1',
 User: '#ec4899',
 Template: '#14b8a6',
 };

 const lifecycleColors = {
 production: '#10b981',
 experimental: '#f59e0b',
 deprecated: '#ef4444',
 development: '#3b82f6',
 };

 switch (scheme) {
 case 'kind':
 return colors[entity.kind as keyof typeof colors] || '#6b7280';
 case 'lifecycle':
 return lifecycleColors[entity.spec?.lifecycle as keyof typeof lifecycleColors] || '#6b7280';
 default:
 return '#6b7280';
 }
 };

 const getRelationStrength = (relationType: string): number => {
 const strengths = {
 dependsOn: 1.0,
 partOf: 0.8,
 providesApi: 0.6,
 consumesApi: 0.6,
 ownedBy: 0.4,
 };
 return strengths[relationType as keyof typeof strengths] || 0.5;
 };

 const handleNodeClick = useCallback((node: GraphNode) => {
 setSelectedNode(node);
 
 // Highlight connected nodes
 const connected = new Set<string>();
 connected.add(node.id);
 
 graphData.links.forEach(link => {
 if (link.source === node.id || (link.source as any).id === node.id) {
 connected.add(typeof link.target === 'string' ? link.target : (link.target as any).id);
 }
 if (link.target === node.id || (link.target as any).id === node.id) {
 connected.add(typeof link.source === 'string' ? link.source : (link.source as any).id);
 }
 });
 
 setHighlightedNodes(connected);
 }, [graphData]);

 const exportVisualization = useCallback(() => {
 // Export as SVG or PNG
 const canvas = document.querySelector('canvas');
 if (canvas) {
 canvas.toBlob(blob => {
 if (blob) {
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `catalog-visualization-${Date.now()}.png`;
 a.click();
 URL.revokeObjectURL(url);
 }
 });
 }
 }, []);

 const getTreemapData = useMemo(() => {
 const root = {
 name: 'Catalog',
 children: [] as any[],
 };

 const groupMap = new Map<string, any>();

 entities.forEach(entity => {
 const groupKey = entity.spec?.system || entity.spec?.domain || 'Other';
 
 if (!groupMap.has(groupKey)) {
 groupMap.set(groupKey, {
 name: groupKey,
 children: [],
 });
 }
 
 groupMap.get(groupKey)!.children.push({
 name: entity.metadata.name,
 value: 1,
 kind: entity.kind,
 owner: entity.spec?.owner,
 });
 });

 root.children = Array.from(groupMap.values());
 return root;
 }, [entities]);

 const getSankeyData = useMemo(() => {
 const nodes: any[] = [];
 const links: any[] = [];
 const nodeIndex = new Map<string, number>();

 // Create unique nodes
 entities.forEach((entity, index) => {
 const id = `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`;
 nodes.push({ id });
 nodeIndex.set(id, index);
 });

 // Create links
 entities.forEach(entity => {
 const sourceId = `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`;
 const sourceIndex = nodeIndex.get(sourceId);
 
 if (sourceIndex !== undefined && entity.relations) {
 entity.relations.forEach(relation => {
 const targetIndex = nodeIndex.get(relation.targetRef);
 if (targetIndex !== undefined) {
 links.push({
 source: sourceIndex,
 target: targetIndex,
 value: 1,
 });
 }
 });
 }
 });

 return { nodes, links };
 }, [entities]);

 return (
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>Catalog Visualization</CardTitle>
 <CardDescription>
 Interactive visualization of your service catalog
 </CardDescription>
 </div>
 <div className="flex items-center gap-2">
 <Button
 variant="outline"
 size="icon"
 onClick={() => setIsLoading(true)}
 >
 <RefreshCw className="h-4 w-4" />
 </Button>
 <Button
 variant="outline"
 size="icon"
 onClick={exportVisualization}
 >
 <Download className="h-4 w-4" />
 </Button>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <Tabs value={visualizationType} onValueChange={(v) => setVisualizationType(v as VisualizationType)}>
 <TabsList className="grid w-full grid-cols-5">
 <TabsTrigger value="dependency-2d" className="gap-2">
 <Network className="h-4 w-4" />
 2D Graph
 </TabsTrigger>
 <TabsTrigger value="dependency-3d" className="gap-2">
 <Layers className="h-4 w-4" />
 3D Graph
 </TabsTrigger>
 <TabsTrigger value="hierarchy" className="gap-2">
 <GitBranch className="h-4 w-4" />
 Hierarchy
 </TabsTrigger>
 <TabsTrigger value="flow" className="gap-2">
 <Workflow className="h-4 w-4" />
 Flow
 </TabsTrigger>
 <TabsTrigger value="ownership" className="gap-2">
 <Users className="h-4 w-4" />
 Ownership
 </TabsTrigger>
 </TabsList>

 <div className="mt-4 space-y-4">
 {/* Controls */}
 <div className="flex flex-wrap gap-4">
 <div className="flex items-center gap-2">
 <Label>Color by</Label>
 <Select value={colorScheme} onValueChange={(v) => setColorScheme(v as ColorScheme)}>
 <SelectTrigger className="w-32">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="kind">Kind</SelectItem>
 <SelectItem value="lifecycle">Lifecycle</SelectItem>
 <SelectItem value="owner">Owner</SelectItem>
 <SelectItem value="type">Type</SelectItem>
 <SelectItem value="health">Health</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="flex items-center gap-2">
 <Label>Layout</Label>
 <Select value={layoutAlgorithm} onValueChange={(v) => setLayoutAlgorithm(v as LayoutAlgorithm)}>
 <SelectTrigger className="w-32">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="force">Force</SelectItem>
 <SelectItem value="radial">Radial</SelectItem>
 <SelectItem value="hierarchical">Hierarchical</SelectItem>
 <SelectItem value="circular">Circular</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="flex items-center space-x-2">
 <Switch
 id="show-labels"
 checked={showLabels}
 onCheckedChange={setShowLabels}
 />
 <Label htmlFor="show-labels">Show labels</Label>
 </div>

 <div className="flex items-center gap-2">
 <Label>Node size</Label>
 <Slider
 value={nodeSize}
 onValueChange={setNodeSize}
 min={5}
 max={50}
 step={5}
 className="w-32"
 />
 </div>
 </div>

 {/* Selected Node Info */}
 {selectedNode && (
 <div className="rounded-lg border p-4 bg-muted/50">
 <div className="flex items-center justify-between">
 <h4 className="font-semibold">{selectedNode.name}</h4>
 <Badge variant="outline">{selectedNode.kind}</Badge>
 </div>
 <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
 <div>
 <span className="text-muted-foreground">Type:</span> {selectedNode.type || 'N/A'}
 </div>
 <div>
 <span className="text-muted-foreground">Owner:</span> {selectedNode.owner || 'N/A'}
 </div>
 <div>
 <span className="text-muted-foreground">Lifecycle:</span> {selectedNode.lifecycle || 'N/A'}
 </div>
 <div>
 <span className="text-muted-foreground">Connections:</span> {highlightedNodes.size - 1}
 </div>
 </div>
 </div>
 )}

 {/* Visualization Content */}
 <div className="relative h-[600px] w-full rounded-lg border bg-background">
 <TabsContent value="dependency-2d" className="h-full">
 {!isLoading && (
 <ForceGraph2D
 graphData={graphData}
 nodeLabel={showLabels ? 'name' : undefined}
 nodeColor={node => (node as GraphNode).color || '#6b7280'}
 nodeRelSize={nodeSize[0] / 10}
 linkDirectionalArrowLength={3.5}
 linkDirectionalArrowRelPos={1}
 linkCurvature={0.25}
 onNodeClick={handleNodeClick}
 nodeCanvasObject={(node, ctx, globalScale) => {
 const label = (node as GraphNode).name;
 const fontSize = 12 / globalScale;
 ctx.font = `${fontSize}px Sans-Serif`;
 
 if (highlightedNodes.has((node as GraphNode).id)) {
 ctx.fillStyle = (node as GraphNode).color || '#6b7280';
 ctx.beginPath();
 ctx.arc(node.x!, node.y!, nodeSize[0] * 1.5, 0, 2 * Math.PI, false);
 ctx.fill();
 }
 
 if (showLabels) {
 ctx.textAlign = 'center';
 ctx.textBaseline = 'middle';
 ctx.fillStyle = 'white';
 ctx.fillText(label, node.x!, node.y! + nodeSize[0] + fontSize);
 }
 }}
 />
 )}
 </TabsContent>

 <TabsContent value="dependency-3d" className="h-full">
 {!isLoading && (
 <ForceGraph3D
 graphData={graphData}
 nodeLabel={showLabels ? 'name' : undefined}
 nodeColor={node => (node as GraphNode).color || '#6b7280'}
 nodeRelSize={nodeSize[0] / 10}
 linkDirectionalArrowLength={3.5}
 linkDirectionalArrowRelPos={1}
 linkCurvature={0.25}
 onNodeClick={handleNodeClick}
 />
 )}
 </TabsContent>

 <TabsContent value="hierarchy" className="h-full p-4">
 {!isLoading && (
 <Treemap
 data={getTreemapData}
 identity="name"
 value="value"
 margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
 labelSkipSize={12}
 labelTextColor={{ from: 'color', modifiers: [['darker', 1.2]] }}
 parentLabelTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
 colors={{ scheme: 'nivo' }}
 borderColor={{ from: 'color', modifiers: [['darker', 0.1]] }}
 animate={true}
 motionConfig="gentle"
 />
 )}
 </TabsContent>

 <TabsContent value="flow" className="h-full p-4">
 {!isLoading && (
 <Sankey
 data={getSankeyData}
 margin={{ top: 40, right: 160, bottom: 40, left: 50 }}
 align="justify"
 colors={{ scheme: 'category10' }}
 nodeOpacity={1}
 nodeThickness={18}
 nodeInnerPadding={3}
 nodeSpacing={24}
 nodeBorderWidth={0}
 linkOpacity={0.5}
 linkHoverOpacity={0.8}
 linkContract={3}
 enableLinkGradient={true}
 labelPosition="outside"
 labelOrientation="vertical"
 labelPadding={16}
 labelTextColor={{ from: 'color', modifiers: [['darker', 1]] }}
 animate={true}
 motionConfig="gentle"
 />
 )}
 </TabsContent>

 <TabsContent value="ownership" className="h-full p-4">
 <div className="grid gap-4">
 {/* Group entities by owner */}
 {Array.from(
 entities.reduce((acc, entity) => {
 const owner = entity.spec?.owner as string || 'Unowned';
 if (!acc.has(owner)) {
 acc.set(owner, []);
 }
 acc.get(owner)!.push(entity);
 return acc;
 }, new Map<string, Entity[]>())
 ).map(([owner, ownedEntities]) => (
 <div key={owner} className="rounded-lg border p-4">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <Users className="h-4 w-4" />
 <h4 className="font-semibold">{owner}</h4>
 </div>
 <Badge variant="secondary">{ownedEntities.length} entities</Badge>
 </div>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
 {ownedEntities.slice(0, 8).map(entity => (
 <div
 key={`${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`}
 className="flex items-center gap-2 text-sm"
 >
 <div
 className="h-2 w-2 rounded-full"
 style={{ backgroundColor: getNodeColor(entity, 'kind') }}
 />
 <span className="truncate">{entity.metadata.name}</span>
 </div>
 ))}
 {ownedEntities.length > 8 && (
 <div className="text-sm text-muted-foreground">
 +{ownedEntities.length - 8} more
 </div>
 )}
 </div>
 </div>
 ))}
 </div>
 </TabsContent>
 </div>
 </div>
 </Tabs>
 </CardContent>
 </Card>
 );
}