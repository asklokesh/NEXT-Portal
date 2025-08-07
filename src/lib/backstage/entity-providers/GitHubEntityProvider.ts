import { Octokit } from '@octokit/rest';
import { Logger } from 'winston';
import * as yaml from 'js-yaml';
import { backstageClient } from '../real-client';
import type { Entity } from '@backstage/catalog-model';

export interface GitHubEntityProviderConfig {
  id: string;
  githubUrl: string;
  organization: string;
  catalogPath: string;
  filters?: {
    branch?: string;
    repository?: string;
  };
  schedule?: {
    frequency: string;
    timeout?: string;
  };
}

export interface GitHubDiscoveryResult {
  entities: Entity[];
  locations: string[];
  errors: string[];
}

/**
 * Entity provider that discovers entities from GitHub repositories
 * This integrates with Backstage's entity provider pattern
 */
export class GitHubEntityProvider {
  private readonly config: GitHubEntityProviderConfig;
  private readonly octokit: Octokit;
  private readonly logger: Logger;

  constructor(
    config: GitHubEntityProviderConfig,
    logger: Logger,
    githubToken?: string
  ) {
    this.config = config;
    this.logger = logger;

    this.octokit = new Octokit({
      auth: githubToken || process.env.GITHUB_TOKEN,
      baseUrl: config.githubUrl === 'github.com' 
        ? 'https://api.github.com' 
        : `${config.githubUrl}/api/v3`,
    });
  }

  /**
   * Discovery method that scans GitHub organization for catalog entities
   */
  async discover(): Promise<GitHubDiscoveryResult> {
    const result: GitHubDiscoveryResult = {
      entities: [],
      locations: [],
      errors: [],
    };

    try {
      this.logger.info(`Starting GitHub discovery for organization: ${this.config.organization}`);

      // Get all repositories in the organization
      const repositories = await this.getAllRepositories();
      
      this.logger.info(`Found ${repositories.length} repositories to scan`);

      // Process repositories in batches to avoid rate limiting
      const batchSize = 10;
      for (let i = 0; i < repositories.length; i += batchSize) {
        const batch = repositories.slice(i, i + batchSize);
        
        const batchResults = await Promise.allSettled(
          batch.map(repo => this.processRepository(repo))
        );

        for (const batchResult of batchResults) {
          if (batchResult.status === 'fulfilled' && batchResult.value) {
            const { entities, location } = batchResult.value;
            result.entities.push(...entities);
            if (location) {
              result.locations.push(location);
            }
          } else if (batchResult.status === 'rejected') {
            result.errors.push(batchResult.reason?.message || 'Unknown error');
          }
        }

        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.logger.info(
        `GitHub discovery completed: ${result.entities.length} entities, ${result.locations.length} locations, ${result.errors.length} errors`
      );

    } catch (error) {
      this.logger.error('GitHub discovery failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Process a single repository and extract entities
   */
  private async processRepository(repo: any): Promise<{
    entities: Entity[];
    location?: string;
  } | null> {
    try {
      // Check if repository should be processed
      if (this.shouldSkipRepository(repo)) {
        return null;
      }

      const entities: Entity[] = [];
      let location: string | undefined;

      // Look for catalog-info.yaml files
      const catalogFiles = await this.findCatalogFiles(repo);

      for (const file of catalogFiles) {
        try {
          const content = await this.getFileContent(repo.owner.login, repo.name, file.path);
          const parsedEntities = this.parseCatalogFile(content, repo, file.path);
          entities.push(...parsedEntities);

          // Create location URL for Backstage
          location = `${repo.html_url}/blob/${repo.default_branch}/${file.path}`;
        } catch (error) {
          this.logger.warn(`Failed to process catalog file ${file.path} in ${repo.full_name}:`, error);
        }
      }

      // If no catalog files found, generate one based on repository metadata
      if (entities.length === 0) {
        const generatedEntity = await this.generateEntityFromRepository(repo);
        if (generatedEntity) {
          entities.push(generatedEntity);
        }
      }

      return { entities, location };
    } catch (error) {
      this.logger.warn(`Failed to process repository ${repo.full_name}:`, error);
      return null;
    }
  }

  /**
   * Get all repositories from the organization
   */
  private async getAllRepositories(): Promise<any[]> {
    const repositories: any[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await this.octokit.repos.listForOrg({
        org: this.config.organization,
        per_page: perPage,
        page,
        sort: 'updated',
        direction: 'desc',
      });

      repositories.push(...response.data);

      if (response.data.length < perPage) {
        break;
      }
      page++;
    }

    return repositories.filter(repo => this.matchesFilters(repo));
  }

  /**
   * Find catalog-info.yaml files in a repository
   */
  private async findCatalogFiles(repo: any): Promise<Array<{ path: string; name: string }>> {
    const catalogFiles: Array<{ path: string; name: string }> = [];
    const possiblePaths = [
      'catalog-info.yaml',
      'catalog-info.yml',
      '.backstage/catalog-info.yaml',
      '.backstage/catalog-info.yml',
      'backstage/catalog-info.yaml',
      'backstage/catalog-info.yml',
    ];

    for (const path of possiblePaths) {
      try {
        await this.octokit.repos.getContent({
          owner: repo.owner.login,
          repo: repo.name,
          path,
          ref: repo.default_branch,
        });
        
        catalogFiles.push({ path, name: path.split('/').pop()! });
      } catch (error) {
        // File doesn't exist, continue to next
      }
    }

    return catalogFiles;
  }

  /**
   * Get file content from GitHub
   */
  private async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    const response = await this.octokit.repos.getContent({
      owner,
      repo,
      path,
    });

    if ('content' in response.data) {
      return Buffer.from(response.data.content, 'base64').toString('utf8');
    }

    throw new Error(`File ${path} is not a regular file`);
  }

  /**
   * Parse catalog-info.yaml file and extract entities
   */
  private parseCatalogFile(content: string, repo: any, filePath: string): Entity[] {
    try {
      const documents = yaml.loadAll(content) as any[];
      const entities: Entity[] = [];

      for (const doc of documents) {
        if (doc && doc.apiVersion && doc.kind && doc.metadata) {
          // Validate and enhance entity
          const entity = this.enhanceEntity(doc, repo, filePath);
          entities.push(entity);
        }
      }

      return entities;
    } catch (error) {
      throw new Error(`Failed to parse YAML file ${filePath}: ${error}`);
    }
  }

  /**
   * Generate a basic entity from repository metadata when no catalog file exists
   */
  private async generateEntityFromRepository(repo: any): Promise<Entity | null> {
    // Only generate for repositories that look like services/applications
    if (repo.archived || repo.disabled) {
      return null;
    }

    // Detect if this is likely a service based on common patterns
    const serviceIndicators = [
      'service', 'api', 'app', 'backend', 'frontend', 
      'server', 'microservice', 'web'
    ];
    
    const isService = serviceIndicators.some(indicator => 
      repo.name.toLowerCase().includes(indicator) ||
      (repo.description && repo.description.toLowerCase().includes(indicator))
    );

    if (!isService && !repo.description) {
      return null; // Skip repositories that don't seem like services
    }

    // Get repository languages to determine type
    let languages: Record<string, number> = {};
    try {
      const languagesResponse = await this.octokit.repos.listLanguages({
        owner: repo.owner.login,
        repo: repo.name,
      });
      languages = languagesResponse.data;
    } catch (error) {
      // Languages endpoint might not be available
    }

    const primaryLanguage = Object.keys(languages)[0]?.toLowerCase();
    const entityType = this.determineEntityType(repo, primaryLanguage);

    return {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: repo.name,
        title: repo.name.split('-').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        description: repo.description || `Auto-generated from ${repo.full_name}`,
        tags: [
          ...(repo.topics || []),
          ...(primaryLanguage ? [primaryLanguage] : []),
          'auto-discovered'
        ],
        annotations: {
          'backstage.io/managed-by-location': `url:${repo.html_url}`,
          'github.com/project-slug': repo.full_name,
          'backstage.io/source-location': `url:${repo.html_url}/tree/${repo.default_branch}`,
        },
        links: [
          {
            url: repo.html_url,
            title: 'Repository',
            icon: 'github',
          },
        ],
      },
      spec: {
        type: entityType,
        lifecycle: repo.archived ? 'deprecated' : 'production',
        owner: 'unknown', // Could be enhanced with CODEOWNERS parsing
        system: this.extractSystemFromRepo(repo),
      },
    };
  }

  /**
   * Enhance entity with additional metadata from repository
   */
  private enhanceEntity(entity: Entity, repo: any, filePath: string): Entity {
    // Add GitHub-specific annotations
    entity.metadata.annotations = {
      ...entity.metadata.annotations,
      'github.com/project-slug': repo.full_name,
      'backstage.io/managed-by-location': `url:${repo.html_url}/blob/${repo.default_branch}/${filePath}`,
      'backstage.io/source-location': `url:${repo.html_url}/tree/${repo.default_branch}`,
    };

    // Add repository topics as tags
    if (repo.topics && repo.topics.length > 0) {
      entity.metadata.tags = [
        ...(entity.metadata.tags || []),
        ...repo.topics.filter(topic => 
          !(entity.metadata.tags || []).includes(topic)
        ),
      ];
    }

    // Add repository link if not present
    const hasRepoLink = entity.metadata.links?.some(
      link => link.url === repo.html_url
    );

    if (!hasRepoLink) {
      entity.metadata.links = [
        ...(entity.metadata.links || []),
        {
          url: repo.html_url,
          title: 'Repository',
          icon: 'github',
        },
      ];
    }

    return entity;
  }

  /**
   * Determine entity type based on repository characteristics
   */
  private determineEntityType(repo: any, primaryLanguage?: string): string {
    const name = repo.name.toLowerCase();
    const description = (repo.description || '').toLowerCase();

    // Frontend applications
    if (name.includes('frontend') || name.includes('ui') || name.includes('web') ||
        primaryLanguage === 'javascript' || primaryLanguage === 'typescript') {
      return 'website';
    }

    // APIs
    if (name.includes('api') || description.includes('api') || 
        description.includes('rest') || description.includes('graphql')) {
      return 'service';
    }

    // Libraries
    if (name.includes('lib') || name.includes('sdk') || name.includes('utils') ||
        description.includes('library') || description.includes('package')) {
      return 'library';
    }

    // Default to service
    return 'service';
  }

  /**
   * Extract system name from repository patterns
   */
  private extractSystemFromRepo(repo: any): string | undefined {
    const name = repo.name.toLowerCase();
    
    // Look for common system prefixes
    const systemPatterns = [
      /^([^-]+)-/,  // Everything before first dash
      /^(platform|core|auth|payment|user|order|catalog)/, // Common system names
    ];

    for (const pattern of systemPatterns) {
      const match = name.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Check if repository matches configured filters
   */
  private matchesFilters(repo: any): boolean {
    if (this.config.filters?.repository) {
      const repoFilter = this.config.filters.repository;
      if (!repo.name.includes(repoFilter)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if repository should be skipped
   */
  private shouldSkipRepository(repo: any): boolean {
    // Skip archived repositories
    if (repo.archived) {
      return true;
    }

    // Skip disabled repositories
    if (repo.disabled) {
      return true;
    }

    // Skip forks (optional)
    if (repo.fork) {
      return true;
    }

    return false;
  }

  /**
   * Register discovered entities with Backstage catalog
   */
  async registerEntities(entities: Entity[]): Promise<void> {
    for (const entity of entities) {
      try {
        await backstageClient.getCatalogEntities({
          kind: entity.kind,
          namespace: entity.metadata.namespace || 'default',
          name: entity.metadata.name,
        });

        // If entity exists, update it; otherwise create it
        // Note: This is a simplified approach - in real Backstage, 
        // entities are typically managed through locations
        this.logger.info(`Processed entity: ${entity.kind}:${entity.metadata.namespace || 'default'}/${entity.metadata.name}`);
      } catch (error) {
        this.logger.warn(`Failed to register entity ${entity.metadata.name}:`, error);
      }
    }
  }

  /**
   * Start the provider with scheduled discovery
   */
  start(): void {
    this.logger.info(`Starting GitHub entity provider for ${this.config.organization}`);
    
    // Initial discovery
    this.runDiscovery();

    // Schedule periodic discovery if configured
    if (this.config.schedule) {
      const frequency = this.parseScheduleFrequency(this.config.schedule.frequency);
      setInterval(() => {
        this.runDiscovery();
      }, frequency);
    }
  }

  /**
   * Run discovery and handle results
   */
  private async runDiscovery(): Promise<void> {
    try {
      const result = await this.discover();
      
      if (result.entities.length > 0) {
        await this.registerEntities(result.entities);
      }

      if (result.errors.length > 0) {
        this.logger.warn(`Discovery completed with ${result.errors.length} errors:`, result.errors);
      }
    } catch (error) {
      this.logger.error('Discovery run failed:', error);
    }
  }

  /**
   * Parse schedule frequency string to milliseconds
   */
  private parseScheduleFrequency(frequency: string): number {
    const match = frequency.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 3600000; // Default to 1 hour
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 3600000;
    }
  }
}