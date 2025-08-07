/**
 * Security Service Exports
 * Main entry point for the comprehensive security scanning and vulnerability management system
 */

// Core Configuration and Types
export * from './security-config';

// Main Orchestrator
export { SecurityOrchestrator } from './security-orchestrator';
export type {
  SecurityOrchestrationEvent,
  SecurityDashboard,
  OrchestrationMetrics,
  SecurityWorkflow,
  WorkflowTrigger,
  WorkflowStep,
  EventCorrelation,
  ServiceHealth
} from './security-orchestrator';

// Vulnerability Scanner
export { VulnerabilityScanner } from './vulnerability-scanner';
export type {
  ScanRequest,
  ScanResult,
  VulnerabilityResult,
  ScannerType,
  ScannerAdapter,
  ScanConfiguration,
  VulnerabilityStats
} from './vulnerability-scanner';

// Threat Detection Engine
export { ThreatDetectionEngine } from './threat-detection';
export type {
  ThreatEvent,
  SecurityIncident,
  DetectionRule,
  AnomalyScore,
  MLPrediction,
  ThreatIntelligence,
  DetectionMetrics
} from './threat-detection';

// Compliance Checker
export { ComplianceChecker } from './compliance-checker';
export type {
  ComplianceAssessment,
  ComplianceFramework,
  ComplianceControl,
  ComplianceReport,
  GapAnalysis,
  ReportPeriod,
  ControlTestResult,
  ComplianceMetrics
} from './compliance-checker';

// Policy Engine
export { PolicyEngine } from './policy-engine';
export type {
  SecurityPolicy,
  PolicyDecision,
  PolicyViolation,
  PolicyTemplate,
  PolicyEvaluation,
  PolicyMetrics,
  PolicyDeployment
} from './policy-engine';

// Remediation Manager
export { RemediationManager } from './remediation-manager';
export type {
  RemediationTask,
  RemediationStrategy,
  RemediationWorkflow,
  RemediationPlan,
  WorkflowStep as RemediationStep,
  TaskExecution,
  RemediationMetrics
} from './remediation-manager';

// Security Analytics
export { SecurityAnalytics } from './security-analytics';
export type {
  SecurityAnalysis,
  SecurityMetric,
  RiskScore,
  SecurityReport,
  ReportType,
  SecurityTrend,
  BenchmarkComparison,
  SecurityKPI
} from './security-analytics';

// Incident Response System
export { IncidentResponseSystem } from './incident-response';
export type {
  ResponsePlan,
  ResponsePlaybook,
  ResponseAction,
  PlaybookStep,
  ResponseExecutor,
  ResponseMetrics,
  IncidentClassification
} from './incident-response';

// Integration Adapters
export {
  SecurityToolIntegrationManager,
  OWASPZAPAdapter,
  SnykAdapter,
  TrivyAdapter,
  SplunkAdapter,
  AWSSecurityHubAdapter
} from './integration-adapters';
export type {
  SecurityToolAdapter,
  ToolConfiguration,
  ToolAction,
  ToolActionResult,
  NormalizedSecurityData,
  DataType,
  ScanTarget,
  IntegrationHealth,
  AdapterCapabilities
} from './integration-adapters';

// Utility Functions and Helpers
export const SecurityUtils = {
  /**
   * Create a default security configuration
   */
  createDefaultConfig: (environment: string = 'production') => ({
    scanning: {
      enabled: true,
      scanners: {
        sast: {
          enabled: true,
          tools: ['semgrep', 'codeql'],
          schedule: '0 2 * * *',
          excludePaths: ['node_modules/', 'dist/']
        },
        dast: {
          enabled: true,
          tools: ['owasp-zap'],
          schedule: '0 3 * * *',
          targets: []
        },
        sca: {
          enabled: true,
          tools: ['snyk', 'safety'],
          schedule: '0 1 * * *',
          manifestFiles: ['package.json', 'requirements.txt']
        },
        container: {
          enabled: true,
          tools: ['trivy', 'snyk'],
          schedule: '0 4 * * *',
          registries: []
        },
        infrastructure: {
          enabled: true,
          tools: ['checkov', 'terraform-security-scan'],
          schedule: '0 5 * * *',
          paths: ['infrastructure/']
        }
      }
    },
    threatDetection: {
      enabled: true,
      realTimeMonitoring: true,
      rules: [],
      anomalyDetection: {
        enabled: true,
        sensitivity: 0.8,
        learningPeriod: 7
      },
      behaviorAnalysis: {
        enabled: true,
        baselineWindow: 30
      }
    },
    compliance: {
      enabled: true,
      frameworks: ['SOC2', 'ISO27001', 'PCI-DSS', 'GDPR'],
      assessmentSchedule: '0 0 1 * *',
      autoRemediation: false
    },
    policies: {
      enabled: true,
      engine: 'opa',
      autoDeployment: true,
      violationHandling: 'alert'
    },
    remediation: {
      enabled: true,
      autoRemediation: environment !== 'production',
      approvalRequired: environment === 'production',
      maxConcurrentTasks: 5
    },
    analytics: {
      enabled: true,
      metricsRetention: 90,
      reportGeneration: true,
      dashboards: true
    },
    incidentResponse: {
      enabled: true,
      autoResponse: false,
      escalationRules: [],
      playbooks: []
    },
    integrations: {
      enabled: true,
      tools: {},
      healthCheckInterval: 300000
    }
  }),

  /**
   * Create a basic vulnerability scan configuration
   */
  createScanConfig: (
    type: 'sast' | 'dast' | 'sca' | 'container' | 'infrastructure',
    target: string
  ) => ({
    id: `scan-${type}-${Date.now()}`,
    type,
    target,
    configuration: {
      deepScan: false,
      excludeRules: [],
      includeExperimental: false,
      timeout: 3600
    },
    createdAt: new Date()
  }),

  /**
   * Create a threat detection rule
   */
  createThreatRule: (
    name: string,
    pattern: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ) => ({
    id: `rule-${Date.now()}`,
    name,
    description: `Threat detection rule for ${name}`,
    pattern,
    severity,
    enabled: true,
    actions: ['alert'],
    createdAt: new Date()
  }),

  /**
   * Create a security policy template
   */
  createPolicyTemplate: (
    name: string,
    type: 'authorization' | 'data-protection' | 'network-security' | 'compliance'
  ) => ({
    id: `template-${Date.now()}`,
    name,
    description: `Security policy template for ${type}`,
    type,
    version: '1.0.0',
    language: 'rego',
    template: '',
    parameters: [],
    tags: [type],
    createdAt: new Date()
  }),

  /**
   * Create a remediation workflow
   */
  createRemediationWorkflow: (
    name: string,
    vulnerabilityType: string,
    steps: Array<{ action: string; params: Record<string, any> }>
  ) => ({
    id: `workflow-${Date.now()}`,
    name,
    description: `Remediation workflow for ${vulnerabilityType}`,
    vulnerabilityTypes: [vulnerabilityType],
    steps: steps.map((step, index) => ({
      id: `step-${index + 1}`,
      name: step.action,
      type: 'automated' as const,
      action: step.action,
      parameters: step.params,
      order: index + 1
    })),
    autoApprove: false,
    createdAt: new Date()
  }),

  /**
   * Calculate CVSS base score
   */
  calculateCVSSScore: (vector: {
    attackVector: 'network' | 'adjacent' | 'local' | 'physical';
    attackComplexity: 'low' | 'high';
    privilegesRequired: 'none' | 'low' | 'high';
    userInteraction: 'none' | 'required';
    scope: 'unchanged' | 'changed';
    confidentialityImpact: 'none' | 'low' | 'high';
    integrityImpact: 'none' | 'low' | 'high';
    availabilityImpact: 'none' | 'low' | 'high';
  }): number => {
    // Simplified CVSS 3.1 calculation
    const impacts = {
      none: 0,
      low: 0.22,
      high: 0.56
    };

    const exploitability = {
      attackVector: {
        network: 0.85,
        adjacent: 0.62,
        local: 0.55,
        physical: 0.2
      },
      attackComplexity: {
        low: 0.77,
        high: 0.44
      },
      privilegesRequired: {
        none: 0.85,
        low: vector.scope === 'unchanged' ? 0.62 : 0.68,
        high: vector.scope === 'unchanged' ? 0.27 : 0.5
      },
      userInteraction: {
        none: 0.85,
        required: 0.62
      }
    };

    const confImpact = impacts[vector.confidentialityImpact];
    const integImpact = impacts[vector.integrityImpact];
    const availImpact = impacts[vector.availabilityImpact];

    const iss = 1 - ((1 - confImpact) * (1 - integImpact) * (1 - availImpact));
    
    const exploitabilityScore = 8.22 * 
      exploitability.attackVector[vector.attackVector] *
      exploitability.attackComplexity[vector.attackComplexity] *
      exploitability.privilegesRequired[vector.privilegesRequired] *
      exploitability.userInteraction[vector.userInteraction];

    let impact = vector.scope === 'unchanged' ? 6.42 * iss : 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15);
    
    if (impact <= 0) return 0;

    const baseScore = vector.scope === 'unchanged' 
      ? Math.min(impact + exploitabilityScore, 10)
      : Math.min(1.08 * (impact + exploitabilityScore), 10);

    return Math.round(baseScore * 10) / 10;
  },

  /**
   * Determine vulnerability severity from CVSS score
   */
  getSeverityFromCVSS: (score: number): 'none' | 'low' | 'medium' | 'high' | 'critical' => {
    if (score === 0.0) return 'none';
    if (score <= 3.9) return 'low';
    if (score <= 6.9) return 'medium';
    if (score <= 8.9) return 'high';
    return 'critical';
  },

  /**
   * Generate security report template
   */
  createReportTemplate: (
    type: 'vulnerability' | 'compliance' | 'threat' | 'executive',
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  ) => ({
    id: `report-template-${Date.now()}`,
    name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${period.charAt(0).toUpperCase() + period.slice(1)} Report`,
    type,
    period,
    sections: type === 'executive' 
      ? ['summary', 'key-metrics', 'top-risks', 'recommendations', 'compliance-status']
      : ['overview', 'detailed-findings', 'remediation-status', 'metrics', 'next-steps'],
    format: 'pdf',
    recipients: [],
    schedule: period === 'daily' ? '0 8 * * *' 
             : period === 'weekly' ? '0 8 * * 1'
             : period === 'monthly' ? '0 8 1 * *'
             : '0 8 1 */3 *',
    createdAt: new Date()
  }),

  /**
   * Validate security configuration
   */
  validateSecurityConfig: (config: any): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!config.scanning?.enabled && !config.threatDetection?.enabled) {
      errors.push('At least one security service must be enabled');
    }

    if (config.scanning?.enabled) {
      const scanners = config.scanning.scanners;
      if (!scanners || Object.keys(scanners).length === 0) {
        errors.push('At least one scanner must be configured when scanning is enabled');
      }
    }

    if (config.compliance?.enabled) {
      if (!config.compliance.frameworks || config.compliance.frameworks.length === 0) {
        errors.push('At least one compliance framework must be specified');
      }
    }

    if (config.remediation?.enabled && config.remediation.maxConcurrentTasks <= 0) {
      errors.push('maxConcurrentTasks must be greater than 0');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  },

  /**
   * Generate security metrics summary
   */
  generateMetricsSummary: (metrics: any[]): {
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    averageRemediationTime: number;
    complianceScore: number;
    threatDetectionRate: number;
  } => {
    const vulnMetrics = metrics.filter(m => m.type === 'vulnerability');
    const complianceMetrics = metrics.filter(m => m.type === 'compliance');
    const threatMetrics = metrics.filter(m => m.type === 'threat-detection');
    const remediationMetrics = metrics.filter(m => m.type === 'remediation');

    return {
      totalVulnerabilities: vulnMetrics.reduce((sum, m) => sum + (m.value || 0), 0),
      criticalVulnerabilities: vulnMetrics
        .filter(m => m.severity === 'critical')
        .reduce((sum, m) => sum + (m.value || 0), 0),
      averageRemediationTime: remediationMetrics.length > 0
        ? remediationMetrics.reduce((sum, m) => sum + (m.value || 0), 0) / remediationMetrics.length
        : 0,
      complianceScore: complianceMetrics.length > 0
        ? complianceMetrics.reduce((sum, m) => sum + (m.value || 0), 0) / complianceMetrics.length
        : 0,
      threatDetectionRate: threatMetrics.length > 0
        ? threatMetrics.reduce((sum, m) => sum + (m.value || 0), 0) / threatMetrics.length
        : 0
    };
  },

  /**
   * Generate unique security ID
   */
  generateSecurityId: (prefix: string): string => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Format duration for security reports
   */
  formatSecurityDuration: (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }
};

// Factory Functions
export const SecurityFactory = {
  /**
   * Create a complete security orchestrator instance
   */
  createSecurityOrchestrator: (config?: any, logger?: any) => {
    return new SecurityOrchestrator(config, logger);
  },

  /**
   * Create a vulnerability scanner instance
   */
  createVulnerabilityScanner: (config: any, logger?: any) => {
    return new VulnerabilityScanner(config, logger);
  },

  /**
   * Create a threat detection engine instance
   */
  createThreatDetectionEngine: (config: any, logger?: any) => {
    return new ThreatDetectionEngine(config, logger);
  },

  /**
   * Create a compliance checker instance
   */
  createComplianceChecker: (config: any, logger?: any) => {
    return new ComplianceChecker(config, logger);
  },

  /**
   * Create a policy engine instance
   */
  createPolicyEngine: (config: any, logger?: any) => {
    return new PolicyEngine(config, logger);
  },

  /**
   * Create a remediation manager instance
   */
  createRemediationManager: (config: any, logger?: any) => {
    return new RemediationManager(config, logger);
  },

  /**
   * Create a security analytics instance
   */
  createSecurityAnalytics: (config: any, logger?: any) => {
    return new SecurityAnalytics(config, logger);
  },

  /**
   * Create an incident response system instance
   */
  createIncidentResponseSystem: (config: any, logger?: any) => {
    return new IncidentResponseSystem(config, logger);
  },

  /**
   * Create a security tool integration manager instance
   */
  createIntegrationManager: (config: any, logger?: any) => {
    return new SecurityToolIntegrationManager(config, logger);
  }
};

// Constants
export const SECURITY_CONSTANTS = {
  SCAN_TYPES: {
    SAST: 'sast',
    DAST: 'dast',
    SCA: 'sca',
    CONTAINER: 'container',
    INFRASTRUCTURE: 'infrastructure',
    RUNTIME: 'runtime'
  } as const,

  VULNERABILITY_SEVERITIES: {
    NONE: 'none',
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical'
  } as const,

  THREAT_CATEGORIES: {
    MALWARE: 'malware',
    INTRUSION: 'intrusion',
    DATA_BREACH: 'data-breach',
    DENIAL_OF_SERVICE: 'denial-of-service',
    PRIVILEGE_ESCALATION: 'privilege-escalation',
    UNAUTHORIZED_ACCESS: 'unauthorized-access'
  } as const,

  COMPLIANCE_FRAMEWORKS: {
    SOC2: 'SOC2',
    ISO27001: 'ISO27001',
    PCI_DSS: 'PCI-DSS',
    GDPR: 'GDPR',
    HIPAA: 'HIPAA',
    NIST: 'NIST',
    CIS: 'CIS'
  } as const,

  POLICY_ENGINES: {
    OPA: 'opa',
    CEDAR: 'cedar',
    CASBIN: 'casbin'
  } as const,

  INCIDENT_STATUSES: {
    OPEN: 'open',
    IN_PROGRESS: 'in-progress',
    RESOLVED: 'resolved',
    CLOSED: 'closed',
    FALSE_POSITIVE: 'false-positive'
  } as const,

  REMEDIATION_STATUSES: {
    PENDING: 'pending',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    REQUIRES_APPROVAL: 'requires-approval'
  } as const,

  SECURITY_TOOLS: {
    OWASP_ZAP: 'owasp-zap',
    SNYK: 'snyk',
    TRIVY: 'trivy',
    SEMGREP: 'semgrep',
    CODEQL: 'codeql',
    SONARQUBE: 'sonarqube',
    CHECKOV: 'checkov',
    BANDIT: 'bandit',
    SAFETY: 'safety',
    SPLUNK: 'splunk'
  } as const,

  DEFAULT_TIMEOUTS: {
    SCAN_TIMEOUT: 3600000,        // 1 hour
    THREAT_DETECTION: 30000,      // 30 seconds
    POLICY_EVALUATION: 5000,      // 5 seconds
    REMEDIATION_TASK: 1800000,    // 30 minutes
    COMPLIANCE_CHECK: 300000,     // 5 minutes
    INCIDENT_RESPONSE: 600000     // 10 minutes
  } as const,

  CVSS_RANGES: {
    NONE: [0.0, 0.0],
    LOW: [0.1, 3.9],
    MEDIUM: [4.0, 6.9],
    HIGH: [7.0, 8.9],
    CRITICAL: [9.0, 10.0]
  } as const
};

// Version information
export const SECURITY_VERSION = '1.0.0';
export const BUILD_DATE = new Date().toISOString();

// Main security service class that combines all components
export class SecurityService {
  private orchestrator: SecurityOrchestrator;
  private initialized = false;

  constructor(config?: any, logger?: any) {
    this.orchestrator = SecurityFactory.createSecurityOrchestrator(config, logger);
  }

  /**
   * Initialize the security service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('Security service is already initialized');
    }

    await this.orchestrator.initialize();
    this.initialized = true;
  }

  /**
   * Start a security scan
   */
  async startScan(request: any): Promise<string> {
    if (!this.initialized) {
      throw new Error('Security service not initialized');
    }

    return await this.orchestrator.processSecurityEvent({
      type: 'scan-request',
      timestamp: new Date(),
      source: 'security-service',
      data: request
    });
  }

  /**
   * Get security dashboard
   */
  async getDashboard(): Promise<any> {
    return await this.orchestrator.getSecurityDashboard();
  }

  /**
   * Process security event
   */
  async processEvent(event: any): Promise<void> {
    await this.orchestrator.processSecurityEvent(event);
  }

  /**
   * Get security metrics
   */
  getMetrics(): any {
    return this.orchestrator.getMetrics();
  }

  /**
   * Get service health status
   */
  getHealth(): any {
    return this.orchestrator.getServiceHealth();
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    // Cleanup logic would go here
    this.initialized = false;
  }
}

// Default export
export default SecurityService;

/**
 * Usage Examples:
 * 
 * // Basic usage
 * const securityService = new SecurityService(
 *   SecurityUtils.createDefaultConfig('production')
 * );
 * 
 * await securityService.initialize();
 * 
 * // Start a vulnerability scan
 * const scanId = await securityService.startScan({
 *   type: 'sast',
 *   target: '/path/to/code',
 *   configuration: {
 *     deepScan: true,
 *     rules: ['security']
 *   }
 * });
 * 
 * // Get security dashboard
 * const dashboard = await securityService.getDashboard();
 * console.log('Security metrics:', dashboard.metrics);
 * 
 * // Advanced usage with individual components
 * const scanner = SecurityFactory.createVulnerabilityScanner({
 *   scanners: {
 *     sast: { enabled: true, tools: ['semgrep'] }
 *   }
 * });
 * 
 * const threatDetection = SecurityFactory.createThreatDetectionEngine({
 *   realTimeMonitoring: true,
 *   anomalyDetection: { enabled: true }
 * });
 * 
 * // Utility functions
 * const cvssScore = SecurityUtils.calculateCVSSScore({
 *   attackVector: 'network',
 *   attackComplexity: 'low',
 *   privilegesRequired: 'none',
 *   userInteraction: 'none',
 *   scope: 'unchanged',
 *   confidentialityImpact: 'high',
 *   integrityImpact: 'high',
 *   availabilityImpact: 'high'
 * });
 * 
 * const severity = SecurityUtils.getSeverityFromCVSS(cvssScore);
 * console.log(`CVSS Score: ${cvssScore}, Severity: ${severity}`);
 * 
 * // Cleanup
 * await securityService.shutdown();
 */