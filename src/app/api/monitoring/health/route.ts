import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector } from '@/lib/monitoring/MetricsCollector';

export async function GET() {
 try {
 const health = metricsCollector.getSystemHealth();
 
 return NextResponse.json({
 ...health,
 timestamp: new Date().toISOString(),
 uptime: process.uptime ? process.uptime() : 0
 });
 } catch (error) {
 console.error('Error fetching system health:', error);
 return NextResponse.json(
 { 
 status: 'unhealthy',
 checks: [{
 name: 'health_check',
 status: 'fail',
 message: 'Failed to perform health check',
 timestamp: Date.now()
 }],
 error: 'Failed to fetch system health'
 },
 { status: 500 }
 );
 }
}