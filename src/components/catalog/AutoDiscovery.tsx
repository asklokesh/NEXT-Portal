'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Settings,
  Globe,
  Cloud,
  Database,
  GitBranch,
  Package,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Play,
  Pause,
  RefreshCw,
  Eye,
  EyeOff,
  Zap,
  Server,
  Container,
  Activity,
  ChevronRight,
  Save,
  Plus
} from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';

interface DiscoveryProvider {
  id: string;
  name: string;
  icon: any;
  description: string;
  enabled: boolean;
  config: Record<string, any>;
  status?: 'active' | 'inactive' | 'error';
  lastRun?: string;
  entitiesFound?: number;
}

interface DiscoveryRule {
  id: string;
  name: string;
  pattern: string;
  type: 'include' | 'exclude';
  enabled: boolean;
}

export function AutoDiscovery() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [activeTab, setActiveTab] = useState('providers');
  const [discoveryProgress, setDiscoveryProgress] = useState(0);
  
  // Discovery providers state
  const [providers, setProviders] = useState<DiscoveryProvider[]>([
    {
      id: 'github',
      name: 'GitHub Discovery',
      icon: GitBranch,
      description: 'Automatically discover repositories and catalog files from GitHub',
      enabled: false,
      config: {
        organization: '',
        token: '',
        scanInterval: '60',
        includeArchived: false,
        topics: []
      }
    },
    {
      id: 'kubernetes',
      name: 'Kubernetes Discovery',
      icon: Container,
      description: 'Discover services, deployments, and resources from Kubernetes clusters',
      enabled: false,
      config: {
        clusters: [],
        namespaces: [],
        labelSelectors: [],
        scanInterval: '30'
      }
    },
    {
      id: 'aws',
      name: 'AWS Discovery',
      icon: Cloud,
      description: 'Discover AWS resources like EC2, RDS, Lambda, and more',
      enabled: false,
      config: {
        regions: [],
        accessKeyId: '',
        secretAccessKey: '',
        resourceTypes: [],
        tags: []
      }
    },
    {
      id: 'gcp',
      name: 'GCP Discovery',
      icon: Cloud,
      description: 'Discover Google Cloud resources and services',
      enabled: false,
      config: {
        projectId: '',
        serviceAccountKey: '',
        resourceTypes: [],
        labels: []
      }
    },
    {
      id: 'database',
      name: 'Database Discovery',
      icon: Database,
      description: 'Discover databases, schemas, and tables',
      enabled: false,
      config: {
        type: 'postgresql',
        host: '',
        port: '',
        username: '',
        password: '',
        databases: []
      }
    }
  ]);

  // Discovery rules
  const [rules, setRules] = useState<DiscoveryRule[]>([
    {
      id: '1',
      name: 'Include production services',
      pattern: 'metadata.labels.environment=production',
      type: 'include',
      enabled: true
    },
    {
      id: '2',
      name: 'Exclude test environments',
      pattern: 'metadata.name~test-*',
      type: 'exclude',
      enabled: true
    }
  ]);

  const handleProviderToggle = (providerId: string) => {
    setProviders(prev => prev.map(p => 
      p.id === providerId ? { ...p, enabled: !p.enabled } : p
    ));
  };

  const handleProviderConfig = (providerId: string, config: Record<string, any>) => {
    setProviders(prev => prev.map(p => 
      p.id === providerId ? { ...p, config } : p
    ));
  };

  const handleSaveConfiguration = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/catalog/discovery/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providers: providers.filter(p => p.enabled),
          rules
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save discovery configuration');
      }

      toast.success('Discovery configuration saved successfully');
    } catch (error) {
      toast.error('Failed to save configuration');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRunDiscovery = async () => {
    setScanning(true);
    setDiscoveryProgress(0);
    
    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setDiscoveryProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      const response = await fetch('/api/catalog/discovery/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providers: providers.filter(p => p.enabled).map(p => p.id)
        })
      });

      clearInterval(progressInterval);
      setDiscoveryProgress(100);

      if (!response.ok) {
        throw new Error('Discovery scan failed');
      }

      const result = await response.json();
      toast.success(`Discovery completed: ${result.entitiesFound} entities found`);
      
      // Redirect to catalog
      setTimeout(() => {
        router.push('/catalog');
      }, 2000);
    } catch (error) {
      toast.error('Discovery scan failed');
      console.error(error);
    } finally {
      setScanning(false);
      setTimeout(() => setDiscoveryProgress(0), 1000);
    }
  };

  const renderProviderConfig = (provider: DiscoveryProvider) => {
    switch (provider.id) {
      case 'github':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Organization</Label>
                <Input
                  placeholder="my-org"
                  value={provider.config?.organization || ''}
                  onChange={(e) => handleProviderConfig(provider.id, {
                    ...provider.config,
                    organization: e.target.value
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Access Token</Label>
                <div className="relative">
                  <Input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxx"
                    value={provider.config?.token || ''}
                    onChange={(e) => handleProviderConfig(provider.id, {
                      ...provider.config,
                      token: e.target.value
                    })}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Topics (comma-separated)</Label>
              <Input
                placeholder="backstage, service, api"
                value={provider.config?.topics?.join(', ') || ''}
                onChange={(e) => handleProviderConfig(provider.id, {
                  ...provider.config,
                  topics: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="include-archived"
                checked={provider.config?.includeArchived || false}
                onCheckedChange={(checked) => handleProviderConfig(provider.id, {
                  ...provider.config,
                  includeArchived: checked
                })}
              />
              <Label htmlFor="include-archived">Include archived repositories</Label>
            </div>
          </div>
        );

      case 'kubernetes':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Clusters (comma-separated)</Label>
              <Input
                placeholder="prod-cluster, staging-cluster"
                value={provider.config?.clusters?.join(', ') || ''}
                onChange={(e) => handleProviderConfig(provider.id, {
                  ...provider.config,
                  clusters: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>Namespaces (comma-separated)</Label>
              <Input
                placeholder="default, production, staging"
                value={provider.config?.namespaces?.join(', ') || ''}
                onChange={(e) => handleProviderConfig(provider.id, {
                  ...provider.config,
                  namespaces: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>Label Selectors</Label>
              <Textarea
                placeholder="app.kubernetes.io/managed-by=backstage"
                value={provider.config?.labelSelectors?.join('\n') || ''}
                onChange={(e) => handleProviderConfig(provider.id, {
                  ...provider.config,
                  labelSelectors: e.target.value.split('\n').filter(Boolean)
                })}
                rows={3}
              />
            </div>
          </div>
        );

      case 'aws':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Access Key ID</Label>
                <Input
                  placeholder="AKIAXXXXXXXXXXXXXXXX"
                  value={provider.config?.accessKeyId || ''}
                  onChange={(e) => handleProviderConfig(provider.id, {
                    ...provider.config,
                    accessKeyId: e.target.value
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Secret Access Key</Label>
                <Input
                  type="password"
                  placeholder="••••••••••••••••••••"
                  value={provider.config?.secretAccessKey || ''}
                  onChange={(e) => handleProviderConfig(provider.id, {
                    ...provider.config,
                    secretAccessKey: e.target.value
                  })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Regions (comma-separated)</Label>
              <Input
                placeholder="us-east-1, eu-west-1"
                value={provider.config?.regions?.join(', ') || ''}
                onChange={(e) => handleProviderConfig(provider.id, {
                  ...provider.config,
                  regions: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>Resource Types</Label>
              <div className="grid grid-cols-3 gap-2">
                {['EC2', 'RDS', 'Lambda', 'S3', 'ECS', 'EKS'].map(type => (
                  <label key={type} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={provider.config?.resourceTypes?.includes(type) || false}
                      onChange={(e) => {
                        const types = provider.config?.resourceTypes || [];
                        handleProviderConfig(provider.id, {
                          ...provider.config,
                          resourceTypes: e.target.checked 
                            ? [...types, type]
                            : types.filter((t: string) => t !== type)
                        });
                      }}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return <div className="text-muted-foreground">Configuration options coming soon...</div>;
    }
  };

  const addRule = () => {
    const newRule: DiscoveryRule = {
      id: Date.now().toString(),
      name: '',
      pattern: '',
      type: 'include',
      enabled: true
    };
    setRules([...rules, newRule]);
  };

  const updateRule = (id: string, updates: Partial<DiscoveryRule>) => {
    setRules(rules.map(rule => 
      rule.id === id ? { ...rule, ...updates } : rule
    ));
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter(rule => rule.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Auto Discovery</h2>
          <p className="text-muted-foreground">
            Automatically discover and import services into your catalog
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSaveConfiguration}
            disabled={loading}
          >
            <Save className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
          <Button
            onClick={handleRunDiscovery}
            disabled={scanning || !providers.some(p => p.enabled)}
          >
            {scanning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Discovery
              </>
            )}
          </Button>
        </div>
      </div>

      {scanning && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Discovery Progress</span>
                <span className="text-sm text-muted-foreground">{discoveryProgress}%</span>
              </div>
              <Progress value={discoveryProgress} />
              <p className="text-sm text-muted-foreground">
                Scanning configured providers for entities...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Auto Discovery</AlertTitle>
        <AlertDescription>
          Configure providers below to automatically discover and import entities into your catalog.
          Discovery runs can be scheduled or triggered manually.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {/* Providers Section */}
        <Card>
          <CardHeader>
            <CardTitle>Discovery Providers</CardTitle>
            <CardDescription>
              Configure sources to automatically discover entities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {providers.map(provider => (
                <AccordionItem key={provider.id} value={provider.id}>
                  <div className="flex items-center justify-between">
                    <AccordionTrigger className="hover:no-underline flex-1">
                      <div className="flex items-center gap-3">
                        <provider.icon className="h-5 w-5 text-muted-foreground" />
                        <div className="text-left">
                          <div className="font-medium">{provider.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {provider.description}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <div className="pr-4">
                      <Switch
                        checked={provider.enabled}
                        onCheckedChange={() => handleProviderToggle(provider.id)}
                      />
                    </div>
                  </div>
                  <AccordionContent>
                    <div className="pt-4">
                      {renderProviderConfig(provider)}
                      
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <Label>Scan Interval (minutes)</Label>
                            <p className="text-sm text-muted-foreground">
                              How often to scan this provider
                            </p>
                          </div>
                          <Select
                            value={provider.config?.scanInterval?.toString() || '60'}
                            onValueChange={(value) => handleProviderConfig(provider.id, {
                              ...provider.config,
                              scanInterval: value
                            })}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">5 min</SelectItem>
                              <SelectItem value="15">15 min</SelectItem>
                              <SelectItem value="30">30 min</SelectItem>
                              <SelectItem value="60">1 hour</SelectItem>
                              <SelectItem value="180">3 hours</SelectItem>
                              <SelectItem value="360">6 hours</SelectItem>
                              <SelectItem value="720">12 hours</SelectItem>
                              <SelectItem value="1440">24 hours</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {provider.status && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant={
                                provider.status === 'active' ? 'default' :
                                provider.status === 'error' ? 'destructive' : 'secondary'
                              }>
                                {provider.status}
                              </Badge>
                              {provider.lastRun && (
                                <span className="text-sm text-muted-foreground">
                                  Last run: {provider.lastRun}
                                </span>
                              )}
                            </div>
                            {provider.entitiesFound !== undefined && (
                              <span className="text-sm font-medium">
                                {provider.entitiesFound} entities found
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Discovery Rules */}
        <Card>
          <CardHeader>
            <CardTitle>Discovery Rules</CardTitle>
            <CardDescription>
              Define rules to filter which entities are imported
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rules.map(rule => (
                <div key={rule.id} className="flex items-center gap-4 p-4 border rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-4">
                    <Input
                      placeholder="Rule name"
                      value={rule.name}
                      onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                    />
                    <Input
                      placeholder="Pattern (e.g., metadata.name~service-*)"
                      value={rule.pattern}
                      onChange={(e) => updateRule(rule.id, { pattern: e.target.value })}
                    />
                    <Select
                      value={rule.type}
                      onValueChange={(value: 'include' | 'exclude') => 
                        updateRule(rule.id, { type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="include">Include</SelectItem>
                        <SelectItem value="exclude">Exclude</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => updateRule(rule.id, { enabled: checked })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button
                variant="outline"
                onClick={addRule}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Discovery Status */}
        <Card>
          <CardHeader>
            <CardTitle>Discovery Status</CardTitle>
            <CardDescription>
              Monitor the status of your discovery providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {providers.filter(p => p.enabled).map(provider => (
                <div key={provider.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <provider.icon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{provider.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {provider.status === 'active' ? 'Running' : 'Idle'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {provider.entitiesFound || 0} entities
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {provider.lastRun || 'Never run'}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {!providers.some(p => p.enabled) && (
                <div className="text-center py-8 text-muted-foreground">
                  No providers enabled. Enable a provider above to start discovering entities.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Add missing import
const X = Activity;