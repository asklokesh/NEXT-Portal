/**
 * Governance Orchestrator
 * Main orchestrator service that coordinates all governance components
 * and provides a unified interface for service governance and compliance automation
 */

import { EventEmitter } from 'events';
import { PolicyEngine } from './policy-engine';
import { ComplianceAutomationService, ComplianceFramework } from './compliance-automation';
import { SecurityGovernanceService } from './security-governance';
import { QualityGatesService } from './quality-gates';
import { MonitoringReportingService } from './monitoring-reporting';
import { IntegrationAPIService, APIConfig } from './integration-api';

export interface GovernanceConfig {
  database: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl: boolean;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  opa: {
    url: string;
  };
  api: APIConfig;
  compliance: {
    frameworks: ComplianceFramework[];
    assessmentSchedule: string;
    reportRetentionDays: number;
  };
  security: {
    scanners: {
      trivy?: { endpoint: string };
      snyk?: { token: string };
      sonarqube?: { url: string; token: string };
    };
    policies: {
      enforceNonRoot: boolean;
      enforceReadOnlyFs: boolean;
      blockPrivileged: boolean;
    };
  };
  qualityGates: {
    defaultTimeout: number;
    retryPolicy: {
      maxRetries: number;
      backoffMultiplier: number;
    };
  };
  monitoring: {
    collectionInterval: number;
    retentionDays: number;
    notifications: {
      email?: { enabled: boolean; smtp: any };
      slack?: { enabled: boolean; webhook: string };
      webhook?: { enabled: boolean; endpoints: string[] };
    };
  };
}

export interface GovernanceStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    policyEngine: 'healthy' | 'unhealthy';
    compliance: 'healthy' | 'unhealthy';
    security: 'healthy' | 'unhealthy';
    qualityGates: 'healthy' | 'unhealthy';
    monitoring: 'healthy' | 'unhealthy';
    api: 'healthy' | 'unhealthy';
  };
  metrics: {
    uptime: number;
    requestCount: number;
    errorRate: number;
    averageResponseTime: number;
  };
  lastHealthCheck: Date;
}

export interface GovernanceEvent {
  id: string;
  type: string;
  source: string;
  timestamp: Date;
  data: Record<string, any>;
  severity: 'info' | 'warning' | 'critical';
  handled: boolean;
}

export class GovernanceOrchestrator extends EventEmitter {
  private config: GovernanceConfig;
  private status: GovernanceStatus;
  private startTime: Date;

  // Core services
  private policyEngine: PolicyEngine;
  private complianceService: ComplianceAutomationService;
  private securityService: SecurityGovernanceService;
  private qualityGatesService: QualityGatesService;
  private monitoringService: MonitoringReportingService;
  private apiService: IntegrationAPIService;

  // Internal state
  private isStarted: boolean = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private eventQueue: GovernanceEvent[] = [];

  constructor(config: GovernanceConfig) {
    super();
    this.config = config;
    this.startTime = new Date();
    this.status = this.initializeStatus();
    
    this.initializeServices();
    this.setupEventHandlers();
  }

  /**
   * Start the governance system
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      console.warn('Governance orchestrator is already started');
      return;
    }

    try {
      console.log('Starting Governance Orchestrator...');

      // Start core services
      await this.startCoreServices();

      // Start API service
      await this.apiService.start(8080);

      // Start monitoring and health checks
      this.startHealthChecks();

      // Start continuous compliance monitoring
      await this.complianceService.startContinuousMonitoring([
        ComplianceFramework.GDPR,
        ComplianceFramework.HIPAA,
        ComplianceFramework.SOC2,
        ComplianceFramework.PCI_DSS
      ]);

      // Start security monitoring
      await this.securityService.generateSecurityMetrics();

      this.isStarted = true;
      this.status.status = 'healthy';
      
      console.log('Governance Orchestrator started successfully');
      this.emit('started', { timestamp: new Date() });

    } catch (error) {
      console.error('Failed to start Governance Orchestrator:', error);
      this.status.status = 'unhealthy';
      throw error;
    }
  }

  /**
   * Stop the governance system gracefully
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    try {
      console.log('Stopping Governance Orchestrator...');

      // Stop health checks
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Stop monitoring
      await this.monitoringService.stopMonitoring();

      // Stop security monitoring
      // (SecurityGovernanceService doesn't have explicit stop method in current implementation)

      this.isStarted = false;
      this.status.status = 'unhealthy';
      
      console.log('Governance Orchestrator stopped');
      this.emit('stopped', { timestamp: new Date() });

    } catch (error) {
      console.error('Error stopping Governance Orchestrator:', error);
      throw error;
    }
  }

  /**
   * Get current status
   */
  getStatus(): GovernanceStatus {
    return { ...this.status };
  }

  /**
   * Perform health check
   */
  async performHealthCheck(): Promise<GovernanceStatus> {
    try {
      // Check each component
      const checks = await Promise.allSettled([
        this.checkPolicyEngineHealth(),
        this.checkComplianceServiceHealth(),
        this.checkSecurityServiceHealth(),
        this.checkQualityGatesHealth(),
        this.checkMonitoringHealth(),
        this.checkAPIHealth()
      ]);

      this.status.components.policyEngine = checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy';
      this.status.components.compliance = checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy';
      this.status.components.security = checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy';
      this.status.components.qualityGates = checks[3].status === 'fulfilled' ? 'healthy' : 'unhealthy';
      this.status.components.monitoring = checks[4].status === 'fulfilled' ? 'healthy' : 'unhealthy';
      this.status.components.api = checks[5].status === 'fulfilled' ? 'healthy' : 'unhealthy';

      // Determine overall status
      const unhealthyComponents = Object.values(this.status.components).filter(status => status === 'unhealthy').length;
      
      if (unhealthyComponents === 0) {
        this.status.status = 'healthy';
      } else if (unhealthyComponents <= 2) {
        this.status.status = 'degraded';
      } else {
        this.status.status = 'unhealthy';
      }

      // Update metrics
      this.status.metrics.uptime = Date.now() - this.startTime.getTime();
      this.status.lastHealthCheck = new Date();

      this.emit('healthCheckCompleted', this.status);
      return this.status;

    } catch (error) {
      console.error('Health check failed:', error);
      this.status.status = 'unhealthy';
      return this.status;
    }
  }

  /**
   * Process governance event
   */
  async processEvent(event: Omit<GovernanceEvent, 'id' | 'handled'>): Promise<string> {
    const governanceEvent: GovernanceEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      handled: false,
      ...event
    };

    this.eventQueue.push(governanceEvent);
    this.emit('eventReceived', governanceEvent);

    try {
      // Route event to appropriate service
      switch (event.type) {
        case 'policy.evaluation.requested':
          await this.handlePolicyEvaluationEvent(governanceEvent);
          break;
        case 'compliance.assessment.requested':
          await this.handleComplianceAssessmentEvent(governanceEvent);
          break;
        case 'security.scan.requested':
          await this.handleSecurityScanEvent(governanceEvent);
          break;
        case 'quality.gate.requested':
          await this.handleQualityGateEvent(governanceEvent);
          break;
        case 'monitoring.alert.triggered':
          await this.handleMonitoringAlertEvent(governanceEvent);
          break;
        default:
          console.warn(`Unknown event type: ${event.type}`);
      }

      governanceEvent.handled = true;
      this.emit('eventProcessed', governanceEvent);

    } catch (error) {
      console.error(`Failed to process event ${governanceEvent.id}:`, error);
      this.emit('eventFailed', { event: governanceEvent, error });
    }

    return governanceEvent.id;
  }

  /**
   * Get governance metrics summary
   */
  async getGovernanceMetrics(): Promise<any> {
    try {
      const metrics = await this.monitoringService.collectGovernanceMetrics();
      return {
        timestamp: new Date(),
        overall: metrics.overall,
        components: {
          compliance: metrics.compliance,
          security: metrics.security,
          qualityGates: metrics.qualityGates,
          policies: metrics.policies
        },
        system: {
          uptime: Date.now() - this.startTime.getTime(),
          eventQueueSize: this.eventQueue.length,
          unhandledEvents: this.eventQueue.filter(e => !e.handled).length,
          status: this.status.status
        }
      };
    } catch (error) {
      console.error('Failed to get governance metrics:', error);
      throw error;
    }
  }

  /**
   * Execute comprehensive governance assessment
   */
  async executeComprehensiveAssessment(scope: {
    services?: string[];
    teams?: string[];
    environments?: string[];
  } = {}): Promise<{
    assessmentId: string;
    compliance: any;
    security: any;
    quality: any;
    recommendations: string[];
  }> {
    const assessmentId = `assessment_${Date.now()}`;
    
    try {
      console.log(`Starting comprehensive assessment ${assessmentId}`);

      // Parallel execution of all assessments
      const [complianceResults, securityResults, qualityResults] = await Promise.allSettled([
        this.executeComplianceAssessments(scope),
        this.executeSecurityAssessments(scope),
        this.executeQualityAssessments(scope)
      ]);

      // Collect results
      const compliance = complianceResults.status === 'fulfilled' ? complianceResults.value : null;
      const security = securityResults.status === 'fulfilled' ? securityResults.value : null;
      const quality = qualityResults.status === 'fulfilled' ? qualityResults.value : null;

      // Generate recommendations
      const recommendations = this.generateComprehensiveRecommendations({
        compliance,
        security,
        quality
      });

      // Log assessment completion
      await this.monitoringService.logAuditEvent(
        'comprehensive-assessment-completed',
        { type: 'system', id: 'governance-orchestrator' },
        { type: 'assessment', id: assessmentId },
        'success',
        { scope, resultsCount: { compliance: compliance?.length || 0, security: security?.length || 0, quality: quality?.length || 0 } }
      );

      const result = {
        assessmentId,
        compliance,
        security,
        quality,
        recommendations
      };

      this.emit('comprehensiveAssessmentCompleted', result);
      return result;

    } catch (error) {
      console.error(`Comprehensive assessment ${assessmentId} failed:`, error);
      this.emit('comprehensiveAssessmentFailed', { assessmentId, error });
      throw error;
    }
  }

  // Private methods

  private initializeServices(): void {
    // Initialize Policy Engine
    this.policyEngine = new PolicyEngine(this.config.opa.url);

    // Initialize Compliance Service
    this.complianceService = new ComplianceAutomationService(this.policyEngine);

    // Initialize Security Service  
    this.securityService = new SecurityGovernanceService(this.policyEngine);

    // Initialize Quality Gates Service
    this.qualityGatesService = new QualityGatesService(
      this.policyEngine,
      this.complianceService,
      this.securityService
    );

    // Initialize Monitoring Service
    this.monitoringService = new MonitoringReportingService(
      this.policyEngine,
      this.complianceService,
      this.securityService,
      this.qualityGatesService
    );

    // Initialize API Service
    this.apiService = new IntegrationAPIService(
      this.config.api,
      this.policyEngine,
      this.complianceService,
      this.securityService,
      this.qualityGatesService,
      this.monitoringService
    );
  }

  private setupEventHandlers(): void {
    // Policy Engine events
    this.policyEngine.on('policyLoaded', (policy) => {
      this.processEvent({
        type: 'policy.loaded',
        source: 'policy-engine',
        timestamp: new Date(),
        data: { policyId: policy.id, policyName: policy.metadata.name },
        severity: 'info'
      });
    });

    // Compliance events
    this.complianceService.on('assessmentCompleted', (assessment) => {
      this.processEvent({
        type: 'compliance.assessment.completed',
        source: 'compliance-service',
        timestamp: new Date(),
        data: { assessmentId: assessment.id, framework: assessment.framework, score: assessment.overallScore },
        severity: assessment.riskLevel === 'critical' ? 'critical' : assessment.riskLevel === 'high' ? 'warning' : 'info'
      });
    });

    // Security events
    this.securityService.on('vulnerabilityScanCompleted', (report) => {
      this.processEvent({
        type: 'security.scan.completed',
        source: 'security-service',
        timestamp: new Date(),
        data: { reportId: report.id, targetId: report.targetId, criticalVulns: report.summary.critical },
        severity: report.summary.critical > 0 ? 'critical' : 'info'
      });
    });

    // Quality Gates events
    this.qualityGatesService.on('qualityGateCompleted', (execution) => {
      this.processEvent({
        type: 'quality.gate.completed',
        source: 'quality-gates-service',
        timestamp: new Date(),
        data: { executionId: execution.id, gateId: execution.gateId, status: execution.status },
        severity: execution.status === 'failed' ? 'warning' : 'info'
      });
    });

    // Monitoring events
    this.monitoringService.on('alertCreated', (alert) => {
      this.processEvent({
        type: 'monitoring.alert.created',
        source: 'monitoring-service',
        timestamp: new Date(),
        data: { alertId: alert.id, type: alert.type, severity: alert.severity },
        severity: alert.severity
      });
    });
  }

  private async startCoreServices(): Promise<void> {
    // Services are already initialized, just need to start monitoring
    await this.monitoringService.startMonitoring();
  }

  private startHealthChecks(): void {
    // Perform health check every 60 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('Scheduled health check failed:', error);
      }
    }, 60000);

    // Perform initial health check
    this.performHealthCheck();
  }

  private initializeStatus(): GovernanceStatus {
    return {
      status: 'healthy',
      components: {
        policyEngine: 'healthy',
        compliance: 'healthy',
        security: 'healthy',
        qualityGates: 'healthy',
        monitoring: 'healthy',
        api: 'healthy'
      },
      metrics: {
        uptime: 0,
        requestCount: 0,
        errorRate: 0,
        averageResponseTime: 0
      },
      lastHealthCheck: new Date()
    };
  }

  // Health check methods for each component
  private async checkPolicyEngineHealth(): Promise<void> {
    const metrics = this.policyEngine.getEvaluationMetrics();
    if (!metrics || typeof metrics.totalPolicies !== 'number') {
      throw new Error('Policy engine health check failed');
    }
  }

  private async checkComplianceServiceHealth(): Promise<void> {
    const dashboard = await this.complianceService.getComplianceDashboard();
    if (!dashboard || typeof dashboard.overview !== 'object') {
      throw new Error('Compliance service health check failed');
    }
  }

  private async checkSecurityServiceHealth(): Promise<void> {
    const dashboard = await this.securityService.getSecurityDashboard();
    if (!dashboard || typeof dashboard.overview !== 'object') {
      throw new Error('Security service health check failed');
    }
  }

  private async checkQualityGatesHealth(): Promise<void> {
    const dashboard = await this.qualityGatesService.getQualityGatesDashboard();
    if (!dashboard || typeof dashboard.overview !== 'object') {
      throw new Error('Quality gates service health check failed');
    }
  }

  private async checkMonitoringHealth(): Promise<void> {
    // Monitoring service is considered healthy if it can collect metrics
    const metrics = await this.monitoringService.collectGovernanceMetrics();
    if (!metrics || typeof metrics.overall !== 'object') {
      throw new Error('Monitoring service health check failed');
    }
  }

  private async checkAPIHealth(): Promise<void> {
    // API service is considered healthy if it's running
    // In a real implementation, we might check if the server is responding
    if (!this.apiService) {
      throw new Error('API service health check failed');
    }
  }

  // Event handlers
  private async handlePolicyEvaluationEvent(event: GovernanceEvent): Promise<void> {
    const { policyId, context } = event.data;
    await this.policyEngine.evaluatePolicy(policyId, context);
  }

  private async handleComplianceAssessmentEvent(event: GovernanceEvent): Promise<void> {
    const { framework, scope } = event.data;
    await this.complianceService.performAssessment(framework, scope);
  }

  private async handleSecurityScanEvent(event: GovernanceEvent): Promise<void> {
    const { targetId, targetType, scanner } = event.data;
    await this.securityService.scanForVulnerabilities(targetId, targetType, scanner);
  }

  private async handleQualityGateEvent(event: GovernanceEvent): Promise<void> {
    const { gateId, targetId, targetType, context, triggeredBy } = event.data;
    await this.qualityGatesService.executeQualityGate(gateId, targetId, targetType, context, triggeredBy);
  }

  private async handleMonitoringAlertEvent(event: GovernanceEvent): Promise<void> {
    const { type, severity, title, description, source } = event.data;
    await this.monitoringService.createAlert(type, severity, title, description, source);
  }

  // Assessment execution methods
  private async executeComplianceAssessments(scope: any): Promise<any[]> {
    const assessments = [];
    
    for (const framework of this.config.compliance.frameworks) {
      try {
        const assessment = await this.complianceService.performAssessment(framework, scope);
        assessments.push(assessment);
      } catch (error) {
        console.error(`Compliance assessment failed for ${framework}:`, error);
      }
    }
    
    return assessments;
  }

  private async executeSecurityAssessments(scope: any): Promise<any[]> {
    const assessments = [];
    
    // Execute security scans for services in scope
    const services = scope.services || ['default-service'];
    
    for (const service of services) {
      try {
        const report = await this.securityService.scanForVulnerabilities(service, 'service');
        assessments.push(report);
      } catch (error) {
        console.error(`Security assessment failed for ${service}:`, error);
      }
    }
    
    return assessments;
  }

  private async executeQualityAssessments(scope: any): Promise<any[]> {
    const assessments = [];
    
    try {
      const dashboard = await this.qualityGatesService.getQualityGatesDashboard();
      assessments.push(dashboard);
    } catch (error) {
      console.error('Quality assessment failed:', error);
    }
    
    return assessments;
  }

  private generateComprehensiveRecommendations(results: {
    compliance: any;
    security: any;
    quality: any;
  }): string[] {
    const recommendations: string[] = [];
    
    // Analyze compliance results
    if (results.compliance && results.compliance.some((a: any) => a.riskLevel === 'critical')) {
      recommendations.push('Address critical compliance violations immediately');
    }
    
    // Analyze security results
    if (results.security && results.security.some((r: any) => r.summary.critical > 0)) {
      recommendations.push('Patch critical security vulnerabilities');
    }
    
    // Analyze quality results
    if (results.quality && results.quality.overview?.blockedDeployments > 5) {
      recommendations.push('Review and improve quality gate success rate');
    }
    
    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('Continue regular governance monitoring');
      recommendations.push('Consider enhancing automation where possible');
    }
    
    return recommendations;
  }
}

export default GovernanceOrchestrator;