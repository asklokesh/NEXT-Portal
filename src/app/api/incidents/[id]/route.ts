import { NextRequest, NextResponse } from 'next/server';
import { IncidentManagementService } from '@/lib/incident-management/service';
import { IntegrationConfig } from '@/lib/incident-management/types';

// Mock configuration
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

const incidentService = new IncidentManagementService(config);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const incident = incidentService.getIncident(params.id);
    
    if (!incident) {
      return NextResponse.json(
        { success: false, error: 'Incident not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      incident
    });

  } catch (error) {
    console.error('Error fetching incident:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch incident' 
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const incident = await incidentService.updateIncident(params.id, body, user);
    
    return NextResponse.json({
      success: true,
      incident
    });

  } catch (error) {
    console.error('Error updating incident:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update incident' 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // In a real system, you might not allow deletion of incidents
    // Instead, you might close or archive them
    const user = {
      id: 'user_1',
      name: 'Current User',
      email: 'user@example.com',
      role: 'SRE',
      contactMethods: [],
      escalationLevel: 1,
      timezone: 'UTC'
    };

    await incidentService.updateIncident(params.id, { status: 'closed' }, user);
    
    return NextResponse.json({
      success: true,
      message: 'Incident closed'
    });

  } catch (error) {
    console.error('Error deleting incident:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to close incident' 
      },
      { status: 500 }
    );
  }
}