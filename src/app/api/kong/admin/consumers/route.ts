import { NextRequest, NextResponse } from 'next/server';
import { KongAdminClient } from '@/lib/api-gateway/kong-admin';

const KONG_ADMIN_URL = process.env.KONG_ADMIN_URL || 'http://localhost:8001';
const KONG_ADMIN_TOKEN = process.env.KONG_ADMIN_TOKEN;

export async function GET() {
  try {
    const kongAdmin = new KongAdminClient(KONG_ADMIN_URL, KONG_ADMIN_TOKEN);
    const consumers = await kongAdmin.getConsumers();
    
    return NextResponse.json(consumers);
  } catch (error) {
    console.error('Kong Admin API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Kong consumers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const consumerData = await request.json();
    const kongAdmin = new KongAdminClient(KONG_ADMIN_URL, KONG_ADMIN_TOKEN);
    const consumer = await kongAdmin.createConsumer(consumerData);
    
    return NextResponse.json(consumer, { status: 201 });
  } catch (error) {
    console.error('Kong Admin API error:', error);
    return NextResponse.json(
      { error: 'Failed to create Kong consumer' },
      { status: 500 }
    );
  }
}