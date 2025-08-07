/**
 * Governance Dashboard
 * Main governance dashboard with real-time compliance monitoring,
 * policy management, and executive reporting
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  FileText,
  TrendingUp,
  TrendingDown,
  Activity,
  Settings,
  Download,
  Refresh,
  AlertCircle,
  Users,
  Server,
  Lock
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface GovernanceMetrics {
  overall: {
    complianceScore: number;
    securityScore: number;
    qualityScore: number;
    governanceScore: number;
  };
  compliance: {
    frameworkScores: Record<string, number>;
    totalAssessments: number;
    passedAssessments: number;
    overduePolicies: number;
    activeViolations: number;
  };
  security: {
    vulnerabilities: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    accessViolations: number;
    containerIssues: number;
    secretsExposed: number;
  };
  qualityGates: {
    totalExecutions: number;
    passRate: number;
    averageExecutionTime: number;
    blockedDeployments: number;
  };
  policies: {
    totalPolicies: number;
    activePolicies: number;
    violatedPolicies: number;
    exemptedPolicies: number;
  };
}

interface Alert {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  timestamp: Date;
  status: 'active' | 'acknowledged' | 'resolved';
}

interface ComplianceFramework {
  name: string;
  score: number;
  status: 'compliant' | 'non-compliant' | 'partial';
  lastAssessment: Date;
  nextAssessment: Date;
}

interface QualityGateExecution {
  id: string;
  gateName: string;
  targetId: string;
  status: 'passed' | 'failed' | 'running';
  results: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  startedAt: Date;
  duration?: number;
}

const COLORS = {
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4'
};

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function GovernanceDashboard() {
  const [metrics, setMetrics] = useState<GovernanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const [qualityGateExecutions, setQualityGateExecutions] = useState<QualityGateExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Simulate API calls - in production, these would be real API calls
      const [metricsData, alertsData, frameworksData, executionsData] = await Promise.all([
        fetchGovernanceMetrics(),
        fetchAlerts(),
        fetchComplianceFrameworks(),
        fetchQualityGateExecutions()
      ]);

      setMetrics(metricsData);
      setAlerts(alertsData);
      setFrameworks(frameworksData);
      setQualityGateExecutions(executionsData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGovernanceMetrics = async (): Promise<GovernanceMetrics> => {
    // Simulate API call
    return {
      overall: {
        complianceScore: 85,
        securityScore: 78,
        qualityScore: 92,
        governanceScore: 83
      },
      compliance: {
        frameworkScores: {
          GDPR: 88,
          HIPAA: 82,
          SOC2: 90,
          'PCI-DSS': 78,
          'ISO27001': 85
        },
        totalAssessments: 12,
        passedAssessments: 10,
        overduePolicies: 3,
        activeViolations: 5
      },
      security: {
        vulnerabilities: {
          critical: 2,
          high: 8,
          medium: 15,
          low: 23
        },
        accessViolations: 12,
        containerIssues: 4,
        secretsExposed: 1
      },
      qualityGates: {
        totalExecutions: 156,
        passRate: 87,
        averageExecutionTime: 145,
        blockedDeployments: 8
      },
      policies: {
        totalPolicies: 45,
        activePolicies: 42,
        violatedPolicies: 5,
        exemptedPolicies: 2
      }
    };
  };

  const fetchAlerts = async (): Promise<Alert[]> => {
    return [
      {
        id: '1',
        type: 'security',
        severity: 'critical',
        title: 'Critical Vulnerability Detected',
        description: 'CVE-2024-1234 found in production container',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'active'
      },
      {
        id: '2',
        type: 'compliance',
        severity: 'warning',
        title: 'GDPR Assessment Overdue',
        description: 'Quarterly GDPR assessment is 3 days overdue',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
        status: 'active'
      },
      {
        id: '3',
        type: 'quality',
        severity: 'warning',
        title: 'Quality Gate Failed',
        description: 'Service deployment blocked due to test coverage below 80%',
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
        status: 'acknowledged'
      }
    ];
  };

  const fetchComplianceFrameworks = async (): Promise<ComplianceFramework[]> => {
    return [
      {
        name: 'GDPR',
        score: 88,
        status: 'compliant',
        lastAssessment: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        nextAssessment: new Date(Date.now() + 86 * 24 * 60 * 60 * 1000)
      },
      {
        name: 'SOC2',
        score: 90,
        status: 'compliant',
        lastAssessment: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        nextAssessment: new Date(Date.now() + 79 * 24 * 60 * 60 * 1000)
      },
      {
        name: 'PCI-DSS',
        score: 78,
        status: 'partial',
        lastAssessment: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
        nextAssessment: new Date(Date.now() + 72 * 24 * 60 * 60 * 1000)
      }
    ];
  };

  const fetchQualityGateExecutions = async (): Promise<QualityGateExecution[]> => {
    return [
      {
        id: '1',
        gateName: 'Security Gate',
        targetId: 'user-service',
        status: 'passed',
        results: { total: 5, passed: 5, failed: 0, warnings: 0 },
        startedAt: new Date(Date.now() - 30 * 60 * 1000),
        duration: 145
      },
      {
        id: '2',
        gateName: 'Quality Gate',
        targetId: 'payment-service',
        status: 'failed',
        results: { total: 8, passed: 6, failed: 2, warnings: 0 },
        startedAt: new Date(Date.now() - 45 * 60 * 1000),
        duration: 203
      }
    ];
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return COLORS.success;
    if (score >= 80) return COLORS.warning;
    return COLORS.danger;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant':
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'partial':
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'non-compliant':
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  const generateTrendData = () => {
    const days = 7;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toLocaleDateString(),
        compliance: 85 + Math.random() * 10 - 5,
        security: 78 + Math.random() * 10 - 5,
        quality: 92 + Math.random() * 8 - 4
      });
    }
    return data;
  };

  const vulnerabilityData = metrics ? [
    { name: 'Critical', value: metrics.security.vulnerabilities.critical, color: COLORS.danger },
    { name: 'High', value: metrics.security.vulnerabilities.high, color: '#f97316' },
    { name: 'Medium', value: metrics.security.vulnerabilities.medium, color: COLORS.warning },
    { name: 'Low', value: metrics.security.vulnerabilities.low, color: COLORS.info }
  ] : [];

  if (loading || !metrics) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading governance dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Governance Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor compliance, security, and quality across your services
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadDashboardData}>
            <Refresh className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Overall Scores */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Governance</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overall.governanceScore}%</div>
            <Progress value={metrics.overall.governanceScore} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.overall.governanceScore >= 80 ? 'Good' : 'Needs Attention'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overall.complianceScore}%</div>
            <Progress value={metrics.overall.complianceScore} className="mt-2" />
            <div className="flex items-center mt-2">
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              <p className="text-xs text-green-500">+2% from last month</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overall.securityScore}%</div>
            <Progress value={metrics.overall.securityScore} className="mt-2" />
            <div className="flex items-center mt-2">
              <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              <p className="text-xs text-red-500">-3% from last month</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.overall.qualityScore}%</div>
            <Progress value={metrics.overall.qualityScore} className="mt-2" />
            <div className="flex items-center mt-2">
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              <p className="text-xs text-green-500">+5% from last month</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="quality">Quality Gates</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Trends Chart */}
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Governance Trends</CardTitle>
                <CardDescription>
                  Compliance, security, and quality scores over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={generateTrendData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[60, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="compliance" stroke={COLORS.primary} name="Compliance" />
                    <Line type="monotone" dataKey="security" stroke={COLORS.danger} name="Security" />
                    <Line type="monotone" dataKey="quality" stroke={COLORS.success} name="Quality" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total Policies</span>
                  <Badge variant="secondary">{metrics.policies.totalPolicies}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Active Violations</span>
                  <Badge variant="destructive">{metrics.compliance.activeViolations}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Blocked Deployments</span>
                  <Badge variant="destructive">{metrics.qualityGates.blockedDeployments}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Quality Gate Pass Rate</span>
                  <Badge variant="default">{metrics.qualityGates.passRate}%</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activities */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Quality Gate Executions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {qualityGateExecutions.map((execution) => (
                    <div key={execution.id} className="flex items-center space-x-3">
                      {getStatusIcon(execution.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {execution.gateName} - {execution.targetId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {execution.results.passed}/{execution.results.total} checks passed
                          {execution.duration && ` • ${formatDuration(execution.duration)}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Framework Scores */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance Framework Scores</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(metrics.compliance.frameworkScores).map(([name, score]) => ({ name, score }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="score" fill={COLORS.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Framework Status */}
            <Card>
              <CardHeader>
                <CardTitle>Framework Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {frameworks.map((framework) => (
                    <div key={framework.name} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(framework.status)}
                          <span className="font-medium">{framework.name}</span>
                        </div>
                        <Badge
                          variant={framework.status === 'compliant' ? 'default' : 
                                   framework.status === 'partial' ? 'secondary' : 'destructive'}
                        >
                          {framework.score}%
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p>Last assessment: {framework.lastAssessment.toLocaleDateString()}</p>
                        <p>Next assessment: {framework.nextAssessment.toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vulnerability Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Vulnerability Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={vulnerabilityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                    >
                      {vulnerabilityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Security Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Security Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">
                      {metrics.security.vulnerabilities.critical + metrics.security.vulnerabilities.high}
                    </div>
                    <div className="text-sm text-muted-foreground">High Risk Vulnerabilities</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-500">
                      {metrics.security.accessViolations}
                    </div>
                    <div className="text-sm text-muted-foreground">Access Violations</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-500">
                      {metrics.security.containerIssues}
                    </div>
                    <div className="text-sm text-muted-foreground">Container Issues</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {metrics.security.secretsExposed}
                    </div>
                    <div className="text-sm text-muted-foreground">Exposed Secrets</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Quality Gates Tab */}
        <TabsContent value="quality" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Quality Gate Performance</CardTitle>
                <CardDescription>
                  Overview of quality gate executions and success rates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{metrics.qualityGates.totalExecutions}</div>
                    <div className="text-sm text-muted-foreground">Total Executions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-500">{metrics.qualityGates.passRate}%</div>
                    <div className="text-sm text-muted-foreground">Pass Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{formatDuration(metrics.qualityGates.averageExecutionTime * 1000)}</div>
                    <div className="text-sm text-muted-foreground">Avg Duration</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">{metrics.qualityGates.blockedDeployments}</div>
                    <div className="text-sm text-muted-foreground">Blocked Deployments</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Recent Executions</h4>
                  {qualityGateExecutions.map((execution) => (
                    <div key={execution.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(execution.status)}
                          <span className="font-medium">{execution.gateName}</span>
                          <Badge variant="outline">{execution.targetId}</Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {execution.startedAt.toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <span>
                          <span className="text-green-600">{execution.results.passed}</span> passed
                        </span>
                        <span>
                          <span className="text-red-600">{execution.results.failed}</span> failed
                        </span>
                        <span>
                          <span className="text-yellow-600">{execution.results.warnings}</span> warnings
                        </span>
                        {execution.duration && (
                          <span>Duration: {formatDuration(execution.duration)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
                <CardDescription>
                  Current governance alerts requiring attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className={`border rounded-lg p-3 ${
                      alert.severity === 'critical' ? 'border-red-200 bg-red-50' :
                      alert.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                      'border-blue-200 bg-blue-50'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            {alert.severity === 'critical' ? (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            ) : alert.severity === 'warning' ? (
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            ) : (
                              <Activity className="h-4 w-4 text-blue-500" />
                            )}
                            <span className="font-medium">{alert.title}</span>
                            <Badge
                              variant={alert.severity === 'critical' ? 'destructive' :
                                       alert.severity === 'warning' ? 'secondary' : 'default'}
                            >
                              {alert.severity}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {alert.timestamp.toLocaleString()} • Type: {alert.type}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          {alert.status === 'active' && (
                            <Button variant="outline" size="sm">
                              Acknowledge
                            </Button>
                          )}
                          <Button variant="outline" size="sm">
                            Resolve
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {alerts.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p>No active alerts</p>
                      <p className="text-sm">Your governance system is running smoothly</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}