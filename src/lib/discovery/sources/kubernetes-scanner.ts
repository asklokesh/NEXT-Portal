/**
 * Kubernetes Cluster Scanner
 * 
 * Advanced discovery source that scans Kubernetes clusters to identify services,
 * workloads, and infrastructure components. Provides comprehensive analysis of
 * pods, services, ingresses, deployments, and custom resources.
 */

import { KubeConfig, CoreV1Api, AppsV1Api, NetworkingV1Api, CustomObjectsApi, Metrics } from '@kubernetes/client-node';
import { Logger } from 'winston';
import { z } from 'zod';
import { BaseDiscoverySource, createHttpEndpoint, createGrpcEndpoint } from '../core/base-source';
import { DiscoveredService } from '../core/discovery-engine';

// Configuration schema
const KubernetesScannerConfigSchema = z.object({
  clusters: z.array(z.object({
    name: z.string(),
    config: z.object({
      type: z.enum(['in_cluster', 'kubeconfig', 'service_account']),
      kubeconfig: z.string().optional(),
      context: z.string().optional(),
      namespace: z.string().optional(),
      token: z.string().optional(),
      server: z.string().optional(),
    }),
    enabled: z.boolean().default(true),
    priority: z.number().min(0).max(100).default(50),
  })),
  discovery: z.object({
    namespaces: z.array(z.string()).optional(), // If not provided, scan all namespaces
    excludeNamespaces: z.array(z.string()).default(['kube-system', 'kube-public', 'kube-node-lease']),
    includeSystemServices: z.boolean().default(false),
    resourceTypes: z.object({
      pods: z.boolean().default(true),
      services: z.boolean().default(true),
      ingresses: z.boolean().default(true),
      deployments: z.boolean().default(true),
      statefulsets: z.boolean().default(true),
      daemonsets: z.boolean().default(true),
      jobs: z.boolean().default(true),
      cronjobs: z.boolean().default(true),
      configmaps: z.boolean().default(false),
      secrets: z.boolean().default(false),
      customResources: z.array(z.object({
        group: z.string(),
        version: z.string(),
        plural: z.string(),
      })).default([]),
    }),
    annotations: z.object({
      serviceDiscovery: z.string().default('discovery.service/enabled'),
      serviceType: z.string().default('discovery.service/type'),
      serviceOwner: z.string().default('discovery.service/owner'),
      serviceDescription: z.string().default('discovery.service/description'),
      serviceVersion: z.string().default('discovery.service/version'),
      serviceDependencies: z.string().default('discovery.service/dependencies'),
    }),
  }),
  metrics: z.object({
    enabled: z.boolean().default(true),
    metricsApiEndpoint: z.string().optional(),
    customMetrics: z.boolean().default(false),
  }),
  networking: z.object({
    detectServiceMesh: z.boolean().default(true),
    serviceMeshTypes: z.array(z.enum(['istio', 'linkerd', 'consul-connect'])).default(['istio', 'linkerd']),
    extractNetworkPolicies: z.boolean().default(true),
  }),
});

type KubernetesScannerConfig = z.infer<typeof KubernetesScannerConfigSchema>;

// Kubernetes resource interfaces
interface KubernetesResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    creationTimestamp?: string;
    uid?: string;
  };
  spec?: any;
  status?: any;
}

interface ClusterInfo {
  name: string;
  config: any;
  coreV1Api?: CoreV1Api;
  appsV1Api?: AppsV1Api;
  networkingV1Api?: NetworkingV1Api;
  customObjectsApi?: CustomObjectsApi;
  metricsApi?: Metrics;
  isConnected: boolean;
  version?: string;
}

interface WorkloadInfo {
  resource: KubernetesResource;
  cluster: string;
  namespace: string;
  type: 'pod' | 'deployment' | 'statefulset' | 'daemonset' | 'job' | 'cronjob';
  replicas?: {
    desired: number;
    ready: number;
    available: number;
  };
  containers: {
    name: string;
    image: string;
    ports: Array<{
      name?: string;
      containerPort: number;
      protocol: string;
    }>;
  }[];
  services: KubernetesResource[];
  ingresses: KubernetesResource[];
  metrics?: {
    cpu: number;
    memory: number;
  };
}

export class KubernetesScanner extends BaseDiscoverySource {
  private config!: KubernetesScannerConfig;
  private clusters: Map<string, ClusterInfo> = new Map();

  constructor(logger: Logger) {
    super('kubernetes-scanner', '1.0.0', 90, logger);
  }

  protected async initializeSource(config: any): Promise<void> {
    this.config = KubernetesScannerConfigSchema.parse(config);

    // Initialize cluster connections
    for (const clusterConfig of this.config.clusters) {
      if (clusterConfig.enabled) {
        await this.initializeCluster(clusterConfig);
      }
    }

    this.logger.info(`Kubernetes scanner initialized with ${this.clusters.size} clusters`);
  }

  protected async performDiscovery(): Promise<DiscoveredService[]> {
    const allServices: DiscoveredService[] = [];

    for (const [clusterName, cluster] of this.clusters.entries()) {
      if (!cluster.isConnected) {
        this.logger.warn(`Skipping disconnected cluster: ${clusterName}`);
        continue;
      }

      try {
        const clusterServices = await this.discoverClusterServices(cluster);
        allServices.push(...clusterServices);
      } catch (error) {
        this.logger.error(`Failed to discover services in cluster ${clusterName}`, error);
      }
    }

    this.logger.info(`Kubernetes discovery completed: ${allServices.length} services found`);
    return allServices;
  }

  protected async performHealthCheck(): Promise<boolean> {
    let healthyCount = 0;

    for (const [clusterName, cluster] of this.clusters.entries()) {
      try {
        if (cluster.coreV1Api) {
          await cluster.coreV1Api.listNamespace();
          healthyCount++;
        }
      } catch (error) {
        this.logger.warn(`Health check failed for cluster ${clusterName}`, error);
        cluster.isConnected = false;
      }
    }

    return healthyCount > 0;
  }

  protected async disposeSource(): Promise<void> {
    this.clusters.clear();
  }

  // Cluster initialization
  private async initializeCluster(clusterConfig: any): Promise<void> {
    const { name, config } = clusterConfig;

    try {
      const kubeConfig = new KubeConfig();

      // Load configuration based on type
      switch (config.type) {
        case 'in_cluster':
          kubeConfig.loadFromCluster();
          break;
        case 'kubeconfig':
          if (config.kubeconfig) {
            kubeConfig.loadFromFile(config.kubeconfig);
          } else {
            kubeConfig.loadFromDefault();
          }
          if (config.context) {
            kubeConfig.setCurrentContext(config.context);
          }
          break;
        case 'service_account':
          // Load from service account token
          if (config.token && config.server) {
            kubeConfig.loadFromOptions({
              clusters: [{
                name: name,
                server: config.server,
              }],
              users: [{
                name: name,
                token: config.token,
              }],
              contexts: [{
                name: name,
                cluster: name,
                user: name,
              }],
              currentContext: name,
            });
          } else {
            throw new Error('Service account configuration requires token and server');
          }
          break;
        default:
          throw new Error(`Unsupported cluster config type: ${config.type}`);
      }

      // Initialize API clients
      const coreV1Api = kubeConfig.makeApiClient(CoreV1Api);
      const appsV1Api = kubeConfig.makeApiClient(AppsV1Api);
      const networkingV1Api = kubeConfig.makeApiClient(NetworkingV1Api);
      const customObjectsApi = kubeConfig.makeApiClient(CustomObjectsApi);

      // Initialize metrics API if enabled
      let metricsApi;
      if (this.config.metrics.enabled) {
        try {
          metricsApi = new Metrics(kubeConfig);
        } catch (error) {
          this.logger.warn(`Failed to initialize metrics API for cluster ${name}`, error);
        }
      }

      // Test connection
      await coreV1Api.listNamespace();

      // Get cluster version
      const versionInfo = await coreV1Api.getAPIVersions();

      const clusterInfo: ClusterInfo = {
        name,
        config,
        coreV1Api,
        appsV1Api,
        networkingV1Api,
        customObjectsApi,
        metricsApi,
        isConnected: true,
        version: versionInfo.body.versions?.[0],
      };

      this.clusters.set(name, clusterInfo);
      this.logger.info(`Connected to Kubernetes cluster: ${name}`);

    } catch (error) {
      this.logger.error(`Failed to initialize cluster ${name}`, error);
      
      // Store disconnected cluster info for retry
      this.clusters.set(name, {
        name,
        config,
        isConnected: false,
      });
    }
  }

  // Service discovery implementation
  private async discoverClusterServices(cluster: ClusterInfo): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    // Get target namespaces
    const namespaces = await this.getTargetNamespaces(cluster);

    for (const namespace of namespaces) {
      try {
        const namespaceServices = await this.discoverNamespaceServices(cluster, namespace);
        services.push(...namespaceServices);
      } catch (error) {
        this.logger.error(`Failed to discover services in namespace ${namespace}`, error);
      }
    }

    return services;
  }

  private async getTargetNamespaces(cluster: ClusterInfo): Promise<string[]> {
    const namespaces: string[] = [];

    try {
      // If specific namespaces are configured, use those
      if (this.config.discovery.namespaces && this.config.discovery.namespaces.length > 0) {
        return this.config.discovery.namespaces;
      }

      // Otherwise, get all namespaces and filter
      const namespacesResponse = await cluster.coreV1Api!.listNamespace();
      
      for (const ns of namespacesResponse.body.items) {
        const namespaceName = ns.metadata?.name;
        
        if (!namespaceName) continue;
        
        // Skip excluded namespaces
        if (this.config.discovery.excludeNamespaces.includes(namespaceName)) {
          continue;
        }

        // Skip system namespaces if not enabled
        if (!this.config.discovery.includeSystemServices && 
            namespaceName.startsWith('kube-') || 
            namespaceName === 'default') {
          continue;
        }

        namespaces.push(namespaceName);
      }

    } catch (error) {
      this.logger.error(`Failed to get namespaces from cluster ${cluster.name}`, error);
    }

    return namespaces;
  }

  private async discoverNamespaceServices(cluster: ClusterInfo, namespace: string): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    // Discover workloads
    const workloads = await this.discoverWorkloads(cluster, namespace);

    // Group workloads by service
    const workloadGroups = await this.groupWorkloadsByService(cluster, namespace, workloads);

    for (const [serviceName, workloadGroup] of workloadGroups.entries()) {
      const service = await this.createServiceFromWorkloads(cluster, namespace, serviceName, workloadGroup);
      if (service) {
        services.push(service);
      }
    }

    return services;
  }

  private async discoverWorkloads(cluster: ClusterInfo, namespace: string): Promise<WorkloadInfo[]> {
    const workloads: WorkloadInfo[] = [];

    // Discover pods
    if (this.config.discovery.resourceTypes.pods) {
      const pods = await this.discoverPods(cluster, namespace);
      workloads.push(...pods);
    }

    // Discover deployments
    if (this.config.discovery.resourceTypes.deployments) {
      const deployments = await this.discoverDeployments(cluster, namespace);
      workloads.push(...deployments);
    }

    // Discover statefulsets
    if (this.config.discovery.resourceTypes.statefulsets) {
      const statefulsets = await this.discoverStatefulSets(cluster, namespace);
      workloads.push(...statefulsets);
    }

    // Discover daemonsets
    if (this.config.discovery.resourceTypes.daemonsets) {
      const daemonsets = await this.discoverDaemonSets(cluster, namespace);
      workloads.push(...daemonsets);
    }

    // Discover jobs
    if (this.config.discovery.resourceTypes.jobs) {
      const jobs = await this.discoverJobs(cluster, namespace);
      workloads.push(...jobs);
    }

    // Discover cronjobs
    if (this.config.discovery.resourceTypes.cronjobs) {
      const cronjobs = await this.discoverCronJobs(cluster, namespace);
      workloads.push(...cronjobs);
    }

    return workloads;
  }

  private async discoverPods(cluster: ClusterInfo, namespace: string): Promise<WorkloadInfo[]> {
    const workloads: WorkloadInfo[] = [];

    try {
      const podsResponse = await cluster.coreV1Api!.listNamespacedPod(namespace);
      
      for (const pod of podsResponse.body.items) {
        // Skip pods that are controlled by higher-level resources
        if (pod.metadata?.ownerReferences && pod.metadata.ownerReferences.length > 0) {
          continue;
        }

        const workload = await this.createWorkloadFromPod(cluster, pod, namespace);
        if (workload) {
          workloads.push(workload);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover pods in namespace ${namespace}`, error);
    }

    return workloads;
  }

  private async discoverDeployments(cluster: ClusterInfo, namespace: string): Promise<WorkloadInfo[]> {
    const workloads: WorkloadInfo[] = [];

    try {
      const deploymentsResponse = await cluster.appsV1Api!.listNamespacedDeployment(namespace);
      
      for (const deployment of deploymentsResponse.body.items) {
        const workload = await this.createWorkloadFromDeployment(cluster, deployment, namespace);
        if (workload) {
          workloads.push(workload);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover deployments in namespace ${namespace}`, error);
    }

    return workloads;
  }

  private async discoverStatefulSets(cluster: ClusterInfo, namespace: string): Promise<WorkloadInfo[]> {
    const workloads: WorkloadInfo[] = [];

    try {
      const statefulSetsResponse = await cluster.appsV1Api!.listNamespacedStatefulSet(namespace);
      
      for (const statefulSet of statefulSetsResponse.body.items) {
        const workload = await this.createWorkloadFromStatefulSet(cluster, statefulSet, namespace);
        if (workload) {
          workloads.push(workload);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover statefulsets in namespace ${namespace}`, error);
    }

    return workloads;
  }

  private async discoverDaemonSets(cluster: ClusterInfo, namespace: string): Promise<WorkloadInfo[]> {
    const workloads: WorkloadInfo[] = [];

    try {
      const daemonSetsResponse = await cluster.appsV1Api!.listNamespacedDaemonSet(namespace);
      
      for (const daemonSet of daemonSetsResponse.body.items) {
        const workload = await this.createWorkloadFromDaemonSet(cluster, daemonSet, namespace);
        if (workload) {
          workloads.push(workload);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover daemonsets in namespace ${namespace}`, error);
    }

    return workloads;
  }

  private async discoverJobs(cluster: ClusterInfo, namespace: string): Promise<WorkloadInfo[]> {
    const workloads: WorkloadInfo[] = [];

    try {
      const jobsResponse = await cluster.appsV1Api!.listNamespacedJob(namespace);
      
      for (const job of (jobsResponse.body as any).items) {
        const workload = await this.createWorkloadFromJob(cluster, job, namespace);
        if (workload) {
          workloads.push(workload);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover jobs in namespace ${namespace}`, error);
    }

    return workloads;
  }

  private async discoverCronJobs(cluster: ClusterInfo, namespace: string): Promise<WorkloadInfo[]> {
    const workloads: WorkloadInfo[] = [];

    try {
      const cronJobsResponse = await cluster.appsV1Api!.listNamespacedCronJob(namespace);
      
      for (const cronJob of (cronJobsResponse.body as any).items) {
        const workload = await this.createWorkloadFromCronJob(cluster, cronJob, namespace);
        if (workload) {
          workloads.push(workload);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover cronjobs in namespace ${namespace}`, error);
    }

    return workloads;
  }

  // Workload creation methods
  private async createWorkloadFromPod(cluster: ClusterInfo, pod: any, namespace: string): Promise<WorkloadInfo | null> {
    try {
      const containers = this.extractContainers(pod.spec?.containers || []);
      const services = await this.getServicesForWorkload(cluster, namespace, pod.metadata?.labels);
      const ingresses = await this.getIngressesForWorkload(cluster, namespace, pod.metadata?.labels);

      return {
        resource: pod,
        cluster: cluster.name,
        namespace,
        type: 'pod',
        containers,
        services,
        ingresses,
      };
    } catch (error) {
      this.logger.debug(`Failed to create workload from pod ${pod.metadata?.name}`, error);
      return null;
    }
  }

  private async createWorkloadFromDeployment(cluster: ClusterInfo, deployment: any, namespace: string): Promise<WorkloadInfo | null> {
    try {
      const containers = this.extractContainers(deployment.spec?.template?.spec?.containers || []);
      const services = await this.getServicesForWorkload(cluster, namespace, deployment.spec?.selector?.matchLabels);
      const ingresses = await this.getIngressesForWorkload(cluster, namespace, deployment.spec?.selector?.matchLabels);

      return {
        resource: deployment,
        cluster: cluster.name,
        namespace,
        type: 'deployment',
        replicas: {
          desired: deployment.spec?.replicas || 0,
          ready: deployment.status?.readyReplicas || 0,
          available: deployment.status?.availableReplicas || 0,
        },
        containers,
        services,
        ingresses,
      };
    } catch (error) {
      this.logger.debug(`Failed to create workload from deployment ${deployment.metadata?.name}`, error);
      return null;
    }
  }

  private async createWorkloadFromStatefulSet(cluster: ClusterInfo, statefulSet: any, namespace: string): Promise<WorkloadInfo | null> {
    try {
      const containers = this.extractContainers(statefulSet.spec?.template?.spec?.containers || []);
      const services = await this.getServicesForWorkload(cluster, namespace, statefulSet.spec?.selector?.matchLabels);
      const ingresses = await this.getIngressesForWorkload(cluster, namespace, statefulSet.spec?.selector?.matchLabels);

      return {
        resource: statefulSet,
        cluster: cluster.name,
        namespace,
        type: 'statefulset',
        replicas: {
          desired: statefulSet.spec?.replicas || 0,
          ready: statefulSet.status?.readyReplicas || 0,
          available: statefulSet.status?.readyReplicas || 0,
        },
        containers,
        services,
        ingresses,
      };
    } catch (error) {
      this.logger.debug(`Failed to create workload from statefulset ${statefulSet.metadata?.name}`, error);
      return null;
    }
  }

  private async createWorkloadFromDaemonSet(cluster: ClusterInfo, daemonSet: any, namespace: string): Promise<WorkloadInfo | null> {
    try {
      const containers = this.extractContainers(daemonSet.spec?.template?.spec?.containers || []);
      const services = await this.getServicesForWorkload(cluster, namespace, daemonSet.spec?.selector?.matchLabels);
      const ingresses = await this.getIngressesForWorkload(cluster, namespace, daemonSet.spec?.selector?.matchLabels);

      return {
        resource: daemonSet,
        cluster: cluster.name,
        namespace,
        type: 'daemonset',
        replicas: {
          desired: daemonSet.status?.desiredNumberScheduled || 0,
          ready: daemonSet.status?.numberReady || 0,
          available: daemonSet.status?.numberAvailable || 0,
        },
        containers,
        services,
        ingresses,
      };
    } catch (error) {
      this.logger.debug(`Failed to create workload from daemonset ${daemonSet.metadata?.name}`, error);
      return null;
    }
  }

  private async createWorkloadFromJob(cluster: ClusterInfo, job: any, namespace: string): Promise<WorkloadInfo | null> {
    try {
      const containers = this.extractContainers(job.spec?.template?.spec?.containers || []);
      const services = await this.getServicesForWorkload(cluster, namespace, job.spec?.selector?.matchLabels);

      return {
        resource: job,
        cluster: cluster.name,
        namespace,
        type: 'job',
        containers,
        services,
        ingresses: [],
      };
    } catch (error) {
      this.logger.debug(`Failed to create workload from job ${job.metadata?.name}`, error);
      return null;
    }
  }

  private async createWorkloadFromCronJob(cluster: ClusterInfo, cronJob: any, namespace: string): Promise<WorkloadInfo | null> {
    try {
      const containers = this.extractContainers(cronJob.spec?.jobTemplate?.spec?.template?.spec?.containers || []);
      const services = await this.getServicesForWorkload(cluster, namespace, {});

      return {
        resource: cronJob,
        cluster: cluster.name,
        namespace,
        type: 'cronjob',
        containers,
        services,
        ingresses: [],
      };
    } catch (error) {
      this.logger.debug(`Failed to create workload from cronjob ${cronJob.metadata?.name}`, error);
      return null;
    }
  }

  // Helper methods
  private extractContainers(containers: any[]): WorkloadInfo['containers'] {
    return containers.map(container => ({
      name: container.name,
      image: container.image,
      ports: (container.ports || []).map((port: any) => ({
        name: port.name,
        containerPort: port.containerPort,
        protocol: port.protocol || 'TCP',
      })),
    }));
  }

  private async getServicesForWorkload(
    cluster: ClusterInfo,
    namespace: string,
    labels?: Record<string, string>
  ): Promise<KubernetesResource[]> {
    if (!labels || !this.config.discovery.resourceTypes.services) {
      return [];
    }

    try {
      const servicesResponse = await cluster.coreV1Api!.listNamespacedService(namespace);
      
      return servicesResponse.body.items.filter(service => {
        const selector = service.spec?.selector;
        if (!selector) return false;

        // Check if service selector matches workload labels
        return Object.entries(selector).every(([key, value]) => labels[key] === value);
      }) as KubernetesResource[];

    } catch (error) {
      this.logger.debug(`Failed to get services for workload in namespace ${namespace}`, error);
      return [];
    }
  }

  private async getIngressesForWorkload(
    cluster: ClusterInfo,
    namespace: string,
    labels?: Record<string, string>
  ): Promise<KubernetesResource[]> {
    if (!labels || !this.config.discovery.resourceTypes.ingresses) {
      return [];
    }

    try {
      const ingressesResponse = await cluster.networkingV1Api!.listNamespacedIngress(namespace);
      
      return ingressesResponse.body.items.filter(ingress => {
        // Simple matching - could be enhanced with more sophisticated logic
        return ingress.spec?.rules?.some((rule: any) => 
          rule.http?.paths?.some((path: any) => {
            const serviceName = path.backend?.service?.name;
            // This is a simplified check - in practice, you'd want more sophisticated matching
            return serviceName && labels['app'] === serviceName;
          })
        );
      }) as KubernetesResource[];

    } catch (error) {
      this.logger.debug(`Failed to get ingresses for workload in namespace ${namespace}`, error);
      return [];
    }
  }

  private async groupWorkloadsByService(
    cluster: ClusterInfo,
    namespace: string,
    workloads: WorkloadInfo[]
  ): Promise<Map<string, WorkloadInfo[]>> {
    const groups = new Map<string, WorkloadInfo[]>();

    for (const workload of workloads) {
      // Use the workload name as the service name by default
      let serviceName = workload.resource.metadata?.name || 'unknown';

      // Try to determine service name from labels or annotations
      const labels = workload.resource.metadata?.labels;
      const annotations = workload.resource.metadata?.annotations;

      // Check for service discovery annotations
      if (annotations?.[this.config.discovery.annotations.serviceDiscovery]) {
        serviceName = annotations[this.config.discovery.annotations.serviceDiscovery];
      } else if (labels?.app) {
        serviceName = labels.app;
      } else if (labels?.['app.kubernetes.io/name']) {
        serviceName = labels['app.kubernetes.io/name'];
      }

      if (!groups.has(serviceName)) {
        groups.set(serviceName, []);
      }

      groups.get(serviceName)!.push(workload);
    }

    return groups;
  }

  private async createServiceFromWorkloads(
    cluster: ClusterInfo,
    namespace: string,
    serviceName: string,
    workloads: WorkloadInfo[]
  ): Promise<DiscoveredService | null> {
    if (workloads.length === 0) {
      return null;
    }

    const primaryWorkload = workloads[0];
    
    // Determine service type based on workloads and Kubernetes resources
    const serviceType = this.inferServiceTypeFromWorkloads(workloads);
    
    // Extract endpoints from services and ingresses
    const endpoints = this.extractEndpointsFromWorkloads(workloads);
    
    // Extract metadata from annotations and labels
    const metadata = this.extractMetadataFromWorkloads(workloads);
    
    // Calculate confidence based on Kubernetes resource completeness
    const confidence = this.calculateKubernetesConfidence(workloads);

    // Extract owner information
    const owner = this.extractOwnerFromWorkloads(workloads);

    const service = this.createService({
      id: this.generateServiceId('kubernetes', `${cluster.name}:${namespace}:${serviceName}`),
      name: serviceName,
      type: serviceType,
      confidence,
      metadata: {
        ...metadata,
        kubernetes: {
          cluster: cluster.name,
          namespace,
          workloads: workloads.map(w => ({
            name: w.resource.metadata?.name,
            type: w.type,
            replicas: w.replicas,
          })),
        },
      },
      endpoints,
      owner,
      deployment: {
        environment: namespace === 'production' ? 'production' : 
                    namespace === 'staging' ? 'staging' : 'development',
        cluster: cluster.name,
        namespace,
      },
    });

    return service;
  }

  private inferServiceTypeFromWorkloads(workloads: WorkloadInfo[]): DiscoveredService['type'] {
    // Analyze container images and ports to infer service type
    const hasHttpPorts = workloads.some(w => 
      w.containers.some(c => 
        c.ports.some(p => p.containerPort === 80 || p.containerPort === 8080 || p.containerPort === 3000)
      )
    );

    const hasGrpcPorts = workloads.some(w => 
      w.containers.some(c => 
        c.ports.some(p => p.containerPort === 50051 || p.containerPort === 9000)
      )
    );

    const hasDatabasePorts = workloads.some(w => 
      w.containers.some(c => 
        c.ports.some(p => 
          p.containerPort === 5432 || p.containerPort === 3306 || p.containerPort === 27017
        )
      )
    );

    const hasQueuePorts = workloads.some(w => 
      w.containers.some(c => 
        c.ports.some(p => 
          p.containerPort === 5672 || p.containerPort === 9092
        )
      )
    );

    const images = workloads.flatMap(w => w.containers.map(c => c.image.toLowerCase()));
    
    if (images.some(img => img.includes('postgres') || img.includes('mysql') || img.includes('mongo') || hasDatabasePorts)) {
      return 'database';
    }

    if (images.some(img => img.includes('kafka') || img.includes('rabbitmq') || img.includes('redis') || hasQueuePorts)) {
      return 'queue';
    }

    if (hasGrpcPorts) {
      return 'api';
    }

    if (hasHttpPorts || workloads.some(w => w.ingresses.length > 0)) {
      return workloads.some(w => w.ingresses.length > 0) ? 'web' : 'api';
    }

    return 'microservice';
  }

  private extractEndpointsFromWorkloads(workloads: WorkloadInfo[]): DiscoveredService['endpoints'] {
    const endpoints: DiscoveredService['endpoints'] = [];

    for (const workload of workloads) {
      // Extract from services
      for (const service of workload.services) {
        const ports = (service.spec as any)?.ports || [];
        
        for (const port of ports) {
          const protocol = port.protocol?.toLowerCase() || 'tcp';
          const serviceUrl = `${protocol}://${service.metadata?.name}.${workload.namespace}.svc.cluster.local:${port.port}`;
          
          if (protocol === 'tcp' && (port.port === 80 || port.port === 8080 || port.port === 3000)) {
            endpoints.push(createHttpEndpoint(serviceUrl.replace('tcp:', 'http:')));
          } else if (protocol === 'tcp' && (port.port === 50051 || port.port === 9000)) {
            endpoints.push(createGrpcEndpoint(serviceUrl.replace('tcp:', 'grpc:')));
          }
        }
      }

      // Extract from ingresses
      for (const ingress of workload.ingresses) {
        const rules = (ingress.spec as any)?.rules || [];
        
        for (const rule of rules) {
          const host = rule.host || 'localhost';
          const paths = rule.http?.paths || [];
          
          for (const path of paths) {
            const pathStr = path.path || '/';
            const url = `https://${host}${pathStr}`;
            endpoints.push(createHttpEndpoint(url));
          }
        }
      }
    }

    return endpoints.length > 0 ? endpoints : undefined;
  }

  private extractMetadataFromWorkloads(workloads: WorkloadInfo[]): Record<string, any> {
    const metadata: Record<string, any> = {};

    for (const workload of workloads) {
      const annotations = workload.resource.metadata?.annotations;
      const labels = workload.resource.metadata?.labels;

      // Extract service-specific annotations
      if (annotations) {
        if (annotations[this.config.discovery.annotations.serviceType]) {
          metadata.serviceType = annotations[this.config.discovery.annotations.serviceType];
        }
        if (annotations[this.config.discovery.annotations.serviceDescription]) {
          metadata.description = annotations[this.config.discovery.annotations.serviceDescription];
        }
        if (annotations[this.config.discovery.annotations.serviceVersion]) {
          metadata.version = annotations[this.config.discovery.annotations.serviceVersion];
        }
      }

      // Extract common labels
      if (labels) {
        metadata.labels = labels;
        
        if (labels['app.kubernetes.io/version']) {
          metadata.version = labels['app.kubernetes.io/version'];
        }
        if (labels['app.kubernetes.io/component']) {
          metadata.component = labels['app.kubernetes.io/component'];
        }
      }
    }

    return metadata;
  }

  private calculateKubernetesConfidence(workloads: WorkloadInfo[]): number {
    let confidence = 0.5; // Base confidence for Kubernetes resources

    const hasServices = workloads.some(w => w.services.length > 0);
    const hasIngresses = workloads.some(w => w.ingresses.length > 0);
    const hasLabels = workloads.some(w => w.resource.metadata?.labels);
    const hasAnnotations = workloads.some(w => w.resource.metadata?.annotations);
    const hasHealthyReplicas = workloads.some(w => 
      w.replicas && w.replicas.ready > 0 && w.replicas.ready === w.replicas.desired
    );

    if (hasServices) confidence += 0.2;
    if (hasIngresses) confidence += 0.15;
    if (hasLabels) confidence += 0.1;
    if (hasAnnotations) confidence += 0.05;
    if (hasHealthyReplicas) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private extractOwnerFromWorkloads(workloads: WorkloadInfo[]): DiscoveredService['owner'] | undefined {
    for (const workload of workloads) {
      const annotations = workload.resource.metadata?.annotations;
      
      if (annotations?.[this.config.discovery.annotations.serviceOwner]) {
        const owner = annotations[this.config.discovery.annotations.serviceOwner];
        
        // Try to parse as email or team name
        if (owner.includes('@')) {
          return { email: owner };
        } else {
          return { team: owner };
        }
      }
    }

    return undefined;
  }
}