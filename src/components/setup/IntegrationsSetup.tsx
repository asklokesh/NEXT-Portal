'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
 Github, 
 Gitlab, 
 Cloud, 
 AlertCircle, 
 CheckCircle,
 XCircle,
 Loader2,
 ExternalLink,
 Key
} from 'lucide-react';

interface IntegrationsSetupProps {
 data: {
 enabledIntegrations: string[];
 };
 onUpdate: (data: { enabledIntegrations: string[] }) => void;
}

interface Integration {
 id: string;
 name: string;
 description: string;
 icon: React.ReactNode;
 fields: {
 key: string;
 label: string;
 type: string;
 placeholder: string;
 required?: boolean;
 }[];
 docUrl?: string;
}

const integrations: Integration[] = [
 {
 id: 'github',
 name: 'GitHub',
 description: 'Connect to GitHub for source control and CI/CD',
 icon: <Github className="h-5 w-5" />,
 fields: [
 {
 key: 'token',
 label: 'Personal Access Token',
 type: 'password',
 placeholder: 'ghp_xxxxxxxxxxxx',
 required: true,
 },
 {
 key: 'org',
 label: 'Organization (Optional)',
 type: 'text',
 placeholder: 'my-org',
 },
 ],
 docUrl: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token',
 },
 {
 id: 'gitlab',
 name: 'GitLab',
 description: 'Connect to GitLab for source control and CI/CD',
 icon: <Gitlab className="h-5 w-5" />,
 fields: [
 {
 key: 'token',
 label: 'Personal Access Token',
 type: 'password',
 placeholder: 'glpat-xxxxxxxxxxxx',
 required: true,
 },
 {
 key: 'url',
 label: 'GitLab URL',
 type: 'url',
 placeholder: 'https://gitlab.com',
 },
 ],
 },
 {
 id: 'aws',
 name: 'AWS',
 description: 'Connect to AWS for cloud resources management',
 icon: <Cloud className="h-5 w-5" />,
 fields: [
 {
 key: 'accessKeyId',
 label: 'Access Key ID',
 type: 'text',
 placeholder: 'AKIAIOSFODNN7EXAMPLE',
 required: true,
 },
 {
 key: 'secretAccessKey',
 label: 'Secret Access Key',
 type: 'password',
 placeholder: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
 required: true,
 },
 {
 key: 'region',
 label: 'Default Region',
 type: 'text',
 placeholder: 'us-east-1',
 },
 ],
 },
 {
 id: 'kubernetes',
 name: 'Kubernetes',
 description: 'Connect to Kubernetes clusters',
 icon: <Cloud className="h-5 w-5" />,
 fields: [
 {
 key: 'config',
 label: 'Kubeconfig Content',
 type: 'textarea',
 placeholder: 'Paste your kubeconfig here',
 required: true,
 },
 ],
 },
];

export function IntegrationsSetup({ data, onUpdate }: IntegrationsSetupProps) {
 const [integrationConfigs, setIntegrationConfigs] = useState<Record<string, any>>({});
 const [testResults, setTestResults] = useState<Record<string, 'success' | 'error' | 'testing'>>({});
 const [enabledIntegrations, setEnabledIntegrations] = useState<Set<string>>(
 new Set(data.enabledIntegrations)
 );

 const handleToggleIntegration = (integrationId: string, enabled: boolean) => {
 const newEnabled = new Set(enabledIntegrations);
 if (enabled) {
 newEnabled.add(integrationId);
 } else {
 newEnabled.delete(integrationId);
 }
 setEnabledIntegrations(newEnabled);
 onUpdate({ enabledIntegrations: Array.from(newEnabled) });
 };

 const handleConfigChange = (integrationId: string, field: string, value: string) => {
 setIntegrationConfigs(prev => ({
 ...prev,
 [integrationId]: {
 ...prev[integrationId],
 [field]: value,
 },
 }));
 };

 const testIntegration = async (integrationId: string) => {
 setTestResults(prev => ({ ...prev, [integrationId]: 'testing' }));

 try {
 const response = await fetch('/api/setup/test-integration', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 integration: integrationId,
 config: integrationConfigs[integrationId] || {},
 }),
 });

 const result = await response.json();
 setTestResults(prev => ({
 ...prev,
 [integrationId]: result.success ? 'success' : 'error',
 }));
 } catch (error) {
 setTestResults(prev => ({ ...prev, [integrationId]: 'error' }));
 }
 };

 return (
 <div className="space-y-6">
 <Alert>
 <AlertCircle className="h-4 w-4" />
 <AlertDescription>
 Integrations can be configured later. Only set up the ones you need immediately.
 </AlertDescription>
 </Alert>

 <div className="space-y-4">
 {integrations.map((integration) => {
 const isEnabled = enabledIntegrations.has(integration.id);
 const testResult = testResults[integration.id];

 return (
 <Card key={integration.id} className={isEnabled ? 'border-primary' : ''}>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 {integration.icon}
 <div>
 <CardTitle className="text-lg">{integration.name}</CardTitle>
 <CardDescription>{integration.description}</CardDescription>
 </div>
 </div>
 <Switch
 checked={isEnabled}
 onCheckedChange={(checked) => handleToggleIntegration(integration.id, checked)}
 />
 </div>
 </CardHeader>

 {isEnabled && (
 <CardContent className="space-y-4">
 {integration.fields.map((field) => (
 <div key={field.key}>
 <Label htmlFor={`${integration.id}-${field.key}`}>
 {field.label}
 {field.required && <span className="text-red-500 ml-1">*</span>}
 </Label>
 {field.type === 'textarea' ? (
 <textarea
 id={`${integration.id}-${field.key}`}
 className="mt-1 w-full min-h-[100px] px-3 py-2 border rounded-md"
 placeholder={field.placeholder}
 value={integrationConfigs[integration.id]?.[field.key] || ''}
 onChange={(e) => handleConfigChange(integration.id, field.key, e.target.value)}
 />
 ) : (
 <Input
 id={`${integration.id}-${field.key}`}
 type={field.type}
 placeholder={field.placeholder}
 value={integrationConfigs[integration.id]?.[field.key] || ''}
 onChange={(e) => handleConfigChange(integration.id, field.key, e.target.value)}
 className="mt-1"
 />
 )}
 </div>
 ))}

 <div className="flex items-center justify-between pt-4">
 <Button
 variant="outline"
 size="sm"
 onClick={() => testIntegration(integration.id)}
 disabled={testResult === 'testing'}
 >
 {testResult === 'testing' ? (
 <>
 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
 Testing...
 </>
 ) : (
 <>
 <Key className="h-4 w-4 mr-2" />
 Test Connection
 </>
 )}
 </Button>

 <div className="flex items-center gap-2">
 {testResult === 'success' && (
 <Badge variant="success" className="gap-1">
 <CheckCircle className="h-3 w-3" />
 Connected
 </Badge>
 )}
 {testResult === 'error' && (
 <Badge variant="destructive" className="gap-1">
 <XCircle className="h-3 w-3" />
 Failed
 </Badge>
 )}
 {integration.docUrl && (
 <Button
 variant="ghost"
 size="sm"
 asChild
 >
 <a href={integration.docUrl} target="_blank" rel="noopener noreferrer">
 <ExternalLink className="h-4 w-4" />
 </a>
 </Button>
 )}
 </div>
 </div>
 </CardContent>
 )}
 </Card>
 );
 })}
 </div>

 {/* Summary */}
 <Card>
 <CardContent className="pt-6">
 <div className="flex items-center justify-between">
 <span className="text-sm text-muted-foreground">
 {enabledIntegrations.size} integration{enabledIntegrations.size !== 1 ? 's' : ''} enabled
 </span>
 {enabledIntegrations.size > 0 && (
 <div className="flex gap-2">
 {Array.from(enabledIntegrations).map((id) => {
 const integration = integrations.find(i => i.id === id);
 return integration ? (
 <Badge key={id} variant="secondary">
 {integration.name}
 </Badge>
 ) : null;
 })}
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 </div>
 );
}