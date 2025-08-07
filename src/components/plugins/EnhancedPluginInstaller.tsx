'use client';

/**
 * Enhanced Plugin Installer Component
 * Advanced plugin installation with real-time progress, rollback, and multi-environment support
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Download,
  Upload,
  RefreshCw,
  ArrowLeft,
  Check,
  X,
  AlertCircle,
  Clock,
  Shield,
  Package,
  Settings,
  Play,
  Pause,
  RotateCcw,
  GitBranch,
  Server,
  Database,
  Zap,
  Activity,
  ChevronRight,
  ChevronDown,
  Info,
  FileText,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface InstallationStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number;
  message?: string;
  error?: string;
  duration?: number;
  substeps?: InstallationStep[];
}

interface InstallationOptions {
  environment: 'development' | 'staging' | 'production';
  strategy: 'immediate' | 'rolling' | 'blue-green' | 'canary';
  rollbackOnFailure: boolean;
  healthCheckEnabled: boolean;
  backupBeforeInstall: boolean;
  multiTenant: boolean;
  tenantIds?: string[];
  configuration?: Record<string, any>;
  preInstallHooks?: string[];
  postInstallHooks?: string[];
}

interface PluginInstallation {
  pluginId: string;
  version: string;
  operationId: string;
  status: 'queued' | 'installing' | 'completed' | 'failed' | 'rolled-back';
  steps: InstallationStep[];
  startTime?: Date;
  endTime?: Date;
  logs: string[];
  metrics?: {
    resourcesAllocated: Record<string, number>;
    performanceMetrics: Record<string, number>;
    healthScore: number;
  };
}

interface EnhancedPluginInstallerProps {
  pluginId: string;
  pluginName: string;
  currentVersion?: string;
  availableVersions: string[];
  onInstallComplete?: (result: any) => void;
  onCancel?: () => void;
}

export function EnhancedPluginInstaller({
  pluginId,
  pluginName,
  currentVersion,
  availableVersions,
  onInstallComplete,
  onCancel
}: EnhancedPluginInstallerProps) {
  const [selectedVersion, setSelectedVersion] = useState(availableVersions[0] || 'latest');
  const [installation, setInstallation] = useState<PluginInstallation | null>(null);
  const [options, setOptions] = useState<InstallationOptions>({
    environment: 'development',
    strategy: 'immediate',
    rollbackOnFailure: true,
    healthCheckEnabled: true,
    backupBeforeInstall: true,
    multiTenant: false
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [configYaml, setConfigYaml] = useState('');

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (installation?.operationId) {
      const ws = new WebSocket(`ws://localhost:3001/ws/plugin-install/${installation.operationId}`);
      
      ws.onmessage = (event) => {
        const update = JSON.parse(event.data);
        handleInstallationUpdate(update);
      };

      return () => ws.close();
    }
  }, [installation?.operationId]);

  const handleInstallationUpdate = (update: any) => {
    setInstallation(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        status: update.status,
        steps: update.steps || prev.steps,
        logs: [...prev.logs, ...( || [])],
        metrics: update.metrics || prev.metrics
      };
    });

    // Show toast notifications for important events
    if (update.status === 'completed') {
      toast.success(`${pluginName} installed successfully!`);
      onInstallComplete?.(update);
    } else if (update.status === 'failed') {
      toast.error(`Failed to install ${pluginName}: ${update.error}`);
    } else if (update.status === 'rolled-back') {
      toast.warning(`Installation rolled back for ${pluginName}`);
    }
  };

  const startInstallation = async () => {
    setIsInstalling(true);
    
    // Create installation object
    const newInstallation: PluginInstallation = {
      pluginId,
      version: selectedVersion,
      operationId: `install_${Date.now()}`,
      status: 'queued',
      steps: createInstallationSteps(options),
      startTime: new Date(),
      logs: [`Starting installation of ${pluginName} v${selectedVersion}`]
    };
    
    setInstallation(newInstallation);

    try {
      // Parse configuration if provided
      let configuration;
      if (configYaml) {
        try {
          configuration = JSON.parse(configYaml); // In production, use YAML parser
        } catch (e) {
          toast.error('Invalid configuration format');
          setIsInstalling(false);
          return;
        }
      }

      // Call API to start installation
      const response = await fetch('/api/plugin-lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: currentVersion ? 'update' : 'install',
          pluginId,
          version: selectedVersion,
          environment: options.environment,
          configuration,
          rollbackOnFailure: options.rollbackOnFailure,
          healthCheckEnabled: options.healthCheckEnabled,
          multiTenant: options.multiTenant ? {
            enabled: true,
            tenantIds: options.tenantIds
          } : undefined,
          preInstallHooks: options.preInstallHooks,
          postInstallHooks: options.postInstallHooks,
          ...(currentVersion && {
            strategy: options.strategy,
            backupBeforeUpdate: options.backupBeforeInstall
          })
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setInstallation(prev => ({
          ...prev!,
          operationId: result.operationId,
          status: 'installing'
        }));
      } else {
        throw new Error(result.error || 'Installation failed');
      }
    } catch (error) {
      toast.error(`Failed to start installation: ${error}`);
      setIsInstalling(false);
      setInstallation(prev => prev ? { ...prev, status: 'failed' } : null);
    }
  };

  const cancelInstallation = async () => {
    if (!installation?.operationId) return;

    try {
      const response = await fetch(`/api/plugin-lifecycle?operationId=${installation.operationId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.info('Installation cancelled');
        setIsInstalling(false);
        setInstallation(null);
        onCancel?.();
      }
    } catch (error) {
      toast.error('Failed to cancel installation');
    }
  };

  const rollbackInstallation = async () => {
    if (!installation) return;

    try {
      const response = await fetch('/api/plugin-lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rollback',
          pluginId,
          strategy: 'immediate'
        })
      });

      if (response.ok) {
        toast.success('Rollback initiated');
      }
    } catch (error) {
      toast.error('Failed to initiate rollback');
    }
  };

  const createInstallationSteps = (opts: InstallationOptions): InstallationStep[] => {
    const steps: InstallationStep[] = [];

    // Pre-installation steps
    steps.push({
      id: 'pre-checks',
      name: 'Pre-installation Checks',
      status: 'pending',
      progress: 0,
      substeps: [
        { id: 'compatibility', name: 'Check Compatibility', status: 'pending', progress: 0 },
        { id: 'dependencies', name: 'Verify Dependencies', status: 'pending', progress: 0 },
        { id: 'resources', name: 'Check Resource Availability', status: 'pending', progress: 0 },
        { id: 'governance', name: 'Governance Policy Check', status: 'pending', progress: 0 }
      ]
    });

    if (opts.backupBeforeInstall) {
      steps.push({
        id: 'backup',
        name: 'Create Backup',
        status: 'pending',
        progress: 0
      });
    }

    // Main installation steps based on strategy
    if (opts.strategy === 'canary') {
      steps.push({
        id: 'canary-deploy',
        name: 'Canary Deployment',
        status: 'pending',
        progress: 0,
        substeps: [
          { id: 'canary-10', name: 'Deploy to 10% of instances', status: 'pending', progress: 0 },
          { id: 'canary-monitor', name: 'Monitor Canary Metrics', status: 'pending', progress: 0 },
          { id: 'canary-validate', name: 'Validate Canary Health', status: 'pending', progress: 0 }
        ]
      });
    } else if (opts.strategy === 'blue-green') {
      steps.push({
        id: 'blue-green',
        name: 'Blue-Green Deployment',
        status: 'pending',
        progress: 0,
        substeps: [
          { id: 'green-deploy', name: 'Deploy to Green Environment', status: 'pending', progress: 0 },
          { id: 'green-test', name: 'Test Green Environment', status: 'pending', progress: 0 },
          { id: 'switch-traffic', name: 'Switch Traffic to Green', status: 'pending', progress: 0 }
        ]
      });
    }

    // Core installation
    steps.push({
      id: 'install',
      name: currentVersion ? 'Update Plugin' : 'Install Plugin',
      status: 'pending',
      progress: 0,
      substeps: [
        { id: 'download', name: 'Download Package', status: 'pending', progress: 0 },
        { id: 'extract', name: 'Extract Files', status: 'pending', progress: 0 },
        { id: 'configure', name: 'Apply Configuration', status: 'pending', progress: 0 },
        { id: 'register', name: 'Register with Backstage', status: 'pending', progress: 0 }
      ]
    });

    // Post-installation steps
    if (opts.healthCheckEnabled) {
      steps.push({
        id: 'health-check',
        name: 'Health Checks',
        status: 'pending',
        progress: 0,
        substeps: [
          { id: 'startup', name: 'Verify Startup', status: 'pending', progress: 0 },
          { id: 'endpoints', name: 'Test API Endpoints', status: 'pending', progress: 0 },
          { id: 'integration', name: 'Verify Integration', status: 'pending', progress: 0 }
        ]
      });
    }

    steps.push({
      id: 'finalize',
      name: 'Finalize Installation',
      status: 'pending',
      progress: 0
    });

    return steps;
  };

  const getStepIcon = (step: InstallationStep) => {
    switch (step.status) {
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <X className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'skipped':
        return <ChevronRight className="h-4 w-4 text-gray-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getOverallProgress = (): number => {
    if (!installation?.steps) return 0;
    
    const totalSteps = installation.steps.length;
    const completedSteps = installation.steps.filter(s => s.status === 'completed').length;
    
    return (completedSteps / totalSteps) * 100;
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {currentVersion ? 'Update' : 'Install'} {pluginName}
            </CardTitle>
            <CardDescription>
              {currentVersion 
                ? `Update from v${currentVersion} to v${selectedVersion}`
                : `Install version ${selectedVersion}`}
            </CardDescription>
          </div>
          {installation && (
            <Badge variant={installation.status === 'completed' ? 'success' : 
                           installation.status === 'failed' ? 'destructive' : 
                           'default'}>
              {installation.status}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!installation ? (
          // Installation setup
          <>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="version">Version</Label>
                <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVersions.map(version => (
                      <SelectItem key={version} value={version}>
                        {version}
                        {version === 'latest' && ' (recommended)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="environment">Environment</Label>
                <Select 
                  value={options.environment} 
                  onValueChange={(v) => setOptions({...options, environment: v as any})}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="development">
                      <span className="flex items-center gap-2">
                        <Server className="h-4 w-4" />
                        Development
                      </span>
                    </SelectItem>
                    <SelectItem value="staging">
                      <span className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4" />
                        Staging
                      </span>
                    </SelectItem>
                    <SelectItem value="production">
                      <span className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Production
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {currentVersion && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="strategy">Deployment Strategy</Label>
                  <Select 
                    value={options.strategy} 
                    onValueChange={(v) => setOptions({...options, strategy: v as any})}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">Immediate</SelectItem>
                      <SelectItem value="rolling">Rolling Update</SelectItem>
                      <SelectItem value="blue-green">Blue-Green</SelectItem>
                      <SelectItem value="canary">Canary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="rollback" className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Enable automatic rollback on failure
                </Label>
                <Switch 
                  id="rollback"
                  checked={options.rollbackOnFailure}
                  onCheckedChange={(v) => setOptions({...options, rollbackOnFailure: v})}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="health" className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Run health checks after installation
                </Label>
                <Switch 
                  id="health"
                  checked={options.healthCheckEnabled}
                  onCheckedChange={(v) => setOptions({...options, healthCheckEnabled: v})}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="backup" className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Create backup before installation
                </Label>
                <Switch 
                  id="backup"
                  checked={options.backupBeforeInstall}
                  onCheckedChange={(v) => setOptions({...options, backupBeforeInstall: v})}
                />
              </div>
            </div>

            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  Advanced Configuration
                  {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="config">Plugin Configuration (YAML/JSON)</Label>
                  <Textarea
                    id="config"
                    placeholder="Enter plugin configuration..."
                    value={configYaml}
                    onChange={(e) => setConfigYaml(e.target.value)}
                    className="mt-2 h-32 font-mono text-sm"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="multitenant" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Enable multi-tenant isolation
                  </Label>
                  <Switch 
                    id="multitenant"
                    checked={options.multiTenant}
                    onCheckedChange={(v) => setOptions({...options, multiTenant: v})}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex gap-3">
              <Button onClick={startInstallation} disabled={isInstalling} className="flex-1">
                {isInstalling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    {currentVersion ? 'Start Update' : 'Start Installation'}
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          // Installation progress
          <>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-sm text-gray-500">
                    {Math.round(getOverallProgress())}%
                  </span>
                </div>
                <Progress value={getOverallProgress()} className="h-2" />
              </div>

              <ScrollArea className="h-[400px] rounded-md border p-4">
                <div className="space-y-3">
                  {installation.steps.map((step, index) => (
                    <div key={step.id} className="space-y-2">
                      <div className="flex items-center gap-3">
                        {getStepIcon(step)}
                        <span className={`flex-1 text-sm ${
                          step.status === 'running' ? 'font-semibold' : ''
                        }`}>
                          {step.name}
                        </span>
                        {step.duration && (
                          <span className="text-xs text-gray-500">
                            {(step.duration / 1000).toFixed(1)}s
                          </span>
                        )}
                      </div>
                      
                      {step.message && (
                        <p className="ml-7 text-xs text-gray-600">{step.message}</p>
                      )}
                      
                      {step.error && (
                        <Alert variant="destructive" className="ml-7">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            {step.error}
                          </AlertDescription>
                        </Alert>
                      )}

                      {step.substeps && step.status === 'running' && (
                        <div className="ml-7 space-y-2">
                          {step.substeps.map(substep => (
                            <div key={substep.id} className="flex items-center gap-2 text-xs">
                              {getStepIcon(substep)}
                              <span className="text-gray-600">{substep.name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {step.status === 'running' && step.progress > 0 && (
                        <Progress value={step.progress} className="ml-7 h-1" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {installation.metrics && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500">CPU Allocated</p>
                    <p className="text-sm font-medium">
                      {installation.metrics.resourcesAllocated.cpu?.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Memory Allocated</p>
                    <p className="text-sm font-medium">
                      {installation.metrics.resourcesAllocated.memory?.toFixed(0)} MB
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Health Score</p>
                    <p className="text-sm font-medium">
                      {installation.metrics.healthScore?.toFixed(0)}/100
                    </p>
                  </div>
                </div>
              )}

              <Collapsible open={showLogs} onOpenChange={setShowLogs}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full">
                    <FileText className="mr-2 h-4 w-4" />
                    {showLogs ? 'Hide' : 'Show'} Installation Logs
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="h-48 rounded-md border bg-black p-3 mt-2">
                    <pre className="text-xs text-green-400 font-mono">
                      {installation.logs.join('\n')}
                    </pre>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            </div>

            <div className="flex gap-3">
              {installation.status === 'installing' && (
                <>
                  <Button 
                    variant="outline" 
                    onClick={cancelInstallation}
                    className="flex-1"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel Installation
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsInstalling(!isInstalling)}
                  >
                    {isInstalling ? (
                      <><Pause className="mr-2 h-4 w-4" /> Pause</>
                    ) : (
                      <><Play className="mr-2 h-4 w-4" /> Resume</>
                    )}
                  </Button>
                </>
              )}

              {installation.status === 'failed' && (
                <>
                  <Button 
                    variant="destructive" 
                    onClick={rollbackInstallation}
                    className="flex-1"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Rollback Changes
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => startInstallation()}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                </>
              )}

              {installation.status === 'completed' && (
                <Button onClick={onInstallComplete} className="w-full">
                  <Check className="mr-2 h-4 w-4" />
                  Complete
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}