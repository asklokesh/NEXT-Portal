'use client';

/**
 * Kubernetes V2 Plugin - Security Dashboard
 * Advanced security monitoring and compliance dashboard
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  Activity,
  FileSearch,
  Lock,
  Unlock,
  Eye,
  Download,
  RefreshCw,
  Zap
} from 'lucide-react';

export function SecurityDashboard() {
  const [securityData, setSecurityData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedSeverity, setSelectedSeverity] = useState('all');

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/kubernetes-v2?action=security-summary');
      const data = await response.json();
      setSecurityData(data.data);
    } catch (error) {
      console.error('Failed to load security data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Mock data for demonstration
  const mockVulnerabilities = [
    {
      id: 'CVE-2023-12345',
      severity: 'critical',
      title: 'Container Image Vulnerability',
      description: 'Critical vulnerability in nginx image',
      cluster: 'prod-cluster-east',
      workload: 'web-frontend',
      component: 'nginx:1.18.0',
      discovered: '2023-10-15',
      status: 'open'
    },
    {
      id: 'CVE-2023-12346',
      severity: 'high',
      title: 'Privilege Escalation Risk',
      description: 'Pod running with elevated privileges',
      cluster: 'staging-cluster',
      workload: 'api-backend',
      component: 'application',
      discovered: '2023-10-14',
      status: 'mitigated'
    },
    {
      id: 'CVE-2023-12347',
      severity: 'medium',
      title: 'Network Policy Gap',
      description: 'Missing network policy for namespace',
      cluster: 'dev-cluster',
      workload: 'database',
      component: 'postgres:13',
      discovered: '2023-10-13',
      status: 'open'
    }
  ];

  const mockComplianceChecks = [
    {
      framework: 'CIS Kubernetes Benchmark',
      version: '1.6.0',
      totalChecks: 150,
      passed: 135,
      failed: 12,
      warnings: 3,
      score: 90
    },
    {
      framework: 'NIST Cybersecurity Framework',
      version: '1.1',
      totalChecks: 75,
      passed: 68,
      failed: 5,
      warnings: 2,
      score: 91
    },
    {
      framework: 'PCI DSS',
      version: '4.0',
      totalChecks: 45,
      passed: 38,
      failed: 6,
      warnings: 1,
      score: 84
    }
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
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
          <h2 className="text-2xl font-bold">Security Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time security monitoring and compliance tracking
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadSecurityData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button size="sm">
            <Zap className="h-4 w-4 mr-2" />
            Run Security Scan
          </Button>
        </div>
      </div>

      {/* Security Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87%</div>
            <Progress value={87} className="mt-2" />
            <div className="text-xs text-muted-foreground mt-1">
              Security compliance
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vulnerabilities</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">23</div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-red-600">5 critical</span>
              <span className="text-orange-600">8 high</span>
              <span className="text-yellow-600">10 medium</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">89%</div>
            <div className="text-xs text-muted-foreground">
              241/270 checks passed
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Scan</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2h ago</div>
            <div className="text-xs text-muted-foreground">
              All clusters scanned
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vulnerabilities">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Security Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Security Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Vulnerabilities Fixed</span>
                    <Badge variant="secondary">+12 this week</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">New Vulnerabilities</span>
                    <Badge variant="destructive">+3 this week</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Compliance Score</span>
                    <Badge variant="outline">+2% this month</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Policy Violations</span>
                    <Badge variant="secondary">-5 this week</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Security Issues */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Top Security Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { issue: 'Containers running as root', count: 12, severity: 'high' },
                    { issue: 'Missing network policies', count: 8, severity: 'medium' },
                    { issue: 'Outdated container images', count: 15, severity: 'high' },
                    { issue: 'Excessive RBAC permissions', count: 6, severity: 'medium' }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`h-4 w-4 ${getSeverityColor(item.severity)}`} />
                        <span className="text-sm">{item.issue}</span>
                      </div>
                      <Badge variant={getSeverityBadge(item.severity)}>
                        {item.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cluster Security Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Cluster Security Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: 'prod-cluster-east', score: 92, vulnerabilities: 5, status: 'healthy' },
                  { name: 'staging-cluster-west', score: 85, vulnerabilities: 8, status: 'warning' },
                  { name: 'dev-cluster-central', score: 78, vulnerabilities: 12, status: 'needs-attention' }
                ].map((cluster) => (
                  <div key={cluster.name} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{cluster.name}</h3>
                      <Badge variant={
                        cluster.status === 'healthy' ? 'secondary' :
                        cluster.status === 'warning' ? 'secondary' : 'destructive'
                      }>
                        {cluster.status}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Security Score</span>
                        <span className="font-semibold">{cluster.score}%</span>
                      </div>
                      <Progress value={cluster.score} />
                      <div className="flex justify-between text-sm">
                        <span>Vulnerabilities</span>
                        <span className="text-red-600 font-semibold">{cluster.vulnerabilities}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vulnerabilities" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex border rounded-md">
                {['all', 'critical', 'high', 'medium', 'low'].map((severity) => (
                  <Button
                    key={severity}
                    variant={selectedSeverity === severity ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setSelectedSeverity(severity)}
                    className="rounded-none first:rounded-l-md last:rounded-r-md capitalize"
                  >
                    {severity}
                  </Button>
                ))}
              </div>
            </div>
            
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Vulnerability List</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockVulnerabilities
                  .filter(vuln => selectedSeverity === 'all' || vuln.severity === selectedSeverity)
                  .map((vulnerability) => (
                    <div key={vulnerability.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{vulnerability.title}</h3>
                            <Badge variant={getSeverityBadge(vulnerability.severity)}>
                              {vulnerability.severity}
                            </Badge>
                            <Badge variant={vulnerability.status === 'open' ? 'destructive' : 'secondary'}>
                              {vulnerability.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {vulnerability.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>ID: {vulnerability.id}</span>
                            <span>Cluster: {vulnerability.cluster}</span>
                            <span>Workload: {vulnerability.workload}</span>
                            <span>Component: {vulnerability.component}</span>
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {new Date(vulnerability.discovered).toLocaleDateString()}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-3 w-3 mr-1" />
                          View Details
                        </Button>
                        <Button size="sm" variant="outline">
                          <FileSearch className="h-3 w-3 mr-1" />
                          Remediate
                        </Button>
                        {vulnerability.status === 'open' && (
                          <Button size="sm">
                            Mark as Mitigated
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <div className="grid gap-6">
            {mockComplianceChecks.map((framework) => (
              <Card key={framework.framework}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{framework.framework}</CardTitle>
                      <p className="text-sm text-muted-foreground">Version {framework.version}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{framework.score}%</div>
                      <p className="text-xs text-muted-foreground">Compliance Score</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Progress value={framework.score} className="h-2" />
                    
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-lg font-semibold text-green-600">
                          {framework.passed}
                        </div>
                        <div className="text-xs text-muted-foreground">Passed</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-red-600">
                          {framework.failed}
                        </div>
                        <div className="text-xs text-muted-foreground">Failed</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-yellow-600">
                          {framework.warnings}
                        </div>
                        <div className="text-xs text-muted-foreground">Warnings</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold">
                          {framework.totalChecks}
                        </div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                      <Button size="sm" variant="outline">
                        Generate Report
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="policies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Security Policies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: 'Pod Security Standards', status: 'enforced', violations: 0 },
                  { name: 'Network Policies', status: 'monitoring', violations: 3 },
                  { name: 'Image Security Policies', status: 'enforced', violations: 2 },
                  { name: 'RBAC Policies', status: 'enforced', violations: 0 },
                  { name: 'Resource Quotas', status: 'enforced', violations: 1 }
                ].map((policy, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center gap-3">
                      {policy.status === 'enforced' ? (
                        <Lock className="h-4 w-4 text-green-500" />
                      ) : (
                        <Unlock className="h-4 w-4 text-yellow-500" />
                      )}
                      <div>
                        <p className="font-medium">{policy.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {policy.status}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={policy.violations > 0 ? 'destructive' : 'secondary'}>
                        {policy.violations} violations
                      </Badge>
                      <Button size="sm" variant="outline">
                        Configure
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}