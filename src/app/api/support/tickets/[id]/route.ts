/**
 * Individual Support Ticket API Routes
 * 
 * Operations on specific support tickets
 */

import { NextRequest, NextResponse } from 'next/server';
import { supportService } from '@/services/support/support-service';

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/support/tickets/[id] - Get ticket by ID or number
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const includeMessages = searchParams.get('include_messages') !== 'false';
    
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

    const ticket = await supportService.getTicket(id, includeMessages);

    if (!ticket) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ticket not found',
          message: 'The requested ticket could not be found'
        },
        { status: 404 }
      );
    }

    // Check access permissions
    const isOwner = ticket.userId === userId;
    const isAdmin = userRole === 'ADMIN' || userRole === 'PLATFORM_ENGINEER';
    const isAssigned = ticket.assignedTo === userId;

    if (!isOwner && !isAdmin && !isAssigned) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied',
          message: 'You do not have permission to view this ticket'
        },
        { status: 403 }
      );
    }

    // Filter internal messages for non-admin users
    if (!isAdmin && ticket.messages) {
      ticket.messages = ticket.messages.filter((msg: any) => !msg.isInternal);
    }

    return NextResponse.json({
      success: true,
      data: ticket
    });
  } catch (error: any) {
    console.error('GET /api/support/tickets/[id] error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch ticket',
        message: error.message
      },
      { status: 500 }
    );
  }
}

// PUT /api/support/tickets/[id] - Update ticket
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();
    
    // Extract user info from headers (mock for now)
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role') || '';
    
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          message: 'User must be authenticated to update tickets'
        },
        { status: 401 }
      );
    }

    // Check if user has permission to update tickets
    if (userRole !== 'ADMIN' && userRole !== 'PLATFORM_ENGINEER') {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          message: 'Only support agents can update tickets'
        },
        { status: 403 }
      );
    }

    const updatedTicket = await supportService.updateTicket(id, userId, body);

    return NextResponse.json({
      success: true,
      data: updatedTicket,
      message: 'Ticket updated successfully'
    });
  } catch (error: any) {
    console.error('PUT /api/support/tickets/[id] error:', error);
    
    if (error.message.includes('not found')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ticket not found',
          message: error.message
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update ticket',
        message: error.message
      },
      { status: 500 }
    );
  }
}