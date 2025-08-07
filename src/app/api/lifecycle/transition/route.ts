import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  lifecycleManager, 
  LifecycleStage, 
  TransitionTrigger, 
  ApprovalStatus 
} from '@/lib/lifecycle/LifecycleManager';
import { lifecycleNotificationManager } from '@/lib/notifications/LifecycleNotifications';

// Request schemas
const TransitionRequestSchema = z.object({
  entityId: z.string(),
  toStage: z.nativeEnum(LifecycleStage),
  reason: z.string(),
  triggeredBy: z.string(),
  trigger: z.nativeEnum(TransitionTrigger).optional(),
  metadata: z.record(z.any()).optional()
});

const ApprovalRequestSchema = z.object({
  transitionId: z.string(),
  action: z.enum(['approve', 'reject']),
  approver: z.string(),
  comments: z.string().optional(),
  reason: z.string().optional()
});

const BulkTransitionSchema = z.object({
  entityIds: z.array(z.string()),
  toStage: z.nativeEnum(LifecycleStage),
  reason: z.string(),
  triggeredBy: z.string(),
  trigger: z.nativeEnum(TransitionTrigger).optional()
});

// GET /api/lifecycle/transition - Get transition history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId') || undefined;
    const status = searchParams.get('status') as ApprovalStatus | undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let transitions = await lifecycleManager.getTransitionHistory(entityId);

    // Filter by status if provided
    if (status) {
      transitions = transitions.filter(t => t.approvalStatus === status);
    }

    // Apply pagination
    const total = transitions.length;
    const paginatedTransitions = transitions.slice(offset, offset + limit);

    // Enrich with entity information
    const enrichedTransitions = await Promise.all(
      paginatedTransitions.map(async (transition) => {
        const entity = await lifecycleManager.getEntity(transition.entityId);
        return {
          ...transition,
          entityName: entity?.name || 'Unknown',
          entityKind: entity?.kind || 'Unknown'
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        transitions: enrichedTransitions,
        pagination: {
          total,
          offset,
          limit,
          hasMore: offset + limit < total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching transition history:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch transition history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/lifecycle/transition - Request a new transition
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Handle bulk transitions
    if (body.entityIds && Array.isArray(body.entityIds)) {
      return handleBulkTransition(body);
    }

    // Handle single transition
    const validatedData = TransitionRequestSchema.parse(body);

    // Check if entity exists
    const entity = await lifecycleManager.getEntity(validatedData.entityId);
    if (!entity) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Entity with id ${validatedData.entityId} not found` 
        },
        { status: 404 }
      );
    }

    // Request the transition
    const transition = await lifecycleManager.requestTransition(
      validatedData.entityId,
      validatedData.toStage,
      validatedData.reason,
      validatedData.triggeredBy,
      validatedData.trigger,
      validatedData.metadata
    );

    // Send notification if approval is required
    if (transition.approvalStatus === ApprovalStatus.PENDING) {
      await lifecycleNotificationManager.notifyTransitionApproval(transition, entity);
    }

    return NextResponse.json({
      success: true,
      data: {
        transition,
        requiresApproval: transition.approvalStatus === ApprovalStatus.PENDING
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error requesting transition:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to request transition',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/lifecycle/transition - Approve or reject a transition
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = ApprovalRequestSchema.parse(body);

    const { transitionId, action, approver, comments, reason } = validatedData;

    if (action === 'approve') {
      await lifecycleManager.approveTransition(transitionId, approver, comments);
    } else if (action === 'reject') {
      if (!reason) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Reason is required for rejection' 
          },
          { status: 400 }
        );
      }
      await lifecycleManager.rejectTransition(transitionId, approver, reason);
    }

    // Get updated transition
    const transitions = await lifecycleManager.getTransitionHistory();
    const updatedTransition = transitions.find(t => t.id === transitionId);

    if (!updatedTransition) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Transition not found after update' 
        },
        { status: 404 }
      );
    }

    // Get entity for enriched response
    const entity = await lifecycleManager.getEntity(updatedTransition.entityId);

    return NextResponse.json({
      success: true,
      data: {
        transition: {
          ...updatedTransition,
          entityName: entity?.name || 'Unknown',
          entityKind: entity?.kind || 'Unknown'
        }
      }
    });

  } catch (error) {
    console.error('Error processing transition approval:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process transition approval',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle bulk transitions
async function handleBulkTransition(body: any) {
  try {
    const validatedData = BulkTransitionSchema.parse(body);
    const results = [];
    const errors = [];

    for (const entityId of validatedData.entityIds) {
      try {
        const entity = await lifecycleManager.getEntity(entityId);
        if (!entity) {
          errors.push({ entityId, error: 'Entity not found' });
          continue;
        }

        const transition = await lifecycleManager.requestTransition(
          entityId,
          validatedData.toStage,
          validatedData.reason,
          validatedData.triggeredBy,
          validatedData.trigger
        );

        results.push({
          entityId,
          entityName: entity.name,
          transition,
          requiresApproval: transition.approvalStatus === ApprovalStatus.PENDING
        });

        // Send notification if approval is required
        if (transition.approvalStatus === ApprovalStatus.PENDING) {
          await lifecycleNotificationManager.notifyTransitionApproval(transition, entity);
        }

      } catch (error) {
        errors.push({ 
          entityId, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        successful: results,
        failed: errors,
        summary: {
          total: validatedData.entityIds.length,
          successful: results.length,
          failed: errors.length
        }
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error processing bulk transition:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid bulk transition data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process bulk transition',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/lifecycle/transition - Cancel a pending transition
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transitionId = searchParams.get('transitionId');
    const cancelledBy = searchParams.get('cancelledBy');

    if (!transitionId || !cancelledBy) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'transitionId and cancelledBy are required' 
        },
        { status: 400 }
      );
    }

    // Get the transition
    const transitions = await lifecycleManager.getTransitionHistory();
    const transition = transitions.find(t => t.id === transitionId);

    if (!transition) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Transition not found' 
        },
        { status: 404 }
      );
    }

    if (transition.approvalStatus !== ApprovalStatus.PENDING) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Can only cancel pending transitions' 
        },
        { status: 400 }
      );
    }

    // Cancel by rejecting
    await lifecycleManager.rejectTransition(
      transitionId, 
      cancelledBy, 
      'Transition cancelled by user'
    );

    return NextResponse.json({
      success: true,
      data: {
        message: 'Transition cancelled successfully',
        transitionId
      }
    });

  } catch (error) {
    console.error('Error cancelling transition:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to cancel transition',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}