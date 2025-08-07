'use client';

import { IntegrationConfig } from '@/components/integrations/IntegrationConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, FileCode } from 'lucide-react';

export default function IntegrationConfigPage() {
 const handleSave = (config: any) => {
 console.log('Configuration saved:', config);
 };

 return (
 <div className="container mx-auto py-8 space-y-6">
 {/* Header */}
 <div className="space-y-2">
 <h1 className="text-3xl font-bold">Zero-Maintenance Integration Configuration</h1>
 <p className="text-muted-foreground">
 Configure Backstage catalog integrations through an intuitive UI without editing YAML files
 </p>
 </div>

 {/* Info Banner */}
 <Alert>
 <Info className="h-4 w-4" />
 <AlertDescription>
 This interface generates production-ready Backstage configuration. After saving, you can download the generated app-config.yaml or apply changes directly to your Backstage instance.
 </AlertDescription>
 </Alert>

 {/* Benefits */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Card>
 <CardHeader>
 <CardTitle className="text-lg">No YAML Editing</CardTitle>
 </CardHeader>
 <CardContent>
 <CardDescription>
 Visual configuration forms with validation and helpful defaults
 </CardDescription>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-lg">Test Connections</CardTitle>
 </CardHeader>
 <CardContent>
 <CardDescription>
 Verify integrations work before saving with built-in connection testing
 </CardDescription>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-lg">Auto-Discovery</CardTitle>
 </CardHeader>
 <CardContent>
 <CardDescription>
 Set up automatic entity discovery from GitHub, GitLab, K8s, and cloud providers
 </CardDescription>
 </CardContent>
 </Card>
 </div>

 {/* Main Configuration Component */}
 <IntegrationConfig onSave={handleSave} />

 {/* Footer */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <FileCode className="h-5 w-5" />
 Generated Configuration
 </CardTitle>
 <CardDescription>
 Your configuration will be converted to standard Backstage app-config.yaml format
 </CardDescription>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 <div>
 <h4 className="font-medium mb-1">Environment Variables</h4>
 <p className="text-sm text-muted-foreground">
 Sensitive values like tokens are stored as environment variable references for security
 </p>
 </div>
 <div>
 <h4 className="font-medium mb-1">Hot Reload</h4>
 <p className="text-sm text-muted-foreground">
 Changes can be applied without restarting Backstage when using dynamic configuration
 </p>
 </div>
 <div>
 <h4 className="font-medium mb-1">Version Control</h4>
 <p className="text-sm text-muted-foreground">
 Export configuration to track changes in your repository
 </p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>
 );
}