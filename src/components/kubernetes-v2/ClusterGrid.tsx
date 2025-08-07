'use client';

/**
 * Kubernetes V2 Plugin - Cluster Grid Component
 * Advanced cluster visualization and management interface
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  MoreHorizontal, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Cloud, 
  Cpu, 
  Database, 
  DollarSign,
  Settings,
  Trash2,
  Eye,
  RefreshCw,
  Zap,
  Shield,
  TrendingUp,
  TrendingDown,
  MapPin,
  Calendar
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Cluster {
  id: string;
  name: string;
  displayName: string;
  provider: {
    type: 'aws' | 'gcp' | 'azure' | 'bare-metal';
    name: string;
    region: string;
  };
  environment: 'development' | 'staging' | 'production' | 'test';
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  capacity: {
    nodes: number;
    cpu: string;
    memory: string;
    pods: number;
  };
  usage: {
    cpu: number;
    memory: number;
    storage: number;
    pods: number;
  };
  cost: {
    daily: number;
    monthly: number;
    currency: string;
  };
  security: {
    complianceScore: number;
    vulnerabilityCount: number;
  };
  version: string;
  created: string;
  lastSeen: string;
  uptime: number;
}

interface ClusterGridProps {
  searchTerm?: string;
}

export function ClusterGrid({ searchTerm = '' }: ClusterGridProps) {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [filteredClusters, setFilteredClusters] = useState<Cluster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadClusters();
  }, []);

  useEffect(() => {
    // Filter clusters based on search term
    const filtered = clusters.filter(cluster => 
      cluster.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cluster.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cluster.provider.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cluster.environment.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredClusters(filtered);
  }, [clusters, searchTerm]);

  const loadClusters = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/kubernetes-v2/clusters?action=list');
      const data = await response.json();
      setClusters(data.data || []);
    } catch (error) {
      console.error('Failed to load clusters:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClusterAction = async (clusterId: string, action: string) => {
    console.log(`${action} action for cluster:`, clusterId);
    // Implementation would handle various cluster actions
    switch (action) {
      case 'view':
        const cluster = clusters.find(c => c.id === clusterId);
        setSelectedCluster(cluster || null);
        break;
      case 'scale':
        // Open scaling dialog
        break;
      case 'scan':
        // Trigger security scan
        break;
      case 'optimize':
        // Open optimization recommendations
        break;
      case 'delete':
        // Confirm and delete cluster
        if (confirm('Are you sure you want to remove this cluster?')) {
          await fetch(`/api/kubernetes-v2?clusterId=${clusterId}`, {
            method: 'DELETE'
          });
          loadClusters();
        }
        break;
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'aws':
        return '🟠'; // AWS orange
      case 'gcp':
        return '🔵'; // Google blue
      case 'azure':
        return '🔷'; // Azure blue
      default:
        return '⚫'; // Generic
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'warning':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getEnvironmentBadgeVariant = (env: string) => {
    switch (env) {
      case 'production':
        return 'destructive';
      case 'staging':
        return 'secondary';
      case 'development':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="h-3 bg-muted rounded w-full"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
                <div className="h-3 bg-muted rounded w-1/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cluster Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{filteredClusters.length}</p>
              </div>
              <Cloud className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Healthy</p>
                <p className="text-2xl font-bold text-green-600">
                  {filteredClusters.filter(c => c.status === 'healthy').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Nodes</p>
                <p className="text-2xl font-bold">
                  {filteredClusters.reduce((sum, c) => sum + c.capacity.nodes, 0)}
                </p>
              </div>
              <Database className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Cost</p>
                <p className="text-2xl font-bold">
                  ${filteredClusters.reduce((sum, c) => sum + c.cost.monthly, 0).toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cluster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClusters.map((cluster) => (
          <Card key={cluster.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getProviderIcon(cluster.provider.type)}</span>
                  <div>
                    <CardTitle className="text-lg">{cluster.displayName}</CardTitle>
                    <p className="text-sm text-muted-foreground">{cluster.name}</p>
                  </div>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleClusterAction(cluster.id, 'view')}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleClusterAction(cluster.id, 'scan')}>
                      <Shield className="h-4 w-4 mr-2" />
                      Security Scan
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleClusterAction(cluster.id, 'optimize')}>
                      <Zap className="h-4 w-4 mr-2" />
                      Optimize
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleClusterAction(cluster.id, 'scale')}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Scale
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleClusterAction(cluster.id, 'delete')}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <Badge variant={getEnvironmentBadgeVariant(cluster.environment)}>
                  {cluster.environment}
                </Badge>
                <Badge variant="outline">
                  v{cluster.version}
                </Badge>
                <div className="flex items-center gap-1">
                  {cluster.status === 'healthy' && <CheckCircle className="h-3 w-3 text-green-500" />}
                  {cluster.status === 'warning' && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
                  {cluster.status === 'error' && <AlertTriangle className="h-3 w-3 text-red-500" />}
                  <span className={`text-xs ${getStatusColor(cluster.status)}`}>
                    {cluster.status}
                  </span>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Resource Usage */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>CPU</span>
                  <span>{cluster.usage.cpu}%</span>
                </div>
                <Progress value={cluster.usage.cpu} className="h-2" />
                
                <div className="flex justify-between text-sm">
                  <span>Memory</span>
                  <span>{cluster.usage.memory}%</span>
                </div>
                <Progress value={cluster.usage.memory} className="h-2" />
              </div>

              {/* Cluster Stats */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Nodes</p>
                  <p className="font-semibold">{cluster.capacity.nodes}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pods</p>
                  <p className="font-semibold">{cluster.usage.pods}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Security Score</p>
                  <p className="font-semibold">{cluster.security.complianceScore}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Monthly Cost</p>
                  <p className="font-semibold">${cluster.cost.monthly.toLocaleString()}</p>
                </div>
              </div>

              {/* Location and Age */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {cluster.provider.region}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(cluster.created).toLocaleDateString()}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => handleClusterAction(cluster.id, 'view')}
                >
                  Details
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleClusterAction(cluster.id, 'scan')}
                >
                  <Shield className="h-3 w-3" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleClusterAction(cluster.id, 'optimize')}
                >
                  <Zap className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredClusters.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Cloud className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No clusters found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm ? 
                `No clusters match your search "${searchTerm}"` :
                'Get started by adding your first Kubernetes cluster'
              }
            </p>
            <Button>
              Add Cluster
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Cluster Details Dialog */}
      <Dialog open={!!selectedCluster} onOpenChange={() => setSelectedCluster(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-lg">{selectedCluster ? getProviderIcon(selectedCluster.provider.type) : ''}</span>
              {selectedCluster?.displayName}
            </DialogTitle>
          </DialogHeader>
          
          {selectedCluster && (
            <div className="space-y-6">
              {/* Cluster Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="font-semibold">{selectedCluster.provider.type.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Region</p>
                  <p className="font-semibold">{selectedCluster.provider.region}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Environment</p>
                  <Badge variant={getEnvironmentBadgeVariant(selectedCluster.environment)}>
                    {selectedCluster.environment}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Version</p>
                  <p className="font-semibold">v{selectedCluster.version}</p>
                </div>
              </div>

              {/* Resource Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Resource Usage</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>CPU</span>
                        <span>{selectedCluster.usage.cpu}%</span>
                      </div>
                      <Progress value={selectedCluster.usage.cpu} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Memory</span>
                        <span>{selectedCluster.usage.memory}%</span>
                      </div>
                      <Progress value={selectedCluster.usage.memory} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Storage</span>
                        <span>{selectedCluster.usage.storage}%</span>
                      </div>
                      <Progress value={selectedCluster.usage.storage} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Security & Compliance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Compliance Score</span>
                          <span>{selectedCluster.security.complianceScore}%</span>
                        </div>
                        <Progress value={selectedCluster.security.complianceScore} />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Vulnerabilities</span>
                        <Badge variant={selectedCluster.security.vulnerabilityCount > 0 ? 'destructive' : 'secondary'}>
                          {selectedCluster.security.vulnerabilityCount}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button onClick={() => handleClusterAction(selectedCluster.id, 'scan')}>
                  <Shield className="h-4 w-4 mr-2" />
                  Run Security Scan
                </Button>
                <Button variant="outline" onClick={() => handleClusterAction(selectedCluster.id, 'optimize')}>
                  <Zap className="h-4 w-4 mr-2" />
                  Optimize Resources
                </Button>
                <Button variant="outline" onClick={() => handleClusterAction(selectedCluster.id, 'scale')}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Scale Cluster
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}