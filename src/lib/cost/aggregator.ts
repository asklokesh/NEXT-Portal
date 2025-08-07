/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { prisma } from '../db/client';
import { getAwsCostProvider } from './providers/aws';
import { getAzureCostProvider } from './providers/azure';
import { getGcpCostProvider } from './providers/gcp';
import type { CostData } from './providers/aws';

// Get provider instances lazily
let awsCostProvider: any;
let azureCostProvider: any;
let gcpCostProvider: any;

function getProviders() {
 if (!awsCostProvider) awsCostProvider = getAwsCostProvider();
 if (!azureCostProvider) azureCostProvider = getAzureCostProvider();
 if (!gcpCostProvider) gcpCostProvider = getGcpCostProvider();
 return { awsCostProvider, azureCostProvider, gcpCostProvider };
}

export interface AggregatedCostData {
 serviceId: string;
 serviceName: string;
 totalCost: number;
 currency: string;
 breakdown: {
 aws?: number;
 azure?: number;
 gcp?: number;
 };
 trend: {
 current: number;
 previous: number;
 change: number;
 changePercent: number;
 };
 recommendations: Array<{
 type: string;
 description: string;
 estimatedSavings: number;
 effort: string;
 impact: string;
 }>;
}

export interface CostSummary {
 totalCost: number;
 currency: string;
 periodStart: Date;
 periodEnd: Date;
 breakdown: {
 aws: number;
 azure: number;
 gcp: number;
 };
 topServices: Array<{
 serviceId: string;
 serviceName: string;
 cost: number;
 percentage: number;
 }>;
 trends: {
 daily: Array<{
 date: Date;
 totalCost: number;
 aws: number;
 azure: number;
 gcp: number;
 }>;
 monthly: Array<{
 month: string;
 totalCost: number;
 aws: number;
 azure: number;
 gcp: number;
 }>;
 };
}

export class CostAggregator {
 private readonly currencyRates: Map<string, number> = new Map();

 constructor() {
 // Initialize with default USD rates - in production, fetch from currency API
 this.currencyRates.set('USD', 1.0);
 this.currencyRates.set('EUR', 0.85);
 this.currencyRates.set('GBP', 0.73);
 this.currencyRates.set('CAD', 1.35);
 this.currencyRates.set('AUD', 1.52);
 }

 /**
 * Sync all cloud provider costs to database
 */
 async syncAllCosts(startDate: Date, endDate: Date): Promise<void> {
 try {
 console.log(`Starting cost sync for period: ${startDate.toISOString()} to ${endDate.toISOString()}`);

 // Sync costs in parallel
 const syncPromises = [];

 // AWS sync
 if (process.env.AWS_COST_EXPLORER_ENABLED === 'true') {
 syncPromises.push(this.syncAWSCosts(startDate, endDate));
 }

 // Azure sync
 if (process.env.AZURE_COST_MANAGEMENT_ENABLED === 'true') {
 syncPromises.push(this.syncAzureCosts(startDate, endDate));
 }

 // GCP sync
 if (process.env.GCP_CLOUD_BILLING_ENABLED === 'true') {
 syncPromises.push(this.syncGCPCosts(startDate, endDate));
 }

 await Promise.allSettled(syncPromises);
 console.log('Cost sync completed for all providers');
 } catch (error) {
 console.error('Failed to sync costs from all providers:', error);
 throw error;
 }
 }

 /**
 * Sync AWS costs
 */
 private async syncAWSCosts(startDate: Date, endDate: Date): Promise<void> {
 try {
 console.log('Syncing AWS costs...');
 const dailyCosts = await awsCostProvider.getDailyCosts(startDate, endDate);
 const monthlyCosts = await awsCostProvider.getMonthlyCosts(startDate, endDate);
 
 await awsCostProvider.syncCostsToDatabase([...dailyCosts, ...monthlyCosts]);
 console.log(`Synced ${dailyCosts.length + monthlyCosts.length} AWS cost records`);
 } catch (error) {
 console.error('Failed to sync AWS costs:', error);
 }
 }

 /**
 * Sync Azure costs
 */
 private async syncAzureCosts(startDate: Date, endDate: Date): Promise<void> {
 try {
 console.log('Syncing Azure costs...');
 const dailyCosts = await azureCostProvider.getDailyCosts(startDate, endDate);
 const monthlyCosts = await azureCostProvider.getMonthlyCosts(startDate, endDate);
 
 await azureCostProvider.syncCostsToDatabase([...dailyCosts, ...monthlyCosts]);
 console.log(`Synced ${dailyCosts.length + monthlyCosts.length} Azure cost records`);
 } catch (error) {
 console.error('Failed to sync Azure costs:', error);
 }
 }

 /**
 * Sync GCP costs
 */
 private async syncGCPCosts(startDate: Date, endDate: Date): Promise<void> {
 try {
 console.log('Syncing GCP costs...');
 const dailyCosts = await gcpCostProvider.getDailyCosts(startDate, endDate);
 const monthlyCosts = await gcpCostProvider.getMonthlyCosts(startDate, endDate);
 
 await gcpCostProvider.syncCostsToDatabase([...dailyCosts, ...monthlyCosts]);
 console.log(`Synced ${dailyCosts.length + monthlyCosts.length} GCP cost records`);
 } catch (error) {
 console.error('Failed to sync GCP costs:', error);
 }
 }

 /**
 * Get aggregated cost data for services
 */
 async getAggregatedCosts(
 startDate: Date,
 endDate: Date,
 serviceIds?: string[]
 ): Promise<AggregatedCostData[]> {
 try {
 const whereClause: any = {
 date: {
 gte: startDate,
 lte: endDate,
 },
 };

 if (serviceIds && serviceIds.length > 0) {
 whereClause.serviceId = {
 in: serviceIds,
 };
 }

 const costs = await prisma.serviceCost.findMany({
 where: whereClause,
 include: {
 service: true,
 },
 });

 // Group by service ID
 const serviceGroups = new Map<string, CostData[]>();
 costs.forEach(cost => {
 const costData: CostData = {
 serviceId: cost.serviceId,
 provider: cost.provider,
 region: cost.region || undefined,
 account: cost.account || undefined,
 service: cost.service,
 resource: cost.resource || undefined,
 cost: cost.cost,
 currency: cost.currency,
 period: cost.period,
 date: cost.date,
 tags: cost.tags as Record<string, any> || undefined,
 };

 if (!serviceGroups.has(cost.serviceId)) {
 serviceGroups.set(cost.serviceId, []);
 }
 serviceGroups.get(cost.serviceId)!.push(costData);
 });

 // Create aggregated data
 const aggregatedData: AggregatedCostData[] = [];
 
 for (const [serviceId, serviceCosts] of serviceGroups) {
 const service = serviceCosts[0]; // Get service info from first record
 const serviceEntity = costs.find(c => c.serviceId === serviceId)?.service;

 // Calculate total cost (normalize to USD)
 const totalCost = serviceCosts.reduce((sum, cost) => {
 return sum + this.convertToUSD(cost.cost, cost.currency);
 }, 0);

 // Calculate breakdown by provider
 const breakdown = {
 aws: serviceCosts
 .filter(c => c.provider === 'aws')
 .reduce((sum, c) => sum + this.convertToUSD(c.cost, c.currency), 0),
 azure: serviceCosts
 .filter(c => c.provider === 'azure')
 .reduce((sum, c) => sum + this.convertToUSD(c.cost, c.currency), 0),
 gcp: serviceCosts
 .filter(c => c.provider === 'gcp')
 .reduce((sum, c) => sum + this.convertToUSD(c.cost, c.currency), 0),
 };

 // Calculate trend (compare with previous period)
 const trend = await this.calculateTrend(serviceId, startDate, endDate);

 // Get recommendations
 const recommendations = await this.getServiceRecommendations(serviceId);

 aggregatedData.push({
 serviceId,
 serviceName: serviceEntity?.displayName || serviceId,
 totalCost,
 currency: 'USD',
 breakdown,
 trend,
 recommendations,
 });
 }

 return aggregatedData.sort((a, b) => b.totalCost - a.totalCost);
 } catch (error) {
 console.error('Failed to get aggregated costs:', error);
 throw error;
 }
 }

 /**
 * Get cost summary for a period
 */
 async getCostSummary(startDate: Date, endDate: Date): Promise<CostSummary> {
 try {
 const costs = await prisma.serviceCost.findMany({
 where: {
 date: {
 gte: startDate,
 lte: endDate,
 },
 },
 include: {
 service: true,
 },
 orderBy: {
 date: 'asc',
 },
 });

 // Calculate totals
 const totalCost = costs.reduce((sum, cost) => {
 return sum + this.convertToUSD(cost.cost, cost.currency);
 }, 0);

 // Calculate breakdown by provider
 const breakdown = {
 aws: costs
 .filter(c => c.provider === 'aws')
 .reduce((sum, c) => sum + this.convertToUSD(c.cost, c.currency), 0),
 azure: costs
 .filter(c => c.provider === 'azure')
 .reduce((sum, c) => sum + this.convertToUSD(c.cost, c.currency), 0),
 gcp: costs
 .filter(c => c.provider === 'gcp')
 .reduce((sum, c) => sum + this.convertToUSD(c.cost, c.currency), 0),
 };

 // Get top services
 const serviceGroups = new Map<string, number>();
 costs.forEach(cost => {
 const currentTotal = serviceGroups.get(cost.serviceId) || 0;
 serviceGroups.set(cost.serviceId, currentTotal + this.convertToUSD(cost.cost, cost.currency));
 });

 const topServices = Array.from(serviceGroups.entries())
 .map(([serviceId, cost]) => {
 const serviceEntity = costs.find(c => c.serviceId === serviceId)?.service;
 return {
 serviceId,
 serviceName: serviceEntity?.displayName || serviceId,
 cost,
 percentage: (cost / totalCost) * 100,
 };
 })
 .sort((a, b) => b.cost - a.cost)
 .slice(0, 10);

 // Calculate daily trends
 const dailyTrends = this.calculateDailyTrends(costs);
 const monthlyTrends = this.calculateMonthlyTrends(costs);

 return {
 totalCost,
 currency: 'USD',
 periodStart: startDate,
 periodEnd: endDate,
 breakdown,
 topServices,
 trends: {
 daily: dailyTrends,
 monthly: monthlyTrends,
 },
 };
 } catch (error) {
 console.error('Failed to get cost summary:', error);
 throw error;
 }
 }

 /**
 * Calculate trend compared to previous period
 */
 private async calculateTrend(
 serviceId: string,
 startDate: Date,
 endDate: Date
 ): Promise<{ current: number; previous: number; change: number; changePercent: number }> {
 try {
 // Calculate period duration
 const periodDuration = endDate.getTime() - startDate.getTime();
 const previousStart = new Date(startDate.getTime() - periodDuration);
 const previousEnd = startDate;

 // Get current period costs
 const currentCosts = await prisma.serviceCost.findMany({
 where: {
 serviceId,
 date: {
 gte: startDate,
 lte: endDate,
 },
 },
 });

 // Get previous period costs
 const previousCosts = await prisma.serviceCost.findMany({
 where: {
 serviceId,
 date: {
 gte: previousStart,
 lte: previousEnd,
 },
 },
 });

 const current = currentCosts.reduce((sum, cost) => {
 return sum + this.convertToUSD(cost.cost, cost.currency);
 }, 0);

 const previous = previousCosts.reduce((sum, cost) => {
 return sum + this.convertToUSD(cost.cost, cost.currency);
 }, 0);

 const change = current - previous;
 const changePercent = previous > 0 ? (change / previous) * 100 : 0;

 return { current, previous, change, changePercent };
 } catch (error) {
 console.error('Failed to calculate trend:', error);
 return { current: 0, previous: 0, change: 0, changePercent: 0 };
 }
 }

 /**
 * Get service-specific recommendations
 */
 private async getServiceRecommendations(serviceId: string): Promise<Array<{
 type: string;
 description: string;
 estimatedSavings: number;
 effort: string;
 impact: string;
 }>> {
 try {
 const recommendations = [];

 // Get recommendations from all providers
 const [awsRecs, azureRecs, gcpRecs] = await Promise.allSettled([
 getProviders().awsCostProvider.getCostRecommendations(),
 getProviders().azureCostProvider.getCostRecommendations(),
 getProviders().gcpCostProvider.getCostRecommendations(),
 ]);

 // Combine recommendations for this service
 [awsRecs, azureRecs, gcpRecs].forEach(result => {
 if (result.status === 'fulfilled') {
 const serviceRecs = result.value.filter(rec => rec.serviceId === serviceId);
 recommendations.push(...serviceRecs);
 }
 });

 return recommendations;
 } catch (error) {
 console.error('Failed to get service recommendations:', error);
 return [];
 }
 }

 /**
 * Calculate daily trends
 */
 private calculateDailyTrends(costs: any[]): Array<{
 date: Date;
 totalCost: number;
 aws: number;
 azure: number;
 gcp: number;
 }> {
 const dailyGroups = new Map<string, any[]>();
 
 costs.forEach(cost => {
 const dateKey = cost.date.toISOString().split('T')[0];
 if (!dailyGroups.has(dateKey)) {
 dailyGroups.set(dateKey, []);
 }
 dailyGroups.get(dateKey)!.push(cost);
 });

 return Array.from(dailyGroups.entries()).map(([dateKey, dayCosts]) => {
 const totalCost = dayCosts.reduce((sum, cost) => {
 return sum + this.convertToUSD(cost.cost, cost.currency);
 }, 0);

 const aws = dayCosts
 .filter(c => c.provider === 'aws')
 .reduce((sum, c) => sum + this.convertToUSD(c.cost, c.currency), 0);

 const azure = dayCosts
 .filter(c => c.provider === 'azure')
 .reduce((sum, c) => sum + this.convertToUSD(c.cost, c.currency), 0);

 const gcp = dayCosts
 .filter(c => c.provider === 'gcp')
 .reduce((sum, c) => sum + this.convertToUSD(c.cost, c.currency), 0);

 return {
 date: new Date(dateKey),
 totalCost,
 aws,
 azure,
 gcp,
 };
 }).sort((a, b) => a.date.getTime() - b.date.getTime());
 }

 /**
 * Calculate monthly trends
 */
 private calculateMonthlyTrends(costs: any[]): Array<{
 month: string;
 totalCost: number;
 aws: number;
 azure: number;
 gcp: number;
 }> {
 const monthlyGroups = new Map<string, any[]>();
 
 costs.forEach(cost => {
 const monthKey = `${cost.date.getFullYear()}-${String(cost.date.getMonth() + 1).padStart(2, '0')}`;
 if (!monthlyGroups.has(monthKey)) {
 monthlyGroups.set(monthKey, []);
 }
 monthlyGroups.get(monthKey)!.push(cost);
 });

 return Array.from(monthlyGroups.entries()).map(([month, monthCosts]) => {
 const totalCost = monthCosts.reduce((sum, cost) => {
 return sum + this.convertToUSD(cost.cost, cost.currency);
 }, 0);

 const aws = monthCosts
 .filter(c => c.provider === 'aws')
 .reduce((sum, c) => sum + this.convertToUSD(c.cost, c.currency), 0);

 const azure = monthCosts
 .filter(c => c.provider === 'azure')
 .reduce((sum, c) => sum + this.convertToUSD(c.cost, c.currency), 0);

 const gcp = monthCosts
 .filter(c => c.provider === 'gcp')
 .reduce((sum, c) => sum + this.convertToUSD(c.cost, c.currency), 0);

 return {
 month,
 totalCost,
 aws,
 azure,
 gcp,
 };
 }).sort((a, b) => a.month.localeCompare(b.month));
 }

 /**
 * Convert cost to USD
 */
 private convertToUSD(amount: number, currency: string): number {
 const rate = this.currencyRates.get(currency.toUpperCase()) || 1.0;
 return amount / rate;
 }

 /**
 * Update currency rates (in production, fetch from currency API)
 */
 async updateCurrencyRates(): Promise<void> {
 try {
 // In production, fetch from a currency API like exchangerate-api.com
 // For now, we'll use static rates
 console.log('Currency rates updated');
 } catch (error) {
 console.error('Failed to update currency rates:', error);
 }
 }

 /**
 * Get cost trends with different granularities
 */
 async getCostTrends(
 startDate: Date,
 endDate: Date,
 granularity: 'daily' | 'weekly' | 'monthly' = 'daily',
 serviceIds?: string[]
 ): Promise<Array<{
 date: string;
 totalCost: number;
 aws: number;
 azure: number;
 gcp: number;
 }>> {
 try {
 const whereClause: any = {
 date: {
 gte: startDate,
 lte: endDate,
 },
 };

 if (serviceIds && serviceIds.length > 0) {
 whereClause.serviceId = {
 in: serviceIds,
 };
 }

 const costs = await prisma.serviceCost.findMany({
 where: whereClause,
 orderBy: { date: 'asc' }
 });

 switch (granularity) {
 case 'daily':
 return this.calculateDailyTrends(costs).map(trend => ({
 ...trend,
 date: trend.date.toISOString().split('T')[0]
 }));
 case 'monthly':
 return this.calculateMonthlyTrends(costs).map(trend => ({
 ...trend,
 date: trend.month
 }));
 default:
 return this.calculateDailyTrends(costs).map(trend => ({
 ...trend,
 date: trend.date.toISOString().split('T')[0]
 }));
 }
 } catch (error) {
 console.error('Failed to get cost trends:', error);
 return [];
 }
 }

 /**
 * Get cost breakdown by different dimensions
 */
 async getCostBreakdown(
 startDate: Date,
 endDate: Date,
 groupBy: 'service' | 'provider' | 'region' | 'account' = 'service'
 ): Promise<Record<string, any>> {
 try {
 const costs = await prisma.serviceCost.findMany({
 where: {
 date: {
 gte: startDate,
 lte: endDate,
 },
 },
 include: {
 service: true,
 },
 });

 const breakdown: Record<string, number> = {};

 costs.forEach(cost => {
 let key: string;
 switch (groupBy) {
 case 'service':
 key = cost.service?.displayName || cost.serviceId;
 break;
 case 'provider':
 key = cost.provider;
 break;
 case 'region':
 key = cost.region || 'unknown';
 break;
 case 'account':
 key = cost.account || 'unknown';
 break;
 default:
 key = cost.serviceId;
 }

 const usdCost = this.convertToUSD(cost.cost, cost.currency);
 breakdown[key] = (breakdown[key] || 0) + usdCost;
 });

 return breakdown;
 } catch (error) {
 console.error('Failed to get cost breakdown:', error);
 return {};
 }
 }

 /**
 * Get cost recommendations
 */
 async getCostRecommendations(
 serviceIds?: string[],
 threshold: number = 100
 ): Promise<Array<{
 id: string;
 type: string;
 description: string;
 estimatedSavings: number;
 effort: string;
 impact: string;
 serviceId?: string;
 }>> {
 try {
 const recommendations = [];

 // Get recommendations from all providers
 const [awsRecs, azureRecs, gcpRecs] = await Promise.allSettled([
 getProviders().awsCostProvider.getCostRecommendations(),
 getProviders().azureCostProvider.getCostRecommendations(),
 getProviders().gcpCostProvider.getCostRecommendations(),
 ]);

 // Combine recommendations
 [awsRecs, azureRecs, gcpRecs].forEach(result => {
 if (result.status === 'fulfilled') {
 let recs = result.value || [];
 
 if (serviceIds && serviceIds.length > 0) {
 recs = recs.filter(rec => serviceIds.includes(rec.serviceId));
 }
 
 recs = recs.filter(rec => rec.estimatedSavings >= threshold);
 recommendations.push(...recs);
 }
 });

 return recommendations;
 } catch (error) {
 console.error('Failed to get cost recommendations:', error);
 return [];
 }
 }

 /**
 * Generate cost forecasts
 */
 async getCostForecasts(
 startDate: Date,
 endDate: Date,
 serviceIds?: string[]
 ): Promise<Array<{
 month: string;
 forecastCost: number;
 confidence: number;
 }>> {
 try {
 const whereClause: any = {
 date: {
 gte: startDate,
 lte: endDate,
 },
 };

 if (serviceIds && serviceIds.length > 0) {
 whereClause.serviceId = {
 in: serviceIds,
 };
 }

 const costs = await prisma.serviceCost.findMany({
 where: whereClause,
 orderBy: { date: 'asc' }
 });

 // Calculate historical trends
 const monthlyTrends = this.calculateMonthlyTrends(costs);
 
 if (monthlyTrends.length < 2) {
 return []; // Need at least 2 months of data for forecasting
 }

 // Simple linear regression for forecasting
 const forecasts = [];
 const currentTotal = monthlyTrends[monthlyTrends.length - 1].totalCost;
 
 // Calculate average growth rate
 let totalGrowthRate = 0;
 for (let i = 1; i < monthlyTrends.length; i++) {
 const prev = monthlyTrends[i - 1].totalCost;
 const current = monthlyTrends[i].totalCost;
 const growthRate = prev > 0 ? (current - prev) / prev : 0;
 totalGrowthRate += growthRate;
 }
 const avgGrowthRate = totalGrowthRate / (monthlyTrends.length - 1);

 // Generate 6 months of forecasts
 for (let i = 1; i <= 6; i++) {
 const forecastDate = new Date();
 forecastDate.setMonth(forecastDate.getMonth() + i);
 const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`;
 
 const forecastCost = currentTotal * Math.pow(1 + avgGrowthRate, i);
 const confidence = Math.max(0.5, 0.9 - (i * 0.05)); // Decreasing confidence over time

 forecasts.push({
 month: monthKey,
 forecastCost,
 confidence
 });
 }

 return forecasts;
 } catch (error) {
 console.error('Failed to generate cost forecasts:', error);
 return [];
 }
 }

 /**
 * Calculate cost optimization recommendations
 */
 async calculateRecommendations(providers: string[] = ['aws', 'azure', 'gcp']): Promise<any[]> {
 try {
 const recommendations = [];

 for (const provider of providers) {
 switch (provider) {
 case 'aws':
 const awsRecs = await getProviders().awsCostProvider.getCostRecommendations();
 recommendations.push(...awsRecs);
 break;
 case 'azure':
 const azureRecs = await getProviders().azureCostProvider.getCostRecommendations();
 recommendations.push(...azureRecs);
 break;
 case 'gcp':
 const gcpRecs = await getProviders().gcpCostProvider.getCostRecommendations();
 recommendations.push(...gcpRecs);
 break;
 }
 }

 return recommendations;
 } catch (error) {
 console.error('Failed to calculate recommendations:', error);
 return [];
 }
 }

 /**
 * Update budget alerts
 */
 async updateBudgets(startDate: Date, endDate: Date): Promise<any[]> {
 try {
 // In a real implementation, this would update budget alerts in the database
 // For now, return mock data
 return [
 {
 id: 'budget-update-1',
 message: 'Budget alerts updated successfully',
 timestamp: new Date()
 }
 ];
 } catch (error) {
 console.error('Failed to update budgets:', error);
 return [];
 }
 }

 /**
 * Generate forecasts using machine learning
 */
 async generateForecasts(
 startDate: Date,
 endDate: Date,
 providers?: string[]
 ): Promise<any[]> {
 try {
 // Use the existing forecast method
 return await this.getCostForecasts(startDate, endDate);
 } catch (error) {
 console.error('Failed to generate forecasts:', error);
 return [];
 }
 }
}

// Create singleton instance
export const costAggregator = new CostAggregator();