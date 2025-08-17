/**
 * Incident Response and Security Orchestration, Automation, and Response (SOAR) System
 * 
 * Enterprise-grade incident response platform with automated playbooks,
 * orchestration capabilities, and comprehensive incident management.
 * 
 * Features:
 * - Automated incident detection and classification
 * - Playbook-driven response workflows
 * - Security orchestration across multiple tools
 * - Automated containment and remediation
 * - Forensic evidence collection
 * - Incident timeline reconstruction
 * - Threat intelligence integration
 * - Post-incident analysis and reporting
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { Logger } from 'winston';

// ==================== Core Types ====================

export interface IncidentResponseConfig {
  detection: DetectionConfig;
  classification: ClassificationConfig;
  response: ResponseConfig;
  orchestration: OrchestrationConfig;
  forensics: ForensicsConfig;
  reporting: ReportingConfig;
}

export interface SecurityIncident {
  id: string;
  title: string;
  description: string;
  type: IncidentType;
  severity: IncidentSeverity;
  priority: IncidentPriority;
  status: IncidentStatus;
  phase: IncidentPhase;
  source: IncidentSource;
  detectedAt: Date;
  acknowledgedAt?: Date;
  containedAt?: Date;
  eradicatedAt?: Date;
  recoveredAt?: Date;
  closedAt?: Date;
  
  // Attack Information
  attackVector?: AttackVector;
  threatActor?: ThreatActor;
  ttps: TTP[]; // Tactics, Techniques, and Procedures
  indicators: IOC[]; // Indicators of Compromise
  
  // Impact Assessment
  impact: ImpactAssessment;
  affectedAssets: AffectedAsset[];
  dataExposure?: DataExposure;
  
  // Response Information
  responseTeam: ResponseTeam;
  playbook?: Playbook;
  actions: ResponseAction[];
  containment: ContainmentStrategy;
  
  // Evidence and Forensics
  evidence: ForensicEvidence[];
  timeline: TimelineEvent[];
  artifacts: IncidentArtifact[];
  
  // Communication
  notifications: Notification[];
  updates: StatusUpdate[];
  stakeholders: Stakeholder[];
  
  // Metrics
  metrics: IncidentMetrics;
  lessons: LessonLearned[];
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  type: PlaybookType;
  severity: IncidentSeverity[];
  triggers: PlaybookTrigger[];
  steps: PlaybookStep[];
  automationLevel: AutomationLevel;
  requirements: PlaybookRequirement[];
  version: string;
  author: string;
  approved: boolean;
  lastUpdated: Date;
  tags: string[];
}

export interface PlaybookStep {
  id: string;
  name: string;
  description: string;
  type: StepType;
  action: StepAction;
  parameters: Record<string, any>;
  conditions: StepCondition[];
  timeout: number;
  retryPolicy: RetryPolicy;
  dependencies: string[];
  outputs: StepOutput[];
  manual: boolean;
  approvalRequired: boolean;
}

export interface ResponseAction {
  id: string;
  timestamp: Date;
  type: ActionType;
  title: string;
  description: string;
  executor: string;
  automated: boolean;
  playbook?: string;
  step?: string;
  status: ActionStatus;
  result?: ActionResult;
  duration: number;
  evidence: string[];
  notes: string;
}

export interface ForensicEvidence {
  id: string;
  type: EvidenceType;
  title: string;
  description: string;
  source: string;
  collectedAt: Date;
  collectedBy: string;
  hash: string;
  chain: ChainOfCustody[];
  analysis?: ForensicAnalysis;
  location: string;
  size: number;
  metadata: Record<string, any>;
}

export interface ImpactAssessment {
  businessImpact: BusinessImpact;
  technicalImpact: TechnicalImpact;
  dataImpact: DataImpact;
  financialImpact?: FinancialImpact;
  reputationalImpact?: ReputationalImpact;
  regulatoryImpact?: RegulatoryImpact;
  scope: ImpactScope;
  duration: number;
  affectedUsers: number;
  affectedSystems: number;
}

// ==================== Enums ====================

export enum IncidentType {
  MALWARE = 'MALWARE',
  RANSOMWARE = 'RANSOMWARE',
  PHISHING = 'PHISHING',
  DATA_BREACH = 'DATA_BREACH',
  INSIDER_THREAT = 'INSIDER_THREAT',
  DDOS = 'DDOS',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  DATA_EXFILTRATION = 'DATA_EXFILTRATION',
  SUPPLY_CHAIN = 'SUPPLY_CHAIN',
  ZERO_DAY = 'ZERO_DAY',
  APT = 'APT',
  MISCONFIGURATION = 'MISCONFIGURATION',
  VULNERABILITY_EXPLOIT = 'VULNERABILITY_EXPLOIT'
}

export enum IncidentSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

export enum IncidentStatus {
  DETECTED = 'DETECTED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  IN_PROGRESS = 'IN_PROGRESS',
  CONTAINED = 'CONTAINED',
  ERADICATED = 'ERADICATED',
  RECOVERED = 'RECOVERED',
  CLOSED = 'CLOSED',
  FALSE_POSITIVE = 'FALSE_POSITIVE'
}

export enum IncidentPhase {
  DETECTION = 'DETECTION',
  TRIAGE = 'TRIAGE',
  CONTAINMENT = 'CONTAINMENT',
  ERADICATION = 'ERADICATION',
  RECOVERY = 'RECOVERY',
  POST_INCIDENT = 'POST_INCIDENT'
}

export enum ActionType {
  ISOLATE = 'ISOLATE',
  BLOCK = 'BLOCK',
  QUARANTINE = 'QUARANTINE',
  DISABLE = 'DISABLE',
  RESET = 'RESET',
  PATCH = 'PATCH',
  SCAN = 'SCAN',
  COLLECT = 'COLLECT',
  ANALYZE = 'ANALYZE',
  NOTIFY = 'NOTIFY',
  ESCALATE = 'ESCALATE',
  RESTORE = 'RESTORE'
}

// ==================== SOAR Engine ====================

export class SOAREngine extends EventEmitter {
  private incidents: Map<string, SecurityIncident> = new Map();
  private playbooks: Map<string, Playbook> = new Map();
  private activeResponses: Map<string, ResponseExecution> = new Map();
  private orchestrators: Map<string, SecurityOrchestrator> = new Map();
  private threatIntel: ThreatIntelligenceService;
  
  constructor(
    private config: IncidentResponseConfig,
    private logger?: Logger
  ) {
    super();
    this.threatIntel = new ThreatIntelligenceService(config);
  }
  
  async initialize(): Promise<void> {
    this.log('info', 'Initializing SOAR Engine');
    
    // Load playbooks
    await this.loadPlaybooks();
    
    // Initialize orchestrators
    await this.initializeOrchestrators();
    
    // Start threat intelligence feeds
    await this.threatIntel.initialize();
    
    // Start detection monitors
    this.startDetectionMonitors();
    
    this.log('info', 'SOAR Engine initialized');
  }
  
  async createIncident(data: IncidentData): Promise<SecurityIncident> {
    this.log('info', `Creating incident: ${data.title}`);
    
    const incident: SecurityIncident = {
      id: crypto.randomUUID(),
      title: data.title,
      description: data.description,
      type: data.type || this.classifyIncidentType(data),
      severity: data.severity || this.calculateSeverity(data),
      priority: this.calculatePriority(data),
      status: IncidentStatus.DETECTED,
      phase: IncidentPhase.DETECTION,
      source: data.source,
      detectedAt: new Date(),
      
      attackVector: data.attackVector,
      ttps: await this.identifyTTPs(data),
      indicators: await this.extractIOCs(data),
      
      impact: await this.assessImpact(data),
      affectedAssets: await this.identifyAffectedAssets(data),
      
      responseTeam: await this.assembleResponseTeam(data),
      actions: [],
      containment: await this.determineContainmentStrategy(data),
      
      evidence: [],
      timeline: [{
        id: crypto.randomUUID(),
        timestamp: new Date(),
        event: 'Incident detected',
        type: 'detection',
        source: data.source.type,
        details: data
      }],
      artifacts: [],
      
      notifications: [],
      updates: [],
      stakeholders: await this.identifyStakeholders(data),
      
      metrics: {
        detectionTime: 0,
        responseTime: 0,
        containmentTime: 0,
        recoveryTime: 0,
        totalTime: 0
      },
      lessons: []
    };
    
    // Store incident
    this.incidents.set(incident.id, incident);
    
    // Select and assign playbook
    const playbook = await this.selectPlaybook(incident);
    if (playbook) {
      incident.playbook = playbook;
    }
    
    // Start automated response if configured
    if (this.config.response.automated && playbook) {
      await this.executePlaybook(incident.id, playbook.id);
    }
    
    // Send initial notifications
    await this.sendNotifications(incident, 'created');
    
    // Emit incident created event
    this.emit('incidentCreated', incident);
    
    return incident;
  }
  
  async executePlaybook(
    incidentId: string,
    playbookId: string
  ): Promise<PlaybookExecution> {
    const incident = this.incidents.get(incidentId);
    const playbook = this.playbooks.get(playbookId);
    
    if (!incident || !playbook) {
      throw new Error('Incident or playbook not found');
    }
    
    this.log('info', `Executing playbook ${playbook.name} for incident ${incident.id}`);
    
    const execution: PlaybookExecution = {
      id: crypto.randomUUID(),
      incidentId,
      playbookId,
      status: ExecutionStatus.RUNNING,
      startTime: new Date(),
      currentStep: 0,
      steps: [],
      results: {},
      errors: []
    };
    
    // Store active response
    this.activeResponses.set(execution.id, execution);
    
    // Execute playbook steps
    for (const step of playbook.steps) {
      try {
        // Check conditions
        if (!(await this.evaluateConditions(step.conditions, incident, execution))) {
          continue;
        }
        
        // Check dependencies
        if (!(await this.checkDependencies(step.dependencies, execution))) {
          continue;
        }
        
        // Execute step
        const result = await this.executeStep(step, incident, execution);
        
        // Record action
        const action: ResponseAction = {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: this.mapStepToActionType(step.type),
          title: step.name,
          description: step.description,
          executor: step.manual ? 'manual' : 'automated',
          automated: !step.manual,
          playbook: playbookId,
          step: step.id,
          status: result.success ? ActionStatus.COMPLETED : ActionStatus.FAILED,
          result,
          duration: result.duration,
          evidence: result.evidence || [],
          notes: result.notes || ''
        };
        
        incident.actions.push(action);
        execution.steps.push(action);
        execution.results[step.id] = result;
        
        // Handle manual steps
        if (step.manual || step.approvalRequired) {
          await this.handleManualStep(step, incident, execution);
        }
        
      } catch (error) {
        this.log('error', `Error executing step ${step.id}`, error);
        execution.errors.push({
          step: step.id,
          error: error.message,
          timestamp: new Date()
        });
        
        // Handle retry policy
        if (step.retryPolicy.enabled) {
          await this.retryStep(step, incident, execution);
        }
      }
    }
    
    // Complete execution
    execution.status = ExecutionStatus.COMPLETED;
    execution.endTime = new Date();
    
    // Update incident phase
    await this.updateIncidentPhase(incident);
    
    return execution;
  }
  
  async containIncident(incidentId: string): Promise<ContainmentResult> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error('Incident not found');
    }
    
    this.log('info', `Containing incident ${incidentId}`);
    
    const result: ContainmentResult = {
      success: true,
      actions: [],
      isolated: [],
      blocked: [],
      quarantined: []
    };
    
    // Execute containment strategy
    const strategy = incident.containment;
    
    // Network isolation
    if (strategy.networkIsolation) {
      for (const asset of incident.affectedAssets) {
        const isolationResult = await this.isolateAsset(asset);
        result.isolated.push(asset.id);
        result.actions.push(isolationResult);
      }
    }
    
    // Block indicators
    if (strategy.blockIndicators) {
      for (const ioc of incident.indicators) {
        const blockResult = await this.blockIndicator(ioc);
        result.blocked.push(ioc.value);
        result.actions.push(blockResult);
      }
    }
    
    // Quarantine files
    if (strategy.quarantineFiles) {
      for (const artifact of incident.artifacts) {
        if (artifact.type === 'file' && artifact.malicious) {
          const quarantineResult = await this.quarantineFile(artifact);
          result.quarantined.push(artifact.id);
          result.actions.push(quarantineResult);
        }
      }
    }
    
    // Update incident status
    incident.status = IncidentStatus.CONTAINED;
    incident.phase = IncidentPhase.CONTAINMENT;
    incident.containedAt = new Date();
    
    // Calculate containment time
    incident.metrics.containmentTime = 
      incident.containedAt.getTime() - incident.detectedAt.getTime();
    
    return result;
  }
  
  async collectForensics(incidentId: string): Promise<ForensicCollection> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error('Incident not found');
    }
    
    this.log('info', `Collecting forensics for incident ${incidentId}`);
    
    const collection: ForensicCollection = {
      id: crypto.randomUUID(),
      incidentId,
      startTime: new Date(),
      evidence: [],
      artifacts: [],
      timeline: [],
      analysis: []
    };
    
    // Collect different types of evidence
    const evidenceTypes = [
      { type: 'memory', collector: this.collectMemoryDump },
      { type: 'disk', collector: this.collectDiskImage },
      { type: 'network', collector: this.collectNetworkCapture },
      { type: 'logs', collector: this.collectLogs },
      { type: 'registry', collector: this.collectRegistryData },
      { type: 'process', collector: this.collectProcessInfo }
    ];
    
    for (const { type, collector } of evidenceTypes) {
      try {
        const evidence = await collector.call(this, incident);
        if (evidence) {
          collection.evidence.push(...evidence);
        }
      } catch (error) {
        this.log('error', `Failed to collect ${type} evidence`, error);
      }
    }
    
    // Reconstruct timeline
    collection.timeline = await this.reconstructTimeline(incident, collection.evidence);
    
    // Perform initial analysis
    collection.analysis = await this.performForensicAnalysis(collection.evidence);
    
    // Store evidence in incident
    incident.evidence.push(...collection.evidence);
    
    // Update collection time
    collection.endTime = new Date();
    
    return collection;
  }
  
  private async collectMemoryDump(incident: SecurityIncident): Promise<ForensicEvidence[]> {
    const evidence: ForensicEvidence[] = [];
    
    for (const asset of incident.affectedAssets) {
      if (asset.type === 'server' || asset.type === 'workstation') {
        const dump: ForensicEvidence = {
          id: crypto.randomUUID(),
          type: EvidenceType.MEMORY_DUMP,
          title: `Memory dump from ${asset.name}`,
          description: `Full memory dump collected from affected system`,
          source: asset.id,
          collectedAt: new Date(),
          collectedBy: 'SOAR',
          hash: crypto.randomBytes(32).toString('hex'),
          chain: [{
            id: crypto.randomUUID(),
            timestamp: new Date(),
            custodian: 'SOAR',
            action: 'collected',
            location: `/forensics/${incident.id}/memory/${asset.id}.dmp`
          }],
          location: `/forensics/${incident.id}/memory/${asset.id}.dmp`,
          size: 8589934592, // 8GB example
          metadata: {
            system: asset.name,
            os: asset.os,
            architecture: asset.architecture,
            volatility: true
          }
        };
        
        evidence.push(dump);
      }
    }
    
    return evidence;
  }
  
  private async reconstructTimeline(
    incident: SecurityIncident,
    evidence: ForensicEvidence[]
  ): Promise<TimelineEvent[]> {
    const timeline: TimelineEvent[] = [...incident.timeline];
    
    // Extract events from evidence
    for (const item of evidence) {
      if (item.analysis?.events) {
        timeline.push(...item.analysis.events);
      }
    }
    
    // Sort by timestamp
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Identify patterns and correlations
    for (let i = 0; i < timeline.length - 1; i++) {
      const current = timeline[i];
      const next = timeline[i + 1];
      
      // Check for rapid succession events (potential automation)
      const timeDiff = next.timestamp.getTime() - current.timestamp.getTime();
      if (timeDiff < 1000) { // Less than 1 second
        current.correlation = 'rapid-succession';
        next.correlation = 'rapid-succession';
      }
    }
    
    return timeline;
  }
  
  async generateIncidentReport(
    incidentId: string,
    type: ReportType = ReportType.EXECUTIVE
  ): Promise<IncidentReport> {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error('Incident not found');
    }
    
    const report: IncidentReport = {
      id: crypto.randomUUID(),
      incidentId,
      type,
      title: `Incident Report: ${incident.title}`,
      executiveSummary: this.generateExecutiveSummary(incident),
      
      incident: {
        overview: this.generateIncidentOverview(incident),
        timeline: incident.timeline,
        impact: incident.impact,
        rootCause: await this.identifyRootCause(incident)
      },
      
      response: {
        actions: incident.actions,
        effectiveness: this.assessResponseEffectiveness(incident),
        gaps: this.identifyResponseGaps(incident)
      },
      
      forensics: {
        evidence: incident.evidence,
        findings: await this.summarizeForensicFindings(incident),
        iocs: incident.indicators
      },
      
      recommendations: await this.generateRecommendations(incident),
      lessonsLearned: incident.lessons,
      
      metrics: this.calculateIncidentMetrics(incident),
      
      generatedAt: new Date(),
      generatedBy: 'SOAR'
    };
    
    return report;
  }
  
  private calculateIncidentMetrics(incident: SecurityIncident): IncidentMetrics {
    const metrics = { ...incident.metrics };
    
    // Calculate MTTD (Mean Time To Detect)
    // In this case, it's immediate as we're detecting in real-time
    metrics.mttd = metrics.detectionTime;
    
    // Calculate MTTR (Mean Time To Respond)
    if (incident.acknowledgedAt) {
      metrics.mttr = incident.acknowledgedAt.getTime() - incident.detectedAt.getTime();
    }
    
    // Calculate MTTC (Mean Time To Contain)
    if (incident.containedAt) {
      metrics.mttc = incident.containedAt.getTime() - incident.detectedAt.getTime();
    }
    
    // Calculate MTTE (Mean Time To Eradicate)
    if (incident.eradicatedAt) {
      metrics.mtte = incident.eradicatedAt.getTime() - incident.detectedAt.getTime();
    }
    
    // Calculate total incident duration
    if (incident.closedAt) {
      metrics.totalTime = incident.closedAt.getTime() - incident.detectedAt.getTime();
    }
    
    return metrics;
  }
  
  getIncidentStatistics(): IncidentStatistics {
    const incidents = Array.from(this.incidents.values());
    
    return {
      total: incidents.length,
      active: incidents.filter(i => 
        ![IncidentStatus.CLOSED, IncidentStatus.FALSE_POSITIVE].includes(i.status)
      ).length,
      critical: incidents.filter(i => i.severity === IncidentSeverity.CRITICAL).length,
      high: incidents.filter(i => i.severity === IncidentSeverity.HIGH).length,
      
      byType: this.groupBy(incidents, 'type'),
      byStatus: this.groupBy(incidents, 'status'),
      bySeverity: this.groupBy(incidents, 'severity'),
      
      averageResponseTime: this.calculateAverageMetric(incidents, 'responseTime'),
      averageContainmentTime: this.calculateAverageMetric(incidents, 'containmentTime'),
      averageResolutionTime: this.calculateAverageMetric(incidents, 'totalTime'),
      
      trends: this.calculateIncidentTrends(incidents)
    };
  }
  
  private groupBy(incidents: SecurityIncident[], field: string): Record<string, number> {
    return incidents.reduce((acc, incident) => {
      const value = incident[field];
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }
  
  private calculateAverageMetric(incidents: SecurityIncident[], metric: string): number {
    const values = incidents
      .map(i => i.metrics[metric])
      .filter(v => v !== undefined && v !== null);
    
    if (values.length === 0) return 0;
    
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }
  
  private log(level: string, message: string, error?: any): void {
    if (this.logger) {
      this.logger.log(level, message, error);
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`, error || '');
    }
  }
}

// ==================== Supporting Classes ====================

class ThreatIntelligenceService {
  private feeds: Map<string, ThreatFeed> = new Map();
  private indicators: Map<string, IOC> = new Map();
  
  constructor(private config: IncidentResponseConfig) {}
  
  async initialize(): Promise<void> {
    // Initialize threat feeds
    await this.loadThreatFeeds();
    
    // Start feed updates
    this.startFeedUpdates();
  }
  
  async checkIOC(value: string): Promise<ThreatIntelResult> {
    const indicator = this.indicators.get(value);
    
    if (indicator) {
      return {
        found: true,
        indicator,
        confidence: indicator.confidence,
        sources: indicator.sources,
        lastSeen: indicator.lastSeen
      };
    }
    
    return { found: false };
  }
  
  private async loadThreatFeeds(): Promise<void> {
    // Load configured threat feeds
    // This would connect to actual threat intelligence sources
  }
  
  private startFeedUpdates(): void {
    setInterval(() => {
      this.updateThreatFeeds();
    }, 60 * 60 * 1000); // Hourly updates
  }
  
  private async updateThreatFeeds(): Promise<void> {
    for (const feed of this.feeds.values()) {
      try {
        await this.updateFeed(feed);
      } catch (error) {
        console.error(`Failed to update feed ${feed.name}`, error);
      }
    }
  }
  
  private async updateFeed(feed: ThreatFeed): Promise<void> {
    // Fetch and update indicators from feed
  }
}

// ==================== Supporting Types ====================

interface IncidentData {
  title: string;
  description: string;
  type?: IncidentType;
  severity?: IncidentSeverity;
  source: IncidentSource;
  attackVector?: AttackVector;
  indicators?: IOC[];
  affectedAssets?: string[];
  evidence?: any[];
}

interface PlaybookExecution {
  id: string;
  incidentId: string;
  playbookId: string;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  currentStep: number;
  steps: ResponseAction[];
  results: Record<string, ActionResult>;
  errors: ExecutionError[];
}

interface ContainmentResult {
  success: boolean;
  actions: ResponseAction[];
  isolated: string[];
  blocked: string[];
  quarantined: string[];
}

interface ForensicCollection {
  id: string;
  incidentId: string;
  startTime: Date;
  endTime?: Date;
  evidence: ForensicEvidence[];
  artifacts: IncidentArtifact[];
  timeline: TimelineEvent[];
  analysis: ForensicAnalysis[];
}

interface IncidentReport {
  id: string;
  incidentId: string;
  type: ReportType;
  title: string;
  executiveSummary: string;
  incident: any;
  response: any;
  forensics: any;
  recommendations: string[];
  lessonsLearned: LessonLearned[];
  metrics: IncidentMetrics;
  generatedAt: Date;
  generatedBy: string;
}

interface IncidentStatistics {
  total: number;
  active: number;
  critical: number;
  high: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  averageResponseTime: number;
  averageContainmentTime: number;
  averageResolutionTime: number;
  trends: any;
}

// Additional type definitions
interface IOC {
  id: string;
  type: string;
  value: string;
  confidence: number;
  sources: string[];
  firstSeen: Date;
  lastSeen: Date;
  tags: string[];
}

interface TTP {
  tactic: string;
  technique: string;
  procedure: string;
  mitreId: string;
}

interface TimelineEvent {
  id: string;
  timestamp: Date;
  event: string;
  type: string;
  source: string;
  details: any;
  correlation?: string;
}

interface IncidentMetrics {
  detectionTime: number;
  responseTime: number;
  containmentTime: number;
  recoveryTime: number;
  totalTime: number;
  mttd?: number;
  mttr?: number;
  mttc?: number;
  mtte?: number;
}

enum ExecutionStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

enum EvidenceType {
  MEMORY_DUMP = 'MEMORY_DUMP',
  DISK_IMAGE = 'DISK_IMAGE',
  NETWORK_CAPTURE = 'NETWORK_CAPTURE',
  LOG_FILE = 'LOG_FILE',
  REGISTRY = 'REGISTRY',
  PROCESS = 'PROCESS'
}

// Export main class
export default SOAREngine;