/**
 * Action Approvals API
 * List and manage pending approvals
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActionService } from '@/services/actions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/actions/approvals
 * List pending approvals
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const approverId = searchParams.get('approverId') as string | undefined;

    const service = getActionService();
    const approvals = await service.getPendingApprovals(approverId);

    return NextResponse.json({
      approvals,
      total: approvals.length,
    });
  } catch (error) {
    console.error('Failed to list approvals:', error);
    return NextResponse.json(
      { error: 'Failed to list approvals' },
      { status: 500 }
    );
  }
}
