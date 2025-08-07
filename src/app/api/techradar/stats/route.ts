import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { techRadarClient } from '@/lib/techradar/client';

async function getStatsHandler(req: NextRequest): Promise<NextResponse> {
  try {
    const stats = await techRadarClient.getStats();

    return NextResponse.json({
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching tech radar stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tech radar statistics' },
      { status: 500 }
    );
  }
}

// Apply authentication middleware
export const GET = withAuth(getStatsHandler);