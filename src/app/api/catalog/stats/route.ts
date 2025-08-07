import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
 try {
 const backstageUrl = process.env.BACKSTAGE_API_URL || 'http://localhost:7007';
 
 // Fetch entities from Backstage catalog
 try {
 const response = await fetch(`${backstageUrl}/api/catalog/entities`, {
 headers: {
 'Accept': 'application/json',
 },
 });

 if (response.ok) {
 const data = await response.json();
 const entities = data.items || [];

 // Calculate statistics
 const stats = {
 total: entities.length,
 byKind: {},
 byLifecycle: {},
 healthScore: 0,
 complianceScore: 0,
 };

 // Count by kind
 entities.forEach((entity: any) => {
 const kind = entity.kind || 'Unknown';
 stats.byKind[kind] = (stats.byKind[kind] || 0) + 1;
 
 // Count by lifecycle
 const lifecycle = entity.spec?.lifecycle || 'unknown';
 stats.byLifecycle[lifecycle] = (stats.byLifecycle[lifecycle] || 0) + 1;
 });

 // Calculate health score based on metadata completeness
 let healthPoints = 0;
 let compliancePoints = 0;
 
 entities.forEach((entity: any) => {
 // Health checks
 if (entity.metadata?.description) healthPoints += 1;
 if (entity.metadata?.tags?.length > 0) healthPoints += 1;
 if (entity.spec?.owner) healthPoints += 1;
 if (entity.metadata?.links?.length > 0) healthPoints += 1;
 
 // Compliance checks
 if (entity.spec?.lifecycle !== 'deprecated') compliancePoints += 1;
 if (entity.metadata?.annotations?.['backstage.io/managed-by-location']) compliancePoints += 1;
 });

 stats.healthScore = Math.round((healthPoints / (entities.length * 4)) * 100) || 0;
 stats.complianceScore = Math.round((compliancePoints / (entities.length * 2)) * 100) || 0;

 return NextResponse.json(stats);
 }
 } catch (error) {
 console.log('Backstage not available, returning mock data');
 }

 // Return mock data if Backstage is not available
 return NextResponse.json({
 total: 142,
 byKind: {
 Component: 78,
 API: 23,
 System: 12,
 Domain: 8,
 Resource: 15,
 Group: 6,
 },
 byLifecycle: {
 production: 67,
 experimental: 45,
 deprecated: 12,
 development: 18,
 },
 healthScore: 87,
 complianceScore: 92,
 });
 } catch (error) {
 console.error('Catalog stats error:', error);
 return NextResponse.json(
 { error: 'Failed to fetch catalog statistics' },
 { status: 500 }
 );
 }
}