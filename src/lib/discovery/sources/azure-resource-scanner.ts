/**
 * Azure Resource Scanner
 * 
 * Advanced discovery source that scans Azure infrastructure to identify services,
 * resources, and workloads across multiple Azure services including VMs,
 * App Services, Container Instances, Functions, SQL Database, and more.
 */

import { DefaultAzureCredential, ClientSecretCredential } from '@azure/identity';
import { ResourceManagementClient } from '@azure/arm-resources';
import { ComputeManagementClient } from '@azure/arm-compute';
import { WebSiteManagementClient } from '@azure/arm-appservice';
import { ContainerInstanceManagementClient } from '@azure/arm-containerinstance';
import { SqlManagementClient } from '@azure/arm-sql';
import { StorageManagementClient } from '@azure/arm-storage';
import { CostManagementClient } from '@azure/arm-costmanagement';
import { Logger } from 'winston';
import { z } from 'zod';
import { BaseDiscoverySource, createHttpEndpoint } from '../core/base-source';
import { DiscoveredService } from '../core/discovery-engine';

// Configuration schema
const AzureResourceScannerConfigSchema = z.object({
  credentials: z.object({
    type: z.enum(['default', 'service_principal', 'managed_identity']),
    tenantId: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
  }),
  subscriptions: z.array(z.string()),
  resourceGroups: z.array(z.string()).optional(), // If not provided, scan all resource groups
  regions: z.array(z.string()).optional(), // If not provided, scan all regions
  services: z.object({
    virtualMachines: z.boolean().default(true),
    appServices: z.boolean().default(true),
    containerInstances: z.boolean().default(true),
    functions: z.boolean().default(true),
    sqlDatabases: z.boolean().default(true),
    storageAccounts: z.boolean().default(true),
    kubernetesServices: z.boolean().default(true),
    cosmosDb: z.boolean().default(true),
  }),
  discovery: z.object({
    includeStoppedResources: z.boolean().default(false),
    tagFilters: z.array(z.object({
      key: z.string(),
      values: z.array(z.string()),
    })).optional(),
    excludeTags: z.array(z.object({
      key: z.string(),
      values: z.array(z.string()),
    })).optional(),
  }),
  cost: z.object({
    enabled: z.boolean().default(true),
    timeframe: z.enum(['ThisMonth', 'LastMonth', 'WeekToDate']).default('ThisMonth'),
  }),
  naming: z.object({
    useResourceTags: z.boolean().default(true),
    fallbackToResourceName: z.boolean().default(true),
  }),
});

type AzureResourceScannerConfig = z.infer<typeof AzureResourceScannerConfigSchema>;

// Azure Resource interfaces
interface AzureResource {
  id: string;
  name: string;
  type: string;
  location: string;
  resourceGroup: string;
  subscription: string;
  tags: Record<string, string>;
  properties: any;
  metadata: Record<string, any>;
  costs?: {
    monthly: number;
    currency: string;
  };
}

interface AzureClients {
  resourceManagement: ResourceManagementClient;
  compute: ComputeManagementClient;
  webSite: WebSiteManagementClient;
  containerInstance: ContainerInstanceManagementClient;
  sql: SqlManagementClient;
  storage: StorageManagementClient;
  costManagement: CostManagementClient;
}

export class AzureResourceScanner extends BaseDiscoverySource {
  private config!: AzureResourceScannerConfig;
  private clients: Map<string, AzureClients> = new Map();
  private credential: DefaultAzureCredential | ClientSecretCredential | undefined;

  constructor(logger: Logger) {
    super('azure-resource-scanner', '1.0.0', 80, logger);
  }

  protected async initializeSource(config: any): Promise<void> {
    this.config = AzureResourceScannerConfigSchema.parse(config);

    // Initialize Azure credential
    this.initializeCredential();

    // Initialize clients for each subscription
    for (const subscriptionId of this.config.subscriptions) {
      await this.initializeSubscriptionClients(subscriptionId);
    }

    this.logger.info(`Azure resource scanner initialized for ${this.config.subscriptions.length} subscriptions`);
  }

  protected async performDiscovery(): Promise<DiscoveredService[]> {
    const allServices: DiscoveredService[] = [];

    for (const subscriptionId of this.config.subscriptions) {
      try {
        const subscriptionServices = await this.discoverSubscriptionResources(subscriptionId);
        allServices.push(...subscriptionServices);
      } catch (error) {
        this.logger.error(`Failed to discover resources in subscription ${subscriptionId}`, error);
      }
    }

    this.logger.info(`Azure discovery completed: ${allServices.length} services found`);
    return allServices;
  }

  protected async performHealthCheck(): Promise<boolean> {
    try {
      // Test connection with a simple API call
      const subscriptionId = this.config.subscriptions[0];
      const clients = this.clients.get(subscriptionId);
      
      if (clients) {
        await clients.resourceManagement.subscriptions.get(subscriptionId);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.warn('Azure resource scanner health check failed', error);
      return false;
    }
  }

  protected async disposeSource(): Promise<void> {
    this.clients.clear();
  }

  // Credential initialization
  private initializeCredential(): void {
    switch (this.config.credentials.type) {
      case 'service_principal':
        if (!this.config.credentials.tenantId || 
            !this.config.credentials.clientId || 
            !this.config.credentials.clientSecret) {
          throw new Error('Service principal credentials require tenantId, clientId, and clientSecret');
        }
        this.credential = new ClientSecretCredential(
          this.config.credentials.tenantId,
          this.config.credentials.clientId,
          this.config.credentials.clientSecret
        );
        break;
      case 'managed_identity':
        this.credential = new DefaultAzureCredential({
          managedIdentityClientId: this.config.credentials.clientId,
        });
        break;
      default:
        this.credential = new DefaultAzureCredential();
        break;
    }
  }

  // Subscription client initialization
  private async initializeSubscriptionClients(subscriptionId: string): Promise<void> {
    try {
      if (!this.credential) {
        throw new Error('Azure credential not initialized');
      }

      const clients: AzureClients = {
        resourceManagement: new ResourceManagementClient(this.credential, subscriptionId),
        compute: new ComputeManagementClient(this.credential, subscriptionId),
        webSite: new WebSiteManagementClient(this.credential, subscriptionId),
        containerInstance: new ContainerInstanceManagementClient(this.credential, subscriptionId),
        sql: new SqlManagementClient(this.credential, subscriptionId),
        storage: new StorageManagementClient(this.credential, subscriptionId),
        costManagement: new CostManagementClient(this.credential),
      };

      this.clients.set(subscriptionId, clients);
      this.logger.debug(`Initialized Azure clients for subscription: ${subscriptionId}`);

    } catch (error) {
      this.logger.error(`Failed to initialize Azure clients for subscription ${subscriptionId}`, error);
      throw error;
    }
  }

  // Resource discovery by subscription
  private async discoverSubscriptionResources(subscriptionId: string): Promise<DiscoveredService[]> {
    const clients = this.clients.get(subscriptionId);
    if (!clients) {
      throw new Error(`No clients initialized for subscription ${subscriptionId}`);
    }

    const services: DiscoveredService[] = [];

    // Get target resource groups
    const resourceGroups = await this.getTargetResourceGroups(clients, subscriptionId);

    for (const resourceGroup of resourceGroups) {
      try {
        const rgServices = await this.discoverResourceGroupServices(clients, subscriptionId, resourceGroup);
        services.push(...rgServices);
      } catch (error) {
        this.logger.error(`Failed to discover resources in resource group ${resourceGroup}`, error);
      }
    }

    return services;
  }

  private async getTargetResourceGroups(clients: AzureClients, subscriptionId: string): Promise<string[]> {
    if (this.config.resourceGroups && this.config.resourceGroups.length > 0) {
      return this.config.resourceGroups;
    }

    // Get all resource groups
    const resourceGroups: string[] = [];
    
    try {
      for await (const resourceGroup of clients.resourceManagement.resourceGroups.list()) {
        if (resourceGroup.name) {
          resourceGroups.push(resourceGroup.name);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to list resource groups for subscription ${subscriptionId}`, error);
    }

    return resourceGroups;
  }

  private async discoverResourceGroupServices(
    clients: AzureClients,
    subscriptionId: string,
    resourceGroup: string
  ): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    // Discover Virtual Machines
    if (this.config.services.virtualMachines) {
      const vmServices = await this.discoverVirtualMachines(clients, subscriptionId, resourceGroup);
      services.push(...vmServices);
    }

    // Discover App Services
    if (this.config.services.appServices) {
      const appServices = await this.discoverAppServices(clients, subscriptionId, resourceGroup);
      services.push(...appServices);
    }

    // Discover Container Instances
    if (this.config.services.containerInstances) {
      const containerServices = await this.discoverContainerInstances(clients, subscriptionId, resourceGroup);
      services.push(...containerServices);
    }

    // Discover Function Apps
    if (this.config.services.functions) {
      const functionServices = await this.discoverFunctionApps(clients, subscriptionId, resourceGroup);
      services.push(...functionServices);
    }

    // Discover SQL Databases
    if (this.config.services.sqlDatabases) {
      const sqlServices = await this.discoverSQLDatabases(clients, subscriptionId, resourceGroup);
      services.push(...sqlServices);
    }

    // Discover Storage Accounts
    if (this.config.services.storageAccounts) {
      const storageServices = await this.discoverStorageAccounts(clients, subscriptionId, resourceGroup);
      services.push(...storageServices);
    }

    return services;
  }

  // Virtual Machine Discovery
  private async discoverVirtualMachines(
    clients: AzureClients,
    subscriptionId: string,
    resourceGroup: string
  ): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      for await (const vm of clients.compute.virtualMachines.list(resourceGroup)) {
        const resource = this.mapVirtualMachine(vm, subscriptionId, resourceGroup);
        if (this.shouldIncludeResource(resource)) {
          const service = await this.createServiceFromAzureResource(resource, 'microservice');
          if (service) {
            services.push(service);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover VMs in resource group ${resourceGroup}`, error);
    }

    return services;
  }

  private mapVirtualMachine(vm: any, subscriptionId: string, resourceGroup: string): AzureResource {
    return {
      id: vm.id,
      name: vm.name,
      type: 'virtual-machine',
      location: vm.location,
      resourceGroup,
      subscription: subscriptionId,
      tags: vm.tags || {},
      properties: vm,
      metadata: {
        vmSize: vm.hardwareProfile?.vmSize,
        osType: vm.storageProfile?.osDisk?.osType,
        imageReference: vm.storageProfile?.imageReference,
        networkProfile: vm.networkProfile,
        provisioningState: vm.provisioningState,
        vmId: vm.vmId,
      },
    };
  }

  // App Service Discovery
  private async discoverAppServices(
    clients: AzureClients,
    subscriptionId: string,
    resourceGroup: string
  ): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      for await (const site of clients.webSite.webApps.listByResourceGroup(resourceGroup)) {
        const resource = this.mapAppService(site, subscriptionId, resourceGroup);
        if (this.shouldIncludeResource(resource)) {
          const service = await this.createServiceFromAzureResource(resource, 'web');
          if (service) {
            services.push(service);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover App Services in resource group ${resourceGroup}`, error);
    }

    return services;
  }

  private mapAppService(site: any, subscriptionId: string, resourceGroup: string): AzureResource {
    return {
      id: site.id,
      name: site.name,
      type: 'app-service',
      location: site.location,
      resourceGroup,
      subscription: subscriptionId,
      tags: site.tags || {},
      properties: site,
      metadata: {
        kind: site.kind,
        state: site.state,
        repositoryUrl: site.repositorySiteName,
        defaultHostName: site.defaultHostName,
        enabledHostNames: site.enabledHostNames,
        httpsOnly: site.httpsOnly,
        siteConfig: site.siteConfig,
        hostNameSslStates: site.hostNameSslStates,
      },
    };
  }

  // Container Instance Discovery
  private async discoverContainerInstances(
    clients: AzureClients,
    subscriptionId: string,
    resourceGroup: string
  ): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      for await (const containerGroup of clients.containerInstance.containerGroups.listByResourceGroup(resourceGroup)) {
        const resource = this.mapContainerInstance(containerGroup, subscriptionId, resourceGroup);
        if (this.shouldIncludeResource(resource)) {
          const service = await this.createServiceFromAzureResource(resource, 'microservice');
          if (service) {
            services.push(service);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover Container Instances in resource group ${resourceGroup}`, error);
    }

    return services;
  }

  private mapContainerInstance(containerGroup: any, subscriptionId: string, resourceGroup: string): AzureResource {
    return {
      id: containerGroup.id,
      name: containerGroup.name,
      type: 'container-instance',
      location: containerGroup.location,
      resourceGroup,
      subscription: subscriptionId,
      tags: containerGroup.tags || {},
      properties: containerGroup,
      metadata: {
        osType: containerGroup.osType,
        provisioningState: containerGroup.provisioningState,
        containers: containerGroup.containers?.map((container: any) => ({
          name: container.name,
          image: container.image,
          ports: container.ports,
          resources: container.resources,
        })),
        ipAddress: containerGroup.ipAddress,
        restartPolicy: containerGroup.restartPolicy,
      },
    };
  }

  // Function App Discovery
  private async discoverFunctionApps(
    clients: AzureClients,
    subscriptionId: string,
    resourceGroup: string
  ): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      for await (const site of clients.webSite.webApps.listByResourceGroup(resourceGroup)) {
        // Filter for Function Apps
        if (site.kind?.includes('functionapp')) {
          const resource = this.mapFunctionApp(site, subscriptionId, resourceGroup);
          if (this.shouldIncludeResource(resource)) {
            const service = await this.createServiceFromAzureResource(resource, 'function');
            if (service) {
              services.push(service);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover Function Apps in resource group ${resourceGroup}`, error);
    }

    return services;
  }

  private mapFunctionApp(site: any, subscriptionId: string, resourceGroup: string): AzureResource {
    return {
      id: site.id,
      name: site.name,
      type: 'function-app',
      location: site.location,
      resourceGroup,
      subscription: subscriptionId,
      tags: site.tags || {},
      properties: site,
      metadata: {
        kind: site.kind,
        state: site.state,
        defaultHostName: site.defaultHostName,
        runtime: site.siteConfig?.netFrameworkVersion || site.siteConfig?.nodeVersion,
        httpsOnly: site.httpsOnly,
        functionExecutionUnitsCache: site.functionExecutionUnitsCache,
      },
    };
  }

  // SQL Database Discovery
  private async discoverSQLDatabases(
    clients: AzureClients,
    subscriptionId: string,
    resourceGroup: string
  ): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      // Get SQL servers first
      for await (const server of clients.sql.servers.listByResourceGroup(resourceGroup)) {
        // Get databases for each server
        if (server.name) {
          for await (const database of clients.sql.databases.listByServer(resourceGroup, server.name)) {
            // Skip system databases
            if (['master', 'tempdb', 'model', 'msdb'].includes(database.name || '')) {
              continue;
            }

            const resource = this.mapSQLDatabase(database, server, subscriptionId, resourceGroup);
            if (this.shouldIncludeResource(resource)) {
              const service = await this.createServiceFromAzureResource(resource, 'database');
              if (service) {
                services.push(service);
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover SQL Databases in resource group ${resourceGroup}`, error);
    }

    return services;
  }

  private mapSQLDatabase(database: any, server: any, subscriptionId: string, resourceGroup: string): AzureResource {
    return {
      id: database.id,
      name: `${server.name}/${database.name}`,
      type: 'sql-database',
      location: database.location || server.location,
      resourceGroup,
      subscription: subscriptionId,
      tags: database.tags || server.tags || {},
      properties: { database, server },
      metadata: {
        serverName: server.name,
        databaseName: database.name,
        collation: database.collation,
        status: database.status,
        serviceLevelObjective: database.serviceLevelObjective,
        edition: database.edition,
        maxSizeBytes: database.maxSizeBytes,
        serverFullyQualifiedDomainName: server.fullyQualifiedDomainName,
        administratorLogin: server.administratorLogin,
      },
    };
  }

  // Storage Account Discovery
  private async discoverStorageAccounts(
    clients: AzureClients,
    subscriptionId: string,
    resourceGroup: string
  ): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      for await (const storageAccount of clients.storage.storageAccounts.listByResourceGroup(resourceGroup)) {
        const resource = this.mapStorageAccount(storageAccount, subscriptionId, resourceGroup);
        if (this.shouldIncludeResource(resource)) {
          const service = await this.createServiceFromAzureResource(resource, 'storage');
          if (service) {
            services.push(service);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover Storage Accounts in resource group ${resourceGroup}`, error);
    }

    return services;
  }

  private mapStorageAccount(storageAccount: any, subscriptionId: string, resourceGroup: string): AzureResource {
    return {
      id: storageAccount.id,
      name: storageAccount.name,
      type: 'storage-account',
      location: storageAccount.location,
      resourceGroup,
      subscription: subscriptionId,
      tags: storageAccount.tags || {},
      properties: storageAccount,
      metadata: {
        kind: storageAccount.kind,
        provisioningState: storageAccount.provisioningState,
        accountType: storageAccount.accountType,
        primaryLocation: storageAccount.primaryLocation,
        secondaryLocation: storageAccount.secondaryLocation,
        statusOfPrimary: storageAccount.statusOfPrimary,
        statusOfSecondary: storageAccount.statusOfSecondary,
        primaryEndpoints: storageAccount.primaryEndpoints,
        secondaryEndpoints: storageAccount.secondaryEndpoints,
      },
    };
  }

  // Helper methods
  private shouldIncludeResource(resource: AzureResource): boolean {
    // Apply region filters
    if (this.config.regions && this.config.regions.length > 0) {
      if (!this.config.regions.includes(resource.location)) {
        return false;
      }
    }

    // Apply tag filters
    if (this.config.discovery.tagFilters) {
      const matchesFilter = this.config.discovery.tagFilters.some(filter => {
        const tagValue = resource.tags[filter.key];
        return tagValue && filter.values.includes(tagValue);
      });
      
      if (!matchesFilter) {
        return false;
      }
    }

    // Apply exclude filters
    if (this.config.discovery.excludeTags) {
      const matchesExclude = this.config.discovery.excludeTags.some(exclude => {
        const tagValue = resource.tags[exclude.key];
        return tagValue && exclude.values.includes(tagValue);
      });
      
      if (matchesExclude) {
        return false;
      }
    }

    return true;
  }

  private async createServiceFromAzureResource(
    resource: AzureResource,
    serviceType: DiscoveredService['type']
  ): Promise<DiscoveredService | null> {
    try {
      // Determine service name using naming strategy
      let serviceName = resource.name;
      
      if (this.config.naming.useResourceTags && resource.tags.Name) {
        serviceName = resource.tags.Name;
      } else if (this.config.naming.fallbackToResourceName && !serviceName) {
        serviceName = resource.name;
      }

      // Create endpoints
      const endpoints = this.extractEndpointsFromAzureResource(resource);

      // Extract owner from tags
      const owner = this.extractOwnerFromTags(resource.tags);

      // Calculate confidence based on resource completeness
      const confidence = this.calculateAzureResourceConfidence(resource);

      const service = this.createService({
        id: this.generateServiceId('azure', resource.id),
        name: serviceName,
        type: serviceType,
        confidence,
        metadata: {
          ...resource.metadata,
          azure: {
            type: resource.type,
            location: resource.location,
            resourceGroup: resource.resourceGroup,
            subscription: resource.subscription,
            tags: resource.tags,
          },
        },
        endpoints,
        owner,
        deployment: {
          environment: this.inferEnvironmentFromTags(resource.tags),
          region: resource.location,
        },
      });

      return service;

    } catch (error) {
      this.logger.error(`Failed to create service from Azure resource ${resource.id}`, error);
      return null;
    }
  }

  private extractEndpointsFromAzureResource(resource: AzureResource): DiscoveredService['endpoints'] {
    const endpoints: DiscoveredService['endpoints'] = [];

    switch (resource.type) {
      case 'app-service':
      case 'function-app':
        if (resource.metadata.defaultHostName) {
          endpoints.push(createHttpEndpoint(`https://${resource.metadata.defaultHostName}`));
        }
        break;
      case 'storage-account':
        if (resource.metadata.primaryEndpoints) {
          const primaryEndpoints = resource.metadata.primaryEndpoints;
          if (primaryEndpoints.blob) {
            endpoints.push(createHttpEndpoint(primaryEndpoints.blob));
          }
          if (primaryEndpoints.file) {
            endpoints.push(createHttpEndpoint(primaryEndpoints.file));
          }
          if (primaryEndpoints.table) {
            endpoints.push(createHttpEndpoint(primaryEndpoints.table));
          }
          if (primaryEndpoints.queue) {
            endpoints.push(createHttpEndpoint(primaryEndpoints.queue));
          }
        }
        break;
      case 'sql-database':
        if (resource.metadata.serverFullyQualifiedDomainName) {
          endpoints.push(createHttpEndpoint(`tcp://${resource.metadata.serverFullyQualifiedDomainName}:1433`));
        }
        break;
      case 'container-instance':
        if (resource.metadata.ipAddress?.ip) {
          const ip = resource.metadata.ipAddress.ip;
          const ports = resource.metadata.ipAddress.ports || [];
          for (const port of ports) {
            const protocol = port.protocol?.toLowerCase() === 'tcp' ? 'http' : port.protocol?.toLowerCase();
            endpoints.push(createHttpEndpoint(`${protocol}://${ip}:${port.port}`));
          }
        }
        break;
    }

    return endpoints.length > 0 ? endpoints : undefined;
  }

  private extractOwnerFromTags(tags: Record<string, string>): DiscoveredService['owner'] | undefined {
    const ownerFields = ['Owner', 'Team', 'Contact', 'Email', 'CreatedBy'];
    
    for (const field of ownerFields) {
      const value = tags[field];
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

  private inferEnvironmentFromTags(tags: Record<string, string>): string {
    const envFields = ['Environment', 'Stage', 'Env', 'Tier'];
    
    for (const field of envFields) {
      const value = tags[field]?.toLowerCase();
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

  private calculateAzureResourceConfidence(resource: AzureResource): number {
    let confidence = 0.6; // Base confidence for Azure resources

    // Has meaningful tags
    if (Object.keys(resource.tags).length > 0) {
      confidence += 0.1;
    }

    // Has owner information
    if (this.extractOwnerFromTags(resource.tags)) {
      confidence += 0.15;
    }

    // Has environment tags
    if (this.inferEnvironmentFromTags(resource.tags) !== 'unknown') {
      confidence += 0.1;
    }

    // Is in running state
    const runningStates = ['running', 'succeeded', 'ready', 'available'];
    const state = (resource.metadata.state || resource.metadata.provisioningState || '').toLowerCase();
    if (runningStates.some(s => state.includes(s))) {
      confidence += 0.05;
    }

    // Has endpoints
    if (this.extractEndpointsFromAzureResource(resource)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }
}