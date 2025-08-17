import { NextRequest, NextResponse } from 'next/server';
import { errorTracker } from '@/lib/monitoring/error-tracker';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const timeWindow = parseInt(searchParams.get('timeWindow') || '60');
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        const stats = errorTracker.getErrorStats(timeWindow);
        return NextResponse.json({
          success: true,
          data: stats,
        });

      case 'rules':
        const rules = errorTracker.getAlertRules();
        return NextResponse.json({
          success: true,
          data: rules,
        });

      default:
        const errors = errorTracker.getRecentErrors(limit);
        return NextResponse.json({
          success: true,
          data: errors,
        });
    }
  } catch (error) {
    console.error('Error fetching monitoring data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch monitoring data',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...errorData } = body;

    let errorId: string;

    switch (type) {
      case 'client':
        errorId = errorTracker.trackClientError(
          errorData.message,
          errorData.source,
          errorData.lineno,
          errorData.colno,
          errorData.error ? new Error(errorData.error.message) : undefined,
          errorData.userId,
          errorData.sessionId
        );
        break;

      case 'server':
        errorId = errorTracker.trackServerError(
          new Error(errorData.message),
          {
            url: errorData.url,
            method: errorData.method,
            userId: errorData.userId,
            sessionId: errorData.sessionId,
            metadata: errorData.metadata,
          }
        );
        break;

      case 'api':
        errorId = errorTracker.trackApiError(
          errorData.endpoint,
          errorData.statusCode,
          errorData.message,
          {
            method: errorData.method,
            userId: errorData.userId,
            sessionId: errorData.sessionId,
            responseTime: errorData.responseTime,
            metadata: errorData.metadata,
          }
        );
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid error type',
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      errorId,
    });
  } catch (error) {
    console.error('Error tracking error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to track error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'addRule':
        errorTracker.addAlertRule(data.rule);
        return NextResponse.json({
          success: true,
          message: 'Alert rule added successfully',
        });

      case 'removeRule':
        const removed = errorTracker.removeAlertRule(data.ruleId);
        return NextResponse.json({
          success: removed,
          message: removed ? 'Alert rule removed successfully' : 'Alert rule not found',
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action',
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error managing alert rules:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to manage alert rules',
      },
      { status: 500 }
    );
  }
}