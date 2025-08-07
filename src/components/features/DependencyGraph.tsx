'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 ZoomIn, 
 ZoomOut, 
 Download, 
 Filter, 
 Search, 
 Info,
 RotateCcw,
 GitBranch,
 AlertCircle
} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

import { backstageClient } from '@/lib/backstage/client';
import { 
 DependencyGraphBuilder 
} from '@/lib/dependency-graph';

import type { 
 DependencyGraph as GraphType, 
 GraphNode, 
 GraphEdge, 
 GraphAnalytics 
} from '@/lib/dependency-graph';

interface DependencyGraphProps {
 selectedService?: string;
 onServiceSelect?: (serviceId: string) => void;
 className?: string;
}

export default function DependencyGraph({ selectedService, onServiceSelect, className }: DependencyGraphProps) {
 const svgRef = useRef<SVGSVGElement>(null);
 const [graph, setGraph] = useState<GraphType>({ nodes: [], edges: [] });
 const [originalGraph, setOriginalGraph] = useState<GraphType>({ nodes: [], edges: [] });
 const [analytics, setAnalytics] = useState<GraphAnalytics | null>(null);
 const [isLoading, setIsLoading] = useState(true);
 const [zoom, setZoom] = useState(1);
 const [pan, setPan] = useState({ x: 0, y: 0 });
 const [searchTerm, setSearchTerm] = useState('');
 const [showFilters, setShowFilters] = useState(false);
 const [selectedFilters, setSelectedFilters] = useState({
 type: 'all',
 lifecycle: 'all',
 owner: 'all',
 system: 'all',
 });
 const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
 const [showAnalytics, setShowAnalytics] = useState(false);

 const svgWidth = 800;
 const svgHeight = 600;

 // Load and build graph
 useEffect(() => {
 loadGraph();
 }, []);

 // Apply filters when they change
 useEffect(() => {
 applyFilters();
 }, [selectedFilters, searchTerm, originalGraph]);

 // Highlight selected service
 useEffect(() => {
 if (selectedService) {
 setHighlightedNode(selectedService);
 centerOnNode(selectedService);
 }
 }, [selectedService]);

 const loadGraph = async () => {
 try {
 setIsLoading(true);
 const entities = await backstageClient.getCatalogEntities();
 const builtGraph = DependencyGraphBuilder.buildGraph(entities);
 const layoutGraph = DependencyGraphBuilder.applyForceLayout(builtGraph, svgWidth, svgHeight);
 const groupedGraph = DependencyGraphBuilder.groupNodes(layoutGraph);
 
 setOriginalGraph(groupedGraph);
 setGraph(groupedGraph);
 
 const graphAnalytics = DependencyGraphBuilder.analyzeGraph(groupedGraph);
 setAnalytics(graphAnalytics);
 } catch (error) {
 console.error('Failed to load dependency graph:', error);
 } finally {
 setIsLoading(false);
 }
 };

 const applyFilters = () => {
 if (!originalGraph.nodes.length) return;

 let filteredNodes = originalGraph.nodes;
 let filteredEdges = originalGraph.edges;

 // Apply search filter
 if (searchTerm) {
 const term = searchTerm.toLowerCase();
 filteredNodes = filteredNodes.filter(node =>
 node.label.toLowerCase().includes(term) ||
 node.id.toLowerCase().includes(term) ||
 node.owner.toLowerCase().includes(term)
 );
 }

 // Apply type filter
 if (selectedFilters.type !== 'all') {
 filteredNodes = filteredNodes.filter(node => node.type === selectedFilters.type);
 }

 // Apply lifecycle filter
 if (selectedFilters.lifecycle !== 'all') {
 filteredNodes = filteredNodes.filter(node => node.lifecycle === selectedFilters.lifecycle);
 }

 // Apply owner filter
 if (selectedFilters.owner !== 'all') {
 filteredNodes = filteredNodes.filter(node => node.owner === selectedFilters.owner);
 }

 // Apply system filter
 if (selectedFilters.system !== 'all') {
 filteredNodes = filteredNodes.filter(node => node.group === selectedFilters.system);
 }

 // Filter edges to only include edges between visible nodes
 const visibleNodeIds = new Set(filteredNodes.map(n => n.id));
 filteredEdges = filteredEdges.filter(edge =>
 visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
 );

 setGraph({ nodes: filteredNodes, edges: filteredEdges });
 };

 const centerOnNode = (nodeId: string) => {
 const node = graph.nodes.find(n => n.id === nodeId);
 if (!node || !node.x || !node.y) return;

 const centerX = svgWidth / 2;
 const centerY = svgHeight / 2;
 setPan({
 x: centerX - node.x * zoom,
 y: centerY - node.y * zoom,
 });
 };

 const handleZoom = (delta: number) => {
 const newZoom = Math.max(0.1, Math.min(3, zoom + delta));
 setZoom(newZoom);
 };

 const handleNodeClick = (nodeId: string) => {
 setHighlightedNode(nodeId);
 onServiceSelect?.(nodeId);
 centerOnNode(nodeId);
 };

 const handleNodeHover = (nodeId: string | null) => {
 // Highlight connected nodes
 if (nodeId) {
 const connectedNodes = new Set([nodeId]);
 graph.edges.forEach(edge => {
 if (edge.source === nodeId) connectedNodes.add(edge.target);
 if (edge.target === nodeId) connectedNodes.add(edge.source);
 });
 }
 };

 const resetView = () => {
 setZoom(1);
 setPan({ x: 0, y: 0 });
 setHighlightedNode(null);
 };

 const downloadGraph = () => {
 if (!svgRef.current) return;

 const svgData = new XMLSerializer().serializeToString(svgRef.current);
 const canvas = document.createElement('canvas');
 const ctx = canvas.getContext('2d');
 const img = new Image();

 canvas.width = svgWidth;
 canvas.height = svgHeight;

 img.onload = () => {
 if (ctx) {
 ctx.drawImage(img, 0, 0);
 const pngFile = canvas.toDataURL('image/png');
 const downloadLink = document.createElement('a');
 downloadLink.download = 'dependency-graph.png';
 downloadLink.href = pngFile;
 downloadLink.click();
 }
 };

 const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
 const url = URL.createObjectURL(svgBlob);
 img.src = url;
 };

 const getNodeColor = (node: GraphNode): string => {
 if (node.id === highlightedNode) return '#3b82f6';
 
 switch (node.lifecycle) {
 case 'production': return '#10b981';
 case 'experimental': return '#f59e0b';
 case 'deprecated': return '#ef4444';
 default: return '#6b7280';
 }
 };

 const getNodeIcon = (node: GraphNode): string => {
 switch (node.type) {
 case 'service': return 'SVC';
 case 'api': return 'API';
 case 'system': return 'SYS';
 case 'resource': return 'RES';
 default: return 'UNK';
 }
 };

 const getEdgeColor = (edge: GraphEdge): string => {
 switch (edge.type) {
 case 'depends_on': return '#ef4444';
 case 'provides': return '#10b981';
 case 'consumes': return '#3b82f6';
 case 'part_of': return '#8b5cf6';
 default: return '#6b7280';
 }
 };

 const getUniqueValues = (field: keyof GraphNode): string[] => {
 const values = new Set(graph.nodes.map(node => String(node[field])));
 return Array.from(values).sort();
 };

 if (isLoading) {
 return (
 <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
 <div className="p-8 text-center">
 <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
 <p className="text-gray-600 dark:text-gray-400">Loading dependency graph...</p>
 </div>
 </div>
 );
 }

 return (
 <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
 {/* Header */}
 <div className="p-4 border-b border-gray-200 dark:border-gray-700">
 <div className="flex items-center justify-between">
 <div>
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
 Service Dependency Graph
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400">
 {graph.nodes.length} services, {graph.edges.length} connections
 </p>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setShowAnalytics(!showAnalytics)}
 className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 title="Toggle Analytics"
 >
 <Info className="w-4 h-4" />
 </button>
 <button
 onClick={() => setShowFilters(!showFilters)}
 className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 title="Toggle Filters"
 >
 <Filter className="w-4 h-4" />
 </button>
 <button
 onClick={downloadGraph}
 className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 title="Download Graph"
 >
 <Download className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Search and Filters */}
 {showFilters && (
 <div className="mt-4 space-y-3">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
 <input
 type="text"
 placeholder="Search services..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>

 <div className="grid grid-cols-4 gap-2">
 <select
 value={selectedFilters.type}
 onChange={(e) => setSelectedFilters({ ...selectedFilters, type: e.target.value })}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100 text-sm"
 >
 <option value="all">All Types</option>
 {getUniqueValues('type').map(type => (
 <option key={type} value={type}>{type}</option>
 ))}
 </select>

 <select
 value={selectedFilters.lifecycle}
 onChange={(e) => setSelectedFilters({ ...selectedFilters, lifecycle: e.target.value })}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100 text-sm"
 >
 <option value="all">All Stages</option>
 {getUniqueValues('lifecycle').map(lifecycle => (
 <option key={lifecycle} value={lifecycle}>{lifecycle}</option>
 ))}
 </select>

 <select
 value={selectedFilters.owner}
 onChange={(e) => setSelectedFilters({ ...selectedFilters, owner: e.target.value })}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100 text-sm"
 >
 <option value="all">All Owners</option>
 {getUniqueValues('owner').map(owner => (
 <option key={owner} value={owner}>{owner}</option>
 ))}
 </select>

 <select
 value={selectedFilters.system}
 onChange={(e) => setSelectedFilters({ ...selectedFilters, system: e.target.value })}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100 text-sm"
 >
 <option value="all">All Systems</option>
 {getUniqueValues('group').map(system => (
 <option key={system} value={system}>{system}</option>
 ))}
 </select>
 </div>
 </div>
 )}
 </div>

 <div className="flex">
 {/* Graph Visualization */}
 <div className="flex-1 relative">
 {/* Controls */}
 <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
 <button
 onClick={() => handleZoom(0.1)}
 className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
 title="Zoom In"
 >
 <ZoomIn className="w-4 h-4" />
 </button>
 <button
 onClick={() => handleZoom(-0.1)}
 className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
 title="Zoom Out"
 >
 <ZoomOut className="w-4 h-4" />
 </button>
 <button
 onClick={resetView}
 className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700"
 title="Reset View"
 >
 <RotateCcw className="w-4 h-4" />
 </button>
 </div>

 {/* SVG Graph */}
 <div className="p-4 overflow-hidden">
 <svg
 ref={svgRef}
 width={svgWidth}
 height={svgHeight}
 viewBox={`0 0 ${svgWidth} ${svgHeight}`}
 className="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900"
 >
 <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
 {/* Edges */}
 {graph.edges.map((edge, index) => {
 const sourceNode = graph.nodes.find(n => n.id === edge.source);
 const targetNode = graph.nodes.find(n => n.id === edge.target);
 
 if (!sourceNode || !targetNode || !sourceNode.x || !sourceNode.y || !targetNode.x || !targetNode.y) {
 return null;
 }

 return (
 <g key={index}>
 <line
 x1={sourceNode.x}
 y1={sourceNode.y}
 x2={targetNode.x}
 y2={targetNode.y}
 stroke={getEdgeColor(edge)}
 strokeWidth="2"
 opacity="0.6"
 markerEnd="url(#arrowhead)"
 />
 <text
 x={(sourceNode.x + targetNode.x) / 2}
 y={(sourceNode.y + targetNode.y) / 2}
 fontSize="10"
 fill="#6b7280"
 textAnchor="middle"
 dy="-5"
 >
 {edge.label}
 </text>
 </g>
 );
 })}

 {/* Nodes */}
 {graph.nodes.map(node => (
 <g
 key={node.id}
 transform={`translate(${node.x}, ${node.y})`}
 onClick={() => handleNodeClick(node.id)}
 onMouseEnter={() => handleNodeHover(node.id)}
 onMouseLeave={() => handleNodeHover(null)}
 className="cursor-pointer"
 >
 <circle
 r="20"
 fill={getNodeColor(node)}
 stroke={node.id === highlightedNode ? '#1f2937' : '#ffffff'}
 strokeWidth={node.id === highlightedNode ? '3' : '2'}
 opacity="0.9"
 />
 <text
 fontSize="16"
 textAnchor="middle"
 dy="1"
 fill="white"
 >
 {getNodeIcon(node)}
 </text>
 <text
 fontSize="12"
 textAnchor="middle"
 dy="35"
 fill="#374151"
 className="dark:fill-gray-300"
 >
 {node.label.length > 15 ? `${node.label.slice(0, 12)}...` : node.label}
 </text>
 </g>
 ))}

 {/* Arrow marker */}
 <defs>
 <marker
 id="arrowhead"
 markerWidth="10"
 markerHeight="7"
 refX="9"
 refY="3.5"
 orient="auto"
 >
 <polygon
 points="0 0, 10 3.5, 0 7"
 fill="#6b7280"
 />
 </marker>
 </defs>
 </g>
 </svg>
 </div>

 {/* Legend */}
 <div className="absolute bottom-4 right-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-3 shadow-sm">
 <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Legend</h4>
 <div className="space-y-1 text-xs">
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-green-500"></div>
 <span>Production</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
 <span>Experimental</span>
 </div>
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-red-500"></div>
 <span>Deprecated</span>
 </div>
 </div>
 </div>
 </div>

 {/* Analytics Panel */}
 {showAnalytics && analytics && (
 <div className="w-80 border-l border-gray-200 dark:border-gray-700 p-4">
 <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
 Graph Analytics
 </h4>

 <div className="space-y-4">
 {/* Overview */}
 <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
 <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Overview</h5>
 <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
 <div className="flex justify-between">
 <span>Total Services:</span>
 <span>{analytics.totalNodes}</span>
 </div>
 <div className="flex justify-between">
 <span>Connections:</span>
 <span>{analytics.totalEdges}</span>
 </div>
 <div className="flex justify-between">
 <span>Orphaned:</span>
 <span>{analytics.orphanNodes.length}</span>
 </div>
 </div>
 </div>

 {/* Critical Services */}
 {analytics.criticalNodes.length > 0 && (
 <div>
 <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
 Most Connected Services
 </h5>
 <div className="space-y-1">
 {analytics.criticalNodes.slice(0, 5).map(nodeId => (
 <button
 key={nodeId}
 onClick={() => handleNodeClick(nodeId)}
 className="block w-full text-left px-2 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
 >
 {nodeId}
 </button>
 ))}
 </div>
 </div>
 )}

 {/* Orphaned Services */}
 {analytics.orphanNodes.length > 0 && (
 <div>
 <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1">
 <AlertCircle className="w-4 h-4 text-yellow-500" />
 Orphaned Services
 </h5>
 <div className="space-y-1">
 {analytics.orphanNodes.slice(0, 5).map(nodeId => (
 <button
 key={nodeId}
 onClick={() => handleNodeClick(nodeId)}
 className="block w-full text-left px-2 py-1 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded"
 >
 {nodeId}
 </button>
 ))}
 </div>
 </div>
 )}

 {/* Clusters */}
 {analytics.clusters.length > 0 && (
 <div>
 <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
 Systems
 </h5>
 <div className="space-y-1">
 {analytics.clusters.map(cluster => (
 <div key={cluster.id} className="text-sm">
 <span className="font-medium text-gray-700 dark:text-gray-300">
 {cluster.name}
 </span>
 <span className="text-gray-500 dark:text-gray-400 ml-2">
 ({cluster.nodes.length} services)
 </span>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Circular Dependencies */}
 {analytics.circularDependencies.length > 0 && (
 <div>
 <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-1">
 <AlertCircle className="w-4 h-4 text-red-500" />
 Circular Dependencies
 </h5>
 <div className="space-y-1">
 {analytics.circularDependencies.slice(0, 3).map((cycle, index) => (
 <div key={index} className="text-sm text-red-600 dark:text-red-400">
 {cycle.join(' ')}
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 </div>
 );
}