import { PrismaClient } from '@prisma/client';
import QualityScoringEngine, { QualityEvaluationResult } from './quality-scoring-engine';
import { 
  EvaluationJobType, 
  EvaluationJobStatus, 
  HistoryTrigger,
  QualityCheckType,
  QualityCategory 
} from '@prisma/client';

const prisma = new PrismaClient();

export interface QualityEvaluationOptions {
  tenantId?: string;
  userId?: string;
  triggerReason?: string;
  checksToRun?: QualityCheckType[];
  async?: boolean;
  configOverrides?: any;
  skipIfRecent?: boolean; // Skip if evaluated recently
  recentThresholdMinutes?: number; // How recent is "recent"
}

export interface BatchEvaluationOptions extends QualityEvaluationOptions {
  pluginIds: string[];
  maxConcurrent?: number;
  priorityOrder?: 'severity' | 'lastEvaluated' | 'random';
}

export class QualityEvaluationService {
  private scoringEngine: QualityScoringEngine;

  constructor(config?: any) {
    this.scoringEngine = new QualityScoringEngine(config);
  }

  /**
   * Evaluate quality for a single plugin
   */
  async evaluatePlugin(
    pluginId: string,
    options: QualityEvaluationOptions = {}
  ): Promise<{
    success: boolean;
    jobId?: string;
    result?: QualityEvaluationResult;
    message: string;
    qualityScoreId?: string;
  }> {
    try {
      const {
        tenantId,
        userId = 'system',
        triggerReason = 'Manual evaluation',
        checksToRun = [],
        async = false,
        configOverrides,
        skipIfRecent = false,
        recentThresholdMinutes = 60
      } = options;

      // Get plugin data
      const plugin = await this.getPluginForEvaluation(pluginId, tenantId);
      if (!plugin) {
        return {
          success: false,
          message: 'Plugin not found or access denied'
        };
      }

      // Check if there's already a running evaluation
      const existingJob = await prisma.qualityEvaluationJob.findFirst({
        where: {
          pluginId,
          status: { in: ['PENDING', 'QUEUED', 'RUNNING'] }
        }
      });

      if (existingJob) {
        return {
          success: false,
          jobId: existingJob.id,
          message: 'Quality evaluation already in progress'
        };
      }

      // Check if we should skip due to recent evaluation
      if (skipIfRecent) {
        const recentEvaluation = await prisma.pluginQualityScore.findUnique({
          where: { pluginId },
          select: { evaluatedAt: true }
        });

        if (recentEvaluation) {
          const minutesSinceLastEvaluation = 
            (Date.now() - recentEvaluation.evaluatedAt.getTime()) / (1000 * 60);
          
          if (minutesSinceLastEvaluation < recentThresholdMinutes) {
            return {
              success: false,
              message: `Plugin evaluated ${Math.round(minutesSinceLastEvaluation)} minutes ago, skipping`
            };
          }
        }
      }

      if (async) {
        return await this.startAsyncEvaluation(pluginId, options);
      } else {
        return await this.runSyncEvaluation(plugin, options);
      }

    } catch (error) {
      console.error('Error in evaluatePlugin:', error);
      return {
        success: false,
        message: `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Evaluate quality for multiple plugins
   */
  async evaluatePluginsBatch(
    options: BatchEvaluationOptions
  ): Promise<{
    success: boolean;
    results: Array<{
      pluginId: string;
      success: boolean;
      message: string;
      jobId?: string;
      qualityScoreId?: string;
    }>;
    summary: {
      total: number;
      successful: number;
      failed: number;
      skipped: number;
    };
  }> {
    const {
      pluginIds,
      maxConcurrent = 3,
      priorityOrder = 'lastEvaluated',
      ...evaluationOptions
    } = options;

    // Get plugin priority order
    const orderedPluginIds = await this.orderPluginsForEvaluation(pluginIds, priorityOrder, evaluationOptions.tenantId);

    const results: Array<{
      pluginId: string;
      success: boolean;
      message: string;
      jobId?: string;
      qualityScoreId?: string;
    }> = [];

    const summary = {
      total: orderedPluginIds.length,
      successful: 0,
      failed: 0,
      skipped: 0
    };

    // Process plugins in batches
    for (let i = 0; i < orderedPluginIds.length; i += maxConcurrent) {
      const batch = orderedPluginIds.slice(i, i + maxConcurrent);
      
      const batchPromises = batch.map(pluginId => 
        this.evaluatePlugin(pluginId, { ...evaluationOptions, async: true })
      );

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        const pluginId = batch[index];
        
        if (result.status === 'fulfilled') {
          results.push({
            pluginId,
            ...result.value
          });
          
          if (result.value.success) {
            summary.successful++;
          } else {
            if (result.value.message.includes('skipping')) {
              summary.skipped++;
            } else {
              summary.failed++;
            }
          }
        } else {
          results.push({
            pluginId,
            success: false,
            message: `Evaluation failed: ${result.reason}`
          });
          summary.failed++;
        }
      });

      // Small delay between batches to prevent overwhelming the system
      if (i + maxConcurrent < orderedPluginIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      success: summary.failed === 0,
      results,
      summary
    };
  }

  /**
   * Get evaluation job status
   */
  async getEvaluationStatus(jobId: string, tenantId?: string): Promise<{
    success: boolean;
    job?: any;
    message: string;
  }> {
    try {
      const job = await prisma.qualityEvaluationJob.findUnique({
        where: { id: jobId },
        include: {
          plugin: {
            select: {
              id: true,
              name: true,
              displayName: true
            }
          }
        }
      });

      if (!job) {
        return {
          success: false,
          message: 'Evaluation job not found'
        };
      }

      // Multi-tenant access control
      if (tenantId && job.tenantId && job.tenantId !== tenantId) {
        return {
          success: false,
          message: 'Access denied to this evaluation job'
        };
      }

      return {
        success: true,
        job: {
          id: job.id,
          pluginId: job.pluginId,
          plugin: job.plugin,
          jobType: job.jobType,
          status: job.status,
          priority: job.priority,
          progress: job.progress,
          currentStep: job.currentStep,
          totalSteps: job.totalSteps,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          duration: job.duration,
          attempts: job.attempts,
          maxAttempts: job.maxAttempts,
          triggerReason: job.triggerReason,
          error: job.error,
          warnings: job.warnings,
          result: job.result ? 
            (typeof job.result === 'string' ? JSON.parse(job.result) : job.result) : 
            null,
          scheduledAt: job.scheduledAt,
          createdAt: job.createdAt,
          metadata: job.metadata
        },
        message: 'Evaluation job details retrieved'
      };

    } catch (error) {
      console.error('Error getting evaluation status:', error);
      return {
        success: false,
        message: `Failed to get evaluation status: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Cancel an evaluation job
   */
  async cancelEvaluation(jobId: string, userId: string, tenantId?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const job = await prisma.qualityEvaluationJob.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          status: true,
          tenantId: true,
          pluginId: true
        }
      });

      if (!job) {
        return {
          success: false,
          message: 'Evaluation job not found'
        };
      }

      // Multi-tenant access control
      if (tenantId && job.tenantId && job.tenantId !== tenantId) {
        return {
          success: false,
          message: 'Access denied to cancel this evaluation job'
        };
      }

      if (!['PENDING', 'QUEUED', 'RUNNING'].includes(job.status)) {
        return {
          success: false,
          message: `Cannot cancel job in ${job.status} status`
        };
      }

      await prisma.qualityEvaluationJob.update({
        where: { id: jobId },
        data: {
          status: EvaluationJobStatus.CANCELLED,
          completedAt: new Date(),
          error: `Cancelled by user ${userId}`,
          metadata: {
            ...(job as any).metadata,
            cancelledBy: userId,
            cancelledAt: new Date().toISOString()
          }
        }
      });

      return {
        success: true,
        message: 'Evaluation job cancelled successfully'
      };

    } catch (error) {
      console.error('Error cancelling evaluation:', error);
      return {
        success: false,
        message: `Failed to cancel evaluation: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get quality evaluation summary for tenant/plugin
   */
  async getEvaluationSummary(filters: {
    tenantId?: string;
    pluginId?: string;
    category?: QualityCategory;
    timeframe?: 'day' | 'week' | 'month' | 'quarter';
  }): Promise<{
    success: boolean;
    summary?: any;
    message: string;
  }> {
    try {
      const { tenantId, pluginId, category, timeframe = 'week' } = filters;

      // Calculate date range
      const now = new Date();
      const timeRanges = {
        day: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        quarter: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      };
      const fromDate = timeRanges[timeframe];

      // Build where clauses
      const qualityScoreWhere: any = {
        evaluatedAt: { gte: fromDate }
      };
      
      const historyWhere: any = {
        recordedAt: { gte: fromDate }
      };

      const issueWhere: any = {
        createdAt: { gte: fromDate }
      };

      if (tenantId) {
        qualityScoreWhere.tenantId = tenantId;
        historyWhere.tenantId = tenantId;
        issueWhere.tenantId = tenantId;
      }

      if (pluginId) {
        qualityScoreWhere.pluginId = pluginId;
        historyWhere.pluginId = pluginId;
        issueWhere.pluginId = pluginId;
      }

      if (category) {
        issueWhere.category = category;
      }

      // Get evaluation statistics
      const [
        totalEvaluations,
        gradeDistribution,
        recentIssues,
        trendData,
        topIssues
      ] = await Promise.all([
        // Total evaluations
        prisma.pluginQualityScore.count({
          where: qualityScoreWhere
        }),

        // Grade distribution
        prisma.pluginQualityScore.groupBy({
          by: ['overallGrade'],
          where: qualityScoreWhere,
          _count: { overallGrade: true }
        }),

        // Recent issues
        prisma.pluginQualityIssue.groupBy({
          by: ['severity'],
          where: {
            ...issueWhere,
            status: { notIn: ['RESOLVED', 'CLOSED'] }
          },
          _count: { severity: true }
        }),

        // Trend data (score changes)
        prisma.pluginQualityHistory.findMany({
          where: historyWhere,
          select: {
            recordedAt: true,
            overallScore: true,
            scoreChange: true,
            pluginId: true
          },
          orderBy: { recordedAt: 'asc' }
        }),

        // Top issues by category
        prisma.pluginQualityIssue.groupBy({
          by: ['category', 'issueType'],
          where: {
            ...issueWhere,
            status: { notIn: ['RESOLVED', 'CLOSED'] },
            severity: { in: ['CRITICAL', 'HIGH'] }
          },
          _count: { issueType: true },
          orderBy: { _count: { issueType: 'desc' } },
          take: 10
        })
      ]);

      // Calculate average scores by category
      const avgScores = await prisma.pluginQualityScore.aggregate({
        where: qualityScoreWhere,
        _avg: {
          overallScore: true,
          securityScore: true,
          performanceScore: true,
          maintainabilityScore: true,
          reliabilityScore: true,
          documentationScore: true
        }
      });

      // Process trend data
      const trendAnalysis = this.analyzeTrend(trendData);

      const summary = {
        timeframe,
        period: {
          from: fromDate.toISOString(),
          to: now.toISOString()
        },
        
        overview: {
          totalEvaluations,
          averageOverallScore: Math.round((avgScores._avg.overallScore || 0) * 100) / 100,
          
          gradeDistribution: gradeDistribution.reduce((acc, item) => {
            acc[item.overallGrade] = item._count.overallGrade;
            return acc;
          }, {} as Record<string, number>),
          
          categoryAverages: {
            security: Math.round((avgScores._avg.securityScore || 0) * 100) / 100,
            performance: Math.round((avgScores._avg.performanceScore || 0) * 100) / 100,
            maintainability: Math.round((avgScores._avg.maintainabilityScore || 0) * 100) / 100,
            reliability: Math.round((avgScores._avg.reliabilityScore || 0) * 100) / 100,
            documentation: Math.round((avgScores._avg.documentationScore || 0) * 100) / 100
          }
        },
        
        issues: {
          bySeverity: recentIssues.reduce((acc, item) => {
            acc[item.severity] = item._count.severity;
            return acc;
          }, {} as Record<string, number>),
          
          topIssueTypes: topIssues.map(item => ({
            category: item.category,
            issueType: item.issueType,
            count: item._count.issueType
          }))
        },
        
        trends: trendAnalysis
      };

      return {
        success: true,
        summary,
        message: 'Evaluation summary retrieved successfully'
      };

    } catch (error) {
      console.error('Error getting evaluation summary:', error);
      return {
        success: false,
        message: `Failed to get evaluation summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Private helper methods

  private async getPluginForEvaluation(pluginId: string, tenantId?: string) {
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
      include: {
        versions: {
          where: { isCurrent: true },
          take: 1
        },
        dependencies: true,
        vulnerabilities: {
          where: { status: { not: 'RESOLVED' } }
        }
      }
    });

    if (!plugin) return null;

    // Multi-tenant access control
    if (tenantId && plugin.tenantId && plugin.tenantId !== tenantId) {
      return null;
    }

    return plugin;
  }

  private async startAsyncEvaluation(pluginId: string, options: QualityEvaluationOptions) {
    const {
      tenantId,
      userId = 'system',
      triggerReason = 'Manual evaluation',
      checksToRun = [],
      configOverrides
    } = options;

    const evaluationJob = await prisma.qualityEvaluationJob.create({
      data: {
        pluginId,
        tenantId,
        jobType: checksToRun.length > 0 ? 
          EvaluationJobType.CUSTOM_EVALUATION : 
          EvaluationJobType.FULL_EVALUATION,
        status: EvaluationJobStatus.QUEUED,
        priority: 5,
        config: configOverrides ? JSON.stringify(configOverrides) : null,
        checksToRun,
        triggerReason,
        scheduledAt: new Date(),
        metadata: {
          requestedBy: userId,
          requestedAt: new Date().toISOString()
        }
      }
    });

    // TODO: Queue the job for background processing
    // This would integrate with your job queue system (Bull, Agenda, etc.)
    
    return {
      success: true,
      jobId: evaluationJob.id,
      message: 'Quality evaluation job queued successfully'
    };
  }

  private async runSyncEvaluation(plugin: any, options: QualityEvaluationOptions) {
    const {
      tenantId,
      userId = 'system',
      triggerReason = 'Manual evaluation'
    } = options;

    // Prepare plugin data for evaluation
    const pluginData = this.preparePluginData(plugin);

    // Get quality gate configuration
    const config = await this.getQualityGateConfig(tenantId);
    if (config) {
      this.scoringEngine = new QualityScoringEngine(config);
    }

    // Run evaluation
    const evaluationResult = await this.scoringEngine.evaluatePluginQuality(
      plugin.id,
      pluginData,
      tenantId
    );

    // Save results
    const qualityScore = await this.saveEvaluationResult(
      plugin.id,
      tenantId,
      evaluationResult,
      triggerReason,
      userId
    );

    return {
      success: true,
      result: evaluationResult,
      qualityScoreId: qualityScore.id,
      message: 'Quality evaluation completed successfully'
    };
  }

  private async orderPluginsForEvaluation(
    pluginIds: string[], 
    priorityOrder: 'severity' | 'lastEvaluated' | 'random',
    tenantId?: string
  ): Promise<string[]> {
    switch (priorityOrder) {
      case 'severity':
        // Order by plugins with most critical issues first
        const pluginsBySeverity = await prisma.plugin.findMany({
          where: { 
            id: { in: pluginIds },
            tenantId 
          },
          include: {
            qualityIssues: {
              where: {
                status: { notIn: ['RESOLVED', 'CLOSED'] },
                severity: 'CRITICAL'
              }
            }
          }
        });
        return pluginsBySeverity
          .sort((a, b) => b.qualityIssues.length - a.qualityIssues.length)
          .map(p => p.id);

      case 'lastEvaluated':
        // Order by plugins with oldest evaluations first
        const pluginsByEvaluation = await prisma.plugin.findMany({
          where: { 
            id: { in: pluginIds },
            tenantId 
          },
          include: {
            qualityScore: {
              select: { evaluatedAt: true }
            }
          }
        });
        return pluginsByEvaluation
          .sort((a, b) => {
            const aDate = a.qualityScore?.evaluatedAt?.getTime() || 0;
            const bDate = b.qualityScore?.evaluatedAt?.getTime() || 0;
            return aDate - bDate; // Oldest first
          })
          .map(p => p.id);

      case 'random':
      default:
        // Shuffle array randomly
        const shuffled = [...pluginIds];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
  }

  private preparePluginData(plugin: any) {
    return {
      id: plugin.id,
      name: plugin.name,
      displayName: plugin.displayName,
      description: plugin.description,
      category: plugin.category,
      repository: plugin.repository,
      npm: plugin.npm,
      tags: plugin.tags,
      version: plugin.versions?.[0]?.version || plugin.version,
      dependencies: plugin.dependencies || [],
      lastUpdated: plugin.lastUpdated,
      downloadCount: Number(plugin.downloadCount) || 0,
      starCount: plugin.starCount || 0,
      issueCount: plugin.issueCount || 0,
      lastCommit: plugin.lastCommit,
      securityRiskLevel: plugin.securityRiskLevel,
      hasSecurityIssues: plugin.hasSecurityIssues || plugin.vulnerabilities?.length > 0,
      vulnerabilities: plugin.vulnerabilities || []
    };
  }

  private async getQualityGateConfig(tenantId?: string) {
    try {
      const config = await prisma.qualityGateConfig.findFirst({
        where: {
          OR: [
            { tenantId, isActive: true },
            { isDefault: true, isActive: true }
          ]
        },
        orderBy: [
          { tenantId: 'desc' },
          { isDefault: 'desc' }
        ]
      });

      if (config) {
        return {
          gradeAThreshold: config.gradeAThreshold,
          gradeBThreshold: config.gradeBThreshold,
          gradeCThreshold: config.gradeCThreshold,
          gradeDThreshold: config.gradeDThreshold,
          securityWeight: config.securityWeight,
          performanceWeight: config.performanceWeight,
          maintainabilityWeight: config.maintainabilityWeight,
          reliabilityWeight: config.reliabilityWeight,
          documentationWeight: config.documentationWeight,
          minimumOverallScore: config.minimumOverallScore,
          minimumSecurityScore: config.minimumSecurityScore,
          blockingIssues: config.blockingIssues,
          enabledChecks: typeof config.enabledChecks === 'string' ? 
            JSON.parse(config.enabledChecks) : config.enabledChecks,
          checkWeights: typeof config.checkWeights === 'string' ? 
            JSON.parse(config.checkWeights) : config.checkWeights
        };
      }

      return undefined;
    } catch (error) {
      console.warn('Failed to load quality gate config:', error);
      return undefined;
    }
  }

  private async saveEvaluationResult(
    pluginId: string,
    tenantId: string | undefined,
    evaluationResult: QualityEvaluationResult,
    triggerReason: string,
    userId: string
  ) {
    // This would use the same logic as in the evaluate route
    // but extracted into a reusable service method
    return await prisma.$transaction(async (tx) => {
      // Implementation similar to the evaluate route
      // ... (shortened for brevity, would use the same transaction logic)
      
      const qualityScore = await tx.pluginQualityScore.upsert({
        where: { pluginId },
        update: {
          overallScore: evaluationResult.overallScore,
          overallGrade: evaluationResult.overallGrade,
          // ... other fields
          evaluatedAt: new Date(),
          updatedAt: new Date()
        },
        create: {
          pluginId,
          tenantId,
          overallScore: evaluationResult.overallScore,
          overallGrade: evaluationResult.overallGrade,
          // ... other fields
          evaluatedAt: new Date()
        }
      });

      return qualityScore;
    });
  }

  private analyzeTrend(trendData: any[]) {
    if (trendData.length === 0) {
      return {
        direction: 'UNKNOWN',
        averageChange: 0,
        totalPlugins: 0
      };
    }

    const changes = trendData.map(d => d.scoreChange || 0);
    const averageChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
    
    const uniquePlugins = new Set(trendData.map(d => d.pluginId)).size;

    return {
      direction: averageChange > 1 ? 'IMPROVING' : 
                 averageChange < -1 ? 'DECLINING' : 'STABLE',
      averageChange: Math.round(averageChange * 100) / 100,
      totalPlugins: uniquePlugins,
      dataPoints: trendData.length
    };
  }
}

export default QualityEvaluationService;