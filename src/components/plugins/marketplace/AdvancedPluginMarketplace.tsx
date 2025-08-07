'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { 
  Search, 
  Filter, 
  Grid3X3, 
  List, 
  Star, 
  Download, 
  Shield, 
  Package, 
  GitBranch, 
  Database,
  Code,
  Sparkles,
  Layers,
  Terminal,
  Globe,
  Zap,
  Settings,
  Info,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  TrendingUp,
  Clock,
  Users,
  Heart,
  Award,
  Activity,
  ChevronDown,
  SlidersHorizontal,
  ArrowUpDown
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';
import { MarketplacePluginCard } from './MarketplacePluginCard';
import { PluginDetailModal } from './PluginDetailModal';
import { InstallationWizard } from './InstallationWizard';
import { PluginComparison } from './PluginComparison';
import { PluginFilters } from './PluginFilters';
import { FeaturedPluginsCarousel } from './FeaturedPluginsCarousel';
import { RecommendationsPanel } from './RecommendationsPanel';

interface MarketplaceState {
  searchQuery: string;
  selectedCategory: string;
  viewMode: 'grid' | 'list';
  sortBy: 'popularity' | 'name' | 'recent' | 'downloads' | 'rating';
  sortOrder: 'asc' | 'desc';
  filters: {
    compatibility: string[];
    pricing: string[];
    tags: string[];
    organization: string[];
    minRating: number;
    onlyOfficial: boolean;
    onlyInstalled: boolean;
    onlyRecent: boolean;
  };
  selectedPlugins: string[];
  showComparison: boolean;
}

const initialState: MarketplaceState = {
  searchQuery: '',
  selectedCategory: 'all',
  viewMode: 'grid',
  sortBy: 'popularity',
  sortOrder: 'desc',
  filters: {
    compatibility: [],
    pricing: [],
    tags: [],
    organization: [],
    minRating: 0,
    onlyOfficial: false,
    onlyInstalled: false,
    onlyRecent: false,
  },
  selectedPlugins: [],
  showComparison: false,
};

const CATEGORIES = [
  { id: 'all', name: 'All Plugins', icon: Package, color: 'text-gray-600', description: 'Browse all available plugins' },
  { id: 'featured', name: 'Featured', icon: Star, color: 'text-yellow-600', description: 'Hand-picked plugins' },
  { id: 'popular', name: 'Popular', icon: TrendingUp, color: 'text-purple-600', description: 'Most downloaded plugins' },
  { id: 'recent', name: 'Recent', icon: Clock, color: 'text-green-600', description: 'Recently added plugins' },
  { id: 'ci-cd', name: 'CI/CD', icon: GitBranch, color: 'text-blue-600', description: 'Continuous integration & deployment' },
  { id: 'monitoring', name: 'Monitoring', icon: Activity, color: 'text-red-600', description: 'Observability & monitoring tools' },
  { id: 'infrastructure', name: 'Infrastructure', icon: Database, color: 'text-indigo-600', description: 'Infrastructure management' },
  { id: 'security', name: 'Security', icon: Shield, color: 'text-orange-600', description: 'Security & compliance tools' },
  { id: 'analytics', name: 'Analytics', icon: Sparkles, color: 'text-pink-600', description: 'Analytics & insights' },
  { id: 'documentation', name: 'Docs', icon: Code, color: 'text-cyan-600', description: 'Documentation tools' },
  { id: 'cost-management', name: 'Cost', icon: Layers, color: 'text-teal-600', description: 'Cost optimization' },
  { id: 'development-tools', name: 'Dev Tools', icon: Terminal, color: 'text-emerald-600', description: 'Development utilities' },
];

export function AdvancedPluginMarketplace() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<MarketplaceState>(initialState);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [installingPlugin, setInstallingPlugin] = useState<string | null>(null);
  
  const debouncedSearch = useDebounce(state.searchQuery, 300);

  // Fetch plugins with enhanced data
  const { data: pluginsResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['marketplace-plugins', debouncedSearch, state.selectedCategory, state.filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: debouncedSearch,
        category: state.selectedCategory,
        ...Object.entries(state.filters).reduce((acc, [key, value]) => {
          if (Array.isArray(value) && value.length > 0) {
            acc[key] = value.join(',');
          } else if (typeof value === 'boolean' && value) {
            acc[key] = 'true';
          } else if (typeof value === 'number' && value > 0) {
            acc[key] = value.toString();
          }
          return acc;
        }, {} as Record<string, string>)
      });

      const response = await fetch(`/api/marketplace/plugins?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch plugins');
      }
      return await response.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const plugins = pluginsResponse?.plugins || [];

  // Enhanced plugin filtering and sorting
  const processedPlugins = useMemo(() => {
    let filtered = [...plugins];

    // Apply category filter
    if (state.selectedCategory !== 'all') {
      if (state.selectedCategory === 'featured') {
        filtered = filtered.filter(p => p.featured);
      } else if (state.selectedCategory === 'popular') {
        filtered = filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0)).slice(0, 20);
      } else if (state.selectedCategory === 'recent') {
        filtered = filtered.filter(p => {
          const daysSinceUpdate = Date.now() - new Date(p.lastUpdated || 0).getTime();
          return daysSinceUpdate < 30 * 24 * 60 * 60 * 1000; // 30 days
        });
      } else {
        filtered = filtered.filter(p => p.category === state.selectedCategory);
      }
    }

    // Apply additional filters
    if (state.filters.onlyOfficial) {
      filtered = filtered.filter(p => p.author === 'Backstage' || p.official);
    }
    if (state.filters.onlyInstalled) {
      filtered = filtered.filter(p => p.installed);
    }
    if (state.filters.minRating > 0) {
      filtered = filtered.filter(p => (p.rating || 0) >= state.filters.minRating);
    }

    // Sort plugins
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (state.sortBy) {
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'recent':
          comparison = new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime();
          break;
        case 'downloads':
          comparison = (b.downloads || 0) - (a.downloads || 0);
          break;
        case 'rating':
          comparison = (b.rating || 0) - (a.rating || 0);
          break;
        case 'popularity':
        default:
          const scoreA = (a.downloads || 0) + (a.stars || 0) * 10 + (a.rating || 0) * 100;
          const scoreB = (b.downloads || 0) + (b.stars || 0) * 10 + (b.rating || 0) * 100;
          comparison = scoreB - scoreA;
          break;
      }
      
      return state.sortOrder === 'desc' ? comparison : -comparison;
    });

    return filtered;
  }, [plugins, state.selectedCategory, state.filters, state.sortBy, state.sortOrder]);

  // Statistics
  const stats = useMemo(() => ({
    total: plugins.length,
    installed: plugins.filter(p => p.installed).length,
    available: plugins.filter(p => !p.installed).length,
    filtered: processedPlugins.length,
    categories: CATEGORIES.reduce((acc, cat) => {
      if (cat.id === 'all') return acc;
      acc[cat.id] = plugins.filter(p => p.category === cat.id).length;
      return acc;
    }, {} as Record<string, number>),
  }), [plugins, processedPlugins]);

  // Install plugin mutation
  const installMutation = useMutation({
    mutationFn: async (pluginId: string) => {
      const response = await fetch('/api/marketplace/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Installation failed');
      }
      
      return response.json();
    },
    onSuccess: (_, pluginId) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-plugins'] });
      const plugin = plugins.find(p => p.id === pluginId);
      toast.success(`${plugin?.title || 'Plugin'} installed successfully!`);
      setInstallingPlugin(null);
    },
    onError: (error: any, pluginId) => {
      toast.error(`Failed to install plugin: ${error.message}`);
      setInstallingPlugin(null);
    }
  });

  const handleInstallPlugin = useCallback((pluginId: string) => {
    setInstallingPlugin(pluginId);
    installMutation.mutate(pluginId);
  }, [installMutation]);

  const updateState = useCallback((updates: Partial<MarketplaceState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const togglePluginSelection = useCallback((pluginId: string) => {
    setState(prev => ({
      ...prev,
      selectedPlugins: prev.selectedPlugins.includes(pluginId)
        ? prev.selectedPlugins.filter(id => id !== pluginId)
        : [...prev.selectedPlugins, pluginId].slice(0, 3), // Max 3 for comparison
    }));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading marketplace...</p>
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
            Failed to load marketplace
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
      {/* Header with Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 rounded-xl p-8">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1 mb-6 lg:mb-0">
              <h1 className="text-4xl font-bold text-white mb-2">
                Plugin Marketplace
              </h1>
              <p className="text-blue-100 text-lg mb-4 max-w-2xl">
                Discover, install, and manage Backstage plugins with enterprise-grade security and no-code configuration.
              </p>
              <div className="flex flex-wrap items-center gap-4 text-white/90 text-sm">
                <span className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  {stats.total} plugins available
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  {stats.installed} installed
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  Enterprise security
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="w-4 h-4" />
                  One-click setup
                </span>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex flex-col gap-3">
              <a
                href="https://backstage.io/plugins"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 bg-white/10 backdrop-blur text-white font-medium rounded-lg hover:bg-white/20 transition-all"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Browse Official Registry
              </a>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-6 py-3 bg-white text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Advanced Filters
              </button>
            </div>
          </div>
        </div>
        
        {/* Floating Elements */}
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-purple-400/20 rounded-full blur-2xl" />
      </div>

      {/* Featured Plugins Carousel */}
      {plugins.filter(p => p.featured).length > 0 && (
        <FeaturedPluginsCarousel
          plugins={plugins.filter(p => p.featured)}
          onPluginSelect={setSelectedPlugin}
          onInstallPlugin={handleInstallPlugin}
          installingPlugin={installingPlugin}
        />
      )}

      {/* Search and Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        {/* Search Bar */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search plugins by name, description, tags, or functionality..."
            value={state.searchQuery}
            onChange={(e) => updateState({ searchQuery: e.target.value })}
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => updateState({ viewMode: 'grid' })}
              className={`p-2 ${state.viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => updateState({ viewMode: 'list' })}
              className={`p-2 ${state.viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Sort Controls */}
          <select
            value={`${state.sortBy}-${state.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-') as [any, 'asc' | 'desc'];
              updateState({ sortBy, sortOrder });
            }}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          >
            <option value="popularity-desc">Most Popular</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="recent-desc">Recently Updated</option>
            <option value="downloads-desc">Most Downloads</option>
            <option value="rating-desc">Highest Rated</option>
          </select>
        </div>
      </div>

      {/* Categories */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {CATEGORIES.map(category => {
          const Icon = category.icon;
          const count = category.id === 'all' ? stats.total : stats.categories[category.id] || 0;
          const isActive = state.selectedCategory === category.id;
          
          return (
            <button
              key={category.id}
              onClick={() => updateState({ selectedCategory: category.id })}
              className={`group p-4 rounded-lg border-2 transition-all hover:scale-105 ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600 shadow-lg'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md'
              }`}
              title={category.description}
            >
              <Icon className={`w-6 h-6 mx-auto mb-2 transition-colors ${
                isActive ? 'text-blue-600' : category.color
              }`} />
              <div className={`text-sm font-medium transition-colors ${
                isActive ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'
              }`}>
                {category.name}
              </div>
              <div className={`text-xs mt-1 transition-colors ${
                isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {count}
              </div>
            </button>
          );
        })}
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <PluginFilters
          filters={state.filters}
          onFiltersChange={(filters) => updateState({ filters })}
          availablePlugins={plugins}
        />
      )}

      {/* Plugin Comparison */}
      {state.selectedPlugins.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Compare Plugins ({state.selectedPlugins.length}/3)
            </h3>
            <div className="flex items-center gap-2">
              {state.selectedPlugins.length >= 2 && (
                <button
                  onClick={() => updateState({ showComparison: true })}
                  className="text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Compare
                </button>
              )}
              <button
                onClick={() => updateState({ selectedPlugins: [] })}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {state.selectedPlugins.map(pluginId => {
              const plugin = plugins.find(p => p.id === pluginId);
              return plugin ? (
                <span
                  key={pluginId}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                >
                  {plugin.title}
                  <button
                    onClick={() => togglePluginSelection(pluginId)}
                    className="text-blue-600 hover:text-blue-800 ml-1"
                  >
                    ×
                  </button>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {processedPlugins.length} of {stats.total} plugins
          {debouncedSearch && ` for "${debouncedSearch}"`}
          {state.selectedCategory !== 'all' && ` in ${CATEGORIES.find(c => c.id === state.selectedCategory)?.name}`}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {stats.installed} installed • {stats.available} available
        </div>
      </div>

      {/* Recommendations Panel */}
      {!debouncedSearch && state.selectedCategory === 'all' && (
        <RecommendationsPanel
          installedPlugins={plugins.filter(p => p.installed)}
          availablePlugins={plugins.filter(p => !p.installed)}
          onPluginSelect={setSelectedPlugin}
        />
      )}

      {/* Plugin Grid/List */}
      {processedPlugins.length > 0 ? (
        <div className={
          state.viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6'
            : 'space-y-4'
        }>
          {processedPlugins.map(plugin => (
            <MarketplacePluginCard
              key={plugin.id}
              plugin={plugin}
              viewMode={state.viewMode}
              isInstalling={installingPlugin === plugin.id}
              isSelected={state.selectedPlugins.includes(plugin.id)}
              onSelect={() => setSelectedPlugin(plugin.id)}
              onToggleSelection={() => togglePluginSelection(plugin.id)}
              onInstall={() => handleInstallPlugin(plugin.id)}
              showSelectionCheckbox={state.selectedPlugins.length > 0 || processedPlugins.length > 1}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Package className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No plugins found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            {debouncedSearch 
              ? `No plugins match your search "${debouncedSearch}". Try different keywords or browse by category.`
              : 'Try adjusting your filters or browse different categories.'
            }
          </p>
          {debouncedSearch && (
            <button
              onClick={() => updateState({ searchQuery: '', selectedCategory: 'all' })}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear search and filters
            </button>
          )}
        </div>
      )}

      {/* Plugin Detail Modal */}
      {selectedPlugin && (
        <PluginDetailModal
          plugin={plugins.find(p => p.id === selectedPlugin)!}
          onClose={() => setSelectedPlugin(null)}
          onInstall={handleInstallPlugin}
          isInstalling={installingPlugin === selectedPlugin}
        />
      )}

      {/* Installation Wizard */}
      {installingPlugin && (
        <InstallationWizard
          plugin={plugins.find(p => p.id === installingPlugin)!}
          onClose={() => setInstallingPlugin(null)}
        />
      )}

      {/* Plugin Comparison Modal */}
      {state.showComparison && state.selectedPlugins.length >= 2 && (
        <PluginComparison
          plugins={state.selectedPlugins.map(id => plugins.find(p => p.id === id)!).filter(Boolean)}
          onClose={() => updateState({ showComparison: false })}
          onSelectPlugin={setSelectedPlugin}
        />
      )}
    </div>
  );
}