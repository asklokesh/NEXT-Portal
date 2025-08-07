'use client';

/**
 * Kubernetes V2 Plugin - AI Insights Dashboard
 * Advanced AI-powered analytics and recommendations
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Lightbulb,
  BarChart3,
  PieChart,
  RefreshCw,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Star
} from 'lucide-react';

export function AIInsightsDashboard() {
  const [insightsData, setInsightsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('insights');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    loadInsightsData();
  }, []);

  const loadInsightsData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/kubernetes-v2?action=ai-insights');
      const data = await response.json();
      setInsightsData(data.data);
    } catch (error) {
      console.error('Failed to load AI insights data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Mock AI insights data
  const mockInsights = [
    {
      id: '1',
      type: 'performance',
      confidence: 92,
      impact: 'high',
      title: 'Optimize Resource Allocation in Production Cluster',
      description: 'AI analysis shows consistent CPU patterns in prod-east cluster. Your workloads are averaging 35% CPU utilization with predictable daily peaks between 2-4 PM EST.',
      recommendation: 'Implement Horizontal Pod Autoscaler with target CPU utilization of 70%. This will improve resource efficiency by 28% and reduce costs by approximately $1,200/month.',
      category: 'optimization',
      clustersAffected: ['prod-cluster-east'],
      workloadsAffected: ['web-frontend', 'api-backend'],
      timestamp: '2023-10-15T10:30:00Z',
      status: 'new',
      automatable: true,
      metrics: {
        currentUtilization: 35,
        projectedUtilization: 70,
        costSavings: 1200,
        performanceGain: 28
      }
    },
    {
      id: '2',
      type: 'cost',
      confidence: 87,
      impact: 'high',
      title: 'Spot Instance Opportunity Detected',
      description: 'Machine learning analysis identified batch processing workloads in staging-west that are prime candidates for spot instances.',
      recommendation: 'Migrate 3 batch processing workloads to spot instances. This change has 97% historical uptime success rate and can reduce compute costs by 60-80%.',
      category: 'cost-optimization',
      clustersAffected: ['staging-cluster-west'],
      workloadsAffected: ['batch-processor', 'data-pipeline', 'report-generator'],
      timestamp: '2023-10-15T09:15:00Z',
      status: 'new',
      automatable: false,
      metrics: {
        potentialSavings: 2400,
        uptimeRisk: 3,
        migrationEffort: 'medium'
      }
    },
    {
      id: '3',
      type: 'security',
      confidence: 95,
      impact: 'critical',
      title: 'Anomalous Network Pattern Detected',
      description: 'AI anomaly detection identified unusual network traffic patterns in dev-cluster that deviate 340% from baseline.',
      recommendation: 'Immediate investigation required. Network traffic to external IPs increased dramatically. Review pod network policies and audit recent deployments.',
      category: 'security',
      clustersAffected: ['dev-cluster-central'],
      workloadsAffected: ['unknown'],
      timestamp: '2023-10-15T11:45:00Z',
      status: 'urgent',
      automatable: false,
      metrics: {
        deviationPercentage: 340,
        affectedPods: 12,
        suspiciousConnections: 8
      }
    },
    {
      id: '4',
      type: 'reliability',
      confidence: 89,
      impact: 'medium',
      title: 'Predictive Scaling Recommendation',
      description: 'Time series analysis predicts 45% traffic increase next week based on historical patterns and upcoming product launch.',
      recommendation: 'Pre-scale production workloads before anticipated traffic surge. Recommended configuration: increase min replicas from 3 to 5, max replicas from 10 to 15.',
      category: 'scaling',
      clustersAffected: ['prod-cluster-east', 'prod-cluster-west'],
      workloadsAffected: ['web-frontend', 'api-backend', 'payment-service'],
      timestamp: '2023-10-15T08:20:00Z',
      status: 'actionable',
      automatable: true,
      metrics: {
        trafficIncrease: 45,
        recommendedMinReplicas: 5,
        recommendedMaxReplicas: 15
      }
    }
  ];

  const mockAnomalies = [
    {
      id: 'anom-1',
      type: 'resource-spike',
      severity: 'high',
      description: 'CPU usage spike detected in prod-cluster-east',
      confidence: 94,
      timestamp: '2023-10-15T12:00:00Z',
      cluster: 'prod-cluster-east',
      workload: 'web-frontend',
      metric: 'cpu_usage',
      currentValue: 89,
      normalRange: '20-45%'
    },
    {
      id: 'anom-2',
      type: 'memory-leak',
      severity: 'medium',
      description: 'Gradual memory increase pattern detected',
      confidence: 78,
      timestamp: '2023-10-15T11:30:00Z',
      cluster: 'staging-cluster',
      workload: 'api-backend',
      metric: 'memory_usage',
      currentValue: 67,
      normalRange: '30-50%'
    }
  ];

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'performance':
        return <TrendingUp className="h-4 w-4" />;
      case 'cost':
        return <Target className="h-4 w-4" />;
      case 'security':
        return <AlertTriangle className="h-4 w-4" />;
      case 'reliability':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'destructive';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'urgent':
        return 'destructive';
      case 'new':
        return 'secondary';
      case 'actionable':
        return 'default';
      case 'implemented':
        return 'outline';
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
            <Brain className="h-8 w-8" />
            AI Insights Dashboard
          </h2>
          <p className="text-muted-foreground">
            Machine learning powered analytics and intelligent recommendations
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadInsightsData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button size="sm">
            <Zap className="h-4 w-4 mr-2" />
            Generate Insights
          </Button>
        </div>
      </div>

      {/* AI Insights Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Insights</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockInsights.length}</div>
            <div className="flex items-center text-xs text-green-600">
              <TrendingUp className="h-3 w-3 mr-1" />
              +3 new this week
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confidence Score</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89%</div>
            <Progress value={89} className="mt-2" />
            <div className="text-xs text-muted-foreground mt-1">
              Average accuracy
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Potential Savings</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">$3,600</div>
            <div className="text-xs text-muted-foreground">
              Monthly optimization value
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{mockAnomalies.length}</div>
            <div className="text-xs text-muted-foreground">
              Require attention
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="anomalies">Anomaly Detection</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="models">Model Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-6">
          {/* Filter Bar */}
          <div className="flex items-center gap-3">
            <div className="flex border rounded-md">
              {['all', 'performance', 'cost', 'security', 'reliability'].map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="rounded-none first:rounded-l-md last:rounded-r-md capitalize"
                >
                  {category === 'all' ? 'All' : category}
                </Button>
              ))}
            </div>
          </div>

          {/* Insights List */}
          <div className="space-y-4">
            {mockInsights
              .filter(insight => selectedCategory === 'all' || insight.type === selectedCategory)
              .map((insight) => (
                <Card key={insight.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            {getInsightIcon(insight.type)}
                            <h3 className="text-lg font-semibold">{insight.title}</h3>
                          </div>
                          <Badge variant={getImpactColor(insight.impact)}>
                            {insight.impact} impact
                          </Badge>
                          <Badge variant={getStatusColor(insight.status)}>
                            {insight.status}
                          </Badge>
                          {insight.automatable && (
                            <Badge variant="outline">
                              <Zap className="h-3 w-3 mr-1" />
                              Auto-apply
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-muted-foreground mb-3">
                          {insight.description}
                        </p>
                        
                        <div className="bg-blue-50 p-3 rounded-md mb-3">
                          <h4 className="font-medium text-sm mb-1">AI Recommendation:</h4>
                          <p className="text-sm">{insight.recommendation}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Confidence:</span>
                            <div className="flex items-center gap-1">
                              <span className="font-semibold">{insight.confidence}%</span>
                              <Progress value={insight.confidence} className="h-1 w-12" />
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Clusters:</span>
                            <span className="font-semibold ml-1">{insight.clustersAffected.length}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Workloads:</span>
                            <span className="font-semibold ml-1">{insight.workloadsAffected.length}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Generated:</span>
                            <span className="font-semibold ml-1">
                              {new Date(insight.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Metrics */}
                        {insight.metrics && (
                          <div className="mt-4 p-3 bg-gray-50 rounded-md">
                            <h4 className="font-medium text-sm mb-2">Key Metrics:</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                              {Object.entries(insight.metrics).map(([key, value]) => (
                                <div key={key}>
                                  <span className="text-muted-foreground capitalize">
                                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                                  </span>
                                  <span className="font-semibold ml-1">
                                    {typeof value === 'number' && key.includes('Savings') ? 
                                      `$${value.toLocaleString()}` : 
                                      typeof value === 'number' && key.includes('Percentage') ?
                                      `${value}%` :
                                      value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right text-xs text-muted-foreground">
                        {new Date(insight.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 pt-4 border-t">
                      <Button size="sm" variant="outline">
                        <Eye className="h-3 w-3 mr-1" />
                        View Details
                      </Button>
                      
                      {insight.automatable ? (
                        <Button size="sm">
                          <Zap className="h-3 w-3 mr-1" />
                          Apply Automatically
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline">
                          Create Task
                        </Button>
                      )}
                      
                      <div className="flex gap-1 ml-auto">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <ThumbsUp className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <ThumbsDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Anomaly Detection
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockAnomalies.map((anomaly) => (
                  <div key={anomaly.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <AlertTriangle className={`h-5 w-5 ${
                        anomaly.severity === 'high' ? 'text-red-500' : 
                        anomaly.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                      }`} />
                      <div>
                        <h3 className="font-semibold">{anomaly.description}</h3>
                        <p className="text-sm text-muted-foreground">
                          {anomaly.cluster} • {anomaly.workload} • {anomaly.metric}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Current: {anomaly.currentValue}% (Normal: {anomaly.normalRange})
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={anomaly.severity === 'high' ? 'destructive' : 'secondary'}>
                        {anomaly.confidence}% confidence
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(anomaly.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Resource Usage Predictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>CPU Usage (Next 24h)</span>
                    <div className="text-right">
                      <div className="font-semibold">Peak: 78%</div>
                      <div className="text-xs text-muted-foreground">14:00 - 16:00</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Memory Usage (Next 24h)</span>
                    <div className="text-right">
                      <div className="font-semibold">Peak: 65%</div>
                      <div className="text-xs text-muted-foreground">15:30 - 17:30</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Network I/O (Next 24h)</span>
                    <div className="text-right">
                      <div className="font-semibold">Peak: 2.3 GB/s</div>
                      <div className="text-xs text-muted-foreground">13:00 - 15:00</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Cost Predictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Next Month</span>
                    <div className="text-right">
                      <div className="font-semibold">$12,450</div>
                      <div className="text-xs text-green-600">-8% vs current</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Next Quarter</span>
                    <div className="text-right">
                      <div className="font-semibold">$36,200</div>
                      <div className="text-xs text-red-600">+12% vs projection</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Annual Projection</span>
                    <div className="text-right">
                      <div className="font-semibold">$142,800</div>
                      <div className="text-xs text-muted-foreground">95% confidence</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Resource Optimization', accuracy: 94, predictions: 1250 },
              { name: 'Anomaly Detection', accuracy: 87, predictions: 890 },
              { name: 'Cost Prediction', accuracy: 91, predictions: 450 }
            ].map((model) => (
              <Card key={model.name}>
                <CardHeader>
                  <CardTitle className="text-base">{model.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Accuracy</span>
                        <span>{model.accuracy}%</span>
                      </div>
                      <Progress value={model.accuracy} />
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Predictions made: </span>
                      <span className="font-semibold">{model.predictions}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}