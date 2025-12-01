/**
 * Service DORA Metrics API
 * Get DORA metrics for a specific service
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDORAMetricsService } from '@/services/analytics/dora-metrics';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ serviceId: string }>;
}

/**
 * GET /api/analytics/dora/services/[serviceId]
 * Get DORA metrics for a specific service
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { serviceId } = await params;
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as 'day' | 'week' | 'month' | 'quarter') || 'month';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeTrends = searchParams.get('includeTrends') !== 'false';

    const service = getDORAMetricsService();

    const metrics = await service.getServiceMetrics(serviceId, {
      period,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeTrends,
    });

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Failed to get service DORA metrics:', error);
    return NextResponse.json(
      { error: 'Failed to get service DORA metrics' },
      { status: 500 }
    );
  }
}
