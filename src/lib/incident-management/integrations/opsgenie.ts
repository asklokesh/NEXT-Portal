import { Incident, Alert } from '../types';

interface OpsGenieConfig {
  enabled: boolean;
  apiKey: string;
  teamId: string;
  webhookUrl: string;
}

interface OpsGenieAlert {
  id: string;
  tinyId: string;
  alias: string;
  message: string;
  status: string;
  acknowledged: boolean;
  isSeen: boolean;
  tags: string[];
  snoozed: boolean;
  snoozedUntil: string;
  count: number;
  lastOccurredAt: string;
  createdAt: string;
  updatedAt: string;
  source: string;
  owner: string;
  priority: string;
  responders: Array<{
    type: string;
    id: string;
    name: string;
  }>;
  integration: {
    id: string;
    name: string;
    type: string;
  };
  report: {
    ackTime: number;
    closeTime: number;
    acknowledgedBy: string;
    closedBy: string;
  };
}

interface CreateAlertRequest {
  message: string;
  alias?: string;
  description?: string;
  responders?: Array<{
    type: 'team' | 'user' | 'escalation' | 'schedule';
    id?: string;
    name?: string;
  }>;
  visibleTo?: Array<{
    type: 'team' | 'user';
    id?: string;
    name?: string;
  }>;
  actions?: string[];
  tags?: string[];
  details?: Record<string, string>;
  entity?: string;
  source?: string;
  priority?: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  user?: string;
  note?: string;
}

export class OpsGenieClient {
  private config: OpsGenieConfig;
  private baseUrl = 'https://api.opsgenie.com/v2';

  constructor(config: OpsGenieConfig) {
    this.config = config;
  }

  async createAlert(incident: Incident): Promise<OpsGenieAlert> {
    if (!this.config.enabled) {
      throw new Error('Opsgenie integration is not enabled');
    }

    const alertRequest: CreateAlertRequest = {
      message: incident.title,
      alias: incident.id,
      description: incident.description,
      responders: [{
        type: 'team',
        id: this.config.teamId
      }],
      tags: [
        'backstage',
        'incident',
        incident.severity,
        incident.priority,
        ...incident.affectedServices,
        ...incident.tags
      ],
      details: {
        'incident_id': incident.id,
        'severity': incident.severity,
        'priority': incident.priority,
        'status': incident.status,
        'affected_services': incident.affectedServices.join(', '),
        'incident_commander': incident.incidentCommander.email,
        'created_at': incident.createdAt.toISOString(),
        'source': incident.source,
        'backstage_url': `${process.env.NEXT_PUBLIC_APP_URL}/incidents/${incident.id}`
      },
      entity: incident.affectedServices[0] || 'unknown',
      source: 'Backstage IDP',
      priority: this.mapPriority(incident.priority),
      user: incident.incidentCommander.email
    };

    try {
      const response = await fetch(`${this.baseUrl}/alerts`, {
        method: 'POST',
        headers: {
          'Authorization': `GenieKey ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alertRequest)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Opsgenie API error: ${response.status} ${response.statusText} - ${error}`);
      }

      const result = await response.json();
      
      // Fetch the created alert to get full details
      return await this.getAlert(result.data.alertId);

    } catch (error) {
      console.error('Failed to create Opsgenie alert:', error);
      throw error;
    }
  }

  async updateAlert(alertId: string, incident: Incident): Promise<void> {
    if (!this.config.enabled) return;

    try {
      // Update alert based on incident status
      switch (incident.status) {
        case 'investigating':
        case 'identified':
          await this.acknowledgeAlert(alertId, incident.incidentCommander.email);
          break;
        case 'resolved':
        case 'closed':
          await this.closeAlert(alertId, incident.incidentCommander.email, incident.resolution);
          break;
        default:
          // Add note for other status changes
          await this.addNote(alertId, `Status changed to: ${incident.status}`, incident.incidentCommander.email);
      }

      // Update tags and details
      await this.updateAlertDetails(alertId, {
        'status': incident.status,
        'updated_at': incident.updatedAt.toISOString()
      });

    } catch (error) {
      console.error('Failed to update Opsgenie alert:', error);
      throw error;
    }
  }

  async acknowledgeAlert(alertId: string, user: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: {
          'Authorization': `GenieKey ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user,
          note: 'Acknowledged from Backstage IDP'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to acknowledge alert: ${response.status} ${response.statusText}`);
      }

    } catch (error) {
      console.error('Failed to acknowledge Opsgenie alert:', error);
      throw error;
    }
  }

  async closeAlert(alertId: string, user: string, note?: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/alerts/${alertId}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `GenieKey ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user,
          note: note || 'Closed from Backstage IDP'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to close alert: ${response.status} ${response.statusText}`);
      }

    } catch (error) {
      console.error('Failed to close Opsgenie alert:', error);
      throw error;
    }
  }

  async addNote(alertId: string, note: string, user: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/alerts/${alertId}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `GenieKey ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user,
          note
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to add note: ${response.status} ${response.statusText}`);
      }

    } catch (error) {
      console.error('Failed to add note to Opsgenie alert:', error);
      throw error;
    }
  }

  async updateAlertDetails(alertId: string, details: Record<string, string>): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/alerts/${alertId}/details`, {
        method: 'PUT',
        headers: {
          'Authorization': `GenieKey ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          details
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update alert details: ${response.status} ${response.statusText}`);
      }

    } catch (error) {
      console.error('Failed to update Opsgenie alert details:', error);
      throw error;
    }
  }

  async getAlert(alertId: string): Promise<OpsGenieAlert> {
    try {
      const response = await fetch(`${this.baseUrl}/alerts/${alertId}`, {
        headers: {
          'Authorization': `GenieKey ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get alert: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.data;

    } catch (error) {
      console.error('Failed to get Opsgenie alert:', error);
      throw error;
    }
  }

  async getAlerts(query?: string, limit = 100, offset = 0): Promise<OpsGenieAlert[]> {
    if (!this.config.enabled) return [];

    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });

    if (query) {
      params.append('query', query);
    }

    try {
      const response = await fetch(`${this.baseUrl}/alerts?${params}`, {
        headers: {
          'Authorization': `GenieKey ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Opsgenie API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.data || [];

    } catch (error) {
      console.error('Failed to fetch Opsgenie alerts:', error);
      return [];
    }
  }

  async sendNotification(config: any, subject: string, message: string): Promise<void> {
    // Create a notification alert
    const alertRequest: CreateAlertRequest = {
      message: subject,
      description: message,
      responders: [{
        type: 'team',
        id: this.config.teamId
      }],
      tags: ['notification', 'backstage'],
      priority: 'P3',
      source: 'Backstage IDP'
    };

    try {
      await fetch(`${this.baseUrl}/alerts`, {
        method: 'POST',
        headers: {
          'Authorization': `GenieKey ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alertRequest)
      });

    } catch (error) {
      console.error('Failed to send Opsgenie notification:', error);
      throw error;
    }
  }

  async verifyWebhook(payload: string, signature: string): Promise<boolean> {
    // Implement Opsgenie webhook signature verification
    // This is a simplified version - in production, use proper HMAC verification
    return true;
  }

  parseWebhook(payload: any): { incidents: Incident[], alerts: Alert[] } {
    const incidents: Incident[] = [];
    const alerts: Alert[] = [];

    if (payload.alert) {
      // Convert Opsgenie alert to our format
      const alert: Alert = {
        id: payload.alert.alertId || payload.alert.tinyId,
        title: payload.alert.message,
        description: payload.alert.description || '',
        severity: this.mapSeverityFromPriority(payload.alert.priority),
        status: payload.action === 'Close' ? 'resolved' : 'firing',
        timestamp: new Date(payload.alert.createdAt || Date.now()),
        source: 'opsgenie',
        labels: {
          alias: payload.alert.alias,
          entity: payload.alert.entity,
          priority: payload.alert.priority,
          source: payload.alert.source
        },
        annotations: payload.alert.details || {},
        fingerprint: payload.alert.tinyId || payload.alert.alertId,
        suppressed: false,
        groupKey: payload.alert.alias || 'opsgenie'
      };

      alerts.push(alert);
    }

    return { incidents, alerts };
  }

  private mapPriority(priority: string): 'P1' | 'P2' | 'P3' | 'P4' | 'P5' {
    switch (priority) {
      case 'P0':
        return 'P1';
      case 'P1':
        return 'P2';
      case 'P2':
        return 'P3';
      case 'P3':
        return 'P4';
      case 'P4':
        return 'P5';
      default:
        return 'P3';
    }
  }

  private mapSeverityFromPriority(priority: string): 'critical' | 'warning' | 'info' {
    switch (priority) {
      case 'P1':
        return 'critical';
      case 'P2':
      case 'P3':
        return 'warning';
      default:
        return 'info';
    }
  }

  isEnabled(): boolean {
    return this.config.enabled && !!this.config.apiKey;
  }

  getConfig(): OpsGenieConfig {
    return { ...this.config };
  }
}