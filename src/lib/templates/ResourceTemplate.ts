import { z } from 'zod';

export interface ResourceTemplateData {
  name?: string;
  title?: string;
  description?: string;
  owner?: string;
  system?: string;
  type?: string;
  provider?: string;
  connection?: string;
  region?: string;
  environment?: string;
  tags?: string[];
  dependencies?: string[];
  [key: string]: any;
}

export interface TransformContext {
  rowIndex: number;
  totalRows?: number;
}

const ResourceTemplateSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  owner: z.string().optional(),
  system: z.string().optional(),
  type: z.enum(['database', 'storage', 'queue', 'cache', 'cdn', 'load-balancer', 'dns', 'certificate']).optional(),
  provider: z.string().optional(),
  connection: z.string().optional(),
  region: z.string().optional(),
  environment: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
});

class ResourceTemplate {
  /**
   * Transform raw data into a valid Backstage Resource entity
   */
  transform(data: ResourceTemplateData, context: TransformContext): any {
    // Normalize and clean the data
    const normalized = this.normalizeData(data);
    
    // Validate the data
    const validation = ResourceTemplateSchema.safeParse(normalized);
    if (!validation.success) {
      throw new Error(`Resource template validation failed: ${validation.error.message}`);
    }

    const validData = validation.data;

    // Build the Backstage entity
    const entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Resource',
      metadata: {
        name: validData.name,
        title: validData.title || this.generateTitle(validData.name),
        description: validData.description || `Resource: ${validData.title || validData.name}`,
        tags: this.processTags(validData.tags, validData),
        annotations: this.buildAnnotations(validData),
        labels: this.buildLabels(validData),
      },
      spec: {
        type: validData.type || this.inferType(validData),
        owner: validData.owner || 'platform-team',
        system: validData.system,
        dependsOn: this.processDependencies(validData.dependencies),
      },
    };

    // Clean up undefined values
    return this.cleanEntity(entity);
  }

  /**
   * Normalize raw data by mapping common field variations
   */
  private normalizeData(data: ResourceTemplateData): ResourceTemplateData {
    const normalized: ResourceTemplateData = { ...data };

    // Name variations
    normalized.name = normalized.name || 
                     normalized.resourceName || 
                     normalized.resource_name ||
                     normalized.serviceName ||
                     normalized.service_name ||
                     normalized.instanceName ||
                     normalized.instance_name;

    // Title variations
    normalized.title = normalized.title || 
                      normalized.displayName || 
                      normalized.display_name ||
                      normalized.resourceTitle ||
                      normalized.resource_title;

    // Description variations
    normalized.description = normalized.description || 
                           normalized.desc || 
                           normalized.summary ||
                           normalized.purpose;

    // Owner variations
    normalized.owner = normalized.owner || 
                      normalized.team || 
                      normalized.maintainer || 
                      normalized.responsible;

    // System variations
    normalized.system = normalized.system || 
                       normalized.domain || 
                       normalized.product ||
                       normalized.project;

    // Type variations
    normalized.type = this.normalizeType(
      normalized.type || 
      normalized.resourceType || 
      normalized.resource_type ||
      normalized.kind ||
      normalized.category
    );

    // Provider variations
    normalized.provider = normalized.provider || 
                         normalized.cloud || 
                         normalized.platform ||
                         normalized.vendor;

    // Connection variations
    normalized.connection = normalized.connection || 
                          normalized.connectionString || 
                          normalized.connection_string ||
                          normalized.endpoint ||
                          normalized.url ||
                          normalized.host;

    // Region variations
    normalized.region = normalized.region || 
                       normalized.location || 
                       normalized.zone ||
                       normalized.datacenter ||
                       normalized.data_center;

    // Environment variations
    normalized.environment = normalized.environment || 
                           normalized.env || 
                           normalized.stage ||
                           normalized.tier;

    // Tags processing
    if (typeof normalized.tags === 'string') {
      normalized.tags = normalized.tags.split(',').map(tag => tag.trim());
    }

    // Dependencies processing
    if (typeof normalized.dependencies === 'string') {
      normalized.dependencies = normalized.dependencies.split(',').map(dep => dep.trim());
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
               .join(' ');
  }

  /**
   * Infer resource type from context
   */
  private inferType(data: ResourceTemplateData): string {
    const name = data.name?.toLowerCase() || '';
    const description = data.description?.toLowerCase() || '';
    const provider = data.provider?.toLowerCase() || '';

    // Database indicators
    if (name.includes('db') || name.includes('database') || 
        description.includes('database') || description.includes('postgres') ||
        description.includes('mysql') || description.includes('mongo') ||
        provider.includes('rds') || provider.includes('cosmos')) {
      return 'database';
    }

    // Storage indicators
    if (name.includes('storage') || name.includes('bucket') || name.includes('blob') ||
        description.includes('storage') || description.includes('file') ||
        provider.includes('s3') || provider.includes('blob') || provider.includes('gcs')) {
      return 'storage';
    }

    // Queue indicators
    if (name.includes('queue') || name.includes('topic') || name.includes('stream') ||
        description.includes('queue') || description.includes('messaging') ||
        provider.includes('sqs') || provider.includes('servicebus') || provider.includes('pubsub')) {
      return 'queue';
    }

    // Cache indicators
    if (name.includes('cache') || name.includes('redis') || name.includes('memcache') ||
        description.includes('cache') || description.includes('redis') ||
        provider.includes('redis') || provider.includes('elasticache')) {
      return 'cache';
    }

    // CDN indicators
    if (name.includes('cdn') || name.includes('cloudfront') ||
        description.includes('cdn') || description.includes('content delivery') ||
        provider.includes('cloudfront') || provider.includes('fastly')) {
      return 'cdn';
    }

    // Load balancer indicators
    if (name.includes('lb') || name.includes('balancer') || name.includes('elb') ||
        description.includes('load balancer') || description.includes('balancing') ||
        provider.includes('elb') || provider.includes('alb') || provider.includes('nlb')) {
      return 'load-balancer';
    }

    // DNS indicators
    if (name.includes('dns') || name.includes('route53') ||
        description.includes('dns') || description.includes('domain') ||
        provider.includes('route53') || provider.includes('dns')) {
      return 'dns';
    }

    // Certificate indicators
    if (name.includes('cert') || name.includes('ssl') || name.includes('tls') ||
        description.includes('certificate') || description.includes('ssl') ||
        provider.includes('acm') || provider.includes('keyvault')) {
      return 'certificate';
    }

    // Default to database
    return 'database';
  }

  /**
   * Normalize resource type
   */
  private normalizeType(type?: string): string {
    if (!type) return 'database';

    const normalizedType = type.toLowerCase();
    
    // Database variations
    if (['db', 'database', 'sql', 'nosql', 'postgres', 'mysql', 'mongo', 'rds'].includes(normalizedType)) {
      return 'database';
    }
    
    // Storage variations
    if (['storage', 'blob', 'file', 's3', 'bucket', 'disk'].includes(normalizedType)) {
      return 'storage';
    }
    
    // Queue variations
    if (['queue', 'topic', 'stream', 'messaging', 'sqs', 'servicebus', 'pubsub'].includes(normalizedType)) {
      return 'queue';
    }
    
    // Cache variations
    if (['cache', 'redis', 'memcache', 'elasticache'].includes(normalizedType)) {
      return 'cache';
    }
    
    // CDN variations
    if (['cdn', 'cloudfront', 'fastly', 'content-delivery'].includes(normalizedType)) {
      return 'cdn';
    }
    
    // Load balancer variations
    if (['lb', 'load-balancer', 'balancer', 'elb', 'alb', 'nlb'].includes(normalizedType)) {
      return 'load-balancer';
    }
    
    // DNS variations
    if (['dns', 'route53', 'domain'].includes(normalizedType)) {
      return 'dns';
    }
    
    // Certificate variations
    if (['cert', 'certificate', 'ssl', 'tls', 'acm'].includes(normalizedType)) {
      return 'certificate';
    }
    
    return 'database';
  }

  /**
   * Process and enhance tags
   */
  private processTags(tags?: string[], data?: ResourceTemplateData): string[] {
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
      // Add resource tag
      processedTags.add('resource');
      
      if (data.type) {
        processedTags.add(data.type.toLowerCase());
      }

      if (data.provider) {
        processedTags.add(data.provider.toLowerCase());
      }

      if (data.environment) {
        processedTags.add(data.environment.toLowerCase());
      }

      if (data.region) {
        processedTags.add(data.region.toLowerCase());
      }

      // Add provider-specific tags
      const providerTags = this.getProviderTags(data.provider);
      providerTags.forEach(tag => processedTags.add(tag));

      // Add type-specific tags
      const typeTags = this.getTypeTags(data.type);
      typeTags.forEach(tag => processedTags.add(tag));
    }

    return Array.from(processedTags);
  }

  /**
   * Get provider-specific tags
   */
  private getProviderTags(provider?: string): string[] {
    const tags: string[] = [];
    
    if (provider) {
      const p = provider.toLowerCase();
      
      if (['aws', 'amazon'].includes(p)) {
        tags.push('aws', 'cloud');
      } else if (['azure', 'microsoft'].includes(p)) {
        tags.push('azure', 'cloud');
      } else if (['gcp', 'google', 'google-cloud'].includes(p)) {
        tags.push('gcp', 'google-cloud', 'cloud');
      } else if (['kubernetes', 'k8s'].includes(p)) {
        tags.push('kubernetes', 'k8s');
      } else if (['docker'].includes(p)) {
        tags.push('docker', 'container');
      }
    }

    return tags;
  }

  /**
   * Get type-specific tags
   */
  private getTypeTags(type?: string): string[] {
    const tags: string[] = [];
    
    if (type) {
      switch (type.toLowerCase()) {
        case 'database':
          tags.push('data', 'persistence');
          break;
        case 'storage':
          tags.push('files', 'data');
          break;
        case 'queue':
          tags.push('messaging', 'async');
          break;
        case 'cache':
          tags.push('performance', 'memory');
          break;
        case 'cdn':
          tags.push('performance', 'global');
          break;
        case 'load-balancer':
          tags.push('networking', 'traffic');
          break;
        case 'dns':
          tags.push('networking', 'domains');
          break;
        case 'certificate':
          tags.push('security', 'ssl');
          break;
      }
    }

    return tags;
  }

  /**
   * Build annotations for the entity
   */
  private buildAnnotations(data: ResourceTemplateData): Record<string, string> {
    const annotations: Record<string, string> = {};

    if (data.provider) {
      annotations['backstage.io/cloud-provider'] = data.provider;
    }

    if (data.region) {
      annotations['backstage.io/region'] = data.region;
    }

    if (data.environment) {
      annotations['backstage.io/environment'] = data.environment;
    }

    if (data.connection) {
      // Don't expose sensitive connection strings directly
      annotations['backstage.io/connection-info'] = 'Available in configuration';
    }

    return annotations;
  }

  /**
   * Build labels for the entity
   */
  private buildLabels(data: ResourceTemplateData): Record<string, string> {
    const labels: Record<string, string> = {};

    if (data.system) {
      labels['system'] = data.system;
    }

    if (data.owner) {
      labels['owner'] = data.owner;
    }

    if (data.type) {
      labels['resource-type'] = data.type;
    }

    if (data.provider) {
      labels['provider'] = data.provider;
    }

    if (data.environment) {
      labels['environment'] = data.environment;
    }

    if (data.region) {
      labels['region'] = data.region;
    }

    return labels;
  }

  /**
   * Process dependencies into proper entity references
   */
  private processDependencies(dependencies?: string[]): string[] | undefined {
    if (!dependencies || dependencies.length === 0) {
      return undefined;
    }

    return dependencies.map(dep => {
      // If already in proper format (kind:namespace/name), return as is
      if (dep.includes(':') && dep.includes('/')) {
        return dep;
      }

      // If just a name, assume it's a resource in the same namespace
      if (!dep.includes(':') && !dep.includes('/')) {
        return `resource:default/${dep}`;
      }

      // If has namespace but no kind, assume resource
      if (dep.includes('/') && !dep.includes(':')) {
        return `resource:${dep}`;
      }

      return dep;
    });
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
  generateSamples(count: number): ResourceTemplateData[] {
    const samples: ResourceTemplateData[] = [];

    const sampleData = [
      {
        name: 'user-database',
        title: 'User Database',
        description: 'PostgreSQL database for user data storage',
        owner: 'platform-team',
        system: 'authentication',
        type: 'database',
        provider: 'aws',
        region: 'us-east-1',
        environment: 'production',
        tags: ['postgres', 'users', 'critical'],
        dependencies: [],
      },
      {
        name: 'order-queue',
        title: 'Order Processing Queue',
        description: 'SQS queue for asynchronous order processing',
        owner: 'commerce-team',
        system: 'ecommerce',
        type: 'queue',
        provider: 'aws',
        region: 'us-west-2',
        environment: 'production',
        tags: ['sqs', 'orders', 'async'],
        dependencies: [],
      },
      {
        name: 'static-assets-cdn',
        title: 'Static Assets CDN',
        description: 'CloudFront CDN for serving static web assets',
        owner: 'frontend-team',
        system: 'web',
        type: 'cdn',
        provider: 'aws',
        region: 'global',
        environment: 'production',
        tags: ['cloudfront', 'static', 'performance'],
        dependencies: ['assets-bucket'],
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
    return ResourceTemplateSchema;
  }

  /**
   * Get field mappings for import templates
   */
  getFieldMappings(): Record<string, string[]> {
    return {
      name: ['name', 'resourceName', 'resource_name', 'serviceName', 'service_name', 'instanceName', 'instance_name'],
      title: ['title', 'displayName', 'display_name', 'resourceTitle', 'resource_title'],
      description: ['description', 'desc', 'summary', 'purpose'],
      owner: ['owner', 'team', 'maintainer', 'responsible'],
      system: ['system', 'domain', 'product', 'project'],
      type: ['type', 'resourceType', 'resource_type', 'kind', 'category'],
      provider: ['provider', 'cloud', 'platform', 'vendor'],
      connection: ['connection', 'connectionString', 'connection_string', 'endpoint', 'url', 'host'],
      region: ['region', 'location', 'zone', 'datacenter', 'data_center'],
      environment: ['environment', 'env', 'stage', 'tier'],
      tags: ['tags', 'labels'],
      dependencies: ['dependencies', 'dependsOn', 'depends_on'],
    };
  }
}

export default new ResourceTemplate();