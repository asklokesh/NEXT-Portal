'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import {
  Package,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Settings,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Info,
  Archive,
  GitBranch,
  History,
  Play,
  Pause,
  RotateCcw,
  Save,
  FileText,
  Database,
  Cpu,
  HardDrive,
  Activity,
  Lock,
  Unlock,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  MoreVertical,
  Code,
  Terminal,
  Copy,
  ExternalLink,
  Calendar,
  User,
  Users,
  Globe,
  Zap,
  TrendingUp,
  TrendingDown,
  AlertCircle
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface Plugin {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  version: string;
  status: 'active' | 'inactive' | 'deprecated' | 'archived';
  lifecycle: 'alpha' | 'beta' | 'stable' | 'deprecated' | 'end_of_life';
  isInstalled: boolean;
  isEnabled: boolean;
  author?: string;
  repository?: string;
  homepage?: string;
  documentation?: string;
  license?: string;
  compatibility?: any;
  healthScore?: number;
  securityScore?: number;
  maintenanceScore?: number;
  downloadCount?: number;
  lastCommit?: string;
  dependencies?: Array<{ name: string; version: string; required: boolean }>;
  configuration?: any;
  environments?: Array<{
    name: string;
    status: string;
    version: string;
    deployedAt?: string;
  }>;
  versions?: Array<{
    id: string;
    version: string;
    changelog?: string;
    createdAt: string;
    deployedAt?: string;
    status: string;
  }>;
  backups?: Array<{
    id: string;
    type: string;
    createdAt: string;
    size: number;
    status: string;
  }>;
  metrics?: {
    cpu: number;
    memory: number;
    storage: number;
    requests: number;
    errors: number;
    latency: number;
  };
}

interface PluginOperation {
  type: 'install' | 'update' | 'rollback' | 'uninstall' | 'configure' | 'backup' | 'restore';
  pluginId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  message?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export function PluginLifecycleManager() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [operations, setOperations] = useState<PluginOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [installSource, setInstallSource] = useState<'npm' | 'git' | 'local'>('npm');
  const [installPackage, setInstallPackage] = useState('');
  const [installVersion, setInstallVersion] = useState('latest');
  const [configData, setConfigData] = useState<any>({});
  const [rollbackVersion, setRollbackVersion] = useState('');
  const { toast } = useToast();

  // Fetch plugins
  useEffect(() => {
    fetchPlugins();
    const interval = setInterval(fetchOperationStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchPlugins = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/plugins');
      if (response.ok) {
        const data = await response.json();
        setPlugins(data.plugins || []);
      }
    } catch (error) {
      console.error('Failed to fetch plugins:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch plugins',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOperationStatus = async () => {
    try {
      const response = await fetch('/api/plugins/operations');
      if (response.ok) {
        const data = await response.json();
        setOperations(data.operations || []);
      }
    } catch (error) {
      console.error('Failed to fetch operation status:', error);
    }
  };

  // Plugin operations
  const installPlugin = async () => {
    if (!installPackage) return;

    const operation: PluginOperation = {
      type: 'install',
      pluginId: installPackage,
      status: 'pending',
      startedAt: new Date().toISOString()
    };

    setOperations(prev => [operation, ...prev]);
    setShowInstallDialog(false);

    try {
      const response = await fetch('/api/plugins/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: installSource,
          package: installPackage,
          version: installVersion
        })
      });

      if (response.ok) {
        toast({
          title: 'Installation Started',
          description: `Installing ${installPackage}...`
        });
        await fetchPlugins();
      } else {
        throw new Error('Installation failed');
      }
    } catch (error) {
      toast({
        title: 'Installation Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const updatePlugin = async (plugin: Plugin, targetVersion?: string) => {
    const operation: PluginOperation = {
      type: 'update',
      pluginId: plugin.id,
      status: 'pending',
      startedAt: new Date().toISOString()
    };

    setOperations(prev => [operation, ...prev]);

    try {
      const response = await fetch('/api/plugins/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId: plugin.id,
          version: targetVersion || 'latest'
        })
      });

      if (response.ok) {
        toast({
          title: 'Update Started',
          description: `Updating ${plugin.displayName}...`
        });
        await fetchPlugins();
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const rollbackPlugin = async () => {
    if (!selectedPlugin || !rollbackVersion) return;

    const operation: PluginOperation = {
      type: 'rollback',
      pluginId: selectedPlugin.id,
      status: 'pending',
      startedAt: new Date().toISOString()
    };

    setOperations(prev => [operation, ...prev]);
    setShowRollbackDialog(false);

    try {
      const response = await fetch('/api/plugins/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId: selectedPlugin.id,
          version: rollbackVersion
        })
      });

      if (response.ok) {
        toast({
          title: 'Rollback Started',
          description: `Rolling back ${selectedPlugin.displayName} to version ${rollbackVersion}...`
        });
        await fetchPlugins();
      } else {
        throw new Error('Rollback failed');
      }
    } catch (error) {
      toast({
        title: 'Rollback Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const uninstallPlugin = async (plugin: Plugin) => {
    if (!confirm(`Are you sure you want to uninstall ${plugin.displayName}?`)) return;

    const operation: PluginOperation = {
      type: 'uninstall',
      pluginId: plugin.id,
      status: 'pending',
      startedAt: new Date().toISOString()
    };

    setOperations(prev => [operation, ...prev]);

    try {
      const response = await fetch('/api/plugins/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pluginId: plugin.id })
      });

      if (response.ok) {
        toast({
          title: 'Uninstall Started',
          description: `Uninstalling ${plugin.displayName}...`
        });
        await fetchPlugins();
      } else {
        throw new Error('Uninstall failed');
      }
    } catch (error) {
      toast({
        title: 'Uninstall Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const configurePlugin = async () => {
    if (!selectedPlugin) return;

    try {
      const response = await fetch('/api/plugins/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId: selectedPlugin.id,
          configuration: configData
        })
      });

      if (response.ok) {
        toast({
          title: 'Configuration Saved',
          description: `Configuration for ${selectedPlugin.displayName} has been updated`
        });
        setShowConfigDialog(false);
        await fetchPlugins();
      } else {
        throw new Error('Configuration failed');
      }
    } catch (error) {
      toast({
        title: 'Configuration Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const togglePluginStatus = async (plugin: Plugin) => {
    try {
      const response = await fetch('/api/plugins/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId: plugin.id,
          enabled: !plugin.isEnabled
        })
      });

      if (response.ok) {
        toast({
          title: plugin.isEnabled ? 'Plugin Disabled' : 'Plugin Enabled',
          description: `${plugin.displayName} has been ${plugin.isEnabled ? 'disabled' : 'enabled'}`
        });
        await fetchPlugins();
      }
    } catch (error) {
      toast({
        title: 'Toggle Failed',
        description: 'Failed to toggle plugin status',
        variant: 'destructive'
      });
    }
  };

  // Filter plugins
  const filteredPlugins = plugins.filter(plugin => {
    const matchesSearch = plugin.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          plugin.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || plugin.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'installed' && plugin.isInstalled) ||
                          (statusFilter === 'active' && plugin.isEnabled) ||
                          (statusFilter === 'inactive' && !plugin.isEnabled);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'inactive': return 'text-gray-600';
      case 'deprecated': return 'text-yellow-600';
      case 'archived': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getLifecycleColor = (lifecycle: string) => {
    switch (lifecycle) {
      case 'alpha': return 'bg-red-100 text-red-800';
      case 'beta': return 'bg-yellow-100 text-yellow-800';
      case 'stable': return 'bg-green-100 text-green-800';
      case 'deprecated': return 'bg-orange-100 text-orange-800';
      case 'end_of_life': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Plugin Lifecycle Manager</h2>
          <p className="text-muted-foreground mt-1">
            Install, update, configure, and manage plugin lifecycles
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowInstallDialog(true)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Install Plugin
          </Button>
          <Button
            onClick={fetchPlugins}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Active Operations */}
      {operations.filter(op => op.status === 'in_progress').length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Active Operations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {operations
                .filter(op => op.status === 'in_progress')
                .map((operation, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin">
                        <RefreshCw className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium capitalize">
                          {operation.type} - {operation.pluginId}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {operation.message || 'Processing...'}
                        </p>
                      </div>
                    </div>
                    {operation.progress && (
                      <div className="w-32">
                        <Progress value={operation.progress} />
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search plugins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="authentication">Authentication</SelectItem>
                <SelectItem value="cicd">CI/CD</SelectItem>
                <SelectItem value="monitoring">Monitoring</SelectItem>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="documentation">Documentation</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Plugins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPlugins.map((plugin) => (
          <Card key={plugin.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    {plugin.displayName}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {plugin.description}
                  </CardDescription>
                </div>
                <Badge className={getLifecycleColor(plugin.lifecycle)}>
                  {plugin.lifecycle}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Status and Version */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${getStatusColor(plugin.status)}`}>
                      {plugin.status}
                    </span>
                    {plugin.isInstalled && (
                      <Badge variant="outline" className="text-xs">
                        v{plugin.version}
                      </Badge>
                    )}
                  </div>
                  <Switch
                    checked={plugin.isEnabled}
                    onCheckedChange={() => togglePluginStatus(plugin)}
                    disabled={!plugin.isInstalled}
                  />
                </div>

                {/* Health Scores */}
                {plugin.isInstalled && (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <Shield className={`h-3 w-3 ${getHealthScoreColor(plugin.securityScore)}`} />
                      <span className="text-muted-foreground">Security</span>
                      <span className={getHealthScoreColor(plugin.securityScore)}>
                        {plugin.securityScore || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Activity className={`h-3 w-3 ${getHealthScoreColor(plugin.healthScore)}`} />
                      <span className="text-muted-foreground">Health</span>
                      <span className={getHealthScoreColor(plugin.healthScore)}>
                        {plugin.healthScore || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className={`h-3 w-3 ${getHealthScoreColor(plugin.maintenanceScore)}`} />
                      <span className="text-muted-foreground">Maint.</span>
                      <span className={getHealthScoreColor(plugin.maintenanceScore)}>
                        {plugin.maintenanceScore || 'N/A'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Metrics */}
                {plugin.metrics && plugin.isInstalled && (
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Cpu className="h-3 w-3" />
                      CPU: {plugin.metrics.cpu}%
                    </div>
                    <div className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      Memory: {plugin.metrics.memory}MB
                    </div>
                  </div>
                )}

                <Separator />

                {/* Actions */}
                <div className="flex gap-2">
                  {!plugin.isInstalled ? (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setInstallPackage(plugin.name);
                        setShowInstallDialog(true);
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Install
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setSelectedPlugin(plugin);
                          setShowConfigDialog(true);
                          setConfigData(plugin.configuration || {});
                        }}
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Configure
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updatePlugin(plugin)}
                      >
                        <Upload className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedPlugin(plugin);
                          setShowRollbackDialog(true);
                        }}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => uninstallPlugin(plugin)}
                      >
                        <Trash2 className="h-3 w-3 text-red-600" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Install Dialog */}
      <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Install Plugin</DialogTitle>
            <DialogDescription>
              Install a new plugin from NPM, Git, or local source
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Installation Source</Label>
              <Select value={installSource} onValueChange={(value: any) => setInstallSource(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="npm">NPM Registry</SelectItem>
                  <SelectItem value="git">Git Repository</SelectItem>
                  <SelectItem value="local">Local File</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Package Name / URL</Label>
              <Input
                placeholder={installSource === 'npm' ? '@backstage/plugin-name' : 'https://github.com/...'}
                value={installPackage}
                onChange={(e) => setInstallPackage(e.target.value)}
              />
            </div>
            {installSource === 'npm' && (
              <div>
                <Label>Version</Label>
                <Input
                  placeholder="latest"
                  value={installVersion}
                  onChange={(e) => setInstallVersion(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInstallDialog(false)}>
              Cancel
            </Button>
            <Button onClick={installPlugin}>
              Install Plugin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Configure {selectedPlugin?.displayName}</DialogTitle>
            <DialogDescription>
              Update plugin configuration and settings
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              <div>
                <Label>Configuration (JSON)</Label>
                <Textarea
                  className="font-mono text-sm"
                  rows={15}
                  value={JSON.stringify(configData, null, 2)}
                  onChange={(e) => {
                    try {
                      setConfigData(JSON.parse(e.target.value));
                    } catch {}
                  }}
                />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={configurePlugin}>
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Dialog */}
      <Dialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rollback {selectedPlugin?.displayName}</DialogTitle>
            <DialogDescription>
              Select a previous version to rollback to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Version</Label>
              <Select value={rollbackVersion} onValueChange={setRollbackVersion}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a version" />
                </SelectTrigger>
                <SelectContent>
                  {selectedPlugin?.versions?.map(version => (
                    <SelectItem key={version.id} value={version.version}>
                      v{version.version} - {format(new Date(version.createdAt), 'MMM dd, yyyy')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {rollbackVersion && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This will rollback the plugin to version {rollbackVersion}. 
                  A backup will be created before the rollback.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRollbackDialog(false)}>
              Cancel
            </Button>
            <Button onClick={rollbackPlugin} variant="destructive">
              Rollback Plugin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PluginLifecycleManager;