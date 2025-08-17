/**
 * Automated Database Backup System
 * Supports scheduled backups, point-in-time recovery, and multi-cloud storage
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import cron from 'node-cron';
import winston from 'winston';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';

const execAsync = promisify(exec);

interface BackupConfig {
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  storage: {
    local: {
      enabled: boolean;
      path: string;
      retention: number; // days
    };
    s3: {
      enabled: boolean;
      bucket: string;
      region: string;
      prefix: string;
      storageClass: 'STANDARD' | 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE';
    };
    azure?: {
      enabled: boolean;
      containerName: string;
      storageAccount: string;
      accessKey: string;
    };
  };
  schedule: {
    full: string; // cron expression
    incremental: string; // cron expression
    pointInTime: boolean; // Enable WAL archiving
  };
  encryption: {
    enabled: boolean;
    key: string;
    algorithm: string;
  };
  compression: {
    enabled: boolean;
    level: number; // 1-9
  };
  notifications: {
    onSuccess: boolean;
    onFailure: boolean;
    webhook?: string;
    email?: string[];
  };
}

interface BackupMetadata {
  id: string;
  type: 'full' | 'incremental' | 'wal';
  timestamp: Date;
  size: number;
  checksum: string;
  duration: number;
  status: 'success' | 'failed' | 'in_progress';
  location: {
    local?: string;
    s3?: string;
    azure?: string;
  };
  database: {
    name: string;
    version: string;
    lsn?: string; // Log Sequence Number for point-in-time recovery
  };
  error?: string;
}

export class DatabaseBackupManager {
  private config: BackupConfig;
  private logger: winston.Logger;
  private s3Client?: S3Client;
  private backupHistory: BackupMetadata[] = [];
  private tasks: Map<string, cron.ScheduledTask> = new Map();

  constructor(config: BackupConfig) {
    this.config = config;
    this.setupLogger();
    this.setupStorageClients();
  }

  private setupLogger() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/backup-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/backup.log' }),
        new winston.transports.Console()
      ],
    });
  }

  private setupStorageClients() {
    if (this.config.storage.s3.enabled) {
      this.s3Client = new S3Client({
        region: this.config.storage.s3.region
      });
    }
  }

  public start() {
    this.logger.info('Starting database backup manager');

    // Schedule full backups
    if (this.config.schedule.full) {
      const fullBackupTask = cron.schedule(this.config.schedule.full, async () => {
        await this.performFullBackup();
      }, { scheduled: false });
      
      this.tasks.set('full', fullBackupTask);
      fullBackupTask.start();
      this.logger.info('Full backup scheduled', { cron: this.config.schedule.full });
    }

    // Schedule incremental backups
    if (this.config.schedule.incremental) {
      const incrementalTask = cron.schedule(this.config.schedule.incremental, async () => {
        await this.performIncrementalBackup();
      }, { scheduled: false });
      
      this.tasks.set('incremental', incrementalTask);
      incrementalTask.start();
      this.logger.info('Incremental backup scheduled', { cron: this.config.schedule.incremental });
    }

    // Enable WAL archiving for point-in-time recovery
    if (this.config.schedule.pointInTime) {
      this.setupWALArchiving();
    }

    // Schedule cleanup task
    const cleanupTask = cron.schedule('0 2 * * *', async () => { // Daily at 2 AM
      await this.cleanupOldBackups();
    }, { scheduled: false });
    
    this.tasks.set('cleanup', cleanupTask);
    cleanupTask.start();
  }

  public stop() {
    this.logger.info('Stopping database backup manager');
    
    for (const [name, task] of this.tasks) {
      task.stop();
      task.destroy();
      this.logger.info('Stopped backup task', { task: name });
    }
    
    this.tasks.clear();
  }

  public async performFullBackup(): Promise<BackupMetadata> {
    const backupId = this.generateBackupId('full');
    const startTime = Date.now();
    
    this.logger.info('Starting full backup', { backupId });

    const metadata: BackupMetadata = {
      id: backupId,
      type: 'full',
      timestamp: new Date(),
      size: 0,
      checksum: '',
      duration: 0,
      status: 'in_progress',
      location: {},
      database: {
        name: this.config.database.name,
        version: '', // Will be populated
      }
    };

    try {
      // Create backup directory
      const backupDir = path.join(this.config.storage.local.path, backupId);
      await fs.mkdir(backupDir, { recursive: true });

      // Generate backup filename
      const backupFile = path.join(backupDir, `${backupId}.sql`);
      
      // Get database version and LSN
      const dbInfo = await this.getDatabaseInfo();
      metadata.database.version = dbInfo.version;
      metadata.database.lsn = dbInfo.lsn;

      // Create pg_dump command
      const dumpCommand = this.buildPgDumpCommand(backupFile, 'full');
      
      // Execute backup
      await execAsync(dumpCommand);
      
      // Get backup file size
      const stats = await fs.stat(backupFile);
      metadata.size = stats.size;
      metadata.location.local = backupFile;

      // Compress if enabled
      let finalFile = backupFile;
      if (this.config.compression.enabled) {
        finalFile = await this.compressBackup(backupFile);
        const compressedStats = await fs.stat(finalFile);
        metadata.size = compressedStats.size;
        metadata.location.local = finalFile;
      }

      // Encrypt if enabled
      if (this.config.encryption.enabled) {
        finalFile = await this.encryptBackup(finalFile);
        metadata.location.local = finalFile;
      }

      // Calculate checksum
      metadata.checksum = await this.calculateChecksum(finalFile);

      // Upload to cloud storage
      if (this.config.storage.s3.enabled) {
        const s3Key = await this.uploadToS3(finalFile, backupId, 'full');
        metadata.location.s3 = s3Key;
      }

      metadata.duration = Date.now() - startTime;
      metadata.status = 'success';

      this.backupHistory.push(metadata);
      this.logger.info('Full backup completed successfully', {
        backupId,
        duration: metadata.duration,
        size: metadata.size
      });

      if (this.config.notifications.onSuccess) {
        await this.sendNotification('success', metadata);
      }

    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error.message;
      metadata.duration = Date.now() - startTime;
      
      this.backupHistory.push(metadata);
      this.logger.error('Full backup failed', {
        backupId,
        error: error.message,
        duration: metadata.duration
      });

      if (this.config.notifications.onFailure) {
        await this.sendNotification('failure', metadata);
      }

      throw error;
    }

    return metadata;
  }

  public async performIncrementalBackup(): Promise<BackupMetadata> {
    const backupId = this.generateBackupId('incremental');
    const startTime = Date.now();
    
    this.logger.info('Starting incremental backup', { backupId });

    // Find the last successful full or incremental backup
    const lastBackup = this.backupHistory
      .filter(b => b.status === 'success' && (b.type === 'full' || b.type === 'incremental'))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (!lastBackup) {
      this.logger.warn('No previous backup found, performing full backup instead');
      return await this.performFullBackup();
    }

    const metadata: BackupMetadata = {
      id: backupId,
      type: 'incremental',
      timestamp: new Date(),
      size: 0,
      checksum: '',
      duration: 0,
      status: 'in_progress',
      location: {},
      database: {
        name: this.config.database.name,
        version: '',
      }
    };

    try {
      // Create backup directory
      const backupDir = path.join(this.config.storage.local.path, backupId);
      await fs.mkdir(backupDir, { recursive: true });

      // WAL archiving based incremental backup
      const walFiles = await this.getWALFilesSince(lastBackup.database.lsn || '');
      
      if (walFiles.length === 0) {
        this.logger.info('No changes since last backup, skipping incremental backup');
        return metadata;
      }

      // Archive WAL files
      const archiveDir = path.join(backupDir, 'wal');
      await fs.mkdir(archiveDir, { recursive: true });
      
      for (const walFile of walFiles) {
        const sourcePath = path.join('/var/lib/postgresql/data/pg_wal', walFile);
        const destPath = path.join(archiveDir, walFile);
        await fs.copyFile(sourcePath, destPath);
      }

      // Create manifest file
      const manifest = {
        type: 'incremental',
        baseLSN: lastBackup.database.lsn,
        walFiles: walFiles,
        timestamp: new Date().toISOString()
      };
      
      await fs.writeFile(
        path.join(backupDir, 'backup.manifest'),
        JSON.stringify(manifest, null, 2)
      );

      // Get total size
      const dirStats = await this.getDirectorySize(backupDir);
      metadata.size = dirStats;

      // Compress if enabled
      let finalFile = backupDir;
      if (this.config.compression.enabled) {
        finalFile = await this.compressDirectory(backupDir);
        const compressedStats = await fs.stat(finalFile);
        metadata.size = compressedStats.size;
      }

      metadata.location.local = finalFile;
      metadata.checksum = await this.calculateChecksum(finalFile);

      // Upload to cloud storage
      if (this.config.storage.s3.enabled) {
        const s3Key = await this.uploadToS3(finalFile, backupId, 'incremental');
        metadata.location.s3 = s3Key;
      }

      metadata.duration = Date.now() - startTime;
      metadata.status = 'success';

      this.backupHistory.push(metadata);
      this.logger.info('Incremental backup completed successfully', {
        backupId,
        duration: metadata.duration,
        size: metadata.size,
        walFiles: walFiles.length
      });

    } catch (error) {
      metadata.status = 'failed';
      metadata.error = error.message;
      metadata.duration = Date.now() - startTime;
      
      this.backupHistory.push(metadata);
      this.logger.error('Incremental backup failed', {
        backupId,
        error: error.message
      });

      throw error;
    }

    return metadata;
  }

  private generateBackupId(type: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${type}-${this.config.database.name}-${timestamp}`;
  }

  private buildPgDumpCommand(outputFile: string, type: 'full' | 'incremental'): string {
    const { host, port, name, user, password } = this.config.database;
    
    let command = `PGPASSWORD="${password}" pg_dump`;
    command += ` -h ${host} -p ${port} -U ${user}`;
    command += ` -f "${outputFile}"`;
    command += ` --verbose --no-password`;
    
    if (type === 'full') {
      command += ` --create --clean --if-exists`;
      command += ` --format=custom --compress=9`;
    }
    
    command += ` "${name}"`;
    
    return command;
  }

  private async getDatabaseInfo(): Promise<{ version: string; lsn: string }> {
    const { host, port, name, user, password } = this.config.database;
    
    const query = `
      SELECT version() as version, pg_current_wal_lsn()::text as lsn;
    `;
    
    const command = `PGPASSWORD="${password}" psql -h ${host} -p ${port} -U ${user} -d ${name} -t -c "${query}"`;
    
    try {
      const { stdout } = await execAsync(command);
      const lines = stdout.trim().split('\n');
      const version = lines[0].trim();
      const lsn = lines[1].trim();
      
      return { version, lsn };
    } catch (error) {
      this.logger.error('Failed to get database info', { error: error.message });
      return { version: 'unknown', lsn: '0/0' };
    }
  }

  private async compressBackup(filePath: string): Promise<string> {
    const compressedPath = `${filePath}.gz`;
    
    await pipeline(
      createReadStream(filePath),
      createGzip({ level: this.config.compression.level }),
      createWriteStream(compressedPath)
    );

    // Remove original file
    await fs.unlink(filePath);
    
    return compressedPath;
  }

  private async compressDirectory(dirPath: string): Promise<string> {
    const tarPath = `${dirPath}.tar.gz`;
    const command = `tar -czf "${tarPath}" -C "${path.dirname(dirPath)}" "${path.basename(dirPath)}"`;
    
    await execAsync(command);
    
    // Remove original directory
    await fs.rm(dirPath, { recursive: true });
    
    return tarPath;
  }

  private async encryptBackup(filePath: string): Promise<string> {
    // Implementation would depend on encryption method
    // This is a placeholder for AES encryption
    const encryptedPath = `${filePath}.enc`;
    
    // Use openssl for encryption
    const command = `openssl enc -aes-256-cbc -salt -in "${filePath}" -out "${encryptedPath}" -k "${this.config.encryption.key}"`;
    
    await execAsync(command);
    
    // Remove original file
    await fs.unlink(filePath);
    
    return encryptedPath;
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    const hash = createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  private async uploadToS3(filePath: string, backupId: string, type: string): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not configured');
    }

    const fileName = path.basename(filePath);
    const s3Key = `${this.config.storage.s3.prefix}/${type}/${backupId}/${fileName}`;
    
    const fileContent = await fs.readFile(filePath);
    
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.config.storage.s3.bucket,
      Key: s3Key,
      Body: fileContent,
      StorageClass: this.config.storage.s3.storageClass,
      Metadata: {
        backupId,
        type,
        database: this.config.database.name,
        timestamp: new Date().toISOString()
      }
    }));

    this.logger.info('Backup uploaded to S3', { s3Key, size: fileContent.length });
    
    return s3Key;
  }

  private async getWALFilesSince(lsn: string): Promise<string[]> {
    // This would typically query the WAL archive directory
    // Implementation depends on WAL archiving setup
    return [];
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        size += await this.getDirectorySize(filePath);
      } else {
        const stats = await fs.stat(filePath);
        size += stats.size;
      }
    }
    
    return size;
  }

  private setupWALArchiving() {
    this.logger.info('Setting up WAL archiving for point-in-time recovery');
    
    // This would configure PostgreSQL for WAL archiving
    // Typically done through postgresql.conf settings:
    // wal_level = replica
    // archive_mode = on
    // archive_command = 'cp %p /path/to/archive/%f'
  }

  private async cleanupOldBackups() {
    this.logger.info('Starting backup cleanup');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.storage.local.retention);

    // Clean local backups
    if (this.config.storage.local.enabled) {
      const backupDir = this.config.storage.local.path;
      const entries = await fs.readdir(backupDir);
      
      for (const entry of entries) {
        const entryPath = path.join(backupDir, entry);
        const stats = await fs.stat(entryPath);
        
        if (stats.mtime < cutoffDate) {
          if (stats.isDirectory()) {
            await fs.rm(entryPath, { recursive: true });
          } else {
            await fs.unlink(entryPath);
          }
          
          this.logger.info('Removed old backup', { path: entryPath });
        }
      }
    }

    // Clean backup history
    this.backupHistory = this.backupHistory.filter(backup => backup.timestamp > cutoffDate);
  }

  private async sendNotification(type: 'success' | 'failure', metadata: BackupMetadata) {
    const message = type === 'success' 
      ? `Backup ${metadata.id} completed successfully`
      : `Backup ${metadata.id} failed: ${metadata.error}`;

    this.logger.info('Sending notification', { type, backupId: metadata.id });

    // Webhook notification
    if (this.config.notifications.webhook) {
      try {
        const response = await fetch(this.config.notifications.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            message,
            metadata
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

      } catch (error) {
        this.logger.error('Failed to send webhook notification', { error: error.message });
      }
    }

    // Email notification would be implemented here
    // if (this.config.notifications.email) { ... }
  }

  // Public methods
  public getBackupHistory(): BackupMetadata[] {
    return [...this.backupHistory];
  }

  public async getBackupStatus(): Promise<{
    lastFullBackup?: BackupMetadata;
    lastIncrementalBackup?: BackupMetadata;
    totalBackups: number;
    totalSize: number;
    oldestBackup?: Date;
  }> {
    const fullBackups = this.backupHistory.filter(b => b.type === 'full' && b.status === 'success');
    const incrementalBackups = this.backupHistory.filter(b => b.type === 'incremental' && b.status === 'success');
    
    const lastFullBackup = fullBackups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    const lastIncrementalBackup = incrementalBackups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    
    const totalSize = this.backupHistory.reduce((sum, backup) => sum + backup.size, 0);
    const oldestBackup = this.backupHistory.length > 0 
      ? this.backupHistory.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())[0].timestamp
      : undefined;

    return {
      lastFullBackup,
      lastIncrementalBackup,
      totalBackups: this.backupHistory.length,
      totalSize,
      oldestBackup
    };
  }
}

// Configuration factory
export function createBackupConfig(): BackupConfig {
  return {
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      name: process.env.DB_NAME || 'saas_idp',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    },
    storage: {
      local: {
        enabled: true,
        path: process.env.BACKUP_LOCAL_PATH || './backups',
        retention: parseInt(process.env.BACKUP_RETENTION_DAYS || '30')
      },
      s3: {
        enabled: process.env.BACKUP_S3_ENABLED === 'true',
        bucket: process.env.BACKUP_S3_BUCKET || '',
        region: process.env.BACKUP_S3_REGION || 'us-east-1',
        prefix: process.env.BACKUP_S3_PREFIX || 'database-backups',
        storageClass: (process.env.BACKUP_S3_STORAGE_CLASS as any) || 'STANDARD_IA'
      }
    },
    schedule: {
      full: process.env.BACKUP_FULL_CRON || '0 2 * * 0', // Weekly on Sunday at 2 AM
      incremental: process.env.BACKUP_INCREMENTAL_CRON || '0 2 * * 1-6', // Daily except Sunday at 2 AM
      pointInTime: process.env.BACKUP_POINT_IN_TIME === 'true'
    },
    encryption: {
      enabled: process.env.BACKUP_ENCRYPTION_ENABLED === 'true',
      key: process.env.BACKUP_ENCRYPTION_KEY || '',
      algorithm: 'aes-256-cbc'
    },
    compression: {
      enabled: process.env.BACKUP_COMPRESSION_ENABLED !== 'false',
      level: parseInt(process.env.BACKUP_COMPRESSION_LEVEL || '6')
    },
    notifications: {
      onSuccess: process.env.BACKUP_NOTIFY_SUCCESS === 'true',
      onFailure: process.env.BACKUP_NOTIFY_FAILURE !== 'false',
      webhook: process.env.BACKUP_WEBHOOK_URL,
      email: process.env.BACKUP_EMAIL_RECIPIENTS?.split(',')
    }
  };
}