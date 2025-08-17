'use client';

/**
 * Spotify Portal-Style Plugin Marketplace
 * 
 * Comprehensive visual plugin discovery with 340+ Backstage plugins
 * Features no-code installation, dependency resolution, and enterprise governance
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Filter,
  Download,
  Star,
  Shield,
  Zap,
  Settings,
  Play,
  Pause,
  MoreHorizontal,
  Heart,
  Share2,
  ExternalLink,
  ChevronDown,
  Grid,
  List,
  SortAsc,
  SortDesc,
  Package,
  Users,
  TrendingUp,
  Award,
  Clock,
  GitBranch,
  Database,
  Monitor,
  Globe,
  Code,
  Terminal,
  Layers,
  FileText,
  Sparkles,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Eye,
  ThumbsUp,
  MessageSquare,
  BookOpen
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { NoCodeConfigurationManager } from './NoCodeConfigurationManager';
import { automatedPluginInstaller, InstallationProgress } from '@/services/plugins/automated-plugin-installer';
import { comprehensivePluginRegistry, PluginMetadata } from '@/services/plugins/comprehensive-plugin-registry';

// Plugin Categories with Spotify-style styling
const PLUGIN_CATEGORIES = [
  { id: 'all', name: 'All Plugins', icon: Package, gradient: 'from-gray-500 to-gray-600' },
  { id: 'core', name: 'Core', icon: Zap, gradient: 'from-blue-500 to-blue-600' },
  { id: 'auth', name: 'Authentication', icon: Shield, gradient: 'from-green-500 to-green-600' },
  { id: 'catalog', name: 'Service Catalog', icon: Database, gradient: 'from-purple-500 to-purple-600' },
  { id: 'scaffolder', name: 'Templates', icon: Code, gradient: 'from-orange-500 to-orange-600' },
  { id: 'ci-cd', name: 'CI/CD', icon: GitBranch, gradient: 'from-teal-500 to-teal-600' },
  { id: 'monitoring', name: 'Observability', icon: Monitor, gradient: 'from-red-500 to-red-600' },
  { id: 'infrastructure', name: 'Infrastructure', icon: Layers, gradient: 'from-indigo-500 to-indigo-600' },
  { id: 'security', name: 'Security', icon: Shield, gradient: 'from-yellow-500 to-yellow-600' },
  { id: 'analytics', name: 'Analytics', icon: TrendingUp, gradient: 'from-pink-500 to-pink-600' },
  { id: 'documentation', name: 'Documentation', icon: FileText, gradient: 'from-cyan-500 to-cyan-600' },
  { id: 'enterprise-premium', name: 'Enterprise', icon: Award, gradient: 'from-gold-500 to-gold-600' }
];

const SORT_OPTIONS = [
  { id: 'relevance', name: 'Relevance', icon: Sparkles },
  { id: 'popularity', name: 'Popularity', icon: TrendingUp },
  { id: 'downloads', name: 'Downloads', icon: Download },
  { id: 'stars', name: 'Stars', icon: Star },
  { id: 'updated', name: 'Recently Updated', icon: Clock },
  { id: 'name', name: 'Name', icon: SortAsc },
  { id: 'health', name: 'Health Score', icon: Heart }
];

interface SpotifyPortalMarketplaceProps {
  tenantId?: string;
  showOnlyInstalled?: boolean;
  onPluginInstalled?: (plugin: PluginMetadata) => void;
}

export function SpotifyPortalMarketplace({ 
  tenantId, 
  showOnlyInstalled = false,
  onPluginInstalled 
}: SpotifyPortalMarketplaceProps) {
  const queryClient = useQueryClient();
  
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginMetadata | null>(null);
  const [configuringPlugin, setConfiguringPlugin] = useState<string | null>(null);
  
  // Filters
  const [filters, setFilters] = useState({
    verified: false,
    official: false,
    enterprise: false,
    minHealth: 0,
    maxDependencies: 100,
    showBeta: true
  });

  // Installation tracking
  const [installations, setInstallations] = useState<Map<string, InstallationProgress>>(new Map());
  const [favoritePlugins, setFavoritePlugins] = useState<Set<string>>(new Set());

  // Fetch plugins with comprehensive filtering
  const { 
    data: pluginsData, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['marketplace-plugins', {
      search: searchQuery,
      category: selectedCategory,
      sortBy,
      sortOrder,
      filters,
      tenantId,
      showOnlyInstalled
    }],
    queryFn: async () => {
      return await comprehensivePluginRegistry.searchPlugins(searchQuery, {
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        verified: filters.verified || undefined,
        official: filters.official || undefined,
        enterprise: filters.enterprise || undefined,
        minHealth: filters.minHealth || undefined,
        showOnlyInstalled,
        tenantId
      });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes
  });

  // Sort and filter plugins
  const sortedPlugins = useMemo(() => {
    if (!pluginsData) return [];
    
    let filtered = [...pluginsData];
    
    // Apply additional filters
    if (filters.maxDependencies < 100) {
      filtered = filtered.filter(p => p.dependencies.length <= filters.maxDependencies);
    }
    
    if (!filters.showBeta) {
      filtered = filtered.filter(p => !p.version.includes('beta') && !p.version.includes('alpha'));
    }

    // Sort plugins
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'popularity':
          comparison = (b.popularityScore || 0) - (a.popularityScore || 0);
          break;
        case 'downloads':
          comparison = (b.downloads || 0) - (a.downloads || 0);
          break;
        case 'stars':
          comparison = (b.stars || 0) - (a.stars || 0);
          break;
        case 'updated':
          comparison = new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
          break;
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'health':
          comparison = (b.qualityScore || 0) - (a.qualityScore || 0);
          break;
        default: // relevance
          const scoreA = (a.qualityScore || 0) * 0.4 + (a.downloads || 0) * 0.0001 + (a.stars || 0) * 0.01;
          const scoreB = (b.qualityScore || 0) * 0.4 + (b.downloads || 0) * 0.0001 + (b.stars || 0) * 0.01;
          comparison = scoreB - scoreA;
          break;
      }
      
      return sortOrder === 'desc' ? comparison : -comparison;
    });

    return filtered;
  }, [pluginsData, sortBy, sortOrder, filters]);

  // Plugin installation mutation
  const installMutation = useMutation({
    mutationFn: async ({ pluginId, config }: { pluginId: string; config?: any }) => {
      const result = await automatedPluginInstaller.installPlugin(pluginId, undefined, config);
      if (!result.success) {
        throw new Error(result.message);
      }
      return result;
    },
    onSuccess: (result, { pluginId }) => {
      const plugin = sortedPlugins.find(p => p.id === pluginId);
      if (plugin) {
        onPluginInstalled?.(plugin);
        toast.success(`${plugin.title} installed successfully!`);
      }
      queryClient.invalidateQueries({ queryKey: ['marketplace-plugins'] });
    },
    onError: (error: any) => {
      toast.error(`Installation failed: ${error.message}`);
    }
  });

  // Listen for installation progress
  useEffect(() => {
    const handleProgress = (installationId: string, progress: InstallationProgress) => {
      setInstallations(prev => new Map(prev.set(installationId, progress)));
    };

    automatedPluginInstaller.on('progress', handleProgress);
    
    return () => {
      automatedPluginInstaller.off('progress', handleProgress);
    };
  }, []);

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('plugin-favorites');
    if (saved) {
      setFavoritePlugins(new Set(JSON.parse(saved)));
    }
  }, []);

  const toggleFavorite = useCallback((pluginId: string) => {
    setFavoritePlugins(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(pluginId)) {
        newFavorites.delete(pluginId);
      } else {
        newFavorites.add(pluginId);
      }
      localStorage.setItem('plugin-favorites', JSON.stringify(Array.from(newFavorites)));
      return newFavorites;
    });
  }, []);

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getHealthIcon = (status: PluginMetadata['healthStatus']) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'critical': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-gray-400" />;
    }
  };

  const renderPluginCard = (plugin: PluginMetadata) => {
    const category = PLUGIN_CATEGORIES.find(cat => cat.id === plugin.category);
    const Icon = category?.icon || Package;
    const isFavorite = favoritePlugins.has(plugin.id);
    const isInstalling = Array.from(installations.values()).some(
      inst => inst.status !== 'completed' && inst.status !== 'failed'
    );

    if (viewMode === 'list') {
      return (
        <div
          key={plugin.id}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-all duration-200 cursor-pointer"
          onClick={() => setSelectedPlugin(plugin)}
        >
          <div className="flex items-center gap-4">
            {/* Plugin Icon */}
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${category?.gradient || 'from-gray-500 to-gray-600'} flex items-center justify-center`}>
              <Icon className="w-6 h-6 text-white" />
            </div>

            {/* Plugin Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {plugin.title}
                </h3>
                {plugin.official && <Award className="w-4 h-4 text-blue-500" />}
                {plugin.verified && <CheckCircle className="w-4 h-4 text-green-500" />}
                {plugin.enterprise && <Shield className="w-4 h-4 text-gold-500" />}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-2">
                {plugin.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  {plugin.downloads.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  {plugin.stars.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  {getHealthIcon(plugin.healthStatus)}
                  {plugin.qualityScore}%
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(plugin.id);
                }}
                className={`p-2 rounded-md transition-colors ${
                  isFavorite 
                    ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' 
                    : 'text-gray-400 hover:text-red-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
              
              {!plugin.installed ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    installMutation.mutate({ pluginId: plugin.id });
                  }}
                  disabled={isInstalling}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  Install
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfiguringPlugin(plugin.id);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Settings className="w-4 h-4" />
                  Configure
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Grid view
    return (
      <div
        key={plugin.id}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group"
        onClick={() => setSelectedPlugin(plugin)}
      >
        {/* Plugin Header */}
        <div className={`h-20 bg-gradient-to-r ${category?.gradient || 'from-gray-500 to-gray-600'} relative`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className="w-8 h-8 text-white" />
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(plugin.id);
            }}
            className={`absolute top-2 right-2 p-1.5 rounded-md transition-colors ${
              isFavorite 
                ? 'text-red-500 bg-white/20' 
                : 'text-white/70 hover:text-red-500 hover:bg-white/20'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Plugin Content */}
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {plugin.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                v{plugin.version} • {plugin.author}
              </p>
            </div>
            <div className="flex items-center gap-1 ml-2">
              {plugin.official && <Award className="w-4 h-4 text-blue-500" />}
              {plugin.verified && <CheckCircle className="w-4 h-4 text-green-500" />}
              {plugin.enterprise && <Shield className="w-4 h-4 text-gold-500" />}
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
            {plugin.description}
          </p>

          {/* Health Score */}
          <div className="flex items-center gap-2 mb-3">
            {getHealthIcon(plugin.healthStatus)}
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  plugin.qualityScore >= 80 ? 'bg-green-500' :
                  plugin.qualityScore >= 60 ? 'bg-yellow-500' :
                  plugin.qualityScore >= 40 ? 'bg-orange-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${plugin.qualityScore}%` }}
              />
            </div>
            <span className={`text-sm font-medium ${getHealthColor(plugin.qualityScore)}`}>
              {plugin.qualityScore}%
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {plugin.downloads > 1000 ? `${Math.round(plugin.downloads / 1000)}k` : plugin.downloads}
            </span>
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3" />
              {plugin.stars}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {plugin.dependencies.length}
            </span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mb-4">
            {plugin.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
              >
                {tag}
              </span>
            ))}
            {plugin.tags.length > 3 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                +{plugin.tags.length - 3}
              </span>
            )}
          </div>

          {/* Action Button */}
          {!plugin.installed ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                installMutation.mutate({ pluginId: plugin.id });
              }}
              disabled={isInstalling}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" />
              {isInstalling ? 'Installing...' : 'Install'}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Toggle plugin
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  plugin.enabled
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {plugin.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {plugin.enabled ? 'Enabled' : 'Enable'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfiguringPlugin(plugin.id);
                }}
                className="px-3 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Package className="w-8 h-8 animate-pulse text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading marketplace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
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
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-xl p-8 text-white">
        <div className="max-w-4xl">
          <h1 className="text-4xl font-bold mb-4">Plugin Marketplace</h1>
          <p className="text-xl opacity-90 mb-6">
            Discover, install, and manage 340+ Backstage plugins with zero-code configuration
          </p>
          
          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search plugins by name, category, or functionality..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-white focus:ring-opacity-50 border-none"
            />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Category Filter */}
            <div className="flex items-center gap-2 overflow-x-auto">
              {PLUGIN_CATEGORIES.map(category => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-gray-600 shadow-sm'
                    : 'hover:bg-white/50 dark:hover:bg-gray-600/50'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-600 shadow-sm'
                    : 'hover:bg-white/50 dark:hover:bg-gray-600/50'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Sort Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                {sortOrder === 'desc' ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
                {SORT_OPTIONS.find(opt => opt.id === sortBy)?.name}
                <ChevronDown className="w-4 h-4" />
              </button>
              
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 min-w-48">
                {SORT_OPTIONS.map(option => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => setSortBy(option.id)}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg"
                    >
                      <Icon className="w-4 h-4" />
                      {option.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Advanced Filters */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                showFilters
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.verified}
                  onChange={(e) => setFilters(prev => ({ ...prev, verified: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Verified only</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.official}
                  onChange={(e) => setFilters(prev => ({ ...prev, official: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Official only</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.enterprise}
                  onChange={(e) => setFilters(prev => ({ ...prev, enterprise: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Enterprise</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.showBeta}
                  onChange={(e) => setFilters(prev => ({ ...prev, showBeta: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Include beta</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-blue-600">
            {sortedPlugins.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Available Plugins</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-green-600">
            {sortedPlugins.filter(p => p.installed).length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Installed</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-purple-600">
            {sortedPlugins.filter(p => p.verified).length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Verified</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-gold-600">
            {sortedPlugins.filter(p => p.enterprise).length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Enterprise</div>
        </div>
      </div>

      {/* Plugin Grid/List */}
      {sortedPlugins.length > 0 ? (
        <div className={
          viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
            : 'space-y-4'
        }>
          {sortedPlugins.map(renderPluginCard)}
        </div>
      ) : (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No plugins found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Try adjusting your search or filters
          </p>
        </div>
      )}

      {/* Plugin Details Modal */}
      {selectedPlugin && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setSelectedPlugin(null)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
              {/* Modal content would go here */}
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  {selectedPlugin.title}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {selectedPlugin.description}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedPlugin(null)}
                    className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Close
                  </button>
                  {!selectedPlugin.installed && (
                    <button
                      onClick={() => {
                        installMutation.mutate({ pluginId: selectedPlugin.id });
                        setSelectedPlugin(null);
                      }}
                      className="px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                    >
                      Install Plugin
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {configuringPlugin && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setConfiguringPlugin(null)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-screen overflow-y-auto">
              <NoCodeConfigurationManager
                pluginId={configuringPlugin}
                onSave={async (config) => {
                  // Save configuration
                  console.log('Saving config:', config);
                  setConfiguringPlugin(null);
                }}
                onCancel={() => setConfiguringPlugin(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SpotifyPortalMarketplace;