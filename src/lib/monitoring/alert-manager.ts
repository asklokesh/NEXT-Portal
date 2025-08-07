import { z } from 'zod';
import winston from 'winston';
import { EventEmitter } from 'events';
import axios from 'axios';
import { getMetricsCollector } from './metrics-collector';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'alerts.log' })
  ]
});

// Alert schemas
export const AlertConditionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  query: z.string(), // PromQL query
  threshold: z.number(),
  operator: z.enum(['>', '<', '>=', '<=', '==', '!=']),
  duration: z.string().default('5m'), // How long condition must be true
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  enabled: z.boolean().default(true),
  labels: z.record(z.string()).default({}),
  annotations: z.record(z.string()).default({})
});

export const AlertRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  conditions: z.array(AlertConditionSchema),
  groupBy: z.array(z.string()).default([]),
  evaluateEvery: z.string().default('1m'),
  for: z.string().default('5m'),
  noDataState: z.enum(['NoData', 'Alerting', 'OK']).default('NoData'),
  execErrState: z.enum(['Alerting', 'OK']).default('Alerting'),
  enabled: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date())
});

export const AlertInstanceSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  ruleName: z.string(),
  status: z.enum(['firing', 'resolved', 'silenced']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  message: z.string(),
  labels: z.record(z.string()).default({}),
  annotations: z.record(z.string()).default({}),
  startsAt: z.date(),
  endsAt: z.date().optional(),
  fingerprint: z.string(),
  generatorURL: z.string().optional(),
  silenceUntil: z.date().optional()
});

export const NotificationChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['email', 'slack', 'webhook', 'pagerduty', 'teams']),
  config: z.record(z.any()),
  enabled: z.boolean().default(true),
  filters: z.object({
    severities: z.array(z.enum(['low', 'medium', 'high', 'critical'])).default(['high', 'critical']),
    labels: z.record(z.string()).default({})
  }).default({})
});

export type AlertCondition = z.infer<typeof AlertConditionSchema>;
export type AlertRule = z.infer<typeof AlertRuleSchema>;
export type AlertInstance = z.infer<typeof AlertInstanceSchema>;
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

interface AlertManagerConfig {
  prometheusUrl?: string;
  evaluationInterval?: number;
  enableNotifications?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export class AlertManager extends EventEmitter {
  private config: Required<AlertManagerConfig>;
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, AlertInstance> = new Map();
  private channels: Map<string, NotificationChannel> = new Map();
  private evaluationTimer?: NodeJS.Timeout;
  private isEvaluating: boolean = false;
  private metricsCollector = getMetricsCollector();

  constructor(config: AlertManagerConfig = {}) {
    super();
    this.config = {
      prometheusUrl: config.prometheusUrl || process.env.PROMETHEUS_URL || 'http://localhost:9090',
      evaluationInterval: config.evaluationInterval || 60000, // 1 minute
      enableNotifications: config.enableNotifications ?? true,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 5000
    };

    logger.info('Alert Manager initialized', { config: this.config });
  }

  // Start alert evaluation
  start(): void {
    if (this.isEvaluating) {
      logger.warn('Alert evaluation already running');
      return;
    }

    this.isEvaluating = true;
    this.evaluationTimer = setInterval(() => {
      this.evaluateRules().catch(error => {
        logger.error('Error during rule evaluation', { error: error.message });
      });
    }, this.config.evaluationInterval);

    logger.info('Alert evaluation started', {
      interval: this.config.evaluationInterval
    });
  }

  // Stop alert evaluation
  stop(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = undefined;
    }
    this.isEvaluating = false;
    logger.info('Alert evaluation stopped');
  }

  // Rule Management
  addRule(rule: AlertRule): void {
    try {
      const validatedRule = AlertRuleSchema.parse(rule);
      this.rules.set(validatedRule.id, validatedRule);
      logger.info('Alert rule added', { ruleId: validatedRule.id, name: validatedRule.name });
      this.emit('rule:added', validatedRule);
    } catch (error) {
      logger.error('Failed to add alert rule', { error: error.message });
      throw error;
    }
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const existingRule = this.rules.get(ruleId);
    if (!existingRule) {
      throw new Error(`Alert rule ${ruleId} not found`);
    }

    const updatedRule = { ...existingRule, ...updates, updatedAt: new Date() };
    try {
      const validatedRule = AlertRuleSchema.parse(updatedRule);
      this.rules.set(ruleId, validatedRule);
      logger.info('Alert rule updated', { ruleId, name: validatedRule.name });
      this.emit('rule:updated', validatedRule);
    } catch (error) {
      logger.error('Failed to update alert rule', { ruleId, error: error.message });
      throw error;
    }
  }

  deleteRule(ruleId: string): void {
    if (!this.rules.has(ruleId)) {
      throw new Error(`Alert rule ${ruleId} not found`);
    }

    this.rules.delete(ruleId);
    // Also remove any active alerts for this rule
    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.ruleId === ruleId) {
        this.activeAlerts.delete(alertId);
      }
    }

    logger.info('Alert rule deleted', { ruleId });
    this.emit('rule:deleted', { ruleId });
  }

  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  // Notification Channel Management
  addNotificationChannel(channel: NotificationChannel): void {
    try {
      const validatedChannel = NotificationChannelSchema.parse(channel);
      this.channels.set(validatedChannel.id, validatedChannel);
      logger.info('Notification channel added', { channelId: validatedChannel.id, type: validatedChannel.type });
      this.emit('channel:added', validatedChannel);
    } catch (error) {
      logger.error('Failed to add notification channel', { error: error.message });
      throw error;
    }
  }

  removeNotificationChannel(channelId: string): void {
    if (!this.channels.has(channelId)) {
      throw new Error(`Notification channel ${channelId} not found`);
    }

    this.channels.delete(channelId);
    logger.info('Notification channel removed', { channelId });
    this.emit('channel:removed', { channelId });
  }

  // Alert Evaluation
  private async evaluateRules(): Promise<void> {
    logger.debug('Starting rule evaluation');
    
    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) {
        continue;
      }

      try {
        await this.evaluateRule(rule);
      } catch (error) {
        logger.error('Failed to evaluate rule', {
          ruleId,
          name: rule.name,
          error: error.message
        });
      }
    }
  }

  private async evaluateRule(rule: AlertRule): Promise<void> {
    for (const condition of rule.conditions) {
      if (!condition.enabled) {
        continue;
      }

      try {
        const result = await this.queryPrometheus(condition.query);
        const isTriggered = this.evaluateCondition(condition, result);
        
        const alertId = this.generateAlertId(rule.id, condition.id);
        const existingAlert = this.activeAlerts.get(alertId);

        if (isTriggered && !existingAlert) {
          // New alert
          const alert = this.createAlert(rule, condition, result);
          this.activeAlerts.set(alertId, alert);
          await this.sendNotifications(alert);
          this.metricsCollector.recordAlert(alert.ruleName, alert.severity, 'backstage');
          logger.info('Alert fired', { alertId, ruleName: rule.name });
          this.emit('alert:fired', alert);
        } else if (!isTriggered && existingAlert && existingAlert.status === 'firing') {
          // Alert resolved
          existingAlert.status = 'resolved';
          existingAlert.endsAt = new Date();
          await this.sendNotifications(existingAlert);
          this.activeAlerts.delete(alertId);
          logger.info('Alert resolved', { alertId, ruleName: rule.name });
          this.emit('alert:resolved', existingAlert);
        }
      } catch (error) {
        logger.error('Failed to evaluate condition', {
          ruleId: rule.id,
          conditionId: condition.id,
          error: error.message
        });
      }
    }
  }

  private async queryPrometheus(query: string): Promise<any> {
    try {
      const response = await axios.get(`${this.config.prometheusUrl}/api/v1/query`, {
        params: { query },
        timeout: 10000
      });

      if (response.data.status !== 'success') {
        throw new Error(`Prometheus query failed: ${response.data.error}`);
      }

      return response.data.data;
    } catch (error) {
      logger.error('Prometheus query failed', { query, error: error.message });
      throw error;
    }
  }

  private evaluateCondition(condition: AlertCondition, result: any): boolean {
    if (!result.result || result.result.length === 0) {
      return false;
    }

    // For now, evaluate against the first result
    const value = parseFloat(result.result[0]?.value?.[1]);
    if (isNaN(value)) {
      return false;
    }

    switch (condition.operator) {
      case '>':
        return value > condition.threshold;
      case '<':
        return value < condition.threshold;
      case '>=':
        return value >= condition.threshold;
      case '<=':
        return value <= condition.threshold;
      case '==':
        return value === condition.threshold;
      case '!=':
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  private createAlert(rule: AlertRule, condition: AlertCondition, result: any): AlertInstance {
    const alertId = this.generateAlertId(rule.id, condition.id);
    const fingerprint = this.generateFingerprint(rule, condition, result);
    
    return {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      status: 'firing',
      severity: condition.severity,
      message: this.formatAlertMessage(condition, result),
      labels: { ...rule.conditions[0]?.labels, ...condition.labels },
      annotations: { ...rule.conditions[0]?.annotations, ...condition.annotations },
      startsAt: new Date(),
      fingerprint,
      generatorURL: `${this.config.prometheusUrl}/graph?g0.expr=${encodeURIComponent(condition.query)}`
    };
  }

  private generateAlertId(ruleId: string, conditionId: string): string {
    return `${ruleId}-${conditionId}-${Date.now()}`;
  }

  private generateFingerprint(rule: AlertRule, condition: AlertCondition, result: any): string {
    const data = `${rule.id}-${condition.id}-${JSON.stringify(result.result[0]?.metric || {})}`;
    return Buffer.from(data).toString('base64');
  }

  private formatAlertMessage(condition: AlertCondition, result: any): string {
    const value = result.result[0]?.value?.[1];
    return `${condition.name}: Current value ${value} ${condition.operator} ${condition.threshold}`;
  }

  // Notification System
  private async sendNotifications(alert: AlertInstance): Promise<void> {
    if (!this.config.enableNotifications) {
      return;
    }

    const matchingChannels = Array.from(this.channels.values())
      .filter(channel => 
        channel.enabled &&
        this.matchesChannelFilters(alert, channel)
      );

    for (const channel of matchingChannels) {
      try {
        await this.sendNotification(channel, alert);
      } catch (error) {
        logger.error('Failed to send notification', {
          channelId: channel.id,
          alertId: alert.id,
          error: error.message
        });
      }
    }
  }

  private matchesChannelFilters(alert: AlertInstance, channel: NotificationChannel): boolean {
    // Check severity filter
    if (!channel.filters.severities.includes(alert.severity)) {
      return false;
    }

    // Check label filters
    for (const [key, value] of Object.entries(channel.filters.labels)) {
      if (alert.labels[key] !== value) {
        return false;
      }
    }

    return true;
  }

  private async sendNotification(channel: NotificationChannel, alert: AlertInstance): Promise<void> {
    switch (channel.type) {
      case 'slack':
        await this.sendSlackNotification(channel, alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(channel, alert);
        break;
      case 'email':
        // Email notification would be implemented here
        logger.info('Email notification (not implemented)', { channelId: channel.id });
        break;
      default:
        logger.warn('Unknown notification channel type', { type: channel.type });
    }
  }

  private async sendSlackNotification(channel: NotificationChannel, alert: AlertInstance): Promise<void> {
    const webhookUrl = channel.config.webhookUrl;
    if (!webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const color = {
      low: '#36a64f',
      medium: '#ff9f40',
      high: '#ff6b6b',
      critical: '#d63031'
    }[alert.severity];

    const payload = {
      attachments: [
        {
          color,
          title: `Alert: ${alert.ruleName}`,
          text: alert.message,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Status',
              value: alert.status.toUpperCase(),
              short: true
            },
            {
              title: 'Started At',
              value: alert.startsAt.toISOString(),
              short: true
            }
          ],
          actions: alert.generatorURL ? [
            {
              type: 'button',
              text: 'View in Prometheus',
              url: alert.generatorURL
            }
          ] : undefined
        }
      ]
    };

    await axios.post(webhookUrl, payload);
    logger.info('Slack notification sent', { channelId: channel.id, alertId: alert.id });
  }

  private async sendWebhookNotification(channel: NotificationChannel, alert: AlertInstance): Promise<void> {
    const webhookUrl = channel.config.url;
    if (!webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      alert,
      timestamp: new Date().toISOString(),
      source: 'backstage-alert-manager'
    };

    await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        ...(channel.config.headers || {})
      }
    });

    logger.info('Webhook notification sent', { channelId: channel.id, alertId: alert.id });
  }

  // Alert Management
  getActiveAlerts(): AlertInstance[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlert(alertId: string): AlertInstance | undefined {
    return this.activeAlerts.get(alertId);
  }

  silenceAlert(alertId: string, duration: number): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.status = 'silenced';
    alert.silenceUntil = new Date(Date.now() + duration);
    
    logger.info('Alert silenced', { alertId, duration });
    this.emit('alert:silenced', alert);
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.annotations.acknowledged = 'true';
    alert.annotations.acknowledgedAt = new Date().toISOString();
    
    logger.info('Alert acknowledged', { alertId });
    this.emit('alert:acknowledged', alert);
  }

  // Utility methods
  getStatus(): {
    isEvaluating: boolean;
    rulesCount: number;
    activeAlertsCount: number;
    channelsCount: number;
  } {
    return {
      isEvaluating: this.isEvaluating,
      rulesCount: this.rules.size,
      activeAlertsCount: this.activeAlerts.size,
      channelsCount: this.channels.size
    };
  }

  // Pre-defined alert rules for common scenarios
  static getDefaultRules(): AlertRule[] {
    return [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        description: 'HTTP error rate is above 5%',
        conditions: [
          {
            id: 'error-rate-condition',
            name: 'Error Rate > 5%',
            query: 'rate(backstage_http_requests_total{status_code=~"5.*"}[5m]) / rate(backstage_http_requests_total[5m]) * 100',
            threshold: 5,
            operator: '>',
            severity: 'high',
            enabled: true,
            labels: { team: 'platform' },
            annotations: { runbook: 'https://docs.example.com/runbooks/high-error-rate' }
          }
        ],
        evaluateEvery: '1m',
        for: '5m',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'high-response-time',
        name: 'High Response Time',
        description: 'P95 response time is above 2 seconds',
        conditions: [
          {
            id: 'response-time-condition',
            name: 'P95 Response Time > 2s',
            query: 'histogram_quantile(0.95, rate(backstage_http_request_duration_seconds_bucket[5m]))',
            threshold: 2,
            operator: '>',
            severity: 'medium',
            enabled: true,
            labels: { team: 'platform' },
            annotations: { description: 'Application response time is degraded' }
          }
        ],
        evaluateEvery: '1m',
        for: '10m',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'low-deployment-frequency',
        name: 'Low Deployment Frequency',
        description: 'No deployments in the last 7 days',
        conditions: [
          {
            id: 'deployment-frequency-condition',
            name: 'No Deployments > 7 days',
            query: 'time() - max(backstage_deployment_events_total) > 7*24*3600',
            threshold: 1,
            operator: '>',
            severity: 'low',
            enabled: true,
            labels: { team: 'development' },
            annotations: { description: 'Deployment frequency is below recommended threshold' }
          }
        ],
        evaluateEvery: '1h',
        for: '1h',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }
}

export default AlertManager;