import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
 try {
 const { url, token } = await request.json();

 if (!url) {
 return NextResponse.json(
 { success: false, error: 'Backstage URL is required' },
 { status: 400 }
 );
 }

 // Test connection to Backstage
 const headers: HeadersInit = {
 'Content-Type': 'application/json',
 };

 if (token) {
 headers['Authorization'] = `Bearer ${token}`;
 }

 // Try to fetch catalog entities to test connection
 const testUrl = new URL('/api/catalog/entities', url).toString();
 const response = await fetch(testUrl, {
 method: 'GET',
 headers,
 signal: AbortSignal.timeout(10000), // 10 second timeout
 });

 if (!response.ok) {
 return NextResponse.json(
 { 
 success: false, 
 error: `Backstage returned status ${response.status}. Please check your URL and authentication.` 
 },
 { status: 400 }
 );
 }

 const data = await response.json();

 // Try to get version info
 let version = 'Unknown';
 try {
 const versionResponse = await fetch(new URL('/api/version', url).toString(), {
 headers,
 signal: AbortSignal.timeout(5000),
 });
 if (versionResponse.ok) {
 const versionData = await versionResponse.json();
 version = versionData.version || 'Unknown';
 }
 } catch (error) {
 // Version endpoint might not exist
 }

 // Count entities
 const entityCount = Array.isArray(data.items) ? data.items.length : 0;

 // Detect plugins (simplified - in real implementation, check actual plugins)
 const plugins = ['catalog', 'scaffolder', 'techdocs']; // Default plugins

 return NextResponse.json({
 success: true,
 details: {
 version,
 entities: entityCount,
 plugins,
 },
 });
 } catch (error) {
 console.error('Backstage connection test error:', error);
 
 if (error instanceof Error) {
 if (error.name === 'AbortError') {
 return NextResponse.json(
 { success: false, error: 'Connection timeout. Please check if Backstage is accessible.' },
 { status: 400 }
 );
 }
 
 return NextResponse.json(
 { success: false, error: error.message },
 { status: 400 }
 );
 }

 return NextResponse.json(
 { success: false, error: 'Failed to connect to Backstage' },
 { status: 500 }
 );
 }
}