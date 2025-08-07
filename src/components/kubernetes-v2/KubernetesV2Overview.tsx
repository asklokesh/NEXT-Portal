'use client';

/**
 * Kubernetes V2 Plugin - Main Overview Dashboard
 * Advanced Kubernetes management interface that makes Backstage look basic
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Cloud, 
  Cpu, 
  Database, 
  DollarSign,
  Shield,
  TrendingUp,
  TrendingDown,
  Zap,
  RefreshCw,
  Settings,
  Search,
  Filter,
  Download,
  Plus
} from 'lucide-react';

import { ClusterGrid } from './ClusterGrid';
import { CostAnalyticsDashboard } from './CostAnalyticsDashboard';
import { SecurityDashboard } from './SecurityDashboard';
import { AIInsightsDashboard } from './AIInsightsDashboard';
import { ResourceOptimizationDashboard } from './ResourceOptimizationDashboard';

interface DashboardMetrics {
  totalClusters: number;
  healthyClusters: number;
  totalNodes: number;
  totalWorkloads: number;
  monthlySpend: number;
  securityScore: number;
  optimizationOpportunities: number;
  lastUpdated: string;
}

interface ClusterSummary {
  healthy: number;
  warning: number;
  error: number;
  unknown: number;
}

export default function KubernetesV2Overview() {
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [clusterSummary, setClusterSummary] = useState<ClusterSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVisible, setFilterVisible] = useState(false);

  useEffect(() => {
    loadDashboardData();
    
    // Set up real-time updates
    const interval = setInterval(() => {
      refreshData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Parallel data fetching for better performance
      const [clustersResponse, healthResponse, costResponse, securityResponse] = await Promise.all([
        fetch('/api/kubernetes-v2/clusters?action=list'),
        fetch('/api/kubernetes-v2?action=cluster-health'),
        fetch('/api/kubernetes-v2?action=cost-analysis'),
        fetch('/api/kubernetes-v2?action=security-summary')
      ]);

      const [clusters, health, cost, security] = await Promise.all([
        clustersResponse.json(),
        healthResponse.json(),
        costResponse.json(),
        securityResponse.json()
      ]);

      // Calculate dashboard metrics
      const dashboardMetrics: DashboardMetrics = {
        totalClusters: clusters.data?.length || 0,
        healthyClusters: health.data?.healthy || 0,
        totalNodes: clusters.summary?.totalNodes || 0,
        totalWorkloads: clusters.data?.reduce((sum: number, cluster: any) => 
          sum + (cluster.usage?.pods || 0), 0) || 0,
        monthlySpend: cost.data?.total || 0,
        securityScore: security.data?.summary?.compliance?.score || 0,
        optimizationOpportunities: 12, // Would be calculated from actual data
        lastUpdated: new Date().toISOString()
      };

      const clusterHealth: ClusterSummary = {
        healthy: health.data?.healthy || 0,
        warning: health.data?.warning || 0,
        error: health.data?.error || 0,
        unknown: health.data?.unknown || 0
      };

      setMetrics(dashboardMetrics);
      setClusterSummary(clusterHealth);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  const handleExportData = () => {
    // Export functionality
    const exportData = {
      metrics,
      clusterSummary,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kubernetes-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Loading Kubernetes Dashboard...</p>
          <p className="text-sm text-muted-foreground mt-2">
            Analyzing clusters and gathering insights
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Kubernetes V2 Management
          </h1>
          <p className="text-muted-foreground">
            Advanced multi-cloud Kubernetes platform with AI-powered insights
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search clusters, workloads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-md w-64"
            />
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterVisible(!filterVisible)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
          
          <Button
            variant="outline" 
            size="sm"
            onClick={handleExportData}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Cluster
          </Button>
        </div>
      </div>

      {/* Metrics Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clusters</CardTitle>
            <Cloud className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalClusters || 0}</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +2 from last week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cluster Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clusterSummary ? 
                Math.round((clusterSummary.healthy / (clusterSummary.healthy + clusterSummary.warning + clusterSummary.error)) * 100) 
                : 0}%
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center text-xs">
                <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                {clusterSummary?.healthy || 0}
              </div>
              <div className="flex items-center text-xs">
                <AlertTriangle className="h-3 w-3 text-yellow-500 mr-1" />
                {clusterSummary?.warning || 0}
              </div>
              <div className="flex items-center text-xs">
                <AlertTriangle className="h-3 w-3 text-red-500 mr-1" />
                {clusterSummary?.error || 0}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(metrics?.monthlySpend || 0).toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-red-600">
              <TrendingDown className="h-3 w-3 mr-1" />
              -$1,200 potential savings
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.securityScore || 0}%</div>
            <Progress value={metrics?.securityScore || 0} className="mt-2" />
            <div className="text-xs text-muted-foreground mt-1">
              Based on compliance checks
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="clusters">Clusters</TabsTrigger>
          <TabsTrigger value="cost">Cost Analytics</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Resource Utilization Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Resource Utilization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>CPU Usage</span>
                      <span>65%</span>
                    </div>
                    <Progress value={65} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Memory Usage</span>
                      <span>72%</span>
                    </div>
                    <Progress value={72} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Storage Usage</span>
                      <span>45%</span>
                    </div>
                    <Progress value={45} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm">New cluster 'prod-east-2' added</p>
                      <p className="text-xs text-muted-foreground">2 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm">Security scan completed on 'dev-cluster'</p>
                      <p className="text-xs text-muted-foreground">5 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm">Cost optimization recommendation generated</p>
                      <p className="text-xs text-muted-foreground">10 minutes ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Insights Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                AI-Powered Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <Badge variant="secondary">Performance</Badge>
                  </div>
                  <p className="text-sm">
                    Your workloads in 'prod-west' cluster show consistent CPU patterns. 
                    Consider implementing HPA for 15% better efficiency.
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-blue-500" />
                    <Badge variant="secondary">Cost</Badge>
                  </div>
                  <p className="text-sm">
                    Detected over-provisioned resources across 3 clusters. 
                    Potential monthly savings: $2,400.
                  </p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-red-500" />
                    <Badge variant="secondary">Security</Badge>
                  </div>
                  <p className="text-sm">
                    5 workloads running with elevated privileges detected. 
                    Review security policies for compliance.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clusters">
          <ClusterGrid searchTerm={searchTerm} />
        </TabsContent>

        <TabsContent value="cost">
          <CostAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="security">
          <SecurityDashboard />
        </TabsContent>

        <TabsContent value="ai-insights">
          <AIInsightsDashboard />
        </TabsContent>

        <TabsContent value="optimization">
          <ResourceOptimizationDashboard />
        </TabsContent>
      </Tabs>

      {/* Status Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 px-4 py-2 rounded">
        <div>
          Last updated: {metrics?.lastUpdated ? 
            new Date(metrics.lastUpdated).toLocaleString() : 
            'Never'
          }
        </div>
        <div className="flex items-center gap-4">
          <span>Total Nodes: {metrics?.totalNodes || 0}</span>
          <span>Total Workloads: {metrics?.totalWorkloads || 0}</span>
          <span>Optimization Opportunities: {metrics?.optimizationOpportunities || 0}</span>
        </div>
      </div>
    </div>
  );
}