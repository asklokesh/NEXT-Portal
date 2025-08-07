/**
 * Feature Flag Metrics API
 * Analytics and performance metrics for feature flags
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
 * GET /api/feature-flags/metrics
 * Get aggregated metrics for multiple flags
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse parameters
    const flagKeysParam = searchParams.get('flagKeys');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const interval = searchParams.get('interval') || '60'; // minutes
    
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

    // Default to last 24 hours if no dates provided
    const timeRange = {
      start: startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate) : new Date()
    };

    // Get metrics collector instance (normally would be injected)
    const metricsCollector = (featureFlagService as any).metricsCollector;
    
    const aggregatedMetrics = await metricsCollector.getAggregatedMetrics(flagKeys, timeRange);
    
    // Get performance trends for each flag
    const trends: Record<string, any> = {};
    for (const flagKey of flagKeys.slice(0, 10)) { // Limit to 10 flags for performance
      trends[flagKey] = await metricsCollector.getPerformanceTrends(
        flagKey, 
        parseInt(interval)
      );
    }

    // Check for anomalies
    const anomalies: Record<string, any> = {};
    for (const flagKey of flagKeys.slice(0, 5)) { // Limit anomaly detection
      anomalies[flagKey] = await metricsCollector.detectAnomalies(flagKey);
    }

    const response = NextResponse.json({
      success: true,
      data: {
        summary: aggregatedMetrics,
        trends,
        anomalies,
        timeRange,
        interval: parseInt(interval)
      }
    });

    // Cache for 5 minutes
    response.headers.set('Cache-Control', 'public, max-age=300');
    
    return response;

  } catch (error: any) {
    console.error('Error getting feature flag metrics:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get feature flag metrics',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/feature-flags/metrics
 * Record custom business metrics
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.flagKey || !body.metricName || body.value === undefined) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'flagKey, metricName, and value are required'
        },
        { status: 400 }
      );
    }

    if (typeof body.value !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation Error',
          message: 'Value must be a number'
        },
        { status: 400 }
      );
    }

    // Get metrics collector instance
    const metricsCollector = (featureFlagService as any).metricsCollector;
    
    await metricsCollector.recordBusinessMetric(
      body.flagKey,
      body.metricName,
      body.value
    );

    return NextResponse.json({
      success: true,
      message: 'Business metric recorded successfully'
    });

  } catch (error: any) {
    console.error('Error recording business metric:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to record business metric',
        message: error.message
      },
      { status: 500 }
    );
  }
}