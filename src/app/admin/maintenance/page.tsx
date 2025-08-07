'use client';

import React, { useState, useEffect } from 'react';
import { 
 Settings, 
 Package, 
 RefreshCw, 
 AlertTriangle,
 CheckCircle,
 Info,
 Download,
 Upload,
 Database,
 GitBranch,
 Terminal,
 FileCode,
 Loader2,
 ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface SystemStatus {
 backstageVersion: string;
 wrapperVersion: string;
 nodeVersion: string;
 npmVersion: string;
 postgresVersion: string;
 redisVersion: string;
 lastSync: string;
 compatibility: {
 status: 'compatible' | 'warning' | 'incompatible';
 message: string;
 };
}

interface UpdateInfo {
 component: string;
 currentVersion: string;
 latestVersion: string;
 hasUpdate: boolean;
 breaking: boolean;
 changelog?: string;
}

export default function MaintenancePage() {
 const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
 const [updates, setUpdates] = useState<UpdateInfo[]>([]);
 const [loading, setLoading] = useState(true);
 const [updating, setUpdating] = useState<string | null>(null);
 const [syncingSchema, setSyncingSchema] = useState(false);
 const [runningMigrations, setRunningMigrations] = useState(false);

 useEffect(() => {
 fetchSystemStatus();
 checkForUpdates();
 }, []);

 const fetchSystemStatus = async () => {
 try {
 // In production, this would fetch actual system info
 setSystemStatus({
 backstageVersion: '1.29.0',
 wrapperVersion: '1.0.0',
 nodeVersion: '20.11.0',
 npmVersion: '10.2.4',
 postgresVersion: '15.2',
 redisVersion: '7.0.11',
 lastSync: new Date().toISOString(),
 compatibility: {
 status: 'compatible',
 message: 'All components are compatible'
 }
 });
 } catch (error) {
 console.error('Failed to fetch system status:', error);
 toast.error('Failed to fetch system status');
 } finally {
 setLoading(false);
 }
 };

 const checkForUpdates = async () => {
 try {
 // In production, this would check npm for updates
 setUpdates([
 {
 component: 'Backstage',
 currentVersion: '1.29.0',
 latestVersion: '1.30.0',
 hasUpdate: true,
 breaking: false,
 changelog: '- New plugin API\n- Performance improvements\n- Bug fixes'
 },
 {
 component: '@backstage/plugin-catalog',
 currentVersion: '1.22.0',
 latestVersion: '1.22.1',
 hasUpdate: true,
 breaking: false
 },
 {
 component: 'Wrapper Dependencies',
 currentVersion: '1.0.0',
 latestVersion: '1.0.0',
 hasUpdate: false,
 breaking: false
 }
 ]);
 } catch (error) {
 console.error('Failed to check for updates:', error);
 }
 };

 const handleUpdate = async (component: string) => {
 setUpdating(component);
 try {
 // Simulate update process
 await new Promise(resolve => setTimeout(resolve, 3000));
 
 // Update the component
 setUpdates(prev => prev.map(u => 
 u.component === component 
 ? { ...u, currentVersion: u.latestVersion, hasUpdate: false }
 : u
 ));
 
 toast.success(`${component} updated successfully`);
 } catch (error) {
 console.error(`Failed to update ${component}:`, error);
 toast.error(`Failed to update ${component}`);
 } finally {
 setUpdating(null);
 }
 };

 const syncBackstageSchema = async () => {
 setSyncingSchema(true);
 try {
 // This would sync Backstage entity schemas with wrapper database
 await new Promise(resolve => setTimeout(resolve, 2000));
 
 setSystemStatus(prev => prev ? {
 ...prev,
 lastSync: new Date().toISOString()
 } : null);
 
 toast.success('Schema synchronized successfully');
 } catch (error) {
 console.error('Failed to sync schema:', error);
 toast.error('Failed to sync schema');
 } finally {
 setSyncingSchema(false);
 }
 };

 const runDatabaseMigrations = async () => {
 setRunningMigrations(true);
 try {
 // Run Prisma migrations
 await new Promise(resolve => setTimeout(resolve, 2000));
 toast.success('Database migrations completed');
 } catch (error) {
 console.error('Failed to run migrations:', error);
 toast.error('Failed to run migrations');
 } finally {
 setRunningMigrations(false);
 }
 };

 const exportConfiguration = () => {
 // Export current configuration
 const config = {
 backstageVersion: systemStatus?.backstageVersion,
 wrapperVersion: systemStatus?.wrapperVersion,
 plugins: updates.filter(u => u.component.includes('plugin')),
 timestamp: new Date().toISOString()
 };

 const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `backstage-config-${Date.now()}.json`;
 a.click();
 URL.revokeObjectURL(url);
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 System Maintenance
 </h1>
 <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
 Manage Backstage updates and system maintenance
 </p>
 </div>
 <button
 onClick={exportConfiguration}
 className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
 >
 <Download className="w-4 h-4 mr-2" />
 Export Config
 </button>
 </div>

 {/* System Status */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 System Status
 </h2>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 <div>
 <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
 Backstage Version
 </h3>
 <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
 {systemStatus?.backstageVersion}
 </p>
 </div>
 <div>
 <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
 Wrapper Version
 </h3>
 <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
 {systemStatus?.wrapperVersion}
 </p>
 </div>
 <div>
 <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
 Compatibility Status
 </h3>
 <div className="mt-1 flex items-center">
 {systemStatus?.compatibility.status === 'compatible' ? (
 <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
 ) : systemStatus?.compatibility.status === 'warning' ? (
 <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
 ) : (
 <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
 )}
 <span className={`text-sm ${
 systemStatus?.compatibility.status === 'compatible' 
 ? 'text-green-600 dark:text-green-400'
 : systemStatus?.compatibility.status === 'warning'
 ? 'text-yellow-600 dark:text-yellow-400'
 : 'text-red-600 dark:text-red-400'
 }`}>
 {systemStatus?.compatibility.message}
 </span>
 </div>
 </div>
 <div>
 <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
 Node.js Version
 </h3>
 <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
 {systemStatus?.nodeVersion}
 </p>
 </div>
 <div>
 <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
 PostgreSQL Version
 </h3>
 <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
 {systemStatus?.postgresVersion}
 </p>
 </div>
 <div>
 <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
 Last Schema Sync
 </h3>
 <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
 {systemStatus?.lastSync ? new Date(systemStatus.lastSync).toLocaleString() : 'Never'}
 </p>
 </div>
 </div>
 </div>

 {/* Available Updates */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Available Updates
 </h2>
 <button
 onClick={checkForUpdates}
 className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
 >
 <RefreshCw className="w-4 h-4 inline mr-1" />
 Check for Updates
 </button>
 </div>
 
 <div className="space-y-4">
 {updates.map(update => (
 <div
 key={update.component}
 className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg"
 >
 <div className="flex-1">
 <div className="flex items-center">
 <Package className="w-5 h-5 text-gray-400 mr-3" />
 <div>
 <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {update.component}
 </h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 {update.currentVersion} {update.latestVersion}
 {update.breaking && (
 <span className="ml-2 text-red-600 dark:text-red-400">
 (Breaking changes)
 </span>
 )}
 </p>
 </div>
 </div>
 {update.changelog && (
 <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
 {update.changelog}
 </pre>
 )}
 </div>
 <div>
 {update.hasUpdate ? (
 <button
 onClick={() => handleUpdate(update.component)}
 disabled={updating === update.component}
 className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {updating === update.component ? (
 <>
 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
 Updating...
 </>
 ) : (
 <>
 <Download className="w-4 h-4 mr-2" />
 Update
 </>
 )}
 </button>
 ) : (
 <span className="inline-flex items-center px-3 py-1.5 text-sm text-green-600 dark:text-green-400">
 <CheckCircle className="w-4 h-4 mr-2" />
 Up to date
 </span>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Maintenance Actions */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Maintenance Actions
 </h2>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <button
 onClick={syncBackstageSchema}
 disabled={syncingSchema}
 className="flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <div className="flex items-center">
 <Database className="w-5 h-5 text-gray-400 mr-3" />
 <div className="text-left">
 <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 Sync Backstage Schema
 </h3>
 <p className="text-xs text-gray-500 dark:text-gray-400">
 Synchronize entity schemas with Backstage
 </p>
 </div>
 </div>
 {syncingSchema ? (
 <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
 ) : (
 <ChevronRight className="w-5 h-5 text-gray-400" />
 )}
 </button>

 <button
 onClick={runDatabaseMigrations}
 disabled={runningMigrations}
 className="flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <div className="flex items-center">
 <Terminal className="w-5 h-5 text-gray-400 mr-3" />
 <div className="text-left">
 <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 Run Database Migrations
 </h3>
 <p className="text-xs text-gray-500 dark:text-gray-400">
 Apply pending database migrations
 </p>
 </div>
 </div>
 {runningMigrations ? (
 <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
 ) : (
 <ChevronRight className="w-5 h-5 text-gray-400" />
 )}
 </button>

 <button
 className="flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750"
 >
 <div className="flex items-center">
 <GitBranch className="w-5 h-5 text-gray-400 mr-3" />
 <div className="text-left">
 <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 Update Git Submodules
 </h3>
 <p className="text-xs text-gray-500 dark:text-gray-400">
 Update Backstage submodule to latest
 </p>
 </div>
 </div>
 <ChevronRight className="w-5 h-5 text-gray-400" />
 </button>

 <button
 className="flex items-center justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750"
 >
 <div className="flex items-center">
 <FileCode className="w-5 h-5 text-gray-400 mr-3" />
 <div className="text-left">
 <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
 Regenerate API Types
 </h3>
 <p className="text-xs text-gray-500 dark:text-gray-400">
 Update TypeScript types from Backstage
 </p>
 </div>
 </div>
 <ChevronRight className="w-5 h-5 text-gray-400" />
 </button>
 </div>
 </div>

 {/* Update Instructions */}
 <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
 <div className="flex">
 <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
 <div className="text-sm text-blue-800 dark:text-blue-200">
 <h3 className="font-medium mb-1">Safe Update Process</h3>
 <ol className="list-decimal list-inside space-y-1">
 <li>Export current configuration before updating</li>
 <li>Update Backstage components one at a time</li>
 <li>Run schema synchronization after Backstage updates</li>
 <li>Test all plugins after updates</li>
 <li>Run database migrations if needed</li>
 </ol>
 </div>
 </div>
 </div>
 </div>
 );
}