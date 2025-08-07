'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  Play,
  Square,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Timer,
  Activity,
  Package,
  Rocket,
  Shield,
  FileCode,
  Terminal,
  Settings,
  ChevronRight,
  ExternalLink,
  Copy,
  Download,
  Upload,
  Filter,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  MoreVertical,
  ArrowRight,
  Workflow,
  Layers,
  Container,
  Cloud,
  Server,
  Database,
  TestTube,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface Pipeline {
  id: string;
  name: string;
  repository: string;
  branch: string;
  status: 'running' | 'success' | 'failed' | 'cancelled' | 'pending';
  currentStage?: string;
  stages: PipelineStage[];
  trigger: 'manual' | 'push' | 'pr' | 'schedule' | 'api';
  startedAt?: Date;
  finishedAt?: Date;
  duration?: number;
  commitHash?: string;
  commitMessage?: string;
  author?: string;
  artifacts?: Artifact[];
  environment?: string;
}

interface PipelineStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  jobs: Job[];
  duration?: number;
  startedAt?: Date;
  finishedAt?: Date;
}

interface Job {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  steps: Step[];
  duration?: number;
  logs?: string[];
  artifacts?: Artifact[];
}

interface Step {
  id: string;
  name: string;
  command: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  duration?: number;
  output?: string;
}

interface Artifact {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  createdAt: Date;
}

interface Deployment {
  id: string;
  pipelineId: string;
  environment: string;
  status: 'pending' | 'in_progress' | 'success' | 'failed' | 'rolled_back';
  version: string;
  deployedAt: Date;
  deployedBy: string;
  changes: Change[];
}

interface Change {
  id: string;
  type: 'feature' | 'fix' | 'docs' | 'style' | 'refactor' | 'test' | 'chore';
  description: string;
  author: string;
  commitHash: string;
}

export default function CICDPage() {
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBranch, setFilterBranch] = useState('all');
  const [showLogs, setShowLogs] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');

  // Mock data
  const pipelines: Pipeline[] = [
    {
      id: '1',
      name: 'Main Pipeline',
      repository: 'frontend-app',
      branch: 'main',
      status: 'running',
      currentStage: 'test',
      trigger: 'push',
      startedAt: new Date(Date.now() - 300000),
      commitHash: 'abc123',
      commitMessage: 'feat: Add new dashboard component',
      author: 'John Doe',
      environment: 'production',
      stages: [
        {
          id: 's1',
          name: 'build',
          status: 'success',
          duration: 120,
          jobs: [
            {
              id: 'j1',
              name: 'compile',
              status: 'success',
              duration: 60,
              steps: [
                {
                  id: 'st1',
                  name: 'Install dependencies',
                  command: 'npm install',
                  status: 'success',
                  duration: 30
                },
                {
                  id: 'st2',
                  name: 'Build application',
                  command: 'npm run build',
                  status: 'success',
                  duration: 30
                }
              ]
            }
          ]
        },
        {
          id: 's2',
          name: 'test',
          status: 'running',
          jobs: [
            {
              id: 'j2',
              name: 'unit-tests',
              status: 'running',
              steps: [
                {
                  id: 'st3',
                  name: 'Run tests',
                  command: 'npm test',
                  status: 'running'
                }
              ]
            },
            {
              id: 'j3',
              name: 'integration-tests',
              status: 'pending',
              steps: []
            }
          ]
        },
        {
          id: 's3',
          name: 'deploy',
          status: 'pending',
          jobs: []
        }
      ]
    },
    {
      id: '2',
      name: 'Feature Branch Build',
      repository: 'backend-api',
      branch: 'feature/auth-improvements',
      status: 'success',
      trigger: 'pr',
      startedAt: new Date(Date.now() - 3600000),
      finishedAt: new Date(Date.now() - 3000000),
      duration: 600,
      commitHash: 'def456',
      commitMessage: 'fix: Resolve authentication token validation issue',
      author: 'Jane Smith',
      stages: [
        {
          id: 's4',
          name: 'build',
          status: 'success',
          duration: 180,
          jobs: []
        },
        {
          id: 's5',
          name: 'test',
          status: 'success',
          duration: 240,
          jobs: []
        },
        {
          id: 's6',
          name: 'security-scan',
          status: 'success',
          duration: 180,
          jobs: []
        }
      ],
      artifacts: [
        {
          id: 'a1',
          name: 'build-artifacts.zip',
          type: 'application/zip',
          size: 15728640,
          url: '#',
          createdAt: new Date(Date.now() - 3000000)
        },
        {
          id: 'a2',
          name: 'test-reports.html',
          type: 'text/html',
          size: 524288,
          url: '#',
          createdAt: new Date(Date.now() - 3000000)
        }
      ]
    },
    {
      id: '3',
      name: 'Nightly Build',
      repository: 'data-service',
      branch: 'develop',
      status: 'failed',
      trigger: 'schedule',
      startedAt: new Date(Date.now() - 7200000),
      finishedAt: new Date(Date.now() - 6600000),
      duration: 600,
      commitHash: 'ghi789',
      commitMessage: 'chore: Update dependencies',
      author: 'Bot',
      stages: [
        {
          id: 's7',
          name: 'build',
          status: 'success',
          duration: 200,
          jobs: []
        },
        {
          id: 's8',
          name: 'test',
          status: 'failed',
          duration: 400,
          jobs: [
            {
              id: 'j4',
              name: 'unit-tests',
              status: 'failed',
              duration: 400,
              steps: [],
              logs: [
                '[2024-01-15 10:00:00] Starting unit tests...',
                '[2024-01-15 10:00:05] Running test suite: authentication',
                '[2024-01-15 10:00:10] ✓ Should validate JWT tokens',
                '[2024-01-15 10:00:15] ✓ Should refresh expired tokens',
                '[2024-01-15 10:00:20] ✗ Should handle invalid tokens',
                '[2024-01-15 10:00:20] Error: Expected status 401, got 500',
                '[2024-01-15 10:00:20] Test suite failed with 1 error'
              ]
            }
          ]
        }
      ]
    },
    {
      id: '4',
      name: 'Hotfix Deployment',
      repository: 'payment-service',
      branch: 'hotfix/payment-validation',
      status: 'pending',
      trigger: 'manual',
      commitHash: 'jkl012',
      commitMessage: 'hotfix: Fix payment validation logic',
      author: 'Emergency Team',
      stages: [
        {
          id: 's9',
          name: 'build',
          status: 'pending',
          jobs: []
        },
        {
          id: 's10',
          name: 'test',
          status: 'pending',
          jobs: []
        },
        {
          id: 's11',
          name: 'deploy',
          status: 'pending',
          jobs: []
        }
      ]
    }
  ];

  const deployments: Deployment[] = [
    {
      id: 'd1',
      pipelineId: '1',
      environment: 'production',
      status: 'success',
      version: 'v1.2.3',
      deployedAt: new Date(Date.now() - 86400000),
      deployedBy: 'John Doe',
      changes: [
        {
          id: 'c1',
          type: 'feature',
          description: 'Add user dashboard',
          author: 'John Doe',
          commitHash: 'abc123'
        },
        {
          id: 'c2',
          type: 'fix',
          description: 'Fix memory leak in data processing',
          author: 'Jane Smith',
          commitHash: 'def456'
        }
      ]
    },
    {
      id: 'd2',
      pipelineId: '2',
      environment: 'staging',
      status: 'in_progress',
      version: 'v1.2.4-beta',
      deployedAt: new Date(Date.now() - 3600000),
      deployedBy: 'Jane Smith',
      changes: [
        {
          id: 'c3',
          type: 'refactor',
          description: 'Optimize database queries',
          author: 'Bob Johnson',
          commitHash: 'ghi789'
        }
      ]
    }
  ];

  const branches = ['main', 'develop', 'feature/auth-improvements', 'hotfix/payment-validation'];

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Refresh pipeline data
      console.log('Refreshing pipeline data...');
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filteredPipelines = pipelines.filter(pipeline => {
    const matchesSearch = searchQuery === '' || 
      pipeline.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pipeline.repository.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pipeline.commitMessage?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || pipeline.status === filterStatus;
    const matchesBranch = filterBranch === 'all' || pipeline.branch === filterBranch;
    
    return matchesSearch && matchesStatus && matchesBranch;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
      case 'in_progress':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <Square className="h-4 w-4 text-gray-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'skipped':
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
      case 'in_progress':
        return 'bg-blue-500';
      case 'success':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'cancelled':
        return 'bg-gray-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'skipped':
        return 'bg-gray-400';
      default:
        return 'bg-gray-500';
    }
  };

  const getTriggerIcon = (trigger: string) => {
    switch (trigger) {
      case 'push':
        return <GitCommit className="h-4 w-4" />;
      case 'pr':
        return <GitPullRequest className="h-4 w-4" />;
      case 'schedule':
        return <Clock className="h-4 w-4" />;
      case 'manual':
        return <Play className="h-4 w-4" />;
      case 'api':
        return <Zap className="h-4 w-4" />;
      default:
        return <GitBranch className="h-4 w-4" />;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Workflow className="h-8 w-8" />
            CI/CD Pipelines
          </h1>
          <p className="text-muted-foreground mt-2">
            Continuous integration and deployment pipeline management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Pipeline
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search pipelines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch} value={branch}>
                    {branch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(viewMode === 'list' ? 'graph' : 'list')}
            >
              {viewMode === 'list' ? <Layers className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline List */}
        <div className="lg:col-span-1">
          <Card className="h-[800px] flex flex-col">
            <CardHeader>
              <CardTitle>Pipelines</CardTitle>
              <CardDescription>
                {filteredPipelines.length} pipeline{filteredPipelines.length !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {filteredPipelines.map((pipeline) => (
                    <button
                      key={pipeline.id}
                      onClick={() => setSelectedPipeline(pipeline)}
                      className={`w-full text-left p-3 rounded-lg border hover:bg-muted transition-colors ${
                        selectedPipeline?.id === pipeline.id ? 'bg-muted border-primary' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(pipeline.status)}
                          <span className="font-medium">{pipeline.name}</span>
                        </div>
                        {getTriggerIcon(pipeline.trigger)}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {pipeline.repository}
                        </Badge>
                        <span>•</span>
                        <GitBranch className="h-3 w-3" />
                        <span>{pipeline.branch}</span>
                      </div>
                      {pipeline.commitMessage && (
                        <p className="text-xs text-muted-foreground mt-2 truncate">
                          {pipeline.commitMessage}
                        </p>
                      )}
                      {pipeline.startedAt && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(pipeline.startedAt).toLocaleTimeString()}</span>
                          {pipeline.duration && (
                            <>
                              <span>•</span>
                              <Timer className="h-3 w-3" />
                              <span>{formatDuration(pipeline.duration)}</span>
                            </>
                          )}
                        </div>
                      )}
                      {pipeline.currentStage && pipeline.status === 'running' && (
                        <div className="mt-2">
                          <Progress value={33} className="h-1" />
                          <p className="text-xs text-muted-foreground mt-1">
                            Running: {pipeline.currentStage}
                          </p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Details */}
        <div className="lg:col-span-2">
          {selectedPipeline ? (
            <Card className="h-[800px] flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(selectedPipeline.status)}
                      <CardTitle>{selectedPipeline.name}</CardTitle>
                    </div>
                    <CardDescription className="mt-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{selectedPipeline.repository}</Badge>
                        <GitBranch className="h-3 w-3" />
                        <span>{selectedPipeline.branch}</span>
                        {selectedPipeline.environment && (
                          <>
                            <span>•</span>
                            <Cloud className="h-3 w-3" />
                            <span>{selectedPipeline.environment}</span>
                          </>
                        )}
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedPipeline.status === 'running' && (
                      <Button variant="destructive" size="sm">
                        <Square className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                    {(selectedPipeline.status === 'failed' || selectedPipeline.status === 'cancelled') && (
                      <Button size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry
                      </Button>
                    )}
                    {selectedPipeline.status === 'success' && (
                      <Button size="sm">
                        <Rocket className="h-4 w-4 mr-2" />
                        Deploy
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <Tabs defaultValue="stages" className="h-full flex flex-col">
                  <TabsList>
                    <TabsTrigger value="stages">Stages</TabsTrigger>
                    <TabsTrigger value="logs">Logs</TabsTrigger>
                    <TabsTrigger value="artifacts">Artifacts</TabsTrigger>
                    <TabsTrigger value="commit">Commit</TabsTrigger>
                  </TabsList>

                  <TabsContent value="stages" className="flex-1 overflow-auto">
                    {/* Commit Info */}
                    {selectedPipeline.commitHash && (
                      <Alert className="mb-4">
                        <GitCommit className="h-4 w-4" />
                        <AlertDescription>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{selectedPipeline.commitMessage}</p>
                              <div className="flex items-center gap-2 mt-1 text-xs">
                                <span className="font-mono">{selectedPipeline.commitHash}</span>
                                <span>by {selectedPipeline.author}</span>
                                {selectedPipeline.startedAt && (
                                  <>
                                    <span>•</span>
                                    <span>{new Date(selectedPipeline.startedAt).toLocaleString()}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Pipeline Stages */}
                    <div className="space-y-4">
                      {selectedPipeline.stages.map((stage, stageIndex) => (
                        <div key={stage.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(stage.status)}
                              <h3 className="font-semibold capitalize">{stage.name}</h3>
                              {stage.duration && (
                                <span className="text-xs text-muted-foreground">
                                  ({formatDuration(stage.duration)})
                                </span>
                              )}
                            </div>
                            <Badge className={getStatusColor(stage.status)}>
                              {stage.status}
                            </Badge>
                          </div>

                          {/* Jobs */}
                          {stage.jobs.length > 0 && (
                            <div className="space-y-2">
                              {stage.jobs.map((job) => (
                                <div
                                  key={job.id}
                                  className="pl-6 border-l-2 border-muted"
                                >
                                  <button
                                    onClick={() => setSelectedJob(job)}
                                    className="w-full text-left p-2 rounded hover:bg-muted transition-colors"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        {getStatusIcon(job.status)}
                                        <span className="text-sm">{job.name}</span>
                                        {job.duration && (
                                          <span className="text-xs text-muted-foreground">
                                            ({formatDuration(job.duration)})
                                          </span>
                                        )}
                                      </div>
                                      {job.logs && job.logs.length > 0 && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedJob(job);
                                            setShowLogs(true);
                                          }}
                                        >
                                          <Terminal className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>

                                    {/* Steps */}
                                    {job.steps.length > 0 && (
                                      <div className="mt-2 space-y-1">
                                        {job.steps.map((step) => (
                                          <div
                                            key={step.id}
                                            className="flex items-center gap-2 text-xs text-muted-foreground pl-6"
                                          >
                                            {getStatusIcon(step.status)}
                                            <span>{step.name}</span>
                                            {step.duration && (
                                              <span>({formatDuration(step.duration)})</span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="logs" className="flex-1 overflow-auto">
                    {selectedJob && selectedJob.logs ? (
                      <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto">
                        <pre>{selectedJob.logs.join('\n')}</pre>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Terminal className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">
                            Select a job to view logs
                          </p>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="artifacts" className="flex-1 overflow-auto">
                    {selectedPipeline.artifacts && selectedPipeline.artifacts.length > 0 ? (
                      <div className="space-y-2">
                        {selectedPipeline.artifacts.map((artifact) => (
                          <div
                            key={artifact.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Package className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{artifact.name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{formatFileSize(artifact.size)}</span>
                                  <span>•</span>
                                  <span>{new Date(artifact.createdAt).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">
                            No artifacts generated
                          </p>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="commit" className="flex-1 overflow-auto">
                    <div className="space-y-4">
                      <div>
                        <Label>Commit Hash</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 p-2 bg-muted rounded text-sm">
                            {selectedPipeline.commitHash || 'N/A'}
                          </code>
                          <Button variant="ghost" size="sm">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <Label>Commit Message</Label>
                        <p className="mt-1 p-2 bg-muted rounded">
                          {selectedPipeline.commitMessage || 'No commit message'}
                        </p>
                      </div>
                      <div>
                        <Label>Author</Label>
                        <p className="mt-1">{selectedPipeline.author || 'Unknown'}</p>
                      </div>
                      <div>
                        <Label>Branch</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <GitBranch className="h-4 w-4" />
                          <span>{selectedPipeline.branch}</span>
                        </div>
                      </div>
                      <div>
                        <Label>Trigger</Label>
                        <div className="flex items-center gap-2 mt-1">
                          {getTriggerIcon(selectedPipeline.trigger)}
                          <span className="capitalize">{selectedPipeline.trigger}</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-[800px] flex items-center justify-center">
              <div className="text-center">
                <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a Pipeline</h3>
                <p className="text-muted-foreground">
                  Choose a pipeline to view its details and execution history
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Recent Deployments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Deployments</CardTitle>
          <CardDescription>
            Deployment history across all environments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {deployments.map((deployment) => (
              <div
                key={deployment.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(deployment.status)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{deployment.version}</span>
                      <Badge variant="outline">{deployment.environment}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>Deployed by {deployment.deployedBy}</span>
                      <span>•</span>
                      <span>{new Date(deployment.deployedAt).toLocaleString()}</span>
                      <span>•</span>
                      <span>{deployment.changes.length} changes</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {deployment.status === 'success' && (
                    <Button variant="ghost" size="sm">
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Rollback
                    </Button>
                  )}
                  <Button variant="ghost" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}