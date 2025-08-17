'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Plus,
  Save,
  Play,
  Pause,
  Eye,
  EyeOff,
  Code,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Layers,
  Database,
  Cloud,
  Shield,
  Palette,
  Zap,
  Upload,
  Download,
  Copy,
  Trash2,
  Edit3,
  Monitor,
  Rocket
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface ConfigSchema {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  fields: number;
  templates: number;
  created: string;
}

interface ConfigInstance {
  id: string;
  schemaId: string;
  schemaName?: string;
  name: string;
  description?: string;
  status: 'draft' | 'valid' | 'invalid' | 'deployed' | 'deploying' | 'failed';
  valid: boolean;
  deployed: boolean;
  environment?: string;
  lastDeployed?: string;
  createdAt: string;
  updatedAt: string;
}

interface ConfigField {
  id: string;
  name: string;
  label: string;
  description: string;
  type: string;
  required: boolean;
  defaultValue?: any;
  constraints: any;
  validation: any;
  ui: any;
}

interface DetailedInstance {
  id: string;
  schemaId: string;
  schemaName?: string;
  name: string;
  description?: string;
  values: Record<string, any>;
  status: string;
  validation: {
    valid: boolean;
    errors: any[];
    warnings: any[];
  };
  deployment: any;
  metadata: any;
}

const CATEGORY_ICONS = {
  authentication: Shield,
  plugins: Layers,
  integrations: Database,
  monitoring: Monitor,
  security: Shield,
  deployment: Rocket,
  customization: Palette
};

const CATEGORY_COLORS = {
  authentication: 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  plugins: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  integrations: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
  monitoring: 'bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  security: 'bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
  deployment: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400',
  customization: 'bg-pink-100 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400'
};

const STATUS_COLORS = {
  draft: 'text-gray-600 bg-gray-100 dark:bg-gray-700/20',
  valid: 'text-green-600 bg-green-100 dark:bg-green-900/20',
  invalid: 'text-red-600 bg-red-100 dark:bg-red-900/20',
  deployed: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20',
  deploying: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20',
  failed: 'text-red-600 bg-red-100 dark:bg-red-900/20'
};

export default function VisualConfigBuilder() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'schemas' | 'instances'>('schemas');
  const [selectedSchema, setSelectedSchema] = useState<ConfigSchema | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<'schema' | 'instance'>('schema');

  // Fetch configuration summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['config-summary'],
    queryFn: async () => {
      const response = await fetch('/api/config/visual');
      if (!response.ok) throw new Error('Failed to fetch configuration summary');
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Fetch schemas
  const { data: schemasData, isLoading: schemasLoading } = useQuery({
    queryKey: ['config-schemas', selectedCategory],
    queryFn: async () => {
      const url = selectedCategory === 'all' 
        ? '/api/config/visual?type=schemas'
        : `/api/config/visual?type=schemas&category=${selectedCategory}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch schemas');
      return response.json();
    },
    enabled: viewMode === 'schemas',
  });

  // Fetch instances
  const { data: instancesData, isLoading: instancesLoading } = useQuery({
    queryKey: ['config-instances', selectedSchema?.id],
    queryFn: async () => {
      const url = selectedSchema?.id 
        ? `/api/config/visual?type=instances&schemaId=${selectedSchema.id}`
        : '/api/config/visual?type=instances';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch instances');
      return response.json();
    },
    enabled: viewMode === 'instances',
  });

  // Fetch detailed instance
  const { data: instanceDetailData } = useQuery({
    queryKey: ['config-instance-detail', selectedInstance],
    queryFn: async () => {
      if (!selectedInstance) return null;
      const response = await fetch(`/api/config/visual?type=instances&id=${selectedInstance}`);
      if (!response.ok) throw new Error('Failed to fetch instance details');
      return response.json();
    },
    enabled: !!selectedInstance,
  });

  // Create instance mutation
  const createInstanceMutation = useMutation({
    mutationFn: async ({ schemaId, name, description, values }: any) => {
      const response = await fetch('/api/config/visual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'instance',
          schemaId,
          name,
          description,
          values: values || {}
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create instance');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast.success('Configuration created successfully');
      queryClient.invalidateQueries({ queryKey: ['config-instances'] });
      setShowCreateModal(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to create configuration: ${error.message}`);
    },
  });

  // Deploy mutation
  const deployMutation = useMutation({
    mutationFn: async ({ instanceId, environment, dryRun }: any) => {
      const response = await fetch('/api/config/visual/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId,
          environment: environment || 'production',
          dryRun: dryRun || false
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to deploy configuration');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      if (variables.dryRun) {
        toast.success('Dry run completed successfully');
      } else {
        toast.success('Configuration deployed successfully');
        queryClient.invalidateQueries({ queryKey: ['config-instances'] });
      }
    },
    onError: (error: any) => {
      toast.error(`Deployment failed: ${error.message}`);
    },
  });

  const summary = summaryData?.summary;
  const schemas: ConfigSchema[] = schemasData?.schemas || [];
  const instances: ConfigInstance[] = instancesData?.instances || [];
  const instanceDetail: DetailedInstance = instanceDetailData?.instance;

  const categories = summary?.categories || [];

  const handleCreateInstance = (schemaId: string, schemaName: string) => {
    setSelectedSchema({ id: schemaId, name: schemaName } as ConfigSchema);
    setCreateType('instance');
    setShowCreateModal(true);
  };

  const handleDeployInstance = (instanceId: string, dryRun = false) => {
    deployMutation.mutate({ instanceId, dryRun });
  };

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Settings className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading configuration manager...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg flex items-center justify-center">
            <Settings className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Configuration Manager
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Zero-code visual configuration builder
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('schemas')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                viewMode === 'schemas'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Layers className="w-4 h-4 mr-2 inline" />
              Templates
            </button>
            <button
              onClick={() => setViewMode('instances')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                viewMode === 'instances'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <FileText className="w-4 h-4 mr-2 inline" />
              Configurations
            </button>
          </div>

          <button
            onClick={() => {
              setCreateType('schema');
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create {viewMode === 'schemas' ? 'Template' : 'Configuration'}
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {summary.totalSchemas}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Templates</div>
              </div>
              <Layers className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {summary.totalInstances}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Configurations</div>
              </div>
              <FileText className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {summary.deployedInstances}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Deployed</div>
              </div>
              <Cloud className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {categories.length}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Categories</div>
              </div>
              <Database className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>
      )}

      {/* Category Filter */}
      {viewMode === 'schemas' && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              selectedCategory === 'all'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All Categories
          </button>
          {categories.map((category: any) => {
            const IconComponent = CATEGORY_ICONS[category.category as keyof typeof CATEGORY_ICONS] || Database;
            return (
              <button
                key={category.category}
                onClick={() => setSelectedCategory(category.category)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  selectedCategory === category.category
                    ? CATEGORY_COLORS[category.category as keyof typeof CATEGORY_COLORS]
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                {category.category}
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-white dark:bg-gray-600 rounded">
                  {category.schemas}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {viewMode === 'schemas' ? (
        /* Schema Templates */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {schemasLoading ? (
            <div className="col-span-full text-center py-12">
              <Settings className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading templates...</p>
            </div>
          ) : (
            schemas.map((schema) => {
              const IconComponent = CATEGORY_ICONS[schema.category as keyof typeof CATEGORY_ICONS] || Database;
              return (
                <motion.div
                  key={schema.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        CATEGORY_COLORS[schema.category as keyof typeof CATEGORY_COLORS]
                      }`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          {schema.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          v{schema.version}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {schema.description}
                  </p>

                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                    <span>{schema.fields} fields</span>
                    <span>{schema.templates} templates</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCreateInstance(schema.id, schema.name)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create Config
                    </button>
                    <button className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      ) : (
        /* Configuration Instances */
        <div className="space-y-4">
          {instancesLoading ? (
            <div className="text-center py-12">
              <Settings className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Loading configurations...</p>
            </div>
          ) : (
            instances.map((instance) => (
              <motion.div
                key={instance.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 cursor-pointer hover:shadow-lg transition-all duration-200 ${
                  selectedInstance === instance.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedInstance(selectedInstance === instance.id ? null : instance.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {instance.valid ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[instance.status as keyof typeof STATUS_COLORS]
                      }`}>
                        {instance.status.toUpperCase()}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {instance.name}
                      </h3>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {instance.schemaName} • Updated {new Date(instance.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {instance.deployed && (
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <Cloud className="w-4 h-4" />
                        {instance.environment}
                      </div>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeployInstance(instance.id, true);
                      }}
                      disabled={!instance.valid || deployMutation.isPending}
                      className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Test Deploy
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeployInstance(instance.id, false);
                      }}
                      disabled={!instance.valid || deployMutation.isPending}
                      className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deployMutation.isPending ? 'Deploying...' : 'Deploy'}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {selectedInstance === instance.id && instanceDetail && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Configuration Values */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                            Configuration Values
                          </h4>
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                            <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-auto">
                              {JSON.stringify(instanceDetail.values, null, 2)}
                            </pre>
                          </div>
                        </div>

                        {/* Validation Results */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                            Validation Results
                          </h4>
                          <div className="space-y-2">
                            {instanceDetail.validation.errors.length > 0 && (
                              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                                <div className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                                  Errors ({instanceDetail.validation.errors.length})
                                </div>
                                {instanceDetail.validation.errors.map((error: any, index: number) => (
                                  <div key={index} className="text-xs text-red-600 dark:text-red-400">
                                    {error.message}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {instanceDetail.validation.warnings.length > 0 && (
                              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                                <div className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-2">
                                  Warnings ({instanceDetail.validation.warnings.length})
                                </div>
                                {instanceDetail.validation.warnings.map((warning: any, index: number) => (
                                  <div key={index} className="text-xs text-yellow-600 dark:text-yellow-400">
                                    {warning.message}
                                  </div>
                                ))}
                              </div>
                            )}

                            {instanceDetail.validation.errors.length === 0 && instanceDetail.validation.warnings.length === 0 && (
                              <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                                <div className="text-sm text-green-700 dark:text-green-300">
                                  ✓ Configuration is valid and ready for deployment
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Empty State */}
      {((viewMode === 'schemas' && schemas.length === 0) || (viewMode === 'instances' && instances.length === 0)) && !schemasLoading && !instancesLoading && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
            {viewMode === 'schemas' ? <Layers className="w-12 h-12" /> : <FileText className="w-12 h-12" />}
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No {viewMode === 'schemas' ? 'templates' : 'configurations'} found
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {viewMode === 'schemas' 
              ? 'Create your first configuration template to get started'
              : 'Create your first configuration from a template'
            }
          </p>
        </div>
      )}

      {/* Create Modal Placeholder */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md"
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Create New {createType === 'schema' ? 'Template' : 'Configuration'}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  This feature is coming soon! The visual configuration builder will allow you to create and manage configurations through an intuitive drag-and-drop interface.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}