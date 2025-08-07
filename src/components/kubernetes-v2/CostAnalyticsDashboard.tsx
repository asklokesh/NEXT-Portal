'use client';

/**
 * Kubernetes V2 Plugin - Cost Analytics Dashboard
 * Advanced cost analysis and optimization recommendations
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  TrendingDown, 
  TrendingUp, 
  PieChart, 
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell } from 'recharts';

interface CostData {
  total: {
    daily: number;
    monthly: number;
    yearly: number;
  };
  breakdown: {
    compute: number;
    storage: number;
    network: number;
    other: number;
  };
  trends: Array<{
    date: string;
    cost: number;
  }>;
  savings: {
    potential: number;
    achieved: number;
  };
}

export function CostAnalyticsDashboard() {
  const [costData, setCostData] = useState<CostData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('30d');

  useEffect(() => {
    loadCostData();
  }, [selectedPeriod]);

  const loadCostData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/kubernetes-v2?action=cost-analysis');
      const data = await response.json();
      setCostData(data.data);
    } catch (error) {
      console.error('Failed to load cost data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  const pieData = costData ? [
    { name: 'Compute', value: costData.breakdown.compute },
    { name: 'Storage', value: costData.breakdown.storage },
    { name: 'Network', value: costData.breakdown.network },
    { name: 'Other', value: costData.breakdown.other }
  ] : [];

  const optimizationRecommendations = [
    {
      id: '1',
      type: 'rightsizing',
      title: 'Right-size over-provisioned workloads',
      description: 'Detected 15 workloads with consistently low resource utilization',
      potential: 2400,
      impact: 'high',
      effort: 'medium',
      automated: true
    },
    {
      id: '2',
      type: 'spot-instances',
      title: 'Use Spot instances for batch workloads',
      description: 'Identified 8 workloads suitable for Spot instance savings',
      potential: 1800,
      impact: 'high',
      effort: 'low',
      automated: false
    },
    {
      id: '3',
      type: 'storage-optimization',
      title: 'Optimize storage classes',
      description: 'Switch to more cost-effective storage classes where appropriate',
      potential: 600,
      impact: 'medium',
      effort: 'low',
      automated: true
    }
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-muted rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cost Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive cost analysis and optimization recommendations
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex border rounded-md">
            {['7d', '30d', '90d', '1y'].map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
                className="rounded-none first:rounded-l-md last:rounded-r-md"
              >
                {period}
              </Button>
            ))}
          </div>
          
          <Button variant="outline" size="sm" onClick={loadCostData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Cost Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${costData?.total.monthly.toLocaleString() || 0}
            </div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingDown className="h-3 w-3 mr-1" />
              -8% from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Average</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${costData?.total.daily.toLocaleString() || 0}
            </div>
            <div className="flex items-center text-xs text-red-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +3% from yesterday
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${costData?.savings.potential.toLocaleString() || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Available optimizations
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Savings Achieved</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${costData?.savings.achieved.toLocaleString() || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              This month
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={costData?.trends || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Cost']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="cost" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cost Breakdown Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Cost Contributors */}
          <Card>
            <CardHeader>
              <CardTitle>Top Cost Contributors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: 'prod-cluster-east', cost: 3200, change: 5 },
                  { name: 'staging-cluster-west', cost: 1800, change: -3 },
                  { name: 'dev-cluster-central', cost: 1200, change: 12 },
                  { name: 'test-cluster-south', cost: 800, change: -8 }
                ].map((cluster) => (
                  <div key={cluster.name} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">{cluster.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Kubernetes cluster
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${cluster.cost.toLocaleString()}/mo</p>
                      <div className={`flex items-center text-xs ${
                        cluster.change > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {cluster.change > 0 ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {Math.abs(cluster.change)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Optimization Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {optimizationRecommendations.map((rec) => (
                  <div key={rec.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{rec.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {rec.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          ${rec.potential.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          monthly savings
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant={rec.impact === 'high' ? 'destructive' : rec.impact === 'medium' ? 'secondary' : 'outline'}
                      >
                        {rec.impact} impact
                      </Badge>
                      <Badge variant="outline">
                        {rec.effort} effort
                      </Badge>
                      {rec.automated && (
                        <Badge variant="secondary">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Automated
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant={rec.automated ? 'default' : 'outline'}>
                        {rec.automated ? 'Apply Optimization' : 'View Details'}
                      </Button>
                      <Button size="sm" variant="ghost">
                        Dismiss
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Savings Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Potential</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  ${optimizationRecommendations.reduce((sum, rec) => sum + rec.potential, 0).toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">
                  {optimizationRecommendations.length} recommendations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Automated Savings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  ${optimizationRecommendations
                    .filter(rec => rec.automated)
                    .reduce((sum, rec) => sum + rec.potential, 0)
                    .toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">
                  Can be applied automatically
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">ROI Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2.3 months</div>
                <p className="text-sm text-muted-foreground">
                  Average payback period
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Additional tabs would be implemented similarly */}
        <TabsContent value="breakdown">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">
                Detailed cost breakdown coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">
                Advanced trend analysis coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}