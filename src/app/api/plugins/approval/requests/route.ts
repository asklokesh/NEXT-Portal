import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { npmRegistryService } from '@/services/npmRegistry';

const prisma = new PrismaClient();

// Request creation schema
const CreateApprovalRequestSchema = z.object({
  pluginName: z.string(),
  pluginVersion: z.string(),
  requestType: z.enum(['INSTALL', 'UPDATE', 'REMOVE', 'CONFIGURATION']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
  businessJustification: z.string().optional(),
  technicalJustification: z.string().optional(),
  estimatedImpact: z.object({
    users: z.number().optional(),
    services: z.array(z.string()).optional(),
    downtime: z.number().optional()
  }).optional(),
  metadata: z.record(z.any()).optional()
});

// GET /api/plugins/approval/requests
export async function GET(request: NextRequest) {
  try {
    const user = await getServerSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const pluginId = searchParams.get('pluginId');
    const status = searchParams.get('status');
    const requestedBy = searchParams.get('requestedBy');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build query conditions
    const where: any = {};
    if (pluginId) where.pluginId = pluginId;
    if (status) where.status = status;
    if (requestedBy) where.requestedBy = requestedBy;

    // Fetch approval requests
    const [requests, total] = await Promise.all([
      prisma.pluginApproval.findMany({
        where,
        include: {
          plugin: true,
          pluginVersion: true,
          governance: {
            include: {
              plugin: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.pluginApproval.count({ where })
    ]);

    // Transform requests to match frontend expectations
    const transformedRequests = await Promise.all(requests.map(async (req) => {
      // Get plugin metadata from NPM if needed
      let npmMetadata = null;
      if (req.plugin?.name) {
        try {
          npmMetadata = await npmRegistryService.fetchPluginMetadata(req.plugin.name);
        } catch (error) {
          console.error(`Failed to fetch NPM metadata for ${req.plugin.name}:`, error);
        }
      }

      return {
        id: req.id,
        pluginId: req.pluginId,
        pluginName: req.plugin?.displayName || req.plugin?.name || 'Unknown Plugin',
        pluginVersion: req.pluginVersion?.version || 'latest',
        requestType: req.requestType,
        status: req.status,
        priority: req.priority,
        requestedBy: {
          id: req.requestedBy,
          name: 'User Name', // This should come from user service
          email: 'user@example.com',
          team: 'Development Team'
        },
        approvers: req.governance?.approvers?.map(id => ({
          id,
          name: 'Approver Name',
          role: 'ADMIN',
          approved: req.approvedBy === id,
          approvedAt: req.approvedAt?.toISOString()
        })) || [],
        stage: {
          current: 1,
          total: 5,
          name: 'Security Review',
          type: 'SECURITY'
        },
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
          status: 'PENDING',
          violations: [],
          policies: [],
          checkedAt: undefined
        },
        testResults: {
          status: 'PENDING',
          passed: 0,
          failed: 0,
          skipped: 0,
          coverage: 0
        },
        dependencies: Object.entries(npmMetadata?.dependencies?.direct || {}).map(([name, version]) => ({
          name,
          version: version as string,
          approved: true,
          conflicts: []
        })),
        license: {
          type: npmMetadata?.license?.license || 'UNKNOWN',
          isApproved: npmMetadata?.license?.isCompatible || false,
          restrictions: npmMetadata?.license?.restrictions || []
        },
        metadata: {
          description: req.plugin?.description || npmMetadata?.package?.description,
          repository: npmMetadata?.package?.repository?.url,
          homepage: npmMetadata?.package?.homepage,
          author: typeof npmMetadata?.package?.author === 'string' 
            ? npmMetadata.package.author 
            : npmMetadata?.package?.author?.name,
          downloads: npmMetadata?.popularity?.downloads?.monthly,
          stars: npmMetadata?.popularity?.stars
        },
        history: [],
        comments: req.comments || [],
        businessJustification: req.reason,
        technicalJustification: req.reason,
        estimatedImpact: req.evidence?.estimatedImpact,
        createdAt: req.createdAt.toISOString(),
        updatedAt: req.updatedAt.toISOString(),
        expiresAt: req.expiresAt?.toISOString()
      };
    }));

    return NextResponse.json({
      results: transformedRequests,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Failed to fetch approval requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approval requests' },
      { status: 500 }
    );
  }
}

// POST /api/plugins/approval/requests
export async function POST(request: NextRequest) {
  try {
    const user = await getServerSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = CreateApprovalRequestSchema.parse(body);

    // Check if plugin exists in database, create if not
    let plugin = await prisma.plugin.findFirst({
      where: { name: validatedData.pluginName }
    });

    if (!plugin) {
      // Fetch plugin metadata from NPM
      const npmMetadata = await npmRegistryService.fetchPluginMetadata(
        validatedData.pluginName,
        validatedData.pluginVersion
      );

      // Create plugin in database
      plugin = await prisma.plugin.create({
        data: {
          name: validatedData.pluginName,
          displayName: validatedData.pluginName,
          description: npmMetadata.package.description,
          category: 'OTHER',
          author: typeof npmMetadata.package.author === 'string'
            ? npmMetadata.package.author
            : npmMetadata.package.author?.name,
          repository: npmMetadata.package.repository?.url,
          homepage: npmMetadata.package.homepage,
          npm: `https://www.npmjs.com/package/${validatedData.pluginName}`,
          license: npmMetadata.license.license,
          keywords: npmMetadata.package.keywords || [],
          compatibility: npmMetadata.backstageCompatibility as any,
          latestVersion: npmMetadata.latestVersion,
          isBackstagePlugin: validatedData.pluginName.includes('backstage')
        }
      });
    }

    // Check if version exists, create if not
    let pluginVersion = await prisma.pluginVersion.findFirst({
      where: {
        pluginId: plugin.id,
        version: validatedData.pluginVersion
      }
    });

    if (!pluginVersion) {
      const semverParts = validatedData.pluginVersion.split('.');
      pluginVersion = await prisma.pluginVersion.create({
        data: {
          pluginId: plugin.id,
          version: validatedData.pluginVersion,
          semverMajor: parseInt(semverParts[0]) || 0,
          semverMinor: parseInt(semverParts[1]) || 0,
          semverPatch: parseInt(semverParts[2]) || 0,
          status: 'PENDING',
          dependencies: {} as any
        }
      });
    }

    // Get or create governance policy
    let governance = await prisma.pluginGovernance.findFirst({
      where: {
        pluginId: plugin.id,
        tenantId: user.id // Using user ID as tenant for now
      }
    });

    if (!governance) {
      governance = await prisma.pluginGovernance.create({
        data: {
          pluginId: plugin.id,
          tenantId: user.id,
          requiredApprovals: 2,
          approvers: [], // Should be populated with actual approvers
          reviewers: [],
          securityReview: true,
          complianceReview: true,
          autoApproval: false,
          createdBy: user.id
        }
      });
    }

    // Create approval request
    const approvalRequest = await prisma.pluginApproval.create({
      data: {
        governanceId: governance.id,
        pluginId: plugin.id,
        pluginVersionId: pluginVersion.id,
        requestType: validatedData.requestType as any,
        status: 'PENDING',
        priority: validatedData.priority as any,
        requestedBy: user.id,
        reason: validatedData.businessJustification || validatedData.technicalJustification,
        evidence: {
          businessJustification: validatedData.businessJustification,
          technicalJustification: validatedData.technicalJustification,
          estimatedImpact: validatedData.estimatedImpact,
          metadata: validatedData.metadata
        } as any,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      },
      include: {
        plugin: true,
        pluginVersion: true,
        governance: true
      }
    });

    // Create initial history entry
    await prisma.pluginOperation.create({
      data: {
        pluginId: plugin.id,
        operationType: 'APPROVAL_REQUEST',
        status: 'COMPLETED',
        version: validatedData.pluginVersion,
        performedBy: user.id,
        parameters: {
          requestId: approvalRequest.id,
          requestType: validatedData.requestType
        } as any,
        result: {
          approvalRequestId: approvalRequest.id
        } as any
      }
    });

    // Send notifications to approvers (implement notification service)
    // await notificationService.notifyApprovers(approvalRequest);

    return NextResponse.json({
      id: approvalRequest.id,
      status: 'success',
      message: 'Approval request created successfully'
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create approval request:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create approval request' },
      { status: 500 }
    );
  }
}