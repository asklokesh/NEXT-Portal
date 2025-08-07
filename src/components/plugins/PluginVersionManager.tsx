'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  GitCommit, 
  Download, 
  Upload, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Activity,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Settings,
  Database,
  FileText,
  Zap,
  Shield,
  Eye,
  RotateCcw,
  Play,
  Pause,
  RefreshCw,
  GitBranch
} from 'lucide-react';

interface PluginVersion {
  id: string;
  version: string;
  semverMajor: number;
  semverMinor: number;
  semverPatch: number;
  prereleaseTag?: string;
  isCurrent: boolean;
  isDeployed: boolean;
  status: 'PENDING' | 'VALIDATING' | 'READY' | 'DEPLOYING' | 'DEPLOYED' | 'FAILED' | 'ROLLED_BACK' | 'ARCHIVED';
  changelog?: string;
  dependencies?: Record<string, string>;
  configuration?: Record<string, any>;
  migrationScript?: string;
  installSource: 'NPM' | 'GIT' | 'LOCAL' | 'CUSTOM';
  gitCommit?: string;
  gitBranch?: string;
  deployedBy?: string;
  deployedAt?: string;
  rollbackOf?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deployments: PluginDeployment[];
  backupsBefore: PluginBackup[];
  backupsAfter: PluginBackup[];
  rollbackTo?: PluginVersion;
  rollbacksFrom: Array<{ id: string; version: string; deployedAt?: string }>;
  migrationExecution: MigrationExecution[];
}

interface PluginDeployment {
  id: string;
  environment: string;
  status: 'PENDING' | 'DEPLOYING' | 'DEPLOYED' | 'FAILED' | 'ROLLED_BACK';
  strategy: 'ROLLING' | 'BLUE_GREEN' | 'CANARY' | 'IMMEDIATE';
  progress: number;
  logs?: string;
  error?: string;
  healthCheck?: Record<string, any>;
  startedAt: string;
  completedAt?: string;
  deployedBy: string;
  rollbackDeadline?: string;
}

interface PluginBackup {
  id: string;
  backupType: 'FULL' | 'INCREMENTAL' | 'CONFIGURATION' | 'DATABASE_SNAPSHOT' | 'FILE_SYSTEM' | 'COMBINED';
  source: 'AUTOMATIC' | 'MANUAL' | 'SCHEDULED' | 'PRE_DEPLOYMENT' | 'POST_DEPLOYMENT' | 'ROLLBACK';
  status: 'PENDING' | 'CREATING' | 'UPLOADING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'DELETED';
  size?: number;
  storagePath: string;
  createdAt: string;
}

interface MigrationExecution {
  id: string;
  type: 'DATABASE_SCHEMA' | 'CONFIGURATION' | 'FILE_SYSTEM' | 'PERMISSIONS' | 'DEPENDENCIES' | 'CUSTOM';
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK' | 'SKIPPED';
  output?: string;
  error?: string;
  executionTime?: number;
  executedBy?: string;
  executedAt?: string;
}

interface Plugin {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  category: string;
  author?: string;
  repository?: string;
  homepage?: string;
  npm?: string;
  isInstalled: boolean;
  isEnabled: boolean;
  versions: PluginVersion[];
}

interface PluginVersionManagerProps {
  pluginId: string;
  onVersionChange?: (version: PluginVersion) => void;
  onRollback?: (targetVersionId: string) => void;
}

const PluginVersionManager: React.FC<PluginVersionManagerProps> = ({
  pluginId,
  onVersionChange,
  onRollback
}) => {
  const [plugin, setPlugin] = useState<Plugin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');
  const [activeDeployments, setActiveDeployments] = useState<Record<string, PluginDeployment>>({});
  const [versionComparison, setVersionComparison] = useState<any>(null);
  const [changelog, setChangelog] = useState<any[]>([]);

  const fetchPluginData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/plugin-versions?pluginId=${pluginId}&includeDeployments=true&includeBackups=true`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch plugin data');
      }

      const data = await response.json();
      setPlugin(data.plugin);
      setVersionComparison(data.versionComparison);
      setChangelog(data.changelog);
      
      // Set selected version to current if none selected
      if (!selectedVersion && data.plugin.versions.length > 0) {
        const currentVersion = data.plugin.versions.find(v => v.isCurrent);
        setSelectedVersion(currentVersion?.id || data.plugin.versions[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch plugin data');
    } finally {
      setLoading(false);
    }
  }, [pluginId, selectedVersion]);

  useEffect(() => {
    fetchPluginData();
  }, [fetchPluginData]);

  const handleRollback = async (targetVersionId: string, reason: string) => {
    try {
      const response = await fetch('/api/plugin-versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rollback',
          pluginId: plugin?.id,
          targetVersionId,
          reason,
          createBackup: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to initiate rollback');
      }

      const result = await response.json();
      
      if (result.success) {
        await fetchPluginData();
        setRollbackDialogOpen(false);
        setRollbackTarget(null);
        setRollbackReason('');
        
        if (onRollback) {
          onRollback(targetVersionId);
        }
      } else {
        throw new Error(result.error || 'Rollback failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed');
    }
  };

  const handleVersionDeploy = async (versionId: string, strategy: string = 'ROLLING') => {
    try {
      const response = await fetch('/api/plugin-versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deploy_version',
          pluginVersionId: versionId,
          strategy,
          deployedBy: 'current-user' // This should come from auth context
        })
      });

      if (!response.ok) {
        throw new Error('Failed to deploy version');
      }

      const result = await response.json();
      
      if (result.success) {
        // Track active deployment
        setActiveDeployments(prev => ({
          ...prev,
          [versionId]: result.deployment
        }));
        
        await fetchPluginData();
      } else {
        throw new Error(result.error || 'Deployment failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DEPLOYED': return 'bg-green-100 text-green-800';
      case 'DEPLOYING': return 'bg-blue-100 text-blue-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      case 'ROLLED_BACK': return 'bg-yellow-100 text-yellow-800';
      case 'READY': return 'bg-purple-100 text-purple-800';
      case 'PENDING': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DEPLOYED': return <CheckCircle className="w-4 h-4" />;
      case 'DEPLOYING': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'FAILED': return <XCircle className="w-4 h-4" />;
      case 'ROLLED_BACK': return <RotateCcw className="w-4 h-4" />;
      case 'READY': return <Zap className="w-4 h-4" />;
      case 'PENDING': return <Clock className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'Unknown';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading plugin versions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!plugin) {
    return (
      <Alert className="m-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Plugin Not Found</AlertTitle>
        <AlertDescription>The requested plugin could not be found.</AlertDescription>
      </Alert>
    );
  }

  const currentVersion = plugin.versions.find(v => v.isCurrent);
  const selectedVersionData = plugin.versions.find(v => v.id === selectedVersion);

  return (
    <div className="space-y-6">
      {/* Plugin Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{plugin.displayName}</h2>
          <p className="text-muted-foreground">{plugin.name}</p>
          {currentVersion && (
            <Badge className={getStatusColor(currentVersion.status)}>
              {getStatusIcon(currentVersion.status)}
              <span className="ml-1">v{currentVersion.version} - {currentVersion.status}</span>
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => fetchPluginData()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
          <TabsTrigger value="migrations">Migrations</TabsTrigger>
        </TabsList>

        {/* Version History Timeline */}
        <TabsContent value="timeline" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Version List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Version History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-96">
                    <div className="space-y-2">
                      {plugin.versions.map((version, index) => (
                        <div
                          key={version.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedVersion === version.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                          onClick={() => setSelectedVersion(version.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(version.status)} variant="outline">
                                v{version.version}
                              </Badge>
                              {version.isCurrent && (
                                <Badge variant="outline" className="bg-green-100 text-green-800">
                                  Current
                                </Badge>
                              )}
                            </div>
                            {getStatusIcon(version.status)}
                          </div>
                          
                          <div className="mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(version.createdAt).toLocaleDateString()}
                            </div>
                            {version.deployedBy && (
                              <div className="flex items-center gap-1 mt-1">
                                <GitCommit className="w-3 h-3" />
                                by {version.deployedBy}
                              </div>
                            )}
                          </div>

                          {version.rollbackOf && (
                            <div className="mt-2">
                              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Rollback
                              </Badge>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Version Details */}
            <div className="lg:col-span-2">
              {selectedVersionData && (
                <div className="space-y-4">
                  {/* Version Info Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>Version {selectedVersionData.version}</span>
                        <div className="flex gap-2">
                          {!selectedVersionData.isCurrent && selectedVersionData.status === 'READY' && (
                            <Button
                              onClick={() => handleVersionDeploy(selectedVersionData.id)}
                              size="sm"
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Deploy
                            </Button>
                          )}
                          {selectedVersionData.isCurrent && (
                            <Dialog open={rollbackDialogOpen} onOpenChange={setRollbackDialogOpen}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setRollbackTarget(selectedVersionData.id)}
                                >
                                  <RotateCcw className="w-4 h-4 mr-1" />
                                  Rollback Options
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Rollback Version</DialogTitle>
                                  <DialogDescription>
                                    Select a previous version to rollback to. This will create a backup before proceeding.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <label className="text-sm font-medium">Select Target Version:</label>
                                    <ScrollArea className="h-32 mt-2">
                                      {plugin.versions
                                        .filter(v => !v.isCurrent && v.status === 'DEPLOYED')
                                        .map(version => (
                                          <div
                                            key={version.id}
                                            className={`p-2 rounded cursor-pointer ${
                                              rollbackTarget === version.id
                                                ? 'bg-blue-100'
                                                : 'hover:bg-gray-100'
                                            }`}
                                            onClick={() => setRollbackTarget(version.id)}
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="font-medium">v{version.version}</span>
                                              <span className="text-sm text-muted-foreground">
                                                {version.deployedAt
                                                  ? new Date(version.deployedAt).toLocaleDateString()
                                                  : 'Not deployed'}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                    </ScrollArea>
                                  </div>
                                  <div>
                                    <label htmlFor="rollback-reason" className="text-sm font-medium">
                                      Rollback Reason:
                                    </label>
                                    <Textarea
                                      id="rollback-reason"
                                      value={rollbackReason}
                                      onChange={(e) => setRollbackReason(e.target.value)}
                                      placeholder="Describe why you're rolling back..."
                                      className="mt-1"
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setRollbackDialogOpen(false);
                                      setRollbackTarget(null);
                                      setRollbackReason('');
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      if (rollbackTarget) {
                                        handleRollback(rollbackTarget, rollbackReason);
                                      }
                                    }}
                                    disabled={!rollbackTarget}
                                  >
                                    <RotateCcw className="w-4 h-4 mr-1" />
                                    Rollback
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold mb-2">Version Info</h4>
                          <div className="space-y-2 text-sm">
                            <div><strong>Status:</strong> {selectedVersionData.status}</div>
                            <div><strong>Source:</strong> {selectedVersionData.installSource}</div>
                            {selectedVersionData.gitCommit && (
                              <div className="flex items-center gap-1">
                                <strong>Git Commit:</strong>
                                <code className="text-xs bg-gray-100 px-1 rounded">
                                  {selectedVersionData.gitCommit.substring(0, 7)}
                                </code>
                              </div>
                            )}
                            {selectedVersionData.gitBranch && (
                              <div className="flex items-center gap-1">
                                <GitBranch className="w-3 h-3" />
                                {selectedVersionData.gitBranch}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Timeline</h4>
                          <div className="space-y-2 text-sm">
                            <div><strong>Created:</strong> {new Date(selectedVersionData.createdAt).toLocaleString()}</div>
                            {selectedVersionData.deployedAt && (
                              <div><strong>Deployed:</strong> {new Date(selectedVersionData.deployedAt).toLocaleString()}</div>
                            )}
                            {selectedVersionData.deployedBy && (
                              <div><strong>Deployed by:</strong> {selectedVersionData.deployedBy}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {selectedVersionData.notes && (
                        <div className="mt-4">
                          <h4 className="font-semibold mb-2">Notes</h4>
                          <p className="text-sm text-muted-foreground">{selectedVersionData.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Changelog Card */}
                  {selectedVersionData.changelog && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          Changelog
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-sm max-w-none">
                          <pre className="whitespace-pre-wrap text-sm">
                            {selectedVersionData.changelog}
                          </pre>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Dependencies Card */}
                  {selectedVersionData.dependencies && Object.keys(selectedVersionData.dependencies).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Settings className="w-5 h-5" />
                          Dependencies
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(selectedVersionData.dependencies).map(([name, version]) => (
                            <div key={name} className="flex justify-between items-center text-sm">
                              <code className="bg-gray-100 px-2 py-1 rounded">{name}</code>
                              <Badge variant="outline">{version}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Version Comparison */}
        <TabsContent value="comparison" className="mt-6">
          {versionComparison && versionComparison.length > 0 ? (
            <div className="space-y-4">
              {versionComparison.map((comparison: any, index: number) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>
                        v{comparison.from.version} → v{comparison.to.version}
                      </span>
                      <Badge 
                        variant={comparison.isBreaking ? "destructive" : "secondary"}
                        className={comparison.isBreaking ? "bg-red-100 text-red-800" : ""}
                      >
                        {comparison.type} {comparison.isBreaking && "BREAKING"}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 text-center">
                        <div className="font-semibold">v{comparison.from.version}</div>
                        <div className="text-sm text-muted-foreground">Previous</div>
                      </div>
                      <ArrowRight className="w-6 h-6 text-muted-foreground" />
                      <div className="flex-1 text-center">
                        <div className="font-semibold">v{comparison.to.version}</div>
                        <div className="text-sm text-muted-foreground">Current</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No Comparisons Available</AlertTitle>
              <AlertDescription>
                Need at least 2 versions to show comparisons.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Deployments */}
        <TabsContent value="deployments" className="mt-6">
          <div className="space-y-4">
            {plugin.versions
              .filter(v => v.deployments.length > 0)
              .map(version => (
                <Card key={version.id}>
                  <CardHeader>
                    <CardTitle>v{version.version} Deployments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {version.deployments.map(deployment => (
                        <div key={deployment.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(deployment.status)}>
                                {deployment.status}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {deployment.environment}
                              </span>
                              <Badge variant="outline">{deployment.strategy}</Badge>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {new Date(deployment.startedAt).toLocaleString()}
                            </span>
                          </div>
                          
                          {deployment.status === 'DEPLOYING' && (
                            <Progress value={deployment.progress} className="mb-2" />
                          )}
                          
                          <div className="text-sm">
                            <div><strong>Deployed by:</strong> {deployment.deployedBy}</div>
                            {deployment.completedAt && (
                              <div><strong>Completed:</strong> {new Date(deployment.completedAt).toLocaleString()}</div>
                            )}
                            {deployment.rollbackDeadline && new Date(deployment.rollbackDeadline) > new Date() && (
                              <div className="text-orange-600">
                                <strong>Auto-rollback deadline:</strong> {new Date(deployment.rollbackDeadline).toLocaleString()}
                              </div>
                            )}
                          </div>

                          {deployment.error && (
                            <Alert className="mt-2">
                              <XCircle className="h-4 w-4" />
                              <AlertTitle>Deployment Error</AlertTitle>
                              <AlertDescription>{deployment.error}</AlertDescription>
                            </Alert>
                          )}

                          {deployment.logs && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-sm font-medium">
                                View Logs
                              </summary>
                              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                                {deployment.logs}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        {/* Backups */}
        <TabsContent value="backups" className="mt-6">
          <div className="space-y-4">
            {plugin.versions
              .filter(v => v.backupsBefore.length > 0 || v.backupsAfter.length > 0)
              .map(version => (
                <Card key={version.id}>
                  <CardHeader>
                    <CardTitle>v{version.version} Backups</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[...version.backupsBefore, ...version.backupsAfter].map(backup => (
                        <div key={backup.id} className="flex items-center justify-between border rounded-lg p-3">
                          <div className="flex items-center gap-3">
                            <Badge className={getStatusColor(backup.status)}>
                              {backup.status}
                            </Badge>
                            <div>
                              <div className="font-medium">{backup.backupType}</div>
                              <div className="text-sm text-muted-foreground">
                                {backup.source} • {formatSize(backup.size)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {new Date(backup.createdAt).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {backup.storagePath}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        {/* Migrations */}
        <TabsContent value="migrations" className="mt-6">
          <div className="space-y-4">
            {plugin.versions
              .filter(v => v.migrationExecution.length > 0)
              .map(version => (
                <Card key={version.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="w-5 h-5" />
                      v{version.version} Migrations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {version.migrationExecution.map(migration => (
                        <div key={migration.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusColor(migration.status)}>
                                {migration.status}
                              </Badge>
                              <Badge variant="outline">{migration.type}</Badge>
                            </div>
                            {migration.executionTime && (
                              <span className="text-sm text-muted-foreground">
                                {formatDuration(migration.executionTime)}
                              </span>
                            )}
                          </div>

                          <div className="text-sm space-y-1">
                            {migration.executedBy && (
                              <div><strong>Executed by:</strong> {migration.executedBy}</div>
                            )}
                            {migration.executedAt && (
                              <div><strong>Executed:</strong> {new Date(migration.executedAt).toLocaleString()}</div>
                            )}
                          </div>

                          {migration.error && (
                            <Alert className="mt-2">
                              <XCircle className="h-4 w-4" />
                              <AlertTitle>Migration Error</AlertTitle>
                              <AlertDescription>{migration.error}</AlertDescription>
                            </Alert>
                          )}

                          {migration.output && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-sm font-medium">
                                View Output
                              </summary>
                              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                                {migration.output}
                              </pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PluginVersionManager;