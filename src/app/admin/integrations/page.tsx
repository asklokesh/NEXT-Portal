'use client';

import { useState } from 'react';
import { 
 GitBranch, 
 Cloud, 
 Database, 
 Shield, 
 Mail,
 MessageSquare,
 Activity,
 Package,
 Zap,
 CheckCircle,
 XCircle,
 AlertCircle,
 Loader2,
 ExternalLink,
 Settings,
 Play,
 Pause,
 RefreshCw,
 Key,
 Link,
 Unlink,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogFooter,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface Integration {
 id: string;
 name: string;
 description: string;
 category: string;
 icon: React.ReactNode;
 status: 'connected' | 'disconnected' | 'error' | 'configuring';
 enabled: boolean;
 documentation?: string;
 requiredFields: IntegrationField[];
 optionalFields?: IntegrationField[];
 features?: string[];
 health?: {
 status: 'healthy' | 'degraded' | 'unhealthy';
 lastChecked: Date;
 message?: string;
 };
}

interface IntegrationField {
 id: string;
 label: string;
 type: 'text' | 'secret' | 'select' | 'boolean';
 placeholder?: string;
 description?: string;
 required?: boolean;
 options?: { label: string; value: string }[];
 value?: any;
}

interface IntegrationStep {
 id: string;
 name: string;
 status: 'pending' | 'running' | 'completed' | 'failed';
 message?: string;
}

const INTEGRATIONS: Integration[] = [
 // Version Control
 {
 id: 'github',
 name: 'GitHub',
 description: 'Connect to GitHub for source code management and collaboration',
 category: 'Version Control',
 icon: <GitBranch className="h-5 w-5" />,
 status: 'connected',
 enabled: true,
 documentation: 'https://backstage.io/docs/integrations/github',
 requiredFields: [
 {
 id: 'token',
 label: 'Personal Access Token',
 type: 'secret',
 placeholder: 'ghp_xxxxxxxxxxxx',
 description: 'GitHub PAT with repo and user scopes',
 required: true,
 },
 ],
 optionalFields: [
 {
 id: 'enterprise_url',
 label: 'GitHub Enterprise URL',
 type: 'text',
 placeholder: 'https://github.enterprise.com',
 description: 'For GitHub Enterprise instances',
 },
 ],
 features: [
 'Repository discovery',
 'Pull request integration',
 'GitHub Actions support',
 'User and team sync',
 ],
 health: {
 status: 'healthy',
 lastChecked: new Date(),
 },
 },
 {
 id: 'gitlab',
 name: 'GitLab',
 description: 'Integrate with GitLab for DevOps lifecycle management',
 category: 'Version Control',
 icon: <GitBranch className="h-5 w-5" />,
 status: 'disconnected',
 enabled: false,
 requiredFields: [
 {
 id: 'token',
 label: 'Personal Access Token',
 type: 'secret',
 placeholder: 'glpat-xxxxxxxxxxxx',
 description: 'GitLab PAT with api scope',
 required: true,
 },
 {
 id: 'host',
 label: 'GitLab Host',
 type: 'text',
 placeholder: 'gitlab.com',
 description: 'GitLab instance hostname',
 required: true,
 value: 'gitlab.com',
 },
 ],
 features: [
 'Project discovery',
 'Merge request integration',
 'GitLab CI/CD support',
 'User and group sync',
 ],
 },

 // Cloud Providers
 {
 id: 'aws',
 name: 'Amazon Web Services',
 description: 'Monitor and manage AWS resources',
 category: 'Cloud Providers',
 icon: <Cloud className="h-5 w-5" />,
 status: 'connected',
 enabled: true,
 requiredFields: [
 {
 id: 'access_key_id',
 label: 'Access Key ID',
 type: 'text',
 placeholder: 'AKIAXXXXXXXXX',
 required: true,
 },
 {
 id: 'secret_access_key',
 label: 'Secret Access Key',
 type: 'secret',
 placeholder: '********',
 required: true,
 },
 {
 id: 'region',
 label: 'Default Region',
 type: 'select',
 options: [
 { label: 'US East 1', value: 'us-east-1' },
 { label: 'US West 2', value: 'us-west-2' },
 { label: 'EU West 1', value: 'eu-west-1' },
 ],
 required: true,
 value: 'us-east-1',
 },
 ],
 features: [
 'EC2 instance discovery',
 'S3 bucket management',
 'Cost tracking',
 'CloudWatch metrics',
 ],
 health: {
 status: 'healthy',
 lastChecked: new Date(),
 },
 },
 {
 id: 'azure',
 name: 'Microsoft Azure',
 description: 'Integrate with Azure cloud services',
 category: 'Cloud Providers',
 icon: <Cloud className="h-5 w-5" />,
 status: 'disconnected',
 enabled: false,
 requiredFields: [
 {
 id: 'tenant_id',
 label: 'Tenant ID',
 type: 'text',
 required: true,
 },
 {
 id: 'client_id',
 label: 'Client ID',
 type: 'text',
 required: true,
 },
 {
 id: 'client_secret',
 label: 'Client Secret',
 type: 'secret',
 required: true,
 },
 {
 id: 'subscription_id',
 label: 'Subscription ID',
 type: 'text',
 required: true,
 },
 ],
 features: [
 'Resource discovery',
 'Azure DevOps integration',
 'Cost management',
 'Azure Monitor metrics',
 ],
 },

 // Monitoring
 {
 id: 'datadog',
 name: 'Datadog',
 description: 'Application performance monitoring and analytics',
 category: 'Monitoring',
 icon: <Activity className="h-5 w-5" />,
 status: 'connected',
 enabled: true,
 requiredFields: [
 {
 id: 'api_key',
 label: 'API Key',
 type: 'secret',
 required: true,
 },
 {
 id: 'app_key',
 label: 'Application Key',
 type: 'secret',
 required: true,
 },
 {
 id: 'site',
 label: 'Datadog Site',
 type: 'select',
 options: [
 { label: 'US1 (datadoghq.com)', value: 'datadoghq.com' },
 { label: 'EU1 (datadoghq.eu)', value: 'datadoghq.eu' },
 { label: 'US3 (us3.datadoghq.com)', value: 'us3.datadoghq.com' },
 ],
 value: 'datadoghq.com',
 },
 ],
 features: [
 'Real-time metrics',
 'Log aggregation',
 'APM traces',
 'Custom dashboards',
 ],
 health: {
 status: 'healthy',
 lastChecked: new Date(),
 },
 },
 {
 id: 'prometheus',
 name: 'Prometheus',
 description: 'Open-source monitoring and alerting toolkit',
 category: 'Monitoring',
 icon: <Activity className="h-5 w-5" />,
 status: 'disconnected',
 enabled: false,
 requiredFields: [
 {
 id: 'url',
 label: 'Prometheus URL',
 type: 'text',
 placeholder: 'http://prometheus:9090',
 required: true,
 },
 ],
 optionalFields: [
 {
 id: 'auth_token',
 label: 'Authentication Token',
 type: 'secret',
 description: 'If authentication is enabled',
 },
 ],
 features: [
 'Time-series metrics',
 'PromQL queries',
 'Alert manager integration',
 'Service discovery',
 ],
 },

 // Communication
 {
 id: 'slack',
 name: 'Slack',
 description: 'Team communication and notifications',
 category: 'Communication',
 icon: <MessageSquare className="h-5 w-5" />,
 status: 'connected',
 enabled: true,
 requiredFields: [
 {
 id: 'bot_token',
 label: 'Bot User OAuth Token',
 type: 'secret',
 placeholder: 'xoxb-xxxxxxxxxxxx',
 required: true,
 },
 {
 id: 'signing_secret',
 label: 'Signing Secret',
 type: 'secret',
 required: true,
 },
 ],
 features: [
 'Notifications',
 'Slash commands',
 'Interactive messages',
 'Channel integration',
 ],
 health: {
 status: 'healthy',
 lastChecked: new Date(),
 },
 },
 {
 id: 'teams',
 name: 'Microsoft Teams',
 description: 'Collaborate with Microsoft Teams',
 category: 'Communication',
 icon: <MessageSquare className="h-5 w-5" />,
 status: 'disconnected',
 enabled: false,
 requiredFields: [
 {
 id: 'webhook_url',
 label: 'Incoming Webhook URL',
 type: 'text',
 placeholder: 'https://outlook.office.com/webhook/...',
 required: true,
 },
 ],
 features: [
 'Channel notifications',
 'Adaptive cards',
 'Bot framework',
 'Connectors',
 ],
 },
];

const INTEGRATION_CATEGORIES = [
 'All',
 'Version Control',
 'Cloud Providers',
 'Monitoring',
 'Communication',
 'Databases',
 'Security',
];

export default function IntegrationsPage() {
 const [integrations, setIntegrations] = useState(INTEGRATIONS);
 const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
 const [showConfigDialog, setShowConfigDialog] = useState(false);
 const [configValues, setConfigValues] = useState<Record<string, any>>({});
 const [isConfiguring, setIsConfiguring] = useState(false);
 const [configSteps, setConfigSteps] = useState<IntegrationStep[]>([]);
 const [selectedCategory, setSelectedCategory] = useState('All');
 const [searchQuery, setSearchQuery] = useState('');

 const filteredIntegrations = integrations.filter(integration => {
 const matchesCategory = selectedCategory === 'All' || integration.category === selectedCategory;
 const matchesSearch = searchQuery === '' || 
 integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 integration.description.toLowerCase().includes(searchQuery.toLowerCase());
 return matchesCategory && matchesSearch;
 });

 const handleConfigure = (integration: Integration) => {
 setSelectedIntegration(integration);
 setShowConfigDialog(true);
 
 // Initialize config values
 const initialValues: Record<string, any> = {};
 [...integration.requiredFields, ...(integration.optionalFields || [])].forEach(field => {
 initialValues[field.id] = field.value || '';
 });
 setConfigValues(initialValues);
 };

 const handleConnect = async () => {
 if (!selectedIntegration) return;
 
 setIsConfiguring(true);
 
 const steps: IntegrationStep[] = [
 { id: 'validate', name: 'Validating credentials', status: 'pending' },
 { id: 'test', name: 'Testing connection', status: 'pending' },
 { id: 'configure', name: 'Configuring integration', status: 'pending' },
 { id: 'sync', name: 'Initial synchronization', status: 'pending' },
 ];
 
 setConfigSteps(steps);
 
 // Simulate configuration process
 for (let i = 0; i < steps.length; i++) {
 setConfigSteps(prev => prev.map((step, index) => 
 index === i ? { ...step, status: 'running' } : step
 ));
 
 await new Promise(resolve => setTimeout(resolve, 1500));
 
 // Simulate occasional failures
 if (Math.random() > 0.9 && i === 1) {
 setConfigSteps(prev => prev.map((step, index) => 
 index === i ? { 
 ...step, 
 status: 'failed',
 message: 'Authentication failed. Please check your credentials.'
 } : step
 ));
 break;
 }
 
 setConfigSteps(prev => prev.map((step, index) => 
 index === i ? { ...step, status: 'completed' } : step
 ));
 }
 
 const allCompleted = configSteps.every(step => step.status === 'completed');
 if (allCompleted) {
 setIntegrations(prev => prev.map(integration => 
 integration.id === selectedIntegration.id 
 ? { ...integration, status: 'connected', enabled: true }
 : integration
 ));
 toast.success(`${selectedIntegration.name} connected successfully!`);
 setShowConfigDialog(false);
 }
 
 setIsConfiguring(false);
 };

 const handleDisconnect = async (integration: Integration) => {
 setIntegrations(prev => prev.map(i => 
 i.id === integration.id 
 ? { ...i, status: 'disconnected', enabled: false }
 : i
 ));
 toast.success(`${integration.name} disconnected`);
 };

 const handleToggle = async (integration: Integration) => {
 const newEnabled = !integration.enabled;
 setIntegrations(prev => prev.map(i => 
 i.id === integration.id ? { ...i, enabled: newEnabled } : i
 ));
 toast.success(`${integration.name} ${newEnabled ? 'enabled' : 'disabled'}`);
 };

 const testConnection = async (integration: Integration) => {
 toast.success(`Connection to ${integration.name} is healthy`);
 };

 const calculateProgress = () => {
 const completed = configSteps.filter(step => step.status === 'completed').length;
 return (completed / configSteps.length) * 100;
 };

 const getStatusColor = (status: Integration['status']) => {
 switch (status) {
 case 'connected':
 return 'success';
 case 'disconnected':
 return 'secondary';
 case 'error':
 return 'destructive';
 case 'configuring':
 return 'warning';
 default:
 return 'secondary';
 }
 };

 const getHealthIcon = (health?: Integration['health']) => {
 if (!health) return null;
 
 switch (health.status) {
 case 'healthy':
 return <CheckCircle className="h-4 w-4 text-green-600" />;
 case 'degraded':
 return <AlertCircle className="h-4 w-4 text-yellow-600" />;
 case 'unhealthy':
 return <XCircle className="h-4 w-4 text-red-600" />;
 }
 };

 return (
 <div className="space-y-6">
 <div>
 <h1 className="text-3xl font-bold">Integrations</h1>
 <p className="text-gray-600 mt-2">
 Connect Backstage to your tools and services with one click
 </p>
 </div>

 <Alert>
 <Zap className="h-4 w-4" />
 <AlertTitle>One-Click Integration</AlertTitle>
 <AlertDescription>
 Simply enter your credentials and we'll handle all the configuration. 
 No manual YAML editing or complex setup required.
 </AlertDescription>
 </Alert>

 <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
 <TabsList>
 {INTEGRATION_CATEGORIES.map(category => (
 <TabsTrigger key={category} value={category}>
 {category}
 </TabsTrigger>
 ))}
 </TabsList>

 <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {filteredIntegrations.map(integration => (
 <Card key={integration.id} className="hover:shadow-lg transition-shadow">
 <CardHeader>
 <div className="flex items-start justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-gray-100 rounded-lg">
 {integration.icon}
 </div>
 <div>
 <CardTitle className="text-lg">{integration.name}</CardTitle>
 <div className="flex items-center gap-2 mt-1">
 <Badge variant={getStatusColor(integration.status)}>
 {integration.status}
 </Badge>
 {integration.health && getHealthIcon(integration.health)}
 </div>
 </div>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-4">
 <CardDescription>{integration.description}</CardDescription>
 
 {integration.features && (
 <div className="space-y-1">
 {integration.features.slice(0, 3).map((feature, index) => (
 <div key={index} className="flex items-center gap-2 text-sm text-gray-600">
 <CheckCircle className="h-3 w-3 text-green-600" />
 {feature}
 </div>
 ))}
 </div>
 )}
 
 <div className="flex gap-2">
 {integration.status === 'connected' ? (
 <>
 <Button
 size="sm"
 variant="outline"
 className="flex-1"
 onClick={() => handleToggle(integration)}
 >
 {integration.enabled ? (
 <>
 <Pause className="h-4 w-4 mr-2" />
 Disable
 </>
 ) : (
 <>
 <Play className="h-4 w-4 mr-2" />
 Enable
 </>
 )}
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => testConnection(integration)}
 >
 <RefreshCw className="h-4 w-4" />
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleConfigure(integration)}
 >
 <Settings className="h-4 w-4" />
 </Button>
 </>
 ) : (
 <Button
 size="sm"
 className="w-full"
 onClick={() => handleConfigure(integration)}
 >
 <Link className="h-4 w-4 mr-2" />
 Connect
 </Button>
 )}
 </div>
 
 {integration.documentation && (
 <a
 href={integration.documentation}
 target="_blank"
 rel="noopener noreferrer"
 className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
 >
 <ExternalLink className="h-3 w-3" />
 Documentation
 </a>
 )}
 </CardContent>
 </Card>
 ))}
 </div>
 </Tabs>

 {/* Configuration Dialog */}
 <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
 <DialogContent className="max-w-2xl">
 <DialogHeader>
 <DialogTitle>Configure {selectedIntegration?.name}</DialogTitle>
 <DialogDescription>
 Enter your credentials to connect {selectedIntegration?.name} to Backstage
 </DialogDescription>
 </DialogHeader>

 {!isConfiguring ? (
 <div className="space-y-4">
 {/* Required Fields */}
 {selectedIntegration?.requiredFields.map(field => (
 <div key={field.id} className="space-y-2">
 <Label htmlFor={field.id}>
 {field.label}
 <span className="text-red-500 ml-1">*</span>
 </Label>
 {field.type === 'select' ? (
 <Select
 value={configValues[field.id] || field.value}
 onValueChange={(value) => setConfigValues(prev => ({
 ...prev,
 [field.id]: value
 }))}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {field.options?.map(option => (
 <SelectItem key={option.value} value={option.value}>
 {option.label}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 ) : (
 <Input
 id={field.id}
 type={field.type === 'secret' ? 'password' : 'text'}
 placeholder={field.placeholder}
 value={configValues[field.id] || ''}
 onChange={(e) => setConfigValues(prev => ({
 ...prev,
 [field.id]: e.target.value
 }))}
 />
 )}
 {field.description && (
 <p className="text-sm text-gray-600">{field.description}</p>
 )}
 </div>
 ))}
 
 {/* Optional Fields */}
 {selectedIntegration?.optionalFields && selectedIntegration.optionalFields.length > 0 && (
 <>
 <Separator className="my-4" />
 <h4 className="font-medium">Optional Settings</h4>
 {selectedIntegration.optionalFields.map(field => (
 <div key={field.id} className="space-y-2">
 <Label htmlFor={field.id}>{field.label}</Label>
 <Input
 id={field.id}
 type={field.type === 'secret' ? 'password' : 'text'}
 placeholder={field.placeholder}
 value={configValues[field.id] || ''}
 onChange={(e) => setConfigValues(prev => ({
 ...prev,
 [field.id]: e.target.value
 }))}
 />
 {field.description && (
 <p className="text-sm text-gray-600">{field.description}</p>
 )}
 </div>
 ))}
 </>
 )}
 </div>
 ) : (
 <div className="space-y-4">
 {/* Configuration Progress */}
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium">Configuration Progress</span>
 <span className="text-sm text-gray-600">
 {Math.round(calculateProgress())}%
 </span>
 </div>
 <Progress value={calculateProgress()} />
 </div>

 {/* Configuration Steps */}
 <div className="space-y-2">
 {configSteps.map(step => (
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
 {!isConfiguring ? (
 <>
 <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
 Cancel
 </Button>
 <Button 
 onClick={handleConnect}
 disabled={selectedIntegration?.requiredFields.some(
 field => !configValues[field.id]
 )}
 >
 <Link className="h-4 w-4 mr-2" />
 Connect
 </Button>
 </>
 ) : (
 <Button disabled>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Configuring...
 </Button>
 )}
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}