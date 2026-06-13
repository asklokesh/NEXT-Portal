import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/auth/enterprise/lookup - Look up organization by domain for SSO redirect
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain } = body;

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json(
        { error: 'Domain is required' },
        { status: 400 }
      );
    }

    const cleanDomain = domain.toLowerCase().trim().replace(/^@/, '');

    const organization = await prisma.organization.findFirst({
      where: {
        status: 'ACTIVE',
        ssoEnabled: true,
        allowedEmailDomains: {
          has: cleanDomain,
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        displayName: true,
        ssoEnabled: true,
        ssoProvider: true,
        ssoConfig: true,
        enforceSSO: true,
        allowLocalAuth: true,
      },
    });

    if (!organization) {
      return NextResponse.json({
        found: false,
        error: 'No SSO-enabled organization found for this domain',
      });
    }

    // Build SSO redirect URL based on provider
    let ssoUrl: string | null = null;
    const config = organization.ssoConfig as Record<string, string> | null;

    if (config?.authorizationEndpoint && config?.clientId) {
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: `${process.env.NEXTAUTH_URL || 'http://localhost:4400'}/api/auth/callback/${organization.ssoProvider?.toLowerCase()}`,
        response_type: 'code',
        scope: 'openid email profile',
        state: organization.slug,
      });
      ssoUrl = `${config.authorizationEndpoint}?${params.toString()}`;
    }

    return NextResponse.json({
      found: true,
      organization: {
        id: organization.id,
        slug: organization.slug,
        displayName: organization.displayName,
        ssoProvider: organization.ssoProvider,
        enforceSSO: organization.enforceSSO,
        allowLocalAuth: organization.allowLocalAuth,
      },
      ssoUrl,
    });
  } catch (error) {
    console.error('Enterprise lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to look up organization' },
      { status: 500 }
    );
  }
}
