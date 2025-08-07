import neo4j, { Driver, Session, Result } from 'neo4j-driver';
import { Redis } from 'ioredis';
import { logger } from '../monitoring/logger';

export interface GraphEntity {
  id: string;
  type: 'service' | 'api' | 'database' | 'team' | 'component' | 'plugin' | 'infrastructure';
  name: string;
  properties: Record<string, any>;
}

export interface GraphRelationship {
  id: string;
  type: 'DEPENDS_ON' | 'OWNS' | 'CALLS' | 'DEPLOYED_TO' | 'USES' | 'PROVIDES' | 'CONSUMES';
  source: string;
  target: string;
  properties: Record<string, any>;
}

export interface GraphSearchResult {
  entities: GraphEntity[];
  relationships: GraphRelationship[];
  paths: GraphPath[];
  insights: GraphInsight[];
}

export interface GraphPath {
  nodes: GraphEntity[];
  relationships: GraphRelationship[];
  length: number;
  weight?: number;
}

export interface GraphInsight {
  type: 'bottleneck' | 'single_point_of_failure' | 'circular_dependency' | 'orphaned' | 'high_coupling';
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedEntities: string[];
  description: string;
  recommendation: string;
}

export class GraphSearchEngine {
  private driver: Driver;
  private redis: Redis;
  private metricsCache: Map<string, any> = new Map();

  constructor(
    neo4jUrl: string,
    neo4jUser: string,
    neo4jPassword: string,
    redisUrl?: string
  ) {
    this.driver = neo4j.driver(
      neo4jUrl,
      neo4j.auth.basic(neo4jUser, neo4jPassword)
    );
    this.redis = new Redis(redisUrl || 'redis://localhost:6379');
  }

  async initialize() {
    try {
      // Create indexes for better performance
      const session = this.driver.session();
      
      await session.run('CREATE INDEX entity_id IF NOT EXISTS FOR (n:Entity) ON (n.id)');
      await session.run('CREATE INDEX entity_type IF NOT EXISTS FOR (n:Entity) ON (n.type)');
      await session.run('CREATE INDEX entity_name IF NOT EXISTS FOR (n:Entity) ON (n.name)');
      await session.run('CREATE INDEX team_name IF NOT EXISTS FOR (t:Team) ON (t.name)');
      
      await session.close();
      logger.info('Neo4j graph database initialized');
    } catch (error) {
      logger.error('Failed to initialize Neo4j', error);
      throw error;
    }
  }

  // Index entities and relationships
  async indexEntity(entity: GraphEntity): Promise<void> {
    const session = this.driver.session();
    
    try {
      await session.run(
        `MERGE (e:Entity {id: $id})
         SET e.type = $type,
             e.name = $name,
             e.properties = $properties,
             e.lastUpdated = datetime()`,
        {
          id: entity.id,
          type: entity.type,
          name: entity.name,
          properties: JSON.stringify(entity.properties)
        }
      );
      
      // Also create type-specific labels
      await session.run(
        `MATCH (e:Entity {id: $id})
         CALL apoc.create.addLabels(e, [$type])
         YIELD node
         RETURN node`,
        {
          id: entity.id,
          type: entity.type.charAt(0).toUpperCase() + entity.type.slice(1)
        }
      );
    } finally {
      await session.close();
    }
  }

  async indexRelationship(relationship: GraphRelationship): Promise<void> {
    const session = this.driver.session();
    
    try {
      await session.run(
        `MATCH (source:Entity {id: $sourceId})
         MATCH (target:Entity {id: $targetId})
         MERGE (source)-[r:${relationship.type} {id: $id}]->(target)
         SET r.properties = $properties,
             r.lastUpdated = datetime()`,
        {
          id: relationship.id,
          sourceId: relationship.source,
          targetId: relationship.target,
          properties: JSON.stringify(relationship.properties)
        }
      );
    } finally {
      await session.close();
    }
  }

  // Search for entities and their relationships
  async searchGraph(
    query: string,
    options?: {
      depth?: number;
      limit?: number;
      entityTypes?: string[];
      relationshipTypes?: string[];
    }
  ): Promise<GraphSearchResult> {
    const session = this.driver.session();
    const depth = options?.depth || 2;
    const limit = options?.limit || 50;

    try {
      // Search for matching entities
      const entityResult = await session.run(
        `MATCH (e:Entity)
         WHERE e.name =~ $pattern OR e.id =~ $pattern
         ${options?.entityTypes ? 'AND e.type IN $types' : ''}
         RETURN e
         LIMIT $limit`,
        {
          pattern: `(?i).*${query}.*`,
          types: options?.entityTypes,
          limit
        }
      );

      const entities = entityResult.records.map(record => this.parseEntity(record.get('e')));

      // Get relationships for found entities
      const entityIds = entities.map(e => e.id);
      const relationshipResult = await session.run(
        `MATCH (source:Entity)-[r]->(target:Entity)
         WHERE source.id IN $ids OR target.id IN $ids
         ${options?.relationshipTypes ? 'AND type(r) IN $types' : ''}
         RETURN source, r, target
         LIMIT $limit`,
        {
          ids: entityIds,
          types: options?.relationshipTypes,
          limit: limit * 2
        }
      );

      const relationships = relationshipResult.records.map(record => 
        this.parseRelationship(record.get('r'), record.get('source'), record.get('target'))
      );

      // Find paths between entities
      const paths = await this.findPaths(entityIds, depth);

      // Analyze graph for insights
      const insights = await this.analyzeGraph(entities, relationships);

      return {
        entities,
        relationships,
        paths,
        insights
      };
    } finally {
      await session.close();
    }
  }

  // Find shortest paths between entities
  async findShortestPath(sourceId: string, targetId: string): Promise<GraphPath | null> {
    const session = this.driver.session();

    try {
      const result = await session.run(
        `MATCH path = shortestPath((source:Entity {id: $sourceId})-[*]-(target:Entity {id: $targetId}))
         RETURN path`,
        { sourceId, targetId }
      );

      if (result.records.length === 0) {
        return null;
      }

      const path = result.records[0].get('path');
      return this.parsePath(path);
    } finally {
      await session.close();
    }
  }

  // Find all paths up to a certain depth
  private async findPaths(entityIds: string[], maxDepth: number): Promise<GraphPath[]> {
    const session = this.driver.session();
    const paths: GraphPath[] = [];

    try {
      for (let i = 0; i < entityIds.length - 1; i++) {
        for (let j = i + 1; j < entityIds.length; j++) {
          const result = await session.run(
            `MATCH path = (source:Entity {id: $sourceId})-[*1..${maxDepth}]-(target:Entity {id: $targetId})
             RETURN path
             LIMIT 5`,
            {
              sourceId: entityIds[i],
              targetId: entityIds[j]
            }
          );

          result.records.forEach(record => {
            paths.push(this.parsePath(record.get('path')));
          });
        }
      }
    } finally {
      await session.close();
    }

    return paths;
  }

  // Analyze graph for insights
  private async analyzeGraph(
    entities: GraphEntity[],
    relationships: GraphRelationship[]
  ): Promise<GraphInsight[]> {
    const insights: GraphInsight[] = [];
    const session = this.driver.session();

    try {
      // Detect bottlenecks (entities with high in-degree)
      const bottleneckResult = await session.run(
        `MATCH (e:Entity)<-[r]-()
         WITH e, count(r) as inDegree
         WHERE inDegree > 10
         RETURN e.id as id, e.name as name, inDegree
         ORDER BY inDegree DESC
         LIMIT 5`
      );

      bottleneckResult.records.forEach(record => {
        insights.push({
          type: 'bottleneck',
          severity: record.get('inDegree') > 20 ? 'critical' : 'high',
          affectedEntities: [record.get('id')],
          description: `${record.get('name')} is a bottleneck with ${record.get('inDegree')} dependencies`,
          recommendation: 'Consider splitting this service or implementing caching to reduce load'
        });
      });

      // Detect single points of failure
      const spofResult = await session.run(
        `MATCH (e:Entity)
         WHERE NOT (e)<-[:BACKS_UP]-() AND size((e)<-[:DEPENDS_ON]-()) > 5
         RETURN e.id as id, e.name as name, size((e)<-[:DEPENDS_ON]-()) as dependents`
      );

      spofResult.records.forEach(record => {
        insights.push({
          type: 'single_point_of_failure',
          severity: 'critical',
          affectedEntities: [record.get('id')],
          description: `${record.get('name')} is a single point of failure with ${record.get('dependents')} dependents`,
          recommendation: 'Implement redundancy or backup systems for this critical component'
        });
      });

      // Detect circular dependencies
      const circularResult = await session.run(
        `MATCH path = (e:Entity)-[:DEPENDS_ON*2..5]->(e)
         RETURN e.id as id, e.name as name, length(path) as cycleLength
         LIMIT 5`
      );

      circularResult.records.forEach(record => {
        insights.push({
          type: 'circular_dependency',
          severity: 'high',
          affectedEntities: [record.get('id')],
          description: `${record.get('name')} is part of a circular dependency chain of length ${record.get('cycleLength')}`,
          recommendation: 'Refactor to break the circular dependency, consider using events or message queues'
        });
      });

      // Detect orphaned entities
      const orphanedResult = await session.run(
        `MATCH (e:Entity)
         WHERE NOT (e)-[]-()
         RETURN e.id as id, e.name as name`
      );

      orphanedResult.records.forEach(record => {
        insights.push({
          type: 'orphaned',
          severity: 'low',
          affectedEntities: [record.get('id')],
          description: `${record.get('name')} has no relationships with other entities`,
          recommendation: 'Review if this entity is still needed or needs to be integrated'
        });
      });

      // Detect high coupling
      const couplingResult = await session.run(
        `MATCH (e:Entity)-[r]->()
         WITH e, count(DISTINCT type(r)) as relationshipTypes, count(r) as totalRelationships
         WHERE relationshipTypes > 5 AND totalRelationships > 15
         RETURN e.id as id, e.name as name, relationshipTypes, totalRelationships`
      );

      couplingResult.records.forEach(record => {
        insights.push({
          type: 'high_coupling',
          severity: 'medium',
          affectedEntities: [record.get('id')],
          description: `${record.get('name')} has high coupling with ${record.get('relationshipTypes')} different relationship types`,
          recommendation: 'Consider refactoring to reduce coupling and improve modularity'
        });
      });

    } finally {
      await session.close();
    }

    return insights;
  }

  // Impact analysis - what would be affected if an entity changes
  async analyzeImpact(entityId: string, maxDepth: number = 3): Promise<{
    directImpact: GraphEntity[];
    indirectImpact: GraphEntity[];
    criticalPaths: GraphPath[];
    riskScore: number;
  }> {
    const session = this.driver.session();

    try {
      // Find directly dependent entities
      const directResult = await session.run(
        `MATCH (source:Entity {id: $id})<-[:DEPENDS_ON|CALLS|USES]-(dependent:Entity)
         RETURN DISTINCT dependent`,
        { id: entityId }
      );

      const directImpact = directResult.records.map(r => this.parseEntity(r.get('dependent')));

      // Find indirectly affected entities
      const indirectResult = await session.run(
        `MATCH (source:Entity {id: $id})<-[:DEPENDS_ON|CALLS|USES*2..${maxDepth}]-(dependent:Entity)
         RETURN DISTINCT dependent`,
        { id: entityId }
      );

      const indirectImpact = indirectResult.records.map(r => this.parseEntity(r.get('dependent')));

      // Find critical paths that would be broken
      const criticalPathResult = await session.run(
        `MATCH path = (source:Entity {id: $id})<-[:DEPENDS_ON|CALLS*]-(critical:Entity {type: 'service'})
         WHERE critical.properties CONTAINS '"critical":true'
         RETURN path
         LIMIT 10`,
        { id: entityId }
      );

      const criticalPaths = criticalPathResult.records.map(r => this.parsePath(r.get('path')));

      // Calculate risk score
      const riskScore = this.calculateRiskScore(directImpact, indirectImpact, criticalPaths);

      return {
        directImpact,
        indirectImpact,
        criticalPaths,
        riskScore
      };
    } finally {
      await session.close();
    }
  }

  // Recommend related entities based on graph analysis
  async recommendRelated(entityId: string, limit: number = 5): Promise<GraphEntity[]> {
    const session = this.driver.session();

    try {
      // Use collaborative filtering based on similar entities
      const result = await session.run(
        `MATCH (source:Entity {id: $id})-[:DEPENDS_ON|USES|CALLS]->(related:Entity)<-[:DEPENDS_ON|USES|CALLS]-(similar:Entity)
         WHERE similar.id <> $id
         WITH similar, count(*) as commonRelations
         ORDER BY commonRelations DESC
         MATCH (similar)-[:DEPENDS_ON|USES|CALLS]->(recommended:Entity)
         WHERE NOT (source)-[]-(recommended)
         RETURN DISTINCT recommended
         LIMIT $limit`,
        { id: entityId, limit }
      );

      return result.records.map(r => this.parseEntity(r.get('recommended')));
    } finally {
      await session.close();
    }
  }

  // Community detection - find clusters of related entities
  async detectCommunities(): Promise<Map<string, GraphEntity[]>> {
    const session = this.driver.session();
    const communities = new Map<string, GraphEntity[]>();

    try {
      // Use Louvain algorithm for community detection
      await session.run(
        `CALL gds.graph.project(
          'entityGraph',
          'Entity',
          {
            DEPENDS_ON: {orientation: 'UNDIRECTED'},
            CALLS: {orientation: 'UNDIRECTED'},
            USES: {orientation: 'UNDIRECTED'}
          }
        )`
      );

      const result = await session.run(
        `CALL gds.louvain.stream('entityGraph')
         YIELD nodeId, communityId
         RETURN gds.util.asNode(nodeId) as entity, communityId
         ORDER BY communityId`
      );

      result.records.forEach(record => {
        const entity = this.parseEntity(record.get('entity'));
        const communityId = record.get('communityId').toString();

        if (!communities.has(communityId)) {
          communities.set(communityId, []);
        }
        communities.get(communityId)!.push(entity);
      });

      // Clean up the projection
      await session.run('CALL gds.graph.drop("entityGraph")');

    } catch (error) {
      logger.error('Community detection failed', error);
    } finally {
      await session.close();
    }

    return communities;
  }

  // Helper methods
  private parseEntity(node: any): GraphEntity {
    return {
      id: node.properties.id,
      type: node.properties.type,
      name: node.properties.name,
      properties: JSON.parse(node.properties.properties || '{}')
    };
  }

  private parseRelationship(rel: any, source: any, target: any): GraphRelationship {
    return {
      id: rel.properties.id || `${source.properties.id}-${target.properties.id}`,
      type: rel.type as any,
      source: source.properties.id,
      target: target.properties.id,
      properties: JSON.parse(rel.properties.properties || '{}')
    };
  }

  private parsePath(path: any): GraphPath {
    const nodes: GraphEntity[] = [];
    const relationships: GraphRelationship[] = [];

    path.segments.forEach((segment: any) => {
      nodes.push(this.parseEntity(segment.start));
      relationships.push(this.parseRelationship(
        segment.relationship,
        segment.start,
        segment.end
      ));
    });

    // Add the last node
    if (path.segments.length > 0) {
      nodes.push(this.parseEntity(path.segments[path.segments.length - 1].end));
    }

    return {
      nodes,
      relationships,
      length: path.length,
      weight: relationships.reduce((sum, r) => sum + (r.properties.weight || 1), 0)
    };
  }

  private calculateRiskScore(
    directImpact: GraphEntity[],
    indirectImpact: GraphEntity[],
    criticalPaths: GraphPath[]
  ): number {
    let score = 0;

    // Weight direct impact more heavily
    score += directImpact.length * 10;
    score += indirectImpact.length * 5;

    // Critical paths are very important
    score += criticalPaths.length * 20;

    // Consider entity types
    directImpact.forEach(entity => {
      if (entity.type === 'service' && entity.properties.critical) {
        score += 15;
      }
    });

    // Normalize to 0-100
    return Math.min(100, score);
  }

  async close() {
    await this.driver.close();
  }
}