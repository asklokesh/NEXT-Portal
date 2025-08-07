/**
 * Dependency Analyzer Service
 * Advanced graph algorithms for analyzing service dependencies and relationships
 */

import { 
  ServiceNode, 
  ServiceRelationship,
  PathFindingResult,
  ImpactAnalysisResult,
  DependencyAnalysisResult,
  CriticalityLevel,
  RelationshipType
} from '../types';

interface Graph {
  nodes: Map<string, ServiceNode>;
  adjacencyList: Map<string, Set<string>>;
  reverseAdjacencyList: Map<string, Set<string>>;
  edges: Map<string, ServiceRelationship>;
}

export class DependencyAnalyzer {
  private graph: Graph;
  private memoizedPaths: Map<string, PathFindingResult[]> = new Map();
  private memoizedImpacts: Map<string, ImpactAnalysisResult> = new Map();

  constructor(nodes: ServiceNode[], edges: ServiceRelationship[]) {
    this.graph = this.buildGraph(nodes, edges);
  }

  /**
   * Build graph data structure from nodes and edges
   */
  private buildGraph(nodes: ServiceNode[], edges: ServiceRelationship[]): Graph {
    const graph: Graph = {
      nodes: new Map(),
      adjacencyList: new Map(),
      reverseAdjacencyList: new Map(),
      edges: new Map()
    };

    // Add nodes
    nodes.forEach(node => {
      graph.nodes.set(node.id, node);
      graph.adjacencyList.set(node.id, new Set());
      graph.reverseAdjacencyList.set(node.id, new Set());
    });

    // Add edges
    edges.forEach(edge => {
      graph.edges.set(edge.id, edge);
      
      // Forward adjacency
      const sourceAdj = graph.adjacencyList.get(edge.source);
      if (sourceAdj) {
        sourceAdj.add(edge.target);
      }
      
      // Reverse adjacency (for upstream dependencies)
      const targetAdj = graph.reverseAdjacencyList.get(edge.target);
      if (targetAdj) {
        targetAdj.add(edge.source);
      }
    });

    return graph;
  }

  /**
   * Find shortest path between two services using Dijkstra's algorithm
   */
  public findShortestPath(sourceId: string, targetId: string): PathFindingResult | null {
    const cacheKey = `${sourceId}-${targetId}`;
    const cached = this.memoizedPaths.get(cacheKey);
    if (cached && cached.length > 0) {
      return cached[0];
    }

    if (!this.graph.nodes.has(sourceId) || !this.graph.nodes.has(targetId)) {
      return null;
    }

    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const unvisited = new Set<string>();

    // Initialize
    this.graph.nodes.forEach((_, nodeId) => {
      distances.set(nodeId, Infinity);
      previous.set(nodeId, null);
      unvisited.add(nodeId);
    });
    distances.set(sourceId, 0);

    while (unvisited.size > 0) {
      // Find node with minimum distance
      let currentNode: string | null = null;
      let minDistance = Infinity;
      
      unvisited.forEach(nodeId => {
        const distance = distances.get(nodeId)!;
        if (distance < minDistance) {
          minDistance = distance;
          currentNode = nodeId;
        }
      });

      if (currentNode === null || minDistance === Infinity) {
        break;
      }

      if (currentNode === targetId) {
        // Build path
        const path: string[] = [];
        let node: string | null = targetId;
        
        while (node !== null) {
          path.unshift(node);
          node = previous.get(node) || null;
        }

        const result: PathFindingResult = {
          path,
          cost: distances.get(targetId)!,
          distance: path.length - 1,
          metadata: {
            algorithm: 'dijkstra',
            timestamp: new Date()
          }
        };

        // Cache result
        const cached = this.memoizedPaths.get(cacheKey) || [];
        cached.push(result);
        this.memoizedPaths.set(cacheKey, cached);

        return result;
      }

      unvisited.delete(currentNode);

      // Update distances to neighbors
      const neighbors = this.graph.adjacencyList.get(currentNode) || new Set();
      neighbors.forEach(neighbor => {
        if (unvisited.has(neighbor)) {
          const edge = this.findEdge(currentNode, neighbor);
          const weight = this.calculateEdgeWeight(edge);
          const altDistance = distances.get(currentNode)! + weight;
          
          if (altDistance < distances.get(neighbor)!) {
            distances.set(neighbor, altDistance);
            previous.set(neighbor, currentNode);
          }
        }
      });
    }

    return null;
  }

  /**
   * Find all paths between two services
   */
  public findAllPaths(
    sourceId: string, 
    targetId: string, 
    maxLength: number = 10
  ): PathFindingResult[] {
    const cacheKey = `all-${sourceId}-${targetId}`;
    const cached = this.memoizedPaths.get(cacheKey);
    if (cached) {
      return cached;
    }

    const paths: PathFindingResult[] = [];
    const visited = new Set<string>();
    const currentPath: string[] = [];

    const dfs = (current: string, depth: number) => {
      if (depth > maxLength) return;
      
      currentPath.push(current);
      visited.add(current);

      if (current === targetId) {
        paths.push({
          path: [...currentPath],
          cost: this.calculatePathCost(currentPath),
          distance: currentPath.length - 1,
          metadata: {
            algorithm: 'dfs',
            timestamp: new Date()
          }
        });
      } else {
        const neighbors = this.graph.adjacencyList.get(current) || new Set();
        neighbors.forEach(neighbor => {
          if (!visited.has(neighbor)) {
            dfs(neighbor, depth + 1);
          }
        });
      }

      currentPath.pop();
      visited.delete(current);
    };

    if (this.graph.nodes.has(sourceId) && this.graph.nodes.has(targetId)) {
      dfs(sourceId, 0);
    }

    // Sort by distance/cost
    paths.sort((a, b) => a.distance - b.distance);

    // Cache results
    this.memoizedPaths.set(cacheKey, paths);

    return paths;
  }

  /**
   * Find critical path in the service topology
   */
  public findCriticalPath(): string[] {
    // Find the longest path in the DAG (if it is a DAG)
    const topologicalOrder = this.topologicalSort();
    
    if (topologicalOrder.length === 0) {
      // Graph has cycles, use different approach
      return this.findCriticalPathWithCycles();
    }

    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();

    // Initialize distances
    this.graph.nodes.forEach((_, nodeId) => {
      distances.set(nodeId, 0);
      previous.set(nodeId, null);
    });

    // Process nodes in topological order
    topologicalOrder.forEach(nodeId => {
      const neighbors = this.graph.adjacencyList.get(nodeId) || new Set();
      neighbors.forEach(neighbor => {
        const edge = this.findEdge(nodeId, neighbor);
        const weight = this.calculateEdgeWeight(edge);
        const newDistance = distances.get(nodeId)! + weight;
        
        if (newDistance > distances.get(neighbor)!) {
          distances.set(neighbor, newDistance);
          previous.set(neighbor, nodeId);
        }
      });
    });

    // Find node with maximum distance
    let maxDistance = 0;
    let endNode: string | null = null;
    
    distances.forEach((distance, nodeId) => {
      if (distance > maxDistance) {
        maxDistance = distance;
        endNode = nodeId;
      }
    });

    // Build critical path
    const path: string[] = [];
    let node = endNode;
    
    while (node !== null) {
      path.unshift(node);
      node = previous.get(node) || null;
    }

    return path;
  }

  /**
   * Find critical path when graph has cycles
   */
  private findCriticalPathWithCycles(): string[] {
    // Use betweenness centrality to find critical nodes
    const centrality = this.calculateBetweennessCentrality();
    
    // Sort nodes by centrality
    const sortedNodes = Array.from(centrality.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([nodeId]) => nodeId);

    // Return top nodes as critical path
    return sortedNodes.slice(0, Math.min(10, sortedNodes.length));
  }

  /**
   * Perform impact analysis for a service
   */
  public analyzeImpact(nodeId: string): ImpactAnalysisResult {
    const cached = this.memoizedImpacts.get(nodeId);
    if (cached) {
      return cached;
    }

    const node = this.graph.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Find all downstream dependencies (services that depend on this one)
    const directImpact = Array.from(this.graph.adjacencyList.get(nodeId) || new Set())
      .map(id => this.graph.nodes.get(id)!)
      .filter(Boolean);

    // Find all indirect downstream dependencies using BFS
    const allAffected = new Set<string>();
    const queue = [nodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      
      visited.add(current);
      allAffected.add(current);

      const neighbors = this.graph.adjacencyList.get(current) || new Set();
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      });
    }

    allAffected.delete(nodeId); // Remove the source node itself
    
    const affected = Array.from(allAffected)
      .map(id => this.graph.nodes.get(id)!)
      .filter(Boolean);

    const indirectImpact = affected.filter(
      n => !directImpact.some(d => d.id === n.id)
    );

    // Calculate risk score based on criticality and number of affected services
    const riskScore = this.calculateRiskScore(node, affected);

    // Find critical path from this node
    const criticalPath = this.findCriticalDownstreamPath(nodeId);

    const result: ImpactAnalysisResult = {
      affected,
      directImpact,
      indirectImpact,
      criticalPath,
      riskScore
    };

    // Cache result
    this.memoizedImpacts.set(nodeId, result);

    return result;
  }

  /**
   * Analyze dependencies in the graph
   */
  public analyzeDependencies(): DependencyAnalysisResult {
    const cycles = this.detectCycles();
    const levels = this.calculateDependencyLevels();
    const criticalDependencies = this.findCriticalDependencies();
    const bottlenecks = this.findBottlenecks();

    return {
      cycles,
      levels,
      criticalDependencies,
      bottlenecks
    };
  }

  /**
   * Detect cycles in the dependency graph using Tarjan's algorithm
   */
  public detectCycles(): string[][] {
    const cycles: string[][] = [];
    const stack: string[] = [];
    const stackSet = new Set<string>();
    const visited = new Set<string>();
    const lowlink = new Map<string, number>();
    const index = new Map<string, number>();
    let currentIndex = 0;

    const strongConnect = (nodeId: string) => {
      index.set(nodeId, currentIndex);
      lowlink.set(nodeId, currentIndex);
      currentIndex++;
      stack.push(nodeId);
      stackSet.add(nodeId);
      visited.add(nodeId);

      const neighbors = this.graph.adjacencyList.get(nodeId) || new Set();
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          strongConnect(neighbor);
          lowlink.set(nodeId, Math.min(
            lowlink.get(nodeId)!,
            lowlink.get(neighbor)!
          ));
        } else if (stackSet.has(neighbor)) {
          lowlink.set(nodeId, Math.min(
            lowlink.get(nodeId)!,
            index.get(neighbor)!
          ));
        }
      });

      if (lowlink.get(nodeId) === index.get(nodeId)) {
        const component: string[] = [];
        let node: string;
        
        do {
          node = stack.pop()!;
          stackSet.delete(node);
          component.push(node);
        } while (node !== nodeId);

        if (component.length > 1) {
          cycles.push(component);
        }
      }
    };

    this.graph.nodes.forEach((_, nodeId) => {
      if (!visited.has(nodeId)) {
        strongConnect(nodeId);
      }
    });

    return cycles;
  }

  /**
   * Calculate dependency levels (distance from root nodes)
   */
  private calculateDependencyLevels(): Map<number, ServiceNode[]> {
    const levels = new Map<number, ServiceNode[]>();
    const nodeLevel = new Map<string, number>();

    // Find root nodes (no incoming edges)
    const roots: string[] = [];
    this.graph.nodes.forEach((_, nodeId) => {
      const incoming = this.graph.reverseAdjacencyList.get(nodeId) || new Set();
      if (incoming.size === 0) {
        roots.push(nodeId);
        nodeLevel.set(nodeId, 0);
      }
    });

    // BFS to assign levels
    const queue = [...roots];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLevel = nodeLevel.get(current)!;
      
      const neighbors = this.graph.adjacencyList.get(current) || new Set();
      neighbors.forEach(neighbor => {
        if (!nodeLevel.has(neighbor)) {
          nodeLevel.set(neighbor, currentLevel + 1);
          queue.push(neighbor);
        }
      });
    }

    // Group nodes by level
    nodeLevel.forEach((level, nodeId) => {
      const node = this.graph.nodes.get(nodeId)!;
      if (!levels.has(level)) {
        levels.set(level, []);
      }
      levels.get(level)!.push(node);
    });

    return levels;
  }

  /**
   * Find critical dependencies based on centrality and criticality
   */
  private findCriticalDependencies(): ServiceRelationship[] {
    const critical: ServiceRelationship[] = [];
    const centrality = this.calculateBetweennessCentrality();

    this.graph.edges.forEach(edge => {
      const source = this.graph.nodes.get(edge.source);
      const target = this.graph.nodes.get(edge.target);
      
      if (!source || !target) return;

      // Check if either node is critical
      const sourceCriticality = source.metadata.criticality === CriticalityLevel.CRITICAL;
      const targetCriticality = target.metadata.criticality === CriticalityLevel.CRITICAL;
      
      // Check centrality
      const sourceCentrality = centrality.get(edge.source) || 0;
      const targetCentrality = centrality.get(edge.target) || 0;
      const avgCentrality = (sourceCentrality + targetCentrality) / 2;
      
      // Consider edge critical if nodes are critical or have high centrality
      if (sourceCriticality || targetCriticality || avgCentrality > 0.1) {
        critical.push(edge);
      }
    });

    return critical;
  }

  /**
   * Find bottleneck services (high betweenness centrality)
   */
  private findBottlenecks(): ServiceNode[] {
    const centrality = this.calculateBetweennessCentrality();
    const threshold = this.calculateCentralityThreshold(centrality);
    
    const bottlenecks: ServiceNode[] = [];
    
    centrality.forEach((score, nodeId) => {
      if (score > threshold) {
        const node = this.graph.nodes.get(nodeId);
        if (node) {
          bottlenecks.push(node);
        }
      }
    });

    // Sort by centrality score
    bottlenecks.sort((a, b) => 
      (centrality.get(b.id) || 0) - (centrality.get(a.id) || 0)
    );

    return bottlenecks;
  }

  /**
   * Calculate betweenness centrality for all nodes
   */
  private calculateBetweennessCentrality(): Map<string, number> {
    const centrality = new Map<string, number>();
    
    // Initialize all centralities to 0
    this.graph.nodes.forEach((_, nodeId) => {
      centrality.set(nodeId, 0);
    });

    // For each pair of nodes, find shortest paths and update centrality
    const nodeIds = Array.from(this.graph.nodes.keys());
    
    for (const source of nodeIds) {
      for (const target of nodeIds) {
        if (source === target) continue;
        
        const paths = this.findAllShortestPaths(source, target);
        
        paths.forEach(path => {
          // Update centrality for intermediate nodes
          for (let i = 1; i < path.length - 1; i++) {
            const node = path[i];
            centrality.set(node, (centrality.get(node) || 0) + 1 / paths.length);
          }
        });
      }
    }

    // Normalize centrality scores
    const n = nodeIds.length;
    const normalizationFactor = n > 2 ? 2 / ((n - 1) * (n - 2)) : 1;
    
    centrality.forEach((score, nodeId) => {
      centrality.set(nodeId, score * normalizationFactor);
    });

    return centrality;
  }

  /**
   * Find all shortest paths between two nodes
   */
  private findAllShortestPaths(sourceId: string, targetId: string): string[][] {
    const paths: string[][] = [];
    const distances = new Map<string, number>();
    const queue: Array<{ node: string; path: string[]; distance: number }> = [];
    let shortestDistance = Infinity;

    // Initialize
    this.graph.nodes.forEach((_, nodeId) => {
      distances.set(nodeId, Infinity);
    });
    
    queue.push({ node: sourceId, path: [sourceId], distance: 0 });
    distances.set(sourceId, 0);

    while (queue.length > 0) {
      const { node, path, distance } = queue.shift()!;
      
      if (distance > shortestDistance) continue;
      
      if (node === targetId) {
        if (distance < shortestDistance) {
          shortestDistance = distance;
          paths.length = 0; // Clear previous paths
        }
        if (distance === shortestDistance) {
          paths.push(path);
        }
        continue;
      }

      const neighbors = this.graph.adjacencyList.get(node) || new Set();
      neighbors.forEach(neighbor => {
        const newDistance = distance + 1;
        
        if (newDistance <= distances.get(neighbor)!) {
          distances.set(neighbor, newDistance);
          queue.push({
            node: neighbor,
            path: [...path, neighbor],
            distance: newDistance
          });
        }
      });
    }

    return paths;
  }

  /**
   * Perform topological sort (returns empty array if cycles exist)
   */
  private topologicalSort(): string[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Calculate in-degrees
    this.graph.nodes.forEach((_, nodeId) => {
      const incoming = this.graph.reverseAdjacencyList.get(nodeId) || new Set();
      inDegree.set(nodeId, incoming.size);
      
      if (incoming.size === 0) {
        queue.push(nodeId);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const neighbors = this.graph.adjacencyList.get(current) || new Set();
      neighbors.forEach(neighbor => {
        const degree = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, degree);
        
        if (degree === 0) {
          queue.push(neighbor);
        }
      });
    }

    // If result doesn't contain all nodes, there's a cycle
    return result.length === this.graph.nodes.size ? result : [];
  }

  /**
   * Find critical downstream path from a node
   */
  private findCriticalDownstreamPath(nodeId: string): string[] {
    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    
    // Initialize
    this.graph.nodes.forEach((_, id) => {
      distances.set(id, 0);
      previous.set(id, null);
    });

    // BFS to find longest path
    const queue = [nodeId];
    distances.set(nodeId, 0);
    
    let maxDistance = 0;
    let farthestNode = nodeId;

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDistance = distances.get(current)!;
      
      const neighbors = this.graph.adjacencyList.get(current) || new Set();
      neighbors.forEach(neighbor => {
        const newDistance = currentDistance + 1;
        
        if (newDistance > distances.get(neighbor)!) {
          distances.set(neighbor, newDistance);
          previous.set(neighbor, current);
          queue.push(neighbor);
          
          if (newDistance > maxDistance) {
            maxDistance = newDistance;
            farthestNode = neighbor;
          }
        }
      });
    }

    // Build path
    const path: string[] = [];
    let node: string | null = farthestNode;
    
    while (node !== null) {
      path.unshift(node);
      node = previous.get(node) || null;
    }

    return path;
  }

  /**
   * Calculate risk score for impact analysis
   */
  private calculateRiskScore(source: ServiceNode, affected: ServiceNode[]): number {
    let score = 0;

    // Factor in source criticality
    const criticalityScores = {
      [CriticalityLevel.CRITICAL]: 10,
      [CriticalityLevel.HIGH]: 7,
      [CriticalityLevel.MEDIUM]: 5,
      [CriticalityLevel.LOW]: 3,
      [CriticalityLevel.MINIMAL]: 1
    };
    
    score += criticalityScores[source.metadata.criticality || CriticalityLevel.MEDIUM];

    // Factor in number of affected services
    score += Math.min(affected.length * 0.5, 10);

    // Factor in criticality of affected services
    affected.forEach(node => {
      score += criticalityScores[node.metadata.criticality || CriticalityLevel.LOW] * 0.2;
    });

    // Factor in health status
    if (source.health.status === 'unhealthy') {
      score *= 1.5;
    } else if (source.health.status === 'degraded') {
      score *= 1.2;
    }

    // Normalize to 0-100 scale
    return Math.min(Math.round(score * 2), 100);
  }

  /**
   * Calculate edge weight for path finding
   */
  private calculateEdgeWeight(edge: ServiceRelationship | undefined): number {
    if (!edge) return 1;

    let weight = 1;

    // Factor in latency
    if (edge.latency) {
      weight += edge.latency / 100; // Convert ms to weight factor
    }

    // Factor in error rate
    if (edge.errorRate) {
      weight += edge.errorRate * 10;
    }

    // Factor in traffic volume (inverse - high traffic = lower weight)
    if (edge.traffic?.volume) {
      weight *= 1 / Math.log(edge.traffic.volume + 1);
    }

    return Math.max(weight, 0.1);
  }

  /**
   * Calculate path cost
   */
  private calculatePathCost(path: string[]): number {
    let cost = 0;
    
    for (let i = 0; i < path.length - 1; i++) {
      const edge = this.findEdge(path[i], path[i + 1]);
      cost += this.calculateEdgeWeight(edge);
    }
    
    return cost;
  }

  /**
   * Find edge between two nodes
   */
  private findEdge(sourceId: string, targetId: string): ServiceRelationship | undefined {
    return Array.from(this.graph.edges.values()).find(
      edge => edge.source === sourceId && edge.target === targetId
    );
  }

  /**
   * Calculate centrality threshold
   */
  private calculateCentralityThreshold(centrality: Map<string, number>): number {
    const values = Array.from(centrality.values()).sort((a, b) => b - a);
    
    // Use 90th percentile as threshold
    const index = Math.floor(values.length * 0.1);
    return values[index] || 0;
  }

  /**
   * Clear memoization caches
   */
  public clearCache(): void {
    this.memoizedPaths.clear();
    this.memoizedImpacts.clear();
  }

  /**
   * Update graph with new data
   */
  public updateGraph(nodes: ServiceNode[], edges: ServiceRelationship[]): void {
    this.graph = this.buildGraph(nodes, edges);
    this.clearCache();
  }
}