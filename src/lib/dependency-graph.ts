/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import type { Entity } from './backstage/types';

export interface GraphNode {
 id: string;
 label: string;
 type: 'service' | 'api' | 'system' | 'resource';
 lifecycle: 'experimental' | 'production' | 'deprecated';
 owner: string;
 x?: number;
 y?: number;
 group?: string;
}

export interface GraphEdge {
 source: string;
 target: string;
 type: 'depends_on' | 'provides' | 'consumes' | 'part_of';
 label?: string;
}

export interface DependencyGraph {
 nodes: GraphNode[];
 edges: GraphEdge[];
}

export interface GraphAnalytics {
 totalNodes: number;
 totalEdges: number;
 orphanNodes: string[];
 circularDependencies: string[][];
 criticalNodes: string[];
 clusters: GraphCluster[];
}

export interface GraphCluster {
 id: string;
 name: string;
 nodes: string[];
 type: 'system' | 'team' | 'technology';
}

export class DependencyGraphBuilder {
 /**
 * Build dependency graph from Backstage entities
 */
 static buildGraph(entities: Entity[]): DependencyGraph {
 const nodes: GraphNode[] = [];
 const edges: GraphEdge[] = [];

 // Create nodes for all components
 entities.forEach(entity => {
 if (entity.kind === 'Component') {
 const spec = entity.spec as any;
 nodes.push({
 id: entity.metadata.name,
 label: entity.metadata.title || entity.metadata.name,
 type: 'service',
 lifecycle: spec.lifecycle || 'experimental',
 owner: spec.owner || 'unknown',
 group: spec.system || 'default',
 });
 } else if (entity.kind === 'API') {
 nodes.push({
 id: entity.metadata.name,
 label: entity.metadata.title || entity.metadata.name,
 type: 'api',
 lifecycle: (entity.spec as any)?.lifecycle || 'experimental',
 owner: (entity.spec as any)?.owner || 'unknown',
 group: (entity.spec as any)?.system || 'default',
 });
 } else if (entity.kind === 'System') {
 nodes.push({
 id: entity.metadata.name,
 label: entity.metadata.title || entity.metadata.name,
 type: 'system',
 lifecycle: 'production',
 owner: (entity.spec as any)?.owner || 'unknown',
 group: entity.metadata.name,
 });
 } else if (entity.kind === 'Resource') {
 nodes.push({
 id: entity.metadata.name,
 label: entity.metadata.title || entity.metadata.name,
 type: 'resource',
 lifecycle: 'production',
 owner: (entity.spec as any)?.owner || 'unknown',
 group: (entity.spec as any)?.system || 'default',
 });
 }
 });

 // Create edges for dependencies and relationships
 entities.forEach(entity => {
 if (entity.kind === 'Component') {
 const spec = entity.spec as any;
 const sourceId = entity.metadata.name;

 // Dependencies
 if (spec.dependsOn) {
 spec.dependsOn.forEach((dep: string) => {
 const targetId = this.parseEntityName(dep);
 if (nodes.find(n => n.id === targetId)) {
 edges.push({
 source: sourceId,
 target: targetId,
 type: 'depends_on',
 label: 'depends on',
 });
 }
 });
 }

 // Provided APIs
 if (spec.providesApis) {
 spec.providesApis.forEach((api: string) => {
 const targetId = this.parseEntityName(api);
 if (nodes.find(n => n.id === targetId)) {
 edges.push({
 source: sourceId,
 target: targetId,
 type: 'provides',
 label: 'provides',
 });
 }
 });
 }

 // Consumed APIs
 if (spec.consumesApis) {
 spec.consumesApis.forEach((api: string) => {
 const targetId = this.parseEntityName(api);
 if (nodes.find(n => n.id === targetId)) {
 edges.push({
 source: sourceId,
 target: targetId,
 type: 'consumes',
 label: 'consumes',
 });
 }
 });
 }

 // System relationships
 if (spec.system) {
 const systemId = spec.system;
 if (nodes.find(n => n.id === systemId)) {
 edges.push({
 source: sourceId,
 target: systemId,
 type: 'part_of',
 label: 'part of',
 });
 }
 }
 }
 });

 return { nodes, edges };
 }

 /**
 * Parse entity reference to extract name
 */
 private static parseEntityName(entityRef: string): string {
 // Handle format: Kind:namespace/name -> name
 const match = entityRef.match(/([^:]+:)?([^/]+\/)?(.+)$/);
 return match ? match[3] : entityRef;
 }

 /**
 * Apply force-directed layout to position nodes
 */
 static applyForceLayout(graph: DependencyGraph, width: number, height: number): DependencyGraph {
 const nodes = [...graph.nodes];
 const edges = [...graph.edges];

 // Simple force-directed layout simulation
 const iterations = 100;
 const repulsionStrength = 1000;
 const attractionStrength = 0.01;
 const damping = 0.9;

 // Initialize positions randomly
 nodes.forEach(node => {
 node.x = Math.random() * width;
 node.y = Math.random() * height;
 });

 for (let i = 0; i < iterations; i++) {
 // Calculate forces
 const forces: { [id: string]: { x: number; y: number } } = {};
 
 nodes.forEach(node => {
 forces[node.id] = { x: 0, y: 0 };
 });

 // Repulsion forces (nodes push away from each other)
 for (let a = 0; a < nodes.length; a++) {
 for (let b = a + 1; b < nodes.length; b++) {
 const nodeA = nodes[a];
 const nodeB = nodes[b];
 
 const dx = nodeA.x! - nodeB.x!;
 const dy = nodeA.y! - nodeB.y!;
 const distance = Math.sqrt(dx * dx + dy * dy) || 1;
 
 const force = repulsionStrength / (distance * distance);
 const fx = (dx / distance) * force;
 const fy = (dy / distance) * force;
 
 forces[nodeA.id].x += fx;
 forces[nodeA.id].y += fy;
 forces[nodeB.id].x -= fx;
 forces[nodeB.id].y -= fy;
 }
 }

 // Attraction forces (connected nodes pull toward each other)
 edges.forEach(edge => {
 const sourceNode = nodes.find(n => n.id === edge.source);
 const targetNode = nodes.find(n => n.id === edge.target);
 
 if (sourceNode && targetNode) {
 const dx = targetNode.x! - sourceNode.x!;
 const dy = targetNode.y! - sourceNode.y!;
 const distance = Math.sqrt(dx * dx + dy * dy) || 1;
 
 const force = distance * attractionStrength;
 const fx = (dx / distance) * force;
 const fy = (dy / distance) * force;
 
 forces[sourceNode.id].x += fx;
 forces[sourceNode.id].y += fy;
 forces[targetNode.id].x -= fx;
 forces[targetNode.id].y -= fy;
 }
 });

 // Apply forces with damping
 nodes.forEach(node => {
 const force = forces[node.id];
 node.x = node.x! + force.x * damping;
 node.y = node.y! + force.y * damping;
 
 // Keep nodes within bounds
 node.x = Math.max(50, Math.min(width - 50, node.x));
 node.y = Math.max(50, Math.min(height - 50, node.y));
 });
 }

 return { nodes, edges };
 }

 /**
 * Group nodes by system/team for better visualization
 */
 static groupNodes(graph: DependencyGraph): DependencyGraph {
 const nodesByGroup: { [group: string]: GraphNode[] } = {};
 
 graph.nodes.forEach(node => {
 const group = node.group || 'default';
 if (!nodesByGroup[group]) {
 nodesByGroup[group] = [];
 }
 nodesByGroup[group].push(node);
 });

 // Position nodes in groups
 const groupSize = 200;
 const groups = Object.keys(nodesByGroup);
 const groupsPerRow = Math.ceil(Math.sqrt(groups.length));

 groups.forEach((groupName, index) => {
 const groupX = (index % groupsPerRow) * groupSize * 1.5;
 const groupY = Math.floor(index / groupsPerRow) * groupSize * 1.5;
 
 const groupNodes = nodesByGroup[groupName];
 const nodesPerRow = Math.ceil(Math.sqrt(groupNodes.length));
 
 groupNodes.forEach((node, nodeIndex) => {
 const nodeX = groupX + (nodeIndex % nodesPerRow) * 80;
 const nodeY = groupY + Math.floor(nodeIndex / nodesPerRow) * 80;
 node.x = nodeX;
 node.y = nodeY;
 });
 });

 return graph;
 }

 /**
 * Analyze graph for insights
 */
 static analyzeGraph(graph: DependencyGraph): GraphAnalytics {
 const analytics: GraphAnalytics = {
 totalNodes: graph.nodes.length,
 totalEdges: graph.edges.length,
 orphanNodes: [],
 circularDependencies: [],
 criticalNodes: [],
 clusters: [],
 };

 // Find orphan nodes (no connections)
 const connectedNodes = new Set<string>();
 graph.edges.forEach(edge => {
 connectedNodes.add(edge.source);
 connectedNodes.add(edge.target);
 });

 analytics.orphanNodes = graph.nodes
 .filter(node => !connectedNodes.has(node.id))
 .map(node => node.id);

 // Find critical nodes (high connectivity)
 const nodeConnections: { [id: string]: number } = {};
 graph.edges.forEach(edge => {
 nodeConnections[edge.source] = (nodeConnections[edge.source] || 0) + 1;
 nodeConnections[edge.target] = (nodeConnections[edge.target] || 0) + 1;
 });

 const sortedNodes = Object.entries(nodeConnections)
 .sort(([, a], [, b]) => b - a)
 .slice(0, 5);

 analytics.criticalNodes = sortedNodes.map(([id]) => id);

 // Create clusters by system/group
 const clusters: { [group: string]: string[] } = {};
 graph.nodes.forEach(node => {
 const group = node.group || 'default';
 if (!clusters[group]) {
 clusters[group] = [];
 }
 clusters[group].push(node.id);
 });

 analytics.clusters = Object.entries(clusters).map(([name, nodes]) => ({
 id: name,
 name: name.charAt(0).toUpperCase() + name.slice(1),
 nodes,
 type: 'system' as const,
 }));

 // Simple circular dependency detection (basic)
 analytics.circularDependencies = this.findCircularDependencies(graph);

 return analytics;
 }

 /**
 * Find circular dependencies in the graph
 */
 private static findCircularDependencies(graph: DependencyGraph): string[][] {
 const cycles: string[][] = [];
 const visited = new Set<string>();
 const recursionStack = new Set<string>();

 // Build adjacency list for depends_on edges
 const adjacencyList: { [id: string]: string[] } = {};
 graph.edges
 .filter(edge => edge.type === 'depends_on')
 .forEach(edge => {
 if (!adjacencyList[edge.source]) {
 adjacencyList[edge.source] = [];
 }
 adjacencyList[edge.source].push(edge.target);
 });

 const dfs = (node: string, path: string[]): void => {
 visited.add(node);
 recursionStack.add(node);
 path.push(node);

 const neighbors = adjacencyList[node] || [];
 for (const neighbor of neighbors) {
 if (!visited.has(neighbor)) {
 dfs(neighbor, [...path]);
 } else if (recursionStack.has(neighbor)) {
 // Found a cycle
 const cycleStart = path.indexOf(neighbor);
 if (cycleStart !== -1) {
 cycles.push(path.slice(cycleStart));
 }
 }
 }

 recursionStack.delete(node);
 };

 // Check each node
 graph.nodes.forEach(node => {
 if (!visited.has(node.id)) {
 dfs(node.id, []);
 }
 });

 return cycles;
 }

 /**
 * Filter graph to show only services related to a specific service
 */
 static filterByService(graph: DependencyGraph, serviceId: string, depth = 2): DependencyGraph {
 const relevantNodes = new Set<string>();
 const relevantEdges: GraphEdge[] = [];

 // BFS to find related nodes
 const queue: Array<{ id: string; distance: number }> = [{ id: serviceId, distance: 0 }];
 const visited = new Set<string>();

 while (queue.length > 0) {
 const { id, distance } = queue.shift()!;
 
 if (visited.has(id) || distance > depth) continue;
 
 visited.add(id);
 relevantNodes.add(id);

 // Find connected nodes
 graph.edges.forEach(edge => {
 if (edge.source === id && !visited.has(edge.target)) {
 queue.push({ id: edge.target, distance: distance + 1 });
 relevantEdges.push(edge);
 } else if (edge.target === id && !visited.has(edge.source)) {
 queue.push({ id: edge.source, distance: distance + 1 });
 relevantEdges.push(edge);
 }
 });
 }

 const filteredNodes = graph.nodes.filter(node => relevantNodes.has(node.id));
 const filteredEdges = relevantEdges.filter(edge => 
 relevantNodes.has(edge.source) && relevantNodes.has(edge.target)
 );

 return { nodes: filteredNodes, edges: filteredEdges };
 }

 /**
 * Get shortest path between two services
 */
 static findShortestPath(graph: DependencyGraph, sourceId: string, targetId: string): string[] {
 const queue: Array<{ id: string; path: string[] }> = [{ id: sourceId, path: [sourceId] }];
 const visited = new Set<string>();

 while (queue.length > 0) {
 const { id, path } = queue.shift()!;
 
 if (id === targetId) {
 return path;
 }

 if (visited.has(id)) continue;
 visited.add(id);

 // Find connected nodes (both directions)
 graph.edges.forEach(edge => {
 if (edge.source === id && !visited.has(edge.target)) {
 queue.push({ id: edge.target, path: [...path, edge.target] });
 } else if (edge.target === id && !visited.has(edge.source)) {
 queue.push({ id: edge.source, path: [...path, edge.source] });
 }
 });
 }

 return []; // No path found
 }
}