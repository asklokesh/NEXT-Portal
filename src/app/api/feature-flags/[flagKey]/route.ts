/**
 * Feature Flag API Routes - Individual Flag Operations
 * Operations for specific feature flags
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeatureFlagService } from '@/lib/feature-flags/service';

const featureFlagService = new FeatureFlagService({
  cacheEnabled: true,
  cacheTTL: 60000,
  streamingEnabled: true,
  metricsEnabled: true,
  auditEnabled: true,
  approvalRequired: false
});

/**
 * GET /api/feature-flags/[flagKey]
 * Get a specific feature flag
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { flagKey: string } }
) {
  try {
    const flagKey = params.flagKey;

    if (!flagKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'Flag key is required'
        },
        { status: 400 }
      );
    }

    const flag = await featureFlagService.getFlag(flagKey);

    if (!flag) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not Found',
          message: `Flag not found: ${flagKey}`
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: flag
    });

  } catch (error: any) {
    console.error(`Error getting feature flag ${params.flagKey}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get feature flag',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/feature-flags/[flagKey]
 * Update a specific feature flag
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { flagKey: string } }
) {
  try {
    const flagKey = params.flagKey;
    const updates = await request.json();

    if (!flagKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'Flag key is required'
        },
        { status: 400 }
      );
    }

    // Add update metadata
    updates.updatedBy = request.headers.get('x-user-id') || 'api';

    const flag = await featureFlagService.updateFlag(flagKey, updates);

    return NextResponse.json({
      success: true,
      data: flag
    });

  } catch (error: any) {
    console.error(`Error updating feature flag ${params.flagKey}:`, error);
    
    if (error.code === 'FLAG_NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: 'Not Found',
          message: error.message
        },
        { status: 404 }
      );
    }

    if (error.code === 'APPROVAL_REQUIRED') {
      return NextResponse.json(
        {
          success: false,
          error: 'Approval Required',
          message: error.message,
          requiresApproval: true
        },
        { status: 202 }
      );
    }

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
        error: 'Failed to update feature flag',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/feature-flags/[flagKey]
 * Delete (archive) a specific feature flag
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { flagKey: string } }
) {
  try {
    const flagKey = params.flagKey;

    if (!flagKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'Flag key is required'
        },
        { status: 400 }
      );
    }

    await featureFlagService.deleteFlag(flagKey);

    return NextResponse.json({
      success: true,
      message: `Flag ${flagKey} has been archived`
    });

  } catch (error: any) {
    console.error(`Error deleting feature flag ${params.flagKey}:`, error);
    
    if (error.code === 'FLAG_NOT_FOUND') {
      return NextResponse.json(
        {
          success: false,
          error: 'Not Found',
          message: error.message
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete feature flag',
        message: error.message
      },
      { status: 500 }
    );
  }
}