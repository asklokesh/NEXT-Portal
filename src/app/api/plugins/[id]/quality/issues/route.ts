import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { headers } from 'next/headers';
import { IssueStatus, IssueSeverity, IssuePriority } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pluginId = params.id;
    const headersList = headers();
    const tenantId = headersList.get('x-tenant-id') || undefined;
    
    // Get query parameters
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '25'), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
    const status = url.searchParams.get('status') as IssueStatus || undefined;
    const severity = url.searchParams.get('severity') as IssueSeverity || undefined;
    const priority = url.searchParams.get('priority') as IssuePriority || undefined;
    const assignedTo = url.searchParams.get('assignedTo') || undefined;
    const category = url.searchParams.get('category') || undefined;
    const includeResolved = url.searchParams.get('includeResolved') === 'true';

    // Check if plugin exists and user has access
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
      select: {
        id: true,
        name: true,
        displayName: true,
        tenantId: true
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
        { error: 'Access denied to this plugin quality issues' },
        { status: 403 }
      );
    }

    // Build where clause
    const whereClause: any = {
      pluginId,
      tenantId: tenantId || plugin.tenantId
    };

    if (status) whereClause.status = status;
    if (severity) whereClause.severity = severity;
    if (priority) whereClause.priority = priority;
    if (assignedTo) whereClause.assignedTo = assignedTo;
    if (category) whereClause.category = category;
    
    // Filter out resolved/closed issues unless explicitly requested
    if (!includeResolved) {
      whereClause.status = {
        notIn: ['RESOLVED', 'CLOSED']
      };
    }

    // Fetch quality issues
    const issues = await prisma.pluginQualityIssue.findMany({
      where: whereClause,
      orderBy: [
        { severity: 'desc' }, // Critical first
        { priority: 'desc' }, // High priority first
        { createdAt: 'desc' }  // Recent first
      ],
      skip: offset,
      take: limit,
      include: {
        qualityScore: {
          select: {
            id: true,
            overallScore: true,
            overallGrade: true,
            evaluatedAt: true
          }
        },
        comments: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            userId: true,
            comment: true,
            isInternal: true,
            createdAt: true
          }
        }
      }
    });

    // Get total count for pagination
    const totalCount = await prisma.pluginQualityIssue.count({
      where: whereClause
    });

    // Calculate issue statistics
    const issueStats = await calculateIssueStatistics(pluginId, tenantId || plugin.tenantId);

    // Group issues by severity and status for quick overview
    const issuesByStatus = await prisma.pluginQualityIssue.groupBy({
      by: ['status'],
      where: { pluginId, tenantId: tenantId || plugin.tenantId },
      _count: { status: true }
    });

    const issuesBySeverity = await prisma.pluginQualityIssue.groupBy({
      by: ['severity'],
      where: { pluginId, tenantId: tenantId || plugin.tenantId, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      _count: { severity: true }
    });

    const issuesByCategory = await prisma.pluginQualityIssue.groupBy({
      by: ['category'],
      where: { pluginId, tenantId: tenantId || plugin.tenantId, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      _count: { category: true }
    });

    // Check for overdue issues (past SLA deadline)
    const overdueIssues = await prisma.pluginQualityIssue.count({
      where: {
        pluginId,
        tenantId: tenantId || plugin.tenantId,
        status: { notIn: ['RESOLVED', 'CLOSED'] },
        slaDeadline: { lt: new Date() }
      }
    });

    // Format issues for response
    const formattedIssues = issues.map(issue => ({
      id: issue.id,
      issueType: issue.issueType,
      category: issue.category,
      severity: issue.severity,
      priority: issue.priority,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      
      // Affected information
      affectedChecks: issue.affectedChecks,
      affectedVersions: issue.affectedVersions,
      environment: issue.environment,
      
      // Resolution information
      impact: issue.impact,
      resolution: issue.resolution,
      workaround: issue.workaround,
      
      // Assignment and lifecycle
      assignedTo: issue.assignedTo,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      slaDeadline: issue.slaDeadline,
      escalatedAt: issue.escalatedAt,
      escalationLevel: issue.escalationLevel,
      
      // Resolution details (if resolved)
      resolvedAt: issue.resolvedAt,
      resolvedBy: issue.resolvedBy,
      resolutionNotes: issue.resolutionNotes,
      resolutionMethod: issue.resolutionMethod,
      
      // External references
      ticketId: issue.ticketId,
      references: issue.references,
      
      // Comments summary
      commentsCount: issue.comments.length,
      recentComments: issue.comments.filter(c => !c.isInternal).slice(0, 3),
      
      // Status indicators
      isOverdue: issue.slaDeadline ? issue.slaDeadline < new Date() : false,
      isEscalated: issue.escalationLevel > 0,
      
      // Evidence data (if available)
      hasEvidence: !!issue.evidence,
      evidence: issue.evidence ? 
        (typeof issue.evidence === 'string' ? JSON.parse(issue.evidence) : issue.evidence) : 
        null,
      
      // Related quality score info
      qualityScoreInfo: issue.qualityScore ? {
        id: issue.qualityScore.id,
        overallScore: issue.qualityScore.overallScore,
        overallGrade: issue.qualityScore.overallGrade,
        evaluatedAt: issue.qualityScore.evaluatedAt
      } : null
    }));

    const response = {
      plugin: {
        id: plugin.id,
        name: plugin.name,
        displayName: plugin.displayName
      },
      
      issues: formattedIssues,
      
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      },
      
      filters: {
        status,
        severity,
        priority,
        assignedTo,
        category,
        includeResolved
      },
      
      // Issue statistics and distribution
      statistics: {
        ...issueStats,
        overdueCount: overdueIssues,
        
        byStatus: issuesByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {} as Record<string, number>),
        
        bySeverity: issuesBySeverity.reduce((acc, item) => {
          acc[item.severity] = item._count.severity;
          return acc;
        }, {} as Record<string, number>),
        
        byCategory: issuesByCategory.reduce((acc, item) => {
          acc[item.category] = item._count.category;
          return acc;
        }, {} as Record<string, number>)
      }
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=120' // Cache for 2 minutes
      }
    });

  } catch (error) {
    console.error('Error fetching plugin quality issues:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch plugin quality issues',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

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
      issueType,
      category,
      severity,
      priority = 'MEDIUM',
      title,
      description,
      affectedChecks = [],
      impact,
      resolution,
      workaround,
      assignedTo,
      slaDeadline,
      evidence,
      reproductionSteps,
      affectedVersions = [],
      environment,
      references = []
    } = body;

    // Validate required fields
    if (!issueType || !category || !severity || !title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: issueType, category, severity, title, description' },
        { status: 400 }
      );
    }

    // Check if plugin exists and user has access
    const plugin = await prisma.plugin.findUnique({
      where: { id: pluginId },
      select: {
        id: true,
        name: true,
        tenantId: true,
        qualityScore: {
          select: { id: true }
        }
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
        { error: 'Access denied to create issues for this plugin' },
        { status: 403 }
      );
    }

    if (!plugin.qualityScore) {
      return NextResponse.json(
        { error: 'Plugin must have a quality score before issues can be created' },
        { status: 400 }
      );
    }

    // Create the quality issue
    const issue = await prisma.pluginQualityIssue.create({
      data: {
        qualityScoreId: plugin.qualityScore.id,
        pluginId,
        tenantId: tenantId || plugin.tenantId,
        issueType,
        category,
        severity,
        priority,
        title,
        description,
        affectedChecks,
        impact,
        resolution,
        workaround,
        status: 'OPEN',
        assignedTo,
        slaDeadline: slaDeadline ? new Date(slaDeadline) : null,
        evidence: evidence ? JSON.stringify(evidence) : null,
        reproductionSteps,
        affectedVersions,
        environment,
        references,
        metadata: {
          createdBy: userId,
          source: 'manual'
        }
      },
      include: {
        qualityScore: {
          select: {
            id: true,
            overallScore: true,
            overallGrade: true
          }
        }
      }
    });

    // Log the issue creation
    console.log(`Quality issue created for plugin ${pluginId}:`, {
      issueId: issue.id,
      severity: issue.severity,
      title: issue.title,
      createdBy: userId
    });

    return NextResponse.json({
      success: true,
      message: 'Quality issue created successfully',
      issue: {
        id: issue.id,
        issueType: issue.issueType,
        category: issue.category,
        severity: issue.severity,
        priority: issue.priority,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        assignedTo: issue.assignedTo,
        createdAt: issue.createdAt,
        slaDeadline: issue.slaDeadline
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating plugin quality issue:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create plugin quality issue',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function calculateIssueStatistics(pluginId: string, tenantId?: string) {
  const [
    totalIssues,
    openIssues,
    criticalIssues,
    highIssues,
    resolvedIssues,
    averageResolutionTime
  ] = await Promise.all([
    // Total issues
    prisma.pluginQualityIssue.count({
      where: { pluginId, tenantId }
    }),
    
    // Open issues
    prisma.pluginQualityIssue.count({
      where: { 
        pluginId, 
        tenantId,
        status: { notIn: ['RESOLVED', 'CLOSED'] }
      }
    }),
    
    // Critical issues
    prisma.pluginQualityIssue.count({
      where: { 
        pluginId, 
        tenantId,
        severity: 'CRITICAL',
        status: { notIn: ['RESOLVED', 'CLOSED'] }
      }
    }),
    
    // High severity issues
    prisma.pluginQualityIssue.count({
      where: { 
        pluginId, 
        tenantId,
        severity: 'HIGH',
        status: { notIn: ['RESOLVED', 'CLOSED'] }
      }
    }),
    
    // Resolved issues in last 30 days
    prisma.pluginQualityIssue.count({
      where: { 
        pluginId, 
        tenantId,
        status: { in: ['RESOLVED', 'CLOSED'] },
        resolvedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    }),
    
    // Calculate average resolution time
    prisma.pluginQualityIssue.findMany({
      where: { 
        pluginId, 
        tenantId,
        status: { in: ['RESOLVED', 'CLOSED'] },
        resolvedAt: { not: null }
      },
      select: {
        createdAt: true,
        resolvedAt: true
      },
      take: 50 // Last 50 resolved issues for average
    })
  ]);

  // Calculate average resolution time in hours
  const resolutionTimes = averageResolutionTime
    .filter(issue => issue.resolvedAt)
    .map(issue => {
      const created = new Date(issue.createdAt);
      const resolved = new Date(issue.resolvedAt!);
      return (resolved.getTime() - created.getTime()) / (1000 * 60 * 60); // Convert to hours
    });

  const avgResolutionHours = resolutionTimes.length > 0 ? 
    resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length : 0;

  return {
    totalIssues,
    openIssues,
    criticalIssues,
    highIssues,
    resolvedIssues: resolvedIssues,
    resolutionRate: totalIssues > 0 ? (resolvedIssues / totalIssues) * 100 : 0,
    averageResolutionTime: {
      hours: Math.round(avgResolutionHours * 100) / 100,
      days: Math.round((avgResolutionHours / 24) * 100) / 100
    }
  };
}