import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

// GET /api/auth/org/[slug] - Get organization details for login
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: 'Organization slug is required' },
        { status: 400 }
      );
    }

    // Find organization by slug or domain
    const organization = await prisma.organization.findFirst({
      where: {
        OR: [
          { slug: slug.toLowerCase() },
          { domain: slug.toLowerCase() },
          { name: slug.toLowerCase() }
        ],
        status: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        slug: true,
        displayName: true,
        ssoEnabled: true,
        ssoProvider: true,
        allowLocalAuth: true,
        enforceSSO: true,
        allowedEmailDomains: true,
        environment: true,
        domain: true,
        // Don't expose sensitive SSO config details
      }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Return organization info for login page
    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        displayName: organization.displayName,
        ssoEnabled: organization.ssoEnabled,
        ssoProvider: organization.ssoProvider,
        allowLocalAuth: organization.allowLocalAuth,
        enforceSSO: organization.enforceSSO,
        allowedEmailDomains: organization.allowedEmailDomains,
        environment: organization.environment,
        domain: organization.domain,
      },
      authMethods: {
        sso: organization.ssoEnabled,
        local: organization.allowLocalAuth || !organization.ssoEnabled,
        ssoOnly: organization.enforceSSO && organization.ssoEnabled,
      }
    });
  } catch (error) {
    console.error('Organization lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup organization' },
      { status: 500 }
    );
  }
}
