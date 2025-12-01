/**
 * Individual Scorecard API
 * Get, update, delete individual scorecards
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScorecardService } from '@/services/scorecards';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ scorecardId: string }>;
}

/**
 * GET /api/scorecards/[scorecardId]
 * Get a specific scorecard
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { scorecardId } = await params;
    const service = getScorecardService();

    const scorecard = await service.getScorecard(scorecardId);
    if (!scorecard) {
      return NextResponse.json(
        { error: 'Scorecard not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(scorecard);
  } catch (error) {
    console.error('Failed to get scorecard:', error);
    return NextResponse.json(
      { error: 'Failed to get scorecard' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/scorecards/[scorecardId]
 * Update a scorecard
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { scorecardId } = await params;
    const body = await request.json();
    const service = getScorecardService();

    const updated = await service.updateScorecard(scorecardId, body);
    if (!updated) {
      return NextResponse.json(
        { error: 'Scorecard not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update scorecard:', error);
    return NextResponse.json(
      { error: 'Failed to update scorecard' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scorecards/[scorecardId]
 * Delete a scorecard
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { scorecardId } = await params;
    const service = getScorecardService();

    const deleted = await service.deleteScorecard(scorecardId);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Scorecard not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete scorecard:', error);
    return NextResponse.json(
      { error: 'Failed to delete scorecard' },
      { status: 500 }
    );
  }
}
