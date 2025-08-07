import { NextRequest, NextResponse } from 'next/server';
import { backstageClient } from '@/lib/backstage/real-client';

export async function GET(request: NextRequest) {
 try {
 const { searchParams } = new URL(request.url);
 const kind = searchParams.get('kind') || undefined;
 const namespace = searchParams.get('namespace') || undefined;
 const name = searchParams.get('name') || undefined;
 const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
 const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

 const entities = await backstageClient.getCatalogEntities({
 kind,
 namespace,
 name,
 limit,
 offset,
 });

 return NextResponse.json(entities);
 } catch (error) {
 console.error('Failed to fetch entities:', error);
 return NextResponse.json(
 { error: 'Failed to fetch entities' },
 { status: 500 }
 );
 }
}