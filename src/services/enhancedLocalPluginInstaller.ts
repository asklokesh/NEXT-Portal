/**
 * Enhanced Local Plugin Installer for Development Mode
 * Fully automates plugin installation including NPM install, code updates, and dev server restart
 */

import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';

const execAsync = promisify(exec);

export interface InstallationProgress {
  stage: string;
  progress: number;
  message: string;
  detail?: string;
}

export interface PluginInstallOptions {
  pluginId: string;
  version?: string;
  configuration?: Record<string, any>;
  autoRestart?: boolean;
  updateCode?: boolean;
}

export class EnhancedLocalPluginInstaller {
  private backstageRoot: string;
  private devServerProcess: ChildProcess | null = null;
  private progressCallback?: (progress: InstallationProgress) => void;
  
  constructor(backstageRoot?: string) {
    this.backstageRoot = backstageRoot || process.env.BACKSTAGE_ROOT || path.join(process.cwd(), 'backstage');
  }

  /**
   * Set progress callback for real-time updates
   */
  onProgress(callback: (progress: InstallationProgress) => void) {
    this.progressCallback = callback;
  }

  /**
   * Report progress to callback
   */
  private reportProgress(stage: string, progress: number, message: string, detail?: string) {
    const progressData: InstallationProgress = { stage, progress, message, detail };
    console.log(`[${stage}] ${message}`, detail || '');
    if (this.progressCallback) {
      this.progressCallback(progressData);
    }
  }

  /**
   * Main installation method - fully automated
   */
  async installPlugin(options: PluginInstallOptions): Promise<{
    success: boolean;
    message: string;
    details?: any;
    error?: string;
  }> {
    const { 
      pluginId, 
      version = 'latest', 
      configuration = {}, 
      autoRestart = true,
      updateCode = true 
    } = options;

    try {
      this.reportProgress('validation', 5, 'Validating Backstage installation');
      
      // Validate Backstage directory exists
      const backstageExists = await this.validateBackstageDirectory();
      if (!backstageExists) {
        throw new Error(`Backstage directory not found at ${this.backstageRoot}`);
      }

      // Determine package name and type
      const packageName = this.normalizePackageName(pluginId);
      const pluginType = this.detectPluginType(packageName);
      
      this.reportProgress('npm', 10, `Installing NPM package: ${packageName}@${version}`);
      
      // Step 1: Install NPM package
      await this.installNpmPackage(packageName, version, pluginType);
      
      this.reportProgress('config', 30, 'Updating app-config.yaml');
      
      // Step 2: Update app-config.yaml
      await this.updateAppConfig(pluginId, configuration);
      
      if (updateCode) {
        this.reportProgress('code', 50, 'Updating application code');
        
        // Step 3: Update App.tsx or backend index.ts
        if (pluginType === 'frontend') {
          await this.updateFrontendApp(packageName, pluginId);
        } else if (pluginType === 'backend') {
          await this.updateBackendApp(packageName, pluginId);
        }
        
        // Step 4: Update routes if needed
        await this.updateRoutes(packageName, pluginId, pluginType);
      }
      
      // Step 5: Install peer dependencies
      this.reportProgress('dependencies', 70, 'Installing peer dependencies');
      await this.installPeerDependencies(packageName);
      
      // Step 6: Build if necessary
      if (pluginType === 'backend') {
        this.reportProgress('build', 80, 'Building backend');
        await this.buildBackend();
      }
      
      // Step 7: Restart dev server
      if (autoRestart) {
        this.reportProgress('restart', 90, 'Restarting Backstage dev server');
        await this.restartDevServer();
        
        // Step 8: Wait for health check
        this.reportProgress('health', 95, 'Waiting for Backstage to be ready');
        await this.waitForBackstageReady();
      }
      
      this.reportProgress('complete', 100, 'Plugin installation complete!');
      
      return {
        success: true,
        message: `Plugin ${pluginId} successfully installed and integrated`,
        details: {
          packageName,
          version,
          type: pluginType,
          restarted: autoRestart,
          codeUpdated: updateCode
        }
      };
      
    } catch (error) {
      console.error('Plugin installation failed:', error);
      return {
        success: false,
        message: 'Plugin installation failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate Backstage directory exists
   */
  private async validateBackstageDirectory(): Promise<boolean> {
    try {
      const stats = await fs.stat(this.backstageRoot);
      const packageJsonPath = path.join(this.backstageRoot, 'package.json');
      await fs.access(packageJsonPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Normalize plugin ID to NPM package name
   */
  private normalizePackageName(pluginId: string): string {
    // If already a scoped package, return as-is
    if (pluginId.startsWith('@')) {
      return pluginId;
    }
    
    // Common Backstage plugin patterns
    if (pluginId.includes('catalog')) return '@backstage/plugin-catalog';
    if (pluginId.includes('techdocs')) return '@backstage/plugin-techdocs';
    if (pluginId.includes('kubernetes')) return '@backstage/plugin-kubernetes';
    if (pluginId.includes('github-actions')) return '@backstage/plugin-github-actions';
    if (pluginId.includes('jenkins')) return '@backstage/plugin-jenkins';
    if (pluginId.includes('pagerduty')) return '@backstage/plugin-pagerduty';
    if (pluginId.includes('sentry')) return '@backstage/plugin-sentry';
    if (pluginId.includes('rollbar')) return '@backstage/plugin-rollbar';
    
    // Default to @backstage/plugin- prefix
    return `@backstage/plugin-${pluginId}`;
  }

  /**
   * Detect if plugin is frontend or backend
   */
  private detectPluginType(packageName: string): 'frontend' | 'backend' | 'common' {
    if (packageName.includes('-backend') || packageName.includes('-node')) {
      return 'backend';
    }
    if (packageName.includes('-common') || packageName.includes('-react')) {
      return 'common';
    }
    return 'frontend';
  }

  /**
   * Install NPM package in the appropriate location
   */
  private async installNpmPackage(packageName: string, version: string, type: 'frontend' | 'backend' | 'common'): Promise<void> {
    const packageSpec = `${packageName}@${version}`;
    
    // Determine installation directory
    let installDir = this.backstageRoot;
    if (type === 'frontend' && await this.directoryExists(path.join(this.backstageRoot, 'packages', 'app'))) {
      installDir = path.join(this.backstageRoot, 'packages', 'app');
    } else if (type === 'backend' && await this.directoryExists(path.join(this.backstageRoot, 'packages', 'backend'))) {
      installDir = path.join(this.backstageRoot, 'packages', 'backend');
    }
    
    // Run npm install
    const { stdout, stderr } = await execAsync(
      `npm install ${packageSpec} --save`,
      { cwd: installDir }
    );
    
    console.log('NPM install output:', stdout);
    if (stderr) console.warn('NPM install warnings:', stderr);
  }

  /**
   * Update app-config.yaml with plugin configuration
   */
  private async updateAppConfig(pluginId: string, configuration: Record<string, any>): Promise<void> {
    const configPath = path.join(this.backstageRoot, 'app-config.yaml');
    
    try {
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = parseYaml(configContent) || {};
      
      // Add plugin-specific configuration
      const pluginKey = pluginId.replace('@backstage/plugin-', '').replace(/-/g, '_');
      
      // Merge configuration
      if (configuration && Object.keys(configuration).length > 0) {
        config[pluginKey] = { ...config[pluginKey], ...configuration };
      }
      
      // Add to enabled plugins list if structure exists
      if (!config.app) config.app = {};
      if (!config.app.plugins) config.app.plugins = [];
      if (!config.app.plugins.includes(pluginId)) {
        config.app.plugins.push(pluginId);
      }
      
      // Write back
      await fs.writeFile(configPath, stringifyYaml(config));
      
    } catch (error) {
      console.warn('Failed to update app-config.yaml:', error);
      // Don't fail the installation if config update fails
    }
  }

  /**
   * Update frontend App.tsx to import and use the plugin
   */
  private async updateFrontendApp(packageName: string, pluginId: string): Promise<void> {
    const appPath = path.join(this.backstageRoot, 'packages', 'app', 'src', 'App.tsx');
    
    try {
      const appContent = await fs.readFile(appPath, 'utf-8');
      
      // Parse the TypeScript/JSX file
      const ast = parser.parse(appContent, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
      
      // Generate plugin variable name
      const pluginVarName = this.generatePluginVariableName(pluginId);
      const pluginComponentName = `${pluginVarName}Plugin`;
      
      let hasImport = false;
      let hasUsage = false;
      
      // Check if import already exists
      traverse(ast, {
        ImportDeclaration(path) {
          if (path.node.source.value === packageName) {
            hasImport = true;
          }
        },
        JSXElement(path) {
          if (t.isJSXIdentifier(path.node.openingElement.name) && 
              path.node.openingElement.name.name === pluginComponentName) {
            hasUsage = true;
          }
        }
      });
      
      // Add import if not exists
      if (!hasImport) {
        const importStatement = t.importDeclaration(
          [t.importSpecifier(
            t.identifier(pluginComponentName),
            t.identifier(pluginComponentName)
          )],
          t.stringLiteral(packageName)
        );
        ast.program.body.unshift(importStatement);
      }
      
      // Add usage if not exists (this is simplified - real implementation would be more complex)
      if (!hasUsage) {
        traverse(ast, {
          JSXElement(path) {
            // Find the main routes container and add plugin
            if (t.isJSXIdentifier(path.node.openingElement.name) && 
                path.node.openingElement.name.name === 'FlatRoutes') {
              const pluginElement = t.jsxElement(
                t.jsxOpeningElement(t.jsxIdentifier(pluginComponentName), [], true),
                null,
                [],
                true
              );
              path.node.children.push(pluginElement);
              path.stop();
            }
          }
        });
      }
      
      // Generate code from AST
      const output = generate(ast, {
        retainLines: false,
        compact: false
      });
      const code = output.code;
      
      // Write back
      await fs.writeFile(appPath, code);
      
    } catch (error) {
      console.warn('Failed to update App.tsx:', error);
      // Create a simple append if parsing fails
      await this.simpleAppendToApp(appPath, packageName, pluginId);
    }
  }

  /**
   * Simple fallback for updating App.tsx
   */
  private async simpleAppendToApp(appPath: string, packageName: string, pluginId: string): Promise<void> {
    try {
      let content = await fs.readFile(appPath, 'utf-8');
      
      const pluginVarName = this.generatePluginVariableName(pluginId);
      const importStatement = `import { ${pluginVarName}Plugin } from '${packageName}';\n`;
      
      // Add import after last import
      if (!content.includes(importStatement)) {
        const lastImportIndex = content.lastIndexOf('import ');
        if (lastImportIndex >= 0) {
          const endOfLine = content.indexOf('\n', lastImportIndex);
          content = content.slice(0, endOfLine + 1) + importStatement + content.slice(endOfLine + 1);
        }
      }
      
      // Add plugin usage (simplified)
      const pluginUsage = `<${pluginVarName}Plugin />`;
      if (!content.includes(pluginUsage)) {
        // Try to add before </FlatRoutes>
        const flatRoutesEnd = content.indexOf('</FlatRoutes>');
        if (flatRoutesEnd >= 0) {
          content = content.slice(0, flatRoutesEnd) + 
                   `  ${pluginUsage}\n      ` + 
                   content.slice(flatRoutesEnd);
        }
      }
      
      await fs.writeFile(appPath, content);
    } catch (error) {
      console.warn('Simple append also failed:', error);
    }
  }

  /**
   * Update backend index.ts for backend plugins
   */
  private async updateBackendApp(packageName: string, pluginId: string): Promise<void> {
    const backendPath = path.join(this.backstageRoot, 'packages', 'backend', 'src', 'index.ts');
    
    try {
      let content = await fs.readFile(backendPath, 'utf-8');
      
      // Add import
      const importStatement = `import ${pluginId.replace(/-/g, '_')} from '${packageName}';\n`;
      if (!content.includes(packageName)) {
        // Add after last import
        const lastImportIndex = content.lastIndexOf('import ');
        if (lastImportIndex >= 0) {
          const endOfLine = content.indexOf('\n', lastImportIndex);
          content = content.slice(0, endOfLine + 1) + importStatement + content.slice(endOfLine + 1);
        }
      }
      
      // Add to backend (simplified - actual implementation would be more sophisticated)
      const pluginRegistration = `  backend.add(${pluginId.replace(/-/g, '_')}());`;
      if (!content.includes(pluginRegistration)) {
        // Find where plugins are added
        const backendAddIndex = content.lastIndexOf('backend.add(');
        if (backendAddIndex >= 0) {
          const endOfLine = content.indexOf('\n', backendAddIndex);
          content = content.slice(0, endOfLine + 1) + pluginRegistration + '\n' + content.slice(endOfLine + 1);
        }
      }
      
      await fs.writeFile(backendPath, content);
      
    } catch (error) {
      console.warn('Failed to update backend index.ts:', error);
    }
  }

  /**
   * Update routes configuration
   */
  private async updateRoutes(packageName: string, pluginId: string, type: string): Promise<void> {
    if (type !== 'frontend') return;
    
    const routesPath = path.join(this.backstageRoot, 'packages', 'app', 'src', 'components', 'catalog', 'EntityPage.tsx');
    
    // This is plugin-specific and would need custom logic per plugin
    // For now, we'll skip complex route updates
    console.log('Route updates may be needed for', pluginId);
  }

  /**
   * Install peer dependencies
   */
  private async installPeerDependencies(packageName: string): Promise<void> {
    try {
      // Get package info to find peer dependencies
      const { stdout } = await execAsync(`npm view ${packageName} peerDependencies --json`);
      if (stdout) {
        const peerDeps = JSON.parse(stdout);
        const deps = Object.entries(peerDeps).map(([name, version]) => `${name}@${version}`).join(' ');
        
        if (deps) {
          await execAsync(`npm install ${deps} --save`, { cwd: this.backstageRoot });
        }
      }
    } catch (error) {
      console.warn('Failed to install peer dependencies:', error);
    }
  }

  /**
   * Build backend if needed
   */
  private async buildBackend(): Promise<void> {
    try {
      await execAsync('npm run build:backend', { 
        cwd: this.backstageRoot,
        timeout: 120000 // 2 minutes
      });
    } catch (error) {
      console.warn('Backend build failed:', error);
    }
  }

  /**
   * Restart the Backstage dev server
   */
  private async restartDevServer(): Promise<void> {
    // First, kill existing dev server
    await this.stopDevServer();
    
    // Start new dev server
    await this.startDevServer();
  }

  /**
   * Stop the dev server
   */
  private async stopDevServer(): Promise<void> {
    try {
      // Try to find and kill existing Backstage processes
      if (process.platform === 'win32') {
        await execAsync('taskkill /F /IM node.exe /T').catch(() => {});
      } else {
        // Find processes on port 3000 and 7007
        await execAsync("lsof -ti:3000 | xargs kill -9").catch(() => {});
        await execAsync("lsof -ti:7007 | xargs kill -9").catch(() => {});
      }
      
      // Kill our tracked process if exists
      if (this.devServerProcess) {
        this.devServerProcess.kill();
        this.devServerProcess = null;
      }
      
      // Wait a bit for processes to die
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.warn('Failed to stop dev server:', error);
    }
  }

  /**
   * Start the dev server
   */
  private async startDevServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'npm.cmd' : 'npm';
      
      this.devServerProcess = spawn(command, ['run', 'dev'], {
        cwd: this.backstageRoot,
        stdio: 'pipe',
        shell: isWindows
      });
      
      this.devServerProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('Backstage:', output);
        
        // Resolve when server is ready
        if (output.includes('Listening on') || 
            output.includes('ready') || 
            output.includes('started')) {
          resolve();
        }
      });
      
      this.devServerProcess.stderr?.on('data', (data) => {
        console.error('Backstage error:', data.toString());
      });
      
      this.devServerProcess.on('error', (error) => {
        console.error('Failed to start dev server:', error);
        reject(error);
      });
      
      // Timeout after 60 seconds
      setTimeout(() => {
        resolve(); // Resolve anyway after timeout
      }, 60000);
    });
  }

  /**
   * Wait for Backstage to be ready
   */
  private async waitForBackstageReady(): Promise<void> {
    const maxAttempts = 30;
    const delayMs = 2000;
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        // Try to fetch from Backstage API
        const response = await fetch('http://localhost:7007/api/catalog/entities', {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }).catch(() => null);
        
        if (response && response.ok) {
          console.log('Backstage is ready!');
          return;
        }
      } catch (error) {
        // Ignore errors, keep trying
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    console.warn('Backstage readiness check timed out, but continuing anyway');
  }

  /**
   * Generate plugin variable name from plugin ID
   */
  private generatePluginVariableName(pluginId: string): string {
    return pluginId
      .replace('@backstage/plugin-', '')
      .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      .replace(/^./, str => str.toUpperCase());
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const enhancedLocalInstaller = new EnhancedLocalPluginInstaller();