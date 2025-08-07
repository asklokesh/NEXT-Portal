import { NextRequest, NextResponse } from 'next/server';
import { TemplateAnalyticsEngine } from '@/lib/scaffolder-v2/analytics-engine';

const analyticsEngine = TemplateAnalyticsEngine.getInstance();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'template', 'dashboard', 'comparative', 'performance', 'behavior'
    const templateId = searchParams.get('templateId');
    const userId = searchParams.get('userId');
    const period = (searchParams.get('period') as 'day' | 'week' | 'month' | 'year') || 'week';

    switch (type) {
      case 'template':
        if (!templateId) {
          return NextResponse.json(
            { error: 'Template ID is required for template analytics' },
            { status: 400 }
          );
        }

        const templateAnalytics = await analyticsEngine.getTemplateAnalytics(templateId, period);
        return NextResponse.json(templateAnalytics);

      case 'dashboard':
        const dashboardAnalytics = await analyticsEngine.getDashboardAnalytics(
          userId || undefined,
          period
        );
        return NextResponse.json(dashboardAnalytics);

      case 'comparative':
        const templateIds = searchParams.get('templateIds')?.split(',');
        if (!templateIds || templateIds.length === 0) {
          return NextResponse.json(
            { error: 'Template IDs are required for comparative analytics' },
            { status: 400 }
          );
        }

        const comparativeAnalytics = await analyticsEngine.getComparativeAnalytics(templateIds);
        return NextResponse.json(comparativeAnalytics);

      case 'performance':
        if (!templateId) {
          return NextResponse.json(
            { error: 'Template ID is required for performance analytics' },
            { status: 400 }
          );
        }

        const performanceAnalytics = await analyticsEngine.getPerformanceAnalytics(templateId);
        return NextResponse.json(performanceAnalytics);

      case 'behavior':
        if (!templateId) {
          return NextResponse.json(
            { error: 'Template ID is required for behavior analytics' },
            { status: 400 }
          );
        }

        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const timeRange = startDate && endDate ? {
          start: new Date(startDate),
          end: new Date(endDate)
        } : undefined;

        const behaviorAnalytics = await analyticsEngine.getUserBehaviorAnalytics(
          templateId,
          timeRange
        );
        return NextResponse.json(behaviorAnalytics);

      case 'trends':
        if (!templateId) {
          return NextResponse.json(
            { error: 'Template ID is required for trend analytics' },
            { status: 400 }
          );
        }

        const metric = (searchParams.get('metric') as 'views' | 'downloads' | 'executions' | 'success_rate') || 'executions';
        const trends = await analyticsEngine.getUsageTrends(templateId, period, metric);
        return NextResponse.json({ trends, metric, period });

      case 'export':
        if (!templateId) {
          return NextResponse.json(
            { error: 'Template ID is required for export' },
            { status: 400 }
          );
        }

        const format = (searchParams.get('format') as 'json' | 'csv' | 'excel') || 'json';
        const exportData = await analyticsEngine.exportAnalytics(templateId, format, period);

        if (format === 'json') {
          return new Response(exportData as string, {
            headers: {
              'Content-Type': 'application/json',
              'Content-Disposition': `attachment; filename="template-analytics-${templateId}.json"`
            }
          });
        } else if (format === 'csv') {
          return new Response(exportData as string, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': `attachment; filename="template-analytics-${templateId}.csv"`
            }
          });
        } else {
          return new Response(exportData as Buffer, {
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'Content-Disposition': `attachment; filename="template-analytics-${templateId}.xlsx"`
            }
          });
        }

      default:
        // Default to dashboard analytics
        const defaultAnalytics = await analyticsEngine.getDashboardAnalytics(
          userId || undefined,
          period
        );
        return NextResponse.json(defaultAnalytics);
    }
  } catch (error) {
    console.error('Error getting analytics:', error);
    
    if ((error as Error).message.includes('not found')) {
      return NextResponse.json(
        { error: 'Analytics data not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to get analytics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, templateId, userId, data } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'track-view':
        await analyticsEngine.trackView(templateId, userId, data?.source);
        return NextResponse.json({ success: true, message: 'View tracked' });

      case 'track-download':
        await analyticsEngine.trackDownload(templateId, userId);
        return NextResponse.json({ success: true, message: 'Download tracked' });

      case 'track-execution':
        const { execution } = data;
        if (!execution) {
          return NextResponse.json(
            { error: 'Execution data is required' },
            { status: 400 }
          );
        }
        
        await analyticsEngine.trackExecution(execution);
        return NextResponse.json({ success: true, message: 'Execution tracked' });

      case 'track-rating':
        const { rating, review } = data;
        if (!userId || !rating) {
          return NextResponse.json(
            { error: 'User ID and rating are required' },
            { status: 400 }
          );
        }

        await analyticsEngine.trackRating(templateId, userId, rating, review);
        return NextResponse.json({ success: true, message: 'Rating tracked' });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error tracking analytics:', error);
    return NextResponse.json(
      { error: 'Failed to track analytics' },
      { status: 500 }
    );
  }
}