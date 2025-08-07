'use client';

import React, { useState, useEffect } from 'react';
import { 
 Package, 
 Shield,
 Check,
 X,
 Settings,
 AlertTriangle,
 Info,
 Loader2,
 ToggleLeft,
 ToggleRight,
 Download,
 Trash2,
 RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PluginInfo {
 id: string;
 name: string;
 version: string;
 enabled: boolean;
 installed: boolean;
 category: string;
 author: string;
 description: string;
 dependencies?: string[];
 configurable: boolean;
 permissions?: string[];
 lastUpdated?: string;
 status: 'active' | 'inactive' | 'error' | 'updating';
}

export default function AdminPluginsPage() {
 const [plugins, setPlugins] = useState<PluginInfo[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
 const [updating, setUpdating] = useState<string | null>(null);

 useEffect(() => {
 fetchPlugins();
 }, []);

 const fetchPlugins = async () => {
 try {
 // In production, this would fetch from the API
 const mockPlugins: PluginInfo[] = [
 {
 id: '@backstage/plugin-catalog',
 name: 'Software Catalog',
 version: '1.22.0',
 enabled: true,
 installed: true,
 category: 'core',
 author: 'Backstage',
 description: 'Core catalog functionality',
 permissions: ['catalog.read', 'catalog.write'],
 configurable: true,
 lastUpdated: '2024-01-15',
 status: 'active'
 },
 {
 id: '@backstage/plugin-kubernetes',
 name: 'Kubernetes',
 version: '0.18.0',
 enabled: true,
 installed: true,
 category: 'infrastructure',
 author: 'Backstage',
 description: 'Kubernetes resource management',
 dependencies: ['@backstage/plugin-catalog'],
 permissions: ['kubernetes.read'],
 configurable: true,
 lastUpdated: '2024-01-10',
 status: 'active'
 },
 {
 id: '@backstage/plugin-github-actions',
 name: 'GitHub Actions',
 version: '0.8.0',
 enabled: false,
 installed: true,
 category: 'ci-cd',
 author: 'Backstage',
 description: 'GitHub Actions integration',
 permissions: ['github.read'],
 configurable: true,
 lastUpdated: '2024-01-08',
 status: 'inactive'
 }
 ];
 
 setPlugins(mockPlugins);
 } catch (error) {
 console.error('Failed to fetch plugins:', error);
 toast.error('Failed to load plugins');
 } finally {
 setLoading(false);
 }
 };

 const togglePlugin = async (pluginId: string) => {
 setUpdating(pluginId);
 try {
 // Simulate API call
 await new Promise(resolve => setTimeout(resolve, 1000));
 
 setPlugins(prev => prev.map(p => 
 p.id === pluginId 
 ? { 
 ...p, 
 enabled: !p.enabled,
 status: !p.enabled ? 'active' : 'inactive'
 }
 : p
 ));
 
 const plugin = plugins.find(p => p.id === pluginId);
 toast.success(`${plugin?.name} ${plugin?.enabled ? 'disabled' : 'enabled'} successfully`);
 } catch (error) {
 console.error('Failed to toggle plugin:', error);
 toast.error('Failed to toggle plugin');
 } finally {
 setUpdating(null);
 }
 };

 const uninstallPlugin = async (pluginId: string) => {
 if (!confirm('Are you sure you want to uninstall this plugin? This action cannot be undone.')) {
 return;
 }

 setUpdating(pluginId);
 try {
 // Simulate API call
 await new Promise(resolve => setTimeout(resolve, 1500));
 
 setPlugins(prev => prev.filter(p => p.id !== pluginId));
 toast.success('Plugin uninstalled successfully');
 } catch (error) {
 console.error('Failed to uninstall plugin:', error);
 toast.error('Failed to uninstall plugin');
 } finally {
 setUpdating(null);
 }
 };

 const refreshPlugins = async () => {
 setLoading(true);
 await fetchPlugins();
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
 Plugin Administration
 </h1>
 <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
 Manage Backstage plugins and their configurations
 </p>
 </div>
 <button
 onClick={refreshPlugins}
 className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
 >
 <RefreshCw className="w-4 h-4 mr-2" />
 Refresh
 </button>
 </div>

 {/* Plugin Statistics */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Total Plugins</p>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 {plugins.length}
 </p>
 </div>
 <Package className="w-8 h-8 text-gray-400" />
 </div>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
 <p className="text-2xl font-bold text-green-600 dark:text-green-400">
 {plugins.filter(p => p.enabled).length}
 </p>
 </div>
 <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
 </div>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Inactive</p>
 <p className="text-2xl font-bold text-gray-500">
 {plugins.filter(p => !p.enabled).length}
 </p>
 </div>
 <X className="w-8 h-8 text-gray-400" />
 </div>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm text-gray-600 dark:text-gray-400">Configurable</p>
 <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
 {plugins.filter(p => p.configurable).length}
 </p>
 </div>
 <Settings className="w-8 h-8 text-blue-600 dark:text-blue-400" />
 </div>
 </div>
 </div>

 {/* Plugin List */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
 <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 Installed Plugins
 </h2>
 </div>
 
 <div className="divide-y divide-gray-200 dark:divide-gray-700">
 {plugins.map(plugin => (
 <div
 key={plugin.id}
 className="p-6 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
 >
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-2">
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
 {plugin.name}
 </h3>
 <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
 plugin.status === 'active'
 ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
 : plugin.status === 'error'
 ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
 : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
 }`}>
 {plugin.status}
 </span>
 <span className="text-sm text-gray-500 dark:text-gray-400">
 v{plugin.version}
 </span>
 </div>
 
 <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
 {plugin.description}
 </p>
 
 <div className="flex flex-wrap gap-4 text-sm">
 <div>
 <span className="text-gray-500 dark:text-gray-400">Category:</span>
 <span className="ml-1 text-gray-900 dark:text-gray-100">{plugin.category}</span>
 </div>
 <div>
 <span className="text-gray-500 dark:text-gray-400">Author:</span>
 <span className="ml-1 text-gray-900 dark:text-gray-100">{plugin.author}</span>
 </div>
 {plugin.lastUpdated && (
 <div>
 <span className="text-gray-500 dark:text-gray-400">Updated:</span>
 <span className="ml-1 text-gray-900 dark:text-gray-100">{plugin.lastUpdated}</span>
 </div>
 )}
 </div>
 
 {plugin.permissions && plugin.permissions.length > 0 && (
 <div className="mt-3">
 <span className="text-sm text-gray-500 dark:text-gray-400">Required permissions:</span>
 <div className="flex flex-wrap gap-2 mt-1">
 {plugin.permissions.map(perm => (
 <span
 key={perm}
 className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300"
 >
 <Shield className="w-3 h-3 mr-1" />
 {perm}
 </span>
 ))}
 </div>
 </div>
 )}
 
 {plugin.dependencies && plugin.dependencies.length > 0 && (
 <div className="mt-3">
 <span className="text-sm text-gray-500 dark:text-gray-400">Dependencies:</span>
 <div className="flex flex-wrap gap-2 mt-1">
 {plugin.dependencies.map(dep => (
 <span
 key={dep}
 className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
 >
 {dep}
 </span>
 ))}
 </div>
 </div>
 )}
 </div>
 
 <div className="flex items-center gap-2 ml-6">
 {updating === plugin.id ? (
 <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
 ) : (
 <>
 <button
 onClick={() => togglePlugin(plugin.id)}
 className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
 title={plugin.enabled ? 'Disable plugin' : 'Enable plugin'}
 >
 {plugin.enabled ? (
 <ToggleRight className="w-6 h-6 text-green-600 dark:text-green-400" />
 ) : (
 <ToggleLeft className="w-6 h-6" />
 )}
 </button>
 
 {plugin.configurable && (
 <button
 onClick={() => setSelectedPlugin(plugin.id)}
 className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
 title="Configure plugin"
 >
 <Settings className="w-5 h-5" />
 </button>
 )}
 
 {plugin.category !== 'core' && (
 <button
 onClick={() => uninstallPlugin(plugin.id)}
 className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
 title="Uninstall plugin"
 >
 <Trash2 className="w-5 h-5" />
 </button>
 )}
 </>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Security Notice */}
 <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
 <div className="flex">
 <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mr-2 flex-shrink-0" />
 <div className="text-sm text-orange-800 dark:text-orange-200">
 <h3 className="font-medium mb-1">Security Notice</h3>
 <p>
 Plugins have access to sensitive platform resources. Only install plugins from trusted sources
 and regularly review plugin permissions.
 </p>
 </div>
 </div>
 </div>
 </div>
 );
}