/**
 * Feature Flag Evaluation API
 * Real-time flag evaluation with context
 */

import { NextRequest, NextResponse } from 'next/server';
import { FeatureFlagService } from '@/lib/feature-flags/service';
import { UserContext } from '@/lib/feature-flags/types';

const featureFlagService = new FeatureFlagService({
  cacheEnabled: true,
  cacheTTL: 60000,
  streamingEnabled: true,
  metricsEnabled: true,
  auditEnabled: true,
  approvalRequired: false
});

/**
 * POST /api/feature-flags/[flagKey]/evaluate
 * Evaluate a feature flag for a specific context
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { flagKey: string } }
) {
  try {
    const flagKey = params.flagKey;
    const body = await request.json();
    
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

    // Extract user context from request
    const context: UserContext = {
      userId: body.userId || request.headers.get('x-user-id') || undefined,
      sessionId: body.sessionId || request.headers.get('x-session-id') || undefined,
      email: body.email || request.headers.get('x-user-email') || undefined,
      groups: body.groups || [],
      attributes: {
        ...body.attributes,
        ip: request.ip || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
        environment: body.environment || 'production',
        ...body
      },
      location: body.location,
      device: body.device,
      custom: body.custom
    };

    const evaluation = await featureFlagService.evaluateFlag(flagKey, context);

    // Set cache headers for performance
    const response = NextResponse.json({
      success: true,
      data: evaluation
    });

    response.headers.set('Cache-Control', 'public, max-age=30'); // 30 seconds cache
    response.headers.set('X-Flag-Key', flagKey);
    response.headers.set('X-Evaluation-Reason', evaluation.reason.kind);

    return response;

  } catch (error: any) {
    console.error(`Error evaluating feature flag ${params.flagKey}:`, error);
    
    if (error.name === 'FlagEvaluationError') {
      return NextResponse.json(
        {
          success: false,
          error: 'Evaluation Error',
          message: error.message,
          flagKey: error.flagKey
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to evaluate feature flag',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/feature-flags/[flagKey]/evaluate
 * Simple flag evaluation with query parameters
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { flagKey: string } }
) {
  try {
    const flagKey = params.flagKey;
    const { searchParams } = new URL(request.url);
    
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

    const evaluation = await featureFlagService.evaluateFlag(flagKey, context);

    const response = NextResponse.json({
      success: true,
      data: evaluation
    });

    // Set cache headers
    response.headers.set('Cache-Control', 'public, max-age=30');
    response.headers.set('X-Flag-Key', flagKey);
    response.headers.set('X-Evaluation-Reason', evaluation.reason.kind);

    return response;

  } catch (error: any) {
    console.error(`Error evaluating feature flag ${params.flagKey}:`, error);
    
    if (error.name === 'FlagEvaluationError') {
      return NextResponse.json(
        {
          success: false,
          error: 'Evaluation Error',
          message: error.message,
          flagKey: error.flagKey
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to evaluate feature flag',
        message: error.message
      },
      { status: 500 }
    );
  }
}