/**
 * CI/CD Pipeline Scanner
 * 
 * Advanced discovery source that analyzes CI/CD pipelines to discover services
 * based on build artifacts, deployment configurations, and pipeline metadata.
 * Supports GitHub Actions, GitLab CI, Jenkins, CircleCI, Azure DevOps, and more.
 */

import { Octokit } from '@octokit/rest';
import { Logger } from 'winston';
import { z } from 'zod';
import axios from 'axios';
import { BaseDiscoverySource, createHttpEndpoint } from '../core/base-source';
import { DiscoveredService } from '../core/discovery-engine';

// Configuration schema
const CICDPipelineScannerConfigSchema = z.object({
  providers: z.object({
    github_actions: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
      baseUrl: z.string().default('https://api.github.com'),
      organizations: z.array(z.string()).optional(),
      repositories: z.array(z.string()).optional(),
    }).optional(),
    gitlab_ci: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
      baseUrl: z.string().default('https://gitlab.com/api/v4'),
      groups: z.array(z.string()).optional(),
      projects: z.array(z.string()).optional(),
    }).optional(),
    jenkins: z.object({
      enabled: z.boolean().default(false),
      url: z.string().optional(),
      username: z.string().optional(),
      token: z.string().optional(),
      jobs: z.array(z.string()).optional(),
    }).optional(),
    circleci: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
      baseUrl: z.string().default('https://circleci.com/api/v2'),
      organizations: z.array(z.string()).optional(),
    }).optional(),
    azure_devops: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
      organization: z.string().optional(),
      baseUrl: z.string().default('https://dev.azure.com'),
      projects: z.array(z.string()).optional(),
    }).optional(),
  }),
  discovery: z.object({
    lookbackDays: z.number().min(1).max(365).default(30),
    minBuilds: z.number().min(1).default(1),
    includeFailedBuilds: z.boolean().default(false),
    artifactPatterns: z.array(z.string()).default([
      '*.jar', '*.war', '*.ear', // Java
      '*.tar.gz', '*.zip', // Archives
      'Dockerfile', 'docker-compose.yml', // Docker
      '*.json', '*.yaml', '*.yml', // Configuration
      '*.js', '*.ts', 'package.json', // Node.js
      '*.py', 'requirements.txt', // Python
      '*.go', 'go.mod', // Go
    ]),
    deploymentPatterns: z.array(z.string()).default([
      'deploy', 'deployment', 'release', 'production', 'staging'
    ]),
  }),
  analysis: z.object({
    extractEnvironments: z.boolean().default(true),
    inferServiceType: z.boolean().default(true),
    trackDeploymentHistory: z.boolean().default(true),
    analyzeDependencies: z.boolean().default(true),
  }),
});

type CICDPipelineScannerConfig = z.infer<typeof CICDPipelineScannerConfigSchema>;

// Pipeline interfaces
interface PipelineInfo {
  id: string;
  name: string;
  repository: string;
  branch: string;
  provider: string;
  status: string;
  lastRun: Date;
  url: string;
  metadata: Record<string, any>;
}

interface BuildInfo {
  id: string;
  pipelineId: string;
  number: number;
  status: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  commit: string;
  branch: string;
  artifacts: ArtifactInfo[];
  environment?: string;
  metadata: Record<string, any>;
}

interface ArtifactInfo {
  name: string;
  type: string;
  path: string;
  size?: number;
  url?: string;
  checksum?: string;
  metadata: Record<string, any>;
}

interface DeploymentInfo {
  id: string;
  buildId: string;
  environment: string;
  status: string;
  deployTime: Date;
  version?: string;
  url?: string;
  metadata: Record<string, any>;
}

export class CICDPipelineScanner extends BaseDiscoverySource {
  private config!: CICDPipelineScannerConfig;
  private githubClient?: Octokit;
  private gitlabClient?: any;
  private jenkinsClient?: any;
  private circleciClient?: any;
  private azureDevOpsClient?: any;

  constructor(logger: Logger) {
    super('cicd-pipeline-scanner', '1.0.0', 70, logger);
  }

  protected async initializeSource(config: any): Promise<void> {
    this.config = CICDPipelineScannerConfigSchema.parse(config);

    // Initialize GitHub Actions client
    if (this.config.providers.github_actions?.enabled && this.config.providers.github_actions.token) {
      this.githubClient = new Octokit({
        auth: this.config.providers.github_actions.token,
        baseUrl: this.config.providers.github_actions.baseUrl,
      });
    }

    // Initialize other clients (simplified for demo)
    // In production, you'd implement full clients for each provider

    this.logger.info('CI/CD pipeline scanner initialized');
  }

  protected async performDiscovery(): Promise<DiscoveredService[]> {
    const allServices: DiscoveredService[] = [];

    // Discover from GitHub Actions
    if (this.config.providers.github_actions?.enabled) {
      const githubServices = await this.discoverFromGitHubActions();
      allServices.push(...githubServices);
    }

    // Discover from GitLab CI
    if (this.config.providers.gitlab_ci?.enabled) {
      const gitlabServices = await this.discoverFromGitLabCI();
      allServices.push(...gitlabServices);
    }

    // Discover from Jenkins
    if (this.config.providers.jenkins?.enabled) {
      const jenkinsServices = await this.discoverFromJenkins();
      allServices.push(...jenkinsServices);
    }

    // Discover from CircleCI
    if (this.config.providers.circleci?.enabled) {
      const circleciServices = await this.discoverFromCircleCI();
      allServices.push(...circleciServices);
    }

    // Discover from Azure DevOps
    if (this.config.providers.azure_devops?.enabled) {
      const azureServices = await this.discoverFromAzureDevOps();
      allServices.push(...azureServices);
    }

    this.logger.info(`CI/CD pipeline discovery completed: ${allServices.length} services found`);
    return allServices;
  }

  protected async performHealthCheck(): Promise<boolean> {
    try {
      let healthyCount = 0;
      let totalChecks = 0;

      // Check GitHub Actions connectivity
      if (this.githubClient) {
        totalChecks++;
        try {
          await this.githubClient.rest.meta.get();
          healthyCount++;
        } catch (error) {
          this.logger.debug('GitHub Actions health check failed', error);
        }
      }

      // Add health checks for other providers

      return healthyCount > 0 || totalChecks === 0;
    } catch (error) {
      this.logger.warn('CI/CD pipeline scanner health check failed', error);
      return false;
    }
  }

  protected async disposeSource(): Promise<void> {
    // Cleanup clients
    this.githubClient = undefined;
    this.gitlabClient = undefined;
    this.jenkinsClient = undefined;
    this.circleciClient = undefined;
    this.azureDevOpsClient = undefined;
  }

  // GitHub Actions Discovery
  private async discoverFromGitHubActions(): Promise<DiscoveredService[]> {
    if (!this.githubClient) {
      throw new Error('GitHub client not initialized');
    }

    const services: DiscoveredService[] = [];
    const repositories = await this.getGitHubRepositories();

    for (const repo of repositories) {
      try {
        const repoServices = await this.analyzeGitHubRepository(repo);
        services.push(...repoServices);
      } catch (error) {
        this.logger.warn(`Failed to analyze GitHub repository ${repo}`, error);
      }
    }

    return services;
  }

  private async getGitHubRepositories(): Promise<string[]> {
    const repositories: string[] = [];

    // Get repositories from organizations
    if (this.config.providers.github_actions!.organizations) {
      for (const org of this.config.providers.github_actions!.organizations) {
        const orgRepos = await this.getGitHubOrgRepositories(org);
        repositories.push(...orgRepos);
      }
    }

    // Get specific repositories
    if (this.config.providers.github_actions!.repositories) {
      repositories.push(...this.config.providers.github_actions!.repositories);
    }

    return repositories;
  }

  private async getGitHubOrgRepositories(org: string): Promise<string[]> {
    const repositories: string[] = [];
    
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
          repositories.push(repo.full_name);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to fetch repositories for organization ${org}`, error);
    }

    return repositories;
  }

  private async analyzeGitHubRepository(repoFullName: string): Promise<DiscoveredService[]> {
    const [owner, repo] = repoFullName.split('/');
    const services: DiscoveredService[] = [];

    try {
      // Get workflows
      const workflowsResponse = await this.githubClient!.rest.actions.listRepoWorkflows({
        owner,
        repo,
      });

      for (const workflow of workflowsResponse.data.workflows) {
        // Get recent workflow runs
        const runsResponse = await this.githubClient!.rest.actions.listWorkflowRuns({
          owner,
          repo,
          workflow_id: workflow.id,
          per_page: 20, // Get recent runs
        });

        const builds = await this.processGitHubWorkflowRuns(workflow, runsResponse.data.workflow_runs);
        
        if (builds.length >= this.config.discovery.minBuilds) {
          const service = await this.createServiceFromPipeline({
            id: `${workflow.id}`,
            name: workflow.name,
            repository: repoFullName,
            branch: workflow.path.includes('main') ? 'main' : 'master', // Simplified branch detection
            provider: 'github-actions',
            status: workflow.state,
            lastRun: new Date(runsResponse.data.workflow_runs[0]?.created_at || new Date()),
            url: workflow.html_url,
            metadata: {
              path: workflow.path,
              nodeId: workflow.node_id,
              badgeUrl: workflow.badge_url,
            },
          }, builds);

          if (service) {
            services.push(service);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to analyze GitHub repository ${repoFullName}`, error);
    }

    return services;
  }

  private async processGitHubWorkflowRuns(workflow: any, runs: any[]): Promise<BuildInfo[]> {
    const builds: BuildInfo[] = [];
    const cutoffDate = new Date(Date.now() - (this.config.discovery.lookbackDays * 24 * 60 * 60 * 1000));

    for (const run of runs) {
      const runDate = new Date(run.created_at);
      if (runDate < cutoffDate) continue;

      // Skip failed builds if not configured to include them
      if (!this.config.discovery.includeFailedBuilds && run.conclusion !== 'success') {
        continue;
      }

      // Get artifacts for this run
      const artifacts = await this.getGitHubRunArtifacts(run.repository.owner.login, run.repository.name, run.id);

      builds.push({
        id: run.id.toString(),
        pipelineId: workflow.id.toString(),
        number: run.run_number,
        status: run.conclusion || run.status,
        startTime: new Date(run.created_at),
        endTime: run.updated_at ? new Date(run.updated_at) : undefined,
        duration: this.calculateDuration(run.created_at, run.updated_at),
        commit: run.head_sha,
        branch: run.head_branch,
        artifacts,
        environment: this.inferEnvironmentFromRun(run),
        metadata: {
          event: run.event,
          actor: run.actor?.login,
          workflowId: run.workflow_id,
          checkSuiteId: run.check_suite_id,
          url: run.html_url,
        },
      });
    }

    return builds;
  }

  private async getGitHubRunArtifacts(owner: string, repo: string, runId: number): Promise<ArtifactInfo[]> {
    try {
      const artifactsResponse = await this.githubClient!.rest.actions.listWorkflowRunArtifacts({
        owner,
        repo,
        run_id: runId,
      });

      return artifactsResponse.data.artifacts.map(artifact => ({
        name: artifact.name,
        type: this.inferArtifactType(artifact.name),
        path: artifact.name, // GitHub doesn't provide full path
        size: artifact.size_in_bytes,
        url: artifact.archive_download_url,
        metadata: {
          id: artifact.id,
          nodeId: artifact.node_id,
          createdAt: artifact.created_at,
          updatedAt: artifact.updated_at,
          expired: artifact.expired,
        },
      }));
    } catch (error) {
      this.logger.debug(`Failed to get artifacts for run ${runId}`, error);
      return [];
    }
  }

  // GitLab CI Discovery (simplified implementation)
  private async discoverFromGitLabCI(): Promise<DiscoveredService[]> {
    // TODO: Implement GitLab CI discovery
    this.logger.info('GitLab CI discovery not yet implemented');
    return [];
  }

  // Jenkins Discovery (simplified implementation)
  private async discoverFromJenkins(): Promise<DiscoveredService[]> {
    // TODO: Implement Jenkins discovery
    this.logger.info('Jenkins discovery not yet implemented');
    return [];
  }

  // CircleCI Discovery (simplified implementation)
  private async discoverFromCircleCI(): Promise<DiscoveredService[]> {
    // TODO: Implement CircleCI discovery
    this.logger.info('CircleCI discovery not yet implemented');
    return [];
  }

  // Azure DevOps Discovery (simplified implementation)
  private async discoverFromAzureDevOps(): Promise<DiscoveredService[]> {
    // TODO: Implement Azure DevOps discovery
    this.logger.info('Azure DevOps discovery not yet implemented');
    return [];
  }

  // Service creation from pipeline data
  private async createServiceFromPipeline(
    pipeline: PipelineInfo,
    builds: BuildInfo[]
  ): Promise<DiscoveredService | null> {
    try {
      // Determine service type from pipeline artifacts and configuration
      const serviceType = this.inferServiceTypeFromPipeline(pipeline, builds);
      
      // Extract service name from pipeline/repository
      const serviceName = this.extractServiceName(pipeline);
      
      // Analyze deployment environments
      const environments = this.extractDeploymentEnvironments(builds);
      
      // Calculate confidence based on pipeline completeness and activity
      const confidence = this.calculatePipelineConfidence(pipeline, builds);
      
      // Extract endpoints from deployments
      const endpoints = this.extractEndpointsFromBuilds(builds);
      
      // Extract owner from repository/pipeline metadata
      const owner = this.extractOwnerFromPipeline(pipeline);

      // Get latest successful build for metadata
      const latestBuild = builds.find(b => b.status === 'success') || builds[0];

      const service = this.createService({
        id: this.generateServiceId(pipeline.provider, pipeline.id),
        name: serviceName,
        type: serviceType,
        confidence,
        metadata: {
          pipeline: {
            provider: pipeline.provider,
            name: pipeline.name,
            repository: pipeline.repository,
            branch: pipeline.branch,
            url: pipeline.url,
            lastRun: pipeline.lastRun,
            status: pipeline.status,
          },
          deployment: {
            environments,
            totalBuilds: builds.length,
            successfulBuilds: builds.filter(b => b.status === 'success').length,
            latestBuild: latestBuild ? {
              number: latestBuild.number,
              status: latestBuild.status,
              commit: latestBuild.commit,
              branch: latestBuild.branch,
              startTime: latestBuild.startTime,
              duration: latestBuild.duration,
            } : undefined,
            artifacts: latestBuild?.artifacts.map(a => ({
              name: a.name,
              type: a.type,
              size: a.size,
            })),
          },
          ...pipeline.metadata,
        },
        endpoints,
        owner,
        repository: {
          url: this.convertToRepositoryUrl(pipeline.repository, pipeline.provider),
          branch: pipeline.branch,
        },
        deployment: {
          environment: environments.length > 0 ? environments[0] : 'unknown',
        },
      });

      return service;

    } catch (error) {
      this.logger.error(`Failed to create service from pipeline ${pipeline.id}`, error);
      return null;
    }
  }

  // Helper methods
  private inferServiceTypeFromPipeline(pipeline: PipelineInfo, builds: BuildInfo[]): DiscoveredService['type'] {
    // Analyze artifacts and pipeline configuration to infer service type
    const artifacts = builds.flatMap(b => b.artifacts);
    
    // Check for common artifact patterns
    const hasDockerArtifacts = artifacts.some(a => 
      a.name.includes('docker') || a.type === 'docker' || a.name.includes('Dockerfile')
    );
    
    const hasJavaArtifacts = artifacts.some(a => 
      a.name.endsWith('.jar') || a.name.endsWith('.war') || a.name.endsWith('.ear')
    );
    
    const hasWebArtifacts = artifacts.some(a => 
      a.name.includes('dist') || a.name.includes('build') || a.type === 'web'
    );
    
    const hasFunctionArtifacts = artifacts.some(a => 
      a.name.includes('lambda') || a.name.includes('function') || a.type === 'function'
    );

    // Check pipeline names and repository names for type hints
    const pipelineName = pipeline.name.toLowerCase();
    const repoName = pipeline.repository.toLowerCase();
    
    if (hasFunctionArtifacts || pipelineName.includes('function') || pipelineName.includes('lambda')) {
      return 'function';
    }
    
    if (hasWebArtifacts || pipelineName.includes('web') || pipelineName.includes('frontend') || pipelineName.includes('ui')) {
      return 'web';
    }
    
    if (pipelineName.includes('api') || repoName.includes('api')) {
      return 'api';
    }
    
    if (pipelineName.includes('database') || pipelineName.includes('db') || repoName.includes('database')) {
      return 'database';
    }
    
    if (hasDockerArtifacts || hasJavaArtifacts) {
      return 'microservice';
    }

    return 'microservice'; // Default fallback
  }

  private extractServiceName(pipeline: PipelineInfo): string {
    // Extract meaningful service name from pipeline/repository
    const repoName = pipeline.repository.split('/').pop() || pipeline.name;
    
    // Clean up common suffixes
    let serviceName = repoName
      .replace(/-service$/, '')
      .replace(/-api$/, '')
      .replace(/-app$/, '')
      .replace(/\.git$/, '');

    return serviceName || pipeline.name;
  }

  private extractDeploymentEnvironments(builds: BuildInfo[]): string[] {
    const environments = new Set<string>();
    
    for (const build of builds) {
      if (build.environment) {
        environments.add(build.environment);
      }
      
      // Look for environment indicators in artifacts or metadata
      for (const artifact of build.artifacts) {
        for (const pattern of this.config.discovery.deploymentPatterns) {
          if (artifact.name.toLowerCase().includes(pattern)) {
            // Try to extract environment from artifact name
            const envMatch = artifact.name.match(/(prod|production|staging|stage|dev|development|test)/i);
            if (envMatch) {
              environments.add(envMatch[1].toLowerCase());
            }
          }
        }
      }
    }
    
    return Array.from(environments);
  }

  private calculatePipelineConfidence(pipeline: PipelineInfo, builds: BuildInfo[]): number {
    let confidence = 0.5; // Base confidence for CI/CD pipelines
    
    // Recent activity
    const daysSinceLastRun = (Date.now() - pipeline.lastRun.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastRun <= 7) {
      confidence += 0.2;
    } else if (daysSinceLastRun <= 30) {
      confidence += 0.1;
    }
    
    // Build success rate
    const successfulBuilds = builds.filter(b => b.status === 'success').length;
    const successRate = builds.length > 0 ? successfulBuilds / builds.length : 0;
    confidence += successRate * 0.15;
    
    // Has artifacts
    const hasArtifacts = builds.some(b => b.artifacts.length > 0);
    if (hasArtifacts) {
      confidence += 0.1;
    }
    
    // Multiple environments
    const environments = this.extractDeploymentEnvironments(builds);
    if (environments.length > 1) {
      confidence += 0.05;
    }
    
    return Math.min(confidence, 1.0);
  }

  private extractEndpointsFromBuilds(builds: BuildInfo[]): DiscoveredService['endpoints'] {
    const endpoints: DiscoveredService['endpoints'] = [];
    
    // Look for deployment URLs in build metadata
    for (const build of builds) {
      // Check for common deployment URL patterns in metadata
      const metadata = JSON.stringify(build.metadata).toLowerCase();
      
      const urlMatches = metadata.match(/https?:\/\/[^\s"']+/g);
      if (urlMatches) {
        for (const url of urlMatches) {
          // Filter out common non-service URLs
          if (!url.includes('github.com') && 
              !url.includes('gitlab.com') && 
              !url.includes('circleci.com') && 
              !url.includes('jenkins')) {
            endpoints.push(createHttpEndpoint(url));
          }
        }
      }
    }
    
    // Remove duplicates
    const uniqueEndpoints = endpoints.filter((endpoint, index, self) => 
      self.findIndex(e => e.url === endpoint.url) === index
    );
    
    return uniqueEndpoints.length > 0 ? uniqueEndpoints : undefined;
  }

  private extractOwnerFromPipeline(pipeline: PipelineInfo): DiscoveredService['owner'] | undefined {
    // Extract owner from repository name (organization/repo)
    const parts = pipeline.repository.split('/');
    if (parts.length >= 2) {
      const org = parts[0];
      return { team: org };
    }
    
    return undefined;
  }

  private inferEnvironmentFromRun(run: any): string | undefined {
    // Look for environment indicators in run data
    const runData = JSON.stringify(run).toLowerCase();
    
    if (runData.includes('production') || runData.includes('prod')) {
      return 'production';
    }
    if (runData.includes('staging') || runData.includes('stage')) {
      return 'staging';
    }
    if (runData.includes('development') || runData.includes('dev')) {
      return 'development';
    }
    if (runData.includes('test') || runData.includes('testing')) {
      return 'testing';
    }
    
    return undefined;
  }

  private inferArtifactType(artifactName: string): string {
    const name = artifactName.toLowerCase();
    
    if (name.includes('docker') || name.includes('image')) {
      return 'docker';
    }
    if (name.endsWith('.jar') || name.endsWith('.war') || name.endsWith('.ear')) {
      return 'java';
    }
    if (name.endsWith('.tar.gz') || name.endsWith('.zip')) {
      return 'archive';
    }
    if (name.includes('dist') || name.includes('build')) {
      return 'web';
    }
    if (name.includes('test') || name.includes('coverage')) {
      return 'test';
    }
    
    return 'artifact';
  }

  private calculateDuration(startTime: string, endTime?: string): number | undefined {
    if (!endTime) return undefined;
    
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    
    return Math.floor((end - start) / 1000); // Duration in seconds
  }

  private convertToRepositoryUrl(repoName: string, provider: string): string {
    switch (provider) {
      case 'github-actions':
        return `https://github.com/${repoName}`;
      case 'gitlab-ci':
        return `https://gitlab.com/${repoName}`;
      default:
        return repoName;
    }
  }
}