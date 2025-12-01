/**
 * Single Approval API
 * Review and respond to approval requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { getActionService } from '@/services/actions';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ approvalId: string }>;
}

/**
 * POST /api/actions/approvals/[approvalId]
 * Approve or reject an action
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { approvalId } = await params;
    const body = await request.json();
    const service = getActionService();

    const {
      approved,
      reviewerId = 'anonymous',
      comment,
    } = body;

    if (typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'approved field is required and must be a boolean' },
        { status: 400 }
      );
    }

    const approval = await service.approveAction(
      approvalId,
      reviewerId,
      approved,
      comment
    );

    if (!approval) {
      return NextResponse.json(
        { error: 'Approval request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      approval,
      message: approved
        ? 'Action approved and execution started'
        : 'Action rejected',
    });
  } catch (error) {
    console.error('Failed to process approval:', error);
    return NextResponse.json(
      { error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}
