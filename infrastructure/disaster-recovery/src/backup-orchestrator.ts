/**
 * Comprehensive Backup Orchestrator
 * Handles multi-tier storage, scheduling, and backup lifecycle management
 */

import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { KubernetesApi } from '@kubernetes/client-node';
import { PostgresBackupManager } from './postgres-backup-manager';
import { RedisBackupManager } from './redis-backup-manager';
import { PluginBackupManager } from './plugin-backup-manager';
import { StorageTierManager } from './storage-tier-manager';
import { BackupValidator } from './backup-validator';
import { MetricsCollector } from './metrics-collector';
import { AlertManager } from './alert-manager';
import { Logger } from './logger';

interface BackupConfiguration {
  storage: {
    tiers: Record<string, StorageTier>;
    replication: ReplicationConfig;
  };
  strategies: Record<string, BackupStrategy>;
  plugins: PluginBackupConfig;
  rpo_targets: Record<string, RPOTarget>;
  validation: ValidationConfig;
  monitoring: MonitoringConfig;
}

interface StorageTier {
  type: string;
  path?: string;
  bucket?: string;
  region?: string;
  retention: string;
  encryption: string;
  compression: string;
  access_pattern: string;
  cost_tier: string;
  lifecycle_transition?: string;
}

interface BackupStrategy {
  schedule: string;
  retention: string;
  compression: string;
  encryption: boolean;
  parallel_jobs: number;
  timeout: string;
  priority: string;
  base_backup?: string;
}

interface BackupJob {
  id: string;
  type: 'full' | 'incremental' | 'differential';
  strategy: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  start_time?: Date;
  end_time?: Date;
  size_bytes?: number;
  checksum?: string;
  error_message?: string;
  storage_tier: string;
  metadata: Record<string, any>;
}

interface BackupMetrics {
  total_backups: number;
  successful_backups: number;
  failed_backups: number;
  average_duration: number;
  total_storage_used: number;
  rpo_violations: number;
  last_backup_time: Date;
}

export class BackupOrchestrator extends EventEmitter {
  private config: BackupConfiguration;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private runningJobs: Map<string, BackupJob> = new Map();
  private jobHistory: BackupJob[] = [];
  private metrics: BackupMetrics;
  
  private s3Client: S3Client;
  private kubernetesApi: KubernetesApi;
  private postgresBackupManager: PostgresBackupManager;
  private redisBackupManager: RedisBackupManager;
  private pluginBackupManager: PluginBackupManager;
  private storageTierManager: StorageTierManager;
  private backupValidator: BackupValidator;
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;
  private logger: Logger;

  constructor(configPath: string) {
    super();
    this.logger = new Logger('BackupOrchestrator');
    this.loadConfiguration(configPath);
    this.initializeServices();
    this.initializeMetrics();
  }

  private loadConfiguration(configPath: string): void {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      this.config = yaml.load(configContent) as BackupConfiguration;
      this.logger.info('Backup configuration loaded successfully', { configPath });
    } catch (error) {
      this.logger.error('Failed to load backup configuration', { error, configPath });
      throw error;
    }
  }

  private initializeServices(): void {
    // Initialize AWS S3 client
    this.s3Client = new S3Client({
      region: this.config.storage.replication.regions.primary
    });

    // Initialize Kubernetes API
    this.kubernetesApi = new KubernetesApi();

    // Initialize backup managers
    this.postgresBackupManager = new PostgresBackupManager(this.config, this.logger);
    this.redisBackupManager = new RedisBackupManager(this.config, this.logger);
    this.pluginBackupManager = new PluginBackupManager(this.config, this.logger);
    
    // Initialize support services
    this.storageTierManager = new StorageTierManager(this.config.storage, this.s3Client, this.logger);
    this.backupValidator = new BackupValidator(this.config.validation, this.logger);
    this.metricsCollector = new MetricsCollector(this.logger);
    this.alertManager = new AlertManager(this.config.monitoring.alerts, this.logger);
  }

  private initializeMetrics(): void {
    this.metrics = {
      total_backups: 0,
      successful_backups: 0,
      failed_backups: 0,
      average_duration: 0,
      total_storage_used: 0,
      rpo_violations: 0,
      last_backup_time: new Date(0)
    };
  }

  public async start(): Promise<void> {
    this.logger.info('Starting backup orchestrator...');

    try {
      // Validate configuration and environment
      await this.validateEnvironment();

      // Schedule backup jobs
      this.scheduleBackupJobs();

      // Start storage tier management
      await this.storageTierManager.start();

      // Start metrics collection
      await this.metricsCollector.start();

      // Start continuous backup for critical services
      await this.startContinuousBackup();

      // Register event handlers
      this.registerEventHandlers();

      this.logger.info('Backup orchestrator started successfully');
    } catch (error) {
      this.logger.error('Failed to start backup orchestrator', { error });
      throw error;
    }
  }

  public async stop(): Promise<void> {
    this.logger.info('Stopping backup orchestrator...');

    // Stop all scheduled jobs
    this.scheduledJobs.forEach((task, name) => {
      task.stop();
      this.logger.debug('Stopped scheduled job', { name });
    });
    this.scheduledJobs.clear();

    // Wait for running jobs to complete (with timeout)
    await this.waitForRunningJobs(300000); // 5 minutes timeout

    // Stop services
    await this.storageTierManager.stop();
    await this.metricsCollector.stop();

    this.logger.info('Backup orchestrator stopped successfully');
  }

  private async validateEnvironment(): Promise<void> {
    this.logger.info('Validating backup environment...');

    // Validate AWS credentials and S3 access
    try {
      await this.s3Client.send(new ListObjectsV2Command({
        Bucket: Object.values(this.config.storage.tiers)
          .find(tier => tier.type.includes('s3'))?.bucket,
        MaxKeys: 1
      }));
    } catch (error) {
      throw new Error(`Failed to access S3: ${error.message}`);
    }

    // Validate PostgreSQL connectivity
    await this.postgresBackupManager.validateConnection();

    // Validate Redis connectivity
    await this.redisBackupManager.validateConnection();

    // Validate Kubernetes access
    await this.kubernetesApi.validateConnection();

    // Validate storage paths
    for (const [tierName, tier] of Object.entries(this.config.storage.tiers)) {
      if (tier.path) {
        await fs.ensureDir(tier.path);
        this.logger.debug('Validated storage path', { tierName, path: tier.path });
      }
    }

    this.logger.info('Environment validation completed successfully');
  }

  private scheduleBackupJobs(): void {
    this.logger.info('Scheduling backup jobs...');

    Object.entries(this.config.strategies).forEach(([strategyName, strategy]) => {
      if (strategy.schedule) {
        const task = cron.schedule(strategy.schedule, async () => {
          await this.executeBackupStrategy(strategyName, strategy);
        }, {
          scheduled: false,
          name: strategyName
        });

        this.scheduledJobs.set(strategyName, task);
        task.start();

        this.logger.info('Scheduled backup job', {
          strategy: strategyName,
          schedule: strategy.schedule,
          priority: strategy.priority
        });
      }
    });
  }

  private async executeBackupStrategy(strategyName: string, strategy: BackupStrategy): Promise<void> {
    const jobId = this.generateJobId(strategyName);
    const job: BackupJob = {
      id: jobId,
      type: this.getBackupType(strategyName),
      strategy: strategyName,
      status: 'pending',
      storage_tier: this.selectStorageTier(strategy.priority),
      metadata: {
        strategy: strategyName,
        timeout: strategy.timeout,
        parallel_jobs: strategy.parallel_jobs
      }
    };

    this.runningJobs.set(jobId, job);
    this.emit('job_started', job);

    try {
      this.logger.info('Starting backup job', { jobId, strategy: strategyName });
      job.status = 'running';
      job.start_time = new Date();

      // Execute backup based on type
      let backupResult: BackupResult;
      
      switch (job.type) {
        case 'full':
          backupResult = await this.executeFullBackup(job, strategy);
          break;
        case 'incremental':
          backupResult = await this.executeIncrementalBackup(job, strategy);
          break;
        case 'differential':
          backupResult = await this.executeDifferentialBackup(job, strategy);
          break;
        default:
          throw new Error(`Unknown backup type: ${job.type}`);
      }

      // Validate backup
      const validationResult = await this.backupValidator.validate(backupResult);
      if (!validationResult.valid) {
        throw new Error(`Backup validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Move to appropriate storage tier
      await this.storageTierManager.storeBackup(backupResult, job.storage_tier);

      // Update job status
      job.status = 'completed';
      job.end_time = new Date();
      job.size_bytes = backupResult.size;
      job.checksum = backupResult.checksum;

      this.updateMetrics(job, true);
      this.emit('job_completed', job);
      
      this.logger.info('Backup job completed successfully', {
        jobId,
        duration: job.end_time.getTime() - job.start_time.getTime(),
        size: job.size_bytes
      });

    } catch (error) {
      job.status = 'failed';
      job.end_time = new Date();
      job.error_message = error.message;

      this.updateMetrics(job, false);
      this.emit('job_failed', job);

      this.logger.error('Backup job failed', { jobId, error: error.message });
      
      // Send alert for failed backup
      await this.alertManager.sendAlert('backup_failed', {
        jobId,
        strategy: strategyName,
        error: error.message
      });
    } finally {
      this.runningJobs.delete(jobId);
      this.jobHistory.push(job);
      
      // Cleanup old job history (keep last 1000)
      if (this.jobHistory.length > 1000) {
        this.jobHistory = this.jobHistory.slice(-1000);
      }
    }
  }

  private async executeFullBackup(job: BackupJob, strategy: BackupStrategy): Promise<BackupResult> {
    this.logger.info('Executing full backup', { jobId: job.id });

    const results: BackupResult[] = [];
    
    // Execute parallel backup jobs
    const promises = [
      this.postgresBackupManager.performFullBackup(job.id, strategy),
      this.redisBackupManager.performFullBackup(job.id, strategy),
      this.pluginBackupManager.performFullBackup(job.id, strategy)
    ];

    const backupResults = await Promise.all(promises);
    results.push(...backupResults);

    // Combine results
    return this.combineBackupResults(results, 'full');
  }

  private async executeIncrementalBackup(job: BackupJob, strategy: BackupStrategy): Promise<BackupResult> {
    this.logger.info('Executing incremental backup', { jobId: job.id });

    // Find base backup
    const baseBackup = await this.findBaseBackup(strategy.base_backup || 'latest_full');
    if (!baseBackup) {
      throw new Error('No base backup found for incremental backup');
    }

    const results: BackupResult[] = [];
    
    // Execute incremental backup jobs
    const promises = [
      this.postgresBackupManager.performIncrementalBackup(job.id, strategy, baseBackup),
      this.redisBackupManager.performIncrementalBackup(job.id, strategy, baseBackup),
      this.pluginBackupManager.performIncrementalBackup(job.id, strategy, baseBackup)
    ];

    const backupResults = await Promise.all(promises);
    results.push(...backupResults);

    return this.combineBackupResults(results, 'incremental');
  }

  private async executeDifferentialBackup(job: BackupJob, strategy: BackupStrategy): Promise<BackupResult> {
    this.logger.info('Executing differential backup', { jobId: job.id });

    // Find base backup
    const baseBackup = await this.findBaseBackup(strategy.base_backup || 'latest_full');
    if (!baseBackup) {
      throw new Error('No base backup found for differential backup');
    }

    const results: BackupResult[] = [];
    
    // Execute differential backup jobs
    const promises = [
      this.postgresBackupManager.performDifferentialBackup(job.id, strategy, baseBackup),
      this.redisBackupManager.performDifferentialBackup(job.id, strategy, baseBackup),
      this.pluginBackupManager.performDifferentialBackup(job.id, strategy, baseBackup)
    ];

    const backupResults = await Promise.all(promises);
    results.push(...backupResults);

    return this.combineBackupResults(results, 'differential');
  }

  private async startContinuousBackup(): Promise<void> {
    if (this.config.strategies.continuous_backup?.enabled) {
      this.logger.info('Starting continuous backup...');
      
      // Start PostgreSQL WAL shipping
      await this.postgresBackupManager.startContinuousBackup();
      
      // Start Redis AOF shipping
      await this.redisBackupManager.startContinuousBackup();
      
      // Start plugin state streaming
      await this.pluginBackupManager.startContinuousBackup();
    }
  }

  private registerEventHandlers(): void {
    // Handle storage tier transitions
    this.storageTierManager.on('tier_transition', (event) => {
      this.logger.info('Storage tier transition', event);
    });

    // Handle backup validation events
    this.backupValidator.on('validation_failed', async (event) => {
      this.logger.error('Backup validation failed', event);
      await this.alertManager.sendAlert('backup_validation_failed', event);
    });

    // Handle RPO violations
    this.on('rpo_violation', async (event) => {
      this.logger.error('RPO violation detected', event);
      await this.alertManager.sendAlert('rpo_exceeded', event);
    });

    // Handle metrics events
    this.metricsCollector.on('metrics_collected', (metrics) => {
      this.checkRPOCompliance(metrics);
    });
  }

  private checkRPOCompliance(metrics: any): void {
    Object.entries(this.config.rpo_targets).forEach(([tier, target]) => {
      const lastBackup = this.findLastBackupForTier(tier);
      if (lastBackup) {
        const timeSinceLastBackup = Date.now() - lastBackup.end_time.getTime();
        const rpoThreshold = this.parseTimeString(target.rpo);
        
        if (timeSinceLastBackup > rpoThreshold) {
          this.metrics.rpo_violations++;
          this.emit('rpo_violation', {
            tier,
            target_rpo: target.rpo,
            actual_rpo: timeSinceLastBackup,
            last_backup: lastBackup
          });
        }
      }
    });
  }

  private generateJobId(strategyName: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${strategyName}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getBackupType(strategyName: string): 'full' | 'incremental' | 'differential' {
    if (strategyName.includes('full')) return 'full';
    if (strategyName.includes('incremental')) return 'incremental';
    if (strategyName.includes('differential')) return 'differential';
    return 'full'; // default
  }

  private selectStorageTier(priority: string): string {
    switch (priority) {
      case 'critical':
      case 'high':
        return 'hot';
      case 'medium':
        return 'warm';
      case 'low':
        return 'cold';
      default:
        return 'warm';
    }
  }

  private async findBaseBackup(baseBackupRef: string): Promise<BackupJob | null> {
    if (baseBackupRef === 'latest_full') {
      return this.jobHistory
        .filter(job => job.type === 'full' && job.status === 'completed')
        .sort((a, b) => b.end_time.getTime() - a.end_time.getTime())[0] || null;
    }
    
    return this.jobHistory.find(job => job.id === baseBackupRef) || null;
  }

  private combineBackupResults(results: BackupResult[], type: string): BackupResult {
    const totalSize = results.reduce((sum, result) => sum + result.size, 0);
    const paths = results.flatMap(result => result.paths);
    
    return {
      type,
      paths,
      size: totalSize,
      checksum: this.calculateCombinedChecksum(results),
      timestamp: new Date(),
      metadata: {
        component_count: results.length,
        components: results.map(r => r.metadata)
      }
    };
  }

  private calculateCombinedChecksum(results: BackupResult[]): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    
    results.forEach(result => {
      hash.update(result.checksum);
    });
    
    return hash.digest('hex');
  }

  private findLastBackupForTier(tier: string): BackupJob | null {
    const tierPlugins = this.config.rpo_targets[tier]?.plugins || [];
    
    return this.jobHistory
      .filter(job => job.status === 'completed' && 
                    tierPlugins.some(plugin => job.metadata.plugins?.includes(plugin)))
      .sort((a, b) => b.end_time.getTime() - a.end_time.getTime())[0] || null;
  }

  private parseTimeString(timeStr: string): number {
    const units = { min: 60000, h: 3600000, d: 86400000 };
    const match = timeStr.match(/^(\d+)(min|h|d)$/);
    
    if (!match) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }
    
    const value = parseInt(match[1]);
    const unit = match[2] as keyof typeof units;
    
    return value * units[unit];
  }

  private updateMetrics(job: BackupJob, success: boolean): void {
    this.metrics.total_backups++;
    
    if (success) {
      this.metrics.successful_backups++;
      this.metrics.last_backup_time = job.end_time || new Date();
      
      if (job.start_time && job.end_time) {
        const duration = job.end_time.getTime() - job.start_time.getTime();
        this.metrics.average_duration = 
          (this.metrics.average_duration * (this.metrics.successful_backups - 1) + duration) / 
          this.metrics.successful_backups;
      }
      
      if (job.size_bytes) {
        this.metrics.total_storage_used += job.size_bytes;
      }
    } else {
      this.metrics.failed_backups++;
    }
  }

  private async waitForRunningJobs(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (this.runningJobs.size > 0 && (Date.now() - startTime) < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (this.runningJobs.size > 0) {
      this.logger.warn('Timeout waiting for running jobs to complete', {
        remaining_jobs: this.runningJobs.size
      });
    }
  }

  // Public API methods
  public getStatus(): any {
    return {
      status: 'running',
      scheduled_jobs: Array.from(this.scheduledJobs.keys()),
      running_jobs: Array.from(this.runningJobs.values()),
      metrics: this.metrics,
      last_updated: new Date()
    };
  }

  public getJobHistory(limit: number = 100): BackupJob[] {
    return this.jobHistory
      .sort((a, b) => (b.start_time?.getTime() || 0) - (a.start_time?.getTime() || 0))
      .slice(0, limit);
  }

  public async triggerBackup(strategy: string): Promise<string> {
    const strategyConfig = this.config.strategies[strategy];
    if (!strategyConfig) {
      throw new Error(`Unknown backup strategy: ${strategy}`);
    }

    // Execute backup immediately
    setImmediate(() => this.executeBackupStrategy(strategy, strategyConfig));
    
    return `Backup triggered for strategy: ${strategy}`;
  }

  public async getBackupDetails(jobId: string): Promise<BackupJob | null> {
    return this.jobHistory.find(job => job.id === jobId) || 
           this.runningJobs.get(jobId) || null;
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

interface PluginBackupConfig {
  configurations: any;
  data: any;
  artifacts: any;
  state: any;
}

interface RPOTarget {
  plugins: string[];
  rpo: string;
  backup_frequency: string;
}

interface ValidationConfig {
  integrity_checks: any;
  restore_testing: any;
  consistency_checks: any;
}

interface MonitoringConfig {
  metrics: any;
  alerts: any;
}

interface ReplicationConfig {
  enabled: boolean;
  regions: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  sync_mode: string;
  consistency: string;
}