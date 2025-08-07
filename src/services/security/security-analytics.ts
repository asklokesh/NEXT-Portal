/**
 * Security Analytics and Risk Assessment System
 * 
 * Advanced security analytics platform that provides comprehensive risk assessment,
 * security metrics collection, threat landscape analysis, and predictive security
 * intelligence. Includes ML-based risk modeling and real-time security dashboards.
 * 
 * Features:
 * - Comprehensive risk assessment and scoring
 * - Security metrics collection and analysis
 * - Threat landscape monitoring and trends
 * - Predictive security analytics
 * - Security posture management
 * - Compliance risk assessment
 * - Business impact analysis
 * - Executive security reporting
 * - Real-time security dashboards
 * - Security KPI tracking and alerting
 */

import { Logger } from '@backstage/backend-common';
import { SecurityConfigManager } from './security-config';
import { VulnerabilityResult } from './vulnerability-scanner';
import { ThreatEvent, SecurityIncident } from './threat-detection';
import { PolicyViolation } from './policy-engine';
import { ComplianceAssessment } from './compliance-checker';
import * as crypto from 'crypto';

export interface RiskAssessment {
  id: string;
  timestamp: Date;
  overallRiskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];
  vulnerabilityRisk: VulnerabilityRiskAssessment;
  threatRisk: ThreatRiskAssessment;
  complianceRisk: ComplianceRiskAssessment;
  operationalRisk: OperationalRiskAssessment;
  businessImpact: BusinessImpactAssessment;
  recommendations: RiskRecommendation[];
  trend: RiskTrend;
  metadata: Record<string, any>;
}

export interface RiskFactor {
  id: string;
  name: string;
  category: RiskCategory;
  severity: RiskSeverity;
  likelihood: number; // 0-1
  impact: number; // 0-1
  score: number; // calculated risk score
  description: string;
  evidence: RiskEvidence[];
  mitigation: RiskMitigation[];
  lastUpdated: Date;
}

export interface VulnerabilityRiskAssessment {
  totalVulnerabilities: number;
  criticalVulnerabilities: number;
  highVulnerabilities: number;
  exposureScore: number;
  patchingEfficiency: number;
  meanTimeToRemediation: number;
  vulnerabilityTrend: TrendDirection;
  topRisks: string[];
}

export interface ThreatRiskAssessment {
  activeThreatCampaigns: number;
  threatExposure: number;
  attackSurfaceSize: number;
  detectionCoverage: number;
  responseEffectiveness: number;
  threatIntelligenceScore: number;
  emergingThreats: EmergingThreat[];
  threatLandscape: ThreatLandscapeAnalysis;
}

export interface ComplianceRiskAssessment {
  overallComplianceScore: number;
  criticalGaps: number;
  regulatoryExposure: number;
  auditReadiness: number;
  policyCompliance: number;
  frameworkScores: Record<string, number>;
  riskAreas: string[];
}

export interface OperationalRiskAssessment {
  securityTeamCapacity: number;
  toolEffectiveness: number;
  processMaturity: number;
  incidentResponseTime: number;
  securityTraining: number;
  vendorRisk: number;
  operationalGaps: string[];
}

export interface BusinessImpactAssessment {
  potentialLoss: number;
  reputationRisk: number;
  operationalDisruption: number;
  customerImpact: number;
  regulatoryRisk: number;
  competitiveRisk: number;
  impactScenarios: ImpactScenario[];
}

export interface ImpactScenario {
  name: string;
  description: string;
  probability: number;
  financialImpact: number;
  operationalImpact: number;
  reputationalImpact: number;
  timeframe: string;
  mitigation: string[];
}

export interface RiskRecommendation {
  id: string;
  priority: RecommendationPriority;
  category: string;
  title: string;
  description: string;
  rationale: string;
  expectedRiskReduction: number;
  implementationEffort: ImplementationEffort;
  cost: CostCategory;
  timeline: number; // days
  dependencies: string[];
  metrics: string[];
}

export interface RiskTrend {
  direction: TrendDirection;
  rate: number;
  confidence: number;
  timeframe: string;
  factors: string[];
  prediction: RiskPrediction;
}

export interface RiskPrediction {
  futureRiskScore: number;
  timeframe: number; // days
  confidence: number;
  scenarios: PredictionScenario[];
  assumptions: string[];
}

export interface PredictionScenario {
  name: string;
  probability: number;
  riskScore: number;
  description: string;
  triggers: string[];
}

export interface SecurityMetric {
  id: string;
  name: string;
  category: MetricCategory;
  value: number;
  unit: string;
  timestamp: Date;
  trend: MetricTrend;
  threshold: MetricThreshold;
  status: MetricStatus;
  tags: string[];
  metadata: Record<string, any>;
}

export interface MetricTrend {
  direction: TrendDirection;
  rate: number;
  period: string;
  dataPoints: MetricDataPoint[];
}

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface MetricThreshold {
  warning: number;
  critical: number;
  direction: ThresholdDirection;
}

export interface SecurityDashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  filters: DashboardFilter[];
  refreshInterval: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  permissions: DashboardPermission[];
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  description: string;
  position: WidgetPosition;
  size: WidgetSize;
  config: WidgetConfig;
  dataSource: DataSource;
  visualization: Visualization;
  alerts: WidgetAlert[];
}

export interface WidgetPosition {
  x: number;
  y: number;
}

export interface WidgetSize {
  width: number;
  height: number;
}

export interface WidgetConfig {
  refreshInterval: number;
  timeRange: TimeRange;
  filters: Record<string, any>;
  aggregation: AggregationConfig;
  display: DisplayConfig;
}

export interface DataSource {
  type: DataSourceType;
  query: string;
  parameters: Record<string, any>;
  caching: boolean;
  cacheDuration: number;
}

export interface Visualization {
  type: VisualizationType;
  config: VisualizationConfig;
  colors: ColorScheme;
  formatting: FormattingOptions;
}

export interface VisualizationConfig {
  axes?: AxesConfig;
  legend?: LegendConfig;
  tooltip?: TooltipConfig;
  interaction?: InteractionConfig;
}

export interface SecurityReport {
  id: string;
  title: string;
  type: ReportType;
  period: ReportPeriod;
  generatedAt: Date;
  generatedBy: string;
  summary: ReportSummary;
  sections: ReportSection[];
  metrics: SecurityMetric[];
  charts: ReportChart[];
  recommendations: RiskRecommendation[];
  appendices: ReportAppendix[];
  distribution: ReportDistribution;
}

export interface ReportSummary {
  executiveSummary: string;
  keyFindings: string[];
  majorRisks: string[];
  achievements: string[];
  priorities: string[];
  outlook: string;
}

export interface ReportSection {
  title: string;
  content: string;
  subsections: ReportSubsection[];
  charts: ReportChart[];
  tables: ReportTable[];
  callouts: ReportCallout[];
}

export interface ReportChart {
  id: string;
  title: string;
  type: ChartType;
  data: ChartData;
  config: ChartConfig;
  insights: string[];
}

export interface ThreatLandscapeAnalysis {
  activeCampaigns: ThreatCampaign[];
  emergingThreats: EmergingThreat[];
  attackVectors: AttackVector[];
  targetedAssets: string[];
  threatActors: ThreatActor[];
  geographicDistribution: GeographicThreat[];
}

export interface ThreatCampaign {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  severity: ThreatSeverity;
  confidence: number;
  actors: string[];
  tactics: string[];
  techniques: string[];
  indicators: ThreatIndicator[];
  targets: string[];
  status: CampaignStatus;
}

export interface EmergingThreat {
  id: string;
  name: string;
  description: string;
  category: ThreatCategory;
  severity: ThreatSeverity;
  emergence: Date;
  confidence: number;
  impact: ThreatImpact;
  likelihood: number;
  sources: string[];
  countermeasures: string[];
}

export interface AttackVector {
  name: string;
  frequency: number;
  successRate: number;
  impact: number;
  trend: TrendDirection;
  countermeasures: string[];
}

export interface ThreatActor {
  id: string;
  name: string;
  type: ActorType;
  sophistication: SophisticationLevel;
  motivation: string[];
  capabilities: string[];
  targets: string[];
  techniques: string[];
  attribution: AttributionLevel;
}

export interface GeographicThreat {
  country: string;
  region: string;
  threatLevel: number;
  primaryThreats: string[];
  trend: TrendDirection;
}

export interface ThreatIndicator {
  type: IndicatorType;
  value: string;
  confidence: number;
  context: string;
  source: string;
  firstSeen: Date;
  lastSeen: Date;
}

// Enums and types
export type RiskLevel = 'very-low' | 'low' | 'medium' | 'high' | 'very-high' | 'critical';
export type RiskCategory = 'vulnerability' | 'threat' | 'compliance' | 'operational' | 'business';
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type TrendDirection = 'improving' | 'stable' | 'declining' | 'unknown';
export type RecommendationPriority = 'low' | 'medium' | 'high' | 'critical';
export type ImplementationEffort = 'low' | 'medium' | 'high' | 'very-high';
export type CostCategory = 'low' | 'medium' | 'high' | 'very-high';
export type MetricCategory = 'vulnerability' | 'threat' | 'compliance' | 'operations' | 'business';
export type MetricStatus = 'normal' | 'warning' | 'critical' | 'unknown';
export type ThresholdDirection = 'above' | 'below';
export type WidgetType = 'metric' | 'chart' | 'table' | 'text' | 'alert' | 'trend';
export type DataSourceType = 'vulnerability' | 'threat' | 'compliance' | 'policy' | 'custom';
export type VisualizationType = 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'gauge' | 'number';
export type ReportType = 'executive' | 'technical' | 'compliance' | 'risk' | 'incident';
export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ThreatCategory = 'malware' | 'phishing' | 'apt' | 'insider' | 'supply-chain' | 'zero-day';
export type ThreatImpact = 'low' | 'medium' | 'high' | 'critical';
export type CampaignStatus = 'active' | 'monitored' | 'contained' | 'neutralized';
export type ActorType = 'nation-state' | 'cybercriminal' | 'hacktivist' | 'insider' | 'script-kiddie';
export type SophisticationLevel = 'low' | 'medium' | 'high' | 'advanced';
export type AttributionLevel = 'low' | 'medium' | 'high' | 'confirmed';
export type IndicatorType = 'ip' | 'domain' | 'hash' | 'url' | 'email' | 'file' | 'registry';

// Additional interfaces for dashboard components
export interface RiskEvidence {
  type: 'vulnerability' | 'incident' | 'violation' | 'metric';
  id: string;
  description: string;
  severity: number;
  timestamp: Date;
}

export interface RiskMitigation {
  id: string;
  description: string;
  effectiveness: number;
  cost: CostCategory;
  timeframe: number;
  dependencies: string[];
}

export interface DashboardLayout {
  type: 'grid' | 'flow' | 'custom';
  columns: number;
  rowHeight: number;
  margin: number;
}

export interface DashboardFilter {
  name: string;
  type: 'select' | 'multiselect' | 'date' | 'text';
  values: any[];
  defaultValue: any;
}

export interface DashboardPermission {
  user: string;
  role: string;
  permissions: string[];
}

export interface WidgetAlert {
  condition: string;
  threshold: number;
  message: string;
  severity: AlertSeverity;
  recipients: string[];
}

export interface TimeRange {
  start: Date;
  end: Date;
  relative?: string;
}

export interface AggregationConfig {
  function: 'sum' | 'avg' | 'min' | 'max' | 'count';
  groupBy: string[];
  timeGrain: string;
}

export interface DisplayConfig {
  title: boolean;
  legend: boolean;
  grid: boolean;
  labels: boolean;
  colors: string[];
}

export interface AxesConfig {
  x: AxisConfig;
  y: AxisConfig;
}

export interface AxisConfig {
  label: string;
  scale: 'linear' | 'logarithmic';
  min?: number;
  max?: number;
}

export interface LegendConfig {
  position: 'top' | 'bottom' | 'left' | 'right';
  visible: boolean;
}

export interface TooltipConfig {
  enabled: boolean;
  format: string;
}

export interface InteractionConfig {
  zoom: boolean;
  pan: boolean;
  select: boolean;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  warning: string;
  error: string;
  success: string;
}

export interface FormattingOptions {
  numberFormat: string;
  dateFormat: string;
  currency: string;
}

export interface ReportPeriod {
  start: Date;
  end: Date;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
}

export interface ReportSubsection {
  title: string;
  content: string;
  level: number;
}

export interface ReportTable {
  title: string;
  headers: string[];
  rows: any[][];
  sortable: boolean;
}

export interface ReportCallout {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  content: string;
}

export interface ReportAppendix {
  title: string;
  content: string;
  attachments: string[];
}

export interface ReportDistribution {
  recipients: string[];
  channels: string[];
  format: 'pdf' | 'html' | 'json';
  schedule?: string;
}

export interface ChartData {
  datasets: ChartDataset[];
  labels: string[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string;
  borderColor?: string;
}

export interface ChartConfig {
  responsive: boolean;
  maintainAspectRatio: boolean;
  plugins: Record<string, any>;
  scales: Record<string, any>;
}

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type ChartType = 'line' | 'bar' | 'pie' | 'doughnut' | 'scatter' | 'bubble';

/**
 * Risk Assessment Engine
 * Core engine for calculating and analyzing security risks
 */
export class RiskAssessmentEngine {
  private logger: Logger;
  private riskFactors: Map<string, RiskFactor> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Perform comprehensive risk assessment
   */
  async performRiskAssessment(
    vulnerabilities: VulnerabilityResult[],
    threats: ThreatEvent[],
    incidents: SecurityIncident[],
    violations: PolicyViolation[],
    compliance: ComplianceAssessment[]
  ): Promise<RiskAssessment> {
    this.logger.info('Performing comprehensive risk assessment');

    const timestamp = new Date();
    
    // Calculate individual risk assessments
    const vulnerabilityRisk = await this.assessVulnerabilityRisk(vulnerabilities);
    const threatRisk = await this.assessThreatRisk(threats, incidents);
    const complianceRisk = await this.assessComplianceRisk(compliance);
    const operationalRisk = await this.assessOperationalRisk();

    // Calculate overall risk factors
    const riskFactors = await this.calculateRiskFactors(
      vulnerabilities, threats, incidents, violations, compliance
    );

    // Calculate overall risk score
    const overallRiskScore = this.calculateOverallRiskScore(riskFactors);
    const riskLevel = this.mapScoreToRiskLevel(overallRiskScore);

    // Assess business impact
    const businessImpact = await this.assessBusinessImpact(overallRiskScore, riskFactors);

    // Generate recommendations
    const recommendations = await this.generateRiskRecommendations(riskFactors);

    // Analyze risk trends
    const trend = await this.analyzeRiskTrends(overallRiskScore);

    const assessment: RiskAssessment = {
      id: crypto.randomUUID(),
      timestamp,
      overallRiskScore,
      riskLevel,
      riskFactors,
      vulnerabilityRisk,
      threatRisk,
      complianceRisk,
      operationalRisk,
      businessImpact,
      recommendations,
      trend,
      metadata: {}
    };

    this.logger.info(`Risk assessment completed. Overall risk: ${riskLevel} (${overallRiskScore})`);
    return assessment;
  }

  /**
   * Assess vulnerability-related risks
   */
  private async assessVulnerabilityRisk(vulnerabilities: VulnerabilityResult[]): Promise<VulnerabilityRiskAssessment> {
    const total = vulnerabilities.length;
    const critical = vulnerabilities.filter(v => v.severity === 'critical').length;
    const high = vulnerabilities.filter(v => v.severity === 'high').length;

    // Calculate exposure score based on vulnerability severity distribution
    const exposureScore = this.calculateExposureScore(vulnerabilities);

    // Simulate patching efficiency and MTTR metrics
    const patchingEfficiency = Math.max(0, 100 - (critical * 10 + high * 5));
    const meanTimeToRemediation = critical * 7 + high * 14; // days

    // Determine trend (simplified)
    const vulnerabilityTrend: TrendDirection = 
      critical > 5 ? 'declining' : 
      critical === 0 && high < 5 ? 'improving' : 'stable';

    const topRisks = vulnerabilities
      .filter(v => ['critical', 'high'].includes(v.severity))
      .slice(0, 5)
      .map(v => v.title);

    return {
      totalVulnerabilities: total,
      criticalVulnerabilities: critical,
      highVulnerabilities: high,
      exposureScore,
      patchingEfficiency,
      meanTimeToRemediation,
      vulnerabilityTrend,
      topRisks
    };
  }

  /**
   * Assess threat-related risks
   */
  private async assessThreatRisk(
    threats: ThreatEvent[], 
    incidents: SecurityIncident[]
  ): Promise<ThreatRiskAssessment> {
    const activeCampaigns = threats.filter(t => t.category === 'advanced-persistent-threat').length;
    const threatExposure = this.calculateThreatExposure(threats);
    const attackSurfaceSize = this.calculateAttackSurfaceSize();
    const detectionCoverage = this.calculateDetectionCoverage(threats);
    const responseEffectiveness = this.calculateResponseEffectiveness(incidents);
    const threatIntelligenceScore = this.calculateThreatIntelligenceScore();

    const emergingThreats = await this.identifyEmergingThreats(threats);
    const threatLandscape = await this.analyzeThreatLandscape(threats);

    return {
      activeThreatCampaigns: activeCampaigns,
      threatExposure,
      attackSurfaceSize,
      detectionCoverage,
      responseEffectiveness,
      threatIntelligenceScore,
      emergingThreats,
      threatLandscape
    };
  }

  /**
   * Assess compliance-related risks
   */
  private async assessComplianceRisk(assessments: ComplianceAssessment[]): Promise<ComplianceRiskAssessment> {
    const latestAssessments = this.getLatestAssessments(assessments);
    
    const overallScore = latestAssessments.length > 0 
      ? latestAssessments.reduce((sum, a) => sum + a.overallScore, 0) / latestAssessments.length
      : 0;

    const criticalGaps = latestAssessments.reduce(
      (sum, a) => sum + a.gaps.filter(g => g.severity === 'critical').length, 0
    );

    const regulatoryExposure = this.calculateRegulatoryExposure(latestAssessments);
    const auditReadiness = Math.max(0, overallScore - 20); // Simplified calculation
    const policyCompliance = this.calculatePolicyCompliance();

    const frameworkScores = latestAssessments.reduce((acc, assessment) => {
      acc[assessment.frameworkName] = assessment.overallScore;
      return acc;
    }, {} as Record<string, number>);

    const riskAreas = latestAssessments.flatMap(a => 
      a.gaps.filter(g => g.severity === 'high' || g.severity === 'critical')
        .map(g => g.gapType)
    ).slice(0, 5);

    return {
      overallComplianceScore: overallScore,
      criticalGaps,
      regulatoryExposure,
      auditReadiness,
      policyCompliance,
      frameworkScores,
      riskAreas: [...new Set(riskAreas)]
    };
  }

  /**
   * Assess operational security risks
   */
  private async assessOperationalRisk(): Promise<OperationalRiskAssessment> {
    // Simulate operational risk metrics
    return {
      securityTeamCapacity: 75, // Percentage capacity utilization
      toolEffectiveness: 82,    // Average tool effectiveness
      processMaturity: 68,      // Process maturity score
      incidentResponseTime: 45,  // Average response time in minutes
      securityTraining: 78,     // Training completion percentage
      vendorRisk: 35,           // Vendor risk score
      operationalGaps: [
        'Limited 24/7 monitoring',
        'Manual incident triage',
        'Incomplete asset inventory'
      ]
    };
  }

  /**
   * Calculate risk factors from various security data sources
   */
  private async calculateRiskFactors(
    vulnerabilities: VulnerabilityResult[],
    threats: ThreatEvent[],
    incidents: SecurityIncident[],
    violations: PolicyViolation[],
    compliance: ComplianceAssessment[]
  ): Promise<RiskFactor[]> {
    const factors: RiskFactor[] = [];

    // Critical vulnerability factor
    const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
    if (criticalVulns.length > 0) {
      factors.push({
        id: crypto.randomUUID(),
        name: 'Critical Vulnerabilities',
        category: 'vulnerability',
        severity: 'critical',
        likelihood: Math.min(1, criticalVulns.length / 10),
        impact: 0.9,
        score: this.calculateRiskScore(Math.min(1, criticalVulns.length / 10), 0.9),
        description: `${criticalVulns.length} critical vulnerabilities detected`,
        evidence: criticalVulns.slice(0, 3).map(v => ({
          type: 'vulnerability',
          id: v.id,
          description: v.title,
          severity: this.mapSeverityToNumber(v.severity),
          timestamp: v.discoveredAt
        })),
        mitigation: [{
          id: crypto.randomUUID(),
          description: 'Immediate patching of critical vulnerabilities',
          effectiveness: 0.9,
          cost: 'medium',
          timeframe: 7,
          dependencies: []
        }],
        lastUpdated: new Date()
      });
    }

    // Active threat campaigns factor
    const activeThreatCampaigns = threats.filter(t => 
      ['critical', 'high'].includes(t.severity) && 
      t.category === 'advanced-persistent-threat'
    );
    
    if (activeThreatCampaigns.length > 0) {
      factors.push({
        id: crypto.randomUUID(),
        name: 'Active Threat Campaigns',
        category: 'threat',
        severity: 'high',
        likelihood: 0.7,
        impact: 0.8,
        score: this.calculateRiskScore(0.7, 0.8),
        description: `${activeThreatCampaigns.length} active threat campaigns detected`,
        evidence: activeThreatCampaigns.slice(0, 3).map(t => ({
          type: 'incident',
          id: t.id,
          description: t.title,
          severity: this.mapSeverityToNumber(t.severity),
          timestamp: t.timestamp
        })),
        mitigation: [{
          id: crypto.randomUUID(),
          description: 'Enhanced monitoring and threat hunting',
          effectiveness: 0.7,
          cost: 'high',
          timeframe: 14,
          dependencies: []
        }],
        lastUpdated: new Date()
      });
    }

    // Compliance gaps factor
    const criticalComplianceGaps = compliance.flatMap(c => 
      c.gaps.filter(g => g.severity === 'critical')
    );
    
    if (criticalComplianceGaps.length > 0) {
      factors.push({
        id: crypto.randomUUID(),
        name: 'Critical Compliance Gaps',
        category: 'compliance',
        severity: 'high',
        likelihood: 0.8,
        impact: 0.6,
        score: this.calculateRiskScore(0.8, 0.6),
        description: `${criticalComplianceGaps.length} critical compliance gaps`,
        evidence: criticalComplianceGaps.slice(0, 3).map(g => ({
          type: 'violation',
          id: g.id,
          description: g.title,
          severity: this.mapGapSeverityToNumber(g.severity),
          timestamp: g.identifiedAt
        })),
        mitigation: [{
          id: crypto.randomUUID(),
          description: 'Address critical compliance gaps',
          effectiveness: 0.8,
          cost: 'medium',
          timeframe: 30,
          dependencies: []
        }],
        lastUpdated: new Date()
      });
    }

    return factors;
  }

  /**
   * Calculate overall risk score from risk factors
   */
  private calculateOverallRiskScore(riskFactors: RiskFactor[]): number {
    if (!riskFactors.length) return 0;

    // Weighted average of risk factor scores
    const weightedSum = riskFactors.reduce((sum, factor) => {
      const weight = this.getRiskFactorWeight(factor.category);
      return sum + (factor.score * weight);
    }, 0);

    const totalWeight = riskFactors.reduce((sum, factor) => 
      sum + this.getRiskFactorWeight(factor.category), 0
    );

    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
  }

  /**
   * Get weight for different risk factor categories
   */
  private getRiskFactorWeight(category: RiskCategory): number {
    switch (category) {
      case 'vulnerability': return 0.3;
      case 'threat': return 0.3;
      case 'compliance': return 0.2;
      case 'operational': return 0.15;
      case 'business': return 0.05;
      default: return 0.1;
    }
  }

  /**
   * Map numeric score to risk level
   */
  private mapScoreToRiskLevel(score: number): RiskLevel {
    if (score >= 90) return 'critical';
    if (score >= 70) return 'very-high';
    if (score >= 50) return 'high';
    if (score >= 30) return 'medium';
    if (score >= 10) return 'low';
    return 'very-low';
  }

  /**
   * Calculate risk score from likelihood and impact
   */
  private calculateRiskScore(likelihood: number, impact: number): number {
    return likelihood * impact * 100;
  }

  /**
   * Assess business impact based on risk score and factors
   */
  private async assessBusinessImpact(
    riskScore: number, 
    riskFactors: RiskFactor[]
  ): Promise<BusinessImpactAssessment> {
    const potentialLoss = this.calculatePotentialLoss(riskScore, riskFactors);
    const reputationRisk = this.calculateReputationRisk(riskFactors);
    const operationalDisruption = this.calculateOperationalDisruption(riskFactors);
    const customerImpact = this.calculateCustomerImpact(riskFactors);
    const regulatoryRisk = this.calculateRegulatoryRisk(riskFactors);
    const competitiveRisk = this.calculateCompetitiveRisk(riskFactors);

    const impactScenarios = await this.generateImpactScenarios(riskScore, riskFactors);

    return {
      potentialLoss,
      reputationRisk,
      operationalDisruption,
      customerImpact,
      regulatoryRisk,
      competitiveRisk,
      impactScenarios
    };
  }

  /**
   * Generate risk recommendations based on assessment
   */
  private async generateRiskRecommendations(riskFactors: RiskFactor[]): Promise<RiskRecommendation[]> {
    const recommendations: RiskRecommendation[] = [];

    // Sort factors by score (highest risk first)
    const sortedFactors = riskFactors.sort((a, b) => b.score - a.score);

    for (const factor of sortedFactors.slice(0, 5)) { // Top 5 risk factors
      const recommendation = await this.generateFactorRecommendation(factor);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    return recommendations;
  }

  /**
   * Generate recommendation for a specific risk factor
   */
  private async generateFactorRecommendation(factor: RiskFactor): Promise<RiskRecommendation | null> {
    const mitigation = factor.mitigation[0]; // Use first mitigation
    if (!mitigation) return null;

    return {
      id: crypto.randomUUID(),
      priority: this.mapSeverityToPriority(factor.severity),
      category: factor.category,
      title: `Address ${factor.name}`,
      description: mitigation.description,
      rationale: `Reduce risk from ${factor.description}`,
      expectedRiskReduction: mitigation.effectiveness * factor.score,
      implementationEffort: this.mapCostToEffort(mitigation.cost),
      cost: mitigation.cost,
      timeline: mitigation.timeframe,
      dependencies: mitigation.dependencies,
      metrics: [`${factor.name} count`, `${factor.name} severity`]
    };
  }

  /**
   * Analyze risk trends over time
   */
  private async analyzeRiskTrends(currentScore: number): Promise<RiskTrend> {
    // Simulate historical risk scores for trend analysis
    const historicalScores = [45, 52, 48, 55, currentScore];
    
    const direction = this.determineTrendDirection(historicalScores);
    const rate = this.calculateTrendRate(historicalScores);
    const confidence = 0.75; // Simulated confidence level

    const prediction = await this.generateRiskPrediction(historicalScores, direction, rate);

    return {
      direction,
      rate,
      confidence,
      timeframe: '30 days',
      factors: ['Vulnerability management', 'Threat landscape', 'Compliance status'],
      prediction
    };
  }

  /**
   * Generate risk prediction based on trends
   */
  private async generateRiskPrediction(
    historicalScores: number[],
    direction: TrendDirection,
    rate: number
  ): Promise<RiskPrediction> {
    const currentScore = historicalScores[historicalScores.length - 1];
    let futureScore = currentScore;

    // Simple linear projection
    if (direction === 'improving') {
      futureScore = Math.max(0, currentScore - (rate * 30)); // 30 days
    } else if (direction === 'declining') {
      futureScore = Math.min(100, currentScore + (rate * 30));
    }

    const scenarios: PredictionScenario[] = [
      {
        name: 'Best Case',
        probability: 0.2,
        riskScore: Math.max(0, futureScore - 10),
        description: 'All remediation efforts successful',
        triggers: ['Successful patching', 'Improved monitoring', 'Training completion']
      },
      {
        name: 'Most Likely',
        probability: 0.6,
        riskScore: futureScore,
        description: 'Current trends continue',
        triggers: ['Status quo maintained', 'Normal operations']
      },
      {
        name: 'Worst Case',
        probability: 0.2,
        riskScore: Math.min(100, futureScore + 15),
        description: 'New threats emerge, remediation delays',
        triggers: ['Zero-day exploits', 'Resource constraints', 'Major incidents']
      }
    ];

    return {
      futureRiskScore: Math.round(futureScore),
      timeframe: 30,
      confidence: 0.7,
      scenarios,
      assumptions: [
        'Current threat landscape remains stable',
        'No major security incidents occur',
        'Planned remediation activities proceed on schedule'
      ]
    };
  }

  // Helper methods for calculations
  private calculateExposureScore(vulnerabilities: VulnerabilityResult[]): number {
    const weights = { critical: 10, high: 7, medium: 4, low: 2, info: 1 };
    const totalScore = vulnerabilities.reduce((sum, v) => {
      return sum + (weights[v.severity as keyof typeof weights] || 0);
    }, 0);
    return Math.min(100, totalScore);
  }

  private calculateThreatExposure(threats: ThreatEvent[]): number {
    return Math.min(100, threats.length * 5);
  }

  private calculateAttackSurfaceSize(): number {
    // Simulate attack surface calculation
    return 75; // Percentage
  }

  private calculateDetectionCoverage(threats: ThreatEvent[]): number {
    // Simulate detection coverage based on threat events
    const detectedThreats = threats.filter(t => t.confidence > 0.7).length;
    const totalThreats = threats.length || 1;
    return (detectedThreats / totalThreats) * 100;
  }

  private calculateResponseEffectiveness(incidents: SecurityIncident[]): number {
    const resolvedIncidents = incidents.filter(i => i.status === 'resolved').length;
    const totalIncidents = incidents.length || 1;
    return (resolvedIncidents / totalIncidents) * 100;
  }

  private calculateThreatIntelligenceScore(): number {
    // Simulate threat intelligence effectiveness
    return 68;
  }

  private async identifyEmergingThreats(threats: ThreatEvent[]): Promise<EmergingThreat[]> {
    // Identify new or unusual threat patterns
    return [
      {
        id: crypto.randomUUID(),
        name: 'AI-Powered Phishing',
        description: 'Sophisticated phishing attacks using AI-generated content',
        category: 'phishing',
        severity: 'high',
        emergence: new Date(),
        confidence: 0.8,
        impact: 'high',
        likelihood: 0.6,
        sources: ['threat-intel-feed', 'security-research'],
        countermeasures: ['Enhanced email filtering', 'User training', 'AI detection tools']
      }
    ];
  }

  private async analyzeThreatLandscape(threats: ThreatEvent[]): Promise<ThreatLandscapeAnalysis> {
    return {
      activeCampaigns: [],
      emergingThreats: await this.identifyEmergingThreats(threats),
      attackVectors: [
        {
          name: 'Phishing',
          frequency: 45,
          successRate: 15,
          impact: 70,
          trend: 'declining',
          countermeasures: ['Email security', 'User training']
        },
        {
          name: 'Malware',
          frequency: 30,
          successRate: 25,
          impact: 85,
          trend: 'stable',
          countermeasures: ['Endpoint protection', 'Network monitoring']
        }
      ],
      targetedAssets: ['Email systems', 'User credentials', 'Database servers'],
      threatActors: [],
      geographicDistribution: []
    };
  }

  private getLatestAssessments(assessments: ComplianceAssessment[]): ComplianceAssessment[] {
    // Group by framework and get latest assessment for each
    const latestByFramework = new Map<string, ComplianceAssessment>();
    
    for (const assessment of assessments) {
      const existing = latestByFramework.get(assessment.frameworkName);
      if (!existing || assessment.assessmentDate > existing.assessmentDate) {
        latestByFramework.set(assessment.frameworkName, assessment);
      }
    }
    
    return Array.from(latestByFramework.values());
  }

  private calculateRegulatoryExposure(assessments: ComplianceAssessment[]): number {
    const avgScore = assessments.length > 0 
      ? assessments.reduce((sum, a) => sum + a.overallScore, 0) / assessments.length
      : 100;
    return Math.max(0, 100 - avgScore);
  }

  private calculatePolicyCompliance(): number {
    // Simulate policy compliance score
    return 82;
  }

  private mapSeverityToNumber(severity: string): number {
    const mapping = { critical: 10, high: 7, medium: 5, low: 3, info: 1 };
    return mapping[severity as keyof typeof mapping] || 1;
  }

  private mapGapSeverityToNumber(severity: string): number {
    return this.mapSeverityToNumber(severity);
  }

  private mapSeverityToPriority(severity: RiskSeverity): RecommendationPriority {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
    }
  }

  private mapCostToEffort(cost: CostCategory): ImplementationEffort {
    switch (cost) {
      case 'very-high': return 'very-high';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
    }
  }

  private calculatePotentialLoss(riskScore: number, factors: RiskFactor[]): number {
    // Simplified calculation based on risk score
    return riskScore * 10000; // $10k per risk point
  }

  private calculateReputationRisk(factors: RiskFactor[]): number {
    const publicFacingRisks = factors.filter(f => 
      f.category === 'vulnerability' || f.category === 'threat'
    );
    return Math.min(100, publicFacingRisks.length * 15);
  }

  private calculateOperationalDisruption(factors: RiskFactor[]): number {
    const operationalFactors = factors.filter(f => f.category === 'operational');
    return Math.min(100, operationalFactors.reduce((sum, f) => sum + f.score, 0));
  }

  private calculateCustomerImpact(factors: RiskFactor[]): number {
    // Simplified customer impact calculation
    return Math.min(100, factors.reduce((sum, f) => sum + f.score, 0) / 10);
  }

  private calculateRegulatoryRisk(factors: RiskFactor[]): number {
    const complianceFactors = factors.filter(f => f.category === 'compliance');
    return complianceFactors.reduce((sum, f) => sum + f.score, 0);
  }

  private calculateCompetitiveRisk(factors: RiskFactor[]): number {
    // Simplified competitive risk calculation
    return Math.min(100, factors.reduce((sum, f) => sum + f.score, 0) / 20);
  }

  private async generateImpactScenarios(
    riskScore: number, 
    factors: RiskFactor[]
  ): Promise<ImpactScenario[]> {
    return [
      {
        name: 'Data Breach',
        description: 'Major security incident resulting in data exposure',
        probability: riskScore / 100 * 0.3,
        financialImpact: 2000000,
        operationalImpact: 85,
        reputationalImpact: 90,
        timeframe: '1-3 months',
        mitigation: ['Encryption', 'Access controls', 'Monitoring']
      },
      {
        name: 'System Compromise',
        description: 'Critical systems compromised by attackers',
        probability: riskScore / 100 * 0.2,
        financialImpact: 1500000,
        operationalImpact: 95,
        reputationalImpact: 75,
        timeframe: '1-2 weeks',
        mitigation: ['Endpoint protection', 'Network segmentation', 'Backup systems']
      }
    ];
  }

  private determineTrendDirection(scores: number[]): TrendDirection {
    if (scores.length < 2) return 'unknown';
    
    const recent = scores.slice(-3);
    const earlier = scores.slice(0, -3);
    
    if (earlier.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, s) => sum + s, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, s) => sum + s, 0) / earlier.length;
    
    const diff = recentAvg - earlierAvg;
    
    if (diff > 5) return 'declining'; // Higher score = worse
    if (diff < -5) return 'improving';
    return 'stable';
  }

  private calculateTrendRate(scores: number[]): number {
    if (scores.length < 2) return 0;
    
    const changes = scores.slice(1).map((score, index) => score - scores[index]);
    return changes.reduce((sum, change) => sum + Math.abs(change), 0) / changes.length;
  }
}

/**
 * Security Metrics Collector
 * Collects and analyzes security metrics from various sources
 */
export class SecurityMetricsCollector {
  private logger: Logger;
  private metrics: Map<string, SecurityMetric[]> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Collect comprehensive security metrics
   */
  async collectMetrics(
    vulnerabilities: VulnerabilityResult[],
    threats: ThreatEvent[],
    incidents: SecurityIncident[],
    violations: PolicyViolation[]
  ): Promise<SecurityMetric[]> {
    this.logger.info('Collecting security metrics');

    const metrics: SecurityMetric[] = [];
    const timestamp = new Date();

    // Vulnerability metrics
    metrics.push(...await this.collectVulnerabilityMetrics(vulnerabilities, timestamp));

    // Threat metrics
    metrics.push(...await this.collectThreatMetrics(threats, timestamp));

    // Incident metrics
    metrics.push(...await this.collectIncidentMetrics(incidents, timestamp));

    // Policy violation metrics
    metrics.push(...await this.collectPolicyMetrics(violations, timestamp));

    // Operational metrics
    metrics.push(...await this.collectOperationalMetrics(timestamp));

    // Store metrics for trend analysis
    this.storeMetrics(metrics);

    this.logger.info(`Collected ${metrics.length} security metrics`);
    return metrics;
  }

  /**
   * Get metrics by category
   */
  getMetricsByCategory(category: MetricCategory): SecurityMetric[] {
    return Array.from(this.metrics.values())
      .flat()
      .filter(metric => metric.category === category);
  }

  /**
   * Get metric trends
   */
  getMetricTrends(metricName: string, days: number = 30): MetricTrend {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const metricHistory = Array.from(this.metrics.values())
      .flat()
      .filter(m => m.name === metricName && m.timestamp >= cutoffDate)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const values = metricHistory.map(m => m.value);
    const direction = this.calculateTrendDirection(values);
    const rate = this.calculateTrendRate(values);

    return {
      direction,
      rate,
      period: `${days} days`,
      dataPoints: metricHistory.map(m => ({
        timestamp: m.timestamp,
        value: m.value,
        metadata: m.metadata
      }))
    };
  }

  private async collectVulnerabilityMetrics(
    vulnerabilities: VulnerabilityResult[],
    timestamp: Date
  ): Promise<SecurityMetric[]> {
    const metrics: SecurityMetric[] = [];

    // Total vulnerabilities
    metrics.push({
      id: crypto.randomUUID(),
      name: 'Total Vulnerabilities',
      category: 'vulnerability',
      value: vulnerabilities.length,
      unit: 'count',
      timestamp,
      trend: this.calculateMetricTrend('Total Vulnerabilities', vulnerabilities.length),
      threshold: { warning: 50, critical: 100, direction: 'above' },
      status: this.calculateMetricStatus(vulnerabilities.length, 50, 100, 'above'),
      tags: ['vulnerability', 'count'],
      metadata: {}
    });

    // Critical vulnerabilities
    const critical = vulnerabilities.filter(v => v.severity === 'critical').length;
    metrics.push({
      id: crypto.randomUUID(),
      name: 'Critical Vulnerabilities',
      category: 'vulnerability',
      value: critical,
      unit: 'count',
      timestamp,
      trend: this.calculateMetricTrend('Critical Vulnerabilities', critical),
      threshold: { warning: 5, critical: 10, direction: 'above' },
      status: this.calculateMetricStatus(critical, 5, 10, 'above'),
      tags: ['vulnerability', 'critical'],
      metadata: {}
    });

    // Mean time to remediation
    const avgRemediationTime = this.calculateAverageRemediationTime(vulnerabilities);
    metrics.push({
      id: crypto.randomUUID(),
      name: 'Mean Time to Remediation',
      category: 'vulnerability',
      value: avgRemediationTime,
      unit: 'days',
      timestamp,
      trend: this.calculateMetricTrend('Mean Time to Remediation', avgRemediationTime),
      threshold: { warning: 14, critical: 30, direction: 'above' },
      status: this.calculateMetricStatus(avgRemediationTime, 14, 30, 'above'),
      tags: ['vulnerability', 'remediation', 'time'],
      metadata: {}
    });

    return metrics;
  }

  private async collectThreatMetrics(
    threats: ThreatEvent[],
    timestamp: Date
  ): Promise<SecurityMetric[]> {
    const metrics: SecurityMetric[] = [];

    // Total threats detected
    metrics.push({
      id: crypto.randomUUID(),
      name: 'Threats Detected',
      category: 'threat',
      value: threats.length,
      unit: 'count',
      timestamp,
      trend: this.calculateMetricTrend('Threats Detected', threats.length),
      threshold: { warning: 20, critical: 50, direction: 'above' },
      status: this.calculateMetricStatus(threats.length, 20, 50, 'above'),
      tags: ['threat', 'detection'],
      metadata: {}
    });

    // High severity threats
    const highSeverity = threats.filter(t => ['critical', 'high'].includes(t.severity)).length;
    metrics.push({
      id: crypto.randomUUID(),
      name: 'High Severity Threats',
      category: 'threat',
      value: highSeverity,
      unit: 'count',
      timestamp,
      trend: this.calculateMetricTrend('High Severity Threats', highSeverity),
      threshold: { warning: 5, critical: 15, direction: 'above' },
      status: this.calculateMetricStatus(highSeverity, 5, 15, 'above'),
      tags: ['threat', 'high-severity'],
      metadata: {}
    });

    return metrics;
  }

  private async collectIncidentMetrics(
    incidents: SecurityIncident[],
    timestamp: Date
  ): Promise<SecurityMetric[]> {
    const metrics: SecurityMetric[] = [];

    // Active incidents
    const activeIncidents = incidents.filter(i => 
      ['open', 'investigating', 'contained'].includes(i.status)
    ).length;
    
    metrics.push({
      id: crypto.randomUUID(),
      name: 'Active Security Incidents',
      category: 'operations',
      value: activeIncidents,
      unit: 'count',
      timestamp,
      trend: this.calculateMetricTrend('Active Security Incidents', activeIncidents),
      threshold: { warning: 3, critical: 10, direction: 'above' },
      status: this.calculateMetricStatus(activeIncidents, 3, 10, 'above'),
      tags: ['incident', 'active'],
      metadata: {}
    });

    // Mean time to resolution
    const resolvedIncidents = incidents.filter(i => i.status === 'resolved' && i.resolvedAt);
    const avgResolutionTime = this.calculateAverageIncidentResolution(resolvedIncidents);
    
    metrics.push({
      id: crypto.randomUUID(),
      name: 'Mean Time to Incident Resolution',
      category: 'operations',
      value: avgResolutionTime,
      unit: 'hours',
      timestamp,
      trend: this.calculateMetricTrend('Mean Time to Incident Resolution', avgResolutionTime),
      threshold: { warning: 24, critical: 72, direction: 'above' },
      status: this.calculateMetricStatus(avgResolutionTime, 24, 72, 'above'),
      tags: ['incident', 'resolution', 'time'],
      metadata: {}
    });

    return metrics;
  }

  private async collectPolicyMetrics(
    violations: PolicyViolation[],
    timestamp: Date
  ): Promise<SecurityMetric[]> {
    const metrics: SecurityMetric[] = [];

    // Policy violations
    metrics.push({
      id: crypto.randomUUID(),
      name: 'Policy Violations',
      category: 'compliance',
      value: violations.length,
      unit: 'count',
      timestamp,
      trend: this.calculateMetricTrend('Policy Violations', violations.length),
      threshold: { warning: 10, critical: 25, direction: 'above' },
      status: this.calculateMetricStatus(violations.length, 10, 25, 'above'),
      tags: ['policy', 'violations'],
      metadata: {}
    });

    return metrics;
  }

  private async collectOperationalMetrics(timestamp: Date): Promise<SecurityMetric[]> {
    const metrics: SecurityMetric[] = [];

    // Security tool availability (simulated)
    const toolAvailability = 99.2;
    metrics.push({
      id: crypto.randomUUID(),
      name: 'Security Tool Availability',
      category: 'operations',
      value: toolAvailability,
      unit: 'percentage',
      timestamp,
      trend: this.calculateMetricTrend('Security Tool Availability', toolAvailability),
      threshold: { warning: 95, critical: 90, direction: 'below' },
      status: this.calculateMetricStatus(toolAvailability, 95, 90, 'below'),
      tags: ['operations', 'availability'],
      metadata: {}
    });

    return metrics;
  }

  private calculateAverageRemediationTime(vulnerabilities: VulnerabilityResult[]): number {
    // Simulate remediation time calculation
    const times = vulnerabilities.map(v => {
      const daysSinceDiscovery = (Date.now() - v.discoveredAt.getTime()) / (1000 * 60 * 60 * 24);
      return Math.min(daysSinceDiscovery, 30); // Cap at 30 days
    });

    return times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0;
  }

  private calculateAverageIncidentResolution(incidents: SecurityIncident[]): number {
    if (!incidents.length) return 0;

    const resolutionTimes = incidents.map(incident => {
      if (!incident.resolvedAt) return 0;
      return (incident.resolvedAt.getTime() - incident.createdAt.getTime()) / (1000 * 60 * 60); // hours
    });

    return resolutionTimes.reduce((sum, t) => sum + t, 0) / resolutionTimes.length;
  }

  private calculateMetricTrend(metricName: string, currentValue: number): MetricTrend {
    const historicalValues = this.getHistoricalValues(metricName);
    historicalValues.push({ timestamp: new Date(), value: currentValue });

    const values = historicalValues.map(d => d.value);
    const direction = this.calculateTrendDirection(values);
    const rate = this.calculateTrendRate(values);

    return {
      direction,
      rate,
      period: '7 days',
      dataPoints: historicalValues
    };
  }

  private calculateMetricStatus(
    value: number,
    warning: number,
    critical: number,
    direction: ThresholdDirection
  ): MetricStatus {
    if (direction === 'above') {
      if (value >= critical) return 'critical';
      if (value >= warning) return 'warning';
      return 'normal';
    } else {
      if (value <= critical) return 'critical';
      if (value <= warning) return 'warning';
      return 'normal';
    }
  }

  private getHistoricalValues(metricName: string): MetricDataPoint[] {
    // Simulate historical data
    const now = new Date();
    const values: MetricDataPoint[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      values.push({
        timestamp: date,
        value: Math.floor(Math.random() * 50) + 10, // Random values for simulation
      });
    }
    
    return values;
  }

  private calculateTrendDirection(values: number[]): TrendDirection {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-3);
    const earlier = values.slice(0, -2);
    
    if (earlier.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, v) => sum + v, 0) / earlier.length;
    
    const diff = recentAvg - earlierAvg;
    const threshold = earlierAvg * 0.1; // 10% threshold
    
    if (diff > threshold) return 'declining';
    if (diff < -threshold) return 'improving';
    return 'stable';
  }

  private calculateTrendRate(values: number[]): number {
    if (values.length < 2) return 0;
    
    const changes = values.slice(1).map((value, index) => 
      Math.abs(value - values[index]) / (values[index] || 1)
    );
    
    return changes.reduce((sum, change) => sum + change, 0) / changes.length;
  }

  private storeMetrics(metrics: SecurityMetric[]): void {
    const today = new Date().toISOString().split('T')[0];
    const existing = this.metrics.get(today) || [];
    this.metrics.set(today, [...existing, ...metrics]);

    // Keep only last 90 days of metrics
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    for (const [date, metrics] of this.metrics.entries()) {
      if (new Date(date) < cutoffDate) {
        this.metrics.delete(date);
      }
    }
  }
}

/**
 * Main Security Analytics System
 */
export class SecurityAnalytics {
  private logger: Logger;
  private configManager: SecurityConfigManager;
  private riskEngine: RiskAssessmentEngine;
  private metricsCollector: SecurityMetricsCollector;
  private assessments: Map<string, RiskAssessment> = new Map();

  constructor(logger: Logger, configManager: SecurityConfigManager) {
    this.logger = logger;
    this.configManager = configManager;
    this.riskEngine = new RiskAssessmentEngine(logger);
    this.metricsCollector = new SecurityMetricsCollector(logger);
  }

  /**
   * Initialize the security analytics system
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Security Analytics System');
    
    const config = this.configManager.getConfig().analytics;
    
    if (!config.enabled) {
      this.logger.info('Security analytics is disabled');
      return;
    }

    this.logger.info('Security Analytics System initialized successfully');
  }

  /**
   * Perform comprehensive security analysis
   */
  async performSecurityAnalysis(
    vulnerabilities: VulnerabilityResult[],
    threats: ThreatEvent[],
    incidents: SecurityIncident[],
    violations: PolicyViolation[],
    compliance: ComplianceAssessment[]
  ): Promise<{ assessmentId: string; metrics: SecurityMetric[] }> {
    this.logger.info('Performing comprehensive security analysis');

    // Perform risk assessment
    const riskAssessment = await this.riskEngine.performRiskAssessment(
      vulnerabilities,
      threats,
      incidents,
      violations,
      compliance
    );

    // Collect security metrics
    const metrics = await this.metricsCollector.collectMetrics(
      vulnerabilities,
      threats,
      incidents,
      violations
    );

    // Store assessment
    this.assessments.set(riskAssessment.id, riskAssessment);

    this.logger.info(`Security analysis completed. Risk level: ${riskAssessment.riskLevel}`);
    return {
      assessmentId: riskAssessment.id,
      metrics
    };
  }

  /**
   * Get risk assessment by ID
   */
  getRiskAssessment(assessmentId: string): RiskAssessment | undefined {
    return this.assessments.get(assessmentId);
  }

  /**
   * Get latest risk assessment
   */
  getLatestRiskAssessment(): RiskAssessment | undefined {
    const assessments = Array.from(this.assessments.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return assessments[0];
  }

  /**
   * Get security metrics by category
   */
  getSecurityMetrics(category?: MetricCategory): SecurityMetric[] {
    if (category) {
      return this.metricsCollector.getMetricsByCategory(category);
    }
    return Array.from(this.metricsCollector.getMetricsByCategory as any); // All metrics
  }

  /**
   * Get metric trends
   */
  getMetricTrends(metricName: string, days: number = 30): MetricTrend {
    return this.metricsCollector.getMetricTrends(metricName, days);
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(
    type: ReportType = 'executive',
    period: ReportPeriod
  ): Promise<SecurityReport> {
    const latestAssessment = this.getLatestRiskAssessment();
    if (!latestAssessment) {
      throw new Error('No risk assessment available for reporting');
    }

    const metrics = this.getSecurityMetrics();
    const report: SecurityReport = {
      id: crypto.randomUUID(),
      title: `Security ${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
      type,
      period,
      generatedAt: new Date(),
      generatedBy: 'security-analytics',
      summary: await this.generateReportSummary(latestAssessment, type),
      sections: await this.generateReportSections(latestAssessment, type),
      metrics: metrics.slice(0, 20), // Top 20 metrics
      charts: await this.generateReportCharts(latestAssessment, metrics),
      recommendations: latestAssessment.recommendations,
      appendices: [],
      distribution: {
        recipients: [],
        channels: ['email'],
        format: 'pdf'
      }
    };

    return report;
  }

  /**
   * Get security analytics statistics
   */
  getAnalyticsStats(): {
    totalAssessments: number;
    latestRiskScore: number;
    riskTrend: TrendDirection;
    topRisks: string[];
    metricsCount: number;
    alertsCount: number;
  } {
    const assessments = Array.from(this.assessments.values());
    const latest = this.getLatestRiskAssessment();
    const metrics = this.getSecurityMetrics();
    
    const riskScores = assessments.map(a => a.overallRiskScore);
    const riskTrend = this.calculateTrendDirection(riskScores);
    
    const topRisks = latest?.riskFactors
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(f => f.name) || [];
    
    const alertsCount = metrics.filter(m => m.status !== 'normal').length;

    return {
      totalAssessments: assessments.length,
      latestRiskScore: latest?.overallRiskScore || 0,
      riskTrend,
      topRisks,
      metricsCount: metrics.length,
      alertsCount
    };
  }

  private async generateReportSummary(
    assessment: RiskAssessment,
    type: ReportType
  ): Promise<ReportSummary> {
    const executiveSummary = type === 'executive' 
      ? `The organization's current security risk level is ${assessment.riskLevel} with an overall risk score of ${assessment.overallRiskScore}. ${assessment.recommendations.length} key recommendations have been identified to improve the security posture.`
      : `Technical analysis reveals ${assessment.riskFactors.length} risk factors across vulnerability, threat, and compliance domains. Immediate attention required for ${assessment.riskFactors.filter(f => f.severity === 'critical').length} critical risk factors.`;

    const keyFindings = assessment.riskFactors
      .slice(0, 3)
      .map(f => f.description);

    const majorRisks = assessment.riskFactors
      .filter(f => f.severity === 'critical' || f.severity === 'high')
      .map(f => f.name);

    return {
      executiveSummary,
      keyFindings,
      majorRisks,
      achievements: ['Vulnerability scanning coverage increased', 'Incident response time improved'],
      priorities: assessment.recommendations.slice(0, 3).map(r => r.title),
      outlook: assessment.trend.direction === 'improving' 
        ? 'Security posture is trending positively with continued improvement expected.'
        : 'Security posture requires attention to address identified risks.'
    };
  }

  private async generateReportSections(
    assessment: RiskAssessment,
    type: ReportType
  ): Promise<ReportSection[]> {
    const sections: ReportSection[] = [];

    // Risk Overview Section
    sections.push({
      title: 'Risk Overview',
      content: `Overall security risk assessment shows ${assessment.riskLevel} risk level with score of ${assessment.overallRiskScore}.`,
      subsections: [
        {
          title: 'Risk Factors',
          content: `${assessment.riskFactors.length} risk factors identified across security domains.`,
          level: 2
        }
      ],
      charts: [{
        id: crypto.randomUUID(),
        title: 'Risk Distribution by Category',
        type: 'pie',
        data: {
          labels: [...new Set(assessment.riskFactors.map(f => f.category))],
          datasets: [{
            label: 'Risk Score',
            data: this.aggregateRiskByCategory(assessment.riskFactors),
            backgroundColor: '#FF6384'
          }]
        },
        config: { responsive: true, maintainAspectRatio: false, plugins: {}, scales: {} },
        insights: ['Vulnerability risks dominate the threat landscape']
      }],
      tables: [{
        title: 'Top Risk Factors',
        headers: ['Risk Factor', 'Category', 'Severity', 'Score'],
        rows: assessment.riskFactors.slice(0, 10).map(f => [
          f.name, f.category, f.severity, f.score.toFixed(1)
        ]),
        sortable: true
      }],
      callouts: [{
        type: 'warning',
        title: 'Critical Risk Alert',
        content: `${assessment.riskFactors.filter(f => f.severity === 'critical').length} critical risk factors require immediate attention.`
      }]
    });

    if (type === 'technical') {
      // Detailed technical sections
      sections.push({
        title: 'Vulnerability Assessment',
        content: `Detailed analysis of ${assessment.vulnerabilityRisk.totalVulnerabilities} vulnerabilities with ${assessment.vulnerabilityRisk.criticalVulnerabilities} critical findings.`,
        subsections: [],
        charts: [],
        tables: [],
        callouts: []
      });

      sections.push({
        title: 'Threat Landscape',
        content: `Current threat environment with ${assessment.threatRisk.activeThreatCampaigns} active campaigns and ${assessment.threatRisk.emergingThreats.length} emerging threats.`,
        subsections: [],
        charts: [],
        tables: [],
        callouts: []
      });
    }

    return sections;
  }

  private async generateReportCharts(
    assessment: RiskAssessment,
    metrics: SecurityMetric[]
  ): Promise<ReportChart[]> {
    const charts: ReportChart[] = [];

    // Risk trend chart
    const riskTrendData = this.generateRiskTrendData();
    charts.push({
      id: crypto.randomUUID(),
      title: 'Risk Score Trend',
      type: 'line',
      data: {
        labels: riskTrendData.labels,
        datasets: [{
          label: 'Risk Score',
          data: riskTrendData.values,
          borderColor: '#FF6384'
        }]
      },
      config: { responsive: true, maintainAspectRatio: false, plugins: {}, scales: {} },
      insights: ['Risk score has been ' + assessment.trend.direction + ' over the past 30 days']
    });

    // Vulnerability distribution
    const vulnData = this.aggregateVulnerabilityData(assessment.vulnerabilityRisk);
    charts.push({
      id: crypto.randomUUID(),
      title: 'Vulnerability Distribution by Severity',
      type: 'bar',
      data: vulnData,
      config: { responsive: true, maintainAspectRatio: false, plugins: {}, scales: {} },
      insights: ['Critical vulnerabilities require immediate remediation']
    });

    return charts;
  }

  private aggregateRiskByCategory(riskFactors: RiskFactor[]): number[] {
    const categories = [...new Set(riskFactors.map(f => f.category))];
    return categories.map(category => 
      riskFactors
        .filter(f => f.category === category)
        .reduce((sum, f) => sum + f.score, 0)
    );
  }

  private generateRiskTrendData(): { labels: string[]; values: number[] } {
    // Simulate 30 days of risk score data
    const labels: string[] = [];
    const values: number[] = [];
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      labels.push(date.toLocaleDateString());
      values.push(Math.floor(Math.random() * 20) + 40); // Random values between 40-60
    }
    
    return { labels, values };
  }

  private aggregateVulnerabilityData(vulnRisk: VulnerabilityRiskAssessment): ChartData {
    return {
      labels: ['Critical', 'High', 'Medium', 'Low'],
      datasets: [{
        label: 'Vulnerabilities',
        data: [
          vulnRisk.criticalVulnerabilities,
          vulnRisk.highVulnerabilities,
          Math.max(0, vulnRisk.totalVulnerabilities - vulnRisk.criticalVulnerabilities - vulnRisk.highVulnerabilities - 10),
          10 // Simulate low severity
        ],
        backgroundColor: '#36A2EB'
      }]
    };
  }

  private calculateTrendDirection(values: number[]): TrendDirection {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-5);
    const earlier = values.slice(0, -5);
    
    if (earlier.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, v) => sum + v, 0) / earlier.length;
    
    const diff = recentAvg - earlierAvg;
    
    if (diff > 5) return 'declining'; // Higher risk score = worse
    if (diff < -5) return 'improving';
    return 'stable';
  }
}

export default SecurityAnalytics;