/**
 * Git Repository Analyzer
 * 
 * Advanced service discovery source that analyzes Git repositories to identify
 * services based on code patterns, configuration files, and project structure.
 * Supports GitHub, GitLab, and other Git-based platforms.
 */

import { Octokit } from '@octokit/rest';
import { SimpleGit, simpleGit } from 'simple-git';
import { Logger } from 'winston';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseDiscoverySource, createHttpEndpoint } from '../core/base-source';
import { DiscoveredService } from '../core/discovery-engine';

// Configuration schema
const GitRepositoryAnalyzerConfigSchema = z.object({
  providers: z.object({
    github: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
      baseUrl: z.string().default('https://api.github.com'),
      organizations: z.array(z.string()).optional(),
      repositories: z.array(z.string()).optional(),
      excludeArchived: z.boolean().default(true),
      excludeForks: z.boolean().default(true),
    }).optional(),
    gitlab: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
      baseUrl: z.string().default('https://gitlab.com/api/v4'),
      groups: z.array(z.string()).optional(),
      projects: z.array(z.string()).optional(),
    }).optional(),
    local: z.object({
      enabled: z.boolean().default(false),
      rootPaths: z.array(z.string()),
      maxDepth: z.number().min(1).max(5).default(3),
    }).optional(),
  }),
  analysis: z.object({
    enableCodeAnalysis: z.boolean().default(true),
    enableDocumentationParsing: z.boolean().default(true),
    enableDependencyAnalysis: z.boolean().default(true),
    filePatterns: z.object({
      dockerfile: z.array(z.string()).default(['Dockerfile*', 'dockerfile*']),
      docker_compose: z.array(z.string()).default(['docker-compose*.yml', 'docker-compose*.yaml']),
      kubernetes: z.array(z.string()).default(['k8s/*.yaml', 'kubernetes/*.yaml', '*.k8s.yaml']),
      package_json: z.array(z.string()).default(['package.json']),
      requirements: z.array(z.string()).default(['requirements*.txt', 'pyproject.toml']),
      pom: z.array(z.string()).default(['pom.xml']),
      cargo: z.array(z.string()).default(['Cargo.toml']),
      go_mod: z.array(z.string()).default(['go.mod']),
      readme: z.array(z.string()).default(['README*', 'readme*']),
      api_spec: z.array(z.string()).default(['openapi*.yaml', 'swagger*.yaml', '*.api.yaml']),
    }),
    confidenceFactors: z.object({
      hasDockerfile: z.number().default(0.3),
      hasKubernetesManifests: z.number().default(0.25),
      hasAPISpec: z.number().default(0.2),
      hasREADME: z.number().default(0.1),
      hasTests: z.number().default(0.1),
      isActivelyMaintained: z.number().default(0.05),
    }),
  }),
  git: z.object({
    cloneTimeout: z.number().min(10000).default(60000),
    analysisTimeout: z.number().min(5000).default(30000),
    tempDirectory: z.string().default('/tmp/discovery-git'),
    cleanupAfterAnalysis: z.boolean().default(true),
  }),
});

type GitRepositoryAnalyzerConfig = z.infer<typeof GitRepositoryAnalyzerConfigSchema>;

// Repository information interface
interface RepositoryInfo {
  provider: 'github' | 'gitlab' | 'local';
  name: string;
  fullName: string;
  url: string;
  cloneUrl?: string;
  defaultBranch: string;
  description?: string;
  topics?: string[];
  language?: string;
  lastActivity: Date;
  isArchived: boolean;
  isFork: boolean;
  owner?: {
    name: string;
    email?: string;
  };
}

// Service pattern definitions
interface ServicePattern {
  name: string;
  type: DiscoveredService['type'];
  patterns: string[];
  confidence: number;
  metadata?: Record<string, any>;
}

export class GitRepositoryAnalyzer extends BaseDiscoverySource {
  private config!: GitRepositoryAnalyzerConfig;
  private githubClient?: Octokit;
  private gitlabClient?: any; // TODO: Add proper GitLab client
  private servicePatterns: ServicePattern[] = [];

  constructor(logger: Logger) {
    super('git-repository-analyzer', '1.0.0', 100, logger);
    this.initializeServicePatterns();
  }

  protected async initializeSource(config: any): Promise<void> {
    this.config = GitRepositoryAnalyzerConfigSchema.parse(config);

    // Initialize GitHub client
    if (this.config.providers.github?.enabled && this.config.providers.github.token) {
      this.githubClient = new Octokit({
        auth: this.config.providers.github.token,
        baseUrl: this.config.providers.github.baseUrl,
      });
    }

    // Initialize GitLab client
    if (this.config.providers.gitlab?.enabled && this.config.providers.gitlab.token) {
      // TODO: Initialize GitLab client
    }

    // Ensure temp directory exists
    await this.ensureTempDirectory();

    this.logger.info('Git Repository Analyzer initialized');
  }

  protected async performDiscovery(): Promise<DiscoveredService[]> {
    const allServices: DiscoveredService[] = [];

    // Discover from GitHub
    if (this.config.providers.github?.enabled) {
      const githubServices = await this.discoverFromGitHub();
      allServices.push(...githubServices);
    }

    // Discover from GitLab
    if (this.config.providers.gitlab?.enabled) {
      const gitlabServices = await this.discoverFromGitLab();
      allServices.push(...gitlabServices);
    }

    // Discover from local repositories
    if (this.config.providers.local?.enabled) {
      const localServices = await this.discoverFromLocal();
      allServices.push(...localServices);
    }

    this.logger.info(`Git repository analysis completed: ${allServices.length} services discovered`);
    return allServices;
  }

  protected async performHealthCheck(): Promise<boolean> {
    try {
      // Check GitHub API connectivity
      if (this.githubClient) {
        await this.githubClient.rest.meta.get();
      }

      // Check temp directory accessibility
      await fs.access(this.config.git.tempDirectory);

      return true;
    } catch (error) {
      this.logger.warn('Git repository analyzer health check failed', error);
      return false;
    }
  }

  protected async disposeSource(): Promise<void> {
    // Cleanup temp directory if configured
    if (this.config.git.cleanupAfterAnalysis) {
      try {
        await fs.rm(this.config.git.tempDirectory, { recursive: true, force: true });
      } catch (error) {
        this.logger.warn('Failed to cleanup temp directory', error);
      }
    }
  }

  // GitHub Discovery Implementation
  private async discoverFromGitHub(): Promise<DiscoveredService[]> {
    if (!this.githubClient) {
      throw new Error('GitHub client not initialized');
    }

    const repositories = await this.getGitHubRepositories();
    const services: DiscoveredService[] = [];

    for (const repo of repositories) {
      try {
        const repoServices = await this.analyzeRepository(repo);
        services.push(...repoServices);
      } catch (error) {
        this.logger.warn(`Failed to analyze repository ${repo.fullName}`, error);
      }
    }

    return services;
  }

  private async getGitHubRepositories(): Promise<RepositoryInfo[]> {
    const repositories: RepositoryInfo[] = [];

    // Get repositories from organizations
    if (this.config.providers.github!.organizations) {
      for (const org of this.config.providers.github!.organizations) {
        const orgRepos = await this.getGitHubOrgRepositories(org);
        repositories.push(...orgRepos);
      }
    }

    // Get specific repositories
    if (this.config.providers.github!.repositories) {
      for (const repoName of this.config.providers.github!.repositories) {
        const [owner, name] = repoName.split('/');
        const repo = await this.getGitHubRepository(owner, name);
        if (repo) {
          repositories.push(repo);
        }
      }
    }

    // Filter repositories
    return repositories.filter(repo => {
      if (this.config.providers.github!.excludeArchived && repo.isArchived) {
        return false;
      }
      if (this.config.providers.github!.excludeForks && repo.isFork) {
        return false;
      }
      return true;
    });
  }

  private async getGitHubOrgRepositories(org: string): Promise<RepositoryInfo[]> {
    const repositories: RepositoryInfo[] = [];
    
    try {
      const iterator = this.githubClient!.paginate.iterator(
        this.githubClient!.rest.repos.listForOrg,
        {
          org,
          type: 'all',
          per_page: 100,
        }
      );

      for await (const response of iterator) {
        for (const repo of response.data) {
          repositories.push(this.mapGitHubRepository(repo));
        }
      }
    } catch (error) {
      this.logger.error(`Failed to fetch repositories for organization ${org}`, error);
    }

    return repositories;
  }

  private async getGitHubRepository(owner: string, repo: string): Promise<RepositoryInfo | null> {
    try {
      const response = await this.githubClient!.rest.repos.get({ owner, repo });
      return this.mapGitHubRepository(response.data);
    } catch (error) {
      this.logger.error(`Failed to fetch repository ${owner}/${repo}`, error);
      return null;
    }
  }

  private mapGitHubRepository(repo: any): RepositoryInfo {
    return {
      provider: 'github',
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch,
      description: repo.description,
      topics: repo.topics,
      language: repo.language,
      lastActivity: new Date(repo.updated_at),
      isArchived: repo.archived,
      isFork: repo.fork,
      owner: {
        name: repo.owner.login,
      },
    };
  }

  // GitLab Discovery Implementation (placeholder)
  private async discoverFromGitLab(): Promise<DiscoveredService[]> {
    // TODO: Implement GitLab discovery
    this.logger.info('GitLab discovery not yet implemented');
    return [];
  }

  // Local Repository Discovery
  private async discoverFromLocal(): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    for (const rootPath of this.config.providers.local!.rootPaths) {
      try {
        const localRepos = await this.findLocalRepositories(rootPath);
        
        for (const repo of localRepos) {
          const repoServices = await this.analyzeRepository(repo);
          services.push(...repoServices);
        }
      } catch (error) {
        this.logger.error(`Failed to discover local repositories in ${rootPath}`, error);
      }
    }

    return services;
  }

  private async findLocalRepositories(rootPath: string, depth = 0): Promise<RepositoryInfo[]> {
    const repositories: RepositoryInfo[] = [];

    if (depth >= this.config.providers.local!.maxDepth) {
      return repositories;
    }

    try {
      const entries = await fs.readdir(rootPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const entryPath = path.join(rootPath, entry.name);
        const gitPath = path.join(entryPath, '.git');

        try {
          await fs.access(gitPath);
          
          // This is a git repository
          const repo = await this.analyzeLocalRepository(entryPath);
          if (repo) {
            repositories.push(repo);
          }
        } catch {
          // Not a git repository, continue searching
          const subRepos = await this.findLocalRepositories(entryPath, depth + 1);
          repositories.push(...subRepos);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to read directory ${rootPath}`, error);
    }

    return repositories;
  }

  private async analyzeLocalRepository(repoPath: string): Promise<RepositoryInfo | null> {
    try {
      const git = simpleGit(repoPath);
      
      // Get basic repository info
      const status = await git.status();
      const remotes = await git.getRemotes(true);
      const log = await git.log({ maxCount: 1 });

      const remote = remotes.find(r => r.name === 'origin');
      const lastCommit = log.latest;

      return {
        provider: 'local',
        name: path.basename(repoPath),
        fullName: repoPath,
        url: remote?.refs?.fetch || repoPath,
        defaultBranch: status.current || 'main',
        lastActivity: lastCommit ? new Date(lastCommit.date) : new Date(),
        isArchived: false,
        isFork: false,
        owner: lastCommit ? {
          name: lastCommit.author_name,
          email: lastCommit.author_email,
        } : undefined,
      };
    } catch (error) {
      this.logger.warn(`Failed to analyze local repository ${repoPath}`, error);
      return null;
    }
  }

  // Repository Analysis Implementation
  private async analyzeRepository(repo: RepositoryInfo): Promise<DiscoveredService[]> {
    this.logger.debug(`Analyzing repository: ${repo.fullName}`);

    let repoPath: string;
    let shouldCleanup = false;

    if (repo.provider === 'local') {
      repoPath = repo.fullName;
    } else {
      // Clone repository to temp directory
      repoPath = await this.cloneRepository(repo);
      shouldCleanup = true;
    }

    try {
      const services = await this.analyzeRepositoryContents(repo, repoPath);
      return services;
    } finally {
      if (shouldCleanup && this.config.git.cleanupAfterAnalysis) {
        await this.cleanupRepository(repoPath);
      }
    }
  }

  private async cloneRepository(repo: RepositoryInfo): Promise<string> {
    if (!repo.cloneUrl) {
      throw new Error(`No clone URL available for repository ${repo.fullName}`);
    }

    const repoDir = path.join(
      this.config.git.tempDirectory,
      repo.provider,
      repo.fullName.replace('/', '_')
    );

    try {
      // Remove existing directory if it exists
      await fs.rm(repoDir, { recursive: true, force: true });
      
      // Clone repository
      const git = simpleGit();
      await git.clone(repo.cloneUrl, repoDir, ['--depth', '1', '--single-branch']);

      this.logger.debug(`Cloned repository ${repo.fullName} to ${repoDir}`);
      return repoDir;

    } catch (error) {
      this.logger.error(`Failed to clone repository ${repo.fullName}`, error);
      throw error;
    }
  }

  private async analyzeRepositoryContents(
    repo: RepositoryInfo,
    repoPath: string
  ): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    // Analyze for different service patterns
    for (const pattern of this.servicePatterns) {
      const matchedFiles = await this.findMatchingFiles(repoPath, pattern.patterns);
      
      if (matchedFiles.length > 0) {
        const service = await this.createServiceFromPattern(repo, repoPath, pattern, matchedFiles);
        if (service) {
          services.push(service);
        }
      }
    }

    // If no patterns matched, try to infer service from repository structure
    if (services.length === 0) {
      const inferredService = await this.inferServiceFromStructure(repo, repoPath);
      if (inferredService) {
        services.push(inferredService);
      }
    }

    return services;
  }

  private async createServiceFromPattern(
    repo: RepositoryInfo,
    repoPath: string,
    pattern: ServicePattern,
    matchedFiles: string[]
  ): Promise<DiscoveredService | null> {
    try {
      // Calculate confidence based on matched patterns and repository attributes
      let confidence = pattern.confidence;
      
      // Analyze repository for confidence factors
      const factors = await this.calculateConfidenceFactors(repoPath);
      confidence += Object.values(factors).reduce((sum, factor) => sum + factor, 0);
      confidence = Math.min(confidence, 1.0);

      // Extract metadata from repository
      const metadata = await this.extractRepositoryMetadata(repo, repoPath, matchedFiles);

      // Determine service endpoints
      const endpoints = await this.extractServiceEndpoints(repoPath, pattern);

      // Extract dependencies
      const dependencies = await this.extractDependencies(repoPath);

      const service = this.createService({
        id: this.generateServiceId(repo.provider, repo.fullName),
        name: this.extractServiceName(repo, metadata),
        type: pattern.type,
        confidence,
        metadata: {
          ...metadata,
          repository: {
            url: repo.url,
            provider: repo.provider,
            defaultBranch: repo.defaultBranch,
            language: repo.language,
            topics: repo.topics,
            lastActivity: repo.lastActivity,
          },
          pattern: {
            name: pattern.name,
            matchedFiles: matchedFiles,
          },
        },
        endpoints,
        dependencies,
        owner: repo.owner ? {
          individual: repo.owner.name,
          email: repo.owner.email,
        } : undefined,
        repository: {
          url: repo.url,
          branch: repo.defaultBranch,
        },
      });

      return service;

    } catch (error) {
      this.logger.error(`Failed to create service from pattern ${pattern.name}`, error);
      return null;
    }
  }

  private async findMatchingFiles(repoPath: string, patterns: string[]): Promise<string[]> {
    const matchedFiles: string[] = [];

    for (const pattern of patterns) {
      try {
        // Simple file pattern matching (could be enhanced with glob patterns)
        const files = await this.findFiles(repoPath, pattern);
        matchedFiles.push(...files);
      } catch (error) {
        this.logger.debug(`Pattern ${pattern} matching failed`, error);
      }
    }

    return [...new Set(matchedFiles)]; // Remove duplicates
  }

  private async findFiles(repoPath: string, pattern: string): Promise<string[]> {
    const files: string[] = [];
    
    // Recursive file search (simplified implementation)
    const searchDir = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const entryPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            // Skip common non-source directories
            if (['node_modules', '.git', 'vendor', 'target', 'dist', 'build'].includes(entry.name)) {
              continue;
            }
            await searchDir(entryPath);
          } else if (entry.isFile()) {
            // Simple pattern matching (could use minimatch for glob patterns)
            if (this.matchesPattern(entry.name, pattern)) {
              files.push(path.relative(repoPath, entryPath));
            }
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    };

    await searchDir(repoPath);
    return files;
  }

  private matchesPattern(filename: string, pattern: string): boolean {
    // Simple pattern matching (case-insensitive)
    pattern = pattern.toLowerCase().replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(filename.toLowerCase());
  }

  private async extractRepositoryMetadata(
    repo: RepositoryInfo,
    repoPath: string,
    matchedFiles: string[]
  ): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {
      description: repo.description,
      language: repo.language,
      topics: repo.topics,
      lastActivity: repo.lastActivity,
    };

    // Extract README content
    if (this.config.analysis.enableDocumentationParsing) {
      const readme = await this.extractREADME(repoPath);
      if (readme) {
        metadata.readme = readme;
      }
    }

    // Extract package information
    if (this.config.analysis.enableDependencyAnalysis) {
      const packageInfo = await this.extractPackageInfo(repoPath);
      if (packageInfo) {
        metadata.package = packageInfo;
      }
    }

    // Extract Docker configuration
    const dockerInfo = await this.extractDockerInfo(repoPath);
    if (dockerInfo) {
      metadata.docker = dockerInfo;
    }

    // Extract Kubernetes configuration
    const k8sInfo = await this.extractKubernetesInfo(repoPath);
    if (k8sInfo) {
      metadata.kubernetes = k8sInfo;
    }

    return metadata;
  }

  private async extractREADME(repoPath: string): Promise<string | null> {
    const readmePatterns = this.config.analysis.filePatterns.readme;
    
    for (const pattern of readmePatterns) {
      const files = await this.findFiles(repoPath, pattern);
      
      if (files.length > 0) {
        try {
          const readmePath = path.join(repoPath, files[0]);
          const content = await fs.readFile(readmePath, 'utf-8');
          return content;
        } catch (error) {
          this.logger.debug(`Failed to read README file ${files[0]}`, error);
        }
      }
    }

    return null;
  }

  private async extractPackageInfo(repoPath: string): Promise<any> {
    // Extract package.json
    try {
      const packageJsonPath = path.join(repoPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return {
        type: 'npm',
        name: packageJson.name,
        version: packageJson.version,
        dependencies: Object.keys(packageJson.dependencies || {}),
        devDependencies: Object.keys(packageJson.devDependencies || {}),
        scripts: packageJson.scripts,
      };
    } catch {
      // Try other package managers
    }

    // TODO: Add support for other package managers (pip, maven, cargo, go modules)

    return null;
  }

  private async extractDockerInfo(repoPath: string): Promise<any> {
    const dockerFiles = await this.findFiles(repoPath, 'Dockerfile*');
    const composeFiles = await this.findFiles(repoPath, 'docker-compose*.yml');

    if (dockerFiles.length === 0 && composeFiles.length === 0) {
      return null;
    }

    const dockerInfo: any = {};

    if (dockerFiles.length > 0) {
      dockerInfo.hasDockerfile = true;
      dockerInfo.dockerfiles = dockerFiles;
    }

    if (composeFiles.length > 0) {
      dockerInfo.hasDockerCompose = true;
      dockerInfo.composeFiles = composeFiles;
    }

    return dockerInfo;
  }

  private async extractKubernetesInfo(repoPath: string): Promise<any> {
    const k8sFiles = await this.findMatchingFiles(repoPath, this.config.analysis.filePatterns.kubernetes);

    if (k8sFiles.length === 0) {
      return null;
    }

    return {
      hasKubernetesManifests: true,
      manifests: k8sFiles,
    };
  }

  private async extractServiceEndpoints(repoPath: string, pattern: ServicePattern): Promise<DiscoveredService['endpoints']> {
    const endpoints: DiscoveredService['endpoints'] = [];

    // Extract endpoints based on service type and configuration
    if (pattern.type === 'api' || pattern.type === 'web') {
      // Look for common port configurations
      const ports = await this.extractServicePorts(repoPath);
      
      for (const port of ports) {
        endpoints.push(createHttpEndpoint(`http://localhost:${port}`));
      }
    }

    return endpoints.length > 0 ? endpoints : undefined;
  }

  private async extractServicePorts(repoPath: string): Promise<number[]> {
    const ports: number[] = [];

    // Check Docker configuration
    const dockerFiles = await this.findFiles(repoPath, 'Dockerfile*');
    for (const dockerFile of dockerFiles) {
      const dockerPorts = await this.extractDockerPorts(path.join(repoPath, dockerFile));
      ports.push(...dockerPorts);
    }

    // Check docker-compose files
    const composeFiles = await this.findFiles(repoPath, 'docker-compose*.yml');
    for (const composeFile of composeFiles) {
      const composePorts = await this.extractComposePorts(path.join(repoPath, composeFile));
      ports.push(...composePorts);
    }

    // Check package.json scripts
    const packageInfo = await this.extractPackageInfo(repoPath);
    if (packageInfo?.scripts) {
      const scriptPorts = this.extractPortsFromScripts(packageInfo.scripts);
      ports.push(...scriptPorts);
    }

    return [...new Set(ports)]; // Remove duplicates
  }

  private async extractDockerPorts(dockerfilePath: string): Promise<number[]> {
    try {
      const content = await fs.readFile(dockerfilePath, 'utf-8');
      const exposeMatches = content.match(/EXPOSE\s+(\d+)/gi);
      
      if (exposeMatches) {
        return exposeMatches.map(match => {
          const port = match.match(/\d+/);
          return port ? parseInt(port[0], 10) : 0;
        }).filter(port => port > 0);
      }
    } catch (error) {
      this.logger.debug(`Failed to read Dockerfile ${dockerfilePath}`, error);
    }

    return [];
  }

  private async extractComposePorts(composePath: string): Promise<number[]> {
    // TODO: Parse docker-compose.yml for port mappings
    return [];
  }

  private extractPortsFromScripts(scripts: Record<string, string>): number[] {
    const ports: number[] = [];
    
    for (const script of Object.values(scripts)) {
      // Look for common port patterns in npm scripts
      const portMatches = script.match(/(?:PORT|port)[\s=:]+(\d+)/gi);
      
      if (portMatches) {
        for (const match of portMatches) {
          const port = match.match(/\d+/);
          if (port) {
            ports.push(parseInt(port[0], 10));
          }
        }
      }
    }

    return ports;
  }

  private async extractDependencies(repoPath: string): Promise<string[]> {
    // TODO: Extract service dependencies from various sources
    // - Package manager dependencies
    // - Infrastructure as code files
    // - Environment variables
    // - Configuration files
    return [];
  }

  private extractServiceName(repo: RepositoryInfo, metadata: Record<string, any>): string {
    // Try to extract service name from package.json
    if (metadata.package?.name) {
      return metadata.package.name;
    }

    // Use repository name
    return repo.name;
  }

  private async calculateConfidenceFactors(repoPath: string): Promise<Record<string, number>> {
    const factors: Record<string, number> = {};

    // Check for Dockerfile
    const dockerFiles = await this.findFiles(repoPath, 'Dockerfile*');
    if (dockerFiles.length > 0) {
      factors.hasDockerfile = this.config.analysis.confidenceFactors.hasDockerfile;
    }

    // Check for Kubernetes manifests
    const k8sFiles = await this.findMatchingFiles(repoPath, this.config.analysis.filePatterns.kubernetes);
    if (k8sFiles.length > 0) {
      factors.hasKubernetesManifests = this.config.analysis.confidenceFactors.hasKubernetesManifests;
    }

    // Check for API specifications
    const apiSpecs = await this.findMatchingFiles(repoPath, this.config.analysis.filePatterns.api_spec);
    if (apiSpecs.length > 0) {
      factors.hasAPISpec = this.config.analysis.confidenceFactors.hasAPISpec;
    }

    // Check for README
    const readmeFiles = await this.findMatchingFiles(repoPath, this.config.analysis.filePatterns.readme);
    if (readmeFiles.length > 0) {
      factors.hasREADME = this.config.analysis.confidenceFactors.hasREADME;
    }

    // Check for tests
    const testFiles = await this.findFiles(repoPath, '*test*');
    if (testFiles.length > 0) {
      factors.hasTests = this.config.analysis.confidenceFactors.hasTests;
    }

    return factors;
  }

  private async inferServiceFromStructure(
    repo: RepositoryInfo,
    repoPath: string
  ): Promise<DiscoveredService | null> {
    // Fallback inference when no specific patterns match
    const metadata = await this.extractRepositoryMetadata(repo, repoPath, []);
    
    const serviceType = this.inferServiceType({
      language: repo.language,
      description: repo.description,
      topics: repo.topics,
      ...metadata,
    });

    const confidence = this.calculateConfidence({
      hasDocumentation: metadata.readme != null,
      hasRepository: true,
      isActive: repo.lastActivity > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
    });

    return this.createService({
      id: this.generateServiceId(repo.provider, repo.fullName),
      name: repo.name,
      type: serviceType,
      confidence,
      metadata: {
        ...metadata,
        repository: {
          url: repo.url,
          provider: repo.provider,
          defaultBranch: repo.defaultBranch,
          language: repo.language,
          topics: repo.topics,
          lastActivity: repo.lastActivity,
        },
        inferred: true,
      },
      owner: repo.owner ? {
        individual: repo.owner.name,
        email: repo.owner.email,
      } : undefined,
      repository: {
        url: repo.url,
        branch: repo.defaultBranch,
      },
    });
  }

  private async ensureTempDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.git.tempDirectory, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create temp directory', error);
      throw error;
    }
  }

  private async cleanupRepository(repoPath: string): Promise<void> {
    try {
      await fs.rm(repoPath, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(`Failed to cleanup repository ${repoPath}`, error);
    }
  }

  private initializeServicePatterns(): void {
    this.servicePatterns = [
      {
        name: 'Node.js API Service',
        type: 'api',
        patterns: ['package.json', 'server.js', 'app.js', 'index.js'],
        confidence: 0.8,
        metadata: { framework: 'nodejs' },
      },
      {
        name: 'Python API Service',
        type: 'api',
        patterns: ['requirements*.txt', 'app.py', 'main.py', 'api.py'],
        confidence: 0.8,
        metadata: { framework: 'python' },
      },
      {
        name: 'Java Spring Service',
        type: 'api',
        patterns: ['pom.xml', 'build.gradle', 'Application.java'],
        confidence: 0.8,
        metadata: { framework: 'spring' },
      },
      {
        name: 'Go Service',
        type: 'api',
        patterns: ['go.mod', 'main.go'],
        confidence: 0.8,
        metadata: { framework: 'go' },
      },
      {
        name: 'React Web App',
        type: 'web',
        patterns: ['package.json', 'src/App.js', 'public/index.html'],
        confidence: 0.7,
        metadata: { framework: 'react' },
      },
      {
        name: 'Next.js Web App',
        type: 'web',
        patterns: ['package.json', 'next.config.js', 'pages/'],
        confidence: 0.8,
        metadata: { framework: 'nextjs' },
      },
      {
        name: 'Docker Service',
        type: 'microservice',
        patterns: ['Dockerfile'],
        confidence: 0.6,
        metadata: { containerized: true },
      },
      {
        name: 'Kubernetes Service',
        type: 'microservice',
        patterns: ['k8s/*.yaml', 'kubernetes/*.yaml'],
        confidence: 0.7,
        metadata: { orchestration: 'kubernetes' },
      },
    ];
  }
}