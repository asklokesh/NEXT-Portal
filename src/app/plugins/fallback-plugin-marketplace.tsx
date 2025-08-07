'use client';

import React from 'react';
import { AlertCircle, RefreshCw, Package, ExternalLink } from 'lucide-react';

export default function FallbackPluginMarketplace() {
 const handleReload = () => {
 // Clear cache and reload
 if ('caches' in window) {
 caches.keys().then(names => {
 names.forEach(name => {
 caches.delete(name);
 });
 });
 }
 
 // Clear plugin-related localStorage
 if (typeof window !== 'undefined') {
 Object.keys(localStorage).forEach(key => {
 if (key.startsWith('plugin-') || key.includes('cache') || key.includes('query')) {
 localStorage.removeItem(key);
 }
 });
 }
 
 window.location.reload();
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-8 text-white">
 <h1 className="text-3xl font-bold mb-2">Plugin Marketplace</h1>
 <p className="text-blue-100">
 Browse and install Backstage plugins with one-click, no-code configuration
 </p>
 </div>

 {/* Error State */}
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
 <div className="text-center">
 <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
 <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
 Plugin Marketplace Temporarily Unavailable
 </h2>
 <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
 We're experiencing technical difficulties loading the plugin marketplace. 
 This is usually a temporary issue with module loading or caching.
 </p>
 
 <div className="space-y-4">
 <button
 onClick={handleReload}
 className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
 >
 <RefreshCw className="w-5 h-5 mr-2" />
 Clear Cache & Reload
 </button>
 
 <div className="text-sm text-gray-500 dark:text-gray-400">
 Or visit the official Backstage plugins directory:
 </div>
 
 <a
 href="https://backstage.io/plugins"
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
 >
 <ExternalLink className="w-4 h-4 mr-2" />
 Browse Official Plugins
 </a>
 </div>
 </div>
 </div>

 {/* Quick Actions */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
 <Package className="w-8 h-8 text-blue-600 mb-4" />
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
 What are Backstage Plugins?
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400">
 Extend your developer portal with plugins for CI/CD, monitoring, security, and more.
 </p>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
 <RefreshCw className="w-8 h-8 text-green-600 mb-4" />
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
 Troubleshooting
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400">
 Try clearing your browser cache or opening in an incognito window if issues persist.
 </p>
 </div>
 
 <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
 <ExternalLink className="w-8 h-8 text-purple-600 mb-4" />
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
 Manual Installation
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-400">
 Visit the Backstage documentation for manual plugin installation guides.
 </p>
 </div>
 </div>
 </div>
 );
}