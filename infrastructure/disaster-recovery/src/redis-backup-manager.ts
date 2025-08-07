/**
 * Redis Backup Manager
 * Handles Redis data backups, AOF shipping, and state recovery
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as Redis from 'ioredis';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { EventEmitter } from 'events';
import { Logger } from './logger';

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  cluster?: boolean;
  sentinel?: {
    hosts: Array<{ host: string; port: number }>;
    name: string;
  };
}

export class RedisBackupManager extends EventEmitter {
  private config: any;
  private redisConfig: RedisConfig;
  private redisClient: Redis;
  private s3Client: S3Client;
  private logger: Logger;
  private aofShippingProcess?: ChildProcess;
  private aofShippingInterval?: NodeJS.Timer;

  constructor(config: any, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.loadRedisConfig();
    this.initializeRedisClient();
    this.s3Client = new S3Client({ region: config.storage.replication.regions.primary });
  }

  private loadRedisConfig(): void {
    this.redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      cluster: process.env.REDIS_CLUSTER === 'true'
    };

    if (process.env.REDIS_SENTINEL_HOSTS) {
      this.redisConfig.sentinel = {
        hosts: JSON.parse(process.env.REDIS_SENTINEL_HOSTS),
        name: process.env.REDIS_SENTINEL_NAME || 'mymaster'
      };
    }
  }

  private initializeRedisClient(): void {
    if (this.redisConfig.cluster) {
      // Redis Cluster configuration
      this.redisClient = new Redis.Cluster([
        { host: this.redisConfig.host, port: this.redisConfig.port }
      ], {
        redisOptions: {
          password: this.redisConfig.password
        }
      });
    } else if (this.redisConfig.sentinel) {
      // Redis Sentinel configuration
      this.redisClient = new Redis({
        sentinels: this.redisConfig.sentinel.hosts,
        name: this.redisConfig.sentinel.name,
        password: this.redisConfig.password,
        db: this.redisConfig.db
      });
    } else {
      // Standalone Redis
      this.redisClient = new Redis({
        host: this.redisConfig.host,
        port: this.redisConfig.port,
        password: this.redisConfig.password,
        db: this.redisConfig.db
      });
    }

    this.redisClient.on('error', (error) => {
      this.logger.error('Redis client error', { error: error.message });
    });

    this.redisClient.on('connect', () => {
      this.logger.debug('Redis client connected');
    });
  }

  public async validateConnection(): Promise<void> {
    try {
      await this.redisClient.ping();
      this.logger.debug('Redis connection validated successfully');
    } catch (error) {
      this.logger.error('Redis connection validation failed', { error: error.message });
      throw new Error(`Redis connection failed: ${error.message}`);
    }
  }

  public async performFullBackup(jobId: string, strategy: any): Promise<BackupResult> {
    this.logger.info('Starting Redis full backup', { jobId });

    const backupPath = path.join('/tmp/backups', `redis-full-${jobId}`);
    await fs.ensureDir(backupPath);

    try {
      let totalSize = 0;
      const backupFiles: string[] = [];

      if (this.redisConfig.cluster) {
        // Backup each cluster node
        const nodes = await this.getClusterNodes();
        for (const node of nodes) {
          const nodeBackup = await this.backupClusterNode(node, backupPath, jobId);
          backupFiles.push(nodeBackup.path);
          totalSize += nodeBackup.size;
        }
      } else {
        // Backup single Redis instance
        const instanceBackup = await this.backupRedisInstance(backupPath, jobId);
        backupFiles.push(instanceBackup.path);
        totalSize = instanceBackup.size;
      }

      // Create backup metadata
      const metadata = {
        timestamp: new Date().toISOString(),
        redis_version: await this.getRedisVersion(),
        config: await this.getRedisConfig(),
        memory_usage: await this.getMemoryUsage(),
        key_count: await this.getKeyCount(),
        cluster: this.redisConfig.cluster
      };

      const metadataPath = path.join(backupPath, 'metadata.json');
      await fs.writeJSON(metadataPath, metadata, { spaces: 2 });
      backupFiles.push(metadataPath);

      // Create compressed archive
      const archivePath = `${backupPath}.tar.gz`;
      await this.createArchive(backupPath, archivePath);

      const archiveSize = (await fs.stat(archivePath)).size;
      const checksum = await this.calculateChecksum(archivePath);

      // Upload to S3
      const s3Key = `redis/full/${jobId}/redis-backup.tar.gz`;
      await this.uploadToS3(archivePath, s3Key);

      this.logger.info('Redis full backup completed', {
        jobId,
        size: archiveSize,
        checksum,
        filesCount: backupFiles.length
      });

      return {
        type: 'redis_full',
        paths: [s3Key],
        size: archiveSize,
        checksum,
        timestamp: new Date(),
        metadata: {
          ...metadata,
          backup_files: backupFiles.length,
          original_size: totalSize,
          compression_ratio: totalSize / archiveSize
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
    this.logger.info('Starting Redis incremental backup', { jobId });

    const backupPath = path.join('/tmp/backups', `redis-incremental-${jobId}`);
    await fs.ensureDir(backupPath);

    try {
      // For Redis, incremental backup involves capturing changes since base backup
      // This can be done using Redis commands or AOF log analysis
      
      const incrementalData = await this.getIncrementalData(baseBackup.timestamp);
      const incrementalPath = path.join(backupPath, 'incremental-data.json');
      
      await fs.writeJSON(incrementalPath, incrementalData, { spaces: 2 });

      // Get AOF changes since last backup
      const aofChanges = await this.getAOFChangesSince(baseBackup.timestamp);
      if (aofChanges.length > 0) {
        const aofPath = path.join(backupPath, 'aof-changes.aof');
        await fs.writeFile(aofPath, aofChanges.join('\n'));
      }

      // Create metadata
      const metadata = {
        base_backup_id: baseBackup.id,
        base_backup_timestamp: baseBackup.timestamp,
        timestamp: new Date().toISOString(),
        changes_count: incrementalData.changes?.length || 0,
        aof_changes_count: aofChanges.length
      };

      const metadataPath = path.join(backupPath, 'metadata.json');
      await fs.writeJSON(metadataPath, metadata, { spaces: 2 });

      // Create compressed archive
      const archivePath = `${backupPath}.tar.gz`;
      await this.createArchive(backupPath, archivePath);

      const size = (await fs.stat(archivePath)).size;
      const checksum = await this.calculateChecksum(archivePath);

      // Upload to S3
      const s3Key = `redis/incremental/${jobId}/redis-incremental.tar.gz`;
      await this.uploadToS3(archivePath, s3Key);

      this.logger.info('Redis incremental backup completed', {
        jobId,
        size,
        checksum,
        changesCount: metadata.changes_count
      });

      return {
        type: 'redis_incremental',
        paths: [s3Key],
        size,
        checksum,
        timestamp: new Date(),
        metadata
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
    this.logger.info('Starting Redis differential backup', { jobId });

    // For Redis, differential backup is similar to incremental
    // but includes all changes since the last full backup
    return this.performIncrementalBackup(jobId, strategy, baseBackup);
  }

  public async startContinuousBackup(): Promise<void> {
    this.logger.info('Starting Redis continuous backup (AOF monitoring)');

    try {
      // Enable AOF if not already enabled
      await this.enableAOF();

      // Start AOF file monitoring and shipping
      this.startAOFShipping();

      // Start periodic AOF rewrite to manage file size
      this.scheduleAOFRewrite();

      this.logger.info('Redis continuous backup started successfully');

    } catch (error) {
      this.logger.error('Failed to start Redis continuous backup', { error: error.message });
      throw error;
    }
  }

  public async stopContinuousBackup(): Promise<void> {
    if (this.aofShippingInterval) {
      clearInterval(this.aofShippingInterval);
      this.aofShippingInterval = undefined;
    }

    if (this.aofShippingProcess) {
      this.aofShippingProcess.kill('SIGTERM');
      this.aofShippingProcess = undefined;
    }

    this.logger.info('Redis continuous backup stopped');
  }

  private async backupRedisInstance(backupPath: string, jobId: string): Promise<{ path: string; size: number }> {
    // Trigger BGSAVE for RDB snapshot
    await this.redisClient.bgsave();

    // Wait for BGSAVE to complete
    await this.waitForBGSave();

    // Copy RDB file to backup location
    const rdbPath = await this.getRDBPath();
    const backupRDBPath = path.join(backupPath, 'dump.rdb');
    
    await fs.copy(rdbPath, backupRDBPath);

    // Also backup current AOF if it exists
    const aofPath = await this.getAOFPath();
    if (await fs.pathExists(aofPath)) {
      const backupAOFPath = path.join(backupPath, 'appendonly.aof');
      await fs.copy(aofPath, backupAOFPath);
    }

    const size = (await fs.stat(backupRDBPath)).size;
    return { path: backupRDBPath, size };
  }

  private async backupClusterNode(
    node: { host: string; port: number },
    backupPath: string,
    jobId: string
  ): Promise<{ path: string; size: number }> {
    const nodeClient = new Redis({
      host: node.host,
      port: node.port,
      password: this.redisConfig.password
    });

    try {
      // Trigger BGSAVE on specific node
      await nodeClient.bgsave();

      // Wait for completion
      let lastSave = await nodeClient.lastsave();
      const startTime = Date.now();
      
      while (true) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const currentSave = await nodeClient.lastsave();
        
        if (currentSave !== lastSave) break;
        
        if (Date.now() - startTime > 300000) { // 5 minute timeout
          throw new Error('BGSAVE timeout');
        }
      }

      // For cluster nodes, we would need to implement node-specific backup logic
      // This is a simplified version
      const nodeBackupPath = path.join(backupPath, `node-${node.host}-${node.port}.rdb`);
      
      // In a real implementation, you would need to access the RDB file from the node
      // This might require SSH access or shared storage
      
      return { path: nodeBackupPath, size: 0 };

    } finally {
      nodeClient.disconnect();
    }
  }

  private async getClusterNodes(): Promise<Array<{ host: string; port: number }>> {
    if (!this.redisConfig.cluster) return [];

    try {
      const clusterNodes = await this.redisClient.cluster('nodes');
      return this.parseClusterNodes(clusterNodes);
    } catch (error) {
      this.logger.warn('Failed to get cluster nodes', { error: error.message });
      return [{ host: this.redisConfig.host, port: this.redisConfig.port }];
    }
  }

  private parseClusterNodes(nodesInfo: string): Array<{ host: string; port: number }> {
    const nodes = [];
    const lines = nodesInfo.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const parts = line.split(' ');
      if (parts.length >= 2) {
        const [, address] = parts;
        const [host, port] = address.split(':');
        if (host && port) {
          nodes.push({ host, port: parseInt(port) });
        }
      }
    }

    return nodes;
  }

  private async waitForBGSave(): Promise<void> {
    let lastSave = await this.redisClient.lastsave();
    const startTime = Date.now();

    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const currentSave = await this.redisClient.lastsave();
      
      if (currentSave !== lastSave) break;
      
      if (Date.now() - startTime > 300000) { // 5 minute timeout
        throw new Error('BGSAVE timeout');
      }
    }
  }

  private async getRDBPath(): Promise<string> {
    const config = await this.redisClient.config('get', 'dir');
    const dbfilename = await this.redisClient.config('get', 'dbfilename');
    
    const dir = Array.isArray(config) ? config[1] : '/var/lib/redis';
    const filename = Array.isArray(dbfilename) ? dbfilename[1] : 'dump.rdb';
    
    return path.join(dir, filename);
  }

  private async getAOFPath(): Promise<string> {
    const config = await this.redisClient.config('get', 'dir');
    const aofFilename = await this.redisClient.config('get', 'appendfilename');
    
    const dir = Array.isArray(config) ? config[1] : '/var/lib/redis';
    const filename = Array.isArray(aofFilename) ? aofFilename[1] : 'appendonly.aof';
    
    return path.join(dir, filename);
  }

  private async enableAOF(): Promise<void> {
    try {
      await this.redisClient.config('set', 'appendonly', 'yes');
      this.logger.debug('AOF enabled for Redis continuous backup');
    } catch (error) {
      this.logger.warn('Failed to enable AOF', { error: error.message });
    }
  }

  private startAOFShipping(): void {
    // Monitor AOF file and ship changes to backup storage
    this.aofShippingInterval = setInterval(async () => {
      try {
        await this.shipAOFChanges();
      } catch (error) {
        this.logger.error('AOF shipping failed', { error: error.message });
        this.emit('aof_shipping_error', { error });
      }
    }, 60000); // Every minute
  }

  private async shipAOFChanges(): Promise<void> {
    const aofPath = await this.getAOFPath();
    
    if (await fs.pathExists(aofPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupKey = `redis/aof/aof-${timestamp}.aof`;
      
      // Copy current AOF to backup location
      await this.uploadToS3(aofPath, backupKey);
      
      this.logger.debug('AOF changes shipped', { backupKey });
    }
  }

  private scheduleAOFRewrite(): void {
    // Schedule periodic AOF rewrite to manage file size
    setInterval(async () => {
      try {
        await this.redisClient.bgrewriteaof();
        this.logger.debug('AOF rewrite initiated');
      } catch (error) {
        this.logger.warn('AOF rewrite failed', { error: error.message });
      }
    }, 3600000); // Every hour
  }

  private async getIncrementalData(sinceTimestamp: Date): Promise<any> {
    // This would implement logic to capture changes since timestamp
    // For Redis, this could involve:
    // 1. Analyzing AOF logs
    // 2. Using Redis modules for change capture
    // 3. Implementing custom change tracking
    
    return {
      changes: [],
      timestamp: new Date().toISOString(),
      since: sinceTimestamp.toISOString()
    };
  }

  private async getAOFChangesSince(timestamp: Date): Promise<string[]> {
    // Parse AOF file and extract commands since timestamp
    // This is a simplified implementation
    const aofPath = await this.getAOFPath();
    
    if (!(await fs.pathExists(aofPath))) {
      return [];
    }

    // In a real implementation, you would parse the AOF file
    // and extract commands based on timestamp
    return [];
  }

  private async getRedisVersion(): Promise<string> {
    const info = await this.redisClient.info('server');
    const versionMatch = info.match(/redis_version:([^\r\n]+)/);
    return versionMatch ? versionMatch[1] : 'unknown';
  }

  private async getRedisConfig(): Promise<any> {
    const config = await this.redisClient.config('get', '*');
    const configObj: any = {};
    
    for (let i = 0; i < config.length; i += 2) {
      configObj[config[i]] = config[i + 1];
    }
    
    return configObj;
  }

  private async getMemoryUsage(): Promise<number> {
    const info = await this.redisClient.info('memory');
    const memoryMatch = info.match(/used_memory:(\d+)/);
    return memoryMatch ? parseInt(memoryMatch[1]) : 0;
  }

  private async getKeyCount(): Promise<number> {
    const info = await this.redisClient.info('keyspace');
    const keyMatch = info.match(/keys=(\d+)/);
    return keyMatch ? parseInt(keyMatch[1]) : 0;
  }

  private async createArchive(inputDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('tar', [
        '-czf', outputPath,
        '-C', path.dirname(inputDir),
        path.basename(inputDir)
      ]);

      process.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`tar failed with exit code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn('sha256sum', [filePath], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.on('exit', (code) => {
        if (code === 0) {
          const checksum = stdout.split(' ')[0];
          resolve(checksum);
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
        'backup-type': 'redis'
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
    if (key.includes('/full/')) {
      return this.config.storage.tiers.warm.bucket;
    } else if (key.includes('/incremental/') || key.includes('/aof/')) {
      return this.config.storage.tiers.hot.bucket || this.config.storage.tiers.warm.bucket;
    }
    return this.config.storage.tiers.warm.bucket;
  }

  public async getBackupMetadata(backupId: string): Promise<any> {
    return {
      backup_id: backupId,
      host: this.redisConfig.host,
      port: this.redisConfig.port,
      cluster: this.redisConfig.cluster,
      backup_method: 'rdb_aof',
      compression: 'gzip'
    };
  }

  public async listAvailableBackups(): Promise<any[]> {
    // List all available Redis backups
    return [];
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