/**
 * Tenant Provisioning API
 * Handles tenant creation, lifecycle management, and administrative operations
 */

import { NextRequest, NextResponse } from 'next/server';
import TenantProvisioningService, { TenantProvisioningRequest } from '@/services/tenant/TenantProvisioningService';
import { validateRequestBody } from '@/lib/security/input-validation';
import { checkSystemPermissions } from '@/lib/permissions/SystemPermissions';
import { getTenantContext } from '@/lib/tenancy/TenantContext';
import { createAuditLog } from '@/lib/audit/AuditService';

/**
 * POST - Create new tenant
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequestBody(body, {
      organizationName: { type: 'text', required: true, minLength: 2, maxLength: 100 },
      adminEmail: { type: 'email', required: true },
      adminName: { type: 'text', required: true, minLength: 1, maxLength: 100 },
      tier: { type: 'text', required: true, enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] },
      customDomain: { type: 'text', required: false },
      initialConfiguration: { type: 'json', required: false },
      features: { type: 'array', required: false },
      metadata: { type: 'json', required: false }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors
      }, { status: 400 });
    }

    // Check system permissions for tenant creation
    const hasPermission = await checkSystemPermissions(request, ['system:tenant:create', 'admin:all']);
    if (!hasPermission) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions for tenant creation'
      }, { status: 403 });
    }

    const provisioningService = new TenantProvisioningService();
    
    // Create provisioning request
    const provisioningRequest: TenantProvisioningRequest = {
      organizationName: validation.sanitized.organizationName,
      adminEmail: validation.sanitized.adminEmail,
      adminName: validation.sanitized.adminName,
      tier: validation.sanitized.tier,
      customDomain: validation.sanitized.customDomain,
      initialConfiguration: validation.sanitized.initialConfiguration,
      features: validation.sanitized.features || [],
      metadata: validation.sanitized.metadata || {}
    };

    // Provision tenant
    const result = await provisioningService.provisionTenant(provisioningRequest);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        validationErrors: result.validationErrors
      }, { status: 400 });
    }

    // Create audit log
    await createAuditLog({
      action: 'tenant:provision',
      resource: 'tenant',
      resourceId: result.tenant!.id,
      metadata: {
        organizationName: provisioningRequest.organizationName,
        adminEmail: provisioningRequest.adminEmail,
        tier: provisioningRequest.tier,
        setupUrl: result.setupUrl
      }
    });

    // Don't expose sensitive credentials in response
    const response = {
      success: true,
      tenant: {
        id: result.tenant!.id,
        name: result.tenant!.name,
        slug: result.tenant!.slug,
        tier: result.tenant!.tier,
        status: result.tenant!.status,
        customDomain: result.tenant!.customDomain
      },
      setupUrl: result.setupUrl,
      credentials: {
        tenantId: result.credentials!.tenantId,
        adminUserId: result.credentials!.adminUserId,
        // Don't expose actual passwords/keys in API response
        hasInitialPassword: !!result.credentials!.initialPassword,
        apiKeyCount: result.credentials!.apiKeys.length
      }
    };

    await provisioningService.disconnect();
    
    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Tenant provisioning API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error during tenant provisioning'
    }, { status: 500 });
  }
}

/**
 * PATCH - Update tenant lifecycle (suspend, reactivate, upgrade, etc.)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validation = validateRequestBody(body, {
      tenantId: { type: 'uuid', required: true },
      operation: { type: 'text', required: true, enum: ['suspend', 'reactivate', 'upgrade', 'downgrade', 'archive'] },
      reason: { type: 'text', required: false },
      newTier: { type: 'text', required: false, enum: ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'] },
      metadata: { type: 'json', required: false }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors
      }, { status: 400 });
    }

    const { tenantId, operation, reason, newTier, metadata } = validation.sanitized;

    // Check permissions
    const hasPermission = await checkSystemPermissions(request, [`system:tenant:${operation}`, 'admin:all']);
    if (!hasPermission) {
      return NextResponse.json({
        success: false,
        error: `Insufficient permissions for tenant ${operation}`
      }, { status: 403 });
    }

    const provisioningService = new TenantProvisioningService();
    let result;
    const currentUser = getTenantContext(request)?.user?.id || 'system';

    switch (operation) {
      case 'suspend':
        if (!reason) {
          return NextResponse.json({
            success: false,
            error: 'Reason is required for tenant suspension'
          }, { status: 400 });
        }
        result = await provisioningService.suspendTenant(tenantId, reason, currentUser);
        break;

      case 'reactivate':
        result = await provisioningService.reactivateTenant(tenantId, currentUser);
        break;

      case 'upgrade':
        if (!newTier) {
          return NextResponse.json({
            success: false,
            error: 'New tier is required for tenant upgrade'
          }, { status: 400 });
        }
        result = await provisioningService.upgradeTenantTier(tenantId, newTier, currentUser);
        break;

      case 'archive':
        result = await provisioningService.archiveTenant(tenantId, currentUser);
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `Unsupported operation: ${operation}`
        }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    // Create audit log
    await createAuditLog({
      action: `tenant:${operation}`,
      resource: 'tenant',
      resourceId: tenantId,
      metadata: {
        operation,
        reason,
        newTier,
        ...metadata
      }
    });

    await provisioningService.disconnect();

    return NextResponse.json({
      success: true,
      operation,
      tenantId
    });

  } catch (error) {
    console.error('Tenant lifecycle API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error during tenant lifecycle operation'
    }, { status: 500 });
  }
}

/**
 * GET - Retrieve tenant information and lifecycle events
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const includeEvents = searchParams.get('includeEvents') === 'true';
    const includeStats = searchParams.get('includeStats') === 'true';

    if (!tenantId) {
      return NextResponse.json({
        success: false,
        error: 'tenantId parameter is required'
      }, { status: 400 });
    }

    // Validate tenant ID format
    const validation = validateRequestBody({ tenantId }, {
      tenantId: { type: 'uuid', required: true }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid tenant ID format'
      }, { status: 400 });
    }

    // Check permissions
    const hasPermission = await checkSystemPermissions(request, ['system:tenant:read', 'admin:all']);
    if (!hasPermission) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions for tenant information access'
      }, { status: 403 });
    }

    const provisioningService = new TenantProvisioningService();
    const systemDb = provisioningService['systemDb']; // Access through bracket notation

    // Get tenant information
    const tenant = await systemDb.findUnique('organization', {
      where: { id: tenantId },
      include: {
        configuration: {
          where: { isActive: true },
          take: 1
        },
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            createdAt: true
          }
        }
      }
    });

    if (!tenant) {
      return NextResponse.json({
        success: false,
        error: 'Tenant not found'
      }, { status: 404 });
    }

    const response: any = {
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        tier: tenant.tier,
        status: tenant.status,
        customDomain: tenant.customDomain,
        adminEmail: tenant.adminEmail,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt,
        suspendedAt: tenant.suspendedAt,
        archivedAt: tenant.archivedAt,
        users: tenant.users,
        configuration: tenant.configuration[0] || null
      }
    };

    // Include lifecycle events if requested
    if (includeEvents) {
      const events = await systemDb.findMany('tenantLifecycleEvent', {
        where: { tenantId },
        orderBy: { timestamp: 'desc' },
        take: 50
      });
      response.events = events;
    }

    // Include statistics if requested
    if (includeStats) {
      const stats = await systemDb.getTenantStats(tenantId);
      response.statistics = stats;
    }

    await provisioningService.disconnect();

    return NextResponse.json(response);

  } catch (error) {
    console.error('Tenant information API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error retrieving tenant information'
    }, { status: 500 });
  }
}

/**
 * DELETE - Delete tenant (dangerous operation)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body with strict confirmation
    const validation = validateRequestBody(body, {
      tenantId: { type: 'uuid', required: true },
      confirmationText: { type: 'text', required: true },
      reason: { type: 'text', required: true, minLength: 10 },
      systemKey: { type: 'text', required: true }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors
      }, { status: 400 });
    }

    const { tenantId, confirmationText, reason, systemKey } = validation.sanitized;

    // Verify system key
    if (systemKey !== process.env.SYSTEM_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Invalid system key'
      }, { status: 403 });
    }

    // Verify confirmation text
    if (confirmationText !== 'PERMANENTLY DELETE TENANT DATA') {
      return NextResponse.json({
        success: false,
        error: 'Invalid confirmation text'
      }, { status: 400 });
    }

    // Check ultra-high permissions for deletion
    const hasPermission = await checkSystemPermissions(request, ['system:tenant:delete', 'super-admin:all']);
    if (!hasPermission) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions for tenant deletion'
      }, { status: 403 });
    }

    const provisioningService = new TenantProvisioningService();
    const systemDb = provisioningService['systemDb'];

    // Get tenant information before deletion for audit
    const tenant = await systemDb.findUnique('organization', {
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        tier: true,
        adminEmail: true
      }
    });

    if (!tenant) {
      return NextResponse.json({
        success: false,
        error: 'Tenant not found'
      }, { status: 404 });
    }

    // Execute tenant data cleanup using the database function
    const cleanupResults = await systemDb.executeRaw(
      'SELECT * FROM cleanup_tenant_data($1, $2)',
      [tenantId, 'CONFIRM_DELETE_TENANT_DATA']
    );

    // Create final audit log before deletion
    await createAuditLog({
      action: 'tenant:delete',
      resource: 'tenant',
      resourceId: tenantId,
      metadata: {
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        adminEmail: tenant.adminEmail,
        reason,
        cleanupResults,
        deletedAt: new Date().toISOString()
      }
    });

    await provisioningService.disconnect();

    return NextResponse.json({
      success: true,
      message: 'Tenant deleted successfully',
      tenantId,
      cleanupResults
    });

  } catch (error) {
    console.error('Tenant deletion API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error during tenant deletion'
    }, { status: 500 });
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-System-Key',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}