import { NextRequest, NextResponse } from 'next/server';
import { AlertDetector } from '@/lib/incident-management/alert-detector';
import { PrometheusClient } from '@/lib/incident-management/integrations/prometheus';
import { GrafanaClient } from '@/lib/incident-management/integrations/grafana';
import { WebSocketService } from '@/lib/websocket/WebSocketService';

// Mock configuration
const prometheusConfig = {
  enabled: process.env.PROMETHEUS_ENABLED === 'true',
  url: process.env.PROMETHEUS_URL || 'http://prometheus:9090',
  queries: []
};

const grafanaConfig = {
  enabled: process.env.GRAFANA_ENABLED === 'true',
  url: process.env.GRAFANA_URL || '',
  apiKey: process.env.GRAFANA_API_KEY || '',
  dashboards: []
};

// Initialize services
const prometheusClient = new PrometheusClient(prometheusConfig);
const grafanaClient = new GrafanaClient(grafanaConfig);
const webSocketService = new WebSocketService();
const alertDetector = new AlertDetector(prometheusClient, grafanaClient, webSocketService);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters = {
      status: searchParams.get('status'),
      severity: searchParams.get('severity'),
      source: searchParams.get('source'),
      range: searchParams.get('range') || '24h',
      limit: parseInt(searchParams.get('limit') || '100'),
      offset: parseInt(searchParams.get('offset') || '0')
    };

    // Get active alerts
    let alerts = alertDetector.getActiveAlerts();

    // Apply filters
    if (filters.status && filters.status !== 'all') {
      alerts = alerts.filter(alert => alert.status === filters.status);
    }

    if (filters.severity && filters.severity !== 'all') {
      alerts = alerts.filter(alert => alert.severity === filters.severity);
    }

    if (filters.source && filters.source !== 'all') {
      alerts = alerts.filter(alert => alert.source === filters.source);
    }

    // Apply time range filter
    const now = new Date();
    let startTime: Date;
    
    switch (filters.range) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    alerts = alerts.filter(alert => alert.timestamp >= startTime);

    // Apply pagination
    const paginatedAlerts = alerts.slice(filters.offset, filters.offset + filters.limit);

    return NextResponse.json({
      success: true,
      alerts: paginatedAlerts,
      total: alerts.length,
      filters
    });

  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch alerts' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const source = request.headers.get('x-alert-source') || 'webhook';

    // Process webhook alert
    const alerts = await alertDetector.processWebhookAlert(body, source);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${alerts.length} alerts`,
      alerts
    }, { status: 201 });

  } catch (error) {
    console.error('Error processing alert webhook:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process alert' 
      },
      { status: 500 }
    );
  }
}