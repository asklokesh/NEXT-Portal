/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { prisma } from '../../db/client';
import type { CostData } from './aws';

// Dynamic imports for Azure SDK to reduce bundle size
let CostManagementClient: any;
let ClientSecretCredential: any;

const loadAzureSdk = async () => {
 if (!CostManagementClient) {
 const [costManagement, identity] = await Promise.all([
 import('@azure/arm-costmanagement'),
 import('@azure/identity')
 ]);
 CostManagementClient = costManagement.CostManagementClient;
 ClientSecretCredential = identity.ClientSecretCredential;
 }
};

export interface AzureCostConfig {
 clientId: string;
 clientSecret: string;
 tenantId: string;
 subscriptionId: string;
}

export class AzureCostProvider {
 private client: any;
 private subscriptionId: string;
 private config: AzureCostConfig;
 private initialized = false;

 constructor(config: AzureCostConfig) {
 this.subscriptionId = config.subscriptionId;
 this.config = config;
 }

 private async initialize() {
 if (!this.initialized) {
 await loadAzureSdk();
 
 // Skip initialization if config is missing
 if (!this.config.tenantId || !this.config.clientId || !this.config.clientSecret) {
 console.warn('Azure cost provider: Missing required configuration');
 this.client = null;
 return;
 }

 const credential = new ClientSecretCredential(
 this.config.tenantId,
 this.config.clientId,
 this.config.clientSecret
 );

 this.client = new CostManagementClient(credential);
 this.initialized = true;
 }
 }

 /**
 * Get daily cost data from Azure Cost Management API
 */
 async getDailyCosts(startDate: Date, endDate: Date): Promise<CostData[]> {
 await this.initialize();
 if (!this.client) return [];
 try {
 const scope = `/subscriptions/${this.subscriptionId}`;
 
 const queryDefinition = {
 type: 'ActualCost',
 timeframe: 'Custom',
 timePeriod: {
 from: startDate.toISOString().split('T')[0],
 to: endDate.toISOString().split('T')[0],
 },
 dataSet: {
 granularity: 'Daily',
 aggregation: {
 totalCost: {
 name: 'Cost',
 function: 'Sum',
 },
 totalUsage: {
 name: 'UsageQuantity',
 function: 'Sum',
 },
 },
 grouping: [
 {
 type: 'Dimension',
 name: 'ServiceName',
 },
 {
 type: 'Dimension',
 name: 'ResourceLocation',
 },
 ],
 sorting: [
 {
 direction: 'ascending',
 name: 'UsageDate',
 },
 ],
 },
 };

 const result = await this.client.query.usage(scope, queryDefinition);
 const costData: CostData[] = [];

 if (result.rows) {
 for (const row of result.rows) {
 // Azure Cost Management API returns rows with columns based on the query
 // Typical structure: [UsageDate, ServiceName, ResourceLocation, Cost, Currency, UsageQuantity]
 const [usageDate, serviceName, resourceLocation, cost, currency] = row;
 
 if (cost && parseFloat(cost.toString()) > 0) {
 costData.push({
 serviceId: this.mapAzureServiceToServiceId(serviceName?.toString() || ''),
 provider: 'azure',
 region: resourceLocation?.toString(),
 service: serviceName?.toString() || '',
 cost: parseFloat(cost.toString()),
 currency: currency?.toString() || 'USD',
 period: 'daily',
 date: new Date(usageDate?.toString() || ''),
 });
 }
 }
 }

 return costData;
 } catch (error) {
 console.error('Failed to fetch Azure daily costs:', error);
 throw error;
 }
 }

 /**
 * Get monthly cost data
 */
 async getMonthlyCosts(startDate: Date, endDate: Date): Promise<CostData[]> {
 try {
 const scope = `/subscriptions/${this.subscriptionId}`;
 
 const queryDefinition = {
 type: 'ActualCost',
 timeframe: 'Custom',
 timePeriod: {
 from: startDate.toISOString().split('T')[0],
 to: endDate.toISOString().split('T')[0],
 },
 dataSet: {
 granularity: 'Monthly',
 aggregation: {
 totalCost: {
 name: 'Cost',
 function: 'Sum',
 },
 },
 grouping: [
 {
 type: 'Dimension',
 name: 'ServiceName',
 },
 {
 type: 'Dimension',
 name: 'ResourceLocation',
 },
 ],
 },
 };

 const result = await this.client.query.usage(scope, queryDefinition);
 const costData: CostData[] = [];

 if (result.rows) {
 for (const row of result.rows) {
 const [usageDate, serviceName, resourceLocation, cost, currency] = row;
 
 if (cost && parseFloat(cost.toString()) > 0) {
 costData.push({
 serviceId: this.mapAzureServiceToServiceId(serviceName?.toString() || ''),
 provider: 'azure',
 region: resourceLocation?.toString(),
 service: serviceName?.toString() || '',
 cost: parseFloat(cost.toString()),
 currency: currency?.toString() || 'USD',
 period: 'monthly',
 date: new Date(usageDate?.toString() || ''),
 });
 }
 }
 }

 return costData;
 } catch (error) {
 console.error('Failed to fetch Azure monthly costs:', error);
 throw error;
 }
 }

 /**
 * Get costs by resource tags
 */
 async getCostsByTags(startDate: Date, endDate: Date, tagKey: string): Promise<CostData[]> {
 try {
 const scope = `/subscriptions/${this.subscriptionId}`;
 
 const queryDefinition = {
 type: 'ActualCost',
 timeframe: 'Custom',
 timePeriod: {
 from: startDate.toISOString().split('T')[0],
 to: endDate.toISOString().split('T')[0],
 },
 dataSet: {
 granularity: 'Daily',
 aggregation: {
 totalCost: {
 name: 'Cost',
 function: 'Sum',
 },
 },
 grouping: [
 {
 type: 'TagKey',
 name: tagKey,
 },
 {
 type: 'Dimension',
 name: 'ServiceName',
 },
 ],
 filter: {
 tags: {
 name: tagKey,
 operator: 'In',
 values: ['*'], // Get all values for this tag
 },
 },
 },
 };

 const result = await this.client.query.usage(scope, queryDefinition);
 const costData: CostData[] = [];

 if (result.rows) {
 for (const row of result.rows) {
 const [usageDate, tagValue, serviceName, cost, currency] = row;
 
 if (cost && parseFloat(cost.toString()) > 0 && tagValue) {
 costData.push({
 serviceId: tagValue.toString(), // Use tag value as service ID
 provider: 'azure',
 service: serviceName?.toString() || '',
 cost: parseFloat(cost.toString()),
 currency: currency?.toString() || 'USD',
 period: 'daily',
 date: new Date(usageDate?.toString() || ''),
 tags: { [tagKey]: tagValue.toString() },
 });
 }
 }
 }

 return costData;
 } catch (error) {
 console.error('Failed to fetch Azure costs by tags:', error);
 throw error;
 }
 }

 /**
 * Get available Azure services
 */
 async getAvailableServices(): Promise<string[]> {
 try {
 const scope = `/subscriptions/${this.subscriptionId}`;
 
 const queryDefinition = {
 type: 'ActualCost',
 timeframe: 'MonthToDate',
 dataSet: {
 granularity: 'None',
 aggregation: {
 totalCost: {
 name: 'Cost',
 function: 'Sum',
 },
 },
 grouping: [
 {
 type: 'Dimension',
 name: 'ServiceName',
 },
 ],
 },
 };

 const result = await this.client.query.usage(scope, queryDefinition);
 const services: string[] = [];

 if (result.rows) {
 for (const row of result.rows) {
 const serviceName = row[0]?.toString();
 if (serviceName && !services.includes(serviceName)) {
 services.push(serviceName);
 }
 }
 }

 return services;
 } catch (error) {
 console.error('Failed to fetch Azure services:', error);
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

 console.log(`Synced ${costData.length} Azure cost records to database`);
 } catch (error) {
 console.error('Failed to sync Azure costs to database:', error);
 throw error;
 }
 }

 /**
 * Map Azure service names to our service IDs
 */
 private mapAzureServiceToServiceId(azureService: string): string {
 const serviceMapping: Record<string, string> = {
 'Virtual Machines': 'compute-service',
 'Storage': 'storage-service',
 'Azure SQL Database': 'database-service',
 'Content Delivery Network': 'cdn-service',
 'Azure Functions': 'lambda-service',
 'API Management': 'api-gateway-service',
 'Container Instances': 'container-service',
 'Azure Kubernetes Service': 'kubernetes-service',
 'Azure Cache for Redis': 'cache-service',
 'Application Gateway': 'load-balancer-service',
 'Azure Monitor': 'monitoring-service',
 };

 return serviceMapping[azureService] || azureService.toLowerCase().replace(/\s+/g, '-');
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
 // Analyze recent costs for recommendations
 const recentCosts = await prisma.serviceCost.findMany({
 where: {
 provider: 'azure',
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
 // Virtual Machine optimization
 if (cost.service.toLowerCase().includes('virtual machine') && cost.cost > 100) {
 recommendations.push({
 serviceId: cost.serviceId,
 type: 'rightsize',
 description: `Consider rightsizing ${cost.service} instances or use Azure Reserved Instances`,
 estimatedSavings: cost.cost * 0.4, // 40% potential savings with reserved instances
 effort: 'medium',
 impact: 'high',
 });
 }

 // Storage optimization
 if (cost.service.toLowerCase().includes('storage') && cost.cost > 50) {
 recommendations.push({
 serviceId: cost.serviceId,
 type: 'optimization',
 description: `Implement Azure Storage lifecycle management for ${cost.service}`,
 estimatedSavings: cost.cost * 0.25, // 25% potential savings
 effort: 'low',
 impact: 'medium',
 });
 }

 // Database optimization
 if (cost.service.toLowerCase().includes('sql') && cost.cost > 200) {
 recommendations.push({
 serviceId: cost.serviceId,
 type: 'optimization',
 description: `Consider Azure SQL Database elastic pools for ${cost.service}`,
 estimatedSavings: cost.cost * 0.3, // 30% potential savings
 effort: 'high',
 impact: 'high',
 });
 }
 }

 return recommendations;
 } catch (error) {
 console.error('Failed to get Azure cost recommendations:', error);
 return [];
 }
 }

 /**
 * Get budget alerts and thresholds
 */
 async getBudgetAlerts(): Promise<Array<{
 budgetName: string;
 currentSpend: number;
 budgetAmount: number;
 percentage: number;
 status: 'ok' | 'warning' | 'exceeded';
 }>> {
 try {
 const scope = `/subscriptions/${this.subscriptionId}`;
 
 // This would typically fetch budget information from Azure Cost Management
 // For now, we'll return a placeholder implementation
 const budgets = await this.client.budgets.list(scope);
 const alerts = [];

 for await (const budget of budgets) {
 if (budget.amount && budget.currentSpend) {
 const percentage = (budget.currentSpend.amount / budget.amount) * 100;
 
 alerts.push({
 budgetName: budget.name || 'Unknown Budget',
 currentSpend: budget.currentSpend.amount,
 budgetAmount: budget.amount,
 percentage,
 status: percentage > 100 ? 'exceeded' : percentage > 80 ? 'warning' : 'ok',
 });
 }
 }

 return alerts;
 } catch (error) {
 console.error('Failed to fetch Azure budget alerts:', error);
 return [];
 }
 }
}

// Create singleton instance lazily
let _azureCostProvider: AzureCostProvider | null = null;

export function getAzureCostProvider(): AzureCostProvider {
 if (!_azureCostProvider) {
 _azureCostProvider = new AzureCostProvider({
 clientId: process.env.AZURE_CLIENT_ID || '',
 clientSecret: process.env.AZURE_CLIENT_SECRET || '',
 tenantId: process.env.AZURE_TENANT_ID || '',
 subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || '',
 });
 }
 return _azureCostProvider;
}