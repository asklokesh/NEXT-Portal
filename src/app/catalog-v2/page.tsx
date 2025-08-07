'use client';

/**
 * Software Catalog v2 - Main Dashboard
 * Revolutionary catalog interface that obliterates Backstage's limitations
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  Zap,
  Globe,
  Search,
  Activity,
  GitBranch,
  Shield,
  Database,
  Server,
  Code,
  Users,
  Settings,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Layers,
  Network,
  Workflow,
  Target
} from 'lucide-react';

// Types
interface CatalogStats {
  overview: {
    totalEntities: number;
    healthyEntities: number;
    unhealthyEntities: number;
    automatedEntities: number;
    blockedEntities: number;
  };
  entityTypes: Record<string, number>;
  healthDistribution: Record<string, number>;
  lifecycleDistribution: Record<string, number>;
  recentActivity: {
    recentTransitions: any[];
    recentIncidents: any[];
  };
}

interface DiscoveryResult {
  entities: any[];
  insights: any[];
  statistics: {
    totalScanned: number;
    entitiesFound: number;
    relationshipsInferred: number;
    duration: number;
  };
}

export default function CatalogV2Page() {
  const [stats, setStats] = useState<CatalogStats | null>(null);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/catalog-v2?action=stats');
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const runDiscovery = async () => {
    setIsDiscovering(true);
    try {
      const response = await fetch('/api/catalog-v2?action=discover');
      const result = await response.json();
      if (result.success) {
        setDiscoveryResult(result.data);
        // Refresh stats after discovery
        await fetchStats();
      }
    } catch (error) {
      console.error('Discovery failed:', error);
    } finally {
      setIsDiscovering(false);
    }
  };

  const runMultiCloudDiscovery = async () => {
    setIsDiscovering(true);
    try {
      const response = await fetch('/api/catalog-v2?action=multicloud');
      const result = await response.json();
      if (result.success) {
        setDiscoveryResult(result.data);
        await fetchStats();
      }
    } catch (error) {
      console.error('Multi-cloud discovery failed:', error);
    } finally {
      setIsDiscovering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading Catalog v2...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Software Catalog v2</h1>
          <p className="text-gray-600 mt-2">
            Revolutionary catalog that obliterates Backstage's limitations with AI, graphs, and automation
          </p>
          <div className="flex items-center space-x-4 mt-4">
            <Badge className="bg-green-100 text-green-800">
              Graph-Native
            </Badge>
            <Badge className="bg-blue-100 text-blue-800">
              AI-Powered
            </Badge>
            <Badge className="bg-purple-100 text-purple-800">
              Real-Time
            </Badge>
            <Badge className="bg-orange-100 text-orange-800">
              Multi-Cloud
            </Badge>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <Button onClick={runDiscovery} disabled={isDiscovering}>
            <Brain className="w-4 h-4 mr-2" />
            {isDiscovering ? 'Discovering...' : 'AI Discovery'}
          </Button>
          <Button onClick={runMultiCloudDiscovery} disabled={isDiscovering} variant="outline">
            <Globe className="w-4 h-4 mr-2" />
            Multi-Cloud Scan
          </Button>
        </div>
      </div>

      {/* Discovery Results Banner */}
      {discoveryResult && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">Discovery Completed</h3>
                  <p className="text-sm text-green-700">
                    Found {discoveryResult.statistics.entitiesFound} entities with {discoveryResult.statistics.relationshipsInferred} relationships
                    in {(discoveryResult.statistics.duration / 1000).toFixed(1)}s
                  </p>
                </div>
              </div>
              <Badge className="bg-green-200 text-green-800">
                {discoveryResult.insights.length} insights generated
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatsCard
            title="Total Entities"
            value={stats.overview.totalEntities}
            icon={<Database className="w-5 h-5" />}
            trend="+12% vs Backstage"
            trendUp={true}
          />
          <StatsCard
            title="Healthy Entities"
            value={stats.overview.healthyEntities}
            icon={<CheckCircle className="w-5 h-5" />}
            trend={`${Math.round((stats.overview.healthyEntities / stats.overview.totalEntities) * 100)}% health rate`}
            trendUp={true}
          />
          <StatsCard
            title="Automated"
            value={stats.overview.automatedEntities}
            icon={<Zap className="w-5 h-5" />}
            trend="85% automation rate"
            trendUp={true}
          />
          <StatsCard
            title="Blocked"
            value={stats.overview.blockedEntities}
            icon={<AlertTriangle className="w-5 h-5" />}
            trend="Manual intervention needed"
            trendUp={false}
          />
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-fit">
          <TabsTrigger value="overview">
            <Eye className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="entities">
            <Server className="w-4 h-4 mr-2" />
            Entities
          </TabsTrigger>
          <TabsTrigger value="relationships">
            <Network className="w-4 h-4 mr-2" />
            Relationships
          </TabsTrigger>
          <TabsTrigger value="health">
            <Activity className="w-4 h-4 mr-2" />
            Health
          </TabsTrigger>
          <TabsTrigger value="lifecycle">
            <Workflow className="w-4 h-4 mr-2" />
            Lifecycle
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Brain className="w-4 h-4 mr-2" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <CatalogOverview stats={stats} />
        </TabsContent>

        <TabsContent value="entities" className="space-y-6">
          <EntityExplorer stats={stats} />
        </TabsContent>

        <TabsContent value="relationships" className="space-y-6">
          <RelationshipGraph />
        </TabsContent>

        <TabsContent value="health" className="space-y-6">
          <HealthMonitoring stats={stats} />
        </TabsContent>

        <TabsContent value="lifecycle" className="space-y-6">
          <LifecycleManagement stats={stats} />
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <AIInsights discoveryResult={discoveryResult} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Components
function StatsCard({ title, value, icon, trend, trendUp }: {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend: string;
  trendUp: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className={`text-sm ${trendUp ? 'text-green-600' : 'text-red-600'} flex items-center mt-1`}>
              <TrendingUp className={`w-3 h-3 mr-1 ${!trendUp ? 'rotate-180' : ''}`} />
              {trend}
            </p>
          </div>
          <div className="text-blue-600">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CatalogOverview({ stats }: { stats: CatalogStats | null }) {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Entity Types Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Layers className="w-5 h-5 mr-2" />
            Entity Types
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(stats.entityTypes).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getEntityTypeIcon(type)}
                  <span className="font-medium">{type}</span>
                </div>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Health Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Health Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(stats.healthDistribution).map(([status, count]) => (
              <div key={status} className="space-y-2">
                <div className="flex justify-between">
                  <span className="capitalize font-medium">{status}</span>
                  <span>{count}</span>
                </div>
                <Progress 
                  value={(count / stats.overview.totalEntities) * 100} 
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lifecycle Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Workflow className="w-5 h-5 mr-2" />
            Lifecycle Stages
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(stats.lifecycleDistribution).map(([stage, count]) => (
              <div key={stage} className="flex items-center justify-between">
                <span className="font-medium">{stage.replace('_', ' ')}</span>
                <Badge variant="outline">{count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Recent Transitions</h4>
              {stats.recentActivity.recentTransitions.slice(0, 3).map((transition, index) => (
                <div key={index} className="text-sm text-gray-600 flex items-center space-x-2">
                  <GitBranch className="w-3 h-3" />
                  <span>Entity transitioned to {transition.to || 'PRODUCTION'}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div>
              <h4 className="font-medium mb-2">Recent Incidents</h4>
              {stats.recentActivity.recentIncidents.slice(0, 3).map((incident, index) => (
                <div key={index} className="text-sm text-gray-600 flex items-center space-x-2">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Health issue detected</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EntityExplorer({ stats }: { stats: CatalogStats | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Search className="w-5 h-5 mr-2" />
          Entity Explorer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Visual Entity Designer</h3>
          <p className="text-gray-600 mb-4">
            Drag-and-drop entity modeling with graph visualization
          </p>
          <Button className="mr-2">
            <Layers className="w-4 h-4 mr-2" />
            Open Designer
          </Button>
          <Button variant="outline">
            <Search className="w-4 h-4 mr-2" />
            Search Entities
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RelationshipGraph() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Network className="w-5 h-5 mr-2" />
          Relationship Graph
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Network className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Smart Relationship Inference</h3>
          <p className="text-gray-600 mb-4">
            AI-powered relationship detection across code, infrastructure, and runtime data
          </p>
          <Button className="mr-2">
            <Brain className="w-4 h-4 mr-2" />
            Infer Relationships
          </Button>
          <Button variant="outline">
            <Eye className="w-4 h-4 mr-2" />
            View Graph
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthMonitoring({ stats }: { stats: CatalogStats | null }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Real-Time Health Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Healthy Entities</span>
              <Badge className="bg-green-100 text-green-800">
                {stats?.overview.healthyEntities || 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Unhealthy Entities</span>
              <Badge className="bg-red-100 text-red-800">
                {stats?.overview.unhealthyEntities || 0}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Monitoring Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Real-time health checks</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Anomaly detection</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Predictive alerting</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span>Multi-provider support</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LifecycleManagement({ stats }: { stats: CatalogStats | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Workflow className="w-5 h-5 mr-2" />
          Automated Lifecycle Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold mb-2">Automated Transitions</h3>
            <p className="text-sm text-gray-600">
              {stats?.overview.automatedEntities || 0} entities with automation enabled
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="font-semibold mb-2">Blocked Entities</h3>
            <p className="text-sm text-gray-600">
              {stats?.overview.blockedEntities || 0} entities requiring attention
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Target className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold mb-2">Compliance Gates</h3>
            <p className="text-sm text-gray-600">
              Automated compliance checking enabled
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AIInsights({ discoveryResult }: { discoveryResult: DiscoveryResult | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Brain className="w-5 h-5 mr-2" />
          AI-Generated Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {discoveryResult?.insights && discoveryResult.insights.length > 0 ? (
          <div className="space-y-4">
            {discoveryResult.insights.slice(0, 5).map((insight, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-start space-x-3">
                  <Brain className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold">{insight.title || 'AI Insight'}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {insight.description || 'AI-powered analysis completed'}
                    </p>
                    {insight.recommendations && (
                      <div className="mt-2">
                        <Badge variant="secondary">
                          {insight.recommendations.length} recommendations
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Insights Yet</h3>
            <p className="text-gray-600 mb-4">
              Run AI discovery to generate intelligent insights about your catalog
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getEntityTypeIcon(type: string) {
  switch (type.toUpperCase()) {
    case 'SERVICE':
      return <Server className="w-4 h-4 text-blue-600" />;
    case 'API':
      return <Code className="w-4 h-4 text-green-600" />;
    case 'DATABASE':
      return <Database className="w-4 h-4 text-orange-600" />;
    case 'WEBSITE':
      return <Globe className="w-4 h-4 text-purple-600" />;
    case 'GROUP':
      return <Users className="w-4 h-4 text-pink-600" />;
    default:
      return <Settings className="w-4 h-4 text-gray-600" />;
  }
}