import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { techRadarClient } from '@/lib/techradar/client';

interface RouteParams {
  id: string;
}

async function deleteEntryHandler(
  req: NextRequest,
  { params }: { params: RouteParams }
): Promise<NextResponse> {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Entry ID is required' },
        { status: 400 }
      );
    }

    await techRadarClient.deleteEntry(id);

    return NextResponse.json({
      success: true,
      message: 'Entry deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error deleting tech radar entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete tech radar entry' },
      { status: 500 }
    );
  }
}

// Apply authentication middleware
export const DELETE = withAuth(deleteEntryHandler);