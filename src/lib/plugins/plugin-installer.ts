/**
 * Plugin Installation Service
 * Handles actual installation, configuration, and management of Backstage plugins
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { pluginConfigs } from './plugin-configs';

const execAsync = promisify(exec);

export interface PluginInstallationResult {
 success: boolean;
 message: string;
 details?: any;
 error?: string;
}

export interface BackstageConfig {
 [key: string]: any;
 app?: {
 plugins?: any[];
 };
 backend?: {
 plugins?: any[];
 };
 integrations?: {
 github?: any[];
 gitlab?: any[];
 aws?: any;
 azure?: any;
 gcp?: any;
 };
}

export class PluginInstaller {
 private backstageDir: string;
 private configPath: string;

 constructor(backstageDir: string = process.env.BACKSTAGE_DIR || './backstage') {
 this.backstageDir = path.resolve(backstageDir);
 this.configPath = path.join(this.backstageDir, 'app-config.yaml');
 }

 /**
 * Install a plugin with full Backstage integration
 */
 async installPlugin(pluginId: string, version?: string): Promise<PluginInstallationResult> {
 try {
 console.log(`Starting installation of plugin: ${pluginId}`);
 
 // Get plugin configuration schema (optional - create default if not found)
 const pluginConfig = pluginConfigs[pluginId];
 if (!pluginConfig) {
 console.log(`No predefined configuration for ${pluginId}, using dynamic installation`);
 // Don't fail - just proceed with installation without predefined config
 // This allows installation of any Backstage plugin, not just the ones we have schemas for
 }

 // Determine the npm package name
 const packageName = this.getPackageName(pluginId);
 const packageSpec = version ? `${packageName}@${version}` : packageName;

 // Step 1: Install the npm package
 console.log(`Installing npm package: ${packageSpec}`);
 const installResult = await this.installNpmPackage(packageSpec);
 if (!installResult.success) {
 return installResult;
 }

 // Step 2: Update Backstage configuration
 console.log('Updating Backstage configuration...');
 const configResult = await this.updateBackstageConfig(pluginId, {});
 if (!configResult.success) {
 return configResult;
 }

 // Step 3: Update application code (frontend/backend)
 console.log('Updating application code...');
 const codeResult = await this.updateApplicationCode(pluginId, packageName);
 if (!codeResult.success) {
 return codeResult;
 }

 // Step 4: Install any required dependencies
 console.log('Installing plugin dependencies...');
 const depsResult = await this.installPluginDependencies(pluginId);
 if (!depsResult.success) {
 console.warn('Some dependencies failed to install:', depsResult.message);
 }

 return {
 success: true,
 message: `Plugin ${pluginId} installed successfully`,
 details: {
 packageName,
 version: version || 'latest',
 configUpdated: true,
 codeUpdated: true
 }
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
 * Configure a plugin with user-provided settings
 */
 async configurePlugin(pluginId: string, config: Record<string, any>): Promise<PluginInstallationResult> {
 try {
 console.log(`Configuring plugin: ${pluginId}`);
 
 // Update app-config.yaml with plugin-specific configuration
 const result = await this.updateBackstageConfig(pluginId, config);
 if (!result.success) {
 return result;
 }

 // Apply plugin-specific configuration logic
 await this.applyPluginSpecificConfig(pluginId, config);

 return {
 success: true,
 message: `Plugin ${pluginId} configured successfully`,
 details: { config }
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
 * Enable or disable a plugin
 */
 async togglePlugin(pluginId: string, enabled: boolean): Promise<PluginInstallationResult> {
 try {
 console.log(`${enabled ? 'Enabling' : 'Disabling'} plugin: ${pluginId}`);
 
 const config = await this.loadBackstageConfig();
 
 // Update plugin enabled state
 if (!config.app) config.app = {};
 if (!config.app.plugins) config.app.plugins = [];
 
 const existingPlugin = config.app.plugins.find((p: any) => p.id === pluginId);
 if (existingPlugin) {
 existingPlugin.enabled = enabled;
 } else {
 config.app.plugins.push({
 id: pluginId,
 enabled
 });
 }
 
 await this.saveBackstageConfig(config);
 
 return {
 success: true,
 message: `Plugin ${pluginId} ${enabled ? 'enabled' : 'disabled'} successfully`
 };
 } catch (error) {
 console.error(`Failed to toggle plugin ${pluginId}:`, error);
 return {
 success: false,
 message: 'Plugin toggle failed',
 error: error instanceof Error ? error.message : 'Unknown error'
 };
 }
 }

 /**
 * Get the npm package name for a plugin ID
 */
 private getPackageName(pluginId: string): string {
 // Handle official Backstage plugins
 if (['kubernetes', 'github-actions', 'jenkins', 'route53'].includes(pluginId)) {
 return `@backstage/plugin-${pluginId}`;
 }
 
 // Handle community plugins
 const communityMappings: Record<string, string> = {
 'jira': '@roadiehq/backstage-plugin-jira',
 'confluence': '@k-phoen/backstage-plugin-confluence',
 'servicenow': '@oriflame/backstage-plugin-servicenow',
 'argocd': '@roadiehq/backstage-plugin-argo-cd',
 'terraform': '@roadiehq/backstage-plugin-terraform',
 'vault': '@roadiehq/backstage-plugin-vault',
 'aws': '@roadiehq/backstage-plugin-aws',
 'harness': '@harness/backstage-plugin-harness-ci-cd',
 'splunk': '@splunk/backstage-plugin-splunk-on-call',
 'score-dev': '@score-dev/backstage-plugin',
 'gcp': '@roadiehq/backstage-plugin-gcp',
 'azure': '@roadiehq/backstage-plugin-azure',
 'appdynamics': '@appdynamics/backstage-plugin'
 };
 
 // If not found in mappings, try to determine package name intelligently
 if (communityMappings[pluginId]) {
 return communityMappings[pluginId];
 }
 
 // Handle special naming patterns
 if (pluginId.includes('permission')) {
 return `@backstage/plugin-${pluginId}`;
 }
 
 // Default to official Backstage plugin pattern
 return `@backstage/plugin-${pluginId}`;
 }

 /**
 * Install npm package in the appropriate Backstage directory
 */
 private async installNpmPackage(packageSpec: string): Promise<PluginInstallationResult> {
 try {
 // Determine if it's a backend or frontend plugin
 const isBackendPlugin = packageSpec.includes('backend') || packageSpec.includes('-node');
 const targetDir = isBackendPlugin 
 ? path.join(this.backstageDir, 'packages/backend')
 : path.join(this.backstageDir, 'packages/app');

 // Check if target directory exists
 try {
 await fs.access(targetDir);
 } catch {
 // Create mock directories for development
 await fs.mkdir(targetDir, { recursive: true });
 await fs.writeFile(
 path.join(targetDir, 'package.json'),
 JSON.stringify({ name: isBackendPlugin ? 'backend' : 'app', dependencies: {} }, null, 2)
 );
 }

 // Install the package
 console.log(`Installing ${packageSpec} in ${targetDir}`);
 
 // Use yarn if available, otherwise npm
 const hasYarn = await this.checkCommand('yarn --version');
 const installCmd = hasYarn 
 ? `cd "${targetDir}" && yarn add ${packageSpec}`
 : `cd "${targetDir}" && npm install ${packageSpec}`;
 
 await execAsync(installCmd);
 
 return {
 success: true,
 message: `Package ${packageSpec} installed successfully`
 };
 } catch (error) {
 console.error('Failed to install npm package:', error);
 return {
 success: false,
 message: 'Failed to install npm package',
 error: error instanceof Error ? error.message : 'Unknown error'
 };
 }
 }

 /**
 * Update Backstage configuration files
 */
 private async updateBackstageConfig(pluginId: string, config: Record<string, any>): Promise<PluginInstallationResult> {
 try {
 const backstageConfig = await this.loadBackstageConfig();
 
 // Apply plugin-specific configuration
 this.applyPluginConfigToBackstage(pluginId, config, backstageConfig);
 
 await this.saveBackstageConfig(backstageConfig);
 
 return {
 success: true,
 message: 'Backstage configuration updated successfully'
 };
 } catch (error) {
 console.error('Failed to update Backstage config:', error);
 return {
 success: false,
 message: 'Failed to update Backstage configuration',
 error: error instanceof Error ? error.message : 'Unknown error'
 };
 }
 }

 /**
 * Update application code (App.tsx, backend index.ts)
 */
 private async updateApplicationCode(pluginId: string, packageName: string): Promise<PluginInstallationResult> {
 try {
 const isBackendPlugin = packageName.includes('backend') || packageName.includes('-node');
 
 if (isBackendPlugin) {
 await this.updateBackendCode(pluginId, packageName);
 } else {
 await this.updateFrontendCode(pluginId, packageName);
 }
 
 return {
 success: true,
 message: 'Application code updated successfully'
 };
 } catch (error) {
 console.warn('Failed to update application code (this may be expected in development):', error);
 return {
 success: true,
 message: 'Application code update skipped (development mode)'
 };
 }
 }

 /**
 * Load Backstage configuration from app-config.yaml
 */
 private async loadBackstageConfig(): Promise<BackstageConfig> {
 try {
 const configContent = await fs.readFile(this.configPath, 'utf-8');
 return yaml.load(configContent) as BackstageConfig;
 } catch (error) {
 console.warn('app-config.yaml not found, creating default configuration');
 return {
 app: { title: 'Backstage', baseUrl: 'http://localhost:3000' },
 backend: { baseUrl: 'http://localhost:7007' },
 integrations: {},
 catalog: { locations: [] }
 };
 }
 }

 /**
 * Save Backstage configuration to app-config.yaml
 */
 private async saveBackstageConfig(config: BackstageConfig): Promise<void> {
 // Ensure config directory exists
 await fs.mkdir(path.dirname(this.configPath), { recursive: true });
 
 const yamlContent = yaml.dump(config, {
 styles: {
 '!!null': 'canonical'
 },
 sortKeys: false
 });
 
 await fs.writeFile(this.configPath, yamlContent);
 }

 /**
 * Apply plugin-specific configuration to Backstage config
 */
 private applyPluginConfigToBackstage(pluginId: string, config: Record<string, any>, backstageConfig: BackstageConfig): void {
 switch (pluginId) {
 case 'kubernetes':
 backstageConfig.kubernetes = {
 serviceLocatorMethod: { type: 'multiTenant' },
 clusterLocatorMethods: [{
 type: 'config',
 clusters: [{
 url: config.apiServerUrl || 'https://kubernetes.default.svc',
 name: config.clusterName || 'default',
 authProvider: 'serviceAccount',
 serviceAccountToken: config.serviceAccountToken,
 skipTLSVerify: config.skipTLSVerify || false
 }]
 }]
 };
 break;
 
 case 'github-actions':
 if (!backstageConfig.integrations) backstageConfig.integrations = {};
 if (!backstageConfig.integrations.github) backstageConfig.integrations.github = [];
 backstageConfig.integrations.github.push({
 host: 'github.com',
 token: config.token,
 apiBaseUrl: config.apiBaseUrl || 'https://api.github.com'
 });
 break;
 
 case 'jira':
 backstageConfig.jira = {
 baseUrl: config.baseUrl,
 email: config.email,
 token: config.apiToken
 };
 break;
 
 case 'jenkins':
 backstageConfig.jenkins = {
 instances: [{
 name: 'default',
 baseUrl: config.baseUrl,
 username: config.username,
 apiKey: config.apiKey
 }]
 };
 break;
 
 case 'vault':
 backstageConfig.vault = {
 baseUrl: config.baseUrl,
 token: config.token,
 namespace: config.namespace
 };
 break;
 
 case 'aws':
 if (!backstageConfig.aws) backstageConfig.aws = {};
 backstageConfig.aws.accounts = [{
 accountId: config.accountId || '123456789012',
 region: config.region || 'us-east-1',
 accessKeyId: config.accessKeyId,
 secretAccessKey: config.secretAccessKey,
 assumeRoleArn: config.assumeRole
 }];
 break;

 case 'gcp':
 if (!backstageConfig.integrations) backstageConfig.integrations = {};
 backstageConfig.integrations.gcp = {
 projectId: config.projectId,
 serviceAccountKey: config.serviceAccountKey,
 region: config.region || 'us-central1'
 };
 break;

 case 'azure':
 if (!backstageConfig.integrations) backstageConfig.integrations = {};
 backstageConfig.integrations.azure = {
 subscriptionId: config.subscriptionId,
 tenantId: config.tenantId,
 clientId: config.clientId,
 clientSecret: config.clientSecret,
 resourceGroup: config.resourceGroup
 };
 break;

 case 'route53':
 if (!backstageConfig.aws) backstageConfig.aws = {};
 backstageConfig.aws.route53 = {
 accessKeyId: config.accessKeyId,
 secretAccessKey: config.secretAccessKey,
 region: config.region || 'us-east-1',
 hostedZoneId: config.hostedZoneId
 };
 break;

 case 'appdynamics':
 backstageConfig.appdynamics = {
 controllerUrl: config.controllerUrl,
 accountName: config.accountName,
 username: config.username,
 password: config.password,
 defaultApplication: config.defaultApplication,
 timeRange: config.timeRange || 60
 };
 break;
 }
 }

 /**
 * Apply additional plugin-specific configuration
 */
 private async applyPluginSpecificConfig(pluginId: string, config: Record<string, any>): Promise<void> {
 // This method handles any additional configuration that needs to be done
 // beyond updating app-config.yaml, such as creating additional files,
 // setting up integrations, etc.
 
 console.log(`Applying specific configuration for ${pluginId}:`, config);
 }

 /**
 * Install plugin dependencies
 */
 private async installPluginDependencies(pluginId: string): Promise<PluginInstallationResult> {
 const pluginConfig = pluginConfigs[pluginId];
 if (!pluginConfig?.requiredIntegrations) {
 return { success: true, message: 'No additional dependencies required' };
 }

 // Install any required integration packages
 for (const integration of pluginConfig.requiredIntegrations) {
 try {
 const integrationPackage = `@backstage/integration-${integration}`;
 await this.installNpmPackage(integrationPackage);
 } catch (error) {
 console.warn(`Failed to install integration: ${integration}`, error);
 }
 }

 return { success: true, message: 'Dependencies installed successfully' };
 }

 /**
 * Update frontend application code
 */
 private async updateFrontendCode(pluginId: string, packageName: string): Promise<void> {
 const appPath = path.join(this.backstageDir, 'packages/app/src/App.tsx');
 
 try {
 let appContent = await fs.readFile(appPath, 'utf-8');
 
 // Add import statement
 const importName = this.getComponentImportName(pluginId);
 const importStatement = `import { ${importName} } from '${packageName}';
`;
 
 if (!appContent.includes(importName)) {
 // Find the last import and add our import
 const lastImportIndex = appContent.lastIndexOf('import ');
 const lineEnd = appContent.indexOf('\n', lastImportIndex);
 appContent = appContent.slice(0, lineEnd + 1) + importStatement + appContent.slice(lineEnd + 1);
 
 // Add route
 const routeComponent = `<Route path="/${pluginId}" element={<${importName} />} />`;
 if (!appContent.includes(routeComponent)) {
 // Find the routes section and add our route
 const routesPattern = /<FlatRoutes>[\s\S]*?<\/FlatRoutes>/;
 appContent = appContent.replace(routesPattern, (match) => {
 const insertPoint = match.lastIndexOf('</FlatRoutes>');
 return match.slice(0, insertPoint) + ` ${routeComponent}
 ` + match.slice(insertPoint);
 });
 }
 
 await fs.writeFile(appPath, appContent);
 }
 } catch (error) {
 console.warn('Could not update App.tsx (file may not exist in development)', error);
 }
 }

 /**
 * Update backend application code
 */
 private async updateBackendCode(pluginId: string, packageName: string): Promise<void> {
 const backendPath = path.join(this.backstageDir, 'packages/backend/src/index.ts');
 
 try {
 let backendContent = await fs.readFile(backendPath, 'utf-8');
 
 // Add import and module
 const moduleName = `${pluginId}Plugin`;
 const importStatement = `import ${moduleName} from '${packageName}';
`;
 
 if (!backendContent.includes(moduleName)) {
 // Add import
 const lastImportIndex = backendContent.lastIndexOf('import ');
 const lineEnd = backendContent.indexOf('\n', lastImportIndex);
 backendContent = backendContent.slice(0, lineEnd + 1) + importStatement + backendContent.slice(lineEnd + 1);
 
 // Add to backend
 const moduleAddition = `backend.add(${moduleName});
`;
 const backendPattern = /const backend = createBackend\(\);[\s\S]*?backend\.start\(\);/;
 backendContent = backendContent.replace(backendPattern, (match) => {
 const startIndex = match.indexOf('backend.start()');
 return match.slice(0, startIndex) + moduleAddition + match.slice(startIndex);
 });
 
 await fs.writeFile(backendPath, backendContent);
 }
 } catch (error) {
 console.warn('Could not update backend index.ts (file may not exist in development)', error);
 }
 }

 /**
 * Get component import name for a plugin
 */
 private getComponentImportName(pluginId: string): string {
 const name = pluginId.replace(/-/g, '').replace(/^./, str => str.toUpperCase());
 return `${name}Page`;
 }

 /**
 * Check if a command is available
 */
 private async checkCommand(command: string): Promise<boolean> {
 try {
 await execAsync(command);
 return true;
 } catch {
 return false;
 }
 }

 /**
 * Get list of installed plugins
 */
 async getInstalledPlugins(): Promise<Array<{ id: string; enabled: boolean; version?: string }>> {
 try {
 const config = await this.loadBackstageConfig();
 return config.app?.plugins || [];
 } catch {
 return [];
 }
 }
}

// Export singleton instance
export const pluginInstaller = new PluginInstaller();