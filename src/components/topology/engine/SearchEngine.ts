/**
 * Advanced Search Engine for Service Topology
 * 
 * Provides fuzzy search, semantic search, path finding, and advanced filtering
 * capabilities for the service topology visualization.
 */

import Fuse from 'fuse.js';
import {
  ServiceTopologyNode,
  ServiceTopologyEdge,
  SearchQuery,
  SearchResult,
  SearchOptions,
  PathFindingQuery,
  PathResult,
  PathStep,
  PathConstraints,
  RelationType
} from '../types';

// =============================================
// SEARCH ENGINE CONFIGURATION
// =============================================

interface SearchEngineConfig {
  indexFields: string[];
  fuzzyThreshold: number;
  maxResults: number;
  enableHistory: boolean;
  cacheSize?: number;
}

interface IndexedNode extends ServiceTopologyNode {
  _searchableText: string;
  _tags: string;
  _metadata: string;
}

interface IndexedEdge extends ServiceTopologyEdge {
  _searchableText: string;
  _relationInfo: string;
}

// =============================================
// GRAPH ALGORITHMS FOR PATH FINDING
// =============================================

class Graph {
  private adjacencyList: Map<string, Array<{ nodeId: string; edge: ServiceTopologyEdge }>>;
  private nodes: Map<string, ServiceTopologyNode>;
  
  constructor(nodes: ServiceTopologyNode[], edges: ServiceTopologyEdge[]) {
    this.adjacencyList = new Map();
    this.nodes = new Map();
    
    // Initialize nodes
    nodes.forEach(node => {
      this.nodes.set(node.id, node);
      this.adjacencyList.set(node.id, []);
    });
    
    // Build adjacency list
    edges.forEach(edge => {
      const sourceConnections = this.adjacencyList.get(edge.source) || [];
      const targetConnections = this.adjacencyList.get(edge.target) || [];
      
      sourceConnections.push({ nodeId: edge.target, edge });
      
      // Add reverse connection for bidirectional edges
      if (edge.data.direction === 'bidirectional') {
        targetConnections.push({ nodeId: edge.source, edge });
      }
    });
  }
  
  getNeighbors(nodeId: string): Array<{ nodeId: string; edge: ServiceTopologyEdge }> {
    return this.adjacencyList.get(nodeId) || [];
  }
  
  getNode(nodeId: string): ServiceTopologyNode | undefined {
    return this.nodes.get(nodeId);
  }
  
  getAllNodes(): ServiceTopologyNode[] {
    return Array.from(this.nodes.values());
  }
}

// =============================================
// SEARCH ENGINE CLASS
// =============================================

export class SearchEngine {
  private config: SearchEngineConfig;
  private nodeIndex: Fuse<IndexedNode>;
  private edgeIndex: Fuse<IndexedEdge>;
  private searchHistory: SearchQuery[];
  private resultCache: Map<string, SearchResult[]>;
  private graph?: Graph;
  
  constructor(config: SearchEngineConfig) {
    this.config = config;
    this.searchHistory = [];
    this.resultCache = new Map();
    
    // Initialize empty indexes
    this.nodeIndex = new Fuse([], this.getFuseOptions());
    this.edgeIndex = new Fuse([], this.getFuseEdgeOptions());
  }
  
  // =============================================
  // INDEX MANAGEMENT
  // =============================================
  
  public indexData(nodes: ServiceTopologyNode[], edges: ServiceTopologyEdge[]): void {
    // Create searchable nodes
    const indexedNodes = nodes.map(node => this.createSearchableNode(node));
    const indexedEdges = edges.map(edge => this.createSearchableEdge(edge));
    
    // Rebuild indexes
    this.nodeIndex = new Fuse(indexedNodes, this.getFuseOptions());
    this.edgeIndex = new Fuse(indexedEdges, this.getFuseEdgeOptions());
    
    // Build graph for path finding
    this.graph = new Graph(nodes, edges);
    
    // Clear cache when data changes
    this.resultCache.clear();
  }
  
  private createSearchableNode(node: ServiceTopologyNode): IndexedNode {
    const searchableText = [
      node.data.label,
      node.data.name,
      node.data.title,
      node.data.description,
      node.data.owner,
      node.data.team,
      node.kind,
      node.type
    ].filter(Boolean).join(' ').toLowerCase();
    
    const tags = node.data.tags.join(' ').toLowerCase();
    
    const metadata = [
      node.data.criticality,
      node.data.lifecycle,
      node.data.layer,
      node.data.status.deployment,
      node.data.status.environment,
      node.data.health.status
    ].filter(Boolean).join(' ').toLowerCase();
    
    return {
      ...node,
      _searchableText: searchableText,
      _tags: tags,
      _metadata: metadata
    };
  }
  
  private createSearchableEdge(edge: ServiceTopologyEdge): IndexedEdge {
    const searchableText = [
      edge.data.label,
      edge.data.relation,
      edge.data.protocol,
      edge.data.description,
      edge.type
    ].filter(Boolean).join(' ').toLowerCase();
    
    const relationInfo = [
      edge.data.direction,
      edge.data.protocol,
      edge.data.authentication,
      edge.data.encrypted ? 'encrypted' : 'unencrypted'
    ].filter(Boolean).join(' ').toLowerCase();
    
    return {
      ...edge,
      _searchableText: searchableText,
      _relationInfo: relationInfo
    };
  }
  
  private getFuseOptions(): Fuse.IFuseOptions<IndexedNode> {
    return {
      keys: [
        { name: '_searchableText', weight: 0.6 },
        { name: '_tags', weight: 0.3 },
        { name: '_metadata', weight: 0.1 }
      ],
      threshold: this.config.fuzzyThreshold,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      findAllMatches: false,
      useExtendedSearch: true
    };
  }
  
  private getFuseEdgeOptions(): Fuse.IFuseOptions<IndexedEdge> {
    return {
      keys: [
        { name: '_searchableText', weight: 0.7 },
        { name: '_relationInfo', weight: 0.3 }
      ],
      threshold: this.config.fuzzyThreshold,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2
    };
  }
  
  // =============================================
  // SEARCH FUNCTIONALITY
  // =============================================
  
  public async search(query: SearchQuery): Promise<SearchResult[]> {
    const cacheKey = this.getCacheKey(query);
    
    // Check cache first
    if (this.resultCache.has(cacheKey)) {
      return this.resultCache.get(cacheKey)!;
    }
    
    let results: SearchResult[] = [];
    
    try {
      if (query.text.trim() === '') {
        return results;
      }
      
      // Perform search based on scope
      if (query.scope === 'nodes' || query.scope === 'both') {
        const nodeResults = this.searchNodes(query);
        results = [...results, ...nodeResults];
      }
      
      if (query.scope === 'edges' || query.scope === 'both') {
        const edgeResults = this.searchEdges(query);
        results = [...results, ...edgeResults];
      }
      
      // Sort by score
      results.sort((a, b) => b.score - a.score);
      
      // Limit results
      results = results.slice(0, query.options.maxResults || this.config.maxResults);
      
      // Cache results
      if (this.resultCache.size >= (this.config.cacheSize || 100)) {
        const oldestKey = this.resultCache.keys().next().value;
        this.resultCache.delete(oldestKey);
      }
      this.resultCache.set(cacheKey, results);
      
      // Add to history
      if (this.config.enableHistory) {
        this.addToHistory(query);
      }
      
      return results;
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }
  
  private searchNodes(query: SearchQuery): SearchResult[] {
    const searchPattern = this.buildSearchPattern(query);
    const fuseResults = this.nodeIndex.search(searchPattern);
    
    return fuseResults.map(result => ({
      item: result.item,
      score: 1 - (result.score || 0),
      matches: this.convertFuseMatches(result.matches || [])
    }));
  }
  
  private searchEdges(query: SearchQuery): SearchResult[] {
    const searchPattern = this.buildSearchPattern(query);
    const fuseResults = this.edgeIndex.search(searchPattern);
    
    return fuseResults.map(result => ({
      item: result.item,
      score: 1 - (result.score || 0),
      matches: this.convertFuseMatches(result.matches || [])
    }));
  }
  
  private buildSearchPattern(query: SearchQuery): string | Fuse.Expression {
    if (!query.options.fuzzy && query.filters.length === 0) {
      return query.text;
    }
    
    // Build extended search pattern
    const patterns: string[] = [];
    
    // Main search term
    if (query.text.trim()) {
      if (query.options.wholeWord) {
        patterns.push(`="${query.text}"`);
      } else if (!query.options.fuzzy) {
        patterns.push(`'${query.text}`);
      } else {
        patterns.push(query.text);
      }
    }
    
    // Add filter patterns
    query.filters.forEach(filter => {
      const pattern = this.buildFilterPattern(filter);
      if (pattern) {
        patterns.push(pattern);
      }
    });
    
    return patterns.join(' ');
  }
  
  private buildFilterPattern(filter: any): string {
    const { field, operator, value } = filter;
    
    switch (operator) {
      case 'equals':
        return `=${value}`;
      case 'contains':
        return `${value}`;
      case 'startsWith':
        return `^${value}`;
      case 'endsWith':
        return `${value}$`;
      case 'regex':
        return value; // Assume regex is properly formatted
      default:
        return `${value}`;
    }
  }
  
  private convertFuseMatches(fuseMatches: readonly Fuse.FuseResultMatch[]): any[] {
    return fuseMatches.map(match => ({
      field: match.key,
      value: match.value,
      highlighted: this.highlightMatches(match.value || '', match.indices || []),
      position: match.indices?.[0] || { start: 0, end: 0 }
    }));
  }
  
  private highlightMatches(text: string, indices: readonly Fuse.RangeTuple[]): string {
    if (indices.length === 0) return text;
    
    let highlighted = '';
    let lastIndex = 0;
    
    indices.forEach(([start, end]) => {
      highlighted += text.slice(lastIndex, start);
      highlighted += `<mark>${text.slice(start, end + 1)}</mark>`;
      lastIndex = end + 1;
    });
    
    highlighted += text.slice(lastIndex);
    return highlighted;
  }
  
  // =============================================
  // PATH FINDING ALGORITHMS
  // =============================================
  
  public async findPath(query: PathFindingQuery): Promise<PathResult> {
    if (!this.graph) {
      throw new Error('Graph not initialized. Call indexData first.');
    }
    
    try {
      let path: PathStep[];
      
      switch (query.algorithm) {
        case 'shortest':
          path = this.dijkstra(query.source, query.target, query.constraints);
          break;
        case 'least-cost':
          path = this.dijkstra(query.source, query.target, query.constraints, this.getCostWeight);
          break;
        case 'most-reliable':
          path = this.dijkstra(query.source, query.target, query.constraints, this.getReliabilityWeight);
          break;
        default:
          path = this.dijkstra(query.source, query.target, query.constraints);
      }
      
      // Calculate path metrics
      const totalCost = path.reduce((sum, step) => sum + step.cost, 0);
      const reliability = this.calculatePathReliability(path);
      const estimatedLatency = this.calculatePathLatency(path);
      
      // Find alternative paths
      const alternativePaths = await this.findAlternativePaths(query, path);
      
      return {
        path,
        totalCost,
        reliability,
        estimatedLatency,
        alternativePaths
      };
    } catch (error) {
      console.error('Path finding failed:', error);
      throw error;
    }
  }
  
  private dijkstra(
    sourceId: string,
    targetId: string,
    constraints: PathConstraints,
    weightFunction?: (edge: ServiceTopologyEdge, sourceNode: ServiceTopologyNode, targetNode: ServiceTopologyNode) => number
  ): PathStep[] {
    const distances = new Map<string, number>();
    const previous = new Map<string, { nodeId: string; edge: ServiceTopologyEdge }>();
    const visited = new Set<string>();
    const unvisited = new Set<string>();
    
    // Initialize
    this.graph!.getAllNodes().forEach(node => {
      distances.set(node.id, node.id === sourceId ? 0 : Infinity);
      unvisited.add(node.id);
    });
    
    while (unvisited.size > 0) {
      // Find unvisited node with minimum distance
      let currentId: string | undefined;
      let minDistance = Infinity;
      
      for (const nodeId of unvisited) {
        const distance = distances.get(nodeId) || Infinity;
        if (distance < minDistance) {
          minDistance = distance;
          currentId = nodeId;
        }
      }
      
      if (!currentId || minDistance === Infinity) break;
      
      unvisited.delete(currentId);
      visited.add(currentId);
      
      if (currentId === targetId) break;
      
      // Check constraints
      if (constraints.maxHops && minDistance >= constraints.maxHops) continue;
      if (constraints.excludeNodes?.includes(currentId)) continue;
      
      const currentNode = this.graph!.getNode(currentId);
      if (!currentNode) continue;
      
      // Health constraint
      if (constraints.minHealthScore && currentNode.data.health.score < constraints.minHealthScore) {
        continue;
      }
      
      // Examine neighbors
      const neighbors = this.graph!.getNeighbors(currentId);
      
      for (const { nodeId: neighborId, edge } of neighbors) {
        if (visited.has(neighborId)) continue;
        if (constraints.excludeNodes?.includes(neighborId)) continue;
        if (constraints.excludeEdges?.includes(edge.id)) continue;
        if (constraints.allowedRelationTypes && 
            !constraints.allowedRelationTypes.includes(edge.data.relation as RelationType)) continue;
        
        const neighborNode = this.graph!.getNode(neighborId);
        if (!neighborNode) continue;
        
        // Calculate weight
        const weight = weightFunction ? 
          weightFunction(edge, currentNode, neighborNode) : 
          this.getDefaultWeight(edge, currentNode, neighborNode);
        
        const altDistance = (distances.get(currentId) || 0) + weight;
        const currentDistance = distances.get(neighborId) || Infinity;
        
        if (altDistance < currentDistance) {
          distances.set(neighborId, altDistance);
          previous.set(neighborId, { nodeId: currentId, edge });
        }
      }
    }
    
    // Reconstruct path
    return this.reconstructPath(previous, targetId);
  }
  
  private reconstructPath(
    previous: Map<string, { nodeId: string; edge: ServiceTopologyEdge }>,
    targetId: string
  ): PathStep[] {
    const path: PathStep[] = [];
    let currentId = targetId;
    let distance = 0;
    
    while (previous.has(currentId)) {
      const prev = previous.get(currentId)!;
      
      path.unshift({
        nodeId: currentId,
        edgeId: prev.edge.id,
        cost: this.getDefaultWeight(prev.edge, 
          this.graph!.getNode(prev.nodeId)!, 
          this.graph!.getNode(currentId)!),
        distance
      });
      
      currentId = prev.nodeId;
      distance++;
    }
    
    // Add source node
    if (path.length > 0) {
      path.unshift({
        nodeId: currentId,
        cost: 0,
        distance
      });
    }
    
    return path;
  }
  
  private getDefaultWeight(
    edge: ServiceTopologyEdge,
    sourceNode: ServiceTopologyNode,
    targetNode: ServiceTopologyNode
  ): number {
    // Base weight
    let weight = 1;
    
    // Adjust for edge type
    const edgeTypeWeights = {
      'dependency': 1.0,
      'api-call': 0.8,
      'data-flow': 1.2,
      'ownership': 0.5,
      'group': 0.3
    };
    weight *= edgeTypeWeights[edge.type] || 1.0;
    
    // Adjust for health
    if (edge.data.healthy) {
      weight *= 0.9;
    } else {
      weight *= 1.5;
    }
    
    // Adjust for latency
    if (edge.data.latency) {
      weight *= (1 + edge.data.latency / 1000); // Convert ms to weight factor
    }
    
    return weight;
  }
  
  private getCostWeight = (
    edge: ServiceTopologyEdge,
    sourceNode: ServiceTopologyNode,
    targetNode: ServiceTopologyNode
  ): number => {
    let weight = this.getDefaultWeight(edge, sourceNode, targetNode);
    
    // Add cost considerations (example: CPU usage)
    weight *= (1 + targetNode.data.metrics.cpu.current / 100);
    
    return weight;
  };
  
  private getReliabilityWeight = (
    edge: ServiceTopologyEdge,
    sourceNode: ServiceTopologyNode,
    targetNode: ServiceTopologyNode
  ): number => {
    let weight = 1;
    
    // Favor healthy connections
    if (edge.data.healthy) {
      weight *= 0.5;
    } else {
      weight *= 2.0;
    }
    
    // Favor healthy nodes
    const healthMultiplier = (100 - targetNode.data.health.score) / 100;
    weight *= (1 + healthMultiplier);
    
    return weight;
  };
  
  private calculatePathReliability(path: PathStep[]): number {
    if (path.length <= 1) return 1.0;
    
    let reliability = 1.0;
    
    for (let i = 1; i < path.length; i++) {
      const step = path[i];
      if (step.edgeId) {
        const edge = this.findEdgeById(step.edgeId);
        if (edge) {
          const edgeReliability = edge.data.healthy ? 0.99 : 0.95;
          reliability *= edgeReliability;
        }
      }
    }
    
    return reliability;
  }
  
  private calculatePathLatency(path: PathStep[]): number {
    let totalLatency = 0;
    
    for (let i = 1; i < path.length; i++) {
      const step = path[i];
      if (step.edgeId) {
        const edge = this.findEdgeById(step.edgeId);
        if (edge && edge.data.latency) {
          totalLatency += edge.data.latency;
        }
      }
    }
    
    return totalLatency;
  }
  
  private async findAlternativePaths(
    query: PathFindingQuery,
    primaryPath: PathStep[]
  ): Promise<PathStep[][]> {
    const alternatives: PathStep[][] = [];
    
    if (primaryPath.length <= 2) return alternatives;
    
    // Try excluding each edge in the primary path to find alternatives
    for (let i = 1; i < primaryPath.length; i++) {
      const step = primaryPath[i];
      if (step.edgeId) {
        try {
          const modifiedConstraints = {
            ...query.constraints,
            excludeEdges: [...(query.constraints.excludeEdges || []), step.edgeId]
          };
          
          const altPath = this.dijkstra(query.source, query.target, modifiedConstraints);
          
          if (altPath.length > 0 && !this.pathsEqual(altPath, primaryPath)) {
            alternatives.push(altPath);
          }
        } catch {
          // Ignore failed alternative path attempts
        }
      }
    }
    
    // Limit to top 3 alternatives
    return alternatives.slice(0, 3);
  }
  
  private pathsEqual(path1: PathStep[], path2: PathStep[]): boolean {
    if (path1.length !== path2.length) return false;
    
    for (let i = 0; i < path1.length; i++) {
      if (path1[i].nodeId !== path2[i].nodeId) return false;
    }
    
    return true;
  }
  
  private findEdgeById(edgeId: string): ServiceTopologyEdge | undefined {
    // This would need access to the current edges array
    // For now, return undefined - in real implementation, 
    // you'd maintain an edge index by ID
    return undefined;
  }
  
  // =============================================
  // UTILITY METHODS
  // =============================================
  
  private getCacheKey(query: SearchQuery): string {
    return JSON.stringify({
      text: query.text,
      filters: query.filters,
      scope: query.scope,
      options: query.options
    });
  }
  
  private addToHistory(query: SearchQuery): void {
    this.searchHistory.unshift(query);
    
    // Limit history size
    if (this.searchHistory.length > 100) {
      this.searchHistory = this.searchHistory.slice(0, 100);
    }
  }
  
  public getSearchHistory(): SearchQuery[] {
    return [...this.searchHistory];
  }
  
  public clearHistory(): void {
    this.searchHistory = [];
  }
  
  public clearCache(): void {
    this.resultCache.clear();
  }
  
  // =============================================
  // ADVANCED SEARCH FEATURES
  // =============================================
  
  public async findRelatedNodes(nodeId: string, maxDepth = 2): Promise<ServiceTopologyNode[]> {
    if (!this.graph) return [];
    
    const visited = new Set<string>();
    const result: ServiceTopologyNode[] = [];
    const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId, depth: 0 }];
    
    while (queue.length > 0) {
      const { nodeId: currentId, depth } = queue.shift()!;
      
      if (visited.has(currentId) || depth > maxDepth) continue;
      visited.add(currentId);
      
      const node = this.graph.getNode(currentId);
      if (node && depth > 0) { // Don't include the source node
        result.push(node);
      }
      
      if (depth < maxDepth) {
        const neighbors = this.graph.getNeighbors(currentId);
        neighbors.forEach(({ nodeId: neighborId }) => {
          if (!visited.has(neighborId)) {
            queue.push({ nodeId: neighborId, depth: depth + 1 });
          }
        });
      }
    }
    
    return result;
  }
  
  public async findCriticalPaths(): Promise<PathStep[][]> {
    if (!this.graph) return [];
    
    const criticalPaths: PathStep[][] = [];
    const nodes = this.graph.getAllNodes();
    const criticalNodes = nodes.filter(node => node.data.criticality === 'critical');
    
    // Find paths between all critical nodes
    for (const source of criticalNodes) {
      for (const target of criticalNodes) {
        if (source.id !== target.id) {
          try {
            const path = this.dijkstra(source.id, target.id, {});
            if (path.length > 0) {
              criticalPaths.push(path);
            }
          } catch {
            // Ignore failed paths
          }
        }
      }
    }
    
    return criticalPaths;
  }
  
  public async findBottlenecks(): Promise<ServiceTopologyNode[]> {
    if (!this.graph) return [];
    
    const nodes = this.graph.getAllNodes();
    const bottlenecks: Array<{ node: ServiceTopologyNode; score: number }> = [];
    
    for (const node of nodes) {
      const incomingEdges = this.countIncomingEdges(node.id);
      const outgoingEdges = this.countOutgoingEdges(node.id);
      const totalConnections = incomingEdges + outgoingEdges;
      
      // Consider CPU usage, connection count, and criticality
      let bottleneckScore = node.data.metrics.cpu.current * 0.4;
      bottleneckScore += totalConnections * 0.3;
      bottleneckScore += (node.data.criticality === 'critical' ? 30 : 0) * 0.3;
      
      if (bottleneckScore > 50) { // Threshold for bottleneck
        bottlenecks.push({ node, score: bottleneckScore });
      }
    }
    
    // Sort by score and return top bottlenecks
    return bottlenecks
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(item => item.node);
  }
  
  private countIncomingEdges(nodeId: string): number {
    // In a real implementation, you'd maintain this information
    return 0;
  }
  
  private countOutgoingEdges(nodeId: string): number {
    return this.graph?.getNeighbors(nodeId).length || 0;
  }
}