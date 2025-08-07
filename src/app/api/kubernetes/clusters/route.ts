import { NextRequest, NextResponse } from 'next/server';
import { backstageClient } from '@/lib/backstage/real-client';
import { withAuth } from '@/lib/auth/middleware';

async function getClustersHandler(req: NextRequest): Promise<NextResponse> {
  try {
    // Get clusters from Backstage Kubernetes backend
    const clustersResponse = await backstageClient.request('/api/kubernetes/clusters');
    
    return NextResponse.json({
      items: clustersResponse.items || [],
      count: clustersResponse.items?.length || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching Kubernetes clusters:', error);
    
    // Return mock data when Backstage is unavailable
    const mockClusters = [
      {
        name: 'development',
        title: 'Development Cluster',
        authProvider: 'serviceAccount',
        dashboardUrl: 'https://k8s-dev.example.com',
        auth: {}
      },
      {
        name: 'staging',
        title: 'Staging Cluster', 
        authProvider: 'serviceAccount',
        dashboardUrl: 'https://k8s-staging.example.com',
        auth: {}
      },
      {
        name: 'production',
        title: 'Production Cluster',
        authProvider: 'serviceAccount',
        dashboardUrl: 'https://k8s-prod.example.com',
        auth: {}
      }
    ];

    return NextResponse.json({
      items: mockClusters,
      count: mockClusters.length,
      timestamp: new Date().toISOString(),
      fallback: true,
      warning: 'Using mock data - Backstage Kubernetes backend unavailable'
    });
  }
}

// Apply authentication middleware
export const GET = withAuth(getClustersHandler);