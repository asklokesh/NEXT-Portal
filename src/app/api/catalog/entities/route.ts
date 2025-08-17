/**
 * Catalog Entities API Route
 * Fixed version with proper fallback mechanisms and error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { productionBackstageClient } from '@/lib/backstage/production-client';
import { prisma } from '@/lib/db/client';
import type { Entity } from '@backstage/catalog-model';

// Production fallback service data from database only
const getFallbackServices = async (): Promise<Entity[]> => {
  try {
    console.log('[Production Fallback] Fetching entities from database...');

    // Then try to get services from database
    const services = await prisma.service.findMany({
      include: {
        owner: true,
        team: true,
      },
      take: 50, // Limit for performance
    });

    if (services.length > 0) {
      return services.map(service => ({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: service.name,
          title: service.displayName || service.name,
          description: service.description || '',
          namespace: service.namespace || 'default',
          tags: service.tags || [],
          labels: service.labels || {},
          annotations: {
            'backstage.io/managed-by-location': 'db:services',
            'backstage.io/source-location': service.gitRepo || '',
          },
        },
        spec: {
          type: service.type?.toLowerCase() || 'service',
          lifecycle: service.lifecycle?.toLowerCase() || 'production',
          owner: service.team?.name || service.owner?.name || 'guest',
          system: service.system || undefined,
          domain: service.domain || undefined,
        },
        relations: [],
      }));
    }

    // Production mode: return empty array if no services in database
    console.log('[Production] No services found in database, returning empty catalog');
    return [];
  } catch (dbError) {
    console.error('Database fallback failed:', dbError);
    
    // Last resort: return empty array with proper structure
    return [];
  }
};

export async function GET(request: NextRequest) {
  try {
    console.log('[Catalog API] Fetching catalog entities...');
    
    const { searchParams } = new URL(request.url);
    
    // Build filters from query parameters
    const filters: Record<string, any> = {};
    
    // Handle filter parameters (e.g., filter=kind=Component)
    const filterParams = searchParams.getAll('filter');
    filterParams.forEach(filter => {
      const [key, value] = filter.split('=');
      if (key && value) {
        filters[key] = value;
      }
    });
    
    // Add standard query parameters
    const kind = searchParams.get('kind');
    const namespace = searchParams.get('namespace');
    const name = searchParams.get('name');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    
    let entities: Entity[] = [];
    let usedFallback = false;
    let backstageStatus = 'unknown';
    
    try {
      // Check Backstage health first
      const healthStatus = productionBackstageClient.getHealthStatus();
      backstageStatus = healthStatus?.status || 'unknown';
      
      console.log(`[Catalog API] Backstage health status: ${backstageStatus}`);
      
      if (backstageStatus === 'healthy') {
        // Try to get entities from Backstage
        entities = await productionBackstageClient.getCatalogEntities({
          kind: kind || filters.kind,
          namespace: namespace || filters['metadata.namespace'],
          name: name || filters['metadata.name'],
          limit: limit ? parseInt(limit) : undefined,
          offset: offset ? parseInt(offset) : undefined,
          filter: filters,
        });
        
        console.log(`[Catalog API] Retrieved ${entities.length} entities from Backstage`);
      } else {
        throw new Error('Backstage is not healthy');
      }
    } catch (backstageError) {
      console.warn('[Catalog API] Backstage unavailable, using fallback:', backstageError.message);
      
      // Use fallback data
      entities = await getFallbackServices();
      usedFallback = true;
      
      // Apply filters to fallback data
      if (kind) {
        entities = entities.filter(e => e.kind === kind);
      }
      if (namespace) {
        entities = entities.filter(e => e.metadata.namespace === namespace);
      }
      if (name) {
        entities = entities.filter(e => e.metadata.name === name);
      }
      
      // Apply limit and offset
      if (offset) {
        entities = entities.slice(parseInt(offset));
      }
      if (limit) {
        entities = entities.slice(0, parseInt(limit));
      }
      
      console.log(`[Catalog API] Using fallback data: ${entities.length} entities`);
    }
    
    const response = {
      items: entities,
      totalItems: entities.length,
      ...(usedFallback && {
        metadata: {
          source: 'fallback',
          backstageStatus,
          message: 'Data retrieved from fallback source. Backstage may be unavailable.',
        },
      }),
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[Catalog API] Critical error fetching catalog entities:', error);
    
    // Return error with fallback data
    try {
      const fallbackEntities = await getFallbackServices();
      
      return NextResponse.json({
        items: fallbackEntities,
        totalItems: fallbackEntities.length,
        error: {
          message: 'Error fetching catalog data, using fallback',
          details: error instanceof Error ? error.message : 'Unknown error',
          source: 'fallback',
        },
      }, { status: 206 }); // 206 Partial Content
      
    } catch (fallbackError) {
      console.error('[Catalog API] Fallback also failed:', fallbackError);
      
      return NextResponse.json({
        items: [],
        totalItems: 0,
        error: {
          message: 'Failed to load services',
          details: error instanceof Error ? error.message : 'Unknown error',
          fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Fallback failed',
          suggestions: [
            'Check if Backstage is running on port 7007',
            'Verify database connectivity',
            'Check application logs for more details',
          ],
        },
      }, { status: 500 });
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Support both single entity and batch creation
    const entitiesToCreate = Array.isArray(body) ? body : [body];
    const createdEntities: Entity[] = [];
    const errors: any[] = [];
    
    for (const entityData of entitiesToCreate) {
      try {
        const entity = entityData as Entity;
        entity.metadata.namespace = entity.metadata.namespace || 'default';
        
        // Store in database for future fallback
        if (entity.kind === 'Component' && entity.spec?.type) {
          await prisma.service.upsert({
            where: { name: entity.metadata.name },
            update: {
              displayName: entity.metadata.title || entity.metadata.name,
              description: entity.metadata.description || '',
              namespace: entity.metadata.namespace,
              tags: entity.metadata.tags || [],
              labels: entity.metadata.labels,
              annotations: entity.metadata.annotations,
            },
            create: {
              name: entity.metadata.name,
              displayName: entity.metadata.title || entity.metadata.name,
              description: entity.metadata.description || '',
              type: (entity.spec.type as string).toUpperCase() as any,
              lifecycle: ((entity.spec.lifecycle as string) || 'experimental').toUpperCase() as any,
              namespace: entity.metadata.namespace,
              tags: entity.metadata.tags || [],
              labels: entity.metadata.labels,
              annotations: entity.metadata.annotations,
              ownerId: await getDefaultUserId(),
              teamId: await getDefaultTeamId(),
            },
          });
        }
        
        createdEntities.push(entity);
      } catch (err) {
        errors.push({
          entity: entityData,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }
    
    if (errors.length > 0 && createdEntities.length === 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }
    
    return NextResponse.json({
      entities: createdEntities,
      errors: errors.length > 0 ? errors : undefined,
      message: 'Entities processed successfully'
    }, { status: 201 });
    
  } catch (error) {
    console.error('[Catalog API] POST error:', error);
    
    return NextResponse.json({
      error: 'Failed to create entities',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { entity } = body;
    
    if (!entity) {
      return NextResponse.json({
        error: 'Entity is required'
      }, { status: 400 });
    }
    
    entity.metadata.namespace = entity.metadata.namespace || 'default';
    
    // Update in database
    if (entity.kind === 'Component') {
      await prisma.service.upsert({
        where: { name: entity.metadata.name },
        update: {
          displayName: entity.metadata.title || entity.metadata.name,
          description: entity.metadata.description || '',
          namespace: entity.metadata.namespace,
          tags: entity.metadata.tags || [],
          labels: entity.metadata.labels,
          annotations: entity.metadata.annotations,
        },
        create: {
          name: entity.metadata.name,
          displayName: entity.metadata.title || entity.metadata.name,
          description: entity.metadata.description || '',
          type: ((entity.spec?.type as string) || 'service').toUpperCase() as any,
          lifecycle: ((entity.spec?.lifecycle as string) || 'experimental').toUpperCase() as any,
          namespace: entity.metadata.namespace,
          tags: entity.metadata.tags || [],
          labels: entity.metadata.labels,
          annotations: entity.metadata.annotations,
          ownerId: await getDefaultUserId(),
          teamId: await getDefaultTeamId(),
        },
      });
    }
    
    return NextResponse.json({
      entity,
      message: 'Entity updated successfully'
    });
    
  } catch (error) {
    console.error('[Catalog API] PUT error:', error);
    
    return NextResponse.json({
      error: 'Failed to update entity',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    const kind = searchParams.get('kind');
    const namespace = searchParams.get('namespace') || 'default';
    const name = searchParams.get('name');
    
    let entityRef = uid;
    
    if (!entityRef && kind && name) {
      entityRef = `${kind}:${namespace}/${name}`;
    }
    
    if (!entityRef) {
      return NextResponse.json({
        error: 'Entity identifier required (uid or kind+name)'
      }, { status: 400 });
    }
    
    // Delete from database if it's a component
    if (kind === 'Component' && name) {
      await prisma.service.deleteMany({
        where: {
          name: name,
          namespace: namespace,
        },
      });
    }
    
    return NextResponse.json({
      deleted: true,
      entityRef,
      message: 'Entity deleted successfully'
    });
    
  } catch (error) {
    console.error('[Catalog API] DELETE error:', error);
    
    return NextResponse.json({
      error: 'Failed to delete entity',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper functions
async function getDefaultUserId(): Promise<string> {
  try {
    let user = await prisma.user.findFirst();
    if (!user) {
      // Create a default user if none exists
      user = await prisma.user.create({
        data: {
          name: 'System User',
          email: 'system@example.com',
          role: 'ADMIN',
        },
      });
    }
    return user.id;
  } catch (error) {
    console.error('Error getting default user:', error);
    return '';
  }
}

async function getDefaultTeamId(): Promise<string> {
  try {
    let team = await prisma.team.findFirst();
    if (!team) {
      // Create a default team if none exists
      team = await prisma.team.create({
        data: {
          name: 'Platform Team',
          description: 'Default platform team',
          ownerId: await getDefaultUserId(),
        },
      });
    }
    return team.id;
  } catch (error) {
    console.error('Error getting default team:', error);
    return '';
  }
}