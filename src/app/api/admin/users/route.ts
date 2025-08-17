/**
 * Admin User Management API
 * Provides endpoints for user CRUD operations, search, and bulk operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { UserManagementService } from '@/services/admin/UserManagementService';
import { AccessControlService } from '@/services/admin/AccessControlService';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

// Initialize services
const userService = new UserManagementService();
const accessService = new AccessControlService();

// Validation schemas
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  username: z.string().min(3).max(30).optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['ADMIN', 'PLATFORM_ENGINEER', 'DEVELOPER', 'VIEWER']),
  teamIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).max(100).optional(),
  username: z.string().min(3).max(30).optional(),
  role: z.enum(['ADMIN', 'PLATFORM_ENGINEER', 'DEVELOPER', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
  mfaEnabled: z.boolean().optional(),
  teamIds: z.array(z.string()).optional()
});

const searchSchema = z.object({
  query: z.string().optional(),
  role: z.enum(['ADMIN', 'PLATFORM_ENGINEER', 'DEVELOPER', 'VIEWER']).optional(),
  teamId: z.string().optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  sortBy: z.enum(['name', 'email', 'createdAt', 'lastLogin']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

/**
 * GET /api/admin/users
 * Search and list users
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permissions
    const hasAccess = await accessService.checkAccess({
      userId: session.user.id,
      resource: 'users',
      action: 'read'
    });

    if (!hasAccess.allowed) {
      return NextResponse.json(
        { error: 'Forbidden', reason: hasAccess.reason },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const params = {
      query: searchParams.get('query') || undefined,
      role: searchParams.get('role') as any || undefined,
      teamId: searchParams.get('teamId') || undefined,
      isActive: searchParams.get('isActive') ? searchParams.get('isActive') === 'true' : undefined,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
      sortBy: searchParams.get('sortBy') as any || 'createdAt',
      sortOrder: searchParams.get('sortOrder') as any || 'desc'
    };

    // Validate parameters
    const validation = searchSchema.safeParse(params);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Search users
    const result = await userService.searchUsers(params);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Failed to search users:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Create a new user
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permissions
    const hasAccess = await accessService.checkAccess({
      userId: session.user.id,
      resource: 'users',
      action: 'create'
    });

    if (!hasAccess.allowed) {
      return NextResponse.json(
        { error: 'Forbidden', reason: hasAccess.reason },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = createUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Create user
    const user = await userService.createUser(validation.data, session.user.id);

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create user:', error);
    
    if (error.message.includes('already exists')) {
      return NextResponse.json(
        { error: 'User already exists', message: error.message },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users
 * Bulk update users
 */
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permissions
    const hasAccess = await accessService.checkAccess({
      userId: session.user.id,
      resource: 'users',
      action: 'update'
    });

    if (!hasAccess.allowed) {
      return NextResponse.json(
        { error: 'Forbidden', reason: hasAccess.reason },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();

    if (!Array.isArray(body.updates)) {
      return NextResponse.json(
        { error: 'Invalid input', message: 'Updates must be an array' },
        { status: 400 }
      );
    }

    // Validate each update
    for (const update of body.updates) {
      const validation = updateUserSchema.safeParse(update.update);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid update', userId: update.userId, details: validation.error.errors },
          { status: 400 }
        );
      }
    }

    // Perform bulk update
    const result = await userService.bulkUpdateUsers(body.updates, session.user.id);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Failed to bulk update users:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users
 * Bulk delete users
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permissions
    const hasAccess = await accessService.checkAccess({
      userId: session.user.id,
      resource: 'users',
      action: 'delete'
    });

    if (!hasAccess.allowed) {
      return NextResponse.json(
        { error: 'Forbidden', reason: hasAccess.reason },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();

    if (!Array.isArray(body.userIds)) {
      return NextResponse.json(
        { error: 'Invalid input', message: 'userIds must be an array' },
        { status: 400 }
      );
    }

    // Perform bulk delete
    const result = await userService.bulkDeleteUsers(body.userIds, session.user.id);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Failed to bulk delete users:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}