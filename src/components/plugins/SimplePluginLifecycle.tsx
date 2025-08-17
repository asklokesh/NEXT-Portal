'use client';

import React, { useState } from 'react';
import { Package, Download, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';

export default function SimplePluginLifecycle() {
  const [selectedPlugin, setSelectedPlugin] = useState('');
  
  const mockPlugins = [
    { id: '@backstage/plugin-catalog', name: 'Software Catalog', version: '1.15.0', status: 'installed' },
    { id: '@backstage/plugin-techdocs', name: 'TechDocs', version: '1.9.3', status: 'installed' },
    { id: '@backstage/plugin-kubernetes', name: 'Kubernetes', version: '0.11.2', status: 'update-available' }
  ];

  const operations = [
    { id: 'install', name: 'Install Plugin', icon: Download, color: 'green' },
    { id: 'update', name: 'Update Plugin', icon: RefreshCw, color: 'blue' },
    { id: 'rollback', name: 'Rollback Version', icon: RotateCcw, color: 'yellow' },
    { id: 'uninstall', name: 'Uninstall Plugin', icon: Trash2, color: 'red' }
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Plugin Lifecycle Management</h2>
        <p className="text-gray-600 dark:text-gray-400">Install, update, rollback, and manage your Backstage plugins</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plugin Selection */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Select Plugin</h3>
          <select 
            value={selectedPlugin}
            onChange={(e) => setSelectedPlugin(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Choose a plugin...</option>
            {mockPlugins.map(plugin => (
              <option key={plugin.id} value={plugin.id}>
                {plugin.name} - v{plugin.version} ({plugin.status})
              </option>
            ))}
          </select>
          
          {selectedPlugin && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {mockPlugins.find(p => p.id === selectedPlugin)?.name}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Version: {mockPlugins.find(p => p.id === selectedPlugin)?.version}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Operations */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Available Operations</h3>
          <div className="space-y-3">
            {operations.map(op => (
              <button
                key={op.id}
                disabled={!selectedPlugin}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  selectedPlugin 
                    ? `border-${op.color}-200 hover:bg-${op.color}-50 dark:border-${op.color}-700 dark:hover:bg-${op.color}-900/20` 
                    : 'border-gray-200 bg-gray-50 cursor-not-allowed dark:border-gray-700 dark:bg-gray-800'
                }`}
              >
                <op.icon className={`h-5 w-5 ${selectedPlugin ? `text-${op.color}-600` : 'text-gray-400'}`} />
                <span className={selectedPlugin ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
                  {op.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Operations */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Operations</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-3">
              <Download className="h-4 w-4 text-green-600" />
              <span className="text-gray-900 dark:text-white">Installed @backstage/plugin-catalog v1.15.0</span>
            </div>
            <span className="text-sm text-green-600">2 minutes ago</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-4 w-4 text-blue-600" />
              <span className="text-gray-900 dark:text-white">Updated @backstage/plugin-techdocs v1.9.3</span>
            </div>
            <span className="text-sm text-blue-600">1 hour ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}