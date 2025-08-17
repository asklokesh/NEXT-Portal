/**
 * Plugin Registry Sync API Route
 * Synchronizes plugin registry data with local database
 */

import { NextRequest, NextResponse } from 'next/server';
import { backstagePluginRegistry } from '../../../../../services/backstage-plugin-registry';
import { validateApiKey } from '../../../../../middleware/api-auth';

export async function POST(request: NextRequest) {
  try {
    // Validate API key for admin operations
    const authResult = await validateApiKey(request);
    if (!authResult.isValid || authResult.user?.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { 
      tenantId, 
      forceRefresh = false,
      includeVersions = true,
      batchSize = 50 
    } = body;

    console.log('[Registry API] Starting plugin registry sync...');

    // Start synchronization
    const startTime = Date.now();
    const syncResult = await backstagePluginRegistry.syncToDatabase(tenantId);
    const duration = Date.now() - startTime;

    console.log(`[Registry API] Sync completed in ${duration}ms:`, syncResult);

    return NextResponse.json({
      success: true,
      message: 'Plugin registry synchronized successfully',
      data: {
        ...syncResult,
        duration,
        tenantId: tenantId || 'global',
      },
    });

  } catch (error) {
    console.error('[Registry API] Sync failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Plugin registry sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') === 'true';

    if (status) {
      // Return sync status
      const syncStatus = await getSyncStatus();
      return NextResponse.json(syncStatus);
    }

    // Trigger sync and return immediate response
    const authResult = await validateApiKey(request);
    if (!authResult.isValid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Async sync without waiting
    backstagePluginRegistry.syncToDatabase()
      .then(result => console.log('[Registry API] Background sync completed:', result))
      .catch(error => console.error('[Registry API] Background sync failed:', error));

    return NextResponse.json({
      success: true,
      message: 'Plugin registry sync started in background',
    });

  } catch (error) {
    console.error('[Registry API] Request failed:', error);
    return NextResponse.json(
      {
        error: 'Failed to process registry request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get synchronization status
 */
async function getSyncStatus() {
  try {
    const { prisma } = await import('../../../../../lib/db/client');
    
    const [totalPlugins, installedPlugins, recentlyUpdated] = await Promise.all([
      prisma.plugin.count(),
      prisma.plugin.count({ where: { isInstalled: true } }),
      prisma.plugin.count({
        where: {
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }),
    ]);

    const lastSync = await prisma.plugin.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    return {
      totalPlugins,
      installedPlugins,
      recentlyUpdated,
      lastSyncAt: lastSync?.updatedAt,
      status: 'healthy',
    };
    
  } catch (error) {
    console.error('[Registry API] Failed to get sync status:', error);
    return {
      totalPlugins: 0,
      installedPlugins: 0,
      recentlyUpdated: 0,
      lastSyncAt: null,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}