/**
 * Docker-based Plugin Installation Service
 * Handles plugin installation in isolated Docker containers
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { pluginConfigs } from './plugin-configs';

const execAsync = promisify(exec);

export interface PluginInstallationResult {
  success: boolean;
  message: string;
  details?: any;
  error?: string;
}

export class DockerPluginInstaller {
  private containerName = 'backstage-plugin-installer';
  private pluginsDir: string;

  constructor() {
    this.pluginsDir = path.join(process.cwd(), 'docker/plugin-installer/plugins');
  }

  /**
   * Ensure Docker container is running
   */
  async ensureContainerRunning(): Promise<boolean> {
    try {
      // Check if container exists and is running
      const { stdout } = await execAsync(`docker ps --filter "name=${this.containerName}" --format "{{.Names}}"`);
      
      if (stdout.trim() === this.containerName) {
        console.log('Plugin installer container is already running');
        return true;
      }

      // Check if container exists but is stopped
      const { stdout: allContainers } = await execAsync(`docker ps -a --filter "name=${this.containerName}" --format "{{.Names}}"`);
      
      if (allContainers.trim() === this.containerName) {
        // Start the existing container
        console.log('Starting existing plugin installer container...');
        await execAsync(`docker start ${this.containerName}`);
      } else {
        // Build and run the container
        console.log('Building and starting plugin installer container...');
        await execAsync('docker-compose -f docker-compose.plugins.yml up -d --build plugin-installer');
      }

      // Wait for container to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return true;
    } catch (error) {
      console.error('Failed to ensure container is running:', error);
      return false;
    }
  }

  /**
   * Install a plugin using Docker
   */
  async installPlugin(pluginId: string, version?: string): Promise<PluginInstallationResult> {
    try {
      console.log(`Starting Docker-based installation of plugin: ${pluginId}`);
      
      // Ensure container is running
      const containerReady = await this.ensureContainerRunning();
      if (!containerReady) {
        return {
          success: false,
          message: 'Failed to start plugin installer container',
          error: 'Docker container not ready'
        };
      }

      // Get plugin configuration (optional)
      const pluginConfig = pluginConfigs[pluginId];
      if (!pluginConfig) {
        console.log(`No predefined configuration for ${pluginId}, using dynamic installation`);
      }

      // Determine the npm package name
      const packageName = this.getPackageName(pluginId);
      const packageSpec = version ? `${packageName}@${version}` : packageName;

      // Determine if it's a backend or frontend plugin
      const isBackendPlugin = packageName.includes('backend') || packageName.includes('-node');
      const targetDir = isBackendPlugin ? 'backend' : 'app';

      // Execute installation in Docker container
      console.log(`Installing ${packageSpec} in Docker container...`);
      const installCmd = `docker exec ${this.containerName} /app/install-plugin.sh "${pluginId}" "${packageSpec}" "${targetDir}"`;
      
      const { stdout, stderr } = await execAsync(installCmd, {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      if (stderr && !stderr.includes('warning')) {
        console.error('Installation stderr:', stderr);
      }

      console.log('Installation stdout:', stdout);

      // Check if installation was successful
      // Replace slashes and @ in plugin ID to match the filename created by the install script
      const safePluginId = pluginId.replace(/[@/]/g, '_');
      const pluginInfoPath = path.join(this.pluginsDir, `${safePluginId}.json`);
      try {
        await fs.access(pluginInfoPath);
        const pluginInfo = JSON.parse(await fs.readFile(pluginInfoPath, 'utf-8'));
        
        return {
          success: true,
          message: `Plugin ${pluginId} installed successfully in Docker container`,
          details: {
            ...pluginInfo,
            containerName: this.containerName,
            dockerized: true
          }
        };
      } catch (error) {
        return {
          success: false,
          message: 'Plugin installation may have failed',
          error: 'Could not verify installation'
        };
      }
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
   * Get list of installed plugins from Docker container
   */
  async getInstalledPlugins(): Promise<Array<{ id: string; enabled: boolean; version?: string; details?: any }>> {
    try {
      await this.ensureContainerRunning();
      
      // Ensure plugins directory exists
      await fs.mkdir(this.pluginsDir, { recursive: true });
      
      // Read all plugin info files
      const files = await fs.readdir(this.pluginsDir);
      const pluginFiles = files.filter(f => f.endsWith('.json'));
      
      const plugins = await Promise.all(
        pluginFiles.map(async (file) => {
          try {
            const content = await fs.readFile(path.join(this.pluginsDir, file), 'utf-8');
            const pluginInfo = JSON.parse(content);
            return {
              id: pluginInfo.pluginId,
              enabled: true,
              version: pluginInfo.version || 'latest',
              details: pluginInfo
            };
          } catch (error) {
            console.error(`Failed to read plugin info ${file}:`, error);
            return null;
          }
        })
      );
      
      return plugins.filter(p => p !== null) as any[];
    } catch (error) {
      console.error('Failed to get installed plugins:', error);
      return [];
    }
  }

  /**
   * Remove a plugin from Docker container
   */
  async removePlugin(pluginId: string): Promise<PluginInstallationResult> {
    try {
      await this.ensureContainerRunning();
      
      // Get plugin info
      const safePluginId = pluginId.replace(/[@/]/g, '_');
      const pluginInfoPath = path.join(this.pluginsDir, `${safePluginId}.json`);
      const pluginInfo = JSON.parse(await fs.readFile(pluginInfoPath, 'utf-8'));
      
      // Remove from container
      const removeCmd = `docker exec ${this.containerName} sh -c "cd ${pluginInfo.directory} && yarn remove ${pluginInfo.packageName}"`;
      await execAsync(removeCmd);
      
      // Remove plugin info file
      await fs.unlink(pluginInfoPath);
      
      return {
        success: true,
        message: `Plugin ${pluginId} removed successfully`
      };
    } catch (error) {
      console.error(`Failed to remove plugin ${pluginId}:`, error);
      return {
        success: false,
        message: 'Failed to remove plugin',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(lines: number = 100): Promise<string> {
    try {
      const { stdout } = await execAsync(`docker logs --tail ${lines} ${this.containerName}`);
      return stdout;
    } catch (error) {
      console.error('Failed to get container logs:', error);
      return 'Failed to retrieve logs';
    }
  }

  /**
   * Stop the Docker container
   */
  async stopContainer(): Promise<void> {
    try {
      await execAsync(`docker stop ${this.containerName}`);
      console.log('Plugin installer container stopped');
    } catch (error) {
      console.error('Failed to stop container:', error);
    }
  }

  /**
   * Toggle plugin enabled/disabled status
   */
  async togglePlugin(pluginId: string, enabled: boolean): Promise<PluginInstallationResult> {
    try {
      const safePluginId = pluginId.replace(/[@/]/g, '_');
      const pluginInfoPath = path.join(this.pluginsDir, `${safePluginId}.json`);
      
      // Check if plugin is installed
      try {
        await fs.access(pluginInfoPath);
      } catch {
        return {
          success: false,
          message: `Plugin ${pluginId} is not installed`,
          error: 'Plugin not found'
        };
      }
      
      // Update plugin info with enabled status
      const pluginInfo = JSON.parse(await fs.readFile(pluginInfoPath, 'utf-8'));
      pluginInfo.enabled = enabled;
      pluginInfo.updatedAt = new Date().toISOString();
      
      await fs.writeFile(pluginInfoPath, JSON.stringify(pluginInfo, null, 2));
      
      return {
        success: true,
        message: `Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'} successfully`,
        details: pluginInfo
      };
    } catch (error) {
      console.error(`Failed to toggle plugin ${pluginId}:`, error);
      return {
        success: false,
        message: `Failed to ${enabled ? 'enable' : 'disable'} plugin`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the npm package name for a plugin ID
   */
  private getPackageName(pluginId: string): string {
    // Plugin ID is now the full package name, so just return it
    return pluginId;
  }
}

// Export singleton instance
export const dockerPluginInstaller = new DockerPluginInstaller();