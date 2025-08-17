import { NextRequest, NextResponse } from 'next/server';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

interface PluginInstallRequest {
  pluginId: string;
  version?: string;
  environment: 'local' | 'kubernetes';
  config?: Record<string, any>;
  namespace?: string;
}

interface PluginInstallStatus {
  pluginId: string;
  status: 'pending' | 'installing' | 'building' | 'deploying' | 'running' | 'failed' | 'stopped';
  containerId?: string;
  namespace?: string;
  serviceUrl?: string;
  healthCheckUrl?: string;
  logs: string[];
  error?: string;
  startedAt: string;
  completedAt?: string;
  resources: {
    cpu: string;
    memory: string;
    storage: string;
  };
}

// In-memory store for installation statuses (in production, use Redis/database)
const installationStore = new Map<string, PluginInstallStatus>();

// Generate unique installation ID
const generateInstallId = (pluginId: string) => {
  const timestamp = Date.now();
  const hash = Buffer.from(pluginId).toString('base64').slice(0, 8);
  return `install-${hash}-${timestamp}`;
};

// Helper function to convert database status to management status
function getPluginStatus(dbStatus: string, isEnabled: boolean): string {
  if (!isEnabled) return 'stopped';
  
  switch (dbStatus) {
    case 'ACTIVE': return 'running';
    case 'INACTIVE': return 'stopped';
    case 'ERROR': return 'error';
    case 'PENDING': return 'building';
    case 'DEPLOYING': return 'deploying';
    default: return 'stopped';
  }
}

// Create Dockerfile for Backstage plugin
const createPluginDockerfile = (pluginId: string, version: string = 'latest') => {
  return `
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache git python3 make g++

# Create app directory
WORKDIR /app

# Create package.json for the plugin
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy plugin source
COPY . .

# Build the plugin
RUN yarn build

# Expose port
EXPOSE 3000 7007

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \\
  CMD curl -f http://localhost:7007/api/health || exit 1

# Start the plugin
CMD ["yarn", "start"]
`;
};

// Create package.json for plugin
const createPluginPackageJson = (pluginId: string, version: string) => {
  return {
    name: `backstage-plugin-runtime-${pluginId.replace(/[@\/]/g, '-')}`,
    version: '1.0.0',
    private: true,
    scripts: {
      start: 'backstage-cli package start',
      build: 'backstage-cli package build',
      test: 'backstage-cli package test',
      dev: 'concurrently "yarn start" "yarn start-backend"',
      'start-backend': 'yarn workspace backend start'
    },
    dependencies: {
      [pluginId]: version,
      '@backstage/cli': '^0.25.0',
      '@backstage/core-app-api': '^1.11.4',
      '@backstage/core-components': '^0.13.9',
      '@backstage/core-plugin-api': '^1.8.0',
      '@backstage/theme': '^0.5.0',
      '@backstage/catalog-model': '^1.4.3',
      '@backstage/plugin-catalog-react': '^1.9.3',
      'react': '^18.0.2',
      'react-dom': '^18.0.2',
      'react-router': '^6.3.0',
      'react-router-dom': '^6.3.0'
    },
    devDependencies: {
      '@backstage/cli': '^0.25.0',
      '@types/react': '^18.0.0',
      '@types/react-dom': '^18.0.0',
      'typescript': '~5.2.0',
      'concurrently': '^8.0.0'
    },
    workspaces: {
      packages: ['packages/*']
    }
  };
};

// Create Kubernetes deployment manifest
const createKubernetesManifest = (pluginId: string, namespace: string, installId: string) => {
  const pluginName = pluginId.replace(/[@\/]/g, '-').toLowerCase();
  const containerName = `backstage-plugin-${pluginName}`;
  
  return {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name: namespace,
      labels: {
        'backstage.io/plugin': pluginName,
        'backstage.io/install-id': installId
      }
    }
  }, {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: containerName,
      namespace: namespace,
      labels: {
        app: containerName,
        'backstage.io/plugin': pluginName
      }
    },
    spec: {
      replicas: 1,
      selector: {
        matchLabels: {
          app: containerName
        }
      },
      template: {
        metadata: {
          labels: {
            app: containerName,
            'backstage.io/plugin': pluginName
          }
        },
        spec: {
          containers: [{
            name: containerName,
            image: `backstage-plugin-${pluginName}:latest`,
            ports: [
              { containerPort: 3000, name: 'frontend' },
              { containerPort: 7007, name: 'backend' }
            ],
            env: [
              { name: 'NODE_ENV', value: 'production' },
              { name: 'PLUGIN_ID', value: pluginId },
              { name: 'BACKSTAGE_NAMESPACE', value: namespace }
            ],
            resources: {
              requests: {
                memory: '512Mi',
                cpu: '250m'
              },
              limits: {
                memory: '1Gi',
                cpu: '500m'
              }
            },
            livenessProbe: {
              httpGet: {
                path: '/api/health',
                port: 7007
              },
              initialDelaySeconds: 30,
              periodSeconds: 30
            },
            readinessProbe: {
              httpGet: {
                path: '/api/health',
                port: 7007
              },
              initialDelaySeconds: 10,
              periodSeconds: 5
            }
          }]
        }
      }
    }
  }, {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: `${containerName}-service`,
      namespace: namespace,
      labels: {
        app: containerName
      }
    },
    spec: {
      selector: {
        app: containerName
      },
      ports: [
        { port: 3000, targetPort: 3000, name: 'frontend' },
        { port: 7007, targetPort: 7007, name: 'backend' }
      ],
      type: 'LoadBalancer'
    }
  };
};

// Install plugin locally with Docker
const installPluginLocal = async (installId: string, pluginId: string, version: string = 'latest', config: Record<string, any> = {}) => {
  const workDir = path.join(process.cwd(), 'plugin-runtime', installId);
  
  try {
    // Update status
    const status = installationStore.get(installId)!;
    status.status = 'installing';
    status.logs.push(`Creating workspace directory: ${workDir}`);
    
    // Create workspace directory
    await fs.mkdir(workDir, { recursive: true });
    
    // Create package.json
    const packageJson = createPluginPackageJson(pluginId, version);
    await fs.writeFile(
      path.join(workDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    
    status.logs.push('Created package.json');
    
    // Create yarn.lock (empty)
    await fs.writeFile(path.join(workDir, 'yarn.lock'), '');
    
    // Create Dockerfile
    const dockerfile = createPluginDockerfile(pluginId, version);
    await fs.writeFile(path.join(workDir, 'Dockerfile'), dockerfile);
    
    status.logs.push('Created Dockerfile');
    
    // Generate complete Backstage app structure using the generator API
    status.logs.push('Generating complete Backstage app structure...');
    
    try {
      const generatorResponse = await fetch('http://localhost:3000/api/backstage-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId,
          version,
          appName: `Plugin ${pluginId}`,
          installId
        })
      });
      
      if (!generatorResponse.ok) {
        throw new Error('Failed to generate Backstage app structure');
      }
      
      const generatorData = await generatorResponse.json();
      status.logs.push(`Generated ${generatorData.files?.length || 0} files for Backstage app`);
    } catch (genError) {
      status.logs.push(`Warning: Could not use generator API: ${genError}. Using fallback method.`);
      
      // Fallback: Create minimal structure
      const appDir = path.join(workDir, 'packages', 'app', 'src');
      await fs.mkdir(appDir, { recursive: true });
      
      const appTsx = `
import React from 'react';
import { Navigate, Route } from 'react-router-dom';
import { createApp, AppRouter, FlatRoutes } from '@backstage/app-defaults';
import { CatalogIndexPage } from '@backstage/plugin-catalog';

// Import the plugin - ${pluginId}@${version}
// Note: Check plugin documentation for correct import syntax

const app = createApp({});
const AppProvider = app.getProvider();
const AppRouterComponent = app.getRouter();

const App = () => (
  <AppProvider>
    <AppRouterComponent>
      <FlatRoutes>
        <Route path="/catalog" element={<CatalogIndexPage />} />
        <Route path="/" element={<Navigate to="catalog" />} />
      </FlatRoutes>
    </AppRouterComponent>
  </AppProvider>
);

export default App;
`;
      
      await fs.writeFile(path.join(appDir, 'App.tsx'), appTsx);
      status.logs.push('Created minimal App.tsx structure');
    }
    
    // Generate Docker Compose orchestration
    status.status = 'building';
    status.logs.push('Setting up Docker Compose orchestration...');
    
    try {
      const composeResponse = await fetch('http://localhost:3000/api/docker-compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installId,
          pluginId,
          environment: 'development'
        })
      });
      
      if (!composeResponse.ok) {
        throw new Error('Failed to generate Docker Compose configuration');
      }
      
      const composeData = await composeResponse.json();
      status.logs.push(`Generated Docker Compose stack with ${composeData.services?.length || 0} services`);
    } catch (composeError) {
      status.logs.push(`Warning: Could not generate Docker Compose: ${composeError}`);
    }
    
    status.logs.push('Building Docker images...');
    
    // Build using Docker Compose for full stack
    const buildCommand = `docker-compose build --no-cache`;
    
    const { stdout: buildOutput, stderr: buildError } = await execAsync(buildCommand, { 
      cwd: workDir,
      timeout: 600000 // 10 minutes timeout for full stack build
    });
    
    if (buildError && !buildError.includes('SECURITY WARNING') && !buildError.includes('DEPRECATED')) {
      status.logs.push(`Build warnings: ${buildError}`);
    }
    
    status.logs.push('Docker images built successfully');
    if (buildOutput) {
      status.logs.push(buildOutput.slice(-500)); // Last 500 chars to avoid too much output
    }
    
    // Update status to deploying
    status.status = 'deploying';
    status.logs.push('Starting full Backstage stack...');
    
    // Start services using Docker Compose
    const upCommand = `docker-compose up -d`;
    
    const { stdout: upOutput } = await execAsync(upCommand, { cwd: workDir });
    status.logs.push('Services started via Docker Compose');
    status.logs.push(upOutput);
    
    // Wait for services to be healthy
    status.logs.push('Waiting for services to be ready...');
    let retries = 0;
    const maxRetries = 60; // Longer wait time for full stack
    
    while (retries < maxRetries) {
      try {
        // Check if frontend is accessible (via nginx proxy)
        const { stdout: healthOutput } = await execAsync(`curl -f http://localhost/health`, { timeout: 5000 });
        status.logs.push('Health check passed - services are ready');
        break;
      } catch (error) {
        retries++;
        if (retries === maxRetries) {
          // Try direct backend check as fallback
          try {
            await execAsync(`curl -f http://localhost:7007/api/health`, { timeout: 5000 });
            status.logs.push('Backend health check passed');
            break;
          } catch (backendError) {
            throw new Error('Services failed to start - health check timeout');
          }
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Set service URLs for the orchestrated stack
    status.serviceUrl = 'http://localhost:3000';  // Frontend via nginx
    status.healthCheckUrl = 'http://localhost:7007/api/health';  // Backend health
    
    // Store container info for management
    try {
      const { stdout: containerList } = await execAsync(`docker-compose ps -q`, { cwd: workDir });
      const containerIds = containerList.trim().split('\n').filter(id => id.trim());
      if (containerIds.length > 0) {
        status.containerId = containerIds[0]; // Primary container for management
      }
    } catch (containerError) {
      status.logs.push(`Warning: Could not get container IDs: ${containerError}`);
    }
    
    // Update final status
    status.status = 'running';
    status.completedAt = new Date().toISOString();
    status.logs.push(`Plugin ${pluginId} is now running at ${status.serviceUrl}`);
    
    return status;
    
  } catch (error) {
    const status = installationStore.get(installId)!;
    status.status = 'failed';
    status.error = error instanceof Error ? error.message : String(error);
    status.logs.push(`Installation failed: ${status.error}`);
    status.completedAt = new Date().toISOString();
    
    // Cleanup on failure
    try {
      if (status.containerId) {
        await execAsync(`docker rm -f ${status.containerId}`);
      }
      await fs.rm(workDir, { recursive: true, force: true });
    } catch (cleanupError) {
      status.logs.push(`Cleanup error: ${cleanupError}`);
    }
    
    throw error;
  }
};

// Install plugin on Kubernetes
const installPluginKubernetes = async (installId: string, pluginId: string, namespace: string, version: string = 'latest') => {
  const status = installationStore.get(installId)!;
  
  try {
    status.status = 'building';
    status.namespace = namespace;
    status.logs.push(`Building plugin for Kubernetes deployment in namespace: ${namespace}`);
    
    // First build the Docker image locally (same as local install)
    const workDir = path.join(process.cwd(), 'plugin-runtime', installId);
    await fs.mkdir(workDir, { recursive: true });
    
    // Create package.json and Dockerfile (same as local)
    const packageJson = createPluginPackageJson(pluginId, version);
    await fs.writeFile(path.join(workDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    await fs.writeFile(path.join(workDir, 'yarn.lock'), '');
    
    const dockerfile = createPluginDockerfile(pluginId, version);
    await fs.writeFile(path.join(workDir, 'Dockerfile'), dockerfile);
    
    // Build Docker image
    const imageName = `backstage-plugin-${pluginId.replace(/[@\/]/g, '-').toLowerCase()}:latest`;
    const buildCommand = `docker build -t ${imageName} .`;
    
    const { stdout: buildOutput } = await execAsync(buildCommand, { cwd: workDir, timeout: 300000 });
    status.logs.push('Docker image built for Kubernetes');
    status.logs.push(buildOutput);
    
    // Create Kubernetes manifests
    const manifests = createKubernetesManifest(pluginId, namespace, installId);
    
    status.status = 'deploying';
    status.logs.push('Deploying to Kubernetes...');
    
    // Apply namespace
    const namespaceManifest = JSON.stringify(manifests[0], null, 2);
    await fs.writeFile(path.join(workDir, 'namespace.yaml'), namespaceManifest);
    await execAsync(`kubectl apply -f ${path.join(workDir, 'namespace.yaml')}`);
    
    status.logs.push(`Created namespace: ${namespace}`);
    
    // Load Docker image to kind/minikube (if using local cluster)
    try {
      await execAsync(`kind load docker-image ${imageName}`);
      status.logs.push('Loaded image to kind cluster');
    } catch (error) {
      // Try minikube
      try {
        await execAsync(`minikube image load ${imageName}`);
        status.logs.push('Loaded image to minikube');
      } catch (minikubeError) {
        status.logs.push('Warning: Could not load image to local cluster. Ensure image is available in cluster.');
      }
    }
    
    // Apply deployment
    const deploymentManifest = JSON.stringify(manifests[1], null, 2);
    await fs.writeFile(path.join(workDir, 'deployment.yaml'), deploymentManifest);
    await execAsync(`kubectl apply -f ${path.join(workDir, 'deployment.yaml')}`);
    
    status.logs.push('Created deployment');
    
    // Apply service
    const serviceManifest = JSON.stringify(manifests[2], null, 2);
    await fs.writeFile(path.join(workDir, 'service.yaml'), serviceManifest);
    await execAsync(`kubectl apply -f ${path.join(workDir, 'service.yaml')}`);
    
    status.logs.push('Created service');
    
    // Wait for deployment to be ready
    const deploymentName = `backstage-plugin-${pluginId.replace(/[@\/]/g, '-').toLowerCase()}`;
    await execAsync(`kubectl wait --for=condition=available --timeout=300s deployment/${deploymentName} -n ${namespace}`);
    
    status.logs.push('Deployment is ready');
    
    // Get service URL
    try {
      const { stdout: serviceOutput } = await execAsync(`kubectl get service ${deploymentName}-service -n ${namespace} -o jsonpath='{.status.loadBalancer.ingress[0].ip}'`);
      if (serviceOutput) {
        status.serviceUrl = `http://${serviceOutput}:3000`;
        status.healthCheckUrl = `http://${serviceOutput}:7007/api/health`;
      } else {
        // For local clusters, use port-forward
        status.serviceUrl = `http://localhost:3000 (use: kubectl port-forward svc/${deploymentName}-service 3000:3000 -n ${namespace})`;
        status.healthCheckUrl = `http://localhost:7007/api/health`;
      }
    } catch (error) {
      status.serviceUrl = `kubectl port-forward svc/${deploymentName}-service 3000:3000 -n ${namespace}`;
      status.healthCheckUrl = `kubectl port-forward svc/${deploymentName}-service 7007:7007 -n ${namespace}`;
    }
    
    // Update final status
    status.status = 'running';
    status.completedAt = new Date().toISOString();
    status.logs.push(`Plugin ${pluginId} deployed successfully to Kubernetes namespace: ${namespace}`);
    
    return status;
    
  } catch (error) {
    status.status = 'failed';
    status.error = error instanceof Error ? error.message : String(error);
    status.logs.push(`Kubernetes deployment failed: ${status.error}`);
    status.completedAt = new Date().toISOString();
    
    // Cleanup on failure
    try {
      if (namespace) {
        await execAsync(`kubectl delete namespace ${namespace}`);
      }
    } catch (cleanupError) {
      status.logs.push(`Cleanup error: ${cleanupError}`);
    }
    
    throw error;
  }
};

export async function POST(request: NextRequest) {
  try {
    const { pluginId, version = 'latest', environment = 'local', config = {}, namespace }: PluginInstallRequest = await request.json();
    
    if (!pluginId) {
      return NextResponse.json({
        success: false,
        error: 'Plugin ID is required'
      }, { status: 400 });
    }
    
    // Generate installation ID
    const installId = generateInstallId(pluginId);
    
    // Initialize installation status
    const status: PluginInstallStatus = {
      pluginId,
      status: 'pending',
      logs: [`Starting installation of ${pluginId}@${version} in ${environment} environment`],
      startedAt: new Date().toISOString(),
      resources: {
        cpu: environment === 'kubernetes' ? '500m' : '1 core',
        memory: environment === 'kubernetes' ? '1Gi' : '1GB',
        storage: '2GB'
      }
    };
    
    installationStore.set(installId, status);
    
    // Start installation process asynchronously
    (async () => {
      try {
        if (environment === 'kubernetes') {
          const finalNamespace = namespace || `backstage-plugin-${pluginId.replace(/[@\/]/g, '-').toLowerCase()}`;
          await installPluginKubernetes(installId, pluginId, finalNamespace, version);
        } else {
          await installPluginLocal(installId, pluginId, version, config);
        }
      } catch (error) {
        console.error(`Plugin installation failed for ${installId}:`, error);
      }
    })();
    
    return NextResponse.json({
      success: true,
      installId,
      message: `Plugin installation started for ${pluginId}`,
      status: status.status,
      environment,
      estimatedTime: environment === 'kubernetes' ? '5-10 minutes' : '3-7 minutes'
    });
    
  } catch (error) {
    console.error('Error starting plugin installation:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to start plugin installation'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const installId = searchParams.get('installId');
    const action = searchParams.get('action') || 'status';
    
    if (action === 'list') {
      // Get Docker/K8s installations from in-memory store
      const dockerInstallations = Array.from(installationStore.entries()).map(([id, status]) => ({
        installId: id,
        pluginName: status.pluginId.replace(/@[^/]+\//, '').replace(/plugin-/, ''),
        version: 'latest',
        status: status.status,
        environment: status.namespace ? 'kubernetes' : 'local',
        namespace: status.namespace,
        serviceUrl: status.serviceUrl,
        healthCheckUrl: status.healthCheckUrl,
        startedAt: status.startedAt,
        lastCheck: new Date().toISOString(),
        ...status
      }));
      
      // Get simple database installations
      const { getSafePrismaClient } = await import('@/lib/db/safe-client');
      const prisma = getSafePrismaClient();
      
      let dbInstallations: any[] = [];
      try {
        const plugins = await prisma.plugin.findMany({
          where: {
            isInstalled: true
          },
          select: {
            id: true,
            name: true,
            displayName: true,
            description: true,
            category: true,
            isInstalled: true,
            isEnabled: true,
            status: true,
            lifecycle: true,
            installedAt: true,
            updatedAt: true,
            configurations: {
              where: { environment: 'production' },
              select: {
                config: true,
                isActive: true,
                environment: true
              }
            }
          },
          orderBy: { installedAt: 'desc' }
        });
        
        dbInstallations = plugins.map(plugin => ({
          installId: plugin.id,
          pluginId: plugin.name,
          pluginName: plugin.displayName || plugin.name.replace(/@[^/]+\//, '').replace(/plugin-/, ''),
          version: 'latest',
          status: getPluginStatus(plugin.status, plugin.isEnabled),
          environment: 'database', // Mark as database-managed
          namespace: null,
          serviceUrl: null,
          healthCheckUrl: null,
          startedAt: plugin.installedAt || plugin.updatedAt,
          lastCheck: plugin.updatedAt,
          description: plugin.description,
          category: plugin.category,
          configurations: plugin.configurations,
          logs: [`Plugin ${plugin.name} installed via marketplace`],
          resources: {
            cpu: 'N/A',
            memory: 'N/A',
            storage: 'N/A'
          }
        }));
      } catch (error) {
        console.error('Failed to fetch database plugins:', error);
      }
      
      // Combine both types
      const allInstallations = [...dockerInstallations, ...dbInstallations];
      
      return NextResponse.json({
        success: true,
        installations: allInstallations,
        total: allInstallations.length
      });
    }
    
    if (!installId) {
      return NextResponse.json({
        success: false,
        error: 'Installation ID is required'
      }, { status: 400 });
    }
    
    const status = installationStore.get(installId);
    
    if (!status) {
      return NextResponse.json({
        success: false,
        error: 'Installation not found'
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      installId,
      ...status
    });
    
  } catch (error) {
    console.error('Error getting plugin installation status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get installation status'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const installId = searchParams.get('installId');
    
    if (!installId) {
      return NextResponse.json({
        success: false,
        error: 'Installation ID is required'
      }, { status: 400 });
    }
    
    // Check if it's a Docker/K8s installation first
    const dockerStatus = installationStore.get(installId);
    
    if (dockerStatus) {
      // Handle Docker/K8s installation deletion
      if (dockerStatus.containerId) {
        try {
          await execAsync(`docker rm -f ${dockerStatus.containerId}`);
          dockerStatus.logs.push('Container stopped and removed');
        } catch (error) {
          dockerStatus.logs.push(`Failed to remove container: ${error}`);
        }
      }
      
      if (dockerStatus.namespace) {
        try {
          await execAsync(`kubectl delete namespace ${dockerStatus.namespace}`);
          dockerStatus.logs.push(`Namespace ${dockerStatus.namespace} deleted`);
        } catch (error) {
          dockerStatus.logs.push(`Failed to delete namespace: ${error}`);
        }
      }
      
      const workDir = path.join(process.cwd(), 'plugin-runtime', installId);
      try {
        await fs.rm(workDir, { recursive: true, force: true });
        dockerStatus.logs.push('Workspace cleaned up');
      } catch (error) {
        dockerStatus.logs.push(`Failed to clean workspace: ${error}`);
      }
      
      dockerStatus.status = 'stopped';
      dockerStatus.completedAt = new Date().toISOString();
      
      return NextResponse.json({
        success: true,
        message: `Plugin installation ${installId} stopped and cleaned up`
      });
    }
    
    // If not Docker/K8s, check if it's a database plugin
    const { getSafePrismaClient } = await import('@/lib/db/safe-client');
    const prisma = getSafePrismaClient();
    
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { id: installId }
      });
      
      if (!plugin) {
        return NextResponse.json({
          success: false,
          error: 'Plugin not found'
        }, { status: 404 });
      }
      
      // Delete the plugin from database
      await prisma.plugin.delete({
        where: { id: installId }
      });
      
      return NextResponse.json({
        success: true,
        message: `Plugin ${plugin.displayName || plugin.name} uninstalled successfully`
      });
      
    } catch (dbError) {
      console.error('Database plugin deletion error:', dbError);
      return NextResponse.json({
        success: false,
        error: 'Failed to uninstall plugin from database'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Error stopping plugin installation:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to stop plugin installation'
    }, { status: 500 });
  }
}