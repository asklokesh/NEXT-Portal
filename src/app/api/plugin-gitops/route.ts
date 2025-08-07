import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import yaml from 'js-yaml';

const execAsync = promisify(exec);

interface GitOpsConfig {
  id: string;
  pluginId: string;
  repository: GitRepository;
  environments: Environment[];
  pipeline: DeploymentPipeline;
  monitoring: MonitoringConfig;
  rollback: RollbackPolicy;
  notifications: NotificationConfig;
}

interface GitRepository {
  url: string;
  branch: string;
  path: string;
  credentials: {
    type: 'ssh' | 'token' | 'basic';
    value: string;
  };
  webhooks: Webhook[];
}

interface Environment {
  name: string;
  type: 'development' | 'staging' | 'production';
  cluster: string;
  namespace: string;
  branch: string;
  autoSync: boolean;
  syncPolicy: SyncPolicy;
  healthChecks: HealthCheck[];
  approvals: ApprovalPolicy;
}

interface DeploymentPipeline {
  stages: PipelineStage[];
  triggers: PipelineTrigger[];
  artifacts: ArtifactConfig;
  strategy: DeploymentStrategy;
}

interface PipelineStage {
  name: string;
  type: 'build' | 'test' | 'scan' | 'deploy' | 'verify';
  parallel: boolean;
  steps: PipelineStep[];
  conditions: StageCondition[];
  timeout: number;
}

interface PipelineStep {
  name: string;
  action: string;
  parameters: Record<string, any>;
  retries: number;
  continueOnError: boolean;
}

interface StageCondition {
  type: 'branch' | 'tag' | 'manual' | 'schedule';
  value: string;
}

interface PipelineTrigger {
  type: 'push' | 'pull_request' | 'tag' | 'schedule' | 'manual';
  branches?: string[];
  tags?: string[];
  schedule?: string; // Cron expression
}

interface ArtifactConfig {
  registry: string;
  repository: string;
  tagging: {
    strategy: 'commit' | 'branch' | 'semver' | 'timestamp';
    prefix?: string;
  };
  retention: {
    days: number;
    count: number;
  };
}

interface DeploymentStrategy {
  type: 'rolling' | 'blue-green' | 'canary' | 'recreate';
  config: Record<string, any>;
}

interface SyncPolicy {
  automated: {
    prune: boolean;
    selfHeal: boolean;
    allowEmpty: boolean;
  };
  syncOptions: string[];
  retry: {
    limit: number;
    backoff: {
      duration: string;
      factor: number;
      maxDuration: string;
    };
  };
}

interface HealthCheck {
  type: 'http' | 'tcp' | 'exec' | 'grpc';
  config: Record<string, any>;
  interval: number;
  timeout: number;
  retries: number;
}

interface ApprovalPolicy {
  required: boolean;
  approvers: string[];
  timeout: number;
  autoApprove: {
    enabled: boolean;
    conditions: string[];
  };
}

interface RollbackPolicy {
  automatic: boolean;
  conditions: RollbackCondition[];
  maxRevisions: number;
  pauseDuration: number;
}

interface RollbackCondition {
  type: 'health' | 'metrics' | 'errors' | 'manual';
  threshold: number;
  duration: number;
}

interface MonitoringConfig {
  metrics: {
    enabled: boolean;
    provider: 'prometheus' | 'datadog' | 'newrelic';
    dashboards: string[];
  };
  logging: {
    enabled: boolean;
    provider: 'elasticsearch' | 'splunk' | 'cloudwatch';
    queries: string[];
  };
  tracing: {
    enabled: boolean;
    provider: 'jaeger' | 'zipkin' | 'datadog';
    sampling: number;
  };
  alerts: Alert[];
}

interface Alert {
  name: string;
  condition: string;
  severity: 'info' | 'warning' | 'critical';
  channels: string[];
}

interface NotificationConfig {
  channels: NotificationChannel[];
  events: NotificationEvent[];
}

interface NotificationChannel {
  type: 'slack' | 'email' | 'webhook' | 'pagerduty';
  config: Record<string, any>;
}

interface NotificationEvent {
  type: 'deployment' | 'rollback' | 'error' | 'approval';
  channels: string[];
  template: string;
}

interface Webhook {
  id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
}

// Generate ArgoCD Application manifest
const generateArgoCDApp = (config: GitOpsConfig, env: Environment) => {
  return yaml.dump({
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Application',
    metadata: {
      name: `${config.pluginId}-${env.name}`,
      namespace: 'argocd',
      finalizers: ['resources-finalizer.argocd.argoproj.io'],
      labels: {
        'backstage.io/plugin-id': config.pluginId,
        'backstage.io/environment': env.name
      }
    },
    spec: {
      project: 'default',
      source: {
        repoURL: config.repository.url,
        targetRevision: env.branch,
        path: config.repository.path,
        helm: {
          valueFiles: [`values-${env.name}.yaml`],
          parameters: [
            { name: 'image.tag', value: '${ARGOCD_APP_REVISION}' }
          ]
        }
      },
      destination: {
        server: env.cluster,
        namespace: env.namespace
      },
      syncPolicy: env.autoSync ? {
        automated: env.syncPolicy.automated,
        syncOptions: env.syncPolicy.syncOptions,
        retry: env.syncPolicy.retry
      } : undefined,
      revisionHistoryLimit: config.rollback.maxRevisions,
      ignoreDifferences: [
        {
          group: 'apps',
          kind: 'Deployment',
          jsonPointers: ['/spec/replicas']
        }
      ]
    }
  });
};

// Generate Flux GitOps manifests
const generateFluxManifests = (config: GitOpsConfig, env: Environment) => {
  const manifests = [];
  
  // GitRepository
  manifests.push(yaml.dump({
    apiVersion: 'source.toolkit.fluxcd.io/v1beta2',
    kind: 'GitRepository',
    metadata: {
      name: `${config.pluginId}-source`,
      namespace: 'flux-system'
    },
    spec: {
      interval: '1m',
      ref: {
        branch: env.branch
      },
      url: config.repository.url,
      secretRef: {
        name: `${config.pluginId}-git-credentials`
      }
    }
  }));
  
  // Kustomization
  manifests.push(yaml.dump({
    apiVersion: 'kustomize.toolkit.fluxcd.io/v1beta2',
    kind: 'Kustomization',
    metadata: {
      name: `${config.pluginId}-${env.name}`,
      namespace: 'flux-system'
    },
    spec: {
      interval: '10m',
      path: `./${config.repository.path}/${env.name}`,
      prune: env.syncPolicy.automated.prune,
      sourceRef: {
        kind: 'GitRepository',
        name: `${config.pluginId}-source`
      },
      targetNamespace: env.namespace,
      healthChecks: env.healthChecks.map(hc => ({
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: config.pluginId,
        namespace: env.namespace
      })),
      timeout: '3m',
      retryInterval: '2m'
    }
  }));
  
  return manifests.join('\n---\n');
};

// Generate GitHub Actions workflow
const generateGitHubActions = (config: GitOpsConfig) => {
  const workflow = {
    name: `Deploy ${config.pluginId}`,
    on: {
      push: {
        branches: config.pipeline.triggers
          .filter(t => t.type === 'push')
          .flatMap(t => t.branches || [])
      },
      pull_request: {
        branches: config.pipeline.triggers
          .filter(t => t.type === 'pull_request')
          .flatMap(t => t.branches || [])
      },
      workflow_dispatch: {},
      schedule: config.pipeline.triggers
        .filter(t => t.type === 'schedule')
        .map(t => ({ cron: t.schedule }))
    },
    env: {
      REGISTRY: config.pipeline.artifacts.registry,
      IMAGE_NAME: `${config.pipeline.artifacts.repository}/${config.pluginId}`
    },
    jobs: {}
  };
  
  // Add pipeline stages as jobs
  config.pipeline.stages.forEach(stage => {
    workflow.jobs[stage.name] = {
      'runs-on': 'ubuntu-latest',
      steps: stage.steps.map(step => ({
        name: step.name,
        uses: step.action.includes('@') ? step.action : undefined,
        run: !step.action.includes('@') ? step.action : undefined,
        with: step.parameters,
        'continue-on-error': step.continueOnError
      })),
      timeout_minutes: stage.timeout
    };
  });
  
  return yaml.dump(workflow);
};

// Generate Tekton Pipeline
const generateTektonPipeline = (config: GitOpsConfig) => {
  return yaml.dump({
    apiVersion: 'tekton.dev/v1beta1',
    kind: 'Pipeline',
    metadata: {
      name: `${config.pluginId}-pipeline`
    },
    spec: {
      params: [
        { name: 'repo-url', type: 'string' },
        { name: 'repo-revision', type: 'string' },
        { name: 'image-name', type: 'string' }
      ],
      workspaces: [
        { name: 'shared-data' },
        { name: 'docker-credentials' }
      ],
      tasks: config.pipeline.stages.map(stage => ({
        name: stage.name,
        taskRef: {
          name: `${stage.type}-task`
        },
        params: Object.entries(stage.steps[0]?.parameters || {}).map(([key, value]) => ({
          name: key,
          value: value
        })),
        workspaces: [
          { name: 'source', workspace: 'shared-data' }
        ],
        runAfter: stage.parallel ? [] : [config.pipeline.stages[config.pipeline.stages.indexOf(stage) - 1]?.name].filter(Boolean)
      }))
    }
  });
};

// Sync GitOps repository
const syncGitOpsRepo = async (config: GitOpsConfig, env: Environment) => {
  const workDir = path.join(process.cwd(), 'gitops', config.id);
  
  try {
    // Clone or pull repository
    try {
      await execAsync(`git clone ${config.repository.url} ${workDir}`);
    } catch (error) {
      // Repository already exists, pull latest
      await execAsync(`git pull origin ${config.repository.branch}`, { cwd: workDir });
    }
    
    // Generate manifests based on GitOps tool
    let manifests = '';
    let manifestPath = '';
    
    if (env.cluster.includes('argocd')) {
      manifests = generateArgoCDApp(config, env);
      manifestPath = path.join(workDir, 'argocd', `${config.pluginId}-${env.name}.yaml`);
    } else {
      manifests = generateFluxManifests(config, env);
      manifestPath = path.join(workDir, 'flux', `${config.pluginId}-${env.name}.yaml`);
    }
    
    // Write manifests
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(manifestPath, manifests);
    
    // Commit and push
    await execAsync(`git add .`, { cwd: workDir });
    await execAsync(`git commit -m "Update ${config.pluginId} manifests for ${env.name}"`, { cwd: workDir });
    await execAsync(`git push origin ${config.repository.branch}`, { cwd: workDir });
    
    return {
      success: true,
      manifestPath,
      commitHash: (await execAsync(`git rev-parse HEAD`, { cwd: workDir })).stdout.trim()
    };
    
  } catch (error) {
    console.error('Error syncing GitOps repository:', error);
    throw error;
  }
};

// Monitor deployment status
const monitorDeployment = async (config: GitOpsConfig, env: Environment) => {
  try {
    // Check ArgoCD application status
    if (env.cluster.includes('argocd')) {
      const { stdout } = await execAsync(`argocd app get ${config.pluginId}-${env.name} -o json`);
      const app = JSON.parse(stdout);
      
      return {
        status: app.status.sync.status,
        health: app.status.health.status,
        message: app.status.conditions?.[0]?.message,
        resources: app.status.resources,
        lastSync: app.status.operationState?.finishedAt
      };
    }
    
    // Check Flux kustomization status
    const { stdout } = await execAsync(`flux get kustomization ${config.pluginId}-${env.name} -o json`);
    const kustomization = JSON.parse(stdout);
    
    return {
      status: kustomization.status?.conditions?.[0]?.status === 'True' ? 'Synced' : 'OutOfSync',
      health: kustomization.status?.conditions?.[0]?.reason,
      message: kustomization.status?.conditions?.[0]?.message,
      lastSync: kustomization.status?.lastAppliedRevision
    };
    
  } catch (error) {
    return {
      status: 'Unknown',
      health: 'Unknown',
      message: error instanceof Error ? error.message : 'Failed to get deployment status'
    };
  }
};

// Execute rollback
const executeRollback = async (config: GitOpsConfig, env: Environment, targetRevision: string) => {
  try {
    if (env.cluster.includes('argocd')) {
      // ArgoCD rollback
      await execAsync(`argocd app rollback ${config.pluginId}-${env.name} ${targetRevision}`);
      await execAsync(`argocd app sync ${config.pluginId}-${env.name}`);
    } else {
      // Flux rollback via Git
      const workDir = path.join(process.cwd(), 'gitops', config.id);
      await execAsync(`git checkout ${targetRevision}`, { cwd: workDir });
      await execAsync(`git push --force origin ${env.branch}`, { cwd: workDir });
    }
    
    // Send notifications
    if (config.notifications.events.find(e => e.type === 'rollback')) {
      // Send rollback notifications
      console.log('Sending rollback notifications...');
    }
    
    return {
      success: true,
      message: `Rolled back to revision ${targetRevision}`
    };
    
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  }
};

// Store for GitOps configurations
const gitOpsStore = new Map<string, GitOpsConfig>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create_config': {
        const { pluginId, repository, environments, pipeline } = body;
        
        const config: GitOpsConfig = {
          id: crypto.randomBytes(8).toString('hex'),
          pluginId,
          repository: repository || {
            url: `https://github.com/org/${pluginId}-gitops`,
            branch: 'main',
            path: 'manifests',
            credentials: { type: 'token', value: process.env.GITHUB_TOKEN || '' },
            webhooks: []
          },
          environments: environments || [
            {
              name: 'development',
              type: 'development',
              cluster: 'https://kubernetes.default.svc',
              namespace: `${pluginId}-dev`,
              branch: 'develop',
              autoSync: true,
              syncPolicy: {
                automated: { prune: true, selfHeal: true, allowEmpty: false },
                syncOptions: ['CreateNamespace=true'],
                retry: {
                  limit: 5,
                  backoff: {
                    duration: '5s',
                    factor: 2,
                    maxDuration: '3m'
                  }
                }
              },
              healthChecks: [
                {
                  type: 'http',
                  config: { path: '/health', port: 8080 },
                  interval: 30,
                  timeout: 10,
                  retries: 3
                }
              ],
              approvals: {
                required: false,
                approvers: [],
                timeout: 0,
                autoApprove: { enabled: true, conditions: [] }
              }
            }
          ],
          pipeline: pipeline || {
            stages: [
              {
                name: 'build',
                type: 'build',
                parallel: false,
                steps: [
                  {
                    name: 'Build Docker Image',
                    action: 'docker/build-push-action@v2',
                    parameters: {
                      context: '.',
                      push: true,
                      tags: '${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}'
                    },
                    retries: 2,
                    continueOnError: false
                  }
                ],
                conditions: [],
                timeout: 30
              }
            ],
            triggers: [
              { type: 'push', branches: ['main', 'develop'] }
            ],
            artifacts: {
              registry: 'ghcr.io',
              repository: 'org',
              tagging: { strategy: 'commit' },
              retention: { days: 30, count: 10 }
            },
            strategy: {
              type: 'rolling',
              config: { maxSurge: 1, maxUnavailable: 0 }
            }
          },
          monitoring: {
            metrics: {
              enabled: true,
              provider: 'prometheus',
              dashboards: []
            },
            logging: {
              enabled: true,
              provider: 'elasticsearch',
              queries: []
            },
            tracing: {
              enabled: false,
              provider: 'jaeger',
              sampling: 0.1
            },
            alerts: []
          },
          rollback: {
            automatic: true,
            conditions: [
              { type: 'health', threshold: 0.5, duration: 300 }
            ],
            maxRevisions: 10,
            pauseDuration: 60
          },
          notifications: {
            channels: [],
            events: []
          }
        };
        
        gitOpsStore.set(config.id, config);
        
        // Generate initial manifests
        const githubWorkflow = generateGitHubActions(config);
        const tektonPipeline = generateTektonPipeline(config);
        
        return NextResponse.json({
          success: true,
          config,
          manifests: {
            github: githubWorkflow,
            tekton: tektonPipeline
          }
        });
      }

      case 'sync': {
        const { configId, environment } = body;
        const config = gitOpsStore.get(configId);
        
        if (!config) {
          return NextResponse.json({
            success: false,
            error: 'Configuration not found'
          }, { status: 404 });
        }
        
        const env = config.environments.find(e => e.name === environment);
        if (!env) {
          return NextResponse.json({
            success: false,
            error: 'Environment not found'
          }, { status: 404 });
        }
        
        const result = await syncGitOpsRepo(config, env);
        
        return NextResponse.json({
          success: true,
          ...result
        });
      }

      case 'deploy': {
        const { configId, environment, version } = body;
        const config = gitOpsStore.get(configId);
        
        if (!config) {
          return NextResponse.json({
            success: false,
            error: 'Configuration not found'
          }, { status: 404 });
        }
        
        const env = config.environments.find(e => e.name === environment);
        if (!env) {
          return NextResponse.json({
            success: false,
            error: 'Environment not found'
          }, { status: 404 });
        }
        
        // Trigger deployment
        if (env.cluster.includes('argocd')) {
          await execAsync(`argocd app sync ${config.pluginId}-${env.name} --revision ${version || 'HEAD'}`);
        } else {
          // Flux will auto-sync based on Git commits
          await syncGitOpsRepo(config, env);
        }
        
        // Monitor deployment
        const status = await monitorDeployment(config, env);
        
        return NextResponse.json({
          success: true,
          deployment: {
            environment: env.name,
            version: version || 'latest',
            status
          }
        });
      }

      case 'rollback': {
        const { configId, environment, targetRevision } = body;
        const config = gitOpsStore.get(configId);
        
        if (!config) {
          return NextResponse.json({
            success: false,
            error: 'Configuration not found'
          }, { status: 404 });
        }
        
        const env = config.environments.find(e => e.name === environment);
        if (!env) {
          return NextResponse.json({
            success: false,
            error: 'Environment not found'
          }, { status: 404 });
        }
        
        const result = await executeRollback(config, env, targetRevision);
        
        return NextResponse.json({
          success: true,
          ...result
        });
      }

      case 'status': {
        const { configId, environment } = body;
        const config = gitOpsStore.get(configId);
        
        if (!config) {
          return NextResponse.json({
            success: false,
            error: 'Configuration not found'
          }, { status: 404 });
        }
        
        const env = config.environments.find(e => e.name === environment);
        if (!env) {
          return NextResponse.json({
            success: false,
            error: 'Environment not found'
          }, { status: 404 });
        }
        
        const status = await monitorDeployment(config, env);
        
        return NextResponse.json({
          success: true,
          status
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('GitOps API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process GitOps request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('configId');
    
    if (configId) {
      const config = gitOpsStore.get(configId);
      
      if (!config) {
        return NextResponse.json({
          success: false,
          error: 'Configuration not found'
        }, { status: 404 });
      }
      
      // Get status for all environments
      const statuses = await Promise.all(
        config.environments.map(async env => ({
          environment: env.name,
          status: await monitorDeployment(config, env)
        }))
      );
      
      return NextResponse.json({
        success: true,
        config,
        statuses
      });
    }
    
    // List all configurations
    const configs = Array.from(gitOpsStore.values());
    
    return NextResponse.json({
      success: true,
      configs
    });
    
  } catch (error) {
    console.error('GitOps API GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch GitOps data'
    }, { status: 500 });
  }
}