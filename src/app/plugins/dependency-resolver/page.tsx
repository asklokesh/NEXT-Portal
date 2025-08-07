'use client';

/**
 * Plugin Dependency Resolver Test Page
 * 
 * Demonstrates the comprehensive plugin dependency resolver and compatibility checker.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

import { 
  Package, 
  GitBranch, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Zap,
  Download,
  Clock,
  Info
} from 'lucide-react';

import DependencyGraph from '@/components/plugins/DependencyGraph';
import { Plugin } from '@/lib/plugins/types';

const mockPlugins: Plugin[] = [
  {
    id: '@backstage/plugin-catalog',
    name: 'Service Catalog',
    version: '1.15.0',
    description: 'Centralized service catalog for all your services, libraries, and resources',
    type: 'core',
    backstageVersion: '^1.15.0',
    dependencies: [
      { id: '@backstage/core-components', version: '0.14.4', versionConstraint: '^0.14.0' },
      { id: '@backstage/core-plugin-api', version: '1.8.2', versionConstraint: '^1.8.0' },
      { id: '@backstage/plugin-catalog-react', version: '1.9.3', versionConstraint: '^1.9.0' }
    ],
    requirements: {
      nodeVersion: '>=16.0.0',
      memory: 256,
      cpu: 1
    }
  },
  {
    id: '@backstage/plugin-scaffolder',
    name: 'Software Templates',
    version: '1.17.0',
    description: 'Software templates for creating new projects and components',
    type: 'core',
    backstageVersion: '^1.15.0',
    dependencies: [
      { id: '@backstage/core-components', version: '0.14.4', versionConstraint: '^0.14.0' },
      { id: '@backstage/plugin-catalog-react', version: '1.9.3', versionConstraint: '^1.9.0' },
      { id: '@backstage/core-plugin-api', version: '1.8.2', versionConstraint: '^1.8.0' }
    ],
    requirements: {
      nodeVersion: '>=16.0.0',
      memory: 512,
      cpu: 2
    }
  },
  {
    id: '@backstage/plugin-tech-radar',
    name: 'Tech Radar',
    version: '0.6.13',
    description: 'Technology radar for tracking technology adoption',
    type: 'frontend',
    backstageVersion: '^1.15.0',
    dependencies: [
      { id: '@backstage/core-components', version: '0.14.4', versionConstraint: '^0.14.0' },
      { id: '@backstage/core-plugin-api', version: '1.8.2', versionConstraint: '^1.8.0' },
      { id: 'd3', version: '7.8.5', versionConstraint: '^7.0.0' }
    ],
    requirements: {
      nodeVersion: '>=16.0.0',
      memory: 128,
      cpu: 1
    }
  },
  {
    id: '@backstage/plugin-kubernetes',
    name: 'Kubernetes',
    version: '0.11.7',
    description: 'Kubernetes integration for monitoring and managing clusters',
    type: 'backend',
    backstageVersion: '^1.15.0',
    dependencies: [
      { id: '@backstage/core-components', version: '0.14.4', versionConstraint: '^0.14.0' },
      { id: '@backstage/plugin-catalog-react', version: '1.9.3', versionConstraint: '^1.9.0' },
      { id: '@kubernetes/client-node', version: '0.19.0', versionConstraint: '^0.19.0' }
    ],
    requirements: {
      nodeVersion: '>=18.0.0',
      memory: 1024,
      cpu: 2
    }
  },
  {
    id: '@backstage/core-components',
    name: 'Core Components',
    version: '0.14.4',
    description: 'Core UI components for Backstage',
    type: 'core',
    backstageVersion: '^1.15.0',
    dependencies: [
      { id: '@backstage/core-plugin-api', version: '1.8.2', versionConstraint: '^1.8.0' }
    ],
    requirements: {
      nodeVersion: '>=16.0.0',
      memory: 64,
      cpu: 1
    }
  },
  {
    id: '@backstage/core-plugin-api',
    name: 'Core Plugin API',
    version: '1.8.2',
    description: 'Core API for Backstage plugins',
    type: 'core',
    backstageVersion: '^1.15.0',
    dependencies: [],
    requirements: {
      nodeVersion: '>=16.0.0',
      memory: 32,
      cpu: 1
    }
  },
  {
    id: '@backstage/plugin-catalog-react',
    name: 'Catalog React Components',
    version: '1.9.3',
    description: 'React components for catalog integration',
    type: 'frontend',
    backstageVersion: '^1.15.0',
    dependencies: [
      { id: '@backstage/core-components', version: '0.14.4', versionConstraint: '^0.14.0' },
      { id: '@backstage/core-plugin-api', version: '1.8.2', versionConstraint: '^1.8.0' }
    ],
    requirements: {
      nodeVersion: '>=16.0.0',
      memory: 128,
      cpu: 1
    }
  },
  // External dependencies
  {
    id: 'd3',
    name: 'D3.js',
    version: '7.8.5',
    description: 'Data visualization library',
    type: 'extension',
    dependencies: [],
    requirements: {
      nodeVersion: '>=14.0.0',
      memory: 64,
      cpu: 1
    }
  },
  {
    id: '@kubernetes/client-node',
    name: 'Kubernetes Client',
    version: '0.19.0',
    description: 'Official Kubernetes client for Node.js',
    type: 'extension',
    dependencies: [],
    requirements: {
      nodeVersion: '>=16.0.0',
      memory: 256,
      cpu: 1
    }
  }
];

interface ApiData {
  dependencies?: any;
  compatibility?: any;
  resolution?: any;
  loading: boolean;
  error: string | null;
}

export default function PluginDependencyResolverPage() {
  const [selectedPlugins, setSelectedPlugins] = useState<string[]>([
    '@backstage/plugin-catalog',
    '@backstage/plugin-scaffolder',
    '@backstage/plugin-tech-radar'
  ]);
  const [apiData, setApiData] = useState<ApiData>({
    loading: false,
    error: null
  });

  // Test dependency resolution
  const testDependencyResolution = async () => {
    setApiData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch('/api/plugins/dependencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plugins: mockPlugins,
          options: {
            strategy: 'strict',
            skipOptional: false,
            targetPlugins: selectedPlugins
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setApiData(prev => ({ ...prev, dependencies: result.data, loading: false }));
      } else {
        throw new Error(result.error || 'Failed to resolve dependencies');
      }
    } catch (error) {
      setApiData(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  };

  // Test compatibility checking
  const testCompatibilityChecking = async () => {
    setApiData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch('/api/plugins/compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plugins: mockPlugins.filter(p => selectedPlugins.includes(p.id)),
          systemInfo: {
            nodeVersion: '18.17.0',
            backstageVersion: '1.15.0',
            availableMemory: 8192,
            cpuCores: 8
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setApiData(prev => ({ ...prev, compatibility: result.data, loading: false }));
      } else {
        throw new Error(result.error || 'Failed to check compatibility');
      }
    } catch (error) {
      setApiData(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  };

  // Test comprehensive resolution
  const testComprehensiveResolution = async () => {
    setApiData(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch('/api/plugins/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plugins: mockPlugins,
          targetPlugins: selectedPlugins,
          options: {
            strategy: 'compatible',
            checkCompatibility: true,
            planUpgrades: true,
            skipOptional: false
          },
          systemInfo: {
            nodeVersion: '18.17.0',
            backstageVersion: '1.15.0',
            availableMemory: 8192,
            cpuCores: 8
          }
        })
      });
      
      const result = await response.json();
      if (result.success) {
        setApiData(prev => ({ ...prev, resolution: result.data, loading: false }));
      } else {
        throw new Error(result.error || 'Failed to resolve plugins');
      }
    } catch (error) {
      setApiData(prev => ({ 
        ...prev, 
        loading: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  };

  const togglePluginSelection = (pluginId: string) => {
    setSelectedPlugins(prev => 
      prev.includes(pluginId) 
        ? prev.filter(id => id !== pluginId)
        : [...prev, pluginId]
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plugin Dependency Resolver</h1>
          <p className="text-gray-600 mt-2">
            Comprehensive plugin dependency analysis, compatibility checking, and resolution system
          </p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {mockPlugins.length} plugins available
        </Badge>
      </div>

      {apiData.error && (
        <Alert className="border-red-300 bg-red-50">
          <XCircle className="w-4 h-4" />
          <AlertDescription className="text-red-800">
            {apiData.error}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Plugin Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Available Plugins
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockPlugins.map(plugin => (
              <div
                key={plugin.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedPlugins.includes(plugin.id)
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => togglePluginSelection(plugin.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{plugin.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {plugin.version}
                  </Badge>
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  {plugin.description}
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {plugin.type}
                  </Badge>
                  {plugin.dependencies && plugin.dependencies.length > 0 && (
                    <div className="flex items-center gap-1 text-gray-500">
                      <GitBranch className="w-3 h-3" />
                      <span className="text-xs">{plugin.dependencies.length} deps</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Test Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Test Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-gray-600 mb-2">
                Selected: {selectedPlugins.length} plugins
              </div>
              <div className="text-xs text-gray-500">
                {selectedPlugins.map(id => 
                  mockPlugins.find(p => p.id === id)?.name
                ).join(', ')}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Button
                onClick={testDependencyResolution}
                disabled={apiData.loading || selectedPlugins.length === 0}
                className="w-full flex items-center gap-2"
                variant="outline"
              >
                <GitBranch className="w-4 h-4" />
                Test Dependency Resolution
              </Button>

              <Button
                onClick={testCompatibilityChecking}
                disabled={apiData.loading || selectedPlugins.length === 0}
                className="w-full flex items-center gap-2"
                variant="outline"
              >
                <CheckCircle className="w-4 h-4" />
                Test Compatibility Check
              </Button>

              <Button
                onClick={testComprehensiveResolution}
                disabled={apiData.loading || selectedPlugins.length === 0}
                className="w-full flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                {apiData.loading ? 'Processing...' : 'Comprehensive Resolution'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-2xl font-bold text-blue-600">
                  {mockPlugins.filter(p => p.type === 'core').length}
                </div>
                <div className="text-xs text-gray-600">Core Plugins</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {mockPlugins.filter(p => p.type === 'frontend').length}
                </div>
                <div className="text-xs text-gray-600">Frontend</div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Node.js</span>
                <Badge variant="outline">18.17.0</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Backstage</span>
                <Badge variant="outline">1.15.0</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Memory</span>
                <Badge variant="outline">8GB</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="graph">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="graph">Dependency Graph</TabsTrigger>
              <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
              <TabsTrigger value="compatibility">Compatibility</TabsTrigger>
              <TabsTrigger value="resolution">Resolution</TabsTrigger>
            </TabsList>

            <TabsContent value="graph" className="mt-6">
              <div className="h-[600px] border rounded-lg">
                <DependencyGraph
                  plugins={mockPlugins.filter(p => selectedPlugins.includes(p.id))}
                  showConflicts={true}
                  interactive={true}
                  layout="hierarchical"
                />
              </div>
            </TabsContent>

            <TabsContent value="dependencies" className="mt-6">
              {apiData.dependencies ? (
                <div className="space-y-4">
                  {apiData.dependencies.resolution && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-gray-50 rounded">
                        <div className="text-2xl font-bold text-blue-600">
                          {apiData.dependencies.resolution.installationOrder?.length || 0}
                        </div>
                        <div className="text-sm text-gray-600">Installation Order</div>
                      </div>
                      <div className="text-center p-4 bg-gray-50 rounded">
                        <div className="text-2xl font-bold text-red-600">
                          {apiData.dependencies.resolution.conflicts?.length || 0}
                        </div>
                        <div className="text-sm text-gray-600">Conflicts</div>
                      </div>
                      <div className="text-center p-4 bg-gray-50 rounded">
                        <div className="text-2xl font-bold text-green-600">
                          {apiData.dependencies.resolution.performance?.resolutionTimeMs || 0}ms
                        </div>
                        <div className="text-sm text-gray-600">Resolution Time</div>
                      </div>
                    </div>
                  )}
                  <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto">
                    {JSON.stringify(apiData.dependencies, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Click "Test Dependency Resolution" to see results
                </div>
              )}
            </TabsContent>

            <TabsContent value="compatibility" className="mt-6">
              {apiData.compatibility ? (
                <div className="space-y-4">
                  {apiData.compatibility.summary && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded">
                        <div className="text-2xl font-bold text-green-600">
                          {apiData.compatibility.summary.compatible}
                        </div>
                        <div className="text-sm text-gray-600">Compatible</div>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 rounded">
                        <div className="text-2xl font-bold text-yellow-600">
                          {apiData.compatibility.summary.withIssues}
                        </div>
                        <div className="text-sm text-gray-600">With Issues</div>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded">
                        <div className="text-2xl font-bold text-red-600">
                          {apiData.compatibility.summary.criticalIssues}
                        </div>
                        <div className="text-sm text-gray-600">Critical Issues</div>
                      </div>
                    </div>
                  )}
                  <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto">
                    {JSON.stringify(apiData.compatibility, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Click "Test Compatibility Check" to see results
                </div>
              )}
            </TabsContent>

            <TabsContent value="resolution" className="mt-6">
              {apiData.resolution ? (
                <div className="space-y-4">
                  {apiData.resolution.recommendations && (
                    <div className="space-y-2">
                      <h3 className="font-medium">Recommendations</h3>
                      {apiData.resolution.recommendations.map((rec: any, index: number) => (
                        <Alert 
                          key={index}
                          className={`${
                            rec.type === 'error' ? 'border-red-300 bg-red-50' :
                            rec.type === 'warning' ? 'border-yellow-300 bg-yellow-50' :
                            rec.type === 'success' ? 'border-green-300 bg-green-50' :
                            'border-blue-300 bg-blue-50'
                          }`}
                        >
                          <Info className="w-4 h-4" />
                          <AlertDescription>
                            <div className="font-medium">{rec.title}</div>
                            <div className="text-sm mt-1">{rec.description}</div>
                            {rec.action && (
                              <div className="text-xs mt-2 text-gray-600">
                                Action: {rec.action}
                              </div>
                            )}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                  <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto">
                    {JSON.stringify(apiData.resolution, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Click "Comprehensive Resolution" to see results
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}