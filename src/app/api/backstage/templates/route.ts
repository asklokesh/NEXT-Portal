import { NextRequest, NextResponse } from 'next/server';
import { backstageClient } from '../../../../lib/backstage/real-client';

export async function GET(request: NextRequest) {
 try {
 const { searchParams } = new URL(request.url);
 const namespace = searchParams.get('namespace') || undefined;
 const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
 const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

 const templates = await backstageClient.getTemplates({
 namespace,
 limit,
 offset,
 });

 return NextResponse.json(templates);
 } catch (error) {
 console.error('Failed to fetch templates:', error);
 return NextResponse.json(
 { error: 'Failed to fetch templates' },
 { status: 500 }
 );
 }
}