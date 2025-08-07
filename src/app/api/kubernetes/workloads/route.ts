import { NextRequest, NextResponse } from 'next/server';
import { backstageClient } from '@/lib/backstage/real-client';
import { withAuth } from '@/lib/auth/middleware';

async function getWorkloadsHandler(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { entity, auth = {} } = body;

    if (!entity?.metadata?.name) {
      return NextResponse.json(
        { error: 'Entity name is required' },
        { status: 400 }
      );
    }

    // Get workloads from Backstage Kubernetes backend
    const workloadsResponse = await backstageClient.request(
      '/api/kubernetes/resources/workloads/query',
      {
        method: 'POST',
        body: JSON.stringify({ 
          entityRef: `${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`,
          auth 
        })
      }
    );

    return NextResponse.json({
      items: workloadsResponse.items || [],
      entity: entity.metadata.name,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching Kubernetes workloads:', error);
    
    // Return mock workload data when Backstage is unavailable
    const body = await req.json().catch(() => ({}));
    const entityName = body.entity?.metadata?.name || 'unknown';
    
    const mockWorkloads = [
      {
        cluster: 'development',
        resources: [
          // Deployments
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
                environment: 'development',
                'app.kubernetes.io/name': entityName,
                'app.kubernetes.io/instance': entityName,
                'app.kubernetes.io/component': 'backend'
              },
              annotations: {
                'backstage.io/kubernetes-id': entityName,
                'deployment.kubernetes.io/revision': '5'
              }
            },
            spec: {
              replicas: 3,
              strategy: {
                type: 'RollingUpdate',
                rollingUpdate: {
                  maxSurge: 1,
                  maxUnavailable: 1
                }
              },
              selector: {
                matchLabels: { app: entityName }
              },
              template: {
                spec: {
                  containers: [{
                    name: entityName,
                    image: `${entityName}:latest`,
                    ports: [{ containerPort: 8080 }],
                    resources: {
                      requests: { cpu: '100m', memory: '128Mi' },
                      limits: { cpu: '500m', memory: '512Mi' }
                    }
                  }]
                }
              }
            },
            status_data: {
              readyReplicas: 3,
              replicas: 3,
              updatedReplicas: 3,
              availableReplicas: 3,
              observedGeneration: 5
            }
          },
          // Pods
          {
            type: 'Pod',
            name: `${entityName}-deployment-abc123`,
            namespace: 'default',
            cluster: 'development',
            status: 'healthy' as const,
            metadata: {
              creationTimestamp: new Date(Date.now() - 3600000).toISOString(),
              labels: {
                app: entityName,
                'pod-template-hash': 'abc123'
              },
              annotations: {
                'kubernetes.io/psp': 'eks.privileged'
              }
            },
            spec: {
              containers: [{
                name: entityName,
                image: `${entityName}:latest`,
                ports: [{ containerPort: 8080 }]
              }],
              restartPolicy: 'Always'
            },
            status_data: {
              phase: 'Running',
              conditions: [
                {
                  type: 'Ready',
                  status: 'True',
                  lastTransitionTime: new Date(Date.now() - 3500000).toISOString()
                }
              ],
              containerStatuses: [{
                name: entityName,
                ready: true,
                restartCount: 0,
                state: { running: { startedAt: new Date(Date.now() - 3500000).toISOString() }}
              }]
            }
          },
          {
            type: 'Pod',
            name: `${entityName}-deployment-def456`,
            namespace: 'default',
            cluster: 'development',
            status: 'healthy' as const,
            metadata: {
              creationTimestamp: new Date(Date.now() - 3500000).toISOString(),
              labels: {
                app: entityName,
                'pod-template-hash': 'def456'
              }
            },
            status_data: {
              phase: 'Running',
              conditions: [
                {
                  type: 'Ready',
                  status: 'True',
                  lastTransitionTime: new Date(Date.now() - 3400000).toISOString()
                }
              ],
              containerStatuses: [{
                name: entityName,
                ready: true,
                restartCount: 1,
                state: { running: { startedAt: new Date(Date.now() - 1800000).toISOString() }}
              }]
            }
          },
          // Service
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
              },
              annotations: {
                'service.beta.kubernetes.io/aws-load-balancer-type': 'nlb'
              }
            },
            spec: {
              type: 'ClusterIP',
              clusterIP: '10.100.200.123',
              ports: [
                { 
                  name: 'http',
                  port: 80, 
                  targetPort: 8080,
                  protocol: 'TCP' 
                }
              ],
              selector: { app: entityName }
            },
            status_data: {
              loadBalancer: {}
            }
          },
          // Ingress
          {
            type: 'Ingress',
            name: `${entityName}-ingress`,
            namespace: 'default',
            cluster: 'development',
            status: 'healthy' as const,
            metadata: {
              creationTimestamp: new Date(Date.now() - 86400000).toISOString(),
              labels: {
                app: entityName
              },
              annotations: {
                'kubernetes.io/ingress.class': 'nginx',
                'cert-manager.io/cluster-issuer': 'letsencrypt-prod'
              }
            },
            spec: {
              rules: [
                {
                  host: `${entityName}-dev.example.com`,
                  http: {
                    paths: [
                      {
                        path: '/',
                        pathType: 'Prefix',
                        backend: {
                          service: {
                            name: `${entityName}-service`,
                            port: { number: 80 }
                          }
                        }
                      }
                    ]
                  }
                }
              ],
              tls: [
                {
                  hosts: [`${entityName}-dev.example.com`],
                  secretName: `${entityName}-tls`
                }
              ]
            },
            status_data: {
              loadBalancer: {
                ingress: [
                  { ip: '203.0.113.42' }
                ]
              }
            }
          }
        ],
        errors: []
      }
    ];

    return NextResponse.json({
      items: mockWorkloads,
      entity: entityName,
      timestamp: new Date().toISOString(),
      fallback: true,
      warning: 'Using mock data - Backstage Kubernetes backend unavailable'
    });
  }
}

// Apply authentication middleware
export const POST = withAuth(getWorkloadsHandler);