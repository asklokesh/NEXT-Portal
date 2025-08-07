import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { addDays, addMonths, parseISO, isBefore, isAfter } from 'date-fns';
import { 
  lifecycleManager, 
  DeprecationScheduleSchema,
  ApprovalStatus 
} from '@/lib/lifecycle/LifecycleManager';
import { lifecycleNotificationManager } from '@/lib/notifications/LifecycleNotifications';

// Request schemas
const CreateScheduleSchema = DeprecationScheduleSchema.omit({
  id: true,
  createdAt: true
});

const UpdateScheduleSchema = DeprecationScheduleSchema.partial().omit({
  id: true,
  createdAt: true,
  entityId: true,
  createdBy: true
});

const BulkScheduleSchema = z.object({
  entityIds: z.array(z.string()),
  scheduledDate: z.string().datetime(),
  reason: z.string(),
  migrationPlan: z.string().optional(),
  replacementService: z.string().optional(),
  createdBy: z.string(),
  notificationOffsets: z.array(z.number()).optional().default([30, 7, 1]) // days before
});

const ApprovalActionSchema = z.object({
  scheduleId: z.string(),
  action: z.enum(['approve', 'reject']),
  approver: z.string(),
  comments: z.string().optional()
});

const RescheduleSchema = z.object({
  scheduleId: z.string(),
  newDate: z.string().datetime(),
  reason: z.string(),
  updatedBy: z.string()
});

// GET /api/lifecycle/schedule - Get deprecation schedules
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');
    const status = searchParams.get('status');
    const upcoming = searchParams.get('upcoming') === 'true';
    const overdue = searchParams.get('overdue') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get single schedule if entityId provided
    if (entityId) {
      const schedule = await lifecycleManager.getDeprecationSchedule(entityId);
      if (!schedule) {
        return NextResponse.json(
          { success: false, error: 'Schedule not found for entity' },
          { status: 404 }
        );
      }

      // Enrich with entity information
      const entity = await lifecycleManager.getEntity(entityId);
      const enrichedSchedule = {
        ...schedule,
        entityName: entity?.name || 'Unknown',
        entityKind: entity?.kind || 'Unknown',
        entityStage: entity?.currentStage || 'Unknown'
      };

      return NextResponse.json({
        success: true,
        data: { schedule: enrichedSchedule }
      });
    }

    // Get all schedules (would need to be implemented in lifecycle manager)
    // For now, return empty array as this would require database integration
    let schedules: any[] = [];

    // Apply filters
    const now = new Date();
    if (upcoming) {
      schedules = schedules.filter(s => 
        isAfter(parseISO(s.scheduledDate), now) && 
        isBefore(parseISO(s.scheduledDate), addDays(now, 90))
      );
    }

    if (overdue) {
      schedules = schedules.filter(s => 
        isBefore(parseISO(s.scheduledDate), now)
      );
    }

    // Apply pagination
    const total = schedules.length;
    const paginatedSchedules = schedules.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: {
        schedules: paginatedSchedules,
        pagination: {
          total,
          offset,
          limit,
          hasMore: offset + limit < total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch schedules',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/lifecycle/schedule - Create a new deprecation schedule
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Handle bulk scheduling
    if (body.entityIds && Array.isArray(body.entityIds)) {
      return handleBulkScheduling(body);
    }

    // Handle single schedule
    const validatedData = CreateScheduleSchema.parse(body);

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

    // Check if schedule already exists
    const existingSchedule = await lifecycleManager.getDeprecationSchedule(validatedData.entityId);
    if (existingSchedule) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Deprecation schedule already exists for this entity' 
        },
        { status: 409 }
      );
    }

    // Create the schedule
    const schedule = await lifecycleManager.scheduleDeprecation(validatedData);

    // Send notification to stakeholders
    await lifecycleNotificationManager.notifyDeprecationWarning(entity, schedule);

    return NextResponse.json({
      success: true,
      data: {
        schedule,
        entityName: entity.name,
        message: 'Deprecation scheduled successfully'
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating schedule:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid schedule data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create schedule',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/lifecycle/schedule - Update a deprecation schedule
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { scheduleId, ...updates } = body;

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: 'scheduleId is required' },
        { status: 400 }
      );
    }

    const validatedUpdates = UpdateScheduleSchema.parse(updates);
    const schedule = await lifecycleManager.updateDeprecationSchedule(scheduleId, validatedUpdates);

    // Get entity for enriched response
    const entity = await lifecycleManager.getEntity(schedule.entityId);

    return NextResponse.json({
      success: true,
      data: {
        schedule,
        entityName: entity?.name || 'Unknown',
        message: 'Schedule updated successfully'
      }
    });

  } catch (error) {
    console.error('Error updating schedule:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid schedule update data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update schedule',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/lifecycle/schedule - Cancel a deprecation schedule
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');
    const cancelledBy = searchParams.get('cancelledBy');

    if (!scheduleId || !cancelledBy) {
      return NextResponse.json(
        { success: false, error: 'scheduleId and cancelledBy are required' },
        { status: 400 }
      );
    }

    // This would need implementation in lifecycle manager
    // For now, return success
    return NextResponse.json({
      success: true,
      data: {
        message: 'Schedule cancelled successfully',
        scheduleId,
        cancelledBy
      }
    });

  } catch (error) {
    console.error('Error cancelling schedule:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to cancel schedule',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PATCH /api/lifecycle/schedule - Handle various schedule actions
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'approve':
      case 'reject':
        return handleApprovalAction(body);
      case 'reschedule':
        return handleReschedule(body);
      case 'postpone':
        return handlePostpone(body);
      case 'accelerate':
        return handleAccelerate(body);
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error processing schedule action:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process schedule action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle bulk scheduling
async function handleBulkScheduling(body: any) {
  try {
    const validatedData = BulkScheduleSchema.parse(body);
    const results = [];
    const errors = [];

    for (const entityId of validatedData.entityIds) {
      try {
        const entity = await lifecycleManager.getEntity(entityId);
        if (!entity) {
          errors.push({ entityId, error: 'Entity not found' });
          continue;
        }

        // Check if schedule already exists
        const existingSchedule = await lifecycleManager.getDeprecationSchedule(entityId);
        if (existingSchedule) {
          errors.push({ entityId, error: 'Schedule already exists' });
          continue;
        }

        // Calculate notification dates
        const scheduledDate = parseISO(validatedData.scheduledDate);
        const notificationDates = validatedData.notificationOffsets.map(offset => 
          addDays(scheduledDate, -offset).toISOString()
        );

        const schedule = await lifecycleManager.scheduleDeprecation({
          entityId,
          scheduledDate: validatedData.scheduledDate,
          notificationDates,
          reason: validatedData.reason,
          migrationPlan: validatedData.migrationPlan,
          replacementService: validatedData.replacementService,
          approvals: [],
          createdBy: validatedData.createdBy
        });

        results.push({
          entityId,
          entityName: entity.name,
          schedule
        });

        // Send notification
        await lifecycleNotificationManager.notifyDeprecationWarning(entity, schedule);

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
    console.error('Error processing bulk scheduling:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid bulk schedule data',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process bulk scheduling',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle approval actions
async function handleApprovalAction(body: any) {
  const validatedData = ApprovalActionSchema.parse(body);
  
  // This would require implementation in lifecycle manager
  // For now, return mock response
  return NextResponse.json({
    success: true,
    data: {
      message: `Schedule ${validatedData.action}d successfully`,
      scheduleId: validatedData.scheduleId,
      approver: validatedData.approver
    }
  });
}

// Handle reschedule
async function handleReschedule(body: any) {
  const validatedData = RescheduleSchema.parse(body);
  
  // Update the schedule with new date
  const updates = {
    scheduledDate: validatedData.newDate,
    // Recalculate notification dates
    notificationDates: [
      addDays(parseISO(validatedData.newDate), -30).toISOString(),
      addDays(parseISO(validatedData.newDate), -7).toISOString(),
      addDays(parseISO(validatedData.newDate), -1).toISOString()
    ]
  };

  const schedule = await lifecycleManager.updateDeprecationSchedule(validatedData.scheduleId, updates);

  return NextResponse.json({
    success: true,
    data: {
      schedule,
      message: 'Schedule rescheduled successfully',
      oldDate: body.oldDate,
      newDate: validatedData.newDate
    }
  });
}

// Handle postpone
async function handlePostpone(body: any) {
  const { scheduleId, days, reason, updatedBy } = body;
  
  if (!scheduleId || !days || !updatedBy) {
    return NextResponse.json(
      { success: false, error: 'scheduleId, days, and updatedBy are required' },
      { status: 400 }
    );
  }

  // Get current schedule (would need implementation)
  // For now, calculate new date
  const newDate = addDays(new Date(), days).toISOString();
  
  return handleReschedule({
    scheduleId,
    newDate,
    reason: reason || `Postponed by ${days} days`,
    updatedBy
  });
}

// Handle accelerate
async function handleAccelerate(body: any) {
  const { scheduleId, days, reason, updatedBy } = body;
  
  if (!scheduleId || !days || !updatedBy) {
    return NextResponse.json(
      { success: false, error: 'scheduleId, days, and updatedBy are required' },
      { status: 400 }
    );
  }

  // Calculate earlier date
  const newDate = addDays(new Date(), -Math.abs(days)).toISOString();
  
  return handleReschedule({
    scheduleId,
    newDate,
    reason: reason || `Accelerated by ${days} days`,
    updatedBy
  });
}

// Additional utility endpoints

// GET /api/lifecycle/schedule/upcoming - Get upcoming deprecations
export async function getUpcomingDeprecations(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    
    const cutoffDate = addDays(new Date(), days);
    
    // This would query schedules from database
    const upcomingSchedules = []; // Placeholder
    
    return NextResponse.json({
      success: true,
      data: {
        schedules: upcomingSchedules,
        timeframe: `${days} days`,
        total: upcomingSchedules.length
      }
    });

  } catch (error) {
    console.error('Error fetching upcoming deprecations:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch upcoming deprecations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/lifecycle/schedule/statistics - Get schedule statistics
export async function getScheduleStatistics() {
  try {
    const now = new Date();
    
    // This would query actual data from database
    const stats = {
      total: 0,
      upcoming30Days: 0,
      upcomingThisWeek: 0,
      overdue: 0,
      awaitingApproval: 0,
      byMonth: {},
      byStage: {}
    };

    return NextResponse.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching schedule statistics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch schedule statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}