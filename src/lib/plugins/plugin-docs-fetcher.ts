/**
 * Plugin Documentation Fetcher
 * Fetches plugin documentation from various sources (npm, GitHub, etc.)
 */

import { pluginDocsParser, ParsedPluginDocs } from './plugin-docs-parser';
import { PluginConfigSchema } from './plugin-configs';

export interface PluginDocsSources {
 readme?: string;
 packageJson?: any;
 backstageConfig?: any;
 npmData?: any;
 githubData?: any;
}

export class PluginDocsFetcher {
 private readonly cache = new Map<string, PluginConfigSchema>();
 private readonly cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours

 /**
 * Fetch and parse plugin documentation to generate configuration schema
 */
 async fetchPluginDocs(pluginName: string, version?: string): Promise<PluginConfigSchema | null> {
 const cacheKey = `${pluginName}@${version || 'latest'}`;
 
 // Check cache first
 if (this.cache.has(cacheKey)) {
 return this.cache.get(cacheKey)!;
 }

 try {
 console.log(`Fetching documentation for plugin: ${pluginName}`);
 
 // Fetch from multiple sources
 const sources = await this.fetchFromAllSources(pluginName, version);
 
 // Parse documentation
 const parsedDocs = await pluginDocsParser.parsePluginDocumentation(
 pluginName,
 version || 'latest',
 sources
 );

 if (!parsedDocs) {
 console.warn(`Failed to parse documentation for plugin: ${pluginName}`);
 return null;
 }

 // Generate configuration schema
 const configSchema = pluginDocsParser.generateConfigSchema(parsedDocs);
 
 // Cache the result
 this.cache.set(cacheKey, configSchema);
 
 return configSchema;
 } catch (error) {
 console.error(`Failed to fetch plugin documentation for ${pluginName}:`, error);
 return null;
 }
 }

 /**
 * Fetch documentation from all available sources
 */
 private async fetchFromAllSources(pluginName: string, version?: string): Promise<PluginDocsSources> {
 const sources: PluginDocsSources = {};

 try {
 // Fetch from npm registry
 const npmData = await this.fetchFromNpm(pluginName, version);
 sources.npmData = npmData;
 sources.packageJson = npmData?.versions?.[version || npmData['dist-tags']?.latest];

 // Fetch README from npm
 if (sources.packageJson?.readme) {
 sources.readme = sources.packageJson.readme;
 }

 // Fetch from GitHub if repository URL is available
 const repoUrl = this.extractGitHubUrl(sources.packageJson);
 if (repoUrl) {
 const githubData = await this.fetchFromGitHub(repoUrl);
 sources.githubData = githubData;
 
 // Use GitHub README if npm README is not available
 if (!sources.readme && githubData?.readme) {
 sources.readme = githubData.readme;
 }
 }

 // Try to fetch Backstage configuration schema
 sources.backstageConfig = await this.fetchBackstageConfig(pluginName);

 } catch (error) {
 console.warn(`Some sources failed for plugin ${pluginName}:`, error);
 }

 return sources;
 }

 /**
 * Fetch plugin data from npm registry
 */
 private async fetchFromNpm(pluginName: string, version?: string): Promise<any> {
 try {
 const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pluginName)}`, {
 cache: 'force-cache',
 signal: AbortSignal.timeout(5000)
 });

 if (!response.ok) {
 throw new Error(`NPM fetch failed: ${response.status}`);
 }

 return await response.json();
 } catch (error) {
 console.warn(`Failed to fetch from npm for ${pluginName}:`, error);
 return null;
 }
 }

 /**
 * Fetch documentation from GitHub repository
 */
 private async fetchFromGitHub(repoUrl: string): Promise<any> {
 try {
 // Parse GitHub URL to get owner/repo
 const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
 if (!match) return null;

 const [, owner, repo] = match;
 const cleanRepo = repo.replace(/\.git$/, '');

 // Fetch repository information
 const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}`, {
 cache: 'force-cache',
 signal: AbortSignal.timeout(5000)
 });

 if (!repoResponse.ok) {
 throw new Error(`GitHub API failed: ${repoResponse.status}`);
 }

 const repoData = await repoResponse.json();

 // Fetch README
 let readme = null;
 try {
 const readmeResponse = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/readme`, {
 cache: 'force-cache',
 signal: AbortSignal.timeout(5000)
 });

 if (readmeResponse.ok) {
 const readmeData = await readmeResponse.json();
 readme = atob(readmeData.content); // Decode base64 content
 }
 } catch (error) {
 console.warn(`Failed to fetch README from GitHub for ${owner}/${cleanRepo}:`, error);
 }

 return {
 ...repoData,
 readme
 };
 } catch (error) {
 console.warn(`Failed to fetch from GitHub for ${repoUrl}:`, error);
 return null;
 }
 }

 /**
 * Fetch Backstage-specific configuration schema
 */
 private async fetchBackstageConfig(pluginName: string): Promise<any> {
 try {
 // Try to fetch from Backstage plugin registry or documentation
 const backstageDocsUrl = `https://backstage.io/docs/plugins/${pluginName}`;
 
 const response = await fetch(backstageDocsUrl, {
 cache: 'force-cache',
 signal: AbortSignal.timeout(5000)
 });

 if (response.ok) {
 const html = await response.text();
 return this.parseBackstageDocsHtml(html);
 }
 } catch (error) {
 console.warn(`Failed to fetch Backstage config for ${pluginName}:`, error);
 }

 return null;
 }

 /**
 * Parse Backstage documentation HTML for configuration info
 */
 private parseBackstageDocsHtml(html: string): any {
 // This would parse the Backstage documentation HTML
 // to extract configuration schemas and examples
 
 // For now, return null as this would require complex HTML parsing
 return null;
 }

 /**
 * Extract GitHub repository URL from package.json
 */
 private extractGitHubUrl(packageJson: any): string | null {
 if (!packageJson) return null;

 // Check various possible locations for repository URL
 const repoUrl = packageJson.repository?.url || 
 packageJson.repository || 
 packageJson.homepage ||
 packageJson.bugs?.url;

 if (typeof repoUrl === 'string' && repoUrl.includes('github.com')) {
 return repoUrl;
 }

 return null;
 }

 /**
 * Batch fetch documentation for multiple plugins
 */
 async fetchMultiplePluginDocs(plugins: Array<{ name: string; version?: string }>): Promise<Map<string, PluginConfigSchema | null>> {
 const results = new Map<string, PluginConfigSchema | null>();
 
 // Process in batches to avoid overwhelming external APIs
 const batchSize = 5;
 for (let i = 0; i < plugins.length; i += batchSize) {
 const batch = plugins.slice(i, i + batchSize);
 
 const batchPromises = batch.map(async plugin => {
 const schema = await this.fetchPluginDocs(plugin.name, plugin.version);
 return { plugin, schema };
 });

 const batchResults = await Promise.allSettled(batchPromises);
 
 for (const result of batchResults) {
 if (result.status === 'fulfilled') {
 results.set(result.value.plugin.name, result.value.schema);
 } else {
 console.error(`Failed to fetch docs for plugin:`, result.reason);
 results.set('unknown', null);
 }
 }

 // Add small delay between batches
 if (i + batchSize < plugins.length) {
 await new Promise(resolve => setTimeout(resolve, 1000));
 }
 }

 return results;
 }

 /**
 * Clear cache for a specific plugin or all plugins
 */
 clearCache(pluginName?: string): void {
 if (pluginName) {
 // Clear cache for specific plugin (all versions)
 for (const key of this.cache.keys()) {
 if (key.startsWith(pluginName)) {
 this.cache.delete(key);
 }
 }
 } else {
 // Clear all cache
 this.cache.clear();
 }
 }

 /**
 * Get cached schemas
 */
 getCachedSchemas(): Map<string, PluginConfigSchema> {
 return new Map(this.cache);
 }

 /**
 * Check if plugin documentation is cached
 */
 isCached(pluginName: string, version?: string): boolean {
 const cacheKey = `${pluginName}@${version || 'latest'}`;
 return this.cache.has(cacheKey);
 }

 /**
 * Generate fallback configuration schema for unknown plugins
 */
 generateFallbackSchema(pluginName: string, version?: string): PluginConfigSchema {
 const pluginId = pluginName
 .replace('@backstage/plugin-', '')
 .replace('@roadiehq/backstage-plugin-', '')
 .replace('backstage-plugin-', '')
 .replace(/-/g, '-');

 return {
 pluginId,
 pluginName: pluginId.split('-').map(word => 
 word.charAt(0).toUpperCase() + word.slice(1)
 ).join(' '),
 version: version || '1.0.0',
 description: `Configuration for ${pluginName}`,
 documentationUrl: `https://www.npmjs.com/package/${pluginName}`,
 sections: [{
 title: 'Basic Configuration',
 description: 'Basic configuration options for this plugin',
 fields: [
 {
 name: 'enabled',
 label: 'Enable Plugin',
 type: 'boolean',
 required: false,
 description: 'Enable or disable this plugin',
 defaultValue: true
 },
 {
 name: 'baseUrl',
 label: 'Base URL',
 type: 'url',
 required: false,
 description: 'Base URL for the service (if applicable)',
 placeholder: 'https://api.example.com'
 }
 ]
 }],
 environmentVariables: [],
 requiredIntegrations: []
 };
 }
}

// Export singleton instance
export const pluginDocsFetcher = new PluginDocsFetcher();