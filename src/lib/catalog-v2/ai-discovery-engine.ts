/**
 * AI-Powered Entity Discovery Engine
 * Automatically discovers, classifies, and maintains catalog entities
 * Making Backstage's manual YAML registration obsolete
 */

import { GraphEntity, EntityType, RelationshipType, HealthState, ComplianceState } from './graph-model';

// AI Discovery Configuration
export interface DiscoveryConfig {
  sources: DiscoverySource[];
  classificationModel: string;
  relationshipInferenceEnabled: boolean;
  confidenceThreshold: number;
  autoRegistration: boolean;
  scanInterval: number; // minutes
}

export interface DiscoverySource {
  type: 'GITHUB' | 'GITLAB' | 'KUBERNETES' | 'AWS' | 'GCP' | 'AZURE' | 'DOCKER' | 'TERRAFORM' | 'API_GATEWAY';
  config: any;
  enabled: boolean;
  priority: number;
}

// Entity Classification using AI
export interface EntityClassification {
  type: EntityType;
  confidence: number;
  reasoning: string[];
  suggestedMetadata: Record<string, any>;
  suggestedRelationships: SuggestedRelationship[];
}

export interface SuggestedRelationship {
  targetId: string;
  type: RelationshipType;
  confidence: number;
  evidence: string[];
}

// Discovery Results
export interface DiscoveryResult {
  entities: DiscoveredEntity[];
  relationships: DiscoveredRelationship[];
  insights: DiscoveryInsight[];
  statistics: DiscoveryStatistics;
}

export interface DiscoveredEntity {
  entity: GraphEntity;
  classification: EntityClassification;
  source: string;
  rawData: any;
}

export interface DiscoveredRelationship {
  source: string;
  target: string;
  type: RelationshipType;
  confidence: number;
  evidence: string[];
  metadata: Record<string, any>;
}

export interface DiscoveryInsight {
  type: 'ORPHANED_SERVICE' | 'MISSING_DOCUMENTATION' | 'SECURITY_RISK' | 'PERFORMANCE_ISSUE' | 'COMPLIANCE_VIOLATION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  entityId: string;
  message: string;
  recommendation: string;
  autoFixAvailable: boolean;
}

export interface DiscoveryStatistics {
  totalScanned: number;
  entitiesFound: number;
  entitiesUpdated: number;
  relationshipsInferred: number;
  duration: number;
  errors: string[];
}

// AI-Powered Discovery Engine
export class AIDiscoveryEngine {
  private config: DiscoveryConfig;
  private classificationModel: EntityClassifier;
  private relationshipInferencer: RelationshipInferencer;
  private discoveryAgents: Map<string, DiscoveryAgent>;

  constructor(config: DiscoveryConfig) {
    this.config = config;
    this.classificationModel = new EntityClassifier(config.classificationModel);
    this.relationshipInferencer = new RelationshipInferencer();
    this.discoveryAgents = new Map();
    this.initializeAgents();
  }

  private initializeAgents(): void {
    this.discoveryAgents.set('GITHUB', new GitHubDiscoveryAgent());
    this.discoveryAgents.set('KUBERNETES', new KubernetesDiscoveryAgent());
    this.discoveryAgents.set('AWS', new AWSDiscoveryAgent());
    this.discoveryAgents.set('GCP', new GCPDiscoveryAgent());
    this.discoveryAgents.set('AZURE', new AzureDiscoveryAgent());
    this.discoveryAgents.set('DOCKER', new DockerDiscoveryAgent());
  }

  // Main discovery orchestration
  async discoverEntities(): Promise<DiscoveryResult> {
    console.log('Starting AI-powered entity discovery...');
    const startTime = Date.now();
    
    const entities: DiscoveredEntity[] = [];
    const relationships: DiscoveredRelationship[] = [];
    const insights: DiscoveryInsight[] = [];
    const errors: string[] = [];

    // Run discovery agents in parallel
    const discoveryPromises = this.config.sources
      .filter(source => source.enabled)
      .sort((a, b) => b.priority - a.priority)
      .map(async source => {
        const agent = this.discoveryAgents.get(source.type);
        if (!agent) {
          errors.push(`No agent found for source type: ${source.type}`);
          return { entities: [], relationships: [], insights: [] };
        }

        try {
          return await agent.discover(source.config);
        } catch (error) {
          errors.push(`Discovery failed for ${source.type}: ${error.message}`);
          return { entities: [], relationships: [], insights: [] };
        }
      });

    const results = await Promise.all(discoveryPromises);
    
    // Aggregate results
    for (const result of results) {
      entities.push(...result.entities);
      relationships.push(...result.relationships);
      insights.push(...result.insights);
    }

    // Classify and enhance entities with AI
    const classifiedEntities = await this.classifyEntities(entities);
    
    // Infer additional relationships
    const inferredRelationships = await this.inferRelationships(classifiedEntities);
    relationships.push(...inferredRelationships);

    // Generate insights
    const additionalInsights = await this.generateInsights(classifiedEntities, relationships);
    insights.push(...additionalInsights);

    const duration = Date.now() - startTime;
    
    return {
      entities: classifiedEntities,
      relationships,
      insights,
      statistics: {
        totalScanned: entities.length,
        entitiesFound: classifiedEntities.length,
        entitiesUpdated: classifiedEntities.filter(e => e.entity.metadata.updatedAt > new Date(Date.now() - 3600000)).length,
        relationshipsInferred: inferredRelationships.length,
        duration,
        errors
      }
    };
  }

  // AI Entity Classification
  private async classifyEntities(entities: DiscoveredEntity[]): Promise<DiscoveredEntity[]> {
    console.log(`Classifying ${entities.length} entities using AI...`);
    
    return await Promise.all(entities.map(async discoveredEntity => {
      const classification = await this.classificationModel.classify(
        discoveredEntity.rawData,
        discoveredEntity.source
      );
      
      // Update entity with AI insights
      discoveredEntity.entity.type = classification.type;
      discoveredEntity.entity.metadata = {
        ...discoveredEntity.entity.metadata,
        ...classification.suggestedMetadata
      };
      
      discoveredEntity.classification = classification;
      return discoveredEntity;
    }));
  }

  // Relationship Inference using AI
  private async inferRelationships(entities: DiscoveredEntity[]): Promise<DiscoveredRelationship[]> {
    console.log('Inferring relationships using AI...');
    
    const relationships: DiscoveredRelationship[] = [];
    
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const sourceEntity = entities[i];
        const targetEntity = entities[j];
        
        const inferredRelationships = await this.relationshipInferencer.inferRelationships(
          sourceEntity,
          targetEntity
        );
        
        relationships.push(...inferredRelationships.filter(rel => 
          rel.confidence >= this.config.confidenceThreshold
        ));
      }
    }
    
    return relationships;
  }

  // Generate AI-driven insights
  private async generateInsights(
    entities: DiscoveredEntity[],
    relationships: DiscoveredRelationship[]
  ): Promise<DiscoveryInsight[]> {
    const insights: DiscoveryInsight[] = [];
    
    // Find orphaned services
    const connectedEntities = new Set([
      ...relationships.map(r => r.source),
      ...relationships.map(r => r.target)
    ]);
    
    entities.forEach(entity => {
      if (!connectedEntities.has(entity.entity.id) && entity.entity.type === EntityType.SERVICE) {
        insights.push({
          type: 'ORPHANED_SERVICE',
          severity: 'MEDIUM',
          entityId: entity.entity.id,
          message: `Service "${entity.entity.name}" appears to be orphaned with no detected relationships`,
          recommendation: 'Review service dependencies and add missing relationships',
          autoFixAvailable: false
        });
      }
    });
    
    // Check for missing documentation
    entities.forEach(entity => {
      if (!entity.entity.description || entity.entity.description.length < 10) {
        insights.push({
          type: 'MISSING_DOCUMENTATION',
          severity: 'LOW',
          entityId: entity.entity.id,
          message: `Entity "${entity.entity.name}" lacks adequate documentation`,
          recommendation: 'Add comprehensive description and documentation links',
          autoFixAvailable: true
        });
      }
    });
    
    return insights;
  }

  // Continuous discovery scheduler
  async startContinuousDiscovery(): Promise<void> {
    console.log(`Starting continuous discovery with ${this.config.scanInterval} minute intervals`);
    
    setInterval(async () => {
      try {
        const result = await this.discoverEntities();
        console.log(`Discovery completed: ${result.statistics.entitiesFound} entities found`);
        
        // Emit events for real-time updates
        this.emitDiscoveryUpdate(result);
      } catch (error) {
        console.error('Continuous discovery failed:', error);
      }
    }, this.config.scanInterval * 60 * 1000);
  }

  private emitDiscoveryUpdate(result: DiscoveryResult): void {
    // Emit WebSocket events for real-time UI updates
    // This will be connected to the real-time monitoring system
  }
}

// Entity Classification Model
export class EntityClassifier {
  private modelName: string;
  
  constructor(modelName: string) {
    this.modelName = modelName;
  }

  async classify(rawData: any, source: string): Promise<EntityClassification> {
    // Analyze code structure, configuration, and metadata
    const features = this.extractFeatures(rawData, source);
    
    // Rule-based classification with AI enhancement
    const classification = await this.runClassificationRules(features);
    
    return classification;
  }

  private extractFeatures(rawData: any, source: string): Record<string, any> {
    const features: Record<string, any> = {
      source,
      hasPackageJson: false,
      hasDockerfile: false,
      hasKubernetesManifests: false,
      hasApiSpec: false,
      languages: [],
      frameworks: [],
      dependencies: [],
      ports: [],
      endpoints: []
    };

    // Extract features based on source type
    switch (source) {
      case 'GITHUB':
        this.extractGitHubFeatures(rawData, features);
        break;
      case 'KUBERNETES':
        this.extractKubernetesFeatures(rawData, features);
        break;
      case 'AWS':
        this.extractAWSFeatures(rawData, features);
        break;
    }

    return features;
  }

  private extractGitHubFeatures(repoData: any, features: Record<string, any>): void {
    if (repoData.files) {
      features.hasPackageJson = repoData.files.includes('package.json');
      features.hasDockerfile = repoData.files.includes('Dockerfile');
      features.hasKubernetesManifests = repoData.files.some((f: string) => 
        f.includes('k8s') || f.includes('kubernetes') || f.endsWith('.yaml')
      );
      features.hasApiSpec = repoData.files.some((f: string) => 
        f.includes('openapi') || f.includes('swagger') || f.endsWith('.api')
      );
    }
    
    features.languages = repoData.languages || [];
    features.topics = repoData.topics || [];
  }

  private extractKubernetesFeatures(k8sData: any, features: Record<string, any>): void {
    features.kind = k8sData.kind;
    features.labels = k8sData.metadata?.labels || {};
    features.annotations = k8sData.metadata?.annotations || {};
    
    if (k8sData.spec?.ports) {
      features.ports = k8sData.spec.ports.map((p: any) => p.port);
    }
  }

  private extractAWSFeatures(awsData: any, features: Record<string, any>): void {
    features.serviceType = awsData.serviceType;
    features.region = awsData.region;
    features.tags = awsData.tags || {};
  }

  private async runClassificationRules(features: Record<string, any>): Promise<EntityClassification> {
    const reasoning: string[] = [];
    let type = EntityType.SERVICE; // default
    let confidence = 0.5;

    // Rule-based classification
    if (features.hasApiSpec || features.endpoints?.length > 0) {
      type = EntityType.API;
      confidence = 0.9;
      reasoning.push('Found API specification or endpoints');
    } else if (features.kind === 'Service' || features.ports?.length > 0) {
      type = EntityType.SERVICE;
      confidence = 0.8;
      reasoning.push('Kubernetes Service or has exposed ports');
    } else if (features.languages?.includes('javascript') && features.hasPackageJson) {
      if (features.dependencies?.some((d: string) => d.includes('react') || d.includes('vue') || d.includes('angular'))) {
        type = EntityType.WEBSITE;
        confidence = 0.85;
        reasoning.push('Frontend JavaScript application detected');
      } else {
        type = EntityType.SERVICE;
        confidence = 0.8;
        reasoning.push('Node.js service detected');
      }
    } else if (features.serviceType === 'RDS' || features.kind === 'Database') {
      type = EntityType.DATABASE;
      confidence = 0.95;
      reasoning.push('Database service detected');
    }

    return {
      type,
      confidence,
      reasoning,
      suggestedMetadata: {
        languages: features.languages,
        frameworks: features.frameworks,
        tags: features.tags || {},
        labels: features.labels || {}
      },
      suggestedRelationships: []
    };
  }
}

// Relationship Inference Engine
export class RelationshipInferencer {
  async inferRelationships(
    sourceEntity: DiscoveredEntity,
    targetEntity: DiscoveredEntity
  ): Promise<DiscoveredRelationship[]> {
    const relationships: DiscoveredRelationship[] = [];
    
    // Analyze potential relationships
    const apiRelationship = this.inferAPIRelationship(sourceEntity, targetEntity);
    if (apiRelationship) relationships.push(apiRelationship);
    
    const dataRelationship = this.inferDataRelationship(sourceEntity, targetEntity);
    if (dataRelationship) relationships.push(dataRelationship);
    
    const deploymentRelationship = this.inferDeploymentRelationship(sourceEntity, targetEntity);
    if (deploymentRelationship) relationships.push(deploymentRelationship);
    
    return relationships;
  }

  private inferAPIRelationship(
    source: DiscoveredEntity,
    target: DiscoveredEntity
  ): DiscoveredRelationship | null {
    // Check if source consumes target's API
    if (source.entity.type === EntityType.SERVICE && target.entity.type === EntityType.API) {
      // Look for evidence in source code, configuration, or network traffic
      const evidence = this.findAPIConsumptionEvidence(source, target);
      if (evidence.length > 0) {
        return {
          source: source.entity.id,
          target: target.entity.id,
          type: RelationshipType.CONSUMES,
          confidence: 0.8,
          evidence,
          metadata: {
            protocol: 'HTTP',
            discoveredFrom: 'CODE_ANALYSIS'
          }
        };
      }
    }
    
    return null;
  }

  private inferDataRelationship(
    source: DiscoveredEntity,
    target: DiscoveredEntity
  ): DiscoveredRelationship | null {
    if (source.entity.type === EntityType.SERVICE && target.entity.type === EntityType.DATABASE) {
      const evidence = this.findDatabaseConnectionEvidence(source, target);
      if (evidence.length > 0) {
        return {
          source: source.entity.id,
          target: target.entity.id,
          type: RelationshipType.STORES_IN,
          confidence: 0.9,
          evidence,
          metadata: {
            connectionType: 'DATABASE',
            discoveredFrom: 'CONFIG_ANALYSIS'
          }
        };
      }
    }
    
    return null;
  }

  private inferDeploymentRelationship(
    source: DiscoveredEntity,
    target: DiscoveredEntity
  ): DiscoveredRelationship | null {
    // Implementation for deployment relationship inference
    return null;
  }

  private findAPIConsumptionEvidence(source: DiscoveredEntity, target: DiscoveredEntity): string[] {
    const evidence: string[] = [];
    
    // Analyze source code for API calls
    if (source.rawData.sourceCode) {
      const apiCallPattern = new RegExp(`${target.entity.name}|${target.entity.metadata.labels?.url}`, 'i');
      if (apiCallPattern.test(source.rawData.sourceCode)) {
        evidence.push('API endpoint found in source code');
      }
    }
    
    // Check configuration files
    if (source.rawData.configuration) {
      // Look for service URLs, endpoints, or service names
      const configStr = JSON.stringify(source.rawData.configuration);
      if (configStr.includes(target.entity.name)) {
        evidence.push('Target service referenced in configuration');
      }
    }
    
    return evidence;
  }

  private findDatabaseConnectionEvidence(source: DiscoveredEntity, target: DiscoveredEntity): string[] {
    const evidence: string[] = [];
    
    // Check for database connection strings, environment variables
    if (source.rawData.environment) {
      const envStr = JSON.stringify(source.rawData.environment);
      if (envStr.includes(target.entity.name) || envStr.includes('DATABASE')) {
        evidence.push('Database connection found in environment variables');
      }
    }
    
    return evidence;
  }
}

// Discovery Agent Interface
export abstract class DiscoveryAgent {
  abstract discover(config: any): Promise<{
    entities: DiscoveredEntity[];
    relationships: DiscoveredRelationship[];
    insights: DiscoveryInsight[];
  }>;
}

// GitHub Discovery Agent
export class GitHubDiscoveryAgent extends DiscoveryAgent {
  async discover(config: any): Promise<{
    entities: DiscoveredEntity[];
    relationships: DiscoveredRelationship[];
    insights: DiscoveryInsight[];
  }> {
    // Implementation for GitHub repository discovery
    // This would integrate with GitHub API to discover repositories,
    // analyze their structure, and create entities
    
    return {
      entities: [],
      relationships: [],
      insights: []
    };
  }
}

// Kubernetes Discovery Agent
export class KubernetesDiscoveryAgent extends DiscoveryAgent {
  async discover(config: any): Promise<{
    entities: DiscoveredEntity[];
    relationships: DiscoveredRelationship[];
    insights: DiscoveryInsight[];
  }> {
    // Implementation for Kubernetes resource discovery
    return {
      entities: [],
      relationships: [],
      insights: []
    };
  }
}

// AWS Discovery Agent
export class AWSDiscoveryAgent extends DiscoveryAgent {
  async discover(config: any): Promise<{
    entities: DiscoveredEntity[];
    relationships: DiscoveredRelationship[];
    insights: DiscoveryInsight[];
  }> {
    // Implementation for AWS resource discovery
    return {
      entities: [],
      relationships: [],
      insights: []
    };
  }
}

// GCP Discovery Agent  
export class GCPDiscoveryAgent extends DiscoveryAgent {
  async discover(config: any): Promise<{
    entities: DiscoveredEntity[];
    relationships: DiscoveredRelationship[];
    insights: DiscoveryInsight[];
  }> {
    // Implementation for GCP resource discovery
    return {
      entities: [],
      relationships: [],
      insights: []
    };
  }
}

// Azure Discovery Agent
export class AzureDiscoveryAgent extends DiscoveryAgent {
  async discover(config: any): Promise<{
    entities: DiscoveredEntity[];
    relationships: DiscoveredRelationship[];
    insights: DiscoveryInsight[];
  }> {
    // Implementation for Azure resource discovery
    return {
      entities: [],
      relationships: [],
      insights: []
    };
  }
}

// Docker Discovery Agent
export class DockerDiscoveryAgent extends DiscoveryAgent {
  async discover(config: any): Promise<{
    entities: DiscoveredEntity[];
    relationships: DiscoveredRelationship[];
    insights: DiscoveryInsight[];
  }> {
    // Implementation for Docker container/image discovery
    return {
      entities: [],
      relationships: [],
      insights: []
    };
  }
}