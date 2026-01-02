-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'PLATFORM_ENGINEER', 'DEVELOPER', 'VIEWER');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('OWNER', 'MAINTAINER', 'MEMBER');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('SERVICE', 'WEBSITE', 'LIBRARY', 'DOCUMENTATION', 'TOOL', 'DATABASE', 'INFRASTRUCTURE');

-- CreateEnum
CREATE TYPE "Lifecycle" AS ENUM ('EXPERIMENTAL', 'PRODUCTION', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('HARD', 'SOFT', 'API', 'DATABASE', 'MESSAGING');

-- CreateEnum
CREATE TYPE "HealthCheckType" AS ENUM ('HTTP', 'TCP', 'DATABASE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('COUNTER', 'GAUGE', 'HISTOGRAM', 'SUMMARY');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'DEPLOYING', 'DEPLOYED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('README', 'API_DOCS', 'RUNBOOK', 'ARCHITECTURE', 'OTHER');

-- CreateEnum
CREATE TYPE "VersionStatus" AS ENUM ('PENDING', 'VALIDATING', 'READY', 'DEPLOYING', 'DEPLOYED', 'FAILED', 'ROLLED_BACK', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VersionSource" AS ENUM ('NPM', 'GIT', 'LOCAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DeploymentStrategy" AS ENUM ('ROLLING', 'BLUE_GREEN', 'CANARY', 'IMMEDIATE');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('FULL', 'INCREMENTAL', 'CONFIGURATION', 'DATABASE_SNAPSHOT', 'FILE_SYSTEM', 'COMBINED');

-- CreateEnum
CREATE TYPE "BackupSource" AS ENUM ('AUTOMATIC', 'MANUAL', 'SCHEDULED', 'PRE_DEPLOYMENT', 'POST_DEPLOYMENT', 'ROLLBACK');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('PENDING', 'CREATING', 'UPLOADING', 'COMPLETED', 'FAILED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "PluginCategory" AS ENUM ('AUTHENTICATION', 'AUTHORIZATION', 'CICD', 'CLOUD_INFRASTRUCTURE', 'CONTAINER_ORCHESTRATION', 'COST_MANAGEMENT', 'DEPLOYMENT', 'DOCUMENTATION', 'MONITORING_OBSERVABILITY', 'SECURITY_COMPLIANCE', 'SERVICE_CATALOG', 'SOFTWARE_TEMPLATES', 'SOURCE_CODE_MANAGEMENT', 'SEARCH_DISCOVERY', 'ANALYTICS_REPORTING', 'COLLABORATION', 'TESTING_QUALITY', 'DATABASE', 'MESSAGING', 'MACHINE_LEARNING', 'API_MANAGEMENT', 'WORKFLOW_AUTOMATION', 'CUSTOM', 'OTHER');

-- CreateEnum
CREATE TYPE "TenantScope" AS ENUM ('PUBLIC', 'PRIVATE', 'RESTRICTED', 'INTERNAL');

-- CreateEnum
CREATE TYPE "PluginStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DEPRECATED', 'ARCHIVED', 'BLOCKED', 'PENDING_APPROVAL');

-- CreateEnum
CREATE TYPE "PluginLifecycle" AS ENUM ('ALPHA', 'BETA', 'STABLE', 'DEPRECATED', 'END_OF_LIFE');

-- CreateEnum
CREATE TYPE "PluginSource" AS ENUM ('MARKETPLACE', 'GIT_REPOSITORY', 'NPM_REGISTRY', 'LOCAL_FILE', 'DOCKER_REGISTRY', 'INTERNAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PluginOperationType" AS ENUM ('INSTALL', 'UNINSTALL', 'ENABLE', 'DISABLE', 'UPDATE', 'CONFIGURE', 'BACKUP', 'RESTORE', 'HEALTH_CHECK', 'RESTART', 'ROLLBACK', 'MIGRATE', 'SCAN_VULNERABILITIES', 'PERFORMANCE_TEST', 'VALIDATE', 'SYNC_DEPENDENCIES', 'CLEANUP');

-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'RETRYING', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "ConfigValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'ARRAY', 'ENCRYPTED');

-- CreateEnum
CREATE TYPE "DependencyStatus" AS ENUM ('SATISFIED', 'UNSATISFIED', 'CONFLICT', 'VERSION_MISMATCH', 'MISSING', 'DEPRECATED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RestoreType" AS ENUM ('POINT_IN_TIME', 'VERSION_ROLLBACK', 'CONFIGURATION_ONLY', 'DATABASE_ONLY', 'FULL_RESTORE');

-- CreateEnum
CREATE TYPE "MigrationType" AS ENUM ('DATABASE_SCHEMA', 'CONFIGURATION', 'FILE_SYSTEM', 'PERMISSIONS', 'DEPENDENCIES', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MigrationStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'ROLLED_BACK', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('INSTALL', 'UPDATE', 'CONFIGURATION_CHANGE', 'UNINSTALL', 'SECURITY_EXEMPTION', 'POLICY_OVERRIDE', 'EMERGENCY_DEPLOYMENT');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'CONDITIONALLY_APPROVED');

-- CreateEnum
CREATE TYPE "ApprovalPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "AnalyticsEvent" AS ENUM ('VIEW', 'INSTALL', 'UNINSTALL', 'ENABLE', 'DISABLE', 'CONFIGURE', 'UPDATE', 'ERROR', 'PERFORMANCE_ISSUE', 'SECURITY_ALERT', 'USER_INTERACTION', 'API_CALL', 'RENDER', 'LOAD', 'CRASH');

-- CreateEnum
CREATE TYPE "PerformanceMetric" AS ENUM ('LOAD_TIME', 'RENDER_TIME', 'MEMORY_USAGE', 'CPU_USAGE', 'NETWORK_LATENCY', 'ERROR_RATE', 'THROUGHPUT', 'RESPONSE_TIME', 'BUNDLE_SIZE', 'CACHE_HIT_RATE', 'GARBAGE_COLLECTION', 'DATABASE_QUERY_TIME');

-- CreateEnum
CREATE TYPE "VulnerabilitySeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "VulnerabilityStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PATCHED', 'RESOLVED', 'DISMISSED', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "TestType" AS ENUM ('UNIT', 'INTEGRATION', 'E2E', 'PERFORMANCE', 'SECURITY', 'ACCESSIBILITY', 'COMPATIBILITY', 'SMOKE', 'REGRESSION', 'LOAD');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('PENDING', 'RUNNING', 'PASSED', 'FAILED', 'UNSTABLE', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WorkflowTrigger" AS ENUM ('MANUAL', 'SCHEDULED', 'ON_INSTALL', 'ON_UPDATE', 'ON_CONFIGURE', 'ON_ERROR', 'ON_PERFORMANCE_ALERT', 'ON_SECURITY_ALERT', 'ON_APPROVAL', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "DisasterRecoveryType" AS ENUM ('FULL_BACKUP', 'INCREMENTAL_BACKUP', 'RESTORE_TEST', 'ACTUAL_RECOVERY', 'SCHEDULED_TEST');

-- CreateEnum
CREATE TYPE "DisasterRecoveryStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELINQUENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'UNPAID', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('COMPUTE_HOURS', 'STORAGE_GB', 'NETWORK_GB', 'API_CALLS', 'CONTAINERS', 'USERS', 'PLUGINS', 'DEPLOYMENTS', 'BUILDS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER', 'PAYPAL', 'WIRE_TRANSFER', 'CREDIT', 'OTHER');

-- CreateEnum
CREATE TYPE "RefundReason" AS ENUM ('DUPLICATE', 'FRAUDULENT', 'REQUESTED_BY_CUSTOMER', 'SERVICE_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('ISSUED', 'APPLIED', 'VOIDED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_TRIAL_EXTENSION');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('FREE', 'ONE_TIME', 'SUBSCRIPTION', 'USAGE_BASED', 'FREEMIUM');

-- CreateEnum
CREATE TYPE "MarketplaceTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('PENDING', 'COMPLETED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('BUDGET_EXCEEDED', 'BUDGET_THRESHOLD', 'PAYMENT_FAILED', 'SUBSCRIPTION_EXPIRING', 'UNUSUAL_USAGE', 'CREDIT_LOW');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SecurityRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SecurityScanStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('SIGNATURE_VERIFICATION', 'CHECKSUM_VALIDATION', 'VULNERABILITY_DETECTED', 'TRUST_SCORE_CHANGED', 'POLICY_VIOLATION', 'MALWARE_DETECTED', 'COMPLIANCE_FAILURE', 'APPROVAL_REQUEST', 'EXEMPTION_GRANTED', 'SCAN_COMPLETED');

-- CreateEnum
CREATE TYPE "SecurityEventSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SecurityEventStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "PublisherTrustLevel" AS ENUM ('UNKNOWN', 'UNVERIFIED', 'BASIC', 'VERIFIED', 'TRUSTED', 'CERTIFIED');

-- CreateEnum
CREATE TYPE "SecurityPolicyType" AS ENUM ('SIGNATURE_REQUIRED', 'CHECKSUM_REQUIRED', 'TRUST_THRESHOLD', 'VULNERABILITY_LIMITS', 'PUBLISHER_ALLOWLIST', 'PACKAGE_SIZE_LIMIT', 'COMPLIANCE_REQUIRED', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PolicyEnforcement" AS ENUM ('DISABLED', 'WARN', 'BLOCK', 'REQUIRE_APPROVAL');

-- CreateEnum
CREATE TYPE "SecurityScanType" AS ENUM ('VULNERABILITY', 'MALWARE', 'DEPENDENCY', 'LICENSE', 'COMPLIANCE', 'STATIC_ANALYSIS', 'DYNAMIC_ANALYSIS', 'COMPOSITE');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('UNKNOWN', 'PENDING', 'COMPLIANT', 'NON_COMPLIANT', 'CONDITIONALLY_COMPLIANT', 'EXEMPTED');

-- CreateEnum
CREATE TYPE "ComplianceReportType" AS ENUM ('PLUGIN_SECURITY', 'VULNERABILITY_ASSESSMENT', 'POLICY_COMPLIANCE', 'TRUST_EVALUATION', 'COMPREHENSIVE');

-- CreateEnum
CREATE TYPE "SecurityApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONDITIONALLY_APPROVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QualityGrade" AS ENUM ('A', 'B', 'C', 'D', 'F');

-- CreateEnum
CREATE TYPE "QualityCategory" AS ENUM ('SECURITY', 'PERFORMANCE', 'MAINTAINABILITY', 'RELIABILITY', 'DOCUMENTATION', 'COMPLIANCE', 'USABILITY', 'TESTABILITY');

-- CreateEnum
CREATE TYPE "QualityCheckType" AS ENUM ('VULNERABILITY_SCAN', 'DEPENDENCY_AUDIT', 'SECRETS_DETECTION', 'PERMISSION_ANALYSIS', 'SECURITY_POLICY_COMPLIANCE', 'BUNDLE_SIZE_ANALYSIS', 'LOAD_TIME_ANALYSIS', 'MEMORY_USAGE_CHECK', 'CPU_USAGE_CHECK', 'DATABASE_QUERY_ANALYSIS', 'CODE_COMPLEXITY', 'CODE_COVERAGE', 'TECHNICAL_DEBT', 'CODE_DUPLICATION', 'CODING_STANDARDS', 'ERROR_RATE_ANALYSIS', 'UPTIME_MONITORING', 'DEPENDENCY_HEALTH', 'API_RELIABILITY', 'FAILURE_RECOVERY', 'README_QUALITY', 'API_DOCUMENTATION', 'CODE_COMMENTS', 'CHANGELOG_QUALITY', 'SETUP_INSTRUCTIONS', 'LICENSE_COMPLIANCE', 'POLICY_COMPLIANCE', 'REGULATORY_COMPLIANCE', 'ACCESSIBILITY_COMPLIANCE', 'CUSTOM_RULE', 'COMPOSITE_CHECK');

-- CreateEnum
CREATE TYPE "QualityCheckStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED', 'TIMEOUT', 'ERROR');

-- CreateEnum
CREATE TYPE "CheckSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "TrendDirection" AS ENUM ('IMPROVING', 'STABLE', 'DECLINING', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "HistoryTrigger" AS ENUM ('SCHEDULED_EVALUATION', 'MANUAL_EVALUATION', 'PLUGIN_UPDATE', 'CONFIG_CHANGE', 'DEPENDENCY_CHANGE', 'SECURITY_SCAN', 'PERFORMANCE_CHANGE', 'ISSUE_RESOLUTION');

-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('SECURITY_VULNERABILITY', 'PERFORMANCE_ISSUE', 'MAINTAINABILITY_DEBT', 'RELIABILITY_CONCERN', 'DOCUMENTATION_GAP', 'COMPLIANCE_VIOLATION', 'POLICY_VIOLATION', 'DEPENDENCY_ISSUE', 'CONFIGURATION_ERROR', 'OTHER');

-- CreateEnum
CREATE TYPE "IssueSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'DEFERRED', 'WONT_FIX', 'DUPLICATE', 'FALSE_POSITIVE');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('URGENT', 'HIGH', 'MEDIUM', 'LOW', 'BACKLOG');

-- CreateEnum
CREATE TYPE "ResolutionMethod" AS ENUM ('FIXED', 'CONFIGURATION_CHANGE', 'DEPENDENCY_UPDATE', 'DOCUMENTATION_UPDATE', 'POLICY_EXCEPTION', 'WORKAROUND_APPLIED', 'NOT_REPRODUCIBLE', 'BY_DESIGN');

-- CreateEnum
CREATE TYPE "EvaluationJobType" AS ENUM ('FULL_EVALUATION', 'INCREMENTAL_EVALUATION', 'SECURITY_SCAN_ONLY', 'PERFORMANCE_CHECK_ONLY', 'COMPLIANCE_CHECK', 'SCHEDULED_EVALUATION', 'TRIGGERED_EVALUATION', 'CUSTOM_EVALUATION');

-- CreateEnum
CREATE TYPE "EvaluationJobStatus" AS ENUM ('PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'RETRY');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "avatar" TEXT,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'DEVELOPER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "mfaMethod" TEXT,
    "mfaBackupCodes" TEXT[],
    "phoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "avatar" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'MEMBER',

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "type" "ServiceType" NOT NULL,
    "lifecycle" "Lifecycle" NOT NULL,
    "namespace" TEXT NOT NULL DEFAULT 'default',
    "system" TEXT,
    "domain" TEXT,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "gitRepo" TEXT,
    "gitBranch" TEXT DEFAULT 'main',
    "apiVersion" TEXT,
    "tags" TEXT[],
    "labels" JSONB,
    "annotations" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_dependencies" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "dependencyType" "DependencyType" NOT NULL,
    "description" TEXT,

    CONSTRAINT "service_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_health_checks" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HealthCheckType" NOT NULL,
    "endpoint" TEXT,
    "method" TEXT DEFAULT 'GET',
    "interval" INTEGER NOT NULL DEFAULT 60,
    "timeout" INTEGER NOT NULL DEFAULT 30,
    "retries" INTEGER NOT NULL DEFAULT 3,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_check_results" (
    "id" TEXT NOT NULL,
    "healthCheckId" TEXT NOT NULL,
    "status" "HealthStatus" NOT NULL,
    "responseTime" INTEGER,
    "message" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_check_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_health" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "status" "HealthStatus" NOT NULL,
    "metadata" JSONB,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_metrics" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MetricType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "labels" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ServiceType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "content" JSONB NOT NULL,
    "schema" JSONB,
    "tags" TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_executions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "serviceId" TEXT,
    "userId" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "template_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL,
    "deployedBy" TEXT NOT NULL,
    "gitCommit" TEXT,
    "gitBranch" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "rollbackOf" TEXT,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_costs" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "region" TEXT,
    "account" TEXT,
    "service" TEXT NOT NULL,
    "resource" TEXT,
    "cost" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "period" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "tags" JSONB,

    CONSTRAINT "service_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "period" "BudgetPeriod" NOT NULL,
    "scope" JSONB NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_alerts" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "triggered" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "permissions" JSONB,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" JSONB,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "metadata" JSONB,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsed" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "actions" TEXT,
    "metadata" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferences" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "quietHours" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_documents" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "path" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_index" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[],
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "category" "PluginCategory" NOT NULL DEFAULT 'OTHER',
    "subcategory" TEXT,
    "author" TEXT,
    "maintainer" TEXT,
    "repository" TEXT,
    "homepage" TEXT,
    "documentation" TEXT,
    "npm" TEXT,
    "license" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tenantId" TEXT,
    "tenantScope" "TenantScope" NOT NULL DEFAULT 'PRIVATE',
    "isInstalled" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "compatibility" JSONB,
    "requirements" JSONB,
    "permissions" JSONB,
    "apiVersion" TEXT NOT NULL DEFAULT 'v1',
    "schemaVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "healthScore" DOUBLE PRECISION,
    "lastHealthCheck" TIMESTAMP(3),
    "cpuUsage" DOUBLE PRECISION,
    "memoryUsage" DOUBLE PRECISION,
    "installedFrom" "PluginSource",
    "installedBy" TEXT,
    "installedAt" TIMESTAMP(3),
    "configSchema" JSONB,
    "dependencies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "downloadCount" BIGINT NOT NULL DEFAULT 0,
    "starCount" INTEGER NOT NULL DEFAULT 0,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "lastCommit" TIMESTAMP(3),
    "securityScore" DOUBLE PRECISION,
    "maintenanceScore" DOUBLE PRECISION,
    "status" "PluginStatus" NOT NULL DEFAULT 'ACTIVE',
    "lifecycle" "PluginLifecycle" NOT NULL DEFAULT 'STABLE',
    "deprecatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hasSecurityIssues" BOOLEAN NOT NULL DEFAULT false,
    "lastSecurityScan" TIMESTAMP(3),
    "securityApprovalStatus" "SecurityApprovalStatus" DEFAULT 'PENDING',
    "securityRiskLevel" "SecurityRiskLevel" DEFAULT 'UNKNOWN',
    "trustScore" DOUBLE PRECISION DEFAULT 0,

    CONSTRAINT "plugins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_versions" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "semverMajor" INTEGER NOT NULL,
    "semverMinor" INTEGER NOT NULL,
    "semverPatch" INTEGER NOT NULL,
    "prereleaseTag" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "isDeployed" BOOLEAN NOT NULL DEFAULT false,
    "status" "VersionStatus" NOT NULL DEFAULT 'PENDING',
    "changelog" TEXT,
    "dependencies" JSONB,
    "configuration" JSONB,
    "migrationScript" TEXT,
    "installSource" "VersionSource" NOT NULL DEFAULT 'NPM',
    "gitCommit" TEXT,
    "gitBranch" TEXT,
    "deployedBy" TEXT,
    "deployedAt" TIMESTAMP(3),
    "rollbackOf" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "digitalSignature" TEXT,
    "integrityHash" TEXT,
    "publicKeyFingerprint" TEXT,
    "securityScanPassed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "plugin_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_deployments" (
    "id" TEXT NOT NULL,
    "pluginVersionId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "strategy" "DeploymentStrategy" NOT NULL DEFAULT 'ROLLING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "logs" TEXT,
    "error" TEXT,
    "healthCheck" JSONB,
    "rollbackPlan" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "deployedBy" TEXT NOT NULL,
    "rollbackDeadline" TIMESTAMP(3),

    CONSTRAINT "plugin_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_configurations" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_backups" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "beforeVersionId" TEXT,
    "afterVersionId" TEXT,
    "backupType" "BackupType" NOT NULL,
    "source" "BackupSource" NOT NULL DEFAULT 'AUTOMATIC',
    "status" "BackupStatus" NOT NULL DEFAULT 'PENDING',
    "size" BIGINT,
    "compression" TEXT,
    "encryption" BOOLEAN NOT NULL DEFAULT true,
    "storageProvider" TEXT NOT NULL DEFAULT 's3',
    "storagePath" TEXT NOT NULL,
    "storageRegion" TEXT,
    "metadata" JSONB,
    "checksumAlgorithm" TEXT NOT NULL DEFAULT 'sha256',
    "checksum" TEXT,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "expiresAt" TIMESTAMP(3),
    "error" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_operations" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "operationType" "PluginOperationType" NOT NULL,
    "status" "OperationStatus" NOT NULL DEFAULT 'PENDING',
    "version" TEXT,
    "performedBy" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "parameters" JSONB,
    "result" JSONB,
    "logs" TEXT,
    "error" TEXT,
    "duration" INTEGER,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "plugin_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_metrics" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricType" "MetricType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "tags" JSONB,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aggregationPeriod" INTEGER,

    CONSTRAINT "plugin_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_configs" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "valueType" "ConfigValueType" NOT NULL DEFAULT 'JSON',
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "validation" JSONB,
    "defaultValue" JSONB,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_dependencies" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "dependsOnId" TEXT NOT NULL,
    "dependencyType" "DependencyType" NOT NULL DEFAULT 'SOFT',
    "versionRange" TEXT,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "isDevOnly" BOOLEAN NOT NULL DEFAULT false,
    "isRuntime" BOOLEAN NOT NULL DEFAULT true,
    "conflictsWith" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reason" TEXT,
    "minVersion" TEXT,
    "maxVersion" TEXT,
    "status" "DependencyStatus" NOT NULL DEFAULT 'SATISFIED',
    "lastChecked" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restore_points" (
    "id" TEXT NOT NULL,
    "backupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "restoreType" "RestoreType" NOT NULL,
    "metadata" JSONB,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restore_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_migration_executions" (
    "id" TEXT NOT NULL,
    "pluginVersionId" TEXT NOT NULL,
    "type" "MigrationType" NOT NULL,
    "script" TEXT NOT NULL,
    "status" "MigrationStatus" NOT NULL DEFAULT 'PENDING',
    "output" TEXT,
    "error" TEXT,
    "executionTime" INTEGER,
    "rollbackScript" TEXT,
    "executedBy" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_migration_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_environments" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "configuration" JSONB NOT NULL,
    "secrets" JSONB,
    "variables" JSONB,
    "resources" JSONB,
    "scaling" JSONB,
    "health" JSONB,
    "deployment" "DeploymentStrategy" NOT NULL DEFAULT 'ROLLING',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_governance" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL DEFAULT '1.0',
    "requiredApprovals" INTEGER NOT NULL DEFAULT 1,
    "approvers" TEXT[],
    "reviewers" TEXT[],
    "securityReview" BOOLEAN NOT NULL DEFAULT true,
    "complianceReview" BOOLEAN NOT NULL DEFAULT false,
    "autoApproval" BOOLEAN NOT NULL DEFAULT false,
    "exemptions" JSONB,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_governance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_approvals" (
    "id" TEXT NOT NULL,
    "governanceId" TEXT NOT NULL,
    "pluginId" TEXT,
    "pluginVersionId" TEXT,
    "requestType" "ApprovalType" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "reviewedBy" TEXT,
    "priority" "ApprovalPriority" NOT NULL DEFAULT 'MEDIUM',
    "reason" TEXT,
    "comments" JSONB,
    "requirements" JSONB,
    "evidence" JSONB,
    "expiresAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_analytics" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "event" "AnalyticsEvent" NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "version" TEXT,
    "sessionId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "country" TEXT,
    "region" TEXT,
    "metadata" JSONB,
    "duration" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_performance" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "version" TEXT,
    "metricType" "PerformanceMetric" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "percentile" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION,
    "isAlert" BOOLEAN NOT NULL DEFAULT false,
    "tags" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sampledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_vulnerabilities" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "cveId" TEXT,
    "severity" "VulnerabilitySeverity" NOT NULL,
    "score" DOUBLE PRECISION,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affectedVersions" TEXT[],
    "patchedVersions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workaround" TEXT,
    "exploitability" TEXT,
    "impact" JSONB,
    "references" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "VulnerabilityStatus" NOT NULL DEFAULT 'OPEN',
    "discoveredBy" TEXT,
    "reportedAt" TIMESTAMP(3),
    "patchedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_vulnerabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_test_results" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "pluginVersionId" TEXT,
    "testSuite" TEXT NOT NULL,
    "testType" "TestType" NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'test',
    "status" "TestStatus" NOT NULL,
    "passed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "coverage" DOUBLE PRECISION,
    "duration" INTEGER,
    "artifacts" JSONB,
    "results" JSONB,
    "logs" TEXT,
    "executedBy" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_test_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_alerts" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "threshold" DOUBLE PRECISION,
    "currentValue" DOUBLE PRECISION,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "mutedUntil" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "notificationChannels" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_workflows" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger" "WorkflowTrigger" NOT NULL,
    "conditions" JSONB,
    "actions" JSONB NOT NULL,
    "schedule" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" "WorkflowStatus",
    "lastRunDuration" INTEGER,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_workflow_executions" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "trigger" "WorkflowTrigger" NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "duration" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "plugin_workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disaster_recovery_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" JSONB NOT NULL,
    "backupSchedule" TEXT NOT NULL,
    "retentionPolicy" JSONB NOT NULL,
    "storageProviders" JSONB NOT NULL,
    "alertChannels" JSONB NOT NULL,
    "testSchedule" TEXT,
    "lastTestAt" TIMESTAMP(3),
    "nextTestAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disaster_recovery_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disaster_recovery_executions" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "type" "DisasterRecoveryType" NOT NULL,
    "status" "DisasterRecoveryStatus" NOT NULL DEFAULT 'PENDING',
    "triggerReason" TEXT,
    "scope" JSONB,
    "metrics" JSONB,
    "verificationResults" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "executedBy" TEXT,

    CONSTRAINT "disaster_recovery_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "taxId" TEXT,
    "billingEmail" TEXT NOT NULL,
    "billingAddress" JSONB,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stripeCustomerId" TEXT,
    "paymentMethodId" TEXT,
    "defaultPaymentMethod" TEXT,
    "creditBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "creditLimit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_items" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "stripeItemId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "tier" "PlanTier" NOT NULL,
    "monthlyPrice" DECIMAL(10,2) NOT NULL,
    "annualPrice" DECIMAL(10,2) NOT NULL,
    "setupFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL,
    "limits" JSONB NOT NULL,
    "overage" JSONB NOT NULL,
    "stripePriceId" TEXT,
    "stripeProductId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_tiers" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "minUnits" INTEGER NOT NULL,
    "maxUnits" INTEGER,
    "pricePerUnit" DECIMAL(10,4) NOT NULL,
    "flatFee" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "usage_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_usage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "pluginId" TEXT,
    "resourceType" "ResourceType" NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "stripeInvoiceId" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paidAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitPrice" DECIMAL(10,4) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "stripePaymentId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" "PaymentMethod" NOT NULL,
    "failureReason" TEXT,
    "refundedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "stripeRefundId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" "RefundReason" NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'ISSUED',
    "appliedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "maxRedemptions" INTEGER,
    "redemptionCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "restrictions" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_discounts" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "subscription_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_allocations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "costCenterId" TEXT,
    "period" TIMESTAMP(3) NOT NULL,
    "allocatedCost" DECIMAL(10,2) NOT NULL,
    "actualCost" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "breakdown" JSONB NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "status" "AllocationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_centers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "budget" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "managerId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_plugins" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pricingModel" "PricingModel" NOT NULL,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "revenueShare" DECIMAL(5,2) NOT NULL,
    "tier" "MarketplaceTier" NOT NULL,
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_plugins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_sales" (
    "id" TEXT NOT NULL,
    "marketplacePluginId" TEXT NOT NULL,
    "buyerOrgId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "commission" DECIMAL(10,2) NOT NULL,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "SaleStatus" NOT NULL DEFAULT 'PENDING',
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "developer_payouts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "stripeTransferId" TEXT,
    "processedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "developer_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_reviews" (
    "id" TEXT NOT NULL,
    "marketplacePluginId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_budgets" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "spent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "period" "BudgetPeriod" NOT NULL,
    "resourceType" "ResourceType",
    "alertThreshold" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_alerts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "budgetId" TEXT,
    "type" "AlertType" NOT NULL,
    "threshold" DECIMAL(10,2) NOT NULL,
    "currentValue" DECIMAL(10,2) NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "state" TEXT,
    "rate" DECIMAL(5,2) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB NOT NULL,
    "stripeEventId" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productivity_metrics" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "dora" JSONB NOT NULL,
    "space" JSONB NOT NULL,
    "codeQuality" JSONB NOT NULL,
    "collaboration" JSONB NOT NULL,
    "flowState" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "percentile" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productivity_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dx_analysis" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "metrics" JSONB NOT NULL,
    "insights" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dx_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "burnout_indicators" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "indicators" JSONB NOT NULL,
    "trend" TEXT NOT NULL,
    "recommendations" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "burnout_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_history" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_status" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "currentSpend" DOUBLE PRECISION NOT NULL,
    "forecast" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "schedule" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_executions" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "metrics" JSONB NOT NULL,
    "errors" JSONB NOT NULL,

    CONSTRAINT "pipeline_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etl_jobs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "schedule" JSONB NOT NULL,
    "priority" TEXT NOT NULL,
    "retryPolicy" JSONB NOT NULL,
    "resources" JSONB NOT NULL,
    "tags" TEXT[],
    "isActive" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "etl_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "etl_executions" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "pipelineExecutionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "resources" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL,
    "errors" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,

    CONSTRAINT "etl_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_assets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" JSONB NOT NULL,
    "schema" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "quality" JSONB NOT NULL,
    "lineage" JSONB NOT NULL,
    "governance" JSONB NOT NULL,
    "usage" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_data_points" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "labels" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_data_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assignedTo" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_security_metadata" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "pluginVersionId" TEXT,
    "hasValidSignature" BOOLEAN NOT NULL DEFAULT false,
    "signatureAlgorithm" TEXT,
    "signaturePublicKey" TEXT,
    "signatureTimestamp" TIMESTAMP(3),
    "signatureValidatedBy" TEXT,
    "signatureValidatedAt" TIMESTAMP(3),
    "sha256Checksum" TEXT,
    "sha512Checksum" TEXT,
    "blake2bChecksum" TEXT,
    "integrityVerified" BOOLEAN NOT NULL DEFAULT false,
    "checksumSource" TEXT,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trustScoreCalculatedAt" TIMESTAMP(3),
    "trustMetrics" JSONB,
    "riskLevel" "SecurityRiskLevel" NOT NULL DEFAULT 'UNKNOWN',
    "riskFactors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastSecurityScan" TIMESTAMP(3),
    "securityScanStatus" "SecurityScanStatus" NOT NULL DEFAULT 'PENDING',
    "vulnerabilityScanId" TEXT,
    "malwareScanResult" TEXT,
    "complianceStatus" "ComplianceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "packageSize" BIGINT,
    "packageArchitecture" TEXT,
    "packageFormat" TEXT,
    "downloadSource" TEXT,
    "exemptions" JSONB,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_security_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_security_events" (
    "id" TEXT NOT NULL,
    "securityMetadataId" TEXT NOT NULL,
    "eventType" "SecurityEventType" NOT NULL,
    "severity" "SecurityEventSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "details" JSONB,
    "source" TEXT NOT NULL,
    "pluginName" TEXT NOT NULL,
    "pluginVersion" TEXT,
    "userId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" "SecurityEventStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_publishers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "website" TEXT,
    "description" TEXT,
    "trustLevel" "PublisherTrustLevel" NOT NULL DEFAULT 'VERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "publicKeys" JSONB NOT NULL,
    "keyRotationSchedule" TEXT,
    "lastKeyRotation" TIMESTAMP(3),
    "allowedPackagePatterns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "securityPolicies" JSONB,
    "autoApproval" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspensionReason" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trusted_publishers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "policyType" "SecurityPolicyType" NOT NULL,
    "rules" JSONB NOT NULL,
    "enforcement" "PolicyEnforcement" NOT NULL DEFAULT 'WARN',
    "priority" INTEGER NOT NULL DEFAULT 100,
    "appliesToPlugins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "appliesToCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exemptions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "ownedBy" TEXT NOT NULL,
    "approvers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "security_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_scan_results" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "pluginVersionId" TEXT,
    "scanType" "SecurityScanType" NOT NULL,
    "scanId" TEXT NOT NULL,
    "scanEngine" TEXT NOT NULL,
    "scanVersion" TEXT,
    "status" "SecurityScanStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "vulnerabilityCount" INTEGER NOT NULL DEFAULT 0,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "highCount" INTEGER NOT NULL DEFAULT 0,
    "mediumCount" INTEGER NOT NULL DEFAULT 0,
    "lowCount" INTEGER NOT NULL DEFAULT 0,
    "infoCount" INTEGER NOT NULL DEFAULT 0,
    "findings" JSONB,
    "rawResults" JSONB,
    "recommendations" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_scan_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_compliance_reports" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "pluginVersionId" TEXT,
    "reportType" "ComplianceReportType" NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    "reportPeriod" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "passedChecks" INTEGER NOT NULL DEFAULT 0,
    "failedChecks" INTEGER NOT NULL DEFAULT 0,
    "exemptedChecks" INTEGER NOT NULL DEFAULT 0,
    "checkResults" JSONB NOT NULL,
    "policyViolations" JSONB,
    "recommendations" JSONB,
    "actionItems" JSONB,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_compliance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_quality_scores" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "tenantId" TEXT,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overallGrade" "QualityGrade" NOT NULL DEFAULT 'F',
    "securityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "performanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maintainabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reliabilityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "documentationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "securityGrade" "QualityGrade" NOT NULL DEFAULT 'F',
    "performanceGrade" "QualityGrade" NOT NULL DEFAULT 'F',
    "maintainabilityGrade" "QualityGrade" NOT NULL DEFAULT 'F',
    "reliabilityGrade" "QualityGrade" NOT NULL DEFAULT 'F',
    "documentationGrade" "QualityGrade" NOT NULL DEFAULT 'F',
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluationEngine" TEXT NOT NULL DEFAULT 'v1.0',
    "confidenceLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dataQualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "securityWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "performanceWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "maintainabilityWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "reliabilityWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "documentationWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "scoreImprovement" DOUBLE PRECISION,
    "trendDirection" "TrendDirection" NOT NULL DEFAULT 'STABLE',
    "passesMinimumStandards" BOOLEAN NOT NULL DEFAULT false,
    "complianceFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "governanceExceptions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_quality_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_quality_checks" (
    "id" TEXT NOT NULL,
    "qualityScoreId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "tenantId" TEXT,
    "checkType" "QualityCheckType" NOT NULL,
    "checkName" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "category" "QualityCategory" NOT NULL,
    "status" "QualityCheckStatus" NOT NULL DEFAULT 'PENDING',
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "description" TEXT,
    "rationale" TEXT,
    "recommendation" TEXT,
    "documentation" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "executionEngine" TEXT NOT NULL DEFAULT 'v1.0',
    "evidence" JSONB,
    "metrics" JSONB,
    "errorDetails" TEXT,
    "severity" "CheckSeverity" NOT NULL DEFAULT 'MEDIUM',
    "impact" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_quality_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_quality_history" (
    "id" TEXT NOT NULL,
    "qualityScoreId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "tenantId" TEXT,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "overallGrade" "QualityGrade" NOT NULL,
    "securityScore" DOUBLE PRECISION NOT NULL,
    "performanceScore" DOUBLE PRECISION NOT NULL,
    "maintainabilityScore" DOUBLE PRECISION NOT NULL,
    "reliabilityScore" DOUBLE PRECISION NOT NULL,
    "documentationScore" DOUBLE PRECISION NOT NULL,
    "scoreChange" DOUBLE PRECISION NOT NULL,
    "changeReason" TEXT,
    "triggerEvent" "HistoryTrigger" NOT NULL,
    "pluginVersion" TEXT,
    "evaluationEngine" TEXT NOT NULL DEFAULT 'v1.0',
    "snapshot" JSONB,
    "metadata" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plugin_quality_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_quality_issues" (
    "id" TEXT NOT NULL,
    "qualityScoreId" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "tenantId" TEXT,
    "issueType" "IssueType" NOT NULL,
    "category" "QualityCategory" NOT NULL,
    "severity" "IssueSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "affectedChecks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "impact" TEXT,
    "resolution" TEXT,
    "workaround" TEXT,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "IssuePriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedTo" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,
    "resolutionMethod" "ResolutionMethod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "slaDeadline" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "escalationLevel" INTEGER NOT NULL DEFAULT 0,
    "evidence" JSONB,
    "reproductionSteps" TEXT,
    "affectedVersions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "environment" TEXT,
    "ticketId" TEXT,
    "references" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,

    CONSTRAINT "plugin_quality_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_quality_issue_comments" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_quality_issue_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_gate_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "tenantId" TEXT,
    "gradeAThreshold" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "gradeBThreshold" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "gradeCThreshold" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "gradeDThreshold" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "securityWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "performanceWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "maintainabilityWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "reliabilityWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "documentationWeight" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "minimumOverallScore" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "minimumSecurityScore" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "blockingIssues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabledChecks" JSONB NOT NULL,
    "checkWeights" JSONB NOT NULL,
    "customChecks" JSONB,
    "allowExceptions" BOOLEAN NOT NULL DEFAULT true,
    "requireApproval" BOOLEAN NOT NULL DEFAULT false,
    "autoRemediation" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "ownedBy" TEXT NOT NULL,
    "approvers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_gate_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_evaluation_jobs" (
    "id" TEXT NOT NULL,
    "pluginId" TEXT NOT NULL,
    "tenantId" TEXT,
    "jobType" "EvaluationJobType" NOT NULL,
    "status" "EvaluationJobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "config" JSONB,
    "checksToRun" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "triggerReason" TEXT,
    "result" JSONB,
    "error" TEXT,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "totalSteps" INTEGER NOT NULL DEFAULT 1,
    "scheduledAt" TIMESTAMP(3),
    "cronExpression" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_evaluation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT NOT NULL,
    "entityTypes" TEXT[],
    "checks" JSONB NOT NULL,
    "levels" JSONB,
    "schedule" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT,

    CONSTRAINT "scorecards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scorecard_results" (
    "id" TEXT NOT NULL,
    "scorecardId" TEXT NOT NULL,
    "entityRef" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "level" TEXT,
    "checkResults" JSONB NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trend" JSONB,
    "tenantId" TEXT,

    CONSTRAINT "scorecard_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "teams_name_key" ON "teams"("name");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_userId_teamId_key" ON "team_members"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "services_name_key" ON "services"("name");

-- CreateIndex
CREATE UNIQUE INDEX "service_dependencies_serviceId_dependsOnId_key" ON "service_dependencies"("serviceId", "dependsOnId");

-- CreateIndex
CREATE UNIQUE INDEX "system_health_service_key" ON "system_health"("service");

-- CreateIndex
CREATE UNIQUE INDEX "templates_name_key" ON "templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_teamId_resource_action_key" ON "permissions"("teamId", "resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_token_key" ON "trusted_devices"("token");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_userId_key" ON "notification_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "search_index_entityType_entityId_key" ON "search_index"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "plugins_tenantId_category_status_idx" ON "plugins"("tenantId", "category", "status");

-- CreateIndex
CREATE INDEX "plugins_name_idx" ON "plugins"("name");

-- CreateIndex
CREATE INDEX "plugins_category_isPremium_idx" ON "plugins"("category", "isPremium");

-- CreateIndex
CREATE INDEX "plugins_healthScore_idx" ON "plugins"("healthScore");

-- CreateIndex
CREATE INDEX "plugins_downloadCount_idx" ON "plugins"("downloadCount");

-- CreateIndex
CREATE INDEX "plugins_lastHealthCheck_idx" ON "plugins"("lastHealthCheck");

-- CreateIndex
CREATE INDEX "plugins_cpuUsage_idx" ON "plugins"("cpuUsage");

-- CreateIndex
CREATE INDEX "plugins_memoryUsage_idx" ON "plugins"("memoryUsage");

-- CreateIndex
CREATE INDEX "plugins_installedBy_idx" ON "plugins"("installedBy");

-- CreateIndex
CREATE INDEX "plugins_installedAt_idx" ON "plugins"("installedAt");

-- CreateIndex
CREATE UNIQUE INDEX "plugins_name_tenantId_key" ON "plugins"("name", "tenantId");

-- CreateIndex
CREATE INDEX "plugin_versions_pluginId_isCurrent_idx" ON "plugin_versions"("pluginId", "isCurrent");

-- CreateIndex
CREATE INDEX "plugin_versions_status_deployedAt_idx" ON "plugin_versions"("status", "deployedAt");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_versions_pluginId_version_key" ON "plugin_versions"("pluginId", "version");

-- CreateIndex
CREATE INDEX "plugin_deployments_status_startedAt_idx" ON "plugin_deployments"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_configurations_pluginId_environment_key" ON "plugin_configurations"("pluginId", "environment");

-- CreateIndex
CREATE INDEX "plugin_backups_pluginId_createdAt_idx" ON "plugin_backups"("pluginId", "createdAt");

-- CreateIndex
CREATE INDEX "plugin_backups_status_expiresAt_idx" ON "plugin_backups"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "plugin_operations_pluginId_operationType_status_idx" ON "plugin_operations"("pluginId", "operationType", "status");

-- CreateIndex
CREATE INDEX "plugin_operations_performedBy_startedAt_idx" ON "plugin_operations"("performedBy", "startedAt");

-- CreateIndex
CREATE INDEX "plugin_operations_status_scheduledAt_idx" ON "plugin_operations"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "plugin_operations_environment_operationType_idx" ON "plugin_operations"("environment", "operationType");

-- CreateIndex
CREATE INDEX "plugin_metrics_pluginId_metricName_timestamp_idx" ON "plugin_metrics"("pluginId", "metricName", "timestamp");

-- CreateIndex
CREATE INDEX "plugin_metrics_metricName_environment_timestamp_idx" ON "plugin_metrics"("metricName", "environment", "timestamp");

-- CreateIndex
CREATE INDEX "plugin_metrics_timestamp_idx" ON "plugin_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "plugin_configs_pluginId_environment_idx" ON "plugin_configs"("pluginId", "environment");

-- CreateIndex
CREATE INDEX "plugin_configs_isSecret_idx" ON "plugin_configs"("isSecret");

-- CreateIndex
CREATE INDEX "plugin_configs_environment_key_idx" ON "plugin_configs"("environment", "key");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_configs_pluginId_environment_key_key" ON "plugin_configs"("pluginId", "environment", "key");

-- CreateIndex
CREATE INDEX "plugin_dependencies_pluginId_idx" ON "plugin_dependencies"("pluginId");

-- CreateIndex
CREATE INDEX "plugin_dependencies_dependsOnId_idx" ON "plugin_dependencies"("dependsOnId");

-- CreateIndex
CREATE INDEX "plugin_dependencies_status_lastChecked_idx" ON "plugin_dependencies"("status", "lastChecked");

-- CreateIndex
CREATE INDEX "plugin_dependencies_isOptional_isRuntime_idx" ON "plugin_dependencies"("isOptional", "isRuntime");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_dependencies_pluginId_dependsOnId_key" ON "plugin_dependencies"("pluginId", "dependsOnId");

-- CreateIndex
CREATE INDEX "plugin_migration_executions_pluginVersionId_type_idx" ON "plugin_migration_executions"("pluginVersionId", "type");

-- CreateIndex
CREATE INDEX "plugin_environments_pluginId_idx" ON "plugin_environments"("pluginId");

-- CreateIndex
CREATE INDEX "plugin_environments_environment_idx" ON "plugin_environments"("environment");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_environments_pluginId_environment_key" ON "plugin_environments"("pluginId", "environment");

-- CreateIndex
CREATE INDEX "plugin_governance_tenantId_idx" ON "plugin_governance"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_governance_pluginId_tenantId_key" ON "plugin_governance"("pluginId", "tenantId");

-- CreateIndex
CREATE INDEX "plugin_approvals_status_priority_idx" ON "plugin_approvals"("status", "priority");

-- CreateIndex
CREATE INDEX "plugin_approvals_requestedBy_idx" ON "plugin_approvals"("requestedBy");

-- CreateIndex
CREATE INDEX "plugin_approvals_approvedBy_idx" ON "plugin_approvals"("approvedBy");

-- CreateIndex
CREATE INDEX "plugin_analytics_pluginId_timestamp_idx" ON "plugin_analytics"("pluginId", "timestamp");

-- CreateIndex
CREATE INDEX "plugin_analytics_event_timestamp_idx" ON "plugin_analytics"("event", "timestamp");

-- CreateIndex
CREATE INDEX "plugin_analytics_tenantId_timestamp_idx" ON "plugin_analytics"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "plugin_analytics_userId_timestamp_idx" ON "plugin_analytics"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "plugin_performance_pluginId_metricType_timestamp_idx" ON "plugin_performance"("pluginId", "metricType", "timestamp");

-- CreateIndex
CREATE INDEX "plugin_performance_environment_timestamp_idx" ON "plugin_performance"("environment", "timestamp");

-- CreateIndex
CREATE INDEX "plugin_performance_metricType_isAlert_idx" ON "plugin_performance"("metricType", "isAlert");

-- CreateIndex
CREATE INDEX "plugin_vulnerabilities_pluginId_severity_idx" ON "plugin_vulnerabilities"("pluginId", "severity");

-- CreateIndex
CREATE INDEX "plugin_vulnerabilities_status_severity_idx" ON "plugin_vulnerabilities"("status", "severity");

-- CreateIndex
CREATE INDEX "plugin_vulnerabilities_cveId_idx" ON "plugin_vulnerabilities"("cveId");

-- CreateIndex
CREATE INDEX "plugin_test_results_pluginId_testType_status_idx" ON "plugin_test_results"("pluginId", "testType", "status");

-- CreateIndex
CREATE INDEX "plugin_test_results_status_executedAt_idx" ON "plugin_test_results"("status", "executedAt");

-- CreateIndex
CREATE INDEX "plugin_alerts_pluginId_severity_isActive_idx" ON "plugin_alerts"("pluginId", "severity", "isActive");

-- CreateIndex
CREATE INDEX "plugin_alerts_alertType_isActive_idx" ON "plugin_alerts"("alertType", "isActive");

-- CreateIndex
CREATE INDEX "plugin_alerts_environment_severity_idx" ON "plugin_alerts"("environment", "severity");

-- CreateIndex
CREATE INDEX "plugin_workflows_pluginId_isActive_idx" ON "plugin_workflows"("pluginId", "isActive");

-- CreateIndex
CREATE INDEX "plugin_workflows_trigger_idx" ON "plugin_workflows"("trigger");

-- CreateIndex
CREATE INDEX "plugin_workflow_executions_workflowId_startedAt_idx" ON "plugin_workflow_executions"("workflowId", "startedAt");

-- CreateIndex
CREATE INDEX "plugin_workflow_executions_status_idx" ON "plugin_workflow_executions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "disaster_recovery_plans_name_key" ON "disaster_recovery_plans"("name");

-- CreateIndex
CREATE INDEX "disaster_recovery_executions_planId_startedAt_idx" ON "disaster_recovery_executions"("planId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_name_key" ON "organizations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripeCustomerId_key" ON "organizations"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "billing_plans_name_key" ON "billing_plans"("name");

-- CreateIndex
CREATE INDEX "resource_usage_organizationId_period_idx" ON "resource_usage"("organizationId", "period");

-- CreateIndex
CREATE INDEX "resource_usage_resourceType_period_idx" ON "resource_usage"("resourceType", "period");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_stripeInvoiceId_key" ON "invoices"("stripeInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripePaymentId_key" ON "payments"("stripePaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_stripeRefundId_key" ON "refunds"("stripeRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_creditNoteNumber_key" ON "credit_notes"("creditNoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_discounts_subscriptionId_couponId_key" ON "subscription_discounts"("subscriptionId", "couponId");

-- CreateIndex
CREATE INDEX "cost_allocations_organizationId_period_idx" ON "cost_allocations"("organizationId", "period");

-- CreateIndex
CREATE INDEX "cost_allocations_teamId_period_idx" ON "cost_allocations"("teamId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_name_key" ON "cost_centers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cost_centers_code_key" ON "cost_centers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_plugins_pluginId_key" ON "marketplace_plugins"("pluginId");

-- CreateIndex
CREATE INDEX "marketplace_plugins_pluginId_idx" ON "marketplace_plugins"("pluginId");

-- CreateIndex
CREATE INDEX "marketplace_plugins_organizationId_isActive_idx" ON "marketplace_plugins"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "marketplace_plugins_pricingModel_isApproved_idx" ON "marketplace_plugins"("pricingModel", "isApproved");

-- CreateIndex
CREATE INDEX "marketplace_plugins_tier_publishedAt_idx" ON "marketplace_plugins"("tier", "publishedAt");

-- CreateIndex
CREATE INDEX "plugin_sales_marketplacePluginId_status_idx" ON "plugin_sales"("marketplacePluginId", "status");

-- CreateIndex
CREATE INDEX "plugin_sales_buyerOrgId_createdAt_idx" ON "plugin_sales"("buyerOrgId", "createdAt");

-- CreateIndex
CREATE INDEX "plugin_sales_status_createdAt_idx" ON "plugin_sales"("status", "createdAt");

-- CreateIndex
CREATE INDEX "plugin_reviews_marketplacePluginId_rating_idx" ON "plugin_reviews"("marketplacePluginId", "rating");

-- CreateIndex
CREATE INDEX "plugin_reviews_userId_createdAt_idx" ON "plugin_reviews"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "plugin_reviews_rating_isVerifiedPurchase_idx" ON "plugin_reviews"("rating", "isVerifiedPurchase");

-- CreateIndex
CREATE INDEX "organization_budgets_organizationId_period_idx" ON "organization_budgets"("organizationId", "period");

-- CreateIndex
CREATE INDEX "organization_budgets_resourceType_isActive_idx" ON "organization_budgets"("resourceType", "isActive");

-- CreateIndex
CREATE INDEX "billing_alerts_organizationId_severity_acknowledged_idx" ON "billing_alerts"("organizationId", "severity", "acknowledged");

-- CreateIndex
CREATE INDEX "billing_alerts_budgetId_acknowledged_idx" ON "billing_alerts"("budgetId", "acknowledged");

-- CreateIndex
CREATE INDEX "billing_alerts_type_severity_createdAt_idx" ON "billing_alerts"("type", "severity", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rates_country_state_key" ON "tax_rates"("country", "state");

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_stripeEventId_key" ON "billing_events"("stripeEventId");

-- CreateIndex
CREATE INDEX "billing_events_eventType_processed_idx" ON "billing_events"("eventType", "processed");

-- CreateIndex
CREATE INDEX "billing_events_organizationId_createdAt_idx" ON "billing_events"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "billing_events_processed_processedAt_idx" ON "billing_events"("processed", "processedAt");

-- CreateIndex
CREATE INDEX "productivity_metrics_dev_period" ON "productivity_metrics"("developerId", "period");

-- CreateIndex
CREATE INDEX "cost_history_resource_date" ON "cost_history"("resourceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "budget_status_budgetId_key" ON "budget_status"("budgetId");

-- CreateIndex
CREATE INDEX "alert_fingerprint" ON "alerts"("fingerprint");

-- CreateIndex
CREATE INDEX "plugin_security_metadata_pluginId_trustScore_idx" ON "plugin_security_metadata"("pluginId", "trustScore");

-- CreateIndex
CREATE INDEX "plugin_security_metadata_riskLevel_securityScanStatus_idx" ON "plugin_security_metadata"("riskLevel", "securityScanStatus");

-- CreateIndex
CREATE INDEX "plugin_security_metadata_lastSecurityScan_idx" ON "plugin_security_metadata"("lastSecurityScan");

-- CreateIndex
CREATE INDEX "plugin_security_metadata_trustScore_idx" ON "plugin_security_metadata"("trustScore");

-- CreateIndex
CREATE INDEX "plugin_security_metadata_hasValidSignature_integrityVerifie_idx" ON "plugin_security_metadata"("hasValidSignature", "integrityVerified");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_security_metadata_pluginId_pluginVersionId_key" ON "plugin_security_metadata"("pluginId", "pluginVersionId");

-- CreateIndex
CREATE INDEX "plugin_security_events_eventType_severity_timestamp_idx" ON "plugin_security_events"("eventType", "severity", "timestamp");

-- CreateIndex
CREATE INDEX "plugin_security_events_pluginName_eventType_idx" ON "plugin_security_events"("pluginName", "eventType");

-- CreateIndex
CREATE INDEX "plugin_security_events_status_severity_idx" ON "plugin_security_events"("status", "severity");

-- CreateIndex
CREATE INDEX "plugin_security_events_timestamp_idx" ON "plugin_security_events"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "trusted_publishers_name_key" ON "trusted_publishers"("name");

-- CreateIndex
CREATE INDEX "trusted_publishers_name_isActive_idx" ON "trusted_publishers"("name", "isActive");

-- CreateIndex
CREATE INDEX "trusted_publishers_trustLevel_isActive_idx" ON "trusted_publishers"("trustLevel", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "security_policies_name_key" ON "security_policies"("name");

-- CreateIndex
CREATE INDEX "security_policies_policyType_isActive_idx" ON "security_policies"("policyType", "isActive");

-- CreateIndex
CREATE INDEX "security_policies_enforcement_priority_idx" ON "security_policies"("enforcement", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "security_scan_results_scanId_key" ON "security_scan_results"("scanId");

-- CreateIndex
CREATE INDEX "security_scan_results_pluginId_scanType_completedAt_idx" ON "security_scan_results"("pluginId", "scanType", "completedAt");

-- CreateIndex
CREATE INDEX "security_scan_results_status_scanType_idx" ON "security_scan_results"("status", "scanType");

-- CreateIndex
CREATE INDEX "security_scan_results_criticalCount_highCount_idx" ON "security_scan_results"("criticalCount", "highCount");

-- CreateIndex
CREATE INDEX "security_scan_results_completedAt_idx" ON "security_scan_results"("completedAt");

-- CreateIndex
CREATE INDEX "security_compliance_reports_pluginId_reportType_generatedAt_idx" ON "security_compliance_reports"("pluginId", "reportType", "generatedAt");

-- CreateIndex
CREATE INDEX "security_compliance_reports_overallScore_status_idx" ON "security_compliance_reports"("overallScore", "status");

-- CreateIndex
CREATE INDEX "security_compliance_reports_generatedAt_idx" ON "security_compliance_reports"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_quality_scores_pluginId_key" ON "plugin_quality_scores"("pluginId");

-- CreateIndex
CREATE INDEX "plugin_quality_scores_pluginId_overallScore_idx" ON "plugin_quality_scores"("pluginId", "overallScore");

-- CreateIndex
CREATE INDEX "plugin_quality_scores_tenantId_overallGrade_idx" ON "plugin_quality_scores"("tenantId", "overallGrade");

-- CreateIndex
CREATE INDEX "plugin_quality_scores_overallScore_evaluatedAt_idx" ON "plugin_quality_scores"("overallScore", "evaluatedAt");

-- CreateIndex
CREATE INDEX "plugin_quality_scores_passesMinimumStandards_overallGrade_idx" ON "plugin_quality_scores"("passesMinimumStandards", "overallGrade");

-- CreateIndex
CREATE INDEX "plugin_quality_checks_pluginId_category_status_idx" ON "plugin_quality_checks"("pluginId", "category", "status");

-- CreateIndex
CREATE INDEX "plugin_quality_checks_tenantId_checkType_idx" ON "plugin_quality_checks"("tenantId", "checkType");

-- CreateIndex
CREATE INDEX "plugin_quality_checks_status_severity_idx" ON "plugin_quality_checks"("status", "severity");

-- CreateIndex
CREATE INDEX "plugin_quality_checks_category_passed_idx" ON "plugin_quality_checks"("category", "passed");

-- CreateIndex
CREATE INDEX "plugin_quality_checks_executedAt_checkType_idx" ON "plugin_quality_checks"("executedAt", "checkType");

-- CreateIndex
CREATE INDEX "plugin_quality_history_pluginId_recordedAt_idx" ON "plugin_quality_history"("pluginId", "recordedAt");

-- CreateIndex
CREATE INDEX "plugin_quality_history_tenantId_overallGrade_recordedAt_idx" ON "plugin_quality_history"("tenantId", "overallGrade", "recordedAt");

-- CreateIndex
CREATE INDEX "plugin_quality_history_triggerEvent_recordedAt_idx" ON "plugin_quality_history"("triggerEvent", "recordedAt");

-- CreateIndex
CREATE INDEX "plugin_quality_history_overallScore_recordedAt_idx" ON "plugin_quality_history"("overallScore", "recordedAt");

-- CreateIndex
CREATE INDEX "plugin_quality_issues_pluginId_status_severity_idx" ON "plugin_quality_issues"("pluginId", "status", "severity");

-- CreateIndex
CREATE INDEX "plugin_quality_issues_tenantId_category_status_idx" ON "plugin_quality_issues"("tenantId", "category", "status");

-- CreateIndex
CREATE INDEX "plugin_quality_issues_assignedTo_status_idx" ON "plugin_quality_issues"("assignedTo", "status");

-- CreateIndex
CREATE INDEX "plugin_quality_issues_severity_createdAt_idx" ON "plugin_quality_issues"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "plugin_quality_issues_slaDeadline_status_idx" ON "plugin_quality_issues"("slaDeadline", "status");

-- CreateIndex
CREATE INDEX "plugin_quality_issues_status_priority_idx" ON "plugin_quality_issues"("status", "priority");

-- CreateIndex
CREATE INDEX "plugin_quality_issue_comments_issueId_createdAt_idx" ON "plugin_quality_issue_comments"("issueId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "quality_gate_configs_name_key" ON "quality_gate_configs"("name");

-- CreateIndex
CREATE INDEX "quality_gate_configs_tenantId_isActive_idx" ON "quality_gate_configs"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "quality_gate_configs_isDefault_isActive_idx" ON "quality_gate_configs"("isDefault", "isActive");

-- CreateIndex
CREATE INDEX "quality_evaluation_jobs_pluginId_status_idx" ON "quality_evaluation_jobs"("pluginId", "status");

-- CreateIndex
CREATE INDEX "quality_evaluation_jobs_tenantId_jobType_status_idx" ON "quality_evaluation_jobs"("tenantId", "jobType", "status");

-- CreateIndex
CREATE INDEX "quality_evaluation_jobs_priority_createdAt_idx" ON "quality_evaluation_jobs"("priority", "createdAt");

-- CreateIndex
CREATE INDEX "quality_evaluation_jobs_scheduledAt_status_idx" ON "quality_evaluation_jobs"("scheduledAt", "status");

-- CreateIndex
CREATE INDEX "scorecards_tenantId_idx" ON "scorecards"("tenantId");

-- CreateIndex
CREATE INDEX "scorecard_results_scorecardId_entityRef_idx" ON "scorecard_results"("scorecardId", "entityRef");

-- CreateIndex
CREATE INDEX "scorecard_results_entityRef_idx" ON "scorecard_results"("entityRef");

-- CreateIndex
CREATE INDEX "scorecard_results_tenantId_idx" ON "scorecard_results"("tenantId");

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_health_checks" ADD CONSTRAINT "service_health_checks_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_check_results" ADD CONSTRAINT "health_check_results_healthCheckId_fkey" FOREIGN KEY ("healthCheckId") REFERENCES "service_health_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_metrics" ADD CONSTRAINT "service_metrics_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_executions" ADD CONSTRAINT "template_executions_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_executions" ADD CONSTRAINT "template_executions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_costs" ADD CONSTRAINT "service_costs_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_alerts" ADD CONSTRAINT "budget_alerts_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_challenges" ADD CONSTRAINT "mfa_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_documents" ADD CONSTRAINT "service_documents_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_versions" ADD CONSTRAINT "plugin_versions_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_versions" ADD CONSTRAINT "plugin_versions_rollbackOf_fkey" FOREIGN KEY ("rollbackOf") REFERENCES "plugin_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_deployments" ADD CONSTRAINT "plugin_deployments_pluginVersionId_fkey" FOREIGN KEY ("pluginVersionId") REFERENCES "plugin_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_configurations" ADD CONSTRAINT "plugin_configurations_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_backups" ADD CONSTRAINT "plugin_backups_afterVersionId_fkey" FOREIGN KEY ("afterVersionId") REFERENCES "plugin_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_backups" ADD CONSTRAINT "plugin_backups_beforeVersionId_fkey" FOREIGN KEY ("beforeVersionId") REFERENCES "plugin_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_backups" ADD CONSTRAINT "plugin_backups_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_operations" ADD CONSTRAINT "plugin_operations_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_metrics" ADD CONSTRAINT "plugin_metrics_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_configs" ADD CONSTRAINT "plugin_configs_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_dependencies" ADD CONSTRAINT "plugin_dependencies_dependsOnId_fkey" FOREIGN KEY ("dependsOnId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_dependencies" ADD CONSTRAINT "plugin_dependencies_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restore_points" ADD CONSTRAINT "restore_points_backupId_fkey" FOREIGN KEY ("backupId") REFERENCES "plugin_backups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_migration_executions" ADD CONSTRAINT "plugin_migration_executions_pluginVersionId_fkey" FOREIGN KEY ("pluginVersionId") REFERENCES "plugin_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_environments" ADD CONSTRAINT "plugin_environments_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_governance" ADD CONSTRAINT "plugin_governance_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_approvals" ADD CONSTRAINT "plugin_approvals_governanceId_fkey" FOREIGN KEY ("governanceId") REFERENCES "plugin_governance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_approvals" ADD CONSTRAINT "plugin_approvals_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_approvals" ADD CONSTRAINT "plugin_approvals_pluginVersionId_fkey" FOREIGN KEY ("pluginVersionId") REFERENCES "plugin_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_analytics" ADD CONSTRAINT "plugin_analytics_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_performance" ADD CONSTRAINT "plugin_performance_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_vulnerabilities" ADD CONSTRAINT "plugin_vulnerabilities_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_test_results" ADD CONSTRAINT "plugin_test_results_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_test_results" ADD CONSTRAINT "plugin_test_results_pluginVersionId_fkey" FOREIGN KEY ("pluginVersionId") REFERENCES "plugin_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_alerts" ADD CONSTRAINT "plugin_alerts_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_workflows" ADD CONSTRAINT "plugin_workflows_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_workflow_executions" ADD CONSTRAINT "plugin_workflow_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "plugin_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disaster_recovery_executions" ADD CONSTRAINT "disaster_recovery_executions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "disaster_recovery_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "billing_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_tiers" ADD CONSTRAINT "usage_tiers_planId_fkey" FOREIGN KEY ("planId") REFERENCES "billing_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_usage" ADD CONSTRAINT "resource_usage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_usage" ADD CONSTRAINT "resource_usage_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_usage" ADD CONSTRAINT "resource_usage_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_discounts" ADD CONSTRAINT "subscription_discounts_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_discounts" ADD CONSTRAINT "subscription_discounts_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_allocations" ADD CONSTRAINT "cost_allocations_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_allocations" ADD CONSTRAINT "cost_allocations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_allocations" ADD CONSTRAINT "cost_allocations_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_plugins" ADD CONSTRAINT "marketplace_plugins_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_plugins" ADD CONSTRAINT "marketplace_plugins_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_sales" ADD CONSTRAINT "plugin_sales_marketplacePluginId_fkey" FOREIGN KEY ("marketplacePluginId") REFERENCES "marketplace_plugins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "developer_payouts" ADD CONSTRAINT "developer_payouts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_reviews" ADD CONSTRAINT "plugin_reviews_marketplacePluginId_fkey" FOREIGN KEY ("marketplacePluginId") REFERENCES "marketplace_plugins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_budgets" ADD CONSTRAINT "organization_budgets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_alerts" ADD CONSTRAINT "billing_alerts_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "organization_budgets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_alerts" ADD CONSTRAINT "billing_alerts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_security_metadata" ADD CONSTRAINT "plugin_security_metadata_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_security_metadata" ADD CONSTRAINT "plugin_security_metadata_pluginVersionId_fkey" FOREIGN KEY ("pluginVersionId") REFERENCES "plugin_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_security_events" ADD CONSTRAINT "plugin_security_events_securityMetadataId_fkey" FOREIGN KEY ("securityMetadataId") REFERENCES "plugin_security_metadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_scan_results" ADD CONSTRAINT "security_scan_results_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_scan_results" ADD CONSTRAINT "security_scan_results_pluginVersionId_fkey" FOREIGN KEY ("pluginVersionId") REFERENCES "plugin_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_compliance_reports" ADD CONSTRAINT "security_compliance_reports_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_compliance_reports" ADD CONSTRAINT "security_compliance_reports_pluginVersionId_fkey" FOREIGN KEY ("pluginVersionId") REFERENCES "plugin_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_quality_scores" ADD CONSTRAINT "plugin_quality_scores_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_quality_checks" ADD CONSTRAINT "plugin_quality_checks_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_quality_checks" ADD CONSTRAINT "plugin_quality_checks_qualityScoreId_fkey" FOREIGN KEY ("qualityScoreId") REFERENCES "plugin_quality_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_quality_history" ADD CONSTRAINT "plugin_quality_history_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_quality_history" ADD CONSTRAINT "plugin_quality_history_qualityScoreId_fkey" FOREIGN KEY ("qualityScoreId") REFERENCES "plugin_quality_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_quality_issues" ADD CONSTRAINT "plugin_quality_issues_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_quality_issues" ADD CONSTRAINT "plugin_quality_issues_qualityScoreId_fkey" FOREIGN KEY ("qualityScoreId") REFERENCES "plugin_quality_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_quality_issue_comments" ADD CONSTRAINT "plugin_quality_issue_comments_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "plugin_quality_issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_evaluation_jobs" ADD CONSTRAINT "quality_evaluation_jobs_pluginId_fkey" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scorecard_results" ADD CONSTRAINT "scorecard_results_scorecardId_fkey" FOREIGN KEY ("scorecardId") REFERENCES "scorecards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
