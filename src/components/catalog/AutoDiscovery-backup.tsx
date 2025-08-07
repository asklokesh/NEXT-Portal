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
 toast.success(`Discovery completed! Found ${result.totalEntities} entities`);
 
 // Update provider status
 setProviders(prev => prev.map(p => ({
 ...p,
 status: result.providers[p.id]?.status || p.status,
 lastRun: result.providers[p.id]?.lastRun || p.lastRun,
 entitiesFound: result.providers[p.id]?.entitiesFound || p.entitiesFound
 })));
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
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label>Organization</Label>
 <Input
 placeholder="my-org"
 value={provider.config.organization}
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
 value={provider.config.token}
 onChange={(e) => handleProviderConfig(provider.id, {
 ...provider.config,
 token: e.target.value
 })}
 />
 </div>
 </div>
 </div>
 <div className="space-y-2">
 <Label>Filter by Topics (comma separated)</Label>
 <Input
 placeholder="backstage, service, api"
 value={provider.config.topics?.join(', ') || ''}
 onChange={(e) => handleProviderConfig(provider.id, {
 ...provider.config,
 topics: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
 })}
 />
 </div>
 <div className="flex items-center space-x-2">
 <Switch
 id="include-archived"
 checked={provider.config.includeArchived}
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
 <Label>Cluster Contexts (comma separated)</Label>
 <Input
 placeholder="prod-cluster, staging-cluster"
 value={provider.config.clusters?.join(', ') || ''}
 onChange={(e) => handleProviderConfig(provider.id, {
 ...provider.config,
 clusters: e.target.value.split(',').map(c => c.trim()).filter(Boolean)
 })}
 />
 </div>
 <div className="space-y-2">
 <Label>Namespaces (comma separated, empty for all)</Label>
 <Input
 placeholder="default, production, staging"
 value={provider.config.namespaces?.join(', ') || ''}
 onChange={(e) => handleProviderConfig(provider.id, {
 ...provider.config,
 namespaces: e.target.value.split(',').map(n => n.trim()).filter(Boolean)
 })}
 />
 </div>
 <div className="space-y-2">
 <Label>Label Selectors</Label>
 <Textarea
 placeholder="app.kubernetes.io/managed-by=backstage"
 value={provider.config.labelSelectors?.join('\n') || ''}
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
 <div className="grid gap-4 md:grid-cols-2">
 <div className="space-y-2">
 <Label>AWS Access Key ID</Label>
 <Input
 placeholder="AKIAXXXXXXXXXXXXXXXX"
 value={provider.config.accessKeyId}
 onChange={(e) => handleProviderConfig(provider.id, {
 ...provider.config,
 accessKeyId: e.target.value
 })}
 />
 </div>
 <div className="space-y-2">
 <Label>AWS Secret Access Key</Label>
 <Input
 type="password"
 placeholder="••••••••••••••••••••"
 value={provider.config.secretAccessKey}
 onChange={(e) => handleProviderConfig(provider.id, {
 ...provider.config,
 secretAccessKey: e.target.value
 })}
 />
 </div>
 </div>
 <div className="space-y-2">
 <Label>Regions (comma separated)</Label>
 <Input
 placeholder="us-east-1, eu-west-1"
 value={provider.config.regions?.join(', ') || ''}
 onChange={(e) => handleProviderConfig(provider.id, {
 ...provider.config,
 regions: e.target.value.split(',').map(r => r.trim()).filter(Boolean)
 })}
 />
 </div>
 <div className="space-y-2">
 <Label>Resource Types</Label>
 <div className="grid grid-cols-2 gap-2">
 {['EC2', 'RDS', 'Lambda', 'S3', 'EKS', 'DynamoDB'].map(type => (
 <label key={type} className="flex items-center space-x-2">
 <input
 type="checkbox"
 checked={provider.config.resourceTypes?.includes(type) || false}
 onChange={(e) => {
 const types = provider.config.resourceTypes || [];
 handleProviderConfig(provider.id, {
 ...provider.config,
 resourceTypes: e.target.checked 
 ? [...types, type]
 : types.filter(t => t !== type)
 });
 }}
 className="rounded border-gray-300"
 />
 <span className="text-sm">{type}</span>
 </label>
 ))}
 </div>
 </div>
 </div>
 );

 default:
 return null;
 }
 };

 return (
 <div className="space-y-6 max-w-6xl mx-auto">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-2xl font-bold">Auto-discovery</h2>
 <p className="text-muted-foreground mt-1">
 Automatically discover and import entities from your infrastructure
 </p>
 </div>
 <div className="flex gap-2">
 <Button
 variant="outline"
 onClick={handleSaveConfiguration}
 disabled={loading || scanning}
 >
 <Save className="mr-2 h-4 w-4" />
 Save Configuration
 </Button>
 <Button
 onClick={handleRunDiscovery}
 disabled={scanning || !providers.some(p => p.enabled)}
 >
 {scanning ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
 Scanning...
 </>
 ) : (
 <>
 <Play className="mr-2 h-4 w-4" />
 Run Discovery
 </>
 )}
 </Button>
 </div>
 </div>

 {/* Progress Bar */}
 {scanning && (
 <Card>
 <CardContent className="pt-6">
 <div className="space-y-2">
 <div className="flex items-center justify-between text-sm">
 <span>Discovering entities...</span>
 <span>{discoveryProgress}%</span>
 </div>
 <Progress value={discoveryProgress} className="h-2" />
 </div>
 </CardContent>
 </Card>
 )}

 {/* Discovery Status */}
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
 {providers.filter(p => p.enabled).map(provider => (
 <Card key={provider.id}>
 <CardContent className="pt-6">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <provider.icon className="h-5 w-5 text-muted-foreground" />
 <span className="font-medium">{provider.name}</span>
 </div>
 <Badge
 variant={
 provider.status === 'active' ? 'default' :
 provider.status === 'error' ? 'destructive' : 'secondary'
 }
 >
 {provider.status || 'inactive'}
 </Badge>
 </div>
 {provider.lastRun && (
 <div className="mt-3 space-y-1 text-sm text-muted-foreground">
 <div>Last run: {new Date(provider.lastRun).toLocaleString()}</div>
 <div>Entities found: {provider.entitiesFound || 0}</div>
 </div>
 )}
 </CardContent>
 </Card>
 ))}
 </div>

 {/* Configuration */}
 <Card>
 <CardHeader>
 <CardTitle>Discovery Providers</CardTitle>
 <CardDescription>
 Configure and enable discovery providers to automatically find entities
 </CardDescription>
 </CardHeader>
 <CardContent>
 <Accordion type="single" collapsible className="w-full">
 {providers.map(provider => (
 <AccordionItem key={provider.id} value={provider.id}>
 <AccordionTrigger className="hover:no-underline">
 <div className="flex items-center justify-between w-full pr-4">
 <div className="flex items-center gap-3">
 <provider.icon className="h-5 w-5 text-muted-foreground" />
 <div className="text-left">
 <div className="font-medium">{provider.name}</div>
 <div className="text-sm text-muted-foreground">
 {provider.description}
 </div>
 </div>
 </div>
 <Switch
 checked={provider.enabled}
 onCheckedChange={() => handleProviderToggle(provider.id)}
 onClick={(e) => e.stopPropagation()}
 />
 </div>
 </AccordionTrigger>
 <AccordionContent>
 <div className="pt-4">
 {renderProviderConfig(provider)}
 
 <div className="mt-4 pt-4 border-t">
 <div className="flex items-center justify-between">
 <div className="space-y-1">
 <Label>Scan Interval (minutes)</Label>
 <p className="text-sm text-muted-foreground">
 How often to run automatic discovery
 </p>
 </div>
 <Select
 value={provider.config.scanInterval?.toString()}
 onValueChange={(value) => handleProviderConfig(provider.id, {
 ...provider.config,
 scanInterval: value
 })}
 >
 <SelectTrigger className="w-32">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="15">15 min</SelectItem>
 <SelectItem value="30">30 min</SelectItem>
 <SelectItem value="60">1 hour</SelectItem>
 <SelectItem value="360">6 hours</SelectItem>
 <SelectItem value="1440">24 hours</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
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
 Define rules to filter which entities should be imported
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {rules.map(rule => (
 <div key={rule.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
 <div className="flex items-center gap-3">
 <Switch
 checked={rule.enabled}
 onCheckedChange={(checked) => {
 setRules(prev => prev.map(r => 
 r.id === rule.id ? { ...r, enabled: checked } : r
 ));
 }}
 />
 <div>
 <div className="font-medium">{rule.name}</div>
 <div className="text-sm text-muted-foreground">
 <Badge variant={rule.type === 'include' ? 'default' : 'secondary'} className="mr-2">
 {rule.type}
 </Badge>
 {rule.pattern}
 </div>
 </div>
 </div>
 <Button variant="ghost" size="sm">
 <Settings className="h-4 w-4" />
 </Button>
 </div>
 ))}
 
 <Button variant="outline" className="w-full">
 <Plus className="mr-2 h-4 w-4" />
 Add Rule
 </Button>
 </CardContent>
 </Card>

 {/* Help Section */}
 <Alert>
 <Info className="h-4 w-4" />
 <AlertTitle>How Auto-discovery Works</AlertTitle>
 <AlertDescription className="space-y-2 mt-2">
 <p>
 Auto-discovery continuously scans your infrastructure to find and import entities:
 </p>
 <ul className="list-disc list-inside space-y-1 text-sm">
 <li>GitHub: Scans repositories for catalog-info.yaml files</li>
 <li>Kubernetes: Discovers services, deployments, and ingresses</li>
 <li>Cloud Providers: Imports cloud resources as entities</li>
 <li>Databases: Creates entities for database schemas and tables</li>
 </ul>
 <p className="text-sm">
 Discovered entities are automatically kept in sync with their sources.
 </p>
 </AlertDescription>
 </Alert>
 </div>
 );
}