'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Server, 
  Container, 
  Network, 
  Shield, 
  Settings, 
  Activity,
  RefreshCw,
  Search,
  Plus,
  ExternalLink,
  Globe,
  Cpu,
  HardDrive,
  MemoryStick
} from 'lucide-react';
import { kubernetesClient, KubernetesCluster } from '@/lib/kubernetes/client';
import { KubernetesOverview } from '@/components/kubernetes/KubernetesOverview';

export default function KubernetesPage() {
  const [clusters, setClusters] = useState<KubernetesCluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string>('');
  const [entityName, setEntityName] = useState<string>('');
  const [entityKind, setEntityKind] = useState<string>('Component');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clusterMetrics, setClusterMetrics] = useState<any[]>([]);

  const loadClusters = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const clustersData = await kubernetesClient.getClusters();
      setClusters(clustersData);
      
      if (clustersData.length > 0 && !selectedCluster) {
        setSelectedCluster(clustersData[0].name);
      }

      // Load cluster metrics for all clusters
      const metricsData = await Promise.all(
        clustersData.map(cluster => 
          kubernetesClient.getClusterMetrics(cluster.name)
            .catch(error => ({ cluster: cluster.name, error: error.message }))
        )
      );
      setClusterMetrics(metricsData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clusters');
      console.error('Failed to load clusters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClusters();
  }, []);

  const handleSearchEntity = () => {
    // This will trigger the KubernetesOverview component to reload with new entity
    if (entityName.trim()) {
      // The component will automatically reload when props change
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Kubernetes</h1>
          <p className="text-muted-foreground">
            Manage and monitor your Kubernetes clusters and workloads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={loadClusters} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading Kubernetes clusters...
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={loadClusters} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="workloads">Workloads</TabsTrigger>
            <TabsTrigger value="clusters">Clusters</TabsTrigger>
            <TabsTrigger value="search">Entity Search</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Server className="h-5 w-5" />
                    Clusters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">{clusters.length}</div>
                  <p className="text-sm text-muted-foreground">Total clusters configured</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Activity className="h-5 w-5" />
                    Healthy Nodes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2 text-green-600">
                    {clusterMetrics.reduce((total, metric) => 
                      total + (metric.nodes?.ready || 0), 0
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">Nodes in ready state</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Globe className="h-5 w-5" />
                    Total Nodes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {clusterMetrics.reduce((total, metric) => 
                      total + (metric.nodes?.total || 0), 0
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">All nodes across clusters</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Cluster Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {clusterMetrics.map((metric) => (
                    <div key={metric.cluster} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Server className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{metric.cluster}</p>
                          {metric.error ? (
                            <p className="text-sm text-red-600">Error: {metric.error}</p>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              {metric.nodes?.ready}/{metric.nodes?.total} nodes ready
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {metric.error ? (
                          <Badge variant="destructive">Error</Badge>
                        ) : (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            Healthy
                          </Badge>
                        )}
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workloads" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Entity Lookup</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Enter an entity name to view its Kubernetes workloads
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-4 mb-6">
                  <div className="flex-1">
                    <Label htmlFor="entity-name">Entity Name</Label>
                    <Input
                      id="entity-name"
                      placeholder="e.g., my-service, frontend, backend"
                      value={entityName}
                      onChange={(e) => setEntityName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchEntity()}
                    />
                  </div>
                  <div className="w-40">
                    <Label htmlFor="entity-kind">Entity Kind</Label>
                    <Select value={entityKind} onValueChange={setEntityKind}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Component">Component</SelectItem>
                        <SelectItem value="API">API</SelectItem>
                        <SelectItem value="Resource">Resource</SelectItem>
                        <SelectItem value="System">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleSearchEntity} disabled={!entityName.trim()}>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                </div>

                {entityName.trim() && (
                  <KubernetesOverview 
                    entityName={entityName.trim()} 
                    entityKind={entityKind}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clusters" className="mt-6">
            <div className="space-y-6">
              {clusters.map((cluster) => {
                const clusterMetric = clusterMetrics.find(m => m.cluster === cluster.name);
                
                return (
                  <Card key={cluster.name}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Server className="h-5 w-5" />
                            {cluster.title || cluster.name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Auth Provider: {cluster.authProvider}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{cluster.name}</Badge>
                          {cluster.dashboardUrl && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={cluster.dashboardUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {clusterMetric && !clusterMetric.error ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Nodes</p>
                              <p className="text-lg font-bold">
                                {clusterMetric.nodes?.ready}/{clusterMetric.nodes?.total}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Status</p>
                              <p className="text-sm text-green-600 font-medium">Healthy</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Network className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Provider</p>
                              <p className="text-sm font-medium">{cluster.authProvider}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Updated</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(clusterMetric.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-red-600">
                            {clusterMetric?.error || 'Unable to fetch cluster metrics'}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="search" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Entity Kubernetes Resources</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Search for Kubernetes resources associated with a specific entity
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <Label htmlFor="search-entity-name">Entity Name</Label>
                    <Input
                      id="search-entity-name"
                      placeholder="Enter entity name"
                      value={entityName}
                      onChange={(e) => setEntityName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="search-entity-kind">Entity Kind</Label>
                    <Select value={entityKind} onValueChange={setEntityKind}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Component">Component</SelectItem>
                        <SelectItem value="API">API</SelectItem>
                        <SelectItem value="Resource">Resource</SelectItem>
                        <SelectItem value="System">System</SelectItem>
                        <SelectItem value="User">User</SelectItem>
                        <SelectItem value="Group">Group</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="search-cluster">Cluster (Optional)</Label>
                    <Select value={selectedCluster} onValueChange={setSelectedCluster}>
                      <SelectTrigger>
                        <SelectValue placeholder="All clusters" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All clusters</SelectItem>
                        {clusters.map((cluster) => (
                          <SelectItem key={cluster.name} value={cluster.name}>
                            {cluster.title || cluster.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={handleSearchEntity} className="mb-6">
                  <Search className="h-4 w-4 mr-2" />
                  Search Resources
                </Button>

                {entityName.trim() && (
                  <KubernetesOverview 
                    entityName={entityName.trim()} 
                    entityKind={entityKind}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}