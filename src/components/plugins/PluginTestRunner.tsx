'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Download, 
  Settings, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Activity,
  BarChart3,
  FileText,
  History,
  TrendingUp,
  TrendingDown,
  Shield,
  Zap,
  Target,
  Eye,
  ExternalLink
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface TestConfig {
  pluginId: string;
  testTypes: ('unit' | 'integration' | 'e2e' | 'performance' | 'security')[];
  dockerEnvironment?: string;
  config?: Record<string, any>;
  timeout?: number;
  coverage?: boolean;
  parallel?: boolean;
  environment?: 'local' | 'docker' | 'kubernetes';
}

interface TestResult {
  testId: string;
  pluginId: string;
  status: 'running' | 'passed' | 'failed' | 'cancelled';
  startTime: string;
  endTime?: string;
  duration?: number;
  results: {
    unit?: TestExecution;
    integration?: TestExecution;
    e2e?: TestExecution;
    performance?: PerformanceTestResult;
    security?: SecurityTestResult;
  };
  coverage?: CoverageReport;
  logs: string[];
  artifacts: string[];
}

interface TestExecution {
  status: 'passed' | 'failed' | 'skipped';
  testCount: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  duration: number;
  failures: TestFailure[];
  stdout: string;
  stderr: string;
}

interface PerformanceTestResult {
  status: 'passed' | 'failed';
  metrics: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  thresholds: Record<string, boolean>;
  k6Output: string;
}

interface SecurityTestResult {
  status: 'passed' | 'failed';
  vulnerabilities: {
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  findings: SecurityFinding[];
  tools: string[];
}

interface SecurityFinding {
  severity: 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  file?: string;
  line?: number;
  cwe?: string;
  recommendation: string;
}

interface TestFailure {
  testName: string;
  error: string;
  stack?: string;
  file?: string;
  line?: number;
}

interface CoverageReport {
  statements: { total: number; covered: number; percentage: number };
  branches: { total: number; covered: number; percentage: number };
  functions: { total: number; covered: number; percentage: number };
  lines: { total: number; covered: number; percentage: number };
  files: CoverageFileReport[];
}

interface CoverageFileReport {
  filename: string;
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

interface TestHistoryItem {
  testId: string;
  pluginId: string;
  status: string;
  startTime: string;
  endTime?: string;
  duration?: number;
}

export default function PluginTestRunner({ pluginId }: { pluginId: string }) {
  const [currentTest, setCurrentTest] = useState<TestResult | null>(null);
  const [testHistory, setTestHistory] = useState<TestHistoryItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [config, setConfig] = useState<TestConfig>({
    pluginId,
    testTypes: ['unit'],
    environment: 'local',
    timeout: 300000, // 5 minutes
    coverage: true,
    parallel: false
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [showSettings, setShowSettings] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [performanceHistory, setPerformanceHistory] = useState<any[]>([]);
  const [coverageHistory, setCoverageHistory] = useState<any[]>([]);
  const [testTrends, setTestTrends] = useState<any[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTestHistory();
    loadPerformanceHistory();
    loadCoverageHistory();
    loadTestTrends();
  }, [pluginId]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const loadTestHistory = async () => {
    try {
      const response = await fetch('/api/plugin-testing?action=list');
      if (response.ok) {
        const data = await response.json();
        const pluginHistory = [...data.active, ...data.completed]
          .filter((test: TestHistoryItem) => test.pluginId === pluginId)
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
          .slice(0, 20);
        setTestHistory(pluginHistory);
      }
    } catch (error) {
      console.error('Failed to load test history:', error);
    }
  };

  const loadPerformanceHistory = async () => {
    // Mock performance history data - in real implementation, load from API
    const mockData = Array.from({ length: 10 }, (_, i) => ({
      date: new Date(Date.now() - (9 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      avgResponseTime: 150 + Math.random() * 100,
      p95ResponseTime: 300 + Math.random() * 200,
      errorRate: Math.random() * 0.05,
      rps: 50 + Math.random() * 30
    }));
    setPerformanceHistory(mockData);
  };

  const loadCoverageHistory = async () => {
    // Mock coverage history data
    const mockData = Array.from({ length: 10 }, (_, i) => ({
      date: new Date(Date.now() - (9 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      statements: 75 + Math.random() * 20,
      branches: 70 + Math.random() * 25,
      functions: 80 + Math.random() * 15,
      lines: 78 + Math.random() * 18
    }));
    setCoverageHistory(mockData);
  };

  const loadTestTrends = async () => {
    // Mock test trends data
    const mockData = Array.from({ length: 15 }, (_, i) => ({
      date: new Date(Date.now() - (14 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      passed: 45 + Math.floor(Math.random() * 20),
      failed: Math.floor(Math.random() * 5),
      duration: 120 + Math.random() * 60
    }));
    setTestTrends(mockData);
  };

  const startTest = async () => {
    try {
      setIsRunning(true);
      setLogs([]);
      setCurrentTest(null);

      const response = await fetch('/api/plugin-testing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (response.ok) {
        const data = await response.json();
        startPolling(data.testId);
      } else {
        const error = await response.json();
        setLogs(prev => [...prev, `[ERROR] ${error.error}`]);
        setIsRunning(false);
      }
    } catch (error) {
      setLogs(prev => [...prev, `[ERROR] ${error}`]);
      setIsRunning(false);
    }
  };

  const stopTest = async () => {
    if (currentTest) {
      try {
        await fetch(`/api/plugin-testing?testId=${currentTest.testId}`, {
          method: 'DELETE'
        });
        setIsRunning(false);
        stopPolling();
      } catch (error) {
        console.error('Failed to stop test:', error);
      }
    }
  };

  const startPolling = (testId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/plugin-testing?testId=${testId}`);
        if (response.ok) {
          const data = await response.json();
          const result = data.result;
          
          setCurrentTest(result);
          setLogs(result.logs || []);
          
          if (result.status !== 'running') {
            setIsRunning(false);
            stopPolling();
            loadTestHistory();
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000);

    setPollingInterval(interval);
  };

  const stopPolling = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  const loadTestResult = async (testId: string) => {
    try {
      const response = await fetch(`/api/plugin-testing?testId=${testId}`);
      if (response.ok) {
        const data = await response.json();
        setCurrentTest(data.result);
      }
    } catch (error) {
      console.error('Failed to load test result:', error);
    }
  };

  const exportTestReport = () => {
    if (currentTest) {
      const report = {
        testId: currentTest.testId,
        pluginId: currentTest.pluginId,
        timestamp: new Date().toISOString(),
        results: currentTest.results,
        coverage: currentTest.coverage,
        summary: {
          status: currentTest.status,
          duration: currentTest.duration,
          totalTests: Object.values(currentTest.results).reduce((sum, result) => 
            sum + (result?.testCount || 0), 0
          ),
          passedTests: Object.values(currentTest.results).reduce((sum, result) => 
            sum + (result?.passedCount || 0), 0
          ),
          failedTests: Object.values(currentTest.results).reduce((sum, result) => 
            sum + (result?.failedCount || 0), 0
          )
        }
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-report-${currentTest.testId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="w-4 h-4 animate-pulse text-blue-500" />;
      case 'passed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'cancelled':
        return <Square className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'passed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getCoverageColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Current Test Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">Test Execution</CardTitle>
          <div className="flex items-center gap-2">
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Test Configuration</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Test Types</Label>
                    <div className="mt-2 space-y-2">
                      {['unit', 'integration', 'e2e', 'performance', 'security'].map(type => (
                        <div key={type} className="flex items-center space-x-2">
                          <Checkbox
                            id={type}
                            checked={config.testTypes.includes(type as any)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setConfig(prev => ({
                                  ...prev,
                                  testTypes: [...prev.testTypes, type as any]
                                }));
                              } else {
                                setConfig(prev => ({
                                  ...prev,
                                  testTypes: prev.testTypes.filter(t => t !== type)
                                }));
                              }
                            }}
                          />
                          <Label htmlFor={type} className="capitalize">{type}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="environment">Environment</Label>
                    <Select
                      value={config.environment}
                      onValueChange={(value) => setConfig(prev => ({ ...prev, environment: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local</SelectItem>
                        <SelectItem value="docker">Docker</SelectItem>
                        <SelectItem value="kubernetes">Kubernetes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="dockerEnv">Docker Environment</Label>
                    <Select
                      value={config.dockerEnvironment || ''}
                      onValueChange={(value) => setConfig(prev => ({ ...prev, dockerEnvironment: value }))}
                      disabled={config.environment !== 'docker'}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select database" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="postgres">PostgreSQL</SelectItem>
                        <SelectItem value="redis">Redis</SelectItem>
                        <SelectItem value="mongodb">MongoDB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="timeout">Timeout (ms)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      value={config.timeout}
                      onChange={(e) => setConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="coverage">Enable Coverage</Label>
                    <Switch
                      id="coverage"
                      checked={config.coverage}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, coverage: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="parallel">Run in Parallel</Label>
                    <Switch
                      id="parallel"
                      checked={config.parallel}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, parallel: checked }))}
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {!isRunning ? (
              <Button onClick={startTest} className="bg-green-600 hover:bg-green-700">
                <Play className="w-4 h-4 mr-2" />
                Run Tests
              </Button>
            ) : (
              <Button onClick={stopTest} variant="destructive">
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {currentTest ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(currentTest.status)}
                  <div>
                    <div className="font-medium">Test ID: {currentTest.testId}</div>
                    <div className="text-sm text-gray-600">
                      Started: {new Date(currentTest.startTime).toLocaleString()}
                    </div>
                  </div>
                </div>
                <Badge className={getStatusColor(currentTest.status)}>
                  {currentTest.status}
                </Badge>
              </div>

              {currentTest.status === 'running' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{Math.floor((Date.now() - new Date(currentTest.startTime).getTime()) / 1000)}s</span>
                  </div>
                  <Progress value={30} className="w-full" />
                </div>
              )}

              {currentTest.duration && (
                <div className="text-sm text-gray-600">
                  Duration: {Math.floor(currentTest.duration / 1000)}s
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(currentTest.results).map(([type, result]) => (
                  <div key={type} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <div className="text-sm font-medium capitalize">{type}</div>
                    {result && (
                      <div className="mt-1">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(result.status)}
                          <span className="text-sm">{result.status}</span>
                        </div>
                        {'testCount' in result && (
                          <div className="text-xs text-gray-600 mt-1">
                            {result.passedCount}/{result.testCount} passed
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={exportTestReport}
                  disabled={currentTest.status === 'running'}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/api/plugin-testing/artifacts?testId=${currentTest.testId}`, '_blank')}
                  disabled={currentTest.artifacts.length === 0}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Artifacts
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-4">No test running</div>
              <Button onClick={startTest} className="bg-green-600 hover:bg-green-700">
                <Play className="w-4 h-4 mr-2" />
                Start Test
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold">
                  {testHistory.length > 0 
                    ? Math.round((testHistory.filter(t => t.status === 'passed').length / testHistory.length) * 100)
                    : 0
                  }%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Duration</p>
                <p className="text-2xl font-bold">
                  {testHistory.length > 0 
                    ? Math.round(testHistory.reduce((sum, t) => sum + (t.duration || 0), 0) / testHistory.length / 1000)
                    : 0
                  }s
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Activity className="w-8 h-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Tests</p>
                <p className="text-2xl font-bold">{testHistory.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Shield className="w-8 h-8 text-orange-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Last Coverage</p>
                <p className="text-2xl font-bold">
                  {currentTest?.coverage?.statements.percentage 
                    ? Math.round(currentTest.coverage.statements.percentage)
                    : 0
                  }%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderLogs = () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Real-time Logs</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setLogs([])}
        >
          Clear Logs
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96">
          <div className="font-mono text-sm space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-500 italic">No logs available</div>
            ) : (
              logs.map((log, index) => (
                <div 
                  key={index}
                  className={`p-2 rounded ${
                    log.includes('[ERROR]') ? 'bg-red-50 text-red-800' :
                    log.includes('[WARN]') ? 'bg-yellow-50 text-yellow-800' :
                    log.includes('[PROGRESS]') ? 'bg-blue-50 text-blue-800' :
                    'bg-gray-50 text-gray-800'
                  }`}
                >
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );

  const renderCoverage = () => {
    if (!currentTest?.coverage) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-gray-500">No coverage data available</div>
          </CardContent>
        </Card>
      );
    }

    const coverage = currentTest.coverage;
    const coverageData = [
      { name: 'Statements', value: coverage.statements.percentage, color: '#8884d8' },
      { name: 'Branches', value: coverage.branches.percentage, color: '#82ca9d' },
      { name: 'Functions', value: coverage.functions.percentage, color: '#ffc658' },
      { name: 'Lines', value: coverage.lines.percentage, color: '#ff7300' }
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {coverageData.map((item, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{item.name}</p>
                    <p className={`text-2xl font-bold ${getCoverageColor(item.value)}`}>
                      {Math.round(item.value)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">
                      {item.name === 'Statements' && `${coverage.statements.covered}/${coverage.statements.total}`}
                      {item.name === 'Branches' && `${coverage.branches.covered}/${coverage.branches.total}`}
                      {item.name === 'Functions' && `${coverage.functions.covered}/${coverage.functions.total}`}
                      {item.name === 'Lines' && `${coverage.lines.covered}/${coverage.lines.total}`}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coverage Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={coverageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>File Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {coverage.files.slice(0, 10).map((file, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{file.filename}</div>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className={getCoverageColor(file.statements)}>
                      S: {Math.round(file.statements)}%
                    </span>
                    <span className={getCoverageColor(file.branches)}>
                      B: {Math.round(file.branches)}%
                    </span>
                    <span className={getCoverageColor(file.functions)}>
                      F: {Math.round(file.functions)}%
                    </span>
                    <span className={getCoverageColor(file.lines)}>
                      L: {Math.round(file.lines)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coverage History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={coverageHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="statements" stroke="#8884d8" strokeWidth={2} />
                  <Line type="monotone" dataKey="branches" stroke="#82ca9d" strokeWidth={2} />
                  <Line type="monotone" dataKey="functions" stroke="#ffc658" strokeWidth={2} />
                  <Line type="monotone" dataKey="lines" stroke="#ff7300" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderPerformance = () => {
    if (!currentTest?.results.performance) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-gray-500">No performance data available</div>
          </CardContent>
        </Card>
      );
    }

    const perf = currentTest.results.performance;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Zap className="w-8 h-8 text-yellow-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Response</p>
                  <p className="text-2xl font-bold">{Math.round(perf.metrics.averageResponseTime)}ms</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Target className="w-8 h-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">P95 Response</p>
                  <p className="text-2xl font-bold">{Math.round(perf.metrics.p95ResponseTime)}ms</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Activity className="w-8 h-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Requests/sec</p>
                  <p className="text-2xl font-bold">{Math.round(perf.metrics.requestsPerSecond)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 text-red-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Error Rate</p>
                  <p className="text-2xl font-bold">{(perf.metrics.errorRate * 100).toFixed(2)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Performance Thresholds</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(perf.thresholds).map(([threshold, passed]) => (
                <div key={threshold} className="flex items-center justify-between py-2">
                  <span className="font-medium">{threshold}</span>
                  <Badge className={passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {passed ? 'Passed' : 'Failed'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="avgResponseTime" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    name="Avg Response Time (ms)"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="p95ResponseTime" 
                    stroke="#82ca9d" 
                    strokeWidth={2}
                    name="P95 Response Time (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Throughput & Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar 
                    yAxisId="left"
                    dataKey="rps" 
                    fill="#8884d8"
                    name="Requests/sec"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="errorRate" 
                    stroke="#ff7300" 
                    strokeWidth={2}
                    name="Error Rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderHistory = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Test History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {testHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No test history available</div>
            ) : (
              testHistory.map((test) => (
                <div 
                  key={test.testId}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => loadTestResult(test.testId)}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(test.status)}
                    <div>
                      <div className="font-medium">Test {test.testId.slice(0, 8)}</div>
                      <div className="text-sm text-gray-600">
                        {new Date(test.startTime).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(test.status)}>
                      {test.status}
                    </Badge>
                    {test.duration && (
                      <span className="text-sm text-gray-600">
                        {Math.floor(test.duration / 1000)}s
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={testTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="passed" 
                  stackId="1"
                  stroke="#82ca9d" 
                  fill="#82ca9d"
                  name="Passed Tests"
                />
                <Area 
                  type="monotone" 
                  dataKey="failed" 
                  stackId="1"
                  stroke="#ff7300" 
                  fill="#ff7300"
                  name="Failed Tests"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Duration Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={testTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="duration" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  name="Duration (seconds)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plugin Test Runner</h1>
          <p className="text-gray-600 mt-1">Plugin: {pluginId}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={loadTestHistory}
            disabled={isRunning}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="coverage">Coverage</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {renderOverview()}
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          {renderLogs()}
        </TabsContent>

        <TabsContent value="coverage" className="mt-6">
          {renderCoverage()}
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          {renderPerformance()}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {renderHistory()}
        </TabsContent>
      </Tabs>
    </div>
  );
}