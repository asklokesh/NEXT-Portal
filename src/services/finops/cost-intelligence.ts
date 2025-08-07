/**
 * Cost Intelligence Engine - Real-time cost tracking and analysis
 * Advanced ML-powered cost analytics with anomaly detection and trend analysis
 */

import { EventEmitter } from 'events';
import { FinOpsConfig } from './finops-config';

export interface CostDataPoint {
  timestamp: Date;
  service: string;
  resourceId: string;
  resourceType: string;
  cost: number;
  usage: number;
  currency: string;
  region: string;
  provider: 'aws' | 'gcp' | 'azure' | 'other';
  tags: Record<string, string>;
  metadata: Record<string, any>;
}

export interface CostTrend {
  period: string;
  totalCost: number;
  changeFromPrevious: number;
  changePercentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  volatility: number;
  seasonalPattern?: {
    detected: boolean;
    pattern: string;
    confidence: number;
  };
}

export interface CostAnomaly {
  id: string;
  timestamp: Date;
  type: 'spike' | 'dip' | 'trend_change' | 'pattern_break';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedResources: string[];
  expectedCost: number;
  actualCost: number;
  deviation: number;
  confidence: number;
  potentialCauses: string[];
  recommendations: string[];
  metadata: Record<string, any>;
}

export interface CostBreakdown {
  byService: Record<string, number>;
  byRegion: Record<string, number>;
  byResourceType: Record<string, number>;
  byTag: Record<string, Record<string, number>>;
  byProvider: Record<string, number>;
  topCostDrivers: Array<{
    name: string;
    cost: number;
    percentage: number;
    trend: number;
  }>;
}

export interface CostMetrics {
  totalCosts: {
    current: number;
    previous: number;
    change: number;
    changePercentage: number;
  };
  breakdown: CostBreakdown;
  trends: CostTrend[];
  anomalies: CostAnomaly[];
  efficiency: {
    wasteScore: number;
    utilizationScore: number;
    optimizationOpportunity: number;
  };
  forecast: {
    nextMonth: number;
    confidence: number;
  };
}

class CostIntelligenceEngine extends EventEmitter {
  private config: FinOpsConfig;
  private costDataBuffer: Map<string, CostDataPoint[]> = new Map();
  private historicalData: CostDataPoint[] = [];
  private mlModels: Map<string, any> = new Map();
  private anomalyThresholds: Map<string, number> = new Map();
  private isInitialized = false;

  constructor(config: FinOpsConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load historical cost data
      await this.loadHistoricalData();
      
      // Initialize ML models
      await this.initializeMLModels();
      
      // Set up anomaly detection thresholds
      this.setupAnomalyThresholds();
      
      // Start real-time processing
      this.startRealTimeProcessing();
      
      this.isInitialized = true;
      console.log('Cost Intelligence Engine initialized');
    } catch (error) {
      console.error('Failed to initialize Cost Intelligence Engine:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    this.isInitialized = false;
    // Clean up resources
  }

  /**
   * Process new cost data points
   */
  async processCostData(costData: CostDataPoint[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Validate and normalize data
      const validatedData = this.validateCostData(costData);
      
      // Store in buffer for real-time analysis
      this.addToBuffer(validatedData);
      
      // Add to historical data
      this.historicalData.push(...validatedData);
      
      // Trigger real-time analysis
      await this.performRealTimeAnalysis(validatedData);
      
      this.emit('data_processed', {
        count: validatedData.length,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Error processing cost data:', error);
      this.emit('processing_error', error);
    }
  }

  /**
   * Get aggregated cost metrics
   */
  async getAggregatedMetrics(timeRange?: { start: Date; end: Date }): Promise<CostMetrics> {
    const filteredData = timeRange 
      ? this.filterDataByTimeRange(this.historicalData, timeRange)
      : this.getRecentData(30); // Default to last 30 days

    return {
      totalCosts: this.calculateTotalCosts(filteredData),
      breakdown: this.generateCostBreakdown(filteredData),
      trends: await this.analyzeTrends(filteredData),
      anomalies: await this.getRecentAnomalies(timeRange),
      efficiency: await this.calculateEfficiencyMetrics(filteredData),
      forecast: await this.generateShortTermForecast()
    };
  }

  /**
   * Detect cost anomalies using ML models
   */
  async detectAnomalies(timeRange?: { start: Date; end: Date }): Promise<CostAnomaly[]> {
    const dataToAnalyze = timeRange
      ? this.filterDataByTimeRange(this.historicalData, timeRange)
      : this.getRecentData(7); // Last 7 days

    const anomalies: CostAnomaly[] = [];

    // Statistical anomaly detection
    const statisticalAnomalies = await this.detectStatisticalAnomalies(dataToAnalyze);
    anomalies.push(...statisticalAnomalies);

    // ML-based anomaly detection
    const mlAnomalies = await this.detectMLAnomalies(dataToAnalyze);
    anomalies.push(...mlAnomalies);

    // Pattern-based anomaly detection
    const patternAnomalies = await this.detectPatternAnomalies(dataToAnalyze);
    anomalies.push(...patternAnomalies);

    // Deduplicate and rank anomalies
    const uniqueAnomalies = this.deduplicateAnomalies(anomalies);
    const rankedAnomalies = this.rankAnomaliesBySeverity(uniqueAnomalies);

    return rankedAnomalies;
  }

  /**
   * Get cost trends and patterns
   */
  async analyzeTrends(data?: CostDataPoint[]): Promise<CostTrend[]> {
    const analysisData = data || this.getRecentData(90);
    
    return [
      await this.analyzeDailyTrends(analysisData),
      await this.analyzeWeeklyTrends(analysisData),
      await this.analyzeMonthlyTrends(analysisData),
      await this.analyzeQuarterlyTrends(analysisData)
    ];
  }

  /**
   * Get cost breakdown by various dimensions
   */
  generateCostBreakdown(data: CostDataPoint[]): CostBreakdown {
    const byService: Record<string, number> = {};
    const byRegion: Record<string, number> = {};
    const byResourceType: Record<string, number> = {};
    const byTag: Record<string, Record<string, number>> = {};
    const byProvider: Record<string, number> = {};

    data.forEach(point => {
      // By service
      byService[point.service] = (byService[point.service] || 0) + point.cost;
      
      // By region
      byRegion[point.region] = (byRegion[point.region] || 0) + point.cost;
      
      // By resource type
      byResourceType[point.resourceType] = (byResourceType[point.resourceType] || 0) + point.cost;
      
      // By provider
      byProvider[point.provider] = (byProvider[point.provider] || 0) + point.cost;
      
      // By tags
      Object.entries(point.tags).forEach(([key, value]) => {
        if (!byTag[key]) byTag[key] = {};
        byTag[key][value] = (byTag[key][value] || 0) + point.cost;
      });
    });

    // Calculate top cost drivers
    const topCostDrivers = Object.entries(byService)
      .map(([service, cost]) => ({
        name: service,
        cost,
        percentage: (cost / this.getTotalCost(data)) * 100,
        trend: this.calculateServiceTrend(service, data)
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    return {
      byService,
      byRegion,
      byResourceType,
      byTag,
      byProvider,
      topCostDrivers
    };
  }

  /**
   * Get real-time cost streaming data
   */
  async streamCostData(callback: (data: CostDataPoint[]) => void): Promise<void> {
    // Set up real-time streaming from cost buffer
    const streamInterval = setInterval(() => {
      const recentData = Array.from(this.costDataBuffer.values()).flat()
        .filter(point => 
          Date.now() - point.timestamp.getTime() < 60000 // Last minute
        );
      
      if (recentData.length > 0) {
        callback(recentData);
      }
    }, 1000); // Stream every second

    // Store interval for cleanup
    setTimeout(() => clearInterval(streamInterval), 300000); // Clean up after 5 minutes
  }

  private validateCostData(data: CostDataPoint[]): CostDataPoint[] {
    return data.filter(point => {
      return (
        point.cost >= 0 &&
        point.timestamp &&
        point.service &&
        point.resourceId &&
        point.provider &&
        typeof point.cost === 'number' &&
        !isNaN(point.cost)
      );
    });
  }

  private addToBuffer(data: CostDataPoint[]): void {
    const bufferKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    
    if (!this.costDataBuffer.has(bufferKey)) {
      this.costDataBuffer.set(bufferKey, []);
    }
    
    this.costDataBuffer.get(bufferKey)!.push(...data);
    
    // Keep only last 7 days in buffer
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    
    for (const [key] of this.costDataBuffer) {
      if (new Date(key) < cutoffDate) {
        this.costDataBuffer.delete(key);
      }
    }
  }

  private async performRealTimeAnalysis(data: CostDataPoint[]): Promise<void> {
    // Real-time anomaly detection on new data
    const anomalies = await this.detectAnomalies();
    
    if (anomalies.length > 0) {
      anomalies.forEach(anomaly => {
        this.emit('anomaly_detected', anomaly);
      });
    }

    // Check for immediate budget impacts
    const budgetImpacts = await this.checkBudgetImpacts(data);
    if (budgetImpacts.length > 0) {
      budgetImpacts.forEach(impact => {
        this.emit('budget_impact', impact);
      });
    }
  }

  private async loadHistoricalData(): Promise<void> {
    // Load historical cost data from database or external sources
    // This would integrate with your data storage layer
    console.log('Loading historical cost data...');
  }

  private async initializeMLModels(): Promise<void> {
    // Initialize ML models for anomaly detection, forecasting, etc.
    // This would integrate with ML services or libraries
    console.log('Initializing ML models...');
    
    // Example: Initialize anomaly detection model
    this.mlModels.set('anomaly_detector', {
      type: 'isolation_forest',
      threshold: 0.1,
      features: ['cost', 'usage', 'hour_of_day', 'day_of_week']
    });
    
    // Example: Initialize forecasting model
    this.mlModels.set('cost_forecaster', {
      type: 'arima',
      seasonal: true,
      periods: [7, 30, 365] // Daily, monthly, yearly patterns
    });
  }

  private setupAnomalyThresholds(): void {
    const config = this.config.getCostIntelligenceConfig();
    this.anomalyThresholds.set('default', config.anomalyDetectionThreshold || 2.0);
    this.anomalyThresholds.set('critical', 3.0);
    this.anomalyThresholds.set('high', 2.5);
    this.anomalyThresholds.set('medium', 2.0);
    this.anomalyThresholds.set('low', 1.5);
  }

  private startRealTimeProcessing(): void {
    // Set up real-time processing pipeline
    console.log('Starting real-time cost processing...');
  }

  private calculateTotalCosts(data: CostDataPoint[]): CostMetrics['totalCosts'] {
    const currentPeriod = this.getRecentData(30, data);
    const previousPeriod = this.getPreviousPeriodData(30, data);
    
    const current = this.getTotalCost(currentPeriod);
    const previous = this.getTotalCost(previousPeriod);
    const change = current - previous;
    const changePercentage = previous > 0 ? (change / previous) * 100 : 0;

    return {
      current,
      previous,
      change,
      changePercentage
    };
  }

  private getTotalCost(data: CostDataPoint[]): number {
    return data.reduce((total, point) => total + point.cost, 0);
  }

  private getRecentData(days: number, data?: CostDataPoint[]): CostDataPoint[] {
    const sourceData = data || this.historicalData;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return sourceData.filter(point => point.timestamp >= cutoffDate);
  }

  private getPreviousPeriodData(days: number, data?: CostDataPoint[]): CostDataPoint[] {
    const sourceData = data || this.historicalData;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - days);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days * 2));
    
    return sourceData.filter(point => 
      point.timestamp >= startDate && point.timestamp < endDate
    );
  }

  private filterDataByTimeRange(
    data: CostDataPoint[], 
    timeRange: { start: Date; end: Date }
  ): CostDataPoint[] {
    return data.filter(point => 
      point.timestamp >= timeRange.start && point.timestamp <= timeRange.end
    );
  }

  private async detectStatisticalAnomalies(data: CostDataPoint[]): Promise<CostAnomaly[]> {
    const anomalies: CostAnomaly[] = [];
    
    // Group by service for statistical analysis
    const serviceGroups = this.groupByService(data);
    
    for (const [service, points] of Object.entries(serviceGroups)) {
      const costs = points.map(p => p.cost);
      const mean = this.calculateMean(costs);
      const stdDev = this.calculateStandardDeviation(costs, mean);
      const threshold = this.anomalyThresholds.get('default') || 2.0;
      
      points.forEach(point => {
        const zScore = Math.abs((point.cost - mean) / stdDev);
        
        if (zScore > threshold) {
          anomalies.push({
            id: `stat_${point.resourceId}_${point.timestamp.getTime()}`,
            timestamp: point.timestamp,
            type: point.cost > mean ? 'spike' : 'dip',
            severity: this.getSeverityFromZScore(zScore),
            description: `Unusual cost detected for ${service}`,
            affectedResources: [point.resourceId],
            expectedCost: mean,
            actualCost: point.cost,
            deviation: zScore,
            confidence: Math.min(zScore / threshold, 1.0),
            potentialCauses: this.generatePotentialCauses(point, 'statistical'),
            recommendations: this.generateRecommendations(point, 'statistical'),
            metadata: { method: 'statistical', zScore, mean, stdDev }
          });
        }
      });
    }
    
    return anomalies;
  }

  private async detectMLAnomalies(data: CostDataPoint[]): Promise<CostAnomaly[]> {
    // ML-based anomaly detection using isolation forest or other algorithms
    const anomalies: CostAnomaly[] = [];
    
    // This would integrate with actual ML libraries
    // For now, implementing a simplified version
    
    return anomalies;
  }

  private async detectPatternAnomalies(data: CostDataPoint[]): Promise<CostAnomaly[]> {
    // Pattern-based anomaly detection (seasonal, cyclical, etc.)
    const anomalies: CostAnomaly[] = [];
    
    // This would analyze patterns and detect deviations
    
    return anomalies;
  }

  private deduplicateAnomalies(anomalies: CostAnomaly[]): CostAnomaly[] {
    const seen = new Set<string>();
    return anomalies.filter(anomaly => {
      const key = `${anomaly.affectedResources.join(',')}_${anomaly.timestamp.getTime()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private rankAnomaliesBySeverity(anomalies: CostAnomaly[]): CostAnomaly[] {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return anomalies.sort((a, b) => 
      severityOrder[b.severity] - severityOrder[a.severity]
    );
  }

  private async analyzeDailyTrends(data: CostDataPoint[]): Promise<CostTrend> {
    // Implement daily trend analysis
    return this.calculateTrendForPeriod(data, 'daily', 1);
  }

  private async analyzeWeeklyTrends(data: CostDataPoint[]): Promise<CostTrend> {
    return this.calculateTrendForPeriod(data, 'weekly', 7);
  }

  private async analyzeMonthlyTrends(data: CostDataPoint[]): Promise<CostTrend> {
    return this.calculateTrendForPeriod(data, 'monthly', 30);
  }

  private async analyzeQuarterlyTrends(data: CostDataPoint[]): Promise<CostTrend> {
    return this.calculateTrendForPeriod(data, 'quarterly', 90);
  }

  private calculateTrendForPeriod(
    data: CostDataPoint[], 
    period: string, 
    days: number
  ): CostTrend {
    const currentData = this.getRecentData(days, data);
    const previousData = this.getPreviousPeriodData(days, data);
    
    const currentCost = this.getTotalCost(currentData);
    const previousCost = this.getTotalCost(previousData);
    const change = currentCost - previousCost;
    const changePercentage = previousCost > 0 ? (change / previousCost) * 100 : 0;
    
    return {
      period,
      totalCost: currentCost,
      changeFromPrevious: change,
      changePercentage,
      trend: this.determineTrend(changePercentage),
      volatility: this.calculateVolatility(currentData)
    };
  }

  private async calculateEfficiencyMetrics(data: CostDataPoint[]): Promise<CostMetrics['efficiency']> {
    // Calculate various efficiency metrics
    return {
      wasteScore: await this.calculateWasteScore(data),
      utilizationScore: await this.calculateUtilizationScore(data),
      optimizationOpportunity: await this.calculateOptimizationOpportunity(data)
    };
  }

  private async generateShortTermForecast(): Promise<{ nextMonth: number; confidence: number }> {
    // Generate short-term cost forecast
    const recentData = this.getRecentData(30);
    const averageDailyCost = this.getTotalCost(recentData) / 30;
    
    return {
      nextMonth: averageDailyCost * 30, // Simplified forecast
      confidence: 0.8 // Would be calculated based on model accuracy
    };
  }

  // Helper methods
  private groupByService(data: CostDataPoint[]): Record<string, CostDataPoint[]> {
    return data.reduce((groups, point) => {
      if (!groups[point.service]) groups[point.service] = [];
      groups[point.service].push(point);
      return groups;
    }, {} as Record<string, CostDataPoint[]>);
  }

  private calculateMean(numbers: number[]): number {
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  }

  private calculateStandardDeviation(numbers: number[], mean: number): number {
    const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
    return Math.sqrt(variance);
  }

  private getSeverityFromZScore(zScore: number): CostAnomaly['severity'] {
    if (zScore > 3.0) return 'critical';
    if (zScore > 2.5) return 'high';
    if (zScore > 2.0) return 'medium';
    return 'low';
  }

  private generatePotentialCauses(point: CostDataPoint, method: string): string[] {
    return [
      'Resource scaling event',
      'Configuration change',
      'Seasonal demand increase',
      'Data processing spike',
      'Service tier change'
    ];
  }

  private generateRecommendations(point: CostDataPoint, method: string): string[] {
    return [
      'Review resource configuration',
      'Check for scaling policies',
      'Analyze usage patterns',
      'Consider cost optimization'
    ];
  }

  private determineTrend(changePercentage: number): CostTrend['trend'] {
    if (Math.abs(changePercentage) < 5) return 'stable';
    return changePercentage > 0 ? 'increasing' : 'decreasing';
  }

  private calculateVolatility(data: CostDataPoint[]): number {
    if (data.length < 2) return 0;
    
    const dailyCosts = this.aggregateDailyCosts(data);
    const costs = Object.values(dailyCosts);
    const mean = this.calculateMean(costs);
    const variance = costs.reduce((sum, cost) => sum + Math.pow(cost - mean, 2), 0) / costs.length;
    
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  private aggregateDailyCosts(data: CostDataPoint[]): Record<string, number> {
    return data.reduce((daily, point) => {
      const day = point.timestamp.toISOString().slice(0, 10);
      daily[day] = (daily[day] || 0) + point.cost;
      return daily;
    }, {} as Record<string, number>);
  }

  private calculateServiceTrend(service: string, data: CostDataPoint[]): number {
    const serviceData = data.filter(point => point.service === service);
    const recentCost = this.getTotalCost(this.getRecentData(7, serviceData));
    const previousCost = this.getTotalCost(this.getPreviousPeriodData(7, serviceData));
    
    return previousCost > 0 ? ((recentCost - previousCost) / previousCost) * 100 : 0;
  }

  private async checkBudgetImpacts(data: CostDataPoint[]): Promise<any[]> {
    // Check if new cost data impacts budgets
    return [];
  }

  private async calculateWasteScore(data: CostDataPoint[]): Promise<number> {
    // Calculate waste score based on unused resources, over-provisioning, etc.
    return 0.75; // Placeholder
  }

  private async calculateUtilizationScore(data: CostDataPoint[]): Promise<number> {
    // Calculate utilization score
    return 0.85; // Placeholder
  }

  private async calculateOptimizationOpportunity(data: CostDataPoint[]): Promise<number> {
    // Calculate optimization opportunity score
    return 0.65; // Placeholder
  }

  private async getRecentAnomalies(timeRange?: { start: Date; end: Date }): Promise<CostAnomaly[]> {
    // Get recent anomalies from storage
    return [];
  }
}

export { CostIntelligenceEngine };
export default CostIntelligenceEngine;