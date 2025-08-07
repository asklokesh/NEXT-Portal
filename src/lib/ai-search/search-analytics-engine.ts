import { OpenAI } from 'openai';
import * as tf from '@tensorflow/tfjs-node';
import { Redis } from 'ioredis';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { logger } from '../monitoring/logger';

export interface SearchMetrics {
  totalSearches: number;
  uniqueUsers: number;
  averageResponseTime: number;
  clickThroughRate: number;
  zeroResultRate: number;
  refinementRate: number;
  averageDwellTime: number;
  bounceRate: number;
}

export interface SearchPattern {
  pattern: string;
  frequency: number;
  successRate: number;
  averageResultCount: number;
  commonRefinements: string[];
  userSegments: string[];
}

export interface SearchAnomaly {
  type: 'spike' | 'drop' | 'unusual_query' | 'performance_degradation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  description: string;
  affectedQueries: string[];
  recommendation: string;
}

export interface SearchInsight {
  type: 'trend' | 'opportunity' | 'issue' | 'recommendation';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  actionItems: string[];
  relatedMetrics: Record<string, number>;
}

export interface SearchForecast {
  period: string;
  predictedVolume: number;
  confidence: number;
  trends: string[];
  recommendations: string[];
}

export class SearchAnalyticsEngine {
  private openai: OpenAI;
  private redis: Redis;
  private influx: InfluxDB;
  private analyticsModel?: tf.LayersModel;
  private anomalyDetector?: tf.LayersModel;
  private forecastModel?: tf.LayersModel;
  private metricsCache: Map<string, any> = new Map();

  constructor(
    openaiApiKey: string,
    redisUrl?: string,
    influxConfig?: { url: string; token: string; org: string; bucket: string }
  ) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.redis = new Redis(redisUrl || 'redis://localhost:6379');
    
    if (influxConfig) {
      this.influx = new InfluxDB({
        url: influxConfig.url,
        token: influxConfig.token
      });
    }

    this.initializeModels();
    this.startMetricsCollection();
  }

  private async initializeModels() {
    try {
      this.analyticsModel = await this.createAnalyticsModel();
      this.anomalyDetector = await this.createAnomalyDetector();
      this.forecastModel = await this.createForecastModel();
      logger.info('Search analytics models initialized');
    } catch (error) {
      logger.error('Failed to initialize analytics models', error);
    }
  }

  private async createAnalyticsModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [20], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 5, activation: 'softmax' }) // 5 insight categories
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  private async createAnomalyDetector(): Promise<tf.LayersModel> {
    // Autoencoder for anomaly detection
    const encoder = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [50], units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 8, activation: 'relu' }) // Bottleneck
      ]
    });

    const decoder = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [8], units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 50, activation: 'sigmoid' })
      ]
    });

    const autoencoder = tf.sequential({
      layers: [...encoder.layers, ...decoder.layers]
    });

    autoencoder.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });

    return autoencoder;
  }

  private async createForecastModel(): Promise<tf.LayersModel> {
    // LSTM for time series forecasting
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          inputShape: [30, 5], // 30 time steps, 5 features
          units: 50,
          returnSequences: true
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({ units: 50, returnSequences: false }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 25, activation: 'relu' }),
        tf.layers.dense({ units: 1 }) // Predicted search volume
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    return model;
  }

  private startMetricsCollection() {
    // Collect metrics every minute
    setInterval(async () => {
      await this.collectRealTimeMetrics();
    }, 60000);

    // Run analysis every hour
    setInterval(async () => {
      await this.runComprehensiveAnalysis();
    }, 3600000);
  }

  private async collectRealTimeMetrics() {
    try {
      const now = new Date();
      const metrics = await this.calculateCurrentMetrics();
      
      // Store in time series database
      if (this.influx) {
        const writeApi = this.influx.getWriteApi('org', 'search-metrics');
        
        const point = new Point('search_metrics')
          .timestamp(now)
          .floatField('total_searches', metrics.totalSearches)
          .floatField('unique_users', metrics.uniqueUsers)
          .floatField('avg_response_time', metrics.averageResponseTime)
          .floatField('click_through_rate', metrics.clickThroughRate)
          .floatField('zero_result_rate', metrics.zeroResultRate);
        
        await writeApi.writePoint(point);
        await writeApi.close();
      }
      
      // Cache current metrics
      this.metricsCache.set('current', metrics);
      
      // Check for anomalies
      const anomalies = await this.detectAnomalies(metrics);
      if (anomalies.length > 0) {
        await this.handleAnomalies(anomalies);
      }
    } catch (error) {
      logger.error('Failed to collect metrics', error);
    }
  }

  private async calculateCurrentMetrics(): Promise<SearchMetrics> {
    const window = 3600000; // 1 hour window
    const now = Date.now();
    const startTime = now - window;

    // Get search logs from Redis
    const logs = await this.redis.lrange('search:logs', 0, -1);
    const recentLogs = logs
      .map(l => JSON.parse(l))
      .filter(l => new Date(l.timestamp).getTime() > startTime);

    // Calculate metrics
    const uniqueUsers = new Set(recentLogs.map(l => l.userId)).size;
    const totalSearches = recentLogs.length;
    
    const clickedSearches = recentLogs.filter(l => l.clickedResult).length;
    const clickThroughRate = totalSearches > 0 ? clickedSearches / totalSearches : 0;
    
    const zeroResults = recentLogs.filter(l => l.resultCount === 0).length;
    const zeroResultRate = totalSearches > 0 ? zeroResults / totalSearches : 0;
    
    const refinements = recentLogs.filter(l => l.refined).length;
    const refinementRate = totalSearches > 0 ? refinements / totalSearches : 0;
    
    const responseTimes = recentLogs.map(l => l.responseTime || 0);
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    
    const dwellTimes = recentLogs
      .filter(l => l.dwellTime)
      .map(l => l.dwellTime);
    const averageDwellTime = dwellTimes.length > 0
      ? dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length
      : 0;
    
    const bounces = recentLogs.filter(l => l.dwellTime && l.dwellTime < 5000).length;
    const bounceRate = clickedSearches > 0 ? bounces / clickedSearches : 0;

    return {
      totalSearches,
      uniqueUsers,
      averageResponseTime,
      clickThroughRate,
      zeroResultRate,
      refinementRate,
      averageDwellTime,
      bounceRate
    };
  }

  // Detect anomalies in search patterns
  async detectAnomalies(currentMetrics: SearchMetrics): Promise<SearchAnomaly[]> {
    const anomalies: SearchAnomaly[] = [];
    
    // Get historical metrics for comparison
    const historicalMetrics = await this.getHistoricalMetrics(7); // Last 7 days
    
    if (!historicalMetrics || historicalMetrics.length === 0) {
      return anomalies;
    }
    
    // Calculate statistical thresholds
    const avgSearches = historicalMetrics.reduce((sum, m) => sum + m.totalSearches, 0) / historicalMetrics.length;
    const stdDevSearches = Math.sqrt(
      historicalMetrics.reduce((sum, m) => sum + Math.pow(m.totalSearches - avgSearches, 2), 0) / historicalMetrics.length
    );
    
    // Check for search volume anomalies
    if (currentMetrics.totalSearches > avgSearches + 3 * stdDevSearches) {
      anomalies.push({
        type: 'spike',
        severity: 'high',
        timestamp: new Date(),
        description: `Search volume spike detected: ${currentMetrics.totalSearches} searches (${Math.round((currentMetrics.totalSearches / avgSearches - 1) * 100)}% above average)`,
        affectedQueries: await this.getTopQueries(10),
        recommendation: 'Check for automated traffic or special events. Consider scaling search infrastructure.'
      });
    }
    
    if (currentMetrics.totalSearches < avgSearches - 3 * stdDevSearches) {
      anomalies.push({
        type: 'drop',
        severity: 'medium',
        timestamp: new Date(),
        description: `Search volume drop detected: ${currentMetrics.totalSearches} searches (${Math.round((1 - currentMetrics.totalSearches / avgSearches) * 100)}% below average)`,
        affectedQueries: [],
        recommendation: 'Check for service issues or UI problems preventing search usage.'
      });
    }
    
    // Check for performance degradation
    const avgResponseTime = historicalMetrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / historicalMetrics.length;
    if (currentMetrics.averageResponseTime > avgResponseTime * 2) {
      anomalies.push({
        type: 'performance_degradation',
        severity: 'critical',
        timestamp: new Date(),
        description: `Search performance degradation: ${Math.round(currentMetrics.averageResponseTime)}ms average response time`,
        affectedQueries: await this.getSlowQueries(5),
        recommendation: 'Investigate database performance, check index health, review recent deployments.'
      });
    }
    
    // Check for high zero result rate
    if (currentMetrics.zeroResultRate > 0.3) {
      anomalies.push({
        type: 'unusual_query',
        severity: 'medium',
        timestamp: new Date(),
        description: `High zero result rate: ${Math.round(currentMetrics.zeroResultRate * 100)}% of searches returning no results`,
        affectedQueries: await this.getZeroResultQueries(10),
        recommendation: 'Review zero-result queries for missing content or indexing issues.'
      });
    }
    
    // Use ML model for advanced anomaly detection
    if (this.anomalyDetector) {
      const anomalyScore = await this.detectMLAnomalies(currentMetrics);
      if (anomalyScore > 0.8) {
        anomalies.push({
          type: 'unusual_query',
          severity: 'low',
          timestamp: new Date(),
          description: 'ML model detected unusual search patterns',
          affectedQueries: [],
          recommendation: 'Review recent search patterns for unexpected behavior.'
        });
      }
    }
    
    return anomalies;
  }

  private async detectMLAnomalies(metrics: SearchMetrics): Promise<number> {
    if (!this.anomalyDetector) return 0;
    
    // Prepare input features
    const features = [
      metrics.totalSearches,
      metrics.uniqueUsers,
      metrics.averageResponseTime,
      metrics.clickThroughRate,
      metrics.zeroResultRate,
      metrics.refinementRate,
      metrics.averageDwellTime,
      metrics.bounceRate
    ];
    
    // Normalize features
    const normalized = features.map(f => f / 1000); // Simple normalization
    
    // Pad to expected input size
    while (normalized.length < 50) {
      normalized.push(0);
    }
    
    // Run through autoencoder
    const input = tf.tensor2d([normalized]);
    const reconstructed = this.anomalyDetector.predict(input) as tf.Tensor;
    
    // Calculate reconstruction error
    const error = tf.losses.meanSquaredError(input, reconstructed);
    const errorValue = await error.data();
    
    // Clean up tensors
    input.dispose();
    reconstructed.dispose();
    error.dispose();
    
    return errorValue[0];
  }

  // Generate ML-powered insights
  async generateInsights(): Promise<SearchInsight[]> {
    const insights: SearchInsight[] = [];
    const metrics = await this.calculateCurrentMetrics();
    const patterns = await this.analyzeSearchPatterns();
    
    // Use GPT for insight generation
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Analyze search metrics and provide actionable insights for improving search experience.'
        },
        {
          role: 'user',
          content: `Current Metrics:
- Total Searches: ${metrics.totalSearches}
- Click-through Rate: ${Math.round(metrics.clickThroughRate * 100)}%
- Zero Result Rate: ${Math.round(metrics.zeroResultRate * 100)}%
- Average Response Time: ${Math.round(metrics.averageResponseTime)}ms
- Bounce Rate: ${Math.round(metrics.bounceRate * 100)}%

Top Search Patterns:
${patterns.slice(0, 5).map(p => `- "${p.pattern}": ${p.frequency} searches, ${Math.round(p.successRate * 100)}% success`).join('\n')}

Generate 3 actionable insights with specific recommendations.`
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    
    // Parse GPT insights
    const gptInsights = this.parseGPTInsights(completion.choices[0].message.content || '');
    insights.push(...gptInsights);
    
    // Add metric-based insights
    if (metrics.clickThroughRate < 0.3) {
      insights.push({
        type: 'issue',
        title: 'Low Click-through Rate',
        description: `Only ${Math.round(metrics.clickThroughRate * 100)}% of searches result in clicks`,
        impact: 'high',
        actionItems: [
          'Review search result relevance',
          'Improve result titles and descriptions',
          'Add result previews or snippets',
          'Implement result highlighting'
        ],
        relatedMetrics: {
          clickThroughRate: metrics.clickThroughRate,
          bounceRate: metrics.bounceRate
        }
      });
    }
    
    if (metrics.zeroResultRate > 0.15) {
      insights.push({
        type: 'opportunity',
        title: 'High Zero Result Queries',
        description: `${Math.round(metrics.zeroResultRate * 100)}% of searches return no results`,
        impact: 'medium',
        actionItems: [
          'Analyze zero-result queries for missing content',
          'Implement fuzzy matching',
          'Add synonym support',
          'Create content for common zero-result queries'
        ],
        relatedMetrics: {
          zeroResultRate: metrics.zeroResultRate,
          refinementRate: metrics.refinementRate
        }
      });
    }
    
    // Trend insights
    const trends = await this.identifyTrends();
    if (trends.length > 0) {
      insights.push({
        type: 'trend',
        title: 'Emerging Search Trends',
        description: `New search patterns detected: ${trends.slice(0, 3).join(', ')}`,
        impact: 'medium',
        actionItems: [
          'Create content for trending topics',
          'Update search suggestions',
          'Optimize for new query patterns'
        ],
        relatedMetrics: {
          trendingQueries: trends.length
        }
      });
    }
    
    return insights;
  }

  private parseGPTInsights(content: string): SearchInsight[] {
    // Simple parsing - in production, use structured output
    const insights: SearchInsight[] = [];
    const lines = content.split('\n');
    
    let currentInsight: Partial<SearchInsight> | null = null;
    
    lines.forEach(line => {
      if (line.match(/^\d+\./)) {
        if (currentInsight) {
          insights.push(currentInsight as SearchInsight);
        }
        currentInsight = {
          type: 'recommendation',
          title: line.replace(/^\d+\.\s*/, '').split(':')[0],
          description: '',
          impact: 'medium',
          actionItems: [],
          relatedMetrics: {}
        };
      } else if (currentInsight && line.trim()) {
        if (line.includes('-')) {
          currentInsight.actionItems?.push(line.replace(/^-\s*/, ''));
        } else {
          currentInsight.description += line + ' ';
        }
      }
    });
    
    if (currentInsight) {
      insights.push(currentInsight as SearchInsight);
    }
    
    return insights;
  }

  // Analyze search patterns
  async analyzeSearchPatterns(): Promise<SearchPattern[]> {
    const patterns: SearchPattern[] = [];
    
    // Get search logs
    const logs = await this.redis.lrange('search:logs', 0, 1000);
    const searches = logs.map(l => JSON.parse(l));
    
    // Group by query pattern
    const queryGroups = new Map<string, any[]>();
    
    searches.forEach(search => {
      const normalized = this.normalizeQuery(search.query);
      if (!queryGroups.has(normalized)) {
        queryGroups.set(normalized, []);
      }
      queryGroups.get(normalized)!.push(search);
    });
    
    // Analyze each pattern
    queryGroups.forEach((group, pattern) => {
      const successful = group.filter(s => s.clickedResult).length;
      const avgResults = group.reduce((sum, s) => sum + s.resultCount, 0) / group.length;
      
      patterns.push({
        pattern,
        frequency: group.length,
        successRate: successful / group.length,
        averageResultCount: avgResults,
        commonRefinements: this.extractRefinements(group),
        userSegments: this.identifyUserSegments(group)
      });
    });
    
    // Sort by frequency
    patterns.sort((a, b) => b.frequency - a.frequency);
    
    return patterns;
  }

  private normalizeQuery(query: string): string {
    // Normalize query for pattern matching
    return query.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractRefinements(searches: any[]): string[] {
    const refinements = new Map<string, number>();
    
    searches.forEach(search => {
      if (search.refinedQuery) {
        refinements.set(
          search.refinedQuery,
          (refinements.get(search.refinedQuery) || 0) + 1
        );
      }
    });
    
    return Array.from(refinements.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([query]) => query);
  }

  private identifyUserSegments(searches: any[]): string[] {
    const segments = new Set<string>();
    
    searches.forEach(search => {
      if (search.userRole) segments.add(search.userRole);
      if (search.team) segments.add(`team:${search.team}`);
    });
    
    return Array.from(segments);
  }

  // Forecast search volume
  async forecastSearchVolume(days: number = 7): Promise<SearchForecast[]> {
    const forecasts: SearchForecast[] = [];
    
    if (!this.forecastModel) {
      return forecasts;
    }
    
    // Get historical data
    const historicalData = await this.getHistoricalMetrics(30);
    
    if (historicalData.length < 7) {
      return forecasts; // Not enough data
    }
    
    // Prepare time series data
    const timeSeries = historicalData.map(m => m.totalSearches);
    
    // Simple forecast - in production, use proper time series analysis
    for (let i = 1; i <= days; i++) {
      const prediction = await this.predictNextValue(timeSeries);
      
      forecasts.push({
        period: `Day ${i}`,
        predictedVolume: Math.round(prediction.value),
        confidence: prediction.confidence,
        trends: await this.predictTrends(i),
        recommendations: await this.generateForecastRecommendations(prediction)
      });
      
      // Add prediction to series for next iteration
      timeSeries.push(prediction.value);
    }
    
    return forecasts;
  }

  private async predictNextValue(
    series: number[]
  ): Promise<{ value: number; confidence: number }> {
    // Simple moving average for now
    const window = Math.min(7, series.length);
    const recent = series.slice(-window);
    const average = recent.reduce((a, b) => a + b, 0) / window;
    
    // Calculate trend
    const trend = recent.length > 1
      ? (recent[recent.length - 1] - recent[0]) / recent.length
      : 0;
    
    // Predict with trend
    const prediction = average + trend;
    
    // Calculate confidence based on variance
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / window;
    const stdDev = Math.sqrt(variance);
    const confidence = Math.max(0.5, 1 - stdDev / average);
    
    return {
      value: Math.max(0, prediction),
      confidence
    };
  }

  private async predictTrends(daysAhead: number): Promise<string[]> {
    // Predict trends based on patterns
    const trends: string[] = [];
    
    if (daysAhead <= 2) {
      trends.push('Short-term fluctuations expected');
    } else if (daysAhead <= 5) {
      trends.push('Weekly patterns influencing volume');
    } else {
      trends.push('Longer-term trend continuation');
    }
    
    return trends;
  }

  private async generateForecastRecommendations(
    prediction: { value: number; confidence: number }
  ): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (prediction.confidence < 0.7) {
      recommendations.push('Low confidence - monitor closely');
    }
    
    if (prediction.value > 10000) {
      recommendations.push('Scale search infrastructure for high volume');
    }
    
    recommendations.push('Update search suggestions based on trends');
    
    return recommendations;
  }

  // Helper methods
  private async getHistoricalMetrics(days: number): Promise<SearchMetrics[]> {
    const metrics: SearchMetrics[] = [];
    
    // In production, query from time series database
    // For now, return mock data
    for (let i = 0; i < days; i++) {
      metrics.push({
        totalSearches: Math.floor(Math.random() * 5000) + 1000,
        uniqueUsers: Math.floor(Math.random() * 500) + 100,
        averageResponseTime: Math.random() * 200 + 50,
        clickThroughRate: Math.random() * 0.5 + 0.3,
        zeroResultRate: Math.random() * 0.2,
        refinementRate: Math.random() * 0.3,
        averageDwellTime: Math.random() * 20000 + 5000,
        bounceRate: Math.random() * 0.3
      });
    }
    
    return metrics;
  }

  private async getTopQueries(limit: number): Promise<string[]> {
    const queries = await this.redis.zrevrange('search:popular', 0, limit - 1);
    return queries;
  }

  private async getSlowQueries(limit: number): Promise<string[]> {
    const queries = await this.redis.zrevrange('search:slow', 0, limit - 1);
    return queries;
  }

  private async getZeroResultQueries(limit: number): Promise<string[]> {
    const queries = await this.redis.lrange('search:zero_results', 0, limit - 1);
    return queries;
  }

  private async identifyTrends(): Promise<string[]> {
    // Get recent vs historical query patterns
    const recentQueries = await this.redis.zrevrange('search:recent', 0, 50);
    const historicalQueries = await this.redis.zrevrange('search:historical', 0, 50);
    
    const recentSet = new Set(recentQueries);
    const historicalSet = new Set(historicalQueries);
    
    // Find new queries
    const trends = recentQueries.filter(q => !historicalSet.has(q)).slice(0, 5);
    
    return trends;
  }

  private async handleAnomalies(anomalies: SearchAnomaly[]) {
    // Send alerts for critical anomalies
    const critical = anomalies.filter(a => a.severity === 'critical');
    
    if (critical.length > 0) {
      logger.error('Critical search anomalies detected', critical);
      // In production, send alerts via PagerDuty, Slack, etc.
    }
    
    // Store anomalies for historical analysis
    for (const anomaly of anomalies) {
      await this.redis.lpush('search:anomalies', JSON.stringify(anomaly));
    }
    await this.redis.ltrim('search:anomalies', 0, 1000);
  }

  private async runComprehensiveAnalysis() {
    try {
      const insights = await this.generateInsights();
      const patterns = await this.analyzeSearchPatterns();
      const forecast = await this.forecastSearchVolume();
      
      // Store analysis results
      const analysis = {
        timestamp: new Date(),
        insights,
        patterns: patterns.slice(0, 10),
        forecast
      };
      
      await this.redis.set(
        'search:analysis:latest',
        JSON.stringify(analysis),
        'EX',
        86400 // 24 hours
      );
      
      logger.info('Comprehensive search analysis completed');
    } catch (error) {
      logger.error('Failed to run comprehensive analysis', error);
    }
  }

  // Public API for getting analytics data
  async getAnalyticsDashboard(): Promise<{
    metrics: SearchMetrics;
    insights: SearchInsight[];
    patterns: SearchPattern[];
    anomalies: SearchAnomaly[];
    forecast: SearchForecast[];
  }> {
    const metrics = this.metricsCache.get('current') || await this.calculateCurrentMetrics();
    const analysisData = await this.redis.get('search:analysis:latest');
    const analysis = analysisData ? JSON.parse(analysisData) : {};
    
    const anomaliesData = await this.redis.lrange('search:anomalies', 0, 10);
    const anomalies = anomaliesData.map(a => JSON.parse(a));
    
    return {
      metrics,
      insights: analysis.insights || [],
      patterns: analysis.patterns || [],
      anomalies,
      forecast: analysis.forecast || []
    };
  }
}