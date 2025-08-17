/**
 * Tenant Context API
 * Provides tenant context information for the current request
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, hasPermission, hasFeature } from '@/lib/tenancy/TenantContext';
import { tenantManager } from '@/lib/tenancy/TenantManager';

export async function GET(request: NextRequest) {
  try {
    // Get tenant context from request
    const context = getTenantContext(request);

    if (!context) {
      return NextResponse.json({
        success: false,
        error: 'No tenant context found',
        message: 'This request does not have a valid tenant context'
      }, { status: 404 });
    }

    // Check if user has permission to view tenant information
    if (!hasPermission(context, 'tenant:view')) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions',
        message: 'You do not have permission to view tenant information'
      }, { status: 403 });
    }

    // Get current usage information
    const usage = await tenantManager.getTenantUsage(context.tenant.id);

    // Prepare response with tenant context information
    const response = {
      success: true,
      data: {
        tenant: {
          id: context.tenant.id,
          slug: context.tenant.slug,
          name: context.tenant.name,
          displayName: context.tenant.displayName,
          domain: context.tenant.domain,
          subdomain: context.tenant.subdomain,
          status: context.tenant.status,
          tier: context.tenant.tier,
          createdAt: context.tenant.createdAt,
          updatedAt: context.tenant.updatedAt
        },
        user: context.user ? {
          id: context.user.id,
          email: context.user.email,
          name: context.user.name,
          role: context.user.role,
          organizations: context.user.organizations,
          isActive: context.user.isActive
        } : null,
        permissions: context.permissions,
        limits: context.limits,
        features: context.features,
        usage: usage ? {
          period: usage.period,
          metrics: {
            users: usage.users,
            apiCalls: usage.apiCalls,
            storage: usage.storage,
            sessions: usage.sessions,
            plugins: usage.plugins
          },
          updatedAt: usage.updatedAt
        } : null,
        settings: {
          timezone: context.tenant.settings.timezone,
          locale: context.tenant.settings.locale,
          dateFormat: context.tenant.settings.dateFormat,
          currency: context.tenant.settings.currency
        },
        customization: {
          theme: context.customization.theme,
          brandColors: context.customization.brandColors,
          logo: context.customization.logo,
          favicon: context.customization.favicon
        }
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Tenant context API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve tenant context'
    }, { status: 500 });
  }
}

/**
 * Update tenant settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const context = getTenantContext(request);

    if (!context) {
      return NextResponse.json({
        success: false,
        error: 'No tenant context found'
      }, { status: 404 });
    }

    // Check permissions
    if (!hasPermission(context, 'tenant:manage')) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions',
        message: 'You do not have permission to manage tenant settings'
      }, { status: 403 });
    }

    const body = await request.json();
    const { settings, customization } = body;

    // Update tenant settings if provided
    if (settings) {
      const success = await tenantManager.updateTenantSettings(context.tenant.id, settings);
      if (!success) {
        return NextResponse.json({
          success: false,
          error: 'Failed to update tenant settings'
        }, { status: 500 });
      }
    }

    // Update tenant customization if provided
    if (customization) {
      const success = await tenantManager.updateTenantCustomization(context.tenant.id, customization);
      if (!success) {
        return NextResponse.json({
          success: false,
          error: 'Failed to update tenant customization'
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Tenant updated successfully'
    });

  } catch (error) {
    console.error('Tenant update API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to update tenant'
    }, { status: 500 });
  }
}

/**
 * Get tenant usage metrics
 */
export async function POST(request: NextRequest) {
  try {
    const context = getTenantContext(request);

    if (!context) {
      return NextResponse.json({
        success: false,
        error: 'No tenant context found'
      }, { status: 404 });
    }

    // Check permissions for analytics
    if (!hasPermission(context, 'analytics:view') || !hasFeature(context, 'analytics')) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions or feature not available'
      }, { status: 403 });
    }

    const body = await request.json();
    const { metric, amount = 1 } = body;

    // Record usage
    await tenantManager.recordUsage(context.tenant.id, metric, amount);

    return NextResponse.json({
      success: true,
      message: 'Usage recorded successfully'
    });

  } catch (error) {
    console.error('Usage recording API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to record usage'
    }, { status: 500 });
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
      'Access-Control-Allow-Methods': 'GET, PATCH, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}