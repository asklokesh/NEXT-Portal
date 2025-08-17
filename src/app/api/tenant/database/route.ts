/**
 * Tenant Database Operations API
 * Demonstrates tenant-aware database layer functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { createTenantServiceFromRequest, createSystemService } from '@/lib/database/TenantPrismaService';
import { getTenantContext } from '@/lib/tenancy/TenantContext';
import { validateRequestBody } from '@/lib/security/input-validation';

/**
 * GET - Retrieve tenant database statistics and information
 */
export async function GET(request: NextRequest) {
  try {
    const tenantService = await createTenantServiceFromRequest(request);
    const tenantContext = getTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant context required'
      }, { status: 404 });
    }

    // Check permissions
    if (!tenantService.hasPermission('tenant:read') && !tenantService.hasPermission('analytics:view')) {
      return NextResponse.json({
        success: false,
        error: 'Insufficient permissions'
      }, { status: 403 });
    }

    // Get comprehensive tenant statistics
    const statsResult = await tenantService.getTenantStatistics();
    
    if (!statsResult.success) {
      return NextResponse.json({
        success: false,
        error: statsResult.error
      }, { status: 500 });
    }

    // Get recent plugin operations
    const operationsResult = await tenantService.getPluginOperations(undefined, 10);
    
    // Get plugins summary
    const pluginsResult = await tenantService.getPlugins({
      maxResults: 20,
      includeCounts: true
    });

    const response = {
      success: true,
      data: {
        tenant: {
          id: tenantContext.tenant.id,
          name: tenantContext.tenant.name,
          slug: tenantContext.tenant.slug,
          tier: tenantContext.tenant.tier,
          status: tenantContext.tenant.status
        },
        statistics: statsResult.data,
        recentOperations: operationsResult.success ? operationsResult.data : [],
        plugins: pluginsResult.success ? pluginsResult.data : [],
        databaseInfo: {
          isolation: 'row-level-security',
          context: 'tenant-aware',
          permissions: tenantService.getTenantContext()?.permissions || []
        }
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Tenant database API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * POST - Execute tenant-aware database operations
 */
export async function POST(request: NextRequest) {
  try {
    const tenantService = await createTenantServiceFromRequest(request);
    const tenantContext = getTenantContext(request);

    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant context required'
      }, { status: 404 });
    }

    const body = await request.json();
    
    // Validate request body
    const validation = validateRequestBody(body, {
      operation: { type: 'text', required: true, maxLength: 50 },
      parameters: { type: 'json', required: false }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors
      }, { status: 400 });
    }

    const { operation, parameters = {} } = validation.sanitized;

    let result;

    switch (operation) {
      case 'install_plugin':
        // Check permissions
        if (!tenantService.hasPermission('plugin:install')) {
          return NextResponse.json({
            success: false,
            error: 'Insufficient permissions for plugin installation'
          }, { status: 403 });
        }

        result = await tenantService.installPlugin(
          parameters.pluginName,
          parameters.version || 'latest',
          parameters.configuration
        );
        break;

      case 'update_plugin_config':
        // Check permissions
        if (!tenantService.hasPermission('plugin:configure')) {
          return NextResponse.json({
            success: false,
            error: 'Insufficient permissions for plugin configuration'
          }, { status: 403 });
        }

        result = await tenantService.updatePluginConfiguration(
          parameters.pluginId,
          parameters.configuration,
          parameters.environment || 'production'
        );
        break;

      case 'get_plugin_details':
        // Check permissions
        if (!tenantService.hasPermission('plugin:read')) {
          return NextResponse.json({
            success: false,
            error: 'Insufficient permissions for plugin access'
          }, { status: 403 });
        }

        result = await tenantService.getPluginById(
          parameters.pluginId,
          parameters.includeVersions || false
        );
        break;

      case 'get_audit_logs':
        // Check permissions
        if (!tenantService.hasPermission('audit:read')) {
          return NextResponse.json({
            success: false,
            error: 'Insufficient permissions for audit log access'
          }, { status: 403 });
        }

        result = await tenantService.getAuditLogs(
          parameters.filters || {},
          parameters.limit || 50
        );
        break;

      case 'create_audit_entry':
        // Check permissions
        if (!tenantService.hasPermission('audit:write')) {
          return NextResponse.json({
            success: false,
            error: 'Insufficient permissions for audit log creation'
          }, { status: 403 });
        }

        result = await tenantService.createAuditLog(
          parameters.action,
          parameters.resource,
          parameters.resourceId,
          parameters.metadata
        );
        break;

      case 'get_plugin_metrics':
        // Check permissions
        if (!tenantService.hasPermission('analytics:view')) {
          return NextResponse.json({
            success: false,
            error: 'Insufficient permissions for metrics access'
          }, { status: 403 });
        }

        result = await tenantService.getPluginMetrics(
          parameters.pluginId,
          parameters.metricName,
          parameters.timeRange
        );
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown operation: ${operation}`
        }, { status: 400 });
    }

    // Log the operation for audit trail
    await tenantService.createAuditLog(
      `database_operation:${operation}`,
      'tenant_database_api',
      tenantContext.tenant.id,
      {
        operation,
        parameters: Object.keys(parameters),
        success: result.success,
        timestamp: new Date().toISOString()
      }
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error('Tenant database operation error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to execute database operation'
    }, { status: 500 });
  }
}

/**
 * PUT - System-level database operations (requires system permissions)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate system operation request
    const validation = validateRequestBody(body, {
      operation: { type: 'text', required: true, maxLength: 50 },
      systemKey: { type: 'text', required: true },
      parameters: { type: 'json', required: false }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors
      }, { status: 400 });
    }

    const { operation, systemKey, parameters = {} } = validation.sanitized;

    // Verify system key (in production, this would be more sophisticated)
    if (systemKey !== process.env.SYSTEM_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Invalid system key'
      }, { status: 403 });
    }

    const systemService = createSystemService();
    let result;

    switch (operation) {
      case 'tenant_stats_all':
        // Get statistics for all tenants
        const stats = await systemService.getDatabase().getPrismaClient().$queryRaw`
          SELECT 
            tenant_id,
            COUNT(*) as plugin_count
          FROM plugins 
          WHERE tenant_id IS NOT NULL 
          GROUP BY tenant_id
          ORDER BY plugin_count DESC
          LIMIT 10
        `;
        
        result = {
          success: true,
          data: stats,
          tenantId: 'system',
          timestamp: new Date()
        };
        break;

      case 'database_health_check':
        // Perform database health check
        const healthCheck = await systemService.getDatabase().getPrismaClient().$queryRaw`
          SELECT 
            COUNT(*) as total_plugins,
            COUNT(CASE WHEN tenant_id IS NOT NULL THEN 1 END) as tenant_plugins,
            COUNT(CASE WHEN tenant_id IS NULL THEN 1 END) as public_plugins,
            COUNT(DISTINCT tenant_id) as unique_tenants
          FROM plugins
        `;
        
        result = {
          success: true,
          data: healthCheck,
          tenantId: 'system',
          timestamp: new Date()
        };
        break;

      case 'refresh_tenant_metrics':
        // Refresh materialized views (if implemented)
        try {
          await systemService.getDatabase().executeRaw('SELECT refresh_tenant_metrics()');
          result = {
            success: true,
            data: { message: 'Tenant metrics refreshed successfully' },
            tenantId: 'system',
            timestamp: new Date()
          };
        } catch (error) {
          result = {
            success: false,
            error: 'Failed to refresh tenant metrics',
            tenantId: 'system',
            timestamp: new Date()
          };
        }
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown system operation: ${operation}`
        }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('System database operation error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to execute system operation'
    }, { status: 500 });
  }
}

/**
 * DELETE - Tenant data cleanup operations (dangerous, requires confirmation)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate deletion request
    const validation = validateRequestBody(body, {
      tenantId: { type: 'uuid', required: true },
      confirmationCode: { type: 'text', required: true },
      systemKey: { type: 'text', required: true }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors
      }, { status: 400 });
    }

    const { tenantId, confirmationCode, systemKey } = validation.sanitized;

    // Verify system key
    if (systemKey !== process.env.SYSTEM_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'Invalid system key'
      }, { status: 403 });
    }

    // Verify confirmation code
    if (confirmationCode !== 'CONFIRM_DELETE_TENANT_DATA') {
      return NextResponse.json({
        success: false,
        error: 'Invalid confirmation code'
      }, { status: 400 });
    }

    const systemService = createSystemService();
    
    // Execute tenant cleanup using database function
    const cleanupResults = await systemService.getDatabase().executeRaw(
      'SELECT * FROM cleanup_tenant_data($1, $2)',
      [tenantId, 'CONFIRM_DELETE_TENANT_DATA']
    );

    // Log the deletion operation
    await systemService.createAuditLog(
      'tenant_data_deletion',
      'system_cleanup',
      tenantId,
      {
        tenantId,
        cleanupResults,
        requestedAt: new Date().toISOString(),
        systemOperation: true
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        message: 'Tenant data deleted successfully',
        tenantId,
        cleanupResults
      },
      tenantId: 'system',
      timestamp: new Date()
    });

  } catch (error) {
    console.error('Tenant deletion error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to delete tenant data'
    }, { status: 500 });
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID, X-System-Key',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}