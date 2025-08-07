/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import type { Dashboard, Widget } from '@/components/dashboard/types';

const STORAGE_KEYS = {
 DASHBOARD: 'platform-dashboard',
 USER_PREFERENCES: 'dashboard-preferences',
 WIDGET_CONFIGS: 'widget-configurations'
} as const;

export interface DashboardPreferences {
 autoSave: boolean;
 autoRefresh: boolean;
 refreshInterval: number;
 theme: 'light' | 'dark' | 'system';
 filterByOwnership: boolean;
 defaultView: 'grid' | 'list';
 compactMode: boolean;
}

export interface WidgetConfig {
 widgetId: string;
 position: { x: number; y: number };
 size: { w: number; h: number };
 customConfig: Record<string, any>;
}

class DashboardPersistenceService {
 private readonly storage: Storage;
 private autoSaveTimer: NodeJS.Timeout | null = null;

 constructor() {
 this.storage = typeof window !== 'undefined' ? localStorage : ({} as Storage);
 }

 // Dashboard persistence
 async saveDashboard(dashboard: Dashboard): Promise<void> {
 try {
 const serialized = JSON.stringify(dashboard);
 this.storage.setItem(STORAGE_KEYS.DASHBOARD, serialized);
 console.log('Dashboard saved to localStorage');
 } catch (error) {
 console.error('Failed to save dashboard:', error);
 throw new Error('Failed to save dashboard configuration');
 }
 }

 async loadDashboard(): Promise<Dashboard | null> {
 try {
 const serialized = this.storage.getItem(STORAGE_KEYS.DASHBOARD);
 if (!serialized) return null;

 const dashboard = JSON.parse(serialized) as Dashboard;
 
 // Validate dashboard structure
 if (!this.validateDashboard(dashboard)) {
 console.warn('Invalid dashboard structure, removing from storage');
 this.storage.removeItem(STORAGE_KEYS.DASHBOARD);
 return null;
 }

 return dashboard;
 } catch (error) {
 console.error('Failed to load dashboard:', error);
 return null;
 }
 }

 async deleteDashboard(): Promise<void> {
 try {
 this.storage.removeItem(STORAGE_KEYS.DASHBOARD);
 console.log('Dashboard deleted from localStorage');
 } catch (error) {
 console.error('Failed to delete dashboard:', error);
 throw new Error('Failed to delete dashboard');
 }
 }

 // Auto-save functionality
 enableAutoSave(dashboard: Dashboard, interval: number = 5000): void {
 this.disableAutoSave();
 
 this.autoSaveTimer = setInterval(() => {
 this.saveDashboard(dashboard).catch(error => {
 console.error('Auto-save failed:', error);
 });
 }, interval);
 }

 disableAutoSave(): void {
 if (this.autoSaveTimer) {
 clearInterval(this.autoSaveTimer);
 this.autoSaveTimer = null;
 }
 }

 // User preferences
 async savePreferences(preferences: Partial<DashboardPreferences>): Promise<void> {
 try {
 const current = await this.loadPreferences();
 const updated = { ...current, ...preferences };
 
 const serialized = JSON.stringify(updated);
 this.storage.setItem(STORAGE_KEYS.USER_PREFERENCES, serialized);
 } catch (error) {
 console.error('Failed to save preferences:', error);
 throw new Error('Failed to save user preferences');
 }
 }

 async loadPreferences(): Promise<DashboardPreferences> {
 try {
 const serialized = this.storage.getItem(STORAGE_KEYS.USER_PREFERENCES);
 if (!serialized) return this.getDefaultPreferences();

 const preferences = JSON.parse(serialized) as DashboardPreferences;
 return { ...this.getDefaultPreferences(), ...preferences };
 } catch (error) {
 console.error('Failed to load preferences:', error);
 return this.getDefaultPreferences();
 }
 }

 private getDefaultPreferences(): DashboardPreferences {
 return {
 autoSave: true,
 autoRefresh: true,
 refreshInterval: 30,
 theme: 'system',
 filterByOwnership: true,
 defaultView: 'grid',
 compactMode: false
 };
 }

 // Widget configurations
 async saveWidgetConfig(widgetId: string, config: WidgetConfig): Promise<void> {
 try {
 const configs = await this.loadAllWidgetConfigs();
 configs[widgetId] = config;
 
 const serialized = JSON.stringify(configs);
 this.storage.setItem(STORAGE_KEYS.WIDGET_CONFIGS, serialized);
 } catch (error) {
 console.error('Failed to save widget config:', error);
 throw new Error('Failed to save widget configuration');
 }
 }

 async loadWidgetConfig(widgetId: string): Promise<WidgetConfig | null> {
 try {
 const configs = await this.loadAllWidgetConfigs();
 return configs[widgetId] || null;
 } catch (error) {
 console.error('Failed to load widget config:', error);
 return null;
 }
 }

 async loadAllWidgetConfigs(): Promise<Record<string, WidgetConfig>> {
 try {
 const serialized = this.storage.getItem(STORAGE_KEYS.WIDGET_CONFIGS);
 if (!serialized) return {};

 return JSON.parse(serialized) as Record<string, WidgetConfig>;
 } catch (error) {
 console.error('Failed to load widget configs:', error);
 return {};
 }
 }

 async deleteWidgetConfig(widgetId: string): Promise<void> {
 try {
 const configs = await this.loadAllWidgetConfigs();
 delete configs[widgetId];
 
 const serialized = JSON.stringify(configs);
 this.storage.setItem(STORAGE_KEYS.WIDGET_CONFIGS, serialized);
 } catch (error) {
 console.error('Failed to delete widget config:', error);
 throw new Error('Failed to delete widget configuration');
 }
 }

 // Export/Import functionality
 async exportDashboard(): Promise<string> {
 try {
 const dashboard = await this.loadDashboard();
 const preferences = await this.loadPreferences();
 const widgetConfigs = await this.loadAllWidgetConfigs();

 const exportData = {
 version: '1.0',
 timestamp: new Date().toISOString(),
 dashboard,
 preferences,
 widgetConfigs
 };

 return JSON.stringify(exportData, null, 2);
 } catch (error) {
 console.error('Failed to export dashboard:', error);
 throw new Error('Failed to export dashboard');
 }
 }

 async importDashboard(importData: string): Promise<void> {
 try {
 const data = JSON.parse(importData);
 
 // Validate import data structure
 if (!data.version || !data.dashboard) {
 throw new Error('Invalid import data format');
 }

 // Import dashboard
 if (data.dashboard && this.validateDashboard(data.dashboard)) {
 await this.saveDashboard(data.dashboard);
 }

 // Import preferences
 if (data.preferences) {
 await this.savePreferences(data.preferences);
 }

 // Import widget configurations
 if (data.widgetConfigs) {
 const serialized = JSON.stringify(data.widgetConfigs);
 this.storage.setItem(STORAGE_KEYS.WIDGET_CONFIGS, serialized);
 }

 console.log('Dashboard imported successfully');
 } catch (error) {
 console.error('Failed to import dashboard:', error);
 throw new Error('Failed to import dashboard: ' + (error as Error).message);
 }
 }

 // Dashboard templates
 async saveAsTemplate(dashboard: Dashboard, templateName: string): Promise<void> {
 try {
 const template = {
 ...dashboard,
 id: `template-${Date.now()}`,
 name: templateName,
 type: 'template' as const,
 createdAt: new Date().toISOString()
 };

 const templates = await this.loadTemplates();
 templates[template.id] = template;

 const serialized = JSON.stringify(templates);
 this.storage.setItem('dashboard-templates', serialized);
 } catch (error) {
 console.error('Failed to save template:', error);
 throw new Error('Failed to save dashboard template');
 }
 }

 async loadTemplates(): Promise<Record<string, Dashboard>> {
 try {
 const serialized = this.storage.getItem('dashboard-templates');
 if (!serialized) return {};

 return JSON.parse(serialized) as Record<string, Dashboard>;
 } catch (error) {
 console.error('Failed to load templates:', error);
 return {};
 }
 }

 // Validation helpers
 private validateDashboard(dashboard: any): dashboard is Dashboard {
 return (
 dashboard &&
 typeof dashboard.id === 'string' &&
 typeof dashboard.name === 'string' &&
 Array.isArray(dashboard.widgets) &&
 dashboard.layout &&
 typeof dashboard.layout.type === 'string'
 );
 }

 // Storage usage information
 getStorageUsage(): {
 used: number;
 available: number;
 percentage: number;
 } {
 try {
 let used = 0;
 
 // Calculate used storage
 Object.values(STORAGE_KEYS).forEach(key => {
 const item = this.storage.getItem(key);
 if (item) {
 used += new Blob([item]).size;
 }
 });

 // Estimate available storage (5MB typical limit for localStorage)
 const available = 5 * 1024 * 1024; // 5MB in bytes
 const percentage = (used / available) * 100;

 return {
 used,
 available,
 percentage: Math.min(percentage, 100)
 };
 } catch (error) {
 console.error('Failed to calculate storage usage:', error);
 return { used: 0, available: 0, percentage: 0 };
 }
 }

 // Clear all dashboard data
 async clearAllData(): Promise<void> {
 try {
 Object.values(STORAGE_KEYS).forEach(key => {
 this.storage.removeItem(key);
 });
 
 // Also clear templates
 this.storage.removeItem('dashboard-templates');
 
 console.log('All dashboard data cleared');
 } catch (error) {
 console.error('Failed to clear data:', error);
 throw new Error('Failed to clear dashboard data');
 }
 }

 // Backup and restore
 async createBackup(): Promise<string> {
 try {
 const backup = {
 version: '1.0',
 timestamp: new Date().toISOString(),
 data: {}
 };

 // Backup all storage keys
 Object.values(STORAGE_KEYS).forEach(key => {
 const item = this.storage.getItem(key);
 if (item) {
 backup.data[key] = JSON.parse(item);
 }
 });

 // Backup templates
 const templates = this.storage.getItem('dashboard-templates');
 if (templates) {
 backup.data['dashboard-templates'] = JSON.parse(templates);
 }

 return JSON.stringify(backup, null, 2);
 } catch (error) {
 console.error('Failed to create backup:', error);
 throw new Error('Failed to create backup');
 }
 }

 async restoreFromBackup(backupData: string): Promise<void> {
 try {
 const backup = JSON.parse(backupData);
 
 if (!backup.version || !backup.data) {
 throw new Error('Invalid backup format');
 }

 // Restore all data
 Object.entries(backup.data).forEach(([key, value]) => {
 if (value) {
 this.storage.setItem(key, JSON.stringify(value));
 }
 });

 console.log('Dashboard restored from backup');
 } catch (error) {
 console.error('Failed to restore from backup:', error);
 throw new Error('Failed to restore from backup: ' + (error as Error).message);
 }
 }
}

export const persistenceService = new DashboardPersistenceService();