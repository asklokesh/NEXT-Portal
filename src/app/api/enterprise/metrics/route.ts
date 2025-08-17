/**
 * Executive Metrics API
 * Provides comprehensive business intelligence and platform metrics for C-level dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenancy/TenantContext';
import { checkSystemAdminRights } from '@/lib/permissions/SystemPermissions';

interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * GET - Retrieve executive metrics and business intelligence
 */
export async function GET(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    // Check system admin rights for executive dashboard access
    if (!checkSystemAdminRights(tenantContext)) {
      return NextResponse.json({
        success: false,
        error: 'Executive dashboard access requires system admin privileges'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || '30d';

    // Calculate date range
    const dateRange = calculateDateRange(timeRange);
    
    // Fetch comprehensive metrics
    const metrics = await fetchExecutiveMetrics(dateRange);

    return NextResponse.json({
      success: true,
      data: metrics,
      metadata: {
        timeRange,
        generatedAt: new Date(),
        dataPoints: metrics.usage.daily.length
      }
    });

  } catch (error) {
    console.error('Executive metrics API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve executive metrics'
    }, { status: 500 });
  }
}

/**
 * Calculate date range based on time range string
 */
function calculateDateRange(timeRange: string): TimeRange {
  const end = new Date();
  const start = new Date();

  switch (timeRange) {
    case '7d':
      start.setDate(end.getDate() - 7);
      break;
    case '30d':
      start.setDate(end.getDate() - 30);
      break;
    case '90d':
      start.setDate(end.getDate() - 90);
      break;
    case '1y':
      start.setFullYear(end.getFullYear() - 1);
      break;
    default:
      start.setDate(end.getDate() - 30);
  }

  return { start, end };
}

/**
 * Fetch comprehensive executive metrics
 */
async function fetchExecutiveMetrics(dateRange: TimeRange) {
  // In a real implementation, these would query actual databases and analytics services
  // For this demo, we return comprehensive mock data that represents enterprise metrics
  
  return {
    platform: {
      totalTenants: 247,
      activeTenants: 189,
      tenantGrowthRate: 12.4,
      totalUsers: 8934,
      activeUsers: 6723,
      userGrowthRate: 18.7,
      systemUptime: 99.97,
      avgResponseTime: 145,
      totalRevenue: 2847000,
      revenueGrowthRate: 23.8,
      churnRate: 3.2,
      customerSatisfaction: 94.3
    },
    
    tenantHealth: {
      healthy: 201,
      warning: 38,
      critical: 8,
      distribution: [
        { tier: 'Enterprise', count: 45, revenue: 1840000, growth: 15.2 },
        { tier: 'Professional', count: 112, revenue: 756000, growth: 22.1 },
        { tier: 'Starter', count: 78, revenue: 234000, growth: 8.9 },
        { tier: 'Free', count: 12, revenue: 0, growth: -2.1 }
      ]
    },
    
    usage: {
      daily: generateDailyUsageData(dateRange),
      features: [
        { feature: 'Software Catalog', usage: 8934, growth: 12.5, adoption: 89.2 },
        { feature: 'CI/CD Pipelines', usage: 6723, growth: 18.3, adoption: 67.8 },
        { feature: 'Tech Docs', usage: 5612, growth: 15.7, adoption: 56.4 },
        { feature: 'Plugin Marketplace', usage: 4589, growth: 25.1, adoption: 46.2 },
        { feature: 'User Management', usage: 8234, growth: 8.9, adoption: 82.9 },
        { feature: 'Analytics Dashboard', usage: 3456, growth: 32.4, adoption: 34.8 },
        { feature: 'Security Scanning', usage: 2890, growth: 28.6, adoption: 29.1 },
        { feature: 'API Gateway', usage: 7123, growth: 19.2, adoption: 71.7 }
      ]
    },
    
    revenue: {
      monthly: generateMonthlyRevenueData(),
      byTier: [
        { tier: 'Enterprise', revenue: 1840000, percentage: 64.6, color: '#3b82f6' },
        { tier: 'Professional', revenue: 756000, percentage: 26.5, color: '#10b981' },
        { tier: 'Starter', revenue: 234000, percentage: 8.2, color: '#f59e0b' },
        { tier: 'Free', revenue: 17000, percentage: 0.6, color: '#6366f1' }
      ]
    },
    
    security: {
      incidents: 12,
      resolved: 48,
      threatLevel: 'LOW' as const,
      complianceScore: 96.8,
      vulnerabilities: {
        critical: 0,
        high: 2,
        medium: 8,
        low: 15
      }
    },
    
    performance: {
      availability: 99.97,
      latency: 145,
      throughput: 12500,
      errorRate: 0.03,
      alerts: generateRecentAlerts()
    }
  };
}

/**
 * Generate daily usage data for the specified date range
 */
function generateDailyUsageData(dateRange: TimeRange) {
  const data = [];
  const currentDate = new Date(dateRange.start);
  
  while (currentDate <= dateRange.end) {
    // Generate realistic usage patterns with some randomness
    const baseUsers = 6500;
    const variance = Math.random() * 1000 - 500;
    const weekendFactor = currentDate.getDay() === 0 || currentDate.getDay() === 6 ? 0.6 : 1;
    
    const users = Math.max(0, Math.round((baseUsers + variance) * weekendFactor));
    const sessions = Math.round(users * (1.2 + Math.random() * 0.3));
    const requests = Math.round(sessions * (50 + Math.random() * 20));
    const errors = Math.round(requests * (0.001 + Math.random() * 0.002));
    
    data.push({
      date: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      users,
      sessions,
      requests,
      errors
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return data;
}

/**
 * Generate monthly revenue data for the past year
 */
function generateMonthlyRevenueData() {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  const data = [];
  const baseRevenue = 180000;
  const baseCosts = 75000;
  const baseTenants = 160;
  
  for (let i = 0; i < 12; i++) {
    // Simulate growth over time with some seasonality
    const growthFactor = 1 + (i * 0.08) + (Math.sin(i * Math.PI / 6) * 0.1);
    const revenue = Math.round(baseRevenue * growthFactor);
    const costs = Math.round(baseCosts * (1 + i * 0.05));
    const profit = revenue - costs;
    const tenants = Math.round(baseTenants * (1 + i * 0.06));
    
    data.push({
      month: months[i],
      revenue,
      costs,
      profit,
      tenants
    });
  }
  
  return data;
}

/**
 * Generate recent system alerts
 */
function generateRecentAlerts() {
  const alertTypes = [
    'High Memory Usage',
    'Database Connection Pool Full',
    'API Rate Limit Exceeded',
    'SSL Certificate Expiry',
    'Disk Space Warning',
    'Plugin Installation Failed',
    'Tenant Provisioning Delay',
    'Security Scan Complete',
    'Backup Completed',
    'User Authentication Failure'
  ];
  
  const severities: ('info' | 'warning' | 'error')[] = ['info', 'warning', 'error'];
  const tenants = ['acme-corp', 'tech-startup', 'enterprise-co', 'dev-team', 'global-inc'];
  
  const alerts = [];
  const now = new Date();
  
  for (let i = 0; i < 15; i++) {
    const alertTime = new Date(now.getTime() - (i * 3600000) - (Math.random() * 3600000));
    const alertType = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const tenant = Math.random() > 0.3 ? tenants[Math.floor(Math.random() * tenants.length)] : undefined;
    
    alerts.push({
      id: `alert-${Date.now()}-${i}`,
      type: alertType,
      severity,
      message: generateAlertMessage(alertType, severity),
      timestamp: alertTime,
      tenant
    });
  }
  
  return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Generate contextual alert messages
 */
function generateAlertMessage(type: string, severity: 'info' | 'warning' | 'error') {
  const messages: Record<string, Record<string, string[]>> = {
    'High Memory Usage': {
      info: ['Memory usage at 75% - monitoring'],
      warning: ['Memory usage at 85% - consider scaling'],
      error: ['Memory usage at 95% - immediate action required']
    },
    'Database Connection Pool Full': {
      info: ['Connection pool usage at 70%'],
      warning: ['Connection pool at 90% capacity'],
      error: ['Connection pool exhausted - new connections failing']
    },
    'API Rate Limit Exceeded': {
      info: ['API usage approaching limits'],
      warning: ['Rate limit at 80% for tenant'],
      error: ['Rate limit exceeded - requests being throttled']
    },
    'SSL Certificate Expiry': {
      info: ['SSL certificate expires in 30 days'],
      warning: ['SSL certificate expires in 7 days'],
      error: ['SSL certificate expired - immediate renewal required']
    },
    'Disk Space Warning': {
      info: ['Disk usage at 75%'],
      warning: ['Disk usage at 90%'],
      error: ['Disk usage at 98% - critical cleanup needed']
    }
  };
  
  const typeMessages = messages[type] || {
    info: [`${type} - informational alert`],
    warning: [`${type} - attention required`],
    error: [`${type} - critical issue detected`]
  };
  
  const severityMessages = typeMessages[severity] || typeMessages.info;
  return severityMessages[Math.floor(Math.random() * severityMessages.length)];
}

/**
 * POST - Trigger executive report generation
 */
export async function POST(request: NextRequest) {
  try {
    const tenantContext = getTenantContext(request);
    if (!tenantContext) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    if (!checkSystemAdminRights(tenantContext)) {
      return NextResponse.json({
        success: false,
        error: 'Executive report generation requires system admin privileges'
      }, { status: 403 });
    }

    const body = await request.json();
    const { reportType, timeRange, includeDetails } = body;

    // In a real implementation, this would trigger report generation
    // and possibly queue it for background processing
    
    return NextResponse.json({
      success: true,
      data: {
        reportId: `exec-report-${Date.now()}`,
        status: 'generating',
        estimatedCompletion: new Date(Date.now() + 300000), // 5 minutes
        reportType,
        timeRange,
        includeDetails
      }
    });

  } catch (error) {
    console.error('Executive report generation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate executive report'
    }, { status: 500 });
  }
}