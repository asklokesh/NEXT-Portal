import { NextRequest, NextResponse } from 'next/server';
import { withCache } from '@/lib/cache/middleware';
import { cache, cacheKeys } from '@/lib/cache/redis';

/**
 * Cached endpoint for catalog entities
 * GET /api/cached/backstage/catalog?kind=Component&lifecycle=production
 */
export const GET = withCache(
 async (req: NextRequest) => {
 const { searchParams } = new URL(req.url);
 const kind = searchParams.get('kind') || 'Component';
 const lifecycle = searchParams.get('lifecycle');
 const owner = searchParams.get('owner');
 
 // Build query params
 const queryParams = new URLSearchParams();
 queryParams.set('kind', kind);
 if (lifecycle) queryParams.set('lifecycle', lifecycle);
 if (owner) queryParams.set('owner', owner);
 
 // Check if we have cached data first
 const cacheKey = cacheKeys.serviceList(queryParams.toString());
 const cached = await cache.get(cacheKey);
 
 if (cached) {
 return NextResponse.json(cached);
 }
 
 // Fetch from Backstage
 const backstageUrl = process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:4402';
 const response = await fetch(
 `${backstageUrl}/api/catalog/entities?${queryParams}`,
 {
 headers: {
 'Accept': 'application/json',
 'Authorization': req.headers.get('authorization') || '',
 },
 }
 );
 
 if (!response.ok) {
 return NextResponse.json(
 { error: 'Failed to fetch catalog entities' },
 { status: response.status }
 );
 }
 
 const data = await response.json();
 
 // Cache the response
 await cache.set(cacheKey, data, 300); // 5 minutes
 
 return NextResponse.json(data);
 },
 {
 ttl: 300, // 5 minutes
 key: (req) => {
 const { searchParams } = new URL(req.url);
 return cacheKeys.serviceList(searchParams.toString());
 },
 tags: ['catalog', 'entities'],
 }
);

/**
 * Invalidate catalog cache
 * POST /api/cached/backstage/catalog/invalidate
 */
export async function POST(req: NextRequest) {
 try {
 const body = await req.json();
 const { tags = ['catalog'], pattern } = body;
 
 if (pattern) {
 await cache.delPattern(pattern);
 } else {
 // Invalidate by tags
 for (const tag of tags) {
 await cache.delPattern(`*:${tag}:*`);
 }
 }
 
 return NextResponse.json({ success: true });
 } catch (error) {
 return NextResponse.json(
 { error: 'Failed to invalidate cache' },
 { status: 500 }
 );
 }
}