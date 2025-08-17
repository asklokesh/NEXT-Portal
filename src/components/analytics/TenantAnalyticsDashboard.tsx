/**
 * Tenant Analytics Dashboard
 * Comprehensive analytics and insights interface for tenant administrators
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Database, 
  Activity, 
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info,
  Download,
  RefreshCw,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  Target,
  Zap,
  Shield,
  DollarSign
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface TenantAnalytics {
  tenantId: string;
  tenantName: string;
  tier: string;
  status: string;
  metrics: {
    usage: UsageMetrics;
    performance: PerformanceMetrics;
    business: BusinessMetrics;
    user: UserMetrics;
    plugin: PluginMetrics;
    integration: IntegrationMetrics;
  };
  trends: {
    usage: TrendData[];
    growth: GrowthMetrics;
    health: HealthMetrics;
  };
  insights: AnalyticsInsight[];
  recommendations: Recommendation[];
}

interface UsageMetrics {
  storage: { used: number; limit: number; percentage: number };
  apiCalls: { count: number; limit: number; percentage: number };
  bandwidth: { used: number; unit: string };
  requests: { total: number; successful: number; failed: number };
  uptime: { percentage: number; downtime: number };
}

interface PerformanceMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  throughput: number;
  availability: number;
  loadTime: number;
}

interface BusinessMetrics {
  monthlyRecurringRevenue: number;
  customerLifetimeValue: number;
  churnRisk: number;
  featureAdoption: Record<string, number>;
  supportTickets: { open: number; resolved: number; averageTime: number };
  nps: { score: number; responses: number };
}

interface UserMetrics {
  totalUsers: number;
  activeUsers: { daily: number; weekly: number; monthly: number };
  userGrowth: number;
  sessionDuration: number;
  loginFrequency: number;
  featureUsage: Record<string, number>;
}

interface PluginMetrics {
  totalPlugins: number;
  activePlugins: number;
  pluginHealth: Record<string, number>;
  installationRate: number;
  uninstallationRate: number;
  mostUsedPlugins: Array<{ name: string; usage: number }>;
}

interface IntegrationMetrics {
  activeIntegrations: number;
  integrationHealth: Record<string, 'HEALTHY' | 'WARNING' | 'ERROR'>;
  dataSync: { successful: number; failed: number };
  webhookDelivery: { successful: number; failed: number };
}

interface TrendData {
  timestamp: Date;
  value: number;
  change: number;
  changePercentage: number;
}

interface GrowthMetrics {
  userGrowthRate: number;
  revenueGrowthRate: number;
  featureAdoptionRate: number;
  retentionRate: number;
}

interface HealthMetrics {
  overallScore: number;
  availability: number;
  performance: number;
  userSatisfaction: number;
  securityScore: number;
}

interface AnalyticsInsight {
  id: string;
  type: 'OPPORTUNITY' | 'WARNING' | 'INFO' | 'CRITICAL';
  title: string;
  description: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  category: string;
  actionable: boolean;
  metadata: Record<string, any>;
}

interface Recommendation {
  id: string;
  type: 'UPGRADE' | 'OPTIMIZATION' | 'FEATURE' | 'SECURITY' | 'COST';
  title: string;
  description: string;
  estimatedImpact: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  implementationEffort: 'LOW' | 'MEDIUM' | 'HIGH';
  expectedBenefit: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const INSIGHT_ICONS = {
  OPPORTUNITY: TrendingUp,
  WARNING: AlertTriangle,
  INFO: Info,
  CRITICAL: AlertTriangle
};

const INSIGHT_COLORS = {
  OPPORTUNITY: 'text-green-600 bg-green-50 border-green-200',
  WARNING: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  INFO: 'text-blue-600 bg-blue-50 border-blue-200',
  CRITICAL: 'text-red-600 bg-red-50 border-red-200'
};

export default function TenantAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<TenantAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const response = await fetch(
        `/api/tenant/analytics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      const result = await response.json();

      if (result.success) {
        setAnalytics(result.data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load analytics data',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load analytics data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshAnalytics = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
    
    toast({
      title: 'Success',
      description: 'Analytics data refreshed'
    });
  };

  const exportAnalytics = async () => {
    try {
      const response = await fetch('/api/tenant/analytics?format=export');
      const result = await response.json();

      if (result.success) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${analytics?.tenantName}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        toast({
          title: 'Success',
          description: 'Analytics data exported successfully'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export analytics data',
        variant: 'destructive'
      });
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-full">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div className="ml-3">
                <div className="text-2xl font-bold">{analytics?.metrics.user.totalUsers || 0}</div>
                <div className="text-sm text-gray-600">Total Users</div>
                {analytics?.metrics.user.userGrowth !== undefined && (
                  <div className={`text-xs flex items-center ${
                    analytics.metrics.user.userGrowth >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {analytics.metrics.user.userGrowth >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {Math.abs(analytics.metrics.user.userGrowth).toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-full">
                <Database className="h-4 w-4 text-green-600" />
              </div>
              <div className="ml-3">
                <div className="text-2xl font-bold">{analytics?.metrics.usage.storage.percentage.toFixed(1) || 0}%</div>
                <div className="text-sm text-gray-600">Storage Used</div>
                <Progress 
                  value={analytics?.metrics.usage.storage.percentage || 0} 
                  className="mt-1 w-16 h-2" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-full">
                <Activity className="h-4 w-4 text-purple-600" />
              </div>
              <div className="ml-3">
                <div className="text-2xl font-bold">{analytics?.metrics.usage.uptime.percentage.toFixed(1) || 0}%</div>
                <div className="text-sm text-gray-600">Uptime</div>
                <div className="text-xs text-gray-500">
                  {analytics?.metrics.usage.uptime.downtime || 0}min downtime
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-full">
                <Zap className="h-4 w-4 text-orange-600" />
              </div>
              <div className="ml-3">
                <div className="text-2xl font-bold">{analytics?.metrics.plugin.activePlugins || 0}</div>
                <div className="text-sm text-gray-600">Active Plugins</div>
                <div className="text-xs text-gray-500">
                  of {analytics?.metrics.plugin.totalPlugins || 0} total
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Usage Trends
          </CardTitle>
          <CardDescription>
            Resource usage over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analytics?.trends.usage || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                formatter={(value: number) => [value.toFixed(2), 'Usage']}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#8884d8" 
                fill="#8884d8" 
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Health Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {analytics?.trends.health.overallScore || 0}
              </div>
              <div className="text-sm text-gray-600">Overall</div>
              <Progress value={analytics?.trends.health.overallScore || 0} className="mt-2" />
            </div>
            <div className="text-center">
              <div className="text-xl font-semibold">
                {analytics?.trends.health.availability || 0}
              </div>
              <div className="text-xs text-gray-600">Availability</div>
              <Progress value={analytics?.trends.health.availability || 0} className="mt-1" />
            </div>
            <div className="text-center">
              <div className="text-xl font-semibold">
                {analytics?.trends.health.performance || 0}
              </div>
              <div className="text-xs text-gray-600">Performance</div>
              <Progress value={analytics?.trends.health.performance || 0} className="mt-1" />
            </div>
            <div className="text-center">
              <div className="text-xl font-semibold">
                {analytics?.trends.health.userSatisfaction || 0}
              </div>
              <div className="text-xs text-gray-600">User Satisfaction</div>
              <Progress value={analytics?.trends.health.userSatisfaction || 0} className="mt-1" />
            </div>
            <div className="text-center">
              <div className="text-xl font-semibold">
                {analytics?.trends.health.securityScore || 0}
              </div>
              <div className="text-xs text-gray-600">Security</div>
              <Progress value={analytics?.trends.health.securityScore || 0} className="mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderInsightsTab = () => (
    <div className="space-y-6">
      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Insights & Alerts</CardTitle>
          <CardDescription>
            Automated insights based on your usage patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics?.insights.map((insight) => {
              const Icon = INSIGHT_ICONS[insight.type];
              return (
                <div 
                  key={insight.id}
                  className={`p-4 rounded-lg border ${INSIGHT_COLORS[insight.type]}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{insight.title}</h4>
                        <Badge variant={insight.impact === 'HIGH' ? 'destructive' : insight.impact === 'MEDIUM' ? 'default' : 'secondary'}>
                          {insight.impact}
                        </Badge>
                      </div>
                      <p className="text-sm opacity-90">{insight.description}</p>
                      {insight.actionable && (
                        <Button variant="outline" size="sm" className="mt-2">
                          Take Action
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {(!analytics?.insights || analytics.insights.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p>No insights available. Your system is running smoothly!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>
            Suggested improvements based on your analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics?.recommendations.map((rec) => (
              <div key={rec.id} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{rec.title}</h4>
                      <Badge variant={rec.priority === 'HIGH' ? 'destructive' : rec.priority === 'MEDIUM' ? 'default' : 'secondary'}>
                        {rec.priority}
                      </Badge>
                      <Badge variant="outline">{rec.type}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-medium">Impact:</span> {rec.estimatedImpact}
                      </div>
                      <div>
                        <span className="font-medium">Effort:</span> {rec.implementationEffort}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Learn More
                  </Button>
                </div>
              </div>
            ))}
            
            {(!analytics?.recommendations || analytics.recommendations.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                <Target className="h-12 w-12 mx-auto mb-2 text-blue-500" />
                <p>No recommendations available at this time.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderUsageTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Storage Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Storage Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Used</span>
                  <span>{analytics?.metrics.usage.storage.used || 0} GB of {analytics?.metrics.usage.storage.limit || 0} GB</span>
                </div>
                <Progress value={analytics?.metrics.usage.storage.percentage || 0} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Calls */}
        <Card>
          <CardHeader>
            <CardTitle>API Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>This Month</span>
                  <span>{analytics?.metrics.usage.apiCalls.count.toLocaleString() || 0} of {analytics?.metrics.usage.apiCalls.limit.toLocaleString() || 0}</span>
                </div>
                <Progress value={analytics?.metrics.usage.apiCalls.percentage || 0} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Request Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Request Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {analytics?.metrics.usage.requests.successful || 0}
              </div>
              <div className="text-sm text-gray-600">Successful</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {analytics?.metrics.usage.requests.failed || 0}
              </div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {analytics?.metrics.usage.requests.total || 0}
              </div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPerformanceTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {analytics?.metrics.performance.averageResponseTime.toFixed(0) || 0}ms
            </div>
            <div className="text-sm text-gray-600">Avg Response Time</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {analytics?.metrics.performance.availability.toFixed(1) || 0}%
            </div>
            <div className="text-sm text-gray-600">Availability</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {analytics?.metrics.performance.errorRate.toFixed(2) || 0}%
            </div>
            <div className="text-sm text-gray-600">Error Rate</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          <p className="text-gray-600">
            Insights and usage analytics for {analytics?.tenantName || 'your organization'}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={refreshAnalytics} disabled={refreshing}>
            {refreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={exportAnalytics}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {renderOverviewTab()}
        </TabsContent>

        <TabsContent value="usage">
          {renderUsageTab()}
        </TabsContent>

        <TabsContent value="performance">
          {renderPerformanceTab()}
        </TabsContent>

        <TabsContent value="insights">
          {renderInsightsTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
}