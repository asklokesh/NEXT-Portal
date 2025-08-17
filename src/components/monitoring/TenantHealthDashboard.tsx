/**
 * Tenant Health Monitoring Dashboard
 * Real-time monitoring and alerting for tenant health metrics
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Shield,
  Server,
  Users,
  DollarSign,
  Zap,
  RefreshCw,
  Settings,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  Filter,
  Download,
  Search,
  MoreVertical,
  Play,
  Pause,
  AlertCircle,
  Info,
  X,
  Check
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface TenantHealthMetrics {
  tenantId: string;
  tenantName: string;
  tier: string;
  avgResponseTime: number;
  errorRate: number;
  throughput: number;
  availability: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIO: number;
  activeUsers: number;
  sessionCount: number;
  apiCallsPerMinute: number;
  billingStatus: 'current' | 'overdue' | 'suspended';
  securityIncidents: number;
  failedLogins: number;
  suspiciousActivity: number;
  pluginCount: number;
  catalogEntities: number;
  cicdPipelines: number;
  healthScore: number;
  healthTrend: 'improving' | 'stable' | 'declining';
  timestamp: Date;
}

interface TenantAlert {
  id: string;
  tenantId: string;
  type: 'performance' | 'resource' | 'security' | 'billing' | 'availability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  recommendation: string;
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
  autoRemediationAttempted: boolean;
}

interface MonitoringSummary {
  overview: {
    totalTenants: number;
    avgHealthScore: number;
    healthyTenants: number;
    warningTenants: number;
    criticalTenants: number;
  };
  alerts: {
    total: number;
    critical: number;
    unacknowledged: number;
    autoRemediationAttempts: number;
  };
  trends: {
    improving: number;
    stable: number;
    declining: number;
  };
}

const SEVERITY_COLORS = {
  critical: '#ef4444',
  high: '#f97316', 
  medium: '#f59e0b',
  low: '#06b6d4'
};

const HEALTH_COLORS = {
  excellent: '#10b981',
  good: '#059669',
  warning: '#f59e0b',
  critical: '#ef4444'
};

export default function TenantHealthDashboard() {
  const [tenantHealth, setTenantHealth] = useState<TenantHealthMetrics[]>([]);
  const [alerts, setAlerts] = useState<TenantAlert[]>([]);
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<string>('all');
  const [selectedView, setSelectedView] = useState('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [alertFilter, setAlertFilter] = useState('all');
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => {
    loadMonitoringData();
    
    if (autoRefresh) {
      const interval = setInterval(loadMonitoringData, 30000); // 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadMonitoringData = async () => {
    setLoading(true);
    try {
      // Load summary data
      const summaryResponse = await fetch('/api/monitoring/tenant-health?type=summary');
      const summaryData = await summaryResponse.json();
      if (summaryData.success) {
        setSummary(summaryData.data);
      }

      // Load all tenant health
      const healthResponse = await fetch('/api/monitoring/tenant-health?type=health');
      const healthData = await healthResponse.json();
      if (healthData.success) {
        setTenantHealth(healthData.data);
      }

      // Load all alerts
      const alertsResponse = await fetch('/api/monitoring/tenant-health?type=alerts');
      const alertsData = await alertsResponse.json();
      if (alertsData.success) {
        setAlerts(alertsData.data);
      }

    } catch (error) {
      console.error('Failed to load monitoring data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load monitoring data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/monitoring/tenant-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'acknowledge', alertId })
      });

      const result = await response.json();
      if (result.success) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId ? { ...alert, acknowledged: true } : alert
        ));
        toast({
          title: 'Success',
          description: 'Alert acknowledged successfully'
        });
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      toast({
        title: 'Error',
        description: 'Failed to acknowledge alert',
        variant: 'destructive'
      });
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch('/api/monitoring/tenant-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve', alertId })
      });

      const result = await response.json();
      if (result.success) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId ? { ...alert, resolved: true } : alert
        ));
        toast({
          title: 'Success',
          description: 'Alert resolved successfully'
        });
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      toast({
        title: 'Error',
        description: 'Failed to resolve alert',
        variant: 'destructive'
      });
    }
  };

  const filteredTenants = tenantHealth.filter(tenant => {
    if (selectedTenant !== 'all' && tenant.tenantId !== selectedTenant) return false;
    if (searchQuery && !tenant.tenantName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const filteredAlerts = alerts.filter(alert => {
    if (!showResolved && alert.resolved) return false;
    if (alertFilter !== 'all' && alert.severity !== alertFilter) return false;
    if (selectedTenant !== 'all' && alert.tenantId !== selectedTenant) return false;
    return true;
  });

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return HEALTH_COLORS.excellent;
    if (score >= 80) return HEALTH_COLORS.good;
    if (score >= 60) return HEALTH_COLORS.warning;
    return HEALTH_COLORS.critical;
  };

  const getHealthScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Warning';
    return 'Critical';
  };

  const formatMetric = (value: number, type: 'percentage' | 'milliseconds' | 'number' = 'number') => {
    switch (type) {
      case 'percentage': return `${value.toFixed(1)}%`;
      case 'milliseconds': return `${value}ms`;
      default: return value.toLocaleString();
    }
  };

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading tenant health monitoring...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tenant Health Monitoring</h1>
          <p className="text-gray-600">Real-time monitoring and alerting for all tenants</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search tenants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48"
            />
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          
          <Select value={selectedTenant} onValueChange={setSelectedTenant}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tenants</SelectItem>
              {tenantHealth.map(tenant => (
                <SelectItem key={tenant.tenantId} value={tenant.tenantId}>
                  {tenant.tenantName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          
          <Button variant="outline" size="sm" onClick={loadMonitoringData}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Tenants</p>
                  <p className="text-2xl font-bold">{summary.overview.totalTenants}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-100">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Avg Health Score</p>
                  <p className="text-2xl font-bold">{summary.overview.avgHealthScore.toFixed(1)}</p>
                </div>
                <div className="p-3 rounded-lg bg-green-100">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Alerts</p>
                  <p className="text-2xl font-bold">{summary.alerts.total}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-red-600">{summary.alerts.critical} critical</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-red-100">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Health Trends</p>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <span className="text-sm">{summary.trends.improving}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 text-red-600" />
                      <span className="text-sm">{summary.trends.declining}</span>
                    </div>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-purple-100">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={selectedView} onValueChange={setSelectedView} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants">Tenant Details</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Health Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Health Score Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Excellent (90-100)', value: tenantHealth.filter(t => t.healthScore >= 90).length, fill: HEALTH_COLORS.excellent },
                        { name: 'Good (80-89)', value: tenantHealth.filter(t => t.healthScore >= 80 && t.healthScore < 90).length, fill: HEALTH_COLORS.good },
                        { name: 'Warning (60-79)', value: tenantHealth.filter(t => t.healthScore >= 60 && t.healthScore < 80).length, fill: HEALTH_COLORS.warning },
                        { name: 'Critical (<60)', value: tenantHealth.filter(t => t.healthScore < 60).length, fill: HEALTH_COLORS.critical }
                      ]}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({name, value}) => value > 0 ? `${name}: ${value}` : ''}
                    />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {filteredAlerts.slice(0, 10).map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className={`p-1 rounded ${
                        alert.severity === 'critical' ? 'bg-red-100 text-red-600' :
                        alert.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                        alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        <AlertTriangle className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{alert.title}</p>
                        <p className="text-sm text-gray-600 truncate">{alert.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {tenantHealth.find(t => t.tenantId === alert.tenantId)?.tenantName || alert.tenantId}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {new Date(alert.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tenant Details Tab */}
        <TabsContent value="tenants" className="space-y-6">
          <div className="grid grid-cols-1 gap-4">
            {filteredTenants.map((tenant) => (
              <Card key={tenant.tenantId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{tenant.tenantName}</CardTitle>
                      <CardDescription>
                        {tenant.tier} • {tenant.tenantId}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        style={{ backgroundColor: getHealthScoreColor(tenant.healthScore) }}
                        className="text-white"
                      >
                        {getHealthScoreLabel(tenant.healthScore)} ({tenant.healthScore})
                      </Badge>
                      <div className="flex items-center gap-1">
                        {tenant.healthTrend === 'improving' ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : tenant.healthTrend === 'declining' ? (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        ) : (
                          <Activity className="h-4 w-4 text-gray-600" />
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Performance Metrics */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-gray-600">Performance</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Response Time</span>
                          <span>{formatMetric(tenant.avgResponseTime, 'milliseconds')}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Error Rate</span>
                          <span>{formatMetric(tenant.errorRate * 100, 'percentage')}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Availability</span>
                          <span>{formatMetric(tenant.availability, 'percentage')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Resource Metrics */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-gray-600">Resources</h4>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>CPU</span>
                            <span>{formatMetric(tenant.cpuUsage, 'percentage')}</span>
                          </div>
                          <Progress value={tenant.cpuUsage} className="h-1" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>Memory</span>
                            <span>{formatMetric(tenant.memoryUsage, 'percentage')}</span>
                          </div>
                          <Progress value={tenant.memoryUsage} className="h-1" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>Disk</span>
                            <span>{formatMetric(tenant.diskUsage, 'percentage')}</span>
                          </div>
                          <Progress value={tenant.diskUsage} className="h-1" />
                        </div>
                      </div>
                    </div>

                    {/* Business Metrics */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-gray-600">Usage</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Active Users</span>
                          <span>{formatMetric(tenant.activeUsers)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>API Calls/min</span>
                          <span>{formatMetric(tenant.apiCallsPerMinute)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span>Billing Status</span>
                          <Badge 
                            variant={tenant.billingStatus === 'current' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {tenant.billingStatus}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <div className="flex items-center gap-4 mb-4">
            <Select value={alertFilter} onValueChange={setAlertFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant={showResolved ? "default" : "outline"}
              size="sm"
              onClick={() => setShowResolved(!showResolved)}
            >
              {showResolved ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showResolved ? 'Hide Resolved' : 'Show Resolved'}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredAlerts.map((alert) => (
              <Card key={alert.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded ${
                        alert.severity === 'critical' ? 'bg-red-100 text-red-600' :
                        alert.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                        alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{alert.title}</h4>
                          <Badge 
                            style={{ backgroundColor: SEVERITY_COLORS[alert.severity] }}
                            className="text-white text-xs"
                          >
                            {alert.severity}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {alert.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                        <p className="text-sm text-gray-500 mb-3">{alert.recommendation}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{tenantHealth.find(t => t.tenantId === alert.tenantId)?.tenantName || alert.tenantId}</span>
                          <span>{new Date(alert.timestamp).toLocaleString()}</span>
                          {alert.autoRemediationAttempted && (
                            <Badge variant="outline" className="text-xs">
                              Auto-remediation attempted
                            </Badge>
                          )}
                          {alert.acknowledged && (
                            <Badge variant="outline" className="text-xs text-green-600">
                              Acknowledged
                            </Badge>
                          )}
                          {alert.resolved && (
                            <Badge variant="outline" className="text-xs text-blue-600">
                              Resolved
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {!alert.resolved && (
                      <div className="flex items-center gap-2">
                        {!alert.acknowledged && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => acknowledgeAlert(alert.id)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => resolveAlert(alert.id)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Health Score Trends</CardTitle>
              <CardDescription>Track tenant health over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={tenantHealth.map(t => ({
                  name: t.tenantName,
                  healthScore: t.healthScore,
                  responseTime: t.avgResponseTime,
                  errorRate: t.errorRate * 1000 // Scale for visibility
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="healthScore" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Health Score"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}