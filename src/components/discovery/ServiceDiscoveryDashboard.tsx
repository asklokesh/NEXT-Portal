/**
 * Service Discovery Dashboard
 * 
 * React component providing a comprehensive UI for the automated service
 * discovery system. Includes configuration, monitoring, and service management.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  GitBranch,
  Globe,
  Layers,
  Play,
  Refresh,
  Search,
  Server,
  Settings,
  Shield,
  Zap,
  X,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Types
interface DiscoveredService {
  id: string;
  name: string;
  type: 'api' | 'web' | 'database' | 'queue' | 'microservice' | 'function' | 'storage' | 'other';
  source: string;
  confidence: number;
  discoveredAt: string;
  lastSeen: string;
  metadata: {
    description?: string;
    version?: string;
    repository?: {
      url: string;
      branch?: string;
    };
    deployment?: {
      environment: string;
      region?: string;
      cluster?: string;
    };
    [key: string]: any;
  };
  endpoints?: Array<{
    url: string;
    type: string;
    protocol: string;
    health?: 'healthy' | 'unhealthy' | 'unknown';
  }>;
  dependencies?: string[];
  owner?: {
    team?: string;
    individual?: string;
    email?: string;
  };
}

interface DiscoveryMetrics {
  totalServices: number;
  servicesBySource: Record<string, number>;
  servicesByType: Record<string, number>;
  averageConfidence: number;
  lastDiscoveryTime: string | null;
  discoveryDuration: number | null;
  healthStatus: {
    engine: boolean;
    sources: Record<string, boolean>;
  };
}

interface DiscoveryStatus {
  status: string;
  metrics: DiscoveryMetrics;
  health: {
    engine: boolean;
    sources: Record<string, boolean>;
  };
  timestamp: string;
}

export default function ServiceDiscoveryDashboard() {
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  const [services, setServices] = useState<DiscoveredService[]>([]);
  const [selectedService, setSelectedService] = useState<DiscoveredService | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load initial data
  useEffect(() => {
    loadStatus();
    loadServices();
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/discovery?action=status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setIsInitialized(data.status === 'running');
      } else if (response.status === 503) {
        setIsInitialized(false);
      }
    } catch (error) {
      console.error('Failed to load status:', error);
      setIsInitialized(false);
    }
  }, []);

  const loadServices = useCallback(async () => {
    try {
      const response = await fetch('/api/discovery?action=services');
      if (response.ok) {
        const data = await response.json();
        setServices(data.services || []);
      }
    } catch (error) {
      console.error('Failed to load services:', error);
    }
  }, []);

  const initializeDiscovery = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'initialize' }),
      });

      if (response.ok) {
        setIsInitialized(true);
        await loadStatus();
        await loadServices();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to initialize discovery system');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const triggerDiscovery = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discover' }),
      });

      if (response.ok) {
        const data = await response.json();
        await loadStatus();
        await loadServices();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to trigger discovery');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const stopDiscovery = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/discovery', {
        method: 'DELETE',
      });

      if (response.ok) {
        setIsInitialized(false);
        setStatus(null);
        setServices([]);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to stop discovery system');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getServiceTypeIcon = (type: string) => {
    switch (type) {
      case 'api': return <Zap className="h-4 w-4" />;
      case 'web': return <Globe className="h-4 w-4" />;
      case 'database': return <Database className="h-4 w-4" />;
      case 'microservice': return <Layers className="h-4 w-4" />;
      case 'function': return <Activity className="h-4 w-4" />;
      case 'storage': return <Server className="h-4 w-4" />;
      default: return <Server className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getHealthStatusIcon = (healthy: boolean) => {
    return healthy ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <AlertCircle className="h-4 w-4 text-red-500" />
    );
  };

  // Prepare chart data
  const serviceTypeData = status ? Object.entries(status.metrics.servicesByType).map(([type, count]) => ({
    type,
    count,
  })) : [];

  const serviceSourceData = status ? Object.entries(status.metrics.servicesBySource).map(([source, count]) => ({
    source,
    count,
  })) : [];

  const pieColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  if (!isInitialized) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Search className="h-6 w-6" />
              Service Discovery System
            </CardTitle>
            <CardDescription>
              Automated service discovery and registration platform
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <p className="text-muted-foreground">
              The discovery system is not initialized. Click below to start discovering services across your infrastructure.
            </p>
            
            <Button 
              onClick={initializeDiscovery}
              disabled={loading}
              size="lg"
              className="gap-2"
            >
              {loading ? (
                <Activity className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Initialize Discovery System
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Search className="h-8 w-8" />
            Service Discovery
          </h1>
          <p className="text-muted-foreground">
            Automated service discovery and registration across your infrastructure
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadStatus}
            disabled={loading}
            size="sm"
            className="gap-2"
          >
            <Refresh className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={triggerDiscovery}
            disabled={loading}
            size="sm"
            className="gap-2"
          >
            {loading ? (
              <Activity className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Discover Now
          </Button>
          <Button
            variant="destructive"
            onClick={stopDiscovery}
            disabled={loading}
            size="sm"
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Stop
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Status Overview */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Services</p>
                  <p className="text-2xl font-bold">{status.metrics.totalServices}</p>
                </div>
                <Server className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Confidence</p>
                  <p className="text-2xl font-bold">{(status.metrics.averageConfidence * 100).toFixed(1)}%</p>
                </div>
                <Shield className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Last Discovery</p>
                  <p className="text-sm font-medium">
                    {status.metrics.lastDiscoveryTime 
                      ? new Date(status.metrics.lastDiscoveryTime).toLocaleDateString()
                      : 'Never'
                    }
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Engine Status</p>
                  <div className="flex items-center gap-2">
                    {getHealthStatusIcon(status.health.engine)}
                    <span className="text-sm font-medium">
                      {status.health.engine ? 'Healthy' : 'Unhealthy'}
                    </span>
                  </div>
                </div>
                <Activity className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Services List */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Discovered Services</CardTitle>
                <CardDescription>
                  {services.length} services discovered across all sources
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted ${
                      selectedService?.id === service.id ? 'bg-muted border-primary' : ''
                    }`}
                    onClick={() => setSelectedService(service)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getServiceTypeIcon(service.type)}
                        <span className="font-medium">{service.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {service.source}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <div 
                            className={`h-2 w-8 rounded-full ${getConfidenceColor(service.confidence)}`}
                          />
                          <span className="text-xs text-muted-foreground">
                            {(service.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>{service.type}</span>
                      {service.metadata.deployment?.environment && (
                        <span>env: {service.metadata.deployment.environment}</span>
                      )}
                      {service.endpoints?.length && (
                        <span>{service.endpoints.length} endpoint(s)</span>
                      )}
                    </div>
                  </div>
                ))}
                {services.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No services discovered yet. Click "Discover Now" to start.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Service Details */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Service Details</CardTitle>
                <CardDescription>
                  {selectedService ? `Details for ${selectedService.name}` : 'Select a service to view details'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedService ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {getServiceTypeIcon(selectedService.type)}
                      <h3 className="text-lg font-semibold">{selectedService.name}</h3>
                      <Badge>{selectedService.type}</Badge>
                    </div>

                    {selectedService.metadata.description && (
                      <p className="text-sm text-muted-foreground">
                        {selectedService.metadata.description}
                      </p>
                    )}

                    <Separator />

                    <div className="space-y-2">
                      <h4 className="font-medium">Information</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">Source:</span>
                        <span>{selectedService.source}</span>
                        
                        <span className="text-muted-foreground">Confidence:</span>
                        <div className="flex items-center gap-2">
                          <Progress value={selectedService.confidence * 100} className="h-2 w-16" />
                          <span>{(selectedService.confidence * 100).toFixed(1)}%</span>
                        </div>

                        {selectedService.metadata.version && (
                          <>
                            <span className="text-muted-foreground">Version:</span>
                            <span>{selectedService.metadata.version}</span>
                          </>
                        )}

                        {selectedService.metadata.deployment?.environment && (
                          <>
                            <span className="text-muted-foreground">Environment:</span>
                            <span>{selectedService.metadata.deployment.environment}</span>
                          </>
                        )}

                        {selectedService.owner && (
                          <>
                            <span className="text-muted-foreground">Owner:</span>
                            <span>{selectedService.owner.team || selectedService.owner.individual || selectedService.owner.email}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {selectedService.endpoints && selectedService.endpoints.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <h4 className="font-medium">Endpoints</h4>
                          <div className="space-y-1">
                            {selectedService.endpoints.map((endpoint, index) => (
                              <div key={index} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {endpoint.type}
                                  </Badge>
                                  <span className="font-mono text-xs">{endpoint.url}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => window.open(endpoint.url, '_blank')}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {selectedService.repository && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <h4 className="font-medium">Repository</h4>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <GitBranch className="h-4 w-4" />
                              <span className="text-sm">{selectedService.repository.url}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => window.open(selectedService.repository!.url, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                          {selectedService.repository.branch && (
                            <div className="text-xs text-muted-foreground">
                              Branch: {selectedService.repository.branch}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground">
                    <div className="text-center">
                      <Eye className="h-8 w-8 mx-auto mb-2" />
                      <p>Select a service to view details</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Services by Type Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Services by Type</CardTitle>
                <CardDescription>Distribution of discovered service types</CardDescription>
              </CardHeader>
              <CardContent>
                {serviceTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={serviceTypeData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="type" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Services by Source Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Services by Source</CardTitle>
                <CardDescription>Distribution of discovery sources</CardDescription>
              </CardHeader>
              <CardContent>
                {serviceSourceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={serviceSourceData}
                        dataKey="count"
                        nameKey="source"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ source, count }) => `${source}: ${count}`}
                      >
                        {serviceSourceData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-48 text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sources Tab */}
        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Discovery Sources</CardTitle>
              <CardDescription>Status of all configured discovery sources</CardDescription>
            </CardHeader>
            <CardContent>
              {status?.health.sources ? (
                <div className="space-y-4">
                  {Object.entries(status.health.sources).map(([source, healthy]) => (
                    <div key={source} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getHealthStatusIcon(healthy)}
                        <div>
                          <p className="font-medium">{source}</p>
                          <p className="text-sm text-muted-foreground">
                            {status.metrics.servicesBySource[source] || 0} services discovered
                          </p>
                        </div>
                      </div>
                      <Badge variant={healthy ? "default" : "destructive"}>
                        {healthy ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No source information available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
              <CardDescription>Configure discovery system settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert>
                  <Settings className="h-4 w-4" />
                  <AlertTitle>Configuration</AlertTitle>
                  <AlertDescription>
                    Discovery system configuration is managed through the API and configuration files.
                    Advanced settings will be available in future updates.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-2">
                  <Button variant="outline" disabled>
                    <Settings className="h-4 w-4 mr-2" />
                    Configure Sources
                  </Button>
                  <Button variant="outline" disabled>
                    <Shield className="h-4 w-4 mr-2" />
                    Security Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}