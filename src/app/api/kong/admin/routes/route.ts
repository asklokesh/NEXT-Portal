import { NextRequest, NextResponse } from 'next/server';
import { KongAdminClient } from '@/lib/api-gateway/kong-admin';

const KONG_ADMIN_URL = process.env.KONG_ADMIN_URL || 'http://localhost:8001';
const KONG_ADMIN_TOKEN = process.env.KONG_ADMIN_TOKEN;

export async function GET() {
  try {
    const kongAdmin = new KongAdminClient(KONG_ADMIN_URL, KONG_ADMIN_TOKEN);
    const routes = await kongAdmin.getRoutes({ size: 1000 });
    
    return NextResponse.json(routes);
  } catch (error) {
    console.error('Kong Admin API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Kong routes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const routeData = await request.json();
    const kongAdmin = new KongAdminClient(KONG_ADMIN_URL, KONG_ADMIN_TOKEN);
    const route = await kongAdmin.createRoute(routeData);
    
    return NextResponse.json(route, { status: 201 });
  } catch (error) {
    console.error('Kong Admin API error:', error);
    return NextResponse.json(
      { error: 'Failed to create Kong route' },
      { status: 500 }
    );
  }
}