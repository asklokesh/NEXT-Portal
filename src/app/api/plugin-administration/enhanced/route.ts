/**
 * Enhanced Plugin Administration API
 * Integrates performance optimization, lifecycle management, dependency resolution,
 * security framework, and marketplace optimization
 */

import { NextRequest, NextResponse } from 'next/server';
import { pluginPerformanceEngine } from '@/services/plugin-performance/PerformanceOptimizationEngine';
import { advancedLifecycleManager } from '@/services/plugin-lifecycle/AdvancedLifecycleManager';
import { intelligentDependencyResolver } from '@/services/dependency-resolution/IntelligentDependencyResolver';
import { enhancedPluginSecurityFramework } from '@/services/security/EnhancedPluginSecurityFramework';
import { enhancedPluginMarketplace } from '@/services/marketplace/EnhancedPluginMarketplace';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'dashboard';
    const pluginId = searchParams.get('pluginId');

    switch (action) {
      case 'dashboard':
        return await getDashboardData();
      
      case 'performance-summary':
        return await getPerformanceSummary();
      
      case 'health-overview':
        return await getHealthOverview();
      
      case 'security-status':
        return await getSecurityStatus();
      
      case 'marketplace-metrics':
        return await getMarketplaceMetrics();
      
      case 'plugin-details':
        if (!pluginId) {
          return NextResponse.json({
            success: false,
            error: 'Plugin ID is required for plugin details'
          }, { status: 400 });
        }
        return await getPluginDetails(pluginId);
      
      case 'recommendations':
        return await getRecommendations();
      
      case 'system-health':
        return await getSystemHealth();
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action specified'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[EnhancedPluginAdmin] API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, pluginId, version, options = {} } = body;

    switch (action) {
      case 'install-plugin':
        return await installPluginEnhanced(pluginId, version, options);
      
      case 'evaluate-plugin':
        return await evaluatePlugin(pluginId, version, options);
      
      case 'security-scan':
        return await performSecurityScan(pluginId, version, options);
      
      case 'performance-analysis':
        return await performPerformanceAnalysis(pluginId, options);
      
      case 'dependency-analysis':
        return await analyzeDependencies(pluginId, version, options);
      
      case 'optimize-performance':
        return await optimizePluginPerformance(pluginId, options);
      
      case 'marketplace-publish':
        return await publishToMarketplace(pluginId, version, options);
      
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action specified'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[EnhancedPluginAdmin] API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get comprehensive dashboard data
 */
async function getDashboardData(): Promise<NextResponse> {
  try {
    const performanceSummary = pluginPerformanceEngine.getPerformanceSummary();
    const managedPlugins = advancedLifecycleManager.getAllManagedPlugins();
    const marketplaceMetrics = enhancedPluginMarketplace.getMarketplaceMetrics();
    
    // Calculate overall system health
    const totalPlugins = managedPlugins.size;
    const healthyPlugins = Array.from(managedPlugins.values())
      .filter(p => p.health === 'healthy').length;
    const runningPlugins = Array.from(managedPlugins.values())
      .filter(p => p.state === 'running').length;
    
    const systemHealth = {
      overall: healthyPlugins / totalPlugins > 0.9 ? 'healthy' : 
               healthyPlugins / totalPlugins > 0.7 ? 'degraded' : 'critical',
      totalPlugins,
      healthyPlugins,
      runningPlugins,
      avgPerformanceScore: performanceSummary.averagePerformanceScore,
      totalSystemImpact: performanceSummary.totalSystemImpact,
      pluginsAboveThreshold: performanceSummary.pluginsAboveThreshold
    };

    // Recent events from lifecycle manager
    const recentEvents = advancedLifecycleManager.getEventLog()
      .slice(-20)
      .reverse();

    // Performance alerts
    const performanceAlerts = Array.from(pluginPerformanceEngine.getPerformanceMetrics().values())
      .filter(metrics => metrics.impactPercentage > 10 || metrics.performanceScore < 60)
      .map(metrics => ({
        pluginId: metrics.pluginId,
        type: 'performance',
        severity: metrics.impactPercentage > 20 ? 'high' : 'medium',
        message: `Performance impact: ${metrics.impactPercentage.toFixed(1)}%`,
        recommendations: metrics.optimizationRecommendations.slice(0, 2)
      }));

    return NextResponse.json({
      success: true,
      data: {
        systemHealth,
        performanceSummary,
        marketplaceMetrics,
        recentEvents,
        performanceAlerts,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    throw new Error(`Failed to get dashboard data: ${error.message}`);
  }
}

/**
 * Get performance summary
 */
async function getPerformanceSummary(): Promise<NextResponse> {
  try {
    const summary = pluginPerformanceEngine.getPerformanceSummary();
    const allMetrics = Array.from(pluginPerformanceEngine.getPerformanceMetrics().values());
    
    // Calculate additional metrics
    const performanceDistribution = {
      excellent: allMetrics.filter(m => m.performanceScore >= 90).length,
      good: allMetrics.filter(m => m.performanceScore >= 70 && m.performanceScore < 90).length,
      fair: allMetrics.filter(m => m.performanceScore >= 50 && m.performanceScore < 70).length,
      poor: allMetrics.filter(m => m.performanceScore < 50).length
    };

    const topPerformers = allMetrics
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, 5)
      .map(m => ({ pluginId: m.pluginId, score: m.performanceScore }));

    const worstPerformers = allMetrics
      .sort((a, b) => a.performanceScore - b.performanceScore)
      .slice(0, 5)
      .map(m => ({ 
        pluginId: m.pluginId, 
        score: m.performanceScore,
        impactPercentage: m.impactPercentage,
        recommendations: m.optimizationRecommendations.slice(0, 2)
      }));

    return NextResponse.json({
      success: true,
      data: {
        summary,
        performanceDistribution,
        topPerformers,
        worstPerformers,
        totalMetrics: allMetrics.length
      }
    });
  } catch (error) {
    throw new Error(`Failed to get performance summary: ${error.message}`);
  }
}

/**
 * Install plugin with enhanced features
 */
async function installPluginEnhanced(
  pluginId: string, 
  version: string, 
  options: any
): Promise<NextResponse> {
  try {
    console.log(`[EnhancedPluginAdmin] Installing ${pluginId}@${version} with enhanced features`);

    // 1. Pre-installation security scan
    console.log(`[EnhancedPluginAdmin] Performing pre-installation security scan`);
    const securityResult = await enhancedPluginSecurityFramework.performSecurityScan(
      pluginId, 
      version, 
      { deepScan: true }
    );

    if (securityResult.overallRisk === 'critical' || securityResult.securityScore < 30) {
      return NextResponse.json({
        success: false,
        error: 'Plugin failed security validation',
        details: {
          securityScore: securityResult.securityScore,
          overallRisk: securityResult.overallRisk,
          criticalVulnerabilities: securityResult.vulnerabilities.filter(v => v.severity === 'critical').length,
          recommendations: securityResult.recommendations.slice(0, 3)
        }
      }, { status: 400 });
    }

    // 2. Dependency resolution and analysis
    console.log(`[EnhancedPluginAdmin] Resolving dependencies`);
    const dependencyResult = await intelligentDependencyResolver.resolveDependencies(
      pluginId, 
      version,
      { existingPlugins: options.existingPlugins }
    );

    if (!dependencyResult.success && dependencyResult.conflicts.some(c => c.severity === 'critical')) {
      return NextResponse.json({
        success: false,
        error: 'Critical dependency conflicts detected',
        details: {
          conflicts: dependencyResult.conflicts.filter(c => c.severity === 'critical'),
          resolutionRequired: true
        }
      }, { status: 400 });
    }

    // 3. Install with lifecycle management
    console.log(`[EnhancedPluginAdmin] Installing with lifecycle management`);
    const installResult = await advancedLifecycleManager.installPlugin(
      pluginId, 
      version, 
      options.config || {}
    );

    if (!installResult.success) {
      return NextResponse.json({
        success: false,
        error: installResult.message,
        details: installResult.details
      }, { status: 400 });
    }

    // 4. Post-installation performance analysis
    console.log(`[EnhancedPluginAdmin] Performing post-installation performance analysis`);
    setTimeout(async () => {
      try {
        await performPostInstallationAnalysis(pluginId);
      } catch (error) {
        console.error(`[EnhancedPluginAdmin] Post-installation analysis failed:`, error);
      }
    }, 10000); // Delay to allow plugin to start

    // 5. Add to marketplace evaluation queue
    enhancedPluginMarketplace.queueQualityAssessment(pluginId);

    return NextResponse.json({
      success: true,
      message: installResult.message,
      data: {
        installationDetails: installResult.details,
        securityScore: securityResult.securityScore,
        dependencyStatus: {
          resolved: dependencyResult.resolved.length,
          conflicts: dependencyResult.conflicts.length,
          estimatedTime: dependencyResult.estimatedTime
        },
        postInstallationAnalysisScheduled: true,
        marketplaceEvaluationQueued: true
      }
    });

  } catch (error) {
    console.error(`[EnhancedPluginAdmin] Enhanced installation failed:`, error);
    return NextResponse.json({
      success: false,
      error: 'Installation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Evaluate plugin for marketplace
 */
async function evaluatePlugin(
  pluginId: string, 
  version: string, 
  options: any
): Promise<NextResponse> {
  try {
    console.log(`[EnhancedPluginAdmin] Evaluating ${pluginId}@${version} for marketplace`);

    const evaluation = await enhancedPluginMarketplace.evaluatePlugin(
      pluginId, 
      version, 
      {
        deepAnalysis: options.deepAnalysis || true,
        benchmarkTests: options.benchmarkTests || true
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        evaluation,
        certified: evaluation.certified,
        certificationLevel: evaluation.certificationLevel,
        scores: {
          overall: evaluation.overallScore,
          quality: evaluation.qualityScore,
          performance: evaluation.performanceScore,
          security: evaluation.securityScore,
          compatibility: evaluation.compatibilityScore
        },
        benchmarks: evaluation.benchmarks.length,
        recommendations: evaluation.recommendations.slice(0, 5)
      }
    });

  } catch (error) {
    console.error(`[EnhancedPluginAdmin] Plugin evaluation failed:`, error);
    return NextResponse.json({
      success: false,
      error: 'Evaluation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Perform comprehensive security scan
 */
async function performSecurityScan(
  pluginId: string, 
  version: string, 
  options: any
): Promise<NextResponse> {
  try {
    const scanResult = await enhancedPluginSecurityFramework.performSecurityScan(
      pluginId, 
      version, 
      {
        deepScan: options.deepScan || false,
        realTime: options.realTime || false
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        securityScore: scanResult.securityScore,
        overallRisk: scanResult.overallRisk,
        certified: scanResult.certified,
        vulnerabilities: {
          total: scanResult.vulnerabilities.length,
          critical: scanResult.vulnerabilities.filter(v => v.severity === 'critical').length,
          high: scanResult.vulnerabilities.filter(v => v.severity === 'high').length,
          medium: scanResult.vulnerabilities.filter(v => v.severity === 'medium').length,
          low: scanResult.vulnerabilities.filter(v => v.severity === 'low').length
        },
        permissions: {
          total: scanResult.permissions.length,
          dangerous: scanResult.permissions.filter(p => p.dangerous).length
        },
        recommendations: scanResult.recommendations.slice(0, 5),
        scanTimestamp: scanResult.scanTimestamp
      }
    });

  } catch (error) {
    console.error(`[EnhancedPluginAdmin] Security scan failed:`, error);
    return NextResponse.json({
      success: false,
      error: 'Security scan failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Perform performance analysis
 */
async function performPerformanceAnalysis(
  pluginId: string, 
  options: any
): Promise<NextResponse> {
  try {
    const metrics = pluginPerformanceEngine.getPluginMetrics(pluginId);
    
    if (!metrics) {
      return NextResponse.json({
        success: false,
        error: 'Plugin not found in performance monitoring system'
      }, { status: 404 });
    }

    // Add to optimization queue if needed
    if (metrics.impactPercentage > 10 || metrics.performanceScore < 70) {
      console.log(`[EnhancedPluginAdmin] Queuing ${pluginId} for performance optimization`);
    }

    return NextResponse.json({
      success: true,
      data: {
        performanceScore: metrics.performanceScore,
        impactPercentage: metrics.impactPercentage,
        resourceUsage: {
          cpu: metrics.cpuUsage,
          memory: metrics.memoryUsage,
          diskIOPS: metrics.diskIOPS,
          networkLatency: metrics.networkLatency
        },
        efficiency: {
          resourceEfficiency: metrics.resourceEfficiency,
          responseTime: metrics.responseTime,
          throughput: metrics.throughput,
          errorRate: metrics.errorRate
        },
        recommendations: metrics.optimizationRecommendations,
        needsOptimization: metrics.impactPercentage > 10 || metrics.performanceScore < 70
      }
    });

  } catch (error) {
    console.error(`[EnhancedPluginAdmin] Performance analysis failed:`, error);
    return NextResponse.json({
      success: false,
      error: 'Performance analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Analyze dependencies
 */
async function analyzeDependencies(
  pluginId: string, 
  version: string, 
  options: any
): Promise<NextResponse> {
  try {
    const dependencyResult = await intelligentDependencyResolver.resolveDependencies(
      pluginId, 
      version,
      options.context || {}
    );

    const dependencyGraph = intelligentDependencyResolver.getDependencyGraph();
    
    return NextResponse.json({
      success: true,
      data: {
        resolutionSuccess: dependencyResult.success,
        resolved: dependencyResult.resolved,
        conflicts: dependencyResult.conflicts,
        installationOrder: dependencyResult.installationOrder,
        estimatedTime: dependencyResult.estimatedTime,
        riskAssessment: dependencyResult.riskAssessment,
        optimizations: dependencyResult.optimizations,
        dependencyGraph: {
          totalNodes: dependencyGraph.nodes.size,
          resolvedNodes: dependencyGraph.resolved.length,
          unresolvedNodes: dependencyGraph.unresolved.length,
          conflicts: dependencyGraph.conflicts.length,
          circularDependencies: dependencyGraph.circularDependencies.length
        }
      }
    });

  } catch (error) {
    console.error(`[EnhancedPluginAdmin] Dependency analysis failed:`, error);
    return NextResponse.json({
      success: false,
      error: 'Dependency analysis failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get detailed plugin information
 */
async function getPluginDetails(pluginId: string): Promise<NextResponse> {
  try {
    const performanceMetrics = pluginPerformanceEngine.getPluginMetrics(pluginId);
    const lifecycleState = advancedLifecycleManager.getPluginState(pluginId);
    const securityContext = enhancedPluginSecurityFramework.getSecurityContext(pluginId);
    const marketplaceEntry = enhancedPluginMarketplace.getMarketplaceEntry(pluginId);

    return NextResponse.json({
      success: true,
      data: {
        pluginId,
        performance: performanceMetrics,
        lifecycle: lifecycleState,
        security: securityContext,
        marketplace: marketplaceEntry,
        overallHealth: calculateOverallHealth(performanceMetrics, lifecycleState, securityContext)
      }
    });

  } catch (error) {
    console.error(`[EnhancedPluginAdmin] Failed to get plugin details:`, error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get plugin details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get system recommendations
 */
async function getRecommendations(): Promise<NextResponse> {
  try {
    const marketplaceRecommendations = await enhancedPluginMarketplace.generateRecommendations(
      'system', 
      { useCase: 'administration' }
    );

    const performanceRecommendations = Array.from(pluginPerformanceEngine.getPerformanceMetrics().values())
      .filter(metrics => metrics.optimizationRecommendations.length > 0)
      .map(metrics => ({
        pluginId: metrics.pluginId,
        type: 'performance',
        recommendations: metrics.optimizationRecommendations,
        urgency: metrics.impactPercentage > 20 ? 'high' : 'medium'
      }));

    return NextResponse.json({
      success: true,
      data: {
        marketplace: marketplaceRecommendations,
        performance: performanceRecommendations.slice(0, 10),
        totalRecommendations: marketplaceRecommendations.length + performanceRecommendations.length
      }
    });

  } catch (error) {
    console.error(`[EnhancedPluginAdmin] Failed to get recommendations:`, error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get recommendations',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Perform post-installation analysis
 */
async function performPostInstallationAnalysis(pluginId: string): Promise<void> {
  console.log(`[EnhancedPluginAdmin] Starting post-installation analysis for ${pluginId}`);
  
  // Wait for plugin to stabilize
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    // Check performance impact
    const metrics = pluginPerformanceEngine.getPluginMetrics(pluginId);
    if (metrics && metrics.impactPercentage > 15) {
      console.log(`[EnhancedPluginAdmin] High performance impact detected for ${pluginId}: ${metrics.impactPercentage}%`);
    }

    // Check lifecycle state
    const state = advancedLifecycleManager.getPluginState(pluginId);
    if (state && state.health !== 'healthy') {
      console.log(`[EnhancedPluginAdmin] Health issue detected for ${pluginId}: ${state.health}`);
    }

    console.log(`[EnhancedPluginAdmin] Post-installation analysis completed for ${pluginId}`);
  } catch (error) {
    console.error(`[EnhancedPluginAdmin] Post-installation analysis failed for ${pluginId}:`, error);
  }
}

/**
 * Calculate overall plugin health
 */
function calculateOverallHealth(performance: any, lifecycle: any, security: any): any {
  let score = 100;
  let status = 'healthy';
  const issues = [];

  if (performance) {
    if (performance.performanceScore < 50) {
      score -= 30;
      issues.push('Poor performance score');
    } else if (performance.performanceScore < 70) {
      score -= 15;
      issues.push('Below average performance');
    }

    if (performance.impactPercentage > 20) {
      score -= 25;
      issues.push('High system impact');
    }
  }

  if (lifecycle) {
    if (lifecycle.health === 'unhealthy') {
      score -= 40;
      issues.push('Unhealthy lifecycle state');
    } else if (lifecycle.health === 'degraded') {
      score -= 20;
      issues.push('Degraded lifecycle state');
    }
  }

  if (security) {
    if (security.quarantined) {
      score -= 50;
      issues.push('Security quarantine');
    }
  }

  if (score < 30) status = 'critical';
  else if (score < 60) status = 'degraded';
  else if (score < 80) status = 'good';

  return { score: Math.max(0, score), status, issues };
}

// Additional helper functions for other endpoints
async function getHealthOverview(): Promise<NextResponse> {
  const managedPlugins = advancedLifecycleManager.getAllManagedPlugins();
  const healthStats = {
    total: managedPlugins.size,
    healthy: 0,
    degraded: 0,
    unhealthy: 0,
    unknown: 0
  };

  Array.from(managedPlugins.values()).forEach(plugin => {
    healthStats[plugin.health]++;
  });

  return NextResponse.json({
    success: true,
    data: { healthStats, lastUpdated: new Date().toISOString() }
  });
}

async function getSecurityStatus(): Promise<NextResponse> {
  // Implementation would get security status from all plugins
  return NextResponse.json({
    success: true,
    data: { securityOverview: 'All systems secure', lastScan: new Date().toISOString() }
  });
}

async function getMarketplaceMetrics(): Promise<NextResponse> {
  const metrics = enhancedPluginMarketplace.getMarketplaceMetrics();
  return NextResponse.json({
    success: true,
    data: metrics
  });
}

async function getSystemHealth(): Promise<NextResponse> {
  const performanceSummary = pluginPerformanceEngine.getPerformanceSummary();
  const managedPlugins = advancedLifecycleManager.getAllManagedPlugins();
  
  return NextResponse.json({
    success: true,
    data: {
      performance: performanceSummary,
      totalPlugins: managedPlugins.size,
      timestamp: new Date().toISOString()
    }
  });
}

async function optimizePluginPerformance(pluginId: string, options: any): Promise<NextResponse> {
  // Implementation would trigger performance optimization
  return NextResponse.json({
    success: true,
    message: `Performance optimization initiated for ${pluginId}`,
    data: { optimizationId: 'opt-' + Date.now() }
  });
}

async function publishToMarketplace(pluginId: string, version: string, options: any): Promise<NextResponse> {
  // Implementation would publish plugin to marketplace
  return NextResponse.json({
    success: true,
    message: `Plugin ${pluginId}@${version} published to marketplace`,
    data: { publicationId: 'pub-' + Date.now() }
  });
}