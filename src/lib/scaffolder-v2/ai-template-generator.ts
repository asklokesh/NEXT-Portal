import { AITemplateRequest, AITemplateResponse, ScaffolderTemplate, TemplateParameter, TemplateStep } from './types';

export class AITemplateGenerator {
  private static instance: AITemplateGenerator;
  private knowledgeBase: Map<string, any> = new Map();
  private templates: ScaffolderTemplate[] = [];

  private constructor() {
    this.initializeKnowledgeBase();
  }

  static getInstance(): AITemplateGenerator {
    if (!this.instance) {
      this.instance = new AITemplateGenerator();
    }
    return this.instance;
  }

  /**
   * Generate a template from natural language description
   */
  async generateFromNaturalLanguage(request: AITemplateRequest): Promise<AITemplateResponse> {
    const { naturalLanguageDescription, context, preferences } = request;
    
    // AI-powered natural language processing
    const intent = await this.parseIntent(naturalLanguageDescription);
    const technology = await this.detectTechnology(naturalLanguageDescription, context?.technology);
    const architecture = await this.suggestArchitecture(intent, technology, context);
    
    // Generate template structure
    const template = await this.buildTemplate({
      intent,
      technology,
      architecture,
      context,
      preferences
    });

    // Calculate confidence score
    const confidence = this.calculateConfidence(intent, technology, architecture);
    
    // Generate reasoning and suggestions
    const reasoning = this.generateReasoning(template, intent, technology);
    const suggestions = await this.generateSuggestions(template, context);
    
    // Find alternatives
    const alternatives = await this.findAlternativeTemplates(template, 3);

    return {
      template,
      confidence,
      reasoning,
      suggestions,
      alternatives
    };
  }

  /**
   * Parse natural language intent
   */
  private async parseIntent(description: string): Promise<any> {
    // Simulate AI intent parsing
    const keywords = {
      microservice: ['microservice', 'service', 'api', 'endpoint'],
      frontend: ['react', 'vue', 'angular', 'frontend', 'ui', 'dashboard'],
      fullstack: ['fullstack', 'full-stack', 'complete', 'end-to-end'],
      library: ['library', 'package', 'npm', 'utility'],
      deployment: ['deploy', 'kubernetes', 'docker', 'container'],
      cicd: ['pipeline', 'ci/cd', 'automation', 'build'],
      database: ['database', 'postgres', 'mysql', 'mongodb'],
      auth: ['authentication', 'auth', 'login', 'security']
    };

    const descLower = description.toLowerCase();
    const detectedIntents: string[] = [];

    for (const [intent, words] of Object.entries(keywords)) {
      if (words.some(word => descLower.includes(word))) {
        detectedIntents.push(intent);
      }
    }

    return {
      primary: detectedIntents[0] || 'microservice',
      secondary: detectedIntents.slice(1),
      complexity: this.estimateComplexity(description),
      urgency: this.detectUrgency(description)
    };
  }

  /**
   * Detect technology stack from description
   */
  private async detectTechnology(description: string, contextTech?: string[]): Promise<string[]> {
    const techKeywords = {
      'typescript': ['typescript', 'ts'],
      'javascript': ['javascript', 'js', 'node'],
      'react': ['react', 'jsx', 'tsx'],
      'nextjs': ['nextjs', 'next.js', 'next'],
      'express': ['express', 'expressjs'],
      'fastify': ['fastify'],
      'nestjs': ['nestjs', 'nest'],
      'postgresql': ['postgres', 'postgresql', 'pg'],
      'mongodb': ['mongo', 'mongodb'],
      'redis': ['redis'],
      'docker': ['docker', 'container'],
      'kubernetes': ['kubernetes', 'k8s'],
      'aws': ['aws', 'amazon'],
      'gcp': ['gcp', 'google cloud'],
      'azure': ['azure', 'microsoft'],
      'graphql': ['graphql', 'apollo'],
      'rest': ['rest', 'restful', 'api'],
      'websocket': ['websocket', 'ws', 'realtime']
    };

    const descLower = description.toLowerCase();
    const detectedTech = new Set<string>(contextTech || []);

    for (const [tech, keywords] of Object.entries(techKeywords)) {
      if (keywords.some(keyword => descLower.includes(keyword))) {
        detectedTech.add(tech);
      }
    }

    // Add intelligent defaults
    if (!detectedTech.has('typescript') && !detectedTech.has('javascript')) {
      detectedTech.add('typescript');
    }

    return Array.from(detectedTech);
  }

  /**
   * Suggest architecture based on intent and technology
   */
  private async suggestArchitecture(intent: any, technology: string[], context?: any): Promise<any> {
    const architectures = {
      microservice: {
        pattern: 'microservice',
        components: ['api', 'database', 'monitoring', 'logging'],
        deployment: 'containerized'
      },
      frontend: {
        pattern: 'spa',
        components: ['ui', 'routing', 'state-management', 'api-client'],
        deployment: 'static'
      },
      fullstack: {
        pattern: 'layered',
        components: ['frontend', 'api', 'database', 'auth'],
        deployment: 'full-stack'
      },
      library: {
        pattern: 'library',
        components: ['core', 'types', 'tests', 'docs'],
        deployment: 'package'
      }
    };

    return architectures[intent.primary] || architectures.microservice;
  }

  /**
   * Build template from analyzed components
   */
  private async buildTemplate(config: any): Promise<ScaffolderTemplate> {
    const { intent, technology, architecture, context, preferences } = config;
    
    const template: ScaffolderTemplate = {
      id: `ai-generated-${Date.now()}`,
      name: this.generateTemplateName(intent, technology),
      description: this.generateDescription(intent, technology, architecture),
      version: '1.0.0',
      category: this.mapToCategory(intent.primary),
      tags: [...technology, intent.primary, architecture.pattern],
      author: {
        name: 'AI Template Generator',
        email: 'ai@saas-idp.com'
      },
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        downloads: 0,
        rating: 0,
        complexity: intent.complexity,
        estimatedTime: this.estimateTime(intent.complexity, architecture)
      },
      spec: {
        parameters: await this.generateParameters(technology, architecture, context),
        steps: await this.generateSteps(technology, architecture, preferences),
        outputs: this.generateOutputs(architecture)
      },
      ai: {
        generatedFrom: JSON.stringify({ intent, technology, architecture }),
        confidence: 0.85,
        learningData: { context, preferences }
      }
    };

    return template;
  }

  /**
   * Generate smart parameters based on technology and architecture
   */
  private async generateParameters(technology: string[], architecture: any, context?: any): Promise<TemplateParameter[]> {
    const baseParameters: TemplateParameter[] = [
      {
        name: 'name',
        title: 'Project Name',
        description: 'The name of your project',
        type: 'string',
        required: true,
        validation: {
          pattern: '^[a-z][a-z0-9-]*$'
        },
        ui: {
          widget: 'text',
          placeholder: 'my-awesome-project'
        },
        ai: {
          autoFill: true,
          smartValidation: true
        }
      },
      {
        name: 'description',
        title: 'Description',
        description: 'A brief description of your project',
        type: 'string',
        required: true,
        ui: {
          widget: 'textarea',
          placeholder: 'Describe what this project does...'
        }
      }
    ];

    // Technology-specific parameters
    if (technology.includes('typescript')) {
      baseParameters.push({
        name: 'strict',
        title: 'TypeScript Strict Mode',
        description: 'Enable TypeScript strict mode',
        type: 'boolean',
        default: true,
        ui: {
          widget: 'checkbox'
        }
      });
    }

    if (technology.includes('react')) {
      baseParameters.push({
        name: 'uiLibrary',
        title: 'UI Library',
        description: 'Choose your preferred UI library',
        type: 'select',
        enum: ['shadcn/ui', 'material-ui', 'chakra-ui', 'ant-design'],
        default: 'shadcn/ui',
        ai: {
          suggestions: ['shadcn/ui is modern and customizable', 'material-ui for enterprise apps']
        }
      });
    }

    if (technology.includes('docker')) {
      baseParameters.push({
        name: 'containerStrategy',
        title: 'Container Strategy',
        description: 'Choose your containerization approach',
        type: 'select',
        enum: ['single-stage', 'multi-stage', 'distroless'],
        default: 'multi-stage'
      });
    }

    if (architecture.deployment === 'containerized') {
      baseParameters.push({
        name: 'orchestration',
        title: 'Orchestration',
        description: 'Container orchestration platform',
        type: 'select',
        enum: ['kubernetes', 'docker-swarm', 'ecs', 'none'],
        default: 'kubernetes'
      });
    }

    return baseParameters;
  }

  /**
   * Generate workflow steps based on architecture
   */
  private async generateSteps(technology: string[], architecture: any, preferences?: any): Promise<TemplateStep[]> {
    const steps: TemplateStep[] = [];

    // Repository creation step
    steps.push({
      id: 'create-repo',
      name: 'Create Repository',
      action: 'github:repo:create',
      input: {
        repoName: '{{ parameters.name }}',
        description: '{{ parameters.description }}',
        private: true,
        gitignore: this.selectGitignore(technology),
        license: 'MIT'
      }
    });

    // File generation steps
    if (technology.includes('typescript')) {
      steps.push({
        id: 'setup-typescript',
        name: 'Setup TypeScript Configuration',
        action: 'fetch:template',
        input: {
          url: './typescript-config',
          values: {
            strict: '{{ parameters.strict }}',
            target: 'ES2022'
          }
        }
      });
    }

    if (technology.includes('react')) {
      steps.push({
        id: 'setup-react',
        name: 'Setup React Application',
        action: 'fetch:template',
        input: {
          url: './react-app',
          values: {
            uiLibrary: '{{ parameters.uiLibrary }}'
          }
        }
      });
    }

    if (technology.includes('docker')) {
      steps.push({
        id: 'setup-docker',
        name: 'Setup Docker Configuration',
        action: 'fetch:template',
        input: {
          url: './docker-config',
          values: {
            strategy: '{{ parameters.containerStrategy }}',
            nodeVersion: '20-alpine'
          }
        }
      });
    }

    // CI/CD setup
    if (preferences?.cicd !== false) {
      steps.push({
        id: 'setup-cicd',
        name: 'Setup CI/CD Pipeline',
        action: 'fetch:template',
        input: {
          url: './github-actions',
          values: {
            hasDocker: technology.includes('docker'),
            hasTests: true,
            deployTarget: architecture.deployment
          }
        }
      });
    }

    // Monitoring setup
    if (preferences?.monitoring !== false) {
      steps.push({
        id: 'setup-monitoring',
        name: 'Setup Monitoring',
        action: 'fetch:template',
        input: {
          url: './monitoring-config',
          values: {
            includeTracing: true,
            includeMetrics: true,
            includeLogs: true
          }
        }
      });
    }

    // Security setup
    if (preferences?.security !== false) {
      steps.push({
        id: 'setup-security',
        name: 'Setup Security Configuration',
        action: 'fetch:template',
        input: {
          url: './security-config',
          values: {
            includeAuth: architecture.components.includes('auth'),
            includeSecrets: true,
            includeScanning: true
          }
        }
      });
    }

    return steps;
  }

  /**
   * Generate template outputs
   */
  private generateOutputs(architecture: any): any[] {
    return [
      {
        name: 'repositoryUrl',
        description: 'The URL of the created repository',
        type: 'url',
        value: '{{ steps.create-repo.output.remoteUrl }}'
      },
      {
        name: 'projectPath',
        description: 'Local path to the generated project',
        type: 'file',
        value: '{{ parameters.name }}'
      }
    ];
  }

  // Helper methods
  private estimateComplexity(description: string): 'simple' | 'medium' | 'complex' {
    const complexityIndicators = {
      simple: ['simple', 'basic', 'minimal', 'quick'],
      medium: ['moderate', 'standard', 'typical'],
      complex: ['complex', 'advanced', 'enterprise', 'sophisticated', 'comprehensive']
    };

    const descLower = description.toLowerCase();
    
    for (const [level, indicators] of Object.entries(complexityIndicators)) {
      if (indicators.some(indicator => descLower.includes(indicator))) {
        return level as any;
      }
    }

    // Default based on length and technical terms
    const wordCount = description.split(' ').length;
    if (wordCount < 10) return 'simple';
    if (wordCount < 25) return 'medium';
    return 'complex';
  }

  private detectUrgency(description: string): 'low' | 'medium' | 'high' {
    const urgencyWords = {
      high: ['urgent', 'asap', 'immediately', 'critical', 'emergency'],
      medium: ['soon', 'quick', 'fast', 'priority'],
      low: ['eventually', 'when possible', 'flexible']
    };

    const descLower = description.toLowerCase();
    
    for (const [level, words] of Object.entries(urgencyWords)) {
      if (words.some(word => descLower.includes(word))) {
        return level as any;
      }
    }

    return 'medium';
  }

  private generateTemplateName(intent: any, technology: string[]): string {
    const techStack = technology.slice(0, 2).join('-');
    const baseNames = {
      microservice: `${techStack}-microservice`,
      frontend: `${techStack}-app`,
      fullstack: `${techStack}-fullstack`,
      library: `${techStack}-library`
    };
    
    return baseNames[intent.primary] || `${techStack}-service`;
  }

  private generateDescription(intent: any, technology: string[], architecture: any): string {
    const techList = technology.join(', ');
    const patterns = {
      microservice: `A production-ready microservice built with ${techList}`,
      frontend: `A modern frontend application using ${techList}`,
      fullstack: `A complete full-stack application with ${techList}`,
      library: `A reusable library package with ${techList}`
    };

    return patterns[intent.primary] || `A ${architecture.pattern} application with ${techList}`;
  }

  private mapToCategory(intentType: string): string {
    const categoryMap = {
      microservice: 'Backend',
      frontend: 'Frontend',
      fullstack: 'Full Stack',
      library: 'Library',
      deployment: 'Infrastructure',
      cicd: 'DevOps'
    };

    return categoryMap[intentType] || 'General';
  }

  private estimateTime(complexity: string, architecture: any): string {
    const timeMap = {
      simple: '5-15 minutes',
      medium: '15-30 minutes',
      complex: '30-60 minutes'
    };

    return timeMap[complexity] || '15-30 minutes';
  }

  private selectGitignore(technology: string[]): string {
    if (technology.includes('node') || technology.includes('typescript') || technology.includes('javascript')) {
      return 'Node';
    }
    if (technology.includes('python')) {
      return 'Python';
    }
    if (technology.includes('java')) {
      return 'Java';
    }
    return 'Node';
  }

  private calculateConfidence(intent: any, technology: string[], architecture: any): number {
    let confidence = 0.5;
    
    // Boost confidence for clear intents
    if (intent.primary && intent.primary !== 'unknown') confidence += 0.2;
    
    // Boost confidence for detected technologies
    if (technology.length > 0) confidence += 0.15;
    
    // Boost confidence for complete architecture
    if (architecture && architecture.components) confidence += 0.15;

    return Math.min(confidence, 1.0);
  }

  private generateReasoning(template: ScaffolderTemplate, intent: any, technology: string[]): string {
    return `Generated a ${template.category.toLowerCase()} template based on detected intent: ${intent.primary}. ` +
           `Selected technologies: ${technology.join(', ')}. ` +
           `This template includes ${template.spec.steps.length} automated steps for rapid deployment.`;
  }

  private async generateSuggestions(template: ScaffolderTemplate, context?: any): Promise<string[]> {
    const suggestions = [
      'Consider adding database migrations if you plan to use a database',
      'Add environment-specific configuration for different deployment stages',
      'Include security scanning in your CI/CD pipeline',
      'Set up monitoring and alerting for production readiness'
    ];

    // Context-based suggestions
    if (context?.teamSize && context.teamSize > 5) {
      suggestions.push('Consider adding code review workflows for larger teams');
    }

    if (context?.compliance?.length > 0) {
      suggestions.push('Add compliance scanning and audit logging');
    }

    return suggestions;
  }

  private async findAlternativeTemplates(template: ScaffolderTemplate, count: number): Promise<ScaffolderTemplate[]> {
    // Simulate finding alternative templates
    const alternatives: ScaffolderTemplate[] = [];
    
    for (let i = 0; i < Math.min(count, 3); i++) {
      const alternative = {
        ...template,
        id: `${template.id}-alt-${i + 1}`,
        name: `${template.name} (Alternative ${i + 1})`,
        description: `Alternative approach: ${template.description}`,
        tags: [...template.tags, 'alternative']
      };
      
      alternatives.push(alternative);
    }

    return alternatives;
  }

  private initializeKnowledgeBase(): void {
    // Initialize with common patterns and best practices
    this.knowledgeBase.set('react-patterns', {
      hooks: ['useState', 'useEffect', 'useContext', 'useReducer'],
      patterns: ['component-composition', 'render-props', 'higher-order-components']
    });

    this.knowledgeBase.set('microservice-patterns', {
      patterns: ['api-gateway', 'service-discovery', 'circuit-breaker', 'bulkhead'],
      monitoring: ['health-checks', 'metrics', 'distributed-tracing']
    });

    this.knowledgeBase.set('deployment-patterns', {
      strategies: ['blue-green', 'canary', 'rolling', 'recreate'],
      platforms: ['kubernetes', 'docker-swarm', 'ecs', 'cloud-run']
    });
  }

  /**
   * Learn from template usage and feedback
   */
  async learnFromUsage(templateId: string, feedback: any): Promise<void> {
    // Update knowledge base with usage patterns and feedback
    const learningKey = `usage-${templateId}`;
    const currentData = this.knowledgeBase.get(learningKey) || { usageCount: 0, feedback: [] };
    
    currentData.usageCount++;
    currentData.feedback.push({
      timestamp: new Date().toISOString(),
      ...feedback
    });

    this.knowledgeBase.set(learningKey, currentData);
  }

  /**
   * Export knowledge base for backup/sharing
   */
  exportKnowledgeBase(): Record<string, any> {
    const exported: Record<string, any> = {};
    
    this.knowledgeBase.forEach((value, key) => {
      exported[key] = value;
    });

    return exported;
  }

  /**
   * Import knowledge base from backup/sharing
   */
  importKnowledgeBase(data: Record<string, any>): void {
    for (const [key, value] of Object.entries(data)) {
      this.knowledgeBase.set(key, value);
    }
  }
}