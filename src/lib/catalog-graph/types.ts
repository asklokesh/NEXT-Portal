import type { Entity } from '@/services/backstage/types/entities';

export interface GraphNode {
  id: string;
  name: string;
  type: 'Component' | 'API' | 'Resource' | 'System' | 'Domain' | 'Group';
  entity: Entity;
  
  // Visual properties
  x?: number;
  y?: number;
  z?: number;
  size: number;
  color: string;
  group: string;
  
  // Metadata
  owner: string;
  lifecycle: 'experimental' | 'production' | 'deprecated' | 'unknown';
  description?: string;
  tags: string[];
  
  // Health and metrics
  health: number; // 0-100
  lastUpdated: Date;
  deploymentFrequency: number;
  mttr: number; // Mean Time To Recovery
  changeFailureRate: number;
  
  // Relationship data
  dependencies: string[];
  dependents: string[];
  provides: string[];
  consumes: string[];
  
  // Analysis metrics
  impactScore: number;
  criticalityScore: number;
  complexityScore: number;
  stabilityScore: number;
  isOnCriticalPath: boolean;
  clusterMembership: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  strength: number; // 0-1
  color: string;
  width: number;
  
  // Metadata
  label?: string;
  description?: string;
  
  // Health metrics
  healthScore: number; // 0-100
  latency?: number;
  errorRate?: number;
  throughput?: number;
  
  // Visual properties
  animated: boolean;
  bidirectional: boolean;
}

export type RelationshipType = 
  | 'depends_on'
  | 'provides_api'
  | 'consumes_api'
  | 'part_of_system'
  | 'owns'
  | 'deployed_on'
  | 'uses_database'
  | 'publishes_to'
  | 'subscribes_to'
  | 'calls'
  | 'extends'
  | 'implements';

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    generatedAt: Date;
    version: string;
    source: string;
  };
}

export interface GraphCluster {
  id: string;
  name: string;
  type: 'system' | 'team' | 'technology' | 'domain' | 'lifecycle';
  nodes: string[];
  color: string;
  centerX?: number;
  centerY?: number;
  radius?: number;
}

export interface GraphAnalytics {
  // Basic metrics
  totalNodes: number;
  totalEdges: number;
  density: number; // edges / max_possible_edges
  avgDegree: number;
  
  // Structure analysis
  orphanNodes: string[];
  circularDependencies: string[][];
  criticalPaths: string[][];
  clusters: GraphCluster[];
  
  // Node rankings
  mostConnected: Array<{ id: string; connections: number }>;
  mostCritical: Array<{ id: string; score: number }>;
  mostUnstable: Array<{ id: string; score: number }>;
  
  // Health metrics
  overallHealth: number;
  healthByTeam: Record<string, number>;
  healthBySystem: Record<string, number>;
  
  // Risk analysis
  riskFactors: RiskFactor[];
  vulnerabilities: Vulnerability[];
  
  // Recommendations
  optimizations: Optimization[];
  alerts: Alert[];
}

export interface RiskFactor {
  id: string;
  type: 'single_point_of_failure' | 'high_complexity' | 'low_health' | 'circular_dependency' | 'orphaned_service';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedNodes: string[];
  recommendation: string;
}

export interface Vulnerability {
  id: string;
  nodeId: string;
  type: 'security' | 'performance' | 'reliability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  cve?: string;
  recommendation: string;
}

export interface Optimization {
  id: string;
  type: 'consolidation' | 'decomposition' | 'caching' | 'load_balancing';
  description: string;
  affectedNodes: string[];
  estimatedImpact: string;
  priority: 'low' | 'medium' | 'high';
}

export interface Alert {
  id: string;
  type: 'health' | 'dependency' | 'performance' | 'security';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  nodeId?: string;
  timestamp: Date;
  resolved: boolean;
}

export interface ImpactAnalysis {
  nodeId: string;
  directImpact: {
    upstream: string[];
    downstream: string[];
  };
  indirectImpact: {
    upstream: string[];
    downstream: string[];
  };
  cascadingFailure: {
    probability: number; // 0-1
    affectedServices: string[];
    estimatedDowntime: number; // minutes
    businessImpact: 'low' | 'medium' | 'high' | 'critical';
  };
  riskScore: number; // 0-100
  mitigationStrategies: string[];
}

export interface GraphLayout {
  type: 'force' | 'hierarchical' | 'radial' | 'circular' | 'grid' | 'layered';
  parameters: Record<string, any>;
}

export interface GraphFilter {
  nodeTypes: string[];
  edgeTypes: RelationshipType[];
  owners: string[];
  systems: string[];
  lifecycles: string[];
  healthRange: { min: number; max: number };
  searchQuery: string;
  showOrphans: boolean;
  maxDepth?: number;
  focusNode?: string;
}

export interface GraphExportOptions {
  format: 'png' | 'svg' | 'json' | 'csv' | 'graphml' | 'gexf';
  includeMetadata: boolean;
  resolution?: { width: number; height: number };
  quality?: 'low' | 'medium' | 'high';
}

export interface GraphMetrics {
  nodeMetrics: Record<string, NodeMetrics>;
  edgeMetrics: Record<string, EdgeMetrics>;
  globalMetrics: GlobalMetrics;
}

export interface NodeMetrics {
  id: string;
  degree: number;
  inDegree: number;
  outDegree: number;
  betweennessCentrality: number;
  closenessCentrality: number;
  eigenvectorCentrality: number;
  pageRank: number;
  clusteringCoefficient: number;
  coreness: number;
}

export interface EdgeMetrics {
  id: string;
  betweennessCentrality: number;
  weight: number;
  length: number;
}

export interface GlobalMetrics {
  averagePathLength: number;
  diameter: number;
  density: number;
  modularity: number;
  transitivity: number;
  assortativity: number;
  components: number;
  stronglyConnectedComponents: number;
}

export interface GraphEvent {
  type: 'node_click' | 'node_hover' | 'edge_click' | 'edge_hover' | 'background_click' | 'zoom' | 'pan';
  data: any;
  timestamp: Date;
}

export interface GraphState {
  zoom: number;
  center: { x: number; y: number };
  selectedNodes: string[];
  selectedEdges: string[];
  highlightedNodes: string[];
  highlightedEdges: string[];
  filter: GraphFilter;
  layout: GraphLayout;
  viewMode: '2d' | '3d';
  showLabels: boolean;
  showMetrics: boolean;
  animationEnabled: boolean;
}

export interface HealthCheck {
  nodeId: string;
  timestamp: Date;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  score: number; // 0-100
  metrics: {
    uptime: number;
    responseTime: number;
    errorRate: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
  };
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
  }>;
}