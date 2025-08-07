import { OpenAI } from 'openai';
import * as tf from '@tensorflow/tfjs-node';
import natural from 'natural';
import { Redis } from 'ioredis';
import { VectorDBManager, VectorDocument, SearchOptions } from './vector-db-service';
import { logger } from '../monitoring/logger';

interface SearchIntent {
  type: 'navigation' | 'discovery' | 'troubleshooting' | 'learning' | 'comparison';
  entities: string[];
  filters: Record<string, any>;
  timeframe?: { start: Date; end: Date };
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface SearchContext {
  userId: string;
  sessionId: string;
  previousQueries: string[];
  clickedResults: string[];
  userRole: string;
  team?: string;
  preferences: Record<string, any>;
}

interface EnhancedSearchResult extends VectorDocument {
  relevanceScore: number;
  explanation: string;
  suggestedActions?: string[];
  relatedEntities?: string[];
  contextualInsights?: string[];
}

export class SemanticSearchEngine {
  private openai: OpenAI;
  private vectorDB: VectorDBManager;
  private redis: Redis;
  private tokenizer: any;
  private sentimentAnalyzer: any;
  private entityExtractor: any;
  private intentClassifier?: tf.LayersModel;

  constructor(
    vectorDB: VectorDBManager,
    openaiApiKey: string,
    redisUrl?: string
  ) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.vectorDB = vectorDB;
    this.redis = new Redis(redisUrl || 'redis://localhost:6379');
    
    // Initialize NLP components
    this.tokenizer = new natural.WordTokenizer();
    this.sentimentAnalyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
    this.entityExtractor = new natural.BayesClassifier();
    
    this.initializeNLP();
  }

  private async initializeNLP() {
    // Load or train intent classifier model
    await this.loadIntentClassifier();
    
    // Train entity extractor with sample data
    this.trainEntityExtractor();
  }

  private async loadIntentClassifier() {
    try {
      // Try to load existing model
      this.intentClassifier = await tf.loadLayersModel('file://./models/intent-classifier/model.json');
    } catch (error) {
      // Create and train new model if not exists
      this.intentClassifier = await this.createIntentClassifierModel();
    }
  }

  private async createIntentClassifierModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.embedding({ inputDim: 10000, outputDim: 128, inputLength: 50 }),
        tf.layers.lstm({ units: 64, returnSequences: false }),
        tf.layers.dropout({ rate: 0.5 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 5, activation: 'softmax' }) // 5 intent types
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  private trainEntityExtractor() {
    // Training data for entity extraction
    const trainingData = [
      { text: 'user authentication service', entities: ['authentication', 'service'] },
      { text: 'kubernetes deployment pipeline', entities: ['kubernetes', 'deployment', 'pipeline'] },
      { text: 'database connection pool', entities: ['database', 'connection'] },
      { text: 'api gateway configuration', entities: ['api', 'gateway', 'configuration'] },
      { text: 'monitoring dashboard metrics', entities: ['monitoring', 'dashboard', 'metrics'] }
    ];

    trainingData.forEach(item => {
      this.entityExtractor.addDocument(item.text, item.entities.join(','));
    });

    this.entityExtractor.train();
  }

  // Main semantic search method
  async search(
    query: string,
    context: SearchContext,
    options?: SearchOptions
  ): Promise<EnhancedSearchResult[]> {
    try {
      // 1. Analyze query intent
      const intent = await this.analyzeIntent(query, context);
      
      // 2. Extract entities and expand query
      const expandedQuery = await this.expandQuery(query, intent);
      
      // 3. Generate embeddings with context
      const contextualEmbedding = await this.generateContextualEmbedding(
        expandedQuery,
        context
      );
      
      // 4. Perform vector search
      const searchOptions: SearchOptions = {
        ...options,
        filter: this.buildFilters(intent, context),
        userContext: {
          userId: context.userId,
          team: context.team,
          recentSearches: context.previousQueries,
          preferences: context.preferences
        }
      };
      
      const results = await this.vectorDB.search(expandedQuery, searchOptions);
      
      // 5. Re-rank results based on context
      const rerankedResults = await this.rerank(results, query, context, intent);
      
      // 6. Enhance results with explanations
      const enhancedResults = await this.enhanceResults(
        rerankedResults,
        query,
        context,
        intent
      );
      
      // 7. Log search for analytics
      await this.logSearch(query, context, enhancedResults);
      
      return enhancedResults;
    } catch (error) {
      logger.error('Semantic search failed', error);
      throw error;
    }
  }

  private async analyzeIntent(
    query: string,
    context: SearchContext
  ): Promise<SearchIntent> {
    const tokens = this.tokenizer.tokenize(query.toLowerCase());
    const sentiment = this.sentimentAnalyzer.getSentiment(tokens);
    
    // Use GPT for intent analysis
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Analyze the search query intent and extract entities. Return JSON only.'
        },
        {
          role: 'user',
          content: `Query: "${query}"
Context: User role: ${context.userRole}, Team: ${context.team}
Previous queries: ${context.previousQueries.slice(-3).join(', ')}

Identify:
1. Intent type (navigation/discovery/troubleshooting/learning/comparison)
2. Key entities mentioned
3. Any time constraints
4. Implicit filters based on context`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 200
    });

    const analysis = JSON.parse(completion.choices[0].message.content || '{}');
    
    return {
      type: analysis.intent || 'discovery',
      entities: analysis.entities || [],
      filters: analysis.filters || {},
      timeframe: analysis.timeframe,
      sentiment: sentiment > 0 ? 'positive' : sentiment < 0 ? 'negative' : 'neutral'
    };
  }

  private async expandQuery(query: string, intent: SearchIntent): Promise<string> {
    // Use GPT to expand query with synonyms and related terms
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Expand the search query with relevant synonyms and related technical terms. Be concise.'
        },
        {
          role: 'user',
          content: `Original query: "${query}"
Intent: ${intent.type}
Entities: ${intent.entities.join(', ')}

Provide an expanded query that includes synonyms and related terms.`
        }
      ],
      temperature: 0.5,
      max_tokens: 100
    });

    return completion.choices[0].message.content || query;
  }

  private async generateContextualEmbedding(
    query: string,
    context: SearchContext
  ): Promise<number[]> {
    // Combine query with context for more relevant embeddings
    const contextualQuery = `${query} [Context: Role: ${context.userRole}, Team: ${context.team || 'none'}]`;
    
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: contextualQuery
    });

    return response.data[0].embedding;
  }

  private buildFilters(
    intent: SearchIntent,
    context: SearchContext
  ): Record<string, any> {
    const filters: Record<string, any> = {};

    // Add intent-based filters
    if (intent.filters) {
      Object.assign(filters, intent.filters);
    }

    // Add context-based filters
    if (context.team) {
      filters.team = context.team;
    }

    // Add time-based filters
    if (intent.timeframe) {
      filters.lastModified = {
        $gte: intent.timeframe.start,
        $lte: intent.timeframe.end
      };
    }

    return filters;
  }

  private async rerank(
    results: VectorDocument[],
    query: string,
    context: SearchContext,
    intent: SearchIntent
  ): Promise<VectorDocument[]> {
    // Use GPT for reranking based on relevance
    if (results.length === 0) return results;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Rerank search results based on relevance to the query and user context. Return ordered IDs.'
        },
        {
          role: 'user',
          content: `Query: "${query}"
User Role: ${context.userRole}
Intent: ${intent.type}
Results to rank:
${results.slice(0, 20).map((r, i) => `${i + 1}. [${r.id}] ${r.metadata.title}: ${r.metadata.description?.substring(0, 100)}`).join('\n')}

Return the IDs in order of relevance (most relevant first).`
        }
      ],
      temperature: 0.2,
      max_tokens: 200
    });

    const rankedIds = completion.choices[0].message.content
      ?.match(/\[([^\]]+)\]/g)
      ?.map(id => id.slice(1, -1)) || [];

    // Reorder results based on GPT ranking
    const reranked = [];
    const remaining = [...results];
    
    for (const id of rankedIds) {
      const index = remaining.findIndex(r => r.id === id);
      if (index !== -1) {
        reranked.push(remaining.splice(index, 1)[0]);
      }
    }
    
    // Add any remaining results
    reranked.push(...remaining);
    
    return reranked;
  }

  private async enhanceResults(
    results: VectorDocument[],
    query: string,
    context: SearchContext,
    intent: SearchIntent
  ): Promise<EnhancedSearchResult[]> {
    const enhanced = await Promise.all(
      results.slice(0, 10).map(async (result, index) => {
        // Generate explanation for why this result is relevant
        const explanation = await this.generateExplanation(result, query, intent);
        
        // Calculate final relevance score
        const relevanceScore = this.calculateRelevanceScore(
          result,
          query,
          context,
          intent,
          index
        );
        
        // Get related entities
        const relatedEntities = await this.getRelatedEntities(result);
        
        // Generate suggested actions
        const suggestedActions = this.generateSuggestedActions(result, intent);
        
        // Generate contextual insights
        const contextualInsights = await this.generateContextualInsights(
          result,
          context
        );

        return {
          ...result,
          relevanceScore,
          explanation,
          suggestedActions,
          relatedEntities,
          contextualInsights
        };
      })
    );

    return enhanced;
  }

  private async generateExplanation(
    result: VectorDocument,
    query: string,
    intent: SearchIntent
  ): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Explain in one sentence why this search result is relevant to the query.'
        },
        {
          role: 'user',
          content: `Query: "${query}"
Intent: ${intent.type}
Result: ${result.metadata.title} - ${result.metadata.description}
Type: ${result.metadata.type}`
        }
      ],
      temperature: 0.3,
      max_tokens: 50
    });

    return completion.choices[0].message.content || 'Relevant to your search query';
  }

  private calculateRelevanceScore(
    result: VectorDocument,
    query: string,
    context: SearchContext,
    intent: SearchIntent,
    position: number
  ): number {
    let score = result.metadata.score || 0.5;
    
    // Boost based on entity match
    const queryLower = query.toLowerCase();
    const titleLower = result.metadata.title.toLowerCase();
    
    if (titleLower.includes(queryLower)) {
      score += 0.2;
    }
    
    // Boost based on user's team ownership
    if (result.metadata.owner === context.team) {
      score += 0.1;
    }
    
    // Boost recent items for certain intents
    if (intent.type === 'troubleshooting' && result.metadata.lastModified) {
      const daysSinceModified = (Date.now() - new Date(result.metadata.lastModified).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceModified < 7) {
        score += 0.15;
      }
    }
    
    // Position penalty
    score -= position * 0.02;
    
    return Math.min(1, Math.max(0, score));
  }

  private async getRelatedEntities(result: VectorDocument): Promise<string[]> {
    // Get similar documents
    const similar = await this.vectorDB.similarity(result.id, 5);
    
    const relatedTypes = new Set<string>();
    similar.forEach(doc => {
      if (doc.metadata.type !== result.metadata.type) {
        relatedTypes.add(`${doc.metadata.type}:${doc.metadata.title}`);
      }
    });
    
    return Array.from(relatedTypes).slice(0, 3);
  }

  private generateSuggestedActions(
    result: VectorDocument,
    intent: SearchIntent
  ): string[] {
    const actions: string[] = [];
    
    switch (result.metadata.type) {
      case 'service':
        actions.push('View Service Details', 'Check Health Status', 'View Dependencies');
        if (intent.type === 'troubleshooting') {
          actions.push('View Logs', 'Check Recent Incidents');
        }
        break;
      case 'api':
        actions.push('View API Documentation', 'Try in API Explorer', 'View Usage Metrics');
        break;
      case 'template':
        actions.push('Use Template', 'View Template Details', 'Clone and Customize');
        break;
      case 'documentation':
        actions.push('Read Full Documentation', 'View Related Docs', 'Suggest Edit');
        break;
      case 'plugin':
        actions.push('Install Plugin', 'View Configuration', 'Check Compatibility');
        break;
    }
    
    return actions;
  }

  private async generateContextualInsights(
    result: VectorDocument,
    context: SearchContext
  ): Promise<string[]> {
    const insights: string[] = [];
    
    // Add usage insights
    const usageKey = `usage:${result.id}:${context.team || 'all'}`;
    const usageCount = await this.redis.get(usageKey);
    
    if (usageCount) {
      insights.push(`Used ${usageCount} times by your team this month`);
    }
    
    // Add ownership insights
    if (result.metadata.owner === context.team) {
      insights.push('Owned by your team');
    }
    
    // Add freshness insights
    if (result.metadata.lastModified) {
      const daysSinceModified = Math.floor(
        (Date.now() - new Date(result.metadata.lastModified).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceModified === 0) {
        insights.push('Updated today');
      } else if (daysSinceModified < 7) {
        insights.push(`Updated ${daysSinceModified} days ago`);
      }
    }
    
    return insights;
  }

  private async logSearch(
    query: string,
    context: SearchContext,
    results: EnhancedSearchResult[]
  ) {
    const searchLog = {
      timestamp: new Date(),
      query,
      userId: context.userId,
      sessionId: context.sessionId,
      team: context.team,
      resultCount: results.length,
      topResults: results.slice(0, 3).map(r => ({
        id: r.id,
        title: r.metadata.title,
        type: r.metadata.type,
        score: r.relevanceScore
      }))
    };
    
    // Store in Redis for analytics
    await this.redis.lpush('search:logs', JSON.stringify(searchLog));
    await this.redis.ltrim('search:logs', 0, 10000); // Keep last 10k searches
    
    // Update user search history
    await this.redis.lpush(`user:${context.userId}:searches`, query);
    await this.redis.ltrim(`user:${context.userId}:searches`, 0, 100);
  }

  // Auto-complete suggestions
  async getSuggestions(
    partial: string,
    context: SearchContext,
    limit: number = 5
  ): Promise<string[]> {
    // Get user's recent searches
    const recentSearches = await this.redis.lrange(
      `user:${context.userId}:searches`,
      0,
      20
    );
    
    // Get popular searches
    const popularSearches = await this.redis.zrevrange(
      'search:popular',
      0,
      50,
      'WITHSCORES'
    );
    
    // Combine and filter
    const allSuggestions = new Set<string>();
    
    recentSearches
      .filter(s => s.toLowerCase().startsWith(partial.toLowerCase()))
      .forEach(s => allSuggestions.add(s));
    
    for (let i = 0; i < popularSearches.length; i += 2) {
      const search = popularSearches[i];
      if (search.toLowerCase().startsWith(partial.toLowerCase())) {
        allSuggestions.add(search);
      }
    }
    
    // Use GPT to generate additional suggestions
    if (allSuggestions.size < limit) {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Generate search query suggestions for a developer portal. Be concise and technical.'
          },
          {
            role: 'user',
            content: `Partial query: "${partial}"
User role: ${context.userRole}
Generate ${limit - allSuggestions.size} relevant search suggestions.`
          }
        ],
        temperature: 0.7,
        max_tokens: 100
      });
      
      const suggestions = completion.choices[0].message.content
        ?.split('\n')
        .filter(s => s.trim())
        .forEach(s => allSuggestions.add(s.trim()));
    }
    
    return Array.from(allSuggestions).slice(0, limit);
  }
}