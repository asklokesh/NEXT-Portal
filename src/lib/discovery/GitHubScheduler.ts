import { GitHubScanner, type GitHubConfig, type ScanOptions, type ScanResult } from './GitHubScanner';
import cron from 'node-cron';

export interface ScheduledScanConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule: string; // Cron expression
  githubConfig: GitHubConfig;
  scanOptions: ScanOptions;
  importOptions?: {
    overwriteExisting?: boolean;
    skipValidation?: boolean;
    generateMissing?: boolean;
    defaultOwner?: string;
    defaultLifecycle?: string;
    addTags?: string[];
  };
  notifications?: {
    onSuccess?: string[]; // Webhook URLs or email addresses
    onFailure?: string[]; // Webhook URLs or email addresses
    onPartialSuccess?: string[]; // Webhook URLs or email addresses
  };
  retention?: {
    keepLogs?: number; // Number of log entries to keep
    keepResults?: number; // Number of scan results to keep
  };
  metadata?: Record<string, any>;
}

export interface ScheduledScanExecution {
  id: string;
  configId: string;
  status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  result?: ScanResult;
  importSummary?: {
    imported: number;
    skipped: number;
    errors: number;
  };
  error?: string;
  logs: Array<{
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    details?: any;
  }>;
  nextExecution?: Date;
}

export interface SchedulerStats {
  totalConfigs: number;
  activeConfigs: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  lastExecution?: Date;
  nextExecution?: Date;
  averageDuration: number;
  repositoriesDiscovered: number;
  entitiesImported: number;
}

export class GitHubScheduler {
  private configs: Map<string, ScheduledScanConfig> = new Map();
  private executions: Map<string, ScheduledScanExecution> = new Map();
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private executionHistory: ScheduledScanExecution[] = [];
  private maxHistorySize: number = 1000;

  constructor() {
    // Load existing configurations from storage
    this.loadConfigurations();
  }

  /**
   * Add a new scheduled scan configuration
   */
  async addScheduledScan(config: ScheduledScanConfig): Promise<void> {
    // Validate cron expression
    if (!cron.validate(config.schedule)) {
      throw new Error(`Invalid cron expression: ${config.schedule}`);
    }

    // Store configuration
    this.configs.set(config.id, { ...config });
    
    // Schedule the task if enabled
    if (config.enabled) {
      await this.scheduleTask(config);
    }

    // Persist to storage
    await this.saveConfigurations();

    console.log(`[GitHub Scheduler] Added scheduled scan: ${config.name} (${config.id})`);
  }

  /**
   * Update an existing scheduled scan configuration
   */
  async updateScheduledScan(id: string, updates: Partial<ScheduledScanConfig>): Promise<void> {
    const existing = this.configs.get(id);
    if (!existing) {
      throw new Error(`Scheduled scan configuration not found: ${id}`);
    }

    // Validate cron expression if updated
    if (updates.schedule && !cron.validate(updates.schedule)) {
      throw new Error(`Invalid cron expression: ${updates.schedule}`);
    }

    // Update configuration
    const updated = { ...existing, ...updates, id }; // Ensure ID doesn't change
    this.configs.set(id, updated);

    // Reschedule task
    await this.unscheduleTask(id);
    if (updated.enabled) {
      await this.scheduleTask(updated);
    }

    // Persist to storage
    await this.saveConfigurations();

    console.log(`[GitHub Scheduler] Updated scheduled scan: ${updated.name} (${id})`);
  }

  /**
   * Remove a scheduled scan configuration
   */
  async removeScheduledScan(id: string): Promise<void> {
    const config = this.configs.get(id);
    if (!config) {
      throw new Error(`Scheduled scan configuration not found: ${id}`);
    }

    // Unschedule task
    await this.unscheduleTask(id);

    // Remove configuration
    this.configs.delete(id);

    // Persist to storage
    await this.saveConfigurations();

    console.log(`[GitHub Scheduler] Removed scheduled scan: ${config.name} (${id})`);
  }

  /**
   * Enable or disable a scheduled scan
   */
  async toggleScheduledScan(id: string, enabled: boolean): Promise<void> {
    const config = this.configs.get(id);
    if (!config) {
      throw new Error(`Scheduled scan configuration not found: ${id}`);
    }

    config.enabled = enabled;

    if (enabled) {
      await this.scheduleTask(config);
    } else {
      await this.unscheduleTask(id);
    }

    // Persist to storage
    await this.saveConfigurations();

    console.log(`[GitHub Scheduler] ${enabled ? 'Enabled' : 'Disabled'} scheduled scan: ${config.name} (${id})`);
  }

  /**
   * Execute a scheduled scan immediately
   */
  async executeNow(id: string): Promise<ScheduledScanExecution> {
    const config = this.configs.get(id);
    if (!config) {
      throw new Error(`Scheduled scan configuration not found: ${id}`);
    }

    return await this.executeScheduledScan(config);
  }

  /**
   * Get all scheduled scan configurations
   */
  getScheduledScans(): ScheduledScanConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get a specific scheduled scan configuration
   */
  getScheduledScan(id: string): ScheduledScanConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit: number = 100): ScheduledScanExecution[] {
    return this.executionHistory
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  /**
   * Get execution history for a specific configuration
   */
  getConfigExecutionHistory(configId: string, limit: number = 50): ScheduledScanExecution[] {
    return this.executionHistory
      .filter(exec => exec.configId === configId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    const executions = this.executionHistory;
    const successful = executions.filter(e => e.status === 'completed');
    const failed = executions.filter(e => e.status === 'failed');
    
    const totalDuration = successful
      .filter(e => e.duration)
      .reduce((sum, e) => sum + (e.duration || 0), 0);
    
    const averageDuration = successful.length > 0 ? totalDuration / successful.length : 0;
    
    const repositoriesDiscovered = executions
      .reduce((sum, e) => sum + (e.result?.totalScanned || 0), 0);
    
    const entitiesImported = executions
      .reduce((sum, e) => sum + (e.importSummary?.imported || 0), 0);

    // Find next execution time
    let nextExecution: Date | undefined;
    for (const task of this.tasks.values()) {
      const nextRun = task.nextDate();
      if (nextRun && (!nextExecution || nextRun.toDate() < nextExecution)) {
        nextExecution = nextRun.toDate();
      }
    }

    return {
      totalConfigs: this.configs.size,
      activeConfigs: Array.from(this.configs.values()).filter(c => c.enabled).length,
      totalExecutions: executions.length,
      successfulExecutions: successful.length,
      failedExecutions: failed.length,
      lastExecution: executions.length > 0 ? 
        Math.max(...executions.map(e => e.startTime.getTime())) as any as Date : undefined,
      nextExecution,
      averageDuration,
      repositoriesDiscovered,
      entitiesImported,
    };
  }

  /**
   * Stop all scheduled tasks and cleanup
   */
  async shutdown(): Promise<void> {
    console.log('[GitHub Scheduler] Shutting down...');
    
    // Stop all scheduled tasks
    for (const [id, task] of this.tasks) {
      task.stop();
      console.log(`[GitHub Scheduler] Stopped task: ${id}`);
    }
    
    this.tasks.clear();
    
    // Cancel any running executions
    for (const execution of this.executions.values()) {
      if (execution.status === 'running') {
        execution.status = 'cancelled';
        execution.endTime = new Date();
        execution.logs.push({
          timestamp: new Date(),
          level: 'warn',
          message: 'Execution cancelled due to scheduler shutdown',
        });
      }
    }

    console.log('[GitHub Scheduler] Shutdown complete');
  }

  /**
   * Schedule a task for a configuration
   */
  private async scheduleTask(config: ScheduledScanConfig): Promise<void> {
    const task = cron.schedule(config.schedule, async () => {
      await this.executeScheduledScan(config);
    }, {
      scheduled: false,
      timezone: 'UTC',
    });

    this.tasks.set(config.id, task);
    task.start();

    console.log(`[GitHub Scheduler] Scheduled task: ${config.name} (${config.schedule})`);
  }

  /**
   * Unschedule a task
   */
  private async unscheduleTask(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (task) {
      task.stop();
      this.tasks.delete(id);
      console.log(`[GitHub Scheduler] Unscheduled task: ${id}`);
    }
  }

  /**
   * Execute a scheduled scan
   */
  private async executeScheduledScan(config: ScheduledScanConfig): Promise<ScheduledScanExecution> {
    const executionId = `${config.id}-${Date.now()}`;
    const execution: ScheduledScanExecution = {
      id: executionId,
      configId: config.id,
      status: 'running',
      startTime: new Date(),
      logs: [],
    };

    // Store execution
    this.executions.set(executionId, execution);
    this.executionHistory.push(execution);

    // Trim history if needed
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize);
    }

    execution.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: `Starting scheduled scan: ${config.name}`,
    });

    try {
      // Create GitHub scanner
      const scanner = new GitHubScanner(config.githubConfig);

      execution.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: 'GitHub scanner initialized, starting repository scan',
      });

      // Execute scan
      const scanResult = await scanner.scanRepositories(config.scanOptions);
      execution.result = scanResult;

      execution.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: `Scan completed: ${scanResult.totalScanned} repositories discovered`,
      });

      // Import repositories if auto-import is enabled
      if (config.importOptions && scanResult.repositories.length > 0) {
        execution.logs.push({
          timestamp: new Date(),
          level: 'info',
          message: 'Starting automatic import of discovered repositories',
        });

        const importResult = await this.importRepositories(scanResult.repositories, config.importOptions);
        execution.importSummary = importResult;

        execution.logs.push({
          timestamp: new Date(),
          level: 'info',
          message: `Import completed: ${importResult.imported} imported, ${importResult.skipped} skipped, ${importResult.errors} errors`,
        });
      }

      // Mark as completed
      execution.status = 'completed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();

      execution.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: `Scheduled scan completed successfully in ${execution.duration}ms`,
      });

      // Send success notifications
      await this.sendNotifications(config, execution, 'success');

    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - execution.startTime.getTime();
      execution.error = error instanceof Error ? error.message : 'Unknown error';

      execution.logs.push({
        timestamp: new Date(),
        level: 'error',
        message: `Scheduled scan failed: ${execution.error}`,
        details: error,
      });

      // Send failure notifications
      await this.sendNotifications(config, execution, 'failure');

      console.error(`[GitHub Scheduler] Execution failed: ${config.name} (${executionId})`, error);
    } finally {
      // Remove from active executions
      this.executions.delete(executionId);
      
      // Calculate next execution time
      const task = this.tasks.get(config.id);
      if (task) {
        execution.nextExecution = task.nextDate()?.toDate();
      }
    }

    return execution;
  }

  /**
   * Import repositories into catalog
   */
  private async importRepositories(
    repositories: any[],
    importOptions: NonNullable<ScheduledScanConfig['importOptions']>
  ): Promise<{ imported: number; skipped: number; errors: number }> {
    try {
      const response = await fetch('/api/catalog/discovery/github/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repositories,
          options: importOptions,
        }),
      });

      if (!response.ok) {
        throw new Error(`Import API failed: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        imported: result.data.imported,
        skipped: result.data.skipped,
        errors: result.data.errors,
      };

    } catch (error) {
      console.error('Failed to import repositories:', error);
      return {
        imported: 0,
        skipped: 0,
        errors: repositories.length,
      };
    }
  }

  /**
   * Send notifications
   */
  private async sendNotifications(
    config: ScheduledScanConfig,
    execution: ScheduledScanExecution,
    type: 'success' | 'failure' | 'partial'
  ): Promise<void> {
    if (!config.notifications) return;

    const recipients = config.notifications[
      type === 'success' ? 'onSuccess' :
      type === 'failure' ? 'onFailure' :
      'onPartialSuccess'
    ];

    if (!recipients || recipients.length === 0) return;

    const notification = {
      type,
      configName: config.name,
      executionId: execution.id,
      timestamp: execution.endTime || execution.startTime,
      duration: execution.duration,
      summary: {
        repositoriesScanned: execution.result?.totalScanned || 0,
        entitiesImported: execution.importSummary?.imported || 0,
        errors: execution.result?.errors.length || 0,
      },
      error: execution.error,
    };

    // Send to each recipient
    for (const recipient of recipients) {
      try {
        if (recipient.startsWith('http')) {
          // Webhook
          await fetch(recipient, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notification),
          });
        } else if (recipient.includes('@')) {
          // Email (would need email service integration)
          console.log(`[GitHub Scheduler] Email notification to ${recipient}:`, notification);
        }
      } catch (error) {
        console.error(`[GitHub Scheduler] Failed to send notification to ${recipient}:`, error);
      }
    }
  }

  /**
   * Load configurations from storage
   */
  private async loadConfigurations(): Promise<void> {
    try {
      // In a real implementation, load from database or file system
      // For now, this is a no-op
      console.log('[GitHub Scheduler] Loading configurations from storage...');
    } catch (error) {
      console.error('[GitHub Scheduler] Failed to load configurations:', error);
    }
  }

  /**
   * Save configurations to storage
   */
  private async saveConfigurations(): Promise<void> {
    try {
      // In a real implementation, save to database or file system
      // For now, this is a no-op
      console.log('[GitHub Scheduler] Saving configurations to storage...');
    } catch (error) {
      console.error('[GitHub Scheduler] Failed to save configurations:', error);
    }
  }
}

// Global scheduler instance
let globalScheduler: GitHubScheduler | null = null;

/**
 * Get the global scheduler instance
 */
export function getGitHubScheduler(): GitHubScheduler {
  if (!globalScheduler) {
    globalScheduler = new GitHubScheduler();
  }
  return globalScheduler;
}

/**
 * Initialize the scheduler with graceful shutdown handling
 */
export function initializeGitHubScheduler(): GitHubScheduler {
  const scheduler = getGitHubScheduler();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('[GitHub Scheduler] Received SIGINT, shutting down gracefully...');
    await scheduler.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('[GitHub Scheduler] Received SIGTERM, shutting down gracefully...');
    await scheduler.shutdown();
    process.exit(0);
  });

  return scheduler;
}