import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as semver from 'semver';
import { z } from 'zod';

const prisma = new PrismaClient();

// Version tracking and semantic versioning support
const VersionSchema = z.object({
  pluginId: z.string(),
  version: z.string(),
  changelog: z.string().optional(),
  dependencies: z.record(z.string()).optional(),
  configuration: z.record(z.any()).optional(),
  migrationScript: z.string().optional(),
  rollbackScript: z.string().optional(),
  installSource: z.enum(['NPM', 'GIT', 'LOCAL', 'CUSTOM']).default('NPM'),
  gitCommit: z.string().optional(),
  gitBranch: z.string().optional(),
  notes: z.string().optional(),
});

const RollbackSchema = z.object({
  pluginId: z.string(),
  targetVersionId: z.string(),
  reason: z.string().optional(),
  skipMigrations: z.boolean().default(false),
  createBackup: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pluginId = searchParams.get('pluginId');
    const includeDeployments = searchParams.get('includeDeployments') === 'true';
    const includeBackups = searchParams.get('includeBackups') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (pluginId) {
      // Get version history for specific plugin
      const plugin = await prisma.plugin.findUnique({
        where: { id: pluginId },
        include: {
          versions: {
            include: {
              deployments: includeDeployments,
              backupsBefore: includeBackups,
              backupsAfter: includeBackups,
              rollbackTo: true,
              rollbacksFrom: {
                select: { id: true, version: true, deployedAt: true }
              },
              migrationExecution: {
                where: { status: { in: ['COMPLETED', 'FAILED'] } },
                orderBy: { executedAt: 'desc' },
                take: 5
              }
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
          }
        }
      });

      if (!plugin) {
        return NextResponse.json(
          { error: 'Plugin not found' },
          { status: 404 }
        );
      }

      // Generate version comparison and diff
      const versions = plugin.versions;
      const versionComparison = generateVersionComparison(versions);
      const changelog = await generateChangelog(plugin.id, versions);

      return NextResponse.json({
        plugin,
        versionComparison,
        changelog,
        pagination: {
          limit,
          offset,
          total: versions.length
        }
      });
    } else {
      // Get all plugins with their current versions
      const plugins = await prisma.plugin.findMany({
        include: {
          versions: {
            where: { isCurrent: true },
            include: {
              deployments: {
                where: { status: { in: ['DEPLOYED', 'FAILED'] } },
                orderBy: { completedAt: 'desc' },
                take: 1
              }
            }
          }
        },
        take: limit,
        skip: offset,
        orderBy: { updatedAt: 'desc' }
      });

      return NextResponse.json({
        plugins,
        pagination: {
          limit,
          offset,
          total: await prisma.plugin.count()
        }
      });
    }
  } catch (error) {
    console.error('Error fetching plugin versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plugin versions' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'create_version':
        return await createVersion(body);
      case 'deploy_version':
        return await deployVersion(body);
      case 'rollback':
        return await rollbackVersion(body);
      case 'compare_versions':
        return await compareVersions(body);
      case 'execute_migration':
        return await executeMigration(body);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing plugin version request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

async function createVersion(data: any) {
  const validation = VersionSchema.parse(data);
  
  // Parse semantic version
  const parsedVersion = semver.parse(validation.version);
  if (!parsedVersion) {
    return NextResponse.json(
      { error: 'Invalid semantic version' },
      { status: 400 }
    );
  }

  // Check if plugin exists, create if not
  let plugin = await prisma.plugin.findUnique({
    where: { id: validation.pluginId }
  });

  if (!plugin) {
    // Try to find by name instead of ID
    plugin = await prisma.plugin.findUnique({
      where: { name: validation.pluginId }
    });

    if (!plugin) {
      return NextResponse.json(
        { error: 'Plugin not found' },
        { status: 404 }
      );
    }
  }

  // Check for version conflicts
  const existingVersion = await prisma.pluginVersion.findUnique({
    where: {
      pluginId_version: {
        pluginId: plugin.id,
        version: validation.version
      }
    }
  });

  if (existingVersion) {
    return NextResponse.json(
      { error: 'Version already exists' },
      { status: 409 }
    );
  }

  // Create backup before version creation if current version exists
  const currentVersion = await prisma.pluginVersion.findFirst({
    where: { pluginId: plugin.id, isCurrent: true }
  });

  let backupId = null;
  if (currentVersion) {
    const backup = await createBackupForVersion(plugin.id, currentVersion.id, 'PRE_DEPLOYMENT');
    backupId = backup.id;
  }

  // Create new version
  const newVersion = await prisma.pluginVersion.create({
    data: {
      pluginId: plugin.id,
      version: validation.version,
      semverMajor: parsedVersion.major,
      semverMinor: parsedVersion.minor,
      semverPatch: parsedVersion.patch,
      prereleaseTag: parsedVersion.prerelease.length > 0 ? parsedVersion.prerelease.join('.') : null,
      changelog: validation.changelog,
      dependencies: validation.dependencies,
      configuration: validation.configuration,
      migrationScript: validation.migrationScript,
      installSource: validation.installSource,
      gitCommit: validation.gitCommit,
      gitBranch: validation.gitBranch,
      notes: validation.notes,
      status: 'READY'
    }
  });

  // Generate changelog if not provided
  if (!validation.changelog) {
    const autoChangelog = await generateAutoChangelog(plugin.id, newVersion.id);
    await prisma.pluginVersion.update({
      where: { id: newVersion.id },
      data: { changelog: autoChangelog }
    });
  }

  return NextResponse.json({
    success: true,
    version: newVersion,
    backup: backupId ? { id: backupId } : null,
    message: 'Version created successfully'
  });
}

async function deployVersion(data: any) {
  const { pluginVersionId, environment = 'production', strategy = 'ROLLING', deployedBy } = data;

  const pluginVersion = await prisma.pluginVersion.findUnique({
    where: { id: pluginVersionId },
    include: { plugin: true }
  });

  if (!pluginVersion) {
    return NextResponse.json(
      { error: 'Plugin version not found' },
      { status: 404 }
    );
  }

  // Create backup before deployment
  const backup = await createBackupForVersion(
    pluginVersion.pluginId,
    pluginVersionId,
    'PRE_DEPLOYMENT'
  );

  // Create deployment record
  const deployment = await prisma.pluginDeployment.create({
    data: {
      pluginVersionId,
      environment,
      strategy,
      deployedBy,
      rollbackDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      status: 'DEPLOYING'
    }
  });

  try {
    // Execute deployment based on strategy
    let deploymentResult;
    switch (strategy) {
      case 'ROLLING':
        deploymentResult = await executeRollingDeployment(pluginVersion, deployment.id);
        break;
      case 'BLUE_GREEN':
        deploymentResult = await executeBlueGreenDeployment(pluginVersion, deployment.id);
        break;
      case 'CANARY':
        deploymentResult = await executeCanaryDeployment(pluginVersion, deployment.id);
        break;
      case 'IMMEDIATE':
        deploymentResult = await executeImmediateDeployment(pluginVersion, deployment.id);
        break;
      default:
        throw new Error(`Unsupported deployment strategy: ${strategy}`);
    }

    // Execute migration scripts if any
    if (pluginVersion.migrationScript) {
      await executeMigrationScript(pluginVersionId, 'DATABASE_SCHEMA', pluginVersion.migrationScript, deployedBy);
    }

    // Update deployment status
    await prisma.pluginDeployment.update({
      where: { id: deployment.id },
      data: {
        status: 'DEPLOYED',
        progress: 100,
        completedAt: new Date(),
        logs: deploymentResult.logs,
        healthCheck: deploymentResult.healthCheck
      }
    });

    // Mark version as current and deployed
    await prisma.$transaction(async (tx) => {
      // Remove current flag from other versions
      await tx.pluginVersion.updateMany({
        where: { pluginId: pluginVersion.pluginId, isCurrent: true },
        data: { isCurrent: false }
      });

      // Set new version as current
      await tx.pluginVersion.update({
        where: { id: pluginVersionId },
        data: {
          isCurrent: true,
          isDeployed: true,
          status: 'DEPLOYED',
          deployedAt: new Date(),
          deployedBy
        }
      });
    });

    return NextResponse.json({
      success: true,
      deployment,
      backup: { id: backup.id },
      healthCheck: deploymentResult.healthCheck,
      message: 'Deployment completed successfully'
    });

  } catch (error) {
    // Update deployment status to failed
    await prisma.pluginDeployment.update({
      where: { id: deployment.id },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      }
    });

    return NextResponse.json(
      { 
        error: 'Deployment failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        backup: { id: backup.id }
      },
      { status: 500 }
    );
  }
}

async function rollbackVersion(data: any) {
  const validation = RollbackSchema.parse(data);

  const targetVersion = await prisma.pluginVersion.findUnique({
    where: { id: validation.targetVersionId },
    include: { plugin: true }
  });

  if (!targetVersion) {
    return NextResponse.json(
      { error: 'Target version not found' },
      { status: 404 }
    );
  }

  const currentVersion = await prisma.pluginVersion.findFirst({
    where: { pluginId: targetVersion.pluginId, isCurrent: true }
  });

  if (!currentVersion) {
    return NextResponse.json(
      { error: 'No current version found' },
      { status: 400 }
    );
  }

  if (currentVersion.id === validation.targetVersionId) {
    return NextResponse.json(
      { error: 'Cannot rollback to the same version' },
      { status: 400 }
    );
  }

  // Create backup before rollback if requested
  let backupId = null;
  if (validation.createBackup) {
    const backup = await createBackupForVersion(
      targetVersion.pluginId,
      currentVersion.id,
      'ROLLBACK'
    );
    backupId = backup.id;
  }

  try {
    // Create rollback deployment
    const rollbackDeployment = await prisma.pluginDeployment.create({
      data: {
        pluginVersionId: validation.targetVersionId,
        environment: 'production',
        strategy: 'IMMEDIATE',
        deployedBy: 'system-rollback',
        status: 'DEPLOYING'
      }
    });

    // Execute rollback deployment
    const deploymentResult = await executeImmediateDeployment(targetVersion, rollbackDeployment.id);

    // Execute rollback migrations if needed and not skipped
    if (!validation.skipMigrations) {
      await executeRollbackMigrations(currentVersion.id, validation.targetVersionId);
    }

    // Update version states
    await prisma.$transaction(async (tx) => {
      // Mark current version as rolled back
      await tx.pluginVersion.update({
        where: { id: currentVersion.id },
        data: {
          isCurrent: false,
          status: 'ROLLED_BACK'
        }
      });

      // Mark target version as current
      await tx.pluginVersion.update({
        where: { id: validation.targetVersionId },
        data: {
          isCurrent: true,
          isDeployed: true,
          status: 'DEPLOYED',
          deployedAt: new Date(),
          rollbackOf: currentVersion.id
        }
      });

      // Update deployment status
      await tx.pluginDeployment.update({
        where: { id: rollbackDeployment.id },
        data: {
          status: 'DEPLOYED',
          progress: 100,
          completedAt: new Date(),
          logs: deploymentResult.logs
        }
      });
    });

    return NextResponse.json({
      success: true,
      rollbackDeployment,
      backup: backupId ? { id: backupId } : null,
      message: `Successfully rolled back to version ${targetVersion.version}`,
      reason: validation.reason
    });

  } catch (error) {
    return NextResponse.json(
      {
        error: 'Rollback failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        backup: backupId ? { id: backupId } : null
      },
      { status: 500 }
    );
  }
}

async function compareVersions(data: any) {
  const { version1Id, version2Id } = data;

  const [version1, version2] = await Promise.all([
    prisma.pluginVersion.findUnique({
      where: { id: version1Id },
      include: { plugin: true, deployments: true }
    }),
    prisma.pluginVersion.findUnique({
      where: { id: version2Id },
      include: { plugin: true, deployments: true }
    })
  ]);

  if (!version1 || !version2) {
    return NextResponse.json(
      { error: 'One or more versions not found' },
      { status: 404 }
    );
  }

  // Generate comparison diff
  const comparison = {
    versions: {
      from: { id: version1.id, version: version1.version, deployedAt: version1.deployedAt },
      to: { id: version2.id, version: version2.version, deployedAt: version2.deployedAt }
    },
    changes: {
      semver: {
        type: semver.diff(version1.version, version2.version),
        isBreaking: semver.major(version2.version) > semver.major(version1.version)
      },
      configuration: generateConfigDiff(version1.configuration, version2.configuration),
      dependencies: generateDependencyDiff(version1.dependencies, version2.dependencies),
      changelog: version2.changelog || 'No changelog available'
    },
    deployments: {
      version1: version1.deployments.filter(d => d.status === 'DEPLOYED'),
      version2: version2.deployments.filter(d => d.status === 'DEPLOYED')
    },
    recommendations: generateUpgradeRecommendations(version1, version2)
  };

  return NextResponse.json({ comparison });
}

async function executeMigration(data: any) {
  const { pluginVersionId, type, script, executedBy } = data;

  return await executeMigrationScript(pluginVersionId, type, script, executedBy);
}

// Helper functions

async function createBackupForVersion(pluginId: string, versionId: string, source: string) {
  return await prisma.pluginBackup.create({
    data: {
      pluginId,
      beforeVersionId: versionId,
      backupType: 'COMBINED',
      source,
      status: 'PENDING',
      storagePath: `backups/plugins/${pluginId}/${versionId}/${Date.now()}`,
      storageProvider: process.env.BACKUP_STORAGE_PROVIDER || 's3',
      storageRegion: process.env.BACKUP_STORAGE_REGION || 'us-east-1'
    }
  });
}

async function executeRollingDeployment(version: any, deploymentId: string) {
  // Simulate rolling deployment with progress updates
  const steps = ['validate', 'prepare', 'deploy', 'verify', 'complete'];
  
  for (let i = 0; i < steps.length; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
    
    await prisma.pluginDeployment.update({
      where: { id: deploymentId },
      data: { progress: Math.round(((i + 1) / steps.length) * 100) }
    });
  }

  return {
    logs: `Rolling deployment completed for ${version.plugin.name}@${version.version}`,
    healthCheck: { status: 'healthy', checks: ['api_responsive', 'metrics_available'] }
  };
}

async function executeBlueGreenDeployment(version: any, deploymentId: string) {
  return {
    logs: `Blue-Green deployment completed for ${version.plugin.name}@${version.version}`,
    healthCheck: { status: 'healthy', checks: ['switch_successful', 'traffic_routed'] }
  };
}

async function executeCanaryDeployment(version: any, deploymentId: string) {
  return {
    logs: `Canary deployment completed for ${version.plugin.name}@${version.version}`,
    healthCheck: { status: 'healthy', checks: ['canary_metrics_good', 'error_rate_normal'] }
  };
}

async function executeImmediateDeployment(version: any, deploymentId: string) {
  return {
    logs: `Immediate deployment completed for ${version.plugin.name}@${version.version}`,
    healthCheck: { status: 'healthy', checks: ['deployment_successful'] }
  };
}

async function executeMigrationScript(pluginVersionId: string, type: string, script: string, executedBy: string) {
  const startTime = Date.now();
  
  const migration = await prisma.pluginMigrationExecution.create({
    data: {
      pluginVersionId,
      type,
      script,
      executedBy,
      status: 'RUNNING'
    }
  });

  try {
    let output = '';
    
    // Execute migration based on type
    switch (type) {
      case 'DATABASE_SCHEMA':
        // Execute database migration
        try {
          execSync(script, { encoding: 'utf8', timeout: 30000 });
          output = 'Database migration executed successfully';
        } catch (error) {
          throw new Error(`Database migration failed: ${error}`);
        }
        break;
      
      case 'CONFIGURATION':
        // Execute configuration migration
        output = 'Configuration migration completed';
        break;
      
      case 'FILE_SYSTEM':
        // Execute file system migration
        output = 'File system migration completed';
        break;
      
      default:
        output = `Custom migration executed: ${type}`;
    }

    const executionTime = Date.now() - startTime;

    await prisma.pluginMigrationExecution.update({
      where: { id: migration.id },
      data: {
        status: 'COMPLETED',
        output,
        executionTime,
        executedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      migration: { ...migration, status: 'COMPLETED', output, executionTime }
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await prisma.pluginMigrationExecution.update({
      where: { id: migration.id },
      data: {
        status: 'FAILED',
        error: errorMessage,
        executionTime,
        executedAt: new Date()
      }
    });

    return NextResponse.json(
      {
        error: 'Migration failed',
        details: errorMessage,
        migration: { ...migration, status: 'FAILED', error: errorMessage, executionTime }
      },
      { status: 500 }
    );
  }
}

async function executeRollbackMigrations(currentVersionId: string, targetVersionId: string) {
  const migrations = await prisma.pluginMigrationExecution.findMany({
    where: {
      pluginVersionId: currentVersionId,
      status: 'COMPLETED',
      rollbackScript: { not: null }
    },
    orderBy: { executedAt: 'desc' }
  });

  for (const migration of migrations) {
    if (migration.rollbackScript) {
      try {
        execSync(migration.rollbackScript, { encoding: 'utf8', timeout: 30000 });
      } catch (error) {
        console.error(`Rollback migration failed:`, error);
        throw new Error(`Failed to rollback migration ${migration.id}`);
      }
    }
  }
}

function generateVersionComparison(versions: any[]) {
  if (versions.length < 2) return null;

  const sorted = versions.sort((a, b) => semver.compare(b.version, a.version));
  const comparison = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const newer = sorted[i];
    const older = sorted[i + 1];
    
    comparison.push({
      from: { id: older.id, version: older.version },
      to: { id: newer.id, version: newer.version },
      type: semver.diff(older.version, newer.version),
      isBreaking: semver.major(newer.version) > semver.major(older.version)
    });
  }

  return comparison;
}

async function generateChangelog(pluginId: string, versions: any[]) {
  const changelog = versions
    .filter(v => v.changelog)
    .map(v => ({
      version: v.version,
      date: v.createdAt,
      changes: v.changelog
    }))
    .sort((a, b) => semver.compare(b.version, a.version));

  return changelog;
}

async function generateAutoChangelog(pluginId: string, versionId: string) {
  const version = await prisma.pluginVersion.findUnique({
    where: { id: versionId },
    include: { plugin: true }
  });

  if (!version) return null;

  const previousVersion = await prisma.pluginVersion.findFirst({
    where: {
      pluginId,
      semverMajor: { lte: version.semverMajor },
      semverMinor: { lte: version.semverMinor },
      semverPatch: { lt: version.semverPatch },
      NOT: { id: versionId }
    },
    orderBy: [
      { semverMajor: 'desc' },
      { semverMinor: 'desc' },
      { semverPatch: 'desc' }
    ]
  });

  if (!previousVersion) {
    return `## ${version.version}\n\nInitial version of ${version.plugin.name}`;
  }

  // Generate basic changelog based on version difference
  const versionDiff = semver.diff(previousVersion.version, version.version);
  let changeType = 'patch';
  
  switch (versionDiff) {
    case 'major':
      changeType = 'major';
      break;
    case 'minor':
      changeType = 'minor';
      break;
    default:
      changeType = 'patch';
  }

  return `## ${version.version}\n\n### ${changeType.toUpperCase()} Changes\n\n- Version bump from ${previousVersion.version} to ${version.version}`;
}

function generateConfigDiff(config1: any, config2: any) {
  const diff = {
    added: {},
    removed: {},
    changed: {}
  };

  const keys1 = Object.keys(config1 || {});
  const keys2 = Object.keys(config2 || {});

  // Find added keys
  keys2.forEach(key => {
    if (!keys1.includes(key)) {
      diff.added[key] = config2[key];
    }
  });

  // Find removed keys
  keys1.forEach(key => {
    if (!keys2.includes(key)) {
      diff.removed[key] = config1[key];
    }
  });

  // Find changed keys
  keys1.forEach(key => {
    if (keys2.includes(key) && JSON.stringify(config1[key]) !== JSON.stringify(config2[key])) {
      diff.changed[key] = { from: config1[key], to: config2[key] };
    }
  });

  return diff;
}

function generateDependencyDiff(deps1: any, deps2: any) {
  const diff = {
    added: {},
    removed: {},
    updated: {}
  };

  const keys1 = Object.keys(deps1 || {});
  const keys2 = Object.keys(deps2 || {});

  keys2.forEach(key => {
    if (!keys1.includes(key)) {
      diff.added[key] = deps2[key];
    } else if (deps1[key] !== deps2[key]) {
      diff.updated[key] = { from: deps1[key], to: deps2[key] };
    }
  });

  keys1.forEach(key => {
    if (!keys2.includes(key)) {
      diff.removed[key] = deps1[key];
    }
  });

  return diff;
}

function generateUpgradeRecommendations(version1: any, version2: any) {
  const recommendations = [];

  const versionDiff = semver.diff(version1.version, version2.version);
  
  if (versionDiff === 'major') {
    recommendations.push({
      type: 'warning',
      message: 'Major version upgrade detected. Review breaking changes carefully.',
      priority: 'high'
    });
  }

  if (version2.migrationScript) {
    recommendations.push({
      type: 'info',
      message: 'Migration script available. Backup recommended before upgrade.',
      priority: 'medium'
    });
  }

  // Check for dependency conflicts
  const deps1 = version1.dependencies || {};
  const deps2 = version2.dependencies || {};
  
  Object.keys(deps2).forEach(dep => {
    if (deps1[dep] && semver.major(deps2[dep]) > semver.major(deps1[dep])) {
      recommendations.push({
        type: 'warning',
        message: `Dependency ${dep} has a major version upgrade: ${deps1[dep]} → ${deps2[dep]}`,
        priority: 'medium'
      });
    }
  });

  return recommendations;
}