// Data Catalog and Lineage Tracking System

import { 
  DataCatalogEntry, 
  DataLineage, 
  LineageNode, 
  TransformationLineage,
  SchemaDefinition,
  FieldDefinition 
} from './types';

/**
 * Apache Atlas Integration for Data Catalog and Lineage
 */
export class AtlasIntegration {
  private config: AtlasConfig;
  private baseUrl: string;
  private auth: AtlasAuth;

  constructor(config: AtlasConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl;
    this.auth = config.auth;
  }

  /**
   * Create or update entity in Atlas
   */
  async createEntity(entity: AtlasEntity): Promise<string> {
    try {
      const response = await this.makeRequest('POST', '/v2/entity', {
        entity: entity
      });

      return response.guidAssignments[entity.guid] || response.mutatedEntities?.CREATE?.[0]?.guid;
    } catch (error) {
      throw new Error(`Failed to create Atlas entity: ${error.message}`);
    }
  }

  /**
   * Get entity by GUID
   */
  async getEntity(guid: string): Promise<AtlasEntity> {
    const response = await this.makeRequest('GET', `/v2/entity/guid/${guid}`);
    return response.entity;
  }

  /**
   * Search entities
   */
  async searchEntities(searchConfig: AtlasSearchConfig): Promise<AtlasSearchResult> {
    const response = await this.makeRequest('POST', '/v2/search/dsl', {
      query: searchConfig.query,
      typeName: searchConfig.typeName,
      classification: searchConfig.classification,
      limit: searchConfig.limit || 100,
      offset: searchConfig.offset || 0
    });

    return {
      entities: response.entities || [],
      totalCount: response.approximateCount || 0,
      hasMore: response.entities?.length === (searchConfig.limit || 100)
    };
  }

  /**
   * Get data lineage for entity
   */
  async getLineage(guid: string, direction: 'INPUT' | 'OUTPUT' | 'BOTH', depth: number = 3): Promise<AtlasLineageInfo> {
    const response = await this.makeRequest('GET', `/v2/lineage/${guid}`, {
      direction,
      depth
    });

    return response;
  }

  /**
   * Create lineage relationship
   */
  async createLineage(fromEntity: string, toEntity: string, processGuid: string): Promise<void> {
    const relationship: AtlasRelationship = {
      typeName: 'DataFlow',
      attributes: {},
      guid: `lineage_${Date.now()}`,
      end1: {
        guid: fromEntity,
        typeName: 'DataSet'
      },
      end2: {
        guid: toEntity,
        typeName: 'DataSet'
      },
      status: 'ACTIVE'
    };

    await this.makeRequest('POST', '/v2/relationship', relationship);
  }

  /**
   * Add classification to entity
   */
  async addClassification(entityGuid: string, classification: AtlasClassification): Promise<void> {
    await this.makeRequest('POST', `/v2/entity/guid/${entityGuid}/classifications`, [classification]);
  }

  /**
   * Get entity classifications
   */
  async getClassifications(entityGuid: string): Promise<AtlasClassification[]> {
    const response = await this.makeRequest('GET', `/v2/entity/guid/${entityGuid}/classifications`);
    return response;
  }

  /**
   * Create custom type definition
   */
  async createTypeDef(typeDef: AtlasTypeDef): Promise<void> {
    await this.makeRequest('POST', '/v2/types/typedefs', {
      entityDefs: typeDef.entityDefs || [],
      relationshipDefs: typeDef.relationshipDefs || [],
      classificationDefs: typeDef.classificationDefs || []
    });
  }

  /**
   * Get all type definitions
   */
  async getTypeDefs(): Promise<AtlasTypeDefHeader[]> {
    const response = await this.makeRequest('GET', '/v2/types/typedefs/headers');
    return response.typeDefs || [];
  }

  /**
   * Make HTTP request to Atlas API
   */
  private async makeRequest(method: string, endpoint: string, body?: any): Promise<any> {
    const url = `${this.baseUrl}/api/atlas${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Add authentication
    if (this.auth.type === 'basic') {
      const credentials = btoa(`${this.auth.username}:${this.auth.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    } else if (this.auth.type === 'token') {
      headers['Authorization'] = `Bearer ${this.auth.token}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`Atlas API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

/**
 * Data Catalog Service
 */
export class DataCatalogService {
  private atlas: AtlasIntegration;
  private entries: Map<string, DataCatalogEntry> = new Map();

  constructor(atlasConfig: AtlasConfig) {
    this.atlas = new AtlasIntegration(atlasConfig);
  }

  /**
   * Register dataset in catalog
   */
  async registerDataset(config: DatasetConfig): Promise<string> {
    try {
      // Create Atlas entity
      const entity: AtlasEntity = {
        typeName: 'DataSet',
        guid: config.id || `dataset_${Date.now()}`,
        attributes: {
          name: config.name,
          description: config.description,
          owner: config.owner,
          location: config.location,
          format: config.format,
          schema: JSON.stringify(config.schema),
          tags: config.tags,
          qualifiedName: `${config.name}@${config.system || 'default'}`
        },
        status: 'ACTIVE',
        classifications: config.classifications || []
      };

      const guid = await this.atlas.createEntity(entity);

      // Create catalog entry
      const catalogEntry: DataCatalogEntry = {
        id: guid,
        name: config.name,
        type: 'dataset',
        description: config.description,
        schema: config.schema,
        owner: config.owner,
        tags: config.tags || [],
        location: config.location,
        format: config.format,
        lastUpdated: new Date(),
        lineage: {
          pipelineId: '',
          upstream: [],
          downstream: [],
          transformations: []
        }
      };

      this.entries.set(guid, catalogEntry);

      console.log(`Dataset ${config.name} registered with GUID: ${guid}`);
      return guid;
    } catch (error) {
      throw new Error(`Failed to register dataset: ${error.message}`);
    }
  }

  /**
   * Register pipeline in catalog
   */
  async registerPipeline(config: PipelineConfig): Promise<string> {
    try {
      const entity: AtlasEntity = {
        typeName: 'Process',
        guid: config.id || `pipeline_${Date.now()}`,
        attributes: {
          name: config.name,
          description: config.description,
          owner: config.owner,
          inputs: config.inputs,
          outputs: config.outputs,
          qualifiedName: `${config.name}@${config.system || 'airflow'}`
        },
        status: 'ACTIVE'
      };

      const guid = await this.atlas.createEntity(entity);

      // Create lineage relationships
      await this.createPipelineLineage(guid, config.inputs, config.outputs);

      console.log(`Pipeline ${config.name} registered with GUID: ${guid}`);
      return guid;
    } catch (error) {
      throw new Error(`Failed to register pipeline: ${error.message}`);
    }
  }

  /**
   * Search catalog entries
   */
  async searchCatalog(query: CatalogSearchQuery): Promise<CatalogSearchResult> {
    try {
      const atlasQuery = this.buildAtlasQuery(query);
      const result = await this.atlas.searchEntities(atlasQuery);

      const entries: DataCatalogEntry[] = result.entities.map(entity => 
        this.mapAtlasEntityToCatalogEntry(entity)
      );

      return {
        entries,
        totalCount: result.totalCount,
        hasMore: result.hasMore,
        facets: this.buildFacets(entries)
      };
    } catch (error) {
      throw new Error(`Catalog search failed: ${error.message}`);
    }
  }

  /**
   * Get dataset lineage
   */
  async getDatasetLineage(datasetId: string): Promise<DataLineage> {
    try {
      const lineageInfo = await this.atlas.getLineage(datasetId, 'BOTH', 5);
      return this.mapAtlasLineageToDataLineage(lineageInfo);
    } catch (error) {
      throw new Error(`Failed to get lineage: ${error.message}`);
    }
  }

  /**
   * Update dataset metadata
   */
  async updateDatasetMetadata(datasetId: string, metadata: Partial<DataCatalogEntry>): Promise<void> {
    try {
      const entity = await this.atlas.getEntity(datasetId);
      
      // Update attributes
      if (metadata.description) entity.attributes.description = metadata.description;
      if (metadata.tags) entity.attributes.tags = metadata.tags;
      if (metadata.owner) entity.attributes.owner = metadata.owner;
      if (metadata.schema) entity.attributes.schema = JSON.stringify(metadata.schema);

      await this.atlas.createEntity(entity);

      // Update local cache
      const existingEntry = this.entries.get(datasetId);
      if (existingEntry) {
        this.entries.set(datasetId, { ...existingEntry, ...metadata, lastUpdated: new Date() });
      }

      console.log(`Dataset ${datasetId} metadata updated`);
    } catch (error) {
      throw new Error(`Failed to update metadata: ${error.message}`);
    }
  }

  /**
   * Add data classification
   */
  async addClassification(datasetId: string, classification: DataClassification): Promise<void> {
    try {
      const atlasClassification: AtlasClassification = {
        typeName: classification.type,
        attributes: classification.attributes || {},
        entityGuid: datasetId
      };

      await this.atlas.addClassification(datasetId, atlasClassification);
      console.log(`Classification ${classification.type} added to ${datasetId}`);
    } catch (error) {
      throw new Error(`Failed to add classification: ${error.message}`);
    }
  }

  /**
   * Get data quality score for dataset
   */
  async getDataQualityScore(datasetId: string): Promise<DataQualityScore> {
    // This would integrate with the quality monitoring system
    return {
      datasetId,
      overallScore: 85,
      dimensions: {
        completeness: 90,
        accuracy: 85,
        consistency: 80,
        timeliness: 85,
        validity: 90
      },
      lastAssessed: new Date(),
      issues: [
        {
          type: 'completeness',
          description: '10% null values in email column',
          severity: 'medium'
        }
      ]
    };
  }

  /**
   * Get dataset usage statistics
   */
  async getUsageStatistics(datasetId: string, timeRange: TimeRange): Promise<DatasetUsage> {
    // This would integrate with query logs and monitoring systems
    return {
      datasetId,
      timeRange,
      queryCount: 1250,
      uniqueUsers: 45,
      topQueries: [
        { query: 'SELECT * FROM users WHERE active = true', count: 125 },
        { query: 'SELECT user_id, email FROM users', count: 98 }
      ],
      topUsers: [
        { userId: 'john.doe@company.com', queryCount: 85 },
        { userId: 'jane.smith@company.com', queryCount: 67 }
      ],
      averageQueryTime: 1200,
      peakUsageTimes: [
        { hour: 9, queryCount: 145 },
        { hour: 14, queryCount: 132 }
      ]
    };
  }

  /**
   * Create pipeline lineage relationships
   */
  private async createPipelineLineage(pipelineGuid: string, inputs: string[], outputs: string[]): Promise<void> {
    for (const input of inputs) {
      await this.atlas.createLineage(input, outputs[0], pipelineGuid);
    }
  }

  /**
   * Build Atlas query from catalog search query
   */
  private buildAtlasQuery(query: CatalogSearchQuery): AtlasSearchConfig {
    let atlasQuery = '';

    if (query.text) {
      atlasQuery += `name LIKE "*${query.text}*"`;
    }

    if (query.owner) {
      if (atlasQuery) atlasQuery += ' AND ';
      atlasQuery += `owner = "${query.owner}"`;
    }

    if (query.tags && query.tags.length > 0) {
      if (atlasQuery) atlasQuery += ' AND ';
      atlasQuery += `tags CONTAINS "${query.tags[0]}"`;
    }

    return {
      query: atlasQuery || '*',
      typeName: query.type || 'DataSet',
      limit: query.limit,
      offset: query.offset
    };
  }

  /**
   * Map Atlas entity to catalog entry
   */
  private mapAtlasEntityToCatalogEntry(entity: AtlasEntity): DataCatalogEntry {
    return {
      id: entity.guid,
      name: entity.attributes.name,
      type: entity.typeName === 'DataSet' ? 'dataset' : 'pipeline',
      description: entity.attributes.description || '',
      schema: entity.attributes.schema ? JSON.parse(entity.attributes.schema) : undefined,
      owner: entity.attributes.owner,
      tags: entity.attributes.tags || [],
      location: entity.attributes.location,
      format: entity.attributes.format,
      lastUpdated: new Date(entity.updateTime || Date.now()),
      qualityScore: undefined,
      lineage: {
        pipelineId: '',
        upstream: [],
        downstream: [],
        transformations: []
      }
    };
  }

  /**
   * Map Atlas lineage to data lineage
   */
  private mapAtlasLineageToDataLineage(lineageInfo: AtlasLineageInfo): DataLineage {
    const upstream: LineageNode[] = [];
    const downstream: LineageNode[] = [];
    const transformations: TransformationLineage[] = [];

    // Process lineage relations
    if (lineageInfo.relations) {
      for (const relation of lineageInfo.relations) {
        const fromGuid = relation.fromEntityId;
        const toGuid = relation.toEntityId;

        if (lineageInfo.guidEntityMap[fromGuid]) {
          const entity = lineageInfo.guidEntityMap[fromGuid];
          upstream.push({
            type: this.mapAtlasTypeToLineageType(entity.typeName),
            name: entity.displayText || entity.attributes?.name,
            system: entity.attributes?.qualifiedName?.split('@')[1] || 'unknown'
          });
        }

        if (lineageInfo.guidEntityMap[toGuid]) {
          const entity = lineageInfo.guidEntityMap[toGuid];
          downstream.push({
            type: this.mapAtlasTypeToLineageType(entity.typeName),
            name: entity.displayText || entity.attributes?.name,
            system: entity.attributes?.qualifiedName?.split('@')[1] || 'unknown'
          });
        }
      }
    }

    return {
      pipelineId: lineageInfo.baseEntityGuid,
      upstream,
      downstream,
      transformations
    };
  }

  /**
   * Map Atlas type to lineage node type
   */
  private mapAtlasTypeToLineageType(atlasType: string): 'table' | 'view' | 'file' | 'topic' {
    const typeMapping: Record<string, 'table' | 'view' | 'file' | 'topic'> = {
      'DataSet': 'table',
      'Table': 'table',
      'View': 'view',
      'File': 'file',
      'Topic': 'topic'
    };

    return typeMapping[atlasType] || 'table';
  }

  /**
   * Build search result facets
   */
  private buildFacets(entries: DataCatalogEntry[]): SearchFacet[] {
    const ownerCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    const formatCounts = new Map<string, number>();

    for (const entry of entries) {
      // Owner facet
      if (entry.owner) {
        ownerCounts.set(entry.owner, (ownerCounts.get(entry.owner) || 0) + 1);
      }

      // Tags facet
      for (const tag of entry.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }

      // Format facet
      if (entry.format) {
        formatCounts.set(entry.format, (formatCounts.get(entry.format) || 0) + 1);
      }
    }

    return [
      {
        name: 'owner',
        values: Array.from(ownerCounts.entries()).map(([value, count]) => ({ value, count }))
      },
      {
        name: 'tags',
        values: Array.from(tagCounts.entries()).map(([value, count]) => ({ value, count }))
      },
      {
        name: 'format',
        values: Array.from(formatCounts.entries()).map(([value, count]) => ({ value, count }))
      }
    ];
  }
}

/**
 * Data Lineage Tracker
 */
export class DataLineageTracker {
  private lineageGraph: Map<string, LineageNode[]> = new Map();
  private transformations: Map<string, TransformationLineage[]> = new Map();

  /**
   * Track data transformation
   */
  trackTransformation(config: TransformationTrackingConfig): void {
    const transformation: TransformationLineage = {
      stepId: config.stepId,
      inputFields: config.inputFields,
      outputFields: config.outputFields,
      logic: config.logic
    };

    const existing = this.transformations.get(config.pipelineId) || [];
    existing.push(transformation);
    this.transformations.set(config.pipelineId, existing);
  }

  /**
   * Build lineage graph
   */
  buildLineageGraph(pipelineId: string, sources: LineageNode[], destinations: LineageNode[]): DataLineage {
    // Store upstream relationships
    this.lineageGraph.set(`${pipelineId}_upstream`, sources);
    
    // Store downstream relationships
    this.lineageGraph.set(`${pipelineId}_downstream`, destinations);

    return {
      pipelineId,
      upstream: sources,
      downstream: destinations,
      transformations: this.transformations.get(pipelineId) || []
    };
  }

  /**
   * Get full lineage path
   */
  getFullLineage(nodeId: string, depth: number = 5): LineagePath {
    const path: LineagePath = {
      nodeId,
      upstream: [],
      downstream: [],
      depth
    };

    // Build upstream path
    this.buildUpstreamPath(nodeId, path.upstream, depth);
    
    // Build downstream path
    this.buildDownstreamPath(nodeId, path.downstream, depth);

    return path;
  }

  /**
   * Detect lineage anomalies
   */
  detectAnomalies(): LineageAnomaly[] {
    const anomalies: LineageAnomaly[] = [];

    // Check for orphaned nodes
    const allNodes = new Set<string>();
    const connectedNodes = new Set<string>();

    for (const [key, nodes] of this.lineageGraph.entries()) {
      for (const node of nodes) {
        const nodeKey = `${node.name}@${node.system}`;
        allNodes.add(nodeKey);
        connectedNodes.add(nodeKey);
      }
    }

    // Find orphaned nodes (not currently implemented as it requires more complex graph analysis)
    
    // Check for circular dependencies
    const circularDeps = this.detectCircularDependencies();
    anomalies.push(...circularDeps);

    return anomalies;
  }

  /**
   * Build upstream lineage path
   */
  private buildUpstreamPath(nodeId: string, path: LineageNode[], remainingDepth: number): void {
    if (remainingDepth <= 0) return;

    const upstream = this.lineageGraph.get(`${nodeId}_upstream`) || [];
    path.push(...upstream);

    for (const node of upstream) {
      const nodeKey = `${node.name}@${node.system}`;
      this.buildUpstreamPath(nodeKey, path, remainingDepth - 1);
    }
  }

  /**
   * Build downstream lineage path
   */
  private buildDownstreamPath(nodeId: string, path: LineageNode[], remainingDepth: number): void {
    if (remainingDepth <= 0) return;

    const downstream = this.lineageGraph.get(`${nodeId}_downstream`) || [];
    path.push(...downstream);

    for (const node of downstream) {
      const nodeKey = `${node.name}@${node.system}`;
      this.buildDownstreamPath(nodeKey, path, remainingDepth - 1);
    }
  }

  /**
   * Detect circular dependencies
   */
  private detectCircularDependencies(): LineageAnomaly[] {
    // Simplified circular dependency detection
    const anomalies: LineageAnomaly[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const [key] of this.lineageGraph.keys()) {
      if (key.endsWith('_upstream')) continue;
      
      const nodeId = key.replace('_downstream', '');
      if (!visited.has(nodeId)) {
        const circular = this.detectCircularDFS(nodeId, visited, recursionStack, []);
        if (circular.length > 0) {
          anomalies.push({
            type: 'circular_dependency',
            description: `Circular dependency detected: ${circular.join(' -> ')}`,
            affectedNodes: circular,
            severity: 'high'
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * DFS for circular dependency detection
   */
  private detectCircularDFS(
    nodeId: string, 
    visited: Set<string>, 
    recursionStack: Set<string>, 
    path: string[]
  ): string[] {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const downstream = this.lineageGraph.get(`${nodeId}_downstream`) || [];
    
    for (const node of downstream) {
      const nodeKey = `${node.name}@${node.system}`;
      
      if (recursionStack.has(nodeKey)) {
        // Found circular dependency
        const circularPath = path.slice(path.indexOf(nodeKey));
        return [...circularPath, nodeKey];
      }
      
      if (!visited.has(nodeKey)) {
        const result = this.detectCircularDFS(nodeKey, visited, recursionStack, [...path]);
        if (result.length > 0) {
          return result;
        }
      }
    }

    recursionStack.delete(nodeId);
    return [];
  }
}

/**
 * Type definitions
 */
export interface AtlasConfig {
  baseUrl: string;
  auth: AtlasAuth;
}

export interface AtlasAuth {
  type: 'basic' | 'token' | 'kerberos';
  username?: string;
  password?: string;
  token?: string;
}

export interface AtlasEntity {
  typeName: string;
  guid: string;
  attributes: Record<string, any>;
  status: 'ACTIVE' | 'DELETED';
  classifications?: AtlasClassification[];
  updateTime?: number;
  createTime?: number;
}

export interface AtlasSearchConfig {
  query: string;
  typeName?: string;
  classification?: string;
  limit?: number;
  offset?: number;
}

export interface AtlasSearchResult {
  entities: AtlasEntity[];
  totalCount: number;
  hasMore: boolean;
}

export interface AtlasLineageInfo {
  baseEntityGuid: string;
  lineageDirection: string;
  lineageDepth: number;
  guidEntityMap: Record<string, AtlasEntity>;
  relations: AtlasLineageRelation[];
}

export interface AtlasLineageRelation {
  fromEntityId: string;
  toEntityId: string;
  relationshipId: string;
}

export interface AtlasRelationship {
  typeName: string;
  guid: string;
  attributes: Record<string, any>;
  end1: AtlasObjectId;
  end2: AtlasObjectId;
  status: 'ACTIVE' | 'DELETED';
}

export interface AtlasObjectId {
  guid: string;
  typeName: string;
  uniqueAttributes?: Record<string, any>;
}

export interface AtlasClassification {
  typeName: string;
  attributes: Record<string, any>;
  entityGuid?: string;
}

export interface AtlasTypeDef {
  entityDefs?: AtlasEntityDef[];
  relationshipDefs?: AtlasRelationshipDef[];
  classificationDefs?: AtlasClassificationDef[];
}

export interface AtlasEntityDef {
  name: string;
  superTypes: string[];
  attributeDefs: AtlasAttributeDef[];
}

export interface AtlasRelationshipDef {
  name: string;
  endDef1: AtlasRelationshipEndDef;
  endDef2: AtlasRelationshipEndDef;
}

export interface AtlasClassificationDef {
  name: string;
  attributeDefs: AtlasAttributeDef[];
}

export interface AtlasAttributeDef {
  name: string;
  typeName: string;
  cardinality: 'SINGLE' | 'LIST' | 'SET';
  isOptional: boolean;
}

export interface AtlasRelationshipEndDef {
  type: string;
  name: string;
  isContainer: boolean;
  cardinality: 'SINGLE' | 'LIST' | 'SET';
}

export interface AtlasTypeDefHeader {
  guid: string;
  name: string;
  category: string;
}

export interface DatasetConfig {
  id?: string;
  name: string;
  description: string;
  owner: string;
  location: string;
  format: string;
  schema: SchemaDefinition;
  tags?: string[];
  classifications?: AtlasClassification[];
  system?: string;
}

export interface PipelineConfig {
  id?: string;
  name: string;
  description: string;
  owner: string;
  inputs: string[];
  outputs: string[];
  system?: string;
}

export interface CatalogSearchQuery {
  text?: string;
  type?: string;
  owner?: string;
  tags?: string[];
  classification?: string;
  limit?: number;
  offset?: number;
}

export interface CatalogSearchResult {
  entries: DataCatalogEntry[];
  totalCount: number;
  hasMore: boolean;
  facets: SearchFacet[];
}

export interface SearchFacet {
  name: string;
  values: Array<{ value: string; count: number }>;
}

export interface DataClassification {
  type: string;
  attributes?: Record<string, any>;
  confidenceLevel?: number;
}

export interface DataQualityScore {
  datasetId: string;
  overallScore: number;
  dimensions: {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
    validity: number;
  };
  lastAssessed: Date;
  issues: Array<{
    type: string;
    description: string;
    severity: string;
  }>;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface DatasetUsage {
  datasetId: string;
  timeRange: TimeRange;
  queryCount: number;
  uniqueUsers: number;
  topQueries: Array<{
    query: string;
    count: number;
  }>;
  topUsers: Array<{
    userId: string;
    queryCount: number;
  }>;
  averageQueryTime: number;
  peakUsageTimes: Array<{
    hour: number;
    queryCount: number;
  }>;
}

export interface TransformationTrackingConfig {
  pipelineId: string;
  stepId: string;
  inputFields: string[];
  outputFields: string[];
  logic: string;
}

export interface LineagePath {
  nodeId: string;
  upstream: LineageNode[];
  downstream: LineageNode[];
  depth: number;
}

export interface LineageAnomaly {
  type: string;
  description: string;
  affectedNodes: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}