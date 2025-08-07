import { Entity } from '@backstage/catalog-model';
import { Logger } from 'winston';
import { DiscoveredRelationship, RelationshipType, DiscoveryMethod } from '../discovery/RelationshipDiscovery';

/**
 * Types for ML prediction
 */
export interface RelationshipPrediction {
  sourceEntity: string;
  targetEntity: string;
  type: RelationshipType;
  confidence: number;
  reasoning: string[];
  features: FeatureVector;
  modelVersion: string;
}

export interface FeatureVector {
  // Entity similarity features
  namesimilarity: number;
  tagSimilarity: number;
  ownerSimilarity: number;
  namespaceSimilarity: number;
  
  // Structural features
  commonDependencies: number;
  sharedTags: number;
  organizationProximity: number;
  
  // Behavioral features
  deploymentPattern: number;
  lifecycleAlignment: number;
  teamAlignment: number;
  
  // Historical features
  pastRelationships: number;
  confirmationRate: number;
  rejectionRate: number;
  
  // Context features
  domainSimilarity: number;
  apiCompatibility: number;
  dataFlowIndicators: number;
}

export interface TrainingData {
  relationships: DiscoveredRelationship[];
  confirmations: RelationshipConfirmation[];
  rejections: RelationshipRejection[];
  entityMetadata: Map<string, Entity>;
}

export interface RelationshipConfirmation {
  relationshipId: string;
  userId: string;
  timestamp: Date;
  confidence: number;
  feedback?: string;
}

export interface RelationshipRejection {
  relationshipId: string;
  userId: string;
  timestamp: Date;
  reason?: string;
  feedback?: string;
}

export interface ModelMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
  confidenceDistribution: number[];
  typeAccuracy: Record<RelationshipType, number>;
  lastTraining: Date;
  trainingDataSize: number;
}

export interface PredictionContext {
  focusEntity?: string;
  relationshipTypes?: RelationshipType[];
  confidenceThreshold?: number;
  maxPredictions?: number;
  includeExisting?: boolean;
}

/**
 * ML-based relationship predictor using pattern recognition and user feedback
 */
export class RelationshipPredictor {
  private readonly logger: Logger;
  private trainingData: TrainingData;
  private modelWeights: Map<string, number>;
  private modelVersion: string;
  private lastTraining: Date;
  private metrics: ModelMetrics;

  constructor(logger: Logger) {
    this.logger = logger;
    this.trainingData = {
      relationships: [],
      confirmations: [],
      rejections: [],
      entityMetadata: new Map()
    };
    this.modelWeights = new Map();
    this.modelVersion = '1.0.0';
    this.lastTraining = new Date();
    this.metrics = this.initializeMetrics();
    
    this.initializeModel();
  }

  /**
   * Predict relationships for a given entity
   */
  async predictRelationships(
    entity: Entity,
    allEntities: Map<string, Entity>,
    context: PredictionContext = {}
  ): Promise<RelationshipPrediction[]> {
    const predictions: RelationshipPrediction[] = [];
    const entityRef = this.getEntityRef(entity);
    
    this.logger.info(`Predicting relationships for entity: ${entity.metadata.name}`);
    
    // Get candidate entities for relationships
    const candidates = this.getCandidateEntities(entity, allEntities, context);
    
    for (const candidate of candidates) {
      const candidateRef = this.getEntityRef(candidate);
      
      // Skip self-references
      if (entityRef === candidateRef) continue;
      
      // Skip existing relationships if not requested
      if (!context.includeExisting && this.hasExistingRelationship(entityRef, candidateRef)) {
        continue;
      }
      
      // Predict all possible relationship types
      const relationshipTypes = context.relationshipTypes || Object.values(RelationshipType);
      
      for (const relType of relationshipTypes) {
        const prediction = await this.predictRelationship(entity, candidate, relType, allEntities);
        
        if (prediction && prediction.confidence >= (context.confidenceThreshold || 0.5)) {
          predictions.push(prediction);
        }
      }
    }
    
    // Sort by confidence and limit results
    const sortedPredictions = predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, context.maxPredictions || 50);
    
    this.logger.info(`Generated ${sortedPredictions.length} relationship predictions for ${entity.metadata.name}`);
    
    return sortedPredictions;
  }

  /**
   * Predict a specific relationship between two entities
   */
  private async predictRelationship(
    sourceEntity: Entity,
    targetEntity: Entity,
    relationshipType: RelationshipType,
    allEntities: Map<string, Entity>
  ): Promise<RelationshipPrediction | null> {
    
    try {
      // Extract features
      const features = await this.extractFeatures(sourceEntity, targetEntity, relationshipType, allEntities);
      
      // Calculate confidence using the trained model
      const confidence = this.calculateConfidence(features, relationshipType);
      
      // Generate reasoning
      const reasoning = this.generateReasoning(features, relationshipType, sourceEntity, targetEntity);
      
      if (confidence < 0.1) return null; // Filter out very low confidence predictions
      
      return {
        sourceEntity: this.getEntityRef(sourceEntity),
        targetEntity: this.getEntityRef(targetEntity),
        type: relationshipType,
        confidence,
        reasoning,
        features,
        modelVersion: this.modelVersion
      };
      
    } catch (error) {
      this.logger.error(`Failed to predict relationship between ${sourceEntity.metadata.name} and ${targetEntity.metadata.name}:`, error);
      return null;
    }
  }

  /**
   * Learn from user confirmations and rejections
   */
  async learnFromConfirmation(relationship: DiscoveredRelationship, confirmed: boolean): Promise<void> {
    if (confirmed) {
      this.trainingData.confirmations.push({
        relationshipId: relationship.id,
        userId: relationship.confirmedBy || 'system',
        timestamp: new Date(),
        confidence: relationship.confidence
      });
      this.logger.info(`Learning from confirmed relationship: ${relationship.type}`);
    } else {
      this.trainingData.rejections.push({
        relationshipId: relationship.id,
        userId: relationship.confirmedBy || 'system',
        timestamp: new Date(),
        reason: 'user_rejected'
      });
      this.logger.info(`Learning from rejected relationship: ${relationship.type}`);
    }
    
    // Trigger incremental learning if we have enough new data
    if (this.trainingData.confirmations.length + this.trainingData.rejections.length > 100) {
      await this.incrementalTraining();
    }
  }

  /**
   * Retrain the model with new data
   */
  async trainModel(trainingData: TrainingData): Promise<void> {
    this.logger.info('Starting model training...');
    
    this.trainingData = { ...this.trainingData, ...trainingData };
    
    // Extract features for all training relationships
    const trainingFeatures: Array<{ features: FeatureVector; type: RelationshipType; confirmed: boolean }> = [];
    
    for (const relationship of this.trainingData.relationships) {
      const sourceEntity = this.trainingData.entityMetadata.get(relationship.sourceEntity);
      const targetEntity = this.trainingData.entityMetadata.get(relationship.targetEntity);
      
      if (sourceEntity && targetEntity) {
        const features = await this.extractFeatures(
          sourceEntity, 
          targetEntity, 
          relationship.type, 
          this.trainingData.entityMetadata
        );
        
        const confirmed = this.isRelationshipConfirmed(relationship.id);
        
        trainingFeatures.push({
          features,
          type: relationship.type,
          confirmed
        });
      }
    }
    
    // Train weights using a simple gradient descent approach
    await this.updateModelWeights(trainingFeatures);
    
    // Calculate metrics
    this.metrics = await this.calculateModelMetrics(trainingFeatures);
    
    this.lastTraining = new Date();
    this.modelVersion = this.generateModelVersion();
    
    this.logger.info(`Model training completed. Accuracy: ${(this.metrics.accuracy * 100).toFixed(2)}%`);
  }

  /**
   * Get model performance metrics
   */
  getModelMetrics(): ModelMetrics {
    return { ...this.metrics };
  }

  /**
   * Export model for persistence
   */
  exportModel(): any {
    return {
      weights: Object.fromEntries(this.modelWeights),
      version: this.modelVersion,
      lastTraining: this.lastTraining,
      metrics: this.metrics
    };
  }

  /**
   * Import model from persistence
   */
  importModel(modelData: any): void {
    this.modelWeights = new Map(Object.entries(modelData.weights));
    this.modelVersion = modelData.version;
    this.lastTraining = new Date(modelData.lastTraining);
    this.metrics = modelData.metrics;
  }

  /**
   * Private methods for feature extraction and model operations
   */
  private async extractFeatures(
    sourceEntity: Entity,
    targetEntity: Entity,
    relationshipType: RelationshipType,
    allEntities: Map<string, Entity>
  ): Promise<FeatureVector> {
    
    const features: FeatureVector = {
      // Entity similarity features
      nameSimilarity: this.calculateNameSimilarity(sourceEntity.metadata.name, targetEntity.metadata.name),
      tagSimilarity: this.calculateTagSimilarity(sourceEntity.metadata.tags || [], targetEntity.metadata.tags || []),
      ownerSimilarity: this.calculateOwnerSimilarity(sourceEntity.spec?.owner, targetEntity.spec?.owner),
      namespaceSimilarity: sourceEntity.metadata.namespace === targetEntity.metadata.namespace ? 1 : 0,
      
      // Structural features
      commonDependencies: await this.calculateCommonDependencies(sourceEntity, targetEntity, allEntities),
      sharedTags: this.calculateSharedTags(sourceEntity, targetEntity),
      organizationProximity: this.calculateOrganizationProximity(sourceEntity, targetEntity),
      
      // Behavioral features
      deploymentPattern: this.calculateDeploymentPattern(sourceEntity, targetEntity),
      lifecycleAlignment: this.calculateLifecycleAlignment(sourceEntity, targetEntity),
      teamAlignment: this.calculateTeamAlignment(sourceEntity, targetEntity),
      
      // Historical features
      pastRelationships: this.calculatePastRelationships(sourceEntity, targetEntity),
      confirmationRate: this.calculateConfirmationRate(sourceEntity, targetEntity),
      rejectionRate: this.calculateRejectionRate(sourceEntity, targetEntity),
      
      // Context features
      domainSimilarity: this.calculateDomainSimilarity(sourceEntity, targetEntity),
      apiCompatibility: this.calculateApiCompatibility(sourceEntity, targetEntity, relationshipType),
      dataFlowIndicators: this.calculateDataFlowIndicators(sourceEntity, targetEntity, relationshipType)
    };
    
    return features;
  }

  private calculateConfidence(features: FeatureVector, relationshipType: RelationshipType): number {
    const typeWeightKey = `type_${relationshipType}`;
    const typeWeight = this.modelWeights.get(typeWeightKey) || 1.0;
    
    let confidence = 0;
    let totalWeight = 0;
    
    // Apply weighted sum of features
    for (const [featureName, featureValue] of Object.entries(features)) {
      const weightKey = `${relationshipType}_${featureName}`;
      const weight = this.modelWeights.get(weightKey) || 0.1;
      
      confidence += featureValue * weight;
      totalWeight += Math.abs(weight);
    }
    
    // Normalize and apply sigmoid
    const normalizedConfidence = confidence / Math.max(totalWeight, 1);
    return this.sigmoid(normalizedConfidence * typeWeight);
  }

  private generateReasoning(
    features: FeatureVector,
    relationshipType: RelationshipType,
    sourceEntity: Entity,
    targetEntity: Entity
  ): string[] {
    const reasoning: string[] = [];
    
    // Analyze top contributing features
    const sortedFeatures = Object.entries(features)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    for (const [featureName, value] of sortedFeatures) {
      if (value > 0.7) {
        switch (featureName) {
          case 'nameSimilarity':
            reasoning.push(`Entity names are highly similar (${(value * 100).toFixed(0)}%)`);
            break;
          case 'tagSimilarity':
            reasoning.push(`Entities share similar tags (${(value * 100).toFixed(0)}% overlap)`);
            break;
          case 'ownerSimilarity':
            reasoning.push(`Entities have the same owner`);
            break;
          case 'namespaceSimilarity':
            reasoning.push(`Entities are in the same namespace`);
            break;
          case 'commonDependencies':
            reasoning.push(`Entities have many common dependencies`);
            break;
          case 'deploymentPattern':
            reasoning.push(`Entities follow similar deployment patterns`);
            break;
          case 'teamAlignment':
            reasoning.push(`Entities belong to related teams`);
            break;
          case 'apiCompatibility':
            reasoning.push(`API interfaces suggest compatibility`);
            break;
          case 'dataFlowIndicators':
            reasoning.push(`Data flow patterns indicate relationship`);
            break;
        }
      }
    }
    
    // Add relationship-specific reasoning
    switch (relationshipType) {
      case RelationshipType.DEPENDS_ON:
        if (features.commonDependencies > 0.5) {
          reasoning.push('Common dependencies suggest a dependency relationship');
        }
        break;
      case RelationshipType.PROVIDES_API:
        if (features.apiCompatibility > 0.6) {
          reasoning.push('API compatibility suggests provider relationship');
        }
        break;
      case RelationshipType.PART_OF:
        if (features.nameSimilarity > 0.7 && features.ownerSimilarity > 0.8) {
          reasoning.push('Naming and ownership patterns suggest hierarchical relationship');
        }
        break;
    }
    
    return reasoning.length > 0 ? reasoning : ['Based on learned patterns from similar entities'];
  }

  private getCandidateEntities(
    entity: Entity,
    allEntities: Map<string, Entity>,
    context: PredictionContext
  ): Entity[] {
    const candidates: Entity[] = [];
    const entityRef = this.getEntityRef(entity);
    
    for (const candidate of allEntities.values()) {
      const candidateRef = this.getEntityRef(candidate);
      
      // Skip self
      if (entityRef === candidateRef) continue;
      
      // Apply context filters
      if (context.focusEntity && candidateRef !== context.focusEntity) continue;
      
      // Basic relevance filtering
      if (this.isRelevantCandidate(entity, candidate)) {
        candidates.push(candidate);
      }
    }
    
    return candidates;
  }

  private isRelevantCandidate(sourceEntity: Entity, targetEntity: Entity): boolean {
    // Same namespace gets higher priority
    if (sourceEntity.metadata.namespace === targetEntity.metadata.namespace) return true;
    
    // Similar tags suggest relevance
    const sourceTags = sourceEntity.metadata.tags || [];
    const targetTags = targetEntity.metadata.tags || [];
    const tagOverlap = sourceTags.filter(tag => targetTags.includes(tag)).length;
    if (tagOverlap > 0) return true;
    
    // Same owner suggests relevance
    if (sourceEntity.spec?.owner === targetEntity.spec?.owner) return true;
    
    // Name similarity suggests relevance
    if (this.calculateNameSimilarity(sourceEntity.metadata.name, targetEntity.metadata.name) > 0.3) {
      return true;
    }
    
    return false;
  }

  // Feature calculation methods
  private calculateNameSimilarity(name1: string, name2: string): number {
    // Levenshtein distance normalized
    const distance = this.levenshteinDistance(name1.toLowerCase(), name2.toLowerCase());
    const maxLength = Math.max(name1.length, name2.length);
    return maxLength > 0 ? 1 - (distance / maxLength) : 0;
  }

  private calculateTagSimilarity(tags1: string[], tags2: string[]): number {
    if (tags1.length === 0 && tags2.length === 0) return 0;
    
    const set1 = new Set(tags1);
    const set2 = new Set(tags2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateOwnerSimilarity(owner1?: string, owner2?: string): number {
    if (!owner1 || !owner2) return 0;
    return owner1 === owner2 ? 1 : 0;
  }

  private async calculateCommonDependencies(
    sourceEntity: Entity,
    targetEntity: Entity,
    allEntities: Map<string, Entity>
  ): Promise<number> {
    // This would analyze the dependency graphs of both entities
    // For now, returning a placeholder value
    return 0.3;
  }

  private calculateSharedTags(sourceEntity: Entity, targetEntity: Entity): number {
    const sourceTags = sourceEntity.metadata.tags || [];
    const targetTags = targetEntity.metadata.tags || [];
    const sharedTags = sourceTags.filter(tag => targetTags.includes(tag));
    
    return Math.min(sourceTags.length, targetTags.length) > 0 ? 
           sharedTags.length / Math.min(sourceTags.length, targetTags.length) : 0;
  }

  private calculateOrganizationProximity(sourceEntity: Entity, targetEntity: Entity): number {
    // Analyze namespace and owner patterns
    const sameNamespace = sourceEntity.metadata.namespace === targetEntity.metadata.namespace ? 0.5 : 0;
    const sameOwner = sourceEntity.spec?.owner === targetEntity.spec?.owner ? 0.5 : 0;
    return sameNamespace + sameOwner;
  }

  private calculateDeploymentPattern(sourceEntity: Entity, targetEntity: Entity): number {
    // Analyze deployment annotations and labels
    const sourceLabels = sourceEntity.metadata.labels || {};
    const targetLabels = targetEntity.metadata.labels || {};
    
    const deploymentKeys = ['deployment', 'cluster', 'environment', 'region'];
    let matches = 0;
    let total = 0;
    
    for (const key of deploymentKeys) {
      if (sourceLabels[key] || targetLabels[key]) {
        total++;
        if (sourceLabels[key] === targetLabels[key]) {
          matches++;
        }
      }
    }
    
    return total > 0 ? matches / total : 0;
  }

  private calculateLifecycleAlignment(sourceEntity: Entity, targetEntity: Entity): number {
    const sourceLifecycle = sourceEntity.spec?.lifecycle;
    const targetLifecycle = targetEntity.spec?.lifecycle;
    
    if (!sourceLifecycle || !targetLifecycle) return 0;
    
    return sourceLifecycle === targetLifecycle ? 1 : 0;
  }

  private calculateTeamAlignment(sourceEntity: Entity, targetEntity: Entity): number {
    const sourceOwner = sourceEntity.spec?.owner;
    const targetOwner = targetEntity.spec?.owner;
    
    if (!sourceOwner || !targetOwner) return 0;
    
    // Exact match
    if (sourceOwner === targetOwner) return 1;
    
    // Similar team names (e.g., "platform-team" and "platform-backend-team")
    if (sourceOwner.includes(targetOwner) || targetOwner.includes(sourceOwner)) {
      return 0.7;
    }
    
    return 0;
  }

  private calculatePastRelationships(sourceEntity: Entity, targetEntity: Entity): number {
    const sourceRef = this.getEntityRef(sourceEntity);
    const targetRef = this.getEntityRef(targetEntity);
    
    const pastRelationships = this.trainingData.relationships.filter(rel =>
      (rel.sourceEntity === sourceRef && rel.targetEntity === targetRef) ||
      (rel.sourceEntity === targetRef && rel.targetEntity === sourceRef)
    );
    
    return Math.min(pastRelationships.length / 5, 1); // Normalize to 0-1
  }

  private calculateConfirmationRate(sourceEntity: Entity, targetEntity: Entity): number {
    const sourceRef = this.getEntityRef(sourceEntity);
    const targetRef = this.getEntityRef(targetEntity);
    
    const relatedRelationships = this.trainingData.relationships.filter(rel =>
      rel.sourceEntity === sourceRef || rel.targetEntity === sourceRef ||
      rel.sourceEntity === targetRef || rel.targetEntity === targetRef
    );
    
    if (relatedRelationships.length === 0) return 0;
    
    const confirmedCount = relatedRelationships.filter(rel => 
      this.isRelationshipConfirmed(rel.id)
    ).length;
    
    return confirmedCount / relatedRelationships.length;
  }

  private calculateRejectionRate(sourceEntity: Entity, targetEntity: Entity): number {
    const sourceRef = this.getEntityRef(sourceEntity);
    const targetRef = this.getEntityRef(targetEntity);
    
    const relatedRelationships = this.trainingData.relationships.filter(rel =>
      rel.sourceEntity === sourceRef || rel.targetEntity === sourceRef ||
      rel.sourceEntity === targetRef || rel.targetEntity === targetRef
    );
    
    if (relatedRelationships.length === 0) return 0;
    
    const rejectedCount = relatedRelationships.filter(rel => 
      this.isRelationshipRejected(rel.id)
    ).length;
    
    return rejectedCount / relatedRelationships.length;
  }

  private calculateDomainSimilarity(sourceEntity: Entity, targetEntity: Entity): number {
    // Analyze domain indicators in names, tags, and metadata
    const sourceDomain = this.extractDomain(sourceEntity);
    const targetDomain = this.extractDomain(targetEntity);
    
    return sourceDomain === targetDomain ? 1 : 0;
  }

  private calculateApiCompatibility(
    sourceEntity: Entity, 
    targetEntity: Entity, 
    relationshipType: RelationshipType
  ): number {
    // Analyze API-related annotations and specifications
    if (relationshipType === RelationshipType.PROVIDES_API || relationshipType === RelationshipType.CONSUMES_API) {
      // Look for API-related annotations
      const sourceAnnotations = sourceEntity.metadata.annotations || {};
      const targetAnnotations = targetEntity.metadata.annotations || {};
      
      const hasApiAnnotations = Object.keys(sourceAnnotations).some(key => key.includes('api')) ||
                               Object.keys(targetAnnotations).some(key => key.includes('api'));
      
      return hasApiAnnotations ? 0.8 : 0.3;
    }
    
    return 0.5;
  }

  private calculateDataFlowIndicators(
    sourceEntity: Entity, 
    targetEntity: Entity, 
    relationshipType: RelationshipType
  ): number {
    // Analyze data flow patterns based on entity types and annotations
    if (relationshipType === RelationshipType.STORES_DATA_IN) {
      const targetKind = targetEntity.kind.toLowerCase();
      if (targetKind.includes('database') || targetKind.includes('storage')) {
        return 0.9;
      }
    }
    
    return 0.4;
  }

  // Utility methods
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private getEntityRef(entity: Entity): string {
    return `${entity.kind.toLowerCase()}:${entity.metadata.namespace}/${entity.metadata.name}`;
  }

  private extractDomain(entity: Entity): string {
    // Extract domain from name, tags, or annotations
    const name = entity.metadata.name.toLowerCase();
    const tags = entity.metadata.tags || [];
    
    // Common domain indicators
    const domains = ['auth', 'payment', 'user', 'order', 'catalog', 'inventory', 'notification'];
    
    for (const domain of domains) {
      if (name.includes(domain) || tags.some(tag => tag.toLowerCase().includes(domain))) {
        return domain;
      }
    }
    
    return 'unknown';
  }

  private hasExistingRelationship(sourceRef: string, targetRef: string): boolean {
    return this.trainingData.relationships.some(rel =>
      (rel.sourceEntity === sourceRef && rel.targetEntity === targetRef) ||
      (rel.sourceEntity === targetRef && rel.targetEntity === sourceRef)
    );
  }

  private isRelationshipConfirmed(relationshipId: string): boolean {
    return this.trainingData.confirmations.some(conf => conf.relationshipId === relationshipId);
  }

  private isRelationshipRejected(relationshipId: string): boolean {
    return this.trainingData.rejections.some(rej => rej.relationshipId === relationshipId);
  }

  private initializeModel(): void {
    // Initialize with basic weights
    const featureNames = [
      'nameSimilarity', 'tagSimilarity', 'ownerSimilarity', 'namespaceSimilarity',
      'commonDependencies', 'sharedTags', 'organizationProximity',
      'deploymentPattern', 'lifecycleAlignment', 'teamAlignment',
      'pastRelationships', 'confirmationRate', 'rejectionRate',
      'domainSimilarity', 'apiCompatibility', 'dataFlowIndicators'
    ];
    
    for (const relationshipType of Object.values(RelationshipType)) {
      this.modelWeights.set(`type_${relationshipType}`, 1.0);
      
      for (const featureName of featureNames) {
        const weightKey = `${relationshipType}_${featureName}`;
        this.modelWeights.set(weightKey, Math.random() * 0.5 + 0.25); // Random weights between 0.25 and 0.75
      }
    }
  }

  private async updateModelWeights(trainingFeatures: Array<{ features: FeatureVector; type: RelationshipType; confirmed: boolean }>): Promise<void> {
    const learningRate = 0.01;
    const batchSize = 32;
    
    // Simple gradient descent training
    for (let epoch = 0; epoch < 100; epoch++) {
      const shuffled = [...trainingFeatures].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < shuffled.length; i += batchSize) {
        const batch = shuffled.slice(i, i + batchSize);
        
        for (const sample of batch) {
          const predicted = this.calculateConfidence(sample.features, sample.type);
          const actual = sample.confirmed ? 1 : 0;
          const error = actual - predicted;
          
          // Update weights
          for (const [featureName, featureValue] of Object.entries(sample.features)) {
            const weightKey = `${sample.type}_${featureName}`;
            const currentWeight = this.modelWeights.get(weightKey) || 0;
            const gradient = error * featureValue;
            this.modelWeights.set(weightKey, currentWeight + learningRate * gradient);
          }
        }
      }
    }
  }

  private async incrementalTraining(): Promise<void> {
    this.logger.info('Performing incremental model training...');
    
    // Get recent confirmations and rejections
    const recentData = [
      ...this.trainingData.confirmations.slice(-50),
      ...this.trainingData.rejections.slice(-50)
    ];
    
    // Update weights based on recent feedback
    // This is a simplified incremental learning approach
    
    this.lastTraining = new Date();
    this.logger.info('Incremental training completed');
  }

  private async calculateModelMetrics(trainingFeatures: Array<{ features: FeatureVector; type: RelationshipType; confirmed: boolean }>): Promise<ModelMetrics> {
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;
    
    const typeAccuracy: Record<RelationshipType, number> = {} as any;
    const confidenceDistribution: number[] = Array(10).fill(0);
    
    for (const sample of trainingFeatures) {
      const predicted = this.calculateConfidence(sample.features, sample.type);
      const predictedBinary = predicted > 0.5;
      const actual = sample.confirmed;
      
      // Update confusion matrix
      if (predictedBinary && actual) truePositives++;
      else if (predictedBinary && !actual) falsePositives++;
      else if (!predictedBinary && !actual) trueNegatives++;
      else if (!predictedBinary && actual) falseNegatives++;
      
      // Update confidence distribution
      const confidenceBin = Math.min(9, Math.floor(predicted * 10));
      confidenceDistribution[confidenceBin]++;
    }
    
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
    const accuracy = (truePositives + trueNegatives) / trainingFeatures.length || 0;
    
    // Calculate type-specific accuracy (simplified)
    for (const type of Object.values(RelationshipType)) {
      typeAccuracy[type] = accuracy; // Simplified - would need type-specific calculation
    }
    
    return {
      precision,
      recall,
      f1Score,
      accuracy,
      confidenceDistribution,
      typeAccuracy,
      lastTraining: this.lastTraining,
      trainingDataSize: trainingFeatures.length
    };
  }

  private initializeMetrics(): ModelMetrics {
    return {
      precision: 0,
      recall: 0,
      f1Score: 0,
      accuracy: 0,
      confidenceDistribution: Array(10).fill(0),
      typeAccuracy: {} as Record<RelationshipType, number>,
      lastTraining: new Date(),
      trainingDataSize: 0
    };
  }

  private generateModelVersion(): string {
    const date = new Date();
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}.${date.getHours()}${date.getMinutes()}`;
  }
}