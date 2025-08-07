'use client';

import React from 'react';
import {
 X,
 Package,
 User,
 Calendar,
 Download,
 Star,
 ExternalLink,
 GitBranch,
 Globe,
 Shield,
 Code,
 Database,
 Server,
 Layers,
 CheckCircle,
 AlertCircle,
 Info,
 Settings
} from 'lucide-react';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

interface PluginDetailsModalProps {
 plugin: BackstagePlugin;
 onClose: () => void;
}

export function PluginDetailsModal({ plugin, onClose }: PluginDetailsModalProps) {
 const getCategoryIcon = (category: string) => {
 const icons: Record<string, any> = {
 'ci-cd': GitBranch,
 'monitoring': Shield,
 'infrastructure': Database,
 'analytics': Code,
 'security': Shield,
 'documentation': Globe,
 'cost-management': Layers,
 'development-tools': Server
 };
 return icons[category] || Package;
 };

 const Icon = getCategoryIcon(plugin.category);

 return (
 <div className="fixed inset-0 z-50 overflow-y-auto">
 <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
 {/* Background overlay */}
 <div className="fixed inset-0 transition-opacity" onClick={onClose}>
 <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
 </div>

 {/* Modal */}
 <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
 {/* Header */}
 <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-6">
 <div className="flex items-start justify-between">
 <div className="flex items-start gap-4">
 <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
 <Icon className="w-8 h-8 text-white" />
 </div>
 <div>
 <h3 className="text-2xl font-bold text-white flex items-center gap-2">
 {plugin.title}
 {plugin.installed && (
 <CheckCircle className="w-6 h-6 text-green-300" />
 )}
 </h3>
 <p className="text-blue-100 mt-1">{plugin.name}</p>
 </div>
 </div>
 <button
 onClick={onClose}
 className="text-white hover:text-blue-100 transition-colors"
 >
 <X className="w-6 h-6" />
 </button>
 </div>
 </div>

 {/* Content */}
 <div className="px-6 py-6">
 {/* Description */}
 <div className="mb-6">
 <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 uppercase tracking-wider">
 Description
 </h4>
 <p className="text-gray-600 dark:text-gray-300">
 {plugin.description}
 </p>
 </div>

 {/* Metadata Grid */}
 <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
 <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
 <Package className="w-4 h-4" />
 <span className="text-xs font-medium uppercase">Version</span>
 </div>
 <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
 v{plugin.version}
 </p>
 </div>

 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
 <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
 <User className="w-4 h-4" />
 <span className="text-xs font-medium uppercase">Author</span>
 </div>
 <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
 {plugin.author}
 </p>
 </div>

 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
 <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
 <Calendar className="w-4 h-4" />
 <span className="text-xs font-medium uppercase">Last Updated</span>
 </div>
 <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
 {plugin.lastUpdated || 'Unknown'}
 </p>
 </div>

 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
 <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
 <Download className="w-4 h-4" />
 <span className="text-xs font-medium uppercase">Downloads</span>
 </div>
 <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
 {plugin.downloads?.toLocaleString() || '0'}
 </p>
 </div>

 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
 <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
 <Star className="w-4 h-4" />
 <span className="text-xs font-medium uppercase">Stars</span>
 </div>
 <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
 {plugin.stars?.toLocaleString() || '0'}
 </p>
 </div>

 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
 <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
 <Layers className="w-4 h-4" />
 <span className="text-xs font-medium uppercase">Category</span>
 </div>
 <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
 {plugin.category.replace('-', ' ')}
 </p>
 </div>
 </div>

 {/* Tags */}
 {plugin.tags.length > 0 && (
 <div className="mb-6">
 <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 uppercase tracking-wider">
 Tags
 </h4>
 <div className="flex flex-wrap gap-2">
 {plugin.tags.map(tag => (
 <span
 key={tag}
 className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
 >
 {tag}
 </span>
 ))}
 </div>
 </div>
 )}

 {/* Compatibility */}
 {plugin.compatibility && (
 <div className="mb-6">
 <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 uppercase tracking-wider">
 Compatibility
 </h4>
 <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
 <div className="flex items-start gap-2">
 <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
 <div className="text-sm text-yellow-700 dark:text-yellow-300">
 {plugin.compatibility.backstageVersion && (
 <p>Backstage Version: {plugin.compatibility.backstageVersion}</p>
 )}
 {plugin.compatibility.nodeVersion && (
 <p>Node.js Version: {plugin.compatibility.nodeVersion}</p>
 )}
 {plugin.compatibility.npmVersion && (
 <p>NPM Version: {plugin.compatibility.npmVersion}</p>
 )}
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Dependencies */}
 {plugin.dependencies && plugin.dependencies.length > 0 && (
 <div className="mb-6">
 <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 uppercase tracking-wider">
 Dependencies ({plugin.dependencies.length})
 </h4>
 <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 max-h-32 overflow-y-auto">
 <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
 {plugin.dependencies.map(dep => (
 <code key={dep} className="text-xs text-gray-600 dark:text-gray-400">
 {dep}
 </code>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* Installation Status */}
 <div className="mb-6">
 <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 uppercase tracking-wider">
 Status
 </h4>
 <div className="flex items-center gap-4">
 <div className="flex items-center gap-2">
 <div className={`w-3 h-3 rounded-full ${plugin.installed ? 'bg-green-500' : 'bg-gray-400'}`} />
 <span className="text-sm text-gray-600 dark:text-gray-400">
 {plugin.installed ? 'Installed' : 'Not Installed'}
 </span>
 </div>
 {plugin.installed && (
 <div className="flex items-center gap-2">
 <div className={`w-3 h-3 rounded-full ${plugin.enabled ? 'bg-blue-500' : 'bg-gray-400'}`} />
 <span className="text-sm text-gray-600 dark:text-gray-400">
 {plugin.enabled ? 'Enabled' : 'Disabled'}
 </span>
 </div>
 )}
 {plugin.configurable && (
 <div className="flex items-center gap-2">
 <Settings className="w-4 h-4 text-gray-400" />
 <span className="text-sm text-gray-600 dark:text-gray-400">
 Configurable
 </span>
 </div>
 )}
 </div>
 </div>

 {/* Links */}
 <div className="flex flex-wrap gap-3">
 {plugin.npm && (
 <a
 href={plugin.npm}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
 >
 <ExternalLink className="w-4 h-4 mr-2" />
 View on NPM
 </a>
 )}
 {plugin.repository && (
 <a
 href={plugin.repository}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
 >
 <GitBranch className="w-4 h-4 mr-2" />
 Repository
 </a>
 )}
 {plugin.homepage && (
 <a
 href={plugin.homepage}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
 >
 <Globe className="w-4 h-4 mr-2" />
 Documentation
 </a>
 )}
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}