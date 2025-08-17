'use client';

import React, { useState } from 'react';
import { GitBranch, AlertTriangle, CheckCircle, Package, ChevronRight, ChevronDown } from 'lucide-react';

export default function SimplePluginDependencies() {
  const [expandedPlugins, setExpandedPlugins] = useState<string[]>([]);
  
  const dependencies = [
    {
      id: '@backstage/plugin-catalog',
      name: 'Software Catalog',
      version: '1.15.0',
      status: 'compatible',
      dependencies: [
        { name: 'react', version: '^18.0.0', status: 'compatible' },
        { name: '@backstage/core-components', version: '^0.13.0', status: 'compatible' },
        { name: '@backstage/catalog-model', version: '^1.4.0', status: 'compatible' }
      ]
    },
    {
      id: '@backstage/plugin-techdocs',
      name: 'TechDocs',
      version: '1.9.3',
      status: 'compatible',
      dependencies: [
        { name: '@backstage/plugin-catalog', version: '^1.15.0', status: 'compatible' },
        { name: '@backstage/core-components', version: '^0.13.0', status: 'compatible' },
        { name: '@backstage/plugin-search-common', version: '^1.2.0', status: 'compatible' }
      ]
    },
    {
      id: '@backstage/plugin-kubernetes',
      name: 'Kubernetes',
      version: '0.11.2',
      status: 'warning',
      dependencies: [
        { name: '@backstage/plugin-catalog', version: '^1.15.0', status: 'compatible' },
        { name: 'kubernetes-client', version: '^0.18.0', status: 'warning' },
        { name: '@backstage/config', version: '^1.1.0', status: 'compatible' }
      ]
    }
  ];

  const togglePlugin = (pluginId: string) => {
    setExpandedPlugins(prev => 
      prev.includes(pluginId) 
        ? prev.filter(id => id !== pluginId)
        : [...prev, pluginId]
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compatible': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'conflict': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Package className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compatible': return 'green';
      case 'warning': return 'yellow';
      case 'conflict': return 'red';
      default: return 'gray';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Plugin Dependencies</h2>
        <p className="text-gray-600 dark:text-gray-400">Analyze and resolve plugin dependency conflicts</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">2</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Compatible</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">1</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Warnings</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <GitBranch className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">9</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Deps</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dependency Tree */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Dependency Tree</h3>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            {dependencies.map((plugin) => (
              <div key={plugin.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                {/* Plugin Header */}
                <button
                  onClick={() => togglePlugin(plugin.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedPlugins.includes(plugin.id) ? (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    )}
                    <Package className="h-5 w-5 text-blue-600" />
                    <div className="text-left">
                      <h4 className="font-semibold text-gray-900 dark:text-white">{plugin.name}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">v{plugin.version}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(plugin.status)}
                    <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${getStatusColor(plugin.status)}-100 text-${getStatusColor(plugin.status)}-800 dark:bg-${getStatusColor(plugin.status)}-900/20 dark:text-${getStatusColor(plugin.status)}-400`}>
                      {plugin.status}
                    </span>
                  </div>
                </button>

                {/* Dependencies */}
                {expandedPlugins.includes(plugin.id) && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                    <div className="pl-8 space-y-2">
                      {plugin.dependencies.map((dep, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-900 dark:text-white">{dep.name}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{dep.version}</span>
                          </div>
                          {getStatusIcon(dep.status)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Graph Placeholder */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Dependency Graph</h3>
        <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <div className="text-center">
            <GitBranch className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Interactive Dependency Graph</p>
            <p className="text-sm text-gray-400 mt-2">Visual dependency graph coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}