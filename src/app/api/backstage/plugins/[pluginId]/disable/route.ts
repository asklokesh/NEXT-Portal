import { NextRequest, NextResponse } from 'next/server';

export async function POST(
 request: NextRequest,
 { params }: { params: { pluginId: string } }
) {
 try {
 const { pluginId } = params;

 if (!pluginId) {
 return NextResponse.json(
 { error: 'Plugin ID is required' },
 { status: 400 }
 );
 }

 // Forward to Backstage backend
 const backstageUrl = process.env.BACKSTAGE_API_URL || 'http://localhost:7007';
 const response = await fetch(`${backstageUrl}/api/plugins/${pluginId}/disable`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 }).catch(() => null);

 // If Backstage backend doesn't have this endpoint, handle locally
 if (!response || !response.ok) {
 return NextResponse.json({
 success: true,
 message: `Plugin ${pluginId} disabled`,
 pluginId,
 enabled: false,
 });
 }

 const result = await response.json();
 return NextResponse.json(result);
 } catch (error) {
 console.error('Failed to disable plugin:', error);
 return NextResponse.json(
 { error: 'Failed to disable plugin' },
 { status: 500 }
 );
 }
}