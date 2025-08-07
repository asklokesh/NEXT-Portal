/**
 * AWS Resource Scanner
 * 
 * Advanced discovery source that scans AWS infrastructure to identify services,
 * resources, and workloads across multiple AWS services including EC2, ECS,
 * Lambda, RDS, S3, and more. Provides comprehensive cost and usage analysis.
 */

import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeLoadBalancersCommand,
} from '@aws-sdk/client-ec2';
import {
  ECSClient,
  ListClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
  ListTaskDefinitionsCommand,
} from '@aws-sdk/client-ecs';
import {
  LambdaClient,
  ListFunctionsCommand,
  GetFunctionCommand,
} from '@aws-sdk/client-lambda';
import {
  RDSClient,
  DescribeDBInstancesCommand,
  DescribeDBClustersCommand,
} from '@aws-sdk/client-rds';
import {
  S3Client,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';
import {
  CloudFormationClient,
  ListStacksCommand,
  DescribeStackResourcesCommand,
} from '@aws-sdk/client-cloudformation';
import {
  CostExplorerClient,
  GetDimensionValuesCommand,
  GetRightsizingRecommendationCommand,
} from '@aws-sdk/client-cost-explorer';
import {
  ResourceGroupsTaggingAPIClient,
  GetResourcesCommand,
} from '@aws-sdk/client-resource-groups-tagging-api';
import { Logger } from 'winston';
import { z } from 'zod';
import { BaseDiscoverySource, createHttpEndpoint } from '../core/base-source';
import { DiscoveredService } from '../core/discovery-engine';

// Configuration schema
const AWSResourceScannerConfigSchema = z.object({
  credentials: z.object({
    type: z.enum(['default', 'profile', 'iam_role', 'access_keys']),
    profile: z.string().optional(),
    accessKeyId: z.string().optional(),
    secretAccessKey: z.string().optional(),
    sessionToken: z.string().optional(),
    roleArn: z.string().optional(),
  }),
  regions: z.array(z.string()).default(['us-east-1', 'us-west-2']),
  services: z.object({
    ec2: z.boolean().default(true),
    ecs: z.boolean().default(true),
    lambda: z.boolean().default(true),
    rds: z.boolean().default(true),
    s3: z.boolean().default(true),
    elasticbeanstalk: z.boolean().default(true),
    apigateway: z.boolean().default(true),
    cloudformation: z.boolean().default(true),
    elbv2: z.boolean().default(true),
  }),
  discovery: z.object({
    includeStoppedInstances: z.boolean().default(false),
    includePrivateResources: z.boolean().default(true),
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
    timeframe: z.enum(['DAILY', 'MONTHLY']).default('MONTHLY'),
    granularity: z.enum(['DAILY', 'MONTHLY', 'HOURLY']).default('DAILY'),
  }),
  naming: z.object({
    useCloudFormationStackName: z.boolean().default(true),
    useInstanceTags: z.boolean().default(true),
    fallbackToResourceId: z.boolean().default(true),
  }),
});

type AWSResourceScannerConfig = z.infer<typeof AWSResourceScannerConfigSchema>;

// AWS Resource interfaces
interface AWSResource {
  id: string;
  name: string;
  type: string;
  region: string;
  arn?: string;
  tags: Record<string, string>;
  state: string;
  endpoint?: string;
  metadata: Record<string, any>;
  costs?: {
    monthly: number;
    currency: string;
  };
}

interface AWSServiceClients {
  ec2: EC2Client;
  ecs: ECSClient;
  lambda: LambdaClient;
  rds: RDSClient;
  s3: S3Client;
  cloudformation: CloudFormationClient;
  costExplorer: CostExplorerClient;
  resourceGroupsTagging: ResourceGroupsTaggingAPIClient;
}

export class AWSResourceScanner extends BaseDiscoverySource {
  private config!: AWSResourceScannerConfig;
  private clients: Map<string, AWSServiceClients> = new Map();

  constructor(logger: Logger) {
    super('aws-resource-scanner', '1.0.0', 80, logger);
  }

  protected async initializeSource(config: any): Promise<void> {
    this.config = AWSResourceScannerConfigSchema.parse(config);

    // Initialize AWS clients for each region
    for (const region of this.config.regions) {
      await this.initializeRegionClients(region);
    }

    this.logger.info(`AWS resource scanner initialized for ${this.config.regions.length} regions`);
  }

  protected async performDiscovery(): Promise<DiscoveredService[]> {
    const allServices: DiscoveredService[] = [];

    for (const region of this.config.regions) {
      try {
        const regionServices = await this.discoverRegionResources(region);
        allServices.push(...regionServices);
      } catch (error) {
        this.logger.error(`Failed to discover resources in region ${region}`, error);
      }
    }

    this.logger.info(`AWS discovery completed: ${allServices.length} services found`);
    return allServices;
  }

  protected async performHealthCheck(): Promise<boolean> {
    try {
      // Test connection with a simple API call
      const region = this.config.regions[0];
      const clients = this.clients.get(region);
      
      if (clients) {
        await clients.s3.send(new ListBucketsCommand({}));
        return true;
      }

      return false;
    } catch (error) {
      this.logger.warn('AWS resource scanner health check failed', error);
      return false;
    }
  }

  protected async disposeSource(): Promise<void> {
    this.clients.clear();
  }

  // Region client initialization
  private async initializeRegionClients(region: string): Promise<void> {
    try {
      const clientConfig = {
        region,
        credentials: this.getCredentialsProvider(),
      };

      const clients: AWSServiceClients = {
        ec2: new EC2Client(clientConfig),
        ecs: new ECSClient(clientConfig),
        lambda: new LambdaClient(clientConfig),
        rds: new RDSClient(clientConfig),
        s3: new S3Client(clientConfig),
        cloudformation: new CloudFormationClient(clientConfig),
        costExplorer: new CostExplorerClient({ ...clientConfig, region: 'us-east-1' }), // Cost Explorer is only available in us-east-1
        resourceGroupsTagging: new ResourceGroupsTaggingAPIClient(clientConfig),
      };

      this.clients.set(region, clients);
      this.logger.debug(`Initialized AWS clients for region: ${region}`);

    } catch (error) {
      this.logger.error(`Failed to initialize AWS clients for region ${region}`, error);
      throw error;
    }
  }

  private getCredentialsProvider(): any {
    switch (this.config.credentials.type) {
      case 'profile':
        return { profile: this.config.credentials.profile };
      case 'access_keys':
        return {
          accessKeyId: this.config.credentials.accessKeyId!,
          secretAccessKey: this.config.credentials.secretAccessKey!,
          sessionToken: this.config.credentials.sessionToken,
        };
      case 'iam_role':
        // TODO: Implement IAM role assumption
        throw new Error('IAM role credentials not yet implemented');
      default:
        return undefined; // Use default credentials
    }
  }

  // Resource discovery by region
  private async discoverRegionResources(region: string): Promise<DiscoveredService[]> {
    const clients = this.clients.get(region);
    if (!clients) {
      throw new Error(`No clients initialized for region ${region}`);
    }

    const services: DiscoveredService[] = [];

    // Discover EC2 instances
    if (this.config.services.ec2) {
      const ec2Services = await this.discoverEC2Instances(clients, region);
      services.push(...ec2Services);
    }

    // Discover ECS services
    if (this.config.services.ecs) {
      const ecsServices = await this.discoverECSServices(clients, region);
      services.push(...ecsServices);
    }

    // Discover Lambda functions
    if (this.config.services.lambda) {
      const lambdaServices = await this.discoverLambdaFunctions(clients, region);
      services.push(...lambdaServices);
    }

    // Discover RDS instances
    if (this.config.services.rds) {
      const rdsServices = await this.discoverRDSInstances(clients, region);
      services.push(...rdsServices);
    }

    // Discover S3 buckets (global service, only scan once)
    if (this.config.services.s3 && region === this.config.regions[0]) {
      const s3Services = await this.discoverS3Buckets(clients, region);
      services.push(...s3Services);
    }

    // Enrich with cost information
    if (this.config.cost.enabled) {
      await this.enrichWithCostData(services, clients);
    }

    return services;
  }

  // EC2 Discovery
  private async discoverEC2Instances(clients: AWSServiceClients, region: string): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      const command = new DescribeInstancesCommand({});
      const response = await clients.ec2.send(command);

      for (const reservation of response.Reservations || []) {
        for (const instance of reservation.Instances || []) {
          // Skip stopped instances if not configured to include them
          if (!this.config.discovery.includeStoppedInstances && instance.State?.Name !== 'running') {
            continue;
          }

          const resource = this.mapEC2Instance(instance, region);
          if (this.shouldIncludeResource(resource)) {
            const service = await this.createServiceFromAWSResource(resource, 'microservice');
            if (service) {
              services.push(service);
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover EC2 instances in region ${region}`, error);
    }

    return services;
  }

  private mapEC2Instance(instance: any, region: string): AWSResource {
    const tags = this.extractTags(instance.Tags);
    const name = tags.Name || instance.InstanceId || 'Unknown';

    return {
      id: instance.InstanceId,
      name,
      type: 'ec2-instance',
      region,
      arn: `arn:aws:ec2:${region}:${instance.OwnerId}:instance/${instance.InstanceId}`,
      tags,
      state: instance.State?.Name || 'unknown',
      endpoint: instance.PublicDnsName || instance.PrivateDnsName,
      metadata: {
        instanceType: instance.InstanceType,
        platform: instance.Platform,
        architecture: instance.Architecture,
        virtualizationType: instance.VirtualizationType,
        hypervisor: instance.Hypervisor,
        publicIpAddress: instance.PublicIpAddress,
        privateIpAddress: instance.PrivateIpAddress,
        subnetId: instance.SubnetId,
        vpcId: instance.VpcId,
        securityGroups: instance.SecurityGroups?.map((sg: any) => ({
          id: sg.GroupId,
          name: sg.GroupName,
        })),
        launchTime: instance.LaunchTime,
      },
    };
  }

  // ECS Discovery
  private async discoverECSServices(clients: AWSServiceClients, region: string): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      // Get all ECS clusters
      const clustersResponse = await clients.ecs.send(new ListClustersCommand({}));
      
      for (const clusterArn of clustersResponse.clusterArns || []) {
        // Get services in each cluster
        const servicesResponse = await clients.ecs.send(new ListServicesCommand({
          cluster: clusterArn,
        }));

        // Get detailed service information
        if (servicesResponse.serviceArns && servicesResponse.serviceArns.length > 0) {
          const serviceDetailsResponse = await clients.ecs.send(new DescribeServicesCommand({
            cluster: clusterArn,
            services: servicesResponse.serviceArns,
          }));

          for (const ecsService of serviceDetailsResponse.services || []) {
            const resource = this.mapECSService(ecsService, region, clusterArn);
            if (this.shouldIncludeResource(resource)) {
              const service = await this.createServiceFromAWSResource(resource, 'microservice');
              if (service) {
                services.push(service);
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover ECS services in region ${region}`, error);
    }

    return services;
  }

  private mapECSService(ecsService: any, region: string, clusterArn: string): AWSResource {
    const tags = this.extractTags(ecsService.tags);
    const name = ecsService.serviceName || 'Unknown ECS Service';
    const clusterName = clusterArn.split('/').pop();

    return {
      id: ecsService.serviceArn,
      name: `${clusterName}/${name}`,
      type: 'ecs-service',
      region,
      arn: ecsService.serviceArn,
      tags,
      state: ecsService.status || 'unknown',
      metadata: {
        cluster: clusterName,
        clusterArn,
        taskDefinition: ecsService.taskDefinition,
        desiredCount: ecsService.desiredCount,
        runningCount: ecsService.runningCount,
        pendingCount: ecsService.pendingCount,
        launchType: ecsService.launchType,
        platformVersion: ecsService.platformVersion,
        loadBalancers: ecsService.loadBalancers,
        serviceRegistries: ecsService.serviceRegistries,
        networkConfiguration: ecsService.networkConfiguration,
        createdAt: ecsService.createdAt,
      },
    };
  }

  // Lambda Discovery
  private async discoverLambdaFunctions(clients: AWSServiceClients, region: string): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      const command = new ListFunctionsCommand({});
      const response = await clients.lambda.send(command);

      for (const lambdaFunction of response.Functions || []) {
        // Get detailed function information
        const functionDetails = await clients.lambda.send(new GetFunctionCommand({
          FunctionName: lambdaFunction.FunctionName,
        }));

        const resource = this.mapLambdaFunction(functionDetails, region);
        if (this.shouldIncludeResource(resource)) {
          const service = await this.createServiceFromAWSResource(resource, 'function');
          if (service) {
            services.push(service);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover Lambda functions in region ${region}`, error);
    }

    return services;
  }

  private mapLambdaFunction(functionDetails: any, region: string): AWSResource {
    const config = functionDetails.Configuration;
    const tags = functionDetails.Tags || {};
    
    return {
      id: config.FunctionArn,
      name: config.FunctionName,
      type: 'lambda-function',
      region,
      arn: config.FunctionArn,
      tags,
      state: config.State || 'unknown',
      metadata: {
        runtime: config.Runtime,
        handler: config.Handler,
        codeSize: config.CodeSize,
        description: config.Description,
        timeout: config.Timeout,
        memorySize: config.MemorySize,
        lastModified: config.LastModified,
        version: config.Version,
        environment: config.Environment,
        role: config.Role,
        layers: config.Layers,
        architectures: config.Architectures,
      },
    };
  }

  // RDS Discovery
  private async discoverRDSInstances(clients: AWSServiceClients, region: string): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      // Discover RDS instances
      const instancesResponse = await clients.rds.send(new DescribeDBInstancesCommand({}));
      
      for (const dbInstance of instancesResponse.DBInstances || []) {
        const resource = this.mapRDSInstance(dbInstance, region);
        if (this.shouldIncludeResource(resource)) {
          const service = await this.createServiceFromAWSResource(resource, 'database');
          if (service) {
            services.push(service);
          }
        }
      }

      // Discover RDS clusters
      const clustersResponse = await clients.rds.send(new DescribeDBClustersCommand({}));
      
      for (const dbCluster of clustersResponse.DBClusters || []) {
        const resource = this.mapRDSCluster(dbCluster, region);
        if (this.shouldIncludeResource(resource)) {
          const service = await this.createServiceFromAWSResource(resource, 'database');
          if (service) {
            services.push(service);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover RDS instances in region ${region}`, error);
    }

    return services;
  }

  private mapRDSInstance(dbInstance: any, region: string): AWSResource {
    const tags = this.extractTags(dbInstance.TagList);
    
    return {
      id: dbInstance.DBInstanceIdentifier,
      name: dbInstance.DBInstanceIdentifier,
      type: 'rds-instance',
      region,
      arn: dbInstance.DBInstanceArn,
      tags,
      state: dbInstance.DBInstanceStatus || 'unknown',
      endpoint: dbInstance.Endpoint?.Address,
      metadata: {
        engine: dbInstance.Engine,
        engineVersion: dbInstance.EngineVersion,
        dbInstanceClass: dbInstance.DBInstanceClass,
        allocatedStorage: dbInstance.AllocatedStorage,
        storageType: dbInstance.StorageType,
        multiAZ: dbInstance.MultiAZ,
        publiclyAccessible: dbInstance.PubliclyAccessible,
        port: dbInstance.Endpoint?.Port,
        availabilityZone: dbInstance.AvailabilityZone,
        vpcSecurityGroups: dbInstance.VpcSecurityGroups,
        subnetGroup: dbInstance.DBSubnetGroup,
        createdTime: dbInstance.InstanceCreateTime,
      },
    };
  }

  private mapRDSCluster(dbCluster: any, region: string): AWSResource {
    const tags = this.extractTags(dbCluster.TagList);
    
    return {
      id: dbCluster.DBClusterIdentifier,
      name: dbCluster.DBClusterIdentifier,
      type: 'rds-cluster',
      region,
      arn: dbCluster.DBClusterArn,
      tags,
      state: dbCluster.Status || 'unknown',
      endpoint: dbCluster.Endpoint,
      metadata: {
        engine: dbCluster.Engine,
        engineVersion: dbCluster.EngineVersion,
        port: dbCluster.Port,
        multiAZ: dbCluster.MultiAZ,
        availabilityZones: dbCluster.AvailabilityZones,
        dbClusterMembers: dbCluster.DBClusterMembers,
        readerEndpoint: dbCluster.ReaderEndpoint,
        createdTime: dbCluster.ClusterCreateTime,
      },
    };
  }

  // S3 Discovery
  private async discoverS3Buckets(clients: AWSServiceClients, region: string): Promise<DiscoveredService[]> {
    const services: DiscoveredService[] = [];

    try {
      const response = await clients.s3.send(new ListBucketsCommand({}));

      for (const bucket of response.Buckets || []) {
        const resource = this.mapS3Bucket(bucket, region);
        if (this.shouldIncludeResource(resource)) {
          const service = await this.createServiceFromAWSResource(resource, 'storage');
          if (service) {
            services.push(service);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover S3 buckets`, error);
    }

    return services;
  }

  private mapS3Bucket(bucket: any, region: string): AWSResource {
    return {
      id: bucket.Name,
      name: bucket.Name,
      type: 's3-bucket',
      region: 'global', // S3 buckets are global
      arn: `arn:aws:s3:::${bucket.Name}`,
      tags: {}, // S3 tags require separate API call
      state: 'active',
      endpoint: `https://${bucket.Name}.s3.amazonaws.com`,
      metadata: {
        createdDate: bucket.CreationDate,
      },
    };
  }

  // Helper methods
  private extractTags(tags: any[]): Record<string, string> {
    const tagMap: Record<string, string> = {};
    
    if (Array.isArray(tags)) {
      for (const tag of tags) {
        if (tag.Key && tag.Value) {
          tagMap[tag.Key] = tag.Value;
        }
      }
    }
    
    return tagMap;
  }

  private shouldIncludeResource(resource: AWSResource): boolean {
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

  private async createServiceFromAWSResource(
    resource: AWSResource,
    serviceType: DiscoveredService['type']
  ): Promise<DiscoveredService | null> {
    try {
      // Determine service name using naming strategy
      let serviceName = resource.name;
      
      if (this.config.naming.useInstanceTags && resource.tags.Name) {
        serviceName = resource.tags.Name;
      } else if (this.config.naming.fallbackToResourceId && !serviceName) {
        serviceName = resource.id;
      }

      // Create endpoints
      const endpoints = resource.endpoint ? [createHttpEndpoint(resource.endpoint)] : undefined;

      // Extract owner from tags
      const owner = this.extractOwnerFromTags(resource.tags);

      // Calculate confidence based on resource completeness
      const confidence = this.calculateAWSResourceConfidence(resource);

      const service = this.createService({
        id: this.generateServiceId('aws', resource.id),
        name: serviceName,
        type: serviceType,
        confidence,
        metadata: {
          ...resource.metadata,
          aws: {
            type: resource.type,
            region: resource.region,
            arn: resource.arn,
            tags: resource.tags,
            state: resource.state,
          },
        },
        endpoints,
        owner,
        deployment: {
          environment: this.inferEnvironmentFromTags(resource.tags),
          cluster: resource.type === 'ecs-service' ? resource.metadata.cluster : undefined,
          region: resource.region,
        },
      });

      return service;

    } catch (error) {
      this.logger.error(`Failed to create service from AWS resource ${resource.id}`, error);
      return null;
    }
  }

  private extractOwnerFromTags(tags: Record<string, string>): DiscoveredService['owner'] | undefined {
    const ownerFields = ['Owner', 'Team', 'Contact', 'Email'];
    
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
    const envFields = ['Environment', 'Stage', 'Env'];
    
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

  private calculateAWSResourceConfidence(resource: AWSResource): number {
    let confidence = 0.6; // Base confidence for AWS resources

    // Has meaningful name
    if (resource.tags.Name && resource.tags.Name !== resource.id) {
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

    // Is running/active
    if (['running', 'active', 'available'].includes(resource.state.toLowerCase())) {
      confidence += 0.05;
    }

    // Has endpoint
    if (resource.endpoint) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  private async enrichWithCostData(services: DiscoveredService[], clients: AWSServiceClients): Promise<void> {
    try {
      // This is a simplified cost enrichment
      // In practice, you'd want to use the Cost Explorer API more extensively
      this.logger.debug('Cost enrichment not yet fully implemented');
    } catch (error) {
      this.logger.debug('Failed to enrich with cost data', error);
    }
  }
}