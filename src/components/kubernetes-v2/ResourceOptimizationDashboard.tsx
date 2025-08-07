'use client';

/**
 * Kubernetes V2 Plugin - Resource Optimization Dashboard
 * Advanced resource optimization and auto-scaling management
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Zap, 
  TrendingUp, 
  TrendingDown,
  Cpu,
  MemoryStick,
  HardDrive,
  Activity,
  Target,
  Settings,
  Play,
  Pause,
  RotateCcw,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  PieChart
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

export function ResourceOptimizationDashboard() {
  const [optimizationData, setOptimizationData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCluster, setSelectedCluster] = useState('all');

  useEffect(() => {
    loadOptimizationData();
  }, [selectedCluster]);

  const loadOptimizationData = async () => {
    try {
      setIsLoading(true);
      // In a real implementation, this would fetch data from the API
      // For now, we'll use mock data
      setOptimizationData({
        summary: {
          totalOptimizations: 15,
          potentialSavings: 3200,
          performanceImpact: 18,
          reliability: 94
        }
      });
    } catch (error) {
      console.error('Failed to load optimization data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Mock data for various optimization scenarios
  const mockResourceData = {
    utilizationTrends: Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      cpu: Math.random() * 50 + 25,
      memory: Math.random() * 40 + 30,
      network: Math.random() * 30 + 20
    })),
    
    rightsizingOpportunities: [
      {
        workload: 'web-frontend',
        cluster: 'prod-cluster-east',
        namespace: 'production',
        current: { cpu: '500m', memory: '1Gi' },
        recommended: { cpu: '200m', memory: '512Mi' },
        utilization: { cpu: 23, memory: 35 },
        savings: 240,
        confidence: 92
      },
      {
        workload: 'api-backend',
        cluster: 'prod-cluster-east',
        namespace: 'production',
        current: { cpu: '1', memory: '2Gi' },
        recommended: { cpu: '600m', memory: '1.5Gi' },
        utilization: { cpu: 45, memory: 58 },
        savings: 180,
        confidence: 87
      },
      {
        workload: 'batch-processor',
        cluster: 'staging-cluster',
        namespace: 'staging',
        current: { cpu: '2', memory: '4Gi' },
        recommended: { cpu: '1.5', memory: '3Gi' },
        utilization: { cpu: 38, memory: 42 },
        savings: 320,
        confidence: 94
      }
    ],

    scalingRecommendations: [
      {
        workload: 'payment-service',
        cluster: 'prod-cluster-east',
        type: 'HPA',
        current: { min: 2, max: 5, target: 70 },
        recommended: { min: 3, max: 12, target: 65 },
        rationale: 'Traffic patterns show consistent evening peaks',
        impact: { performance: 25, cost: -10, reliability: 30 }
      },
      {
        workload: 'image-processor',
        cluster: 'prod-cluster-west',
        type: 'VPA',
        current: { cpu: '500m', memory: '1Gi' },
        recommended: { cpu: '300m', memory: '1.5Gi' },
        rationale: 'Memory-intensive workload with low CPU usage',
        impact: { performance: 15, cost: 5, reliability: 10 }
      }
    ],

    autoScalingStatus: [
      {
        workload: 'web-frontend',
        cluster: 'prod-cluster-east',
        type: 'HPA',
        status: 'active',
        currentReplicas: 8,
        targetReplicas: 8,
        metrics: { cpu: 65, memory: 45 },
        lastScaled: '2023-10-15T14:30:00Z'
      },
      {
        workload: 'api-backend',
        cluster: 'prod-cluster-east',
        type: 'VPA',
        status: 'monitoring',
        currentReplicas: 5,
        targetReplicas: 5,
        metrics: { cpu: 42, memory: 78 },
        lastScaled: '2023-10-15T12:15:00Z'
      },
      {
        workload: 'data-processor',
        cluster: 'staging-cluster',
        type: 'HPA',
        status: 'disabled',
        currentReplicas: 3,
        targetReplicas: 3,
        metrics: { cpu: 25, memory: 35 },
        lastScaled: null
      }
    ]
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600';
      case 'monitoring':
        return 'text-blue-600';
      case 'disabled':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'secondary';
      case 'monitoring':
        return 'outline';
      case 'disabled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

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
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8" />
            Resource Optimization
          </h2>
          <p className="text-muted-foreground">
            AI-powered resource optimization and intelligent auto-scaling
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex border rounded-md">
            {['all', 'prod-cluster-east', 'staging-cluster'].map((cluster) => (
              <Button
                key={cluster}
                variant={selectedCluster === cluster ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedCluster(cluster)}
                className="rounded-none first:rounded-l-md last:rounded-r-md"
              >
                {cluster === 'all' ? 'All Clusters' : cluster}
              </Button>
            ))}
          </div>
          
          <Button variant="outline" size="sm" onClick={loadOptimizationData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button size="sm">
            <Target className="h-4 w-4 mr-2" />
            Optimize All
          </Button>
        </div>
      </div>

      {/* Optimization Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Optimization Opportunities</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">15</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +3 new this week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">$3,200</div>
            <div className="text-xs text-muted-foreground">
              Monthly cost reduction
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Gain</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">18%</div>
            <div className="text-xs text-muted-foreground">
              Average improvement
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-scaling Health</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94%</div>
            <Progress value={94} className="mt-2" />
            <div className="text-xs text-muted-foreground mt-1">
              System reliability
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rightsizing">Right-sizing</TabsTrigger>
          <TabsTrigger value="autoscaling">Auto-scaling</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Resource Utilization Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Resource Utilization Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={mockResourceData.utilizationTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${Math.round(Number(value))}%`, 'Utilization']} />
                    <Area type="monotone" dataKey="cpu" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="memory" stackId="1" stroke="#82ca9d" fill="#82ca9d" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="network" stackId="1" stroke="#ffc658" fill="#ffc658" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Optimization Impact */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Optimization Impact
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">CPU Efficiency</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">76% → 89%</div>
                      <div className="text-xs text-green-600">+13%</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MemoryStick className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Memory Efficiency</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">68% → 82%</div>
                      <div className="text-xs text-green-600">+14%</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">Storage Efficiency</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">58% → 71%</div>
                      <div className="text-xs text-green-600">+13%</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">Overall Performance</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">Good → Excellent</div>
                      <div className="text-xs text-green-600">+18%</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <Zap className="h-8 w-8 mx-auto mb-3 text-blue-500" />
                <h3 className="font-semibold mb-2">Auto-optimize Resources</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Apply AI-recommended optimizations automatically
                </p>
                <Button className="w-full">
                  <Play className="h-4 w-4 mr-2" />
                  Start Optimization
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <Settings className="h-8 w-8 mx-auto mb-3 text-green-500" />
                <h3 className="font-semibold mb-2">Configure Auto-scaling</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Set up intelligent horizontal and vertical scaling
                </p>
                <Button variant="outline" className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <BarChart3 className="h-8 w-8 mx-auto mb-3 text-purple-500" />
                <h3 className="font-semibold mb-2">Generate Report</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create detailed optimization and savings report
                </p>
                <Button variant="outline" className="w-full">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Generate
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rightsizing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Right-sizing Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockResourceData.rightsizingOpportunities.map((opportunity, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{opportunity.workload}</h3>
                        <p className="text-sm text-muted-foreground">
                          {opportunity.cluster} • {opportunity.namespace}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">
                          ${opportunity.savings}/mo
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {opportunity.confidence}% confidence
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Current Resources</h4>
                        <div className="bg-red-50 p-3 rounded">
                          <div className="flex justify-between text-sm">
                            <span>CPU:</span>
                            <span>{opportunity.current.cpu}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Memory:</span>
                            <span>{opportunity.current.memory}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Recommended Resources</h4>
                        <div className="bg-green-50 p-3 rounded">
                          <div className="flex justify-between text-sm">
                            <span>CPU:</span>
                            <span>{opportunity.recommended.cpu}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Memory:</span>
                            <span>{opportunity.recommended.memory}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>CPU Utilization</span>
                          <span>{opportunity.utilization.cpu}%</span>
                        </div>
                        <Progress value={opportunity.utilization.cpu} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Memory Utilization</span>
                          <span>{opportunity.utilization.memory}%</span>
                        </div>
                        <Progress value={opportunity.utilization.memory} className="h-2" />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Apply Optimization
                      </Button>
                      <Button size="sm" variant="outline">
                        <Settings className="h-3 w-3 mr-1" />
                        Customize
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
        </TabsContent>

        <TabsContent value="autoscaling" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Auto-scaling Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockResourceData.autoScalingStatus.map((scaling, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${
                        scaling.status === 'active' ? 'bg-green-100' :
                        scaling.status === 'monitoring' ? 'bg-blue-100' : 'bg-gray-100'
                      }`}>
                        {scaling.status === 'active' ? (
                          <Play className="h-4 w-4 text-green-600" />
                        ) : scaling.status === 'monitoring' ? (
                          <Activity className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Pause className="h-4 w-4 text-gray-600" />
                        )}
                      </div>
                      
                      <div>
                        <h3 className="font-semibold">{scaling.workload}</h3>
                        <p className="text-sm text-muted-foreground">
                          {scaling.cluster} • {scaling.type}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span>Replicas: {scaling.currentReplicas}/{scaling.targetReplicas}</span>
                          <span>CPU: {scaling.metrics.cpu}%</span>
                          <span>Memory: {scaling.metrics.memory}%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusBadge(scaling.status)}>
                        {scaling.status}
                      </Badge>
                      
                      <div className="flex gap-1">
                        {scaling.status === 'disabled' ? (
                          <Button size="sm" variant="outline">
                            <Play className="h-3 w-3 mr-1" />
                            Enable
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline">
                            <Pause className="h-3 w-3 mr-1" />
                            Pause
                          </Button>
                        )}
                        
                        <Button size="sm" variant="ghost">
                          <Settings className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Scaling Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Scaling Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockResourceData.scalingRecommendations.map((rec, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{rec.workload}</h3>
                        <p className="text-sm text-muted-foreground">{rec.cluster}</p>
                        <Badge variant="outline" className="mt-1">{rec.type}</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Badge variant={rec.impact.performance > 0 ? 'secondary' : 'destructive'}>
                          Performance: {rec.impact.performance > 0 ? '+' : ''}{rec.impact.performance}%
                        </Badge>
                        <Badge variant={rec.impact.cost < 0 ? 'secondary' : 'destructive'}>
                          Cost: {rec.impact.cost > 0 ? '+' : ''}{rec.impact.cost}%
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-3">{rec.rationale}</p>
                    
                    <div className="flex gap-2">
                      <Button size="sm">
                        Apply Configuration
                      </Button>
                      <Button size="sm" variant="outline">
                        Preview Changes
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">
                Advanced recommendations dashboard coming soon...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}