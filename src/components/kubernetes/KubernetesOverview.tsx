'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Server, 
  Container, 
  Network, 
  Shield, 
  Settings, 
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { kubernetesClient, KubernetesWorkload, KubernetesResource, KubernetesCluster } from '@/lib/kubernetes/client';

interface KubernetesOverviewProps {
  entityName: string;
  entityKind?: string;
  entityNamespace?: string;
}

export function KubernetesOverview({ 
  entityName, 
  entityKind = 'Component',
  entityNamespace = 'default' 
}: KubernetesOverviewProps) {
  const [clusters, setClusters] = useState<KubernetesCluster[]>([]);
  const [workloads, setWorkloads] = useState<KubernetesWorkload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [clustersData, workloadsData] = await Promise.all([
        kubernetesClient.getClusters(),
        kubernetesClient.getWorkloadsByEntity(entityName, entityKind, entityNamespace)
      ]);

      setClusters(clustersData);
      setWorkloads(workloadsData);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Kubernetes data');
      console.error('Failed to load Kubernetes data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [entityName, entityKind, entityNamespace]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'warning': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const ResourceList = ({ resources, title, icon }: { 
    resources: KubernetesResource[]; 
    title: string; 
    icon: React.ReactNode 
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-auto">
            {resources.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {resources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No {title.toLowerCase()} found</p>
        ) : (
          <div className="space-y-2">
            {resources.map((resource, index) => (
              <div key={index} className="flex items-center justify-between p-2 rounded-lg border">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {getStatusIcon(resource.status)}
                    <span className="text-sm font-medium">{resource.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {resource.cluster}
                  </Badge>
                  {resource.namespace && (
                    <Badge variant="outline" className="text-xs">
                      {resource.namespace}
                    </Badge>
                  )}
                </div>
                <Badge className={`text-xs ${getStatusColor(resource.status)}`}>
                  {resource.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Kubernetes Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading Kubernetes data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Kubernetes Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Kubernetes Resources for {entityName}
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </span>
              <Button onClick={loadData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {clusters.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Available Clusters</h3>
              <div className="flex flex-wrap gap-2">
                {clusters.map((cluster) => (
                  <Badge key={cluster.name} variant="outline" className="text-xs">
                    {cluster.title || cluster.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator className="my-4" />

          {!workloads ? (
            <p className="text-muted-foreground">No workload data available</p>
          ) : (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="deployments">Deployments</TabsTrigger>
                <TabsTrigger value="pods">Pods</TabsTrigger>
                <TabsTrigger value="services">Services</TabsTrigger>
                <TabsTrigger value="ingresses">Ingresses</TabsTrigger>
                <TabsTrigger value="config">Config</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Deployments</p>
                          <p className="text-2xl font-bold">{workloads.deployments.length}</p>
                        </div>
                        <Container className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Pods</p>
                          <p className="text-2xl font-bold">{workloads.pods.length}</p>
                        </div>
                        <Activity className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Services</p>
                          <p className="text-2xl font-bold">{workloads.services.length}</p>
                        </div>
                        <Network className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Ingresses</p>
                          <p className="text-2xl font-bold">{workloads.ingresses.length}</p>
                        </div>
                        <Shield className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">ConfigMaps</p>
                          <p className="text-2xl font-bold">{workloads.configMaps.length}</p>
                        </div>
                        <Settings className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Secrets</p>
                          <p className="text-2xl font-bold">{workloads.secrets.length}</p>
                        </div>
                        <Shield className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="deployments" className="mt-4">
                <ResourceList 
                  resources={workloads.deployments} 
                  title="Deployments" 
                  icon={<Container className="h-4 w-4" />} 
                />
              </TabsContent>

              <TabsContent value="pods" className="mt-4">
                <ResourceList 
                  resources={workloads.pods} 
                  title="Pods" 
                  icon={<Activity className="h-4 w-4" />} 
                />
              </TabsContent>

              <TabsContent value="services" className="mt-4">
                <ResourceList 
                  resources={workloads.services} 
                  title="Services" 
                  icon={<Network className="h-4 w-4" />} 
                />
              </TabsContent>

              <TabsContent value="ingresses" className="mt-4">
                <ResourceList 
                  resources={workloads.ingresses} 
                  title="Ingresses" 
                  icon={<Shield className="h-4 w-4" />} 
                />
              </TabsContent>

              <TabsContent value="config" className="mt-4">
                <div className="space-y-4">
                  <ResourceList 
                    resources={workloads.configMaps} 
                    title="ConfigMaps" 
                    icon={<Settings className="h-4 w-4" />} 
                  />
                  <ResourceList 
                    resources={workloads.secrets} 
                    title="Secrets" 
                    icon={<Shield className="h-4 w-4" />} 
                  />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}