import { Logger } from '@/lib/logger';
import { NotificationMessage, NotificationType } from './notification-engine';
import { NotificationChannel } from './communications-config';

export interface Template {
  id: string;
  name: string;
  description: string;
  type: NotificationType;
  channels: NotificationChannel[];
  subject: string;
  content: string;
  htmlContent?: string;
  variables: TemplateVariable[];
  metadata: TemplateMetadata;
  version: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  required: boolean;
  defaultValue?: any;
  description: string;
  validation?: VariableValidation;
}

export interface VariableValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  enum?: string[];
}

export interface TemplateMetadata {
  category: string;
  tags: string[];
  locale: string;
  timezone?: string;
  priority: number;
  estimatedSize: number;
}

export interface TemplateContext {
  user: UserContext;
  message: MessageContext;
  system: SystemContext;
  custom: Record<string, any>;
}

export interface UserContext {
  id: string;
  name: string;
  email: string;
  timezone: string;
  locale: string;
  preferences: Record<string, any>;
}

export interface MessageContext {
  id: string;
  type: NotificationType;
  priority: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface SystemContext {
  appName: string;
  environment: string;
  version: string;
  baseUrl: string;
  supportEmail: string;
}

export interface RenderOptions {
  format: 'text' | 'html' | 'markdown';
  escapeHtml: boolean;
  preserveWhitespace: boolean;
  truncateLength?: number;
  locale?: string;
}

export interface RenderResult {
  subject: string;
  content: string;
  htmlContent?: string;
  metadata: {
    templateId: string;
    version: number;
    renderedAt: Date;
    size: number;
    variables: Record<string, any>;
  };
}

export interface TemplatePreview {
  templateId: string;
  subject: string;
  content: string;
  htmlContent?: string;
  sampleData: Record<string, any>;
}

export class TemplateEngine {
  private readonly logger = new Logger('TemplateEngine');
  private readonly templates = new Map<string, Template>();
  private readonly compiledTemplates = new Map<string, any>();
  private readonly renderCache = new Map<string, RenderResult>();
  private readonly partials = new Map<string, string>();
  private readonly helpers = new Map<string, Function>();

  constructor() {
    this.initializeDefaultTemplates();
    this.initializeHelpers();
    this.initializePartials();
  }

  private initializeDefaultTemplates(): void {
    const defaultTemplates: Template[] = [
      {
        id: 'basic-notification',
        name: 'Basic Notification',
        description: 'Standard notification template',
        type: NotificationType.INFO,
        channels: [NotificationChannel.EMAIL, NotificationChannel.SLACK],
        subject: '{{subject}}',
        content: `
Hello {{user.name}},

{{content}}

{{#if actionUrl}}
[View Details]({{actionUrl}})
{{/if}}

Best regards,
{{system.appName}} Team
        `.trim(),
        htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{subject}}</title>
</head>
<body>
    <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
        <h2>Hello {{user.name}},</h2>
        
        <p>{{content}}</p>
        
        {{#if actionUrl}}
        <p>
            <a href="{{actionUrl}}" style="background: #007cba; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                View Details
            </a>
        </p>
        {{/if}}
        
        <hr>
        <p style="color: #666; font-size: 12px;">
            This message was sent by {{system.appName}}<br>
            If you have questions, contact us at {{system.supportEmail}}
        </p>
    </div>
</body>
</html>
        `.trim(),
        variables: [
          {
            name: 'subject',
            type: 'string',
            required: true,
            description: 'The notification subject'
          },
          {
            name: 'content',
            type: 'string',
            required: true,
            description: 'The main notification content'
          },
          {
            name: 'actionUrl',
            type: 'string',
            required: false,
            description: 'Optional action URL'
          }
        ],
        metadata: {
          category: 'general',
          tags: ['notification', 'basic'],
          locale: 'en-US',
          priority: 1,
          estimatedSize: 500
        },
        version: 1,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'alert-template',
        name: 'Alert Notification',
        description: 'Template for alert notifications',
        type: NotificationType.ALERT,
        channels: [NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.SLACK],
        subject: 'ALERT: {{alertTitle}}',
        content: `
🚨 ALERT: {{alertTitle}}

Severity: {{severity}}
Time: {{formatDate message.timestamp}}
Environment: {{system.environment}}

Description:
{{description}}

{{#if details}}
Details:
{{#each details}}
- {{this.key}}: {{this.value}}
{{/each}}
{{/if}}

{{#if actionRequired}}
Action Required: {{actionRequired}}
{{/if}}

{{#if runbook}}
Runbook: {{runbook}}
{{/if}}

Alert ID: {{message.id}}
        `.trim(),
        variables: [
          {
            name: 'alertTitle',
            type: 'string',
            required: true,
            description: 'Alert title'
          },
          {
            name: 'severity',
            type: 'string',
            required: true,
            description: 'Alert severity level',
            validation: {
              enum: ['low', 'medium', 'high', 'critical']
            }
          },
          {
            name: 'description',
            type: 'string',
            required: true,
            description: 'Alert description'
          },
          {
            name: 'details',
            type: 'array',
            required: false,
            description: 'Additional alert details'
          },
          {
            name: 'actionRequired',
            type: 'string',
            required: false,
            description: 'Required action'
          },
          {
            name: 'runbook',
            type: 'string',
            required: false,
            description: 'Runbook URL'
          }
        ],
        metadata: {
          category: 'alerts',
          tags: ['alert', 'urgent'],
          locale: 'en-US',
          priority: 10,
          estimatedSize: 800
        },
        version: 1,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'digest-template',
        name: 'Digest Template',
        description: 'Template for message digests',
        type: NotificationType.DIGEST,
        channels: [NotificationChannel.EMAIL],
        subject: 'Daily Digest - {{formatDate now "MMM DD, YYYY"}}',
        content: `
Hello {{user.name}},

Here's your daily digest for {{formatDate now "MMMM DD, YYYY"}}:

{{#each messageGroups}}
## {{this.category}} ({{this.count}} messages)

{{#each this.messages}}
- **{{this.subject}}** ({{formatDate this.createdAt "HH:mm"}})
  {{truncate this.content 100}}
  {{#if this.actionUrl}}[View]({{this.actionUrl}}){{/if}}

{{/each}}

{{/each}}

---
Summary:
- Total messages: {{totalMessages}}
- Alerts: {{alertCount}}
- Info: {{infoCount}}

[View all notifications]({{viewAllUrl}})

Best regards,
{{system.appName}} Team
        `.trim(),
        variables: [
          {
            name: 'messageGroups',
            type: 'array',
            required: true,
            description: 'Grouped messages'
          },
          {
            name: 'totalMessages',
            type: 'number',
            required: true,
            description: 'Total message count'
          },
          {
            name: 'alertCount',
            type: 'number',
            required: false,
            defaultValue: 0,
            description: 'Alert message count'
          },
          {
            name: 'infoCount',
            type: 'number',
            required: false,
            defaultValue: 0,
            description: 'Info message count'
          },
          {
            name: 'viewAllUrl',
            type: 'string',
            required: false,
            description: 'URL to view all notifications'
          }
        ],
        metadata: {
          category: 'digest',
          tags: ['digest', 'summary'],
          locale: 'en-US',
          priority: 5,
          estimatedSize: 1200
        },
        version: 1,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
      this.compileTemplate(template);
    });
  }

  private initializeHelpers(): void {
    // Date formatting helper
    this.helpers.set('formatDate', (date: Date | string, format?: string) => {
      const d = new Date(date);
      if (!format) return d.toISOString();
      
      // Simple date formatting - would use a library like moment.js in production
      switch (format) {
        case 'MMM DD, YYYY':
          return d.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: '2-digit' 
          });
        case 'MMMM DD, YYYY':
          return d.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: '2-digit' 
          });
        case 'HH:mm':
          return d.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            hour12: false 
          });
        default:
          return d.toLocaleString();
      }
    });

    // Text truncation helper
    this.helpers.set('truncate', (text: string, length: number = 100) => {
      if (!text || text.length <= length) return text;
      return text.substring(0, length).trim() + '...';
    });

    // Conditional helper
    this.helpers.set('if', (condition: any, options: any) => {
      if (condition) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    // Iteration helper
    this.helpers.set('each', (context: any[], options: any) => {
      let result = '';
      if (Array.isArray(context)) {
        for (let i = 0; i < context.length; i++) {
          result += options.fn(context[i], { data: { index: i } });
        }
      }
      return result;
    });

    // String uppercase helper
    this.helpers.set('upper', (text: string) => {
      return String(text).toUpperCase();
    });

    // String lowercase helper
    this.helpers.set('lower', (text: string) => {
      return String(text).toLowerCase();
    });

    // URL encoding helper
    this.helpers.set('encode', (text: string) => {
      return encodeURIComponent(String(text));
    });

    // Number formatting helper
    this.helpers.set('number', (value: number, decimals: number = 0) => {
      return Number(value).toFixed(decimals);
    });
  }

  private initializePartials(): void {
    // Header partial
    this.partials.set('header', `
<div style="background: #f8f9fa; padding: 20px; margin-bottom: 20px; border-radius: 8px;">
    <h1 style="margin: 0; color: #333;">{{system.appName}}</h1>
</div>
    `.trim());

    // Footer partial
    this.partials.set('footer', `
<div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; color: #666; font-size: 12px;">
    <p>This email was sent by {{system.appName}}</p>
    <p>
        {{#if unsubscribeUrl}}
        <a href="{{unsubscribeUrl}}">Unsubscribe</a> |
        {{/if}}
        <a href="{{system.baseUrl}}">Visit Dashboard</a> |
        <a href="mailto:{{system.supportEmail}}">Contact Support</a>
    </p>
</div>
    `.trim());

    // Button partial
    this.partials.set('button', `
<a href="{{url}}" style="display: inline-block; background: {{color || '#007cba'}}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 10px 0;">
    {{text}}
</a>
    `.trim());
  }

  private compileTemplate(template: Template): void {
    try {
      // In a real implementation, you would use a templating engine like Handlebars
      // For this example, we'll store the template as-is
      this.compiledTemplates.set(template.id, {
        subject: template.subject,
        content: template.content,
        htmlContent: template.htmlContent
      });
    } catch (error) {
      this.logger.error('Failed to compile template', {
        templateId: template.id,
        error
      });
    }
  }

  public async render(
    templateId: string,
    context: TemplateContext,
    options: RenderOptions = {
      format: 'text',
      escapeHtml: true,
      preserveWhitespace: false
    }
  ): Promise<RenderResult> {
    const template = this.templates.get(templateId);
    if (!template || !template.enabled) {
      throw new Error(`Template not found or disabled: ${templateId}`);
    }

    const compiled = this.compiledTemplates.get(templateId);
    if (!compiled) {
      throw new Error(`Template not compiled: ${templateId}`);
    }

    try {
      // Validate required variables
      this.validateTemplateVariables(template, context);

      // Create render context with defaults and system data
      const renderContext = this.createRenderContext(template, context);

      // Generate cache key
      const cacheKey = this.generateCacheKey(templateId, renderContext, options);
      
      // Check cache
      const cached = this.renderCache.get(cacheKey);
      if (cached && this.isCacheValid(cached)) {
        return cached;
      }

      // Render template
      const subject = this.renderTemplate(compiled.subject, renderContext, options);
      const content = this.renderTemplate(compiled.content, renderContext, options);
      const htmlContent = compiled.htmlContent 
        ? this.renderTemplate(compiled.htmlContent, renderContext, { ...options, format: 'html' })
        : undefined;

      // Apply post-processing
      const processedContent = this.postProcessContent(content, options);
      const processedHtmlContent = htmlContent 
        ? this.postProcessContent(htmlContent, { ...options, format: 'html' })
        : undefined;

      const result: RenderResult = {
        subject,
        content: processedContent,
        htmlContent: processedHtmlContent,
        metadata: {
          templateId,
          version: template.version,
          renderedAt: new Date(),
          size: processedContent.length + (processedHtmlContent?.length || 0),
          variables: renderContext.custom
        }
      };

      // Cache result
      this.renderCache.set(cacheKey, result);

      this.logger.debug('Template rendered', {
        templateId,
        size: result.metadata.size
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to render template', {
        templateId,
        error
      });
      throw error;
    }
  }

  private validateTemplateVariables(template: Template, context: TemplateContext): void {
    const missingRequired: string[] = [];

    for (const variable of template.variables) {
      if (variable.required) {
        const value = this.getVariableValue(variable.name, context);
        if (value === undefined || value === null || value === '') {
          missingRequired.push(variable.name);
        }
      }

      // Validate variable constraints
      const value = this.getVariableValue(variable.name, context);
      if (value !== undefined && variable.validation) {
        this.validateVariableConstraints(variable, value);
      }
    }

    if (missingRequired.length > 0) {
      throw new Error(`Missing required template variables: ${missingRequired.join(', ')}`);
    }
  }

  private getVariableValue(name: string, context: TemplateContext): any {
    // Check custom context first
    if (context.custom.hasOwnProperty(name)) {
      return context.custom[name];
    }

    // Check nested properties
    const parts = name.split('.');
    let value: any = context;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && value.hasOwnProperty(part)) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private validateVariableConstraints(variable: TemplateVariable, value: any): void {
    const validation = variable.validation!;

    switch (variable.type) {
      case 'string':
        if (typeof value !== 'string') break;
        
        if (validation.minLength && value.length < validation.minLength) {
          throw new Error(`Variable ${variable.name} too short (min: ${validation.minLength})`);
        }
        if (validation.maxLength && value.length > validation.maxLength) {
          throw new Error(`Variable ${variable.name} too long (max: ${validation.maxLength})`);
        }
        if (validation.pattern && !new RegExp(validation.pattern).test(value)) {
          throw new Error(`Variable ${variable.name} does not match pattern`);
        }
        if (validation.enum && !validation.enum.includes(value)) {
          throw new Error(`Variable ${variable.name} not in allowed values`);
        }
        break;

      case 'number':
        if (typeof value !== 'number') break;
        
        if (validation.min !== undefined && value < validation.min) {
          throw new Error(`Variable ${variable.name} below minimum (${validation.min})`);
        }
        if (validation.max !== undefined && value > validation.max) {
          throw new Error(`Variable ${variable.name} above maximum (${validation.max})`);
        }
        break;
    }
  }

  private createRenderContext(template: Template, context: TemplateContext): any {
    return {
      ...context,
      // Add template-specific context
      template: {
        id: template.id,
        name: template.name,
        version: template.version
      },
      // Add current timestamp
      now: new Date(),
      // Add helpers
      ...Object.fromEntries(this.helpers.entries())
    };
  }

  private renderTemplate(template: string, context: any, options: RenderOptions): string {
    // Simple template rendering - in production, use a proper templating engine
    let result = template;

    // Replace variables
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
      const value = this.getVariableValue(variable.trim(), context);
      
      if (value === undefined || value === null) {
        return '';
      }

      let stringValue = String(value);

      // Apply HTML escaping if needed
      if (options.escapeHtml && options.format === 'html') {
        stringValue = this.escapeHtml(stringValue);
      }

      return stringValue;
    });

    // Process conditionals (simple implementation)
    result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
      const conditionValue = this.getVariableValue(condition.trim(), context);
      return conditionValue ? content : '';
    });

    // Process loops (simple implementation)
    result = result.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, arrayPath, itemTemplate) => {
      const array = this.getVariableValue(arrayPath.trim(), context);
      if (!Array.isArray(array)) return '';

      return array.map(item => {
        let itemContent = itemTemplate;
        // Replace {{this.property}} with item properties
        itemContent = itemContent.replace(/\{\{this\.([^}]+)\}\}/g, (_, prop) => {
          return String(item[prop] || '');
        });
        return itemContent;
      }).join('');
    });

    return result;
  }

  private postProcessContent(content: string, options: RenderOptions): string {
    let processed = content;

    // Truncate if specified
    if (options.truncateLength && processed.length > options.truncateLength) {
      processed = processed.substring(0, options.truncateLength).trim() + '...';
    }

    // Handle whitespace
    if (!options.preserveWhitespace) {
      processed = processed.replace(/\s+/g, ' ').trim();
    }

    return processed;
  }

  private escapeHtml(text: string): string {
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    };

    return text.replace(/[&<>"']/g, (char) => escapeMap[char]);
  }

  private generateCacheKey(templateId: string, context: any, options: RenderOptions): string {
    const contextHash = this.hashObject(context);
    const optionsHash = this.hashObject(options);
    return `${templateId}-${contextHash}-${optionsHash}`;
  }

  private hashObject(obj: any): string {
    // Simple hash function - in production, use a proper hash library
    return btoa(JSON.stringify(obj)).substring(0, 16);
  }

  private isCacheValid(cached: RenderResult): boolean {
    const maxAge = 60 * 60 * 1000; // 1 hour
    return (Date.now() - cached.metadata.renderedAt.getTime()) < maxAge;
  }

  public async preview(
    templateId: string,
    sampleData: Record<string, any> = {}
  ): Promise<TemplatePreview> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Create sample context
    const context: TemplateContext = {
      user: {
        id: 'sample-user-123',
        name: 'John Doe',
        email: 'john.doe@example.com',
        timezone: 'America/New_York',
        locale: 'en-US',
        preferences: {}
      },
      message: {
        id: 'msg-123',
        type: template.type,
        priority: 'normal',
        timestamp: new Date(),
        metadata: {}
      },
      system: {
        appName: 'SaaS IDP Platform',
        environment: 'production',
        version: '1.0.0',
        baseUrl: 'https://app.example.com',
        supportEmail: 'support@example.com'
      },
      custom: {
        ...this.generateSampleData(template),
        ...sampleData
      }
    };

    const result = await this.render(templateId, context);

    return {
      templateId,
      subject: result.subject,
      content: result.content,
      htmlContent: result.htmlContent,
      sampleData: context.custom
    };
  }

  private generateSampleData(template: Template): Record<string, any> {
    const sampleData: Record<string, any> = {};

    for (const variable of template.variables) {
      if (variable.defaultValue !== undefined) {
        sampleData[variable.name] = variable.defaultValue;
        continue;
      }

      switch (variable.type) {
        case 'string':
          sampleData[variable.name] = variable.validation?.enum?.[0] || `Sample ${variable.name}`;
          break;
        case 'number':
          sampleData[variable.name] = variable.validation?.min || 42;
          break;
        case 'boolean':
          sampleData[variable.name] = true;
          break;
        case 'date':
          sampleData[variable.name] = new Date();
          break;
        case 'array':
          sampleData[variable.name] = [
            { key: 'Sample Key 1', value: 'Sample Value 1' },
            { key: 'Sample Key 2', value: 'Sample Value 2' }
          ];
          break;
        case 'object':
          sampleData[variable.name] = { sample: 'value' };
          break;
      }
    }

    return sampleData;
  }

  public addTemplate(template: Template): void {
    this.templates.set(template.id, template);
    this.compileTemplate(template);
    
    this.logger.info('Template added', {
      id: template.id,
      name: template.name
    });
  }

  public removeTemplate(templateId: string): boolean {
    const removed = this.templates.delete(templateId);
    this.compiledTemplates.delete(templateId);
    
    // Clear related cache entries
    for (const [key] of this.renderCache.entries()) {
      if (key.startsWith(templateId)) {
        this.renderCache.delete(key);
      }
    }

    if (removed) {
      this.logger.info('Template removed', { id: templateId });
    }

    return removed;
  }

  public getTemplate(templateId: string): Template | undefined {
    return this.templates.get(templateId);
  }

  public listTemplates(filters?: {
    type?: NotificationType;
    channel?: NotificationChannel;
    category?: string;
    enabled?: boolean;
  }): Template[] {
    let templates = Array.from(this.templates.values());

    if (filters) {
      if (filters.type) {
        templates = templates.filter(t => t.type === filters.type);
      }
      if (filters.channel) {
        templates = templates.filter(t => t.channels.includes(filters.channel!));
      }
      if (filters.category) {
        templates = templates.filter(t => t.metadata.category === filters.category);
      }
      if (filters.enabled !== undefined) {
        templates = templates.filter(t => t.enabled === filters.enabled);
      }
    }

    return templates.sort((a, b) => a.name.localeCompare(b.name));
  }

  public getTemplateStats(): any {
    const templates = Array.from(this.templates.values());
    
    return {
      total: templates.length,
      enabled: templates.filter(t => t.enabled).length,
      byType: templates.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byCategory: templates.reduce((acc, t) => {
        acc[t.metadata.category] = (acc[t.metadata.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      cacheSize: this.renderCache.size
    };
  }

  public clearCache(templateId?: string): void {
    if (templateId) {
      for (const [key] of this.renderCache.entries()) {
        if (key.startsWith(templateId)) {
          this.renderCache.delete(key);
        }
      }
    } else {
      this.renderCache.clear();
    }
  }
}