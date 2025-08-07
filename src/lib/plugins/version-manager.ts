import semver from 'semver';
import crypto from 'crypto';
import { RealDockerInstaller } from './real-docker-installer';

interface PluginVersion {
  id: string;
  pluginId: string;
  version: string;
  releaseDate: Date;
  changelog: string;
  deprecated: boolean;
  yanked: boolean;
  prerelease: boolean;
  tags: string[];
  compatibility: {
    backstageVersion: string;
    breakingChanges: boolean;
  };
  manifest: {
    size: number;
    checksum: string;
    dependencies: Record<string, string>;
  };
}

interface VersionSnapshot {
  id: string;
  pluginId: string;
  version: string;
  previousVersion?: string;
  installedAt: Date;
  installedBy: string;
  configuration: Record<string, any>;
  environment: Record<string, string>;
  status: 'active' | 'inactive' | 'rollback';
}

interface RollbackPlan {
  pluginId: string;
  currentVersion: string;
  targetVersion: string;
  steps: RollbackStep[];
  estimatedDowntime: number;
  affectedPlugins: string[];
  backupRequired: boolean;
}

interface RollbackStep {
  order: number;
  action: 'stop' | 'backup' | 'uninstall' | 'install' | 'restore' | 'start' | 'verify';
  target: string;
  description: string;
  rollbackOnFailure: boolean;
  timeout: number;
}

interface UpgradeStrategy {
  type: 'rolling' | 'blue-green' | 'canary' | 'instant';
  config: {
    maxUnavailable?: number;
    canaryPercentage?: number;
    validationPeriod?: number;
    autoRollback?: boolean;
  };
}

export class VersionManager {
  private versions: Map<string, PluginVersion[]>;
  private snapshots: Map<string, VersionSnapshot[]>;
  private installer: RealDockerInstaller;
  private maxSnapshots: number = 10;

  constructor(installer: RealDockerInstaller) {
    this.versions = new Map();
    this.snapshots = new Map();
    this.installer = installer;
  }

  async getAvailableVersions(pluginId: string): Promise<PluginVersion[]> {
    const versions = this.versions.get(pluginId) || [];
    
    // Sort by version descending
    return versions
      .filter(v => !v.yanked)
      .sort((a, b) => semver.rcompare(a.version, b.version));
  }

  async getLatestVersion(
    pluginId: string,
    options: {
      includePrerelease?: boolean;
      excludeDeprecated?: boolean;
    } = {}
  ): Promise<PluginVersion | null> {
    const versions = await this.getAvailableVersions(pluginId);
    
    return versions.find(v => {
      if (!options.includePrerelease && v.prerelease) {
        return false;
      }
      if (options.excludeDeprecated && v.deprecated) {
        return false;
      }
      return true;
    }) || null;
  }

  async upgrade(
    pluginId: string,
    targetVersion: string,
    strategy: UpgradeStrategy = { type: 'instant', config: {} }
  ): Promise<{
    success: boolean;
    previousVersion: string;
    newVersion: string;
    rollbackId?: string;
  }> {
    // Get current plugin status
    const currentStatus = await this.installer.getPluginStatus(pluginId);
    if (!currentStatus) {
      throw new Error(`Plugin ${pluginId} is not installed`);
    }

    const previousVersion = currentStatus.version;
    
    // Create snapshot before upgrade
    const snapshot = await this.createSnapshot(pluginId, previousVersion);

    try {
      switch (strategy.type) {
        case 'rolling':
          await this.performRollingUpgrade(pluginId, targetVersion, strategy.config);
          break;
        
        case 'blue-green':
          await this.performBlueGreenUpgrade(pluginId, targetVersion, strategy.config);
          break;
        
        case 'canary':
          await this.performCanaryUpgrade(pluginId, targetVersion, strategy.config);
          break;
        
        case 'instant':
        default:
          await this.performInstantUpgrade(pluginId, targetVersion);
          break;
      }

      return {
        success: true,
        previousVersion,
        newVersion: targetVersion,
        rollbackId: snapshot.id
      };
    } catch (error) {
      // Automatic rollback on failure
      if (strategy.config.autoRollback) {
        await this.rollback(pluginId, snapshot.id);
      }
      throw error;
    }
  }

  private async performInstantUpgrade(
    pluginId: string,
    targetVersion: string
  ): Promise<void> {
    // Stop current version
    await this.installer.uninstallPlugin(pluginId);
    
    // Install new version
    await this.installer.installPlugin(pluginId, {
      version: targetVersion
    });
  }

  private async performRollingUpgrade(
    pluginId: string,
    targetVersion: string,
    config: UpgradeStrategy['config']
  ): Promise<void> {
    // For plugins that support multiple instances
    const replicas = 3; // Default replicas
    const maxUnavailable = config.maxUnavailable || 1;
    
    // Scale up new version gradually
    for (let i = 0; i < replicas; i += maxUnavailable) {
      // Install new version instance
      await this.installer.installPlugin(`${pluginId}-v${targetVersion}-${i}`, {
        version: targetVersion
      });
      
      // Wait for health check
      await this.waitForHealthy(`${pluginId}-v${targetVersion}-${i}`, 60000);
      
      // Remove old version instance
      if (i < replicas) {
        await this.installer.uninstallPlugin(`${pluginId}-${i}`);
      }
    }
  }

  private async performBlueGreenUpgrade(
    pluginId: string,
    targetVersion: string,
    config: UpgradeStrategy['config']
  ): Promise<void> {
    // Install new version (green) alongside old version (blue)
    const greenPluginId = `${pluginId}-green`;
    
    await this.installer.installPlugin(greenPluginId, {
      version: targetVersion
    });
    
    // Wait for green to be healthy
    await this.waitForHealthy(greenPluginId, 60000);
    
    // Run validation
    if (config.validationPeriod) {
      await new Promise(resolve => setTimeout(resolve, config.validationPeriod));
    }
    
    // Switch traffic to green (would involve load balancer in production)
    // For now, just swap the instances
    await this.installer.uninstallPlugin(pluginId);
    
    // Rename green to production
    // In real implementation, this would update routing rules
  }

  private async performCanaryUpgrade(
    pluginId: string,
    targetVersion: string,
    config: UpgradeStrategy['config']
  ): Promise<void> {
    const canaryPercentage = config.canaryPercentage || 10;
    const canaryPluginId = `${pluginId}-canary`;
    
    // Install canary version
    await this.installer.installPlugin(canaryPluginId, {
      version: targetVersion
    });
    
    // Wait for canary to be healthy
    await this.waitForHealthy(canaryPluginId, 60000);
    
    // Monitor canary (simplified - would check metrics in production)
    if (config.validationPeriod) {
      await new Promise(resolve => setTimeout(resolve, config.validationPeriod));
    }
    
    // If canary is successful, proceed with full rollout
    await this.performInstantUpgrade(pluginId, targetVersion);
    
    // Remove canary
    await this.installer.uninstallPlugin(canaryPluginId);
  }

  private async waitForHealthy(pluginId: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const status = await this.installer.getPluginStatus(pluginId);
      
      if (status && status.health.status === 'healthy') {
        return;
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error(`Plugin ${pluginId} did not become healthy within ${timeout}ms`);
  }

  async rollback(pluginId: string, snapshotId?: string): Promise<{
    success: boolean;
    rolledBackTo: string;
    from: string;
  }> {
    const snapshots = this.snapshots.get(pluginId) || [];
    
    let targetSnapshot: VersionSnapshot | undefined;
    
    if (snapshotId) {
      targetSnapshot = snapshots.find(s => s.id === snapshotId);
    } else {
      // Get the last working snapshot
      targetSnapshot = snapshots
        .filter(s => s.status === 'active')
        .sort((a, b) => b.installedAt.getTime() - a.installedAt.getTime())[0];
    }
    
    if (!targetSnapshot) {
      throw new Error('No valid snapshot found for rollback');
    }

    const currentStatus = await this.installer.getPluginStatus(pluginId);
    const currentVersion = currentStatus?.version || 'unknown';

    // Create rollback plan
    const plan = this.createRollbackPlan(
      pluginId,
      currentVersion,
      targetSnapshot.version
    );

    // Execute rollback plan
    for (const step of plan.steps) {
      try {
        await this.executeRollbackStep(step, pluginId, targetSnapshot);
      } catch (error) {
        if (step.rollbackOnFailure) {
          throw new Error(`Rollback failed at step: ${step.description}`);
        }
        console.error(`Warning: Step failed but continuing: ${step.description}`);
      }
    }

    // Update snapshot status
    targetSnapshot.status = 'active';

    return {
      success: true,
      rolledBackTo: targetSnapshot.version,
      from: currentVersion
    };
  }

  private createRollbackPlan(
    pluginId: string,
    currentVersion: string,
    targetVersion: string
  ): RollbackPlan {
    const steps: RollbackStep[] = [
      {
        order: 1,
        action: 'backup',
        target: pluginId,
        description: 'Backup current configuration',
        rollbackOnFailure: false,
        timeout: 30000
      },
      {
        order: 2,
        action: 'stop',
        target: pluginId,
        description: 'Stop current plugin instance',
        rollbackOnFailure: true,
        timeout: 30000
      },
      {
        order: 3,
        action: 'uninstall',
        target: pluginId,
        description: 'Remove current version',
        rollbackOnFailure: true,
        timeout: 60000
      },
      {
        order: 4,
        action: 'install',
        target: pluginId,
        description: `Install version ${targetVersion}`,
        rollbackOnFailure: true,
        timeout: 120000
      },
      {
        order: 5,
        action: 'restore',
        target: pluginId,
        description: 'Restore configuration',
        rollbackOnFailure: false,
        timeout: 30000
      },
      {
        order: 6,
        action: 'start',
        target: pluginId,
        description: 'Start rollback version',
        rollbackOnFailure: true,
        timeout: 60000
      },
      {
        order: 7,
        action: 'verify',
        target: pluginId,
        description: 'Verify plugin health',
        rollbackOnFailure: true,
        timeout: 60000
      }
    ];

    return {
      pluginId,
      currentVersion,
      targetVersion,
      steps,
      estimatedDowntime: 5 * 60 * 1000, // 5 minutes
      affectedPlugins: [], // Would calculate dependencies
      backupRequired: true
    };
  }

  private async executeRollbackStep(
    step: RollbackStep,
    pluginId: string,
    snapshot: VersionSnapshot
  ): Promise<void> {
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Step timeout')), step.timeout)
    );

    const execution = (async () => {
      switch (step.action) {
        case 'stop':
          // Plugin will be uninstalled in next step
          break;
        
        case 'backup':
          // Backup is handled by snapshot creation
          break;
        
        case 'uninstall':
          await this.installer.uninstallPlugin(pluginId);
          break;
        
        case 'install':
          await this.installer.installPlugin(pluginId, {
            version: snapshot.version,
            configuration: snapshot.configuration,
            environment: snapshot.environment
          });
          break;
        
        case 'restore':
          // Configuration restored during install
          break;
        
        case 'start':
          // Plugin starts automatically after install
          break;
        
        case 'verify':
          await this.waitForHealthy(pluginId, 30000);
          break;
      }
    })();

    await Promise.race([execution, timeout]);
  }

  private async createSnapshot(
    pluginId: string,
    version: string
  ): Promise<VersionSnapshot> {
    const snapshot: VersionSnapshot = {
      id: crypto.randomBytes(16).toString('hex'),
      pluginId,
      version,
      installedAt: new Date(),
      installedBy: 'system', // Would get from auth context
      configuration: {}, // Would fetch current config
      environment: {}, // Would fetch current env
      status: 'active'
    };

    if (!this.snapshots.has(pluginId)) {
      this.snapshots.set(pluginId, []);
    }

    const pluginSnapshots = this.snapshots.get(pluginId)!;
    pluginSnapshots.push(snapshot);

    // Limit snapshots
    if (pluginSnapshots.length > this.maxSnapshots) {
      pluginSnapshots.shift();
    }

    return snapshot;
  }

  async getUpgradeHistory(pluginId: string): Promise<{
    current: string;
    history: Array<{
      version: string;
      installedAt: Date;
      installedBy: string;
      status: string;
    }>;
  }> {
    const currentStatus = await this.installer.getPluginStatus(pluginId);
    const snapshots = this.snapshots.get(pluginId) || [];

    return {
      current: currentStatus?.version || 'unknown',
      history: snapshots.map(s => ({
        version: s.version,
        installedAt: s.installedAt,
        installedBy: s.installedBy,
        status: s.status
      }))
    };
  }

  async compareVersions(
    pluginId: string,
    version1: string,
    version2: string
  ): Promise<{
    changes: Array<{
      type: 'added' | 'removed' | 'modified';
      field: string;
      description: string;
    }>;
    breakingChanges: boolean;
    migrationRequired: boolean;
  }> {
    // In production, would fetch actual changelog and analyze changes
    const major1 = semver.major(version1);
    const major2 = semver.major(version2);
    
    return {
      changes: [
        {
          type: 'modified',
          field: 'api',
          description: `API changes from ${version1} to ${version2}`
        }
      ],
      breakingChanges: major2 > major1,
      migrationRequired: major2 > major1
    };
  }

  async validateUpgrade(
    pluginId: string,
    targetVersion: string
  ): Promise<{
    canUpgrade: boolean;
    issues: string[];
    warnings: string[];
    estimatedDowntime: number;
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check if target version exists
    const targetVersionInfo = await this.getVersionInfo(pluginId, targetVersion);
    if (!targetVersionInfo) {
      issues.push(`Version ${targetVersion} not found`);
    }

    // Check compatibility
    const currentStatus = await this.installer.getPluginStatus(pluginId);
    if (currentStatus) {
      const comparison = await this.compareVersions(
        pluginId,
        currentStatus.version,
        targetVersion
      );

      if (comparison.breakingChanges) {
        warnings.push('This upgrade contains breaking changes');
      }

      if (comparison.migrationRequired) {
        warnings.push('Data migration may be required');
      }
    }

    // Check dependencies
    const installedPlugins = await this.installer.listInstalledPlugins();
    for (const installed of installedPlugins) {
      // Check if any installed plugin depends on current version
      // Simplified check - would use dependency resolver in production
      if (installed.pluginId !== pluginId) {
        warnings.push(`Plugin ${installed.pluginId} may be affected by this upgrade`);
      }
    }

    return {
      canUpgrade: issues.length === 0,
      issues,
      warnings,
      estimatedDowntime: 5 * 60 * 1000 // 5 minutes
    };
  }

  private async getVersionInfo(
    pluginId: string,
    version: string
  ): Promise<PluginVersion | null> {
    const versions = this.versions.get(pluginId) || [];
    return versions.find(v => v.version === version) || null;
  }

  async scheduleUpgrade(
    pluginId: string,
    targetVersion: string,
    scheduledTime: Date,
    strategy: UpgradeStrategy
  ): Promise<{
    scheduleId: string;
    pluginId: string;
    targetVersion: string;
    scheduledTime: Date;
    status: 'scheduled';
  }> {
    const scheduleId = crypto.randomBytes(16).toString('hex');
    
    // In production, would use a job scheduler
    const delay = scheduledTime.getTime() - Date.now();
    
    if (delay > 0) {
      setTimeout(async () => {
        try {
          await this.upgrade(pluginId, targetVersion, strategy);
        } catch (error) {
          console.error(`Scheduled upgrade failed for ${pluginId}:`, error);
        }
      }, delay);
    }

    return {
      scheduleId,
      pluginId,
      targetVersion,
      scheduledTime,
      status: 'scheduled'
    };
  }

  async autoUpdate(
    pluginId: string,
    policy: {
      allowMajor: boolean;
      allowMinor: boolean;
      allowPatch: boolean;
      excludePrerelease: boolean;
      requireHealthy: boolean;
    }
  ): Promise<{
    updated: boolean;
    fromVersion?: string;
    toVersion?: string;
  }> {
    const currentStatus = await this.installer.getPluginStatus(pluginId);
    if (!currentStatus) {
      return { updated: false };
    }

    const currentVersion = currentStatus.version;
    const availableVersions = await this.getAvailableVersions(pluginId);

    // Find the best version to update to based on policy
    const targetVersion = availableVersions.find(v => {
      if (policy.excludePrerelease && v.prerelease) {
        return false;
      }

      const current = semver.parse(currentVersion);
      const target = semver.parse(v.version);

      if (!current || !target) {
        return false;
      }

      if (target.major > current.major && !policy.allowMajor) {
        return false;
      }

      if (target.major === current.major && 
          target.minor > current.minor && 
          !policy.allowMinor) {
        return false;
      }

      if (target.major === current.major && 
          target.minor === current.minor && 
          target.patch > current.patch && 
          !policy.allowPatch) {
        return false;
      }

      return semver.gt(v.version, currentVersion);
    });

    if (!targetVersion) {
      return { updated: false };
    }

    // Validate before updating
    const validation = await this.validateUpgrade(pluginId, targetVersion.version);
    if (!validation.canUpgrade) {
      return { updated: false };
    }

    // Perform the update
    const result = await this.upgrade(pluginId, targetVersion.version);

    return {
      updated: result.success,
      fromVersion: currentVersion,
      toVersion: targetVersion.version
    };
  }
}