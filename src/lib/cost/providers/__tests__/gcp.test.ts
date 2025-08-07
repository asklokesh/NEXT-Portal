import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock Google Cloud SDK before imports
jest.mock('@google-cloud/bigquery');
jest.mock('@google-cloud/billing');
jest.mock('@google-cloud/recommender');

import { CostDataType } from '../../types';

// Simple mock implementations
const mockBigQueryClient = {
 query: jest.fn(),
 dataset: jest.fn().mockReturnValue({
 table: jest.fn().mockReturnValue({
 insert: jest.fn(),
 }),
 }),
};

const mockBillingClient = {
 listProjectBillingInfo: jest.fn(),
 listServices: jest.fn(),
 listSkus: jest.fn(),
};

const mockRecommenderClient = {
 listRecommendations: jest.fn(),
};

// Mock the actual modules
jest.mocked(require('@google-cloud/bigquery')).BigQuery = jest.fn(() => mockBigQueryClient);
jest.mocked(require('@google-cloud/billing')).CloudBillingClient = jest.fn(() => mockBillingClient);
jest.mocked(require('@google-cloud/recommender')).RecommenderClient = jest.fn(() => mockRecommenderClient);

import { GCPCostProvider } from '../gcp';

describe('GCPCostProvider', () => {
 let provider: GCPCostProvider;

 beforeEach(() => {
 jest.clearAllMocks();
 
 provider = new GCPCostProvider({
 projectId: 'test-project-id',
 clientEmail: 'test@example.com',
 privateKey: 'test-private-key',
 billingAccountId: 'test-billing-account',
 });
 });

 describe('getDailyCosts', () => {
 it('should fetch daily costs from BigQuery', async () => {
 const mockQueryResponse = [
 {
 usage_date: '2024-01-01',
 total_cost: 100.50,
 currency: 'USD',
 },
 {
 usage_date: '2024-01-02',
 total_cost: 120.75,
 currency: 'USD',
 },
 ];

 mockBigQueryClient.query.mockResolvedValueOnce([mockQueryResponse]);

 const startDate = new Date('2024-01-01');
 const endDate = new Date('2024-01-03');
 const result = await provider.getDailyCosts(startDate, endDate);

 expect(result).toHaveLength(2);
 expect(result[0]).toEqual({
 date: new Date('2024-01-01'),
 cost: 100.50,
 currency: 'USD',
 type: CostDataType.DAILY,
 provider: 'gcp',
 service: 'Total',
 });

 expect(mockBigQueryClient.query).toHaveBeenCalledWith({
 query: expect.stringContaining('SELECT'),
 params: {
 start_date: '2024-01-01',
 end_date: '2024-01-03',
 },
 });
 });

 it('should handle empty cost data', async () => {
 mockBigQueryClient.query.mockResolvedValueOnce([[]]);

 const result = await provider.getDailyCosts(new Date('2024-01-01'), new Date('2024-01-03'));

 expect(result).toHaveLength(0);
 });

 it('should handle BigQuery errors', async () => {
 mockBigQueryClient.query.mockRejectedValueOnce(new Error('BigQuery error'));

 await expect(provider.getDailyCosts(new Date('2024-01-01'), new Date('2024-01-03')))
 .rejects.toThrow('BigQuery error');
 });
 });

 describe('getServiceCosts', () => {
 it('should fetch costs grouped by service', async () => {
 const mockQueryResponse = [
 {
 service_description: 'Compute Engine',
 total_cost: 150.00,
 currency: 'USD',
 usage_date: '2024-01-01',
 },
 {
 service_description: 'Cloud Storage',
 total_cost: 50.00,
 currency: 'USD',
 usage_date: '2024-01-01',
 },
 {
 service_description: 'BigQuery',
 total_cost: 75.00,
 currency: 'USD',
 usage_date: '2024-01-01',
 },
 ];

 mockBigQueryClient.query.mockResolvedValueOnce([mockQueryResponse]);

 const result = await provider.getServiceCosts(new Date('2024-01-01'), new Date('2024-01-02'));

 expect(result).toHaveLength(3);
 expect(result[0]).toEqual(expect.objectContaining({
 service: 'Compute Engine',
 cost: 150.00,
 currency: 'USD',
 }));

 expect(mockBigQueryClient.query).toHaveBeenCalledWith({
 query: expect.stringContaining('GROUP BY service.description'),
 params: expect.any(Object),
 });
 });
 });

 describe('getProjectCosts', () => {
 it('should fetch costs grouped by project', async () => {
 const mockQueryResponse = [
 {
 project_id: 'project-prod',
 project_name: 'Production',
 total_cost: 200.00,
 currency: 'USD',
 usage_date: '2024-01-01',
 },
 {
 project_id: 'project-dev',
 project_name: 'Development',
 total_cost: 80.00,
 currency: 'USD',
 usage_date: '2024-01-01',
 },
 ];

 mockBigQueryClient.query.mockResolvedValueOnce([mockQueryResponse]);

 const result = await provider.getProjectCosts(new Date('2024-01-01'), new Date('2024-01-02'));

 expect(result).toHaveLength(2);
 expect(result[0]).toEqual(expect.objectContaining({
 projectId: 'project-prod',
 projectName: 'Production',
 cost: 200.00,
 currency: 'USD',
 }));
 });
 });

 describe('getLabeledCosts', () => {
 it('should fetch costs grouped by labels', async () => {
 const mockQueryResponse = [
 {
 label_key: 'environment',
 label_value: 'production',
 total_cost: 175.00,
 currency: 'USD',
 usage_date: '2024-01-01',
 },
 {
 label_key: 'environment',
 label_value: 'development',
 total_cost: 75.00,
 currency: 'USD',
 usage_date: '2024-01-01',
 },
 ];

 mockBigQueryClient.query.mockResolvedValueOnce([mockQueryResponse]);

 const result = await provider.getLabeledCosts(
 new Date('2024-01-01'),
 new Date('2024-01-02'),
 'environment'
 );

 expect(result).toHaveLength(2);
 expect(result[0]).toEqual(expect.objectContaining({
 labels: { environment: 'production' },
 cost: 175.00,
 }));

 expect(mockBigQueryClient.query).toHaveBeenCalledWith({
 query: expect.stringContaining('WHERE label.key = @label_key'),
 params: expect.objectContaining({
 label_key: 'environment',
 }),
 });
 });
 });

 describe('getCostForecast', () => {
 it('should generate cost forecast based on historical data', async () => {
 const mockHistoricalData = [
 { usage_date: '2024-01-01', total_cost: 100 },
 { usage_date: '2024-01-02', total_cost: 110 },
 { usage_date: '2024-01-03', total_cost: 105 },
 { usage_date: '2024-01-04', total_cost: 115 },
 { usage_date: '2024-01-05', total_cost: 120 },
 ];

 mockBigQueryClient.query.mockResolvedValueOnce([mockHistoricalData]);

 const result = await provider.getCostForecast(
 new Date('2024-02-01'),
 new Date('2024-02-05')
 );

 expect(result).toHaveProperty('totalAmount');
 expect(result).toHaveProperty('currency', 'USD');
 expect(result).toHaveProperty('forecasts');
 expect(result.forecasts).toHaveLength(5);
 expect(result.forecasts[0]).toHaveProperty('date');
 expect(result.forecasts[0]).toHaveProperty('amount');
 
 // Check that forecast is based on trend
 const avgCost = mockHistoricalData.reduce((sum, d) => sum + d.total_cost, 0) / mockHistoricalData.length;
 expect(result.forecasts[0].amount).toBeGreaterThan(avgCost * 0.8);
 expect(result.forecasts[0].amount).toBeLessThan(avgCost * 1.5);
 });
 });

 describe('getRecommendations', () => {
 it('should fetch cost optimization recommendations', async () => {
 const mockRecommendations = [
 {
 name: 'projects/test-project/locations/us-central1/recommenders/google.compute.instance.MachineTypeRecommender/recommendations/123',
 primaryImpact: {
 category: 'COST',
 costProjection: {
 cost: {
 currencyCode: 'USD',
 units: '-50',
 },
 },
 },
 description: 'Resize instance to save costs',
 stateInfo: {
 state: 'ACTIVE',
 },
 content: {
 operationGroups: [{
 operations: [{
 action: 'test',
 resourceType: 'compute.googleapis.com/Instance',
 resource: 'projects/test-project/zones/us-central1-a/instances/test-instance',
 }],
 }],
 },
 },
 ];

 mockRecommenderClient.listRecommendations.mockResolvedValueOnce([mockRecommendations]);

 const result = await provider.getRecommendations();

 expect(result).toHaveLength(1);
 expect(result[0]).toEqual(expect.objectContaining({
 id: '123',
 type: 'google.compute.instance.MachineTypeRecommender',
 description: 'Resize instance to save costs',
 savingsAmount: 50,
 savingsCurrency: 'USD',
 resourceType: 'compute.googleapis.com/Instance',
 resource: 'projects/test-project/zones/us-central1-a/instances/test-instance',
 }));
 });

 it('should handle multiple recommendation types', async () => {
 const mockRecommendations = [
 {
 name: 'projects/test/locations/global/recommenders/google.compute.commitment.UsageCommitmentRecommender/recommendations/456',
 primaryImpact: {
 category: 'COST',
 costProjection: {
 cost: {
 currencyCode: 'USD',
 units: '-100',
 },
 },
 },
 description: 'Purchase committed use discount',
 stateInfo: { state: 'ACTIVE' },
 content: { operationGroups: [] },
 },
 ];

 mockRecommenderClient.listRecommendations.mockResolvedValueOnce([mockRecommendations]);

 const result = await provider.getRecommendations();

 expect(result[0].type).toBe('google.compute.commitment.UsageCommitmentRecommender');
 expect(result[0].savingsAmount).toBe(100);
 });
 });

 describe('exportCostData', () => {
 it('should export cost data to BigQuery table', async () => {
 const mockCostData = [
 {
 date: new Date('2024-01-01'),
 cost: 100.50,
 service: 'Compute Engine',
 currency: 'USD',
 },
 ];

 const mockTableInsert = jest.fn().mockResolvedValueOnce([{}]);
 mockBigQueryClient.dataset.mockReturnValue({
 table: jest.fn().mockReturnValue({
 insert: mockTableInsert,
 }),
 });

 await provider.exportCostData(mockCostData, 'cost_export');

 expect(mockBigQueryClient.dataset).toHaveBeenCalledWith('billing_export');
 expect(mockTableInsert).toHaveBeenCalledWith(
 expect.arrayContaining([
 expect.objectContaining({
 date: '2024-01-01',
 cost: 100.50,
 service: 'Compute Engine',
 currency: 'USD',
 }),
 ])
 );
 });
 });

 describe('Error Handling', () => {
 it('should handle authentication errors', async () => {
 const authError = new Error('Invalid credentials');
 authError.message = 'Request had invalid authentication credentials';
 
 mockBigQueryClient.query.mockRejectedValueOnce(authError);

 await expect(provider.getDailyCosts(new Date('2024-01-01'), new Date('2024-01-03')))
 .rejects.toThrow('Invalid credentials');
 });

 it('should handle permission errors', async () => {
 const permissionError = new Error('Permission denied');
 (permissionError as any).code = 403;
 
 mockBigQueryClient.query.mockRejectedValueOnce(permissionError);

 await expect(provider.getDailyCosts(new Date('2024-01-01'), new Date('2024-01-03')))
 .rejects.toThrow('Permission denied');
 });

 it('should handle quota exceeded errors', async () => {
 const quotaError = new Error('Quota exceeded');
 (quotaError as any).code = 429;
 
 mockBigQueryClient.query.mockRejectedValueOnce(quotaError);

 await expect(provider.getDailyCosts(new Date('2024-01-01'), new Date('2024-01-03')))
 .rejects.toThrow('Quota exceeded');
 });
 });
});