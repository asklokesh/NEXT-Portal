/**
 * Self-Service Actions API
 * List and create actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActionService } from '@/services/actions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/actions
 * List available actions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as string | undefined;
    const context = searchParams.get('context') as string | undefined;
    const entityType = searchParams.get('entityType') as string | undefined;
    const search = searchParams.get('search') as string | undefined;
    const quickActionsOnly = searchParams.get('quickActions') === 'true';

    const service = getActionService();

    let actions;
    if (quickActionsOnly && entityType) {
      actions = await service.getQuickActions(entityType);
    } else {
      actions = await service.getActions({
        category: category as any,
        context: context as any,
        entityType,
        searchQuery: search,
      });
    }

    return NextResponse.json({
      actions,
      total: actions.length,
    });
  } catch (error) {
    console.error('Failed to list actions:', error);
    return NextResponse.json(
      { error: 'Failed to list actions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/actions
 * Create a new action
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const service = getActionService();

    const action = await service.createAction(body);

    return NextResponse.json({ action }, { status: 201 });
  } catch (error) {
    console.error('Failed to create action:', error);
    return NextResponse.json(
      { error: 'Failed to create action' },
      { status: 500 }
    );
  }
}
