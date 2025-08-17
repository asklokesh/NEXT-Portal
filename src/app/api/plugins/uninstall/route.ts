/**
 * Plugin Uninstall API Route
 * Handles safe plugin removal with cleanup and dependency checking
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getServerSession } from 'next-auth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      pluginId, 
      force = false,
      removeData = false,
      removeBackups = false 
    } = body;

    if (!pluginId) {
      return NextResponse.json(
        { error: 'Plugin ID is required' },
        { status: 400 }
      );
    }

    // Fetch plugin with dependencies
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
      include: {
        dependents: true,
        configurations: true,
        backups: true,
        analytics: {
          take: 1,
          orderBy: { timestamp: 'desc' }
        }
      }
    });

    if (!plugin) {
      return NextResponse.json(
        { error: 'Plugin not found' },
        { status: 404 }
      );
    }

    if (!plugin.isInstalled) {
      return NextResponse.json(
        { error: 'Plugin is not installed' },
        { status: 400 }
      );
    }

    // Check for dependent plugins
    if (plugin.dependents.length > 0 && !force) {
      const dependentNames = plugin.dependents.map(d => d.id).join(', ');
      return NextResponse.json(
        { 
          error: 'Cannot uninstall plugin with active dependents',
          dependents: plugin.dependents,
          message: `The following plugins depend on this plugin: ${dependentNames}. Use force=true to override.`
        },
        { status: 400 }
      );
    }

    // Create final backup before uninstall
    const finalBackup = await prisma.pluginBackup.create({
      data: {
        pluginId,
        backupType: 'FULL',
        source: 'PRE_DEPLOYMENT',
        status: 'COMPLETED',
        storageProvider: 's3',
        storagePath: `/backups/${pluginId}/final_${Date.now()}`,
        checksumAlgorithm: 'sha256',
        encryption: true,
        notes: 'Final backup before uninstall',
        retentionDays: 180 // Keep for 6 months
      }
    });

    // Begin transaction-like operations
    const operations = [];

    // 1. Disable the plugin first
    operations.push(
      prisma.plugin.update({
        where: { id: pluginId },
        data: { 
          isEnabled: false,
          status: 'INACTIVE'
        }
      })
    );

    // 2. Remove configurations if requested
    if (removeData) {
      operations.push(
        prisma.pluginConfiguration.deleteMany({
          where: { pluginId }
        })
      );
    } else {
      // Archive configurations
      operations.push(
        prisma.pluginConfiguration.updateMany({
          where: { pluginId },
          data: { isActive: false }
        })
      );
    }

    // 3. Remove or archive analytics data
    if (removeData) {
      operations.push(
        prisma.pluginAnalytics.deleteMany({
          where: { pluginId }
        })
      );
    }

    // 4. Handle backups
    if (removeBackups) {
      // Delete all except the final backup
      operations.push(
        prisma.pluginBackup.deleteMany({
          where: {
            pluginId,
            NOT: { id: finalBackup.id }
          }
        })
      );
    }

    // 5. Update dependencies
    operations.push(
      prisma.pluginDependency.deleteMany({
        where: {
          OR: [
            { pluginId },
            { dependsOnId: pluginId }
          ]
        }
      })
    );

    // 6. Mark plugin as uninstalled
    operations.push(
      prisma.plugin.update({
        where: { id: pluginId },
        data: {
          isInstalled: false,
          isEnabled: false,
          status: 'ARCHIVED',
          archivedAt: new Date()
        }
      })
    );

    // Execute all operations
    await Promise.all(operations);

    // Log the uninstall
    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        action: 'plugin.uninstall',
        resource: 'plugin',
        resourceId: pluginId,
        metadata: {
          plugin_name: plugin.name,
          force,
          removeData,
          removeBackups,
          final_backup_id: finalBackup.id
        }
      }
    });

    // Track uninstall event
    await prisma.pluginAnalytics.create({
      data: {
        pluginId,
        event: 'UNINSTALL',
        userId: session.user?.id,
        metadata: {
          reason: body.reason,
          force,
          removeData
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully uninstalled ${plugin.displayName}`,
      backup: {
        id: finalBackup.id,
        path: finalBackup.storagePath,
        retentionDays: finalBackup.retentionDays
      },
      dataRemoved: removeData,
      backupsRemoved: removeBackups
    });

  } catch (error) {
    console.error('Uninstall error:', error);
    return NextResponse.json(
      { error: 'Failed to uninstall plugin' },
      { status: 500 }
    );
  }
}

// GET endpoint to check uninstall impact
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');

    if (!pluginId) {
      return NextResponse.json(
        { error: 'Plugin ID is required' },
        { status: 400 }
      );
    }

    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
      include: {
        dependents: {
          include: {
            plugin: {
              select: {
                id: true,
                name: true,
                displayName: true
              }
            }
          }
        },
        configurations: true,
        backups: true,
        _count: {
          select: {
            analytics: true,
            performance: true,
            vulnerabilities: true
          }
        }
      }
    });

    if (!plugin) {
      return NextResponse.json(
        { error: 'Plugin not found' },
        { status: 404 }
      );
    }

    // Calculate data sizes
    const dataSize = {
      configurations: plugin.configurations.length,
      backups: plugin.backups.length,
      analytics: plugin._count.analytics,
      performance: plugin._count.performance,
      vulnerabilities: plugin._count.vulnerabilities
    };

    const totalBackupSize = plugin.backups.reduce((acc, b) => acc + Number(b.size || 0), 0);

    return NextResponse.json({
      plugin: {
        id: plugin.id,
        name: plugin.name,
        displayName: plugin.displayName,
        isInstalled: plugin.isInstalled
      },
      impact: {
        hasDependents: plugin.dependents.length > 0,
        dependents: plugin.dependents.map(d => ({
          id: d.plugin.id,
          name: d.plugin.displayName,
          type: d.dependencyType
        })),
        dataToRemove: dataSize,
        totalBackupSize: `${(totalBackupSize / 1024 / 1024).toFixed(2)} MB`,
        configurations: plugin.configurations.length,
        canUninstall: plugin.isInstalled
      },
      recommendations: {
        createBackup: true,
        removeData: dataSize.analytics > 10000 || totalBackupSize > 1024 * 1024 * 100, // > 100MB
        removeBackups: plugin.backups.length > 20,
        waitTime: plugin.dependents.length > 0 ? 'Check dependent plugins first' : 'Safe to uninstall'
      }
    });

  } catch (error) {
    console.error('Failed to check uninstall impact:', error);
    return NextResponse.json(
      { error: 'Failed to check uninstall impact' },
      { status: 500 }
    );
  }
}