/**
 * Integration Requirement Detector
 * 
 * Detects and analyzes integration requirements for services
 * based on service characteristics and organizational context.
 */

import { WizardRecommendation } from './service-creation-wizard';

export interface IntegrationAnalysisRequest {
  serviceName: string;
  domain?: string;
  team: string;
  existingServices: string[];
  serviceType?: string;
  businessRequirements?: string[];
}

export interface IntegrationPattern {
  name: string;
  type: 'synchronous' | 'asynchronous' | 'hybrid';
  description: string;
  pros: string[];
  cons: string[];
  bestFor: string[];
  complexity: 'low' | 'medium' | 'high';
  reliability: 'low' | 'medium' | 'high';
  latency: 'low' | 'medium' | 'high';
  scalability: 'low' | 'medium' | 'high';
}

export interface IntegrationRequirement {
  target: string;
  type: 'service' | 'database' | 'external-api' | 'message-queue' | 'cache';
  pattern: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  complexity: 'low' | 'medium' | 'high';
  estimatedEffort: string;
  risks: string[];
  alternatives: string[];
}

export interface SecurityRequirement {
  authentication: boolean;
  authorization: boolean;
  encryption: boolean;
  auditLogging: boolean;
  rateLimiting: boolean;
  inputValidation: boolean;
  outputSanitization: boolean;
  reason: string;
  standards: string[];
}

export class IntegrationRequirementDetector {
  private integrationPatterns: Map<string, IntegrationPattern> = new Map();
  private serviceGraph: Map<string, string[]> = new Map(); // Service dependencies
  private domainMappings: Map<string, string[]> = new Map(); // Domain to common integrations

  constructor() {
    this.initializeIntegrationPatterns();
    this.initializeDomainMappings();
  }

  /**
   * Analyze integration requirements for a service
   */
  async analyzeRequirements(request: IntegrationAnalysisRequest): Promise<WizardRecommendation[]> {
    const recommendations: WizardRecommendation[] = [];

    // Analyze domain-specific integrations
    const domainIntegrations = await this.analyzeDomainIntegrations(request);
    recommendations.push(...domainIntegrations);

    // Analyze service-to-service integrations
    const serviceIntegrations = await this.analyzeServiceIntegrations(request);
    recommendations.push(...serviceIntegrations);

    // Analyze security requirements
    const securityRequirements = await this.analyzeSecurityRequirements(request);
    recommendations.push(...securityRequirements);

    // Analyze data integration needs
    const dataIntegrations = await this.analyzeDataIntegrations(request);
    recommendations.push(...dataIntegrations);

    // Analyze monitoring and observability needs
    const monitoringNeeds = await this.analyzeMonitoringNeeds(request);
    recommendations.push(...monitoringNeeds);

    return recommendations.sort((a, b) => this.getRecommendationScore(b) - this.getRecommendationScore(a));
  }

  /**
   * Get recommended integration patterns for service characteristics
   */
  getRecommendedPatterns(characteristics: {
    consistency: 'eventual' | 'strong';
    latency: 'low' | 'medium' | 'high';
    availability: 'low' | 'medium' | 'high';
    scalability: 'low' | 'medium' | 'high';
  }): IntegrationPattern[] {
    const patterns: IntegrationPattern[] = [];

    for (const [name, pattern] of this.integrationPatterns) {
      let score = 0;

      // Score based on characteristics
      if (characteristics.consistency === 'eventual' && pattern.type === 'asynchronous') score += 2;
      if (characteristics.consistency === 'strong' && pattern.type === 'synchronous') score += 2;
      if (characteristics.latency === 'low' && pattern.latency === 'low') score += 2;
      if (characteristics.availability === 'high' && pattern.reliability === 'high') score += 1;
      if (characteristics.scalability === 'high' && pattern.scalability === 'high') score += 1;

      if (score >= 3) {
        patterns.push(pattern);
      }
    }

    return patterns.sort((a, b) => {
      const scoreA = this.calculatePatternScore(a, characteristics);
      const scoreB = this.calculatePatternScore(b, characteristics);
      return scoreB - scoreA;
    });
  }

  /**
   * Analyze integration security requirements
   */
  analyzeIntegrationSecurity(integrations: IntegrationRequirement[]): SecurityRequirement {
    let requiresAuthentication = false;
    let requiresAuthorization = false;
    let requiresEncryption = false;
    let requiresAuditLogging = false;
    let requiresRateLimiting = false;

    const standards: string[] = [];
    let reason = '';

    for (const integration of integrations) {
      if (integration.type === 'external-api') {
        requiresAuthentication = true;
        requiresEncryption = true;
        requiresRateLimiting = true;
        standards.push('OAuth 2.0', 'TLS 1.3');
        reason += 'External API access requires secure authentication and encryption. ';
      }

      if (integration.priority === 'high' || integration.type === 'database') {
        requiresAuthorization = true;
        requiresAuditLogging = true;
        reason += 'High-priority integrations require authorization and audit logging. ';
      }
    }

    return {
      authentication: requiresAuthentication,
      authorization: requiresAuthorization,
      encryption: requiresEncryption,
      auditLogging: requiresAuditLogging,
      rateLimiting: requiresRateLimiting,
      inputValidation: true, // Always required
      outputSanitization: true, // Always required
      reason: reason || 'Basic security requirements for service integrations',
      standards: [...new Set(standards)]
    };
  }

  /**
   * Generate integration architecture recommendations
   */
  generateArchitectureRecommendations(requirements: IntegrationRequirement[]): {
    patterns: string[];
    infrastructure: string[];
    monitoring: string[];
    security: string[];
  } {
    const recommendations = {
      patterns: [] as string[],
      infrastructure: [] as string[],
      monitoring: [] as string[],
      security: [] as string[]
    };

    const hasAsyncIntegrations = requirements.some(req => req.pattern === 'event-driven');
    const hasSyncIntegrations = requirements.some(req => req.pattern === 'request-response');
    const hasExternalApis = requirements.some(req => req.type === 'external-api');

    if (hasAsyncIntegrations) {
      recommendations.patterns.push('Implement event-driven architecture with message queues');
      recommendations.infrastructure.push('Set up message broker (Redis, RabbitMQ, or Kafka)');
      recommendations.monitoring.push('Monitor message queue health and processing times');
    }

    if (hasSyncIntegrations) {
      recommendations.patterns.push('Implement circuit breaker pattern for resilience');
      recommendations.patterns.push('Use API versioning strategy');
      recommendations.monitoring.push('Monitor API response times and error rates');
    }

    if (hasExternalApis) {
      recommendations.security.push('Implement API key management and rotation');
      recommendations.security.push('Add request/response logging for external calls');
      recommendations.infrastructure.push('Configure HTTP client with timeouts and retries');
    }

    return recommendations;
  }

  /**
   * Analyze domain-specific integration needs
   */
  private async analyzeDomainIntegrations(request: IntegrationAnalysisRequest): Promise<WizardRecommendation[]> {
    const recommendations: WizardRecommendation[] = [];

    if (!request.domain) return recommendations;

    const commonIntegrations = this.domainMappings.get(request.domain) || [];
    
    for (const integration of commonIntegrations) {
      recommendations.push({
        type: 'integration',
        title: `${integration} Integration`,
        description: `Services in ${request.domain} domain commonly integrate with ${integration}`,
        severity: 'info',
        suggestion: `Consider integrating with ${integration} for enhanced functionality`,
        impact: {
          complexity: 'medium',
          maintenance: 'medium',
          performance: 'neutral'
        }
      });
    }

    return recommendations;
  }

  /**
   * Analyze service-to-service integration needs
   */
  private async analyzeServiceIntegrations(request: IntegrationAnalysisRequest): Promise<WizardRecommendation[]> {
    const recommendations: WizardRecommendation[] = [];

    // Analyze existing service dependencies
    const potentialDependencies = await this.identifyPotentialDependencies(request);
    
    for (const dependency of potentialDependencies) {
      recommendations.push({
        type: 'integration',
        title: `Service Integration: ${dependency.service}`,
        description: dependency.reason,
        severity: dependency.priority === 'high' ? 'warning' : 'info',
        suggestion: `Consider integrating with ${dependency.service} using ${dependency.pattern}`,
        impact: {
          complexity: dependency.complexity,
          maintenance: 'medium',
          performance: dependency.pattern === 'asynchronous' ? 'positive' : 'neutral'
        }
      });
    }

    return recommendations;
  }

  /**
   * Analyze security requirements
   */
  private async analyzeSecurityRequirements(request: IntegrationAnalysisRequest): Promise<WizardRecommendation[]> {
    const recommendations: WizardRecommendation[] = [];

    // Always recommend authentication for services
    recommendations.push({
      type: 'security',
      title: 'Authentication Required',
      description: 'All services should implement authentication',
      severity: 'warning',
      suggestion: 'Implement OAuth 2.0 or JWT-based authentication',
      impact: {
        complexity: 'medium',
        maintenance: 'medium',
        performance: 'neutral'
      }
    });

    // Recommend authorization for sensitive domains
    const sensitiveDomains = ['user-management', 'payment', 'admin'];
    if (request.domain && sensitiveDomains.includes(request.domain)) {
      recommendations.push({
        type: 'security',
        title: 'Role-Based Authorization',
        description: `${request.domain} services require fine-grained access control`,
        severity: 'warning',
        suggestion: 'Implement RBAC with proper permission checks',
        impact: {
          complexity: 'high',
          maintenance: 'medium',
          performance: 'neutral'
        }
      });
    }

    return recommendations;
  }

  /**
   * Analyze data integration needs
   */
  private async analyzeDataIntegrations(request: IntegrationAnalysisRequest): Promise<WizardRecommendation[]> {
    const recommendations: WizardRecommendation[] = [];

    // Recommend database integration patterns
    recommendations.push({
      type: 'integration',
      title: 'Database Connection Pooling',
      description: 'Use connection pooling for database efficiency',
      severity: 'info',
      suggestion: 'Configure database connection pooling',
      impact: {
        complexity: 'low',
        maintenance: 'low',
        performance: 'positive'
      }
    });

    // Recommend caching for read-heavy services
    if (request.serviceType === 'api' || request.domain === 'content') {
      recommendations.push({
        type: 'integration',
        title: 'Caching Layer',
        description: 'Add caching for improved performance',
        severity: 'info',
        suggestion: 'Implement Redis caching for frequently accessed data',
        impact: {
          complexity: 'medium',
          maintenance: 'medium',
          performance: 'positive'
        }
      });
    }

    return recommendations;
  }

  /**
   * Analyze monitoring and observability needs
   */
  private async analyzeMonitoringNeeds(request: IntegrationAnalysisRequest): Promise<WizardRecommendation[]> {
    const recommendations: WizardRecommendation[] = [];

    // Always recommend basic monitoring
    recommendations.push({
      type: 'best-practice',
      title: 'Health Check Endpoint',
      description: 'Implement health check endpoint for monitoring',
      severity: 'info',
      suggestion: 'Add /health endpoint with dependency checks',
      impact: {
        complexity: 'low',
        maintenance: 'low',
        performance: 'neutral'
      }
    });

    // Recommend metrics for production services
    recommendations.push({
      type: 'best-practice',
      title: 'Metrics Collection',
      description: 'Collect application and business metrics',
      severity: 'info',
      suggestion: 'Implement Prometheus metrics collection',
      impact: {
        complexity: 'medium',
        maintenance: 'low',
        performance: 'neutral'
      }
    });

    return recommendations;
  }

  /**
   * Identify potential service dependencies
   */
  private async identifyPotentialDependencies(request: IntegrationAnalysisRequest): Promise<Array<{
    service: string;
    reason: string;
    pattern: string;
    priority: 'high' | 'medium' | 'low';
    complexity: 'low' | 'medium' | 'high';
  }>> {
    const dependencies: any[] = [];

    // Domain-based dependencies
    if (request.domain === 'user-management') {
      dependencies.push({
        service: 'authentication-service',
        reason: 'User management typically requires authentication services',
        pattern: 'request-response',
        priority: 'high' as const,
        complexity: 'medium' as const
      });
      
      dependencies.push({
        service: 'notification-service',
        reason: 'User events often trigger notifications',
        pattern: 'event-driven',
        priority: 'medium' as const,
        complexity: 'low' as const
      });
    }

    if (request.domain === 'payment') {
      dependencies.push({
        service: 'user-service',
        reason: 'Payment processing requires user verification',
        pattern: 'request-response',
        priority: 'high' as const,
        complexity: 'medium' as const
      });
    }

    // Check existing services for potential integrations
    for (const existingService of request.existingServices) {
      if (this.shouldIntegrate(request.serviceName, existingService, request.domain)) {
        dependencies.push({
          service: existingService,
          reason: `Potential integration with existing ${existingService}`,
          pattern: 'request-response',
          priority: 'medium' as const,
          complexity: 'medium' as const
        });
      }
    }

    return dependencies;
  }

  /**
   * Check if two services should integrate
   */
  private shouldIntegrate(newService: string, existingService: string, domain?: string): boolean {
    // Simple heuristic - services in the same domain or with related names
    if (domain) {
      const domainServices = this.domainMappings.get(domain) || [];
      if (domainServices.includes(existingService)) {
        return true;
      }
    }

    // Check for common integration patterns
    const integrationPairs = [
      ['user', 'auth'],
      ['order', 'payment'],
      ['product', 'inventory'],
      ['notification', 'email']
    ];

    for (const [service1, service2] of integrationPairs) {
      if ((newService.includes(service1) && existingService.includes(service2)) ||
          (newService.includes(service2) && existingService.includes(service1))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate pattern score based on characteristics
   */
  private calculatePatternScore(pattern: IntegrationPattern, characteristics: any): number {
    let score = 0;

    if (characteristics.consistency === 'eventual' && pattern.type === 'asynchronous') score += 3;
    if (characteristics.consistency === 'strong' && pattern.type === 'synchronous') score += 3;
    if (characteristics.latency === 'low' && pattern.latency === 'low') score += 2;
    if (characteristics.availability === 'high' && pattern.reliability === 'high') score += 2;
    if (characteristics.scalability === 'high' && pattern.scalability === 'high') score += 2;

    return score;
  }

  /**
   * Get recommendation score for sorting
   */
  private getRecommendationScore(recommendation: WizardRecommendation): number {
    const severityScores = { error: 10, warning: 7, info: 5 };
    const typeScores = { security: 9, integration: 7, 'best-practice': 5, technology: 6, pattern: 6 };
    
    return severityScores[recommendation.severity] + typeScores[recommendation.type];
  }

  /**
   * Initialize integration patterns
   */
  private initializeIntegrationPatterns(): void {
    const patterns: IntegrationPattern[] = [
      {
        name: 'Request-Response',
        type: 'synchronous',
        description: 'Direct synchronous communication between services',
        pros: ['Simple to implement', 'Strong consistency', 'Real-time responses'],
        cons: ['Coupling between services', 'Cascade failures', 'Latency accumulation'],
        bestFor: ['Real-time queries', 'Transaction processing', 'User interactions'],
        complexity: 'low',
        reliability: 'medium',
        latency: 'low',
        scalability: 'medium'
      },
      {
        name: 'Event-Driven',
        type: 'asynchronous',
        description: 'Asynchronous communication through events',
        pros: ['Loose coupling', 'High scalability', 'Fault tolerance'],
        cons: ['Eventual consistency', 'Complex debugging', 'Message ordering'],
        bestFor: ['Background processing', 'Notifications', 'Data synchronization'],
        complexity: 'high',
        reliability: 'high',
        latency: 'medium',
        scalability: 'high'
      },
      {
        name: 'API Gateway',
        type: 'synchronous',
        description: 'Centralized API management and routing',
        pros: ['Centralized security', 'Rate limiting', 'Protocol translation'],
        cons: ['Single point of failure', 'Additional latency', 'Complexity'],
        bestFor: ['External API exposure', 'Cross-cutting concerns', 'API versioning'],
        complexity: 'medium',
        reliability: 'medium',
        latency: 'medium',
        scalability: 'high'
      }
    ];

    for (const pattern of patterns) {
      this.integrationPatterns.set(pattern.name.toLowerCase().replace(' ', '-'), pattern);
    }
  }

  /**
   * Initialize domain mappings
   */
  private initializeDomainMappings(): void {
    this.domainMappings.set('user-management', [
      'authentication-service',
      'notification-service',
      'audit-service'
    ]);
    
    this.domainMappings.set('payment', [
      'user-service',
      'order-service',
      'notification-service',
      'audit-service'
    ]);
    
    this.domainMappings.set('content', [
      'media-service',
      'search-service',
      'cache-service'
    ]);
    
    this.domainMappings.set('analytics', [
      'data-warehouse',
      'reporting-service',
      'metrics-service'
    ]);
  }
}