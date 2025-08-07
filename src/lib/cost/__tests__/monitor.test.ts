import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the database client and redis before importing the monitor
const mockPrisma = {
 costThreshold: {
 findMany: jest.fn(),
 },
 budget: {
 findMany: jest.fn(),
 },
 service: {
 findMany: jest.fn(),
 },
 serviceCost: {
 aggregate: jest.fn(),
 findMany: jest.fn(),
 },
 costAlert: {
 create: jest.fn(),
 findFirst: jest.fn(),
 findMany: jest.fn(),
 update: jest.fn(),
 },
};

const mockRedis = {
 setex: jest.fn(),
 del: jest.fn(),
};

const mockCostAggregator = {
 // Mock any methods from costAggregator that might be used
};

jest.mock('../db/client', () => ({
 prisma: mockPrisma,
 redis: mockRedis,
}));

jest.mock('../aggregator', () => ({
 costAggregator: mockCostAggregator,
}));

// Mock fetch for notifications
global.fetch = jest.fn();

import { CostMonitor } from '../monitor';

describe('CostMonitor', () => {
 let monitor: CostMonitor;

 beforeEach(() => {
 jest.clearAllMocks();
 jest.useFakeTimers();
 monitor = new CostMonitor();
 });

 afterEach(() => {
 monitor.stopMonitoring();
 jest.useRealTimers();
 });

 describe('Monitoring Lifecycle', () => {
 it('should start monitoring with correct interval', () => {
 const setIntervalSpy = jest.spyOn(global, 'setInterval');
 
 const newMonitor = new CostMonitor();
 
 expect(setIntervalSpy).toHaveBeenCalledWith(
 expect.any(Function),
 15 * 60 * 1000 // 15 minutes
 );

 newMonitor.stopMonitoring();
 setIntervalSpy.mockRestore();
 });

 it('should stop monitoring and clear interval', () => {
 const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
 
 monitor.stopMonitoring();
 
 expect(clearIntervalSpy).toHaveBeenCalled();
 clearIntervalSpy.mockRestore();
 });

 it('should restart monitoring if already running', () => {
 const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
 const setIntervalSpy = jest.spyOn(global, 'setInterval');
 
 monitor.startMonitoring(); // Should clear existing interval
 
 expect(clearIntervalSpy).toHaveBeenCalled();
 expect(setIntervalSpy).toHaveBeenCalled();
 
 clearIntervalSpy.mockRestore();
 setIntervalSpy.mockRestore();
 });
 });

 describe('Threshold Alerts', () => {
 it('should detect threshold violations', async () => {
 const mockThresholds = [
 {
 id: 'threshold-1',
 serviceId: 'service-1',
 metricType: 'daily',
 thresholdValue: 100,
 comparisonOperator: 'greater_than',
 baselinePeriod: 7,
 enabled: true,
 service: { displayName: 'Web Service' },
 },
 ];

 const mockCurrentCosts = {
 _sum: { cost: 150 }, // Exceeds threshold of 100
 };

 mockPrisma.costThreshold.findMany.mockResolvedValue(mockThresholds);
 mockPrisma.serviceCost.aggregate.mockResolvedValue(mockCurrentCosts);
 mockPrisma.costAlert.findFirst.mockResolvedValue(null); // No existing alert
 mockPrisma.costAlert.create.mockResolvedValue({
 id: 'alert-1',
 serviceId: 'service-1',
 alertType: 'threshold',
 severity: 'medium',
 title: 'daily cost threshold exceeded',
 message: 'Service Web Service daily cost of $150.00 exceeds threshold of $100.00',
 currentValue: 150,
 thresholdValue: 100,
 currency: 'USD',
 provider: 'multi',
 resolved: false,
 createdAt: new Date(),
 });

 const checkThresholdAlerts = (monitor as any).checkThresholdAlerts.bind(monitor);
 const alerts = await checkThresholdAlerts();

 expect(alerts).toHaveLength(1);
 expect(alerts[0].alertType).toBe('threshold');
 expect(alerts[0].severity).toBe('medium');
 expect(alerts[0].currentValue).toBe(150);
 expect(alerts[0].thresholdValue).toBe(100);

 expect(mockPrisma.costAlert.create).toHaveBeenCalled();
 expect(mockRedis.setex).toHaveBeenCalled();
 });

 it('should handle percent increase thresholds', async () => {
 const mockThresholds = [
 {
 id: 'threshold-1',
 serviceId: 'service-1',
 metricType: 'daily',
 thresholdValue: 50, // 50% increase threshold
 comparisonOperator: 'percent_increase',
 baselinePeriod: 7,
 enabled: true,
 service: { displayName: 'Web Service' },
 },
 ];

 mockPrisma.costThreshold.findMany.mockResolvedValue(mockThresholds);
 mockPrisma.serviceCost.aggregate
 .mockResolvedValueOnce({ _sum: { cost: 150 } }) // Current: 150
 .mockResolvedValueOnce({ _sum: { cost: 100 } }); // Baseline: 100
 mockPrisma.costAlert.findFirst.mockResolvedValue(null);
 mockPrisma.costAlert.create.mockResolvedValue({
 id: 'alert-1',
 serviceId: 'service-1',
 alertType: 'threshold',
 currentValue: 150,
 thresholdValue: 50,
 });

 const checkThresholdAlerts = (monitor as any).checkThresholdAlerts.bind(monitor);
 const alerts = await checkThresholdAlerts();

 expect(alerts).toHaveLength(1);
 // 50% increase from 100 to 150 should trigger alert
 expect(mockPrisma.serviceCost.aggregate).toHaveBeenCalledTimes(2);
 expect(mockPrisma.costAlert.create).toHaveBeenCalled();
 });

 it('should not create duplicate alerts', async () => {
 const mockThresholds = [
 {
 id: 'threshold-1',
 serviceId: 'service-1',
 metricType: 'daily',
 thresholdValue: 100,
 comparisonOperator: 'greater_than',
 enabled: true,
 service: { displayName: 'Web Service' },
 },
 ];

 const existingAlert = {
 id: 'existing-alert',
 serviceId: 'service-1',
 alertType: 'threshold',
 resolved: false,
 createdAt: new Date(),
 };

 mockPrisma.costThreshold.findMany.mockResolvedValue(mockThresholds);
 mockPrisma.serviceCost.aggregate.mockResolvedValue({ _sum: { cost: 150 } });
 mockPrisma.costAlert.findFirst.mockResolvedValue(existingAlert); // Existing alert

 const checkThresholdAlerts = (monitor as any).checkThresholdAlerts.bind(monitor);
 const alerts = await checkThresholdAlerts();

 expect(alerts).toHaveLength(0); // No new alert created
 expect(mockPrisma.costAlert.create).not.toHaveBeenCalled();
 });
 });

 describe('Budget Alerts', () => {
 it('should detect budget threshold violations', async () => {
 const mockBudgets = [
 {
 id: 'budget-1',
 name: 'Monthly Web Service Budget',
 serviceId: 'service-1',
 amount: 1000,
 currency: 'USD',
 period: 'monthly',
 thresholds: {
 warning: 80,
 critical: 95,
 },
 enabled: true,
 service: { displayName: 'Web Service' },
 },
 ];

 const mockCurrentSpending = {
 _sum: { cost: 950 }, // 95% of budget
 };

 mockPrisma.budget.findMany.mockResolvedValue(mockBudgets);
 mockPrisma.serviceCost.aggregate.mockResolvedValue(mockCurrentSpending);
 mockPrisma.costAlert.create.mockResolvedValue({
 id: 'alert-1',
 serviceId: 'service-1',
 alertType: 'budget',
 severity: 'critical',
 });

 const checkBudgetAlerts = (monitor as any).checkBudgetAlerts.bind(monitor);
 const alerts = await checkBudgetAlerts();

 expect(alerts).toHaveLength(1);
 expect(alerts[0].alertType).toBe('budget');
 expect(alerts[0].severity).toBe('critical');
 expect(mockPrisma.costAlert.create).toHaveBeenCalledWith(
 expect.objectContaining({
 data: expect.objectContaining({
 alertType: 'budget',
 severity: 'critical',
 title: 'Budget critically exceeded',
 }),
 })
 );
 });

 it('should handle team budgets', async () => {
 const mockBudgets = [
 {
 id: 'budget-1',
 name: 'Team Alpha Budget',
 teamId: 'team-1',
 amount: 2000,
 currency: 'USD',
 period: 'monthly',
 thresholds: {
 warning: 80,
 critical: 95,
 },
 enabled: true,
 team: { name: 'Team Alpha' },
 },
 ];

 const mockTeamServices = [
 { id: 'service-1' },
 { id: 'service-2' },
 ];

 mockPrisma.budget.findMany.mockResolvedValue(mockBudgets);
 mockPrisma.service.findMany.mockResolvedValue(mockTeamServices);
 mockPrisma.serviceCost.aggregate.mockResolvedValue({ _sum: { cost: 1700 } }); // 85% of budget
 mockPrisma.costAlert.create.mockResolvedValue({
 id: 'alert-1',
 serviceId: 'team-budget',
 alertType: 'budget',
 severity: 'medium',
 });

 const checkBudgetAlerts = (monitor as any).checkBudgetAlerts.bind(monitor);
 const alerts = await checkBudgetAlerts();

 expect(alerts).toHaveLength(1);
 expect(mockPrisma.service.findMany).toHaveBeenCalledWith({
 where: { teamId: 'team-1' },
 select: { id: true },
 });
 expect(mockPrisma.serviceCost.aggregate).toHaveBeenCalledWith({
 where: expect.objectContaining({
 serviceId: { in: ['service-1', 'service-2'] },
 }),
 _sum: { cost: true },
 });
 });

 it('should handle different budget periods correctly', async () => {
 const calculateSeverity = (monitor as any).calculateSeverity.bind(monitor);
 
 expect(calculateSeverity(300, 100)).toBe('critical'); // 3x threshold
 expect(calculateSeverity(200, 100)).toBe('high'); // 2x threshold
 expect(calculateSeverity(150, 100)).toBe('medium'); // 1.5x threshold
 expect(calculateSeverity(120, 100)).toBe('low'); // 1.2x threshold
 });
 });

 describe('Anomaly Detection', () => {
 it('should detect cost anomalies using statistical analysis', async () => {
 const mockServices = [
 { id: 'service-1', displayName: 'Web Service' },
 ];

 const mockCosts = [
 { cost: 100 }, { cost: 105 }, { cost: 95 }, { cost: 102 },
 { cost: 98 }, { cost: 103 }, { cost: 99 }, { cost: 250 }, // Anomaly: 250
 ];

 mockPrisma.service.findMany.mockResolvedValue(mockServices);
 mockPrisma.serviceCost.findMany.mockResolvedValue(mockCosts);
 mockPrisma.costAlert.create.mockResolvedValue({
 id: 'alert-1',
 serviceId: 'service-1',
 alertType: 'anomaly',
 severity: 'high',
 });

 const checkAnomalyAlerts = (monitor as any).checkAnomalyAlerts.bind(monitor);
 const alerts = await checkAnomalyAlerts();

 expect(alerts).toHaveLength(1);
 expect(alerts[0].alertType).toBe('anomaly');
 expect(alerts[0].severity).toBe('high');
 expect(mockPrisma.costAlert.create).toHaveBeenCalledWith(
 expect.objectContaining({
 data: expect.objectContaining({
 alertType: 'anomaly',
 title: 'Cost anomaly detected',
 }),
 })
 );
 });

 it('should skip services with insufficient data', async () => {
 const mockServices = [
 { id: 'service-1', displayName: 'Web Service' },
 ];

 const mockCosts = [
 { cost: 100 }, { cost: 105 }, // Only 2 days of data (< 7 required)
 ];

 mockPrisma.service.findMany.mockResolvedValue(mockServices);
 mockPrisma.serviceCost.findMany.mockResolvedValue(mockCosts);

 const checkAnomalyAlerts = (monitor as any).checkAnomalyAlerts.bind(monitor);
 const alerts = await checkAnomalyAlerts();

 expect(alerts).toHaveLength(0);
 expect(mockPrisma.costAlert.create).not.toHaveBeenCalled();
 });

 it('should not alert for normal variations', async () => {
 const mockServices = [
 { id: 'service-1', displayName: 'Web Service' },
 ];

 const mockCosts = [
 { cost: 100 }, { cost: 105 }, { cost: 95 }, { cost: 102 },
 { cost: 98 }, { cost: 103 }, { cost: 99 }, { cost: 104 }, // Normal variation
 ];

 mockPrisma.service.findMany.mockResolvedValue(mockServices);
 mockPrisma.serviceCost.findMany.mockResolvedValue(mockCosts);

 const checkAnomalyAlerts = (monitor as any).checkAnomalyAlerts.bind(monitor);
 const alerts = await checkAnomalyAlerts();

 expect(alerts).toHaveLength(0);
 expect(mockPrisma.costAlert.create).not.toHaveBeenCalled();
 });
 });

 describe('Alert Management', () => {
 it('should create alerts with correct data structure', async () => {
 const createAlert = (monitor as any).createAlert.bind(monitor);
 
 const alertData = {
 serviceId: 'service-1',
 serviceName: 'Web Service',
 alertType: 'threshold' as const,
 severity: 'high' as const,
 title: 'Test Alert',
 message: 'Test alert message',
 currentValue: 150,
 thresholdValue: 100,
 currency: 'USD',
 provider: 'aws',
 };

 mockPrisma.costAlert.create.mockResolvedValue({
 id: 'alert-123',
 ...alertData,
 createdAt: new Date(),
 resolved: false,
 });

 const alert = await createAlert(alertData);

 expect(alert.id).toMatch(/^alert_\d+_[a-z0-9]+$/); // Generated ID format
 expect(alert.resolved).toBe(false);
 expect(alert.createdAt).toBeInstanceOf(Date);

 expect(mockPrisma.costAlert.create).toHaveBeenCalledWith({
 data: expect.objectContaining({
 serviceId: 'service-1',
 alertType: 'threshold',
 severity: 'high',
 resolved: false,
 }),
 });

 expect(mockRedis.setex).toHaveBeenCalledWith(
 `cost_alert:${alert.id}`,
 3600, // TTL
 JSON.stringify(alert)
 );
 });

 it('should get active alerts correctly', async () => {
 const mockAlerts = [
 {
 id: 'alert-1',
 serviceId: 'service-1',
 serviceName: 'Web Service',
 alertType: 'threshold',
 severity: 'high',
 title: 'High Cost Alert',
 message: 'Cost exceeded threshold',
 currentValue: 150,
 thresholdValue: 100,
 currency: 'USD',
 provider: 'aws',
 createdAt: new Date(),
 resolved: false,
 resolvedAt: null,
 },
 ];

 mockPrisma.costAlert.findMany.mockResolvedValue(mockAlerts);

 const alerts = await monitor.getActiveAlerts();

 expect(alerts).toHaveLength(1);
 expect(alerts[0].id).toBe('alert-1');
 expect(alerts[0].resolved).toBe(false);

 expect(mockPrisma.costAlert.findMany).toHaveBeenCalledWith({
 where: { resolved: false },
 orderBy: { createdAt: 'desc' },
 });
 });

 it('should filter active alerts by service ID', async () => {
 const mockAlerts = [
 {
 id: 'alert-1',
 serviceId: 'service-1',
 serviceName: 'Web Service',
 alertType: 'threshold',
 severity: 'high',
 title: 'High Cost Alert',
 message: 'Cost exceeded threshold',
 currentValue: 150,
 thresholdValue: 100,
 currency: 'USD',
 provider: 'aws',
 createdAt: new Date(),
 resolved: false,
 resolvedAt: null,
 },
 ];

 mockPrisma.costAlert.findMany.mockResolvedValue(mockAlerts);

 await monitor.getActiveAlerts('service-1');

 expect(mockPrisma.costAlert.findMany).toHaveBeenCalledWith({
 where: {
 resolved: false,
 serviceId: 'service-1',
 },
 orderBy: { createdAt: 'desc' },
 });
 });

 it('should resolve alerts correctly', async () => {
 const alertId = 'alert-123';

 mockPrisma.costAlert.update.mockResolvedValue({
 id: alertId,
 resolved: true,
 resolvedAt: new Date(),
 });

 await monitor.resolveAlert(alertId);

 expect(mockPrisma.costAlert.update).toHaveBeenCalledWith({
 where: { id: alertId },
 data: {
 resolved: true,
 resolvedAt: expect.any(Date),
 },
 });

 expect(mockRedis.del).toHaveBeenCalledWith(`cost_alert:${alertId}`);
 });
 });

 describe('Notifications', () => {
 it('should send webhook notifications when configured', async () => {
 process.env.COST_ALERT_WEBHOOK_URL = 'https://example.com/webhook';
 
 const sendNotification = (monitor as any).sendNotification.bind(monitor);
 
 const alert = {
 id: 'alert-1',
 serviceId: 'service-1',
 serviceName: 'Web Service',
 alertType: 'threshold' as const,
 severity: 'high' as const,
 title: 'Test Alert',
 message: 'Test alert message',
 currentValue: 150,
 thresholdValue: 100,
 currency: 'USD',
 provider: 'aws',
 createdAt: new Date(),
 resolved: false,
 };

 (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
 ok: true,
 status: 200,
 } as Response);

 await sendNotification(alert);

 expect(global.fetch).toHaveBeenCalledWith(
 'https://example.com/webhook',
 {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 text: `${alert.title}: ${alert.message}`,
 alert,
 }),
 }
 );

 delete process.env.COST_ALERT_WEBHOOK_URL;
 });

 it('should handle notification failures gracefully', async () => {
 const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
 
 const sendNotification = (monitor as any).sendNotification.bind(monitor);
 
 const alert = {
 id: 'alert-1',
 title: 'Test Alert',
 message: 'Test message',
 serviceName: 'Test Service',
 severity: 'high' as const,
 };

 (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
 new Error('Network error')
 );

 process.env.COST_ALERT_WEBHOOK_URL = 'https://example.com/webhook';

 await sendNotification(alert);

 expect(consoleErrorSpy).toHaveBeenCalledWith(
 'Failed to send notification:',
 expect.any(Error)
 );

 delete process.env.COST_ALERT_WEBHOOK_URL;
 consoleErrorSpy.mockRestore();
 });
 });

 describe('Error Handling', () => {
 it('should handle database errors in monitoring checks', async () => {
 const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
 
 mockPrisma.costThreshold.findMany.mockRejectedValue(new Error('Database error'));
 mockPrisma.budget.findMany.mockRejectedValue(new Error('Database error'));
 mockPrisma.service.findMany.mockRejectedValue(new Error('Database error'));

 const runMonitoringChecks = (monitor as any).runMonitoringChecks.bind(monitor);
 
 // Should not throw, but log errors
 await expect(runMonitoringChecks()).resolves.not.toThrow();

 expect(consoleErrorSpy).toHaveBeenCalledWith(
 'Failed to check threshold alerts:',
 expect.any(Error)
 );

 consoleErrorSpy.mockRestore();
 });

 it('should handle alert creation failures', async () => {
 const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
 
 mockPrisma.costAlert.create.mockRejectedValue(new Error('Database error'));

 const createAlert = (monitor as any).createAlert.bind(monitor);
 
 const alertData = {
 serviceId: 'service-1',
 serviceName: 'Web Service',
 alertType: 'threshold' as const,
 severity: 'high' as const,
 title: 'Test Alert',
 message: 'Test message',
 currentValue: 150,
 thresholdValue: 100,
 currency: 'USD',
 provider: 'aws',
 };

 await expect(createAlert(alertData)).rejects.toThrow('Database error');
 consoleErrorSpy.mockRestore();
 });

 it('should handle alert resolution failures', async () => {
 const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
 
 mockPrisma.costAlert.update.mockRejectedValue(new Error('Database error'));

 await expect(monitor.resolveAlert('alert-123')).rejects.toThrow('Database error');
 
 expect(consoleErrorSpy).toHaveBeenCalledWith(
 'Failed to resolve alert:',
 expect.any(Error)
 );

 consoleErrorSpy.mockRestore();
 });
 });
});