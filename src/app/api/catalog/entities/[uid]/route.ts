import { NextRequest, NextResponse } from 'next/server';

// This would typically connect to the same data store as the main entities route
// For now, we'll use a simple in-memory approach that could be replaced with a database

interface CatalogEntity {
  apiVersion: string;
  kind: string;
  metadata: {
    uid?: string;
    name: string;
    namespace?: string;
    title?: string;
    description?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    tags?: string[];
  };
  spec: Record<string, any>;
  status?: Record<string, any>;
  relations?: Array<{
    type: string;
    targetRef: string;
  }>;
}

// Simulated entity store (in production, this would be a database)
const getEntityStore = () => {
  // This would be shared with the main entities route
  return new Map<string, CatalogEntity>();
};

export async function GET(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const uid = params.uid;
    
    // In production, fetch from database
    // For now, return a sample entity
    const sampleEntity: CatalogEntity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        uid,
        name: uid.split('/').pop() || 'unknown',
        namespace: 'default',
        title: 'Sample Component',
        description: 'This is a sample component',
        tags: ['sample'],
        annotations: {
          'backstage.io/managed-by-location': 'url:https://github.com/example/repo'
        }
      },
      spec: {
        type: 'service',
        lifecycle: 'production',
        owner: 'team-a'
      },
      relations: [
        {
          type: 'ownedBy',
          targetRef: 'group:default/team-a'
        }
      ]
    };
    
    return NextResponse.json(sampleEntity);
    
  } catch (error) {
    console.error('Catalog entity GET error:', error);
    return NextResponse.json({
      error: 'Failed to fetch entity',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const uid = params.uid;
    const body = await request.json();
    
    // Validate entity
    if (!body.apiVersion || !body.kind || !body.metadata?.name) {
      return NextResponse.json({
        error: 'Invalid entity format'
      }, { status: 400 });
    }
    
    // Update entity (in production, save to database)
    const updatedEntity = {
      ...body,
      metadata: {
        ...body.metadata,
        uid
      }
    };
    
    return NextResponse.json(updatedEntity);
    
  } catch (error) {
    console.error('Catalog entity PUT error:', error);
    return NextResponse.json({
      error: 'Failed to update entity',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const uid = params.uid;
    
    // Delete entity (in production, remove from database)
    
    return NextResponse.json({
      deleted: true,
      uid
    });
    
  } catch (error) {
    console.error('Catalog entity DELETE error:', error);
    return NextResponse.json({
      error: 'Failed to delete entity',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}