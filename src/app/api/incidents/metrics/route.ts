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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '24h';
    
    // Parse time range
    const now = new Date();
    let start: Date;
    
    switch (range) {
      case '1h':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const period = { start, end: now };
    const statistics = await incidentService.getIncidentStatistics(period);
    
    // Generate additional dashboard metrics
    const incidents = incidentService.getIncidents();
    const activeIncidents = incidents.filter(i => !['resolved', 'closed'].includes(i.status));
    const criticalIncidents = activeIncidents.filter(i => i.severity === 'critical');
    
    // Mock additional metrics
    const dashboardMetrics = {
      activeIncidents: activeIncidents.length,
      totalIncidents: statistics.totalIncidents,
      mttr: statistics.mttr.overall,
      mtta: statistics.mtta.overall,
      slaCompliance: 98.5, // Mock SLA compliance
      criticalIncidents: criticalIncidents.length,
      
      // Trends data
      trendsData: generateTrendsData(range),
      
      // Severity distribution
      severityDistribution: [
        { severity: 'Critical', count: statistics.incidentsBySeverity.critical || 0, color: '#dc2626' },
        { severity: 'High', count: statistics.incidentsBySeverity.high || 0, color: '#ea580c' },
        { severity: 'Medium', count: statistics.incidentsBySeverity.medium || 0, color: '#ca8a04' },
        { severity: 'Low', count: statistics.incidentsBySeverity.low || 0, color: '#2563eb' }
      ],
      
      // Service impact
      serviceImpact: Object.entries(statistics.incidentsByService).map(([service, count]) => ({
        service,
        incidents: count,
        status: count > 2 ? 'degraded' : count > 0 ? 'degraded' : 'healthy'
      })),
      
      // Team load (mock data)
      responseTeamLoad: [
        { team: 'SRE Team', activeIncidents: Math.floor(activeIncidents.length * 0.4), load: 65 },
        { team: 'Backend Team', activeIncidents: Math.floor(activeIncidents.length * 0.3), load: 45 },
        { team: 'Frontend Team', activeIncidents: Math.floor(activeIncidents.length * 0.2), load: 30 },
        { team: 'DevOps Team', activeIncidents: Math.floor(activeIncidents.length * 0.1), load: 20 }
      ]
    };
    
    return NextResponse.json({
      success: true,
      ...dashboardMetrics,
      period,
      range
    });

  } catch (error) {
    console.error('Error fetching incident metrics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch metrics' 
      },
      { status: 500 }
    );
  }
}

function generateTrendsData(range: string) {
  const points = range === '1h' ? 12 : range === '24h' ? 24 : range === '7d' ? 7 : 30;
  const data = [];
  
  for (let i = points - 1; i >= 0; i--) {
    let time: string;
    
    if (range === '1h') {
      const date = new Date(Date.now() - i * 5 * 60 * 1000);
      time = date.getHours().toString().padStart(2, '0') + ':' + 
             date.getMinutes().toString().padStart(2, '0');
    } else if (range === '24h') {
      const date = new Date(Date.now() - i * 60 * 60 * 1000);
      time = date.getHours().toString().padStart(2, '0') + ':00';
    } else if (range === '7d') {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      time = date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      time = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    data.push({
      time,
      incidents: Math.floor(Math.random() * 5) + 1,
      resolved: Math.floor(Math.random() * 4) + 1,
      alerts: Math.floor(Math.random() * 10) + 5
    });
  }
  
  return data;
}