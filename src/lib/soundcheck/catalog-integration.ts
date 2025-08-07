/**
 * Soundcheck Catalog Integration
 * Integrates Soundcheck quality assessments with the service catalog
 */

import { SoundcheckEntity, QualityAssessment, QualityCertification } from '@/types/soundcheck';
import { soundcheckEngine } from './soundcheck-engine';

export interface CatalogEntity {
 apiVersion: string;
 kind: string;
 metadata: {
 name: string;
 namespace?: string;
 title?: string;
 description?: string;
 labels?: Record<string, string>;
 annotations?: Record<string, string>;
 tags?: string[];
 links?: Array<{
 url: string;
 title: string;
 icon?: string;
 }>;
 };
 spec: {
 type?: string;
 lifecycle?: string;
 owner?: string;
 system?: string;
 subcomponentOf?: string;
 providesApis?: string[];
 consumesApis?: string[];
 dependsOn?: string[];
 };
 status?: {
 items?: Array<{
 type: string;
 level: string;
 message: string;
 error?: {
 name: string;
 message: string;
 };
 }>;
 };
 relations?: Array<{
 type: string;
 targetRef: string;
 }>;
}

export interface CatalogIntegrationResult {
 success: boolean;
 entitiesProcessed: number;
 assessmentsCreated: number;
 errors: Array<{
 entityId: string;
 error: string;
 }>;
}

export class SoundcheckCatalogIntegration {
 private catalogApiUrl: string;
 private backstageApiToken?: string;

 constructor(catalogApiUrl: string, apiToken?: string) {
 this.catalogApiUrl = catalogApiUrl;
 this.backstageApiToken = apiToken;
 }

 /**
 * Convert Backstage catalog entity to Soundcheck entity
 */
 private convertToSoundcheckEntity(catalogEntity: CatalogEntity): SoundcheckEntity {
 const { metadata, spec, relations } = catalogEntity;
 
 return {
 id: `${metadata.namespace || 'default'}/${catalogEntity.kind.toLowerCase()}/${metadata.name}`,
 name: metadata.name,
 kind: catalogEntity.kind as any,
 namespace: metadata.namespace || 'default',
 metadata: {
 title: metadata.title,
 description: metadata.description,
 tags: metadata.tags,
 owner: spec.owner,
 lifecycle: spec.lifecycle,
 system: spec.system
 },
 spec: {
 ...spec,
 // Add Soundcheck-specific fields from annotations
 authentication: metadata.annotations?.['soundcheck.io/authentication'],
 healthCheck: metadata.annotations?.['soundcheck.io/health-check'],
 documentation: {
 readme: metadata.annotations?.['backstage.io/readme-url'],
 api: metadata.annotations?.['backstage.io/api-docs-url'],
 runbook: metadata.annotations?.['soundcheck.io/runbook-url']
 },
 monitoring: {
 alerts: metadata.annotations?.['soundcheck.io/alerts-configured'] === 'true',
 dashboard: metadata.annotations?.['soundcheck.io/dashboard-url']
 },
 testing: {
 coverage: parseFloat(metadata.annotations?.['coverage-percentage'] || '0'),
 type: metadata.annotations?.['soundcheck.io/test-type']
 },
 performance: {
 sla: metadata.annotations?.['soundcheck.io/sla'],
 responseTime: parseFloat(metadata.annotations?.['soundcheck.io/response-time-p95'] || '0')
 }
 },
 relations: relations?.map(r => ({
 type: r.type as any,
 target: r.targetRef
 }))
 };
 }

 /**
 * Fetch entities from Backstage catalog
 */
 async fetchCatalogEntities(filters?: {
 kind?: string[];
 type?: string[];
 lifecycle?: string[];
 owner?: string[];
 }): Promise<CatalogEntity[]> {
 try {
 const queryParams = new URLSearchParams();
 
 if (filters?.kind) {
 filters.kind.forEach(k => queryParams.append('filter', `kind=${k}`));
 }
 if (filters?.type) {
 filters.type.forEach(t => queryParams.append('filter', `spec.type=${t}`));
 }
 if (filters?.lifecycle) {
 filters.lifecycle.forEach(l => queryParams.append('filter', `spec.lifecycle=${l}`));
 }
 if (filters?.owner) {
 filters.owner.forEach(o => queryParams.append('filter', `spec.owner=${o}`));
 }

 const headers: HeadersInit = {
 'Content-Type': 'application/json',
 };
 
 if (this.backstageApiToken) {
 headers['Authorization'] = `Bearer ${this.backstageApiToken}`;
 }

 const response = await fetch(
 `${this.catalogApiUrl}/entities?${queryParams.toString()}`,
 { headers }
 );

 if (!response.ok) {
 throw new Error(`Failed to fetch catalog entities: ${response.statusText}`);
 }

 const data = await response.json();
 return data.items || [];
 } catch (error) {
 console.error('Failed to fetch catalog entities:', error);
 return [];
 }
 }

 /**
 * Sync catalog entities with Soundcheck assessments
 */
 async syncCatalogWithSoundcheck(options?: {
 kinds?: string[];
 runAssessments?: boolean;
 updateAnnotations?: boolean;
 }): Promise<CatalogIntegrationResult> {
 const result: CatalogIntegrationResult = {
 success: true,
 entitiesProcessed: 0,
 assessmentsCreated: 0,
 errors: []
 };

 try {
 // Fetch relevant entities from catalog
 const entities = await this.fetchCatalogEntities({
 kind: options?.kinds || ['Component', 'API', 'System']
 });

 result.entitiesProcessed = entities.length;

 // Process each entity
 for (const catalogEntity of entities) {
 try {
 const soundcheckEntity = this.convertToSoundcheckEntity(catalogEntity);
 
 if (options?.runAssessments !== false) {
 // Run quality assessment
 const assessment = await soundcheckEngine.runAssessment(soundcheckEntity);
 result.assessmentsCreated++;

 if (options?.updateAnnotations) {
 // Update catalog entity with Soundcheck results
 await this.updateCatalogAnnotations(
 catalogEntity,
 assessment
 );
 }
 }
 } catch (error) {
 result.errors.push({
 entityId: `${catalogEntity.metadata.namespace}/${catalogEntity.kind}/${catalogEntity.metadata.name}`,
 error: error instanceof Error ? error.message : 'Unknown error'
 });
 }
 }

 result.success = result.errors.length === 0;
 } catch (error) {
 result.success = false;
 result.errors.push({
 entityId: 'catalog-sync',
 error: error instanceof Error ? error.message : 'Unknown error'
 });
 }

 return result;
 }

 /**
 * Update catalog entity with Soundcheck annotations
 */
 async updateCatalogAnnotations(
 entity: CatalogEntity,
 assessment: QualityAssessment
 ): Promise<void> {
 const annotations = {
 ...entity.metadata.annotations,
 'soundcheck.io/quality-score': assessment.overallScore.toString(),
 'soundcheck.io/last-assessed': assessment.timestamp,
 'soundcheck.io/assessment-id': assessment.id
 };

 // Add category scores
 for (const [category, score] of Object.entries(assessment.categoryScores)) {
 annotations[`soundcheck.io/score-${category}`] = score.toString();
 }

 // Add gate results
 const productionGate = assessment.gateResults.find(g => g.gateId === 'production-gate');
 if (productionGate) {
 annotations['soundcheck.io/production-ready'] = productionGate.status === 'pass' ? 'true' : 'false';
 }

 // Add top issues
 const criticalIssues = assessment.checkResults
 .filter(r => r.status === 'fail')
 .map(r => soundcheckEngine.getCheck(r.checkId))
 .filter(c => c?.severity === 'critical')
 .slice(0, 3);

 if (criticalIssues.length > 0) {
 annotations['soundcheck.io/critical-issues'] = criticalIssues
 .map(c => c?.name)
 .join(', ');
 }

 // Update entity in catalog
 await this.updateCatalogEntity(entity, { annotations });
 }

 /**
 * Update catalog entity
 */
 async updateCatalogEntity(
 entity: CatalogEntity,
 updates: {
 annotations?: Record<string, string>;
 labels?: Record<string, string>;
 }
 ): Promise<void> {
 const headers: HeadersInit = {
 'Content-Type': 'application/json',
 };
 
 if (this.backstageApiToken) {
 headers['Authorization'] = `Bearer ${this.backstageApiToken}`;
 }

 const updatedEntity = {
 ...entity,
 metadata: {
 ...entity.metadata,
 annotations: updates.annotations || entity.metadata.annotations,
 labels: updates.labels || entity.metadata.labels
 }
 };

 const response = await fetch(
 `${this.catalogApiUrl}/entities/${entity.metadata.namespace}/${entity.kind.toLowerCase()}/${entity.metadata.name}`,
 {
 method: 'PUT',
 headers,
 body: JSON.stringify(updatedEntity)
 }
 );

 if (!response.ok) {
 throw new Error(`Failed to update catalog entity: ${response.statusText}`);
 }
 }

 /**
 * Get quality assessment for a catalog entity
 */
 async getEntityAssessment(
 entityRef: string
 ): Promise<QualityAssessment | null> {
 const assessment = soundcheckEngine.getLatestAssessment(entityRef);
 
 if (!assessment) {
 // Try to fetch and assess the entity
 const [namespace, kind, name] = entityRef.split('/');
 const entities = await this.fetchCatalogEntities({
 kind: [kind]
 });
 
 const entity = entities.find(e => 
 e.metadata.name === name && 
 e.metadata.namespace === namespace
 );
 
 if (entity) {
 const soundcheckEntity = this.convertToSoundcheckEntity(entity);
 return await soundcheckEngine.runAssessment(soundcheckEntity);
 }
 }
 
 return assessment || null;
 }

 /**
 * Get entities by quality score range
 */
 async getEntitiesByQualityScore(
 minScore: number,
 maxScore: number = 100
 ): Promise<Array<{ entity: CatalogEntity; score: number }>> {
 const entities = await this.fetchCatalogEntities();
 const results: Array<{ entity: CatalogEntity; score: number }> = [];

 for (const entity of entities) {
 const scoreAnnotation = entity.metadata.annotations?.['soundcheck.io/quality-score'];
 if (scoreAnnotation) {
 const score = parseInt(scoreAnnotation);
 if (score >= minScore && score <= maxScore) {
 results.push({ entity, score });
 }
 }
 }

 return results.sort((a, b) => b.score - a.score);
 }

 /**
 * Get entities with critical issues
 */
 async getEntitiesWithCriticalIssues(): Promise<CatalogEntity[]> {
 const entities = await this.fetchCatalogEntities();
 
 return entities.filter(entity => 
 entity.metadata.annotations?.['soundcheck.io/critical-issues']
 );
 }

 /**
 * Get production-ready entities
 */
 async getProductionReadyEntities(): Promise<CatalogEntity[]> {
 const entities = await this.fetchCatalogEntities();
 
 return entities.filter(entity => 
 entity.metadata.annotations?.['soundcheck.io/production-ready'] === 'true'
 );
 }

 /**
 * Create quality report for a system
 */
 async createSystemQualityReport(
 systemName: string
 ): Promise<{
 system: string;
 components: Array<{
 name: string;
 score: number;
 status: string;
 issues: string[];
 }>;
 averageScore: number;
 productionReady: boolean;
 }> {
 // Fetch system and its components
 const systems = await this.fetchCatalogEntities({
 kind: ['System']
 });
 
 const system = systems.find(s => s.metadata.name === systemName);
 if (!system) {
 throw new Error(`System ${systemName} not found`);
 }

 // Fetch components of the system
 const components = await this.fetchCatalogEntities({
 kind: ['Component']
 });
 
 const systemComponents = components.filter(c => 
 c.spec.system === systemName
 );

 const componentResults = [];
 let totalScore = 0;
 let productionReadyCount = 0;

 for (const component of systemComponents) {
 const soundcheckEntity = this.convertToSoundcheckEntity(component);
 const assessment = await soundcheckEngine.runAssessment(soundcheckEntity);
 
 const issues = assessment.checkResults
 .filter(r => r.status === 'fail')
 .map(r => soundcheckEngine.getCheck(r.checkId)?.name || 'Unknown check')
 .slice(0, 5);

 const productionGate = assessment.gateResults.find(g => g.gateId === 'production-gate');
 const isProductionReady = productionGate?.status === 'pass';
 
 if (isProductionReady) {
 productionReadyCount++;
 }

 componentResults.push({
 name: component.metadata.name,
 score: assessment.overallScore,
 status: isProductionReady ? 'production-ready' : 'needs-improvement',
 issues
 });

 totalScore += assessment.overallScore;
 }

 return {
 system: systemName,
 components: componentResults,
 averageScore: Math.round(totalScore / systemComponents.length),
 productionReady: productionReadyCount === systemComponents.length
 };
 }

 /**
 * Schedule periodic assessments
 */
 startPeriodicAssessments(
 intervalMinutes: number = 60,
 options?: {
 kinds?: string[];
 updateAnnotations?: boolean;
 }
 ): { stop: () => void } {
 const intervalId = setInterval(async () => {
 console.log('Running periodic Soundcheck assessments...');
 
 try {
 const result = await this.syncCatalogWithSoundcheck({
 kinds: options?.kinds,
 runAssessments: true,
 updateAnnotations: options?.updateAnnotations
 });
 
 console.log(`Periodic assessment complete: ${result.assessmentsCreated} assessments created`);
 } catch (error) {
 console.error('Periodic assessment failed:', error);
 }
 }, intervalMinutes * 60 * 1000);

 // Run immediately
 this.syncCatalogWithSoundcheck({
 kinds: options?.kinds,
 runAssessments: true,
 updateAnnotations: options?.updateAnnotations
 });

 return {
 stop: () => clearInterval(intervalId)
 };
 }
}

// Export singleton instance
export const catalogIntegration = new SoundcheckCatalogIntegration(
 process.env.BACKSTAGE_API_URL || 'http://localhost:7007/api/catalog',
 process.env.BACKSTAGE_API_TOKEN
);