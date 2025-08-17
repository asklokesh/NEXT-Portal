'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
 Package,
 Download,
 Settings,
 Check,
 Star,
 GitBranch,
 Search,
 Filter,
 Loader2,
 AlertCircle,
 ExternalLink,
 Zap,
 Shield,
 Sparkles,
 ChevronRight,
 Info,
 CheckCircle,
 XCircle,
 RefreshCw,
 Globe,
 Code,
 Database,
 Layers,
 Terminal
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { pluginRegistry } from '@/services/backstage/plugin-registry';
import type { BackstagePlugin, PluginInstallationStatus } from '@/services/backstage/plugin-registry';
import { PluginConfigurationModal } from './PluginConfigurationModal';
import { PluginDetailsModal } from './PluginDetailsModal';

interface PluginMarketplaceProps {
 onPluginInstalled?: (plugin: BackstagePlugin) => void;
}

function PluginMarketplace({ onPluginInstalled }: PluginMarketplaceProps) {
 const queryClient = useQueryClient();
 const [searchQuery, setSearchQuery] = useState('');
 const [selectedCategory, setSelectedCategory] = useState<string>('all');
 const [configuring, setConfiguring] = useState<string | null>(null);
 const [viewingDetails, setViewingDetails] = useState<string | null>(null);
 const [installationStatus, setInstallationStatus] = useState<Record<string, PluginInstallationStatus>>({});
 const [hasRuntimeError, setHasRuntimeError] = useState(false);
 
 // Error boundary for runtime errors
 useEffect(() => {
 const handleError = (event: ErrorEvent) => {
 if (event.message.includes('webpack') || event.message.includes('Cannot read properties of undefined')) {
 console.error('Runtime error in PluginMarketplace:', event.error);
 setHasRuntimeError(true);
 
 // Clear cache and show user-friendly message
 toast.error('Plugin marketplace encountered an error. Clearing cache...');
 
 if ('caches' in window) {
 caches.keys().then(names => {
 names.forEach(name => caches.delete(name));
 });
 }
 
 setTimeout(() => {
 window.location.reload();
 }, 2000);
 }
 };
 
 window.addEventListener('error', handleError);
 return () => window.removeEventListener('error', handleError);
 }, []);
 
 if (hasRuntimeError) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="text-center">
 <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
 Plugin marketplace error
 </h3>
 <p className="text-gray-600 dark:text-gray-400 mb-4">
 Clearing cache and reloading...
 </p>
 <button
 onClick={() => window.location.reload()}
 className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
 >
 <RefreshCw className="w-4 h-4 mr-2" />
 Reload Now
 </button>
 </div>
 </div>
 );
 }

 // Fetch available plugins from API route
 const { data: pluginsResponse, isLoading, error, refetch } = useQuery({
 queryKey: ['backstage-plugins'],
 queryFn: async () => {
 try {
 const response = await fetch('/api/plugins');
 if (!response.ok) {
 throw new Error('Failed to fetch plugins');
 }
 return await response.json();
 } catch (err) {
 console.error('Failed to fetch plugins:', err);
 // Clear cache on error
 if (typeof window !== 'undefined') {
 Object.keys(localStorage).forEach(key => {
 if (key.startsWith('plugin-') || key.includes('cache') || key.includes('query')) {
 localStorage.removeItem(key);
 }
 });
 }
 throw err;
 }
 },
 staleTime: 5 * 60 * 1000, // 5 minutes
 retry: (failureCount, error) => {
 // Don't retry on webpack module errors
 if (error instanceof Error && error.message.includes('webpack')) {
 return false;
 }
 return failureCount < 2;
 },
 retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
 });
 
 // Deduplicate plugins based on ID to prevent duplicate key errors
 const rawPlugins = pluginsResponse?.plugins || [];
 const plugins = Array.from(new Map(rawPlugins.map(p => [p.id, p])).values());

 // Install plugin mutation
 const installMutation = useMutation({
 mutationFn: async (pluginId: string) => {
 const response = await fetch('/api/plugins', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 action: 'install',
 pluginId: pluginId,
 }),
 });
 
 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || 'Failed to install plugin');
 }
 
 return response.json();
 },
 onSuccess: (_, pluginId) => {
 queryClient.invalidateQueries({ queryKey: ['backstage-plugins'] });
 const plugin = plugins.find(p => p.id === pluginId);
 if (plugin) {
 onPluginInstalled?.(plugin);
 toast.success(`${plugin.title} installed successfully!`);
 }
 // Clear installation status after success
 setTimeout(() => {
 setInstallationStatus(prev => {
 const updated = { ...prev };
 delete updated[pluginId];
 return updated;
 });
 }, 2000);
 },
 onError: (error: any, pluginId) => {
 toast.error(`Failed to install plugin: ${error.message}`);
 // Clear installation status after error
 setInstallationStatus(prev => {
 const updated = { ...prev };
 delete updated[pluginId];
 return updated;
 });
 }
 });

 // Uninstall plugin mutation
 const uninstallMutation = useMutation({
 mutationFn: async (pluginId: string) => {
 const response = await fetch('/api/plugins', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 action: 'uninstall',
 pluginId: pluginId,
 }),
 });
 
 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || 'Failed to uninstall plugin');
 }
 
 return response.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['backstage-plugins'] });
 toast.success('Plugin uninstalled successfully');
 },
 onError: (error: any) => {
 toast.error(`Failed to uninstall plugin: ${error.message}`);
 }
 });

 // Toggle plugin mutation
 const toggleMutation = useMutation({
 mutationFn: async ({ pluginId, enabled }: { pluginId: string; enabled: boolean }) => {
 const response = await fetch('/api/plugins', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 action: 'configure',
 pluginId: pluginId,
 config: { enabled },
 }),
 });
 
 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || 'Failed to toggle plugin');
 }
 
 return response.json();
 },
 onSuccess: (_, { pluginId, enabled }) => {
 queryClient.invalidateQueries({ queryKey: ['backstage-plugins'] });
 const plugin = plugins.find(p => p.id === pluginId);
 if (plugin) {
 toast.success(`${plugin.title} ${enabled ? 'enabled' : 'disabled'}`);
 }
 },
 onError: (error: any) => {
 toast.error(`Failed to toggle plugin: ${error.message}`);
 }
 });

 // Categories with icons
 const categories = [
 { id: 'all', name: 'All Plugins', icon: Package, color: 'text-gray-600' },
 { id: 'ci-cd', name: 'CI/CD', icon: GitBranch, color: 'text-green-600' },
 { id: 'monitoring', name: 'Monitoring', icon: Shield, color: 'text-purple-600' },
 { id: 'infrastructure', name: 'Infrastructure', icon: Database, color: 'text-blue-600' },
 { id: 'analytics', name: 'Analytics', icon: Sparkles, color: 'text-yellow-600' },
 { id: 'security', name: 'Security', icon: Shield, color: 'text-red-600' },
 { id: 'documentation', name: 'Documentation', icon: Code, color: 'text-indigo-600' },
 { id: 'cost-management', name: 'Cost Management', icon: Layers, color: 'text-teal-600' },
 { id: 'development-tools', name: 'Dev Tools', icon: Terminal, color: 'text-orange-600' }
 ];

 // Filter plugins
 const filteredPlugins = React.useMemo(() => {
 let filtered = [...plugins];

 // Category filter
 if (selectedCategory !== 'all') {
 filtered = filtered.filter(p => p.category === selectedCategory);
 }

 // Search filter
 if (searchQuery) {
 const query = searchQuery.toLowerCase();
 filtered = filtered.filter(p =>
 p.title.toLowerCase().includes(query) ||
 p.description.toLowerCase().includes(query) ||
 p.tags.some(tag => tag.toLowerCase().includes(query))
 );
 }

 return filtered;
 }, [plugins, selectedCategory, searchQuery]);

 // Group plugins by installation status
 const { installed, available } = React.useMemo(() => {
 const installed = filteredPlugins.filter(p => p.installed);
 const available = filteredPlugins.filter(p => !p.installed);
 return { installed, available };
 }, [filteredPlugins]);

 const renderPluginCard = (plugin: BackstagePlugin) => {
 const status = installationStatus[plugin.id];
 const isInstalling = status?.status && status.status !== 'completed' && status.status !== 'failed';
 const categoryInfo = categories.find(c => c.id === plugin.category);
 const Icon = categoryInfo?.icon || Package;

 return (
 <div
 className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200"
 >
 <div className="p-6">
 {/* Header */}
 <div className="flex items-start justify-between mb-4">
 <div className="flex items-start gap-4">
 <div className={`w-12 h-12 rounded-lg flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20`}>
 <Icon className={`w-6 h-6 ${categoryInfo?.color || 'text-blue-600'}`} />
 </div>
 <div className="flex-1">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
 {plugin.title}
 {plugin.installed && (
 <CheckCircle className="w-5 h-5 text-green-500" />
 )}
 </h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 v{plugin.version} • by {plugin.author}
 </p>
 </div>
 </div>
 </div>

 {/* Description */}
 <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
 {plugin.description}
 </p>

 {/* Installation Progress */}
 {status && (
 <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
 {status.message}
 </span>
 <span className="text-sm text-blue-600 dark:text-blue-400">
 {status.progress}%
 </span>
 </div>
 <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
 <div
 className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
 style={{ width: `${status.progress}%` }}
 />
 </div>
 {status.error && (
 <p className="mt-2 text-sm text-red-600 dark:text-red-400">
 {status.error}
 </p>
 )}
 </div>
 )}

 {/* Metadata */}
 <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
 {plugin.downloads && (
 <span className="flex items-center gap-1">
 <Download className="w-3 h-3" />
 {plugin.downloads.toLocaleString()}
 </span>
 )}
 {plugin.stars && (
 <span className="flex items-center gap-1">
 <Star className="w-3 h-3" />
 {plugin.stars.toLocaleString()}
 </span>
 )}
 <span className="flex items-center gap-1">
 <Globe className="w-3 h-3" />
 {plugin.category}
 </span>
 </div>

 {/* Tags */}
 <div className="flex flex-wrap gap-1 mb-4">
 {plugin.tags.slice(0, 4).map(tag => (
 <span
 key={tag}
 className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
 >
 {tag}
 </span>
 ))}
 {plugin.tags.length > 4 && (
 <span className="text-xs text-gray-500 dark:text-gray-400">
 +{plugin.tags.length - 4} more
 </span>
 )}
 </div>

 {/* Actions */}
 <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
 <div className="flex gap-2">
 {!plugin.installed ? (
 <button
 onClick={() => installMutation.mutate(plugin.id)}
 disabled={isInstalling}
 className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 {isInstalling ? (
 <>
 <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
 Installing...
 </>
 ) : (
 <>
 <Download className="w-4 h-4 mr-1.5" />
 Install
 </>
 )}
 </button>
 ) : (
 <>
 <button
 onClick={() => toggleMutation.mutate({ pluginId: plugin.id, enabled: !plugin.enabled })}
 className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
 plugin.enabled
 ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/30'
 : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
 }`}
 >
 <Zap className="w-4 h-4 mr-1.5" />
 {plugin.enabled ? 'Enabled' : 'Enable'}
 </button>
 {plugin.configurable && (
 <button
 onClick={() => setConfiguring(plugin.id)}
 className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
 >
 <Settings className="w-4 h-4 mr-1.5" />
 Configure
 </button>
 )}
 </>
 )}
 <button
 onClick={() => setViewingDetails(plugin.id)}
 className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
 >
 <Info className="w-4 h-4 mr-1.5" />
 Details
 </button>
 </div>
 {plugin.npm && (
 <a
 href={plugin.npm}
 target="_blank"
 rel="noopener noreferrer"
 className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
 >
 <ExternalLink className="w-4 h-4" />
 </a>
 )}
 </div>
 </div>
 </div>
 );
 };

 if (isLoading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="text-center">
 <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
 <p className="text-gray-600 dark:text-gray-400">Loading plugin marketplace...</p>
 </div>
 </div>
 );
 }

 if (error) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="text-center">
 <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
 Failed to load plugins
 </h3>
 <p className="text-gray-600 dark:text-gray-400 mb-4">
 {error instanceof Error ? error.message : 'Unknown error occurred'}
 </p>
 <button
 onClick={() => refetch()}
 className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
 >
 <RefreshCw className="w-4 h-4 mr-2" />
 Retry
 </button>
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-8 text-white">
 <h1 className="text-3xl font-bold mb-2">Plugin Marketplace</h1>
 <p className="text-blue-100 mb-6">
 Browse and install Backstage plugins with one-click, no-code configuration
 </p>
 <div className="flex flex-col sm:flex-row gap-4">
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
 <input
 type="text"
 placeholder="Search plugins by name, description, or tags..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-10 pr-4 py-3 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-white focus:ring-opacity-50"
 />
 </div>
 <a
 href="https://backstage.io/plugins"
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center px-6 py-3 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
 >
 <ExternalLink className="w-4 h-4 mr-2" />
 Browse All
 </a>
 </div>
 </div>

 {/* Categories */}
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
 {categories.map(cat => {
 const Icon = cat.icon;
 const count = cat.id === 'all' 
 ? plugins.length 
 : plugins.filter(p => p.category === cat.id).length;
 
 return (
 <button
 key={cat.id}
 onClick={() => setSelectedCategory(cat.id)}
 className={`p-4 rounded-lg border-2 transition-all ${
 selectedCategory === cat.id
 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600'
 : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
 }`}
 >
 <Icon className={`w-6 h-6 mx-auto mb-2 ${cat.color}`} />
 <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {cat.name}
 </div>
 <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
 {count} {count === 1 ? 'plugin' : 'plugins'}
 </div>
 </button>
 );
 })}
 </div>

 {/* Statistics */}
 <div className="grid grid-cols-4 gap-4">
 <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
 <div className="text-2xl font-bold text-blue-600">
 {plugins.length}
 </div>
 <div className="text-sm text-gray-600 dark:text-gray-400">Available Plugins</div>
 </div>
 <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
 <div className="text-2xl font-bold text-green-600">
 {plugins.filter(p => p.installed).length}
 </div>
 <div className="text-sm text-gray-600 dark:text-gray-400">Installed</div>
 </div>
 <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
 <div className="text-2xl font-bold text-blue-600">
 {plugins.filter(p => p.enabled).length}
 </div>
 <div className="text-sm text-gray-600 dark:text-gray-400">Enabled</div>
 </div>
 <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
 <div className="text-2xl font-bold text-purple-600">
 {filteredPlugins.length}
 </div>
 <div className="text-sm text-gray-600 dark:text-gray-400">Filtered</div>
 </div>
 </div>

 {/* Installed Plugins */}
 {installed.length > 0 && (
 <div>
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Installed Plugins ({installed.length})
 </h2>
 <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
 {installed.map(plugin => (
 <React.Fragment key={plugin.id}>
 {renderPluginCard(plugin)}
 </React.Fragment>
 ))}
 </div>
 </div>
 )}

 {/* Available Plugins */}
 {available.length > 0 && (
 <div>
 <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Available Plugins ({available.length})
 </h2>
 <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
 {available.map(plugin => (
 <React.Fragment key={plugin.id}>
 {renderPluginCard(plugin)}
 </React.Fragment>
 ))}
 </div>
 </div>
 )}

 {/* Empty State */}
 {filteredPlugins.length === 0 && (
 <div className="text-center py-12">
 <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 No plugins found
 </h3>
 <p className="text-gray-500 dark:text-gray-400">
 Try adjusting your search or category filter
 </p>
 </div>
 )}

 {/* Configuration Modal */}
 {configuring && (
 <PluginConfigurationModal
 pluginId={configuring}
 onClose={() => setConfiguring(null)}
 onSave={async (config) => {
 const response = await fetch('/api/plugins', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify({
 action: 'configure',
 pluginId: configuring,
 config,
 }),
 });
 
 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || 'Failed to configure plugin');
 }
 
 queryClient.invalidateQueries({ queryKey: ['backstage-plugins'] });
 toast.success('Plugin configured successfully');
 setConfiguring(null);
 }}
 />
 )}

 {/* Details Modal */}
 {viewingDetails && (
 <PluginDetailsModal
 plugin={plugins.find(p => p.id === viewingDetails)!}
 onClose={() => setViewingDetails(null)}
 />
 )}
 </div>
 );
}

export default PluginMarketplace;