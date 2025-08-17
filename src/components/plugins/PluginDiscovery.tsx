'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Search,
  Filter,
  Package,
  Download,
  Star,
  GitBranch,
  Shield,
  AlertTriangle,
  TrendingUp,
  Clock,
  Users,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Info,
  CheckCircle,
  XCircle,
  RefreshCw,
  Zap,
  Award,
  BarChart3,
  Globe,
  Lock,
  Unlock,
  FileText,
  Terminal,
  Database,
  Cloud,
  Layers,
  Settings,
  Activity,
  Eye,
  ThumbsUp,
  MessageSquare,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';

interface PluginInfo {
  name: string;
  version: string;
  description?: string;
  author?: string | { name: string; email?: string };
  maintainers?: Array<{ name: string; email?: string }>;
  repository?: { type: string; url: string };
  homepage?: string;
  license?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  publishedAt?: string;
  downloads?: {
    weekly: number;
    monthly: number;
    yearly: number;
  };
  stars?: number;
  issues?: number;
  quality?: number;
  popularity?: number;
  maintenance?: number;
  isInstalled?: boolean;
  installedVersion?: string;
  hasUpdate?: boolean;
  isBackstagePlugin?: boolean;
  category?: string;
  compatibilityScore?: number;
  securityScore?: number;
  vulnerabilities?: Array<{
    severity: 'low' | 'moderate' | 'high' | 'critical';
    title: string;
  }>;
}

interface PluginDiscoveryProps {
  onInstallRequest?: (plugin: PluginInfo) => void;
  selectedCategory?: string;
  showInstalled?: boolean;
}

const PLUGIN_CATEGORIES = [
  { value: 'all', label: 'All Plugins', icon: Package },
  { value: 'ci-cd', label: 'CI/CD', icon: GitBranch },
  { value: 'monitoring', label: 'Monitoring', icon: Activity },
  { value: 'security', label: 'Security', icon: Shield },
  { value: 'database', label: 'Database', icon: Database },
  { value: 'cloud', label: 'Cloud', icon: Cloud },
  { value: 'analytics', label: 'Analytics', icon: BarChart3 },
  { value: 'docs', label: 'Documentation', icon: FileText },
  { value: 'testing', label: 'Testing', icon: Terminal },
  { value: 'infrastructure', label: 'Infrastructure', icon: Layers }
];

const SORT_OPTIONS = [
  { value: 'popularity', label: 'Most Popular' },
  { value: 'downloads', label: 'Most Downloaded' },
  { value: 'quality', label: 'Highest Quality' },
  { value: 'maintenance', label: 'Best Maintained' },
  { value: 'recent', label: 'Recently Updated' },
  { value: 'alphabetical', label: 'Alphabetical' }
];

export function PluginDiscovery({
  onInstallRequest,
  selectedCategory = 'all',
  showInstalled = false
}: PluginDiscoveryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState(selectedCategory);
  const [sortBy, setSortBy] = useState('popularity');
  const [showOnlyCompatible, setShowOnlyCompatible] = useState(true);
  const [showOnlySecure, setShowOnlySecure] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<PluginInfo | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const queryClient = useQueryClient();

  // Fetch plugins from NPM registry
  const { data: plugins, isLoading, error, refetch } = useQuery({
    queryKey: ['npm-plugins', debouncedSearch, category, sortBy, showOnlyCompatible, showOnlySecure, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: debouncedSearch || '@backstage/plugin',
        category: category !== 'all' ? category : '',
        sort: sortBy,
        compatible: showOnlyCompatible.toString(),
        secure: showOnlySecure.toString(),
        page: page.toString(),
        size: pageSize.toString()
      });

      const response = await fetch(`/api/plugins/discovery/search?${params}`);
      if (!response.ok) throw new Error('Failed to search plugins');
      return response.json();
    }
  });

  // Fetch plugin details
  const { data: pluginDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['plugin-details', selectedPlugin?.name],
    queryFn: async () => {
      if (!selectedPlugin) return null;
      const response = await fetch(`/api/plugins/discovery/details/${encodeURIComponent(selectedPlugin.name)}`);
      if (!response.ok) throw new Error('Failed to fetch plugin details');
      return response.json();
    },
    enabled: !!selectedPlugin && showDetails
  });

  // Request plugin installation
  const installMutation = useMutation({
    mutationFn: async (plugin: PluginInfo) => {
      const response = await fetch('/api/plugins/approval/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginName: plugin.name,
          pluginVersion: plugin.version,
          requestType: 'INSTALL',
          businessJustification: `Installing ${plugin.name} to enhance development capabilities`,
          metadata: {
            description: plugin.description,
            author: typeof plugin.author === 'string' ? plugin.author : plugin.author?.name,
            repository: plugin.repository?.url,
            homepage: plugin.homepage,
            downloads: plugin.downloads?.monthly,
            stars: plugin.stars
          }
        })
      });
      if (!response.ok) throw new Error('Failed to request plugin installation');
      return response.json();
    },
    onSuccess: (data, plugin) => {
      toast.success(`Installation request submitted for ${plugin.name}`);
      if (onInstallRequest) onInstallRequest(plugin);
      queryClient.invalidateQueries({ queryKey: ['npm-plugins'] });
    },
    onError: (error, plugin) => {
      toast.error(`Failed to request installation for ${plugin.name}`);
    }
  });

  // Get trending plugins
  const { data: trendingPlugins } = useQuery({
    queryKey: ['trending-plugins'],
    queryFn: async () => {
      const response = await fetch('/api/plugins/discovery/trending');
      if (!response.ok) throw new Error('Failed to fetch trending plugins');
      return response.json();
    }
  });

  // Get featured plugins
  const { data: featuredPlugins } = useQuery({
    queryKey: ['featured-plugins'],
    queryFn: async () => {
      const response = await fetch('/api/plugins/discovery/featured');
      if (!response.ok) throw new Error('Failed to fetch featured plugins');
      return response.json();
    }
  });

  const getCategoryIcon = (categoryValue: string) => {
    const cat = PLUGIN_CATEGORIES.find(c => c.value === categoryValue);
    return cat?.icon || Package;
  };

  const getSecurityBadge = (score?: number, vulnerabilities?: any[]) => {
    if (!score) return null;
    
    const hasVulnerabilities = vulnerabilities && vulnerabilities.length > 0;
    const hasCritical = vulnerabilities?.some(v => v.severity === 'critical');
    const hasHigh = vulnerabilities?.some(v => v.severity === 'high');

    if (hasCritical) {
      return <Badge variant="destructive" className="text-xs">Critical Risk</Badge>;
    }
    if (hasHigh) {
      return <Badge variant="destructive" className="text-xs">High Risk</Badge>;
    }
    if (hasVulnerabilities) {
      return <Badge variant="secondary" className="text-xs">Security Issues</Badge>;
    }
    if (score >= 80) {
      return <Badge className="bg-green-100 text-green-800 text-xs">Secure</Badge>;
    }
    return null;
  };

  const getQualityIndicator = (quality?: number) => {
    if (!quality) return null;
    
    const percentage = Math.round(quality * 100);
    let color = 'text-gray-400';
    if (percentage >= 80) color = 'text-green-500';
    else if (percentage >= 60) color = 'text-yellow-500';
    else if (percentage >= 40) color = 'text-orange-500';
    else color = 'text-red-500';

    return (
      <div className="flex items-center space-x-1">
        <Award className={cn("w-4 h-4", color)} />
        <span className={cn("text-xs", color)}>{percentage}%</span>
      </div>
    );
  };

  const formatDownloads = (downloads?: number) => {
    if (!downloads) return '0';
    if (downloads >= 1000000) return `${(downloads / 1000000).toFixed(1)}M`;
    if (downloads >= 1000) return `${(downloads / 1000).toFixed(1)}K`;
    return downloads.toString();
  };

  const renderPluginCard = (plugin: PluginInfo) => {
    const Icon = getCategoryIcon(plugin.category || 'all');
    
    return (
      <Card
        key={plugin.name}
        className="hover:shadow-lg transition-shadow cursor-pointer"
        onClick={() => {
          setSelectedPlugin(plugin);
          setShowDetails(true);
        }}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <Icon className="w-5 h-5 text-gray-500" />
              <div>
                <CardTitle className="text-base line-clamp-1">{plugin.name}</CardTitle>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="outline" className="text-xs">v{plugin.version}</Badge>
                  {plugin.isBackstagePlugin && (
                    <Badge className="bg-blue-100 text-blue-800 text-xs">Backstage</Badge>
                  )}
                  {plugin.isInstalled && (
                    <Badge className="bg-green-100 text-green-800 text-xs">Installed</Badge>
                  )}
                  {plugin.hasUpdate && (
                    <Badge className="bg-yellow-100 text-yellow-800 text-xs">Update Available</Badge>
                  )}
                </div>
              </div>
            </div>
            {getQualityIndicator(plugin.quality)}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">
            {plugin.description || 'No description available'}
          </p>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1">
                <Download className="w-3 h-3" />
                <span>{formatDownloads(plugin.downloads?.monthly)}/mo</span>
              </div>
              {plugin.stars !== undefined && (
                <div className="flex items-center space-x-1">
                  <Star className="w-3 h-3" />
                  <span>{plugin.stars}</span>
                </div>
              )}
            </div>
            {getSecurityBadge(plugin.securityScore, plugin.vulnerabilities)}
          </div>

          {plugin.author && (
            <div className="mt-2 text-xs text-gray-500">
              by {typeof plugin.author === 'string' ? plugin.author : plugin.author.name}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Discover Backstage Plugins</CardTitle>
          <CardDescription>
            Browse and install plugins from the NPM registry
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search for plugins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading}
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="category" className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLUGIN_CATEGORIES.map(cat => {
                      const Icon = cat.icon;
                      return (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center space-x-2">
                            <Icon className="w-4 h-4" />
                            <span>{cat.label}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="sort" className="text-xs">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger id="sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end space-x-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="compatible"
                    checked={showOnlyCompatible}
                    onCheckedChange={(checked) => setShowOnlyCompatible(checked as boolean)}
                  />
                  <Label htmlFor="compatible" className="text-sm cursor-pointer">
                    Compatible Only
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="secure"
                    checked={showOnlySecure}
                    onCheckedChange={(checked) => setShowOnlySecure(checked as boolean)}
                  />
                  <Label htmlFor="secure" className="text-sm cursor-pointer">
                    Secure Only
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Featured & Trending */}
      {(featuredPlugins?.length > 0 || trendingPlugins?.length > 0) && !searchQuery && category === 'all' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Featured Plugins */}
          {featuredPlugins?.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span>Featured Plugins</span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {featuredPlugins.slice(0, 3).map((plugin: PluginInfo) => (
                    <div
                      key={plugin.name}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
                      onClick={() => {
                        setSelectedPlugin(plugin);
                        setShowDetails(true);
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <Package className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium">{plugin.name}</div>
                          <div className="text-xs text-gray-500">v{plugin.version}</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trending Plugins */}
          {trendingPlugins?.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span>Trending Now</span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {trendingPlugins.slice(0, 3).map((plugin: PluginInfo, index: number) => (
                    <div
                      key={plugin.name}
                      className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
                      onClick={() => {
                        setSelectedPlugin(plugin);
                        setShowDetails(true);
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{plugin.name}</div>
                          <div className="text-xs text-gray-500">
                            <ArrowUpRight className="w-3 h-3 inline text-green-500" />
                            {formatDownloads(plugin.downloads?.weekly)} this week
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Plugin Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-12 w-full mb-3" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-1/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load plugins. Please try again later.
          </AlertDescription>
        </Alert>
      ) : plugins?.results?.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {plugins.results.map((plugin: PluginInfo) => renderPluginCard(plugin))}
          </div>

          {/* Pagination */}
          {plugins.totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <div className="flex items-center space-x-1">
                {[...Array(Math.min(5, plugins.totalPages))].map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                {plugins.totalPages > 5 && (
                  <>
                    <span className="px-2">...</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(plugins.totalPages)}
                    >
                      {plugins.totalPages}
                    </Button>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page === plugins.totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No plugins found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Plugin Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedPlugin && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Package className="w-5 h-5" />
                  <span>{selectedPlugin.name}</span>
                </DialogTitle>
                <DialogDescription>
                  {selectedPlugin.description}
                </DialogDescription>
              </DialogHeader>

              {detailsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : pluginDetails ? (
                <div className="space-y-6">
                  {/* Metrics */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {formatDownloads(pluginDetails.downloads?.monthly)}
                      </div>
                      <div className="text-xs text-gray-500">Monthly Downloads</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {pluginDetails.stars || 0}
                      </div>
                      <div className="text-xs text-gray-500">GitHub Stars</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {Math.round((pluginDetails.quality || 0) * 100)}%
                      </div>
                      <div className="text-xs text-gray-500">Quality Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {pluginDetails.securityScore || 100}%
                      </div>
                      <div className="text-xs text-gray-500">Security Score</div>
                    </div>
                  </div>

                  <Separator />

                  {/* Security Analysis */}
                  {pluginDetails.vulnerabilities?.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Security Vulnerabilities</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc list-inside mt-2">
                          {pluginDetails.vulnerabilities.map((vuln: any, index: number) => (
                            <li key={index} className="text-sm">
                              {vuln.title} ({vuln.severity})
                            </li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Plugin Information */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Version</span>
                      <span className="font-medium">{pluginDetails.version}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">License</span>
                      <Badge variant="outline">{pluginDetails.license || 'Unknown'}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Author</span>
                      <span className="font-medium">
                        {typeof pluginDetails.author === 'string'
                          ? pluginDetails.author
                          : pluginDetails.author?.name || 'Unknown'}
                      </span>
                    </div>
                    {pluginDetails.publishedAt && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Published</span>
                        <span className="font-medium">
                          {formatDistanceToNow(new Date(pluginDetails.publishedAt), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                    {pluginDetails.repository?.url && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Repository</span>
                        <a
                          href={pluginDetails.repository.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-blue-600 hover:underline"
                        >
                          <span>View on GitHub</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    {pluginDetails.homepage && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Homepage</span>
                        <a
                          href={pluginDetails.homepage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-1 text-blue-600 hover:underline"
                        >
                          <span>Visit</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Dependencies */}
                  {pluginDetails.dependencies && Object.keys(pluginDetails.dependencies).length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-medium mb-2">Dependencies ({Object.keys(pluginDetails.dependencies).length})</h4>
                        <ScrollArea className="h-32">
                          <div className="space-y-1">
                            {Object.entries(pluginDetails.dependencies).map(([name, version]) => (
                              <div key={name} className="flex justify-between text-xs">
                                <span className="text-gray-600">{name}</span>
                                <span className="text-gray-500">{version as string}</span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </>
                  )}

                  {/* Keywords */}
                  {pluginDetails.keywords?.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-medium mb-2">Keywords</h4>
                        <div className="flex flex-wrap gap-2">
                          {pluginDetails.keywords.map((keyword: string) => (
                            <Badge key={keyword} variant="secondary" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Info className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">Unable to load plugin details</p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDetails(false)}>
                  Close
                </Button>
                {selectedPlugin.isInstalled ? (
                  <Button disabled>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Installed
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      installMutation.mutate(selectedPlugin);
                      setShowDetails(false);
                    }}
                    disabled={installMutation.isPending}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Request Installation
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PluginDiscovery;