'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  Zap, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  Award, 
  TrendingUp, 
  FileText, 
  Play, 
  Download, 
  RefreshCw, 
  Eye, 
  Settings,
  ChevronDown,
  ChevronRight,
  Target,
  Activity,
  Database,
  Globe,
  Code,
  TestTube,
  Bug,
  Gauge,
  Users,
  Calendar,
  ExternalLink,
  Copy,
  Filter,
  Search
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Types
interface CertificationRequest {
  pluginId: string;
  pluginName: string;
  version: string;
  sourceUrl?: string;
  packagePath?: string;
  testCommands?: string[];
  performanceThresholds?: {
    bundleSize?: number;
    loadTime?: number;
    memoryUsage?: number;
  };
}

interface SecurityScanResult {
  vulnerabilities: {
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  details: {
    id: string;
    severity: 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    file?: string;
    line?: number;
    recommendation: string;
  }[];
  tools: string[];
  scanDuration: number;
}

interface PerformanceBenchmark {
  bundleSize: {
    compressed: number;
    uncompressed: number;
    treeshakable: boolean;
  };
  loadTime: {
    initial: number;
    interactive: number;
    complete: number;
  };
  memoryUsage: {
    heap: number;
    external: number;
    peak: number;
  };
  renderingMetrics: {
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    cumulativeLayoutShift: number;
  };
  score: number;
}

interface CodeQualityAnalysis {
  complexity: {
    cyclomatic: number;
    cognitive: number;
    maintainabilityIndex: number;
  };
  coverage: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  issues: {
    blocker: number;
    critical: number;
    major: number;
    minor: number;
    info: number;
  };
  duplications: {
    blocks: number;
    files: number;
    lines: number;
    density: number;
  };
  techDebt: {
    minutes: number;
    hours: number;
    days: number;
  };
  score: number;
}

interface ComplianceCheck {
  ruleId: string;
  status: 'passed' | 'failed' | 'warning';
  severity: 'error' | 'warning' | 'info';
  category: 'security' | 'performance' | 'compatibility' | 'quality';
  description: string;
  details?: string;
  recommendation?: string;
}

interface TestResults {
  unit: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  integration: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  e2e: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  coverage: {
    overall: number;
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  failures: {
    test: string;
    error: string;
    stack?: string;
  }[];
}

interface CertificationBadge {
  id: string;
  level: 'bronze' | 'silver' | 'gold' | 'platinum';
  score: number;
  validUntil: string;
  criteria: {
    security: boolean;
    performance: boolean;
    quality: boolean;
    compliance: boolean;
    testing: boolean;
  };
  badgeUrl: string;
  metadata: {
    certifiedAt: string;
    certifiedBy: string;
    version: string;
  };
}

interface CertificationResult {
  pluginId: string;
  pluginName: string;
  version: string;
  certificationId: string;
  status: string;
  badge: CertificationBadge;
  results: {
    security: SecurityScanResult;
    performance: PerformanceBenchmark;
    quality: CodeQualityAnalysis;
    compliance: ComplianceCheck[];
    testing: TestResults;
  };
  recommendations: string[];
  certifiedAt: string;
}

interface CertificationState {
  isRunning: boolean;
  progress: number;
  currentStep: string;
  result?: CertificationResult;
  error?: string;
}

const PluginCertificationDashboard: React.FC = () => {
  const [certificationState, setCertificationState] = useState<CertificationState>({
    isRunning: false,
    progress: 0,
    currentStep: 'Idle'
  });
  const [certificationRequest, setCertificationRequest] = useState<CertificationRequest>({
    pluginId: '',
    pluginName: '',
    version: '1.0.0',
    testCommands: ['npm test']
  });
  const [certificationHistory, setCertificationHistory] = useState<CertificationResult[]>([]);
  const [selectedCertification, setSelectedCertification] = useState<CertificationResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');

  // Mock data for demonstration
  useEffect(() => {
    const mockHistory: CertificationResult[] = [
      {
        pluginId: '@backstage/plugin-kubernetes',
        pluginName: 'Kubernetes Plugin',
        version: '0.18.0',
        certificationId: 'cert-k8s-2024-001',
        status: 'certified',
        badge: {
          id: 'badge-k8s-001',
          level: 'gold',
          score: 87,
          validUntil: '2025-12-31T23:59:59Z',
          criteria: {
            security: true,
            performance: true,
            quality: true,
            compliance: true,
            testing: true
          },
          badgeUrl: 'https://img.shields.io/badge/Certified-GOLD%2087%25-FFD700?style=for-the-badge&logo=backstage',
          metadata: {
            certifiedAt: '2024-01-15T10:30:00Z',
            certifiedBy: 'NEXT IDP Certification Authority',
            version: '1.0.0'
          }
        },
        results: {
          security: {
            vulnerabilities: { high: 0, medium: 1, low: 2, info: 3 },
            details: [],
            tools: ['npm-audit', 'eslint-security'],
            scanDuration: 45000
          },
          performance: {
            bundleSize: { compressed: 125000, uncompressed: 450000, treeshakable: true },
            loadTime: { initial: 650, interactive: 1100, complete: 1350 },
            memoryUsage: { heap: 22000000, external: 2200000, peak: 26000000 },
            renderingMetrics: { firstContentfulPaint: 550, largestContentfulPaint: 950, cumulativeLayoutShift: 0.03 },
            score: 89
          },
          quality: {
            complexity: { cyclomatic: 7, cognitive: 10, maintainabilityIndex: 82 },
            coverage: { lines: 85, functions: 82, branches: 78, statements: 86 },
            issues: { blocker: 0, critical: 0, major: 3, minor: 8, info: 5 },
            duplications: { blocks: 1, files: 1, lines: 25, density: 2.1 },
            techDebt: { minutes: 120, hours: 2, days: 0.25 },
            score: 85
          },
          compliance: [
            { ruleId: 'BACKSTAGE_COMPAT', status: 'passed', severity: 'error', category: 'compatibility', description: 'Plugin must be compatible with Backstage v1.20+' },
            { ruleId: 'SECURITY_HEADERS', status: 'passed', severity: 'warning', category: 'security', description: 'Plugin should implement proper security headers' },
            { ruleId: 'ERROR_HANDLING', status: 'passed', severity: 'error', category: 'quality', description: 'Plugin must implement proper error handling' }
          ],
          testing: {
            unit: { total: 45, passed: 43, failed: 2, skipped: 0, duration: 8000 },
            integration: { total: 12, passed: 11, failed: 1, skipped: 0, duration: 22000 },
            e2e: { total: 5, passed: 5, failed: 0, skipped: 0, duration: 65000 },
            coverage: { overall: 85, statements: 86, branches: 78, functions: 82, lines: 85 },
            failures: []
          }
        },
        recommendations: [
          'Address medium-severity security issue in authentication module',
          'Consider optimizing bundle size for better performance',
          'Increase branch coverage to reach 80% threshold'
        ],
        certifiedAt: '2024-01-15T10:30:00Z'
      }
    ];
    setCertificationHistory(mockHistory);
  }, []);

  const runCertification = async () => {
    if (!certificationRequest.pluginId || !certificationRequest.pluginName) {
      alert('Please fill in required fields');
      return;
    }

    setCertificationState({
      isRunning: true,
      progress: 0,
      currentStep: 'Initializing certification process...'
    });

    const steps = [
      'Preparing plugin package...',
      'Running security scans...',
      'Benchmarking performance...',
      'Analyzing code quality...',
      'Checking compliance rules...',
      'Running automated tests...',
      'Generating certification badge...',
      'Finalizing certification...'
    ];

    try {
      for (let i = 0; i < steps.length; i++) {
        setCertificationState(prev => ({
          ...prev,
          progress: ((i + 1) / steps.length) * 100,
          currentStep: steps[i]
        }));
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Call certification API
      const response = await fetch('/api/plugin-certification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(certificationRequest)
      });

      const result = await response.json();

      if (result.success) {
        setCertificationState({
          isRunning: false,
          progress: 100,
          currentStep: 'Certification completed',
          result: result.certification
        });
        
        // Add to history
        setCertificationHistory(prev => [result.certification, ...prev]);
      } else {
        throw new Error(result.error || 'Certification failed');
      }
    } catch (error) {
      setCertificationState({
        isRunning: false,
        progress: 0,
        currentStep: 'Certification failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getBadgeColor = (level: string) => {
    const colors = {
      bronze: 'bg-amber-600',
      silver: 'bg-gray-400',
      gold: 'bg-yellow-500',
      platinum: 'bg-purple-500'
    };
    return colors[level as keyof typeof colors] || 'bg-gray-400';
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      high: 'text-red-600 bg-red-50',
      critical: 'text-red-700 bg-red-100',
      medium: 'text-orange-600 bg-orange-50',
      major: 'text-orange-600 bg-orange-50',
      low: 'text-yellow-600 bg-yellow-50',
      minor: 'text-yellow-600 bg-yellow-50',
      info: 'text-blue-600 bg-blue-50'
    };
    return colors[severity as keyof typeof colors] || 'text-gray-600 bg-gray-50';
  };

  const filteredHistory = certificationHistory.filter(cert => {
    const matchesSearch = cert.pluginName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         cert.pluginId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || cert.status === filterStatus;
    const matchesLevel = filterLevel === 'all' || cert.badge.level === filterLevel;
    return matchesSearch && matchesStatus && matchesLevel;
  });

  const CertificationForm = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Start New Certification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Plugin ID *</label>
            <Input
              placeholder="@backstage/plugin-example"
              value={certificationRequest.pluginId}
              onChange={(e) => setCertificationRequest(prev => ({ ...prev, pluginId: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Plugin Name *</label>
            <Input
              placeholder="Example Plugin"
              value={certificationRequest.pluginName}
              onChange={(e) => setCertificationRequest(prev => ({ ...prev, pluginName: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Version</label>
            <Input
              placeholder="1.0.0"
              value={certificationRequest.version}
              onChange={(e) => setCertificationRequest(prev => ({ ...prev, version: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Source URL (optional)</label>
            <Input
              placeholder="https://github.com/user/plugin"
              value={certificationRequest.sourceUrl || ''}
              onChange={(e) => setCertificationRequest(prev => ({ ...prev, sourceUrl: e.target.value }))}
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Test Commands (one per line)</label>
          <textarea
            className="w-full p-2 border rounded-md h-20"
            placeholder="npm test&#10;npm run test:e2e"
            value={certificationRequest.testCommands?.join('\n') || ''}
            onChange={(e) => setCertificationRequest(prev => ({ 
              ...prev, 
              testCommands: e.target.value.split('\n').filter(Boolean) 
            }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Bundle Size Threshold (bytes)</label>
            <Input
              type="number"
              placeholder="500000"
              value={certificationRequest.performanceThresholds?.bundleSize || ''}
              onChange={(e) => setCertificationRequest(prev => ({ 
                ...prev, 
                performanceThresholds: { 
                  ...prev.performanceThresholds, 
                  bundleSize: parseInt(e.target.value) || undefined 
                }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Load Time Threshold (ms)</label>
            <Input
              type="number"
              placeholder="3000"
              value={certificationRequest.performanceThresholds?.loadTime || ''}
              onChange={(e) => setCertificationRequest(prev => ({ 
                ...prev, 
                performanceThresholds: { 
                  ...prev.performanceThresholds, 
                  loadTime: parseInt(e.target.value) || undefined 
                }
              }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Memory Threshold (bytes)</label>
            <Input
              type="number"
              placeholder="50000000"
              value={certificationRequest.performanceThresholds?.memoryUsage || ''}
              onChange={(e) => setCertificationRequest(prev => ({ 
                ...prev, 
                performanceThresholds: { 
                  ...prev.performanceThresholds, 
                  memoryUsage: parseInt(e.target.value) || undefined 
                }
              }))}
            />
          </div>
        </div>

        <Button 
          onClick={runCertification} 
          disabled={certificationState.isRunning}
          className="w-full"
        >
          {certificationState.isRunning ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Running Certification...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Start Certification Process
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );

  const CertificationProgress = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Certification Progress
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>{certificationState.currentStep}</span>
              <span>{Math.round(certificationState.progress)}%</span>
            </div>
            <Progress value={certificationState.progress} className="w-full" />
          </div>
          
          {certificationState.error && (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {certificationState.error}
              </AlertDescription>
            </Alert>
          )}

          {certificationState.result && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Certification completed successfully! Badge level: {certificationState.result.badge.level.toUpperCase()}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const SecurityScanReport = ({ security }: { security: SecurityScanResult }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Security Scan Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{security.vulnerabilities.high}</div>
            <div className="text-sm text-red-700">High</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{security.vulnerabilities.medium}</div>
            <div className="text-sm text-orange-700">Medium</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{security.vulnerabilities.low}</div>
            <div className="text-sm text-yellow-700">Low</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{security.vulnerabilities.info}</div>
            <div className="text-sm text-blue-700">Info</div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Scan Details:</h4>
          <div className="text-sm text-gray-600">
            <div>Tools: {security.tools.join(', ')}</div>
            <div>Duration: {formatDuration(security.scanDuration)}</div>
            <div>Issues found: {security.details.length}</div>
          </div>
        </div>

        {security.details.length > 0 && (
          <Collapsible className="mt-4">
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium">
              <ChevronRight className="h-4 w-4" />
              View Detailed Issues ({security.details.length})
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              {security.details.map((detail, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getSeverityColor(detail.severity)}>
                      {detail.severity.toUpperCase()}
                    </Badge>
                    <span className="font-medium">{detail.title}</span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">{detail.description}</div>
                  {detail.file && (
                    <div className="text-xs text-gray-500">
                      File: {detail.file}{detail.line && `:${detail.line}`}
                    </div>
                  )}
                  <div className="text-xs text-blue-600 mt-1">{detail.recommendation}</div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );

  const PerformanceBenchmarkReport = ({ performance }: { performance: PerformanceBenchmark }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Performance Benchmark
          <Badge variant="outline" className="ml-auto">
            Score: {performance.score}/100
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Database className="h-4 w-4" />
              Bundle Size
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Compressed:</span>
                <span className="font-mono">{formatBytes(performance.bundleSize.compressed)}</span>
              </div>
              <div className="flex justify-between">
                <span>Uncompressed:</span>
                <span className="font-mono">{formatBytes(performance.bundleSize.uncompressed)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tree-shakable:</span>
                <span className={performance.bundleSize.treeshakable ? 'text-green-600' : 'text-red-600'}>
                  {performance.bundleSize.treeshakable ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Load Times
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Initial:</span>
                <span className="font-mono">{formatDuration(performance.loadTime.initial)}</span>
              </div>
              <div className="flex justify-between">
                <span>Interactive:</span>
                <span className="font-mono">{formatDuration(performance.loadTime.interactive)}</span>
              </div>
              <div className="flex justify-between">
                <span>Complete:</span>
                <span className="font-mono">{formatDuration(performance.loadTime.complete)}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Memory Usage
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Heap:</span>
                <span className="font-mono">{formatBytes(performance.memoryUsage.heap)}</span>
              </div>
              <div className="flex justify-between">
                <span>External:</span>
                <span className="font-mono">{formatBytes(performance.memoryUsage.external)}</span>
              </div>
              <div className="flex justify-between">
                <span>Peak:</span>
                <span className="font-mono">{formatBytes(performance.memoryUsage.peak)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Web Vitals
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold">{formatDuration(performance.renderingMetrics.firstContentfulPaint)}</div>
              <div className="text-xs text-gray-600">First Contentful Paint</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold">{formatDuration(performance.renderingMetrics.largestContentfulPaint)}</div>
              <div className="text-xs text-gray-600">Largest Contentful Paint</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold">{performance.renderingMetrics.cumulativeLayoutShift.toFixed(3)}</div>
              <div className="text-xs text-gray-600">Cumulative Layout Shift</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const CodeQualityReport = ({ quality }: { quality: CodeQualityAnalysis }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="h-5 w-5" />
          Code Quality Analysis
          <Badge variant="outline" className="ml-auto">
            Score: {quality.score}/100
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3">Complexity Metrics</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Cyclomatic Complexity</span>
                  <span className="font-mono">{quality.complexity.cyclomatic}</span>
                </div>
                <Progress value={Math.min(quality.complexity.cyclomatic * 5, 100)} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Cognitive Complexity</span>
                  <span className="font-mono">{quality.complexity.cognitive}</span>
                </div>
                <Progress value={Math.min(quality.complexity.cognitive * 4, 100)} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Maintainability Index</span>
                  <span className="font-mono">{quality.complexity.maintainabilityIndex}</span>
                </div>
                <Progress value={quality.complexity.maintainabilityIndex} className="h-2" />
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Test Coverage</h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Lines</span>
                  <span className="font-mono">{quality.coverage.lines}%</span>
                </div>
                <Progress value={quality.coverage.lines} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Functions</span>
                  <span className="font-mono">{quality.coverage.functions}%</span>
                </div>
                <Progress value={quality.coverage.functions} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Branches</span>
                  <span className="font-mono">{quality.coverage.branches}%</span>
                </div>
                <Progress value={quality.coverage.branches} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Statements</span>
                  <span className="font-mono">{quality.coverage.statements}%</span>
                </div>
                <Progress value={quality.coverage.statements} className="h-2" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div>
            <h4 className="font-medium mb-3">Issues Breakdown</h4>
            <div className="space-y-2">
              {Object.entries(quality.issues).map(([severity, count]) => (
                <div key={severity} className="flex justify-between text-sm">
                  <span className="capitalize">{severity}:</span>
                  <Badge className={getSeverityColor(severity)}>
                    {count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Technical Debt</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Minutes:</span>
                <span className="font-mono">{quality.techDebt.minutes}</span>
              </div>
              <div className="flex justify-between">
                <span>Hours:</span>
                <span className="font-mono">{quality.techDebt.hours}</span>
              </div>
              <div className="flex justify-between">
                <span>Days:</span>
                <span className="font-mono">{quality.techDebt.days}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="font-medium mb-3">Code Duplications</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold">{quality.duplications.blocks}</div>
              <div className="text-xs text-gray-600">Blocks</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold">{quality.duplications.files}</div>
              <div className="text-xs text-gray-600">Files</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold">{quality.duplications.lines}</div>
              <div className="text-xs text-gray-600">Lines</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold">{quality.duplications.density.toFixed(1)}%</div>
              <div className="text-xs text-gray-600">Density</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const ComplianceReport = ({ compliance }: { compliance: ComplianceCheck[] }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Compliance Checklist
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {compliance.map((check, index) => (
            <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
              <div className="mt-1">
                {check.status === 'passed' && <CheckCircle className="h-4 w-4 text-green-600" />}
                {check.status === 'failed' && <XCircle className="h-4 w-4 text-red-600" />}
                {check.status === 'warning' && <AlertTriangle className="h-4 w-4 text-orange-600" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{check.ruleId}</span>
                  <Badge className={getSeverityColor(check.severity)}>
                    {check.severity}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {check.category}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600 mb-1">{check.description}</div>
                {check.details && (
                  <div className="text-xs text-gray-500 mb-1">{check.details}</div>
                )}
                {check.recommendation && (
                  <div className="text-xs text-blue-600">{check.recommendation}</div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {compliance.filter(c => c.status === 'passed').length}
            </div>
            <div className="text-sm text-green-700">Passed</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {compliance.filter(c => c.status === 'warning').length}
            </div>
            <div className="text-sm text-orange-700">Warnings</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {compliance.filter(c => c.status === 'failed').length}
            </div>
            <div className="text-sm text-red-700">Failed</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const TestResultsReport = ({ testing }: { testing: TestResults }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Test Results
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <h4 className="font-medium mb-3">Unit Tests</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-mono">{testing.unit.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Passed:</span>
                <span className="font-mono text-green-600">{testing.unit.passed}</span>
              </div>
              <div className="flex justify-between">
                <span>Failed:</span>
                <span className="font-mono text-red-600">{testing.unit.failed}</span>
              </div>
              <div className="flex justify-between">
                <span>Skipped:</span>
                <span className="font-mono text-yellow-600">{testing.unit.skipped}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-mono">{formatDuration(testing.unit.duration)}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Integration Tests</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-mono">{testing.integration.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Passed:</span>
                <span className="font-mono text-green-600">{testing.integration.passed}</span>
              </div>
              <div className="flex justify-between">
                <span>Failed:</span>
                <span className="font-mono text-red-600">{testing.integration.failed}</span>
              </div>
              <div className="flex justify-between">
                <span>Skipped:</span>
                <span className="font-mono text-yellow-600">{testing.integration.skipped}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-mono">{formatDuration(testing.integration.duration)}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">E2E Tests</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-mono">{testing.e2e.total}</span>
              </div>
              <div className="flex justify-between">
                <span>Passed:</span>
                <span className="font-mono text-green-600">{testing.e2e.passed}</span>
              </div>
              <div className="flex justify-between">
                <span>Failed:</span>
                <span className="font-mono text-red-600">{testing.e2e.failed}</span>
              </div>
              <div className="flex justify-between">
                <span>Skipped:</span>
                <span className="font-mono text-yellow-600">{testing.e2e.skipped}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="font-mono">{formatDuration(testing.e2e.duration)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-medium mb-3">Coverage Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold">{testing.coverage.overall}%</div>
              <div className="text-xs text-gray-600">Overall</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold">{testing.coverage.statements}%</div>
              <div className="text-xs text-gray-600">Statements</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold">{testing.coverage.branches}%</div>
              <div className="text-xs text-gray-600">Branches</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold">{testing.coverage.functions}%</div>
              <div className="text-xs text-gray-600">Functions</div>
            </div>
          </div>
        </div>

        {testing.failures.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 text-red-600">Test Failures</h4>
            <div className="space-y-2">
              {testing.failures.map((failure, index) => (
                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="font-medium text-red-800">{failure.test}</div>
                  <div className="text-sm text-red-700 mt-1">{failure.error}</div>
                  {failure.stack && (
                    <pre className="text-xs text-red-600 mt-2 overflow-x-auto">
                      {failure.stack}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const CertificationBadgeDisplay = ({ badge }: { badge: CertificationBadge }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Certification Badge
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center mb-6">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-white font-bold text-lg ${getBadgeColor(badge.level)}`}>
            <Award className="h-6 w-6" />
            {badge.level.charAt(0).toUpperCase() + badge.level.slice(1)} Certified
          </div>
          <div className="text-2xl font-bold mt-2">{badge.score}/100</div>
          <div className="text-sm text-gray-600">Overall Score</div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {Object.entries(badge.criteria).map(([criterion, passed]) => (
            <div key={criterion} className="text-center">
              <div className={`w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center ${
                passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
              }`}>
                {passed ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              </div>
              <div className="text-xs capitalize">{criterion}</div>
            </div>
          ))}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Badge ID:</span>
            <span className="font-mono">{badge.id}</span>
          </div>
          <div className="flex justify-between">
            <span>Valid Until:</span>
            <span>{new Date(badge.validUntil).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Certified By:</span>
            <span>{badge.metadata.certifiedBy}</span>
          </div>
          <div className="flex justify-between">
            <span>Version:</span>
            <span>{badge.metadata.version}</span>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => window.open(badge.badgeUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Badge
          </Button>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigator.clipboard.writeText(badge.badgeUrl)}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Badge URL
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plugin Certification Dashboard</h1>
          <p className="text-gray-600 mt-2">Comprehensive plugin security, performance, and quality certification</p>
        </div>
        <div className="flex gap-2">
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

      <Tabs defaultValue="certify" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="certify">New Certification</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="certify" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CertificationForm />
            {(certificationState.isRunning || certificationState.result || certificationState.error) && (
              <CertificationProgress />
            )}
          </div>
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {certificationState.result ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <SecurityScanReport security={certificationState.result.results.security} />
                  <PerformanceBenchmarkReport performance={certificationState.result.results.performance} />
                  <CodeQualityReport quality={certificationState.result.results.quality} />
                  <ComplianceReport compliance={certificationState.result.results.compliance} />
                  <TestResultsReport testing={certificationState.result.results.testing} />
                </div>
                <div className="space-y-6">
                  <CertificationBadgeDisplay badge={certificationState.result.badge} />
                  {certificationState.result.recommendations.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Target className="h-5 w-5" />
                          Recommendations
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {certificationState.result.recommendations.map((rec, index) => (
                            <div key={index} className="flex gap-2 text-sm">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No certification results</h3>
              <p className="text-gray-600">Run a certification process to see detailed results here.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="certified">Certified</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="platinum">Platinum</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="silver">Silver</SelectItem>
                <SelectItem value="bronze">Bronze</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            {filteredHistory.map((cert) => (
              <Card key={cert.certificationId} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${getBadgeColor(cert.badge.level)}`} />
                      <div>
                        <h3 className="font-semibold">{cert.pluginName}</h3>
                        <p className="text-sm text-gray-600">{cert.pluginId} v{cert.version}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={getBadgeColor(cert.badge.level)} variant="outline">
                        {cert.badge.level.toUpperCase()} {cert.badge.score}
                      </Badge>
                      <div className="text-sm text-gray-500">
                        {new Date(cert.certifiedAt).toLocaleDateString()}
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{cert.pluginName} Certification Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                              <CertificationBadgeDisplay badge={cert.badge} />
                              {cert.recommendations.length > 0 && (
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-base">Recommendations</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="space-y-2 text-sm">
                                      {cert.recommendations.map((rec, index) => (
                                        <div key={index} className="flex gap-2">
                                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                                          <span>{rec}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                            <Tabs defaultValue="security" className="w-full">
                              <TabsList className="grid grid-cols-5 w-full">
                                <TabsTrigger value="security" className="text-xs">Security</TabsTrigger>
                                <TabsTrigger value="performance" className="text-xs">Performance</TabsTrigger>
                                <TabsTrigger value="quality" className="text-xs">Quality</TabsTrigger>
                                <TabsTrigger value="compliance" className="text-xs">Compliance</TabsTrigger>
                                <TabsTrigger value="testing" className="text-xs">Testing</TabsTrigger>
                              </TabsList>
                              <TabsContent value="security">
                                <SecurityScanReport security={cert.results.security} />
                              </TabsContent>
                              <TabsContent value="performance">
                                <PerformanceBenchmarkReport performance={cert.results.performance} />
                              </TabsContent>
                              <TabsContent value="quality">
                                <CodeQualityReport quality={cert.results.quality} />
                              </TabsContent>
                              <TabsContent value="compliance">
                                <ComplianceReport compliance={cert.results.compliance} />
                              </TabsContent>
                              <TabsContent value="testing">
                                <TestResultsReport testing={cert.results.testing} />
                              </TabsContent>
                            </Tabs>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredHistory.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No certifications found</h3>
                <p className="text-gray-600">No certifications match your current filters.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Certifications</p>
                    <p className="text-2xl font-bold">245</p>
                  </div>
                  <Award className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Certifications</p>
                    <p className="text-2xl font-bold">189</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Average Score</p>
                    <p className="text-2xl font-bold">78.4</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">This Month</p>
                    <p className="text-2xl font-bold">12</p>
                  </div>
                  <Calendar className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Certification Levels Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-purple-500 rounded-full" />
                      <span className="text-sm">Platinum</span>
                    </div>
                    <span className="font-semibold">23</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                      <span className="text-sm">Gold</span>
                    </div>
                    <span className="font-semibold">67</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full" />
                      <span className="text-sm">Silver</span>
                    </div>
                    <span className="font-semibold">89</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-amber-600 rounded-full" />
                      <span className="text-sm">Bronze</span>
                    </div>
                    <span className="font-semibold">66</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm">Kubernetes Plugin certified (Gold)</p>
                      <p className="text-xs text-gray-500">2 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm">ArgoCD Plugin started certification</p>
                      <p className="text-xs text-gray-500">4 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm">Jenkins Plugin certification expired</p>
                      <p className="text-xs text-gray-500">1 day ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PluginCertificationDashboard;