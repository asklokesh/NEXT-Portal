'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  Plus, 
  Eye, 
  Edit, 
  FileDown, 
  FileUp,
  Zap,
  Grid,
  List as ListIcon,
  Code,
  Wand2,
  Palette,
  GitBranch
} from 'lucide-react';

import MetadataFormBuilder from '@/components/catalog/MetadataFormBuilder';
import CustomMetadataEditor from '@/components/catalog/CustomMetadataEditor';
import { MetadataSchema } from '@/lib/metadata/MetadataSchemaManager';
import { useMetadataSchemas } from '@/hooks/useMetadata';

// Dynamic import for the new configuration form builder to avoid SSR issues
const ConfigurationFormBuilder = dynamic(
  () => import('@/components/configuration/ConfigurationFormBuilder'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }
);

// Demo data for entities
const DEMO_ENTITIES = [
  { id: 'service-1', name: 'User Authentication Service', kind: 'Component' },
  { id: 'service-2', name: 'Payment Processing API', kind: 'API' },
  { id: 'service-3', name: 'Database Cluster', kind: 'Resource' },
  { id: 'service-4', name: 'Message Queue', kind: 'Resource' },
  { id: 'service-5', name: 'Web Frontend', kind: 'Component' },
];

// Sample schema for demonstration
const SAMPLE_SCHEMA: Partial<MetadataSchema> = {
  name: 'Service Metadata',
  version: '1.0.0',
  description: 'Standard metadata fields for services',
  entityKind: 'Component',
  fields: [
    {
      id: 'field_1',
      name: 'owner',
      label: 'Service Owner',
      type: 'text',
      required: true,
      description: 'The team or person responsible for this service',
      placeholder: 'team-name or @username',
      position: { x: 0, y: 0, width: 6, height: 1 },
    },
    {
      id: 'field_2',
      name: 'environment',
      label: 'Environment',
      type: 'select',
      required: true,
      description: 'Deployment environment',
      options: [
        { label: 'Development', value: 'dev' },
        { label: 'Staging', value: 'staging' },
        { label: 'Production', value: 'prod' },
      ],
      position: { x: 6, y: 0, width: 6, height: 1 },
    },
    {
      id: 'field_3',
      name: 'criticality',
      label: 'Business Criticality',
      type: 'select',
      required: true,
      description: 'How critical is this service to business operations',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
        { label: 'Critical', value: 'critical' },
      ],
      position: { x: 0, y: 1, width: 6, height: 1 },
    },
    {
      id: 'field_4',
      name: 'sla_target',
      label: 'SLA Target (%)',
      type: 'number',
      description: 'Service level agreement uptime target',
      placeholder: '99.9',
      validation: [
        { type: 'min', value: 0, message: 'SLA cannot be negative' },
        { type: 'max', value: 100, message: 'SLA cannot exceed 100%' },
      ],
      position: { x: 6, y: 1, width: 6, height: 1 },
    },
    {
      id: 'field_5',
      name: 'monitoring_enabled',
      label: 'Monitoring Enabled',
      type: 'boolean',
      description: 'Whether monitoring is configured for this service',
      defaultValue: true,
      position: { x: 0, y: 2, width: 4, height: 1 },
    },
    {
      id: 'field_6',
      name: 'tags',
      label: 'Tags',
      type: 'multi-select',
      description: 'Service tags for categorization',
      options: [
        { label: 'API', value: 'api' },
        { label: 'Database', value: 'database' },
        { label: 'Frontend', value: 'frontend' },
        { label: 'Backend', value: 'backend' },
        { label: 'Microservice', value: 'microservice' },
        { label: 'Legacy', value: 'legacy' },
      ],
      position: { x: 4, y: 2, width: 8, height: 1 },
    },
    {
      id: 'field_7',
      name: 'contact_email',
      label: 'Contact Email',
      type: 'email',
      description: 'Primary contact email for this service',
      placeholder: 'team@company.com',
      validation: [
        { type: 'required', message: 'Contact email is required' },
      ],
      position: { x: 0, y: 3, width: 6, height: 1 },
    },
    {
      id: 'field_8',
      name: 'documentation_url',
      label: 'Documentation URL',
      type: 'url',
      description: 'Link to service documentation',
      placeholder: 'https://docs.company.com/service',
      position: { x: 6, y: 3, width: 6, height: 1 },
    },
  ],
};

export default function FormBuilderPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [currentSchema, setCurrentSchema] = useState<MetadataSchema | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<typeof DEMO_ENTITIES[0] | null>(null);
  const [editorMode, setEditorMode] = useState<'edit' | 'create' | 'bulk'>('create');
  
  const { schemas, createSchema, isLoading } = useMetadataSchemas();
  
  // New configuration form builder handlers
  const handleConfigSave = async (values: Record<string, any>) => {
    console.log('Configuration saved:', values);
    // Handle configuration save
  };

  const handleConfigExport = (format: 'json' | 'yaml' | 'typescript') => {
    console.log(`Exporting configuration as ${format}`);
    // Handle export logic
  };

  const handleSaveSchema = async (schema: MetadataSchema) => {
    setCurrentSchema(schema);
    // In a real app, this would save to the backend
    console.log('Schema saved:', schema);
  };

  const handleSaveMetadata = async (data: any, backstageYaml?: any) => {
    console.log('Metadata saved:', { data, backstageYaml });
    // In a real app, this would save to the backend
  };

  const loadSampleSchema = () => {
    const sampleSchema: MetadataSchema = {
      ...SAMPLE_SCHEMA,
      id: 'sample-schema',
      created: new Date(),
      updated: new Date(),
      createdBy: 'demo-user',
      active: true,
    } as MetadataSchema;
    
    setCurrentSchema(sampleSchema);
    setActiveTab('builder');
  };

  const openEditor = (entity: typeof DEMO_ENTITIES[0], mode: 'edit' | 'create' = 'edit') => {
    setSelectedEntity(entity);
    setEditorMode(mode);
    setActiveTab('editor');
  };

  const openBulkEditor = () => {
    setEditorMode('bulk');
    setActiveTab('editor');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuration Form Builder</h1>
          <p className="text-gray-600 mt-2">
            Transform JSON schemas and Backstage configurations into intuitive, accessible forms
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Badge variant="outline" className="px-3 py-1">
            <Zap className="h-4 w-4 mr-1" />
            Production Ready
          </Badge>
          <Button onClick={loadSampleSchema} variant="outline">
            <FileDown className="h-4 w-4 mr-2" />
            Load Sample
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="config-builder">Config Builder</TabsTrigger>
          <TabsTrigger value="builder">Form Builder</TabsTrigger>
          <TabsTrigger value="editor">Metadata Editor</TabsTrigger>
          <TabsTrigger value="schemas">Schemas</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* New Configuration Builder */}
            <Card className="border-primary bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Code className="h-5 w-5 mr-2" />
                  Configuration Builder
                  <Badge variant="secondary" className="ml-2">New</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Transform JSON schemas and Backstage configurations into sophisticated forms 
                  with 20+ field types, validation engine, and wizard workflows.
                </CardDescription>
                <Button 
                  className="mt-4 w-full" 
                  onClick={() => setActiveTab('config-builder')}
                >
                  <Wand2 className="h-4 w-4 mr-2" />
                  Open Config Builder
                </Button>
              </CardContent>
            </Card>
            
            {/* Feature Cards */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Grid className="h-5 w-5 mr-2" />
                  Visual Form Designer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Drag-and-drop interface for creating custom metadata forms with 9 field types,
                  validation rules, and conditional logic.
                </CardDescription>
                <Button 
                  className="mt-4 w-full" 
                  variant="outline"
                  onClick={() => setActiveTab('builder')}
                >
                  Open Form Builder
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Edit className="h-5 w-5 mr-2" />
                  Runtime Editor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Dynamic form rendering based on schemas with real-time validation,
                  bulk editing, and Backstage YAML generation.
                </CardDescription>
                <Button 
                  className="mt-4 w-full" 
                  variant="outline"
                  onClick={() => setActiveTab('editor')}
                >
                  Open Editor
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Schema Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Version control, migration support, import/export capabilities,
                  and analytics for your metadata schemas.
                </CardDescription>
                <Button 
                  className="mt-4 w-full" 
                  variant="outline"
                  onClick={() => setActiveTab('schemas')}
                >
                  Manage Schemas
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Features List */}
          <Card>
            <CardHeader>
              <CardTitle>Key Features</CardTitle>
              <CardDescription>Complete configuration-to-form conversion system for enterprise developer portals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <Code className="h-4 w-4 mr-2" />
                    Configuration Builder
                  </h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• 20+ advanced field types</li>
                    <li>• JSON Schema to form engine</li>
                    <li>• Backstage integration</li>
                    <li>• Multi-step wizard workflows</li>
                    <li>• Real-time validation engine</li>
                    <li>• Configuration versioning</li>
                    <li>• WCAG 2.1 AA accessibility</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <Palette className="h-4 w-4 mr-2" />
                    Visual Form Builder
                  </h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• 9 field types (text, number, boolean, etc.)</li>
                    <li>• Drag-and-drop field positioning</li>
                    <li>• Real-time form preview</li>
                    <li>• Validation rule configuration</li>
                    <li>• Conditional field visibility</li>
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <GitBranch className="h-4 w-4 mr-2" />
                    Enterprise Features
                  </h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• Dynamic form rendering</li>
                    <li>• Real-time collaboration</li>
                    <li>• Bulk metadata editing</li>
                    <li>• Configuration templates</li>
                    <li>• Environment management</li>
                    <li>• Performance monitoring</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sample Entities */}
          <Card>
            <CardHeader>
              <CardTitle>Demo Entities</CardTitle>
              <CardDescription>
                Try the metadata editor with these sample entities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {DEMO_ENTITIES.map(entity => (
                  <div key={entity.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{entity.name}</h4>
                      <p className="text-sm text-gray-500">{entity.kind}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openEditor(entity, 'create')}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Create
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => openEditor(entity, 'edit')}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
                
                <Separator className="my-4" />
                
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={openBulkEditor}
                >
                  <ListIcon className="h-4 w-4 mr-2" />
                  Bulk Edit All Entities
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Builder Tab */}
        <TabsContent value="config-builder" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Configuration Form Builder
                <Badge variant="secondary">Enterprise</Badge>
              </CardTitle>
              <CardDescription>
                Transform JSON schemas and Backstage configurations into intuitive, accessible forms 
                with advanced validation, real-time collaboration, and wizard workflows.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[800px] border-t border-border">
                <ConfigurationFormBuilder
                  onSave={handleConfigSave}
                  onExport={handleConfigExport}
                  showBackstageIntegration={true}
                  allowModeSwitch={true}
                  className="h-full"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Form Builder Tab */}
        <TabsContent value="builder" className="h-[calc(100vh-200px)]">
          <Card className="h-full">
            <MetadataFormBuilder
              schema={currentSchema || undefined}
              onSave={handleSaveSchema}
            />
          </Card>
        </TabsContent>

        {/* Metadata Editor Tab */}
        <TabsContent value="editor" className="h-[calc(100vh-200px)]">
          <Card className="h-full">
            {currentSchema ? (
              <CustomMetadataEditor
                entityId={selectedEntity?.id}
                entityName={selectedEntity?.name}
                entityKind={selectedEntity?.kind}
                schemaId={currentSchema.id}
                mode={editorMode}
                bulkEntities={editorMode === 'bulk' ? DEMO_ENTITIES : undefined}
                onSave={handleSaveMetadata}
                initialData={{
                  owner: 'platform-team',
                  environment: 'prod',
                  criticality: 'high',
                  sla_target: 99.9,
                  monitoring_enabled: true,
                  tags: ['api', 'backend'],
                  contact_email: 'platform@company.com',
                  documentation_url: 'https://docs.company.com/service',
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Schema Selected</h3>
                  <p className="text-gray-500 mb-4">
                    Create or load a schema to start editing metadata
                  </p>
                  <div className="flex items-center justify-center space-x-2">
                    <Button onClick={() => setActiveTab('builder')}>
                      Create Schema
                    </Button>
                    <Button variant="outline" onClick={loadSampleSchema}>
                      Load Sample
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Schemas Tab */}
        <TabsContent value="schemas" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Schema Management</h2>
            <div className="flex items-center space-x-2">
              <Button variant="outline">
                <FileUp className="h-4 w-4 mr-2" />
                Import Schema
              </Button>
              <Button onClick={() => setActiveTab('builder')}>
                <Plus className="h-4 w-4 mr-2" />
                New Schema
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Current Schema */}
            {currentSchema && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {currentSchema.name}
                    <Badge>Current</Badge>
                  </CardTitle>
                  <CardDescription>
                    Version {currentSchema.version} • {currentSchema.fields.length} fields
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    {currentSchema.description}
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button size="sm" onClick={() => setActiveTab('builder')}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline">
                      <FileDown className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sample Schema Option */}
            <Card>
              <CardHeader>
                <CardTitle>Sample Service Schema</CardTitle>
                <CardDescription>
                  Ready-to-use schema for service metadata
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Includes owner, environment, criticality, SLA targets, and more.
                  Perfect for getting started quickly.
                </p>
                <Button size="sm" onClick={loadSampleSchema}>
                  <Eye className="h-4 w-4 mr-1" />
                  Load Sample
                </Button>
              </CardContent>
            </Card>

            {/* Empty State for More Schemas */}
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-center h-full min-h-[200px]">
                <div className="text-center">
                  <Plus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Create your first schema</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Schema Analytics */}
          {currentSchema && (
            <Card>
              <CardHeader>
                <CardTitle>Schema Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {currentSchema.fields.length}
                    </div>
                    <p className="text-sm text-gray-500">Total Fields</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {currentSchema.fields.filter(f => f.required).length}
                    </div>
                    <p className="text-sm text-gray-500">Required Fields</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {new Set(currentSchema.fields.map(f => f.type)).size}
                    </div>
                    <p className="text-sm text-gray-500">Field Types Used</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}