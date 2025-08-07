import { TemplateAnalytics, ScaffolderTemplate, TemplateExecution } from './types';

export class TemplateAnalyticsEngine {
  private static instance: TemplateAnalyticsEngine;
  private analytics: Map<string, AnalyticsData> = new Map();
  private metricsCollector: MetricsCollector;
  private trendAnalyzer: TrendAnalyzer;
  private usageTracker: UsageTracker;
  private performanceAnalyzer: PerformanceAnalyzer;

  private constructor() {
    this.metricsCollector = new MetricsCollector();
    this.trendAnalyzer = new TrendAnalyzer();
    this.usageTracker = new UsageTracker();
    this.performanceAnalyzer = new PerformanceAnalyzer();
    this.startPeriodicCollection();
  }

  static getInstance(): TemplateAnalyticsEngine {
    if (!this.instance) {
      this.instance = new TemplateAnalyticsEngine();
    }
    return this.instance;
  }

  /**
   * Get comprehensive analytics for a template
   */
  async getTemplateAnalytics(
    templateId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'week'
  ): Promise<TemplateAnalytics> {
    const data = await this.getAnalyticsData(templateId);
    const timeRange = this.getTimeRange(period);
    
    const metrics = this.calculateMetrics(data, timeRange);
    const trends = this.trendAnalyzer.calculateTrends(data, timeRange);

    return {
      templateId,
      period,
      metrics,
      trends,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Get dashboard analytics with overview metrics
   */
  async getDashboardAnalytics(
    userId?: string,
    period: 'day' | 'week' | 'month' | 'year' = 'week'
  ): Promise<DashboardAnalytics> {
    const timeRange = this.getTimeRange(period);
    const allData = Array.from(this.analytics.values());
    
    // Filter by user if specified
    const filteredData = userId 
      ? allData.filter(data => this.hasUserActivity(data, userId, timeRange))
      : allData;

    const overview = this.calculateOverviewMetrics(filteredData, timeRange);
    const topTemplates = this.getTopTemplates(filteredData, timeRange, 10);
    const categoryBreakdown = this.getCategoryBreakdown(filteredData, timeRange);
    const usagePatterns = this.analyzeUsagePatterns(filteredData, timeRange);
    const growthMetrics = this.calculateGrowthMetrics(filteredData, timeRange);

    return {
      period,
      overview,
      topTemplates,
      categoryBreakdown,
      usagePatterns,
      growthMetrics,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Track template execution
   */
  async trackExecution(execution: TemplateExecution): Promise<void> {
    const data = await this.getOrCreateAnalyticsData(execution.templateId);
    
    const executionData: ExecutionData = {
      id: execution.id,
      userId: execution.userId,
      timestamp: new Date(execution.startTime),
      duration: execution.endTime 
        ? new Date(execution.endTime).getTime() - new Date(execution.startTime).getTime()
        : undefined,
      success: execution.status === 'completed',
      parameters: execution.parameters,
      outputs: execution.outputs,
      error: execution.error
    };

    data.executions.push(executionData);
    
    // Update real-time metrics
    await this.updateRealTimeMetrics(execution.templateId, executionData);
  }

  /**
   * Track template view/access
   */
  async trackView(templateId: string, userId?: string, source?: string): Promise<void> {
    const data = await this.getOrCreateAnalyticsData(templateId);
    
    data.views.push({
      userId,
      timestamp: new Date(),
      source: source || 'direct'
    });

    // Update hourly view counts
    const hour = new Date().getHours();
    data.hourlyViews[hour] = (data.hourlyViews[hour] || 0) + 1;
  }

  /**
   * Track template download
   */
  async trackDownload(templateId: string, userId?: string): Promise<void> {
    const data = await this.getOrCreateAnalyticsData(templateId);
    
    data.downloads.push({
      userId,
      timestamp: new Date()
    });

    // Update download velocity
    await this.updateDownloadVelocity(templateId);
  }

  /**
   * Track template rating
   */
  async trackRating(
    templateId: string, 
    userId: string, 
    rating: number, 
    review?: string
  ): Promise<void> {
    const data = await this.getOrCreateAnalyticsData(templateId);
    
    // Remove existing rating from same user
    data.ratings = data.ratings.filter(r => r.userId !== userId);
    
    data.ratings.push({
      userId,
      rating,
      review,
      timestamp: new Date()
    });

    // Recalculate average rating
    const avgRating = data.ratings.reduce((sum, r) => sum + r.rating, 0) / data.ratings.length;
    data.averageRating = Math.round(avgRating * 10) / 10;
  }

  /**
   * Get usage trends over time
   */
  async getUsageTrends(
    templateId: string,
    period: 'day' | 'week' | 'month' | 'year',
    metric: 'views' | 'downloads' | 'executions' | 'success_rate'
  ): Promise<TrendData[]> {
    const data = await this.getAnalyticsData(templateId);
    return this.trendAnalyzer.getTrends(data, period, metric);
  }

  /**
   * Get comparative analytics between templates
   */
  async getComparativeAnalytics(templateIds: string[]): Promise<ComparativeAnalytics> {
    const comparisons: TemplateComparison[] = [];
    
    for (const templateId of templateIds) {
      const data = await this.getAnalyticsData(templateId);
      const metrics = this.calculateMetrics(data, this.getTimeRange('month'));
      
      comparisons.push({
        templateId,
        metrics: {
          views: metrics.views,
          downloads: metrics.downloads,
          executions: metrics.executions,
          successRate: metrics.successRate,
          averageRating: data.averageRating,
          userSatisfaction: metrics.userSatisfaction
        },
        trends: {
          viewsTrend: this.calculateTrendPercentage(data.views, 'week'),
          downloadsTrend: this.calculateTrendPercentage(data.downloads, 'week'),
          executionsTrend: this.calculateTrendPercentage(data.executions, 'week')
        }
      });
    }

    return {
      templates: comparisons,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Get performance analytics
   */
  async getPerformanceAnalytics(templateId: string): Promise<PerformanceAnalytics> {
    const data = await this.getAnalyticsData(templateId);
    return this.performanceAnalyzer.analyze(data);
  }

  /**
   * Get user behavior analytics
   */
  async getUserBehaviorAnalytics(
    templateId: string,
    timeRange?: DateRange
  ): Promise<UserBehaviorAnalytics> {
    const data = await this.getAnalyticsData(templateId);
    const range = timeRange || this.getTimeRange('month');
    
    return {
      uniqueUsers: this.countUniqueUsers(data, range),
      returningUsers: this.countReturningUsers(data, range),
      userJourney: this.analyzeUserJourney(data, range),
      conversionRates: this.calculateConversionRates(data, range),
      dropOffPoints: this.identifyDropOffPoints(data, range),
      engagementMetrics: this.calculateEngagementMetrics(data, range)
    };
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    templateId: string,
    format: 'json' | 'csv' | 'excel',
    period: 'day' | 'week' | 'month' | 'year'
  ): Promise<string | Buffer> {
    const analytics = await this.getTemplateAnalytics(templateId, period);
    const exporter = new AnalyticsExporter();
    
    switch (format) {
      case 'json':
        return JSON.stringify(analytics, null, 2);
      case 'csv':
        return exporter.toCsv(analytics);
      case 'excel':
        return exporter.toExcel(analytics);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Private helper methods
  private async getAnalyticsData(templateId: string): Promise<AnalyticsData> {
    const data = this.analytics.get(templateId);
    if (!data) {
      throw new Error(`No analytics data found for template ${templateId}`);
    }
    return data;
  }

  private async getOrCreateAnalyticsData(templateId: string): Promise<AnalyticsData> {
    let data = this.analytics.get(templateId);
    
    if (!data) {
      data = {
        templateId,
        views: [],
        downloads: [],
        executions: [],
        ratings: [],
        createdAt: new Date(),
        lastUpdated: new Date(),
        hourlyViews: {},
        dailyStats: new Map(),
        averageRating: 0
      };
      this.analytics.set(templateId, data);
    }
    
    return data;
  }

  private getTimeRange(period: string): DateRange {
    const now = new Date();
    const start = new Date();
    
    switch (period) {
      case 'day':
        start.setDate(now.getDate() - 1);
        break;
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return { start, end: now };
  }

  private calculateMetrics(data: AnalyticsData, timeRange: DateRange): any {
    const views = data.views.filter(v => 
      v.timestamp >= timeRange.start && v.timestamp <= timeRange.end
    );
    
    const downloads = data.downloads.filter(d => 
      d.timestamp >= timeRange.start && d.timestamp <= timeRange.end
    );
    
    const executions = data.executions.filter(e => 
      e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
    );
    
    const successfulExecutions = executions.filter(e => e.success);
    const avgExecutionTime = executions.length > 0
      ? executions
          .filter(e => e.duration)
          .reduce((sum, e) => sum + (e.duration || 0), 0) / executions.length
      : 0;

    return {
      views: views.length,
      downloads: downloads.length,
      executions: executions.length,
      successRate: executions.length > 0 ? successfulExecutions.length / executions.length : 0,
      avgExecutionTime,
      userSatisfaction: data.averageRating / 5, // Normalize to 0-1
      conversionRate: views.length > 0 ? executions.length / views.length : 0
    };
  }

  private calculateOverviewMetrics(data: AnalyticsData[], timeRange: DateRange): any {
    const totalViews = data.reduce((sum, d) => 
      sum + d.views.filter(v => 
        v.timestamp >= timeRange.start && v.timestamp <= timeRange.end
      ).length, 0
    );

    const totalDownloads = data.reduce((sum, d) => 
      sum + d.downloads.filter(dl => 
        dl.timestamp >= timeRange.start && dl.timestamp <= timeRange.end
      ).length, 0
    );

    const totalExecutions = data.reduce((sum, d) => 
      sum + d.executions.filter(e => 
        e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
      ).length, 0
    );

    const allExecutions = data.flatMap(d => 
      d.executions.filter(e => 
        e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
      )
    );

    const successfulExecutions = allExecutions.filter(e => e.success);
    
    return {
      totalViews,
      totalDownloads,
      totalExecutions,
      overallSuccessRate: allExecutions.length > 0 
        ? successfulExecutions.length / allExecutions.length 
        : 0,
      activeTemplates: data.filter(d => 
        d.executions.some(e => 
          e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
        )
      ).length,
      averageRating: this.calculateGlobalAverageRating(data)
    };
  }

  private getTopTemplates(
    data: AnalyticsData[], 
    timeRange: DateRange, 
    limit: number
  ): TopTemplate[] {
    return data
      .map(d => {
        const executions = d.executions.filter(e => 
          e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
        );
        
        return {
          templateId: d.templateId,
          executions: executions.length,
          successRate: executions.length > 0 
            ? executions.filter(e => e.success).length / executions.length 
            : 0,
          averageRating: d.averageRating,
          downloads: d.downloads.filter(dl => 
            dl.timestamp >= timeRange.start && dl.timestamp <= timeRange.end
          ).length
        };
      })
      .sort((a, b) => b.executions - a.executions)
      .slice(0, limit);
  }

  private getCategoryBreakdown(data: AnalyticsData[], timeRange: DateRange): any {
    // This would need template metadata to categorize
    // For now, return mock data
    return {
      'Frontend': 35,
      'Backend': 28,
      'Full Stack': 20,
      'Infrastructure': 12,
      'Library': 5
    };
  }

  private analyzeUsagePatterns(data: AnalyticsData[], timeRange: DateRange): UsagePattern[] {
    const hourlyUsage = new Array(24).fill(0);
    const dailyUsage = new Map<string, number>();
    
    data.forEach(d => {
      d.executions
        .filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end)
        .forEach(e => {
          // Hour analysis
          const hour = e.timestamp.getHours();
          hourlyUsage[hour]++;
          
          // Daily analysis
          const day = e.timestamp.toDateString();
          dailyUsage.set(day, (dailyUsage.get(day) || 0) + 1);
        });
    });

    return [
      {
        pattern: 'Peak Hours',
        data: hourlyUsage.map((count, hour) => ({ hour, count })),
        insight: `Peak usage at ${hourlyUsage.indexOf(Math.max(...hourlyUsage))}:00`
      },
      {
        pattern: 'Daily Distribution',
        data: Array.from(dailyUsage.entries()).map(([day, count]) => ({ day, count })),
        insight: `Most active day had ${Math.max(...Array.from(dailyUsage.values()))} executions`
      }
    ];
  }

  private calculateGrowthMetrics(data: AnalyticsData[], timeRange: DateRange): GrowthMetrics {
    const currentPeriodExecutions = data.reduce((sum, d) => 
      sum + d.executions.filter(e => 
        e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
      ).length, 0
    );

    // Calculate previous period for comparison
    const periodLength = timeRange.end.getTime() - timeRange.start.getTime();
    const previousStart = new Date(timeRange.start.getTime() - periodLength);
    const previousEnd = timeRange.start;

    const previousPeriodExecutions = data.reduce((sum, d) => 
      sum + d.executions.filter(e => 
        e.timestamp >= previousStart && e.timestamp <= previousEnd
      ).length, 0
    );

    const executionGrowth = previousPeriodExecutions > 0 
      ? ((currentPeriodExecutions - previousPeriodExecutions) / previousPeriodExecutions) * 100
      : 0;

    return {
      executionGrowth,
      userGrowth: this.calculateUserGrowth(data, timeRange),
      templateGrowth: this.calculateTemplateGrowth(data, timeRange),
      engagementGrowth: this.calculateEngagementGrowth(data, timeRange)
    };
  }

  private calculateUserGrowth(data: AnalyticsData[], timeRange: DateRange): number {
    // Mock implementation
    return 15.5;
  }

  private calculateTemplateGrowth(data: AnalyticsData[], timeRange: DateRange): number {
    // Mock implementation
    return 8.2;
  }

  private calculateEngagementGrowth(data: AnalyticsData[], timeRange: DateRange): number {
    // Mock implementation
    return 12.8;
  }

  private calculateGlobalAverageRating(data: AnalyticsData[]): number {
    const allRatings = data.flatMap(d => d.ratings);
    if (allRatings.length === 0) return 0;
    
    const sum = allRatings.reduce((total, r) => total + r.rating, 0);
    return Math.round((sum / allRatings.length) * 10) / 10;
  }

  private hasUserActivity(data: AnalyticsData, userId: string, timeRange: DateRange): boolean {
    return data.executions.some(e => 
      e.userId === userId && 
      e.timestamp >= timeRange.start && 
      e.timestamp <= timeRange.end
    );
  }

  private countUniqueUsers(data: AnalyticsData, timeRange: DateRange): number {
    const userIds = new Set();
    
    data.executions
      .filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end)
      .forEach(e => userIds.add(e.userId));
      
    return userIds.size;
  }

  private countReturningUsers(data: AnalyticsData, timeRange: DateRange): number {
    const userActivity = new Map<string, Date[]>();
    
    data.executions
      .filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end)
      .forEach(e => {
        const dates = userActivity.get(e.userId) || [];
        dates.push(e.timestamp);
        userActivity.set(e.userId, dates);
      });
      
    return Array.from(userActivity.values()).filter(dates => dates.length > 1).length;
  }

  private analyzeUserJourney(data: AnalyticsData, timeRange: DateRange): UserJourneyStep[] {
    // Simplified user journey analysis
    return [
      { step: 'Discovery', users: 1000, conversionRate: 1.0 },
      { step: 'View Details', users: 650, conversionRate: 0.65 },
      { step: 'Start Execution', users: 420, conversionRate: 0.65 },
      { step: 'Complete Execution', users: 380, conversionRate: 0.90 },
      { step: 'Rate Template', users: 95, conversionRate: 0.25 }
    ];
  }

  private calculateConversionRates(data: AnalyticsData, timeRange: DateRange): ConversionRates {
    const views = data.views.filter(v => 
      v.timestamp >= timeRange.start && v.timestamp <= timeRange.end
    ).length;
    
    const downloads = data.downloads.filter(d => 
      d.timestamp >= timeRange.start && d.timestamp <= timeRange.end
    ).length;
    
    const executions = data.executions.filter(e => 
      e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
    ).length;

    return {
      viewToDownload: views > 0 ? downloads / views : 0,
      viewToExecution: views > 0 ? executions / views : 0,
      downloadToExecution: downloads > 0 ? executions / downloads : 0
    };
  }

  private identifyDropOffPoints(data: AnalyticsData, timeRange: DateRange): DropOffPoint[] {
    // Mock implementation of drop-off analysis
    return [
      { point: 'Parameter Configuration', dropOffRate: 0.25, suggestions: ['Simplify parameters', 'Add help text'] },
      { point: 'Execution Start', dropOffRate: 0.15, suggestions: ['Improve error messages', 'Add progress indicators'] },
      { point: 'Mid Execution', dropOffRate: 0.10, suggestions: ['Reduce execution time', 'Better error handling'] }
    ];
  }

  private calculateEngagementMetrics(data: AnalyticsData, timeRange: DateRange): EngagementMetrics {
    const executions = data.executions.filter(e => 
      e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
    );

    const avgSessionDuration = executions.length > 0
      ? executions.reduce((sum, e) => sum + (e.duration || 0), 0) / executions.length
      : 0;

    return {
      avgSessionDuration,
      repeatUsageRate: this.calculateRepeatUsageRate(data, timeRange),
      timeToComplete: avgSessionDuration,
      abandonmentRate: this.calculateAbandonmentRate(data, timeRange)
    };
  }

  private calculateRepeatUsageRate(data: AnalyticsData, timeRange: DateRange): number {
    const userExecutions = new Map<string, number>();
    
    data.executions
      .filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end)
      .forEach(e => {
        userExecutions.set(e.userId, (userExecutions.get(e.userId) || 0) + 1);
      });

    const repeatUsers = Array.from(userExecutions.values()).filter(count => count > 1).length;
    const totalUsers = userExecutions.size;
    
    return totalUsers > 0 ? repeatUsers / totalUsers : 0;
  }

  private calculateAbandonmentRate(data: AnalyticsData, timeRange: DateRange): number {
    const executions = data.executions.filter(e => 
      e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
    );

    const abandonedExecutions = executions.filter(e => !e.success && e.duration && e.duration < 60000); // Less than 1 minute
    
    return executions.length > 0 ? abandonedExecutions.length / executions.length : 0;
  }

  private calculateTrendPercentage(items: any[], period: string): number {
    // Simplified trend calculation
    const now = new Date();
    const periodMs = period === 'week' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    
    const currentPeriod = items.filter(item => 
      now.getTime() - new Date(item.timestamp).getTime() < periodMs
    ).length;
    
    const previousPeriod = items.filter(item => {
      const itemTime = new Date(item.timestamp).getTime();
      return itemTime >= (now.getTime() - 2 * periodMs) && itemTime < (now.getTime() - periodMs);
    }).length;

    if (previousPeriod === 0) return currentPeriod > 0 ? 100 : 0;
    
    return ((currentPeriod - previousPeriod) / previousPeriod) * 100;
  }

  private async updateRealTimeMetrics(templateId: string, executionData: ExecutionData): Promise<void> {
    // Update real-time metrics for dashboards
    const data = this.analytics.get(templateId);
    if (!data) return;

    data.lastUpdated = new Date();
    
    // Update daily stats
    const today = new Date().toDateString();
    const dayStats = data.dailyStats.get(today) || {
      executions: 0,
      successes: 0,
      failures: 0,
      totalDuration: 0
    };

    dayStats.executions++;
    if (executionData.success) {
      dayStats.successes++;
    } else {
      dayStats.failures++;
    }
    
    if (executionData.duration) {
      dayStats.totalDuration += executionData.duration;
    }

    data.dailyStats.set(today, dayStats);
  }

  private async updateDownloadVelocity(templateId: string): Promise<void> {
    // Track download velocity for trending calculations
    const data = this.analytics.get(templateId);
    if (!data) return;

    // This would update velocity metrics for the recommendation engine
  }

  private startPeriodicCollection(): void {
    // Start periodic collection of metrics every 5 minutes
    setInterval(async () => {
      try {
        await this.collectPeriodMetrics();
      } catch (error) {
        console.error('Error collecting periodic metrics:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  private async collectPeriodMetrics(): Promise<void> {
    // Collect and aggregate metrics for all templates
    for (const [templateId, data] of this.analytics.entries()) {
      // Update aggregated metrics
      await this.metricsCollector.collect(templateId, data);
    }
  }
}

// Supporting classes
class MetricsCollector {
  async collect(templateId: string, data: AnalyticsData): Promise<void> {
    // Collect and process metrics
    const metrics = {
      templateId,
      timestamp: new Date(),
      totalViews: data.views.length,
      totalDownloads: data.downloads.length,
      totalExecutions: data.executions.length,
      successRate: this.calculateSuccessRate(data.executions),
      averageRating: data.averageRating
    };

    // In a real implementation, this would store metrics in a time-series database
    console.log('Collected metrics for template:', templateId, metrics);
  }

  private calculateSuccessRate(executions: ExecutionData[]): number {
    if (executions.length === 0) return 0;
    const successful = executions.filter(e => e.success).length;
    return successful / executions.length;
  }
}

class TrendAnalyzer {
  calculateTrends(data: AnalyticsData, timeRange: DateRange): TrendData[] {
    // Calculate trends for various metrics
    return [
      this.calculateViewsTrend(data, timeRange),
      this.calculateDownloadsTrend(data, timeRange),
      this.calculateExecutionsTrend(data, timeRange)
    ];
  }

  getTrends(
    data: AnalyticsData, 
    period: string, 
    metric: string
  ): TrendData[] {
    // Get specific trend data
    const dataPoints: TrendData[] = [];
    const now = new Date();
    const intervals = this.getIntervals(period, 30); // Get 30 data points

    for (const interval of intervals) {
      const count = this.getMetricCount(data, metric, interval);
      dataPoints.push({
        timestamp: interval.start.toISOString(),
        value: count
      });
    }

    return dataPoints;
  }

  private calculateViewsTrend(data: AnalyticsData, timeRange: DateRange): TrendData {
    const views = data.views.filter(v => 
      v.timestamp >= timeRange.start && v.timestamp <= timeRange.end
    );

    return {
      timestamp: new Date().toISOString(),
      value: views.length,
      change: this.calculateChange(views, timeRange),
      changePercent: this.calculateChangePercent(views, timeRange)
    };
  }

  private calculateDownloadsTrend(data: AnalyticsData, timeRange: DateRange): TrendData {
    const downloads = data.downloads.filter(d => 
      d.timestamp >= timeRange.start && d.timestamp <= timeRange.end
    );

    return {
      timestamp: new Date().toISOString(),
      value: downloads.length,
      change: this.calculateChange(downloads, timeRange),
      changePercent: this.calculateChangePercent(downloads, timeRange)
    };
  }

  private calculateExecutionsTrend(data: AnalyticsData, timeRange: DateRange): TrendData {
    const executions = data.executions.filter(e => 
      e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
    );

    return {
      timestamp: new Date().toISOString(),
      value: executions.length,
      change: this.calculateChange(executions, timeRange),
      changePercent: this.calculateChangePercent(executions, timeRange)
    };
  }

  private getIntervals(period: string, count: number): DateRange[] {
    const intervals: DateRange[] = [];
    const now = new Date();
    
    let intervalMs: number;
    switch (period) {
      case 'day':
        intervalMs = 60 * 60 * 1000; // 1 hour intervals
        break;
      case 'week':
        intervalMs = 24 * 60 * 60 * 1000; // 1 day intervals
        break;
      case 'month':
        intervalMs = 24 * 60 * 60 * 1000; // 1 day intervals
        break;
      case 'year':
        intervalMs = 30 * 24 * 60 * 60 * 1000; // 30 day intervals
        break;
      default:
        intervalMs = 24 * 60 * 60 * 1000;
    }

    for (let i = count - 1; i >= 0; i--) {
      const end = new Date(now.getTime() - i * intervalMs);
      const start = new Date(end.getTime() - intervalMs);
      intervals.push({ start, end });
    }

    return intervals;
  }

  private getMetricCount(data: AnalyticsData, metric: string, timeRange: DateRange): number {
    switch (metric) {
      case 'views':
        return data.views.filter(v => 
          v.timestamp >= timeRange.start && v.timestamp <= timeRange.end
        ).length;
      case 'downloads':
        return data.downloads.filter(d => 
          d.timestamp >= timeRange.start && d.timestamp <= timeRange.end
        ).length;
      case 'executions':
        return data.executions.filter(e => 
          e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
        ).length;
      case 'success_rate':
        const execs = data.executions.filter(e => 
          e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
        );
        if (execs.length === 0) return 0;
        return execs.filter(e => e.success).length / execs.length;
      default:
        return 0;
    }
  }

  private calculateChange(items: any[], timeRange: DateRange): number {
    const periodLength = timeRange.end.getTime() - timeRange.start.getTime();
    const previousStart = new Date(timeRange.start.getTime() - periodLength);
    const previousEnd = timeRange.start;

    const previousCount = items.filter(item =>
      item.timestamp >= previousStart && item.timestamp <= previousEnd
    ).length;

    return items.length - previousCount;
  }

  private calculateChangePercent(items: any[], timeRange: DateRange): number {
    const change = this.calculateChange(items, timeRange);
    const periodLength = timeRange.end.getTime() - timeRange.start.getTime();
    const previousStart = new Date(timeRange.start.getTime() - periodLength);
    const previousEnd = timeRange.start;

    const previousCount = items.filter(item =>
      item.timestamp >= previousStart && item.timestamp <= previousEnd
    ).length;

    if (previousCount === 0) return change > 0 ? 100 : 0;
    return (change / previousCount) * 100;
  }
}

class UsageTracker {
  track(event: string, data: any): void {
    // Track usage events for analytics
    console.log('Usage event:', event, data);
  }
}

class PerformanceAnalyzer {
  analyze(data: AnalyticsData): PerformanceAnalytics {
    const executions = data.executions.filter(e => e.duration);
    
    if (executions.length === 0) {
      return {
        averageExecutionTime: 0,
        medianExecutionTime: 0,
        p95ExecutionTime: 0,
        successRate: 0,
        errorDistribution: {},
        performanceScore: 0
      };
    }

    const durations = executions.map(e => e.duration!).sort((a, b) => a - b);
    const successful = executions.filter(e => e.success).length;

    return {
      averageExecutionTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      medianExecutionTime: durations[Math.floor(durations.length / 2)],
      p95ExecutionTime: durations[Math.floor(durations.length * 0.95)],
      successRate: successful / executions.length,
      errorDistribution: this.analyzeErrors(data.executions),
      performanceScore: this.calculatePerformanceScore(data)
    };
  }

  private analyzeErrors(executions: ExecutionData[]): Record<string, number> {
    const errors: Record<string, number> = {};
    
    executions
      .filter(e => !e.success && e.error)
      .forEach(e => {
        const errorCode = e.error?.code || 'UNKNOWN';
        errors[errorCode] = (errors[errorCode] || 0) + 1;
      });

    return errors;
  }

  private calculatePerformanceScore(data: AnalyticsData): number {
    // Calculate a performance score from 0-100
    const executions = data.executions;
    if (executions.length === 0) return 0;

    const successRate = executions.filter(e => e.success).length / executions.length;
    const avgDuration = executions
      .filter(e => e.duration)
      .reduce((sum, e) => sum + e.duration!, 0) / executions.length;

    // Score based on success rate (70%) and execution time (30%)
    const successScore = successRate * 70;
    const timeScore = Math.max(0, 30 - (avgDuration / 1000) * 0.1); // Penalize long execution times

    return Math.min(100, successScore + timeScore);
  }
}

class AnalyticsExporter {
  toCsv(analytics: TemplateAnalytics): string {
    // Convert analytics to CSV format
    const rows = [
      ['Metric', 'Value'],
      ['Views', analytics.metrics.views.toString()],
      ['Downloads', analytics.metrics.downloads.toString()],
      ['Executions', analytics.metrics.executions.toString()],
      ['Success Rate', (analytics.metrics.successRate * 100).toFixed(2) + '%'],
      ['Average Rating', analytics.metrics.userSatisfaction.toString()]
    ];

    return rows.map(row => row.join(',')).join('\n');
  }

  toExcel(analytics: TemplateAnalytics): Buffer {
    // Convert analytics to Excel format
    // This would use a library like xlsx in a real implementation
    return Buffer.from(this.toCsv(analytics));
  }
}

// Type definitions
interface AnalyticsData {
  templateId: string;
  views: ViewData[];
  downloads: DownloadData[];
  executions: ExecutionData[];
  ratings: RatingData[];
  createdAt: Date;
  lastUpdated: Date;
  hourlyViews: Record<number, number>;
  dailyStats: Map<string, DayStats>;
  averageRating: number;
}

interface ViewData {
  userId?: string;
  timestamp: Date;
  source: string;
}

interface DownloadData {
  userId?: string;
  timestamp: Date;
}

interface ExecutionData {
  id: string;
  userId: string;
  timestamp: Date;
  duration?: number;
  success: boolean;
  parameters: Record<string, any>;
  outputs: any[];
  error?: {
    message: string;
    code: string;
  };
}

interface RatingData {
  userId: string;
  rating: number;
  review?: string;
  timestamp: Date;
}

interface DayStats {
  executions: number;
  successes: number;
  failures: number;
  totalDuration: number;
}

interface DateRange {
  start: Date;
  end: Date;
}

interface DashboardAnalytics {
  period: string;
  overview: any;
  topTemplates: TopTemplate[];
  categoryBreakdown: any;
  usagePatterns: UsagePattern[];
  growthMetrics: GrowthMetrics;
  generatedAt: string;
}

interface TopTemplate {
  templateId: string;
  executions: number;
  successRate: number;
  averageRating: number;
  downloads: number;
}

interface UsagePattern {
  pattern: string;
  data: any[];
  insight: string;
}

interface GrowthMetrics {
  executionGrowth: number;
  userGrowth: number;
  templateGrowth: number;
  engagementGrowth: number;
}

interface TrendData {
  timestamp: string;
  value: number;
  change?: number;
  changePercent?: number;
}

interface ComparativeAnalytics {
  templates: TemplateComparison[];
  generatedAt: string;
}

interface TemplateComparison {
  templateId: string;
  metrics: {
    views: number;
    downloads: number;
    executions: number;
    successRate: number;
    averageRating: number;
    userSatisfaction: number;
  };
  trends: {
    viewsTrend: number;
    downloadsTrend: number;
    executionsTrend: number;
  };
}

interface PerformanceAnalytics {
  averageExecutionTime: number;
  medianExecutionTime: number;
  p95ExecutionTime: number;
  successRate: number;
  errorDistribution: Record<string, number>;
  performanceScore: number;
}

interface UserBehaviorAnalytics {
  uniqueUsers: number;
  returningUsers: number;
  userJourney: UserJourneyStep[];
  conversionRates: ConversionRates;
  dropOffPoints: DropOffPoint[];
  engagementMetrics: EngagementMetrics;
}

interface UserJourneyStep {
  step: string;
  users: number;
  conversionRate: number;
}

interface ConversionRates {
  viewToDownload: number;
  viewToExecution: number;
  downloadToExecution: number;
}

interface DropOffPoint {
  point: string;
  dropOffRate: number;
  suggestions: string[];
}

interface EngagementMetrics {
  avgSessionDuration: number;
  repeatUsageRate: number;
  timeToComplete: number;
  abandonmentRate: number;
}