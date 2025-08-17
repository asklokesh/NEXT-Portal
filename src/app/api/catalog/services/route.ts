import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Fetch services from our database
    const services = await prisma.service.findMany({
      include: {
        owner: {
          select: {
            name: true,
            username: true,
          }
        },
        team: {
          select: {
            name: true,
            displayName: true,
          }
        },
        dependencies: {
          include: {
            dependsOn: {
              select: {
                name: true,
                displayName: true,
              }
            }
          }
        },
        healthChecks: {
          include: {
            results: {
              orderBy: {
                checkedAt: 'desc'
              },
              take: 1
            }
          }
        }
      },
      take: limit,
      skip: offset,
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform to Backstage entity format
    const entities = services.map(service => {
      const latestHealthCheck = service.healthChecks[0]?.results[0];
      
      return {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: service.name,
          title: service.displayName,
          description: service.description,
          namespace: service.namespace,
          tags: service.tags,
          labels: service.labels,
          annotations: {
            ...service.annotations,
            'backstage.io/managed-by-location': service.gitRepo,
            'backstage.io/edit-url': service.gitRepo ? `${service.gitRepo}/edit` : undefined,
          }
        },
        spec: {
          type: service.type.toLowerCase(),
          lifecycle: service.lifecycle.toLowerCase(),
          owner: service.team.name,
          system: service.system,
          domain: service.domain,
        },
        relations: service.dependencies.map(dep => ({
          type: 'dependsOn',
          targetRef: `component:default/${dep.dependsOn.name}`,
        })),
        status: {
          health: latestHealthCheck ? {
            status: latestHealthCheck.status.toLowerCase(),
            message: latestHealthCheck.message,
            lastChecked: latestHealthCheck.checkedAt,
            responseTime: latestHealthCheck.responseTime,
          } : {
            status: 'unknown',
            message: 'No health checks configured',
          }
        }
      };
    });

    const total = await prisma.service.count();

    return NextResponse.json({
      entities,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total
      }
    });
  } catch (error) {
    console.error('Failed to fetch services:', error);
    return NextResponse.json(
      { error: 'Failed to fetch services', details: error.message },
      { status: 500 }
    );
  }
}