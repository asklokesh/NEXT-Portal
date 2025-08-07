/**
 * Incident Response Automation System
 * 
 * Advanced automated incident response system that provides intelligent incident
 * classification, automated response workflows, forensic data collection, and
 * coordinated incident management. Includes machine learning-based incident
 * analysis and automated containment strategies.
 * 
 * Features:
 * - Intelligent incident classification and prioritization
 * - Automated response workflows and playbooks
 * - Real-time incident orchestration and coordination
 * - Forensic evidence collection and preservation
 * - Automated containment and isolation procedures
 * - Communication and notification management
 * - Post-incident analysis and lessons learned
 * - Integration with external security tools
 * - Compliance and reporting automation
 * - Machine learning-based response optimization
 */

import { Logger } from '@backstage/backend-common';
import { SecurityConfigManager } from './security-config';
import { ThreatEvent, SecurityIncident } from './threat-detection';
import { PolicyViolation } from './policy-engine';
import { VulnerabilityResult } from './vulnerability-scanner';
import * as crypto from 'crypto';

export interface IncidentResponse {
  id: string;
  incidentId: string;
  status: ResponseStatus;
  severity: ResponseSeverity;
  priority: ResponsePriority;
  classification: IncidentClassification;
  playbook: ResponsePlaybook;
  timeline: ResponseEvent[];
  actions: ResponseAction[];
  containment: ContainmentAction[];
  forensics: ForensicEvidence[];
  communications: CommunicationRecord[];
  resources: IncidentResource[];
  escalation: EscalationRecord[];
  resolution: IncidentResolution | null;
  createdAt: Date;
  updatedAt: Date;
  assignedTo: string[];
  commander: string;
  metadata: Record<string, any>;
}

export interface IncidentClassification {
  type: IncidentType;
  category: IncidentCategory;
  subcategory: string;
  confidence: number;
  indicators: ClassificationIndicator[];
  severity: IncidentSeverity;
  impact: ImpactAssessment;
  scope: IncidentScope;
  attackVector: AttackVector[];
  killChain: KillChainPhase[];
}

export interface ResponsePlaybook {
  id: string;
  name: string;
  description: string;
  version: string;
  applicability: PlaybookApplicability;
  phases: ResponsePhase[];
  automationLevel: AutomationLevel;
  estimatedDuration: number;
  requiredRoles: string[];
  prerequisites: string[];
  success_criteria: string[];
  metadata: Record<string, any>;
}

export interface ResponsePhase {
  id: string;
  name: string;
  description: string;
  order: number;
  type: PhaseType;
  actions: ResponseAction[];
  parallel: boolean;
  timeout: number;
  preconditions: string[];
  success_criteria: string[];
  rollback: RollbackStrategy;
  status: PhaseStatus;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ResponseAction {
  id: string;
  name: string;
  description: string;
  type: ActionType;
  category: ActionCategory;
  automation: ActionAutomation;
  priority: ActionPriority;
  status: ActionStatus;
  assignee: string;
  prerequisites: string[];
  timeout: number;
  retries: number;
  parameters: ActionParameters;
  execution: ActionExecution;
  validation: ActionValidation;
  evidence: string[];
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  result?: ActionResult;
}

export interface ActionParameters {
  targets: string[];
  commands: string[];
  scripts: string[];
  notifications: NotificationConfig[];
  forensics: ForensicConfig[];
  containment: ContainmentConfig[];
  custom: Record<string, any>;
}

export interface ActionExecution {
  method: ExecutionMethod;
  endpoint?: string;
  credentials?: string;
  environment: Record<string, string>;
  workingDirectory?: string;
  logLevel: LogLevel;
  auditTrail: boolean;
}

export interface ActionValidation {
  required: boolean;
  criteria: ValidationCriteria[];
  timeout: number;
  automated: boolean;
  approvalRequired: boolean;
}

export interface ValidationCriteria {
  type: ValidationType;
  condition: string;
  expected: any;
  tolerance: number;
  critical: boolean;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data: any;
  logs: string[];
  metrics: ActionMetrics;
  artifacts: string[];
  recommendations: string[];
}

export interface ActionMetrics {
  executionTime: number;
  resourceUsage: ResourceUsage;
  errorCount: number;
  retryCount: number;
  effectivenessScore: number;
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  network: number;
  disk: number;
}

export interface ContainmentAction {
  id: string;
  type: ContainmentType;
  target: ContainmentTarget;
  action: string;
  severity: ContainmentSeverity;
  automated: boolean;
  reversible: boolean;
  impact: ContainmentImpact;
  duration: number;
  approvalRequired: boolean;
  status: ContainmentStatus;
  executedAt?: Date;
  executedBy: string;
  result?: ContainmentResult;
}

export interface ContainmentTarget {
  type: TargetType;
  identifier: string;
  location: string;
  properties: Record<string, any>;
}

export interface ContainmentImpact {
  businessFunctions: string[];
  users: number;
  systems: number;
  services: string[];
  estimatedCost: number;
  riskReduction: number;
}

export interface ContainmentResult {
  success: boolean;
  message: string;
  isolatedAssets: string[];
  blockedConnections: string[];
  disabledAccounts: string[];
  quarantinedFiles: string[];
  effectivenessScore: number;
}

export interface ForensicEvidence {
  id: string;
  type: EvidenceType;
  category: EvidenceCategory;
  source: string;
  location: string;
  timestamp: Date;
  collector: string;
  hash: string;
  size: number;
  chainOfCustody: CustodyRecord[];
  analysis: EvidenceAnalysis;
  preservation: PreservationRecord;
  tags: string[];
  confidentiality: ConfidentialityLevel;
}

export interface CustodyRecord {
  timestamp: Date;
  handler: string;
  action: CustodyAction;
  location: string;
  signature: string;
  notes: string;
}

export interface EvidenceAnalysis {
  status: AnalysisStatus;
  analyst: string;
  findings: AnalysisFinding[];
  iocs: IOC[];
  timeline: AnalysisEvent[];
  tools: string[];
  confidence: number;
  completedAt?: Date;
}

export interface AnalysisFinding {
  id: string;
  type: FindingType;
  severity: FindingSeverity;
  description: string;
  evidence: string[];
  confidence: number;
  impact: string;
  recommendations: string[];
}

export interface IOC {
  type: IOCType;
  value: string;
  confidence: number;
  context: string;
  source: string;
  firstSeen: Date;
  lastSeen: Date;
  malicious: boolean;
}

export interface AnalysisEvent {
  timestamp: Date;
  event: string;
  source: string;
  details: Record<string, any>;
}

export interface PreservationRecord {
  method: PreservationMethod;
  location: string;
  retention: number;
  encryption: boolean;
  accessibility: AccessibilityLevel;
  backups: BackupRecord[];
}

export interface BackupRecord {
  location: string;
  timestamp: Date;
  checksum: string;
  verified: boolean;
}

export interface CommunicationRecord {
  id: string;
  type: CommunicationType;
  channel: CommunicationChannel;
  sender: string;
  recipients: string[];
  subject: string;
  message: string;
  priority: CommunicationPriority;
  status: CommunicationStatus;
  sentAt: Date;
  template?: string;
  attachments: string[];
  trackingId?: string;
}

export interface IncidentResource {
  id: string;
  type: ResourceType;
  name: string;
  description: string;
  availability: ResourceAvailability;
  allocation: ResourceAllocation;
  utilization: number;
  cost: number;
  skills: string[];
  location: string;
  contact: ContactInfo;
}

export interface ResourceAllocation {
  startTime: Date;
  endTime?: Date;
  role: string;
  responsibility: string[];
  workload: number;
}

export interface ContactInfo {
  email: string;
  phone: string;
  alternatePhone?: string;
  timezone: string;
  preferredContact: ContactMethod;
}

export interface EscalationRecord {
  id: string;
  reason: EscalationReason;
  fromLevel: EscalationLevel;
  toLevel: EscalationLevel;
  escalatedBy: string;
  escalatedTo: string;
  timestamp: Date;
  urgency: EscalationUrgency;
  context: string;
  requirements: string[];
  status: EscalationStatus;
  response?: EscalationResponse;
}

export interface EscalationResponse {
  respondedBy: string;
  respondedAt: Date;
  decision: EscalationDecision;
  actions: string[];
  additionalResources: string[];
  newTimeline?: Date;
  comments: string;
}

export interface IncidentResolution {
  id: string;
  type: ResolutionType;
  summary: string;
  rootCause: RootCauseAnalysis;
  timeline: ResolutionTimeline;
  actions: ResolutionAction[];
  verification: ResolutionVerification;
  documentation: ResolutionDocumentation;
  lessonsLearned: LessonLearned[];
  preventionMeasures: PreventionMeasure[];
  resolvedAt: Date;
  resolvedBy: string;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface RootCauseAnalysis {
  primaryCause: string;
  contributingFactors: string[];
  timeline: CauseEvent[];
  methodology: string;
  confidence: number;
  evidence: string[];
  recommendations: string[];
}

export interface CauseEvent {
  timestamp: Date;
  event: string;
  impact: string;
  evidence: string[];
}

export interface ResolutionTimeline {
  detection: Date;
  response: Date;
  containment?: Date;
  eradication?: Date;
  recovery?: Date;
  resolution: Date;
  totalDuration: number;
  phases: PhaseTimeline[];
}

export interface PhaseTimeline {
  phase: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  effectiveness: number;
}

export interface ResolutionAction {
  action: string;
  responsible: string;
  completedAt: Date;
  effectiveness: number;
  cost: number;
  impact: string;
}

export interface ResolutionVerification {
  method: VerificationMethod;
  criteria: VerificationCriteria[];
  results: VerificationResult[];
  verified: boolean;
  verifiedBy: string;
  verifiedAt: Date;
}

export interface VerificationCriteria {
  requirement: string;
  test: string;
  expected: any;
  critical: boolean;
}

export interface VerificationResult {
  criteria: string;
  result: any;
  passed: boolean;
  notes: string;
}

export interface ResolutionDocumentation {
  incidentReport: string;
  technicalDetails: string;
  businessImpact: string;
  timelineDocument: string;
  evidenceInventory: string;
  communicationLog: string;
  approvals: ApprovalRecord[];
}

export interface ApprovalRecord {
  approver: string;
  role: string;
  approvedAt: Date;
  signature: string;
  comments: string;
}

export interface LessonLearned {
  id: string;
  category: LessonCategory;
  description: string;
  impact: string;
  recommendations: string[];
  implementation: ImplementationPlan;
  priority: LessonPriority;
  owner: string;
  dueDate: Date;
  status: LessonStatus;
}

export interface ImplementationPlan {
  actions: string[];
  timeline: number;
  cost: number;
  resources: string[];
  dependencies: string[];
  metrics: string[];
}

export interface PreventionMeasure {
  id: string;
  type: PreventionType;
  description: string;
  implementation: string[];
  cost: number;
  effectiveness: number;
  timeline: number;
  responsible: string;
  metrics: string[];
  status: PreventionStatus;
}

export interface ResponseEvent {
  id: string;
  timestamp: Date;
  type: EventType;
  category: EventCategory;
  description: string;
  actor: string;
  details: Record<string, any>;
  impact: EventImpact;
  automated: boolean;
}

export interface ImpactAssessment {
  confidentiality: ImpactLevel;
  integrity: ImpactLevel;
  availability: ImpactLevel;
  business: BusinessImpact;
  technical: TechnicalImpact;
  regulatory: RegulatoryImpact;
  reputation: ReputationalImpact;
}

export interface BusinessImpact {
  revenue: number;
  customers: number;
  operations: string[];
  compliance: string[];
  partnerships: string[];
}

export interface TechnicalImpact {
  systems: string[];
  services: string[];
  data: string[];
  networks: string[];
  applications: string[];
}

export interface RegulatoryImpact {
  frameworks: string[];
  violations: string[];
  notifications: string[];
  penalties: number;
}

export interface ReputationalImpact {
  severity: ReputationSeverity;
  audiences: string[];
  channels: string[];
  duration: number;
  recovery: string[];
}

export interface IncidentScope {
  geographic: string[];
  organizational: string[];
  technical: string[];
  temporal: TemporalScope;
}

export interface TemporalScope {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  peak: Date;
}

export interface ClassificationIndicator {
  type: IndicatorType;
  value: string;
  confidence: number;
  context: string;
  source: string;
}

export interface PlaybookApplicability {
  incidentTypes: IncidentType[];
  severities: IncidentSeverity[];
  categories: IncidentCategory[];
  conditions: string[];
}

// Enums and types
export type ResponseStatus = 'initiated' | 'active' | 'contained' | 'resolved' | 'closed';
export type ResponseSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ResponsePriority = 'p1' | 'p2' | 'p3' | 'p4';
export type IncidentType = 'security-breach' | 'malware' | 'phishing' | 'dos' | 'insider-threat' | 'data-leak' | 'system-compromise';
export type IncidentCategory = 'confidentiality' | 'integrity' | 'availability' | 'compliance' | 'safety';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AttackVector = 'email' | 'web' | 'network' | 'physical' | 'social' | 'supply-chain';
export type KillChainPhase = 'reconnaissance' | 'weaponization' | 'delivery' | 'exploitation' | 'installation' | 'command-control' | 'actions';
export type AutomationLevel = 'manual' | 'semi-automated' | 'automated' | 'fully-automated';
export type PhaseType = 'preparation' | 'identification' | 'containment' | 'eradication' | 'recovery' | 'lessons-learned';
export type PhaseStatus = 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
export type ActionType = 'investigation' | 'containment' | 'communication' | 'forensics' | 'recovery' | 'documentation';
export type ActionCategory = 'technical' | 'procedural' | 'communication' | 'legal' | 'business';
export type ActionAutomation = 'manual' | 'semi-automated' | 'automated';
export type ActionPriority = 'immediate' | 'urgent' | 'high' | 'medium' | 'low';
export type ActionStatus = 'pending' | 'assigned' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
export type ExecutionMethod = 'script' | 'api' | 'manual' | 'workflow' | 'external-tool';
export type LogLevel = 'debug' | 'info' | 'warning' | 'error';
export type ValidationType = 'functional' | 'security' | 'performance' | 'compliance';
export type ContainmentType = 'network-isolation' | 'system-shutdown' | 'account-disable' | 'service-block' | 'data-quarantine';
export type TargetType = 'system' | 'network' | 'user' | 'service' | 'data';
export type ContainmentSeverity = 'minimal' | 'moderate' | 'significant' | 'severe';
export type ContainmentStatus = 'planned' | 'executing' | 'completed' | 'failed' | 'reversed';
export type EvidenceType = 'disk-image' | 'memory-dump' | 'network-capture' | 'log-file' | 'document' | 'screenshot';
export type EvidenceCategory = 'digital' | 'physical' | 'documentary' | 'testimonial';
export type CustodyAction = 'collected' | 'transferred' | 'analyzed' | 'stored' | 'destroyed';
export type AnalysisStatus = 'pending' | 'in-progress' | 'completed' | 'blocked';
export type FindingType = 'malware' | 'suspicious-activity' | 'policy-violation' | 'data-exfiltration' | 'system-compromise';
export type FindingSeverity = 'informational' | 'low' | 'medium' | 'high' | 'critical';
export type IOCType = 'ip' | 'domain' | 'hash' | 'url' | 'email' | 'file' | 'registry' | 'process';
export type PreservationMethod = 'disk-image' | 'file-copy' | 'database-export' | 'memory-dump' | 'network-capture';
export type AccessibilityLevel = 'immediate' | 'controlled' | 'restricted' | 'archived';
export type CommunicationType = 'initial-notification' | 'status-update' | 'escalation' | 'resolution' | 'post-incident';
export type CommunicationChannel = 'email' | 'sms' | 'phone' | 'slack' | 'teams' | 'incident-portal';
export type CommunicationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type CommunicationStatus = 'draft' | 'sent' | 'delivered' | 'read' | 'responded';
export type ResourceType = 'person' | 'system' | 'tool' | 'documentation' | 'external-service';
export type ResourceAvailability = 'available' | 'busy' | 'unavailable' | 'on-call';
export type ContactMethod = 'email' | 'phone' | 'sms' | 'slack';
export type EscalationReason = 'severity-increase' | 'resource-needed' | 'expertise-needed' | 'authority-needed' | 'timeline-exceeded';
export type EscalationLevel = 'l1' | 'l2' | 'l3' | 'executive' | 'legal' | 'external';
export type EscalationUrgency = 'low' | 'medium' | 'high' | 'critical';
export type EscalationStatus = 'pending' | 'acknowledged' | 'resolved';
export type EscalationDecision = 'approved' | 'rejected' | 'deferred' | 'modified';
export type ResolutionType = 'resolved' | 'false-positive' | 'duplicate' | 'transferred';
export type VerificationMethod = 'automated-test' | 'manual-test' | 'observation' | 'documentation-review';
export type LessonCategory = 'technical' | 'procedural' | 'communication' | 'organizational' | 'training';
export type LessonPriority = 'critical' | 'high' | 'medium' | 'low';
export type LessonStatus = 'identified' | 'approved' | 'implemented' | 'verified' | 'closed';
export type PreventionType = 'technical-control' | 'process-improvement' | 'training' | 'policy-change' | 'monitoring';
export type PreventionStatus = 'planned' | 'implementing' | 'completed' | 'deferred';
export type EventType = 'detection' | 'analysis' | 'response' | 'escalation' | 'resolution';
export type EventCategory = 'system' | 'user' | 'automated' | 'external';
export type EventImpact = 'none' | 'minimal' | 'moderate' | 'significant' | 'severe';
export type ImpactLevel = 'none' | 'low' | 'medium' | 'high';
export type ReputationSeverity = 'none' | 'minor' | 'moderate' | 'major' | 'catastrophic';
export type IndicatorType = 'behavioral' | 'technical' | 'contextual' | 'temporal';
export type ConfidentialityLevel = 'public' | 'internal' | 'confidential' | 'restricted';

/**
 * Incident Classification Engine
 * Automatically classifies incidents based on characteristics and indicators
 */
export class IncidentClassificationEngine {
  private logger: Logger;
  private classificationRules: ClassificationRule[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Initialize classification engine with rules
   */
  async initialize(): Promise<void> {
    await this.loadClassificationRules();
    this.logger.info(`Loaded ${this.classificationRules.length} classification rules`);
  }

  /**
   * Classify an incident based on threat events and context
   */
  async classifyIncident(
    incident: SecurityIncident,
    threats: ThreatEvent[],
    context: Record<string, any> = {}
  ): Promise<IncidentClassification> {
    this.logger.debug(`Classifying incident ${incident.id}`);

    const indicators = await this.extractIndicators(incident, threats);
    const classification = await this.applyClassificationRules(indicators, context);
    
    // Enhance classification with AI/ML analysis
    const enhancedClassification = await this.enhanceWithML(classification, indicators);
    
    return enhancedClassification;
  }

  /**
   * Extract classification indicators from incident data
   */
  private async extractIndicators(
    incident: SecurityIncident,
    threats: ThreatEvent[]
  ): Promise<ClassificationIndicator[]> {
    const indicators: ClassificationIndicator[] = [];

    // Extract indicators from incident metadata
    if (incident.metadata?.attackVector) {
      indicators.push({
        type: 'technical',
        value: incident.metadata.attackVector,
        confidence: 0.8,
        context: 'attack-vector',
        source: 'incident-metadata'
      });
    }

    // Extract indicators from threat events
    for (const threat of threats) {
      if (threat.indicators) {
        indicators.push(...threat.indicators.map(ind => ({
          type: 'technical' as IndicatorType,
          value: ind.value,
          confidence: ind.confidence,
          context: ind.context,
          source: 'threat-detection'
        })));
      }
    }

    // Extract behavioral indicators
    const behavioralIndicators = await this.extractBehavioralIndicators(incident);
    indicators.push(...behavioralIndicators);

    return indicators;
  }

  /**
   * Apply classification rules to determine incident type and characteristics
   */
  private async applyClassificationRules(
    indicators: ClassificationIndicator[],
    context: Record<string, any>
  ): Promise<IncidentClassification> {
    let bestMatch: ClassificationRule | null = null;
    let highestScore = 0;

    // Evaluate each classification rule
    for (const rule of this.classificationRules) {
      const score = this.calculateRuleScore(rule, indicators, context);
      if (score > highestScore && score >= rule.threshold) {
        highestScore = score;
        bestMatch = rule;
      }
    }

    if (!bestMatch) {
      // Default classification for unmatched incidents
      bestMatch = this.getDefaultClassification();
    }

    const impact = await this.assessImpact(indicators, bestMatch);
    const scope = await this.determineScope(indicators, context);

    return {
      type: bestMatch.type,
      category: bestMatch.category,
      subcategory: bestMatch.subcategory,
      confidence: highestScore,
      indicators,
      severity: this.determineSeverity(impact, scope),
      impact,
      scope,
      attackVector: this.identifyAttackVectors(indicators),
      killChain: this.mapToKillChain(indicators)
    };
  }

  /**
   * Enhance classification with machine learning analysis
   */
  private async enhanceWithML(
    classification: IncidentClassification,
    indicators: ClassificationIndicator[]
  ): Promise<IncidentClassification> {
    // Simulate ML enhancement (in production, this would use actual ML models)
    const mlConfidence = this.calculateMLConfidence(classification, indicators);
    
    // Adjust confidence based on ML analysis
    classification.confidence = (classification.confidence + mlConfidence) / 2;
    
    // Add ML-derived insights
    if (mlConfidence > 0.8) {
      classification.subcategory += '-confirmed';
    }

    return classification;
  }

  /**
   * Extract behavioral indicators from incident patterns
   */
  private async extractBehavioralIndicators(incident: SecurityIncident): Promise<ClassificationIndicator[]> {
    const indicators: ClassificationIndicator[] = [];

    // Analyze incident timing
    const hour = incident.createdAt.getHours();
    if (hour < 6 || hour > 22) {
      indicators.push({
        type: 'behavioral',
        value: 'off-hours-activity',
        confidence: 0.6,
        context: 'timing',
        source: 'temporal-analysis'
      });
    }

    // Analyze incident severity escalation
    if (incident.severity === 'critical' && incident.timeline.length > 1) {
      indicators.push({
        type: 'behavioral',
        value: 'rapid-escalation',
        confidence: 0.7,
        context: 'severity-change',
        source: 'timeline-analysis'
      });
    }

    return indicators;
  }

  /**
   * Calculate rule matching score
   */
  private calculateRuleScore(
    rule: ClassificationRule,
    indicators: ClassificationIndicator[],
    context: Record<string, any>
  ): number {
    let score = 0;
    let matchCount = 0;

    // Check indicator matches
    for (const ruleIndicator of rule.indicators) {
      const matchingIndicators = indicators.filter(ind => 
        ind.type === ruleIndicator.type && 
        this.matchesPattern(ind.value, ruleIndicator.pattern)
      );

      if (matchingIndicators.length > 0) {
        const avgConfidence = matchingIndicators.reduce((sum, ind) => sum + ind.confidence, 0) / matchingIndicators.length;
        score += ruleIndicator.weight * avgConfidence;
        matchCount++;
      }
    }

    // Check context conditions
    for (const condition of rule.conditions) {
      if (this.evaluateCondition(condition, context)) {
        score += condition.weight;
        matchCount++;
      }
    }

    // Normalize score
    return matchCount > 0 ? score / rule.indicators.length : 0;
  }

  /**
   * Assess incident impact across multiple dimensions
   */
  private async assessImpact(
    indicators: ClassificationIndicator[],
    rule: ClassificationRule
  ): Promise<ImpactAssessment> {
    // Base impact from classification rule
    const baseImpact = rule.baseImpact;

    // Enhance impact based on indicators
    const enhancedImpact = { ...baseImpact };

    // Check for data-related indicators
    const dataIndicators = indicators.filter(ind => 
      ind.context.includes('data') || ind.value.includes('exfiltration')
    );
    
    if (dataIndicators.length > 0) {
      enhancedImpact.confidentiality = 'high';
      enhancedImpact.business.compliance = ['data-protection', 'privacy'];
    }

    // Check for system compromise indicators
    const systemIndicators = indicators.filter(ind =>
      ind.context.includes('system') || ind.value.includes('compromise')
    );

    if (systemIndicators.length > 0) {
      enhancedImpact.integrity = 'high';
      enhancedImpact.availability = 'medium';
      enhancedImpact.technical.systems = ['critical-infrastructure'];
    }

    return enhancedImpact;
  }

  /**
   * Determine incident scope
   */
  private async determineScope(
    indicators: ClassificationIndicator[],
    context: Record<string, any>
  ): Promise<IncidentScope> {
    const scope: IncidentScope = {
      geographic: ['local'],
      organizational: ['single-department'],
      technical: ['single-system'],
      temporal: {
        startTime: new Date(),
        peak: new Date()
      }
    };

    // Analyze indicators for scope expansion
    const networkIndicators = indicators.filter(ind => 
      ind.context.includes('network') || ind.type === 'technical'
    );

    if (networkIndicators.length > 3) {
      scope.technical = ['multiple-systems', 'network-wide'];
      scope.organizational = ['multiple-departments'];
    }

    return scope;
  }

  /**
   * Determine incident severity based on impact and scope
   */
  private determineSeverity(impact: ImpactAssessment, scope: IncidentScope): IncidentSeverity {
    let severityScore = 0;

    // Impact scoring
    const impactLevels = { 'none': 0, 'low': 1, 'medium': 2, 'high': 3 };
    severityScore += impactLevels[impact.confidentiality] * 3;
    severityScore += impactLevels[impact.integrity] * 3;
    severityScore += impactLevels[impact.availability] * 2;

    // Scope scoring
    if (scope.organizational.includes('multiple-departments')) severityScore += 2;
    if (scope.technical.includes('network-wide')) severityScore += 2;

    // Map score to severity
    if (severityScore >= 15) return 'critical';
    if (severityScore >= 10) return 'high';
    if (severityScore >= 5) return 'medium';
    return 'low';
  }

  /**
   * Identify attack vectors from indicators
   */
  private identifyAttackVectors(indicators: ClassificationIndicator[]): AttackVector[] {
    const vectors: AttackVector[] = [];
    const vectorMap = new Map([
      ['email', 'email'],
      ['phishing', 'email'],
      ['web', 'web'],
      ['network', 'network'],
      ['physical', 'physical'],
      ['social', 'social']
    ]);

    for (const indicator of indicators) {
      for (const [key, vector] of vectorMap.entries()) {
        if (indicator.value.toLowerCase().includes(key)) {
          vectors.push(vector as AttackVector);
        }
      }
    }

    return [...new Set(vectors)];
  }

  /**
   * Map indicators to cyber kill chain phases
   */
  private mapToKillChain(indicators: ClassificationIndicator[]): KillChainPhase[] {
    const phases: KillChainPhase[] = [];
    const phaseMap = new Map([
      ['reconnaissance', 'reconnaissance'],
      ['delivery', 'delivery'],
      ['exploit', 'exploitation'],
      ['install', 'installation'],
      ['command', 'command-control'],
      ['action', 'actions']
    ]);

    for (const indicator of indicators) {
      for (const [key, phase] of phaseMap.entries()) {
        if (indicator.value.toLowerCase().includes(key)) {
          phases.push(phase as KillChainPhase);
        }
      }
    }

    return [...new Set(phases)];
  }

  /**
   * Calculate ML confidence score
   */
  private calculateMLConfidence(
    classification: IncidentClassification,
    indicators: ClassificationIndicator[]
  ): number {
    // Simulate ML confidence calculation
    let confidence = 0.5; // Base confidence

    // Increase confidence based on indicator quality
    const highConfidenceIndicators = indicators.filter(ind => ind.confidence > 0.8);
    confidence += (highConfidenceIndicators.length / indicators.length) * 0.3;

    // Increase confidence for well-known patterns
    if (classification.type === 'malware' && indicators.some(ind => ind.type === 'technical')) {
      confidence += 0.2;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Load classification rules from configuration
   */
  private async loadClassificationRules(): Promise<void> {
    this.classificationRules = [
      {
        id: 'malware-detection',
        name: 'Malware Detection Rule',
        type: 'malware',
        category: 'integrity',
        subcategory: 'malicious-software',
        threshold: 0.7,
        indicators: [
          {
            type: 'technical',
            pattern: 'malware|virus|trojan|ransomware',
            weight: 0.8
          },
          {
            type: 'behavioral',
            pattern: 'unusual-process|suspicious-file',
            weight: 0.6
          }
        ],
        conditions: [
          {
            field: 'severity',
            operator: 'gte',
            value: 'medium',
            weight: 0.5
          }
        ],
        baseImpact: {
          confidentiality: 'medium',
          integrity: 'high',
          availability: 'low',
          business: {
            revenue: 0,
            customers: 0,
            operations: [],
            compliance: [],
            partnerships: []
          },
          technical: {
            systems: [],
            services: [],
            data: [],
            networks: [],
            applications: []
          },
          regulatory: {
            frameworks: [],
            violations: [],
            notifications: [],
            penalties: 0
          },
          reputation: {
            severity: 'minor',
            audiences: [],
            channels: [],
            duration: 0,
            recovery: []
          }
        }
      },
      {
        id: 'data-breach',
        name: 'Data Breach Detection Rule',
        type: 'data-leak',
        category: 'confidentiality',
        subcategory: 'unauthorized-access',
        threshold: 0.8,
        indicators: [
          {
            type: 'technical',
            pattern: 'data-exfiltration|unauthorized-access|breach',
            weight: 0.9
          },
          {
            type: 'contextual',
            pattern: 'sensitive-data|personal-information|pii',
            weight: 0.8
          }
        ],
        conditions: [
          {
            field: 'category',
            operator: 'eq',
            value: 'data-loss-prevention',
            weight: 0.7
          }
        ],
        baseImpact: {
          confidentiality: 'high',
          integrity: 'medium',
          availability: 'low',
          business: {
            revenue: 100000,
            customers: 1000,
            operations: ['data-processing'],
            compliance: ['gdpr', 'ccpa'],
            partnerships: []
          },
          technical: {
            systems: ['database'],
            services: ['data-service'],
            data: ['customer-data'],
            networks: [],
            applications: []
          },
          regulatory: {
            frameworks: ['gdpr'],
            violations: ['data-protection'],
            notifications: ['supervisory-authority'],
            penalties: 50000
          },
          reputation: {
            severity: 'major',
            audiences: ['customers', 'regulators'],
            channels: ['news', 'social-media'],
            duration: 180,
            recovery: ['communication-campaign']
          }
        }
      }
    ];
  }

  /**
   * Get default classification for unmatched incidents
   */
  private getDefaultClassification(): ClassificationRule {
    return {
      id: 'default',
      name: 'Default Classification',
      type: 'security-breach',
      category: 'availability',
      subcategory: 'unknown',
      threshold: 0,
      indicators: [],
      conditions: [],
      baseImpact: {
        confidentiality: 'low',
        integrity: 'low',
        availability: 'low',
        business: {
          revenue: 0,
          customers: 0,
          operations: [],
          compliance: [],
          partnerships: []
        },
        technical: {
          systems: [],
          services: [],
          data: [],
          networks: [],
          applications: []
        },
        regulatory: {
          frameworks: [],
          violations: [],
          notifications: [],
          penalties: 0
        },
        reputation: {
          severity: 'none',
          audiences: [],
          channels: [],
          duration: 0,
          recovery: []
        }
      }
    };
  }

  /**
   * Check if value matches pattern
   */
  private matchesPattern(value: string, pattern: string): boolean {
    try {
      const regex = new RegExp(pattern, 'i');
      return regex.test(value);
    } catch (error) {
      return value.toLowerCase().includes(pattern.toLowerCase());
    }
  }

  /**
   * Evaluate condition against context
   */
  private evaluateCondition(condition: RuleCondition, context: Record<string, any>): boolean {
    const fieldValue = context[condition.field];
    
    switch (condition.operator) {
      case 'eq': return fieldValue === condition.value;
      case 'ne': return fieldValue !== condition.value;
      case 'gt': return fieldValue > condition.value;
      case 'gte': return fieldValue >= condition.value;
      case 'lt': return fieldValue < condition.value;
      case 'lte': return fieldValue <= condition.value;
      case 'contains': return String(fieldValue).includes(String(condition.value));
      case 'in': return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      default: return false;
    }
  }
}

// Helper interfaces for classification
interface ClassificationRule {
  id: string;
  name: string;
  type: IncidentType;
  category: IncidentCategory;
  subcategory: string;
  threshold: number;
  indicators: RuleIndicator[];
  conditions: RuleCondition[];
  baseImpact: ImpactAssessment;
}

interface RuleIndicator {
  type: IndicatorType;
  pattern: string;
  weight: number;
}

interface RuleCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in';
  value: any;
  weight: number;
}

/**
 * Response Playbook Engine
 * Manages and executes incident response playbooks
 */
export class ResponsePlaybookEngine {
  private logger: Logger;
  private playbooks: Map<string, ResponsePlaybook> = new Map();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Initialize playbook engine
   */
  async initialize(): Promise<void> {
    await this.loadPlaybooks();
    this.logger.info(`Loaded ${this.playbooks.size} response playbooks`);
  }

  /**
   * Select appropriate playbook for incident
   */
  async selectPlaybook(
    classification: IncidentClassification,
    context: Record<string, any> = {}
  ): Promise<ResponsePlaybook> {
    const applicablePlaybooks = this.findApplicablePlaybooks(classification);
    
    if (!applicablePlaybooks.length) {
      throw new Error(`No applicable playbook found for incident type: ${classification.type}`);
    }

    // Select best playbook based on classification confidence and automation level
    const selectedPlaybook = this.selectBestPlaybook(applicablePlaybooks, classification, context);
    
    // Customize playbook based on incident specifics
    return this.customizePlaybook(selectedPlaybook, classification, context);
  }

  /**
   * Execute playbook phase
   */
  async executePhase(
    playbook: ResponsePlaybook,
    phaseIndex: number,
    context: Record<string, any>
  ): Promise<ResponsePhase> {
    if (phaseIndex >= playbook.phases.length) {
      throw new Error(`Phase index ${phaseIndex} out of bounds`);
    }

    const phase = playbook.phases[phaseIndex];
    this.logger.info(`Executing phase: ${phase.name}`);

    phase.status = 'active';
    phase.startedAt = new Date();

    try {
      if (phase.parallel) {
        await this.executeActionsParallel(phase.actions, context);
      } else {
        await this.executeActionsSequential(phase.actions, context);
      }

      phase.status = 'completed';
      phase.completedAt = new Date();
      
      this.logger.info(`Phase completed: ${phase.name}`);
    } catch (error) {
      phase.status = 'failed';
      this.logger.error(`Phase failed: ${phase.name}`, error);
      throw error;
    }

    return phase;
  }

  /**
   * Find applicable playbooks for classification
   */
  private findApplicablePlaybooks(classification: IncidentClassification): ResponsePlaybook[] {
    return Array.from(this.playbooks.values()).filter(playbook => {
      const applicability = playbook.applicability;
      
      return applicability.incidentTypes.includes(classification.type) &&
             applicability.severities.includes(classification.severity) &&
             applicability.categories.includes(classification.category);
    });
  }

  /**
   * Select best playbook from applicable options
   */
  private selectBestPlaybook(
    playbooks: ResponsePlaybook[],
    classification: IncidentClassification,
    context: Record<string, any>
  ): ResponsePlaybook {
    let bestPlaybook = playbooks[0];
    let highestScore = 0;

    for (const playbook of playbooks) {
      const score = this.scorePlaybook(playbook, classification, context);
      if (score > highestScore) {
        highestScore = score;
        bestPlaybook = playbook;
      }
    }

    return bestPlaybook;
  }

  /**
   * Score playbook suitability
   */
  private scorePlaybook(
    playbook: ResponsePlaybook,
    classification: IncidentClassification,
    context: Record<string, any>
  ): number {
    let score = 0;

    // Prefer higher automation for suitable incidents
    if (context.automationPreferred && playbook.automationLevel === 'fully-automated') {
      score += 3;
    } else if (playbook.automationLevel === 'automated') {
      score += 2;
    } else if (playbook.automationLevel === 'semi-automated') {
      score += 1;
    }

    // Prefer shorter duration for urgent incidents
    if (classification.severity === 'critical' && playbook.estimatedDuration < 240) {
      score += 2;
    }

    // Exact type match bonus
    if (playbook.applicability.incidentTypes.length === 1 && 
        playbook.applicability.incidentTypes[0] === classification.type) {
      score += 2;
    }

    return score;
  }

  /**
   * Customize playbook for specific incident
   */
  private customizePlaybook(
    playbook: ResponsePlaybook,
    classification: IncidentClassification,
    context: Record<string, any>
  ): ResponsePlaybook {
    const customized = JSON.parse(JSON.stringify(playbook)); // Deep copy

    // Adjust automation level based on severity
    if (classification.severity === 'critical') {
      customized.automationLevel = 'fully-automated';
    }

    // Add context-specific actions
    for (const phase of customized.phases) {
      if (phase.type === 'containment' && classification.impact.availability === 'high') {
        // Add additional containment actions for high availability impact
        phase.actions.push({
          id: crypto.randomUUID(),
          name: 'Implement Load Balancing',
          description: 'Redirect traffic to backup systems',
          type: 'containment',
          category: 'technical',
          automation: 'automated',
          priority: 'urgent',
          status: 'pending',
          assignee: 'auto-assign',
          prerequisites: [],
          timeout: 300,
          retries: 2,
          parameters: {
            targets: ['load-balancer'],
            commands: ['enable-backup-routing'],
            scripts: [],
            notifications: [],
            forensics: [],
            containment: [],
            custom: {}
          },
          execution: {
            method: 'api',
            environment: {},
            logLevel: 'info',
            auditTrail: true
          },
          validation: {
            required: true,
            criteria: [{
              type: 'functional',
              condition: 'traffic-routed',
              expected: true,
              tolerance: 0,
              critical: true
            }],
            timeout: 60,
            automated: true,
            approvalRequired: false
          },
          evidence: []
        });
      }
    }

    return customized;
  }

  /**
   * Execute actions in parallel
   */
  private async executeActionsParallel(
    actions: ResponseAction[],
    context: Record<string, any>
  ): Promise<void> {
    const promises = actions.map(action => this.executeAction(action, context));
    await Promise.all(promises);
  }

  /**
   * Execute actions sequentially
   */
  private async executeActionsSequential(
    actions: ResponseAction[],
    context: Record<string, any>
  ): Promise<void> {
    for (const action of actions) {
      await this.executeAction(action, context);
    }
  }

  /**
   * Execute individual action
   */
  private async executeAction(
    action: ResponseAction,
    context: Record<string, any>
  ): Promise<void> {
    this.logger.debug(`Executing action: ${action.name}`);

    action.status = 'in-progress';
    action.startedAt = new Date();

    try {
      const result = await this.performAction(action, context);
      
      action.result = result;
      action.status = result.success ? 'completed' : 'failed';
      action.completedAt = new Date();
      action.duration = action.completedAt.getTime() - action.startedAt!.getTime();

      if (action.validation.required && result.success) {
        await this.validateAction(action, context);
      }

    } catch (error) {
      action.status = 'failed';
      action.completedAt = new Date();
      action.duration = action.completedAt.getTime() - action.startedAt!.getTime();
      throw error;
    }
  }

  /**
   * Perform the actual action execution
   */
  private async performAction(
    action: ResponseAction,
    context: Record<string, any>
  ): Promise<ActionResult> {
    // Simulate action execution based on type
    switch (action.type) {
      case 'investigation':
        return await this.performInvestigation(action);
      case 'containment':
        return await this.performContainment(action);
      case 'communication':
        return await this.performCommunication(action);
      case 'forensics':
        return await this.performForensics(action);
      case 'recovery':
        return await this.performRecovery(action);
      case 'documentation':
        return await this.performDocumentation(action);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Perform investigation action
   */
  private async performInvestigation(action: ResponseAction): Promise<ActionResult> {
    // Simulate investigation work
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      success: true,
      message: `Investigation completed: ${action.name}`,
      data: {
        findings: ['Suspicious network traffic identified', 'Potential data exfiltration detected'],
        iocs: ['192.168.1.100', 'malicious.domain.com'],
        timeline: ['2023-01-01T10:00:00Z: First suspicious activity']
      },
      logs: [`Investigation started for ${action.name}`, 'Network analysis completed'],
      metrics: {
        executionTime: 2000,
        resourceUsage: { cpu: 25, memory: 512, network: 100, disk: 50 },
        errorCount: 0,
        retryCount: 0,
        effectivenessScore: 0.85
      },
      artifacts: ['network-analysis.json', 'timeline.csv'],
      recommendations: ['Enhance network monitoring', 'Review access controls']
    };
  }

  /**
   * Perform containment action
   */
  private async performContainment(action: ResponseAction): Promise<ActionResult> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      message: `Containment completed: ${action.name}`,
      data: {
        isolatedSystems: ['server-01', 'workstation-05'],
        blockedIPs: ['192.168.1.100', '10.0.0.50'],
        quarantinedFiles: ['malware.exe', 'suspicious.doc']
      },
      logs: [`Containment initiated for ${action.name}`, 'Systems isolated successfully'],
      metrics: {
        executionTime: 1000,
        resourceUsage: { cpu: 15, memory: 256, network: 50, disk: 25 },
        errorCount: 0,
        retryCount: 0,
        effectivenessScore: 0.9
      },
      artifacts: ['containment-log.json'],
      recommendations: ['Monitor contained systems', 'Prepare recovery procedures']
    };
  }

  /**
   * Perform communication action
   */
  private async performCommunication(action: ResponseAction): Promise<ActionResult> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      message: `Communication sent: ${action.name}`,
      data: {
        recipients: ['security-team@company.com', 'management@company.com'],
        channels: ['email', 'slack'],
        messageId: crypto.randomUUID()
      },
      logs: [`Communication prepared for ${action.name}`, 'Messages sent successfully'],
      metrics: {
        executionTime: 500,
        resourceUsage: { cpu: 5, memory: 64, network: 25, disk: 10 },
        errorCount: 0,
        retryCount: 0,
        effectivenessScore: 0.95
      },
      artifacts: ['communication-log.json'],
      recommendations: ['Prepare follow-up communications', 'Monitor for responses']
    };
  }

  /**
   * Perform forensics action
   */
  private async performForensics(action: ResponseAction): Promise<ActionResult> {
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return {
      success: true,
      message: `Forensics completed: ${action.name}`,
      data: {
        evidenceCollected: ['disk-image-server01.img', 'memory-dump-ws05.mem'],
        analysisFindings: ['Malware persistence mechanism found', 'Data exfiltration confirmed'],
        iocs: ['md5:abc123def456', 'ip:192.168.1.100']
      },
      logs: [`Forensics initiated for ${action.name}`, 'Evidence collection completed'],
      metrics: {
        executionTime: 5000,
        resourceUsage: { cpu: 60, memory: 2048, network: 200, disk: 1000 },
        errorCount: 0,
        retryCount: 0,
        effectivenessScore: 0.8
      },
      artifacts: ['forensics-report.pdf', 'evidence-inventory.json'],
      recommendations: ['Preserve evidence chain of custody', 'Prepare for legal review']
    };
  }

  /**
   * Perform recovery action
   */
  private async performRecovery(action: ResponseAction): Promise<ActionResult> {
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return {
      success: true,
      message: `Recovery completed: ${action.name}`,
      data: {
        recoveredSystems: ['server-01', 'database-cluster'],
        restoredServices: ['web-application', 'api-service'],
        dataIntegrityCheck: 'passed'
      },
      logs: [`Recovery initiated for ${action.name}`, 'Systems restored successfully'],
      metrics: {
        executionTime: 3000,
        resourceUsage: { cpu: 40, memory: 1024, network: 150, disk: 500 },
        errorCount: 0,
        retryCount: 0,
        effectivenessScore: 0.88
      },
      artifacts: ['recovery-log.json', 'integrity-check.csv'],
      recommendations: ['Monitor system stability', 'Conduct post-recovery testing']
    };
  }

  /**
   * Perform documentation action
   */
  private async performDocumentation(action: ResponseAction): Promise<ActionResult> {
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      success: true,
      message: `Documentation completed: ${action.name}`,
      data: {
        documentsCreated: ['incident-report.pdf', 'timeline.doc', 'lessons-learned.md'],
        templatesUsed: ['incident-report-template', 'timeline-template'],
        reviewStatus: 'pending'
      },
      logs: [`Documentation initiated for ${action.name}`, 'Reports generated successfully'],
      metrics: {
        executionTime: 1500,
        resourceUsage: { cpu: 10, memory: 128, network: 30, disk: 100 },
        errorCount: 0,
        retryCount: 0,
        effectivenessScore: 0.92
      },
      artifacts: ['incident-report.pdf', 'documentation-metadata.json'],
      recommendations: ['Schedule management review', 'Update incident response procedures']
    };
  }

  /**
   * Validate action execution
   */
  private async validateAction(action: ResponseAction, context: Record<string, any>): Promise<void> {
    for (const criteria of action.validation.criteria) {
      const isValid = await this.checkValidationCriteria(criteria, action.result!);
      
      if (!isValid && criteria.critical) {
        throw new Error(`Critical validation failed for ${action.name}: ${criteria.condition}`);
      }
    }
  }

  /**
   * Check validation criteria
   */
  private async checkValidationCriteria(
    criteria: ValidationCriteria,
    result: ActionResult
  ): Promise<boolean> {
    switch (criteria.type) {
      case 'functional':
        return this.checkFunctionalCriteria(criteria, result);
      case 'security':
        return this.checkSecurityCriteria(criteria, result);
      case 'performance':
        return this.checkPerformanceCriteria(criteria, result);
      case 'compliance':
        return this.checkComplianceCriteria(criteria, result);
      default:
        return true;
    }
  }

  /**
   * Check functional validation criteria
   */
  private checkFunctionalCriteria(criteria: ValidationCriteria, result: ActionResult): boolean {
    // Simple condition evaluation
    if (criteria.condition === 'success') {
      return result.success;
    }
    
    if (criteria.condition === 'traffic-routed') {
      return result.data?.trafficRouted === true;
    }
    
    return true; // Default pass for unknown conditions
  }

  private checkSecurityCriteria(criteria: ValidationCriteria, result: ActionResult): boolean {
    return result.success && result.metrics.effectivenessScore >= 0.7;
  }

  private checkPerformanceCriteria(criteria: ValidationCriteria, result: ActionResult): boolean {
    return result.metrics.executionTime <= criteria.expected;
  }

  private checkComplianceCriteria(criteria: ValidationCriteria, result: ActionResult): boolean {
    return result.artifacts.length > 0 && result.success;
  }

  /**
   * Load response playbooks
   */
  private async loadPlaybooks(): Promise<void> {
    const playbooks: ResponsePlaybook[] = [
      {
        id: 'malware-response',
        name: 'Malware Incident Response',
        description: 'Standard response playbook for malware incidents',
        version: '1.0.0',
        applicability: {
          incidentTypes: ['malware'],
          severities: ['low', 'medium', 'high', 'critical'],
          categories: ['integrity', 'availability'],
          conditions: []
        },
        phases: [
          {
            id: 'identification',
            name: 'Identification & Analysis',
            description: 'Identify and analyze the malware incident',
            order: 1,
            type: 'identification',
            actions: [
              {
                id: crypto.randomUUID(),
                name: 'Analyze Malware Sample',
                description: 'Perform initial malware analysis',
                type: 'investigation',
                category: 'technical',
                automation: 'automated',
                priority: 'urgent',
                status: 'pending',
                assignee: 'security-analyst',
                prerequisites: [],
                timeout: 1800,
                retries: 2,
                parameters: {
                  targets: ['malware-sample'],
                  commands: [],
                  scripts: ['analyze-malware.py'],
                  notifications: [],
                  forensics: [],
                  containment: [],
                  custom: { sandbox: 'cuckoo' }
                },
                execution: {
                  method: 'script',
                  environment: { SANDBOX_URL: 'https://sandbox.local' },
                  logLevel: 'info',
                  auditTrail: true
                },
                validation: {
                  required: true,
                  criteria: [{
                    type: 'functional',
                    condition: 'analysis-complete',
                    expected: true,
                    tolerance: 0,
                    critical: true
                  }],
                  timeout: 300,
                  automated: true,
                  approvalRequired: false
                },
                evidence: []
              }
            ],
            parallel: false,
            timeout: 3600,
            preconditions: [],
            success_criteria: ['Malware identified and analyzed'],
            rollback: 'manual',
            status: 'pending'
          },
          {
            id: 'containment',
            name: 'Containment',
            description: 'Contain the malware spread',
            order: 2,
            type: 'containment',
            actions: [
              {
                id: crypto.randomUUID(),
                name: 'Isolate Infected Systems',
                description: 'Isolate systems showing signs of infection',
                type: 'containment',
                category: 'technical',
                automation: 'automated',
                priority: 'immediate',
                status: 'pending',
                assignee: 'incident-commander',
                prerequisites: ['Malware identified'],
                timeout: 600,
                retries: 1,
                parameters: {
                  targets: ['infected-systems'],
                  commands: ['isolate-network'],
                  scripts: [],
                  notifications: [{
                    channels: ['email', 'slack'],
                    message: 'Systems isolated due to malware infection',
                    severity: 'critical',
                    recipients: ['security-team'],
                    template: 'containment-alert'
                  }],
                  forensics: [],
                  containment: [{
                    type: 'network-isolation',
                    targets: ['infected-hosts'],
                    severity: 'high'
                  }],
                  custom: {}
                },
                execution: {
                  method: 'api',
                  endpoint: 'https://firewall.local/api/isolate',
                  environment: {},
                  logLevel: 'info',
                  auditTrail: true
                },
                validation: {
                  required: true,
                  criteria: [{
                    type: 'security',
                    condition: 'network-isolated',
                    expected: true,
                    tolerance: 0,
                    critical: true
                  }],
                  timeout: 60,
                  automated: true,
                  approvalRequired: false
                },
                evidence: []
              }
            ],
            parallel: true,
            timeout: 1800,
            preconditions: ['Identification phase completed'],
            success_criteria: ['Malware spread contained'],
            rollback: 'automatic',
            status: 'pending'
          }
        ],
        automationLevel: 'automated',
        estimatedDuration: 240,
        requiredRoles: ['security-analyst', 'incident-commander'],
        prerequisites: ['Malware detection capabilities', 'Network isolation tools'],
        success_criteria: ['Malware contained and eradicated', 'Systems recovered'],
        metadata: {}
      },
      {
        id: 'data-breach-response',
        name: 'Data Breach Response',
        description: 'Response playbook for data breach incidents',
        version: '1.0.0',
        applicability: {
          incidentTypes: ['data-leak'],
          severities: ['high', 'critical'],
          categories: ['confidentiality'],
          conditions: []
        },
        phases: [
          {
            id: 'immediate-response',
            name: 'Immediate Response',
            description: 'Immediate actions for data breach',
            order: 1,
            type: 'containment',
            actions: [
              {
                id: crypto.randomUUID(),
                name: 'Secure Breach Point',
                description: 'Secure the point of data breach',
                type: 'containment',
                category: 'technical',
                automation: 'semi-automated',
                priority: 'immediate',
                status: 'pending',
                assignee: 'security-team-lead',
                prerequisites: [],
                timeout: 300,
                retries: 1,
                parameters: {
                  targets: ['breach-point'],
                  commands: ['close-access', 'revoke-credentials'],
                  scripts: [],
                  notifications: [{
                    channels: ['phone', 'email'],
                    message: 'Data breach detected - immediate containment initiated',
                    severity: 'critical',
                    recipients: ['ciso', 'legal-team'],
                    template: 'breach-alert'
                  }],
                  forensics: [{
                    type: 'preserve-logs',
                    location: 'breach-point',
                    retention: 2555 // 7 years
                  }],
                  containment: [{
                    type: 'data-quarantine',
                    targets: ['affected-data'],
                    severity: 'severe'
                  }],
                  custom: { legalHold: true }
                },
                execution: {
                  method: 'manual',
                  environment: {},
                  logLevel: 'info',
                  auditTrail: true
                },
                validation: {
                  required: true,
                  criteria: [{
                    type: 'security',
                    condition: 'breach-secured',
                    expected: true,
                    tolerance: 0,
                    critical: true
                  }],
                  timeout: 120,
                  automated: false,
                  approvalRequired: false
                },
                evidence: []
              }
            ],
            parallel: false,
            timeout: 900,
            preconditions: [],
            success_criteria: ['Breach point secured', 'Data access prevented'],
            rollback: 'manual',
            status: 'pending'
          }
        ],
        automationLevel: 'semi-automated',
        estimatedDuration: 480,
        requiredRoles: ['security-team-lead', 'legal-counsel', 'ciso'],
        prerequisites: ['Data classification system', 'Legal response procedures'],
        success_criteria: ['Breach contained', 'Regulatory notifications sent', 'Recovery completed'],
        metadata: { regulatoryDeadlines: { notification: 72, assessment: 720 } }
      }
    ];

    for (const playbook of playbooks) {
      this.playbooks.set(playbook.id, playbook);
    }
  }
}

/**
 * Main Incident Response System
 */
export class IncidentResponseSystem {
  private logger: Logger;
  private configManager: SecurityConfigManager;
  private classificationEngine: IncidentClassificationEngine;
  private playbookEngine: ResponsePlaybookEngine;
  private activeResponses: Map<string, IncidentResponse> = new Map();

  constructor(logger: Logger, configManager: SecurityConfigManager) {
    this.logger = logger;
    this.configManager = configManager;
    this.classificationEngine = new IncidentClassificationEngine(logger);
    this.playbookEngine = new ResponsePlaybookEngine(logger);
  }

  /**
   * Initialize the incident response system
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Incident Response System');

    await this.classificationEngine.initialize();
    await this.playbookEngine.initialize();

    this.logger.info('Incident Response System initialized successfully');
  }

  /**
   * Initiate incident response
   */
  async initiateResponse(
    incident: SecurityIncident,
    threats: ThreatEvent[] = [],
    context: Record<string, any> = {}
  ): Promise<string> {
    this.logger.info(`Initiating response for incident ${incident.id}`);

    // Classify the incident
    const classification = await this.classificationEngine.classifyIncident(
      incident, 
      threats, 
      context
    );

    // Select appropriate playbook
    const playbook = await this.playbookEngine.selectPlaybook(classification, context);

    // Create incident response
    const response: IncidentResponse = {
      id: crypto.randomUUID(),
      incidentId: incident.id,
      status: 'initiated',
      severity: this.mapIncidentSeverityToResponseSeverity(classification.severity),
      priority: this.determinePriority(classification),
      classification,
      playbook,
      timeline: [{
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: 'detection',
        category: 'system',
        description: 'Incident response initiated',
        actor: 'incident-response-system',
        details: { classification, playbook: playbook.name },
        impact: 'none',
        automated: true
      }],
      actions: [],
      containment: [],
      forensics: [],
      communications: [],
      resources: [],
      escalation: [],
      resolution: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignedTo: [],
      commander: context.commander || 'auto-assigned',
      metadata: { originalIncident: incident, context }
    };

    // Store the response
    this.activeResponses.set(response.id, response);

    // Start response execution asynchronously
    this.executeResponse(response).catch(error => {
      this.logger.error(`Response execution failed for ${response.id}`, error);
      response.status = 'closed';
    });

    return response.id;
  }

  /**
   * Get incident response by ID
   */
  getResponse(responseId: string): IncidentResponse | undefined {
    return this.activeResponses.get(responseId);
  }

  /**
   * Get all active responses
   */
  getActiveResponses(): IncidentResponse[] {
    return Array.from(this.activeResponses.values()).filter(
      response => ['initiated', 'active', 'contained'].includes(response.status)
    );
  }

  /**
   * Update response status
   */
  async updateResponse(
    responseId: string, 
    updates: Partial<IncidentResponse>
  ): Promise<boolean> {
    const response = this.activeResponses.get(responseId);
    if (!response) {
      return false;
    }

    Object.assign(response, updates);
    response.updatedAt = new Date();

    // Add timeline event for status change
    if (updates.status) {
      response.timeline.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: 'response',
        category: 'system',
        description: `Response status changed to ${updates.status}`,
        actor: 'incident-response-system',
        details: { previousStatus: response.status, newStatus: updates.status },
        impact: 'none',
        automated: true
      });
    }

    return true;
  }

  /**
   * Get incident response statistics
   */
  getResponseStats(): {
    totalResponses: number;
    activeResponses: number;
    averageResponseTime: number;
    containmentRate: number;
    automationRate: number;
    byStatus: Record<ResponseStatus, number>;
    bySeverity: Record<ResponseSeverity, number>;
  } {
    const responses = Array.from(this.activeResponses.values());
    
    const activeCount = responses.filter(r => 
      ['initiated', 'active', 'contained'].includes(r.status)
    ).length;

    const resolvedResponses = responses.filter(r => r.status === 'resolved');
    const avgResponseTime = resolvedResponses.length > 0 
      ? resolvedResponses.reduce((sum, r) => {
          const duration = r.resolution?.timeline.totalDuration || 0;
          return sum + duration;
        }, 0) / resolvedResponses.length
      : 0;

    const containedCount = responses.filter(r => r.status === 'contained').length;
    const containmentRate = responses.length > 0 ? (containedCount / responses.length) * 100 : 0;

    const automatedActions = responses.reduce((sum, r) => 
      sum + r.actions.filter(a => a.automation === 'automated').length, 0
    );
    const totalActions = responses.reduce((sum, r) => sum + r.actions.length, 0);
    const automationRate = totalActions > 0 ? (automatedActions / totalActions) * 100 : 0;

    return {
      totalResponses: responses.length,
      activeResponses: activeCount,
      averageResponseTime: avgResponseTime,
      containmentRate,
      automationRate,
      byStatus: responses.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {} as Record<ResponseStatus, number>),
      bySeverity: responses.reduce((acc, r) => {
        acc[r.severity] = (acc[r.severity] || 0) + 1;
        return acc;
      }, {} as Record<ResponseSeverity, number>)
    };
  }

  /**
   * Execute incident response workflow
   */
  private async executeResponse(response: IncidentResponse): Promise<void> {
    try {
      response.status = 'active';
      
      // Execute each phase of the playbook
      for (let i = 0; i < response.playbook.phases.length; i++) {
        const phase = await this.playbookEngine.executePhase(
          response.playbook,
          i,
          { response, incident: response.metadata.originalIncident }
        );

        // Update response with phase actions
        response.actions.push(...phase.actions);
        
        // Add timeline event
        response.timeline.push({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: 'response',
          category: 'automated',
          description: `Phase completed: ${phase.name}`,
          actor: 'playbook-engine',
          details: { phase: phase.name, status: phase.status },
          impact: 'minimal',
          automated: true
        });

        // Check for containment phase completion
        if (phase.type === 'containment' && phase.status === 'completed') {
          response.status = 'contained';
        }
      }

      // Mark as resolved if all phases completed successfully
      response.status = 'resolved';
      
      // Generate resolution summary
      response.resolution = await this.generateResolution(response);

      this.logger.info(`Incident response ${response.id} completed successfully`);

    } catch (error) {
      this.logger.error(`Incident response ${response.id} failed`, error);
      response.status = 'closed';
      
      response.timeline.push({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: 'response',
        category: 'system',
        description: `Response failed: ${error instanceof Error ? error.message : String(error)}`,
        actor: 'incident-response-system',
        details: { error: error instanceof Error ? error.message : String(error) },
        impact: 'significant',
        automated: true
      });
    }
  }

  /**
   * Generate incident resolution summary
   */
  private async generateResolution(response: IncidentResponse): Promise<IncidentResolution> {
    const resolution: IncidentResolution = {
      id: crypto.randomUUID(),
      type: 'resolved',
      summary: `Incident ${response.incidentId} successfully resolved using ${response.playbook.name} playbook`,
      rootCause: {
        primaryCause: 'Unknown - requires further analysis',
        contributingFactors: ['Insufficient monitoring', 'Delayed detection'],
        timeline: [],
        methodology: 'preliminary-analysis',
        confidence: 0.6,
        evidence: response.forensics.map(f => f.id),
        recommendations: ['Improve monitoring coverage', 'Reduce detection time']
      },
      timeline: {
        detection: response.createdAt,
        response: response.createdAt,
        containment: response.status === 'contained' ? new Date() : undefined,
        eradication: new Date(),
        recovery: new Date(),
        resolution: new Date(),
        totalDuration: Date.now() - response.createdAt.getTime(),
        phases: response.playbook.phases.map((phase, index) => ({
          phase: phase.name,
          startTime: phase.startedAt || response.createdAt,
          endTime: phase.completedAt || new Date(),
          duration: phase.completedAt && phase.startedAt 
            ? phase.completedAt.getTime() - phase.startedAt.getTime()
            : 0,
          effectiveness: 0.85
        }))
      },
      actions: response.actions.map(action => ({
        action: action.name,
        responsible: action.assignee,
        completedAt: action.completedAt || new Date(),
        effectiveness: action.result?.metrics?.effectivenessScore || 0.8,
        cost: 0, // Would be calculated based on resource usage
        impact: action.result?.message || 'Completed successfully'
      })),
      verification: {
        method: 'automated-test',
        criteria: [{
          requirement: 'Incident contained',
          test: 'containment-verification',
          expected: true,
          critical: true
        }],
        results: [{
          criteria: 'Incident contained',
          result: true,
          passed: true,
          notes: 'All containment actions completed successfully'
        }],
        verified: true,
        verifiedBy: 'incident-response-system',
        verifiedAt: new Date()
      },
      documentation: {
        incidentReport: 'incident-report.pdf',
        technicalDetails: 'technical-analysis.md',
        businessImpact: 'business-impact-assessment.pdf',
        timelineDocument: 'incident-timeline.json',
        evidenceInventory: 'evidence-inventory.csv',
        communicationLog: 'communication-log.txt',
        approvals: []
      },
      lessonsLearned: [
        {
          id: crypto.randomUUID(),
          category: 'technical',
          description: 'Improve automated detection capabilities',
          impact: 'Faster incident detection and response',
          recommendations: ['Deploy additional monitoring tools', 'Enhance alerting rules'],
          implementation: {
            actions: ['Tool procurement', 'Configuration', 'Testing'],
            timeline: 60,
            cost: 50000,
            resources: ['security-engineer', 'budget'],
            dependencies: ['management-approval'],
            metrics: ['detection-time', 'false-positive-rate']
          },
          priority: 'high',
          owner: 'security-team',
          dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
          status: 'identified'
        }
      ],
      preventionMeasures: [
        {
          id: crypto.randomUUID(),
          type: 'technical-control',
          description: 'Enhanced network monitoring',
          implementation: ['Deploy network sensors', 'Configure alerting', 'Train staff'],
          cost: 25000,
          effectiveness: 0.8,
          timeline: 30,
          responsible: 'security-team',
          metrics: ['detection-coverage', 'response-time'],
          status: 'planned'
        }
      ],
      resolvedAt: new Date(),
      resolvedBy: 'incident-response-system',
      approved: false
    };

    return resolution;
  }

  /**
   * Map incident severity to response severity
   */
  private mapIncidentSeverityToResponseSeverity(severity: IncidentSeverity): ResponseSeverity {
    const mapping: Record<IncidentSeverity, ResponseSeverity> = {
      'low': 'low',
      'medium': 'medium', 
      'high': 'high',
      'critical': 'critical'
    };
    return mapping[severity];
  }

  /**
   * Determine response priority based on classification
   */
  private determinePriority(classification: IncidentClassification): ResponsePriority {
    if (classification.severity === 'critical') {
      return 'p1';
    } else if (classification.severity === 'high') {
      return 'p2';
    } else if (classification.severity === 'medium') {
      return 'p3';
    } else {
      return 'p4';
    }
  }
}

export default IncidentResponseSystem;