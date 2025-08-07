'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Filter, Download, Upload, Star, GitBranch, 
  Shield, Activity, Package, Zap, AlertCircle, CheckCircle,
  Clock, TrendingUp, Users, Code, Database, Cloud, Lock,
  RefreshCw, Terminal, Settings, ChevronRight, ExternalLink,
  Play, Pause, RotateCcw, Trash2, Edit, Copy, MoreVertical
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface Plugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  status: 'available' | 'installed' | 'installing' | 'updating' | 'error';
  health?: 'healthy' | 'unhealthy' | 'unknown';
  rating: number;
  downloads: number;
  lastUpdated: string;
  size: string;
  dependencies: string[];
  tags: string[];
  icon?: string;
  containerStatus?: {
    running: boolean;
    cpu: number;
    memory: number;
    uptime: string;
    port: number;
  };
}

interface InstallationProgress {
  pluginId: string;
  phase: 'downloading' | 'building' | 'deploying' | 'configuring' | 'verifying';
  progress: number;
  message: string;
  estimatedTime?: number;
}

interface PluginMetrics {
  cpu: number[];
  memory: number[];
  requests: number[];
  errors: number[];
  timestamps: string[];
}

export default function RealTimeMarketplace() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<Plugin[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [installProgress, setInstallProgress] = useState<Map<string, InstallationProgress>>(new Map());
  const [pluginMetrics, setPluginMetrics] = useState<Map<string, PluginMetrics>>(new Map());
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Initialize WebSocket connection for real-time updates
  useEffect(() => {
    const websocket = new WebSocket('ws://localhost:4400/ws/plugins');
    
    websocket.onopen = () => {
      console.log('Connected to plugin marketplace WebSocket');
    };

    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'plugin_status':
        updatePluginStatus(data.pluginId, data.status, data.health);
        break;
      
      case 'install_progress':
        updateInstallProgress(data.pluginId, data.progress);
        break;
      
      case 'metrics_update':
        updatePluginMetrics(data.pluginId, data.metrics);
        break;
      
      case 'plugin_event':
        handlePluginEvent(data.event);
        break;
    }
  };

  const updatePluginStatus = (pluginId: string, status: string, health?: string) => {
    setPlugins(prev => prev.map(p => 
      p.id === pluginId ? { ...p, status: status as any, health: health as any } : p
    ));
    setInstalledPlugins(prev => prev.map(p => 
      p.id === pluginId ? { ...p, status: status as any, health: health as any } : p
    ));
  };

  const updateInstallProgress = (pluginId: string, progress: InstallationProgress) => {
    setInstallProgress(prev => new Map(prev).set(pluginId, progress));
    
    if (progress.progress === 100) {
      setTimeout(() => {
        setInstallProgress(prev => {
          const newMap = new Map(prev);
          newMap.delete(pluginId);
          return newMap;
        });
        
        // Move plugin to installed
        const plugin = plugins.find(p => p.id === pluginId);
        if (plugin) {
          setInstalledPlugins(prev => [...prev, { ...plugin, status: 'installed' }]);
        }
      }, 2000);
    }
  };

  const updatePluginMetrics = (pluginId: string, metrics: Partial<PluginMetrics>) => {
    setPluginMetrics(prev => {
      const current = prev.get(pluginId) || {
        cpu: [],
        memory: [],
        requests: [],
        errors: [],
        timestamps: []
      };
      
      return new Map(prev).set(pluginId, {
        ...current,
        ...metrics
      });
    });
  };

  const handlePluginEvent = (event: any) => {
    switch (event.type) {
      case 'installed':
        toast.success(`Plugin ${event.pluginName} installed successfully`);
        break;
      case 'error':
        toast.error(`Plugin ${event.pluginName} encountered an error: ${event.message}`);
        break;
      case 'health_check_failed':
        toast.error(`Plugin ${event.pluginName} health check failed`);
        break;
    }
  };

  // Load plugins
  useEffect(() => {
    loadPlugins();
    loadInstalledPlugins();
  }, []);

  const loadPlugins = async () => {
    try {
      const response = await fetch('/api/plugins/marketplace');
      const data = await response.json();
      setPlugins(data.plugins || []);
    } catch (error) {
      console.error('Failed to load plugins:', error);
    }
  };

  const loadInstalledPlugins = async () => {
    try {
      const response = await fetch('/api/plugins/installed');
      const data = await response.json();
      setInstalledPlugins(data.plugins || []);
    } catch (error) {
      console.error('Failed to load installed plugins:', error);
    }
  };

  const installPlugin = async (plugin: Plugin) => {
    try {
      // Initialize progress
      setInstallProgress(prev => new Map(prev).set(plugin.id, {
        pluginId: plugin.id,
        phase: 'downloading',
        progress: 0,
        message: 'Starting installation...'
      }));

      const response = await fetch('/api/plugins/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId: plugin.id,
          version: plugin.version
        })
      });

      if (!response.ok) {
        throw new Error('Installation failed');
      }

      const result = await response.json();
      
      // Track installation progress
      if (result.taskId) {
        trackInstallation(result.taskId, plugin.id);
      }
    } catch (error) {
      toast.error(`Failed to install ${plugin.name}`);
      setInstallProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(plugin.id);
        return newMap;
      });
    }
  };

  const trackInstallation = async (taskId: string, pluginId: string) => {
    const checkProgress = async () => {
      try {
        const response = await fetch(`/api/plugins/install/${taskId}/progress`);
        const data = await response.json();
        
        updateInstallProgress(pluginId, {
          pluginId,
          phase: data.phase,
          progress: data.progress,
          message: data.message,
          estimatedTime: data.estimatedTime
        });

        if (data.progress < 100 && data.status !== 'failed') {
          setTimeout(checkProgress, 1000);
        }
      } catch (error) {
        console.error('Failed to check installation progress:', error);
      }
    };

    checkProgress();
  };

  const uninstallPlugin = async (plugin: Plugin) => {
    try {
      const response = await fetch(`/api/plugins/uninstall/${plugin.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Uninstallation failed');
      }

      setInstalledPlugins(prev => prev.filter(p => p.id !== plugin.id));
      toast.success(`${plugin.name} uninstalled successfully`);
    } catch (error) {
      toast.error(`Failed to uninstall ${plugin.name}`);
    }
  };

  const restartPlugin = async (plugin: Plugin) => {
    try {
      const response = await fetch(`/api/plugins/restart/${plugin.id}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Restart failed');
      }

      toast.success(`${plugin.name} restarted successfully`);
    } catch (error) {
      toast.error(`Failed to restart ${plugin.name}`);
    }
  };

  const filteredPlugins = useMemo(() => {
    return plugins.filter(plugin => {
      const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [plugins, searchQuery, selectedCategory]);

  const categories = ['all', 'monitoring', 'security', 'ci-cd', 'database', 'analytics', 'development'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'installed':
      case 'healthy':
        return 'text-green-500';
      case 'installing':
      case 'updating':
        return 'text-yellow-500';
      case 'error':
      case 'unhealthy':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'installed':
      case 'healthy':
        return <CheckCircle className="h-4 w-4" />;
      case 'installing':
      case 'updating':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'error':
      case 'unhealthy':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Plugin Marketplace</h1>
          <p className="text-gray-600 mt-1">
            Install and manage Backstage plugins with real-time monitoring
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Upload Plugin
          </Button>
          <Button>
            <Package className="h-4 w-4 mr-2" />
            Create Plugin
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search plugins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="marketplace" className="space-y-4">
        <TabsList>
          <TabsTrigger value="marketplace">
            Marketplace
            <Badge className="ml-2" variant="secondary">
              {filteredPlugins.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="installed">
            Installed
            <Badge className="ml-2" variant="secondary">
              {installedPlugins.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="monitoring">
            Monitoring
          </TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlugins.map(plugin => {
              const progress = installProgress.get(plugin.id);
              
              return (
                <motion.div
                  key={plugin.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                            <Package className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{plugin.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                v{plugin.version}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {plugin.category}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedPlugin(plugin)}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {plugin.description}
                      </p>

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span>{plugin.rating}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          <span>{plugin.downloads}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{plugin.author}</span>
                        </div>
                      </div>

                      {progress ? (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600 capitalize">
                              {progress.phase}...
                            </span>
                            <span className="text-gray-600">
                              {progress.progress}%
                            </span>
                          </div>
                          <Progress value={progress.progress} />
                          <p className="text-xs text-gray-500">
                            {progress.message}
                          </p>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {plugin.status === 'installed' ? (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="flex-1"
                                onClick={() => restartPlugin(plugin)}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                Restart
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                className="flex-1"
                                onClick={() => uninstallPlugin(plugin)}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Uninstall
                              </Button>
                            </>
                          ) : (
                            <Button 
                              size="sm" 
                              className="w-full"
                              onClick={() => installPlugin(plugin)}
                              disabled={plugin.status === 'installing'}
                            >
                              {plugin.status === 'installing' ? (
                                <>
                                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                  Installing...
                                </>
                              ) : (
                                <>
                                  <Download className="h-3 w-3 mr-1" />
                                  Install
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="installed" className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {installedPlugins.map(plugin => {
              const metrics = pluginMetrics.get(plugin.id);
              
              return (
                <Card key={plugin.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                          <Package className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{plugin.name}</h3>
                          <p className="text-sm text-gray-600">{plugin.description}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <Badge variant="outline">v{plugin.version}</Badge>
                            <div className={cn("flex items-center gap-1", getStatusColor(plugin.health || 'unknown'))}>
                              {getStatusIcon(plugin.health || 'unknown')}
                              <span className="text-xs capitalize">{plugin.health || 'Unknown'}</span>
                            </div>
                            {plugin.containerStatus?.running && (
                              <span className="text-xs text-gray-500">
                                Uptime: {plugin.containerStatus.uptime}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {plugin.containerStatus && (
                          <div className="flex items-center gap-4 mr-4">
                            <div className="text-center">
                              <p className="text-xs text-gray-500">CPU</p>
                              <p className="text-sm font-semibold">
                                {plugin.containerStatus.cpu.toFixed(1)}%
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500">Memory</p>
                              <p className="text-sm font-semibold">
                                {plugin.containerStatus.memory}MB
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500">Port</p>
                              <p className="text-sm font-semibold">
                                {plugin.containerStatus.port}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        <Button size="sm" variant="outline">
                          <Terminal className="h-4 w-4 mr-2" />
                          Logs
                        </Button>
                        <Button size="sm" variant="outline">
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => restartPlugin(plugin)}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Restart
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => uninstallPlugin(plugin)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {metrics && (
                      <div className="mt-4 grid grid-cols-4 gap-4">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-600">CPU Usage</p>
                          <p className="text-lg font-semibold">
                            {metrics.cpu[metrics.cpu.length - 1]?.toFixed(1) || 0}%
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-600">Memory</p>
                          <p className="text-lg font-semibold">
                            {metrics.memory[metrics.memory.length - 1] || 0}MB
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-600">Requests/min</p>
                          <p className="text-lg font-semibold">
                            {metrics.requests[metrics.requests.length - 1] || 0}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-600">Errors</p>
                          <p className="text-lg font-semibold text-red-600">
                            {metrics.errors[metrics.errors.length - 1] || 0}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>System Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Plugins</span>
                    <span className="font-semibold">{installedPlugins.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Healthy</span>
                    <span className="font-semibold text-green-600">
                      {installedPlugins.filter(p => p.health === 'healthy').length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Unhealthy</span>
                    <span className="font-semibold text-red-600">
                      {installedPlugins.filter(p => p.health === 'unhealthy').length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total CPU Usage</span>
                    <span className="font-semibold">
                      {installedPlugins.reduce((sum, p) => 
                        sum + (p.containerStatus?.cpu || 0), 0
                      ).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Memory</span>
                    <span className="font-semibold">
                      {installedPlugins.reduce((sum, p) => 
                        sum + (p.containerStatus?.memory || 0), 0
                      )}MB
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Events</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {/* Event logs would go here */}
                    <div className="text-sm text-gray-600">
                      <span className="text-xs text-gray-400">10:23 AM</span>
                      <p>Plugin "Catalog" health check passed</p>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="text-xs text-gray-400">10:20 AM</span>
                      <p>Plugin "TechDocs" restarted successfully</p>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="text-xs text-gray-400">10:15 AM</span>
                      <p>Plugin "Cost Insights" installed</p>
                    </div>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}