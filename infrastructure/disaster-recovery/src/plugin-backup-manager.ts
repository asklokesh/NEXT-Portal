/**
 * Plugin Backup Manager
 * Handles plugin-specific backups including configurations, data, artifacts, and state
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { spawn } from 'child_process';
import { KubernetesApi, V1Pod, V1ConfigMap, V1Secret } from '@kubernetes/client-node';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { EventEmitter } from 'events';
import { Logger } from './logger';
import { DockerImageBackup } from './docker-image-backup';
import { HelmChartBackup } from './helm-chart-backup';

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  type: 'frontend' | 'backend' | 'fullstack';
  namespace: string;
  resources: {
    deployments: string[];
    services: string[];
    configMaps: string[];
    secrets: string[];
    persistentVolumeClaims: string[];
  };
  dependencies: string[];
  configuration: any;
  state: any;
}

export class PluginBackupManager extends EventEmitter {
  private config: any;
  private kubernetesApi: KubernetesApi;
  private s3Client: S3Client;
  private logger: Logger;
  private dockerImageBackup: DockerImageBackup;
  private helmChartBackup: HelmChartBackup;
  private pluginRegistry: Map<string, PluginManifest> = new Map();

  constructor(config: any, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.kubernetesApi = new KubernetesApi();
    this.s3Client = new S3Client({ region: config.storage.replication.regions.primary });
    this.dockerImageBackup = new DockerImageBackup(config, logger);
    this.helmChartBackup = new HelmChartBackup(config, logger);
    this.initializePluginRegistry();
  }

  private async initializePluginRegistry(): Promise<void> {
    try {
      // Discover and register all plugins
      await this.discoverPlugins();
      this.logger.info('Plugin registry initialized', { 
        pluginCount: this.pluginRegistry.size 
      });
    } catch (error) {
      this.logger.error('Failed to initialize plugin registry', { error: error.message });
    }
  }

  private async discoverPlugins(): Promise<void> {
    // Discover plugins from multiple sources
    await Promise.all([
      this.discoverKubernetesPlugins(),
      this.discoverFileSystemPlugins(),
      this.discoverRegistryPlugins()
    ]);
  }

  private async discoverKubernetesPlugins(): Promise<void> {
    try {
      // Discover plugins deployed in Kubernetes
      const namespaces = ['developer-portal', 'plugin-system'];
      
      for (const namespace of namespaces) {
        const deployments = await this.kubernetesApi.apps.v1.listNamespacedDeployment(namespace);
        
        for (const deployment of deployments.body.items) {
          const labels = deployment.metadata?.labels || {};
          
          if (labels['app.kubernetes.io/component'] === 'plugin') {
            const pluginManifest = await this.createPluginManifest(deployment, namespace);
            this.pluginRegistry.set(pluginManifest.id, pluginManifest);
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to discover Kubernetes plugins', { error: error.message });
    }
  }

  private async discoverFileSystemPlugins(): Promise<void> {
    const pluginDirs = [
      '/app/plugins',
      '/usr/local/share/backstage/plugins',
      this.config.plugins?.base_directory || '/plugins'
    ];

    for (const pluginDir of pluginDirs) {
      if (await fs.pathExists(pluginDir)) {
        const pluginFolders = await fs.readdir(pluginDir);
        
        for (const folder of pluginFolders) {
          const pluginPath = path.join(pluginDir, folder);
          const manifestPath = path.join(pluginPath, 'plugin-manifest.yaml');
          
          if (await fs.pathExists(manifestPath)) {
            try {
              const manifest = yaml.load(await fs.readFile(manifestPath, 'utf8')) as PluginManifest;
              this.pluginRegistry.set(manifest.id, manifest);
            } catch (error) {
              this.logger.warn('Failed to load plugin manifest', { 
                pluginPath, 
                error: error.message 
              });
            }
          }
        }
      }
    }
  }

  private async discoverRegistryPlugins(): Promise<void> {
    // Discover plugins from internal plugin registry
    try {
      const registryEndpoint = this.config.plugins?.registry_endpoint;
      if (registryEndpoint) {
        // Implementation would fetch from plugin registry API
        this.logger.debug('Plugin registry discovery not implemented yet');
      }
    } catch (error) {
      this.logger.warn('Failed to discover registry plugins', { error: error.message });
    }
  }

  public async performFullBackup(jobId: string, strategy: any): Promise<BackupResult> {
    this.logger.info('Starting plugin ecosystem full backup', { jobId });

    const backupPath = path.join('/tmp/backups', `plugins-full-${jobId}`);
    await fs.ensureDir(backupPath);

    try {
      const backupResults: any[] = [];
      let totalSize = 0;

      // Backup plugin configurations
      const configBackup = await this.backupPluginConfigurations(backupPath, jobId);
      backupResults.push(configBackup);
      totalSize += configBackup.size;

      // Backup plugin data
      const dataBackup = await this.backupPluginData(backupPath, jobId);
      backupResults.push(dataBackup);
      totalSize += dataBackup.size;

      // Backup plugin artifacts (Docker images, Helm charts)
      const artifactBackup = await this.backupPluginArtifacts(backupPath, jobId);
      backupResults.push(artifactBackup);
      totalSize += artifactBackup.size;

      // Backup plugin state (Kubernetes resources)
      const stateBackup = await this.backupPluginState(backupPath, jobId);
      backupResults.push(stateBackup);
      totalSize += stateBackup.size;

      // Create backup metadata
      const metadata = {
        timestamp: new Date().toISOString(),
        plugin_count: this.pluginRegistry.size,
        plugins: Array.from(this.pluginRegistry.keys()),
        backup_components: backupResults.map(r => r.component),
        total_plugins: this.pluginRegistry.size
      };

      const metadataPath = path.join(backupPath, 'metadata.json');
      await fs.writeJSON(metadataPath, metadata, { spaces: 2 });

      // Create compressed archive
      const archivePath = `${backupPath}.tar.gz`;
      await this.createArchive(backupPath, archivePath);

      const archiveSize = (await fs.stat(archivePath)).size;
      const checksum = await this.calculateChecksum(archivePath);

      // Upload to S3
      const s3Key = `plugins/full/${jobId}/plugins-backup.tar.gz`;
      await this.uploadToS3(archivePath, s3Key);

      this.logger.info('Plugin ecosystem full backup completed', {
        jobId,
        size: archiveSize,
        checksum,
        pluginCount: this.pluginRegistry.size
      });

      return {
        type: 'plugins_full',
        paths: [s3Key],
        size: archiveSize,
        checksum,
        timestamp: new Date(),
        metadata: {
          ...metadata,
          original_size: totalSize,
          compression_ratio: totalSize / archiveSize,
          components: backupResults
        }
      };

    } finally {
      // Cleanup temp files
      await fs.remove(backupPath).catch(() => {});
      await fs.remove(`${backupPath}.tar.gz`).catch(() => {});
    }
  }

  public async performIncrementalBackup(
    jobId: string,
    strategy: any,
    baseBackup: any
  ): Promise<BackupResult> {
    this.logger.info('Starting plugin ecosystem incremental backup', { jobId });

    const backupPath = path.join('/tmp/backups', `plugins-incremental-${jobId}`);
    await fs.ensureDir(backupPath);

    try {
      const changes = await this.getPluginChangesSince(baseBackup.timestamp);
      const backupResults: any[] = [];

      // Only backup changed plugins
      for (const change of changes) {
        const pluginBackup = await this.backupChangedPlugin(change, backupPath, jobId);
        backupResults.push(pluginBackup);
      }

      const metadata = {
        base_backup_id: baseBackup.id,
        base_backup_timestamp: baseBackup.timestamp,
        timestamp: new Date().toISOString(),
        changes_count: changes.length,
        changed_plugins: changes.map(c => c.pluginId)
      };

      const metadataPath = path.join(backupPath, 'metadata.json');
      await fs.writeJSON(metadataPath, metadata, { spaces: 2 });

      // Create compressed archive
      const archivePath = `${backupPath}.tar.gz`;
      await this.createArchive(backupPath, archivePath);

      const size = (await fs.stat(archivePath)).size;
      const checksum = await this.calculateChecksum(archivePath);

      // Upload to S3
      const s3Key = `plugins/incremental/${jobId}/plugins-incremental.tar.gz`;
      await this.uploadToS3(archivePath, s3Key);

      this.logger.info('Plugin ecosystem incremental backup completed', {
        jobId,
        size,
        checksum,
        changesCount: changes.length
      });

      return {
        type: 'plugins_incremental',
        paths: [s3Key],
        size,
        checksum,
        timestamp: new Date(),
        metadata: {
          ...metadata,
          components: backupResults
        }
      };

    } finally {
      // Cleanup temp files
      await fs.remove(backupPath).catch(() => {});
      await fs.remove(`${backupPath}.tar.gz`).catch(() => {});
    }
  }

  public async performDifferentialBackup(
    jobId: string,
    strategy: any,
    baseBackup: any
  ): Promise<BackupResult> {
    this.logger.info('Starting plugin ecosystem differential backup', { jobId });
    
    // For plugins, differential backup is similar to incremental
    return this.performIncrementalBackup(jobId, strategy, baseBackup);
  }

  public async startContinuousBackup(): Promise<void> {
    this.logger.info('Starting plugin ecosystem continuous backup');

    try {
      // Start watching for plugin configuration changes
      this.startConfigurationWatch();

      // Start watching for Kubernetes resource changes
      this.startKubernetesWatch();

      // Start watching for Docker image changes
      this.startImageRegistryWatch();

      this.logger.info('Plugin ecosystem continuous backup started successfully');

    } catch (error) {
      this.logger.error('Failed to start plugin ecosystem continuous backup', { 
        error: error.message 
      });
      throw error;
    }
  }

  private async backupPluginConfigurations(backupPath: string, jobId: string): Promise<any> {
    this.logger.debug('Backing up plugin configurations', { jobId });

    const configPath = path.join(backupPath, 'configurations');
    await fs.ensureDir(configPath);

    let totalSize = 0;
    const configFiles: string[] = [];

    for (const [pluginId, manifest] of this.pluginRegistry) {
      const pluginConfigPath = path.join(configPath, pluginId);
      await fs.ensureDir(pluginConfigPath);

      // Backup plugin manifest
      const manifestPath = path.join(pluginConfigPath, 'manifest.yaml');
      await fs.writeFile(manifestPath, yaml.dump(manifest));
      configFiles.push(manifestPath);

      // Backup plugin configuration
      if (manifest.configuration) {
        const configFilePath = path.join(pluginConfigPath, 'config.yaml');
        await fs.writeFile(configFilePath, yaml.dump(manifest.configuration));
        configFiles.push(configFilePath);
      }

      // Backup Kubernetes ConfigMaps
      for (const configMapName of manifest.resources.configMaps) {
        try {
          const configMap = await this.kubernetesApi.core.v1.readNamespacedConfigMap(
            configMapName,
            manifest.namespace
          );
          
          const configMapPath = path.join(pluginConfigPath, `configmap-${configMapName}.yaml`);
          await fs.writeFile(configMapPath, yaml.dump(configMap.body));
          configFiles.push(configMapPath);
        } catch (error) {
          this.logger.warn('Failed to backup ConfigMap', { 
            pluginId, 
            configMapName, 
            error: error.message 
          });
        }
      }

      // Calculate size
      const stats = await Promise.all(
        configFiles.map(file => fs.stat(file).catch(() => ({ size: 0 })))
      );
      totalSize += stats.reduce((sum, stat) => sum + stat.size, 0);
    }

    return {
      component: 'configurations',
      size: totalSize,
      files_count: configFiles.length,
      plugins_count: this.pluginRegistry.size
    };
  }

  private async backupPluginData(backupPath: string, jobId: string): Promise<any> {
    this.logger.debug('Backing up plugin data', { jobId });

    const dataPath = path.join(backupPath, 'data');
    await fs.ensureDir(dataPath);

    let totalSize = 0;
    const dataFiles: string[] = [];

    for (const [pluginId, manifest] of this.pluginRegistry) {
      const pluginDataPath = path.join(dataPath, pluginId);
      await fs.ensureDir(pluginDataPath);

      // Backup persistent volume data
      for (const pvcName of manifest.resources.persistentVolumeClaims) {
        try {
          const pvcDataPath = await this.backupPVCData(pvcName, manifest.namespace, pluginDataPath);
          if (pvcDataPath) {
            dataFiles.push(pvcDataPath);
            const size = (await fs.stat(pvcDataPath)).size;
            totalSize += size;
          }
        } catch (error) {
          this.logger.warn('Failed to backup PVC data', { 
            pluginId, 
            pvcName, 
            error: error.message 
          });
        }
      }

      // Backup plugin-specific database tables if configured
      if (manifest.configuration?.database?.tables) {
        const dbBackupPath = await this.backupPluginDatabaseTables(
          manifest.configuration.database.tables,
          pluginDataPath,
          pluginId
        );
        if (dbBackupPath) {
          dataFiles.push(dbBackupPath);
          const size = (await fs.stat(dbBackupPath)).size;
          totalSize += size;
        }
      }
    }

    return {
      component: 'data',
      size: totalSize,
      files_count: dataFiles.length,
      pvcs_backed_up: dataFiles.filter(f => f.includes('pvc-')).length
    };
  }

  private async backupPluginArtifacts(backupPath: string, jobId: string): Promise<any> {
    this.logger.debug('Backing up plugin artifacts', { jobId });

    const artifactsPath = path.join(backupPath, 'artifacts');
    await fs.ensureDir(artifactsPath);

    let totalSize = 0;

    // Backup Docker images
    const dockerBackupResult = await this.dockerImageBackup.backupImages(
      Array.from(this.pluginRegistry.keys()),
      path.join(artifactsPath, 'docker-images'),
      jobId
    );
    totalSize += dockerBackupResult.size;

    // Backup Helm charts
    const helmBackupResult = await this.helmChartBackup.backupCharts(
      Array.from(this.pluginRegistry.keys()),
      path.join(artifactsPath, 'helm-charts'),
      jobId
    );
    totalSize += helmBackupResult.size;

    return {
      component: 'artifacts',
      size: totalSize,
      docker_images: dockerBackupResult.images_count,
      helm_charts: helmBackupResult.charts_count
    };
  }

  private async backupPluginState(backupPath: string, jobId: string): Promise<any> {
    this.logger.debug('Backing up plugin state', { jobId });

    const statePath = path.join(backupPath, 'state');
    await fs.ensureDir(statePath);

    let totalSize = 0;
    const stateFiles: string[] = [];

    for (const [pluginId, manifest] of this.pluginRegistry) {
      const pluginStatePath = path.join(statePath, pluginId);
      await fs.ensureDir(pluginStatePath);

      // Backup Kubernetes resources
      const resourceTypes = [
        { resource: 'deployments', api: this.kubernetesApi.apps.v1.readNamespacedDeployment },
        { resource: 'services', api: this.kubernetesApi.core.v1.readNamespacedService },
        { resource: 'secrets', api: this.kubernetesApi.core.v1.readNamespacedSecret }
      ];

      for (const resourceType of resourceTypes) {
        const resourceList = manifest.resources[resourceType.resource] || [];
        
        for (const resourceName of resourceList) {
          try {
            const resource = await resourceType.api.call(
              resourceType.api,
              resourceName,
              manifest.namespace
            );
            
            const resourcePath = path.join(
              pluginStatePath,
              `${resourceType.resource}-${resourceName}.yaml`
            );
            await fs.writeFile(resourcePath, yaml.dump(resource.body));
            stateFiles.push(resourcePath);
            
            const size = (await fs.stat(resourcePath)).size;
            totalSize += size;
          } catch (error) {
            this.logger.warn('Failed to backup Kubernetes resource', {
              pluginId,
              resourceType: resourceType.resource,
              resourceName,
              error: error.message
            });
          }
        }
      }
    }

    return {
      component: 'state',
      size: totalSize,
      files_count: stateFiles.length,
      resources_backed_up: stateFiles.length
    };
  }

  private async createPluginManifest(deployment: any, namespace: string): Promise<PluginManifest> {
    const labels = deployment.metadata?.labels || {};
    const annotations = deployment.metadata?.annotations || {};

    return {
      id: labels['app.kubernetes.io/name'] || deployment.metadata.name,
      name: labels['app.kubernetes.io/name'] || deployment.metadata.name,
      version: labels['app.kubernetes.io/version'] || '1.0.0',
      type: labels['plugin.portal.dev/type'] || 'fullstack',
      namespace,
      resources: {
        deployments: [deployment.metadata.name],
        services: [], // Would be discovered
        configMaps: [], // Would be discovered
        secrets: [], // Would be discovered
        persistentVolumeClaims: [] // Would be discovered
      },
      dependencies: JSON.parse(annotations['plugin.portal.dev/dependencies'] || '[]'),
      configuration: JSON.parse(annotations['plugin.portal.dev/config'] || '{}'),
      state: {
        replicas: deployment.spec?.replicas || 1,
        status: deployment.status?.phase || 'Unknown'
      }
    };
  }

  private async getPluginChangesSince(timestamp: Date): Promise<any[]> {
    const changes: any[] = [];

    // Check for plugin configuration changes
    for (const [pluginId, manifest] of this.pluginRegistry) {
      // This would check various sources for changes since timestamp:
      // - Git commits
      // - Kubernetes resource modifications
      // - Configuration changes
      // - File system modifications
      
      // Simplified implementation
      const lastModified = await this.getPluginLastModified(pluginId);
      if (lastModified > timestamp) {
        changes.push({
          pluginId,
          type: 'configuration_change',
          timestamp: lastModified,
          manifest
        });
      }
    }

    return changes;
  }

  private async getPluginLastModified(pluginId: string): Promise<Date> {
    // Return the last modification time of the plugin
    // This would check multiple sources (filesystem, k8s resources, etc.)
    return new Date();
  }

  private async backupChangedPlugin(change: any, backupPath: string, jobId: string): Promise<any> {
    const pluginBackupPath = path.join(backupPath, change.pluginId);
    await fs.ensureDir(pluginBackupPath);

    // Backup only the changed components of the plugin
    const manifest = change.manifest;
    
    // Backup updated configuration
    const configPath = path.join(pluginBackupPath, 'config.yaml');
    await fs.writeFile(configPath, yaml.dump(manifest.configuration));

    // Backup updated Kubernetes resources
    // ... implementation details

    return {
      plugin_id: change.pluginId,
      change_type: change.type,
      backup_path: pluginBackupPath,
      size: (await this.getDirectorySize(pluginBackupPath))
    };
  }

  private async backupPVCData(pvcName: string, namespace: string, outputPath: string): Promise<string | null> {
    try {
      // Create a backup pod to access PVC data
      const backupPodManifest = {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
          name: `backup-${pvcName}-${Date.now()}`,
          namespace
        },
        spec: {
          containers: [{
            name: 'backup-container',
            image: 'alpine:latest',
            command: ['sh', '-c', 'tar czf /backup/data.tar.gz -C /data . && sleep 3600'],
            volumeMounts: [
              {
                name: 'data',
                mountPath: '/data'
              },
              {
                name: 'backup',
                mountPath: '/backup'
              }
            ]
          }],
          volumes: [
            {
              name: 'data',
              persistentVolumeClaim: {
                claimName: pvcName
              }
            },
            {
              name: 'backup',
              hostPath: {
                path: outputPath
              }
            }
          ],
          restartPolicy: 'Never'
        }
      };

      // Create and wait for backup pod
      await this.kubernetesApi.core.v1.createNamespacedPod(namespace, backupPodManifest);
      
      // Wait for backup to complete (simplified)
      await new Promise(resolve => setTimeout(resolve, 60000));
      
      // Cleanup pod
      await this.kubernetesApi.core.v1.deleteNamespacedPod(
        backupPodManifest.metadata.name,
        namespace
      );

      const backupFilePath = path.join(outputPath, 'data.tar.gz');
      return backupFilePath;

    } catch (error) {
      this.logger.error('Failed to backup PVC data', { 
        pvcName, 
        namespace, 
        error: error.message 
      });
      return null;
    }
  }

  private async backupPluginDatabaseTables(
    tables: string[],
    outputPath: string,
    pluginId: string
  ): Promise<string | null> {
    try {
      const backupFilePath = path.join(outputPath, `db-${pluginId}.sql`);
      
      // Use pg_dump to backup specific tables
      const tablesArg = tables.map(table => `--table=${table}`).join(' ');
      
      await new Promise((resolve, reject) => {
        const process = spawn('pg_dump', [
          '-h', process.env.POSTGRES_HOST || 'localhost',
          '-U', process.env.POSTGRES_USER || 'postgres',
          '-d', process.env.POSTGRES_DB || 'portal',
          '--data-only',
          '--inserts',
          ...tablesArg.split(' '),
          '--file', backupFilePath
        ], {
          env: { ...process.env, PGPASSWORD: process.env.POSTGRES_PASSWORD }
        });

        process.on('exit', (code) => {
          if (code === 0) resolve(undefined);
          else reject(new Error(`pg_dump failed with code ${code}`));
        });

        process.on('error', reject);
      });

      return backupFilePath;

    } catch (error) {
      this.logger.error('Failed to backup plugin database tables', { 
        pluginId, 
        tables, 
        error: error.message 
      });
      return null;
    }
  }

  private startConfigurationWatch(): void {
    // Watch for configuration file changes
    // Implementation would use fs.watch or chokidar
  }

  private startKubernetesWatch(): void {
    // Watch for Kubernetes resource changes
    // Implementation would use Kubernetes watch API
  }

  private startImageRegistryWatch(): void {
    // Watch for Docker image changes in registry
    // Implementation would poll registry API
  }

  private async createArchive(inputDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('tar', [
        '-czf', outputPath,
        '-C', path.dirname(inputDir),
        path.basename(inputDir)
      ]);

      process.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`tar failed with exit code ${code}`));
      });

      process.on('error', reject);
    });
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn('sha256sum', [filePath]);

      let stdout = '';
      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.on('exit', (code) => {
        if (code === 0) {
          resolve(stdout.split(' ')[0]);
        } else {
          reject(new Error(`sha256sum failed with exit code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  private async uploadToS3(filePath: string, key: string): Promise<void> {
    const fileStream = fs.createReadStream(filePath);
    const uploadParams = {
      Bucket: this.getBucketForKey(key),
      Key: key,
      Body: fileStream,
      ServerSideEncryption: 'AES256' as const,
      Metadata: {
        'backup-timestamp': new Date().toISOString(),
        'backup-type': 'plugins'
      }
    };

    try {
      await this.s3Client.send(new PutObjectCommand(uploadParams));
      this.logger.debug('File uploaded to S3 successfully', { key });
    } catch (error) {
      this.logger.error('Failed to upload file to S3', { key, error: error.message });
      throw error;
    }
  }

  private getBucketForKey(key: string): string {
    return this.config.storage.tiers.warm.bucket;
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      
      if (item.isDirectory()) {
        totalSize += await this.getDirectorySize(itemPath);
      } else {
        const stats = await fs.stat(itemPath);
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  }

  public async getPluginRegistry(): Promise<Map<string, PluginManifest>> {
    return this.pluginRegistry;
  }

  public async refreshPluginRegistry(): Promise<void> {
    this.pluginRegistry.clear();
    await this.discoverPlugins();
  }
}

interface BackupResult {
  type: string;
  paths: string[];
  size: number;
  checksum: string;
  timestamp: Date;
  metadata: any;
}