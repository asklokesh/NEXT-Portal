/**
 * Predefined Saga Definitions for Critical Business Operations
 * Enterprise-grade distributed transactions with compensation patterns
 */

import { SagaDefinition } from './saga-orchestrator';

/**
 * Tenant Provisioning Saga
 * Orchestrates complete tenant setup across multiple services
 */
export const tenantProvisioningSaga: SagaDefinition = {
  id: 'tenant-provisioning',
  name: 'Tenant Provisioning',
  description: 'Complete tenant setup including database, authentication, and billing',
  version: '1.0.0',
  timeout: 300000, // 5 minutes
  compensationOrder: 'reverse',
  steps: [
    {
      id: 'validate-tenant-data',
      serviceName: 'tenant-service',
      action: 'validateTenantData',
      compensationAction: 'cleanupValidation',
      timeout: 30000,
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelay: 1000,
        maxDelay: 10000
      },
      metadata: { critical: true }
    },
    {
      id: 'create-database-schema',
      serviceName: 'database-service',
      action: 'createTenantSchema',
      compensationAction: 'dropTenantSchema',
      timeout: 60000,
      dependencies: ['validate-tenant-data'],
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'linear',
        baseDelay: 5000,
        maxDelay: 15000
      },
      metadata: { critical: true }
    },
    {
      id: 'setup-authentication',
      serviceName: 'auth-service',
      action: 'createTenantAuthConfig',
      compensationAction: 'removeTenantAuthConfig',
      timeout: 45000,
      dependencies: ['validate-tenant-data'],
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelay: 2000,
        maxDelay: 12000
      },
      metadata: { critical: true }
    },
    {
      id: 'initialize-billing',
      serviceName: 'billing-service',
      action: 'createBillingAccount',
      compensationAction: 'deleteBillingAccount',
      timeout: 30000,
      dependencies: ['validate-tenant-data'],
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelay: 1500,
        maxDelay: 8000
      },
      metadata: { critical: true }
    },
    {
      id: 'setup-default-plugins',
      serviceName: 'plugin-service',
      action: 'installDefaultPlugins',
      compensationAction: 'uninstallDefaultPlugins',
      timeout: 90000,
      dependencies: ['create-database-schema', 'setup-authentication'],
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'fixed',
        baseDelay: 10000,
        maxDelay: 10000
      },
      metadata: { critical: false }
    },
    {
      id: 'configure-monitoring',
      serviceName: 'monitoring-service',
      action: 'setupTenantMonitoring',
      compensationAction: 'removeTenantMonitoring',
      timeout: 30000,
      dependencies: ['create-database-schema'],
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'linear',
        baseDelay: 3000,
        maxDelay: 6000
      },
      metadata: { critical: false }
    },
    {
      id: 'send-welcome-notification',
      serviceName: 'notification-service',
      action: 'sendWelcomeEmail',
      compensationAction: 'logNotificationFailure',
      timeout: 15000,
      dependencies: ['setup-authentication', 'initialize-billing'],
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'fixed',
        baseDelay: 2000,
        maxDelay: 2000
      },
      metadata: { critical: false }
    }
  ]
};

/**
 * Plugin Installation Saga
 * Manages complex plugin installations with dependency resolution
 */
export const pluginInstallationSaga: SagaDefinition = {
  id: 'plugin-installation',
  name: 'Plugin Installation',
  description: 'Install plugin with dependency resolution and configuration',
  version: '1.0.0',
  timeout: 240000, // 4 minutes
  compensationOrder: 'reverse',
  steps: [
    {
      id: 'validate-plugin-request',
      serviceName: 'plugin-service',
      action: 'validateInstallationRequest',
      compensationAction: 'logValidationFailure',
      timeout: 15000,
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'fixed',
        baseDelay: 1000,
        maxDelay: 1000
      },
      metadata: { critical: true }
    },
    {
      id: 'check-tenant-limits',
      serviceName: 'billing-service',
      action: 'checkPluginInstallationLimits',
      compensationAction: 'releaseLimitCheck',
      timeout: 20000,
      dependencies: ['validate-plugin-request'],
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelay: 1000,
        maxDelay: 5000
      },
      metadata: { critical: true }
    },
    {
      id: 'resolve-dependencies',
      serviceName: 'plugin-service',
      action: 'resolveDependencies',
      compensationAction: 'cleanupDependencyResolution',
      timeout: 45000,
      dependencies: ['validate-plugin-request'],
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'linear',
        baseDelay: 5000,
        maxDelay: 10000
      },
      metadata: { critical: true }
    },
    {
      id: 'download-plugin-artifacts',
      serviceName: 'plugin-service',
      action: 'downloadPluginArtifacts',
      compensationAction: 'deleteDownloadedArtifacts',
      timeout: 60000,
      dependencies: ['resolve-dependencies', 'check-tenant-limits'],
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelay: 2000,
        maxDelay: 15000
      },
      metadata: { critical: true }
    },
    {
      id: 'create-plugin-database-schema',
      serviceName: 'database-service',
      action: 'createPluginSchema',
      compensationAction: 'dropPluginSchema',
      timeout: 30000,
      dependencies: ['download-plugin-artifacts'],
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'linear',
        baseDelay: 3000,
        maxDelay: 6000
      },
      metadata: { critical: true }
    },
    {
      id: 'configure-plugin',
      serviceName: 'plugin-service',
      action: 'configurePlugin',
      compensationAction: 'removePluginConfiguration',
      timeout: 30000,
      dependencies: ['create-plugin-database-schema'],
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'fixed',
        baseDelay: 2000,
        maxDelay: 2000
      },
      metadata: { critical: true }
    },
    {
      id: 'register-plugin-routes',
      serviceName: 'gateway-service',
      action: 'registerPluginRoutes',
      compensationAction: 'unregisterPluginRoutes',
      timeout: 20000,
      dependencies: ['configure-plugin'],
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelay: 1000,
        maxDelay: 8000
      },
      metadata: { critical: true }
    },
    {
      id: 'update-billing-usage',
      serviceName: 'billing-service',
      action: 'recordPluginInstallation',
      compensationAction: 'removePluginFromBilling',
      timeout: 15000,
      dependencies: ['register-plugin-routes'],
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'fixed',
        baseDelay: 1500,
        maxDelay: 1500
      },
      metadata: { critical: false }
    },
    {
      id: 'notify-plugin-ready',
      serviceName: 'notification-service',
      action: 'notifyPluginInstalled',
      compensationAction: 'logNotificationFailure',
      timeout: 10000,
      dependencies: ['update-billing-usage'],
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'fixed',
        baseDelay: 1000,
        maxDelay: 1000
      },
      metadata: { critical: false }
    }
  ]
};

/**
 * Billing Subscription Change Saga
 * Handles complex subscription tier changes with prorations
 */
export const subscriptionChangeSaga: SagaDefinition = {
  id: 'subscription-change',
  name: 'Subscription Change',
  description: 'Change subscription tier with billing adjustments and feature updates',
  version: '1.0.0',
  timeout: 180000, // 3 minutes
  compensationOrder: 'reverse',
  steps: [
    {
      id: 'validate-subscription-change',
      serviceName: 'billing-service',
      action: 'validateSubscriptionChange',
      compensationAction: 'logValidationFailure',
      timeout: 15000,
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'fixed',
        baseDelay: 1000,
        maxDelay: 1000
      },
      metadata: { critical: true }
    },
    {
      id: 'calculate-proration',
      serviceName: 'billing-service',
      action: 'calculateProration',
      compensationAction: 'clearProrationCalculation',
      timeout: 20000,
      dependencies: ['validate-subscription-change'],
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelay: 1000,
        maxDelay: 5000
      },
      metadata: { critical: true }
    },
    {
      id: 'process-payment-adjustment',
      serviceName: 'payment-service',
      action: 'processSubscriptionPayment',
      compensationAction: 'refundPaymentAdjustment',
      timeout: 45000,
      dependencies: ['calculate-proration'],
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelay: 2000,
        maxDelay: 12000
      },
      metadata: { critical: true }
    },
    {
      id: 'update-tenant-limits',
      serviceName: 'tenant-service',
      action: 'updateTenantLimits',
      compensationAction: 'revertTenantLimits',
      timeout: 30000,
      dependencies: ['process-payment-adjustment'],
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'linear',
        baseDelay: 2000,
        maxDelay: 4000
      },
      metadata: { critical: true }
    },
    {
      id: 'adjust-plugin-access',
      serviceName: 'plugin-service',
      action: 'adjustPluginAccess',
      compensationAction: 'revertPluginAccess',
      timeout: 30000,
      dependencies: ['update-tenant-limits'],
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'fixed',
        baseDelay: 3000,
        maxDelay: 3000
      },
      metadata: { critical: true }
    },
    {
      id: 'update-monitoring-quotas',
      serviceName: 'monitoring-service',
      action: 'updateMonitoringQuotas',
      compensationAction: 'revertMonitoringQuotas',
      timeout: 20000,
      dependencies: ['update-tenant-limits'],
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'linear',
        baseDelay: 1500,
        maxDelay: 3000
      },
      metadata: { critical: false }
    },
    {
      id: 'send-subscription-confirmation',
      serviceName: 'notification-service',
      action: 'sendSubscriptionChangeNotification',
      compensationAction: 'logNotificationFailure',
      timeout: 15000,
      dependencies: ['adjust-plugin-access'],
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'fixed',
        baseDelay: 1000,
        maxDelay: 1000
      },
      metadata: { critical: false }
    }
  ]
};

/**
 * Data Migration Saga
 * Orchestrates large-scale data migrations with rollback capabilities
 */
export const dataMigrationSaga: SagaDefinition = {
  id: 'data-migration',
  name: 'Data Migration',
  description: 'Migrate tenant data between storage systems with validation',
  version: '1.0.0',
  timeout: 600000, // 10 minutes
  compensationOrder: 'reverse',
  steps: [
    {
      id: 'validate-migration-request',
      serviceName: 'migration-service',
      action: 'validateMigrationRequest',
      compensationAction: 'cleanupValidation',
      timeout: 30000,
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'fixed',
        baseDelay: 2000,
        maxDelay: 2000
      },
      metadata: { critical: true }
    },
    {
      id: 'create-backup',
      serviceName: 'backup-service',
      action: 'createDataBackup',
      compensationAction: 'deleteBackup',
      timeout: 120000,
      dependencies: ['validate-migration-request'],
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'linear',
        baseDelay: 10000,
        maxDelay: 20000
      },
      metadata: { critical: true }
    },
    {
      id: 'prepare-target-storage',
      serviceName: 'migration-service',
      action: 'prepareTargetStorage',
      compensationAction: 'cleanupTargetStorage',
      timeout: 60000,
      dependencies: ['create-backup'],
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'exponential',
        baseDelay: 5000,
        maxDelay: 15000
      },
      metadata: { critical: true }
    },
    {
      id: 'migrate-data',
      serviceName: 'migration-service',
      action: 'migrateData',
      compensationAction: 'rollbackMigration',
      timeout: 300000,
      dependencies: ['prepare-target-storage'],
      retryPolicy: {
        maxAttempts: 1, // No retries for data migration
        backoffStrategy: 'fixed',
        baseDelay: 0,
        maxDelay: 0
      },
      metadata: { critical: true }
    },
    {
      id: 'validate-migrated-data',
      serviceName: 'migration-service',
      action: 'validateMigratedData',
      compensationAction: 'logValidationFailure',
      timeout: 60000,
      dependencies: ['migrate-data'],
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'fixed',
        baseDelay: 5000,
        maxDelay: 5000
      },
      metadata: { critical: true }
    },
    {
      id: 'update-application-config',
      serviceName: 'config-service',
      action: 'updateDataSourceConfig',
      compensationAction: 'revertDataSourceConfig',
      timeout: 30000,
      dependencies: ['validate-migrated-data'],
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'linear',
        baseDelay: 2000,
        maxDelay: 4000
      },
      metadata: { critical: true }
    },
    {
      id: 'cleanup-old-data',
      serviceName: 'migration-service',
      action: 'cleanupOldData',
      compensationAction: 'restoreOldData',
      timeout: 60000,
      dependencies: ['update-application-config'],
      retryPolicy: {
        maxAttempts: 1,
        backoffStrategy: 'fixed',
        baseDelay: 0,
        maxDelay: 0
      },
      metadata: { critical: false }
    }
  ]
};

/**
 * All available saga definitions
 */
export const sagaDefinitions: SagaDefinition[] = [
  tenantProvisioningSaga,
  pluginInstallationSaga,
  subscriptionChangeSaga,
  dataMigrationSaga
];

export default sagaDefinitions;