import { catalogClient } from '@/services/backstage/clients/catalog.client';
import { scaffolderClient } from '@/services/backstage/clients/scaffolder.client';
import type { Entity } from '@/services/backstage/types/entities';
import type { TemplateEntity } from '@/services/backstage/types/templates';

export interface SearchResult {
 id: string;
 type: 'entity' | 'template' | 'user' | 'group' | 'documentation';
 title: string;
 description?: string;
 url: string;
 highlights?: string[];
 metadata: Record<string, any>;
 score: number;
}

export interface SearchFilters {
 types?: string[];
 kinds?: string[];
 owners?: string[];
 tags?: string[];
 lifecycles?: string[];
 dateRange?: {
 start?: Date;
 end?: Date;
 };
}

export interface SearchFacet {
 field: string;
 values: Array<{
 value: string;
 count: number;
 selected?: boolean;
 }>;
}

export interface SearchResponse {
 results: SearchResult[];
 facets: SearchFacet[];
 total: number;
 page: number;
 pageSize: number;
 query: string;
 filters: SearchFilters;
 took: number;
}

export interface SearchSuggestion {
 text: string;
 type: 'recent' | 'popular' | 'entity' | 'template';
 metadata?: any;
}

class SearchService {
 private static instance: SearchService;
 private searchHistory: string[] = [];
 private popularSearches: Map<string, number> = new Map();
 private searchIndex: Map<string, SearchResult> = new Map();
 private lastIndexTime?: Date;

 private constructor() {
 this.loadSearchHistory();
 this.loadPopularSearches();
 }

 static getInstance(): SearchService {
 if (!SearchService.instance) {
 SearchService.instance = new SearchService();
 }
 return SearchService.instance;
 }

 // Main search function
 async search(
 query: string,
 filters: SearchFilters = {},
 page: number = 1,
 pageSize: number = 20
 ): Promise<SearchResponse> {
 const startTime = Date.now();
 
 // Add to search history
 this.addToHistory(query);
 this.incrementPopularSearch(query);

 // Build search index if needed
 if (!this.lastIndexTime || Date.now() - this.lastIndexTime.getTime() > 300000) {
 await this.buildSearchIndex();
 }

 // Perform search
 const allResults = await this.performSearch(query, filters);
 
 // Apply scoring and ranking
 const scoredResults = this.scoreResults(allResults, query);
 
 // Sort by score
 scoredResults.sort((a, b) => b.score - a.score);
 
 // Generate facets
 const facets = this.generateFacets(scoredResults, filters);
 
 // Paginate results
 const start = (page - 1) * pageSize;
 const paginatedResults = scoredResults.slice(start, start + pageSize);
 
 return {
 results: paginatedResults,
 facets,
 total: scoredResults.length,
 page,
 pageSize,
 query,
 filters,
 took: Date.now() - startTime
 };
 }

 // Get search suggestions
 async getSuggestions(query: string): Promise<SearchSuggestion[]> {
 const suggestions: SearchSuggestion[] = [];
 
 // Add recent searches
 const recentSearches = this.searchHistory
 .filter(s => s.toLowerCase().includes(query.toLowerCase()) && s !== query)
 .slice(0, 3)
 .map(text => ({
 text,
 type: 'recent' as const
 }));
 suggestions.push(...recentSearches);
 
 // Add popular searches
 const popularSearches = Array.from(this.popularSearches.entries())
 .filter(([text]) => text.toLowerCase().includes(query.toLowerCase()) && text !== query)
 .sort((a, b) => b[1] - a[1])
 .slice(0, 3)
 .map(([text]) => ({
 text,
 type: 'popular' as const
 }));
 suggestions.push(...popularSearches);
 
 // Add entity/template suggestions
 if (query.length >= 2) {
 const entitySuggestions = await this.getEntitySuggestions(query);
 suggestions.push(...entitySuggestions);
 }
 
 // Remove duplicates
 const uniqueSuggestions = Array.from(
 new Map(suggestions.map(s => [s.text, s])).values()
 );
 
 return uniqueSuggestions.slice(0, 10);
 }

 // Build search index
 private async buildSearchIndex() {
 this.searchIndex.clear();
 
 // Index entities
 try {
 const entities = await catalogClient.getEntities({ limit: 1000 });
 for (const entity of entities.items) {
 const searchResult = this.entityToSearchResult(entity);
 this.searchIndex.set(searchResult.id, searchResult);
 }
 } catch (error) {
 console.error('Failed to index entities:', error);
 }
 
 // Index templates
 try {
 const templates = await scaffolderClient.getTemplates();
 for (const template of templates) {
 const searchResult = this.templateToSearchResult(template);
 this.searchIndex.set(searchResult.id, searchResult);
 }
 } catch (error) {
 console.error('Failed to index templates:', error);
 }
 
 this.lastIndexTime = new Date();
 }

 // Perform the actual search
 private async performSearch(query: string, filters: SearchFilters): Promise<SearchResult[]> {
 const results: SearchResult[] = [];
 const searchTerms = query.toLowerCase().split(/\s+/);
 
 // Search through index
 for (const [id, item] of this.searchIndex) {
 // Apply type filters
 if (filters.types && !filters.types.includes(item.type)) {
 continue;
 }
 
 // Apply kind filters
 if (filters.kinds && item.metadata.kind && !filters.kinds.includes(item.metadata.kind)) {
 continue;
 }
 
 // Apply owner filters
 if (filters.owners && item.metadata.owner && !filters.owners.includes(item.metadata.owner)) {
 continue;
 }
 
 // Apply tag filters
 if (filters.tags && filters.tags.length > 0) {
 const itemTags = item.metadata.tags || [];
 if (!filters.tags.some(tag => itemTags.includes(tag))) {
 continue;
 }
 }
 
 // Text search
 const searchableText = `${item.title} ${item.description || ''} ${(item.metadata.tags || []).join(' ')}`.toLowerCase();
 const matches = searchTerms.every(term => searchableText.includes(term));
 
 if (matches) {
 // Add highlights
 const highlights = this.generateHighlights(searchableText, searchTerms);
 results.push({
 ...item,
 highlights
 });
 }
 }
 
 return results;
 }

 // Score search results
 private scoreResults(results: SearchResult[], query: string): SearchResult[] {
 const queryTerms = query.toLowerCase().split(/\s+/);
 
 return results.map(result => {
 let score = 0;
 
 // Title match (highest weight)
 const titleLower = result.title.toLowerCase();
 queryTerms.forEach(term => {
 if (titleLower === term) score += 100; // Exact match
 else if (titleLower.startsWith(term)) score += 50; // Starts with
 else if (titleLower.includes(term)) score += 20; // Contains
 });
 
 // Description match
 if (result.description) {
 const descLower = result.description.toLowerCase();
 queryTerms.forEach(term => {
 if (descLower.includes(term)) score += 10;
 });
 }
 
 // Tag match
 const tags = result.metadata.tags || [];
 queryTerms.forEach(term => {
 if (tags.some(tag => tag.toLowerCase().includes(term))) {
 score += 15;
 }
 });
 
 // Boost based on type
 if (result.type === 'entity') score += 5;
 if (result.type === 'template') score += 3;
 
 // Recency boost (if available)
 if (result.metadata.updatedAt) {
 const daysSinceUpdate = (Date.now() - new Date(result.metadata.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
 if (daysSinceUpdate < 7) score += 10;
 else if (daysSinceUpdate < 30) score += 5;
 }
 
 return {
 ...result,
 score
 };
 });
 }

 // Generate facets from results
 private generateFacets(results: SearchResult[], currentFilters: SearchFilters): SearchFacet[] {
 const facets: SearchFacet[] = [];
 
 // Type facet
 const typeCounts = new Map<string, number>();
 results.forEach(r => {
 typeCounts.set(r.type, (typeCounts.get(r.type) || 0) + 1);
 });
 facets.push({
 field: 'type',
 values: Array.from(typeCounts.entries()).map(([value, count]) => ({
 value,
 count,
 selected: currentFilters.types?.includes(value)
 }))
 });
 
 // Kind facet
 const kindCounts = new Map<string, number>();
 results.forEach(r => {
 if (r.metadata.kind) {
 kindCounts.set(r.metadata.kind, (kindCounts.get(r.metadata.kind) || 0) + 1);
 }
 });
 if (kindCounts.size > 0) {
 facets.push({
 field: 'kind',
 values: Array.from(kindCounts.entries()).map(([value, count]) => ({
 value,
 count,
 selected: currentFilters.kinds?.includes(value)
 }))
 });
 }
 
 // Owner facet
 const ownerCounts = new Map<string, number>();
 results.forEach(r => {
 if (r.metadata.owner) {
 ownerCounts.set(r.metadata.owner, (ownerCounts.get(r.metadata.owner) || 0) + 1);
 }
 });
 if (ownerCounts.size > 0) {
 facets.push({
 field: 'owner',
 values: Array.from(ownerCounts.entries())
 .sort((a, b) => b[1] - a[1])
 .slice(0, 10)
 .map(([value, count]) => ({
 value,
 count,
 selected: currentFilters.owners?.includes(value)
 }))
 });
 }
 
 // Tag facet
 const tagCounts = new Map<string, number>();
 results.forEach(r => {
 (r.metadata.tags || []).forEach(tag => {
 tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
 });
 });
 if (tagCounts.size > 0) {
 facets.push({
 field: 'tags',
 values: Array.from(tagCounts.entries())
 .sort((a, b) => b[1] - a[1])
 .slice(0, 20)
 .map(([value, count]) => ({
 value,
 count,
 selected: currentFilters.tags?.includes(value)
 }))
 });
 }
 
 return facets;
 }

 // Generate search highlights
 private generateHighlights(text: string, terms: string[]): string[] {
 const highlights: string[] = [];
 const sentences = text.split(/[.!?]+/);
 
 sentences.forEach(sentence => {
 const hasMatch = terms.some(term => sentence.toLowerCase().includes(term));
 if (hasMatch) {
 let highlighted = sentence.trim();
 terms.forEach(term => {
 const regex = new RegExp(`(${term})`, 'gi');
 highlighted = highlighted.replace(regex, '<mark>$1</mark>');
 });
 highlights.push(highlighted);
 }
 });
 
 return highlights.slice(0, 3);
 }

 // Convert entity to search result
 private entityToSearchResult(entity: Entity): SearchResult {
 return {
 id: entity.metadata.uid || `${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`,
 type: 'entity',
 title: entity.metadata.title || entity.metadata.name,
 description: entity.metadata.description,
 url: `/catalog/${entity.kind.toLowerCase()}/${entity.metadata.namespace}/${entity.metadata.name}`,
 metadata: {
 kind: entity.kind,
 namespace: entity.metadata.namespace,
 name: entity.metadata.name,
 owner: entity.spec?.owner,
 tags: entity.metadata.tags,
 updatedAt: entity.metadata.annotations?.['backstage.io/managed-by-origin-location']
 },
 score: 0
 };
 }

 // Convert template to search result
 private templateToSearchResult(template: TemplateEntity): SearchResult {
 return {
 id: template.metadata.uid || `template:${template.metadata.namespace}/${template.metadata.name}`,
 type: 'template',
 title: template.metadata.title || template.metadata.name,
 description: template.metadata.description,
 url: `/templates/${template.metadata.namespace}/${template.metadata.name}`,
 metadata: {
 kind: 'Template',
 namespace: template.metadata.namespace,
 name: template.metadata.name,
 owner: template.spec.owner,
 tags: template.metadata.tags,
 type: template.spec.type
 },
 score: 0
 };
 }

 // Get entity suggestions
 private async getEntitySuggestions(query: string): Promise<SearchSuggestion[]> {
 const suggestions: SearchSuggestion[] = [];
 const queryLower = query.toLowerCase();
 
 for (const [id, item] of this.searchIndex) {
 if (item.title.toLowerCase().includes(queryLower)) {
 suggestions.push({
 text: item.title,
 type: item.type as any,
 metadata: {
 id: item.id,
 url: item.url
 }
 });
 }
 
 if (suggestions.length >= 5) break;
 }
 
 return suggestions;
 }

 // History management
 private addToHistory(query: string) {
 // Remove if already exists
 this.searchHistory = this.searchHistory.filter(q => q !== query);
 // Add to beginning
 this.searchHistory.unshift(query);
 // Keep only last 50
 this.searchHistory = this.searchHistory.slice(0, 50);
 // Save to localStorage
 this.saveSearchHistory();
 }

 private incrementPopularSearch(query: string) {
 const count = this.popularSearches.get(query) || 0;
 this.popularSearches.set(query, count + 1);
 this.savePopularSearches();
 }

 private loadSearchHistory() {
 try {
 const stored = localStorage.getItem('search_history');
 if (stored) {
 this.searchHistory = JSON.parse(stored);
 }
 } catch (error) {
 console.error('Failed to load search history:', error);
 }
 }

 private saveSearchHistory() {
 try {
 localStorage.setItem('search_history', JSON.stringify(this.searchHistory));
 } catch (error) {
 console.error('Failed to save search history:', error);
 }
 }

 private loadPopularSearches() {
 try {
 const stored = localStorage.getItem('popular_searches');
 if (stored) {
 this.popularSearches = new Map(JSON.parse(stored));
 }
 } catch (error) {
 console.error('Failed to load popular searches:', error);
 }
 }

 private savePopularSearches() {
 try {
 const data = Array.from(this.popularSearches.entries());
 localStorage.setItem('popular_searches', JSON.stringify(data));
 } catch (error) {
 console.error('Failed to save popular searches:', error);
 }
 }

 // Get search history
 getSearchHistory(): string[] {
 return [...this.searchHistory];
 }

 // Clear search history
 clearSearchHistory() {
 this.searchHistory = [];
 this.saveSearchHistory();
 }
}

export const searchService = SearchService.getInstance();