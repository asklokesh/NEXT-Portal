'use client';

import React, { useState, useEffect } from 'react';
import {
 RefreshCw,
 CheckCircle,
 XCircle,
 AlertCircle,
 Clock,
 Play,
 Pause,
 Settings,
 GitPullRequest,
 Users,
 Package,
 FileText
} from 'lucide-react';
import { syncService } from '@/services/sync/backstage-sync';
import type { SyncResult, SyncOptions, SyncConflict } from '@/services/sync/backstage-sync';

export default function SyncManager() {
 const [syncStatus, setSyncStatus] = useState({
 inProgress: false,
 lastSyncTime: null as Date | null,
 autoSyncEnabled: false,
 pendingConflicts: 0
 });
 const [lastResult, setLastResult] = useState<SyncResult | null>(null);
 const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
 const [syncOptions, setSyncOptions] = useState<SyncOptions>({
 entities: true,
 templates: true,
 locations: true,
 plugins: false,
 users: true
 });
 const [autoSyncInterval, setAutoSyncInterval] = useState(5);
 const [showSettings, setShowSettings] = useState(false);

 useEffect(() => {
 // Update status periodically
 const interval = setInterval(() => {
 const status = syncService.getSyncStatus();
 setSyncStatus({
 inProgress: status.inProgress,
 lastSyncTime: status.lastSyncTime || null,
 autoSyncEnabled: status.autoSyncEnabled,
 pendingConflicts: status.pendingConflicts
 });
 
 if (status.pendingConflicts > 0) {
 setConflicts(syncService.getConflicts());
 }
 }, 1000);

 return () => clearInterval(interval);
 }, []);

 const handleManualSync = async () => {
 try {
 const result = await syncService.performSync(syncOptions);
 setLastResult(result);
 } catch (error) {
 console.error('Sync failed:', error);
 }
 };

 const toggleAutoSync = () => {
 if (syncStatus.autoSyncEnabled) {
 syncService.stopAutoSync();
 } else {
 syncService.startAutoSync(autoSyncInterval, syncOptions);
 }
 };

 const handleResolveConflict = async (conflictId: string, resolution: 'local' | 'remote' | 'merge') => {
 try {
 await syncService.resolveConflict(conflictId, resolution);
 setConflicts(syncService.getConflicts());
 } catch (error) {
 console.error('Failed to resolve conflict:', error);
 }
 };

 const formatTimeDiff = (date: Date | null) => {
 if (!date) return 'Never';
 const diff = Date.now() - date.getTime();
 const minutes = Math.floor(diff / 60000);
 if (minutes < 1) return 'Just now';
 if (minutes < 60) return `${minutes} minutes ago`;
 const hours = Math.floor(minutes / 60);
 if (hours < 24) return `${hours} hours ago`;
 return `${Math.floor(hours / 24)} days ago`;
 };

 return (
 <div className="space-y-6">
 {/* Sync Status Card */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 <RefreshCw className={`w-6 h-6 ${syncStatus.inProgress ? 'animate-spin' : ''} text-blue-600 dark:text-blue-400`} />
 <div>
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Backstage Sync
 </h2>
 <p className="text-sm text-gray-600 dark:text-gray-400">
 Keep your wrapper in sync with Backstage
 </p>
 </div>
 </div>
 
 <button
 onClick={() => setShowSettings(!showSettings)}
 className="p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-md"
 >
 <Settings className="w-5 h-5" />
 </button>
 </div>

 {/* Status Overview */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
 Status
 </span>
 {syncStatus.inProgress ? (
 <RefreshCw className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
 ) : (
 <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
 )}
 </div>
 <p className="text-sm text-gray-900 dark:text-gray-100">
 {syncStatus.inProgress ? 'Syncing...' : 'Ready'}
 </p>
 </div>
 
 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
 Last Sync
 </span>
 <Clock className="w-4 h-4 text-gray-500" />
 </div>
 <p className="text-sm text-gray-900 dark:text-gray-100">
 {formatTimeDiff(syncStatus.lastSyncTime)}
 </p>
 </div>
 
 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
 Auto Sync
 </span>
 {syncStatus.autoSyncEnabled ? (
 <Play className="w-4 h-4 text-green-600 dark:text-green-400" />
 ) : (
 <Pause className="w-4 h-4 text-gray-500" />
 )}
 </div>
 <p className="text-sm text-gray-900 dark:text-gray-100">
 {syncStatus.autoSyncEnabled ? `Every ${autoSyncInterval} min` : 'Disabled'}
 </p>
 </div>
 </div>

 {/* Action Buttons */}
 <div className="flex gap-3">
 <button
 onClick={handleManualSync}
 disabled={syncStatus.inProgress}
 className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
 >
 <RefreshCw className={`w-4 h-4 mr-2 ${syncStatus.inProgress ? 'animate-spin' : ''}`} />
 {syncStatus.inProgress ? 'Syncing...' : 'Sync Now'}
 </button>
 
 <button
 onClick={toggleAutoSync}
 className={`inline-flex items-center px-4 py-2 border rounded-md text-sm font-medium ${
 syncStatus.autoSyncEnabled
 ? 'border-red-300 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20'
 : 'border-gray-300 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
 }`}
 >
 {syncStatus.autoSyncEnabled ? (
 <>
 <Pause className="w-4 h-4 mr-2" />
 Stop Auto Sync
 </>
 ) : (
 <>
 <Play className="w-4 h-4 mr-2" />
 Start Auto Sync
 </>
 )}
 </button>
 </div>

 {/* Conflicts Alert */}
 {syncStatus.pendingConflicts > 0 && (
 <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
 <div className="flex items-start">
 <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5" />
 <div>
 <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
 {syncStatus.pendingConflicts} Sync Conflicts
 </h4>
 <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
 Manual resolution required for conflicting changes
 </p>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Settings Panel */}
 {showSettings && (
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Sync Settings
 </h3>
 
 <div className="space-y-4">
 {/* Sync Options */}
 <div>
 <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
 Sync Components
 </label>
 <div className="space-y-2">
 <label className="flex items-center">
 <input
 type="checkbox"
 checked={syncOptions.entities}
 onChange={(e) => setSyncOptions({ ...syncOptions, entities: e.target.checked })}
 className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
 />
 <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
 <Package className="w-4 h-4 inline mr-1" />
 Catalog Entities
 </span>
 </label>
 
 <label className="flex items-center">
 <input
 type="checkbox"
 checked={syncOptions.templates}
 onChange={(e) => setSyncOptions({ ...syncOptions, templates: e.target.checked })}
 className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
 />
 <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
 <FileText className="w-4 h-4 inline mr-1" />
 Templates
 </span>
 </label>
 
 <label className="flex items-center">
 <input
 type="checkbox"
 checked={syncOptions.users}
 onChange={(e) => setSyncOptions({ ...syncOptions, users: e.target.checked })}
 className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
 />
 <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
 <Users className="w-4 h-4 inline mr-1" />
 Users & Groups
 </span>
 </label>
 </div>
 </div>
 
 {/* Auto Sync Interval */}
 <div>
 <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
 Auto Sync Interval
 </label>
 <select
 value={autoSyncInterval}
 onChange={(e) => setAutoSyncInterval(Number(e.target.value))}
 className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
 >
 <option value={1}>Every minute</option>
 <option value={5}>Every 5 minutes</option>
 <option value={15}>Every 15 minutes</option>
 <option value={30}>Every 30 minutes</option>
 <option value={60}>Every hour</option>
 </select>
 </div>
 </div>
 </div>
 )}

 {/* Last Sync Results */}
 {lastResult && (
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Last Sync Results
 </h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {lastResult.entities && (
 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
 <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
 Entities
 </h4>
 <div className="space-y-1 text-sm">
 <p className="text-green-600 dark:text-green-400">
 +{lastResult.entities.added} added
 </p>
 <p className="text-blue-600 dark:text-blue-400">
 ~{lastResult.entities.updated} updated
 </p>
 <p className="text-red-600 dark:text-red-400">
 -{lastResult.entities.deleted} deleted
 </p>
 {lastResult.entities.errors.length > 0 && (
 <p className="text-orange-600 dark:text-orange-400">
 {lastResult.entities.errors.length} errors
 </p>
 )}
 </div>
 </div>
 )}
 
 {lastResult.templates && (
 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
 <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
 Templates
 </h4>
 <div className="space-y-1 text-sm">
 <p className="text-green-600 dark:text-green-400">
 +{lastResult.templates.added} added
 </p>
 <p className="text-blue-600 dark:text-blue-400">
 ~{lastResult.templates.updated} updated
 </p>
 <p className="text-red-600 dark:text-red-400">
 -{lastResult.templates.deleted} deleted
 </p>
 {lastResult.templates.errors.length > 0 && (
 <p className="text-orange-600 dark:text-orange-400">
 {lastResult.templates.errors.length} errors
 </p>
 )}
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Conflicts Resolution */}
 {conflicts.length > 0 && (
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Resolve Conflicts
 </h3>
 
 <div className="space-y-4">
 {conflicts.map((conflict) => (
 <div key={conflict.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <GitPullRequest className="w-5 h-5 text-orange-600 dark:text-orange-400" />
 <span className="font-medium text-gray-900 dark:text-gray-100">
 {conflict.type}: {conflict.id}
 </span>
 </div>
 </div>
 
 <div className="flex gap-3 mt-3">
 <button
 onClick={() => handleResolveConflict(conflict.id, 'local')}
 className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
 >
 Keep Local
 </button>
 <button
 onClick={() => handleResolveConflict(conflict.id, 'remote')}
 className="px-3 py-1 text-sm border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
 >
 Use Remote
 </button>
 <button
 onClick={() => handleResolveConflict(conflict.id, 'merge')}
 className="px-3 py-1 text-sm border border-green-300 text-green-600 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20"
 >
 Merge Both
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
}