// Client-side plugin registry that safely handles browser APIs
import type { BackstagePlugin, PluginConfiguration, PluginInstallationStatus } from './plugin-registry';

class PluginRegistryClient {
 private baseUrl: string;
 private npmRegistry = 'https://registry.npmjs.org';
 
 constructor() {
 this.baseUrl = process.env.NEXT_PUBLIC_BACKSTAGE_REGISTRY_URL || 'https://backstage.io/api';
 }

 // Safe localStorage access
 private getStorage(key: string): string | null {
 if (typeof window === 'undefined') return null;
 try {
 return localStorage.getItem(key);
 } catch {
 return null;
 }
 }

 private setStorage(key: string, value: string): void {
 if (typeof window === 'undefined') return;
 try {
 localStorage.setItem(key, value);
 } catch {
 console.error('Failed to save to localStorage');
 }
 }

 private removeStorage(key: string): void {
 if (typeof window === 'undefined') return;
 try {
 localStorage.removeItem(key);
 } catch {
 console.error('Failed to remove from localStorage');
 }
 }

 // Check if plugin is installed (client-side only)
 isPluginInstalled(pluginId: string): boolean {
 return this.getStorage(`plugin-installed-${pluginId}`) === 'true';
 }

 // Check if plugin is enabled (client-side only)
 isPluginEnabled(pluginId: string): boolean {
 return this.getStorage(`plugin-enabled-${pluginId}`) === 'true';
 }

 // Get plugin configuration (client-side only)
 getPluginConfig(pluginId: string): any {
 const config = this.getStorage(`plugin-config-${pluginId}`);
 if (!config) return null;
 try {
 return JSON.parse(config);
 } catch {
 return null;
 }
 }

 // Save plugin state (client-side only)
 savePluginState(pluginId: string, installed: boolean, enabled: boolean, config?: any): void {
 if (installed) {
 this.setStorage(`plugin-installed-${pluginId}`, 'true');
 this.setStorage(`plugin-enabled-${pluginId}`, enabled.toString());
 if (config) {
 this.setStorage(`plugin-config-${pluginId}`, JSON.stringify(config));
 }
 } else {
 this.removeStorage(`plugin-installed-${pluginId}`);
 this.removeStorage(`plugin-enabled-${pluginId}`);
 this.removeStorage(`plugin-config-${pluginId}`);
 }
 }
}

// Export a function to get the client instance
let clientInstance: PluginRegistryClient | null = null;

export function getPluginRegistryClient(): PluginRegistryClient {
 if (!clientInstance) {
 clientInstance = new PluginRegistryClient();
 }
 return clientInstance;
}