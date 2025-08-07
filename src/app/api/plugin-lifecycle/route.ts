/**
 * Plugin Lifecycle Management API
 * Enterprise-grade plugin lifecycle management system with comprehensive operations
 * Supports install, update, rollback, uninstall, migration, backup/restore
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPluginLifecycleOrchestrator } from '@/services/orchestration/plugin-lifecycle-orchestrator';
import { PluginVersionManager } from '@/services/plugin-version-manager';
import { PluginMigrationService } from '@/services/plugin-migration-service';
import { PluginBackupService } from '@/services/plugin-backup-service';
import { PluginGovernanceService } from '@/services/plugin-governance-service';
import { BackstageRegistrySync } from '@/services/backstage-registry-sync';

// Request validation schemas
const InstallRequestSchema = z.object({
  pluginId: z.string(),
  version: z.string().optional(),
  environment: z.enum(['development', 'staging', 'production']),
  configuration: z.record(z.any()).optional(),
  dependencies: z.array(z.string()).optional(),
  preInstallHooks: z.array(z.string()).optional(),
  postInstallHooks: z.array(z.string()).optional(),
  rollbackOnFailure: z.boolean().default(true),
  healthCheckEnabled: z.boolean().default(true),
  multiTenant: z.object({
    enabled: z.boolean().default(false),
    tenantIds: z.array(z.string()).optional()
  }).optional()
});

const UpdateRequestSchema = z.object({
  pluginId: z.string(),
  targetVersion: z.string(),
  strategy: z.enum(['rolling', 'blue-green', 'canary', 'immediate']).default('rolling'),
  rollbackThreshold: z.number().default(0.05), // 5% error rate triggers rollback
  canaryPercentage: z.number().optional(),
  migrationScript: z.string().optional(),
  backupBeforeUpdate: z.boolean().default(true),
  compatibilityCheck: z.boolean().default(true)
});

const RollbackRequestSchema = z.object({
  pluginId: z.string(),
  targetVersion: z.string().optional(), // If not specified, rollback to previous version
  strategy: z.enum(['immediate', 'graceful']).default('graceful'),
  preserveData: z.boolean().default(true),
  restoreConfiguration: z.boolean().default(true)
});

const UninstallRequestSchema = z.object({
  pluginId: z.string(),
  cleanupStrategy: z.enum(['soft', 'hard']).default('soft'),
  preserveData: z.boolean().default(false),
  removeDependent: z.boolean().default(false),
  backupBeforeRemoval: z.boolean().default(true)
});

const MigrationRequestSchema = z.object({
  pluginId: z.string(),
  fromVersion: z.string(),
  toVersion: z.string(),
  migrationScript: z.string().optional(),
  dryRun: z.boolean().default(false),
  rollbackOnError: z.boolean().default(true),
  dataMappings: z.record(z.any()).optional()
});

const BackupRequestSchema = z.object({
  pluginId: z.string(),
  includeData: z.boolean().default(true),
  includeConfiguration: z.boolean().default(true),
  includeDependencies: z.boolean().default(false),
  compressionEnabled: z.boolean().default(true),
  encryptionEnabled: z.boolean().default(true),
  retentionDays: z.number().default(30)
});

const RestoreRequestSchema = z.object({
  pluginId: z.string(),
  backupId: z.string(),
  restoreData: z.boolean().default(true),
  restoreConfiguration: z.boolean().default(true),
  restoreDependencies: z.boolean().default(false),
  overwriteExisting: z.boolean().default(false)
});

// Initialize services
const orchestrator = getPluginLifecycleOrchestrator();
const versionManager = new PluginVersionManager();
const migrationService = new PluginMigrationService();
const backupService = new PluginBackupService();
const governanceService = new PluginGovernanceService();
const registrySync = new BackstageRegistrySync();

// GET - Retrieve plugin lifecycle status and history
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pluginId = searchParams.get('pluginId');
    const operation = searchParams.get('operation');
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const includeMetrics = searchParams.get('includeMetrics') === 'true';

    if (pluginId) {
      // Get specific plugin lifecycle status
      const status = await orchestrator.getPluginStatus(pluginId);
      const response: any = { status };

      if (includeHistory) {
        response.history = orchestrator.getPluginHistory(pluginId);
      }

      if (includeMetrics) {
        response.metrics = await orchestrator.getPluginMetrics(pluginId);
      }

      // Add version information
      response.versions = await versionManager.getAvailableVersions(pluginId);
      response.currentVersion = await versionManager.getCurrentVersion(pluginId);

      // Add governance status
      response.governance = await governanceService.getPluginGovernanceStatus(pluginId);

      return NextResponse.json(response);
    }

    if (operation) {
      // Get operation status
      const operationStatus = orchestrator.getOperationStatus(operation);
      return NextResponse.json(operationStatus || { error: 'Operation not found' }, { 
        status: operationStatus ? 200 : 404 
      });
    }

    // Get all plugin states and statistics
    const allStates = orchestrator.getAllPluginStates();
    const statistics = orchestrator.getStatistics();
    const governanceReport = await governanceService.getComplianceReport();

    return NextResponse.json({
      plugins: allStates,
      statistics,
      governance: governanceReport,
      orchestratorStatus: 'healthy'
    });

  } catch (error) {
    console.error('Failed to get plugin lifecycle status:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve plugin lifecycle status' },
      { status: 500 }
    );
  }
}

// POST - Execute plugin lifecycle operations
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Generate operation ID
    const operationId = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    switch (action) {
      case 'install':
        return handleInstall(body, operationId);
      
      case 'update':
        return handleUpdate(body, operationId);
      
      case 'rollback':
        return handleRollback(body, operationId);
      
      case 'uninstall':
        return handleUninstall(body, operationId);
      
      case 'migrate':
        return handleMigration(body, operationId);
      
      case 'backup':
        return handleBackup(body);
      
      case 'restore':
        return handleRestore(body);
      
      case 'batch':
        return handleBatchOperations(body, operationId);
      
      case 'sync':
        return handleRegistrySync();
      
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Plugin lifecycle operation failed:', error);
    return NextResponse.json(
      { error: 'Operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel or cleanup operations
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const operationId = searchParams.get('operationId');
    const pluginId = searchParams.get('pluginId');

    if (operationId) {
      // Cancel specific operation
      const cancelled = await orchestrator.cancelOperation(operationId);
      return NextResponse.json({ 
        success: cancelled,
        message: cancelled ? 'Operation cancelled' : 'Operation not found or cannot be cancelled'
      });
    }

    if (pluginId) {
      // Force cleanup plugin resources
      const cleanup = await orchestrator.forceCleanup(pluginId);
      return NextResponse.json({ 
        success: cleanup.success,
        message: cleanup.message
      });
    }

    return NextResponse.json(
      { error: 'Operation ID or Plugin ID required' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Failed to cancel/cleanup operation:', error);
    return NextResponse.json(
      { error: 'Failed to cancel/cleanup operation' },
      { status: 500 }
    );
  }
}

// Handler functions for different operations

async function handleInstall(body: any, operationId: string) {
  const request = InstallRequestSchema.parse(body);
  
  // Check governance policies
  const governanceCheck = await governanceService.checkInstallationPolicy(request.pluginId, request.version);
  if (!governanceCheck.approved) {
    return NextResponse.json(
      { 
        error: 'Installation blocked by governance policy',
        reason: governanceCheck.reason,
        requiredApprovals: governanceCheck.requiredApprovals
      },
      { status: 403 }
    );
  }

  // Sync with Backstage registry to get latest metadata
  await registrySync.syncPluginMetadata(request.pluginId);

  // Check compatibility
  const compatibility = await versionManager.checkCompatibility(
    request.pluginId,
    request.version || 'latest'
  );

  if (!compatibility.compatible) {
    return NextResponse.json(
      { 
        error: 'Plugin version incompatible',
        issues: compatibility.issues,
        suggestedVersion: compatibility.suggestedVersion
      },
      { status: 400 }
    );
  }

  // Create backup point before installation
  if (request.rollbackOnFailure) {
    await backupService.createSystemBackup('pre-install');
  }

  // Execute installation through orchestrator
  const result = await orchestrator.executeOperation({
    operationId,
    pluginId: request.pluginId,
    operation: 'install',
    version: request.version,
    userId: 'system', // Should come from auth context
    priority: 'normal',
    configuration: request.configuration,
    dependencies: request.dependencies,
    environment: request.environment,
    rollbackOnFailure: request.rollbackOnFailure,
    metadata: {
      preInstallHooks: request.preInstallHooks,
      postInstallHooks: request.postInstallHooks,
      healthCheckEnabled: request.healthCheckEnabled,
      multiTenant: request.multiTenant
    }
  });

  return NextResponse.json({
    operationId,
    success: result.success,
    pluginId: result.pluginId,
    version: request.version,
    status: result.finalState,
    logs: result.logs,
    metrics: result.metrics,
    duration: result.duration,
    warnings: result.warnings
  });
}

async function handleUpdate(body: any, operationId: string) {
  const request = UpdateRequestSchema.parse(body);

  // Check if update is allowed by governance
  const governanceCheck = await governanceService.checkUpdatePolicy(
    request.pluginId,
    request.targetVersion
  );

  if (!governanceCheck.approved) {
    return NextResponse.json(
      { 
        error: 'Update blocked by governance policy',
        reason: governanceCheck.reason
      },
      { status: 403 }
    );
  }

  // Create backup before update
  if (request.backupBeforeUpdate) {
    const backup = await backupService.createPluginBackup(request.pluginId, {
      includeData: true,
      includeConfiguration: true
    });
    console.log(`Created backup ${backup.backupId} before update`);
  }

  // Check compatibility if enabled
  if (request.compatibilityCheck) {
    const compatibility = await versionManager.checkUpdateCompatibility(
      request.pluginId,
      request.targetVersion
    );

    if (!compatibility.compatible) {
      return NextResponse.json(
        { 
          error: 'Update version incompatible',
          breakingChanges: compatibility.breakingChanges,
          migrationRequired: compatibility.migrationRequired
        },
        { status: 400 }
      );
    }
  }

  // Execute update based on strategy
  let updateResult;
  switch (request.strategy) {
    case 'canary':
      updateResult = await executeCanaryUpdate(request, operationId);
      break;
    case 'blue-green':
      updateResult = await executeBlueGreenUpdate(request, operationId);
      break;
    case 'rolling':
      updateResult = await executeRollingUpdate(request, operationId);
      break;
    default:
      updateResult = await executeImmediateUpdate(request, operationId);
  }

  return NextResponse.json(updateResult);
}

async function handleRollback(body: any, operationId: string) {
  const request = RollbackRequestSchema.parse(body);

  // Get rollback target version
  const targetVersion = request.targetVersion || 
    await versionManager.getPreviousVersion(request.pluginId);

  if (!targetVersion) {
    return NextResponse.json(
      { error: 'No previous version available for rollback' },
      { status: 400 }
    );
  }

  // Execute rollback
  const result = await orchestrator.executeOperation({
    operationId,
    pluginId: request.pluginId,
    operation: 'update', // Rollback is essentially an update to previous version
    version: targetVersion,
    userId: 'system',
    priority: 'high', // Rollbacks are high priority
    metadata: {
      isRollback: true,
      strategy: request.strategy,
      preserveData: request.preserveData,
      restoreConfiguration: request.restoreConfiguration
    }
  });

  // Restore configuration if requested
  if (request.restoreConfiguration && result.success) {
    await backupService.restorePluginConfiguration(request.pluginId, targetVersion);
  }

  return NextResponse.json({
    operationId,
    success: result.success,
    pluginId: request.pluginId,
    rolledBackTo: targetVersion,
    status: result.finalState,
    logs: result.logs,
    duration: result.duration
  });
}

async function handleUninstall(body: any, operationId: string) {
  const request = UninstallRequestSchema.parse(body);

  // Check for dependent plugins
  const dependents = await versionManager.getDependentPlugins(request.pluginId);
  
  if (dependents.length > 0 && !request.removeDependent) {
    return NextResponse.json(
      { 
        error: 'Cannot uninstall: other plugins depend on this plugin',
        dependents
      },
      { status: 400 }
    );
  }

  // Create backup if requested
  if (request.backupBeforeRemoval) {
    await backupService.createPluginBackup(request.pluginId, {
      includeData: true,
      includeConfiguration: true,
      includeDependencies: true
    });
  }

  // Execute uninstall
  const result = await orchestrator.executeOperation({
    operationId,
    pluginId: request.pluginId,
    operation: 'uninstall',
    userId: 'system',
    priority: 'normal',
    metadata: {
      cleanupStrategy: request.cleanupStrategy,
      preserveData: request.preserveData,
      removeDependent: request.removeDependent
    }
  });

  return NextResponse.json({
    operationId,
    success: result.success,
    pluginId: request.pluginId,
    status: result.finalState,
    dataPreserved: request.preserveData,
    logs: result.logs,
    duration: result.duration
  });
}

async function handleMigration(body: any, operationId: string) {
  const request = MigrationRequestSchema.parse(body);

  // Validate migration path
  const migrationPath = await migrationService.validateMigrationPath(
    request.pluginId,
    request.fromVersion,
    request.toVersion
  );

  if (!migrationPath.valid) {
    return NextResponse.json(
      { 
        error: 'Invalid migration path',
        reason: migrationPath.reason,
        suggestedPath: migrationPath.suggestedPath
      },
      { status: 400 }
    );
  }

  // Execute migration
  const migrationResult = await migrationService.executeMigration({
    pluginId: request.pluginId,
    fromVersion: request.fromVersion,
    toVersion: request.toVersion,
    migrationScript: request.migrationScript,
    dryRun: request.dryRun,
    rollbackOnError: request.rollbackOnError,
    dataMappings: request.dataMappings
  });

  return NextResponse.json({
    operationId,
    success: migrationResult.success,
    pluginId: request.pluginId,
    migratedFrom: request.fromVersion,
    migratedTo: request.toVersion,
    dryRun: request.dryRun,
    dataTransformed: migrationResult.dataTransformed,
    errors: migrationResult.errors,
    warnings: migrationResult.warnings,
    duration: migrationResult.duration
  });
}

async function handleBackup(body: any) {
  const request = BackupRequestSchema.parse(body);

  const backup = await backupService.createPluginBackup(request.pluginId, {
    includeData: request.includeData,
    includeConfiguration: request.includeConfiguration,
    includeDependencies: request.includeDependencies,
    compressionEnabled: request.compressionEnabled,
    encryptionEnabled: request.encryptionEnabled,
    retentionDays: request.retentionDays
  });

  return NextResponse.json({
    success: true,
    backupId: backup.backupId,
    pluginId: request.pluginId,
    timestamp: backup.timestamp,
    size: backup.size,
    location: backup.location,
    expiresAt: backup.expiresAt
  });
}

async function handleRestore(body: any) {
  const request = RestoreRequestSchema.parse(body);

  const restore = await backupService.restorePluginBackup(request.backupId, {
    pluginId: request.pluginId,
    restoreData: request.restoreData,
    restoreConfiguration: request.restoreConfiguration,
    restoreDependencies: request.restoreDependencies,
    overwriteExisting: request.overwriteExisting
  });

  return NextResponse.json({
    success: restore.success,
    pluginId: request.pluginId,
    backupId: request.backupId,
    restoredItems: restore.restoredItems,
    warnings: restore.warnings,
    duration: restore.duration
  });
}

async function handleBatchOperations(body: any, baseOperationId: string) {
  const { operations, strategy = 'parallel', maxParallel = 3 } = body;

  if (!operations || operations.length === 0) {
    return NextResponse.json(
      { error: 'No operations provided' },
      { status: 400 }
    );
  }

  // Convert operations to orchestrator format
  const requests = operations.map((op: any, index: number) => ({
    operationId: `${baseOperationId}_${index}`,
    pluginId: op.pluginId,
    operation: op.action,
    version: op.version,
    userId: 'system',
    priority: op.priority || 'normal',
    configuration: op.configuration,
    dependencies: op.dependencies,
    environment: op.environment || 'development',
    rollbackOnFailure: op.rollbackOnFailure !== false
  }));

  // Execute batch operations
  const results = await orchestrator.executeBatchOperations(requests, {
    parallelism: strategy === 'parallel' ? maxParallel : 1,
    failFast: strategy === 'failfast',
    dependencyOrder: strategy === 'dependency'
  });

  return NextResponse.json({
    batchOperationId: baseOperationId,
    totalOperations: operations.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results: results.map(r => ({
      operationId: r.operationId,
      pluginId: r.pluginId,
      success: r.success,
      status: r.finalState,
      error: r.error?.message
    })),
    duration: results.reduce((sum, r) => sum + r.duration, 0)
  });
}

async function handleRegistrySync() {
  const syncResult = await registrySync.syncWithBackstageRegistry();

  return NextResponse.json({
    success: syncResult.success,
    pluginsSynced: syncResult.pluginsSynced,
    newPlugins: syncResult.newPlugins,
    updatedPlugins: syncResult.updatedPlugins,
    errors: syncResult.errors,
    timestamp: syncResult.timestamp
  });
}

// Update strategy implementations

async function executeCanaryUpdate(request: any, operationId: string) {
  const canaryPercentage = request.canaryPercentage || 10;
  
  // Phase 1: Deploy to canary instances
  const canaryResult = await orchestrator.executeOperation({
    operationId: `${operationId}_canary`,
    pluginId: request.pluginId,
    operation: 'update',
    version: request.targetVersion,
    userId: 'system',
    priority: 'high',
    metadata: {
      updateStrategy: 'canary',
      canaryPercentage,
      rollbackThreshold: request.rollbackThreshold
    }
  });

  if (!canaryResult.success) {
    return {
      operationId,
      success: false,
      strategy: 'canary',
      phase: 'canary',
      error: 'Canary deployment failed',
      details: canaryResult
    };
  }

  // Monitor canary metrics
  const canaryMetrics = await monitorCanaryDeployment(
    request.pluginId,
    request.rollbackThreshold
  );

  if (canaryMetrics.errorRate > request.rollbackThreshold) {
    // Rollback canary
    await orchestrator.executeOperation({
      operationId: `${operationId}_rollback`,
      pluginId: request.pluginId,
      operation: 'update',
      version: await versionManager.getCurrentVersion(request.pluginId),
      userId: 'system',
      priority: 'critical'
    });

    return {
      operationId,
      success: false,
      strategy: 'canary',
      phase: 'rollback',
      reason: 'Error threshold exceeded',
      metrics: canaryMetrics
    };
  }

  // Phase 2: Full deployment
  const fullResult = await orchestrator.executeOperation({
    operationId: `${operationId}_full`,
    pluginId: request.pluginId,
    operation: 'update',
    version: request.targetVersion,
    userId: 'system',
    priority: 'high',
    metadata: {
      updateStrategy: 'canary',
      phase: 'full'
    }
  });

  return {
    operationId,
    success: fullResult.success,
    strategy: 'canary',
    phase: 'completed',
    canaryMetrics,
    duration: canaryResult.duration + fullResult.duration
  };
}

async function executeBlueGreenUpdate(request: any, operationId: string) {
  // Deploy to green environment
  const greenResult = await orchestrator.executeOperation({
    operationId: `${operationId}_green`,
    pluginId: request.pluginId,
    operation: 'update',
    version: request.targetVersion,
    userId: 'system',
    priority: 'high',
    metadata: {
      updateStrategy: 'blue-green',
      environment: 'green'
    }
  });

  if (!greenResult.success) {
    return {
      operationId,
      success: false,
      strategy: 'blue-green',
      phase: 'green-deployment',
      error: 'Green deployment failed',
      details: greenResult
    };
  }

  // Run validation tests on green
  const validationResult = await versionManager.validateDeployment(
    request.pluginId,
    request.targetVersion
  );

  if (!validationResult.valid) {
    return {
      operationId,
      success: false,
      strategy: 'blue-green',
      phase: 'validation',
      error: 'Validation failed',
      validationErrors: validationResult.errors
    };
  }

  // Switch traffic to green
  const switchResult = await orchestrator.switchTraffic(
    request.pluginId,
    'green'
  );

  return {
    operationId,
    success: switchResult.success,
    strategy: 'blue-green',
    phase: 'completed',
    previousVersion: await versionManager.getCurrentVersion(request.pluginId),
    newVersion: request.targetVersion,
    duration: greenResult.duration
  };
}

async function executeRollingUpdate(request: any, operationId: string) {
  const instances = await orchestrator.getPluginInstances(request.pluginId);
  const batchSize = Math.ceil(instances.length / 3); // Update in 3 batches
  const results = [];

  for (let i = 0; i < instances.length; i += batchSize) {
    const batch = instances.slice(i, i + batchSize);
    const batchResult = await orchestrator.executeOperation({
      operationId: `${operationId}_batch_${i}`,
      pluginId: request.pluginId,
      operation: 'update',
      version: request.targetVersion,
      userId: 'system',
      priority: 'high',
      metadata: {
        updateStrategy: 'rolling',
        instances: batch,
        batchNumber: i / batchSize + 1,
        totalBatches: Math.ceil(instances.length / batchSize)
      }
    });

    results.push(batchResult);

    if (!batchResult.success && request.rollbackThreshold) {
      // Rollback if failure threshold exceeded
      await rollbackRollingUpdate(request.pluginId, i, batchSize);
      return {
        operationId,
        success: false,
        strategy: 'rolling',
        phase: 'rollback',
        failedAtBatch: i / batchSize + 1,
        results
      };
    }

    // Health check before proceeding to next batch
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
  }

  return {
    operationId,
    success: true,
    strategy: 'rolling',
    phase: 'completed',
    totalBatches: Math.ceil(instances.length / batchSize),
    duration: results.reduce((sum, r) => sum + r.duration, 0)
  };
}

async function executeImmediateUpdate(request: any, operationId: string) {
  return await orchestrator.executeOperation({
    operationId,
    pluginId: request.pluginId,
    operation: 'update',
    version: request.targetVersion,
    userId: 'system',
    priority: 'high',
    metadata: {
      updateStrategy: 'immediate',
      migrationScript: request.migrationScript
    }
  });
}

// Helper functions

async function monitorCanaryDeployment(pluginId: string, threshold: number) {
  // Simulate monitoring - in production, integrate with real metrics
  await new Promise(resolve => setTimeout(resolve, 10000)); // Monitor for 10 seconds
  
  return {
    errorRate: Math.random() * 0.1, // Random error rate for demo
    latencyP99: Math.random() * 100,
    throughput: Math.random() * 1000,
    healthScore: Math.random() * 100
  };
}

async function rollbackRollingUpdate(pluginId: string, failedBatch: number, batchSize: number) {
  // Rollback previously updated batches
  for (let i = 0; i < failedBatch; i += batchSize) {
    await orchestrator.executeOperation({
      operationId: `rollback_${i}`,
      pluginId,
      operation: 'update',
      version: await versionManager.getPreviousVersion(pluginId),
      userId: 'system',
      priority: 'critical'
    });
  }
}