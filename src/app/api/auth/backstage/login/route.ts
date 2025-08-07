import { NextRequest, NextResponse } from 'next/server';
import { initiateBackstageOAuth } from '@/lib/auth/backstage-auth';
import { createAuditLog } from '@/lib/audit/service';

export async function GET(req: NextRequest) {
  const ipAddress = req.ip || req.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  try {
    // Log authentication attempt
    await createAuditLog({
      action: 'oauth.initiate',
      resource: 'authentication',
      resourceId: null,
      userId: null,
      details: {
        provider: 'backstage',
        ipAddress,
        userAgent,
      },
      status: 'info',
    });

    // Generate OAuth authorization URL
    const authUrl = initiateBackstageOAuth(req);
    
    // Redirect to Backstage OAuth authorization endpoint
    return NextResponse.redirect(authUrl);
    
  } catch (error) {
    console.error('Backstage OAuth initiation error:', error);
    
    await createAuditLog({
      action: 'oauth.initiate.error',
      resource: 'authentication',
      resourceId: null,
      userId: null,
      details: {
        provider: 'backstage',
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
        userAgent,
      },
      status: 'error',
    });

    // Redirect to login page with error
    const errorUrl = new URL('/login', req.nextUrl.origin);
    errorUrl.searchParams.set('error', 'oauth_config_error');
    errorUrl.searchParams.set('message', 'Failed to initiate Backstage authentication');
    
    return NextResponse.redirect(errorUrl);
  }
}

export async function POST(req: NextRequest) {
  // Handle POST requests with redirect URL in body
  try {
    const body = await req.json();
    const { redirectTo } = body;
    
    if (redirectTo) {
      // Store redirect URL in the OAuth state
      const url = new URL(req.url);
      url.searchParams.set('origin', redirectTo);
      const newRequest = new NextRequest(url, req);
      return GET(newRequest);
    }
    
    return GET(req);
  } catch (error) {
    // Fallback to GET if JSON parsing fails
    return GET(req);
  }
}