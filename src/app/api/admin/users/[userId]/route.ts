/**
 * Admin Individual User Management API
 * Provides endpoints for individual user operations
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
const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(2).max(100).optional(),
  username: z.string().min(3).max(30).optional(),
  role: z.enum(['ADMIN', 'PLATFORM_ENGINEER', 'DEVELOPER', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
  mfaEnabled: z.boolean().optional(),
  teamIds: z.array(z.string()).optional()
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8)
});

const lockUserSchema = z.object({
  lock: z.boolean()
});

/**
 * GET /api/admin/users/[userId]
 * Get user details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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
      action: 'read',
      resourceId: params.userId
    });

    if (!hasAccess.allowed) {
      return NextResponse.json(
        { error: 'Forbidden', reason: hasAccess.reason },
        { status: 403 }
      );
    }

    // Get user
    const user = await userService.getUserById(params.userId);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Remove sensitive data
    const { password, mfaSecret, ...safeUser } = user as any;

    return NextResponse.json(safeUser);
  } catch (error: any) {
    console.error('Failed to get user:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/users/[userId]
 * Update user
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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
      action: 'update',
      resourceId: params.userId
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
    const validation = updateUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Update user
    const user = await userService.updateUser(
      params.userId,
      validation.data,
      session.user.id
    );

    // Remove sensitive data
    const { password, mfaSecret, ...safeUser } = user as any;

    return NextResponse.json(safeUser);
  } catch (error: any) {
    console.error('Failed to update user:', error);
    
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    if (error.message.includes('already in use')) {
      return NextResponse.json(
        { error: 'Conflict', message: error.message },
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
 * DELETE /api/admin/users/[userId]
 * Delete user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Prevent self-deletion
    if (params.userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check permissions
    const hasAccess = await accessService.checkAccess({
      userId: session.user.id,
      resource: 'users',
      action: 'delete',
      resourceId: params.userId
    });

    if (!hasAccess.allowed) {
      return NextResponse.json(
        { error: 'Forbidden', reason: hasAccess.reason },
        { status: 403 }
      );
    }

    // Delete user
    await userService.deleteUser(params.userId, session.user.id);

    return NextResponse.json(
      { message: 'User deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Failed to delete user:', error);
    
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users/[userId]/reset-password
 * Reset user password
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const path = request.nextUrl.pathname;
    
    // Handle reset-password endpoint
    if (path.endsWith('/reset-password')) {
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
        action: 'reset-password',
        resourceId: params.userId
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
      const validation = resetPasswordSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: validation.error.errors },
          { status: 400 }
        );
      }

      // Reset password
      await userService.resetUserPassword(
        params.userId,
        validation.data.newPassword,
        session.user.id
      );

      return NextResponse.json(
        { message: 'Password reset successfully' },
        { status: 200 }
      );
    }
    
    // Handle lock/unlock endpoint
    if (path.endsWith('/lock')) {
      // Check authentication
      const session = await getServerSession();
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      // Prevent self-lock
      if (params.userId === session.user.id) {
        return NextResponse.json(
          { error: 'Cannot lock your own account' },
          { status: 400 }
        );
      }

      // Check permissions
      const hasAccess = await accessService.checkAccess({
        userId: session.user.id,
        resource: 'users',
        action: 'lock',
        resourceId: params.userId
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
      const validation = lockUserSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: validation.error.errors },
          { status: 400 }
        );
      }

      // Lock/unlock user
      await userService.toggleUserLock(
        params.userId,
        validation.data.lock,
        session.user.id
      );

      return NextResponse.json(
        { 
          message: validation.data.lock 
            ? 'User locked successfully' 
            : 'User unlocked successfully' 
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('Failed to process request:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}