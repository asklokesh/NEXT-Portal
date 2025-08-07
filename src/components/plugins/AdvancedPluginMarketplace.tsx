'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, Filter, Package, Download, Settings, CheckCircle, 
  XCircle, ExternalLink, X, Save, ChevronRight, Info, 
  Shield, TrendingUp, Star, AlertCircle, RefreshCw,
  Clock, Users, Code, Book, PlayCircle, ChevronDown,
  Grid, List, SortAsc, SortDesc, Calendar, Award,
  Zap, Heart, Eye, GitBranch, Activity, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DependencyResolver from './DependencyResolver';
import PluginSetupModal from './PluginSetupModal';

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
  lastUpdate?: string;
  maintainers?: number;
  license?: string;
}

interface PluginFilters {
  search: string;
  category: string;
  featured: boolean;
  installed: boolean;
  premium: boolean;
  sortBy: 'popularity' | 'downloads' | 'stars' | 'name' | 'updated';
  sortOrder: 'asc' | 'desc';
}

interface PluginMarketplaceState {
  plugins: Plugin[];
  categories: string[];
  loading: boolean;
  error: string | null;
  total: number;
  hasMore: boolean;
  offset: number;
}

const ITEMS_PER_PAGE = 24;

export default function AdvancedPluginMarketplace() {
  const [state, setState] = useState<PluginMarketplaceState>({
    plugins: [],
    categories: [],
    loading: true,
    error: null,
    total: 0,
    hasMore: false,
    offset: 0
  });
  
  const [filters, setFilters] = useState<PluginFilters>({
    search: '',
    category: 'all',
    featured: false,
    installed: false,
    premium: false,
    sortBy: 'popularity',
    sortOrder: 'desc'
  });
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [installingPlugins, setInstallingPlugins] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [selectedForAnalysis, setSelectedForAnalysis] = useState<Set<string>>(new Set());
  const [showDependencyResolver, setShowDependencyResolver] = useState(false);
  
  const fetchPlugins = useCallback(async (reset = true) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const params = new URLSearchParams({
        search: filters.search,
        category: filters.category,
        featured: filters.featured.toString(),
        installed: filters.installed.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        offset: reset ? '0' : state.offset.toString()
      });
      
      const response = await fetch(`/api/backstage-plugins-real?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setState(prev => ({
          ...prev,
          plugins: reset ? data.plugins : [...prev.plugins, ...data.plugins],
          categories: data.categories,
          total: data.total,
          hasMore: data.pagination.hasMore,
          offset: reset ? ITEMS_PER_PAGE : prev.offset + ITEMS_PER_PAGE,
          loading: false
        }));
      } else {
        setState(prev => ({ ...prev, error: data.error, loading: false }));
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to fetch plugins', 
        loading: false 
      }));
    }
  }, [filters, state.offset]);
  
  useEffect(() => {
    fetchPlugins(true);
  }, [filters.search, filters.category, filters.featured, filters.installed]);
  
  const sortedPlugins = useMemo(() => {
    const sorted = [...state.plugins];
    
    switch (filters.sortBy) {
      case 'downloads':
        return sorted.sort((a, b) => {
          const aVal = a.downloads || 0;
          const bVal = b.downloads || 0;
          return filters.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
      case 'stars':
        return sorted.sort((a, b) => {
          const aVal = a.stars || 0;
          const bVal = b.stars || 0;
          return filters.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        });
      case 'name':
        return sorted.sort((a, b) => {
          return filters.sortOrder === 'asc' 
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        });
      case 'updated':
        return sorted.sort((a, b) => {
          const aDate = new Date(a.lastUpdate || 0).getTime();
          const bDate = new Date(b.lastUpdate || 0).getTime();
          return filters.sortOrder === 'asc' ? aDate - bDate : bDate - aDate;
        });
      default: // popularity
        return sorted.sort((a, b) => {
          const aScore = (a.downloads || 0) + (a.stars || 0) * 10;
          const bScore = (b.downloads || 0) + (b.stars || 0) * 10;
          return filters.sortOrder === 'asc' ? aScore - bScore : bScore - aScore;
        });
    }
  }, [state.plugins, filters.sortBy, filters.sortOrder]);
  
  const filteredPlugins = useMemo(() => {
    return sortedPlugins.filter(plugin => {
      if (filters.premium && !plugin.premium) return false;
      return true;
    });
  }, [sortedPlugins, filters.premium]);
  
  const handleInstall = async (plugin: Plugin) => {
    setInstallingPlugins(prev => new Set(prev).add(plugin.id));
    setSelectedPlugin(plugin);
  };
  
  const handleSetupComplete = async (plugin: Plugin, config: any) => {
    // Simulate installation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setState(prev => ({
      ...prev,
      plugins: prev.plugins.map(p => 
        p.id === plugin.id ? { ...p, installed: true, enabled: true } : p
      )
    }));
    
    setInstallingPlugins(prev => {
      const newSet = new Set(prev);
      newSet.delete(plugin.id);
      return newSet;
    });
    
    setSelectedPlugin(null);
  };
  
  const handleTogglePlugin = (plugin: Plugin) => {
    setState(prev => ({
      ...prev,
      plugins: prev.plugins.map(p => 
        p.id === plugin.id ? { ...p, enabled: !p.enabled } : p
      )
    }));
  };
  
  const updateFilter = (key: keyof PluginFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const loadMore = () => {
    fetchPlugins(false);
  };

  const handlePluginSelect = (pluginId: string) => {
    setSelectedForAnalysis(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pluginId)) {
        newSet.delete(pluginId);
      } else {
        newSet.add(pluginId);
      }
      
      // Show dependency resolver if plugins are selected
      if (newSet.size > 0) {
        setShowDependencyResolver(true);
      } else {
        setShowDependencyResolver(false);
      }
      
      return newSet;
    });
  };

  const handleAddPluginFromResolver = (pluginId: string) => {
    setSelectedForAnalysis(prev => new Set(prev).add(pluginId));
  };

  const handleRemovePluginFromResolver = (pluginId: string) => {
    setSelectedForAnalysis(prev => {
      const newSet = new Set(prev);
      newSet.delete(pluginId);
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedForAnalysis(new Set());
    setShowDependencyResolver(false);
  };
  
  const getPluginIcon = (category: string) => {
    const icons = {
      core: Layers,
      infrastructure: Zap,
      'ci-cd': GitBranch,
      monitoring: Activity,
      security: Shield,
      quality: Award,
      documentation: Book,
      communication: Users,
      analytics: TrendingUp,
      cost: Info,
      other: Package
    };
    
    const Icon = icons[category as keyof typeof icons] || Package;
    return <Icon className="w-10 h-10 text-blue-600" />;
  };
  
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };
  
  const getCategoryColor = (category: string) => {
    const colors = {
      core: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      infrastructure: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'ci-cd': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      monitoring: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      security: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      quality: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    };
    
    return colors[category as keyof typeof colors] || colors.default;
  };
  
  if (state.loading && state.plugins.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Package className="w-16 h-16 animate-pulse text-blue-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading Plugin Marketplace
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Fetching 500+ plugins from NPM registry...
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 rounded-xl p-8 text-white">
        <div className="max-w-4xl">
          <h1 className="text-4xl font-bold mb-4">
            Backstage Plugin Marketplace
          </h1>
          <p className="text-xl text-blue-100 mb-6">
            Discover, install, and manage 500+ Backstage plugins with our no-code interface
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <Package className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{state.total}</div>
                  <div className="text-sm text-blue-100">Total Plugins</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">
                    {state.plugins.filter(p => p.installed).length}
                  </div>
                  <div className="text-sm text-blue-100">Installed</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <Star className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">
                    {state.plugins.filter(p => p.featured).length}
                  </div>
                  <div className="text-sm text-blue-100">Featured</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <Shield className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">
                    {state.plugins.filter(p => p.premium).length}
                  </div>
                  <div className="text-sm text-blue-100">Premium</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filters and Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search plugins by name, description, author, or tags..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 py-2 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400'} rounded-l-lg`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400'} rounded-r-lg`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
          
          {/* Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
          >
            <Filter className="w-5 h-5 mr-2" />
            Filters
            <ChevronDown className={`w-4 h-4 ml-2 transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Dependency Analysis Toggle */}
          <button
            onClick={() => setShowDependencyResolver(!showDependencyResolver)}
            className={`px-4 py-2 border rounded-lg flex items-center ${
              selectedForAnalysis.size > 0 
                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' 
                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            <GitBranch className="w-5 h-5 mr-2" />
            Dependency Analysis
            {selectedForAnalysis.size > 0 && (
              <span className="ml-2 px-2 py-1 bg-blue-600 text-white text-xs rounded-full">
                {selectedForAnalysis.size}
              </span>
            )}
          </button>
        </div>
        
        {/* Advanced Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={filters.category}
                    onChange={(e) => updateFilter('category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  >
                    {state.categories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat === 'all' ? 'All Categories' : 
                         cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* Sort By */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sort By
                  </label>
                  <select
                    value={filters.sortBy}
                    onChange={(e) => updateFilter('sortBy', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  >
                    <option value="popularity">Popularity</option>
                    <option value="downloads">Downloads</option>
                    <option value="stars">Stars</option>
                    <option value="name">Name</option>
                    <option value="updated">Last Updated</option>
                  </select>
                </div>
                
                {/* Sort Order */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Order
                  </label>
                  <button
                    onClick={() => updateFilter('sortOrder', filters.sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center"
                  >
                    {filters.sortOrder === 'asc' ? (
                      <><SortAsc className="w-4 h-4 mr-2" /> Ascending</>
                    ) : (
                      <><SortDesc className="w-4 h-4 mr-2" /> Descending</>
                    )}
                  </button>
                </div>
                
                {/* Quick Filters */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Quick Filters
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.featured}
                        onChange={(e) => updateFilter('featured', e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 mr-2"
                      />
                      <span className="text-sm">Featured Only</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.premium}
                        onChange={(e) => updateFilter('premium', e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 mr-2"
                      />
                      <span className="text-sm">Premium Only</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.installed}
                        onChange={(e) => updateFilter('installed', e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 mr-2"
                      />
                      <span className="text-sm">Installed Only</span>
                    </label>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected Plugins Summary */}
        {selectedForAnalysis.size > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <GitBranch className="w-5 h-5 text-blue-600 mr-2" />
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  Selected for Analysis ({selectedForAnalysis.size})
                </span>
              </div>
              <button
                onClick={clearSelection}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from(selectedForAnalysis).map(pluginId => {
                const plugin = state.plugins.find(p => p.id === pluginId);
                return plugin ? (
                  <span
                    key={pluginId}
                    className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-sm"
                  >
                    {plugin.name}
                    <button
                      onClick={() => handlePluginSelect(pluginId)}
                      className="ml-2 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>

      {/* Dependency Resolver */}
      <AnimatePresence>
        {showDependencyResolver && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <DependencyResolver
              selectedPlugins={Array.from(selectedForAnalysis)}
              onPluginAdd={handleAddPluginFromResolver}
              onPluginRemove={handleRemovePluginFromResolver}
              className="mb-6"
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Error State */}
      {state.error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <span className="text-red-800 dark:text-red-200">{state.error}</span>
          </div>
        </div>
      )}
      
      {/* Plugin Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPlugins.map((plugin) => (
            <PluginCard 
              key={plugin.id} 
              plugin={plugin}
              onInstall={() => handleInstall(plugin)}
              onToggle={() => handleTogglePlugin(plugin)}
              onConfigure={() => setSelectedPlugin(plugin)}
              onSelect={handlePluginSelect}
              isInstalling={installingPlugins.has(plugin.id)}
              isSelected={selectedForAnalysis.has(plugin.id)}
              getPluginIcon={getPluginIcon}
              getCategoryColor={getCategoryColor}
              formatNumber={formatNumber}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPlugins.map((plugin) => (
            <PluginListItem 
              key={plugin.id} 
              plugin={plugin}
              onInstall={() => handleInstall(plugin)}
              onToggle={() => handleTogglePlugin(plugin)}
              onConfigure={() => setSelectedPlugin(plugin)}
              onSelect={handlePluginSelect}
              isInstalling={installingPlugins.has(plugin.id)}
              isSelected={selectedForAnalysis.has(plugin.id)}
              getPluginIcon={getPluginIcon}
              getCategoryColor={getCategoryColor}
              formatNumber={formatNumber}
            />
          ))}
        </div>
      )}
      
      {/* Load More Button */}
      {state.hasMore && (
        <div className="text-center">
          <button
            onClick={loadMore}
            disabled={state.loading}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center mx-auto"
          >
            {state.loading ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Loading More...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Load More Plugins
              </>
            )}
          </button>
        </div>
      )}
      
      {/* Plugin Setup Modal */}
      {selectedPlugin && (
        <PluginSetupModal
          plugin={selectedPlugin}
          onClose={() => setSelectedPlugin(null)}
          onComplete={(config) => handleSetupComplete(selectedPlugin, config)}
        />
      )}
    </div>
  );
}

// Plugin Card Component
const PluginCard = ({ plugin, onInstall, onToggle, onConfigure, onSelect, isInstalling, isSelected, getPluginIcon, getCategoryColor, formatNumber }: any) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6 hover:shadow-lg transition-all ${
      isSelected ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-gray-200 dark:border-gray-700'
    }`}
  >
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(plugin.id)}
          className="mr-3 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
        />
        {getPluginIcon(plugin.category)}
        <div className="ml-3 min-w-0">
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
      </div>
    </div>
    
    <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm line-clamp-3">
      {plugin.description}
    </p>
    
    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(plugin.category)}`}>
        {plugin.category}
      </span>
      <div className="flex items-center space-x-3">
        <span className="flex items-center">
          <Download className="w-4 h-4 mr-1" />
          {formatNumber(plugin.downloads || 0)}
        </span>
        {plugin.stars && (
          <span className="flex items-center">
            <Star className="w-4 h-4 mr-1" />
            {formatNumber(plugin.stars)}
          </span>
        )}
      </div>
    </div>
    
    <div className="flex gap-2">
      {!plugin.installed ? (
        <button
          onClick={onInstall}
          disabled={isInstalling}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isInstalling ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Installing...
            </>
          ) : (
            <>
              <PlayCircle className="w-4 h-4 mr-2" />
              Install
            </>
          )}
        </button>
      ) : (
        <>
          <button
            onClick={onToggle}
            className={`flex-1 px-4 py-2 rounded-lg ${
              plugin.enabled
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                : 'bg-green-600 text-white'
            }`}
          >
            {plugin.enabled ? 'Disable' : 'Enable'}
          </button>
          <button 
            onClick={onConfigure}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <Settings className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  </motion.div>
);

// Plugin List Item Component
const PluginListItem = ({ plugin, onInstall, onToggle, onConfigure, onSelect, isInstalling, isSelected, getPluginIcon, getCategoryColor, formatNumber }: any) => (
  <motion.div
    layout
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6 hover:shadow-lg transition-all ${
      isSelected ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-gray-200 dark:border-gray-700'
    }`}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center flex-1 min-w-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(plugin.id)}
          className="mr-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
        />
        {getPluginIcon(plugin.category)}
        <div className="ml-4 flex-1 min-w-0">
          <div className="flex items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {plugin.title}
            </h3>
            {plugin.featured && (
              <Star className="w-4 h-4 ml-2 text-yellow-500" />
            )}
            {plugin.premium && (
              <Shield className="w-4 h-4 ml-2 text-purple-500" />
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
            {plugin.description}
          </p>
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <span>v{plugin.version}</span>
            <span>by {plugin.author}</span>
            <span className={`px-2 py-1 rounded-full text-xs ${getCategoryColor(plugin.category)}`}>
              {plugin.category}
            </span>
            <span className="flex items-center">
              <Download className="w-3 h-3 mr-1" />
              {formatNumber(plugin.downloads || 0)}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center space-x-2 ml-4">
        {!plugin.installed ? (
          <button
            onClick={onInstall}
            disabled={isInstalling}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isInstalling ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Installing...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2" />
                Install
              </>
            )}
          </button>
        ) : (
          <>
            <button
              onClick={onToggle}
              className={`px-4 py-2 rounded-lg ${
                plugin.enabled
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  : 'bg-green-600 text-white'
              }`}
            >
              {plugin.enabled ? 'Disable' : 'Enable'}
            </button>
            <button 
              onClick={onConfigure}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Settings className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  </motion.div>
);

// Plugin Setup Modal Component (simplified for space)
const PluginSetupModal = ({ plugin, onClose, onComplete }: any) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden"
    >
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Configure {plugin.title}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
      <div className="p-6">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {plugin.description}
        </p>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            This plugin will be configured with default settings. You can modify the configuration later.
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => onComplete({})}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Install Plugin
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  </div>
);