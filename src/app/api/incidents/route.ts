import { NextRequest, NextResponse } from 'next/server';
import { IncidentManagementService } from '@/lib/incident-management/service';
import { IntegrationConfig } from '@/lib/incident-management/types';

// Mock configuration - in production, load from environment/config
const config: IntegrationConfig = {
  pagerDuty: {
    enabled: process.env.PAGERDUTY_ENABLED === 'true',
    apiKey: process.env.PAGERDUTY_API_KEY || '',
    serviceId: process.env.PAGERDUTY_SERVICE_ID || '',
    webhookSecret: process.env.PAGERDUTY_WEBHOOK_SECRET || '',
    routingKey: process.env.PAGERDUTY_ROUTING_KEY || ''
  },
  opsgenie: {
    enabled: process.env.OPSGENIE_ENABLED === 'true',
    apiKey: process.env.OPSGENIE_API_KEY || '',
    teamId: process.env.OPSGENIE_TEAM_ID || '',
    webhookUrl: process.env.OPSGENIE_WEBHOOK_URL || ''
  },
  slack: {
    enabled: process.env.SLACK_ENABLED === 'true',
    botToken: process.env.SLACK_BOT_TOKEN || '',
    channels: []
  },
  grafana: {
    enabled: process.env.GRAFANA_ENABLED === 'true',
    url: process.env.GRAFANA_URL || '',
    apiKey: process.env.GRAFANA_API_KEY || '',
    dashboards: []
  },
  prometheus: {
    enabled: process.env.PROMETHEUS_ENABLED === 'true',
    url: process.env.PROMETHEUS_URL || 'http://prometheus:9090',
    queries: []
  }
};

// Initialize service
const incidentService = new IncidentManagementService(config);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters = {
      status: searchParams.get('status'),
      severity: searchParams.get('severity'),
      service: searchParams.get('service'),
      range: searchParams.get('range') || '24h',
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0')
    };

    // Remove null values
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== null && value !== undefined)
    );

    const incidents = incidentService.getIncidents(cleanFilters);
    
    return NextResponse.json({
      success: true,
      incidents: incidents.slice(cleanFilters.offset, cleanFilters.offset + cleanFilters.limit),
      total: incidents.length,
      filters: cleanFilters
    });

  } catch (error) {
    console.error('Error fetching incidents:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch incidents' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Get user from auth context (mock for now)
    const user = {
      id: 'user_1',
      name: 'Current User',
      email: 'user@example.com',
      role: 'SRE',
      contactMethods: [],
      escalationLevel: 1,
      timezone: 'UTC'
    };

    const incident = await incidentService.createIncident(body, user);
    
    return NextResponse.json({
      success: true,
      incident
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating incident:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create incident' 
      },
      { status: 500 }
    );
  }
}