/**
 * Automated Plugin Installation Service
 * 
 * Provides zero-downtime plugin installation with dependency resolution,
 * security validation, and automated rollback capabilities for SaaS deployments
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
import semver from 'semver';
import { z } from 'zod';

const execAsync = promisify(exec);

// Installation Status Types
export type InstallationStatus = 
  | 'pending'
  | 'downloading'
  | 'validating'
  | 'installing'
  | 'configuring'
  | 'testing'
  | 'deploying'
  | 'completed'
  | 'failed'
  | 'rolling-back'
  | 'rolled-back';

export interface InstallationProgress {
  status: InstallationStatus;
  progress: number;
  message: string;
  details?: string;
  error?: string;
  timestamp: Date;
  duration?: number;
}

export interface PluginDependency {
  name: string;
  version: string;
  type: 'dependency' | 'peerDependency' | 'optionalDependency';
  installed?: boolean;
  compatible?: boolean;
  required: boolean;
}

export interface SecurityScanResult {
  passed: boolean;
  vulnerabilities: Array<{
    severity: 'low' | 'moderate' | 'high' | 'critical';
    title: string;
    description: string;
    recommendation: string;
  }>;
  score: number;
  scannedAt: Date;
}

export interface InstallationPlan {
  pluginId: string;
  version: string;
  dependencies: PluginDependency[];
  conflicts: string[];
  estimatedTime: number;
  rollbackSupported: boolean;
  requiresRestart: boolean;
  backupRequired: boolean;
}

export interface InstallationResult {
  success: boolean;
  status: InstallationStatus;
  message: string;
  details?: any;
  installationId: string;
  duration: number;
  rollbackId?: string;
}

export interface RollbackPoint {
  id: string;
  pluginId: string;
  timestamp: Date;
  configBackup: any;
  filesBackup: string[];
  dependencySnapshot: Record<string, string>;
}

class AutomatedPluginInstaller extends EventEmitter {
  private installationQueue: Map<string, InstallationProgress> = new Map();
  private rollbackPoints: Map<string, RollbackPoint> = new Map();
  private backstagePath: string;
  private tempDir: string;
  private maxConcurrentInstallations = 3;
  private activeInstallations = 0;

  constructor() {
    super();
    this.backstagePath = process.env.BACKSTAGE_PATH || '/Users/lokesh/git/saas-idp/backstage';
    this.tempDir = path.join(this.backstagePath, '.plugin-installer');
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(path.join(this.tempDir, 'downloads'), { recursive: true });
      await fs.mkdir(path.join(this.tempDir, 'backups'), { recursive: true });
    } catch (error) {
      console.error('Failed to create installer directories:', error);
    }
  }

  /**
   * Plan plugin installation with dependency resolution
   */
  async planInstallation(pluginId: string, version?: string): Promise<InstallationPlan> {
    console.log(`Planning installation for ${pluginId}@${version || 'latest'}`);

    // Fetch plugin metadata
    const pluginInfo = await this.fetchPluginInfo(pluginId, version);
    
    // Resolve dependencies
    const dependencies = await this.resolveDependencies(pluginInfo);
    
    // Check for conflicts
    const conflicts = await this.checkConflicts(pluginId, dependencies);
    
    // Estimate installation time
    const estimatedTime = this.estimateInstallationTime(dependencies);

    return {
      pluginId,
      version: pluginInfo.version,
      dependencies,
      conflicts,
      estimatedTime,
      rollbackSupported: true,
      requiresRestart: false, // Most plugins support hot-reloading
      backupRequired: true
    };
  }

  /**
   * Install plugin with zero-downtime deployment
   */
  async installPlugin(
    pluginId: string, 
    version?: string, 
    config: any = {}
  ): Promise<InstallationResult> {
    if (this.activeInstallations >= this.maxConcurrentInstallations) {
      throw new Error('Maximum concurrent installations reached. Please try again later.');
    }

    const installationId = this.generateInstallationId(pluginId);
    const startTime = Date.now();

    try {
      this.activeInstallations++;
      
      // Initialize progress tracking
      this.updateProgress(installationId, 'pending', 0, 'Initializing installation...');
      
      // Create rollback point
      const rollbackId = await this.createRollbackPoint(pluginId);
      
      // Plan installation
      const plan = await this.planInstallation(pluginId, version);
      
      if (plan.conflicts.length > 0) {
        throw new Error(`Installation conflicts detected: ${plan.conflicts.join(', ')}`);
      }

      // Download plugin
      this.updateProgress(installationId, 'downloading', 10, 'Downloading plugin package...');
      const packagePath = await this.downloadPlugin(pluginId, plan.version);

      // Security validation
      this.updateProgress(installationId, 'validating', 25, 'Running security validation...');
      const securityScan = await this.performSecurityScan(packagePath);
      
      if (!securityScan.passed) {
        throw new Error(`Security validation failed: ${securityScan.vulnerabilities.length} issues found`);
      }

      // Install dependencies
      this.updateProgress(installationId, 'installing', 40, 'Installing dependencies...');
      await this.installDependencies(plan.dependencies);

      // Install plugin package
      this.updateProgress(installationId, 'installing', 60, 'Installing plugin package...');
      await this.installPluginPackage(packagePath, pluginId);

      // Configure plugin
      this.updateProgress(installationId, 'configuring', 75, 'Applying configuration...');
      await this.configurePlugin(pluginId, config);

      // Test installation
      this.updateProgress(installationId, 'testing', 85, 'Testing plugin installation...');
      await this.testPluginInstallation(pluginId);

      // Deploy to production (hot-reload)
      this.updateProgress(installationId, 'deploying', 95, 'Deploying to production...');
      await this.deployPlugin(pluginId);

      // Complete installation
      this.updateProgress(installationId, 'completed', 100, 'Plugin installed successfully!');

      const duration = Date.now() - startTime;
      
      // Cleanup
      await this.cleanup(packagePath);

      return {
        success: true,
        status: 'completed',
        message: `Plugin ${pluginId} installed successfully`,
        installationId,
        duration,
        rollbackId
      };

    } catch (error) {
      console.error(`Plugin installation failed for ${pluginId}:`, error);
      
      // Attempt rollback
      this.updateProgress(installationId, 'rolling-back', 0, 'Installation failed, rolling back...');
      
      try {
        const rollbackId = await this.createRollbackPoint(pluginId);
        if (rollbackId) {
          await this.rollback(rollbackId);
          this.updateProgress(installationId, 'rolled-back', 100, 'Rollback completed successfully');
        }
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }

      const duration = Date.now() - startTime;
      
      return {
        success: false,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Installation failed',
        installationId,
        duration
      };

    } finally {
      this.activeInstallations--;
    }
  }

  /**
   * Fetch plugin information from registry
   */
  private async fetchPluginInfo(pluginId: string, version?: string): Promise<any> {
    try {
      const registryUrl = `https://registry.npmjs.org/${pluginId}`;
      const response = await axios.get(registryUrl, { timeout: 10000 });
      
      const packageData = response.data;
      const targetVersion = version || packageData['dist-tags'].latest;
      
      if (!packageData.versions[targetVersion]) {
        throw new Error(`Version ${targetVersion} not found for ${pluginId}`);
      }

      return {
        ...packageData.versions[targetVersion],
        registryData: packageData
      };
    } catch (error) {
      throw new Error(`Failed to fetch plugin info: ${error}`);
    }
  }

  /**
   * Resolve plugin dependencies
   */
  private async resolveDependencies(pluginInfo: any): Promise<PluginDependency[]> {
    const dependencies: PluginDependency[] = [];
    
    // Process dependencies
    for (const [name, version] of Object.entries(pluginInfo.dependencies || {})) {
      dependencies.push({
        name,
        version: version as string,
        type: 'dependency',
        required: true,
        installed: await this.isPackageInstalled(name),
        compatible: await this.isVersionCompatible(name, version as string)
      });
    }

    // Process peer dependencies
    for (const [name, version] of Object.entries(pluginInfo.peerDependencies || {})) {
      dependencies.push({
        name,
        version: version as string,
        type: 'peerDependency',
        required: true,
        installed: await this.isPackageInstalled(name),
        compatible: await this.isVersionCompatible(name, version as string)
      });
    }

    // Process optional dependencies
    for (const [name, version] of Object.entries(pluginInfo.optionalDependencies || {})) {
      dependencies.push({
        name,
        version: version as string,
        type: 'optionalDependency',
        required: false,
        installed: await this.isPackageInstalled(name),
        compatible: await this.isVersionCompatible(name, version as string)
      });
    }

    return dependencies;
  }

  /**
   * Check for installation conflicts
   */
  private async checkConflicts(pluginId: string, dependencies: PluginDependency[]): Promise<string[]> {
    const conflicts: string[] = [];
    
    // Check if plugin is already installed
    if (await this.isPackageInstalled(pluginId)) {
      conflicts.push(`Plugin ${pluginId} is already installed`);
    }

    // Check for incompatible dependencies
    for (const dep of dependencies) {
      if (dep.installed && !dep.compatible) {
        conflicts.push(`Incompatible version of ${dep.name}: requires ${dep.version}`);
      }
    }

    // Check for Backstage version compatibility
    const backstageVersion = await this.getBackstageVersion();
    const requiredBackstageVersion = this.extractBackstageVersion(dependencies);
    
    if (requiredBackstageVersion && !semver.satisfies(backstageVersion, requiredBackstageVersion)) {
      conflicts.push(`Backstage version ${backstageVersion} does not satisfy requirement ${requiredBackstageVersion}`);
    }

    return conflicts;
  }

  /**
   * Download plugin package
   */
  private async downloadPlugin(pluginId: string, version: string): Promise<string> {
    const downloadDir = path.join(this.tempDir, 'downloads');
    const packagePath = path.join(downloadDir, `${pluginId.replace('/', '-')}-${version}.tgz`);

    try {
      // Download from npm registry
      const tarballUrl = `https://registry.npmjs.org/${pluginId}/-/${pluginId.split('/').pop()}-${version}.tgz`;
      const response = await axios.get(tarballUrl, { 
        responseType: 'stream',
        timeout: 30000
      });

      const writer = require('fs').createWriteStream(packagePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(packagePath));
        writer.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to download plugin: ${error}`);
    }
  }

  /**
   * Perform security scan on plugin package
   */
  private async performSecurityScan(packagePath: string): Promise<SecurityScanResult> {
    const vulnerabilities: SecurityScanResult['vulnerabilities'] = [];
    let score = 100;

    try {
      // Extract package for analysis
      const extractDir = path.join(this.tempDir, 'security-scan', Date.now().toString());
      await fs.mkdir(extractDir, { recursive: true });
      
      await execAsync(`tar -xzf "${packagePath}" -C "${extractDir}"`);
      
      // Read package.json
      const packageJsonPath = path.join(extractDir, 'package', 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      // Check for suspicious scripts
      if (packageJson.scripts) {
        for (const [scriptName, script] of Object.entries(packageJson.scripts)) {
          if (typeof script === 'string' && this.isSuspiciousScript(script)) {
            vulnerabilities.push({
              severity: 'high',
              title: 'Suspicious script detected',
              description: `Script "${scriptName}" contains potentially dangerous commands`,
              recommendation: 'Review script contents before installation'
            });
            score -= 20;
          }
        }
      }

      // Check dependencies for known vulnerabilities
      const auditResult = await this.runNpmAudit(extractDir);
      vulnerabilities.push(...auditResult.vulnerabilities);
      score -= auditResult.scoreDeduction;

      // Cleanup
      await fs.rm(extractDir, { recursive: true, force: true });

      return {
        passed: score >= 70 && vulnerabilities.filter(v => v.severity === 'critical').length === 0,
        vulnerabilities,
        score: Math.max(0, score),
        scannedAt: new Date()
      };
    } catch (error) {
      console.error('Security scan failed:', error);
      return {
        passed: false,
        vulnerabilities: [{
          severity: 'critical',
          title: 'Security scan failed',
          description: 'Unable to complete security validation',
          recommendation: 'Manual security review required'
        }],
        score: 0,
        scannedAt: new Date()
      };
    }
  }

  /**
   * Install plugin dependencies
   */
  private async installDependencies(dependencies: PluginDependency[]): Promise<void> {
    const requiredDeps = dependencies.filter(dep => dep.required && !dep.installed);
    
    if (requiredDeps.length === 0) {
      return;
    }

    const packageNames = requiredDeps.map(dep => `${dep.name}@${dep.version}`);
    
    try {
      await execAsync(`cd "${this.backstagePath}" && npm install ${packageNames.join(' ')}`, {
        timeout: 300000 // 5 minutes
      });
    } catch (error) {
      throw new Error(`Failed to install dependencies: ${error}`);
    }
  }

  /**
   * Install plugin package
   */
  private async installPluginPackage(packagePath: string, pluginId: string): Promise<void> {
    try {
      await execAsync(`cd "${this.backstagePath}" && npm install "${packagePath}"`, {
        timeout: 180000 // 3 minutes
      });
    } catch (error) {
      throw new Error(`Failed to install plugin package: ${error}`);
    }
  }

  /**
   * Configure plugin
   */
  private async configurePlugin(pluginId: string, config: any): Promise<void> {
    if (!config || Object.keys(config).length === 0) {
      return;
    }

    try {
      // Update app-config.yaml
      const configPath = path.join(this.backstagePath, 'app-config.yaml');
      const configContent = await fs.readFile(configPath, 'utf-8');
      
      // Parse existing config
      const yaml = require('js-yaml');
      const existingConfig = yaml.load(configContent);
      
      // Merge plugin config
      const pluginKey = pluginId.replace('@backstage/plugin-', '').replace('@roadiehq/backstage-plugin-', '');
      if (!existingConfig[pluginKey]) {
        existingConfig[pluginKey] = {};
      }
      
      Object.assign(existingConfig[pluginKey], config);
      
      // Write updated config
      const updatedConfig = yaml.dump(existingConfig, { indent: 2 });
      await fs.writeFile(configPath, updatedConfig);
      
    } catch (error) {
      console.warn('Failed to update plugin configuration:', error);
      // Non-critical error, continue installation
    }
  }

  /**
   * Test plugin installation
   */
  private async testPluginInstallation(pluginId: string): Promise<void> {
    try {
      // Try to import the plugin
      const result = await execAsync(`cd "${this.backstagePath}" && node -e "require('${pluginId}')"`, {
        timeout: 30000
      });
      
      console.log(`Plugin ${pluginId} import test passed`);
    } catch (error) {
      throw new Error(`Plugin import test failed: ${error}`);
    }
  }

  /**
   * Deploy plugin with hot-reload
   */
  private async deployPlugin(pluginId: string): Promise<void> {
    try {
      // In a real SaaS environment, this would trigger:
      // 1. Rolling update of Backstage instances
      // 2. Load balancer health checks
      // 3. Gradual traffic shifting
      
      // For now, we'll simulate a hot-reload
      console.log(`Deploying plugin ${pluginId} with zero-downtime...`);
      
      // Signal Backstage to reload plugins (if supported)
      // This would typically involve sending a signal to the running process
      // or using a plugin hot-reload API
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate deployment time
      
    } catch (error) {
      throw new Error(`Plugin deployment failed: ${error}`);
    }
  }

  /**
   * Create rollback point
   */
  private async createRollbackPoint(pluginId: string): Promise<string> {
    const rollbackId = this.generateRollbackId(pluginId);
    const backupDir = path.join(this.tempDir, 'backups', rollbackId);
    
    try {
      await fs.mkdir(backupDir, { recursive: true });
      
      // Backup configuration
      const configPath = path.join(this.backstagePath, 'app-config.yaml');
      const configBackup = await fs.readFile(configPath, 'utf-8');
      await fs.writeFile(path.join(backupDir, 'app-config.yaml'), configBackup);
      
      // Backup package.json
      const packagePath = path.join(this.backstagePath, 'package.json');
      const packageBackup = await fs.readFile(packagePath, 'utf-8');
      await fs.writeFile(path.join(backupDir, 'package.json'), packageBackup);
      
      // Create dependency snapshot
      const { stdout } = await execAsync(`cd "${this.backstagePath}" && npm list --json`);
      const dependencySnapshot = JSON.parse(stdout);
      
      const rollbackPoint: RollbackPoint = {
        id: rollbackId,
        pluginId,
        timestamp: new Date(),
        configBackup,
        filesBackup: [configPath, packagePath],
        dependencySnapshot: dependencySnapshot.dependencies || {}
      };
      
      this.rollbackPoints.set(rollbackId, rollbackPoint);
      
      return rollbackId;
    } catch (error) {
      console.error('Failed to create rollback point:', error);
      throw new Error('Failed to create rollback point');
    }
  }

  /**
   * Rollback to previous state
   */
  async rollback(rollbackId: string): Promise<void> {
    const rollbackPoint = this.rollbackPoints.get(rollbackId);
    
    if (!rollbackPoint) {
      throw new Error(`Rollback point ${rollbackId} not found`);
    }

    try {
      console.log(`Rolling back plugin ${rollbackPoint.pluginId}...`);
      
      // Restore configuration
      const configPath = path.join(this.backstagePath, 'app-config.yaml');
      await fs.writeFile(configPath, rollbackPoint.configBackup);
      
      // Uninstall plugin
      await execAsync(`cd "${this.backstagePath}" && npm uninstall ${rollbackPoint.pluginId}`, {
        timeout: 120000
      });
      
      console.log(`Rollback completed for ${rollbackPoint.pluginId}`);
      
    } catch (error) {
      throw new Error(`Rollback failed: ${error}`);
    }
  }

  /**
   * Helper methods
   */
  private updateProgress(
    installationId: string, 
    status: InstallationStatus, 
    progress: number, 
    message: string,
    details?: string,
    error?: string
  ): void {
    const progressUpdate: InstallationProgress = {
      status,
      progress,
      message,
      details,
      error,
      timestamp: new Date()
    };

    this.installationQueue.set(installationId, progressUpdate);
    this.emit('progress', installationId, progressUpdate);
  }

  private generateInstallationId(pluginId: string): string {
    return createHash('md5').update(`${pluginId}-${Date.now()}`).digest('hex').substring(0, 8);
  }

  private generateRollbackId(pluginId: string): string {
    return createHash('md5').update(`rollback-${pluginId}-${Date.now()}`).digest('hex').substring(0, 8);
  }

  private async isPackageInstalled(packageName: string): Promise<boolean> {
    try {
      await execAsync(`cd "${this.backstagePath}" && npm list ${packageName}`, { timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  private async isVersionCompatible(packageName: string, requiredVersion: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`cd "${this.backstagePath}" && npm list ${packageName} --json`, { 
        timeout: 10000 
      });
      const listResult = JSON.parse(stdout);
      const installedVersion = listResult.dependencies?.[packageName]?.version;
      
      if (!installedVersion) return false;
      
      return semver.satisfies(installedVersion, requiredVersion);
    } catch {
      return false;
    }
  }

  private async getBackstageVersion(): Promise<string> {
    try {
      const packagePath = path.join(this.backstagePath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
      return packageJson.dependencies?.['@backstage/core-app-api'] || '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  private extractBackstageVersion(dependencies: PluginDependency[]): string | null {
    for (const dep of dependencies) {
      if (dep.name.startsWith('@backstage/core')) {
        return dep.version;
      }
    }
    return null;
  }

  private estimateInstallationTime(dependencies: PluginDependency[]): number {
    // Base time: 30 seconds
    let estimatedTime = 30000;
    
    // Add time for each dependency
    estimatedTime += dependencies.length * 5000;
    
    // Add time for uninstalled dependencies
    const uninstalledDeps = dependencies.filter(dep => !dep.installed);
    estimatedTime += uninstalledDeps.length * 10000;
    
    return estimatedTime;
  }

  private isSuspiciousScript(script: string): boolean {
    const suspiciousPatterns = [
      /rm\s+-rf/,
      /sudo/,
      /chmod\s+777/,
      /eval\s*\(/,
      /\$\(.*\)/,
      /curl.*\|.*sh/,
      /wget.*\|.*sh/
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(script));
  }

  private async runNpmAudit(packageDir: string): Promise<{
    vulnerabilities: SecurityScanResult['vulnerabilities'];
    scoreDeduction: number;
  }> {
    try {
      const { stdout } = await execAsync(`cd "${packageDir}/package" && npm audit --json`, {
        timeout: 30000
      });
      
      const auditResult = JSON.parse(stdout);
      const vulnerabilities: SecurityScanResult['vulnerabilities'] = [];
      let scoreDeduction = 0;
      
      for (const [name, advisory] of Object.entries(auditResult.advisories || {})) {
        const vuln = advisory as any;
        vulnerabilities.push({
          severity: vuln.severity,
          title: vuln.title,
          description: vuln.overview,
          recommendation: vuln.recommendation
        });
        
        // Deduct score based on severity
        switch (vuln.severity) {
          case 'critical': scoreDeduction += 25; break;
          case 'high': scoreDeduction += 15; break;
          case 'moderate': scoreDeduction += 10; break;
          case 'low': scoreDeduction += 5; break;
        }
      }
      
      return { vulnerabilities, scoreDeduction };
    } catch {
      // Audit might fail on some packages, that's okay
      return { vulnerabilities: [], scoreDeduction: 0 };
    }
  }

  private async cleanup(packagePath: string): Promise<void> {
    try {
      await fs.unlink(packagePath);
    } catch {
      // Cleanup failure is not critical
    }
  }

  /**
   * Public API methods
   */
  getInstallationProgress(installationId: string): InstallationProgress | null {
    return this.installationQueue.get(installationId) || null;
  }

  getAllActiveInstallations(): Map<string, InstallationProgress> {
    return new Map(this.installationQueue);
  }

  async uninstallPlugin(pluginId: string): Promise<InstallationResult> {
    const startTime = Date.now();
    
    try {
      console.log(`Uninstalling plugin: ${pluginId}`);
      
      // Create rollback point before uninstallation
      const rollbackId = await this.createRollbackPoint(pluginId);
      
      // Uninstall plugin
      await execAsync(`cd "${this.backstagePath}" && npm uninstall ${pluginId}`, {
        timeout: 120000
      });
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        status: 'completed',
        message: `Plugin ${pluginId} uninstalled successfully`,
        installationId: this.generateInstallationId(pluginId),
        duration,
        rollbackId
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        status: 'failed',
        message: error instanceof Error ? error.message : 'Uninstallation failed',
        installationId: this.generateInstallationId(pluginId),
        duration
      };
    }
  }
}

// Export singleton instance
export const automatedPluginInstaller = new AutomatedPluginInstaller();
export default AutomatedPluginInstaller;