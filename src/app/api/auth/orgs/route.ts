import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/auth/orgs - List available organizations for login
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    // If email is provided, find organizations that match the email domain
    if (email) {
      const emailDomain = email.split('@')[1]?.toLowerCase();

      if (!emailDomain) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        );
      }

      // Find organizations that allow this email domain
      const organizations = await prisma.organization.findMany({
        where: {
          status: 'ACTIVE',
          allowedEmailDomains: {
            has: emailDomain
          }
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
          environment: true,
        },
        orderBy: {
          displayName: 'asc'
        }
      });

      return NextResponse.json({
        organizations,
        emailDomain,
        count: organizations.length
      });
    }

    // Return all active organizations (limited info for security)
    const organizations = await prisma.organization.findMany({
      where: {
        status: 'ACTIVE',
        environment: 'PRODUCTION' // Only show production environments in public list
      },
      select: {
        id: true,
        slug: true,
        displayName: true,
        ssoEnabled: true,
        ssoProvider: true,
      },
      orderBy: {
        displayName: 'asc'
      }
    });

    return NextResponse.json({
      organizations,
      count: organizations.length
    });
  } catch (error) {
    console.error('Organizations list error:', error);
    return NextResponse.json(
      { error: 'Failed to list organizations' },
      { status: 500 }
    );
  }
}

// POST /api/auth/orgs/discover - Discover organization by email
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const emailDomain = email.split('@')[1]?.toLowerCase();

    if (!emailDomain) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Find organizations that match this email domain
    const organizations = await prisma.organization.findMany({
      where: {
        status: 'ACTIVE',
        allowedEmailDomains: {
          has: emailDomain
        }
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
        environment: true,
      },
      orderBy: [
        { environment: 'asc' }, // Production first
        { displayName: 'asc' }
      ]
    });

    if (organizations.length === 0) {
      // Check if user exists without org membership
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });

      if (user) {
        // User exists but not associated with any org - allow default login
        return NextResponse.json({
          organizations: [],
          defaultLoginAllowed: true,
          emailDomain,
          message: 'User found, default login available'
        });
      }

      return NextResponse.json({
        organizations: [],
        defaultLoginAllowed: false,
        emailDomain,
        message: 'No organizations found for this email domain'
      });
    }

    // If only one org and SSO is enforced, redirect to SSO
    const primaryOrg = organizations.find(o => o.environment === 'PRODUCTION') || organizations[0];

    return NextResponse.json({
      organizations,
      primaryOrganization: primaryOrg,
      emailDomain,
      redirectToSSO: primaryOrg.enforceSSO && primaryOrg.ssoEnabled
    });
  } catch (error) {
    console.error('Organization discovery error:', error);
    return NextResponse.json(
      { error: 'Failed to discover organization' },
      { status: 500 }
    );
  }
}
