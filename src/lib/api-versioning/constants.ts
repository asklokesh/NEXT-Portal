/**
 * Constants for API versioning system
 */

export const VERSION_HEADERS = {
  VERSION: 'x-api-version',
  ACCEPT_VERSION: 'accept-version',
  CONTENT_VERSION: 'content-version',
  DEPRECATED: 'x-api-deprecated',
  SUNSET: 'x-api-sunset',
  MIGRATION: 'x-api-migration',
  COMPATIBILITY: 'x-api-compatibility'
} as const;

export const VERSION_QUERY_PARAMS = {
  VERSION: 'version',
  FORMAT: 'format',
  PREVIEW: 'preview'
} as const;

export const MEDIA_TYPES = {
  V1: 'application/vnd.api+json;version=1',
  V2: 'application/vnd.api+json;version=2',
  V3: 'application/vnd.api+json;version=3',
  LATEST: 'application/vnd.api+json;version=latest',
  PREVIEW: 'application/vnd.api+json;version=preview'
} as const;

export const GRAPHQL_DIRECTIVES = {
  VERSIONED: 'versioned',
  DEPRECATED: 'deprecated',
  SINCE: 'since',
  UNTIL: 'until'
} as const;

export const COMPATIBILITY_LEVELS = {
  FULL: 'full',
  BACKWARD: 'backward',
  FORWARD: 'forward',
  NONE: 'none'
} as const;

export const MIGRATION_TYPES = {
  AUTOMATIC: 'automatic',
  MANUAL: 'manual',
  ASSISTED: 'assisted'
} as const;

export const DEPLOYMENT_STRATEGIES = {
  BLUE_GREEN: 'blue-green',
  CANARY: 'canary',
  ROLLING: 'rolling',
  RECREATE: 'recreate'
} as const;

export const VERSION_STATUS = {
  ACTIVE: 'active',
  DEPRECATED: 'deprecated',
  SUNSET: 'sunset',
  PREVIEW: 'preview'
} as const;

export const CHANGE_TYPES = {
  ADDED: 'added',
  CHANGED: 'changed',
  DEPRECATED: 'deprecated',
  REMOVED: 'removed',
  FIXED: 'fixed',
  SECURITY: 'security'
} as const;

export const IMPACT_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  BREAKING: 'breaking'
} as const;

export const DEFAULT_CONFIG = {
  DEPRECATION_PERIOD_DAYS: 90,
  SUNSET_PERIOD_DAYS: 180,
  MAX_CONCURRENT_VERSIONS: 3,
  DEFAULT_CANARY_WEIGHT: 10,
  HEALTH_CHECK_INTERVAL: 30,
  ROLLBACK_ERROR_THRESHOLD: 5,
  ANALYTICS_RETENTION_DAYS: 365,
  CONTRACT_TEST_TIMEOUT: 30000,
  SDK_GENERATION_TIMEOUT: 300000
} as const;

export const ERROR_CODES = {
  VERSION_NOT_SUPPORTED: 'VERSION_NOT_SUPPORTED',
  VERSION_DEPRECATED: 'VERSION_DEPRECATED',
  VERSION_SUNSET: 'VERSION_SUNSET',
  BREAKING_CHANGE: 'BREAKING_CHANGE',
  MIGRATION_REQUIRED: 'MIGRATION_REQUIRED',
  COMPATIBILITY_ISSUE: 'COMPATIBILITY_ISSUE',
  CONTRACT_VIOLATION: 'CONTRACT_VIOLATION',
  DEPLOYMENT_FAILED: 'DEPLOYMENT_FAILED'
} as const;

export const METRICS_NAMES = {
  VERSION_REQUESTS: 'api_version_requests_total',
  VERSION_LATENCY: 'api_version_latency_seconds',
  VERSION_ERRORS: 'api_version_errors_total',
  MIGRATION_PROGRESS: 'api_migration_progress',
  COMPATIBILITY_TESTS: 'api_compatibility_tests_total',
  DEPLOYMENT_STATUS: 'api_deployment_status',
  CLIENT_ADOPTION: 'api_client_adoption_rate'
} as const;

export const WEBHOOK_EVENTS = {
  VERSION_RELEASED: 'version.released',
  VERSION_DEPRECATED: 'version.deprecated',
  VERSION_SUNSET: 'version.sunset',
  MIGRATION_COMPLETED: 'migration.completed',
  COMPATIBILITY_ISSUE: 'compatibility.issue',
  DEPLOYMENT_SUCCESS: 'deployment.success',
  DEPLOYMENT_FAILED: 'deployment.failed'
} as const;

export const CACHE_KEYS = {
  VERSION_CONFIG: 'api:version:config',
  COMPATIBILITY_MATRIX: 'api:compatibility:matrix',
  ANALYTICS_DATA: 'api:analytics:data',
  CLIENT_VERSIONS: 'api:client:versions',
  MIGRATION_STATUS: 'api:migration:status'
} as const;

export const CACHE_TTL = {
  VERSION_CONFIG: 3600, // 1 hour
  COMPATIBILITY_MATRIX: 1800, // 30 minutes
  ANALYTICS_DATA: 300, // 5 minutes
  CLIENT_VERSIONS: 900, // 15 minutes
  MIGRATION_STATUS: 600 // 10 minutes
} as const;