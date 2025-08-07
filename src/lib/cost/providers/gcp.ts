/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { prisma } from '../../db/client';
import type { CostData } from './aws';

// Dynamic imports for Google APIs to reduce bundle size
let google: any;
let GoogleAuth: any;

const loadGoogleApis = async () => {
 if (!google) {
 const [googleapis, authLib] = await Promise.all([
 import('googleapis'),
 import('google-auth-library')
 ]);
 google = googleapis.google;
 GoogleAuth = authLib.GoogleAuth;
 }
};

export interface GCPCostConfig {
 projectId: string;
 clientEmail: string;
 privateKey: string;
 billingAccountId: string;
}

export class GCPCostProvider {
 private auth: any;
 private billingClient: any;
 private projectId: string;
 private billingAccountId: string;
 private config: GCPCostConfig;
 private initialized = false;

 constructor(config: GCPCostConfig) {
 this.projectId = config.projectId;
 this.billingAccountId = config.billingAccountId;
 this.config = config;
 }

 private async initialize() {
 if (!this.initialized) {
 await loadGoogleApis();
 
 this.auth = new GoogleAuth({
 credentials: {
 client_email: this.config.clientEmail,
 private_key: this.config.privateKey.replace(/\\n/g, '\n'),
 },
 scopes: [
 'https://www.googleapis.com/auth/cloud-platform',
 'https://www.googleapis.com/auth/cloud-billing',
 ],
 });

 this.billingClient = google.cloudbilling('v1');
 this.initialized = true;
 }
 }

 /**
 * Get daily cost data from GCP Cloud Billing API
 */
 async getDailyCosts(startDate: Date, endDate: Date): Promise<CostData[]> {
 await this.initialize();
 try {
 const authClient = await this.auth.getClient();
 
 const request = {
 auth: authClient,
 parent: `billingAccounts/${this.billingAccountId}`,
 requestBody: {
 dateRange: {
 startDate: {
 year: startDate.getFullYear(),
 month: startDate.getMonth() + 1,
 day: startDate.getDate(),
 },
 endDate: {
 year: endDate.getFullYear(),
 month: endDate.getMonth() + 1,
 day: endDate.getDate(),
 },
 },
 dimensions: ['PROJECT', 'SERVICE', 'LOCATION'],
 aggregationInfo: {
 aggregationLevel: 'PROJECT',
 aggregationInterval: 'DAILY',
 aggregationCount: 1,
 },
 metricTypes: ['COST', 'USAGE'],
 },
 };

 const response = await this.billingClient.billingAccounts.reports.query(request);
 const costData: CostData[] = [];

 if (response.data.tableRows) {
 for (const row of response.data.tableRows) {
 const project = row.dimensionValues?.find((d: any) => d.key === 'PROJECT')?.value || '';
 const service = row.dimensionValues?.find((d: any) => d.key === 'SERVICE')?.value || '';
 const location = row.dimensionValues?.find((d: any) => d.key === 'LOCATION')?.value || '';
 
 const costMetric = row.metricValues?.find((m: any) => m.metricType === 'COST');
 const usageMetric = row.metricValues?.find((m: any) => m.metricType === 'USAGE');

 if (costMetric && parseFloat(costMetric.amount || '0') > 0) {
 costData.push({
 serviceId: this.mapGCPServiceToServiceId(service),
 provider: 'gcp',
 region: location,
 account: project,
 service,
 cost: parseFloat(costMetric.amount),
 currency: costMetric.currency || 'USD',
 period: 'daily',
 date: this.parseGCPDate(row.usageStartTime),
 });
 }
 }
 }

 return costData;
 } catch (error) {
 console.error('Failed to fetch GCP daily costs:', error);
 throw error;
 }
 }

 /**
 * Get monthly cost data
 */
 async getMonthlyCosts(startDate: Date, endDate: Date): Promise<CostData[]> {
 try {
 const authClient = await this.auth.getClient();
 
 const request = {
 auth: authClient,
 parent: `billingAccounts/${this.billingAccountId}`,
 requestBody: {
 dateRange: {
 startDate: {
 year: startDate.getFullYear(),
 month: startDate.getMonth() + 1,
 day: 1,
 },
 endDate: {
 year: endDate.getFullYear(),
 month: endDate.getMonth() + 1,
 day: new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate(),
 },
 },
 dimensions: ['PROJECT', 'SERVICE', 'LOCATION'],
 aggregationInfo: {
 aggregationLevel: 'PROJECT',
 aggregationInterval: 'MONTHLY',
 aggregationCount: 1,
 },
 metricTypes: ['COST'],
 },
 };

 const response = await this.billingClient.billingAccounts.reports.query(request);
 const costData: CostData[] = [];

 if (response.data.tableRows) {
 for (const row of response.data.tableRows) {
 const project = row.dimensionValues?.find((d: any) => d.key === 'PROJECT')?.value || '';
 const service = row.dimensionValues?.find((d: any) => d.key === 'SERVICE')?.value || '';
 const location = row.dimensionValues?.find((d: any) => d.key === 'LOCATION')?.value || '';
 
 const costMetric = row.metricValues?.find((m: any) => m.metricType === 'COST');

 if (costMetric && parseFloat(costMetric.amount || '0') > 0) {
 costData.push({
 serviceId: this.mapGCPServiceToServiceId(service),
 provider: 'gcp',
 region: location,
 account: project,
 service,
 cost: parseFloat(costMetric.amount),
 currency: costMetric.currency || 'USD',
 period: 'monthly',
 date: this.parseGCPDate(row.usageStartTime),
 });
 }
 }
 }

 return costData;
 } catch (error) {
 console.error('Failed to fetch GCP monthly costs:', error);
 throw error;
 }
 }

 /**
 * Get costs by labels (GCP equivalent of tags)
 */
 async getCostsByLabels(startDate: Date, endDate: Date, labelKey: string): Promise<CostData[]> {
 try {
 const authClient = await this.auth.getClient();
 
 const request = {
 auth: authClient,
 parent: `billingAccounts/${this.billingAccountId}`,
 requestBody: {
 dateRange: {
 startDate: {
 year: startDate.getFullYear(),
 month: startDate.getMonth() + 1,
 day: startDate.getDate(),
 },
 endDate: {
 year: endDate.getFullYear(),
 month: endDate.getMonth() + 1,
 day: endDate.getDate(),
 },
 },
 dimensions: ['PROJECT', 'SERVICE', `LABEL_${labelKey.toUpperCase()}`],
 aggregationInfo: {
 aggregationLevel: 'PROJECT',
 aggregationInterval: 'DAILY',
 aggregationCount: 1,
 },
 metricTypes: ['COST'],
 },
 };

 const response = await this.billingClient.billingAccounts.reports.query(request);
 const costData: CostData[] = [];

 if (response.data.tableRows) {
 for (const row of response.data.tableRows) {
 const project = row.dimensionValues?.find((d: any) => d.key === 'PROJECT')?.value || '';
 const service = row.dimensionValues?.find((d: any) => d.key === 'SERVICE')?.value || '';
 const labelValue = row.dimensionValues?.find((d: any) => d.key === `LABEL_${labelKey.toUpperCase()}`)?.value || '';
 
 const costMetric = row.metricValues?.find((m: any) => m.metricType === 'COST');

 if (costMetric && parseFloat(costMetric.amount || '0') > 0 && labelValue) {
 costData.push({
 serviceId: labelValue, // Use label value as service ID
 provider: 'gcp',
 account: project,
 service,
 cost: parseFloat(costMetric.amount),
 currency: costMetric.currency || 'USD',
 period: 'daily',
 date: this.parseGCPDate(row.usageStartTime),
 tags: { [labelKey]: labelValue },
 });
 }
 }
 }

 return costData;
 } catch (error) {
 console.error('Failed to fetch GCP costs by labels:', error);
 throw error;
 }
 }

 /**
 * Get available GCP services
 */
 async getAvailableServices(): Promise<string[]> {
 try {
 const authClient = await this.auth.getClient();
 
 const request = {
 auth: authClient,
 parent: `billingAccounts/${this.billingAccountId}`,
 requestBody: {
 dateRange: {
 startDate: {
 year: new Date().getFullYear(),
 month: new Date().getMonth(),
 day: 1,
 },
 endDate: {
 year: new Date().getFullYear(),
 month: new Date().getMonth() + 1,
 day: new Date().getDate(),
 },
 },
 dimensions: ['SERVICE'],
 aggregationInfo: {
 aggregationLevel: 'PROJECT',
 aggregationInterval: 'MONTHLY',
 aggregationCount: 1,
 },
 metricTypes: ['COST'],
 },
 };

 const response = await this.billingClient.billingAccounts.reports.query(request);
 const services: string[] = [];

 if (response.data.tableRows) {
 for (const row of response.data.tableRows) {
 const service = row.dimensionValues?.find((d: any) => d.key === 'SERVICE')?.value;
 if (service && !services.includes(service)) {
 services.push(service);
 }
 }
 }

 return services;
 } catch (error) {
 console.error('Failed to fetch GCP services:', error);
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

 console.log(`Synced ${costData.length} GCP cost records to database`);
 } catch (error) {
 console.error('Failed to sync GCP costs to database:', error);
 throw error;
 }
 }

 /**
 * Map GCP service names to our service IDs
 */
 private mapGCPServiceToServiceId(gcpService: string): string {
 const serviceMapping: Record<string, string> = {
 'Compute Engine': 'compute-service',
 'Cloud Storage': 'storage-service',
 'Cloud SQL': 'database-service',
 'Cloud CDN': 'cdn-service',
 'Cloud Functions': 'lambda-service',
 'API Gateway': 'api-gateway-service',
 'Cloud Run': 'container-service',
 'Google Kubernetes Engine': 'kubernetes-service',
 'Memorystore': 'cache-service',
 'Cloud Load Balancing': 'load-balancer-service',
 'Cloud Monitoring': 'monitoring-service',
 'BigQuery': 'analytics-service',
 'Pub/Sub': 'messaging-service',
 };

 return serviceMapping[gcpService] || gcpService.toLowerCase().replace(/\s+/g, '-');
 }

 /**
 * Parse GCP date format
 */
 private parseGCPDate(dateString: string): Date {
 if (!dateString) return new Date();
 
 // GCP returns dates in ISO format or as timestamp
 try {
 return new Date(dateString);
 } catch {
 return new Date();
 }
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
 provider: 'gcp',
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
 // Compute Engine optimization
 if (cost.service.toLowerCase().includes('compute engine') && cost.cost > 100) {
 recommendations.push({
 serviceId: cost.serviceId,
 type: 'rightsize',
 description: `Consider using Committed Use Discounts for ${cost.service} or rightsize instances`,
 estimatedSavings: cost.cost * 0.35, // 35% potential savings with CUDs
 effort: 'medium',
 impact: 'high',
 });
 }

 // Cloud Storage optimization
 if (cost.service.toLowerCase().includes('storage') && cost.cost > 50) {
 recommendations.push({
 serviceId: cost.serviceId,
 type: 'optimization',
 description: `Implement Cloud Storage lifecycle policies for ${cost.service}`,
 estimatedSavings: cost.cost * 0.3, // 30% potential savings
 effort: 'low',
 impact: 'medium',
 });
 }

 // BigQuery optimization
 if (cost.service.toLowerCase().includes('bigquery') && cost.cost > 200) {
 recommendations.push({
 serviceId: cost.serviceId,
 type: 'optimization',
 description: `Optimize BigQuery queries and consider slot reservations for ${cost.service}`,
 estimatedSavings: cost.cost * 0.25, // 25% potential savings
 effort: 'high',
 impact: 'high',
 });
 }

 // GKE optimization
 if (cost.service.toLowerCase().includes('kubernetes') && cost.cost > 150) {
 recommendations.push({
 serviceId: cost.serviceId,
 type: 'rightsize',
 description: `Consider GKE Autopilot mode or cluster autoscaling for ${cost.service}`,
 estimatedSavings: cost.cost * 0.2, // 20% potential savings
 effort: 'medium',
 impact: 'medium',
 });
 }
 }

 return recommendations;
 } catch (error) {
 console.error('Failed to get GCP cost recommendations:', error);
 return [];
 }
 }

 /**
 * Get billing budget alerts
 */
 async getBudgetAlerts(): Promise<Array<{
 budgetName: string;
 currentSpend: number;
 budgetAmount: number;
 percentage: number;
 status: 'ok' | 'warning' | 'exceeded';
 }>> {
 try {
 const authClient = await this.auth.getClient();
 const budgetClient = google.cloudbilling('v1beta1');
 
 const request = {
 auth: authClient,
 parent: `billingAccounts/${this.billingAccountId}`,
 };

 const response = await budgetClient.billingAccounts.budgets.list(request);
 const alerts = [];

 if (response.data.budgets) {
 for (const budget of response.data.budgets) {
 if (budget.amount && budget.budgetFilter) {
 // Get current spend for this budget
 const currentSpend = await this.getCurrentSpendForBudget(budget);
 const budgetAmount = parseFloat(budget.amount.specifiedAmount?.units || '0');
 const percentage = (currentSpend / budgetAmount) * 100;

 alerts.push({
 budgetName: budget.displayName || 'Unknown Budget',
 currentSpend,
 budgetAmount,
 percentage,
 status: percentage > 100 ? 'exceeded' : percentage > 80 ? 'warning' : 'ok',
 });
 }
 }
 }

 return alerts;
 } catch (error) {
 console.error('Failed to fetch GCP budget alerts:', error);
 return [];
 }
 }

 /**
 * Get current spend for a specific budget
 */
 private async getCurrentSpendForBudget(budget: any): Promise<number> {
 try {
 // This would require a more complex query to the billing API
 // to get current spend based on the budget's filter criteria
 // For now, return a placeholder value
 return 0;
 } catch (error) {
 console.error('Failed to get current spend for budget:', error);
 return 0;
 }
 }
}

// Create singleton instance
// Create singleton instance lazily
let _gcpCostProvider: GCPCostProvider | null = null;

export function getGcpCostProvider(): GCPCostProvider {
 if (!_gcpCostProvider) {
 _gcpCostProvider = new GCPCostProvider({
 projectId: process.env.GCP_PROJECT_ID || '',
 clientEmail: process.env.GCP_CLIENT_EMAIL || '',
 privateKey: process.env.GCP_PRIVATE_KEY || '',
 billingAccountId: process.env.GCP_BILLING_ACCOUNT_ID || '',
 });
 }
 return _gcpCostProvider;
}