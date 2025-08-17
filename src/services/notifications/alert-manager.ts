/**
 * Alert Manager
 * Intelligent alert routing, deduplication, and incident management
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import cron from 'node-cron';
import { createHash } from 'crypto';
import * as tf from '@tensorflow/tfjs-node';

// Types and Interfaces
export interface Alert {
  id: string;
  fingerprint: string;
  name: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  status: 'firing' | 'resolved' | 'acknowledged' | 'suppressed';
  source: string;
  service?: string;
  team?: string;
  environment?: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: Date;
  endsAt?: Date;
  generatorURL?: string;
  correlationId?: string;
  groupKey?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  expression: string;
  duration?: number; // seconds
  severity: Alert['severity'];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  enabled: boolean;
  evaluationInterval: number; // seconds
  lastEvaluation?: Date;
  lastState?: 'normal' | 'pending' | 'firing';
}

export interface AlertGroup {
  id: string;
  name: string;
  alerts: Alert[];
  commonLabels: Record<string, string>;
  commonAnnotations: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationPolicy {
  id: string;
  name: string;
  rules: EscalationRule[];
  enabled: boolean;
}

export interface EscalationRule {
  level: number;
  delayMinutes: number;
  targets: EscalationTarget[];
  repeat?: number;
  conditions?: AlertCondition[];
}

export interface EscalationTarget {
  type: 'user' | 'team' | 'schedule' | 'webhook';
  id: string;
  contactMethods?: ('email' | 'sms' | 'call' | 'push')[];
}

export interface OnCallSchedule {
  id: string;
  name: string;
  timezone: string;
  rotations: ScheduleRotation[];
  overrides?: ScheduleOverride[];
}

export interface ScheduleRotation {
  id: string;
  users: string[];
  startDate: Date;
  rotationType: 'daily' | 'weekly' | 'custom';
  shiftLength?: number; // hours
  handoffTime?: string; // HH:mm
}

export interface ScheduleOverride {
  user: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
}

export interface AlertCondition {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'regex' | 'in';
  value: any;
}

export interface Incident {
  id: string;
  title: string;
  description?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  alerts: Alert[];
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  assignee?: string;
  team?: string;
  timeline: IncidentEvent[];
  postmortem?: string;
}

export interface IncidentEvent {
  timestamp: Date;
  type: 'created' | 'acknowledged' | 'escalated' | 'updated' | 'resolved' | 'reopened';
  user?: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface AlertMetrics {
  totalAlerts: number;
  firingAlerts: number;
  resolvedAlerts: number;
  suppressedAlerts: number;
  mttr: number; // Mean Time To Resolution (minutes)
  alertsBySevertity: Record<Alert['severity'], number>;
  alertsByService: Record<string, number>;
  alertNoise: number; // percentage
  falsePositiveRate: number; // percentage
}

export interface AlertPrediction {
  service: string;
  probability: number;
  predictedTime: Date;
  confidence: number;
  suggestedActions: string[];
}

// Integration Interfaces
export interface PagerDutyConfig {
  apiKey: string;
  routingKey: string;
  baseUrl?: string;
}

export interface OpsGenieConfig {
  apiKey: string;
  region?: 'us' | 'eu';
  baseUrl?: string;
}

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

export interface SuppressionRule {
  id: string;
  name: string;
  conditions: AlertCondition[];
  duration?: number; // seconds
  reason: string;
  enabled: boolean;
}

// Main Alert Manager Class
export class AlertManager extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private alertGroups: Map<string, AlertGroup> = new Map();
  private incidents: Map<string, Incident> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private escalationPolicies: Map<string, EscalationPolicy> = new Map();
  private onCallSchedules: Map<string, OnCallSchedule> = new Map();
  
  // Alert deduplication
  private alertFingerprints: Map<string, Alert> = new Map();
  private alertCorrelations: Map<string, Set<string>> = new Map();
  
  // Suppression rules
  private suppressionRules: Map<string, SuppressionRule> = new Map();
  private suppressedAlerts: Set<string> = new Set();
  
  // ML models for prediction
  private alertPredictionModel?: tf.LayersModel;
  private anomalyDetectionModel?: tf.LayersModel;
  
  // Metrics
  private metrics: AlertMetrics = {
    totalAlerts: 0,
    firingAlerts: 0,
    resolvedAlerts: 0,
    suppressedAlerts: 0,
    mttr: 0,
    alertsBySevertity: { info: 0, warning: 0, error: 0, critical: 0 },
    alertsByService: {},
    alertNoise: 0,
    falsePositiveRate: 0,
  };
  
  // Integrations
  private pagerDutyConfig?: PagerDutyConfig;
  private opsGenieConfig?: OpsGenieConfig;
  private slackConfig?: SlackConfig;
  
  // Configuration
  private config = {
    dedupWindow: 300, // 5 minutes
    correlationWindow: 600, // 10 minutes
    groupingWindow: 300, // 5 minutes
    alertRetention: 30 * 24 * 60 * 60, // 30 days
    maxAlertsPerGroup: 100,
    autoResolveTimeout: 3600, // 1 hour
    fatigueThreshold: 50, // alerts per hour
  };

  constructor() {
    super();
    this.initialize();
  }

  // Initialization
  private async initialize(): Promise<void> {
    await this.loadMLModels();
    this.startEvaluationLoop();
    this.startMetricsCollection();
    this.startCleanupJob();
  }

  private async loadMLModels(): Promise<void> {
    try {
      // Load pre-trained models if available
      if (process.env.ALERT_PREDICTION_MODEL_PATH) {
        this.alertPredictionModel = await tf.loadLayersModel(
          `file://${process.env.ALERT_PREDICTION_MODEL_PATH}`
        );
      }
      
      if (process.env.ANOMALY_DETECTION_MODEL_PATH) {
        this.anomalyDetectionModel = await tf.loadLayersModel(
          `file://${process.env.ANOMALY_DETECTION_MODEL_PATH}`
        );
      }
    } catch (error) {
      console.error('Failed to load ML models:', error);
      // Initialize basic models if pre-trained not available
      this.initializeBasicModels();
    }
  }

  private initializeBasicModels(): void {
    // Create a simple neural network for alert prediction
    this.alertPredictionModel = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [10], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }),
      ],
    });
    
    this.alertPredictionModel.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });
  }

  // Core Alert Management
  async receiveAlert(alert: Partial<Alert>): Promise<Alert> {
    // Generate fingerprint for deduplication
    const fingerprint = this.generateFingerprint(alert);
    
    // Check for existing alert
    const existingAlert = this.alertFingerprints.get(fingerprint);
    if (existingAlert && this.isWithinDedupWindow(existingAlert)) {
      // Update existing alert
      this.updateAlert(existingAlert, alert);
      return existingAlert;
    }
    
    // Create new alert
    const newAlert: Alert = {
      id: alert.id || uuidv4(),
      fingerprint,
      name: alert.name || 'Unknown Alert',
      severity: alert.severity || 'warning',
      status: alert.status || 'firing',
      source: alert.source || 'unknown',
      service: alert.service,
      team: alert.team,
      environment: alert.environment,
      labels: alert.labels || {},
      annotations: alert.annotations || {},
      startsAt: alert.startsAt || new Date(),
      endsAt: alert.endsAt,
      generatorURL: alert.generatorURL,
    };
    
    // Check suppression rules
    if (this.shouldSuppress(newAlert)) {
      newAlert.status = 'suppressed';
      this.suppressedAlerts.add(newAlert.id);
      this.metrics.suppressedAlerts++;
    }
    
    // Store alert
    this.alerts.set(newAlert.id, newAlert);
    this.alertFingerprints.set(fingerprint, newAlert);
    
    // Correlate with other alerts
    await this.correlateAlert(newAlert);
    
    // Group alert
    await this.groupAlert(newAlert);
    
    // Process alert (routing, escalation, etc.)
    if (newAlert.status === 'firing') {
      await this.processAlert(newAlert);
    }
    
    // Update metrics
    this.updateMetrics(newAlert);
    
    // Emit event
    this.emit('alert:received', newAlert);
    
    return newAlert;
  }

  private async processAlert(alert: Alert): Promise<void> {
    // Check if alert should create/update incident
    const incident = await this.manageIncident(alert);
    
    // Apply escalation policies
    await this.applyEscalationPolicies(alert, incident);
    
    // Route to integrations
    await this.routeToIntegrations(alert);
    
    // Check for alert fatigue
    if (this.detectAlertFatigue(alert)) {
      this.emit('alert:fatigue', {
        service: alert.service,
        rate: this.calculateAlertRate(alert.service),
      });
    }
    
    // Predict future alerts
    const predictions = await this.predictFutureAlerts(alert);
    if (predictions.length > 0) {
      this.emit('alert:predictions', predictions);
    }
  }

  private generateFingerprint(alert: Partial<Alert>): string {
    const parts = [
      alert.name,
      alert.source,
      alert.service,
      ...Object.entries(alert.labels || {}).map(([k, v]) => `${k}:${v}`),
    ].filter(Boolean).join(':');
    
    return createHash('sha256').update(parts).digest('hex');
  }

  private isWithinDedupWindow(alert: Alert): boolean {
    const now = Date.now();
    const alertTime = alert.startsAt.getTime();
    return (now - alertTime) < this.config.dedupWindow * 1000;
  }

  private updateAlert(existing: Alert, update: Partial<Alert>): void {
    // Update alert fields
    if (update.severity && update.severity !== existing.severity) {
      existing.severity = update.severity;
    }
    
    if (update.annotations) {
      existing.annotations = { ...existing.annotations, ...update.annotations };
    }
    
    if (update.status === 'resolved' && existing.status === 'firing') {
      existing.status = 'resolved';
      existing.endsAt = update.endsAt || new Date();
      this.emit('alert:resolved', existing);
    }
    
    this.emit('alert:updated', existing);
  }

  // Alert Correlation
  private async correlateAlert(alert: Alert): Promise<void> {
    const correlationKey = this.generateCorrelationKey(alert);
    
    if (!this.alertCorrelations.has(correlationKey)) {
      this.alertCorrelations.set(correlationKey, new Set());
    }
    
    const correlatedAlerts = this.alertCorrelations.get(correlationKey)!;
    
    // Find related alerts
    for (const [id, otherAlert] of this.alerts.entries()) {
      if (id === alert.id) continue;
      
      if (this.areAlertsCorrelated(alert, otherAlert)) {
        correlatedAlerts.add(otherAlert.id);
        alert.correlationId = correlationKey;
        otherAlert.correlationId = correlationKey;
      }
    }
    
    if (correlatedAlerts.size > 0) {
      correlatedAlerts.add(alert.id);
      this.emit('alert:correlated', {
        alert,
        correlatedAlerts: Array.from(correlatedAlerts),
      });
    }
  }

  private generateCorrelationKey(alert: Alert): string {
    return `${alert.service || 'unknown'}-${alert.environment || 'unknown'}`;
  }

  private areAlertsCorrelated(alert1: Alert, alert2: Alert): boolean {
    // Check time window
    const timeDiff = Math.abs(alert1.startsAt.getTime() - alert2.startsAt.getTime());
    if (timeDiff > this.config.correlationWindow * 1000) {
      return false;
    }
    
    // Check service/environment
    if (alert1.service === alert2.service || alert1.environment === alert2.environment) {
      return true;
    }
    
    // Check label similarity
    const commonLabels = Object.keys(alert1.labels).filter(
      key => alert2.labels[key] === alert1.labels[key]
    );
    
    return commonLabels.length >= 2;
  }

  // Alert Grouping
  private async groupAlert(alert: Alert): Promise<void> {
    const groupKey = this.generateGroupKey(alert);
    alert.groupKey = groupKey;
    
    let group = this.alertGroups.get(groupKey);
    
    if (!group) {
      group = {
        id: uuidv4(),
        name: this.generateGroupName(alert),
        alerts: [],
        commonLabels: alert.labels,
        commonAnnotations: alert.annotations,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.alertGroups.set(groupKey, group);
    }
    
    // Add alert to group
    if (!group.alerts.find(a => a.id === alert.id)) {
      group.alerts.push(alert);
      
      // Limit group size
      if (group.alerts.length > this.config.maxAlertsPerGroup) {
        group.alerts = group.alerts.slice(-this.config.maxAlertsPerGroup);
      }
    }
    
    // Update common labels/annotations
    group.commonLabels = this.findCommonLabels(group.alerts);
    group.commonAnnotations = this.findCommonAnnotations(group.alerts);
    group.updatedAt = new Date();
    
    this.emit('alert:grouped', { alert, group });
  }

  private generateGroupKey(alert: Alert): string {
    const parts = [
      alert.service,
      alert.environment,
      alert.severity,
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(':') : 'default';
  }

  private generateGroupName(alert: Alert): string {
    if (alert.service) {
      return `${alert.service} ${alert.severity} alerts`;
    }
    return `${alert.severity} alerts`;
  }

  private findCommonLabels(alerts: Alert[]): Record<string, string> {
    if (alerts.length === 0) return {};
    
    const common: Record<string, string> = {};
    const firstAlert = alerts[0];
    
    for (const [key, value] of Object.entries(firstAlert.labels)) {
      if (alerts.every(a => a.labels[key] === value)) {
        common[key] = value;
      }
    }
    
    return common;
  }

  private findCommonAnnotations(alerts: Alert[]): Record<string, string> {
    if (alerts.length === 0) return {};
    
    const common: Record<string, string> = {};
    const firstAlert = alerts[0];
    
    for (const [key, value] of Object.entries(firstAlert.annotations)) {
      if (alerts.every(a => a.annotations[key] === value)) {
        common[key] = value;
      }
    }
    
    return common;
  }

  // Incident Management
  private async manageIncident(alert: Alert): Promise<Incident | undefined> {
    // Check if alert should create new incident
    if (alert.severity === 'critical' || alert.severity === 'error') {
      // Look for existing incident
      let incident = this.findIncidentForAlert(alert);
      
      if (!incident) {
        // Create new incident
        incident = await this.createIncident(alert);
      } else {
        // Add alert to existing incident
        if (!incident.alerts.find(a => a.id === alert.id)) {
          incident.alerts.push(alert);
          this.addIncidentEvent(incident, 'updated', undefined, `Added alert: ${alert.name}`);
        }
      }
      
      return incident;
    }
    
    return undefined;
  }

  private findIncidentForAlert(alert: Alert): Incident | undefined {
    for (const incident of this.incidents.values()) {
      if (incident.status === 'open' || incident.status === 'investigating') {
        // Check if alert matches incident criteria
        if (incident.alerts.some(a => 
          a.service === alert.service && 
          a.environment === alert.environment
        )) {
          return incident;
        }
      }
    }
    return undefined;
  }

  private async createIncident(alert: Alert): Promise<Incident> {
    const incident: Incident = {
      id: uuidv4(),
      title: `${alert.severity.toUpperCase()}: ${alert.name}`,
      description: alert.annotations.description || alert.annotations.summary,
      severity: this.mapAlertSeverityToIncident(alert.severity),
      status: 'open',
      alerts: [alert],
      createdAt: new Date(),
      team: alert.team,
      timeline: [],
    };
    
    this.incidents.set(incident.id, incident);
    this.addIncidentEvent(incident, 'created', undefined, 'Incident created from alert');
    
    this.emit('incident:created', incident);
    
    return incident;
  }

  private mapAlertSeverityToIncident(severity: Alert['severity']): Incident['severity'] {
    const mapping: Record<Alert['severity'], Incident['severity']> = {
      'info': 'low',
      'warning': 'medium',
      'error': 'high',
      'critical': 'critical',
    };
    return mapping[severity];
  }

  private addIncidentEvent(
    incident: Incident,
    type: IncidentEvent['type'],
    user?: string,
    message?: string
  ): void {
    incident.timeline.push({
      timestamp: new Date(),
      type,
      user,
      message: message || `Incident ${type}`,
    });
  }

  // Escalation Management
  private async applyEscalationPolicies(alert: Alert, incident?: Incident): Promise<void> {
    const policies = this.findApplicablePolicies(alert);
    
    for (const policy of policies) {
      if (!policy.enabled) continue;
      
      for (const rule of policy.rules) {
        if (this.evaluateEscalationConditions(alert, rule.conditions)) {
          await this.executeEscalation(alert, rule, incident);
        }
      }
    }
  }

  private findApplicablePolicies(alert: Alert): EscalationPolicy[] {
    const policies: EscalationPolicy[] = [];
    
    for (const policy of this.escalationPolicies.values()) {
      // Check if policy applies to this alert
      // This is simplified - implement based on your requirements
      policies.push(policy);
    }
    
    return policies;
  }

  private evaluateEscalationConditions(alert: Alert, conditions?: AlertCondition[]): boolean {
    if (!conditions || conditions.length === 0) return true;
    
    return conditions.every(condition => {
      const value = this.getAlertFieldValue(alert, condition.field);
      return this.evaluateCondition(value, condition.operator, condition.value);
    });
  }

  private getAlertFieldValue(alert: Alert, field: string): any {
    const parts = field.split('.');
    let value: any = alert;
    
    for (const part of parts) {
      value = value?.[part];
    }
    
    return value;
  }

  private evaluateCondition(value: any, operator: AlertCondition['operator'], target: any): boolean {
    switch (operator) {
      case 'equals':
        return value === target;
      case 'contains':
        return String(value).includes(String(target));
      case 'gt':
        return value > target;
      case 'lt':
        return value < target;
      case 'regex':
        return new RegExp(target).test(String(value));
      case 'in':
        return Array.isArray(target) && target.includes(value);
      default:
        return false;
    }
  }

  private async executeEscalation(
    alert: Alert,
    rule: EscalationRule,
    incident?: Incident
  ): Promise<void> {
    // Schedule escalation with delay
    setTimeout(async () => {
      for (const target of rule.targets) {
        await this.notifyTarget(alert, target, incident);
      }
      
      this.emit('alert:escalated', {
        alert,
        level: rule.level,
        targets: rule.targets,
      });
    }, rule.delayMinutes * 60 * 1000);
  }

  private async notifyTarget(
    alert: Alert,
    target: EscalationTarget,
    incident?: Incident
  ): Promise<void> {
    switch (target.type) {
      case 'user':
        await this.notifyUser(target.id, alert, target.contactMethods);
        break;
      case 'team':
        await this.notifyTeam(target.id, alert);
        break;
      case 'schedule':
        await this.notifyOnCall(target.id, alert);
        break;
      case 'webhook':
        await this.notifyWebhook(target.id, alert);
        break;
    }
  }

  // On-Call Management
  async getCurrentOnCall(scheduleId: string): Promise<string | undefined> {
    const schedule = this.onCallSchedules.get(scheduleId);
    if (!schedule) return undefined;
    
    const now = new Date();
    
    // Check overrides first
    if (schedule.overrides) {
      for (const override of schedule.overrides) {
        if (now >= override.startDate && now <= override.endDate) {
          return override.user;
        }
      }
    }
    
    // Check regular rotations
    for (const rotation of schedule.rotations) {
      const onCallUser = this.getUserForRotation(rotation, now);
      if (onCallUser) return onCallUser;
    }
    
    return undefined;
  }

  private getUserForRotation(rotation: ScheduleRotation, date: Date): string | undefined {
    if (rotation.users.length === 0) return undefined;
    
    const startTime = rotation.startDate.getTime();
    const currentTime = date.getTime();
    const elapsed = currentTime - startTime;
    
    let rotationLength: number;
    switch (rotation.rotationType) {
      case 'daily':
        rotationLength = 24 * 60 * 60 * 1000;
        break;
      case 'weekly':
        rotationLength = 7 * 24 * 60 * 60 * 1000;
        break;
      case 'custom':
        rotationLength = (rotation.shiftLength || 24) * 60 * 60 * 1000;
        break;
      default:
        rotationLength = 24 * 60 * 60 * 1000;
    }
    
    const currentRotation = Math.floor(elapsed / rotationLength);
    const userIndex = currentRotation % rotation.users.length;
    
    return rotation.users[userIndex];
  }

  // Suppression Rules
  private suppressionRules = new Map<string, SuppressionRule>();

  private shouldSuppress(alert: Alert): boolean {
    for (const rule of this.suppressionRules.values()) {
      if (!rule.enabled) continue;
      
      if (this.evaluateEscalationConditions(alert, rule.conditions)) {
        this.emit('alert:suppressed', { alert, rule });
        return true;
      }
    }
    
    return false;
  }

  addSuppressionRule(rule: SuppressionRule): void {
    this.suppressionRules.set(rule.id, rule);
    this.emit('suppression:rule:added', rule);
  }

  removeSuppressionRule(ruleId: string): void {
    this.suppressionRules.delete(ruleId);
    this.emit('suppression:rule:removed', ruleId);
  }

  // Alert Fatigue Detection
  private detectAlertFatigue(alert: Alert): boolean {
    if (!alert.service) return false;
    
    const rate = this.calculateAlertRate(alert.service);
    return rate > this.config.fatigueThreshold;
  }

  private calculateAlertRate(service?: string): number {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    
    let count = 0;
    for (const alert of this.alerts.values()) {
      if ((!service || alert.service === service) && 
          alert.startsAt.getTime() > hourAgo) {
        count++;
      }
    }
    
    return count;
  }

  // ML-based Alert Prediction
  private async predictFutureAlerts(alert: Alert): Promise<AlertPrediction[]> {
    if (!this.alertPredictionModel) return [];
    
    try {
      // Prepare features
      const features = this.extractAlertFeatures(alert);
      const input = tf.tensor2d([features]);
      
      // Make prediction
      const prediction = this.alertPredictionModel.predict(input) as tf.Tensor;
      const probability = await prediction.data();
      
      input.dispose();
      prediction.dispose();
      
      if (probability[0] > 0.7) {
        return [{
          service: alert.service || 'unknown',
          probability: probability[0],
          predictedTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
          confidence: probability[0],
          suggestedActions: this.generateSuggestedActions(alert),
        }];
      }
    } catch (error) {
      console.error('Alert prediction failed:', error);
    }
    
    return [];
  }

  private extractAlertFeatures(alert: Alert): number[] {
    // Extract numerical features for ML model
    return [
      this.severityToNumber(alert.severity),
      this.calculateAlertRate(alert.service),
      new Date().getHours(), // Hour of day
      new Date().getDay(), // Day of week
      alert.service ? 1 : 0,
      alert.environment === 'production' ? 1 : 0,
      this.getServiceAlertHistory(alert.service),
      this.getRecentIncidentCount(),
      this.metrics.mttr,
      this.metrics.alertNoise,
    ];
  }

  private severityToNumber(severity: Alert['severity']): number {
    const mapping = { info: 1, warning: 2, error: 3, critical: 4 };
    return mapping[severity];
  }

  private getServiceAlertHistory(service?: string): number {
    if (!service) return 0;
    return this.metrics.alertsByService[service] || 0;
  }

  private getRecentIncidentCount(): number {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return Array.from(this.incidents.values()).filter(
      i => i.createdAt.getTime() > dayAgo
    ).length;
  }

  private generateSuggestedActions(alert: Alert): string[] {
    const actions: string[] = [];
    
    if (alert.severity === 'critical') {
      actions.push('Initiate incident response procedure');
      actions.push('Check system dependencies');
    }
    
    if (this.detectAlertFatigue(alert)) {
      actions.push('Review alert thresholds');
      actions.push('Consider alert aggregation');
    }
    
    const correlatedAlerts = this.alertCorrelations.get(alert.correlationId || '');
    if (correlatedAlerts && correlatedAlerts.size > 3) {
      actions.push('Investigate correlated alerts for root cause');
    }
    
    return actions;
  }

  // Integration Methods
  async configureIntegration(type: 'pagerduty' | 'opsgenie' | 'slack', config: any): Promise<void> {
    switch (type) {
      case 'pagerduty':
        this.pagerDutyConfig = config as PagerDutyConfig;
        break;
      case 'opsgenie':
        this.opsGenieConfig = config as OpsGenieConfig;
        break;
      case 'slack':
        this.slackConfig = config as SlackConfig;
        break;
    }
    
    this.emit('integration:configured', { type, config });
  }

  private async routeToIntegrations(alert: Alert): Promise<void> {
    const promises: Promise<void>[] = [];
    
    if (this.pagerDutyConfig) {
      promises.push(this.sendToPagerDuty(alert));
    }
    
    if (this.opsGenieConfig) {
      promises.push(this.sendToOpsGenie(alert));
    }
    
    if (this.slackConfig) {
      promises.push(this.sendToSlack(alert));
    }
    
    await Promise.allSettled(promises);
  }

  private async sendToPagerDuty(alert: Alert): Promise<void> {
    if (!this.pagerDutyConfig) return;
    
    const payload = {
      routing_key: this.pagerDutyConfig.routingKey,
      event_action: alert.status === 'resolved' ? 'resolve' : 'trigger',
      dedup_key: alert.fingerprint,
      payload: {
        summary: alert.name,
        severity: this.mapSeverityToPagerDuty(alert.severity),
        source: alert.source,
        custom_details: {
          ...alert.labels,
          ...alert.annotations,
        },
      },
    };
    
    try {
      await axios.post(
        this.pagerDutyConfig.baseUrl || 'https://events.pagerduty.com/v2/enqueue',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Failed to send to PagerDuty:', error);
    }
  }

  private mapSeverityToPagerDuty(severity: Alert['severity']): string {
    const mapping = {
      info: 'info',
      warning: 'warning',
      error: 'error',
      critical: 'critical',
    };
    return mapping[severity];
  }

  private async sendToOpsGenie(alert: Alert): Promise<void> {
    if (!this.opsGenieConfig) return;
    
    const baseUrl = this.opsGenieConfig.baseUrl || 
      `https://api.${this.opsGenieConfig.region || 'us'}.opsgenie.com`;
    
    const payload = {
      message: alert.name,
      alias: alert.fingerprint,
      description: alert.annotations.description || alert.annotations.summary,
      priority: this.mapSeverityToOpsGenie(alert.severity),
      source: alert.source,
      details: {
        ...alert.labels,
        ...alert.annotations,
      },
    };
    
    try {
      await axios.post(
        `${baseUrl}/v2/alerts`,
        payload,
        {
          headers: {
            'Authorization': `GenieKey ${this.opsGenieConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error) {
      console.error('Failed to send to OpsGenie:', error);
    }
  }

  private mapSeverityToOpsGenie(severity: Alert['severity']): string {
    const mapping = {
      info: 'P5',
      warning: 'P4',
      error: 'P2',
      critical: 'P1',
    };
    return mapping[severity];
  }

  private async sendToSlack(alert: Alert): Promise<void> {
    if (!this.slackConfig) return;
    
    const color = this.getSeverityColor(alert.severity);
    
    const payload = {
      channel: this.slackConfig.channel,
      username: this.slackConfig.username || 'Alert Manager',
      icon_emoji: this.slackConfig.iconEmoji || ':warning:',
      attachments: [{
        color,
        title: alert.name,
        text: alert.annotations.description || alert.annotations.summary,
        fields: [
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Source', value: alert.source, short: true },
          { title: 'Service', value: alert.service || 'N/A', short: true },
          { title: 'Environment', value: alert.environment || 'N/A', short: true },
        ],
        footer: 'Alert Manager',
        ts: Math.floor(alert.startsAt.getTime() / 1000),
      }],
    };
    
    try {
      await axios.post(this.slackConfig.webhookUrl, payload);
    } catch (error) {
      console.error('Failed to send to Slack:', error);
    }
  }

  private getSeverityColor(severity: Alert['severity']): string {
    const colors = {
      info: '#36a64f',
      warning: '#ff9800',
      error: '#ff5722',
      critical: '#f44336',
    };
    return colors[severity];
  }

  // Notification Methods (placeholders - integrate with NotificationEngine)
  private async notifyUser(userId: string, alert: Alert, methods?: string[]): Promise<void> {
    this.emit('notify:user', { userId, alert, methods });
  }

  private async notifyTeam(teamId: string, alert: Alert): Promise<void> {
    this.emit('notify:team', { teamId, alert });
  }

  private async notifyOnCall(scheduleId: string, alert: Alert): Promise<void> {
    const onCallUser = await this.getCurrentOnCall(scheduleId);
    if (onCallUser) {
      await this.notifyUser(onCallUser, alert, ['sms', 'call']);
    }
  }

  private async notifyWebhook(webhookUrl: string, alert: Alert): Promise<void> {
    try {
      await axios.post(webhookUrl, alert);
    } catch (error) {
      console.error('Failed to notify webhook:', error);
    }
  }

  // Metrics and Monitoring
  private updateMetrics(alert: Alert): void {
    this.metrics.totalAlerts++;
    
    if (alert.status === 'firing') {
      this.metrics.firingAlerts++;
    } else if (alert.status === 'resolved') {
      this.metrics.resolvedAlerts++;
      
      // Calculate MTTR
      if (alert.endsAt && alert.startsAt) {
        const resolutionTime = (alert.endsAt.getTime() - alert.startsAt.getTime()) / 60000; // minutes
        this.metrics.mttr = (this.metrics.mttr + resolutionTime) / 2; // Running average
      }
    }
    
    this.metrics.alertsBySevertity[alert.severity]++;
    
    if (alert.service) {
      this.metrics.alertsByService[alert.service] = 
        (this.metrics.alertsByService[alert.service] || 0) + 1;
    }
    
    // Calculate noise and false positive rate
    this.calculateAlertQualityMetrics();
  }

  private calculateAlertQualityMetrics(): void {
    const totalAlerts = this.metrics.totalAlerts;
    const suppressedAlerts = this.metrics.suppressedAlerts;
    
    if (totalAlerts > 0) {
      this.metrics.alertNoise = (suppressedAlerts / totalAlerts) * 100;
      
      // Simplified false positive calculation
      // In reality, this would require tracking user feedback
      const resolvedQuickly = Array.from(this.alerts.values()).filter(a => {
        if (a.status === 'resolved' && a.endsAt && a.startsAt) {
          const duration = a.endsAt.getTime() - a.startsAt.getTime();
          return duration < 5 * 60 * 1000; // Less than 5 minutes
        }
        return false;
      }).length;
      
      this.metrics.falsePositiveRate = (resolvedQuickly / totalAlerts) * 100;
    }
  }

  getMetrics(): AlertMetrics {
    return { ...this.metrics };
  }

  // Background Jobs
  private startEvaluationLoop(): void {
    // Evaluate alert rules periodically
    setInterval(() => {
      this.evaluateAlertRules();
    }, 30 * 1000); // Every 30 seconds
  }

  private async evaluateAlertRules(): Promise<void> {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      try {
        // Evaluate rule expression
        // This is simplified - implement based on your expression language
        const shouldFire = await this.evaluateRuleExpression(rule);
        
        if (shouldFire && rule.lastState !== 'firing') {
          // Create alert from rule
          const alert = await this.createAlertFromRule(rule);
          await this.receiveAlert(alert);
          rule.lastState = 'firing';
        } else if (!shouldFire && rule.lastState === 'firing') {
          // Resolve alert
          // Find and resolve alerts created by this rule
          rule.lastState = 'normal';
        }
        
        rule.lastEvaluation = new Date();
      } catch (error) {
        console.error(`Failed to evaluate rule ${rule.id}:`, error);
      }
    }
  }

  private async evaluateRuleExpression(rule: AlertRule): Promise<boolean> {
    // Implement rule expression evaluation
    // This is a placeholder
    return false;
  }

  private async createAlertFromRule(rule: AlertRule): Promise<Partial<Alert>> {
    return {
      name: rule.name,
      severity: rule.severity,
      source: 'alert-rule',
      labels: rule.labels,
      annotations: rule.annotations,
      generatorURL: `/rules/${rule.id}`,
    };
  }

  private startMetricsCollection(): void {
    // Collect and emit metrics periodically
    setInterval(() => {
      this.emit('metrics:updated', this.getMetrics());
    }, 60 * 1000); // Every minute
  }

  private startCleanupJob(): void {
    // Clean old alerts
    cron.schedule('0 * * * *', () => {
      this.cleanupOldAlerts();
    });
  }

  private cleanupOldAlerts(): void {
    const cutoffTime = Date.now() - this.config.alertRetention * 1000;
    
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.startsAt.getTime() < cutoffTime) {
        this.alerts.delete(id);
        this.alertFingerprints.delete(alert.fingerprint);
      }
    }
    
    // Clean old incidents
    for (const [id, incident] of this.incidents.entries()) {
      if (incident.status === 'closed' && 
          incident.closedAt && 
          incident.closedAt.getTime() < cutoffTime) {
        this.incidents.delete(id);
      }
    }
  }

  // Public API
  async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) throw new Error('Alert not found');
    
    alert.status = 'acknowledged';
    this.emit('alert:acknowledged', { alert, userId });
  }

  async resolveAlert(alertId: string, userId: string): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) throw new Error('Alert not found');
    
    alert.status = 'resolved';
    alert.endsAt = new Date();
    this.emit('alert:resolved', { alert, userId });
  }

  async acknowledgeIncident(incidentId: string, userId: string): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error('Incident not found');
    
    incident.status = 'investigating';
    incident.acknowledgedAt = new Date();
    incident.assignee = userId;
    this.addIncidentEvent(incident, 'acknowledged', userId);
    
    this.emit('incident:acknowledged', { incident, userId });
  }

  async resolveIncident(incidentId: string, userId: string, resolution?: string): Promise<void> {
    const incident = this.incidents.get(incidentId);
    if (!incident) throw new Error('Incident not found');
    
    incident.status = 'resolved';
    incident.resolvedAt = new Date();
    this.addIncidentEvent(incident, 'resolved', userId, resolution);
    
    // Resolve associated alerts
    for (const alert of incident.alerts) {
      if (alert.status === 'firing') {
        await this.resolveAlert(alert.id, userId);
      }
    }
    
    this.emit('incident:resolved', { incident, userId });
  }

  // Cleanup
  async shutdown(): Promise<void> {
    // Dispose ML models
    if (this.alertPredictionModel) {
      this.alertPredictionModel.dispose();
    }
    if (this.anomalyDetectionModel) {
      this.anomalyDetectionModel.dispose();
    }
    
    this.removeAllListeners();
  }
}

// Export singleton instance
export const alertManager = new AlertManager();