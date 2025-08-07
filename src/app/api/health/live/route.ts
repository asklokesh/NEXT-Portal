import { NextResponse } from 'next/server';

/**
 * Liveness probe - simple check if the app is running
 * Always returns 200 unless the app has crashed
 */
export async function GET() {
 return NextResponse.json({
 alive: true,
 timestamp: new Date().toISOString(),
 pid: process.pid,
 uptime: process.uptime(),
 });
}

export async function HEAD() {
 return new NextResponse(null, { status: 200 });
}