/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { prisma } from '../../db/client';

// Dynamic imports for AWS SDK to reduce bundle size
let CostExplorerClient: any;
let GetCostAndUsageCommand: any;
let GetDimensionValuesCommand: any;

const loadAwsSdk = async () => {
 if (!CostExplorerClient) {
 const awsSdk = await import('@aws-sdk/client-cost-explorer');
 CostExplorerClient = awsSdk.CostExplorerClient;
 GetCostAndUsageCommand = awsSdk.GetCostAndUsageCommand;
 GetDimensionValuesCommand = awsSdk.GetDimensionValuesCommand;
 }
};

export interface AWSCostConfig {
 accessKeyId: string;
 secretAccessKey: string;
 region: string;
}

export interface CostData {
 serviceId: string;
 provider: string;
 region?: string;
 account?: string;
 service: string;
 resource?: string;
 cost: number;
 currency: string;
 period: string;
 date: Date;
 tags?: Record<string, any>;
}

export class AWSCostProvider {
 private client: any;
 private config: AWSCostConfig;
 private initialized = false;

 constructor(config: AWSCostConfig) {
 this.config = config;
 }

 private async initialize() {
 if (!this.initialized) {
 await loadAwsSdk();
 this.client = new CostExplorerClient({
 region: this.config.region,
 credentials: {
 accessKeyId: this.config.accessKeyId,
 secretAccessKey: this.config.secretAccessKey,
 },
 });
 this.initialized = true;
 }
 }

 /**
 * Get daily cost and usage data for the last 30 days
 */
 async getDailyCosts(startDate: Date, endDate: Date): Promise<CostData[]> {
 await this.initialize();
 try {
 const command = new GetCostAndUsageCommand({
 TimePeriod: {
 Start: startDate.toISOString().split('T')[0],
 End: endDate.toISOString().split('T')[0],
 },
 Granularity: 'DAILY',
 Metrics: ['BlendedCost', 'UsageQuantity'],
 GroupBy: [
 {
 Type: 'DIMENSION',
 Key: 'SERVICE',
 },
 {
 Type: 'DIMENSION',
 Key: 'REGION',
 },
 ],
 });

 const response = await this.client.send(command);
 const costData: CostData[] = [];

 if (response.ResultsByTime) {
 for (const result of response.ResultsByTime) {
 const date = new Date(result.TimePeriod?.Start || '');
 
 if (result.Groups) {
 for (const group of result.Groups) {
 const [service, region] = group.Keys || [];
 const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');
 
 if (cost > 0) {
 costData.push({
 serviceId: this.mapAWSServiceToServiceId(service),
 provider: 'aws',
 region,
 service,
 cost,
 currency: group.Metrics?.BlendedCost?.Unit || 'USD',
 period: 'daily',
 date,
 });
 }
 }
 }
 }
 }

 return costData;
 } catch (error) {
 console.error('Failed to fetch AWS costs:', error);
 throw error;
 }
 }

 /**
 * Get monthly cost data
 */
 async getMonthlyCosts(startDate: Date, endDate: Date): Promise<CostData[]> {
 await this.initialize();
 try {
 const command = new GetCostAndUsageCommand({
 TimePeriod: {
 Start: startDate.toISOString().split('T')[0],
 End: endDate.toISOString().split('T')[0],
 },
 Granularity: 'MONTHLY',
 Metrics: ['BlendedCost', 'UsageQuantity'],
 GroupBy: [
 {
 Type: 'DIMENSION',
 Key: 'SERVICE',
 },
 {
 Type: 'DIMENSION',
 Key: 'REGION',
 },
 ],
 });

 const response = await this.client.send(command);
 const costData: CostData[] = [];

 if (response.ResultsByTime) {
 for (const result of response.ResultsByTime) {
 const date = new Date(result.TimePeriod?.Start || '');
 
 if (result.Groups) {
 for (const group of result.Groups) {
 const [service, region] = group.Keys || [];
 const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');
 
 if (cost > 0) {
 costData.push({
 serviceId: this.mapAWSServiceToServiceId(service),
 provider: 'aws',
 region,
 service,
 cost,
 currency: group.Metrics?.BlendedCost?.Unit || 'USD',
 period: 'monthly',
 date,
 });
 }
 }
 }
 }
 }

 return costData;
 } catch (error) {
 console.error('Failed to fetch AWS monthly costs:', error);
 throw error;
 }
 }

 /**
 * Get costs by tags (for service attribution)
 */
 async getCostsByTags(startDate: Date, endDate: Date, tagKey: string): Promise<CostData[]> {
 await this.initialize();
 try {
 const command = new GetCostAndUsageCommand({
 TimePeriod: {
 Start: startDate.toISOString().split('T')[0],
 End: endDate.toISOString().split('T')[0],
 },
 Granularity: 'DAILY',
 Metrics: ['BlendedCost'],
 GroupBy: [
 {
 Type: 'TAG',
 Key: tagKey,
 },
 {
 Type: 'DIMENSION',
 Key: 'SERVICE',
 },
 ],
 });

 const response = await this.client.send(command);
 const costData: CostData[] = [];

 if (response.ResultsByTime) {
 for (const result of response.ResultsByTime) {
 const date = new Date(result.TimePeriod?.Start || '');
 
 if (result.Groups) {
 for (const group of result.Groups) {
 const [tagValue, service] = group.Keys || [];
 const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');
 
 if (cost > 0 && tagValue !== 'No tag$') {
 costData.push({
 serviceId: tagValue, // Use tag value as service ID
 provider: 'aws',
 service,
 cost,
 currency: group.Metrics?.BlendedCost?.Unit || 'USD',
 period: 'daily',
 date,
 tags: { [tagKey]: tagValue },
 });
 }
 }
 }
 }
 }

 return costData;
 } catch (error) {
 console.error('Failed to fetch AWS costs by tags:', error);
 throw error;
 }
 }

 /**
 * Get available AWS services
 */
 async getAvailableServices(): Promise<string[]> {
 await this.initialize();
 try {
 const command = new GetDimensionValuesCommand({
 TimePeriod: {
 Start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
 End: new Date().toISOString().split('T')[0],
 },
 Dimension: 'SERVICE',
 });

 const response = await this.client.send(command);
 return response.DimensionValues?.map(dv => dv.Value || '') || [];
 } catch (error) {
 console.error('Failed to fetch AWS services:', error);
 return [];
 }
 }

 /**
 * Sync cost data to database
 */
 async syncCostsToDatabase(costData: CostData[]): Promise<void> {
 try {
 for (const cost of costData) {
 await prisma.serviceCost.upsert({
 where: {
 serviceId_provider_service_date: {
 serviceId: cost.serviceId,
 provider: cost.provider,
 service: cost.service,
 date: cost.date,
 },
 },
 update: {
 cost: cost.cost,
 currency: cost.currency,
 region: cost.region,
 account: cost.account,
 resource: cost.resource,
 period: cost.period,
 tags: cost.tags,
 },
 create: {
 serviceId: cost.serviceId,
 provider: cost.provider,
 region: cost.region,
 account: cost.account,
 service: cost.service,
 resource: cost.resource,
 cost: cost.cost,
 currency: cost.currency,
 period: cost.period,
 date: cost.date,
 tags: cost.tags,
 },
 });
 }

 console.log(`Synced ${costData.length} AWS cost records to database`);
 } catch (error) {
 console.error('Failed to sync AWS costs to database:', error);
 throw error;
 }
 }

 /**
 * Map AWS service names to our service IDs
 * This would be configurable in a real implementation
 */
 private mapAWSServiceToServiceId(awsService: string): string {
 const serviceMapping: Record<string, string> = {
 'Amazon Elastic Compute Cloud - Compute': 'compute-service',
 'Amazon Simple Storage Service': 'storage-service',
 'Amazon Relational Database Service': 'database-service',
 'Amazon CloudFront': 'cdn-service',
 'AWS Lambda': 'lambda-service',
 'Amazon API Gateway': 'api-gateway-service',
 'Amazon Elastic Container Service': 'container-service',
 'Amazon Elastic Kubernetes Service': 'kubernetes-service',
 };

 return serviceMapping[awsService] || awsService.toLowerCase().replace(/\s+/g, '-');
 }

 /**
 * Get cost recommendations
 */
 async getCostRecommendations(): Promise<Array<{
 serviceId: string;
 type: string;
 description: string;
 estimatedSavings: number;
 effort: string;
 impact: string;
 }>> {
 try {
 // This would integrate with AWS Cost Anomaly Detection and Trusted Advisor
 // For now, we'll analyze cost patterns in our database
 const recentCosts = await prisma.serviceCost.findMany({
 where: {
 provider: 'aws',
 date: {
 gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
 },
 },
 orderBy: {
 cost: 'desc',
 },
 take: 10,
 });

 const recommendations = [];

 for (const cost of recentCosts) {
 // Example recommendation logic
 if (cost.cost > 100 && cost.service.includes('Compute')) {
 recommendations.push({
 serviceId: cost.serviceId,
 type: 'rightsize',
 description: `Consider rightsizing ${cost.service} instances to reduce costs`,
 estimatedSavings: cost.cost * 0.3, // 30% potential savings
 effort: 'medium',
 impact: 'high',
 });
 }

 if (cost.service.includes('Storage') && cost.cost > 50) {
 recommendations.push({
 serviceId: cost.serviceId,
 type: 'optimization',
 description: `Implement lifecycle policies for ${cost.service} to reduce storage costs`,
 estimatedSavings: cost.cost * 0.2, // 20% potential savings
 effort: 'low',
 impact: 'medium',
 });
 }
 }

 return recommendations;
 } catch (error) {
 console.error('Failed to get cost recommendations:', error);
 return [];
 }
 }
}

// Create singleton instance lazily
let _awsCostProvider: AWSCostProvider | null = null;

export function getAwsCostProvider(): AWSCostProvider {
 if (!_awsCostProvider) {
 _awsCostProvider = new AWSCostProvider({
 accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
 secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
 region: process.env.AWS_REGION || 'us-east-1',
 });
 }
 return _awsCostProvider;
}