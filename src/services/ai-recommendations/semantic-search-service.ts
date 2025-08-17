import { EventEmitter } from 'events';
import { prisma } from '@/lib/db/client';

interface SearchResult {
  plugin: any;
  score: number;
  highlights: SearchHighlight[];
  searchRank: number;
  relevanceFactors: RelevanceFactor[];
}

interface SearchHighlight {
  field: 'name' | 'description' | 'readme' | 'keywords' | 'category';
  snippet: string;
  matchType: 'exact' | 'partial' | 'semantic' | 'fuzzy';
  confidence: number;
}

interface RelevanceFactor {
  factor: 'keyword_match' | 'semantic_similarity' | 'popularity' | 'recency' | 'user_context' | 'category_relevance';
  weight: number;
  contribution: number;
  explanation: string;
}

interface SearchContext {
  userId?: string;
  userRole?: string;
  technicalStack?: string[];
  projectContext?: string;
  skillLevel?: string;
  preferredCategories?: string[];
  currentPlugins?: string[];
}

interface SearchFilter {
  categories?: string[];
  tags?: string[];
  minRating?: number;
  maxComplexity?: number;
  compatibility?: string[];
  maturityLevel?: ('alpha' | 'beta' | 'stable' | 'deprecated')[];
  pricing?: ('free' | 'paid' | 'freemium')[];
  supportLevel?: ('community' | 'commercial' | 'enterprise')[];
}

interface SearchOptions {
  limit?: number;
  offset?: number;
  includeExperimental?: boolean;
  semanticThreshold?: number;
  exactMatchBoost?: number;
  popularityWeight?: number;
  recencyWeight?: number;
  personalizedWeight?: number;
}

export class SemanticSearchService extends EventEmitter {
  private searchIndex: Map<string, any> = new Map();
  private semanticEmbeddings: Map<string, number[]> = new Map();
  private popularityScores: Map<string, number> = new Map();
  private categoryTaxonomy: Map<string, string[]> = new Map();
  private synonymMaps: Map<string, string[]> = new Map();
  private isInitialized = false;

  constructor() {
    super();
    this.initialize();
  }

  private async initialize() {
    console.log('Initializing Semantic Search Service...');
    try {
      await this.buildSearchIndex();
      await this.loadSemanticEmbeddings();
      await this.calculatePopularityScores();
      await this.buildCategoryTaxonomy();
      await this.loadSynonymMaps();
      this.isInitialized = true;
      console.log('Semantic Search Service initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize semantic search:', error);
      this.emit('initialization_error', error);
    }
  }

  private async buildSearchIndex() {
    const plugins = await prisma.plugin.findMany({
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        analytics: {
          orderBy: { timestamp: 'desc' },
          take: 10
        },
        performance: {
          orderBy: { timestamp: 'desc' },
          take: 5
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    for (const plugin of plugins) {
      const searchableFields = this.extractSearchableFields(plugin);
      this.searchIndex.set(plugin.id, {
        plugin,
        searchableFields,
        fullTextContent: this.buildFullTextContent(plugin, searchableFields),
        lastUpdated: new Date()
      });
    }

    console.log(`Built search index for ${plugins.length} plugins`);
  }

  private extractSearchableFields(plugin: any): any {
    return {
      name: plugin.name || '',
      displayName: plugin.displayName || '',
      description: plugin.description || '',
      keywords: plugin.keywords || [],
      tags: plugin.tags || [],
      category: plugin.category || '',
      subcategory: plugin.subcategory || '',
      author: plugin.author || '',
      maintainer: plugin.maintainer || '',
      readme: this.extractReadmeContent(plugin.readme),
      documentation: plugin.documentation || '',
      license: plugin.license || '',
      repository: plugin.repository || '',
      homepage: plugin.homepage || '',
      changelog: this.extractChangelogContent(plugin.versions?.[0]?.changelog),
      technicalRequirements: plugin.requirements || {},
      dependencies: plugin.versions?.[0]?.dependencies || {},
      configurations: plugin.configurations || []
    };
  }

  private extractReadmeContent(readme: string | null): string {
    if (!readme) return '';
    
    // Extract meaningful content from README, removing markdown syntax
    return readme
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
      .replace(/`{1,3}[^`]*`{1,3}/g, '') // Remove code blocks
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // Remove bold/italic
      .replace(/\n{2,}/g, '\n') // Normalize whitespace
      .trim()
      .substring(0, 2000); // Limit length for indexing
  }

  private extractChangelogContent(changelog: string | null): string {
    if (!changelog) return '';
    
    // Extract recent changes and features
    return changelog
      .substring(0, 1000)
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\s+/g, '')
      .trim();
  }

  private buildFullTextContent(plugin: any, fields: any): string {
    return [
      fields.name,
      fields.displayName,
      fields.description,
      fields.keywords.join(' '),
      fields.tags.join(' '),
      fields.category,
      fields.subcategory,
      fields.readme,
      fields.changelog,
      fields.author,
      fields.maintainer
    ].filter(Boolean).join(' ').toLowerCase();
  }

  private async loadSemanticEmbeddings() {
    // In a production environment, this would load pre-computed embeddings
    // For now, we'll generate simple embeddings based on text features
    for (const [pluginId, indexData] of this.searchIndex.entries()) {
      const embedding = this.generateSimpleEmbedding(indexData.fullTextContent);
      this.semanticEmbeddings.set(pluginId, embedding);
    }

    console.log(`Loaded semantic embeddings for ${this.semanticEmbeddings.size} plugins`);
  }

  private generateSimpleEmbedding(text: string): number[] {
    // Simplified embedding generation using TF-IDF-like approach
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const wordCounts = new Map<string, number>();
    
    words.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });

    // Create 128-dimensional embedding
    const embedding = new Array(128).fill(0);
    let i = 0;
    
    for (const [word, count] of wordCounts.entries()) {
      if (i >= 128) break;
      
      const hash1 = this.hash(word) % 128;
      const hash2 = this.hash(word + 'salt') % 128;
      
      embedding[hash1] += count * 0.1;
      embedding[hash2] += count * 0.05;
      i++;
    }

    // Normalize embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return embedding.map(val => val / magnitude);
    }

    return embedding;
  }

  private hash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private async calculatePopularityScores() {
    const plugins = Array.from(this.searchIndex.values());
    
    // Calculate popularity based on multiple factors
    for (const { plugin } of plugins) {
      let score = 0;
      
      // Download count (normalized)
      const maxDownloads = Math.max(...plugins.map(p => p.plugin.downloadCount || 0));
      if (maxDownloads > 0) {
        score += (plugin.downloadCount || 0) / maxDownloads * 0.4;
      }

      // Star count (normalized)
      const maxStars = Math.max(...plugins.map(p => p.plugin.starCount || 0));
      if (maxStars > 0) {
        score += (plugin.starCount || 0) / maxStars * 0.3;
      }

      // Recent activity (based on last update)
      const daysSinceUpdate = (Date.now() - new Date(plugin.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 1 - daysSinceUpdate / 365); // Decay over a year
      score += recencyScore * 0.2;

      // Review quality (average rating)
      const avgRating = plugin.reviews?.reduce((sum: number, r: any) => sum + r.rating, 0) / (plugin.reviews?.length || 1) || 0;
      score += (avgRating / 5) * 0.1;

      this.popularityScores.set(plugin.id, Math.min(1, score));
    }

    console.log(`Calculated popularity scores for ${this.popularityScores.size} plugins`);
  }

  private async buildCategoryTaxonomy() {
    // Build hierarchical category taxonomy for better search
    this.categoryTaxonomy.set('DEVELOPMENT', [
      'IDE_INTEGRATION', 'CODE_QUALITY', 'TESTING', 'DEBUGGING'
    ]);
    
    this.categoryTaxonomy.set('DEPLOYMENT', [
      'CICD', 'CONTAINER_ORCHESTRATION', 'CLOUD_INFRASTRUCTURE'
    ]);
    
    this.categoryTaxonomy.set('MONITORING', [
      'MONITORING_OBSERVABILITY', 'ANALYTICS_REPORTING', 'ALERTING'
    ]);
    
    this.categoryTaxonomy.set('SECURITY', [
      'AUTHENTICATION', 'AUTHORIZATION', 'SECURITY_COMPLIANCE', 'VULNERABILITY_SCANNING'
    ]);

    console.log('Built category taxonomy');
  }

  private async loadSynonymMaps() {
    // Load synonym mappings for better search recall
    this.synonymMaps.set('kubernetes', ['k8s', 'container orchestration', 'pod management']);
    this.synonymMaps.set('cicd', ['ci/cd', 'continuous integration', 'continuous deployment', 'pipeline']);
    this.synonymMaps.set('monitoring', ['observability', 'metrics', 'alerting', 'tracking']);
    this.synonymMaps.set('database', ['db', 'data store', 'persistence', 'storage']);
    this.synonymMaps.set('authentication', ['auth', 'login', 'identity', 'sso']);
    this.synonymMaps.set('documentation', ['docs', 'wiki', 'knowledge base', 'readme']);

    console.log('Loaded synonym maps');
  }

  async search(
    query: string,
    context?: SearchContext,
    filters?: SearchFilter,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new Error('Semantic search service not initialized');
    }

    const startTime = Date.now();
    
    // Parse and expand query
    const expandedQuery = this.expandQuery(query);
    const queryTerms = this.tokenizeQuery(expandedQuery);
    const queryEmbedding = this.generateSimpleEmbedding(expandedQuery);

    // Get candidate plugins
    const candidates = this.getCandidatePlugins(filters);

    // Score each candidate
    const scoredResults: SearchResult[] = [];

    for (const candidate of candidates) {
      const score = this.calculateRelevanceScore(
        candidate,
        queryTerms,
        queryEmbedding,
        context,
        options
      );

      if (score.totalScore > 0.1) { // Minimum relevance threshold
        const highlights = this.generateHighlights(candidate, queryTerms);
        
        scoredResults.push({
          plugin: candidate.plugin,
          score: score.totalScore,
          highlights,
          searchRank: 0, // Will be set after sorting
          relevanceFactors: score.factors
        });
      }
    }

    // Sort by relevance score
    scoredResults.sort((a, b) => b.score - a.score);

    // Set search ranks
    scoredResults.forEach((result, index) => {
      result.searchRank = index + 1;
    });

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 20;
    const paginatedResults = scoredResults.slice(offset, offset + limit);

    // Log search performance
    const searchTime = Date.now() - startTime;
    console.log(`Search completed in ${searchTime}ms, found ${scoredResults.length} results`);

    this.emit('search_completed', {
      query: expandedQuery,
      resultsCount: scoredResults.length,
      searchTime,
      context
    });

    return paginatedResults;
  }

  private expandQuery(query: string): string {
    const words = query.toLowerCase().split(/\s+/);
    const expandedWords = [...words];

    // Add synonyms
    for (const word of words) {
      const synonyms = this.synonymMaps.get(word) || [];
      expandedWords.push(...synonyms);
    }

    // Add related terms from category taxonomy
    for (const word of words) {
      for (const [category, subcategories] of this.categoryTaxonomy.entries()) {
        if (subcategories.some(sub => sub.toLowerCase().includes(word))) {
          expandedWords.push(category.toLowerCase());
        }
      }
    }

    return [...new Set(expandedWords)].join(' ');
  }

  private tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 2);
  }

  private getCandidatePlugins(filters?: SearchFilter): any[] {
    let candidates = Array.from(this.searchIndex.values());

    if (!filters) return candidates;

    // Apply filters
    if (filters.categories?.length) {
      candidates = candidates.filter(c =>
        filters.categories!.includes(c.plugin.category) ||
        filters.categories!.includes(c.plugin.subcategory)
      );
    }

    if (filters.tags?.length) {
      candidates = candidates.filter(c =>
        filters.tags!.some(tag => c.plugin.tags?.includes(tag))
      );
    }

    if (filters.maturityLevel?.length) {
      candidates = candidates.filter(c =>
        filters.maturityLevel!.includes(c.plugin.lifecycle?.toLowerCase())
      );
    }

    if (filters.minRating !== undefined) {
      candidates = candidates.filter(c => {
        const avgRating = c.plugin.reviews?.reduce((sum: number, r: any) => sum + r.rating, 0) / 
                         (c.plugin.reviews?.length || 1) || 0;
        return avgRating >= filters.minRating!;
      });
    }

    return candidates;
  }

  private calculateRelevanceScore(
    candidate: any,
    queryTerms: string[],
    queryEmbedding: number[],
    context?: SearchContext,
    options: SearchOptions = {}
  ): { totalScore: number; factors: RelevanceFactor[] } {
    const factors: RelevanceFactor[] = [];
    let totalScore = 0;

    // 1. Exact keyword matching
    const exactMatches = this.countExactMatches(candidate.fullTextContent, queryTerms);
    const exactMatchScore = Math.min(exactMatches / queryTerms.length, 1) * (options.exactMatchBoost || 1.5);
    factors.push({
      factor: 'keyword_match',
      weight: 0.3,
      contribution: exactMatchScore,
      explanation: `Found ${exactMatches} exact keyword matches out of ${queryTerms.length} query terms`
    });
    totalScore += exactMatchScore * 0.3;

    // 2. Semantic similarity
    const candidateEmbedding = this.semanticEmbeddings.get(candidate.plugin.id) || [];
    const semanticScore = this.cosineSimilarity(queryEmbedding, candidateEmbedding);
    if (semanticScore >= (options.semanticThreshold || 0.3)) {
      factors.push({
        factor: 'semantic_similarity',
        weight: 0.25,
        contribution: semanticScore,
        explanation: `Semantic similarity score of ${(semanticScore * 100).toFixed(1)}%`
      });
      totalScore += semanticScore * 0.25;
    }

    // 3. Popularity score
    const popularityScore = this.popularityScores.get(candidate.plugin.id) || 0;
    factors.push({
      factor: 'popularity',
      weight: options.popularityWeight || 0.2,
      contribution: popularityScore,
      explanation: `Plugin popularity score: ${(popularityScore * 100).toFixed(1)}%`
    });
    totalScore += popularityScore * (options.popularityWeight || 0.2);

    // 4. Recency score
    const daysSinceUpdate = (Date.now() - new Date(candidate.plugin.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 1 - daysSinceUpdate / 365);
    factors.push({
      factor: 'recency',
      weight: options.recencyWeight || 0.1,
      contribution: recencyScore,
      explanation: `Last updated ${Math.round(daysSinceUpdate)} days ago`
    });
    totalScore += recencyScore * (options.recencyWeight || 0.1);

    // 5. User context relevance
    if (context) {
      const contextScore = this.calculateContextualRelevance(candidate, context);
      if (contextScore > 0) {
        factors.push({
          factor: 'user_context',
          weight: options.personalizedWeight || 0.15,
          contribution: contextScore,
          explanation: this.getContextualExplanation(candidate, context)
        });
        totalScore += contextScore * (options.personalizedWeight || 0.15);
      }
    }

    // 6. Category relevance (if query suggests specific category)
    const categoryScore = this.calculateCategoryRelevance(candidate, queryTerms);
    if (categoryScore > 0) {
      factors.push({
        factor: 'category_relevance',
        weight: 0.1,
        contribution: categoryScore,
        explanation: `Plugin category matches query intent`
      });
      totalScore += categoryScore * 0.1;
    }

    return { totalScore: Math.min(totalScore, 1), factors };
  }

  private countExactMatches(content: string, terms: string[]): number {
    const lowerContent = content.toLowerCase();
    return terms.filter(term => lowerContent.includes(term.toLowerCase())).length;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  private calculateContextualRelevance(candidate: any, context: SearchContext): number {
    let score = 0;

    // User's technical stack alignment
    if (context.technicalStack?.length) {
      const stackMatches = context.technicalStack.filter(tech =>
        candidate.fullTextContent.includes(tech.toLowerCase())
      ).length;
      score += (stackMatches / context.technicalStack.length) * 0.4;
    }

    // User's preferred categories
    if (context.preferredCategories?.length) {
      if (context.preferredCategories.includes(candidate.plugin.category)) {
        score += 0.3;
      }
    }

    // User's current plugins (avoid redundancy, favor complementary)
    if (context.currentPlugins?.length) {
      const hasRedundantPlugin = context.currentPlugins.some(pluginId => {
        // This would need a more sophisticated plugin similarity check
        return candidate.plugin.category === 'SAME_CATEGORY'; // Simplified
      });
      
      if (hasRedundantPlugin) {
        score -= 0.2; // Penalize redundant plugins
      }
    }

    // Project context relevance
    if (context.projectContext) {
      const contextKeywords = this.getProjectContextKeywords(context.projectContext);
      const contextMatches = contextKeywords.filter(keyword =>
        candidate.fullTextContent.includes(keyword)
      ).length;
      score += (contextMatches / contextKeywords.length) * 0.3;
    }

    return Math.max(0, Math.min(1, score));
  }

  private getProjectContextKeywords(projectContext: string): string[] {
    const contextMappings: { [key: string]: string[] } = {
      'microservice': ['api', 'service', 'docker', 'kubernetes', 'rest', 'grpc'],
      'frontend': ['react', 'vue', 'angular', 'ui', 'component', 'css', 'javascript'],
      'backend': ['api', 'database', 'server', 'auth', 'middleware', 'nodejs'],
      'mobile': ['react-native', 'flutter', 'mobile', 'ios', 'android'],
      'data': ['database', 'analytics', 'etl', 'pipeline', 'sql', 'nosql']
    };

    return contextMappings[projectContext.toLowerCase()] || [];
  }

  private getContextualExplanation(candidate: any, context: SearchContext): string {
    const explanations: string[] = [];

    if (context.technicalStack?.some(tech => 
      candidate.fullTextContent.includes(tech.toLowerCase())
    )) {
      explanations.push('matches your technical stack');
    }

    if (context.preferredCategories?.includes(candidate.plugin.category)) {
      explanations.push('in your preferred categories');
    }

    if (context.projectContext) {
      explanations.push(`relevant to ${context.projectContext} projects`);
    }

    return explanations.length > 0 
      ? `Plugin ${explanations.join(' and ')}`
      : 'Contextually relevant to your profile';
  }

  private calculateCategoryRelevance(candidate: any, queryTerms: string[]): number {
    const categoryTerms = [
      candidate.plugin.category?.toLowerCase(),
      candidate.plugin.subcategory?.toLowerCase(),
      ...(candidate.plugin.tags || []).map((t: string) => t.toLowerCase())
    ].filter(Boolean);

    const matches = queryTerms.filter(term =>
      categoryTerms.some(catTerm => catTerm.includes(term) || term.includes(catTerm))
    ).length;

    return matches > 0 ? Math.min(matches / queryTerms.length, 1) : 0;
  }

  private generateHighlights(candidate: any, queryTerms: string[]): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];
    const fields = candidate.searchableFields;

    // Generate highlights for different fields
    for (const [fieldName, fieldContent] of Object.entries(fields)) {
      if (typeof fieldContent === 'string' && fieldContent.length > 0) {
        const fieldHighlights = this.generateFieldHighlights(
          fieldName as any,
          fieldContent,
          queryTerms
        );
        highlights.push(...fieldHighlights);
      } else if (Array.isArray(fieldContent)) {
        const arrayContent = fieldContent.join(' ');
        if (arrayContent.length > 0) {
          const fieldHighlights = this.generateFieldHighlights(
            fieldName as any,
            arrayContent,
            queryTerms
          );
          highlights.push(...fieldHighlights);
        }
      }
    }

    // Sort highlights by confidence and limit
    return highlights
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }

  private generateFieldHighlights(
    field: 'name' | 'description' | 'readme' | 'keywords' | 'category',
    content: string,
    queryTerms: string[]
  ): SearchHighlight[] {
    const highlights: SearchHighlight[] = [];
    const lowerContent = content.toLowerCase();

    for (const term of queryTerms) {
      const termLower = term.toLowerCase();
      const index = lowerContent.indexOf(termLower);

      if (index !== -1) {
        // Extract snippet around the match
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + term.length + 50);
        const snippet = content.substring(start, end);

        // Determine match type
        let matchType: SearchHighlight['matchType'] = 'partial';
        if (lowerContent.includes(termLower)) {
          matchType = content.toLowerCase() === termLower ? 'exact' : 'partial';
        }

        // Calculate confidence based on field type and match quality
        let confidence = 0.5;
        if (field === 'name' || field === 'category') confidence = 0.9;
        else if (field === 'description') confidence = 0.8;
        else if (field === 'keywords') confidence = 0.85;
        else if (field === 'readme') confidence = 0.6;

        if (matchType === 'exact') confidence += 0.1;

        highlights.push({
          field,
          snippet: this.highlightTerm(snippet, term),
          matchType,
          confidence: Math.min(1, confidence)
        });
      }
    }

    return highlights;
  }

  private highlightTerm(text: string, term: string): string {
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  async getSearchSuggestions(
    partialQuery: string,
    context?: SearchContext,
    limit: number = 10
  ): Promise<string[]> {
    const suggestions: Set<string> = new Set();

    // Get suggestions from plugin names
    for (const [_, indexData] of this.searchIndex.entries()) {
      const { plugin, searchableFields } = indexData;

      if (plugin.name.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.add(plugin.name);
      }

      if (plugin.displayName.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.add(plugin.displayName);
      }

      // Add category suggestions
      if (plugin.category.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.add(plugin.category.toLowerCase().replace(/_/g, ' '));
      }

      // Add keyword suggestions
      for (const keyword of plugin.keywords || []) {
        if (keyword.toLowerCase().includes(partialQuery.toLowerCase())) {
          suggestions.add(keyword);
        }
      }

      if (suggestions.size >= limit * 2) break;
    }

    // Add synonym suggestions
    for (const [key, synonyms] of this.synonymMaps.entries()) {
      if (key.includes(partialQuery.toLowerCase())) {
        suggestions.add(key);
        synonyms.forEach(syn => suggestions.add(syn));
      }
    }

    // Sort by relevance (length-based for simplicity)
    return Array.from(suggestions)
      .sort((a, b) => {
        const aDistance = Math.abs(a.length - partialQuery.length);
        const bDistance = Math.abs(b.length - partialQuery.length);
        return aDistance - bDistance;
      })
      .slice(0, limit);
  }

  async getPopularQueries(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<string[]> {
    // In a real implementation, this would aggregate search logs
    // For now, return mock popular queries
    return [
      'kubernetes deployment',
      'ci cd pipeline',
      'monitoring dashboard',
      'authentication oauth',
      'database migration',
      'docker containerization',
      'api documentation',
      'security scanning',
      'performance monitoring',
      'code quality'
    ];
  }

  async getTrendingSearches(): Promise<{ query: string; growth: number }[]> {
    // Mock trending searches with growth percentages
    return [
      { query: 'ai code review', growth: 156 },
      { query: 'container security', growth: 89 },
      { query: 'microservice mesh', growth: 67 },
      { query: 'automated testing', growth: 45 },
      { query: 'cloud migration', growth: 34 }
    ];
  }

  async indexPlugin(plugin: any) {
    const searchableFields = this.extractSearchableFields(plugin);
    this.searchIndex.set(plugin.id, {
      plugin,
      searchableFields,
      fullTextContent: this.buildFullTextContent(plugin, searchableFields),
      lastUpdated: new Date()
    });

    // Generate embedding
    const embedding = this.generateSimpleEmbedding(this.buildFullTextContent(plugin, searchableFields));
    this.semanticEmbeddings.set(plugin.id, embedding);

    // Update popularity score
    this.updatePluginPopularity(plugin);

    console.log(`Indexed plugin: ${plugin.name}`);
    this.emit('plugin_indexed', { pluginId: plugin.id, name: plugin.name });
  }

  async removeFromIndex(pluginId: string) {
    this.searchIndex.delete(pluginId);
    this.semanticEmbeddings.delete(pluginId);
    this.popularityScores.delete(pluginId);

    console.log(`Removed plugin from index: ${pluginId}`);
    this.emit('plugin_removed', { pluginId });
  }

  private updatePluginPopularity(plugin: any) {
    // Recalculate popularity score for updated plugin
    let score = 0;

    // This would use the same logic as calculatePopularityScores
    // but for a single plugin
    score += (plugin.downloadCount || 0) / 100000 * 0.4; // Normalize to reasonable scale
    score += (plugin.starCount || 0) / 10000 * 0.3;
    
    const daysSinceUpdate = (Date.now() - new Date(plugin.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 1 - daysSinceUpdate / 365) * 0.3;

    this.popularityScores.set(plugin.id, Math.min(1, score));
  }

  async getSearchAnalytics(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    // In production, this would query analytics data
    return {
      totalSearches: 15420,
      uniqueUsers: 3240,
      averageResultsPerQuery: 8.3,
      clickThroughRate: 0.67,
      zeroResultQueries: 156,
      topQueries: await this.getPopularQueries(timeframe),
      trending: await this.getTrendingSearches(),
      categoryDistribution: {
        'CI/CD': 28,
        'Monitoring': 22,
        'Security': 18,
        'Documentation': 12,
        'Database': 10,
        'Other': 10
      }
    };
  }
}

// Export singleton instance
export const semanticSearchService = new SemanticSearchService();