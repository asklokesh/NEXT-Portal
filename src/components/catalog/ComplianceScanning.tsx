'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  FileText,
  Download,
  RefreshCw,
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Calendar,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Lock,
  Key,
  FileWarning,
  UserCheck,
  GitBranch,
  Tag,
  Link,
  DollarSign,
  Building2,
  Loader2,
  ChevronRight,
  ExternalLink,
  Copy,
  Settings,
  Play,
  Pause,
  Zap,
  Target,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from '@/services/backstage/types/entities';
import { ComplianceScanner, ComplianceScanResult, ComplianceViolation } from '@/lib/security/ComplianceScanner';
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
  ResponsiveContainer,
} from 'recharts';

interface ComplianceScanningProps {
  entities: Entity[];
  className?: string;
}

interface ScanHistory {
  date: string;
  score: number;
  passed: number;
  failed: number;
}

interface ComplianceStats {
  totalScanned: number;
  averageScore: number;
  criticalViolations: number;
  highViolations: number;
  mediumViolations: number;
  lowViolations: number;
  topViolations: Array<{
    ruleName: string;
    count: number;
    severity: string;
  }>;
  categoryBreakdown: Array<{
    category: string;
    passed: number;
    failed: number;
  }>;
}

const SEVERITY_COLORS = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#F59E0B',
  low: '#3B82F6',
};

const CATEGORY_ICONS = {
  security: Shield,
  compliance: FileWarning,
  'best-practice': CheckCircle,
  governance: Building2,
};

export function ComplianceScanning({ entities, className }: ComplianceScanningProps) {
  const [scanner] = useState(() => new ComplianceScanner());
  const [scanResults, setScanResults] = useState<ComplianceScanResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<ComplianceScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScan, setAutoScan] = useState(false);
  const [showOnlyViolations, setShowOnlyViolations] = useState(false);
  const [selectedEntities, setSelectedEntities] = useState<string[]>([]);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([]);

  // Run initial scan
  useEffect(() => {
    if (entities.length > 0 && scanResults.length === 0) {
      runComplianceScan();
    }
  }, [entities]);

  // Auto-scan effect
  useEffect(() => {
    if (autoScan) {
      const interval = setInterval(() => {
        runComplianceScan();
      }, 5 * 60 * 1000); // 5 minutes

      return () => clearInterval(interval);
    }
  }, [autoScan]);

  const runComplianceScan = async () => {
    setIsScanning(true);
    setScanProgress(0);
    
    try {
      const entitiesToScan = selectedEntities.length > 0
        ? entities.filter(e => {
            const entityId = e.metadata.uid || `${e.kind}-${e.metadata.name}`;
            return selectedEntities.includes(entityId);
          })
        : entities;

      const results: ComplianceScanResult[] = [];
      const totalEntities = entitiesToScan.length;

      for (let i = 0; i < entitiesToScan.length; i++) {
        const entity = entitiesToScan[i];
        const result = await scanner.scanEntity(entity);
        results.push(result);
        setScanProgress(((i + 1) / totalEntities) * 100);
      }

      setScanResults(results);
      
      // Update scan history
      const avgScore = Math.round(
        results.reduce((sum, r) => sum + r.overallScore, 0) / results.length
      );
      const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
      
      setScanHistory(prev => [...prev, {
        date: new Date().toISOString(),
        score: avgScore,
        passed: totalPassed,
        failed: totalFailed,
      }].slice(-10)); // Keep last 10 scans
    } catch (error) {
      console.error('Compliance scan failed:', error);
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  // Calculate statistics
  const stats = useMemo<ComplianceStats>(() => {
    if (scanResults.length === 0) {
      return {
        totalScanned: 0,
        averageScore: 0,
        criticalViolations: 0,
        highViolations: 0,
        mediumViolations: 0,
        lowViolations: 0,
        topViolations: [],
        categoryBreakdown: [],
      };
    }

    const violations = scanResults.flatMap(r => r.violations);
    const violationCounts = new Map<string, { count: number; severity: string }>();
    
    violations.forEach(v => {
      const key = v.ruleName;
      if (violationCounts.has(key)) {
        violationCounts.get(key)!.count++;
      } else {
        violationCounts.set(key, { count: 1, severity: v.severity });
      }
    });

    const topViolations = Array.from(violationCounts.entries())
      .map(([ruleName, data]) => ({ ruleName, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const categoryBreakdown = new Map<string, { passed: number; failed: number }>();
    scanResults.forEach(result => {
      result.violations.forEach(v => {
        if (!categoryBreakdown.has(v.category)) {
          categoryBreakdown.set(v.category, { passed: 0, failed: 0 });
        }
        categoryBreakdown.get(v.category)!.failed++;
      });
    });

    // Add passed counts
    const rules = scanner.getAllRules();
    scanResults.forEach(result => {
      rules.forEach(rule => {
        const hasViolation = result.violations.some(v => v.ruleId === rule.id);
        if (!hasViolation) {
          if (!categoryBreakdown.has(rule.category)) {
            categoryBreakdown.set(rule.category, { passed: 0, failed: 0 });
          }
          categoryBreakdown.get(rule.category)!.passed++;
        }
      });
    });

    return {
      totalScanned: scanResults.length,
      averageScore: Math.round(
        scanResults.reduce((sum, r) => sum + r.overallScore, 0) / scanResults.length
      ),
      criticalViolations: violations.filter(v => v.severity === 'critical').length,
      highViolations: violations.filter(v => v.severity === 'high').length,
      mediumViolations: violations.filter(v => v.severity === 'medium').length,
      lowViolations: violations.filter(v => v.severity === 'low').length,
      topViolations,
      categoryBreakdown: Array.from(categoryBreakdown.entries()).map(([category, data]) => ({
        category,
        ...data,
      })),
    };
  }, [scanResults, scanner]);

  // Filter results
  const filteredResults = useMemo(() => {
    let results = [...scanResults];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(r => 
        r.entityName.toLowerCase().includes(query) ||
        r.entityKind.toLowerCase().includes(query) ||
        r.entityRef.toLowerCase().includes(query)
      );
    }

    if (showOnlyViolations) {
      results = results.filter(r => r.violations.length > 0);
    }

    if (filterCategory !== 'all') {
      results = results.filter(r => 
        r.violations.some(v => v.category === filterCategory)
      );
    }

    if (filterSeverity !== 'all') {
      results = results.filter(r => 
        r.violations.some(v => v.severity === filterSeverity)
      );
    }

    return results;
  }, [scanResults, searchQuery, showOnlyViolations, filterCategory, filterSeverity]);

  const exportReport = () => {
    const report = {
      scanDate: new Date().toISOString(),
      summary: {
        totalEntities: stats.totalScanned,
        averageScore: stats.averageScore,
        violations: {
          critical: stats.criticalViolations,
          high: stats.highViolations,
          medium: stats.mediumViolations,
          low: stats.lowViolations,
        },
      },
      results: scanResults,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ShieldOff className="h-4 w-4" />;
      case 'high':
        return <ShieldAlert className="h-4 w-4" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4" />;
      case 'low':
        return <Info className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    return SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || '#6B7280';
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Compliance & Security Scanning</h2>
          <p className="text-muted-foreground mt-1">
            Automated scanning for security vulnerabilities, compliance violations, and best practices
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 border rounded-md text-sm">
            <Activity className={cn("h-4 w-4", autoScan ? "text-green-500" : "text-gray-400")} />
            <span>Auto-scan</span>
            <Switch
              checked={autoScan}
              onCheckedChange={setAutoScan}
            />
          </div>
          
          <Button
            variant="outline"
            onClick={exportReport}
            disabled={scanResults.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          
          <Button
            onClick={runComplianceScan}
            disabled={isScanning}
          >
            {isScanning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Scan
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Scanning Progress */}
      {isScanning && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Scanning entities...</span>
                <span>{Math.round(scanProgress)}%</span>
              </div>
              <Progress value={scanProgress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageScore}%</div>
            <div className="flex items-center gap-1 mt-1">
              {stats.averageScore >= 80 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-500">Good compliance</span>
                </>
              ) : stats.averageScore >= 60 ? (
                <>
                  <Minus className="h-3 w-3 text-yellow-500" />
                  <span className="text-xs text-yellow-500">Needs improvement</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-xs text-red-500">Poor compliance</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <ShieldOff className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.criticalViolations}</div>
            <p className="text-xs text-muted-foreground">
              Immediate action required
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Violations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.criticalViolations + stats.highViolations + stats.mediumViolations + stats.lowViolations}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                H: {stats.highViolations}
              </Badge>
              <Badge variant="outline" className="text-xs">
                M: {stats.mediumViolations}
              </Badge>
              <Badge variant="outline" className="text-xs">
                L: {stats.lowViolations}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entities Scanned</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalScanned}</div>
            <p className="text-xs text-muted-foreground">
              Last scan: {scanResults.length > 0 ? new Date(scanResults[0].scanDate).toLocaleTimeString() : 'Never'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="results" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="results">Scan Results</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="results" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search entities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="best-practice">Best Practice</SelectItem>
                    <SelectItem value="governance">Governance</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex items-center gap-2">
                  <Switch
                    id="violations-only"
                    checked={showOnlyViolations}
                    onCheckedChange={setShowOnlyViolations}
                  />
                  <Label htmlFor="violations-only" className="text-sm">
                    Violations only
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results List */}
          <div className="space-y-2">
            {filteredResults.map((result) => (
              <Card
                key={result.entityRef}
                className={cn(
                  "cursor-pointer transition-colors",
                  selectedResult?.entityRef === result.entityRef && "ring-2 ring-primary"
                )}
                onClick={() => setSelectedResult(result)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{result.entityName}</h4>
                        <Badge variant="outline" className="text-xs">
                          {result.entityKind}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{result.entityRef}</p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold">
                          {result.overallScore}%
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {result.violations.length === 0 ? (
                            <Badge variant="outline" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Compliant
                            </Badge>
                          ) : (
                            <>
                              {result.violations.filter(v => v.severity === 'critical').length > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {result.violations.filter(v => v.severity === 'critical').length} Critical
                                </Badge>
                              )}
                              {result.violations.filter(v => v.severity === 'high').length > 0 && (
                                <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">
                                  {result.violations.filter(v => v.severity === 'high').length} High
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="violations" className="space-y-4">
          {/* Top Violations */}
          <Card>
            <CardHeader>
              <CardTitle>Top Violations</CardTitle>
              <CardDescription>Most common compliance violations across all entities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.topViolations.map((violation, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{violation.ruleName}</p>
                        <Badge
                          variant="outline"
                          className="text-xs mt-1"
                          style={{ borderColor: getSeverityColor(violation.severity), color: getSeverityColor(violation.severity) }}
                        >
                          {violation.severity}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">{violation.count}</p>
                      <p className="text-xs text-muted-foreground">occurrences</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Category Breakdown</CardTitle>
              <CardDescription>Compliance status by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.categoryBreakdown.map((category) => {
                  const total = category.passed + category.failed;
                  const percentage = total > 0 ? (category.passed / total) * 100 : 0;
                  const Icon = CATEGORY_ICONS[category.category as keyof typeof CATEGORY_ICONS] || Shield;
                  
                  return (
                    <div key={category.category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="capitalize font-medium">{category.category}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {category.passed}/{total} passed ({Math.round(percentage)}%)
                        </span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {/* Score Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance Score Trend</CardTitle>
              <CardDescription>Average compliance score over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scanHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value) => `${value}%`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Severity Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Violation Severity Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Critical', value: stats.criticalViolations, color: SEVERITY_COLORS.critical },
                          { name: 'High', value: stats.highViolations, color: SEVERITY_COLORS.high },
                          { name: 'Medium', value: stats.mediumViolations, color: SEVERITY_COLORS.medium },
                          { name: 'Low', value: stats.lowViolations, color: SEVERITY_COLORS.low },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {[
                          { name: 'Critical', value: stats.criticalViolations, color: SEVERITY_COLORS.critical },
                          { name: 'High', value: stats.highViolations, color: SEVERITY_COLORS.high },
                          { name: 'Medium', value: stats.mediumViolations, color: SEVERITY_COLORS.medium },
                          { name: 'Low', value: stats.lowViolations, color: SEVERITY_COLORS.low },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pass/Fail by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.categoryBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="passed" stackId="a" fill="#10B981" />
                      <Bar dataKey="failed" stackId="a" fill="#EF4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Rules</CardTitle>
              <CardDescription>All active compliance and security rules</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {scanner.getAllRules().map((rule) => {
                  const Icon = CATEGORY_ICONS[rule.category as keyof typeof CATEGORY_ICONS] || Shield;
                  
                  return (
                    <AccordionItem key={rule.id} value={rule.id}>
                      <AccordionTrigger>
                        <div className="flex items-center gap-3 text-left">
                          <Icon className="h-4 w-4" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{rule.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {rule.id}
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-xs"
                                style={{ 
                                  borderColor: getSeverityColor(rule.severity), 
                                  color: getSeverityColor(rule.severity) 
                                }}
                              >
                                {rule.severity}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {rule.description}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3 pt-2">
                          <div>
                            <Label className="text-sm">Category</Label>
                            <p className="text-sm text-muted-foreground capitalize">{rule.category}</p>
                          </div>
                          <div>
                            <Label className="text-sm">Tags</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {rule.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Selected Result Detail */}
      {selectedResult && (
        <Dialog open={!!selectedResult} onOpenChange={() => setSelectedResult(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Compliance Report: {selectedResult.entityName}</DialogTitle>
              <DialogDescription>
                Detailed compliance scan results for {selectedResult.entityRef}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                {/* Summary */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Overall Score</p>
                    <p className="text-3xl font-bold">{selectedResult.overallScore}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={selectedResult.violations.length === 0 ? 'default' : 'destructive'}>
                        {selectedResult.violations.length === 0 ? 'Compliant' : `${selectedResult.violations.length} Violations`}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Violations */}
                {selectedResult.violations.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Violations
                    </h4>
                    {selectedResult.violations.map((violation, index) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  {getSeverityIcon(violation.severity)}
                                  <h5 className="font-medium">{violation.ruleName}</h5>
                                  <Badge
                                    variant="outline"
                                    className="text-xs"
                                    style={{ 
                                      borderColor: getSeverityColor(violation.severity), 
                                      color: getSeverityColor(violation.severity) 
                                    }}
                                  >
                                    {violation.severity}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{violation.message}</p>
                              </div>
                            </div>
                            
                            {violation.details && (
                              <Alert>
                                <Info className="h-4 w-4" />
                                <AlertDescription>{violation.details}</AlertDescription>
                              </Alert>
                            )}
                            
                            {violation.remediation && (
                              <div className="space-y-1">
                                <Label className="text-sm">Remediation</Label>
                                <p className="text-sm text-muted-foreground">{violation.remediation}</p>
                              </div>
                            )}
                            
                            {violation.references && violation.references.length > 0 && (
                              <div className="space-y-1">
                                <Label className="text-sm">References</Label>
                                <div className="space-y-1">
                                  {violation.references.map((ref, i) => (
                                    <a
                                      key={i}
                                      href={ref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-primary hover:underline flex items-center gap-1"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      {ref}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Suggestions */}
                {selectedResult.suggestions.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Suggestions
                    </h4>
                    {selectedResult.suggestions.map((suggestion, index) => (
                      <Alert key={index}>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          <Badge variant="outline" className="mr-2 text-xs">
                            {suggestion.priority}
                          </Badge>
                          {suggestion.message}
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedResult(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}