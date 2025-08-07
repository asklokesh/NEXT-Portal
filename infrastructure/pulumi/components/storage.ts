import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as gcp from '@pulumi/gcp';
import * as azure from '@pulumi/azure-native';

export interface StorageStackArgs {
  provider: any;
  environment: string;
  enableVersioning: boolean;
  enableEncryption: boolean;
  enableReplication: boolean;
  lifecycleRules?: Array<{
    id: string;
    enabled: boolean;
    transitions?: Array<{
      days: number;
      storageClass: string;
    }>;
  }>;
  corsRules?: Array<{
    allowedHeaders: string[];
    allowedMethods: string[];
    allowedOrigins: string[];
    exposeHeaders: string[];
    maxAgeSeconds: number;
  }>;
}

export class StorageStack extends pulumi.ComponentResource {
  public readonly staticAssetsBucket: any;
  public readonly pluginStorage: any;
  public readonly backupStorage: any;
  public readonly logStorage: any;
  public readonly resourceCount: pulumi.Output<number>;

  constructor(name: string, args: StorageStackArgs, opts?: pulumi.ComponentResourceOptions) {
    super('saas-idp:storage:Stack', name, {}, opts);

    const defaultTags = {
      Environment: args.environment,
      ManagedBy: 'Pulumi',
      Component: 'Storage',
      Project: 'SaaS-IDP'
    };

    if (args.provider.constructor.name.includes('Aws')) {
      // AWS S3 Implementation
      
      // Create KMS key for encryption
      let kmsKey: aws.kms.Key | undefined;
      if (args.enableEncryption) {
        kmsKey = new aws.kms.Key(`${name}-kms-key`, {
          description: `KMS key for ${name} storage encryption`,
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
                Sid: 'Allow S3 to use the key',
                Effect: 'Allow',
                Principal: {
                  Service: 's3.amazonaws.com'
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
      }

      // Static Assets Bucket
      this.staticAssetsBucket = new aws.s3.BucketV2(`${name}-static-assets`, {
        bucketPrefix: `${name}-static-`,
        tags: {
          ...defaultTags,
          Name: `${name}-static-assets`,
          Purpose: 'StaticAssets'
        }
      }, { parent: this });

      new aws.s3.BucketVersioningV2(`${name}-static-versioning`, {
        bucket: this.staticAssetsBucket.id,
        versioningConfiguration: {
          status: args.enableVersioning ? 'Enabled' : 'Disabled'
        }
      }, { parent: this });

      new aws.s3.BucketServerSideEncryptionConfigurationV2(`${name}-static-encryption`, {
        bucket: this.staticAssetsBucket.id,
        rules: [{
          applyServerSideEncryptionByDefault: {
            sseAlgorithm: args.enableEncryption && kmsKey ? 'aws:kms' : 'AES256',
            kmsMasterKeyId: kmsKey?.arn
          },
          bucketKeyEnabled: true
        }]
      }, { parent: this });

      new aws.s3.BucketPublicAccessBlock(`${name}-static-pab`, {
        bucket: this.staticAssetsBucket.id,
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false
      }, { parent: this });

      if (args.corsRules && args.corsRules.length > 0) {
        new aws.s3.BucketCorsConfigurationV2(`${name}-static-cors`, {
          bucket: this.staticAssetsBucket.id,
          corsRules: args.corsRules.map(rule => ({
            allowedHeaders: rule.allowedHeaders,
            allowedMethods: rule.allowedMethods,
            allowedOrigins: rule.allowedOrigins,
            exposeHeaders: rule.exposeHeaders,
            maxAgeSeconds: rule.maxAgeSeconds
          }))
        }, { parent: this });
      }

      // Plugin Storage Bucket
      this.pluginStorage = new aws.s3.BucketV2(`${name}-plugin-storage`, {
        bucketPrefix: `${name}-plugins-`,
        tags: {
          ...defaultTags,
          Name: `${name}-plugin-storage`,
          Purpose: 'PluginStorage'
        }
      }, { parent: this });

      new aws.s3.BucketVersioningV2(`${name}-plugin-versioning`, {
        bucket: this.pluginStorage.id,
        versioningConfiguration: {
          status: 'Enabled' // Always version plugins
        }
      }, { parent: this });

      new aws.s3.BucketServerSideEncryptionConfigurationV2(`${name}-plugin-encryption`, {
        bucket: this.pluginStorage.id,
        rules: [{
          applyServerSideEncryptionByDefault: {
            sseAlgorithm: args.enableEncryption && kmsKey ? 'aws:kms' : 'AES256',
            kmsMasterKeyId: kmsKey?.arn
          },
          bucketKeyEnabled: true
        }]
      }, { parent: this });

      new aws.s3.BucketPublicAccessBlock(`${name}-plugin-pab`, {
        bucket: this.pluginStorage.id,
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true
      }, { parent: this });

      // Backup Storage Bucket
      this.backupStorage = new aws.s3.BucketV2(`${name}-backup-storage`, {
        bucketPrefix: `${name}-backups-`,
        tags: {
          ...defaultTags,
          Name: `${name}-backup-storage`,
          Purpose: 'Backups'
        }
      }, { parent: this });

      new aws.s3.BucketVersioningV2(`${name}-backup-versioning`, {
        bucket: this.backupStorage.id,
        versioningConfiguration: {
          status: 'Enabled'
        }
      }, { parent: this });

      new aws.s3.BucketServerSideEncryptionConfigurationV2(`${name}-backup-encryption`, {
        bucket: this.backupStorage.id,
        rules: [{
          applyServerSideEncryptionByDefault: {
            sseAlgorithm: 'aws:kms',
            kmsMasterKeyId: kmsKey?.arn
          },
          bucketKeyEnabled: true
        }]
      }, { parent: this });

      new aws.s3.BucketPublicAccessBlock(`${name}-backup-pab`, {
        bucket: this.backupStorage.id,
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true
      }, { parent: this });

      // Lifecycle rules for backup bucket
      new aws.s3.BucketLifecycleConfigurationV2(`${name}-backup-lifecycle`, {
        bucket: this.backupStorage.id,
        rules: [
          {
            id: 'transition-old-backups',
            status: 'Enabled',
            transitions: [
              {
                days: 30,
                storageClass: 'STANDARD_IA'
              },
              {
                days: 90,
                storageClass: 'GLACIER'
              },
              {
                days: 365,
                storageClass: 'DEEP_ARCHIVE'
              }
            ],
            expiration: {
              days: 2555 // 7 years
            }
          }
        ]
      }, { parent: this });

      // Enable object lock for compliance
      if (args.environment === 'production') {
        new aws.s3.BucketObjectLockConfigurationV2(`${name}-backup-lock`, {
          bucket: this.backupStorage.id,
          rule: {
            defaultRetention: {
              mode: 'COMPLIANCE',
              days: 30
            }
          }
        }, { parent: this });
      }

      // Log Storage Bucket
      this.logStorage = new aws.s3.BucketV2(`${name}-log-storage`, {
        bucketPrefix: `${name}-logs-`,
        tags: {
          ...defaultTags,
          Name: `${name}-log-storage`,
          Purpose: 'Logs'
        }
      }, { parent: this });

      new aws.s3.BucketVersioningV2(`${name}-log-versioning`, {
        bucket: this.logStorage.id,
        versioningConfiguration: {
          status: 'Enabled'
        }
      }, { parent: this });

      new aws.s3.BucketServerSideEncryptionConfigurationV2(`${name}-log-encryption`, {
        bucket: this.logStorage.id,
        rules: [{
          applyServerSideEncryptionByDefault: {
            sseAlgorithm: 'AES256'
          },
          bucketKeyEnabled: true
        }]
      }, { parent: this });

      new aws.s3.BucketPublicAccessBlock(`${name}-log-pab`, {
        bucket: this.logStorage.id,
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true
      }, { parent: this });

      // Lifecycle rules for log bucket
      new aws.s3.BucketLifecycleConfigurationV2(`${name}-log-lifecycle`, {
        bucket: this.logStorage.id,
        rules: [
          {
            id: 'delete-old-logs',
            status: 'Enabled',
            expiration: {
              days: args.environment === 'production' ? 90 : 30
            }
          }
        ]
      }, { parent: this });

      // Create bucket policies
      const staticBucketPolicy = new aws.s3.BucketPolicy(`${name}-static-policy`, {
        bucket: this.staticAssetsBucket.id,
        policy: pulumi.all([this.staticAssetsBucket.arn]).apply(([arn]) => JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Sid: 'PublicReadGetObject',
              Effect: 'Allow',
              Principal: '*',
              Action: 's3:GetObject',
              Resource: `${arn}/*`
            }
          ]
        }))
      }, { parent: this });

      // Enable replication if requested
      if (args.enableReplication) {
        // Create replication role
        const replicationRole = new aws.iam.Role(`${name}-replication-role`, {
          assumeRolePolicy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Principal: {
                Service: 's3.amazonaws.com'
              },
              Action: 'sts:AssumeRole'
            }]
          }),
          tags: defaultTags
        }, { parent: this });

        const replicationPolicy = new aws.iam.RolePolicy(`${name}-replication-policy`, {
          role: replicationRole.name,
          policy: pulumi.all([
            this.backupStorage.arn,
            this.pluginStorage.arn
          ]).apply(([backupArn, pluginArn]) => JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  's3:GetReplicationConfiguration',
                  's3:ListBucket'
                ],
                Resource: [backupArn, pluginArn]
              },
              {
                Effect: 'Allow',
                Action: [
                  's3:GetObjectVersionForReplication',
                  's3:GetObjectVersionAcl',
                  's3:GetObjectVersionTagging'
                ],
                Resource: [`${backupArn}/*`, `${pluginArn}/*`]
              },
              {
                Effect: 'Allow',
                Action: [
                  's3:ReplicateObject',
                  's3:ReplicateDelete',
                  's3:ReplicateTags'
                ],
                Resource: [`${backupArn}/*`, `${pluginArn}/*`]
              }
            ]
          }))
        }, { parent: this });

        // Create destination bucket for replication
        const replicationDestination = new aws.s3.BucketV2(`${name}-replication-dest`, {
          bucketPrefix: `${name}-replica-`,
          tags: {
            ...defaultTags,
            Name: `${name}-replication-destination`,
            Purpose: 'Replication'
          }
        }, { parent: this });

        new aws.s3.BucketVersioningV2(`${name}-replica-versioning`, {
          bucket: replicationDestination.id,
          versioningConfiguration: {
            status: 'Enabled'
          }
        }, { parent: this });

        // Configure replication
        new aws.s3.BucketReplicationConfiguration(`${name}-backup-replication`, {
          role: replicationRole.arn,
          bucket: this.backupStorage.id,
          rules: [{
            id: 'replicate-all',
            status: 'Enabled',
            priority: 1,
            deleteMarkerReplication: {
              status: 'Enabled'
            },
            filter: {},
            destination: {
              bucket: replicationDestination.arn,
              storageClass: 'STANDARD_IA'
            }
          }]
        }, { parent: this, dependsOn: [replicationDestination] });
      }

      // Apply lifecycle rules if provided
      if (args.lifecycleRules && args.lifecycleRules.length > 0) {
        new aws.s3.BucketLifecycleConfigurationV2(`${name}-static-lifecycle`, {
          bucket: this.staticAssetsBucket.id,
          rules: args.lifecycleRules.map(rule => ({
            id: rule.id,
            status: rule.enabled ? 'Enabled' : 'Disabled',
            transitions: rule.transitions?.map(t => ({
              days: t.days,
              storageClass: t.storageClass
            }))
          }))
        }, { parent: this });
      }

      this.resourceCount = pulumi.output(
        4 + // Main buckets
        4 * 4 + // Configurations per bucket (versioning, encryption, PAB, lifecycle)
        (args.corsRules ? 1 : 0) + // CORS
        (args.enableEncryption ? 1 : 0) + // KMS key
        (args.enableReplication ? 4 : 0) + // Replication resources
        1 // Bucket policy
      );

    } else if (args.provider.constructor.name.includes('Gcp')) {
      // GCP Cloud Storage Implementation
      this.staticAssetsBucket = new gcp.storage.Bucket(`${name}-static-assets`, {
        location: args.provider.region,
        storageClass: 'STANDARD',
        versioning: {
          enabled: args.enableVersioning
        },
        encryption: args.enableEncryption ? {
          defaultKmsKeyName: pulumi.interpolate`projects/${args.provider.project}/locations/${args.provider.region}/keyRings/${name}/cryptoKeys/${name}-key`
        } : undefined,
        cors: args.corsRules?.map(rule => ({
          origins: rule.allowedOrigins,
          methods: rule.allowedMethods,
          responseHeaders: rule.exposeHeaders,
          maxAgeSeconds: rule.maxAgeSeconds
        })),
        lifecycleRules: args.lifecycleRules?.map(rule => ({
          condition: {
            age: rule.transitions?.[0]?.days
          },
          action: {
            type: 'SetStorageClass',
            storageClass: 'NEARLINE'
          }
        })),
        labels: defaultTags,
        project: args.provider.project
      }, { parent: this });

      this.pluginStorage = new gcp.storage.Bucket(`${name}-plugin-storage`, {
        location: args.provider.region,
        storageClass: 'STANDARD',
        versioning: {
          enabled: true
        },
        labels: defaultTags,
        project: args.provider.project
      }, { parent: this });

      this.backupStorage = new gcp.storage.Bucket(`${name}-backup-storage`, {
        location: args.provider.region,
        storageClass: 'NEARLINE',
        versioning: {
          enabled: true
        },
        labels: defaultTags,
        project: args.provider.project
      }, { parent: this });

      this.logStorage = new gcp.storage.Bucket(`${name}-log-storage`, {
        location: args.provider.region,
        storageClass: 'STANDARD',
        lifecycleRules: [{
          condition: {
            age: args.environment === 'production' ? 90 : 30
          },
          action: {
            type: 'Delete'
          }
        }],
        labels: defaultTags,
        project: args.provider.project
      }, { parent: this });

      this.resourceCount = pulumi.output(4); // 4 buckets

    } else if (args.provider.constructor.name.includes('Azure')) {
      // Azure Storage Implementation
      const resourceGroup = new azure.resources.ResourceGroup(`${name}-rg`, {
        location: args.provider.location,
        tags: defaultTags
      }, { parent: this });

      const storageAccount = new azure.storage.StorageAccount(`${name}storage`.replace(/-/g, ''), {
        resourceGroupName: resourceGroup.name,
        location: resourceGroup.location,
        sku: {
          name: args.environment === 'production' ? 'Standard_GRS' : 'Standard_LRS'
        },
        kind: 'StorageV2',
        enableHttpsTrafficOnly: true,
        minimumTlsVersion: 'TLS1_2',
        allowBlobPublicAccess: true,
        tags: defaultTags
      }, { parent: this });

      this.staticAssetsBucket = new azure.storage.BlobContainer(`${name}-static-assets`, {
        accountName: storageAccount.name,
        resourceGroupName: resourceGroup.name,
        publicAccess: 'Blob'
      }, { parent: this });

      this.pluginStorage = new azure.storage.BlobContainer(`${name}-plugin-storage`, {
        accountName: storageAccount.name,
        resourceGroupName: resourceGroup.name,
        publicAccess: 'None'
      }, { parent: this });

      this.backupStorage = new azure.storage.BlobContainer(`${name}-backup-storage`, {
        accountName: storageAccount.name,
        resourceGroupName: resourceGroup.name,
        publicAccess: 'None'
      }, { parent: this });

      this.logStorage = new azure.storage.BlobContainer(`${name}-log-storage`, {
        accountName: storageAccount.name,
        resourceGroupName: resourceGroup.name,
        publicAccess: 'None'
      }, { parent: this });

      this.resourceCount = pulumi.output(6); // RG, Storage Account, 4 containers
    }

    this.registerOutputs({
      staticAssetsBucket: this.staticAssetsBucket,
      pluginStorage: this.pluginStorage,
      backupStorage: this.backupStorage,
      logStorage: this.logStorage,
      resourceCount: this.resourceCount
    });
  }
}