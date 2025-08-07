import * as pulumi from '@pulumi/pulumi';
import { NetworkStack } from './components/network';
import { ComputeStack } from './components/compute';
import { DatabaseStack } from './components/database';
import { StorageStack } from './components/storage';
import { MonitoringStack } from './components/monitoring';
import { SecurityStack } from './components/security';
import { CDNStack } from './components/cdn';
import { BackstageStack } from './components/backstage';
import { getCloudProvider } from './components/providers';
import { validateConfiguration } from './policies/validation';
import { CostEstimator } from './components/cost-estimator';
import { DriftDetector } from './components/drift-detector';

// Get configuration
const config = new pulumi.Config();
const environment = config.require('environment');
const cloudProvider = config.get('cloud:provider') || 'aws';
const region = config.get('region') || 'us-east-1';
const multiRegion = config.getBoolean('multiRegion') || false;
const enableMonitoring = config.getBoolean('enableMonitoring') || true;
const enableBackup = config.getBoolean('enableBackup') || true;
const enableDR = config.getBoolean('enableDR') || false;

// Validate configuration
validateConfiguration({
  environment,
  cloudProvider,
  region,
  multiRegion,
  enableMonitoring,
  enableBackup,
  enableDR
});

// Initialize cloud provider
const provider = getCloudProvider(cloudProvider, region);

// Cost estimation
const costEstimator = new CostEstimator({
  provider: cloudProvider,
  region,
  environment
});

// Create infrastructure stacks
const networkStack = new NetworkStack(`${environment}-network`, {
  provider,
  environment,
  region,
  multiRegion,
  cidrBlock: environment === 'production' ? '10.0.0.0/16' : '172.16.0.0/16',
  enableFlowLogs: environment === 'production',
  enableNATGateway: true,
  availabilityZones: multiRegion ? 3 : 2
});

const securityStack = new SecurityStack(`${environment}-security`, {
  provider,
  environment,
  vpc: networkStack.vpc,
  enableWAF: environment === 'production',
  enableDDoSProtection: environment === 'production',
  enableEncryption: true,
  enableAuditLogging: true,
  complianceStandards: ['SOC2', 'GDPR', 'HIPAA']
});

const databaseStack = new DatabaseStack(`${environment}-database`, {
  provider,
  environment,
  vpc: networkStack.vpc,
  privateSubnets: networkStack.privateSubnets,
  securityGroup: securityStack.databaseSecurityGroup,
  engine: 'postgresql',
  version: '14.9',
  instanceClass: environment === 'production' ? 'db.r6g.xlarge' : 'db.t3.medium',
  allocatedStorage: environment === 'production' ? 100 : 20,
  enableMultiAZ: environment === 'production',
  enableBackup,
  backupRetentionPeriod: environment === 'production' ? 30 : 7,
  enableEncryption: true,
  enablePerformanceInsights: environment === 'production'
});

const storageStack = new StorageStack(`${environment}-storage`, {
  provider,
  environment,
  enableVersioning: true,
  enableEncryption: true,
  enableReplication: multiRegion,
  lifecycleRules: [
    {
      id: 'archive-old-data',
      enabled: true,
      transitions: [
        { days: 30, storageClass: 'STANDARD_IA' },
        { days: 90, storageClass: 'GLACIER' }
      ]
    }
  ],
  corsRules: [
    {
      allowedHeaders: ['*'],
      allowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
      allowedOrigins: environment === 'production' 
        ? ['https://portal.saas-idp.com']
        : ['http://localhost:3000', 'http://localhost:4400'],
      exposeHeaders: ['ETag'],
      maxAgeSeconds: 3000
    }
  ]
});

const computeStack = new ComputeStack(`${environment}-compute`, {
  provider,
  environment,
  vpc: networkStack.vpc,
  privateSubnets: networkStack.privateSubnets,
  publicSubnets: networkStack.publicSubnets,
  securityGroup: securityStack.applicationSecurityGroup,
  desiredCapacity: environment === 'production' ? 3 : 1,
  minSize: environment === 'production' ? 2 : 1,
  maxSize: environment === 'production' ? 10 : 3,
  instanceType: environment === 'production' ? 't3.large' : 't3.medium',
  enableAutoScaling: true,
  targetCPUUtilization: 70,
  healthCheckPath: '/health',
  containerImage: 'saas-idp/portal:latest',
  containerPort: 3000,
  cpu: environment === 'production' ? 2048 : 1024,
  memory: environment === 'production' ? 4096 : 2048
});

const cdnStack = new CDNStack(`${environment}-cdn`, {
  provider,
  environment,
  originDomain: computeStack.loadBalancerUrl,
  s3Bucket: storageStack.staticAssetsBucket,
  enableWAF: environment === 'production',
  enableDDoSProtection: environment === 'production',
  priceClass: environment === 'production' ? 'PriceClass_All' : 'PriceClass_100',
  certificateArn: securityStack.certificateArn,
  customDomain: environment === 'production' ? 'portal.saas-idp.com' : undefined,
  geoRestriction: {
    restrictionType: 'none',
    locations: []
  },
  cacheBehaviors: [
    {
      pathPattern: '/api/*',
      targetOriginId: 'api',
      viewerProtocolPolicy: 'https-only',
      allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
      cachedMethods: ['GET', 'HEAD'],
      compress: true,
      defaultTTL: 0,
      maxTTL: 0,
      minTTL: 0
    },
    {
      pathPattern: '/static/*',
      targetOriginId: 's3',
      viewerProtocolPolicy: 'https-only',
      allowedMethods: ['GET', 'HEAD'],
      cachedMethods: ['GET', 'HEAD'],
      compress: true,
      defaultTTL: 86400,
      maxTTL: 31536000,
      minTTL: 0
    }
  ]
});

const backstageStack = new BackstageStack(`${environment}-backstage`, {
  provider,
  environment,
  vpc: networkStack.vpc,
  privateSubnets: networkStack.privateSubnets,
  database: databaseStack.database,
  redis: databaseStack.redis,
  storage: storageStack.pluginStorage,
  securityGroup: securityStack.backstageSecurityGroup,
  replicas: environment === 'production' ? 3 : 1,
  resources: {
    requests: {
      cpu: environment === 'production' ? '1000m' : '500m',
      memory: environment === 'production' ? '2Gi' : '1Gi'
    },
    limits: {
      cpu: environment === 'production' ? '2000m' : '1000m',
      memory: environment === 'production' ? '4Gi' : '2Gi'
    }
  },
  ingress: {
    enabled: true,
    className: 'nginx',
    annotations: {
      'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
      'nginx.ingress.kubernetes.io/force-ssl-redirect': 'true',
      'nginx.ingress.kubernetes.io/ssl-protocols': 'TLSv1.2 TLSv1.3'
    },
    hosts: [
      {
        host: environment === 'production' ? 'backstage.saas-idp.com' : 'backstage.local',
        paths: [
          {
            path: '/',
            pathType: 'Prefix'
          }
        ]
      }
    ],
    tls: environment === 'production' ? [
      {
        secretName: 'backstage-tls',
        hosts: ['backstage.saas-idp.com']
      }
    ] : []
  }
});

// Monitoring stack (optional)
let monitoringStack: MonitoringStack | undefined;
if (enableMonitoring) {
  monitoringStack = new MonitoringStack(`${environment}-monitoring`, {
    provider,
    environment,
    vpc: networkStack.vpc,
    privateSubnets: networkStack.privateSubnets,
    enablePrometheus: true,
    enableGrafana: true,
    enableLoki: true,
    enableJaeger: true,
    enableAlertManager: true,
    retentionDays: environment === 'production' ? 30 : 7,
    alertingRules: [
      {
        name: 'high-cpu-usage',
        expr: 'avg(rate(container_cpu_usage_seconds_total[5m])) > 0.8',
        for: '5m',
        severity: 'warning',
        annotations: {
          summary: 'High CPU usage detected',
          description: 'CPU usage is above 80% for more than 5 minutes'
        }
      },
      {
        name: 'high-memory-usage',
        expr: 'avg(container_memory_usage_bytes / container_spec_memory_limit_bytes) > 0.9',
        for: '5m',
        severity: 'critical',
        annotations: {
          summary: 'High memory usage detected',
          description: 'Memory usage is above 90% for more than 5 minutes'
        }
      },
      {
        name: 'database-connection-pool-exhausted',
        expr: 'pg_stat_database_numbackends / pg_settings_max_connections > 0.9',
        for: '2m',
        severity: 'critical',
        annotations: {
          summary: 'Database connection pool nearly exhausted',
          description: 'Database connection pool usage is above 90%'
        }
      }
    ],
    dashboards: [
      'kubernetes-cluster',
      'application-metrics',
      'database-performance',
      'api-gateway',
      'security-events'
    ]
  });
}

// Drift detection
const driftDetector = new DriftDetector({
  stackName: pulumi.getStack(),
  checkInterval: '0 */6 * * *', // Every 6 hours
  notificationChannels: [
    {
      type: 'slack',
      webhook: process.env.SLACK_WEBHOOK_URL || ''
    },
    {
      type: 'email',
      recipients: ['ops@saas-idp.com']
    }
  ]
});

// Export outputs
export const vpcId = networkStack.vpc.id;
export const loadBalancerUrl = computeStack.loadBalancerUrl;
export const databaseEndpoint = databaseStack.database.endpoint;
export const redisEndpoint = databaseStack.redis.endpoint;
export const cdnDomain = cdnStack.distribution.domainName;
export const backstageUrl = backstageStack.serviceUrl;
export const monitoringDashboard = monitoringStack?.dashboardUrl;
export const estimatedMonthlyCost = costEstimator.estimatedMonthlyCost;
export const infrastructureMetrics = {
  totalResources: pulumi.all([
    networkStack.resourceCount,
    securityStack.resourceCount,
    databaseStack.resourceCount,
    storageStack.resourceCount,
    computeStack.resourceCount,
    cdnStack.resourceCount,
    backstageStack.resourceCount,
    monitoringStack?.resourceCount || 0
  ]).apply(counts => counts.reduce((a, b) => a + b, 0)),
  complianceScore: securityStack.complianceScore,
  securityPosture: securityStack.securityPosture,
  driftStatus: driftDetector.status,
  lastDriftCheck: driftDetector.lastCheckTime
};