/**
 * AI-Powered Smart Categorization and Tagging System
 * Automatically categorizes entities and suggests relevant tags based on content analysis
 */

import type { Entity } from '@/services/backstage/types/entities';

interface CategoryRule {
 id: string;
 name: string;
 description: string;
 weight: number;
 patterns: Array<{
 field: keyof Entity | string;
 pattern: RegExp | string;
 weight: number;
 }>;
 tags: string[];
}

interface TagSuggestion {
 tag: string;
 confidence: number;
 reason: string;
 category?: string;
}

interface CategorySuggestion {
 category: string;
 confidence: number;
 reasons: string[];
 suggestedTags: string[];
}

interface AnalysisResult {
 categories: CategorySuggestion[];
 tags: TagSuggestion[];
 quality: {
 completeness: number;
 consistency: number;
 recommendations: string[];
 };
}

export class SmartCategorization {
 private categoryRules: CategoryRule[] = [];
 private knownTags: Set<string> = new Set();
 private tagFrequency: Map<string, number> = new Map();

 constructor() {
 this.initializeRules();
 }

 /**
 * Initialize categorization rules
 */
 private initializeRules(): void {
 this.categoryRules = [
 // Frontend Services
 {
 id: 'frontend',
 name: 'Frontend Application',
 description: 'User-facing web applications and interfaces',
 weight: 1.0,
 patterns: [
 { field: 'metadata.name', pattern: /^(frontend|ui|web|app|portal|dashboard)/, weight: 0.8 },
 { field: 'metadata.description', pattern: /\b(react|vue|angular|frontend|ui|interface|dashboard)\b/i, weight: 0.7 },
 { field: 'metadata.tags', pattern: /^(react|vue|angular|frontend|ui|web|spa)$/, weight: 0.9 },
 { field: 'spec.type', pattern: /^(website|frontend)$/, weight: 0.8 },
 ],
 tags: ['frontend', 'ui', 'web', 'user-facing'],
 },
 
 // Backend Services
 {
 id: 'backend',
 name: 'Backend Service',
 description: 'Server-side applications and APIs',
 weight: 1.0,
 patterns: [
 { field: 'metadata.name', pattern: /^(backend|api|service|server)/, weight: 0.8 },
 { field: 'metadata.description', pattern: /\b(api|service|backend|server|microservice|endpoint)\b/i, weight: 0.7 },
 { field: 'metadata.tags', pattern: /^(api|backend|service|microservice|server)$/, weight: 0.9 },
 { field: 'spec.type', pattern: /^(service|api)$/, weight: 0.8 },
 ],
 tags: ['backend', 'api', 'service', 'server'],
 },

 // Data Services
 {
 id: 'data',
 name: 'Data Service',
 description: 'Data processing, analytics, and storage services',
 weight: 1.0,
 patterns: [
 { field: 'metadata.name', pattern: /^(data|analytics|etl|pipeline|warehouse)/, weight: 0.8 },
 { field: 'metadata.description', pattern: /\b(data|analytics|etl|pipeline|warehouse|kafka|stream)\b/i, weight: 0.7 },
 { field: 'metadata.tags', pattern: /^(data|analytics|etl|kafka|stream|pipeline)$/, weight: 0.9 },
 ],
 tags: ['data', 'analytics', 'processing', 'pipeline'],
 },

 // Infrastructure
 {
 id: 'infrastructure',
 name: 'Infrastructure',
 description: 'Infrastructure components and platform services',
 weight: 1.0,
 patterns: [
 { field: 'metadata.name', pattern: /^(infra|platform|k8s|kubernetes|terraform)/, weight: 0.8 },
 { field: 'metadata.description', pattern: /\b(infrastructure|platform|k8s|kubernetes|terraform|helm)\b/i, weight: 0.7 },
 { field: 'metadata.tags', pattern: /^(infrastructure|platform|k8s|kubernetes|terraform|helm)$/, weight: 0.9 },
 { field: 'kind', pattern: /^(Resource|System)$/, weight: 0.6 },
 ],
 tags: ['infrastructure', 'platform', 'devops', 'deployment'],
 },

 // Machine Learning
 {
 id: 'ml',
 name: 'Machine Learning',
 description: 'AI and machine learning services',
 weight: 1.0,
 patterns: [
 { field: 'metadata.name', pattern: /^(ml|ai|model|training|inference)/, weight: 0.8 },
 { field: 'metadata.description', pattern: /\b(machine learning|ai|model|training|inference|tensorflow|pytorch)\b/i, weight: 0.7 },
 { field: 'metadata.tags', pattern: /^(ml|ai|model|tensorflow|pytorch|training)$/, weight: 0.9 },
 ],
 tags: ['ml', 'ai', 'model', 'training'],
 },

 // Security
 {
 id: 'security',
 name: 'Security Service',
 description: 'Security, authentication, and compliance services',
 weight: 1.0,
 patterns: [
 { field: 'metadata.name', pattern: /^(auth|security|vault|secrets|compliance)/, weight: 0.8 },
 { field: 'metadata.description', pattern: /\b(auth|security|vault|secrets|compliance|oauth|jwt)\b/i, weight: 0.7 },
 { field: 'metadata.tags', pattern: /^(auth|security|vault|secrets|oauth|jwt)$/, weight: 0.9 },
 ],
 tags: ['security', 'auth', 'compliance', 'secrets'],
 },
 ];

 // Initialize common tags
 const commonTags = [
 'frontend', 'backend', 'api', 'service', 'web', 'mobile', 'data', 'analytics',
 'ml', 'ai', 'security', 'auth', 'infrastructure', 'platform', 'devops',
 'monitoring', 'logging', 'database', 'cache', 'queue', 'stream',
 'experimental', 'deprecated', 'production', 'staging', 'development',
 'critical', 'important', 'utility', 'tool', 'library', 'framework',
 'react', 'vue', 'angular', 'nodejs', 'python', 'java', 'go', 'rust',
 'kubernetes', 'docker', 'terraform', 'helm', 'aws', 'gcp', 'azure',
 ];

 commonTags.forEach(tag => {
 this.knownTags.add(tag);
 this.tagFrequency.set(tag, Math.floor(Math.random() * 100) + 10);
 });
 }

 /**
 * Analyze entity and provide categorization suggestions
 */
 async analyzeEntity(entity: Entity): Promise<AnalysisResult> {
 const categories = this.suggestCategories(entity);
 const tags = this.suggestTags(entity);
 const quality = this.assessQuality(entity);

 return {
 categories,
 tags,
 quality,
 };
 }

 /**
 * Suggest categories for an entity
 */
 private suggestCategories(entity: Entity): CategorySuggestion[] {
 const suggestions: CategorySuggestion[] = [];

 for (const rule of this.categoryRules) {
 let totalScore = 0;
 const reasons: string[] = [];

 for (const pattern of rule.patterns) {
 const fieldValue = this.getFieldValue(entity, String(pattern.field));
 const score = this.matchPattern(fieldValue, pattern.pattern) * pattern.weight;
 
 if (score > 0) {
 totalScore += score;
 reasons.push(`Matched ${pattern.field}: ${fieldValue}`);
 }
 }

 if (totalScore > 0) {
 const confidence = Math.min(totalScore / rule.patterns.length, 1.0);
 
 if (confidence > 0.3) { // Threshold for suggestions
 suggestions.push({
 category: rule.name,
 confidence,
 reasons,
 suggestedTags: rule.tags,
 });
 }
 }
 }

 return suggestions.sort((a, b) => b.confidence - a.confidence);
 }

 /**
 * Suggest tags for an entity
 */
 private suggestTags(entity: Entity): TagSuggestion[] {
 const suggestions: TagSuggestion[] = [];
 const existingTags = new Set(entity.metadata.tags || []);

 // Analyze text content for tag suggestions
 const textContent = [
 entity.metadata.name,
 entity.metadata.description || '',
 entity.spec?.type || '',
 ...(entity.metadata.tags || []),
 ].join(' ').toLowerCase();

 // Language/Technology detection
 const techPatterns = [
 { tag: 'react', pattern: /\breact\b/, confidence: 0.9 },
 { tag: 'vue', pattern: /\bvue\b/, confidence: 0.9 },
 { tag: 'angular', pattern: /\bangular\b/, confidence: 0.9 },
 { tag: 'nodejs', pattern: /\b(node|nodejs|node\.js)\b/, confidence: 0.9 },
 { tag: 'python', pattern: /\bpython\b/, confidence: 0.9 },
 { tag: 'java', pattern: /\bjava\b/, confidence: 0.8 },
 { tag: 'go', pattern: /\b(go|golang)\b/, confidence: 0.9 },
 { tag: 'rust', pattern: /\brust\b/, confidence: 0.9 },
 { tag: 'typescript', pattern: /\btypescript\b/, confidence: 0.9 },
 { tag: 'javascript', pattern: /\bjavascript\b/, confidence: 0.8 },
 ];

 // Infrastructure patterns
 const infraPatterns = [
 { tag: 'kubernetes', pattern: /\b(k8s|kubernetes)\b/, confidence: 0.9 },
 { tag: 'docker', pattern: /\bdocker\b/, confidence: 0.9 },
 { tag: 'terraform', pattern: /\bterraform\b/, confidence: 0.9 },
 { tag: 'helm', pattern: /\bhelm\b/, confidence: 0.9 },
 { tag: 'aws', pattern: /\b(aws|amazon)\b/, confidence: 0.8 },
 { tag: 'gcp', pattern: /\b(gcp|google cloud)\b/, confidence: 0.8 },
 { tag: 'azure', pattern: /\bazure\b/, confidence: 0.8 },
 ];

 // Check all patterns
 [...techPatterns, ...infraPatterns].forEach(({ tag, pattern, confidence }) => {
 if (pattern.test(textContent) && !existingTags.has(tag)) {
 suggestions.push({
 tag,
 confidence,
 reason: `Detected in content: ${pattern.source}`,
 category: techPatterns.includes({ tag, pattern, confidence } as any) ? 'Technology' : 'Infrastructure',
 });
 }
 });

 // Suggest based on naming conventions
 const namingPatterns = [
 { tag: 'api', pattern: /\b(api|service)\b/, confidence: 0.7 },
 { tag: 'frontend', pattern: /\b(ui|frontend|web|app)\b/, confidence: 0.7 },
 { tag: 'backend', pattern: /\b(backend|server|service)\b/, confidence: 0.7 },
 { tag: 'data', pattern: /\b(data|analytics|etl)\b/, confidence: 0.7 },
 { tag: 'monitoring', pattern: /\b(monitor|metrics|observability)\b/, confidence: 0.7 },
 { tag: 'security', pattern: /\b(auth|security|vault)\b/, confidence: 0.7 },
 ];

 namingPatterns.forEach(({ tag, pattern, confidence }) => {
 if (pattern.test(textContent) && !existingTags.has(tag)) {
 suggestions.push({
 tag,
 confidence,
 reason: `Inferred from naming: ${entity.metadata.name}`,
 category: 'Function',
 });
 }
 });

 // Suggest lifecycle tags based on entity lifecycle
 if (entity.spec?.lifecycle && !existingTags.has(entity.spec.lifecycle)) {
 suggestions.push({
 tag: entity.spec.lifecycle,
 confidence: 0.8,
 reason: `From entity lifecycle: ${entity.spec.lifecycle}`,
 category: 'Lifecycle',
 });
 }

 // Suggest owner-based tags
 if (entity.spec?.owner && !existingTags.has(`team-${entity.spec.owner}`)) {
 suggestions.push({
 tag: `team-${entity.spec.owner}`,
 confidence: 0.6,
 reason: `From ownership: ${entity.spec.owner}`,
 category: 'Ownership',
 });
 }

 return suggestions
 .filter(suggestion => suggestion.confidence > 0.4)
 .sort((a, b) => b.confidence - a.confidence)
 .slice(0, 10); // Limit to top 10 suggestions
 }

 /**
 * Assess entity quality and provide recommendations
 */
 private assessQuality(entity: Entity): {
 completeness: number;
 consistency: number;
 recommendations: string[];
 } {
 const recommendations: string[] = [];
 let completenessScore = 0;
 let consistencyScore = 0;

 // Check completeness
 const requiredFields = [
 'metadata.name',
 'metadata.description',
 'spec.owner',
 'spec.lifecycle',
 ];

 let filledFields = 0;
 requiredFields.forEach(field => {
 const value = this.getFieldValue(entity, field);
 if (value && value.trim()) {
 filledFields++;
 } else {
 recommendations.push(`Add ${field.replace('metadata.', '').replace('spec.', '')}`);
 }
 });

 completenessScore = filledFields / requiredFields.length;

 // Check for tags
 if (!entity.metadata.tags || entity.metadata.tags.length === 0) {
 recommendations.push('Add relevant tags for better discoverability');
 } else {
 completenessScore += 0.1; // Bonus for having tags
 }

 // Check for documentation
 if (!entity.metadata.annotations?.['backstage.io/techdocs-ref']) {
 recommendations.push('Add TechDocs documentation reference');
 } else {
 completenessScore += 0.1; // Bonus for documentation
 }

 // Check consistency
 consistencyScore = 0.8; // Base consistency score

 // Check naming conventions
 const name = entity.metadata.name;
 if (!/^[a-z0-9-]+$/.test(name)) {
 recommendations.push('Use lowercase letters, numbers, and hyphens in entity names');
 consistencyScore -= 0.2;
 }

 // Check description quality
 const description = entity.metadata.description || '';
 if (description.length < 10) {
 recommendations.push('Provide a more detailed description (at least 10 characters)');
 consistencyScore -= 0.1;
 }

 if (description.length > 200) {
 recommendations.push('Consider shortening the description (under 200 characters)');
 consistencyScore -= 0.05;
 }

 return {
 completeness: Math.min(completenessScore, 1.0),
 consistency: Math.max(consistencyScore, 0.0),
 recommendations,
 };
 }

 /**
 * Get field value from entity using dot notation
 */
 private getFieldValue(entity: Entity, field: string): string {
 const parts = field.split('.');
 let value: any = entity;

 for (const part of parts) {
 if (value && typeof value === 'object') {
 value = value[part as keyof typeof value];
 } else {
 return '';
 }
 }

 if (Array.isArray(value)) {
 return value.join(' ');
 }

 return String(value || '');
 }

 /**
 * Match a pattern against a value
 */
 private matchPattern(value: string, pattern: RegExp | string): number {
 if (!value) return 0;

 if (pattern instanceof RegExp) {
 return pattern.test(value) ? 1 : 0;
 } else {
 return value.toLowerCase().includes(pattern.toLowerCase()) ? 1 : 0;
 }
 }

 /**
 * Learn from user feedback to improve suggestions
 */
 async learnFromFeedback(
 entity: Entity,
 acceptedTags: string[],
 rejectedTags: string[],
 acceptedCategories: string[]
 ): Promise<void> {
 // Update tag frequency based on feedback
 acceptedTags.forEach(tag => {
 this.knownTags.add(tag);
 const currentFreq = this.tagFrequency.get(tag) || 0;
 this.tagFrequency.set(tag, currentFreq + 1);
 });

 rejectedTags.forEach(tag => {
 const currentFreq = this.tagFrequency.get(tag) || 0;
 if (currentFreq > 0) {
 this.tagFrequency.set(tag, currentFreq - 1);
 }
 });

 // In a real implementation, this would update ML models or rule weights
 console.log('Learning from feedback:', {
 entity: entity.metadata.name,
 acceptedTags,
 rejectedTags,
 acceptedCategories,
 });
 }

 /**
 * Get popular tags for suggestions
 */
 getPopularTags(limit: number = 20): Array<{ tag: string; frequency: number }> {
 return Array.from(this.tagFrequency.entries())
 .sort(([, a], [, b]) => b - a)
 .slice(0, limit)
 .map(([tag, frequency]) => ({ tag, frequency }));
 }

 /**
 * Bulk analyze multiple entities
 */
 async bulkAnalyze(entities: Entity[]): Promise<Map<string, AnalysisResult>> {
 const results = new Map<string, AnalysisResult>();

 for (const entity of entities) {
 const entityId = entity.metadata.uid || `${entity.kind}-${entity.metadata.name}`;
 const analysis = await this.analyzeEntity(entity);
 results.set(entityId, analysis);
 }

 return results;
 }
}

// Singleton instance
let smartCategorizationInstance: SmartCategorization | null = null;

/**
 * Get or create smart categorization instance
 */
export function getSmartCategorization(): SmartCategorization {
 if (!smartCategorizationInstance) {
 smartCategorizationInstance = new SmartCategorization();
 }
 return smartCategorizationInstance;
}