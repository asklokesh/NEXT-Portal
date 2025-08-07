/**
 * Permission Check API
 * API endpoint for checking permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getPermissionEngine } from '@/lib/permissions';
import { PermissionCheckRequest } from '@/lib/permissions/types';

/**
 * POST /api/permissions/check
 * Check if user has permission
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { resource, action, resourceId, context } = body;

    if (!resource || !action) {
      return NextResponse.json(
        { error: 'Resource and action are required' },
        { status: 400 }
      );
    }

    const engine = getPermissionEngine();
    const checkRequest: PermissionCheckRequest = {
      userId: session.user.id,
      resource,
      action,
      resourceId,
      context
    };

    const decision = await engine.checkPermission(checkRequest);

    return NextResponse.json({
      allowed: decision.allowed,
      reason: decision.reason,
      evaluationTime: decision.evaluationTime
    });
  } catch (error) {
    console.error('Permission check failed:', error);
    return NextResponse.json(
      { error: 'Permission check failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/permissions/check
 * Get user's effective permissions
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { getUserPermissions } = await import('@/lib/permissions/helpers');
    const permissions = await getUserPermissions(session.user.id);

    return NextResponse.json({ permissions });
  } catch (error) {
    console.error('Failed to get permissions:', error);
    return NextResponse.json(
      { error: 'Failed to get permissions' },
      { status: 500 }
    );
  }
}