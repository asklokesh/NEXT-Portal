import { NextRequest, NextResponse } from 'next/server';
import { KongAdminClient } from '@/lib/api-gateway/kong-admin';

const KONG_ADMIN_URL = process.env.KONG_ADMIN_URL || 'http://localhost:8001';
const KONG_ADMIN_TOKEN = process.env.KONG_ADMIN_TOKEN;

export async function GET() {
  try {
    const kongAdmin = new KongAdminClient(KONG_ADMIN_URL, KONG_ADMIN_TOKEN);
    const plugins = await kongAdmin.getPlugins();
    
    return NextResponse.json(plugins);
  } catch (error) {
    console.error('Kong Admin API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Kong plugins' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const pluginData = await request.json();
    const kongAdmin = new KongAdminClient(KONG_ADMIN_URL, KONG_ADMIN_TOKEN);
    const plugin = await kongAdmin.createPlugin(pluginData);
    
    return NextResponse.json(plugin, { status: 201 });
  } catch (error) {
    console.error('Kong Admin API error:', error);
    return NextResponse.json(
      { error: 'Failed to create Kong plugin' },
      { status: 500 }
    );
  }
}