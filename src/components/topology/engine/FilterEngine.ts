/**
 * Filter Engine for Service Topology Visualization
 * 
 * Provides advanced filtering capabilities for nodes and edges based on
 * multiple criteria including metadata, health status, tags, and custom filters.
 */

import {
  ServiceTopologyNode,
  ServiceTopologyEdge,
  FilterConfig,
  CustomFilter,
  ArchitectureLayer
} from '../types';

// =============================================
// FILTER ENGINE CLASS
// =============================================

export class FilterEngine {
  private lastAppliedFilters?: FilterConfig;
  private filteredNodeCache: Map<string, ServiceTopologyNode[]>;
  private filteredEdgeCache: Map<string, ServiceTopologyEdge[]>;
  
  constructor() {
    this.filteredNodeCache = new Map();
    this.filteredEdgeCache = new Map();
  }
  
  // =============================================
  // NODE FILTERING
  // =============================================
  
  public applyFilters(
    nodes: ServiceTopologyNode[],
    filters: FilterConfig
  ): ServiceTopologyNode[] {
    const filterKey = this.generateFilterKey(filters);
    
    // Check cache
    if (this.filteredNodeCache.has(filterKey)) {
      return this.filteredNodeCache.get(filterKey)!;
    }
    
    let filteredNodes = [...nodes];
    
    // Apply individual filters
    filteredNodes = this.filterByKinds(filteredNodes, filters.kinds);
    filteredNodes = this.filterByNamespaces(filteredNodes, filters.namespaces);
    filteredNodes = this.filterByTeams(filteredNodes, filters.teams);
    filteredNodes = this.filterByTags(filteredNodes, filters.tags);
    filteredNodes = this.filterByStatus(filteredNodes, filters.status);
    filteredNodes = this.filterByHealth(filteredNodes, filters.health);
    filteredNodes = this.filterByCriticality(filteredNodes, filters.criticality);
    filteredNodes = this.filterByLayers(filteredNodes, filters.layers);
    filteredNodes = this.filterBySearch(filteredNodes, filters.search);
    filteredNodes = this.applyCustomFilters(filteredNodes, filters.customFilters);
    
    // Cache result
    this.filteredNodeCache.set(filterKey, filteredNodes);
    
    return filteredNodes;
  }
  
  private filterByKinds(
    nodes: ServiceTopologyNode[],
    kinds: string[]
  ): ServiceTopologyNode[] {
    if (kinds.length === 0) return nodes;
    
    return nodes.filter(node => kinds.includes(node.kind));
  }
  
  private filterByNamespaces(
    nodes: ServiceTopologyNode[],
    namespaces: string[]
  ): ServiceTopologyNode[] {
    if (namespaces.length === 0) return nodes;
    
    return nodes.filter(node => namespaces.includes(node.data.namespace));
  }
  
  private filterByTeams(
    nodes: ServiceTopologyNode[],
    teams: string[]
  ): ServiceTopologyNode[] {
    if (teams.length === 0) return nodes;
    
    return nodes.filter(node => {
      const nodeTeam = node.data.team || node.data.owner;
      return nodeTeam && teams.includes(nodeTeam);
    });
  }
  
  private filterByTags(
    nodes: ServiceTopologyNode[],
    tags: string[]
  ): ServiceTopologyNode[] {
    if (tags.length === 0) return nodes;
    
    return nodes.filter(node => {
      return tags.some(tag => node.data.tags.includes(tag));
    });
  }
  
  private filterByStatus(
    nodes: ServiceTopologyNode[],
    statuses: string[]
  ): ServiceTopologyNode[] {
    if (statuses.length === 0) return nodes;
    
    return nodes.filter(node => {
      return statuses.includes(node.data.status.deployment);
    });
  }
  
  private filterByHealth(
    nodes: ServiceTopologyNode[],
    healthStatuses: string[]
  ): ServiceTopologyNode[] {
    if (healthStatuses.length === 0) return nodes;
    
    return nodes.filter(node => {
      return healthStatuses.includes(node.data.health.status);
    });
  }
  
  private filterByCriticality(
    nodes: ServiceTopologyNode[],
    criticalities: string[]
  ): ServiceTopologyNode[] {
    if (criticalities.length === 0) return nodes;
    
    return nodes.filter(node => {
      return criticalities.includes(node.data.criticality);
    });
  }
  
  private filterByLayers(
    nodes: ServiceTopologyNode[],
    layers: ArchitectureLayer[]
  ): ServiceTopologyNode[] {
    if (layers.length === 0) return nodes;
    
    return nodes.filter(node => {
      return layers.includes(node.data.layer);
    });
  }
  
  private filterBySearch(
    nodes: ServiceTopologyNode[],
    searchTerm: string
  ): ServiceTopologyNode[] {
    if (!searchTerm.trim()) return nodes;
    
    const term = searchTerm.toLowerCase();
    
    return nodes.filter(node => {
      const searchableFields = [
        node.data.label,
        node.data.name,
        node.data.title,
        node.data.description,
        node.data.owner,
        node.data.team,
        node.kind,
        node.type,
        ...node.data.tags
      ];
      
      return searchableFields.some(field => 
        field && field.toLowerCase().includes(term)
      );
    });
  }
  
  // =============================================
  // EDGE FILTERING
  // =============================================
  
  public applyEdgeFilters(
    edges: ServiceTopologyEdge[],
    filters: FilterConfig
  ): ServiceTopologyEdge[] {
    const filterKey = this.generateEdgeFilterKey(filters);
    
    // Check cache
    if (this.filteredEdgeCache.has(filterKey)) {
      return this.filteredEdgeCache.get(filterKey)!;
    }
    
    let filteredEdges = [...edges];
    
    // Apply edge-specific filters
    filteredEdges = this.filterEdgesBySearch(filteredEdges, filters.search);
    filteredEdges = this.applyCustomEdgeFilters(filteredEdges, filters.customFilters);
    
    // Cache result
    this.filteredEdgeCache.set(filterKey, filteredEdges);
    
    return filteredEdges;
  }
  
  private filterEdgesBySearch(
    edges: ServiceTopologyEdge[],
    searchTerm: string
  ): ServiceTopologyEdge[] {
    if (!searchTerm.trim()) return edges;
    
    const term = searchTerm.toLowerCase();
    
    return edges.filter(edge => {
      const searchableFields = [
        edge.data.label,
        edge.data.relation,
        edge.data.protocol,
        edge.data.description,
        edge.type,
        ...edge.data.tags
      ];
      
      return searchableFields.some(field => 
        field && field.toLowerCase().includes(term)
      );
    });
  }
  
  // =============================================
  // CUSTOM FILTERS
  // =============================================
  
  private applyCustomFilters(
    nodes: ServiceTopologyNode[],
    customFilters: CustomFilter[]
  ): ServiceTopologyNode[] {
    const activeFilters = customFilters.filter(filter => filter.active);
    
    if (activeFilters.length === 0) return nodes;
    
    return nodes.filter(node => {
      return activeFilters.every(filter => {
        return this.evaluateCustomFilter(node, filter);
      });
    });
  }
  
  private applyCustomEdgeFilters(
    edges: ServiceTopologyEdge[],
    customFilters: CustomFilter[]
  ): ServiceTopologyEdge[] {
    const activeFilters = customFilters.filter(filter => filter.active);
    
    if (activeFilters.length === 0) return edges;
    
    return edges.filter(edge => {
      return activeFilters.every(filter => {
        return this.evaluateCustomEdgeFilter(edge, filter);
      });
    });
  }
  
  private evaluateCustomFilter(
    node: ServiceTopologyNode,
    filter: CustomFilter
  ): boolean {
    const value = this.getNodePropertyValue(node, filter.property);
    
    if (value === undefined || value === null) {
      return false;
    }
    
    return this.evaluateCondition(value, filter.operator, filter.value);
  }
  
  private evaluateCustomEdgeFilter(
    edge: ServiceTopologyEdge,
    filter: CustomFilter
  ): boolean {
    const value = this.getEdgePropertyValue(edge, filter.property);
    
    if (value === undefined || value === null) {
      return false;
    }
    
    return this.evaluateCondition(value, filter.operator, filter.value);
  }
  
  private getNodePropertyValue(
    node: ServiceTopologyNode,
    property: string
  ): unknown {
    // Handle nested properties with dot notation
    const parts = property.split('.');
    let value: any = node;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
  
  private getEdgePropertyValue(
    edge: ServiceTopologyEdge,
    property: string
  ): unknown {
    const parts = property.split('.');
    let value: any = edge;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
  
  private evaluateCondition(
    nodeValue: unknown,
    operator: string,
    filterValue: unknown
  ): boolean {
    switch (operator) {
      case 'equals':
        return nodeValue === filterValue;
      
      case 'contains':
        if (typeof nodeValue === 'string' && typeof filterValue === 'string') {
          return nodeValue.toLowerCase().includes(filterValue.toLowerCase());
        }
        if (Array.isArray(nodeValue)) {
          return nodeValue.includes(filterValue);
        }
        return false;
      
      case 'gt':
        if (typeof nodeValue === 'number' && typeof filterValue === 'number') {
          return nodeValue > filterValue;
        }
        return false;
      
      case 'lt':
        if (typeof nodeValue === 'number' && typeof filterValue === 'number') {
          return nodeValue < filterValue;
        }
        return false;
      
      case 'in':
        if (Array.isArray(filterValue)) {
          return filterValue.includes(nodeValue);
        }
        return false;
      
      case 'regex':
        if (typeof nodeValue === 'string' && typeof filterValue === 'string') {
          try {
            const regex = new RegExp(filterValue, 'i');
            return regex.test(nodeValue);
          } catch {
            return false;
          }
        }
        return false;
      
      default:
        return false;
    }
  }
  
  // =============================================
  // ADVANCED FILTERING METHODS
  // =============================================
  
  public filterByHealthScore(
    nodes: ServiceTopologyNode[],
    minScore: number,
    maxScore: number = 100
  ): ServiceTopologyNode[] {
    return nodes.filter(node => {
      const score = node.data.health.score;
      return score >= minScore && score <= maxScore;
    });
  }
  
  public filterByMetricThreshold(
    nodes: ServiceTopologyNode[],
    metricName: keyof ServiceTopologyNode['data']['metrics'],
    threshold: number,
    operator: 'gt' | 'lt' | 'eq' = 'gt'
  ): ServiceTopologyNode[] {
    return nodes.filter(node => {
      const metric = node.data.metrics[metricName];
      if (!metric || typeof metric.current !== 'number') return false;
      
      switch (operator) {
        case 'gt':
          return metric.current > threshold;
        case 'lt':
          return metric.current < threshold;
        case 'eq':
          return metric.current === threshold;
        default:
          return false;
      }
    });
  }
  
  public filterByLastUpdated(
    nodes: ServiceTopologyNode[],
    hoursAgo: number
  ): ServiceTopologyNode[] {
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    
    return nodes.filter(node => {
      return node.data.lastUpdated > cutoffTime;
    });
  }
  
  public filterByDependencyCount(
    nodes: ServiceTopologyNode[],
    minDependencies: number,
    maxDependencies: number = Infinity
  ): ServiceTopologyNode[] {
    return nodes.filter(node => {
      const depCount = node.data.relationships.length;
      return depCount >= minDependencies && depCount <= maxDependencies;
    });
  }
  
  public filterOrphans(nodes: ServiceTopologyNode[]): ServiceTopologyNode[] {
    return nodes.filter(node => {
      return node.data.relationships.length === 0;
    });
  }
  
  public filterCriticalPath(
    nodes: ServiceTopologyNode[],
    edges: ServiceTopologyEdge[]
  ): { nodes: ServiceTopologyNode[]; edges: ServiceTopologyEdge[] } {
    // Find nodes that are part of critical service paths
    const criticalNodes = nodes.filter(node => 
      node.data.criticality === 'critical' || node.data.criticality === 'high'
    );
    
    const criticalNodeIds = new Set(criticalNodes.map(n => n.id));
    
    // Find edges connecting critical nodes
    const criticalEdges = edges.filter(edge =>
      criticalNodeIds.has(edge.source) || criticalNodeIds.has(edge.target)
    );
    
    // Add nodes that are connected to critical nodes
    const connectedNodeIds = new Set<string>();
    criticalEdges.forEach(edge => {
      connectedNodeIds.add(edge.source);
      connectedNodeIds.add(edge.target);
    });
    
    const allRelevantNodes = nodes.filter(node =>
      connectedNodeIds.has(node.id)
    );
    
    return {
      nodes: allRelevantNodes,
      edges: criticalEdges
    };
  }
  
  // =============================================
  // FILTER COMBINATIONS AND PRESETS
  // =============================================
  
  public createFilterPreset(
    name: string,
    description: string,
    filters: Partial<FilterConfig>
  ): FilterConfig {
    return {
      kinds: [],
      namespaces: [],
      teams: [],
      tags: [],
      status: [],
      health: [],
      criticality: [],
      layers: [],
      search: '',
      customFilters: [],
      ...filters
    };
  }
  
  public getCommonFilterPresets(): Array<{ name: string; filters: FilterConfig }> {
    return [
      {
        name: 'Healthy Services',
        filters: this.createFilterPreset(
          'Healthy Services',
          'Show only healthy services',
          { health: ['healthy'] }
        )
      },
      {
        name: 'Critical Services',
        filters: this.createFilterPreset(
          'Critical Services',
          'Show only critical services',
          { criticality: ['critical', 'high'] }
        )
      },
      {
        name: 'Production Services',
        filters: this.createFilterPreset(
          'Production Services',
          'Show only production environment services',
          { status: ['deployed'] }
        )
      },
      {
        name: 'APIs Only',
        filters: this.createFilterPreset(
          'APIs Only',
          'Show only API services',
          { kinds: ['API'] }
        )
      },
      {
        name: 'Application Layer',
        filters: this.createFilterPreset(
          'Application Layer',
          'Show only application layer services',
          { layers: [ArchitectureLayer.APPLICATION] }
        )
      },
      {
        name: 'Recently Updated',
        filters: this.createFilterPreset(
          'Recently Updated',
          'Show services updated in the last 24 hours',
          {
            customFilters: [{
              name: 'Recent Updates',
              property: 'data.lastUpdated',
              operator: 'gt',
              value: new Date(Date.now() - 24 * 60 * 60 * 1000),
              active: true
            }]
          }
        )
      }
    ];
  }
  
  // =============================================
  // UTILITY METHODS
  // =============================================
  
  private generateFilterKey(filters: FilterConfig): string {
    return JSON.stringify(filters);
  }
  
  private generateEdgeFilterKey(filters: FilterConfig): string {
    // Only include edge-relevant filters
    return JSON.stringify({
      search: filters.search,
      customFilters: filters.customFilters.filter(f => 
        f.property.startsWith('data.') || f.property.startsWith('type')
      )
    });
  }
  
  public clearCache(): void {
    this.filteredNodeCache.clear();
    this.filteredEdgeCache.clear();
  }
  
  public getCacheStats(): { nodes: number; edges: number } {
    return {
      nodes: this.filteredNodeCache.size,
      edges: this.filteredEdgeCache.size
    };
  }
  
  // =============================================
  // FILTER VALIDATION
  // =============================================
  
  public validateFilter(filter: CustomFilter): { valid: boolean; error?: string } {
    if (!filter.name || filter.name.trim() === '') {
      return { valid: false, error: 'Filter name is required' };
    }
    
    if (!filter.property || filter.property.trim() === '') {
      return { valid: false, error: 'Filter property is required' };
    }
    
    if (!['equals', 'contains', 'gt', 'lt', 'in', 'regex'].includes(filter.operator)) {
      return { valid: false, error: 'Invalid filter operator' };
    }
    
    if (filter.value === undefined || filter.value === null) {
      return { valid: false, error: 'Filter value is required' };
    }
    
    // Validate regex if operator is regex
    if (filter.operator === 'regex' && typeof filter.value === 'string') {
      try {
        new RegExp(filter.value);
      } catch {
        return { valid: false, error: 'Invalid regex pattern' };
      }
    }
    
    return { valid: true };
  }
  
  public getFilterSuggestions(
    nodes: ServiceTopologyNode[]
  ): {
    kinds: string[];
    namespaces: string[];
    teams: string[];
    tags: string[];
    owners: string[];
    layers: ArchitectureLayer[];
  } {
    const suggestions = {
      kinds: new Set<string>(),
      namespaces: new Set<string>(),
      teams: new Set<string>(),
      tags: new Set<string>(),
      owners: new Set<string>(),
      layers: new Set<ArchitectureLayer>()
    };
    
    nodes.forEach(node => {
      suggestions.kinds.add(node.kind);
      suggestions.namespaces.add(node.data.namespace);
      
      if (node.data.team) suggestions.teams.add(node.data.team);
      if (node.data.owner) suggestions.owners.add(node.data.owner);
      
      node.data.tags.forEach(tag => suggestions.tags.add(tag));
      suggestions.layers.add(node.data.layer);
    });
    
    return {
      kinds: Array.from(suggestions.kinds).sort(),
      namespaces: Array.from(suggestions.namespaces).sort(),
      teams: Array.from(suggestions.teams).sort(),
      tags: Array.from(suggestions.tags).sort(),
      owners: Array.from(suggestions.owners).sort(),
      layers: Array.from(suggestions.layers).sort()
    };
  }
}