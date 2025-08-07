/**
 * FinOps Orchestrator - Main FinOps automation engine
 * Coordinates cost optimization, budget management, and financial governance
 * across multi-cloud environments with ML-powered insights
 */

import { EventEmitter } from 'events';
import { CostIntelligenceEngine } from './cost-intelligence';
import { OptimizationEngine } from './optimization-engine';
import { BudgetManager } from './budget-manager';
import { ResourceOptimizer } from './resource-optimizer';
import { FinancialGovernance } from './financial-governance';
import { ForecastingEngine } from './forecasting-engine';
import { CloudCostAdapters } from './cloud-cost-adapters';
import { ReportingEngine } from './reporting-engine';
import { FinOpsConfig } from './finops-config';

export interface FinOpsMetrics {
  totalCosts: number;
  monthlyCosts: number;
  dailyCosts: number;
  costTrend: number;
  optimizationPotential: number;
  budgetUtilization: number;
  anomalyScore: number;
  complianceScore: number;
  forecastedCosts: {
    nextMonth: number;
    nextQuarter: number;
    nextYear: number;
  };
}

export interface FinOpsAlert {
  id: string;
  type: 'budget_exceeded' | 'anomaly_detected' | 'optimization_opportunity' | 'compliance_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  actionItems: string[];
  estimatedSavings?: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface FinOpsRecommendation {
  id: string;
  type: 'rightsizing' | 'reserved_instances' | 'storage_optimization' | 'unused_resources';
  title: string;
  description: string;
  impact: {
    monthlySavings: number;
    annualSavings: number;
    confidence: number;
  };
  implementation: {
    effort: 'low' | 'medium' | 'high';
    riskLevel: 'low' | 'medium' | 'high';
    timeline: string;
    steps: string[];
  };
  resources: Array<{
    id: string;
    type: string;
    name: string;
    currentCost: number;
    optimizedCost: number;
  }>;
  metadata: Record<string, any>;
}

export interface FinOpsConfiguration {
  costIntelligence: {
    enabled: boolean;
    pollingInterval: number;
    aggregationPeriods: string[];
    anomalyDetectionThreshold: number;
  };
  optimization: {
    enabled: boolean;
    autoImplement: boolean;
    minSavingsThreshold: number;
    maxRiskLevel: string;
  };
  budgets: {
    enabled: boolean;
    alertThresholds: number[];
    autoEnforcement: boolean;
  };
  governance: {
    enabled: boolean;
    costAllocationTags: string[];
    compliancePolicies: string[];
  };
  reporting: {
    enabled: boolean;
    schedules: Array<{
      type: string;
      frequency: string;
      recipients: string[];
    }>;
  };
}

class FinOpsOrchestrator extends EventEmitter {
  private config: FinOpsConfig;
  private costIntelligence: CostIntelligenceEngine;
  private optimizationEngine: OptimizationEngine;
  private budgetManager: BudgetManager;
  private resourceOptimizer: ResourceOptimizer;
  private financialGovernance: FinancialGovernance;
  private forecastingEngine: ForecastingEngine;
  private cloudAdapters: CloudCostAdapters;
  private reportingEngine: ReportingEngine;
  
  private isRunning: boolean = false;
  private orchestrationInterval?: NodeJS.Timeout;
  private metrics: Map<string, FinOpsMetrics> = new Map();

  constructor(configuration?: Partial<FinOpsConfiguration>) {
    super();
    
    // Initialize configuration
    this.config = new FinOpsConfig(configuration);
    
    // Initialize core engines
    this.costIntelligence = new CostIntelligenceEngine(this.config);
    this.optimizationEngine = new OptimizationEngine(this.config);
    this.budgetManager = new BudgetManager(this.config);
    this.resourceOptimizer = new ResourceOptimizer(this.config);
    this.financialGovernance = new FinancialGovernance(this.config);
    this.forecastingEngine = new ForecastingEngine(this.config);
    this.cloudAdapters = new CloudCostAdapters(this.config);
    this.reportingEngine = new ReportingEngine(this.config);
    
    this.setupEventHandlers();
  }

  /**
   * Start the FinOps orchestration engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('FinOps Orchestrator is already running');
    }

    try {
      // Initialize all engines
      await this.initializeEngines();
      
      // Start orchestration loop
      this.isRunning = true;
      this.orchestrationInterval = setInterval(
        () => this.orchestrationCycle(),
        this.config.getCostIntelligenceConfig().pollingInterval
      );
      
      this.emit('started');
      console.log('FinOps Orchestrator started successfully');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the FinOps orchestration engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.orchestrationInterval) {
      clearInterval(this.orchestrationInterval);
      this.orchestrationInterval = undefined;
    }
    
    // Shutdown all engines
    await this.shutdownEngines();
    
    this.emit('stopped');
    console.log('FinOps Orchestrator stopped');
  }

  /**
   * Get current FinOps metrics
   */
  async getMetrics(timeRange?: { start: Date; end: Date }): Promise<FinOpsMetrics> {
    return await this.costIntelligence.getAggregatedMetrics(timeRange);
  }

  /**
   * Get cost optimization recommendations
   */
  async getRecommendations(filters?: {
    type?: string[];
    minSavings?: number;
    maxRisk?: string;
  }): Promise<FinOpsRecommendation[]> {
    return await this.optimizationEngine.getRecommendations(filters);
  }

  /**
   * Get budget status and alerts
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
    }>;
    alerts: FinOpsAlert[];
  }> {
    return await this.budgetManager.getBudgetStatus();
  }

  /**
   * Get cost forecasts
   */
  async getForecasts(horizon?: string): Promise<{
    totalCosts: Array<{ date: string; amount: number; confidence: number }>;
    serviceCosts: Record<string, Array<{ date: string; amount: number }>>;
    scenarios: Array<{
      name: string;
      description: string;
      impact: number;
      probability: number;
    }>;
  }> {
    return await this.forecastingEngine.generateForecasts(horizon);
  }

  /**
   * Execute cost optimization recommendation
   */
  async executeRecommendation(
    recommendationId: string,
    approvalData?: {
      approvedBy: string;
      approvalNote?: string;
      scheduleExecution?: Date;
    }
  ): Promise<{
    success: boolean;
    executionId: string;
    estimatedCompletion: Date;
    rollbackPlan: string;
  }> {
    return await this.optimizationEngine.executeRecommendation(
      recommendationId,
      approvalData
    );
  }

  /**
   * Create or update budget
   */
  async manageBudget(budgetData: {
    id?: string;
    name: string;
    amount: number;
    period: 'monthly' | 'quarterly' | 'yearly';
    scope: {
      services?: string[];
      regions?: string[];
      tags?: Record<string, string>;
    };
    alertThresholds: number[];
    autoEnforcement?: boolean;
  }): Promise<string> {
    return await this.budgetManager.createOrUpdateBudget(budgetData);
  }

  /**
   * Generate financial reports
   */
  async generateReport(reportType: string, options?: {
    period?: { start: Date; end: Date };
    format?: 'json' | 'pdf' | 'excel';
    recipients?: string[];
  }): Promise<{
    reportId: string;
    downloadUrl?: string;
    data?: any;
  }> {
    return await this.reportingEngine.generateReport(reportType, options);
  }

  /**
   * Get governance compliance status
   */
  async getComplianceStatus(): Promise<{
    overallScore: number;
    violations: Array<{
      type: string;
      severity: string;
      description: string;
      remediation: string[];
    }>;
    costAllocation: {
      allocated: number;
      unallocated: number;
      allocationRate: number;
    };
  }> {
    return await this.financialGovernance.getComplianceStatus();
  }

  /**
   * Main orchestration cycle
   */
  private async orchestrationCycle(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Collect cost data from all cloud providers
      const costData = await this.cloudAdapters.collectCostData();
      
      // Update cost intelligence
      await this.costIntelligence.processCostData(costData);
      
      // Run anomaly detection
      const anomalies = await this.costIntelligence.detectAnomalies();
      
      // Generate optimization recommendations
      const recommendations = await this.optimizationEngine.generateRecommendations();
      
      // Check budget status
      const budgetAlerts = await this.budgetManager.checkBudgetStatus();
      
      // Update forecasts
      await this.forecastingEngine.updateForecasts();
      
      // Run governance checks
      const complianceStatus = await this.financialGovernance.getComplianceStatus();
      const complianceIssues = complianceStatus.violations;
      
      // Process alerts and notifications
      const allAlerts = [...anomalies, ...budgetAlerts, ...complianceIssues];
      await this.processAlerts(allAlerts);
      
      // Auto-execute approved optimizations
      if (this.config.getOptimizationConfig().autoImplement) {
        await this.executeApprovedOptimizations(recommendations);
      }
      
      // Update metrics
      await this.updateMetrics();
      
      this.emit('cycle_completed', {
        timestamp: new Date(),
        metrics: await this.getMetrics()
      });
      
    } catch (error) {
      console.error('Error in orchestration cycle:', error);
      this.emit('cycle_error', error);
    }
  }

  private async initializeEngines(): Promise<void> {
    await Promise.all([
      this.costIntelligence.initialize(),
      this.optimizationEngine.initialize(),
      this.budgetManager.initialize(),
      this.resourceOptimizer.initialize(),
      this.financialGovernance.initialize(),
      this.forecastingEngine.initialize(),
      this.cloudAdapters.initialize(),
      this.reportingEngine.initialize()
    ]);
  }

  private async shutdownEngines(): Promise<void> {
    await Promise.all([
      this.costIntelligence.shutdown(),
      this.optimizationEngine.shutdown(),
      this.budgetManager.shutdown(),
      this.resourceOptimizer.shutdown(),
      this.financialGovernance.shutdown(),
      this.forecastingEngine.shutdown(),
      this.cloudAdapters.shutdown(),
      this.reportingEngine.shutdown()
    ]);
  }

  private setupEventHandlers(): void {
    // Cost intelligence events
    this.costIntelligence.on('anomaly_detected', (anomaly) => {
      this.emit('anomaly_detected', anomaly);
    });
    
    // Budget events
    this.budgetManager.on('budget_alert', (alert) => {
      this.emit('budget_alert', alert);
    });
    
    // Optimization events
    this.optimizationEngine.on('recommendation_generated', (recommendation) => {
      this.emit('recommendation_generated', recommendation);
    });
    
    this.optimizationEngine.on('optimization_executed', (result) => {
      this.emit('optimization_executed', result);
    });
  }

  private async processAlerts(alerts: FinOpsAlert[]): Promise<void> {
    for (const alert of alerts) {
      // Emit alert event
      this.emit('alert', alert);
      
      // Process based on severity
      if (alert.severity === 'critical') {
        // Send immediate notifications
        await this.sendCriticalAlert(alert);
      }
      
      // Store alert for reporting
      await this.storeAlert(alert);
    }
  }

  private async executeApprovedOptimizations(
    recommendations: FinOpsRecommendation[]
  ): Promise<void> {
    const autoApprovedRecommendations = recommendations.filter(rec => 
      rec.implementation.riskLevel === 'low' &&
      rec.impact.monthlySavings >= this.config.getOptimizationConfig().minSavingsThreshold
    );

    for (const recommendation of autoApprovedRecommendations) {
      try {
        await this.executeRecommendation(recommendation.id, {
          approvedBy: 'system_auto_approval'
        });
      } catch (error) {
        console.error(`Failed to auto-execute recommendation ${recommendation.id}:`, error);
      }
    }
  }

  private async updateMetrics(): Promise<void> {
    const currentMetrics = await this.costIntelligence.getAggregatedMetrics();
    this.metrics.set('current', currentMetrics);
  }

  private async sendCriticalAlert(alert: FinOpsAlert): Promise<void> {
    // Implementation for sending critical alerts
    // This would integrate with notification systems
  }

  private async storeAlert(alert: FinOpsAlert): Promise<void> {
    // Implementation for storing alerts in database
    // This would integrate with the database layer
  }
}

export { FinOpsOrchestrator };
export default FinOpsOrchestrator;