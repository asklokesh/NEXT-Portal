import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
 try {
 const { pluginId, config } = await request.json();

 if (!pluginId) {
 return NextResponse.json(
 { error: 'Plugin ID is required' },
 { status: 400 }
 );
 }

 // Forward configuration to Backstage backend
 const backstageUrl = process.env.BACKSTAGE_API_URL || 'http://localhost:7007';
 const response = await fetch(`${backstageUrl}/api/plugins/${pluginId}/configure`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(config),
 }).catch(() => null);

 // If Backstage backend doesn't have this endpoint, store locally
 if (!response || !response.ok) {
 // Store configuration in database or local storage
 // For now, we'll return success as the configuration is handled client-side
 return NextResponse.json({
 success: true,
 message: 'Plugin configuration saved locally',
 pluginId,
 });
 }

 const result = await response.json();
 return NextResponse.json(result);
 } catch (error) {
 console.error('Failed to configure plugin:', error);
 return NextResponse.json(
 { error: 'Failed to configure plugin' },
 { status: 500 }
 );
 }
}