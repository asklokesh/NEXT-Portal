import { z } from 'zod';

export interface ComponentTemplateData {
  name?: string;
  title?: string;
  description?: string;
  owner?: string;
  system?: string;
  lifecycle?: string;
  type?: string;
  language?: string;
  framework?: string;
  repository?: string;
  documentation?: string;
  tags?: string[];
  dependencies?: string[];
  consumesApis?: string[];
  providesApis?: string[];
  [key: string]: any;
}

export interface TransformContext {
  rowIndex: number;
  totalRows?: number;
}

const ComponentTemplateSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  owner: z.string().optional(),
  system: z.string().optional(),
  lifecycle: z.enum(['experimental', 'production', 'deprecated']).optional(),
  type: z.enum(['service', 'website', 'library']).optional(),
  language: z.string().optional(),
  framework: z.string().optional(),
  repository: z.string().optional(),
  documentation: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  consumesApis: z.array(z.string()).optional(),
  providesApis: z.array(z.string()).optional(),
});

class ComponentTemplate {
  /**
   * Transform raw data into a valid Backstage Component entity
   */
  transform(data: ComponentTemplateData, context: TransformContext): any {
    // Normalize and clean the data
    const normalized = this.normalizeData(data);
    
    // Validate the data
    const validation = ComponentTemplateSchema.safeParse(normalized);
    if (!validation.success) {
      throw new Error(`Component template validation failed: ${validation.error.message}`);
    }

    const validData = validation.data;

    // Build the Backstage entity
    const entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: validData.name,
        title: validData.title || this.generateTitle(validData.name),
        description: validData.description || `Component: ${validData.title || validData.name}`,
        tags: this.processTags(validData.tags, validData),
        annotations: this.buildAnnotations(validData),
        labels: this.buildLabels(validData),
      },
      spec: {
        type: validData.type || this.inferType(validData),
        lifecycle: validData.lifecycle || 'production',
        owner: validData.owner || 'platform-team',
        system: validData.system,
        dependsOn: this.processDependencies(validData.dependencies),
        consumesApis: this.processApiReferences(validData.consumesApis),
        providesApis: this.processApiReferences(validData.providesApis),
      },
    };

    // Clean up undefined values
    return this.cleanEntity(entity);
  }

  /**
   * Normalize raw data by mapping common field variations
   */
  private normalizeData(data: ComponentTemplateData): ComponentTemplateData {
    const normalized: ComponentTemplateData = { ...data };

    // Name variations
    normalized.name = normalized.name || 
                     normalized.componentName || 
                     normalized.component_name ||
                     normalized.moduleName ||
                     normalized.module_name ||
                     normalized.packageName ||
                     normalized.package_name;

    // Title variations
    normalized.title = normalized.title || 
                      normalized.displayName || 
                      normalized.display_name ||
                      normalized.componentName ||
                      normalized.component_name;

    // Description variations
    normalized.description = normalized.description || 
                           normalized.desc || 
                           normalized.summary ||
                           normalized.purpose;

    // Owner variations
    normalized.owner = normalized.owner || 
                      normalized.team || 
                      normalized.maintainer || 
                      normalized.responsible ||
                      normalized.author;

    // System variations
    normalized.system = normalized.system || 
                       normalized.domain || 
                       normalized.product ||
                       normalized.project;

    // Type variations
    normalized.type = this.normalizeType(
      normalized.type || 
      normalized.componentType || 
      normalized.component_type
    );

    // Lifecycle variations
    normalized.lifecycle = this.normalizeLifecycle(
      normalized.lifecycle || 
      normalized.stage || 
      normalized.phase ||
      normalized.status ||
      normalized.maturity
    );

    // Repository variations
    normalized.repository = normalized.repository || 
                          normalized.repo || 
                          normalized.gitUrl || 
                          normalized.git_url ||
                          normalized.sourceUrl ||
                          normalized.source_url ||
                          normalized.codeUrl ||
                          normalized.code_url;

    // Language variations
    normalized.language = normalized.language || 
                         normalized.lang || 
                         normalized.programmingLanguage ||
                         normalized.programming_language ||
                         normalized.tech;

    // Framework variations
    normalized.framework = normalized.framework || 
                          normalized.stack || 
                          normalized.technology ||
                          normalized.platform;

    // Documentation variations
    normalized.documentation = normalized.documentation || 
                             normalized.docs || 
                             normalized.docsUrl || 
                             normalized.docs_url ||
                             normalized.readme;

    // Tags processing
    if (typeof normalized.tags === 'string') {
      normalized.tags = normalized.tags.split(',').map(tag => tag.trim());
    }

    // Dependencies processing
    if (typeof normalized.dependencies === 'string') {
      normalized.dependencies = normalized.dependencies.split(',').map(dep => dep.trim());
    }

    // APIs processing
    if (typeof normalized.consumesApis === 'string') {
      normalized.consumesApis = normalized.consumesApis.split(',').map(api => api.trim());
    }
    if (typeof normalized.providesApis === 'string') {
      normalized.providesApis = normalized.providesApis.split(',').map(api => api.trim());
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
   * Infer component type from context
   */
  private inferType(data: ComponentTemplateData): string {
    // Check for web/frontend indicators
    const frontendIndicators = ['react', 'vue', 'angular', 'frontend', 'ui', 'web', 'dashboard'];
    if (data.framework && frontendIndicators.some(indicator => 
      data.framework!.toLowerCase().includes(indicator)
    )) {
      return 'website';
    }

    // Check for library indicators
    const libraryIndicators = ['lib', 'library', 'package', 'module', 'sdk', 'client'];
    if (data.name && libraryIndicators.some(indicator => 
      data.name!.toLowerCase().includes(indicator)
    )) {
      return 'library';
    }

    if (data.type && libraryIndicators.some(indicator => 
      data.type.toLowerCase().includes(indicator)
    )) {
      return 'library';
    }

    // Default to service
    return 'service';
  }

  /**
   * Normalize component type
   */
  private normalizeType(type?: string): string {
    if (!type) return 'service';

    const normalizedType = type.toLowerCase();
    
    if (['web', 'website', 'frontend', 'ui', 'spa', 'dashboard'].includes(normalizedType)) {
      return 'website';
    }
    
    if (['lib', 'library', 'package', 'module', 'sdk', 'client'].includes(normalizedType)) {
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
    
    if (['dev', 'development', 'alpha', 'beta', 'experimental', 'preview', 'draft'].includes(normalizedLifecycle)) {
      return 'experimental';
    }
    
    if (['prod', 'production', 'live', 'stable', 'released', 'ga'].includes(normalizedLifecycle)) {
      return 'production';
    }
    
    if (['deprecated', 'sunset', 'retired', 'end-of-life', 'eol'].includes(normalizedLifecycle)) {
      return 'deprecated';
    }
    
    return 'production';
  }

  /**
   * Process and enhance tags
   */
  private processTags(tags?: string[], data?: ComponentTemplateData): string[] {
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
      if (data.language || data.framework) {
        const techTags = this.getTechnologyTags(data.language, data.framework);
        techTags.forEach(tag => processedTags.add(tag));
      }

      // Add component-specific tags
      const componentTags = this.getComponentTags(data);
      componentTags.forEach(tag => processedTags.add(tag));
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
          tags.push('javascript');
          break;
        case 'typescript':
        case 'ts':
          tags.push('typescript');
          break;
        case 'python':
          tags.push('python');
          break;
        case 'java':
          tags.push('java', 'jvm');
          break;
        case 'kotlin':
          tags.push('kotlin', 'jvm');
          break;
        case 'scala':
          tags.push('scala', 'jvm');
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
        case 'swift':
          tags.push('swift', 'ios');
          break;
        case 'dart':
          tags.push('dart', 'flutter');
          break;
      }
    }

    if (framework) {
      const fw = framework.toLowerCase();
      
      // Frontend frameworks
      if (['react', 'reactjs'].includes(fw)) {
        tags.push('react', 'frontend');
      } else if (['vue', 'vuejs'].includes(fw)) {
        tags.push('vue', 'frontend');
      } else if (['angular', 'angularjs'].includes(fw)) {
        tags.push('angular', 'frontend');
      } else if (['svelte', 'sveltekit'].includes(fw)) {
        tags.push('svelte', 'frontend');
      }
      
      // Backend frameworks
      else if (['express', 'expressjs'].includes(fw)) {
        tags.push('express', 'nodejs');
      } else if (['fastify'].includes(fw)) {
        tags.push('fastify', 'nodejs');
      } else if (['nest', 'nestjs'].includes(fw)) {
        tags.push('nestjs', 'nodejs');
      } else if (['spring', 'spring-boot'].includes(fw)) {
        tags.push('spring', 'java');
      } else if (['django'].includes(fw)) {
        tags.push('django', 'python');
      } else if (['flask'].includes(fw)) {
        tags.push('flask', 'python');
      } else if (['gin'].includes(fw)) {
        tags.push('gin', 'go');
      }
      
      // Mobile frameworks
      else if (['flutter'].includes(fw)) {
        tags.push('flutter', 'mobile');
      } else if (['react-native'].includes(fw)) {
        tags.push('react-native', 'mobile');
      }
    }

    return tags;
  }

  /**
   * Get component-specific tags based on patterns
   */
  private getComponentTags(data: ComponentTemplateData): string[] {
    const tags: string[] = [];
    
    const name = data.name?.toLowerCase() || '';
    const description = data.description?.toLowerCase() || '';
    
    // API-related tags
    if (name.includes('api') || description.includes('api')) {
      tags.push('api');
    }
    
    // Database-related tags
    if (name.includes('db') || name.includes('database') || 
        description.includes('database') || description.includes('storage')) {
      tags.push('database');
    }
    
    // Authentication-related tags
    if (name.includes('auth') || description.includes('auth') || 
        description.includes('login') || description.includes('security')) {
      tags.push('authentication');
    }
    
    // Monitoring-related tags
    if (name.includes('monitor') || name.includes('metric') || 
        description.includes('monitoring') || description.includes('observability')) {
      tags.push('monitoring');
    }
    
    // UI/Frontend-related tags
    if (name.includes('ui') || name.includes('frontend') || name.includes('web') ||
        description.includes('interface') || description.includes('dashboard')) {
      tags.push('frontend');
    }
    
    // Library/SDK tags
    if (name.includes('lib') || name.includes('sdk') || name.includes('client') ||
        description.includes('library') || description.includes('package')) {
      tags.push('library');
    }

    return tags;
  }

  /**
   * Build annotations for the entity
   */
  private buildAnnotations(data: ComponentTemplateData): Record<string, string> {
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
  private buildLabels(data: ComponentTemplateData): Record<string, string> {
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
   * Process API references into proper entity references
   */
  private processApiReferences(apis?: string[]): string[] | undefined {
    if (!apis || apis.length === 0) {
      return undefined;
    }

    return apis.map(api => {
      // If already in proper format (kind:namespace/name), return as is
      if (api.includes(':') && api.includes('/')) {
        return api;
      }

      // If just a name, assume it's an API in the same namespace
      if (!api.includes(':') && !api.includes('/')) {
        return `api:default/${api}`;
      }

      // If has namespace but no kind, assume API
      if (api.includes('/') && !api.includes(':')) {
        return `api:${api}`;
      }

      return api;
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
  generateSamples(count: number): ComponentTemplateData[] {
    const samples: ComponentTemplateData[] = [];

    const sampleData = [
      {
        name: 'user-auth-lib',
        title: 'User Authentication Library',
        description: 'Shared library for user authentication and session management',
        owner: 'platform-team',
        system: 'authentication',
        lifecycle: 'production',
        type: 'library',
        language: 'TypeScript',
        framework: 'Node.js',
        repository: 'https://github.com/company/user-auth-lib',
        documentation: 'https://docs.company.com/user-auth-lib',
        tags: ['auth', 'library', 'shared'],
        dependencies: ['jwt-library'],
        providesApis: ['auth-api'],
      },
      {
        name: 'shopping-cart-ui',
        title: 'Shopping Cart Component',
        description: 'React component for shopping cart functionality',
        owner: 'frontend-team',
        system: 'ecommerce',
        lifecycle: 'production',
        type: 'website',
        language: 'JavaScript',
        framework: 'React',
        repository: 'https://github.com/company/shopping-cart-ui',
        documentation: 'https://storybook.company.com/shopping-cart',
        tags: ['react', 'ecommerce', 'frontend'],
        consumesApis: ['cart-api', 'product-api'],
      },
      {
        name: 'payment-processor',
        title: 'Payment Processing Service',
        description: 'Microservice for handling payment transactions',
        owner: 'payments-team',
        system: 'payments',
        lifecycle: 'production',
        type: 'service',
        language: 'Java',
        framework: 'Spring Boot',
        repository: 'https://github.com/company/payment-processor',
        tags: ['payments', 'microservice', 'java'],
        dependencies: ['database-postgres'],
        consumesApis: ['bank-api', 'fraud-detection-api'],
        providesApis: ['payment-api'],
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
    return ComponentTemplateSchema;
  }

  /**
   * Get field mappings for import templates
   */
  getFieldMappings(): Record<string, string[]> {
    return {
      name: ['name', 'componentName', 'component_name', 'moduleName', 'module_name', 'packageName', 'package_name'],
      title: ['title', 'displayName', 'display_name', 'componentName', 'component_name'],
      description: ['description', 'desc', 'summary', 'purpose'],
      owner: ['owner', 'team', 'maintainer', 'responsible', 'author'],
      system: ['system', 'domain', 'product', 'project'],
      type: ['type', 'componentType', 'component_type'],
      lifecycle: ['lifecycle', 'stage', 'phase', 'status', 'maturity'],
      language: ['language', 'lang', 'programmingLanguage', 'programming_language', 'tech'],
      framework: ['framework', 'stack', 'technology', 'platform'],
      repository: ['repository', 'repo', 'gitUrl', 'git_url', 'sourceUrl', 'source_url', 'codeUrl', 'code_url'],
      documentation: ['documentation', 'docs', 'docsUrl', 'docs_url', 'readme'],
      tags: ['tags', 'labels'],
      dependencies: ['dependencies', 'dependsOn', 'depends_on'],
      consumesApis: ['consumesApis', 'consumes_apis', 'usesApis', 'uses_apis'],
      providesApis: ['providesApis', 'provides_apis', 'exposesApis', 'exposes_apis'],
    };
  }
}

export default new ComponentTemplate();