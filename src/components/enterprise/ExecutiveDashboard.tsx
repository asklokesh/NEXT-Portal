/**
 * Executive Enterprise Dashboard
 * C-level visibility into platform performance, tenant health, and business metrics
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
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Activity,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  Zap,
  Globe,
  Building2,
  CreditCard,
  UserCheck,
  Server,
  Database,
  FileText,
  Settings,
  Download,
  Upload,
  RefreshCw,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  ChevronRight
} from 'lucide-react';

interface ExecutiveMetrics {
  platform: {
    totalTenants: number;
    activeTenants: number;
    tenantGrowthRate: number;
    totalUsers: number;
    activeUsers: number;
    userGrowthRate: number;
    systemUptime: number;
    avgResponseTime: number;
    totalRevenue: number;
    revenueGrowthRate: number;
    churnRate: number;
    customerSatisfaction: number;
  };
  
  tenantHealth: {
    healthy: number;
    warning: number;
    critical: number;
    distribution: Array<{
      tier: string;
      count: number;
      revenue: number;
      growth: number;
    }>;
  };
  
  usage: {
    daily: Array<{
      date: string;
      users: number;
      sessions: number;
      requests: number;
      errors: number;
    }>;
    features: Array<{
      feature: string;
      usage: number;
      growth: number;
      adoption: number;
    }>;
  };
  
  revenue: {
    monthly: Array<{
      month: string;
      revenue: number;
      costs: number;
      profit: number;
      tenants: number;
    }>;
    byTier: Array<{
      tier: string;
      revenue: number;
      percentage: number;
      color: string;
    }>;
  };
  
  security: {
    incidents: number;
    resolved: number;
    threatLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    complianceScore: number;
    vulnerabilities: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  
  performance: {
    availability: number;
    latency: number;
    throughput: number;
    errorRate: number;
    alerts: Array<{
      id: string;
      type: string;
      severity: 'info' | 'warning' | 'error';
      message: string;
      timestamp: Date;
      tenant?: string;
    }>;
  };
}

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#6366f1',
  purple: '#8b5cf6',
  pink: '#ec4899',
  orange: '#f97316'
};

const TIER_COLORS = {
  'Enterprise': COLORS.primary,
  'Professional': COLORS.success,
  'Starter': COLORS.warning,
  'Free': COLORS.info
};

export default function ExecutiveDashboard() {
  const [metrics, setMetrics] = useState<ExecutiveMetrics | null>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadExecutiveMetrics();
    
    if (autoRefresh) {
      const interval = setInterval(loadExecutiveMetrics, 300000); // 5 minutes
      return () => clearInterval(interval);
    }
  }, [timeRange, autoRefresh]);

  const loadExecutiveMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/enterprise/metrics?timeRange=${timeRange}`);
      const data = await response.json();
      
      if (data.success) {
        setMetrics(data.data);
      }
    } catch (error) {
      console.error('Failed to load executive metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading executive dashboard...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Failed to load executive dashboard data</AlertDescription>
      </Alert>
    );
  }

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatNumber = (num: number) => 
    new Intl.NumberFormat('en-US').format(num);

  const formatPercentage = (num: number) => `${num.toFixed(1)}%`;

  const MetricCard = ({ 
    title, 
    value, 
    change, 
    icon: Icon, 
    format = 'number',
    color = 'blue' 
  }: {
    title: string;
    value: number;
    change?: number;
    icon: any;
    format?: 'number' | 'currency' | 'percentage';
    color?: string;
  }) => {
    const formatValue = () => {
      switch (format) {
        case 'currency': return formatCurrency(value);
        case 'percentage': return formatPercentage(value);
        default: return formatNumber(value);
      }
    };

    const getTrend = () => {
      if (change === undefined) return null;
      const isPositive = change > 0;
      const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;
      const trendColor = isPositive ? 'text-green-600' : 'text-red-600';
      
      return (
        <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
          <TrendIcon className="h-3 w-3" />
          {formatPercentage(Math.abs(change))}
        </div>
      );
    };

    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">{title}</p>
              <p className="text-2xl font-bold">{formatValue()}</p>
              {getTrend()}
            </div>
            <div className={`p-3 rounded-lg bg-${color}-100`}>
              <Icon className={`h-6 w-6 text-${color}-600`} />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Executive Dashboard</h1>
          <p className="text-gray-600">Strategic overview of platform performance and business metrics</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          
          <Button variant="outline" size="sm" onClick={loadExecutiveMetrics}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={metrics.platform.totalRevenue}
          change={metrics.platform.revenueGrowthRate}
          icon={DollarSign}
          format="currency"
          color="green"
        />
        
        <MetricCard
          title="Active Tenants"
          value={metrics.platform.activeTenants}
          change={metrics.platform.tenantGrowthRate}
          icon={Building2}
          color="blue"
        />
        
        <MetricCard
          title="Total Users"
          value={metrics.platform.totalUsers}
          change={metrics.platform.userGrowthRate}
          icon={Users}
          color="purple"
        />
        
        <MetricCard
          title="System Uptime"
          value={metrics.platform.systemUptime}
          icon={Activity}
          format="percentage"
          color="green"
        />
      </div>

      {/* Main Dashboard Content */}
      <Tabs value={selectedView} onValueChange={setSelectedView} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants">Tenant Health</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Platform Health */}
            <Card>
              <CardHeader>
                <CardTitle>Platform Health Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>System Availability</span>
                    <div className="flex items-center gap-2">
                      <Progress value={metrics.performance.availability} className="w-24" />
                      <span className="text-sm font-medium">{formatPercentage(metrics.performance.availability)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Average Response Time</span>
                    <span className="text-sm font-medium">{metrics.platform.avgResponseTime}ms</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Error Rate</span>
                    <div className="flex items-center gap-2">
                      <Progress value={metrics.performance.errorRate * 100} className="w-24" />
                      <span className="text-sm font-medium">{formatPercentage(metrics.performance.errorRate)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Customer Satisfaction</span>
                    <div className="flex items-center gap-2">
                      <Progress value={metrics.platform.customerSatisfaction} className="w-24" />
                      <span className="text-sm font-medium">{formatPercentage(metrics.platform.customerSatisfaction)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>System Alerts</CardTitle>
                <CardDescription>Recent platform notifications</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {metrics.performance.alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className={`p-1 rounded ${
                        alert.severity === 'error' ? 'bg-red-100 text-red-600' :
                        alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {alert.severity === 'error' ? <AlertTriangle className="h-3 w-3" /> :
                         alert.severity === 'warning' ? <Clock className="h-3 w-3" /> :
                         <CheckCircle2 className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{alert.type}</p>
                        <p className="text-sm text-gray-600 truncate">{alert.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {alert.timestamp.toLocaleTimeString()}
                          </span>
                          {alert.tenant && (
                            <Badge variant="outline" className="text-xs">{alert.tenant}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Usage Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Usage Trends</CardTitle>
              <CardDescription>Daily active users and system activity</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={metrics.usage.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="users" 
                    stroke={COLORS.primary} 
                    fill={COLORS.primary} 
                    fillOpacity={0.3}
                    name="Active Users"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sessions" 
                    stroke={COLORS.success} 
                    fill={COLORS.success} 
                    fillOpacity={0.3}
                    name="Sessions"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tenant Health Tab */}
        <TabsContent value="tenants" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tenant Health Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Tenant Health Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Healthy</span>
                    </div>
                    <span className="font-medium">{metrics.tenantHealth.healthy}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span>Warning</span>
                    </div>
                    <span className="font-medium">{metrics.tenantHealth.warning}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span>Critical</span>
                    </div>
                    <span className="font-medium">{metrics.tenantHealth.critical}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tenant Tier Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Tenant Distribution by Tier</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.tenantHealth.distribution.map((tier) => (
                    <div key={tier.tier} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{tier.tier}</span>
                        <div className="flex items-center gap-4">
                          <span>{tier.count} tenants</span>
                          <span>{formatCurrency(tier.revenue)}</span>
                          <div className="flex items-center gap-1">
                            {tier.growth > 0 ? (
                              <TrendingUp className="h-3 w-3 text-green-600" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-red-600" />
                            )}
                            <span className={tier.growth > 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatPercentage(Math.abs(tier.growth))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trends */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Revenue & Profitability Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={metrics.revenue.monthly}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke={COLORS.primary} 
                      strokeWidth={3}
                      name="Revenue"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="costs" 
                      stroke={COLORS.error} 
                      strokeWidth={2}
                      name="Costs"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="profit" 
                      stroke={COLORS.success} 
                      strokeWidth={3}
                      name="Profit"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue by Tier */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Subscription Tier</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={metrics.revenue.byTier}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="revenue"
                      label={({tier, percentage}) => `${tier} (${formatPercentage(percentage)})`}
                    >
                      {metrics.revenue.byTier.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Key Revenue Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Key Revenue Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Monthly Recurring Revenue</span>
                    <span className="font-medium">{formatCurrency(metrics.platform.totalRevenue / 12)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Average Revenue Per User</span>
                    <span className="font-medium">
                      {formatCurrency(metrics.platform.totalRevenue / metrics.platform.totalUsers)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Churn Rate</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatPercentage(metrics.platform.churnRate)}</span>
                      <Badge variant={metrics.platform.churnRate < 5 ? "success" : "warning"}>
                        {metrics.platform.churnRate < 5 ? "Good" : "Needs Attention"}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Revenue Growth Rate</span>
                    <div className="flex items-center gap-1">
                      {metrics.platform.revenueGrowthRate > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      <span className={`font-medium ${
                        metrics.platform.revenueGrowthRate > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatPercentage(Math.abs(metrics.platform.revenueGrowthRate))}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Usage Analytics Tab */}
        <TabsContent value="usage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Feature Usage & Adoption</CardTitle>
              <CardDescription>Track which features are driving the most value</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.usage.features}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="feature" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="usage" fill={COLORS.primary} name="Usage Count" />
                  <Bar dataKey="adoption" fill={COLORS.success} name="Adoption Rate %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard
              title="Security Incidents"
              value={metrics.security.incidents}
              icon={Shield}
              color="red"
            />
            
            <MetricCard
              title="Resolved Issues"
              value={metrics.security.resolved}
              icon={CheckCircle2}
              color="green"
            />
            
            <MetricCard
              title="Compliance Score"
              value={metrics.security.complianceScore}
              icon={FileText}
              format="percentage"
              color="blue"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Threat Level */}
            <Card>
              <CardHeader>
                <CardTitle>Current Threat Level</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${
                    metrics.security.threatLevel === 'HIGH' ? 'bg-red-100' :
                    metrics.security.threatLevel === 'MEDIUM' ? 'bg-yellow-100' :
                    'bg-green-100'
                  }`}>
                    <Shield className={`h-10 w-10 ${
                      metrics.security.threatLevel === 'HIGH' ? 'text-red-600' :
                      metrics.security.threatLevel === 'MEDIUM' ? 'text-yellow-600' :
                      'text-green-600'
                    }`} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{metrics.security.threatLevel}</h3>
                  <p className="text-gray-600">Current security posture</p>
                </div>
              </CardContent>
            </Card>

            {/* Vulnerability Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Vulnerability Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span>Critical</span>
                    </div>
                    <span className="font-medium">{metrics.security.vulnerabilities.critical}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span>High</span>
                    </div>
                    <span className="font-medium">{metrics.security.vulnerabilities.high}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <span>Medium</span>
                    </div>
                    <span className="font-medium">{metrics.security.vulnerabilities.medium}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span>Low</span>
                    </div>
                    <span className="font-medium">{metrics.security.vulnerabilities.low}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}