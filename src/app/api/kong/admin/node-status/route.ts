import { NextRequest, NextResponse } from 'next/server';
import { KongAdminClient } from '@/lib/api-gateway/kong-admin';

const KONG_ADMIN_URL = process.env.KONG_ADMIN_URL || 'http://localhost:8001';
const KONG_ADMIN_TOKEN = process.env.KONG_ADMIN_TOKEN;

export async function GET() {
  try {
    const kongAdmin = new KongAdminClient(KONG_ADMIN_URL, KONG_ADMIN_TOKEN);
    const nodeStatus = await kongAdmin.getNodeStatus();
    
    return NextResponse.json(nodeStatus);
  } catch (error) {
    console.error('Kong Admin API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Kong node status' },
      { status: 500 }
    );
  }
}