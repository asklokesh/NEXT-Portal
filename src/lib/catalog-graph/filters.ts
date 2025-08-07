import type { 
  DependencyGraph, 
  GraphNode, 
  GraphEdge, 
  GraphFilter, 
  RelationshipType,
  GraphExportOptions,
} from './types';

export class GraphFilterEngine {
  /**
   * Apply comprehensive filtering to the graph
   */
  applyFilter(graph: DependencyGraph, filter: GraphFilter): DependencyGraph {
    let filteredNodes = [...graph.nodes];
    let filteredEdges = [...graph.edges];

    // Filter by node types
    if (filter.nodeTypes.length > 0) {
      filteredNodes = filteredNodes.filter(node => 
        filter.nodeTypes.includes(node.type)
      );
    }

    // Filter by owners
    if (filter.owners.length > 0) {
      filteredNodes = filteredNodes.filter(node =>
        filter.owners.includes(node.owner) || 
        filter.owners.some(owner => owner === 'unknown' && !node.owner)
      );
    }

    // Filter by systems
    if (filter.systems.length > 0) {
      filteredNodes = filteredNodes.filter(node =>
        filter.systems.includes(node.entity.spec?.system || 'unknown')
      );
    }

    // Filter by lifecycle stages
    if (filter.lifecycles.length > 0) {
      filteredNodes = filteredNodes.filter(node =>
        filter.lifecycles.includes(node.lifecycle)
      );
    }

    // Filter by health range
    filteredNodes = filteredNodes.filter(node =>
      node.health >= filter.healthRange.min && node.health <= filter.healthRange.max
    );

    // Filter by search query
    if (filter.searchQuery.trim()) {
      const query = filter.searchQuery.toLowerCase().trim();
      filteredNodes = filteredNodes.filter(node =>
        node.name.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query) ||
        node.owner.toLowerCase().includes(query) ||
        (node.description && node.description.toLowerCase().includes(query)) ||
        node.tags.some(tag => tag.toLowerCase().includes(query)) ||
        (node.entity.spec?.system && node.entity.spec.system.toLowerCase().includes(query))
      );
    }

    // Focus on specific node and its neighborhood
    if (filter.focusNode) {
      const focusedNodes = this.getNeighborhood(
        graph, 
        filter.focusNode, 
        filter.maxDepth || 2
      );
      filteredNodes = filteredNodes.filter(node => 
        focusedNodes.has(node.id)
      );
    }

    // Filter orphan nodes
    if (!filter.showOrphans) {
      const connectedNodeIds = new Set<string>();
      graph.edges.forEach(edge => {
        connectedNodeIds.add(edge.source);
        connectedNodeIds.add(edge.target);
      });
      
      filteredNodes = filteredNodes.filter(node =>
        connectedNodeIds.has(node.id)
      );
    }

    // Filter edges based on remaining nodes and edge types
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = filteredEdges.filter(edge =>
      nodeIds.has(edge.source) && 
      nodeIds.has(edge.target) &&
      (filter.edgeTypes.length === 0 || filter.edgeTypes.includes(edge.type))
    );

    return {
      ...graph,
      nodes: filteredNodes,
      edges: filteredEdges,
      metadata: {
        ...graph.metadata,
        totalNodes: filteredNodes.length,
        totalEdges: filteredEdges.length,
      },
    };
  }

  /**
   * Get neighborhood of nodes around a focus node
   */
  private getNeighborhood(
    graph: DependencyGraph, 
    focusNodeId: string, 
    depth: number
  ): Set<string> {
    const neighborhood = new Set<string>();
    const queue: Array<{ id: string; distance: number }> = [{ id: focusNodeId, distance: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { id, distance } = queue.shift()!;
      
      if (visited.has(id) || distance > depth) continue;
      
      visited.add(id);
      neighborhood.add(id);

      if (distance < depth) {
        // Add connected nodes
        graph.edges.forEach(edge => {
          if (edge.source === id && !visited.has(edge.target)) {
            queue.push({ id: edge.target, distance: distance + 1 });
          }
          if (edge.target === id && !visited.has(edge.source)) {
            queue.push({ id: edge.source, distance: distance + 1 });
          }
        });
      }
    }

    return neighborhood;
  }

  /**
   * Create smart filters based on graph analysis
   */
  generateSmartFilters(graph: DependencyGraph): Array<{
    name: string;
    description: string;
    filter: Partial<GraphFilter>;
    count: number;
  }> {
    const filters: Array<{
      name: string;
      description: string;
      filter: Partial<GraphFilter>;
      count: number;
    }> = [];

    // Critical services filter
    const criticalNodes = graph.nodes.filter(node => 
      node.isOnCriticalPath || node.criticalityScore > 70
    );
    if (criticalNodes.length > 0) {
      filters.push({
        name: 'Critical Services',
        description: 'Services on critical paths or with high impact scores',
        filter: {
          focusNode: undefined,
          searchQuery: '',
          nodeTypes: [],
          healthRange: { min: 0, max: 100 },
        },
        count: criticalNodes.length,
      });
    }

    // Unhealthy services filter
    const unhealthyNodes = graph.nodes.filter(node => node.health < 70);
    if (unhealthyNodes.length > 0) {
      filters.push({
        name: 'Unhealthy Services',
        description: 'Services with health score below 70%',
        filter: {
          healthRange: { min: 0, max: 69 },
        },
        count: unhealthyNodes.length,
      });
    }

    // Orphaned services filter
    const orphanedNodes = graph.nodes.filter(node => 
      node.dependencies.length === 0 && node.dependents.length === 0
    );
    if (orphanedNodes.length > 0) {
      filters.push({
        name: 'Orphaned Services',
        description: 'Services with no dependencies or dependents',
        filter: {
          showOrphans: true,
        },
        count: orphanedNodes.length,
      });
    }

    // High-complexity services filter
    const complexNodes = graph.nodes.filter(node => 
      node.complexityScore > 70
    );
    if (complexNodes.length > 0) {
      filters.push({
        name: 'Complex Services',
        description: 'Services with high complexity scores',
        filter: {
          searchQuery: '',
        },
        count: complexNodes.length,
      });
    }

    // By system filters
    const systemCounts = new Map<string, number>();
    graph.nodes.forEach(node => {
      const system = node.entity.spec?.system || 'unknown';
      systemCounts.set(system, (systemCounts.get(system) || 0) + 1);
    });

    Array.from(systemCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([system, count]) => {
        filters.push({
          name: `${system} System`,
          description: `Services belonging to ${system} system`,
          filter: {
            systems: [system],
          },
          count,
        });
      });

    // By owner filters
    const ownerCounts = new Map<string, number>();
    graph.nodes.forEach(node => {
      ownerCounts.set(node.owner, (ownerCounts.get(node.owner) || 0) + 1);
    });

    Array.from(ownerCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([owner, count]) => {
        if (owner !== 'unknown') {
          filters.push({
            name: `${owner} Team`,
            description: `Services owned by ${owner}`,
            filter: {
              owners: [owner],
            },
            count,
          });
        }
      });

    return filters;
  }

  /**
   * Advanced search with natural language queries
   */
  performAdvancedSearch(graph: DependencyGraph, query: string): {
    nodes: GraphNode[];
    explanation: string;
  } {
    const normalizedQuery = query.toLowerCase().trim();
    let matchedNodes: GraphNode[] = [];
    let explanation = '';

    // Pattern matching for different query types
    if (normalizedQuery.includes('unhealthy') || normalizedQuery.includes('health < ')) {
      const healthMatch = normalizedQuery.match(/health\s*<\s*(\d+)/);
      const threshold = healthMatch ? parseInt(healthMatch[1]) : 70;
      
      matchedNodes = graph.nodes.filter(node => node.health < threshold);
      explanation = `Found ${matchedNodes.length} services with health below ${threshold}%`;
      
    } else if (normalizedQuery.includes('critical') || normalizedQuery.includes('important')) {
      matchedNodes = graph.nodes.filter(node => 
        node.isOnCriticalPath || node.criticalityScore > 70
      );
      explanation = `Found ${matchedNodes.length} critical services`;
      
    } else if (normalizedQuery.includes('orphan') || normalizedQuery.includes('isolated')) {
      matchedNodes = graph.nodes.filter(node => 
        node.dependencies.length === 0 && node.dependents.length === 0
      );
      explanation = `Found ${matchedNodes.length} orphaned services`;
      
    } else if (normalizedQuery.includes('depend') && normalizedQuery.includes('on')) {
      // Find services that depend on a specific service
      const serviceMatch = normalizedQuery.match(/depend.*on\s+([a-zA-Z0-9-_]+)/);
      if (serviceMatch) {
        const targetService = serviceMatch[1];
        const targetNode = graph.nodes.find(node => 
          node.name.toLowerCase().includes(targetService)
        );
        
        if (targetNode) {
          matchedNodes = graph.nodes.filter(node =>
            node.dependencies.includes(targetNode.id)
          );
          explanation = `Found ${matchedNodes.length} services that depend on ${targetNode.name}`;
        }
      }
      
    } else if (normalizedQuery.includes('owner') || normalizedQuery.includes('team')) {
      const ownerMatch = normalizedQuery.match(/(?:owner|team)\s+([a-zA-Z0-9-_]+)/);
      if (ownerMatch) {
        const owner = ownerMatch[1];
        matchedNodes = graph.nodes.filter(node =>
          node.owner.toLowerCase().includes(owner)
        );
        explanation = `Found ${matchedNodes.length} services owned by team containing "${owner}"`;
      }
      
    } else if (normalizedQuery.includes('system')) {
      const systemMatch = normalizedQuery.match(/system\s+([a-zA-Z0-9-_]+)/);
      if (systemMatch) {
        const system = systemMatch[1];
        matchedNodes = graph.nodes.filter(node =>
          node.entity.spec?.system?.toLowerCase().includes(system)
        );
        explanation = `Found ${matchedNodes.length} services in system containing "${system}"`;
      }
      
    } else if (normalizedQuery.includes('type')) {
      const typeMatch = normalizedQuery.match(/type\s+([a-zA-Z0-9-_]+)/);
      if (typeMatch) {
        const type = typeMatch[1];
        matchedNodes = graph.nodes.filter(node =>
          node.type.toLowerCase().includes(type)
        );
        explanation = `Found ${matchedNodes.length} services of type containing "${type}"`;
      }
      
    } else {
      // Fallback to general text search
      matchedNodes = graph.nodes.filter(node =>
        node.name.toLowerCase().includes(normalizedQuery) ||
        node.type.toLowerCase().includes(normalizedQuery) ||
        node.owner.toLowerCase().includes(normalizedQuery) ||
        (node.description && node.description.toLowerCase().includes(normalizedQuery)) ||
        node.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
      );
      explanation = `Found ${matchedNodes.length} services matching "${query}"`;
    }

    return { nodes: matchedNodes, explanation };
  }

  /**
   * Create filter from user selection
   */
  createFilterFromSelection(selectedNodes: string[], graph: DependencyGraph): GraphFilter {
    const nodes = graph.nodes.filter(node => selectedNodes.includes(node.id));
    
    if (nodes.length === 0) {
      return this.createDefaultFilter();
    }

    // Analyze selected nodes to create intelligent filter
    const nodeTypes = [...new Set(nodes.map(n => n.type))];
    const owners = [...new Set(nodes.map(n => n.owner))];
    const systems = [...new Set(nodes.map(n => n.entity.spec?.system).filter(Boolean))];
    const lifecycles = [...new Set(nodes.map(n => n.lifecycle))];
    
    const healthValues = nodes.map(n => n.health);
    const minHealth = Math.min(...healthValues);
    const maxHealth = Math.max(...healthValues);

    return {
      nodeTypes: nodeTypes.length < 4 ? nodeTypes : [], // Include types if reasonable subset
      edgeTypes: [],
      owners: owners.length < 6 ? owners : [], // Include owners if reasonable subset
      systems: systems.length < 4 ? systems as string[] : [],
      lifecycles: lifecycles.length < 3 ? lifecycles : [],
      healthRange: { 
        min: Math.max(0, minHealth - 10), 
        max: Math.min(100, maxHealth + 10) 
      },
      searchQuery: '',
      showOrphans: true,
      maxDepth: 2,
    };
  }

  /**
   * Create default filter showing all nodes
   */
  createDefaultFilter(): GraphFilter {
    return {
      nodeTypes: [],
      edgeTypes: [],
      owners: [],
      systems: [],
      lifecycles: [],
      healthRange: { min: 0, max: 100 },
      searchQuery: '',
      showOrphans: true,
      maxDepth: undefined,
      focusNode: undefined,
    };
  }

  /**
   * Get filter suggestions based on current graph state
   */
  getFilterSuggestions(graph: DependencyGraph): Array<{
    type: 'nodeType' | 'owner' | 'system' | 'lifecycle' | 'health' | 'search';
    label: string;
    value: any;
    count: number;
  }> {
    const suggestions: Array<{
      type: 'nodeType' | 'owner' | 'system' | 'lifecycle' | 'health' | 'search';
      label: string;
      value: any;
      count: number;
    }> = [];

    // Node type suggestions
    const nodeTypeCounts = new Map<string, number>();
    graph.nodes.forEach(node => {
      nodeTypeCounts.set(node.type, (nodeTypeCounts.get(node.type) || 0) + 1);
    });

    nodeTypeCounts.forEach((count, type) => {
      suggestions.push({
        type: 'nodeType',
        label: `${type} (${count})`,
        value: type,
        count,
      });
    });

    // Owner suggestions
    const ownerCounts = new Map<string, number>();
    graph.nodes.forEach(node => {
      if (node.owner !== 'unknown') {
        ownerCounts.set(node.owner, (ownerCounts.get(node.owner) || 0) + 1);
      }
    });

    Array.from(ownerCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([owner, count]) => {
        suggestions.push({
          type: 'owner',
          label: `${owner} (${count})`,
          value: owner,
          count,
        });
      });

    // System suggestions
    const systemCounts = new Map<string, number>();
    graph.nodes.forEach(node => {
      const system = node.entity.spec?.system;
      if (system) {
        systemCounts.set(system, (systemCounts.get(system) || 0) + 1);
      }
    });

    Array.from(systemCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([system, count]) => {
        suggestions.push({
          type: 'system',
          label: `${system} (${count})`,
          value: system,
          count,
        });
      });

    // Lifecycle suggestions
    const lifecycleCounts = new Map<string, number>();
    graph.nodes.forEach(node => {
      lifecycleCounts.set(node.lifecycle, (lifecycleCounts.get(node.lifecycle) || 0) + 1);
    });

    lifecycleCounts.forEach((count, lifecycle) => {
      suggestions.push({
        type: 'lifecycle',
        label: `${lifecycle} (${count})`,
        value: lifecycle,
        count,
      });
    });

    // Health range suggestions
    const unhealthyCount = graph.nodes.filter(n => n.health < 70).length;
    const healthyCount = graph.nodes.filter(n => n.health >= 90).length;
    const degradedCount = graph.nodes.filter(n => n.health >= 70 && n.health < 90).length;

    if (unhealthyCount > 0) {
      suggestions.push({
        type: 'health',
        label: `Unhealthy Services (${unhealthyCount})`,
        value: { min: 0, max: 69 },
        count: unhealthyCount,
      });
    }

    if (degradedCount > 0) {
      suggestions.push({
        type: 'health',
        label: `Degraded Services (${degradedCount})`,
        value: { min: 70, max: 89 },
        count: degradedCount,
      });
    }

    if (healthyCount > 0) {
      suggestions.push({
        type: 'health',
        label: `Healthy Services (${healthyCount})`,
        value: { min: 90, max: 100 },
        count: healthyCount,
      });
    }

    return suggestions.sort((a, b) => b.count - a.count);
  }

  /**
   * Validate filter configuration
   */
  validateFilter(filter: GraphFilter): Array<{
    field: string;
    message: string;
    severity: 'warning' | 'error';
  }> {
    const issues: Array<{
      field: string;
      message: string;
      severity: 'warning' | 'error';
    }> = [];

    // Health range validation
    if (filter.healthRange.min < 0 || filter.healthRange.min > 100) {
      issues.push({
        field: 'healthRange.min',
        message: 'Minimum health must be between 0 and 100',
        severity: 'error',
      });
    }

    if (filter.healthRange.max < 0 || filter.healthRange.max > 100) {
      issues.push({
        field: 'healthRange.max',
        message: 'Maximum health must be between 0 and 100',
        severity: 'error',
      });
    }

    if (filter.healthRange.min > filter.healthRange.max) {
      issues.push({
        field: 'healthRange',
        message: 'Minimum health cannot be greater than maximum health',
        severity: 'error',
      });
    }

    // Max depth validation
    if (filter.maxDepth !== undefined && (filter.maxDepth < 1 || filter.maxDepth > 10)) {
      issues.push({
        field: 'maxDepth',
        message: 'Maximum depth should be between 1 and 10',
        severity: 'warning',
      });
    }

    // Search query validation
    if (filter.searchQuery.length > 100) {
      issues.push({
        field: 'searchQuery',
        message: 'Search query is too long',
        severity: 'warning',
      });
    }

    // Focus node validation
    if (filter.focusNode && filter.maxDepth === undefined) {
      issues.push({
        field: 'focusNode',
        message: 'Focus node filter should specify maximum depth',
        severity: 'warning',
      });
    }

    return issues;
  }

  /**
   * Get filter statistics
   */
  getFilterStats(originalGraph: DependencyGraph, filteredGraph: DependencyGraph): {
    nodesFiltered: number;
    edgesFiltered: number;
    filterEfficiency: number;
    topFilteredTypes: Array<{ type: string; count: number }>;
  } {
    const nodesFiltered = originalGraph.nodes.length - filteredGraph.nodes.length;
    const edgesFiltered = originalGraph.edges.length - filteredGraph.edges.length;
    
    const filterEfficiency = originalGraph.nodes.length > 0 
      ? (nodesFiltered / originalGraph.nodes.length) * 100 
      : 0;

    // Analyze what types were filtered out most
    const originalTypeCounts = new Map<string, number>();
    const filteredTypeCounts = new Map<string, number>();

    originalGraph.nodes.forEach(node => {
      originalTypeCounts.set(node.type, (originalTypeCounts.get(node.type) || 0) + 1);
    });

    filteredGraph.nodes.forEach(node => {
      filteredTypeCounts.set(node.type, (filteredTypeCounts.get(node.type) || 0) + 1);
    });

    const topFilteredTypes: Array<{ type: string; count: number }> = [];
    originalTypeCounts.forEach((originalCount, type) => {
      const filteredCount = filteredTypeCounts.get(type) || 0;
      const filtered = originalCount - filteredCount;
      if (filtered > 0) {
        topFilteredTypes.push({ type, count: filtered });
      }
    });

    topFilteredTypes.sort((a, b) => b.count - a.count);

    return {
      nodesFiltered,
      edgesFiltered,
      filterEfficiency: Math.round(filterEfficiency * 100) / 100,
      topFilteredTypes: topFilteredTypes.slice(0, 5),
    };
  }
}