import { OpenAI } from 'openai';
import * as tf from '@tensorflow/tfjs-node';
import { Redis } from 'ioredis';
import { logger } from '../monitoring/logger';

export interface UserProfile {
  userId: string;
  role: string;
  team: string;
  department: string;
  seniority: 'junior' | 'mid' | 'senior' | 'lead' | 'principal';
  interests: string[];
  skills: string[];
  recentActivities: UserActivity[];
  searchHistory: SearchHistoryItem[];
  preferences: UserPreferences;
}

export interface UserActivity {
  timestamp: Date;
  type: 'view' | 'edit' | 'create' | 'delete' | 'deploy' | 'search';
  entityType: string;
  entityId: string;
  context?: Record<string, any>;
}

export interface SearchHistoryItem {
  query: string;
  timestamp: Date;
  clickedResults: string[];
  dwellTime: number;
  refinements: string[];
  successful: boolean;
}

export interface UserPreferences {
  searchResultsPerPage: number;
  preferredLanguage: string;
  showCodeExamples: boolean;
  complexityLevel: 'beginner' | 'intermediate' | 'advanced';
  notificationSettings: Record<string, boolean>;
}

export interface PersonalizedSuggestion {
  query: string;
  confidence: number;
  reason: string;
  category: 'recent' | 'trending' | 'recommended' | 'contextual';
  metadata?: Record<string, any>;
}

export interface PersonalizationContext {
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: string;
  currentProject?: string;
  recentErrors?: string[];
  activeIncidents?: string[];
}

export class PersonalizationEngine {
  private openai: OpenAI;
  private redis: Redis;
  private userModel?: tf.LayersModel;
  private suggestionModel?: tf.LayersModel;
  private userEmbeddings: Map<string, number[]> = new Map();

  constructor(openaiApiKey: string, redisUrl?: string) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.redis = new Redis(redisUrl || 'redis://localhost:6379');
    this.initializeModels();
  }

  private async initializeModels() {
    try {
      // Load or create user behavior model
      this.userModel = await this.loadOrCreateUserModel();
      
      // Load or create suggestion model
      this.suggestionModel = await this.loadOrCreateSuggestionModel();
      
      logger.info('Personalization models initialized');
    } catch (error) {
      logger.error('Failed to initialize personalization models', error);
    }
  }

  private async loadOrCreateUserModel(): Promise<tf.LayersModel> {
    try {
      return await tf.loadLayersModel('file://./models/user-behavior/model.json');
    } catch {
      // Create new model for user behavior prediction
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [100], units: 128, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 10, activation: 'softmax' }) // 10 behavior categories
        ]
      });

      model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      return model;
    }
  }

  private async loadOrCreateSuggestionModel(): Promise<tf.LayersModel> {
    try {
      return await tf.loadLayersModel('file://./models/suggestion/model.json');
    } catch {
      // Create new model for suggestion ranking
      const model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [200], units: 256, activation: 'relu' }),
          tf.layers.batchNormalization(),
          tf.layers.dropout({ rate: 0.4 }),
          tf.layers.dense({ units: 128, activation: 'relu' }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Relevance score
        ]
      });

      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });

      return model;
    }
  }

  // Get personalized search suggestions
  async getPersonalizedSuggestions(
    userProfile: UserProfile,
    partialQuery: string,
    context: PersonalizationContext,
    limit: number = 10
  ): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];

    // 1. Get recent searches
    const recentSuggestions = await this.getRecentSearchSuggestions(
      userProfile,
      partialQuery
    );
    suggestions.push(...recentSuggestions);

    // 2. Get contextual suggestions based on current activity
    const contextualSuggestions = await this.getContextualSuggestions(
      userProfile,
      context,
      partialQuery
    );
    suggestions.push(...contextualSuggestions);

    // 3. Get trending suggestions from team/org
    const trendingSuggestions = await this.getTrendingSuggestions(
      userProfile.team,
      partialQuery
    );
    suggestions.push(...trendingSuggestions);

    // 4. Get AI-recommended suggestions
    const aiSuggestions = await this.getAISuggestions(
      userProfile,
      partialQuery,
      context
    );
    suggestions.push(...aiSuggestions);

    // 5. Rank and deduplicate suggestions
    const rankedSuggestions = await this.rankSuggestions(
      suggestions,
      userProfile,
      context
    );

    return rankedSuggestions.slice(0, limit);
  }

  private async getRecentSearchSuggestions(
    userProfile: UserProfile,
    partialQuery: string
  ): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];
    const queryLower = partialQuery.toLowerCase();

    // Filter recent searches that match the partial query
    userProfile.searchHistory
      .filter(item => 
        item.query.toLowerCase().startsWith(queryLower) &&
        item.successful
      )
      .slice(0, 5)
      .forEach(item => {
        suggestions.push({
          query: item.query,
          confidence: 0.9,
          reason: 'Recently searched',
          category: 'recent',
          metadata: {
            lastSearched: item.timestamp,
            clickedResults: item.clickedResults.length
          }
        });
      });

    return suggestions;
  }

  private async getContextualSuggestions(
    userProfile: UserProfile,
    context: PersonalizationContext,
    partialQuery: string
  ): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];

    // Time-based suggestions
    if (context.timeOfDay === 'morning') {
      suggestions.push(...this.getMorningSuggestions(userProfile, partialQuery));
    }

    // Error-based suggestions
    if (context.recentErrors && context.recentErrors.length > 0) {
      const errorSuggestions = await this.getErrorRelatedSuggestions(
        context.recentErrors,
        partialQuery
      );
      suggestions.push(...errorSuggestions);
    }

    // Incident-based suggestions
    if (context.activeIncidents && context.activeIncidents.length > 0) {
      const incidentSuggestions = await this.getIncidentRelatedSuggestions(
        context.activeIncidents,
        partialQuery
      );
      suggestions.push(...incidentSuggestions);
    }

    // Project-based suggestions
    if (context.currentProject) {
      const projectSuggestions = await this.getProjectRelatedSuggestions(
        context.currentProject,
        partialQuery
      );
      suggestions.push(...projectSuggestions);
    }

    return suggestions;
  }

  private getMorningSuggestions(
    userProfile: UserProfile,
    partialQuery: string
  ): PersonalizedSuggestion[] {
    const morningSuggestions = [
      'dashboard overview',
      'overnight incidents',
      'deployment status',
      'team standup notes',
      'service health check'
    ];

    return morningSuggestions
      .filter(s => s.startsWith(partialQuery.toLowerCase()))
      .map(s => ({
        query: s,
        confidence: 0.7,
        reason: 'Common morning activity',
        category: 'contextual' as const
      }));
  }

  private async getErrorRelatedSuggestions(
    errors: string[],
    partialQuery: string
  ): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];
    
    // Use GPT to generate error-related search suggestions
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'Generate search suggestions for debugging errors. Be specific and technical.'
        },
        {
          role: 'user',
          content: `Recent errors: ${errors.slice(0, 3).join(', ')}
Partial query: "${partialQuery}"
Generate 3 relevant search suggestions.`
        }
      ],
      temperature: 0.7,
      max_tokens: 100
    });

    const generatedSuggestions = completion.choices[0].message.content
      ?.split('\n')
      .filter(s => s.trim())
      .slice(0, 3) || [];

    generatedSuggestions.forEach(suggestion => {
      suggestions.push({
        query: suggestion.trim(),
        confidence: 0.8,
        reason: 'Related to recent errors',
        category: 'contextual',
        metadata: { errors: errors.slice(0, 3) }
      });
    });

    return suggestions;
  }

  private async getIncidentRelatedSuggestions(
    incidents: string[],
    partialQuery: string
  ): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];
    
    incidents.forEach(incident => {
      if (incident.toLowerCase().includes(partialQuery.toLowerCase())) {
        suggestions.push({
          query: `incident ${incident}`,
          confidence: 0.85,
          reason: 'Active incident',
          category: 'contextual',
          metadata: { incident }
        });
      }
    });

    return suggestions;
  }

  private async getProjectRelatedSuggestions(
    project: string,
    partialQuery: string
  ): Promise<PersonalizedSuggestion[]> {
    const projectKey = `project:${project}:searches`;
    const projectSearches = await this.redis.lrange(projectKey, 0, 20);
    
    return projectSearches
      .filter(s => s.toLowerCase().startsWith(partialQuery.toLowerCase()))
      .slice(0, 3)
      .map(s => ({
        query: s,
        confidence: 0.75,
        reason: `Popular in ${project}`,
        category: 'contextual' as const,
        metadata: { project }
      }));
  }

  private async getTrendingSuggestions(
    team: string,
    partialQuery: string
  ): Promise<PersonalizedSuggestion[]> {
    const suggestions: PersonalizedSuggestion[] = [];
    
    // Get trending searches for the team
    const trendingKey = `trending:${team}:searches`;
    const trending = await this.redis.zrevrange(trendingKey, 0, 50, 'WITHSCORES');
    
    for (let i = 0; i < trending.length; i += 2) {
      const query = trending[i];
      const score = parseFloat(trending[i + 1]);
      
      if (query.toLowerCase().startsWith(partialQuery.toLowerCase())) {
        suggestions.push({
          query,
          confidence: Math.min(0.9, score / 100),
          reason: 'Trending in your team',
          category: 'trending',
          metadata: { trendScore: score }
        });
      }
    }

    return suggestions.slice(0, 5);
  }

  private async getAISuggestions(
    userProfile: UserProfile,
    partialQuery: string,
    context: PersonalizationContext
  ): Promise<PersonalizedSuggestion[]> {
    // Use GPT to generate personalized suggestions
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'Generate personalized search suggestions for a developer portal user.'
        },
        {
          role: 'user',
          content: `User Profile:
- Role: ${userProfile.role}
- Team: ${userProfile.team}
- Seniority: ${userProfile.seniority}
- Skills: ${userProfile.skills.slice(0, 5).join(', ')}
- Interests: ${userProfile.interests.slice(0, 5).join(', ')}

Context:
- Time: ${context.timeOfDay}
- Day: ${context.dayOfWeek}
- Current Project: ${context.currentProject || 'none'}

Partial Query: "${partialQuery}"

Generate 5 highly relevant search suggestions that would be useful for this user.`
        }
      ],
      temperature: 0.8,
      max_tokens: 200
    });

    const suggestions: PersonalizedSuggestion[] = [];
    const generatedSuggestions = completion.choices[0].message.content
      ?.split('\n')
      .filter(s => s.trim()) || [];

    generatedSuggestions.forEach((suggestion, index) => {
      suggestions.push({
        query: suggestion.trim().replace(/^\d+\.\s*/, ''),
        confidence: 0.85 - (index * 0.05),
        reason: 'AI recommended based on your profile',
        category: 'recommended',
        metadata: {
          model: 'gpt-4',
          userRole: userProfile.role,
          userTeam: userProfile.team
        }
      });
    });

    return suggestions;
  }

  private async rankSuggestions(
    suggestions: PersonalizedSuggestion[],
    userProfile: UserProfile,
    context: PersonalizationContext
  ): Promise<PersonalizedSuggestion[]> {
    // Remove duplicates
    const uniqueSuggestions = new Map<string, PersonalizedSuggestion>();
    suggestions.forEach(s => {
      const key = s.query.toLowerCase();
      if (!uniqueSuggestions.has(key) || uniqueSuggestions.get(key)!.confidence < s.confidence) {
        uniqueSuggestions.set(key, s);
      }
    });

    // Convert back to array and sort by confidence
    const ranked = Array.from(uniqueSuggestions.values());
    
    // Apply personalization factors
    ranked.forEach(suggestion => {
      // Boost recent searches
      if (suggestion.category === 'recent') {
        suggestion.confidence *= 1.2;
      }
      
      // Boost contextual suggestions during incidents
      if (suggestion.category === 'contextual' && context.activeIncidents?.length) {
        suggestion.confidence *= 1.15;
      }
      
      // Boost trending suggestions for junior developers
      if (suggestion.category === 'trending' && userProfile.seniority === 'junior') {
        suggestion.confidence *= 1.1;
      }
      
      // Normalize confidence to 0-1
      suggestion.confidence = Math.min(1, suggestion.confidence);
    });

    // Sort by confidence
    ranked.sort((a, b) => b.confidence - a.confidence);

    return ranked;
  }

  // Learn from user interactions
  async learnFromInteraction(
    userId: string,
    query: string,
    clickedResult: string,
    dwellTime: number,
    position: number
  ) {
    // Store interaction data
    const interaction = {
      userId,
      query,
      clickedResult,
      dwellTime,
      position,
      timestamp: new Date()
    };

    await this.redis.lpush(`user:${userId}:interactions`, JSON.stringify(interaction));
    await this.redis.ltrim(`user:${userId}:interactions`, 0, 1000);

    // Update search success metrics
    if (dwellTime > 10000) { // More than 10 seconds is considered successful
      await this.redis.zincrby(`user:${userId}:successful_queries`, 1, query);
    }

    // Update team trending searches
    const userProfile = await this.getUserProfile(userId);
    if (userProfile?.team) {
      await this.redis.zincrby(`trending:${userProfile.team}:searches`, 1, query);
    }

    // Train the model periodically (every 100 interactions)
    const interactionCount = await this.redis.llen(`user:${userId}:interactions`);
    if (interactionCount % 100 === 0) {
      await this.trainUserModel(userId);
    }
  }

  private async trainUserModel(userId: string) {
    if (!this.userModel) return;

    try {
      // Get user interactions
      const interactions = await this.redis.lrange(`user:${userId}:interactions`, 0, 500);
      
      if (interactions.length < 50) return; // Need minimum data

      // Prepare training data
      const trainingData = interactions.map(i => JSON.parse(i));
      
      // Convert to tensors (simplified - would need proper feature engineering)
      const features = trainingData.map(d => [
        d.dwellTime,
        d.position,
        d.query.length,
        // Add more features...
      ]);

      const labels = trainingData.map(d => 
        d.dwellTime > 10000 ? 1 : 0 // Binary classification for now
      );

      // Train the model
      const xs = tf.tensor2d(features);
      const ys = tf.tensor2d(labels, [labels.length, 1]);

      await this.userModel.fit(xs, ys, {
        epochs: 10,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            logger.info(`Training epoch ${epoch}: loss = ${logs?.loss}`);
          }
        }
      });

      // Clean up tensors
      xs.dispose();
      ys.dispose();

      // Save the model
      await this.userModel.save('file://./models/user-behavior/model.json');
      
      logger.info(`User model trained for ${userId}`);
    } catch (error) {
      logger.error('Failed to train user model', error);
    }
  }

  private async getUserProfile(userId: string): Promise<UserProfile | null> {
    const profileData = await this.redis.get(`user:${userId}:profile`);
    return profileData ? JSON.parse(profileData) : null;
  }

  // Store user profile
  async updateUserProfile(profile: UserProfile) {
    await this.redis.set(
      `user:${profile.userId}:profile`,
      JSON.stringify(profile),
      'EX',
      86400 // 24 hours
    );

    // Update user embedding for similarity calculations
    const embedding = await this.generateUserEmbedding(profile);
    this.userEmbeddings.set(profile.userId, embedding);
  }

  private async generateUserEmbedding(profile: UserProfile): Promise<number[]> {
    // Generate embedding based on user profile
    const profileText = `
      Role: ${profile.role}
      Team: ${profile.team}
      Seniority: ${profile.seniority}
      Skills: ${profile.skills.join(', ')}
      Interests: ${profile.interests.join(', ')}
    `;

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: profileText
    });

    return response.data[0].embedding;
  }

  // Find similar users for collaborative filtering
  async findSimilarUsers(userId: string, limit: number = 10): Promise<string[]> {
    const userEmbedding = this.userEmbeddings.get(userId);
    if (!userEmbedding) return [];

    const similarities: { userId: string; similarity: number }[] = [];

    this.userEmbeddings.forEach((embedding, otherUserId) => {
      if (otherUserId !== userId) {
        const similarity = this.cosineSimilarity(userEmbedding, embedding);
        similarities.push({ userId: otherUserId, similarity });
      }
    });

    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, limit).map(s => s.userId);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}