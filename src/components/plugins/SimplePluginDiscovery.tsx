'use client';

import React from 'react';
import { Search, Package, Download } from 'lucide-react';

export default function SimplePluginDiscovery() {
  const mockPlugins = [
    { id: '@backstage/plugin-catalog', name: 'Software Catalog', description: 'Manage your software components' },
    { id: '@backstage/plugin-techdocs', name: 'TechDocs', description: 'Technical documentation platform' },
    { id: '@backstage/plugin-kubernetes', name: 'Kubernetes', description: 'Manage Kubernetes workloads' }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Plugin Discovery</h2>
        <p className="text-gray-600 dark:text-gray-400">Discover and install Backstage plugins from the registry</p>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search plugins..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockPlugins.map((plugin) => (
          <div key={plugin.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{plugin.name}</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{plugin.description}</p>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Download className="h-4 w-4" />
              Install Plugin
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}