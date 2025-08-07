import { Entity } from '@/services/backstage/types/entities';

export interface ServiceHealth {
  entityRef: string;
  entityName: string;
  entityKind: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  score: number; // 0-100
  metrics: HealthMetrics;
  indicators: HealthIndicator[];
  dependencies: DependencyHealth[];
  history: HealthSnapshot[];
  lastCheck: Date;
  nextCheck: Date;
}

export interface HealthMetrics {
  availability: number; // Percentage uptime
  latency: number; // Average response time in ms
  errorRate: number; // Percentage of failed requests
  throughput: number; // Requests per second
  saturation: number; // Resource utilization percentage
  apdex: number; // Application Performance Index
  sli: ServiceLevelIndicators;
}

export interface ServiceLevelIndicators {
  availability: { current: number; target: number; status: 'met' | 'at-risk' | 'breached' };
  latency: { current: number; target: number; status: 'met' | 'at-risk' | 'breached' };
  errorRate: { current: number; target: number; status: 'met' | 'at-risk' | 'breached' };
}

export interface HealthIndicator {
  name: string;
  category: 'performance' | 'reliability' | 'security' | 'compliance' | 'cost';
  value: number;
  status: 'good' | 'warning' | 'critical';
  trend: 'improving' | 'stable' | 'degrading';
  message?: string;
}

export interface DependencyHealth {
  entityRef: string;
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  impact: 'critical' | 'high' | 'medium' | 'low';
  latency?: number;
}

export interface HealthSnapshot {
  timestamp: Date;
  score: number;
  status: string;
  metrics: Partial<HealthMetrics>;
}

export interface QualityMetrics {
  codeQuality: {
    coverage: number;
    complexity: number;
    duplications: number;
    technicalDebt: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  documentation: {
    completeness: number;
    freshness: number; // Days since last update
    coverage: number;
  };
  testing: {
    unitTestCoverage: number;
    integrationTestCoverage: number;
    e2eTestCoverage: number;
    testSuccessRate: number;
  };
  security: {
    vulnerabilities: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    lastScan: Date;
    complianceScore: number;
  };
  deployment: {
    frequency: number; // Deployments per week
    leadTime: number; // Hours from commit to production
    mttr: number; // Mean time to recovery in minutes
    changeFailureRate: number; // Percentage
  };
}

export interface ServiceQuality {
  entityRef: string;
  entityName: string;
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  metrics: QualityMetrics;
  recommendations: QualityRecommendation[];
  trends: QualityTrend[];
}

export interface QualityRecommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  actions: string[];
}

export interface QualityTrend {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  change: number; // Percentage change
  period: string; // e.g., "last 7 days"
}

export class ServiceHealthMonitor {
  private healthCache = new Map<string, ServiceHealth>();
  private qualityCache = new Map<string, ServiceQuality>();

  async getServiceHealth(entity: Entity): Promise<ServiceHealth> {
    const entityRef = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
    
    // Check cache
    const cached = this.healthCache.get(entityRef);
    if (cached && cached.nextCheck > new Date()) {
      return cached;
    }

    // Simulate health check (in production, this would call actual monitoring APIs)
    const health = await this.performHealthCheck(entity);
    
    // Cache result
    this.healthCache.set(entityRef, health);
    
    return health;
  }

  private async performHealthCheck(entity: Entity): Promise<ServiceHealth> {
    const entityRef = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
    
    // Simulate metrics collection
    const availability = 95 + Math.random() * 5;
    const latency = 50 + Math.random() * 200;
    const errorRate = Math.random() * 5;
    const throughput = 100 + Math.random() * 900;
    const saturation = 20 + Math.random() * 60;
    
    const apdex = this.calculateApdex(latency);
    
    const metrics: HealthMetrics = {
      availability,
      latency,
      errorRate,
      throughput,
      saturation,
      apdex,
      sli: {
        availability: {
          current: availability,
          target: 99.9,
          status: availability >= 99.9 ? 'met' : availability >= 99.5 ? 'at-risk' : 'breached',
        },
        latency: {
          current: latency,
          target: 200,
          status: latency <= 200 ? 'met' : latency <= 300 ? 'at-risk' : 'breached',
        },
        errorRate: {
          current: errorRate,
          target: 1,
          status: errorRate <= 1 ? 'met' : errorRate <= 2 ? 'at-risk' : 'breached',
        },
      },
    };

    const score = this.calculateHealthScore(metrics);
    const status = this.getHealthStatus(score);
    
    const indicators = this.generateHealthIndicators(metrics, entity);
    const dependencies = await this.checkDependencyHealth(entity);
    const history = this.generateHealthHistory(entityRef, score, status, metrics);

    return {
      entityRef,
      entityName: entity.metadata.name,
      entityKind: entity.kind,
      status,
      score,
      metrics,
      indicators,
      dependencies,
      history,
      lastCheck: new Date(),
      nextCheck: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    };
  }

  private calculateApdex(latency: number): number {
    // Apdex = (Satisfied + 0.5 * Tolerating) / Total
    // Satisfied: < 200ms, Tolerating: 200-800ms, Frustrated: > 800ms
    if (latency < 200) return 1;
    if (latency < 800) return 0.5;
    return 0;
  }

  private calculateHealthScore(metrics: HealthMetrics): number {
    // Weighted score calculation
    const weights = {
      availability: 0.3,
      latency: 0.2,
      errorRate: 0.2,
      apdex: 0.2,
      saturation: 0.1,
    };

    const latencyScore = Math.max(0, 100 - (metrics.latency / 10));
    const errorScore = Math.max(0, 100 - (metrics.errorRate * 20));
    const saturationScore = Math.max(0, 100 - metrics.saturation);

    const score = 
      metrics.availability * weights.availability +
      latencyScore * weights.latency +
      errorScore * weights.errorRate +
      metrics.apdex * 100 * weights.apdex +
      saturationScore * weights.saturation;

    return Math.round(score);
  }

  private getHealthStatus(score: number): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' {
    if (score >= 90) return 'healthy';
    if (score >= 70) return 'degraded';
    if (score >= 0) return 'unhealthy';
    return 'unknown';
  }

  private generateHealthIndicators(metrics: HealthMetrics, entity: Entity): HealthIndicator[] {
    const indicators: HealthIndicator[] = [];

    // Performance indicators
    indicators.push({
      name: 'Response Time',
      category: 'performance',
      value: metrics.latency,
      status: metrics.latency < 200 ? 'good' : metrics.latency < 500 ? 'warning' : 'critical',
      trend: 'stable',
      message: `Average response time: ${metrics.latency.toFixed(0)}ms`,
    });

    indicators.push({
      name: 'Throughput',
      category: 'performance',
      value: metrics.throughput,
      status: metrics.throughput > 500 ? 'good' : metrics.throughput > 100 ? 'warning' : 'critical',
      trend: 'improving',
      message: `${metrics.throughput.toFixed(0)} requests/second`,
    });

    // Reliability indicators
    indicators.push({
      name: 'Availability',
      category: 'reliability',
      value: metrics.availability,
      status: metrics.availability >= 99.9 ? 'good' : metrics.availability >= 99 ? 'warning' : 'critical',
      trend: 'stable',
      message: `${metrics.availability.toFixed(2)}% uptime`,
    });

    indicators.push({
      name: 'Error Rate',
      category: 'reliability',
      value: metrics.errorRate,
      status: metrics.errorRate < 1 ? 'good' : metrics.errorRate < 5 ? 'warning' : 'critical',
      trend: metrics.errorRate < 2 ? 'improving' : 'degrading',
      message: `${metrics.errorRate.toFixed(2)}% errors`,
    });

    // Resource indicators
    indicators.push({
      name: 'Resource Utilization',
      category: 'performance',
      value: metrics.saturation,
      status: metrics.saturation < 70 ? 'good' : metrics.saturation < 85 ? 'warning' : 'critical',
      trend: 'stable',
      message: `${metrics.saturation.toFixed(0)}% utilized`,
    });

    return indicators;
  }

  private async checkDependencyHealth(entity: Entity): Promise<DependencyHealth[]> {
    const dependencies: DependencyHealth[] = [];

    // Simulate dependency health checks
    if (entity.spec?.dependsOn) {
      const deps = Array.isArray(entity.spec.dependsOn) ? entity.spec.dependsOn : [entity.spec.dependsOn];
      
      for (const dep of deps) {
        const health = Math.random();
        dependencies.push({
          entityRef: dep,
          name: dep.split('/').pop() || dep,
          status: health > 0.9 ? 'healthy' : health > 0.7 ? 'degraded' : 'unhealthy',
          impact: 'high',
          latency: 10 + Math.random() * 50,
        });
      }
    }

    return dependencies;
  }

  private generateHealthHistory(entityRef: string, score: number, status: string, metrics: Partial<HealthMetrics>): HealthSnapshot[] {
    const history: HealthSnapshot[] = [];
    const now = new Date();

    // Generate last 24 hours of history
    for (let i = 24; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      const variance = (Math.random() - 0.5) * 10;
      
      history.push({
        timestamp,
        score: Math.max(0, Math.min(100, score + variance)),
        status,
        metrics: {
          availability: metrics.availability ? metrics.availability + (Math.random() - 0.5) * 2 : undefined,
          latency: metrics.latency ? metrics.latency + (Math.random() - 0.5) * 50 : undefined,
          errorRate: metrics.errorRate ? Math.max(0, metrics.errorRate + (Math.random() - 0.5) * 2) : undefined,
        },
      });
    }

    return history;
  }

  async getServiceQuality(entity: Entity): Promise<ServiceQuality> {
    const entityRef = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
    
    // Check cache
    const cached = this.qualityCache.get(entityRef);
    if (cached) {
      return cached;
    }

    // Generate quality metrics
    const quality = await this.assessServiceQuality(entity);
    
    // Cache result
    this.qualityCache.set(entityRef, quality);
    
    return quality;
  }

  private async assessServiceQuality(entity: Entity): Promise<ServiceQuality> {
    const entityRef = `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`;
    
    // Simulate quality metrics
    const metrics: QualityMetrics = {
      codeQuality: {
        coverage: 60 + Math.random() * 30,
        complexity: 5 + Math.random() * 15,
        duplications: Math.random() * 10,
        technicalDebt: Math.random() * 100,
        grade: this.calculateGrade(70 + Math.random() * 20),
      },
      documentation: {
        completeness: 50 + Math.random() * 40,
        freshness: Math.floor(Math.random() * 30),
        coverage: 60 + Math.random() * 30,
      },
      testing: {
        unitTestCoverage: 50 + Math.random() * 40,
        integrationTestCoverage: 30 + Math.random() * 50,
        e2eTestCoverage: 20 + Math.random() * 60,
        testSuccessRate: 85 + Math.random() * 15,
      },
      security: {
        vulnerabilities: {
          critical: Math.floor(Math.random() * 2),
          high: Math.floor(Math.random() * 5),
          medium: Math.floor(Math.random() * 10),
          low: Math.floor(Math.random() * 20),
        },
        lastScan: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        complianceScore: 70 + Math.random() * 25,
      },
      deployment: {
        frequency: Math.random() * 10,
        leadTime: 1 + Math.random() * 48,
        mttr: 5 + Math.random() * 120,
        changeFailureRate: Math.random() * 20,
      },
    };

    const overallScore = this.calculateQualityScore(metrics);
    const grade = this.calculateGrade(overallScore);
    const recommendations = this.generateRecommendations(metrics, entity);
    const trends = this.generateQualityTrends(metrics);

    return {
      entityRef,
      entityName: entity.metadata.name,
      overallScore,
      grade,
      metrics,
      recommendations,
      trends,
    };
  }

  private calculateQualityScore(metrics: QualityMetrics): number {
    const weights = {
      codeQuality: 0.25,
      documentation: 0.15,
      testing: 0.3,
      security: 0.2,
      deployment: 0.1,
    };

    const codeScore = (100 - metrics.codeQuality.complexity * 2 - metrics.codeQuality.duplications * 3) * 0.5 + 
                      metrics.codeQuality.coverage * 0.5;
    
    const docScore = (metrics.documentation.completeness + metrics.documentation.coverage) / 2 -
                     Math.min(20, metrics.documentation.freshness);
    
    const testScore = (metrics.testing.unitTestCoverage * 0.4 +
                      metrics.testing.integrationTestCoverage * 0.3 +
                      metrics.testing.e2eTestCoverage * 0.2 +
                      metrics.testing.testSuccessRate * 0.1);
    
    const securityScore = metrics.security.complianceScore -
                         (metrics.security.vulnerabilities.critical * 20 +
                          metrics.security.vulnerabilities.high * 10 +
                          metrics.security.vulnerabilities.medium * 5 +
                          metrics.security.vulnerabilities.low * 1);
    
    const deploymentScore = 100 -
                           (metrics.deployment.changeFailureRate * 2 +
                            Math.min(30, metrics.deployment.mttr / 4) +
                            Math.min(20, metrics.deployment.leadTime / 2));

    const score = 
      Math.max(0, codeScore) * weights.codeQuality +
      Math.max(0, docScore) * weights.documentation +
      Math.max(0, testScore) * weights.testing +
      Math.max(0, securityScore) * weights.security +
      Math.max(0, deploymentScore) * weights.deployment;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private generateRecommendations(metrics: QualityMetrics, entity: Entity): QualityRecommendation[] {
    const recommendations: QualityRecommendation[] = [];

    // Code quality recommendations
    if (metrics.codeQuality.coverage < 80) {
      recommendations.push({
        id: 'increase-code-coverage',
        priority: 'high',
        category: 'Code Quality',
        title: 'Increase Code Coverage',
        description: `Current code coverage is ${metrics.codeQuality.coverage.toFixed(0)}%. Aim for at least 80% coverage.`,
        impact: 'Reduces bugs and improves maintainability',
        effort: 'medium',
        actions: [
          'Add unit tests for uncovered code paths',
          'Set up coverage reporting in CI/CD',
          'Establish coverage targets for new code',
        ],
      });
    }

    if (metrics.codeQuality.complexity > 10) {
      recommendations.push({
        id: 'reduce-complexity',
        priority: 'medium',
        category: 'Code Quality',
        title: 'Reduce Code Complexity',
        description: `Average cyclomatic complexity is ${metrics.codeQuality.complexity.toFixed(1)}. Consider refactoring complex methods.`,
        impact: 'Improves readability and reduces bugs',
        effort: 'high',
        actions: [
          'Identify complex methods using static analysis',
          'Break down large functions into smaller ones',
          'Extract reusable logic into separate modules',
        ],
      });
    }

    // Security recommendations
    if (metrics.security.vulnerabilities.critical > 0) {
      recommendations.push({
        id: 'fix-critical-vulnerabilities',
        priority: 'critical',
        category: 'Security',
        title: 'Fix Critical Security Vulnerabilities',
        description: `${metrics.security.vulnerabilities.critical} critical vulnerabilities detected. Immediate action required.`,
        impact: 'Prevents security breaches and data loss',
        effort: 'low',
        actions: [
          'Review security scan results',
          'Update vulnerable dependencies',
          'Apply security patches',
        ],
      });
    }

    // Testing recommendations
    if (metrics.testing.unitTestCoverage < 70) {
      recommendations.push({
        id: 'improve-unit-tests',
        priority: 'high',
        category: 'Testing',
        title: 'Improve Unit Test Coverage',
        description: `Unit test coverage is only ${metrics.testing.unitTestCoverage.toFixed(0)}%. Target at least 70%.`,
        impact: 'Catches bugs early and enables confident refactoring',
        effort: 'medium',
        actions: [
          'Write tests for critical business logic',
          'Add tests for edge cases',
          'Use test-driven development for new features',
        ],
      });
    }

    // Documentation recommendations
    if (metrics.documentation.freshness > 14) {
      recommendations.push({
        id: 'update-documentation',
        priority: 'medium',
        category: 'Documentation',
        title: 'Update Stale Documentation',
        description: `Documentation hasn't been updated in ${metrics.documentation.freshness} days.`,
        impact: 'Improves developer onboarding and reduces confusion',
        effort: 'low',
        actions: [
          'Review and update API documentation',
          'Update README with recent changes',
          'Add documentation for new features',
        ],
      });
    }

    // Deployment recommendations
    if (metrics.deployment.mttr > 60) {
      recommendations.push({
        id: 'reduce-mttr',
        priority: 'high',
        category: 'Operations',
        title: 'Reduce Mean Time to Recovery',
        description: `MTTR is ${metrics.deployment.mttr.toFixed(0)} minutes. Aim for under 60 minutes.`,
        impact: 'Minimizes downtime and improves reliability',
        effort: 'medium',
        actions: [
          'Implement automated rollback procedures',
          'Improve monitoring and alerting',
          'Create runbooks for common issues',
        ],
      });
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private generateQualityTrends(metrics: QualityMetrics): QualityTrend[] {
    const trends: QualityTrend[] = [];

    // Simulate trends
    trends.push({
      metric: 'Code Coverage',
      direction: Math.random() > 0.5 ? 'up' : 'down',
      change: Math.random() * 10,
      period: 'last 7 days',
    });

    trends.push({
      metric: 'Test Success Rate',
      direction: Math.random() > 0.3 ? 'up' : Math.random() > 0.7 ? 'down' : 'stable',
      change: Math.random() * 5,
      period: 'last 7 days',
    });

    trends.push({
      metric: 'Deployment Frequency',
      direction: 'up',
      change: 15,
      period: 'last 30 days',
    });

    trends.push({
      metric: 'Security Score',
      direction: metrics.security.vulnerabilities.critical > 0 ? 'down' : 'stable',
      change: Math.random() * 8,
      period: 'since last scan',
    });

    return trends;
  }

  async getFleetHealth(entities: Entity[]): Promise<{
    overall: ServiceHealth;
    byKind: Map<string, ServiceHealth[]>;
    byStatus: Map<string, ServiceHealth[]>;
    critical: ServiceHealth[];
  }> {
    const healthResults = await Promise.all(
      entities.map(entity => this.getServiceHealth(entity))
    );

    // Calculate fleet-wide metrics
    const overallMetrics: HealthMetrics = {
      availability: healthResults.reduce((sum, h) => sum + h.metrics.availability, 0) / healthResults.length,
      latency: healthResults.reduce((sum, h) => sum + h.metrics.latency, 0) / healthResults.length,
      errorRate: healthResults.reduce((sum, h) => sum + h.metrics.errorRate, 0) / healthResults.length,
      throughput: healthResults.reduce((sum, h) => sum + h.metrics.throughput, 0),
      saturation: healthResults.reduce((sum, h) => sum + h.metrics.saturation, 0) / healthResults.length,
      apdex: healthResults.reduce((sum, h) => sum + h.metrics.apdex, 0) / healthResults.length,
      sli: {
        availability: {
          current: 0,
          target: 99.9,
          status: 'met',
        },
        latency: {
          current: 0,
          target: 200,
          status: 'met',
        },
        errorRate: {
          current: 0,
          target: 1,
          status: 'met',
        },
      },
    };

    const overallScore = this.calculateHealthScore(overallMetrics);

    const overall: ServiceHealth = {
      entityRef: 'fleet:overall',
      entityName: 'Overall Fleet',
      entityKind: 'Fleet',
      status: this.getHealthStatus(overallScore),
      score: overallScore,
      metrics: overallMetrics,
      indicators: this.generateHealthIndicators(overallMetrics, entities[0]),
      dependencies: [],
      history: [],
      lastCheck: new Date(),
      nextCheck: new Date(Date.now() + 5 * 60 * 1000),
    };

    // Group by kind
    const byKind = new Map<string, ServiceHealth[]>();
    healthResults.forEach(health => {
      const kind = health.entityKind;
      if (!byKind.has(kind)) {
        byKind.set(kind, []);
      }
      byKind.get(kind)!.push(health);
    });

    // Group by status
    const byStatus = new Map<string, ServiceHealth[]>();
    healthResults.forEach(health => {
      const status = health.status;
      if (!byStatus.has(status)) {
        byStatus.set(status, []);
      }
      byStatus.get(status)!.push(health);
    });

    // Find critical services
    const critical = healthResults.filter(h => h.status === 'unhealthy' || h.score < 70);

    return {
      overall,
      byKind,
      byStatus,
      critical,
    };
  }
}