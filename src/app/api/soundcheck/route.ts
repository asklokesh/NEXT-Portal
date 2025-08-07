/**
 * Soundcheck Quality Assurance API
 * API endpoints for managing quality checks, gates, and assessments
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
 try {
 const searchParams = new URL(req.url).searchParams;
 const action = searchParams.get('action');
 const entityId = searchParams.get('entityId');

 // Dynamic import to avoid SSR issues
 const { soundcheckEngine } = await import('@/lib/soundcheck/soundcheck-engine');

 switch (action) {
 case 'assessment':
 if (!entityId) {
 return NextResponse.json(
 { error: 'Entity ID is required for assessment' },
 { status: 400 }
 );
 }
 
 const assessment = soundcheckEngine.getLatestAssessment(entityId);
 if (!assessment) {
 return NextResponse.json(
 { error: 'No assessment found for entity' },
 { status: 404 }
 );
 }

 return NextResponse.json({ assessment });

 case 'assessment-history':
 if (!entityId) {
 return NextResponse.json(
 { error: 'Entity ID is required for assessment history' },
 { status: 400 }
 );
 }
 
 const history = soundcheckEngine.getAssessmentHistory(entityId);
 return NextResponse.json({ history });

 case 'checks':
 const checks = soundcheckEngine.getAllChecks();
 return NextResponse.json({ checks });

 case 'check':
 const checkId = searchParams.get('checkId');
 if (!checkId) {
 return NextResponse.json(
 { error: 'Check ID is required' },
 { status: 400 }
 );
 }
 
 const check = soundcheckEngine.getCheck(checkId);
 if (!check) {
 return NextResponse.json(
 { error: 'Check not found' },
 { status: 404 }
 );
 }

 return NextResponse.json({ check });

 case 'gates':
 const gates = soundcheckEngine.getAllGates();
 return NextResponse.json({ gates });

 case 'gate':
 const gateId = searchParams.get('gateId');
 if (!gateId) {
 return NextResponse.json(
 { error: 'Gate ID is required' },
 { status: 400 }
 );
 }
 
 const gate = soundcheckEngine.getGate(gateId);
 if (!gate) {
 return NextResponse.json(
 { error: 'Gate not found' },
 { status: 404 }
 );
 }

 return NextResponse.json({ gate });

 case 'dashboard':
 // Get overview dashboard data
 const allEntities = await getEntitiesFromCatalog();
 const dashboardData = await generateDashboardData(allEntities);
 return NextResponse.json({ dashboard: dashboardData });

 case 'reports':
 const reportType = searchParams.get('type') || 'summary';
 const timeRange = searchParams.get('timeRange') || '7d';
 const report = await generateReport(reportType, timeRange);
 return NextResponse.json({ report });

 default:
 return NextResponse.json(
 { error: 'Invalid action parameter' },
 { status: 400 }
 );
 }
 } catch (error) {
 console.error('Soundcheck API error:', error);
 return NextResponse.json(
 { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
 { status: 500 }
 );
 }
}

export async function POST(req: NextRequest) {
 try {
 const body = await req.json();
 const { action } = body;

 // Dynamic import to avoid SSR issues
 const { soundcheckEngine } = await import('@/lib/soundcheck/soundcheck-engine');

 switch (action) {
 case 'run-assessment':
 const { entity } = body;
 if (!entity) {
 return NextResponse.json(
 { error: 'Entity data is required for assessment' },
 { status: 400 }
 );
 }

 const assessment = await soundcheckEngine.runAssessment(entity);
 return NextResponse.json({ 
 success: true, 
 assessment 
 });

 case 'create-check':
 const { check } = body;
 if (!check) {
 return NextResponse.json(
 { error: 'Check data is required' },
 { status: 400 }
 );
 }

 // Validate check data
 const validationResult = validateCheckData(check);
 if (!validationResult.valid) {
 return NextResponse.json(
 { error: 'Invalid check data', details: validationResult.errors },
 { status: 400 }
 );
 }

 soundcheckEngine.addCheck(check);
 return NextResponse.json({ 
 success: true, 
 message: 'Quality check created successfully',
 checkId: check.id 
 });

 case 'update-check':
 const { checkId, updates } = body;
 if (!checkId || !updates) {
 return NextResponse.json(
 { error: 'Check ID and updates are required' },
 { status: 400 }
 );
 }

 const existingCheck = soundcheckEngine.getCheck(checkId);
 if (!existingCheck) {
 return NextResponse.json(
 { error: 'Check not found' },
 { status: 404 }
 );
 }

 const updatedCheck = { ...existingCheck, ...updates, updatedAt: new Date().toISOString() };
 soundcheckEngine.addCheck(updatedCheck);
 return NextResponse.json({ 
 success: true, 
 message: 'Quality check updated successfully' 
 });

 case 'delete-check':
 const { checkId: deleteCheckId } = body;
 if (!deleteCheckId) {
 return NextResponse.json(
 { error: 'Check ID is required' },
 { status: 400 }
 );
 }

 const deleted = soundcheckEngine.removeCheck(deleteCheckId);
 if (!deleted) {
 return NextResponse.json(
 { error: 'Check not found' },
 { status: 404 }
 );
 }

 return NextResponse.json({ 
 success: true, 
 message: 'Quality check deleted successfully' 
 });

 case 'create-gate':
 const { gate } = body;
 if (!gate) {
 return NextResponse.json(
 { error: 'Gate data is required' },
 { status: 400 }
 );
 }

 soundcheckEngine.addGate(gate);
 return NextResponse.json({ 
 success: true, 
 message: 'Quality gate created successfully',
 gateId: gate.id 
 });

 case 'update-gate':
 const { gateId, gateUpdates } = body;
 if (!gateId || !gateUpdates) {
 return NextResponse.json(
 { error: 'Gate ID and updates are required' },
 { status: 400 }
 );
 }

 const existingGate = soundcheckEngine.getGate(gateId);
 if (!existingGate) {
 return NextResponse.json(
 { error: 'Gate not found' },
 { status: 404 }
 );
 }

 const updatedGate = { ...existingGate, ...gateUpdates, updatedAt: new Date().toISOString() };
 soundcheckEngine.addGate(updatedGate);
 return NextResponse.json({ 
 success: true, 
 message: 'Quality gate updated successfully' 
 });

 case 'delete-gate':
 const { gateId: deleteGateId } = body;
 if (!deleteGateId) {
 return NextResponse.json(
 { error: 'Gate ID is required' },
 { status: 400 }
 );
 }

 const gateDeleted = soundcheckEngine.removeGate(deleteGateId);
 if (!gateDeleted) {
 return NextResponse.json(
 { error: 'Gate not found' },
 { status: 404 }
 );
 }

 return NextResponse.json({ 
 success: true, 
 message: 'Quality gate deleted successfully' 
 });

 case 'bulk-assessment':
 const { entityIds } = body;
 if (!entityIds || !Array.isArray(entityIds)) {
 return NextResponse.json(
 { error: 'Entity IDs array is required' },
 { status: 400 }
 );
 }

 const entities = await getEntitiesByIds(entityIds);
 const assessments = [];

 for (const entity of entities) {
 try {
 const assessment = await soundcheckEngine.runAssessment(entity);
 assessments.push(assessment);
 } catch (error) {
 console.error(`Failed to assess entity ${entity.id}:`, error);
 }
 }

 return NextResponse.json({ 
 success: true, 
 assessments,
 total: assessments.length
 });

 default:
 return NextResponse.json(
 { error: 'Invalid action parameter' },
 { status: 400 }
 );
 }
 } catch (error) {
 console.error('Soundcheck API error:', error);
 return NextResponse.json(
 { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
 { status: 500 }
 );
 }
}

/**
 * Helper methods (these would typically be in a separate service file)
 */

async function getEntitiesFromCatalog() {
 try {
 // Integrate with real Backstage catalog API
 const backstageUrl = process.env.BACKSTAGE_API_URL || 'http://localhost:7007';
 const catalogResponse = await fetch(`${backstageUrl}/api/catalog/entities`, {
 headers: {
 'Accept': 'application/json',
 'Authorization': process.env.BACKSTAGE_API_TOKEN ? `Bearer ${process.env.BACKSTAGE_API_TOKEN}` : '',
 },
 });

 if (!catalogResponse.ok) {
 console.warn('Failed to fetch from Backstage catalog, status:', catalogResponse.status);
 return [];
 }

 const catalogData = await catalogResponse.json();
 const entities = catalogData.items || [];
 
 // Transform Backstage entities to Soundcheck format
 return entities.map((entity: any) => ({
 id: entity.metadata?.uid || `${entity.kind}-${entity.metadata?.name}`,
 name: entity.metadata?.name,
 kind: entity.kind,
 namespace: entity.metadata?.namespace || 'default',
 metadata: {
 title: entity.metadata?.title || entity.metadata?.name,
 description: entity.metadata?.description || '',
 tags: entity.metadata?.tags || [],
 owner: entity.spec?.owner || 'unknown',
 ...entity.metadata
 },
 spec: entity.spec || {}
 }));
 } catch (error) {
 console.error('Failed to fetch entities from catalog:', error);
 return [];
 }
}

async function getEntitiesByIds(entityIds: string[]) {
 const allEntities = await getEntitiesFromCatalog();
 return allEntities.filter(entity => entityIds.includes(entity.id));
}

async function generateDashboardData(entities: any[]) {
 const { soundcheckEngine } = await import('@/lib/soundcheck/soundcheck-engine');
 
 const totalEntities = entities.length;
 let totalScore = 0;
 let assessedEntities = 0;
 
 const categoryStats: Record<string, { total: number; count: number }> = {};
 const recentAssessments = [];

 for (const entity of entities) {
 const assessment = soundcheckEngine.getLatestAssessment(entity.id);
 if (assessment) {
 totalScore += assessment.overallScore;
 assessedEntities++;
 recentAssessments.push({
 entityId: entity.id,
 entityName: entity.name,
 score: assessment.overallScore,
 timestamp: assessment.timestamp
 });

 // Aggregate category stats
 for (const [category, score] of Object.entries(assessment.categoryScores)) {
 if (!categoryStats[category]) {
 categoryStats[category] = { total: 0, count: 0 };
 }
 categoryStats[category].total += score;
 categoryStats[category].count++;
 }
 }
 }

 const averageScore = assessedEntities > 0 ? Math.round(totalScore / assessedEntities) : 0;
 
 const categoryAverages: Record<string, number> = {};
 for (const [category, stats] of Object.entries(categoryStats)) {
 categoryAverages[category] = stats.count > 0 ? Math.round(stats.total / stats.count) : 0;
 }

 return {
 summary: {
 totalEntities,
 assessedEntities,
 averageScore,
 coveragePercentage: totalEntities > 0 ? Math.round((assessedEntities / totalEntities) * 100) : 0
 },
 categoryAverages,
 recentAssessments: recentAssessments
 .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
 .slice(0, 10),
 trends: {
 // This would calculate trends over time
 scoreChange: 0, // Placeholder
 assessmentCount: assessedEntities
 }
 };
}

async function generateReport(type: string, timeRange: string) {
 // This would generate comprehensive reports
 // For now, return a placeholder
 return {
 id: `report-${Date.now()}`,
 type,
 timeRange,
 generatedAt: new Date().toISOString(),
 data: {
 summary: {
 totalEntities: 0,
 averageScore: 0,
 passRate: 0,
 trends: {}
 }
 }
 };
}

function validateCheckData(check: any): { valid: boolean; errors: string[] } {
 const errors: string[] = [];

 if (!check.id) errors.push('Check ID is required');
 if (!check.name) errors.push('Check name is required');
 if (!check.description) errors.push('Check description is required');
 if (!check.category) errors.push('Check category is required');
 if (!check.severity) errors.push('Check severity is required');
 if (!check.rule) errors.push('Check rule is required');

 if (check.rule && !['boolean', 'threshold', 'presence', 'pattern', 'custom'].includes(check.rule.type)) {
 errors.push('Invalid rule type');
 }

 return {
 valid: errors.length === 0,
 errors
 };
}