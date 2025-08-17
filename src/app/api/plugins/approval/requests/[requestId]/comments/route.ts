import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const AddCommentSchema = z.object({
  message: z.string().min(1, 'Comment message is required'),
  type: z.enum(['COMMENT', 'APPROVAL', 'REJECTION', 'REQUEST_INFO']).optional().default('COMMENT')
});

// POST /api/plugins/approval/requests/[requestId]/comments
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const user = await getServerSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = params;
    const body = await request.json();
    const { message, type } = AddCommentSchema.parse(body);

    // Fetch the approval request
    const approvalRequest = await prisma.pluginApproval.findUnique({
      where: { id: requestId }
    });

    if (!approvalRequest) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
    }

    // Create comment object
    const comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      author: user.name,
      role: user.roles[0] || 'developer',
      message,
      timestamp: new Date().toISOString(),
      type
    };

    // Update approval request with new comment
    const updatedRequest = await prisma.pluginApproval.update({
      where: { id: requestId },
      data: {
        comments: {
          push: comment
        },
        updatedAt: new Date()
      }
    });

    // Record the comment in operations history
    if (approvalRequest.pluginId) {
      await prisma.pluginOperation.create({
        data: {
          pluginId: approvalRequest.pluginId,
          operationType: 'COMMENT_ADDED' as any,
          status: 'COMPLETED',
          performedBy: user.id,
          parameters: {
            requestId,
            commentType: type
          } as any,
          result: {
            message: `Comment added to approval request ${requestId}`
          } as any
        }
      });
    }

    // Send notifications if needed
    // await notificationService.notifyNewComment(updatedRequest, comment);

    return NextResponse.json({
      id: comment.id,
      message: 'Comment added successfully',
      comment
    });
  } catch (error) {
    console.error('Failed to add comment:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}

// GET /api/plugins/approval/requests/[requestId]/comments
export async function GET(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const user = await getServerSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = params;

    // Fetch the approval request
    const approvalRequest = await prisma.pluginApproval.findUnique({
      where: { id: requestId },
      select: {
        comments: true
      }
    });

    if (!approvalRequest) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
    }

    return NextResponse.json({
      comments: approvalRequest.comments || []
    });
  } catch (error) {
    console.error('Failed to fetch comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}