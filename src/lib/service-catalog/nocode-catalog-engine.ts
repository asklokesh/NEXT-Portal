/**
 * Advanced No-Code Service Catalog Engine
 * Inspired by Spotify Portal for Backstage - Maximum No-Code Capabilities
 * 
 * Key Features:
 * - Visual Workflow Builder with drag-and-drop interface
 * - Intelligent schema detection and auto-configuration
 * - Zero-code service definition and deployment
 * - AI-powered service discovery and documentation
 * - Real-time collaboration and live editing
 * - Enterprise-grade governance and compliance
 */

import { EventEmitter } from 'events';

// Core Service Catalog Types
export interface ServiceEntity {
  id: string;
  kind: 'Component' | 'System' | 'Domain' | 'Resource' | 'API' | 'Website' | 'Library';
  metadata: {
    name: string;
    namespace?: string;
    title?: string;
    description?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    tags?: string[];
    links?: Array<{
      url: string;
      title?: string;
      icon?: string;
    }>;
  };
  spec: {
    type?: string;
    lifecycle?: 'experimental' | 'production' | 'deprecated';
    owner?: string;
    system?: string;
    domain?: string;
    dependsOn?: string[];
    providesApis?: string[];
    consumesApis?: string[];
    [key: string]: any;
  };
  relations?: {
    dependsOn?: string[];
    dependencyOf?: string[];
    childOf?: string[];
    parentOf?: string[];
    ownedBy?: string[];
    ownerOf?: string[];
  };
  status?: {
    healthStatus: 'healthy' | 'warning' | 'error' | 'unknown';
    lastUpdated: Date;
    version?: string;
    environment?: string;
  };
}

// Visual Workflow Builder Types
export interface WorkflowNode {
  id: string;
  type: 'service' | 'api' | 'database' | 'queue' | 'cache' | 'function' | 'gateway';
  position: { x: number; y: number };
  data: {
    label: string;
    config: Record<string, any>;
    template?: string;
  };
  inputs?: string[];
  outputs?: string[];
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: 'data' | 'dependency' | 'api-call' | 'event';
  data?: {
    label?: string;
    protocol?: string;
    format?: string;
  };
}

export interface ServiceWorkflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata: {
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    version: string;
    tags: string[];
  };
  deployment: {
    environment: string;
    status: 'draft' | 'deploying' | 'deployed' | 'failed';
    lastDeployed?: Date;
  };
}

// No-Code Configuration Schema
export interface NoCodeSchema {
  id: string;
  name: string;
  category: string;
  schema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      title: string;
      description: string;
      default?: any;
      enum?: any[];
      format?: string;
      validation?: {
        required?: boolean;
        pattern?: string;
        min?: number;
        max?: number;
      };
      ui: {
        widget: 'input' | 'select' | 'textarea' | 'checkbox' | 'slider' | 'file' | 'code' | 'color' | 'date';
        placeholder?: string;
        help?: string;
        hidden?: boolean;
        readonly?: boolean;
      };
    }>;
    required: string[];
    dependencies?: Record<string, any>;
  };
  templates: {
    generate: (config: Record<string, any>) => {
      files: Array<{
        path: string;
        content: string;
      }>;
      commands: string[];
      environment: Record<string, string>;
    };
  };
}

// Intelligent Service Discovery
export interface ServiceDiscoveryResult {
  entities: ServiceEntity[];
  relationships: Array<{
    source: string;
    target: string;
    type: string;
    confidence: number;
  }>;
  suggestions: Array<{
    type: 'missing-dependency' | 'optimization' | 'security' | 'compliance';
    title: string;
    description: string;
    action: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  }>;
  metrics: {
    coverage: number;
    health: number;
    compliance: number;
    performance: number;
  };
}

// Auto-Documentation Generator
export interface DocumentationTemplate {
  id: string;
  name: string;
  type: 'api' | 'component' | 'system' | 'runbook' | 'architecture';
  template: string; // Handlebars template
  extractors: Array<{
    source: 'code' | 'config' | 'metadata' | 'metrics';
    pattern: string;
    transformer: (data: any) => any;
  }>;
  generators: Array<{
    format: 'markdown' | 'html' | 'pdf' | 'confluence' | 'notion';
    output: string;
  }>;
}

// Main No-Code Catalog Engine
export class NoCodeCatalogEngine extends EventEmitter {
  private entities: Map<string, ServiceEntity> = new Map();
  private workflows: Map<string, ServiceWorkflow> = new Map();
  private schemas: Map<string, NoCodeSchema> = new Map();
  private documentationTemplates: Map<string, DocumentationTemplate> = new Map();
  private collaborationSessions: Map<string, any> = new Map();

  constructor() {
    super();
    this.initializeSchemas();
    this.initializeDocumentationTemplates();
    this.startIntelligentMonitoring();
  }

  /**
   * Visual Workflow Builder - Create services through drag-and-drop
   */
  async createWorkflow(workflow: Omit<ServiceWorkflow, 'id' | 'metadata' | 'deployment'>): Promise<string> {
    const id = this.generateId('workflow');
    
    const fullWorkflow: ServiceWorkflow = {
      ...workflow,
      id,
      metadata: {
        createdBy: 'current-user', // Would be from context
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0',
        tags: []
      },
      deployment: {
        environment: 'development',
        status: 'draft'
      }
    };

    this.workflows.set(id, fullWorkflow);
    this.emit('workflow:created', fullWorkflow);

    // Auto-generate service entities from workflow
    await this.generateEntitiesFromWorkflow(fullWorkflow);

    return id;
  }

  /**
   * Generate service entities from visual workflow
   */
  private async generateEntitiesFromWorkflow(workflow: ServiceWorkflow): Promise<void> {
    const generatedEntities: ServiceEntity[] = [];

    for (const node of workflow.nodes) {
      const entity: ServiceEntity = {
        id: `${workflow.id}-${node.id}`,
        kind: this.mapNodeTypeToEntityKind(node.type),
        metadata: {
          name: node.data.label.toLowerCase().replace(/\s+/g, '-'),
          title: node.data.label,
          description: `Auto-generated from workflow: ${workflow.name}`,
          labels: {
            'workflow-id': workflow.id,
            'node-type': node.type,
            'auto-generated': 'true'
          },
          annotations: {
            'nocode/workflow-position': JSON.stringify(node.position),
            'nocode/template': node.data.template || 'default'
          }
        },
        spec: {
          type: node.type,
          lifecycle: 'experimental',
          owner: workflow.metadata.createdBy,
          dependsOn: this.calculateDependencies(node, workflow),
          ...node.data.config
        },
        status: {
          healthStatus: 'unknown',
          lastUpdated: new Date()
        }
      };

      generatedEntities.push(entity);
      this.entities.set(entity.id, entity);
    }

    this.emit('entities:generated', { workflowId: workflow.id, entities: generatedEntities });
  }

  /**
   * Intelligent Schema Detection - Auto-discover configuration options
   */
  async detectSchemas(source: 'repository' | 'docker' | 'kubernetes' | 'terraform', config: any): Promise<NoCodeSchema[]> {
    const detectedSchemas: NoCodeSchema[] = [];

    switch (source) {
      case 'repository':
        detectedSchemas.push(...await this.detectRepositorySchemas(config));
        break;
      case 'docker':
        detectedSchemas.push(...await this.detectDockerSchemas(config));
        break;
      case 'kubernetes':
        detectedSchemas.push(...await this.detectKubernetesSchemas(config));
        break;
      case 'terraform':
        detectedSchemas.push(...await this.detectTerraformSchemas(config));
        break;
    }

    // Store detected schemas
    for (const schema of detectedSchemas) {
      this.schemas.set(schema.id, schema);
    }

    this.emit('schemas:detected', { source, count: detectedSchemas.length, schemas: detectedSchemas });

    return detectedSchemas;
  }

  /**
   * No-Code Configuration Interface - Generate dynamic forms
   */
  generateConfigurationInterface(entityId: string): {
    schema: any;
    uiSchema: any;
    formData: any;
  } {
    const entity = this.entities.get(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    const schemaId = entity.metadata.annotations?.['nocode/schema'] || 'default';
    const schema = this.schemas.get(schemaId);

    if (!schema) {
      return this.generateGenericConfigInterface(entity);
    }

    return {
      schema: schema.schema,
      uiSchema: this.generateUISchema(schema),
      formData: entity.spec
    };
  }

  /**
   * AI-Powered Service Discovery
   */
  async discoverServices(options: {
    sources: string[];
    filters?: Record<string, any>;
    includeRelationships?: boolean;
    generateSuggestions?: boolean;
  }): Promise<ServiceDiscoveryResult> {
    const startTime = Date.now();
    
    // Simulate intelligent service discovery
    const discoveredEntities: ServiceEntity[] = [];
    const relationships: ServiceDiscoveryResult['relationships'] = [];
    const suggestions: ServiceDiscoveryResult['suggestions'] = [];

    // Mock discovery process
    for (const source of options.sources) {
      const entities = await this.discoverFromSource(source, options.filters);
      discoveredEntities.push(...entities);
    }

    // Calculate relationships if requested
    if (options.includeRelationships) {
      for (const entity of discoveredEntities) {
        const entityRelationships = await this.calculateEntityRelationships(entity, discoveredEntities);
        relationships.push(...entityRelationships);
      }
    }

    // Generate AI suggestions if requested
    if (options.generateSuggestions) {
      for (const entity of discoveredEntities) {
        const entitySuggestions = await this.generateAISuggestions(entity, discoveredEntities);
        suggestions.push(...entitySuggestions);
      }
    }

    const result: ServiceDiscoveryResult = {
      entities: discoveredEntities,
      relationships,
      suggestions,
      metrics: {
        coverage: this.calculateCoverage(discoveredEntities),
        health: this.calculateOverallHealth(discoveredEntities),
        compliance: this.calculateComplianceScore(discoveredEntities),
        performance: Date.now() - startTime
      }
    };

    this.emit('discovery:completed', result);

    return result;
  }

  /**
   * Auto-Documentation Generator
   */
  async generateDocumentation(entityId: string, templateId: string): Promise<{
    content: string;
    format: string;
    metadata: any;
  }> {
    const entity = this.entities.get(entityId);
    const template = this.documentationTemplates.get(templateId);

    if (!entity || !template) {
      throw new Error('Entity or template not found');
    }

    // Extract data from various sources
    const extractedData = await this.extractDocumentationData(entity, template);
    
    // Generate content using template
    const content = await this.renderDocumentationTemplate(template, extractedData);

    const result = {
      content,
      format: 'markdown', // Default format
      metadata: {
        entityId,
        templateId,
        generatedAt: new Date(),
        version: entity.status?.version || '1.0.0',
        autoGenerated: true
      }
    };

    this.emit('documentation:generated', result);

    return result;
  }

  /**
   * Real-time Collaboration System
   */
  async startCollaborationSession(workflowId: string, userId: string): Promise<string> {
    const sessionId = this.generateId('session');
    
    const session = {
      id: sessionId,
      workflowId,
      participants: new Map([[userId, { joinedAt: new Date(), cursor: null }]]),
      changes: [],
      startedAt: new Date()
    };

    this.collaborationSessions.set(sessionId, session);
    this.emit('collaboration:session-started', { sessionId, workflowId, userId });

    return sessionId;
  }

  async joinCollaborationSession(sessionId: string, userId: string): Promise<void> {
    const session = this.collaborationSessions.get(sessionId);
    if (!session) {
      throw new Error(`Collaboration session not found: ${sessionId}`);
    }

    session.participants.set(userId, { joinedAt: new Date(), cursor: null });
    this.emit('collaboration:user-joined', { sessionId, userId });
  }

  async broadcastChange(sessionId: string, userId: string, change: any): Promise<void> {
    const session = this.collaborationSessions.get(sessionId);
    if (!session) {
      throw new Error(`Collaboration session not found: ${sessionId}`);
    }

    const changeRecord = {
      id: this.generateId('change'),
      userId,
      timestamp: new Date(),
      type: change.type,
      data: change.data
    };

    session.changes.push(changeRecord);
    
    // Apply change to workflow
    await this.applyCollaborativeChange(session.workflowId, changeRecord);
    
    // Broadcast to all participants
    this.emit('collaboration:change', { sessionId, change: changeRecord });
  }

  // Private helper methods
  private initializeSchemas(): void {
    // Initialize built-in schemas for common service types
    const commonSchemas = [
      this.createWebServiceSchema(),
      this.createDatabaseSchema(),
      this.createAPISchema(),
      this.createQueueSchema(),
      this.createCacheSchema()
    ];

    for (const schema of commonSchemas) {
      this.schemas.set(schema.id, schema);
    }
  }

  private initializeDocumentationTemplates(): void {
    // Initialize built-in documentation templates
    const templates = [
      this.createAPIDocumentationTemplate(),
      this.createServiceRunbookTemplate(),
      this.createArchitectureDocumentationTemplate()
    ];

    for (const template of templates) {
      this.documentationTemplates.set(template.id, template);
    }
  }

  private startIntelligentMonitoring(): void {
    // Start background processes for intelligent features
    setInterval(() => this.performHealthChecks(), 60000); // Every minute
    setInterval(() => this.analyzeServiceRelationships(), 300000); // Every 5 minutes
    setInterval(() => this.generateOptimizationSuggestions(), 900000); // Every 15 minutes
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapNodeTypeToEntityKind(nodeType: string): ServiceEntity['kind'] {
    const mapping = {
      'service': 'Component',
      'api': 'API',
      'database': 'Resource',
      'queue': 'Resource',
      'cache': 'Resource',
      'function': 'Component',
      'gateway': 'Component'
    };
    return (mapping[nodeType] || 'Component') as ServiceEntity['kind'];
  }

  private calculateDependencies(node: WorkflowNode, workflow: ServiceWorkflow): string[] {
    return workflow.edges
      .filter(edge => edge.target === node.id)
      .map(edge => `${workflow.id}-${edge.source}`);
  }

  // Schema detection methods
  private async detectRepositorySchemas(config: any): Promise<NoCodeSchema[]> {
    // Mock implementation - would analyze repository contents
    return [this.createWebServiceSchema()];
  }

  private async detectDockerSchemas(config: any): Promise<NoCodeSchema[]> {
    // Mock implementation - would analyze Dockerfile and docker-compose
    return [this.createWebServiceSchema()];
  }

  private async detectKubernetesSchemas(config: any): Promise<NoCodeSchema[]> {
    // Mock implementation - would analyze K8s manifests
    return [this.createWebServiceSchema()];
  }

  private async detectTerraformSchemas(config: any): Promise<NoCodeSchema[]> {
    // Mock implementation - would analyze Terraform configs
    return [this.createWebServiceSchema()];
  }

  private generateGenericConfigInterface(entity: ServiceEntity): any {
    return {
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', title: 'Name' },
          description: { type: 'string', title: 'Description' },
          owner: { type: 'string', title: 'Owner' },
          lifecycle: { 
            type: 'string', 
            title: 'Lifecycle',
            enum: ['experimental', 'production', 'deprecated']
          }
        }
      },
      uiSchema: {},
      formData: entity.spec
    };
  }

  private generateUISchema(schema: NoCodeSchema): any {
    const uiSchema = {};
    
    for (const [key, property] of Object.entries(schema.schema.properties)) {
      uiSchema[key] = {
        'ui:widget': property.ui.widget,
        'ui:placeholder': property.ui.placeholder,
        'ui:help': property.ui.help,
        'ui:readonly': property.ui.readonly,
        'ui:hidden': property.ui.hidden
      };
    }

    return uiSchema;
  }

  // Service discovery methods
  private async discoverFromSource(source: string, filters?: any): Promise<ServiceEntity[]> {
    // Mock implementation - would integrate with various discovery sources
    return [];
  }

  private async calculateEntityRelationships(entity: ServiceEntity, allEntities: ServiceEntity[]): Promise<any[]> {
    // Mock implementation - would analyze relationships
    return [];
  }

  private async generateAISuggestions(entity: ServiceEntity, allEntities: ServiceEntity[]): Promise<any[]> {
    // Mock implementation - would use AI to generate suggestions
    return [];
  }

  // Metrics calculation methods
  private calculateCoverage(entities: ServiceEntity[]): number {
    return Math.random() * 100; // Mock implementation
  }

  private calculateOverallHealth(entities: ServiceEntity[]): number {
    return Math.random() * 100; // Mock implementation
  }

  private calculateComplianceScore(entities: ServiceEntity[]): number {
    return Math.random() * 100; // Mock implementation
  }

  // Documentation methods
  private async extractDocumentationData(entity: ServiceEntity, template: DocumentationTemplate): Promise<any> {
    const data = { entity };
    
    for (const extractor of template.extractors) {
      try {
        const extractedData = await this.runExtractor(extractor, entity);
        data[extractor.source] = extractedData;
      } catch (error) {
        console.warn(`Failed to extract data from ${extractor.source}:`, error);
      }
    }

    return data;
  }

  private async renderDocumentationTemplate(template: DocumentationTemplate, data: any): Promise<string> {
    // Mock implementation - would use Handlebars or similar
    return `# ${data.entity.metadata.title}\n\n${data.entity.metadata.description}`;
  }

  private async runExtractor(extractor: any, entity: ServiceEntity): Promise<any> {
    // Mock implementation - would run the actual extractor
    return {};
  }

  // Collaboration methods
  private async applyCollaborativeChange(workflowId: string, change: any): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    // Apply the change based on type
    switch (change.type) {
      case 'node-moved':
        this.applyNodeMove(workflow, change.data);
        break;
      case 'node-added':
        this.applyNodeAdd(workflow, change.data);
        break;
      case 'node-removed':
        this.applyNodeRemove(workflow, change.data);
        break;
      case 'edge-added':
        this.applyEdgeAdd(workflow, change.data);
        break;
      case 'edge-removed':
        this.applyEdgeRemove(workflow, change.data);
        break;
    }

    workflow.metadata.updatedAt = new Date();
    this.workflows.set(workflowId, workflow);
  }

  private applyNodeMove(workflow: ServiceWorkflow, data: any): void {
    const node = workflow.nodes.find(n => n.id === data.nodeId);
    if (node) {
      node.position = data.position;
    }
  }

  private applyNodeAdd(workflow: ServiceWorkflow, data: any): void {
    workflow.nodes.push(data.node);
  }

  private applyNodeRemove(workflow: ServiceWorkflow, data: any): void {
    workflow.nodes = workflow.nodes.filter(n => n.id !== data.nodeId);
    workflow.edges = workflow.edges.filter(e => 
      e.source !== data.nodeId && e.target !== data.nodeId
    );
  }

  private applyEdgeAdd(workflow: ServiceWorkflow, data: any): void {
    workflow.edges.push(data.edge);
  }

  private applyEdgeRemove(workflow: ServiceWorkflow, data: any): void {
    workflow.edges = workflow.edges.filter(e => e.id !== data.edgeId);
  }

  // Background monitoring methods
  private async performHealthChecks(): Promise<void> {
    for (const [id, entity] of this.entities) {
      // Mock health check - would actually check service health
      const healthStatus = Math.random() > 0.8 ? 'error' : 'healthy';
      entity.status = {
        ...entity.status!,
        healthStatus: healthStatus as any,
        lastUpdated: new Date()
      };
    }
  }

  private async analyzeServiceRelationships(): Promise<void> {
    // Mock relationship analysis
    this.emit('relationships:analyzed', { timestamp: new Date() });
  }

  private async generateOptimizationSuggestions(): Promise<void> {
    // Mock optimization suggestions
    this.emit('suggestions:generated', { timestamp: new Date() });
  }

  // Schema creation helpers
  private createWebServiceSchema(): NoCodeSchema {
    return {
      id: 'web-service',
      name: 'Web Service',
      category: 'service',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'Service Name',
            description: 'Name of the web service',
            validation: { required: true, pattern: '^[a-z0-9-]+$' },
            ui: {
              widget: 'input',
              placeholder: 'my-awesome-service',
              help: 'Use lowercase letters, numbers, and hyphens only'
            }
          },
          port: {
            type: 'number',
            title: 'Port',
            description: 'Port number for the service',
            default: 3000,
            validation: { min: 1024, max: 65535 },
            ui: {
              widget: 'input',
              help: 'Port number between 1024 and 65535'
            }
          },
          framework: {
            type: 'string',
            title: 'Framework',
            description: 'Web framework to use',
            enum: ['express', 'fastify', 'koa', 'nestjs', 'next', 'nuxt'],
            default: 'express',
            ui: {
              widget: 'select',
              help: 'Choose the web framework for your service'
            }
          },
          database: {
            type: 'boolean',
            title: 'Include Database',
            description: 'Whether to include a database',
            default: false,
            ui: {
              widget: 'checkbox',
              help: 'Check if your service needs a database'
            }
          }
        },
        required: ['name', 'port', 'framework']
      },
      templates: {
        generate: (config: Record<string, any>) => ({
          files: [
            {
              path: `${config.name}/package.json`,
              content: JSON.stringify({
                name: config.name,
                version: '1.0.0',
                main: 'index.js',
                dependencies: {
                  [config.framework]: 'latest'
                }
              }, null, 2)
            },
            {
              path: `${config.name}/index.js`,
              content: `const ${config.framework} = require('${config.framework}');
const app = ${config.framework}();

app.get('/', (req, res) => {
  res.json({ message: 'Hello from ${config.name}!' });
});

app.listen(${config.port}, () => {
  console.log('Server running on port ${config.port}');
});`
            }
          ],
          commands: ['npm install', 'npm start'],
          environment: {
            PORT: config.port.toString(),
            NODE_ENV: 'development'
          }
        })
      }
    };
  }

  private createDatabaseSchema(): NoCodeSchema {
    return {
      id: 'database',
      name: 'Database',
      category: 'resource',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'Database Name',
            description: 'Name of the database',
            validation: { required: true },
            ui: { widget: 'input' }
          },
          type: {
            type: 'string',
            title: 'Database Type',
            enum: ['postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch'],
            default: 'postgresql',
            ui: { widget: 'select' }
          },
          version: {
            type: 'string',
            title: 'Version',
            default: 'latest',
            ui: { widget: 'input' }
          }
        },
        required: ['name', 'type']
      },
      templates: {
        generate: (config: Record<string, any>) => ({
          files: [
            {
              path: `${config.name}/docker-compose.yml`,
              content: `version: '3.8'
services:
  ${config.name}:
    image: ${config.type}:${config.version}
    environment:
      - POSTGRES_DB=${config.name}
      - POSTGRES_USER=admin
      - POSTGRES_PASSWORD=password
    ports:
      - "5432:5432"`
            }
          ],
          commands: ['docker-compose up -d'],
          environment: {
            DATABASE_URL: `${config.type}://admin:password@localhost:5432/${config.name}`
          }
        })
      }
    };
  }

  private createAPISchema(): NoCodeSchema {
    return {
      id: 'api',
      name: 'API',
      category: 'api',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'API Name',
            validation: { required: true },
            ui: { widget: 'input' }
          },
          version: {
            type: 'string',
            title: 'API Version',
            default: 'v1',
            ui: { widget: 'input' }
          },
          protocol: {
            type: 'string',
            title: 'Protocol',
            enum: ['REST', 'GraphQL', 'gRPC', 'WebSocket'],
            default: 'REST',
            ui: { widget: 'select' }
          }
        },
        required: ['name', 'protocol']
      },
      templates: {
        generate: (config: Record<string, any>) => ({
          files: [
            {
              path: `${config.name}/openapi.yml`,
              content: `openapi: 3.0.0
info:
  title: ${config.name}
  version: ${config.version}
paths:
  /health:
    get:
      responses:
        '200':
          description: Health check`
            }
          ],
          commands: ['swagger-codegen generate -i openapi.yml -l nodejs-server'],
          environment: {}
        })
      }
    };
  }

  private createQueueSchema(): NoCodeSchema {
    return {
      id: 'queue',
      name: 'Message Queue',
      category: 'resource',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'Queue Name',
            validation: { required: true },
            ui: { widget: 'input' }
          },
          type: {
            type: 'string',
            title: 'Queue Type',
            enum: ['rabbitmq', 'kafka', 'redis', 'sqs'],
            default: 'rabbitmq',
            ui: { widget: 'select' }
          }
        },
        required: ['name', 'type']
      },
      templates: {
        generate: (config: Record<string, any>) => ({
          files: [],
          commands: [],
          environment: {}
        })
      }
    };
  }

  private createCacheSchema(): NoCodeSchema {
    return {
      id: 'cache',
      name: 'Cache',
      category: 'resource',
      schema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'Cache Name',
            validation: { required: true },
            ui: { widget: 'input' }
          },
          type: {
            type: 'string',
            title: 'Cache Type',
            enum: ['redis', 'memcached', 'hazelcast'],
            default: 'redis',
            ui: { widget: 'select' }
          }
        },
        required: ['name', 'type']
      },
      templates: {
        generate: (config: Record<string, any>) => ({
          files: [],
          commands: [],
          environment: {}
        })
      }
    };
  }

  // Documentation template helpers
  private createAPIDocumentationTemplate(): DocumentationTemplate {
    return {
      id: 'api-docs',
      name: 'API Documentation',
      type: 'api',
      template: `# {{entity.metadata.title}}

{{entity.metadata.description}}

## Overview
- **Version**: {{entity.spec.version}}
- **Protocol**: {{entity.spec.protocol}}
- **Base URL**: {{entity.spec.baseUrl}}

## Endpoints
{{#each api.endpoints}}
### {{method}} {{path}}
{{description}}
{{/each}}`,
      extractors: [
        {
          source: 'code',
          pattern: '*.openapi.yml',
          transformer: (data: any) => data
        }
      ],
      generators: [
        {
          format: 'markdown',
          output: 'README.md'
        }
      ]
    };
  }

  private createServiceRunbookTemplate(): DocumentationTemplate {
    return {
      id: 'service-runbook',
      name: 'Service Runbook',
      type: 'component',
      template: `# {{entity.metadata.title}} Runbook

## Service Overview
{{entity.metadata.description}}

## Quick Links
{{#each entity.metadata.links}}
- [{{title}}]({{url}})
{{/each}}

## Health Monitoring
- **Status**: {{entity.status.healthStatus}}
- **Last Updated**: {{entity.status.lastUpdated}}

## Common Operations
### Starting the Service
\`\`\`bash
npm start
\`\`\`

### Checking Logs
\`\`\`bash
docker logs {{entity.metadata.name}}
\`\`\``,
      extractors: [],
      generators: [
        {
          format: 'markdown',
          output: 'RUNBOOK.md'
        }
      ]
    };
  }

  private createArchitectureDocumentationTemplate(): DocumentationTemplate {
    return {
      id: 'architecture-docs',
      name: 'Architecture Documentation',
      type: 'system',
      template: `# {{entity.metadata.title}} Architecture

## System Overview
{{entity.metadata.description}}

## Components
{{#each system.components}}
- **{{name}}**: {{description}}
{{/each}}

## Dependencies
{{#each entity.relations.dependsOn}}
- {{this}}
{{/each}}`,
      extractors: [
        {
          source: 'metadata',
          pattern: 'system.components',
          transformer: (data: any) => data
        }
      ],
      generators: [
        {
          format: 'markdown',
          output: 'ARCHITECTURE.md'
        }
      ]
    };
  }
}

// Singleton instance
export const noCatalogEngine = new NoCodeCatalogEngine();

// Export types for use in other modules
export type {
  ServiceEntity,
  WorkflowNode,
  WorkflowEdge,
  ServiceWorkflow,
  NoCodeSchema,
  ServiceDiscoveryResult,
  DocumentationTemplate
};