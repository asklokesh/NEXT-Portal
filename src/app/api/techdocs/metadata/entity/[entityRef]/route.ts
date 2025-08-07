import { NextRequest, NextResponse } from 'next/server';
import { backstageClient } from '@/lib/backstage/real-client';

interface RouteParams {
 params: Promise<{
 entityRef: string;
 }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
 try {
 const { entityRef } = await params;
 const decodedRef = decodeURIComponent(entityRef);
 
 console.log(`Fetching tech docs metadata for: ${decodedRef}`);
 
 // Get from real Backstage TechDocs only
 try {
 const techdocs = await backstageClient.getTechDocs(decodedRef);
 if (techdocs) {
 return NextResponse.json(techdocs);
 }
 } catch (error: any) {
 if (error.response?.status === 404) {
 return NextResponse.json(
 { 
 error: 'TechDocs not found',
 entityRef: decodedRef,
 has_docs: false,
 message: 'No technical documentation has been published for this entity'
 },
 { status: 404 }
 );
 }
 console.error('Failed to fetch from Backstage TechDocs:', error.message);
 return NextResponse.json(
 { 
 error: 'TechDocs service unavailable',
 message: 'Please ensure Backstage TechDocs is configured and running',
 entityRef: decodedRef,
 has_docs: false
 },
 { status: 503 }
 );
 }
 
 // No documentation found
 return NextResponse.json(
 { 
 error: 'TechDocs not available',
 entityRef: decodedRef,
 has_docs: false
 },
 { status: 404 }
 );
 } catch (error) {
 console.error('Failed to fetch tech docs metadata:', error);
 return NextResponse.json(
 { error: 'Failed to fetch tech docs metadata' },
 { status: 500 }
 );
 }
}