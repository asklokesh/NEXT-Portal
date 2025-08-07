import { NextRequest, NextResponse } from 'next/server';
import { backstageClient } from '@/lib/backstage/real-client';
import { withAuth } from '@/lib/auth/middleware';

async function getResourcesHandler(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { entity, auth = {} } = body;

    if (!entity?.metadata?.name) {
      return NextResponse.json(
        { error: 'Entity name is required' },
        { status: 400 }
      );
    }

    // Get resources from Backstage Kubernetes backend
    const resourcesResponse = await backstageClient.request(
      `/api/kubernetes/services/${entity.metadata.name}`,
      {
        method: 'POST',
        body: JSON.stringify({ entity, auth })
      }
    );

    return NextResponse.json({
      items: resourcesResponse.items || [],
      entity: entity.metadata.name,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching Kubernetes resources:', error);
    
    // Return mock data when Backstage is unavailable
    const body = await req.json().catch(() => ({}));
    const entityName = body.entity?.metadata?.name || 'unknown';
    
    const mockResources = [
      {
        cluster: 'development',
        resources: [
          {
            type: 'Deployment',
            name: `${entityName}-deployment`,
            namespace: 'default',
            cluster: 'development',
            status: 'healthy' as const,
            metadata: {
              creationTimestamp: new Date(Date.now() - 86400000).toISOString(),
              labels: {
                app: entityName,
                environment: 'development'
              },
              annotations: {
                'backstage.io/kubernetes-id': entityName
              }
            },
            spec: {
              replicas: 2,
              selector: {
                matchLabels: { app: entityName }
              }
            },
            status_data: {
              readyReplicas: 2,
              replicas: 2,
              updatedReplicas: 2
            }
          },
          {
            type: 'Service',
            name: `${entityName}-service`,
            namespace: 'default',
            cluster: 'development',
            status: 'healthy' as const,
            metadata: {
              creationTimestamp: new Date(Date.now() - 86400000).toISOString(),
              labels: {
                app: entityName,
                environment: 'development'
              }
            },
            spec: {
              type: 'ClusterIP',
              ports: [{ port: 80, targetPort: 8080 }],
              selector: { app: entityName }
            }
          }
        ],
        errors: []
      }
    ];

    return NextResponse.json({
      items: mockResources,
      entity: entityName,
      timestamp: new Date().toISOString(),
      fallback: true,
      warning: 'Using mock data - Backstage Kubernetes backend unavailable'
    });
  }
}

// Apply authentication middleware
export const POST = withAuth(getResourcesHandler);