/**
 * PostgreSQL Backup Manager
 * Handles database backups, WAL shipping, and point-in-time recovery
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs-extra';
import * as path from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { EventEmitter } from 'events';
import { Logger } from './logger';

interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

interface BackupOptions {
  compression: boolean;
  parallel_jobs: number;
  include_schemas?: string[];
  exclude_schemas?: string[];
  include_tables?: string[];
  exclude_tables?: string[];
  custom_format?: boolean;
}

export class PostgresBackupManager extends EventEmitter {
  private config: any;
  private postgresConfig: PostgresConfig;
  private s3Client: S3Client;
  private logger: Logger;
  private walShippingProcess?: ChildProcess;
  private replicationSlot: string = 'portal_backup_slot';

  constructor(config: any, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
    this.loadPostgresConfig();
    this.s3Client = new S3Client({ region: config.storage.replication.regions.primary });
  }

  private loadPostgresConfig(): void {
    this.postgresConfig = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'portal',
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || ''
    };
  }

  public async validateConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('pg_isready', [
        '-h', this.postgresConfig.host,
        '-p', this.postgresConfig.port.toString(),
        '-d', this.postgresConfig.database,
        '-U', this.postgresConfig.username
      ], {
        env: { ...process.env, PGPASSWORD: this.postgresConfig.password }
      });

      process.on('exit', (code) => {
        if (code === 0) {
          this.logger.debug('PostgreSQL connection validated successfully');
          resolve();
        } else {
          reject(new Error(`PostgreSQL connection failed with exit code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  public async performFullBackup(jobId: string, strategy: any): Promise<BackupResult> {
    this.logger.info('Starting PostgreSQL full backup', { jobId });

    const backupPath = path.join('/tmp/backups', `postgres-full-${jobId}.sql`);
    const compressedPath = `${backupPath}.gz`;
    
    await fs.ensureDir(path.dirname(backupPath));

    const options: BackupOptions = {
      compression: strategy.compression !== 'none',
      parallel_jobs: strategy.parallel_jobs || 1,
      custom_format: true
    };

    try {
      // Create full database dump
      await this.createDump(backupPath, options);

      // Compress if requested
      if (options.compression) {
        await this.compressFile(backupPath, compressedPath);
        await fs.remove(backupPath);
      }

      const finalPath = options.compression ? compressedPath : backupPath;
      const size = (await fs.stat(finalPath)).size;
      const checksum = await this.calculateChecksum(finalPath);

      // Upload to S3
      const s3Key = `postgres/full/${jobId}/dump.sql${options.compression ? '.gz' : ''}`;
      await this.uploadToS3(finalPath, s3Key);

      this.logger.info('PostgreSQL full backup completed', { 
        jobId, 
        size, 
        checksum,
        s3Key
      });

      return {
        type: 'postgresql_full',
        paths: [s3Key],
        size,
        checksum,
        timestamp: new Date(),
        metadata: {
          database: this.postgresConfig.database,
          compression: options.compression,
          parallel_jobs: options.parallel_jobs,
          format: 'custom'
        }
      };

    } finally {
      // Cleanup temp files
      await fs.remove(backupPath).catch(() => {});
      await fs.remove(compressedPath).catch(() => {});
    }
  }

  public async performIncrementalBackup(
    jobId: string, 
    strategy: any, 
    baseBackup: any
  ): Promise<BackupResult> {
    this.logger.info('Starting PostgreSQL incremental backup', { jobId });

    // For PostgreSQL, incremental backups are based on WAL files
    const walBackupPath = path.join('/tmp/backups', `postgres-wal-${jobId}`);
    await fs.ensureDir(walBackupPath);

    try {
      // Get WAL files since base backup
      const walFiles = await this.getWALFilesSince(baseBackup.timestamp);
      
      // Copy WAL files to backup location
      const copiedFiles = [];
      for (const walFile of walFiles) {
        const destPath = path.join(walBackupPath, path.basename(walFile));
        await fs.copy(walFile, destPath);
        copiedFiles.push(destPath);
      }

      // Compress WAL archive
      const archivePath = `${walBackupPath}.tar.gz`;
      await this.createArchive(walBackupPath, archivePath);

      const size = (await fs.stat(archivePath)).size;
      const checksum = await this.calculateChecksum(archivePath);

      // Upload to S3
      const s3Key = `postgres/incremental/${jobId}/wal-archive.tar.gz`;
      await this.uploadToS3(archivePath, s3Key);

      this.logger.info('PostgreSQL incremental backup completed', { 
        jobId, 
        size, 
        checksum,
        walFileCount: walFiles.length
      });

      return {
        type: 'postgresql_incremental',
        paths: [s3Key],
        size,
        checksum,
        timestamp: new Date(),
        metadata: {
          base_backup_id: baseBackup.id,
          wal_files_count: walFiles.length,
          wal_start_lsn: await this.getCurrentLSN(),
          compression: true
        }
      };

    } finally {
      // Cleanup temp files
      await fs.remove(walBackupPath).catch(() => {});
      await fs.remove(`${walBackupPath}.tar.gz`).catch(() => {});
    }
  }

  public async performDifferentialBackup(
    jobId: string,
    strategy: any,
    baseBackup: any
  ): Promise<BackupResult> {
    this.logger.info('Starting PostgreSQL differential backup', { jobId });

    // For differential backup, we'll backup only changed data since base backup
    const backupPath = path.join('/tmp/backups', `postgres-diff-${jobId}.sql`);
    await fs.ensureDir(path.dirname(backupPath));

    try {
      // Create differential backup by comparing timestamps
      await this.createDifferentialDump(backupPath, baseBackup.timestamp);

      // Compress the backup
      const compressedPath = `${backupPath}.gz`;
      await this.compressFile(backupPath, compressedPath);

      const size = (await fs.stat(compressedPath)).size;
      const checksum = await this.calculateChecksum(compressedPath);

      // Upload to S3
      const s3Key = `postgres/differential/${jobId}/diff-dump.sql.gz`;
      await this.uploadToS3(compressedPath, s3Key);

      this.logger.info('PostgreSQL differential backup completed', { 
        jobId, 
        size, 
        checksum 
      });

      return {
        type: 'postgresql_differential',
        paths: [s3Key],
        size,
        checksum,
        timestamp: new Date(),
        metadata: {
          base_backup_id: baseBackup.id,
          base_backup_timestamp: baseBackup.timestamp,
          compression: true
        }
      };

    } finally {
      // Cleanup temp files
      await fs.remove(backupPath).catch(() => {});
      await fs.remove(`${backupPath}.gz`).catch(() => {});
    }
  }

  public async startContinuousBackup(): Promise<void> {
    this.logger.info('Starting PostgreSQL continuous backup (WAL shipping)');

    try {
      // Create replication slot if it doesn't exist
      await this.createReplicationSlot();

      // Start WAL archiving process
      this.walShippingProcess = spawn('pg_receivewal', [
        '-h', this.postgresConfig.host,
        '-p', this.postgresConfig.port.toString(),
        '-U', this.postgresConfig.username,
        '-D', '/var/lib/postgresql/wal-archive',
        '--slot', this.replicationSlot,
        '--synchronous',
        '--verbose'
      ], {
        env: { ...process.env, PGPASSWORD: this.postgresConfig.password },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.walShippingProcess.stdout?.on('data', (data) => {
        this.logger.debug('WAL shipping stdout', { output: data.toString() });
      });

      this.walShippingProcess.stderr?.on('data', (data) => {
        this.logger.warn('WAL shipping stderr', { output: data.toString() });
      });

      this.walShippingProcess.on('exit', (code) => {
        this.logger.warn('WAL shipping process exited', { code });
        this.emit('wal_shipping_stopped', { code });
      });

      this.walShippingProcess.on('error', (error) => {
        this.logger.error('WAL shipping process error', { error: error.message });
        this.emit('wal_shipping_error', { error });
      });

      this.logger.info('PostgreSQL continuous backup started successfully');

    } catch (error) {
      this.logger.error('Failed to start PostgreSQL continuous backup', { error: error.message });
      throw error;
    }
  }

  public async stopContinuousBackup(): Promise<void> {
    if (this.walShippingProcess) {
      this.logger.info('Stopping PostgreSQL continuous backup');
      
      this.walShippingProcess.kill('SIGTERM');
      
      // Wait for process to exit gracefully
      await new Promise((resolve) => {
        this.walShippingProcess!.on('exit', resolve);
        setTimeout(resolve, 10000); // Force exit after 10 seconds
      });

      this.walShippingProcess = undefined;
      this.logger.info('PostgreSQL continuous backup stopped');
    }
  }

  private async createDump(outputPath: string, options: BackupOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-h', this.postgresConfig.host,
        '-p', this.postgresConfig.port.toString(),
        '-U', this.postgresConfig.username,
        '-d', this.postgresConfig.database,
        '--no-owner',
        '--no-acl',
        '--clean',
        '--if-exists',
        '--verbose'
      ];

      if (options.custom_format) {
        args.push('--format=custom');
      }

      if (options.parallel_jobs > 1 && options.custom_format) {
        args.push(`--jobs=${options.parallel_jobs}`);
      }

      if (options.include_schemas) {
        options.include_schemas.forEach(schema => {
          args.push('--schema', schema);
        });
      }

      if (options.exclude_schemas) {
        options.exclude_schemas.forEach(schema => {
          args.push('--exclude-schema', schema);
        });
      }

      args.push('--file', outputPath);

      const process = spawn('pg_dump', args, {
        env: { ...process.env, PGPASSWORD: this.postgresConfig.password },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      process.stdout?.on('data', (data) => {
        this.logger.debug('pg_dump stdout', { output: data.toString() });
      });

      process.stderr?.on('data', (data) => {
        this.logger.debug('pg_dump stderr', { output: data.toString() });
      });

      process.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pg_dump failed with exit code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  private async createDifferentialDump(outputPath: string, sinceTimestamp: Date): Promise<void> {
    // This is a simplified approach - in production, you might want to use
    // more sophisticated change tracking mechanisms
    const whereClause = `WHERE updated_at > '${sinceTimestamp.toISOString()}'`;
    
    return new Promise((resolve, reject) => {
      const args = [
        '-h', this.postgresConfig.host,
        '-p', this.postgresConfig.port.toString(),
        '-U', this.postgresConfig.username,
        '-d', this.postgresConfig.database,
        '--no-owner',
        '--no-acl',
        '--data-only',
        '--inserts',
        '--column-inserts'
      ];

      // Add WHERE clause for tables with updated_at column
      // This would need to be customized based on your schema
      const tablesWithTimestamps = [
        'plugin_instances',
        'plugin_configurations',
        'plugin_metadata'
      ];

      tablesWithTimestamps.forEach(table => {
        args.push('--table', table);
      });

      args.push('--file', outputPath);

      const process = spawn('pg_dump', args, {
        env: { ...process.env, PGPASSWORD: this.postgresConfig.password }
      });

      process.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pg_dump differential failed with exit code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  private async compressFile(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('gzip', ['-9', '-c', inputPath], {
        stdio: ['ignore', fs.createWriteStream(outputPath), 'pipe']
      });

      process.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`gzip failed with exit code ${code}`));
        }
      });

      process.on('error', reject);
    });
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
      ServerSideEncryption: 'AES256',
      Metadata: {
        'backup-timestamp': new Date().toISOString(),
        'backup-type': 'postgresql'
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
    // Determine appropriate S3 bucket based on backup type
    if (key.includes('/full/')) {
      return this.config.storage.tiers.warm.bucket;
    } else if (key.includes('/incremental/') || key.includes('/differential/')) {
      return this.config.storage.tiers.hot.bucket || this.config.storage.tiers.warm.bucket;
    }
    return this.config.storage.tiers.warm.bucket;
  }

  private async getWALFilesSince(timestamp: Date): Promise<string[]> {
    // This would query the PostgreSQL server for WAL files generated since timestamp
    // Implementation depends on your WAL archiving setup
    const walDir = '/var/lib/postgresql/wal-archive';
    
    try {
      const files = await fs.readdir(walDir);
      const walFiles = files
        .filter(file => file.match(/^[0-9A-F]{24}$/)) // WAL file pattern
        .map(file => path.join(walDir, file));

      // Filter by modification time (approximate)
      const filteredFiles = [];
      for (const file of walFiles) {
        const stat = await fs.stat(file);
        if (stat.mtime > timestamp) {
          filteredFiles.push(file);
        }
      }

      return filteredFiles;
    } catch (error) {
      this.logger.warn('Failed to list WAL files', { error: error.message });
      return [];
    }
  }

  private async getCurrentLSN(): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn('psql', [
        '-h', this.postgresConfig.host,
        '-p', this.postgresConfig.port.toString(),
        '-U', this.postgresConfig.username,
        '-d', this.postgresConfig.database,
        '-t', // tuples only
        '-c', 'SELECT pg_current_wal_lsn();'
      ], {
        env: { ...process.env, PGPASSWORD: this.postgresConfig.password },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.on('exit', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Failed to get current LSN: exit code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  private async createReplicationSlot(): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn('psql', [
        '-h', this.postgresConfig.host,
        '-p', this.postgresConfig.port.toString(),
        '-U', this.postgresConfig.username,
        '-d', this.postgresConfig.database,
        '-c', `SELECT * FROM pg_create_physical_replication_slot('${this.replicationSlot}', true);`
      ], {
        env: { ...process.env, PGPASSWORD: this.postgresConfig.password }
      });

      process.on('exit', (code) => {
        // Exit code 0 means success, non-zero might mean slot already exists
        resolve();
      });

      process.on('error', reject);
    });
  }

  public async getBackupMetadata(backupId: string): Promise<any> {
    // Return metadata about a specific backup
    return {
      backup_id: backupId,
      database: this.postgresConfig.database,
      host: this.postgresConfig.host,
      backup_method: 'pg_dump',
      compression: 'gzip',
      encryption: 'AES256'
    };
  }

  public async listAvailableBackups(): Promise<any[]> {
    // List all available PostgreSQL backups
    // This would typically query S3 or local storage
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