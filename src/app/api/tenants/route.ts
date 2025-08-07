import { NextRequest, NextResponse } from 'next/server';
import { tenantManager } from '@/lib/multi-tenant/tenant-manager';
import { withTenantContext, requireAuth, requirePermission } from '@/lib/multi-tenant/tenant-context';
import { auth } from '@/lib/auth';

// GET /api/tenants - List user's tenants or get current tenant info
export const GET = withTenantContext(async (context, request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'current') {
      // Return current tenant info
      return NextResponse.json({
        tenant: context.tenant,
        userRole: context.user?.role,
        isOwner: context.isOwner
      });
    }

    if (action === 'list' && context.user) {
      // List user's tenants
      const tenants = await tenantManager.getUserTenants(context.user.id);
      return NextResponse.json({ tenants });
    }

    if (action === 'analytics' && context.tenant) {
      // Get tenant analytics
      if (!context.hasPermission('tenant.analytics')) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }

      const days = parseInt(searchParams.get('days') || '30', 10);
      const analytics = await tenantManager.getTenantAnalytics(context.tenant.id, days);
      return NextResponse.json({ analytics });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Failed to process tenant request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/tenants - Create new tenant or perform tenant action
export const POST = requireAuth(async (context, request: NextRequest) => {
  try {
    const data = await request.json();
    const action = data.action;

    switch (action) {
      case 'create':
        const { name, slug, domain, plan, settings, branding } = data;
        
        if (!name) {
          return NextResponse.json({ error: 'Tenant name is required' }, { status: 400 });
        }

        const tenant = await tenantManager.createTenant({
          name,
          slug,
          domain,
          ownerId: context.user.id,
          plan,
          settings,
          branding
        });

        return NextResponse.json({ 
          message: 'Tenant created successfully',
          tenant 
        }, { status: 201 });

      case 'invite_user':
        if (!context.tenant) {
          return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
        }

        if (!context.hasPermission('users.manage')) {
          return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        const { email, role } = data;
        if (!email || !role) {
          return NextResponse.json({ 
            error: 'Email and role are required' 
          }, { status: 400 });
        }

        const invitation = await tenantManager.inviteUserToTenant(
          context.tenant.id,
          email,
          role,
          context.user.id
        );

        return NextResponse.json({ 
          message: 'User invited successfully',
          invitation 
        }, { status: 201 });

      case 'accept_invitation':
        const { token } = data;
        if (!token) {
          return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
        }

        const accepted = await tenantManager.acceptInvitation(token, context.user.id);
        if (!accepted) {
          return NextResponse.json({ 
            error: 'Invalid or expired invitation' 
          }, { status: 400 });
        }

        return NextResponse.json({ message: 'Invitation accepted successfully' });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Failed to process tenant action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PUT /api/tenants - Update tenant
export const PUT = requirePermission('tenant.manage', async (context, request: NextRequest) => {
  try {
    if (!context.tenant) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const updates = await request.json();
    delete updates.id; // Prevent ID changes
    delete updates.ownerId; // Prevent owner changes
    delete updates.createdAt; // Prevent timestamp changes

    const updatedTenant = await tenantManager.updateTenant(context.tenant.id, updates);
    
    if (!updatedTenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'Tenant updated successfully',
      tenant: updatedTenant 
    });

  } catch (error) {
    console.error('Failed to update tenant:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// DELETE /api/tenants - Delete tenant
export const DELETE = requireAuth(async (context, request: NextRequest) => {
  try {
    if (!context.tenant) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    // Only owner can delete tenant
    if (!context.isOwner) {
      return NextResponse.json({ error: 'Only tenant owner can delete tenant' }, { status: 403 });
    }

    const success = await tenantManager.deleteTenant(context.tenant.id);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete tenant' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Tenant deleted successfully' });

  } catch (error) {
    console.error('Failed to delete tenant:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});