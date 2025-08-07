'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Package, Download, Settings, CheckCircle, XCircle, ExternalLink, X, Save } from 'lucide-react';

interface Plugin {
  id: string;
  name: string;
  title: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  installed: boolean;
  enabled: boolean;
  configurable: boolean;
  downloads: number;
  stars: number;
  npm?: string;
  repository?: string;
  homepage?: string;
}

interface ConfigField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'number' | 'boolean' | 'select';
  required: boolean;
  description: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  value?: any;
}

const CATEGORIES = ['all', 'core', 'ci-cd', 'monitoring', 'infrastructure', 'documentation', 'deployment', 'quality', 'security', 'cost', 'other'];

const PLUGIN_CONFIGS: Record<string, ConfigField[]> = {
  kubernetes: [
    { name: 'clusters', label: 'Kubernetes Clusters', type: 'text', required: true, description: 'Comma-separated list of cluster names', placeholder: 'prod-cluster, staging-cluster' },
    { name: 'serviceAccount', label: 'Service Account', type: 'text', required: false, description: 'Service account for authentication', placeholder: 'backstage-k8s-sa' },
    { name: 'namespace', label: 'Default Namespace', type: 'text', required: false, description: 'Default namespace to query', placeholder: 'default' },
  ],
  'github-actions': [
    { name: 'githubToken', label: 'GitHub Token', type: 'password', required: true, description: 'Personal access token for GitHub API', placeholder: 'ghp_...' },
    { name: 'owner', label: 'Repository Owner', type: 'text', required: true, description: 'GitHub organization or username', placeholder: 'my-org' },
    { name: 'repo', label: 'Repository', type: 'text', required: false, description: 'Specific repository (leave empty for all)', placeholder: 'my-repo' },
  ],
  jenkins: [
    { name: 'baseUrl', label: 'Jenkins URL', type: 'url', required: true, description: 'Base URL of your Jenkins instance', placeholder: 'https://jenkins.example.com' },
    { name: 'username', label: 'Username', type: 'text', required: true, description: 'Jenkins username', placeholder: 'admin' },
    { name: 'apiToken', label: 'API Token', type: 'password', required: true, description: 'Jenkins API token', placeholder: 'Your Jenkins API token' },
  ],
  pagerduty: [
    { name: 'apiKey', label: 'API Key', type: 'password', required: true, description: 'PagerDuty API key', placeholder: 'Your PagerDuty API key' },
    { name: 'serviceId', label: 'Service ID', type: 'text', required: false, description: 'Default service ID', placeholder: 'P1234567' },
  ],
  sentry: [
    { name: 'organization', label: 'Organization', type: 'text', required: true, description: 'Sentry organization slug', placeholder: 'my-org' },
    { name: 'project', label: 'Project', type: 'text', required: true, description: 'Sentry project slug', placeholder: 'my-project' },
    { name: 'authToken', label: 'Auth Token', type: 'password', required: true, description: 'Sentry authentication token', placeholder: 'Your Sentry auth token' },
  ],
  sonarqube: [
    { name: 'baseUrl', label: 'SonarQube URL', type: 'url', required: true, description: 'Base URL of your SonarQube instance', placeholder: 'https://sonar.example.com' },
    { name: 'apiToken', label: 'API Token', type: 'password', required: true, description: 'SonarQube API token', placeholder: 'Your SonarQube token' },
  ],
  argocd: [
    { name: 'baseUrl', label: 'ArgoCD URL', type: 'url', required: true, description: 'ArgoCD server URL', placeholder: 'https://argocd.example.com' },
    { name: 'authToken', label: 'Auth Token', type: 'password', required: true, description: 'ArgoCD authentication token', placeholder: 'Your ArgoCD token' },
    { name: 'appNameSelector', label: 'App Selector', type: 'text', required: false, description: 'Regex to filter applications', placeholder: '.*' },
  ],
};

export default function BackstageMarketplace() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [installing, setInstalling] = useState<string | null>(null);
  const [configuringPlugin, setConfiguringPlugin] = useState<Plugin | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchPlugins();
  }, []);

  const fetchPlugins = async () => {
    try {
      const response = await fetch('/api/backstage-plugins');
      const data = await response.json();
      
      if (data.success) {
        // Load installed state from localStorage
        const installedPlugins = JSON.parse(localStorage.getItem('installed-plugins') || '{}');
        
        // For demo, mark some popular plugins as installed
        const demoInstalledPlugins = [
          '@backstage/plugin-techdocs',
          '@backstage/plugin-catalog',
          '@backstage/plugin-scaffolder',
          '@backstage/plugin-kubernetes',
          '@backstage/plugin-github-actions'
        ];
        
        const pluginsWithState = data.plugins.map((plugin: Plugin) => {
          const isInstalled = installedPlugins[plugin.id]?.installed || 
                            demoInstalledPlugins.includes(plugin.id) || 
                            plugin.installed;
          const isEnabled = installedPlugins[plugin.id]?.enabled || 
                          (isInstalled && ['@backstage/plugin-techdocs', '@backstage/plugin-catalog', '@backstage/plugin-scaffolder'].includes(plugin.id));
          
          return {
            ...plugin,
            installed: isInstalled,
            enabled: isEnabled,
          };
        });
        setPlugins(pluginsWithState);
      }
    } catch (error) {
      console.error('Failed to fetch plugins:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPlugins = plugins.filter(plugin => {
    const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plugin.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plugin.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleInstall = async (plugin: Plugin) => {
    setInstalling(plugin.id);
    
    // Simulate installation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update state
    const updatedPlugins = plugins.map(p => 
      p.id === plugin.id ? { ...p, installed: true } : p
    );
    setPlugins(updatedPlugins);
    
    // Save to localStorage
    const installedPlugins = JSON.parse(localStorage.getItem('installed-plugins') || '{}');
    installedPlugins[plugin.id] = { installed: true, enabled: false };
    localStorage.setItem('installed-plugins', JSON.stringify(installedPlugins));
    
    setInstalling(null);
  };

  const handleToggle = (plugin: Plugin) => {
    const updatedPlugins = plugins.map(p => 
      p.id === plugin.id ? { ...p, enabled: !p.enabled } : p
    );
    setPlugins(updatedPlugins);
    
    // Save to localStorage
    const installedPlugins = JSON.parse(localStorage.getItem('installed-plugins') || '{}');
    installedPlugins[plugin.id] = { ...installedPlugins[plugin.id], enabled: !plugin.enabled };
    localStorage.setItem('installed-plugins', JSON.stringify(installedPlugins));
  };

  const handleConfigure = (plugin: Plugin) => {
    console.log('Configuring plugin:', plugin.id);
    setConfiguringPlugin(plugin);
    
    // Load saved config
    const savedConfigs = JSON.parse(localStorage.getItem('plugin-configs') || '{}');
    setConfigValues(savedConfigs[plugin.id] || {});
  };

  const handleSaveConfig = () => {
    if (!configuringPlugin) return;
    
    // Save config to localStorage
    const savedConfigs = JSON.parse(localStorage.getItem('plugin-configs') || '{}');
    savedConfigs[configuringPlugin.id] = configValues;
    localStorage.setItem('plugin-configs', JSON.stringify(savedConfigs));
    
    // Close modal
    setConfiguringPlugin(null);
    setConfigValues({});
  };

  const getConfigFields = (pluginId: string): ConfigField[] => {
    // Extract the plugin name from various formats
    let simplifiedId = pluginId
      .replace('@backstage/plugin-', '')
      .replace('@roadiehq/backstage-plugin-', '')
      .replace('@spotify/backstage-plugin-', '')
      .replace('backstage-plugin-', '')
      .replace('plugin-', '');
    
    // Handle special cases
    if (simplifiedId.includes('github-actions')) simplifiedId = 'github-actions';
    if (simplifiedId.includes('argo-cd')) simplifiedId = 'argocd';
    
    console.log('Getting config for:', pluginId, '->', simplifiedId);
    return PLUGIN_CONFIGS[simplifiedId] || [];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Package className="w-12 h-12 animate-pulse text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading Backstage plugins...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Backstage Plugin Marketplace</h1>
        <p className="text-blue-100">
          Browse and install official Backstage plugins with one-click configuration
        </p>
        <div className="mt-4 flex items-center gap-4 text-sm">
          <span className="flex items-center">
            <Package className="w-4 h-4 mr-1" />
            {plugins.length} plugins available
          </span>
          <span className="flex items-center">
            <CheckCircle className="w-4 h-4 mr-1" />
            {plugins.filter(p => p.installed).length} installed
          </span>
        </div>
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
                  {cat === 'all' ? 'All Categories' : cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
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
                <Package className="w-10 h-10 text-blue-600 mr-3 flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {plugin.title}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    v{plugin.version} by {plugin.author}
                  </p>
                </div>
              </div>
              {plugin.installed && (
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                  plugin.enabled 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {plugin.enabled ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                  {plugin.enabled ? 'Enabled' : 'Disabled'}
                </span>
              )}
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm line-clamp-2">
              {plugin.description}
            </p>

            <div className="flex flex-wrap gap-2 mb-4">
              {plugin.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
              {plugin.tags.length > 3 && (
                <span className="px-2 py-1 text-gray-500 dark:text-gray-400 text-xs">
                  +{plugin.tags.length - 3} more
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
              <span className="flex items-center">
                <Download className="w-4 h-4 mr-1" />
                {plugin.downloads.toLocaleString()}
              </span>
              {plugin.homepage && (
                <a 
                  href={plugin.homepage} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center hover:text-blue-600"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            <div className="flex gap-2">
              {!plugin.installed ? (
                <button
                  onClick={() => handleInstall(plugin)}
                  disabled={installing === plugin.id}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {installing === plugin.id ? 'Installing...' : 'Install'}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleToggle(plugin)}
                    className={`flex-1 px-4 py-2 rounded-lg ${
                      plugin.enabled
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {plugin.enabled ? 'Disable' : 'Enable'}
                  </button>
                  {plugin.configurable && (
                    <button 
                      onClick={() => handleConfigure(plugin)}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Configuration Modal */}
      {configuringPlugin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Configure {configuringPlugin.title}
                </h2>
                <button
                  onClick={() => {
                    setConfiguringPlugin(null);
                    setConfigValues({});
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {getConfigFields(configuringPlugin.id).length > 0 ? (
                <div className="space-y-4">
                  {getConfigFields(configuringPlugin.id).map((field) => (
                    <div key={field.name}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {field.type === 'boolean' ? (
                        <input
                          type="checkbox"
                          checked={configValues[field.name] || false}
                          onChange={(e) => setConfigValues({
                            ...configValues,
                            [field.name]: e.target.checked
                          })}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                      ) : field.type === 'select' && field.options ? (
                        <select
                          value={configValues[field.name] || ''}
                          onChange={(e) => setConfigValues({
                            ...configValues,
                            [field.name]: e.target.value
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        >
                          <option value="">Select...</option>
                          {field.options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === 'password' ? 'password' : 'text'}
                          value={configValues[field.name] || ''}
                          onChange={(e) => setConfigValues({
                            ...configValues,
                            [field.name]: e.target.value
                          })}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                      )}
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {field.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-400">
                  No configuration options available for this plugin.
                </p>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setConfiguringPlugin(null);
                  setConfigValues({});
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}