import Docker from 'dockerode';
import * as k8s from '@kubernetes/client-node';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import tar from 'tar-stream';
import { Readable } from 'stream';

const execAsync = promisify(exec);

interface PluginContainer {
  id: string;
  pluginId: string;
  version: string;
  containerId?: string;
  podName?: string;
  namespace: string;
  status: 'building' | 'running' | 'stopped' | 'failed';
  ports: { internal: number; external: number }[];
  environment: Record<string, string>;
  resources: {
    cpuLimit: string;
    memoryLimit: string;
    cpuRequest: string;
    memoryRequest: string;
  };
  health: {
    status: 'healthy' | 'unhealthy' | 'unknown';
    lastCheck: Date;
    checks: {
      liveness: boolean;
      readiness: boolean;
      startup: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export class RealDockerInstaller {
  private docker: Docker;
  private k8sApi?: k8s.CoreV1Api;
  private k8sAppsApi?: k8s.AppsV1Api;
  private k8sConfig?: k8s.KubeConfig;
  private useKubernetes: boolean;
  private registry: string;
  private namespace: string;

  constructor(options: {
    useKubernetes?: boolean;
    dockerHost?: string;
    registry?: string;
    namespace?: string;
  } = {}) {
    this.docker = new Docker({
      socketPath: options.dockerHost || '/var/run/docker.sock'
    });
    
    this.useKubernetes = options.useKubernetes || false;
    this.registry = options.registry || 'localhost:5000';
    this.namespace = options.namespace || 'backstage-plugins';

    if (this.useKubernetes) {
      this.initKubernetes();
    }
  }

  private initKubernetes() {
    this.k8sConfig = new k8s.KubeConfig();
    this.k8sConfig.loadFromDefault();
    
    this.k8sApi = this.k8sConfig.makeApiClient(k8s.CoreV1Api);
    this.k8sAppsApi = this.k8sConfig.makeApiClient(k8s.AppsV1Api);
  }

  async installPlugin(pluginId: string, options: {
    version?: string;
    configuration?: Record<string, any>;
    environment?: Record<string, string>;
    resources?: {
      cpuLimit?: string;
      memoryLimit?: string;
    };
  } = {}): Promise<PluginContainer> {
    const version = options.version || 'latest';
    const containerId = `plugin-${pluginId}-${crypto.randomBytes(4).toString('hex')}`;
    
    const container: PluginContainer = {
      id: containerId,
      pluginId,
      version,
      namespace: this.namespace,
      status: 'building',
      ports: [],
      environment: options.environment || {},
      resources: {
        cpuLimit: options.resources?.cpuLimit || '1',
        memoryLimit: options.resources?.memoryLimit || '512Mi',
        cpuRequest: '100m',
        memoryRequest: '128Mi'
      },
      health: {
        status: 'unknown',
        lastCheck: new Date(),
        checks: {
          liveness: false,
          readiness: false,
          startup: false
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      // Build Docker image for the plugin
      const imageName = await this.buildPluginImage(pluginId, version, options.configuration);
      
      if (this.useKubernetes) {
        // Deploy to Kubernetes
        await this.deployToKubernetes(container, imageName);
      } else {
        // Run in Docker
        await this.runInDocker(container, imageName);
      }

      container.status = 'running';
      
      // Start health monitoring
      this.startHealthMonitoring(container);
      
      return container;
    } catch (error) {
      container.status = 'failed';
      throw error;
    }
  }

  private async buildPluginImage(
    pluginId: string, 
    version: string,
    configuration?: Record<string, any>
  ): Promise<string> {
    const imageName = `${this.registry}/backstage-plugin-${pluginId}:${version}`;
    
    // Create Dockerfile content
    const dockerfile = this.generateDockerfile(pluginId, version, configuration);
    
    // Create a tar stream with the Dockerfile
    const pack = tar.pack();
    pack.entry({ name: 'Dockerfile' }, dockerfile);
    
    // Add plugin configuration if provided
    if (configuration) {
      pack.entry(
        { name: 'config.json' },
        JSON.stringify(configuration, null, 2)
      );
    }

    // Add startup script
    const startupScript = this.generateStartupScript(pluginId);
    pack.entry({ name: 'start.sh', mode: 0o755 }, startupScript);

    pack.finalize();

    // Build the image
    const stream = await this.docker.buildImage(pack as any, {
      t: imageName,
      buildargs: {
        PLUGIN_ID: pluginId,
        PLUGIN_VERSION: version
      }
    });

    // Wait for build to complete
    await new Promise((resolve, reject) => {
      this.docker.modem.followProgress(stream, (err: any, res: any) => {
        if (err) reject(err);
        else resolve(res);
      });
    });

    // Push to registry if not local
    if (!this.registry.startsWith('localhost')) {
      await this.pushImage(imageName);
    }

    return imageName;
  }

  private generateDockerfile(
    pluginId: string,
    version: string,
    configuration?: Record<string, any>
  ): string {
    return `
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Set working directory
WORKDIR /app

# Install Backstage CLI
RUN npm install -g @backstage/cli@latest

# Create plugin package.json
RUN echo '{ \
  "name": "@backstage/plugin-${pluginId}", \
  "version": "${version}", \
  "main": "dist/index.js", \
  "types": "dist/index.d.ts", \
  "private": true, \
  "dependencies": { \
    "@backstage/core-app-api": "^1.12.0", \
    "@backstage/core-components": "^0.14.0", \
    "@backstage/core-plugin-api": "^1.9.0", \
    "@backstage/plugin-catalog-react": "^1.11.0", \
    "@material-ui/core": "^4.12.4", \
    "@material-ui/icons": "^4.11.3", \
    "@material-ui/lab": "^4.0.0-alpha.61", \
    "react": "^18.2.0", \
    "react-dom": "^18.2.0", \
    "react-router-dom": "^6.20.0" \
  }, \
  "devDependencies": { \
    "@backstage/cli": "^0.25.0", \
    "@backstage/test-utils": "^1.5.0", \
    "@types/node": "^20.10.0", \
    "@types/react": "^18.2.0", \
    "typescript": "^5.3.0" \
  }, \
  "scripts": { \
    "build": "backstage-cli package build", \
    "start": "backstage-cli package start", \
    "lint": "backstage-cli package lint", \
    "test": "backstage-cli package test" \
  } \
}' > package.json

# Install dependencies
RUN npm install

# Copy plugin source (would be fetched from registry in production)
COPY . .

# Build the plugin
RUN npm run build

# Production stage
FROM node:18-alpine

RUN apk add --no-cache curl

WORKDIR /app

# Copy built plugin from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Add configuration if provided
${configuration ? 'COPY config.json ./config.json' : ''}

# Add startup script
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Expose plugin port
EXPOSE 7007

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:7007/health || exit 1

# Run the plugin
CMD ["./start.sh"]
`;
  }

  private generateStartupScript(pluginId: string): string {
    return `#!/bin/sh
set -e

echo "Starting Backstage plugin: ${pluginId}"

# Set environment variables
export NODE_ENV=production
export PLUGIN_ID=${pluginId}
export PORT=7007

# Check if config exists and export as env vars
if [ -f config.json ]; then
  echo "Loading configuration..."
  export CONFIG=$(cat config.json)
fi

# Start the plugin server
exec node dist/index.js
`;
  }

  private async deployToKubernetes(
    container: PluginContainer,
    imageName: string
  ): Promise<void> {
    if (!this.k8sApi || !this.k8sAppsApi) {
      throw new Error('Kubernetes API not initialized');
    }

    // Create namespace if it doesn't exist
    try {
      await this.k8sApi.readNamespace(this.namespace);
    } catch {
      await this.k8sApi.createNamespace({
        metadata: { name: this.namespace }
      });
    }

    // Create deployment
    const deployment: k8s.V1Deployment = {
      metadata: {
        name: `plugin-${container.pluginId}`,
        namespace: this.namespace,
        labels: {
          app: 'backstage-plugin',
          plugin: container.pluginId,
          version: container.version
        }
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: 'backstage-plugin',
            plugin: container.pluginId
          }
        },
        template: {
          metadata: {
            labels: {
              app: 'backstage-plugin',
              plugin: container.pluginId,
              version: container.version
            }
          },
          spec: {
            containers: [{
              name: container.pluginId,
              image: imageName,
              imagePullPolicy: 'Always',
              ports: [{
                containerPort: 7007,
                protocol: 'TCP'
              }],
              env: Object.entries(container.environment).map(([name, value]) => ({
                name,
                value
              })),
              resources: {
                limits: {
                  cpu: container.resources.cpuLimit,
                  memory: container.resources.memoryLimit
                },
                requests: {
                  cpu: container.resources.cpuRequest,
                  memory: container.resources.memoryRequest
                }
              },
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: 7007
                },
                initialDelaySeconds: 30,
                periodSeconds: 10
              },
              readinessProbe: {
                httpGet: {
                  path: '/ready',
                  port: 7007
                },
                initialDelaySeconds: 5,
                periodSeconds: 5
              }
            }]
          }
        }
      }
    };

    await this.k8sAppsApi.createNamespacedDeployment(this.namespace, deployment);

    // Create service
    const service: k8s.V1Service = {
      metadata: {
        name: `plugin-${container.pluginId}-svc`,
        namespace: this.namespace,
        labels: {
          app: 'backstage-plugin',
          plugin: container.pluginId
        }
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          app: 'backstage-plugin',
          plugin: container.pluginId
        },
        ports: [{
          port: 80,
          targetPort: 7007,
          protocol: 'TCP'
        }]
      }
    };

    await this.k8sApi.createNamespacedService(this.namespace, service);

    // Store pod name for monitoring
    const pods = await this.k8sApi.listNamespacedPod(
      this.namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      `app=backstage-plugin,plugin=${container.pluginId}`
    );

    if (pods.body.items.length > 0) {
      container.podName = pods.body.items[0].metadata?.name;
    }
  }

  private async runInDocker(
    container: PluginContainer,
    imageName: string
  ): Promise<void> {
    // Find available port
    const hostPort = await this.findAvailablePort();
    
    // Create and start container
    const dockerContainer = await this.docker.createContainer({
      Image: imageName,
      name: container.id,
      Env: Object.entries(container.environment).map(
        ([key, value]) => `${key}=${value}`
      ),
      ExposedPorts: {
        '7007/tcp': {}
      },
      HostConfig: {
        PortBindings: {
          '7007/tcp': [{ HostPort: hostPort.toString() }]
        },
        RestartPolicy: {
          Name: 'unless-stopped'
        },
        Memory: this.parseMemoryLimit(container.resources.memoryLimit),
        CpuQuota: this.parseCpuLimit(container.resources.cpuLimit) * 100000,
        CpuPeriod: 100000
      },
      Labels: {
        'backstage.plugin.id': container.pluginId,
        'backstage.plugin.version': container.version
      }
    });

    await dockerContainer.start();
    
    container.containerId = dockerContainer.id;
    container.ports = [{
      internal: 7007,
      external: hostPort
    }];
  }

  private async findAvailablePort(): Promise<number> {
    const minPort = 30000;
    const maxPort = 32000;
    
    const containers = await this.docker.listContainers();
    const usedPorts = new Set<number>();
    
    containers.forEach(container => {
      container.Ports?.forEach(port => {
        if (port.PublicPort) {
          usedPorts.add(port.PublicPort);
        }
      });
    });

    for (let port = minPort; port <= maxPort; port++) {
      if (!usedPorts.has(port)) {
        return port;
      }
    }

    throw new Error('No available ports in range');
  }

  private parseMemoryLimit(limit: string): number {
    const units: Record<string, number> = {
      'Ki': 1024,
      'Mi': 1024 * 1024,
      'Gi': 1024 * 1024 * 1024
    };

    for (const [unit, multiplier] of Object.entries(units)) {
      if (limit.endsWith(unit)) {
        return parseInt(limit.slice(0, -unit.length)) * multiplier;
      }
    }

    return parseInt(limit);
  }

  private parseCpuLimit(limit: string): number {
    if (limit.endsWith('m')) {
      return parseInt(limit.slice(0, -1)) / 1000;
    }
    return parseFloat(limit);
  }

  private async pushImage(imageName: string): Promise<void> {
    const image = this.docker.getImage(imageName);
    const stream = await image.push({});
    
    await new Promise((resolve, reject) => {
      this.docker.modem.followProgress(stream, (err: any, res: any) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
  }

  private startHealthMonitoring(container: PluginContainer): void {
    const checkHealth = async () => {
      try {
        if (container.containerId) {
          // Docker health check
          const dockerContainer = this.docker.getContainer(container.containerId);
          const info = await dockerContainer.inspect();
          
          container.health.status = info.State.Health?.Status === 'healthy' 
            ? 'healthy' 
            : 'unhealthy';
          
          container.health.lastCheck = new Date();
        } else if (container.podName && this.k8sApi) {
          // Kubernetes health check
          const pod = await this.k8sApi.readNamespacedPod(
            container.podName,
            this.namespace
          );
          
          const containerStatus = pod.body.status?.containerStatuses?.[0];
          
          if (containerStatus) {
            container.health.checks.liveness = containerStatus.ready || false;
            container.health.checks.readiness = containerStatus.ready || false;
            container.health.checks.startup = containerStatus.started || false;
            
            container.health.status = containerStatus.ready 
              ? 'healthy' 
              : 'unhealthy';
          }
          
          container.health.lastCheck = new Date();
        }
      } catch (error) {
        console.error(`Health check failed for ${container.pluginId}:`, error);
        container.health.status = 'unknown';
      }
    };

    // Check health every 30 seconds
    setInterval(checkHealth, 30000);
    
    // Initial check after 10 seconds
    setTimeout(checkHealth, 10000);
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    if (this.useKubernetes && this.k8sAppsApi && this.k8sApi) {
      // Delete Kubernetes resources
      await this.k8sAppsApi.deleteNamespacedDeployment(
        `plugin-${pluginId}`,
        this.namespace
      );
      
      await this.k8sApi.deleteNamespacedService(
        `plugin-${pluginId}-svc`,
        this.namespace
      );
    } else {
      // Stop and remove Docker container
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: [`backstage.plugin.id=${pluginId}`]
        }
      });

      for (const containerInfo of containers) {
        const container = this.docker.getContainer(containerInfo.Id);
        
        try {
          await container.stop();
        } catch (error) {
          // Container might already be stopped
        }
        
        await container.remove();
      }
    }

    // Remove image
    try {
      const imageName = `${this.registry}/backstage-plugin-${pluginId}`;
      const image = this.docker.getImage(imageName);
      await image.remove();
    } catch (error) {
      // Image might not exist locally
    }
  }

  async getPluginStatus(pluginId: string): Promise<PluginContainer | null> {
    if (this.useKubernetes && this.k8sApi) {
      // Get Kubernetes pod status
      const pods = await this.k8sApi.listNamespacedPod(
        this.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        `app=backstage-plugin,plugin=${pluginId}`
      );

      if (pods.body.items.length === 0) {
        return null;
      }

      const pod = pods.body.items[0];
      const containerStatus = pod.status?.containerStatuses?.[0];

      return {
        id: pod.metadata?.uid || '',
        pluginId,
        version: pod.metadata?.labels?.version || 'unknown',
        podName: pod.metadata?.name,
        namespace: this.namespace,
        status: containerStatus?.ready ? 'running' : 'stopped',
        ports: [],
        environment: {},
        resources: {
          cpuLimit: '1',
          memoryLimit: '512Mi',
          cpuRequest: '100m',
          memoryRequest: '128Mi'
        },
        health: {
          status: containerStatus?.ready ? 'healthy' : 'unhealthy',
          lastCheck: new Date(),
          checks: {
            liveness: containerStatus?.ready || false,
            readiness: containerStatus?.ready || false,
            startup: containerStatus?.started || false
          }
        },
        createdAt: new Date(pod.metadata?.creationTimestamp || ''),
        updatedAt: new Date()
      };
    } else {
      // Get Docker container status
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: [`backstage.plugin.id=${pluginId}`]
        }
      });

      if (containers.length === 0) {
        return null;
      }

      const containerInfo = containers[0];
      const container = this.docker.getContainer(containerInfo.Id);
      const info = await container.inspect();

      return {
        id: info.Id,
        pluginId,
        version: containerInfo.Labels['backstage.plugin.version'] || 'unknown',
        containerId: info.Id,
        namespace: this.namespace,
        status: info.State.Running ? 'running' : 'stopped',
        ports: containerInfo.Ports?.map(p => ({
          internal: p.PrivatePort,
          external: p.PublicPort || 0
        })) || [],
        environment: {},
        resources: {
          cpuLimit: '1',
          memoryLimit: '512Mi',
          cpuRequest: '100m',
          memoryRequest: '128Mi'
        },
        health: {
          status: info.State.Health?.Status === 'healthy' ? 'healthy' : 'unhealthy',
          lastCheck: new Date(),
          checks: {
            liveness: info.State.Running,
            readiness: info.State.Running,
            startup: true
          }
        },
        createdAt: new Date(info.Created),
        updatedAt: new Date()
      };
    }
  }

  async listInstalledPlugins(): Promise<PluginContainer[]> {
    const plugins: PluginContainer[] = [];

    if (this.useKubernetes && this.k8sApi) {
      // List Kubernetes pods
      const pods = await this.k8sApi.listNamespacedPod(
        this.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        'app=backstage-plugin'
      );

      for (const pod of pods.body.items) {
        const pluginId = pod.metadata?.labels?.plugin;
        if (pluginId) {
          const status = await this.getPluginStatus(pluginId);
          if (status) {
            plugins.push(status);
          }
        }
      }
    } else {
      // List Docker containers
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: ['backstage.plugin.id']
        }
      });

      for (const containerInfo of containers) {
        const pluginId = containerInfo.Labels['backstage.plugin.id'];
        if (pluginId) {
          const status = await this.getPluginStatus(pluginId);
          if (status) {
            plugins.push(status);
          }
        }
      }
    }

    return plugins;
  }

  async restartPlugin(pluginId: string): Promise<void> {
    if (this.useKubernetes && this.k8sAppsApi) {
      // Restart Kubernetes deployment
      const deployment = await this.k8sAppsApi.readNamespacedDeployment(
        `plugin-${pluginId}`,
        this.namespace
      );

      // Update annotation to trigger restart
      deployment.body.spec!.template.metadata = deployment.body.spec!.template.metadata || {};
      deployment.body.spec!.template.metadata.annotations = {
        ...deployment.body.spec!.template.metadata.annotations,
        'kubectl.kubernetes.io/restartedAt': new Date().toISOString()
      };

      await this.k8sAppsApi.replaceNamespacedDeployment(
        `plugin-${pluginId}`,
        this.namespace,
        deployment.body
      );
    } else {
      // Restart Docker container
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: [`backstage.plugin.id=${pluginId}`]
        }
      });

      if (containers.length > 0) {
        const container = this.docker.getContainer(containers[0].Id);
        await container.restart();
      }
    }
  }

  async getPluginLogs(
    pluginId: string, 
    options: { tail?: number; since?: Date } = {}
  ): Promise<string> {
    if (this.useKubernetes && this.k8sApi) {
      // Get Kubernetes pod logs
      const pods = await this.k8sApi.listNamespacedPod(
        this.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        `app=backstage-plugin,plugin=${pluginId}`
      );

      if (pods.body.items.length === 0) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      const podName = pods.body.items[0].metadata?.name;
      if (!podName) {
        throw new Error('Pod name not found');
      }

      const logs = await this.k8sApi.readNamespacedPodLog(
        podName,
        this.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        options.since ? Math.floor(options.since.getTime() / 1000) : undefined,
        options.tail
      );

      return logs.body;
    } else {
      // Get Docker container logs
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: [`backstage.plugin.id=${pluginId}`]
        }
      });

      if (containers.length === 0) {
        throw new Error(`Plugin ${pluginId} not found`);
      }

      const container = this.docker.getContainer(containers[0].Id);
      const stream = await container.logs({
        stdout: true,
        stderr: true,
        tail: options.tail,
        since: options.since ? Math.floor(options.since.getTime() / 1000) : undefined
      });

      return stream.toString();
    }
  }

  async scalePlugin(pluginId: string, replicas: number): Promise<void> {
    if (!this.useKubernetes || !this.k8sAppsApi) {
      throw new Error('Scaling is only available in Kubernetes mode');
    }

    const deployment = await this.k8sAppsApi.readNamespacedDeployment(
      `plugin-${pluginId}`,
      this.namespace
    );

    deployment.body.spec!.replicas = replicas;

    await this.k8sAppsApi.replaceNamespacedDeployment(
      `plugin-${pluginId}`,
      this.namespace,
      deployment.body
    );
  }
}