/**
 * Advanced Platform Economics with Usage Metering
 * Real-time usage tracking, billing calculation, and cost optimization
 */

export interface MeteringConfig {
  metricName: string;
  unit: string;
  aggregation: 'sum' | 'max' | 'avg' | 'count' | 'unique_count';
  billing: {
    enabled: boolean;
    pricePerUnit: number;
    currency: string;
    billingModel: 'prepaid' | 'postpaid' | 'tiered' | 'usage_based';
    includedUnits?: number; // Free tier
    overage?: {
      enabled: boolean;
      pricePerUnit: number;
      threshold: number;
    };
  };
  collection: {
    realTime: boolean;
    batchInterval: number; // seconds
    retentionDays: number;
  };
  alerting: {
    enabled: boolean;
    thresholds: Array<{
      percentage: number;
      action: 'notify' | 'throttle' | 'block';
      recipients: string[];
    }>;
  };
}

export interface UsageRecord {
  id: string;
  tenantId: string;
  userId?: string;
  metricName: string;
  value: number;
  unit: string;
  timestamp: Date;
  metadata: Record<string, any>;
  resourceId?: string;
  resourceType?: string;
  costCents: number;
  billingPeriodId?: string;
  tags: string[];
}

export interface BillingPeriod {
  id: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  status: 'active' | 'closed' | 'processing' | 'disputed';
  usage: Map<string, UsageAggregation>;
  totalCostCents: number;
  currency: string;
  invoiceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageAggregation {
  metricName: string;
  totalValue: number;
  unit: string;
  recordCount: number;
  costCents: number;
  includedUnits: number;
  billableUnits: number;
  overageUnits: number;
  overageCostCents: number;
}

export interface CostOptimization {
  id: string;
  tenantId: string;
  type: 'rightsizing' | 'scheduling' | 'compression' | 'caching' | 'deduplication';
  description: string;
  potentialSavings: {
    amountCents: number;
    percentage: number;
    currency: string;
  };
  implementation: {
    effort: 'low' | 'medium' | 'high';
    riskLevel: 'low' | 'medium' | 'high';
    estimatedTime: string; // e.g., "2 hours", "1 day"
    steps: string[];
  };
  status: 'identified' | 'approved' | 'implementing' | 'completed' | 'rejected';
  identifiedAt: Date;
  implementedAt?: Date;
}

export interface ResourceUsageAnalytics {
  tenantId: string;
  timeRange: { start: Date; end: Date };
  metrics: {
    totalCost: number;
    costByService: Array<{ service: string; cost: number; percentage: number }>;
    costTrend: Array<{ date: Date; cost: number }>;
    topResources: Array<{ resource: string; cost: number; usage: number }>;
    wastedResources: Array<{ resource: string; wastedCost: number; reason: string }>;
  };
  recommendations: CostOptimization[];
  projectedCost: {
    nextMonth: number;
    nextQuarter: number;
    confidence: number;
  };
}

export interface PricingModel {
  id: string;
  name: string;
  description: string;
  type: 'flat_rate' | 'usage_based' | 'tiered' | 'per_seat' | 'hybrid';
  tiers?: Array<{
    name: string;
    minUnits: number;
    maxUnits?: number;
    pricePerUnit: number;
    included: number;
  }>;
  features: string[];
  limits: Record<string, number>;
  isActive: boolean;
}

export interface RevenueTrendAnalysis {
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  data: Array<{
    date: Date;
    revenue: number;
    usage: number;
    customers: number;
    averageRevenuePerUser: number;
  }>;
  growth: {
    revenueGrowth: number;
    usageGrowth: number;
    customerGrowth: number;
  };
  forecasts: {
    nextPeriod: number;
    confidence: number;
    factors: string[];
  };
}

/**
 * Usage Metering Engine
 * Tracks resource usage, calculates costs, and provides optimization insights
 */
export class UsageMeteringEngine {
  private meteringConfigs: Map<string, MeteringConfig> = new Map();
  private usageRecords: UsageRecord[] = [];
  private billingPeriods: Map<string, BillingPeriod> = new Map();
  private costOptimizations: Map<string, CostOptimization[]> = new Map();
  private pricingModels: Map<string, PricingModel> = new Map();
  private aggregationInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDefaultMetrics();
    this.initializePricingModels();
    this.startUsageAggregation();
  }

  /**
   * Record usage event
   */
  async recordUsage(
    tenantId: string,
    metricName: string,
    value: number,
    metadata: Record<string, any> = {},
    userId?: string,
    resourceId?: string,
    resourceType?: string
  ): Promise<string> {
    const config = this.meteringConfigs.get(metricName);
    if (!config) {
      throw new Error(`Metering config not found for metric: ${metricName}`);
    }

    const recordId = this.generateRecordId();
    const timestamp = new Date();
    
    // Calculate cost
    const costCents = await this.calculateCost(tenantId, metricName, value, config);

    const usageRecord: UsageRecord = {
      id: recordId,
      tenantId,
      userId,
      metricName,
      value,
      unit: config.unit,
      timestamp,
      metadata,
      resourceId,
      resourceType,
      costCents,
      tags: metadata.tags || []
    };

    this.usageRecords.push(usageRecord);

    // Real-time processing
    if (config.collection.realTime) {
      await this.processUsageRecord(usageRecord);
    }

    // Check usage alerts
    await this.checkUsageAlerts(tenantId, metricName, value);

    console.log(`Recorded usage: ${metricName}=${value} ${config.unit} for tenant ${tenantId} (cost: ${costCents/100} ${config.billing.currency})`);
    
    return recordId;
  }

  /**
   * Get usage analytics for tenant
   */
  async getUsageAnalytics(
    tenantId: string,
    timeRange: { start: Date; end: Date },
    metricName?: string
  ): Promise<ResourceUsageAnalytics> {
    const records = this.usageRecords.filter(record =>
      record.tenantId === tenantId &&
      record.timestamp >= timeRange.start &&
      record.timestamp <= timeRange.end &&
      (!metricName || record.metricName === metricName)
    );

    // Calculate total cost
    const totalCost = records.reduce((sum, record) => sum + record.costCents, 0) / 100;

    // Group by service/metric
    const costByService = this.groupUsageByService(records);

    // Generate cost trend
    const costTrend = this.generateCostTrend(records, timeRange);

    // Find top resources
    const topResources = this.findTopResources(records);

    // Identify wasted resources
    const wastedResources = await this.identifyWastedResources(tenantId, records);

    // Generate cost optimizations
    const recommendations = await this.generateCostOptimizations(tenantId, records);

    // Project future costs
    const projectedCost = await this.projectFutureCosts(tenantId, records);

    return {
      tenantId,
      timeRange,
      metrics: {
        totalCost,
        costByService,
        costTrend,
        topResources,
        wastedResources
      },
      recommendations,
      projectedCost
    };
  }

  /**
   * Generate billing summary for period
   */
  async generateBillingSummary(
    tenantId: string,
    billingPeriodId: string
  ): Promise<{
    period: BillingPeriod;
    usage: UsageAggregation[];
    invoice: {
      subtotal: number;
      taxes: number;
      total: number;
      currency: string;
      lineItems: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        amount: number;
      }>;
    };
  }> {
    const period = this.billingPeriods.get(billingPeriodId);
    if (!period || period.tenantId !== tenantId) {
      throw new Error(`Billing period not found: ${billingPeriodId}`);
    }

    const usage = Array.from(period.usage.values());
    
    // Generate invoice line items
    const lineItems = usage.map(usage => ({
      description: `${usage.metricName} usage (${usage.totalValue} ${usage.unit})`,
      quantity: usage.billableUnits,
      unitPrice: this.getUnitPrice(usage.metricName) / 100,
      amount: usage.costCents / 100
    }));

    const subtotal = period.totalCostCents / 100;
    const taxes = subtotal * 0.08; // 8% tax rate
    const total = subtotal + taxes;

    return {
      period,
      usage,
      invoice: {
        subtotal,
        taxes,
        total,
        currency: period.currency,
        lineItems
      }
    };
  }

  /**
   * Optimize costs for tenant
   */
  async optimizeCosts(tenantId: string): Promise<{
    implemented: CostOptimization[];
    potential: CostOptimization[];
    totalSavings: number;
  }> {
    const optimizations = this.costOptimizations.get(tenantId) || [];
    
    const implemented = optimizations.filter(opt => opt.status === 'completed');
    const potential = optimizations.filter(opt => 
      opt.status === 'identified' || opt.status === 'approved'
    );

    // Implement automatic optimizations
    const autoImplemented = await this.implementAutomaticOptimizations(tenantId, potential);

    const totalSavings = [...implemented, ...autoImplemented]
      .reduce((sum, opt) => sum + opt.potentialSavings.amountCents, 0) / 100;

    return {
      implemented: [...implemented, ...autoImplemented],
      potential: potential.filter(opt => !autoImplemented.includes(opt)),
      totalSavings
    };
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly',
    timeRange: { start: Date; end: Date }
  ): Promise<RevenueTrendAnalysis> {
    const periods = this.generateTimePeriods(period, timeRange);
    
    const data = periods.map(periodStart => {
      const periodEnd = this.getPeriodEnd(period, periodStart);
      const periodRecords = this.usageRecords.filter(record =>
        record.timestamp >= periodStart && record.timestamp < periodEnd
      );

      const revenue = periodRecords.reduce((sum, record) => sum + record.costCents, 0) / 100;
      const usage = periodRecords.reduce((sum, record) => sum + record.value, 0);
      const customers = new Set(periodRecords.map(record => record.tenantId)).size;
      const averageRevenuePerUser = customers > 0 ? revenue / customers : 0;

      return {
        date: periodStart,
        revenue,
        usage,
        customers,
        averageRevenuePerUser
      };
    });

    // Calculate growth rates
    const growth = this.calculateGrowthRates(data);

    // Generate forecasts
    const forecasts = this.generateRevenueForecasts(data, period);

    return {
      period,
      data,
      growth,
      forecasts
    };
  }

  /**
   * Process usage record
   */
  private async processUsageRecord(record: UsageRecord): Promise<void> {
    // Update current billing period
    await this.updateBillingPeriod(record);

    // Check for anomalies
    await this.checkUsageAnomalies(record);

    // Update cost optimizations
    await this.updateCostOptimizations(record);
  }

  /**
   * Calculate cost for usage
   */
  private async calculateCost(
    tenantId: string,
    metricName: string,
    value: number,
    config: MeteringConfig
  ): Promise<number> {
    if (!config.billing.enabled) {
      return 0;
    }

    let cost = 0;
    const includedUnits = config.billing.includedUnits || 0;
    const billableUnits = Math.max(0, value - includedUnits);

    switch (config.billing.billingModel) {
      case 'prepaid':
      case 'postpaid':
      case 'usage_based':
        cost = billableUnits * config.billing.pricePerUnit;
        break;

      case 'tiered':
        cost = await this.calculateTieredCost(tenantId, metricName, billableUnits);
        break;
    }

    // Add overage charges
    if (config.billing.overage?.enabled && billableUnits > (config.billing.overage.threshold || 0)) {
      const overageUnits = billableUnits - config.billing.overage.threshold;
      cost += overageUnits * config.billing.overage.pricePerUnit;
    }

    return Math.round(cost * 100); // Convert to cents
  }

  /**
   * Calculate tiered pricing cost
   */
  private async calculateTieredCost(
    tenantId: string,
    metricName: string,
    units: number
  ): Promise<number> {
    // Get tenant's pricing model
    const pricingModel = this.getTenantPricingModel(tenantId);
    if (!pricingModel?.tiers) {
      return 0;
    }

    let cost = 0;
    let remainingUnits = units;

    for (const tier of pricingModel.tiers) {
      if (remainingUnits <= 0) break;

      const tierUnits = Math.min(
        remainingUnits,
        (tier.maxUnits || Infinity) - tier.minUnits + 1
      );

      cost += tierUnits * tier.pricePerUnit;
      remainingUnits -= tierUnits;
    }

    return cost;
  }

  /**
   * Check usage alerts
   */
  private async checkUsageAlerts(
    tenantId: string,
    metricName: string,
    value: number
  ): Promise<void> {
    const config = this.meteringConfigs.get(metricName);
    if (!config?.alerting.enabled) return;

    // Get current period usage
    const currentPeriod = await this.getCurrentBillingPeriod(tenantId);
    const periodUsage = this.calculatePeriodUsage(currentPeriod, metricName);

    // Check thresholds
    for (const threshold of config.alerting.thresholds) {
      const limitUnits = config.billing.includedUnits || 1000; // Default limit
      const usagePercentage = (periodUsage / limitUnits) * 100;

      if (usagePercentage >= threshold.percentage) {
        await this.triggerUsageAlert(tenantId, metricName, threshold, usagePercentage);
      }
    }
  }

  /**
   * Generate cost optimizations
   */
  private async generateCostOptimizations(
    tenantId: string,
    records: UsageRecord[]
  ): Promise<CostOptimization[]> {
    const optimizations: CostOptimization[] = [];

    // Rightsizing optimization
    const rightsizingOpt = await this.identifyRightsizingOpportunities(tenantId, records);
    if (rightsizingOpt) optimizations.push(rightsizingOpt);

    // Scheduling optimization
    const schedulingOpt = await this.identifySchedulingOpportunities(tenantId, records);
    if (schedulingOpt) optimizations.push(schedulingOpt);

    // Caching optimization
    const cachingOpt = await this.identifyCachingOpportunities(tenantId, records);
    if (cachingOpt) optimizations.push(cachingOpt);

    // Deduplication optimization
    const deduplicationOpt = await this.identifyDeduplicationOpportunities(tenantId, records);
    if (deduplicationOpt) optimizations.push(deduplicationOpt);

    return optimizations;
  }

  /**
   * Initialize default metering configs
   */
  private initializeDefaultMetrics(): void {
    const defaultMetrics: MeteringConfig[] = [
      {
        metricName: 'api_requests',
        unit: 'requests',
        aggregation: 'count',
        billing: {
          enabled: true,
          pricePerUnit: 0.001, // $0.001 per request
          currency: 'USD',
          billingModel: 'usage_based',
          includedUnits: 10000, // 10k free requests
          overage: {
            enabled: true,
            pricePerUnit: 0.0015,
            threshold: 50000
          }
        },
        collection: {
          realTime: true,
          batchInterval: 60,
          retentionDays: 90
        },
        alerting: {
          enabled: true,
          thresholds: [
            { percentage: 80, action: 'notify', recipients: ['admin', 'billing'] },
            { percentage: 95, action: 'throttle', recipients: ['admin'] },
            { percentage: 100, action: 'block', recipients: ['admin', 'billing'] }
          ]
        }
      },
      {
        metricName: 'storage_gb',
        unit: 'GB',
        aggregation: 'max',
        billing: {
          enabled: true,
          pricePerUnit: 0.10, // $0.10 per GB per month
          currency: 'USD',
          billingModel: 'usage_based',
          includedUnits: 5 // 5GB free
        },
        collection: {
          realTime: false,
          batchInterval: 3600, // Hourly
          retentionDays: 365
        },
        alerting: {
          enabled: true,
          thresholds: [
            { percentage: 90, action: 'notify', recipients: ['admin'] }
          ]
        }
      },
      {
        metricName: 'compute_hours',
        unit: 'hours',
        aggregation: 'sum',
        billing: {
          enabled: true,
          pricePerUnit: 0.50, // $0.50 per compute hour
          currency: 'USD',
          billingModel: 'usage_based'
        },
        collection: {
          realTime: true,
          batchInterval: 300, // 5 minutes
          retentionDays: 180
        },
        alerting: {
          enabled: true,
          thresholds: [
            { percentage: 80, action: 'notify', recipients: ['admin'] }
          ]
        }
      },
      {
        metricName: 'plugin_installations',
        unit: 'installations',
        aggregation: 'count',
        billing: {
          enabled: true,
          pricePerUnit: 1.00, // $1.00 per plugin installation
          currency: 'USD',
          billingModel: 'usage_based'
        },
        collection: {
          realTime: true,
          batchInterval: 0,
          retentionDays: 365
        },
        alerting: {
          enabled: false,
          thresholds: []
        }
      }
    ];

    for (const config of defaultMetrics) {
      this.meteringConfigs.set(config.metricName, config);
    }

    console.log(`Initialized ${defaultMetrics.length} default metering configs`);
  }

  /**
   * Initialize pricing models
   */
  private initializePricingModels(): void {
    const pricingModels: PricingModel[] = [
      {
        id: 'starter',
        name: 'Starter',
        description: 'Perfect for small teams getting started',
        type: 'tiered',
        tiers: [
          {
            name: 'Free',
            minUnits: 0,
            maxUnits: 10000,
            pricePerUnit: 0,
            included: 10000
          },
          {
            name: 'Paid',
            minUnits: 10001,
            pricePerUnit: 0.001,
            included: 0
          }
        ],
        features: ['Basic monitoring', 'Community support'],
        limits: { 'max_plugins': 10, 'max_users': 5 },
        isActive: true
      },
      {
        id: 'professional',
        name: 'Professional',
        description: 'Advanced features for growing teams',
        type: 'tiered',
        tiers: [
          {
            name: 'Included',
            minUnits: 0,
            maxUnits: 50000,
            pricePerUnit: 0,
            included: 50000
          },
          {
            name: 'Additional',
            minUnits: 50001,
            pricePerUnit: 0.0008,
            included: 0
          }
        ],
        features: ['Advanced analytics', 'Priority support', 'Custom integrations'],
        limits: { 'max_plugins': 50, 'max_users': 25 },
        isActive: true
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Full-featured solution for large organizations',
        type: 'usage_based',
        features: ['Unlimited everything', 'Dedicated support', 'SLA', 'Custom development'],
        limits: {},
        isActive: true
      }
    ];

    for (const model of pricingModels) {
      this.pricingModels.set(model.id, model);
    }

    console.log(`Initialized ${pricingModels.length} pricing models`);
  }

  /**
   * Start usage aggregation
   */
  private startUsageAggregation(): void {
    this.aggregationInterval = setInterval(() => {
      this.performBatchAggregation().catch(console.error);
    }, 60000); // Every minute

    console.log('Started usage aggregation engine');
  }

  /**
   * Perform batch aggregation
   */
  private async performBatchAggregation(): Promise<void> {
    // Process records that haven't been aggregated yet
    const pendingRecords = this.usageRecords.filter(record => !record.billingPeriodId);
    
    for (const record of pendingRecords) {
      await this.processUsageRecord(record);
    }
  }

  // Helper methods (simplified implementations)
  private groupUsageByService(records: UsageRecord[]) {
    const serviceMap = new Map<string, number>();
    
    for (const record of records) {
      const service = record.metricName.split('_')[0];
      serviceMap.set(service, (serviceMap.get(service) || 0) + record.costCents);
    }

    const total = Array.from(serviceMap.values()).reduce((sum, cost) => sum + cost, 0);
    
    return Array.from(serviceMap.entries()).map(([service, cost]) => ({
      service,
      cost: cost / 100,
      percentage: total > 0 ? (cost / total) * 100 : 0
    }));
  }

  private generateCostTrend(records: UsageRecord[], timeRange: { start: Date; end: Date }) {
    const days = Math.ceil((timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24));
    const trend = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(timeRange.start);
      date.setDate(date.getDate() + i);
      
      const dayRecords = records.filter(record => 
        record.timestamp.toDateString() === date.toDateString()
      );
      
      const cost = dayRecords.reduce((sum, record) => sum + record.costCents, 0) / 100;
      trend.push({ date, cost });
    }

    return trend;
  }

  private findTopResources(records: UsageRecord[]) {
    const resourceMap = new Map<string, { cost: number; usage: number }>();
    
    for (const record of records) {
      const resource = record.resourceId || record.metricName;
      const existing = resourceMap.get(resource) || { cost: 0, usage: 0 };
      existing.cost += record.costCents;
      existing.usage += record.value;
      resourceMap.set(resource, existing);
    }

    return Array.from(resourceMap.entries())
      .map(([resource, data]) => ({
        resource,
        cost: data.cost / 100,
        usage: data.usage
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);
  }

  private async identifyWastedResources(tenantId: string, records: UsageRecord[]) {
    // Simplified waste identification
    return [
      { resource: 'idle-compute', wastedCost: 25.50, reason: 'Compute instances running with <5% utilization' },
      { resource: 'over-provisioned-storage', wastedCost: 12.75, reason: 'Storage allocated but not used' }
    ];
  }

  private async projectFutureCosts(tenantId: string, records: UsageRecord[]) {
    const totalCost = records.reduce((sum, record) => sum + record.costCents, 0) / 100;
    const daysInPeriod = 30; // Assume 30-day period
    const dailyAverage = totalCost / daysInPeriod;
    
    return {
      nextMonth: dailyAverage * 30,
      nextQuarter: dailyAverage * 90,
      confidence: 0.75
    };
  }

  // Additional helper methods...
  private generateRecordId(): string {
    return `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getUnitPrice(metricName: string): number {
    const config = this.meteringConfigs.get(metricName);
    return config ? config.billing.pricePerUnit * 100 : 0;
  }

  private getTenantPricingModel(tenantId: string): PricingModel | undefined {
    // Simplified - would look up tenant's actual pricing model
    return this.pricingModels.get('professional');
  }

  private async getCurrentBillingPeriod(tenantId: string): Promise<BillingPeriod> {
    // Simplified - would get actual current billing period
    const periodId = `${tenantId}_${new Date().getFullYear()}_${new Date().getMonth() + 1}`;
    let period = this.billingPeriods.get(periodId);
    
    if (!period) {
      const now = new Date();
      period = {
        id: periodId,
        tenantId,
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        status: 'active',
        usage: new Map(),
        totalCostCents: 0,
        currency: 'USD',
        createdAt: now,
        updatedAt: now
      };
      this.billingPeriods.set(periodId, period);
    }
    
    return period;
  }

  private calculatePeriodUsage(period: BillingPeriod, metricName: string): number {
    const usage = period.usage.get(metricName);
    return usage ? usage.totalValue : 0;
  }

  private async triggerUsageAlert(
    tenantId: string,
    metricName: string,
    threshold: any,
    usagePercentage: number
  ): Promise<void> {
    console.log(`Usage alert: ${tenantId} ${metricName} at ${usagePercentage.toFixed(1)}% (threshold: ${threshold.percentage}%)`);
  }

  private async updateBillingPeriod(record: UsageRecord): Promise<void> {
    const period = await this.getCurrentBillingPeriod(record.tenantId);
    
    let usage = period.usage.get(record.metricName);
    if (!usage) {
      usage = {
        metricName: record.metricName,
        totalValue: 0,
        unit: record.unit,
        recordCount: 0,
        costCents: 0,
        includedUnits: 0,
        billableUnits: 0,
        overageUnits: 0,
        overageCostCents: 0
      };
      period.usage.set(record.metricName, usage);
    }

    usage.totalValue += record.value;
    usage.recordCount++;
    usage.costCents += record.costCents;
    period.totalCostCents += record.costCents;
    period.updatedAt = new Date();

    record.billingPeriodId = period.id;
  }

  private async checkUsageAnomalies(record: UsageRecord): Promise<void> {
    // Simplified anomaly detection
    const recentRecords = this.usageRecords
      .filter(r => 
        r.tenantId === record.tenantId && 
        r.metricName === record.metricName &&
        Date.now() - r.timestamp.getTime() < 24 * 60 * 60 * 1000
      )
      .slice(-10);

    if (recentRecords.length >= 5) {
      const average = recentRecords.reduce((sum, r) => sum + r.value, 0) / recentRecords.length;
      const deviation = Math.abs(record.value - average) / average;
      
      if (deviation > 2.0) { // 200% deviation
        console.log(`Usage anomaly detected: ${record.metricName} value ${record.value} vs average ${average.toFixed(2)}`);
      }
    }
  }

  private async updateCostOptimizations(record: UsageRecord): Promise<void> {
    // Simplified cost optimization updates
    if (!this.costOptimizations.has(record.tenantId)) {
      this.costOptimizations.set(record.tenantId, []);
    }
  }

  private generateTimePeriods(period: string, timeRange: { start: Date; end: Date }): Date[] {
    const periods = [];
    const current = new Date(timeRange.start);
    
    while (current < timeRange.end) {
      periods.push(new Date(current));
      
      switch (period) {
        case 'daily':
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          current.setDate(current.getDate() + 7);
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + 1);
          break;
        case 'quarterly':
          current.setMonth(current.getMonth() + 3);
          break;
      }
    }
    
    return periods;
  }

  private getPeriodEnd(period: string, start: Date): Date {
    const end = new Date(start);
    
    switch (period) {
      case 'daily':
        end.setDate(end.getDate() + 1);
        break;
      case 'weekly':
        end.setDate(end.getDate() + 7);
        break;
      case 'monthly':
        end.setMonth(end.getMonth() + 1);
        break;
      case 'quarterly':
        end.setMonth(end.getMonth() + 3);
        break;
    }
    
    return end;
  }

  private calculateGrowthRates(data: any[]) {
    if (data.length < 2) {
      return { revenueGrowth: 0, usageGrowth: 0, customerGrowth: 0 };
    }

    const first = data[0];
    const last = data[data.length - 1];

    return {
      revenueGrowth: ((last.revenue - first.revenue) / first.revenue) * 100,
      usageGrowth: ((last.usage - first.usage) / first.usage) * 100,
      customerGrowth: ((last.customers - first.customers) / first.customers) * 100
    };
  }

  private generateRevenueForecasts(data: any[], period: string) {
    const recent = data.slice(-3);
    const avgRevenue = recent.reduce((sum, d) => sum + d.revenue, 0) / recent.length;
    
    return {
      nextPeriod: avgRevenue * 1.1, // 10% growth assumption
      confidence: 0.7,
      factors: ['Historical growth', 'Market trends', 'Seasonal patterns']
    };
  }

  // Optimization method stubs
  private async identifyRightsizingOpportunities(tenantId: string, records: UsageRecord[]): Promise<CostOptimization | null> {
    return {
      id: `opt_${Date.now()}_rightsizing`,
      tenantId,
      type: 'rightsizing',
      description: 'Rightsize over-provisioned compute instances',
      potentialSavings: { amountCents: 2500, percentage: 15, currency: 'USD' },
      implementation: {
        effort: 'medium',
        riskLevel: 'low',
        estimatedTime: '2 hours',
        steps: ['Analyze usage patterns', 'Identify over-provisioned instances', 'Resize instances']
      },
      status: 'identified',
      identifiedAt: new Date()
    };
  }

  private async identifySchedulingOpportunities(tenantId: string, records: UsageRecord[]): Promise<CostOptimization | null> {
    return null; // Simplified
  }

  private async identifyCachingOpportunities(tenantId: string, records: UsageRecord[]): Promise<CostOptimization | null> {
    return null; // Simplified
  }

  private async identifyDeduplicationOpportunities(tenantId: string, records: UsageRecord[]): Promise<CostOptimization | null> {
    return null; // Simplified
  }

  private async implementAutomaticOptimizations(tenantId: string, optimizations: CostOptimization[]): Promise<CostOptimization[]> {
    return []; // Simplified
  }

  /**
   * Get usage statistics
   */
  getStatistics() {
    const totalRecords = this.usageRecords.length;
    const totalCost = this.usageRecords.reduce((sum, record) => sum + record.costCents, 0) / 100;
    const uniqueTenants = new Set(this.usageRecords.map(record => record.tenantId)).size;
    const uniqueMetrics = new Set(this.usageRecords.map(record => record.metricName)).size;

    return {
      totalRecords,
      totalCost,
      uniqueTenants,
      uniqueMetrics,
      meteringConfigs: this.meteringConfigs.size,
      activeBillingPeriods: this.billingPeriods.size
    };
  }

  /**
   * Shutdown metering engine
   */
  shutdown(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = null;
    }
    console.log('Usage metering engine shut down');
  }
}

// Global usage metering instance
export const usageMetering = new UsageMeteringEngine();

export default usageMetering;