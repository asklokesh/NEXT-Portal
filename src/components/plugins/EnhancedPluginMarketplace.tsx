'use client';

// Enhanced Plugin Marketplace UI Component
// Comprehensive plugin discovery, filtering, and installation interface

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  Star, 
  Download, 
  Shield, 
  Package, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Tag,
  TrendingUp,
  Github,
  Book,
  Settings,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
  Info,
  User,
  Calendar,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { EnhancedBackstagePlugin } from '@/services/backstage/enhanced-plugin-registry';
import { toast } from 'sonner';

interface PluginFilters {
  search: string;
  category: string;
  tags: string[];
  author: string;
  minStars: number;
  minDownloads: number;
  compatibility: {
    backstageVersion?: string;
    nodeVersion?: string;
  };
  security: {
    maxVulnerabilities: number;
    requireTrusted: boolean;
  };
  quality: {
    minScore: number;
    requireMaintained: boolean;
  };
  sortBy: 'popularity' | 'stars' | 'downloads' | 'updated' | 'name';
  sortOrder: 'asc' | 'desc';
  viewMode: 'grid' | 'list';
  showInstalled: boolean;
  showExperimental: boolean;
}

interface InstallationProgress {
  pluginId: string;
  stage: string;
  progress: number;
  message: string;
  error?: string;
}

export function EnhancedPluginMarketplace() {
  // State management
  const [plugins, setPlugins] = useState<EnhancedBackstagePlugin[]>([]);
  const [filteredPlugins, setFilteredPlugins] = useState<EnhancedBackstagePlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlugin, setSelectedPlugin] = useState<EnhancedBackstagePlugin | null>(null);
  const [installationProgress, setInstallationProgress] = useState<Map<string, InstallationProgress>>(new Map());
  const [categories, setCategories] = useState<Array<{category: string, count: number}>>([]);
  const [topTags, setTopTags] = useState<Array<{tag: string, count: number}>>([]);
  
  const [filters, setFilters] = useState<PluginFilters>({
    search: '',
    category: '',
    tags: [],
    author: '',
    minStars: 0,
    minDownloads: 0,
    compatibility: {},
    security: {
      maxVulnerabilities: 10,
      requireTrusted: false
    },
    quality: {
      minScore: 0,
      requireMaintained: false
    },
    sortBy: 'popularity',
    sortOrder: 'desc',
    viewMode: 'grid',
    showInstalled: false,
    showExperimental: true
  });

  // Load plugins on component mount
  useEffect(() => {
    loadPlugins();
  }, []);

  // Filter plugins when filters change
  useEffect(() => {
    applyFilters();
  }, [plugins, filters]);

  const loadPlugins = async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        limit: '100',
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => 
            value !== null && value !== undefined && value !== '' &&
            !(Array.isArray(value) && value.length === 0)
          ).map(([key, value]) => [key, Array.isArray(value) ? value.join(',') : String(value)])
        )
      });

      const response = await fetch(`/api/plugins/registry?${queryParams}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load plugins');
      }

      setPlugins(data.data.plugins);
      setCategories(data.data.categories);
      setTopTags(data.data.topTags);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plugins');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = useCallback(() => {
    let filtered = [...plugins];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(plugin =>
        plugin.name.toLowerCase().includes(searchLower) ||
        plugin.title.toLowerCase().includes(searchLower) ||
        plugin.description.toLowerCase().includes(searchLower) ||
        plugin.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Category filter
    if (filters.category) {
      filtered = filtered.filter(plugin => plugin.category === filters.category);
    }

    // Tags filter
    if (filters.tags.length > 0) {
      filtered = filtered.filter(plugin =>
        filters.tags.every(tag => plugin.tags.includes(tag))
      );
    }

    // Author filter
    if (filters.author) {
      filtered = filtered.filter(plugin =>
        plugin.author.toLowerCase().includes(filters.author.toLowerCase())
      );
    }

    // Quality filters
    if (filters.minStars > 0) {
      filtered = filtered.filter(plugin => (plugin.stars || 0) >= filters.minStars);
    }

    if (filters.minDownloads > 0) {
      filtered = filtered.filter(plugin => (plugin.downloads || 0) >= filters.minDownloads);
    }

    // Security filters
    if (!filters.security.requireTrusted) {
      filtered = filtered.filter(plugin => 
        (plugin.security?.vulnerabilities || 0) <= filters.security.maxVulnerabilities
      );
    } else {
      filtered = filtered.filter(plugin => plugin.security?.trusted === true);
    }

    // Quality score filter
    if (filters.quality.minScore > 0) {
      filtered = filtered.filter(plugin => 
        (plugin.quality?.score || 0) >= filters.quality.minScore
      );
    }

    // Installation status filter
    if (!filters.showInstalled) {
      filtered = filtered.filter(plugin => !plugin.installed);
    }

    // Experimental filter
    if (!filters.showExperimental) {
      filtered = filtered.filter(plugin => !plugin.registryMetadata?.experimental);
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (filters.sortBy) {
        case 'popularity':
          aValue = (a.popularity?.score || 0);
          bValue = (b.popularity?.score || 0);
          break;
        case 'stars':
          aValue = a.stars || 0;
          bValue = b.stars || 0;
          break;
        case 'downloads':
          aValue = a.downloads || 0;
          bValue = b.downloads || 0;
          break;
        case 'updated':
          aValue = new Date(a.lastUpdated || 0);
          bValue = new Date(b.lastUpdated || 0);
          break;
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        default:
          return 0;
      }

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return filters.sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredPlugins(filtered);
  }, [plugins, filters]);

  const handleInstallPlugin = async (plugin: EnhancedBackstagePlugin) => {
    try {
      const progressId = plugin.id;
      setInstallationProgress(prev => new Map(prev).set(progressId, {
        pluginId: plugin.id,
        stage: 'preparing',
        progress: 0,
        message: 'Preparing installation...'
      }));

      const response = await fetch(`/api/plugins/registry/${plugin.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: plugin.version,
          forceInstall: false
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Installation failed');
      }

      // Update plugin status
      setPlugins(prev => prev.map(p => 
        p.id === plugin.id ? { ...p, installed: true, enabled: true } : p
      ));

      setInstallationProgress(prev => {
        const updated = new Map(prev);
        updated.delete(progressId);
        return updated;
      });

      toast.success(`${plugin.title} installed successfully`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Installation failed';
      
      setInstallationProgress(prev => new Map(prev).set(plugin.id, {
        pluginId: plugin.id,
        stage: 'error',
        progress: 0,
        message: 'Installation failed',
        error: errorMessage
      }));

      toast.error(errorMessage);
    }
  };

  const handleUninstallPlugin = async (plugin: EnhancedBackstagePlugin) => {
    try {
      const response = await fetch(`/api/plugins/registry/${plugin.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Uninstallation failed');
      }

      setPlugins(prev => prev.map(p => 
        p.id === plugin.id ? { ...p, installed: false, enabled: false } : p
      ));

      toast.success(`${plugin.title} uninstalled successfully`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Uninstallation failed');
    }
  };

  const handleTogglePlugin = async (plugin: EnhancedBackstagePlugin) => {
    try {
      const newEnabledState = !plugin.enabled;
      
      // Update UI optimistically
      setPlugins(prev => prev.map(p => 
        p.id === plugin.id ? { ...p, enabled: newEnabledState } : p
      ));

      // Make API call to update backend
      const response = await fetch(`/api/backstage/plugins/${plugin.id}/${newEnabledState ? 'enable' : 'disable'}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Failed to ${newEnabledState ? 'enable' : 'disable'} plugin`);
      }

      toast.success(`${plugin.title} ${newEnabledState ? 'enabled' : 'disabled'}`);
    } catch (err) {
      // Revert optimistic update
      setPlugins(prev => prev.map(p => 
        p.id === plugin.id ? { ...p, enabled: !plugin.enabled } : p
      ));
      
      toast.error(err instanceof Error ? err.message : 'Toggle failed');
    }
  };

  const renderPluginCard = (plugin: EnhancedBackstagePlugin) => {
    const progress = installationProgress.get(plugin.id);
    const isInstalling = !!progress;

    return (
      <Card key={plugin.id} className={`transition-all hover:shadow-md ${filters.viewMode === 'list' ? 'flex flex-row' : ''}`}>
        <div className={filters.viewMode === 'list' ? 'flex-1' : ''}>
          <CardHeader className={`pb-3 ${filters.viewMode === 'list' ? 'flex-row items-center space-y-0 space-x-4' : ''}`}>
            <div className="flex items-start justify-between w-full">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{plugin.title.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-lg leading-tight">{plugin.title}</CardTitle>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant={getCategoryVariant(plugin.category)}>{plugin.category}</Badge>
                    {plugin.registryMetadata?.verified && (
                      <Badge variant="secondary" className="text-green-600">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                    {plugin.registryMetadata?.experimental && (
                      <Badge variant="outline" className="text-orange-600">
                        Experimental
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {plugin.installed && (
                  <Switch
                    checked={plugin.enabled}
                    onCheckedChange={() => handleTogglePlugin(plugin)}
                    disabled={isInstalling}
                  />
                )}
                
                <Button
                  size="sm"
                  variant={plugin.installed ? "destructive" : "default"}
                  onClick={() => plugin.installed ? handleUninstallPlugin(plugin) : handleInstallPlugin(plugin)}
                  disabled={isInstalling}
                  className="min-w-20"
                >
                  {isInstalling ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : plugin.installed ? (
                    <>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-1" />
                      Install
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <CardDescription className="text-sm text-gray-600 mb-3 line-clamp-2">
              {plugin.description}
            </CardDescription>

            {isInstalling && progress && (
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{progress.message}</span>
                  <span>{Math.round(progress.progress)}%</span>
                </div>
                <Progress value={progress.progress} className="h-2" />
                {progress.error && (
                  <Alert className="mt-2 p-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">{progress.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                {plugin.stars && (
                  <div className="flex items-center">
                    <Star className="h-4 w-4 mr-1 text-yellow-500" />
                    {plugin.stars.toLocaleString()}
                  </div>
                )}
                
                {plugin.downloads && (
                  <div className="flex items-center">
                    <Download className="h-4 w-4 mr-1" />
                    {plugin.downloads.toLocaleString()}
                  </div>
                )}

                {plugin.security && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center">
                          <Shield className={`h-4 w-4 mr-1 ${
                            plugin.security.trusted ? 'text-green-500' : 
                            (plugin.security.vulnerabilities || 0) > 0 ? 'text-red-500' : 
                            'text-gray-400'
                          }`} />
                          {plugin.security.vulnerabilities || 0}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{plugin.security.vulnerabilities || 0} vulnerabilities</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Info className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                    <PluginDetailModal plugin={plugin} />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="flex flex-wrap gap-1 mt-3">
              {plugin.tags.slice(0, 5).map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {plugin.tags.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{plugin.tags.length - 5} more
                </Badge>
              )}
            </div>
          </CardContent>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading plugins...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button
              variant="outline"
              size="sm"
              onClick={loadPlugins}
              className="ml-2"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plugin Marketplace</h1>
          <p className="text-gray-600 mt-1">
            Discover and install Backstage plugins to extend your portal
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={loadPlugins}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search plugins..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filter */}
            <Select
              value={filters.category}
              onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map(({ category, count }) => (
                  <SelectItem key={category} value={category}>
                    {category} ({count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onValueChange={(value) => {
                const [sortBy, sortOrder] = value.split('-') as [PluginFilters['sortBy'], PluginFilters['sortOrder']];
                setFilters(prev => ({ ...prev, sortBy, sortOrder }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popularity-desc">Most Popular</SelectItem>
                <SelectItem value="stars-desc">Most Stars</SelectItem>
                <SelectItem value="downloads-desc">Most Downloads</SelectItem>
                <SelectItem value="updated-desc">Recently Updated</SelectItem>
                <SelectItem value="name-asc">Name A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Advanced Filters */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showInstalled"
                    checked={filters.showInstalled}
                    onCheckedChange={(checked) => 
                      setFilters(prev => ({ ...prev, showInstalled: !!checked }))
                    }
                  />
                  <label htmlFor="showInstalled" className="text-sm">Show installed</label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="showExperimental"
                    checked={filters.showExperimental}
                    onCheckedChange={(checked) => 
                      setFilters(prev => ({ ...prev, showExperimental: !!checked }))
                    }
                  />
                  <label htmlFor="showExperimental" className="text-sm">Include experimental</label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="requireTrusted"
                    checked={filters.security.requireTrusted}
                    onCheckedChange={(checked) => 
                      setFilters(prev => ({ 
                        ...prev, 
                        security: { ...prev.security, requireTrusted: !!checked }
                      }))
                    }
                  />
                  <label htmlFor="requireTrusted" className="text-sm">Trusted only</label>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant={filters.viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilters(prev => ({ ...prev, viewMode: 'grid' }))}
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={filters.viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilters(prev => ({ ...prev, viewMode: 'list' }))}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {filteredPlugins.length} of {plugins.length} plugins
        </p>
      </div>

      {/* Plugin Grid/List */}
      <div className={`grid gap-4 ${
        filters.viewMode === 'grid' 
          ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' 
          : 'grid-cols-1'
      }`}>
        {filteredPlugins.map(renderPluginCard)}
      </div>

      {filteredPlugins.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2">No plugins found</h3>
            <p className="text-gray-600 mb-4">
              Try adjusting your search criteria or filters to find more plugins.
            </p>
            <Button
              variant="outline"
              onClick={() => setFilters({
                ...filters,
                search: '',
                category: '',
                tags: [],
                author: ''
              })}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Plugin Detail Modal Component
function PluginDetailModal({ plugin }: { plugin: EnhancedBackstagePlugin }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [compatibility, setCompatibility] = useState<any>(null);
  const [loadingCompatibility, setLoadingCompatibility] = useState(false);

  useEffect(() => {
    if (activeTab === 'compatibility') {
      checkCompatibility();
    }
  }, [activeTab, plugin.id]);

  const checkCompatibility = async () => {
    try {
      setLoadingCompatibility(true);
      const response = await fetch(`/api/plugins/registry/${plugin.id}/compatibility`);
      const data = await response.json();
      
      if (data.success) {
        setCompatibility(data.data);
      }
    } catch (error) {
      console.error('Failed to check compatibility:', error);
    } finally {
      setLoadingCompatibility(false);
    }
  };

  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center space-x-3">
          <Avatar>
            <AvatarFallback>{plugin.title.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl">{plugin.title}</h2>
            <p className="text-sm text-gray-600">{plugin.name}</p>
          </div>
        </DialogTitle>
        <DialogDescription>
          {plugin.description}
        </DialogDescription>
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compatibility">Compatibility</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Version:</span>
                  <span>{plugin.version}</span>
                </div>
                <div className="flex justify-between">
                  <span>Author:</span>
                  <span>{plugin.author}</span>
                </div>
                <div className="flex justify-between">
                  <span>Category:</span>
                  <Badge variant="outline">{plugin.category}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>License:</span>
                  <span>{plugin.license || 'Unknown'}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Stats</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Stars:</span>
                  <span>{plugin.stars?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Downloads:</span>
                  <span>{plugin.downloads?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Updated:</span>
                  <span>{plugin.lastUpdated ? new Date(plugin.lastUpdated).toLocaleDateString() : 'Unknown'}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Tags</h4>
            <div className="flex flex-wrap gap-1">
              {plugin.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex space-x-2">
            {plugin.repository && (
              <Button variant="outline" size="sm" asChild>
                <a href={plugin.repository} target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4 mr-1" />
                  Repository
                </a>
              </Button>
            )}
            {plugin.documentation && (
              <Button variant="outline" size="sm" asChild>
                <a href={plugin.documentation} target="_blank" rel="noopener noreferrer">
                  <Book className="h-4 w-4 mr-1" />
                  Documentation
                </a>
              </Button>
            )}
            {plugin.npm && (
              <Button variant="outline" size="sm" asChild>
                <a href={plugin.npm} target="_blank" rel="noopener noreferrer">
                  <Package className="h-4 w-4 mr-1" />
                  NPM
                </a>
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="compatibility" className="space-y-4">
          {loadingCompatibility ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : compatibility ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg ${
                compatibility.compatible ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center">
                  {compatibility.compatible ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                  )}
                  <span className="font-semibold">
                    {compatibility.compatible ? 'Compatible' : 'Compatibility Issues'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{compatibility.summary}</p>
              </div>

              {compatibility.issues && compatibility.issues.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Issues</h4>
                  <div className="space-y-2">
                    {compatibility.issues.map((issue: any, index: number) => (
                      <Alert key={index}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>{issue.severity}:</strong> {issue.message}
                          {issue.suggestion && (
                            <div className="text-xs mt-1 text-gray-600">
                              Suggestion: {issue.suggestion}
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Click "Check Compatibility" to analyze this plugin
              <div className="mt-2">
                <Button onClick={checkCompatibility}>
                  Check Compatibility
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Security Score</h4>
              <div className={`p-4 rounded-lg ${
                plugin.security?.trusted ? 'bg-green-50' : 'bg-yellow-50'
              }`}>
                <div className="flex items-center">
                  <Shield className={`h-5 w-5 mr-2 ${
                    plugin.security?.trusted ? 'text-green-600' : 'text-yellow-600'
                  }`} />
                  <span className="font-semibold">
                    {plugin.security?.trusted ? 'Trusted' : 'Needs Review'}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Vulnerabilities</h4>
              <div className="text-2xl font-bold">
                {plugin.security?.vulnerabilities || 0}
              </div>
              <div className="text-sm text-gray-600">
                Known vulnerabilities
              </div>
            </div>
          </div>

          {plugin.security?.lastScan && (
            <div>
              <h4 className="font-semibold mb-2">Last Security Scan</h4>
              <p className="text-sm text-gray-600">
                {new Date(plugin.security.lastScan).toLocaleString()}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="versions" className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Current Version</h4>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="font-mono text-sm">{plugin.version}</div>
              {plugin.lastUpdated && (
                <div className="text-xs text-gray-600 mt-1">
                  Published {new Date(plugin.lastUpdated).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {plugin.latestVersion && plugin.latestVersion !== plugin.version && (
            <div>
              <h4 className="font-semibold mb-2">Latest Version</h4>
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="font-mono text-sm">{plugin.latestVersion}</div>
                <Button size="sm" className="mt-2">
                  <ArrowUp className="h-4 w-4 mr-1" />
                  Upgrade
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper functions
function getCategoryVariant(category: string): "default" | "secondary" | "destructive" | "outline" {
  const categoryMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    'core': 'default',
    'ci-cd': 'secondary',
    'monitoring': 'outline',
    'security': 'destructive',
    'infrastructure': 'secondary',
    'analytics': 'outline',
    'documentation': 'secondary',
    'testing': 'outline',
    'user-experience': 'secondary',
    'cost-management': 'outline',
    'observability': 'secondary',
    'data': 'outline',
    'productivity': 'secondary',
    'compliance': 'destructive',
    'development-tools': 'outline'
  };

  return categoryMap[category] || 'outline';
}