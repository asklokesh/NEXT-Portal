/**
 * Audit Log API
 * API endpoints for permission audit logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getAuditLogger } from '@/lib/permissions';
import { requirePermission } from '@/lib/permissions/helpers';
import { ResourceType, PermissionAction } from '@/lib/permissions/types';

/**
 * GET /api/permissions/audit
 * Query audit logs
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission
    await requirePermission(
      session.user.id,
      ResourceType.AUDIT,
      PermissionAction.READ
    );

    const url = new URL(request.url);
    const filters = {
      userId: url.searchParams.get('userId') || undefined,
      resource: url.searchParams.get('resource') as ResourceType | undefined,
      startDate: url.searchParams.get('startDate')
        ? new Date(url.searchParams.get('startDate')!)
        : undefined,
      endDate: url.searchParams.get('endDate')
        ? new Date(url.searchParams.get('endDate')!)
        : undefined,
      allowed: url.searchParams.get('allowed')
        ? url.searchParams.get('allowed') === 'true'
        : undefined,
      limit: url.searchParams.get('limit')
        ? parseInt(url.searchParams.get('limit')!)
        : 100
    };

    const auditLogger = getAuditLogger();
    const logs = await auditLogger.query(filters);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Failed to query audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to query audit logs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/permissions/audit/stats
 * Get audit statistics
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission
    await requirePermission(
      session.user.id,
      ResourceType.AUDIT,
      PermissionAction.READ
    );

    const body = await request.json();
    const { start, end } = body;

    if (!start || !end) {
      return NextResponse.json(
        { error: 'Start and end dates are required' },
        { status: 400 }
      );
    }

    const auditLogger = getAuditLogger();
    const stats = await auditLogger.getStatistics({
      start: new Date(start),
      end: new Date(end)
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get audit statistics:', error);
    return NextResponse.json(
      { error: 'Failed to get statistics' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/permissions/audit/cleanup
 * Cleanup old audit logs
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission - only admins can cleanup
    await requirePermission(
      session.user.id,
      ResourceType.AUDIT,
      PermissionAction.DELETE
    );

    const url = new URL(request.url);
    const daysToKeep = parseInt(url.searchParams.get('days') || '90');

    const auditLogger = getAuditLogger();
    await auditLogger.cleanup(daysToKeep);

    return NextResponse.json({ message: 'Audit logs cleaned up successfully' });
  } catch (error) {
    console.error('Failed to cleanup audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup audit logs' },
      { status: 500 }
    );
  }
}