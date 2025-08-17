import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { headers } from 'next/headers';
import QualityScoringEngine from '@/services/quality-gate/quality-scoring-engine';
import { 
  QualityGrade, 
  HistoryTrigger, 
  EvaluationJobType, 
  EvaluationJobStatus 
} from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = params.id;
    const headersList = headers();
    const tenantId = headersList.get('x-tenant-id') || undefined;
    const userId = headersList.get('x-user-id') || 'system';
    const body = await request.json();

    const { 
      triggerReason = 'Manual evaluation',
      checksToRun = [],
      async = true,
      configOverrides = {}
    } = body;

    // Check if plugin exists
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        category: true,
        status: true,
        tenantId: true,
        repository: true,
        npm: true,
        tags: true,
        version: true,
        lastUpdated: true,
        healthScore: true,
        securityScore: true,
        maintenanceScore: true,
        downloadCount: true,
        starCount: true,
        issueCount: true,
        lastCommit: true,
        securityRiskLevel: true,
        hasSecurityIssues: true,
        dependencies: true
      }
    });

    if (!plugin) {
      return NextResponse.json(
        { error: 'Plugin not found' },
        { status: 404 }
      );
    }

    // Multi-tenant access control
    if (tenantId && plugin.tenantId && plugin.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Access denied to evaluate this plugin' },
        { status: 403 }
      );
    }

    // Check if there's already a running evaluation
    const existingJob = await prisma.qualityEvaluationJob.findFirst({
      where: {
        pluginId,
        status: { in: ['PENDING', 'QUEUED', 'RUNNING'] }
      }
    });

    if (existingJob) {
      return NextResponse.json({
        success: false,
        message: 'Quality evaluation already in progress',
        jobId: existingJob.id,
        status: existingJob.status,
        progress: existingJob.progress
      }, { status: 409 });
    }

    if (async) {
      // Create evaluation job for async processing
      const evaluationJob = await prisma.qualityEvaluationJob.create({
        data: {
          pluginId,
          tenantId,
          jobType: checksToRun.length > 0 ? EvaluationJobType.CUSTOM_EVALUATION : EvaluationJobType.FULL_EVALUATION,
          status: EvaluationJobStatus.QUEUED,
          priority: 5,
          config: configOverrides,
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
      // This would typically use a job queue like Bull, Agenda, or similar
      processEvaluationJobAsync(evaluationJob.id);

      return NextResponse.json({
        success: true,
        message: 'Quality evaluation started',
        jobId: evaluationJob.id,
        status: 'QUEUED',
        estimatedDuration: '2-5 minutes',
        checkProgress: `/api/plugins/${pluginId}/quality/evaluate/${evaluationJob.id}/progress`
      });

    } else {
      // Synchronous evaluation
      const startTime = Date.now();

      // Prepare plugin data for evaluation
      const pluginData = await preparePluginDataForEvaluation(plugin);

      // Get quality gate configuration
      const config = await getQualityGateConfig(tenantId);

      // Initialize scoring engine
      const scoringEngine = new QualityScoringEngine(config);

      // Run quality evaluation
      const evaluationResult = await scoringEngine.evaluatePluginQuality(
        pluginId,
        pluginData,
        tenantId
      );

      // Save or update quality score
      const qualityScore = await saveQualityEvaluationResult(
        pluginId,
        tenantId,
        evaluationResult,
        triggerReason,
        userId
      );

      const duration = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        message: 'Quality evaluation completed',
        duration: `${duration}ms`,
        qualityScore: {
          id: qualityScore.id,
          overallScore: qualityScore.overallScore,
          overallGrade: qualityScore.overallGrade,
          passesMinimumStandards: qualityScore.passesMinimumStandards,
          evaluatedAt: qualityScore.evaluatedAt,
          
          categories: {
            security: {
              score: qualityScore.securityScore,
              grade: qualityScore.securityGrade
            },
            performance: {
              score: qualityScore.performanceScore,
              grade: qualityScore.performanceGrade
            },
            maintainability: {
              score: qualityScore.maintainabilityScore,
              grade: qualityScore.maintainabilityGrade
            },
            reliability: {
              score: qualityScore.reliabilityScore,
              grade: qualityScore.reliabilityGrade
            },
            documentation: {
              score: qualityScore.documentationScore,
              grade: qualityScore.documentationGrade
            }
          },
          
          metrics: {
            totalChecks: evaluationResult.checks.length,
            passedChecks: evaluationResult.checks.filter(c => c.passed).length,
            totalIssues: evaluationResult.issues.length,
            criticalIssues: evaluationResult.issues.filter(i => i.severity === 'CRITICAL').length
          },
          
          trend: {
            direction: qualityScore.trendDirection,
            improvement: qualityScore.scoreImprovement
          }
        }
      });
    }

  } catch (error) {
    console.error('Error running quality evaluation:', error);
    return NextResponse.json(
      { 
        error: 'Failed to run quality evaluation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function preparePluginDataForEvaluation(plugin: any) {
  // Prepare plugin data for quality evaluation
  const pluginData = {
    id: plugin.id,
    name: plugin.name,
    displayName: plugin.displayName,
    description: plugin.description,
    category: plugin.category,
    repository: plugin.repository,
    npm: plugin.npm,
    tags: plugin.tags,
    version: plugin.version,
    dependencies: plugin.dependencies,
    lastUpdated: plugin.lastUpdated,
    downloadCount: Number(plugin.downloadCount),
    starCount: plugin.starCount,
    issueCount: plugin.issueCount,
    lastCommit: plugin.lastCommit,
    securityRiskLevel: plugin.securityRiskLevel,
    hasSecurityIssues: plugin.hasSecurityIssues,
    
    // Additional data that might be available
    packageJson: null, // TODO: Fetch from repository if available
    readme: null, // TODO: Fetch from repository if available
    license: null, // TODO: Extract from package.json
    documentation: plugin.repository ? `${plugin.repository}/blob/main/README.md` : null,
    hasTests: false, // TODO: Determine from repository analysis
    hasCicd: false, // TODO: Determine from repository analysis
    bundleSize: null // TODO: Calculate or estimate
  };

  // Try to fetch additional data from NPM or repository
  if (plugin.npm) {
    try {
      const npmResponse = await fetch(plugin.npm.replace('/package/', '/'), {
        headers: { 'Accept': 'application/json' },
        cache: 'force-cache',
        next: { revalidate: 3600 }
      });
      
      if (npmResponse.ok) {
        const npmData = await npmResponse.json();
        pluginData.packageJson = npmData;
        pluginData.license = npmData.license;
        pluginData.readme = npmData.readme;
        
        // Estimate bundle size from package info
        const dependencyCount = Object.keys(npmData.dependencies || {}).length;
        pluginData.bundleSize = 50 + (dependencyCount * 15); // Rough estimation
      }
    } catch (error) {
      console.warn('Failed to fetch NPM data:', error);
    }
  }

  return pluginData;
}

async function getQualityGateConfig(tenantId?: string) {
  try {
    // Get tenant-specific or default quality gate configuration
    const config = await prisma.qualityGateConfig.findFirst({
      where: {
        OR: [
          { tenantId, isActive: true },
          { isDefault: true, isActive: true }
        ]
      },
      orderBy: [
        { tenantId: 'desc' }, // Prefer tenant-specific config
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

    return undefined; // Use default configuration
  } catch (error) {
    console.warn('Failed to load quality gate config, using defaults:', error);
    return undefined;
  }
}

async function saveQualityEvaluationResult(
  pluginId: string,
  tenantId: string | undefined,
  evaluationResult: any,
  triggerReason: string,
  userId: string
) {
  return await prisma.$transaction(async (tx) => {
    // Get existing quality score for trend analysis
    const existingScore = await tx.pluginQualityScore.findUnique({
      where: { pluginId }
    });

    // Upsert quality score
    const qualityScore = await tx.pluginQualityScore.upsert({
      where: { pluginId },
      update: {
        overallScore: evaluationResult.overallScore,
        overallGrade: evaluationResult.overallGrade,
        securityScore: evaluationResult.categoryScores.security,
        performanceScore: evaluationResult.categoryScores.performance,
        maintainabilityScore: evaluationResult.categoryScores.maintainability,
        reliabilityScore: evaluationResult.categoryScores.reliability,
        documentationScore: evaluationResult.categoryScores.documentation,
        securityGrade: evaluationResult.categoryGrades.security,
        performanceGrade: evaluationResult.categoryGrades.performance,
        maintainabilityGrade: evaluationResult.categoryGrades.maintainability,
        reliabilityGrade: evaluationResult.categoryGrades.reliability,
        documentationGrade: evaluationResult.categoryGrades.documentation,
        evaluatedAt: new Date(),
        confidenceLevel: evaluationResult.confidenceLevel,
        dataQualityScore: evaluationResult.dataQualityScore,
        passesMinimumStandards: evaluationResult.passesMinimumStandards,
        scoreImprovement: evaluationResult.scoreImprovement,
        trendDirection: evaluationResult.trendDirection,
        complianceFlags: evaluationResult.complianceFlags,
        updatedAt: new Date()
      },
      create: {
        pluginId,
        tenantId,
        overallScore: evaluationResult.overallScore,
        overallGrade: evaluationResult.overallGrade,
        securityScore: evaluationResult.categoryScores.security,
        performanceScore: evaluationResult.categoryScores.performance,
        maintainabilityScore: evaluationResult.categoryScores.maintainability,
        reliabilityScore: evaluationResult.categoryScores.reliability,
        documentationScore: evaluationResult.categoryScores.documentation,
        securityGrade: evaluationResult.categoryGrades.security,
        performanceGrade: evaluationResult.categoryGrades.performance,
        maintainabilityGrade: evaluationResult.categoryGrades.maintainability,
        reliabilityGrade: evaluationResult.categoryGrades.reliability,
        documentationGrade: evaluationResult.categoryGrades.documentation,
        evaluatedAt: new Date(),
        confidenceLevel: evaluationResult.confidenceLevel,
        dataQualityScore: evaluationResult.dataQualityScore,
        passesMinimumStandards: evaluationResult.passesMinimumStandards,
        scoreImprovement: evaluationResult.scoreImprovement,
        trendDirection: evaluationResult.trendDirection,
        complianceFlags: evaluationResult.complianceFlags
      }
    });

    // Save quality checks
    await tx.pluginQualityCheck.deleteMany({
      where: { qualityScoreId: qualityScore.id }
    });

    await tx.pluginQualityCheck.createMany({
      data: evaluationResult.checks.map((check: any) => ({
        qualityScoreId: qualityScore.id,
        pluginId,
        tenantId,
        checkType: check.checkType,
        checkName: check.checkName,
        checkId: check.checkId,
        category: check.category,
        status: 'COMPLETED',
        passed: check.passed,
        score: check.score,
        weight: check.weight,
        description: check.description,
        rationale: check.rationale,
        recommendation: check.recommendation,
        documentation: null,
        executedAt: new Date(),
        duration: check.duration,
        executionEngine: 'v1.0',
        evidence: check.evidence ? JSON.stringify(check.evidence) : null,
        metrics: check.metrics ? JSON.stringify(check.metrics) : null,
        errorDetails: check.errorDetails,
        severity: check.severity,
        impact: check.impact
      }))
    });

    // Save or update quality issues
    for (const issue of evaluationResult.issues) {
      // Check if issue already exists
      const existingIssue = await tx.pluginQualityIssue.findFirst({
        where: {
          qualityScoreId: qualityScore.id,
          title: issue.title
        }
      });

      if (existingIssue) {
        await tx.pluginQualityIssue.update({
          where: { id: existingIssue.id },
          data: {
            severity: issue.severity,
            description: issue.description,
            affectedChecks: issue.affectedChecks,
            impact: issue.impact,
            resolution: issue.resolution,
            workaround: issue.workaround,
            evidence: issue.evidence ? JSON.stringify(issue.evidence) : null,
            reproductionSteps: issue.reproductionSteps,
            affectedVersions: issue.affectedVersions,
            environment: issue.environment,
            references: issue.references,
            updatedAt: new Date()
          }
        });
      } else {
        await tx.pluginQualityIssue.create({
          data: {
            qualityScoreId: qualityScore.id,
            pluginId,
            tenantId,
            issueType: issue.issueType,
            category: issue.category,
            severity: issue.severity,
            title: issue.title,
            description: issue.description,
            affectedChecks: issue.affectedChecks,
            impact: issue.impact,
            resolution: issue.resolution,
            workaround: issue.workaround,
            status: 'OPEN',
            priority: 'MEDIUM',
            evidence: issue.evidence ? JSON.stringify(issue.evidence) : null,
            reproductionSteps: issue.reproductionSteps,
            affectedVersions: issue.affectedVersions,
            environment: issue.environment,
            references: issue.references
          }
        });
      }
    }

    // Record history entry
    await tx.pluginQualityHistory.create({
      data: {
        qualityScoreId: qualityScore.id,
        pluginId,
        tenantId,
        overallScore: evaluationResult.overallScore,
        overallGrade: evaluationResult.overallGrade,
        securityScore: evaluationResult.categoryScores.security,
        performanceScore: evaluationResult.categoryScores.performance,
        maintainabilityScore: evaluationResult.categoryScores.maintainability,
        reliabilityScore: evaluationResult.categoryScores.reliability,
        documentationScore: evaluationResult.categoryScores.documentation,
        scoreChange: evaluationResult.scoreImprovement || 0,
        changeReason: triggerReason,
        triggerEvent: HistoryTrigger.MANUAL_EVALUATION,
        pluginVersion: null, // TODO: Get current plugin version
        evaluationEngine: 'v1.0',
        snapshot: JSON.stringify({
          checks: evaluationResult.checks.length,
          issues: evaluationResult.issues.length,
          confidenceLevel: evaluationResult.confidenceLevel,
          dataQualityScore: evaluationResult.dataQualityScore,
          complianceFlags: evaluationResult.complianceFlags
        }),
        metadata: {
          evaluatedBy: userId,
          triggerReason,
          evaluationDuration: 'N/A'
        }
      }
    });

    return qualityScore;
  });
}

// Async job processing (placeholder - implement with your job queue)
async function processEvaluationJobAsync(jobId: string) {
  // This would typically be handled by a background job processor
  // For now, we'll just update the job status to indicate it's been queued
  setTimeout(async () => {
    try {
      await prisma.qualityEvaluationJob.update({
        where: { id: jobId },
        data: {
          status: EvaluationJobStatus.RUNNING,
          startedAt: new Date(),
          progress: 10,
          currentStep: 'Initializing quality checks'
        }
      });

      // TODO: Implement actual background processing
      // This is where you would run the quality evaluation in the background
      
    } catch (error) {
      console.error('Failed to process evaluation job:', error);
      await prisma.qualityEvaluationJob.update({
        where: { id: jobId },
        data: {
          status: EvaluationJobStatus.FAILED,
          error: error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date()
        }
      });
    }
  }, 1000);
}