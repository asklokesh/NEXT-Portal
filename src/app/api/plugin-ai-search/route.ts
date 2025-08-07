import { NextRequest, NextResponse } from 'next/server';

// Mock embedding service - in production, integrate with OpenAI, Cohere, or similar
class EmbeddingService {
  private static instance: EmbeddingService;
  private embeddings: Map<string, number[]> = new Map();

  static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  // Generate semantic embeddings for plugin content
  async generateEmbedding(text: string): Promise<number[]> {
    // Simple hash-based embedding for demo - replace with real embeddings
    const hash = this.simpleHash(text.toLowerCase());
    const embedding = Array.from({ length: 384 }, (_, i) => 
      Math.sin(hash + i * 0.1) * Math.cos(hash + i * 0.2)
    );
    return embedding;
  }

  // Calculate cosine similarity between embeddings
  cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

// Natural Language Processing Service
class NLPService {
  private static instance: NLPService;

  static getInstance(): NLPService {
    if (!NLPService.instance) {
      NLPService.instance = new NLPService();
    }
    return NLPService.instance;
  }

  // Extract intent from natural language query
  extractIntent(query: string): {
    intent: 'search' | 'recommend' | 'compare' | 'install' | 'configure';
    entities: string[];
    category?: string;
    confidence: number;
  } {
    const lowerQuery = query.toLowerCase();
    
    // Intent detection patterns
    const intentPatterns = {
      install: /\b(install|add|setup|enable)\b/,
      configure: /\b(configure|setup|config|setting)\b/,
      recommend: /\b(recommend|suggest|best|good|popular)\b/,
      compare: /\b(compare|vs|versus|difference|better)\b/,
      search: /\b(find|search|look|show|list)\b/
    };

    let detectedIntent: any = 'search';
    let maxConfidence = 0;

    Object.entries(intentPatterns).forEach(([intent, pattern]) => {
      const matches = lowerQuery.match(pattern);
      if (matches) {
        const confidence = matches.length / lowerQuery.split(' ').length;
        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          detectedIntent = intent;
        }
      }
    });

    // Extract entities (plugin names, categories, technologies)
    const entities = this.extractEntities(query);
    
    // Detect category from query
    const category = this.detectCategory(query);

    return {
      intent: detectedIntent,
      entities,
      category,
      confidence: maxConfidence || 0.5
    };
  }

  private extractEntities(query: string): string[] {
    const entities: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Common technology entities
    const techEntities = [
      'kubernetes', 'k8s', 'docker', 'jenkins', 'github', 'gitlab',
      'bitbucket', 'aws', 'azure', 'gcp', 'terraform', 'ansible',
      'prometheus', 'grafana', 'datadog', 'newrelic', 'splunk',
      'jira', 'confluence', 'slack', 'teams', 'pagerduty'
    ];

    techEntities.forEach(entity => {
      if (lowerQuery.includes(entity)) {
        entities.push(entity);
      }
    });

    return entities;
  }

  private detectCategory(query: string): string | undefined {
    const categoryKeywords = {
      'ci-cd': ['ci', 'cd', 'pipeline', 'build', 'deploy', 'jenkins', 'github actions'],
      'monitoring': ['monitor', 'alert', 'metric', 'log', 'observability', 'prometheus', 'grafana'],
      'infrastructure': ['infra', 'cloud', 'kubernetes', 'docker', 'terraform', 'aws', 'azure'],
      'security': ['security', 'vault', 'auth', 'rbac', 'compliance', 'scan'],
      'analytics': ['analytics', 'insights', 'dashboard', 'report', 'metric'],
      'documentation': ['docs', 'documentation', 'wiki', 'knowledge', 'confluence']
    };

    const lowerQuery = query.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        return category;
      }
    }

    return undefined;
  }

  // Generate search suggestions based on query
  generateSuggestions(query: string, plugins: any[]): string[] {
    const suggestions: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Autocomplete suggestions
    plugins.forEach(plugin => {
      if (plugin.title.toLowerCase().includes(lowerQuery) && 
          !suggestions.includes(plugin.title)) {
        suggestions.push(plugin.title);
      }
    });

    // Category suggestions
    const categories = ['CI/CD', 'Monitoring', 'Infrastructure', 'Security', 'Analytics'];
    categories.forEach(category => {
      if (category.toLowerCase().includes(lowerQuery) && 
          !suggestions.includes(`Show ${category} plugins`)) {
        suggestions.push(`Show ${category} plugins`);
      }
    });

    // Intent-based suggestions
    if (lowerQuery.includes('best') || lowerQuery.includes('popular')) {
      suggestions.push('Show most popular plugins');
      suggestions.push('Recommend plugins for my stack');
    }

    return suggestions.slice(0, 5);
  }
}

// Machine Learning Recommendation Engine
class RecommendationEngine {
  private static instance: RecommendationEngine;

  static getInstance(): RecommendationEngine {
    if (!RecommendationEngine.instance) {
      RecommendationEngine.instance = new RecommendationEngine();
    }
    return RecommendationEngine.instance;
  }

  // Generate personalized plugin recommendations
  async generateRecommendations(
    userProfile: any,
    installedPlugins: string[],
    allPlugins: any[],
    limit: number = 5
  ): Promise<any[]> {
    const embeddingService = EmbeddingService.getInstance();
    const recommendations: Array<{ plugin: any; score: number; reason: string }> = [];

    // Content-based filtering using embeddings
    for (const plugin of allPlugins) {
      if (installedPlugins.includes(plugin.id)) continue;

      let score = 0;
      let reasons: string[] = [];

      // Category preference score
      if (userProfile.preferredCategories?.includes(plugin.category)) {
        score += 0.3;
        reasons.push(`matches your ${plugin.category} preferences`);
      }

      // Technology stack compatibility
      const pluginTech = plugin.tags.join(' ').toLowerCase();
      const userTech = (userProfile.technologies || []).join(' ').toLowerCase();
      
      if (userTech && pluginTech) {
        const pluginEmbedding = await embeddingService.generateEmbedding(pluginTech);
        const userEmbedding = await embeddingService.generateEmbedding(userTech);
        const similarity = embeddingService.cosineSimilarity(pluginEmbedding, userEmbedding);
        score += similarity * 0.4;
        
        if (similarity > 0.7) {
          reasons.push('compatible with your tech stack');
        }
      }

      // Popularity score (normalized)
      const maxDownloads = Math.max(...allPlugins.map(p => p.downloads || 0));
      const popularityScore = (plugin.downloads || 0) / maxDownloads;
      score += popularityScore * 0.2;

      if (plugin.downloads > 10000) {
        reasons.push('highly popular in community');
      }

      // Collaborative filtering - similar users
      const collaborativeScore = this.calculateCollaborativeScore(
        userProfile.userId,
        plugin.id,
        installedPlugins
      );
      score += collaborativeScore * 0.1;

      if (collaborativeScore > 0.5) {
        reasons.push('recommended by similar users');
      }

      if (score > 0.1) {
        recommendations.push({
          plugin,
          score,
          reason: reasons.join(', ') || 'general recommendation'
        });
      }
    }

    // Sort by score and return top recommendations
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(rec => ({
        ...rec.plugin,
        recommendationScore: rec.score,
        recommendationReason: rec.reason
      }));
  }

  private calculateCollaborativeScore(
    userId: string,
    pluginId: string,
    userPlugins: string[]
  ): number {
    // Simplified collaborative filtering
    // In production, implement proper matrix factorization or deep learning
    
    // Mock similarity calculation based on common plugins
    const similarUsers = this.findSimilarUsers(userId, userPlugins);
    
    let score = 0;
    let count = 0;
    
    similarUsers.forEach(similarUser => {
      if (similarUser.plugins.includes(pluginId)) {
        score += similarUser.similarity;
        count++;
      }
    });

    return count > 0 ? score / count : 0;
  }

  private findSimilarUsers(userId: string, userPlugins: string[]): Array<{
    userId: string;
    plugins: string[];
    similarity: number;
  }> {
    // Mock similar users data
    // In production, query from user interaction database
    const mockUsers = [
      {
        userId: 'user2',
        plugins: ['@backstage/plugin-kubernetes', '@backstage/plugin-github-actions'],
        similarity: 0.8
      },
      {
        userId: 'user3',
        plugins: ['@roadiehq/backstage-plugin-jira', '@backstage/plugin-jenkins'],
        similarity: 0.6
      }
    ];

    return mockUsers.filter(user => user.userId !== userId);
  }
}

// Search ranking algorithm
class SearchRanker {
  static rankResults(
    query: string,
    results: any[],
    intent: any
  ): any[] {
    return results.map(result => {
      let score = 0;
      const lowerQuery = query.toLowerCase();
      const pluginText = `${result.title} ${result.description} ${result.tags.join(' ')}`.toLowerCase();

      // Exact title match gets highest score
      if (result.title.toLowerCase().includes(lowerQuery)) {
        score += 0.4;
      }

      // Description match
      if (result.description.toLowerCase().includes(lowerQuery)) {
        score += 0.3;
      }

      // Tag match
      const tagMatches = result.tags.filter((tag: string) => 
        tag.toLowerCase().includes(lowerQuery)
      ).length;
      score += (tagMatches / result.tags.length) * 0.2;

      // Intent-based scoring
      if (intent.intent === 'recommend') {
        score += (result.downloads || 0) / 100000; // Boost popular plugins
      }

      // Category match boost
      if (intent.category && result.category === intent.category) {
        score += 0.1;
      }

      return { ...result, searchScore: score };
    }).sort((a, b) => b.searchScore - a.searchScore);
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');
    const userId = searchParams.get('userId') || 'anonymous';
    const mode = searchParams.get('mode') || 'search'; // search, recommend, similar

    // Initialize services
    const nlpService = NLPService.getInstance();
    const embeddingService = EmbeddingService.getInstance();
    const recommendationEngine = RecommendationEngine.getInstance();

    // Fetch base plugin data (in production, from database with caching)
    const pluginsResponse = await fetch(`${req.nextUrl.origin}/api/plugins`, {
      cache: 'force-cache'
    });
    const pluginsData = await pluginsResponse.json();
    const allPlugins = pluginsData.plugins || [];

    // Handle different modes
    if (mode === 'suggest' && query) {
      const suggestions = nlpService.generateSuggestions(query, allPlugins);
      return NextResponse.json({
        suggestions,
        query
      });
    }

    if (mode === 'recommend') {
      // Mock user profile - in production, fetch from user service
      const userProfile = {
        userId,
        preferredCategories: ['ci-cd', 'infrastructure'],
        technologies: ['kubernetes', 'jenkins', 'terraform'],
        installedPlugins: ['@backstage/plugin-kubernetes']
      };

      const recommendations = await recommendationEngine.generateRecommendations(
        userProfile,
        userProfile.installedPlugins,
        allPlugins,
        limit
      );

      return NextResponse.json({
        plugins: recommendations,
        total: recommendations.length,
        mode: 'recommend',
        userProfile: {
          categories: userProfile.preferredCategories,
          technologies: userProfile.technologies
        }
      });
    }

    if (!query) {
      return NextResponse.json({
        plugins: allPlugins.slice(0, limit),
        total: allPlugins.length,
        mode: 'browse'
      });
    }

    // Process natural language query
    const intent = nlpService.extractIntent(query);
    
    // Perform semantic search using embeddings
    const queryEmbedding = await embeddingService.generateEmbedding(query);
    const semanticResults: Array<{ plugin: any; similarity: number }> = [];

    for (const plugin of allPlugins) {
      const pluginContent = `${plugin.title} ${plugin.description} ${plugin.tags.join(' ')}`;
      const pluginEmbedding = await embeddingService.generateEmbedding(pluginContent);
      const similarity = embeddingService.cosineSimilarity(queryEmbedding, pluginEmbedding);
      
      if (similarity > 0.3) { // Threshold for relevance
        semanticResults.push({ plugin, similarity });
      }
    }

    // Combine with traditional keyword search
    const keywordResults = allPlugins.filter(plugin => {
      const searchText = `${plugin.title} ${plugin.description} ${plugin.tags.join(' ')}`.toLowerCase();
      return searchText.includes(query.toLowerCase());
    });

    // Merge and deduplicate results
    const allResults = new Map();
    
    semanticResults.forEach(({ plugin, similarity }) => {
      allResults.set(plugin.id, { ...plugin, semanticScore: similarity });
    });

    keywordResults.forEach(plugin => {
      if (allResults.has(plugin.id)) {
        allResults.set(plugin.id, { ...allResults.get(plugin.id), keywordMatch: true });
      } else {
        allResults.set(plugin.id, { ...plugin, keywordMatch: true, semanticScore: 0 });
      }
    });

    // Apply intent-based filtering
    let filteredResults = Array.from(allResults.values());
    
    if (intent.category) {
      filteredResults = filteredResults.filter(plugin => plugin.category === intent.category);
    }

    // Rank results using hybrid scoring
    const rankedResults = SearchRanker.rankResults(query, filteredResults, intent);

    // Find similar plugins for recommendation
    const similarPlugins = await this.findSimilarPlugins(
      rankedResults.slice(0, 3), // Use top 3 results as seeds
      allPlugins,
      embeddingService,
      3
    );

    return NextResponse.json({
      plugins: rankedResults.slice(0, limit),
      total: rankedResults.length,
      intent,
      query,
      mode: 'search',
      similarPlugins,
      suggestions: nlpService.generateSuggestions(query, allPlugins),
      processingTime: Date.now() - Date.now() // Mock processing time
    });

  } catch (error) {
    console.error('AI search failed:', error);
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Find similar plugins using embeddings
async function findSimilarPlugins(
  seedPlugins: any[],
  allPlugins: any[],
  embeddingService: EmbeddingService,
  limit: number
): Promise<any[]> {
  const similar: Array<{ plugin: any; similarity: number }> = [];

  for (const seed of seedPlugins) {
    const seedContent = `${seed.title} ${seed.description} ${seed.tags.join(' ')}`;
    const seedEmbedding = await embeddingService.generateEmbedding(seedContent);

    for (const plugin of allPlugins) {
      if (plugin.id === seed.id) continue;

      const pluginContent = `${plugin.title} ${plugin.description} ${plugin.tags.join(' ')}`;
      const pluginEmbedding = await embeddingService.generateEmbedding(pluginContent);
      const similarity = embeddingService.cosineSimilarity(seedEmbedding, pluginEmbedding);

      if (similarity > 0.5) {
        similar.push({ plugin, similarity });
      }
    }
  }

  return similar
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(item => ({ ...item.plugin, similarityScore: item.similarity }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, query, plugins, userId } = body;

    const nlpService = NLPService.getInstance();
    const recommendationEngine = RecommendationEngine.getInstance();

    switch (action) {
      case 'feedback':
        // Record user feedback for ML model improvement
        console.log('Recording search feedback:', {
          userId,
          query,
          selectedPlugin: body.selectedPlugin,
          rating: body.rating
        });
        
        return NextResponse.json({ 
          success: true,
          message: 'Feedback recorded successfully'
        });

      case 'personalize':
        // Update user preferences based on interaction
        const preferences = {
          categories: body.categories || [],
          technologies: body.technologies || [],
          searchHistory: body.searchHistory || []
        };

        return NextResponse.json({
          success: true,
          message: 'Preferences updated',
          recommendations: await recommendationEngine.generateRecommendations(
            { userId, ...preferences },
            body.installedPlugins || [],
            plugins || [],
            5
          )
        });

      case 'voice-search':
        // Process voice search transcription
        const transcript = body.transcript;
        const intent = nlpService.extractIntent(transcript);
        
        return NextResponse.json({
          success: true,
          transcript,
          intent,
          processedQuery: this.optimizeQueryForSearch(transcript, intent)
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('AI search operation failed:', error);
    return NextResponse.json(
      { error: 'Operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function optimizeQueryForSearch(transcript: string, intent: any): string {
  // Clean up voice transcription for better search results
  let optimized = transcript.toLowerCase()
    .replace(/\b(show me|find me|i want|i need|give me)\b/g, '')
    .replace(/\b(plugin|plugins)\b/g, '')
    .trim();

  // Add category if detected but not mentioned
  if (intent.category && !optimized.includes(intent.category)) {
    optimized += ` ${intent.category}`;
  }

  // Add relevant entities
  intent.entities.forEach((entity: string) => {
    if (!optimized.includes(entity)) {
      optimized += ` ${entity}`;
    }
  });

  return optimized.trim();
}