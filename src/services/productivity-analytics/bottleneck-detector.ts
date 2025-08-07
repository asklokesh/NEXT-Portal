/**
 * Productivity Bottleneck Detector
 * 
 * Advanced system for identifying, analyzing, and providing solutions for
 * productivity bottlenecks across the development lifecycle.
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { AnalyticsConfig } from './analytics-config';
import { ProductivityMetrics } from './analytics-orchestrator';

export interface ProductivityBottleneck {
  id: string;
  type: 'code-review' | 'deployment' | 'testing' | 'planning' | 'communication' | 'technical-debt' | 'resource-constraint' | 'skill-gap' | 'process-inefficiency';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedTeams: string[];
  affectedDevelopers: string[];
  affectedProjects: string[];
  detectedAt: Date;
  estimatedImpact: {
    timeDelay: string; // e.g., "2-4 hours per developer per day"
    costImpact: string; // e.g., "$50K annually"
    qualityImpact: string; // e.g., "15% increase in defects"
    satisfactionImpact: string; // e.g., "Reduced developer satisfaction"
  };
  rootCauses: Array<{
    category: string;
    description: string;
    confidence: number; // 0-100
    evidencePoints: string[];
  }>;
  suggestedActions: Array<{
    action: string;
    priority: 'immediate' | 'short-term' | 'medium-term' | 'long-term';
    effort: 'low' | 'medium' | 'high';
    expectedImpact: 'low' | 'medium' | 'high';
    estimatedCost: string;
    timeline: string;
    prerequisites: string[];
    successMetrics: string[];
  }>;
  metrics: {
    occurrenceFrequency: number; // times per week
    averageDuration: number; // hours
    resolutionTime: number; // hours
    recurrenceRate: number; // percentage
  };
  trends: {
    frequency: 'increasing' | 'decreasing' | 'stable';
    severity: 'increasing' | 'decreasing' | 'stable';
    scope: 'expanding' | 'contracting' | 'stable';
  };
}

export interface BottleneckAnalysisResult {
  timestamp: Date;
  totalBottlenecks: number;
  criticalBottlenecks: number;
  bottlenecksByType: Record<string, number>;
  bottlenecksByTeam: Record<string, number>;
  estimatedTotalImpact: {
    timeWasted: string;
    costImpact: string;
    affectedDevelopers: number;
  };
  topBottlenecks: ProductivityBottleneck[];
  trends: {
    newBottlenecks: number;
    resolvedBottlenecks: number;
    deterioratingBottlenecks: number;
    improvingBottlenecks: number;
  };
}

export interface BottleneckDetectionConfig {
  thresholds: {
    codeReviewTurnaround: number; // hours
    deploymentFrequency: number; // deployments per week
    testExecutionTime: number; // minutes
    buildFailureRate: number; // percentage
    taskCycleTime: number; // days
  };
  analysisDepth: 'shallow' | 'medium' | 'deep';
  includeHistoricalAnalysis: boolean;
  confidenceThreshold: number; // 0-100
}

export class BottleneckDetector extends EventEmitter {
  private logger: Logger;
  private config: AnalyticsConfig;
  private detectionConfig: BottleneckDetectionConfig;
  private bottlenecks: Map<string, ProductivityBottleneck> = new Map();
  private detectionRules: Map<string, any> = new Map();
  private historicalData: Map<string, any[]> = new Map();
  private isInitialized: boolean = false;

  constructor(logger: Logger, config: AnalyticsConfig) {
    super();
    this.logger = logger;
    this.config = config;
    this.detectionConfig = {
      thresholds: {
        codeReviewTurnaround: 48, // 2 days
        deploymentFrequency: 5, // minimum per week
        testExecutionTime: 30, // minutes
        buildFailureRate: 15, // percentage
        taskCycleTime: 10 // days
      },
      analysisDepth: 'medium',
      includeHistoricalAnalysis: true,
      confidenceThreshold: 70
    };
  }

  /**
   * Initialize the bottleneck detector
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Bottleneck Detector');
      
      await this.loadDetectionRules();
      await this.loadHistoricalData();
      
      this.isInitialized = true;
      this.logger.info('Bottleneck Detector initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Bottleneck Detector:', error);
      throw error;
    }
  }

  /**
   * Detect all productivity bottlenecks
   */
  async detectBottlenecks(metrics: ProductivityMetrics): Promise<ProductivityBottleneck[]> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      this.logger.info('Detecting productivity bottlenecks', {
        developers: metrics.developerMetrics.length,
        teams: metrics.teamMetrics.length,
        projects: metrics.projectMetrics.length
      });

      const startTime = Date.now();
      const detectedBottlenecks: ProductivityBottleneck[] = [];

      // Run different bottleneck detection algorithms
      const detectionResults = await Promise.all([
        this.detectCodeReviewBottlenecks(metrics),
        this.detectDeploymentBottlenecks(metrics),
        this.detectTestingBottlenecks(metrics),
        this.detectPlanningBottlenecks(metrics),
        this.detectCommunicationBottlenecks(metrics),
        this.detectTechnicalDebtBottlenecks(metrics),
        this.detectResourceConstraintBottlenecks(metrics),
        this.detectSkillGapBottlenecks(metrics),
        this.detectProcessInefficiencies(metrics)
      ]);

      // Combine results
      detectionResults.forEach(results => {
        detectedBottlenecks.push(...results);
      });

      // Filter by confidence threshold
      const highConfidenceBottlenecks = detectedBottlenecks.filter(
        bottleneck => this.calculateBottleneckConfidence(bottleneck) >= this.detectionConfig.confidenceThreshold
      );

      // Sort by severity and impact
      const sortedBottlenecks = this.prioritizeBottlenecks(highConfidenceBottlenecks);

      // Update bottleneck tracking
      for (const bottleneck of sortedBottlenecks) {
        this.bottlenecks.set(bottleneck.id, bottleneck);
      }

      const detectionTime = Date.now() - startTime;
      this.logger.info(`Detected ${sortedBottlenecks.length} bottlenecks in ${detectionTime}ms`);

      this.emit('bottlenecks-detected', {
        count: sortedBottlenecks.length,
        critical: sortedBottlenecks.filter(b => b.severity === 'critical').length,
        detectionTime
      });

      return sortedBottlenecks;

    } catch (error) {
      this.logger.error('Failed to detect bottlenecks:', error);
      throw error;
    }
  }

  /**
   * Detect bottlenecks for all metadata combinations
   */
  async detectAllBottlenecks(metadata: any): Promise<void> {
    try {
      this.logger.info('Detecting bottlenecks for all configurations', { metadata });

      // This would run bottleneck detection across different time ranges,
      // teams, and projects based on the metadata
      const configurations = this.generateDetectionConfigurations(metadata);
      
      for (const config of configurations) {
        try {
          await this.runBottleneckDetectionForConfiguration(config);
        } catch (error) {
          this.logger.warn(`Failed to detect bottlenecks for configuration:`, { config, error });
        }
      }

      this.emit('all-bottlenecks-detected', { configurationsProcessed: configurations.length });
      
    } catch (error) {
      this.logger.error('Failed to detect all bottlenecks:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive bottleneck analysis
   */
  async getBottleneckAnalysis(timeRange?: { start: Date; end: Date }): Promise<BottleneckAnalysisResult> {
    try {
      const bottlenecks = Array.from(this.bottlenecks.values());
      const filteredBottlenecks = timeRange 
        ? bottlenecks.filter(b => b.detectedAt >= timeRange.start && b.detectedAt <= timeRange.end)
        : bottlenecks;

      const analysis: BottleneckAnalysisResult = {
        timestamp: new Date(),
        totalBottlenecks: filteredBottlenecks.length,
        criticalBottlenecks: filteredBottlenecks.filter(b => b.severity === 'critical').length,
        bottlenecksByType: this.groupBottlenecksByType(filteredBottlenecks),
        bottlenecksByTeam: this.groupBottlenecksByTeam(filteredBottlenecks),
        estimatedTotalImpact: this.calculateTotalImpact(filteredBottlenecks),
        topBottlenecks: filteredBottlenecks.slice(0, 10),
        trends: await this.analyzeTrends(filteredBottlenecks, timeRange)
      };

      return analysis;

    } catch (error) {
      this.logger.error('Failed to get bottleneck analysis:', error);
      throw error;
    }
  }

  /**
   * Track bottleneck resolution progress
   */
  async trackBottleneckResolution(bottleneckId: string, status: 'acknowledged' | 'in-progress' | 'resolved' | 'wont-fix'): Promise<void> {
    const bottleneck = this.bottlenecks.get(bottleneckId);
    if (!bottleneck) {
      throw new Error(`Bottleneck ${bottleneckId} not found`);
    }

    // In a real implementation, this would update the bottleneck status
    // and track resolution metrics
    this.logger.info(`Bottleneck ${bottleneckId} status updated to: ${status}`);
    
    this.emit('bottleneck-status-updated', { bottleneckId, status });
  }

  /**
   * Get real-time bottleneck alerts
   */
  async getRealTimeBottleneckAlerts(): Promise<Array<{
    bottleneckId: string;
    type: string;
    severity: string;
    alertType: 'new' | 'escalated' | 'resolved';
    timestamp: Date;
  }>> {
    // This would monitor real-time metrics and generate alerts
    // for new or escalating bottlenecks
    return [
      {
        bottleneckId: 'cr-delay-001',
        type: 'code-review',
        severity: 'high',
        alertType: 'escalated',
        timestamp: new Date()
      }
    ];
  }

  // Private detection methods

  private async detectCodeReviewBottlenecks(metrics: ProductivityMetrics): Promise<ProductivityBottleneck[]> {
    const bottlenecks: ProductivityBottleneck[] = [];
    
    // Analyze average review turnaround time
    const avgReviewTime = this.calculateAverageReviewTime(metrics.developerMetrics);
    if (avgReviewTime > this.detectionConfig.thresholds.codeReviewTurnaround) {
      const affectedDevelopers = metrics.developerMetrics
        .filter(dev => dev.metrics.reviewTurnaroundTime > this.detectionConfig.thresholds.codeReviewTurnaround)
        .map(dev => dev.developerId);

      bottlenecks.push({
        id: `code-review-delay-${Date.now()}`,
        type: 'code-review',
        severity: this.calculateSeverity(avgReviewTime, this.detectionConfig.thresholds.codeReviewTurnaround, 96),
        title: 'Slow Code Review Turnaround',
        description: `Average code review turnaround time is ${Math.round(avgReviewTime)} hours, significantly above the ${this.detectionConfig.thresholds.codeReviewTurnaround}h threshold`,
        affectedTeams: [...new Set(metrics.developerMetrics.map(dev => dev.team))],
        affectedDevelopers,
        affectedProjects: [], // Would be populated from project data
        detectedAt: new Date(),
        estimatedImpact: {
          timeDelay: `${Math.round((avgReviewTime - 24) / 8)} additional business days per PR`,
          costImpact: `$${Math.round(affectedDevelopers.length * 200 * (avgReviewTime - 24) / 8)} per week in blocked developer time`,
          qualityImpact: 'Rushed reviews may miss 10-15% more issues',
          satisfactionImpact: 'Developer frustration with deployment delays'
        },
        rootCauses: [
          {
            category: 'Process',
            description: 'Lack of reviewer assignment automation',
            confidence: 80,
            evidencePoints: ['Manual reviewer assignment', 'No SLA enforcement']
          },
          {
            category: 'Capacity',
            description: 'Insufficient senior developers for reviews',
            confidence: 70,
            evidencePoints: ['High review load on senior members', 'Uneven review distribution']
          }
        ],
        suggestedActions: [
          {
            action: 'Implement automated reviewer assignment based on expertise and availability',
            priority: 'immediate',
            effort: 'medium',
            expectedImpact: 'high',
            estimatedCost: '$5K-10K implementation',
            timeline: '2-3 weeks',
            prerequisites: ['Code review tool integration'],
            successMetrics: ['Reduce average review time to < 24h', '90% reviews assigned within 2h']
          },
          {
            action: 'Establish code review SLA with escalation procedures',
            priority: 'short-term',
            effort: 'low',
            expectedImpact: 'medium',
            estimatedCost: 'Minimal',
            timeline: '1 week',
            prerequisites: ['Team agreement on SLAs'],
            successMetrics: ['95% reviews completed within SLA', 'Automated escalation triggers']
          }
        ],
        metrics: {
          occurrenceFrequency: 40, // per week (estimated based on PR volume)
          averageDuration: avgReviewTime,
          resolutionTime: 0, // Not yet resolved
          recurrenceRate: 85 // High recurrence
        },
        trends: {
          frequency: 'increasing',
          severity: 'increasing',
          scope: 'expanding'
        }
      });
    }

    // Detect review coverage gaps
    const lowReviewCoverage = metrics.developerMetrics.filter(dev => dev.metrics.codeReviews < 5).length;
    if (lowReviewCoverage > metrics.developerMetrics.length * 0.3) {
      bottlenecks.push({
        id: `review-coverage-${Date.now()}`,
        type: 'code-review',
        severity: 'medium',
        title: 'Insufficient Code Review Participation',
        description: `${lowReviewCoverage} developers are not actively participating in code reviews`,
        affectedTeams: [...new Set(metrics.developerMetrics.filter(d => d.metrics.codeReviews < 5).map(d => d.team))],
        affectedDevelopers: metrics.developerMetrics.filter(d => d.metrics.codeReviews < 5).map(d => d.developerId),
        affectedProjects: [],
        detectedAt: new Date(),
        estimatedImpact: {
          timeDelay: 'Review bottleneck on few senior developers',
          costImpact: 'Increased risk of defects reaching production',
          qualityImpact: 'Reduced knowledge sharing and quality consistency',
          satisfactionImpact: 'Junior developers missing learning opportunities'
        },
        rootCauses: [
          {
            category: 'Skill',
            description: 'Junior developers lack confidence in reviewing',
            confidence: 75,
            evidencePoints: ['Low review participation from junior members']
          }
        ],
        suggestedActions: [
          {
            action: 'Implement mentorship program for code reviews',
            priority: 'medium-term',
            effort: 'medium',
            expectedImpact: 'medium',
            estimatedCost: '$2K-5K',
            timeline: '4-6 weeks',
            prerequisites: ['Senior developer availability'],
            successMetrics: ['All developers participate in 5+ reviews per sprint']
          }
        ],
        metrics: {
          occurrenceFrequency: 1,
          averageDuration: 0,
          resolutionTime: 0,
          recurrenceRate: 90
        },
        trends: {
          frequency: 'stable',
          severity: 'stable',
          scope: 'stable'
        }
      });
    }

    return bottlenecks;
  }

  private async detectDeploymentBottlenecks(metrics: ProductivityMetrics): Promise<ProductivityBottleneck[]> {
    const bottlenecks: ProductivityBottleneck[] = [];
    
    // Analyze deployment frequency
    const avgDeployments = this.calculateAverageDeployments(metrics.developerMetrics);
    if (avgDeployments < this.detectionConfig.thresholds.deploymentFrequency) {
      bottlenecks.push({
        id: `deployment-frequency-${Date.now()}`,
        type: 'deployment',
        severity: 'high',
        title: 'Low Deployment Frequency',
        description: `Teams are deploying only ${avgDeployments} times per week, below the recommended ${this.detectionConfig.thresholds.deploymentFrequency} times`,
        affectedTeams: [...new Set(metrics.teamMetrics.map(team => team.name))],
        affectedDevelopers: metrics.developerMetrics.map(dev => dev.developerId),
        affectedProjects: [],
        detectedAt: new Date(),
        estimatedImpact: {
          timeDelay: 'Features delayed by batch deployment cycles',
          costImpact: 'Increased risk and cost of large deployments',
          qualityImpact: 'Higher failure rate due to large change sets',
          satisfactionImpact: 'Longer feedback cycles frustrate developers'
        },
        rootCauses: [
          {
            category: 'Process',
            description: 'Manual deployment processes create bottlenecks',
            confidence: 85,
            evidencePoints: ['Manual approval required', 'Complex deployment procedures']
          },
          {
            category: 'Infrastructure',
            description: 'Lack of automated CI/CD pipeline',
            confidence: 90,
            evidencePoints: ['Manual testing before deployment', 'Environment setup delays']
          }
        ],
        suggestedActions: [
          {
            action: 'Implement automated CI/CD pipeline with blue-green deployment',
            priority: 'immediate',
            effort: 'high',
            expectedImpact: 'high',
            estimatedCost: '$20K-50K',
            timeline: '6-8 weeks',
            prerequisites: ['Infrastructure automation', 'Test automation'],
            successMetrics: ['Deploy 10+ times per week', '< 5 minute deployment time', '99.9% deployment success rate']
          }
        ],
        metrics: {
          occurrenceFrequency: 1,
          averageDuration: 0,
          resolutionTime: 0,
          recurrenceRate: 95
        },
        trends: {
          frequency: 'stable',
          severity: 'increasing',
          scope: 'expanding'
        }
      });
    }

    return bottlenecks;
  }

  private async detectTestingBottlenecks(metrics: ProductivityMetrics): Promise<ProductivityBottleneck[]> {
    const bottlenecks: ProductivityBottleneck[] = [];
    
    // Analyze test coverage gaps
    const lowTestCoverage = metrics.developerMetrics.filter(dev => dev.metrics.testCoverage < 70).length;
    if (lowTestCoverage > metrics.developerMetrics.length * 0.4) {
      bottlenecks.push({
        id: `test-coverage-${Date.now()}`,
        type: 'testing',
        severity: 'high',
        title: 'Insufficient Test Coverage',
        description: `${lowTestCoverage} developers have test coverage below 70%, increasing defect risk`,
        affectedTeams: [...new Set(metrics.developerMetrics.filter(d => d.metrics.testCoverage < 70).map(d => d.team))],
        affectedDevelopers: metrics.developerMetrics.filter(d => d.metrics.testCoverage < 70).map(d => d.developerId),
        affectedProjects: [],
        detectedAt: new Date(),
        estimatedImpact: {
          timeDelay: 'Manual testing delays in deployment pipeline',
          costImpact: 'Increased QA costs and production bug fixes',
          qualityImpact: '40-60% higher defect rate in production',
          satisfactionImpact: 'Customer dissatisfaction from bugs'
        },
        rootCauses: [
          {
            category: 'Skills',
            description: 'Developers lack TDD and testing best practices knowledge',
            confidence: 80,
            evidencePoints: ['Low test-to-code ratio', 'Few unit tests written']
          },
          {
            category: 'Process',
            description: 'No test coverage enforcement in CI/CD',
            confidence: 85,
            evidencePoints: ['Merges allowed without coverage checks']
          }
        ],
        suggestedActions: [
          {
            action: 'Implement test coverage gates in CI/CD pipeline',
            priority: 'immediate',
            effort: 'medium',
            expectedImpact: 'high',
            estimatedCost: '$5K',
            timeline: '2 weeks',
            prerequisites: ['Test coverage tooling'],
            successMetrics: ['80% minimum test coverage enforced', 'No merges below threshold']
          },
          {
            action: 'Provide TDD training and workshops',
            priority: 'short-term',
            effort: 'medium',
            expectedImpact: 'medium',
            estimatedCost: '$10K',
            timeline: '4 weeks',
            prerequisites: ['Training resources'],
            successMetrics: ['All developers complete TDD training', 'Test-first development adoption']
          }
        ],
        metrics: {
          occurrenceFrequency: 1,
          averageDuration: 0,
          resolutionTime: 0,
          recurrenceRate: 85
        },
        trends: {
          frequency: 'stable',
          severity: 'increasing',
          scope: 'stable'
        }
      });
    }

    return bottlenecks;
  }

  private async detectPlanningBottlenecks(metrics: ProductivityMetrics): Promise<ProductivityBottleneck[]> {
    const bottlenecks: ProductivityBottleneck[] = [];
    
    // Analyze task cycle time
    const longCycleTimes = metrics.teamMetrics.filter(team => team.metrics.cycleTime > this.detectionConfig.thresholds.taskCycleTime);
    if (longCycleTimes.length > 0) {
      bottlenecks.push({
        id: `planning-cycle-time-${Date.now()}`,
        type: 'planning',
        severity: 'medium',
        title: 'Long Task Cycle Times',
        description: `${longCycleTimes.length} teams have cycle times exceeding ${this.detectionConfig.thresholds.taskCycleTime} days`,
        affectedTeams: longCycleTimes.map(team => team.name),
        affectedDevelopers: [], // Would be populated from team membership
        affectedProjects: [],
        detectedAt: new Date(),
        estimatedImpact: {
          timeDelay: `${Math.round(longCycleTimes.reduce((sum, t) => sum + t.metrics.cycleTime, 0) / longCycleTimes.length - this.detectionConfig.thresholds.taskCycleTime)} extra days per task`,
          costImpact: 'Delayed feature delivery and increased carrying costs',
          qualityImpact: 'Reduced ability to respond to feedback',
          satisfactionImpact: 'Frustration with slow progress visibility'
        },
        rootCauses: [
          {
            category: 'Process',
            description: 'Tasks are too large and not properly broken down',
            confidence: 75,
            evidencePoints: ['High variance in task completion times']
          }
        ],
        suggestedActions: [
          {
            action: 'Implement story splitting workshops and guidelines',
            priority: 'medium-term',
            effort: 'low',
            expectedImpact: 'medium',
            estimatedCost: '$2K',
            timeline: '3 weeks',
            prerequisites: ['Agile coach availability'],
            successMetrics: ['Average cycle time < 5 days', 'Task size consistency improvement']
          }
        ],
        metrics: {
          occurrenceFrequency: 2,
          averageDuration: 0,
          resolutionTime: 0,
          recurrenceRate: 70
        },
        trends: {
          frequency: 'stable',
          severity: 'stable',
          scope: 'stable'
        }
      });
    }

    return bottlenecks;
  }

  private async detectCommunicationBottlenecks(metrics: ProductivityMetrics): Promise<ProductivityBottleneck[]> {
    const bottlenecks: ProductivityBottleneck[] = [];
    
    // Analyze meeting overhead
    const highMeetingHours = metrics.developerMetrics.filter(dev => dev.metrics.meetingHours > 20).length;
    if (highMeetingHours > metrics.developerMetrics.length * 0.3) {
      bottlenecks.push({
        id: `meeting-overhead-${Date.now()}`,
        type: 'communication',
        severity: 'medium',
        title: 'Excessive Meeting Overhead',
        description: `${highMeetingHours} developers spend more than 20 hours per week in meetings`,
        affectedTeams: [...new Set(metrics.developerMetrics.filter(d => d.metrics.meetingHours > 20).map(d => d.team))],
        affectedDevelopers: metrics.developerMetrics.filter(d => d.metrics.meetingHours > 20).map(d => d.developerId),
        affectedProjects: [],
        detectedAt: new Date(),
        estimatedImpact: {
          timeDelay: `${Math.round(highMeetingHours * 5)} hours per week lost to excessive meetings`,
          costImpact: `$${Math.round(highMeetingHours * 100 * 5)} per week in developer time`,
          qualityImpact: 'Reduced focus time affects code quality',
          satisfactionImpact: 'Developer frustration with meeting fatigue'
        },
        rootCauses: [
          {
            category: 'Process',
            description: 'Too many status meetings and lack of async communication',
            confidence: 80,
            evidencePoints: ['Daily standups exceed 15 minutes', 'Multiple status meetings per week']
          }
        ],
        suggestedActions: [
          {
            action: 'Audit and eliminate redundant meetings, implement async standups',
            priority: 'short-term',
            effort: 'low',
            expectedImpact: 'medium',
            estimatedCost: 'Minimal',
            timeline: '2 weeks',
            prerequisites: ['Team buy-in'],
            successMetrics: ['Reduce meeting time by 50%', 'Increase focus time blocks']
          }
        ],
        metrics: {
          occurrenceFrequency: 5,
          averageDuration: 20,
          resolutionTime: 0,
          recurrenceRate: 90
        },
        trends: {
          frequency: 'increasing',
          severity: 'stable',
          scope: 'expanding'
        }
      });
    }

    return bottlenecks;
  }

  private async detectTechnicalDebtBottlenecks(metrics: ProductivityMetrics): Promise<ProductivityBottleneck[]> {
    const bottlenecks: ProductivityBottleneck[] = [];
    
    // Analyze technical debt accumulation
    const highTechnicalDebt = metrics.developerMetrics.filter(dev => dev.metrics.technicalDebtHours > 40).length;
    if (highTechnicalDebt > metrics.developerMetrics.length * 0.4) {
      bottlenecks.push({
        id: `technical-debt-${Date.now()}`,
        type: 'technical-debt',
        severity: 'high',
        title: 'Accumulating Technical Debt',
        description: `${highTechnicalDebt} developers are burdened with significant technical debt (>40 hours to resolve)`,
        affectedTeams: [...new Set(metrics.developerMetrics.filter(d => d.metrics.technicalDebtHours > 40).map(d => d.team))],
        affectedDevelopers: metrics.developerMetrics.filter(d => d.metrics.technicalDebtHours > 40).map(d => d.developerId),
        affectedProjects: [],
        detectedAt: new Date(),
        estimatedImpact: {
          timeDelay: 'Feature development slowed by technical debt maintenance',
          costImpact: `$${Math.round(highTechnicalDebt * 40 * 100)} in accumulated debt`,
          qualityImpact: 'Increased bug rate and maintenance overhead',
          satisfactionImpact: 'Developer frustration with legacy code maintenance'
        },
        rootCauses: [
          {
            category: 'Process',
            description: 'Lack of dedicated time for refactoring and debt reduction',
            confidence: 85,
            evidencePoints: ['No sprint capacity allocated for debt reduction']
          }
        ],
        suggestedActions: [
          {
            action: 'Allocate 20% of sprint capacity to technical debt reduction',
            priority: 'immediate',
            effort: 'low',
            expectedImpact: 'high',
            estimatedCost: 'Opportunity cost of features',
            timeline: 'Ongoing',
            prerequisites: ['Product owner buy-in'],
            successMetrics: ['Reduce technical debt by 50% in 6 months']
          }
        ],
        metrics: {
          occurrenceFrequency: 1,
          averageDuration: 0,
          resolutionTime: 0,
          recurrenceRate: 95
        },
        trends: {
          frequency: 'stable',
          severity: 'increasing',
          scope: 'expanding'
        }
      });
    }

    return bottlenecks;
  }

  private async detectResourceConstraintBottlenecks(metrics: ProductivityMetrics): Promise<ProductivityBottleneck[]> {
    const bottlenecks: ProductivityBottleneck[] = [];
    
    // Analyze team utilization
    const overutilizedTeams = metrics.teamMetrics.filter(team => 
      team.metrics.throughput > team.memberCount * 15 // Assuming 15 story points per person is high utilization
    );

    if (overutilizedTeams.length > 0) {
      bottlenecks.push({
        id: `resource-constraint-${Date.now()}`,
        type: 'resource-constraint',
        severity: 'high',
        title: 'Team Over-utilization',
        description: `${overutilizedTeams.length} teams are operating at unsustainable capacity levels`,
        affectedTeams: overutilizedTeams.map(team => team.name),
        affectedDevelopers: [], // Would be populated from team membership
        affectedProjects: [],
        detectedAt: new Date(),
        estimatedImpact: {
          timeDelay: 'Quality shortcuts due to time pressure',
          costImpact: 'Increased burnout and turnover risk',
          qualityImpact: 'Higher defect rates under pressure',
          satisfactionImpact: 'High risk of team burnout'
        },
        rootCauses: [
          {
            category: 'Planning',
            description: 'Overcommitment in sprint planning',
            confidence: 80,
            evidencePoints: ['Consistently high velocity without quality degradation checks']
          }
        ],
        suggestedActions: [
          {
            action: 'Implement capacity planning with sustainability metrics',
            priority: 'immediate',
            effort: 'medium',
            expectedImpact: 'high',
            estimatedCost: '$5K-10K',
            timeline: '3-4 weeks',
            prerequisites: ['Team velocity history', 'Burnout risk assessment tools'],
            successMetrics: ['Sustainable velocity within 80% of historical max', 'Burnout risk scores < 5']
          }
        ],
        metrics: {
          occurrenceFrequency: 2,
          averageDuration: 0,
          resolutionTime: 0,
          recurrenceRate: 70
        },
        trends: {
          frequency: 'increasing',
          severity: 'increasing',
          scope: 'stable'
        }
      });
    }

    return bottlenecks;
  }

  private async detectSkillGapBottlenecks(metrics: ProductivityMetrics): Promise<ProductivityBottleneck[]> {
    const bottlenecks: ProductivityBottleneck[] = [];
    
    // This would analyze skill distribution and identify gaps
    // For demonstration, we'll create a sample bottleneck
    const teamsWithSkillGaps = metrics.teamMetrics.filter(team => team.memberCount < 3); // Assuming small teams have skill concentration risk
    
    if (teamsWithSkillGaps.length > 0) {
      bottlenecks.push({
        id: `skill-gap-${Date.now()}`,
        type: 'skill-gap',
        severity: 'medium',
        title: 'Critical Skill Concentration Risk',
        description: `${teamsWithSkillGaps.length} teams have potential single points of failure in critical skills`,
        affectedTeams: teamsWithSkillGaps.map(team => team.name),
        affectedDevelopers: [],
        affectedProjects: [],
        detectedAt: new Date(),
        estimatedImpact: {
          timeDelay: 'Significant delays if key developers are unavailable',
          costImpact: 'Risk of project delays due to skill bottlenecks',
          qualityImpact: 'Limited code review expertise in specialized areas',
          satisfactionImpact: 'Stress on key developers with specialized skills'
        },
        rootCauses: [
          {
            category: 'Skills',
            description: 'Lack of cross-training in specialized technologies',
            confidence: 75,
            evidencePoints: ['Skill concentration in few team members']
          }
        ],
        suggestedActions: [
          {
            action: 'Implement cross-training program for critical skills',
            priority: 'medium-term',
            effort: 'medium',
            expectedImpact: 'medium',
            estimatedCost: '$15K-25K',
            timeline: '8-12 weeks',
            prerequisites: ['Senior developer availability for mentoring'],
            successMetrics: ['At least 2 people per critical skill area', 'Knowledge sharing session completions']
          }
        ],
        metrics: {
          occurrenceFrequency: 1,
          averageDuration: 0,
          resolutionTime: 0,
          recurrenceRate: 60
        },
        trends: {
          frequency: 'stable',
          severity: 'stable',
          scope: 'stable'
        }
      });
    }

    return bottlenecks;
  }

  private async detectProcessInefficiencies(metrics: ProductivityMetrics): Promise<ProductivityBottleneck[]> {
    const bottlenecks: ProductivityBottleneck[] = [];
    
    // Analyze context switching patterns
    const highContextSwitching = metrics.developerMetrics.filter(dev => dev.metrics.contextSwitching > 15).length;
    
    if (highContextSwitching > metrics.developerMetrics.length * 0.4) {
      bottlenecks.push({
        id: `process-inefficiency-${Date.now()}`,
        type: 'process-inefficiency',
        severity: 'medium',
        title: 'High Context Switching Overhead',
        description: `${highContextSwitching} developers experience excessive context switching, reducing deep work effectiveness`,
        affectedTeams: [...new Set(metrics.developerMetrics.filter(d => d.metrics.contextSwitching > 15).map(d => d.team))],
        affectedDevelopers: metrics.developerMetrics.filter(d => d.metrics.contextSwitching > 15).map(d => d.developerId),
        affectedProjects: [],
        detectedAt: new Date(),
        estimatedImpact: {
          timeDelay: '20-25% productivity loss due to context switching',
          costImpact: `$${Math.round(highContextSwitching * 100 * 0.25 * 40)} per week in lost productivity`,
          qualityImpact: 'Reduced code quality due to fragmented attention',
          satisfactionImpact: 'Developer frustration with inability to focus'
        },
        rootCauses: [
          {
            category: 'Process',
            description: 'Too many simultaneous projects and interruptions',
            confidence: 85,
            evidencePoints: ['High number of active branches per developer', 'Frequent priority changes']
          }
        ],
        suggestedActions: [
          {
            action: 'Implement WIP limits and focus time blocks',
            priority: 'short-term',
            effort: 'low',
            expectedImpact: 'medium',
            estimatedCost: 'Minimal',
            timeline: '2 weeks',
            prerequisites: ['Team agreement on focus policies'],
            successMetrics: ['Reduce context switching by 50%', 'Increase focus time blocks to 4+ hours daily']
          }
        ],
        metrics: {
          occurrenceFrequency: 5,
          averageDuration: 0,
          resolutionTime: 0,
          recurrenceRate: 80
        },
        trends: {
          frequency: 'increasing',
          severity: 'stable',
          scope: 'expanding'
        }
      });
    }

    return bottlenecks;
  }

  // Helper methods

  private calculateAverageReviewTime(developers: any[]): number {
    const reviewTimes = developers
      .map(dev => dev.metrics.reviewTurnaroundTime)
      .filter(time => typeof time === 'number' && !isNaN(time));
    
    return reviewTimes.length > 0 
      ? reviewTimes.reduce((sum, time) => sum + time, 0) / reviewTimes.length 
      : 0;
  }

  private calculateAverageDeployments(developers: any[]): number {
    const deployments = developers
      .map(dev => dev.metrics.deployments)
      .filter(count => typeof count === 'number' && !isNaN(count));
    
    return deployments.length > 0 
      ? deployments.reduce((sum, count) => sum + count, 0) / deployments.length 
      : 0;
  }

  private calculateSeverity(currentValue: number, threshold: number, criticalThreshold: number): 'critical' | 'high' | 'medium' | 'low' {
    if (currentValue > criticalThreshold) return 'critical';
    if (currentValue > threshold * 1.5) return 'high';
    if (currentValue > threshold * 1.2) return 'medium';
    return 'low';
  }

  private calculateBottleneckConfidence(bottleneck: ProductivityBottleneck): number {
    // Calculate confidence based on multiple factors
    const rootCauseConfidence = bottleneck.rootCauses.reduce((sum, cause) => sum + cause.confidence, 0) / bottleneck.rootCauses.length;
    const evidenceStrength = bottleneck.rootCauses.reduce((sum, cause) => sum + cause.evidencePoints.length, 0) * 10;
    const occurrenceFrequency = Math.min(bottleneck.metrics.occurrenceFrequency * 2, 20);
    
    return Math.min(100, (rootCauseConfidence + evidenceStrength + occurrenceFrequency) / 3);
  }

  private prioritizeBottlenecks(bottlenecks: ProductivityBottleneck[]): ProductivityBottleneck[] {
    return bottlenecks.sort((a, b) => {
      // Priority order: critical > high > medium > low
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      
      if (severityDiff !== 0) return severityDiff;
      
      // If same severity, prioritize by affected developers count
      return b.affectedDevelopers.length - a.affectedDevelopers.length;
    });
  }

  private groupBottlenecksByType(bottlenecks: ProductivityBottleneck[]): Record<string, number> {
    return bottlenecks.reduce((acc, bottleneck) => {
      acc[bottleneck.type] = (acc[bottleneck.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupBottlenecksByTeam(bottlenecks: ProductivityBottleneck[]): Record<string, number> {
    const teamCounts: Record<string, number> = {};
    
    bottlenecks.forEach(bottleneck => {
      bottleneck.affectedTeams.forEach(team => {
        teamCounts[team] = (teamCounts[team] || 0) + 1;
      });
    });
    
    return teamCounts;
  }

  private calculateTotalImpact(bottlenecks: ProductivityBottleneck[]): {
    timeWasted: string;
    costImpact: string;
    affectedDevelopers: number;
  } {
    const affectedDevelopers = new Set<string>();
    bottlenecks.forEach(b => b.affectedDevelopers.forEach(dev => affectedDevelopers.add(dev)));
    
    // This would calculate actual time and cost impact
    // For demonstration, we'll provide estimated values
    const estimatedHoursWasted = bottlenecks.length * 10; // 10 hours per bottleneck per week
    const estimatedCost = affectedDevelopers.size * 100 * estimatedHoursWasted; // $100/hour
    
    return {
      timeWasted: `${estimatedHoursWasted} hours per week`,
      costImpact: `$${estimatedCost.toLocaleString()} per week`,
      affectedDevelopers: affectedDevelopers.size
    };
  }

  private async analyzeTrends(bottlenecks: ProductivityBottleneck[], timeRange?: { start: Date; end: Date }): Promise<{
    newBottlenecks: number;
    resolvedBottlenecks: number;
    deterioratingBottlenecks: number;
    improvingBottlenecks: number;
  }> {
    // This would analyze historical data to determine trends
    // For demonstration, we'll provide sample values
    return {
      newBottlenecks: Math.floor(bottlenecks.length * 0.2),
      resolvedBottlenecks: Math.floor(bottlenecks.length * 0.1),
      deterioratingBottlenecks: Math.floor(bottlenecks.length * 0.15),
      improvingBottlenecks: Math.floor(bottlenecks.length * 0.25)
    };
  }

  private generateDetectionConfigurations(metadata: any): any[] {
    // Generate different configurations for bottleneck detection
    return [
      { ...metadata, focus: 'code-review' },
      { ...metadata, focus: 'deployment' },
      { ...metadata, focus: 'testing' }
    ];
  }

  private async runBottleneckDetectionForConfiguration(config: any): Promise<void> {
    this.logger.debug('Running bottleneck detection for configuration', { config });
  }

  private async loadDetectionRules(): Promise<void> {
    // Load configurable detection rules
    this.logger.debug('Detection rules loaded');
  }

  private async loadHistoricalData(): Promise<void> {
    // Load historical bottleneck data for trend analysis
    this.logger.debug('Historical data loaded');
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Bottleneck Detector');
    this.bottlenecks.clear();
    this.detectionRules.clear();
    this.historicalData.clear();
    this.isInitialized = false;
  }
}