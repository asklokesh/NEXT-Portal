import { z } from 'zod';

export interface APITemplateData {
  name?: string;
  title?: string;
  description?: string;
  owner?: string;
  system?: string;
  lifecycle?: string;
  type?: string;
  definition?: string;
  specUrl?: string;
  version?: string;
  tags?: string[];
  [key: string]: any;
}

export interface TransformContext {
  rowIndex: number;
  totalRows?: number;
}

const APITemplateSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  owner: z.string().optional(),
  system: z.string().optional(),
  lifecycle: z.enum(['experimental', 'production', 'deprecated']).optional(),
  type: z.enum(['openapi', 'asyncapi', 'graphql', 'grpc', 'rest']).optional(),
  definition: z.string().optional(),
  specUrl: z.string().optional(),
  version: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

class APITemplate {
  /**
   * Transform raw data into a valid Backstage API entity
   */
  transform(data: APITemplateData, context: TransformContext): any {
    // Normalize and clean the data
    const normalized = this.normalizeData(data);
    
    // Validate the data
    const validation = APITemplateSchema.safeParse(normalized);
    if (!validation.success) {
      throw new Error(`API template validation failed: ${validation.error.message}`);
    }

    const validData = validation.data;

    // Build the Backstage entity
    const entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: {
        name: validData.name,
        title: validData.title || this.generateTitle(validData.name),
        description: validData.description || `API: ${validData.title || validData.name}`,
        tags: this.processTags(validData.tags, validData),
        annotations: this.buildAnnotations(validData),
        labels: this.buildLabels(validData),
      },
      spec: {
        type: validData.type || this.inferType(validData),
        lifecycle: validData.lifecycle || 'production',
        owner: validData.owner || 'platform-team',
        system: validData.system,
        definition: this.buildDefinition(validData),
      },
    };

    // Clean up undefined values
    return this.cleanEntity(entity);
  }

  /**
   * Normalize raw data by mapping common field variations
   */
  private normalizeData(data: APITemplateData): APITemplateData {
    const normalized: APITemplateData = { ...data };

    // Name variations
    normalized.name = normalized.name || 
                     normalized.apiName || 
                     normalized.api_name ||
                     normalized.serviceName ||
                     normalized.service_name;

    // Title variations
    normalized.title = normalized.title || 
                      normalized.displayName || 
                      normalized.display_name ||
                      normalized.apiTitle ||
                      normalized.api_title;

    // Description variations
    normalized.description = normalized.description || 
                           normalized.desc || 
                           normalized.summary;

    // Owner variations
    normalized.owner = normalized.owner || 
                      normalized.team || 
                      normalized.maintainer || 
                      normalized.responsible;

    // System variations
    normalized.system = normalized.system || 
                       normalized.domain || 
                       normalized.product;

    // Type variations
    normalized.type = this.normalizeType(
      normalized.type || 
      normalized.apiType || 
      normalized.api_type ||
      normalized.protocol
    );

    // Lifecycle variations
    normalized.lifecycle = this.normalizeLifecycle(
      normalized.lifecycle || 
      normalized.stage || 
      normalized.phase ||
      normalized.status
    );

    // Definition/Spec variations
    normalized.definition = normalized.definition || 
                          normalized.spec || 
                          normalized.schema ||
                          normalized.swagger ||
                          normalized.openapi;

    normalized.specUrl = normalized.specUrl || 
                        normalized.spec_url ||
                        normalized.definitionUrl ||
                        normalized.definition_url ||
                        normalized.swaggerUrl ||
                        normalized.swagger_url ||
                        normalized.openapiUrl ||
                        normalized.openapi_url;

    // Version variations
    normalized.version = normalized.version || 
                        normalized.ver || 
                        normalized.apiVersion ||
                        normalized.api_version;

    // Tags processing
    if (typeof normalized.tags === 'string') {
      normalized.tags = normalized.tags.split(',').map(tag => tag.trim());
    }

    // Clean the name to match Backstage requirements
    if (normalized.name) {
      normalized.name = this.cleanName(normalized.name);
    }

    return normalized;
  }

  /**
   * Clean and validate entity names for Backstage compatibility
   */
  private cleanName(name: string): string {
    return name.toLowerCase()
               .replace(/[^a-z0-9-_.]/g, '-')
               .replace(/-+/g, '-')
               .replace(/^-|-$/g, '');
  }

  /**
   * Generate a human-friendly title from a name
   */
  private generateTitle(name: string): string {
    return name.split(/[-_]/)
               .map(word => word.charAt(0).toUpperCase() + word.slice(1))
               .join(' ') + ' API';
  }

  /**
   * Infer API type from context
   */
  private inferType(data: APITemplateData): string {
    const name = data.name?.toLowerCase() || '';
    const description = data.description?.toLowerCase() || '';
    const definition = data.definition?.toLowerCase() || '';
    const specUrl = data.specUrl?.toLowerCase() || '';

    // Check for GraphQL indicators
    if (name.includes('graphql') || description.includes('graphql') || 
        definition.includes('graphql') || specUrl.includes('graphql')) {
      return 'graphql';
    }

    // Check for gRPC indicators
    if (name.includes('grpc') || description.includes('grpc') || 
        definition.includes('proto') || specUrl.includes('.proto')) {
      return 'grpc';
    }

    // Check for AsyncAPI indicators
    if (name.includes('async') || description.includes('async') || 
        definition.includes('asyncapi') || specUrl.includes('asyncapi')) {
      return 'asyncapi';
    }

    // Check for OpenAPI/Swagger indicators
    if (definition.includes('openapi') || definition.includes('swagger') ||
        specUrl.includes('swagger') || specUrl.includes('openapi')) {
      return 'openapi';
    }

    // Default to REST/OpenAPI
    return 'openapi';
  }

  /**
   * Normalize API type
   */
  private normalizeType(type?: string): string {
    if (!type) return 'openapi';

    const normalizedType = type.toLowerCase();
    
    if (['openapi', 'swagger', 'oas'].includes(normalizedType)) {
      return 'openapi';
    }
    
    if (['rest', 'restful', 'http'].includes(normalizedType)) {
      return 'openapi'; // REST APIs are typically documented with OpenAPI
    }
    
    if (['graphql', 'gql'].includes(normalizedType)) {
      return 'graphql';
    }
    
    if (['grpc', 'protobuf', 'proto'].includes(normalizedType)) {
      return 'grpc';
    }
    
    if (['asyncapi', 'async', 'event'].includes(normalizedType)) {
      return 'asyncapi';
    }
    
    return 'openapi';
  }

  /**
   * Normalize lifecycle stage
   */
  private normalizeLifecycle(lifecycle?: string): string {
    if (!lifecycle) return 'production';

    const normalizedLifecycle = lifecycle.toLowerCase();
    
    if (['dev', 'development', 'alpha', 'beta', 'experimental', 'preview'].includes(normalizedLifecycle)) {
      return 'experimental';
    }
    
    if (['prod', 'production', 'live', 'stable', 'released'].includes(normalizedLifecycle)) {
      return 'production';
    }
    
    if (['deprecated', 'sunset', 'retired', 'end-of-life'].includes(normalizedLifecycle)) {
      return 'deprecated';
    }
    
    return 'production';
  }

  /**
   * Process and enhance tags
   */
  private processTags(tags?: string[], data?: APITemplateData): string[] {
    const processedTags = new Set<string>();

    // Add provided tags
    if (tags) {
      tags.forEach(tag => {
        if (tag.trim()) {
          processedTags.add(tag.trim().toLowerCase());
        }
      });
    }

    // Add inferred tags based on data
    if (data) {
      if (data.type) {
        processedTags.add(data.type.toLowerCase());
      }

      // Add API-specific tags
      processedTags.add('api');

      // Add type-specific tags
      const typeTags = this.getTypeTags(data.type);
      typeTags.forEach(tag => processedTags.add(tag));

      // Add version-specific tags
      if (data.version) {
        processedTags.add(`v${data.version}`);
      }

      // Add pattern-based tags
      const patternTags = this.getPatternTags(data);
      patternTags.forEach(tag => processedTags.add(tag));
    }

    return Array.from(processedTags);
  }

  /**
   * Get type-specific tags
   */
  private getTypeTags(type?: string): string[] {
    const tags: string[] = [];
    
    if (type) {
      switch (type.toLowerCase()) {
        case 'openapi':
          tags.push('rest', 'http', 'swagger');
          break;
        case 'graphql':
          tags.push('query', 'mutation', 'subscription');
          break;
        case 'grpc':
          tags.push('protobuf', 'binary');
          break;
        case 'asyncapi':
          tags.push('event-driven', 'messaging');
          break;
      }
    }

    return tags;
  }

  /**
   * Get pattern-based tags from API data
   */
  private getPatternTags(data: APITemplateData): string[] {
    const tags: string[] = [];
    
    const name = data.name?.toLowerCase() || '';
    const description = data.description?.toLowerCase() || '';
    
    // Authentication-related
    if (name.includes('auth') || description.includes('auth') || 
        description.includes('login') || description.includes('security')) {
      tags.push('authentication');
    }
    
    // Payment-related
    if (name.includes('payment') || name.includes('billing') || 
        description.includes('payment') || description.includes('transaction')) {
      tags.push('payments');
    }
    
    // User management
    if (name.includes('user') || description.includes('user') || 
        description.includes('profile') || description.includes('account')) {
      tags.push('users');
    }
    
    // Data/Analytics
    if (name.includes('data') || name.includes('analytics') || 
        description.includes('metrics') || description.includes('reporting')) {
      tags.push('data');
    }
    
    // Notification/Communication
    if (name.includes('notification') || name.includes('email') || 
        description.includes('messaging') || description.includes('alert')) {
      tags.push('notifications');
    }

    return tags;
  }

  /**
   * Build annotations for the entity
   */
  private buildAnnotations(data: APITemplateData): Record<string, string> {
    const annotations: Record<string, string> = {};

    if (data.specUrl) {
      annotations['backstage.io/definition-at-location'] = data.specUrl;
    }

    if (data.version) {
      annotations['backstage.io/api-version'] = data.version;
    }

    if (data.type) {
      annotations['backstage.io/api-type'] = data.type;
    }

    return annotations;
  }

  /**
   * Build labels for the entity
   */
  private buildLabels(data: APITemplateData): Record<string, string> {
    const labels: Record<string, string> = {};

    if (data.system) {
      labels['system'] = data.system;
    }

    if (data.owner) {
      labels['owner'] = data.owner;
    }

    if (data.type) {
      labels['api-type'] = data.type;
    }

    if (data.version) {
      labels['version'] = data.version;
    }

    return labels;
  }

  /**
   * Build the API definition
   */
  private buildDefinition(data: APITemplateData): string {
    // If we have a direct definition, use it
    if (data.definition) {
      return data.definition;
    }

    // If we have a spec URL, reference it
    if (data.specUrl) {
      return `$ref: ${data.specUrl}`;
    }

    // Generate a minimal definition based on type
    return this.generateMinimalDefinition(data);
  }

  /**
   * Generate a minimal API definition based on type
   */
  private generateMinimalDefinition(data: APITemplateData): string {
    const type = data.type || 'openapi';
    
    switch (type) {
      case 'openapi':
        return JSON.stringify({
          openapi: '3.0.0',
          info: {
            title: data.title || data.name,
            version: data.version || '1.0.0',
            description: data.description,
          },
          paths: {},
        }, null, 2);
      
      case 'graphql':
        return `
type Query {
  # Add your queries here
}

type Mutation {
  # Add your mutations here
}
        `.trim();
      
      case 'grpc':
        return `
syntax = "proto3";

package ${data.name || 'api'};

service ${this.generateTitle(data.name || 'API').replace(' API', '')}Service {
  // Add your RPC methods here
}
        `.trim();
      
      case 'asyncapi':
        return JSON.stringify({
          asyncapi: '2.6.0',
          info: {
            title: data.title || data.name,
            version: data.version || '1.0.0',
            description: data.description,
          },
          channels: {},
        }, null, 2);
      
      default:
        return '# API definition to be added';
    }
  }

  /**
   * Remove undefined values from the entity
   */
  private cleanEntity(entity: any): any {
    const clean = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.filter(item => item !== undefined).map(clean);
      }
      
      if (obj && typeof obj === 'object') {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (value !== undefined) {
            cleaned[key] = clean(value);
          }
        }
        return cleaned;
      }
      
      return obj;
    };

    return clean(entity);
  }

  /**
   * Generate sample data for template creation
   */
  generateSamples(count: number): APITemplateData[] {
    const samples: APITemplateData[] = [];

    const sampleData = [
      {
        name: 'user-api',
        title: 'User Management API',
        description: 'RESTful API for user management and authentication',
        owner: 'platform-team',
        system: 'authentication',
        lifecycle: 'production',
        type: 'openapi',
        version: 'v1',
        specUrl: 'https://api.example.com/v1/openapi.json',
        tags: ['users', 'auth', 'rest'],
      },
      {
        name: 'order-events-api',
        title: 'Order Events API',
        description: 'Event-driven API for order processing notifications',
        owner: 'commerce-team',
        system: 'ecommerce',
        lifecycle: 'production',
        type: 'asyncapi',
        version: 'v2',
        specUrl: 'https://api.example.com/asyncapi/orders.yaml',
        tags: ['orders', 'events', 'messaging'],
      },
      {
        name: 'product-graphql',
        title: 'Product GraphQL API',
        description: 'GraphQL API for product catalog and inventory',
        owner: 'catalog-team',
        system: 'catalog',
        lifecycle: 'production',
        type: 'graphql',
        version: 'v1',
        specUrl: 'https://api.example.com/graphql/schema.graphql',
        tags: ['products', 'graphql', 'catalog'],
      },
    ];

    for (let i = 0; i < count && i < sampleData.length; i++) {
      samples.push(sampleData[i]);
    }

    // If we need more samples than we have predefined, generate variations
    while (samples.length < count) {
      const base = sampleData[samples.length % sampleData.length];
      const variation = {
        ...base,
        name: `${base.name}-${samples.length + 1}`,
        title: `${base.title} ${samples.length + 1}`,
      };
      samples.push(variation);
    }

    return samples;
  }

  /**
   * Get template schema for validation
   */
  getSchema() {
    return APITemplateSchema;
  }

  /**
   * Get field mappings for import templates
   */
  getFieldMappings(): Record<string, string[]> {
    return {
      name: ['name', 'apiName', 'api_name', 'serviceName', 'service_name'],
      title: ['title', 'displayName', 'display_name', 'apiTitle', 'api_title'],
      description: ['description', 'desc', 'summary'],
      owner: ['owner', 'team', 'maintainer', 'responsible'],
      system: ['system', 'domain', 'product'],
      type: ['type', 'apiType', 'api_type', 'protocol'],
      lifecycle: ['lifecycle', 'stage', 'phase', 'status'],
      definition: ['definition', 'spec', 'schema', 'swagger', 'openapi'],
      specUrl: ['specUrl', 'spec_url', 'definitionUrl', 'definition_url', 'swaggerUrl', 'swagger_url', 'openapiUrl', 'openapi_url'],
      version: ['version', 'ver', 'apiVersion', 'api_version'],
      tags: ['tags', 'labels'],
    };
  }
}

export default new APITemplate();