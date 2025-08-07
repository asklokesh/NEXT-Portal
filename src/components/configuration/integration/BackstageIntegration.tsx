'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { FileText, Download, Upload, GitBranch, Settings, Zap, AlertTriangle } from 'lucide-react';
import yaml from 'js-yaml';

import type { 
  ConfigurationSchema, 
  PluginConfigDiscovery,
  ConfigurationTemplate 
} from '../types/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBackstageApi } from '@/hooks/useBackstageApi';
import { SchemaToFormEngine } from '../engine/SchemaToFormEngine';

interface BackstageIntegrationProps {
  onSchemaGenerated?: (schema: ConfigurationSchema) => void;
  onValuesGenerated?: (values: Record<string, any>) => void;
  className?: string;
}

interface BackstageConfig {
  app: {
    title: string;
    baseUrl: string;
  };
  backend: {
    baseUrl: string;
    listen: {
      port: number;
    };
  };
  catalog: {
    rules: Array<{
      allow: string[];
    }>;
    locations: Array<{
      type: string;
      target: string;
    }>;
  };
  auth: {
    providers: Record<string, any>;
  };
  scaffolder: {
    actions: Record<string, any>;
  };
  plugins: Record<string, any>;
}

// Parse Backstage app-config.yaml to generate form schema
function parseBackstageConfig(configYaml: string): {
  schema: ConfigurationSchema;
  values: Record<string, any>;
  plugins: PluginConfigDiscovery[];
} {
  try {
    const config = yaml.load(configYaml) as BackstageConfig;
    
    // Generate schema based on common Backstage patterns
    const schema: ConfigurationSchema = {
      type: 'object',
      title: 'Backstage Configuration',
      description: 'Generated from app-config.yaml',
      properties: {
        app: {
          type: 'object',
          title: 'Application Settings',
          description: 'Basic application configuration',
          'x-form-config': {
            group: 'Application',
            order: 1,
          },
          properties: {
            title: {
              type: 'string',
              title: 'Application Title',
              description: 'The title shown in the UI',
              'x-form-config': {
                fieldType: 'text',
                placeholder: 'My Company Developer Portal',
              },
            },
            baseUrl: {
              type: 'string',
              format: 'uri',
              title: 'Base URL',
              description: 'The base URL for the frontend application',
              'x-form-config': {
                fieldType: 'url',
                placeholder: 'https://backstage.company.com',
              },
            },
          },
          required: ['title', 'baseUrl'],
        },
        backend: {
          type: 'object',
          title: 'Backend Configuration',
          description: 'Backend service configuration',
          'x-form-config': {
            group: 'Backend',
            order: 2,
          },
          properties: {
            baseUrl: {
              type: 'string',
              format: 'uri',
              title: 'Backend URL',
              description: 'The base URL for the backend API',
              'x-form-config': {
                fieldType: 'url',
                placeholder: 'https://backstage-api.company.com',
              },
            },
            listen: {
              type: 'object',
              title: 'Listen Configuration',
              properties: {
                port: {
                  type: 'number',
                  title: 'Port',
                  description: 'Port number for the backend service',
                  minimum: 1,
                  maximum: 65535,
                  'x-form-config': {
                    fieldType: 'number',
                    placeholder: '7007',
                  },
                },
              },
            },
          },
          required: ['baseUrl'],
        },
        catalog: {
          type: 'object',
          title: 'Catalog Configuration',
          description: 'Software catalog settings',
          'x-form-config': {
            group: 'Catalog',
            order: 3,
          },
          properties: {
            locations: {
              type: 'array',
              title: 'Catalog Locations',
              description: 'Sources for catalog entities',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    title: 'Type',
                    enum: ['url', 'file', 'github-discovery'],
                    'x-form-config': {
                      fieldType: 'select',
                    },
                  },
                  target: {
                    type: 'string',
                    title: 'Target',
                    description: 'URL or file path',
                    'x-form-config': {
                      fieldType: 'text',
                      placeholder: 'https://github.com/company/catalog/blob/main/catalog-info.yaml',
                    },
                  },
                },
                required: ['type', 'target'],
              },
              'x-form-config': {
                fieldType: 'array',
                minItems: 1,
              },
            },
          },
        },
        auth: {
          type: 'object',
          title: 'Authentication',
          description: 'Authentication provider configuration',
          'x-form-config': {
            group: 'Authentication',
            order: 4,
          },
          properties: {
            providers: {
              type: 'object',
              title: 'Auth Providers',
              'x-form-config': {
                fieldType: 'json',
              },
            },
          },
        },
      },
      required: ['app', 'backend'],
      'x-portal-config': {
        category: 'backstage',
        documentation: 'https://backstage.io/docs/conf/',
      },
    };

    // Extract current values
    const values: Record<string, any> = {
      app: config.app || {},
      backend: config.backend || {},
      catalog: config.catalog || {},
      auth: config.auth || {},
    };

    // Discover plugins from config
    const plugins: PluginConfigDiscovery[] = Object.keys(config.plugins || {}).map(pluginId => ({
      pluginId,
      name: pluginId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      version: '1.0.0',
      configPath: `plugins.${pluginId}`,
      defaultConfig: config.plugins[pluginId],
    }));

    return { schema, values, plugins };
  } catch (error) {
    throw new Error(`Failed to parse Backstage config: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Generate Scaffolder template parameters schema
function generateScaffolderParametersSchema(templateYaml: string): ConfigurationSchema {
  try {
    const template = yaml.load(templateYaml) as any;
    const parameters = template.spec?.parameters || [];
    
    if (!Array.isArray(parameters)) {
      throw new Error('Template parameters must be an array');
    }

    const properties: Record<string, any> = {};
    const required: string[] = [];

    parameters.forEach((param: any) => {
      if (param.properties) {
        Object.entries(param.properties).forEach(([key, prop]: [string, any]) => {
          properties[key] = {
            ...prop,
            'x-form-config': {
              fieldType: getScaffolderFieldType(prop),
              group: param.title || 'Parameters',
            },
          };

          if (param.required?.includes(key)) {
            required.push(key);
          }
        });
      }
    });

    return {
      type: 'object',
      title: template.metadata?.title || 'Template Parameters',
      description: template.metadata?.description,
      properties,
      required,
      'x-backstage-config': {
        templateParameter: true,
        scaffolderInput: true,
      },
    };
  } catch (error) {
    throw new Error(`Failed to parse Scaffolder template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Map Scaffolder field types to our field types
function getScaffolderFieldType(property: any): string {
  if (property['ui:field']) {
    const uiField = property['ui:field'];
    switch (uiField) {
      case 'EntityPicker': return 'entity-ref';
      case 'OwnerPicker': return 'owner';
      case 'RepoUrlPicker': return 'url';
      default: return 'text';
    }
  }

  if (property['ui:widget']) {
    const widget = property['ui:widget'];
    switch (widget) {
      case 'password': return 'password';
      case 'textarea': return 'textarea';
      case 'select': return 'select';
      case 'radio': return 'select';
      case 'checkboxes': return 'multiselect';
      default: return 'text';
    }
  }

  // Infer from JSON Schema type
  switch (property.type) {
    case 'string':
      if (property.format === 'email') return 'email';
      if (property.format === 'uri') return 'url';
      if (property.enum) return 'select';
      return 'text';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'multiselect';
    default:
      return 'text';
  }
}

export const BackstageIntegration: React.FC<BackstageIntegrationProps> = ({
  onSchemaGenerated,
  onValuesGenerated,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState('app-config');
  const [appConfigYaml, setAppConfigYaml] = useState('');
  const [templateYaml, setTemplateYaml] = useState('');
  const [discoveredPlugins, setDiscoveredPlugins] = useState<PluginConfigDiscovery[]>([]);
  const [generatedSchema, setGeneratedSchema] = useState<ConfigurationSchema | null>(null);
  const [generatedValues, setGeneratedValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { catalogApi, scaffolderApi } = useBackstageApi();

  // Load existing Backstage configuration
  useEffect(() => {
    const loadExistingConfig = async () => {
      try {
        // This would typically fetch from the Backstage backend
        const response = await fetch('/api/backstage/config');
        if (response.ok) {
          const config = await response.text();
          setAppConfigYaml(config);
        }
      } catch (err) {
        console.warn('Could not load existing Backstage config:', err);
      }
    };

    loadExistingConfig();
  }, []);

  // Parse app-config.yaml
  const handleParseAppConfig = useCallback(async () => {
    if (!appConfigYaml.trim()) {
      setError('Please provide a valid app-config.yaml');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { schema, values, plugins } = parseBackstageConfig(appConfigYaml);
      
      setGeneratedSchema(schema);
      setGeneratedValues(values);
      setDiscoveredPlugins(plugins);
      
      onSchemaGenerated?.(schema);
      onValuesGenerated?.(values);
      
      setActiveTab('form');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse configuration');
    } finally {
      setLoading(false);
    }
  }, [appConfigYaml, onSchemaGenerated, onValuesGenerated]);

  // Parse Scaffolder template
  const handleParseTemplate = useCallback(async () => {
    if (!templateYaml.trim()) {
      setError('Please provide a valid Scaffolder template');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const schema = generateScaffolderParametersSchema(templateYaml);
      
      setGeneratedSchema(schema);
      setGeneratedValues({});
      
      onSchemaGenerated?.(schema);
      onValuesGenerated?.({});
      
      setActiveTab('form');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse template');
    } finally {
      setLoading(false);
    }
  }, [templateYaml, onSchemaGenerated, onValuesGenerated]);

  // Load sample configurations
  const loadSampleAppConfig = useCallback(() => {
    const sampleConfig = `app:
  title: My Company Developer Portal
  baseUrl: https://backstage.company.com

backend:
  baseUrl: https://backstage-api.company.com
  listen:
    port: 7007

catalog:
  locations:
    - type: url
      target: https://github.com/company/catalog/blob/main/catalog-info.yaml
    - type: github-discovery
      target: https://github.com/company/*/catalog-info.yaml

auth:
  providers:
    github:
      development:
        clientId: \${GITHUB_CLIENT_ID}
        clientSecret: \${GITHUB_CLIENT_SECRET}
    google:
      development:
        clientId: \${GOOGLE_CLIENT_ID}
        clientSecret: \${GOOGLE_CLIENT_SECRET}

plugins:
  kubernetes:
    serviceLocatorMethod:
      type: multiTenant
    clusterLocatorMethods:
      - type: config
        clusters: []
  
  jenkins:
    baseUrl: https://jenkins.company.com
    username: \${JENKINS_USERNAME}
    apiKey: \${JENKINS_API_KEY}`;

    setAppConfigYaml(sampleConfig);
  }, []);

  const loadSampleTemplate = useCallback(() => {
    const sampleTemplate = `apiVersion: scaffolder.backstage.io/v1beta3
kind: Template
metadata:
  name: react-ssr-template
  title: React SSR Template
  description: Create a new React SSR website
  tags:
    - recommended
    - react
    - website
spec:
  owner: platform-team
  type: website
  
  parameters:
    - title: Fill in some steps
      required:
        - name
        - owner
      properties:
        name:
          title: Name
          type: string
          description: Unique name of the component
          ui:autofocus: true
          ui:options:
            rows: 5
        owner:
          title: Owner
          type: string
          description: Owner of the component
          ui:field: OwnerPicker
          ui:options:
            allowedKinds:
              - Group
        description:
          title: Description
          type: string
          description: Help others understand what this website is for.
    - title: Choose a location
      required:
        - repoUrl
      properties:
        repoUrl:
          title: Repository Location
          type: string
          ui:field: RepoUrlPicker
          ui:options:
            allowedHosts:
              - github.com`;

    setTemplateYaml(sampleTemplate);
  }, []);

  // Export generated configuration
  const exportConfiguration = useCallback((format: 'yaml' | 'json') => {
    if (!generatedSchema || !generatedValues) return;

    const data = {
      schema: generatedSchema,
      values: generatedValues,
      generatedAt: new Date().toISOString(),
    };

    let content: string;
    let filename: string;

    if (format === 'yaml') {
      content = yaml.dump(data);
      filename = 'backstage-config-form.yaml';
    } else {
      content = JSON.stringify(data, null, 2);
      filename = 'backstage-config-form.json';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [generatedSchema, generatedValues]);

  return (
    <div className={`backstage-integration space-y-6 ${className}`}>
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2">Backstage Integration</h2>
        <p className="text-muted-foreground">
          Generate configuration forms from existing Backstage configurations or templates
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="app-config" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            App Config
          </TabsTrigger>
          <TabsTrigger value="scaffolder" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Scaffolder
          </TabsTrigger>
          <TabsTrigger value="plugins" className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Plugins
          </TabsTrigger>
          <TabsTrigger value="form" className="flex items-center gap-2" disabled={!generatedSchema}>
            <FileText className="w-4 h-4" />
            Generated Form
          </TabsTrigger>
        </TabsList>

        {/* App Config Tab */}
        <TabsContent value="app-config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Parse Backstage app-config.yaml</CardTitle>
              <CardDescription>
                Upload or paste your existing app-config.yaml file to generate a configuration form
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="app-config">Configuration YAML</Label>
                  <Button variant="outline" size="sm" onClick={loadSampleAppConfig}>
                    Load Sample
                  </Button>
                </div>
                <Textarea
                  id="app-config"
                  placeholder="Paste your app-config.yaml content here..."
                  value={appConfigYaml}
                  onChange={(e) => setAppConfigYaml(e.target.value)}
                  className="font-mono text-sm min-h-[300px]"
                />
              </div>
              
              <div className="flex items-center gap-4">
                <Button onClick={handleParseAppConfig} disabled={loading || !appConfigYaml.trim()}>
                  {loading ? 'Parsing...' : 'Generate Form'}
                </Button>
                
                <div className="flex items-center gap-2">
                  <Label htmlFor="file-upload" className="cursor-pointer">
                    <Button variant="outline" asChild>
                      <span>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload File
                      </span>
                    </Button>
                  </Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".yaml,.yml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const content = event.target?.result as string;
                          setAppConfigYaml(content);
                        };
                        reader.readAsText(file);
                      }
                    }}
                    className="hidden"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scaffolder Tab */}
        <TabsContent value="scaffolder" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Parse Scaffolder Template</CardTitle>
              <CardDescription>
                Convert Scaffolder template parameters into an interactive form
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="template-yaml">Template YAML</Label>
                  <Button variant="outline" size="sm" onClick={loadSampleTemplate}>
                    Load Sample
                  </Button>
                </div>
                <Textarea
                  id="template-yaml"
                  placeholder="Paste your Scaffolder template YAML here..."
                  value={templateYaml}
                  onChange={(e) => setTemplateYaml(e.target.value)}
                  className="font-mono text-sm min-h-[300px]"
                />
              </div>
              
              <Button onClick={handleParseTemplate} disabled={loading || !templateYaml.trim()}>
                {loading ? 'Parsing...' : 'Generate Form'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Plugins Tab */}
        <TabsContent value="plugins" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Discovered Plugins</CardTitle>
              <CardDescription>
                Plugins found in your Backstage configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {discoveredPlugins.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Parse an app-config.yaml to discover plugins
                </div>
              ) : (
                <div className="space-y-3">
                  {discoveredPlugins.map((plugin) => (
                    <div key={plugin.pluginId} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{plugin.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {plugin.pluginId} • v{plugin.version}
                        </p>
                        {plugin.configPath && (
                          <p className="text-xs text-muted-foreground font-mono">
                            Config path: {plugin.configPath}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline">Plugin</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generated Form Tab */}
        <TabsContent value="form" className="space-y-4">
          {generatedSchema ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Generated Configuration Form</h3>
                  <p className="text-sm text-muted-foreground">
                    Interactive form based on your Backstage configuration
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportConfiguration('yaml')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export YAML
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportConfiguration('json')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export JSON
                  </Button>
                </div>
              </div>

              <Card>
                <CardContent className="p-6">
                  <SchemaToFormEngine
                    schema={generatedSchema}
                    initialValues={generatedValues}
                    onSubmit={(values) => {
                      console.log('Form submitted:', values);
                      onValuesGenerated?.(values);
                    }}
                    onChange={(values) => {
                      setGeneratedValues(values);
                      onValuesGenerated?.(values);
                    }}
                  />
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Generate a form from Backstage configuration or template first</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BackstageIntegration;