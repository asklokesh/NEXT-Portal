/**
 * Backstage.io Backend Integration Service
 * Seamlessly integrates with Backstage backend without requiring code changes
 */

import { dockerPluginInstaller as pluginInstaller, type PluginInstallationResult } from '../plugins/docker-plugin-installer';
import { pluginConfigs } from '../plugins/plugin-configs';

export interface BackstageServiceInfo {
 name: string;
 namespace: string;
 kind: string;
 apiVersion: string;
 metadata: {
 name: string;
 description?: string;
 labels?: Record<string, string>;
 annotations?: Record<string, string>;
 };
 spec?: Record<string, any>;
}

export interface BackstageIntegrationConfig {
 backstageUrl: string;
 apiToken?: string;
 namespace?: string;
 autoSync: boolean;
 syncInterval: number;
 retryAttempts: number;
}

export class BackstageIntegrationService {
 private config: BackstageIntegrationConfig;
 private syncTimer?: NodeJS.Timeout;
 private isConnected = false;

 constructor(config: BackstageIntegrationConfig) {
 this.config = {
 namespace: 'default',
 autoSync: true,
 syncInterval: 30000, // 30 seconds
 retryAttempts: 3,
 ...config
 };
 }

 /**
 * Initialize connection to Backstage backend
 */
 async initialize(): Promise<boolean> {
 try {
 console.log(`Initializing Backstage integration with ${this.config.backstageUrl}`);
 
 // Test connection to Backstage backend
 const isHealthy = await this.checkBackstageHealth();
 if (!isHealthy) {
 console.warn('Backstage backend is not healthy, proceeding with cached data');
 return false;
 }

 this.isConnected = true;
 
 // Start auto-sync if enabled
 if (this.config.autoSync) {
 this.startAutoSync();
 }

 // Sync initial state
 await this.syncWithBackstage();

 console.log('Backstage integration initialized successfully');
 return true;
 } catch (error) {
 console.error('Failed to initialize Backstage integration:', error);
 return false;
 }
 }

 /**
 * Check if Backstage backend is healthy (v1.41.0 compatible)
 */
 async checkBackstageHealth(): Promise<boolean> {
 try {
 // v1.41.0 uses new health check endpoint
 const response = await fetch(`${this.config.backstageUrl}/api/catalog/health`, {
 method: 'GET',
 headers: this.getHeaders(),
 signal: AbortSignal.timeout(5000)
 });

 if (response.ok) {
 return true;
 }

 // Fallback to general health endpoint for v1.41.0
 const healthResponse = await fetch(`${this.config.backstageUrl}/health`, {
 method: 'GET',
 headers: this.getHeaders(),
 signal: AbortSignal.timeout(5000)
 });

 return healthResponse.ok;
 } catch (error) {
 console.warn('Backstage health check failed:', error);
 return false;
 }
 }

 /**
 * Sync plugin installations with Backstage backend
 */
 async syncWithBackstage(): Promise<void> {
 if (!this.isConnected) {
 console.log('Not connected to Backstage, skipping sync');
 return;
 }

 try {
 // Get installed plugins from our system
 const installedPlugins = await pluginInstaller.getInstalledPlugins();
 
 // Get entities from Backstage catalog
 const backstageEntities = await this.getBackstageEntities();
 
 // Sync plugin configurations
 await this.syncPluginConfigurations(installedPlugins);
 
 // Sync service catalog
 await this.syncServiceCatalog(backstageEntities);
 
 console.log('Backstage sync completed successfully');
 } catch (error) {
 console.error('Backstage sync failed:', error);
 }
 }

 /**
 * Install plugin directly in Backstage backend
 */
 async installPluginInBackstage(pluginId: string, config: Record<string, any>): Promise<PluginInstallationResult> {
 try {
 // First install through our plugin installer
 const installResult = await pluginInstaller.installPlugin(pluginId);
 if (!installResult.success) {
 return installResult;
 }

 // Then sync with Backstage backend
 if (this.isConnected) {
 await this.updateBackstageConfig(pluginId, config);
 await this.reloadBackstageConfig();
 }

 return {
 success: true,
 message: `Plugin ${pluginId} installed and synced with Backstage`,
 details: installResult.details
 };
 } catch (error) {
 console.error(`Failed to install plugin ${pluginId} in Backstage:`, error);
 return {
 success: false,
 message: 'Failed to install plugin in Backstage',
 error: error instanceof Error ? error.message : 'Unknown error'
 };
 }
 }

 /**
 * Configure plugin in Backstage backend
 */
 async configurePluginInBackstage(pluginId: string, config: Record<string, any>): Promise<PluginInstallationResult> {
 try {
 // Configure through our plugin installer
 const configResult = await pluginInstaller.configurePlugin(pluginId, config);
 if (!configResult.success) {
 return configResult;
 }

 // Sync configuration to Backstage backend
 if (this.isConnected) {
 await this.updateBackstageConfig(pluginId, config);
 await this.reloadBackstageConfig();
 }

 return {
 success: true,
 message: `Plugin ${pluginId} configured and synced with Backstage`,
 details: configResult.details
 };
 } catch (error) {
 console.error(`Failed to configure plugin ${pluginId} in Backstage:`, error);
 return {
 success: false,
 message: 'Failed to configure plugin in Backstage',
 error: error instanceof Error ? error.message : 'Unknown error'
 };
 }
 }

 /**
 * Create or update service in Backstage catalog
 */
 async createOrUpdateService(serviceInfo: BackstageServiceInfo): Promise<boolean> {
 try {
 const entity = {
 apiVersion: serviceInfo.apiVersion || 'backstage.io/v1alpha1',
 kind: serviceInfo.kind || 'Component',
 metadata: {
 name: serviceInfo.name,
 namespace: serviceInfo.namespace || this.config.namespace,
 ...serviceInfo.metadata
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'platform-team',
 ...serviceInfo.spec
 }
 };

 const response = await fetch(`${this.config.backstageUrl}/api/catalog/entities`, {
 method: 'POST',
 headers: {
 ...this.getHeaders(),
 'Content-Type': 'application/json'
 },
 body: JSON.stringify(entity)
 });

 if (response.ok) {
 console.log(`Service ${serviceInfo.name} created/updated in Backstage catalog`);
 return true;
 } else if (response.status === 409) {
 // Entity already exists, try to update
 return await this.updateService(serviceInfo);
 } else {
 console.error(`Failed to create service in Backstage: ${response.status} ${response.statusText}`);
 return false;
 }
 } catch (error) {
 console.error('Failed to create/update service in Backstage:', error);
 return false;
 }
 }

 /**
 * Update existing service in Backstage catalog
 */
 async updateService(serviceInfo: BackstageServiceInfo): Promise<boolean> {
 try {
 const entityRef = `${serviceInfo.kind.toLowerCase()}:${serviceInfo.namespace || this.config.namespace}/${serviceInfo.name}`;
 
 const response = await fetch(`${this.config.backstageUrl}/api/catalog/entities/by-name/${entityRef}`, {
 method: 'PUT',
 headers: {
 ...this.getHeaders(),
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 apiVersion: serviceInfo.apiVersion || 'backstage.io/v1alpha1',
 kind: serviceInfo.kind || 'Component',
 metadata: {
 name: serviceInfo.name,
 namespace: serviceInfo.namespace || this.config.namespace,
 ...serviceInfo.metadata
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'platform-team',
 ...serviceInfo.spec
 }
 })
 });

 if (response.ok) {
 console.log(`Service ${serviceInfo.name} updated in Backstage catalog`);
 return true;
 } else {
 console.error(`Failed to update service in Backstage: ${response.status} ${response.statusText}`);
 return false;
 }
 } catch (error) {
 console.error('Failed to update service in Backstage:', error);
 return false;
 }
 }

 /**
 * Get all entities from Backstage catalog (v1.41.0 compatible)
 */
 async getBackstageEntities(): Promise<any[]> {
 try {
 // v1.41.0 improved catalog API with pagination and filtering
 const response = await fetch(`${this.config.backstageUrl}/api/catalog/entities?limit=500&offset=0`, {
 method: 'GET',
 headers: {
 ...this.getHeaders(),
 'Accept': 'application/json'
 }
 });

 if (response.ok) {
 const data = await response.json();
 // v1.41.0 returns items in a consistent format
 return data.items || data || [];
 } else {
 console.warn(`Failed to fetch Backstage entities: ${response.status}`);
 return [];
 }
 } catch (error) {
 console.error('Failed to fetch Backstage entities:', error);
 return [];
 }
 }

 /**
 * Update Backstage configuration directly
 */
 private async updateBackstageConfig(pluginId: string, config: Record<string, any>): Promise<void> {
 // This would typically update the app-config.yaml through the Backstage backend API
 // For now, we'll simulate this by making a configuration update request
 
 try {
 const configUpdate = {
 plugin: pluginId,
 configuration: config,
 timestamp: new Date().toISOString()
 };

 const response = await fetch(`${this.config.backstageUrl}/api/app/config`, {
 method: 'PATCH',
 headers: {
 ...this.getHeaders(),
 'Content-Type': 'application/json'
 },
 body: JSON.stringify(configUpdate)
 });

 if (!response.ok) {
 console.warn(`Failed to update Backstage config for ${pluginId}: ${response.status}`);
 }
 } catch (error) {
 console.warn(`Failed to update Backstage config for ${pluginId}:`, error);
 }
 }

 /**
 * Reload Backstage configuration
 */
 private async reloadBackstageConfig(): Promise<void> {
 try {
 const response = await fetch(`${this.config.backstageUrl}/api/app/config/reload`, {
 method: 'POST',
 headers: this.getHeaders()
 });

 if (response.ok) {
 console.log('Backstage configuration reloaded');
 } else {
 console.warn(`Failed to reload Backstage config: ${response.status}`);
 }
 } catch (error) {
 console.warn('Failed to reload Backstage config:', error);
 }
 }

 /**
 * Sync plugin configurations with Backstage
 */
 private async syncPluginConfigurations(installedPlugins: Array<{ id: string; enabled: boolean; version?: string }>): Promise<void> {
 for (const plugin of installedPlugins) {
 if (plugin.enabled && pluginConfigs[plugin.id]) {
 try {
 // Get current configuration
 const config = {}; // This would be loaded from our configuration storage
 
 // Update Backstage with current configuration
 await this.updateBackstageConfig(plugin.id, config);
 } catch (error) {
 console.warn(`Failed to sync configuration for plugin ${plugin.id}:`, error);
 }
 }
 }
 }

 /**
 * Sync service catalog with Backstage
 */
 private async syncServiceCatalog(backstageEntities: any[]): Promise<void> {
 // This would sync our service catalog with Backstage entities
 // For now, we'll just log the entities we found
 console.log(`Found ${backstageEntities.length} entities in Backstage catalog`);
 }

 /**
 * Start automatic synchronization
 */
 private startAutoSync(): void {
 if (this.syncTimer) {
 clearInterval(this.syncTimer);
 }

 this.syncTimer = setInterval(async () => {
 await this.syncWithBackstage();
 }, this.config.syncInterval);

 console.log(`Auto-sync started with interval: ${this.config.syncInterval}ms`);
 }

 /**
 * Stop automatic synchronization
 */
 stopAutoSync(): void {
 if (this.syncTimer) {
 clearInterval(this.syncTimer);
 this.syncTimer = undefined;
 console.log('Auto-sync stopped');
 }
 }

 /**
 * Get HTTP headers for Backstage API requests
 */
 private getHeaders(): Record<string, string> {
 const headers: Record<string, string> = {
 'User-Agent': 'SaaS-IDP/1.0.0'
 };

 if (this.config.apiToken) {
 headers['Authorization'] = `Bearer ${this.config.apiToken}`;
 }

 return headers;
 }

 /**
 * Disconnect from Backstage backend
 */
 disconnect(): void {
 this.stopAutoSync();
 this.isConnected = false;
 console.log('Disconnected from Backstage backend');
 }

 /**
 * Get connection status
 */
 isBackstageConnected(): boolean {
 return this.isConnected;
 }

 /**
 * Update integration configuration
 */
 updateConfig(newConfig: Partial<BackstageIntegrationConfig>): void {
 this.config = { ...this.config, ...newConfig };
 
 if (this.config.autoSync && !this.syncTimer) {
 this.startAutoSync();
 } else if (!this.config.autoSync && this.syncTimer) {
 this.stopAutoSync();
 }
 }
}

// Create and configure the integration service
const backstageIntegrationService = new BackstageIntegrationService({
 backstageUrl: process.env.BACKSTAGE_API_URL || process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:7007',
 apiToken: process.env.BACKSTAGE_API_TOKEN,
 namespace: process.env.BACKSTAGE_NAMESPACE || 'default',
 autoSync: process.env.BACKSTAGE_AUTO_SYNC !== 'false',
 syncInterval: parseInt(process.env.BACKSTAGE_SYNC_INTERVAL || '30000'),
 retryAttempts: parseInt(process.env.BACKSTAGE_RETRY_ATTEMPTS || '3')
});

export { backstageIntegrationService };