'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  Lock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  FileText,
  Users,
  Settings,
  TrendingUp,
  TrendingDown,
  Clock,
  Eye,
  ShieldCheck,
  ShieldAlert,
  FileSearch,
  Zap,
  Globe,
  Database,
  Server,
  Terminal
} from 'lucide-react';
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
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface SecurityDashboardData {
  health: {
    status: string;
    components: Record<string, any>;
  };
  metrics: {
    falsePositiveRate: number;
    complianceScore: number;
    policyEnforcement: number;
    activeIncidents: number;
    criticalVulnerabilities: number;
  };
  threats: any;
  policies: any;
  compliance: any;
  incidents: any;
  vulnerabilities: any;
}

export default function EnterpriseSecurityDashboard() {
  const [dashboardData, setDashboardData] = useState<SecurityDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/security/administration?action=dashboard');
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      const data = await response.json();
      setDashboardData(data.dashboard);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'unhealthy': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'unhealthy': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const falsePositiveData = [
    { name: 'Target', value: 5, fill: '#10b981' },
    { name: 'Current', value: dashboardData?.metrics.falsePositiveRate || 0, fill: dashboardData?.metrics.falsePositiveRate <= 5 ? '#10b981' : '#ef4444' }
  ];

  const complianceData = [
    { framework: 'SOC2', score: 92, target: 95 },
    { framework: 'ISO27001', score: 88, target: 95 },
    { framework: 'GDPR', score: 94, target: 95 },
    { framework: 'HIPAA', score: 90, target: 95 }
  ];

  const policyData = [
    { name: 'Access Control', enforced: 12, total: 15 },
    { name: 'Data Protection', enforced: 8, total: 10 },
    { name: 'Network Security', enforced: 10, total: 12 },
    { name: 'Compliance', enforced: 9, total: 10 }
  ];

  const incidentTrend = [
    { day: 'Mon', critical: 0, high: 2, medium: 5, low: 8 },
    { day: 'Tue', critical: 1, high: 3, medium: 4, low: 6 },
    { day: 'Wed', critical: 0, high: 1, medium: 6, low: 9 },
    { day: 'Thu', critical: 0, high: 2, medium: 3, low: 7 },
    { day: 'Fri', critical: 1, high: 4, medium: 5, low: 5 },
    { day: 'Sat', critical: 0, high: 1, medium: 2, low: 3 },
    { day: 'Sun', critical: 0, high: 0, medium: 1, low: 2 }
  ];

  const threatRadarData = [
    { category: 'Malware', score: 85 },
    { category: 'Phishing', score: 72 },
    { category: 'Data Breach', score: 68 },
    { category: 'Insider Threat', score: 45 },
    { category: 'DDoS', score: 30 },
    { category: 'Zero-Day', score: 55 }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Enterprise Security Administration</h1>
          <p className="text-gray-600 mt-1">Zero-Trust Security Operations Center</p>
        </div>
        <div className="flex space-x-4">
          <Badge variant={dashboardData?.health.status === 'healthy' ? 'default' : 'destructive'}>
            {getHealthIcon(dashboardData?.health.status || 'unknown')}
            <span className="ml-2">{dashboardData?.health.status || 'Unknown'}</span>
          </Badge>
          <Button onClick={fetchDashboardData} variant="outline">
            <Activity className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Critical Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className={dashboardData?.metrics.falsePositiveRate <= 5 ? '' : 'border-red-500'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">False Positive Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData?.metrics.falsePositiveRate?.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Target: ≤5%
            </p>
            <Progress 
              value={Math.min((5 / (dashboardData?.metrics.falsePositiveRate || 1)) * 100, 100)} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card className={dashboardData?.metrics.complianceScore >= 95 ? '' : 'border-yellow-500'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData?.metrics.complianceScore?.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Target: ≥95%
            </p>
            <Progress value={dashboardData?.metrics.complianceScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Policy Enforcement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData?.metrics.policyEnforcement?.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active policies
            </p>
            <Progress value={dashboardData?.metrics.policyEnforcement} className="mt-2" />
          </CardContent>
        </Card>

        <Card className={dashboardData?.metrics.activeIncidents > 0 ? 'border-orange-500' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData?.metrics.activeIncidents}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Requiring response
            </p>
          </CardContent>
        </Card>

        <Card className={dashboardData?.metrics.criticalVulnerabilities > 0 ? 'border-red-500' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Critical Vulnerabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData?.metrics.criticalVulnerabilities}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Need immediate action
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="threats">Threats</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Threat Detection Performance */}
            <Card>
              <CardHeader>
                <CardTitle>ML Threat Detection Performance</CardTitle>
                <CardDescription>False positive rate optimization</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={falsePositiveData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Threat Radar */}
            <Card>
              <CardHeader>
                <CardTitle>Threat Landscape</CardTitle>
                <CardDescription>Current threat detection scores</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={threatRadarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="category" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar name="Threat Score" dataKey="score" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Incident Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Incident Trend</CardTitle>
              <CardDescription>Weekly incident distribution by severity</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={incidentTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="critical" stackId="1" stroke="#ef4444" fill="#ef4444" />
                  <Area type="monotone" dataKey="high" stackId="1" stroke="#f97316" fill="#f97316" />
                  <Area type="monotone" dataKey="medium" stackId="1" stroke="#eab308" fill="#eab308" />
                  <Area type="monotone" dataKey="low" stackId="1" stroke="#22c55e" fill="#22c55e" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Framework Status</CardTitle>
              <CardDescription>Multi-framework compliance monitoring</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={complianceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="framework" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="score" fill="#8884d8" name="Current Score" />
                  <Bar dataKey="target" fill="#82ca9d" name="Target Score" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {complianceData.map((item) => (
                  <div key={item.framework} className="flex justify-between items-center p-2 border rounded">
                    <span className="font-medium">{item.framework}</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={item.score} className="w-32" />
                      <Badge variant={item.score >= item.target ? 'default' : 'destructive'}>
                        {item.score >= item.target ? 'Compliant' : 'Non-Compliant'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Policy Enforcement Status</CardTitle>
              <CardDescription>Real-time policy evaluation and enforcement</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={policyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="enforced" fill="#22c55e" name="Enforced" />
                  <Bar dataKey="total" fill="#94a3b8" name="Total" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Button className="w-full">
                  <Shield className="w-4 h-4 mr-2" />
                  Deploy New Policy
                </Button>
                <Button variant="outline" className="w-full">
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Policies
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <Button variant="outline">
          <FileText className="w-4 h-4 mr-2" />
          Generate Report
        </Button>
        <Button variant="outline">
          <FileSearch className="w-4 h-4 mr-2" />
          Run Compliance Audit
        </Button>
        <Button>
          <ShieldAlert className="w-4 h-4 mr-2" />
          Incident Response
        </Button>
      </div>
    </div>
  );
}