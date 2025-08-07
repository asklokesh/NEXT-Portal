import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock Azure SDK modules before importing the provider
jest.mock('@azure/arm-consumption');
jest.mock('@azure/arm-costmanagement');
jest.mock('@azure/identity');

import { CostDataType } from '../../types';

// Simple mock implementations
const mockConsumptionClient = {
 usageDetails: {
 list: jest.fn(),
 },
 budgets: {
 list: jest.fn(),
 },
 marketplaces: {
 list: jest.fn(),
 },
 reservationRecommendations: {
 list: jest.fn(),
 },
};

const mockCostManagementClient = {
 query: {
 usage: jest.fn(),
 },
 forecasts: {
 usage: jest.fn(),
 },
};

// Mock the actual modules
jest.mocked(require('@azure/arm-consumption')).ConsumptionManagementClient = jest.fn(() => mockConsumptionClient);
jest.mocked(require('@azure/arm-costmanagement')).CostManagementClient = jest.fn(() => mockCostManagementClient);
jest.mocked(require('@azure/identity')).ClientSecretCredential = jest.fn(() => ({}));

import { AzureCostProvider } from '../azure';

describe('AzureCostProvider', () => {
 let provider: AzureCostProvider;

 beforeEach(() => {
 jest.clearAllMocks();
 
 provider = new AzureCostProvider({
 subscriptionId: 'test-subscription-id',
 tenantId: 'test-tenant-id',
 clientId: 'test-client-id',
 clientSecret: 'test-client-secret',
 });
 });

 describe('getDailyCosts', () => {
 it('should fetch daily costs using Cost Management API', async () => {
 const mockResponse = {
 properties: {
 rows: [
 ['2024-01-01', 100.50, 'USD'],
 ['2024-01-02', 120.75, 'USD'],
 ],
 columns: [
 { name: 'UsageDate', type: 'datetime' },
 { name: 'Cost', type: 'number' },
 { name: 'Currency', type: 'string' },
 ],
 },
 };

 mockCostManagementClient.query.usage.mockResolvedValueOnce(mockResponse);

 const startDate = new Date('2024-01-01');
 const endDate = new Date('2024-01-03');
 const result = await provider.getDailyCosts(startDate, endDate);

 expect(result).toHaveLength(2);
 expect(result[0]).toEqual({
 date: new Date('2024-01-01'),
 cost: 100.50,
 currency: 'USD',
 type: CostDataType.DAILY,
 provider: 'azure',
 service: 'Total',
 });

 expect(mockCostManagementClient.query.usage).toHaveBeenCalledWith(
 'subscriptions/test-subscription-id',
 expect.objectContaining({
 type: 'ActualCost',
 timeframe: 'Custom',
 timePeriod: {
 from: startDate,
 to: endDate,
 },
 dataset: expect.objectContaining({
 granularity: 'Daily',
 }),
 })
 );
 });

 it('should handle empty cost data', async () => {
 mockCostManagementClient.query.usage.mockResolvedValueOnce({
 properties: {
 rows: [],
 columns: [],
 },
 });

 const result = await provider.getDailyCosts(new Date('2024-01-01'), new Date('2024-01-03'));

 expect(result).toHaveLength(0);
 });

 it('should handle API errors', async () => {
 mockCostManagementClient.query.usage.mockRejectedValueOnce(new Error('Azure API Error'));

 await expect(provider.getDailyCosts(new Date('2024-01-01'), new Date('2024-01-03')))
 .rejects.toThrow('Azure API Error');
 });
 });

 describe('getServiceCosts', () => {
 it('should fetch costs grouped by service', async () => {
 const mockResponse = {
 properties: {
 rows: [
 ['Virtual Machines', 150.00, 'USD', '2024-01-01'],
 ['Storage', 50.00, 'USD', '2024-01-01'],
 ['SQL Database', 75.00, 'USD', '2024-01-01'],
 ],
 columns: [
 { name: 'ServiceName', type: 'string' },
 { name: 'Cost', type: 'number' },
 { name: 'Currency', type: 'string' },
 { name: 'UsageDate', type: 'datetime' },
 ],
 },
 };

 mockCostManagementClient.query.usage.mockResolvedValueOnce(mockResponse);

 const result = await provider.getServiceCosts(new Date('2024-01-01'), new Date('2024-01-02'));

 expect(result).toHaveLength(3);
 expect(result[0]).toEqual(expect.objectContaining({
 service: 'Virtual Machines',
 cost: 150.00,
 currency: 'USD',
 }));
 });
 });

 describe('getCostForecast', () => {
 it('should fetch cost forecast', async () => {
 const mockResponse = {
 properties: {
 rows: [
 ['2024-02-01', 110.00, 'USD', 85.00, 135.00],
 ['2024-02-02', 115.00, 'USD', 90.00, 140.00],
 ],
 columns: [
 { name: 'Date', type: 'datetime' },
 { name: 'ForecastCost', type: 'number' },
 { name: 'Currency', type: 'string' },
 { name: 'ConfidenceLowerBound', type: 'number' },
 { name: 'ConfidenceUpperBound', type: 'number' },
 ],
 },
 };

 mockCostManagementClient.forecasts.usage.mockResolvedValueOnce(mockResponse);

 const result = await provider.getCostForecast(
 new Date('2024-02-01'),
 new Date('2024-02-28')
 );

 expect(result).toEqual({
 totalAmount: 225.00,
 currency: 'USD',
 forecasts: expect.arrayContaining([
 expect.objectContaining({
 date: new Date('2024-02-01'),
 amount: 110.00,
 confidenceLowerBound: 85.00,
 confidenceUpperBound: 135.00,
 }),
 ]),
 });
 });
 });

 describe('getBudgets', () => {
 it('should fetch budget information', async () => {
 const mockBudgets = {
 value: [
 {
 name: 'monthly-budget',
 properties: {
 amount: 5000,
 timeGrain: 'Monthly',
 currentSpend: {
 amount: 3500,
 unit: 'USD',
 },
 notifications: {
 actual_GreaterThan_80_Percent: {
 enabled: true,
 operator: 'GreaterThan',
 threshold: 80,
 contactEmails: ['admin@example.com'],
 },
 },
 },
 },
 ],
 };

 const mockAsyncIterator = {
 async *[Symbol.asyncIterator]() {
 yield mockBudgets;
 },
 };

 mockConsumptionClient.budgets.list.mockReturnValueOnce(mockAsyncIterator);

 const result = await provider.getBudgets();

 expect(result).toHaveLength(1);
 expect(result[0]).toEqual(expect.objectContaining({
 name: 'monthly-budget',
 amount: 5000,
 spent: 3500,
 currency: 'USD',
 percentage: 70,
 timeGrain: 'Monthly',
 }));
 });
 });
});