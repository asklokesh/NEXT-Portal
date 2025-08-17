import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const ApproveRequestSchema = z.object({
  comments: z.string().optional()
});

// POST /api/plugins/approval/requests/[requestId]/approve
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
    const { comments } = ApproveRequestSchema.parse(body);

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
        status: 'APPROVED',
        approvedBy: user.id,
        approvedAt: new Date(),
        comments: comments ? {
          push: {
            id: `comment-${Date.now()}`,
            author: user.name,
            role: user.roles[0],
            message: comments,
            timestamp: new Date().toISOString(),
            type: 'APPROVAL'
          }
        } : undefined
      }
    });

    // Record the approval in operations history
    await prisma.pluginOperation.create({
      data: {
        pluginId: approvalRequest.pluginId!,
        operationType: 'APPROVED' as any,
        status: 'COMPLETED',
        version: approvalRequest.pluginVersion?.version,
        performedBy: user.id,
        parameters: {
          requestId,
          comments
        } as any,
        result: {
          message: `Approval request ${requestId} approved by ${user.name}`
        } as any
      }
    });

    // If this was an install request, update plugin installation status
    if (approvalRequest.requestType === 'INSTALL' && approvalRequest.plugin) {
      await prisma.plugin.update({
        where: { id: approvalRequest.plugin.id },
        data: {
          isInstalled: true
        }
      });

      // Mark version as deployed
      if (approvalRequest.pluginVersion) {
        await prisma.pluginVersion.update({
          where: { id: approvalRequest.pluginVersion.id },
          data: {
            isDeployed: true,
            deployedBy: user.id,
            deployedAt: new Date(),
            status: 'DEPLOYED'
          }
        });
      }

      // Create deployment record
      await prisma.pluginDeployment.create({
        data: {
          pluginVersionId: approvalRequest.pluginVersion!.id,
          environment: 'production',
          status: 'PENDING',
          strategy: 'ROLLING',
          deployedBy: user.id
        }
      });
    }

    // Send notifications (implement notification service)
    // await notificationService.notifyRequestApproved(updatedRequest);

    return NextResponse.json({
      id: updatedRequest.id,
      status: 'APPROVED',
      message: 'Request approved successfully',
      approvedBy: user.name,
      approvedAt: updatedRequest.approvedAt
    });
  } catch (error) {
    console.error('Failed to approve request:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to approve request' },
      { status: 500 }
    );
  }
}