import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  GitBranch,
  Play,
  Pause,
  RotateCcw,
  Settings,
  TrendingUp,
  Zap,
  BarChart3,
  FileText,
  Shield,
  TestTube,
  Layers
} from 'lucide-react';

interface Pipeline {
  id: string;
  name: string;
  type: 'batch' | 'streaming' | 'hybrid';
  status: 'running' | 'completed' | 'failed' | 'pending' | 'paused';
  lastRun: string;
  nextRun: string;
  successRate: number;
  avgDuration: number;
  owner: string;
  environment: string;
}

interface Execution {
  id: string;
  pipelineId: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  startTime: string;
  duration: number;
  recordsProcessed: number;
  progress: number;
}

interface QualityMetrics {
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  validity: number;
}

const PipelineOrchestrationDashboard: React.FC = () => {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics>({
    completeness: 95,
    accuracy: 92,
    consistency: 88,
    timeliness: 94,
    validity: 96
  });
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // Load pipeline data
    const mockPipelines: Pipeline[] = [
      {
        id: 'user-etl-daily',
        name: 'User Data ETL',
        type: 'batch',
        status: 'completed',
        lastRun: '2024-01-15T02:00:00Z',
        nextRun: '2024-01-16T02:00:00Z',
        successRate: 98.5,
        avgDuration: 1800,
        owner: 'data-team',
        environment: 'production'
      },
      {
        id: 'order-stream',
        name: 'Order Processing Stream',
        type: 'streaming',
        status: 'running',
        lastRun: '2024-01-15T00:00:00Z',
        nextRun: 'continuous',
        successRate: 99.2,
        avgDuration: 0,
        owner: 'stream-team',
        environment: 'production'
      },
      {
        id: 'analytics-batch',
        name: 'Analytics Aggregation',
        type: 'batch',
        status: 'failed',
        lastRun: '2024-01-15T06:00:00Z',
        nextRun: '2024-01-15T18:00:00Z',
        successRate: 85.3,
        avgDuration: 3600,
        owner: 'analytics-team',
        environment: 'production'
      },
      {
        id: 'ml-feature-pipeline',
        name: 'ML Feature Engineering',
        type: 'hybrid',
        status: 'running',
        lastRun: '2024-01-15T04:00:00Z',
        nextRun: '2024-01-16T04:00:00Z',
        successRate: 94.7,
        avgDuration: 2400,
        owner: 'ml-team',
        environment: 'staging'
      }
    ];

    const mockExecutions: Execution[] = [
      {
        id: 'exec-001',
        pipelineId: 'user-etl-daily',
        status: 'completed',
        startTime: '2024-01-15T02:00:00Z',
        duration: 1750,
        recordsProcessed: 1250000,
        progress: 100
      },
      {
        id: 'exec-002',
        pipelineId: 'order-stream',
        status: 'running',
        startTime: '2024-01-15T00:00:00Z',
        duration: 86400,
        recordsProcessed: 15780000,
        progress: 75
      },
      {
        id: 'exec-003',
        pipelineId: 'analytics-batch',
        status: 'failed',
        startTime: '2024-01-15T06:00:00Z',
        duration: 2100,
        recordsProcessed: 0,
        progress: 45
      }
    ];

    setPipelines(mockPipelines);
    setExecutions(mockExecutions);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      running: 'default',
      completed: 'secondary',
      failed: 'destructive',
      pending: 'outline',
      paused: 'outline'
    };
    
    return (
      <Badge variant={variants[status] || 'outline'}>
        {getStatusIcon(status)}
        <span className="ml-1">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </Badge>
    );
  };

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Pipeline Orchestration</h1>
          <p className="text-muted-foreground">
            Manage and monitor your data processing pipelines with Apache Airflow, Kafka, and Flink
          </p>
        </div>
        <div className="flex space-x-2">
          <Button>
            <Play className="h-4 w-4 mr-2" />
            Create Pipeline
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipelines</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pipelines.length}</div>
            <p className="text-xs text-muted-foreground">
              +2 from last month
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Executions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {executions.filter(e => e.status === 'running').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently running
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(pipelines.reduce((sum, p) => sum + p.successRate, 0) / pipelines.length)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Last 30 days average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Quality Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(Object.values(qualityMetrics).reduce((a, b) => a + b, 0) / 5)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Overall quality score
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="executions">Executions</TabsTrigger>
          <TabsTrigger value="quality">Data Quality</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="governance">Governance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Pipeline Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Status</CardTitle>
                <CardDescription>Current status of all pipelines</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pipelines.map((pipeline) => (
                  <div key={pipeline.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <div>
                        <p className="font-medium">{pipeline.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {pipeline.type} • {pipeline.environment}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(pipeline.status)}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Recent Executions */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Executions</CardTitle>
                <CardDescription>Latest pipeline execution results</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {executions.slice(0, 4).map((execution) => (
                  <div key={execution.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(execution.status)}
                      <div>
                        <p className="font-medium">
                          {pipelines.find(p => p.id === execution.pipelineId)?.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatNumber(execution.recordsProcessed)} records
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatDuration(execution.duration)}</p>
                      <p className="text-sm text-muted-foreground">
                        {execution.status === 'running' ? `${execution.progress}%` : 'Complete'}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Data Quality Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Data Quality Metrics</CardTitle>
              <CardDescription>Overall data quality across all pipelines</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-5">
                {Object.entries(qualityMetrics).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium capitalize">{key}</span>
                      <span className="text-sm text-muted-foreground">{value}%</span>
                    </div>
                    <Progress value={value} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipelines" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Pipelines</CardTitle>
              <CardDescription>Manage your data processing pipelines</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pipelines.map((pipeline) => (
                  <Card key={pipeline.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold">{pipeline.name}</h3>
                            {getStatusBadge(pipeline.status)}
                            <Badge variant="outline" className="capitalize">
                              {pipeline.type}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>Owner: {pipeline.owner}</span>
                            <span>Environment: {pipeline.environment}</span>
                            <span>Success Rate: {pipeline.successRate}%</span>
                            <span>Avg Duration: {formatDuration(pipeline.avgDuration)}</span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>Last Run: {new Date(pipeline.lastRun).toLocaleString()}</span>
                            <span>Next Run: {pipeline.nextRun === 'continuous' ? 'Continuous' : new Date(pipeline.nextRun).toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline">
                            <Play className="h-4 w-4 mr-1" />
                            Run
                          </Button>
                          <Button size="sm" variant="outline">
                            <Settings className="h-4 w-4 mr-1" />
                            Configure
                          </Button>
                          <Button size="sm" variant="outline">
                            <BarChart3 className="h-4 w-4 mr-1" />
                            Metrics
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Executions</CardTitle>
              <CardDescription>Track pipeline execution history and status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {executions.map((execution) => {
                  const pipeline = pipelines.find(p => p.id === execution.pipelineId);
                  return (
                    <Card key={execution.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-semibold">{pipeline?.name}</h4>
                              {getStatusBadge(execution.status)}
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <span>Execution ID: {execution.id}</span>
                              <span>Started: {new Date(execution.startTime).toLocaleString()}</span>
                              <span>Duration: {formatDuration(execution.duration)}</span>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <span>Records Processed: {formatNumber(execution.recordsProcessed)}</span>
                              {execution.status === 'running' && (
                                <span>Progress: {execution.progress}%</span>
                              )}
                            </div>
                            {execution.status === 'running' && (
                              <Progress value={execution.progress} className="h-2 w-64" />
                            )}
                          </div>
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline">
                              <FileText className="h-4 w-4 mr-1" />
                              Logs
                            </Button>
                            {execution.status === 'running' && (
                              <Button size="sm" variant="outline">
                                <Pause className="h-4 w-4 mr-1" />
                                Stop
                              </Button>
                            )}
                            {execution.status === 'failed' && (
                              <Button size="sm" variant="outline">
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Retry
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Data Quality Dashboard</CardTitle>
                <CardDescription>Monitor data quality across pipelines</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(qualityMetrics).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="font-medium capitalize">{key}</span>
                        <span className="text-sm font-medium">{value}%</span>
                      </div>
                      <Progress value={value} className="h-3" />
                      <p className="text-sm text-muted-foreground">
                        {value >= 95 ? 'Excellent' : value >= 90 ? 'Good' : value >= 80 ? 'Fair' : 'Needs Attention'}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quality Issues</CardTitle>
                <CardDescription>Recent data quality findings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <div>
                      <p className="font-medium">Completeness Issue</p>
                      <p className="text-sm text-muted-foreground">
                        5% null values detected in user_email field
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <div>
                      <p className="font-medium">Accuracy Alert</p>
                      <p className="text-sm text-muted-foreground">
                        Duplicate records found in customer dataset
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="font-medium">Schema Validation</p>
                      <p className="text-sm text-muted-foreground">
                        All data types conform to schema requirements
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Great Expectations Results</CardTitle>
              <CardDescription>Automated data validation results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">847</div>
                    <p className="text-sm text-muted-foreground">Expectations Passed</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">23</div>
                    <p className="text-sm text-muted-foreground">Expectations Failed</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">97.4%</div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Infrastructure monitoring</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Airflow Scheduler</span>
                    <Badge variant="secondary">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Healthy
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Kafka Cluster</span>
                    <Badge variant="secondary">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Healthy
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Flink JobManager</span>
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Warning
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Data Warehouse</span>
                    <Badge variant="secondary">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Healthy
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resource Usage</CardTitle>
                <CardDescription>Compute and storage metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">CPU Usage</span>
                      <span className="text-sm">68%</span>
                    </div>
                    <Progress value={68} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Memory Usage</span>
                      <span className="text-sm">74%</span>
                    </div>
                    <Progress value={74} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Storage Usage</span>
                      <span className="text-sm">43%</span>
                    </div>
                    <Progress value={43} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Network I/O</span>
                      <span className="text-sm">31%</span>
                    </div>
                    <Progress value={31} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Alerts</CardTitle>
                <CardDescription>Current system alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">High memory usage on worker-3</span>
                  </div>
                  <div className="flex items-center space-x-2 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">Slow query detected in analytics pipeline</span>
                  </div>
                  <div className="flex items-center space-x-2 text-blue-600">
                    <Activity className="h-4 w-4" />
                    <span className="text-sm">Scheduled maintenance in 2 hours</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Pipeline execution performance over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">2.3s</div>
                  <p className="text-sm text-muted-foreground">Avg Response Time</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">15.2M</div>
                  <p className="text-sm text-muted-foreground">Records/Hour</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">99.7%</div>
                  <p className="text-sm text-muted-foreground">Uptime</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">0.12s</div>
                  <p className="text-sm text-muted-foreground">Avg Latency</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Data Governance</CardTitle>
                <CardDescription>Compliance and data management policies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>GDPR Compliance</span>
                    <Badge variant="secondary">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Compliant
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Data Retention Policies</span>
                    <Badge variant="secondary">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Access Control</span>
                    <Badge variant="secondary">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Enforced
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Audit Logging</span>
                    <Badge variant="secondary">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Enabled
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Data Lineage</CardTitle>
                <CardDescription>Track data flow and transformations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Database className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Source: Customer Database</span>
                  </div>
                  <div className="flex items-center space-x-3 ml-4">
                    <GitBranch className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">Transform: Data Cleaning</span>
                  </div>
                  <div className="flex items-center space-x-3 ml-4">
                    <GitBranch className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">Transform: Business Rules</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Database className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Destination: Analytics Warehouse</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Testing & Validation</CardTitle>
              <CardDescription>Pipeline testing and data contract validation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center">
                  <TestTube className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <div className="text-2xl font-bold">142</div>
                  <p className="text-sm text-muted-foreground">Tests Passed</p>
                </div>
                <div className="text-center">
                  <TestTube className="h-8 w-8 mx-auto mb-2 text-red-500" />
                  <div className="text-2xl font-bold">3</div>
                  <p className="text-sm text-muted-foreground">Tests Failed</p>
                </div>
                <div className="text-center">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <div className="text-2xl font-bold">98%</div>
                  <p className="text-sm text-muted-foreground">Coverage</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deployment & Versioning</CardTitle>
              <CardDescription>Pipeline deployment status and version control</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">User ETL Pipeline v2.1.0</p>
                    <p className="text-sm text-muted-foreground">Deployed to production</p>
                  </div>
                  <Badge variant="secondary">Live</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Order Stream v1.5.2</p>
                    <p className="text-sm text-muted-foreground">Canary deployment 20%</p>
                  </div>
                  <Badge variant="outline">Deploying</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Analytics Batch v3.0.0</p>
                    <p className="text-sm text-muted-foreground">Pending approval</p>
                  </div>
                  <Badge variant="outline">Staging</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PipelineOrchestrationDashboard;