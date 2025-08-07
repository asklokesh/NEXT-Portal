'use client';

import React, { useState } from 'react';
import { Search, Filter, Package, Download, Settings, CheckCircle, XCircle } from 'lucide-react';

const DEMO_PLUGINS = [
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    title: 'Kubernetes',
    description: 'View and manage Kubernetes resources for your services',
    version: '0.18.0',
    author: 'Backstage Community',
    category: 'infrastructure',
    tags: ['kubernetes', 'k8s', 'container'],
    installed: false,
    enabled: false,
    downloads: 125000,
    stars: 4800
  },
  {
    id: 'github-actions',
    name: 'GitHub Actions',
    title: 'GitHub Actions',
    description: 'View GitHub Actions workflow runs for your services',
    version: '0.8.0',
    author: 'Backstage Community',
    category: 'ci-cd',
    tags: ['github', 'ci', 'cd', 'actions'],
    installed: true,
    enabled: true,
    downloads: 98000,
    stars: 3200
  },
  {
    id: 'techdocs',
    name: 'TechDocs',
    title: 'TechDocs',
    description: 'Documentation solution for your services and components',
    version: '1.14.0',
    author: 'Backstage Community',
    category: 'documentation',
    tags: ['docs', 'markdown', 'mkdocs'],
    installed: true,
    enabled: true,
    downloads: 180000,
    stars: 5600
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    title: 'PagerDuty',
    description: 'View PagerDuty incidents and on-call schedules',
    version: '0.12.0',
    author: 'Backstage Community',
    category: 'monitoring',
    tags: ['pagerduty', 'incidents', 'oncall'],
    installed: false,
    enabled: false,
    downloads: 67000,
    stars: 2100
  },
  {
    id: 'jenkins',
    name: 'Jenkins',
    title: 'Jenkins',
    description: 'View Jenkins builds and jobs for your services',
    version: '0.14.0',
    author: 'Backstage Community',
    category: 'ci-cd',
    tags: ['jenkins', 'ci', 'cd', 'builds'],
    installed: false,
    enabled: false,
    downloads: 89000,
    stars: 2900
  },
  {
    id: 'argocd',
    name: 'ArgoCD',
    title: 'ArgoCD',
    description: 'Manage ArgoCD applications and deployments',
    version: '0.8.0',
    author: 'RoadieHQ',
    category: 'deployment',
    tags: ['argocd', 'gitops', 'kubernetes'],
    installed: true,
    enabled: false,
    downloads: 54000,
    stars: 1800
  },
  {
    id: 'sentry',
    name: 'Sentry',
    title: 'Sentry',
    description: 'View Sentry issues and error tracking',
    version: '0.10.0',
    author: 'Backstage Community',
    category: 'monitoring',
    tags: ['sentry', 'errors', 'monitoring'],
    installed: false,
    enabled: false,
    downloads: 72000,
    stars: 2400
  },
  {
    id: 'datadog',
    name: 'Datadog',
    title: 'Datadog',
    description: 'View Datadog dashboards and metrics',
    version: '0.7.0',
    author: 'RoadieHQ',
    category: 'monitoring',
    tags: ['datadog', 'metrics', 'monitoring'],
    installed: false,
    enabled: false,
    downloads: 45000,
    stars: 1500
  },
  {
    id: 'sonarqube',
    name: 'SonarQube',
    title: 'SonarQube',
    description: 'View code quality metrics from SonarQube',
    version: '0.11.0',
    author: 'Backstage Community',
    category: 'quality',
    tags: ['sonarqube', 'code-quality', 'metrics'],
    installed: false,
    enabled: false,
    downloads: 61000,
    stars: 2000
  },
  {
    id: 'grafana',
    name: 'Grafana',
    title: 'Grafana',
    description: 'Embed Grafana dashboards in Backstage',
    version: '0.6.0',
    author: 'K-Phoen',
    category: 'monitoring',
    tags: ['grafana', 'dashboards', 'metrics'],
    installed: false,
    enabled: false,
    downloads: 38000,
    stars: 1200
  }
];

const CATEGORIES = ['all', 'ci-cd', 'monitoring', 'infrastructure', 'documentation', 'deployment', 'quality'];

export default function DemoPlugins() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [plugins, setPlugins] = useState(DEMO_PLUGINS);
  const [installing, setInstalling] = useState<string | null>(null);

  const filteredPlugins = plugins.filter(plugin => {
    const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleInstall = async (pluginId: string) => {
    setInstalling(pluginId);
    // Simulate installation
    await new Promise(resolve => setTimeout(resolve, 2000));
    setPlugins(plugins.map(p => 
      p.id === pluginId ? { ...p, installed: true } : p
    ));
    setInstalling(null);
  };

  const handleToggle = (pluginId: string) => {
    setPlugins(plugins.map(p => 
      p.id === pluginId ? { ...p, enabled: !p.enabled } : p
    ));
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

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Plugin Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlugins.map((plugin) => (
          <div
            key={plugin.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <Package className="w-10 h-10 text-blue-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {plugin.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    v{plugin.version} by {plugin.author}
                  </p>
                </div>
              </div>
              {plugin.installed && (
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  plugin.enabled 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {plugin.enabled ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                  {plugin.enabled ? 'Enabled' : 'Disabled'}
                </span>
              )}
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
              {plugin.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {plugin.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
              <span className="flex items-center">
                <Download className="w-4 h-4 mr-1" />
                {plugin.downloads.toLocaleString()}
              </span>
              <span>★ {plugin.stars.toLocaleString()}</span>
            </div>

            <div className="flex gap-2">
              {!plugin.installed ? (
                <button
                  onClick={() => handleInstall(plugin.id)}
                  disabled={installing === plugin.id}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {installing === plugin.id ? 'Installing...' : 'Install'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleToggle(plugin.id)}
                    className={`flex-1 px-4 py-2 rounded-lg ${
                      plugin.enabled
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        : 'bg-green-600 text-white'
                    }`}
                  >
                    {plugin.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Settings className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}