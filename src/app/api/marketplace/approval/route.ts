import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';
import { scanPluginSecurity } from '@/services/security/plugin-scanner';
import { validatePluginCompliance } from '@/services/compliance/compliance-validator';

const prisma = new PrismaClient();

// Approval request schema
const ApprovalRequestSchema = z.object({
  pluginId: z.string().min(1),
  requestType: z.enum(['INSTALL', 'UPDATE', 'CONFIGURATION_CHANGE', 'UNINSTALL', 'SECURITY_EXEMPTION']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY']).default('MEDIUM'),
  reason: z.string().min(10),
  evidence: z.object({
    documentation: z.string().url().optional(),
    testResults: z.string().url().optional(),
    securityReport: z.string().url().optional(),
    complianceReport: z.string().url().optional(),
    businessJustification: z.string().optional()
  }).optional(),
  scheduledDate: z.string().optional(),
  rollbackPlan: z.string().optional(),
  affectedSystems: z.array(z.string()).default([]),
  riskAssessment: z.object({
    level: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
    mitigations: z.array(z.string()).default([]),
    businessImpact: z.string().optional()
  }).optional()
});

// Approval action schema
const ApprovalActionSchema = z.object({
  approvalId: z.string().min(1),
  action: z.enum(['approve', 'reject', 'request_changes', 'escalate']),
  comments: z.string().optional(),
  conditions: z.array(z.string()).optional(),
  expiresAt: z.string().optional(),
  requireAdditionalApproval: z.boolean().default(false)
});

// Approval filters schema
const ApprovalFiltersSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'CONDITIONALLY_APPROVED']).optional(),
  requestType: z.enum(['INSTALL', 'UPDATE', 'CONFIGURATION_CHANGE', 'UNINSTALL', 'SECURITY_EXEMPTION']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'EMERGENCY']).optional(),
  requestedBy: z.string().optional(),
  approver: z.string().optional(),
  pluginId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  assignedToMe: z.coerce.boolean().default(false),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['created', 'priority', 'dueDate', 'status']).default('created'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

// GET /api/marketplace/approval - Get approval requests with filtering
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawFilters = Object.fromEntries(searchParams.entries());
    const filters = ApprovalFiltersSchema.parse(rawFilters);

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Build where clause based on filters and permissions
    let where: any = {};
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.requestType) {
      where.requestType = filters.requestType;
    }
    
    if (filters.priority) {
      where.priority = filters.priority;
    }
    
    if (filters.requestedBy) {
      where.requestedBy = filters.requestedBy;
    }
    
    if (filters.approver) {
      where.approvedBy = filters.approver;
    }
    
    if (filters.pluginId) {
      where.pluginId = filters.pluginId;
    }
    
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    // If assignedToMe is true, show requests where user is an approver
    if (filters.assignedToMe) {
      where.governance = {
        OR: [
          { approvers: { has: user.id } },
          { reviewers: { has: user.id } }
        ]
      };
    }

    // If not admin, limit to approvals user can see
    if (user.role !== 'ADMIN' && !filters.assignedToMe) {
      where.OR = [
        { requestedBy: user.id }, // User's own requests
        { 
          governance: {
            OR: [
              { approvers: { has: user.id } },
              { reviewers: { has: user.id } }
            ]
          }
        }
      ];
    }

    // Build ordering
    const orderBy: any = {};
    switch (filters.sortBy) {
      case 'created':
        orderBy.createdAt = filters.sortOrder;
        break;
      case 'priority':
        orderBy.priority = filters.sortOrder;
        break;
      case 'dueDate':
        orderBy.expiresAt = filters.sortOrder;
        break;
      case 'status':
        orderBy.status = filters.sortOrder;
        break;
    }

    const [approvals, totalCount] = await Promise.all([
      prisma.pluginApproval.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy,
        include: {
          plugin: {
            select: {
              id: true,
              name: true,
              displayName: true,
              category: true
            }
          },
          pluginVersion: {
            select: {
              version: true,
              status: true
            }
          },
          governance: {
            select: {
              requiredApprovals: true,
              approvers: true,
              reviewers: true,
              securityReview: true,
              complianceReview: true
            }
          },
          requester: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          approver: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.pluginApproval.count({ where })
    ]);

    // Enhance approval data with additional context
    const enhancedApprovals = await Promise.all(
      approvals.map(async (approval) => {
        // Get approval history/comments
        const comments = approval.comments ? JSON.parse(approval.comments as string) : [];
        
        // Get security scan results if available
        let securityScan = null;
        if (approval.governance?.securityReview) {
          try {
            securityScan = await getLatestSecurityScan(approval.pluginId!);
          } catch (error) {
            console.warn('Failed to fetch security scan:', error);
          }
        }
        
        // Get compliance check results if available
        let complianceCheck = null;
        if (approval.governance?.complianceReview) {
          try {
            complianceCheck = await getLatestComplianceCheck(approval.pluginId!);
          } catch (error) {
            console.warn('Failed to fetch compliance check:', error);
          }
        }
        
        // Calculate approval progress
        const approvalProgress = {
          required: approval.governance?.requiredApprovals || 1,
          received: approval.approvedBy ? 1 : 0,
          pending: (approval.governance?.requiredApprovals || 1) - (approval.approvedBy ? 1 : 0)
        };
        
        return {
          id: approval.id,
          requestType: approval.requestType,
          status: approval.status,
          priority: approval.priority,
          reason: approval.reason,
          evidence: approval.evidence,
          requirements: approval.requirements,
          comments,
          expiresAt: approval.expiresAt?.toISOString(),
          createdAt: approval.createdAt.toISOString(),
          updatedAt: approval.updatedAt.toISOString(),
          approvedAt: approval.approvedAt?.toISOString(),
          rejectedAt: approval.rejectedAt?.toISOString(),
          plugin: approval.plugin,
          version: approval.pluginVersion?.version,
          requester: approval.requester,
          approver: approval.approver,
          governance: approval.governance,
          approvalProgress,
          securityScan,
          complianceCheck,
          canApprove: canUserApprove(user, approval),
          isExpired: approval.expiresAt ? new Date() > approval.expiresAt : false,
          daysUntilExpiry: approval.expiresAt ? Math.ceil((approval.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
        };
      })
    );

    // Get summary statistics
    const summary = {
      total: totalCount,
      byStatus: await prisma.pluginApproval.groupBy({
        by: ['status'],
        where: user.role === 'ADMIN' ? {} : where,
        _count: { status: true }
      }).then(stats => stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.status;
        return acc;
      }, {} as Record<string, number>)),
      byPriority: await prisma.pluginApproval.groupBy({
        by: ['priority'],
        where: user.role === 'ADMIN' ? {} : where,
        _count: { priority: true }
      }).then(stats => stats.reduce((acc, stat) => {
        acc[stat.priority] = stat._count.priority;
        return acc;
      }, {} as Record<string, number>)),
      assignedToUser: filters.assignedToMe ? totalCount : await prisma.pluginApproval.count({
        where: {
          status: 'PENDING',
          governance: {
            OR: [
              { approvers: { has: user.id } },
              { reviewers: { has: user.id } }
            ]
          }
        }
      })
    };

    return NextResponse.json({
      success: true,
      data: {
        approvals: enhancedApprovals,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / filters.limit),
          hasNext: filters.page * filters.limit < totalCount,
          hasPrev: filters.page > 1
        },
        summary
      }
    });

  } catch (error) {
    console.error('Approval API Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request parameters',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch approval requests',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// POST /api/marketplace/approval - Create new approval request
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const body = await request.json();
    const requestData = ApprovalRequestSchema.parse(body);

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Verify plugin exists
    const plugin = await prisma.plugin.findUnique({
      where: { id: requestData.pluginId },
      select: {
        id: true,
        name: true,
        displayName: true,
        author: true
      }
    });

    if (!plugin) {
      return NextResponse.json({
        success: false,
        error: 'Plugin not found'
      }, { status: 404 });
    }

    // Get or create governance configuration for the plugin
    let governance = await prisma.pluginGovernance.findFirst({
      where: {
        pluginId: requestData.pluginId,
        isActive: true
      }
    });

    if (!governance) {
      // Create default governance configuration
      governance = await prisma.pluginGovernance.create({
        data: {
          pluginId: requestData.pluginId,
          tenantId: 'default-tenant', // Replace with actual tenant logic
          requiredApprovals: requestData.requestType === 'INSTALL' ? 2 : 1,
          approvers: ['admin-user-id'], // Replace with actual admin/approver logic
          reviewers: ['security-team-id'],
          securityReview: ['INSTALL', 'UPDATE', 'SECURITY_EXEMPTION'].includes(requestData.requestType),
          complianceReview: requestData.requestType !== 'UNINSTALL',
          createdBy: user.id
        }
      });
    }

    // Check for existing pending approval for the same plugin and request type
    const existingApproval = await prisma.pluginApproval.findFirst({
      where: {
        pluginId: requestData.pluginId,
        requestType: requestData.requestType,
        status: 'PENDING',
        requestedBy: user.id
      }
    });

    if (existingApproval) {
      return NextResponse.json({
        success: false,
        error: 'A pending approval request already exists for this plugin and request type'
      }, { status: 409 });
    }

    // Create the approval request
    const approval = await prisma.pluginApproval.create({
      data: {
        governanceId: governance.id,
        pluginId: requestData.pluginId,
        requestType: requestData.requestType,
        priority: requestData.priority,
        requestedBy: user.id,
        reason: requestData.reason,
        evidence: requestData.evidence,
        requirements: {
          scheduledDate: requestData.scheduledDate,
          rollbackPlan: requestData.rollbackPlan,
          affectedSystems: requestData.affectedSystems,
          riskAssessment: requestData.riskAssessment
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      },
      include: {
        plugin: {
          select: {
            name: true,
            displayName: true
          }
        }
      }
    });

    // Trigger automated security scan if required
    if (governance.securityReview && requestData.requestType !== 'UNINSTALL') {
      try {
        await initiateSecurityScan(requestData.pluginId, approval.id);
      } catch (error) {
        console.warn('Failed to initiate security scan:', error);
      }
    }

    // Trigger compliance check if required
    if (governance.complianceReview) {
      try {
        await initiateComplianceCheck(requestData.pluginId, approval.id);
      } catch (error) {
        console.warn('Failed to initiate compliance check:', error);
      }
    }

    // Send notifications to approvers
    if (governance.approvers?.length > 0) {
      for (const approverId of governance.approvers) {
        await prisma.notification.create({
          data: {
            userId: approverId,
            type: 'info',
            title: 'New Approval Request',
            message: `${user.name} has requested approval for ${requestData.requestType.toLowerCase()} of plugin \"${approval.plugin?.displayName}\"`,
            priority: requestData.priority.toLowerCase(),
            sourceName: approval.plugin?.displayName || 'Plugin',
            sourceType: 'approval',
            metadata: JSON.stringify({
              approvalId: approval.id,
              pluginId: requestData.pluginId,
              requestType: requestData.requestType,
              priority: requestData.priority
            })
          }
        }).catch(console.warn);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        approvalId: approval.id,
        status: approval.status,
        expiresAt: approval.expiresAt?.toISOString(),
        message: 'Approval request created successfully'
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Approval request creation error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid approval request data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to create approval request',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// PUT /api/marketplace/approval - Process approval action (approve, reject, etc.)
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication required' 
      }, { status: 401 });
    }

    const body = await request.json();
    const actionData = ApprovalActionSchema.parse(body);

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    // Find the approval request
    const approval = await prisma.pluginApproval.findUnique({
      where: { id: actionData.approvalId },
      include: {
        governance: true,
        plugin: {
          select: {
            name: true,
            displayName: true
          }
        },
        requester: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!approval) {
      return NextResponse.json({
        success: false,
        error: 'Approval request not found'
      }, { status: 404 });
    }

    // Check if user has permission to perform this action
    const canPerformAction = canUserApprove(user, approval);
    if (!canPerformAction && actionData.action !== 'escalate') {
      return NextResponse.json({
        success: false,
        error: 'You do not have permission to perform this action'
      }, { status: 403 });
    }

    // Check if approval is still pending
    if (approval.status !== 'PENDING') {
      return NextResponse.json({
        success: false,
        error: `Approval request is already ${approval.status.toLowerCase()}`
      }, { status: 400 });
    }

    // Check if approval has expired
    if (approval.expiresAt && new Date() > approval.expiresAt) {
      await prisma.pluginApproval.update({
        where: { id: approval.id },
        data: { status: 'EXPIRED' }
      });
      
      return NextResponse.json({
        success: false,
        error: 'Approval request has expired'
      }, { status: 400 });
    }

    let updatedApproval;
    let notificationMessage = '';
    
    switch (actionData.action) {
      case 'approve':
        updatedApproval = await prisma.pluginApproval.update({
          where: { id: approval.id },
          data: {
            status: actionData.requireAdditionalApproval ? 'CONDITIONALLY_APPROVED' : 'APPROVED',
            approvedBy: user.id,
            approvedAt: new Date(),
            comments: actionData.comments ? JSON.stringify([{
              action: 'approve',
              comment: actionData.comments,
              conditions: actionData.conditions,
              userId: user.id,
              userName: user.name,
              timestamp: new Date()
            }]) : approval.comments,
            ...(actionData.expiresAt && { expiresAt: new Date(actionData.expiresAt) })
          }
        });
        
        notificationMessage = `Your plugin approval request has been ${actionData.requireAdditionalApproval ? 'conditionally approved' : 'approved'} by ${user.name}`;
        
        // If fully approved, trigger the actual plugin operation
        if (!actionData.requireAdditionalApproval) {
          await triggerPluginOperation(approval.pluginId!, approval.requestType, user.id);
        }
        break;
        
      case 'reject':
        updatedApproval = await prisma.pluginApproval.update({
          where: { id: approval.id },
          data: {
            status: 'REJECTED',
            reviewedBy: user.id,
            rejectedAt: new Date(),
            comments: JSON.stringify([{
              action: 'reject',
              comment: actionData.comments || 'Request rejected',
              userId: user.id,
              userName: user.name,
              timestamp: new Date()
            }])
          }
        });
        
        notificationMessage = `Your plugin approval request has been rejected by ${user.name}`;
        if (actionData.comments) {
          notificationMessage += `: ${actionData.comments}`;
        }
        break;
        
      case 'request_changes':
        updatedApproval = await prisma.pluginApproval.update({
          where: { id: approval.id },
          data: {
            status: 'PENDING',
            reviewedBy: user.id,
            comments: JSON.stringify([{
              action: 'request_changes',
              comment: actionData.comments || 'Changes requested',
              conditions: actionData.conditions,
              userId: user.id,
              userName: user.name,
              timestamp: new Date()
            }]),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Extend by 7 days
          }
        });
        
        notificationMessage = `Changes have been requested for your plugin approval by ${user.name}`;
        if (actionData.comments) {
          notificationMessage += `: ${actionData.comments}`;
        }
        break;
        
      case 'escalate':
        // Find higher-level approvers or admins
        const adminUsers = await prisma.user.findMany({
          where: { role: 'ADMIN' },
          select: { id: true }
        });
        
        updatedApproval = await prisma.pluginApproval.update({
          where: { id: approval.id },
          data: {
            priority: approval.priority === 'CRITICAL' ? 'EMERGENCY' : 
                     approval.priority === 'HIGH' ? 'CRITICAL' : 
                     approval.priority === 'MEDIUM' ? 'HIGH' : 'MEDIUM',
            comments: JSON.stringify([{
              action: 'escalate',
              comment: actionData.comments || 'Request escalated',
              userId: user.id,
              userName: user.name,
              timestamp: new Date()
            }])
          }
        });
        
        // Notify admins
        for (const admin of adminUsers) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
              type: 'warning',
              title: 'Escalated Approval Request',
              message: `Plugin approval request for \"${approval.plugin?.displayName}\" has been escalated by ${user.name}`,
              priority: 'high',
              sourceName: approval.plugin?.displayName || 'Plugin',
              sourceType: 'approval'
            }
          }).catch(console.warn);
        }
        
        notificationMessage = `Your plugin approval request has been escalated to administrators`;
        break;
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }

    // Send notification to the requester
    if (approval.requester) {
      await prisma.notification.create({
        data: {
          userId: approval.requester.id,
          type: actionData.action === 'approve' ? 'success' : 
                actionData.action === 'reject' ? 'error' : 'info',
          title: `Plugin Approval ${actionData.action === 'approve' ? 'Approved' : 
                                     actionData.action === 'reject' ? 'Rejected' : 
                                     'Updated'}`,
          message: notificationMessage,
          sourceName: approval.plugin?.displayName || 'Plugin',
          sourceType: 'approval',
          metadata: JSON.stringify({
            approvalId: approval.id,
            action: actionData.action,
            performedBy: user.id
          })
        }
      }).catch(console.warn);
    }

    return NextResponse.json({
      success: true,
      data: {
        approvalId: updatedApproval!.id,
        status: updatedApproval!.status,
        action: actionData.action,
        message: `Approval request ${actionData.action}${actionData.action.endsWith('e') ? 'd' : 'ed'} successfully`
      }
    });

  } catch (error) {
    console.error('Approval action error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid action data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to process approval action',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// Helper functions
function canUserApprove(user: any, approval: any): boolean {
  // Admins can approve anything
  if (user.role === 'ADMIN') return true;
  
  // Check if user is in the approvers list
  if (approval.governance?.approvers?.includes(user.id)) return true;
  
  // Check if user is in the reviewers list (can review but not approve)
  if (approval.governance?.reviewers?.includes(user.id)) return true;
  
  return false;
}

async function getLatestSecurityScan(pluginId: string) {
  // Mock implementation - would integrate with actual security scanning service
  return {
    status: 'completed',
    score: 85,
    vulnerabilities: {
      critical: 0,
      high: 1,
      medium: 3,
      low: 5
    },
    lastScanned: new Date().toISOString(),
    report: '/security-reports/plugin-123-scan.pdf'
  };
}

async function getLatestComplianceCheck(pluginId: string) {
  // Mock implementation - would integrate with compliance checking service
  return {
    status: 'passed',
    score: 92,
    frameworks: {
      'SOC2': 'compliant',
      'GDPR': 'compliant',
      'HIPAA': 'not_applicable'
    },
    lastChecked: new Date().toISOString(),
    report: '/compliance-reports/plugin-123-compliance.pdf'
  };
}

async function initiateSecurityScan(pluginId: string, approvalId: string) {
  // Mock implementation - would trigger actual security scanning
  console.log(`Initiating security scan for plugin ${pluginId}, approval ${approvalId}`);
  
  // In a real implementation, this would:
  // 1. Queue a security scan job
  // 2. Scan plugin code for vulnerabilities
  // 3. Check dependencies for known CVEs
  // 4. Validate plugin permissions and APIs
  // 5. Update approval with scan results
}

async function initiateComplianceCheck(pluginId: string, approvalId: string) {
  // Mock implementation - would trigger actual compliance checking
  console.log(`Initiating compliance check for plugin ${pluginId}, approval ${approvalId}`);
  
  // In a real implementation, this would:
  // 1. Check plugin against compliance frameworks
  // 2. Validate data handling practices
  // 3. Check access controls and permissions
  // 4. Verify audit logging capabilities
  // 5. Update approval with compliance results
}

async function triggerPluginOperation(pluginId: string, operationType: string, userId: string) {
  // Mock implementation - would trigger the actual plugin operation
  console.log(`Triggering ${operationType} operation for plugin ${pluginId} by user ${userId}`);
  
  // Create plugin operation record
  await prisma.pluginOperation.create({
    data: {
      pluginId,
      operationType: operationType as any,
      status: 'PENDING',
      performedBy: userId,
      environment: 'production'
    }
  });
  
  // In a real implementation, this would:
  // 1. Queue the plugin operation
  // 2. Execute the operation (install, update, uninstall)
  // 3. Update the operation status
  // 4. Send notifications on completion
}