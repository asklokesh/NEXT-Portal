// Recommendation Generation Service

import { EventEmitter } from 'events';
import {
  Recommendation,
  RecommendationCategory,
  RecommendationType,
  ServiceMetrics,
  Impact,
  EffortEstimate,
  Evidence,
  ImplementationGuide,
  Risk,
  CodeExample,
  Resource
} from './types';

interface RecommendationTemplate {
  type: RecommendationType;
  category: RecommendationCategory;
  titleTemplate: string;
  descriptionTemplate: string;
  baseImpact: Partial<Impact>;
  baseEffort: Partial<EffortEstimate>;
  implementationSteps: string[];
  codeExamples?: CodeExample[];
  resources: Resource[];
  commonRisks: Risk[];
}

export class RecommendationGenerator extends EventEmitter {
  private templates: Map<RecommendationType, RecommendationTemplate>;
  private codeExampleRepository: CodeExampleRepository;
  private resourceLibrary: ResourceLibrary;

  constructor() {
    super();
    this.templates = new Map();
    this.codeExampleRepository = new CodeExampleRepository();
    this.resourceLibrary = new ResourceLibrary();
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // Code Quality Templates
    this.templates.set(RecommendationType.CODE_REFACTORING, {
      type: RecommendationType.CODE_REFACTORING,
      category: RecommendationCategory.QUALITY,
      titleTemplate: 'Refactor {component} to Improve Maintainability',
      descriptionTemplate: 'Code complexity in {component} exceeds thresholds. Refactoring will improve readability and reduce technical debt.',
      baseImpact: {
        performance: 10,
        maintainability: 70,
        reliability: 30
      },
      baseEffort: {
        complexity: 'medium',
        skills: ['Refactoring', 'Design Patterns', 'Testing']
      },
      implementationSteps: [
        'Identify code smells and anti-patterns',
        'Write comprehensive tests for existing functionality',
        'Apply refactoring patterns (Extract Method, Extract Class, etc.)',
        'Ensure all tests pass',
        'Update documentation'
      ],
      resources: [
        {
          type: 'documentation',
          title: 'Refactoring Techniques',
          url: 'https://refactoring.guru',
          description: 'Comprehensive guide to refactoring patterns'
        }
      ],
      commonRisks: [
        {
          type: 'regression',
          probability: 'medium',
          impact: 'high',
          description: 'Refactoring may introduce bugs',
          mitigation: 'Comprehensive test coverage before refactoring'
        }
      ]
    });

    // Dependency Management Templates
    this.templates.set(RecommendationType.DEPENDENCY_UPDATE, {
      type: RecommendationType.DEPENDENCY_UPDATE,
      category: RecommendationCategory.QUALITY,
      titleTemplate: 'Update {count} Outdated Dependencies',
      descriptionTemplate: 'Multiple dependencies are outdated, including {critical} with security vulnerabilities.',
      baseImpact: {
        security: 60,
        maintainability: 40,
        reliability: 20
      },
      baseEffort: {
        complexity: 'low',
        skills: ['Dependency Management', 'Testing']
      },
      implementationSteps: [
        'Run dependency audit',
        'Review changelog for breaking changes',
        'Update dependencies incrementally',
        'Run full test suite',
        'Monitor for issues in staging'
      ],
      resources: [],
      commonRisks: [
        {
          type: 'breaking_changes',
          probability: 'medium',
          impact: 'medium',
          description: 'Updates may introduce breaking changes',
          mitigation: 'Incremental updates with thorough testing'
        }
      ]
    });

    // Team Collaboration Templates
    this.templates.set(RecommendationType.OWNERSHIP_CLARIFICATION, {
      type: RecommendationType.OWNERSHIP_CLARIFICATION,
      category: RecommendationCategory.COLLABORATION,
      titleTemplate: 'Clarify Ownership for {service}',
      descriptionTemplate: 'Service ownership is unclear, leading to delays in incident response and feature development.',
      baseImpact: {
        maintainability: 50,
        reliability: 30,
        businessValue: 40
      },
      baseEffort: {
        hours: 2,
        teamSize: 1,
        complexity: 'low',
        skills: ['Team Management', 'Documentation']
      },
      implementationSteps: [
        'Identify current maintainers',
        'Define ownership responsibilities',
        'Update service catalog with ownership info',
        'Create on-call rotation if needed',
        'Document escalation procedures'
      ],
      resources: [],
      commonRisks: []
    });

    // Technology Stack Templates
    this.templates.set(RecommendationType.FRAMEWORK_UPGRADE, {
      type: RecommendationType.FRAMEWORK_UPGRADE,
      category: RecommendationCategory.TECHNOLOGY,
      titleTemplate: 'Upgrade {framework} from {currentVersion} to {targetVersion}',
      descriptionTemplate: 'Framework version is significantly outdated, missing performance improvements and security patches.',
      baseImpact: {
        performance: 30,
        security: 50,
        maintainability: 40
      },
      baseEffort: {
        complexity: 'high',
        skills: ['Framework Expertise', 'Migration', 'Testing']
      },
      implementationSteps: [
        'Review migration guide',
        'Set up parallel environment',
        'Migrate code incrementally',
        'Update dependencies',
        'Perform thorough testing',
        'Plan rollback strategy'
      ],
      resources: [],
      commonRisks: [
        {
          type: 'compatibility',
          probability: 'high',
          impact: 'high',
          description: 'Potential compatibility issues with existing code',
          mitigation: 'Incremental migration with feature flags'
        }
      ]
    });

    // Service Consolidation Templates
    this.templates.set(RecommendationType.SERVICE_CONSOLIDATION, {
      type: RecommendationType.SERVICE_CONSOLIDATION,
      category: RecommendationCategory.ARCHITECTURE,
      titleTemplate: 'Consolidate {services} into Unified Service',
      descriptionTemplate: 'Multiple small services with similar functionality can be consolidated to reduce operational overhead.',
      baseImpact: {
        cost: 40,
        maintainability: 50,
        reliability: 20
      },
      baseEffort: {
        complexity: 'high',
        skills: ['System Design', 'Migration', 'API Design']
      },
      implementationSteps: [
        'Analyze service dependencies',
        'Design consolidated architecture',
        'Create migration plan',
        'Implement unified service',
        'Migrate data and traffic',
        'Decommission old services'
      ],
      resources: [],
      commonRisks: [
        {
          type: 'single_point_of_failure',
          probability: 'medium',
          impact: 'high',
          description: 'Consolidation creates single point of failure',
          mitigation: 'Implement proper redundancy and failover'
        }
      ]
    });
  }

  async generateRecommendation(
    type: RecommendationType,
    serviceId: string,
    context: any,
    evidence: Evidence[]
  ): Promise<Recommendation> {
    const template = this.templates.get(type);
    if (!template) {
      throw new Error(`No template found for recommendation type: ${type}`);
    }

    const title = this.interpolateTemplate(template.titleTemplate, context);
    const description = this.interpolateTemplate(template.descriptionTemplate, context);
    
    const impact = this.calculateImpact(template.baseImpact, context);
    const effort = this.calculateEffort(template.baseEffort, context);
    const priority = this.calculatePriority(impact, effort);
    const score = this.calculateScore(impact, effort, evidence);

    const implementation = await this.generateImplementationGuide(
      template,
      context
    );

    const recommendation: Recommendation = {
      id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      serviceId,
      category: template.category,
      type,
      title,
      description,
      impact,
      effort,
      priority,
      score,
      evidence,
      implementation,
      risks: this.assessRisks(template.commonRisks, context),
      dependencies: this.identifyDependencies(type, context),
      status: 'pending' as any,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.emit('recommendation-generated', recommendation);
    return recommendation;
  }

  private interpolateTemplate(template: string, context: any): string {
    return template.replace(/{(\w+)}/g, (match, key) => {
      return context[key] || match;
    });
  }

  private calculateImpact(baseImpact: Partial<Impact>, context: any): Impact {
    const adjustmentFactors = this.getImpactAdjustmentFactors(context);
    
    return {
      performance: (baseImpact.performance || 0) * adjustmentFactors.performance,
      security: (baseImpact.security || 0) * adjustmentFactors.security,
      cost: (baseImpact.cost || 0) * adjustmentFactors.cost,
      reliability: (baseImpact.reliability || 0) * adjustmentFactors.reliability,
      maintainability: (baseImpact.maintainability || 0) * adjustmentFactors.maintainability,
      userExperience: (baseImpact.userExperience || 0) * adjustmentFactors.userExperience,
      businessValue: (baseImpact.businessValue || 0) * adjustmentFactors.businessValue,
      description: this.generateImpactDescription(baseImpact, adjustmentFactors)
    };
  }

  private getImpactAdjustmentFactors(context: any): any {
    // Adjust impact based on service criticality, size, usage, etc.
    const factors = {
      performance: 1.0,
      security: 1.0,
      cost: 1.0,
      reliability: 1.0,
      maintainability: 1.0,
      userExperience: 1.0,
      businessValue: 1.0
    };

    if (context.serviceCriticality === 'high') {
      factors.reliability *= 1.5;
      factors.businessValue *= 1.5;
    }

    if (context.userCount > 10000) {
      factors.userExperience *= 1.3;
      factors.performance *= 1.2;
    }

    return factors;
  }

  private generateImpactDescription(
    impact: Partial<Impact>,
    factors: any
  ): string {
    const descriptions = [];
    
    if (impact.performance && impact.performance > 50) {
      descriptions.push('Significant performance improvements');
    }
    if (impact.security && impact.security > 70) {
      descriptions.push('Critical security enhancements');
    }
    if (impact.cost && impact.cost > 30) {
      descriptions.push('Notable cost savings');
    }
    if (impact.maintainability && impact.maintainability > 60) {
      descriptions.push('Improved developer productivity');
    }

    return descriptions.join('. ');
  }

  private calculateEffort(
    baseEffort: Partial<EffortEstimate>,
    context: any
  ): EffortEstimate {
    const adjustmentFactor = this.getEffortAdjustmentFactor(context);
    
    return {
      hours: (baseEffort.hours || 8) * adjustmentFactor,
      teamSize: baseEffort.teamSize || 1,
      complexity: baseEffort.complexity || 'medium',
      skills: baseEffort.skills || [],
      timeline: this.estimateTimeline(
        (baseEffort.hours || 8) * adjustmentFactor,
        baseEffort.teamSize || 1
      )
    };
  }

  private getEffortAdjustmentFactor(context: any): number {
    let factor = 1.0;
    
    if (context.codeComplexity > 80) factor *= 1.5;
    if (context.technicalDebt > 60) factor *= 1.3;
    if (context.teamExperience === 'low') factor *= 1.4;
    if (context.hasTests === false) factor *= 1.6;
    
    return factor;
  }

  private estimateTimeline(hours: number, teamSize: number): string {
    const effectiveHours = hours / teamSize;
    const workHoursPerDay = 6; // Accounting for meetings, etc.
    const days = Math.ceil(effectiveHours / workHoursPerDay);
    
    if (days <= 1) return 'Immediate';
    if (days <= 2) return '1-2 days';
    if (days <= 5) return '1 week';
    if (days <= 10) return '2 weeks';
    if (days <= 20) return '1 month';
    return `${Math.ceil(days / 20)} months`;
  }

  private calculatePriority(impact: Impact, effort: EffortEstimate): number {
    // Calculate priority based on impact vs effort (ROI)
    const totalImpact = (
      impact.performance +
      impact.security * 1.5 + // Security weighted higher
      impact.cost +
      impact.reliability * 1.2 +
      impact.maintainability +
      impact.userExperience +
      impact.businessValue * 1.3
    ) / 7;

    const effortScore = effort.hours / 8; // Normalize to days
    const complexityMultiplier = 
      effort.complexity === 'low' ? 0.7 :
      effort.complexity === 'medium' ? 1.0 : 1.5;

    const priority = (totalImpact / (effortScore * complexityMultiplier)) * 10;
    
    return Math.min(100, Math.max(0, priority));
  }

  private calculateScore(
    impact: Impact,
    effort: EffortEstimate,
    evidence: Evidence[]
  ): number {
    const impactScore = (
      impact.performance +
      impact.security +
      Math.abs(impact.cost) +
      impact.reliability +
      impact.maintainability +
      impact.userExperience +
      impact.businessValue
    ) / 7;

    const evidenceConfidence = evidence.length > 0
      ? evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length
      : 0.5;

    const effortPenalty = Math.min(30, effort.hours / 10);
    
    const score = (impactScore * evidenceConfidence) - effortPenalty;
    
    return Math.min(100, Math.max(0, score));
  }

  private async generateImplementationGuide(
    template: RecommendationTemplate,
    context: any
  ): Promise<ImplementationGuide> {
    const steps = template.implementationSteps.map((step, index) => ({
      order: index + 1,
      title: step,
      description: this.generateStepDescription(step, context),
      commands: this.generateStepCommands(step, context),
      validation: this.generateStepValidation(step)
    }));

    const codeExamples = await this.codeExampleRepository.getExamples(
      template.type,
      context
    );

    const resources = [
      ...template.resources,
      ...this.resourceLibrary.getResources(template.type)
    ];

    return {
      steps,
      codeExamples,
      resources,
      estimatedDuration: context.estimatedHours || 8,
      rollbackPlan: this.generateRollbackPlan(template.type)
    };
  }

  private generateStepDescription(step: string, context: any): string {
    // Generate detailed description based on step and context
    const descriptions: Record<string, string> = {
      'Identify code smells and anti-patterns': 
        'Use static analysis tools to identify problematic code patterns',
      'Run dependency audit': 
        'Execute npm audit or similar tool to identify vulnerabilities',
      'Review migration guide': 
        'Study official migration documentation and breaking changes'
    };

    return descriptions[step] || step;
  }

  private generateStepCommands(step: string, context: any): string[] {
    const commandMap: Record<string, string[]> = {
      'Run dependency audit': ['npm audit', 'npm audit fix'],
      'Run full test suite': ['npm test', 'npm run test:e2e'],
      'Update dependencies incrementally': [
        'npm update --save',
        'npm dedupe'
      ]
    };

    return commandMap[step] || [];
  }

  private generateStepValidation(step: string): string {
    const validationMap: Record<string, string> = {
      'Run full test suite': 'All tests passing',
      'Update dependencies incrementally': 'No vulnerabilities reported',
      'Write comprehensive tests': 'Code coverage > 80%'
    };

    return validationMap[step] || 'Manual verification required';
  }

  private generateRollbackPlan(type: RecommendationType): string {
    const rollbackPlans: Partial<Record<RecommendationType, string>> = {
      [RecommendationType.FRAMEWORK_UPGRADE]: 
        'Revert to previous version using git, restore database backup if schema changed',
      [RecommendationType.SERVICE_CONSOLIDATION]:
        'Re-enable old services, redirect traffic back, restore data if migrated',
      [RecommendationType.DEPENDENCY_UPDATE]:
        'Revert package.json and package-lock.json, reinstall dependencies'
    };

    return rollbackPlans[type] || 'Revert changes using version control';
  }

  private assessRisks(baseRisks: Risk[], context: any): Risk[] {
    return baseRisks.map(risk => ({
      ...risk,
      probability: this.adjustRiskProbability(risk.probability, context),
      impact: this.adjustRiskImpact(risk.impact, context)
    }));
  }

  private adjustRiskProbability(
    baseProbability: 'low' | 'medium' | 'high',
    context: any
  ): 'low' | 'medium' | 'high' {
    // Adjust based on context factors
    if (context.hasTests === false && baseProbability === 'low') {
      return 'medium';
    }
    if (context.teamExperience === 'low' && baseProbability === 'medium') {
      return 'high';
    }
    return baseProbability;
  }

  private adjustRiskImpact(
    baseImpact: 'low' | 'medium' | 'high',
    context: any
  ): 'low' | 'medium' | 'high' {
    // Adjust based on service criticality
    if (context.serviceCriticality === 'high' && baseImpact !== 'high') {
      return 'high';
    }
    return baseImpact;
  }

  private identifyDependencies(
    type: RecommendationType,
    context: any
  ): string[] {
    const dependencies: string[] = [];

    if (type === RecommendationType.SERVICE_CONSOLIDATION) {
      dependencies.push('database-migration', 'api-versioning');
    }

    if (type === RecommendationType.FRAMEWORK_UPGRADE) {
      dependencies.push('dependency-update', 'test-suite-update');
    }

    if (context.dependentServices) {
      dependencies.push(...context.dependentServices);
    }

    return dependencies;
  }

  async generateBulkRecommendations(
    serviceMetrics: Map<string, ServiceMetrics>,
    globalContext: any
  ): Promise<Map<string, Recommendation[]>> {
    const allRecommendations = new Map<string, Recommendation[]>();

    for (const [serviceId, metrics] of serviceMetrics) {
      const recommendations = await this.generateServiceRecommendations(
        serviceId,
        metrics,
        globalContext
      );
      allRecommendations.set(serviceId, recommendations);
    }

    // Cross-service recommendations
    const crossServiceRecs = await this.generateCrossServiceRecommendations(
      serviceMetrics,
      globalContext
    );

    return allRecommendations;
  }

  private async generateServiceRecommendations(
    serviceId: string,
    metrics: ServiceMetrics,
    context: any
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Check various conditions and generate appropriate recommendations
    if (metrics.quality.testCoverage < 60) {
      const rec = await this.generateRecommendation(
        RecommendationType.TEST_COVERAGE_INCREASE,
        serviceId,
        { ...context, currentCoverage: metrics.quality.testCoverage },
        []
      );
      recommendations.push(rec);
    }

    if (metrics.quality.codeComplexity > 80) {
      const rec = await this.generateRecommendation(
        RecommendationType.CODE_REFACTORING,
        serviceId,
        { ...context, component: 'core business logic' },
        []
      );
      recommendations.push(rec);
    }

    return recommendations;
  }

  private async generateCrossServiceRecommendations(
    serviceMetrics: Map<string, ServiceMetrics>,
    context: any
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Look for consolidation opportunities
    const smallServices = Array.from(serviceMetrics.entries())
      .filter(([_, metrics]) => metrics.performance.throughput < 100);

    if (smallServices.length > 3) {
      // Suggest consolidation
      const serviceIds = smallServices.map(([id]) => id);
      const rec = await this.generateRecommendation(
        RecommendationType.SERVICE_CONSOLIDATION,
        'cross-service',
        {
          ...context,
          services: serviceIds.join(', '),
          count: smallServices.length
        },
        []
      );
      recommendations.push(rec);
    }

    return recommendations;
  }
}

// Code Example Repository
class CodeExampleRepository {
  private examples: Map<RecommendationType, CodeExample[]>;

  constructor() {
    this.examples = new Map();
    this.initializeExamples();
  }

  private initializeExamples(): void {
    this.examples.set(RecommendationType.CACHING_OPTIMIZATION, [
      {
        language: 'typescript',
        title: 'Redis Cache Implementation',
        before: `
// Before: Direct database query
async function getUser(id: string) {
  return await db.users.findOne({ id });
}`,
        after: `
// After: With Redis caching
async function getUser(id: string) {
  const cacheKey = \`user:\${id}\`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const user = await db.users.findOne({ id });
  await redis.set(cacheKey, JSON.stringify(user), 'EX', 3600);
  return user;
}`,
        explanation: 'Implements Redis caching with 1-hour TTL to reduce database load'
      }
    ]);

    this.examples.set(RecommendationType.ASYNC_PROCESSING, [
      {
        language: 'typescript',
        title: 'Convert to Async Processing',
        before: `
// Before: Synchronous processing
async function processOrder(order: Order) {
  await validateOrder(order);
  await calculatePricing(order);
  await sendEmailNotification(order);
  await updateInventory(order);
  return { status: 'completed' };
}`,
        after: `
// After: Async with message queue
async function processOrder(order: Order) {
  await validateOrder(order);
  
  // Queue background jobs
  await queue.add('calculate-pricing', { orderId: order.id });
  await queue.add('send-notification', { orderId: order.id });
  await queue.add('update-inventory', { orderId: order.id });
  
  return { status: 'processing', orderId: order.id };
}`,
        explanation: 'Moves heavy operations to background jobs for better responsiveness'
      }
    ]);
  }

  async getExamples(
    type: RecommendationType,
    context: any
  ): Promise<CodeExample[]> {
    const examples = this.examples.get(type) || [];
    
    // Filter and customize examples based on context
    return examples.map(example => ({
      ...example,
      language: context.language || example.language
    }));
  }
}

// Resource Library
class ResourceLibrary {
  private resources: Map<RecommendationType, Resource[]>;

  constructor() {
    this.resources = new Map();
    this.initializeResources();
  }

  private initializeResources(): void {
    this.resources.set(RecommendationType.CACHING_OPTIMIZATION, [
      {
        type: 'documentation',
        title: 'Redis Best Practices',
        url: 'https://redis.io/docs/best-practices/',
        description: 'Official Redis documentation on caching strategies'
      },
      {
        type: 'tutorial',
        title: 'Implementing Cache-Aside Pattern',
        url: 'https://docs.microsoft.com/azure/architecture/patterns/cache-aside',
        description: 'Microsoft guide on cache-aside pattern implementation'
      }
    ]);

    this.resources.set(RecommendationType.DATABASE_INDEXING, [
      {
        type: 'tool',
        title: 'pganalyze',
        url: 'https://pganalyze.com',
        description: 'PostgreSQL performance monitoring and index recommendations'
      }
    ]);
  }

  getResources(type: RecommendationType): Resource[] {
    return this.resources.get(type) || [];
  }
}