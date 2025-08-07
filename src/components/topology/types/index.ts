/**
 * Advanced Service Topology Visualization Types
 * 
 * Comprehensive type definitions for the service topology and architecture
 * visualization system, extending Backstage catalog concepts.
 */

import { Entity } from '@backstage/catalog-model';
import { Node, Edge, ReactFlowInstance } from 'reactflow';

// =============================================
// CORE TOPOLOGY TYPES
// =============================================

export interface ServiceTopologyNode extends Node {
  id: string;
  type: 'service' | 'api' | 'database' | 'queue' | 'gateway' | 'external' | 'group' | 'domain';
  position: { x: number; y: number };
  data: ServiceNodeData;
  measured?: {
    width: number;
    height: number;
  };
}

export interface ServiceNodeData {
  entity: Entity;
  label: string;
  kind: string;
  namespace: string;
  name: string;
  title?: string;
  description?: string;
  
  // Visual properties
  color: string;
  icon: string;
  size: 'small' | 'medium' | 'large';
  shape: 'rectangle' | 'circle' | 'diamond' | 'hexagon';
  
  // Status and health
  health: HealthStatus;
  status: ServiceStatus;
  lastUpdated: Date;
  
  // Metrics
  metrics: ServiceMetrics;
  
  // Relationships
  relationships: ServiceRelationship[];
  
  // Layer information
  layer: ArchitectureLayer;
  
  // Team and ownership
  owner?: string;
  team?: string;
  tags: string[];
  
  // Business context
  criticality: 'low' | 'medium' | 'high' | 'critical';
  lifecycle: 'experimental' | 'production' | 'deprecated' | 'retired';
  
  // Interactive properties
  focused: boolean;
  selected: boolean;
  highlighted: boolean;
  collapsed: boolean;
  
  // Custom properties
  customProperties: Record<string, unknown>;
}

export interface ServiceTopologyEdge extends Edge {
  id: string;
  source: string;
  target: string;
  type: 'dependency' | 'api-call' | 'data-flow' | 'ownership' | 'group';
  data: EdgeData;
  animated?: boolean;
  style?: React.CSSProperties;
}

export interface EdgeData {
  label: string;
  relation: string;
  protocol?: 'http' | 'grpc' | 'tcp' | 'udp' | 'websocket' | 'database';
  
  // Flow characteristics
  direction: 'bidirectional' | 'unidirectional';
  bandwidth?: number;
  latency?: number;
  errorRate?: number;
  throughput?: number;
  
  // Visual properties
  color: string;
  thickness: number;
  style: 'solid' | 'dashed' | 'dotted';
  
  // Status
  healthy: boolean;
  lastActive: Date;
  
  // Metadata
  description?: string;
  tags: string[];
  
  // Security context
  encrypted: boolean;
  authentication?: string;
  authorization?: string[];
}

// =============================================
// HEALTH AND STATUS TYPES
// =============================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  score: number; // 0-100
  checks: HealthCheck[];
  lastCheck: Date;
  trends: HealthTrend[];
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  timestamp: Date;
  duration?: number;
}

export interface HealthTrend {
  timestamp: Date;
  score: number;
  status: string;
}

export interface ServiceStatus {
  deployment: 'deployed' | 'deploying' | 'failed' | 'stopped';
  version: string;
  environment: string;
  replicas?: {
    desired: number;
    ready: number;
    available: number;
  };
  lastDeployed?: Date;
}

export interface ServiceMetrics {
  cpu: MetricValue;
  memory: MetricValue;
  disk: MetricValue;
  network: NetworkMetrics;
  requests: RequestMetrics;
  errors: ErrorMetrics;
  custom: Record<string, MetricValue>;
}

export interface MetricValue {
  current: number;
  average: number;
  peak: number;
  unit: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  history: TimeSeriesPoint[];
}

export interface NetworkMetrics {
  inbound: MetricValue;
  outbound: MetricValue;
  connections: number;
}

export interface RequestMetrics {
  rps: number;
  p50: number;
  p95: number;
  p99: number;
  totalRequests: number;
}

export interface ErrorMetrics {
  rate: number;
  count: number;
  by4xx: number;
  by5xx: number;
  topErrors: ErrorInfo[];
}

export interface ErrorInfo {
  message: string;
  count: number;
  lastSeen: Date;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
}

// =============================================
// RELATIONSHIP AND ARCHITECTURE TYPES
// =============================================

export interface ServiceRelationship {
  type: RelationType;
  target: string;
  direction: 'incoming' | 'outgoing' | 'bidirectional';
  strength: number; // 0-1
  metadata: RelationshipMetadata;
}

export type RelationType = 
  | 'dependsOn'
  | 'provides'
  | 'consumes'
  | 'owns'
  | 'partOf'
  | 'implements'
  | 'extends'
  | 'uses'
  | 'monitors'
  | 'triggers';

export interface RelationshipMetadata {
  protocol?: string;
  endpoint?: string;
  method?: string;
  sla?: ServiceLevelAgreement;
  contract?: APIContract;
}

export interface ServiceLevelAgreement {
  availability: number;
  latency: number;
  throughput: number;
  errorRate: number;
}

export interface APIContract {
  version: string;
  schema?: string;
  documentation?: string;
  breaking: boolean;
}

export enum ArchitectureLayer {
  PRESENTATION = 'presentation',
  APPLICATION = 'application',
  BUSINESS = 'business',
  PERSISTENCE = 'persistence',
  DATABASE = 'database',
  INFRASTRUCTURE = 'infrastructure',
  NETWORK = 'network',
  SECURITY = 'security',
  MONITORING = 'monitoring'
}

// =============================================
// VISUALIZATION CONFIGURATION TYPES
// =============================================

export interface TopologyViewConfig {
  layout: LayoutType;
  layers: ArchitectureLayer[];
  filters: FilterConfig;
  display: DisplayConfig;
  interactions: InteractionConfig;
  annotations: AnnotationConfig;
}

export type LayoutType = 
  | 'hierarchical'
  | 'force-directed'
  | 'circular'
  | 'grid'
  | 'layered'
  | 'organic'
  | 'tree';

export interface FilterConfig {
  kinds: string[];
  namespaces: string[];
  teams: string[];
  tags: string[];
  status: string[];
  health: string[];
  criticality: string[];
  layers: ArchitectureLayer[];
  search: string;
  customFilters: CustomFilter[];
}

export interface CustomFilter {
  name: string;
  property: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'in' | 'regex';
  value: unknown;
  active: boolean;
}

export interface DisplayConfig {
  showLabels: boolean;
  showMetrics: boolean;
  showHealth: boolean;
  showRelations: boolean;
  nodeSize: 'auto' | 'small' | 'medium' | 'large';
  edgeThickness: 'auto' | 'thin' | 'medium' | 'thick';
  colorScheme: ColorScheme;
  theme: 'light' | 'dark' | 'auto';
  animations: boolean;
  clustering: boolean;
}

export interface ColorScheme {
  name: string;
  nodes: Record<string, string>;
  edges: Record<string, string>;
  backgrounds: Record<string, string>;
  text: Record<string, string>;
}

export interface InteractionConfig {
  zoom: boolean;
  pan: boolean;
  select: boolean;
  multiSelect: boolean;
  drag: boolean;
  hover: boolean;
  doubleClick: 'drill-down' | 'expand' | 'edit' | 'none';
  rightClick: 'context-menu' | 'none';
}

export interface AnnotationConfig {
  enabled: boolean;
  showAll: boolean;
  categories: string[];
  permissions: AnnotationPermissions;
}

export interface AnnotationPermissions {
  create: boolean;
  edit: boolean;
  delete: boolean;
  share: boolean;
}

// =============================================
// DATA SOURCE AND INTEGRATION TYPES
// =============================================

export interface TopologyDataSource {
  id: string;
  name: string;
  type: 'catalog' | 'kubernetes' | 'prometheus' | 'jaeger' | 'custom';
  config: DataSourceConfig;
  status: DataSourceStatus;
  lastSync: Date;
}

export interface DataSourceConfig {
  endpoint?: string;
  authentication?: AuthConfig;
  refreshInterval: number;
  timeout: number;
  retries: number;
  customHeaders?: Record<string, string>;
  query?: string;
  transformation?: string;
}

export interface AuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'oauth' | 'apikey';
  credentials: Record<string, string>;
}

export interface DataSourceStatus {
  connected: boolean;
  lastError?: string;
  lastSync: Date;
  recordsCount: number;
  syncDuration: number;
}

// =============================================
// SEARCH AND PATH FINDING TYPES
// =============================================

export interface SearchQuery {
  text: string;
  filters: SearchFilter[];
  scope: SearchScope;
  options: SearchOptions;
}

export interface SearchFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
  value: string;
  weight?: number;
}

export type SearchScope = 'nodes' | 'edges' | 'both';

export interface SearchOptions {
  fuzzy: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  includeMetadata: boolean;
  maxResults: number;
  timeout: number;
}

export interface SearchResult {
  item: ServiceTopologyNode | ServiceTopologyEdge;
  score: number;
  matches: SearchMatch[];
}

export interface SearchMatch {
  field: string;
  value: string;
  highlighted: string;
  position: { start: number; end: number };
}

export interface PathFindingQuery {
  source: string;
  target: string;
  algorithm: 'shortest' | 'least-cost' | 'most-reliable' | 'custom';
  constraints: PathConstraints;
}

export interface PathConstraints {
  maxHops?: number;
  excludeNodes?: string[];
  excludeEdges?: string[];
  minHealthScore?: number;
  allowedRelationTypes?: RelationType[];
  weightFunction?: string;
}

export interface PathResult {
  path: PathStep[];
  totalCost: number;
  reliability: number;
  estimatedLatency: number;
  alternativePaths: PathStep[][];
}

export interface PathStep {
  nodeId: string;
  edgeId?: string;
  cost: number;
  distance: number;
}

// =============================================
// COLLABORATION AND SHARING TYPES
// =============================================

export interface TopologyView {
  id: string;
  name: string;
  description?: string;
  owner: string;
  team?: string;
  config: TopologyViewConfig;
  annotations: Annotation[];
  bookmarks: Bookmark[];
  sharing: SharingConfig;
  version: number;
  created: Date;
  updated: Date;
}

export interface Annotation {
  id: string;
  type: 'note' | 'warning' | 'info' | 'issue' | 'improvement';
  target: AnnotationTarget;
  content: string;
  author: string;
  created: Date;
  updated: Date;
  resolved?: boolean;
  tags: string[];
  attachments: Attachment[];
}

export interface AnnotationTarget {
  type: 'node' | 'edge' | 'area' | 'global';
  id?: string;
  position?: { x: number; y: number };
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
}

export interface Bookmark {
  id: string;
  name: string;
  description?: string;
  position: { x: number; y: number; zoom: number };
  filters: FilterConfig;
  created: Date;
  tags: string[];
}

export interface SharingConfig {
  public: boolean;
  teams: string[];
  users: string[];
  permissions: SharePermissions;
}

export interface SharePermissions {
  view: boolean;
  edit: boolean;
  annotate: boolean;
  share: boolean;
}

// =============================================
// EXPORT AND RENDERING TYPES
// =============================================

export interface ExportConfig {
  format: 'png' | 'svg' | 'pdf' | 'json' | 'yaml';
  quality: 'low' | 'medium' | 'high' | 'ultra';
  dimensions: { width: number; height: number };
  background: boolean;
  annotations: boolean;
  metadata: boolean;
  compression: boolean;
}

export interface ExportResult {
  success: boolean;
  data?: Blob | string;
  error?: string;
  metadata: ExportMetadata;
}

export interface ExportMetadata {
  format: string;
  size: number;
  dimensions: { width: number; height: number };
  nodeCount: number;
  edgeCount: number;
  generated: Date;
  version: string;
}

// =============================================
// PERFORMANCE AND OPTIMIZATION TYPES
// =============================================

export interface PerformanceConfig {
  virtualization: boolean;
  lodEnabled: boolean;
  maxVisibleNodes: number;
  clusteringThreshold: number;
  renderingEngine: 'canvas' | 'svg' | 'webgl';
  animationDuration: number;
  debounceDelay: number;
  cacheSize: number;
}

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

export interface ClusterConfig {
  enabled: boolean;
  algorithm: 'proximity' | 'semantic' | 'hierarchical' | 'community';
  minSize: number;
  maxSize: number;
  threshold: number;
}

// =============================================
// EVENT AND REAL-TIME TYPES
// =============================================

export interface TopologyEvent {
  type: TopologyEventType;
  source: string;
  timestamp: Date;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export type TopologyEventType = 
  | 'node-added'
  | 'node-removed'
  | 'node-updated'
  | 'edge-added'
  | 'edge-removed'
  | 'edge-updated'
  | 'health-changed'
  | 'status-changed'
  | 'metrics-updated'
  | 'annotation-added'
  | 'annotation-updated'
  | 'annotation-removed'
  | 'view-shared'
  | 'bookmark-added';

export interface RealtimeConfig {
  enabled: boolean;
  websocketUrl: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  subscriptions: RealtimeSubscription[];
}

export interface RealtimeSubscription {
  eventTypes: TopologyEventType[];
  filters: Record<string, unknown>;
  callback: (event: TopologyEvent) => void;
}

// =============================================
// CONTEXT AND PROVIDER TYPES
// =============================================

export interface TopologyContextValue {
  // State
  nodes: ServiceTopologyNode[];
  edges: ServiceTopologyEdge[];
  selectedNodes: string[];
  selectedEdges: string[];
  hoveredNode?: string;
  hoveredEdge?: string;
  
  // Configuration
  config: TopologyViewConfig;
  dataSources: TopologyDataSource[];
  
  // Actions
  updateConfig: (config: Partial<TopologyViewConfig>) => void;
  selectNodes: (nodeIds: string[], append?: boolean) => void;
  selectEdges: (edgeIds: string[], append?: boolean) => void;
  focusNode: (nodeId: string) => void;
  search: (query: SearchQuery) => Promise<SearchResult[]>;
  findPath: (query: PathFindingQuery) => Promise<PathResult>;
  exportView: (config: ExportConfig) => Promise<ExportResult>;
  
  // Real-time
  subscribe: (subscription: RealtimeSubscription) => () => void;
  
  // Collaboration
  addAnnotation: (annotation: Omit<Annotation, 'id' | 'created' | 'updated'>) => void;
  saveView: (view: Omit<TopologyView, 'id' | 'created' | 'updated' | 'version'>) => void;
  shareView: (viewId: string, sharing: SharingConfig) => void;
}

// =============================================
// COMPONENT PROPS TYPES
// =============================================

export interface ServiceTopologyProps {
  // Data
  initialNodes?: ServiceTopologyNode[];
  initialEdges?: ServiceTopologyEdge[];
  dataSources?: TopologyDataSource[];
  
  // Configuration
  config?: Partial<TopologyViewConfig>;
  height?: number;
  width?: number;
  
  // Callbacks
  onNodeClick?: (node: ServiceTopologyNode, event: React.MouseEvent) => void;
  onEdgeClick?: (edge: ServiceTopologyEdge, event: React.MouseEvent) => void;
  onSelectionChange?: (nodes: string[], edges: string[]) => void;
  onConfigChange?: (config: TopologyViewConfig) => void;
  
  // Features
  enableRealtime?: boolean;
  enableCollaboration?: boolean;
  enableExport?: boolean;
  enableSearch?: boolean;
  
  // Styling
  className?: string;
  style?: React.CSSProperties;
  theme?: 'light' | 'dark' | 'auto';
}

// =============================================
// HOOK TYPES
// =============================================

export interface UseTopologyDataOptions {
  dataSources: TopologyDataSource[];
  refreshInterval?: number;
  autoRefresh?: boolean;
  transformations?: DataTransformation[];
}

export interface DataTransformation {
  name: string;
  type: 'filter' | 'transform' | 'enrich' | 'aggregate';
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface UseTopologyLayoutOptions {
  algorithm: LayoutType;
  options: Record<string, unknown>;
  animate: boolean;
  duration: number;
}

export interface UseTopologySearchOptions {
  indexFields: string[];
  fuzzyThreshold: number;
  maxResults: number;
  enableHistory: boolean;
}

// Export everything for easy consumption
export type {
  // Core
  ServiceTopologyNode,
  ServiceNodeData,
  ServiceTopologyEdge,
  EdgeData,
  
  // Health and Status
  HealthStatus,
  ServiceStatus,
  ServiceMetrics,
  
  // Configuration
  TopologyViewConfig,
  FilterConfig,
  DisplayConfig,
  
  // Context
  TopologyContextValue,
  
  // Props
  ServiceTopologyProps
};