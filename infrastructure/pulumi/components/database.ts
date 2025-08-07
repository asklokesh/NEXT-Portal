import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as gcp from '@pulumi/gcp';
import * as azure from '@pulumi/azure-native';
import * as random from '@pulumi/random';

export interface DatabaseStackArgs {
  provider: any;
  environment: string;
  vpc: any;
  privateSubnets: any[];
  securityGroup: any;
  engine: 'postgresql' | 'mysql' | 'sqlserver';
  version: string;
  instanceClass: string;
  allocatedStorage: number;
  enableMultiAZ: boolean;
  enableBackup: boolean;
  backupRetentionPeriod: number;
  enableEncryption: boolean;
  enablePerformanceInsights: boolean;
}

export class DatabaseStack extends pulumi.ComponentResource {
  public readonly database: any;
  public readonly redis: any;
  public readonly connectionString: pulumi.Output<string>;
  public readonly resourceCount: pulumi.Output<number>;

  constructor(name: string, args: DatabaseStackArgs, opts?: pulumi.ComponentResourceOptions) {
    super('saas-idp:database:Stack', name, {}, opts);

    const defaultTags = {
      Environment: args.environment,
      ManagedBy: 'Pulumi',
      Component: 'Database',
      Project: 'SaaS-IDP'
    };

    // Generate secure passwords
    const dbPassword = new random.RandomPassword(`${name}-db-password`, {
      length: 32,
      special: true,
      overrideSpecial: '!@#$%^&*()',
      keepers: {
        environment: args.environment
      }
    }, { parent: this });

    const redisPassword = new random.RandomPassword(`${name}-redis-password`, {
      length: 32,
      special: false,
      keepers: {
        environment: args.environment
      }
    }, { parent: this });

    if (args.provider.constructor.name.includes('Aws')) {
      // AWS RDS Implementation
      
      // Create DB subnet group
      const dbSubnetGroup = new aws.rds.SubnetGroup(`${name}-subnet-group`, {
        subnetIds: args.privateSubnets.map(subnet => subnet.id),
        tags: {
          ...defaultTags,
          Name: `${name}-subnet-group`
        }
      }, { parent: this });

      // Create parameter group for optimizations
      const parameterGroup = new aws.rds.ParameterGroup(`${name}-params`, {
        family: args.engine === 'postgresql' ? 'postgres14' : 'mysql8.0',
        parameters: args.engine === 'postgresql' ? [
          { name: 'shared_preload_libraries', value: 'pg_stat_statements,pgaudit' },
          { name: 'log_statement', value: 'all' },
          { name: 'log_duration', value: '1' },
          { name: 'autovacuum_max_workers', value: '4' },
          { name: 'effective_cache_size', value: '2GB' },
          { name: 'maintenance_work_mem', value: '256MB' },
          { name: 'checkpoint_completion_target', value: '0.9' },
          { name: 'wal_buffers', value: '16MB' },
          { name: 'default_statistics_target', value: '100' },
          { name: 'random_page_cost', value: '1.1' },
          { name: 'effective_io_concurrency', value: '200' },
          { name: 'work_mem', value: '4MB' },
          { name: 'huge_pages', value: 'off' },
          { name: 'min_wal_size', value: '1GB' },
          { name: 'max_wal_size', value: '4GB' },
          { name: 'max_worker_processes', value: '8' },
          { name: 'max_parallel_workers_per_gather', value: '4' },
          { name: 'max_parallel_workers', value: '8' },
          { name: 'max_parallel_maintenance_workers', value: '4' }
        ] : [
          { name: 'innodb_buffer_pool_size', value: '{DBInstanceClassMemory*3/4}' },
          { name: 'max_connections', value: '1000' },
          { name: 'slow_query_log', value: '1' },
          { name: 'long_query_time', value: '1' }
        ],
        tags: defaultTags
      }, { parent: this });

      // Create option group for additional features
      const optionGroup = new aws.rds.OptionGroup(`${name}-options`, {
        engineName: args.engine,
        majorEngineVersion: args.version.split('.')[0],
        options: args.engine === 'postgresql' ? [] : [
          {
            optionName: 'MARIADB_AUDIT_PLUGIN',
            optionSettings: [
              { name: 'SERVER_AUDIT_EVENTS', value: 'CONNECT,QUERY' },
              { name: 'SERVER_AUDIT_FILE_ROTATIONS', value: '37' }
            ]
          }
        ],
        tags: defaultTags
      }, { parent: this });

      // Create monitoring role
      const monitoringRole = new aws.iam.Role(`${name}-monitoring-role`, {
        assumeRolePolicy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [{
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'monitoring.rds.amazonaws.com'
            }
          }]
        }),
        tags: defaultTags
      }, { parent: this });

      new aws.iam.RolePolicyAttachment(`${name}-monitoring-policy`, {
        role: monitoringRole.name,
        policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole'
      }, { parent: this });

      // Create KMS key for encryption
      let kmsKey: aws.kms.Key | undefined;
      if (args.enableEncryption) {
        kmsKey = new aws.kms.Key(`${name}-kms-key`, {
          description: `KMS key for ${name} database encryption`,
          keyPolicy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Sid: 'Enable IAM User Permissions',
                Effect: 'Allow',
                Principal: {
                  AWS: pulumi.interpolate`arn:aws:iam::${aws.getCallerIdentity().then(id => id.accountId)}:root`
                },
                Action: 'kms:*',
                Resource: '*'
              },
              {
                Sid: 'Allow RDS to use the key',
                Effect: 'Allow',
                Principal: {
                  Service: 'rds.amazonaws.com'
                },
                Action: [
                  'kms:Decrypt',
                  'kms:GenerateDataKey'
                ],
                Resource: '*'
              }
            ]
          }),
          tags: defaultTags
        }, { parent: this });

        new aws.kms.Alias(`${name}-kms-alias`, {
          name: `alias/${name}-database`,
          targetKeyId: kmsKey.id
        }, { parent: this });
      }

      // Create RDS instance
      this.database = new aws.rds.Instance(`${name}-db`, {
        engine: args.engine,
        engineVersion: args.version,
        instanceClass: args.instanceClass,
        allocatedStorage: args.allocatedStorage,
        storageType: 'gp3',
        storageEncrypted: args.enableEncryption,
        kmsKeyId: kmsKey?.arn,
        dbName: 'saasidp',
        username: 'saasidpadmin',
        password: dbPassword.result,
        dbSubnetGroupName: dbSubnetGroup.name,
        vpcSecurityGroupIds: [args.securityGroup.id],
        parameterGroupName: parameterGroup.name,
        optionGroupName: optionGroup.name,
        multiAz: args.enableMultiAZ,
        publiclyAccessible: false,
        backupRetentionPeriod: args.enableBackup ? args.backupRetentionPeriod : 0,
        backupWindow: '03:00-04:00',
        maintenanceWindow: 'sun:04:00-sun:05:00',
        autoMinorVersionUpgrade: true,
        enabledCloudwatchLogsExports: args.engine === 'postgresql' 
          ? ['postgresql'] 
          : ['error', 'general', 'slowquery'],
        performanceInsightsEnabled: args.enablePerformanceInsights,
        performanceInsightsRetentionPeriod: args.enablePerformanceInsights ? 7 : undefined,
        performanceInsightsKmsKeyId: args.enablePerformanceInsights ? kmsKey?.arn : undefined,
        monitoringInterval: args.enablePerformanceInsights ? 60 : 0,
        monitoringRoleArn: args.enablePerformanceInsights ? monitoringRole.arn : undefined,
        deletionProtection: args.environment === 'production',
        copyTagsToSnapshot: true,
        tags: {
          ...defaultTags,
          Name: `${name}-database`
        }
      }, { parent: this });

      // Create read replicas for production
      if (args.environment === 'production') {
        for (let i = 0; i < 2; i++) {
          new aws.rds.Instance(`${name}-db-replica-${i}`, {
            replicateSourceDb: this.database.identifier,
            instanceClass: args.instanceClass,
            publiclyAccessible: false,
            autoMinorVersionUpgrade: true,
            performanceInsightsEnabled: args.enablePerformanceInsights,
            performanceInsightsRetentionPeriod: args.enablePerformanceInsights ? 7 : undefined,
            tags: {
              ...defaultTags,
              Name: `${name}-database-replica-${i}`,
              Type: 'ReadReplica'
            }
          }, { parent: this });
        }
      }

      // Create ElastiCache Redis cluster
      const redisSubnetGroup = new aws.elasticache.SubnetGroup(`${name}-redis-subnet-group`, {
        subnetIds: args.privateSubnets.map(subnet => subnet.id),
        tags: {
          ...defaultTags,
          Name: `${name}-redis-subnet-group`
        }
      }, { parent: this });

      const redisParameterGroup = new aws.elasticache.ParameterGroup(`${name}-redis-params`, {
        family: 'redis7',
        parameters: [
          { name: 'maxmemory-policy', value: 'allkeys-lru' },
          { name: 'timeout', value: '300' },
          { name: 'tcp-keepalive', value: '60' },
          { name: 'tcp-backlog', value: '511' },
          { name: 'databases', value: '16' },
          { name: 'notify-keyspace-events', value: 'Ex' }
        ],
        tags: defaultTags
      }, { parent: this });

      this.redis = new aws.elasticache.ReplicationGroup(`${name}-redis`, {
        replicationGroupId: `${name}-redis`.substring(0, 40),
        description: `Redis cache for ${name}`,
        engine: 'redis',
        engineVersion: '7.0',
        nodeType: args.environment === 'production' ? 'cache.r6g.large' : 'cache.t3.micro',
        numCacheClusters: args.enableMultiAZ ? 2 : 1,
        automaticFailoverEnabled: args.enableMultiAZ,
        multiAzEnabled: args.enableMultiAZ,
        port: 6379,
        subnetGroupName: redisSubnetGroup.name,
        securityGroupIds: [args.securityGroup.id],
        parameterGroupName: redisParameterGroup.name,
        atRestEncryptionEnabled: args.enableEncryption,
        transitEncryptionEnabled: args.enableEncryption,
        authToken: args.enableEncryption ? redisPassword.result : undefined,
        snapshotRetentionLimit: args.enableBackup ? 5 : 0,
        snapshotWindow: '03:00-05:00',
        maintenanceWindow: 'sun:05:00-sun:07:00',
        autoMinorVersionUpgrade: true,
        logDeliveryConfigurations: [
          {
            destinationType: 'cloudwatch-logs',
            logFormat: 'json',
            logType: 'slow-log'
          },
          {
            destinationType: 'cloudwatch-logs',
            logFormat: 'json',
            logType: 'engine-log'
          }
        ],
        tags: {
          ...defaultTags,
          Name: `${name}-redis`
        }
      }, { parent: this });

      this.connectionString = pulumi.interpolate`postgresql://${this.database.username}:${dbPassword.result}@${this.database.endpoint}/${this.database.dbName}`;
      
      this.resourceCount = pulumi.output(
        1 + // Main database
        (args.environment === 'production' ? 2 : 0) + // Read replicas
        1 + // Redis cluster
        6 + // Supporting resources (subnet groups, parameter groups, etc.)
        (args.enableEncryption ? 2 : 0) + // KMS key and alias
        (args.enablePerformanceInsights ? 1 : 0) // Monitoring role
      );

    } else if (args.provider.constructor.name.includes('Gcp')) {
      // GCP Cloud SQL Implementation
      this.database = new gcp.sql.DatabaseInstance(`${name}-db`, {
        databaseVersion: `POSTGRES_14`,
        region: args.provider.region,
        settings: {
          tier: args.instanceClass,
          diskSize: args.allocatedStorage,
          diskType: 'PD_SSD',
          diskAutoresize: true,
          backupConfiguration: {
            enabled: args.enableBackup,
            startTime: '03:00',
            pointInTimeRecoveryEnabled: args.enableBackup,
            transactionLogRetentionDays: 7,
            backupRetentionSettings: {
              retainedBackups: args.backupRetentionPeriod,
              retentionUnit: 'COUNT'
            }
          },
          ipConfiguration: {
            ipv4Enabled: false,
            privateNetwork: args.vpc.id,
            requireSsl: true
          },
          databaseFlags: [
            { name: 'log_statement', value: 'all' },
            { name: 'log_duration', value: 'on' }
          ],
          userLabels: defaultTags
        }
      }, { parent: this });

      // Create database
      new gcp.sql.Database(`${name}-database`, {
        name: 'saasidp',
        instance: this.database.name
      }, { parent: this });

      // Create user
      new gcp.sql.User(`${name}-user`, {
        name: 'saasidpadmin',
        instance: this.database.name,
        password: dbPassword.result
      }, { parent: this });

      // Create Redis instance
      this.redis = new gcp.redis.Instance(`${name}-redis`, {
        displayName: `${name}-redis`,
        tier: args.environment === 'production' ? 'STANDARD_HA' : 'BASIC',
        memorySizeGb: args.environment === 'production' ? 5 : 1,
        region: args.provider.region,
        redisVersion: 'REDIS_6_X',
        authEnabled: true,
        transitEncryptionMode: 'SERVER_AUTHENTICATION',
        labels: defaultTags
      }, { parent: this });

      this.connectionString = pulumi.interpolate`postgresql://saasidpadmin:${dbPassword.result}@${this.database.privateIpAddress}/saasidp`;
      this.resourceCount = pulumi.output(4); // Instance, database, user, redis

    } else if (args.provider.constructor.name.includes('Azure')) {
      // Azure SQL Implementation
      const resourceGroup = new azure.resources.ResourceGroup(`${name}-rg`, {
        location: args.provider.location,
        tags: defaultTags
      }, { parent: this });

      const sqlServer = new azure.sql.Server(`${name}-server`, {
        resourceGroupName: resourceGroup.name,
        location: resourceGroup.location,
        administratorLogin: 'saasidpadmin',
        administratorLoginPassword: dbPassword.result,
        version: '12.0',
        minimalTlsVersion: '1.2',
        publicNetworkAccess: 'Disabled',
        tags: defaultTags
      }, { parent: this });

      this.database = new azure.sql.Database(`${name}-db`, {
        resourceGroupName: resourceGroup.name,
        serverName: sqlServer.name,
        location: resourceGroup.location,
        sku: {
          name: args.instanceClass,
          tier: args.environment === 'production' ? 'Premium' : 'Standard'
        },
        maxSizeBytes: args.allocatedStorage * 1024 * 1024 * 1024,
        zoneRedundant: args.enableMultiAZ,
        tags: defaultTags
      }, { parent: this });

      // Create Redis cache
      this.redis = new azure.cache.Redis(`${name}-redis`, {
        resourceGroupName: resourceGroup.name,
        location: resourceGroup.location,
        sku: {
          name: args.environment === 'production' ? 'Premium' : 'Basic',
          family: args.environment === 'production' ? 'P' : 'C',
          capacity: args.environment === 'production' ? 1 : 0
        },
        enableNonSslPort: false,
        minimumTlsVersion: '1.2',
        redisConfiguration: {
          maxmemoryPolicy: 'allkeys-lru'
        },
        tags: defaultTags
      }, { parent: this });

      this.connectionString = pulumi.interpolate`Server=tcp:${sqlServer.name}.database.windows.net,1433;Database=${this.database.name};User ID=saasidpadmin;Password=${dbPassword.result};Encrypt=true;Connection Timeout=30;`;
      this.resourceCount = pulumi.output(4); // Resource group, server, database, redis
    }

    this.registerOutputs({
      database: this.database,
      redis: this.redis,
      connectionString: this.connectionString,
      resourceCount: this.resourceCount
    });
  }
}