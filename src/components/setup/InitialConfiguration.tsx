'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Shield, Bell, Activity, DollarSign, GitBranch } from 'lucide-react';

interface InitialConfigurationProps {
 data: {
 organizationName: string;
 adminEmail: string;
 };
 onUpdate: (data: any) => void;
}

export function InitialConfiguration({ data, onUpdate }: InitialConfigurationProps) {
 const [config, setConfig] = useState({
 organizationName: data.organizationName || '',
 adminEmail: data.adminEmail || '',
 organizationDomain: '',
 defaultTeam: '',
 timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
 features: {
 websocket: true,
 notifications: true,
 auditLogs: true,
 costTracking: false,
 deployments: false,
 },
 authProvider: 'backstage',
 sessionTimeout: '24',
 });

 const handleConfigChange = (key: string, value: any) => {
 const newConfig = { ...config, [key]: value };
 setConfig(newConfig);
 onUpdate({
 organizationName: newConfig.organizationName,
 adminEmail: newConfig.adminEmail,
 ...newConfig,
 });
 };

 const handleFeatureToggle = (feature: string, enabled: boolean) => {
 const newFeatures = { ...config.features, [feature]: enabled };
 handleConfigChange('features', newFeatures);
 };

 return (
 <div className="space-y-6">
 {/* Organization Information */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Building2 className="h-5 w-5" />
 Organization Information
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div>
 <Label htmlFor="org-name">Organization Name *</Label>
 <Input
 id="org-name"
 value={config.organizationName}
 onChange={(e) => handleConfigChange('organizationName', e.target.value)}
 placeholder="Acme Corporation"
 className="mt-1"
 required
 />
 </div>

 <div>
 <Label htmlFor="admin-email">Administrator Email *</Label>
 <Input
 id="admin-email"
 type="email"
 value={config.adminEmail}
 onChange={(e) => handleConfigChange('adminEmail', e.target.value)}
 placeholder="admin@example.com"
 className="mt-1"
 required
 />
 <p className="text-sm text-muted-foreground mt-1">
 Used for system notifications and initial admin account
 </p>
 </div>

 <div>
 <Label htmlFor="org-domain">Organization Domain</Label>
 <Input
 id="org-domain"
 value={config.organizationDomain}
 onChange={(e) => handleConfigChange('organizationDomain', e.target.value)}
 placeholder="example.com"
 className="mt-1"
 />
 <p className="text-sm text-muted-foreground mt-1">
 Used for email validation and SSO configuration
 </p>
 </div>

 <div>
 <Label htmlFor="default-team">Default Team Name</Label>
 <Input
 id="default-team"
 value={config.defaultTeam}
 onChange={(e) => handleConfigChange('defaultTeam', e.target.value)}
 placeholder="Platform Team"
 className="mt-1"
 />
 </div>
 </CardContent>
 </Card>

 {/* Authentication Settings */}
 <Card>
 <CardHeader>
 <CardTitle className="flex items-center gap-2">
 <Shield className="h-5 w-5" />
 Authentication Settings
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div>
 <Label htmlFor="auth-provider">Authentication Provider</Label>
 <Select
 value={config.authProvider}
 onValueChange={(value) => handleConfigChange('authProvider', value)}
 >
 <SelectTrigger id="auth-provider" className="mt-1">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="backstage">Backstage Default</SelectItem>
 <SelectItem value="github">GitHub</SelectItem>
 <SelectItem value="gitlab">GitLab</SelectItem>
 <SelectItem value="google">Google</SelectItem>
 <SelectItem value="okta">Okta</SelectItem>
 <SelectItem value="azure">Azure AD</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div>
 <Label htmlFor="session-timeout">Session Timeout (hours)</Label>
 <Input
 id="session-timeout"
 type="number"
 value={config.sessionTimeout}
 onChange={(e) => handleConfigChange('sessionTimeout', e.target.value)}
 min="1"
 max="720"
 className="mt-1"
 />
 </div>
 </CardContent>
 </Card>

 {/* Feature Toggles */}
 <Card>
 <CardHeader>
 <CardTitle>Platform Features</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Activity className="h-4 w-4 text-muted-foreground" />
 <div>
 <Label htmlFor="feature-websocket">Real-time Updates</Label>
 <p className="text-sm text-muted-foreground">WebSocket connections for live data</p>
 </div>
 </div>
 <Switch
 id="feature-websocket"
 checked={config.features.websocket}
 onCheckedChange={(checked) => handleFeatureToggle('websocket', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Bell className="h-4 w-4 text-muted-foreground" />
 <div>
 <Label htmlFor="feature-notifications">Notifications</Label>
 <p className="text-sm text-muted-foreground">In-app and email notifications</p>
 </div>
 </div>
 <Switch
 id="feature-notifications"
 checked={config.features.notifications}
 onCheckedChange={(checked) => handleFeatureToggle('notifications', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <Shield className="h-4 w-4 text-muted-foreground" />
 <div>
 <Label htmlFor="feature-audit">Audit Logs</Label>
 <p className="text-sm text-muted-foreground">Track all system changes</p>
 </div>
 </div>
 <Switch
 id="feature-audit"
 checked={config.features.auditLogs}
 onCheckedChange={(checked) => handleFeatureToggle('auditLogs', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <DollarSign className="h-4 w-4 text-muted-foreground" />
 <div>
 <Label htmlFor="feature-cost">Cost Tracking</Label>
 <p className="text-sm text-muted-foreground">Monitor cloud resource costs</p>
 </div>
 </div>
 <Switch
 id="feature-cost"
 checked={config.features.costTracking}
 onCheckedChange={(checked) => handleFeatureToggle('costTracking', checked)}
 />
 </div>

 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <GitBranch className="h-4 w-4 text-muted-foreground" />
 <div>
 <Label htmlFor="feature-deployments">Deployment Tracking</Label>
 <p className="text-sm text-muted-foreground">Monitor service deployments</p>
 </div>
 </div>
 <Switch
 id="feature-deployments"
 checked={config.features.deployments}
 onCheckedChange={(checked) => handleFeatureToggle('deployments', checked)}
 />
 </div>
 </div>
 </CardContent>
 </Card>

 {/* Regional Settings */}
 <Card>
 <CardHeader>
 <CardTitle>Regional Settings</CardTitle>
 </CardHeader>
 <CardContent>
 <div>
 <Label htmlFor="timezone">Timezone</Label>
 <Select
 value={config.timezone}
 onValueChange={(value) => handleConfigChange('timezone', value)}
 >
 <SelectTrigger id="timezone" className="mt-1">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="UTC">UTC</SelectItem>
 <SelectItem value="America/New_York">Eastern Time</SelectItem>
 <SelectItem value="America/Chicago">Central Time</SelectItem>
 <SelectItem value="America/Denver">Mountain Time</SelectItem>
 <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
 <SelectItem value="Europe/London">London</SelectItem>
 <SelectItem value="Europe/Paris">Paris</SelectItem>
 <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
 <SelectItem value="Asia/Shanghai">Shanghai</SelectItem>
 <SelectItem value="Australia/Sydney">Sydney</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </CardContent>
 </Card>

 <Alert>
 <AlertDescription>
 These settings can be changed later from the Admin panel. Features marked with * are required.
 </AlertDescription>
 </Alert>
 </div>
 );
}