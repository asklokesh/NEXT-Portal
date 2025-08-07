'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  Shield,
  FileText,
  Download,
  Filter,
  Calendar,
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  Server,
  Database,
  Settings,
  AlertCircle,
  BarChart3,
  PieChart,
  LineChart
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

interface ComplianceMetrics {
  overallScore: number;
  riskTrend: 'improving' | 'stable' | 'degrading';
  violationsByStandard: Record<string, number>;
  violationsBySeverity: Record<string, number>;
  recentViolations: ComplianceViolation[];
  complianceByCategory: Record<string, number>;
}

interface ComplianceViolation {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  standard: string;
  description: string;
  status: 'open' | 'acknowledged' | 'resolved' | 'false_positive';
  detectedAt: string;
  evidence: {
    summary: string;
    details: Record<string, any>;
  };
}

interface ComplianceRule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  standard: string;
  enabled: boolean;
}

const COMPLIANCE_STANDARDS = [
  { value: 'SOX', label: 'Sarbanes-Oxley (SOX)', color: 'bg-blue-500' },
  { value: 'GDPR', label: 'GDPR', color: 'bg-green-500' },
  { value: 'HIPAA', label: 'HIPAA', color: 'bg-purple-500' },
  { value: 'PCI_DSS', label: 'PCI DSS', color: 'bg-orange-500' },
  { value: 'SOC2', label: 'SOC 2', color: 'bg-red-500' },
  { value: 'ISO27001', label: 'ISO 27001', color: 'bg-indigo-500' },
  { value: 'NIST', label: 'NIST', color: 'bg-teal-500' }
];

const SEVERITY_COLORS = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
};

const STATUS_COLORS = {
  open: 'bg-red-100 text-red-800',
  acknowledged: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  false_positive: 'bg-gray-100 text-gray-800'
};

export default function AuditComplianceDashboard() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [complianceMetrics, setComplianceMetrics] = useState<ComplianceMetrics | null>(null);
  const [complianceViolations, setComplianceViolations] = useState<ComplianceViolation[]>([]);
  const [complianceRules, setComplianceRules] = useState<ComplianceRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStandard, setSelectedStandard] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');

  // Filters for audit logs
  const [auditFilters, setAuditFilters] = useState({
    resource: '',
    action: '',
    userId: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchData();
  }, [selectedTimeRange]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchAuditLogs(),
        fetchComplianceMetrics(),
        fetchComplianceViolations(),
        fetchComplianceRules()
      ]);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const params = new URLSearchParams({
        limit: '100',
        includeMetadata: 'false',
        analytics: 'true',
        ...auditFilters
      });

      const response = await fetch(`/api/audit-logs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    }
  };

  const fetchComplianceMetrics = async () => {
    try {
      const days = selectedTimeRange === '24h' ? 1 : 
                   selectedTimeRange === '7d' ? 7 : 
                   selectedTimeRange === '30d' ? 30 : 90;

      const response = await fetch(`/api/audit-logs/compliance?action=dashboard&days=${days}`);
      if (response.ok) {
        const data = await response.json();
        setComplianceMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Failed to fetch compliance metrics:', error);
    }
  };

  const fetchComplianceViolations = async () => {
    try {
      const params = new URLSearchParams({
        standard: selectedStandard === 'all' ? '' : selectedStandard,
        severity: selectedSeverity === 'all' ? '' : selectedSeverity
      });

      const response = await fetch(`/api/audit-logs/compliance?action=violations&${params}`);
      if (response.ok) {
        const data = await response.json();
        setComplianceViolations(data.violations || []);
      }
    } catch (error) {
      console.error('Failed to fetch compliance violations:', error);
    }
  };

  const fetchComplianceRules = async () => {
    try {
      const response = await fetch('/api/audit-logs/compliance?action=rules');
      if (response.ok) {
        const data = await response.json();
        setComplianceRules(data.rules || []);
      }
    } catch (error) {
      console.error('Failed to fetch compliance rules:', error);
    }
  };

  const runComplianceCheck = async () => {
    try {
      const response = await fetch('/api/audit-logs/compliance?action=check&lookbackHours=24');
      if (response.ok) {
        const data = await response.json();
        toast.success(`Compliance check completed. Found ${data.violations.length} new violations.`);
        fetchComplianceViolations();
      } else {
        toast.error('Failed to run compliance check');
      }
    } catch (error) {
      console.error('Failed to run compliance check:', error);
      toast.error('Failed to run compliance check');
    }
  };

  const exportAuditLogs = async (format: 'json' | 'csv' | 'xml') => {
    try {
      const params = new URLSearchParams({
        export: format,
        limit: '10000',
        ...auditFilters
      });

      const response = await fetch(`/api/audit-logs?${params}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`Audit logs exported as ${format.toUpperCase()}`);
      } else {
        toast.error('Failed to export audit logs');
      }
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      toast.error('Failed to export audit logs');
    }
  };

  const generateComplianceReport = async (standard: string) => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

      const response = await fetch('/api/audit-logs/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_report',
          reportStandard: standard,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reportType: 'periodic'
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`${standard} compliance report generated successfully`);
        // In a real app, you might download or display the report
      } else {
        toast.error('Failed to generate compliance report');
      }
    } catch (error) {
      console.error('Failed to generate compliance report:', error);
      toast.error('Failed to generate compliance report');
    }
  };

  const resolveViolation = async (violationId: string, resolution: { action: string; details: string }) => {
    try {
      const response = await fetch('/api/audit-logs/compliance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolve_violation',
          violationId,
          resolution
        })
      });

      if (response.ok) {
        toast.success('Violation resolved successfully');
        fetchComplianceViolations();
      } else {
        toast.error('Failed to resolve violation');
      }
    } catch (error) {
      console.error('Failed to resolve violation:', error);
      toast.error('Failed to resolve violation');
    }
  };

  const getRiskTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'degrading':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <TrendingUp className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRiskLevelColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const filteredAuditLogs = auditLogs.filter(log => {
    if (searchQuery && !log.userName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !log.action.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !log.resource.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold">Audit & Compliance</h1>
          <p className="text-sm sm:text-base text-gray-600">Monitor system activities and ensure regulatory compliance</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={runComplianceCheck} className="w-full sm:w-auto">
            <Shield className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Run Check</span>
            <span className="sm:hidden">Check</span>
          </Button>
        </div>
      </div>

      {/* Compliance Overview Cards */}
      {complianceMetrics && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Compliance Score</CardTitle>
              <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-xl sm:text-2xl font-bold ${getRiskLevelColor(complianceMetrics.overallScore)}`}>
                {complianceMetrics.overallScore}%
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {getRiskTrendIcon(complianceMetrics.riskTrend)}
                <span className="capitalize hidden sm:inline">{complianceMetrics.riskTrend}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Open Violations</CardTitle>
              <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">
                {Object.values(complianceMetrics.violationsBySeverity).reduce((a, b) => a + b, 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                {complianceMetrics.violationsBySeverity.critical || 0} critical
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Audit Events</CardTitle>
              <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{auditLogs.length.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">
                <span className="hidden sm:inline">{new Set(auditLogs.map(l => l.userId)).size} unique users</span>
                <span className="sm:hidden">{new Set(auditLogs.map(l => l.userId)).size} users</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Standards Monitored</CardTitle>
              <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">
                {Object.keys(complianceMetrics.violationsByStandard).length}
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="hidden sm:inline">{complianceRules.length} rules active</span>
                <span className="sm:hidden">{complianceRules.length} rules</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="audit-logs" className="text-xs sm:text-sm">Audit Logs</TabsTrigger>
          <TabsTrigger value="violations" className="text-xs sm:text-sm">Violations</TabsTrigger>
          <TabsTrigger value="rules" className="text-xs sm:text-sm hidden sm:flex">Rules</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs sm:text-sm">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Compliance by Standard */}
          {complianceMetrics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Violations by Standard</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Distribution of compliance violations across standards</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(complianceMetrics.violationsByStandard).map(([standard, count]) => {
                      const standardInfo = COMPLIANCE_STANDARDS.find(s => s.value === standard);
                      return (
                        <div key={standard} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded ${standardInfo?.color || 'bg-gray-500'}`} />
                            <span className="font-medium">{standardInfo?.label || standard}</span>
                          </div>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Compliance by Category</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Compliance scores across different control categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(complianceMetrics.complianceByCategory).map(([category, score]) => (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">
                            {category.replace('_', ' ')}
                          </span>
                          <span className={`text-sm font-bold ${getRiskLevelColor(score)}`}>
                            {score}%
                          </span>
                        </div>
                        <Progress value={score} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Recent Violations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Recent Violations</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Latest compliance violations requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              {complianceMetrics?.recentViolations.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-green-700">No Recent Violations</h3>
                  <p className="text-gray-500">All compliance checks are passing</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {complianceMetrics?.recentViolations.slice(0, 5).map((violation) => (
                    <div key={violation.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                        violation.severity === 'critical' ? 'text-red-500' :
                        violation.severity === 'high' ? 'text-orange-500' :
                        violation.severity === 'medium' ? 'text-yellow-500' : 'text-gray-500'
                      }`} />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{violation.ruleName}</p>
                          <Badge className={SEVERITY_COLORS[violation.severity]}>
                            {violation.severity}
                          </Badge>
                          <Badge variant="outline">{violation.standard}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{violation.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Detected {new Date(violation.detectedAt).toLocaleString()}</span>
                          <span>{violation.evidence.summary}</span>
                        </div>
                      </div>
                      
                      <Button size="sm" variant="outline">
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit-logs" className="space-y-4">
          {/* Audit Logs Filters */}
          <Card>
            <CardContent className="pt-4 sm:pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="sm:col-span-2 lg:col-span-1">
                  <Label className="text-xs sm:text-sm">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-xs sm:text-sm">Resource</Label>
                  <Input
                    placeholder="Filter by resource"
                    value={auditFilters.resource}
                    onChange={(e) => setAuditFilters(prev => ({ ...prev, resource: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label className="text-xs sm:text-sm">Action</Label>
                  <Input
                    placeholder="Filter by action"
                    value={auditFilters.action}
                    onChange={(e) => setAuditFilters(prev => ({ ...prev, action: e.target.value }))}
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 sm:col-span-2 lg:col-span-1">
                  <Button onClick={fetchAuditLogs} className="flex-1">
                    <Filter className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Filter</span>
                    <span className="sm:hidden">Apply</span>
                  </Button>
                  
                  <Button variant="outline" onClick={() => exportAuditLogs('csv')} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Export</span>
                    <span className="sm:hidden">CSV</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Audit Logs Table */}
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>Detailed system activity logs</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAuditLogs.slice(0, 20).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.userName}</div>
                          <div className="text-xs text-gray-500">{log.userId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.resource}</div>
                          {log.resourceId && (
                            <div className="text-xs text-gray-500">{log.resourceId}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.ipAddress}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="violations" className="space-y-4">
          {/* Violations Filters */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <Select value={selectedStandard} onValueChange={setSelectedStandard}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Standards" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Standards</SelectItem>
                {COMPLIANCE_STANDARDS.map(standard => (
                  <SelectItem key={standard.value} value={standard.value}>
                    {standard.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Severities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={fetchComplianceViolations} className="w-full sm:w-auto">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>

          {/* Violations List */}
          <div className="space-y-4">
            {complianceViolations.map((violation) => (
              <Card key={violation.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{violation.ruleName}</h3>
                        <Badge className={SEVERITY_COLORS[violation.severity]}>
                          {violation.severity}
                        </Badge>
                        <Badge variant="outline">{violation.standard}</Badge>
                        <Badge className={STATUS_COLORS[violation.status]}>
                          {violation.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <p className="text-gray-600 mb-3">{violation.description}</p>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Detected:</span> {new Date(violation.detectedAt).toLocaleString()}
                        </div>
                        <div>
                          <span className="font-medium">Evidence:</span> {violation.evidence.summary}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Eye className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{violation.ruleName}</DialogTitle>
                            <DialogDescription>Compliance violation details</DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-semibold">Description</h4>
                              <p className="text-sm text-gray-600">{violation.description}</p>
                            </div>
                            
                            <div>
                              <h4 className="font-semibold">Evidence</h4>
                              <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
                                {JSON.stringify(violation.evidence.details, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      {violation.status === 'open' && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolve
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Resolve Violation</DialogTitle>
                              <DialogDescription>
                                Provide details about how this violation was resolved
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="action">Action Taken</Label>
                                <Input
                                  id="action"
                                  placeholder="e.g., Fixed access controls"
                                />
                              </div>
                              
                              <div>
                                <Label htmlFor="details">Details</Label>
                                <Textarea
                                  id="details"
                                  placeholder="Detailed explanation of the resolution..."
                                  rows={4}
                                />
                              </div>
                              
                              <Button 
                                onClick={() => resolveViolation(violation.id, {
                                  action: 'Manual resolution',
                                  details: 'Resolved via dashboard'
                                })}
                              >
                                Mark as Resolved
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Rules</CardTitle>
              <CardDescription>Active compliance monitoring rules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {complianceRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{rule.name}</h4>
                        <Badge className={SEVERITY_COLORS[rule.severity as keyof typeof SEVERITY_COLORS]}>
                          {rule.severity}
                        </Badge>
                        <Badge variant="outline">{rule.standard}</Badge>
                        {rule.enabled ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-800">Disabled</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{rule.description}</p>
                    </div>
                    
                    <Button size="sm" variant="outline">
                      <Settings className="h-3 w-3 mr-1" />
                      Configure
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {COMPLIANCE_STANDARDS.map((standard) => (
              <Card key={standard.value}>
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex items-center gap-3 mb-3 sm:mb-4">
                    <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded ${standard.color}`} />
                    <h3 className="font-semibold text-sm sm:text-base">{standard.label}</h3>
                  </div>
                  
                  <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                    Generate comprehensive compliance report for {standard.label}
                  </p>
                  
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => generateComplianceReport(standard.value)}
                    size="sm"
                  >
                    <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                    <span className="hidden sm:inline">Generate Report</span>
                    <span className="sm:hidden">Generate</span>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}