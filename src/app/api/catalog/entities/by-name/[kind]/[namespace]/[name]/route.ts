import { NextRequest, NextResponse } from 'next/server';
import { backstageClient } from '@/lib/backstage/real-client';

interface RouteParams {
 params: Promise<{
 kind: string;
 namespace: string;
 name: string;
 }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
 try {
 const { kind, namespace, name } = await params;
 const entityRef = `${kind}:${namespace}/${name}`;
 
 console.log(`Fetching entity: ${entityRef}`);
 
 // Get from real Backstage API only
 try {
 const entity = await backstageClient.getEntityByRef(entityRef);
 if (entity) {
 return NextResponse.json(entity);
 }
 } catch (error: any) {
 if (error.response?.status === 404) {
 return NextResponse.json(
 { error: 'Entity not found', entityRef },
 { status: 404 }
 );
 }
 console.error('Failed to fetch from Backstage:', error.message);
 return NextResponse.json(
 { error: 'Backstage API unavailable', message: 'Please ensure Backstage backend is running' },
 { status: 503 }
 );
 }
 
 // No entity found in Backstage
 return NextResponse.json(
 { error: 'Entity not found', entityRef },
 { status: 404 }
 );
 } catch (error) {
 console.error('Failed to fetch entity:', error);
 return NextResponse.json(
 { error: 'Failed to fetch entity' },
 { status: 500 }
 );
 }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { kind, namespace, name } = await params;
    const entityRef = `${kind}:${namespace}/${name}`;
    const body = await request.json();
    
    console.log(`Updating entity: ${entityRef}`);
    
    // In real Backstage, entity updates are typically done through the source location
    // This would involve updating the catalog-info.yaml file in the repository
    
    return NextResponse.json({
      entity: body.entity || body,
      entityRef,
      message: 'Entity would be updated through its source location (catalog-info.yaml)'
    });
    
  } catch (error) {
    console.error('Failed to update entity:', error);
    
    if (error instanceof Error && (error.message.includes('ECONNREFUSED') || error.message.includes('connect'))) {
      return NextResponse.json(
        {
          error: 'Cannot connect to Backstage backend. Please ensure Backstage is running on port 7007.',
          code: 'BACKSTAGE_UNAVAILABLE'
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update entity' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { kind, namespace, name } = await params;
    const entityRef = `${kind}:${namespace}/${name}`;
    
    console.log(`Deleting entity: ${entityRef}`);
    
    // In real Backstage, entities are deleted by removing their source location
    // or by updating the catalog-info.yaml file to remove the entity
    
    return NextResponse.json({
      deleted: true,
      entityRef,
      message: 'Entity would be deleted by removing its source location'
    });
    
  } catch (error) {
    console.error('Failed to delete entity:', error);
    
    if (error instanceof Error && (error.message.includes('ECONNREFUSED') || error.message.includes('connect'))) {
      return NextResponse.json(
        {
          error: 'Cannot connect to Backstage backend. Please ensure Backstage is running on port 7007.',
          code: 'BACKSTAGE_UNAVAILABLE'
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete entity' },
      { status: 500 }
    );
  }
}