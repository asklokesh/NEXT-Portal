/**
 * Bulk Feature Flag Evaluation API
 * Evaluate multiple flags in a single request
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeatureFlagService } from '@/lib/feature-flags/service';
import { UserContext, BulkEvaluationRequest } from '@/lib/feature-flags/types';

const featureFlagService = new FeatureFlagService({
  cacheEnabled: true,
  cacheTTL: 60000,
  streamingEnabled: true,
  metricsEnabled: true,
  auditEnabled: true,
  approvalRequired: false
});

/**
 * POST /api/feature-flags/evaluate/bulk
 * Evaluate multiple feature flags at once
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.flagKeys || !Array.isArray(body.flagKeys)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'flagKeys array is required'
        },
        { status: 400 }
      );
    }

    if (body.flagKeys.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'At least one flag key is required'
        },
        { status: 400 }
      );
    }

    if (body.flagKeys.length > 50) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'Maximum 50 flags can be evaluated at once'
        },
        { status: 400 }
      );
    }

    // Extract user context
    const context: UserContext = {
      userId: body.userId || request.headers.get('x-user-id') || undefined,
      sessionId: body.sessionId || request.headers.get('x-session-id') || undefined,
      email: body.email || request.headers.get('x-user-email') || undefined,
      groups: body.groups || [],
      attributes: {
        ...body.attributes,
        ip: request.ip || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
        environment: body.environment || 'production'
      },
      location: body.location,
      device: body.device,
      custom: body.custom
    };

    const bulkRequest: BulkEvaluationRequest = {
      flagKeys: body.flagKeys,
      context,
      includeReasons: body.includeReasons !== false // Default to true
    };

    const result = await featureFlagService.bulkEvaluateFlags(bulkRequest);

    const response = NextResponse.json({
      success: true,
      data: result,
      evaluatedCount: Object.keys(result.evaluations).length,
      requestedCount: body.flagKeys.length
    });

    // Set cache headers for performance
    response.headers.set('Cache-Control', 'public, max-age=30');
    response.headers.set('X-Evaluation-Count', String(Object.keys(result.evaluations).length));

    return response;

  } catch (error: any) {
    console.error('Error in bulk flag evaluation:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to evaluate feature flags',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/feature-flags/evaluate/bulk
 * Bulk evaluation with query parameters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const flagKeysParam = searchParams.get('flagKeys');
    if (!flagKeysParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'flagKeys parameter is required'
        },
        { status: 400 }
      );
    }

    const flagKeys = flagKeysParam.split(',').filter(key => key.trim());
    
    if (flagKeys.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'At least one flag key is required'
        },
        { status: 400 }
      );
    }

    if (flagKeys.length > 50) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'Maximum 50 flags can be evaluated at once'
        },
        { status: 400 }
      );
    }

    // Build context from query parameters and headers
    const context: UserContext = {
      userId: searchParams.get('userId') || request.headers.get('x-user-id') || undefined,
      sessionId: searchParams.get('sessionId') || request.headers.get('x-session-id') || undefined,
      email: searchParams.get('email') || request.headers.get('x-user-email') || undefined,
      groups: searchParams.get('groups')?.split(',') || [],
      attributes: {
        ip: request.ip || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
        environment: searchParams.get('environment') || 'production',
        segment: searchParams.get('segment'),
        beta: searchParams.get('beta') === 'true',
        canary: searchParams.get('canary') === 'true'
      },
      location: {
        country: searchParams.get('country') || undefined,
        region: searchParams.get('region') || undefined,
        city: searchParams.get('city') || undefined
      },
      device: {
        type: searchParams.get('deviceType') || undefined,
        os: searchParams.get('os') || undefined,
        browser: searchParams.get('browser') || undefined
      }
    };

    // Add custom attributes from query parameters
    searchParams.forEach((value, key) => {
      if (key.startsWith('attr_')) {
        const attrName = key.substring(5);
        context.attributes[attrName] = value;
      }
    });

    const bulkRequest: BulkEvaluationRequest = {
      flagKeys,
      context,
      includeReasons: searchParams.get('includeReasons') !== 'false'
    };

    const result = await featureFlagService.bulkEvaluateFlags(bulkRequest);

    const response = NextResponse.json({
      success: true,
      data: result,
      evaluatedCount: Object.keys(result.evaluations).length,
      requestedCount: flagKeys.length
    });

    // Set cache headers
    response.headers.set('Cache-Control', 'public, max-age=30');
    response.headers.set('X-Evaluation-Count', String(Object.keys(result.evaluations).length));

    return response;

  } catch (error: any) {
    console.error('Error in bulk flag evaluation:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to evaluate feature flags',
        message: error.message
      },
      { status: 500 }
    );
  }
}