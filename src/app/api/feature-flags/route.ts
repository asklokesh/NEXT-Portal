/**
 * Feature Flags API Routes
 * Main CRUD operations for feature flag management
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeatureFlagService } from '@/lib/feature-flags/service';
import { FeatureFlag, FlagFilters } from '@/lib/feature-flags/types';

const featureFlagService = new FeatureFlagService({
  cacheEnabled: true,
  cacheTTL: 60000,
  streamingEnabled: true,
  metricsEnabled: true,
  auditEnabled: true,
  approvalRequired: false // Set to true in production environments
});

/**
 * GET /api/feature-flags
 * List feature flags with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters: FlagFilters = {
      environment: searchParams.get('environment') || undefined,
      enabled: searchParams.get('enabled') ? searchParams.get('enabled') === 'true' : undefined,
      type: searchParams.get('type') as any || undefined,
      tags: searchParams.get('tags')?.split(',') || undefined,
      archived: searchParams.get('archived') ? searchParams.get('archived') === 'true' : undefined,
      search: searchParams.get('search') || undefined,
      createdBy: searchParams.get('createdBy') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof FlagFilters] === undefined) {
        delete filters[key as keyof FlagFilters];
      }
    });

    const flags = await featureFlagService.listFlags(filters);

    return NextResponse.json({
      success: true,
      data: flags,
      pagination: {
        total: flags.length,
        limit: filters.limit || 50,
        offset: filters.offset || 0
      }
    });

  } catch (error: any) {
    console.error('Error listing feature flags:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list feature flags',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/feature-flags
 * Create a new feature flag
 */
export async function POST(request: NextRequest) {
  try {
    const flagData = await request.json();

    // Basic validation
    if (!flagData.key || !flagData.name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'Flag key and name are required'
        },
        { status: 400 }
      );
    }

    // Add creation metadata
    flagData.createdBy = request.headers.get('x-user-id') || 'api';
    flagData.updatedBy = flagData.createdBy;

    const flag = await featureFlagService.createFlag(flagData);

    return NextResponse.json({
      success: true,
      data: flag
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating feature flag:', error);
    
    if (error.code === 'VALIDATION_ERROR') {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: error.message
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create feature flag',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/feature-flags
 * Bulk update multiple feature flags
 */
export async function PUT(request: NextRequest) {
  try {
    const { updates } = await request.json();

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'Updates must be an array'
        },
        { status: 400 }
      );
    }

    // Add update metadata
    const userId = request.headers.get('x-user-id') || 'api';
    updates.forEach((update: any) => {
      if (update.updates) {
        update.updates.updatedBy = userId;
      }
    });

    const results = await featureFlagService.bulkUpdateFlags(updates);

    return NextResponse.json({
      success: true,
      data: results,
      updated: results.length,
      failed: updates.length - results.length
    });

  } catch (error: any) {
    console.error('Error bulk updating feature flags:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to bulk update feature flags',
        message: error.message
      },
      { status: 500 }
    );
  }
}