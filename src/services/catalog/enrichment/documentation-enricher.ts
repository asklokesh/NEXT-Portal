/**
 * Documentation Enricher
 * 
 * Automatically generates and extracts documentation from various sources
 * including README files, code comments, API documentation, and wikis.
 */

import { EventEmitter } from 'events';
import { Octokit } from '@octokit/rest';
import * as marked from 'marked';
import {
  TransformedEntityData,
  IEntityEnricher,
  EntityEnrichmentResult,
} from '../types';

interface DocumentationSource {
  type: 'readme' | 'wiki' | 'docs' | 'swagger' | 'openapi' | 'comments';
  url?: string;
  content?: string;
  confidence: number;
  lastUpdated?: Date;
}

interface ExtractedDocumentation {
  description?: string;
  overview?: string;
  gettingStarted?: string;
  apiDocumentation?: string;
  troubleshooting?: string;
  changelog?: string;
  tags: string[];
  links: Array<{
    title: string;
    url: string;
    type: 'documentation' | 'wiki' | 'api' | 'source';
  }>;
}

export class DocumentationEnricher extends EventEmitter implements IEntityEnricher {
  readonly id = 'documentation-enricher';
  readonly name = 'Documentation Enricher';

  private readonly githubClient?: Octokit;
  private readonly documentationCache = new Map<string, ExtractedDocumentation>();

  constructor(config: {
    github?: {
      token: string;
    };
    cacheEnabled?: boolean;
    cacheTtl?: number; // minutes
  } = {}) {
    super();

    if (config.github?.token) {
      this.githubClient = new Octokit({
        auth: config.github.token,
      });
    }
  }

  /**
   * Check if entity can be enriched
   */
  canEnrich(entity: TransformedEntityData): boolean {
    // Can enrich entities with source code references or documentation links
    return Boolean(
      entity.metadata.annotations?.['github.com/project-slug'] ||
      entity.metadata.annotations?.['gitlab.com/project-slug'] ||
      entity.metadata.annotations?.['backstage.io/source-location'] ||
      entity.spec.documentation ||
      entity.spec.wiki
    );
  }

  /**
   * Enrich entity with documentation
   */
  async enrich(entity: TransformedEntityData): Promise<EntityEnrichmentResult> {
    const startTime = Date.now();
    
    try {
      this.emit('enrichmentStarted', { entityRef: entity.entityRef });

      const sources = await this.identifyDocumentationSources(entity);
      const documentation = await this.extractDocumentation(sources);
      
      const enrichmentData = {
        metadata: {
          description: documentation.description || entity.metadata.description,
          tags: [...(entity.metadata.tags || []), ...documentation.tags],
          annotations: {
            'backstage.io/documentation-auto-generated': 'true',
            'backstage.io/documentation-sources': sources.map(s => s.type).join(','),
            ...(documentation.overview && {
              'backstage.io/overview': this.truncateForAnnotation(documentation.overview),
            }),
          },
        },
        spec: {
          documentation: documentation,
          ...(documentation.links.length > 0 && {
            links: documentation.links,
          }),
        },
      };

      this.emit('enrichmentCompleted', { entityRef: entity.entityRef });

      return {
        entityRef: entity.entityRef,
        enricherId: this.id,
        status: 'success',
        data: enrichmentData,
        confidence: this.calculateConfidence(sources, documentation),
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
      };

    } catch (error) {
      this.emit('enrichmentFailed', { entityRef: entity.entityRef, error });

      return {
        entityRef: entity.entityRef,
        enricherId: this.id,
        status: 'failed',
        data: {},
        confidence: 0,
        timestamp: new Date(),
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Identify documentation sources for entity
   */
  private async identifyDocumentationSources(
    entity: TransformedEntityData
  ): Promise<DocumentationSource[]> {
    const sources: DocumentationSource[] = [];

    // GitHub repository documentation
    const githubSlug = entity.metadata.annotations?.['github.com/project-slug'];
    if (githubSlug && this.githubClient) {
      const [owner, repo] = githubSlug.split('/');
      
      try {
        // Check for README
        const readmeSource = await this.getGitHubReadme(owner, repo);
        if (readmeSource) {
          sources.push(readmeSource);
        }

        // Check for docs folder
        const docsSource = await this.getGitHubDocs(owner, repo);
        sources.push(...docsSource);

        // Check for OpenAPI/Swagger specs
        const apiSource = await this.getGitHubAPISpec(owner, repo);
        if (apiSource) {
          sources.push(apiSource);
        }

      } catch (error) {
        this.emit('sourceExtractionError', { 
          entityRef: entity.entityRef, 
          source: 'github', 
          error 
        });
      }
    }

    // Explicit documentation links
    const docLinks = entity.spec.documentation as string | string[];
    if (docLinks) {
      const links = Array.isArray(docLinks) ? docLinks : [docLinks];
      
      for (const link of links) {
        sources.push({
          type: 'docs',
          url: link,
          confidence: 0.9,
        });
      }
    }

    // Wiki links
    const wikiLinks = entity.spec.wiki as string | string[];
    if (wikiLinks) {
      const links = Array.isArray(wikiLinks) ? wikiLinks : [wikiLinks];
      
      for (const link of links) {
        sources.push({
          type: 'wiki',
          url: link,
          confidence: 0.8,
        });
      }
    }

    // Source location annotations
    const sourceLocation = entity.metadata.annotations?.['backstage.io/source-location'];
    if (sourceLocation && sourceLocation.startsWith('url:')) {
      sources.push({
        type: 'docs',
        url: sourceLocation.substring(4),
        confidence: 0.7,
      });
    }

    return sources;
  }

  /**
   * Extract documentation from sources
   */
  private async extractDocumentation(
    sources: DocumentationSource[]
  ): Promise<ExtractedDocumentation> {
    const documentation: ExtractedDocumentation = {
      tags: [],
      links: [],
    };

    for (const source of sources) {
      try {
        const content = source.content || await this.fetchContent(source.url!);
        
        switch (source.type) {
          case 'readme':
            this.extractFromReadme(content, documentation);
            break;
            
          case 'wiki':
            this.extractFromWiki(content, documentation);
            break;
            
          case 'docs':
            this.extractFromDocs(content, documentation, source.url);
            break;
            
          case 'swagger':
          case 'openapi':
            await this.extractFromAPISpec(content, documentation);
            break;
        }
        
      } catch (error) {
        this.emit('contentExtractionError', { source, error });
      }
    }

    // Deduplicate and clean up
    documentation.tags = [...new Set(documentation.tags)];
    
    return documentation;
  }

  /**
   * Get README from GitHub repository
   */
  private async getGitHubReadme(owner: string, repo: string): Promise<DocumentationSource | null> {
    try {
      const { data } = await this.githubClient!.repos.getReadme({ owner, repo });
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      
      return {
        type: 'readme',
        content,
        confidence: 0.9,
        lastUpdated: new Date(data.last_modified || Date.now()),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get documentation files from GitHub repository
   */
  private async getGitHubDocs(owner: string, repo: string): Promise<DocumentationSource[]> {
    const sources: DocumentationSource[] = [];
    
    try {
      // Check for docs folder
      const { data: contents } = await this.githubClient!.repos.getContent({
        owner,
        repo,
        path: 'docs',
      });

      if (Array.isArray(contents)) {
        for (const item of contents) {
          if (item.type === 'file' && item.name.match(/\.(md|rst|txt)$/i)) {
            try {
              const { data: file } = await this.githubClient!.repos.getContent({
                owner,
                repo,
                path: item.path,
              });

              if ('content' in file) {
                const content = Buffer.from(file.content, 'base64').toString('utf-8');
                sources.push({
                  type: 'docs',
                  content,
                  confidence: 0.8,
                  lastUpdated: new Date(),
                });
              }
            } catch (error) {
              // Skip individual file errors
            }
          }
        }
      }
    } catch (error) {
      // No docs folder or access error
    }

    return sources;
  }

  /**
   * Get API specification from GitHub repository
   */
  private async getGitHubAPISpec(owner: string, repo: string): Promise<DocumentationSource | null> {
    const specPaths = [
      'openapi.yaml',
      'openapi.yml',
      'swagger.yaml',
      'swagger.yml',
      'api/openapi.yaml',
      'docs/openapi.yaml',
      'spec/openapi.yaml',
    ];

    for (const path of specPaths) {
      try {
        const { data } = await this.githubClient!.repos.getContent({
          owner,
          repo,
          path,
        });

        if ('content' in data) {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          return {
            type: path.includes('swagger') ? 'swagger' : 'openapi',
            content,
            confidence: 0.95,
            lastUpdated: new Date(),
          };
        }
      } catch (error) {
        // Continue to next path
      }
    }

    return null;
  }

  /**
   * Fetch content from URL
   */
  private async fetchContent(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    return response.text();
  }

  /**
   * Extract documentation from README content
   */
  private extractFromReadme(content: string, documentation: ExtractedDocumentation): void {
    const tokens = marked.lexer(content);
    
    let currentSection = '';
    let description = '';
    let overview = '';
    let gettingStarted = '';
    
    for (const token of tokens) {
      if (token.type === 'heading') {
        currentSection = token.text.toLowerCase();
      } else if (token.type === 'paragraph' || token.type === 'text') {
        const text = token.text || '';
        
        if (!description && tokens.indexOf(token) < 5) {
          // Use first few paragraphs as description
          description += text + '\n';
        }
        
        if (currentSection.includes('overview') || currentSection.includes('about')) {
          overview += text + '\n';
        } else if (currentSection.includes('getting started') || currentSection.includes('quick start')) {
          gettingStarted += text + '\n';
        }
      } else if (token.type === 'link') {
        documentation.links.push({
          title: token.text || token.href,
          url: token.href,
          type: 'documentation',
        });
      }
    }

    // Extract tags from content
    const tags = this.extractTags(content);
    documentation.tags.push(...tags);

    if (description) documentation.description = description.trim();
    if (overview) documentation.overview = overview.trim();
    if (gettingStarted) documentation.gettingStarted = gettingStarted.trim();
  }

  /**
   * Extract documentation from wiki content
   */
  private extractFromWiki(content: string, documentation: ExtractedDocumentation): void {
    // Similar to README but with different confidence
    this.extractFromReadme(content, documentation);
    
    // Add wiki-specific processing
    const links = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
    for (const link of links) {
      const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (match) {
        documentation.links.push({
          title: match[1],
          url: match[2],
          type: 'wiki',
        });
      }
    }
  }

  /**
   * Extract documentation from docs content
   */
  private extractFromDocs(
    content: string, 
    documentation: ExtractedDocumentation,
    sourceUrl?: string
  ): void {
    this.extractFromReadme(content, documentation);
    
    if (sourceUrl) {
      documentation.links.push({
        title: 'Documentation',
        url: sourceUrl,
        type: 'documentation',
      });
    }
  }

  /**
   * Extract documentation from API specification
   */
  private async extractFromAPISpec(
    content: string,
    documentation: ExtractedDocumentation
  ): Promise<void> {
    try {
      const spec = content.trim().startsWith('{') 
        ? JSON.parse(content)
        : require('yaml').parse(content);

      if (spec.info) {
        if (spec.info.description) {
          documentation.apiDocumentation = spec.info.description;
        }
        
        if (spec.info.title && !documentation.description) {
          documentation.description = spec.info.title;
        }
      }

      // Extract tags from API spec
      if (spec.tags) {
        const apiTags = spec.tags.map((tag: any) => tag.name).filter(Boolean);
        documentation.tags.push(...apiTags);
      }

      // Extract external docs
      if (spec.externalDocs) {
        documentation.links.push({
          title: spec.externalDocs.description || 'API Documentation',
          url: spec.externalDocs.url,
          type: 'api',
        });
      }

    } catch (error) {
      this.emit('apiSpecParseError', { error });
    }
  }

  /**
   * Extract tags from content using various heuristics
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const lowerContent = content.toLowerCase();

    // Technology tags
    const techPatterns = [
      /\b(react|vue|angular|node\.?js|python|java|go|rust|typescript|javascript)\b/g,
      /\b(docker|kubernetes|helm|terraform|ansible)\b/g,
      /\b(aws|azure|gcp|google cloud)\b/g,
      /\b(postgresql|mysql|mongodb|redis|elasticsearch)\b/g,
      /\b(kafka|rabbitmq|grpc|rest|graphql)\b/g,
    ];

    for (const pattern of techPatterns) {
      const matches = lowerContent.match(pattern) || [];
      tags.push(...matches.map(match => match.replace('.', '')));
    }

    // Badge-based tags (common in README files)
    const badgePattern = /!\[([^\]]*)\]\([^)]*\)/g;
    let match;
    while ((match = badgePattern.exec(content)) !== null) {
      const badgeText = match[1].toLowerCase();
      if (badgeText && badgeText.length > 0 && badgeText.length < 20) {
        tags.push(badgeText);
      }
    }

    // Remove duplicates and filter
    return [...new Set(tags)]
      .filter(tag => tag.length > 2 && tag.length < 20)
      .slice(0, 10); // Limit to 10 tags
  }

  /**
   * Calculate confidence score based on sources and documentation quality
   */
  private calculateConfidence(
    sources: DocumentationSource[],
    documentation: ExtractedDocumentation
  ): number {
    let confidence = 0;

    // Base confidence from sources
    const sourceConfidence = sources.reduce((sum, source) => sum + source.confidence, 0) / sources.length;
    confidence += sourceConfidence * 0.6;

    // Bonus for comprehensive documentation
    if (documentation.description) confidence += 0.1;
    if (documentation.overview) confidence += 0.1;
    if (documentation.gettingStarted) confidence += 0.1;
    if (documentation.apiDocumentation) confidence += 0.1;
    if (documentation.links.length > 0) confidence += Math.min(documentation.links.length * 0.02, 0.1);
    if (documentation.tags.length > 0) confidence += Math.min(documentation.tags.length * 0.01, 0.05);

    return Math.min(confidence, 1.0);
  }

  /**
   * Truncate text for annotation (Backstage has limits)
   */
  private truncateForAnnotation(text: string, maxLength: number = 1000): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength - 3) + '...';
  }
}

export default DocumentationEnricher;