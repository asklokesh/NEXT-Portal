/**
 * Premium Features Integration API
 * Centralized API for managing Premium features with health monitoring and performance optimization
 */

import { NextRequest, NextResponse } from 'next/server';
import { premiumFeaturesManager } from '@/lib/premium/PremiumFeaturesManager';
import { premiumPerformanceOptimizer } from '@/lib/premium/PremiumPerformanceOptimizer';
import { premiumHealthMonitor } from '@/lib/premium/PremiumHealthMonitor';

export async function GET(req: NextRequest) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const action = searchParams.get('action');
    const feature = searchParams.get('feature');

    // Initialize Premium Features Manager if not already done
    await premiumFeaturesManager.initialize();

    switch (action) {
      case 'health':
        if (feature) {
          const featureHealth = premiumHealthMonitor.getSystemHealth().features.get(feature);
          if (!featureHealth) {
            return NextResponse.json(
              { error: `Health data not found for feature: ${feature}` },
              { status: 404 }
            );
          }
          return NextResponse.json({ health: featureHealth });
        } else {
          const systemHealth = premiumHealthMonitor.getSystemHealth();
          return NextResponse.json({ health: systemHealth });
        }

      case 'status':
        const overallHealth = premiumFeaturesManager.getOverallHealth();
        const optimizationStatus = premiumPerformanceOptimizer.getOptimizationStatus();
        
        return NextResponse.json({
          status: 'operational',
          health: overallHealth,
          optimization: optimizationStatus,
          timestamp: new Date().toISOString()
        });

      case 'performance':
        const analytics = premiumPerformanceOptimizer.getPerformanceAnalytics();
        return NextResponse.json({ analytics });

      case 'diagnostics':
        if (!feature) {
          return NextResponse.json(
            { error: 'Feature parameter required for diagnostics' },
            { status: 400 }
          );
        }
        
        const diagnostics = await premiumHealthMonitor.runDiagnostics(feature);
        return NextResponse.json({ diagnostics });

      case 'feature-instance':
        if (!feature) {
          return NextResponse.json(
            { error: 'Feature parameter required' },
            { status: 400 }
          );
        }

        try {
          const instance = await premiumFeaturesManager.getFeatureInstance(feature);
          return NextResponse.json({ 
            success: true, 
            available: true,
            instance: typeof instance
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            available: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }

      case 'metrics':
        const timeRange = searchParams.get('timeRange') || '1h';
        const metrics = await getMetricsForTimeRange(timeRange);
        return NextResponse.json({ metrics });

      case 'integrations':
        const integrationHealth = premiumHealthMonitor.getSystemHealth().integrations;
        return NextResponse.json({ integrations: Object.fromEntries(integrationHealth) });

      default:
        return NextResponse.json({
          status: 'Premium Features API Ready',
          version: '2.0.0',
          features: ['soundcheck', 'aika', 'skill-exchange'],
          capabilities: [
            'Health monitoring and diagnostics',
            'Performance optimization',
            'Cross-feature integration',
            'Resource management',
            'Auto-recovery',
            'Real-time analytics'
          ],
          endpoints: {
            'GET ?action=health[&feature=X]': 'Get health status',
            'GET ?action=status': 'Get overall system status',
            'GET ?action=performance': 'Get performance analytics',
            'GET ?action=diagnostics&feature=X': 'Run diagnostics for feature',
            'GET ?action=feature-instance&feature=X': 'Check feature availability',
            'GET ?action=metrics[&timeRange=X]': 'Get performance metrics',
            'GET ?action=integrations': 'Get integration health',
            'POST action=optimize': 'Apply performance optimizations',
            'POST action=recover': 'Trigger recovery procedures',
            'POST action=configure': 'Configure premium features'
          }
        });
    }
  } catch (error) {
    console.error('Premium Features API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // Initialize Premium Features Manager if not already done
    await premiumFeaturesManager.initialize();

    switch (action) {
      case 'optimize':
        const { feature, operation, options } = body;
        
        if (!feature || !operation) {
          return NextResponse.json(
            { error: 'Feature and operation parameters required' },
            { status: 400 }
          );
        }

        try {
          const startTime = Date.now();
          
          const result = await premiumPerformanceOptimizer.optimizeOperation(
            feature,
            operation,
            async () => {
              // Execute the actual operation
              const instance = await premiumFeaturesManager.getFeatureInstance(feature);
              
              switch (operation) {
                case 'assessment':
                  if (feature === 'soundcheck' && instance.runAssessment) {
                    return instance.runAssessment(options.entity);
                  }
                  break;
                case 'recommendation':
                  if (feature === 'aika' && instance.generateRecommendations) {
                    return instance.generateRecommendations(options.context);
                  }
                  break;
                case 'skill-match':
                  if (feature === 'skill-exchange' && instance.getPersonalizedRecommendations) {
                    return instance.getPersonalizedRecommendations(options.userId);
                  }
                  break;
                default:
                  throw new Error(`Unknown operation: ${operation}`);
              }
              
              throw new Error(`Operation ${operation} not supported for feature ${feature}`);
            },
            {
              cacheKey: options.cacheKey,
              batchable: options.batchable,
              priority: options.priority,
              timeout: options.timeout
            }
          );

          const responseTime = Date.now() - startTime;
          
          // Record performance metrics
          premiumPerformanceOptimizer.recordMetrics(feature, {
            responseTime,
            throughput: 1,
            errorRate: 0
          });

          return NextResponse.json({
            success: true,
            result,
            performance: {
              responseTime,
              optimized: true
            }
          });

        } catch (error) {
          // Record error metrics
          premiumPerformanceOptimizer.recordMetrics(feature, {
            responseTime: Date.now() - Date.now(),
            throughput: 0,
            errorRate: 100
          });

          return NextResponse.json(
            { 
              success: false,
              error: error instanceof Error ? error.message : 'Operation failed'
            },
            { status: 500 }
          );
        }

      case 'recover':
        const { features = [], type = 'auto' } = body;
        
        const recoveryResults = [];
        
        for (const featureId of features.length > 0 ? features : ['soundcheck', 'aika', 'skill-exchange']) {
          try {
            // Trigger health check to assess current state
            const healthChecks = Array.from(premiumHealthMonitor['healthChecks'].values())
              .filter(check => check.feature === featureId);
            
            for (const check of healthChecks) {
              await premiumHealthMonitor.executeCheck(check.id);
            }
            
            recoveryResults.push({
              feature: featureId,
              success: true,
              message: 'Recovery procedures initiated'
            });
          } catch (error) {
            recoveryResults.push({
              feature: featureId,
              success: false,
              error: error instanceof Error ? error.message : 'Recovery failed'
            });
          }
        }

        return NextResponse.json({
          success: true,
          recoveryType: type,
          results: recoveryResults,
          timestamp: new Date().toISOString()
        });

      case 'configure':
        const { configurations } = body;
        
        if (!configurations || typeof configurations !== 'object') {
          return NextResponse.json(
            { error: 'Configurations object required' },
            { status: 400 }
          );
        }

        const configResults = [];

        // Configure performance optimization
        if (configurations.performance) {
          const { strategies, thresholds } = configurations.performance;
          
          if (strategies) {
            for (const [strategyName, config] of Object.entries(strategies)) {
              try {
                premiumPerformanceOptimizer.configureOptimization(
                  strategyName,
                  config.enabled,
                  config.settings
                );
                configResults.push({
                  type: 'performance',
                  strategy: strategyName,
                  success: true
                });
              } catch (error) {
                configResults.push({
                  type: 'performance',
                  strategy: strategyName,
                  success: false,
                  error: error instanceof Error ? error.message : 'Configuration failed'
                });
              }
            }
          }

          if (thresholds) {
            try {
              premiumHealthMonitor.setAlertThresholds(thresholds);
              configResults.push({
                type: 'health-thresholds',
                success: true
              });
            } catch (error) {
              configResults.push({
                type: 'health-thresholds',
                success: false,
                error: error instanceof Error ? error.message : 'Threshold configuration failed'
              });
            }
          }
        }

        // Configure monitoring
        if (configurations.monitoring) {
          const { enabled, autoRecovery } = configurations.monitoring;
          
          if (typeof enabled === 'boolean') {
            premiumHealthMonitor.setMonitoringEnabled(enabled);
            configResults.push({
              type: 'monitoring',
              setting: 'enabled',
              success: true,
              value: enabled
            });
          }

          if (typeof autoRecovery === 'boolean') {
            premiumHealthMonitor['autoRecoveryEnabled'] = autoRecovery;
            configResults.push({
              type: 'monitoring',
              setting: 'autoRecovery',
              success: true,
              value: autoRecovery
            });
          }
        }

        return NextResponse.json({
          success: true,
          configurations: configResults,
          timestamp: new Date().toISOString()
        });

      case 'bulk-operation':
        const { operations } = body;
        
        if (!operations || !Array.isArray(operations)) {
          return NextResponse.json(
            { error: 'Operations array required' },
            { status: 400 }
          );
        }

        const bulkResults = [];
        const startTime = Date.now();

        for (const op of operations) {
          try {
            const opStartTime = Date.now();
            
            const result = await premiumPerformanceOptimizer.optimizeOperation(
              op.feature,
              op.operation,
              async () => {
                const instance = await premiumFeaturesManager.getFeatureInstance(op.feature);
                // Execute operation based on feature and operation type
                return await executeFeatureOperation(instance, op.operation, op.params);
              },
              {
                cacheKey: op.cacheKey,
                batchable: true,
                priority: op.priority || 'medium'
              }
            );

            bulkResults.push({
              id: op.id,
              success: true,
              result,
              responseTime: Date.now() - opStartTime
            });

          } catch (error) {
            bulkResults.push({
              id: op.id,
              success: false,
              error: error instanceof Error ? error.message : 'Operation failed',
              responseTime: Date.now() - Date.now()
            });
          }
        }

        const totalTime = Date.now() - startTime;
        const successCount = bulkResults.filter(r => r.success).length;

        return NextResponse.json({
          success: true,
          summary: {
            total: operations.length,
            successful: successCount,
            failed: operations.length - successCount,
            totalTime,
            avgTime: totalTime / operations.length
          },
          results: bulkResults
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Premium Features API error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Helper functions

async function getMetricsForTimeRange(timeRange: string): Promise<any> {
  // Parse time range and return relevant metrics
  const now = Date.now();
  let duration = 3600000; // 1 hour default
  
  switch (timeRange) {
    case '5m':
      duration = 5 * 60 * 1000;
      break;
    case '15m':
      duration = 15 * 60 * 1000;
      break;
    case '1h':
      duration = 60 * 60 * 1000;
      break;
    case '6h':
      duration = 6 * 60 * 60 * 1000;
      break;
    case '24h':
      duration = 24 * 60 * 60 * 1000;
      break;
  }
  
  return {
    timeRange,
    duration,
    startTime: new Date(now - duration).toISOString(),
    endTime: new Date(now).toISOString(),
    metrics: {
      responseTime: generateMockTimeSeries(duration, 100, 500),
      throughput: generateMockTimeSeries(duration, 50, 200),
      errorRate: generateMockTimeSeries(duration, 0, 5),
      resourceUsage: {
        cpu: generateMockTimeSeries(duration, 20, 80),
        memory: generateMockTimeSeries(duration, 30, 90)
      }
    }
  };
}

function generateMockTimeSeries(duration: number, min: number, max: number): Array<{ timestamp: string; value: number }> {
  const points = Math.min(50, Math.max(10, duration / 60000)); // 1 point per minute, max 50 points
  const interval = duration / points;
  const series = [];
  
  for (let i = 0; i < points; i++) {
    series.push({
      timestamp: new Date(Date.now() - duration + (i * interval)).toISOString(),
      value: Math.round((Math.random() * (max - min) + min) * 100) / 100
    });
  }
  
  return series;
}

async function executeFeatureOperation(instance: any, operation: string, params: any): Promise<any> {
  switch (operation) {
    case 'health-check':
      if (typeof instance.healthCheck === 'function') {
        return instance.healthCheck();
      }
      return { healthy: true, timestamp: new Date().toISOString() };
      
    case 'get-status':
      return {
        status: 'operational',
        instance: typeof instance,
        timestamp: new Date().toISOString()
      };
      
    case 'assessment':
      if (typeof instance.runAssessment === 'function') {
        return instance.runAssessment(params.entity);
      }
      throw new Error('Assessment operation not supported');
      
    case 'recommendation':
      if (typeof instance.generateRecommendations === 'function') {
        return instance.generateRecommendations(params.context);
      }
      throw new Error('Recommendation operation not supported');
      
    case 'skill-match':
      if (typeof instance.getPersonalizedRecommendations === 'function') {
        return instance.getPersonalizedRecommendations(params.userId);
      }
      throw new Error('Skill match operation not supported');
      
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}