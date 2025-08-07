import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector } from '@/lib/monitoring/MetricsCollector';

export async function GET(request: NextRequest) {
 try {
 const { searchParams } = new URL(request.url);
 const name = searchParams.get('name') || undefined;
 const since = searchParams.get('since') ? parseInt(searchParams.get('since')!) : undefined;
 const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;

 const allMetrics = metricsCollector.getPerformanceMetrics(name, since);
 const metrics = allMetrics.slice(0, limit);
 const stats = name ? metricsCollector.getPerformanceStats(name, since) : null;

 return NextResponse.json({
 metrics,
 stats,
 count: metrics.length,
 total: allMetrics.length
 });
 } catch (error) {
 console.error('Error fetching performance metrics:', error);
 return NextResponse.json(
 { error: 'Failed to fetch performance metrics' },
 { status: 500 }
 );
 }
}