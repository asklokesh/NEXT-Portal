/**
 * Topology API Client
 * Backend API integration for topology data
 */

import {
  DiscoveryApi,
  FetchApi,
  IdentityApi,
} from '@backstage/core-plugin-api';
import {
  ServiceNode,
  ServiceRelationship,
  PathFindingResult,
  ImpactAnalysisResult,
  DependencyAnalysisResult,
  TimeRange,
  FilterConfig,
} from '../types';

export interface TopologyApiClientOptions {
  discoveryApi: DiscoveryApi;
  identityApi: IdentityApi;
  fetchApi: FetchApi;
}

export class TopologyApiClient {
  private readonly discoveryApi: DiscoveryApi;
  private readonly identityApi: IdentityApi;
  private readonly fetchApi: FetchApi;

  constructor(options: TopologyApiClientOptions) {
    this.discoveryApi = options.discoveryApi;
    this.identityApi = options.identityApi;
    this.fetchApi = options.fetchApi;
  }

  private async getBaseUrl(): Promise<string> {
    return await this.discoveryApi.getBaseUrl('topology');
  }

  private async getHeaders(): Promise<HeadersInit> {
    const { token } = await this.identityApi.getCredentials();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  /**
   * Fetch current topology data
   */
  async fetchTopology(filters?: FilterConfig): Promise<{
    nodes: ServiceNode[];
    edges: ServiceRelationship[];
  }> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    
    const queryParams = filters ? `?${new URLSearchParams(filters as any)}` : '';
    const response = await this.fetchApi.fetch(
      `${baseUrl}/topology${queryParams}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch topology: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Fetch topology for a specific service
   */
  async fetchServiceTopology(
    serviceId: string,
    depth: number = 2
  ): Promise<{
    nodes: ServiceNode[];
    edges: ServiceRelationship[];
  }> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    
    const response = await this.fetchApi.fetch(
      `${baseUrl}/topology/service/${serviceId}?depth=${depth}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch service topology: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Fetch historical topology data
   */
  async fetchHistoricalTopology(
    timeRange: TimeRange
  ): Promise<{
    snapshots: Array<{
      timestamp: Date;
      nodes: ServiceNode[];
      edges: ServiceRelationship[];
    }>;
  }> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    
    const response = await this.fetchApi.fetch(
      `${baseUrl}/topology/historical`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          start: timeRange.start.toISOString(),
          end: timeRange.end.toISOString(),
          granularity: timeRange.granularity,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch historical topology: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Find path between services
   */
  async findPath(
    sourceId: string,
    targetId: string,
    options?: {
      maxLength?: number;
      avoidNodes?: string[];
    }
  ): Promise<PathFindingResult[]> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    
    const response = await this.fetchApi.fetch(
      `${baseUrl}/analysis/path`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sourceId,
          targetId,
          ...options,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to find path: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Analyze service impact
   */
  async analyzeImpact(serviceId: string): Promise<ImpactAnalysisResult> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    
    const response = await this.fetchApi.fetch(
      `${baseUrl}/analysis/impact/${serviceId}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to analyze impact: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Analyze dependencies
   */
  async analyzeDependencies(): Promise<DependencyAnalysisResult> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    
    const response = await this.fetchApi.fetch(
      `${baseUrl}/analysis/dependencies`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to analyze dependencies: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get service metrics
   */
  async getServiceMetrics(
    serviceId: string,
    timeRange?: TimeRange
  ): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    
    const queryParams = timeRange
      ? `?start=${timeRange.start.toISOString()}&end=${timeRange.end.toISOString()}`
      : '';
    
    const response = await this.fetchApi.fetch(
      `${baseUrl}/metrics/${serviceId}${queryParams}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get service health status
   */
  async getServiceHealth(serviceId: string): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    
    const response = await this.fetchApi.fetch(
      `${baseUrl}/health/${serviceId}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch health status: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get service incidents
   */
  async getServiceIncidents(
    serviceId: string,
    options?: {
      status?: 'active' | 'resolved' | 'all';
      limit?: number;
    }
  ): Promise<any[]> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    
    const queryParams = options
      ? `?${new URLSearchParams(options as any)}`
      : '';
    
    const response = await this.fetchApi.fetch(
      `${baseUrl}/incidents/${serviceId}${queryParams}`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch incidents: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Export topology data
   */
  async exportTopology(
    format: 'json' | 'graphml' | 'dot' | 'gexf',
    filters?: FilterConfig
  ): Promise<Blob> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    
    const response = await this.fetchApi.fetch(
      `${baseUrl}/export`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          format,
          filters,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to export topology: ${response.statusText}`);
    }

    return await response.blob();
  }

  /**
   * Search services
   */
  async searchServices(
    query: string,
    options?: {
      limit?: number;
      types?: string[];
      tags?: string[];
    }
  ): Promise<ServiceNode[]> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    
    const response = await this.fetchApi.fetch(
      `${baseUrl}/search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          ...options,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to search services: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get topology statistics
   */
  async getStatistics(): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
    nodesByHealth: Record<string, number>;
    criticalNodes: number;
    incidents: number;
    avgLatency: number;
    avgErrorRate: number;
  }> {
    const baseUrl = await this.getBaseUrl();
    const headers = await this.getHeaders();
    
    const response = await this.fetchApi.fetch(
      `${baseUrl}/statistics`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch statistics: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Subscribe to real-time updates
   */
  async getWebSocketUrl(): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    const { token } = await this.identityApi.getCredentials();
    
    // Convert HTTP URL to WebSocket URL
    const wsUrl = baseUrl.replace(/^http/, 'ws');
    return token ? `${wsUrl}/ws?token=${token}` : `${wsUrl}/ws`;
  }
}