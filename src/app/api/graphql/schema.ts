/**
 * GraphQL Schema Definitions
 */

export const typeDefs = `
  scalar Date
  scalar JSON
  scalar URL

  # Common Types
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  interface Node {
    id: ID!
  }

  type Error {
    message: String!
    code: String
    path: [String]
  }

  type MutationResponse {
    success: Boolean!
    message: String
    errors: [Error]
  }

  # User Types
  type User implements Node {
    id: ID!
    email: String!
    name: String!
    avatar: URL
    roles: [Role!]!
    organizations: [Organization!]!
    teams: [Team!]!
    createdAt: Date!
    updatedAt: Date!
  }

  type Role {
    id: ID!
    name: String!
    permissions: [Permission!]!
  }

  type Permission {
    id: ID!
    name: String!
    resource: String!
    action: String!
  }

  # Service Types
  type Service implements Node {
    id: ID!
    name: String!
    description: String
    type: ServiceType!
    status: ServiceStatus!
    owner: User!
    tags: [String!]!
    metadata: ServiceMetadata!
    dependencies: [Dependency!]
    plugins: [Plugin!]
    health: HealthStatus!
    createdAt: Date!
    updatedAt: Date!
    version: Int!
  }

  type ServiceMetadata {
    repository: String
    documentation: URL
    apiSpec: URL
    environments: [String!]
    customFields: JSON
  }

  type Dependency {
    id: ID!
    service: Service!
    dependsOn: Service!
    type: DependencyType!
    version: String
    isRequired: Boolean!
  }

  type HealthStatus {
    state: HealthState!
    message: String
    checks: [HealthCheck!]!
    lastChecked: Date!
  }

  type HealthCheck {
    name: String!
    status: HealthState!
    message: String
    responseTime: Int
  }

  enum ServiceType {
    API
    BACKEND
    FRONTEND
    DATABASE
    LIBRARY
    TOOL
    INFRASTRUCTURE
  }

  enum ServiceStatus {
    ACTIVE
    INACTIVE
    DEPRECATED
    MAINTENANCE
    DEVELOPMENT
  }

  enum DependencyType {
    RUNTIME
    BUILD
    TEST
    OPTIONAL
  }

  enum HealthState {
    HEALTHY
    DEGRADED
    UNHEALTHY
    UNKNOWN
  }

  # Plugin Types
  type Plugin implements Node {
    id: ID!
    name: String!
    description: String
    version: String!
    author: String!
    category: PluginCategory!
    status: PluginStatus!
    icon: URL
    documentation: URL
    repository: URL
    dependencies: [PluginDependency!]!
    configuration: PluginConfiguration
    metrics: PluginMetrics!
    installedCount: Int!
    rating: Float
    reviews: [PluginReview!]!
    createdAt: Date!
    updatedAt: Date!
  }

  type PluginDependency {
    name: String!
    version: String!
    required: Boolean!
  }

  type PluginConfiguration {
    schema: JSON!
    defaults: JSON
    required: [String!]!
  }

  type PluginMetrics {
    downloads: Int!
    activeInstalls: Int!
    avgLoadTime: Float
    errorRate: Float
    satisfaction: Float
  }

  type PluginReview {
    id: ID!
    user: User!
    rating: Int!
    comment: String
    createdAt: Date!
  }

  enum PluginCategory {
    AUTHENTICATION
    AUTHORIZATION
    CI_CD
    MONITORING
    ANALYTICS
    SECURITY
    DOCUMENTATION
    DEVELOPMENT
    TESTING
    DEPLOYMENT
    COLLABORATION
    INTEGRATION
  }

  enum PluginStatus {
    AVAILABLE
    INSTALLED
    UPDATING
    ERROR
    DEPRECATED
  }

  # Template Types
  type Template implements Node {
    id: ID!
    name: String!
    description: String
    category: TemplateCategory!
    tags: [String!]!
    parameters: [TemplateParameter!]!
    steps: [TemplateStep!]!
    owner: User!
    visibility: Visibility!
    usageCount: Int!
    rating: Float
    createdAt: Date!
    updatedAt: Date!
  }

  type TemplateParameter {
    name: String!
    type: ParameterType!
    description: String
    default: String
    required: Boolean!
    validation: JSON
  }

  type TemplateStep {
    id: ID!
    name: String!
    action: String!
    parameters: JSON!
    condition: String
  }

  enum TemplateCategory {
    SERVICE
    LIBRARY
    DOCUMENTATION
    INFRASTRUCTURE
    DEPLOYMENT
    TESTING
    CUSTOM
  }

  enum ParameterType {
    STRING
    NUMBER
    BOOLEAN
    ARRAY
    OBJECT
    SELECT
    MULTISELECT
  }

  enum Visibility {
    PUBLIC
    PRIVATE
    ORGANIZATION
  }

  # Organization Types
  type Organization implements Node {
    id: ID!
    name: String!
    description: String
    logo: URL
    teams: [Team!]!
    members: [User!]!
    services: [Service!]!
    createdAt: Date!
    updatedAt: Date!
  }

  type Team implements Node {
    id: ID!
    name: String!
    description: String
    organization: Organization!
    members: [User!]!
    services: [Service!]!
    createdAt: Date!
    updatedAt: Date!
  }

  # Notification Types
  type Notification implements Node {
    id: ID!
    type: NotificationType!
    title: String!
    message: String!
    recipient: User!
    read: Boolean!
    metadata: JSON
    createdAt: Date!
  }

  enum NotificationType {
    INFO
    WARNING
    ERROR
    SUCCESS
    SYSTEM
  }

  # Audit Types
  type AuditLog implements Node {
    id: ID!
    user: User!
    action: String!
    resourceType: String!
    resourceId: String!
    metadata: JSON
    timestamp: Date!
  }

  # Cost Types
  type CostReport {
    totalCost: Float!
    projectedCost: Float!
    services: [ServiceCost!]!
    trends: [CostTrend!]!
    recommendations: [CostRecommendation!]!
  }

  type ServiceCost {
    service: Service!
    currentCost: Float!
    projectedCost: Float!
    breakdown: JSON!
  }

  type CostTrend {
    date: Date!
    cost: Float!
  }

  type CostRecommendation {
    title: String!
    description: String!
    potentialSavings: Float!
    priority: Priority!
  }

  enum Priority {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  # Metrics Types
  type Metric {
    name: String!
    value: Float!
    unit: String
    timestamp: Date!
    labels: JSON
  }

  type TimeSeries {
    label: String!
    data: [DataPoint!]!
  }

  type DataPoint {
    timestamp: Date!
    value: Float!
  }

  # Connection Types
  type ServiceConnection {
    edges: [ServiceEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ServiceEdge {
    node: Service!
    cursor: String!
  }

  type PluginConnection {
    edges: [PluginEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PluginEdge {
    node: Plugin!
    cursor: String!
  }

  type TemplateConnection {
    edges: [TemplateEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type TemplateEdge {
    node: Template!
    cursor: String!
  }

  # Input Types
  input ServiceFilter {
    search: String
    type: ServiceType
    status: ServiceStatus
    tags: [String!]
    ownerId: ID
  }

  input ServiceSort {
    field: ServiceSortField!
    direction: SortDirection!
  }

  enum ServiceSortField {
    NAME
    CREATED_AT
    UPDATED_AT
    STATUS
    TYPE
  }

  enum SortDirection {
    ASC
    DESC
  }

  input CreateServiceInput {
    name: String!
    description: String
    type: ServiceType!
    tags: [String!]
    metadata: ServiceMetadataInput
  }

  input ServiceMetadataInput {
    repository: String
    documentation: URL
    apiSpec: URL
    environments: [String!]
    customFields: JSON
  }

  input UpdateServiceInput {
    name: String
    description: String
    status: ServiceStatus
    tags: [String!]
    metadata: ServiceMetadataInput
  }

  # Query Root
  type Query {
    # Service queries
    service(id: ID!): Service
    services(
      first: Int
      after: String
      filter: ServiceFilter
      sort: ServiceSort
    ): ServiceConnection!
    serviceStats: ServiceStats!
    serviceDependencyGraph(serviceId: ID!): DependencyGraph!
    
    # Plugin queries
    plugin(id: ID!): Plugin
    plugins(
      first: Int
      after: String
      category: PluginCategory
      search: String
    ): PluginConnection!
    recommendedPlugins(serviceId: ID!): [Plugin!]!
    
    # Template queries
    template(id: ID!): Template
    templates(
      first: Int
      after: String
      category: TemplateCategory
      search: String
    ): TemplateConnection!
    
    # User queries
    me: User
    user(id: ID!): User
    users(first: Int, after: String): UserConnection!
    
    # Organization queries
    organization(id: ID!): Organization
    organizations: [Organization!]!
    
    # Notification queries
    notifications(
      first: Int
      after: String
      unreadOnly: Boolean
    ): NotificationConnection!
    
    # Audit queries
    auditLogs(
      first: Int
      after: String
      userId: ID
      resourceType: String
    ): AuditLogConnection!
    
    # Cost queries
    costReport(period: String!): CostReport!
    
    # Metrics queries
    metrics(
      serviceId: ID!
      metricNames: [String!]!
      from: Date!
      to: Date!
    ): [TimeSeries!]!
  }

  # Mutation Root
  type Mutation {
    # Service mutations
    createService(input: CreateServiceInput!): Service!
    updateService(id: ID!, input: UpdateServiceInput!): Service!
    deleteService(id: ID!): MutationResponse!
    
    # Plugin mutations
    installPlugin(id: ID!, configuration: JSON): Plugin!
    updatePluginConfig(id: ID!, configuration: JSON!): Plugin!
    uninstallPlugin(id: ID!): MutationResponse!
    
    # Template mutations
    createTemplate(input: CreateTemplateInput!): Template!
    updateTemplate(id: ID!, input: UpdateTemplateInput!): Template!
    deleteTemplate(id: ID!): MutationResponse!
    executeTemplate(id: ID!, parameters: JSON!): TemplateExecution!
    
    # Notification mutations
    markNotificationAsRead(id: ID!): Notification!
    markAllNotificationsAsRead: MutationResponse!
    
    # User mutations
    updateProfile(input: UpdateProfileInput!): User!
    updatePreferences(preferences: JSON!): User!
  }

  # Subscription Root
  type Subscription {
    # Service subscriptions
    serviceCreated: Service!
    serviceUpdated(id: ID): Service!
    serviceDeleted: ID!
    serviceHealthChanged(id: ID!): HealthStatus!
    
    # Plugin subscriptions
    pluginInstalled: Plugin!
    pluginUpdated(id: ID): Plugin!
    pluginUninstalled: ID!
    
    # Template subscriptions
    templateExecutionProgress(executionId: ID!): TemplateExecutionUpdate!
    
    # Notification subscriptions
    notificationReceived(userId: ID!): Notification!
    
    # Metrics subscriptions
    metricsUpdate(serviceId: ID!): Metric!
    
    # Cost subscriptions
    costAlert: CostAlert!
  }

  # Additional Types
  type ServiceStats {
    total: Int!
    active: Int!
    inactive: Int!
    deprecated: Int!
    byType: [ServiceTypeCount!]!
  }

  type ServiceTypeCount {
    type: ServiceType!
    count: Int!
  }

  type DependencyGraph {
    nodes: [DependencyNode!]!
    edges: [DependencyEdge!]!
  }

  type DependencyNode {
    id: ID!
    service: Service!
    level: Int!
  }

  type DependencyEdge {
    from: ID!
    to: ID!
    type: DependencyType!
  }

  type UserConnection {
    edges: [UserEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type UserEdge {
    node: User!
    cursor: String!
  }

  type NotificationConnection {
    edges: [NotificationEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
    unreadCount: Int!
  }

  type NotificationEdge {
    node: Notification!
    cursor: String!
  }

  type AuditLogConnection {
    edges: [AuditLogEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AuditLogEdge {
    node: AuditLog!
    cursor: String!
  }

  input CreateTemplateInput {
    name: String!
    description: String
    category: TemplateCategory!
    tags: [String!]
    parameters: [TemplateParameterInput!]!
    steps: [TemplateStepInput!]!
    visibility: Visibility!
  }

  input TemplateParameterInput {
    name: String!
    type: ParameterType!
    description: String
    default: String
    required: Boolean!
    validation: JSON
  }

  input TemplateStepInput {
    name: String!
    action: String!
    parameters: JSON!
    condition: String
  }

  input UpdateTemplateInput {
    name: String
    description: String
    tags: [String!]
    parameters: [TemplateParameterInput!]
    steps: [TemplateStepInput!]
    visibility: Visibility
  }

  type TemplateExecution {
    id: ID!
    template: Template!
    status: ExecutionStatus!
    progress: Int!
    logs: [String!]!
    result: JSON
    createdAt: Date!
    completedAt: Date
  }

  enum ExecutionStatus {
    PENDING
    RUNNING
    COMPLETED
    FAILED
    CANCELLED
  }

  type TemplateExecutionUpdate {
    executionId: ID!
    status: ExecutionStatus!
    progress: Int!
    message: String
  }

  input UpdateProfileInput {
    name: String
    avatar: URL
  }

  type CostAlert {
    id: ID!
    title: String!
    message: String!
    service: Service
    currentCost: Float!
    threshold: Float!
    severity: Priority!
    timestamp: Date!
  }
`;