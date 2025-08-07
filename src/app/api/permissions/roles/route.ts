/**
 * Role Management API
 * API endpoints for managing roles
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getRoleManager } from '@/lib/permissions';
import { requirePermission } from '@/lib/permissions/helpers';
import { ResourceType, PermissionAction } from '@/lib/permissions/types';

/**
 * GET /api/permissions/roles
 * Get all roles
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
      ResourceType.ROLE,
      PermissionAction.READ
    );

    const roleManager = getRoleManager();
    const roles = await roleManager.getAllRoles();

    return NextResponse.json(roles);
  } catch (error) {
    console.error('Failed to get roles:', error);
    return NextResponse.json(
      { error: 'Failed to get roles' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/permissions/roles
 * Create a new role
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
      ResourceType.ROLE,
      PermissionAction.CREATE
    );

    const body = await request.json();
    const { name, description, permissions, inheritedRoles } = body;

    if (!name || !description) {
      return NextResponse.json(
        { error: 'Name and description are required' },
        { status: 400 }
      );
    }

    const roleManager = getRoleManager();
    const role = await roleManager.createRole({
      name,
      description,
      permissions: permissions || [],
      inheritedRoles
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error('Failed to create role:', error);
    return NextResponse.json(
      { error: 'Failed to create role' },
      { status: 500 }
    );
  }
}