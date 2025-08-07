'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Play, Pause, Square, RotateCcw, CheckCircle, XCircle, Clock, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { ProgressiveDeployment, DeploymentPhase, MetricResult } from '@/lib/progressive-delivery/types';
import { ProgressiveDeliveryOrchestrator } from '@/lib/progressive-delivery/orchestrator';

interface ProgressiveDeploymentDashboardProps {
  orchestrator: ProgressiveDeliveryOrchestrator;
}

export function ProgressiveDeploymentDashboard({ orchestrator }: ProgressiveDeploymentDashboardProps) {
  const [deployments, setDeployments] = useState<ProgressiveDeployment[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<ProgressiveDeployment | null>(null);
  const [metrics, setMetrics] = useState<MetricResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDeployments();
    const interval = setInterval(loadDeployments, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedDeployment) {
      loadMetrics(selectedDeployment.id);
    }
  }, [selectedDeployment]);

  const loadDeployments = async () => {
    try {
      const deploymentList = orchestrator.listDeployments();
      setDeployments(deploymentList);
      
      if (!selectedDeployment && deploymentList.length > 0) {
        setSelectedDeployment(deploymentList[0]);
      }
    } catch (error) {
      console.error('Failed to load deployments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async (deploymentId: string) => {
    try {
      const deploymentMetrics = await orchestrator.getDeploymentMetrics(deploymentId);
      setMetrics(deploymentMetrics);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const handlePauseDeployment = async (deploymentId: string) => {
    try {
      await orchestrator.pauseDeployment(deploymentId);
      await loadDeployments();
    } catch (error) {
      console.error('Failed to pause deployment:', error);
    }
  };

  const handleResumeDeployment = async (deploymentId: string) => {
    try {
      await orchestrator.resumeDeployment(deploymentId);
      await loadDeployments();
    } catch (error) {
      console.error('Failed to resume deployment:', error);
    }
  };

  const handleRollbackDeployment = async (deploymentId: string) => {
    try {
      await orchestrator.rollbackDeployment(deploymentId, 'Manual rollback');
      await loadDeployments();
    } catch (error) {
      console.error('Failed to rollback deployment:', error);
    }
  };

  const handlePromoteDeployment = async (deploymentId: string) => {
    try {
      await orchestrator.promoteDeployment(deploymentId);
      await loadDeployments();
    } catch (error) {
      console.error('Failed to promote deployment:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'succeeded': return 'bg-green-100 text-green-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'terminated': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'succeeded': return <CheckCircle className="w-4 h-4" />;
      case 'running': return <Play className="w-4 h-4" />;
      case 'paused': return <Pause className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      case 'terminated': return <Square className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const calculateProgress = (deployment: ProgressiveDeployment) => {
    if (deployment.phases.length === 0) return 0;
    const completedPhases = deployment.phases.filter(p => p.status === 'succeeded').length;
    return Math.round((completedPhases / deployment.phases.length) * 100);
  };

  const generateTrafficSplitData = (deployment: ProgressiveDeployment) => {
    const currentPhase = deployment.phases[deployment.currentPhase];
    if (!currentPhase) return [];

    return [
      { name: 'Stable', value: currentPhase.traffic.stable, color: '#10b981' },
      { name: 'Canary', value: currentPhase.traffic.canary, color: '#3b82f6' },
      ...(currentPhase.traffic.preview ? [{ name: 'Preview', value: currentPhase.traffic.preview, color: '#f59e0b' }] : [])
    ];
  };

  const generateMetricsChartData = () => {
    return metrics.map((metric, index) => ({
      time: new Date(metric.timestamp).toLocaleTimeString(),
      [metric.name]: metric.value,
      threshold: metric.threshold
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Progressive Delivery Dashboard</h1>
        <div className="flex space-x-2">
          <Button onClick={loadDeployments} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Deployment List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Active Deployments</CardTitle>
            <CardDescription>{deployments.length} deployments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {deployments.map((deployment) => (
              <div
                key={deployment.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedDeployment?.id === deployment.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedDeployment(deployment)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{deployment.name}</span>
                  <Badge className={getStatusColor(deployment.status)}>
                    {getStatusIcon(deployment.status)}
                    {deployment.status}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  {deployment.config.service.name} v{deployment.config.service.version}
                </div>
                <Progress value={calculateProgress(deployment)} className="h-1" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Main Dashboard */}
        <div className="lg:col-span-3 space-y-6">
          {selectedDeployment ? (
            <>
              {/* Deployment Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {getStatusIcon(selectedDeployment.status)}
                        {selectedDeployment.name}
                      </CardTitle>
                      <CardDescription>
                        Strategy: {selectedDeployment.config.strategy} | 
                        Phase: {selectedDeployment.currentPhase + 1}/{selectedDeployment.phases.length} |
                        Progress: {calculateProgress(selectedDeployment)}%
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {selectedDeployment.status === 'running' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePauseDeployment(selectedDeployment.id)}
                        >
                          <Pause className="w-4 h-4 mr-1" />
                          Pause
                        </Button>
                      )}
                      {selectedDeployment.status === 'paused' && (
                        <Button
                          size="sm"
                          onClick={() => handleResumeDeployment(selectedDeployment.id)}
                        >
                          <Play className="w-4 h-4 mr-1" />
                          Resume
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRollbackDeployment(selectedDeployment.id)}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Rollback
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handlePromoteDeployment(selectedDeployment.id)}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Promote
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={calculateProgress(selectedDeployment)} className="h-3" />
                </CardContent>
              </Card>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="phases">Phases</TabsTrigger>
                  <TabsTrigger value="metrics">Metrics</TabsTrigger>
                  <TabsTrigger value="traffic">Traffic</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Deployment Info</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Service:</span>
                          <span className="text-sm font-medium">{selectedDeployment.config.service.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Version:</span>
                          <span className="text-sm font-medium">{selectedDeployment.config.service.version}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Strategy:</span>
                          <span className="text-sm font-medium">{selectedDeployment.config.strategy}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Created:</span>
                          <span className="text-sm font-medium">
                            {new Date(selectedDeployment.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Updated:</span>
                          <span className="text-sm font-medium">
                            {new Date(selectedDeployment.updatedAt).toLocaleString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Current Traffic Split</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={generateTrafficSplitData(selectedDeployment)}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, value }) => `${name}: ${value}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {generateTrafficSplitData(selectedDeployment).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Metrics Summary */}
                  {metrics.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Current Metrics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {metrics.map((metric) => (
                            <div key={metric.name} className="text-center">
                              <div className="text-2xl font-bold flex items-center justify-center">
                                {metric.value.toFixed(3)}
                                {metric.status === 'success' ? (
                                  <TrendingUp className="w-4 h-4 text-green-500 ml-1" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 text-red-500 ml-1" />
                                )}
                              </div>
                              <div className="text-sm text-gray-500">{metric.name}</div>
                              <div className="text-xs text-gray-400">Threshold: {metric.threshold}</div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="phases" className="space-y-4">
                  {selectedDeployment.phases.map((phase, index) => (
                    <Card key={index} className={index === selectedDeployment.currentPhase ? 'border-blue-500' : ''}>
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-medium">{phase.name}</span>
                            <Badge className={getStatusColor(phase.status)}>
                              {getStatusIcon(phase.status)}
                              {phase.status}
                            </Badge>
                            {index === selectedDeployment.currentPhase && (
                              <Badge variant="outline">Current</Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            Canary: {phase.canaryWeight}%
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Stable:</span> {phase.traffic.stable}%
                          </div>
                          <div>
                            <span className="text-gray-500">Canary:</span> {phase.traffic.canary}%
                          </div>
                          {phase.traffic.preview && (
                            <div>
                              <span className="text-gray-500">Preview:</span> {phase.traffic.preview}%
                            </div>
                          )}
                        </div>
                        {phase.startTime && (
                          <div className="text-xs text-gray-400 mt-2">
                            Started: {new Date(phase.startTime).toLocaleString()}
                            {phase.endTime && (
                              <> • Ended: {new Date(phase.endTime).toLocaleString()}</>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="metrics" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Metrics Timeline</CardTitle>
                      <CardDescription>Real-time deployment metrics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={generateMetricsChartData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          {metrics.map((metric) => (
                            <Line
                              key={metric.name}
                              type="monotone"
                              dataKey={metric.name}
                              stroke={metric.status === 'success' ? '#10b981' : '#ef4444'}
                              strokeWidth={2}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Alerts */}
                  {metrics.some(m => m.status === 'failure') && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Metric Failures Detected</AlertTitle>
                      <AlertDescription>
                        Some metrics are failing their thresholds. Consider rolling back the deployment.
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                <TabsContent value="traffic" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Traffic Distribution</CardTitle>
                      <CardDescription>Current traffic routing configuration</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {generateTrafficSplitData(selectedDeployment).map((traffic) => (
                          <div key={traffic.name} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{traffic.name}</span>
                              <span className="text-sm text-gray-500">{traffic.value}%</span>
                            </div>
                            <Progress value={traffic.value} className="h-2" />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Routing Rules</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm space-y-2">
                        <div>Header-based routing: x-canary-user → Canary</div>
                        <div>Geography-based routing: US East → Stable</div>
                        <div>Percentage-based: {selectedDeployment.phases[selectedDeployment.currentPhase]?.canaryWeight || 0}% → Canary</div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-2" />
                  <p>No deployments selected</p>
                  <p className="text-sm">Select a deployment from the list to view details</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}