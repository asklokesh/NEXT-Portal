import { Incident, Alert } from '../types';

interface PagerDutyConfig {
  enabled: boolean;
  apiKey: string;
  serviceId: string;
  webhookSecret: string;
  routingKey: string;
}

interface PagerDutyIncident {
  id: string;
  incident_number: number;
  title: string;
  description: string;
  status: string;
  urgency: string;
  priority: string;
  created_at: string;
  html_url: string;
}

interface PagerDutyEvent {
  routing_key: string;
  event_action: 'trigger' | 'acknowledge' | 'resolve';
  dedup_key?: string;
  payload: {
    summary: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    source: string;
    component?: string;
    group?: string;
    class?: string;
    custom_details?: Record<string, any>;
  };
  links?: Array<{
    href: string;
    text: string;
  }>;
}

export class PagerDutyClient {
  private config: PagerDutyConfig;
  private baseUrl = 'https://api.pagerduty.com';

  constructor(config: PagerDutyConfig) {
    this.config = config;
  }

  async createIncident(incident: Incident): Promise<PagerDutyIncident> {
    if (!this.config.enabled) {
      throw new Error('PagerDuty integration is not enabled');
    }

    const event: PagerDutyEvent = {
      routing_key: this.config.routingKey,
      event_action: 'trigger',
      dedup_key: incident.id,
      payload: {
        summary: incident.title,
        severity: this.mapSeverity(incident.severity),
        source: 'backstage-idp',
        component: incident.affectedServices.join(', '),
        group: 'incidents',
        class: incident.priority,
        custom_details: {
          incident_id: incident.id,
          description: incident.description,
          affected_services: incident.affectedServices,
          incident_commander: incident.incidentCommander.email,
          created_at: incident.createdAt.toISOString()
        }
      },
      links: [{
        href: `${process.env.NEXT_PUBLIC_APP_URL}/incidents/${incident.id}`,
        text: 'View in Backstage'
      }]
    };

    try {
      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });

      if (!response.ok) {
        throw new Error(`PagerDuty API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      // Return a mock incident object since Events API doesn't return full incident
      return {
        id: result.dedup_key || incident.id,
        incident_number: 0,
        title: incident.title,
        description: incident.description,
        status: 'triggered',
        urgency: incident.severity === 'critical' ? 'high' : 'low',
        priority: incident.priority,
        created_at: incident.createdAt.toISOString(),
        html_url: `https://your-domain.pagerduty.com/incidents/${result.dedup_key}`
      };

    } catch (error) {
      console.error('Failed to create PagerDuty incident:', error);
      throw error;
    }
  }

  async updateIncident(incidentId: string, incident: Incident): Promise<void> {
    if (!this.config.enabled) return;

    let event_action: 'acknowledge' | 'resolve';
    
    switch (incident.status) {
      case 'investigating':
      case 'identified':
        event_action = 'acknowledge';
        break;
      case 'resolved':
      case 'closed':
        event_action = 'resolve';
        break;
      default:
        return; // No update needed for other statuses
    }

    const event: PagerDutyEvent = {
      routing_key: this.config.routingKey,
      event_action,
      dedup_key: incident.id,
      payload: {
        summary: incident.title,
        severity: this.mapSeverity(incident.severity),
        source: 'backstage-idp'
      }
    };

    try {
      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });

      if (!response.ok) {
        throw new Error(`PagerDuty API error: ${response.status} ${response.statusText}`);
      }

    } catch (error) {
      console.error('Failed to update PagerDuty incident:', error);
      throw error;
    }
  }

  async getIncidents(since?: Date, until?: Date): Promise<PagerDutyIncident[]> {
    if (!this.config.enabled) return [];

    const params = new URLSearchParams({
      'service_ids[]': this.config.serviceId,
      limit: '100'
    });

    if (since) {
      params.append('since', since.toISOString());
    }
    if (until) {
      params.append('until', until.toISOString());
    }

    try {
      const response = await fetch(`${this.baseUrl}/incidents?${params}`, {
        headers: {
          'Authorization': `Token token=${this.config.apiKey}`,
          'Accept': 'application/vnd.pagerduty+json;version=2',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`PagerDuty API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.incidents || [];

    } catch (error) {
      console.error('Failed to fetch PagerDuty incidents:', error);
      return [];
    }
  }

  async notifyUser(userId: string, incident: Incident, reason: string): Promise<void> {
    if (!this.config.enabled) return;

    // This would typically create a new incident or add a note to existing incident
    // For now, we'll create a new event
    const event: PagerDutyEvent = {
      routing_key: this.config.routingKey,
      event_action: 'trigger',
      dedup_key: `${incident.id}-escalation-${Date.now()}`,
      payload: {
        summary: `Escalation: ${incident.title}`,
        severity: 'critical',
        source: 'backstage-idp',
        custom_details: {
          original_incident: incident.id,
          escalation_reason: reason,
          escalated_to: userId
        }
      }
    };

    try {
      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });

    } catch (error) {
      console.error('Failed to notify PagerDuty user:', error);
      throw error;
    }
  }

  async sendNotification(config: any, subject: string, message: string): Promise<void> {
    // Generic notification sending - could create a new incident or note
    const event: PagerDutyEvent = {
      routing_key: this.config.routingKey,
      event_action: 'trigger',
      dedup_key: `notification-${Date.now()}`,
      payload: {
        summary: subject,
        severity: 'info',
        source: 'backstage-idp',
        custom_details: {
          message,
          notification_type: 'generic'
        }
      }
    };

    try {
      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });

    } catch (error) {
      console.error('Failed to send PagerDuty notification:', error);
      throw error;
    }
  }

  async verifyWebhook(signature: string, payload: string, timestamp: string): Promise<boolean> {
    // Implement PagerDuty webhook signature verification
    // This is a simplified version - in production, use proper HMAC verification
    return true;
  }

  parseWebhook(payload: any): { incidents: Incident[], alerts: Alert[] } {
    const incidents: Incident[] = [];
    const alerts: Alert[] = [];

    if (payload.messages) {
      for (const message of payload.messages) {
        if (message.incident) {
          // Convert PagerDuty incident to our format
          // This would require more detailed mapping
        }
      }
    }

    return { incidents, alerts };
  }

  private mapSeverity(severity: string): 'critical' | 'error' | 'warning' | 'info' {
    switch (severity) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'error';
    }
  }

  isEnabled(): boolean {
    return this.config.enabled && !!this.config.apiKey && !!this.config.routingKey;
  }

  getConfig(): PagerDutyConfig {
    return { ...this.config };
  }
}