import { NextRequest, NextResponse } from 'next/server';
// Import Node.js-specific metrics for API routes
import { register } from '@/lib/monitoring/metrics-node';

/**
 * Prometheus metrics endpoint
 */
export async function GET(request: NextRequest) {
 // Optional authentication for metrics endpoint
 const authHeader = request.headers.get('authorization');
 const metricsToken = process.env.METRICS_AUTH_TOKEN;
 
 if (metricsToken && authHeader !== `Bearer ${metricsToken}`) {
 return new NextResponse('Unauthorized', { status: 401 });
 }
 
 try {
 // Get metrics in Prometheus format
 const metrics = await register.metrics();
 
 return new NextResponse(metrics, {
 headers: {
 'Content-Type': register.contentType,
 },
 });
 } catch (error) {
 console.error('Failed to generate metrics:', error);
 return new NextResponse('Internal Server Error', { status: 500 });
 }
}