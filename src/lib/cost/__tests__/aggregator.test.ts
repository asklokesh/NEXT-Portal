import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the database client and providers before importing the aggregator
const mockPrisma = {
 serviceCost: {
 findMany: jest.fn(),
 },
 service: {
 findMany: jest.fn(),
 },
};

const mockAWSProvider = {
 getDailyCosts: jest.fn(),
 getMonthlyCosts: jest.fn(),
 syncCostsToDatabase: jest.fn(),
 getCostRecommendations: jest.fn(),
};

const mockAzureProvider = {
 getDailyCosts: jest.fn(),
 getMonthlyCosts: jest.fn(),
 syncCostsToDatabase: jest.fn(),
 getCostRecommendations: jest.fn(),
};

const mockGCPProvider = {
 getDailyCosts: jest.fn(),
 getMonthlyCosts: jest.fn(),
 syncCostsToDatabase: jest.fn(),
 getCostRecommendations: jest.fn(),
};

jest.mock('../../db/client', () => ({
 prisma: mockPrisma,
 redis: {},
 sessionRedis: {},
}));

jest.mock('../providers/aws', () => ({
 awsCostProvider: mockAWSProvider,
}));

jest.mock('../providers/azure', () => ({
 azureCostProvider: mockAzureProvider,
}));

jest.mock('../providers/gcp', () => ({
 gcpCostProvider: mockGCPProvider,
}));

// Mock cloud SDK modules that are causing import issues
jest.mock('@azure/arm-consumption', () => ({}));
jest.mock('@azure/arm-costmanagement', () => ({}));
jest.mock('@azure/identity', () => ({}));
jest.mock('@aws-sdk/client-cost-explorer', () => ({}));
jest.mock('@aws-sdk/client-organizations', () => ({}));
jest.mock('@google-cloud/bigquery', () => ({}));
jest.mock('@google-cloud/billing', () => ({}));
jest.mock('@google-cloud/recommender', () => ({}));

// Set environment variables for testing
process.env.AWS_COST_EXPLORER_ENABLED = 'true';
process.env.AZURE_COST_MANAGEMENT_ENABLED = 'true';
process.env.GCP_CLOUD_BILLING_ENABLED = 'true';

import { CostAggregator } from '../aggregator';

describe('CostAggregator', () => {
 let aggregator: CostAggregator;

 beforeEach(() => {
 jest.clearAllMocks();
 aggregator = new CostAggregator();
 });

 describe('syncAllCosts', () => {
 it('should sync costs from all enabled providers', async () => {
 const startDate = new Date('2024-01-01');
 const endDate = new Date('2024-01-31');

 // Mock provider responses
 const mockDailyCosts = [
 { date: new Date('2024-01-01'), cost: 100, currency: 'USD', provider: 'aws' },
 { date: new Date('2024-01-02'), cost: 110, currency: 'USD', provider: 'aws' },
 ];
 const mockMonthlyCosts = [
 { date: new Date('2024-01-01'), cost: 3000, currency: 'USD', provider: 'aws' },
 ];

 mockAWSProvider.getDailyCosts.mockResolvedValue(mockDailyCosts);
 mockAWSProvider.getMonthlyCosts.mockResolvedValue(mockMonthlyCosts);
 mockAWSProvider.syncCostsToDatabase.mockResolvedValue(undefined);

 mockAzureProvider.getDailyCosts.mockResolvedValue(mockDailyCosts);
 mockAzureProvider.getMonthlyCosts.mockResolvedValue(mockMonthlyCosts);
 mockAzureProvider.syncCostsToDatabase.mockResolvedValue(undefined);

 mockGCPProvider.getDailyCosts.mockResolvedValue(mockDailyCosts);
 mockGCPProvider.getMonthlyCosts.mockResolvedValue(mockMonthlyCosts);
 mockGCPProvider.syncCostsToDatabase.mockResolvedValue(undefined);

 await aggregator.syncAllCosts(startDate, endDate);

 // Verify all providers were called
 expect(mockAWSProvider.getDailyCosts).toHaveBeenCalledWith(startDate, endDate);
 expect(mockAWSProvider.getMonthlyCosts).toHaveBeenCalledWith(startDate, endDate);
 expect(mockAWSProvider.syncCostsToDatabase).toHaveBeenCalledWith([...mockDailyCosts, ...mockMonthlyCosts]);

 expect(mockAzureProvider.getDailyCosts).toHaveBeenCalledWith(startDate, endDate);
 expect(mockAzureProvider.getMonthlyCosts).toHaveBeenCalledWith(startDate, endDate);
 expect(mockAzureProvider.syncCostsToDatabase).toHaveBeenCalledWith([...mockDailyCosts, ...mockMonthlyCosts]);

 expect(mockGCPProvider.getDailyCosts).toHaveBeenCalledWith(startDate, endDate);
 expect(mockGCPProvider.getMonthlyCosts).toHaveBeenCalledWith(startDate, endDate);
 expect(mockGCPProvider.syncCostsToDatabase).toHaveBeenCalledWith([...mockDailyCosts, ...mockMonthlyCosts]);
 });

 it('should handle provider failures gracefully', async () => {
 const startDate = new Date('2024-01-01');
 const endDate = new Date('2024-01-31');

 // Make one provider fail
 mockAWSProvider.getDailyCosts.mockRejectedValue(new Error('AWS API Error'));
 mockAzureProvider.getDailyCosts.mockResolvedValue([]);
 mockAzureProvider.getMonthlyCosts.mockResolvedValue([]);
 mockGCPProvider.getDailyCosts.mockResolvedValue([]);
 mockGCPProvider.getMonthlyCosts.mockResolvedValue([]);

 // Should not throw error - uses Promise.allSettled
 await expect(aggregator.syncAllCosts(startDate, endDate)).resolves.not.toThrow();

 expect(mockAWSProvider.getDailyCosts).toHaveBeenCalledWith(startDate, endDate);
 expect(mockAzureProvider.getDailyCosts).toHaveBeenCalledWith(startDate, endDate);
 expect(mockGCPProvider.getDailyCosts).toHaveBeenCalledWith(startDate, endDate);
 });

 it('should skip disabled providers', async () => {
 // Disable some providers
 process.env.AWS_COST_EXPLORER_ENABLED = 'false';
 process.env.AZURE_COST_MANAGEMENT_ENABLED = 'true';
 process.env.GCP_CLOUD_BILLING_ENABLED = 'false';

 const newAggregator = new CostAggregator();
 const startDate = new Date('2024-01-01');
 const endDate = new Date('2024-01-31');

 mockAzureProvider.getDailyCosts.mockResolvedValue([]);
 mockAzureProvider.getMonthlyCosts.mockResolvedValue([]);
 mockAzureProvider.syncCostsToDatabase.mockResolvedValue(undefined);

 await newAggregator.syncAllCosts(startDate, endDate);

 // Only Azure should be called
 expect(mockAWSProvider.getDailyCosts).not.toHaveBeenCalled();
 expect(mockAzureProvider.getDailyCosts).toHaveBeenCalledWith(startDate, endDate);
 expect(mockGCPProvider.getDailyCosts).not.toHaveBeenCalled();

 // Reset for other tests
 process.env.AWS_COST_EXPLORER_ENABLED = 'true';
 process.env.GCP_CLOUD_BILLING_ENABLED = 'true';
 });
 });

 describe('getAggregatedCosts', () => {
 it('should aggregate costs by service', async () => {
 const startDate = new Date('2024-01-01');
 const endDate = new Date('2024-01-31');

 const mockCosts = [
 {
 serviceId: 'service-1',
 provider: 'aws',
 cost: 100,
 currency: 'USD',
 date: new Date('2024-01-01'),
 service: { displayName: 'Web Service' },
 },
 {
 serviceId: 'service-1',
 provider: 'azure',
 cost: 50,
 currency: 'USD',
 date: new Date('2024-01-01'),
 service: { displayName: 'Web Service' },
 },
 {
 serviceId: 'service-2',
 provider: 'gcp',
 cost: 75,
 currency: 'USD',
 date: new Date('2024-01-01'),
 service: { displayName: 'API Service' },
 },
 ];

 mockPrisma.serviceCost.findMany.mockResolvedValue(mockCosts);
 
 // Mock the recommendation calls
 mockAWSProvider.getCostRecommendations.mockResolvedValue([]);
 mockAzureProvider.getCostRecommendations.mockResolvedValue([]);
 mockGCPProvider.getCostRecommendations.mockResolvedValue([]);

 const result = await aggregator.getAggregatedCosts(startDate, endDate);

 expect(result).toHaveLength(2);
 
 const service1 = result.find(r => r.serviceId === 'service-1');
 expect(service1).toBeDefined();
 expect(service1?.totalCost).toBe(150); // 100 + 50
 expect(service1?.breakdown.aws).toBe(100);
 expect(service1?.breakdown.azure).toBe(50);
 expect(service1?.breakdown.gcp).toBe(0);

 const service2 = result.find(r => r.serviceId === 'service-2');
 expect(service2).toBeDefined();
 expect(service2?.totalCost).toBe(75);
 expect(service2?.breakdown.gcp).toBe(75);
 });

 it('should filter by service IDs when provided', async () => {
 const startDate = new Date('2024-01-01');
 const endDate = new Date('2024-01-31');
 const serviceIds = ['service-1'];

 mockPrisma.serviceCost.findMany.mockResolvedValue([]);
 mockAWSProvider.getCostRecommendations.mockResolvedValue([]);
 mockAzureProvider.getCostRecommendations.mockResolvedValue([]);
 mockGCPProvider.getCostRecommendations.mockResolvedValue([]);

 await aggregator.getAggregatedCosts(startDate, endDate, serviceIds);

 expect(mockPrisma.serviceCost.findMany).toHaveBeenCalledWith({
 where: {
 date: { gte: startDate, lte: endDate },
 serviceId: { in: serviceIds },
 },
 include: { service: true },
 });
 });

 it('should handle currency conversion', async () => {
 const startDate = new Date('2024-01-01');
 const endDate = new Date('2024-01-31');

 const mockCosts = [
 {
 serviceId: 'service-1',
 provider: 'aws',
 cost: 100,
 currency: 'EUR', // Will be converted to USD
 date: new Date('2024-01-01'),
 service: { displayName: 'Web Service' },
 },
 ];

 mockPrisma.serviceCost.findMany.mockResolvedValue(mockCosts);
 mockAWSProvider.getCostRecommendations.mockResolvedValue([]);
 mockAzureProvider.getCostRecommendations.mockResolvedValue([]);
 mockGCPProvider.getCostRecommendations.mockResolvedValue([]);

 const result = await aggregator.getAggregatedCosts(startDate, endDate);

 expect(result).toHaveLength(1);
 // EUR to USD conversion: 100 / 0.85 ≈ 117.65
 expect(result[0].totalCost).toBeCloseTo(117.65, 2);
 expect(result[0].currency).toBe('USD');
 });
 });

 describe('getCostSummary', () => {
 it('should generate comprehensive cost summary', async () => {
 const startDate = new Date('2024-01-01');
 const endDate = new Date('2024-01-31');

 const mockCosts = [
 {
 serviceId: 'service-1',
 provider: 'aws',
 cost: 100,
 currency: 'USD',
 date: new Date('2024-01-01'),
 service: { displayName: 'Web Service' },
 },
 {
 serviceId: 'service-1',
 provider: 'aws',
 cost: 110,
 currency: 'USD',
 date: new Date('2024-01-02'),
 service: { displayName: 'Web Service' },
 },
 {
 serviceId: 'service-2',
 provider: 'azure',
 cost: 75,
 currency: 'USD',
 date: new Date('2024-01-01'),
 service: { displayName: 'API Service' },
 },
 ];

 mockPrisma.serviceCost.findMany.mockResolvedValue(mockCosts);

 const result = await aggregator.getCostSummary(startDate, endDate);

 expect(result.totalCost).toBe(285); // 100 + 110 + 75
 expect(result.currency).toBe('USD');
 expect(result.periodStart).toEqual(startDate);
 expect(result.periodEnd).toEqual(endDate);

 expect(result.breakdown.aws).toBe(210); // 100 + 110
 expect(result.breakdown.azure).toBe(75);
 expect(result.breakdown.gcp).toBe(0);

 expect(result.topServices).toHaveLength(2);
 expect(result.topServices[0].serviceName).toBe('Web Service');
 expect(result.topServices[0].cost).toBe(210);
 expect(result.topServices[0].percentage).toBeCloseTo(73.68, 2); // 210/285 * 100

 expect(result.trends.daily).toHaveLength(2);
 expect(result.trends.monthly).toHaveLength(1);
 });

 it('should handle empty cost data', async () => {
 const startDate = new Date('2024-01-01');
 const endDate = new Date('2024-01-31');

 mockPrisma.serviceCost.findMany.mockResolvedValue([]);

 const result = await aggregator.getCostSummary(startDate, endDate);

 expect(result.totalCost).toBe(0);
 expect(result.breakdown.aws).toBe(0);
 expect(result.breakdown.azure).toBe(0);
 expect(result.breakdown.gcp).toBe(0);
 expect(result.topServices).toHaveLength(0);
 expect(result.trends.daily).toHaveLength(0);
 expect(result.trends.monthly).toHaveLength(0);
 });
 });

 describe('updateCurrencyRates', () => {
 it('should update currency rates', async () => {
 const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

 await aggregator.updateCurrencyRates();

 expect(consoleSpy).toHaveBeenCalledWith('Currency rates updated');
 consoleSpy.mockRestore();
 });

 it('should handle currency rate update errors', async () => {
 const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
 
 // Mock an error by temporarily overriding the method
 const originalMethod = aggregator.updateCurrencyRates;
 aggregator.updateCurrencyRates = jest.fn().mockRejectedValue(new Error('API Error'));

 await aggregator.updateCurrencyRates();

 expect(aggregator.updateCurrencyRates).toHaveBeenCalled();
 
 // Restore original method
 aggregator.updateCurrencyRates = originalMethod;
 consoleErrorSpy.mockRestore();
 });
 });

 describe('Currency Conversion', () => {
 it('should convert currencies to USD correctly', () => {
 // Access private method through type assertion
 const convertToUSD = (aggregator as any).convertToUSD.bind(aggregator);

 expect(convertToUSD(100, 'USD')).toBe(100);
 expect(convertToUSD(85, 'EUR')).toBeCloseTo(100, 2); // 85 / 0.85
 expect(convertToUSD(73, 'GBP')).toBeCloseTo(100, 2); // 73 / 0.73
 expect(convertToUSD(135, 'CAD')).toBeCloseTo(100, 2); // 135 / 1.35
 expect(convertToUSD(152, 'AUD')).toBeCloseTo(100, 2); // 152 / 1.52
 });

 it('should default to USD rate for unknown currencies', () => {
 const convertToUSD = (aggregator as any).convertToUSD.bind(aggregator);

 expect(convertToUSD(100, 'UNKNOWN')).toBe(100); // Default to 1.0 rate
 });
 });

 describe('Trend Calculation', () => {
 it('should calculate trends correctly', async () => {
 const calculateTrend = (aggregator as any).calculateTrend.bind(aggregator);
 const startDate = new Date('2024-01-15');
 const endDate = new Date('2024-01-31');

 // Mock current period costs
 mockPrisma.serviceCost.findMany
 .mockResolvedValueOnce([
 { cost: 100, currency: 'USD' },
 { cost: 110, currency: 'USD' },
 ])
 .mockResolvedValueOnce([
 { cost: 80, currency: 'USD' },
 { cost: 90, currency: 'USD' },
 ]);

 const trend = await calculateTrend('service-1', startDate, endDate);

 expect(trend.current).toBe(210); // 100 + 110
 expect(trend.previous).toBe(170); // 80 + 90
 expect(trend.change).toBe(40); // 210 - 170
 expect(trend.changePercent).toBeCloseTo(23.53, 2); // (40/170) * 100
 });

 it('should handle zero previous period costs', async () => {
 const calculateTrend = (aggregator as any).calculateTrend.bind(aggregator);
 const startDate = new Date('2024-01-15');
 const endDate = new Date('2024-01-31');

 mockPrisma.serviceCost.findMany
 .mockResolvedValueOnce([{ cost: 100, currency: 'USD' }])
 .mockResolvedValueOnce([]); // No previous costs

 const trend = await calculateTrend('service-1', startDate, endDate);

 expect(trend.current).toBe(100);
 expect(trend.previous).toBe(0);
 expect(trend.change).toBe(100);
 expect(trend.changePercent).toBe(0); // Should handle division by zero
 });
 });

 describe('Daily and Monthly Trends', () => {
 it('should calculate daily trends correctly', () => {
 const calculateDailyTrends = (aggregator as any).calculateDailyTrends.bind(aggregator);
 
 const mockCosts = [
 { date: new Date('2024-01-01'), cost: 100, currency: 'USD', provider: 'aws' },
 { date: new Date('2024-01-01'), cost: 50, currency: 'USD', provider: 'azure' },
 { date: new Date('2024-01-02'), cost: 110, currency: 'USD', provider: 'aws' },
 ];

 const trends = calculateDailyTrends(mockCosts);

 expect(trends).toHaveLength(2);
 expect(trends[0].date).toEqual(new Date('2024-01-01'));
 expect(trends[0].totalCost).toBe(150); // 100 + 50
 expect(trends[0].aws).toBe(100);
 expect(trends[0].azure).toBe(50);
 expect(trends[0].gcp).toBe(0);

 expect(trends[1].date).toEqual(new Date('2024-01-02'));
 expect(trends[1].totalCost).toBe(110);
 expect(trends[1].aws).toBe(110);
 });

 it('should calculate monthly trends correctly', () => {
 const calculateMonthlyTrends = (aggregator as any).calculateMonthlyTrends.bind(aggregator);
 
 const mockCosts = [
 { date: new Date('2024-01-01'), cost: 100, currency: 'USD', provider: 'aws' },
 { date: new Date('2024-01-15'), cost: 50, currency: 'USD', provider: 'azure' },
 { date: new Date('2024-02-01'), cost: 110, currency: 'USD', provider: 'aws' },
 ];

 const trends = calculateMonthlyTrends(mockCosts);

 expect(trends).toHaveLength(2);
 expect(trends[0].month).toBe('2024-01');
 expect(trends[0].totalCost).toBe(150); // 100 + 50
 expect(trends[1].month).toBe('2024-02');
 expect(trends[1].totalCost).toBe(110);
 });
 });

 describe('Error Handling', () => {
 it('should handle database errors in getAggregatedCosts', async () => {
 const startDate = new Date('2024-01-01');
 const endDate = new Date('2024-01-31');

 mockPrisma.serviceCost.findMany.mockRejectedValue(new Error('Database error'));

 await expect(aggregator.getAggregatedCosts(startDate, endDate))
 .rejects.toThrow('Database error');
 });

 it('should handle database errors in getCostSummary', async () => {
 const startDate = new Date('2024-01-01');
 const endDate = new Date('2024-01-31');

 mockPrisma.serviceCost.findMany.mockRejectedValue(new Error('Database error'));

 await expect(aggregator.getCostSummary(startDate, endDate))
 .rejects.toThrow('Database error');
 });

 it('should handle recommendation fetch errors gracefully', async () => {
 const getServiceRecommendations = (aggregator as any).getServiceRecommendations.bind(aggregator);

 mockAWSProvider.getCostRecommendations.mockRejectedValue(new Error('AWS Error'));
 mockAzureProvider.getCostRecommendations.mockResolvedValue([]);
 mockGCPProvider.getCostRecommendations.mockResolvedValue([]);

 const recommendations = await getServiceRecommendations('service-1');

 expect(recommendations).toEqual([]);
 });
 });
});