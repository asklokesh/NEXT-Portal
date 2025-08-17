/**
 * White-Label Configuration Component
 * 
 * Multi-tenant white-labeling system with:
 * - Custom branding and theming
 * - Domain white-labeling
 * - Feature toggles per partner
 * - Partner-specific pricing
 * - Isolated multi-tenancy
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Palette,
  Globe,
  Settings,
  Shield,
  Zap,
  Eye,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Monitor,
  Smartphone,
  Users,
  Database,
  HardDrive,
  Wifi,
  CreditCard
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface TenantConfig {
  branding: {
    brandName: string;
    logoUrl: string;
    faviconUrl?: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor?: string;
    fontFamily?: string;
    customCss?: string;
  };
  domain: {
    customDomain: string;
    sslCertificate?: string;
    dnsVerified: boolean;
  };
  features: {
    [key: string]: boolean;
  };
  modules: string[];
  plugins: string[];
  limits: {
    maxUsers: number;
    maxServices: number;
    maxStorage: number;
    maxBandwidth: number;
    maxApiCalls?: number;
  };
  email: {
    fromAddress?: string;
    replyTo?: string;
    templates?: any;
  };
  legal: {
    termsUrl?: string;
    privacyUrl?: string;
    supportEmail?: string;
    supportUrl?: string;
  };
  billing: {
    enabled: boolean;
    stripeAccountId?: string;
    pricingModel?: string;
  };
}

interface TenantUsage {
  users: { current: number; limit: number; percentage: number };
  services: { current: number; limit: number; percentage: number };
  storage: { current: number; limit: number; percentage: number };
  bandwidth: { current: number; limit: number; percentage: number };
  apiCalls: { current: number; limit: number; percentage: number };
}

const availableFeatures = [
  { key: 'service-catalog', label: 'Service Catalog', description: 'Core service discovery and management' },
  { key: 'template-marketplace', label: 'Template Marketplace', description: 'Scaffolding templates and generators' },
  { key: 'plugin-management', label: 'Plugin Management', description: 'Install and manage plugins' },
  { key: 'monitoring', label: 'Basic Monitoring', description: 'System health and metrics' },
  { key: 'cost-insights', label: 'Cost Insights', description: 'Cost tracking and optimization' },
  { key: 'advanced-analytics', label: 'Advanced Analytics', description: 'Deep insights and reporting' },
  { key: 'api-management', label: 'API Management', description: 'API gateway and documentation' },
  { key: 'sso-enterprise', label: 'Enterprise SSO', description: 'SAML, LDAP, and custom SSO' },
  { key: 'rbac-advanced', label: 'Advanced RBAC', description: 'Fine-grained permissions' },
  { key: 'audit-logging', label: 'Audit Logging', description: 'Comprehensive audit trails' },
  { key: 'white-labeling', label: 'White Labeling', description: 'Custom branding capabilities' },
  { key: 'multi-tenancy', label: 'Multi-Tenancy', description: 'Isolated tenant environments' }
];

const availableModules = [
  'catalog',
  'templates',
  'plugins',
  'monitoring',
  'docs',
  'search',
  'kubernetes',
  'techdocs',
  'api-docs',
  'cost-insights'
];

export const WhiteLabelConfig: React.FC = () => {
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingDns, setVerifyingDns] = useState(false);
  const [previewTheme, setPreviewTheme] = useState(false);
  const { toast } = useToast();

  const tenantId = 'current-tenant-id'; // This would come from auth/context

  const loadConfig = async () => {
    try {
      setLoading(true);
      
      const [configResponse, usageResponse] = await Promise.all([
        fetch(`/api/white-label/config/${tenantId}`),
        fetch(`/api/white-label/usage/${tenantId}`)
      ]);

      const configResult = await configResponse.json();
      const usageResult = await usageResponse.json();

      if (configResult.success) {
        setConfig(configResult.data);
      }

      if (usageResult.success) {
        setUsage(usageResult.data);
      }
    } catch (error: any) {
      toast({
        title: 'Loading Failed',
        description: error.message || 'Failed to load configuration.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);

      const response = await fetch(`/api/white-label/config/${tenantId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Configuration Saved',
          description: 'Your white-label configuration has been updated successfully.',
        });
        
        setConfig(result.data);
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save configuration.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const verifyDns = async () => {
    if (!config) return;

    try {
      setVerifyingDns(true);

      const response = await fetch(`/api/white-label/config/${tenantId}/verify-dns`, {
        method: 'POST'
      });

      const result = await response.json();

      if (result.success && result.data.verified) {
        toast({
          title: 'DNS Verified',
          description: 'Your custom domain has been verified successfully.',
        });
        
        setConfig(prev => prev ? {
          ...prev,
          domain: { ...prev.domain, dnsVerified: true }
        } : null);
      } else {
        toast({
          title: 'DNS Verification Failed',
          description: 'Please check your DNS configuration and try again.',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Failed to verify DNS.',
        variant: 'destructive'
      });
    } finally {
      setVerifyingDns(false);
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
  };

  const toggleFeature = (featureKey: string) => {
    if (!config) return;
    
    updateConfig(`features.${featureKey}`, !config.features[featureKey]);
  };

  const toggleModule = (module: string) => {
    if (!config) return;
    
    const modules = config.modules.includes(module)
      ? config.modules.filter(m => m !== module)
      : [...config.modules, module];
    
    updateConfig('modules', modules);
  };

  const generateThemeCSS = () => {
    if (!config) return '';
    
    const { branding } = config;
    
    return `
      :root {
        --brand-primary: ${branding.primaryColor};
        --brand-secondary: ${branding.secondaryColor};
        --brand-accent: ${branding.accentColor || branding.primaryColor};
        --brand-font-family: ${branding.fontFamily || 'Inter, sans-serif'};
      }

      .navbar-brand {
        color: var(--brand-primary) !important;
      }

      .btn-primary {
        background-color: var(--brand-primary);
        border-color: var(--brand-primary);
      }

      .btn-primary:hover {
        background-color: color-mix(in srgb, var(--brand-primary) 85%, black);
        border-color: color-mix(in srgb, var(--brand-primary) 85%, black);
      }

      body {
        font-family: var(--brand-font-family);
      }

      ${branding.customCss || ''}
    `;
  };

  useEffect(() => {
    loadConfig();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3 animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Configuration Not Found</h3>
        <p className="text-gray-600">
          White-label configuration could not be loaded.
        </p>
      </div>
    );
  }

  const UsageCard: React.FC<{ 
    title: string; 
    icon: React.ReactNode; 
    current: number; 
    limit: number; 
    percentage: number;
    unit?: string;
  }> = ({ title, icon, current, limit, percentage, unit = '' }) => (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {icon}
            <span className="font-medium">{title}</span>
          </div>
          <Badge 
            variant={percentage > 80 ? 'destructive' : percentage > 60 ? 'secondary' : 'outline'}
          >
            {percentage.toFixed(1)}%
          </Badge>
        </div>
        <Progress value={percentage} className="mb-2" />
        <div className="text-sm text-gray-600">
          {current.toLocaleString()}{unit} / {limit.toLocaleString()}{unit}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-2">White-Label Configuration</h1>
          <p className="text-gray-600">
            Customize your branded portal experience and manage tenant settings.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPreviewTheme(!previewTheme)}>
            <Eye className="h-4 w-4 mr-2" />
            {previewTheme ? 'Hide Preview' : 'Preview Theme'}
          </Button>
          <Button onClick={saveConfig} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Usage Overview */}
      {usage && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <UsageCard
            title="Users"
            icon={<Users className="h-4 w-4 text-blue-600" />}
            current={usage.users.current}
            limit={usage.users.limit}
            percentage={usage.users.percentage}
          />
          <UsageCard
            title="Services"
            icon={<Settings className="h-4 w-4 text-green-600" />}
            current={usage.services.current}
            limit={usage.services.limit}
            percentage={usage.services.percentage}
          />
          <UsageCard
            title="Storage"
            icon={<HardDrive className="h-4 w-4 text-purple-600" />}
            current={usage.storage.current}
            limit={usage.storage.limit}
            percentage={usage.storage.percentage}
            unit=" GB"
          />
          <UsageCard
            title="Bandwidth"
            icon={<Wifi className="h-4 w-4 text-orange-600" />}
            current={usage.bandwidth.current}
            limit={usage.bandwidth.limit}
            percentage={usage.bandwidth.percentage}
            unit=" GB"
          />
          <UsageCard
            title="API Calls"
            icon={<Database className="h-4 w-4 text-red-600" />}
            current={usage.apiCalls.current}
            limit={usage.apiCalls.limit}
            percentage={usage.apiCalls.percentage}
            unit="K"
          />
        </div>
      )}

      {/* Main Configuration Tabs */}
      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="domain">Domain</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="limits">Limits</TabsTrigger>
          <TabsTrigger value="legal">Legal</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Branding Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Brand Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Brand Name</label>
                  <Input
                    value={config.branding.brandName}
                    onChange={(e) => updateConfig('branding.brandName', e.target.value)}
                    placeholder="Your Company Name"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Logo URL</label>
                  <Input
                    value={config.branding.logoUrl}
                    onChange={(e) => updateConfig('branding.logoUrl', e.target.value)}
                    placeholder="https://your-domain.com/logo.png"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Favicon URL (Optional)</label>
                  <Input
                    value={config.branding.faviconUrl || ''}
                    onChange={(e) => updateConfig('branding.faviconUrl', e.target.value)}
                    placeholder="https://your-domain.com/favicon.ico"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Color Scheme */}
            <Card>
              <CardHeader>
                <CardTitle>Color Scheme</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Primary Color</label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config.branding.primaryColor}
                      onChange={(e) => updateConfig('branding.primaryColor', e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={config.branding.primaryColor}
                      onChange={(e) => updateConfig('branding.primaryColor', e.target.value)}
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Secondary Color</label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config.branding.secondaryColor}
                      onChange={(e) => updateConfig('branding.secondaryColor', e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={config.branding.secondaryColor}
                      onChange={(e) => updateConfig('branding.secondaryColor', e.target.value)}
                      placeholder="#6B7280"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Accent Color (Optional)</label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={config.branding.accentColor || config.branding.primaryColor}
                      onChange={(e) => updateConfig('branding.accentColor', e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={config.branding.accentColor || ''}
                      onChange={(e) => updateConfig('branding.accentColor', e.target.value)}
                      placeholder="#10B981"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Typography & Custom CSS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Typography</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <label className="text-sm font-medium mb-2 block">Font Family</label>
                  <Select
                    value={config.branding.fontFamily || 'Inter'}
                    onValueChange={(value) => updateConfig('branding.fontFamily', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inter">Inter</SelectItem>
                      <SelectItem value="Roboto">Roboto</SelectItem>
                      <SelectItem value="Open Sans">Open Sans</SelectItem>
                      <SelectItem value="Lato">Lato</SelectItem>
                      <SelectItem value="Montserrat">Montserrat</SelectItem>
                      <SelectItem value="Poppins">Poppins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custom CSS</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={config.branding.customCss || ''}
                  onChange={(e) => updateConfig('branding.customCss', e.target.value)}
                  placeholder="/* Custom CSS styles */&#10;.custom-class {&#10;  /* your styles */&#10;}"
                  rows={5}
                />
              </CardContent>
            </Card>
          </div>

          {/* Theme Preview */}
          {previewTheme && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Theme Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-6" style={{ 
                  fontFamily: config.branding.fontFamily || 'Inter, sans-serif',
                  '--primary-color': config.branding.primaryColor,
                  '--secondary-color': config.branding.secondaryColor
                } as any}>
                  <div className="flex items-center gap-3 mb-4">
                    <div 
                      className="w-10 h-10 rounded border flex items-center justify-center"
                      style={{ backgroundColor: config.branding.primaryColor, color: 'white' }}
                    >
                      Logo
                    </div>
                    <h2 className="text-xl font-bold" style={{ color: config.branding.primaryColor }}>
                      {config.branding.brandName}
                    </h2>
                  </div>
                  <div 
                    className="px-4 py-2 rounded text-white mb-3"
                    style={{ backgroundColor: config.branding.primaryColor }}
                  >
                    Primary Button
                  </div>
                  <div 
                    className="px-4 py-2 rounded border mb-3"
                    style={{ 
                      borderColor: config.branding.secondaryColor,
                      color: config.branding.secondaryColor
                    }}
                  >
                    Secondary Button
                  </div>
                  <p className="text-gray-600">
                    This is how your branding will appear across the platform.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="domain" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Custom Domain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Custom Domain</label>
                <Input
                  value={config.domain.customDomain}
                  onChange={(e) => updateConfig('domain.customDomain', e.target.value)}
                  placeholder="portal.your-company.com"
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">DNS Verification</span>
                    {config.domain.dnsVerified ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {config.domain.dnsVerified 
                      ? 'Your custom domain is verified and active.'
                      : 'Please verify your DNS configuration.'
                    }
                  </p>
                </div>
                <Button 
                  onClick={verifyDns} 
                  disabled={verifyingDns}
                  variant="outline"
                >
                  {verifyingDns ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify DNS'
                  )}
                </Button>
              </div>

              {!config.domain.dnsVerified && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>DNS Setup Required:</strong> Please add a CNAME record pointing 
                    <code className="mx-1 px-1 py-0.5 bg-gray-100 rounded">
                      {config.domain.customDomain}
                    </code> 
                    to <code className="mx-1 px-1 py-0.5 bg-gray-100 rounded">proxy.saas-idp.com</code>
                  </AlertDescription>
                </Alert>
              )}

              {config.domain.sslCertificate && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Shield className="h-4 w-4" />
                  SSL certificate is active and auto-renewing
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Feature Toggles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {availableFeatures.map((feature) => (
                    <div 
                      key={feature.key}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{feature.label}</div>
                        <div className="text-sm text-gray-600">{feature.description}</div>
                      </div>
                      <Switch
                        checked={config.features[feature.key] || false}
                        onCheckedChange={() => toggleFeature(feature.key)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Available Modules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {availableModules.map((module) => (
                    <div 
                      key={module}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        config.modules.includes(module)
                          ? 'border-blue-500 bg-blue-50 text-blue-900'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleModule(module)}
                    >
                      <div className="text-center">
                        <div className="font-medium capitalize">{module.replace('-', ' ')}</div>
                        {config.modules.includes(module) && (
                          <CheckCircle className="h-4 w-4 text-blue-600 mx-auto mt-1" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="limits" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Resource Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium mb-2 block">Maximum Users</label>
                  <Input
                    type="number"
                    value={config.limits.maxUsers}
                    onChange={(e) => updateConfig('limits.maxUsers', parseInt(e.target.value))}
                    min="1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Maximum Services</label>
                  <Input
                    type="number"
                    value={config.limits.maxServices}
                    onChange={(e) => updateConfig('limits.maxServices', parseInt(e.target.value))}
                    min="1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Storage Limit (GB)</label>
                  <Input
                    type="number"
                    value={config.limits.maxStorage}
                    onChange={(e) => updateConfig('limits.maxStorage', parseInt(e.target.value))}
                    min="1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Bandwidth Limit (GB/month)</label>
                  <Input
                    type="number"
                    value={config.limits.maxBandwidth}
                    onChange={(e) => updateConfig('limits.maxBandwidth', parseInt(e.target.value))}
                    min="1"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium mb-2 block">API Calls Limit (per month)</label>
                  <Input
                    type="number"
                    value={config.limits.maxApiCalls || 100000}
                    onChange={(e) => updateConfig('limits.maxApiCalls', parseInt(e.target.value))}
                    min="1000"
                  />
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Resource limits help ensure fair usage and optimal performance. 
                  Contact support to increase limits if needed.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legal" className="space-y-6">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Legal & Support</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Terms of Service URL</label>
                  <Input
                    value={config.legal.termsUrl || ''}
                    onChange={(e) => updateConfig('legal.termsUrl', e.target.value)}
                    placeholder="https://your-company.com/terms"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Privacy Policy URL</label>
                  <Input
                    value={config.legal.privacyUrl || ''}
                    onChange={(e) => updateConfig('legal.privacyUrl', e.target.value)}
                    placeholder="https://your-company.com/privacy"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Support Email</label>
                  <Input
                    type="email"
                    value={config.legal.supportEmail || ''}
                    onChange={(e) => updateConfig('legal.supportEmail', e.target.value)}
                    placeholder="support@your-company.com"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Support URL</label>
                  <Input
                    value={config.legal.supportUrl || ''}
                    onChange={(e) => updateConfig('legal.supportUrl', e.target.value)}
                    placeholder="https://your-company.com/support"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Billing Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Enable Billing</div>
                    <div className="text-sm text-gray-600">
                      Allow customers to manage their own billing
                    </div>
                  </div>
                  <Switch
                    checked={config.billing.enabled}
                    onCheckedChange={(checked) => updateConfig('billing.enabled', checked)}
                  />
                </div>

                {config.billing.enabled && (
                  <>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Stripe Account ID</label>
                      <Input
                        value={config.billing.stripeAccountId || ''}
                        onChange={(e) => updateConfig('billing.stripeAccountId', e.target.value)}
                        placeholder="acct_..."
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Pricing Model</label>
                      <Select
                        value={config.billing.pricingModel || ''}
                        onValueChange={(value) => updateConfig('billing.pricingModel', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select pricing model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="usage-based">Usage-Based</SelectItem>
                          <SelectItem value="seat-based">Seat-Based</SelectItem>
                          <SelectItem value="flat-rate">Flat Rate</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Generated Theme CSS (for development) */}
      {previewTheme && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Theme CSS</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-gray-100 p-4 rounded overflow-x-auto">
              {generateThemeCSS()}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};