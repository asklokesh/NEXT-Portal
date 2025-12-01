/**
 * Enhanced Entity Types for Software Catalog
 * User-facing entity definitions with rich metadata
 */

/**
 * Base entity kinds supported by the catalog
 */
export type EntityKind =
  | 'Component'
  | 'API'
  | 'Resource'
  | 'System'
  | 'Domain'
  | 'Group'
  | 'User'
  | 'Location'
  | 'Template'
  | 'Infrastructure'
  | 'Pipeline'
  | 'Environment'
  | 'Secret';

/**
 * Component types
 */
export type ComponentType =
  | 'service'
  | 'website'
  | 'library'
  | 'frontend'
  | 'backend'
  | 'worker'
  | 'cron'
  | 'mobile'
  | 'cli'
  | 'plugin'
  | 'documentation';

/**
 * API types
 */
export type ApiType =
  | 'openapi'
  | 'asyncapi'
  | 'graphql'
  | 'grpc'
  | 'trpc'
  | 'rest'
  | 'soap'
  | 'websocket'
  | 'custom';

/**
 * Resource types
 */
export type ResourceType =
  | 'database'
  | 'cache'
  | 'queue'
  | 'storage'
  | 'cdn'
  | 's3-bucket'
  | 'kubernetes-cluster'
  | 'kubernetes-namespace'
  | 'load-balancer'
  | 'dns'
  | 'certificate'
  | 'secret-store'
  | 'monitoring'
  | 'logging'
  | 'custom';

/**
 * Lifecycle stages
 */
export type LifecycleStage =
  | 'experimental'
  | 'development'
  | 'alpha'
  | 'beta'
  | 'production'
  | 'deprecated'
  | 'end-of-life';

/**
 * Entity reference in format kind:namespace/name
 */
export type EntityRef = string;

/**
 * Base entity metadata
 */
export interface EntityMetadata {
  name: string;
  namespace: string;
  title?: string;
  description?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  tags?: string[];
  links?: EntityLink[];
  uid?: string;
  etag?: string;
  generation?: number;
}

/**
 * Entity link
 */
export interface EntityLink {
  url: string;
  title: string;
  icon?: string;
  type?: 'dashboard' | 'runbook' | 'documentation' | 'repository' | 'api-docs' | 'logs' | 'metrics' | 'alerts' | 'custom';
}

/**
 * Entity relation
 */
export interface EntityRelation {
  type: RelationType;
  targetRef: EntityRef;
}

/**
 * Relation types
 */
export type RelationType =
  | 'ownedBy'
  | 'ownerOf'
  | 'partOf'
  | 'hasPart'
  | 'dependsOn'
  | 'dependencyOf'
  | 'consumesApi'
  | 'apiConsumedBy'
  | 'providesApi'
  | 'apiProvidedBy'
  | 'memberOf'
  | 'hasMember'
  | 'parentOf'
  | 'childOf'
  | 'deployedTo'
  | 'hasDeployment';

/**
 * Base entity structure
 */
export interface Entity<T = Record<string, unknown>> {
  apiVersion: string;
  kind: EntityKind;
  metadata: EntityMetadata;
  spec: T;
  relations?: EntityRelation[];
  status?: EntityStatus;
}

/**
 * Entity status (runtime information)
 */
export interface EntityStatus {
  items?: EntityStatusItem[];
  lastProcessed?: string;
  lastUpdated?: string;
}

/**
 * Entity status item
 */
export interface EntityStatusItem {
  type: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  error?: {
    name: string;
    message: string;
  };
}

// ============================================
// Specific Entity Types
// ============================================

/**
 * Component spec
 */
export interface ComponentSpec {
  type: ComponentType;
  lifecycle: LifecycleStage;
  owner: EntityRef;
  system?: EntityRef;
  subcomponentOf?: EntityRef;
  providesApis?: EntityRef[];
  consumesApis?: EntityRef[];
  dependsOn?: EntityRef[];

  // Extended fields
  tier?: 'tier0' | 'tier1' | 'tier2' | 'tier3' | 'tier4';
  criticality?: 'critical' | 'high' | 'medium' | 'low';
  pagerdutyServiceId?: string;
  slackChannel?: string;
  onCallTeam?: string;
  repository?: string;
  ci?: {
    provider: 'github' | 'gitlab' | 'jenkins' | 'circleci' | 'argo';
    status?: 'passing' | 'failing' | 'pending';
    lastBuild?: string;
  };
  deployments?: DeploymentInfo[];
}

/**
 * Deployment information
 */
export interface DeploymentInfo {
  environment: string;
  cluster?: string;
  namespace?: string;
  replicas?: number;
  image?: string;
  version?: string;
  lastDeployed?: string;
  status?: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  healthCheckUrl?: string;
}

/**
 * Component entity type
 */
export type ComponentEntity = Entity<ComponentSpec>;

/**
 * API spec
 */
export interface ApiSpec {
  type: ApiType;
  lifecycle: LifecycleStage;
  owner: EntityRef;
  system?: EntityRef;
  definition: string;

  // Extended fields
  version?: string;
  servers?: ApiServer[];
  authentication?: ApiAuthentication;
  rateLimit?: ApiRateLimit;
  sla?: ApiSla;
}

/**
 * API server information
 */
export interface ApiServer {
  url: string;
  description?: string;
  environment?: string;
}

/**
 * API authentication configuration
 */
export interface ApiAuthentication {
  type: 'none' | 'api-key' | 'oauth2' | 'jwt' | 'basic' | 'custom';
  scopes?: string[];
  documentation?: string;
}

/**
 * API rate limit configuration
 */
export interface ApiRateLimit {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  burstLimit?: number;
}

/**
 * API SLA configuration
 */
export interface ApiSla {
  availability?: number; // percentage
  latencyP50?: number; // ms
  latencyP95?: number; // ms
  latencyP99?: number; // ms
  errorBudget?: number; // percentage
}

/**
 * API entity type
 */
export type ApiEntity = Entity<ApiSpec>;

/**
 * Resource spec
 */
export interface ResourceSpec {
  type: ResourceType;
  owner: EntityRef;
  system?: EntityRef;
  dependsOn?: EntityRef[];
  dependencyOf?: EntityRef[];

  // Extended fields
  provider?: 'aws' | 'gcp' | 'azure' | 'kubernetes' | 'on-premise' | 'custom';
  region?: string;
  tier?: string;
  size?: string;
  cost?: ResourceCost;
  connection?: ResourceConnection;
}

/**
 * Resource cost information
 */
export interface ResourceCost {
  estimated?: number;
  currency?: string;
  period?: 'hourly' | 'daily' | 'monthly' | 'yearly';
  lastUpdated?: string;
}

/**
 * Resource connection information
 */
export interface ResourceConnection {
  host?: string;
  port?: number;
  protocol?: string;
  secretRef?: string;
}

/**
 * Resource entity type
 */
export type ResourceEntity = Entity<ResourceSpec>;

/**
 * System spec
 */
export interface SystemSpec {
  owner: EntityRef;
  domain?: EntityRef;

  // Extended fields
  description?: string;
  techStack?: string[];
  documentation?: string;
  diagram?: string;
}

/**
 * System entity type
 */
export type SystemEntity = Entity<SystemSpec>;

/**
 * Domain spec
 */
export interface DomainSpec {
  owner: EntityRef;

  // Extended fields
  businessCapability?: string;
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
}

/**
 * Domain entity type
 */
export type DomainEntity = Entity<DomainSpec>;

/**
 * Group spec
 */
export interface GroupSpec {
  type: 'team' | 'business-unit' | 'product-area' | 'cost-center';
  profile?: {
    displayName?: string;
    email?: string;
    picture?: string;
  };
  parent?: EntityRef;
  children?: EntityRef[];
  members?: EntityRef[];

  // Extended fields
  slackChannel?: string;
  oncallSchedule?: string;
  manager?: EntityRef;
  costCenter?: string;
}

/**
 * Group entity type
 */
export type GroupEntity = Entity<GroupSpec>;

/**
 * User spec
 */
export interface UserSpec {
  profile?: {
    displayName?: string;
    email?: string;
    picture?: string;
  };
  memberOf?: EntityRef[];

  // Extended fields
  title?: string;
  department?: string;
  location?: string;
  manager?: EntityRef;
  startDate?: string;
  skills?: string[];
}

/**
 * User entity type
 */
export type UserEntity = Entity<UserSpec>;

/**
 * Environment spec
 */
export interface EnvironmentSpec {
  type: 'development' | 'staging' | 'production' | 'testing' | 'sandbox';
  owner: EntityRef;
  cloud?: 'aws' | 'gcp' | 'azure' | 'on-premise' | 'hybrid';
  region?: string;
  cluster?: string;
  components?: EntityRef[];
  accessControl?: EnvironmentAccess;
}

/**
 * Environment access control
 */
export interface EnvironmentAccess {
  readRoles?: string[];
  writeRoles?: string[];
  deployRoles?: string[];
  approvalRequired?: boolean;
}

/**
 * Environment entity type
 */
export type EnvironmentEntity = Entity<EnvironmentSpec>;

/**
 * Infrastructure spec
 */
export interface InfrastructureSpec {
  type: 'kubernetes' | 'vm' | 'serverless' | 'container' | 'bare-metal';
  provider: 'aws' | 'gcp' | 'azure' | 'on-premise' | 'custom';
  region?: string;
  owner: EntityRef;

  // Kubernetes specific
  kubernetes?: {
    cluster: string;
    version?: string;
    nodeCount?: number;
    nodePool?: string;
  };

  // Cost tracking
  cost?: ResourceCost;
}

/**
 * Infrastructure entity type
 */
export type InfrastructureEntity = Entity<InfrastructureSpec>;

// ============================================
// Search & Discovery Types
// ============================================

/**
 * Entity search query
 */
export interface EntitySearchQuery {
  text?: string;
  kinds?: EntityKind[];
  filters?: EntityFilter[];
  sortBy?: EntitySortOption;
  page?: number;
  pageSize?: number;
  facets?: string[];
}

/**
 * Entity filter
 */
export interface EntityFilter {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'nin' | 'contains' | 'startsWith' | 'exists' | 'gt' | 'gte' | 'lt' | 'lte';
  value: unknown;
}

/**
 * Entity sort option
 */
export interface EntitySortOption {
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * Search results
 */
export interface EntitySearchResults {
  items: Entity[];
  total: number;
  page: number;
  pageSize: number;
  facets?: EntityFacets;
}

/**
 * Search facets
 */
export interface EntityFacets {
  kinds?: FacetBucket[];
  types?: FacetBucket[];
  owners?: FacetBucket[];
  systems?: FacetBucket[];
  domains?: FacetBucket[];
  lifecycles?: FacetBucket[];
  tags?: FacetBucket[];
  [key: string]: FacetBucket[] | undefined;
}

/**
 * Facet bucket
 */
export interface FacetBucket {
  value: string;
  count: number;
  label?: string;
}

// ============================================
// Entity Graph Types
// ============================================

/**
 * Entity graph node
 */
export interface EntityGraphNode {
  id: EntityRef;
  kind: EntityKind;
  name: string;
  title?: string;
  type?: string;
  owner?: string;
  system?: string;
  lifecycle?: LifecycleStage;
}

/**
 * Entity graph edge
 */
export interface EntityGraphEdge {
  source: EntityRef;
  target: EntityRef;
  relationType: RelationType;
  metadata?: Record<string, unknown>;
}

/**
 * Entity graph
 */
export interface EntityGraph {
  nodes: EntityGraphNode[];
  edges: EntityGraphEdge[];
  stats?: {
    totalNodes: number;
    totalEdges: number;
    byKind: Record<string, number>;
    byRelationType: Record<string, number>;
  };
}

/**
 * Graph query options
 */
export interface EntityGraphQuery {
  rootRef: EntityRef;
  direction?: 'outbound' | 'inbound' | 'both';
  relationTypes?: RelationType[];
  maxDepth?: number;
  includeKinds?: EntityKind[];
  excludeKinds?: EntityKind[];
}
