import { NextRequest, NextResponse } from 'next/server';
import { backstageClient } from '@/lib/backstage/real-client';
import { prisma } from '@/lib/db/client';
import { cache } from '@/lib/cache/redis';

const startTime = Date.now();

interface ServiceHealth {
 status: 'ok' | 'degraded' | 'error';
 message: string;
 responseTime?: number;
 details?: any;
}

interface HealthCheck {
 status: 'ok' | 'degraded' | 'error';
 timestamp: string;
 version: string;
 uptime: number;
 services: {
 database: ServiceHealth;
 backstage: ServiceHealth;
 cache: ServiceHealth;
 memory: ServiceHealth;
 };
 environment?: any;
}

export async function GET(request: NextRequest) {
 const verbose = request.nextUrl.searchParams.get('verbose') === 'true';
 
 try {
 const health: HealthCheck = {
 status: 'ok',
 timestamp: new Date().toISOString(),
 version: process.env.npm_package_version || '1.0.0',
 uptime: Math.floor((Date.now() - startTime) / 1000),
 services: {
 database: { status: 'ok', message: 'Unknown' },
 backstage: { status: 'ok', message: 'Unknown' },
 cache: { status: 'ok', message: 'Unknown' },
 memory: { status: 'ok', message: 'Unknown' },
 },
 };
 
 // Check database connection
 try {
 const dbStart = Date.now();
 await prisma.$queryRaw`SELECT 1`;
 health.services.database = { 
 status: 'ok', 
 message: 'PostgreSQL connection healthy',
 responseTime: Date.now() - dbStart
 };
 } catch (error: any) {
 health.services.database = { 
 status: 'error', 
 message: error.message || 'Database connection failed'
 };
 health.status = health.status === 'error' ? 'error' : 'degraded';
 }
 
 // Check Backstage connection
 try {
 const bsStart = Date.now();
 const controller = new AbortController();
 const timeout = setTimeout(() => controller.abort(), 5000);
 
 await backstageClient.getCatalogEntities({ limit: 1 });
 clearTimeout(timeout);
 
 health.services.backstage = { 
 status: 'ok', 
 message: 'Backstage API accessible',
 responseTime: Date.now() - bsStart,
 details: verbose ? {
 url: process.env.BACKSTAGE_API_URL || 'http://localhost:7007'
 } : undefined
 };
 } catch (error: any) {
 let message = 'Connection failed';
 if (error.message?.includes('ECONNREFUSED')) {
 message = 'Backstage API not running';
 } else if (error.name === 'AbortError') {
 message = 'Backstage API timeout';
 }
 
 health.services.backstage = { 
 status: 'error', 
 message
 };
 health.status = health.status === 'error' ? 'error' : 'degraded';
 }
 
 // Check cache (Redis with fallback)
 try {
 const cacheStart = Date.now();
 await cache.set('health-check', Date.now(), 10);
 const value = await cache.get('health-check');
 
 if (value) {
 health.services.cache = { 
 status: 'ok', 
 message: 'Cache operational',
 responseTime: Date.now() - cacheStart
 };
 } else {
 health.services.cache = { 
 status: 'degraded', 
 message: 'Cache degraded, using fallback' 
 };
 if (health.status === 'ok') {
 health.status = 'degraded';
 }
 }
 } catch (error: any) {
 health.services.cache = { 
 status: 'degraded', 
 message: 'Cache error, using memory fallback' 
 };
 if (health.status === 'ok') {
 health.status = 'degraded';
 }
 }
 
 // Check memory usage
 const memoryUsage = process.memoryUsage();
 const memoryLimit = parseInt(process.env.MEMORY_LIMIT || '1073741824'); // 1GB default
 const memoryUsagePercent = (memoryUsage.heapUsed / memoryLimit) * 100;
 
 health.services.memory = {
 status: memoryUsagePercent > 90 ? 'degraded' : 'ok',
 message: `Memory usage: ${Math.round(memoryUsagePercent)}%`,
 details: verbose ? {
 heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
 heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
 rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
 external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
 } : undefined
 };
 
 if (memoryUsagePercent > 90 && health.status === 'ok') {
 health.status = 'degraded';
 }
 
 // Add environment info if verbose
 if (verbose) {
 health.environment = {
 nodeVersion: process.version,
 env: process.env.NODE_ENV || 'development',
 platform: process.platform,
 arch: process.arch,
 pid: process.pid
 };
 }
 
 // Return appropriate status code
 const statusCode = health.status === 'ok' ? 200 : 
 health.status === 'degraded' ? 200 : 503;
 
 return NextResponse.json(health, { status: statusCode });
 } catch (error) {
 console.error('Health check failed:', error);
 return NextResponse.json(
 {
 status: 'error',
 message: 'Health check failed',
 error: error instanceof Error ? error.message : 'Unknown error',
 timestamp: new Date().toISOString(),
 },
 { status: 503 }
 );
 }
}

// Liveness probe - simple check if app is running
export async function HEAD() {
 return new NextResponse(null, { status: 200 });
}