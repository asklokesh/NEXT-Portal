/**
 * Single Execution API
 * Get execution details
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActionService } from '@/services/actions';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ executionId: string }>;
}

/**
 * GET /api/actions/executions/[executionId]
 * Get a single execution
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { executionId } = await params;
    const service = getActionService();

    const execution = await service.getExecution(executionId);

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ execution });
  } catch (error) {
    console.error('Failed to get execution:', error);
    return NextResponse.json(
      { error: 'Failed to get execution' },
      { status: 500 }
    );
  }
}
