import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { npmRegistryService } from '@/services/npmRegistry';

const prisma = new PrismaClient();

// POST /api/plugins/approval/requests/[requestId]/security-scan
export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const user = await getServerSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId } = params;

    // Fetch the approval request
    const approvalRequest = await prisma.pluginApproval.findUnique({
      where: { id: requestId },
      include: {
        plugin: true,
        pluginVersion: true
      }
    });

    if (!approvalRequest) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
    }

    if (!approvalRequest.plugin?.name) {
      return NextResponse.json({ error: 'Plugin information not available' }, { status: 400 });
    }

    // Run security scan using NPM registry service
    const npmMetadata = await npmRegistryService.fetchPluginMetadata(
      approvalRequest.plugin.name,
      approvalRequest.pluginVersion?.version
    );

    // Create vulnerability records if found
    if (npmMetadata.security.vulnerabilities.length > 0) {
      for (const vuln of npmMetadata.security.vulnerabilities) {
        // Check if vulnerability already exists
        const existingVuln = await prisma.pluginVulnerability.findFirst({
          where: {
            pluginId: approvalRequest.plugin.id,
            cveId: vuln.cves?.[0],
            title: vuln.title
          }
        });

        if (!existingVuln) {
          await prisma.pluginVulnerability.create({
            data: {
              pluginId: approvalRequest.plugin.id,
              cveId: vuln.cves?.[0],
              severity: vuln.severity.toUpperCase() as any,
              score: 0, // Calculate CVSS score if available
              title: vuln.title,
              description: vuln.overview,
              affectedVersions: [vuln.vulnerableVersions],
              patchedVersions: vuln.patchedVersions ? [vuln.patchedVersions] : [],
              workaround: vuln.recommendation,
              references: vuln.references || [],
              status: 'OPEN',
              discoveredBy: 'NPM Security Scan',
              reportedAt: new Date()
            }
          });
        }
      }
    }

    // Record security scan in operations history
    await prisma.pluginOperation.create({
      data: {
        pluginId: approvalRequest.plugin.id,
        operationType: 'SECURITY_SCAN' as any,
        status: 'COMPLETED',
        version: approvalRequest.pluginVersion?.version,
        performedBy: user.id,
        parameters: {
          requestId,
          scanType: 'NPM_REGISTRY'
        } as any,
        result: {
          vulnerabilitiesFound: npmMetadata.security.vulnerabilities.length,
          securityScore: npmMetadata.security.score,
          scanDate: npmMetadata.security.lastScanned
        } as any,
        duration: 2000 // Mock duration
      }
    });

    // Update approval request status if critical vulnerabilities found
    const hasCritical = npmMetadata.security.vulnerabilities.some(v => v.severity === 'critical');
    if (hasCritical) {
      await prisma.pluginApproval.update({
        where: { id: requestId },
        data: {
          status: 'IN_REVIEW',
          comments: {
            push: {
              id: `comment-${Date.now()}`,
              author: 'Security Scanner',
              role: 'system',
              message: `Critical security vulnerabilities detected. Manual review required.`,
              timestamp: new Date().toISOString(),
              type: 'REQUEST_INFO'
            }
          }
        }
      });
    }

    return NextResponse.json({
      status: 'success',
      message: 'Security scan completed',
      results: {
        vulnerabilities: npmMetadata.security.vulnerabilities,
        score: npmMetadata.security.score,
        lastScanned: npmMetadata.security.lastScanned,
        hasCritical,
        recommendation: hasCritical 
          ? 'Critical vulnerabilities detected. Consider using an alternative plugin or wait for patches.'
          : npmMetadata.security.vulnerabilities.length > 0
          ? 'Some vulnerabilities detected. Review and assess risk before proceeding.'
          : 'No known vulnerabilities detected.'
      }
    });
  } catch (error) {
    console.error('Failed to run security scan:', error);
    return NextResponse.json(
      { error: 'Failed to run security scan' },
      { status: 500 }
    );
  }
}