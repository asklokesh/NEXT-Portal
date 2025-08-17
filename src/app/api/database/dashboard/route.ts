/**
 * Database Performance Dashboard API
 * Provides real-time database monitoring data
 */

import { NextRequest, NextResponse } from 'next/server';
import { databaseMonitoring } from '@/services/database/monitoring.service';

export async function GET(request: NextRequest) {
  try {
    // Get dashboard data from monitoring service
    const dashboardData = await databaseMonitoring.getDashboardData();
    
    return NextResponse.json(dashboardData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Database dashboard API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch database dashboard data',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'trigger_health_check':
        const health = await databaseMonitoring.checkHealth();
        return NextResponse.json({ health });

      case 'get_slow_queries':
        const { limit = 50 } = body;
        const slowQueries = databaseMonitoring.getSlowQueries(limit);
        return NextResponse.json({ slowQueries });

      case 'get_metrics':
        const { timeRange = 'hour' } = body;
        const metrics = await databaseMonitoring.getPerformanceMetrics(timeRange);
        return NextResponse.json({ metrics });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Database dashboard API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process database dashboard request',
        details: error.message 
      },
      { status: 500 }
    );
  }
}