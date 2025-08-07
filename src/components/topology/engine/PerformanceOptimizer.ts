/**
 * Performance Optimizer for Service Topology Visualization
 * 
 * Implements various performance optimization techniques including:
 * - Virtualization and viewport-based rendering
 * - Level-of-detail (LOD) rendering
 * - Node clustering
 * - Smart caching strategies
 * - WebGL acceleration support
 */

import {
  ServiceTopologyNode,
  ServiceTopologyEdge,
  PerformanceConfig,
  ViewportBounds,
  ClusterConfig
} from '../types';

// =============================================
// PERFORMANCE OPTIMIZATION INTERFACES
// =============================================

interface OptimizationResult<T> {
  items: T[];
  clusters?: ClusterNode[];
  metadata: {
    originalCount: number;
    optimizedCount: number;
    clusterCount: number;
    processingTime: number;
  };
}

interface ClusterNode {
  id: string;
  type: 'cluster';
  position: { x: number; y: number };
  data: {
    nodeCount: number;
    memberIds: string[];
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
    averageHealth: number;
    dominantType: string;
    label: string;
  };
}

interface QuadTreeNode {
  bounds: { x: number; y: number; width: number; height: number };
  nodes: ServiceTopologyNode[];
  children?: QuadTreeNode[];
  isLeaf: boolean;
}

interface LevelOfDetail {
  level: number;
  minZoom: number;
  maxZoom: number;
  nodeSize: number;
  showLabels: boolean;
  showMetrics: boolean;
  showHealth: boolean;
  edgeThickness: number;
}

// =============================================
// PERFORMANCE OPTIMIZER CLASS
// =============================================

export class PerformanceOptimizer {
  private config: PerformanceConfig;
  private quadTree?: QuadTreeNode;
  private nodeCache: Map<string, ServiceTopologyNode>;
  private edgeCache: Map<string, ServiceTopologyEdge>;
  private clusterCache: Map<string, ClusterNode[]>;
  private lodLevels: LevelOfDetail[];
  
  constructor(config: PerformanceConfig) {
    this.config = config;
    this.nodeCache = new Map();
    this.edgeCache = new Map();
    this.clusterCache = new Map();
    
    // Initialize Level of Detail configurations
    this.lodLevels = [
      {
        level: 0, // High detail
        minZoom: 1.0,
        maxZoom: 4.0,
        nodeSize: 1.0,
        showLabels: true,
        showMetrics: true,
        showHealth: true,
        edgeThickness: 1.0
      },
      {
        level: 1, // Medium detail
        minZoom: 0.5,
        maxZoom: 1.0,
        nodeSize: 0.8,
        showLabels: true,
        showMetrics: false,
        showHealth: true,
        edgeThickness: 0.8
      },
      {
        level: 2, // Low detail
        minZoom: 0.1,
        maxZoom: 0.5,
        nodeSize: 0.6,
        showLabels: false,
        showMetrics: false,
        showHealth: false,
        edgeThickness: 0.5
      }
    ];
  }
  
  // =============================================
  // NODE OPTIMIZATION
  // =============================================
  
  public optimizeNodes(
    nodes: ServiceTopologyNode[],
    viewport: ViewportBounds
  ): ServiceTopologyNode[] {
    const startTime = performance.now();
    
    let optimizedNodes = nodes;
    
    // Apply virtualization if enabled
    if (this.config.virtualization) {
      optimizedNodes = this.applyVirtualization(optimizedNodes, viewport);
    }
    
    // Apply clustering if needed
    if (this.shouldCluster(optimizedNodes.length)) {
      const clustered = this.clusterNodes(optimizedNodes, viewport);
      return this.convertClustersToNodes(clustered.clusters || [], clustered.items);
    }
    
    // Apply Level of Detail
    if (this.config.lodEnabled) {
      optimizedNodes = this.applyLevelOfDetail(optimizedNodes, viewport.zoom);
    }
    
    const processingTime = performance.now() - startTime;
    
    // Update cache
    optimizedNodes.forEach(node => {
      this.nodeCache.set(node.id, node);
    });
    
    console.debug(`Node optimization completed in ${processingTime.toFixed(2)}ms`);
    
    return optimizedNodes;
  }
  
  private applyVirtualization(
    nodes: ServiceTopologyNode[],
    viewport: ViewportBounds
  ): ServiceTopologyNode[] {
    if (!this.config.virtualization) return nodes;
    
    // Build or update quad tree
    this.buildQuadTree(nodes, viewport);
    
    // Get visible nodes from quad tree
    const visibleNodes = this.getVisibleNodes(viewport);
    
    // If too many visible nodes, prioritize by importance
    if (visibleNodes.length > this.config.maxVisibleNodes) {
      return this.prioritizeNodes(visibleNodes, this.config.maxVisibleNodes);
    }
    
    return visibleNodes;
  }
  
  private buildQuadTree(nodes: ServiceTopologyNode[], viewport: ViewportBounds): void {
    const bounds = {
      x: viewport.x - viewport.width * 0.5,
      y: viewport.y - viewport.height * 0.5,
      width: viewport.width * 2,
      height: viewport.height * 2
    };
    
    this.quadTree = this.createQuadTreeNode(bounds, nodes);
    this.subdivideQuadTree(this.quadTree);
  }
  
  private createQuadTreeNode(
    bounds: { x: number; y: number; width: number; height: number },
    nodes: ServiceTopologyNode[]
  ): QuadTreeNode {
    return {
      bounds,
      nodes: nodes.filter(node => this.isNodeInBounds(node, bounds)),
      isLeaf: true
    };
  }
  
  private subdivideQuadTree(node: QuadTreeNode, depth: number = 0): void {
    if (node.nodes.length <= 10 || depth >= 6) return; // Max depth or min nodes
    
    const { x, y, width, height } = node.bounds;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    
    // Create four children
    node.children = [
      this.createQuadTreeNode({ x, y, width: halfWidth, height: halfHeight }, node.nodes),
      this.createQuadTreeNode({ x: x + halfWidth, y, width: halfWidth, height: halfHeight }, node.nodes),
      this.createQuadTreeNode({ x, y: y + halfHeight, width: halfWidth, height: halfHeight }, node.nodes),
      this.createQuadTreeNode({ x: x + halfWidth, y: y + halfHeight, width: halfWidth, height: halfHeight }, node.nodes)
    ];
    
    node.isLeaf = false;
    node.nodes = []; // Clear nodes from parent
    
    // Recursively subdivide children
    node.children.forEach(child => this.subdivideQuadTree(child, depth + 1));
  }
  
  private getVisibleNodes(viewport: ViewportBounds): ServiceTopologyNode[] {
    if (!this.quadTree) return [];
    
    const viewportBounds = {
      x: viewport.x - viewport.width / (2 * viewport.zoom),
      y: viewport.y - viewport.height / (2 * viewport.zoom),
      width: viewport.width / viewport.zoom,
      height: viewport.height / viewport.zoom
    };
    
    const visibleNodes: ServiceTopologyNode[] = [];
    this.collectVisibleNodes(this.quadTree, viewportBounds, visibleNodes);
    
    return visibleNodes;
  }
  
  private collectVisibleNodes(
    node: QuadTreeNode,
    viewport: { x: number; y: number; width: number; height: number },
    result: ServiceTopologyNode[]
  ): void {
    // Check if node bounds intersect with viewport
    if (!this.boundsIntersect(node.bounds, viewport)) {
      return;
    }
    
    if (node.isLeaf) {
      result.push(...node.nodes);
    } else if (node.children) {
      node.children.forEach(child => 
        this.collectVisibleNodes(child, viewport, result)
      );
    }
  }
  
  private isNodeInBounds(
    node: ServiceTopologyNode,
    bounds: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      node.position.x >= bounds.x &&
      node.position.x <= bounds.x + bounds.width &&
      node.position.y >= bounds.y &&
      node.position.y <= bounds.y + bounds.height
    );
  }
  
  private boundsIntersect(
    bounds1: { x: number; y: number; width: number; height: number },
    bounds2: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      bounds1.x < bounds2.x + bounds2.width &&
      bounds1.x + bounds1.width > bounds2.x &&
      bounds1.y < bounds2.y + bounds2.height &&
      bounds1.y + bounds1.height > bounds2.y
    );
  }
  
  private prioritizeNodes(
    nodes: ServiceTopologyNode[],
    maxCount: number
  ): ServiceTopologyNode[] {
    // Sort by importance score
    const scored = nodes.map(node => ({
      node,
      score: this.calculateImportanceScore(node)
    }));
    
    scored.sort((a, b) => b.score - a.score);
    
    return scored.slice(0, maxCount).map(item => item.node);
  }
  
  private calculateImportanceScore(node: ServiceTopologyNode): number {
    let score = 0;
    
    // Criticality weight (40%)
    const criticalityScores = {
      'critical': 100,
      'high': 75,
      'medium': 50,
      'low': 25
    };
    score += (criticalityScores[node.data.criticality] || 0) * 0.4;
    
    // Health weight (20%)
    score += node.data.health.score * 0.2;
    
    // Connection count weight (25%)
    const connections = node.data.relationships.length;
    score += Math.min(connections * 10, 100) * 0.25;
    
    // Focus state weight (15%)
    if (node.data.focused) score += 100 * 0.15;
    if (node.data.selected) score += 50 * 0.15;
    
    return score;
  }
  
  // =============================================
  // CLUSTERING OPTIMIZATION
  // =============================================
  
  private shouldCluster(nodeCount: number): boolean {
    return nodeCount > this.config.clusteringThreshold;
  }
  
  private clusterNodes(
    nodes: ServiceTopologyNode[],
    viewport: ViewportBounds
  ): OptimizationResult<ServiceTopologyNode> {
    const startTime = performance.now();
    const cacheKey = this.generateClusterCacheKey(nodes, viewport);
    
    // Check cache
    if (this.clusterCache.has(cacheKey)) {
      const cached = this.clusterCache.get(cacheKey)!;
      return {
        items: [],
        clusters: cached,
        metadata: {
          originalCount: nodes.length,
          optimizedCount: cached.length,
          clusterCount: cached.length,
          processingTime: 0
        }
      };
    }
    
    const clusters = this.performClustering(nodes, viewport);
    const processingTime = performance.now() - startTime;
    
    // Cache result
    this.clusterCache.set(cacheKey, clusters);
    
    return {
      items: [],
      clusters,
      metadata: {
        originalCount: nodes.length,
        optimizedCount: clusters.length,
        clusterCount: clusters.length,
        processingTime
      }
    };
  }
  
  private performClustering(
    nodes: ServiceTopologyNode[],
    viewport: ViewportBounds
  ): ClusterNode[] {
    // Use k-means clustering based on position and type
    const clusters: ClusterNode[] = [];
    
    // Group nodes by type first
    const typeGroups = this.groupNodesByType(nodes);
    
    Object.entries(typeGroups).forEach(([type, typeNodes]) => {
      if (typeNodes.length <= 3) {
        // Don't cluster small groups
        return;
      }
      
      const typeClusters = this.kMeansCluster(typeNodes, Math.ceil(typeNodes.length / 5));
      clusters.push(...typeClusters.map(cluster => this.createClusterNode(cluster, type)));
    });
    
    return clusters;
  }
  
  private groupNodesByType(nodes: ServiceTopologyNode[]): Record<string, ServiceTopologyNode[]> {
    const groups: Record<string, ServiceTopologyNode[]> = {};
    
    nodes.forEach(node => {
      if (!groups[node.type]) {
        groups[node.type] = [];
      }
      groups[node.type].push(node);
    });
    
    return groups;
  }
  
  private kMeansCluster(nodes: ServiceTopologyNode[], k: number): ServiceTopologyNode[][] {
    if (nodes.length <= k) {
      return nodes.map(node => [node]);
    }
    
    // Initialize centroids randomly
    let centroids = this.initializeCentroids(nodes, k);
    let clusters: ServiceTopologyNode[][] = [];
    let previousCentroids: { x: number; y: number }[] = [];
    
    const maxIterations = 20;
    let iteration = 0;
    
    while (iteration < maxIterations && !this.centroidsConverged(centroids, previousCentroids)) {
      previousCentroids = [...centroids];
      
      // Assign nodes to closest centroids
      clusters = new Array(k).fill(null).map(() => []);
      
      nodes.forEach(node => {
        const closestCentroidIndex = this.findClosestCentroid(node.position, centroids);
        clusters[closestCentroidIndex].push(node);
      });
      
      // Update centroids
      centroids = clusters.map(cluster => {
        if (cluster.length === 0) return { x: 0, y: 0 };
        
        const avgX = cluster.reduce((sum, node) => sum + node.position.x, 0) / cluster.length;
        const avgY = cluster.reduce((sum, node) => sum + node.position.y, 0) / cluster.length;
        
        return { x: avgX, y: avgY };
      });
      
      iteration++;
    }
    
    return clusters.filter(cluster => cluster.length > 0);
  }
  
  private initializeCentroids(nodes: ServiceTopologyNode[], k: number): { x: number; y: number }[] {
    const centroids: { x: number; y: number }[] = [];
    
    // Use k-means++ initialization for better results
    if (nodes.length === 0) return centroids;
    
    // First centroid is random
    const firstNode = nodes[Math.floor(Math.random() * nodes.length)];
    centroids.push({ x: firstNode.position.x, y: firstNode.position.y });
    
    // Subsequent centroids favor distant points
    for (let i = 1; i < k; i++) {
      const distances = nodes.map(node => {
        const minDist = Math.min(...centroids.map(centroid =>
          this.distance(node.position, centroid)
        ));
        return minDist * minDist;
      });
      
      const totalDistance = distances.reduce((sum, dist) => sum + dist, 0);
      const threshold = Math.random() * totalDistance;
      
      let cumulative = 0;
      for (let j = 0; j < nodes.length; j++) {
        cumulative += distances[j];
        if (cumulative >= threshold) {
          centroids.push({ x: nodes[j].position.x, y: nodes[j].position.y });
          break;
        }
      }
    }
    
    return centroids;
  }
  
  private findClosestCentroid(
    position: { x: number; y: number },
    centroids: { x: number; y: number }[]
  ): number {
    let minDistance = Infinity;
    let closestIndex = 0;
    
    centroids.forEach((centroid, index) => {
      const dist = this.distance(position, centroid);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = index;
      }
    });
    
    return closestIndex;
  }
  
  private centroidsConverged(
    current: { x: number; y: number }[],
    previous: { x: number; y: number }[]
  ): boolean {
    if (current.length !== previous.length) return false;
    
    const threshold = 1.0; // Convergence threshold
    
    return current.every((centroid, index) => {
      if (!previous[index]) return false;
      return this.distance(centroid, previous[index]) < threshold;
    });
  }
  
  private distance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  private createClusterNode(cluster: ServiceTopologyNode[], dominantType: string): ClusterNode {
    const bounds = this.calculateClusterBounds(cluster);
    const center = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2
    };
    
    const averageHealth = cluster.reduce((sum, node) => sum + node.data.health.score, 0) / cluster.length;
    
    return {
      id: `cluster-${Date.now()}-${Math.random()}`,
      type: 'cluster',
      position: center,
      data: {
        nodeCount: cluster.length,
        memberIds: cluster.map(node => node.id),
        bounds,
        averageHealth,
        dominantType,
        label: `${dominantType} (${cluster.length})`
      }
    };
  }
  
  private calculateClusterBounds(
    cluster: ServiceTopologyNode[]
  ): { minX: number; minY: number; maxX: number; maxY: number } {
    if (cluster.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    
    let minX = cluster[0].position.x;
    let minY = cluster[0].position.y;
    let maxX = cluster[0].position.x;
    let maxY = cluster[0].position.y;
    
    cluster.forEach(node => {
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x);
      maxY = Math.max(maxY, node.position.y);
    });
    
    return { minX, minY, maxX, maxY };
  }
  
  private convertClustersToNodes(
    clusters: ClusterNode[],
    remainingNodes: ServiceTopologyNode[]
  ): ServiceTopologyNode[] {
    const clusterNodes: ServiceTopologyNode[] = clusters.map(cluster => ({
      id: cluster.id,
      type: 'group', // Use group type for clusters
      position: cluster.position,
      data: {
        entity: {} as any, // Placeholder entity
        label: cluster.data.label,
        kind: 'Cluster',
        namespace: 'system',
        name: cluster.id,
        title: `${cluster.data.dominantType} Cluster`,
        description: `Cluster containing ${cluster.data.nodeCount} ${cluster.data.dominantType} services`,
        color: '#EC4899',
        icon: 'package',
        size: 'large',
        shape: 'hexagon',
        health: {
          status: cluster.data.averageHealth > 80 ? 'healthy' : 
                 cluster.data.averageHealth > 60 ? 'degraded' : 'unhealthy',
          score: cluster.data.averageHealth,
          checks: [],
          lastCheck: new Date(),
          trends: []
        },
        status: {
          deployment: 'deployed',
          version: '1.0.0',
          environment: 'production'
        },
        lastUpdated: new Date(),
        metrics: {
          cpu: { current: 0, average: 0, peak: 0, unit: '%', trend: 'stable', history: [] },
          memory: { current: 0, average: 0, peak: 0, unit: 'MB', trend: 'stable', history: [] },
          disk: { current: 0, average: 0, peak: 0, unit: 'GB', trend: 'stable', history: [] },
          network: { inbound: { current: 0, average: 0, peak: 0, unit: 'Mbps', trend: 'stable', history: [] }, 
                    outbound: { current: 0, average: 0, peak: 0, unit: 'Mbps', trend: 'stable', history: [] }, 
                    connections: 0 },
          requests: { rps: 0, p50: 0, p95: 0, p99: 0, totalRequests: 0 },
          errors: { rate: 0, count: 0, by4xx: 0, by5xx: 0, topErrors: [] },
          custom: {}
        },
        relationships: [],
        layer: 'application' as any,
        owner: 'system',
        team: 'platform',
        tags: ['cluster', cluster.data.dominantType],
        criticality: 'medium',
        lifecycle: 'production',
        focused: false,
        selected: false,
        highlighted: false,
        collapsed: true,
        customProperties: {
          memberIds: cluster.data.memberIds,
          memberCount: cluster.data.nodeCount,
          clusterType: cluster.data.dominantType,
          bounds: cluster.data.bounds
        }
      }
    }));
    
    return [...clusterNodes, ...remainingNodes];
  }
  
  // =============================================
  // EDGE OPTIMIZATION
  // =============================================
  
  public optimizeEdges(
    edges: ServiceTopologyEdge[],
    viewport: ViewportBounds
  ): ServiceTopologyEdge[] {
    const startTime = performance.now();
    
    // Apply viewport culling for edges
    let optimizedEdges = this.config.virtualization ? 
      this.cullEdgesByViewport(edges, viewport) : edges;
    
    // Apply edge bundling for dense connections
    if (optimizedEdges.length > 100) {
      optimizedEdges = this.bundleEdges(optimizedEdges);
    }
    
    // Apply LOD for edges
    if (this.config.lodEnabled) {
      optimizedEdges = this.applyEdgeLOD(optimizedEdges, viewport.zoom);
    }
    
    const processingTime = performance.now() - startTime;
    console.debug(`Edge optimization completed in ${processingTime.toFixed(2)}ms`);
    
    return optimizedEdges;
  }
  
  private cullEdgesByViewport(
    edges: ServiceTopologyEdge[],
    viewport: ViewportBounds
  ): ServiceTopologyEdge[] {
    // For now, return all edges. In a real implementation,
    // you'd check if edge endpoints are in viewport
    return edges;
  }
  
  private bundleEdges(edges: ServiceTopologyEdge[]): ServiceTopologyEdge[] {
    // Simple edge bundling - group parallel edges
    const bundled: ServiceTopologyEdge[] = [];
    const processed = new Set<string>();
    
    edges.forEach(edge => {
      if (processed.has(edge.id)) return;
      
      // Find parallel edges
      const parallel = edges.filter(e => 
        !processed.has(e.id) &&
        ((e.source === edge.source && e.target === edge.target) ||
         (e.source === edge.target && e.target === edge.source))
      );
      
      if (parallel.length > 1) {
        // Create bundled edge
        const bundledEdge: ServiceTopologyEdge = {
          ...edge,
          id: `bundle-${edge.source}-${edge.target}`,
          data: {
            ...edge.data,
            label: `${parallel.length} connections`,
            thickness: Math.min(parallel.length, 5)
          }
        };
        bundled.push(bundledEdge);
        
        // Mark all parallel edges as processed
        parallel.forEach(e => processed.add(e.id));
      } else {
        bundled.push(edge);
        processed.add(edge.id);
      }
    });
    
    return bundled;
  }
  
  private applyEdgeLOD(
    edges: ServiceTopologyEdge[],
    zoom: number
  ): ServiceTopologyEdge[] {
    const lod = this.getLODLevel(zoom);
    
    return edges.map(edge => ({
      ...edge,
      style: {
        ...edge.style,
        strokeWidth: (edge.data.thickness || 2) * lod.edgeThickness
      }
    }));
  }
  
  // =============================================
  // LEVEL OF DETAIL
  // =============================================
  
  private applyLevelOfDetail(
    nodes: ServiceTopologyNode[],
    zoom: number
  ): ServiceTopologyNode[] {
    const lod = this.getLODLevel(zoom);
    
    return nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        // Adjust node properties based on LOD
        size: this.adjustNodeSize(node.data.size, lod.nodeSize)
      }
    }));
  }
  
  private getLODLevel(zoom: number): LevelOfDetail {
    for (const lod of this.lodLevels) {
      if (zoom >= lod.minZoom && zoom <= lod.maxZoom) {
        return lod;
      }
    }
    return this.lodLevels[this.lodLevels.length - 1]; // Default to lowest detail
  }
  
  private adjustNodeSize(
    currentSize: 'small' | 'medium' | 'large',
    lodMultiplier: number
  ): 'small' | 'medium' | 'large' {
    const sizeMap = { small: 0.5, medium: 1.0, large: 1.5 };
    const adjustedValue = sizeMap[currentSize] * lodMultiplier;
    
    if (adjustedValue <= 0.6) return 'small';
    if (adjustedValue <= 1.2) return 'medium';
    return 'large';
  }
  
  // =============================================
  // CACHING AND CLEANUP
  // =============================================
  
  private generateClusterCacheKey(
    nodes: ServiceTopologyNode[],
    viewport: ViewportBounds
  ): string {
    const nodeIds = nodes.map(n => n.id).sort().join(',');
    const viewportKey = `${viewport.x}-${viewport.y}-${viewport.zoom}`;
    return `${nodeIds}-${viewportKey}`;
  }
  
  public clearCache(): void {
    this.nodeCache.clear();
    this.edgeCache.clear();
    this.clusterCache.clear();
  }
  
  public getCacheStats(): {
    nodes: number;
    edges: number;
    clusters: number;
    totalMemoryEstimate: number;
  } {
    const nodeMemory = this.nodeCache.size * 2; // KB estimate
    const edgeMemory = this.edgeCache.size * 1; // KB estimate
    const clusterMemory = this.clusterCache.size * 5; // KB estimate
    
    return {
      nodes: this.nodeCache.size,
      edges: this.edgeCache.size,
      clusters: this.clusterCache.size,
      totalMemoryEstimate: nodeMemory + edgeMemory + clusterMemory
    };
  }
  
  public updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Clear caches when config changes
    this.clearCache();
  }
  
  // =============================================
  // PERFORMANCE MONITORING
  // =============================================
  
  public getPerformanceMetrics(): {
    renderTime: number;
    nodeCount: number;
    edgeCount: number;
    memoryUsage: number;
    fps: number;
  } {
    // In a real implementation, you'd collect actual performance metrics
    return {
      renderTime: 0,
      nodeCount: this.nodeCache.size,
      edgeCount: this.edgeCache.size,
      memoryUsage: this.getCacheStats().totalMemoryEstimate,
      fps: 60 // Placeholder
    };
  }
}