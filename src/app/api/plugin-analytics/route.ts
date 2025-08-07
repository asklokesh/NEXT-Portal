import { NextRequest, NextResponse } from 'next/server';

interface PluginAnalytics {
  pluginId: string;
  period: AnalyticsPeriod;
  usage: UsageMetrics;
  performance: PerformanceMetrics;
  engagement: EngagementMetrics;
  errors: ErrorMetrics;
  business: BusinessMetrics;
  insights: AnalyticsInsights[];
}

interface AnalyticsPeriod {
  start: string;
  end: string;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

interface UsageMetrics {
  installs: TimeSeriesData[];
  uninstalls: TimeSeriesData[];
  activeInstalls: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  apiCalls: TimeSeriesData[];
  dataProcessed: TimeSeriesData[];
  features: FeatureUsage[];
}

interface PerformanceMetrics {
  responseTime: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
    trend: TimeSeriesData[];
  };
  throughput: TimeSeriesData[];
  errorRate: TimeSeriesData[];
  availability: number;
  latency: LatencyBreakdown;
  resourceUsage: {
    cpu: TimeSeriesData[];
    memory: TimeSeriesData[];
    network: TimeSeriesData[];
    storage: TimeSeriesData[];
  };
}

interface EngagementMetrics {
  sessionDuration: TimeSeriesData[];
  pageViews: TimeSeriesData[];
  uniqueUsers: TimeSeriesData[];
  retention: {
    day1: number;
    day7: number;
    day30: number;
    cohorts: CohortRetention[];
  };
  userFlow: UserFlowData[];
  interactions: InteractionMetrics;
}

interface ErrorMetrics {
  totalErrors: number;
  errorsByType: ErrorTypeBreakdown[];
  errorTrend: TimeSeriesData[];
  criticalErrors: CriticalError[];
  errorHotspots: ErrorHotspot[];
  mttr: number; // Mean Time To Resolution
}

interface BusinessMetrics {
  revenue: TimeSeriesData[];
  conversions: ConversionFunnel[];
  churn: ChurnMetrics;
  ltv: number; // Lifetime Value
  cac: number; // Customer Acquisition Cost
  roi: number; // Return on Investment
  marketShare: number;
}

interface AnalyticsInsights {
  type: 'trend' | 'anomaly' | 'recommendation' | 'alert';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  metric: string;
  value: any;
  change: number;
  recommendation?: string;
  timestamp: string;
}

interface TimeSeriesData {
  timestamp: string;
  value: number;
  metadata?: Record<string, any>;
}

interface FeatureUsage {
  feature: string;
  usageCount: number;
  uniqueUsers: number;
  avgTimeSpent: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

interface LatencyBreakdown {
  database: number;
  api: number;
  network: number;
  processing: number;
  total: number;
}

interface CohortRetention {
  cohort: string;
  size: number;
  retention: number[];
}

interface UserFlowData {
  path: string[];
  count: number;
  conversionRate: number;
  dropoffPoints: string[];
}

interface InteractionMetrics {
  clicks: number;
  scrollDepth: number;
  formSubmissions: number;
  videoPlays: number;
  downloads: number;
}

interface ErrorTypeBreakdown {
  type: string;
  count: number;
  percentage: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

interface CriticalError {
  id: string;
  message: string;
  stack: string;
  occurrences: number;
  affectedUsers: number;
  firstSeen: string;
  lastSeen: string;
}

interface ErrorHotspot {
  file: string;
  line: number;
  errorCount: number;
  errorTypes: string[];
}

interface ConversionFunnel {
  stage: string;
  users: number;
  conversionRate: number;
  dropoffRate: number;
}

interface ChurnMetrics {
  rate: number;
  trend: TimeSeriesData[];
  reasons: ChurnReason[];
  predictedChurn: number;
}

interface ChurnReason {
  reason: string;
  count: number;
  percentage: number;
}

// Analytics data store (in production, use TimescaleDB or ClickHouse)
const analyticsStore = new Map<string, PluginAnalytics>();

// Generate time series data
const generateTimeSeries = (
  start: Date,
  end: Date,
  granularity: AnalyticsPeriod['granularity'],
  generator: (date: Date) => number
): TimeSeriesData[] => {
  const data: TimeSeriesData[] = [];
  const current = new Date(start);
  
  const increment = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000
  }[granularity];
  
  while (current <= end) {
    data.push({
      timestamp: current.toISOString(),
      value: generator(current)
    });
    current.setTime(current.getTime() + increment);
  }
  
  return data;
};

// Analyze trends
const analyzeTrends = (data: TimeSeriesData[]): 'increasing' | 'stable' | 'decreasing' => {
  if (data.length < 2) return 'stable';
  
  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));
  
  const firstAvg = firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + d.value, 0) / secondHalf.length;
  
  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
  
  if (changePercent > 10) return 'increasing';
  if (changePercent < -10) return 'decreasing';
  return 'stable';
};

// Detect anomalies
const detectAnomalies = (data: TimeSeriesData[]): AnalyticsInsights[] => {
  const insights: AnalyticsInsights[] = [];
  
  if (data.length < 10) return insights;
  
  // Calculate mean and standard deviation
  const values = data.map(d => d.value);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  
  // Detect outliers (values beyond 2 standard deviations)
  data.forEach((point, index) => {
    if (Math.abs(point.value - mean) > 2 * stdDev) {
      insights.push({
        type: 'anomaly',
        severity: Math.abs(point.value - mean) > 3 * stdDev ? 'critical' : 'warning',
        title: 'Anomaly Detected',
        description: `Unusual value detected: ${point.value.toFixed(2)} (expected: ${mean.toFixed(2)} ± ${(2 * stdDev).toFixed(2)})`,
        metric: 'value',
        value: point.value,
        change: ((point.value - mean) / mean) * 100,
        recommendation: point.value > mean 
          ? 'Investigate the cause of this spike. Consider scaling resources if this represents increased load.'
          : 'Investigate the cause of this drop. Check for service disruptions or data collection issues.',
        timestamp: point.timestamp
      });
    }
  });
  
  return insights;
};

// Generate insights
const generateInsights = (analytics: PluginAnalytics): AnalyticsInsights[] => {
  const insights: AnalyticsInsights[] = [];
  
  // Performance insights
  if (analytics.performance.responseTime.p95 > 1000) {
    insights.push({
      type: 'alert',
      severity: 'warning',
      title: 'High Response Time',
      description: `P95 response time is ${analytics.performance.responseTime.p95}ms, which exceeds the recommended threshold of 1000ms`,
      metric: 'responseTime.p95',
      value: analytics.performance.responseTime.p95,
      change: 0,
      recommendation: 'Consider optimizing database queries, implementing caching, or scaling your infrastructure.',
      timestamp: new Date().toISOString()
    });
  }
  
  // Engagement insights
  const retentionDrop = analytics.engagement.retention.day1 - analytics.engagement.retention.day7;
  if (retentionDrop > 30) {
    insights.push({
      type: 'alert',
      severity: 'critical',
      title: 'High User Churn',
      description: `${retentionDrop.toFixed(1)}% of users are not returning after the first week`,
      metric: 'retention',
      value: analytics.engagement.retention.day7,
      change: -retentionDrop,
      recommendation: 'Improve onboarding experience, send engagement emails, or add more compelling features.',
      timestamp: new Date().toISOString()
    });
  }
  
  // Error insights
  if (analytics.errors.errorRate.length > 0) {
    const errorTrend = analyzeTrends(analytics.errors.errorRate);
    if (errorTrend === 'increasing') {
      insights.push({
        type: 'alert',
        severity: 'critical',
        title: 'Increasing Error Rate',
        description: 'Error rate is trending upward, indicating potential stability issues',
        metric: 'errorRate',
        value: analytics.errors.totalErrors,
        change: 25, // Simplified
        recommendation: 'Review recent deployments, check error logs, and implement better error handling.',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Business insights
  if (analytics.business.churn.rate > 5) {
    insights.push({
      type: 'recommendation',
      severity: 'warning',
      title: 'High Churn Rate',
      description: `Monthly churn rate is ${analytics.business.churn.rate.toFixed(1)}%, which is above industry average`,
      metric: 'churnRate',
      value: analytics.business.churn.rate,
      change: 0,
      recommendation: 'Analyze churn reasons, improve customer success programs, and consider retention incentives.',
      timestamp: new Date().toISOString()
    });
  }
  
  // Add anomaly detection for time series data
  insights.push(...detectAnomalies(analytics.usage.apiCalls));
  
  return insights;
};

// Generate mock analytics data
const generateMockAnalytics = (pluginId: string, period: AnalyticsPeriod): PluginAnalytics => {
  const start = new Date(period.start);
  const end = new Date(period.end);
  
  // Generate usage metrics
  const usage: UsageMetrics = {
    installs: generateTimeSeries(start, end, period.granularity, () => Math.floor(Math.random() * 50) + 10),
    uninstalls: generateTimeSeries(start, end, period.granularity, () => Math.floor(Math.random() * 5)),
    activeInstalls: Math.floor(Math.random() * 1000) + 100,
    dailyActiveUsers: Math.floor(Math.random() * 500) + 50,
    weeklyActiveUsers: Math.floor(Math.random() * 2000) + 200,
    monthlyActiveUsers: Math.floor(Math.random() * 5000) + 500,
    apiCalls: generateTimeSeries(start, end, period.granularity, () => Math.floor(Math.random() * 10000) + 1000),
    dataProcessed: generateTimeSeries(start, end, period.granularity, () => Math.floor(Math.random() * 1000) + 100),
    features: [
      { feature: 'Dashboard', usageCount: 5000, uniqueUsers: 800, avgTimeSpent: 180, trend: 'increasing' },
      { feature: 'Reports', usageCount: 3000, uniqueUsers: 600, avgTimeSpent: 120, trend: 'stable' },
      { feature: 'Settings', usageCount: 1000, uniqueUsers: 400, avgTimeSpent: 60, trend: 'decreasing' }
    ]
  };
  
  // Generate performance metrics
  const performance: PerformanceMetrics = {
    responseTime: {
      p50: 150,
      p75: 250,
      p90: 500,
      p95: 800,
      p99: 1500,
      trend: generateTimeSeries(start, end, period.granularity, () => Math.random() * 200 + 100)
    },
    throughput: generateTimeSeries(start, end, period.granularity, () => Math.floor(Math.random() * 1000) + 500),
    errorRate: generateTimeSeries(start, end, period.granularity, () => Math.random() * 5),
    availability: 99.95,
    latency: {
      database: 50,
      api: 100,
      network: 30,
      processing: 70,
      total: 250
    },
    resourceUsage: {
      cpu: generateTimeSeries(start, end, period.granularity, () => Math.random() * 80 + 10),
      memory: generateTimeSeries(start, end, period.granularity, () => Math.random() * 70 + 20),
      network: generateTimeSeries(start, end, period.granularity, () => Math.random() * 100),
      storage: generateTimeSeries(start, end, period.granularity, () => Math.random() * 50 + 10)
    }
  };
  
  // Generate engagement metrics
  const engagement: EngagementMetrics = {
    sessionDuration: generateTimeSeries(start, end, period.granularity, () => Math.random() * 600 + 60),
    pageViews: generateTimeSeries(start, end, period.granularity, () => Math.floor(Math.random() * 5000) + 1000),
    uniqueUsers: generateTimeSeries(start, end, period.granularity, () => Math.floor(Math.random() * 1000) + 100),
    retention: {
      day1: 85,
      day7: 45,
      day30: 25,
      cohorts: [
        { cohort: '2024-01', size: 1000, retention: [100, 85, 65, 45, 35, 30, 25] },
        { cohort: '2024-02', size: 1200, retention: [100, 88, 68, 48, 38, 33, 28] }
      ]
    },
    userFlow: [
      { path: ['Home', 'Dashboard', 'Reports'], count: 500, conversionRate: 0.75, dropoffPoints: ['Dashboard'] },
      { path: ['Home', 'Settings', 'Profile'], count: 200, conversionRate: 0.60, dropoffPoints: ['Settings'] }
    ],
    interactions: {
      clicks: 50000,
      scrollDepth: 75,
      formSubmissions: 500,
      videoPlays: 100,
      downloads: 250
    }
  };
  
  // Generate error metrics
  const errors: ErrorMetrics = {
    totalErrors: Math.floor(Math.random() * 500) + 50,
    errorsByType: [
      { type: 'TypeError', count: 150, percentage: 30, trend: 'decreasing' },
      { type: 'NetworkError', count: 100, percentage: 20, trend: 'stable' },
      { type: 'ValidationError', count: 250, percentage: 50, trend: 'increasing' }
    ],
    errorTrend: generateTimeSeries(start, end, period.granularity, () => Math.floor(Math.random() * 50) + 5),
    criticalErrors: [
      {
        id: 'err-001',
        message: 'Cannot read property of undefined',
        stack: 'at Dashboard.render (dashboard.js:45)',
        occurrences: 45,
        affectedUsers: 20,
        firstSeen: start.toISOString(),
        lastSeen: end.toISOString()
      }
    ],
    errorHotspots: [
      { file: 'dashboard.js', line: 45, errorCount: 30, errorTypes: ['TypeError'] },
      { file: 'api-client.js', line: 120, errorCount: 25, errorTypes: ['NetworkError'] }
    ],
    mttr: 45 // minutes
  };
  
  // Generate business metrics
  const business: BusinessMetrics = {
    revenue: generateTimeSeries(start, end, period.granularity, () => Math.random() * 10000 + 5000),
    conversions: [
      { stage: 'Visit', users: 10000, conversionRate: 1.0, dropoffRate: 0 },
      { stage: 'Trial', users: 2000, conversionRate: 0.2, dropoffRate: 0.8 },
      { stage: 'Purchase', users: 400, conversionRate: 0.2, dropoffRate: 0.8 },
      { stage: 'Renewal', users: 350, conversionRate: 0.875, dropoffRate: 0.125 }
    ],
    churn: {
      rate: 3.5,
      trend: generateTimeSeries(start, end, period.granularity, () => Math.random() * 2 + 2),
      reasons: [
        { reason: 'Price', count: 30, percentage: 40 },
        { reason: 'Features', count: 25, percentage: 33 },
        { reason: 'Support', count: 20, percentage: 27 }
      ],
      predictedChurn: 4.2
    },
    ltv: 2500,
    cac: 500,
    roi: 400,
    marketShare: 15.5
  };
  
  const analytics: PluginAnalytics = {
    pluginId,
    period,
    usage,
    performance,
    engagement,
    errors,
    business,
    insights: []
  };
  
  // Generate insights based on the data
  analytics.insights = generateInsights(analytics);
  
  return analytics;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'track_event': {
        const { pluginId, event, properties } = body;
        
        // In production, send to analytics service (Segment, Mixpanel, etc.)
        console.log(`Tracking event for ${pluginId}:`, event, properties);
        
        return NextResponse.json({
          success: true,
          message: 'Event tracked successfully'
        });
      }

      case 'generate_report': {
        const { pluginId, period, format = 'json' } = body;
        
        const analytics = generateMockAnalytics(pluginId, period);
        
        if (format === 'pdf') {
          // In production, generate PDF report
          return NextResponse.json({
            success: true,
            message: 'PDF report generation not implemented in demo',
            analytics
          });
        }
        
        return NextResponse.json({
          success: true,
          analytics
        });
      }

      case 'export_data': {
        const { pluginId, period, metrics } = body;
        
        const analytics = generateMockAnalytics(pluginId, period);
        
        // Filter to requested metrics
        const exportData: any = {};
        if (metrics.includes('usage')) exportData.usage = analytics.usage;
        if (metrics.includes('performance')) exportData.performance = analytics.performance;
        if (metrics.includes('engagement')) exportData.engagement = analytics.engagement;
        if (metrics.includes('errors')) exportData.errors = analytics.errors;
        if (metrics.includes('business')) exportData.business = analytics.business;
        
        return NextResponse.json({
          success: true,
          data: exportData,
          format: 'json',
          timestamp: new Date().toISOString()
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process analytics request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('endDate') || new Date().toISOString();
    const granularity = (searchParams.get('granularity') || 'day') as AnalyticsPeriod['granularity'];

    if (!pluginId) {
      return NextResponse.json({
        success: false,
        error: 'Plugin ID is required'
      }, { status: 400 });
    }

    const period: AnalyticsPeriod = {
      start: startDate,
      end: endDate,
      granularity
    };

    const analytics = generateMockAnalytics(pluginId, period);
    
    // Store for future reference
    analyticsStore.set(`${pluginId}_${startDate}_${endDate}`, analytics);

    return NextResponse.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('Analytics API GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch analytics data'
    }, { status: 500 });
  }
}