/**
 * Plugin Resolution API Route
 * 
 * Handles comprehensive plugin dependency resolution with conflict resolution,
 * version management, and installation planning.
 */

import { NextRequest, NextResponse } from 'next/server';
import { DependencyResolver } from '@/lib/plugins/DependencyResolver';
import { CompatibilityChecker } from '@/lib/plugins/CompatibilityChecker';
import { VersionManager } from '@/lib/plugins/VersionManager';
import { 
  Plugin, 
  ResolutionStrategy, 
  ApiResponse, 
  ResolutionResult,
  UpgradeAnalysis,
  CompatibilityReport
} from '@/lib/plugins/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      plugins, 
      targetPlugins = [], 
      options = {},
      systemInfo 
    } = body;

    if (!Array.isArray(plugins)) {
      const errorResponse: ApiResponse = {
        success: false,
        error: 'Invalid plugins data - expected array',
        timestamp: new Date().toISOString()
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const {
      strategy = 'strict' as ResolutionStrategy,
      skipOptional = false,
      checkCompatibility = true,
      planUpgrades = false,
      autoInstall = false
    } = options;

    // Initialize resolvers and checkers
    const resolver = new DependencyResolver(plugins, strategy);
    const compatibilityChecker = new CompatibilityChecker(systemInfo);
    const versionManager = new VersionManager();

    // Step 1: Resolve dependencies
    console.log('Resolving dependencies...');
    const resolutionResult = await resolver.resolveDependencies(
      targetPlugins.length > 0 ? targetPlugins : undefined,
      { strategy, skipOptional, autoInstall }
    );

    // Step 2: Check compatibility if requested
    let compatibilityReports: CompatibilityReport[] = [];
    if (checkCompatibility) {
      console.log('Checking plugin compatibility...');
      const pluginsToCheck = targetPlugins.length > 0 
        ? plugins.filter(p => targetPlugins.includes(p.id))
        : plugins;
      
      compatibilityReports = await compatibilityChecker.checkMultiplePlugins(pluginsToCheck);
    }

    // Step 3: Plan upgrades if requested
    let upgradeAnalyses: UpgradeAnalysis[] = [];
    if (planUpgrades) {
      console.log('Planning upgrades...');
      for (const plugin of plugins) {
        if (plugin.version && targetPlugins.includes(plugin.id)) {
          // For demo, assume we want to upgrade to latest version
          const latestVersion = versionManager.getNextVersion(plugin.version, 'minor');
          try {
            const analysis = await versionManager.planUpgradePath(
              plugin.id,
              plugin.version,
              latestVersion
            );
            upgradeAnalyses.push(analysis);
          } catch (error) {
            console.warn(`Failed to plan upgrade for ${plugin.id}:`, error);
          }
        }
      }
    }

    // Step 4: Generate installation plan
    const installationPlan = {
      canProceed: resolutionResult.resolved && 
                 compatibilityReports.every(r => r.compatible || 
                   r.issues.every(i => i.severity !== 'critical')),
      totalPlugins: resolutionResult.installationOrder.length,
      estimatedTime: calculateInstallationTime(resolutionResult.installationOrder, upgradeAnalyses),
      phases: generateInstallationPhases(resolutionResult.installationOrder),
      preInstallChecks: generatePreInstallChecks(resolutionResult, compatibilityReports),
      postInstallActions: generatePostInstallActions(upgradeAnalyses)
    };

    // Step 5: Generate recommendations
    const recommendations = generateRecommendations(
      resolutionResult,
      compatibilityReports,
      upgradeAnalyses
    );

    const response: ApiResponse = {
      success: true,
      data: {
        resolution: resolutionResult,
        compatibility: {
          reports: compatibilityReports,
          summary: {
            compatible: compatibilityReports.filter(r => r.compatible).length,
            withIssues: compatibilityReports.filter(r => !r.compatible).length,
            criticalIssues: compatibilityReports.reduce((sum, r) => 
              sum + r.issues.filter(i => i.severity === 'critical').length, 0)
          }
        },
        upgrades: upgradeAnalyses,
        installationPlan,
        recommendations,
        metadata: {
          strategy,
          skipOptional,
          checkCompatibility,
          planUpgrades,
          processedAt: new Date().toISOString(),
          performance: {
            totalTime: Date.now() - Date.now(), // Would track actual time
            resolutionTime: resolutionResult.performance.resolutionTimeMs,
            compatibilityCheckTime: compatibilityReports.reduce((sum, r) => sum + r.checkTime, 0)
          }
        }
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Plugin resolution error:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    let result;
    switch (action) {
      case 'strategies':
        result = {
          available: ['strict', 'permissive', 'latest', 'compatible'],
          descriptions: {
            strict: 'Strict version matching - no automatic conflict resolution',
            permissive: 'Allow minor version mismatches and optional dependencies',
            latest: 'Prefer latest versions when resolving conflicts',
            compatible: 'Find most compatible versions across all constraints'
          },
          default: 'strict'
        };
        break;

      case 'system-requirements':
        result = {
          minimum: {
            nodeVersion: '16.0.0',
            memory: 4096, // MB
            diskSpace: 1024, // MB
            backstageVersion: '1.0.0'
          },
          recommended: {
            nodeVersion: '18.17.0',
            memory: 8192, // MB
            diskSpace: 2048, // MB
            backstageVersion: '1.15.0'
          }
        };
        break;

      case 'resolution-status':
        // This would typically return the status of ongoing resolutions
        result = {
          activeResolutions: 0,
          queuedResolutions: 0,
          lastResolution: null,
          cacheStatus: {
            size: 0,
            hitRate: 0.85,
            lastCleared: new Date().toISOString()
          }
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const response: ApiResponse = {
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Resolution info error:', error);
    
    const errorResponse: ApiResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

// Helper functions

function calculateInstallationTime(
  installationOrder: string[], 
  upgradeAnalyses: UpgradeAnalysis[]
): number {
  // Base time per plugin (minutes)
  let totalTime = installationOrder.length * 2;
  
  // Add upgrade time
  totalTime += upgradeAnalyses.reduce((sum, analysis) => sum + analysis.estimatedEffort * 60, 0);
  
  // Add testing time (20% of installation time)
  totalTime += totalTime * 0.2;
  
  return Math.round(totalTime);
}

function generateInstallationPhases(installationOrder: string[]): Array<{
  phase: string;
  plugins: string[];
  description: string;
}> {
  const phases = [];
  const batchSize = 3;
  
  for (let i = 0; i < installationOrder.length; i += batchSize) {
    const batch = installationOrder.slice(i, i + batchSize);
    phases.push({
      phase: `Phase ${Math.floor(i / batchSize) + 1}`,
      plugins: batch,
      description: `Install ${batch.length} plugin${batch.length > 1 ? 's' : ''} in parallel`
    });
  }
  
  return phases;
}

function generatePreInstallChecks(
  resolutionResult: ResolutionResult,
  compatibilityReports: CompatibilityReport[]
): string[] {
  const checks = [];
  
  checks.push('Verify system meets minimum requirements');
  checks.push('Create backup of current plugin configuration');
  
  if (resolutionResult.conflicts.length > 0) {
    checks.push('Review and resolve dependency conflicts');
  }
  
  const criticalIssues = compatibilityReports.reduce(
    (sum, r) => sum + r.issues.filter(i => i.severity === 'critical').length, 0
  );
  
  if (criticalIssues > 0) {
    checks.push('Address critical compatibility issues');
  }
  
  checks.push('Test installation in development environment');
  
  return checks;
}

function generatePostInstallActions(upgradeAnalyses: UpgradeAnalysis[]): string[] {
  const actions = [];
  
  actions.push('Verify all plugins loaded successfully');
  actions.push('Run integration tests');
  
  if (upgradeAnalyses.length > 0) {
    actions.push('Review upgrade migration guides');
    actions.push('Update plugin configurations if needed');
  }
  
  actions.push('Update documentation with new plugin versions');
  actions.push('Monitor system performance after installation');
  
  return actions;
}

function generateRecommendations(
  resolutionResult: ResolutionResult,
  compatibilityReports: CompatibilityReport[],
  upgradeAnalyses: UpgradeAnalysis[]
): Array<{
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  description: string;
  action?: string;
}> {
  const recommendations = [];
  
  // Resolution recommendations
  if (resolutionResult.resolved) {
    recommendations.push({
      type: 'success' as const,
      title: 'Dependencies Resolved Successfully',
      description: `All ${resolutionResult.installationOrder.length} plugins can be installed without conflicts.`
    });
  } else {
    recommendations.push({
      type: 'error' as const,
      title: 'Dependency Conflicts Detected',
      description: `${resolutionResult.conflicts.length} conflicts need to be resolved before installation.`,
      action: 'Review conflicts and choose resolution strategy'
    });
  }
  
  // Compatibility recommendations
  const incompatiblePlugins = compatibilityReports.filter(r => !r.compatible);
  if (incompatiblePlugins.length > 0) {
    recommendations.push({
      type: 'warning' as const,
      title: 'Compatibility Issues Found',
      description: `${incompatiblePlugins.length} plugins have compatibility issues that may affect functionality.`,
      action: 'Review compatibility reports and consider alternatives'
    });
  }
  
  // Performance recommendations
  const highImpactPlugins = compatibilityReports.filter(
    r => r.performanceImpact.impactScore > 7
  );
  if (highImpactPlugins.length > 0) {
    recommendations.push({
      type: 'info' as const,
      title: 'High Performance Impact Detected',
      description: `${highImpactPlugins.length} plugins may significantly impact system performance.`,
      action: 'Monitor system resources after installation'
    });
  }
  
  // Upgrade recommendations
  const complexUpgrades = upgradeAnalyses.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical');
  if (complexUpgrades.length > 0) {
    recommendations.push({
      type: 'warning' as const,
      title: 'Complex Upgrades Required',
      description: `${complexUpgrades.length} plugins require complex upgrades with potential breaking changes.`,
      action: 'Review migration guides and test thoroughly'
    });
  }
  
  return recommendations;
}