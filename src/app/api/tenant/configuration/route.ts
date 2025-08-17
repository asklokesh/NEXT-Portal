/**
 * Tenant Configuration API
 * Handles tenant-specific configuration, branding, and feature management
 */

import { NextRequest, NextResponse } from 'next/server';
import TenantConfigurationService, { TenantConfiguration } from '@/services/tenant/TenantConfigurationService';
import { validateRequestBody } from '@/lib/security/input-validation';
import { getTenantContext } from '@/lib/tenancy/TenantContext';
import { checkTenantAdminRights } from '@/lib/permissions/SystemPermissions';

/**
 * GET - Retrieve tenant configuration
 */
export async function GET(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant context required'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');
    const exportConfig = searchParams.get('export') === 'true';

    const configService = new TenantConfigurationService();
    await configService.initializeWithRequest(request);

    if (exportConfig) {
      // Check admin permissions for export
      if (!checkTenantAdminRights(tenantContext, tenantContext.tenant.id)) {
        return NextResponse.json({
          success: false,
          error: 'Admin permissions required for configuration export'
        }, { status: 403 });
      }

      const exportData = await configService.exportConfiguration(tenantContext.tenant.id);
      if (!exportData) {
        return NextResponse.json({
          success: false,
          error: 'Failed to export configuration'
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        data: exportData
      });
    }

    // Get specific section or full configuration
    let configData;
    
    switch (section) {
      case 'branding':
        configData = await configService.getTenantBranding(tenantContext.tenant.id);
        break;
      case 'features':
        configData = await configService.getFeatureToggles(tenantContext.tenant.id);
        break;
      case 'github':
        configData = await configService.getIntegrationConfig(tenantContext.tenant.id, 'github');
        break;
      case 'slack':
        configData = await configService.getIntegrationConfig(tenantContext.tenant.id, 'slack');
        break;
      case 'jira':
        configData = await configService.getIntegrationConfig(tenantContext.tenant.id, 'jira');
        break;
      default:
        configData = await configService.getTenantConfiguration(tenantContext.tenant.id);
    }

    if (!configData) {
      return NextResponse.json({
        success: false,
        error: 'Configuration not found'
      }, { status: 404 });
    }

    await configService.disconnect();

    return NextResponse.json({
      success: true,
      data: configData,
      tenant: {
        id: tenantContext.tenant.id,
        name: tenantContext.tenant.name,
        tier: tenantContext.tenant.tier
      }
    });

  } catch (error) {
    console.error('Configuration retrieval error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve configuration'
    }, { status: 500 });
  }
}

/**
 * PATCH - Update tenant configuration
 */
export async function PATCH(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant context required'
      }, { status: 401 });
    }

    // Check admin permissions
    if (!checkTenantAdminRights(tenantContext, tenantContext.tenant.id)) {
      return NextResponse.json({
        success: false,
        error: 'Admin permissions required for configuration updates'
      }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate request body
    const validation = validateRequestBody(body, {
      section: { type: 'text', required: false },
      updates: { type: 'json', required: true }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors
      }, { status: 400 });
    }

    const { section, updates } = validation.sanitized;
    const configService = new TenantConfigurationService();
    await configService.initializeWithRequest(request);

    let result;

    switch (section) {
      case 'branding':
        result = await configService.updateTenantBranding(
          tenantContext.tenant.id,
          updates,
          tenantContext.user?.id
        );
        break;

      case 'feature_toggle':
        if (!updates.featureKey) {
          return NextResponse.json({
            success: false,
            error: 'featureKey is required for feature toggle updates'
          }, { status: 400 });
        }
        
        result = await configService.updateFeatureToggle(
          tenantContext.tenant.id,
          updates.featureKey,
          updates.enabled,
          updates.rolloutPercentage,
          tenantContext.user?.id
        );
        break;

      case 'github':
        result = await configService.updateIntegrationConfig(
          tenantContext.tenant.id,
          'github',
          updates,
          tenantContext.user?.id
        );
        break;

      case 'slack':
        result = await configService.updateIntegrationConfig(
          tenantContext.tenant.id,
          'slack',
          updates,
          tenantContext.user?.id
        );
        break;

      case 'jira':
        result = await configService.updateIntegrationConfig(
          tenantContext.tenant.id,
          'jira',
          updates,
          tenantContext.user?.id
        );
        break;

      case 'azure':
        result = await configService.updateIntegrationConfig(
          tenantContext.tenant.id,
          'azure',
          updates,
          tenantContext.user?.id
        );
        break;

      case 'aws':
        result = await configService.updateIntegrationConfig(
          tenantContext.tenant.id,
          'aws',
          updates,
          tenantContext.user?.id
        );
        break;

      default:
        // Full configuration update
        result = await configService.updateTenantConfiguration(
          tenantContext.tenant.id,
          updates,
          tenantContext.user?.id
        );
    }

    await configService.disconnect();

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        validationErrors: result.validationErrors
      }, { status: 400 });
    }

    const response: any = {
      success: true,
      updatedFields: result.updatedFields
    };

    if (result.requiresRestart) {
      response.requiresRestart = true;
      response.message = 'Configuration updated successfully. Portal restart may be required for some changes to take effect.';
    } else {
      response.message = 'Configuration updated successfully';
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Configuration update error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update configuration'
    }, { status: 500 });
  }
}

/**
 * POST - Import configuration or bulk operations
 */
export async function POST(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant context required'
      }, { status: 401 });
    }

    // Check admin permissions
    if (!checkTenantAdminRights(tenantContext, tenantContext.tenant.id)) {
      return NextResponse.json({
        success: false,
        error: 'Admin permissions required for configuration import'
      }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate request body
    const validation = validateRequestBody(body, {
      operation: { type: 'text', required: true, enum: ['import', 'validate', 'reset_section'] },
      data: { type: 'json', required: false },
      section: { type: 'text', required: false }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors
      }, { status: 400 });
    }

    const { operation, data, section } = validation.sanitized;
    const configService = new TenantConfigurationService();
    await configService.initializeWithRequest(request);

    let result;

    switch (operation) {
      case 'import':
        if (!data) {
          return NextResponse.json({
            success: false,
            error: 'Configuration data required for import'
          }, { status: 400 });
        }

        result = await configService.importConfiguration(
          tenantContext.tenant.id,
          data,
          tenantContext.user?.id
        );
        break;

      case 'validate':
        if (!data) {
          return NextResponse.json({
            success: false,
            error: 'Configuration data required for validation'
          }, { status: 400 });
        }

        result = await configService.importConfiguration(
          tenantContext.tenant.id,
          data,
          tenantContext.user?.id,
          true // validate only
        );
        break;

      case 'reset_section':
        if (!section) {
          return NextResponse.json({
            success: false,
            error: 'Section is required for reset operation'
          }, { status: 400 });
        }

        // Get default configuration and extract the section
        const defaultConfig = await configService.getTenantConfiguration('default');
        if (!defaultConfig) {
          return NextResponse.json({
            success: false,
            error: 'Failed to get default configuration'
          }, { status: 500 });
        }

        const sectionData = (defaultConfig as any)[section];
        result = await configService.updateTenantConfiguration(
          tenantContext.tenant.id,
          { [section]: sectionData },
          tenantContext.user?.id
        );
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown operation: ${operation}`
        }, { status: 400 });
    }

    await configService.disconnect();

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error,
        validationErrors: result.validationErrors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      operation,
      message: `Configuration ${operation} completed successfully`,
      requiresRestart: result.requiresRestart || false
    });

  } catch (error) {
    console.error('Configuration operation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to perform configuration operation'
    }, { status: 500 });
  }
}

/**
 * DELETE - Reset configuration to defaults
 */
export async function DELETE(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Tenant context required'
      }, { status: 401 });
    }

    // Check admin permissions
    if (!checkTenantAdminRights(tenantContext, tenantContext.tenant.id)) {
      return NextResponse.json({
        success: false,
        error: 'Admin permissions required for configuration reset'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const confirmReset = searchParams.get('confirm') === 'true';
    const section = searchParams.get('section');

    if (!confirmReset) {
      return NextResponse.json({
        success: false,
        error: 'Configuration reset requires confirmation'
      }, { status: 400 });
    }

    const configService = new TenantConfigurationService();
    await configService.initializeWithRequest(request);

    // Get default configuration
    const defaultConfig = await configService['getDefaultConfiguration'](tenantContext.tenant.id);
    
    let updateData;
    if (section) {
      // Reset specific section
      updateData = { [section]: (defaultConfig as any)[section] };
    } else {
      // Reset entire configuration
      updateData = defaultConfig;
    }

    const result = await configService.updateTenantConfiguration(
      tenantContext.tenant.id,
      updateData,
      tenantContext.user?.id
    );

    await configService.disconnect();

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: section ? `${section} configuration reset to defaults` : 'Configuration reset to defaults',
      requiresRestart: result.requiresRestart || true
    });

  } catch (error) {
    console.error('Configuration reset error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to reset configuration'
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}