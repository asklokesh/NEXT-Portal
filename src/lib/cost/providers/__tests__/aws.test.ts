import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock AWS SDK before imports
jest.mock('@aws-sdk/client-cost-explorer');
jest.mock('@aws-sdk/client-organizations');

import { CostDataType } from '../../types';

// Simple mock implementations
const mockCostExplorerClient = {
 send: jest.fn(),
};

const mockOrganizationsClient = {
 send: jest.fn(),
};

// Mock the actual modules
jest.mocked(require('@aws-sdk/client-cost-explorer')).CostExplorerClient = jest.fn(() => mockCostExplorerClient);
jest.mocked(require('@aws-sdk/client-cost-explorer')).GetCostAndUsageCommand = jest.fn();
jest.mocked(require('@aws-sdk/client-cost-explorer')).GetCostForecastCommand = jest.fn();
jest.mocked(require('@aws-sdk/client-cost-explorer')).GetReservationUtilizationCommand = jest.fn();
jest.mocked(require('@aws-sdk/client-cost-explorer')).GetSavingsPlansPurchaseRecommendationCommand = jest.fn();

jest.mocked(require('@aws-sdk/client-organizations')).OrganizationsClient = jest.fn(() => mockOrganizationsClient);
jest.mocked(require('@aws-sdk/client-organizations')).ListAccountsCommand = jest.fn();

import { AWSCostProvider } from '../aws';

describe('AWSCostProvider', () => {
 let provider: AWSCostProvider;

 beforeEach(() => {
 jest.clearAllMocks();
 
 provider = new AWSCostProvider({
 region: 'us-east-1',
 credentials: {
 accessKeyId: 'test-access-key',
 secretAccessKey: 'test-secret-key',
 },
 });
 });

 describe('getDailyCosts', () => {
 it('should fetch daily costs', async () => {
 const mockResponse = {
 ResultsByTime: [
 {
 TimePeriod: { Start: '2024-01-01', End: '2024-01-02' },
 Total: {
 BlendedCost: { Amount: '100.50', Unit: 'USD' },
 UsageQuantity: { Amount: '1000', Unit: 'Hours' },
 },
 Groups: [],
 },
 {
 TimePeriod: { Start: '2024-01-02', End: '2024-01-03' },
 Total: {
 BlendedCost: { Amount: '120.75', Unit: 'USD' },
 UsageQuantity: { Amount: '1200', Unit: 'Hours' },
 },
 Groups: [],
 },
 ],
 };

 mockCostExplorerClient.send.mockResolvedValueOnce(mockResponse);

 const startDate = new Date('2024-01-01');
 const endDate = new Date('2024-01-03');
 const result = await provider.getDailyCosts(startDate, endDate);

 expect(result).toHaveLength(2);
 expect(result[0]).toEqual({
 date: new Date('2024-01-01'),
 cost: 100.50,
 currency: 'USD',
 type: CostDataType.DAILY,
 provider: 'aws',
 service: 'Total',
 resourceId: undefined,
 usage: 1000,
 usageUnit: 'Hours',
 });

 expect(mockCostExplorerClient.send).toHaveBeenCalledTimes(1);
 });

 it('should handle empty cost data', async () => {
 mockCostExplorerClient.send.mockResolvedValueOnce({
 ResultsByTime: [],
 });

 const result = await provider.getDailyCosts(new Date('2024-01-01'), new Date('2024-01-03'));

 expect(result).toHaveLength(0);
 });

 it('should handle API errors', async () => {
 mockCostExplorerClient.send.mockRejectedValueOnce(new Error('AWS API Error'));

 await expect(provider.getDailyCosts(new Date('2024-01-01'), new Date('2024-01-03')))
 .rejects.toThrow('AWS API Error');
 });
 });

 describe('getServiceCosts', () => {
 it('should fetch costs grouped by service', async () => {
 const mockResponse = {
 ResultsByTime: [{
 TimePeriod: { Start: '2024-01-01', End: '2024-01-02' },
 Groups: [
 {
 Keys: ['Amazon EC2'],
 Metrics: {
 BlendedCost: { Amount: '50.00', Unit: 'USD' },
 UsageQuantity: { Amount: '500', Unit: 'Hours' },
 },
 },
 {
 Keys: ['Amazon S3'],
 Metrics: {
 BlendedCost: { Amount: '25.00', Unit: 'USD' },
 UsageQuantity: { Amount: '1000', Unit: 'GB' },
 },
 },
 ],
 }],
 };

 mockCostExplorerClient.send.mockResolvedValueOnce(mockResponse);

 const result = await provider.getServiceCosts(new Date('2024-01-01'), new Date('2024-01-02'));

 expect(result).toHaveLength(2);
 expect(result[0].service).toBe('Amazon EC2');
 expect(result[0].cost).toBe(50.00);
 expect(result[1].service).toBe('Amazon S3');
 expect(result[1].cost).toBe(25.00);
 });
 });

 describe('getTaggedCosts', () => {
 it('should fetch costs grouped by tags', async () => {
 const mockResponse = {
 ResultsByTime: [{
 TimePeriod: { Start: '2024-01-01', End: '2024-01-02' },
 Groups: [
 {
 Keys: ['Production'],
 Metrics: {
 BlendedCost: { Amount: '75.00', Unit: 'USD' },
 UsageQuantity: { Amount: '750', Unit: 'Hours' },
 },
 },
 {
 Keys: ['Development'],
 Metrics: {
 BlendedCost: { Amount: '25.00', Unit: 'USD' },
 UsageQuantity: { Amount: '250', Unit: 'Hours' },
 },
 },
 ],
 }],
 };

 mockCostExplorerClient.send.mockResolvedValueOnce(mockResponse);

 const result = await provider.getTaggedCosts(
 new Date('2024-01-01'),
 new Date('2024-01-02'),
 'Environment'
 );

 expect(result).toHaveLength(2);
 expect(result[0].tags).toEqual({ Environment: 'Production' });
 expect(result[0].cost).toBe(75.00);
 expect(result[1].tags).toEqual({ Environment: 'Development' });
 expect(result[1].cost).toBe(25.00);
 });
 });

 describe('getCostForecast', () => {
 it('should fetch cost forecast', async () => {
 const mockResponse = {
 Total: { Amount: '3000.00', Unit: 'USD' },
 ForecastResultsByTime: [
 {
 TimePeriod: { Start: '2024-02-01', End: '2024-02-02' },
 MeanValue: '100.00',
 },
 {
 TimePeriod: { Start: '2024-02-02', End: '2024-02-03' },
 MeanValue: '110.00',
 },
 ],
 };

 mockCostExplorerClient.send.mockResolvedValueOnce(mockResponse);

 const result = await provider.getCostForecast(
 new Date('2024-02-01'),
 new Date('2024-02-28')
 );

 expect(result).toEqual({
 totalAmount: 3000.00,
 currency: 'USD',
 forecasts: expect.arrayContaining([
 expect.objectContaining({
 date: new Date('2024-02-01'),
 amount: 100.00,
 }),
 expect.objectContaining({
 date: new Date('2024-02-02'),
 amount: 110.00,
 }),
 ]),
 });
 });
 });

 describe('getReservationCoverage', () => {
 it('should fetch reservation coverage', async () => {
 const mockResponse = {
 Total: {
 CoverageHours: {
 OnDemandHours: '1000',
 ReservedHours: '2000',
 TotalRunningHours: '3000',
 CoverageHoursPercentage: '66.67',
 },
 },
 CoveragesByTime: [
 {
 TimePeriod: { Start: '2024-01-01', End: '2024-01-02' },
 Groups: [],
 Total: {
 CoverageHours: {
 OnDemandHours: '500',
 ReservedHours: '1000',
 TotalRunningHours: '1500',
 CoverageHoursPercentage: '66.67',
 },
 },
 },
 ],
 };

 mockCostExplorerClient.send.mockResolvedValueOnce(mockResponse);

 const result = await provider.getReservationCoverage(
 new Date('2024-01-01'),
 new Date('2024-01-31')
 );

 expect(result).toEqual({
 coveragePercentage: 66.67,
 onDemandHours: 1000,
 reservedHours: 2000,
 totalHours: 3000,
 dailyCoverage: expect.arrayContaining([
 expect.objectContaining({
 date: new Date('2024-01-01'),
 coveragePercentage: 66.67,
 onDemandHours: 500,
 reservedHours: 1000,
 }),
 ]),
 });
 });
 });

 describe('getAccountCosts', () => {
 it('should fetch costs for multiple accounts', async () => {
 const mockAccountsResponse = {
 Accounts: [
 { Id: '123456789012', Name: 'Production Account', Status: 'ACTIVE' },
 { Id: '123456789013', Name: 'Development Account', Status: 'ACTIVE' },
 ],
 };

 const mockCostResponse = {
 ResultsByTime: [{
 TimePeriod: { Start: '2024-01-01', End: '2024-01-02' },
 Groups: [
 {
 Keys: ['123456789012'],
 Metrics: {
 BlendedCost: { Amount: '150.00', Unit: 'USD' },
 },
 },
 {
 Keys: ['123456789013'],
 Metrics: {
 BlendedCost: { Amount: '50.00', Unit: 'USD' },
 },
 },
 ],
 }],
 };

 mockOrganizationsClient.send.mockResolvedValueOnce(mockAccountsResponse);
 mockCostExplorerClient.send.mockResolvedValueOnce(mockCostResponse);

 const result = await provider.getAccountCosts(
 new Date('2024-01-01'),
 new Date('2024-01-02')
 );

 expect(result).toHaveLength(2);
 expect(result[0]).toEqual(expect.objectContaining({
 accountId: '123456789012',
 accountName: 'Production Account',
 cost: 150.00,
 }));
 expect(result[1]).toEqual(expect.objectContaining({
 accountId: '123456789013',
 accountName: 'Development Account',
 cost: 50.00,
 }));
 });
 });

 describe('Error Handling', () => {
 it('should handle rate limit errors', async () => {
 const rateLimitError = new Error('Request rate exceeded');
 (rateLimitError as any).name = 'ThrottlingException';
 
 mockCostExplorerClient.send.mockRejectedValueOnce(rateLimitError);

 await expect(provider.getDailyCosts(new Date('2024-01-01'), new Date('2024-01-03')))
 .rejects.toThrow('Request rate exceeded');
 });

 it('should handle authentication errors', async () => {
 const authError = new Error('Invalid credentials');
 (authError as any).name = 'UnauthorizedException';
 
 mockCostExplorerClient.send.mockRejectedValueOnce(authError);

 await expect(provider.getDailyCosts(new Date('2024-01-01'), new Date('2024-01-03')))
 .rejects.toThrow('Invalid credentials');
 });
 });
});