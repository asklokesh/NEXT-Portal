/**
 * Observability and SRE Automation System
 * 
 * Production-ready observability platform with comprehensive monitoring,
 * SRE automation, incident management, and performance optimization.
 * 
 * @author Claude Code Assistant
 * @version 1.0.0
 */

// Core configuration
export { 
  ObservabilityConfig,
  getDefaultConfig,
  validateConfig,
  loadConfig
} from './observability-config';

// Main orchestrator
export { 
  ObservabilityOrchestrator,
  ObservabilityEvent,
  HealthStatus
} from './observability-orchestrator';

// Core observability services
export {
  MetricsCollector,
  Metric,
  MetricSeries,
  AggregatedMetric
} from './metrics-collector';

export {
  LoggingEngine,
  LogEntry,
  LogAnalysisResult,
  LogFilter
} from './logging-engine';

export {
  TracingManager,
  TraceSpan,
  TraceAnalysis,
  TracingMetrics
} from './tracing-manager';

// SRE automation
export {
  SREAutomation,
  SLI,
  SLO,
  ErrorBudget,
  SLOViolation,
  BurnRateAlert,
  SREMetrics,
  Runbook
} from './sre-automation';

// Incident management
export {
  IncidentManager,
  Incident,
  IncidentTimelineEntry,
  IncidentTemplate,
  EscalationPolicy,
  PostMortem,
  IncidentMetrics
} from './incident-manager';

// Intelligent alerting
export {
  AlertingEngine,
  Alert,
  AlertingRule,
  AlertGroup,
  Silence,
  NotificationChannel,
  AlertingMetrics
} from './alerting-engine';

// Capacity planning
export {
  CapacityPlanner,
  ResourceUtilization,
  CapacityForecast,
  CapacityRecommendation,
  AutoScalingPolicy,
  CostOptimization,
  CapacityMetrics
} from './capacity-planner';

// Performance analysis
export {
  PerformanceAnalyzer,
  PerformanceProfile,
  BottleneckAnalysis,
  PerformanceRecommendation
} from './performance-analyzer';

// Platform integrations
export {
  IntegrationAdapters,
  IntegrationAdapter
} from './integration-adapters';

/**
 * Initialize and configure the complete observability system
 * 
 * @param config Optional configuration overrides
 * @returns Configured ObservabilityOrchestrator instance
 */
export function createObservabilitySystem(config?: Partial<ObservabilityConfig>): ObservabilityOrchestrator {
  return new ObservabilityOrchestrator(config);
}

/**
 * Quick start function for development environments
 * 
 * @returns Pre-configured ObservabilityOrchestrator with development settings
 */
export function createDevObservabilitySystem(): ObservabilityOrchestrator {
  const devConfig = {
    environment: 'development' as const,
    logging: {
      level: 'debug' as const,
      structured: true,
      sampling: { enabled: false, rate: 1.0 },
    },
    tracing: {
      samplingRate: 1.0, // 100% sampling in dev
    },
    sre: {
      runbooks: {
        autoExecution: false, // Require approval in dev
      },
    },
  };
  
  return new ObservabilityOrchestrator(devConfig);
}

/**
 * Production-optimized observability system
 * 
 * @param config Production-specific configuration
 * @returns Production-ready ObservabilityOrchestrator instance
 */
export function createProductionObservabilitySystem(config: Partial<ObservabilityConfig>): ObservabilityOrchestrator {
  const prodConfig = {
    environment: 'production' as const,
    logging: {
      level: 'info' as const,
      sampling: { enabled: true, rate: 0.1 }, // 10% sampling
    },
    tracing: {
      samplingRate: 0.05, // 5% sampling in production
    },
    security: {
      dataEncryption: true,
      auditLogging: true,
      complianceReporting: true,
    },
    ...config,
  };
  
  return new ObservabilityOrchestrator(prodConfig);
}

/**
 * Utility function to validate observability configuration
 */
export function validateObservabilityConfig(config: any): { valid: boolean; errors: string[] } {
  return validateConfig(config);
}

// Re-export main classes for direct instantiation
export default ObservabilityOrchestrator;