import { NextRequest, NextResponse } from 'next/server';
import { exec, spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';
import { Octokit } from '@octokit/rest';

const execAsync = promisify(exec);

interface CICDConfig {
  pluginId: string;
  provider: 'github-actions' | 'jenkins' | 'azure-devops' | 'gitlab-ci';
  repository: {
    url: string;
    branch?: string;
    token?: string;
  };
  pipeline: {
    stages: CIPipelineStage[];
    environment?: 'development' | 'staging' | 'production';
    deployment?: DeploymentConfig;
    notifications?: NotificationConfig[];
  };
  triggers: {
    push?: boolean;
    pullRequest?: boolean;
    schedule?: string; // cron format
    manual?: boolean;
  };
  variables?: Record<string, string>;
}

interface CIPipelineStage {
  name: string;
  type: 'test' | 'build' | 'security' | 'deploy' | 'custom';
  commands: string[];
  condition?: string;
  timeout?: number;
  environment?: Record<string, string>;
  artifacts?: string[];
  dependencies?: string[];
}

interface DeploymentConfig {
  strategy: 'rolling' | 'blue-green' | 'canary' | 'recreate';
  target: 'kubernetes' | 'docker' | 'npm' | 'custom';
  config: Record<string, any>;
  healthChecks?: HealthCheck[];
  rollback?: RollbackConfig;
}

interface HealthCheck {
  type: 'http' | 'tcp' | 'command';
  config: Record<string, any>;
  timeout: number;
  retries: number;
}

interface RollbackConfig {
  enabled: boolean;
  automatic?: boolean;
  conditions?: RollbackCondition[];
}

interface RollbackCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'ne';
  threshold: number;
  duration: number;
}

interface NotificationConfig {
  type: 'slack' | 'email' | 'webhook';
  config: Record<string, any>;
  events: ('started' | 'completed' | 'failed' | 'deployed' | 'rollback')[];
}

interface PipelineRun {
  runId: string;
  pluginId: string;
  provider: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  duration?: number;
  stages: PipelineStageResult[];
  logs: string[];
  artifacts: string[];
  deployment?: DeploymentResult;
  metadata: {
    commit?: string;
    branch?: string;
    author?: string;
    triggeredBy: 'push' | 'pr' | 'schedule' | 'manual';
  };
}

interface PipelineStageResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  duration?: number;
  logs: string[];
  artifacts: string[];
  exitCode?: number;
}

interface DeploymentResult {
  strategy: string;
  status: 'deploying' | 'deployed' | 'failed' | 'rolled-back';
  version: string;
  environment: string;
  startTime: string;
  endTime?: string;
  healthChecks: HealthCheckResult[];
  rollback?: RollbackResult;
}

interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  message: string;
  timestamp: string;
}

interface RollbackResult {
  triggered: boolean;
  reason: string;
  timestamp: string;
  previousVersion: string;
  success: boolean;
}

// Store for active pipeline runs
const activePipelines = new Map<string, { process: ChildProcess; result: PipelineRun }>();

export async function POST(request: NextRequest) {
  try {
    const config: CICDConfig = await request.json();
    
    const runId = uuidv4();
    const timestamp = new Date().toISOString();
    
    const pipelineRun: PipelineRun = {
      runId,
      pluginId: config.pluginId,
      provider: config.provider,
      status: 'queued',
      startTime: timestamp,
      stages: config.pipeline.stages.map(stage => ({
        name: stage.name,
        status: 'pending',
        logs: [],
        artifacts: []
      })),
      logs: [],
      artifacts: [],
      metadata: {
        triggeredBy: 'manual',
        branch: config.repository.branch || 'main'
      }
    };

    // Create pipeline working directory
    const pipelineDir = path.join(process.cwd(), 'pipeline-runs', runId);
    await fs.mkdir(pipelineDir, { recursive: true });

    // Start pipeline execution
    const pipelineProcess = await startPipelineExecution(config, pipelineRun, pipelineDir);
    
    activePipelines.set(runId, { process: pipelineProcess, result: pipelineRun });

    return NextResponse.json({
      success: true,
      runId,
      message: 'Pipeline execution started',
      status: 'running'
    });

  } catch (error) {
    console.error('CI/CD pipeline error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');
  const action = searchParams.get('action');
  const pluginId = searchParams.get('pluginId');

  try {
    if (action === 'list') {
      // Return list of pipeline runs
      const runs = Array.from(activePipelines.values()).map(({ result }) => ({
        runId: result.runId,
        pluginId: result.pluginId,
        provider: result.provider,
        status: result.status,
        startTime: result.startTime,
        endTime: result.endTime,
        duration: result.duration
      }));

      // Load completed runs
      const completedRuns = await loadCompletedRuns(pluginId);
      
      return NextResponse.json({
        success: true,
        active: runs.filter(run => !pluginId || run.pluginId === pluginId),
        completed: completedRuns
      });
    }

    if (action === 'templates') {
      // Return CI/CD pipeline templates
      const templates = await getPipelineTemplates();
      return NextResponse.json({
        success: true,
        templates
      });
    }

    if (action === 'webhooks' && pluginId) {
      // Setup webhooks for repository
      const webhookUrl = await setupRepositoryWebhooks(pluginId);
      return NextResponse.json({
        success: true,
        webhookUrl
      });
    }

    if (!runId) {
      return NextResponse.json({
        success: false,
        error: 'runId is required'
      }, { status: 400 });
    }

    const activePipeline = activePipelines.get(runId);
    if (activePipeline) {
      return NextResponse.json({
        success: true,
        result: activePipeline.result
      });
    }

    // Check for completed pipeline
    const completedResult = await loadPipelineResult(runId);
    if (completedResult) {
      return NextResponse.json({
        success: true,
        result: completedResult
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Pipeline run not found'
    }, { status: 404 });

  } catch (error) {
    console.error('Error fetching pipeline result:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');

  if (!runId) {
    return NextResponse.json({
      success: false,
      error: 'runId is required'
    }, { status: 400 });
  }

  try {
    const activePipeline = activePipelines.get(runId);
    if (activePipeline) {
      // Cancel running pipeline
      activePipeline.process.kill('SIGTERM');
      activePipeline.result.status = 'cancelled';
      activePipeline.result.endTime = new Date().toISOString();
      
      // Save cancelled result
      await savePipelineResult(activePipeline.result);
      activePipelines.delete(runId);

      return NextResponse.json({
        success: true,
        message: 'Pipeline cancelled successfully'
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Pipeline not found or already completed'
    }, { status: 404 });

  } catch (error) {
    console.error('Error cancelling pipeline:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const runId = searchParams.get('runId');

  try {
    if (action === 'rollback' && runId) {
      // Trigger rollback
      const result = await triggerRollback(runId);
      return NextResponse.json({
        success: true,
        rollback: result
      });
    }

    if (action === 'retry' && runId) {
      // Retry failed pipeline
      const result = await retryPipeline(runId);
      return NextResponse.json({
        success: true,
        newRunId: result.runId
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Error processing pipeline action:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

async function startPipelineExecution(config: CICDConfig, result: PipelineRun, pipelineDir: string): Promise<ChildProcess> {
  // Setup pipeline environment
  await setupPipelineEnvironment(config, pipelineDir);

  // Generate pipeline script based on provider
  const pipelineScript = await generatePipelineScript(config, pipelineDir);
  
  // Execute pipeline
  result.status = 'running';
  const pipelineProcess = spawn('bash', [pipelineScript], {
    cwd: pipelineDir,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ...config.variables,
      PIPELINE_RUN_ID: result.runId,
      PLUGIN_ID: config.pluginId
    }
  });

  // Handle pipeline output
  pipelineProcess.stdout?.on('data', (data) => {
    const output = data.toString();
    result.logs.push(`[STDOUT] ${output}`);
    
    // Parse stage progress
    parsePipelineProgress(output, result);
  });

  pipelineProcess.stderr?.on('data', (data) => {
    const output = data.toString();
    result.logs.push(`[STDERR] ${output}`);
  });

  pipelineProcess.on('close', async (code) => {
    result.status = code === 0 ? 'success' : 'failed';
    result.endTime = new Date().toISOString();
    result.duration = new Date(result.endTime).getTime() - new Date(result.startTime).getTime();

    // Parse final results and collect artifacts
    await parsePipelineResults(pipelineDir, result);
    
    // Handle deployment if configured
    if (config.pipeline.deployment && result.status === 'success') {
      await handleDeployment(config, result, pipelineDir);
    }

    // Send notifications
    if (config.pipeline.notifications) {
      await sendNotifications(config.pipeline.notifications, result);
    }

    // Save pipeline result
    await savePipelineResult(result);
    
    // Cleanup
    activePipelines.delete(result.runId);
    await cleanupPipelineEnvironment(pipelineDir, config);
  });

  return pipelineProcess;
}

async function setupPipelineEnvironment(config: CICDConfig, pipelineDir: string): Promise<void> {
  // Clone repository if URL provided
  if (config.repository.url) {
    const gitUrl = config.repository.token 
      ? config.repository.url.replace('https://', `https://${config.repository.token}@`)
      : config.repository.url;
    
    await execAsync(`git clone --branch ${config.repository.branch || 'main'} ${gitUrl} source`, {
      cwd: pipelineDir
    });
  } else {
    // Copy plugin source code from local
    const pluginPath = path.join(process.cwd(), 'plugins', config.pluginId);
    if (await fs.access(pluginPath).then(() => true).catch(() => false)) {
      await execAsync(`cp -r "${pluginPath}" source`, { cwd: pipelineDir });
    }
  }

  // Create pipeline workspace structure
  await fs.mkdir(path.join(pipelineDir, 'artifacts'), { recursive: true });
  await fs.mkdir(path.join(pipelineDir, 'reports'), { recursive: true });
  await fs.mkdir(path.join(pipelineDir, 'deployments'), { recursive: true });
}

async function generatePipelineScript(config: CICDConfig, pipelineDir: string): Promise<string> {
  const scriptPath = path.join(pipelineDir, 'pipeline.sh');
  
  let script = `#!/bin/bash
set -e

echo "Starting CI/CD Pipeline for ${config.pluginId}"
echo "Provider: ${config.provider}"
echo "Run ID: $PIPELINE_RUN_ID"

cd source

`;

  // Generate script based on provider
  switch (config.provider) {
    case 'github-actions':
      script += await generateGitHubActionsScript(config);
      break;
    case 'jenkins':
      script += await generateJenkinsScript(config);
      break;
    case 'azure-devops':
      script += await generateAzureDevOpsScript(config);
      break;
    case 'gitlab-ci':
      script += await generateGitLabCIScript(config);
      break;
  }

  // Add common pipeline stages
  for (let i = 0; i < config.pipeline.stages.length; i++) {
    const stage = config.pipeline.stages[i];
    
    script += `
echo "==== Stage: ${stage.name} ===="
stage_start_time=$(date +%s)

# Set stage environment variables
${Object.entries(stage.environment || {}).map(([key, value]) => `export ${key}="${value}"`).join('\n')}

# Check stage dependencies
${stage.dependencies?.map(dep => `
if [ ! -f "../artifacts/${dep}" ]; then
  echo "Dependency not found: ${dep}"
  exit 1
fi
`).join('') || ''}

# Execute stage commands
stage_success=true
`;

    for (const command of stage.commands) {
      script += `
echo "Executing: ${command}"
timeout ${stage.timeout || 300} bash -c "${command}" || {
  echo "Command failed: ${command}"
  stage_success=false
  break
}
`;
    }

    script += `
# Collect stage artifacts
${stage.artifacts?.map(artifact => `
if [ -f "${artifact}" ] || [ -d "${artifact}" ]; then
  cp -r "${artifact}" "../artifacts/"
fi
`).join('') || ''}

stage_end_time=$(date +%s)
stage_duration=$((stage_end_time - stage_start_time))
echo "Stage ${stage.name} completed in $stage_duration seconds"

if [ "$stage_success" = false ]; then
  echo "Stage ${stage.name} failed"
  exit 1
fi

echo "Stage ${stage.name} completed successfully"
`;
  }

  script += `
echo "Pipeline completed successfully"
`;

  await fs.writeFile(scriptPath, script);
  await fs.chmod(scriptPath, 0o755);
  
  return scriptPath;
}

async function generateGitHubActionsScript(config: CICDConfig): Promise<string> {
  return `
# GitHub Actions specific setup
export GITHUB_WORKSPACE=$PWD
export GITHUB_ACTOR=pipeline-runner
export RUNNER_OS=Linux

# Install dependencies
if [ -f "package.json" ]; then
  npm ci
fi

if [ -f "requirements.txt" ]; then
  pip install -r requirements.txt
fi

if [ -f "go.mod" ]; then
  go mod download
fi
`;
}

async function generateJenkinsScript(config: CICDConfig): Promise<string> {
  return `
# Jenkins specific setup
export BUILD_NUMBER=$PIPELINE_RUN_ID
export JOB_NAME=${config.pluginId}-pipeline
export WORKSPACE=$PWD

# Jenkins tool setup
export PATH=/usr/local/bin:$PATH

# Install dependencies
if [ -f "package.json" ]; then
  npm ci
fi
`;
}

async function generateAzureDevOpsScript(config: CICDConfig): Promise<string> {
  return `
# Azure DevOps specific setup
export BUILD_BUILDNUMBER=$PIPELINE_RUN_ID
export BUILD_REPOSITORY_NAME=${config.pluginId}
export AGENT_WORKFOLDER=$PWD

# Install dependencies
if [ -f "package.json" ]; then
  npm ci
fi
`;
}

async function generateGitLabCIScript(config: CICDConfig): Promise<string> {
  return `
# GitLab CI specific setup
export CI_PIPELINE_ID=$PIPELINE_RUN_ID
export CI_PROJECT_NAME=${config.pluginId}
export CI_PROJECT_DIR=$PWD

# Install dependencies
if [ -f "package.json" ]; then
  npm ci
fi
`;
}

function parsePipelineProgress(output: string, result: PipelineRun): void {
  // Parse stage progress
  const stageMatch = output.match(/==== Stage: (.*?) ====/);
  if (stageMatch) {
    const stageName = stageMatch[1];
    const stage = result.stages.find(s => s.name === stageName);
    if (stage) {
      stage.status = 'running';
      stage.startTime = new Date().toISOString();
    }
  }

  // Parse stage completion
  const completionMatch = output.match(/Stage (.*?) completed in (\d+) seconds/);
  if (completionMatch) {
    const stageName = completionMatch[1];
    const duration = parseInt(completionMatch[2]) * 1000;
    const stage = result.stages.find(s => s.name === stageName);
    if (stage) {
      stage.status = 'success';
      stage.endTime = new Date().toISOString();
      stage.duration = duration;
    }
  }

  // Parse stage failure
  const failureMatch = output.match(/Stage (.*?) failed/);
  if (failureMatch) {
    const stageName = failureMatch[1];
    const stage = result.stages.find(s => s.name === stageName);
    if (stage) {
      stage.status = 'failed';
      stage.endTime = new Date().toISOString();
    }
  }
}

async function parsePipelineResults(pipelineDir: string, result: PipelineRun): Promise<void> {
  // Collect artifacts from artifacts directory
  try {
    const artifactsDir = path.join(pipelineDir, 'artifacts');
    const artifacts = await fs.readdir(artifactsDir);
    result.artifacts = artifacts.map(artifact => path.join(artifactsDir, artifact));
  } catch (error) {
    // No artifacts directory
  }

  // Parse test reports if available
  for (const stage of result.stages) {
    try {
      const stageReportPath = path.join(pipelineDir, 'reports', `${stage.name}-report.json`);
      if (await fs.access(stageReportPath).then(() => true).catch(() => false)) {
        const reportData = await fs.readFile(stageReportPath, 'utf8');
        // Parse and store stage-specific results
        stage.logs.push(`Report: ${reportData}`);
      }
    } catch (error) {
      // No report for this stage
    }
  }
}

async function handleDeployment(config: CICDConfig, result: PipelineRun, pipelineDir: string): Promise<void> {
  if (!config.pipeline.deployment) return;

  const deployment = config.pipeline.deployment;
  const deploymentResult: DeploymentResult = {
    strategy: deployment.strategy,
    status: 'deploying',
    version: result.metadata.commit || 'latest',
    environment: config.pipeline.environment || 'production',
    startTime: new Date().toISOString(),
    healthChecks: []
  };

  result.deployment = deploymentResult;

  try {
    // Execute deployment based on strategy and target
    switch (deployment.target) {
      case 'kubernetes':
        await deployToKubernetes(deployment, deploymentResult, pipelineDir);
        break;
      case 'docker':
        await deployToDocker(deployment, deploymentResult, pipelineDir);
        break;
      case 'npm':
        await publishToNPM(deployment, deploymentResult, pipelineDir);
        break;
      default:
        await customDeployment(deployment, deploymentResult, pipelineDir);
    }

    // Perform health checks
    if (deployment.healthChecks) {
      await performHealthChecks(deployment.healthChecks, deploymentResult);
    }

    deploymentResult.status = 'deployed';
    deploymentResult.endTime = new Date().toISOString();

    // Monitor for rollback conditions
    if (deployment.rollback?.enabled) {
      setTimeout(() => {
        monitorRollbackConditions(config, result);
      }, 30000); // Start monitoring after 30 seconds
    }

  } catch (error) {
    deploymentResult.status = 'failed';
    deploymentResult.endTime = new Date().toISOString();
    
    if (deployment.rollback?.automatic) {
      await triggerAutomaticRollback(config, result);
    }
  }
}

async function deployToKubernetes(deployment: DeploymentConfig, result: DeploymentResult, pipelineDir: string): Promise<void> {
  // Generate Kubernetes manifests
  const manifests = generateKubernetesManifests(deployment, result);
  
  // Write manifests to file
  const manifestPath = path.join(pipelineDir, 'k8s-manifests.yaml');
  await fs.writeFile(manifestPath, manifests);

  // Apply deployment strategy
  switch (deployment.strategy) {
    case 'blue-green':
      await executeBlueGreenDeployment(manifestPath, result);
      break;
    case 'canary':
      await executeCanaryDeployment(manifestPath, result);
      break;
    case 'rolling':
      await executeRollingDeployment(manifestPath, result);
      break;
    default:
      await execAsync(`kubectl apply -f ${manifestPath}`);
  }
}

async function deployToDocker(deployment: DeploymentConfig, result: DeploymentResult, pipelineDir: string): Promise<void> {
  const config = deployment.config;
  const imageName = config.imageName || `plugin-${result.version}`;
  
  // Build Docker image
  await execAsync(`docker build -t ${imageName} .`, { cwd: path.join(pipelineDir, 'source') });
  
  // Tag and push if registry specified
  if (config.registry) {
    const fullImageName = `${config.registry}/${imageName}`;
    await execAsync(`docker tag ${imageName} ${fullImageName}`);
    await execAsync(`docker push ${fullImageName}`);
  }

  // Deploy container
  const deployCommand = config.deployCommand || `docker run -d --name plugin-${result.version} ${imageName}`;
  await execAsync(deployCommand);
}

async function publishToNPM(deployment: DeploymentConfig, result: DeploymentResult, pipelineDir: string): Promise<void> {
  const sourcePath = path.join(pipelineDir, 'source');
  
  // Update version in package.json
  const packageJsonPath = path.join(sourcePath, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  packageJson.version = result.version;
  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Build package
  await execAsync('npm run build', { cwd: sourcePath });

  // Publish to NPM
  const publishCommand = deployment.config.tag 
    ? `npm publish --tag ${deployment.config.tag}`
    : 'npm publish';
  await execAsync(publishCommand, { cwd: sourcePath });
}

async function customDeployment(deployment: DeploymentConfig, result: DeploymentResult, pipelineDir: string): Promise<void> {
  // Execute custom deployment script
  const deployScript = deployment.config.script || deployment.config.command;
  if (deployScript) {
    await execAsync(deployScript, { cwd: pipelineDir });
  }
}

async function performHealthChecks(healthChecks: HealthCheck[], result: DeploymentResult): Promise<void> {
  for (const check of healthChecks) {
    const healthResult: HealthCheckResult = {
      name: check.type,
      status: 'unknown',
      message: '',
      timestamp: new Date().toISOString()
    };

    try {
      switch (check.type) {
        case 'http':
          await performHttpHealthCheck(check, healthResult);
          break;
        case 'tcp':
          await performTcpHealthCheck(check, healthResult);
          break;
        case 'command':
          await performCommandHealthCheck(check, healthResult);
          break;
      }
    } catch (error) {
      healthResult.status = 'unhealthy';
      healthResult.message = error instanceof Error ? error.message : 'Health check failed';
    }

    result.healthChecks.push(healthResult);
  }
}

async function performHttpHealthCheck(check: HealthCheck, result: HealthCheckResult): Promise<void> {
  const url = check.config.url;
  const expectedStatus = check.config.expectedStatus || 200;
  
  let retries = 0;
  while (retries < check.retries) {
    try {
      const response = await fetch(url, { 
        signal: AbortSignal.timeout(check.timeout) 
      });
      
      if (response.status === expectedStatus) {
        result.status = 'healthy';
        result.message = `HTTP ${response.status} from ${url}`;
        return;
      } else {
        result.status = 'unhealthy';
        result.message = `Expected HTTP ${expectedStatus}, got ${response.status}`;
      }
    } catch (error) {
      retries++;
      if (retries >= check.retries) {
        result.status = 'unhealthy';
        result.message = `HTTP request failed after ${check.retries} retries: ${error}`;
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between retries
      }
    }
  }
}

async function performTcpHealthCheck(check: HealthCheck, result: HealthCheckResult): Promise<void> {
  const { host, port } = check.config;
  
  try {
    const { exec } = require('child_process');
    await new Promise((resolve, reject) => {
      exec(`timeout ${check.timeout / 1000} bash -c "</dev/tcp/${host}/${port}"`, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve(true);
        }
      });
    });
    
    result.status = 'healthy';
    result.message = `TCP connection to ${host}:${port} successful`;
  } catch (error) {
    result.status = 'unhealthy';
    result.message = `TCP connection failed: ${error}`;
  }
}

async function performCommandHealthCheck(check: HealthCheck, result: HealthCheckResult): Promise<void> {
  try {
    const { stdout } = await execAsync(check.config.command, {
      timeout: check.timeout
    });
    
    result.status = 'healthy';
    result.message = stdout.trim();
  } catch (error) {
    result.status = 'unhealthy';
    result.message = `Command failed: ${error}`;
  }
}

function generateKubernetesManifests(deployment: DeploymentConfig, result: DeploymentResult): string {
  const config = deployment.config;
  
  return `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${config.name || 'plugin-deployment'}
  labels:
    app: ${config.name || 'plugin'}
    version: ${result.version}
spec:
  replicas: ${config.replicas || 3}
  selector:
    matchLabels:
      app: ${config.name || 'plugin'}
  template:
    metadata:
      labels:
        app: ${config.name || 'plugin'}
        version: ${result.version}
    spec:
      containers:
      - name: plugin
        image: ${config.image}
        ports:
        - containerPort: ${config.port || 3000}
        env:
${Object.entries(config.env || {}).map(([key, value]) => `        - name: ${key}\n          value: "${value}"`).join('\n')}
---
apiVersion: v1
kind: Service
metadata:
  name: ${config.name || 'plugin'}-service
spec:
  selector:
    app: ${config.name || 'plugin'}
  ports:
  - port: 80
    targetPort: ${config.port || 3000}
  type: ${config.serviceType || 'ClusterIP'}
`;
}

async function executeBlueGreenDeployment(manifestPath: string, result: DeploymentResult): Promise<void> {
  // Deploy to green environment
  await execAsync(`kubectl apply -f ${manifestPath} --namespace=green`);
  
  // Wait for deployment to be ready
  await execAsync('kubectl rollout status deployment/plugin-deployment --namespace=green');
  
  // Switch traffic to green
  await execAsync('kubectl patch service plugin-service -p \'{"spec":{"selector":{"version":"green"}}}\'');
  
  // Cleanup blue environment after delay
  setTimeout(async () => {
    await execAsync('kubectl delete all --selector=version=blue --namespace=blue');
  }, 300000); // 5 minutes
}

async function executeCanaryDeployment(manifestPath: string, result: DeploymentResult): Promise<void> {
  // Deploy canary version with 10% traffic
  await execAsync(`kubectl apply -f ${manifestPath} --namespace=canary`);
  
  // Update ingress to split traffic
  const canaryWeight = 10;
  await execAsync(`kubectl patch ingress plugin-ingress -p '{"metadata":{"annotations":{"nginx.ingress.kubernetes.io/canary-weight":"${canaryWeight}"}}}'`);
  
  // Monitor metrics and gradually increase traffic
  // This would be implemented with proper monitoring integration
}

async function executeRollingDeployment(manifestPath: string, result: DeploymentResult): Promise<void> {
  // Standard rolling update
  await execAsync(`kubectl apply -f ${manifestPath}`);
  await execAsync('kubectl rollout status deployment/plugin-deployment');
}

async function monitorRollbackConditions(config: CICDConfig, result: PipelineRun): Promise<void> {
  const rollbackConfig = config.pipeline.deployment?.rollback;
  if (!rollbackConfig?.conditions) return;

  for (const condition of rollbackConfig.conditions) {
    // Monitor metrics (this would integrate with actual monitoring systems)
    const metricValue = await getMetricValue(condition.metric);
    
    let shouldRollback = false;
    switch (condition.operator) {
      case 'gt':
        shouldRollback = metricValue > condition.threshold;
        break;
      case 'lt':
        shouldRollback = metricValue < condition.threshold;
        break;
      case 'eq':
        shouldRollback = metricValue === condition.threshold;
        break;
      case 'ne':
        shouldRollback = metricValue !== condition.threshold;
        break;
    }

    if (shouldRollback) {
      await triggerAutomaticRollback(config, result);
      break;
    }
  }
}

async function getMetricValue(metric: string): Promise<number> {
  // Mock implementation - integrate with Prometheus, DataDog, etc.
  switch (metric) {
    case 'error_rate':
      return Math.random() * 0.1; // 0-10% error rate
    case 'response_time':
      return Math.random() * 1000; // 0-1000ms response time
    case 'cpu_usage':
      return Math.random() * 100; // 0-100% CPU usage
    default:
      return 0;
  }
}

async function triggerAutomaticRollback(config: CICDConfig, result: PipelineRun): Promise<void> {
  if (!result.deployment) return;

  const rollbackResult: RollbackResult = {
    triggered: true,
    reason: 'Automatic rollback triggered by monitoring conditions',
    timestamp: new Date().toISOString(),
    previousVersion: result.deployment.version,
    success: false
  };

  try {
    // Execute rollback based on deployment target
    switch (config.pipeline.deployment?.target) {
      case 'kubernetes':
        await execAsync('kubectl rollout undo deployment/plugin-deployment');
        break;
      case 'docker':
        await execAsync(`docker stop plugin-${result.deployment.version}`);
        await execAsync(`docker start plugin-${rollbackResult.previousVersion}`);
        break;
    }

    rollbackResult.success = true;
    result.deployment.status = 'rolled-back';
  } catch (error) {
    rollbackResult.success = false;
  }

  result.deployment.rollback = rollbackResult;
  await savePipelineResult(result);
}

async function triggerRollback(runId: string): Promise<RollbackResult> {
  const pipelineResult = await loadPipelineResult(runId);
  if (!pipelineResult?.deployment) {
    throw new Error('No deployment found for rollback');
  }

  const rollbackResult: RollbackResult = {
    triggered: true,
    reason: 'Manual rollback requested',
    timestamp: new Date().toISOString(),
    previousVersion: pipelineResult.deployment.version,
    success: false
  };

  try {
    // Execute rollback (implementation depends on deployment target)
    await execAsync('kubectl rollout undo deployment/plugin-deployment');
    rollbackResult.success = true;
    
    pipelineResult.deployment.status = 'rolled-back';
    pipelineResult.deployment.rollback = rollbackResult;
    await savePipelineResult(pipelineResult);
  } catch (error) {
    rollbackResult.success = false;
  }

  return rollbackResult;
}

async function retryPipeline(runId: string): Promise<PipelineRun> {
  const originalRun = await loadPipelineResult(runId);
  if (!originalRun) {
    throw new Error('Original pipeline run not found');
  }

  // Create new pipeline run with same configuration
  const newRunId = uuidv4();
  const newRun: PipelineRun = {
    ...originalRun,
    runId: newRunId,
    status: 'queued',
    startTime: new Date().toISOString(),
    endTime: undefined,
    duration: undefined,
    logs: [],
    stages: originalRun.stages.map(stage => ({
      ...stage,
      status: 'pending',
      startTime: undefined,
      endTime: undefined,
      duration: undefined,
      logs: [],
      artifacts: []
    }))
  };

  return newRun;
}

async function sendNotifications(notifications: NotificationConfig[], result: PipelineRun): Promise<void> {
  for (const notification of notifications) {
    const events = notification.events;
    const currentEvent = result.status === 'success' ? 'completed' : 
                        result.status === 'failed' ? 'failed' :
                        result.deployment?.status === 'deployed' ? 'deployed' :
                        result.deployment?.status === 'rolled-back' ? 'rollback' : null;

    if (!currentEvent || !events.includes(currentEvent)) continue;

    try {
      switch (notification.type) {
        case 'slack':
          await sendSlackNotification(notification.config, result, currentEvent);
          break;
        case 'email':
          await sendEmailNotification(notification.config, result, currentEvent);
          break;
        case 'webhook':
          await sendWebhookNotification(notification.config, result, currentEvent);
          break;
      }
    } catch (error) {
      console.error(`Failed to send ${notification.type} notification:`, error);
    }
  }
}

async function sendSlackNotification(config: any, result: PipelineRun, event: string): Promise<void> {
  const webhook = config.webhookUrl;
  const channel = config.channel || '#deployments';
  
  const color = result.status === 'success' ? 'good' : 
                result.status === 'failed' ? 'danger' : 'warning';
  
  const payload = {
    channel,
    attachments: [{
      color,
      title: `Pipeline ${event}: ${result.pluginId}`,
      fields: [
        { title: 'Status', value: result.status, short: true },
        { title: 'Duration', value: `${Math.floor((result.duration || 0) / 1000)}s`, short: true },
        { title: 'Branch', value: result.metadata.branch, short: true },
        { title: 'Run ID', value: result.runId.slice(0, 8), short: true }
      ],
      ts: Math.floor(new Date(result.startTime).getTime() / 1000)
    }]
  };

  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function sendEmailNotification(config: any, result: PipelineRun, event: string): Promise<void> {
  // Mock email notification - integrate with actual email service
  console.log(`Email notification sent to ${config.recipients.join(', ')} for ${event}`);
}

async function sendWebhookNotification(config: any, result: PipelineRun, event: string): Promise<void> {
  const payload = {
    event,
    pipeline: result,
    timestamp: new Date().toISOString()
  };

  await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...config.headers
    },
    body: JSON.stringify(payload)
  });
}

async function setupRepositoryWebhooks(pluginId: string): Promise<string> {
  // Generate webhook URL for the plugin
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/ci-cd/${pluginId}`;
  
  // This would integrate with Git providers to automatically setup webhooks
  // For now, return the webhook URL that should be configured manually
  
  return webhookUrl;
}

async function getPipelineTemplates(): Promise<any[]> {
  return [
    {
      name: 'Node.js Plugin Pipeline',
      provider: 'github-actions',
      stages: [
        {
          name: 'Setup',
          type: 'custom',
          commands: ['npm ci', 'npm run build']
        },
        {
          name: 'Test',
          type: 'test',
          commands: ['npm test', 'npm run test:e2e']
        },
        {
          name: 'Security Scan',
          type: 'security',
          commands: ['npm audit', 'npx snyk test']
        },
        {
          name: 'Deploy',
          type: 'deploy',
          commands: ['npm run deploy']
        }
      ],
      deployment: {
        strategy: 'rolling',
        target: 'npm'
      }
    },
    {
      name: 'Docker Plugin Pipeline',
      provider: 'jenkins',
      stages: [
        {
          name: 'Build',
          type: 'build',
          commands: ['docker build -t plugin:latest .']
        },
        {
          name: 'Test',
          type: 'test',
          commands: ['docker run --rm plugin:latest npm test']
        },
        {
          name: 'Deploy',
          type: 'deploy',
          commands: ['docker push registry/plugin:latest']
        }
      ],
      deployment: {
        strategy: 'blue-green',
        target: 'kubernetes'
      }
    }
  ];
}

async function savePipelineResult(result: PipelineRun): Promise<void> {
  const resultsDir = path.join(process.cwd(), 'pipeline-results');
  await fs.mkdir(resultsDir, { recursive: true });
  
  const resultPath = path.join(resultsDir, `${result.runId}.json`);
  await fs.writeFile(resultPath, JSON.stringify(result, null, 2));
}

async function loadPipelineResult(runId: string): Promise<PipelineRun | null> {
  try {
    const resultPath = path.join(process.cwd(), 'pipeline-results', `${runId}.json`);
    const data = await fs.readFile(resultPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function loadCompletedRuns(pluginId?: string): Promise<PipelineRun[]> {
  try {
    const resultsDir = path.join(process.cwd(), 'pipeline-results');
    const files = await fs.readdir(resultsDir);
    
    const results = await Promise.all(
      files
        .filter(file => file.endsWith('.json'))
        .map(async file => {
          try {
            const data = await fs.readFile(path.join(resultsDir, file), 'utf8');
            return JSON.parse(data);
          } catch (error) {
            return null;
          }
        })
    );
    
    return results
      .filter(Boolean)
      .filter(result => !pluginId || result.pluginId === pluginId)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 50); // Return last 50 results
  } catch (error) {
    return [];
  }
}

async function cleanupPipelineEnvironment(pipelineDir: string, config: CICDConfig): Promise<void> {
  // Archive pipeline artifacts
  const archiveDir = path.join(process.cwd(), 'pipeline-archives', path.basename(pipelineDir));
  await fs.mkdir(archiveDir, { recursive: true });
  
  // Copy important files
  const filesToArchive = ['artifacts', 'reports', 'deployments', '*.log'];
  for (const pattern of filesToArchive) {
    try {
      await execAsync(`cp -r "${pipelineDir}/${pattern}" "${archiveDir}/" 2>/dev/null || true`);
    } catch (error) {
      // Ignore copy errors
    }
  }
  
  // Remove pipeline directory after delay to allow for debugging
  setTimeout(async () => {
    try {
      await fs.rm(pipelineDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup pipeline directory:', error);
    }
  }, 10 * 60 * 1000); // 10 minutes delay
}