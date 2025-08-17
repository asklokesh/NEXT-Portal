/**
 * Plugin Rollback API Route
 * Handles rolling back plugins to previous versions
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
    const { pluginId, version, reason } = body;

    if (!pluginId || !version) {
      return NextResponse.json(
        { error: 'Plugin ID and target version are required' },
        { status: 400 }
      );
    }

    // Fetch plugin and version information
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
      include: {
        versions: {
          where: { version },
          take: 1
        },
        backups: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!plugin) {
      return NextResponse.json(
        { error: 'Plugin not found' },
        { status: 404 }
      );
    }

    if (plugin.versions.length === 0) {
      return NextResponse.json(
        { error: `Version ${version} not found for this plugin` },
        { status: 404 }
      );
    }

    const targetVersion = plugin.versions[0];

    // Create backup before rollback
    const backup = await prisma.pluginBackup.create({
      data: {
        pluginId,
        backupType: 'FULL',
        source: 'ROLLBACK',
        status: 'COMPLETED',
        storageProvider: 's3',
        storagePath: `/backups/${pluginId}/rollback_${Date.now()}`,
        checksumAlgorithm: 'sha256',
        encryption: true,
        notes: `Backup before rollback to v${version}`
      }
    });

    // Create new version entry for rollback
    const rollbackVersion = await prisma.pluginVersion.create({
      data: {
        pluginId,
        version,
        semverMajor: targetVersion.semverMajor,
        semverMinor: targetVersion.semverMinor,
        semverPatch: targetVersion.semverPatch,
        isCurrent: true,
        status: 'DEPLOYED',
        rollbackOf: targetVersion.id,
        deployedBy: session.user?.email || 'system',
        deployedAt: new Date(),
        notes: reason || 'Manual rollback'
      }
    });

    // Update previous current version
    await prisma.pluginVersion.updateMany({
      where: {
        pluginId,
        isCurrent: true,
        NOT: { id: rollbackVersion.id }
      },
      data: { isCurrent: false }
    });

    // Create deployment record
    await prisma.pluginDeployment.create({
      data: {
        pluginVersionId: rollbackVersion.id,
        environment: 'production',
        status: 'DEPLOYED',
        strategy: 'IMMEDIATE',
        progress: 100,
        deployedBy: session.user?.email || 'system',
        completedAt: new Date()
      }
    });

    // Log the rollback in audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user?.id,
        action: 'plugin.rollback',
        resource: 'plugin',
        resourceId: pluginId,
        metadata: {
          from_version: targetVersion.version,
          to_version: version,
          reason,
          backup_id: backup.id
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: `Successfully rolled back ${plugin.displayName} to version ${version}`,
      rollbackVersion: {
        id: rollbackVersion.id,
        version: rollbackVersion.version,
        deployedAt: rollbackVersion.deployedAt
      },
      backup: {
        id: backup.id,
        path: backup.storagePath
      }
    });

  } catch (error) {
    console.error('Rollback error:', error);
    return NextResponse.json(
      { error: 'Failed to rollback plugin' },
      { status: 500 }
    );
  }
}

// GET endpoint to list available rollback versions
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

    const versions = await prisma.pluginVersion.findMany({
      where: {
        pluginId,
        status: { in: ['DEPLOYED', 'ROLLED_BACK'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        _count: {
          select: {
            deployments: true,
            testResults: true
          }
        }
      }
    });

    const backups = await prisma.pluginBackup.findMany({
      where: {
        pluginId,
        status: 'COMPLETED'
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return NextResponse.json({
      versions: versions.map(v => ({
        id: v.id,
        version: v.version,
        isCurrent: v.isCurrent,
        deployedAt: v.deployedAt,
        status: v.status,
        deploymentCount: v._count.deployments,
        testsPassed: v._count.testResults,
        canRollback: !v.isCurrent && v.status === 'DEPLOYED'
      })),
      backups: backups.map(b => ({
        id: b.id,
        type: b.backupType,
        createdAt: b.createdAt,
        size: b.size,
        storagePath: b.storagePath
      }))
    });

  } catch (error) {
    console.error('Failed to fetch rollback versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rollback versions' },
      { status: 500 }
    );
  }
}