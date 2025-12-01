/**
 * Team DORA Metrics API
 * Get DORA metrics for a specific team
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDORAMetricsService } from '@/services/analytics/dora-metrics';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ teamId: string }>;
}

/**
 * GET /api/analytics/dora/teams/[teamId]
 * Get DORA metrics for a specific team
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { teamId } = await params;
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as 'day' | 'week' | 'month' | 'quarter') || 'month';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeTrends = searchParams.get('includeTrends') !== 'false';
    const includeBreakdown = searchParams.get('includeBreakdown') !== 'false';

    const service = getDORAMetricsService();

    const metrics = await service.getTeamMetrics(teamId, {
      period,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeTrends,
      includeBreakdown,
    });

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Failed to get team DORA metrics:', error);
    return NextResponse.json(
      { error: 'Failed to get team DORA metrics' },
      { status: 500 }
    );
  }
}
