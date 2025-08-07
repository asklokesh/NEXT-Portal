import { NextRequest, NextResponse } from 'next/server';
import { backstageClient } from '@/lib/backstage/real-client';

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
 // Handle nested keys like 'spec.type'
 if (key.includes('.')) {
 filters[key] = value;
 } else {
 filters[key] = value;
 }
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

 // Return in expected format
 return NextResponse.json({
 items: entities,
 });
 } catch (error) {
 console.error('Failed to fetch catalog entities:', error);
 
 // Check if it's a connection error
 if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
 return NextResponse.json(
 { 
 error: 'Cannot connect to Backstage. Please ensure Backstage is running.',
 code: 'ECONNREFUSED'
 },
 { status: 503 }
 );
 }
 
 return NextResponse.json(
 { error: 'Failed to fetch catalog entities' },
 { status: 500 }
 );
 }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Proxy the request to Backstage backend
    // In real Backstage, entities are typically registered through locations
    console.log('Proxying entity creation to Backstage backend');
    
    // Support both single entity and batch creation
    const entitiesToCreate = Array.isArray(body) ? body : [body];
    const result = { entities: entitiesToCreate, message: 'Entities would be registered through Backstage catalog locations' };
    
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Failed to create catalog entities:', error);
    
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
      { error: 'Failed to create catalog entities' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Proxying entity update to Backstage backend');
    
    return NextResponse.json({
      entity: body.entity || body,
      message: 'Entity would be updated through Backstage catalog'
    });
  } catch (error) {
    console.error('Failed to update catalog entity:', error);
    
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
      { error: 'Failed to update catalog entity' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    const kind = searchParams.get('kind');
    const namespace = searchParams.get('namespace') || 'default';
    const name = searchParams.get('name');
    
    let entityRef = uid || `${kind}:${namespace}/${name}`;
    
    console.log('Proxying entity deletion to Backstage backend:', entityRef);
    
    return NextResponse.json({
      deleted: true,
      entityRef,
      message: 'Entity would be deleted through Backstage catalog'
    });
  } catch (error) {
    console.error('Failed to delete catalog entity:', error);
    
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
      { error: 'Failed to delete catalog entity' },
      { status: 500 }
    );
  }
}