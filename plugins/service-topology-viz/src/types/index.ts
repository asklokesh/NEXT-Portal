/**
 * Service Topology Visualization Types
 * Production-ready type definitions for enterprise-scale service visualization
 */

import { Entity } from '@backstage/catalog-model';

// Core Service Node Types
export interface ServiceNode {
  id: string;
  name: string;
  type: ServiceType;
  metadata: ServiceMetadata;
  position?: Vector3D;
  health: HealthStatus;
  metrics: ServiceMetrics;
  dependencies: string[];
  dependents: string[];
  tags: string[];
  owner?: string;
  environment?: Environment;
  version?: string;
  lastDeployment?: Date;
  entity?: Entity;
}

export enum ServiceType {
  API = 'api',
  SERVICE = 'service',
  DATABASE = 'database',
  CACHE = 'cache',
  QUEUE = 'queue',
  STORAGE = 'storage',
  EXTERNAL = 'external',
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  MIDDLEWARE = 'middleware',
  GATEWAY = 'gateway',
  LOADBALANCER = 'loadbalancer'
}

export interface ServiceMetadata {
  description?: string;
  documentation?: string;
  repository?: string;
  runbook?: string;
  sla?: ServiceLevelAgreement;
  cost?: CostMetrics;
  compliance?: ComplianceInfo;
  criticality?: CriticalityLevel;
}

// Health and Monitoring Types
export interface HealthStatus {
  status: HealthState;
  timestamp: Date;
  details?: HealthDetails;
  incidents?: Incident[];
}

export enum HealthState {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
  MAINTENANCE = 'maintenance'
}

export interface HealthDetails {
  uptime: number;
  responseTime: number;
  errorRate: number;
  saturation: number;
  availability: number;
}

export interface ServiceMetrics {
  cpu: MetricValue;
  memory: MetricValue;
  network: NetworkMetrics;
  requests: RequestMetrics;
  errors: ErrorMetrics;
  latency: LatencyMetrics;
  throughput: number;
  customMetrics?: Record<string, MetricValue>;
}

export interface MetricValue {
  current: number;
  average: number;
  max: number;
  min: number;
  unit: string;
  trend?: TrendDirection;
  history?: TimeSeriesData[];
}

export enum TrendDirection {
  UP = 'up',
  DOWN = 'down',
  STABLE = 'stable'
}

// Relationship and Dependency Types
export interface ServiceRelationship {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  metadata: RelationshipMetadata;
  traffic?: TrafficFlow;
  latency?: number;
  errorRate?: number;
}

export enum RelationshipType {
  DEPENDS_ON = 'depends_on',
  CALLS = 'calls',
  PUBLISHES_TO = 'publishes_to',
  SUBSCRIBES_TO = 'subscribes_to',
  READS_FROM = 'reads_from',
  WRITES_TO = 'writes_to',
  LOAD_BALANCES = 'load_balances',
  ROUTES_TO = 'routes_to',
  PART_OF = 'part_of'
}

export interface RelationshipMetadata {
  protocol?: string;
  port?: number;
  endpoint?: string;
  authentication?: string;
  encryption?: boolean;
  criticality?: CriticalityLevel;
  dataFlow?: DataFlowInfo;
}

export interface TrafficFlow {
  volume: number;
  rate: number;
  pattern?: TrafficPattern;
  peakTime?: string;
  protocol?: string;
}

export enum TrafficPattern {
  CONSTANT = 'constant',
  BURST = 'burst',
  PERIODIC = 'periodic',
  RANDOM = 'random'
}

// Visualization Types
export interface VisualizationConfig {
  layout: LayoutType;
  renderMode: RenderMode;
  viewMode: ViewMode;
  filters: FilterConfig;
  clustering: ClusteringConfig;
  animation: AnimationConfig;
  interaction: InteractionConfig;
  performance: PerformanceConfig;
}

export enum LayoutType {
  FORCE_DIRECTED = 'force_directed',
  HIERARCHICAL = 'hierarchical',
  CIRCULAR = 'circular',
  GRID = 'grid',
  LAYERED = 'layered',
  RADIAL = 'radial',
  GEOGRAPHIC = 'geographic',
  CUSTOM = 'custom'
}

export enum RenderMode {
  CANVAS_2D = 'canvas_2d',
  SVG = 'svg',
  WEBGL = 'webgl',
  WEBGPU = 'webgpu'
}

export enum ViewMode {
  LOGICAL = 'logical',
  PHYSICAL = 'physical',
  NETWORK = 'network',
  SECURITY = 'security',
  COST = 'cost',
  PERFORMANCE = 'performance',
  DEPENDENCIES = 'dependencies',
  DATA_FLOW = 'data_flow'
}

export interface FilterConfig {
  environments?: Environment[];
  serviceTypes?: ServiceType[];
  healthStates?: HealthState[];
  tags?: string[];
  owners?: string[];
  criticalityLevels?: CriticalityLevel[];
  customFilters?: CustomFilter[];
}

export interface CustomFilter {
  id: string;
  name: string;
  condition: FilterCondition;
  value: any;
}

export interface ClusteringConfig {
  enabled: boolean;
  algorithm: ClusteringAlgorithm;
  threshold?: number;
  groupBy?: string[];
}

export enum ClusteringAlgorithm {
  HIERARCHICAL = 'hierarchical',
  KMEANS = 'kmeans',
  DBSCAN = 'dbscan',
  COMMUNITY = 'community'
}

// Animation and Interaction Types
export interface AnimationConfig {
  enabled: boolean;
  duration: number;
  easing: string;
  particleEffects?: boolean;
  trafficAnimation?: boolean;
  healthPulse?: boolean;
}

export interface InteractionConfig {
  zoom: ZoomConfig;
  pan: boolean;
  rotate: boolean;
  select: SelectionMode;
  hover: HoverConfig;
  contextMenu: boolean;
  keyboardShortcuts: boolean;
}

export interface ZoomConfig {
  enabled: boolean;
  min: number;
  max: number;
  wheelSensitivity: number;
  doubleTapZoom: boolean;
}

export enum SelectionMode {
  SINGLE = 'single',
  MULTIPLE = 'multiple',
  LASSO = 'lasso',
  BOX = 'box'
}

export interface HoverConfig {
  enabled: boolean;
  delay: number;
  showTooltip: boolean;
  highlightConnections: boolean;
  dimOthers: boolean;
}

// Performance Configuration
export interface PerformanceConfig {
  maxNodes: number;
  maxEdges: number;
  levelOfDetail: LevelOfDetail;
  culling: CullingConfig;
  batching: boolean;
  instancing: boolean;
  workers: boolean;
  caching: CacheConfig;
}

export enum LevelOfDetail {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  ULTRA = 'ultra'
}

export interface CullingConfig {
  frustum: boolean;
  occlusion: boolean;
  distance: boolean;
  backface: boolean;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  strategy: CacheStrategy;
}

export enum CacheStrategy {
  LRU = 'lru',
  LFU = 'lfu',
  FIFO = 'fifo'
}

// Time-based Analysis Types
export interface TimeRange {
  start: Date;
  end: Date;
  granularity?: TimeGranularity;
}

export enum TimeGranularity {
  SECOND = 'second',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month'
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface PlaybackConfig {
  enabled: boolean;
  speed: number;
  loop: boolean;
  range: TimeRange;
  showControls: boolean;
  autoPlay: boolean;
}

// Export and Sharing Types
export interface ExportConfig {
  format: ExportFormat;
  quality?: number;
  includeMetadata?: boolean;
  watermark?: boolean;
}

export enum ExportFormat {
  PNG = 'png',
  SVG = 'svg',
  PDF = 'pdf',
  JSON = 'json',
  GRAPHML = 'graphml',
  DOT = 'dot',
  GEXF = 'gexf'
}

// Supporting Types
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export enum Environment {
  PRODUCTION = 'production',
  STAGING = 'staging',
  DEVELOPMENT = 'development',
  TEST = 'test',
  UAT = 'uat',
  DEMO = 'demo'
}

export enum CriticalityLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  MINIMAL = 'minimal'
}

export interface ServiceLevelAgreement {
  availability: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
}

export interface CostMetrics {
  monthly: number;
  hourly: number;
  currency: string;
  breakdown?: CostBreakdown;
}

export interface CostBreakdown {
  compute: number;
  storage: number;
  network: number;
  other: number;
}

export interface ComplianceInfo {
  standards: string[];
  certifications: string[];
  lastAudit?: Date;
  nextAudit?: Date;
}

export interface Incident {
  id: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startTime: Date;
  endTime?: Date;
  description: string;
  impact?: string;
}

export enum IncidentSeverity {
  CRITICAL = 'critical',
  MAJOR = 'major',
  MINOR = 'minor',
  WARNING = 'warning'
}

export enum IncidentStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  INVESTIGATING = 'investigating',
  MITIGATED = 'mitigated'
}

export interface NetworkMetrics {
  inbound: MetricValue;
  outbound: MetricValue;
  connections: number;
  packetLoss: number;
}

export interface RequestMetrics {
  total: number;
  rate: number;
  successful: number;
  failed: number;
}

export interface ErrorMetrics {
  total: number;
  rate: number;
  types: Record<string, number>;
}

export interface LatencyMetrics {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  average: number;
}

export interface DataFlowInfo {
  volume: number;
  format: string;
  encrypted: boolean;
  compressed: boolean;
}

export interface FilterCondition {
  field: string;
  operator: FilterOperator;
  value: any;
}

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  IN = 'in',
  NOT_IN = 'not_in'
}

// Graph Algorithm Types
export interface PathFindingResult {
  path: string[];
  cost: number;
  distance: number;
  metadata?: Record<string, any>;
}

export interface ImpactAnalysisResult {
  affected: ServiceNode[];
  directImpact: ServiceNode[];
  indirectImpact: ServiceNode[];
  criticalPath: string[];
  riskScore: number;
}

export interface DependencyAnalysisResult {
  cycles: string[][];
  levels: Map<number, ServiceNode[]>;
  criticalDependencies: ServiceRelationship[];
  bottlenecks: ServiceNode[];
}

// Event Types for Real-time Updates
export interface TopologyEvent {
  type: TopologyEventType;
  timestamp: Date;
  data: any;
  source?: string;
}

export enum TopologyEventType {
  NODE_ADDED = 'node_added',
  NODE_UPDATED = 'node_updated',
  NODE_REMOVED = 'node_removed',
  EDGE_ADDED = 'edge_added',
  EDGE_UPDATED = 'edge_updated',
  EDGE_REMOVED = 'edge_removed',
  HEALTH_CHANGED = 'health_changed',
  METRIC_UPDATED = 'metric_updated',
  INCIDENT_CREATED = 'incident_created',
  INCIDENT_RESOLVED = 'incident_resolved',
  DEPLOYMENT_STARTED = 'deployment_started',
  DEPLOYMENT_COMPLETED = 'deployment_completed'
}