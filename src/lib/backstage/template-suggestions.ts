/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import type { TemplateEntityV1beta3 } from './types';

export interface ServiceFormData {
 name: string;
 title: string;
 description: string;
 owner: string;
 type: 'service' | 'website' | 'library' | 'documentation';
 lifecycle: 'experimental' | 'production' | 'deprecated';
 system?: string;
 tags: string[];
 infrastructure: {
 kubernetes: boolean;
 database: boolean;
 cache: boolean;
 messaging: boolean;
 };
 monitoring: {
 prometheus: boolean;
 logging: boolean;
 tracing: boolean;
 alerts: boolean;
 };
}

export interface TemplateSuggestion {
 template: TemplateEntityV1beta3;
 score: number;
 reasons: string[];
 matchedTags: string[];
 matchedFeatures: string[];
}

// Technology and framework detection patterns
const TECH_PATTERNS = {
 nodejs: /node\.?js|npm|express|fastify|nest\.?js/i,
 react: /react|next\.?js|gatsby|vite/i,
 python: /python|django|flask|fastapi|pytest/i,
 java: /java|spring|maven|gradle|junit/i,
 dotnet: /\.net|c#|asp\.net|nuget/i,
 go: /golang?|gin|fiber|echo/i,
 rust: /rust|cargo|actix|rocket/i,
 php: /php|laravel|symfony|composer/i,
 frontend: /frontend|ui|web|client|spa|pwa/i,
 backend: /backend|api|service|server|microservice/i,
 database: /database|db|sql|postgres|mysql|mongo/i,
 cache: /cache|redis|memcached/i,
 messaging: /message|queue|kafka|rabbitmq|mqtt/i,
 mobile: /mobile|ios|android|flutter|react.native/i,
 ml: /machine.learning|ml|ai|tensorflow|pytorch/i,
 data: /data|analytics|etl|pipeline|spark/i,
};

// Infrastructure requirement mapping
const INFRA_MAPPINGS = {
 kubernetes: ['k8s', 'kubernetes', 'containerized', 'cloud-native'],
 database: ['postgres', 'mysql', 'mongodb', 'database', 'sql'],
 cache: ['redis', 'memcached', 'caching'],
 messaging: ['kafka', 'rabbitmq', 'messaging', 'queue', 'event-driven'],
};

export class TemplateSuggestionEngine {
 /**
 * Get template suggestions based on form data
 */
 static getSuggestions(
 formData: Partial<ServiceFormData>,
 availableTemplates: TemplateEntityV1beta3[]
 ): TemplateSuggestion[] {
 const suggestions: TemplateSuggestion[] = [];

 for (const template of availableTemplates) {
 const suggestion = this.scoreTemplate(formData, template);
 if (suggestion.score > 0) {
 suggestions.push(suggestion);
 }
 }

 // Sort by score (highest first)
 return suggestions.sort((a, b) => b.score - a.score);
 }

 /**
 * Score a template based on how well it matches the form data
 */
 private static scoreTemplate(
 formData: Partial<ServiceFormData>,
 template: TemplateEntityV1beta3
 ): TemplateSuggestion {
 let score = 0;
 const reasons: string[] = [];
 const matchedTags: string[] = [];
 const matchedFeatures: string[] = [];

 // Component type matching (high weight)
 if (formData.type && template.spec?.type === formData.type) {
 score += 30;
 reasons.push(`Matches component type: ${formData.type}`);
 }

 // Tag-based matching
 const templateTags = template.metadata.tags || [];
 const formTags = formData.tags || [];
 
 for (const tag of formTags) {
 if (templateTags.some(tt => tt.toLowerCase().includes(tag.toLowerCase()))) {
 score += 10;
 matchedTags.push(tag);
 }
 }

 if (matchedTags.length > 0) {
 reasons.push(`Matches tags: ${matchedTags.join(', ')}`);
 }

 // Technology detection from description and title
 const textToAnalyze = [
 formData.description || '',
 formData.title || '',
 formData.name || '',
 ...formTags
 ].join(' ').toLowerCase();

 const templateText = [
 template.metadata.description || '',
 template.metadata.title || '',
 template.metadata.name || '',
 ...(template.metadata.tags || [])
 ].join(' ').toLowerCase();

 // Check for technology matches
 for (const [tech, pattern] of Object.entries(TECH_PATTERNS)) {
 if (pattern.test(textToAnalyze) && pattern.test(templateText)) {
 score += 15;
 matchedFeatures.push(tech);
 reasons.push(`Technology match: ${tech}`);
 }
 }

 // Infrastructure requirements matching
 if (formData.infrastructure) {
 for (const [infra, enabled] of Object.entries(formData.infrastructure)) {
 if (enabled && INFRA_MAPPINGS[infra as keyof typeof INFRA_MAPPINGS]) {
 const keywords = INFRA_MAPPINGS[infra as keyof typeof INFRA_MAPPINGS];
 if (keywords.some(keyword => templateText.includes(keyword))) {
 score += 12;
 matchedFeatures.push(infra);
 reasons.push(`Infrastructure match: ${infra}`);
 }
 }
 }
 }

 // Lifecycle stage preference
 if (formData.lifecycle && template.spec?.owner) {
 // Boost templates from the same team/owner for consistency
 if (template.spec.owner === formData.owner) {
 score += 8;
 reasons.push('Same team ownership');
 }
 }

 // Monitoring requirements matching
 if (formData.monitoring) {
 const monitoringKeywords = ['prometheus', 'grafana', 'logging', 'tracing', 'observability'];
 if (monitoringKeywords.some(keyword => templateText.includes(keyword))) {
 score += 5;
 matchedFeatures.push('monitoring');
 reasons.push('Includes monitoring setup');
 }
 }

 // Boost score for popular/recommended templates
 if (templateTags.includes('recommended') || templateTags.includes('popular')) {
 score += 5;
 reasons.push('Recommended template');
 }

 // Penalty for deprecated templates
 if (templateTags.includes('deprecated') || template.metadata.name?.includes('deprecated')) {
 score -= 20;
 reasons.push('Template is deprecated');
 }

 return {
 template,
 score,
 reasons,
 matchedTags,
 matchedFeatures,
 };
 }

 /**
 * Get the top N template suggestions
 */
 static getTopSuggestions(
 formData: Partial<ServiceFormData>,
 availableTemplates: TemplateEntityV1beta3[],
 limit: number = 3
 ): TemplateSuggestion[] {
 return this.getSuggestions(formData, availableTemplates).slice(0, limit);
 }

 /**
 * Check if a template is a good match (score above threshold)
 */
 static isGoodMatch(
 formData: Partial<ServiceFormData>,
 template: TemplateEntityV1beta3,
 threshold: number = 25
 ): boolean {
 const suggestion = this.scoreTemplate(formData, template);
 return suggestion.score >= threshold;
 }

 /**
 * Get suggestions for specific use cases
 */
 static getSpecificSuggestions(
 useCase: 'microservice' | 'frontend' | 'api' | 'data-pipeline' | 'mobile',
 availableTemplates: TemplateEntityV1beta3[]
 ): TemplateSuggestion[] {
 const useCaseFormData: Partial<ServiceFormData> = {
 microservice: {
 type: 'service',
 tags: ['backend', 'api', 'microservice'],
 infrastructure: { kubernetes: true, database: true, cache: false, messaging: true },
 },
 frontend: {
 type: 'website',
 tags: ['frontend', 'ui', 'web'],
 infrastructure: { kubernetes: true, database: false, cache: true, messaging: false },
 },
 api: {
 type: 'service',
 tags: ['api', 'rest', 'graphql'],
 infrastructure: { kubernetes: true, database: true, cache: true, messaging: false },
 },
 'data-pipeline': {
 type: 'service',
 tags: ['data', 'etl', 'pipeline', 'analytics'],
 infrastructure: { kubernetes: true, database: true, cache: false, messaging: true },
 },
 mobile: {
 type: 'service',
 tags: ['mobile', 'api', 'backend'],
 infrastructure: { kubernetes: true, database: true, cache: true, messaging: true },
 },
 }[useCase];

 return this.getSuggestions(useCaseFormData, availableTemplates);
 }
}