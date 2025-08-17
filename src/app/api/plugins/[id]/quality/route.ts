import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { headers } from 'next/headers';
import QualityScoringEngine from '@/services/quality-gate/quality-scoring-engine';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = params.id;
    const headersList = headers();
    const tenantId = headersList.get('x-tenant-id') || undefined;

    // Get current quality score for the plugin
    const qualityScore = await prisma.pluginQualityScore.findUnique({
      where: { pluginId },
      include: {
        plugin: {
          select: {
            id: true,
            name: true,
            displayName: true,
            category: true,
            status: true,
            tenantId: true
          }
        },
        checks: {
          orderBy: { executedAt: 'desc' },
          take: 50 // Limit to recent checks
        },
        issues: {
          where: { 
            status: { notIn: ['CLOSED', 'RESOLVED'] }
          },
          orderBy: { createdAt: 'desc' },
          include: {
            comments: {
              take: 3,
              orderBy: { createdAt: 'desc' }
            }
          }
        },
        history: {
          orderBy: { recordedAt: 'desc' },
          take: 10 // Last 10 evaluations for trend analysis
        }
      }
    });

    if (!qualityScore) {
      return NextResponse.json(
        { error: 'Quality score not found for this plugin' },
        { status: 404 }
      );
    }

    // Multi-tenant access control
    if (tenantId && qualityScore.tenantId && qualityScore.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Access denied to this plugin quality data' },
        { status: 403 }
      );
    }

    // Calculate quality metrics
    const totalChecks = qualityScore.checks.length;
    const passedChecks = qualityScore.checks.filter(c => c.passed).length;
    const failedChecks = totalChecks - passedChecks;
    
    const criticalIssues = qualityScore.issues.filter(i => i.severity === 'CRITICAL').length;
    const highIssues = qualityScore.issues.filter(i => i.severity === 'HIGH').length;
    const totalIssues = qualityScore.issues.length;

    // Calculate trend data
    const trendData = qualityScore.history.map(h => ({
      date: h.recordedAt,
      score: h.overallScore,
      grade: h.overallGrade,
      change: h.scoreChange || 0,
      trigger: h.triggerEvent
    }));

    // Group checks by category
    const checksByCategory = {
      SECURITY: qualityScore.checks.filter(c => c.category === 'SECURITY'),
      PERFORMANCE: qualityScore.checks.filter(c => c.category === 'PERFORMANCE'),
      MAINTAINABILITY: qualityScore.checks.filter(c => c.category === 'MAINTAINABILITY'),
      RELIABILITY: qualityScore.checks.filter(c => c.category === 'RELIABILITY'),
      DOCUMENTATION: qualityScore.checks.filter(c => c.category === 'DOCUMENTATION')
    };

    const response = {
      plugin: qualityScore.plugin,
      qualityScore: {
        id: qualityScore.id,
        overallScore: qualityScore.overallScore,
        overallGrade: qualityScore.overallGrade,
        evaluatedAt: qualityScore.evaluatedAt,
        evaluationEngine: qualityScore.evaluationEngine,
        confidenceLevel: qualityScore.confidenceLevel,
        dataQualityScore: qualityScore.dataQualityScore,
        passesMinimumStandards: qualityScore.passesMinimumStandards,
        scoreImprovement: qualityScore.scoreImprovement,
        trendDirection: qualityScore.trendDirection,
        complianceFlags: qualityScore.complianceFlags,
        
        // Category scores and grades
        categories: {
          security: {
            score: qualityScore.securityScore,
            grade: qualityScore.securityGrade,
            weight: qualityScore.securityWeight
          },
          performance: {
            score: qualityScore.performanceScore,
            grade: qualityScore.performanceGrade,
            weight: qualityScore.performanceWeight
          },
          maintainability: {
            score: qualityScore.maintainabilityScore,
            grade: qualityScore.maintainabilityGrade,
            weight: qualityScore.maintainabilityWeight
          },
          reliability: {
            score: qualityScore.reliabilityScore,
            grade: qualityScore.reliabilityGrade,
            weight: qualityScore.reliabilityWeight
          },
          documentation: {
            score: qualityScore.documentationScore,
            grade: qualityScore.documentationGrade,
            weight: qualityScore.documentationWeight
          }
        }
      },
      
      // Quality metrics summary
      metrics: {
        totalChecks,
        passedChecks,
        failedChecks,
        checkPassRate: totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 0,
        totalIssues,
        criticalIssues,
        highIssues,
        issueDistribution: {
          critical: criticalIssues,
          high: highIssues,
          medium: qualityScore.issues.filter(i => i.severity === 'MEDIUM').length,
          low: qualityScore.issues.filter(i => i.severity === 'LOW').length,
          info: qualityScore.issues.filter(i => i.severity === 'INFO').length
        }
      },
      
      // Recent checks by category
      checksByCategory: {
        security: checksByCategory.SECURITY.map(formatCheck),
        performance: checksByCategory.PERFORMANCE.map(formatCheck),
        maintainability: checksByCategory.MAINTAINABILITY.map(formatCheck),
        reliability: checksByCategory.RELIABILITY.map(formatCheck),
        documentation: checksByCategory.DOCUMENTATION.map(formatCheck)
      },
      
      // Active issues
      issues: qualityScore.issues.map(issue => ({
        id: issue.id,
        issueType: issue.issueType,
        category: issue.category,
        severity: issue.severity,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        priority: issue.priority,
        affectedChecks: issue.affectedChecks,
        createdAt: issue.createdAt,
        assignedTo: issue.assignedTo,
        slaDeadline: issue.slaDeadline,
        impact: issue.impact,
        resolution: issue.resolution,
        commentsCount: issue.comments.length,
        recentComments: issue.comments.slice(0, 2)
      })),
      
      // Trend analysis
      trend: {
        data: trendData,
        direction: qualityScore.trendDirection,
        improvement: qualityScore.scoreImprovement,
        evaluationCount: qualityScore.history.length
      },
      
      // Metadata
      lastEvaluated: qualityScore.evaluatedAt,
      nextEvaluationScheduled: null // TODO: implement scheduling
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=300' // Cache for 5 minutes
      }
    });

  } catch (error) {
    console.error('Error fetching plugin quality:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch plugin quality data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function formatCheck(check: any) {
  return {
    id: check.id,
    checkType: check.checkType,
    checkName: check.checkName,
    checkId: check.checkId,
    status: check.status,
    passed: check.passed,
    score: check.score,
    severity: check.severity,
    executedAt: check.executedAt,
    duration: check.duration,
    description: check.description,
    recommendation: check.recommendation,
    errorDetails: check.errorDetails,
    evidence: check.evidence ? (typeof check.evidence === 'string' ? JSON.parse(check.evidence) : check.evidence) : null,
    metrics: check.metrics ? (typeof check.metrics === 'string' ? JSON.parse(check.metrics) : check.metrics) : null
  };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = params.id;
    const headersList = headers();
    const tenantId = headersList.get('x-tenant-id') || undefined;
    const body = await request.json();

    // Validate request body
    const { 
      governanceExceptions, 
      complianceFlags,
      notes 
    } = body;

    // Get current quality score
    const existingScore = await prisma.pluginQualityScore.findUnique({
      where: { pluginId },
      include: { plugin: true }
    });

    if (!existingScore) {
      return NextResponse.json(
        { error: 'Quality score not found for this plugin' },
        { status: 404 }
      );
    }

    // Multi-tenant access control
    if (tenantId && existingScore.tenantId && existingScore.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Access denied to modify this plugin quality data' },
        { status: 403 }
      );
    }

    // Update quality score with governance data
    const updatedScore = await prisma.pluginQualityScore.update({
      where: { pluginId },
      data: {
        governanceExceptions: governanceExceptions || existingScore.governanceExceptions,
        complianceFlags: complianceFlags || existingScore.complianceFlags,
        updatedAt: new Date()
      },
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

    // Log the update
    console.log(`Quality score updated for plugin ${pluginId}:`, {
      governanceExceptions: !!governanceExceptions,
      complianceFlags: !!complianceFlags,
      notes
    });

    return NextResponse.json({
      success: true,
      message: 'Quality score updated successfully',
      qualityScore: {
        id: updatedScore.id,
        overallScore: updatedScore.overallScore,
        overallGrade: updatedScore.overallGrade,
        governanceExceptions: updatedScore.governanceExceptions,
        complianceFlags: updatedScore.complianceFlags,
        updatedAt: updatedScore.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating plugin quality:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update plugin quality data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}