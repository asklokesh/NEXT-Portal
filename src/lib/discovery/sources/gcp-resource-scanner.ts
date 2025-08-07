/**
 * GCP Resource Scanner
 * 
 * Advanced discovery source that scans Google Cloud Platform infrastructure
 * to identify services, resources, and workloads across multiple GCP services
 * including Compute Engine, Cloud Run, Cloud SQL, GCS, and more.
 */

import { GoogleAuth } from 'google-auth-library';
import { compute_v1, run_v1, sqladmin_v1, storage_v1, container_v1, cloudfunctions_v1 } from 'googleapis';
import { Logger } from 'winston';
import { z } from 'zod';
import { BaseDiscoverySource, createHttpEndpoint } from '../core/base-source';
import { DiscoveredService } from '../core/discovery-engine';

// Configuration schema
const GCPResourceScannerConfigSchema = z.object({
  credentials: z.object({
    type: z.enum(['default', 'service_account', 'key_file']),
    keyFilename: z.string().optional(),
    keyFile: z.string().optional(),
    projectId: z.string().optional(),
  }),
  projects: z.array(z.string()),
  regions: z.array(z.string()).optional(), // If not provided, scan all regions
  services: z.object({
    computeEngine: z.boolean().default(true),
    cloudRun: z.boolean().default(true),
    cloudSQL: z.boolean().default(true),
    cloudStorage: z.boolean().default(true),
    gke: z.boolean().default(true),
    cloudFunctions: z.boolean().default(true),
    appEngine: z.boolean().default(true),
  }),
  discovery: z.object({
    includeStoppedInstances: z.boolean().default(false),
    labelFilters: z.array(z.object({
      key: z.string(),
      values: z.array(z.string()),
    })).optional(),
    excludeLabels: z.array(z.object({
      key: z.string(),
      values: z.array(z.string()),
    })).optional(),
  }),
  naming: z.object({
    useResourceLabels: z.boolean().default(true),
    fallbackToResourceName: z.boolean().default(true),
  }),
});

type GCPResourceScannerConfig = z.infer<typeof GCPResourceScannerConfigSchema>;

// GCP Resource interfaces
interface GCPResource {
  id: string;
  name: string;
  type: string;
  zone?: string;
  region?: string;
  project: string;
  labels: Record<string, string>;
  status: string;
  selfLink?: string;
  metadata: Record<string, any>;
}

interface GCPClients {
  compute: compute_v1.Compute;
  run: run_v1.CloudRun;
  sql: sqladmin_v1.SQLAdmin;
  storage: storage_v1.Storage;
  container: container_v1.Container;
  functions: cloudfunctions_v1.CloudFunctions;
}

export class GCPResourceScanner extends BaseDiscoverySource {
  private config!: GCPResourceScannerConfig;
  private clients: Map<string, GCPClients> = new Map();
  private auth: GoogleAuth | undefined;

  constructor(logger: Logger) {
    super('gcp-resource-scanner', '1.0.0', 80, logger);
  }

  protected async initializeSource(config: any): Promise<void> {
    this.config = GCPResourceScannerConfigSchema.parse(config);

    // Initialize Google Auth
    await this.initializeAuth();

    // Initialize clients for each project
    for (const projectId of this.config.projects) {
      await this.initializeProjectClients(projectId);
    }

    this.logger.info(`GCP resource scanner initialized for ${this.config.projects.length} projects`);
  }

  protected async performDiscovery(): Promise<DiscoveredService[]> {
    const allServices: DiscoveredService[] = [];

    for (const projectId of this.config.projects) {
      try {
        const projectServices = await this.discoverProjectResources(projectId);
        allServices.push(...projectServices);
      } catch (error) {
        this.logger.error(`Failed to discover resources in project ${projectId}`, error);
      }
    }

    this.logger.info(`GCP discovery completed: ${allServices.length} services found`);
    return allServices;
  }

  protected async performHealthCheck(): Promise<boolean> {
    try {
      // Test connection with a simple API call
      const projectId = this.config.projects[0];
      const clients = this.clients.get(projectId);
      
      if (clients && this.auth) {
        await clients.compute.projects.get({ project: projectId });
        return true;
      }

      return false;
    } catch (error) {
      this.logger.warn('GCP resource scanner health check failed', error);
      return false;
    }
  }

  protected async disposeSource(): Promise<void> {
    this.clients.clear();
  }

  // Auth initialization
  private async initializeAuth(): Promise<void> {
    const authConfig: any = {};

    switch (this.config.credentials.type) {
      case 'service_account':
        if (this.config.credentials.keyFilename) {
          authConfig.keyFilename = this.config.credentials.keyFilename;
        } else if (this.config.credentials.keyFile) {
          authConfig.credentials = JSON.parse(this.config.credentials.keyFile);
        }
        break;
      case 'key_file':
        if (this.config.credentials.keyFilename) {
          authConfig.keyFilename = this.config.credentials.keyFilename;
        }
        break;
      default:
        // Use default credentials (ADC)
        break;
    }

    if (this.config.credentials.projectId) {
      authConfig.projectId = this.config.credentials.projectId;
    }

    this.auth = new GoogleAuth({
      ...authConfig,
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/compute.readonly',
      ],
    });
  }

  // Project client initialization
  private async initializeProjectClients(projectId: string): Promise<void> {
    try {
      if (!this.auth) {
        throw new Error('Google Auth not initialized');
      }

      const authClient = await this.auth.getClient();

      const clients: GCPClients = {
        compute: new compute_v1.Compute({ auth: authClient }),
        run: new run_v1.CloudRun({ auth: authClient }),
        sql: new sqladmin_v1.SQLAdmin({ auth: authClient }),
        storage: new storage_v1.Storage({ auth: authClient }),
        container: new container_v1.Container({ auth: authClient }),
        functions: new cloudfunctions_v1.CloudFunctions({ auth: authClient }),
      };

      this.clients.set(projectId, clients);
      this.logger.debug(`Initialized GCP clients for project: ${projectId}`);

    } catch (error) {
      this.logger.error(`Failed to initialize GCP clients for project ${projectId}`, error);
      throw error;
    }
  }

  // Resource discovery by project
  private async discoverProjectResources(projectId: string): Promise<DiscoveredService[]> {
    const clients = this.clients.get(projectId);
    if (!clients) {
      throw new Error(`No clients initialized for project ${projectId}`);
    }

    const services: DiscoveredService[] = [];

    // Discover Compute Engine instances
    if (this.config.services.computeEngine) {
      const computeServices = await this.discoverComputeInstances(clients, projectId);
      services.push(...computeServices);
    }

    // Discover Cloud Run services
    if (this.config.services.cloudRun) {
      const runServices = await this.discoverCloudRunServices(clients, projectId);
      services.push(...runServices);
    }

    // Discover Cloud SQL instances
    if (this.config.services.cloudSQL) {
      const sqlServices = await this.discoverCloudSQLInstances(clients, projectId);
      services.push(...sqlServices);
    }

    // Discover Cloud Storage buckets
    if (this.config.services.cloudStorage) {
      const storageServices = await this.discoverCloudStorageBuckets(clients, projectId);
      services.push(...storageServices);
    }

    // Discover GKE clusters
    if (this.config.services.gke) {
      const gkeServices = await this.discoverGKEClusters(clients, projectId);
      services.push(...gkeServices);
    }

    // Discover Cloud Functions
    if (this.config.services.cloudFunctions) {
      const functionServices = await this.discoverCloudFunctions(clients, projectId);
      services.push(...functionServices);
    }

    return services;
  }

  // Compute Engine Discovery
  private async discoverComputeInstances(clients: GCPClients, projectId: string): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      // Get all zones
      const zonesResponse = await clients.compute.zones.list({ project: projectId });
      const zones = zonesResponse.data.items || [];

      for (const zone of zones) {
        if (!zone.name) continue;

        try {
          const instancesResponse = await clients.compute.instances.list({
            project: projectId,
            zone: zone.name,
          });

          for (const instance of instancesResponse.data.items || []) {
            // Skip stopped instances if not configured to include them
            if (!this.config.discovery.includeStoppedInstances && instance.status !== 'RUNNING') {
              continue;
            }

            const resource = this.mapComputeInstance(instance, projectId, zone.name);
            if (this.shouldIncludeResource(resource)) {
              const service = await this.createServiceFromGCPResource(resource, 'microservice');
              if (service) {
                services.push(service);
              }
            }
          }
        } catch (error) {
          this.logger.debug(`Failed to list instances in zone ${zone.name}`, error);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover Compute Engine instances in project ${projectId}`, error);
    }

    return services;
  }

  private mapComputeInstance(instance: any, projectId: string, zone: string): GCPResource {
    const labels = instance.labels || {};
    
    return {
      id: instance.id?.toString() || '',
      name: instance.name || '',
      type: 'compute-instance',
      zone: zone,
      region: zone.substring(0, zone.lastIndexOf('-')),
      project: projectId,
      labels,
      status: instance.status || '',
      selfLink: instance.selfLink,
      metadata: {
        machineType: instance.machineType?.split('/').pop(),
        cpuPlatform: instance.cpuPlatform,
        disks: instance.disks?.map((disk: any) => ({
          deviceName: disk.deviceName,
          source: disk.source,
          type: disk.type,
        })),
        networkInterfaces: instance.networkInterfaces?.map((ni: any) => ({
          network: ni.network,
          subnetwork: ni.subnetwork,
          networkIP: ni.networkIP,
          accessConfigs: ni.accessConfigs,
        })),
        serviceAccounts: instance.serviceAccounts,
        tags: instance.tags,
        creationTimestamp: instance.creationTimestamp,
      },
    };
  }

  // Cloud Run Discovery
  private async discoverCloudRunServices(clients: GCPClients, projectId: string): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      // Get all regions for Cloud Run
      const regions = this.config.regions || ['us-central1', 'us-east1', 'europe-west1', 'asia-east1'];

      for (const region of regions) {
        try {
          const servicesResponse = await clients.run.projects.locations.services.list({
            parent: `projects/${projectId}/locations/${region}`,
          });

          for (const runService of servicesResponse.data.items || []) {
            const resource = this.mapCloudRunService(runService, projectId, region);
            if (this.shouldIncludeResource(resource)) {
              const service = await this.createServiceFromGCPResource(resource, 'microservice');
              if (service) {
                services.push(service);
              }
            }
          }
        } catch (error) {
          this.logger.debug(`Failed to list Cloud Run services in region ${region}`, error);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover Cloud Run services in project ${projectId}`, error);
    }

    return services;
  }

  private mapCloudRunService(runService: any, projectId: string, region: string): GCPResource {
    const labels = runService.metadata?.labels || {};
    
    return {
      id: runService.metadata?.uid || '',
      name: runService.metadata?.name || '',
      type: 'cloud-run-service',
      region: region,
      project: projectId,
      labels,
      status: runService.status?.conditions?.[0]?.type || 'Unknown',
      metadata: {
        generation: runService.metadata?.generation,
        namespace: runService.metadata?.namespace,
        creationTimestamp: runService.metadata?.creationTimestamp,
        url: runService.status?.url,
        traffic: runService.status?.traffic,
        template: runService.spec?.template,
        observedGeneration: runService.status?.observedGeneration,
      },
    };
  }

  // Cloud SQL Discovery
  private async discoverCloudSQLInstances(clients: GCPClients, projectId: string): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      const instancesResponse = await clients.sql.instances.list({ project: projectId });

      for (const sqlInstance of instancesResponse.data.items || []) {
        const resource = this.mapCloudSQLInstance(sqlInstance, projectId);
        if (this.shouldIncludeResource(resource)) {
          const service = await this.createServiceFromGCPResource(resource, 'database');
          if (service) {
            services.push(service);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover Cloud SQL instances in project ${projectId}`, error);
    }

    return services;
  }

  private mapCloudSQLInstance(sqlInstance: any, projectId: string): GCPResource {
    const labels = sqlInstance.settings?.userLabels || {};
    
    return {
      id: sqlInstance.name || '',
      name: sqlInstance.name || '',
      type: 'cloud-sql-instance',
      region: sqlInstance.region,
      project: projectId,
      labels,
      status: sqlInstance.state || '',
      metadata: {
        databaseVersion: sqlInstance.databaseVersion,
        tier: sqlInstance.settings?.tier,
        availabilityType: sqlInstance.settings?.availabilityType,
        backupConfiguration: sqlInstance.settings?.backupConfiguration,
        ipAddresses: sqlInstance.ipAddresses,
        connectionName: sqlInstance.connectionName,
        createdTime: sqlInstance.createTime,
      },
    };
  }

  // Cloud Storage Discovery
  private async discoverCloudStorageBuckets(clients: GCPClients, projectId: string): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      const bucketsResponse = await clients.storage.buckets.list({ project: projectId });

      for (const bucket of bucketsResponse.data.items || []) {
        const resource = this.mapCloudStorageBucket(bucket, projectId);
        if (this.shouldIncludeResource(resource)) {
          const service = await this.createServiceFromGCPResource(resource, 'storage');
          if (service) {
            services.push(service);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover Cloud Storage buckets in project ${projectId}`, error);
    }

    return services;
  }

  private mapCloudStorageBucket(bucket: any, projectId: string): GCPResource {
    const labels = bucket.labels || {};
    
    return {
      id: bucket.id || '',
      name: bucket.name || '',
      type: 'cloud-storage-bucket',
      region: bucket.location,
      project: projectId,
      labels,
      status: 'ACTIVE',
      metadata: {
        storageClass: bucket.storageClass,
        locationType: bucket.locationType,
        versioning: bucket.versioning,
        encryption: bucket.encryption,
        lifecycle: bucket.lifecycle,
        cors: bucket.cors,
        timeCreated: bucket.timeCreated,
      },
    };
  }

  // GKE Discovery
  private async discoverGKEClusters(clients: GCPClients, projectId: string): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      const clustersResponse = await clients.container.projects.zones.clusters.list({
        projectId: projectId,
        zone: '-', // List all zones
      });

      for (const cluster of clustersResponse.data.clusters || []) {
        const resource = this.mapGKECluster(cluster, projectId);
        if (this.shouldIncludeResource(resource)) {
          const service = await this.createServiceFromGCPResource(resource, 'microservice');
          if (service) {
            services.push(service);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover GKE clusters in project ${projectId}`, error);
    }

    return services;
  }

  private mapGKECluster(cluster: any, projectId: string): GCPResource {
    const labels = cluster.resourceLabels || {};
    
    return {
      id: cluster.selfLink || '',
      name: cluster.name || '',
      type: 'gke-cluster',
      zone: cluster.zone,
      region: cluster.location,
      project: projectId,
      labels,
      status: cluster.status || '',
      metadata: {
        currentMasterVersion: cluster.currentMasterVersion,
        currentNodeVersion: cluster.currentNodeVersion,
        currentNodeCount: cluster.currentNodeCount,
        endpoint: cluster.endpoint,
        clusterIpv4Cidr: cluster.clusterIpv4Cidr,
        network: cluster.network,
        subnetwork: cluster.subnetwork,
        nodePools: cluster.nodePools?.map((np: any) => ({
          name: np.name,
          status: np.status,
          instanceGroupUrls: np.instanceGroupUrls,
        })),
        createTime: cluster.createTime,
      },
    };
  }

  // Cloud Functions Discovery
  private async discoverCloudFunctions(clients: GCPClients, projectId: string): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      // Get all regions for Cloud Functions
      const regions = this.config.regions || ['us-central1', 'us-east1', 'europe-west1', 'asia-east1'];

      for (const region of regions) {
        try {
          const functionsResponse = await clients.functions.projects.locations.functions.list({
            parent: `projects/${projectId}/locations/${region}`,
          });

          for (const cloudFunction of functionsResponse.data.functions || []) {
            const resource = this.mapCloudFunction(cloudFunction, projectId, region);
            if (this.shouldIncludeResource(resource)) {
              const service = await this.createServiceFromGCPResource(resource, 'function');
              if (service) {
                services.push(service);
              }
            }
          }
        } catch (error) {
          this.logger.debug(`Failed to list Cloud Functions in region ${region}`, error);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover Cloud Functions in project ${projectId}`, error);
    }

    return services;
  }

  private mapCloudFunction(cloudFunction: any, projectId: string, region: string): GCPResource {
    const labels = cloudFunction.labels || {};
    
    return {
      id: cloudFunction.name?.split('/').pop() || '',
      name: cloudFunction.name?.split('/').pop() || '',
      type: 'cloud-function',
      region: region,
      project: projectId,
      labels,
      status: cloudFunction.status || '',
      metadata: {
        runtime: cloudFunction.runtime,
        availableMemoryMb: cloudFunction.availableMemoryMb,
        timeout: cloudFunction.timeout,
        entryPoint: cloudFunction.entryPoint,
        httpsTrigger: cloudFunction.httpsTrigger,
        eventTrigger: cloudFunction.eventTrigger,
        updateTime: cloudFunction.updateTime,
        versionId: cloudFunction.versionId,
      },
    };
  }

  // Helper methods
  private shouldIncludeResource(resource: GCPResource): boolean {
    // Apply region filters
    if (this.config.regions && this.config.regions.length > 0) {
      if (!this.config.regions.includes(resource.region || '')) {
        return false;
      }
    }

    // Apply label filters
    if (this.config.discovery.labelFilters) {
      const matchesFilter = this.config.discovery.labelFilters.some(filter => {
        const labelValue = resource.labels[filter.key];
        return labelValue && filter.values.includes(labelValue);
      });
      
      if (!matchesFilter) {
        return false;
      }
    }

    // Apply exclude filters
    if (this.config.discovery.excludeLabels) {
      const matchesExclude = this.config.discovery.excludeLabels.some(exclude => {
        const labelValue = resource.labels[exclude.key];
        return labelValue && exclude.values.includes(labelValue);
      });
      
      if (matchesExclude) {
        return false;
      }
    }

    return true;
  }

  private async createServiceFromGCPResource(
    resource: GCPResource,
    serviceType: DiscoveredService['type']
  ): Promise<DiscoveredService | null> {
    try {
      // Determine service name using naming strategy
      let serviceName = resource.name;
      
      if (this.config.naming.useResourceLabels && resource.labels.name) {
        serviceName = resource.labels.name;
      } else if (this.config.naming.fallbackToResourceName && !serviceName) {
        serviceName = resource.name;
      }

      // Create endpoints
      const endpoints = this.extractEndpointsFromGCPResource(resource);

      // Extract owner from labels
      const owner = this.extractOwnerFromLabels(resource.labels);

      // Calculate confidence based on resource completeness
      const confidence = this.calculateGCPResourceConfidence(resource);

      const service = this.createService({
        id: this.generateServiceId('gcp', resource.id),
        name: serviceName,
        type: serviceType,
        confidence,
        metadata: {
          ...resource.metadata,
          gcp: {
            type: resource.type,
            zone: resource.zone,
            region: resource.region,
            project: resource.project,
            labels: resource.labels,
            status: resource.status,
            selfLink: resource.selfLink,
          },
        },
        endpoints,
        owner,
        deployment: {
          environment: this.inferEnvironmentFromLabels(resource.labels),
          region: resource.region,
          cluster: resource.type === 'gke-cluster' ? resource.name : undefined,
        },
      });

      return service;

    } catch (error) {
      this.logger.error(`Failed to create service from GCP resource ${resource.id}`, error);
      return null;
    }
  }

  private extractEndpointsFromGCPResource(resource: GCPResource): DiscoveredService['endpoints'] {
    const endpoints: DiscoveredService['endpoints'] = [];

    switch (resource.type) {
      case 'cloud-run-service':
        if (resource.metadata.url) {
          endpoints.push(createHttpEndpoint(resource.metadata.url));
        }
        break;
      case 'cloud-function':
        if (resource.metadata.httpsTrigger?.url) {
          endpoints.push(createHttpEndpoint(resource.metadata.httpsTrigger.url));
        }
        break;
      case 'cloud-storage-bucket':
        endpoints.push(createHttpEndpoint(`https://storage.googleapis.com/${resource.name}`));
        break;
      case 'gke-cluster':
        if (resource.metadata.endpoint) {
          endpoints.push(createHttpEndpoint(`https://${resource.metadata.endpoint}`));
        }
        break;
      case 'compute-instance':
        if (resource.metadata.networkInterfaces) {
          for (const ni of resource.metadata.networkInterfaces) {
            if (ni.accessConfigs?.length > 0) {
              const externalIP = ni.accessConfigs[0].natIP;
              if (externalIP) {
                endpoints.push(createHttpEndpoint(`http://${externalIP}`));
              }
            }
          }
        }
        break;
    }

    return endpoints.length > 0 ? endpoints : undefined;
  }

  private extractOwnerFromLabels(labels: Record<string, string>): DiscoveredService['owner'] | undefined {
    const ownerFields = ['owner', 'team', 'contact', 'email', 'created-by'];
    
    for (const field of ownerFields) {
      const value = labels[field];
      if (value) {
        if (value.includes('@')) {
          return { email: value };
        } else {
          return { team: value };
        }
      }
    }

    return undefined;
  }

  private inferEnvironmentFromLabels(labels: Record<string, string>): string {
    const envFields = ['environment', 'env', 'stage', 'tier'];
    
    for (const field of envFields) {
      const value = labels[field]?.toLowerCase();
      if (value) {
        if (['prod', 'production'].includes(value)) return 'production';
        if (['staging', 'stage'].includes(value)) return 'staging';
        if (['dev', 'development'].includes(value)) return 'development';
        if (['test', 'testing'].includes(value)) return 'testing';
        return value;
      }
    }

    return 'unknown';
  }

  private calculateGCPResourceConfidence(resource: GCPResource): number {
    let confidence = 0.6; // Base confidence for GCP resources

    // Has meaningful labels
    if (Object.keys(resource.labels).length > 0) {
      confidence += 0.1;
    }

    // Has owner information
    if (this.extractOwnerFromLabels(resource.labels)) {
      confidence += 0.15;
    }

    // Has environment labels
    if (this.inferEnvironmentFromLabels(resource.labels) !== 'unknown') {
      confidence += 0.1;
    }

    // Is in running state
    const runningStates = ['RUNNING', 'READY', 'ACTIVE'];
    if (runningStates.includes(resource.status.toUpperCase())) {
      confidence += 0.05;
    }

    // Has endpoints
    if (this.extractEndpointsFromGCPResource(resource)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }
}