import { NextRequest, NextResponse } from 'next/server';
import { backstageClient } from '@/lib/backstage/real-client';
import { withAuth } from '@/lib/auth/middleware';

interface ProxyParams {
  cluster: string;
  path: string[];
}

async function proxyHandler(
  req: NextRequest,
  { params }: { params: ProxyParams }
): Promise<NextResponse> {
  try {
    const { cluster, path } = params;
    const kubernetesPath = '/' + path.join('/');
    const queryString = req.nextUrl.searchParams.toString();
    const fullPath = queryString ? `${kubernetesPath}?${queryString}` : kubernetesPath;

    console.log(`Proxying Kubernetes request: ${req.method} ${cluster}${fullPath}`);

    // Get request body if present
    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await req.text();
    }

    // Proxy request to Backstage Kubernetes backend
    const proxyResponse = await backstageClient.request(
      `/api/kubernetes/proxy${fullPath}`,
      {
        method: req.method,
        headers: {
          'Content-Type': req.headers.get('content-type') || 'application/json',
          'Backstage-Kubernetes-Cluster': cluster,
          // Forward other relevant headers
          ...(req.headers.get('accept') && { 'Accept': req.headers.get('accept')! }),
          ...(req.headers.get('authorization') && { 'Authorization': req.headers.get('authorization')! }),
        },
        ...(body && { body })
      }
    );

    // Forward the response from Backstage
    return new NextResponse(proxyResponse.body, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: {
        'Content-Type': proxyResponse.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Error proxying Kubernetes request:', error);
    
    // Return appropriate error response
    if (error instanceof Error) {
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        return NextResponse.json(
          { 
            error: 'Cluster or resource not found',
            cluster: params.cluster,
            path: '/' + params.path.join('/'),
            message: error.message 
          },
          { status: 404 }
        );
      }
      
      if (error.message.includes('403') || error.message.includes('Forbidden')) {
        return NextResponse.json(
          { 
            error: 'Insufficient permissions',
            cluster: params.cluster,
            path: '/' + params.path.join('/'),
            message: error.message 
          },
          { status: 403 }
        );
      }
      
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { 
            error: 'Authentication required',
            cluster: params.cluster,
            path: '/' + params.path.join('/'),
            message: error.message 
          },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: 'Failed to proxy Kubernetes request',
        cluster: params.cluster,
        path: '/' + params.path.join('/'),
        message: error instanceof Error ? error.message : 'Unknown error',
        fallback: true,
        warning: 'Backstage Kubernetes backend unavailable'
      },
      { status: 502 }
    );
  }
}

// Apply authentication middleware to all HTTP methods
export const GET = withAuth(proxyHandler);
export const POST = withAuth(proxyHandler);
export const PUT = withAuth(proxyHandler);
export const PATCH = withAuth(proxyHandler);
export const DELETE = withAuth(proxyHandler);
export const HEAD = withAuth(proxyHandler);
export const OPTIONS = withAuth(proxyHandler);