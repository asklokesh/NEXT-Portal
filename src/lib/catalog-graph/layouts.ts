import type { DependencyGraph, GraphNode, GraphEdge, GraphLayout, GraphCluster } from './types';

export interface LayoutOptions {
  width: number;
  height: number;
  padding: number;
  iterations: number;
  nodeSpacing: number;
  clusterSpacing: number;
  animated: boolean;
}

export class GraphLayoutEngine {
  private defaultOptions: LayoutOptions = {
    width: 1200,
    height: 800,
    padding: 50,
    iterations: 100,
    nodeSpacing: 100,
    clusterSpacing: 200,
    animated: true,
  };

  /**
   * Apply layout algorithm to position nodes in the graph
   */
  applyLayout(graph: DependencyGraph, layout: GraphLayout, options?: Partial<LayoutOptions>): DependencyGraph {
    const opts = { ...this.defaultOptions, ...options };
    
    switch (layout.type) {
      case 'force':
        return this.applyForceDirectedLayout(graph, opts, layout.parameters);
      case 'hierarchical':
        return this.applyHierarchicalLayout(graph, opts, layout.parameters);
      case 'radial':
        return this.applyRadialLayout(graph, opts, layout.parameters);
      case 'circular':
        return this.applyCircularLayout(graph, opts, layout.parameters);
      case 'grid':
        return this.applyGridLayout(graph, opts, layout.parameters);
      case 'layered':
        return this.applyLayeredLayout(graph, opts, layout.parameters);
      default:
        return this.applyForceDirectedLayout(graph, opts, {});
    }
  }

  /**
   * Force-directed layout using modified Fruchterman-Reingold algorithm
   */
  private applyForceDirectedLayout(
    graph: DependencyGraph, 
    options: LayoutOptions,
    parameters: Record<string, any>
  ): DependencyGraph {
    const {
      repulsionStrength = 1000,
      attractionStrength = 0.01,
      damping = 0.9,
      centeringForce = 0.02,
      nodeTypeForces = {},
    } = parameters;

    const nodes = [...graph.nodes];
    const edges = [...graph.edges];
    
    // Initialize positions randomly if not set
    nodes.forEach(node => {
      if (node.x === undefined || node.y === undefined) {
        node.x = Math.random() * options.width;
        node.y = Math.random() * options.height;
      }
    });

    // Create velocity vectors
    const velocities = new Map<string, { vx: number; vy: number }>();
    nodes.forEach(node => {
      velocities.set(node.id, { vx: 0, vy: 0 });
    });

    const centerX = options.width / 2;
    const centerY = options.height / 2;

    for (let iteration = 0; iteration < options.iterations; iteration++) {
      const forces = new Map<string, { fx: number; fy: number }>();
      
      // Initialize forces
      nodes.forEach(node => {
        forces.set(node.id, { fx: 0, fy: 0 });
      });

      // Calculate repulsion forces (nodes push away from each other)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const nodeA = nodes[i];
          const nodeB = nodes[j];
          
          const dx = nodeA.x! - nodeB.x!;
          const dy = nodeA.y! - nodeB.y!;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // Adjust repulsion based on node types
          let adjustedRepulsion = repulsionStrength;
          if (nodeA.type === 'System' || nodeB.type === 'System') {
            adjustedRepulsion *= 1.5; // Systems repel more strongly
          }
          
          const force = adjustedRepulsion / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          const forceA = forces.get(nodeA.id)!;
          const forceB = forces.get(nodeB.id)!;
          
          forceA.fx += fx;
          forceA.fy += fy;
          forceB.fx -= fx;
          forceB.fy -= fy;
        }
      }

      // Calculate attraction forces (connected nodes pull toward each other)
      edges.forEach(edge => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          const dx = targetNode.x! - sourceNode.x!;
          const dy = targetNode.y! - sourceNode.y!;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // Adjust attraction based on edge type and strength
          const adjustedAttraction = attractionStrength * edge.strength;
          const optimalDistance = options.nodeSpacing * (1 + edge.strength);
          
          const force = (distance - optimalDistance) * adjustedAttraction;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          
          const forceSource = forces.get(sourceNode.id)!;
          const forceTarget = forces.get(targetNode.id)!;
          
          forceSource.fx += fx;
          forceSource.fy += fy;
          forceTarget.fx -= fx;
          forceTarget.fy -= fy;
        }
      });

      // Apply centering force
      nodes.forEach(node => {
        const force = forces.get(node.id)!;
        const centerDx = centerX - node.x!;
        const centerDy = centerY - node.y!;
        
        force.fx += centerDx * centeringForce;
        force.fy += centerDy * centeringForce;
      });

      // Update velocities and positions
      nodes.forEach(node => {
        const force = forces.get(node.id)!;
        const velocity = velocities.get(node.id)!;
        
        // Update velocity with damping
        velocity.vx = (velocity.vx + force.fx) * damping;
        velocity.vy = (velocity.vy + force.fy) * damping;
        
        // Update position
        node.x = node.x! + velocity.vx;
        node.y = node.y! + velocity.vy;
        
        // Keep nodes within bounds
        node.x = Math.max(options.padding, Math.min(options.width - options.padding, node.x));
        node.y = Math.max(options.padding, Math.min(options.height - options.padding, node.y));
      });
    }

    return { ...graph, nodes, edges };
  }

  /**
   * Hierarchical layout organizing nodes by levels
   */
  private applyHierarchicalLayout(
    graph: DependencyGraph,
    options: LayoutOptions,
    parameters: Record<string, any>
  ): DependencyGraph {
    const {
      direction = 'top-down', // 'top-down', 'bottom-up', 'left-right', 'right-left'
      levelSeparation = 120,
      nodeSeparation = 80,
      sortMethod = 'barycentric', // 'barycentric', 'simple'
    } = parameters;

    const nodes = [...graph.nodes];
    const edges = [...graph.edges];

    // Build dependency graph for level assignment
    const dependencyMap = new Map<string, Set<string>>();
    const dependentMap = new Map<string, Set<string>>();
    
    nodes.forEach(node => {
      dependencyMap.set(node.id, new Set());
      dependentMap.set(node.id, new Set());
    });

    edges.forEach(edge => {
      if (edge.type === 'depends_on') {
        dependencyMap.get(edge.source)?.add(edge.target);
        dependentMap.get(edge.target)?.add(edge.source);
      }
    });

    // Assign levels using topological sorting
    const levels = this.assignLevels(nodes, dependencyMap, dependentMap);
    
    // Sort nodes within each level
    this.sortNodesWithinLevels(levels, edges, sortMethod);

    // Position nodes based on levels and direction
    this.positionHierarchicalNodes(levels, options, direction, levelSeparation, nodeSeparation);

    return { ...graph, nodes, edges };
  }

  /**
   * Radial layout with nodes arranged in concentric circles
   */
  private applyRadialLayout(
    graph: DependencyGraph,
    options: LayoutOptions,
    parameters: Record<string, any>
  ): DependencyGraph {
    const {
      rootNodeId,
      radiusIncrement = 80,
      angleSpread = 360,
      centerX = options.width / 2,
      centerY = options.height / 2,
    } = parameters;

    const nodes = [...graph.nodes];
    const edges = [...graph.edges];

    // Find root node or use most connected node
    let rootNode: GraphNode;
    if (rootNodeId) {
      rootNode = nodes.find(n => n.id === rootNodeId)!;
    } else {
      rootNode = nodes.reduce((prev, current) => 
        (prev.dependencies.length + prev.dependents.length) > 
        (current.dependencies.length + current.dependents.length) ? prev : current
      );
    }

    if (!rootNode) return { ...graph, nodes, edges };

    // Assign distances from root using BFS
    const distances = new Map<string, number>();
    const queue: string[] = [rootNode.id];
    distances.set(rootNode.id, 0);

    const adjacencyList = this.buildAdjacencyList(nodes, edges);

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentDistance = distances.get(currentId)!;

      const neighbors = adjacencyList.get(currentId) || [];
      neighbors.forEach(neighborId => {
        if (!distances.has(neighborId)) {
          distances.set(neighborId, currentDistance + 1);
          queue.push(neighborId);
        }
      });
    }

    // Group nodes by distance
    const nodesByDistance = new Map<number, GraphNode[]>();
    nodes.forEach(node => {
      const distance = distances.get(node.id) || 0;
      if (!nodesByDistance.has(distance)) {
        nodesByDistance.set(distance, []);
      }
      nodesByDistance.get(distance)!.push(node);
    });

    // Position nodes in concentric circles
    nodesByDistance.forEach((levelNodes, distance) => {
      const radius = distance * radiusIncrement;
      const angleStep = (angleSpread * Math.PI / 180) / Math.max(1, levelNodes.length - 1);

      levelNodes.forEach((node, index) => {
        if (distance === 0) {
          // Root node at center
          node.x = centerX;
          node.y = centerY;
        } else {
          const angle = (index - (levelNodes.length - 1) / 2) * angleStep;
          node.x = centerX + radius * Math.cos(angle);
          node.y = centerY + radius * Math.sin(angle);
        }
      });
    });

    return { ...graph, nodes, edges };
  }

  /**
   * Circular layout arranging nodes in a circle
   */
  private applyCircularLayout(
    graph: DependencyGraph,
    options: LayoutOptions,
    parameters: Record<string, any>
  ): DependencyGraph {
    const {
      radius,
      startAngle = 0,
      sortBy = 'none', // 'none', 'degree', 'alphabetical', 'type'
    } = parameters;

    const nodes = [...graph.nodes];
    const edges = [...graph.edges];

    // Sort nodes if requested
    this.sortNodes(nodes, sortBy);

    const centerX = options.width / 2;
    const centerY = options.height / 2;
    const actualRadius = radius || Math.min(options.width, options.height) * 0.35;
    const angleStep = (2 * Math.PI) / nodes.length;

    nodes.forEach((node, index) => {
      const angle = startAngle + index * angleStep;
      node.x = centerX + actualRadius * Math.cos(angle);
      node.y = centerY + actualRadius * Math.sin(angle);
    });

    return { ...graph, nodes, edges };
  }

  /**
   * Grid layout organizing nodes in a regular grid
   */
  private applyGridLayout(
    graph: DependencyGraph,
    options: LayoutOptions,
    parameters: Record<string, any>
  ): DependencyGraph {
    const {
      sortBy = 'type',
      aspectRatio = 1.618, // Golden ratio
    } = parameters;

    const nodes = [...graph.nodes];
    const edges = [...graph.edges];

    this.sortNodes(nodes, sortBy);

    const totalNodes = nodes.length;
    const cols = Math.ceil(Math.sqrt(totalNodes * aspectRatio));
    const rows = Math.ceil(totalNodes / cols);

    const cellWidth = (options.width - 2 * options.padding) / cols;
    const cellHeight = (options.height - 2 * options.padding) / rows;

    nodes.forEach((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      node.x = options.padding + col * cellWidth + cellWidth / 2;
      node.y = options.padding + row * cellHeight + cellHeight / 2;
    });

    return { ...graph, nodes, edges };
  }

  /**
   * Layered layout with manual layer assignment
   */
  private applyLayeredLayout(
    graph: DependencyGraph,
    options: LayoutOptions,
    parameters: Record<string, any>
  ): DependencyGraph {
    const {
      layers = [],
      layerSpacing = 150,
      nodeSpacing = 80,
      direction = 'horizontal', // 'horizontal', 'vertical'
    } = parameters;

    const nodes = [...graph.nodes];
    const edges = [...graph.edges];

    if (layers.length === 0) {
      // Auto-assign layers based on node types
      const layerMap = new Map<string, GraphNode[]>();
      
      nodes.forEach(node => {
        const layerKey = node.type;
        if (!layerMap.has(layerKey)) {
          layerMap.set(layerKey, []);
        }
        layerMap.get(layerKey)!.push(node);
      });

      layers.push(...Array.from(layerMap.keys()));
    }

    layers.forEach((layerNodes: GraphNode[], layerIndex: number) => {
      const layerNodeCount = layerNodes.length;
      
      layerNodes.forEach((node, nodeIndex) => {
        if (direction === 'horizontal') {
          node.x = options.padding + layerIndex * layerSpacing;
          node.y = options.padding + (nodeIndex * nodeSpacing) + 
                  (options.height - layerNodeCount * nodeSpacing) / 2;
        } else {
          node.x = options.padding + (nodeIndex * nodeSpacing) + 
                  (options.width - layerNodeCount * nodeSpacing) / 2;
          node.y = options.padding + layerIndex * layerSpacing;
        }
      });
    });

    return { ...graph, nodes, edges };
  }

  /**
   * Cluster-aware force-directed layout
   */
  applyClusteredLayout(
    graph: DependencyGraph,
    clusters: GraphCluster[],
    options: LayoutOptions
  ): DependencyGraph {
    const nodes = [...graph.nodes];
    const edges = [...graph.edges];

    // First, position clusters
    const clusterPositions = this.calculateClusterPositions(clusters, options);

    // Apply cluster assignments to nodes
    nodes.forEach(node => {
      const cluster = clusters.find(c => c.nodes.includes(node.id));
      if (cluster && clusterPositions.has(cluster.id)) {
        const clusterPos = clusterPositions.get(cluster.id)!;
        const clusterNodes = cluster.nodes.map(id => nodes.find(n => n.id === id)).filter(Boolean) as GraphNode[];
        
        // Position nodes within cluster using sub-layout
        this.positionNodesInCluster(clusterNodes, clusterPos, options.nodeSpacing);
      }
    });

    // Apply additional force-directed adjustments
    return this.applyForceDirectedLayout({ ...graph, nodes, edges }, options, {
      repulsionStrength: 500,
      attractionStrength: 0.02,
      iterations: 50,
    });
  }

  /**
   * Helper methods
   */
  private buildAdjacencyList(nodes: GraphNode[], edges: GraphEdge[]): Map<string, string[]> {
    const adjacencyList = new Map<string, string[]>();
    
    nodes.forEach(node => {
      adjacencyList.set(node.id, []);
    });

    edges.forEach(edge => {
      if (adjacencyList.has(edge.source)) {
        adjacencyList.get(edge.source)!.push(edge.target);
      }
      if (edge.bidirectional && adjacencyList.has(edge.target)) {
        adjacencyList.get(edge.target)!.push(edge.source);
      }
    });

    return adjacencyList;
  }

  private assignLevels(
    nodes: GraphNode[],
    dependencyMap: Map<string, Set<string>>,
    dependentMap: Map<string, Set<string>>
  ): Map<number, GraphNode[]> {
    const levels = new Map<number, GraphNode[]>();
    const nodeLevel = new Map<string, number>();
    const visited = new Set<string>();

    // Find root nodes (nodes with no dependencies)
    const rootNodes = nodes.filter(node => dependencyMap.get(node.id)!.size === 0);

    // Assign level 0 to root nodes
    rootNodes.forEach(node => {
      nodeLevel.set(node.id, 0);
      if (!levels.has(0)) levels.set(0, []);
      levels.get(0)!.push(node);
    });

    // BFS to assign levels
    const queue = [...rootNodes.map(n => n.id)];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentLevel = nodeLevel.get(currentId)!;
      
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const dependents = dependentMap.get(currentId) || new Set();
      dependents.forEach(dependentId => {
        const newLevel = currentLevel + 1;
        const existingLevel = nodeLevel.get(dependentId);
        
        if (existingLevel === undefined || newLevel > existingLevel) {
          nodeLevel.set(dependentId, newLevel);
          
          // Remove from old level
          if (existingLevel !== undefined && levels.has(existingLevel)) {
            const oldLevelNodes = levels.get(existingLevel)!;
            const index = oldLevelNodes.findIndex(n => n.id === dependentId);
            if (index !== -1) oldLevelNodes.splice(index, 1);
          }
          
          // Add to new level
          if (!levels.has(newLevel)) levels.set(newLevel, []);
          const dependentNode = nodes.find(n => n.id === dependentId)!;
          levels.get(newLevel)!.push(dependentNode);
        }
        
        queue.push(dependentId);
      });
    }

    return levels;
  }

  private sortNodesWithinLevels(
    levels: Map<number, GraphNode[]>,
    edges: GraphEdge[],
    method: string
  ): void {
    levels.forEach((levelNodes, level) => {
      if (method === 'barycentric') {
        // Sort by barycenter of connected nodes in adjacent levels
        levelNodes.sort((a, b) => {
          const baryA = this.calculateBarycenter(a, edges, levels, level);
          const baryB = this.calculateBarycenter(b, edges, levels, level);
          return baryA - baryB;
        });
      } else {
        // Simple sorting by node degree
        levelNodes.sort((a, b) => {
          const degreeA = a.dependencies.length + a.dependents.length;
          const degreeB = b.dependencies.length + b.dependents.length;
          return degreeB - degreeA;
        });
      }
    });
  }

  private calculateBarycenter(
    node: GraphNode,
    edges: GraphEdge[],
    levels: Map<number, GraphNode[]>,
    currentLevel: number
  ): number {
    const connectedNodes: { nodeId: string; position: number }[] = [];
    
    // Check previous level
    if (levels.has(currentLevel - 1)) {
      const prevLevelNodes = levels.get(currentLevel - 1)!;
      edges.forEach(edge => {
        if (edge.target === node.id) {
          const sourceIndex = prevLevelNodes.findIndex(n => n.id === edge.source);
          if (sourceIndex !== -1) {
            connectedNodes.push({ nodeId: edge.source, position: sourceIndex });
          }
        }
      });
    }

    // Check next level
    if (levels.has(currentLevel + 1)) {
      const nextLevelNodes = levels.get(currentLevel + 1)!;
      edges.forEach(edge => {
        if (edge.source === node.id) {
          const targetIndex = nextLevelNodes.findIndex(n => n.id === edge.target);
          if (targetIndex !== -1) {
            connectedNodes.push({ nodeId: edge.target, position: targetIndex });
          }
        }
      });
    }

    if (connectedNodes.length === 0) return 0;

    const sum = connectedNodes.reduce((total, conn) => total + conn.position, 0);
    return sum / connectedNodes.length;
  }

  private positionHierarchicalNodes(
    levels: Map<number, GraphNode[]>,
    options: LayoutOptions,
    direction: string,
    levelSeparation: number,
    nodeSeparation: number
  ): void {
    const maxLevel = Math.max(...levels.keys());
    
    levels.forEach((levelNodes, level) => {
      const nodeCount = levelNodes.length;
      
      levelNodes.forEach((node, index) => {
        if (direction === 'top-down') {
          node.x = options.padding + (index * nodeSeparation) + 
                  (options.width - nodeCount * nodeSeparation) / 2;
          node.y = options.padding + level * levelSeparation;
        } else if (direction === 'bottom-up') {
          node.x = options.padding + (index * nodeSeparation) + 
                  (options.width - nodeCount * nodeSeparation) / 2;
          node.y = options.height - options.padding - (maxLevel - level) * levelSeparation;
        } else if (direction === 'left-right') {
          node.x = options.padding + level * levelSeparation;
          node.y = options.padding + (index * nodeSeparation) + 
                  (options.height - nodeCount * nodeSeparation) / 2;
        } else if (direction === 'right-left') {
          node.x = options.width - options.padding - (maxLevel - level) * levelSeparation;
          node.y = options.padding + (index * nodeSeparation) + 
                  (options.height - nodeCount * nodeSeparation) / 2;
        }
      });
    });
  }

  private sortNodes(nodes: GraphNode[], sortBy: string): void {
    switch (sortBy) {
      case 'degree':
        nodes.sort((a, b) => 
          (b.dependencies.length + b.dependents.length) - 
          (a.dependencies.length + a.dependents.length)
        );
        break;
      case 'alphabetical':
        nodes.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'type':
        nodes.sort((a, b) => a.type.localeCompare(b.type));
        break;
      case 'health':
        nodes.sort((a, b) => b.health - a.health);
        break;
      default:
        // No sorting
        break;
    }
  }

  private calculateClusterPositions(
    clusters: GraphCluster[],
    options: LayoutOptions
  ): Map<string, { x: number; y: number; radius: number }> {
    const positions = new Map<string, { x: number; y: number; radius: number }>();
    
    const clusterCount = clusters.length;
    const cols = Math.ceil(Math.sqrt(clusterCount));
    const rows = Math.ceil(clusterCount / cols);
    
    const cellWidth = options.width / cols;
    const cellHeight = options.height / rows;

    clusters.forEach((cluster, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      const x = col * cellWidth + cellWidth / 2;
      const y = row * cellHeight + cellHeight / 2;
      const radius = Math.min(cellWidth, cellHeight) / 3;

      positions.set(cluster.id, { x, y, radius });
    });

    return positions;
  }

  private positionNodesInCluster(
    nodes: GraphNode[],
    clusterPos: { x: number; y: number; radius: number },
    nodeSpacing: number
  ): void {
    if (nodes.length === 0) return;
    
    if (nodes.length === 1) {
      nodes[0].x = clusterPos.x;
      nodes[0].y = clusterPos.y;
      return;
    }

    // Arrange nodes in a circle within the cluster
    const angleStep = (2 * Math.PI) / nodes.length;
    
    nodes.forEach((node, index) => {
      const angle = index * angleStep;
      const radius = Math.min(clusterPos.radius * 0.7, nodeSpacing * nodes.length / (2 * Math.PI));
      
      node.x = clusterPos.x + radius * Math.cos(angle);
      node.y = clusterPos.y + radius * Math.sin(angle);
    });
  }

  /**
   * Animate layout transitions
   */
  animateLayoutTransition(
    fromGraph: DependencyGraph,
    toGraph: DependencyGraph,
    duration: number = 1000,
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' = 'ease-out'
  ): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const nodePositions = new Map<string, { fromX: number; fromY: number; toX: number; toY: number }>();
      
      // Store initial and final positions
      fromGraph.nodes.forEach(node => {
        const toNode = toGraph.nodes.find(n => n.id === node.id);
        if (toNode) {
          nodePositions.set(node.id, {
            fromX: node.x || 0,
            fromY: node.y || 0,
            toX: toNode.x || 0,
            toY: toNode.y || 0,
          });
        }
      });

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Apply easing function
        const easedProgress = this.applyEasing(progress, easing);

        // Update node positions
        fromGraph.nodes.forEach(node => {
          const positions = nodePositions.get(node.id);
          if (positions) {
            node.x = positions.fromX + (positions.toX - positions.fromX) * easedProgress;
            node.y = positions.fromY + (positions.toY - positions.fromY) * easedProgress;
          }
        });

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  private applyEasing(t: number, easing: string): number {
    switch (easing) {
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return 1 - (1 - t) * (1 - t);
      case 'ease-in-out':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      default:
        return t;
    }
  }
}