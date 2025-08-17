'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Rocket, 
  RotateCcw, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Activity,
  Clock,
  Target,
  Zap,
  Shield,
  Eye,
  PlayCircle,
  PauseCircle,
  StopCircle,
  FastForward,
  Rewind,
  BarChart3,
  Settings,
  Users,
  AlertCircle,
  Timer,
  Gauge
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

interface DeploymentState {
  id: string;
  pluginId: string;
  pluginVersion: string;
  tenantId?: string;
  phase: string;
  strategy: string;
  currentTrafficPercentage: number;
  startTime: string;
  estimatedCompletion?: string;
  healthMetrics?: {
    overall: 'healthy' | 'warning' | 'critical' | 'unknown';
    errorRate: number;
    responseTime: number;
  };
  instances?: Array<{
    id: string;
    version: string;
    type: 'current' | 'canary';
    status: string;
    trafficWeight: number;
    healthScore: number;
  }>;
  events?: Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
    severity: string;
  }>;
  approvalStatus?: {
    stage: string;
    status: 'pending' | 'approved' | 'rejected' | 'timeout';
    approvals: Array<{
      approver: string;
      status: 'pending' | 'approved' | 'rejected';
      timestamp?: string;
      reason?: string;
    }>;
    deadline: string;
  };
}

interface CanaryDeploymentManagerProps {
  pluginId: string;
  pluginName: string;
  currentVersion: string;
  availableVersions?: string[];
  onDeploymentComplete?: () => void;
}

const PHASE_COLORS = {
  pending: 'text-gray-600 bg-gray-100 dark:bg-gray-700',
  initializing: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20',
  canary: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20',
  progressive: 'text-purple-600 bg-purple-100 dark:bg-purple-900/20',
  complete: 'text-green-600 bg-green-100 dark:bg-green-900/20',
  rolling_back: 'text-red-600 bg-red-100 dark:bg-red-900/20',
  rollback_complete: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20',
  failed: 'text-red-600 bg-red-100 dark:bg-red-900/20'
};

const HEALTH_ICONS = {
  healthy: <CheckCircle className="w-4 h-4 text-green-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  critical: <XCircle className="w-4 h-4 text-red-500" />,
  unknown: <AlertCircle className="w-4 h-4 text-gray-500" />
};

export default function CanaryDeploymentManager({
  pluginId,
  pluginName,
  currentVersion,
  availableVersions = [],
  onDeploymentComplete
}: CanaryDeploymentManagerProps) {
  const queryClient = useQueryClient();
  const [selectedVersion, setSelectedVersion] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [rollbackReason, setRollbackReason] = useState('');
  const [showRollbackModal, setShowRollbackModal] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);

  // Fetch active deployments for this plugin
  const { data: deploymentsData, isLoading, refetch } = useQuery({
    queryKey: ['canary-deployments', pluginId],
    queryFn: async () => {
      const response = await fetch(`/api/plugins/canary-deployment?pluginId=${pluginId}`);
      if (!response.ok) throw new Error('Failed to fetch deployments');
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch detailed deployment info when selected
  const { data: deploymentDetailsData } = useQuery({
    queryKey: ['canary-deployment-details', selectedDeployment],
    queryFn: async () => {
      if (!selectedDeployment) return null;
      const response = await fetch(`/api/plugins/canary-deployment?deploymentId=${selectedDeployment}`);
      if (!response.ok) throw new Error('Failed to fetch deployment details');
      return response.json();
    },
    enabled: !!selectedDeployment,
    refetchInterval: 3000,
  });

  const deployments: DeploymentState[] = deploymentsData?.deployments || [];
  const deploymentDetails: DeploymentState = deploymentDetailsData?.deployment;

  // Start canary deployment mutation
  const startDeploymentMutation = useMutation({
    mutationFn: async ({ toVersion, config }: { toVersion: string; config?: any }) => {
      const response = await fetch('/api/plugins/canary-deployment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pluginId,
          fromVersion: currentVersion,
          toVersion,
          approvalRequired,
          config
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start deployment');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast.success(`Canary deployment started for ${pluginName}`);
      setSelectedDeployment(data.deployment.id);
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Failed to start deployment: ${error.message}`);
    },
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: async ({ deploymentId, reason }: { deploymentId: string; reason: string }) => {
      const response = await fetch('/api/plugins/canary-deployment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deploymentId,
          action: 'rollback',
          reason
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to rollback deployment');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast.success('Rollback initiated successfully');
      setShowRollbackModal(false);
      setRollbackReason('');
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Failed to rollback: ${error.message}`);
    },
  });

  const handleStartDeployment = () => {
    if (!selectedVersion) {
      toast.error('Please select a version to deploy');
      return;
    }

    startDeploymentMutation.mutate({ toVersion: selectedVersion });
  };

  const handleRollback = (deploymentId: string) => {
    if (!rollbackReason.trim()) {
      toast.error('Please provide a reason for rollback');
      return;
    }

    rollbackMutation.mutate({ deploymentId, reason: rollbackReason });
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMins % 60}m`;
    }
    return `${diffMins}m`;
  };

  const getPhaseProgress = (phase: string, trafficPercentage: number) => {
    const phaseSteps = ['pending', 'initializing', 'canary', 'progressive', 'complete'];
    const currentStep = phaseSteps.indexOf(phase);
    const progress = currentStep >= 0 ? ((currentStep + 1) / phaseSteps.length) * 100 : 0;
    
    if (phase === 'progressive') {
      return Math.min(20 + (trafficPercentage / 100) * 60, 80);
    }
    
    return progress;
  };

  const activeDeployment = deployments.find(d => 
    !['complete', 'rollback_complete', 'failed'].includes(d.phase)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg flex items-center justify-center">
            <Rocket className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Canary Deployment
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Safe, gradual plugin rollouts with automated monitoring
            </p>
          </div>
        </div>

        {!activeDeployment && (
          <button
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Advanced
          </button>
        )}
      </div>

      {/* New Deployment Form */}
      {!activeDeployment && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
        >
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Start New Deployment
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Version
              </label>
              <input
                type="text"
                value={currentVersion}
                disabled
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Version
              </label>
              <select
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select version...</option>
                {availableVersions
                  .filter(v => v !== currentVersion)
                  .map(version => (
                    <option key={version} value={version}>{version}</option>
                  ))
                }
              </select>
            </div>
          </div>

          {/* Advanced Options */}
          <AnimatePresence>
            {showAdvancedOptions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mb-4"
              >
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="approval-required"
                        checked={approvalRequired}
                        onChange={(e) => setApprovalRequired(e.target.checked)}
                        className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
                      />
                      <label htmlFor="approval-required" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Require approval before deployment
                      </label>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-end">
            <button
              onClick={handleStartDeployment}
              disabled={!selectedVersion || startDeploymentMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Rocket className="w-4 h-4" />
              {startDeploymentMutation.isPending ? 'Starting...' : 'Start Deployment'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Active Deployments */}
      {deployments.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            {activeDeployment ? 'Active Deployment' : 'Recent Deployments'}
          </h3>

          {deployments.map((deployment) => (
            <motion.div
              key={deployment.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden ${
                selectedDeployment === deployment.id ? 'ring-2 ring-purple-500' : ''
              }`}
            >
              {/* Deployment Summary */}
              <div 
                className="p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                onClick={() => setSelectedDeployment(
                  selectedDeployment === deployment.id ? null : deployment.id
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {HEALTH_ICONS[deployment.healthMetrics?.overall || 'unknown']}
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${PHASE_COLORS[deployment.phase as keyof typeof PHASE_COLORS]}`}>
                        {deployment.phase.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {currentVersion} → {deployment.pluginVersion}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Started {formatDuration(deployment.startTime)} ago
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Traffic Percentage */}
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {deployment.currentTrafficPercentage}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        New Version Traffic
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-32">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{Math.round(getPhaseProgress(deployment.phase, deployment.currentTrafficPercentage))}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${getPhaseProgress(deployment.phase, deployment.currentTrafficPercentage)}%` 
                          }}
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    {!['complete', 'rollback_complete', 'failed'].includes(deployment.phase) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDeployment(deployment.id);
                          setShowRollbackModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Rollback
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Deployment Details */}
              <AnimatePresence>
                {selectedDeployment === deployment.id && deploymentDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="p-6 space-y-6">
                      {/* Health Metrics */}
                      {deploymentDetails.healthMetrics && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                            Health Metrics
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                                <span className="text-xs text-gray-500 dark:text-gray-400">Error Rate</span>
                              </div>
                              <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                {deploymentDetails.healthMetrics.errorRate.toFixed(2)}%
                              </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <Activity className="w-4 h-4 text-blue-500" />
                                <span className="text-xs text-gray-500 dark:text-gray-400">Response Time</span>
                              </div>
                              <div className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                {deploymentDetails.healthMetrics.responseTime}ms
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Instances */}
                      {deploymentDetails.instances && deploymentDetails.instances.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                            Plugin Instances
                          </h4>
                          <div className="space-y-2">
                            {deploymentDetails.instances.map((instance) => (
                              <div key={instance.id} className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full ${
                                    instance.status === 'healthy' ? 'bg-green-500' : 
                                    instance.status === 'unhealthy' ? 'bg-red-500' : 'bg-yellow-500'
                                  }`} />
                                  <div>
                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                      {instance.type === 'canary' ? 'New Version' : 'Current Version'}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      v{instance.version} • {instance.status}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {instance.trafficWeight}%
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Traffic
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Recent Events */}
                      {deploymentDetails.events && deploymentDetails.events.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                            Recent Events
                          </h4>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {deploymentDetails.events.slice(-10).reverse().map((event) => (
                              <div key={event.id} className="flex gap-3 text-sm">
                                <div className="text-xs text-gray-500 dark:text-gray-400 w-16">
                                  {new Date(event.timestamp).toLocaleTimeString()}
                                </div>
                                <div className={`flex-1 ${
                                  event.severity === 'error' ? 'text-red-600 dark:text-red-400' :
                                  event.severity === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                                  'text-gray-700 dark:text-gray-300'
                                }`}>
                                  {event.message}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Rollback Modal */}
      <AnimatePresence>
        {showRollbackModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Rollback Deployment
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    This will revert to the previous version
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for rollback
                </label>
                <textarea
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-red-500"
                  rows={3}
                  placeholder="Describe why you're rolling back this deployment..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowRollbackModal(false);
                    setRollbackReason('');
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => selectedDeployment && handleRollback(selectedDeployment)}
                  disabled={!rollbackReason.trim() || rollbackMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {rollbackMutation.isPending ? 'Rolling Back...' : 'Confirm Rollback'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {deployments.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Rocket className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No deployments yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Start a canary deployment to safely roll out new plugin versions
          </p>
        </div>
      )}
    </div>
  );
}