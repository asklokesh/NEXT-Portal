/**
 * Universal Plugin Manager
 * Handles installation, updates, configuration, and management of ANY Backstage plugin
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import semver from 'semver';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

export interface PluginMetadata {
  id: string; // Full package name (e.g., @backstage/plugin-kubernetes)
  name: string;
  version: string;
  installedVersion?: string;
  latestVersion?: string;
  description?: string;
  author?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  backstageVersion?: string;
  installed: boolean;
  enabled: boolean;
  configured: boolean;
  hasUpdate?: boolean;
  configuration?: PluginConfiguration;
  installationDate?: string;
  lastUpdated?: string;
  source: 'npm' | 'github' | 'local' | 'custom';
  type: 'frontend' | 'backend' | 'common' | 'scaffolder';
}

export interface PluginConfiguration {
  [key: string]: any;
  apiEndpoints?: string[];
  requiredEnvVars?: string[];
  optionalEnvVars?: string[];
  customSettings?: Record<string, any>;
}

export interface PluginInstallOptions {
  version?: string;
  force?: boolean;
  skipDependencyCheck?: boolean;
  configuration?: PluginConfiguration;
  source?: 'npm' | 'github' | 'local' | 'custom';
  githubUrl?: string;
  localPath?: string;
}

export interface PluginOperationResult {
  success: boolean;
  message: string;
  plugin?: PluginMetadata;
  details?: any;
  error?: string;
  warnings?: string[];
}

export class UniversalPluginManager {
  private pluginsDir: string;
  private configDir: string;
  private dockerContainerName = 'backstage-plugin-installer';
  private npmRegistry = 'https://registry.npmjs.org';

  constructor() {
    this.pluginsDir = path.join(process.cwd(), 'plugins');
    this.configDir = path.join(process.cwd(), 'config/plugins');
  }

  /**
   * Initialize plugin directories
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.pluginsDir, { recursive: true });
    await fs.mkdir(this.configDir, { recursive: true });
    await fs.mkdir(path.join(this.pluginsDir, 'metadata'), { recursive: true });
    await fs.mkdir(path.join(this.pluginsDir, 'configs'), { recursive: true });
  }

  /**
   * Search for plugins in npm registry and other sources
   */
  async searchPlugins(query: string, source: 'all' | 'npm' | 'github' = 'all'): Promise<PluginMetadata[]> {
    const plugins: PluginMetadata[] = [];

    if (source === 'all' || source === 'npm') {
      // Search npm registry
      const npmPlugins = await this.searchNpmPlugins(query);
      plugins.push(...npmPlugins);
    }

    if (source === 'all' || source === 'github') {
      // Search GitHub for Backstage plugins
      const githubPlugins = await this.searchGitHubPlugins(query);
      plugins.push(...githubPlugins);
    }

    // Check installed status for each plugin
    for (const plugin of plugins) {
      const metadata = await this.getPluginMetadata(plugin.id);
      if (metadata) {
        plugin.installed = true;
        plugin.enabled = metadata.enabled;
        plugin.configured = metadata.configured;
        plugin.installedVersion = metadata.installedVersion;
        plugin.hasUpdate = this.checkForUpdate(metadata);
      }
    }

    return plugins;
  }

  /**
   * Install a plugin from any source
   */
  async installPlugin(pluginId: string, options: PluginInstallOptions = {}): Promise<PluginOperationResult> {
    try {
      await this.initialize();

      // Determine installation source and method
      let installResult: PluginOperationResult;

      if (options.source === 'github' && options.githubUrl) {
        installResult = await this.installFromGitHub(options.githubUrl, options);
      } else if (options.source === 'local' && options.localPath) {
        installResult = await this.installFromLocal(options.localPath, options);
      } else {
        installResult = await this.installFromNpm(pluginId, options);
      }

      if (!installResult.success) {
        return installResult;
      }

      // Save plugin metadata
      const metadata = installResult.plugin!;
      await this.savePluginMetadata(metadata);

      // Apply initial configuration if provided
      if (options.configuration) {
        await this.configurePlugin(pluginId, options.configuration);
      }

      // Run post-install hooks
      await this.runPostInstallHooks(metadata);

      return {
        success: true,
        message: `Plugin ${pluginId} installed successfully`,
        plugin: metadata
      };
    } catch (error) {
      console.error(`Failed to install plugin ${pluginId}:`, error);
      return {
        success: false,
        message: 'Plugin installation failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update a plugin to the latest version
   */
  async updatePlugin(pluginId: string, targetVersion?: string): Promise<PluginOperationResult> {
    try {
      const metadata = await this.getPluginMetadata(pluginId);
      if (!metadata || !metadata.installed) {
        return {
          success: false,
          message: `Plugin ${pluginId} is not installed`,
          error: 'Plugin not found'
        };
      }

      // Check for available updates
      const latestVersion = targetVersion || await this.getLatestVersion(pluginId);
      if (!latestVersion) {
        return {
          success: false,
          message: 'Could not determine latest version',
          error: 'Version check failed'
        };
      }

      if (metadata.installedVersion === latestVersion) {
        return {
          success: true,
          message: `Plugin ${pluginId} is already at the latest version`,
          plugin: metadata
        };
      }

      // Backup current configuration
      const config = await this.getPluginConfiguration(pluginId);

      // Perform update
      const updateResult = await this.performPluginUpdate(pluginId, latestVersion, metadata);
      if (!updateResult.success) {
        return updateResult;
      }

      // Restore configuration
      if (config) {
        await this.configurePlugin(pluginId, config);
      }

      // Update metadata
      metadata.installedVersion = latestVersion;
      metadata.lastUpdated = new Date().toISOString();
      await this.savePluginMetadata(metadata);

      return {
        success: true,
        message: `Plugin ${pluginId} updated to version ${latestVersion}`,
        plugin: metadata
      };
    } catch (error) {
      console.error(`Failed to update plugin ${pluginId}:`, error);
      return {
        success: false,
        message: 'Plugin update failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Configure a plugin
   */
  async configurePlugin(pluginId: string, configuration: PluginConfiguration): Promise<PluginOperationResult> {
    try {
      const metadata = await this.getPluginMetadata(pluginId);
      if (!metadata || !metadata.installed) {
        return {
          success: false,
          message: `Plugin ${pluginId} is not installed`,
          error: 'Plugin not found'
        };
      }

      // Validate configuration
      const validation = await this.validateConfiguration(pluginId, configuration);
      if (!validation.valid) {
        return {
          success: false,
          message: 'Invalid configuration',
          error: validation.errors?.join(', ')
        };
      }

      // Save configuration
      const configPath = path.join(this.configDir, `${this.sanitizeFilename(pluginId)}.json`);
      await fs.writeFile(configPath, JSON.stringify(configuration, null, 2));

      // Apply configuration to Backstage
      await this.applyConfigurationToBackstage(pluginId, configuration);

      // Update metadata
      metadata.configured = true;
      metadata.configuration = configuration;
      await this.savePluginMetadata(metadata);

      return {
        success: true,
        message: `Plugin ${pluginId} configured successfully`,
        plugin: metadata
      };
    } catch (error) {
      console.error(`Failed to configure plugin ${pluginId}:`, error);
      return {
        success: false,
        message: 'Plugin configuration failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Remove a plugin
   */
  async removePlugin(pluginId: string): Promise<PluginOperationResult> {
    try {
      const metadata = await this.getPluginMetadata(pluginId);
      if (!metadata || !metadata.installed) {
        return {
          success: false,
          message: `Plugin ${pluginId} is not installed`,
          error: 'Plugin not found'
        };
      }

      // Run pre-uninstall hooks
      await this.runPreUninstallHooks(metadata);

      // Remove from Docker container
      await this.removeFromDocker(pluginId);

      // Remove configuration
      const configPath = path.join(this.configDir, `${this.sanitizeFilename(pluginId)}.json`);
      try {
        await fs.unlink(configPath);
      } catch (error) {
        // Configuration might not exist
      }

      // Remove metadata
      const metadataPath = path.join(this.pluginsDir, 'metadata', `${this.sanitizeFilename(pluginId)}.json`);
      await fs.unlink(metadataPath);

      return {
        success: true,
        message: `Plugin ${pluginId} removed successfully`
      };
    } catch (error) {
      console.error(`Failed to remove plugin ${pluginId}:`, error);
      return {
        success: false,
        message: 'Plugin removal failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all installed plugins
   */
  async getInstalledPlugins(): Promise<PluginMetadata[]> {
    try {
      await this.initialize();
      const metadataDir = path.join(this.pluginsDir, 'metadata');
      const files = await fs.readdir(metadataDir);
      
      const plugins: PluginMetadata[] = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(metadataDir, file), 'utf-8');
            const metadata = JSON.parse(content) as PluginMetadata;
            
            // Check for updates
            metadata.hasUpdate = await this.checkForUpdate(metadata);
            
            plugins.push(metadata);
          } catch (error) {
            console.error(`Failed to read plugin metadata ${file}:`, error);
          }
        }
      }
      
      return plugins;
    } catch (error) {
      console.error('Failed to get installed plugins:', error);
      return [];
    }
  }

  /**
   * Get plugin metadata
   */
  async getPluginMetadata(pluginId: string): Promise<PluginMetadata | null> {
    try {
      const metadataPath = path.join(this.pluginsDir, 'metadata', `${this.sanitizeFilename(pluginId)}.json`);
      const content = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(content) as PluginMetadata;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get plugin configuration
   */
  async getPluginConfiguration(pluginId: string): Promise<PluginConfiguration | null> {
    try {
      const configPath = path.join(this.configDir, `${this.sanitizeFilename(pluginId)}.json`);
      const content = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(content) as PluginConfiguration;
    } catch (error) {
      return null;
    }
  }

  // Private helper methods

  private async searchNpmPlugins(query: string): Promise<PluginMetadata[]> {
    try {
      const searchUrl = `${this.npmRegistry}/-/v1/search?text=${encodeURIComponent(query + ' backstage plugin')}&size=50`;
      const response = await fetch(searchUrl);
      const data = await response.json();

      return data.objects
        .filter((item: any) => {
          const pkg = item.package;
          return pkg.name.includes('backstage') && 
                 (pkg.name.includes('plugin') || pkg.keywords?.includes('backstage-plugin'));
        })
        .map((item: any) => {
          const pkg = item.package;
          return {
            id: pkg.name,
            name: pkg.name,
            version: pkg.version,
            description: pkg.description,
            author: pkg.author?.name || pkg.maintainers?.[0]?.name,
            homepage: pkg.links?.homepage,
            repository: pkg.links?.repository,
            keywords: pkg.keywords,
            installed: false,
            enabled: false,
            configured: false,
            source: 'npm' as const,
            type: this.detectPluginType(pkg.name)
          };
        });
    } catch (error) {
      console.error('Failed to search npm plugins:', error);
      return [];
    }
  }

  private async searchGitHubPlugins(query: string): Promise<PluginMetadata[]> {
    // TODO: Implement GitHub search for Backstage plugins
    return [];
  }

  private async installFromNpm(pluginId: string, options: PluginInstallOptions): Promise<PluginOperationResult> {
    // Get package info from npm
    const packageInfo = await this.getPackageInfo(pluginId);
    if (!packageInfo) {
      return {
        success: false,
        message: `Plugin ${pluginId} not found in npm registry`,
        error: 'Package not found'
      };
    }

    // Check compatibility
    const compatibility = await this.checkCompatibility(packageInfo);
    if (!compatibility.compatible && !options.force) {
      return {
        success: false,
        message: 'Plugin is not compatible with current Backstage version',
        error: compatibility.reason,
        warnings: compatibility.warnings
      };
    }

    // Install in Docker container
    const installResult = await this.installInDocker(pluginId, options.version || packageInfo.version);
    if (!installResult.success) {
      return installResult;
    }

    // Create metadata
    const metadata: PluginMetadata = {
      id: pluginId,
      name: packageInfo.name,
      version: packageInfo.version,
      installedVersion: options.version || packageInfo.version,
      description: packageInfo.description,
      author: packageInfo.author,
      homepage: packageInfo.homepage,
      repository: packageInfo.repository,
      keywords: packageInfo.keywords,
      dependencies: packageInfo.dependencies,
      peerDependencies: packageInfo.peerDependencies,
      installed: true,
      enabled: true,
      configured: false,
      installationDate: new Date().toISOString(),
      source: 'npm',
      type: this.detectPluginType(pluginId)
    };

    return {
      success: true,
      message: `Plugin ${pluginId} installed successfully`,
      plugin: metadata
    };
  }

  private async installFromGitHub(githubUrl: string, options: PluginInstallOptions): Promise<PluginOperationResult> {
    // TODO: Implement GitHub installation
    return {
      success: false,
      message: 'GitHub installation not yet implemented',
      error: 'Not implemented'
    };
  }

  private async installFromLocal(localPath: string, options: PluginInstallOptions): Promise<PluginOperationResult> {
    // TODO: Implement local installation
    return {
      success: false,
      message: 'Local installation not yet implemented',
      error: 'Not implemented'
    };
  }

  private async installInDocker(pluginId: string, version: string): Promise<PluginOperationResult> {
    try {
      await this.ensureDockerRunning();

      const targetDir = this.detectPluginType(pluginId) === 'backend' ? 'backend' : 'app';
      const installCmd = `docker exec ${this.dockerContainerName} /app/install-plugin.sh "${pluginId}" "${pluginId}@${version}" "${targetDir}"`;
      
      const { stdout, stderr } = await execAsync(installCmd, {
        maxBuffer: 10 * 1024 * 1024
      });

      if (stderr && !stderr.includes('warning')) {
        return {
          success: false,
          message: 'Installation failed',
          error: stderr
        };
      }

      return {
        success: true,
        message: 'Plugin installed in Docker container'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Docker installation failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async removeFromDocker(pluginId: string): Promise<void> {
    try {
      await this.ensureDockerRunning();
      const targetDir = this.detectPluginType(pluginId) === 'backend' ? 'backend' : 'app';
      const removeCmd = `docker exec ${this.dockerContainerName} sh -c "cd /app/backstage/packages/${targetDir} && yarn remove ${pluginId}"`;
      await execAsync(removeCmd);
    } catch (error) {
      console.error(`Failed to remove plugin from Docker:`, error);
    }
  }

  private async performPluginUpdate(pluginId: string, version: string, metadata: PluginMetadata): Promise<PluginOperationResult> {
    // Remove old version and install new one
    await this.removeFromDocker(pluginId);
    return await this.installInDocker(pluginId, version);
  }

  private async ensureDockerRunning(): Promise<void> {
    try {
      const { stdout } = await execAsync(`docker ps --filter "name=${this.dockerContainerName}" --format "{{.Names}}"`);
      
      if (stdout.trim() !== this.dockerContainerName) {
        console.log('Starting Docker plugin installer container...');
        await execAsync('docker compose -f docker-compose.plugins.yml up -d --build plugin-installer');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      throw new Error('Failed to ensure Docker container is running');
    }
  }

  private async getPackageInfo(packageId: string): Promise<any> {
    try {
      const response = await fetch(`${this.npmRegistry}/${packageId}`);
      if (!response.ok) return null;
      
      const data = await response.json();
      const latest = data['dist-tags']?.latest || Object.keys(data.versions).pop();
      return data.versions[latest];
    } catch (error) {
      console.error(`Failed to get package info for ${packageId}:`, error);
      return null;
    }
  }

  private async getLatestVersion(pluginId: string): Promise<string | null> {
    const packageInfo = await this.getPackageInfo(pluginId);
    return packageInfo?.version || null;
  }

  private async checkCompatibility(packageInfo: any): Promise<{ compatible: boolean; reason?: string; warnings?: string[] }> {
    // TODO: Implement proper compatibility checking
    return { compatible: true };
  }

  private async checkForUpdate(metadata: PluginMetadata): Promise<boolean> {
    if (!metadata.installedVersion) return false;
    
    const latestVersion = await this.getLatestVersion(metadata.id);
    if (!latestVersion) return false;
    
    return semver.gt(latestVersion, metadata.installedVersion);
  }

  private detectPluginType(pluginId: string): 'frontend' | 'backend' | 'common' | 'scaffolder' {
    if (pluginId.includes('backend') || pluginId.includes('-node')) return 'backend';
    if (pluginId.includes('scaffolder')) return 'scaffolder';
    if (pluginId.includes('common')) return 'common';
    return 'frontend';
  }

  private sanitizeFilename(pluginId: string): string {
    return pluginId.replace(/[@/]/g, '_');
  }

  private async savePluginMetadata(metadata: PluginMetadata): Promise<void> {
    const metadataPath = path.join(this.pluginsDir, 'metadata', `${this.sanitizeFilename(metadata.id)}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  private async validateConfiguration(pluginId: string, config: PluginConfiguration): Promise<{ valid: boolean; errors?: string[] }> {
    // TODO: Implement configuration validation
    return { valid: true };
  }

  private async applyConfigurationToBackstage(pluginId: string, config: PluginConfiguration): Promise<void> {
    // TODO: Implement Backstage configuration application
    console.log(`Applying configuration for ${pluginId}:`, config);
  }

  private async runPostInstallHooks(metadata: PluginMetadata): Promise<void> {
    // TODO: Implement post-install hooks
    console.log(`Running post-install hooks for ${metadata.id}`);
  }

  private async runPreUninstallHooks(metadata: PluginMetadata): Promise<void> {
    // TODO: Implement pre-uninstall hooks
    console.log(`Running pre-uninstall hooks for ${metadata.id}`);
  }
}

// Export singleton instance
export const universalPluginManager = new UniversalPluginManager();