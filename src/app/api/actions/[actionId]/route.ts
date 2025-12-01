/**
 * Single Action API
 * Get, update, delete individual actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActionService } from '@/services/actions';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ actionId: string }>;
}

/**
 * GET /api/actions/[actionId]
 * Get a single action
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { actionId } = await params;
    const service = getActionService();

    const action = await service.getAction(actionId);

    if (!action) {
      return NextResponse.json(
        { error: 'Action not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ action });
  } catch (error) {
    console.error('Failed to get action:', error);
    return NextResponse.json(
      { error: 'Failed to get action' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/actions/[actionId]
 * Update an action
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { actionId } = await params;
    const body = await request.json();
    const service = getActionService();

    const action = await service.updateAction(actionId, body);

    if (!action) {
      return NextResponse.json(
        { error: 'Action not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ action });
  } catch (error) {
    console.error('Failed to update action:', error);
    return NextResponse.json(
      { error: 'Failed to update action' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/actions/[actionId]
 * Delete an action
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { actionId } = await params;
    const service = getActionService();

    const deleted = await service.deleteAction(actionId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Action not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete action:', error);
    return NextResponse.json(
      { error: 'Failed to delete action' },
      { status: 500 }
    );
  }
}
