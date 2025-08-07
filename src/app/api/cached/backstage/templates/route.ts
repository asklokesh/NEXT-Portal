import { NextRequest, NextResponse } from 'next/server';
import { withCache } from '@/lib/cache/middleware';
import { cache, cacheKeys } from '@/lib/cache/redis';

/**
 * Cached endpoint for scaffolder templates
 * GET /api/cached/backstage/templates
 */
export const GET = withCache(
 async (req: NextRequest) => {
 // Check cache first
 const cacheKey = cacheKeys.templateList();
 const cached = await cache.get(cacheKey);
 
 if (cached) {
 return NextResponse.json(cached);
 }
 
 // Fetch from Backstage
 const backstageUrl = process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:4402';
 const response = await fetch(
 `${backstageUrl}/api/scaffolder/templates`,
 {
 headers: {
 'Accept': 'application/json',
 'Authorization': req.headers.get('authorization') || '',
 },
 }
 );
 
 if (!response.ok) {
 return NextResponse.json(
 { error: 'Failed to fetch templates' },
 { status: response.status }
 );
 }
 
 const data = await response.json();
 
 // Cache the response
 await cache.set(cacheKey, data, 600); // 10 minutes
 
 return NextResponse.json(data);
 },
 {
 ttl: 600, // 10 minutes
 key: () => cacheKeys.templateList(),
 tags: ['templates'],
 }
);

/**
 * Get specific template with caching
 * GET /api/cached/backstage/templates/[namespace]/[name]
 */
export async function getTemplate(namespace: string, name: string) {
 const cacheKey = cacheKeys.template(`${namespace}/${name}`);
 
 // Check cache
 const cached = await cache.get(cacheKey);
 if (cached) {
 return cached;
 }
 
 // Fetch from Backstage
 const backstageUrl = process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:4402';
 const response = await fetch(
 `${backstageUrl}/api/scaffolder/templates/${namespace}/${name}`
 );
 
 if (!response.ok) {
 throw new Error('Failed to fetch template');
 }
 
 const data = await response.json();
 
 // Cache for 30 minutes
 await cache.set(cacheKey, data, 1800);
 
 return data;
}