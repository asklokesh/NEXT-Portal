/**
 * Software Catalog v2 - Graph-Based Entity Model
 * Revolutionizing Backstage's flat YAML approach with Neo4j graph intelligence
 */

import { Driver, Session, Node, Relationship } from 'neo4j-driver';

// Core Entity Types - Extensible beyond Backstage's rigid categories
export enum EntityType {
  SERVICE = 'SERVICE',
  API = 'API',
  WEBSITE = 'WEBSITE',
  LIBRARY = 'LIBRARY',
  RESOURCE = 'RESOURCE',
  DOMAIN = 'DOMAIN',
  SYSTEM = 'SYSTEM',
  GROUP = 'GROUP',
  USER = 'USER',
  LOCATION = 'LOCATION',
  // Catalog v2 Extensions
  DATABASE = 'DATABASE',
  QUEUE = 'QUEUE',
  CACHE = 'CACHE',
  FUNCTION = 'FUNCTION',
  CONTAINER = 'CONTAINER',
  DEPLOYMENT = 'DEPLOYMENT',
  PIPELINE = 'PIPELINE',
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  SECRET = 'SECRET',
  CONFIG = 'CONFIG',
  METRIC = 'METRIC',
  ALERT = 'ALERT',
  DASHBOARD = 'DASHBOARD'
}

// Relationship Types - Rich semantic relationships vs Backstage's basic hierarchy
export enum RelationshipType {
  // Basic relationships
  OWNS = 'OWNS',
  DEPENDS_ON = 'DEPENDS_ON',
  PROVIDES = 'PROVIDES',
  CONSUMES = 'CONSUMES',
  PART_OF = 'PART_OF',
  // Advanced relationships
  DEPLOYS = 'DEPLOYS',
  MONITORS = 'MONITORS',
  AUTHORIZES = 'AUTHORIZES',
  SCALES_WITH = 'SCALES_WITH',
  FAILS_WITH = 'FAILS_WITH',
  COMMUNICATES_WITH = 'COMMUNICATES_WITH',
  STORES_IN = 'STORES_IN',
  READS_FROM = 'READS_FROM',
  WRITES_TO = 'WRITES_TO',
  TRIGGERS = 'TRIGGERS',
  SUBSCRIBES_TO = 'SUBSCRIBES_TO',
  // AI-Inferred relationships
  SIMILAR_TO = 'SIMILAR_TO',
  INFLUENCED_BY = 'INFLUENCED_BY',
  CORRELATED_WITH = 'CORRELATED_WITH'
}

// Entity Health States - Real-time vs Backstage's static approach
export enum HealthState {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  UNKNOWN = 'UNKNOWN',
  DEGRADED = 'DEGRADED',
  RECOVERING = 'RECOVERING'
}

// Compliance States
export enum ComplianceState {
  COMPLIANT = 'COMPLIANT',
  NON_COMPLIANT = 'NON_COMPLIANT',
  PARTIAL = 'PARTIAL',
  PENDING = 'PENDING',
  EXEMPT = 'EXEMPT'
}

// Graph Entity Model
export interface GraphEntity {
  id: string;
  type: EntityType;
  name: string;
  namespace: string;
  title?: string;
  description?: string;
  
  // Metadata - Dynamic vs Backstage's rigid schema
  metadata: {
    [key: string]: any;
    createdAt: Date;
    updatedAt: Date;
    version: string;
    labels?: { [key: string]: string };
    annotations?: { [key: string]: string };
  };
  
  // Real-time Status
  status: {
    health: HealthState;
    availability: number; // 0-100%
    performance: number; // 0-100%
    lastUpdated: Date;
    incidents: number;
    slaCompliance: number;
  };
  
  // Compliance Scoring
  compliance: {
    overall: ComplianceState;
    score: number; // 0-100
    checks: ComplianceCheck[];
    lastAudit: Date;
  };
  
  // Discovery Information
  discovery: {
    method: 'AUTO' | 'MANUAL' | 'API' | 'GIT_SCAN' | 'RUNTIME_DETECTION';
    source: string;
    confidence: number; // 0-100%
    lastDiscovered: Date;
  };
  
  // Lifecycle
  lifecycle: {
    stage: 'EXPERIMENTAL' | 'PRODUCTION' | 'MATURE' | 'DEPRECATED' | 'RETIRED';
    owner: string;
    team: string;
    maintainers: string[];
    supportLevel: 'NONE' | 'BASIC' | 'STANDARD' | 'PREMIUM';
  };
  
  // Links and Resources
  links: EntityLink[];
  
  // Custom Properties (extensible)
  properties: { [key: string]: any };
}

export interface EntityLink {
  url: string;
  title?: string;
  icon?: string;
  type?: 'website' | 'documentation' | 'dashboard' | 'api' | 'source' | 'custom';
}

export interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: ComplianceState;
  lastChecked: Date;
  details?: string;
  remediationUrl?: string;
}

// Graph Relationship Model
export interface GraphRelationship {
  id: string;
  type: RelationshipType;
  source: string; // Entity ID
  target: string; // Entity ID
  
  metadata: {
    createdAt: Date;
    discoveredBy: 'AUTO' | 'MANUAL' | 'INFERRED';
    confidence: number; // 0-100%
    strength: number; // 0-100% relationship strength
  };
  
  properties: {
    [key: string]: any;
    // For API relationships
    protocol?: 'HTTP' | 'GRPC' | 'GRAPHQL' | 'WEBSOCKET' | 'ASYNC';
    version?: string;
    // For data relationships
    schema?: string;
    format?: string;
    // For deployment relationships
    environment?: string;
    region?: string;
  };
  
  // Health of the relationship itself
  health: {
    status: HealthState;
    latency?: number;
    errorRate?: number;
    throughput?: number;
    lastHealthCheck: Date;
  };
}

// Graph Query Builder - Advanced querying vs Backstage's basic filters
export class GraphQueryBuilder {
  private query: string = '';
  private parameters: Record<string, any> = {};

  // Find entities by type
  findByType(type: EntityType): GraphQueryBuilder {
    this.query = `MATCH (e:Entity {type: $type})`;
    this.parameters.type = type;
    return this;
  }

  // Find entities by health state
  withHealthState(health: HealthState): GraphQueryBuilder {
    this.query += ` WHERE e.status.health = $health`;
    this.parameters.health = health;
    return this;
  }

  // Find entities within N degrees of separation
  withinDegrees(entityId: string, degrees: number): GraphQueryBuilder {
    this.query = `MATCH (start:Entity {id: $entityId})-[*1..${degrees}]-(connected:Entity)`;
    this.parameters.entityId = entityId;
    return this;
  }

  // Find critical path between entities
  criticalPath(sourceId: string, targetId: string): GraphQueryBuilder {
    this.query = `MATCH path = shortestPath((source:Entity {id: $sourceId})-[*]-(target:Entity {id: $targetId}))`;
    this.parameters.sourceId = sourceId;
    this.parameters.targetId = targetId;
    return this;
  }

  // Find blast radius for an entity
  blastRadius(entityId: string): GraphQueryBuilder {
    this.query = `MATCH (center:Entity {id: $entityId})-[:DEPENDS_ON*]->(affected:Entity)`;
    this.parameters.entityId = entityId;
    return this;
  }

  // Find similar entities using AI
  findSimilar(entityId: string, threshold: number = 0.8): GraphQueryBuilder {
    this.query = `MATCH (entity:Entity {id: $entityId})-[r:SIMILAR_TO]->(similar:Entity) WHERE r.confidence > $threshold`;
    this.parameters.entityId = entityId;
    this.parameters.threshold = threshold;
    return this;
  }

  // Return the built query
  build(): { query: string; parameters: Record<string, any> } {
    return {
      query: this.query + ' RETURN *',
      parameters: this.parameters
    };
  }
}

// Neo4j Graph Service - The heart of Catalog v2
export class CatalogGraphService {
  private driver: Driver;

  constructor(driver: Driver) {
    this.driver = driver;
  }

  // Create or update entity
  async upsertEntity(entity: GraphEntity): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.writeTransaction(async tx => {
        const query = `
          MERGE (e:Entity {id: $id})
          SET e += $properties
          SET e.updatedAt = datetime()
        `;
        await tx.run(query, {
          id: entity.id,
          properties: entity
        });
      });
    } finally {
      await session.close();
    }
  }

  // Create relationship
  async createRelationship(relationship: GraphRelationship): Promise<void> {
    const session: Session = this.driver.session();
    try {
      await session.writeTransaction(async tx => {
        const query = `
          MATCH (source:Entity {id: $sourceId})
          MATCH (target:Entity {id: $targetId})
          CREATE (source)-[r:${relationship.type} $properties]->(target)
          SET r.id = $id
          SET r.createdAt = datetime()
        `;
        await tx.run(query, {
          sourceId: relationship.source,
          targetId: relationship.target,
          id: relationship.id,
          properties: relationship.properties
        });
      });
    } finally {
      await session.close();
    }
  }

  // Execute graph query
  async executeQuery(queryBuilder: GraphQueryBuilder): Promise<any[]> {
    const session: Session = this.driver.session();
    try {
      const { query, parameters } = queryBuilder.build();
      const result = await session.readTransaction(async tx => {
        return await tx.run(query, parameters);
      });
      return result.records.map(record => record.toObject());
    } finally {
      await session.close();
    }
  }

  // Get entity by ID with relationships
  async getEntityWithRelationships(entityId: string, depth: number = 1): Promise<any> {
    const session: Session = this.driver.session();
    try {
      const query = `
        MATCH (e:Entity {id: $entityId})
        OPTIONAL MATCH (e)-[r]->(related:Entity)
        RETURN e, collect({relationship: r, entity: related}) as relationships
      `;
      const result = await session.readTransaction(async tx => {
        return await tx.run(query, { entityId });
      });
      
      if (result.records.length === 0) return null;
      
      const record = result.records[0];
      return {
        entity: record.get('e').properties,
        relationships: record.get('relationships')
      };
    } finally {
      await session.close();
    }
  }

  // Get system topology
  async getSystemTopology(systemId: string): Promise<any> {
    const queryBuilder = new GraphQueryBuilder()
      .findByType(EntityType.SYSTEM)
      .withinDegrees(systemId, 3);
    
    return await this.executeQuery(queryBuilder);
  }

  // Analyze blast radius
  async analyzeBlastRadius(entityId: string): Promise<any> {
    const queryBuilder = new GraphQueryBuilder()
      .blastRadius(entityId);
    
    return await this.executeQuery(queryBuilder);
  }

  // Search entities with graph traversal
  async graphSearch(searchTerm: string, entityTypes?: EntityType[]): Promise<any[]> {
    const session: Session = this.driver.session();
    try {
      let typeFilter = '';
      if (entityTypes && entityTypes.length > 0) {
        typeFilter = `AND e.type IN $types`;
      }

      const query = `
        CALL db.index.fulltext.queryNodes("entitySearch", $searchTerm) YIELD node as e, score
        WHERE score > 0.5 ${typeFilter}
        OPTIONAL MATCH (e)-[r]->(related:Entity)
        RETURN e, score, collect({relationship: r, entity: related}) as context
        ORDER BY score DESC
        LIMIT 50
      `;
      
      const result = await session.readTransaction(async tx => {
        return await tx.run(query, { 
          searchTerm,
          ...(entityTypes && { types: entityTypes })
        });
      });
      
      return result.records.map(record => ({
        entity: record.get('e').properties,
        relevance: record.get('score'),
        context: record.get('context')
      }));
    } finally {
      await session.close();
    }
  }
}