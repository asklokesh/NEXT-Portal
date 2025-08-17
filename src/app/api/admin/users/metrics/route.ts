/**
 * Admin User Metrics API
 * Provides user statistics and analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { UserManagementService } from '@/services/admin/UserManagementService';
import { AccessControlService } from '@/services/admin/AccessControlService';
import { getServerSession } from 'next-auth';

// Initialize services
const userService = new UserManagementService();
const accessService = new AccessControlService();

/**
 * GET /api/admin/users/metrics
 * Get user metrics and statistics
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

    // Get metrics
    const metrics = await userService.getUserMetrics();

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error('Failed to get user metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}