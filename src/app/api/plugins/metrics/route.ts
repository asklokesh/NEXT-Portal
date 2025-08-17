/**
 * Plugin Metrics API Route
 * Provides detailed metrics and performance data for plugins
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');
    const metricType = searchParams.get('metricType');
    const timeRange = searchParams.get('timeRange') || '24h';
    const aggregation = searchParams.get('aggregation') || 'avg';

    // Calculate time range
    const now = new Date();
    const startTime = new Date();
    switch (timeRange) {
      case '1h':
        startTime.setHours(now.getHours() - 1);
        break;
      case '6h':
        startTime.setHours(now.getHours() - 6);
        break;
      case '24h':
        startTime.setDate(now.getDate() - 1);
        break;
      case '7d':
        startTime.setDate(now.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(now.getDate() - 30);
        break;
    }

    const whereClause: any = {
      timestamp: { gte: startTime }
    };

    if (pluginId) {
      whereClause.pluginId = pluginId;
    }

    if (metricType) {
      whereClause.metricType = metricType;
    }

    // Fetch performance metrics
    const metrics = await prisma.pluginPerformance.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: 1000
    });

    // Group metrics by type and calculate aggregations
    const groupedMetrics = metrics.reduce((acc: any, metric) => {
      if (!acc[metric.metricType]) {
        acc[metric.metricType] = [];
      }
      acc[metric.metricType].push({
        value: metric.value,
        timestamp: metric.timestamp,
        percentile: metric.percentile,
        isAlert: metric.isAlert
      });
      return acc;
    }, {});

    // Calculate aggregated values
    const aggregatedMetrics: any = {};
    Object.keys(groupedMetrics).forEach(type => {
      const values = groupedMetrics[type].map((m: any) => m.value);
      aggregatedMetrics[type] = {
        current: values[0] || 0,
        [aggregation]: calculateAggregation(values, aggregation),
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
        alerts: groupedMetrics[type].filter((m: any) => m.isAlert).length,
        data: groupedMetrics[type]
      };
    });

    // If specific plugin, include additional data
    if (pluginId) {
      const plugin = await prisma.plugin.findUnique({
        where: { id: pluginId },
        include: {
          _count: {
            select: {
              analytics: true,
              alerts: true,
              incidents: true
            }
          }
        }
      });

      return NextResponse.json({
        pluginId,
        pluginName: plugin?.displayName,
        timeRange,
        metrics: aggregatedMetrics,
        summary: {
          totalEvents: plugin?._count.analytics || 0,
          activeAlerts: plugin?._count.alerts || 0,
          incidents: plugin?._count.incidents || 0
        },
        recommendations: generateRecommendations(aggregatedMetrics)
      });
    }

    return NextResponse.json({
      timeRange,
      metrics: aggregatedMetrics,
      pluginCount: await prisma.plugin.count({ where: { isInstalled: true } })
    });

  } catch (error) {
    console.error('Metrics fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

// POST endpoint to record new metrics
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pluginId, metrics } = body;

    if (!pluginId || !metrics) {
      return NextResponse.json(
        { error: 'Plugin ID and metrics are required' },
        { status: 400 }
      );
    }

    // Record multiple metrics
    const metricRecords = metrics.map((metric: any) => ({
      pluginId,
      metricType: metric.type,
      value: metric.value,
      unit: metric.unit,
      environment: metric.environment || 'production',
      percentile: metric.percentile,
      threshold: metric.threshold,
      isAlert: metric.value > (metric.threshold || Infinity),
      tags: metric.tags || {}
    }));

    await prisma.pluginPerformance.createMany({
      data: metricRecords
    });

    // Check for threshold violations and create alerts
    const alerts = metricRecords
      .filter(m => m.isAlert)
      .map(m => ({
        pluginId,
        alertType: 'PERFORMANCE_THRESHOLD',
        severity: getAlertSeverity(m.metricType, m.value, m.threshold),
        title: `${m.metricType} threshold exceeded`,
        message: `${m.metricType} is ${m.value}${m.unit}, exceeding threshold of ${m.threshold}${m.unit}`,
        threshold: m.threshold,
        currentValue: m.value,
        environment: m.environment,
        isActive: true
      }));

    if (alerts.length > 0) {
      await prisma.pluginAlert.createMany({
        data: alerts
      });
    }

    return NextResponse.json({
      success: true,
      metricsRecorded: metricRecords.length,
      alertsCreated: alerts.length
    });

  } catch (error) {
    console.error('Metrics recording error:', error);
    return NextResponse.json(
      { error: 'Failed to record metrics' },
      { status: 500 }
    );
  }
}

function calculateAggregation(values: number[], type: string): number {
  if (values.length === 0) return 0;
  
  switch (type) {
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'median':
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    case 'p95':
      const p95Index = Math.floor(values.length * 0.95);
      return [...values].sort((a, b) => a - b)[p95Index];
    case 'p99':
      const p99Index = Math.floor(values.length * 0.99);
      return [...values].sort((a, b) => a - b)[p99Index];
    default:
      return values[0];
  }
}

function getAlertSeverity(metricType: string, value: number, threshold: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  const ratio = value / threshold;
  
  if (metricType === 'ERROR_RATE' || metricType === 'MEMORY_USAGE') {
    if (ratio > 2) return 'CRITICAL';
    if (ratio > 1.5) return 'HIGH';
    if (ratio > 1.2) return 'MEDIUM';
    return 'LOW';
  }
  
  if (metricType === 'CPU_USAGE') {
    if (value > 90) return 'CRITICAL';
    if (value > 80) return 'HIGH';
    if (value > 70) return 'MEDIUM';
    return 'LOW';
  }
  
  if (metricType === 'RESPONSE_TIME') {
    if (value > 5000) return 'CRITICAL';
    if (value > 2000) return 'HIGH';
    if (value > 1000) return 'MEDIUM';
    return 'LOW';
  }
  
  return ratio > 1.5 ? 'HIGH' : 'MEDIUM';
}

function generateRecommendations(metrics: any): string[] {
  const recommendations: string[] = [];
  
  if (metrics.CPU_USAGE?.max > 80) {
    recommendations.push('Consider scaling up CPU resources or optimizing plugin code');
  }
  
  if (metrics.MEMORY_USAGE?.max > 800) {
    recommendations.push('Memory usage is high. Check for memory leaks or increase memory allocation');
  }
  
  if (metrics.ERROR_RATE?.avg > 5) {
    recommendations.push('Error rate is elevated. Review error logs and implement fixes');
  }
  
  if (metrics.RESPONSE_TIME?.p95 > 1000) {
    recommendations.push('Response times are slow. Consider caching or query optimization');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('All metrics are within normal ranges');
  }
  
  return recommendations;
}