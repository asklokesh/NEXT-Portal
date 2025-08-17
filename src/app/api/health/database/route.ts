/**
 * Database Health Check API Endpoint
 * 
 * Provides comprehensive database health monitoring for production deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database/simple-client';
import { databaseMonitor } from '@/lib/database/simple-monitoring';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Perform basic connection test
    const isConnected = await db.healthCheck();
    
    if (!isConnected) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          error: 'Database connection failed',
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - startTime
        },
        { status: 503 }
      );
    }

    // Get comprehensive health status
    const healthStatus = databaseMonitor.getHealthStatus();
    const connectionMetrics = db.getMetrics();
    const circuitBreakerState = db.getCircuitBreakerState();

    // Determine overall health status
    const overallStatus = healthStatus.status === 'healthy' ? 'healthy' : 
                         healthStatus.status === 'degraded' ? 'degraded' : 'unhealthy';

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        uptime: healthStatus.uptime,
        database: {
          connected: true,
          lastCheck: healthStatus.lastCheck,
          responseTime: healthStatus.responseTime
        },
        connections: {
          total: connectionMetrics.totalConnections,
          active: connectionMetrics.activeConnections,
          idle: connectionMetrics.idleConnections,
          waiting: connectionMetrics.waitingConnections,
          errors: connectionMetrics.connectionErrors
        },
        queries: {
          total: connectionMetrics.totalQueries,
          failed: connectionMetrics.failedQueries,
          slow: connectionMetrics.slowQueries,
          averageTime: connectionMetrics.averageQueryTime
        },
        circuitBreaker: {
          state: circuitBreakerState.state,
          failures: circuitBreakerState.failures,
          nextAttempt: circuitBreakerState.nextAttempt
        },
        alerts: healthStatus.alerts.map(alert => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.timestamp
        })),
        issues: healthStatus.issues.map(issue => ({
          id: issue.id,
          category: issue.category,
          severity: issue.severity,
          description: issue.description,
          timestamp: issue.timestamp,
          recommendations: issue.recommendations
        }))
      },
      { status: statusCode }
    );

  } catch (error) {
    console.error('Database health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        database: {
          connected: false
        }
      },
      { status: 503 }
    );
  }
}

// Also support POST for detailed diagnostics
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { runDiagnostics = false } = await request.json();
    
    const healthStatus = databaseMonitor.getHealthStatus();
    
    let diagnostics = {};
    if (runDiagnostics) {
      diagnostics = await databaseMonitor.runDiagnostics();
    }

    return NextResponse.json({
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      health: healthStatus,
      diagnostics: runDiagnostics ? diagnostics : null
    });

  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}