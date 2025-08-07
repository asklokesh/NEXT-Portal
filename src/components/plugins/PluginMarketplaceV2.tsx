'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, Filter, Package, Download, Settings, CheckCircle, 
  XCircle, ExternalLink, X, Save, ChevronRight, Info, 
  Shield, TrendingUp, Star, AlertCircle, RefreshCw,
  Clock, Users, Code, Book, PlayCircle, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  downloads?: number;
  stars?: number;
  npm?: string;
  repository?: string;
  homepage?: string;
  premium?: boolean;
  featured?: boolean;
}

interface ConfigField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'number' | 'boolean' | 'select' | 'json' | 'yaml';
  required: boolean;
  description: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  value?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

interface PluginSetupWizardProps {
  plugin: Plugin;
  onClose: () => void;
  onComplete: (config: any) => void;
}

const PluginSetupWizard: React.FC<PluginSetupWizardProps> = ({ plugin, onClose, onComplete }) => {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<Record<string, any>>({});
  
  const steps = [
    { title: 'Welcome', description: `Configure ${plugin.title}` },
    { title: 'Connection', description: 'Set up connection details' },
    { title: 'Authentication', description: 'Configure authentication' },
    { title: 'Options', description: 'Additional settings' },
    { title: 'Review', description: 'Review and confirm' }
  ];
  
  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(config);
    }
  };
  
  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Wizard Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Setup Wizard</h2>
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center space-x-2">
            {steps.map((s, i) => (
              <React.Fragment key={i}>
                <div className={`flex items-center ${i <= step ? 'text-white' : 'text-white/50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    i < step ? 'bg-green-500' : i === step ? 'bg-white text-blue-600' : 'bg-white/20'
                  }`}>
                    {i < step ? <CheckCircle className="w-5 h-5" /> : i + 1}
                  </div>
                  <span className="ml-2 text-sm hidden sm:inline">{s.title}</span>
                </div>
                {i < steps.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-white/30" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
        
        {/* Wizard Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: '60vh' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {steps[step].title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {steps[step].description}
                </p>
              </div>
              
              {/* Step Content */}
              {step === 0 && (
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                      About {plugin.title}
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      {plugin.description}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Version</div>
                      <div className="font-medium">{plugin.version}</div>
                    </div>
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <div className="text-sm text-gray-500 dark:text-gray-400">Author</div>
                      <div className="font-medium">{plugin.author}</div>
                    </div>
                  </div>
                </div>
              )}
              
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Server URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                      value={config.serverUrl || ''}
                      onChange={(e) => setConfig({ ...config, serverUrl: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Port
                    </label>
                    <input
                      type="number"
                      placeholder="443"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                      value={config.port || ''}
                      onChange={(e) => setConfig({ ...config, port: e.target.value })}
                    />
                  </div>
                </div>
              )}
              
              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      API Token
                    </label>
                    <input
                      type="password"
                      placeholder="Enter your API token"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                      value={config.apiToken || ''}
                      onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Username (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="admin"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                      value={config.username || ''}
                      onChange={(e) => setConfig({ ...config, username: e.target.value })}
                    />
                  </div>
                </div>
              )}
              
              {step === 3 && (
                <div className="space-y-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 dark:border-gray-600 mr-2"
                      checked={config.enableNotifications || false}
                      onChange={(e) => setConfig({ ...config, enableNotifications: e.target.checked })}
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable notifications
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 dark:border-gray-600 mr-2"
                      checked={config.autoSync || false}
                      onChange={(e) => setConfig({ ...config, autoSync: e.target.checked })}
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Enable automatic synchronization
                    </span>
                  </label>
                </div>
              )}
              
              {step === 4 && (
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                      Configuration Summary
                    </h4>
                    <dl className="space-y-2">
                      {Object.entries(config).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm">
                          <dt className="text-gray-500 dark:text-gray-400">
                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                          </dt>
                          <dd className="font-medium text-gray-900 dark:text-gray-100">
                            {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : 
                             key.includes('Token') || key.includes('password') ? '••••••' : value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Wizard Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex justify-between">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {step === steps.length - 1 ? 'Complete Setup' : 'Next'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function PluginMarketplaceV2() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showOnlyInstalled, setShowOnlyInstalled] = useState(false);
  const [showOnlyFeatured, setShowOnlyFeatured] = useState(false);
  const [setupPlugin, setSetupPlugin] = useState<Plugin | null>(null);
  const [installingPlugins, setInstallingPlugins] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    fetchPlugins();
  }, []);
  
  const fetchPlugins = async () => {
    try {
      const response = await fetch('/api/backstage-plugins');
      const data = await response.json();
      
      if (data.success) {
        setPlugins(data.plugins);
        setCategories(['all', ...data.categories]);
      }
    } catch (error) {
      console.error('Failed to fetch plugins:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleInstall = async (plugin: Plugin) => {
    setInstallingPlugins(prev => new Set(prev).add(plugin.id));
    
    // Show setup wizard for configuration
    setSetupPlugin(plugin);
  };
  
  const handleSetupComplete = async (plugin: Plugin, config: any) => {
    // Simulate installation with config
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update plugin state
    setPlugins(prev => prev.map(p => 
      p.id === plugin.id ? { ...p, installed: true, enabled: true } : p
    ));
    
    // Save configuration
    const configs = JSON.parse(localStorage.getItem('plugin-configs') || '{}');
    configs[plugin.id] = config;
    localStorage.setItem('plugin-configs', JSON.stringify(configs));
    
    setInstallingPlugins(prev => {
      const newSet = new Set(prev);
      newSet.delete(plugin.id);
      return newSet;
    });
    
    setSetupPlugin(null);
  };
  
  const handleTogglePlugin = (plugin: Plugin) => {
    setPlugins(prev => prev.map(p => 
      p.id === plugin.id ? { ...p, enabled: !p.enabled } : p
    ));
  };
  
  const handleUninstall = (plugin: Plugin) => {
    setPlugins(prev => prev.map(p => 
      p.id === plugin.id ? { ...p, installed: false, enabled: false } : p
    ));
  };
  
  const filteredPlugins = useMemo(() => {
    return plugins.filter(plugin => {
      const matchesSearch = !searchQuery || 
        plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plugin.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plugin.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;
      const matchesInstalled = !showOnlyInstalled || plugin.installed;
      const matchesFeatured = !showOnlyFeatured || plugin.featured;
      
      return matchesSearch && matchesCategory && matchesInstalled && matchesFeatured;
    });
  }, [plugins, searchQuery, selectedCategory, showOnlyInstalled, showOnlyFeatured]);
  
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    plugins.forEach(p => {
      stats[p.category] = (stats[p.category] || 0) + 1;
    });
    return stats;
  }, [plugins]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Package className="w-12 h-12 animate-pulse text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading plugin marketplace...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-8 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Plugin Marketplace</h1>
            <p className="text-blue-100">
              Backstage in a box - No-code plugin management
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{plugins.length}</div>
            <div className="text-blue-100">Total Plugins</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span className="text-2xl font-bold">
                {plugins.filter(p => p.installed).length}
              </span>
            </div>
            <div className="text-sm text-blue-100 mt-1">Installed</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              <span className="text-2xl font-bold">
                {plugins.filter(p => p.enabled).length}
              </span>
            </div>
            <div className="text-sm text-blue-100 mt-1">Active</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center">
              <Star className="w-5 h-5 mr-2" />
              <span className="text-2xl font-bold">
                {plugins.filter(p => p.featured).length}
              </span>
            </div>
            <div className="text-sm text-blue-100 mt-1">Featured</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <div className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              <span className="text-2xl font-bold">
                {plugins.filter(p => p.premium).length}
              </span>
            </div>
            <div className="text-sm text-blue-100 mt-1">Premium</div>
          </div>
        </div>
      </div>
      
      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search plugins by name, description, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat.split('-').map(w => 
                    w.charAt(0).toUpperCase() + w.slice(1)
                  ).join(' ')}
                  {categoryStats[cat] && ` (${categoryStats[cat]})`}
                </option>
              ))}
            </select>
            
            <button
              onClick={() => setShowOnlyInstalled(!showOnlyInstalled)}
              className={`px-4 py-2 border rounded-lg ${
                showOnlyInstalled 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              Installed
            </button>
            
            <button
              onClick={() => setShowOnlyFeatured(!showOnlyFeatured)}
              className={`px-4 py-2 border rounded-lg ${
                showOnlyFeatured 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              Featured
            </button>
          </div>
        </div>
      </div>
      
      {/* Plugin Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlugins.map((plugin) => (
          <motion.div
            key={plugin.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-all"
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
              
              <div className="flex flex-col items-end gap-1">
                {plugin.featured && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    <Star className="w-3 h-3 mr-1" />
                    Featured
                  </span>
                )}
                {plugin.premium && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    <Shield className="w-3 h-3 mr-1" />
                    Premium
                  </span>
                )}
                {plugin.installed && (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    plugin.enabled 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {plugin.enabled ? (
                      <><CheckCircle className="w-3 h-3 mr-1" /> Active</>
                    ) : (
                      <><XCircle className="w-3 h-3 mr-1" /> Inactive</>
                    )}
                  </span>
                )}
              </div>
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
                {(plugin.downloads || Math.floor(Math.random() * 100000)).toLocaleString()}
              </span>
              <div className="flex gap-2">
                {plugin.repository && (
                  <a 
                    href={plugin.repository} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:text-blue-600"
                  >
                    <Code className="w-4 h-4" />
                  </a>
                )}
                {plugin.homepage && (
                  <a 
                    href={plugin.homepage} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:text-blue-600"
                  >
                    <Book className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              {!plugin.installed ? (
                <button
                  onClick={() => handleInstall(plugin)}
                  disabled={installingPlugins.has(plugin.id)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {installingPlugins.has(plugin.id) ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4 mr-2" />
                      Quick Install
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleTogglePlugin(plugin)}
                    className={`flex-1 px-4 py-2 rounded-lg ${
                      plugin.enabled
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        : 'bg-green-600 text-white'
                    }`}
                  >
                    {plugin.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button 
                    onClick={() => setSetupPlugin(plugin)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleUninstall(plugin)}
                    className="px-4 py-2 border border-red-300 dark:border-red-600 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Setup Wizard */}
      {setupPlugin && (
        <PluginSetupWizard
          plugin={setupPlugin}
          onClose={() => setSetupPlugin(null)}
          onComplete={(config) => handleSetupComplete(setupPlugin, config)}
        />
      )}
    </div>
  );
}