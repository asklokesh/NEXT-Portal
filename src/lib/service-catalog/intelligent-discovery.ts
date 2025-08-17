/**
 * Intelligent Service Discovery & Auto-Documentation
 * AI-powered service discovery, relationship mapping, and automatic documentation generation
 */

import { EventEmitter } from 'events';

// Discovery source types
export interface DiscoverySource {
  id: string;
  name: string;
  type: 'git' | 'kubernetes' | 'docker' | 'cloud-provider' | 'api-gateway' | 'service-mesh' | 'monitoring';
  config: {
    endpoint?: string;
    credentials?: Record<string, string>;
    filters?: Record<string, any>;
    polling?: {
      enabled: boolean;
      interval: number; // seconds
    };
  };
  status: 'active' | 'inactive' | 'error';
  lastSync?: Date;
  discovered?: number; // count of discovered services
}

// Discovered service entity
export interface DiscoveredService {
  id: string;
  name: string;
  namespace?: string;
  type: 'service' | 'api' | 'database' | 'queue' | 'cache' | 'function' | 'frontend';
  technology: string;
  framework?: string;
  language?: string;
  version?: string;
  
  // Source information
  source: {
    type: string;
    repository?: string;
    path?: string;
    branch?: string;
    lastModified?: Date;
  };
  
  // Network endpoints
  endpoints: Array<{
    url: string;
    protocol: 'http' | 'https' | 'grpc' | 'tcp' | 'udp';
    port: number;
    path?: string;
    internal?: boolean;
    healthCheck?: string;
  }>;
  
  // Dependencies and relationships
  dependencies: Array<{
    service: string;
    type: 'api-call' | 'database' | 'queue' | 'cache' | 'file-storage';
    protocol?: string;
    required: boolean;
  }>;
  
  // Configuration and environment
  configuration: {
    environment: string;
    replicas?: number;
    resources?: {
      cpu: string;
      memory: string;
    };
    scaling?: {
      min: number;
      max: number;
      targetCPU: number;
    };
  };
  
  // Metadata extracted from various sources
  metadata: {
    labels: Record<string, string>;
    annotations: Record<string, string>;
    tags: string[];
    owner?: string;
    team?: string;
    contacts?: string[];
    documentation?: string[];
    repository?: string;
    issues?: string;
    ci?: string;
    monitoring?: string;
  };
  
  // Health and status
  health: {
    status: 'healthy' | 'warning' | 'error' | 'unknown';
    uptime?: number;
    responseTime?: number;
    errorRate?: number;
    lastCheck?: Date;
  };
  
  // Auto-generated documentation
  documentation?: {
    generated: boolean;
    lastUpdated: Date;
    sections: Array<{
      type: 'overview' | 'api' | 'dependencies' | 'deployment' | 'monitoring' | 'troubleshooting';
      content: string;
      confidence: number;
    }>;
  };
  
  // Discovery metadata
  discoveredAt: Date;
  lastUpdated: Date;
  confidence: number; // AI confidence in service identification
}

// Service relationship
export interface ServiceRelationship {
  id: string;
  source: string;
  target: string;
  type: 'api-call' | 'database-connection' | 'queue-consumer' | 'queue-producer' | 'shared-cache' | 'deployment-dependency';
  protocol?: string;
  direction: 'bidirectional' | 'source-to-target' | 'target-to-source';
  strength: number; // 0-1, how strong the relationship is
  frequency?: number; // requests per minute
  confidence: number; // AI confidence in relationship
  discoveredAt: Date;
  metadata?: Record<string, any>;
}

// API specification extracted from services
export interface ExtractedAPISpec {
  service: string;
  format: 'openapi' | 'graphql' | 'grpc' | 'custom';
  version: string;
  specification: any; // OpenAPI, GraphQL schema, etc.
  endpoints: Array<{
    method: string;
    path: string;
    description?: string;
    parameters?: any[];
    responses?: any;
    examples?: any;
  }>;
  models?: any; // Data models/schemas
  authentication?: {
    type: 'none' | 'api-key' | 'jwt' | 'oauth2' | 'basic';
    details: any;
  };
  extractedAt: Date;
  confidence: number;
}

// Documentation template for auto-generation
export interface DocumentationTemplate {
  id: string;
  name: string;
  serviceTypes: string[];
  sections: Array<{
    id: string;
    name: string;
    template: string; // Handlebars template
    required: boolean;
    dataSources: string[]; // What data is needed
  }>;
  outputFormat: 'markdown' | 'html' | 'confluence' | 'notion';
}

// Main intelligent discovery engine
export class IntelligentDiscoveryEngine extends EventEmitter {
  private sources: Map<string, DiscoverySource> = new Map();
  private discoveredServices: Map<string, DiscoveredService> = new Map();
  private relationships: Map<string, ServiceRelationship> = new Map();
  private apiSpecs: Map<string, ExtractedAPISpec> = new Map();
  private documentationTemplates: Map<string, DocumentationTemplate> = new Map();
  
  private discoveryInterval: NodeJS.Timeout | null = null;
  private isDiscovering = false;

  constructor() {
    super();
    this.initializeDefaultSources();
    this.initializeDocumentationTemplates();
    this.startPeriodicDiscovery();
  }

  /**
   * Add a new discovery source
   */
  async addSource(source: Omit<DiscoverySource, 'id' | 'status' | 'discovered'>): Promise<string> {
    const id = `source_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const fullSource: DiscoverySource = {
      ...source,
      id,
      status: 'inactive',
      discovered: 0
    };

    // Validate source configuration
    if (await this.validateSourceConfig(fullSource)) {
      this.sources.set(id, fullSource);
      this.emit('source:added', fullSource);
      
      // Test connection
      await this.testSourceConnection(fullSource);
      
      return id;
    } else {
      throw new Error('Invalid source configuration');
    }
  }

  /**
   * Start discovery from all active sources
   */
  async startDiscovery(): Promise<void> {
    if (this.isDiscovering) {
      console.log('Discovery already in progress');
      return;
    }

    this.isDiscovering = true;
    this.emit('discovery:started');

    try {
      const activeSources = Array.from(this.sources.values()).filter(s => s.status === 'active');
      const discoveryPromises = activeSources.map(source => this.discoverFromSource(source));
      
      const results = await Promise.allSettled(discoveryPromises);
      
      // Process results
      let totalDiscovered = 0;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          totalDiscovered += result.value.length;
        } else {
          console.error(`Discovery failed for source ${activeSources[index].id}:`, result.reason);
        }
      });

      // Analyze relationships between discovered services
      await this.analyzeServiceRelationships();
      
      // Generate documentation for new services
      await this.generateDocumentationForNewServices();
      
      this.emit('discovery:completed', {
        servicesDiscovered: totalDiscovered,
        relationshipsFound: this.relationships.size,
        duration: Date.now()
      });

    } catch (error) {
      this.emit('discovery:error', error);
      throw error;
    } finally {
      this.isDiscovering = false;
    }
  }

  /**
   * Discover services from a specific source
   */
  private async discoverFromSource(source: DiscoverySource): Promise<DiscoveredService[]> {
    console.log(`Starting discovery from source: ${source.name} (${source.type})`);
    
    const startTime = Date.now();
    let discovered: DiscoveredService[] = [];

    try {
      switch (source.type) {
        case 'git':
          discovered = await this.discoverFromGit(source);
          break;
        case 'kubernetes':
          discovered = await this.discoverFromKubernetes(source);
          break;
        case 'docker':
          discovered = await this.discoverFromDocker(source);
          break;
        case 'cloud-provider':
          discovered = await this.discoverFromCloudProvider(source);
          break;
        case 'api-gateway':
          discovered = await this.discoverFromAPIGateway(source);
          break;
        case 'service-mesh':
          discovered = await this.discoverFromServiceMesh(source);
          break;
        case 'monitoring':
          discovered = await this.discoverFromMonitoring(source);
          break;
        default:
          console.warn(`Unknown source type: ${source.type}`);
      }

      // Store discovered services
      for (const service of discovered) {
        this.discoveredServices.set(service.id, service);
      }

      // Update source stats
      source.discovered = discovered.length;
      source.lastSync = new Date();
      this.sources.set(source.id, source);

      this.emit('discovery:source-completed', {
        sourceId: source.id,
        servicesFound: discovered.length,
        duration: Date.now() - startTime
      });

      return discovered;

    } catch (error) {
      console.error(`Discovery failed for source ${source.id}:`, error);
      source.status = 'error';
      this.sources.set(source.id, source);
      throw error;
    }
  }

  /**
   * Discover services from Git repositories
   */
  private async discoverFromGit(source: DiscoverySource): Promise<DiscoveredService[]> {
    // Mock implementation - would integrate with Git APIs (GitHub, GitLab, etc.)
    const mockServices: DiscoveredService[] = [
      {
        id: 'git-service-user-api',
        name: 'user-api',
        type: 'api',
        technology: 'Node.js',
        framework: 'Express',
        language: 'TypeScript',
        version: '1.2.3',
        source: {
          type: 'git',
          repository: 'https://github.com/company/user-api',
          path: '/',
          branch: 'main',
          lastModified: new Date()
        },
        endpoints: [
          {
            url: 'https://api.company.com/users',
            protocol: 'https',
            port: 443,
            path: '/users',
            internal: false,
            healthCheck: '/health'
          }
        ],
        dependencies: [
          {
            service: 'postgres-users',
            type: 'database',
            protocol: 'postgresql',
            required: true
          }
        ],
        configuration: {
          environment: 'production',
          replicas: 3
        },
        metadata: {
          labels: { app: 'user-api', team: 'platform' },
          annotations: {},
          tags: ['api', 'users', 'authentication'],
          owner: 'platform-team',
          team: 'platform',
          repository: 'https://github.com/company/user-api'
        },
        health: {
          status: 'healthy',
          uptime: 99.9,
          responseTime: 120,
          errorRate: 0.1
        },
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        confidence: 0.95
      }
    ];

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return mockServices;
  }

  /**
   * Discover services from Kubernetes clusters
   */
  private async discoverFromKubernetes(source: DiscoverySource): Promise<DiscoveredService[]> {
    // Mock implementation - would use Kubernetes client
    const mockServices: DiscoveredService[] = [
      {
        id: 'k8s-service-payment-processor',
        name: 'payment-processor',
        namespace: 'payments',
        type: 'service',
        technology: 'Java',
        framework: 'Spring Boot',
        language: 'Java',
        version: '2.1.0',
        source: {
          type: 'kubernetes',
          path: '/deployments/payment-processor'
        },
        endpoints: [
          {
            url: 'http://payment-processor.payments.svc.cluster.local:8080',
            protocol: 'http',
            port: 8080,
            internal: true,
            healthCheck: '/actuator/health'
          }
        ],
        dependencies: [
          {
            service: 'redis-payments',
            type: 'cache',
            required: true
          },
          {
            service: 'kafka-events',
            type: 'queue',
            required: true
          }
        ],
        configuration: {
          environment: 'production',
          replicas: 5,
          resources: {
            cpu: '500m',
            memory: '1Gi'
          },
          scaling: {
            min: 2,
            max: 10,
            targetCPU: 70
          }
        },
        metadata: {
          labels: {
            app: 'payment-processor',
            version: '2.1.0',
            team: 'payments'
          },
          annotations: {
            'deployment.kubernetes.io/revision': '15'
          },
          tags: ['payments', 'microservice', 'java'],
          team: 'payments'
        },
        health: {
          status: 'healthy',
          lastCheck: new Date()
        },
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        confidence: 0.98
      }
    ];

    await new Promise(resolve => setTimeout(resolve, 800));
    return mockServices;
  }

  /**
   * Discover services from Docker environments
   */
  private async discoverFromDocker(source: DiscoverySource): Promise<DiscoveredService[]> {
    // Mock implementation
    const mockServices: DiscoveredService[] = [
      {
        id: 'docker-service-nginx-proxy',
        name: 'nginx-proxy',
        type: 'frontend',
        technology: 'Nginx',
        version: '1.21',
        source: {
          type: 'docker',
          path: '/containers/nginx-proxy'
        },
        endpoints: [
          {
            url: 'http://localhost:80',
            protocol: 'http',
            port: 80
          },
          {
            url: 'https://localhost:443',
            protocol: 'https',
            port: 443
          }
        ],
        dependencies: [],
        configuration: {
          environment: 'production'
        },
        metadata: {
          labels: { type: 'proxy', role: 'load-balancer' },
          annotations: {},
          tags: ['nginx', 'proxy', 'load-balancer']
        },
        health: {
          status: 'healthy'
        },
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        confidence: 0.90
      }
    ];

    await new Promise(resolve => setTimeout(resolve, 600));
    return mockServices;
  }

  /**
   * Discover services from cloud providers (AWS, GCP, Azure)
   */
  private async discoverFromCloudProvider(source: DiscoverySource): Promise<DiscoveredService[]> {
    // Mock implementation - would use cloud provider APIs
    const mockServices: DiscoveredService[] = [];
    await new Promise(resolve => setTimeout(resolve, 1200));
    return mockServices;
  }

  /**
   * Discover services from API gateways
   */
  private async discoverFromAPIGateway(source: DiscoverySource): Promise<DiscoveredService[]> {
    // Mock implementation
    const mockServices: DiscoveredService[] = [];
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockServices;
  }

  /**
   * Discover services from service mesh (Istio, Linkerd, etc.)
   */
  private async discoverFromServiceMesh(source: DiscoverySource): Promise<DiscoveredService[]> {
    // Mock implementation
    const mockServices: DiscoveredService[] = [];
    await new Promise(resolve => setTimeout(resolve, 900));
    return mockServices;
  }

  /**
   * Discover services from monitoring systems
   */
  private async discoverFromMonitoring(source: DiscoverySource): Promise<DiscoveredService[]> {
    // Mock implementation - would query Prometheus, Grafana, etc.
    const mockServices: DiscoveredService[] = [];
    await new Promise(resolve => setTimeout(resolve, 700));
    return mockServices;
  }

  /**
   * Analyze relationships between discovered services
   */
  private async analyzeServiceRelationships(): Promise<void> {
    console.log('Analyzing service relationships...');
    
    const services = Array.from(this.discoveredServices.values());
    const newRelationships: ServiceRelationship[] = [];

    // Analyze dependencies declared in services
    for (const service of services) {
      for (const dependency of service.dependencies) {
        const targetService = services.find(s => 
          s.name === dependency.service || 
          s.id === dependency.service
        );

        if (targetService) {
          const relationshipId = `${service.id}-${targetService.id}-${dependency.type}`;
          
          newRelationships.push({
            id: relationshipId,
            source: service.id,
            target: targetService.id,
            type: dependency.type,
            protocol: dependency.protocol,
            direction: 'source-to-target',
            strength: dependency.required ? 1.0 : 0.5,
            confidence: 0.9,
            discoveredAt: new Date()
          });
        }
      }
    }

    // Use AI/heuristics to detect implicit relationships
    const implicitRelationships = await this.detectImplicitRelationships(services);
    newRelationships.push(...implicitRelationships);

    // Store relationships
    for (const relationship of newRelationships) {
      this.relationships.set(relationship.id, relationship);
    }

    this.emit('relationships:analyzed', {
      count: newRelationships.length,
      services: services.length
    });
  }

  /**
   * Detect implicit relationships using AI/heuristics
   */
  private async detectImplicitRelationships(services: DiscoveredService[]): Promise<ServiceRelationship[]> {
    const relationships: ServiceRelationship[] = [];
    
    // Example heuristics (in real implementation, this would use ML models)
    
    // 1. Services with similar names might be related
    for (let i = 0; i < services.length; i++) {
      for (let j = i + 1; j < services.length; j++) {
        const serviceA = services[i];
        const serviceB = services[j];
        
        // Check if they share common words in name
        const wordsA = serviceA.name.toLowerCase().split(/[-_\s]/);
        const wordsB = serviceB.name.toLowerCase().split(/[-_\s]/);
        const commonWords = wordsA.filter(word => wordsB.includes(word));
        
        if (commonWords.length > 0 && commonWords[0].length > 2) {
          relationships.push({
            id: `implicit-${serviceA.id}-${serviceB.id}`,
            source: serviceA.id,
            target: serviceB.id,
            type: 'deployment-dependency',
            direction: 'bidirectional',
            strength: 0.3,
            confidence: 0.6,
            discoveredAt: new Date(),
            metadata: {
              reason: 'similar-naming',
              commonWords
            }
          });
        }
      }
    }

    // 2. Services in same namespace/team likely communicate
    const servicesByNamespace = new Map<string, DiscoveredService[]>();
    services.forEach(service => {
      const namespace = service.namespace || service.metadata.team || 'default';
      if (!servicesByNamespace.has(namespace)) {
        servicesByNamespace.set(namespace, []);
      }
      servicesByNamespace.get(namespace)!.push(service);
    });

    servicesByNamespace.forEach((namespaceServices, namespace) => {
      if (namespaceServices.length > 1) {
        for (let i = 0; i < namespaceServices.length; i++) {
          for (let j = i + 1; j < namespaceServices.length; j++) {
            const serviceA = namespaceServices[i];
            const serviceB = namespaceServices[j];
            
            relationships.push({
              id: `namespace-${serviceA.id}-${serviceB.id}`,
              source: serviceA.id,
              target: serviceB.id,
              type: 'deployment-dependency',
              direction: 'bidirectional',
              strength: 0.4,
              confidence: 0.7,
              discoveredAt: new Date(),
              metadata: {
                reason: 'same-namespace',
                namespace
              }
            });
          }
        }
      }
    });

    return relationships;
  }

  /**
   * Generate documentation for newly discovered services
   */
  private async generateDocumentationForNewServices(): Promise<void> {
    const servicesNeedingDocs = Array.from(this.discoveredServices.values())
      .filter(service => !service.documentation?.generated);

    console.log(`Generating documentation for ${servicesNeedingDocs.length} services...`);

    for (const service of servicesNeedingDocs) {
      try {
        const documentation = await this.generateServiceDocumentation(service);
        service.documentation = documentation;
        this.discoveredServices.set(service.id, service);
      } catch (error) {
        console.error(`Failed to generate documentation for ${service.name}:`, error);
      }
    }

    this.emit('documentation:generated', {
      count: servicesNeedingDocs.length
    });
  }

  /**
   * Generate documentation for a specific service
   */
  async generateServiceDocumentation(service: DiscoveredService): Promise<DiscoveredService['documentation']> {
    const sections = [];

    // Overview section
    sections.push({
      type: 'overview' as const,
      content: this.generateOverviewDocumentation(service),
      confidence: 0.95
    });

    // API documentation if it's an API service
    if (service.type === 'api' || service.endpoints.length > 0) {
      sections.push({
        type: 'api' as const,
        content: await this.generateAPIDocumentation(service),
        confidence: 0.8
      });
    }

    // Dependencies section
    if (service.dependencies.length > 0) {
      sections.push({
        type: 'dependencies' as const,
        content: this.generateDependenciesDocumentation(service),
        confidence: 0.9
      });
    }

    // Deployment section
    sections.push({
      type: 'deployment' as const,
      content: this.generateDeploymentDocumentation(service),
      confidence: 0.85
    });

    // Monitoring section
    sections.push({
      type: 'monitoring' as const,
      content: this.generateMonitoringDocumentation(service),
      confidence: 0.7
    });

    return {
      generated: true,
      lastUpdated: new Date(),
      sections
    };
  }

  /**
   * Generate overview documentation section
   */
  private generateOverviewDocumentation(service: DiscoveredService): string {
    return `# ${service.name}

${service.metadata.tags.join(' • ')}

## Overview
${service.name} is a ${service.type} built with ${service.technology}${service.framework ? ` (${service.framework})` : ''}.

**Technology Stack:**
- Language: ${service.language || 'Unknown'}
- Framework: ${service.framework || 'Unknown'}
- Version: ${service.version || 'Unknown'}

**Team & Ownership:**
- Team: ${service.metadata.team || 'Unknown'}
- Owner: ${service.metadata.owner || 'Unknown'}
${service.metadata.contacts?.length ? `- Contacts: ${service.metadata.contacts.join(', ')}` : ''}

**Source:**
${service.source.repository ? `- Repository: ${service.source.repository}` : ''}
${service.source.path ? `- Path: ${service.source.path}` : ''}
`;
  }

  /**
   * Generate API documentation section
   */
  private async generateAPIDocumentation(service: DiscoveredService): Promise<string> {
    let content = '## API Endpoints\n\n';

    for (const endpoint of service.endpoints) {
      content += `### ${endpoint.protocol.toUpperCase()} ${endpoint.url}\n`;
      content += `- Port: ${endpoint.port}\n`;
      if (endpoint.path) {
        content += `- Path: ${endpoint.path}\n`;
      }
      if (endpoint.healthCheck) {
        content += `- Health Check: ${endpoint.healthCheck}\n`;
      }
      content += `- Internal: ${endpoint.internal ? 'Yes' : 'No'}\n\n`;
    }

    // Try to extract API spec if available
    const apiSpec = this.apiSpecs.get(service.id);
    if (apiSpec) {
      content += '### API Specification\n\n';
      content += `Format: ${apiSpec.format.toUpperCase()}\n`;
      content += `Version: ${apiSpec.version}\n\n`;
      
      if (apiSpec.endpoints.length > 0) {
        content += '#### Endpoints\n\n';
        apiSpec.endpoints.forEach(ep => {
          content += `- **${ep.method.toUpperCase()}** ${ep.path}`;
          if (ep.description) {
            content += ` - ${ep.description}`;
          }
          content += '\n';
        });
      }
    }

    return content;
  }

  /**
   * Generate dependencies documentation section
   */
  private generateDependenciesDocumentation(service: DiscoveredService): string {
    let content = '## Dependencies\n\n';
    
    service.dependencies.forEach(dep => {
      content += `- **${dep.service}** (${dep.type})`;
      if (dep.protocol) {
        content += ` - ${dep.protocol}`;
      }
      content += dep.required ? ' - *Required*' : ' - Optional';
      content += '\n';
    });

    // Add relationships if available
    const relationships = Array.from(this.relationships.values())
      .filter(rel => rel.source === service.id || rel.target === service.id);
    
    if (relationships.length > 0) {
      content += '\n### Service Relationships\n\n';
      relationships.forEach(rel => {
        const otherService = rel.source === service.id ? rel.target : rel.source;
        const otherServiceData = this.discoveredServices.get(otherService);
        const direction = rel.source === service.id ? 'depends on' : 'is used by';
        
        content += `- ${direction} **${otherServiceData?.name || otherService}** (${rel.type})\n`;
      });
    }

    return content;
  }

  /**
   * Generate deployment documentation section
   */
  private generateDeploymentDocumentation(service: DiscoveredService): string {
    let content = '## Deployment\n\n';
    
    content += `**Environment:** ${service.configuration.environment}\n\n`;
    
    if (service.configuration.replicas) {
      content += `**Replicas:** ${service.configuration.replicas}\n\n`;
    }
    
    if (service.configuration.resources) {
      content += '**Resource Requirements:**\n';
      content += `- CPU: ${service.configuration.resources.cpu}\n`;
      content += `- Memory: ${service.configuration.resources.memory}\n\n`;
    }
    
    if (service.configuration.scaling) {
      content += '**Auto-scaling:**\n';
      content += `- Min replicas: ${service.configuration.scaling.min}\n`;
      content += `- Max replicas: ${service.configuration.scaling.max}\n`;
      content += `- Target CPU: ${service.configuration.scaling.targetCPU}%\n\n`;
    }

    return content;
  }

  /**
   * Generate monitoring documentation section
   */
  private generateMonitoringDocumentation(service: DiscoveredService): string {
    let content = '## Monitoring\n\n';
    
    if (service.health.status) {
      content += `**Current Status:** ${service.health.status}\n\n`;
    }
    
    if (service.health.uptime) {
      content += `**Uptime:** ${service.health.uptime}%\n`;
    }
    
    if (service.health.responseTime) {
      content += `**Response Time:** ${service.health.responseTime}ms\n`;
    }
    
    if (service.health.errorRate) {
      content += `**Error Rate:** ${service.health.errorRate}%\n`;
    }
    
    content += '\n### Health Checks\n\n';
    service.endpoints.forEach(endpoint => {
      if (endpoint.healthCheck) {
        content += `- ${endpoint.url}${endpoint.healthCheck}\n`;
      }
    });
    
    if (service.metadata.monitoring) {
      content += `\n### Monitoring Dashboard\n[View Dashboard](${service.metadata.monitoring})\n`;
    }

    return content;
  }

  /**
   * Get all discovered services
   */
  getDiscoveredServices(): DiscoveredService[] {
    return Array.from(this.discoveredServices.values());
  }

  /**
   * Get service relationships
   */
  getServiceRelationships(): ServiceRelationship[] {
    return Array.from(this.relationships.values());
  }

  /**
   * Get discovery sources
   */
  getDiscoverySources(): DiscoverySource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Search services by various criteria
   */
  searchServices(query: {
    name?: string;
    type?: string;
    technology?: string;
    team?: string;
    tags?: string[];
    healthy?: boolean;
  }): DiscoveredService[] {
    let services = Array.from(this.discoveredServices.values());

    if (query.name) {
      services = services.filter(s => 
        s.name.toLowerCase().includes(query.name!.toLowerCase())
      );
    }

    if (query.type) {
      services = services.filter(s => s.type === query.type);
    }

    if (query.technology) {
      services = services.filter(s => 
        s.technology.toLowerCase().includes(query.technology!.toLowerCase())
      );
    }

    if (query.team) {
      services = services.filter(s => s.metadata.team === query.team);
    }

    if (query.tags && query.tags.length > 0) {
      services = services.filter(s => 
        query.tags!.some(tag => s.metadata.tags.includes(tag))
      );
    }

    if (query.healthy !== undefined) {
      services = services.filter(s => 
        query.healthy ? s.health.status === 'healthy' : s.health.status !== 'healthy'
      );
    }

    return services;
  }

  // Private helper methods

  private initializeDefaultSources(): void {
    // Add some default discovery sources
    const defaultSources: Omit<DiscoverySource, 'id' | 'status' | 'discovered'>[] = [
      {
        name: 'GitHub Repositories',
        type: 'git',
        config: {
          endpoint: 'https://api.github.com',
          polling: { enabled: true, interval: 3600 } // 1 hour
        }
      },
      {
        name: 'Kubernetes Cluster',
        type: 'kubernetes',
        config: {
          polling: { enabled: true, interval: 300 } // 5 minutes
        }
      },
      {
        name: 'Docker Containers',
        type: 'docker',
        config: {
          polling: { enabled: true, interval: 600 } // 10 minutes
        }
      }
    ];

    defaultSources.forEach(async (source) => {
      try {
        await this.addSource(source);
      } catch (error) {
        console.warn(`Failed to add default source ${source.name}:`, error);
      }
    });
  }

  private initializeDocumentationTemplates(): void {
    // Initialize default documentation templates
    // Implementation would add various templates for different service types
  }

  private async validateSourceConfig(source: DiscoverySource): Promise<boolean> {
    // Validate source configuration
    // Implementation would check required fields, credentials, etc.
    return true;
  }

  private async testSourceConnection(source: DiscoverySource): Promise<void> {
    try {
      // Test connection to source
      // Implementation would attempt to connect and mark as active/error
      source.status = 'active';
      this.sources.set(source.id, source);
      this.emit('source:connected', source);
    } catch (error) {
      source.status = 'error';
      this.sources.set(source.id, source);
      this.emit('source:error', { source, error });
    }
  }

  private startPeriodicDiscovery(): void {
    // Start periodic discovery every 5 minutes
    this.discoveryInterval = setInterval(async () => {
      if (!this.isDiscovering) {
        try {
          await this.startDiscovery();
        } catch (error) {
          console.error('Periodic discovery failed:', error);
        }
      }
    }, 5 * 60 * 1000);
  }

  private stopPeriodicDiscovery(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopPeriodicDiscovery();
    this.discoveredServices.clear();
    this.relationships.clear();
    this.sources.clear();
    this.removeAllListeners();
  }
}

// Singleton instance
export const intelligentDiscovery = new IntelligentDiscoveryEngine();

// Export types
export type {
  DiscoverySource,
  DiscoveredService,
  ServiceRelationship,
  ExtractedAPISpec,
  DocumentationTemplate
};