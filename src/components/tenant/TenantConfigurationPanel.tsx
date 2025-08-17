/**
 * Tenant Configuration Panel
 * Comprehensive interface for managing tenant-specific configuration and customization
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Palette, 
  Settings, 
  Shield, 
  Plug, 
  Bell, 
  Monitor,
  Download,
  Upload,
  RefreshCw,
  Save,
  AlertTriangle,
  CheckCircle2,
  Info,
  Github,
  Slack,
  Zap
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface TenantConfiguration {
  authentication: {
    providers: any[];
    ssoEnabled: boolean;
    mfaRequired: boolean;
    sessionTimeout: number;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSymbols: boolean;
    };
  };
  branding: {
    organizationName: string;
    logoUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    customCSS?: string;
    footerText?: string;
    supportEmail?: string;
  };
  features: {
    enabledFeatures: FeatureToggle[];
    maxUsers: number;
    maxPlugins: number;
    maxStorage: number;
    customDomainEnabled: boolean;
    whitelabelEnabled: boolean;
    advancedAnalytics: boolean;
    prioritySupport: boolean;
  };
  integrations: {
    github: { enabled: boolean; orgWhitelist: string[] };
    slack: { enabled: boolean; workspaces: string[]; channels: string[] };
    jira: { enabled: boolean; projects: string[] };
  };
}

interface FeatureToggle {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
}

const FEATURE_DESCRIPTIONS = {
  'catalog': 'Service Catalog - Browse and manage services',
  'scaffolder': 'Software Templates - Create new projects from templates',
  'techdocs': 'Technical Documentation - Documentation as code',
  'kubernetes': 'Kubernetes Plugin - Monitor K8s resources',
  'jenkins': 'Jenkins Integration - CI/CD pipeline visibility',
  'sonarqube': 'SonarQube Integration - Code quality metrics',
  'grafana': 'Grafana Dashboards - Infrastructure monitoring',
  'pagerduty': 'PagerDuty Integration - Incident management',
  'datadog': 'Datadog Integration - Application monitoring',
  'newrelic': 'New Relic Integration - Performance monitoring'
};

export default function TenantConfigurationPanel() {
  const [config, setConfig] = useState<TenantConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('branding');
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tenant/configuration');
      const result = await response.json();

      if (result.success) {
        setConfig(result.data);
        setUnsavedChanges(false);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load configuration',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to load configuration',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async (section?: string, sectionData?: any) => {
    if (!config && !sectionData) return;

    try {
      setSaving(true);
      
      const payload = section && sectionData 
        ? { section, updates: sectionData }
        : { updates: config };

      const response = await fetch('/api/tenant/configuration', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message || 'Configuration updated successfully'
        });
        
        if (result.requiresRestart) {
          toast({
            title: 'Restart Required',
            description: 'Some changes may require a portal restart to take effect',
            variant: 'destructive'
          });
        }
        
        setUnsavedChanges(false);
        await loadConfiguration(); // Reload to get latest state
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to save configuration',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to save configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (path: string, value: any) => {
    if (!config) return;

    const pathArray = path.split('.');
    const newConfig = { ...config };
    let current: any = newConfig;

    for (let i = 0; i < pathArray.length - 1; i++) {
      current = current[pathArray[i]];
    }
    current[pathArray[pathArray.length - 1]] = value;

    setConfig(newConfig);
    setUnsavedChanges(true);
  };

  const updateFeatureToggle = async (featureKey: string, enabled: boolean, rolloutPercentage: number = 100) => {
    try {
      const response = await fetch('/api/tenant/configuration', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          section: 'feature_toggle',
          updates: { featureKey, enabled, rolloutPercentage }
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Feature ${featureKey} ${enabled ? 'enabled' : 'disabled'}`
        });
        await loadConfiguration();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update feature toggle',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to update feature toggle:', error);
    }
  };

  const exportConfiguration = async () => {
    try {
      const response = await fetch('/api/tenant/configuration?export=true');
      const result = await response.json();

      if (result.success) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tenant-config-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        toast({
          title: 'Success',
          description: 'Configuration exported successfully'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export configuration',
        variant: 'destructive'
      });
    }
  };

  const renderBrandingTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Organization Branding
          </CardTitle>
          <CardDescription>
            Customize your portal's appearance and branding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                value={config?.branding.organizationName || ''}
                onChange={(e) => updateConfig('branding.organizationName', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input
                id="supportEmail"
                type="email"
                value={config?.branding.supportEmail || ''}
                onChange={(e) => updateConfig('branding.supportEmail', e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              value={config?.branding.logoUrl || ''}
              onChange={(e) => updateConfig('branding.logoUrl', e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={config?.branding.primaryColor || '#1976d2'}
                  onChange={(e) => updateConfig('branding.primaryColor', e.target.value)}
                  className="w-16 h-10"
                />
                <Input
                  value={config?.branding.primaryColor || '#1976d2'}
                  onChange={(e) => updateConfig('branding.primaryColor', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="secondaryColor">Secondary Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="secondaryColor"
                  type="color"
                  value={config?.branding.secondaryColor || '#424242'}
                  onChange={(e) => updateConfig('branding.secondaryColor', e.target.value)}
                  className="w-16 h-10"
                />
                <Input
                  value={config?.branding.secondaryColor || '#424242'}
                  onChange={(e) => updateConfig('branding.secondaryColor', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="accentColor">Accent Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="accentColor"
                  type="color"
                  value={config?.branding.accentColor || '#ff4081'}
                  onChange={(e) => updateConfig('branding.accentColor', e.target.value)}
                  className="w-16 h-10"
                />
                <Input
                  value={config?.branding.accentColor || '#ff4081'}
                  onChange={(e) => updateConfig('branding.accentColor', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="footerText">Footer Text</Label>
            <Textarea
              id="footerText"
              value={config?.branding.footerText || ''}
              onChange={(e) => updateConfig('branding.footerText', e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="customCSS">Custom CSS</Label>
            <Textarea
              id="customCSS"
              value={config?.branding.customCSS || ''}
              onChange={(e) => updateConfig('branding.customCSS', e.target.value)}
              rows={6}
              className="font-mono text-sm"
              placeholder="/* Add custom CSS styles here */"
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={() => saveConfiguration('branding', config?.branding)}
              disabled={saving}
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Branding
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderFeaturesTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Feature Toggles
          </CardTitle>
          <CardDescription>
            Enable or disable features for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(FEATURE_DESCRIPTIONS).map(([key, description]) => {
              const feature = config?.features.enabledFeatures.find(f => f.key === key);
              const enabled = feature?.enabled || false;
              const rollout = feature?.rolloutPercentage || 100;

              return (
                <Card key={key} className="border-2">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium capitalize">{key}</h4>
                        <p className="text-sm text-gray-600">{description}</p>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(checked) => updateFeatureToggle(key, checked, rollout)}
                      />
                    </div>
                    
                    {enabled && rollout < 100 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-sm">
                          <span>Rollout: {rollout}%</span>
                          <Badge variant="outline">Gradual Rollout</Badge>
                        </div>
                        <Progress value={rollout} className="mt-1" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resource Limits</CardTitle>
          <CardDescription>
            Current usage and limits for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{config?.features.maxUsers || 0}</div>
              <div className="text-sm text-gray-600">Max Users</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{config?.features.maxPlugins || 0}</div>
              <div className="text-sm text-gray-600">Max Plugins</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold">{config?.features.maxStorage || 0} GB</div>
              <div className="text-sm text-gray-600">Storage Limit</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderIntegrationsTab = () => (
    <div className="space-y-6">
      {/* GitHub Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub Integration
          </CardTitle>
          <CardDescription>
            Connect your GitHub organizations and repositories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable GitHub Integration</Label>
              <p className="text-sm text-gray-600">
                Allow users to import and manage GitHub repositories
              </p>
            </div>
            <Switch
              checked={config?.integrations.github.enabled || false}
              onCheckedChange={(checked) => 
                saveConfiguration('github', { enabled: checked })
              }
            />
          </div>

          {config?.integrations.github.enabled && (
            <div>
              <Label htmlFor="githubOrgs">Allowed Organizations</Label>
              <Input
                id="githubOrgs"
                placeholder="org1,org2,org3"
                value={config.integrations.github.orgWhitelist.join(',')}
                onChange={(e) => {
                  const orgs = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  saveConfiguration('github', { 
                    enabled: config.integrations.github.enabled,
                    orgWhitelist: orgs 
                  });
                }}
              />
              <p className="text-sm text-gray-500 mt-1">
                Comma-separated list of GitHub organization names
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Slack Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Slack className="h-5 w-5" />
            Slack Integration
          </CardTitle>
          <CardDescription>
            Connect Slack workspaces for notifications and collaboration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Slack Integration</Label>
              <p className="text-sm text-gray-600">
                Send notifications and updates to Slack channels
              </p>
            </div>
            <Switch
              checked={config?.integrations.slack.enabled || false}
              onCheckedChange={(checked) => 
                saveConfiguration('slack', { enabled: checked })
              }
            />
          </div>

          {config?.integrations.slack.enabled && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="slackWorkspaces">Workspaces</Label>
                <Input
                  id="slackWorkspaces"
                  placeholder="workspace1,workspace2"
                  value={config.integrations.slack.workspaces.join(',')}
                  onChange={(e) => {
                    const workspaces = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    saveConfiguration('slack', {
                      enabled: config.integrations.slack.enabled,
                      workspaces,
                      channels: config.integrations.slack.channels
                    });
                  }}
                />
              </div>

              <div>
                <Label htmlFor="slackChannels">Default Channels</Label>
                <Input
                  id="slackChannels"
                  placeholder="#general,#alerts"
                  value={config.integrations.slack.channels.join(',')}
                  onChange={(e) => {
                    const channels = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    saveConfiguration('slack', {
                      enabled: config.integrations.slack.enabled,
                      workspaces: config.integrations.slack.workspaces,
                      channels
                    });
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Jira Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Jira Integration
          </CardTitle>
          <CardDescription>
            Connect Jira projects for issue tracking and project management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Jira Integration</Label>
              <p className="text-sm text-gray-600">
                Link services to Jira projects and issues
              </p>
            </div>
            <Switch
              checked={config?.integrations.jira.enabled || false}
              onCheckedChange={(checked) => 
                saveConfiguration('jira', { enabled: checked })
              }
            />
          </div>

          {config?.integrations.jira.enabled && (
            <div>
              <Label htmlFor="jiraProjects">Project Keys</Label>
              <Input
                id="jiraProjects"
                placeholder="PROJ1,PROJ2,PROJ3"
                value={config.integrations.jira.projects.join(',')}
                onChange={(e) => {
                  const projects = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                  saveConfiguration('jira', {
                    enabled: config.integrations.jira.enabled,
                    projects
                  });
                }}
              />
              <p className="text-sm text-gray-500 mt-1">
                Comma-separated list of Jira project keys
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderAuthenticationTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Authentication Settings
          </CardTitle>
          <CardDescription>
            Configure authentication providers and security policies
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Single Sign-On (SSO)</Label>
                <p className="text-sm text-gray-600">Enable SSO authentication</p>
              </div>
              <Switch
                checked={config?.authentication.ssoEnabled || false}
                onCheckedChange={(checked) => updateConfig('authentication.ssoEnabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Multi-Factor Authentication</Label>
                <p className="text-sm text-gray-600">Require MFA for all users</p>
              </div>
              <Switch
                checked={config?.authentication.mfaRequired || false}
                onCheckedChange={(checked) => updateConfig('authentication.mfaRequired', checked)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
            <Input
              id="sessionTimeout"
              type="number"
              value={config?.authentication.sessionTimeout || 1440}
              onChange={(e) => updateConfig('authentication.sessionTimeout', parseInt(e.target.value))}
            />
          </div>

          <div>
            <h4 className="font-medium mb-2">Password Policy</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minLength">Minimum Length</Label>
                <Input
                  id="minLength"
                  type="number"
                  value={config?.authentication.passwordPolicy.minLength || 8}
                  onChange={(e) => updateConfig('authentication.passwordPolicy.minLength', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="flex items-center justify-between">
                <Label>Require Uppercase</Label>
                <Switch
                  checked={config?.authentication.passwordPolicy.requireUppercase || false}
                  onCheckedChange={(checked) => updateConfig('authentication.passwordPolicy.requireUppercase', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Require Numbers</Label>
                <Switch
                  checked={config?.authentication.passwordPolicy.requireNumbers || false}
                  onCheckedChange={(checked) => updateConfig('authentication.passwordPolicy.requireNumbers', checked)}
                />
              </div>
            </div>
          </div>

          <Button onClick={() => saveConfiguration()}>
            Save Authentication Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Tenant Configuration</h1>
          <p className="text-gray-600">
            Customize your organization's portal settings and features
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportConfiguration}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {unsavedChanges && (
            <Button onClick={() => saveConfiguration()} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save All Changes
            </Button>
          )}
        </div>
      </div>

      {unsavedChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-amber-600 mr-2" />
            <span className="text-amber-800">
              You have unsaved changes. Don't forget to save your configuration.
            </span>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Features
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Plug className="h-4 w-4" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="authentication" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Auth
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          {renderBrandingTab()}
        </TabsContent>

        <TabsContent value="features">
          {renderFeaturesTab()}
        </TabsContent>

        <TabsContent value="integrations">
          {renderIntegrationsTab()}
        </TabsContent>

        <TabsContent value="authentication">
          {renderAuthenticationTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
}