/**
 * Action Executions API
 * List all executions across actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActionService } from '@/services/actions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/actions/executions
 * List all executions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const actionId = searchParams.get('actionId') as string | undefined;
    const entityRef = searchParams.get('entityRef') as string | undefined;
    const status = searchParams.get('status') as string | undefined;
    const triggeredBy = searchParams.get('triggeredBy') as string | undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const service = getActionService();

    const executions = await service.getExecutions({
      actionId,
      entityRef,
      status: status as any,
      triggeredBy,
      limit,
    });

    return NextResponse.json({
      executions,
      total: executions.length,
    });
  } catch (error) {
    console.error('Failed to list executions:', error);
    return NextResponse.json(
      { error: 'Failed to list executions' },
      { status: 500 }
    );
  }
}
