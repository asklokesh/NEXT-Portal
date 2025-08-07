// Plugin Compatibility Check API
// Validates plugin compatibility with current environment and dependencies

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getEnhancedPluginRegistry } from '@/services/backstage/enhanced-plugin-registry';

const CompatibilityRequestSchema = z.object({
  environment: z.object({
    backstageVersion: z.string().optional(),
    nodeVersion: z.string().optional(),
    npmVersion: z.string().optional(),
    platform: z.string().optional(),
    arch: z.string().optional()
  }).optional(),
  currentPlugins: z.array(z.object({
    name: z.string(),
    version: z.string()
  })).optional(),
  checkDependencies: z.boolean().default(true),
  checkSecurity: z.boolean().default(true),
  checkPerformance: z.boolean().default(false)
});

// POST /api/plugins/registry/[pluginId]/compatibility - Check plugin compatibility
export async function POST(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const { pluginId } = params;
    const body = await request.json();
    const validatedRequest = CompatibilityRequestSchema.parse(body);

    const registry = getEnhancedPluginRegistry();
    
    // Find the plugin
    const plugins = await registry.discoverPlugins({ search: pluginId });
    const plugin = plugins.find(p => 
      p.id === pluginId || 
      p.name === pluginId ||
      p.name.includes(pluginId)
    );
    
    if (!plugin) {
      return NextResponse.json({
        success: false,
        error: `Plugin '${pluginId}' not found`
      }, { status: 404 });
    }

    // Prepare environment for compatibility check
    const environment = {
      backstageVersion: validatedRequest.environment?.backstageVersion || process.env.BACKSTAGE_VERSION || '1.20.0',
      nodeVersion: validatedRequest.environment?.nodeVersion || process.version,
      npmVersion: validatedRequest.environment?.npmVersion || process.env.NPM_VERSION || '9.0.0',
      platform: validatedRequest.environment?.platform || process.platform,
      arch: validatedRequest.environment?.arch || process.arch
    };

    // Perform comprehensive compatibility check
    const compatibilityCheck = await registry.validateCompatibility(plugin, environment);

    // Additional checks based on request options
    const additionalChecks: any = {};

    if (validatedRequest.checkSecurity) {
      additionalChecks.security = await performSecurityCheck(plugin);
    }

    if (validatedRequest.checkPerformance) {
      additionalChecks.performance = await performPerformanceCheck(plugin);
    }

    if (validatedRequest.currentPlugins?.length) {
      additionalChecks.conflicts = await checkPluginConflicts(plugin, validatedRequest.currentPlugins);
    }

    // Calculate overall compatibility score
    const overallScore = calculateCompatibilityScore(compatibilityCheck, additionalChecks);

    return NextResponse.json({
      success: true,
      data: {
        plugin: {
          id: plugin.id,
          name: plugin.name,
          version: plugin.version
        },
        environment,
        compatibility: compatibilityCheck,
        additionalChecks,
        overallScore,
        recommendation: getRecommendation(overallScore, compatibilityCheck),
        checkedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`Compatibility check error for ${params.pluginId}:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check compatibility'
    }, { status: 500 });
  }
}

// GET /api/plugins/registry/[pluginId]/compatibility - Get quick compatibility status
export async function GET(
  request: NextRequest,
  { params }: { params: { pluginId: string } }
) {
  try {
    const { pluginId } = params;
    const { searchParams } = new URL(request.url);
    
    const registry = getEnhancedPluginRegistry();
    
    // Find the plugin
    const plugins = await registry.discoverPlugins({ search: pluginId });
    const plugin = plugins.find(p => 
      p.id === pluginId || 
      p.name === pluginId ||
      p.name.includes(pluginId)
    );
    
    if (!plugin) {
      return NextResponse.json({
        success: false,
        error: `Plugin '${pluginId}' not found`
      }, { status: 404 });
    }

    // Quick compatibility check with current environment
    const environment = {
      backstageVersion: process.env.BACKSTAGE_VERSION || '1.20.0',
      nodeVersion: process.version,
      npmVersion: process.env.NPM_VERSION || '9.0.0'
    };

    const compatibilityCheck = await registry.validateCompatibility(plugin, environment);

    // Simplified response for quick checks
    return NextResponse.json({
      success: true,
      data: {
        compatible: compatibilityCheck.compatible,
        issues: compatibilityCheck.issues.filter(issue => issue.severity === 'error'),
        warnings: compatibilityCheck.issues.filter(issue => issue.severity === 'warning'),
        score: compatibilityCheck.compatible ? 1 : 0,
        summary: compatibilityCheck.compatible 
          ? 'Plugin is compatible with current environment'
          : `Plugin has ${compatibilityCheck.issues.filter(i => i.severity === 'error').length} compatibility issues`,
        checkedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`Quick compatibility check error for ${params.pluginId}:`, error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check compatibility'
    }, { status: 500 });
  }
}

// Helper functions for additional checks

async function performSecurityCheck(plugin: any): Promise<any> {
  // Simulate security check
  const securityIssues = [];
  
  if (plugin.security?.vulnerabilities && plugin.security.vulnerabilities > 0) {
    securityIssues.push({
      type: 'vulnerability',
      severity: plugin.security.vulnerabilities > 5 ? 'high' : 'medium',
      count: plugin.security.vulnerabilities,
      message: `Plugin has ${plugin.security.vulnerabilities} known vulnerabilities`
    });
  }

  if (!plugin.security?.trusted) {
    securityIssues.push({
      type: 'trust',
      severity: 'low',
      message: 'Plugin is not from a verified source'
    });
  }

  return {
    issues: securityIssues,
    score: securityIssues.length === 0 ? 1 : Math.max(0, 1 - (securityIssues.length * 0.2)),
    recommendation: securityIssues.length === 0 ? 'Security check passed' : 'Review security issues before installation'
  };
}

async function performPerformanceCheck(plugin: any): Promise<any> {
  // Simulate performance analysis
  const performanceMetrics = {
    estimatedMemoryUsage: Math.random() * 100, // MB
    estimatedCpuImpact: Math.random() * 10, // %
    bundleSize: Math.random() * 5, // MB
    loadTime: Math.random() * 2000 // ms
  };

  const issues = [];
  
  if (performanceMetrics.estimatedMemoryUsage > 50) {
    issues.push({
      type: 'memory',
      severity: 'medium',
      message: `Plugin may use significant memory (~${Math.round(performanceMetrics.estimatedMemoryUsage)}MB)`
    });
  }

  if (performanceMetrics.bundleSize > 2) {
    issues.push({
      type: 'bundle-size',
      severity: 'low',
      message: `Large bundle size (~${Math.round(performanceMetrics.bundleSize)}MB)`
    });
  }

  return {
    metrics: performanceMetrics,
    issues,
    score: Math.max(0, 1 - (issues.length * 0.1)),
    recommendation: issues.length === 0 ? 'Good performance characteristics' : 'Monitor resource usage after installation'
  };
}

async function checkPluginConflicts(plugin: any, currentPlugins: Array<{name: string, version: string}>): Promise<any> {
  const conflicts = [];
  
  // Check for naming conflicts
  const nameConflict = currentPlugins.find(p => 
    p.name === plugin.name || 
    p.name.includes(plugin.id) || 
    plugin.name.includes(p.name.replace('@backstage/plugin-', ''))
  );
  
  if (nameConflict) {
    conflicts.push({
      type: 'name-conflict',
      severity: 'high',
      conflictsWith: nameConflict.name,
      message: `Plugin name conflicts with existing plugin ${nameConflict.name}`
    });
  }

  // Check for dependency conflicts (simplified)
  if (plugin.dependencies) {
    for (const dep of plugin.dependencies) {
      const existingPlugin = currentPlugins.find(p => p.name === dep);
      if (existingPlugin) {
        // In a real implementation, you'd check version compatibility
        conflicts.push({
          type: 'dependency-conflict',
          severity: 'medium',
          conflictsWith: existingPlugin.name,
          message: `Potential dependency conflict with ${dep}`
        });
      }
    }
  }

  return {
    conflicts,
    score: conflicts.length === 0 ? 1 : Math.max(0, 1 - (conflicts.length * 0.3)),
    recommendation: conflicts.length === 0 ? 'No conflicts detected' : 'Review conflicts before installation'
  };
}

function calculateCompatibilityScore(compatibilityCheck: any, additionalChecks: any): number {
  let score = compatibilityCheck.compatible ? 0.6 : 0;
  
  if (additionalChecks.security) {
    score += additionalChecks.security.score * 0.2;
  }
  
  if (additionalChecks.performance) {
    score += additionalChecks.performance.score * 0.1;
  }
  
  if (additionalChecks.conflicts) {
    score += additionalChecks.conflicts.score * 0.1;
  }
  
  return Math.min(score, 1);
}

function getRecommendation(score: number, compatibilityCheck: any): string {
  if (score >= 0.9) {
    return 'Highly recommended - excellent compatibility';
  } else if (score >= 0.7) {
    return 'Recommended - good compatibility with minor considerations';
  } else if (score >= 0.5) {
    return 'Proceed with caution - review compatibility issues';
  } else if (compatibilityCheck.compatible) {
    return 'Compatible but has significant considerations';
  } else {
    return 'Not recommended - major compatibility issues';
  }
}