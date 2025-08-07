import * as pulumi from '@pulumi/pulumi';

export interface ValidationConfig {
  environment: string;
  cloudProvider: string;
  region: string;
  multiRegion: boolean;
  enableMonitoring: boolean;
  enableBackup: boolean;
  enableDR: boolean;
}

export function validateConfiguration(config: ValidationConfig): void {
  // Environment validation
  const validEnvironments = ['development', 'staging', 'production'];
  if (!validEnvironments.includes(config.environment)) {
    throw new Error(`Invalid environment: ${config.environment}. Must be one of: ${validEnvironments.join(', ')}`);
  }

  // Cloud provider validation
  const validProviders = ['aws', 'gcp', 'azure'];
  if (!validProviders.includes(config.cloudProvider)) {
    throw new Error(`Invalid cloud provider: ${config.cloudProvider}. Must be one of: ${validProviders.join(', ')}`);
  }

  // Region validation
  validateRegion(config.cloudProvider, config.region);

  // Production environment requirements
  if (config.environment === 'production') {
    if (!config.enableMonitoring) {
      throw new Error('Monitoring must be enabled for production environment');
    }
    if (!config.enableBackup) {
      throw new Error('Backup must be enabled for production environment');
    }
    pulumi.log.warn('Consider enabling Disaster Recovery (DR) for production environment');
  }

  // Multi-region validation
  if (config.multiRegion && config.environment === 'development') {
    pulumi.log.warn('Multi-region deployment in development environment may incur unnecessary costs');
  }

  // DR validation
  if (config.enableDR && !config.enableBackup) {
    throw new Error('Disaster Recovery requires backup to be enabled');
  }

  if (config.enableDR && !config.multiRegion) {
    pulumi.log.warn('Disaster Recovery is more effective with multi-region deployment');
  }
}

function validateRegion(provider: string, region: string): void {
  const validRegions: Record<string, string[]> = {
    aws: [
      'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
      'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1',
      'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
      'ap-south-1', 'sa-east-1', 'ca-central-1'
    ],
    gcp: [
      'us-central1', 'us-east1', 'us-east4', 'us-west1', 'us-west2', 'us-west3', 'us-west4',
      'europe-west1', 'europe-west2', 'europe-west3', 'europe-west4', 'europe-west6',
      'asia-east1', 'asia-east2', 'asia-northeast1', 'asia-northeast2', 'asia-northeast3',
      'asia-south1', 'asia-southeast1', 'asia-southeast2'
    ],
    azure: [
      'East US', 'East US 2', 'West US', 'West US 2', 'West US 3',
      'Central US', 'North Central US', 'South Central US',
      'North Europe', 'West Europe', 'UK South', 'UK West',
      'East Asia', 'Southeast Asia', 'Japan East', 'Japan West',
      'Australia East', 'Australia Southeast', 'Central India'
    ]
  };

  const providerRegions = validRegions[provider];
  if (!providerRegions) {
    throw new Error(`No region validation available for provider: ${provider}`);
  }

  if (!providerRegions.includes(region)) {
    throw new Error(`Invalid region ${region} for provider ${provider}. Valid regions: ${providerRegions.join(', ')}`);
  }
}

export function validateResourceTags(tags: Record<string, string>): void {
  const requiredTags = ['Environment', 'ManagedBy', 'Project'];
  
  for (const tag of requiredTags) {
    if (!tags[tag]) {
      throw new Error(`Required tag '${tag}' is missing`);
    }
  }

  // Validate tag values
  if (tags.ManagedBy !== 'Pulumi') {
    pulumi.log.warn(`Tag 'ManagedBy' should be 'Pulumi', found: ${tags.ManagedBy}`);
  }

  if (tags.Project !== 'SaaS-IDP') {
    pulumi.log.warn(`Tag 'Project' should be 'SaaS-IDP', found: ${tags.Project}`);
  }
}

export function validateNamingConvention(name: string, resourceType: string): void {
  const pattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
  
  if (!pattern.test(name)) {
    throw new Error(`Resource name '${name}' does not follow naming convention. Use lowercase letters, numbers, and hyphens only.`);
  }

  if (name.length > 63) {
    throw new Error(`Resource name '${name}' is too long. Maximum 63 characters.`);
  }

  // Check for resource type prefix
  const expectedPrefixes: Record<string, string[]> = {
    'vpc': ['vpc-'],
    'subnet': ['subnet-', 'snet-'],
    'securitygroup': ['sg-'],
    'database': ['db-', 'rds-'],
    'storage': ['s3-', 'storage-', 'bucket-'],
    'function': ['fn-', 'lambda-'],
    'cluster': ['cluster-', 'eks-', 'gke-', 'aks-']
  };

  const prefixes = expectedPrefixes[resourceType.toLowerCase()];
  if (prefixes) {
    const hasValidPrefix = prefixes.some(prefix => name.startsWith(prefix));
    if (!hasValidPrefix) {
      pulumi.log.warn(`Resource name '${name}' should start with one of: ${prefixes.join(', ')}`);
    }
  }
}

export function validateResourceLimits(resourceType: string, config: any): void {
  const limits: Record<string, any> = {
    'compute': {
      minInstances: { min: 1, max: 100 },
      maxInstances: { min: 1, max: 1000 },
      cpu: { min: 256, max: 16384 },
      memory: { min: 512, max: 32768 }
    },
    'database': {
      allocatedStorage: { min: 20, max: 65536 },
      backupRetentionPeriod: { min: 1, max: 35 },
      readReplicas: { min: 0, max: 5 }
    },
    'storage': {
      bucketSize: { min: 0, max: 5497558138880 } // 5TB
    },
    'network': {
      availabilityZones: { min: 1, max: 6 },
      natGateways: { min: 0, max: 10 }
    }
  };

  const resourceLimits = limits[resourceType];
  if (!resourceLimits) {
    return;
  }

  for (const [key, limit] of Object.entries(resourceLimits)) {
    if (config[key] !== undefined) {
      const value = config[key];
      const { min, max } = limit as any;
      
      if (value < min || value > max) {
        throw new Error(`${resourceType}.${key} value ${value} is out of range. Must be between ${min} and ${max}`);
      }
    }
  }
}

export function validateSecuritySettings(config: any): void {
  // Encryption validation
  if (config.environment === 'production' && !config.enableEncryption) {
    throw new Error('Encryption must be enabled for production environment');
  }

  // SSL/TLS validation
  if (config.environment === 'production' && config.enableSSL === false) {
    throw new Error('SSL/TLS must be enabled for production environment');
  }

  // Backup validation
  if (config.environment === 'production' && config.backupRetentionPeriod < 7) {
    throw new Error('Backup retention period must be at least 7 days for production');
  }

  // Multi-AZ validation for production databases
  if (config.environment === 'production' && config.databaseMultiAZ === false) {
    pulumi.log.warn('Multi-AZ should be enabled for production databases');
  }

  // Security group validation
  if (config.allowedCIDRs && config.allowedCIDRs.includes('0.0.0.0/0')) {
    pulumi.log.warn('Security group allows traffic from anywhere (0.0.0.0/0). Consider restricting access.');
  }
}

export function validateCostOptimization(config: any): void {
  // Check for over-provisioning in non-production
  if (config.environment !== 'production') {
    if (config.instanceType && config.instanceType.includes('xlarge')) {
      pulumi.log.warn(`Large instance type ${config.instanceType} used in ${config.environment}. Consider using smaller instances.`);
    }

    if (config.minInstances > 2) {
      pulumi.log.warn(`High minimum instance count (${config.minInstances}) in ${config.environment}. Consider reducing for cost optimization.`);
    }

    if (config.enableMultiAZ) {
      pulumi.log.warn(`Multi-AZ enabled in ${config.environment}. This doubles the cost. Consider disabling for non-production.`);
    }
  }

  // Check for spot instance usage
  if (config.environment === 'development' && !config.useSpotInstances) {
    pulumi.log.info('Consider using spot instances for development environment to reduce costs');
  }

  // Check for unnecessary features
  if (config.enableDR && config.environment === 'development') {
    pulumi.log.warn('Disaster Recovery enabled in development. This may incur unnecessary costs.');
  }
}

export function validateCompliance(config: any, standards: string[]): void {
  for (const standard of standards) {
    switch (standard) {
      case 'SOC2':
        validateSOC2Compliance(config);
        break;
      case 'GDPR':
        validateGDPRCompliance(config);
        break;
      case 'HIPAA':
        validateHIPAACompliance(config);
        break;
      case 'ISO27001':
        validateISO27001Compliance(config);
        break;
      default:
        pulumi.log.warn(`Unknown compliance standard: ${standard}`);
    }
  }
}

function validateSOC2Compliance(config: any): void {
  // SOC2 Type II requirements
  if (!config.enableEncryption) {
    throw new Error('SOC2: Encryption at rest must be enabled');
  }
  if (!config.enableAuditLogging) {
    throw new Error('SOC2: Audit logging must be enabled');
  }
  if (!config.enableBackup) {
    throw new Error('SOC2: Backup must be enabled');
  }
  if (config.backupRetentionPeriod < 30) {
    throw new Error('SOC2: Backup retention must be at least 30 days');
  }
  if (!config.enableMonitoring) {
    throw new Error('SOC2: Monitoring must be enabled');
  }
}

function validateGDPRCompliance(config: any): void {
  // GDPR requirements
  if (!config.enableEncryption) {
    throw new Error('GDPR: Encryption must be enabled for personal data protection');
  }
  if (!config.enableAuditLogging) {
    throw new Error('GDPR: Audit logging must be enabled for accountability');
  }
  if (config.region && !config.region.startsWith('eu-')) {
    pulumi.log.warn('GDPR: Data should be stored in EU regions for EU citizens');
  }
  if (!config.dataRetentionPolicy) {
    pulumi.log.warn('GDPR: Data retention policy should be defined');
  }
}

function validateHIPAACompliance(config: any): void {
  // HIPAA requirements
  if (!config.enableEncryption) {
    throw new Error('HIPAA: Encryption is required for PHI');
  }
  if (!config.enableAuditLogging) {
    throw new Error('HIPAA: Audit logging is required');
  }
  if (!config.enableAccessControls) {
    throw new Error('HIPAA: Access controls must be implemented');
  }
  if (config.backupRetentionPeriod < 180) {
    throw new Error('HIPAA: Backup retention must be at least 6 months');
  }
  if (!config.enableDR) {
    pulumi.log.warn('HIPAA: Disaster recovery plan should be implemented');
  }
}

function validateISO27001Compliance(config: any): void {
  // ISO 27001 requirements
  if (!config.enableEncryption) {
    throw new Error('ISO27001: Cryptographic controls must be implemented');
  }
  if (!config.enableAuditLogging) {
    throw new Error('ISO27001: Event logging must be enabled');
  }
  if (!config.enableBackup) {
    throw new Error('ISO27001: Backup must be implemented');
  }
  if (!config.enableMonitoring) {
    throw new Error('ISO27001: System monitoring must be enabled');
  }
  if (!config.incidentResponsePlan) {
    pulumi.log.warn('ISO27001: Incident response plan should be defined');
  }
}

export function validateDependencies(dependencies: Record<string, string>): void {
  // Check for security vulnerabilities in dependencies
  const vulnerableDependencies = [
    { name: 'log4j', version: '2.14.1', issue: 'CVE-2021-44228' },
    { name: 'spring-core', version: '5.3.17', issue: 'CVE-2022-22965' }
  ];

  for (const [dep, version] of Object.entries(dependencies)) {
    const vulnerable = vulnerableDependencies.find(v => 
      dep.includes(v.name) && version === v.version
    );
    
    if (vulnerable) {
      throw new Error(`Vulnerable dependency detected: ${dep}@${version} (${vulnerable.issue})`);
    }
  }
}

export function validateNetworkSegmentation(vpc: any, subnets: any[]): void {
  // Ensure proper network segmentation
  const publicSubnets = subnets.filter(s => s.public);
  const privateSubnets = subnets.filter(s => !s.public);

  if (publicSubnets.length === 0) {
    pulumi.log.warn('No public subnets found. This may prevent internet access.');
  }

  if (privateSubnets.length === 0) {
    throw new Error('No private subnets found. Databases and internal services should be in private subnets.');
  }

  // Check for proper CIDR allocation
  const cidrOverlaps = checkCIDROverlaps(subnets.map(s => s.cidrBlock));
  if (cidrOverlaps.length > 0) {
    throw new Error(`CIDR blocks overlap detected: ${cidrOverlaps.join(', ')}`);
  }
}

function checkCIDROverlaps(cidrBlocks: string[]): string[] {
  const overlaps: string[] = [];
  
  for (let i = 0; i < cidrBlocks.length; i++) {
    for (let j = i + 1; j < cidrBlocks.length; j++) {
      if (cidrOverlap(cidrBlocks[i], cidrBlocks[j])) {
        overlaps.push(`${cidrBlocks[i]} overlaps with ${cidrBlocks[j]}`);
      }
    }
  }
  
  return overlaps;
}

function cidrOverlap(cidr1: string, cidr2: string): boolean {
  // Simplified CIDR overlap check
  const [ip1, mask1] = cidr1.split('/');
  const [ip2, mask2] = cidr2.split('/');
  
  const ip1Num = ipToNumber(ip1);
  const ip2Num = ipToNumber(ip2);
  const mask1Num = parseInt(mask1);
  const mask2Num = parseInt(mask2);
  
  const range1Start = ip1Num;
  const range1End = ip1Num + Math.pow(2, 32 - mask1Num) - 1;
  const range2Start = ip2Num;
  const range2End = ip2Num + Math.pow(2, 32 - mask2Num) - 1;
  
  return (range1Start <= range2End && range2Start <= range1End);
}

function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}