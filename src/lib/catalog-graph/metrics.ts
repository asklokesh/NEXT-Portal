import type { 
  DependencyGraph, 
  GraphNode, 
  GraphEdge, 
  GraphMetrics,
  NodeMetrics,
  EdgeMetrics,
  GlobalMetrics,
} from './types';

export class GraphMetricsEngine {
  private adjacencyList: Map<string, string[]> = new Map();
  private reverseAdjacencyList: Map<string, string[]> = new Map();
  private nodeMap: Map<string, GraphNode> = new Map();
  private edgeMap: Map<string, GraphEdge> = new Map();

  /**
   * Calculate comprehensive graph metrics
   */
  calculateMetrics(graph: DependencyGraph): GraphMetrics {
    this.buildDataStructures(graph);

    const nodeMetrics = this.calculateNodeMetrics(graph);
    const edgeMetrics = this.calculateEdgeMetrics(graph);
    const globalMetrics = this.calculateGlobalMetrics(graph, nodeMetrics);

    return {
      nodeMetrics,
      edgeMetrics,
      globalMetrics,
    };
  }

  /**
   * Build internal data structures for efficient calculations
   */
  private buildDataStructures(graph: DependencyGraph): void {
    this.adjacencyList.clear();
    this.reverseAdjacencyList.clear();
    this.nodeMap.clear();
    this.edgeMap.clear();

    // Build node map
    graph.nodes.forEach(node => {
      this.nodeMap.set(node.id, node);
      this.adjacencyList.set(node.id, []);
      this.reverseAdjacencyList.set(node.id, []);
    });

    // Build adjacency lists and edge map
    graph.edges.forEach(edge => {
      this.edgeMap.set(edge.id, edge);
      
      if (this.adjacencyList.has(edge.source)) {
        this.adjacencyList.get(edge.source)!.push(edge.target);
      }
      
      if (this.reverseAdjacencyList.has(edge.target)) {
        this.reverseAdjacencyList.get(edge.target)!.push(edge.source);
      }
    });
  }

  /**
   * Calculate metrics for all nodes
   */
  private calculateNodeMetrics(graph: DependencyGraph): Record<string, NodeMetrics> {
    const nodeMetrics: Record<string, NodeMetrics> = {};

    // Calculate basic degree metrics
    graph.nodes.forEach(node => {
      const outDegree = this.adjacencyList.get(node.id)?.length || 0;
      const inDegree = this.reverseAdjacencyList.get(node.id)?.length || 0;
      const degree = outDegree + inDegree;

      nodeMetrics[node.id] = {
        id: node.id,
        degree,
        inDegree,
        outDegree,
        betweennessCentrality: 0,
        closenessCentrality: 0,
        eigenvectorCentrality: 0,
        pageRank: 0,
        clusteringCoefficient: 0,
        coreness: 0,
      };
    });

    // Calculate centrality metrics
    this.calculateBetweennessCentrality(graph, nodeMetrics);
    this.calculateClosenessCentrality(graph, nodeMetrics);
    this.calculateEigenvectorCentrality(graph, nodeMetrics);
    this.calculatePageRank(graph, nodeMetrics);
    this.calculateClusteringCoefficients(graph, nodeMetrics);
    this.calculateCoreness(graph, nodeMetrics);

    return nodeMetrics;
  }

  /**
   * Calculate betweenness centrality using Brandes' algorithm
   */
  private calculateBetweennessCentrality(
    graph: DependencyGraph, 
    nodeMetrics: Record<string, NodeMetrics>
  ): void {
    const nodes = graph.nodes.map(n => n.id);
    const betweenness: Record<string, number> = {};
    
    nodes.forEach(nodeId => {
      betweenness[nodeId] = 0;
    });

    nodes.forEach(source => {
      const stack: string[] = [];
      const paths: Record<string, string[]> = {};
      const sigma: Record<string, number> = {};
      const delta: Record<string, number> = {};
      const distance: Record<string, number> = {};
      const queue: string[] = [];

      // Initialize
      nodes.forEach(nodeId => {
        paths[nodeId] = [];
        sigma[nodeId] = 0;
        delta[nodeId] = 0;
        distance[nodeId] = -1;
      });

      sigma[source] = 1;
      distance[source] = 0;
      queue.push(source);

      // BFS
      while (queue.length > 0) {
        const current = queue.shift()!;
        stack.push(current);

        const neighbors = this.adjacencyList.get(current) || [];
        neighbors.forEach(neighbor => {
          // First time visiting neighbor?
          if (distance[neighbor] < 0) {
            queue.push(neighbor);
            distance[neighbor] = distance[current] + 1;
          }
          
          // Shortest path to neighbor via current?
          if (distance[neighbor] === distance[current] + 1) {
            sigma[neighbor] += sigma[current];
            paths[neighbor].push(current);
          }
        });
      }

      // Accumulation
      while (stack.length > 0) {
        const current = stack.pop()!;
        paths[current].forEach(predecessor => {
          delta[predecessor] += (sigma[predecessor] / sigma[current]) * (1 + delta[current]);
        });
        
        if (current !== source) {
          betweenness[current] += delta[current];
        }
      }
    });

    // Normalize betweenness centrality
    const n = nodes.length;
    const normalizationFactor = n > 2 ? 1 / ((n - 1) * (n - 2)) : 1;

    Object.keys(betweenness).forEach(nodeId => {
      nodeMetrics[nodeId].betweennessCentrality = betweenness[nodeId] * normalizationFactor;
    });
  }

  /**
   * Calculate closeness centrality
   */
  private calculateClosenessCentrality(
    graph: DependencyGraph, 
    nodeMetrics: Record<string, NodeMetrics>
  ): void {
    const nodes = graph.nodes.map(n => n.id);

    nodes.forEach(source => {
      const distances = this.dijkstra(source);
      const reachableNodes = Object.values(distances).filter(d => d < Infinity);
      
      if (reachableNodes.length > 1) {
        const totalDistance = reachableNodes.reduce((sum, d) => sum + d, 0);
        nodeMetrics[source].closenessCentrality = (reachableNodes.length - 1) / totalDistance;
      } else {
        nodeMetrics[source].closenessCentrality = 0;
      }
    });
  }

  /**
   * Calculate eigenvector centrality using power iteration
   */
  private calculateEigenvectorCentrality(
    graph: DependencyGraph, 
    nodeMetrics: Record<string, NodeMetrics>
  ): void {
    const nodes = graph.nodes.map(n => n.id);
    const n = nodes.length;
    
    if (n === 0) return;

    // Initialize eigenvector values
    const eigenvector: Record<string, number> = {};
    nodes.forEach(nodeId => {
      eigenvector[nodeId] = 1 / Math.sqrt(n);
    });

    // Power iteration
    const maxIterations = 100;
    const tolerance = 1e-6;

    for (let iter = 0; iter < maxIterations; iter++) {
      const newEigenvector: Record<string, number> = {};
      nodes.forEach(nodeId => {
        newEigenvector[nodeId] = 0;
      });

      // Matrix-vector multiplication
      nodes.forEach(nodeId => {
        const neighbors = this.reverseAdjacencyList.get(nodeId) || [];
        neighbors.forEach(neighbor => {
          newEigenvector[nodeId] += eigenvector[neighbor];
        });
      });

      // Normalize
      const norm = Math.sqrt(
        Object.values(newEigenvector).reduce((sum, val) => sum + val * val, 0)
      );

      if (norm > 0) {
        Object.keys(newEigenvector).forEach(nodeId => {
          newEigenvector[nodeId] /= norm;
        });
      }

      // Check convergence
      let converged = true;
      nodes.forEach(nodeId => {
        if (Math.abs(newEigenvector[nodeId] - eigenvector[nodeId]) > tolerance) {
          converged = false;
        }
      });

      Object.assign(eigenvector, newEigenvector);

      if (converged) break;
    }

    // Store results
    nodes.forEach(nodeId => {
      nodeMetrics[nodeId].eigenvectorCentrality = eigenvector[nodeId];
    });
  }

  /**
   * Calculate PageRank
   */
  private calculatePageRank(
    graph: DependencyGraph, 
    nodeMetrics: Record<string, NodeMetrics>
  ): void {
    const nodes = graph.nodes.map(n => n.id);
    const n = nodes.length;
    
    if (n === 0) return;

    const dampingFactor = 0.85;
    const maxIterations = 100;
    const tolerance = 1e-6;

    // Initialize PageRank values
    const pageRank: Record<string, number> = {};
    const newPageRank: Record<string, number> = {};
    
    nodes.forEach(nodeId => {
      pageRank[nodeId] = 1 / n;
      newPageRank[nodeId] = 0;
    });

    // Power iteration
    for (let iter = 0; iter < maxIterations; iter++) {
      // Reset new PageRank values
      nodes.forEach(nodeId => {
        newPageRank[nodeId] = (1 - dampingFactor) / n;
      });

      // Calculate PageRank contributions
      nodes.forEach(nodeId => {
        const outDegree = this.adjacencyList.get(nodeId)?.length || 0;
        if (outDegree > 0) {
          const contribution = (dampingFactor * pageRank[nodeId]) / outDegree;
          const neighbors = this.adjacencyList.get(nodeId) || [];
          neighbors.forEach(neighbor => {
            newPageRank[neighbor] += contribution;
          });
        }
      });

      // Check convergence
      let converged = true;
      let maxDiff = 0;
      
      nodes.forEach(nodeId => {
        const diff = Math.abs(newPageRank[nodeId] - pageRank[nodeId]);
        maxDiff = Math.max(maxDiff, diff);
        if (diff > tolerance) {
          converged = false;
        }
      });

      // Update PageRank values
      Object.assign(pageRank, newPageRank);

      if (converged) break;
    }

    // Store results
    nodes.forEach(nodeId => {
      nodeMetrics[nodeId].pageRank = pageRank[nodeId];
    });
  }

  /**
   * Calculate clustering coefficients
   */
  private calculateClusteringCoefficients(
    graph: DependencyGraph, 
    nodeMetrics: Record<string, NodeMetrics>
  ): void {
    graph.nodes.forEach(node => {
      const neighbors = new Set([
        ...(this.adjacencyList.get(node.id) || []),
        ...(this.reverseAdjacencyList.get(node.id) || [])
      ]);

      const neighborList = Array.from(neighbors);
      const k = neighborList.length;

      if (k < 2) {
        nodeMetrics[node.id].clusteringCoefficient = 0;
        return;
      }

      let edges = 0;
      for (let i = 0; i < neighborList.length; i++) {
        for (let j = i + 1; j < neighborList.length; j++) {
          const nodeA = neighborList[i];
          const nodeB = neighborList[j];
          
          // Check if there's an edge between nodeA and nodeB
          const aNeighbors = this.adjacencyList.get(nodeA) || [];
          const bNeighbors = this.adjacencyList.get(nodeB) || [];
          
          if (aNeighbors.includes(nodeB) || bNeighbors.includes(nodeA)) {
            edges++;
          }
        }
      }

      const maxPossibleEdges = (k * (k - 1)) / 2;
      nodeMetrics[node.id].clusteringCoefficient = edges / maxPossibleEdges;
    });
  }

  /**
   * Calculate k-core decomposition
   */
  private calculateCoreness(
    graph: DependencyGraph, 
    nodeMetrics: Record<string, NodeMetrics>
  ): void {
    const nodes = new Set(graph.nodes.map(n => n.id));
    const degrees = new Map<string, number>();
    const coreness = new Map<string, number>();

    // Initialize degrees
    nodes.forEach(nodeId => {
      const degree = (this.adjacencyList.get(nodeId)?.length || 0) + 
                     (this.reverseAdjacencyList.get(nodeId)?.length || 0);
      degrees.set(nodeId, degree);
    });

    let currentCore = 0;

    while (nodes.size > 0) {
      // Find nodes with minimum degree
      let minDegree = Infinity;
      nodes.forEach(nodeId => {
        const degree = degrees.get(nodeId) || 0;
        minDegree = Math.min(minDegree, degree);
      });

      currentCore = Math.max(currentCore, minDegree);

      // Remove all nodes with minimum degree
      const toRemove: string[] = [];
      nodes.forEach(nodeId => {
        if ((degrees.get(nodeId) || 0) === minDegree) {
          toRemove.push(nodeId);
          coreness.set(nodeId, currentCore);
        }
      });

      toRemove.forEach(nodeId => {
        nodes.delete(nodeId);

        // Update degrees of neighbors
        const neighbors = new Set([
          ...(this.adjacencyList.get(nodeId) || []),
          ...(this.reverseAdjacencyList.get(nodeId) || [])
        ]);

        neighbors.forEach(neighbor => {
          if (nodes.has(neighbor)) {
            const currentDegree = degrees.get(neighbor) || 0;
            degrees.set(neighbor, Math.max(0, currentDegree - 1));
          }
        });
      });
    }

    // Store results
    coreness.forEach((core, nodeId) => {
      nodeMetrics[nodeId].coreness = core;
    });
  }

  /**
   * Calculate metrics for all edges
   */
  private calculateEdgeMetrics(graph: DependencyGraph): Record<string, EdgeMetrics> {
    const edgeMetrics: Record<string, EdgeMetrics> = {};

    graph.edges.forEach(edge => {
      const sourceNode = this.nodeMap.get(edge.source);
      const targetNode = this.nodeMap.get(edge.target);

      if (!sourceNode || !targetNode) return;

      // Calculate edge length (if positions are available)
      let length = 0;
      if (sourceNode.x !== undefined && sourceNode.y !== undefined &&
          targetNode.x !== undefined && targetNode.y !== undefined) {
        const dx = targetNode.x - sourceNode.x;
        const dy = targetNode.y - sourceNode.y;
        length = Math.sqrt(dx * dx + dy * dy);
      }

      edgeMetrics[edge.id] = {
        id: edge.id,
        betweennessCentrality: 0, // To be calculated
        weight: edge.strength,
        length,
      };
    });

    // Calculate edge betweenness centrality
    this.calculateEdgeBetweennessCentrality(graph, edgeMetrics);

    return edgeMetrics;
  }

  /**
   * Calculate edge betweenness centrality
   */
  private calculateEdgeBetweennessCentrality(
    graph: DependencyGraph,
    edgeMetrics: Record<string, EdgeMetrics>
  ): void {
    const nodes = graph.nodes.map(n => n.id);
    const edgeBetweenness: Record<string, number> = {};

    // Initialize edge betweenness
    graph.edges.forEach(edge => {
      edgeBetweenness[edge.id] = 0;
    });

    // For each pair of nodes, find shortest paths and count edge usage
    nodes.forEach(source => {
      nodes.forEach(target => {
        if (source !== target) {
          const paths = this.findAllShortestPaths(source, target);
          paths.forEach(path => {
            for (let i = 0; i < path.length - 1; i++) {
              const edgeId = this.findEdgeId(path[i], path[i + 1]);
              if (edgeId && edgeBetweenness.hasOwnProperty(edgeId)) {
                edgeBetweenness[edgeId] += 1 / paths.length;
              }
            }
          });
        }
      });
    });

    // Normalize and store results
    const totalPairs = nodes.length * (nodes.length - 1);
    const normalizationFactor = totalPairs > 0 ? 1 / totalPairs : 1;

    Object.keys(edgeBetweenness).forEach(edgeId => {
      if (edgeMetrics[edgeId]) {
        edgeMetrics[edgeId].betweennessCentrality = edgeBetweenness[edgeId] * normalizationFactor;
      }
    });
  }

  /**
   * Calculate global graph metrics
   */
  private calculateGlobalMetrics(
    graph: DependencyGraph, 
    nodeMetrics: Record<string, NodeMetrics>
  ): GlobalMetrics {
    const n = graph.nodes.length;
    const m = graph.edges.length;

    if (n === 0) {
      return {
        averagePathLength: 0,
        diameter: 0,
        density: 0,
        modularity: 0,
        transitivity: 0,
        assortativity: 0,
        components: 0,
        stronglyConnectedComponents: 0,
      };
    }

    const density = n > 1 ? (2 * m) / (n * (n - 1)) : 0;

    // Calculate average path length and diameter
    const { averagePathLength, diameter } = this.calculatePathMetrics(graph);

    // Calculate transitivity (global clustering coefficient)
    const transitivity = this.calculateTransitivity(graph);

    // Calculate modularity (simplified version)
    const modularity = this.calculateModularity(graph, nodeMetrics);

    // Calculate assortativity
    const assortativity = this.calculateAssortativity(graph, nodeMetrics);

    // Count components
    const components = this.countConnectedComponents(graph);
    const stronglyConnectedComponents = this.countStronglyConnectedComponents(graph);

    return {
      averagePathLength,
      diameter,
      density,
      modularity,
      transitivity,
      assortativity,
      components,
      stronglyConnectedComponents,
    };
  }

  /**
   * Calculate average path length and diameter
   */
  private calculatePathMetrics(graph: DependencyGraph): { averagePathLength: number; diameter: number } {
    const nodes = graph.nodes.map(n => n.id);
    let totalDistance = 0;
    let pathCount = 0;
    let diameter = 0;

    nodes.forEach(source => {
      const distances = this.dijkstra(source);
      
      nodes.forEach(target => {
        if (source !== target && distances[target] < Infinity) {
          totalDistance += distances[target];
          pathCount++;
          diameter = Math.max(diameter, distances[target]);
        }
      });
    });

    const averagePathLength = pathCount > 0 ? totalDistance / pathCount : 0;

    return { averagePathLength, diameter };
  }

  /**
   * Calculate transitivity (global clustering coefficient)
   */
  private calculateTransitivity(graph: DependencyGraph): number {
    let triangles = 0;
    let triplets = 0;

    graph.nodes.forEach(node => {
      const neighbors = new Set([
        ...(this.adjacencyList.get(node.id) || []),
        ...(this.reverseAdjacencyList.get(node.id) || [])
      ]);

      const neighborList = Array.from(neighbors);
      const degree = neighborList.length;

      // Count triplets centered at this node
      if (degree >= 2) {
        triplets += (degree * (degree - 1)) / 2;

        // Count triangles
        for (let i = 0; i < neighborList.length; i++) {
          for (let j = i + 1; j < neighborList.length; j++) {
            const nodeA = neighborList[i];
            const nodeB = neighborList[j];
            
            const aNeighbors = this.adjacencyList.get(nodeA) || [];
            const bNeighbors = this.adjacencyList.get(nodeB) || [];
            
            if (aNeighbors.includes(nodeB) || bNeighbors.includes(nodeA)) {
              triangles++;
            }
          }
        }
      }
    });

    return triplets > 0 ? triangles / triplets : 0;
  }

  /**
   * Calculate modularity (simplified)
   */
  private calculateModularity(graph: DependencyGraph, nodeMetrics: Record<string, NodeMetrics>): number {
    // This is a simplified modularity calculation
    // In practice, you'd want to use community detection algorithms
    const m = graph.edges.length;
    if (m === 0) return 0;

    let modularity = 0;
    const communities = this.detectSimpleCommunities(graph);

    communities.forEach(community => {
      let internalEdges = 0;
      let totalDegree = 0;

      community.forEach(nodeId => {
        totalDegree += nodeMetrics[nodeId].degree;
        
        const neighbors = this.adjacencyList.get(nodeId) || [];
        neighbors.forEach(neighbor => {
          if (community.includes(neighbor)) {
            internalEdges++;
          }
        });
      });

      const expectedEdges = (totalDegree * totalDegree) / (4 * m);
      modularity += (internalEdges / m) - expectedEdges / m;
    });

    return modularity;
  }

  /**
   * Calculate degree assortativity
   */
  private calculateAssortativity(graph: DependencyGraph, nodeMetrics: Record<string, NodeMetrics>): number {
    if (graph.edges.length === 0) return 0;

    let numerator = 0;
    let denominator = 0;
    let meanDegree = 0;

    // Calculate mean degree
    graph.nodes.forEach(node => {
      meanDegree += nodeMetrics[node.id].degree;
    });
    meanDegree /= graph.nodes.length;

    // Calculate assortativity
    graph.edges.forEach(edge => {
      const sourceDegree = nodeMetrics[edge.source]?.degree || 0;
      const targetDegree = nodeMetrics[edge.target]?.degree || 0;

      numerator += (sourceDegree - meanDegree) * (targetDegree - meanDegree);
      denominator += (sourceDegree - meanDegree) * (sourceDegree - meanDegree);
    });

    return denominator !== 0 ? numerator / denominator : 0;
  }

  /**
   * Count connected components
   */
  private countConnectedComponents(graph: DependencyGraph): number {
    const visited = new Set<string>();
    let components = 0;

    graph.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        this.dfsComponent(node.id, visited);
        components++;
      }
    });

    return components;
  }

  /**
   * Count strongly connected components (using Tarjan's algorithm)
   */
  private countStronglyConnectedComponents(graph: DependencyGraph): number {
    const index = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    let currentIndex = 0;
    let sccCount = 0;

    const strongConnect = (nodeId: string) => {
      index.set(nodeId, currentIndex);
      lowlink.set(nodeId, currentIndex);
      currentIndex++;
      stack.push(nodeId);
      onStack.add(nodeId);

      const neighbors = this.adjacencyList.get(nodeId) || [];
      neighbors.forEach(neighbor => {
        if (!index.has(neighbor)) {
          strongConnect(neighbor);
          lowlink.set(nodeId, Math.min(lowlink.get(nodeId)!, lowlink.get(neighbor)!));
        } else if (onStack.has(neighbor)) {
          lowlink.set(nodeId, Math.min(lowlink.get(nodeId)!, index.get(neighbor)!));
        }
      });

      if (lowlink.get(nodeId) === index.get(nodeId)) {
        sccCount++;
        let node;
        do {
          node = stack.pop()!;
          onStack.delete(node);
        } while (node !== nodeId);
      }
    };

    graph.nodes.forEach(node => {
      if (!index.has(node.id)) {
        strongConnect(node.id);
      }
    });

    return sccCount;
  }

  /**
   * Helper methods
   */
  private dijkstra(source: string): Record<string, number> {
    const distances: Record<string, number> = {};
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; distance: number }> = [];

    // Initialize distances
    this.nodeMap.forEach((_, nodeId) => {
      distances[nodeId] = nodeId === source ? 0 : Infinity;
    });

    queue.push({ nodeId: source, distance: 0 });

    while (queue.length > 0) {
      // Sort queue by distance (simple implementation, could use priority queue)
      queue.sort((a, b) => a.distance - b.distance);
      const { nodeId: current, distance: currentDistance } = queue.shift()!;

      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = this.adjacencyList.get(current) || [];
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          const edgeWeight = 1; // Assuming unit weights
          const newDistance = currentDistance + edgeWeight;
          
          if (newDistance < distances[neighbor]) {
            distances[neighbor] = newDistance;
            queue.push({ nodeId: neighbor, distance: newDistance });
          }
        }
      });
    }

    return distances;
  }

  private findAllShortestPaths(source: string, target: string): string[][] {
    const paths: string[][] = [];
    const queue: Array<{ nodeId: string; path: string[]; distance: number }> = [];
    const distances: Record<string, number> = {};
    
    // Initialize
    this.nodeMap.forEach((_, nodeId) => {
      distances[nodeId] = Infinity;
    });
    
    distances[source] = 0;
    queue.push({ nodeId: source, path: [source], distance: 0 });

    let shortestDistance = Infinity;

    while (queue.length > 0) {
      queue.sort((a, b) => a.distance - b.distance);
      const { nodeId: current, path, distance: currentDistance } = queue.shift()!;

      if (currentDistance > shortestDistance) break;

      if (current === target) {
        if (currentDistance < shortestDistance) {
          shortestDistance = currentDistance;
          paths.length = 0; // Clear previous longer paths
        }
        if (currentDistance === shortestDistance) {
          paths.push([...path]);
        }
        continue;
      }

      const neighbors = this.adjacencyList.get(current) || [];
      neighbors.forEach(neighbor => {
        const newDistance = currentDistance + 1;
        
        if (newDistance <= distances[neighbor] && !path.includes(neighbor)) {
          distances[neighbor] = newDistance;
          queue.push({
            nodeId: neighbor,
            path: [...path, neighbor],
            distance: newDistance,
          });
        }
      });
    }

    return paths;
  }

  private findEdgeId(source: string, target: string): string | null {
    for (const [edgeId, edge] of this.edgeMap.entries()) {
      if (edge.source === source && edge.target === target) {
        return edgeId;
      }
    }
    return null;
  }

  private dfsComponent(nodeId: string, visited: Set<string>): void {
    visited.add(nodeId);
    
    const neighbors = new Set([
      ...(this.adjacencyList.get(nodeId) || []),
      ...(this.reverseAdjacencyList.get(nodeId) || [])
    ]);

    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        this.dfsComponent(neighbor, visited);
      }
    });
  }

  private detectSimpleCommunities(graph: DependencyGraph): string[][] {
    // Simple community detection based on connected components
    const visited = new Set<string>();
    const communities: string[][] = [];

    graph.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        const community: string[] = [];
        this.dfsCollectComponent(node.id, visited, community);
        communities.push(community);
      }
    });

    return communities;
  }

  private dfsCollectComponent(nodeId: string, visited: Set<string>, community: string[]): void {
    visited.add(nodeId);
    community.push(nodeId);
    
    const neighbors = new Set([
      ...(this.adjacencyList.get(nodeId) || []),
      ...(this.reverseAdjacencyList.get(nodeId) || [])
    ]);

    neighbors.forEach(neighbor => {
      if (!visited.has(neighbor)) {
        this.dfsCollectComponent(neighbor, visited, community);
      }
    });
  }

  /**
   * Get top nodes by specific metrics
   */
  getTopNodesByMetric(
    metrics: GraphMetrics,
    metricName: keyof NodeMetrics,
    count: number = 10
  ): Array<{ nodeId: string; value: number }> {
    const nodes = Object.entries(metrics.nodeMetrics)
      .map(([nodeId, nodeMetric]) => ({
        nodeId,
        value: nodeMetric[metricName] as number,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, count);

    return nodes;
  }

  /**
   * Get metric distribution statistics
   */
  getMetricDistribution(
    metrics: GraphMetrics,
    metricName: keyof NodeMetrics
  ): {
    min: number;
    max: number;
    mean: number;
    median: number;
    standardDeviation: number;
    percentiles: { p25: number; p50: number; p75: number; p90: number; p95: number };
  } {
    const values = Object.values(metrics.nodeMetrics)
      .map(metric => metric[metricName] as number)
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return {
        min: 0, max: 0, mean: 0, median: 0, standardDeviation: 0,
        percentiles: { p25: 0, p50: 0, p75: 0, p90: 0, p95: 0 }
      };
    }

    const min = values[0];
    const max = values[values.length - 1];
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const median = this.getPercentile(values, 0.5);

    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const standardDeviation = Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length);

    const percentiles = {
      p25: this.getPercentile(values, 0.25),
      p50: this.getPercentile(values, 0.5),
      p75: this.getPercentile(values, 0.75),
      p90: this.getPercentile(values, 0.9),
      p95: this.getPercentile(values, 0.95),
    };

    return { min, max, mean, median, standardDeviation, percentiles };
  }

  private getPercentile(sortedValues: number[], percentile: number): number {
    const index = (sortedValues.length - 1) * percentile;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
  }
}