/**
 * Scorecard Evaluation API
 * Evaluate entities against a scorecard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScorecardService } from '@/services/scorecards';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ scorecardId: string }>;
}

/**
 * POST /api/scorecards/[scorecardId]/evaluate
 * Evaluate an entity against a scorecard
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { scorecardId } = await params;
    const body = await request.json();
    const service = getScorecardService();

    const { entityRef, entity, force = false } = body;

    if (!entityRef || !entity) {
      return NextResponse.json(
        { error: 'entityRef and entity are required' },
        { status: 400 }
      );
    }

    const result = await service.evaluateEntity(scorecardId, entityRef, entity, force);

    return NextResponse.json({
      result,
      cached: !force,
    });
  } catch (error) {
    console.error('Failed to evaluate scorecard:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate scorecard' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/scorecards/[scorecardId]/evaluate
 * Get cached evaluation result for an entity
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { scorecardId } = await params;
    const { searchParams } = new URL(request.url);
    const entityRef = searchParams.get('entityRef');
    const service = getScorecardService();

    if (!entityRef) {
      return NextResponse.json(
        { error: 'entityRef query parameter is required' },
        { status: 400 }
      );
    }

    const result = await service.getResult(scorecardId, entityRef);

    if (!result) {
      return NextResponse.json(
        { error: 'No evaluation result found. Run evaluation first.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Failed to get evaluation result:', error);
    return NextResponse.json(
      { error: 'Failed to get evaluation result' },
      { status: 500 }
    );
  }
}
