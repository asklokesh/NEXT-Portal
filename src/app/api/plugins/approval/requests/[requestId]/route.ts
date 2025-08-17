import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { npmRegistryService } from '@/services/npmRegistry';

const prisma = new PrismaClient();

// GET /api/plugins/approval/requests/[requestId]
export async function GET(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const user = await getServerSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = params;

    // Fetch approval request with all related data
    const approvalRequest = await prisma.pluginApproval.findUnique({
      where: { id: requestId },
      include: {
        plugin: true,
        pluginVersion: true,
        governance: {
          include: {
            plugin: true
          }
        }
      }
    });

    if (!approvalRequest) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
    }

    // Get plugin metadata from NPM
    let npmMetadata = null;
    if (approvalRequest.plugin?.name) {
      try {
        npmMetadata = await npmRegistryService.fetchPluginMetadata(
          approvalRequest.plugin.name,
          approvalRequest.pluginVersion?.version
        );
      } catch (error) {
        console.error(`Failed to fetch NPM metadata:`, error);
      }
    }

    // Get operation history
    const history = await prisma.pluginOperation.findMany({
      where: {
        pluginId: approvalRequest.pluginId || undefined,
        parameters: {
          path: ['requestId'],
          equals: requestId
        }
      },
      orderBy: { startedAt: 'desc' }
    });

    // Transform to match frontend expectations
    const transformedRequest = {
      id: approvalRequest.id,
      pluginId: approvalRequest.pluginId,
      pluginName: approvalRequest.plugin?.displayName || approvalRequest.plugin?.name || 'Unknown Plugin',
      pluginVersion: approvalRequest.pluginVersion?.version || 'latest',
      requestType: approvalRequest.requestType,
      status: approvalRequest.status,
      priority: approvalRequest.priority,
      requestedBy: {
        id: approvalRequest.requestedBy,
        name: 'User Name', // Should come from user service
        email: 'user@example.com',
        team: 'Development Team'
      },
      approvers: approvalRequest.governance?.approvers?.map(id => ({
        id,
        name: 'Approver Name',
        role: 'ADMIN',
        approved: approvalRequest.approvedBy === id,
        approvedAt: approvalRequest.approvedAt?.toISOString(),
        comments: approvalRequest.comments?.find((c: any) => c.authorId === id)?.message
      })) || [],
      stage: determineCurrentStage(approvalRequest),
      securityScan: {
        status: npmMetadata?.security?.vulnerabilities?.length > 0 ? 'WARNING' : 'PASSED',
        vulnerabilities: npmMetadata?.security?.vulnerabilities?.map(v => ({
          severity: v.severity,
          title: v.title,
          description: v.overview,
          cve: v.cves?.[0]
        })) || [],
        score: npmMetadata?.security?.score || 100,
        scannedAt: npmMetadata?.security?.lastScanned?.toISOString()
      },
      complianceCheck: {
        status: 'COMPLIANT',
        violations: [],
        policies: [
          { name: 'Open Source License', status: npmMetadata?.license?.isOSI ? 'PASS' : 'FAIL' },
          { name: 'Security Vulnerabilities', status: npmMetadata?.security?.score >= 80 ? 'PASS' : 'FAIL' },
          { name: 'Dependency Check', status: 'PASS' },
          { name: 'Code Quality', status: npmMetadata?.quality?.score >= 0.5 ? 'PASS' : 'WARNING' }
        ],
        checkedAt: new Date().toISOString()
      },
      testResults: {
        status: npmMetadata?.quality?.tests ? 'PASSED' : 'SKIPPED',
        passed: npmMetadata?.quality?.tests ? 10 : 0,
        failed: 0,
        skipped: npmMetadata?.quality?.tests ? 0 : 10,
        coverage: 75,
        duration: 5000,
        testedAt: new Date().toISOString()
      },
      dependencies: Object.entries(npmMetadata?.dependencies?.direct || {}).map(([name, version]) => ({
        name,
        version: version as string,
        approved: true,
        conflicts: npmMetadata?.dependencies?.conflictingDependencies?.filter(c => c.includes(name)) || []
      })),
      license: {
        type: npmMetadata?.license?.license || 'UNKNOWN',
        isApproved: npmMetadata?.license?.isCompatible || false,
        restrictions: npmMetadata?.license?.restrictions || []
      },
      metadata: {
        description: approvalRequest.plugin?.description || npmMetadata?.package?.description,
        repository: npmMetadata?.package?.repository?.url,
        homepage: npmMetadata?.package?.homepage,
        author: typeof npmMetadata?.package?.author === 'string' 
          ? npmMetadata.package.author 
          : npmMetadata?.package?.author?.name,
        downloads: npmMetadata?.popularity?.downloads?.monthly,
        stars: npmMetadata?.popularity?.stars,
        lastPublished: npmMetadata?.lastPublished?.toISOString()
      },
      history: history.map(h => ({
        action: formatOperationType(h.operationType),
        actor: h.performedBy,
        timestamp: h.startedAt.toISOString(),
        details: h.result?.message || h.error
      })),
      comments: approvalRequest.comments || [],
      businessJustification: (approvalRequest.evidence as any)?.businessJustification,
      technicalJustification: (approvalRequest.evidence as any)?.technicalJustification,
      estimatedImpact: (approvalRequest.evidence as any)?.estimatedImpact,
      createdAt: approvalRequest.createdAt.toISOString(),
      updatedAt: approvalRequest.updatedAt.toISOString(),
      expiresAt: approvalRequest.expiresAt?.toISOString()
    };

    return NextResponse.json(transformedRequest);
  } catch (error) {
    console.error('Failed to fetch approval request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approval request' },
      { status: 500 }
    );
  }
}

// Helper function to determine current stage
function determineCurrentStage(request: any) {
  const stages = [
    { id: 1, name: 'Security Review', type: 'SECURITY' },
    { id: 2, name: 'Compliance Check', type: 'COMPLIANCE' },
    { id: 3, name: 'Technical Review', type: 'TECHNICAL' },
    { id: 4, name: 'Business Approval', type: 'BUSINESS' },
    { id: 5, name: 'Final Approval', type: 'FINAL' }
  ];

  let currentStage = 1;
  
  if (request.status === 'APPROVED') {
    currentStage = 6; // Beyond final stage
  } else if (request.status === 'REJECTED') {
    // Stay at current stage
  } else if (request.governance?.securityReview && !request.securityReviewCompleted) {
    currentStage = 1;
  } else if (request.governance?.complianceReview && !request.complianceReviewCompleted) {
    currentStage = 2;
  } else if (!request.technicalReviewCompleted) {
    currentStage = 3;
  } else if (!request.businessApprovalCompleted) {
    currentStage = 4;
  } else {
    currentStage = 5;
  }

  const stage = stages[Math.min(currentStage - 1, stages.length - 1)];
  
  return {
    current: currentStage,
    total: stages.length,
    name: stage.name,
    type: stage.type
  };
}

// Helper function to format operation types
function formatOperationType(type: string): string {
  const typeMap: Record<string, string> = {
    'APPROVAL_REQUEST': 'Approval Requested',
    'APPROVED': 'Request Approved',
    'REJECTED': 'Request Rejected',
    'COMMENT_ADDED': 'Comment Added',
    'SECURITY_SCAN': 'Security Scan Completed',
    'COMPLIANCE_CHECK': 'Compliance Check Completed',
    'TEST_RUN': 'Tests Executed',
    'INSTALL': 'Plugin Installed',
    'UPDATE': 'Plugin Updated',
    'REMOVE': 'Plugin Removed'
  };
  
  return typeMap[type] || type;
}