import { Entity } from '@backstage/catalog-model';
import { Logger } from 'winston';
import { EventEmitter } from 'events';
import { CodeAnalyzer } from '../analysis/CodeAnalyzer';
import { RelationshipPredictor } from '../ml/RelationshipPredictor';

/**
 * Types for relationship discovery
 */
export interface DiscoveredRelationship {
  id: string;
  sourceEntity: string;
  targetEntity: string;
  type: RelationshipType;
  confidence: number;
  discoveryMethod: DiscoveryMethod;
  metadata: RelationshipMetadata;
  createdAt: Date;
  confirmedBy?: string;
  confirmedAt?: Date;
}

export enum RelationshipType {
  DEPENDS_ON = 'dependsOn',
  PROVIDES_API = 'providesApi',
  CONSUMES_API = 'consumesApi',
  PART_OF = 'partOf',
  OWNS = 'owns',
  DEPLOYED_TO = 'deployedTo',
  STORES_DATA_IN = 'storesDataIn',
  TRIGGERS = 'triggers',
  SUBSCRIBES_TO = 'subscribesTo',
  IMPLEMENTS = 'implements'
}

export enum DiscoveryMethod {
  CODE_ANALYSIS = 'code_analysis',
  API_TRACES = 'api_traces',
  DATABASE_SCHEMA = 'database_schema',
  SERVICE_MESH = 'service_mesh',
  CONFIGURATION = 'configuration',
  ML_PREDICTION = 'ml_prediction',
  NETWORK_ANALYSIS = 'network_analysis',
  DEPLOYMENT_MANIFEST = 'deployment_manifest'
}

export interface RelationshipMetadata {
  source: string;
  evidence: Evidence[];
  strength: number;
  lastSeen?: Date;
  frequency?: number;
  additionalData?: Record<string, any>;
}

export interface Evidence {
  type: string;
  description: string;
  location?: string;
  confidence: number;
  data?: any;
}

export interface DiscoveryConfig {
  enabledMethods: DiscoveryMethod[];
  confidenceThreshold: number;
  autoConfirmThreshold: number;
  scanInterval: number;
  maxRelationshipsPerEntity: number;
  excludePatterns: string[];
}

/**
 * Intelligent relationship auto-discovery system
 */
export class RelationshipDiscovery extends EventEmitter {
  private readonly logger: Logger;
  private readonly codeAnalyzer: CodeAnalyzer;
  private readonly mlPredictor: RelationshipPredictor;
  private readonly discoveredRelationships = new Map<string, DiscoveredRelationship>();
  private readonly entityCache = new Map<string, Entity>();
  private isRunning = false;

  constructor(
    private readonly config: DiscoveryConfig,
    logger: Logger,
    codeAnalyzer: CodeAnalyzer,
    mlPredictor: RelationshipPredictor
  ) {
    super();
    this.logger = logger;
    this.codeAnalyzer = codeAnalyzer;
    this.mlPredictor = mlPredictor;
  }

  /**
   * Start the relationship discovery process
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Relationship discovery is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting relationship discovery system');

    // Schedule periodic discovery
    setInterval(async () => {
      try {
        await this.runDiscovery();
      } catch (error) {
        this.logger.error('Discovery cycle failed:', error);
      }
    }, this.config.scanInterval);

    // Initial discovery run
    await this.runDiscovery();
  }

  /**
   * Stop the discovery system
   */
  stop(): void {
    this.isRunning = false;
    this.logger.info('Stopping relationship discovery system');
  }

  /**
   * Discover relationships for a specific entity
   */
  async discoverForEntity(entity: Entity): Promise<DiscoveredRelationship[]> {
    this.logger.info(`Discovering relationships for entity: ${entity.metadata.name}`);
    
    const relationships: DiscoveredRelationship[] = [];
    const entityRef = this.getEntityRef(entity);

    // Update entity cache
    this.entityCache.set(entityRef, entity);

    // Run all enabled discovery methods
    for (const method of this.config.enabledMethods) {
      try {
        const methodRelationships = await this.runDiscoveryMethod(method, entity);
        relationships.push(...methodRelationships);
      } catch (error) {
        this.logger.error(`Discovery method ${method} failed for ${entityRef}:`, error);
      }
    }

    // Filter and deduplicate relationships
    const filteredRelationships = this.filterRelationships(relationships);

    // Store discovered relationships
    for (const relationship of filteredRelationships) {
      this.discoveredRelationships.set(relationship.id, relationship);
    }

    // Emit discovery event
    this.emit('relationshipsDiscovered', {
      entity: entityRef,
      relationships: filteredRelationships,
      timestamp: new Date()
    });

    return filteredRelationships;
  }

  /**
   * Get all discovered relationships
   */
  getDiscoveredRelationships(): DiscoveredRelationship[] {
    return Array.from(this.discoveredRelationships.values());
  }

  /**
   * Get relationships for a specific entity
   */
  getRelationshipsForEntity(entityRef: string): DiscoveredRelationship[] {
    return Array.from(this.discoveredRelationships.values())
      .filter(rel => rel.sourceEntity === entityRef || rel.targetEntity === entityRef);
  }

  /**
   * Confirm a discovered relationship
   */
  async confirmRelationship(relationshipId: string, userId: string): Promise<void> {
    const relationship = this.discoveredRelationships.get(relationshipId);
    if (!relationship) {
      throw new Error(`Relationship not found: ${relationshipId}`);
    }

    relationship.confirmedBy = userId;
    relationship.confirmedAt = new Date();
    relationship.confidence = Math.min(1.0, relationship.confidence + 0.2); // Boost confidence

    // Inform ML predictor about confirmation
    await this.mlPredictor.learnFromConfirmation(relationship, true);

    this.emit('relationshipConfirmed', { relationship, userId });
    this.logger.info(`Relationship confirmed: ${relationshipId} by ${userId}`);
  }

  /**
   * Reject a discovered relationship
   */
  async rejectRelationship(relationshipId: string, userId: string): Promise<void> {
    const relationship = this.discoveredRelationships.get(relationshipId);
    if (!relationship) {
      throw new Error(`Relationship not found: ${relationshipId}`);
    }

    // Inform ML predictor about rejection
    await this.mlPredictor.learnFromConfirmation(relationship, false);

    // Remove from discovered relationships
    this.discoveredRelationships.delete(relationshipId);

    this.emit('relationshipRejected', { relationship, userId });
    this.logger.info(`Relationship rejected: ${relationshipId} by ${userId}`);
  }

  /**
   * Run a complete discovery cycle
   */
  private async runDiscovery(): Promise<void> {
    this.logger.info('Starting discovery cycle');
    const startTime = Date.now();

    try {
      // Get all entities from cache or external source
      const entities = Array.from(this.entityCache.values());
      
      if (entities.length === 0) {
        this.logger.warn('No entities found for discovery');
        return;
      }

      const discoveryPromises = entities.map(entity => this.discoverForEntity(entity));
      await Promise.allSettled(discoveryPromises);

      const duration = Date.now() - startTime;
      this.logger.info(`Discovery cycle completed in ${duration}ms`);

      this.emit('discoveryCompleted', {
        entitiesProcessed: entities.length,
        relationshipsFound: this.discoveredRelationships.size,
        duration
      });

    } catch (error) {
      this.logger.error('Discovery cycle failed:', error);
      this.emit('discoveryFailed', { error });
    }
  }

  /**
   * Run a specific discovery method
   */
  private async runDiscoveryMethod(
    method: DiscoveryMethod,
    entity: Entity
  ): Promise<DiscoveredRelationship[]> {
    
    switch (method) {
      case DiscoveryMethod.CODE_ANALYSIS:
        return this.discoverFromCode(entity);
      
      case DiscoveryMethod.API_TRACES:
        return this.discoverFromApiTraces(entity);
      
      case DiscoveryMethod.DATABASE_SCHEMA:
        return this.discoverFromDatabase(entity);
      
      case DiscoveryMethod.SERVICE_MESH:
        return this.discoverFromServiceMesh(entity);
      
      case DiscoveryMethod.CONFIGURATION:
        return this.discoverFromConfiguration(entity);
      
      case DiscoveryMethod.ML_PREDICTION:
        return this.discoverFromMlPrediction(entity);
      
      case DiscoveryMethod.NETWORK_ANALYSIS:
        return this.discoverFromNetworkAnalysis(entity);
      
      case DiscoveryMethod.DEPLOYMENT_MANIFEST:
        return this.discoverFromDeploymentManifest(entity);
      
      default:
        return [];
    }
  }

  /**
   * Discover relationships from code analysis
   */
  private async discoverFromCode(entity: Entity): Promise<DiscoveredRelationship[]> {
    const relationships: DiscoveredRelationship[] = [];
    
    try {
      const codeAnalysis = await this.codeAnalyzer.analyzeEntity(entity);
      
      // API dependencies
      for (const apiDep of codeAnalysis.apiDependencies) {
        const relationship = this.createRelationship(
          entity,
          apiDep.targetService,
          RelationshipType.CONSUMES_API,
          DiscoveryMethod.CODE_ANALYSIS,
          apiDep.confidence,
          {
            evidence: [{
              type: 'api_call',
              description: `API call found in ${apiDep.location}`,
              location: apiDep.location,
              confidence: apiDep.confidence,
              data: { endpoint: apiDep.endpoint, method: apiDep.method }
            }]
          }
        );
        relationships.push(relationship);
      }

      // Database dependencies
      for (const dbDep of codeAnalysis.databaseDependencies) {
        const relationship = this.createRelationship(
          entity,
          dbDep.database,
          RelationshipType.STORES_DATA_IN,
          DiscoveryMethod.CODE_ANALYSIS,
          dbDep.confidence,
          {
            evidence: [{
              type: 'database_query',
              description: `Database query found in ${dbDep.location}`,
              location: dbDep.location,
              confidence: dbDep.confidence,
              data: { tables: dbDep.tables, operations: dbDep.operations }
            }]
          }
        );
        relationships.push(relationship);
      }

      // Import dependencies
      for (const importDep of codeAnalysis.importDependencies) {
        const relationship = this.createRelationship(
          entity,
          importDep.module,
          RelationshipType.DEPENDS_ON,
          DiscoveryMethod.CODE_ANALYSIS,
          importDep.confidence,
          {
            evidence: [{
              type: 'import_statement',
              description: `Import statement found in ${importDep.location}`,
              location: importDep.location,
              confidence: importDep.confidence,
              data: { importPath: importDep.importPath, usage: importDep.usage }
            }]
          }
        );
        relationships.push(relationship);
      }

    } catch (error) {
      this.logger.error(`Code analysis failed for ${entity.metadata.name}:`, error);
    }

    return relationships;
  }

  /**
   * Discover relationships from API traces/logs
   */
  private async discoverFromApiTraces(entity: Entity): Promise<DiscoveredRelationship[]> {
    const relationships: DiscoveredRelationship[] = [];
    
    try {
      // This would integrate with observability systems like Jaeger, Zipkin, etc.
      // For now, implementing a placeholder that could be extended
      
      const serviceName = entity.metadata.name;
      const traces = await this.fetchApiTraces(serviceName);
      
      for (const trace of traces) {
        for (const span of trace.spans) {
          if (span.serviceName !== serviceName && span.operationType === 'http_request') {
            const confidence = this.calculateTraceConfidence(span);
            
            const relationship = this.createRelationship(
              entity,
              span.serviceName,
              RelationshipType.CONSUMES_API,
              DiscoveryMethod.API_TRACES,
              confidence,
              {
                evidence: [{
                  type: 'api_trace',
                  description: `API call traced to ${span.serviceName}`,
                  confidence,
                  data: {
                    endpoint: span.endpoint,
                    method: span.httpMethod,
                    responseTime: span.duration,
                    frequency: span.frequency
                  }
                }],
                frequency: span.frequency,
                lastSeen: span.timestamp
              }
            );
            
            relationships.push(relationship);
          }
        }
      }
      
    } catch (error) {
      this.logger.error(`API trace analysis failed for ${entity.metadata.name}:`, error);
    }

    return relationships;
  }

  /**
   * Discover relationships from database schema analysis
   */
  private async discoverFromDatabase(entity: Entity): Promise<DiscoveredRelationship[]> {
    const relationships: DiscoveredRelationship[] = [];
    
    try {
      const dbConnections = await this.getDatabaseConnections(entity);
      
      for (const connection of dbConnections) {
        const schema = await this.analyzeDatabaseSchema(connection);
        
        // Foreign key relationships
        for (const fk of schema.foreignKeys) {
          const targetEntity = await this.findEntityByTable(fk.referencedTable);
          if (targetEntity) {
            const relationship = this.createRelationship(
              entity,
              this.getEntityRef(targetEntity),
              RelationshipType.DEPENDS_ON,
              DiscoveryMethod.DATABASE_SCHEMA,
              0.9, // High confidence for schema relationships
              {
                evidence: [{
                  type: 'foreign_key',
                  description: `Foreign key constraint: ${fk.column} -> ${fk.referencedTable}.${fk.referencedColumn}`,
                  confidence: 0.9,
                  data: {
                    table: fk.table,
                    column: fk.column,
                    referencedTable: fk.referencedTable,
                    referencedColumn: fk.referencedColumn
                  }
                }]
              }
            );
            relationships.push(relationship);
          }
        }

        // Shared table relationships
        for (const sharedTable of schema.sharedTables) {
          for (const otherEntity of sharedTable.accessedBy) {
            if (otherEntity !== entity.metadata.name) {
              const relationship = this.createRelationship(
                entity,
                otherEntity,
                RelationshipType.STORES_DATA_IN,
                DiscoveryMethod.DATABASE_SCHEMA,
                0.7,
                {
                  evidence: [{
                    type: 'shared_table',
                    description: `Both services access table: ${sharedTable.name}`,
                    confidence: 0.7,
                    data: { tableName: sharedTable.name, operations: sharedTable.operations }
                  }]
                }
              );
              relationships.push(relationship);
            }
          }
        }
      }
      
    } catch (error) {
      this.logger.error(`Database analysis failed for ${entity.metadata.name}:`, error);
    }

    return relationships;
  }

  /**
   * Discover relationships from service mesh integration
   */
  private async discoverFromServiceMesh(entity: Entity): Promise<DiscoveredRelationship[]> {
    const relationships: DiscoveredRelationship[] = [];
    
    try {
      // Integration with service mesh systems like Istio, Linkerd, Consul Connect
      const meshData = await this.getServiceMeshData(entity);
      
      // Service-to-service communication
      for (const connection of meshData.connections) {
        const confidence = this.calculateMeshConfidence(connection);
        
        const relationship = this.createRelationship(
          entity,
          connection.targetService,
          RelationshipType.CONSUMES_API,
          DiscoveryMethod.SERVICE_MESH,
          confidence,
          {
            evidence: [{
              type: 'service_mesh_traffic',
              description: `Service mesh traffic to ${connection.targetService}`,
              confidence,
              data: {
                protocol: connection.protocol,
                requestRate: connection.requestRate,
                successRate: connection.successRate,
                latency: connection.latency
              }
            }],
            frequency: connection.requestRate,
            lastSeen: connection.lastSeen
          }
        );
        
        relationships.push(relationship);
      }
      
    } catch (error) {
      this.logger.error(`Service mesh analysis failed for ${entity.metadata.name}:`, error);
    }

    return relationships;
  }

  /**
   * Discover relationships from configuration analysis
   */
  private async discoverFromConfiguration(entity: Entity): Promise<DiscoveredRelationship[]> {
    const relationships: DiscoveredRelationship[] = [];
    
    try {
      const configs = await this.getEntityConfigurations(entity);
      
      for (const config of configs) {
        // Environment variable dependencies
        for (const envVar of config.environmentVariables) {
          if (this.isServiceReference(envVar.value)) {
            const targetService = this.extractServiceFromEnvVar(envVar.value);
            
            const relationship = this.createRelationship(
              entity,
              targetService,
              RelationshipType.DEPENDS_ON,
              DiscoveryMethod.CONFIGURATION,
              0.8,
              {
                evidence: [{
                  type: 'environment_variable',
                  description: `Environment variable ${envVar.name} references ${targetService}`,
                  confidence: 0.8,
                  data: { variable: envVar.name, value: envVar.value }
                }]
              }
            );
            
            relationships.push(relationship);
          }
        }

        // Configuration file dependencies
        for (const dependency of config.configDependencies) {
          const relationship = this.createRelationship(
            entity,
            dependency.service,
            dependency.type as RelationshipType,
            DiscoveryMethod.CONFIGURATION,
            dependency.confidence,
            {
              evidence: [{
                type: 'configuration_dependency',
                description: `Configuration dependency found in ${dependency.source}`,
                location: dependency.source,
                confidence: dependency.confidence,
                data: dependency.metadata
              }]
            }
          );
          
          relationships.push(relationship);
        }
      }
      
    } catch (error) {
      this.logger.error(`Configuration analysis failed for ${entity.metadata.name}:`, error);
    }

    return relationships;
  }

  /**
   * Discover relationships using ML prediction
   */
  private async discoverFromMlPrediction(entity: Entity): Promise<DiscoveredRelationship[]> {
    const relationships: DiscoveredRelationship[] = [];
    
    try {
      const predictions = await this.mlPredictor.predictRelationships(entity, this.entityCache);
      
      for (const prediction of predictions) {
        if (prediction.confidence >= this.config.confidenceThreshold) {
          const relationship = this.createRelationship(
            entity,
            prediction.targetEntity,
            prediction.type,
            DiscoveryMethod.ML_PREDICTION,
            prediction.confidence,
            {
              evidence: [{
                type: 'ml_prediction',
                description: `ML model predicted ${prediction.type} relationship`,
                confidence: prediction.confidence,
                data: {
                  modelVersion: prediction.modelVersion,
                  features: prediction.features,
                  reasoning: prediction.reasoning
                }
              }]
            }
          );
          
          relationships.push(relationship);
        }
      }
      
    } catch (error) {
      this.logger.error(`ML prediction failed for ${entity.metadata.name}:`, error);
    }

    return relationships;
  }

  /**
   * Discover relationships from network analysis
   */
  private async discoverFromNetworkAnalysis(entity: Entity): Promise<DiscoveredRelationship[]> {
    const relationships: DiscoveredRelationship[] = [];
    
    try {
      const networkData = await this.getNetworkAnalysis(entity);
      
      for (const connection of networkData.outgoingConnections) {
        const targetEntity = await this.findEntityByNetworkEndpoint(connection.destination);
        
        if (targetEntity) {
          const confidence = this.calculateNetworkConfidence(connection);
          
          const relationship = this.createRelationship(
            entity,
            this.getEntityRef(targetEntity),
            RelationshipType.CONSUMES_API,
            DiscoveryMethod.NETWORK_ANALYSIS,
            confidence,
            {
              evidence: [{
                type: 'network_connection',
                description: `Network connection to ${connection.destination}`,
                confidence,
                data: {
                  protocol: connection.protocol,
                  port: connection.port,
                  frequency: connection.frequency,
                  dataTransferred: connection.dataTransferred
                }
              }],
              frequency: connection.frequency,
              lastSeen: connection.lastSeen
            }
          );
          
          relationships.push(relationship);
        }
      }
      
    } catch (error) {
      this.logger.error(`Network analysis failed for ${entity.metadata.name}:`, error);
    }

    return relationships;
  }

  /**
   * Discover relationships from deployment manifests
   */
  private async discoverFromDeploymentManifest(entity: Entity): Promise<DiscoveredRelationship[]> {
    const relationships: DiscoveredRelationship[] = [];
    
    try {
      const manifests = await this.getDeploymentManifests(entity);
      
      for (const manifest of manifests) {
        // Service dependencies from Kubernetes manifests
        for (const service of manifest.serviceDependencies) {
          const relationship = this.createRelationship(
            entity,
            service.name,
            RelationshipType.DEPENDS_ON,
            DiscoveryMethod.DEPLOYMENT_MANIFEST,
            0.9,
            {
              evidence: [{
                type: 'k8s_service_dependency',
                description: `Kubernetes service dependency: ${service.name}`,
                confidence: 0.9,
                data: {
                  namespace: service.namespace,
                  port: service.port,
                  manifestFile: manifest.source
                }
              }]
            }
          );
          
          relationships.push(relationship);
        }

        // ConfigMap and Secret dependencies
        for (const configRef of manifest.configReferences) {
          if (configRef.type === 'external_service') {
            const relationship = this.createRelationship(
              entity,
              configRef.target,
              RelationshipType.DEPENDS_ON,
              DiscoveryMethod.DEPLOYMENT_MANIFEST,
              0.7,
              {
                evidence: [{
                  type: 'config_reference',
                  description: `Configuration reference to ${configRef.target}`,
                  confidence: 0.7,
                  data: {
                    configType: configRef.configType,
                    key: configRef.key,
                    manifestFile: manifest.source
                  }
                }]
              }
            );
            
            relationships.push(relationship);
          }
        }
      }
      
    } catch (error) {
      this.logger.error(`Deployment manifest analysis failed for ${entity.metadata.name}:`, error);
    }

    return relationships;
  }

  /**
   * Helper methods for external integrations (placeholders for actual implementations)
   */
  private async fetchApiTraces(serviceName: string): Promise<any[]> {
    // Integration with tracing systems
    return [];
  }

  private async getDatabaseConnections(entity: Entity): Promise<any[]> {
    // Get database connections for the entity
    return [];
  }

  private async analyzeDatabaseSchema(connection: any): Promise<any> {
    // Analyze database schema
    return { foreignKeys: [], sharedTables: [] };
  }

  private async getServiceMeshData(entity: Entity): Promise<any> {
    // Get service mesh data
    return { connections: [] };
  }

  private async getEntityConfigurations(entity: Entity): Promise<any[]> {
    // Get configuration files and environment variables
    return [];
  }

  private async getNetworkAnalysis(entity: Entity): Promise<any> {
    // Get network analysis data
    return { outgoingConnections: [] };
  }

  private async getDeploymentManifests(entity: Entity): Promise<any[]> {
    // Get deployment manifests
    return [];
  }

  /**
   * Utility methods
   */
  private createRelationship(
    sourceEntity: Entity,
    targetEntityRef: string,
    type: RelationshipType,
    method: DiscoveryMethod,
    confidence: number,
    metadataPartial: Partial<RelationshipMetadata>
  ): DiscoveredRelationship {
    const sourceRef = this.getEntityRef(sourceEntity);
    const id = `${sourceRef}:${type}:${targetEntityRef}:${method}`;
    
    return {
      id,
      sourceEntity: sourceRef,
      targetEntity: targetEntityRef,
      type,
      confidence: Math.min(1.0, confidence),
      discoveryMethod: method,
      metadata: {
        source: method,
        evidence: [],
        strength: confidence,
        ...metadataPartial
      },
      createdAt: new Date()
    };
  }

  private getEntityRef(entity: Entity): string {
    return `${entity.kind.toLowerCase()}:${entity.metadata.namespace}/${entity.metadata.name}`;
  }

  private filterRelationships(relationships: DiscoveredRelationship[]): DiscoveredRelationship[] {
    // Remove duplicates and apply filters
    const uniqueRelationships = new Map<string, DiscoveredRelationship>();
    
    for (const relationship of relationships) {
      const key = `${relationship.sourceEntity}:${relationship.type}:${relationship.targetEntity}`;
      const existing = uniqueRelationships.get(key);
      
      if (!existing || relationship.confidence > existing.confidence) {
        uniqueRelationships.set(key, relationship);
      }
    }
    
    return Array.from(uniqueRelationships.values())
      .filter(rel => rel.confidence >= this.config.confidenceThreshold)
      .filter(rel => !this.isExcluded(rel));
  }

  private isExcluded(relationship: DiscoveredRelationship): boolean {
    return this.config.excludePatterns.some(pattern => 
      relationship.sourceEntity.includes(pattern) || 
      relationship.targetEntity.includes(pattern)
    );
  }

  private calculateTraceConfidence(span: any): number {
    // Calculate confidence based on trace data
    let confidence = 0.6; // Base confidence
    
    if (span.frequency > 100) confidence += 0.2;
    if (span.successRate > 0.95) confidence += 0.1;
    if (span.duration < 100) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  private calculateMeshConfidence(connection: any): number {
    // Calculate confidence based on service mesh data
    let confidence = 0.7; // Base confidence
    
    if (connection.requestRate > 10) confidence += 0.1;
    if (connection.successRate > 0.99) confidence += 0.1;
    if (connection.latency < 50) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  private calculateNetworkConfidence(connection: any): number {
    // Calculate confidence based on network data
    let confidence = 0.5; // Base confidence
    
    if (connection.frequency > 50) confidence += 0.2;
    if (connection.protocol === 'https') confidence += 0.1;
    if (connection.dataTransferred > 1000) confidence += 0.2;
    
    return Math.min(1.0, confidence);
  }

  private isServiceReference(value: string): boolean {
    // Check if environment variable value references a service
    return /^(http|https):\/\//.test(value) || 
           value.includes('.service.') ||
           value.includes('-service') ||
           value.includes('_SERVICE_');
  }

  private extractServiceFromEnvVar(value: string): string {
    // Extract service name from environment variable value
    if (value.startsWith('http')) {
      const url = new URL(value);
      return url.hostname.split('.')[0];
    }
    
    return value.replace(/[_\-]SERVICE[_\-]?.*$/i, '').toLowerCase();
  }

  private async findEntityByTable(tableName: string): Promise<Entity | null> {
    // Find entity that owns a specific database table
    for (const entity of this.entityCache.values()) {
      const tables = entity.metadata.annotations?.['database.tables']?.split(',') || [];
      if (tables.includes(tableName)) {
        return entity;
      }
    }
    return null;
  }

  private async findEntityByNetworkEndpoint(endpoint: string): Promise<Entity | null> {
    // Find entity by network endpoint
    for (const entity of this.entityCache.values()) {
      const endpoints = entity.metadata.annotations?.['network.endpoints']?.split(',') || [];
      if (endpoints.some(ep => endpoint.includes(ep))) {
        return entity;
      }
    }
    return null;
  }
}

/**
 * Default configuration for relationship discovery
 */
export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  enabledMethods: [
    DiscoveryMethod.CODE_ANALYSIS,
    DiscoveryMethod.API_TRACES,
    DiscoveryMethod.DATABASE_SCHEMA,
    DiscoveryMethod.SERVICE_MESH,
    DiscoveryMethod.CONFIGURATION,
    DiscoveryMethod.ML_PREDICTION,
    DiscoveryMethod.DEPLOYMENT_MANIFEST
  ],
  confidenceThreshold: 0.6,
  autoConfirmThreshold: 0.9,
  scanInterval: 300000, // 5 minutes
  maxRelationshipsPerEntity: 50,
  excludePatterns: ['test-', 'mock-', 'temp-']
};