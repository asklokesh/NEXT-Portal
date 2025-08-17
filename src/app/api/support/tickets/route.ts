/**
 * Support Tickets API Routes
 * 
 * RESTful API endpoints for support ticketing system:
 * - Create and manage support tickets
 * - Multi-channel support integration
 * - SLA tracking and escalation
 */

import { NextRequest, NextResponse } from 'next/server';
import { supportService } from '@/services/support/support-service';

// GET /api/support/tickets - Get tickets with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract user info from headers (mock for now)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') || '';
    
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          message: 'User must be authenticated to view tickets'
        },
        { status: 401 }
      );
    }

    const params: any = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sortBy: searchParams.get('sortBy') as 'created' | 'updated' | 'priority' | 'status' || 'created',
      sortOrder: searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc',
      search: searchParams.get('search') || undefined,
      overdueSla: searchParams.get('overdue_sla') === 'true'
    };

    // Apply filters based on user role
    if (userRole === 'ADMIN' || userRole === 'PLATFORM_ENGINEER') {
      // Admins can see all tickets
      params.assignedTo = searchParams.get('assigned_to') || undefined;
      params.assignedTeam = searchParams.get('assigned_team') || undefined;
    } else {
      // Regular users can only see their own tickets
      params.userId = userId;
    }

    // Apply additional filters
    const status = searchParams.getAll('status');
    if (status.length) params.status = status;
    
    const priority = searchParams.getAll('priority');
    if (priority.length) params.priority = priority;
    
    const category = searchParams.getAll('category');
    if (category.length) params.category = category;
    
    const channel = searchParams.getAll('channel');
    if (channel.length) params.channel = channel;
    
    const slaLevel = searchParams.getAll('sla_level');
    if (slaLevel.length) params.slaLevel = slaLevel;

    const result = await supportService.getTickets(params);

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('GET /api/support/tickets error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch tickets',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// POST /api/support/tickets - Create new support ticket
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract user ID from session/auth (mock for now)
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          message: 'User must be authenticated to create tickets'
        },
        { status: 401 }
      );
    }

    const ticket = await supportService.createTicket(userId, body);

    return NextResponse.json({
      success: true,
      data: ticket,
      message: 'Support ticket created successfully'
    }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/support/tickets error:', error);
    
    if (error.message.includes('validation')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          message: error.message
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create ticket',
        message: error.message
      },
      { status: 500 }
    );
  }
}