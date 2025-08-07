/**
 * Version Analytics and Tracking Engine
 * 
 * Comprehensive analytics system for API versioning with usage tracking,
 * adoption metrics, and compatibility insights
 */

import { 
  VersionAnalytics, 
  VersionUsage, 
  PerformanceMetrics, 
  ErrorMetrics,
  AdoptionMetrics,
  MigrationProgress,
  METRICS_NAMES,
  CACHE_KEYS,
  CACHE_TTL 
} from '../types';

export interface AnalyticsConfig {
  enableTracking: boolean;
  retentionDays: number;
  samplingRate: number;
  aggregationInterval: number; // minutes
  enableRealtime: boolean;
  anonymizeData: boolean;
}

export interface TrackingEvent {
  type: 'request' | 'error' | 'migration' | 'deprecation_warning';
  timestamp: Date;
  version: string;
  endpoint?: string;
  clientId?: string;
  userAgent?: string;
  responseTime?: number;
  statusCode?: number;
  errorType?: string;
  metadata?: Record<string, any>;
}

export interface ClientMetrics {
  clientId: string;
  versions: VersionClientUsage[];
  totalRequests: number;
  errorRate: number;
  avgLatency: number;
  lastSeen: Date;
  migrationStatus?: MigrationStatus;
}

export interface VersionClientUsage {
  version: string;
  requests: number;
  percentage: number;
  firstSeen: Date;
  lastSeen: Date;
}

export interface MigrationStatus {
  fromVersion: string;
  toVersion: string;
  progress: number; // 0-100
  startedAt: Date;
  estimatedCompletion?: Date;
  blockers: string[];
}

export interface AnalyticsReport {
  period: DateRange;
  summary: AnalyticsSummary;
  versionBreakdown: VersionBreakdown[];
  topEndpoints: EndpointMetrics[];
  clientAnalysis: ClientAnalysis;
  trends: TrendAnalysis[];
  recommendations: Recommendation[];
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface AnalyticsSummary {
  totalRequests: number;
  totalClients: number;
  activeVersions: number;
  avgLatency: number;
  errorRate: number;
  migrationProgress: number;
}

export interface VersionBreakdown {
  version: string;
  requests: number;
  percentage: number;
  clients: number;
  avgLatency: number;
  errorRate: number;
  status: 'active' | 'deprecated' | 'sunset';
}

export interface EndpointMetrics {
  path: string;
  method: string;
  requests: number;
  versions: Record<string, number>;
  avgLatency: number;
  errorRate: number;
}

export interface ClientAnalysis {
  totalClients: number;
  newClients: number;
  churned: number;
  versionDistribution: Record<string, number>;
  migrationFunnel: MigrationFunnelStep[];
}

export interface MigrationFunnelStep {
  fromVersion: string;
  toVersion: string;
  started: number;
  completed: number;
  abandoned: number;
  conversionRate: number;
}

export interface TrendAnalysis {
  metric: string;
  trend: 'up' | 'down' | 'stable';
  change: number; // percentage change
  period: string;
  data: TimeSeriesPoint[];
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
}

export interface Recommendation {
  type: 'migration' | 'deprecation' | 'performance' | 'adoption';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  effort: string;
  actions: string[];
}

export class VersionTrackingEngine {
  private config: AnalyticsConfig;
  private events: TrackingEvent[] = [];
  private cache = new Map<string, any>();
  private aggregatedData = new Map<string, any>();
  private clientMetrics = new Map<string, ClientMetrics>();

  constructor(config: AnalyticsConfig) {
    this.config = config;
    
    if (config.enableTracking) {
      this.startAggregation();
      this.setupCleanup();
    }
  }

  /**
   * Track API request event
   */
  trackRequest(
    version: string,
    endpoint: string,
    method: string,
    clientId?: string,
    userAgent?: string,
    responseTime?: number,
    statusCode?: number
  ): void {
    if (!this.config.enableTracking || !this.shouldSample()) {
      return;
    }

    const event: TrackingEvent = {
      type: 'request',
      timestamp: new Date(),
      version,
      endpoint: `${method.toUpperCase()} ${endpoint}`,
      clientId: this.config.anonymizeData ? this.anonymizeClientId(clientId) : clientId,
      userAgent,
      responseTime,
      statusCode
    };

    this.addEvent(event);
    this.updateClientMetrics(event);
  }

  /**
   * Track error event
   */
  trackError(
    version: string,
    endpoint: string,
    errorType: string,
    clientId?: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.config.enableTracking) return;

    const event: TrackingEvent = {
      type: 'error',
      timestamp: new Date(),
      version,
      endpoint,
      clientId: this.config.anonymizeData ? this.anonymizeClientId(clientId) : clientId,
      errorType,
      metadata
    };

    this.addEvent(event);
  }

  /**
   * Track migration event
   */
  trackMigration(
    fromVersion: string,
    toVersion: string,
    clientId: string,
    status: 'started' | 'completed' | 'failed',
    metadata?: Record<string, any>
  ): void {
    if (!this.config.enableTracking) return;

    const event: TrackingEvent = {
      type: 'migration',
      timestamp: new Date(),
      version: toVersion,
      clientId: this.config.anonymizeData ? this.anonymizeClientId(clientId) : clientId,
      metadata: { fromVersion, status, ...metadata }
    };

    this.addEvent(event);
    this.updateMigrationStatus(clientId, fromVersion, toVersion, status);
  }

  /**
   * Track deprecation warning
   */
  trackDeprecationWarning(
    version: string,
    endpoint: string,
    clientId?: string,
    warningType?: string
  ): void {
    if (!this.config.enableTracking) return;

    const event: TrackingEvent = {
      type: 'deprecation_warning',
      timestamp: new Date(),
      version,
      endpoint,
      clientId: this.config.anonymizeData ? this.anonymizeClientId(clientId) : clientId,
      metadata: { warningType }
    };

    this.addEvent(event);
  }

  /**
   * Get version analytics for a time period
   */
  async getVersionAnalytics(
    startDate: Date,
    endDate: Date,
    versions?: string[]
  ): Promise<VersionAnalytics> {
    const cacheKey = `${CACHE_KEYS.ANALYTICS_DATA}:${startDate.getTime()}-${endDate.getTime()}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const filteredEvents = this.getEventsInRange(startDate, endDate, versions);
    
    const usage = this.calculateVersionUsage(filteredEvents);
    const performance = this.calculatePerformanceMetrics(filteredEvents);
    const errors = this.calculateErrorMetrics(filteredEvents);
    const adoption = this.calculateAdoptionMetrics(filteredEvents);

    const analytics: VersionAnalytics = {
      usage,
      performance,
      errors,
      adoption
    };

    this.cache.set(cacheKey, analytics);
    setTimeout(() => this.cache.delete(cacheKey), CACHE_TTL.ANALYTICS_DATA * 1000);

    return analytics;
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateAnalyticsReport(
    startDate: Date,
    endDate: Date,
    versions?: string[]
  ): Promise<AnalyticsReport> {
    const analytics = await this.getVersionAnalytics(startDate, endDate, versions);
    const events = this.getEventsInRange(startDate, endDate, versions);

    const summary = this.calculateSummary(analytics);
    const versionBreakdown = this.calculateVersionBreakdown(events);
    const topEndpoints = this.calculateTopEndpoints(events);
    const clientAnalysis = this.calculateClientAnalysis(events);
    const trends = this.calculateTrends(startDate, endDate, versions);
    const recommendations = this.generateRecommendations(analytics, trends);

    return {
      period: { start: startDate, end: endDate },
      summary,
      versionBreakdown,
      topEndpoints,
      clientAnalysis,
      trends,
      recommendations
    };
  }

  /**
   * Get client metrics
   */
  getClientMetrics(clientId?: string): ClientMetrics | ClientMetrics[] {
    if (clientId) {
      return this.clientMetrics.get(clientId) || this.createEmptyClientMetrics(clientId);
    }
    
    return Array.from(this.clientMetrics.values());
  }

  /**
   * Get migration progress
   */
  getMigrationProgress(fromVersion?: string, toVersion?: string): MigrationProgress[] {
    const migrations = new Map<string, MigrationProgress>();

    for (const [clientId, metrics] of this.clientMetrics.entries()) {
      if (!metrics.migrationStatus) continue;

      const migration = metrics.migrationStatus;
      if (fromVersion && migration.fromVersion !== fromVersion) continue;
      if (toVersion && migration.toVersion !== toVersion) continue;

      const key = `${migration.fromVersion}->${migration.toVersion}`;
      if (!migrations.has(key)) {
        migrations.set(key, {
          fromVersion: migration.fromVersion,
          toVersion: migration.toVersion,
          completedClients: 0,
          totalClients: 0,
          estimatedCompletion: new Date()
        });
      }

      const progress = migrations.get(key)!;
      progress.totalClients++;
      
      if (migration.progress === 100) {
        progress.completedClients++;
      }
    }

    return Array.from(migrations.values());
  }

  /**
   * Get realtime metrics
   */
  getRealtimeMetrics(version?: string): any {
    if (!this.config.enableRealtime) {
      return null;
    }

    const recent = this.getRecentEvents(5 * 60 * 1000); // Last 5 minutes
    const filtered = version ? recent.filter(e => e.version === version) : recent;

    return {
      requestsPerMinute: this.calculateRPM(filtered),
      errorRate: this.calculateRealtimeErrorRate(filtered),
      avgLatency: this.calculateRealtimeLatency(filtered),
      activeClients: new Set(filtered.map(e => e.clientId).filter(Boolean)).size,
      timestamp: new Date()
    };
  }

  /**
   * Export analytics data
   */
  exportAnalytics(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' | 'excel' = 'json'
  ): any {
    const events = this.getEventsInRange(startDate, endDate);

    switch (format) {
      case 'json':
        return JSON.stringify(events, null, 2);
      case 'csv':
        return this.convertToCSV(events);
      case 'excel':
        return this.convertToExcel(events);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  // Private methods

  private addEvent(event: TrackingEvent): void {
    this.events.push(event);
    
    // Trim events if over retention limit
    const cutoff = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
    this.events = this.events.filter(e => e.timestamp > cutoff);
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.samplingRate;
  }

  private anonymizeClientId(clientId?: string): string | undefined {
    if (!clientId) return undefined;
    
    // Simple hash for anonymization
    let hash = 0;
    for (let i = 0; i < clientId.length; i++) {
      const char = clientId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `client_${Math.abs(hash)}`;
  }

  private updateClientMetrics(event: TrackingEvent): void {
    if (!event.clientId) return;

    let client = this.clientMetrics.get(event.clientId);
    if (!client) {
      client = this.createEmptyClientMetrics(event.clientId);
      this.clientMetrics.set(event.clientId, client);
    }

    // Update client metrics
    client.totalRequests++;
    client.lastSeen = event.timestamp;

    if (event.responseTime) {
      client.avgLatency = (client.avgLatency * (client.totalRequests - 1) + event.responseTime) / client.totalRequests;
    }

    if (event.statusCode && event.statusCode >= 400) {
      // Update error rate calculation would go here
    }

    // Update version usage
    let versionUsage = client.versions.find(v => v.version === event.version);
    if (!versionUsage) {
      versionUsage = {
        version: event.version,
        requests: 0,
        percentage: 0,
        firstSeen: event.timestamp,
        lastSeen: event.timestamp
      };
      client.versions.push(versionUsage);
    }

    versionUsage.requests++;
    versionUsage.lastSeen = event.timestamp;

    // Recalculate percentages
    for (const version of client.versions) {
      version.percentage = (version.requests / client.totalRequests) * 100;
    }
  }

  private updateMigrationStatus(
    clientId: string,
    fromVersion: string,
    toVersion: string,
    status: string
  ): void {
    const client = this.clientMetrics.get(clientId);
    if (!client) return;

    if (status === 'started') {
      client.migrationStatus = {
        fromVersion,
        toVersion,
        progress: 0,
        startedAt: new Date(),
        blockers: []
      };
    } else if (status === 'completed' && client.migrationStatus) {
      client.migrationStatus.progress = 100;
    }
  }

  private createEmptyClientMetrics(clientId: string): ClientMetrics {
    return {
      clientId,
      versions: [],
      totalRequests: 0,
      errorRate: 0,
      avgLatency: 0,
      lastSeen: new Date()
    };
  }

  private getEventsInRange(startDate: Date, endDate: Date, versions?: string[]): TrackingEvent[] {
    return this.events.filter(event => {
      const inRange = event.timestamp >= startDate && event.timestamp <= endDate;
      const versionMatch = !versions || versions.includes(event.version);
      return inRange && versionMatch;
    });
  }

  private getRecentEvents(milliseconds: number): TrackingEvent[] {
    const cutoff = new Date(Date.now() - milliseconds);
    return this.events.filter(event => event.timestamp > cutoff);
  }

  private calculateVersionUsage(events: TrackingEvent[]): VersionUsage[] {
    const usageMap = new Map<string, VersionUsage>();
    
    for (const event of events) {
      if (event.type !== 'request') continue;

      if (!usageMap.has(event.version)) {
        usageMap.set(event.version, {
          version: event.version,
          requests: 0,
          uniqueClients: 0,
          endpoints: {},
          timestamp: new Date()
        });
      }

      const usage = usageMap.get(event.version)!;
      usage.requests++;

      if (event.endpoint) {
        usage.endpoints[event.endpoint] = (usage.endpoints[event.endpoint] || 0) + 1;
      }
    }

    // Calculate unique clients
    for (const [version, usage] of usageMap.entries()) {
      const clients = new Set(
        events
          .filter(e => e.version === version && e.clientId)
          .map(e => e.clientId)
      );
      usage.uniqueClients = clients.size;
    }

    return Array.from(usageMap.values());
  }

  private calculatePerformanceMetrics(events: TrackingEvent[]): PerformanceMetrics[] {
    const metricsMap = new Map<string, PerformanceMetrics>();

    for (const event of events) {
      if (event.type !== 'request' || !event.responseTime) continue;

      if (!metricsMap.has(event.version)) {
        metricsMap.set(event.version, {
          version: event.version,
          avgLatency: 0,
          p95Latency: 0,
          p99Latency: 0,
          throughput: 0,
          errorRate: 0,
          timestamp: new Date()
        });
      }

      // Aggregate latency data for percentile calculations
    }

    return Array.from(metricsMap.values());
  }

  private calculateErrorMetrics(events: TrackingEvent[]): ErrorMetrics[] {
    const metricsMap = new Map<string, ErrorMetrics>();

    for (const event of events) {
      if (!metricsMap.has(event.version)) {
        metricsMap.set(event.version, {
          version: event.version,
          totalErrors: 0,
          errorsByType: {},
          errorsByEndpoint: {},
          timestamp: new Date()
        });
      }

      const metrics = metricsMap.get(event.version)!;

      if (event.type === 'error' || (event.statusCode && event.statusCode >= 400)) {
        metrics.totalErrors++;

        if (event.errorType) {
          metrics.errorsByType[event.errorType] = (metrics.errorsByType[event.errorType] || 0) + 1;
        }

        if (event.endpoint) {
          metrics.errorsByEndpoint[event.endpoint] = (metrics.errorsByEndpoint[event.endpoint] || 0) + 1;
        }
      }
    }

    return Array.from(metricsMap.values());
  }

  private calculateAdoptionMetrics(events: TrackingEvent[]): AdoptionMetrics {
    const clients = new Set(events.filter(e => e.clientId).map(e => e.clientId));
    const versionDistribution: Record<string, number> = {};

    for (const event of events) {
      if (event.type === 'request') {
        versionDistribution[event.version] = (versionDistribution[event.version] || 0) + 1;
      }
    }

    return {
      totalClients: clients.size,
      versionDistribution,
      migrationProgress: this.getMigrationProgress(),
      deprecatedVersionUsage: {}
    };
  }

  private calculateSummary(analytics: VersionAnalytics): AnalyticsSummary {
    const totalRequests = analytics.usage.reduce((sum, usage) => sum + usage.requests, 0);
    const totalClients = analytics.adoption.totalClients;
    const activeVersions = analytics.usage.length;

    const avgLatency = analytics.performance.reduce((sum, perf) => sum + perf.avgLatency, 0) / analytics.performance.length || 0;
    const errorRate = analytics.errors.reduce((sum, error) => sum + error.totalErrors, 0) / totalRequests;

    return {
      totalRequests,
      totalClients,
      activeVersions,
      avgLatency,
      errorRate,
      migrationProgress: 0 // Calculate from migration data
    };
  }

  private calculateVersionBreakdown(events: TrackingEvent[]): VersionBreakdown[] {
    const breakdown = new Map<string, VersionBreakdown>();

    for (const event of events) {
      if (!breakdown.has(event.version)) {
        breakdown.set(event.version, {
          version: event.version,
          requests: 0,
          percentage: 0,
          clients: 0,
          avgLatency: 0,
          errorRate: 0,
          status: 'active'
        });
      }

      if (event.type === 'request') {
        breakdown.get(event.version)!.requests++;
      }
    }

    const totalRequests = Array.from(breakdown.values()).reduce((sum, b) => sum + b.requests, 0);

    // Calculate percentages
    for (const item of breakdown.values()) {
      item.percentage = (item.requests / totalRequests) * 100;
    }

    return Array.from(breakdown.values()).sort((a, b) => b.requests - a.requests);
  }

  private calculateTopEndpoints(events: TrackingEvent[]): EndpointMetrics[] {
    const endpointMap = new Map<string, EndpointMetrics>();

    for (const event of events) {
      if (event.type !== 'request' || !event.endpoint) continue;

      const [method, path] = event.endpoint.split(' ');
      const key = event.endpoint;

      if (!endpointMap.has(key)) {
        endpointMap.set(key, {
          path,
          method,
          requests: 0,
          versions: {},
          avgLatency: 0,
          errorRate: 0
        });
      }

      const endpoint = endpointMap.get(key)!;
      endpoint.requests++;
      endpoint.versions[event.version] = (endpoint.versions[event.version] || 0) + 1;
    }

    return Array.from(endpointMap.values())
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10); // Top 10
  }

  private calculateClientAnalysis(events: TrackingEvent[]): ClientAnalysis {
    const clients = new Set(events.filter(e => e.clientId).map(e => e.clientId));
    const versionDistribution: Record<string, number> = {};

    for (const event of events) {
      if (event.type === 'request') {
        versionDistribution[event.version] = (versionDistribution[event.version] || 0) + 1;
      }
    }

    return {
      totalClients: clients.size,
      newClients: 0, // Would calculate based on first-seen dates
      churned: 0, // Would calculate based on last-seen dates
      versionDistribution,
      migrationFunnel: [] // Would calculate from migration events
    };
  }

  private calculateTrends(startDate: Date, endDate: Date, versions?: string[]): TrendAnalysis[] {
    // Mock implementation - would calculate actual trends from historical data
    return [
      {
        metric: 'requests',
        trend: 'up',
        change: 15.5,
        period: 'week',
        data: []
      }
    ];
  }

  private generateRecommendations(analytics: VersionAnalytics, trends: TrendAnalysis[]): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Check for deprecated version usage
    for (const usage of analytics.usage) {
      if (usage.requests > 1000) { // Arbitrary threshold
        recommendations.push({
          type: 'migration',
          priority: 'high',
          title: `Migrate clients from version ${usage.version}`,
          description: `Version ${usage.version} has significant usage but may be deprecated`,
          impact: 'Reduce maintenance overhead and improve security',
          effort: 'Medium',
          actions: [
            'Identify clients using this version',
            'Create migration guide',
            'Implement gradual migration plan'
          ]
        });
      }
    }

    return recommendations;
  }

  private calculateRPM(events: TrackingEvent[]): number {
    return events.filter(e => e.type === 'request').length;
  }

  private calculateRealtimeErrorRate(events: TrackingEvent[]): number {
    const requests = events.filter(e => e.type === 'request').length;
    const errors = events.filter(e => e.type === 'error' || (e.statusCode && e.statusCode >= 400)).length;
    return requests > 0 ? errors / requests : 0;
  }

  private calculateRealtimeLatency(events: TrackingEvent[]): number {
    const latencies = events
      .filter(e => e.type === 'request' && e.responseTime)
      .map(e => e.responseTime!);
    
    return latencies.length > 0 ? latencies.reduce((sum, l) => sum + l, 0) / latencies.length : 0;
  }

  private convertToCSV(events: TrackingEvent[]): string {
    const headers = ['timestamp', 'type', 'version', 'endpoint', 'clientId', 'responseTime', 'statusCode'];
    const rows = events.map(event => [
      event.timestamp.toISOString(),
      event.type,
      event.version,
      event.endpoint || '',
      event.clientId || '',
      event.responseTime?.toString() || '',
      event.statusCode?.toString() || ''
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private convertToExcel(events: TrackingEvent[]): any {
    // Mock implementation - would use a library like xlsx
    return { format: 'excel', data: events };
  }

  private startAggregation(): void {
    setInterval(() => {
      this.aggregateData();
    }, this.config.aggregationInterval * 60 * 1000);
  }

  private aggregateData(): void {
    // Aggregate data for faster queries
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentEvents = this.getEventsInRange(hourAgo, now);
    const aggregated = this.calculateVersionUsage(recentEvents);
    
    this.aggregatedData.set(`hourly_${now.getHours()}`, aggregated);
  }

  private setupCleanup(): void {
    // Clean up old events daily
    setInterval(() => {
      const cutoff = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
      this.events = this.events.filter(e => e.timestamp > cutoff);
    }, 24 * 60 * 60 * 1000);
  }
}

export default VersionTrackingEngine;