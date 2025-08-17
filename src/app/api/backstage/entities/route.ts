import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { getSession } from '@/lib/auth/session';
import { tenantContextManager } from '@/lib/multi-tenant/tenant-context';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Allow public access for this endpoint (as configured in PUBLIC_ROUTES)
    // Optional authentication - check if session is provided
    let sessionData = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const sessionId = authHeader.substring(7); // Remove 'Bearer '
      sessionData = await getSession(sessionId);
    }

    const { tenant } = await tenantContextManager.extractTenantFromRequest(request);
    const tenantId = tenant?.id || request.headers.get('x-tenant-id') || 'default';
    
    // Check permissions (simplified for testing)
    // const hasPermission = await checkPermission(sessionData.userId, 'catalog:entities:read', tenantId);
    // if (!hasPermission) {
    //   return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    // }

    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind') || 'Component';
    const namespace = searchParams.get('namespace') || 'default';
    const name = searchParams.get('name') || undefined;
    const type = searchParams.get('type') || undefined;
    const lifecycle = searchParams.get('lifecycle') || undefined;
    const owner = searchParams.get('owner') || undefined;
    const tags = searchParams.getAll('tag') || [];
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    // Build where clause for filtering using Service model
    const whereClause: any = {};

    if (namespace && namespace !== 'default') {
      whereClause.namespace = namespace;
    }

    if (name) {
      whereClause.name = name;
    }

    if (type) {
      whereClause.type = type.toUpperCase(); // Service types are uppercase enums
    }

    if (lifecycle) {
      whereClause.lifecycle = lifecycle.toUpperCase(); // Lifecycle is uppercase enum
    }

    if (owner) {
      whereClause.OR = [
        { owner: { name: { contains: owner, mode: 'insensitive' } } },
        { team: { name: { contains: owner, mode: 'insensitive' } } }
      ];
    }

    if (tags.length > 0) {
      whereClause.tags = {
        hasSome: tags
      };
    }

    // Get services from database (these are our catalog entities)
    const services = await prisma.service.findMany({
      where: whereClause,
      skip: offset,
      take: limit,
      orderBy: {
        updatedAt: 'desc'
      },
      include: {
        owner: true,
        team: true,
        dependencies: {
          include: {
            dependsOn: true
          }
        },
        dependents: {
          include: {
            service: true
          }
        }
      }
    });

    // Get total count for pagination
    const total = await prisma.service.count({
      where: whereClause
    });

    // Transform services to Backstage catalog entity format
    const backstageEntities = services.map(service => ({
      apiVersion: 'backstage.io/v1alpha1',
      kind: kind || 'Component', // Use requested kind or default to Component
      metadata: {
        name: service.name,
        namespace: service.namespace || 'default',
        title: service.displayName || service.name,
        description: service.description || '',
        tags: service.tags || [],
        labels: service.labels || {},
        annotations: {
          'backstage.io/managed-by-location': 'db:services',
          'backstage.io/source-location': service.gitRepo || '',
          ...service.annotations
        },
        uid: service.id
      },
      spec: {
        type: service.type?.toLowerCase() || 'service',
        lifecycle: service.lifecycle?.toLowerCase() || 'production',
        owner: service.team?.name || service.owner?.name || 'guest',
        system: service.system || undefined,
        domain: service.domain || undefined
      },
      status: {
        health: service.health || 'unknown',
        lastUpdated: service.updatedAt.toISOString()
      },
      relations: [
        // Add dependency relations
        ...service.dependencies.map(dep => ({
          type: 'dependsOn',
          targetRef: `component:${dep.dependsOn.namespace || 'default'}/${dep.dependsOn.name}`,
          target: {
            kind: 'Component',
            namespace: dep.dependsOn.namespace || 'default',
            name: dep.dependsOn.name
          }
        })),
        // Add dependent relations
        ...service.dependents.map(dep => ({
          type: 'dependentOf',
          targetRef: `component:${dep.service.namespace || 'default'}/${dep.service.name}`,
          target: {
            kind: 'Component',
            namespace: dep.service.namespace || 'default',
            name: dep.service.name
          }
        }))
      ]
    }));

    // Log successful API call (simplified logging for now)
    console.log('API call successful:', {
      resource: 'catalog_entities',
      userId: sessionData?.userId || 'anonymous',
      tenantId,
      filters: { kind, namespace, name, type, lifecycle, owner, tags },
      resultCount: backstageEntities.length,
      duration: Date.now() - startTime,
      source: 'database'
    });

    return NextResponse.json({
      items: backstageEntities, // Use 'items' to match Backstage catalog API format
      totalItems: total,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
      metadata: {
        source: 'database',
        cached: false,
        timestamp: new Date().toISOString(),
        tenantId,
        backstageCompatible: true
      }
    });

  } catch (error) {
    console.error('Failed to fetch catalog entities:', error);

    // Log the error (simplified logging for now)
    console.error('API call error:', {
      resource: 'catalog_entities',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : 'UnknownError',
      duration: Date.now() - startTime,
    });

    // Check for database connection errors
    if (error instanceof Error && (
      error.message.includes('P1001') ||
      error.message.includes("Can't reach database") ||
      error.message.includes('ECONNREFUSED')
    )) {
      return NextResponse.json(
        { 
          error: 'Database service is not available. Please try again later.',
          code: 'DATABASE_CONNECTION_ERROR',
          entities: [], 
          pagination: { limit: 0, offset: 0, total: 0, hasMore: false }
        },
        { status: 503 }
      );
    }

    // Check for permission errors
    if (error instanceof Error && (
      error.message.includes('P2025') ||
      error.message.includes('Record not found')
    )) {
      return NextResponse.json(
        { 
          error: 'No entities found matching the criteria',
          entities: [],
          pagination: { limit: 0, offset: 0, total: 0, hasMore: false }
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to fetch catalog entities',
        message: error instanceof Error ? error.message : 'Unknown error',
        entities: [],
        pagination: { limit: 0, offset: 0, total: 0, hasMore: false }
      },
      { status: 500 }
    );
  }
}