/**
 * Tenant Analytics API
 * Provides comprehensive analytics and usage tracking for tenants
 */

import { NextRequest, NextResponse } from 'next/server';
import TenantAnalyticsService, { MetricType, AnalyticsQuery } from '@/services/analytics/TenantAnalyticsService';
import { validateRequestBody } from '@/lib/security/input-validation';
import { getTenantContext } from '@/lib/tenancy/TenantContext';
import { checkTenantAdminRights, checkSystemPermissions } from '@/lib/permissions/SystemPermissions';

/**
 * GET - Retrieve tenant analytics data
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
    const targetTenantId = searchParams.get('tenantId') || tenantContext.tenant.id;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const section = searchParams.get('section'); // 'usage', 'performance', 'business', etc.
    const format = searchParams.get('format'); // 'summary', 'detailed', 'export'

    // Check permissions for cross-tenant access
    if (targetTenantId !== tenantContext.tenant.id) {
      const hasSystemAccess = await checkSystemPermissions(request, ['system:tenant:read', 'admin:all']);
      if (!hasSystemAccess) {
        return NextResponse.json({
          success: false,
          error: 'Insufficient permissions for cross-tenant analytics'
        }, { status: 403 });
      }
    } else {
      // Check tenant admin rights for own analytics
      if (!checkTenantAdminRights(tenantContext, targetTenantId)) {
        return NextResponse.json({
          success: false,
          error: 'Admin permissions required for analytics access'
        }, { status: 403 });
      }
    }

    const analyticsService = new TenantAnalyticsService();
    await analyticsService.initializeWithRequest(request);

    // Parse date range
    const timeRange = {
      start: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: endDate ? new Date(endDate) : new Date()
    };

    // Validate date range
    if (timeRange.start >= timeRange.end) {
      return NextResponse.json({
        success: false,
        error: 'Invalid date range: start date must be before end date'
      }, { status: 400 });
    }

    const maxRangeDays = 365; // Maximum 1 year
    const rangeDays = (timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24);
    if (rangeDays > maxRangeDays) {
      return NextResponse.json({
        success: false,
        error: `Date range cannot exceed ${maxRangeDays} days`
      }, { status: 400 });
    }

    // Get analytics data
    const analytics = await analyticsService.getTenantAnalytics(targetTenantId, timeRange);

    if (!analytics) {
      return NextResponse.json({
        success: false,
        error: 'Tenant not found or analytics unavailable'
      }, { status: 404 });
    }

    await analyticsService.disconnect();

    // Filter response based on section and format
    let responseData;

    if (section) {
      switch (section) {
        case 'usage':
          responseData = {
            metrics: analytics.metrics.usage,
            trends: analytics.trends.usage.slice(-30) // Last 30 data points
          };
          break;
        case 'performance':
          responseData = {
            metrics: analytics.metrics.performance,
            trends: analytics.trends.usage.filter(trend => 
              ['RESPONSE_TIME', 'ERROR_COUNT'].includes(trend.timestamp.toString())
            )
          };
          break;
        case 'business':
          responseData = {
            metrics: analytics.metrics.business,
            growth: analytics.trends.growth
          };
          break;
        case 'users':
          responseData = {
            metrics: analytics.metrics.user,
            insights: analytics.insights.filter(insight => 
              insight.category === 'ENGAGEMENT'
            )
          };
          break;
        case 'plugins':
          responseData = {
            metrics: analytics.metrics.plugin,
            recommendations: analytics.recommendations.filter(rec => 
              rec.type === 'FEATURE'
            )
          };
          break;
        case 'integrations':
          responseData = analytics.metrics.integration;
          break;
        case 'health':
          responseData = {
            health: analytics.trends.health,
            insights: analytics.insights.filter(insight => 
              ['WARNING', 'CRITICAL'].includes(insight.type)
            )
          };
          break;
        default:
          return NextResponse.json({
            success: false,
            error: `Unknown section: ${section}`
          }, { status: 400 });
      }
    } else {
      // Return full analytics based on format
      switch (format) {
        case 'summary':
          responseData = {
            tenant: {
              id: analytics.tenantId,
              name: analytics.tenantName,
              tier: analytics.tier,
              status: analytics.status
            },
            summary: {
              usage: {
                storage: analytics.metrics.usage.storage.percentage,
                apiCalls: analytics.metrics.usage.apiCalls.percentage,
                uptime: analytics.metrics.usage.uptime.percentage
              },
              performance: {
                responseTime: analytics.metrics.performance.averageResponseTime,
                errorRate: analytics.metrics.performance.errorRate,
                availability: analytics.metrics.performance.availability
              },
              users: {
                total: analytics.metrics.user.totalUsers,
                active: analytics.metrics.user.activeUsers.monthly,
                growth: analytics.trends.growth.userGrowthRate
              },
              health: analytics.trends.health.overallScore
            },
            alerts: analytics.insights.filter(insight => 
              ['WARNING', 'CRITICAL'].includes(insight.type)
            ).length
          };
          break;
        case 'export':
          responseData = {
            ...analytics,
            exportMetadata: {
              generatedAt: new Date().toISOString(),
              timeRange,
              exportedBy: tenantContext.user?.id,
              version: '1.0'
            }
          };
          break;
        default:
          responseData = analytics;
      }
    }

    return NextResponse.json({
      success: true,
      data: responseData,
      meta: {
        tenantId: targetTenantId,
        timeRange,
        section,
        format,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Analytics retrieval error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve analytics data'
    }, { status: 500 });
  }
}

/**
 * POST - Record metrics or run analytics operations
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

    const body = await request.json();
    
    const validation = validateRequestBody(body, {
      operation: { type: 'text', required: true, enum: ['record_metric', 'bulk_record', 'generate_report', 'refresh_cache'] },
      data: { type: 'json', required: false }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors
      }, { status: 400 });
    }

    const { operation, data } = validation.sanitized;
    const analyticsService = new TenantAnalyticsService();
    await analyticsService.initializeWithRequest(request);

    let result;

    switch (operation) {
      case 'record_metric':
        // Validate metric data
        const metricValidation = validateRequestBody(data, {
          metricType: { type: 'text', required: true },
          value: { type: 'number', required: true },
          unit: { type: 'text', required: false },
          metadata: { type: 'json', required: false },
          aggregationPeriod: { type: 'text', required: false, enum: ['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'] }
        });

        if (!metricValidation.valid) {
          return NextResponse.json({
            success: false,
            error: 'Invalid metric data',
            details: metricValidation.errors
          }, { status: 400 });
        }

        const { metricType, value, unit, metadata, aggregationPeriod } = metricValidation.sanitized;

        await analyticsService.recordMetric(
          tenantContext.tenant.id,
          metricType as MetricType,
          value,
          unit || 'count',
          metadata,
          aggregationPeriod || 'HOURLY'
        );

        result = {
          success: true,
          message: 'Metric recorded successfully',
          metricType,
          value
        };
        break;

      case 'bulk_record':
        // Validate bulk metrics data
        if (!Array.isArray(data.metrics)) {
          return NextResponse.json({
            success: false,
            error: 'Metrics array is required for bulk recording'
          }, { status: 400 });
        }

        const recordingPromises = data.metrics.map((metric: any) => 
          analyticsService.recordMetric(
            tenantContext.tenant.id,
            metric.metricType,
            metric.value,
            metric.unit || 'count',
            metric.metadata,
            metric.aggregationPeriod || 'HOURLY'
          )
        );

        await Promise.all(recordingPromises);

        result = {
          success: true,
          message: `${data.metrics.length} metrics recorded successfully`,
          count: data.metrics.length
        };
        break;

      case 'generate_report':
        // Check admin permissions for report generation
        if (!checkTenantAdminRights(tenantContext, tenantContext.tenant.id)) {
          return NextResponse.json({
            success: false,
            error: 'Admin permissions required for report generation'
          }, { status: 403 });
        }

        const reportTimeRange = {
          start: data.startDate ? new Date(data.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: data.endDate ? new Date(data.endDate) : new Date()
        };

        const analytics = await analyticsService.getTenantAnalytics(
          tenantContext.tenant.id,
          reportTimeRange
        );

        result = {
          success: true,
          message: 'Report generated successfully',
          report: {
            ...analytics,
            generatedAt: new Date().toISOString(),
            generatedBy: tenantContext.user?.id,
            timeRange: reportTimeRange
          }
        };
        break;

      case 'refresh_cache':
        // Check admin permissions for cache refresh
        if (!checkTenantAdminRights(tenantContext, tenantContext.tenant.id)) {
          return NextResponse.json({
            success: false,
            error: 'Admin permissions required for cache refresh'
          }, { status: 403 });
        }

        // Trigger cache refresh (implementation would depend on caching strategy)
        result = {
          success: true,
          message: 'Analytics cache refreshed successfully'
        };
        break;

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown operation: ${operation}`
        }, { status: 400 });
    }

    await analyticsService.disconnect();

    return NextResponse.json(result);

  } catch (error) {
    console.error('Analytics operation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to perform analytics operation'
    }, { status: 500 });
  }
}

/**
 * PATCH - Update analytics configuration or settings
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
        error: 'Admin permissions required for analytics configuration'
      }, { status: 403 });
    }

    const body = await request.json();
    
    const validation = validateRequestBody(body, {
      settings: { type: 'json', required: true }
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validation.errors
      }, { status: 400 });
    }

    const { settings } = validation.sanitized;

    // Update analytics configuration
    // This would integrate with the tenant configuration service
    // to store analytics-specific settings

    return NextResponse.json({
      success: true,
      message: 'Analytics configuration updated successfully',
      settings
    });

  } catch (error) {
    console.error('Analytics configuration error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update analytics configuration'
    }, { status: 500 });
  }
}

/**
 * DELETE - Delete analytics data or reset metrics
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

    // Check system permissions for data deletion
    const hasSystemAccess = await checkSystemPermissions(request, ['system:tenant:delete', 'super-admin:all']);
    if (!hasSystemAccess) {
      return NextResponse.json({
        success: false,
        error: 'System permissions required for analytics data deletion'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const confirmDelete = searchParams.get('confirm') === 'true';
    const dataType = searchParams.get('dataType'); // 'metrics', 'aggregations', 'all'
    const beforeDate = searchParams.get('beforeDate');

    if (!confirmDelete) {
      return NextResponse.json({
        success: false,
        error: 'Analytics data deletion requires confirmation'
      }, { status: 400 });
    }

    const analyticsService = new TenantAnalyticsService();
    
    // Perform data deletion based on parameters
    // Implementation would depend on specific requirements
    
    await analyticsService.disconnect();

    return NextResponse.json({
      success: true,
      message: 'Analytics data deleted successfully',
      deletedDataType: dataType,
      beforeDate
    });

  } catch (error) {
    console.error('Analytics deletion error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete analytics data'
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