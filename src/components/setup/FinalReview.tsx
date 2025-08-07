'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
 CheckCircle, 
 AlertCircle, 
 Server, 
 Database, 
 Building2,
 Package,
 Link,
 Settings,
 Loader2,
 Copy
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface FinalReviewProps {
 data: {
 backstageUrl: string;
 backstageToken: string;
 databaseUrl: string;
 organizationName: string;
 adminEmail: string;
 enabledIntegrations: string[];
 installedPlugins: string[];
 [key: string]: any;
 };
 onComplete: () => Promise<void>;
 isValidating: boolean;
}

export function FinalReview({ data, onComplete, isValidating }: FinalReviewProps) {
 const [showEnvVars, setShowEnvVars] = useState(false);
 const [copied, setCopied] = useState(false);

 const generateEnvVars = () => {
 const envVars = [
 `# Backstage Configuration`,
 `BACKSTAGE_API_URL="${data.backstageUrl}"`,
 data.backstageToken ? `BACKSTAGE_AUTH_TOKEN="${data.backstageToken}"` : '',
 '',
 `# Database Configuration`,
 `DATABASE_URL="${data.databaseUrl}"`,
 '',
 `# Organization Settings`,
 `NEXT_PUBLIC_APP_NAME="${data.organizationName}"`,
 `ADMIN_EMAIL="${data.adminEmail}"`,
 '',
 `# Feature Flags`,
 `ENABLE_WEBSOCKET="${data.features?.websocket || true}"`,
 `ENABLE_NOTIFICATIONS="${data.features?.notifications || true}"`,
 `ENABLE_AUDIT_LOGS="${data.features?.auditLogs || true}"`,
 `ENABLE_COST_TRACKING="${data.features?.costTracking || false}"`,
 `ENABLE_DEPLOYMENTS="${data.features?.deployments || false}"`,
 ].filter(Boolean).join('\n');

 return envVars;
 };

 const copyEnvVars = () => {
 navigator.clipboard.writeText(generateEnvVars());
 setCopied(true);
 toast.success('Environment variables copied to clipboard');
 setTimeout(() => setCopied(false), 3000);
 };

 const configSections = [
 {
 title: 'Backstage Connection',
 icon: <Server className="h-5 w-5" />,
 items: [
 { label: 'Backend URL', value: data.backstageUrl },
 { label: 'Authentication', value: data.backstageToken ? 'Configured' : 'Not configured' },
 ],
 },
 {
 title: 'Database',
 icon: <Database className="h-5 w-5" />,
 items: [
 { label: 'Connection', value: data.databaseUrl ? 'Configured' : 'Not configured' },
 { label: 'Redis Cache', value: data.redisUrl || 'Not configured' },
 ],
 },
 {
 title: 'Organization',
 icon: <Building2 className="h-5 w-5" />,
 items: [
 { label: 'Name', value: data.organizationName },
 { label: 'Admin Email', value: data.adminEmail },
 { label: 'Domain', value: data.organizationDomain || 'Not specified' },
 { label: 'Auth Provider', value: data.authProvider || 'Backstage Default' },
 ],
 },
 {
 title: 'Integrations',
 icon: <Link className="h-5 w-5" />,
 items: [
 { 
 label: 'Enabled', 
 value: data.enabledIntegrations.length > 0 
 ? data.enabledIntegrations.join(', ') 
 : 'None' 
 },
 ],
 },
 {
 title: 'Plugins',
 icon: <Package className="h-5 w-5" />,
 items: [
 { 
 label: 'Installed', 
 value: `${data.installedPlugins.length} plugin${data.installedPlugins.length !== 1 ? 's' : ''}` 
 },
 ],
 },
 ];

 return (
 <div className="space-y-6">
 <Alert>
 <CheckCircle className="h-4 w-4" />
 <AlertDescription>
 Review your configuration before completing setup. You can modify these settings later from the admin panel.
 </AlertDescription>
 </Alert>

 {/* Configuration Summary */}
 <div className="grid gap-4">
 {configSections.map((section) => (
 <Card key={section.title}>
 <CardHeader>
 <CardTitle className="text-base flex items-center gap-2">
 {section.icon}
 {section.title}
 </CardTitle>
 </CardHeader>
 <CardContent>
 <dl className="space-y-2">
 {section.items.map((item) => (
 <div key={item.label} className="flex items-center justify-between">
 <dt className="text-sm text-muted-foreground">{item.label}:</dt>
 <dd className="text-sm font-medium">
 {item.value.includes(', ') ? (
 <div className="flex gap-1 flex-wrap justify-end">
 {item.value.split(', ').map((v) => (
 <Badge key={v} variant="secondary">{v}</Badge>
 ))}
 </div>
 ) : (
 item.value
 )}
 </dd>
 </div>
 ))}
 </dl>
 </CardContent>
 </Card>
 ))}
 </div>

 {/* Environment Variables */}
 <Card>
 <CardHeader>
 <CardTitle className="text-base flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Settings className="h-5 w-5" />
 Environment Variables
 </div>
 <Button
 variant="outline"
 size="sm"
 onClick={() => setShowEnvVars(!showEnvVars)}
 >
 {showEnvVars ? 'Hide' : 'Show'} .env
 </Button>
 </CardTitle>
 </CardHeader>
 {showEnvVars && (
 <CardContent>
 <div className="relative">
 <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
 <code>{generateEnvVars()}</code>
 </pre>
 <Button
 variant="ghost"
 size="sm"
 className="absolute top-2 right-2"
 onClick={copyEnvVars}
 >
 {copied ? (
 <>
 <CheckCircle className="h-4 w-4 mr-2" />
 Copied
 </>
 ) : (
 <>
 <Copy className="h-4 w-4 mr-2" />
 Copy
 </>
 )}
 </Button>
 </div>
 <p className="text-sm text-muted-foreground mt-3">
 Save these environment variables to a <code>.env</code> file in your project root.
 </p>
 </CardContent>
 )}
 </Card>

 {/* Features Summary */}
 {data.features && (
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Enabled Features</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex flex-wrap gap-2">
 {Object.entries(data.features).map(([feature, enabled]) => 
 enabled ? (
 <Badge key={feature} variant="default">
 <CheckCircle className="h-3 w-3 mr-1" />
 {feature.replace(/([A-Z])/g, ' $1').trim()}
 </Badge>
 ) : null
 )}
 </div>
 </CardContent>
 </Card>
 )}

 {/* Next Steps */}
 <Card className="border-primary">
 <CardHeader>
 <CardTitle className="text-base flex items-center gap-2">
 <AlertCircle className="h-5 w-5" />
 Next Steps After Setup
 </CardTitle>
 </CardHeader>
 <CardContent>
 <ol className="space-y-2 text-sm">
 <li>1. Import your service catalog from Backstage</li>
 <li>2. Configure team permissions and access controls</li>
 <li>3. Set up monitoring and alerting thresholds</li>
 <li>4. Customize templates for your organization</li>
 <li>5. Configure additional integrations as needed</li>
 </ol>
 </CardContent>
 </Card>

 {/* Completion Warning */}
 <Alert variant="default" className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
 <AlertCircle className="h-4 w-4 text-orange-600" />
 <AlertDescription>
 <strong>Important:</strong> Completing setup will create the initial database schema and configure your platform. 
 This process may take a few moments.
 </AlertDescription>
 </Alert>
 </div>
 );
}