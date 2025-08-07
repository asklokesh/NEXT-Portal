import { NextRequest, NextResponse } from 'next/server';
import { GatewayLogger } from '@/lib/api-gateway/logger';
import { Redis } from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') as '1h' | '24h' | '7d' | '30d' || '1h';
    
    const logger = new GatewayLogger(redis, 'kong-gateway');
    const metrics = await logger.getMetrics(timeframe);
    
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}