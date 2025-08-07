'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { motion } from 'framer-motion';
import {
 ZoomIn,
 ZoomOut,
 RotateCcw,
 Maximize2,
 Filter,
 Settings,
 Download,
 Share2,
 ExternalLink,
 Database,
 GitBranch,
 Zap,
 Globe,
 Package
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

import { backstageClient, type Entity } from '@/lib/backstage/client';

interface DependencyNode {
 id: string;
 label: string;
 type: 'component' | 'api' | 'resource' | 'system' | 'domain';
 status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
 entity?: Entity;
 x?: number;
 y?: number;
 fx?: number;
 fy?: number;
}

interface DependencyEdge {
 source: string;
 target: string;
 type: 'dependsOn' | 'providesApi' | 'consumesApi' | 'partOf';
 strength: number;
}

interface DependencyGraphProps {
 serviceRef?: string; // If provided, show dependencies for specific service
 maxDepth?: number;
 interactive?: boolean;
 showLabels?: boolean;
 height?: number;
}

export const DependencyGraph = ({
 serviceRef,
 maxDepth = 2,
 interactive = true,
 showLabels = true,
 height = 600
}: DependencyGraphProps) => {
 const canvasRef = useRef<HTMLCanvasElement>(null);
 const containerRef = useRef<HTMLDivElement>(null);
 const [nodes, setNodes] = useState<DependencyNode[]>([]);
 const [edges, setEdges] = useState<DependencyEdge[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedNode, setSelectedNode] = useState<DependencyNode | null>(null);
 const [zoomLevel, setZoomLevel] = useState(1);
 const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
 const [isDragging, setIsDragging] = useState(false);
 const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
 const [filter, setFilter] = useState<string>('all');
 const [layoutMode, setLayoutMode] = useState<'force' | 'hierarchical' | 'circular'>('force');

 useEffect(() => {
 loadDependencyData();
 }, [serviceRef, maxDepth]);

 useEffect(() => {
 if (nodes.length > 0) {
 renderGraph();
 }
 }, [nodes, edges, zoomLevel, panOffset, filter, layoutMode]);

 const loadDependencyData = async () => {
 try {
 setLoading(true);
 
 if (serviceRef) {
 // Load dependencies for specific service
 const entity = await backstageClient.getEntityByRef(serviceRef);
 const deps = await generateDependencyGraph(entity, maxDepth);
 setNodes(deps.nodes);
 setEdges(deps.edges);
 } else {
 // Load all entities and their relationships
 const entities = await backstageClient.getCatalogEntities();
 const deps = await generateFullDependencyGraph(entities);
 setNodes(deps.nodes);
 setEdges(deps.edges);
 }
 } catch (error) {
 console.error('Failed to load dependency data:', error);
 toast.error('Failed to load dependency graph');
 
 // Use demo data
 setNodes(getDemoDependencyNodes());
 setEdges(getDemoDependencyEdges());
 } finally {
 setLoading(false);
 }
 };

 const generateDependencyGraph = async (entity: Entity, depth: number) => {
 const nodes: DependencyNode[] = [];
 const edges: DependencyEdge[] = [];
 const visited = new Set<string>();

 const addEntityNode = (ent: Entity, level: number) => {
 if (visited.has(ent.metadata.name) || level > depth) return;
 visited.add(ent.metadata.name);

 const node: DependencyNode = {
 id: ent.metadata.name,
 label: ent.metadata.title || ent.metadata.name,
 type: ent.kind.toLowerCase() as any,
 status: getEntityStatus(ent),
 entity: ent
 };
 nodes.push(node);

 // Add dependencies
 if ('dependsOn' in ent.spec && ent.spec.dependsOn) {
 (ent.spec.dependsOn as string[]).forEach(dep => {
 edges.push({
 source: ent.metadata.name,
 target: dep,
 type: 'dependsOn',
 strength: 1
 });
 });
 }

 // Add API relationships
 if ('providesApis' in ent.spec && ent.spec.providesApis) {
 (ent.spec.providesApis as string[]).forEach(api => {
 edges.push({
 source: ent.metadata.name,
 target: api,
 type: 'providesApi',
 strength: 0.8
 });
 });
 }

 if ('consumesApis' in ent.spec && ent.spec.consumesApis) {
 (ent.spec.consumesApis as string[]).forEach(api => {
 edges.push({
 source: api,
 target: ent.metadata.name,
 type: 'consumesApi',
 strength: 0.8
 });
 });
 }
 };

 addEntityNode(entity, 0);
 return { nodes, edges };
 };

 const generateFullDependencyGraph = async (entities: Entity[]) => {
 const nodes: DependencyNode[] = [];
 const edges: DependencyEdge[] = [];

 entities.forEach(entity => {
 const node: DependencyNode = {
 id: entity.metadata.name,
 label: entity.metadata.title || entity.metadata.name,
 type: entity.kind.toLowerCase() as any,
 status: getEntityStatus(entity),
 entity
 };
 nodes.push(node);
 });

 entities.forEach(entity => {
 // Add dependencies
 if ('dependsOn' in entity.spec && entity.spec.dependsOn) {
 (entity.spec.dependsOn as string[]).forEach(dep => {
 edges.push({
 source: entity.metadata.name,
 target: dep,
 type: 'dependsOn',
 strength: 1
 });
 });
 }

 // Add API relationships
 if ('providesApis' in entity.spec && entity.spec.providesApis) {
 (entity.spec.providesApis as string[]).forEach(api => {
 edges.push({
 source: entity.metadata.name,
 target: api,
 type: 'providesApi',
 strength: 0.8
 });
 });
 }

 if ('consumesApis' in entity.spec && entity.spec.consumesApis) {
 (entity.spec.consumesApis as string[]).forEach(api => {
 edges.push({
 source: api,
 target: entity.metadata.name,
 type: 'consumesApi',
 strength: 0.8
 });
 });
 }
 });

 return { nodes, edges };
 };

 const getEntityStatus = (entity: Entity): DependencyNode['status'] => {
 const healthStatus = entity.status?.items?.find(item => item.type === 'health');
 switch (healthStatus?.level) {
 case 'info': return 'healthy';
 case 'warning': return 'degraded';
 case 'error': return 'unhealthy';
 default: return 'unknown';
 }
 };

 const getDemoDependencyNodes = (): DependencyNode[] => [
 { id: 'user-service', label: 'User Service', type: 'component', status: 'healthy' },
 { id: 'auth-service', label: 'Auth Service', type: 'component', status: 'healthy' },
 { id: 'order-service', label: 'Order Service', type: 'component', status: 'degraded' },
 { id: 'payment-service', label: 'Payment Service', type: 'component', status: 'healthy' },
 { id: 'notification-service', label: 'Notification Service', type: 'component', status: 'unhealthy' },
 { id: 'user-api', label: 'User API', type: 'api', status: 'healthy' },
 { id: 'payment-api', label: 'Payment API', type: 'api', status: 'healthy' },
 { id: 'user-db', label: 'User Database', type: 'resource', status: 'healthy' },
 { id: 'order-db', label: 'Order Database', type: 'resource', status: 'healthy' },
 { id: 'redis-cache', label: 'Redis Cache', type: 'resource', status: 'degraded' },
 { id: 'api-gateway', label: 'API Gateway', type: 'system', status: 'healthy' },
 { id: 'message-queue', label: 'Message Queue', type: 'resource', status: 'healthy' }
 ];

 const getDemoDependencyEdges = (): DependencyEdge[] => [
 { source: 'user-service', target: 'auth-service', type: 'dependsOn', strength: 1 },
 { source: 'user-service', target: 'user-db', type: 'dependsOn', strength: 1 },
 { source: 'user-service', target: 'redis-cache', type: 'dependsOn', strength: 0.8 },
 { source: 'order-service', target: 'user-service', type: 'dependsOn', strength: 1 },
 { source: 'order-service', target: 'payment-service', type: 'dependsOn', strength: 1 },
 { source: 'order-service', target: 'order-db', type: 'dependsOn', strength: 1 },
 { source: 'payment-service', target: 'payment-api', type: 'providesApi', strength: 0.8 },
 { source: 'notification-service', target: 'message-queue', type: 'dependsOn', strength: 1 },
 { source: 'user-service', target: 'user-api', type: 'providesApi', strength: 0.8 },
 { source: 'api-gateway', target: 'user-service', type: 'dependsOn', strength: 0.8 },
 { source: 'api-gateway', target: 'order-service', type: 'dependsOn', strength: 0.8 },
 { source: 'api-gateway', target: 'payment-service', type: 'dependsOn', strength: 0.8 }
 ];

 const renderGraph = () => {
 const canvas = canvasRef.current;
 if (!canvas || nodes.length === 0) return;

 const ctx = canvas.getContext('2d');
 if (!ctx) return;

 // Set canvas size
 const container = containerRef.current;
 if (container) {
 canvas.width = container.clientWidth;
 canvas.height = height;
 }

 // Clear canvas
 ctx.clearRect(0, 0, canvas.width, canvas.height);

 // Apply transformations
 ctx.save();
 ctx.translate(canvas.width / 2 + panOffset.x, canvas.height / 2 + panOffset.y);
 ctx.scale(zoomLevel, zoomLevel);

 // Calculate layout
 const layoutNodes = calculateLayout(nodes, edges, layoutMode);

 // Filter nodes and edges
 const filteredNodes = layoutNodes.filter(node => 
 filter === 'all' || node.type === filter || node.status === filter
 );
 const filteredEdges = edges.filter(edge =>
 filteredNodes.some(n => n.id === edge.source) && 
 filteredNodes.some(n => n.id === edge.target)
 );

 // Draw edges
 filteredEdges.forEach(edge => {
 const sourceNode = filteredNodes.find(n => n.id === edge.source);
 const targetNode = filteredNodes.find(n => n.id === edge.target);
 
 if (sourceNode && targetNode && sourceNode.x !== undefined && sourceNode.y !== undefined && 
 targetNode.x !== undefined && targetNode.y !== undefined) {
 drawEdge(ctx, sourceNode, targetNode, edge);
 }
 });

 // Draw nodes
 filteredNodes.forEach(node => {
 if (node.x !== undefined && node.y !== undefined) {
 drawNode(ctx, node, node === selectedNode);
 }
 });

 // Draw labels
 if (showLabels) {
 filteredNodes.forEach(node => {
 if (node.x !== undefined && node.y !== undefined) {
 drawLabel(ctx, node);
 }
 });
 }

 ctx.restore();
 };

 const calculateLayout = (nodes: DependencyNode[], edges: DependencyEdge[], mode: string): DependencyNode[] => {
 const layoutNodes = [...nodes];
 
 switch (mode) {
 case 'circular':
 return calculateCircularLayout(layoutNodes);
 case 'hierarchical':
 return calculateHierarchicalLayout(layoutNodes, edges);
 default:
 return calculateForceLayout(layoutNodes, edges);
 }
 };

 const calculateCircularLayout = (nodes: DependencyNode[]): DependencyNode[] => {
 const radius = Math.min(300, nodes.length * 20);
 return nodes.map((node, index) => {
 const angle = (index / nodes.length) * 2 * Math.PI;
 return {
 ...node,
 x: Math.cos(angle) * radius,
 y: Math.sin(angle) * radius
 };
 });
 };

 const calculateHierarchicalLayout = (nodes: DependencyNode[], edges: DependencyEdge[]): DependencyNode[] => {
 // Simple hierarchical layout - group by type
 const typeGroups = nodes.reduce((groups, node) => {
 if (!groups[node.type]) groups[node.type] = [];
 groups[node.type].push(node);
 return groups;
 }, {} as Record<string, DependencyNode[]>);

 const typeOrder = ['system', 'component', 'api', 'resource', 'domain'];
 const layoutNodes: DependencyNode[] = [];
 
 typeOrder.forEach((type, typeIndex) => {
 const typeNodes = typeGroups[type] || [];
 typeNodes.forEach((node, nodeIndex) => {
 layoutNodes.push({
 ...node,
 x: (nodeIndex - typeNodes.length / 2) * 150,
 y: (typeIndex - typeOrder.length / 2) * 120
 });
 });
 });

 return layoutNodes;
 };

 const calculateForceLayout = (nodes: DependencyNode[], edges: DependencyEdge[]): DependencyNode[] => {
 // Simple force-directed layout simulation
 const layoutNodes = nodes.map((node, index) => ({
 ...node,
 x: node.x ?? (Math.random() - 0.5) * 400,
 y: node.y ?? (Math.random() - 0.5) * 400
 }));

 // Simulate force-directed layout (simplified)
 for (let iteration = 0; iteration < 50; iteration++) {
 // Repulsive forces between nodes
 for (let i = 0; i < layoutNodes.length; i++) {
 for (let j = i + 1; j < layoutNodes.length; j++) {
 const node1 = layoutNodes[i];
 const node2 = layoutNodes[j];
 const dx = node2.x - node1.x;
 const dy = node2.y - node1.y;
 const distance = Math.sqrt(dx * dx + dy * dy) || 1;
 const force = 5000 / (distance * distance);
 
 node1.x -= (dx / distance) * force;
 node1.y -= (dy / distance) * force;
 node2.x += (dx / distance) * force;
 node2.y += (dy / distance) * force;
 }
 }

 // Attractive forces for connected nodes
 edges.forEach(edge => {
 const sourceNode = layoutNodes.find(n => n.id === edge.source);
 const targetNode = layoutNodes.find(n => n.id === edge.target);
 
 if (sourceNode && targetNode) {
 const dx = targetNode.x - sourceNode.x;
 const dy = targetNode.y - sourceNode.y;
 const distance = Math.sqrt(dx * dx + dy * dy) || 1;
 const force = distance * 0.01 * edge.strength;
 
 sourceNode.x += (dx / distance) * force;
 sourceNode.y += (dy / distance) * force;
 targetNode.x -= (dx / distance) * force;
 targetNode.y -= (dy / distance) * force;
 }
 });
 }

 return layoutNodes;
 };

 const drawNode = (ctx: CanvasRenderingContext2D, node: DependencyNode, isSelected: boolean) => {
 const radius = 25;
 const x = node.x!;
 const y = node.y!;

 // Node shadow
 if (isSelected) {
 ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
 ctx.shadowBlur = 10;
 ctx.shadowOffsetX = 2;
 ctx.shadowOffsetY = 2;
 }

 // Node background
 ctx.beginPath();
 ctx.arc(x, y, radius, 0, 2 * Math.PI);
 ctx.fillStyle = getNodeColor(node);
 ctx.fill();

 // Node border
 ctx.strokeStyle = isSelected ? '#3B82F6' : '#E5E7EB';
 ctx.lineWidth = isSelected ? 3 : 2;
 ctx.stroke();

 // Reset shadow
 ctx.shadowColor = 'transparent';
 ctx.shadowBlur = 0;
 ctx.shadowOffsetX = 0;
 ctx.shadowOffsetY = 0;

 // Node icon
 ctx.fillStyle = getNodeIconColor(node);
 ctx.font = '16px Arial';
 ctx.textAlign = 'center';
 ctx.textBaseline = 'middle';
 ctx.fillText(getNodeIcon(node), x, y);
 };

 const drawEdge = (ctx: CanvasRenderingContext2D, source: DependencyNode, target: DependencyNode, edge: DependencyEdge) => {
 const x1 = source.x!;
 const y1 = source.y!;
 const x2 = target.x!;
 const y2 = target.y!;

 ctx.beginPath();
 ctx.moveTo(x1, y1);
 ctx.lineTo(x2, y2);
 
 ctx.strokeStyle = getEdgeColor(edge);
 ctx.lineWidth = Math.max(1, edge.strength * 3);
 ctx.setLineDash(edge.type === 'dependsOn' ? [] : [5, 5]);
 ctx.stroke();
 ctx.setLineDash([]);

 // Draw arrow
 const angle = Math.atan2(y2 - y1, x2 - x1);
 const arrowLength = 10;
 
 ctx.beginPath();
 ctx.moveTo(x2, y2);
 ctx.lineTo(
 x2 - arrowLength * Math.cos(angle - Math.PI / 6),
 y2 - arrowLength * Math.sin(angle - Math.PI / 6)
 );
 ctx.moveTo(x2, y2);
 ctx.lineTo(
 x2 - arrowLength * Math.cos(angle + Math.PI / 6),
 y2 - arrowLength * Math.sin(angle + Math.PI / 6)
 );
 ctx.stroke();
 };

 const drawLabel = (ctx: CanvasRenderingContext2D, node: DependencyNode) => {
 const x = node.x!;
 const y = node.y! + 35;

 ctx.fillStyle = '#374151';
 ctx.font = '12px Arial';
 ctx.textAlign = 'center';
 ctx.textBaseline = 'middle';
 
 // Draw background for label
 const metrics = ctx.measureText(node.label);
 const padding = 4;
 ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
 ctx.fillRect(
 x - metrics.width / 2 - padding,
 y - 8,
 metrics.width + padding * 2,
 16
 );
 
 ctx.fillStyle = '#374151';
 ctx.fillText(node.label, x, y);
 };

 const getNodeColor = (node: DependencyNode): string => {
 const statusColors = {
 healthy: '#10B981',
 degraded: '#F59E0B',
 unhealthy: '#EF4444',
 unknown: '#6B7280'
 };

 const typeColors = {
 component: '#3B82F6',
 api: '#8B5CF6',
 resource: '#F97316',
 system: '#06B6D4',
 domain: '#84CC16'
 };

 // Primary color based on type, modified by status
 const baseColor = typeColors[node.type] || '#6B7280';
 const statusAlpha = node.status === 'healthy' ? '1' : '0.7';
 
 return baseColor + (statusAlpha === '1' ? '' : 'B3'); // Add transparency for non-healthy
 };

 const getNodeIconColor = (node: DependencyNode): string => {
 return '#FFFFFF';
 };

 const getNodeIcon = (node: DependencyNode): string => {
 switch (node.type) {
 case 'component': return 'CMP';
 case 'api': return 'API';
 case 'resource': return 'RES';
 case 'system': return 'SYS';
 case 'domain': return 'DOM';
 default: return 'UNK';
 }
 };

 const getEdgeColor = (edge: DependencyEdge): string => {
 switch (edge.type) {
 case 'dependsOn': return '#6B7280';
 case 'providesApi': return '#10B981';
 case 'consumesApi': return '#3B82F6';
 case 'partOf': return '#8B5CF6';
 default: return '#9CA3AF';
 }
 };

 // Event handlers
 const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
 const canvas = canvasRef.current;
 if (!canvas) return;

 const rect = canvas.getBoundingClientRect();
 const x = event.clientX - rect.left;
 const y = event.clientY - rect.top;

 // Transform coordinates
 const transformedX = (x - canvas.width / 2 - panOffset.x) / zoomLevel;
 const transformedY = (y - canvas.height / 2 - panOffset.y) / zoomLevel;

 // Find clicked node
 const clickedNode = nodes.find(node => {
 if (node.x === undefined || node.y === undefined) return false;
 const distance = Math.sqrt((transformedX - node.x) ** 2 + (transformedY - node.y) ** 2);
 return distance <= 25;
 });

 setSelectedNode(clickedNode || null);
 
 if (clickedNode && clickedNode.entity) {
 // Show node details or navigate to entity
 console.log('Selected node:', clickedNode);
 }
 };

 const handleZoomIn = () => {
 setZoomLevel(prev => Math.min(prev * 1.2, 3));
 };

 const handleZoomOut = () => {
 setZoomLevel(prev => Math.max(prev / 1.2, 0.3));
 };

 const handleReset = () => {
 setZoomLevel(1);
 setPanOffset({ x: 0, y: 0 });
 setSelectedNode(null);
 };

 const handleExport = () => {
 const canvas = canvasRef.current;
 if (!canvas) return;

 const link = document.createElement('a');
 link.download = `dependency-graph-${new Date().toISOString().split('T')[0]}.png`;
 link.href = canvas.toDataURL();
 link.click();
 
 toast.success('Graph exported successfully');
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 return (
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
 {/* Controls */}
 <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
 <div className="flex items-center gap-4">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Dependency Graph
 </h3>
 
 <div className="flex items-center gap-2">
 <select
 value={filter}
 onChange={(e) => setFilter(e.target.value)}
 className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="all">All Types</option>
 <option value="component">Components</option>
 <option value="api">APIs</option>
 <option value="resource">Resources</option>
 <option value="system">Systems</option>
 <option value="healthy">Healthy</option>
 <option value="degraded">Degraded</option>
 <option value="unhealthy">Unhealthy</option>
 </select>
 
 <select
 value={layoutMode}
 onChange={(e) => setLayoutMode(e.target.value as any)}
 className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="force">Force Directed</option>
 <option value="hierarchical">Hierarchical</option>
 <option value="circular">Circular</option>
 </select>
 </div>
 </div>
 
 <div className="flex items-center gap-2">
 <button
 onClick={handleZoomIn}
 className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 title="Zoom In"
 >
 <ZoomIn className="w-4 h-4" />
 </button>
 
 <button
 onClick={handleZoomOut}
 className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 title="Zoom Out"
 >
 <ZoomOut className="w-4 h-4" />
 </button>
 
 <button
 onClick={handleReset}
 className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 title="Reset View"
 >
 <RotateCcw className="w-4 h-4" />
 </button>
 
 <button
 onClick={handleExport}
 className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 title="Export PNG"
 >
 <Download className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Graph Canvas */}
 <div ref={containerRef} className="relative">
 <canvas
 ref={canvasRef}
 onClick={handleCanvasClick}
 className="w-full cursor-pointer"
 style={{ height }}
 />
 
 {/* Legend */}
 <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
 <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Legend</h4>
 <div className="space-y-1 text-xs">
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-blue-500"></div>
 <span className="text-gray-600 dark:text-gray-400">Component</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-purple-500"></div>
 <span className="text-gray-600 dark:text-gray-400">API</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-orange-500"></div>
 <span className="text-gray-600 dark:text-gray-400">Resource</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
 <span className="text-gray-600 dark:text-gray-400">System</span>
 </div>
 </div>
 </div>

 {/* Selected Node Info */}
 {selectedNode && (
 <motion.div
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-lg max-w-sm"
 >
 <div className="flex items-start justify-between mb-2">
 <h4 className="font-medium text-gray-900 dark:text-gray-100">
 {selectedNode.label}
 </h4>
 <button
 onClick={() => setSelectedNode(null)}
 className="text-gray-400 hover:text-gray-600"
 >
 ×
 </button>
 </div>
 
 <div className="space-y-1 text-sm">
 <div className="flex justify-between">
 <span className="text-gray-500 dark:text-gray-400">Type:</span>
 <span className="text-gray-900 dark:text-gray-100">{selectedNode.type}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-gray-500 dark:text-gray-400">Status:</span>
 <span className={`${
 selectedNode.status === 'healthy' ? 'text-green-600' :
 selectedNode.status === 'degraded' ? 'text-yellow-600' :
 selectedNode.status === 'unhealthy' ? 'text-red-600' :
 'text-gray-600'
 }`}>
 {selectedNode.status}
 </span>
 </div>
 </div>

 {selectedNode.entity && (
 <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
 <button className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
 <ExternalLink className="w-3 h-3" />
 View Details
 </button>
 </div>
 )}
 </motion.div>
 )}
 </div>

 {/* Stats */}
 <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
 <div>
 {nodes.length} nodes, {edges.length} edges
 </div>
 <div>
 Zoom: {Math.round(zoomLevel * 100)}%
 </div>
 </div>
 </div>
 );
}