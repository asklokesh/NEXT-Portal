/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { prisma } from '../db/client';
import { costAggregator } from './aggregator';
import { redis } from '../db/client';

export interface CostAlert {
 id: string;
 serviceId: string;
 serviceName: string;
 alertType: 'threshold' | 'spike' | 'budget' | 'anomaly';
 severity: 'low' | 'medium' | 'high' | 'critical';
 title: string;
 message: string;
 currentValue: number;
 thresholdValue: number;
 currency: string;
 provider: string;
 createdAt: Date;
 resolved: boolean;
 resolvedAt?: Date;
}

export interface BudgetConfig {
 id: string;
 name: string;
 serviceId?: string;
 teamId?: string;
 amount: number;
 currency: string;
 period: 'monthly' | 'quarterly' | 'yearly';
 thresholds: {
 warning: number; // percentage
 critical: number; // percentage
 };
 enabled: boolean;
}

export interface CostThreshold {
 id: string;
 serviceId: string;
 metricType: 'daily' | 'monthly' | 'hourly';
 thresholdValue: number;
 comparisonOperator: 'greater_than' | 'less_than' | 'percent_increase';
 baselinePeriod: number; // days for comparison
 enabled: boolean;
}

export class CostMonitor {
 private monitoringInterval: NodeJS.Timeout | null = null;
 private readonly ALERT_CACHE_TTL = 3600; // 1 hour

 constructor() {
 this.startMonitoring();
 }

 /**
 * Start real-time cost monitoring
 */
 startMonitoring(): void {
 if (this.monitoringInterval) {
 clearInterval(this.monitoringInterval);
 }

 // Check every 15 minutes
 this.monitoringInterval = setInterval(async () => {
 try {
 await this.runMonitoringChecks();
 } catch (error) {
 console.error('Cost monitoring check failed:', error);
 }
 }, 15 * 60 * 1000);

 console.log('Cost monitoring started');
 }

 /**
 * Stop monitoring
 */
 stopMonitoring(): void {
 if (this.monitoringInterval) {
 clearInterval(this.monitoringInterval);
 this.monitoringInterval = null;
 }
 console.log('Cost monitoring stopped');
 }

 /**
 * Run all monitoring checks
 */
 private async runMonitoringChecks(): Promise<void> {
 console.log('Running cost monitoring checks...');

 const [thresholdAlerts, budgetAlerts, anomalyAlerts] = await Promise.allSettled([
 this.checkThresholdAlerts(),
 this.checkBudgetAlerts(),
 this.checkAnomalyAlerts(),
 ]);

 let totalAlerts = 0;
 
 if (thresholdAlerts.status === 'fulfilled') {
 totalAlerts += thresholdAlerts.value.length;
 }
 
 if (budgetAlerts.status === 'fulfilled') {
 totalAlerts += budgetAlerts.value.length;
 }
 
 if (anomalyAlerts.status === 'fulfilled') {
 totalAlerts += anomalyAlerts.value.length;
 }

 console.log(`Cost monitoring completed: ${totalAlerts} alerts generated`);
 }

 /**
 * Check threshold-based alerts
 */
 private async checkThresholdAlerts(): Promise<CostAlert[]> {
 try {
 const thresholds = await prisma.costThreshold.findMany({
 where: { enabled: true },
 include: { service: true },
 });

 const alerts: CostAlert[] = [];
 const today = new Date();

 for (const threshold of thresholds) {
 const startDate = new Date();
 const endDate = new Date();

 // Set date range based on metric type
 switch (threshold.metricType) {
 case 'daily':
 startDate.setDate(today.getDate() - 1);
 break;
 case 'monthly':
 startDate.setMonth(today.getMonth() - 1);
 break;
 case 'hourly':
 startDate.setHours(today.getHours() - 1);
 break;
 }

 // Get current costs
 const currentCosts = await prisma.serviceCost.aggregate({
 where: {
 serviceId: threshold.serviceId,
 date: {
 gte: startDate,
 lte: endDate,
 },
 },
 _sum: {
 cost: true,
 },
 });

 const currentValue = currentCosts._sum.cost || 0;

 // Check threshold
 let alertTriggered = false;
 let baselineValue = threshold.thresholdValue;

 if (threshold.comparisonOperator === 'greater_than') {
 alertTriggered = currentValue > threshold.thresholdValue;
 } else if (threshold.comparisonOperator === 'less_than') {
 alertTriggered = currentValue < threshold.thresholdValue;
 } else if (threshold.comparisonOperator === 'percent_increase') {
 // Get baseline costs
 const baselineStart = new Date(startDate);
 const baselineEnd = new Date(endDate);
 baselineStart.setDate(baselineStart.getDate() - threshold.baselinePeriod);
 baselineEnd.setDate(baselineEnd.getDate() - threshold.baselinePeriod);

 const baselineCosts = await prisma.serviceCost.aggregate({
 where: {
 serviceId: threshold.serviceId,
 date: {
 gte: baselineStart,
 lte: baselineEnd,
 },
 },
 _sum: {
 cost: true,
 },
 });

 baselineValue = baselineCosts._sum.cost || 0;
 const percentIncrease = baselineValue > 0 ? ((currentValue - baselineValue) / baselineValue) * 100 : 0;
 alertTriggered = percentIncrease > threshold.thresholdValue;
 }

 if (alertTriggered) {
 // Check if alert already exists and is not resolved
 const existingAlert = await this.getExistingAlert(
 threshold.serviceId,
 'threshold',
 threshold.id
 );

 if (!existingAlert) {
 const alert = await this.createAlert({
 serviceId: threshold.serviceId,
 serviceName: threshold.service?.displayName || threshold.serviceId,
 alertType: 'threshold',
 severity: this.calculateSeverity(currentValue, baselineValue),
 title: `${threshold.metricType} cost threshold exceeded`,
 message: `Service ${threshold.service?.displayName || threshold.serviceId} ${threshold.metricType} cost of $${currentValue.toFixed(2)} exceeds threshold of $${threshold.thresholdValue.toFixed(2)}`,
 currentValue,
 thresholdValue: threshold.thresholdValue,
 currency: 'USD',
 provider: 'multi',
 });

 alerts.push(alert);
 }
 }
 }

 return alerts;
 } catch (error) {
 console.error('Failed to check threshold alerts:', error);
 return [];
 }
 }

 /**
 * Check budget-based alerts
 */
 private async checkBudgetAlerts(): Promise<CostAlert[]> {
 try {
 const budgets = await prisma.budget.findMany({
 where: { enabled: true },
 include: { service: true, team: true },
 });

 const alerts: CostAlert[] = [];
 const today = new Date();

 for (const budget of budgets) {
 const startDate = new Date();
 const endDate = new Date();

 // Set date range based on budget period
 switch (budget.period) {
 case 'monthly':
 startDate.setMonth(today.getMonth(), 1);
 startDate.setHours(0, 0, 0, 0);
 endDate.setMonth(today.getMonth() + 1, 0);
 endDate.setHours(23, 59, 59, 999);
 break;
 case 'quarterly':
 const quarter = Math.floor(today.getMonth() / 3);
 startDate.setMonth(quarter * 3, 1);
 startDate.setHours(0, 0, 0, 0);
 endDate.setMonth((quarter + 1) * 3, 0);
 endDate.setHours(23, 59, 59, 999);
 break;
 case 'yearly':
 startDate.setFullYear(today.getFullYear(), 0, 1);
 startDate.setHours(0, 0, 0, 0);
 endDate.setFullYear(today.getFullYear(), 11, 31);
 endDate.setHours(23, 59, 59, 999);
 break;
 }

 // Get current spending
 const whereClause: any = {
 date: {
 gte: startDate,
 lte: endDate,
 },
 };

 if (budget.serviceId) {
 whereClause.serviceId = budget.serviceId;
 } else if (budget.teamId) {
 // Get all services for the team
 const teamServices = await prisma.service.findMany({
 where: { teamId: budget.teamId },
 select: { id: true },
 });
 whereClause.serviceId = {
 in: teamServices.map(s => s.id),
 };
 }

 const currentSpending = await prisma.serviceCost.aggregate({
 where: whereClause,
 _sum: {
 cost: true,
 },
 });

 const currentValue = currentSpending._sum.cost || 0;
 const percentage = (currentValue / budget.amount) * 100;

 // Check thresholds
 if (percentage >= budget.thresholds.critical) {
 const alert = await this.createAlert({
 serviceId: budget.serviceId || 'team-budget',
 serviceName: budget.name,
 alertType: 'budget',
 severity: 'critical',
 title: 'Budget critically exceeded',
 message: `Budget "${budget.name}" is at ${percentage.toFixed(1)}% (${currentValue.toFixed(2)}/${budget.amount.toFixed(2)})`,
 currentValue,
 thresholdValue: budget.amount,
 currency: budget.currency,
 provider: 'multi',
 });
 alerts.push(alert);
 } else if (percentage >= budget.thresholds.warning) {
 const alert = await this.createAlert({
 serviceId: budget.serviceId || 'team-budget',
 serviceName: budget.name,
 alertType: 'budget',
 severity: 'medium',
 title: 'Budget warning threshold reached',
 message: `Budget "${budget.name}" is at ${percentage.toFixed(1)}% (${currentValue.toFixed(2)}/${budget.amount.toFixed(2)})`,
 currentValue,
 thresholdValue: budget.amount,
 currency: budget.currency,
 provider: 'multi',
 });
 alerts.push(alert);
 }
 }

 return alerts;
 } catch (error) {
 console.error('Failed to check budget alerts:', error);
 return [];
 }
 }

 /**
 * Check for cost anomalies using simple statistical analysis
 */
 private async checkAnomalyAlerts(): Promise<CostAlert[]> {
 try {
 const alerts: CostAlert[] = [];
 const services = await prisma.service.findMany({
 select: { id: true, displayName: true },
 });

 const today = new Date();
 const startDate = new Date();
 startDate.setDate(today.getDate() - 30); // Last 30 days

 for (const service of services) {
 // Get historical costs
 const costs = await prisma.serviceCost.findMany({
 where: {
 serviceId: service.id,
 date: {
 gte: startDate,
 lte: today,
 },
 },
 orderBy: {
 date: 'asc',
 },
 });

 if (costs.length < 7) continue; // Need at least a week of data

 // Calculate statistics
 const values = costs.map(c => c.cost);
 const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
 const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
 const stdDev = Math.sqrt(variance);

 // Check last day for anomalies (simple 2-sigma rule)
 const lastCost = values[values.length - 1];
 const threshold = mean + (2 * stdDev);

 if (lastCost > threshold && lastCost > mean * 1.5) { // At least 50% above mean
 const alert = await this.createAlert({
 serviceId: service.id,
 serviceName: service.displayName,
 alertType: 'anomaly',
 severity: 'high',
 title: 'Cost anomaly detected',
 message: `Service ${service.displayName} cost of $${lastCost.toFixed(2)} is unusually high (${((lastCost / mean - 1) * 100).toFixed(1)}% above average)`,
 currentValue: lastCost,
 thresholdValue: threshold,
 currency: 'USD',
 provider: 'multi',
 });
 alerts.push(alert);
 }
 }

 return alerts;
 } catch (error) {
 console.error('Failed to check anomaly alerts:', error);
 return [];
 }
 }

 /**
 * Create a new alert
 */
 private async createAlert(alertData: Omit<CostAlert, 'id' | 'createdAt' | 'resolved' | 'resolvedAt'>): Promise<CostAlert> {
 const alert: CostAlert = {
 id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
 ...alertData,
 createdAt: new Date(),
 resolved: false,
 };

 // Store in database
 await prisma.costAlert.create({
 data: {
 id: alert.id,
 serviceId: alert.serviceId,
 alertType: alert.alertType,
 severity: alert.severity,
 title: alert.title,
 message: alert.message,
 currentValue: alert.currentValue,
 thresholdValue: alert.thresholdValue,
 currency: alert.currency,
 provider: alert.provider,
 resolved: false,
 },
 });

 // Cache in Redis for real-time access
 await redis.setex(`cost_alert:${alert.id}`, this.ALERT_CACHE_TTL, JSON.stringify(alert));

 // Send notifications (webhook, email, etc.)
 await this.sendNotification(alert);

 return alert;
 }

 /**
 * Check if alert already exists
 */
 private async getExistingAlert(serviceId: string, alertType: string, referenceId: string): Promise<CostAlert | null> {
 try {
 const alert = await prisma.costAlert.findFirst({
 where: {
 serviceId,
 alertType,
 resolved: false,
 createdAt: {
 gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
 },
 },
 });

 return alert ? {
 id: alert.id,
 serviceId: alert.serviceId,
 serviceName: alert.serviceName || serviceId,
 alertType: alert.alertType as any,
 severity: alert.severity as any,
 title: alert.title,
 message: alert.message,
 currentValue: alert.currentValue,
 thresholdValue: alert.thresholdValue,
 currency: alert.currency,
 provider: alert.provider,
 createdAt: alert.createdAt,
 resolved: alert.resolved,
 resolvedAt: alert.resolvedAt || undefined,
 } : null;
 } catch (error) {
 console.error('Failed to get existing alert:', error);
 return null;
 }
 }

 /**
 * Calculate alert severity
 */
 private calculateSeverity(currentValue: number, thresholdValue: number): 'low' | 'medium' | 'high' | 'critical' {
 const ratio = currentValue / thresholdValue;
 
 if (ratio >= 3) return 'critical';
 if (ratio >= 2) return 'high';
 if (ratio >= 1.5) return 'medium';
 return 'low';
 }

 /**
 * Send notification for alert
 */
 private async sendNotification(alert: CostAlert): Promise<void> {
 try {
 // Here you would integrate with your notification system
 // Slack, Teams, Email, PagerDuty, etc.
 
 console.log(`Cost Alert [${alert.severity.toUpperCase()}]: ${alert.title}`);
 console.log(`Service: ${alert.serviceName}`);
 console.log(`Message: ${alert.message}`);
 
 // Example webhook notification
 if (process.env.COST_ALERT_WEBHOOK_URL) {
 await fetch(process.env.COST_ALERT_WEBHOOK_URL, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 text: `${alert.title}: ${alert.message}`,
 alert,
 }),
 });
 }
 } catch (error) {
 console.error('Failed to send notification:', error);
 }
 }

 /**
 * Get active alerts
 */
 async getActiveAlerts(serviceId?: string): Promise<CostAlert[]> {
 try {
 const whereClause: any = {
 resolved: false,
 };

 if (serviceId) {
 whereClause.serviceId = serviceId;
 }

 const alerts = await prisma.costAlert.findMany({
 where: whereClause,
 orderBy: {
 createdAt: 'desc',
 },
 });

 return alerts.map(alert => ({
 id: alert.id,
 serviceId: alert.serviceId,
 serviceName: alert.serviceName || alert.serviceId,
 alertType: alert.alertType as any,
 severity: alert.severity as any,
 title: alert.title,
 message: alert.message,
 currentValue: alert.currentValue,
 thresholdValue: alert.thresholdValue,
 currency: alert.currency,
 provider: alert.provider,
 createdAt: alert.createdAt,
 resolved: alert.resolved,
 resolvedAt: alert.resolvedAt || undefined,
 }));
 } catch (error) {
 console.error('Failed to get active alerts:', error);
 return [];
 }
 }

 /**
 * Resolve an alert
 */
 async resolveAlert(alertId: string): Promise<void> {
 try {
 await prisma.costAlert.update({
 where: { id: alertId },
 data: {
 resolved: true,
 resolvedAt: new Date(),
 },
 });

 // Remove from cache
 await redis.del(`cost_alert:${alertId}`);

 console.log(`Cost alert ${alertId} resolved`);
 } catch (error) {
 console.error('Failed to resolve alert:', error);
 throw error;
 }
 }
}

// Create singleton instance
export const costMonitor = new CostMonitor();