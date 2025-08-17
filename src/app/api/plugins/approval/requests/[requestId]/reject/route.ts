import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const RejectRequestSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required')
});

// POST /api/plugins/approval/requests/[requestId]/reject
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const user = await getServerSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has approval permissions
    if (!user.roles.includes('admin') && !user.roles.includes('platform_engineer')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { requestId } = params;
    const body = await request.json();
    const { reason } = RejectRequestSchema.parse(body);

    // Fetch the approval request
    const approvalRequest = await prisma.pluginApproval.findUnique({
      where: { id: requestId },
      include: {
        governance: true,
        plugin: true,
        pluginVersion: true
      }
    });

    if (!approvalRequest) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
    }

    if (approvalRequest.status !== 'PENDING' && approvalRequest.status !== 'IN_REVIEW') {
      return NextResponse.json(
        { error: 'Request has already been processed' },
        { status: 400 }
      );
    }

    // Update approval request
    const updatedRequest = await prisma.pluginApproval.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        approvedBy: user.id,
        rejectedAt: new Date(),
        reason,
        comments: {
          push: {
            id: `comment-${Date.now()}`,
            author: user.name,
            role: user.roles[0],
            message: reason,
            timestamp: new Date().toISOString(),
            type: 'REJECTION'
          }
        }
      }
    });

    // Record the rejection in operations history
    await prisma.pluginOperation.create({
      data: {
        pluginId: approvalRequest.pluginId!,
        operationType: 'REJECTED' as any,
        status: 'COMPLETED',
        version: approvalRequest.pluginVersion?.version,
        performedBy: user.id,
        parameters: {
          requestId,
          reason
        } as any,
        result: {
          message: `Approval request ${requestId} rejected by ${user.name}: ${reason}`
        } as any
      }
    });

    // Update plugin version status if needed
    if (approvalRequest.pluginVersion) {
      await prisma.pluginVersion.update({
        where: { id: approvalRequest.pluginVersion.id },
        data: {
          status: 'REJECTED'
        }
      });
    }

    // Send notifications (implement notification service)
    // await notificationService.notifyRequestRejected(updatedRequest);

    return NextResponse.json({
      id: updatedRequest.id,
      status: 'REJECTED',
      message: 'Request rejected',
      rejectedBy: user.name,
      rejectedAt: updatedRequest.rejectedAt,
      reason
    });
  } catch (error) {
    console.error('Failed to reject request:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to reject request' },
      { status: 500 }
    );
  }
}