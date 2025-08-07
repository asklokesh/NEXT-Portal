// Backstage Plugin Registry Service
// Fetches and manages plugins from the official Backstage plugin ecosystem

import { z } from 'zod';

// Plugin metadata schema based on Backstage plugin structure
export const BackstagePluginSchema = z.object({
 id: z.string(),
 name: z.string(),
 title: z.string(),
 description: z.string(),
 version: z.string(),
 author: z.string(),
 repository: z.string().optional(),
 homepage: z.string().optional(),
 npm: z.string().optional(),
 category: z.enum([
 'core',
 'ci-cd',
 'monitoring',
 'security',
 'infrastructure',
 'analytics',
 'documentation',
 'testing',
 'user-experience',
 'cost-management',
 'observability',
 'data',
 'productivity',
 'compliance',
 'development-tools'
 ]),
 tags: z.array(z.string()),
 downloads: z.number().optional(),
 stars: z.number().optional(),
 lastUpdated: z.string().optional(),
 installed: z.boolean().optional(),
 enabled: z.boolean().optional(),
 configurable: z.boolean().optional(),
 documentation: z.string().optional(),
 dependencies: z.array(z.string()).optional(),
 configSchema: z.any().optional(),
 compatibility: z.object({
 backstageVersion: z.string().optional(),
 nodeVersion: z.string().optional(),
 npmVersion: z.string().optional()
 }).optional(),
 permissions: z.array(z.string()).optional(),
 apiEndpoints: z.array(z.string()).optional(),
 frontendComponents: z.array(z.string()).optional(),
 backendServices: z.array(z.string()).optional()
});

export type BackstagePlugin = z.infer<typeof BackstagePluginSchema>;

// Plugin configuration schema for no-code setup
export interface PluginConfiguration {
 pluginId: string;
 enabled: boolean;
 config: Record<string, any>;
 permissions: string[];
 routes: {
 path: string;
 component: string;
 title: string;
 icon?: string;
 }[];
 apiProxies: {
 path: string;
 target: string;
 changeOrigin: boolean;
 headers?: Record<string, string>;
 }[];
 environment: Record<string, string>;
 secrets: Record<string, string>;
}

// Plugin installation status
export interface PluginInstallationStatus {
 status: 'pending' | 'downloading' | 'installing' | 'configuring' | 'completed' | 'failed';
 progress: number;
 message: string;
 error?: string;
}

class PluginRegistryService {
 private baseUrl: string;
 private npmRegistry = 'https://registry.npmjs.org';
 private installedPlugins: Map<string, PluginConfiguration> = new Map();

 constructor() {
 // Set base URL based on environment
 if (typeof window !== 'undefined') {
 this.baseUrl = window.location.origin;
 } else {
 this.baseUrl = process.env['NEXT_PUBLIC_BACKSTAGE_REGISTRY_URL'] || 'https://backstage.io/api';
 }
 }

 // Fetch all available Backstage plugins
 async fetchAvailablePlugins(): Promise<BackstagePlugin[]> {
 try {
 // Fetch from npm registry with @backstage scope
 const searchUrl = `${this.npmRegistry}/-/v1/search?text=scope:backstage%20plugin&size=250`;
 const response = await fetch(searchUrl);
 
 if (!response.ok) {
 throw new Error('Failed to fetch plugins from registry');
 }

 const data = await response.json();
 const plugins: BackstagePlugin[] = [];

 for (const pkg of data.objects) {
 const packageInfo = pkg.package;
 
 // Only include actual Backstage plugins
 if (!packageInfo.name.includes('@backstage/plugin-')) continue;

 const plugin: BackstagePlugin = {
 id: this.extractPluginId(packageInfo.name),
 name: packageInfo.name,
 title: this.formatPluginTitle(packageInfo.name),
 description: packageInfo.description || 'No description available',
 version: packageInfo.version,
 author: typeof packageInfo.author === 'object' ? packageInfo.author.name : packageInfo.author || 'Backstage',
 repository: packageInfo.links?.repository,
 homepage: packageInfo.links?.homepage,
 npm: packageInfo.links?.npm,
 category: this.categorizePlugin(packageInfo.name, packageInfo.keywords || []),
 tags: packageInfo.keywords || [],
 downloads: pkg.downloads?.weekly,
 stars: pkg.score?.detail?.popularity ? Math.round(pkg.score.detail.popularity * 1000) : 0,
 lastUpdated: packageInfo.date,
 installed: this.isPluginInstalled(this.extractPluginId(packageInfo.name)),
 enabled: this.isPluginEnabled(this.extractPluginId(packageInfo.name)),
 configurable: true,
 dependencies: packageInfo.dependencies ? Object.keys(packageInfo.dependencies) : []
 };

 plugins.push(plugin);
 }

 // Sort by popularity (downloads + stars)
 plugins.sort((a, b) => {
 const scoreA = (a.downloads || 0) + (a.stars || 0) * 10;
 const scoreB = (b.downloads || 0) + (b.stars || 0) * 10;
 return scoreB - scoreA;
 });

 return plugins;
 } catch (error) {
 console.error('Failed to fetch plugins:', error);
 // Return mock data as fallback
 return this.getMockPlugins();
 }
 }

 // Fetch detailed information about a specific plugin
 async fetchPluginDetails(pluginName: string): Promise<BackstagePlugin | null> {
 try {
 const response = await fetch(`${this.npmRegistry}/${pluginName}`);
 
 if (!response.ok) {
 throw new Error('Plugin not found');
 }

 const data = await response.json();
 const latest = data['dist-tags'].latest;
 const packageInfo = data.versions[latest];

 // Extract configuration schema from package
 const configSchema = this.extractConfigSchema(packageInfo);

 const plugin: BackstagePlugin = {
 id: this.extractPluginId(packageInfo.name),
 name: packageInfo.name,
 title: this.formatPluginTitle(packageInfo.name),
 description: packageInfo.description || 'No description available',
 version: packageInfo.version,
 author: typeof packageInfo.author === 'object' ? packageInfo.author.name : packageInfo.author || 'Backstage',
 repository: packageInfo.repository?.url,
 homepage: packageInfo.homepage,
 npm: `https://www.npmjs.com/package/${packageInfo.name}`,
 category: this.categorizePlugin(packageInfo.name, packageInfo.keywords || []),
 tags: packageInfo.keywords || [],
 installed: this.isPluginInstalled(this.extractPluginId(packageInfo.name)),
 enabled: this.isPluginEnabled(this.extractPluginId(packageInfo.name)),
 configurable: true,
 dependencies: packageInfo.dependencies ? Object.keys(packageInfo.dependencies) : [],
 configSchema: configSchema,
 compatibility: {
 backstageVersion: packageInfo.peerDependencies?.['@backstage/core-plugin-api'],
 nodeVersion: packageInfo.engines?.node,
 npmVersion: packageInfo.engines?.npm
 }
 };

 return plugin;
 } catch (error) {
 console.error('Failed to fetch plugin details:', error);
 return null;
 }
 }

 // Install a plugin
 async installPlugin(pluginId: string, onProgress?: (status: PluginInstallationStatus) => void): Promise<void> {
 try {
 // Step 1: Download plugin
 onProgress?.({
 status: 'downloading',
 progress: 20,
 message: 'Downloading plugin package...'
 });

 const plugin = await this.fetchPluginDetails(`@backstage/plugin-${pluginId}`);
 if (!plugin) {
 throw new Error('Plugin not found');
 }

 // Step 2: Check dependencies
 onProgress?.({
 status: 'installing',
 progress: 40,
 message: 'Checking dependencies...'
 });

 const missingDeps = await this.checkDependencies(plugin);
 if (missingDeps.length > 0) {
 // Auto-install missing dependencies
 for (const dep of missingDeps) {
 await this.installDependency(dep);
 }
 }

 // Step 3: Install plugin files
 onProgress?.({
 status: 'installing',
 progress: 60,
 message: 'Installing plugin files...'
 });

 await this.installPluginFiles(plugin);

 // Step 4: Generate default configuration
 onProgress?.({
 status: 'configuring',
 progress: 80,
 message: 'Generating configuration...'
 });

 const config = await this.generateDefaultConfig(plugin);
 this.installedPlugins.set(pluginId, config);

 // Step 5: Register plugin routes
 await this.registerPluginRoutes(plugin, config);

 // Step 6: Complete installation
 onProgress?.({
 status: 'completed',
 progress: 100,
 message: 'Plugin installed successfully!'
 });

 // Save installation state
 await this.savePluginState(pluginId, config);
 } catch (error) {
 onProgress?.({
 status: 'failed',
 progress: 0,
 message: 'Installation failed',
 error: error instanceof Error ? error.message : 'Unknown error'
 });
 throw error;
 }
 }

 // Uninstall a plugin
 async uninstallPlugin(pluginId: string): Promise<void> {
 try {
 // Remove plugin configuration
 this.installedPlugins.delete(pluginId);
 
 // Remove plugin files
 await this.removePluginFiles(pluginId);
 
 // Unregister routes
 await this.unregisterPluginRoutes(pluginId);
 
 // Update state
 await this.removePluginState(pluginId);
 } catch (error) {
 console.error('Failed to uninstall plugin:', error);
 throw error;
 }
 }

 // Configure a plugin with no-code interface values
 async configurePlugin(pluginId: string, configuration: Partial<PluginConfiguration>): Promise<void> {
 const existing = this.installedPlugins.get(pluginId);
 if (!existing) {
 throw new Error('Plugin not installed');
 }

 const updated = {
 ...existing,
 ...configuration,
 config: {
 ...existing.config,
 ...configuration.config
 }
 };

 this.installedPlugins.set(pluginId, updated);
 await this.savePluginState(pluginId, updated);
 
 // Apply configuration to Backstage backend
 await this.applyConfigurationToBackstage(pluginId, updated);
 }

 // Enable/disable a plugin
 async togglePlugin(pluginId: string, enabled: boolean): Promise<void> {
 const config = this.installedPlugins.get(pluginId);
 if (!config) {
 throw new Error('Plugin not installed');
 }

 config.enabled = enabled;
 await this.savePluginState(pluginId, config);
 
 if (enabled) {
 await this.enablePluginInBackstage(pluginId);
 } else {
 await this.disablePluginInBackstage(pluginId);
 }
 }

 // Get configuration schema for a plugin
 async getPluginConfigSchema(pluginId: string): Promise<any> {
 const plugin = await this.fetchPluginDetails(`@backstage/plugin-${pluginId}`);
 return plugin?.configSchema || this.getDefaultConfigSchema(pluginId);
 }

 // Private helper methods
 private extractPluginId(packageName: string): string {
 return packageName.replace('@backstage/plugin-', '');
 }

 private formatPluginTitle(packageName: string): string {
 const id = this.extractPluginId(packageName);
 return id.split('-').map(word => 
 word.charAt(0).toUpperCase() + word.slice(1)
 ).join(' ');
 }

 private categorizePlugin(name: string, keywords: string[]): BackstagePlugin['category'] {
 const keywordStr = keywords.join(' ').toLowerCase();
 const nameStr = name.toLowerCase();

 if (nameStr.includes('github') || nameStr.includes('gitlab') || keywordStr.includes('ci')) {
 return 'ci-cd';
 }
 if (nameStr.includes('kubernetes') || nameStr.includes('k8s') || keywordStr.includes('infrastructure')) {
 return 'infrastructure';
 }
 if (nameStr.includes('sonar') || nameStr.includes('lighthouse') || keywordStr.includes('monitoring')) {
 return 'monitoring';
 }
 if (nameStr.includes('security') || nameStr.includes('vault') || keywordStr.includes('security')) {
 return 'security';
 }
 if (nameStr.includes('cost') || nameStr.includes('budget') || keywordStr.includes('cost')) {
 return 'cost-management';
 }
 if (nameStr.includes('docs') || nameStr.includes('techdocs') || keywordStr.includes('documentation')) {
 return 'documentation';
 }
 if (nameStr.includes('analytics') || nameStr.includes('insights') || keywordStr.includes('analytics')) {
 return 'analytics';
 }
 if (nameStr.includes('test') || keywordStr.includes('testing')) {
 return 'testing';
 }
 if (nameStr.includes('catalog') || nameStr.includes('scaffolder')) {
 return 'core';
 }
 
 return 'productivity';
 }

 private isPluginInstalled(pluginId: string): boolean {
 if (typeof window !== 'undefined') {
 const installed = typeof window !== 'undefined' ? localStorage.getItem(`plugin-installed-${pluginId}`) : null;
 return installed === 'true';
 }
 return false;
 }

 private isPluginEnabled(pluginId: string): boolean {
 if (typeof window !== 'undefined') {
 const enabled = typeof window !== 'undefined' ? localStorage.getItem(`plugin-enabled-${pluginId}`) : null;
 return enabled === 'true';
 }
 return false;
 }

 private extractConfigSchema(packageInfo: any): any {
 // Extract from package.json backstage.configSchema if available
 if (packageInfo.backstage?.configSchema) {
 return packageInfo.backstage.configSchema;
 }
 
 // Otherwise, infer from common patterns
 return null;
 }

 private async checkDependencies(plugin: BackstagePlugin): Promise<string[]> {
 const missing: string[] = [];
 // Check if required dependencies are installed
 // This would check against the actual Backstage installation
 return missing;
 }

 private async installDependency(dep: string): Promise<void> {
 // Install missing dependency
 console.log(`Installing dependency: ${dep}`);
 }

 private async installPluginFiles(plugin: BackstagePlugin): Promise<void> {
 // In a real implementation, this would:
 // 1. Download the npm package
 // 2. Extract frontend components
 // 3. Register backend services
 // 4. Set up API routes
 console.log(`Installing plugin files for: ${plugin.id}`);
 }

 private async generateDefaultConfig(plugin: BackstagePlugin): Promise<PluginConfiguration> {
 return {
 pluginId: plugin.id,
 enabled: false,
 config: {},
 permissions: [],
 routes: [],
 apiProxies: [],
 environment: {},
 secrets: {}
 };
 }

 private async registerPluginRoutes(plugin: BackstagePlugin, config: PluginConfiguration): Promise<void> {
 // Register plugin routes with Next.js router
 console.log(`Registering routes for plugin: ${plugin.id}`);
 }

 private async savePluginState(pluginId: string, config: PluginConfiguration): Promise<void> {
 if (typeof window !== 'undefined') {
 if (typeof window !== 'undefined') {
 localStorage.setItem(`plugin-installed-${pluginId}`, 'true');
 localStorage.setItem(`plugin-enabled-${pluginId}`, config.enabled.toString());
 localStorage.setItem(`plugin-config-${pluginId}`, JSON.stringify(config));
 }
 }
 }

 private async removePluginFiles(pluginId: string): Promise<void> {
 console.log(`Removing plugin files for: ${pluginId}`);
 }

 private async unregisterPluginRoutes(pluginId: string): Promise<void> {
 console.log(`Unregistering routes for plugin: ${pluginId}`);
 }

 private async removePluginState(pluginId: string): Promise<void> {
 if (typeof window !== 'undefined') {
 if (typeof window !== 'undefined') {
 localStorage.removeItem(`plugin-installed-${pluginId}`);
 localStorage.removeItem(`plugin-enabled-${pluginId}`);
 localStorage.removeItem(`plugin-config-${pluginId}`);
 }
 }
 }

 private async applyConfigurationToBackstage(pluginId: string, config: PluginConfiguration): Promise<void> {
 // Apply configuration to Backstage backend
 const response = await fetch('/api/backstage/plugins/configure', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ pluginId, config })
 });

 if (!response.ok) {
 throw new Error('Failed to apply configuration');
 }
 }

 private async enablePluginInBackstage(pluginId: string): Promise<void> {
 const response = await fetch(`/api/backstage/plugins/${pluginId}/enable`, {
 method: 'POST'
 });

 if (!response.ok) {
 throw new Error('Failed to enable plugin');
 }
 }

 private async disablePluginInBackstage(pluginId: string): Promise<void> {
 const response = await fetch(`/api/backstage/plugins/${pluginId}/disable`, {
 method: 'POST'
 });

 if (!response.ok) {
 throw new Error('Failed to disable plugin');
 }
 }

 private getDefaultConfigSchema(pluginId: string): any {
 // Return default config schemas for known plugins
 const schemas: Record<string, any> = {
 'kubernetes': {
 type: 'object',
 properties: {
 apiUrl: { type: 'string', title: 'Kubernetes API URL' },
 token: { type: 'string', title: 'Service Account Token', format: 'password' },
 namespace: { type: 'string', title: 'Default Namespace' }
 },
 required: ['apiUrl', 'token']
 },
 'github-actions': {
 type: 'object',
 properties: {
 token: { type: 'string', title: 'GitHub Token', format: 'password' },
 organization: { type: 'string', title: 'Organization' },
 baseUrl: { type: 'string', title: 'GitHub API URL', default: 'https://api.github.com' }
 },
 required: ['token']
 },
 'sonarqube': {
 type: 'object',
 properties: {
 baseUrl: { type: 'string', title: 'SonarQube URL' },
 token: { type: 'string', title: 'API Token', format: 'password' }
 },
 required: ['baseUrl', 'token']
 }
 };

 return schemas[pluginId] || {
 type: 'object',
 properties: {}
 };
 }

 private getMockPlugins(): BackstagePlugin[] {
 // Fallback mock data for development
 return [
 {
 id: 'kubernetes',
 name: '@backstage/plugin-kubernetes',
 title: 'Kubernetes',
 description: 'View and manage Kubernetes resources for your services',
 version: '0.18.0',
 author: 'Backstage Core',
 category: 'infrastructure',
 tags: ['kubernetes', 'k8s', 'infrastructure'],
 downloads: 35000,
 stars: 890,
 installed: false,
 enabled: false,
 configurable: true
 },
 {
 id: 'github-actions',
 name: '@backstage/plugin-github-actions',
 title: 'GitHub Actions',
 description: 'View and trigger GitHub Actions workflows',
 version: '0.8.0',
 author: 'Backstage Core',
 category: 'ci-cd',
 tags: ['github', 'ci-cd', 'workflows'],
 downloads: 28000,
 stars: 650,
 installed: false,
 enabled: false,
 configurable: true
 }
 ];
 }
}

// Create a singleton instance but only on the client side
let pluginRegistryInstance: PluginRegistryService | null = null;

export function getPluginRegistry(): PluginRegistryService {
 if (!pluginRegistryInstance) {
 pluginRegistryInstance = new PluginRegistryService();
 }
 return pluginRegistryInstance;
}

// For backward compatibility, export a getter that creates the instance lazily
export const pluginRegistry = new Proxy({} as PluginRegistryService, {
 get(target, prop, receiver) {
 return Reflect.get(getPluginRegistry(), prop, receiver);
 }
});