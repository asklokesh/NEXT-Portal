import type { Entity } from '@/services/backstage/types/entities';
import type {
  DependencyGraph,
  GraphNode,
  GraphEdge,
  RelationshipType,
  GraphAnalytics,
  GraphCluster,
  ImpactAnalysis,
  RiskFactor,
  Vulnerability,
  Optimization,
  Alert,
  GraphMetrics,
  NodeMetrics,
  EdgeMetrics,
  GlobalMetrics,
  HealthCheck,
} from './types';

export class CatalogGraphEngine {
  private entityCache = new Map<string, Entity>();
  private healthCache = new Map<string, HealthCheck>();
  private metricsCache = new Map<string, any>();

  /**
   * Build comprehensive dependency graph from Backstage entities
   */
  async buildGraph(entities: Entity[]): Promise<DependencyGraph> {
    // Update entity cache
    entities.forEach(entity => {
      const id = this.getEntityId(entity);
      this.entityCache.set(id, entity);
    });

    const nodes = await this.buildNodes(entities);
    const edges = await this.buildEdges(entities, nodes);

    // Calculate derived metrics
    await this.calculateMetrics(nodes, edges);
    
    return {
      nodes,
      edges,
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        generatedAt: new Date(),
        version: '1.0.0',
        source: 'backstage-catalog',
      },
    };
  }

  /**
   * Build graph nodes from entities with enriched metadata
   */
  private async buildNodes(entities: Entity[]): Promise<GraphNode[]> {
    const nodes: GraphNode[] = [];

    for (const entity of entities) {
      const id = this.getEntityId(entity);
      const health = await this.getEntityHealth(id);
      const metrics = await this.getEntityMetrics(id);
      
      const node: GraphNode = {
        id,
        name: entity.metadata.name,
        type: entity.kind as any,
        entity,
        
        // Visual properties (will be set by layout algorithms)
        size: this.calculateNodeSize(entity, metrics),
        color: this.getNodeColor(entity),
        group: this.getNodeGroup(entity),
        
        // Metadata
        owner: entity.spec?.owner || 'unknown',
        lifecycle: entity.spec?.lifecycle || 'unknown',
        description: entity.metadata.description,
        tags: entity.metadata.tags || [],
        
        // Health and metrics
        health: health?.score || 80 + Math.random() * 20, // Mock high health for now
        lastUpdated: new Date(entity.metadata.annotations?.['backstage.io/updated'] || Date.now()),
        deploymentFrequency: metrics?.deploymentFrequency || Math.random() * 10,
        mttr: metrics?.mttr || Math.random() * 60,
        changeFailureRate: metrics?.changeFailureRate || Math.random() * 0.1,
        
        // Relationship data (populated later)
        dependencies: [],
        dependents: [],
        provides: [],
        consumes: [],
        
        // Analysis metrics (calculated later)
        impactScore: 0,
        criticalityScore: 0,
        complexityScore: 0,
        stabilityScore: 0,
        isOnCriticalPath: false,
        clusterMembership: [],
      };

      nodes.push(node);
    }

    return nodes;
  }

  /**
   * Build graph edges from entity relationships
   */
  private async buildEdges(entities: Entity[], nodes: GraphNode[]): Promise<GraphEdge[]> {
    const edges: GraphEdge[] = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    for (const entity of entities) {
      const sourceId = this.getEntityId(entity);
      const sourceNode = nodeMap.get(sourceId);
      if (!sourceNode) continue;

      // Process different types of relationships
      await this.processRelationships(entity, sourceNode, nodeMap, edges);
    }

    return edges;
  }

  /**
   * Process various entity relationships and create edges
   */
  private async processRelationships(
    entity: Entity,
    sourceNode: GraphNode,
    nodeMap: Map<string, GraphNode>,
    edges: GraphEdge[]
  ): Promise<void> {
    const sourceId = sourceNode.id;

    // Component dependencies
    if (entity.spec?.dependsOn) {
      const deps = Array.isArray(entity.spec.dependsOn) ? entity.spec.dependsOn : [entity.spec.dependsOn];
      for (const dep of deps) {
        const targetId = this.parseEntityReference(dep);
        const targetNode = nodeMap.get(targetId);
        if (targetNode) {
          const edge = await this.createEdge(sourceId, targetId, 'depends_on');
          edges.push(edge);
          sourceNode.dependencies.push(targetId);
          targetNode.dependents.push(sourceId);
        }
      }
    }

    // API relationships
    if (entity.spec?.providesApis) {
      for (const api of entity.spec.providesApis) {
        const apiId = this.parseEntityReference(api);
        const apiNode = nodeMap.get(apiId);
        if (apiNode) {
          const edge = await this.createEdge(sourceId, apiId, 'provides_api');
          edges.push(edge);
          sourceNode.provides.push(apiId);
        }
      }
    }

    if (entity.spec?.consumesApis) {
      for (const api of entity.spec.consumesApis) {
        const apiId = this.parseEntityReference(api);
        const apiNode = nodeMap.get(apiId);
        if (apiNode) {
          const edge = await this.createEdge(sourceId, apiId, 'consumes_api');
          edges.push(edge);
          sourceNode.consumes.push(apiId);
          sourceNode.dependencies.push(apiId);
          apiNode.dependents.push(sourceId);
        }
      }
    }

    // System relationships
    if (entity.spec?.system) {
      const systemId = this.parseEntityReference(entity.spec.system);
      const systemNode = nodeMap.get(systemId);
      if (systemNode) {
        const edge = await this.createEdge(systemId, sourceId, 'part_of_system');
        edges.push(edge);
      }
    }

    // Resource relationships
    if (entity.kind === 'Component' && entity.spec?.resources) {
      for (const resource of entity.spec.resources) {
        const resourceId = this.parseEntityReference(resource);
        const resourceNode = nodeMap.get(resourceId);
        if (resourceNode) {
          const edge = await this.createEdge(sourceId, resourceId, 'uses_database');
          edges.push(edge);
          sourceNode.dependencies.push(resourceId);
          resourceNode.dependents.push(sourceId);
        }
      }
    }

    // Additional relationships from annotations
    await this.processAnnotationRelationships(entity, sourceNode, nodeMap, edges);
  }

  /**
   * Process relationships from entity annotations
   */
  private async processAnnotationRelationships(
    entity: Entity,
    sourceNode: GraphNode,
    nodeMap: Map<string, GraphNode>,
    edges: GraphEdge[]
  ): Promise<void> {
    const annotations = entity.metadata.annotations || {};
    
    // Service mesh relationships
    if (annotations['servicemesh.io/upstreams']) {
      const upstreams = annotations['servicemesh.io/upstreams'].split(',');
      for (const upstream of upstreams) {
        const targetId = upstream.trim();
        const targetNode = Array.from(nodeMap.values()).find(n => n.name === targetId);
        if (targetNode) {
          const edge = await this.createEdge(sourceNode.id, targetNode.id, 'calls');
          edges.push(edge);
          sourceNode.dependencies.push(targetNode.id);
          targetNode.dependents.push(sourceNode.id);
        }
      }
    }

    // Database relationships
    if (annotations['database.io/connects-to']) {
      const databases = annotations['database.io/connects-to'].split(',');
      for (const db of databases) {
        const dbId = db.trim();
        const dbNode = Array.from(nodeMap.values()).find(n => n.name === dbId);
        if (dbNode) {
          const edge = await this.createEdge(sourceNode.id, dbNode.id, 'uses_database');
          edges.push(edge);
          sourceNode.dependencies.push(dbNode.id);
          dbNode.dependents.push(sourceNode.id);
        }
      }
    }

    // Message queue relationships
    if (annotations['messaging.io/publishes']) {
      const topics = annotations['messaging.io/publishes'].split(',');
      for (const topic of topics) {
        const topicId = topic.trim();
        const topicNode = Array.from(nodeMap.values()).find(n => n.name === topicId);
        if (topicNode) {
          const edge = await this.createEdge(sourceNode.id, topicNode.id, 'publishes_to');
          edges.push(edge);
        }
      }
    }

    if (annotations['messaging.io/subscribes']) {
      const topics = annotations['messaging.io/subscribes'].split(',');
      for (const topic of topics) {
        const topicId = topic.trim();
        const topicNode = Array.from(nodeMap.values()).find(n => n.name === topicId);
        if (topicNode) {
          const edge = await this.createEdge(topicNode.id, sourceNode.id, 'subscribes_to');
          edges.push(edge);
          sourceNode.dependencies.push(topicNode.id);
          topicNode.dependents.push(sourceNode.id);
        }
      }
    }
  }

  /**
   * Create an edge with health and performance metrics
   */
  private async createEdge(sourceId: string, targetId: string, type: RelationshipType): Promise<GraphEdge> {
    const edgeId = `${sourceId}->${targetId}`;
    const health = await this.getEdgeHealth(sourceId, targetId);
    
    return {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type,
      strength: this.calculateEdgeStrength(type),
      color: this.getEdgeColor(type, health?.score || 85),
      width: this.getEdgeWidth(type),
      
      healthScore: health?.score || 85 + Math.random() * 15,
      latency: health?.metrics?.responseTime || Math.random() * 100,
      errorRate: health?.metrics?.errorRate || Math.random() * 0.05,
      throughput: Math.random() * 1000,
      
      animated: ['calls', 'publishes_to', 'subscribes_to'].includes(type),
      bidirectional: type === 'calls',
    };
  }

  /**
   * Calculate comprehensive analytics for the graph
   */
  async analyzeGraph(graph: DependencyGraph): Promise<GraphAnalytics> {
    const analytics: GraphAnalytics = {
      // Basic metrics
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      density: this.calculateDensity(graph),
      avgDegree: this.calculateAverageDegree(graph),
      
      // Structure analysis
      orphanNodes: this.findOrphanNodes(graph),
      circularDependencies: this.findCircularDependencies(graph),
      criticalPaths: this.findCriticalPaths(graph),
      clusters: this.findClusters(graph),
      
      // Node rankings
      mostConnected: this.rankNodesByConnectivity(graph),
      mostCritical: this.rankNodesByCriticality(graph),
      mostUnstable: this.rankNodesByStability(graph),
      
      // Health metrics
      overallHealth: this.calculateOverallHealth(graph),
      healthByTeam: this.calculateHealthByTeam(graph),
      healthBySystem: this.calculateHealthBySystem(graph),
      
      // Risk analysis
      riskFactors: await this.identifyRiskFactors(graph),
      vulnerabilities: await this.identifyVulnerabilities(graph),
      
      // Recommendations
      optimizations: await this.generateOptimizations(graph),
      alerts: await this.generateAlerts(graph),
    };

    return analytics;
  }

  /**
   * Perform impact analysis for a specific node
   */
  async analyzeImpact(graph: DependencyGraph, nodeId: string): Promise<ImpactAnalysis> {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found in graph`);
    }

    const directImpact = this.calculateDirectImpact(graph, nodeId);
    const indirectImpact = this.calculateIndirectImpact(graph, nodeId, directImpact);
    const cascadingFailure = this.analyzeCascadingFailure(graph, nodeId, directImpact, indirectImpact);
    const riskScore = this.calculateRiskScore(node, directImpact, indirectImpact);
    const mitigationStrategies = this.generateMitigationStrategies(graph, nodeId, riskScore);

    return {
      nodeId,
      directImpact,
      indirectImpact,
      cascadingFailure,
      riskScore,
      mitigationStrategies,
    };
  }

  /**
   * Calculate metrics for nodes and edges
   */
  private async calculateMetrics(nodes: GraphNode[], edges: GraphEdge[]): Promise<void> {
    // Build adjacency list for calculations
    const adjacencyList = this.buildAdjacencyList(nodes, edges);
    
    for (const node of nodes) {
      // Calculate centrality metrics
      const metrics = this.calculateNodeCentrality(node, adjacencyList);
      
      // Update node with calculated metrics
      node.impactScore = metrics.betweennessCentrality * 100;
      node.criticalityScore = this.calculateCriticalityScore(node, adjacencyList);
      node.complexityScore = this.calculateComplexityScore(node, adjacencyList);
      node.stabilityScore = node.health * (1 - node.changeFailureRate);
      node.isOnCriticalPath = this.isNodeOnCriticalPath(node, adjacencyList);
    }
  }

  /**
   * Helper methods
   */
  private getEntityId(entity: Entity): string {
    return entity.metadata.uid || `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
  }

  private parseEntityReference(entityRef: string): string {
    // Parse references like "Component:default/my-service" or "my-service"
    const match = entityRef.match(/^(?:([^:]+):)?(?:([^/]+)\/)?(.+)$/);
    if (!match) return entityRef;
    
    const [, kind = 'Component', namespace = 'default', name] = match;
    return `${kind}:${namespace}/${name}`;
  }

  private calculateNodeSize(entity: Entity, metrics: any): number {
    // Base size plus scaling factors
    let size = 20;
    
    if (entity.kind === 'System') size += 15;
    if (entity.kind === 'API') size += 10;
    if (entity.spec?.type === 'service') size += 5;
    
    // Scale by complexity/importance
    if (metrics?.complexity) size += metrics.complexity * 2;
    if (entity.metadata.annotations?.['backstage.io/techdocs-ref']) size += 5;
    
    return Math.min(size, 60);
  }

  private getNodeColor(entity: Entity): string {
    const colorMap = {
      Component: '#3B82F6',
      API: '#10B981',
      Resource: '#F59E0B',
      System: '#8B5CF6',
      Domain: '#EC4899',
      Group: '#6B7280',
    };
    
    return colorMap[entity.kind as keyof typeof colorMap] || '#6B7280';
  }

  private getNodeGroup(entity: Entity): string {
    return entity.spec?.system || entity.spec?.owner || entity.kind;
  }

  private calculateEdgeStrength(type: RelationshipType): number {
    const strengthMap: Record<RelationshipType, number> = {
      depends_on: 1.0,
      provides_api: 0.8,
      consumes_api: 0.9,
      part_of_system: 0.6,
      owns: 0.7,
      deployed_on: 0.5,
      uses_database: 0.8,
      publishes_to: 0.6,
      subscribes_to: 0.6,
      calls: 0.9,
      extends: 0.7,
      implements: 0.7,
    };
    
    return strengthMap[type] || 0.5;
  }

  private getEdgeColor(type: RelationshipType, health: number): string {
    // Base color by type
    const colorMap: Record<RelationshipType, string> = {
      depends_on: '#EF4444',
      provides_api: '#10B981',
      consumes_api: '#3B82F6',
      part_of_system: '#8B5CF6',
      owns: '#EC4899',
      deployed_on: '#F59E0B',
      uses_database: '#F97316',
      publishes_to: '#06B6D4',
      subscribes_to: '#0EA5E9',
      calls: '#6366F1',
      extends: '#84CC16',
      implements: '#22C55E',
    };
    
    let color = colorMap[type] || '#6B7280';
    
    // Adjust opacity based on health
    if (health < 70) {
      color += '80'; // 50% opacity for unhealthy connections
    } else if (health < 90) {
      color += 'CC'; // 80% opacity for degraded connections
    }
    
    return color;
  }

  private getEdgeWidth(type: RelationshipType): number {
    const widthMap: Record<RelationshipType, number> = {
      depends_on: 3,
      provides_api: 2,
      consumes_api: 2,
      part_of_system: 4,
      owns: 2,
      deployed_on: 1,
      uses_database: 2,
      publishes_to: 1,
      subscribes_to: 1,
      calls: 2,
      extends: 1,
      implements: 1,
    };
    
    return widthMap[type] || 1;
  }

  private calculateDensity(graph: DependencyGraph): number {
    const n = graph.nodes.length;
    if (n < 2) return 0;
    
    const maxEdges = n * (n - 1);
    return graph.edges.length / maxEdges;
  }

  private calculateAverageDegree(graph: DependencyGraph): number {
    if (graph.nodes.length === 0) return 0;
    
    const totalDegree = graph.nodes.reduce((sum, node) => {
      return sum + node.dependencies.length + node.dependents.length;
    }, 0);
    
    return totalDegree / graph.nodes.length;
  }

  private findOrphanNodes(graph: DependencyGraph): string[] {
    return graph.nodes
      .filter(node => node.dependencies.length === 0 && node.dependents.length === 0)
      .map(node => node.id);
  }

  private findCircularDependencies(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    // Build adjacency list
    const adjacencyList = new Map<string, string[]>();
    graph.edges.forEach(edge => {
      if (edge.type === 'depends_on') {
        if (!adjacencyList.has(edge.source)) {
          adjacencyList.set(edge.source, []);
        }
        adjacencyList.get(edge.source)!.push(edge.target);
      }
    });
    
    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);
      
      const neighbors = adjacencyList.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            cycles.push(path.slice(cycleStart));
          }
        }
      }
      
      recursionStack.delete(node);
    };
    
    graph.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    });
    
    return cycles;
  }

  private findCriticalPaths(graph: DependencyGraph): string[][] {
    const paths: string[][] = [];
    const criticalNodes = graph.nodes
      .filter(node => node.isOnCriticalPath)
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 10);
    
    for (const node of criticalNodes) {
      const nodePaths = this.findPathsFromNode(graph, node.id, 5);
      paths.push(...nodePaths);
    }
    
    return paths.slice(0, 20); // Return top 20 critical paths
  }

  private findClusters(graph: DependencyGraph): GraphCluster[] {
    const clusters: GraphCluster[] = [];
    
    // Cluster by system
    const systemClusters = this.clusterByProperty(graph, 'system');
    clusters.push(...systemClusters);
    
    // Cluster by owner/team
    const ownerClusters = this.clusterByProperty(graph, 'owner');
    clusters.push(...ownerClusters);
    
    // Cluster by lifecycle
    const lifecycleClusters = this.clusterByProperty(graph, 'lifecycle');
    clusters.push(...lifecycleClusters);
    
    return clusters;
  }

  private clusterByProperty(graph: DependencyGraph, property: string): GraphCluster[] {
    const clusters = new Map<string, string[]>();
    
    graph.nodes.forEach(node => {
      let value: string;
      
      switch (property) {
        case 'system':
          value = node.entity.spec?.system || 'unknown';
          break;
        case 'owner':
          value = node.owner;
          break;
        case 'lifecycle':
          value = node.lifecycle;
          break;
        default:
          value = 'unknown';
      }
      
      if (!clusters.has(value)) {
        clusters.set(value, []);
      }
      clusters.get(value)!.push(node.id);
    });
    
    return Array.from(clusters.entries()).map(([name, nodes]) => ({
      id: `${property}-${name}`,
      name: `${property}: ${name}`,
      type: property as any,
      nodes,
      color: this.generateClusterColor(name),
    }));
  }

  private generateClusterColor(name: string): string {
    // Generate consistent color based on name hash
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 60%)`;
  }

  private rankNodesByConnectivity(graph: DependencyGraph): Array<{ id: string; connections: number }> {
    return graph.nodes
      .map(node => ({
        id: node.id,
        connections: node.dependencies.length + node.dependents.length,
      }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10);
  }

  private rankNodesByCriticality(graph: DependencyGraph): Array<{ id: string; score: number }> {
    return graph.nodes
      .map(node => ({
        id: node.id,
        score: node.criticalityScore,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  private rankNodesByStability(graph: DependencyGraph): Array<{ id: string; score: number }> {
    return graph.nodes
      .map(node => ({
        id: node.id,
        score: 100 - node.stabilityScore, // Lower stability = higher in ranking
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  private calculateOverallHealth(graph: DependencyGraph): number {
    if (graph.nodes.length === 0) return 100;
    
    const totalHealth = graph.nodes.reduce((sum, node) => sum + node.health, 0);
    return totalHealth / graph.nodes.length;
  }

  private calculateHealthByTeam(graph: DependencyGraph): Record<string, number> {
    const teamHealth = new Map<string, { total: number; count: number }>();
    
    graph.nodes.forEach(node => {
      const team = node.owner;
      if (!teamHealth.has(team)) {
        teamHealth.set(team, { total: 0, count: 0 });
      }
      
      const current = teamHealth.get(team)!;
      current.total += node.health;
      current.count++;
    });
    
    const result: Record<string, number> = {};
    teamHealth.forEach((value, team) => {
      result[team] = value.total / value.count;
    });
    
    return result;
  }

  private calculateHealthBySystem(graph: DependencyGraph): Record<string, number> {
    const systemHealth = new Map<string, { total: number; count: number }>();
    
    graph.nodes.forEach(node => {
      const system = node.entity.spec?.system || 'unknown';
      if (!systemHealth.has(system)) {
        systemHealth.set(system, { total: 0, count: 0 });
      }
      
      const current = systemHealth.get(system)!;
      current.total += node.health;
      current.count++;
    });
    
    const result: Record<string, number> = {};
    systemHealth.forEach((value, system) => {
      result[system] = value.total / value.count;
    });
    
    return result;
  }

  // Additional helper methods for calculations
  private async getEntityHealth(entityId: string): Promise<HealthCheck | null> {
    // Mock implementation - in real implementation, fetch from monitoring systems
    return this.healthCache.get(entityId) || null;
  }

  private async getEntityMetrics(entityId: string): Promise<any> {
    // Mock implementation - in real implementation, fetch from metrics systems
    return this.metricsCache.get(entityId) || {};
  }

  private async getEdgeHealth(sourceId: string, targetId: string): Promise<any> {
    // Mock implementation - in real implementation, analyze connection health
    return { score: 85 + Math.random() * 15 };
  }

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

  private calculateNodeCentrality(node: GraphNode, adjacencyList: Map<string, string[]>): any {
    // Simplified centrality calculations
    const degree = (node.dependencies.length + node.dependents.length);
    
    return {
      betweennessCentrality: degree / 100, // Simplified calculation
      closenessCentrality: 1 / (degree + 1),
      eigenvectorCentrality: degree * 0.1,
    };
  }

  private calculateCriticalityScore(node: GraphNode, adjacencyList: Map<string, string[]>): number {
    const baseScore = node.impactScore;
    const healthPenalty = (100 - node.health) * 0.5;
    const dependentBonus = node.dependents.length * 10;
    
    return Math.min(100, baseScore + dependentBonus + healthPenalty);
  }

  private calculateComplexityScore(node: GraphNode, adjacencyList: Map<string, string[]>): number {
    const connectionComplexity = (node.dependencies.length + node.dependents.length) * 5;
    const typeComplexity = node.type === 'System' ? 20 : node.type === 'Component' ? 10 : 5;
    
    return Math.min(100, connectionComplexity + typeComplexity);
  }

  private isNodeOnCriticalPath(node: GraphNode, adjacencyList: Map<string, string[]>): boolean {
    return node.impactScore > 50 || node.dependents.length > 5;
  }

  private findPathsFromNode(graph: DependencyGraph, nodeId: string, maxDepth: number): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();
    
    const dfs = (currentId: string, path: string[], depth: number) => {
      if (depth >= maxDepth || visited.has(currentId)) {
        if (path.length > 1) paths.push([...path]);
        return;
      }
      
      visited.add(currentId);
      const node = graph.nodes.find(n => n.id === currentId);
      
      if (node && node.dependents.length > 0) {
        node.dependents.forEach(depId => {
          dfs(depId, [...path, depId], depth + 1);
        });
      } else if (path.length > 1) {
        paths.push([...path]);
      }
      
      visited.delete(currentId);
    };
    
    dfs(nodeId, [nodeId], 0);
    return paths;
  }

  private calculateDirectImpact(graph: DependencyGraph, nodeId: string): { upstream: string[]; downstream: string[] } {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) return { upstream: [], downstream: [] };
    
    return {
      upstream: [...node.dependencies],
      downstream: [...node.dependents],
    };
  }

  private calculateIndirectImpact(
    graph: DependencyGraph, 
    nodeId: string, 
    directImpact: { upstream: string[]; downstream: string[] }
  ): { upstream: string[]; downstream: string[] } {
    const visited = new Set([nodeId, ...directImpact.upstream, ...directImpact.downstream]);
    const indirectUpstream: string[] = [];
    const indirectDownstream: string[] = [];
    
    // BFS for indirect upstream dependencies
    let queue = [...directImpact.upstream];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentNode = graph.nodes.find(n => n.id === currentId);
      
      if (currentNode) {
        currentNode.dependencies.forEach(depId => {
          if (!visited.has(depId)) {
            visited.add(depId);
            indirectUpstream.push(depId);
            queue.push(depId);
          }
        });
      }
    }
    
    // BFS for indirect downstream dependents
    queue = [...directImpact.downstream];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const currentNode = graph.nodes.find(n => n.id === currentId);
      
      if (currentNode) {
        currentNode.dependents.forEach(depId => {
          if (!visited.has(depId)) {
            visited.add(depId);
            indirectDownstream.push(depId);
            queue.push(depId);
          }
        });
      }
    }
    
    return {
      upstream: indirectUpstream,
      downstream: indirectDownstream,
    };
  }

  private analyzeCascadingFailure(
    graph: DependencyGraph, 
    nodeId: string,
    directImpact: { upstream: string[]; downstream: string[] },
    indirectImpact: { upstream: string[]; downstream: string[] }
  ): any {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) {
      return {
        probability: 0,
        affectedServices: [],
        estimatedDowntime: 0,
        businessImpact: 'low',
      };
    }
    
    const totalAffected = directImpact.downstream.length + indirectImpact.downstream.length;
    const probability = Math.min(0.9, (100 - node.health) / 100 + (totalAffected * 0.1));
    
    return {
      probability,
      affectedServices: [...directImpact.downstream, ...indirectImpact.downstream],
      estimatedDowntime: Math.round(totalAffected * 10 * (100 - node.health) / 100),
      businessImpact: totalAffected > 10 ? 'critical' : totalAffected > 5 ? 'high' : totalAffected > 2 ? 'medium' : 'low',
    };
  }

  private calculateRiskScore(
    node: GraphNode,
    directImpact: { upstream: string[]; downstream: string[] },
    indirectImpact: { upstream: string[]; downstream: string[] }
  ): number {
    const healthRisk = (100 - node.health) * 0.3;
    const impactRisk = (directImpact.downstream.length + indirectImpact.downstream.length) * 5;
    const criticalityRisk = node.isOnCriticalPath ? 20 : 0;
    const complexityRisk = node.complexityScore * 0.2;
    
    return Math.min(100, Math.round(healthRisk + impactRisk + criticalityRisk + complexityRisk));
  }

  private generateMitigationStrategies(graph: DependencyGraph, nodeId: string, riskScore: number): string[] {
    const strategies: string[] = [];
    const node = graph.nodes.find(n => n.id === nodeId);
    
    if (!node) return strategies;
    
    if (riskScore > 70) {
      strategies.push('Implement circuit breaker pattern for critical dependencies');
      strategies.push('Set up automated failover mechanisms');
      strategies.push('Increase monitoring and alerting frequency');
    }
    
    if (node.health < 80) {
      strategies.push('Improve service health through performance optimization');
      strategies.push('Implement comprehensive health checks');
    }
    
    if (node.dependents.length > 10) {
      strategies.push('Consider breaking down the service into smaller components');
      strategies.push('Implement load balancing and redundancy');
    }
    
    if (node.isOnCriticalPath) {
      strategies.push('Create redundant service instances');
      strategies.push('Implement graceful degradation patterns');
    }
    
    return strategies;
  }

  // Stub implementations for complex analysis methods
  private async identifyRiskFactors(graph: DependencyGraph): Promise<RiskFactor[]> {
    // Implementation would analyze the graph for various risk patterns
    return [];
  }

  private async identifyVulnerabilities(graph: DependencyGraph): Promise<Vulnerability[]> {
    // Implementation would check for security vulnerabilities
    return [];
  }

  private async generateOptimizations(graph: DependencyGraph): Promise<Optimization[]> {
    // Implementation would suggest architectural improvements
    return [];
  }

  private async generateAlerts(graph: DependencyGraph): Promise<Alert[]> {
    // Implementation would generate actionable alerts
    return [];
  }
}