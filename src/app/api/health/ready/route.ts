import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { backstageClient } from '@/lib/backstage/real-client';

/**
 * Readiness probe - checks if the app is ready to serve traffic
 * Returns 200 if ready, 503 if not ready
 */
export async function GET() {
 const checks = {
 database: false,
 backstage: false,
 };
 
 // Check database is ready
 try {
 await prisma.$queryRaw`SELECT 1`;
 checks.database = true;
 } catch (error) {
 console.error('Database not ready:', error);
 }
 
 // Check Backstage API is accessible
 try {
 const controller = new AbortController();
 const timeout = setTimeout(() => controller.abort(), 3000);
 
 await backstageClient.getCatalogEntities({ limit: 1 });
 clearTimeout(timeout);
 
 checks.backstage = true;
 } catch (error) {
 console.error('Backstage API not ready:', error);
 }
 
 // App is ready if all critical services are available
 const isReady = checks.database && checks.backstage;
 
 return NextResponse.json(
 {
 ready: isReady,
 checks,
 timestamp: new Date().toISOString(),
 },
 { status: isReady ? 200 : 503 }
 );
}

export async function HEAD() {
 // Simplified HEAD endpoint for quick checks
 try {
 await prisma.$queryRaw`SELECT 1`;
 return new NextResponse(null, { status: 200 });
 } catch {
 return new NextResponse(null, { status: 503 });
 }
}