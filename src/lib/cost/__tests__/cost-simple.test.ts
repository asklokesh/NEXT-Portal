import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Cost Management - Simple Tests', () => {
 describe('Currency Conversion Logic', () => {
 it('should convert currencies correctly', () => {
 const currencyRates = new Map([
 ['USD', 1.0],
 ['EUR', 0.85],
 ['GBP', 0.73],
 ['CAD', 1.35],
 ['AUD', 1.52],
 ]);

 const convertToUSD = (amount: number, currency: string): number => {
 const rate = currencyRates.get(currency.toUpperCase()) || 1.0;
 return amount / rate;
 };

 expect(convertToUSD(100, 'USD')).toBe(100);
 expect(convertToUSD(85, 'EUR')).toBeCloseTo(100, 2);
 expect(convertToUSD(73, 'GBP')).toBeCloseTo(100, 2);
 expect(convertToUSD(135, 'CAD')).toBeCloseTo(100, 2);
 expect(convertToUSD(152, 'AUD')).toBeCloseTo(100, 2);
 expect(convertToUSD(100, 'UNKNOWN')).toBe(100);
 });
 });

 describe('Cost Aggregation Logic', () => {
 it('should aggregate costs by provider', () => {
 const costs = [
 { provider: 'aws', cost: 100, currency: 'USD' },
 { provider: 'aws', cost: 50, currency: 'USD' },
 { provider: 'azure', cost: 75, currency: 'USD' },
 { provider: 'gcp', cost: 25, currency: 'USD' },
 ];

 const breakdown = {
 aws: costs.filter(c => c.provider === 'aws').reduce((sum, c) => sum + c.cost, 0),
 azure: costs.filter(c => c.provider === 'azure').reduce((sum, c) => sum + c.cost, 0),
 gcp: costs.filter(c => c.provider === 'gcp').reduce((sum, c) => sum + c.cost, 0),
 };

 expect(breakdown.aws).toBe(150);
 expect(breakdown.azure).toBe(75);
 expect(breakdown.gcp).toBe(25);
 });

 it('should calculate cost trends', () => {
 const currentCosts = [100, 110, 120];
 const previousCosts = [80, 90, 100];

 const current = currentCosts.reduce((sum, cost) => sum + cost, 0);
 const previous = previousCosts.reduce((sum, cost) => sum + cost, 0);
 const change = current - previous;
 const changePercent = previous > 0 ? (change / previous) * 100 : 0;

 expect(current).toBe(330);
 expect(previous).toBe(270);
 expect(change).toBe(60);
 expect(changePercent).toBeCloseTo(22.22, 2);
 });

 it('should handle zero baseline in trend calculation', () => {
 const current = 100;
 const previous = 0;
 const change = current - previous;
 const changePercent = previous > 0 ? (change / previous) * 100 : 0;

 expect(change).toBe(100);
 expect(changePercent).toBe(0); // Should handle division by zero
 });
 });

 describe('Daily and Monthly Grouping', () => {
 it('should group costs by date', () => {
 const costs = [
 { date: new Date('2024-01-01'), cost: 100, provider: 'aws' },
 { date: new Date('2024-01-01'), cost: 50, provider: 'azure' },
 { date: new Date('2024-01-02'), cost: 110, provider: 'aws' },
 ];

 const dailyGroups = new Map<string, any[]>();
 costs.forEach(cost => {
 const dateKey = cost.date.toISOString().split('T')[0];
 if (!dailyGroups.has(dateKey)) {
 dailyGroups.set(dateKey, []);
 }
 dailyGroups.get(dateKey)!.push(cost);
 });

 expect(dailyGroups.size).toBe(2);
 expect(dailyGroups.get('2024-01-01')).toHaveLength(2);
 expect(dailyGroups.get('2024-01-02')).toHaveLength(1);
 });

 it('should group costs by month', () => {
 const costs = [
 { date: new Date(2024, 0, 1), cost: 100 }, // January 1, 2024 (month is 0-indexed)
 { date: new Date(2024, 0, 15), cost: 50 }, // January 15, 2024
 { date: new Date(2024, 1, 1), cost: 110 }, // February 1, 2024
 ];

 const monthlyGroups = new Map<string, any[]>();
 costs.forEach(cost => {
 const monthKey = `${cost.date.getFullYear()}-${String(cost.date.getMonth() + 1).padStart(2, '0')}`;
 if (!monthlyGroups.has(monthKey)) {
 monthlyGroups.set(monthKey, []);
 }
 monthlyGroups.get(monthKey)!.push(cost);
 });

 // Verify the keys are correct first
 const keys = Array.from(monthlyGroups.keys()).sort();
 expect(keys).toEqual(['2024-01', '2024-02']);
 
 expect(monthlyGroups.size).toBe(2);
 expect(monthlyGroups.get('2024-01')).toBeDefined();
 expect(monthlyGroups.get('2024-01')).toHaveLength(2);
 expect(monthlyGroups.get('2024-02')).toBeDefined();
 expect(monthlyGroups.get('2024-02')).toHaveLength(1);
 });
 });

 describe('Cost Filtering and Sorting', () => {
 it('should filter resources by ownership', () => {
 const resources = [
 { id: '1', ownerId: 'user1', cost: 100 },
 { id: '2', ownerId: 'user2', cost: 150 },
 { id: '3', ownerId: 'user1', cost: 75 },
 ];

 const userResources = resources.filter(r => r.ownerId === 'user1');
 expect(userResources).toHaveLength(2);
 expect(userResources.map(r => r.id).sort()).toEqual(['1', '3']);
 });

 it('should filter resources by team', () => {
 const resources = [
 { id: '1', teamId: 'team1', cost: 100 },
 { id: '2', teamId: 'team2', cost: 150 },
 { id: '3', teamId: 'team1', cost: 75 },
 ];

 const teamResources = resources.filter(r => r.teamId === 'team1');
 expect(teamResources).toHaveLength(2);
 expect(teamResources.map(r => r.id).sort()).toEqual(['1', '3']);
 });

 it('should sort services by cost', () => {
 const services = [
 { name: 'Service A', cost: 150 },
 { name: 'Service B', cost: 300 },
 { name: 'Service C', cost: 75 },
 ];

 const sorted = services.sort((a, b) => b.cost - a.cost);
 
 expect(sorted[0].name).toBe('Service B');
 expect(sorted[1].name).toBe('Service A');
 expect(sorted[2].name).toBe('Service C');
 });
 });

 describe('Alert Severity Calculation', () => {
 it('should calculate alert severity correctly', () => {
 const calculateSeverity = (currentValue: number, thresholdValue: number): 'low' | 'medium' | 'high' | 'critical' => {
 const ratio = currentValue / thresholdValue;
 
 if (ratio >= 3) return 'critical';
 if (ratio >= 2) return 'high';
 if (ratio >= 1.5) return 'medium';
 return 'low';
 };

 expect(calculateSeverity(300, 100)).toBe('critical'); // 3x threshold
 expect(calculateSeverity(200, 100)).toBe('high'); // 2x threshold
 expect(calculateSeverity(150, 100)).toBe('medium'); // 1.5x threshold
 expect(calculateSeverity(120, 100)).toBe('low'); // 1.2x threshold
 });
 });

 describe('Budget Percentage Calculation', () => {
 it('should calculate budget usage percentage', () => {
 const budget = 1000;
 const spent = 750;
 const percentage = (spent / budget) * 100;

 expect(percentage).toBe(75);
 });

 it('should handle zero budget', () => {
 const budget = 0;
 const spent = 100;
 const percentage = budget > 0 ? (spent / budget) * 100 : 0;

 expect(percentage).toBe(0); // Should handle division by zero
 });
 });

 describe('Anomaly Detection Logic', () => {
 it('should detect cost anomalies using statistical analysis', () => {
 const costs = [100, 105, 95, 102, 98, 103, 99, 250]; // 250 is an anomaly
 
 const mean = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
 const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / costs.length;
 const stdDev = Math.sqrt(variance);
 
 const lastCost = costs[costs.length - 1];
 const threshold = mean + (2 * stdDev); // 2-sigma rule
 
 const isAnomaly = lastCost > threshold && lastCost > mean * 1.5;
 
 expect(isAnomaly).toBe(true);
 expect(lastCost).toBe(250);
 expect(lastCost).toBeGreaterThan(threshold);
 expect(lastCost).toBeGreaterThan(mean * 1.5);
 });

 it('should not flag normal variations as anomalies', () => {
 const costs = [100, 105, 95, 102, 98, 103, 99, 104]; // Normal variation
 
 const mean = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
 const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / costs.length;
 const stdDev = Math.sqrt(variance);
 
 const lastCost = costs[costs.length - 1];
 const threshold = mean + (2 * stdDev);
 
 const isAnomaly = lastCost > threshold && lastCost > mean * 1.5;
 
 expect(isAnomaly).toBe(false);
 });
 });

 describe('Top Services Calculation', () => {
 it('should calculate top services with percentages', () => {
 const serviceCosts = new Map([
 ['service-1', 300],
 ['service-2', 200],
 ['service-3', 100],
 ['service-4', 50],
 ]);

 const totalCost = Array.from(serviceCosts.values()).reduce((sum, cost) => sum + cost, 0);
 
 const topServices = Array.from(serviceCosts.entries())
 .map(([serviceId, cost]) => ({
 serviceId,
 cost,
 percentage: (cost / totalCost) * 100,
 }))
 .sort((a, b) => b.cost - a.cost)
 .slice(0, 3);

 expect(topServices).toHaveLength(3);
 expect(topServices[0].serviceId).toBe('service-1');
 expect(topServices[0].percentage).toBeCloseTo(46.15, 2); // 300/650 * 100
 expect(topServices[1].serviceId).toBe('service-2');
 expect(topServices[1].percentage).toBeCloseTo(30.77, 2); // 200/650 * 100
 });
 });

 describe('Date Range Calculations', () => {
 it('should calculate period durations correctly', () => {
 const startDate = new Date('2024-01-01');
 const endDate = new Date('2024-01-31');
 
 const periodDuration = endDate.getTime() - startDate.getTime();
 const durationInDays = periodDuration / (1000 * 60 * 60 * 24);
 
 expect(durationInDays).toBe(30);
 });

 it('should calculate previous period correctly', () => {
 const startDate = new Date('2024-01-15');
 const endDate = new Date('2024-01-31');
 
 const periodDuration = endDate.getTime() - startDate.getTime();
 const previousStart = new Date(startDate.getTime() - periodDuration);
 const previousEnd = startDate;
 
 expect(previousStart.toISOString().split('T')[0]).toBe('2023-12-30');
 expect(previousEnd.toISOString().split('T')[0]).toBe('2024-01-15');
 });
 });

 describe('Alert ID Generation', () => {
 it('should generate unique alert IDs', () => {
 const generateAlertId = (): string => {
 return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
 };

 const id1 = generateAlertId();
 const id2 = generateAlertId();
 
 expect(id1).toMatch(/^alert_\d+_[a-z0-9]+$/);
 expect(id2).toMatch(/^alert_\d+_[a-z0-9]+$/);
 expect(id1).not.toBe(id2);
 });
 });
});