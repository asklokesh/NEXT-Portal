import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { techRadarClient } from '@/lib/techradar/client';

async function getConfigHandler(req: NextRequest): Promise<NextResponse> {
  try {
    const config = await techRadarClient.getRadarConfig();

    return NextResponse.json({
      config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching tech radar config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tech radar configuration' },
      { status: 500 }
    );
  }
}

// Apply authentication middleware
export const GET = withAuth(getConfigHandler);