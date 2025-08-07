/**
 * Docker API Mock Service
 * Mock implementation of Docker APIs for testing containerized plugin deployments
 */

import { EventEmitter } from 'events';

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: 'created' | 'running' | 'paused' | 'restarting' | 'removing' | 'exited' | 'dead';
  state: {
    running: boolean;
    paused: boolean;
    restarting: boolean;
    exitCode?: number;
    error?: string;
    startedAt: string;
    finishedAt?: string;
  };
  config: {
    hostname: string;
    domainname: string;
    user: string;
    env: string[];
    cmd: string[];
    image: string;
    volumes: Record<string, any>;
    workingDir: string;
    entrypoint: string[];
    labels: Record<string, string>;
  };
  networkSettings: {
    ports: Record<string, any>;
    networks: Record<string, any>;
    ipAddress?: string;
  };
  mounts: Array<{
    type: string;
    source: string;
    destination: string;
    mode: string;
    rw: boolean;
  }>;
  created: string;
}

export interface ImageInfo {
  id: string;
  parentId?: string;
  repoTags: string[];
  repoDigests: string[];
  created: string;
  size: number;
  virtualSize: number;
  sharedSize: number;
  labels: Record<string, string>;
  containers: number;
}

export interface DockerStats {
  containerId: string;
  name: string;
  cpu: {
    usage: number;
    system: number;
    percent: number;
  };
  memory: {
    usage: number;
    limit: number;
    percent: number;
  };
  network: {
    rx: number;
    tx: number;
  };
  disk: {
    read: number;
    write: number;
  };
  timestamp: string;
}

export interface DockerMockConfig {
  registry?: string;
  networkLatency?: number;
  pullSuccessRate?: number;
  containerStartSuccessRate?: number;
  enableResourceLimits?: boolean;
  simulateResourceContention?: boolean;
}

export class DockerMock extends EventEmitter {
  private containers = new Map<string, ContainerInfo>();
  private images = new Map<string, ImageInfo>();
  private config: DockerMockConfig;
  private resourceUsage = new Map<string, DockerStats>();
  private pullProgress = new Map<string, { current: number; total: number }>();

  constructor(config: DockerMockConfig = {}) {
    super();
    this.config = {
      registry: 'registry.hub.docker.com',
      networkLatency: 100,
      pullSuccessRate: 0.95,
      containerStartSuccessRate: 0.98,
      enableResourceLimits: true,
      simulateResourceContention: false,
      ...config
    };

    this.initializeDefaultImages();
    this.startResourceMonitoring();
  }

  private initializeDefaultImages() {
    const defaultImages = [
      {
        id: 'sha256:backstage-base',
        tags: ['backstage/backstage:latest'],
        size: 1.2e9, // 1.2GB
        created: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'sha256:nodejs-alpine',
        tags: ['node:18-alpine'],
        size: 150e6, // 150MB
        created: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'sha256:nginx-alpine',
        tags: ['nginx:alpine'],
        size: 50e6, // 50MB
        created: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    defaultImages.forEach(img => {
      const imageInfo: ImageInfo = {
        id: img.id,
        repoTags: img.tags,
        repoDigests: [`${this.config.registry}/${img.tags[0]}@${img.id}`],
        created: img.created,
        size: img.size,
        virtualSize: img.size,
        sharedSize: 0,
        labels: {
          'maintainer': 'backstage-team',
          'version': '1.0.0'
        },
        containers: 0
      };
      this.images.set(img.id, imageInfo);
    });
  }

  private startResourceMonitoring() {
    setInterval(() => {
      this.containers.forEach((container, id) => {
        if (container.state.running) {
          this.updateResourceUsage(id);
        }
      });
    }, 5000); // Update every 5 seconds
  }

  private updateResourceUsage(containerId: string) {
    const container = this.containers.get(containerId);
    if (!container) return;

    const baseLoad = this.config.simulateResourceContention ? 0.3 : 0.1;
    const variation = Math.random() * 0.2;

    const stats: DockerStats = {
      containerId,
      name: container.name,
      cpu: {
        usage: (baseLoad + variation) * 100,
        system: 100,
        percent: (baseLoad + variation) * 100
      },
      memory: {
        usage: (200 + Math.random() * 300) * 1024 * 1024, // 200-500MB
        limit: 512 * 1024 * 1024, // 512MB
        percent: (40 + Math.random() * 30) // 40-70%
      },
      network: {
        rx: Math.random() * 1000000, // Random bytes
        tx: Math.random() * 1000000
      },
      disk: {
        read: Math.random() * 10000000, // Random bytes
        write: Math.random() * 5000000
      },
      timestamp: new Date().toISOString()
    };

    this.resourceUsage.set(containerId, stats);
    this.emit('stats', stats);
  }

  private async simulateNetworkDelay() {
    if (this.config.networkLatency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.networkLatency));
    }
  }

  private generateContainerId(): string {
    return 'container_' + Math.random().toString(36).substring(2, 15);
  }

  private generateImageId(): string {
    return 'sha256:' + Math.random().toString(36).substring(2, 15);
  }

  // Container management methods
  async createContainer(options: {
    name?: string;
    image: string;
    env?: string[];
    ports?: Record<string, any>;
    volumes?: Record<string, any>;
    cmd?: string[];
    labels?: Record<string, string>;
    resources?: {
      memory?: string;
      cpu?: string;
    };
  }): Promise<{ id: string; warnings?: string[] }> {
    await this.simulateNetworkDelay();

    const containerId = this.generateContainerId();
    const warnings: string[] = [];

    // Check if image exists
    const imageExists = Array.from(this.images.values()).some(img => 
      img.repoTags.some(tag => tag.includes(options.image))
    );

    if (!imageExists) {
      warnings.push(`Image ${options.image} not found locally, will need to pull`);
      // Simulate pulling the image
      await this.pullImage(options.image);
    }

    const container: ContainerInfo = {
      id: containerId,
      name: options.name || `plugin-${containerId.substring(0, 8)}`,
      image: options.image,
      status: 'created',
      state: {
        running: false,
        paused: false,
        restarting: false,
        startedAt: new Date().toISOString()
      },
      config: {
        hostname: containerId.substring(0, 12),
        domainname: '',
        user: '',
        env: options.env || [],
        cmd: options.cmd || ['/app/start.sh'],
        image: options.image,
        volumes: options.volumes || {},
        workingDir: '/app',
        entrypoint: ['/entrypoint.sh'],
        labels: {
          'com.backstage.plugin': 'true',
          'com.backstage.version': '1.0.0',
          ...options.labels
        }
      },
      networkSettings: {
        ports: options.ports || {},
        networks: {
          backstage: {
            networkId: 'backstage-network',
            endpointId: 'endpoint-' + containerId.substring(0, 8)
          }
        }
      },
      mounts: [],
      created: new Date().toISOString()
    };

    // Resource validation
    if (this.config.enableResourceLimits && options.resources) {
      if (this.config.simulateResourceContention) {
        warnings.push('Resource contention detected, container may run slower');
      }
    }

    this.containers.set(containerId, container);
    this.emit('containerCreated', { id: containerId, name: container.name });

    return { id: containerId, warnings };
  }

  async startContainer(containerId: string): Promise<void> {
    await this.simulateNetworkDelay();

    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    // Simulate start failure
    if (Math.random() > this.config.containerStartSuccessRate!) {
      container.state.exitCode = 1;
      container.state.error = 'Failed to start container';
      container.status = 'exited';
      this.emit('containerFailed', { id: containerId, error: container.state.error });
      throw new Error(`Failed to start container ${containerId}`);
    }

    container.status = 'running';
    container.state.running = true;
    container.state.startedAt = new Date().toISOString();
    container.networkSettings.ipAddress = `172.17.0.${Math.floor(Math.random() * 254) + 2}`;

    this.containers.set(containerId, container);
    this.emit('containerStarted', { id: containerId, name: container.name });

    // Start monitoring resources
    this.updateResourceUsage(containerId);
  }

  async stopContainer(containerId: string): Promise<void> {
    await this.simulateNetworkDelay();

    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    container.status = 'exited';
    container.state.running = false;
    container.state.finishedAt = new Date().toISOString();
    container.state.exitCode = 0;

    this.containers.set(containerId, container);
    this.resourceUsage.delete(containerId);
    this.emit('containerStopped', { id: containerId, name: container.name });
  }

  async removeContainer(containerId: string, options: { force?: boolean } = {}): Promise<void> {
    await this.simulateNetworkDelay();

    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    if (container.state.running && !options.force) {
      throw new Error(`Cannot remove running container ${containerId}`);
    }

    if (container.state.running) {
      await this.stopContainer(containerId);
    }

    this.containers.delete(containerId);
    this.resourceUsage.delete(containerId);
    this.emit('containerRemoved', { id: containerId, name: container.name });
  }

  async inspectContainer(containerId: string): Promise<ContainerInfo> {
    await this.simulateNetworkDelay();

    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    return JSON.parse(JSON.stringify(container)); // Deep copy
  }

  async listContainers(options: { all?: boolean; filters?: Record<string, string[]> } = {}): Promise<ContainerInfo[]> {
    await this.simulateNetworkDelay();

    let containers = Array.from(this.containers.values());

    if (!options.all) {
      containers = containers.filter(c => c.state.running);
    }

    if (options.filters) {
      for (const [key, values] of Object.entries(options.filters)) {
        if (key === 'status') {
          containers = containers.filter(c => values.includes(c.status));
        } else if (key === 'label') {
          containers = containers.filter(c => {
            return values.some(value => {
              if (value.includes('=')) {
                const [labelKey, labelValue] = value.split('=');
                return c.config.labels[labelKey] === labelValue;
              } else {
                return c.config.labels.hasOwnProperty(value);
              }
            });
          });
        }
      }
    }

    return containers;
  }

  async getContainerLogs(containerId: string, options: { 
    since?: string;
    until?: string;
    tail?: number;
    follow?: boolean;
  } = {}): Promise<string[]> {
    await this.simulateNetworkDelay();

    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    // Simulate log entries
    const logs = [
      `[${new Date().toISOString()}] INFO Starting Backstage plugin...`,
      `[${new Date().toISOString()}] INFO Loading configuration...`,
      `[${new Date().toISOString()}] INFO Connecting to database...`,
      `[${new Date().toISOString()}] INFO Plugin initialized successfully`,
      `[${new Date().toISOString()}] INFO Server listening on port 3000`
    ];

    if (container.state.error) {
      logs.push(`[${new Date().toISOString()}] ERROR ${container.state.error}`);
    }

    let result = logs;
    if (options.tail && options.tail > 0) {
      result = logs.slice(-options.tail);
    }

    return result;
  }

  async getContainerStats(containerId: string): Promise<DockerStats> {
    await this.simulateNetworkDelay();

    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    if (!container.state.running) {
      throw new Error(`Container ${containerId} is not running`);
    }

    const stats = this.resourceUsage.get(containerId);
    if (!stats) {
      throw new Error(`No stats available for container ${containerId}`);
    }

    return stats;
  }

  // Image management methods
  async pullImage(imageName: string): Promise<void> {
    await this.simulateNetworkDelay();

    // Simulate pull failure
    if (Math.random() > this.config.pullSuccessRate!) {
      throw new Error(`Failed to pull image ${imageName}`);
    }

    const imageId = this.generateImageId();
    const image: ImageInfo = {
      id: imageId,
      repoTags: [imageName],
      repoDigests: [`${this.config.registry}/${imageName}@${imageId}`],
      created: new Date().toISOString(),
      size: Math.floor(Math.random() * 1000000000) + 100000000, // 100MB - 1GB
      virtualSize: 0,
      sharedSize: 0,
      labels: {
        'version': '1.0.0',
        'maintainer': 'backstage-team'
      },
      containers: 0
    };
    image.virtualSize = image.size;

    this.images.set(imageId, image);

    // Simulate pull progress
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(progressInterval);
        this.emit('pullComplete', { image: imageName, id: imageId });
      }
      this.emit('pullProgress', { image: imageName, progress: Math.floor(progress) });
    }, 200);
  }

  async listImages(): Promise<ImageInfo[]> {
    await this.simulateNetworkDelay();
    return Array.from(this.images.values());
  }

  async removeImage(imageId: string, options: { force?: boolean } = {}): Promise<void> {
    await this.simulateNetworkDelay();

    const image = this.images.get(imageId);
    if (!image) {
      throw new Error(`Image ${imageId} not found`);
    }

    // Check if image is being used by containers
    const usingContainers = Array.from(this.containers.values()).filter(c => 
      c.config.image === image.repoTags[0]
    );

    if (usingContainers.length > 0 && !options.force) {
      throw new Error(`Image ${imageId} is being used by ${usingContainers.length} containers`);
    }

    this.images.delete(imageId);
    this.emit('imageRemoved', { id: imageId, tags: image.repoTags });
  }

  // Network methods
  async createNetwork(options: {
    name: string;
    driver?: string;
    internal?: boolean;
    attachable?: boolean;
    labels?: Record<string, string>;
  }): Promise<{ id: string }> {
    await this.simulateNetworkDelay();

    const networkId = 'network_' + Math.random().toString(36).substring(2, 15);
    
    this.emit('networkCreated', { 
      id: networkId, 
      name: options.name,
      driver: options.driver || 'bridge'
    });

    return { id: networkId };
  }

  // System information
  async getSystemInfo(): Promise<any> {
    await this.simulateNetworkDelay();

    return {
      containers: this.containers.size,
      containersRunning: Array.from(this.containers.values()).filter(c => c.state.running).length,
      containersPaused: Array.from(this.containers.values()).filter(c => c.state.paused).length,
      containersStopped: Array.from(this.containers.values()).filter(c => !c.state.running).length,
      images: this.images.size,
      serverVersion: '20.10.0',
      apiVersion: '1.41',
      minAPIVersion: '1.12',
      gitCommit: 'mock-commit',
      goVersion: 'go1.19.0',
      os: 'linux',
      arch: 'amd64',
      kernelVersion: '5.4.0',
      totalMemory: 8589934592, // 8GB
      memoryLimit: true,
      swapLimit: true,
      cpuCfsPeriod: true,
      cpuCfsQuota: true,
      oomKillDisable: true
    };
  }

  // Test utilities
  simulateNetworkFailure() {
    this.config.pullSuccessRate = 0;
    this.config.containerStartSuccessRate = 0;
  }

  simulateResourceContention() {
    this.config.simulateResourceContention = true;
  }

  restoreNormalOperation() {
    this.config.pullSuccessRate = 0.95;
    this.config.containerStartSuccessRate = 0.98;
    this.config.simulateResourceContention = false;
  }

  // Cleanup for tests
  async cleanup(): Promise<void> {
    // Stop all running containers
    const runningContainers = Array.from(this.containers.values()).filter(c => c.state.running);
    for (const container of runningContainers) {
      await this.stopContainer(container.id);
    }

    // Remove all containers
    for (const containerId of this.containers.keys()) {
      await this.removeContainer(containerId, { force: true });
    }

    // Clear all data
    this.containers.clear();
    this.resourceUsage.clear();
    this.pullProgress.clear();
    
    // Reinitialize default images
    this.images.clear();
    this.initializeDefaultImages();
  }
}

// Singleton instance for easy testing
export const dockerMock = new DockerMock();

export default DockerMock;