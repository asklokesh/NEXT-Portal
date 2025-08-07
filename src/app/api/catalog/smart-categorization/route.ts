import { NextRequest, NextResponse } from 'next/server';
import { getSmartCategorization } from '@/lib/ai/SmartCategorization';
import type { Entity } from '@/services/backstage/types/entities';

interface CategorizationRequest {
 entityIds: string[];
 entities: Entity[];
 autoApplyHighConfidence?: boolean;
}

interface ApplyChangesRequest {
 changes: Array<{
 entityId: string;
 entity: Entity;
 acceptedTags: string[];
 acceptedCategories: string[];
 }>;
}

export async function POST(request: NextRequest) {
 try {
 const url = new URL(request.url);
 const action = url.searchParams.get('action');

 if (action === 'analyze') {
 return await handleAnalyze(request);
 } else if (action === 'apply') {
 return await handleApplyChanges(request);
 } else {
 return NextResponse.json(
 { error: 'Invalid action. Use ?action=analyze or ?action=apply' },
 { status: 400 }
 );
 }
 } catch (error) {
 console.error('Smart categorization API error:', error);
 return NextResponse.json(
 { error: 'Internal server error' },
 { status: 500 }
 );
 }
}

async function handleAnalyze(request: NextRequest): Promise<NextResponse> {
 const body: CategorizationRequest = await request.json();
 const { entities, autoApplyHighConfidence = false } = body;

 if (!entities || !Array.isArray(entities)) {
 return NextResponse.json(
 { error: 'entities array is required' },
 { status: 400 }
 );
 }

 const smartCategorization = getSmartCategorization();
 const results = await smartCategorization.bulkAnalyze(entities);

 // Convert Map to object for JSON serialization
 const resultsObject: Record<string, any> = {};
 for (const [entityId, analysis] of results.entries()) {
 resultsObject[entityId] = {
 ...analysis,
 // Add suggestions for auto-application if enabled
 autoAppliedTags: autoApplyHighConfidence 
 ? analysis.tags.filter((t: any) => t.confidence > 0.8).map((t: any) => t.tag)
 : [],
 autoAppliedCategories: autoApplyHighConfidence
 ? analysis.categories.filter((c: any) => c.confidence > 0.8).map((c: any) => c.category)
 : [],
 };
 }

 // Get popular tags for additional context
 const popularTags = smartCategorization.getPopularTags(50);

 return NextResponse.json({
 results: resultsObject,
 popularTags,
 summary: {
 totalEntities: entities.length,
 totalTagSuggestions: Object.values(resultsObject).reduce(
 (acc: number, result: any) => acc + result.tags.length, 0
 ),
 totalCategorySuggestions: Object.values(resultsObject).reduce(
 (acc: number, result: any) => acc + result.categories.length, 0
 ),
 averageQualityScore: Object.values(resultsObject).reduce(
 (acc: number, result: any) => acc + (result.quality.completeness + result.quality.consistency) / 2, 0
 ) / entities.length,
 },
 });
}

async function handleApplyChanges(request: NextRequest): Promise<NextResponse> {
 const body: ApplyChangesRequest = await request.json();
 const { changes } = body;

 if (!changes || !Array.isArray(changes)) {
 return NextResponse.json(
 { error: 'changes array is required' },
 { status: 400 }
 );
 }

 const smartCategorization = getSmartCategorization();
 const results = [];

 for (const change of changes) {
 try {
 // In a real implementation, this would update the entity in Backstage
 // For now, we'll simulate the update process and learn from feedback
 
 const { entity, acceptedTags, acceptedCategories } = change;
 
 // Learn from user feedback
 const allSuggestions = await smartCategorization.analyzeEntity(entity);
 const rejectedTags = allSuggestions.tags
 .map(t => t.tag)
 .filter(tag => !acceptedTags.includes(tag));
 
 await smartCategorization.learnFromFeedback(
 entity,
 acceptedTags,
 rejectedTags,
 acceptedCategories
 );

 // Simulate entity update (in real implementation, would call Backstage API)
 const updatedEntity = {
 ...entity,
 metadata: {
 ...entity.metadata,
 tags: [
 ...(entity.metadata.tags || []),
 ...acceptedTags.filter(tag => !(entity.metadata.tags || []).includes(tag))
 ],
 annotations: {
 ...entity.metadata.annotations,
 'backstage.io/managed-by-location': 'ai-categorization',
 'ai-categorization/categories': acceptedCategories.join(','),
 'ai-categorization/applied-at': new Date().toISOString(),
 },
 },
 };

 results.push({
 entityId: change.entityId,
 success: true,
 updatedEntity,
 appliedTags: acceptedTags,
 appliedCategories: acceptedCategories,
 });

 console.log(`Applied AI categorization to ${entity.metadata.name}:`, {
 tags: acceptedTags,
 categories: acceptedCategories,
 });

 } catch (error) {
 console.error(`Failed to apply changes to entity ${change.entityId}:`, error);
 results.push({
 entityId: change.entityId,
 success: false,
 error: error instanceof Error ? error.message : 'Unknown error',
 });
 }
 }

 const successCount = results.filter(r => r.success).length;
 const failureCount = results.filter(r => !r.success).length;

 return NextResponse.json({
 results,
 summary: {
 total: changes.length,
 successful: successCount,
 failed: failureCount,
 successRate: (successCount / changes.length) * 100,
 },
 message: `Applied changes to ${successCount} entities${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
 });
}

export async function GET(request: NextRequest) {
 try {
 const url = new URL(request.url);
 const action = url.searchParams.get('action');

 if (action === 'popular-tags') {
 const smartCategorization = getSmartCategorization();
 const limit = parseInt(url.searchParams.get('limit') || '20');
 const popularTags = smartCategorization.getPopularTags(limit);

 return NextResponse.json({
 tags: popularTags,
 total: popularTags.length,
 });
 }

 // Default: return categorization statistics
 const smartCategorization = getSmartCategorization();
 const popularTags = smartCategorization.getPopularTags(10);

 return NextResponse.json({
 status: 'ready',
 availableRules: 6, // Number of category rules
 knownTags: popularTags.length,
 popularTags: popularTags.slice(0, 10),
 capabilities: [
 'Entity categorization',
 'Tag suggestions',
 'Quality assessment',
 'Learning from feedback',
 'Bulk analysis',
 'Pattern-based detection',
 ],
 });

 } catch (error) {
 console.error('Smart categorization GET error:', error);
 return NextResponse.json(
 { error: 'Internal server error' },
 { status: 500 }
 );
 }
}