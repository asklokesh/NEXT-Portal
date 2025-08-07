import { NextRequest, NextResponse } from 'next/server';
import { IncidentManagementService } from '@/lib/incident-management/service';
import { IntegrationConfig } from '@/lib/incident-management/types';

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { reason } = await request.json();
    
    if (!reason) {
      return NextResponse.json(
        { success: false, error: 'Escalation reason is required' },
        { status: 400 }
      );
    }

    await incidentService.escalateIncident(params.id, reason);
    
    const incident = incidentService.getIncident(params.id);
    
    return NextResponse.json({
      success: true,
      incident,
      message: 'Incident escalated successfully'
    });

  } catch (error) {
    console.error('Error escalating incident:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to escalate incident' 
      },
      { status: 500 }
    );
  }
}