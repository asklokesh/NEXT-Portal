import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { headers } from 'next/headers';
import { IssueStatus, ResolutionMethod, HistoryTrigger } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; issueId: string } }
) {
  try {
    const pluginId = params.id;
    const issueId = params.issueId;
    const headersList = headers();
    const tenantId = headersList.get('x-tenant-id') || undefined;
    const userId = headersList.get('x-user-id') || 'system';
    const body = await request.json();

    const {
      status = 'RESOLVED', // RESOLVED, CLOSED, WONT_FIX, FALSE_POSITIVE, DUPLICATE
      resolutionMethod,
      resolutionNotes,
      triggerReEvaluation = false,
      duplicateOfId, // If status is DUPLICATE
      testEvidence, // Evidence that the issue has been resolved
      preventRecurrence // Steps taken to prevent recurrence
    } = body;

    // Validate required fields based on status
    if (status === 'RESOLVED' && !resolutionMethod) {
      return NextResponse.json(
        { error: 'resolutionMethod is required when resolving an issue' },
        { status: 400 }
      );
    }

    if (status === 'DUPLICATE' && !duplicateOfId) {
      return NextResponse.json(
        { error: 'duplicateOfId is required when marking issue as duplicate' },
        { status: 400 }
      );
    }

    // Check if issue exists and user has access
    const existingIssue = await prisma.pluginQualityIssue.findUnique({
      where: { id: issueId },
      include: {
        plugin: {
          select: {
            id: true,
            name: true,
            displayName: true,
            tenantId: true
          }
        },
        qualityScore: {
          select: {
            id: true,
            overallScore: true,
            overallGrade: true
          }
        }
      }
    });

    if (!existingIssue) {
      return NextResponse.json(
        { error: 'Quality issue not found' },
        { status: 404 }
      );
    }

    // Verify plugin ID matches
    if (existingIssue.pluginId !== pluginId) {
      return NextResponse.json(
        { error: 'Issue does not belong to the specified plugin' },
        { status: 400 }
      );
    }

    // Multi-tenant access control
    if (tenantId && existingIssue.tenantId && existingIssue.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Access denied to resolve this quality issue' },
        { status: 403 }
      );
    }

    // Check if issue is already resolved/closed
    if (['RESOLVED', 'CLOSED'].includes(existingIssue.status)) {
      return NextResponse.json(
        { 
          success: false,
          message: `Issue is already ${existingIssue.status.toLowerCase()}`,
          currentStatus: existingIssue.status
        },
        { status: 409 }
      );
    }

    // If marking as duplicate, verify the duplicate target exists
    if (status === 'DUPLICATE' && duplicateOfId) {
      const duplicateTarget = await prisma.pluginQualityIssue.findUnique({
        where: { id: duplicateOfId },
        select: { id: true, title: true, status: true }
      });

      if (!duplicateTarget) {
        return NextResponse.json(
          { error: 'Duplicate target issue not found' },
          { status: 400 }
        );
      }
    }

    // Update the issue
    const resolvedIssue = await prisma.$transaction(async (tx) => {
      // Update the issue
      const updatedIssue = await tx.pluginQualityIssue.update({
        where: { id: issueId },
        data: {
          status: status as IssueStatus,
          resolvedAt: ['RESOLVED', 'CLOSED', 'WONT_FIX', 'FALSE_POSITIVE', 'DUPLICATE'].includes(status) 
            ? new Date() 
            : null,
          resolvedBy: userId,
          resolutionMethod: resolutionMethod as ResolutionMethod || null,
          resolutionNotes,
          updatedAt: new Date(),
          
          // Update metadata with resolution info
          metadata: {
            ...((existingIssue.metadata as any) || {}),
            resolvedBy: userId,
            resolutionDate: new Date().toISOString(),
            duplicateOfId: status === 'DUPLICATE' ? duplicateOfId : undefined,
            testEvidence: testEvidence || undefined,
            preventRecurrence: preventRecurrence || undefined
          }
        },
        include: {
          plugin: {
            select: {
              id: true,
              name: true,
              displayName: true
            }
          },
          qualityScore: {
            select: {
              id: true,
              overallScore: true,
              overallGrade: true
            }
          }
        }
      });

      // Add a comment about the resolution
      await tx.pluginQualityIssueComment.create({
        data: {
          issueId,
          userId,
          comment: generateResolutionComment(status, resolutionMethod, resolutionNotes),
          isInternal: false
        }
      });

      // If triggering re-evaluation, create an evaluation job
      if (triggerReEvaluation && existingIssue.severity === 'CRITICAL') {
        await tx.qualityEvaluationJob.create({
          data: {
            pluginId,
            tenantId: existingIssue.tenantId,
            jobType: 'TRIGGERED_EVALUATION',
            status: 'QUEUED',
            priority: 3, // Higher priority for issue resolution verification
            triggerReason: `Issue resolution verification: ${existingIssue.title}`,
            metadata: {
              triggeredBy: userId,
              resolvedIssueId: issueId,
              resolutionMethod
            }
          }
        });
      }

      return updatedIssue;
    });

    // If this was a critical issue, update quality score history
    if (existingIssue.severity === 'CRITICAL' && existingIssue.qualityScore) {
      await prisma.pluginQualityHistory.create({
        data: {
          qualityScoreId: existingIssue.qualityScore.id,
          pluginId,
          tenantId: existingIssue.tenantId,
          overallScore: existingIssue.qualityScore.overallScore,
          overallGrade: existingIssue.qualityScore.overallGrade,
          securityScore: 0,
          performanceScore: 0,
          maintainabilityScore: 0,
          reliabilityScore: 0,
          documentationScore: 0,
          scoreChange: 0,
          changeReason: `Critical issue resolved: ${existingIssue.title}`,
          triggerEvent: HistoryTrigger.ISSUE_RESOLUTION,
          evaluationEngine: 'manual',
          snapshot: JSON.stringify({
            resolvedIssue: {
              id: issueId,
              title: existingIssue.title,
              severity: existingIssue.severity,
              resolutionMethod
            }
          }),
          metadata: {
            resolvedBy: userId,
            resolutionDate: new Date().toISOString()
          }
        }
      });
    }

    // Log the resolution
    console.log(`Quality issue resolved for plugin ${pluginId}:`, {
      issueId,
      previousStatus: existingIssue.status,
      newStatus: status,
      resolutionMethod,
      resolvedBy: userId
    });

    const response = {
      success: true,
      message: getResolutionMessage(status, existingIssue.title),
      issue: {
        id: resolvedIssue.id,
        title: resolvedIssue.title,
        previousStatus: existingIssue.status,
        newStatus: resolvedIssue.status,
        resolvedAt: resolvedIssue.resolvedAt,
        resolvedBy: resolvedIssue.resolvedBy,
        resolutionMethod: resolvedIssue.resolutionMethod,
        resolutionNotes: resolvedIssue.resolutionNotes,
        
        plugin: resolvedIssue.plugin,
        
        // Impact on quality score (if applicable)
        qualityImpact: existingIssue.severity === 'CRITICAL' ? {
          triggerReEvaluation,
          expectedImprovement: 'Critical issue resolution should improve overall quality score'
        } : null
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error resolving plugin quality issue:', error);
    return NextResponse.json(
      { 
        error: 'Failed to resolve plugin quality issue',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; issueId: string } }
) {
  try {
    const pluginId = params.id;
    const issueId = params.issueId;
    const headersList = headers();
    const tenantId = headersList.get('x-tenant-id') || undefined;
    const userId = headersList.get('x-user-id') || 'system';
    const body = await request.json();

    const {
      comment,
      isInternal = false,
      attachments = [],
      mentionUsers = []
    } = body;

    if (!comment || comment.trim().length === 0) {
      return NextResponse.json(
        { error: 'Comment content is required' },
        { status: 400 }
      );
    }

    // Check if issue exists and user has access
    const existingIssue = await prisma.pluginQualityIssue.findUnique({
      where: { id: issueId },
      select: {
        id: true,
        pluginId: true,
        tenantId: true,
        title: true,
        status: true
      }
    });

    if (!existingIssue) {
      return NextResponse.json(
        { error: 'Quality issue not found' },
        { status: 404 }
      );
    }

    // Verify plugin ID matches
    if (existingIssue.pluginId !== pluginId) {
      return NextResponse.json(
        { error: 'Issue does not belong to the specified plugin' },
        { status: 400 }
      );
    }

    // Multi-tenant access control
    if (tenantId && existingIssue.tenantId && existingIssue.tenantId !== tenantId) {
      return NextResponse.json(
        { error: 'Access denied to comment on this quality issue' },
        { status: 403 }
      );
    }

    // Create the comment
    const newComment = await prisma.pluginQualityIssueComment.create({
      data: {
        issueId,
        userId,
        comment: comment.trim(),
        isInternal,
        metadata: {
          attachments: attachments || [],
          mentionUsers: mentionUsers || []
        }
      }
    });

    // Update the issue's updatedAt timestamp
    await prisma.pluginQualityIssue.update({
      where: { id: issueId },
      data: { updatedAt: new Date() }
    });

    // Log the comment
    console.log(`Comment added to quality issue ${issueId}:`, {
      userId,
      isInternal,
      commentLength: comment.length
    });

    return NextResponse.json({
      success: true,
      message: 'Comment added successfully',
      comment: {
        id: newComment.id,
        userId: newComment.userId,
        comment: newComment.comment,
        isInternal: newComment.isInternal,
        createdAt: newComment.createdAt
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error adding comment to quality issue:', error);
    return NextResponse.json(
      { 
        error: 'Failed to add comment to quality issue',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function generateResolutionComment(
  status: string, 
  resolutionMethod?: string, 
  resolutionNotes?: string
): string {
  let comment = `Issue marked as ${status.toLowerCase()}`;
  
  if (resolutionMethod) {
    comment += ` via ${resolutionMethod.toLowerCase().replace(/_/g, ' ')}`;
  }
  
  if (resolutionNotes) {
    comment += `.\n\nResolution notes: ${resolutionNotes}`;
  }
  
  return comment;
}

function getResolutionMessage(status: string, issueTitle: string): string {
  switch (status) {
    case 'RESOLVED':
      return `Quality issue "${issueTitle}" has been successfully resolved`;
    case 'CLOSED':
      return `Quality issue "${issueTitle}" has been closed`;
    case 'WONT_FIX':
      return `Quality issue "${issueTitle}" has been marked as won't fix`;
    case 'FALSE_POSITIVE':
      return `Quality issue "${issueTitle}" has been marked as false positive`;
    case 'DUPLICATE':
      return `Quality issue "${issueTitle}" has been marked as duplicate`;
    default:
      return `Quality issue "${issueTitle}" status has been updated to ${status.toLowerCase()}`;
  }
}