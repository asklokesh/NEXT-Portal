/**
 * Kubernetes API Mock Service
 * Mock implementation of Kubernetes APIs for testing plugin deployments
 */

import { EventEmitter } from 'events';

export interface KubernetesResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    creationTimestamp?: string;
    resourceVersion?: string;
    uid?: string;
  };
  spec?: any;
  status?: any;
}

export interface Pod extends KubernetesResource {
  kind: 'Pod';
  spec: {
    containers: Array<{
      name: string;
      image: string;
      ports?: Array<{ containerPort: number; protocol?: string }>;
      env?: Array<{ name: string; value?: string; valueFrom?: any }>;
      resources?: {
        requests?: Record<string, string>;
        limits?: Record<string, string>;
      };
      volumeMounts?: Array<{ name: string; mountPath: string }>;
    }>;
    volumes?: Array<any>;
    restartPolicy?: string;
    serviceAccountName?: string;
    nodeSelector?: Record<string, string>;
  };
  status: {
    phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';
    conditions?: Array<{
      type: string;
      status: 'True' | 'False' | 'Unknown';
      lastTransitionTime?: string;
      reason?: string;
      message?: string;
    }>;
    containerStatuses?: Array<{
      name: string;
      ready: boolean;
      restartCount: number;
      image: string;
      imageID: string;
      state: any;
      lastState?: any;
    }>;
    hostIP?: string;
    podIP?: string;
    startTime?: string;
  };
}

export interface Deployment extends KubernetesResource {
  kind: 'Deployment';
  spec: {
    replicas?: number;
    selector: {
      matchLabels: Record<string, string>;
    };
    template: {
      metadata: {
        labels: Record<string, string>;
      };
      spec: Pod['spec'];
    };
    strategy?: {
      type: string;
      rollingUpdate?: {
        maxUnavailable?: string | number;
        maxSurge?: string | number;
      };
    };
  };
  status: {
    replicas?: number;
    readyReplicas?: number;
    availableReplicas?: number;
    unavailableReplicas?: number;
    conditions?: Array<{
      type: string;
      status: 'True' | 'False' | 'Unknown';
      lastUpdateTime?: string;
      lastTransitionTime?: string;
      reason?: string;
      message?: string;
    }>;
  };
}

export interface Service extends KubernetesResource {
  kind: 'Service';
  spec: {
    selector?: Record<string, string>;
    ports: Array<{
      name?: string;
      protocol?: string;
      port: number;
      targetPort: number | string;
      nodePort?: number;
    }>;
    type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
    clusterIP?: string;
    externalIPs?: string[];
  };
  status: {
    loadBalancer?: {
      ingress?: Array<{ ip?: string; hostname?: string }>;
    };
  };
}

export interface KubernetesMockConfig {
  clusterName?: string;
  apiServerUrl?: string;
  networkLatency?: number;
  podStartSuccessRate?: number;
  resourceQuotaEnabled?: boolean;
  rbacEnabled?: boolean;
  simulateResourceConstraints?: boolean;
}

export class KubernetesMock extends EventEmitter {
  private resources = new Map<string, Map<string, KubernetesResource>>();
  private config: KubernetesMockConfig;
  private resourceQuotas = new Map<string, any>();
  private events: Array<{
    type: string;
    reason: string;
    message: string;
    involvedObject: any;
    timestamp: string;
  }> = [];

  constructor(config: KubernetesMockConfig = {}) {
    super();
    this.config = {
      clusterName: 'backstage-cluster',
      apiServerUrl: 'https://kubernetes.default.svc',
      networkLatency: 50,
      podStartSuccessRate: 0.95,
      resourceQuotaEnabled: true,
      rbacEnabled: true,
      simulateResourceConstraints: false,
      ...config
    };

    this.initializeDefaults();
    this.startResourceMonitoring();
  }

  private initializeDefaults() {
    // Initialize namespace maps
    const namespaces = ['default', 'backstage-plugins', 'kube-system'];
    namespaces.forEach(ns => {
      this.resources.set(`pods/${ns}`, new Map());
      this.resources.set(`deployments/${ns}`, new Map());
      this.resources.set(`services/${ns}`, new Map());
      this.resources.set(`configmaps/${ns}`, new Map());
      this.resources.set(`secrets/${ns}`, new Map());
      
      // Set resource quotas
      if (this.config.resourceQuotaEnabled) {
        this.resourceQuotas.set(ns, {
          'requests.cpu': '10',
          'requests.memory': '20Gi',
          'limits.cpu': '20',
          'limits.memory': '40Gi',
          pods: '50'
        });
      }
    });

    // Create default system pods
    this.createSystemPods();
  }

  private createSystemPods() {
    const systemPods = [
      {
        name: 'coredns',
        namespace: 'kube-system',
        image: 'k8s.gcr.io/coredns:1.8.4'
      },
      {
        name: 'kube-proxy',
        namespace: 'kube-system',
        image: 'k8s.gcr.io/kube-proxy:v1.25.0'
      }
    ];

    systemPods.forEach(pod => {
      const podResource: Pod = {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
          name: pod.name,
          namespace: pod.namespace,
          labels: { app: pod.name, tier: 'system' },
          creationTimestamp: new Date().toISOString(),
          resourceVersion: '1',
          uid: this.generateUID()
        },
        spec: {
          containers: [{
            name: pod.name,
            image: pod.image,
            resources: {
              requests: { cpu: '100m', memory: '70Mi' },
              limits: { cpu: '100m', memory: '170Mi' }
            }
          }],
          restartPolicy: 'Always'
        },
        status: {
          phase: 'Running',
          conditions: [{
            type: 'Ready',
            status: 'True',
            lastTransitionTime: new Date().toISOString()
          }],
          containerStatuses: [{
            name: pod.name,
            ready: true,
            restartCount: 0,
            image: pod.image,
            imageID: `docker-pullable://${pod.image}@sha256:mock`,
            state: { running: { startedAt: new Date().toISOString() } }
          }],
          hostIP: '10.0.0.1',
          podIP: `10.244.0.${Math.floor(Math.random() * 254) + 2}`,
          startTime: new Date().toISOString()
        }
      };

      this.resources.get(`pods/${pod.namespace}`)!.set(pod.name, podResource);
    });
  }

  private startResourceMonitoring() {
    // Monitor resource usage and update pod statuses
    setInterval(() => {
      this.updatePodStatuses();
      this.cleanupOldEvents();
    }, 5000);
  }

  private updatePodStatuses() {
    for (const [key, resourceMap] of this.resources.entries()) {
      if (key.startsWith('pods/')) {
        for (const [name, resource] of resourceMap.entries()) {
          const pod = resource as Pod;
          if (pod.status.phase === 'Running') {
            // Simulate occasional pod restarts or failures
            if (Math.random() < 0.001) { // 0.1% chance per check
              this.simulatePodIssue(pod);
            }
          }
        }
      }
    }
  }

  private simulatePodIssue(pod: Pod) {
    const issues = ['OOMKilled', 'ImagePullBackOff', 'CrashLoopBackOff'];
    const issue = issues[Math.floor(Math.random() * issues.length)];
    
    if (pod.status.containerStatuses) {
      pod.status.containerStatuses[0].restartCount++;
      pod.status.containerStatuses[0].lastState = {
        terminated: {
          exitCode: issue === 'OOMKilled' ? 137 : 1,
          reason: issue,
          message: `Container was ${issue}`,
          finishedAt: new Date().toISOString()
        }
      };
    }

    this.addEvent({
      type: 'Warning',
      reason: issue,
      message: `Container ${pod.spec.containers[0].name} was ${issue}`,
      involvedObject: {
        kind: pod.kind,
        name: pod.metadata.name,
        namespace: pod.metadata.namespace
      }
    });
  }

  private addEvent(event: Omit<typeof this.events[0], 'timestamp'>) {
    this.events.push({
      ...event,
      timestamp: new Date().toISOString()
    });
    this.emit('event', { ...event, timestamp: new Date().toISOString() });
  }

  private cleanupOldEvents() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.events = this.events.filter(event => new Date(event.timestamp) > oneHourAgo);
  }

  private async simulateNetworkDelay() {
    if (this.config.networkLatency > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.networkLatency));
    }
  }

  private generateUID(): string {
    return 'uid-' + Math.random().toString(36).substring(2, 15);
  }

  private getResourceKey(kind: string, namespace?: string): string {
    const resourceType = kind.toLowerCase() + 's';
    return namespace ? `${resourceType}/${namespace}` : resourceType;
  }

  private validateResourceQuota(resource: KubernetesResource): void {
    if (!this.config.resourceQuotaEnabled) return;

    const namespace = resource.metadata.namespace || 'default';
    const quota = this.resourceQuotas.get(namespace);
    if (!quota) return;

    // Simulate quota validation for pods
    if (resource.kind === 'Pod') {
      const pods = this.resources.get(`pods/${namespace}`)!;
      if (pods.size >= parseInt(quota.pods)) {
        throw new Error(`Exceeded pod quota in namespace ${namespace}`);
      }
    }
  }

  // Core Kubernetes API methods
  async createResource(resource: KubernetesResource): Promise<KubernetesResource> {
    await this.simulateNetworkDelay();

    // Validate resource quota
    this.validateResourceQuota(resource);

    // Generate metadata if missing
    if (!resource.metadata.uid) {
      resource.metadata.uid = this.generateUID();
    }
    if (!resource.metadata.creationTimestamp) {
      resource.metadata.creationTimestamp = new Date().toISOString();
    }
    if (!resource.metadata.resourceVersion) {
      resource.metadata.resourceVersion = '1';
    }

    const resourceKey = this.getResourceKey(resource.kind, resource.metadata.namespace);
    if (!this.resources.has(resourceKey)) {
      this.resources.set(resourceKey, new Map());
    }

    // Handle specific resource types
    if (resource.kind === 'Pod') {
      const pod = resource as Pod;
      
      // Initialize pod status
      pod.status = {
        phase: 'Pending',
        conditions: [{
          type: 'PodScheduled',
          status: 'True',
          lastTransitionTime: new Date().toISOString()
        }]
      };

      // Simulate pod scheduling and starting
      setTimeout(() => {
        this.startPod(pod);
      }, 2000 + Math.random() * 3000); // 2-5 seconds
      
    } else if (resource.kind === 'Deployment') {
      const deployment = resource as Deployment;
      
      // Initialize deployment status
      deployment.status = {
        replicas: 0,
        readyReplicas: 0,
        availableReplicas: 0,
        conditions: [{
          type: 'Progressing',
          status: 'True',
          lastUpdateTime: new Date().toISOString(),
          reason: 'NewReplicaSetCreated'
        }]
      };

      // Create pods for deployment
      setTimeout(() => {
        this.createDeploymentPods(deployment);
      }, 1000);
      
    } else if (resource.kind === 'Service') {
      const service = resource as Service;
      
      // Assign cluster IP
      service.spec.clusterIP = `10.96.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
      service.status = {};

      if (service.spec.type === 'LoadBalancer') {
        // Simulate load balancer provisioning
        setTimeout(() => {
          service.status.loadBalancer = {
            ingress: [{ ip: `35.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` }]
          };
        }, 5000);
      }
    }

    this.resources.get(resourceKey)!.set(resource.metadata.name, resource);
    
    this.addEvent({
      type: 'Normal',
      reason: 'Created',
      message: `${resource.kind} ${resource.metadata.name} created`,
      involvedObject: {
        kind: resource.kind,
        name: resource.metadata.name,
        namespace: resource.metadata.namespace
      }
    });

    this.emit('resourceCreated', { resource });
    return JSON.parse(JSON.stringify(resource));
  }

  private async startPod(pod: Pod): Promise<void> {
    // Simulate pod start failure
    if (Math.random() > this.config.podStartSuccessRate!) {
      pod.status.phase = 'Failed';
      pod.status.conditions!.push({
        type: 'Ready',
        status: 'False',
        lastTransitionTime: new Date().toISOString(),
        reason: 'ContainerCannotRun',
        message: 'Failed to start container'
      });

      this.addEvent({
        type: 'Warning',
        reason: 'FailedMount',
        message: 'Unable to attach or mount volumes',
        involvedObject: {
          kind: pod.kind,
          name: pod.metadata.name,
          namespace: pod.metadata.namespace
        }
      });

      return;
    }

    // Simulate successful pod start
    pod.status.phase = 'Running';
    pod.status.hostIP = `10.0.0.${Math.floor(Math.random() * 254) + 1}`;
    pod.status.podIP = `10.244.0.${Math.floor(Math.random() * 254) + 2}`;
    pod.status.startTime = new Date().toISOString();
    
    pod.status.conditions = [
      {
        type: 'Initialized',
        status: 'True',
        lastTransitionTime: new Date().toISOString()
      },
      {
        type: 'Ready',
        status: 'True',
        lastTransitionTime: new Date().toISOString()
      },
      {
        type: 'ContainersReady',
        status: 'True',
        lastTransitionTime: new Date().toISOString()
      },
      {
        type: 'PodScheduled',
        status: 'True',
        lastTransitionTime: new Date().toISOString()
      }
    ];

    pod.status.containerStatuses = pod.spec.containers.map(container => ({
      name: container.name,
      ready: true,
      restartCount: 0,
      image: container.image,
      imageID: `docker-pullable://${container.image}@sha256:mock`,
      state: {
        running: {
          startedAt: new Date().toISOString()
        }
      }
    }));

    this.addEvent({
      type: 'Normal',
      reason: 'Started',
      message: `Container ${pod.spec.containers[0].name} started`,
      involvedObject: {
        kind: pod.kind,
        name: pod.metadata.name,
        namespace: pod.metadata.namespace
      }
    });
  }

  private async createDeploymentPods(deployment: Deployment): Promise<void> {
    const replicas = deployment.spec.replicas || 1;
    const namespace = deployment.metadata.namespace || 'default';

    for (let i = 0; i < replicas; i++) {
      const podName = `${deployment.metadata.name}-${Math.random().toString(36).substring(2, 8)}-${Math.random().toString(36).substring(2, 5)}`;
      
      const pod: Pod = {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
          name: podName,
          namespace,
          labels: {
            ...deployment.spec.template.metadata.labels,
            'pod-template-hash': Math.random().toString(36).substring(2, 12)
          },
          annotations: {
            'deployment.kubernetes.io/revision': '1'
          },
          creationTimestamp: new Date().toISOString(),
          resourceVersion: '1',
          uid: this.generateUID()
        },
        spec: deployment.spec.template.spec,
        status: {
          phase: 'Pending'
        }
      };

      await this.createResource(pod);
    }

    // Update deployment status
    setTimeout(() => {
      deployment.status.replicas = replicas;
      deployment.status.readyReplicas = replicas;
      deployment.status.availableReplicas = replicas;
    }, 10000); // 10 seconds for all pods to be ready
  }

  async getResource(kind: string, name: string, namespace?: string): Promise<KubernetesResource> {
    await this.simulateNetworkDelay();

    const resourceKey = this.getResourceKey(kind, namespace);
    const resourceMap = this.resources.get(resourceKey);
    
    if (!resourceMap) {
      throw new Error(`Resource type ${kind} not found`);
    }

    const resource = resourceMap.get(name);
    if (!resource) {
      throw new Error(`${kind} ${name} not found`);
    }

    return JSON.parse(JSON.stringify(resource));
  }

  async listResources(kind: string, namespace?: string, labelSelector?: string): Promise<KubernetesResource[]> {
    await this.simulateNetworkDelay();

    const resourceKey = this.getResourceKey(kind, namespace);
    const resourceMap = this.resources.get(resourceKey);
    
    if (!resourceMap) {
      return [];
    }

    let resources = Array.from(resourceMap.values());

    // Apply label selector
    if (labelSelector) {
      const selectors = labelSelector.split(',').map(s => {
        const [key, value] = s.split('=');
        return { key: key.trim(), value: value?.trim() };
      });

      resources = resources.filter(resource => {
        return selectors.every(selector => {
          if (selector.value) {
            return resource.metadata.labels?.[selector.key] === selector.value;
          } else {
            return resource.metadata.labels?.hasOwnProperty(selector.key);
          }
        });
      });
    }

    return resources.map(r => JSON.parse(JSON.stringify(r)));
  }

  async updateResource(resource: KubernetesResource): Promise<KubernetesResource> {
    await this.simulateNetworkDelay();

    const resourceKey = this.getResourceKey(resource.kind, resource.metadata.namespace);
    const resourceMap = this.resources.get(resourceKey);
    
    if (!resourceMap) {
      throw new Error(`Resource type ${resource.kind} not found`);
    }

    const existingResource = resourceMap.get(resource.metadata.name);
    if (!existingResource) {
      throw new Error(`${resource.kind} ${resource.metadata.name} not found`);
    }

    // Update resource version
    const currentVersion = parseInt(existingResource.metadata.resourceVersion || '1');
    resource.metadata.resourceVersion = (currentVersion + 1).toString();

    resourceMap.set(resource.metadata.name, resource);

    this.addEvent({
      type: 'Normal',
      reason: 'Updated',
      message: `${resource.kind} ${resource.metadata.name} updated`,
      involvedObject: {
        kind: resource.kind,
        name: resource.metadata.name,
        namespace: resource.metadata.namespace
      }
    });

    this.emit('resourceUpdated', { resource });
    return JSON.parse(JSON.stringify(resource));
  }

  async deleteResource(kind: string, name: string, namespace?: string): Promise<void> {
    await this.simulateNetworkDelay();

    const resourceKey = this.getResourceKey(kind, namespace);
    const resourceMap = this.resources.get(resourceKey);
    
    if (!resourceMap) {
      throw new Error(`Resource type ${kind} not found`);
    }

    const resource = resourceMap.get(name);
    if (!resource) {
      throw new Error(`${kind} ${name} not found`);
    }

    // Handle cascading deletions
    if (kind === 'Deployment') {
      const deployment = resource as Deployment;
      const podList = await this.listResources('Pod', namespace, 
        Object.entries(deployment.spec.selector.matchLabels)
          .map(([k, v]) => `${k}=${v}`).join(',')
      );

      for (const pod of podList) {
        await this.deleteResource('Pod', pod.metadata.name, namespace);
      }
    }

    resourceMap.delete(name);

    this.addEvent({
      type: 'Normal',
      reason: 'Deleted',
      message: `${kind} ${name} deleted`,
      involvedObject: {
        kind,
        name,
        namespace
      }
    });

    this.emit('resourceDeleted', { kind, name, namespace });
  }

  // Higher-level operations
  async scaleDeployment(name: string, replicas: number, namespace?: string): Promise<Deployment> {
    const deployment = await this.getResource('Deployment', name, namespace) as Deployment;
    deployment.spec.replicas = replicas;
    return await this.updateResource(deployment) as Deployment;
  }

  async getPodLogs(name: string, namespace?: string, options: {
    container?: string;
    follow?: boolean;
    previous?: boolean;
    since?: string;
    sinceSeconds?: number;
    tail?: number;
  } = {}): Promise<string[]> {
    await this.simulateNetworkDelay();

    const pod = await this.getResource('Pod', name, namespace) as Pod;
    
    if (pod.status.phase !== 'Running' && pod.status.phase !== 'Succeeded') {
      throw new Error(`Pod ${name} is not running`);
    }

    // Simulate log entries
    const logs = [
      `[${new Date().toISOString()}] INFO Starting application...`,
      `[${new Date().toISOString()}] INFO Loading configuration from /app/config`,
      `[${new Date().toISOString()}] INFO Connecting to database...`,
      `[${new Date().toISOString()}] INFO Database connection established`,
      `[${new Date().toISOString()}] INFO Server listening on port 8080`,
      `[${new Date().toISOString()}] INFO Health check endpoint available at /health`,
      `[${new Date().toISOString()}] INFO Ready to serve requests`
    ];

    let result = logs;
    if (options.tail && options.tail > 0) {
      result = logs.slice(-options.tail);
    }

    return result;
  }

  async getClusterInfo(): Promise<any> {
    await this.simulateNetworkDelay();

    return {
      major: '1',
      minor: '25',
      gitVersion: 'v1.25.0',
      gitCommit: 'mock-commit-hash',
      gitTreeState: 'clean',
      buildDate: '2023-08-15T10:00:00Z',
      goVersion: 'go1.19.1',
      compiler: 'gc',
      platform: 'linux/amd64'
    };
  }

  async getNamespaces(): Promise<string[]> {
    await this.simulateNetworkDelay();

    const namespaces = ['default', 'backstage-plugins', 'kube-system'];
    return namespaces;
  }

  async getEvents(namespace?: string): Promise<typeof this.events> {
    await this.simulateNetworkDelay();

    if (namespace) {
      return this.events.filter(event => event.involvedObject.namespace === namespace);
    }
    
    return [...this.events];
  }

  async getResourceUsage(namespace?: string): Promise<any> {
    await this.simulateNetworkDelay();

    const podMap = namespace 
      ? this.resources.get(`pods/${namespace}`) 
      : null;

    const pods = podMap 
      ? Array.from(podMap.values())
      : Array.from(this.resources.values())
          .filter(map => Array.from(map.keys())[0]?.startsWith('pods/'))
          .flatMap(map => Array.from(map.values()));

    const runningPods = pods.filter((pod: any) => pod.status?.phase === 'Running');

    return {
      pods: {
        total: pods.length,
        running: runningPods.length,
        pending: pods.filter((pod: any) => pod.status?.phase === 'Pending').length,
        failed: pods.filter((pod: any) => pod.status?.phase === 'Failed').length
      },
      resources: {
        cpu: {
          requests: runningPods.length * 0.1, // 100m per pod
          limits: runningPods.length * 0.5,   // 500m per pod
          usage: runningPods.length * 0.05    // 50m actual usage per pod
        },
        memory: {
          requests: runningPods.length * 256 * 1024 * 1024, // 256Mi per pod
          limits: runningPods.length * 512 * 1024 * 1024,   // 512Mi per pod
          usage: runningPods.length * 128 * 1024 * 1024     // 128Mi actual usage per pod
        }
      }
    };
  }

  // Test utilities
  simulateNetworkPartition() {
    this.config.networkLatency = 10000; // 10 seconds
    this.config.podStartSuccessRate = 0.1;
  }

  simulateResourceExhaustion() {
    this.config.simulateResourceConstraints = true;
    this.config.podStartSuccessRate = 0.3;
  }

  restoreNormalOperation() {
    this.config.networkLatency = 50;
    this.config.podStartSuccessRate = 0.95;
    this.config.simulateResourceConstraints = false;
  }

  // Cleanup for tests
  async cleanup(): Promise<void> {
    // Clear all resources except system ones
    for (const [key, resourceMap] of this.resources.entries()) {
      if (!key.includes('kube-system')) {
        resourceMap.clear();
      }
    }

    // Clear events
    this.events = [];

    // Reinitialize defaults
    this.initializeDefaults();
  }
}

// Singleton instance for easy testing
export const kubernetesMock = new KubernetesMock();

export default KubernetesMock;