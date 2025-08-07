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
 
 console.log(`Fetching relations for entity: ${entityRef}`);
 
 // Try to get from Backstage first
 try {
 const relations = await backstageClient.getEntityRelations(entityRef);
 return NextResponse.json({ items: relations });
 } catch (error: any) {
 console.log('Backstage unavailable, returning mock relations');
 }
 
 // Fallback to mock relations
 const mockRelations = [
 {
 type: 'ownedBy',
 targetRef: 'group:default/platform-team',
 target: {
 kind: 'Group',
 namespace: 'default',
 name: 'platform-team',
 },
 },
 {
 type: 'dependsOn',
 targetRef: 'component:default/user-service',
 target: {
 kind: 'Component',
 namespace: 'default',
 name: 'user-service',
 },
 },
 {
 type: 'dependsOn',
 targetRef: 'component:default/payment-service',
 target: {
 kind: 'Component',
 namespace: 'default',
 name: 'payment-service',
 },
 },
 {
 type: 'partOf',
 targetRef: 'system:default/auth-system',
 target: {
 kind: 'System',
 namespace: 'default',
 name: 'auth-system',
 },
 },
 ];
 
 return NextResponse.json({ items: mockRelations });
 } catch (error) {
 console.error('Failed to fetch entity relations:', error);
 return NextResponse.json(
 { error: 'Failed to fetch entity relations' },
 { status: 500 }
 );
 }
}