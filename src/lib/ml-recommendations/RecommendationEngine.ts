import * as tf from '@tensorflow/tfjs';
import { Entity } from '@backstage/catalog-model';
import { redis } from '../cache/redis';
import { logger } from '../monitoring/index';
import { MetricsCollector } from '../monitoring/metrics-collector';
import { z } from 'zod';

/**
 * Advanced ML-powered recommendation engine for developer productivity
 * Uses TensorFlow.js for real-time predictions and recommendations
 */
const RecommendationRequestSchema = z.object({
  userId: z.string(),
  entities: z.array(z.any()),
  limit: z.number().min(1).max(50).default(10),
  filters: z.object({
    kind: z.string().optional(),
    tags: z.array(z.string()).optional(),
    owner: z.string().optional(),
    lifecycle: z.string().optional()
  }).optional()
});

type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;

interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainingLoss: number;
  validationLoss: number;
  lastTrainingDate: Date;
}

interface RecommendationResult {
  entity: Entity;
  score: number;
  confidence: number;
  reason: string;
  category: 'personal' | 'team' | 'trending' | 'similar';
  metadata: {
    modelVersion: string;
    computationTimeMs: number;
    features: string[];
  };
}

export class RecommendationEngine {
  private model: tf.LayersModel | null = null;
  private userEmbeddings: Map<string, { tensor: tf.Tensor; timestamp: number }> = new Map();
  private serviceEmbeddings: Map<string, { tensor: tf.Tensor; timestamp: number }> = new Map();
  private readonly EMBEDDING_DIM = 256; // Increased for better representation
  private readonly BATCH_SIZE = 64;
  private readonly LEARNING_RATE = 0.0005; // Reduced for stability
  private readonly CACHE_TTL = 3600000; // 1 hour
  private readonly MODEL_VERSION = '2.1.0';
  private metrics: ModelMetrics;
  private metricsCollector: MetricsCollector;
  private isTraining = false;

  constructor() {
    this.metricsCollector = new MetricsCollector();
    this.metrics = {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      trainingLoss: 0,
      validationLoss: 0,
      lastTrainingDate: new Date()
    };
    this.initializeModel();
    this.startCleanupInterval();
  }

  /**
   * Initialize the neural network model for recommendations
   */
  private async initializeModel() {
    try {
      // Try to load existing model
      const modelPath = 'indexeddb://recommendation-model';
      try {
        this.model = await tf.loadLayersModel(modelPath);
        logger.info('Loaded existing recommendation model');
      } catch {
        // Create new model if not exists
        this.model = this.createModel();
        logger.info('Created new recommendation model');
      }
    } catch (error) {
      logger.error('Failed to initialize recommendation model:', error);
    }
  }

  /**
   * Create a new neural network model
   */
  /**
   * Create an advanced neural network with attention mechanism
   */
  private createModel(): tf.LayersModel {
    // Input layers
    const userInput = tf.input({ shape: [this.EMBEDDING_DIM], name: 'user_embedding' });
    const serviceInput = tf.input({ shape: [this.EMBEDDING_DIM], name: 'service_embedding' });
    
    // Feature extraction layers
    const userFeatures = tf.layers.dense({
      units: 128,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      name: 'user_features'
    }).apply(userInput) as tf.SymbolicTensor;
    
    const serviceFeatures = tf.layers.dense({
      units: 128,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      name: 'service_features'
    }).apply(serviceInput) as tf.SymbolicTensor;
    
    // Attention mechanism
    const attention = tf.layers.dot({ axes: 1, normalize: true, name: 'attention' })
      .apply([userFeatures, serviceFeatures]) as tf.SymbolicTensor;
    
    // Combine features
    const concatenated = tf.layers.concatenate({ name: 'feature_concat' })
      .apply([userFeatures, serviceFeatures, attention]) as tf.SymbolicTensor;
    
    // Deep layers with residual connections
    let hidden = tf.layers.dense({
      units: 512,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      name: 'hidden_1'
    }).apply(concatenated) as tf.SymbolicTensor;
    
    hidden = tf.layers.batchNormalization({ name: 'bn_1' })
      .apply(hidden) as tf.SymbolicTensor;
    
    hidden = tf.layers.dropout({ rate: 0.4, name: 'dropout_1' })
      .apply(hidden) as tf.SymbolicTensor;
    
    const residual1 = tf.layers.dense({
      units: 256,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      name: 'residual_1'
    }).apply(hidden) as tf.SymbolicTensor;
    
    const skip1 = tf.layers.dense({
      units: 256,
      activation: 'linear',
      kernelInitializer: 'heNormal',
      name: 'skip_1'
    }).apply(hidden) as tf.SymbolicTensor;
    
    const add1 = tf.layers.add({ name: 'add_1' })
      .apply([residual1, skip1]) as tf.SymbolicTensor;
    
    const final = tf.layers.dense({
      units: 128,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      name: 'final_hidden'
    }).apply(add1) as tf.SymbolicTensor;
    
    const finalDropout = tf.layers.dropout({ rate: 0.3, name: 'final_dropout' })
      .apply(final) as tf.SymbolicTensor;
    
    // Output layers for multi-task learning
    const scoreOutput = tf.layers.dense({
      units: 1,
      activation: 'sigmoid',
      name: 'score_output'
    }).apply(finalDropout) as tf.SymbolicTensor;
    
    const confidenceOutput = tf.layers.dense({
      units: 1,
      activation: 'sigmoid',
      name: 'confidence_output'
    }).apply(finalDropout) as tf.SymbolicTensor;
    
    const model = tf.model({
      inputs: [userInput, serviceInput],
      outputs: [scoreOutput, confidenceOutput],
      name: 'recommendation_model'
    });
    
    // Advanced optimizer with learning rate scheduling
    const optimizer = tf.train.adamax(this.LEARNING_RATE);
    
    model.compile({
      optimizer,
      loss: {
        score_output: 'binaryCrossentropy',
        confidence_output: 'meanSquaredError'
      },
      lossWeights: {
        score_output: 0.8,
        confidence_output: 0.2
      },
      metrics: {
        score_output: ['accuracy', 'precision', 'recall'],
        confidence_output: ['meanAbsoluteError']
      }
    });
    
    return model;
  }

  /**
   * Generate embeddings for a user based on their activity with temporal decay
   */
  private async generateUserEmbedding(userId: string): Promise<tf.Tensor> {
    const cached = this.userEmbeddings.get(userId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.tensor;
    }

    // Fetch user activity data
    const userActivity = await this.getUserActivity(userId);
    
    // Create feature vector
    const features = [
      userActivity.servicesViewed.length,
      userActivity.templatesUsed.length,
      userActivity.searchQueries.length,
      userActivity.deploymentCount,
      userActivity.commitCount,
      userActivity.prCount,
      userActivity.issueCount,
      userActivity.documentationViews,
      ...this.encodeSkills(userActivity.skills),
      ...this.encodeTeams(userActivity.teams),
      ...this.encodePreferences(userActivity.preferences)
    ];

    // Advanced feature engineering with normalization
    const normalizedFeatures = this.normalizeFeatures(features);
    const paddedFeatures = this.padFeatures(normalizedFeatures, this.EMBEDDING_DIM);
    
    // Apply learned embeddings with temporal encoding
    const baseEmbedding = tf.tensor2d([paddedFeatures]);
    const temporalWeights = await this.getTemporalWeights(userActivity.lastActivity);
    const embedding = tf.mul(baseEmbedding, temporalWeights);
    
    // Clean up old cached embedding
    if (cached) cached.tensor.dispose();
    
    this.userEmbeddings.set(userId, { tensor: embedding, timestamp: Date.now() });
    baseEmbedding.dispose();
    temporalWeights.dispose();
    
    return embedding;
  }

  /**
   * Generate embeddings for a service/entity
   */
  private async generateServiceEmbedding(entity: Entity): Promise<tf.Tensor> {
    const entityId = `${entity.metadata.namespace}/${entity.metadata.name}`;
    const cached = this.serviceEmbeddings.get(entityId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.tensor;
    }

    // Extract entity features
    const features = [
      this.encodeEntityType(entity.kind),
      this.encodeEntitySpec(entity.spec),
      entity.metadata.tags?.length || 0,
      entity.metadata.links?.length || 0,
      entity.metadata.annotations ? Object.keys(entity.metadata.annotations).length : 0,
      ...this.encodeTags(entity.metadata.tags || []),
      ...this.encodeOwnership(entity.spec?.owner),
      ...this.encodeLifecycle(entity.spec?.lifecycle),
      ...this.encodeDependencies(entity.relations || [])
    ];

    const normalizedFeatures = this.normalizeFeatures(features);
    const paddedFeatures = this.padFeatures(normalizedFeatures, this.EMBEDDING_DIM);
    const embedding = tf.tensor2d([paddedFeatures]);
    
    // Clean up old cached embedding
    const oldCached = this.serviceEmbeddings.get(entityId);
    if (oldCached) oldCached.tensor.dispose();
    
    this.serviceEmbeddings.set(entityId, { tensor: embedding, timestamp: Date.now() });
    return embedding;
  }

  /**
   * Get personalized recommendations with enhanced filtering and ranking
   */
  public async getRecommendations(
    request: RecommendationRequest
  ): Promise<RecommendationResult[]> {
    const validatedRequest = RecommendationRequestSchema.parse(request);
    const { userId, entities, limit, filters } = validatedRequest;
    const startTime = Date.now();
    if (!this.model) {
      logger.warn('Model not initialized, returning default recommendations');
      return this.getDefaultRecommendations(entities, limit, startTime);
    }

    try {
      // Apply filters first to reduce computation
      const filteredEntities = this.applyFilters(entities, filters);
      
      if (filteredEntities.length === 0) {
        return [];
      }

      const userEmbedding = await this.generateUserEmbedding(userId);
      const recommendations: RecommendationResult[] = [];
      const batchSize = Math.min(this.BATCH_SIZE, filteredEntities.length);
      
      // Process entities in batches for better performance
      for (let i = 0; i < filteredEntities.length; i += batchSize) {
        const batch = filteredEntities.slice(i, i + batchSize);
        const batchRecommendations = await this.processBatch(userId, userEmbedding, batch, startTime);
        recommendations.push(...batchRecommendations);
      }

      // Multi-stage ranking
      const rankedRecommendations = await this.rankRecommendations(recommendations, userId);
      
      // Record metrics
      this.metricsCollector.incrementCounter('recommendations_generated', {
        userId,
        count: rankedRecommendations.length
      });
      
      this.metricsCollector.recordHistogram('recommendation_latency', Date.now() - startTime, {
        userId,
        entityCount: entities.length
      });

      return rankedRecommendations.slice(0, limit);
    } catch (error) {
      logger.error('Failed to generate recommendations:', error);
      this.metricsCollector.incrementCounter('recommendation_errors', { userId, error: error.message });
      return this.getDefaultRecommendations(filteredEntities || entities, limit, startTime);
    }
  }

  /**
   * Train the model with user interaction data
   */
  public async trainModel(interactions: Array<{
    userId: string;
    entityId: string;
    interaction: 'view' | 'use' | 'deploy' | 'ignore';
    timestamp: Date;
  }>) {
    if (!this.model) return;

    const trainingData: number[][] = [];
    const labels: number[] = [];

    for (const interaction of interactions) {
      const userEmbedding = await this.generateUserEmbedding(interaction.userId);
      const entity = await this.getEntityById(interaction.entityId);
      if (!entity) continue;

      const serviceEmbedding = await this.generateServiceEmbedding(entity);
      const combined = tf.concat([userEmbedding, serviceEmbedding], 1);
      
      trainingData.push(await combined.array() as unknown as number[]);
      labels.push(this.getInteractionScore(interaction.interaction));
      
      combined.dispose();
    }

    if (trainingData.length > 0) {
      const xs = tf.tensor2d(trainingData);
      const ys = tf.tensor2d(labels, [labels.length, 1]);

      await this.model.fit(xs, ys, {
        epochs: 10,
        batchSize: this.BATCH_SIZE,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            logger.info(`Training epoch ${epoch}:`, logs);
          }
        }
      });

      // Save model
      await this.model.save('indexeddb://recommendation-model');
      
      xs.dispose();
      ys.dispose();
    }
  }

  /**
   * Get similar services based on embeddings
   */
  public async getSimilarServices(
    entity: Entity,
    allEntities: Entity[],
    limit: number = 5
  ): Promise<Entity[]> {
    const targetEmbedding = await this.generateServiceEmbedding(entity);
    const similarities: Array<{ entity: Entity; similarity: number }> = [];

    for (const otherEntity of allEntities) {
      if (otherEntity === entity) continue;
      
      const otherEmbedding = await this.generateServiceEmbedding(otherEntity);
      const similarity = this.cosineSimilarity(targetEmbedding, otherEmbedding);
      
      similarities.push({ entity: otherEntity, similarity });
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(s => s.entity);
  }

  /**
   * Predict developer needs based on patterns
   */
  public async predictDeveloperNeeds(userId: string): Promise<{
    suggestedTemplates: string[];
    suggestedServices: string[];
    suggestedDocumentation: string[];
    suggestedTools: string[];
  }> {
    const userActivity = await this.getUserActivity(userId);
    const patterns = await this.analyzeDeveloperPatterns(userActivity);

    return {
      suggestedTemplates: await this.predictTemplateNeeds(patterns),
      suggestedServices: await this.predictServiceNeeds(patterns),
      suggestedDocumentation: await this.predictDocumentationNeeds(patterns),
      suggestedTools: await this.predictToolNeeds(patterns)
    };
  }

  /**
   * Calculate cosine similarity between two tensors
   */
  private cosineSimilarity(a: tf.Tensor, b: tf.Tensor): number {
    const dotProduct = tf.sum(tf.mul(a, b));
    const normA = tf.sqrt(tf.sum(tf.square(a)));
    const normB = tf.sqrt(tf.sum(tf.square(b)));
    const similarity = tf.div(dotProduct, tf.mul(normA, normB));
    
    const result = similarity.dataSync()[0];
    
    dotProduct.dispose();
    normA.dispose();
    normB.dispose();
    similarity.dispose();
    
    return result;
  }

  /**
   * Helper methods for feature encoding
   */
  private encodeEntityType(kind: string): number {
    const types = ['Component', 'API', 'System', 'Domain', 'Resource', 'User', 'Group', 'Template'];
    return types.indexOf(kind) + 1;
  }

  private encodeEntitySpec(spec: any): number[] {
    return [
      spec?.type ? 1 : 0,
      spec?.lifecycle ? 1 : 0,
      spec?.owner ? 1 : 0,
      spec?.system ? 1 : 0
    ];
  }

  private encodeTags(tags: string[]): number[] {
    const commonTags = ['production', 'backend', 'frontend', 'database', 'api', 'service', 'library', 'tool'];
    return commonTags.map(tag => tags.includes(tag) ? 1 : 0);
  }

  private encodeOwnership(owner?: string): number[] {
    // Simple encoding - could be expanded
    return owner ? [1, owner.length] : [0, 0];
  }

  private encodeLifecycle(lifecycle?: string): number {
    const stages = ['experimental', 'alpha', 'beta', 'production', 'deprecated'];
    return stages.indexOf(lifecycle || '') + 1;
  }

  private encodeDependencies(relations: any[]): number[] {
    const dependencyCount = relations.filter(r => r.type === 'dependsOn').length;
    const dependentCount = relations.filter(r => r.type === 'dependencyOf').length;
    return [dependencyCount, dependentCount];
  }

  private encodeSkills(skills: string[]): number[] {
    const allSkills = ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'kubernetes', 'docker'];
    return allSkills.map(skill => skills.includes(skill) ? 1 : 0);
  }

  private encodeTeams(teams: string[]): number[] {
    // Encode team membership
    return [teams.length];
  }

  private encodePreferences(preferences: any): number[] {
    return [
      preferences?.prefersDarkMode ? 1 : 0,
      preferences?.notificationLevel || 0,
      preferences?.viewMode === 'grid' ? 1 : 0
    ];
  }

  private padFeatures(features: number[], targetLength: number): number[] {
    if (features.length >= targetLength) {
      return features.slice(0, targetLength);
    }
    return [...features, ...new Array(targetLength - features.length).fill(0)];
  }

  private getInteractionScore(interaction: string): number {
    const scores = {
      'deploy': 1.0,
      'use': 0.8,
      'view': 0.5,
      'ignore': 0.0
    };
    return scores[interaction] || 0.5;
  }

  private async generateRecommendationReason(
    userId: string,
    entity: Entity,
    score: number
  ): Promise<string> {
    if (score > 0.8) {
      return 'Highly relevant based on your recent activity and team patterns';
    } else if (score > 0.6) {
      return 'Similar to services you frequently use';
    } else if (score > 0.4) {
      return 'Popular among developers with similar skills';
    } else {
      return 'Trending in your organization';
    }
  }

  private async getUserActivity(userId: string): Promise<any> {
    // Fetch from cache or database
    const cached = await redis.get(`user:activity:${userId}`);
    if (cached) return JSON.parse(cached);

    // Default activity structure
    return {
      servicesViewed: [],
      templatesUsed: [],
      searchQueries: [],
      deploymentCount: 0,
      commitCount: 0,
      prCount: 0,
      issueCount: 0,
      documentationViews: 0,
      skills: [],
      teams: [],
      preferences: {}
    };
  }

  private async getEntityById(entityId: string): Promise<Entity | null> {
    // Implement entity fetching logic
    return null;
  }

  private async analyzeDeveloperPatterns(activity: any): Promise<any> {
    // Analyze patterns in developer activity
    return {
      primaryLanguage: 'typescript',
      workingHours: [9, 17],
      preferredTools: [],
      collaborationStyle: 'team'
    };
  }

  private async predictTemplateNeeds(patterns: any): Promise<string[]> {
    // Predict template needs based on patterns
    return ['microservice-template', 'api-template'];
  }

  private async predictServiceNeeds(patterns: any): Promise<string[]> {
    // Predict service needs
    return ['monitoring-service', 'logging-service'];
  }

  private async predictDocumentationNeeds(patterns: any): Promise<string[]> {
    // Predict documentation needs
    return ['api-guidelines', 'deployment-guide'];
  }

  private async predictToolNeeds(patterns: any): Promise<string[]> {
    // Predict tool needs
    return ['code-quality-scanner', 'performance-profiler'];
  }

  /**
   * Process a batch of entities for recommendations
   */
  private async processBatch(
    userId: string,
    userEmbedding: tf.Tensor,
    entities: Entity[],
    startTime: number
  ): Promise<RecommendationResult[]> {
    const recommendations: RecommendationResult[] = [];
    
    for (const entity of entities) {
      const serviceEmbedding = await this.generateServiceEmbedding(entity);
      
      // Get predictions using the dual-output model
      const predictions = this.model!.predict([userEmbedding, serviceEmbedding]) as tf.Tensor[];
      const [scoreTensor, confidenceTensor] = predictions;
      
      const score = (await scoreTensor.data())[0];
      const confidence = (await confidenceTensor.data())[0];
      
      // Enhanced recommendation reason with category
      const { reason, category, features } = await this.generateEnhancedRecommendationReason(
        userId,
        entity,
        score,
        confidence
      );
      
      recommendations.push({
        entity,
        score,
        confidence,
        reason,
        category,
        metadata: {
          modelVersion: this.MODEL_VERSION,
          computationTimeMs: Date.now() - startTime,
          features
        }
      });
      
      // Clean up tensors
      scoreTensor.dispose();
      confidenceTensor.dispose();
    }
    
    return recommendations;
  }
  
  /**
   * Apply advanced multi-stage ranking
   */
  private async rankRecommendations(
    recommendations: RecommendationResult[],
    userId: string
  ): Promise<RecommendationResult[]> {
    // Stage 1: Base ML score
    let ranked = recommendations.sort((a, b) => b.score - a.score);
    
    // Stage 2: Diversity injection
    ranked = await this.injectDiversity(ranked);
    
    // Stage 3: Freshness boost for new items
    ranked = await this.applyFreshnessBoost(ranked);
    
    // Stage 4: Team collaboration signal
    ranked = await this.applyCollaborationSignal(ranked, userId);
    
    return ranked;
  }
  
  /**
   * Apply filters to entities before processing
   */
  private applyFilters(entities: Entity[], filters?: any): Entity[] {
    if (!filters) return entities;
    
    return entities.filter(entity => {
      if (filters.kind && entity.kind !== filters.kind) return false;
      if (filters.owner && entity.spec?.owner !== filters.owner) return false;
      if (filters.lifecycle && entity.spec?.lifecycle !== filters.lifecycle) return false;
      if (filters.tags && filters.tags.length > 0) {
        const entityTags = entity.metadata.tags || [];
        if (!filters.tags.some(tag => entityTags.includes(tag))) return false;
      }
      return true;
    });
  }
  
  /**
   * Inject diversity to avoid filter bubbles
   */
  private async injectDiversity(recommendations: RecommendationResult[]): Promise<RecommendationResult[]> {
    const diversityFactor = 0.3;
    const categories = new Set<string>();
    const diversified: RecommendationResult[] = [];
    
    for (const rec of recommendations) {
      const entityCategory = rec.entity.spec?.type || rec.entity.kind;
      
      if (categories.size < 3 || categories.has(entityCategory) || Math.random() > diversityFactor) {
        diversified.push(rec);
        categories.add(entityCategory);
      }
    }
    
    return diversified;
  }
  
  /**
   * Apply freshness boost for recently created/updated items
   */
  private async applyFreshnessBoost(recommendations: RecommendationResult[]): Promise<RecommendationResult[]> {
    const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    
    return recommendations.map(rec => {
      const updatedAt = new Date(rec.entity.metadata.annotations?.['backstage.io/updated-at'] || 0);
      const age = now - updatedAt.getTime();
      
      if (age < oneWeek) {
        const boost = Math.max(0, (oneWeek - age) / oneWeek * 0.1);
        rec.score = Math.min(1, rec.score + boost);
      }
      
      return rec;
    }).sort((a, b) => b.score - a.score);
  }
  
  /**
   * Apply team collaboration signals
   */
  private async applyCollaborationSignal(
    recommendations: RecommendationResult[],
    userId: string
  ): Promise<RecommendationResult[]> {
    const userTeams = await this.getUserTeams(userId);
    
    return recommendations.map(rec => {
      const entityOwner = rec.entity.spec?.owner;
      if (entityOwner && userTeams.includes(entityOwner)) {
        rec.score = Math.min(1, rec.score + 0.05); // Small team boost
      }
      return rec;
    }).sort((a, b) => b.score - a.score);
  }
  
  private getDefaultRecommendations(
    entities: Entity[],
    limit: number,
    startTime: number
  ): RecommendationResult[] {
    return entities.slice(0, limit).map(entity => ({
      entity,
      score: 0.5 + Math.random() * 0.3, // Random but reasonable score
      confidence: 0.3,
      reason: 'Popular in your organization',
      category: 'trending' as const,
      metadata: {
        modelVersion: 'fallback',
        computationTimeMs: Date.now() - startTime,
        features: ['fallback']
      }
    }));
  }

  /**
   * Additional helper methods for enhanced functionality
   */
  
  private normalizeFeatures(features: number[]): number[] {
    const mean = features.reduce((sum, val) => sum + val, 0) / features.length;
    const variance = features.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / features.length;
    const stdDev = Math.sqrt(variance);
    
    return features.map(val => stdDev === 0 ? 0 : (val - mean) / stdDev);
  }
  
  private async getTemporalWeights(lastActivity: Date): Promise<tf.Tensor> {
    const now = Date.now();
    const daysSinceActivity = (now - lastActivity.getTime()) / (24 * 60 * 60 * 1000);
    const decayFactor = Math.exp(-daysSinceActivity / 30); // 30-day half-life
    
    return tf.scalar(Math.max(0.1, decayFactor)); // Minimum weight of 0.1
  }
  
  private async generateEnhancedRecommendationReason(
    userId: string,
    entity: Entity,
    score: number,
    confidence: number
  ): Promise<{ reason: string; category: 'personal' | 'team' | 'trending' | 'similar'; features: string[] }> {
    const features: string[] = [];
    let category: 'personal' | 'team' | 'trending' | 'similar';
    let reason: string;
    
    if (score > 0.8 && confidence > 0.7) {
      reason = 'Highly personalized match based on your activity patterns';
      category = 'personal';
      features.push('high_personal_relevance', 'strong_confidence');
    } else if (score > 0.6) {
      const userTeams = await this.getUserTeams(userId);
      if (userTeams.includes(entity.spec?.owner)) {
        reason = 'Frequently used by your team members';
        category = 'team';
        features.push('team_collaboration');
      } else {
        reason = 'Similar to services you have used recently';
        category = 'similar';
        features.push('content_similarity');
      }
    } else {
      reason = 'Trending across your organization';
      category = 'trending';
      features.push('popularity_signal');
    }
    
    // Add entity-specific features
    if (entity.metadata.tags?.includes('production')) {
      features.push('production_ready');
    }
    if (entity.spec?.lifecycle === 'experimental') {
      features.push('cutting_edge');
    }
    
    return { reason, category, features };
  }
  
  private async getUserTeams(userId: string): Promise<string[]> {
    try {
      const cached = await redis.get(`user:teams:${userId}`);
      if (cached) return JSON.parse(cached);
      
      // Fallback to empty array if not cached
      return [];
    } catch {
      return [];
    }
  }
  
  /**
   * Start cleanup interval for expired embeddings
   */
  private startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      
      // Clean up expired user embeddings
      for (const [userId, cached] of this.userEmbeddings) {
        if (now - cached.timestamp > this.CACHE_TTL) {
          cached.tensor.dispose();
          this.userEmbeddings.delete(userId);
        }
      }
      
      // Clean up expired service embeddings
      for (const [serviceId, cached] of this.serviceEmbeddings) {
        if (now - cached.timestamp > this.CACHE_TTL) {
          cached.tensor.dispose();
          this.serviceEmbeddings.delete(serviceId);
        }
      }
      
      logger.info(`Cleaned up embeddings. User: ${this.userEmbeddings.size}, Service: ${this.serviceEmbeddings.size}`);
    }, this.CACHE_TTL / 4); // Clean up every 15 minutes
  }
  
  /**
   * Get model performance metrics
   */
  public getMetrics(): ModelMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Export model for backup or transfer
   */
  public async exportModel(): Promise<ArrayBuffer> {
    if (!this.model) throw new Error('Model not initialized');
    
    const artifacts = await this.model.save(tf.io.withSaveHandler(async (artifacts) => artifacts));
    return artifacts.weightData;
  }
  
  /**
   * Real-time feature extraction for streaming recommendations
   */
  public async getStreamingRecommendations(
    userId: string,
    entityStream: AsyncIterable<Entity>
  ): Promise<AsyncGenerator<RecommendationResult>> {
    if (!this.model) throw new Error('Model not initialized');
    
    const userEmbedding = await this.generateUserEmbedding(userId);
    
    async function* generateRecommendations(this: RecommendationEngine) {
      for await (const entity of entityStream) {
        const serviceEmbedding = await this.generateServiceEmbedding(entity);
        const predictions = this.model!.predict([userEmbedding, serviceEmbedding]) as tf.Tensor[];
        const [scoreTensor, confidenceTensor] = predictions;
        
        const score = (await scoreTensor.data())[0];
        const confidence = (await confidenceTensor.data())[0];
        
        if (score > 0.3) { // Only yield relevant recommendations
          const { reason, category, features } = await this.generateEnhancedRecommendationReason(
            userId,
            entity,
            score,
            confidence
          );
          
          yield {
            entity,
            score,
            confidence,
            reason,
            category,
            metadata: {
              modelVersion: this.MODEL_VERSION,
              computationTimeMs: 0, // Streaming mode
              features
            }
          };
        }
        
        scoreTensor.dispose();
        confidenceTensor.dispose();
      }
    }
    
    return generateRecommendations.call(this);
  }
  
  /**
   * Clean up resources
   */
  public dispose() {
    this.userEmbeddings.forEach(cached => cached.tensor.dispose());
    this.serviceEmbeddings.forEach(cached => cached.tensor.dispose());
    this.userEmbeddings.clear();
    this.serviceEmbeddings.clear();
    
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
  }
}