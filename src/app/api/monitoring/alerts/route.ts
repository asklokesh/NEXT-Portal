import { NextRequest, NextResponse } from 'next/server';
import { metricsCollector } from '@/lib/monitoring/MetricsCollector';

export async function GET(request: NextRequest) {
 try {
 const { searchParams } = new URL(request.url);
 const status = searchParams.get('status') as 'firing' | 'resolved' | undefined;
 const severity = searchParams.get('severity') as 'critical' | 'warning' | 'info' | undefined;
 const entityRef = searchParams.get('entityRef') || undefined;

 const alerts = metricsCollector.getAlerts(status, severity, entityRef);

 return NextResponse.json({
 alerts,
 count: alerts.length,
 summary: {
 total: metricsCollector.getAlerts().length,
 firing: metricsCollector.getAlerts('firing').length,
 critical: metricsCollector.getAlerts('firing', 'critical').length,
 warning: metricsCollector.getAlerts('firing', 'warning').length,
 info: metricsCollector.getAlerts('firing', 'info').length
 }
 });
 } catch (error) {
 console.error('Error fetching alerts:', error);
 return NextResponse.json(
 { error: 'Failed to fetch alerts' },
 { status: 500 }
 );
 }
}

export async function POST(request: NextRequest) {
 try {
 const body = await request.json();
 const { name, severity, message, entityRef, labels = {} } = body;

 if (!name || !severity || !message) {
 return NextResponse.json(
 { error: 'Name, severity, and message are required' },
 { status: 400 }
 );
 }

 const alertId = metricsCollector.fireAlert({
 name,
 severity,
 message,
 entityRef,
 labels
 });

 return NextResponse.json({ 
 success: true, 
 alertId 
 });
 } catch (error) {
 console.error('Error creating alert:', error);
 return NextResponse.json(
 { error: 'Failed to create alert' },
 { status: 500 }
 );
 }
}

export async function PATCH(request: NextRequest) {
 try {
 const body = await request.json();
 const { alertId, action } = body;

 if (!alertId || !action) {
 return NextResponse.json(
 { error: 'Alert ID and action are required' },
 { status: 400 }
 );
 }

 let success = false;
 switch (action) {
 case 'resolve':
 success = metricsCollector.resolveAlert(alertId);
 break;
 default:
 return NextResponse.json(
 { error: 'Invalid action' },
 { status: 400 }
 );
 }

 return NextResponse.json({ success });
 } catch (error) {
 console.error('Error updating alert:', error);
 return NextResponse.json(
 { error: 'Failed to update alert' },
 { status: 500 }
 );
 }
}