import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector } from '@/lib/monitoring/MetricsCollector';
import { realMetricsCollector } from '@/lib/monitoring/RealMetricsCollector';

export async function GET(request: NextRequest) {
 try {
 const { searchParams } = new URL(request.url);
 const name = searchParams.get('name') || undefined;
 const since = searchParams.get('since') ? parseInt(searchParams.get('since')!) : undefined;
 
 // Parse labels from query string
 const labels: Record<string, string> = {};
 searchParams.forEach((value, key) => {
 if (key.startsWith('label_')) {
 const labelName = key.replace('label_', '');
 labels[labelName] = value;
 }
 });

 const metrics = metricsCollector.getMetrics(name, Object.keys(labels).length > 0 ? labels : undefined, since);
 const stats = name ? metricsCollector.getMetricStats(name, Object.keys(labels).length > 0 ? labels : undefined, since) : null;
 const collectorStatus = realMetricsCollector.getStatus();

 return NextResponse.json({
 metrics,
 stats,
 count: metrics.length,
 collector: {
 realMetrics: collectorStatus,
 systemHealth: metricsCollector.getSystemHealth()
 }
 });
 } catch (error) {
 console.error('Error fetching metrics:', error);
 return NextResponse.json(
 { error: 'Failed to fetch metrics' },
 { status: 500 }
 );
 }
}

export async function POST(request: NextRequest) {
 try {
 const body = await request.json();
 const { name, value, labels = {}, type = 'counter' } = body;

 if (!name || value === undefined) {
 return NextResponse.json(
 { error: 'Name and value are required' },
 { status: 400 }
 );
 }

 switch (type) {
 case 'counter':
 metricsCollector.incrementCounter(name, labels, value);
 break;
 case 'gauge':
 metricsCollector.setGauge(name, value, labels);
 break;
 case 'histogram':
 metricsCollector.recordHistogram(name, value, labels);
 break;
 default:
 return NextResponse.json(
 { error: 'Invalid metric type' },
 { status: 400 }
 );
 }

 return NextResponse.json({ success: true });
 } catch (error) {
 console.error('Error recording metric:', error);
 return NextResponse.json(
 { error: 'Failed to record metric' },
 { status: 500 }
 );
 }
}