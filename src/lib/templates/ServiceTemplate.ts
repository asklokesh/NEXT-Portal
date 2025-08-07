import { z } from 'zod';

export interface ServiceTemplateData {
  name?: string;
  title?: string;
  description?: string;
  owner?: string;
  system?: string;
  lifecycle?: string;
  type?: string;
  url?: string;
  port?: number;
  tags?: string[];
  language?: string;
  framework?: string;
  repository?: string;
  documentation?: string;
  api?: string;
  dependencies?: string[];
  [key: string]: any;
}

export interface TransformContext {
  rowIndex: number;
  totalRows?: number;
}

const ServiceTemplateSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  owner: z.string().optional(),
  system: z.string().optional(),
  lifecycle: z.enum(['experimental', 'production', 'deprecated']).optional(),
  type: z.enum(['service', 'website', 'library']).optional(),
  url: z.string().url().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  tags: z.array(z.string()).optional(),
  language: z.string().optional(),
  framework: z.string().optional(),
  repository: z.string().optional(),
  documentation: z.string().optional(),
  api: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
});

class ServiceTemplate {
  /**
   * Transform raw data into a valid Backstage Service entity
   */
  transform(data: ServiceTemplateData, context: TransformContext): any {
    // Normalize and clean the data
    const normalized = this.normalizeData(data);
    
    // Validate the data
    const validation = ServiceTemplateSchema.safeParse(normalized);
    if (!validation.success) {
      throw new Error(`Service template validation failed: ${validation.error.message}`);
    }

    const validData = validation.data;

    // Build the Backstage entity
    const entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: validData.name,
        title: validData.title || this.generateTitle(validData.name),
        description: validData.description || `Service: ${validData.title || validData.name}`,
        tags: this.processTags(validData.tags, validData),
        annotations: this.buildAnnotations(validData),
        labels: this.buildLabels(validData),
      },
      spec: {
        type: validData.type || 'service',
        lifecycle: validData.lifecycle || 'production',
        owner: validData.owner || 'platform-team',
        system: validData.system,
        providesApis: validData.api ? [validData.api] : undefined,
        dependsOn: this.processDependencies(validData.dependencies),
      },
    };

    // Clean up undefined values
    return this.cleanEntity(entity);
  }

  /**
   * Normalize raw data by mapping common field variations
   */
  private normalizeData(data: ServiceTemplateData): ServiceTemplateData {
    const normalized: ServiceTemplateData = { ...data };

    // Name variations
    normalized.name = normalized.name || 
                     normalized.serviceName || 
                     normalized.service_name ||
                     normalized.componentName ||
                     normalized.component_name;

    // Title variations
    normalized.title = normalized.title || 
                      normalized.displayName || 
                      normalized.display_name ||
                      normalized.serviceName ||
                      normalized.service_name;

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
      normalized.serviceType || 
      normalized.service_type ||
      normalized.componentType ||
      normalized.component_type
    );

    // Lifecycle variations
    normalized.lifecycle = this.normalizeLifecycle(
      normalized.lifecycle || 
      normalized.stage || 
      normalized.phase ||
      normalized.status
    );

    // URL variations
    normalized.url = normalized.url || 
                    normalized.endpoint || 
                    normalized.baseUrl || 
                    normalized.base_url ||
                    normalized.serviceUrl ||
                    normalized.service_url;

    // Port variations
    if (normalized.port) {
      normalized.port = typeof normalized.port === 'string' 
        ? parseInt(normalized.port, 10) 
        : normalized.port;
    }

    // Repository variations
    normalized.repository = normalized.repository || 
                          normalized.repo || 
                          normalized.gitUrl || 
                          normalized.git_url ||
                          normalized.sourceUrl ||
                          normalized.source_url;

    // Language variations
    normalized.language = normalized.language || 
                         normalized.lang || 
                         normalized.programmingLanguage ||
                         normalized.programming_language;

    // Framework variations
    normalized.framework = normalized.framework || 
                          normalized.stack || 
                          normalized.technology;

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
   * Normalize service type
   */
  private normalizeType(type?: string): string {
    if (!type) return 'service';

    const normalizedType = type.toLowerCase();
    
    if (['web', 'website', 'frontend', 'ui'].includes(normalizedType)) {
      return 'website';
    }
    
    if (['lib', 'library', 'package', 'module'].includes(normalizedType)) {
      return 'library';
    }
    
    return 'service';
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
  private processTags(tags?: string[], data?: ServiceTemplateData): string[] {
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
      if (data.language) {
        processedTags.add(data.language.toLowerCase());
      }
      
      if (data.framework) {
        processedTags.add(data.framework.toLowerCase());
      }
      
      if (data.type) {
        processedTags.add(data.type.toLowerCase());
      }

      // Add technology-specific tags
      if (data.language) {
        const techTags = this.getTechnologyTags(data.language, data.framework);
        techTags.forEach(tag => processedTags.add(tag));
      }
    }

    return Array.from(processedTags);
  }

  /**
   * Get technology-specific tags
   */
  private getTechnologyTags(language?: string, framework?: string): string[] {
    const tags: string[] = [];
    
    if (language) {
      const lang = language.toLowerCase();
      
      switch (lang) {
        case 'javascript':
        case 'js':
          tags.push('nodejs', 'javascript');
          break;
        case 'typescript':
        case 'ts':
          tags.push('nodejs', 'typescript');
          break;
        case 'python':
          tags.push('python');
          break;
        case 'java':
          tags.push('java', 'jvm');
          break;
        case 'go':
        case 'golang':
          tags.push('go');
          break;
        case 'rust':
          tags.push('rust');
          break;
        case 'c#':
        case 'csharp':
          tags.push('dotnet', 'csharp');
          break;
      }
    }

    if (framework) {
      const fw = framework.toLowerCase();
      
      switch (fw) {
        case 'express':
          tags.push('express', 'nodejs');
          break;
        case 'fastify':
          tags.push('fastify', 'nodejs');
          break;
        case 'nest':
        case 'nestjs':
          tags.push('nestjs', 'nodejs');
          break;
        case 'spring':
        case 'spring-boot':
          tags.push('spring', 'java');
          break;
        case 'django':
          tags.push('django', 'python');
          break;
        case 'flask':
          tags.push('flask', 'python');
          break;
        case 'gin':
          tags.push('gin', 'go');
          break;
      }
    }

    return tags;
  }

  /**
   * Build annotations for the entity
   */
  private buildAnnotations(data: ServiceTemplateData): Record<string, string> {
    const annotations: Record<string, string> = {};

    if (data.repository) {
      annotations['backstage.io/source-location'] = this.normalizeRepositoryUrl(data.repository);
    }

    if (data.documentation) {
      annotations['backstage.io/docs-location'] = data.documentation;
    }

    if (data.language) {
      annotations['backstage.io/language'] = data.language;
    }

    if (data.framework) {
      annotations['backstage.io/framework'] = data.framework;
    }

    if (data.url) {
      annotations['backstage.io/service-url'] = data.url;
    }

    return annotations;
  }

  /**
   * Normalize repository URL to a standard format
   */
  private normalizeRepositoryUrl(url: string): string {
    // Handle common GitHub URL variations
    if (url.includes('github.com')) {
      // Convert SSH to HTTPS
      if (url.startsWith('git@github.com:')) {
        return url.replace('git@github.com:', 'https://github.com/');
      }
      
      // Ensure it ends with .git for consistency
      if (!url.endsWith('.git')) {
        return `${url}.git`;
      }
    }

    return url;
  }

  /**
   * Build labels for the entity
   */
  private buildLabels(data: ServiceTemplateData): Record<string, string> {
    const labels: Record<string, string> = {};

    if (data.system) {
      labels['system'] = data.system;
    }

    if (data.owner) {
      labels['owner'] = data.owner;
    }

    if (data.language) {
      labels['language'] = data.language.toLowerCase();
    }

    if (data.type) {
      labels['type'] = data.type;
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

      // If just a name, assume it's a component in the same namespace
      if (!dep.includes(':') && !dep.includes('/')) {
        return `component:default/${dep}`;
      }

      // If has namespace but no kind, assume component
      if (dep.includes('/') && !dep.includes(':')) {
        return `component:${dep}`;
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
  generateSamples(count: number): ServiceTemplateData[] {
    const samples: ServiceTemplateData[] = [];

    const sampleData = [
      {
        name: 'user-service',
        title: 'User Management Service',
        description: 'RESTful service for user authentication and management',
        owner: 'platform-team',
        system: 'authentication',
        lifecycle: 'production',
        type: 'service',
        language: 'TypeScript',
        framework: 'NestJS',
        repository: 'https://github.com/company/user-service',
        url: 'https://api.example.com/users',
        port: 3000,
        tags: ['auth', 'users', 'rest-api'],
        api: 'user-api',
        dependencies: ['database-postgres', 'redis-cache'],
      },
      {
        name: 'order-processor',
        title: 'Order Processing Service',
        description: 'Handles order processing and fulfillment workflows',
        owner: 'commerce-team',
        system: 'ecommerce',
        lifecycle: 'production',
        type: 'service',
        language: 'Java',
        framework: 'Spring Boot',
        repository: 'https://github.com/company/order-processor',
        url: 'https://api.example.com/orders',
        port: 8080,
        tags: ['orders', 'commerce', 'processing'],
        dependencies: ['payment-service', 'inventory-service'],
      },
      {
        name: 'analytics-dashboard',
        title: 'Analytics Dashboard',
        description: 'Frontend dashboard for business analytics and reporting',
        owner: 'data-team',
        system: 'analytics',
        lifecycle: 'production',
        type: 'website',
        language: 'JavaScript',
        framework: 'React',
        repository: 'https://github.com/company/analytics-dashboard',
        url: 'https://analytics.example.com',
        tags: ['dashboard', 'analytics', 'frontend'],
        dependencies: ['analytics-api'],
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
    return ServiceTemplateSchema;
  }

  /**
   * Get field mappings for import templates
   */
  getFieldMappings(): Record<string, string[]> {
    return {
      name: ['name', 'serviceName', 'service_name', 'componentName', 'component_name'],
      title: ['title', 'displayName', 'display_name', 'serviceName', 'service_name'],
      description: ['description', 'desc', 'summary'],
      owner: ['owner', 'team', 'maintainer', 'responsible'],
      system: ['system', 'domain', 'product'],
      type: ['type', 'serviceType', 'service_type', 'componentType', 'component_type'],
      lifecycle: ['lifecycle', 'stage', 'phase', 'status'],
      url: ['url', 'endpoint', 'baseUrl', 'base_url', 'serviceUrl', 'service_url'],
      port: ['port'],
      language: ['language', 'lang', 'programmingLanguage', 'programming_language'],
      framework: ['framework', 'stack', 'technology'],
      repository: ['repository', 'repo', 'gitUrl', 'git_url', 'sourceUrl', 'source_url'],
      documentation: ['documentation', 'docs', 'docsUrl', 'docs_url'],
      api: ['api', 'apiRef', 'api_ref'],
      tags: ['tags', 'labels'],
      dependencies: ['dependencies', 'dependsOn', 'depends_on'],
    };
  }
}

export default new ServiceTemplate();