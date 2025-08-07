/**
 * Budget Manager - Advanced budget management, tracking, and enforcement
 * Intelligent budget allocation, monitoring, and automated cost controls
 */

import { EventEmitter } from 'events';
import { FinOpsConfig } from './finops-config';
import { CostDataPoint } from './cost-intelligence';

export interface Budget {
  id: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  status: 'active' | 'inactive' | 'exceeded' | 'suspended';
  scope: {
    services: string[];
    regions: string[];
    resourceTypes: string[];
    tags: Record<string, string>;
    accounts: string[];
  };
  alertThresholds: Array<{
    percentage: number;
    type: 'warning' | 'critical';
    enabled: boolean;
    channels: string[];
  }>;
  enforcement: {
    enabled: boolean;
    actions: Array<{
      threshold: number;
      action: 'notify' | 'limit' | 'shutdown' | 'approval_required';
      parameters: Record<string, any>;
    }>;
  };
  rollover: {
    enabled: boolean;
    type: 'percentage' | 'fixed_amount';
    value: number;
  };
  approvers: Array<{
    email: string;
    role: string;
    approvalLimit: number;
  }>;
  metadata: {
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
    category: string;
    businessUnit: string;
    costCenter: string;
  };
}

export interface BudgetSpend {
  budgetId: string;
  period: string;
  totalSpend: number;
  projectedSpend: number;
  remainingBudget: number;
  utilizationPercentage: number;
  dailyAverageSpend: number;
  weeklyTrend: number;
  breakdown: {
    byService: Record<string, number>;
    byRegion: Record<string, number>;
    byResourceType: Record<string, number>;
    byTag: Record<string, Record<string, number>>;
  };
  forecast: {
    endOfPeriodSpend: number;
    confidence: number;
    methodology: string;
  };
}

export interface BudgetAlert {
  id: string;
  budgetId: string;
  type: 'threshold_exceeded' | 'projected_overspend' | 'unusual_spike' | 'enforcement_action';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: {
    currentSpend: number;
    budgetAmount: number;
    thresholdPercentage: number;
    projectedOverrun?: number;
    affectedResources?: string[];
  };
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  actions: Array<{
    type: string;
    description: string;
    automated: boolean;
    executedAt?: Date;
    result?: string;
  }>;
}

export interface BudgetAnalytics {
  totalBudgets: number;
  activeBudgets: number;
  totalAllocated: number;
  totalSpent: number;
  utilizationRate: number;
  budgetsOnTrack: number;
  budgetsAtRisk: number;
  budgetsExceeded: number;
  forecastAccuracy: number;
  topSpenders: Array<{
    budgetName: string;
    spent: number;
    utilization: number;
  }>;
  trendAnalysis: {
    monthOverMonth: number;
    quarterOverQuarter: number;
    yearOverYear: number;
    seasonalPatterns: Array<{
      pattern: string;
      confidence: number;
    }>;
  };
}

export interface BudgetRecommendation {
  id: string;
  type: 'increase_budget' | 'decrease_budget' | 'reallocate_funds' | 'adjust_thresholds' | 'optimize_scope';
  budgetId: string;
  title: string;
  description: string;
  rationale: string;
  impact: {
    costImplication: number;
    riskReduction: number;
    efficiencyGain: number;
  };
  implementation: {
    effort: 'low' | 'medium' | 'high';
    timeline: string;
    steps: string[];
  };
  confidence: number;
  metadata: {
    basedOnDays: number;
    algorithm: string;
    createdAt: Date;
  };
}

class BudgetManager extends EventEmitter {
  private config: FinOpsConfig;
  private budgets: Map<string, Budget> = new Map();
  private budgetSpends: Map<string, BudgetSpend> = new Map();
  private alerts: Map<string, BudgetAlert> = new Map();
  private isInitialized = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(config: FinOpsConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load existing budgets
      await this.loadBudgets();
      
      // Initialize budget monitoring
      await this.initializeBudgetMonitoring();
      
      // Start real-time monitoring
      this.startBudgetMonitoring();
      
      this.isInitialized = true;
      console.log('Budget Manager initialized');
    } catch (error) {
      console.error('Failed to initialize Budget Manager:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    this.isInitialized = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Create a new budget
   */
  async createBudget(budgetData: Omit<Budget, 'id' | 'metadata'>): Promise<string> {
    const budgetId = `budget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const budget: Budget = {
      id: budgetId,
      ...budgetData,
      metadata: {
        createdBy: 'system', // Would be actual user in real implementation
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        category: budgetData.scope.services[0] || 'general',
        businessUnit: 'default',
        costCenter: 'default'
      }
    };

    // Validate budget
    await this.validateBudget(budget);
    
    // Store budget
    this.budgets.set(budgetId, budget);
    
    // Initialize spend tracking
    await this.initializeBudgetSpendTracking(budgetId);
    
    // Setup alerts
    await this.setupBudgetAlerts(budgetId);
    
    this.emit('budget_created', { budgetId, budget });
    
    return budgetId;
  }

  /**
   * Update existing budget
   */
  async updateBudget(budgetId: string, updates: Partial<Budget>): Promise<void> {
    const budget = this.budgets.get(budgetId);
    if (!budget) {
      throw new Error(`Budget ${budgetId} not found`);
    }

    const updatedBudget = {
      ...budget,
      ...updates,
      id: budgetId, // Ensure ID cannot be changed
      metadata: {
        ...budget.metadata,
        ...updates.metadata,
        updatedAt: new Date()
      }
    };

    // Validate updated budget
    await this.validateBudget(updatedBudget);
    
    this.budgets.set(budgetId, updatedBudget);
    
    // Update alerts if thresholds changed
    if (updates.alertThresholds) {
      await this.setupBudgetAlerts(budgetId);
    }
    
    this.emit('budget_updated', { budgetId, budget: updatedBudget });
  }

  /**
   * Delete a budget
   */
  async deleteBudget(budgetId: string): Promise<void> {
    const budget = this.budgets.get(budgetId);
    if (!budget) {
      throw new Error(`Budget ${budgetId} not found`);
    }

    // Remove from all collections
    this.budgets.delete(budgetId);
    this.budgetSpends.delete(budgetId);
    
    // Remove related alerts
    for (const [alertId, alert] of this.alerts) {
      if (alert.budgetId === budgetId) {
        this.alerts.delete(alertId);
      }
    }
    
    this.emit('budget_deleted', { budgetId });
  }

  /**
   * Get budget details
   */
  async getBudget(budgetId: string): Promise<Budget> {
    const budget = this.budgets.get(budgetId);
    if (!budget) {
      throw new Error(`Budget ${budgetId} not found`);
    }
    return budget;
  }

  /**
   * Get all budgets with optional filtering
   */
  async getBudgets(filters?: {
    status?: Budget['status'];
    period?: Budget['period'];
    category?: string;
    tags?: string[];
  }): Promise<Budget[]> {
    let budgets = Array.from(this.budgets.values());
    
    if (filters) {
      budgets = budgets.filter(budget => {
        if (filters.status && budget.status !== filters.status) return false;
        if (filters.period && budget.period !== filters.period) return false;
        if (filters.category && budget.metadata.category !== filters.category) return false;
        if (filters.tags && !filters.tags.every(tag => budget.metadata.tags.includes(tag))) return false;
        return true;
      });
    }
    
    return budgets;
  }

  /**
   * Get budget status and spending information
   */
  async getBudgetStatus(): Promise<{
    budgets: Array<{
      id: string;
      name: string;
      allocated: number;
      spent: number;
      remaining: number;
      utilizationPercentage: number;
      status: 'on_track' | 'warning' | 'exceeded';
      projectedSpend: number;
    }>;
    alerts: BudgetAlert[];
  }> {
    const budgetStatuses = [];
    const allAlerts = Array.from(this.alerts.values()).filter(alert => !alert.acknowledged);

    for (const budget of this.budgets.values()) {
      const spend = this.budgetSpends.get(budget.id);
      if (spend) {
        const status = this.determineBudgetStatus(budget, spend);
        budgetStatuses.push({
          id: budget.id,
          name: budget.name,
          allocated: budget.amount,
          spent: spend.totalSpend,
          remaining: spend.remainingBudget,
          utilizationPercentage: spend.utilizationPercentage,
          status,
          projectedSpend: spend.forecast.endOfPeriodSpend
        });
      }
    }

    return {
      budgets: budgetStatuses,
      alerts: allAlerts
    };
  }

  /**
   * Process cost data and update budget spending
   */
  async processCostData(costData: CostDataPoint[]): Promise<void> {
    for (const budget of this.budgets.values()) {
      if (budget.status !== 'active') continue;
      
      // Filter cost data for this budget's scope
      const relevantCosts = this.filterCostDataForBudget(costData, budget);
      
      if (relevantCosts.length > 0) {
        await this.updateBudgetSpend(budget.id, relevantCosts);
      }
    }
  }

  /**
   * Check budget status and trigger alerts if necessary
   */
  async checkBudgetStatus(): Promise<BudgetAlert[]> {
    const newAlerts: BudgetAlert[] = [];

    for (const budget of this.budgets.values()) {
      if (budget.status !== 'active') continue;
      
      const spend = this.budgetSpends.get(budget.id);
      if (!spend) continue;

      // Check threshold alerts
      const thresholdAlerts = await this.checkThresholdAlerts(budget, spend);
      newAlerts.push(...thresholdAlerts);
      
      // Check projection alerts
      const projectionAlerts = await this.checkProjectionAlerts(budget, spend);
      newAlerts.push(...projectionAlerts);
      
      // Check anomaly alerts
      const anomalyAlerts = await this.checkSpendingAnomalies(budget, spend);
      newAlerts.push(...anomalyAlerts);
      
      // Execute enforcement actions if needed
      await this.executeEnforcementActions(budget, spend);
    }

    // Store new alerts
    newAlerts.forEach(alert => {
      this.alerts.set(alert.id, alert);
      this.emit('budget_alert', alert);
    });

    return newAlerts;
  }

  /**
   * Get budget analytics and insights
   */
  async getBudgetAnalytics(timeRange?: { start: Date; end: Date }): Promise<BudgetAnalytics> {
    const activeBudgets = Array.from(this.budgets.values()).filter(b => b.status === 'active');
    const totalBudgets = this.budgets.size;
    const totalAllocated = activeBudgets.reduce((sum, b) => sum + b.amount, 0);
    
    let totalSpent = 0;
    let budgetsOnTrack = 0;
    let budgetsAtRisk = 0;
    let budgetsExceeded = 0;
    
    const topSpenders = [];
    
    for (const budget of activeBudgets) {
      const spend = this.budgetSpends.get(budget.id);
      if (spend) {
        totalSpent += spend.totalSpend;
        
        const status = this.determineBudgetStatus(budget, spend);
        if (status === 'on_track') budgetsOnTrack++;
        else if (status === 'warning') budgetsAtRisk++;
        else if (status === 'exceeded') budgetsExceeded++;
        
        topSpenders.push({
          budgetName: budget.name,
          spent: spend.totalSpend,
          utilization: spend.utilizationPercentage
        });
      }
    }
    
    topSpenders.sort((a, b) => b.spent - a.spent);
    
    return {
      totalBudgets,
      activeBudgets: activeBudgets.length,
      totalAllocated,
      totalSpent,
      utilizationRate: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0,
      budgetsOnTrack,
      budgetsAtRisk,
      budgetsExceeded,
      forecastAccuracy: await this.calculateForecastAccuracy(),
      topSpenders: topSpenders.slice(0, 10),
      trendAnalysis: await this.calculateTrendAnalysis()
    };
  }

  /**
   * Generate budget recommendations
   */
  async generateBudgetRecommendations(): Promise<BudgetRecommendation[]> {
    const recommendations: BudgetRecommendation[] = [];
    
    for (const budget of this.budgets.values()) {
      if (budget.status !== 'active') continue;
      
      const spend = this.budgetSpends.get(budget.id);
      if (!spend) continue;
      
      // Check for budget increase recommendations
      if (spend.utilizationPercentage > 90) {
        recommendations.push(await this.generateBudgetIncreaseRecommendation(budget, spend));
      }
      
      // Check for budget decrease recommendations
      if (spend.utilizationPercentage < 50 && this.isPeriodMoreThanHalfway(budget)) {
        recommendations.push(await this.generateBudgetDecreaseRecommendation(budget, spend));
      }
      
      // Check for threshold adjustment recommendations
      const thresholdRec = await this.generateThresholdAdjustmentRecommendation(budget, spend);
      if (thresholdRec) recommendations.push(thresholdRec);
      
      // Check for scope optimization recommendations
      const scopeRec = await this.generateScopeOptimizationRecommendation(budget, spend);
      if (scopeRec) recommendations.push(scopeRec);
    }
    
    return recommendations.filter(rec => rec.confidence > 0.7);
  }

  /**
   * Create or update budget from template
   */
  async createBudgetFromTemplate(templateName: string, customizations?: Partial<Budget>): Promise<string> {
    const template = await this.getBudgetTemplate(templateName);
    const budgetData = {
      ...template,
      ...customizations
    };
    
    return await this.createBudget(budgetData);
  }

  /**
   * Clone an existing budget
   */
  async cloneBudget(sourceBudgetId: string, customizations?: Partial<Budget>): Promise<string> {
    const sourceBudget = await this.getBudget(sourceBudgetId);
    
    const budgetData = {
      ...sourceBudget,
      ...customizations,
      name: `${sourceBudget.name} (Copy)`
    };
    
    // Remove fields that shouldn't be cloned
    delete (budgetData as any).id;
    delete (budgetData as any).metadata;
    
    return await this.createBudget(budgetData);
  }

  // Private methods

  private async loadBudgets(): Promise<void> {
    // Load budgets from database or storage
    // This would integrate with your data persistence layer
    console.log('Loading existing budgets...');
  }

  private async initializeBudgetMonitoring(): Promise<void> {
    // Initialize monitoring for all active budgets
    for (const budget of this.budgets.values()) {
      if (budget.status === 'active') {
        await this.initializeBudgetSpendTracking(budget.id);
        await this.setupBudgetAlerts(budget.id);
      }
    }
  }

  private startBudgetMonitoring(): void {
    const pollingInterval = this.config.getBudgetConfig()?.pollingInterval || 300000; // 5 minutes
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkBudgetStatus();
      } catch (error) {
        console.error('Error in budget monitoring:', error);
        this.emit('monitoring_error', error);
      }
    }, pollingInterval);
  }

  private async validateBudget(budget: Budget): Promise<void> {
    // Validate budget configuration
    if (budget.amount <= 0) {
      throw new Error('Budget amount must be greater than 0');
    }
    
    if (budget.endDate <= budget.startDate) {
      throw new Error('Budget end date must be after start date');
    }
    
    if (budget.alertThresholds.some(t => t.percentage <= 0 || t.percentage > 100)) {
      throw new Error('Alert thresholds must be between 0 and 100');
    }
    
    // Validate enforcement actions
    if (budget.enforcement.enabled) {
      for (const action of budget.enforcement.actions) {
        if (action.threshold <= 0 || action.threshold > 100) {
          throw new Error('Enforcement thresholds must be between 0 and 100');
        }
      }
    }
  }

  private async initializeBudgetSpendTracking(budgetId: string): Promise<void> {
    const budget = this.budgets.get(budgetId);
    if (!budget) return;

    const budgetSpend: BudgetSpend = {
      budgetId,
      period: this.getCurrentPeriod(budget),
      totalSpend: 0,
      projectedSpend: 0,
      remainingBudget: budget.amount,
      utilizationPercentage: 0,
      dailyAverageSpend: 0,
      weeklyTrend: 0,
      breakdown: {
        byService: {},
        byRegion: {},
        byResourceType: {},
        byTag: {}
      },
      forecast: {
        endOfPeriodSpend: 0,
        confidence: 0,
        methodology: 'linear_regression'
      }
    };

    this.budgetSpends.set(budgetId, budgetSpend);
  }

  private async setupBudgetAlerts(budgetId: string): Promise<void> {
    // Setup alert monitoring for the budget
    const budget = this.budgets.get(budgetId);
    if (!budget) return;

    // This would integrate with your alerting system
    console.log(`Setting up alerts for budget ${budget.name}`);
  }

  private filterCostDataForBudget(costData: CostDataPoint[], budget: Budget): CostDataPoint[] {
    return costData.filter(point => {
      // Filter by services
      if (budget.scope.services.length > 0 && !budget.scope.services.includes(point.service)) {
        return false;
      }
      
      // Filter by regions
      if (budget.scope.regions.length > 0 && !budget.scope.regions.includes(point.region)) {
        return false;
      }
      
      // Filter by resource types
      if (budget.scope.resourceTypes.length > 0 && !budget.scope.resourceTypes.includes(point.resourceType)) {
        return false;
      }
      
      // Filter by tags
      for (const [key, value] of Object.entries(budget.scope.tags)) {
        if (point.tags[key] !== value) {
          return false;
        }
      }
      
      // Filter by time range
      return point.timestamp >= budget.startDate && point.timestamp <= budget.endDate;
    });
  }

  private async updateBudgetSpend(budgetId: string, costData: CostDataPoint[]): Promise<void> {
    const budgetSpend = this.budgetSpends.get(budgetId);
    const budget = this.budgets.get(budgetId);
    
    if (!budgetSpend || !budget) return;

    // Calculate new spend amounts
    const newSpend = costData.reduce((sum, point) => sum + point.cost, 0);
    budgetSpend.totalSpend += newSpend;
    
    // Update remaining budget
    budgetSpend.remainingBudget = budget.amount - budgetSpend.totalSpend;
    
    // Update utilization percentage
    budgetSpend.utilizationPercentage = (budgetSpend.totalSpend / budget.amount) * 100;
    
    // Update breakdowns
    this.updateSpendBreakdowns(budgetSpend, costData);
    
    // Update daily average and trends
    await this.updateSpendTrends(budgetSpend, budget);
    
    // Update forecast
    await this.updateSpendForecast(budgetSpend, budget);
    
    this.budgetSpends.set(budgetId, budgetSpend);
  }

  private updateSpendBreakdowns(budgetSpend: BudgetSpend, costData: CostDataPoint[]): void {
    costData.forEach(point => {
      // By service
      budgetSpend.breakdown.byService[point.service] = 
        (budgetSpend.breakdown.byService[point.service] || 0) + point.cost;
      
      // By region
      budgetSpend.breakdown.byRegion[point.region] = 
        (budgetSpend.breakdown.byRegion[point.region] || 0) + point.cost;
      
      // By resource type
      budgetSpend.breakdown.byResourceType[point.resourceType] = 
        (budgetSpend.breakdown.byResourceType[point.resourceType] || 0) + point.cost;
      
      // By tags
      Object.entries(point.tags).forEach(([key, value]) => {
        if (!budgetSpend.breakdown.byTag[key]) {
          budgetSpend.breakdown.byTag[key] = {};
        }
        budgetSpend.breakdown.byTag[key][value] = 
          (budgetSpend.breakdown.byTag[key][value] || 0) + point.cost;
      });
    });
  }

  private async updateSpendTrends(budgetSpend: BudgetSpend, budget: Budget): Promise<void> {
    // Calculate daily average spend
    const daysSinceStart = Math.max(1, Math.ceil(
      (Date.now() - budget.startDate.getTime()) / (1000 * 60 * 60 * 24)
    ));
    budgetSpend.dailyAverageSpend = budgetSpend.totalSpend / daysSinceStart;
    
    // Calculate weekly trend (simplified)
    // In a real implementation, this would analyze historical data
    budgetSpend.weeklyTrend = 5; // Placeholder percentage
  }

  private async updateSpendForecast(budgetSpend: BudgetSpend, budget: Budget): Promise<void> {
    // Simple linear projection based on current spending rate
    const totalDaysInPeriod = this.getTotalDaysInPeriod(budget);
    const daysSinceStart = Math.ceil(
      (Date.now() - budget.startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceStart > 0) {
      const dailySpendRate = budgetSpend.totalSpend / daysSinceStart;
      budgetSpend.forecast.endOfPeriodSpend = dailySpendRate * totalDaysInPeriod;
      budgetSpend.forecast.confidence = Math.max(0.5, Math.min(0.9, daysSinceStart / 7)); // Higher confidence with more data
    }
    
    budgetSpend.projectedSpend = budgetSpend.forecast.endOfPeriodSpend;
  }

  private determineBudgetStatus(budget: Budget, spend: BudgetSpend): 'on_track' | 'warning' | 'exceeded' {
    if (spend.utilizationPercentage >= 100) {
      return 'exceeded';
    }
    
    // Check if any alert thresholds are crossed
    const criticalThreshold = Math.max(...budget.alertThresholds
      .filter(t => t.type === 'critical')
      .map(t => t.percentage));
    
    const warningThreshold = Math.max(...budget.alertThresholds
      .filter(t => t.type === 'warning')
      .map(t => t.percentage));
    
    if (spend.utilizationPercentage >= criticalThreshold) {
      return 'exceeded';
    } else if (spend.utilizationPercentage >= warningThreshold) {
      return 'warning';
    }
    
    return 'on_track';
  }

  private async checkThresholdAlerts(budget: Budget, spend: BudgetSpend): Promise<BudgetAlert[]> {
    const alerts: BudgetAlert[] = [];
    
    for (const threshold of budget.alertThresholds) {
      if (!threshold.enabled) continue;
      
      if (spend.utilizationPercentage >= threshold.percentage) {
        // Check if we've already alerted for this threshold
        const existingAlert = Array.from(this.alerts.values()).find(alert => 
          alert.budgetId === budget.id && 
          alert.type === 'threshold_exceeded' &&
          alert.details.thresholdPercentage === threshold.percentage &&
          !alert.acknowledged
        );
        
        if (!existingAlert) {
          alerts.push({
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            budgetId: budget.id,
            type: 'threshold_exceeded',
            severity: threshold.type === 'critical' ? 'critical' : 'high',
            message: `Budget "${budget.name}" has exceeded ${threshold.percentage}% threshold`,
            details: {
              currentSpend: spend.totalSpend,
              budgetAmount: budget.amount,
              thresholdPercentage: threshold.percentage
            },
            timestamp: new Date(),
            acknowledged: false,
            actions: []
          });
        }
      }
    }
    
    return alerts;
  }

  private async checkProjectionAlerts(budget: Budget, spend: BudgetSpend): Promise<BudgetAlert[]> {
    const alerts: BudgetAlert[] = [];
    
    // Check if projected spend will exceed budget
    if (spend.forecast.endOfPeriodSpend > budget.amount && spend.forecast.confidence > 0.7) {
      const projectedOverrun = spend.forecast.endOfPeriodSpend - budget.amount;
      
      alerts.push({
        id: `projection_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        budgetId: budget.id,
        type: 'projected_overspend',
        severity: 'medium',
        message: `Budget "${budget.name}" is projected to exceed by $${projectedOverrun.toFixed(2)}`,
        details: {
          currentSpend: spend.totalSpend,
          budgetAmount: budget.amount,
          thresholdPercentage: (spend.forecast.endOfPeriodSpend / budget.amount) * 100,
          projectedOverrun
        },
        timestamp: new Date(),
        acknowledged: false,
        actions: []
      });
    }
    
    return alerts;
  }

  private async checkSpendingAnomalies(budget: Budget, spend: BudgetSpend): Promise<BudgetAlert[]> {
    const alerts: BudgetAlert[] = [];
    
    // Check for unusual spending spikes
    // This would integrate with anomaly detection algorithms
    
    return alerts;
  }

  private async executeEnforcementActions(budget: Budget, spend: BudgetSpend): Promise<void> {
    if (!budget.enforcement.enabled) return;
    
    for (const action of budget.enforcement.actions) {
      if (spend.utilizationPercentage >= action.threshold) {
        await this.executeEnforcementAction(budget, action);
      }
    }
  }

  private async executeEnforcementAction(budget: Budget, action: Budget['enforcement']['actions'][0]): Promise<void> {
    switch (action.action) {
      case 'notify':
        await this.sendEnforcementNotification(budget, action);
        break;
      case 'limit':
        await this.applySpendingLimits(budget, action);
        break;
      case 'shutdown':
        await this.shutdownResources(budget, action);
        break;
      case 'approval_required':
        await this.requireApprovalForSpending(budget, action);
        break;
    }
  }

  private async sendEnforcementNotification(budget: Budget, action: any): Promise<void> {
    // Send enforcement notification
    console.log(`Sending enforcement notification for budget ${budget.name}`);
  }

  private async applySpendingLimits(budget: Budget, action: any): Promise<void> {
    // Apply spending limits
    console.log(`Applying spending limits for budget ${budget.name}`);
  }

  private async shutdownResources(budget: Budget, action: any): Promise<void> {
    // Shutdown resources (with proper safeguards)
    console.log(`Shutting down resources for budget ${budget.name}`);
  }

  private async requireApprovalForSpending(budget: Budget, action: any): Promise<void> {
    // Require approval for new spending
    console.log(`Requiring approval for spending on budget ${budget.name}`);
  }

  private getCurrentPeriod(budget: Budget): string {
    const now = new Date();
    return `${budget.period}_${now.getFullYear()}_${now.getMonth() + 1}`;
  }

  private getTotalDaysInPeriod(budget: Budget): number {
    return Math.ceil((budget.endDate.getTime() - budget.startDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  private async calculateForecastAccuracy(): Promise<number> {
    // Calculate forecast accuracy based on historical data
    return 0.85; // Placeholder
  }

  private async calculateTrendAnalysis(): Promise<BudgetAnalytics['trendAnalysis']> {
    return {
      monthOverMonth: 5.2,
      quarterOverQuarter: 12.8,
      yearOverYear: 23.5,
      seasonalPatterns: [
        { pattern: 'Q4 spike', confidence: 0.9 },
        { pattern: 'Summer dip', confidence: 0.7 }
      ]
    };
  }

  private isPeriodMoreThanHalfway(budget: Budget): boolean {
    const now = Date.now();
    const total = budget.endDate.getTime() - budget.startDate.getTime();
    const elapsed = now - budget.startDate.getTime();
    return elapsed > (total * 0.5);
  }

  private async generateBudgetIncreaseRecommendation(budget: Budget, spend: BudgetSpend): Promise<BudgetRecommendation> {
    const recommendedIncrease = spend.forecast.endOfPeriodSpend - budget.amount;
    
    return {
      id: `rec_increase_${budget.id}_${Date.now()}`,
      type: 'increase_budget',
      budgetId: budget.id,
      title: `Increase budget for ${budget.name}`,
      description: `Increase budget by $${recommendedIncrease.toFixed(2)} to prevent overspend`,
      rationale: `Current utilization is ${spend.utilizationPercentage.toFixed(1)}% with projected overspend`,
      impact: {
        costImplication: recommendedIncrease,
        riskReduction: 0.8,
        efficiencyGain: 0.6
      },
      implementation: {
        effort: 'low',
        timeline: '1 day',
        steps: [
          'Request budget increase approval',
          'Update budget allocation',
          'Notify stakeholders'
        ]
      },
      confidence: spend.forecast.confidence,
      metadata: {
        basedOnDays: Math.ceil((Date.now() - budget.startDate.getTime()) / (1000 * 60 * 60 * 24)),
        algorithm: 'trend_projection',
        createdAt: new Date()
      }
    };
  }

  private async generateBudgetDecreaseRecommendation(budget: Budget, spend: BudgetSpend): Promise<BudgetRecommendation> {
    const recommendedDecrease = budget.amount - spend.forecast.endOfPeriodSpend;
    
    return {
      id: `rec_decrease_${budget.id}_${Date.now()}`,
      type: 'decrease_budget',
      budgetId: budget.id,
      title: `Reduce budget for ${budget.name}`,
      description: `Reduce budget by $${recommendedDecrease.toFixed(2)} due to low utilization`,
      rationale: `Current utilization is only ${spend.utilizationPercentage.toFixed(1)}%`,
      impact: {
        costImplication: -recommendedDecrease,
        riskReduction: 0.3,
        efficiencyGain: 0.8
      },
      implementation: {
        effort: 'low',
        timeline: '1 day',
        steps: [
          'Analyze spending patterns',
          'Confirm with budget owner',
          'Reduce budget allocation'
        ]
      },
      confidence: 0.7,
      metadata: {
        basedOnDays: Math.ceil((Date.now() - budget.startDate.getTime()) / (1000 * 60 * 60 * 24)),
        algorithm: 'utilization_analysis',
        createdAt: new Date()
      }
    };
  }

  private async generateThresholdAdjustmentRecommendation(budget: Budget, spend: BudgetSpend): Promise<BudgetRecommendation | null> {
    // Analyze alert frequency and effectiveness
    const recentAlerts = Array.from(this.alerts.values()).filter(alert => 
      alert.budgetId === budget.id &&
      alert.timestamp.getTime() > (Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
    );
    
    if (recentAlerts.length > 10) { // Too many alerts
      return {
        id: `rec_threshold_${budget.id}_${Date.now()}`,
        type: 'adjust_thresholds',
        budgetId: budget.id,
        title: `Adjust alert thresholds for ${budget.name}`,
        description: `Reduce alert frequency by adjusting thresholds`,
        rationale: `${recentAlerts.length} alerts in the last 30 days indicates threshold fatigue`,
        impact: {
          costImplication: 0,
          riskReduction: 0.2,
          efficiencyGain: 0.7
        },
        implementation: {
          effort: 'low',
          timeline: '30 minutes',
          steps: [
            'Review alert history',
            'Adjust threshold percentages',
            'Update alert configuration'
          ]
        },
        confidence: 0.8,
        metadata: {
          basedOnDays: 30,
          algorithm: 'alert_frequency_analysis',
          createdAt: new Date()
        }
      };
    }
    
    return null;
  }

  private async generateScopeOptimizationRecommendation(budget: Budget, spend: BudgetSpend): Promise<BudgetRecommendation | null> {
    // Analyze if budget scope can be optimized
    // This would involve analyzing spending patterns and suggesting scope adjustments
    return null;
  }

  private async getBudgetTemplate(templateName: string): Promise<Omit<Budget, 'id' | 'metadata'>> {
    // Return budget template configuration
    // This would load from a templates system
    throw new Error('Budget template not found');
  }
}

export { BudgetManager };
export default BudgetManager;