/**
 * Plugin Installation API
 * Handles bulk plugin installation and configuration from marketplace wizard
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateRequestBody } from '@/lib/security/input-validation';
import { getTenantContext } from '@/lib/tenancy/TenantContext';
import { checkTenantAdminRights } from '@/lib/permissions/SystemPermissions';
import { createAuditLog } from '@/lib/audit/AuditService';

interface PluginInstallRequest {
  id: string;
  version: string;
  config?: Record<string, any>;
}

interface InstallationResult {
  pluginId: string;
  success: boolean;
  error?: string;
  warnings?: string[];
  configurationRequired?: boolean;
  nextSteps?: string[];
}

/**
 * POST - Install selected plugins from marketplace wizard
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
        error: 'Admin permissions required for plugin installation'
      }, { status: 403 });
    }

    const body = await request.json();
    
    const validation = validateRequestBody(body, {
      plugins: { type: 'array', required: true }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors
      }, { status: 400 });
    }

    const { plugins } = validation.sanitized;

    // Validate each plugin in the array
    const pluginValidation = plugins.every((plugin: any) => {
      return plugin.id && typeof plugin.id === 'string' &&
             plugin.version && typeof plugin.version === 'string';
    });

    if (!pluginValidation) {
      return NextResponse.json({
        success: false,
        error: 'Invalid plugin data format'
      }, { status: 400 });
    }

    // Process plugin installations
    const results = await installPlugins(tenantContext.tenant.id, plugins);

    // Create audit log for bulk installation
    await createAuditLog({
      tenantId: tenantContext.tenant.id,
      action: 'plugins:bulk_install',
      resource: 'plugin_installation',
      resourceId: `bulk-${Date.now()}`,
      metadata: {
        pluginCount: plugins.length,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        pluginIds: plugins.map((p: any) => p.id)
      }
    });

    const hasFailures = results.some(r => !r.success);
    const successCount = results.filter(r => r.success).length;

    return NextResponse.json({
      success: !hasFailures || successCount > 0,
      data: {
        results,
        summary: {
          total: plugins.length,
          successful: successCount,
          failed: results.filter(r => !r.success).length,
          requireConfiguration: results.filter(r => r.configurationRequired).length
        },
        nextSteps: generateNextSteps(results)
      },
      message: hasFailures 
        ? `${successCount}/${plugins.length} plugins installed successfully`
        : 'All plugins installed successfully'
    });

  } catch (error) {
    console.error('Plugin installation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to install plugins'
    }, { status: 500 });
  }
}

/**
 * Install multiple plugins with their configurations
 */
async function installPlugins(tenantId: string, plugins: PluginInstallRequest[]): Promise<InstallationResult[]> {
  const results: InstallationResult[] = [];

  for (const plugin of plugins) {
    try {
      const result = await installSinglePlugin(tenantId, plugin);
      results.push(result);
    } catch (error) {
      results.push({
        pluginId: plugin.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown installation error'
      });
    }
  }

  return results;
}

/**
 * Install a single plugin with configuration
 */
async function installSinglePlugin(tenantId: string, plugin: PluginInstallRequest): Promise<InstallationResult> {
  // Get plugin metadata
  const pluginMetadata = await getPluginMetadata(plugin.id);
  if (!pluginMetadata) {
    return {
      pluginId: plugin.id,
      success: false,
      error: 'Plugin not found in registry'
    };
  }

  // Validate version compatibility
  const compatibilityCheck = await checkCompatibility(pluginMetadata, plugin.version);
  if (!compatibilityCheck.compatible) {
    return {
      pluginId: plugin.id,
      success: false,
      error: `Compatibility issue: ${compatibilityCheck.reason}`,
      warnings: compatibilityCheck.warnings
    };
  }

  // Check dependencies
  const dependencyCheck = await checkDependencies(pluginMetadata);
  if (!dependencyCheck.satisfied) {
    return {
      pluginId: plugin.id,
      success: false,
      error: `Missing dependencies: ${dependencyCheck.missing.join(', ')}`,
      nextSteps: [`Install dependencies: ${dependencyCheck.missing.join(', ')}`]
    };
  }

  // Perform the installation
  const installationResult = await performInstallation(tenantId, plugin, pluginMetadata);
  if (!installationResult.success) {
    return {
      pluginId: plugin.id,
      success: false,
      error: installationResult.error
    };
  }

  // Configure the plugin if configuration provided
  let configurationResult = { success: true, warnings: [] as string[] };
  if (plugin.config && Object.keys(plugin.config).length > 0) {
    configurationResult = await configurePlugin(tenantId, plugin.id, plugin.config);
  }

  // Generate next steps
  const nextSteps = generatePluginNextSteps(pluginMetadata, plugin.config);

  return {
    pluginId: plugin.id,
    success: true,
    warnings: [
      ...compatibilityCheck.warnings || [],
      ...configurationResult.warnings
    ],
    configurationRequired: !plugin.config && pluginMetadata.configurationRequired,
    nextSteps
  };
}

/**
 * Get plugin metadata from registry
 */
async function getPluginMetadata(pluginId: string) {
  // Mock implementation - in real scenario, fetch from plugin registry
  const mockPlugins: Record<string, any> = {
    'catalog-backend': {
      id: 'catalog-backend',
      name: 'Software Catalog Backend',
      version: '1.12.0',
      category: 'catalog',
      configurationRequired: true,
      dependencies: ['@backstage/backend-common', '@backstage/catalog-model'],
      compatibility: {
        backstageVersion: '^1.20.0',
        nodeVersion: '>=18.0.0'
      },
      installation: {
        type: 'backend',
        packageName: '@backstage/plugin-catalog-backend',
        configSchema: {
          database: { required: true, type: 'string' },
          integrations: { required: false, type: 'array' }
        }
      }
    },
    'kubernetes': {
      id: 'kubernetes',
      name: 'Kubernetes Plugin',
      version: '0.11.5',
      category: 'kubernetes',
      configurationRequired: true,
      dependencies: ['@kubernetes/client-node'],
      compatibility: {
        backstageVersion: '^1.20.0',
        nodeVersion: '>=18.0.0'
      },
      installation: {
        type: 'frontend',
        packageName: '@backstage/plugin-kubernetes',
        configSchema: {
          clusters: { required: true, type: 'array' },
          authProvider: { required: true, type: 'string' }
        }
      }
    },
    'techdocs-backend': {
      id: 'techdocs-backend',
      name: 'TechDocs Backend',
      version: '1.8.0',
      category: 'techdocs',
      configurationRequired: true,
      dependencies: ['@backstage/techdocs-common'],
      compatibility: {
        backstageVersion: '^1.20.0',
        nodeVersion: '>=18.0.0'
      },
      installation: {
        type: 'backend',
        packageName: '@backstage/plugin-techdocs-backend',
        configSchema: {
          generator: { required: true, type: 'string' },
          publisher: { required: true, type: 'string' }
        }
      }
    }
  };

  return mockPlugins[pluginId] || null;
}

/**
 * Check plugin compatibility
 */
async function checkCompatibility(pluginMetadata: any, requestedVersion: string) {
  const warnings = [];
  
  // Check Backstage version compatibility
  const backstageVersion = '1.20.0'; // Mock current version
  if (!isVersionCompatible(backstageVersion, pluginMetadata.compatibility.backstageVersion)) {
    return {
      compatible: false,
      reason: `Requires Backstage ${pluginMetadata.compatibility.backstageVersion}, current: ${backstageVersion}`,
      warnings
    };
  }

  // Check Node.js version compatibility
  const nodeVersion = process.version;
  if (!isVersionCompatible(nodeVersion, pluginMetadata.compatibility.nodeVersion)) {
    warnings.push(`Plugin recommends Node.js ${pluginMetadata.compatibility.nodeVersion}, current: ${nodeVersion}`);
  }

  // Check requested version availability
  if (requestedVersion !== pluginMetadata.version) {
    warnings.push(`Requested version ${requestedVersion} differs from latest ${pluginMetadata.version}`);
  }

  return {
    compatible: true,
    warnings
  };
}

/**
 * Check plugin dependencies
 */
async function checkDependencies(pluginMetadata: any) {
  // Mock dependency check - in real implementation, check against installed packages
  const installedPackages = [
    '@backstage/backend-common',
    '@backstage/catalog-model',
    '@backstage/techdocs-common'
  ];

  const missing = pluginMetadata.dependencies.filter((dep: string) => 
    !installedPackages.includes(dep)
  );

  return {
    satisfied: missing.length === 0,
    missing
  };
}

/**
 * Perform the actual plugin installation
 */
async function performInstallation(tenantId: string, plugin: PluginInstallRequest, metadata: any) {
  try {
    // Mock installation process
    // In real implementation:
    // 1. Download plugin package
    // 2. Verify signature/checksum
    // 3. Install dependencies
    // 4. Register plugin with system
    // 5. Update plugin registry

    // Simulate installation time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Mock successful installation
    const installationRecord = {
      tenantId,
      pluginId: plugin.id,
      version: plugin.version,
      installedAt: new Date(),
      status: 'INSTALLED',
      packageName: metadata.installation.packageName,
      type: metadata.installation.type
    };

    // In real implementation, save to database
    console.log('Plugin installed:', installationRecord);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Installation failed'
    };
  }
}

/**
 * Configure plugin with provided settings
 */
async function configurePlugin(tenantId: string, pluginId: string, config: Record<string, any>) {
  try {
    const warnings = [];

    // Validate configuration against schema
    const pluginMetadata = await getPluginMetadata(pluginId);
    if (pluginMetadata?.installation?.configSchema) {
      const schema = pluginMetadata.installation.configSchema;
      
      for (const [key, schemaField] of Object.entries(schema)) {
        const field = schemaField as any;
        if (field.required && !config[key]) {
          warnings.push(`Required configuration field '${key}' is missing`);
        }
      }
    }

    // Save configuration
    const configRecord = {
      tenantId,
      pluginId,
      configuration: config,
      configuredAt: new Date()
    };

    // In real implementation, save to database
    console.log('Plugin configured:', configRecord);

    return { success: true, warnings };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Configuration failed',
      warnings: []
    };
  }
}

/**
 * Generate next steps for a specific plugin
 */
function generatePluginNextSteps(metadata: any, config?: Record<string, any>): string[] {
  const steps = [];

  switch (metadata.category) {
    case 'catalog':
      steps.push('Configure catalog integrations in app-config.yaml');
      steps.push('Set up entity discovery rules');
      if (!config?.database) {
        steps.push('Configure database connection for catalog storage');
      }
      break;

    case 'kubernetes':
      steps.push('Configure kubectl access to your clusters');
      steps.push('Set up cluster authentication in app-config.yaml');
      if (!config?.clusters) {
        steps.push('Add cluster configurations to access Kubernetes resources');
      }
      break;

    case 'techdocs':
      steps.push('Configure documentation generator (MkDocs)');
      steps.push('Set up documentation publisher (S3, GCS, etc.)');
      if (!config?.generator) {
        steps.push('Choose and configure documentation generator');
      }
      break;

    case 'cicd':
      steps.push('Configure CI/CD system integration');
      steps.push('Set up authentication tokens');
      break;

    default:
      steps.push(`Configure ${metadata.name} in app-config.yaml`);
      steps.push('Restart the application to load the plugin');
  }

  steps.push('Visit the plugin documentation for advanced configuration');
  return steps;
}

/**
 * Generate overall next steps for bulk installation
 */
function generateNextSteps(results: InstallationResult[]): string[] {
  const steps = [];
  const successful = results.filter(r => r.success);
  const requireConfig = results.filter(r => r.configurationRequired);

  if (successful.length > 0) {
    steps.push('Restart your Backstage application to load installed plugins');
  }

  if (requireConfig.length > 0) {
    steps.push(`Complete configuration for ${requireConfig.length} plugins in the Plugin Management dashboard`);
  }

  steps.push('Review plugin documentation for advanced features');
  steps.push('Configure authentication and permissions as needed');
  steps.push('Set up monitoring and health checks for new plugins');

  return steps;
}

/**
 * Helper function to check version compatibility
 */
function isVersionCompatible(currentVersion: string, requiredVersion: string): boolean {
  // Simple version check - in real implementation, use semver library
  const current = currentVersion.replace(/[^0-9.]/g, '');
  const required = requiredVersion.replace(/[^0-9.>=<]/g, '');
  
  // For this mock, just check if versions contain compatible numbers
  return current.includes(required.split('.')[0]) || 
         required.includes('>=') || 
         required.includes('^');
}

/**
 * GET - Get installation status and available plugins
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
    const type = searchParams.get('type') || 'status';

    switch (type) {
      case 'status':
        // Return installation status
        return NextResponse.json({
          success: true,
          data: {
            installedPlugins: [], // Mock data
            pendingInstallations: [],
            availableUpdates: []
          }
        });

      case 'marketplace':
        // Return marketplace data
        return NextResponse.json({
          success: true,
          data: {
            categories: [
              { id: 'catalog', name: 'Software Catalog', count: 15 },
              { id: 'kubernetes', name: 'Kubernetes', count: 8 },
              { id: 'techdocs', name: 'Tech Docs', count: 12 },
              { id: 'cicd', name: 'CI/CD', count: 20 },
              { id: 'monitoring', name: 'Monitoring', count: 10 },
              { id: 'security', name: 'Security', count: 6 }
            ],
            featured: [
              'catalog-backend',
              'kubernetes',
              'techdocs-backend',
              'github-actions',
              'prometheus'
            ],
            trending: [
              'scaffolder-backend',
              'sonarqube',
              'vault',
              'jenkins'
            ]
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Unknown request type'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Plugin installation API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process request'
    }, { status: 500 });
  }
}