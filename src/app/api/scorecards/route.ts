/**
 * Scorecards API
 * CRUD operations for scorecards
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScorecardService } from '@/services/scorecards';

export const dynamic = 'force-dynamic';

/**
 * GET /api/scorecards
 * List all scorecards
 */
export async function GET(request: NextRequest) {
  try {
    const service = getScorecardService();
    const scorecards = await service.listScorecards();

    return NextResponse.json({
      scorecards,
      total: scorecards.length,
    });
  } catch (error) {
    console.error('Failed to list scorecards:', error);
    return NextResponse.json(
      { error: 'Failed to list scorecards' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scorecards
 * Create a new scorecard
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const service = getScorecardService();

    // Validate required fields
    if (!body.name || !body.entityTypes || !body.checks) {
      return NextResponse.json(
        { error: 'Name, entityTypes, and checks are required' },
        { status: 400 }
      );
    }

    const scorecard = await service.createScorecard(body);

    return NextResponse.json(scorecard, { status: 201 });
  } catch (error) {
    console.error('Failed to create scorecard:', error);
    return NextResponse.json(
      { error: 'Failed to create scorecard' },
      { status: 500 }
    );
  }
}
