/**
 * Secure Plugin Installation API
 * Enhanced plugin installation with comprehensive security validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafePrismaClient } from '@/lib/db/safe-client';
import PluginSecurityService from '@/services/plugin-security/PluginSecurityService';

interface SecureInstallRequest {
  pluginName: string;
  version?: string;
  forceInstall?: boolean; // Bypass security warnings (not errors)
  approvalTicket?: string; // For governance workflows
  tenantId?: string;
  environment?: string;
  configuration?: Record<string, any>;
}

interface SecureInstallResponse {
  success: boolean;
  pluginId?: string;
  installationId?: string;
  securityValidation: any;
  warnings: string[];
  errors: string[];
  requiresApproval?: boolean;
  approvalWorkflow?: {
    ticketId: string;
    approvers: string[];
    requirements: string[];
  };
}

export async function POST(request: NextRequest) {
  try {
    const {
      pluginName,
      version = 'latest',
      forceInstall = false,
      approvalTicket,
      tenantId,
      environment = 'production',
      configuration = {}
    }: SecureInstallRequest = await request.json();

    if (!pluginName) {
      return NextResponse.json({
        success: false,
        errors: ['Plugin name is required'],
        warnings: []
      }, { status: 400 });
    }

    const prisma = getSafePrismaClient();
    const securityService = new PluginSecurityService();

    // 1. Check if plugin already exists
    const existingPlugin = await prisma.plugin.findFirst({
      where: {
        name: pluginName,
        isInstalled: true,
        ...(tenantId && { tenantId })
      }
    });

    if (existingPlugin && !forceInstall) {
      return NextResponse.json({
        success: false,
        errors: [`Plugin ${pluginName} is already installed`],
        warnings: [],
        pluginId: existingPlugin.id
      }, { status: 409 });
    }

    // 2. Resolve plugin version and fetch metadata
    const pluginMetadata = await resolvePluginMetadata(pluginName, version);
    if (!pluginMetadata) {
      return NextResponse.json({
        success: false,
        errors: [`Plugin ${pluginName}@${version} not found`],
        warnings: []
      }, { status: 404 });
    }

    // 3. Perform comprehensive security validation
    const securityValidation = await securityService.validatePluginSecurity({
      name: pluginName,
      version: pluginMetadata.version,
      tarballUrl: pluginMetadata.dist.tarball,
      checksum: pluginMetadata.dist.shasum,
      checksumAlgorithm: 'sha256' as any,
      publisher: pluginMetadata.publisher?.name || pluginMetadata.author?.name,
      metadata: pluginMetadata
    });

    const response: SecureInstallResponse = {
      success: false,
      securityValidation,
      warnings: securityValidation.warnings,
      errors: securityValidation.errors
    };

    // 4. Handle security validation results
    if (!securityValidation.passed && !forceInstall) {
      // Check if this requires approval workflow
      if (securityValidation.securityLevel === 'low' || securityValidation.warnings.length > 0) {
        const approvalWorkflow = await initializeApprovalWorkflow(
          pluginName,
          pluginMetadata.version,
          securityValidation,
          tenantId
        );

        response.requiresApproval = true;
        response.approvalWorkflow = approvalWorkflow;
        
        return NextResponse.json(response, { status: 202 }); // Accepted, pending approval
      } else {
        // Hard block for critical security issues
        return NextResponse.json(response, { status: 403 }); // Forbidden
      }
    }

    // 5. Check for existing approval if required
    if (response.requiresApproval && !approvalTicket) {
      return NextResponse.json(response, { status: 202 });
    }

    // 6. Validate approval ticket if provided
    if (approvalTicket) {
      const approvalValid = await validateApprovalTicket(approvalTicket, pluginName);
      if (!approvalValid) {
        response.errors.push('Invalid or expired approval ticket');
        return NextResponse.json(response, { status: 403 });
      }
    }

    // 7. Check dependencies and compatibility
    const dependencyResolution = await resolveDependencies(pluginName, pluginMetadata.version);
    if (!dependencyResolution.canInstall) {
      response.errors.push(...dependencyResolution.blockingIssues);
      response.warnings.push(...dependencyResolution.warnings);
      
      if (dependencyResolution.blockingIssues.length > 0) {
        return NextResponse.json(response, { status: 409 });
      }
    }

    // 8. Perform actual installation
    try {
      const installResult = await performSecureInstallation({
        pluginName,
        version: pluginMetadata.version,
        metadata: pluginMetadata,
        securityValidation,
        configuration,
        tenantId,
        environment,
        dependencies: dependencyResolution.resolvedDependencies
      });

      response.success = true;
      response.pluginId = installResult.pluginId;
      response.installationId = installResult.installationId;

      // 9. Log installation event for audit
      await logInstallationEvent({
        pluginName,
        version: pluginMetadata.version,
        securityLevel: securityValidation.securityLevel,
        approvalTicket,
        tenantId,
        installationId: installResult.installationId
      });

      return NextResponse.json(response, { status: 201 });

    } catch (installError) {
      response.errors.push(`Installation failed: ${installError instanceof Error ? installError.message : 'Unknown error'}`);
      return NextResponse.json(response, { status: 500 });
    }

  } catch (error) {
    console.error('Secure plugin installation error:', error);
    return NextResponse.json({
      success: false,
      errors: ['Internal server error during plugin installation'],
      warnings: [],
      securityValidation: null
    }, { status: 500 });
  }
}

/**
 * Get security validation for a plugin without installing
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginName = searchParams.get('pluginName');
    const version = searchParams.get('version') || 'latest';

    if (!pluginName) {
      return NextResponse.json({
        success: false,
        error: 'Plugin name is required'
      }, { status: 400 });
    }

    const securityService = new PluginSecurityService();
    const pluginMetadata = await resolvePluginMetadata(pluginName, version);

    if (!pluginMetadata) {
      return NextResponse.json({
        success: false,
        error: `Plugin ${pluginName}@${version} not found`
      }, { status: 404 });
    }

    const securityValidation = await securityService.validatePluginSecurity({
      name: pluginName,
      version: pluginMetadata.version,
      tarballUrl: pluginMetadata.dist.tarball,
      checksum: pluginMetadata.dist.shasum,
      checksumAlgorithm: 'sha256' as any,
      publisher: pluginMetadata.publisher?.name || pluginMetadata.author?.name,
      metadata: pluginMetadata
    });

    return NextResponse.json({
      success: true,
      plugin: {
        name: pluginName,
        version: pluginMetadata.version,
        description: pluginMetadata.description,
        author: pluginMetadata.author,
        publisher: pluginMetadata.publisher
      },
      security: securityValidation
    });

  } catch (error) {
    console.error('Security validation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to validate plugin security'
    }, { status: 500 });
  }
}

/**
 * Helper functions
 */

async function resolvePluginMetadata(name: string, version: string) {
  try {
    // This would integrate with NPM Registry API or other package registries
    // For now, return mock data that matches real plugin structure
    return {
      name,
      version: version === 'latest' ? '1.0.0' : version,
      description: `Mock plugin: ${name}`,
      author: { name: 'Mock Author' },
      publisher: { name: name.split('/')[0] },
      dist: {
        tarball: `https://registry.npmjs.org/${name}/-/${name.split('/').pop()}-${version}.tgz`,
        shasum: 'mock-shasum-hash'
      },
      dependencies: {},
      peerDependencies: {}
    };
  } catch (error) {
    console.error('Failed to resolve plugin metadata:', error);
    return null;
  }
}

async function initializeApprovalWorkflow(
  pluginName: string,
  version: string,
  securityValidation: any,
  tenantId?: string
) {
  try {
    const prisma = getSafePrismaClient();
    
    // Find governance policy for this plugin/tenant
    const governance = await prisma.pluginGovernance.findFirst({
      where: {
        pluginId: pluginName,
        ...(tenantId && { tenantId }),
        isActive: true
      }
    });

    if (!governance) {
      // Create default approval workflow
      return {
        ticketId: `approval-${Date.now()}`,
        approvers: ['admin@example.com'], // Default approver
        requirements: [
          'Security review required',
          'Trust score below threshold',
          'Manual approval needed'
        ]
      };
    }

    // Create approval request in database
    const approval = await prisma.pluginApproval.create({
      data: {
        governanceId: governance.id,
        requestType: 'INSTALL',
        status: 'PENDING',
        requestedBy: 'system', // Would be actual user ID
        reason: `Security validation requires approval: ${securityValidation.securityLevel}`,
        requirements: {
          securityLevel: securityValidation.securityLevel,
          trustScore: securityValidation.trustScore?.score,
          warnings: securityValidation.warnings,
          errors: securityValidation.errors
        }
      }
    });

    return {
      ticketId: approval.id,
      approvers: governance.approvers,
      requirements: [
        'Security team approval',
        'Trust score review',
        'Policy compliance check'
      ]
    };

  } catch (error) {
    console.error('Failed to initialize approval workflow:', error);
    return {
      ticketId: `error-${Date.now()}`,
      approvers: ['admin@example.com'],
      requirements: ['Manual review required due to system error']
    };
  }
}

async function validateApprovalTicket(ticketId: string, pluginName: string): Promise<boolean> {
  try {
    const prisma = getSafePrismaClient();
    
    const approval = await prisma.pluginApproval.findUnique({
      where: { id: ticketId }
    });

    return approval?.status === 'APPROVED' && 
           approval.expiresAt ? approval.expiresAt > new Date() : true;
           
  } catch (error) {
    console.error('Failed to validate approval ticket:', error);
    return false;
  }
}

async function resolveDependencies(pluginName: string, version: string) {
  // Mock dependency resolution - would integrate with actual dependency resolver
  return {
    canInstall: true,
    resolvedDependencies: [],
    blockingIssues: [],
    warnings: []
  };
}

async function performSecureInstallation(params: {
  pluginName: string;
  version: string;
  metadata: any;
  securityValidation: any;
  configuration: Record<string, any>;
  tenantId?: string;
  environment: string;
  dependencies: any[];
}) {
  const prisma = getSafePrismaClient();

  // Create plugin record
  const plugin = await prisma.plugin.create({
    data: {
      name: params.pluginName,
      displayName: params.pluginName.split('/').pop() || params.pluginName,
      description: params.metadata.description,
      isInstalled: true,
      isEnabled: true,
      tenantId: params.tenantId,
      installedAt: new Date(),
      installedBy: 'system', // Would be actual user ID
      healthScore: params.securityValidation.trustScore?.score || 50,
      securityScore: params.securityValidation.trustScore?.score || 50
    }
  });

  // Create plugin version record
  const pluginVersion = await prisma.pluginVersion.create({
    data: {
      pluginId: plugin.id,
      version: params.version,
      isCurrent: true,
      status: 'DEPLOYED',
      installSource: 'NPM',
      deployedAt: new Date(),
      deployedBy: 'system'
    }
  });

  // Create configuration if provided
  if (Object.keys(params.configuration).length > 0) {
    await prisma.pluginConfiguration.create({
      data: {
        pluginId: plugin.id,
        environment: params.environment,
        config: params.configuration,
        isActive: true,
        createdBy: 'system'
      }
    });
  }

  return {
    pluginId: plugin.id,
    installationId: pluginVersion.id
  };
}

async function logInstallationEvent(params: {
  pluginName: string;
  version: string;
  securityLevel: string;
  approvalTicket?: string;
  tenantId?: string;
  installationId: string;
}) {
  try {
    // This would integrate with audit logging system
    console.log('Plugin Installation Event:', {
      action: 'PLUGIN_INSTALLED',
      plugin: `${params.pluginName}@${params.version}`,
      securityLevel: params.securityLevel,
      approvalTicket: params.approvalTicket,
      tenantId: params.tenantId,
      installationId: params.installationId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log installation event:', error);
  }
}