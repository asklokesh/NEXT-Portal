'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
 Github,
 GitBranch,
 Cloud,
 Database,
 Globe,
 Settings,
 Plus,
 Trash2,
 Save,
 CheckCircle,
 AlertCircle,
 Info,
 RefreshCw,
 Play,
 Pause,
 Key,
 Link,
 Timer,
 FileCode,
 Container,
 Server,
 Package,
 Layers,
 Shield,
 Zap,
 Eye,
 EyeOff,
 Copy,
 Check,
 HelpCircle,
 ExternalLink,
 Loader2,
 TestTube,
 Workflow,
 Webhook,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface IntegrationConfigProps {
 className?: string;
 onSave?: (config: IntegrationConfiguration) => void;
}

interface IntegrationConfiguration {
 providers: ProviderConfig[];
 locations: LocationConfig[];
 processors: ProcessorConfig[];
 schedule: ScheduleConfig;
}

interface ProviderConfig {
 id: string;
 type: 'github' | 'gitlab' | 'bitbucket' | 'azure' | 'kubernetes' | 'aws' | 'gcp';
 enabled: boolean;
 name: string;
 config: Record<string, any>;
 status?: 'connected' | 'error' | 'pending';
 lastSync?: string;
}

interface LocationConfig {
 id: string;
 type: 'url' | 'github-discovery' | 'gitlab-discovery' | 'kubernetes-discovery' | 'aws-discovery';
 enabled: boolean;
 target: string;
 providers?: string[];
 filters?: Record<string, any>;
}

interface ProcessorConfig {
 id: string;
 type: string;
 enabled: boolean;
 config: Record<string, any>;
}

interface ScheduleConfig {
 frequency: number;
 timeout: number;
}

const PROVIDER_TYPES = [
 {
 type: 'github',
 name: 'GitHub',
 icon: Github,
 description: 'Connect GitHub repositories and teams',
 fields: [
 { key: 'token', label: 'Personal Access Token', type: 'password', required: true },
 { key: 'host', label: 'GitHub Host', type: 'text', default: 'github.com' },
 { key: 'apiBaseUrl', label: 'API Base URL', type: 'text', default: 'https://api.github.com' },
 { key: 'enterprise', label: 'GitHub Enterprise', type: 'boolean', default: false },
 ],
 },
 {
 type: 'gitlab',
 name: 'GitLab',
 icon: GitBranch,
 description: 'Connect GitLab projects and groups',
 fields: [
 { key: 'token', label: 'Personal Access Token', type: 'password', required: true },
 { key: 'host', label: 'GitLab Host', type: 'text', default: 'gitlab.com' },
 { key: 'apiBaseUrl', label: 'API Base URL', type: 'text', default: 'https://gitlab.com/api/v4' },
 { key: 'enterprise', label: 'Self-hosted GitLab', type: 'boolean', default: false },
 ],
 },
 {
 type: 'kubernetes',
 name: 'Kubernetes',
 icon: Container,
 description: 'Discover services from Kubernetes clusters',
 fields: [
 { key: 'clusters', label: 'Cluster Configurations', type: 'array', 
 itemFields: [
 { key: 'name', label: 'Cluster Name', type: 'text', required: true },
 { key: 'url', label: 'API Server URL', type: 'text', required: true },
 { key: 'authProvider', label: 'Auth Provider', type: 'select', 
 options: ['serviceAccount', 'google', 'azure', 'oidc'], required: true },
 { key: 'skipTLSVerify', label: 'Skip TLS Verify', type: 'boolean', default: false },
 ]
 },
 ],
 },
 {
 type: 'aws',
 name: 'AWS',
 icon: Cloud,
 description: 'Discover AWS resources and services',
 fields: [
 { key: 'accounts', label: 'AWS Accounts', type: 'array',
 itemFields: [
 { key: 'accountId', label: 'Account ID', type: 'text', required: true },
 { key: 'roleArn', label: 'Role ARN', type: 'text', required: true },
 { key: 'region', label: 'Default Region', type: 'text', default: 'us-east-1' },
 { key: 'profile', label: 'Profile Name', type: 'text' },
 ]
 },
 ],
 },
 {
 type: 'gcp',
 name: 'Google Cloud',
 icon: Cloud,
 description: 'Discover GCP resources and services',
 fields: [
 { key: 'projects', label: 'GCP Projects', type: 'array',
 itemFields: [
 { key: 'projectId', label: 'Project ID', type: 'text', required: true },
 { key: 'keyFile', label: 'Service Account Key (JSON)', type: 'textarea', required: true },
 ]
 },
 ],
 },
];

const LOCATION_TYPES = [
 {
 type: 'url',
 name: 'Direct URL',
 description: 'Single catalog-info.yaml file',
 fields: [
 { key: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://github.com/org/repo/blob/main/catalog-info.yaml' },
 ],
 },
 {
 type: 'github-discovery',
 name: 'GitHub Discovery',
 description: 'Auto-discover from GitHub org/user',
 fields: [
 { key: 'organization', label: 'Organization/User', type: 'text', required: true },
 { key: 'catalogPath', label: 'Catalog Path', type: 'text', default: 'catalog-info.yaml' },
 { key: 'branch', label: 'Branch', type: 'text', default: 'main' },
 { key: 'filters', label: 'Repository Filters', type: 'array',
 itemFields: [
 { key: 'include', label: 'Include Pattern', type: 'text', placeholder: '^my-service-.*' },
 { key: 'exclude', label: 'Exclude Pattern', type: 'text', placeholder: '^test-.*' },
 ]
 },
 ],
 },
 {
 type: 'gitlab-discovery',
 name: 'GitLab Discovery',
 description: 'Auto-discover from GitLab group',
 fields: [
 { key: 'group', label: 'Group Path', type: 'text', required: true },
 { key: 'catalogPath', label: 'Catalog Path', type: 'text', default: 'catalog-info.yaml' },
 { key: 'branch', label: 'Branch', type: 'text', default: 'main' },
 ],
 },
 {
 type: 'kubernetes-discovery',
 name: 'Kubernetes Discovery',
 description: 'Auto-discover from K8s annotations',
 fields: [
 { key: 'clusters', label: 'Target Clusters', type: 'multiselect', options: [] },
 { key: 'namespaces', label: 'Namespaces', type: 'array',
 itemFields: [
 { key: 'pattern', label: 'Namespace Pattern', type: 'text', placeholder: 'production-.*' },
 ]
 },
 { key: 'labelSelector', label: 'Label Selector', type: 'text', placeholder: 'backstage.io/catalog=true' },
 ],
 },
 {
 type: 'aws-discovery',
 name: 'AWS Discovery',
 description: 'Auto-discover AWS resources',
 fields: [
 { key: 'accounts', label: 'Target Accounts', type: 'multiselect', options: [] },
 { key: 'regions', label: 'Regions', type: 'multiselect', 
 options: ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1'] 
 },
 { key: 'resourceTypes', label: 'Resource Types', type: 'multiselect',
 options: ['lambda', 'ecs-service', 'rds', 's3', 'eks', 'api-gateway']
 },
 ],
 },
];

export function IntegrationConfig({ className, onSave }: IntegrationConfigProps) {
 const [config, setConfig] = useState<IntegrationConfiguration>({
 providers: [],
 locations: [],
 processors: [],
 schedule: {
 frequency: 30,
 timeout: 60,
 },
 });

 const [activeTab, setActiveTab] = useState('providers');
 const [showAddProvider, setShowAddProvider] = useState(false);
 const [showAddLocation, setShowAddLocation] = useState(false);
 const [testingProvider, setTestingProvider] = useState<string | null>(null);
 const [savingConfig, setSavingConfig] = useState(false);
 const [savedTime, setSavedTime] = useState<Date | null>(null);
 const [errors, setErrors] = useState<Record<string, string>>({});

 // Load existing configuration
 useEffect(() => {
 fetchConfiguration();
 }, []);

 const fetchConfiguration = async () => {
 try {
 const response = await fetch('/api/integrations/config');
 if (response.ok) {
 const data = await response.json();
 setConfig(data);
 }
 } catch (error) {
 console.error('Failed to fetch integration config:', error);
 }
 };

 const addProvider = (type: string) => {
 const providerType = PROVIDER_TYPES.find(p => p.type === type);
 if (!providerType) return;

 const newProvider: ProviderConfig = {
 id: `${type}-${Date.now()}`,
 type: type as any,
 enabled: true,
 name: `${providerType.name} Integration`,
 config: {},
 status: 'pending',
 };

 setConfig(prev => ({
 ...prev,
 providers: [...prev.providers, newProvider],
 }));
 setShowAddProvider(false);
 };

 const updateProvider = (id: string, updates: Partial<ProviderConfig>) => {
 setConfig(prev => ({
 ...prev,
 providers: prev.providers.map(p => 
 p.id === id ? { ...p, ...updates } : p
 ),
 }));
 };

 const removeProvider = (id: string) => {
 setConfig(prev => ({
 ...prev,
 providers: prev.providers.filter(p => p.id !== id),
 }));
 };

 const testProvider = async (id: string) => {
 setTestingProvider(id);
 
 try {
 const provider = config.providers.find(p => p.id === id);
 if (!provider) return;

 const response = await fetch('/api/integrations/test', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ provider }),
 });

 const result = await response.json();
 
 updateProvider(id, {
 status: result.success ? 'connected' : 'error',
 lastSync: new Date().toISOString(),
 });

 if (!result.success) {
 setErrors({ [id]: result.error });
 } else {
 setErrors(prev => {
 const next = { ...prev };
 delete next[id];
 return next;
 });
 }
 } catch (error) {
 updateProvider(id, { status: 'error' });
 setErrors({ [id]: 'Connection test failed' });
 } finally {
 setTestingProvider(null);
 }
 };

 const addLocation = (type: string) => {
 const locationType = LOCATION_TYPES.find(l => l.type === type);
 if (!locationType) return;

 const newLocation: LocationConfig = {
 id: `${type}-${Date.now()}`,
 type: type as any,
 enabled: true,
 target: '',
 filters: {},
 };

 setConfig(prev => ({
 ...prev,
 locations: [...prev.locations, newLocation],
 }));
 setShowAddLocation(false);
 };

 const updateLocation = (id: string, updates: Partial<LocationConfig>) => {
 setConfig(prev => ({
 ...prev,
 locations: prev.locations.map(l => 
 l.id === id ? { ...l, ...updates } : l
 ),
 }));
 };

 const removeLocation = (id: string) => {
 setConfig(prev => ({
 ...prev,
 locations: prev.locations.filter(l => l.id !== id),
 }));
 };

 const saveConfiguration = async () => {
 setSavingConfig(true);
 
 try {
 const response = await fetch('/api/integrations/config', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(config),
 });

 if (response.ok) {
 setSavedTime(new Date());
 if (onSave) {
 onSave(config);
 }
 
 // Generate and download app-config.yaml
 const yamlResponse = await fetch('/api/integrations/generate-yaml', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(config),
 });
 
 if (yamlResponse.ok) {
 const yamlContent = await yamlResponse.text();
 // Show YAML preview or offer download
 console.log('Generated app-config.yaml:', yamlContent);
 }
 }
 } catch (error) {
 console.error('Failed to save configuration:', error);
 setErrors({ save: 'Failed to save configuration' });
 } finally {
 setSavingConfig(false);
 }
 };

 const renderProviderForm = (provider: ProviderConfig) => {
 const providerType = PROVIDER_TYPES.find(p => p.type === provider.type);
 if (!providerType) return null;

 return (
 <div className="space-y-4">
 {providerType.fields.map((field) => {
 if (field.type === 'array') {
 const items = provider.config[field.key] || [];
 return (
 <div key={field.key} className="space-y-3">
 <Label>{field.label}</Label>
 {items.map((item: any, index: number) => (
 <Card key={index} className="p-4">
 <div className="space-y-3">
 {field.itemFields?.map((itemField) => (
 <div key={itemField.key}>
 <Label className="text-sm">{itemField.label}</Label>
 {itemField.type === 'text' && (
 <Input
 value={item[itemField.key] || ''}
 onChange={(e) => {
 const newItems = [...items];
 newItems[index] = { ...item, [itemField.key]: e.target.value };
 updateProvider(provider.id, {
 config: { ...provider.config, [field.key]: newItems }
 });
 }}
 placeholder={itemField.placeholder}
 />
 )}
 {itemField.type === 'boolean' && (
 <Switch
 checked={item[itemField.key] || false}
 onCheckedChange={(checked) => {
 const newItems = [...items];
 newItems[index] = { ...item, [itemField.key]: checked };
 updateProvider(provider.id, {
 config: { ...provider.config, [field.key]: newItems }
 });
 }}
 />
 )}
 {itemField.type === 'select' && (
 <Select
 value={item[itemField.key] || ''}
 onValueChange={(value) => {
 const newItems = [...items];
 newItems[index] = { ...item, [itemField.key]: value };
 updateProvider(provider.id, {
 config: { ...provider.config, [field.key]: newItems }
 });
 }}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {itemField.options?.map((option) => (
 <SelectItem key={option} value={option}>
 {option}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 )}
 </div>
 ))}
 <Button
 variant="ghost"
 size="sm"
 onClick={() => {
 const newItems = items.filter((_: any, i: number) => i !== index);
 updateProvider(provider.id, {
 config: { ...provider.config, [field.key]: newItems }
 });
 }}
 >
 <Trash2 className="h-4 w-4 mr-2" />
 Remove
 </Button>
 </div>
 </Card>
 ))}
 <Button
 variant="outline"
 size="sm"
 onClick={() => {
 const newItems = [...items, {}];
 updateProvider(provider.id, {
 config: { ...provider.config, [field.key]: newItems }
 });
 }}
 >
 <Plus className="h-4 w-4 mr-2" />
 Add {field.label}
 </Button>
 </div>
 );
 }

 return (
 <div key={field.key}>
 <Label>{field.label}</Label>
 {field.type === 'text' && (
 <Input
 value={provider.config[field.key] || field.default || ''}
 onChange={(e) => updateProvider(provider.id, {
 config: { ...provider.config, [field.key]: e.target.value }
 })}
 placeholder={field.placeholder}
 />
 )}
 {field.type === 'password' && (
 <div className="relative">
 <Input
 type="password"
 value={provider.config[field.key] || ''}
 onChange={(e) => updateProvider(provider.id, {
 config: { ...provider.config, [field.key]: e.target.value }
 })}
 placeholder="Enter token..."
 />
 </div>
 )}
 {field.type === 'textarea' && (
 <Textarea
 value={provider.config[field.key] || ''}
 onChange={(e) => updateProvider(provider.id, {
 config: { ...provider.config, [field.key]: e.target.value }
 })}
 placeholder={field.placeholder}
 rows={4}
 />
 )}
 {field.type === 'boolean' && (
 <Switch
 checked={provider.config[field.key] || field.default || false}
 onCheckedChange={(checked) => updateProvider(provider.id, {
 config: { ...provider.config, [field.key]: checked }
 })}
 />
 )}
 </div>
 );
 })}
 </div>
 );
 };

 const renderLocationForm = (location: LocationConfig) => {
 const locationType = LOCATION_TYPES.find(l => l.type === location.type);
 if (!locationType) return null;

 return (
 <div className="space-y-4">
 {locationType.fields.map((field) => {
 if (field.type === 'multiselect') {
 // For provider/cluster selection, use available providers
 const options = field.key === 'clusters' 
 ? config.providers.filter(p => p.type === 'kubernetes').map(p => ({ value: p.id, label: p.name }))
 : field.key === 'accounts'
 ? config.providers.filter(p => p.type === 'aws').map(p => ({ value: p.id, label: p.name }))
 : field.options?.map(o => ({ value: o, label: o })) || [];

 return (
 <div key={field.key}>
 <Label>{field.label}</Label>
 <div className="flex flex-wrap gap-2">
 {options.map((option) => {
 const isSelected = (location.filters?.[field.key] || []).includes(option.value);
 return (
 <Badge
 key={option.value}
 variant={isSelected ? "default" : "outline"}
 className="cursor-pointer"
 onClick={() => {
 const current = location.filters?.[field.key] || [];
 const updated = isSelected
 ? current.filter((v: string) => v !== option.value)
 : [...current, option.value];
 updateLocation(location.id, {
 filters: { ...location.filters, [field.key]: updated }
 });
 }}
 >
 {option.label}
 </Badge>
 );
 })}
 </div>
 </div>
 );
 }

 if (field.type === 'array') {
 const items = location.filters?.[field.key] || [];
 return (
 <div key={field.key} className="space-y-2">
 <Label>{field.label}</Label>
 {items.map((item: any, index: number) => (
 <div key={index} className="flex gap-2">
 {field.itemFields?.map((itemField) => (
 <Input
 key={itemField.key}
 value={item[itemField.key] || ''}
 onChange={(e) => {
 const newItems = [...items];
 newItems[index] = { ...item, [itemField.key]: e.target.value };
 updateLocation(location.id, {
 filters: { ...location.filters, [field.key]: newItems }
 });
 }}
 placeholder={itemField.placeholder}
 className="flex-1"
 />
 ))}
 <Button
 variant="ghost"
 size="icon"
 onClick={() => {
 const newItems = items.filter((_: any, i: number) => i !== index);
 updateLocation(location.id, {
 filters: { ...location.filters, [field.key]: newItems }
 });
 }}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 ))}
 <Button
 variant="outline"
 size="sm"
 onClick={() => {
 const newItems = [...items, {}];
 updateLocation(location.id, {
 filters: { ...location.filters, [field.key]: newItems }
 });
 }}
 >
 <Plus className="h-4 w-4 mr-2" />
 Add Filter
 </Button>
 </div>
 );
 }

 return (
 <div key={field.key}>
 <Label>{field.label}</Label>
 <Input
 value={
 field.key === 'url' || field.key === 'organization' || field.key === 'group' 
 ? location.target 
 : location.filters?.[field.key] || field.default || ''
 }
 onChange={(e) => {
 if (field.key === 'url' || field.key === 'organization' || field.key === 'group') {
 updateLocation(location.id, { target: e.target.value });
 } else {
 updateLocation(location.id, {
 filters: { ...location.filters, [field.key]: e.target.value }
 });
 }
 }}
 placeholder={field.placeholder}
 />
 </div>
 );
 })}
 </div>
 );
 };

 return (
 <div className={cn("space-y-6", className)}>
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-2xl font-bold">Integration Configuration</h2>
 <p className="text-muted-foreground">
 Configure catalog integrations without editing YAML files
 </p>
 </div>
 <div className="flex items-center gap-2">
 {savedTime && (
 <div className="text-sm text-muted-foreground flex items-center gap-1">
 <CheckCircle className="h-4 w-4 text-green-600" />
 Saved {savedTime.toLocaleTimeString()}
 </div>
 )}
 <Button onClick={saveConfiguration} disabled={savingConfig}>
 {savingConfig ? (
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 ) : (
 <Save className="h-4 w-4 mr-2" />
 )}
 Save Configuration
 </Button>
 </div>
 </div>

 {/* Main Content */}
 <Tabs value={activeTab} onValueChange={setActiveTab}>
 <TabsList>
 <TabsTrigger value="providers">
 <Key className="h-4 w-4 mr-2" />
 Providers
 </TabsTrigger>
 <TabsTrigger value="locations">
 <Globe className="h-4 w-4 mr-2" />
 Locations
 </TabsTrigger>
 <TabsTrigger value="schedule">
 <Timer className="h-4 w-4 mr-2" />
 Schedule
 </TabsTrigger>
 <TabsTrigger value="processors">
 <Workflow className="h-4 w-4 mr-2" />
 Processors
 </TabsTrigger>
 </TabsList>

 {/* Providers Tab */}
 <TabsContent value="providers" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Integration Providers</CardTitle>
 <CardDescription>
 Configure authentication and connection settings for various platforms
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {config.providers.map((provider) => {
 const providerType = PROVIDER_TYPES.find(p => p.type === provider.type);
 const Icon = providerType?.icon || Settings;
 
 return (
 <Card key={provider.id}>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Icon className="h-5 w-5" />
 <div>
 <CardTitle className="text-base">{provider.name}</CardTitle>
 <CardDescription>{providerType?.description}</CardDescription>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <Badge variant={
 provider.status === 'connected' ? 'default' :
 provider.status === 'error' ? 'destructive' : 'secondary'
 }>
 {provider.status || 'pending'}
 </Badge>
 <Switch
 checked={provider.enabled}
 onCheckedChange={(enabled) => updateProvider(provider.id, { enabled })}
 />
 <Button
 variant="ghost"
 size="icon"
 onClick={() => removeProvider(provider.id)}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 {renderProviderForm(provider)}
 {errors[provider.id] && (
 <Alert variant="destructive" className="mt-4">
 <AlertCircle className="h-4 w-4" />
 <AlertDescription>{errors[provider.id]}</AlertDescription>
 </Alert>
 )}
 <div className="mt-4 flex justify-end">
 <Button
 variant="outline"
 size="sm"
 onClick={() => testProvider(provider.id)}
 disabled={testingProvider === provider.id}
 >
 {testingProvider === provider.id ? (
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 ) : (
 <TestTube className="h-4 w-4 mr-2" />
 )}
 Test Connection
 </Button>
 </div>
 </CardContent>
 </Card>
 );
 })}

 {showAddProvider ? (
 <Card>
 <CardHeader>
 <CardTitle>Add Provider</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
 {PROVIDER_TYPES.map((type) => {
 const Icon = type.icon;
 return (
 <Button
 key={type.type}
 variant="outline"
 className="h-auto p-4 flex flex-col items-center gap-2"
 onClick={() => addProvider(type.type)}
 >
 <Icon className="h-8 w-8" />
 <span>{type.name}</span>
 </Button>
 );
 })}
 </div>
 <div className="mt-4 flex justify-end">
 <Button
 variant="ghost"
 onClick={() => setShowAddProvider(false)}
 >
 Cancel
 </Button>
 </div>
 </CardContent>
 </Card>
 ) : (
 <Button onClick={() => setShowAddProvider(true)}>
 <Plus className="h-4 w-4 mr-2" />
 Add Provider
 </Button>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 {/* Locations Tab */}
 <TabsContent value="locations" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Catalog Locations</CardTitle>
 <CardDescription>
 Define where to discover and import catalog entities from
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 {config.locations.map((location) => {
 const locationType = LOCATION_TYPES.find(l => l.type === location.type);
 
 return (
 <Card key={location.id}>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle className="text-base">{locationType?.name}</CardTitle>
 <CardDescription>{locationType?.description}</CardDescription>
 </div>
 <div className="flex items-center gap-2">
 <Switch
 checked={location.enabled}
 onCheckedChange={(enabled) => updateLocation(location.id, { enabled })}
 />
 <Button
 variant="ghost"
 size="icon"
 onClick={() => removeLocation(location.id)}
 >
 <Trash2 className="h-4 w-4" />
 </Button>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 {renderLocationForm(location)}
 </CardContent>
 </Card>
 );
 })}

 {showAddLocation ? (
 <Card>
 <CardHeader>
 <CardTitle>Add Location</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="space-y-2">
 {LOCATION_TYPES.map((type) => (
 <Button
 key={type.type}
 variant="outline"
 className="w-full justify-start"
 onClick={() => addLocation(type.type)}
 >
 <div className="flex flex-col items-start">
 <span className="font-medium">{type.name}</span>
 <span className="text-sm text-muted-foreground">{type.description}</span>
 </div>
 </Button>
 ))}
 </div>
 <div className="mt-4 flex justify-end">
 <Button
 variant="ghost"
 onClick={() => setShowAddLocation(false)}
 >
 Cancel
 </Button>
 </div>
 </CardContent>
 </Card>
 ) : (
 <Button onClick={() => setShowAddLocation(true)}>
 <Plus className="h-4 w-4 mr-2" />
 Add Location
 </Button>
 )}
 </CardContent>
 </Card>
 </TabsContent>

 {/* Schedule Tab */}
 <TabsContent value="schedule" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Processing Schedule</CardTitle>
 <CardDescription>
 Configure how often the catalog should be refreshed
 </CardDescription>
 </CardHeader>
 <CardContent className="space-y-4">
 <div>
 <Label>Refresh Frequency (minutes)</Label>
 <Input
 type="number"
 value={config.schedule.frequency}
 onChange={(e) => setConfig(prev => ({
 ...prev,
 schedule: { ...prev.schedule, frequency: parseInt(e.target.value) || 30 }
 }))}
 min={1}
 max={1440}
 />
 <p className="text-sm text-muted-foreground mt-1">
 How often to check for updates (1-1440 minutes)
 </p>
 </div>

 <div>
 <Label>Processing Timeout (seconds)</Label>
 <Input
 type="number"
 value={config.schedule.timeout}
 onChange={(e) => setConfig(prev => ({
 ...prev,
 schedule: { ...prev.schedule, timeout: parseInt(e.target.value) || 60 }
 }))}
 min={10}
 max={600}
 />
 <p className="text-sm text-muted-foreground mt-1">
 Maximum time to wait for processing (10-600 seconds)
 </p>
 </div>

 <Alert>
 <Info className="h-4 w-4" />
 <AlertDescription>
 Frequent updates may impact performance. For large catalogs, consider using webhooks for real-time updates instead.
 </AlertDescription>
 </Alert>
 </CardContent>
 </Card>
 </TabsContent>

 {/* Processors Tab */}
 <TabsContent value="processors" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Entity Processors</CardTitle>
 <CardDescription>
 Configure how entities are processed and enriched
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 <Alert>
 <Info className="h-4 w-4" />
 <AlertDescription>
 Entity processors automatically enrich catalog data. Most processors work out of the box with sensible defaults.
 </AlertDescription>
 </Alert>

 <div className="space-y-2">
 {[
 { name: 'GitHub Metadata', description: 'Enriches entities with GitHub repository information' },
 { name: 'Kubernetes Annotations', description: 'Processes Kubernetes resource annotations' },
 { name: 'Tech Docs', description: 'Generates documentation references' },
 { name: 'Ownership', description: 'Resolves team ownership from various sources' },
 ].map((processor) => (
 <div key={processor.name} className="flex items-center justify-between p-3 border rounded-lg">
 <div>
 <p className="font-medium">{processor.name}</p>
 <p className="text-sm text-muted-foreground">{processor.description}</p>
 </div>
 <Switch defaultChecked />
 </div>
 ))}
 </div>
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
 </div>
 );
}