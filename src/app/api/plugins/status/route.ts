/**
 * Plugin Status API Route
 * Provides comprehensive plugin status monitoring and health information
 */

import { NextRequest, NextResponse } from 'next/server';
import { backstageIntegration } from '../../../../lib/plugins/BackstageIntegration';
import { pluginValidator } from '../../../../lib/plugins/PluginValidator';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');
    const includeValidation = searchParams.get('includeValidation') === 'true';
    const includeHealth = searchParams.get('includeHealth') === 'true';
    const includeLogs = searchParams.get('includeLogs') === 'true';

    if (pluginId) {
      // Get status for specific plugin
      return await getPluginStatus(pluginId, {
        includeValidation,
        includeHealth,
        includeLogs
      });
    } else {
      // Get status for all plugins
      return await getAllPluginsStatus({
        includeValidation,
        includeHealth,
        includeLogs
      });
    }

  } catch (error) {
    console.error('Failed to get plugin status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get plugin status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get status for a specific plugin
 */
async function getPluginStatus(pluginId: string, options: {
  includeValidation: boolean;
  includeHealth: boolean;
  includeLogs: boolean;
}) {
  try {
    const status: any = {
      pluginId,
      timestamp: new Date().toISOString()
    };

    // Get basic plugin information
    try {
      const pluginInfo = await backstageIntegration.getPluginInfo(pluginId);
      status.plugin = pluginInfo;
    } catch (error) {
      console.warn(`Failed to get plugin info for ${pluginId}:`, error);
      status.plugin = null;
      status.warnings = status.warnings || [];
      status.warnings.push('Failed to retrieve plugin information from Backstage');
    }

    // Get health status
    if (options.includeHealth) {
      try {
        const healthStatus = await backstageIntegration.getPluginHealthStatus(pluginId);
        status.health = healthStatus;
      } catch (error) {
        console.warn(`Failed to get health status for ${pluginId}:`, error);
        status.health = null;
        status.warnings = status.warnings || [];
        status.warnings.push('Failed to retrieve plugin health status');
      }
    }

    // Get validation results
    if (options.includeValidation) {
      try {
        const validationResult = await pluginValidator.validatePlugin(
          pluginId, 
          status.plugin?.configuration
        );
        status.validation = validationResult;
      } catch (error) {
        console.warn(`Failed to validate plugin ${pluginId}:`, error);
        status.validation = null;
        status.warnings = status.warnings || [];
        status.warnings.push('Failed to validate plugin');
      }
    }

    // Get logs
    if (options.includeLogs) {
      try {
        const logs = await backstageIntegration.getPluginLogs(pluginId, {
          limit: 100,
          level: 'error',
          since: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        });
        status.logs = logs;
      } catch (error) {
        console.warn(`Failed to get logs for ${pluginId}:`, error);
        status.logs = null;
        status.warnings = status.warnings || [];
        status.warnings.push('Failed to retrieve plugin logs');
      }
    }

    // Generate status summary
    status.summary = generatePluginStatusSummary(status);

    return NextResponse.json(status);

  } catch (error) {
    console.error(`Failed to get status for plugin ${pluginId}:`, error);
    return NextResponse.json(
      { 
        error: `Failed to get status for plugin ${pluginId}`,
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Get status for all plugins
 */
async function getAllPluginsStatus(options: {
  includeValidation: boolean;
  includeHealth: boolean;
  includeLogs: boolean;
}) {
  try {
    const overallStatus: any = {
      timestamp: new Date().toISOString(),
      plugins: [],
      summary: {
        total: 0,
        healthy: 0,
        unhealthy: 0,
        unknown: 0,
        installing: 0,
        failed: 0
      }
    };

    // Get list of installed plugins
    let installedPlugins;
    try {
      installedPlugins = await backstageIntegration.getInstalledPlugins();
    } catch (error) {
      console.warn('Failed to get installed plugins from Backstage:', error);
      installedPlugins = [];
      overallStatus.warnings = overallStatus.warnings || [];
      overallStatus.warnings.push('Failed to retrieve installed plugins from Backstage');
    }

    // Get health status for all plugins
    let healthStatuses = [];
    if (options.includeHealth) {
      try {
        healthStatuses = await backstageIntegration.getAllPluginHealthStatus();
      } catch (error) {
        console.warn('Failed to get health statuses:', error);
        overallStatus.warnings = overallStatus.warnings || [];
        overallStatus.warnings.push('Failed to retrieve plugin health statuses');
      }
    }

    // Process each plugin
    for (const plugin of installedPlugins) {
      const pluginStatus: any = {
        pluginId: plugin.name,
        plugin,
        timestamp: new Date().toISOString()
      };

      // Add health status
      if (options.includeHealth) {
        const health = healthStatuses.find(h => h.pluginId === plugin.name);
        pluginStatus.health = health;
      }

      // Add validation results
      if (options.includeValidation) {
        try {
          const validation = await pluginValidator.validatePlugin(plugin.name, plugin.configuration);
          pluginStatus.validation = validation;
        } catch (error) {
          console.warn(`Failed to validate plugin ${plugin.name}:`, error);
          pluginStatus.validation = null;
        }
      }

      // Add recent logs
      if (options.includeLogs) {
        try {
          const logs = await backstageIntegration.getPluginLogs(plugin.name, {
            limit: 10,
            level: 'error',
            since: new Date(Date.now() - 60 * 60 * 1000) // Last hour
          });
          pluginStatus.logs = logs;
        } catch (error) {
          console.warn(`Failed to get logs for plugin ${plugin.name}:`, error);
          pluginStatus.logs = null;
        }
      }

      // Generate plugin summary
      pluginStatus.summary = generatePluginStatusSummary(pluginStatus);

      overallStatus.plugins.push(pluginStatus);

      // Update overall summary
      overallStatus.summary.total++;
      switch (pluginStatus.summary.status) {
        case 'healthy':
          overallStatus.summary.healthy++;
          break;
        case 'unhealthy':
          overallStatus.summary.unhealthy++;
          break;
        case 'installing':
          overallStatus.summary.installing++;
          break;
        case 'failed':
          overallStatus.summary.failed++;
          break;
        default:
          overallStatus.summary.unknown++;
      }
    }

    // Add system-wide metrics
    overallStatus.systemMetrics = calculateSystemMetrics(overallStatus.plugins);

    // Add recommendations
    overallStatus.recommendations = generateSystemRecommendations(overallStatus);

    return NextResponse.json(overallStatus);

  } catch (error) {
    console.error('Failed to get overall plugin status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get overall plugin status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate status summary for a plugin
 */
function generatePluginStatusSummary(pluginStatus: any): any {
  const summary: any = {
    status: 'unknown',
    score: 0,
    issues: [],
    lastUpdated: new Date().toISOString()
  };

  // Determine overall status
  if (pluginStatus.plugin) {
    switch (pluginStatus.plugin.installationStatus) {
      case 'installing':
        summary.status = 'installing';
        break;
      case 'failed':
        summary.status = 'failed';
        break;
      case 'installed':
        // Check health status
        if (pluginStatus.health) {
          summary.status = pluginStatus.health.status;
        } else {
          summary.status = 'unknown';
        }
        break;
      default:
        summary.status = 'unknown';
    }
  }

  // Calculate score from validation
  if (pluginStatus.validation) {
    summary.score = pluginStatus.validation.score;
    
    // Add validation issues
    if (pluginStatus.validation.errors) {
      summary.issues.push(...pluginStatus.validation.errors.map((error: any) => ({
        type: 'error',
        severity: error.severity,
        message: error.message,
        source: 'validation'
      })));
    }
    
    if (pluginStatus.validation.warnings) {
      summary.issues.push(...pluginStatus.validation.warnings.map((warning: any) => ({
        type: 'warning',
        severity: warning.impact,
        message: warning.message,
        source: 'validation'
      })));
    }
  }

  // Add health issues
  if (pluginStatus.health) {
    if (pluginStatus.health.errors && pluginStatus.health.errors.length > 0) {
      summary.issues.push(...pluginStatus.health.errors.map((error: string) => ({
        type: 'error',
        severity: 'high',
        message: error,
        source: 'health'
      })));
    }

    if (pluginStatus.health.warnings && pluginStatus.health.warnings.length > 0) {
      summary.issues.push(...pluginStatus.health.warnings.map((warning: string) => ({
        type: 'warning',
        severity: 'medium',
        message: warning,
        source: 'health'
      })));
    }
  }

  // Add performance metrics
  if (pluginStatus.health?.metrics) {
    summary.performance = {
      responseTime: pluginStatus.health.responseTime,
      errorRate: pluginStatus.health.metrics.errorRate,
      memoryUsage: pluginStatus.health.metrics.memoryUsage,
      cpuUsage: pluginStatus.health.metrics.cpuUsage
    };
  }

  return summary;
}

/**
 * Calculate system-wide metrics
 */
function calculateSystemMetrics(plugins: any[]): any {
  const metrics: any = {
    totalPlugins: plugins.length,
    averageScore: 0,
    averageResponseTime: 0,
    totalMemoryUsage: 0,
    totalCpuUsage: 0,
    totalErrorRate: 0
  };

  let scoreSum = 0;
  let responseTimeSum = 0;
  let memorySum = 0;
  let cpuSum = 0;
  let errorRateSum = 0;
  let validPlugins = 0;

  for (const plugin of plugins) {
    if (plugin.summary?.score) {
      scoreSum += plugin.summary.score;
      validPlugins++;
    }

    if (plugin.summary?.performance) {
      responseTimeSum += plugin.summary.performance.responseTime || 0;
      memorySum += plugin.summary.performance.memoryUsage || 0;
      cpuSum += plugin.summary.performance.cpuUsage || 0;
      errorRateSum += plugin.summary.performance.errorRate || 0;
    }
  }

  if (validPlugins > 0) {
    metrics.averageScore = Math.round(scoreSum / validPlugins);
    metrics.averageResponseTime = Math.round(responseTimeSum / validPlugins);
    metrics.totalMemoryUsage = Math.round(memorySum);
    metrics.totalCpuUsage = Math.round(cpuSum);
    metrics.totalErrorRate = Number((errorRateSum / validPlugins).toFixed(4));
  }

  return metrics;
}

/**
 * Generate system-wide recommendations
 */
function generateSystemRecommendations(overallStatus: any): string[] {
  const recommendations: string[] = [];

  // Health recommendations
  if (overallStatus.summary.unhealthy > 0) {
    recommendations.push(`${overallStatus.summary.unhealthy} plugin(s) are unhealthy - investigate and resolve issues`);
  }

  if (overallStatus.summary.failed > 0) {
    recommendations.push(`${overallStatus.summary.failed} plugin(s) have failed - check installation logs and retry`);
  }

  // Performance recommendations
  if (overallStatus.systemMetrics?.averageResponseTime > 1000) {
    recommendations.push('Average plugin response time is high - consider performance optimization');
  }

  if (overallStatus.systemMetrics?.totalErrorRate > 0.05) {
    recommendations.push('Plugin error rate is elevated - investigate failing plugins');
  }

  // Score recommendations
  if (overallStatus.systemMetrics?.averageScore < 80) {
    recommendations.push('Overall plugin health score is low - review validation issues');
  }

  // General recommendations
  if (recommendations.length === 0) {
    recommendations.push('All plugins are healthy - continue monitoring for optimal performance');
  }

  return recommendations;
}