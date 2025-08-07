import { Alert, AlertRule, AlertCondition } from './types';
import { PrometheusClient } from './integrations/prometheus';
import { GrafanaClient } from './integrations/grafana';
import { WebSocketService } from '../websocket/WebSocketService';

interface AlertDetectionConfig {
  checkInterval: number; // milliseconds
  suppressionWindow: number; // milliseconds
  groupingWindow: number; // milliseconds
  batchSize: number;
}

export class AlertDetector {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private suppressedAlerts: Map<string, Date> = new Map();
  private detectionTimer?: NodeJS.Timeout;

  constructor(
    private prometheusClient: PrometheusClient,
    private grafanaClient: GrafanaClient,
    private webSocketService: WebSocketService,
    private config: AlertDetectionConfig = {
      checkInterval: 30000, // 30 seconds
      suppressionWindow: 300000, // 5 minutes
      groupingWindow: 60000, // 1 minute
      batchSize: 100
    }
  ) {
    this.initializeBuiltInRules();
    this.startDetectionLoop();
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    console.log(`Alert rule added: ${rule.name}`);
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    console.log(`Alert rule removed: ${ruleId}`);
  }

  updateRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    console.log(`Alert rule updated: ${rule.name}`);
  }

  async processWebhookAlert(payload: any, source: string): Promise<Alert[]> {
    const alerts: Alert[] = [];

    try {
      // Handle different webhook formats
      switch (source.toLowerCase()) {
        case 'prometheus':
          alerts.push(...this.parsePrometheusWebhook(payload));
          break;
        case 'grafana':
          alerts.push(...this.parseGrafanaWebhook(payload));
          break;
        case 'pagerduty':
          alerts.push(...this.parsePagerDutyWebhook(payload));
          break;
        case 'opsgenie':
          alerts.push(...this.parseOpsGenieWebhook(payload));
          break;
        default:
          alerts.push(this.parseGenericWebhook(payload, source));
      }

      // Process each alert
      for (const alert of alerts) {
        await this.processAlert(alert);
      }

    } catch (error) {
      console.error(`Error processing webhook from ${source}:`, error);
    }

    return alerts;
  }

  async checkRules(): Promise<Alert[]> {
    const firedAlerts: Alert[] = [];
    const batch: Promise<Alert[]>[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      batch.push(this.evaluateRule(rule));

      if (batch.length >= this.config.batchSize) {
        const results = await Promise.allSettled(batch);
        for (const result of results) {
          if (result.status === 'fulfilled') {
            firedAlerts.push(...result.value);
          }
        }
        batch.length = 0;
      }
    }

    // Process remaining rules
    if (batch.length > 0) {
      const results = await Promise.allSettled(batch);
      for (const result of results) {
        if (result.status === 'fulfilled') {
          firedAlerts.push(...result.value);
        }
      }
    }

    return firedAlerts;
  }

  private async evaluateRule(rule: AlertRule): Promise<Alert[]> {
    const alerts: Alert[] = [];

    try {
      // Query Prometheus for rule evaluation
      const queryResult = await this.prometheusClient.query(rule.query);
      
      if (!queryResult.data?.result) {
        return alerts;
      }

      for (const sample of queryResult.data.result) {
        const shouldFire = await this.evaluateConditions(rule, sample);
        
        if (shouldFire) {
          const alert = this.createAlertFromRule(rule, sample);
          
          // Check if alert should be suppressed
          if (!this.isAlertSuppressed(alert)) {
            alerts.push(alert);
          }
        }
      }

    } catch (error) {
      console.error(`Error evaluating rule ${rule.name}:`, error);
    }

    return alerts;
  }

  private async evaluateConditions(rule: AlertRule, sample: any): Promise<boolean> {
    for (const condition of rule.conditions) {
      const value = this.extractMetricValue(sample, condition.metric);
      
      if (!this.checkCondition(value, condition)) {
        return false;
      }

      // Check duration if specified
      if (condition.duration) {
        const durationMet = await this.checkConditionDuration(rule, condition, sample);
        if (!durationMet) {
          return false;
        }
      }
    }

    return true;
  }

  private checkCondition(value: number, condition: AlertCondition): boolean {
    switch (condition.operator) {
      case '>':
        return value > condition.threshold;
      case '<':
        return value < condition.threshold;
      case '>=':
        return value >= condition.threshold;
      case '<=':
        return value <= condition.threshold;
      case '=':
        return value === condition.threshold;
      case '!=':
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  private async checkConditionDuration(rule: AlertRule, condition: AlertCondition, sample: any): Promise<boolean> {
    // Check if condition has been true for the specified duration
    const durationMs = this.parseDuration(condition.duration);
    const now = Date.now();
    const checkTime = now - durationMs;

    // Query historical data
    const historicalResult = await this.prometheusClient.queryRange({
      query: rule.query,
      start: new Date(checkTime),
      end: new Date(now),
      step: '1m'
    });

    if (!historicalResult.data?.result?.[0]?.values) {
      return false;
    }

    // Check if all values in the duration period meet the condition
    const values = historicalResult.data.result[0].values;
    return values.every((valuePoint: [number, string]) => {
      const value = parseFloat(valuePoint[1]);
      return this.checkCondition(value, condition);
    });
  }

  private createAlertFromRule(rule: AlertRule, sample: any): Alert {
    const fingerprint = this.generateFingerprint(rule, sample);
    const timestamp = new Date();

    return {
      id: this.generateAlertId(),
      title: this.generateAlertTitle(rule, sample),
      description: this.generateAlertDescription(rule, sample),
      severity: rule.severity,
      source: 'prometheus',
      timestamp,
      labels: this.extractLabels(sample),
      annotations: this.generateAnnotations(rule, sample),
      fingerprint,
      status: 'firing',
      suppressed: false,
      groupKey: this.generateGroupKey(rule, sample)
    };
  }

  private async processAlert(alert: Alert): Promise<void> {
    // Check for existing alert with same fingerprint
    const existingAlert = this.getAlertByFingerprint(alert.fingerprint);
    
    if (existingAlert) {
      if (alert.status === 'resolved' && existingAlert.status === 'firing') {
        // Alert resolved
        existingAlert.status = 'resolved';
        this.webSocketService.broadcast('alert-resolved', existingAlert);
      } else if (alert.status === 'firing') {
        // Update existing alert
        Object.assign(existingAlert, alert, { 
          timestamp: alert.timestamp 
        });
        this.webSocketService.broadcast('alert-updated', existingAlert);
      }
    } else if (alert.status === 'firing') {
      // New alert
      this.activeAlerts.set(alert.id, alert);
      this.webSocketService.broadcast('alert-fired', alert);
      
      // Find matching rule and execute actions
      const rule = this.findRuleByAlert(alert);
      if (rule) {
        await this.executeAlertActions(alert, rule);
      }
    }

    // Group alerts if needed
    await this.groupAlert(alert);
  }

  private isAlertSuppressed(alert: Alert): boolean {
    // Check global suppression
    const suppressedUntil = this.suppressedAlerts.get(alert.fingerprint);
    if (suppressedUntil && suppressedUntil > new Date()) {
      alert.suppressed = true;
      alert.suppressedUntil = suppressedUntil;
      return true;
    }

    // Check rule-specific suppression
    const rule = this.findRuleByAlert(alert);
    if (rule?.suppression.enabled) {
      const lastAlert = this.getLastAlertByFingerprint(alert.fingerprint);
      if (lastAlert) {
        const timeDiff = alert.timestamp.getTime() - lastAlert.timestamp.getTime();
        if (timeDiff < rule.suppression.duration * 60000) {
          return true;
        }
      }
    }

    return false;
  }

  private async groupAlert(alert: Alert): Promise<void> {
    // Group alerts based on similarity and time window
    const groupKey = alert.groupKey;
    const now = Date.now();
    
    // Find other alerts in the same group within the grouping window
    const groupedAlerts = Array.from(this.activeAlerts.values()).filter(a => 
      a.groupKey === groupKey && 
      Math.abs(now - a.timestamp.getTime()) <= this.config.groupingWindow &&
      a.id !== alert.id
    );

    if (groupedAlerts.length > 0) {
      // Create or update alert group
      console.log(`Grouping alert ${alert.id} with ${groupedAlerts.length} other alerts`);
    }
  }

  private async executeAlertActions(alert: Alert, rule: AlertRule): Promise<void> {
    for (const action of rule.actions) {
      try {
        // Add delay if specified
        if (action.delay) {
          await this.delay(action.delay * 1000);
        }

        switch (action.type) {
          case 'create_incident':
            await this.createIncidentFromAlert(alert, rule);
            break;
          case 'notify_team':
            await this.notifyTeam(alert, action.config);
            break;
          case 'execute_runbook':
            await this.executeRunbook(alert, action.config);
            break;
          case 'scale_service':
            await this.scaleService(alert, action.config);
            break;
        }
      } catch (error) {
        console.error(`Error executing alert action ${action.type}:`, error);
      }
    }
  }

  private parsePrometheusWebhook(payload: any): Alert[] {
    const alerts: Alert[] = [];

    if (payload.alerts) {
      for (const alertData of payload.alerts) {
        const alert: Alert = {
          id: this.generateAlertId(),
          title: alertData.labels.alertname || 'Unknown Alert',
          description: alertData.annotations?.description || alertData.annotations?.summary || '',
          severity: this.mapPrometheusSeverity(alertData.labels.severity),
          source: 'prometheus',
          timestamp: new Date(alertData.startsAt || Date.now()),
          labels: alertData.labels || {},
          annotations: alertData.annotations || {},
          fingerprint: alertData.fingerprint || this.generateFingerprint(null, alertData),
          status: alertData.status === 'resolved' ? 'resolved' : 'firing',
          suppressed: false,
          groupKey: alertData.labels.alertname || 'default'
        };

        alerts.push(alert);
      }
    }

    return alerts;
  }

  private parseGrafanaWebhook(payload: any): Alert[] {
    const alerts: Alert[] = [];

    if (payload.alerts) {
      for (const alertData of payload.alerts) {
        const alert: Alert = {
          id: this.generateAlertId(),
          title: payload.title || alertData.title || 'Grafana Alert',
          description: payload.message || alertData.message || '',
          severity: this.mapGrafanaSeverity(payload.state),
          source: 'grafana',
          timestamp: new Date(alertData.startsAt || Date.now()),
          labels: alertData.labels || {},
          annotations: alertData.annotations || {},
          fingerprint: this.generateFingerprint(null, alertData),
          status: payload.state === 'ok' ? 'resolved' : 'firing',
          suppressed: false,
          groupKey: payload.title || 'grafana'
        };

        alerts.push(alert);
      }
    }

    return alerts;
  }

  private parsePagerDutyWebhook(payload: any): Alert[] {
    const alerts: Alert[] = [];

    if (payload.messages) {
      for (const message of payload.messages) {
        const incident = message.incident;
        
        const alert: Alert = {
          id: this.generateAlertId(),
          title: incident.title || 'PagerDuty Incident',
          description: incident.description || '',
          severity: this.mapPagerDutySeverity(incident.urgency),
          source: 'pagerduty',
          timestamp: new Date(message.created_on || Date.now()),
          labels: {
            incident_key: incident.incident_key,
            service: incident.service.name,
            urgency: incident.urgency,
            status: incident.status
          },
          annotations: {
            incident_url: incident.html_url,
            escalation_policy: incident.escalation_policy.name
          },
          fingerprint: incident.incident_key,
          status: incident.status === 'resolved' ? 'resolved' : 'firing',
          suppressed: false,
          groupKey: incident.service.name
        };

        alerts.push(alert);
      }
    }

    return alerts;
  }

  private parseOpsGenieWebhook(payload: any): Alert[] {
    const alert: Alert = {
      id: this.generateAlertId(),
      title: payload.alert?.message || 'Opsgenie Alert',
      description: payload.alert?.description || '',
      severity: this.mapOpsgenieSeverity(payload.alert?.priority),
      source: 'opsgenie',
      timestamp: new Date(payload.alert?.createdAt || Date.now()),
      labels: {
        alias: payload.alert?.alias,
        source: payload.alert?.source,
        entity: payload.alert?.entity,
        priority: payload.alert?.priority
      },
      annotations: payload.alert?.details || {},
      fingerprint: payload.alert?.tinyId || this.generateFingerprint(null, payload),
      status: payload.action === 'Close' ? 'resolved' : 'firing',
      suppressed: false,
      groupKey: payload.alert?.alias || 'opsgenie'
    };

    return [alert];
  }

  private parseGenericWebhook(payload: any, source: string): Alert {
    return {
      id: this.generateAlertId(),
      title: payload.title || payload.message || payload.summary || 'Generic Alert',
      description: payload.description || payload.details || JSON.stringify(payload),
      severity: payload.severity || 'warning',
      source,
      timestamp: new Date(payload.timestamp || Date.now()),
      labels: payload.labels || {},
      annotations: payload.annotations || {},
      fingerprint: payload.id || this.generateFingerprint(null, payload),
      status: payload.status === 'resolved' || payload.resolved ? 'resolved' : 'firing',
      suppressed: false,
      groupKey: payload.group || source
    };
  }

  private generateAlertId(): string {
    return 'alert_' + Math.random().toString(36).substr(2, 12);
  }

  private generateFingerprint(rule: AlertRule | null, data: any): string {
    const parts = [
      rule?.name || 'webhook',
      JSON.stringify(data?.labels || {}),
      data?.metric?.__name__ || ''
    ];
    
    return Buffer.from(parts.join('|')).toString('base64').substr(0, 16);
  }

  private generateGroupKey(rule: AlertRule, sample: any): string {
    const labels = this.extractLabels(sample);
    const groupByLabels = ['service', 'instance', 'job', 'alertname'];
    
    const keyParts = groupByLabels
      .filter(label => labels[label])
      .map(label => `${label}:${labels[label]}`);
    
    return keyParts.join(',') || rule.name;
  }

  private generateAlertTitle(rule: AlertRule, sample: any): string {
    const labels = this.extractLabels(sample);
    const service = labels.service || labels.job || 'Unknown Service';
    return `${rule.name} - ${service}`;
  }

  private generateAlertDescription(rule: AlertRule, sample: any): string {
    const value = this.extractMetricValue(sample, rule.conditions[0]?.metric);
    const labels = this.extractLabels(sample);
    
    return `${rule.description} (current value: ${value}, threshold: ${rule.conditions[0]?.threshold})`;
  }

  private generateAnnotations(rule: AlertRule, sample: any): Record<string, string> {
    return {
      rule_id: rule.id,
      runbook_url: `https://runbooks.example.com/${rule.name}`,
      dashboard_url: `https://grafana.example.com/d/${rule.name}`,
      description: rule.description
    };
  }

  private extractLabels(sample: any): Record<string, string> {
    return sample.metric || {};
  }

  private extractMetricValue(sample: any, metricName: string): number {
    if (sample.value && Array.isArray(sample.value)) {
      return parseFloat(sample.value[1]);
    }
    return 0;
  }

  private mapPrometheusSeverity(severity: string): 'critical' | 'warning' | 'info' {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'fatal':
        return 'critical';
      case 'warning':
      case 'warn':
        return 'warning';
      default:
        return 'info';
    }
  }

  private mapGrafanaSeverity(state: string): 'critical' | 'warning' | 'info' {
    switch (state?.toLowerCase()) {
      case 'alerting':
        return 'critical';
      case 'no_data':
        return 'warning';
      default:
        return 'info';
    }
  }

  private mapPagerDutySeverity(urgency: string): 'critical' | 'warning' | 'info' {
    switch (urgency?.toLowerCase()) {
      case 'high':
        return 'critical';
      case 'low':
        return 'warning';
      default:
        return 'info';
    }
  }

  private mapOpsgenieSeverity(priority: string): 'critical' | 'warning' | 'info' {
    switch (priority?.toLowerCase()) {
      case 'p1':
      case 'critical':
        return 'critical';
      case 'p2':
      case 'p3':
        return 'warning';
      default:
        return 'info';
    }
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }

  private getAlertByFingerprint(fingerprint: string): Alert | undefined {
    return Array.from(this.activeAlerts.values()).find(alert => 
      alert.fingerprint === fingerprint
    );
  }

  private getLastAlertByFingerprint(fingerprint: string): Alert | undefined {
    // In a real implementation, this would query a database
    return this.getAlertByFingerprint(fingerprint);
  }

  private findRuleByAlert(alert: Alert): AlertRule | undefined {
    // Try to find rule by alert properties
    for (const rule of this.rules.values()) {
      if (alert.source === 'prometheus' && rule.query) {
        // Match by query similarity or other criteria
        return rule;
      }
    }
    return undefined;
  }

  private async createIncidentFromAlert(alert: Alert, rule: AlertRule): Promise<void> {
    console.log(`Creating incident from alert: ${alert.title}`);
    // This would be handled by the incident management service
  }

  private async notifyTeam(alert: Alert, config: any): Promise<void> {
    console.log(`Notifying team about alert: ${alert.title}`);
    // Implementation for team notification
  }

  private async executeRunbook(alert: Alert, config: any): Promise<void> {
    console.log(`Executing runbook for alert: ${alert.title}`);
    // Implementation for runbook execution
  }

  private async scaleService(alert: Alert, config: any): Promise<void> {
    console.log(`Scaling service for alert: ${alert.title}`);
    // Implementation for auto-scaling
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializeBuiltInRules(): void {
    // High CPU usage rule
    this.addRule({
      id: 'high_cpu_usage',
      name: 'High CPU Usage',
      query: '100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
      severity: 'warning',
      description: 'CPU usage is above threshold',
      enabled: true,
      conditions: [{
        metric: 'cpu_usage',
        operator: '>',
        threshold: 80,
        duration: '5m'
      }],
      actions: [{
        type: 'notify_team',
        config: { team: 'infrastructure' }
      }],
      suppression: {
        enabled: true,
        duration: 10,
        conditions: []
      },
      routing: {
        teams: ['sre'],
        escalationPolicy: 'default',
        priority: 'medium',
        autoCreateIncident: false
      }
    });

    // High memory usage rule
    this.addRule({
      id: 'high_memory_usage',
      name: 'High Memory Usage',
      query: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
      severity: 'warning',
      description: 'Memory usage is above threshold',
      enabled: true,
      conditions: [{
        metric: 'memory_usage',
        operator: '>',
        threshold: 85,
        duration: '3m'
      }],
      actions: [{
        type: 'notify_team',
        config: { team: 'infrastructure' }
      }],
      suppression: {
        enabled: true,
        duration: 15,
        conditions: []
      },
      routing: {
        teams: ['sre'],
        escalationPolicy: 'default',
        priority: 'medium',
        autoCreateIncident: false
      }
    });

    // Service down rule
    this.addRule({
      id: 'service_down',
      name: 'Service Down',
      query: 'up',
      severity: 'critical',
      description: 'Service is not responding',
      enabled: true,
      conditions: [{
        metric: 'up',
        operator: '=',
        threshold: 0,
        duration: '1m'
      }],
      actions: [
        {
          type: 'create_incident',
          config: { severity: 'critical' }
        },
        {
          type: 'notify_team',
          config: { team: 'oncall' }
        }
      ],
      suppression: {
        enabled: false,
        duration: 0,
        conditions: []
      },
      routing: {
        teams: ['sre', 'oncall'],
        escalationPolicy: 'critical',
        priority: 'critical',
        autoCreateIncident: true
      }
    });

    // High error rate rule
    this.addRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      query: 'rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) * 100',
      severity: 'warning',
      description: 'HTTP error rate is above threshold',
      enabled: true,
      conditions: [{
        metric: 'error_rate',
        operator: '>',
        threshold: 5,
        duration: '5m'
      }],
      actions: [{
        type: 'notify_team',
        config: { team: 'backend' }
      }],
      suppression: {
        enabled: true,
        duration: 10,
        conditions: []
      },
      routing: {
        teams: ['backend'],
        escalationPolicy: 'default',
        priority: 'high',
        autoCreateIncident: false
      }
    });

    console.log('Initialized built-in alert rules');
  }

  private startDetectionLoop(): void {
    this.detectionTimer = setInterval(async () => {
      try {
        const alerts = await this.checkRules();
        console.log(`Alert detection cycle completed: ${alerts.length} alerts fired`);
      } catch (error) {
        console.error('Error in alert detection loop:', error);
      }
    }, this.config.checkInterval);

    console.log('Alert detection loop started');
  }

  public stop(): void {
    if (this.detectionTimer) {
      clearInterval(this.detectionTimer);
      this.detectionTimer = undefined;
    }
    console.log('Alert detector stopped');
  }

  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values())
      .filter(alert => alert.status === 'firing')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public getAlertRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  public suppressAlert(fingerprint: string, duration: number): void {
    const suppressUntil = new Date(Date.now() + duration * 60000);
    this.suppressedAlerts.set(fingerprint, suppressUntil);
    console.log(`Alert ${fingerprint} suppressed until ${suppressUntil}`);
  }
}