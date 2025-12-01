/**
 * Action Execution API
 * Execute an action and get execution status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActionService } from '@/services/actions';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ actionId: string }>;
}

/**
 * POST /api/actions/[actionId]/execute
 * Execute an action
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { actionId } = await params;
    const body = await request.json();
    const service = getActionService();

    const {
      parameters = {},
      entityRef,
      environment,
      userId = 'anonymous',
    } = body;

    const execution = await service.executeAction(
      actionId,
      parameters,
      userId,
      { entityRef, environment }
    );

    return NextResponse.json({
      execution,
      message: execution.approvalStatus === 'pending'
        ? 'Action requires approval'
        : 'Action execution started',
    });
  } catch (error) {
    console.error('Failed to execute action:', error);
    const message = error instanceof Error ? error.message : 'Failed to execute action';
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}

/**
 * GET /api/actions/[actionId]/execute
 * Get executions for an action
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { actionId } = await params;
    const { searchParams } = new URL(request.url);
    const entityRef = searchParams.get('entityRef') as string | undefined;
    const status = searchParams.get('status') as string | undefined;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const service = getActionService();

    const executions = await service.getExecutions({
      actionId,
      entityRef,
      status: status as any,
      limit,
    });

    return NextResponse.json({
      executions,
      total: executions.length,
    });
  } catch (error) {
    console.error('Failed to get executions:', error);
    return NextResponse.json(
      { error: 'Failed to get executions' },
      { status: 500 }
    );
  }
}
