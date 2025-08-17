/**
 * CDN Edge Computing for Plugin Marketplace Assets
 * Global distribution with edge processing capabilities
 */

export interface EdgeLocation {
  id: string;
  region: string;
  city: string;
  country: string;
  continent: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  status: 'active' | 'degraded' | 'offline';
  capabilities: EdgeCapability[];
  metrics: EdgeLocationMetrics;
}

export interface EdgeCapability {
  type: 'compute' | 'storage' | 'cache' | 'streaming';
  enabled: boolean;
  limits: {
    cpu: number;
    memory: number;
    storage: number;
    bandwidth: number;
  };
}

export interface EdgeLocationMetrics {
  latency: number;
  throughput: number;
  cacheHitRate: number;
  cpuUsage: number;
  memoryUsage: number;
  storageUsage: number;
  requestsPerSecond: number;
  lastUpdated: Date;
}

export interface PluginAsset {
  id: string;
  pluginId: string;
  version: string;
  type: 'bundle' | 'schema' | 'documentation' | 'icon' | 'screenshot';
  url: string;
  size: number;
  contentType: string;
  checksum: string;
  metadata: {
    compression: 'gzip' | 'brotli' | 'none';
    cacheTtl: number;
    accessPattern: 'hot' | 'warm' | 'cold';
    geoRestrictions?: string[];
  };
  distributionStatus: EdgeDistributionStatus[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EdgeDistributionStatus {
  edgeLocationId: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'purged';
  lastSync: Date;
  syncDuration?: number;
  errorMessage?: string;
  cacheSize: number;
  accessCount: number;
}

export interface EdgeRequest {
  id: string;
  assetId: string;
  userLocation: {
    country: string;
    region: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  selectedEdge: string;
  responseTime: number;
  cacheStatus: 'hit' | 'miss' | 'stale' | 'refresh';
  timestamp: Date;
  userAgent: string;
  tenantId?: string;
}

/**
 * CDN Edge Computing Manager
 */
export class CDNEdgeManager {
  private edgeLocations: Map<string, EdgeLocation> = new Map();
  private pluginAssets: Map<string, PluginAsset> = new Map();
  private edgeRequests: EdgeRequest[] = [];
  private distributionQueue: Array<{
    assetId: string;
    targetEdges: string[];
    priority: 'high' | 'medium' | 'low';
  }> = [];

  constructor() {
    this.initializeEdgeLocations();
    this.startDistributionWorker();
    this.startMetricsCollection();
  }

  /**
   * Register plugin asset for edge distribution
   */
  async registerAsset(asset: Omit<PluginAsset, 'id' | 'distributionStatus' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const assetId = this.generateAssetId();
    
    const pluginAsset: PluginAsset = {
      ...asset,
      id: assetId,
      distributionStatus: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.pluginAssets.set(assetId, pluginAsset);

    // Determine optimal edge locations based on access patterns
    const targetEdges = await this.selectOptimalEdges(pluginAsset);
    
    // Queue for distribution
    this.distributionQueue.push({
      assetId,
      targetEdges,
      priority: this.determinePriority(pluginAsset)
    });

    console.log(`Registered asset ${assetId} for distribution to ${targetEdges.length} edge locations`);
    return assetId;
  }

  /**
   * Get optimal edge location for user request
   */
  async getOptimalEdge(userLocation: {
    country: string;
    region: string;
    coordinates: { latitude: number; longitude: number };
  }, assetId: string): Promise<EdgeLocation | null> {
    const asset = this.pluginAssets.get(assetId);
    if (!asset) return null;

    // Check geo-restrictions
    if (asset.metadata.geoRestrictions?.includes(userLocation.country)) {
      return null;
    }

    // Find available edge locations with the asset
    const availableEdges = Array.from(this.edgeLocations.values())
      .filter(edge => {
        const distribution = asset.distributionStatus.find(d => d.edgeLocationId === edge.id);
        return edge.status === 'active' && distribution?.status === 'synced';
      });

    if (availableEdges.length === 0) {
      // Fallback to origin
      return null;
    }

    // Calculate distance and select closest edge
    let bestEdge: EdgeLocation | null = null;
    let minScore = Infinity;

    for (const edge of availableEdges) {
      const distance = this.calculateDistance(
        userLocation.coordinates,
        edge.coordinates
      );

      // Scoring: distance (60%) + latency (25%) + load (15%)
      const score = distance * 0.6 + 
                   edge.metrics.latency * 0.25 + 
                   (edge.metrics.cpuUsage + edge.metrics.memoryUsage) / 2 * 0.15;

      if (score < minScore) {
        minScore = score;
        bestEdge = edge;
      }
    }

    return bestEdge;
  }

  /**
   * Handle edge request and return optimized response
   */
  async handleEdgeRequest(request: {
    assetId: string;
    userLocation: {
      country: string;
      region: string;
      coordinates: { latitude: number; longitude: number };
    };
    userAgent: string;
    tenantId?: string;
  }): Promise<{
    url: string;
    cacheStatus: 'hit' | 'miss' | 'stale';
    edgeLocation: string;
    responseTime: number;
  }> {
    const startTime = Date.now();
    const asset = this.pluginAssets.get(request.assetId);
    
    if (!asset) {
      throw new Error(`Asset not found: ${request.assetId}`);
    }

    // Get optimal edge location
    const optimalEdge = await this.getOptimalEdge(request.userLocation, request.assetId);
    
    if (!optimalEdge) {
      // Serve from origin
      const responseTime = Date.now() - startTime;
      
      this.recordEdgeRequest({
        id: this.generateRequestId(),
        assetId: request.assetId,
        userLocation: request.userLocation,
        selectedEdge: 'origin',
        responseTime,
        cacheStatus: 'miss',
        timestamp: new Date(),
        userAgent: request.userAgent,
        tenantId: request.tenantId
      });

      return {
        url: asset.url,
        cacheStatus: 'miss',
        edgeLocation: 'origin',
        responseTime
      };
    }

    // Serve from edge
    const edgeUrl = this.buildEdgeUrl(optimalEdge, asset);
    const responseTime = Date.now() - startTime;
    
    // Determine cache status
    const distribution = asset.distributionStatus.find(d => d.edgeLocationId === optimalEdge.id);
    const cacheAge = Date.now() - (distribution?.lastSync.getTime() || 0);
    const isStale = cacheAge > asset.metadata.cacheTtl * 1000;
    
    const cacheStatus: 'hit' | 'miss' | 'stale' = 
      distribution?.status === 'synced' 
        ? (isStale ? 'stale' : 'hit')
        : 'miss';

    this.recordEdgeRequest({
      id: this.generateRequestId(),
      assetId: request.assetId,
      userLocation: request.userLocation,
      selectedEdge: optimalEdge.id,
      responseTime,
      cacheStatus,
      timestamp: new Date(),
      userAgent: request.userAgent,
      tenantId: request.tenantId
    });

    // Update edge metrics
    this.updateEdgeMetrics(optimalEdge.id, {
      requestsPerSecond: optimalEdge.metrics.requestsPerSecond + 1,
      cacheHitRate: cacheStatus === 'hit' ? 
        (optimalEdge.metrics.cacheHitRate * 0.9 + 0.1) :
        (optimalEdge.metrics.cacheHitRate * 0.9)
    });

    return {
      url: edgeUrl,
      cacheStatus,
      edgeLocation: optimalEdge.id,
      responseTime
    };
  }

  /**
   * Purge asset from edge caches
   */
  async purgeAsset(assetId: string, edgeLocationIds?: string[]): Promise<void> {
    const asset = this.pluginAssets.get(assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    const targetEdges = edgeLocationIds || 
      asset.distributionStatus.map(d => d.edgeLocationId);

    for (const edgeId of targetEdges) {
      const distribution = asset.distributionStatus.find(d => d.edgeLocationId === edgeId);
      if (distribution) {
        distribution.status = 'purged';
        distribution.lastSync = new Date();
        distribution.cacheSize = 0;
      }
    }

    console.log(`Purged asset ${assetId} from ${targetEdges.length} edge locations`);
  }

  /**
   * Get edge analytics
   */
  getEdgeAnalytics(timeRange?: { start: Date; end: Date }): {
    totalRequests: number;
    cacheHitRate: number;
    avgResponseTime: number;
    topEdges: Array<{ edgeId: string; requests: number; hitRate: number }>;
    geoDistribution: Array<{ country: string; requests: number }>;
    assetPopularity: Array<{ assetId: string; requests: number }>;
  } {
    let requests = this.edgeRequests;
    
    if (timeRange) {
      requests = requests.filter(r => 
        r.timestamp >= timeRange.start && r.timestamp <= timeRange.end
      );
    }

    const totalRequests = requests.length;
    const cacheHits = requests.filter(r => r.cacheStatus === 'hit').length;
    const cacheHitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;
    
    const avgResponseTime = totalRequests > 0 ?
      requests.reduce((sum, r) => sum + r.responseTime, 0) / totalRequests : 0;

    // Top edges by request count
    const edgeStats = new Map<string, { requests: number; hits: number }>();
    for (const request of requests) {
      const stats = edgeStats.get(request.selectedEdge) || { requests: 0, hits: 0 };
      stats.requests++;
      if (request.cacheStatus === 'hit') stats.hits++;
      edgeStats.set(request.selectedEdge, stats);
    }

    const topEdges = Array.from(edgeStats.entries())
      .map(([edgeId, stats]) => ({
        edgeId,
        requests: stats.requests,
        hitRate: stats.requests > 0 ? stats.hits / stats.requests : 0
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    // Geographic distribution
    const geoStats = new Map<string, number>();
    for (const request of requests) {
      const count = geoStats.get(request.userLocation.country) || 0;
      geoStats.set(request.userLocation.country, count + 1);
    }

    const geoDistribution = Array.from(geoStats.entries())
      .map(([country, requests]) => ({ country, requests }))
      .sort((a, b) => b.requests - a.requests);

    // Asset popularity
    const assetStats = new Map<string, number>();
    for (const request of requests) {
      const count = assetStats.get(request.assetId) || 0;
      assetStats.set(request.assetId, count + 1);
    }

    const assetPopularity = Array.from(assetStats.entries())
      .map(([assetId, requests]) => ({ assetId, requests }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 20);

    return {
      totalRequests,
      cacheHitRate,
      avgResponseTime,
      topEdges,
      geoDistribution,
      assetPopularity
    };
  }

  /**
   * Select optimal edge locations for asset distribution
   */
  private async selectOptimalEdges(asset: PluginAsset): Promise<string[]> {
    const activeEdges = Array.from(this.edgeLocations.values())
      .filter(edge => edge.status === 'active');

    // For high-access assets, distribute to more edges
    const distributionCount = asset.metadata.accessPattern === 'hot' ? 
      Math.min(activeEdges.length, 12) :
      asset.metadata.accessPattern === 'warm' ?
      Math.min(activeEdges.length, 6) :
      Math.min(activeEdges.length, 3);

    // Select edges based on capacity and geographic distribution
    const selectedEdges = activeEdges
      .sort((a, b) => {
        const aScore = (100 - a.metrics.cpuUsage) + (100 - a.metrics.memoryUsage);
        const bScore = (100 - b.metrics.cpuUsage) + (100 - b.metrics.memoryUsage);
        return bScore - aScore;
      })
      .slice(0, distributionCount)
      .map(edge => edge.id);

    return selectedEdges;
  }

  /**
   * Determine distribution priority
   */
  private determinePriority(asset: PluginAsset): 'high' | 'medium' | 'low' {
    if (asset.metadata.accessPattern === 'hot') return 'high';
    if (asset.metadata.accessPattern === 'warm') return 'medium';
    return 'low';
  }

  /**
   * Calculate geographic distance between two points
   */
  private calculateDistance(
    point1: { latitude: number; longitude: number },
    point2: { latitude: number; longitude: number }
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
    const dLon = (point2.longitude - point1.longitude) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Build edge URL for asset
   */
  private buildEdgeUrl(edge: EdgeLocation, asset: PluginAsset): string {
    // In production, this would build the actual edge URL
    return `https://${edge.id}.edge.nextportal.com/${asset.pluginId}/${asset.version}/${asset.type}`;
  }

  /**
   * Record edge request for analytics
   */
  private recordEdgeRequest(request: EdgeRequest): void {
    this.edgeRequests.push(request);
    
    // Keep only recent requests (last 24 hours)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.edgeRequests = this.edgeRequests.filter(r => r.timestamp > cutoff);
  }

  /**
   * Update edge location metrics
   */
  private updateEdgeMetrics(edgeId: string, updates: Partial<EdgeLocationMetrics>): void {
    const edge = this.edgeLocations.get(edgeId);
    if (edge) {
      edge.metrics = { ...edge.metrics, ...updates, lastUpdated: new Date() };
    }
  }

  /**
   * Start distribution worker
   */
  private startDistributionWorker(): void {
    setInterval(async () => {
      if (this.distributionQueue.length === 0) return;

      // Process high priority items first
      this.distributionQueue.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });

      const batch = this.distributionQueue.splice(0, 5); // Process 5 at a time
      
      for (const item of batch) {
        await this.distributeAsset(item.assetId, item.targetEdges);
      }
    }, 10000); // Every 10 seconds
  }

  /**
   * Distribute asset to edge locations
   */
  private async distributeAsset(assetId: string, targetEdges: string[]): Promise<void> {
    const asset = this.pluginAssets.get(assetId);
    if (!asset) return;

    for (const edgeId of targetEdges) {
      let distribution = asset.distributionStatus.find(d => d.edgeLocationId === edgeId);
      
      if (!distribution) {
        distribution = {
          edgeLocationId: edgeId,
          status: 'pending',
          lastSync: new Date(),
          cacheSize: 0,
          accessCount: 0
        };
        asset.distributionStatus.push(distribution);
      }

      try {
        distribution.status = 'syncing';
        const syncStart = Date.now();
        
        // Simulate asset synchronization
        await this.syncAssetToEdge(asset, edgeId);
        
        distribution.status = 'synced';
        distribution.lastSync = new Date();
        distribution.syncDuration = Date.now() - syncStart;
        distribution.cacheSize = asset.size;
        distribution.errorMessage = undefined;
        
      } catch (error) {
        distribution.status = 'failed';
        distribution.errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to sync asset ${assetId} to edge ${edgeId}:`, error);
      }
    }

    asset.updatedAt = new Date();
  }

  /**
   * Simulate asset sync to edge location
   */
  private async syncAssetToEdge(asset: PluginAsset, edgeId: string): Promise<void> {
    // Simulate network delay based on asset size
    const delay = Math.min(asset.size / 1024 + 100, 5000);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Simulate random failure (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Network timeout during sync');
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      for (const edge of this.edgeLocations.values()) {
        // Simulate realistic metrics
        edge.metrics = {
          ...edge.metrics,
          latency: 50 + Math.random() * 100,
          throughput: 1000 + Math.random() * 500,
          cpuUsage: Math.max(10, Math.min(90, edge.metrics.cpuUsage + (Math.random() - 0.5) * 10)),
          memoryUsage: Math.max(20, Math.min(85, edge.metrics.memoryUsage + (Math.random() - 0.5) * 5)),
          storageUsage: Math.max(30, Math.min(95, edge.metrics.storageUsage + (Math.random() - 0.5) * 2)),
          lastUpdated: new Date()
        };
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Initialize edge locations
   */
  private initializeEdgeLocations(): void {
    const locations: Omit<EdgeLocation, 'metrics'>[] = [
      {
        id: 'us-east-1',
        region: 'us-east-1',
        city: 'Virginia',
        country: 'US',
        continent: 'North America',
        coordinates: { latitude: 38.13, longitude: -78.45 },
        status: 'active',
        capabilities: [
          { type: 'compute', enabled: true, limits: { cpu: 8, memory: 32, storage: 500, bandwidth: 10000 } },
          { type: 'cache', enabled: true, limits: { cpu: 4, memory: 16, storage: 1000, bandwidth: 5000 } }
        ]
      },
      {
        id: 'us-west-1',
        region: 'us-west-1',
        city: 'California',
        country: 'US',
        continent: 'North America',
        coordinates: { latitude: 37.35, longitude: -121.96 },
        status: 'active',
        capabilities: [
          { type: 'compute', enabled: true, limits: { cpu: 8, memory: 32, storage: 500, bandwidth: 10000 } },
          { type: 'cache', enabled: true, limits: { cpu: 4, memory: 16, storage: 1000, bandwidth: 5000 } }
        ]
      },
      {
        id: 'eu-west-1',
        region: 'eu-west-1',
        city: 'Dublin',
        country: 'IE',
        continent: 'Europe',
        coordinates: { latitude: 53.41, longitude: -8.24 },
        status: 'active',
        capabilities: [
          { type: 'compute', enabled: true, limits: { cpu: 8, memory: 32, storage: 500, bandwidth: 10000 } },
          { type: 'cache', enabled: true, limits: { cpu: 4, memory: 16, storage: 1000, bandwidth: 5000 } }
        ]
      },
      {
        id: 'ap-southeast-1',
        region: 'ap-southeast-1',
        city: 'Singapore',
        country: 'SG',
        continent: 'Asia',
        coordinates: { latitude: 1.37, longitude: 103.8 },
        status: 'active',
        capabilities: [
          { type: 'compute', enabled: true, limits: { cpu: 8, memory: 32, storage: 500, bandwidth: 10000 } },
          { type: 'cache', enabled: true, limits: { cpu: 4, memory: 16, storage: 1000, bandwidth: 5000 } }
        ]
      },
      {
        id: 'ap-northeast-1',
        region: 'ap-northeast-1',
        city: 'Tokyo',
        country: 'JP',
        continent: 'Asia',
        coordinates: { latitude: 35.41, longitude: 139.42 },
        status: 'active',
        capabilities: [
          { type: 'compute', enabled: true, limits: { cpu: 8, memory: 32, storage: 500, bandwidth: 10000 } },
          { type: 'cache', enabled: true, limits: { cpu: 4, memory: 16, storage: 1000, bandwidth: 5000 } }
        ]
      }
    ];

    for (const location of locations) {
      const edgeLocation: EdgeLocation = {
        ...location,
        metrics: {
          latency: 50 + Math.random() * 50,
          throughput: 1000 + Math.random() * 500,
          cacheHitRate: 0.85 + Math.random() * 0.1,
          cpuUsage: 30 + Math.random() * 40,
          memoryUsage: 40 + Math.random() * 30,
          storageUsage: 50 + Math.random() * 20,
          requestsPerSecond: Math.random() * 100,
          lastUpdated: new Date()
        }
      };
      
      this.edgeLocations.set(location.id, edgeLocation);
    }

    console.log(`Initialized ${this.edgeLocations.size} edge locations`);
  }

  private generateAssetId(): string {
    return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get system statistics
   */
  getStatistics(): {
    totalEdgeLocations: number;
    activeEdgeLocations: number;
    totalAssets: number;
    distributedAssets: number;
    totalRequests: number;
    globalCacheHitRate: number;
    avgResponseTime: number;
  } {
    const activeEdges = Array.from(this.edgeLocations.values()).filter(e => e.status === 'active');
    const distributedAssets = Array.from(this.pluginAssets.values())
      .filter(asset => asset.distributionStatus.some(d => d.status === 'synced'));
    
    const analytics = this.getEdgeAnalytics();
    
    return {
      totalEdgeLocations: this.edgeLocations.size,
      activeEdgeLocations: activeEdges.length,
      totalAssets: this.pluginAssets.size,
      distributedAssets: distributedAssets.length,
      totalRequests: analytics.totalRequests,
      globalCacheHitRate: analytics.cacheHitRate,
      avgResponseTime: analytics.avgResponseTime
    };
  }
}

// Global CDN edge manager instance
export const cdnEdgeManager = new CDNEdgeManager();

export default cdnEdgeManager;