# SaaS Model Implementation Plan

## Overview
Transform the portal into a true SaaS offering that matches Spotify Portal's "Backstage in a box" approach with enterprise-grade multi-tenancy, billing, and deployment capabilities.

## Multi-Tenant Architecture

### Tenant Isolation Strategy
```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Tenant    │  │   Tenant    │  │   Tenant    │        │
│  │  Router     │  │   Context   │  │ Middleware  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                Application Layer                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Schema Per  │  │ Row Level   │  │ Namespace   │        │
│  │   Tenant    │  │  Security   │  │ Isolation   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
├─────────────────────────────────────────────────────────────┤
│                  Data Layer                                │
└─────────────────────────────────────────────────────────────┘
```

### Tenant Management System
```typescript
interface TenantManagementService {
  // Tenant lifecycle
  createTenant(request: TenantCreationRequest): Promise<Tenant>
  provisionTenant(tenantId: string): Promise<TenantProvisioningResult>
  deleteTenant(tenantId: string): Promise<TenantDeletionResult>
  
  // Tenant configuration
  configureTenant(tenantId: string, config: TenantConfiguration): Promise<void>
  getTenantConfiguration(tenantId: string): Promise<TenantConfiguration>
  
  // Tenant scaling
  scaleTenant(tenantId: string, scaling: ScalingConfiguration): Promise<ScalingResult>
  
  // Tenant health
  getTenantHealth(tenantId: string): Promise<TenantHealth>
  monitorTenant(tenantId: string): Promise<TenantMonitoring>
  
  // Tenant backup and restore
  backupTenant(tenantId: string): Promise<BackupResult>
  restoreTenant(tenantId: string, backupId: string): Promise<RestoreResult>
}

interface Tenant {
  id: string
  name: string
  slug: string
  domain?: string
  subdomain: string
  plan: SubscriptionPlan
  status: TenantStatus
  configuration: TenantConfiguration
  resources: TenantResources
  metadata: TenantMetadata
  createdAt: Date
  updatedAt: Date
}

interface TenantConfiguration {
  // Branding
  branding: BrandingConfiguration
  
  // Authentication
  authentication: AuthenticationConfiguration
  
  // Features
  enabledFeatures: FeatureFlag[]
  featureLimits: FeatureLimits
  
  // Integrations
  integrations: IntegrationConfiguration[]
  
  // Security
  security: SecurityConfiguration
  
  // Compliance
  compliance: ComplianceConfiguration
}
```

### Data Isolation Patterns

#### Schema-per-Tenant (Primary)
```sql
-- Dynamic schema creation
CREATE SCHEMA tenant_${tenantId};

-- Tenant-specific tables
CREATE TABLE tenant_${tenantId}.entities (
  id UUID PRIMARY KEY,
  kind VARCHAR(50) NOT NULL,
  metadata JSONB NOT NULL,
  spec JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Row-level security as backup
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON entities
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

#### Tenant Context Middleware
```typescript
interface TenantContextMiddleware {
  // Tenant resolution
  resolveTenant(request: Request): Promise<TenantContext>
  
  // Context injection
  injectTenantContext(context: TenantContext): Promise<void>
  
  // Database connection routing
  routeToTenantDatabase(tenantId: string): Promise<DatabaseConnection>
  
  // Cache namespace
  getTenantCacheNamespace(tenantId: string): string
  
  // File storage prefix
  getTenantStoragePrefix(tenantId: string): string
}

interface TenantContext {
  tenantId: string
  tenantSlug: string
  userId?: string
  permissions: Permission[]
  configuration: TenantConfiguration
  limits: ResourceLimits
  metadata: TenantMetadata
}
```

## Subscription and Billing System

### Subscription Plans
```typescript
interface SubscriptionPlan {
  id: string
  name: string
  tier: 'starter' | 'professional' | 'enterprise' | 'custom'
  pricing: PricingModel
  features: PlanFeature[]
  limits: PlanLimits
  support: SupportLevel
  sla: SLAConfiguration
}

interface PricingModel {
  type: 'fixed' | 'usage_based' | 'tiered' | 'hybrid'
  basePrice: number
  currency: string
  billingPeriod: 'monthly' | 'quarterly' | 'yearly'
  usageMetrics: UsageMetric[]
  tiers?: PricingTier[]
}

interface PlanLimits {
  maxUsers: number
  maxEntities: number
  maxPlugins: number
  storageLimit: number // GB
  apiCallsPerMonth: number
  customDomains: number
  retentionPeriod: number // days
}

// Example plans matching Spotify Portal model
const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tier: 'starter',
    pricing: {
      type: 'fixed',
      basePrice: 29,
      currency: 'USD',
      billingPeriod: 'monthly'
    },
    limits: {
      maxUsers: 10,
      maxEntities: 100,
      maxPlugins: 5,
      storageLimit: 5,
      apiCallsPerMonth: 10000,
      customDomains: 0,
      retentionPeriod: 30
    }
  },
  {
    id: 'professional',
    name: 'Professional',
    tier: 'professional',
    pricing: {
      type: 'usage_based',
      basePrice: 99,
      currency: 'USD',
      billingPeriod: 'monthly',
      usageMetrics: [
        { name: 'additional_users', price: 15, unit: 'user' },
        { name: 'storage_overage', price: 2, unit: 'GB' }
      ]
    },
    limits: {
      maxUsers: 50,
      maxEntities: 1000,
      maxPlugins: 20,
      storageLimit: 50,
      apiCallsPerMonth: 100000,
      customDomains: 1,
      retentionPeriod: 90
    }
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tier: 'enterprise',
    pricing: {
      type: 'custom',
      basePrice: 500,
      currency: 'USD',
      billingPeriod: 'monthly'
    },
    limits: {
      maxUsers: -1, // unlimited
      maxEntities: -1,
      maxPlugins: -1,
      storageLimit: -1,
      apiCallsPerMonth: -1,
      customDomains: 5,
      retentionPeriod: 365
    }
  }
]
```

### Billing Engine
```typescript
interface BillingEngine {
  // Usage tracking
  trackUsage(tenantId: string, metric: UsageMetric, value: number): Promise<void>
  getUsageMetrics(tenantId: string, period: BillingPeriod): Promise<UsageReport>
  
  // Invoice generation
  generateInvoice(tenantId: string, period: BillingPeriod): Promise<Invoice>
  processPayment(invoiceId: string, paymentMethod: PaymentMethod): Promise<PaymentResult>
  
  // Subscription management
  createSubscription(tenantId: string, planId: string): Promise<Subscription>
  updateSubscription(subscriptionId: string, changes: SubscriptionChanges): Promise<Subscription>
  cancelSubscription(subscriptionId: string, reason?: string): Promise<CancellationResult>
  
  // Credit and discounts
  applyCoupon(tenantId: string, couponCode: string): Promise<CouponApplication>
  addCredit(tenantId: string, amount: number, reason: string): Promise<Credit>
  
  // Dunning management
  handleFailedPayment(invoiceId: string): Promise<DunningProcess>
  sendPaymentReminder(tenantId: string): Promise<NotificationResult>
}

interface UsageMetric {
  name: string
  value: number
  unit: string
  timestamp: Date
  metadata?: Record<string, any>
}

interface Invoice {
  id: string
  tenantId: string
  subscriptionId: string
  period: BillingPeriod
  lineItems: InvoiceLineItem[]
  subtotal: number
  taxes: TaxCalculation[]
  discounts: Discount[]
  total: number
  currency: string
  status: InvoiceStatus
  dueDate: Date
  paidAt?: Date
}
```

## Resource Management and Limits

### Resource Monitoring
```typescript
interface ResourceManager {
  // Resource allocation
  allocateResources(tenantId: string, resources: ResourceRequest): Promise<ResourceAllocation>
  deallocateResources(tenantId: string, allocationId: string): Promise<void>
  
  // Usage monitoring
  monitorResourceUsage(tenantId: string): Promise<ResourceUsage>
  getResourceMetrics(tenantId: string, timeRange: TimeRange): Promise<ResourceMetrics>
  
  // Limit enforcement
  enforceResourceLimits(tenantId: string): Promise<LimitEnforcement>
  checkResourceQuota(tenantId: string, resource: ResourceType): Promise<QuotaCheck>
  
  // Scaling
  autoScale(tenantId: string): Promise<ScalingAction>
  scaleResources(tenantId: string, scaling: ScalingRequest): Promise<ScalingResult>
  
  // Optimization
  optimizeResources(tenantId: string): Promise<OptimizationRecommendation[]>
  rightSizeResources(tenantId: string): Promise<RightSizingResult>
}

interface ResourceUsage {
  tenantId: string
  cpu: CPUUsage
  memory: MemoryUsage
  storage: StorageUsage
  network: NetworkUsage
  database: DatabaseUsage
  timestamp: Date
}

interface ResourceLimits {
  cpu: CPULimits
  memory: MemoryLimits
  storage: StorageLimits
  network: NetworkLimits
  database: DatabaseLimits
  api: APILimits
}
```

### Cost Management
```typescript
interface CostManagementService {
  // Cost tracking
  trackCost(tenantId: string, cost: CostEntry): Promise<void>
  getCostAnalysis(tenantId: string, period: CostPeriod): Promise<CostAnalysis>
  
  // Budgeting
  setBudget(tenantId: string, budget: Budget): Promise<void>
  monitorBudget(tenantId: string): Promise<BudgetStatus>
  
  // Optimization
  getCostOptimizationRecommendations(tenantId: string): Promise<CostOptimization[]>
  implementCostOptimization(tenantId: string, optimization: CostOptimization): Promise<OptimizationResult>
  
  // Forecasting
  forecastCosts(tenantId: string, period: ForecastPeriod): Promise<CostForecast>
  
  // Alerts
  configureCostAlerts(tenantId: string, alerts: CostAlert[]): Promise<void>
  checkCostAlerts(tenantId: string): Promise<AlertCheck[]>
}
```

## Tenant Onboarding and Provisioning

### Automated Onboarding Workflow
```typescript
interface OnboardingWorkflow {
  // Workflow definition
  startOnboarding(request: OnboardingRequest): Promise<OnboardingSession>
  
  // Step execution
  executeStep(sessionId: string, step: OnboardingStep): Promise<StepResult>
  validateStep(sessionId: string, stepData: StepData): Promise<ValidationResult>
  
  // Progress tracking
  getOnboardingProgress(sessionId: string): Promise<OnboardingProgress>
  
  // Completion
  completeOnboarding(sessionId: string): Promise<OnboardingCompletion>
  
  // Recovery
  recoverOnboarding(sessionId: string): Promise<RecoveryResult>
}

interface OnboardingStep {
  id: string
  name: string
  type: StepType
  required: boolean
  dependencies: string[]
  timeout: number
  retryable: boolean
  validator?: StepValidator
  processor: StepProcessor
}

// Onboarding steps
const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'tenant_creation',
    name: 'Create Tenant',
    type: 'system',
    required: true,
    dependencies: [],
    processor: createTenantProcessor
  },
  {
    id: 'database_setup',
    name: 'Setup Database',
    type: 'system',
    required: true,
    dependencies: ['tenant_creation'],
    processor: setupDatabaseProcessor
  },
  {
    id: 'github_integration',
    name: 'Connect GitHub',
    type: 'user',
    required: true,
    dependencies: ['database_setup'],
    processor: setupGitHubIntegrationProcessor
  },
  {
    id: 'initial_catalog_import',
    name: 'Import Initial Catalog',
    type: 'system',
    required: false,
    dependencies: ['github_integration'],
    processor: importCatalogProcessor
  },
  {
    id: 'plugin_selection',
    name: 'Select Plugins',
    type: 'user',
    required: false,
    dependencies: ['initial_catalog_import'],
    processor: installPluginsProcessor
  }
]
```

### Tenant Provisioning Engine
```typescript
interface TenantProvisioningEngine {
  // Infrastructure provisioning
  provisionInfrastructure(tenantId: string, spec: InfrastructureSpec): Promise<ProvisioningResult>
  
  // Database setup
  setupDatabase(tenantId: string, config: DatabaseConfig): Promise<DatabaseSetupResult>
  
  // Application deployment
  deployApplication(tenantId: string, config: ApplicationConfig): Promise<DeploymentResult>
  
  // DNS configuration
  configureDNS(tenantId: string, domain: DomainConfig): Promise<DNSConfigResult>
  
  // SSL certificate
  provisionSSL(tenantId: string, domain: string): Promise<SSLProvisioningResult>
  
  // Monitoring setup
  setupMonitoring(tenantId: string): Promise<MonitoringSetupResult>
  
  // Backup configuration
  configureBackups(tenantId: string): Promise<BackupConfigResult>
}
```

## Security and Compliance

### Multi-Tenant Security
```typescript
interface MultiTenantSecurity {
  // Tenant isolation
  enforceDataIsolation(tenantId: string): Promise<IsolationStatus>
  auditDataAccess(tenantId: string): Promise<AccessAudit>
  
  // Encryption
  encryptTenantData(tenantId: string, data: any): Promise<EncryptedData>
  decryptTenantData(tenantId: string, encryptedData: EncryptedData): Promise<any>
  
  // Key management
  rotateTenantKeys(tenantId: string): Promise<KeyRotationResult>
  manageTenantSecrets(tenantId: string): Promise<SecretsManagement>
  
  // Network security
  configureNetworkIsolation(tenantId: string): Promise<NetworkConfig>
  setupVPC(tenantId: string): Promise<VPCSetupResult>
  
  // Compliance
  generateComplianceReport(tenantId: string, standard: ComplianceStandard): Promise<ComplianceReport>
  auditCompliance(tenantId: string): Promise<ComplianceAudit>
}
```

### Data Privacy and GDPR
```typescript
interface DataPrivacyService {
  // Data mapping
  mapPersonalData(tenantId: string): Promise<DataMap>
  
  // Consent management
  recordConsent(tenantId: string, userId: string, consent: ConsentRecord): Promise<void>
  getConsentStatus(tenantId: string, userId: string): Promise<ConsentStatus>
  
  // Data portability
  exportUserData(tenantId: string, userId: string): Promise<UserDataExport>
  
  // Right to be forgotten
  deleteUserData(tenantId: string, userId: string): Promise<DeletionResult>
  
  // Data retention
  enforceRetentionPolicies(tenantId: string): Promise<RetentionEnforcement>
  
  // Breach notification
  reportDataBreach(tenantId: string, breach: DataBreach): Promise<BreachReport>
}
```

## API Management and Rate Limiting

### Multi-Tenant API Gateway
```typescript
interface MultiTenantAPIGateway {
  // Request routing
  routeRequest(request: APIRequest): Promise<RoutingDecision>
  
  // Rate limiting
  enforceRateLimit(tenantId: string, endpoint: string): Promise<RateLimitResult>
  configureRateLimit(tenantId: string, limits: RateLimitConfig): Promise<void>
  
  // Authentication
  authenticateRequest(request: APIRequest): Promise<AuthenticationResult>
  
  // Authorization
  authorizeRequest(request: APIRequest, context: TenantContext): Promise<AuthorizationResult>
  
  // Monitoring
  trackAPIUsage(tenantId: string, request: APIRequest): Promise<void>
  getAPIMetrics(tenantId: string): Promise<APIMetrics>
  
  // Throttling
  throttleRequests(tenantId: string): Promise<ThrottlingResult>
}

interface RateLimitConfig {
  globalLimits: RateLimit[]
  endpointLimits: EndpointRateLimit[]
  userLimits: UserRateLimit[]
  burstAllowance: number
  slidingWindow: boolean
}
```

## Monitoring and Observability

### Tenant-Aware Monitoring
```typescript
interface TenantMonitoringService {
  // Metrics collection
  collectTenantMetrics(tenantId: string): Promise<TenantMetrics>
  
  // Health monitoring
  monitorTenantHealth(tenantId: string): Promise<TenantHealthStatus>
  
  // Performance tracking
  trackTenantPerformance(tenantId: string): Promise<PerformanceMetrics>
  
  // Alerting
  configureTenantAlerts(tenantId: string, alerts: AlertConfig[]): Promise<void>
  checkTenantAlerts(tenantId: string): Promise<AlertStatus[]>
  
  // Dashboards
  generateTenantDashboard(tenantId: string): Promise<Dashboard>
  
  // Reporting
  generateTenantReport(tenantId: string, type: ReportType): Promise<Report>
}
```

This comprehensive SaaS model implementation provides:
- True multi-tenant architecture with proper isolation
- Flexible subscription and billing system
- Automated onboarding and provisioning
- Enterprise-grade security and compliance
- Resource management and cost optimization
- Scalable API gateway with rate limiting
- Comprehensive monitoring and observability