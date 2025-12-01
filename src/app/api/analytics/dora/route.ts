/**
 * DORA Metrics API
 * Endpoints for DORA (DevOps Research and Assessment) metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDORAMetricsService } from '@/services/analytics/dora-metrics';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics/dora
 * Get organization-level DORA metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') as 'day' | 'week' | 'month' | 'quarter') || 'month';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeTrends = searchParams.get('includeTrends') !== 'false';
    const includeBreakdown = searchParams.get('includeBreakdown') !== 'false';
    const teamId = searchParams.get('teamId');
    const serviceId = searchParams.get('serviceId');

    const service = getDORAMetricsService();

    const query = {
      period,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeTrends,
      includeBreakdown,
    };

    let metrics;
    if (serviceId) {
      metrics = await service.getServiceMetrics(serviceId, query);
    } else if (teamId) {
      metrics = await service.getTeamMetrics(teamId, query);
    } else {
      metrics = await service.getOrgMetrics(query);
    }

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Failed to get DORA metrics:', error);
    return NextResponse.json(
      { error: 'Failed to get DORA metrics' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/dora
 * Get DORA metrics with complex query
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, query, teamIds, serviceIds } = body;

    const service = getDORAMetricsService();

    switch (type) {
      case 'org':
        const orgMetrics = await service.getOrgMetrics(query);
        return NextResponse.json(orgMetrics);

      case 'teams':
        const teamMetrics = await Promise.all(
          (teamIds || []).map((teamId: string) =>
            service.getTeamMetrics(teamId, query)
          )
        );
        return NextResponse.json({ teams: teamMetrics });

      case 'services':
        const serviceMetrics = await Promise.all(
          (serviceIds || []).map((serviceId: string) =>
            service.getServiceMetrics(serviceId, query)
          )
        );
        return NextResponse.json({ services: serviceMetrics });

      case 'comparison':
        const comparison = await compareMetrics(service, body);
        return NextResponse.json(comparison);

      default:
        return NextResponse.json(
          { error: `Unknown type: ${type}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Failed to get DORA metrics:', error);
    return NextResponse.json(
      { error: 'Failed to get DORA metrics' },
      { status: 500 }
    );
  }
}

/**
 * Compare metrics between entities
 */
async function compareMetrics(service: ReturnType<typeof getDORAMetricsService>, body: any) {
  const { entities, query } = body;

  const results = await Promise.all(
    entities.map(async (entity: { type: string; id: string }) => {
      let metrics;
      if (entity.type === 'team') {
        metrics = await service.getTeamMetrics(entity.id, query);
      } else if (entity.type === 'service') {
        metrics = await service.getServiceMetrics(entity.id, query);
      }
      return { entity, metrics };
    })
  );

  // Calculate comparison summary
  const comparison = {
    entities: results,
    summary: {
      bestDeploymentFrequency: findBest(results, 'deploymentFrequency', 'deploymentsPerDay', true),
      bestLeadTime: findBest(results, 'leadTimeForChanges', 'hoursP50', false),
      bestMTTR: findBest(results, 'meanTimeToRecovery', 'hoursP50', false),
      bestChangeFailureRate: findBest(results, 'changeFailureRate', 'percentage', false),
    },
  };

  return comparison;
}

/**
 * Find best entity for a given metric
 */
function findBest(
  results: any[],
  metricKey: string,
  valueKey: string,
  higherIsBetter: boolean
): { entityId: string; value: number } | null {
  if (results.length === 0) return null;

  let best = results[0];
  for (const result of results) {
    const currentValue = result.metrics?.metrics?.[metricKey]?.[valueKey];
    const bestValue = best.metrics?.metrics?.[metricKey]?.[valueKey];

    if (currentValue === undefined) continue;
    if (bestValue === undefined ||
        (higherIsBetter ? currentValue > bestValue : currentValue < bestValue)) {
      best = result;
    }
  }

  return {
    entityId: best.entity.id,
    value: best.metrics?.metrics?.[metricKey]?.[valueKey] ?? 0,
  };
}
