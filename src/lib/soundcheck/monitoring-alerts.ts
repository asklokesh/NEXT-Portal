/**
 * Soundcheck Real-time Monitoring and Alerts
 * Real-time quality monitoring with intelligent alerting system
 */

import {
 QualityAssessment,
 QualityAlert,
 QualityAlertAction,
 QualityCategory,
 SoundcheckEntity,
 CheckResult
} from '@/types/soundcheck';
import { soundcheckEngine } from './soundcheck-engine';
import { automatedCheckService } from './automated-checks';
import { policyEngine } from './policy-engine';

export interface MonitoringConfig {
 enabled: boolean;
 realtime: {
 enabled: boolean;
 websocketUrl?: string;
 };
 thresholds: {
 scoreDropThreshold: number; // Percentage drop to trigger alert
 criticalCheckFailures: number; // Number of critical failures to alert
 consecutiveFailures: number; // Consecutive failures before alert
 };
 alerting: {
 channels: AlertChannel[];
 rules: AlertRule[];
 rateLimit: {
 maxAlertsPerEntity: number;
 windowMinutes: number;
 };
 };
}

export interface AlertChannel {
 id: string;
 name: string;
 type: 'email' | 'slack' | 'webhook' | 'teams' | 'pagerduty';
 config: Record<string, any>;
 enabled: boolean;
}

export interface AlertRule {
 id: string;
 name: string;
 description: string;
 conditions: AlertCondition[];
 actions: AlertAction[];
 enabled: boolean;
 priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface AlertCondition {
 type: 'score_drop' | 'check_failure' | 'policy_violation' | 'certification_expiry' | 'threshold_breach';
 params: Record<string, any>;
}

export interface AlertAction {
 channelId: string;
 template?: string;
 delay?: number; // Delay in minutes before sending
}

export interface MonitoringMetrics {
 entityId: string;
 timestamp: string;
 metrics: {
 overallScore: number;
 categoryScores: Record<QualityCategory, number>;
 failedChecks: number;
 criticalIssues: number;
 policyViolations: number;
 trendsDetected: Array<{
 metric: string;
 trend: 'improving' | 'declining' | 'stable';
 changeRate: number;
 }>;
 };
}

export interface AlertStatistics {
 totalAlerts: number;
 openAlerts: number;
 resolvedAlerts: number;
 averageResolutionTime: number; // minutes
 alertsByCategory: Record<QualityCategory, number>;
 alertsBySeverity: Record<string, number>;
 topOffenders: Array<{
 entityId: string;
 alertCount: number;
 }>;
}

export class MonitoringAlertsService {
 private config: MonitoringConfig;
 private alerts: Map<string, QualityAlert> = new Map();
 private metrics: Map<string, MonitoringMetrics[]> = new Map();
 private alertRateLimits: Map<string, { count: number; windowStart: Date }> = new Map();
 private websocket?: WebSocket;
 private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

 constructor(config: MonitoringConfig) {
 this.config = config;
 this.initializeDefaultRules();
 if (config.realtime.enabled && config.realtime.websocketUrl) {
 this.connectWebSocket(config.realtime.websocketUrl);
 }
 }

 /**
 * Initialize default alert rules
 */
 private initializeDefaultRules(): void {
 const defaultRules: AlertRule[] = [
 {
 id: 'critical-failure-rule',
 name: 'Critical Check Failures',
 description: 'Alert when critical security or reliability checks fail',
 conditions: [{
 type: 'check_failure',
 params: {
 severity: 'critical',
 checkCategories: ['security', 'reliability']
 }
 }],
 actions: [{
 channelId: 'default',
 template: 'critical-failure'
 }],
 enabled: true,
 priority: 'critical'
 },
 {
 id: 'score-drop-rule',
 name: 'Significant Score Drop',
 description: 'Alert when quality score drops significantly',
 conditions: [{
 type: 'score_drop',
 params: {
 threshold: 20, // 20% drop
 timeWindow: 24 // hours
 }
 }],
 actions: [{
 channelId: 'default',
 template: 'score-drop',
 delay: 5
 }],
 enabled: true,
 priority: 'high'
 },
 {
 id: 'policy-violation-rule',
 name: 'Policy Violations',
 description: 'Alert on blocking policy violations',
 conditions: [{
 type: 'policy_violation',
 params: {
 enforcement: 'blocking'
 }
 }],
 actions: [{
 channelId: 'default',
 template: 'policy-violation'
 }],
 enabled: true,
 priority: 'high'
 },
 {
 id: 'certification-expiry-rule',
 name: 'Certification Expiring',
 description: 'Alert when certifications are about to expire',
 conditions: [{
 type: 'certification_expiry',
 params: {
 daysBeforeExpiry: 30
 }
 }],
 actions: [{
 channelId: 'default',
 template: 'certification-expiry',
 delay: 0
 }],
 enabled: true,
 priority: 'medium'
 }
 ];

 // Store rules in config if not already present
 if (!this.config.alerting.rules || this.config.alerting.rules.length === 0) {
 this.config.alerting.rules = defaultRules;
 }
 }

 /**
 * Start monitoring an entity
 */
 startMonitoring(entity: SoundcheckEntity, intervalMinutes: number = 5): void {
 const monitoringId = `monitor-${entity.id}`;
 
 // Clear existing monitoring if any
 this.stopMonitoring(entity.id);

 // Run initial check
 this.checkEntity(entity);

 // Schedule periodic checks
 const interval = setInterval(() => {
 this.checkEntity(entity);
 }, intervalMinutes * 60 * 1000);

 this.monitoringIntervals.set(monitoringId, interval);
 }

 /**
 * Stop monitoring an entity
 */
 stopMonitoring(entityId: string): void {
 const monitoringId = `monitor-${entityId}`;
 const interval = this.monitoringIntervals.get(monitoringId);
 
 if (interval) {
 clearInterval(interval);
 this.monitoringIntervals.delete(monitoringId);
 }
 }

 /**
 * Check entity and evaluate alert conditions
 */
 private async checkEntity(entity: SoundcheckEntity): Promise<void> {
 try {
 // Run quality assessment
 const assessment = await soundcheckEngine.runAssessment(entity);
 
 // Run automated checks
 const automatedResults = await automatedCheckService.runChecks(entity);
 
 // Evaluate policies
 const policyResults = await policyEngine.evaluatePolicies(entity);

 // Store metrics
 const metrics: MonitoringMetrics = {
 entityId: entity.id,
 timestamp: new Date().toISOString(),
 metrics: {
 overallScore: assessment.overallScore,
 categoryScores: assessment.categoryScores,
 failedChecks: assessment.checkResults.filter(r => r.status === 'fail').length,
 criticalIssues: assessment.checkResults.filter(r => {
 const check = soundcheckEngine.getCheck(r.checkId);
 return r.status === 'fail' && check?.severity === 'critical';
 }).length,
 policyViolations: policyResults.filter(r => !r.passed).length,
 trendsDetected: this.detectTrends(entity.id, assessment)
 }
 };

 this.storeMetrics(metrics);

 // Evaluate alert rules
 await this.evaluateAlertRules(entity, assessment, metrics);

 // Send real-time update if websocket is connected
 if (this.websocket?.readyState === WebSocket.OPEN) {
 this.websocket.send(JSON.stringify({
 type: 'metrics_update',
 data: metrics
 }));
 }
 } catch (error) {
 console.error(`Failed to check entity ${entity.id}:`, error);
 }
 }

 /**
 * Evaluate alert rules for an entity
 */
 private async evaluateAlertRules(
 entity: SoundcheckEntity,
 assessment: QualityAssessment,
 metrics: MonitoringMetrics
 ): Promise<void> {
 for (const rule of this.config.alerting.rules) {
 if (!rule.enabled) continue;

 const conditionsMet = this.evaluateConditions(rule.conditions, entity, assessment, metrics);
 
 if (conditionsMet) {
 // Check rate limiting
 if (!this.isRateLimited(entity.id)) {
 await this.createAlert(entity, rule, assessment, metrics);
 }
 }
 }
 }

 /**
 * Evaluate alert conditions
 */
 private evaluateConditions(
 conditions: AlertCondition[],
 entity: SoundcheckEntity,
 assessment: QualityAssessment,
 metrics: MonitoringMetrics
 ): boolean {
 return conditions.every(condition => {
 switch (condition.type) {
 case 'score_drop':
 return this.evaluateScoreDrop(entity.id, metrics.metrics.overallScore, condition.params);
 
 case 'check_failure':
 return this.evaluateCheckFailures(assessment.checkResults, condition.params);
 
 case 'policy_violation':
 return this.evaluatePolicyViolations(entity.id, condition.params);
 
 case 'certification_expiry':
 return this.evaluateCertificationExpiry(entity.id, condition.params);
 
 case 'threshold_breach':
 return this.evaluateThresholdBreach(metrics, condition.params);
 
 default:
 return false;
 }
 });
 }

 /**
 * Evaluate score drop condition
 */
 private evaluateScoreDrop(
 entityId: string,
 currentScore: number,
 params: { threshold: number; timeWindow: number }
 ): boolean {
 const history = this.metrics.get(entityId) || [];
 if (history.length < 2) return false;

 const cutoffTime = new Date();
 cutoffTime.setHours(cutoffTime.getHours() - params.timeWindow);

 const relevantHistory = history.filter(m => new Date(m.timestamp) >= cutoffTime);
 if (relevantHistory.length === 0) return false;

 const maxScore = Math.max(...relevantHistory.map(m => m.metrics.overallScore));
 const scoreDrop = maxScore - currentScore;

 return scoreDrop >= params.threshold;
 }

 /**
 * Evaluate check failures condition
 */
 private evaluateCheckFailures(
 checkResults: CheckResult[],
 params: { severity?: string; checkCategories?: string[] }
 ): boolean {
 const failedChecks = checkResults.filter(r => r.status === 'fail');
 
 if (params.severity) {
 const criticalFailures = failedChecks.filter(r => {
 const check = soundcheckEngine.getCheck(r.checkId);
 return check?.severity === params.severity;
 });
 return criticalFailures.length > 0;
 }

 if (params.checkCategories) {
 const categoryFailures = failedChecks.filter(r => {
 const check = soundcheckEngine.getCheck(r.checkId);
 return check && params.checkCategories!.includes(check.category);
 });
 return categoryFailures.length > 0;
 }

 return failedChecks.length > 0;
 }

 /**
 * Evaluate policy violations condition
 */
 private evaluatePolicyViolations(
 entityId: string,
 params: { enforcement?: string }
 ): boolean {
 // This would check recent policy evaluation results
 // For now, return based on current metrics
 return false;
 }

 /**
 * Evaluate certification expiry condition
 */
 private evaluateCertificationExpiry(
 entityId: string,
 params: { daysBeforeExpiry: number }
 ): boolean {
 // This would check certification expiry dates
 // For now, return false
 return false;
 }

 /**
 * Evaluate threshold breach condition
 */
 private evaluateThresholdBreach(
 metrics: MonitoringMetrics,
 params: { metric: string; operator: string; value: number }
 ): boolean {
 const metricValue = this.getMetricValue(metrics, params.metric);
 
 switch (params.operator) {
 case 'gt': return metricValue > params.value;
 case 'gte': return metricValue >= params.value;
 case 'lt': return metricValue < params.value;
 case 'lte': return metricValue <= params.value;
 case 'eq': return metricValue === params.value;
 default: return false;
 }
 }

 /**
 * Create an alert
 */
 private async createAlert(
 entity: SoundcheckEntity,
 rule: AlertRule,
 assessment: QualityAssessment,
 metrics: MonitoringMetrics
 ): Promise<void> {
 const alert: QualityAlert = {
 id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
 entityId: entity.id,
 severity: rule.priority,
 title: rule.name,
 description: this.generateAlertDescription(entity, rule, assessment, metrics),
 category: this.determineAlertCategory(rule, assessment),
 triggerCondition: rule.description,
 status: 'open',
 createdAt: new Date().toISOString(),
 actions: []
 };

 // Store alert
 this.alerts.set(alert.id, alert);

 // Update rate limits
 this.updateRateLimit(entity.id);

 // Execute alert actions
 for (const action of rule.actions) {
 if (action.delay) {
 setTimeout(() => {
 this.executeAlertAction(alert, action);
 }, action.delay * 60 * 1000);
 } else {
 await this.executeAlertAction(alert, action);
 }
 }

 // Send real-time notification
 if (this.websocket?.readyState === WebSocket.OPEN) {
 this.websocket.send(JSON.stringify({
 type: 'alert_created',
 data: alert
 }));
 }
 }

 /**
 * Execute alert action
 */
 private async executeAlertAction(
 alert: QualityAlert,
 action: AlertAction
 ): Promise<void> {
 const channel = this.config.alerting.channels.find(c => c.id === action.channelId);
 if (!channel || !channel.enabled) return;

 try {
 switch (channel.type) {
 case 'webhook':
 await this.sendWebhookAlert(channel, alert, action.template);
 break;
 case 'slack':
 await this.sendSlackAlert(channel, alert, action.template);
 break;
 case 'email':
 await this.sendEmailAlert(channel, alert, action.template);
 break;
 case 'teams':
 await this.sendTeamsAlert(channel, alert, action.template);
 break;
 case 'pagerduty':
 await this.sendPagerDutyAlert(channel, alert, action.template);
 break;
 }
 } catch (error) {
 console.error(`Failed to send alert via ${channel.type}:`, error);
 }
 }

 /**
 * Generate alert description
 */
 private generateAlertDescription(
 entity: SoundcheckEntity,
 rule: AlertRule,
 assessment: QualityAssessment,
 metrics: MonitoringMetrics
 ): string {
 const parts = [
 `Service: ${entity.name}`,
 `Current Score: ${metrics.metrics.overallScore}%`,
 `Failed Checks: ${metrics.metrics.failedChecks}`,
 `Critical Issues: ${metrics.metrics.criticalIssues}`
 ];

 if (metrics.metrics.policyViolations > 0) {
 parts.push(`Policy Violations: ${metrics.metrics.policyViolations}`);
 }

 const decliningTrends = metrics.metrics.trendsDetected.filter(t => t.trend === 'declining');
 if (decliningTrends.length > 0) {
 parts.push(`Declining Trends: ${decliningTrends.map(t => t.metric).join(', ')}`);
 }

 return parts.join(' | ');
 }

 /**
 * Determine alert category based on rule and assessment
 */
 private determineAlertCategory(
 rule: AlertRule,
 assessment: QualityAssessment
 ): QualityCategory {
 // Analyze failed checks to determine primary category
 const failedChecks = assessment.checkResults.filter(r => r.status === 'fail');
 const categoryCount: Record<string, number> = {};

 for (const result of failedChecks) {
 const check = soundcheckEngine.getCheck(result.checkId);
 if (check) {
 categoryCount[check.category] = (categoryCount[check.category] || 0) + 1;
 }
 }

 // Return category with most failures
 const topCategory = Object.entries(categoryCount)
 .sort(([, a], [, b]) => b - a)[0]?.[0];

 return (topCategory as QualityCategory) || 'reliability';
 }

 /**
 * Detect trends in metrics
 */
 private detectTrends(
 entityId: string,
 assessment: QualityAssessment
 ): Array<{ metric: string; trend: 'improving' | 'declining' | 'stable'; changeRate: number }> {
 const trends: Array<{ metric: string; trend: 'improving' | 'declining' | 'stable'; changeRate: number }> = [];
 const history = this.metrics.get(entityId) || [];

 if (history.length < 5) return trends;

 // Analyze overall score trend
 const recentScores = history.slice(-10).map(m => m.metrics.overallScore);
 const scoreTrend = this.calculateTrend(recentScores);
 trends.push({
 metric: 'Overall Score',
 trend: scoreTrend.trend,
 changeRate: scoreTrend.changeRate
 });

 // Analyze category trends
 for (const category of Object.keys(assessment.categoryScores) as QualityCategory[]) {
 const categoryScores = history.slice(-10).map(m => m.metrics.categoryScores[category] || 0);
 const categoryTrend = this.calculateTrend(categoryScores);
 
 if (categoryTrend.trend !== 'stable') {
 trends.push({
 metric: `${category} Score`,
 trend: categoryTrend.trend,
 changeRate: categoryTrend.changeRate
 });
 }
 }

 return trends;
 }

 /**
 * Calculate trend from time series data
 */
 private calculateTrend(
 values: number[]
 ): { trend: 'improving' | 'declining' | 'stable'; changeRate: number } {
 if (values.length < 2) {
 return { trend: 'stable', changeRate: 0 };
 }

 // Simple linear regression
 const n = values.length;
 const indices = Array.from({ length: n }, (_, i) => i);
 
 const sumX = indices.reduce((a, b) => a + b, 0);
 const sumY = values.reduce((a, b) => a + b, 0);
 const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
 const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);

 const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
 const changeRate = Math.abs(slope);

 if (Math.abs(slope) < 0.5) {
 return { trend: 'stable', changeRate };
 } else if (slope > 0) {
 return { trend: 'improving', changeRate };
 } else {
 return { trend: 'declining', changeRate };
 }
 }

 /**
 * Check rate limiting
 */
 private isRateLimited(entityId: string): boolean {
 const limit = this.alertRateLimits.get(entityId);
 if (!limit) return false;

 const windowEnd = new Date(limit.windowStart);
 windowEnd.setMinutes(windowEnd.getMinutes() + this.config.alerting.rateLimit.windowMinutes);

 if (new Date() > windowEnd) {
 // Window expired, reset
 this.alertRateLimits.delete(entityId);
 return false;
 }

 return limit.count >= this.config.alerting.rateLimit.maxAlertsPerEntity;
 }

 /**
 * Update rate limit counter
 */
 private updateRateLimit(entityId: string): void {
 const limit = this.alertRateLimits.get(entityId);
 
 if (!limit) {
 this.alertRateLimits.set(entityId, {
 count: 1,
 windowStart: new Date()
 });
 } else {
 limit.count++;
 }
 }

 /**
 * Store metrics
 */
 private storeMetrics(metrics: MonitoringMetrics): void {
 if (!this.metrics.has(metrics.entityId)) {
 this.metrics.set(metrics.entityId, []);
 }

 const history = this.metrics.get(metrics.entityId)!;
 history.push(metrics);

 // Keep only last 1000 metrics per entity
 if (history.length > 1000) {
 this.metrics.set(metrics.entityId, history.slice(-1000));
 }
 }

 /**
 * Get metric value from metrics object
 */
 private getMetricValue(metrics: MonitoringMetrics, path: string): number {
 const parts = path.split('.');
 let current: any = metrics.metrics;

 for (const part of parts) {
 if (current === null || current === undefined) {
 return 0;
 }
 current = current[part];
 }

 return Number(current) || 0;
 }

 /**
 * Connect to WebSocket for real-time updates
 */
 private connectWebSocket(url: string): void {
 try {
 this.websocket = new WebSocket(url);

 this.websocket.onopen = () => {
 console.log('Connected to Soundcheck monitoring WebSocket');
 };

 this.websocket.onmessage = (event) => {
 try {
 const message = JSON.parse(event.data);
 this.handleWebSocketMessage(message);
 } catch (error) {
 console.error('Failed to parse WebSocket message:', error);
 }
 };

 this.websocket.onerror = (error) => {
 console.error('WebSocket error:', error);
 };

 this.websocket.onclose = () => {
 console.log('WebSocket connection closed, reconnecting in 5s...');
 setTimeout(() => this.connectWebSocket(url), 5000);
 };
 } catch (error) {
 console.error('Failed to connect to WebSocket:', error);
 }
 }

 /**
 * Handle WebSocket messages
 */
 private handleWebSocketMessage(message: any): void {
 switch (message.type) {
 case 'assessment_update':
 // Handle real-time assessment updates
 break;
 case 'alert_acknowledged':
 this.acknowledgeAlert(message.alertId, message.userId);
 break;
 case 'alert_resolved':
 this.resolveAlert(message.alertId, message.userId, message.comment);
 break;
 }
 }

 /**
 * Send webhook alert
 */
 private async sendWebhookAlert(
 channel: AlertChannel,
 alert: QualityAlert,
 template?: string
 ): Promise<void> {
 const payload = {
 alert,
 template,
 timestamp: new Date().toISOString()
 };

 await fetch(channel.config.url, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 ...channel.config.headers
 },
 body: JSON.stringify(payload)
 });
 }

 /**
 * Send Slack alert
 */
 private async sendSlackAlert(
 channel: AlertChannel,
 alert: QualityAlert,
 template?: string
 ): Promise<void> {
 const color = {
 critical: 'danger',
 high: 'warning',
 medium: 'warning',
 low: 'good'
 }[alert.severity];

 const message = {
 channel: channel.config.channel,
 username: 'Soundcheck Alerts',
 icon_emoji: ':warning:',
 attachments: [{
 color,
 title: alert.title,
 text: alert.description,
 fields: [
 {
 title: 'Entity',
 value: alert.entityId,
 short: true
 },
 {
 title: 'Category',
 value: alert.category,
 short: true
 },
 {
 title: 'Severity',
 value: alert.severity.toUpperCase(),
 short: true
 },
 {
 title: 'Status',
 value: alert.status,
 short: true
 }
 ],
 ts: Math.floor(new Date(alert.createdAt).getTime() / 1000)
 }]
 };

 await fetch(channel.config.webhookUrl, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(message)
 });
 }

 /**
 * Send email alert (placeholder)
 */
 private async sendEmailAlert(
 channel: AlertChannel,
 alert: QualityAlert,
 template?: string
 ): Promise<void> {
 console.log('Email alert:', { channel, alert, template });
 }

 /**
 * Send Teams alert (placeholder)
 */
 private async sendTeamsAlert(
 channel: AlertChannel,
 alert: QualityAlert,
 template?: string
 ): Promise<void> {
 const card = {
 '@type': 'MessageCard',
 '@context': 'https://schema.org/extensions',
 summary: alert.title,
 themeColor: {
 critical: 'dc3545',
 high: 'ffc107',
 medium: 'ffc107',
 low: '28a745'
 }[alert.severity],
 sections: [{
 activityTitle: alert.title,
 activitySubtitle: `Entity: ${alert.entityId}`,
 facts: [
 { name: 'Category', value: alert.category },
 { name: 'Severity', value: alert.severity.toUpperCase() },
 { name: 'Status', value: alert.status }
 ],
 text: alert.description
 }]
 };

 await fetch(channel.config.webhookUrl, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(card)
 });
 }

 /**
 * Send PagerDuty alert (placeholder)
 */
 private async sendPagerDutyAlert(
 channel: AlertChannel,
 alert: QualityAlert,
 template?: string
 ): Promise<void> {
 console.log('PagerDuty alert:', { channel, alert, template });
 }

 /**
 * Get all alerts
 */
 getAllAlerts(filters?: {
 status?: string;
 severity?: string;
 entityId?: string;
 category?: string;
 }): QualityAlert[] {
 let alerts = Array.from(this.alerts.values());

 if (filters) {
 if (filters.status) {
 alerts = alerts.filter(a => a.status === filters.status);
 }
 if (filters.severity) {
 alerts = alerts.filter(a => a.severity === filters.severity);
 }
 if (filters.entityId) {
 alerts = alerts.filter(a => a.entityId === filters.entityId);
 }
 if (filters.category) {
 alerts = alerts.filter(a => a.category === filters.category);
 }
 }

 return alerts.sort((a, b) => 
 new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
 );
 }

 /**
 * Get alert by ID
 */
 getAlert(alertId: string): QualityAlert | undefined {
 return this.alerts.get(alertId);
 }

 /**
 * Acknowledge alert
 */
 acknowledgeAlert(alertId: string, userId: string): boolean {
 const alert = this.alerts.get(alertId);
 if (!alert || alert.status !== 'open') return false;

 alert.status = 'acknowledged';
 alert.acknowledgedAt = new Date().toISOString();
 alert.actions.push({
 type: 'acknowledge',
 timestamp: new Date().toISOString(),
 userId
 });

 return true;
 }

 /**
 * Resolve alert
 */
 resolveAlert(alertId: string, userId: string, comment?: string): boolean {
 const alert = this.alerts.get(alertId);
 if (!alert || alert.status === 'resolved') return false;

 alert.status = 'resolved';
 alert.resolvedAt = new Date().toISOString();
 alert.actions.push({
 type: 'resolve',
 timestamp: new Date().toISOString(),
 userId,
 comment
 });

 return true;
 }

 /**
 * Get alert statistics
 */
 getAlertStatistics(timeRange?: { start: Date; end: Date }): AlertStatistics {
 let alerts = Array.from(this.alerts.values());

 if (timeRange) {
 alerts = alerts.filter(a => {
 const createdAt = new Date(a.createdAt);
 return createdAt >= timeRange.start && createdAt <= timeRange.end;
 });
 }

 const openAlerts = alerts.filter(a => a.status === 'open' || a.status === 'acknowledged');
 const resolvedAlerts = alerts.filter(a => a.status === 'resolved');

 // Calculate average resolution time
 let totalResolutionTime = 0;
 let resolvedCount = 0;

 for (const alert of resolvedAlerts) {
 if (alert.resolvedAt) {
 const resolutionTime = new Date(alert.resolvedAt).getTime() - new Date(alert.createdAt).getTime();
 totalResolutionTime += resolutionTime;
 resolvedCount++;
 }
 }

 const averageResolutionTime = resolvedCount > 0 
 ? Math.round(totalResolutionTime / resolvedCount / 60000) // Convert to minutes
 : 0;

 // Count by category and severity
 const alertsByCategory: Record<string, number> = {};
 const alertsBySeverity: Record<string, number> = {};

 for (const alert of alerts) {
 alertsByCategory[alert.category] = (alertsByCategory[alert.category] || 0) + 1;
 alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
 }

 // Find top offenders
 const entityAlertCounts: Record<string, number> = {};
 for (const alert of alerts) {
 entityAlertCounts[alert.entityId] = (entityAlertCounts[alert.entityId] || 0) + 1;
 }

 const topOffenders = Object.entries(entityAlertCounts)
 .map(([entityId, alertCount]) => ({ entityId, alertCount }))
 .sort((a, b) => b.alertCount - a.alertCount)
 .slice(0, 10);

 return {
 totalAlerts: alerts.length,
 openAlerts: openAlerts.length,
 resolvedAlerts: resolvedAlerts.length,
 averageResolutionTime,
 alertsByCategory: alertsByCategory as any,
 alertsBySeverity,
 topOffenders
 };
 }

 /**
 * Get metrics for an entity
 */
 getEntityMetrics(entityId: string, limit?: number): MonitoringMetrics[] {
 const metrics = this.metrics.get(entityId) || [];
 if (limit) {
 return metrics.slice(-limit);
 }
 return metrics;
 }
}

// Export singleton instance
export const monitoringAlertsService = new MonitoringAlertsService({
 enabled: true,
 realtime: {
 enabled: true,
 websocketUrl: process.env.NEXT_PUBLIC_SOUNDCHECK_WS_URL
 },
 thresholds: {
 scoreDropThreshold: 20,
 criticalCheckFailures: 1,
 consecutiveFailures: 3
 },
 alerting: {
 channels: [{
 id: 'default',
 name: 'Default Channel',
 type: 'webhook',
 config: {
 url: process.env.SOUNDCHECK_WEBHOOK_URL || 'http://localhost:3000/api/soundcheck/webhook'
 },
 enabled: true
 }],
 rules: [],
 rateLimit: {
 maxAlertsPerEntity: 5,
 windowMinutes: 60
 }
 }
});