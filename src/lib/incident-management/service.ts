import { 
  Incident, 
  Alert, 
  User, 
  TimelineEvent, 
  EscalationPolicy, 
  OnCallSchedule, 
  PostMortem, 
  SLADefinition, 
  IncidentStatistics,
  IntegrationConfig,
  Runbook,
  ChaosExperiment,
  AlertRule 
} from './types';
import { PagerDutyClient } from './integrations/pagerduty';
import { OpsGenieClient } from './integrations/opsgenie';
import { SlackClient } from './integrations/slack';
import { PrometheusClient } from './integrations/prometheus';
import { GrafanaClient } from './integrations/grafana';
import { WebSocketService } from '../websocket/WebSocketService';
import { NotificationService } from './notification-service';
import { RunbookEngine } from './runbook-engine';
import { MetricsCollector } from './metrics-collector';

export class IncidentManagementService {
  private incidents: Map<string, Incident> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private escalationPolicies: Map<string, EscalationPolicy> = new Map();
  private onCallSchedules: Map<string, OnCallSchedule> = new Map();
  private slaDefinitions: Map<string, SLADefinition> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();

  private pagerDutyClient: PagerDutyClient;
  private opsGenieClient: OpsGenieClient;
  private slackClient: SlackClient;
  private prometheusClient: PrometheusClient;
  private grafanaClient: GrafanaClient;
  private webSocketService: WebSocketService;
  private notificationService: NotificationService;
  private runbookEngine: RunbookEngine;
  private metricsCollector: MetricsCollector;

  constructor(private config: IntegrationConfig) {
    this.pagerDutyClient = new PagerDutyClient(config.pagerDuty);
    this.opsGenieClient = new OpsGenieClient(config.opsgenie);
    this.slackClient = new SlackClient(config.slack);
    this.prometheusClient = new PrometheusClient(config.prometheus);
    this.grafanaClient = new GrafanaClient(config.grafana);
    this.webSocketService = new WebSocketService();
    this.notificationService = new NotificationService({
      slack: this.slackClient,
      pagerDuty: this.pagerDutyClient,
      opsgenie: this.opsGenieClient
    });
    this.runbookEngine = new RunbookEngine();
    this.metricsCollector = new MetricsCollector();

    this.initializeAlertProcessing();
    this.initializeSLAMonitoring();
    this.startPeriodicTasks();
  }

  // Incident Management
  async createIncident(incident: Partial<Incident>, user: User): Promise<Incident> {
    const id = this.generateId();
    const now = new Date();

    const newIncident: Incident = {
      id,
      title: incident.title!,
      description: incident.description!,
      severity: incident.severity || 'medium',
      status: 'open',
      priority: incident.priority || 'P2',
      affectedServices: incident.affectedServices || [],
      incidentCommander: user,
      team: incident.team || [],
      createdAt: now,
      updatedAt: now,
      timeline: [{
        id: this.generateId(),
        timestamp: now,
        type: 'created',
        user,
        description: 'Incident created',
        automated: false
      }],
      tags: incident.tags || [],
      source: incident.source || 'manual',
      runbooks: incident.runbooks || [],
      metrics: {
        detectionTime: 0,
        acknowledgmentTime: 0,
        customerImpactTime: 0,
        escalations: 0,
        communicationsSent: 0,
        runbooksExecuted: 0
      },
      communicationChannels: incident.communicationChannels || [],
      slaStatus: 'within'
    };

    // Auto-assign incident commander if not provided
    if (!incident.incidentCommander) {
      newIncident.incidentCommander = await this.getOnCallEngineer(incident.severity!);
    }

    // Execute automatic runbooks
    if (newIncident.severity === 'critical' || newIncident.severity === 'high') {
      await this.executeMatchingRunbooks(newIncident);
    }

    // Set up communication channels
    await this.setupIncidentCommunication(newIncident);

    // Send notifications
    await this.notificationService.notifyIncidentCreated(newIncident);

    // Sync with external systems
    if (this.config.pagerDuty.enabled) {
      const pdIncident = await this.pagerDutyClient.createIncident(newIncident);
      newIncident.externalId = pdIncident.id;
    }

    if (this.config.opsgenie.enabled) {
      const ogAlert = await this.opsGenieClient.createAlert(newIncident);
      newIncident.externalId = newIncident.externalId || ogAlert.id;
    }

    this.incidents.set(id, newIncident);
    
    // Broadcast real-time update
    this.webSocketService.broadcast('incident-created', newIncident);

    // Start SLA tracking
    this.startSLATracking(newIncident);

    return newIncident;
  }

  async updateIncident(id: string, updates: Partial<Incident>, user: User): Promise<Incident> {
    const incident = this.incidents.get(id);
    if (!incident) {
      throw new Error(`Incident ${id} not found`);
    }

    const previousStatus = incident.status;
    const now = new Date();

    // Update incident
    Object.assign(incident, updates, { updatedAt: now });

    // Add timeline event
    const timelineEvent: TimelineEvent = {
      id: this.generateId(),
      timestamp: now,
      type: 'updated',
      user,
      description: this.generateUpdateDescription(updates),
      automated: false
    };

    incident.timeline.push(timelineEvent);

    // Handle status changes
    if (updates.status && updates.status !== previousStatus) {
      await this.handleStatusChange(incident, previousStatus, updates.status, user);
    }

    // Update metrics
    this.updateIncidentMetrics(incident);

    // Sync with external systems
    await this.syncWithExternalSystems(incident);

    // Send notifications for significant changes
    if (this.isSignificantChange(updates)) {
      await this.notificationService.notifyIncidentUpdated(incident, updates);
    }

    // Broadcast real-time update
    this.webSocketService.broadcast('incident-updated', incident);

    this.incidents.set(id, incident);
    return incident;
  }

  async acknowledgeIncident(id: string, user: User): Promise<Incident> {
    const incident = this.incidents.get(id);
    if (!incident) {
      throw new Error(`Incident ${id} not found`);
    }

    const now = new Date();
    incident.acknowledgedAt = now;
    incident.status = 'investigating';
    incident.metrics.acknowledgmentTime = Math.floor((now.getTime() - incident.createdAt.getTime()) / 60000);

    const timelineEvent: TimelineEvent = {
      id: this.generateId(),
      timestamp: now,
      type: 'status_change',
      user,
      description: 'Incident acknowledged and investigation started',
      metadata: { from: 'open', to: 'investigating' },
      automated: false
    };

    incident.timeline.push(timelineEvent);

    await this.notificationService.notifyIncidentAcknowledged(incident, user);
    this.webSocketService.broadcast('incident-acknowledged', incident);

    return incident;
  }

  async resolveIncident(id: string, resolution: string, user: User): Promise<Incident> {
    const incident = this.incidents.get(id);
    if (!incident) {
      throw new Error(`Incident ${id} not found`);
    }

    const now = new Date();
    incident.resolvedAt = now;
    incident.status = 'resolved';
    incident.resolution = resolution;
    
    if (incident.acknowledgedAt) {
      incident.metrics.resolutionTime = Math.floor((now.getTime() - incident.acknowledgedAt.getTime()) / 60000);
    }

    const timelineEvent: TimelineEvent = {
      id: this.generateId(),
      timestamp: now,
      type: 'status_change',
      user,
      description: `Incident resolved: ${resolution}`,
      metadata: { from: incident.status, to: 'resolved' },
      automated: false
    };

    incident.timeline.push(timelineEvent);

    // Update SLA status
    this.updateSLAStatus(incident);

    // Schedule post-mortem creation for high-severity incidents
    if (incident.severity === 'critical' || incident.severity === 'high') {
      await this.schedulePostMortemCreation(incident);
    }

    await this.notificationService.notifyIncidentResolved(incident, resolution);
    this.webSocketService.broadcast('incident-resolved', incident);

    return incident;
  }

  // Alert Processing
  async processAlert(alert: Alert): Promise<void> {
    this.alerts.set(alert.id, alert);

    // Check for suppression
    if (this.isAlertSuppressed(alert)) {
      alert.suppressed = true;
      return;
    }

    // Find matching alert rule
    const rule = this.findMatchingAlertRule(alert);
    if (!rule) {
      console.warn(`No alert rule found for alert ${alert.id}`);
      return;
    }

    // Check if we should auto-create incident
    if (rule.routing.autoCreateIncident) {
      await this.createIncidentFromAlert(alert, rule);
    }

    // Execute alert actions
    await this.executeAlertActions(alert, rule);

    // Broadcast real-time alert
    this.webSocketService.broadcast('alert-received', alert);
  }

  private async createIncidentFromAlert(alert: Alert, rule: AlertRule): Promise<void> {
    const onCallUser = await this.getOnCallEngineer(alert.severity);
    
    const incident = await this.createIncident({
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      priority: this.mapSeverityToPriority(alert.severity),
      source: 'alert',
      alertRuleId: rule.id,
      tags: Object.keys(alert.labels).map(key => `${key}:${alert.labels[key]}`),
      affectedServices: this.extractServicesFromAlert(alert)
    }, onCallUser);

    alert.incidentId = incident.id;
    
    // Add alert as timeline event
    const timelineEvent: TimelineEvent = {
      id: this.generateId(),
      timestamp: alert.timestamp,
      type: 'alert_received',
      user: {
        id: 'system',
        name: 'Alert System',
        email: 'alerts@system.local',
        role: 'System',
        contactMethods: [],
        escalationLevel: 0,
        timezone: 'UTC'
      },
      description: `Alert triggered: ${alert.title}`,
      metadata: {
        alertId: alert.id,
        source: alert.source,
        labels: alert.labels
      },
      automated: true
    };

    incident.timeline.push(timelineEvent);
  }

  // Runbook Execution
  async executeRunbook(incidentId: string, runbookId: string, user: User): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const runbook = incident.runbooks.find(r => r.id === runbookId);
    if (!runbook) {
      throw new Error(`Runbook ${runbookId} not found for incident ${incidentId}`);
    }

    try {
      const result = await this.runbookEngine.execute(runbook, incident);
      
      const timelineEvent: TimelineEvent = {
        id: this.generateId(),
        timestamp: new Date(),
        type: 'runbook_executed',
        user,
        description: `Runbook executed: ${runbook.name}`,
        metadata: {
          runbookId: runbook.id,
          result: result.success ? 'success' : 'failure',
          steps: result.steps.length,
          duration: result.executionTime
        },
        automated: false
      };

      incident.timeline.push(timelineEvent);
      incident.metrics.runbooksExecuted++;

      if (result.success) {
        await this.notificationService.notifyRunbookSuccess(incident, runbook, result);
      } else {
        await this.notificationService.notifyRunbookFailure(incident, runbook, result);
      }

    } catch (error) {
      console.error(`Error executing runbook ${runbookId}:`, error);
      
      const timelineEvent: TimelineEvent = {
        id: this.generateId(),
        timestamp: new Date(),
        type: 'runbook_executed',
        user,
        description: `Runbook execution failed: ${runbook.name}`,
        metadata: {
          runbookId: runbook.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        automated: false
      };

      incident.timeline.push(timelineEvent);
    }
  }

  // Escalation Management
  async escalateIncident(incidentId: string, reason: string): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    incident.metrics.escalations++;

    const escalationPolicy = this.escalationPolicies.get(incident.priority);
    if (!escalationPolicy) {
      throw new Error(`No escalation policy found for priority ${incident.priority}`);
    }

    const nextLevel = incident.metrics.escalations;
    const level = escalationPolicy.levels.find(l => l.level === nextLevel);
    
    if (!level) {
      console.warn(`No escalation level ${nextLevel} found for policy ${escalationPolicy.id}`);
      return;
    }

    // Execute escalation targets
    for (const target of level.targets) {
      await this.executeEscalationTarget(incident, target, reason);
    }

    const timelineEvent: TimelineEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      type: 'escalation',
      user: {
        id: 'system',
        name: 'Escalation System',
        email: 'escalation@system.local',
        role: 'System',
        contactMethods: [],
        escalationLevel: 0,
        timezone: 'UTC'
      },
      description: `Incident escalated to level ${nextLevel}: ${reason}`,
      metadata: {
        escalationLevel: nextLevel,
        reason,
        targets: level.targets.length
      },
      automated: true
    };

    incident.timeline.push(timelineEvent);
    
    this.webSocketService.broadcast('incident-escalated', {
      incident,
      level: nextLevel,
      reason
    });
  }

  // SLA Management
  private updateSLAStatus(incident: Incident): void {
    const applicableSLAs = Array.from(this.slaDefinitions.values())
      .filter(sla => sla.applicableServices.some(service => 
        incident.affectedServices.includes(service)
      ));

    for (const sla of applicableSLAs) {
      for (const target of sla.targets) {
        const currentValue = this.calculateSLAMetricValue(incident, target.metric);
        const threshold = target.value;

        if (currentValue >= threshold) {
          incident.slaStatus = 'breached';
          this.handleSLABreach(incident, sla, target, currentValue);
        } else if (currentValue >= threshold * 0.8) {
          incident.slaStatus = 'warning';
          this.handleSLAWarning(incident, sla, target, currentValue);
        }
      }
    }
  }

  private async handleSLABreach(incident: Incident, sla: SLADefinition, target: any, currentValue: number): Promise<void> {
    console.warn(`SLA breach detected for incident ${incident.id}: ${target.metric} = ${currentValue} (threshold: ${target.value})`);
    
    await this.notificationService.notifySLABreach(incident, sla, target, currentValue);
    
    const timelineEvent: TimelineEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      type: 'notification',
      user: {
        id: 'system',
        name: 'SLA Monitor',
        email: 'sla@system.local',
        role: 'System',
        contactMethods: [],
        escalationLevel: 0,
        timezone: 'UTC'
      },
      description: `SLA breach: ${target.metric} exceeded threshold`,
      metadata: {
        slaId: sla.id,
        metric: target.metric,
        currentValue,
        threshold: target.value
      },
      severity: 'error',
      automated: true
    };

    incident.timeline.push(timelineEvent);
  }

  // Statistics and Metrics
  async getIncidentStatistics(period: { start: Date; end: Date }): Promise<IncidentStatistics> {
    const incidentsInPeriod = Array.from(this.incidents.values())
      .filter(incident => 
        incident.createdAt >= period.start && incident.createdAt <= period.end
      );

    const stats: IncidentStatistics = {
      period,
      totalIncidents: incidentsInPeriod.length,
      incidentsByStatus: this.groupBy(incidentsInPeriod, 'status'),
      incidentsBySeverity: this.groupBy(incidentsInPeriod, 'severity'),
      incidentsByService: this.getIncidentsByService(incidentsInPeriod),
      mttr: this.calculateMTTR(incidentsInPeriod),
      mtta: this.calculateMTTA(incidentsInPeriod),
      mtbf: this.calculateMTBF(incidentsInPeriod),
      slaCompliance: this.calculateSLACompliance(incidentsInPeriod),
      trends: this.calculateTrends(incidentsInPeriod, period)
    };

    return stats;
  }

  // Helper Methods
  private generateId(): string {
    return 'inc_' + Math.random().toString(36).substr(2, 9);
  }

  private async getOnCallEngineer(severity: string): Promise<User> {
    // Implementation would query on-call schedule
    // For now, return a default user
    return {
      id: 'user_oncall',
      name: 'On-Call Engineer',
      email: 'oncall@example.com',
      role: 'SRE',
      contactMethods: [
        { type: 'email', value: 'oncall@example.com', verified: true, priority: 1 },
        { type: 'phone', value: '+1-555-0123', verified: true, priority: 2 }
      ],
      escalationLevel: 1,
      timezone: 'UTC'
    };
  }

  private async executeMatchingRunbooks(incident: Incident): Promise<void> {
    // Find runbooks that match incident criteria
    const matchingRunbooks = incident.runbooks.filter(runbook =>
      runbook.triggers.some(trigger =>
        trigger.severity.includes(incident.severity) &&
        (trigger.services.length === 0 || trigger.services.some(service =>
          incident.affectedServices.includes(service)
        ))
      )
    );

    // Execute automated runbooks
    for (const runbook of matchingRunbooks) {
      if (runbook.automationLevel === 'fully-automated') {
        try {
          await this.runbookEngine.execute(runbook, incident);
          incident.metrics.runbooksExecuted++;
        } catch (error) {
          console.error(`Error executing automated runbook ${runbook.id}:`, error);
        }
      }
    }
  }

  private async setupIncidentCommunication(incident: Incident): Promise<void> {
    // Create Slack channel for critical/high incidents
    if ((incident.severity === 'critical' || incident.severity === 'high') && this.config.slack.enabled) {
      try {
        const channelName = `incident-${incident.id}`;
        const channel = await this.slackClient.createChannel(channelName, incident);
        
        incident.communicationChannels.push({
          type: 'slack',
          identifier: channel.id,
          config: { name: channelName },
          active: true
        });

        // Invite incident commander and team
        const users = [incident.incidentCommander, ...incident.team];
        await this.slackClient.inviteUsersToChannel(channel.id, users);

      } catch (error) {
        console.error('Error setting up Slack communication:', error);
      }
    }
  }

  private generateUpdateDescription(updates: Partial<Incident>): string {
    const changes = Object.keys(updates).filter(key => key !== 'updatedAt');
    return `Updated: ${changes.join(', ')}`;
  }

  private async handleStatusChange(incident: Incident, from: string, to: string, user: User): Promise<void> {
    const timelineEvent: TimelineEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      type: 'status_change',
      user,
      description: `Status changed from ${from} to ${to}`,
      metadata: { from, to },
      automated: false
    };

    incident.timeline.push(timelineEvent);

    // Handle specific status changes
    switch (to) {
      case 'resolved':
        if (!incident.resolvedAt) {
          incident.resolvedAt = new Date();
        }
        break;
      case 'closed':
        incident.closedAt = new Date();
        break;
    }
  }

  private updateIncidentMetrics(incident: Incident): void {
    const now = new Date();
    
    if (!incident.acknowledgedAt && incident.status !== 'open') {
      incident.acknowledgedAt = now;
      incident.metrics.acknowledgmentTime = Math.floor((now.getTime() - incident.createdAt.getTime()) / 60000);
    }

    if (incident.status === 'resolved' && !incident.metrics.resolutionTime && incident.acknowledgedAt) {
      incident.metrics.resolutionTime = Math.floor((now.getTime() - incident.acknowledgedAt.getTime()) / 60000);
    }
  }

  private isSignificantChange(updates: Partial<Incident>): boolean {
    const significantFields = ['status', 'severity', 'priority', 'incidentCommander', 'resolution'];
    return significantFields.some(field => updates.hasOwnProperty(field));
  }

  private async syncWithExternalSystems(incident: Incident): Promise<void> {
    if (this.config.pagerDuty.enabled && incident.externalId) {
      try {
        await this.pagerDutyClient.updateIncident(incident.externalId, incident);
      } catch (error) {
        console.error('Error syncing with PagerDuty:', error);
      }
    }

    if (this.config.opsgenie.enabled && incident.externalId) {
      try {
        await this.opsGenieClient.updateAlert(incident.externalId, incident);
      } catch (error) {
        console.error('Error syncing with Opsgenie:', error);
      }
    }
  }

  private isAlertSuppressed(alert: Alert): boolean {
    // Implementation for alert suppression logic
    return false;
  }

  private findMatchingAlertRule(alert: Alert): AlertRule | undefined {
    return Array.from(this.alertRules.values()).find(rule => {
      // Match based on labels, source, or other criteria
      return rule.enabled && alert.source.includes(rule.name);
    });
  }

  private async executeAlertActions(alert: Alert, rule: AlertRule): Promise<void> {
    for (const action of rule.actions) {
      try {
        switch (action.type) {
          case 'notify_team':
            await this.notificationService.notifyTeam(alert, action.config);
            break;
          case 'execute_runbook':
            // Execute runbook logic
            break;
          case 'scale_service':
            // Auto-scaling logic
            break;
        }
      } catch (error) {
        console.error(`Error executing alert action ${action.type}:`, error);
      }
    }
  }

  private mapSeverityToPriority(severity: string): 'P0' | 'P1' | 'P2' | 'P3' | 'P4' {
    switch (severity) {
      case 'critical': return 'P0';
      case 'warning': return 'P1';
      case 'info': return 'P2';
      default: return 'P3';
    }
  }

  private extractServicesFromAlert(alert: Alert): string[] {
    return Object.keys(alert.labels)
      .filter(key => key.includes('service') || key.includes('app'))
      .map(key => alert.labels[key]);
  }

  private async executeEscalationTarget(incident: Incident, target: any, reason: string): Promise<void> {
    switch (target.type) {
      case 'user':
        await this.notificationService.notifyUser(target.identifier, incident, reason);
        break;
      case 'team':
        await this.notificationService.notifyTeam(incident, { teamId: target.identifier, reason });
        break;
      case 'webhook':
        // Execute webhook
        break;
    }
  }

  private calculateSLAMetricValue(incident: Incident, metric: string): number {
    switch (metric) {
      case 'mttr':
        return incident.metrics.resolutionTime || 0;
      case 'mtta':
        return incident.metrics.acknowledgmentTime || 0;
      default:
        return 0;
    }
  }

  private async handleSLAWarning(incident: Incident, sla: SLADefinition, target: any, currentValue: number): Promise<void> {
    console.warn(`SLA warning for incident ${incident.id}: ${target.metric} = ${currentValue} (warning threshold: ${target.value * 0.8})`);
    await this.notificationService.notifySLAWarning(incident, sla, target, currentValue);
  }

  private async schedulePostMortemCreation(incident: Incident): Promise<void> {
    // Schedule post-mortem creation
    console.log(`Scheduling post-mortem creation for incident ${incident.id}`);
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, number> {
    return array.reduce((acc, item) => {
      const value = String(item[key]);
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getIncidentsByService(incidents: Incident[]): Record<string, number> {
    const serviceCount: Record<string, number> = {};
    
    incidents.forEach(incident => {
      incident.affectedServices.forEach(service => {
        serviceCount[service] = (serviceCount[service] || 0) + 1;
      });
    });

    return serviceCount;
  }

  private calculateMTTR(incidents: Incident[]): any {
    const resolvedIncidents = incidents.filter(i => i.metrics.resolutionTime);
    
    if (resolvedIncidents.length === 0) {
      return { overall: 0, bySeverity: {}, byService: {} };
    }

    const overall = resolvedIncidents.reduce((sum, i) => sum + (i.metrics.resolutionTime || 0), 0) / resolvedIncidents.length;
    
    return {
      overall,
      bySeverity: this.calculateMTTRBySeverity(resolvedIncidents),
      byService: this.calculateMTTRByService(resolvedIncidents)
    };
  }

  private calculateMTTA(incidents: Incident[]): any {
    const acknowledgedIncidents = incidents.filter(i => i.metrics.acknowledgmentTime);
    
    if (acknowledgedIncidents.length === 0) {
      return { overall: 0, bySeverity: {}, byService: {} };
    }

    const overall = acknowledgedIncidents.reduce((sum, i) => sum + i.metrics.acknowledgmentTime, 0) / acknowledgedIncidents.length;
    
    return {
      overall,
      bySeverity: this.calculateMTTABySeverity(acknowledgedIncidents),
      byService: this.calculateMTTAByService(acknowledgedIncidents)
    };
  }

  private calculateMTBF(incidents: Incident[]): any {
    // Mean Time Between Failures calculation
    return { overall: 0, byService: {} };
  }

  private calculateSLACompliance(incidents: Incident[]): Record<string, number> {
    const compliance: Record<string, number> = {};
    
    for (const sla of this.slaDefinitions.values()) {
      const applicableIncidents = incidents.filter(i => 
        i.affectedServices.some(service => sla.applicableServices.includes(service))
      );
      
      if (applicableIncidents.length > 0) {
        const compliantIncidents = applicableIncidents.filter(i => i.slaStatus !== 'breached').length;
        compliance[sla.name] = (compliantIncidents / applicableIncidents.length) * 100;
      }
    }

    return compliance;
  }

  private calculateTrends(incidents: Incident[], period: { start: Date; end: Date }): any {
    // Calculate daily, weekly, monthly trends
    return {
      daily: [],
      weekly: [],
      monthly: []
    };
  }

  private calculateMTTRBySeverity(incidents: Incident[]): Record<string, number> {
    const bySeverity: Record<string, number[]> = {};
    
    incidents.forEach(incident => {
      if (!bySeverity[incident.severity]) {
        bySeverity[incident.severity] = [];
      }
      if (incident.metrics.resolutionTime) {
        bySeverity[incident.severity].push(incident.metrics.resolutionTime);
      }
    });

    const result: Record<string, number> = {};
    for (const [severity, times] of Object.entries(bySeverity)) {
      result[severity] = times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    return result;
  }

  private calculateMTTRByService(incidents: Incident[]): Record<string, number> {
    const byService: Record<string, number[]> = {};
    
    incidents.forEach(incident => {
      incident.affectedServices.forEach(service => {
        if (!byService[service]) {
          byService[service] = [];
        }
        if (incident.metrics.resolutionTime) {
          byService[service].push(incident.metrics.resolutionTime);
        }
      });
    });

    const result: Record<string, number> = {};
    for (const [service, times] of Object.entries(byService)) {
      result[service] = times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    return result;
  }

  private calculateMTTABySeverity(incidents: Incident[]): Record<string, number> {
    const bySeverity: Record<string, number[]> = {};
    
    incidents.forEach(incident => {
      if (!bySeverity[incident.severity]) {
        bySeverity[incident.severity] = [];
      }
      bySeverity[incident.severity].push(incident.metrics.acknowledgmentTime);
    });

    const result: Record<string, number> = {};
    for (const [severity, times] of Object.entries(bySeverity)) {
      result[severity] = times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    return result;
  }

  private calculateMTTAByService(incidents: Incident[]): Record<string, number> {
    const byService: Record<string, number[]> = {};
    
    incidents.forEach(incident => {
      incident.affectedServices.forEach(service => {
        if (!byService[service]) {
          byService[service] = [];
        }
        byService[service].push(incident.metrics.acknowledgmentTime);
      });
    });

    const result: Record<string, number> = {};
    for (const [service, times] of Object.entries(byService)) {
      result[service] = times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    return result;
  }

  private initializeAlertProcessing(): void {
    // Set up alert processing pipeline
    console.log('Initializing alert processing pipeline');
  }

  private initializeSLAMonitoring(): void {
    // Set up SLA monitoring
    console.log('Initializing SLA monitoring');
  }

  private startPeriodicTasks(): void {
    // Start periodic tasks like SLA checks, metric collection, etc.
    setInterval(() => {
      this.checkSLABreaches();
      this.collectMetrics();
    }, 60000); // Every minute
  }

  private checkSLABreaches(): void {
    for (const incident of this.incidents.values()) {
      if (incident.status === 'closed') continue;
      this.updateSLAStatus(incident);
    }
  }

  private collectMetrics(): void {
    // Collect various metrics
    this.metricsCollector.collect();
  }

  // Public getters for data access
  getIncident(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  getIncidents(filters?: any): Incident[] {
    let incidents = Array.from(this.incidents.values());
    
    if (filters) {
      if (filters.status) {
        incidents = incidents.filter(i => i.status === filters.status);
      }
      if (filters.severity) {
        incidents = incidents.filter(i => i.severity === filters.severity);
      }
      if (filters.service) {
        incidents = incidents.filter(i => i.affectedServices.includes(filters.service));
      }
    }

    return incidents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getAlerts(filters?: any): Alert[] {
    return Array.from(this.alerts.values());
  }
}