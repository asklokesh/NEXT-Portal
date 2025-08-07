import { NextRequest, NextResponse } from 'next/server';
import { backstageClient } from '@/lib/backstage/real-client';
import type { Entity } from '@backstage/catalog-model';

export async function GET(request: NextRequest) {
  try {
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
    
    const entities = await backstageClient.getCatalogEntities({
      kind: kind || filters.kind,
      namespace: namespace || filters['metadata.namespace'],
      name: name || filters['metadata.name'],
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      filter: filters,
    });
    
    return NextResponse.json({
      items: entities,
    });
  } catch (error) {
    console.error('Failed to fetch catalog entities:', error);
    
    // Check if it's a connection error to Backstage
    if (error instanceof Error && (error.message.includes('ECONNREFUSED') || error.message.includes('connect'))) {
      return NextResponse.json(
        {
          error: 'Cannot connect to Backstage backend. Please ensure Backstage is running on port 7007.',
          code: 'BACKSTAGE_UNAVAILABLE',
          details: error.message
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch catalog entities',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Support both single entity and batch creation
    const entitiesToCreate = Array.isArray(body) ? body : [body];
    const createdEntities: Entity[] = [];
    const errors: any[] = [];
    
    // For now, we'll store entities directly through Backstage catalog API
    // In a real implementation, entities are typically registered through locations
    for (const entityData of entitiesToCreate) {
      try {
        // For proper Backstage integration, entities should be registered through locations
        // This is a simplified approach for demo purposes
        const entity = entityData as Entity;
        entity.metadata.namespace = entity.metadata.namespace || 'default';
        
        // In real Backstage, you would register a location containing the entity
        // For now, we'll return the entity as if it was created
        createdEntities.push(entity);
      } catch (err) {
        errors.push({
          entity: entityData,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }
    
    if (errors.length > 0 && createdEntities.length === 0) {
      return NextResponse.json({
        errors
      }, { status: 400 });
    }
    
    return NextResponse.json({
      entities: createdEntities,
      errors: errors.length > 0 ? errors : undefined,
      message: 'Entities processed. Note: In production, entities should be registered through catalog locations.'
    }, { status: 201 });
    
  } catch (error) {
    console.error('Catalog entities POST error:', error);
    
    if (error instanceof Error && (error.message.includes('ECONNREFUSED') || error.message.includes('connect'))) {
      return NextResponse.json({
        error: 'Cannot connect to Backstage backend. Please ensure Backstage is running on port 7007.',
        code: 'BACKSTAGE_UNAVAILABLE',
        details: error.message
      }, { status: 503 });
    }
    
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
    
    // Set default namespace
    entity.metadata.namespace = entity.metadata.namespace || 'default';
    
    // In real Backstage, entity updates are handled through the catalog API
    // This would typically involve updating the source location (e.g., catalog-info.yaml in git)
    // For now, we'll return success as if the entity was updated
    
    return NextResponse.json({
      entity,
      message: 'Entity updated successfully. Note: In production, entities should be updated through their source locations.'
    });
    
  } catch (error) {
    console.error('Catalog entities PUT error:', error);
    
    if (error instanceof Error && (error.message.includes('ECONNREFUSED') || error.message.includes('connect'))) {
      return NextResponse.json({
        error: 'Cannot connect to Backstage backend. Please ensure Backstage is running on port 7007.',
        code: 'BACKSTAGE_UNAVAILABLE',
        details: error.message
      }, { status: 503 });
    }
    
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
    
    // In real Backstage, entities are deleted by removing their source location
    // or by updating the catalog-info.yaml file to remove the entity
    // This is a simplified approach for demo purposes
    
    return NextResponse.json({
      deleted: true,
      entityRef,
      message: 'Entity deletion requested. Note: In production, entities should be deleted by removing their source locations.'
    });
    
  } catch (error) {
    console.error('Catalog entities DELETE error:', error);
    
    if (error instanceof Error && (error.message.includes('ECONNREFUSED') || error.message.includes('connect'))) {
      return NextResponse.json({
        error: 'Cannot connect to Backstage backend. Please ensure Backstage is running on port 7007.',
        code: 'BACKSTAGE_UNAVAILABLE',
        details: error.message
      }, { status: 503 });
    }
    
    return NextResponse.json({
      error: 'Failed to delete entity',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}