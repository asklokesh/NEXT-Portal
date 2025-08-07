import { NextRequest, NextResponse } from 'next/server';
import { backstageClient } from '@/lib/backstage/real-client';
import { withAuth } from '@/lib/auth/middleware';

async function getCustomResourcesHandler(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { entity, customResources, auth = {} } = body;

    if (!entity?.metadata?.name) {
      return NextResponse.json(
        { error: 'Entity name is required' },
        { status: 400 }
      );
    }

    if (!customResources || !Array.isArray(customResources)) {
      return NextResponse.json(
        { error: 'Custom resources array is required' },
        { status: 400 }
      );
    }

    // Get custom resources from Backstage Kubernetes backend
    const customResourcesResponse = await backstageClient.request(
      '/api/kubernetes/resources/custom/query',
      {
        method: 'POST',
        body: JSON.stringify({ 
          entityRef: `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`,
          customResources,
          auth 
        })
      }
    );

    return NextResponse.json({
      items: customResourcesResponse.items || [],
      entity: entity.metadata.name,
      customResources,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching Kubernetes custom resources:', error);
    
    // Return mock custom resource data when Backstage is unavailable
    const body = await req.json().catch(() => ({}));
    const entityName = body.entity?.metadata?.name || 'unknown';
    const customResources = body.customResources || [];
    
    const mockCustomResources = [
      {
        cluster: 'development',
        resources: customResources.map((cr: any, index: number) => ({
          type: 'CustomResource',
          name: `${entityName}-${cr.plural}-${index + 1}`,
          namespace: 'default',
          cluster: 'development',
          status: 'healthy' as const,
          metadata: {
            creationTimestamp: new Date(Date.now() - 86400000 * (index + 1)).toISOString(),
            labels: {
              app: entityName,
              'backstage.io/kubernetes-id': entityName
            },
            annotations: {
              'backstage.io/managed-by': 'backstage'
            }
          },
          spec: {
            group: cr.group,
            version: cr.apiVersion,
            kind: cr.plural,
            // Example custom resource spec
            replicas: 1,
            selector: {
              matchLabels: { app: entityName }
            }
          },
          status_data: {
            phase: 'Running',
            observedGeneration: 1
          }
        })),
        errors: []
      }
    ];

    return NextResponse.json({
      items: mockCustomResources,
      entity: entityName,
      customResources,
      timestamp: new Date().toISOString(),
      fallback: true,
      warning: 'Using mock data - Backstage Kubernetes backend unavailable'
    });
  }
}

// Apply authentication middleware
export const POST = withAuth(getCustomResourcesHandler);