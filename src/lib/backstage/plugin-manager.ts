/**
 * Plugin Manager - Handles Backstage plugin installation and configuration
 * This ensures plugins are managed the "Backstage way" while providing a no-code UI
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

const execAsync = promisify(exec);

export interface PluginConfig {
 id: string;
 package: string;
 version?: string;
 config?: Record<string, any>;
 enabled: boolean;
 dependencies?: string[];
}

export interface BackstageAppConfig {
 app?: {
 plugins?: PluginConfig[];
 };
 backend?: {
 plugins?: PluginConfig[];
 };
 [key: string]: any;
}

export class PluginManager {
 private backstageDir: string;
 private configPath: string;

 constructor(backstageDir: string = './backstage') {
 this.backstageDir = path.resolve(backstageDir);
 this.configPath = path.join(this.backstageDir, 'app-config.yaml');
 }

 /**
 * Install a Backstage plugin following the official process
 */
 async installPlugin(pluginPackage: string, version?: string): Promise<void> {
 const packageSpec = version ? `${pluginPackage}@${version}` : pluginPackage;
 
 try {
 // Install in the appropriate package based on plugin type
 const isBackendPlugin = pluginPackage.includes('backend');
 const targetDir = isBackendPlugin 
 ? path.join(this.backstageDir, 'packages/backend')
 : path.join(this.backstageDir, 'packages/app');

 // Install the plugin package
 console.log(`Installing ${packageSpec} in ${targetDir}`);
 await execAsync(`cd ${targetDir} && yarn add ${packageSpec}`);

 // If it's a backend plugin, also add to backend dependencies
 if (isBackendPlugin) {
 await this.updateBackendPlugin(pluginPackage);
 } else {
 await this.updateAppPlugin(pluginPackage);
 }

 // Update app-config.yaml if needed
 await this.updateConfig(pluginPackage, {});

 } catch (error) {
 console.error(`Failed to install plugin ${pluginPackage}:`, error);
 throw error;
 }
 }

 /**
 * Update app plugin imports (for frontend plugins)
 */
 private async updateAppPlugin(pluginPackage: string): Promise<void> {
 const appPath = path.join(this.backstageDir, 'packages/app/src/App.tsx');
 
 try {
 let appContent = await fs.readFile(appPath, 'utf-8');
 
 // Extract plugin name from package
 const pluginName = this.extractPluginName(pluginPackage);
 const importName = this.getImportName(pluginPackage);
 
 // Add import if not exists
 if (!appContent.includes(importName)) {
 const importStatement = `import { ${importName} } from '${pluginPackage}';\n`;
 
 // Find the last import statement
 const lastImportIndex = appContent.lastIndexOf('import ');
 const lineEnd = appContent.indexOf('\n', lastImportIndex);
 
 appContent = 
 appContent.slice(0, lineEnd + 1) +
 importStatement +
 appContent.slice(lineEnd + 1);
 }

 // Add to routes if not exists
 if (!appContent.includes(`<${importName} />`)) {
 const routesPattern = /<FlatRoutes>[\s\S]*?<\/FlatRoutes>/;
 appContent = appContent.replace(routesPattern, (match) => {
 const insertPoint = match.lastIndexOf('</FlatRoutes>');
 return match.slice(0, insertPoint) +
 ` <Route path="/${pluginName}" element={<${importName} />} />\n` +
 match.slice(insertPoint);
 });
 }

 await fs.writeFile(appPath, appContent);
 } catch (error) {
 console.error('Failed to update App.tsx:', error);
 throw error;
 }
 }

 /**
 * Update backend plugin (for backend plugins)
 */
 private async updateBackendPlugin(pluginPackage: string): Promise<void> {
 const backendPath = path.join(this.backstageDir, 'packages/backend/src/index.ts');
 
 try {
 let backendContent = await fs.readFile(backendPath, 'utf-8');
 
 // Extract module name
 const moduleName = this.extractBackendModuleName(pluginPackage);
 
 // Add import if not exists
 if (!backendContent.includes(pluginPackage)) {
 const importStatement = `import ${moduleName} from '${pluginPackage}';\n`;
 
 // Add after other imports
 const lastImportIndex = backendContent.lastIndexOf('import ');
 const lineEnd = backendContent.indexOf('\n', lastImportIndex);
 
 backendContent = 
 backendContent.slice(0, lineEnd + 1) +
 importStatement +
 backendContent.slice(lineEnd + 1);
 }

 // Add to backend modules
 const modulePattern = /const backend = createBackend\(\);[\s\S]*?backend\.start\(\);/;
 backendContent = backendContent.replace(modulePattern, (match) => {
 if (!match.includes(moduleName)) {
 const startIndex = match.indexOf('backend.start()');
 return match.slice(0, startIndex) +
 `backend.add(${moduleName});\n` +
 match.slice(startIndex);
 }
 return match;
 });

 await fs.writeFile(backendPath, backendContent);
 } catch (error) {
 console.error('Failed to update backend index.ts:', error);
 throw error;
 }
 }

 /**
 * Configure a plugin in app-config.yaml
 */
 async configurePlugin(pluginId: string, config: Record<string, any>): Promise<void> {
 try {
 const configContent = await fs.readFile(this.configPath, 'utf-8');
 const appConfig = yaml.load(configContent) as BackstageAppConfig;

 // Merge plugin config
 if (!appConfig.app) appConfig.app = {};
 if (!appConfig.app.plugins) appConfig.app.plugins = [];

 const existingPlugin = appConfig.app.plugins.find(p => p.id === pluginId);
 if (existingPlugin) {
 existingPlugin.config = { ...existingPlugin.config, ...config };
 } else {
 appConfig.app.plugins.push({
 id: pluginId,
 package: pluginId,
 config,
 enabled: true,
 });
 }

 // Plugin-specific configurations
 this.applyPluginSpecificConfig(pluginId, config, appConfig);

 // Write back
 const newConfigContent = yaml.dump(appConfig, {
 styles: {
 '!!null': 'canonical',
 },
 sortKeys: false,
 });
 
 await fs.writeFile(this.configPath, newConfigContent);
 } catch (error) {
 console.error('Failed to configure plugin:', error);
 throw error;
 }
 }

 /**
 * Apply plugin-specific configuration patterns
 */
 private applyPluginSpecificConfig(
 pluginId: string, 
 config: Record<string, any>, 
 appConfig: BackstageAppConfig
 ): void {
 // Kubernetes plugin
 if (pluginId.includes('kubernetes')) {
 appConfig.kubernetes = {
 serviceLocatorMethod: {
 type: 'multiTenant',
 },
 clusterLocatorMethods: [
 {
 type: 'config',
 clusters: [
 {
 url: config.apiUrl || 'https://kubernetes.default.svc',
 name: config.clusterName || 'default',
 authProvider: 'serviceAccount',
 ...(config.serviceAccountToken && {
 serviceAccountToken: config.serviceAccountToken,
 }),
 },
 ],
 },
 ],
 };
 }

 // GitHub Actions plugin
 if (pluginId.includes('github-actions')) {
 if (!appConfig.integrations) appConfig.integrations = {};
 if (!appConfig.integrations.github) appConfig.integrations.github = [];
 
 appConfig.integrations.github.push({
 host: 'github.com',
 token: config.token,
 });
 }

 // SonarQube plugin
 if (pluginId.includes('sonarqube')) {
 appConfig.sonarqube = {
 baseUrl: config.baseUrl,
 apiKey: config.apiKey,
 };
 }

 // PagerDuty plugin
 if (pluginId.includes('pagerduty')) {
 appConfig.pagerduty = {
 apiToken: config.apiToken,
 };
 }

 // Cost Insights plugin
 if (pluginId.includes('cost-insights')) {
 appConfig.costInsights = {
 engineerCost: config.engineerCost || 200000,
 engineerThreshold: config.engineerThreshold || 0.5,
 products: config.products || [],
 };
 }
 }

 /**
 * Uninstall a plugin
 */
 async uninstallPlugin(pluginPackage: string): Promise<void> {
 try {
 const isBackendPlugin = pluginPackage.includes('backend');
 const targetDir = isBackendPlugin 
 ? path.join(this.backstageDir, 'packages/backend')
 : path.join(this.backstageDir, 'packages/app');

 // Remove package
 await execAsync(`cd ${targetDir} && yarn remove ${pluginPackage}`);

 // Remove from code
 if (isBackendPlugin) {
 await this.removeFromBackend(pluginPackage);
 } else {
 await this.removeFromApp(pluginPackage);
 }

 // Remove from config
 await this.removeFromConfig(pluginPackage);

 } catch (error) {
 console.error(`Failed to uninstall plugin ${pluginPackage}:`, error);
 throw error;
 }
 }

 /**
 * Get list of installed plugins
 */
 async getInstalledPlugins(): Promise<PluginConfig[]> {
 const plugins: PluginConfig[] = [];

 try {
 // Check app package.json
 const appPackageJson = await fs.readFile(
 path.join(this.backstageDir, 'packages/app/package.json'),
 'utf-8'
 );
 const appPackage = JSON.parse(appPackageJson);
 
 // Check backend package.json
 const backendPackageJson = await fs.readFile(
 path.join(this.backstageDir, 'packages/backend/package.json'),
 'utf-8'
 );
 const backendPackage = JSON.parse(backendPackageJson);

 // Extract Backstage plugins
 const allDeps = {
 ...appPackage.dependencies,
 ...backendPackage.dependencies,
 };

 for (const [pkg, version] of Object.entries(allDeps)) {
 if (pkg.startsWith('@backstage/plugin-')) {
 plugins.push({
 id: pkg,
 package: pkg,
 version: version as string,
 enabled: true, // TODO: Check actual status
 config: {}, // TODO: Load from app-config
 });
 }
 }

 return plugins;
 } catch (error) {
 console.error('Failed to get installed plugins:', error);
 return [];
 }
 }

 /**
 * Check plugin compatibility
 */
 async checkCompatibility(pluginPackage: string): Promise<boolean> {
 try {
 // Get Backstage version
 const backstagePackageJson = await fs.readFile(
 path.join(this.backstageDir, 'packages/app/package.json'),
 'utf-8'
 );
 const backstagePackage = JSON.parse(backstagePackageJson);
 const backstageVersion = backstagePackage.dependencies['@backstage/core-app-api'];

 // Check plugin requirements
 // This would ideally check npm registry for peer dependencies
 return true; // Simplified for now
 } catch (error) {
 console.error('Failed to check compatibility:', error);
 return false;
 }
 }

 // Helper methods
 private extractPluginName(pluginPackage: string): string {
 return pluginPackage
 .replace('@backstage/plugin-', '')
 .replace(/-/g, '');
 }

 private getImportName(pluginPackage: string): string {
 const name = this.extractPluginName(pluginPackage);
 return name.charAt(0).toUpperCase() + name.slice(1) + 'Page';
 }

 private extractBackendModuleName(pluginPackage: string): string {
 const name = this.extractPluginName(pluginPackage);
 return name + 'Backend';
 }

 private async removeFromApp(pluginPackage: string): Promise<void> {
 // Implementation to remove plugin from App.tsx
 // This would parse and update the React component
 }

 private async removeFromBackend(pluginPackage: string): Promise<void> {
 // Implementation to remove plugin from backend index.ts
 }

 private async removeFromConfig(pluginPackage: string): Promise<void> {
 // Implementation to remove plugin configuration
 }
}

// Singleton instance
export const pluginManager = new PluginManager();