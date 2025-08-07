'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { 
 Package, 
 Download, 
 Settings, 
 CheckCircle, 
 XCircle,
 AlertCircle,
 Search,
 Filter,
 Plus,
 Loader2,
 ExternalLink,
 Star,
 GitBranch,
 Shield,
 Zap,
 Upload,
 Code,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface BackstagePlugin {
 id: string;
 name: string;
 description: string;
 version: string;
 author: string;
 category: string;
 tags: string[];
 downloads: number;
 rating: number;
 homepage?: string;
 repository?: string;
 documentation?: string;
 dependencies?: string[];
 peerDependencies?: Record<string, string>;
 backstageVersion?: string;
 installed: boolean;
 enabled: boolean;
 official: boolean;
 verified: boolean;
 configuration?: PluginConfiguration;
}

interface PluginConfiguration {
 backend?: boolean;
 frontend?: boolean;
 requiresAuth?: boolean;
 requiresDatabase?: boolean;
 environmentVariables?: EnvironmentVariable[];
 configSchema?: any;
 routes?: PluginRoute[];
 permissions?: string[];
}

interface EnvironmentVariable {
 name: string;
 description: string;
 required: boolean;
 default?: string;
 type: 'string' | 'number' | 'boolean' | 'secret';
}

interface PluginRoute {
 path: string;
 component: string;
 exact?: boolean;
 permissions?: string[];
}

interface InstallationStep {
 id: string;
 name: string;
 status: 'pending' | 'running' | 'completed' | 'failed';
 message?: string;
}

// Mock plugin data
const AVAILABLE_PLUGINS: BackstagePlugin[] = [
 {
 id: '@backstage/plugin-kubernetes',
 name: 'Kubernetes',
 description: 'View and manage Kubernetes resources for your services',
 version: '0.11.0',
 author: 'Backstage Team',
 category: 'Infrastructure',
 tags: ['kubernetes', 'k8s', 'containers', 'orchestration'],
 downloads: 45678,
 rating: 4.8,
 homepage: 'https://backstage.io/docs/features/kubernetes',
 repository: 'https://github.com/backstage/backstage',
 official: true,
 verified: true,
 installed: false,
 enabled: false,
 configuration: {
 backend: true,
 frontend: true,
 requiresAuth: true,
 environmentVariables: [
 {
 name: 'K8S_URL',
 description: 'Kubernetes API server URL',
 required: true,
 type: 'string',
 },
 {
 name: 'K8S_SA_TOKEN',
 description: 'Service account token for authentication',
 required: true,
 type: 'secret',
 },
 ],
 },
 },
 {
 id: '@backstage/plugin-github-actions',
 name: 'GitHub Actions',
 description: 'View and trigger GitHub Actions workflows',
 version: '0.6.0',
 author: 'Backstage Team',
 category: 'CI/CD',
 tags: ['github', 'ci', 'cd', 'actions', 'workflows'],
 downloads: 34567,
 rating: 4.7,
 official: true,
 verified: true,
 installed: true,
 enabled: true,
 configuration: {
 frontend: true,
 requiresAuth: true,
 },
 },
 {
 id: '@backstage/plugin-sonarqube',
 name: 'SonarQube',
 description: 'Display code quality metrics from SonarQube',
 version: '0.7.0',
 author: 'Backstage Team',
 category: 'Code Quality',
 tags: ['sonarqube', 'code-quality', 'static-analysis'],
 downloads: 23456,
 rating: 4.5,
 official: true,
 verified: true,
 installed: false,
 enabled: false,
 configuration: {
 backend: true,
 frontend: true,
 environmentVariables: [
 {
 name: 'SONARQUBE_URL',
 description: 'SonarQube server URL',
 required: true,
 type: 'string',
 },
 {
 name: 'SONARQUBE_TOKEN',
 description: 'Authentication token',
 required: true,
 type: 'secret',
 },
 ],
 },
 },
 {
 id: '@roadiehq/backstage-plugin-datadog',
 name: 'Datadog',
 description: 'Monitor your services with Datadog metrics and dashboards',
 version: '2.1.0',
 author: 'Roadie',
 category: 'Monitoring',
 tags: ['datadog', 'monitoring', 'observability', 'metrics'],
 downloads: 12345,
 rating: 4.6,
 homepage: 'https://roadie.io/backstage/plugins/datadog',
 verified: true,
 installed: false,
 enabled: false,
 official: false,
 configuration: {
 frontend: true,
 environmentVariables: [
 {
 name: 'DATADOG_API_KEY',
 description: 'Datadog API key',
 required: true,
 type: 'secret',
 },
 {
 name: 'DATADOG_APP_KEY',
 description: 'Datadog application key',
 required: true,
 type: 'secret',
 },
 {
 name: 'DATADOG_SITE',
 description: 'Datadog site (e.g., datadoghq.com)',
 required: false,
 default: 'datadoghq.com',
 type: 'string',
 },
 ],
 },
 },
];

const PLUGIN_CATEGORIES = [
 'All',
 'Infrastructure',
 'CI/CD',
 'Monitoring',
 'Code Quality',
 'Security',
 'Documentation',
 'Communication',
 'Analytics',
];

export default function PluginInstallerPage() {
 const [plugins, setPlugins] = useState<BackstagePlugin[]>(AVAILABLE_PLUGINS);
 const [selectedPlugin, setSelectedPlugin] = useState<BackstagePlugin | null>(null);
 const [searchQuery, setSearchQuery] = useState('');
 const [selectedCategory, setSelectedCategory] = useState('All');
 const [showOnlyInstalled, setShowOnlyInstalled] = useState(false);
 const [showInstallDialog, setShowInstallDialog] = useState(false);
 const [installationSteps, setInstallationSteps] = useState<InstallationStep[]>([]);
 const [isInstalling, setIsInstalling] = useState(false);
 const [configValues, setConfigValues] = useState<Record<string, any>>({});
 const [uploadedPlugin, setUploadedPlugin] = useState<File | null>(null);

 const filteredPlugins = plugins.filter(plugin => {
 const matchesSearch = searchQuery === '' || 
 plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 plugin.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
 plugin.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
 
 const matchesCategory = selectedCategory === 'All' || plugin.category === selectedCategory;
 const matchesInstalled = !showOnlyInstalled || plugin.installed;
 
 return matchesSearch && matchesCategory && matchesInstalled;
 });

 const handleInstallPlugin = async (plugin: BackstagePlugin) => {
 setSelectedPlugin(plugin);
 setShowInstallDialog(true);
 
 // Initialize configuration values
 const initialConfig: Record<string, any> = {};
 plugin.configuration?.environmentVariables?.forEach(env => {
 initialConfig[env.name] = env.default || '';
 });
 setConfigValues(initialConfig);
 };

 const performInstallation = async () => {
 if (!selectedPlugin) return;
 
 setIsInstalling(true);
 
 const steps: InstallationStep[] = [
 { id: 'validate', name: 'Validating plugin compatibility', status: 'pending' },
 { id: 'download', name: 'Downloading plugin package', status: 'pending' },
 { id: 'dependencies', name: 'Installing dependencies', status: 'pending' },
 { id: 'configure', name: 'Applying configuration', status: 'pending' },
 { id: 'integrate', name: 'Integrating with Backstage', status: 'pending' },
 { id: 'restart', name: 'Restarting services', status: 'pending' },
 ];
 
 setInstallationSteps(steps);
 
 // Simulate installation process
 for (let i = 0; i < steps.length; i++) {
 setInstallationSteps(prev => prev.map((step, index) => 
 index === i ? { ...step, status: 'running' } : step
 ));
 
 await new Promise(resolve => setTimeout(resolve, 1500));
 
 // Simulate occasional failures
 if (Math.random() > 0.9 && i === 2) {
 setInstallationSteps(prev => prev.map((step, index) => 
 index === i ? { 
 ...step, 
 status: 'failed',
 message: 'Failed to install peer dependency @backstage/core-components'
 } : step
 ));
 break;
 }
 
 setInstallationSteps(prev => prev.map((step, index) => 
 index === i ? { ...step, status: 'completed' } : step
 ));
 }
 
 // Update plugin status
 const allCompleted = installationSteps.every(step => step.status === 'completed');
 if (allCompleted) {
 setPlugins(prev => prev.map(p => 
 p.id === selectedPlugin.id ? { ...p, installed: true } : p
 ));
 toast.success(`${selectedPlugin.name} installed successfully!`);
 }
 
 setIsInstalling(false);
 };

 const handleUninstallPlugin = async (plugin: BackstagePlugin) => {
 toast.success(`${plugin.name} uninstalled successfully`);
 setPlugins(prev => prev.map(p => 
 p.id === plugin.id ? { ...p, installed: false, enabled: false } : p
 ));
 };

 const handleTogglePlugin = async (plugin: BackstagePlugin) => {
 const newEnabled = !plugin.enabled;
 setPlugins(prev => prev.map(p => 
 p.id === plugin.id ? { ...p, enabled: newEnabled } : p
 ));
 toast.success(`${plugin.name} ${newEnabled ? 'enabled' : 'disabled'} successfully`);
 };

 const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0];
 if (file) {
 setUploadedPlugin(file);
 toast.success('Plugin package uploaded successfully');
 }
 };

 const calculateProgress = () => {
 const completed = installationSteps.filter(step => step.status === 'completed').length;
 return (completed / installationSteps.length) * 100;
 };

 return (
 <div className="space-y-6">
 <div>
 <h1 className="text-3xl font-bold">Plugin Manager</h1>
 <p className="text-gray-600 mt-2">
 Install and manage Backstage plugins without writing code
 </p>
 </div>

 <Alert>
 <Zap className="h-4 w-4" />
 <AlertTitle>No-Code Plugin Installation</AlertTitle>
 <AlertDescription>
 Simply search, configure, and install Backstage plugins with a click. 
 All configuration is handled through the UI - no manual file editing required.
 </AlertDescription>
 </Alert>

 <Tabs defaultValue="marketplace" className="space-y-4">
 <TabsList>
 <TabsTrigger value="marketplace">Plugin Marketplace</TabsTrigger>
 <TabsTrigger value="installed">Installed Plugins</TabsTrigger>
 <TabsTrigger value="upload">Upload Plugin</TabsTrigger>
 <TabsTrigger value="create">Create Plugin</TabsTrigger>
 </TabsList>

 <TabsContent value="marketplace" className="space-y-4">
 {/* Search and Filters */}
 <div className="flex gap-4">
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
 <Input
 placeholder="Search plugins..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-10"
 />
 </div>
 <Select value={selectedCategory} onValueChange={setSelectedCategory}>
 <SelectTrigger className="w-[200px]">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {PLUGIN_CATEGORIES.map(category => (
 <SelectItem key={category} value={category}>
 {category}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <div className="flex items-center gap-2">
 <Switch
 id="installed-only"
 checked={showOnlyInstalled}
 onCheckedChange={setShowOnlyInstalled}
 />
 <Label htmlFor="installed-only">Installed only</Label>
 </div>
 </div>

 {/* Plugin Grid */}
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {filteredPlugins.map(plugin => (
 <Card key={plugin.id} className="hover:shadow-lg transition-shadow">
 <CardHeader>
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <CardTitle className="text-lg flex items-center gap-2">
 {plugin.name}
 {plugin.official && (
 <Badge variant="secondary" className="text-xs">
 <Shield className="h-3 w-3 mr-1" />
 Official
 </Badge>
 )}
 {plugin.verified && !plugin.official && (
 <Badge variant="secondary" className="text-xs">
 <CheckCircle className="h-3 w-3 mr-1" />
 Verified
 </Badge>
 )}
 </CardTitle>
 <CardDescription className="mt-1">
 {plugin.description}
 </CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex items-center justify-between text-sm">
 <span className="text-gray-600">Version</span>
 <span className="font-medium">{plugin.version}</span>
 </div>
 <div className="flex items-center justify-between text-sm">
 <span className="text-gray-600">Downloads</span>
 <span className="font-medium">{plugin.downloads.toLocaleString()}</span>
 </div>
 <div className="flex items-center justify-between text-sm">
 <span className="text-gray-600">Rating</span>
 <div className="flex items-center gap-1">
 <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
 <span className="font-medium">{plugin.rating}</span>
 </div>
 </div>
 <div className="flex flex-wrap gap-1">
 {plugin.tags.slice(0, 3).map(tag => (
 <Badge key={tag} variant="outline" className="text-xs">
 {tag}
 </Badge>
 ))}
 </div>
 <div className="flex gap-2">
 {plugin.installed ? (
 <>
 <Button
 size="sm"
 variant={plugin.enabled ? 'secondary' : 'outline'}
 className="flex-1"
 onClick={() => handleTogglePlugin(plugin)}
 >
 {plugin.enabled ? 'Disable' : 'Enable'}
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleUninstallPlugin(plugin)}
 >
 Uninstall
 </Button>
 </>
 ) : (
 <Button
 size="sm"
 className="w-full"
 onClick={() => handleInstallPlugin(plugin)}
 >
 <Download className="h-4 w-4 mr-2" />
 Install
 </Button>
 )}
 </div>
 {plugin.homepage && (
 <div className="flex gap-2 pt-2">
 <a
 href={plugin.homepage}
 target="_blank"
 rel="noopener noreferrer"
 className="text-sm text-blue-600 hover:underline flex items-center gap-1"
 >
 <ExternalLink className="h-3 w-3" />
 Documentation
 </a>
 {plugin.repository && (
 <a
 href={plugin.repository}
 target="_blank"
 rel="noopener noreferrer"
 className="text-sm text-blue-600 hover:underline flex items-center gap-1"
 >
 <GitBranch className="h-3 w-3" />
 Source
 </a>
 )}
 </div>
 )}
 </CardContent>
 </Card>
 ))}
 </div>
 </TabsContent>

 <TabsContent value="installed" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Installed Plugins</CardTitle>
 <CardDescription>
 Manage your installed Backstage plugins
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 {plugins.filter(p => p.installed).map(plugin => (
 <div
 key={plugin.id}
 className="flex items-center justify-between p-4 border rounded-lg"
 >
 <div className="flex-1">
 <div className="flex items-center gap-3">
 <h3 className="font-semibold">{plugin.name}</h3>
 <Badge>{plugin.version}</Badge>
 {plugin.enabled ? (
 <Badge variant="success">Enabled</Badge>
 ) : (
 <Badge variant="secondary">Disabled</Badge>
 )}
 </div>
 <p className="text-sm text-gray-600 mt-1">{plugin.description}</p>
 </div>
 <div className="flex items-center gap-2">
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleTogglePlugin(plugin)}
 >
 {plugin.enabled ? 'Disable' : 'Enable'}
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => setSelectedPlugin(plugin)}
 >
 <Settings className="h-4 w-4" />
 </Button>
 <Button
 size="sm"
 variant="destructive"
 onClick={() => handleUninstallPlugin(plugin)}
 >
 Uninstall
 </Button>
 </div>
 </div>
 ))}
 {plugins.filter(p => p.installed).length === 0 && (
 <div className="text-center py-8 text-gray-500">
 No plugins installed yet
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="upload" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Upload Custom Plugin</CardTitle>
 <CardDescription>
 Install a Backstage plugin from a package file
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-4">
 <Alert>
 <AlertCircle className="h-4 w-4" />
 <AlertDescription>
 Upload a plugin package (.tgz or .tar.gz) that was built for Backstage.
 The plugin will be validated for compatibility before installation.
 </AlertDescription>
 </Alert>

 <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
 <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
 <Label htmlFor="plugin-upload" className="cursor-pointer">
 <span className="text-blue-600 hover:underline">Choose a file</span>
 {' '}or drag and drop
 </Label>
 <Input
 id="plugin-upload"
 type="file"
 accept=".tgz,.tar.gz"
 className="hidden"
 onChange={handleFileUpload}
 />
 <p className="text-sm text-gray-500 mt-2">
 Supported formats: .tgz, .tar.gz
 </p>
 </div>

 {uploadedPlugin && (
 <div className="bg-gray-50 p-4 rounded-lg">
 <div className="flex items-center justify-between">
 <div>
 <p className="font-medium">{uploadedPlugin.name}</p>
 <p className="text-sm text-gray-600">
 {(uploadedPlugin.size / 1024 / 1024).toFixed(2)} MB
 </p>
 </div>
 <Button>
 <Package className="h-4 w-4 mr-2" />
 Install Plugin
 </Button>
 </div>
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="create" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>Create Custom Plugin</CardTitle>
 <CardDescription>
 Generate a new Backstage plugin using templates
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-6">
 <div>
 <Label htmlFor="plugin-name">Plugin Name</Label>
 <Input
 id="plugin-name"
 placeholder="my-awesome-plugin"
 className="mt-1"
 />
 </div>

 <div>
 <Label htmlFor="plugin-description">Description</Label>
 <Textarea
 id="plugin-description"
 placeholder="Describe what your plugin does..."
 className="mt-1"
 />
 </div>

 <div>
 <Label>Plugin Type</Label>
 <div className="grid grid-cols-2 gap-4 mt-2">
 <Card className="cursor-pointer hover:border-blue-500">
 <CardContent className="p-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-blue-100 rounded-lg">
 <Code className="h-5 w-5 text-blue-600" />
 </div>
 <div>
 <p className="font-medium">Frontend Plugin</p>
 <p className="text-sm text-gray-600">UI components and pages</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="cursor-pointer hover:border-blue-500">
 <CardContent className="p-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-green-100 rounded-lg">
 <Package className="h-5 w-5 text-green-600" />
 </div>
 <div>
 <p className="font-medium">Full-Stack Plugin</p>
 <p className="text-sm text-gray-600">Frontend + Backend</p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 </div>

 <Button className="w-full">
 <Plus className="h-4 w-4 mr-2" />
 Create Plugin from Template
 </Button>
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>

 {/* Installation Dialog */}
 <Dialog open={showInstallDialog} onOpenChange={setShowInstallDialog}>
 <DialogContent className="max-w-2xl">
 <DialogHeader>
 <DialogTitle>Install {selectedPlugin?.name}</DialogTitle>
 <DialogDescription>
 Configure the plugin settings before installation
 </DialogDescription>
 </DialogHeader>

 {!isInstalling ? (
 <div className="space-y-4">
 {/* Configuration Form */}
 {selectedPlugin?.configuration?.environmentVariables && (
 <div className="space-y-4">
 <h3 className="font-semibold">Configuration</h3>
 {selectedPlugin.configuration.environmentVariables.map(env => (
 <div key={env.name}>
 <Label htmlFor={env.name}>
 {env.description}
 {env.required && <span className="text-red-500 ml-1">*</span>}
 </Label>
 <Input
 id={env.name}
 type={env.type === 'secret' ? 'password' : 'text'}
 placeholder={env.default || `Enter ${env.name}`}
 value={configValues[env.name] || ''}
 onChange={(e) => setConfigValues(prev => ({
 ...prev,
 [env.name]: e.target.value
 }))}
 className="mt-1"
 />
 </div>
 ))}
 </div>
 )}

 {/* Dependencies */}
 {selectedPlugin?.dependencies && selectedPlugin.dependencies.length > 0 && (
 <div>
 <h3 className="font-semibold mb-2">Dependencies</h3>
 <div className="bg-gray-50 p-3 rounded-lg">
 <p className="text-sm text-gray-600">
 This plugin requires the following dependencies:
 </p>
 <ul className="list-disc list-inside text-sm mt-2">
 {selectedPlugin.dependencies.map(dep => (
 <li key={dep}>{dep}</li>
 ))}
 </ul>
 </div>
 </div>
 )}
 </div>
 ) : (
 <div className="space-y-4">
 {/* Installation Progress */}
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium">Installation Progress</span>
 <span className="text-sm text-gray-600">
 {Math.round(calculateProgress())}%
 </span>
 </div>
 <Progress value={calculateProgress()} />
 </div>

 {/* Installation Steps */}
 <div className="space-y-2">
 {installationSteps.map(step => (
 <div key={step.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
 {step.status === 'completed' && (
 <CheckCircle className="h-5 w-5 text-green-600" />
 )}
 {step.status === 'running' && (
 <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
 )}
 {step.status === 'failed' && (
 <XCircle className="h-5 w-5 text-red-600" />
 )}
 {step.status === 'pending' && (
 <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
 )}
 <div className="flex-1">
 <p className="text-sm font-medium">{step.name}</p>
 {step.message && (
 <p className="text-xs text-red-600 mt-1">{step.message}</p>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 <DialogFooter>
 {!isInstalling ? (
 <>
 <Button variant="outline" onClick={() => setShowInstallDialog(false)}>
 Cancel
 </Button>
 <Button onClick={performInstallation}>
 Install Plugin
 </Button>
 </>
 ) : (
 <Button disabled>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Installing...
 </Button>
 )}
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Plugin Configuration Dialog */}
 {selectedPlugin && selectedPlugin.installed && (
 <Dialog open={!!selectedPlugin} onOpenChange={() => setSelectedPlugin(null)}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Configure {selectedPlugin.name}</DialogTitle>
 </DialogHeader>
 <div className="space-y-4">
 {/* Plugin configuration UI would go here */}
 <p className="text-sm text-gray-600">
 Plugin configuration options will appear here
 </p>
 </div>
 <DialogFooter>
 <Button variant="outline" onClick={() => setSelectedPlugin(null)}>
 Cancel
 </Button>
 <Button>Save Configuration</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )}
 </div>
 );
}