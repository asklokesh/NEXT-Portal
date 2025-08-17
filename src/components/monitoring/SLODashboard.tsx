'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Zap,
  Shield,
  Target,
  BarChart3,
  AlertCircle,
  RefreshCw,
  Settings,
  Eye,
  Plus,
  Minus,
  ArrowUp,
  ArrowDown,
  Gauge
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SLOStatus {
  id: string;
  name: string;
  target: number;
  current: number;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  errorBudget: number;
  violations: number;
  lastUpdated: string;
}

interface SLODetail {
  id: string;
  name: string;
  description: string;
  target: number;
  current: number;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  errorBudget: number;
  burnRate: number;
  violations: Array<{
    id: string;
    severity: 'warning' | 'critical';
    value: number;
    threshold: number;
    startTime: string;
    duration: number;
    resolved: boolean;
    actionsTaken: string[];
  }>;
  lastUpdated: string;
}

interface CircuitBreaker {
  id: string;
  pluginId: string;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
}

interface HealthDashboard {
  slos: Array<{
    id: string;
    name: string;
    target: number;
    current: number;
    status: 'healthy' | 'warning' | 'critical' | 'unknown';
    errorBudget: number;
    violations: number;
  }>;
  circuitBreakers: CircuitBreaker[];
  overall: {
    healthy: number;
    warning: number;
    critical: number;
    total: number;
  };
}

const STATUS_COLORS = {
  healthy: 'text-green-600 bg-green-100 dark:bg-green-900/20',
  warning: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20',
  critical: 'text-red-600 bg-red-100 dark:bg-red-900/20',
  unknown: 'text-gray-600 bg-gray-100 dark:bg-gray-700/20'
};

const STATUS_ICONS = {
  healthy: <CheckCircle className="w-5 h-5 text-green-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  critical: <XCircle className="w-5 h-5 text-red-500" />,
  unknown: <AlertCircle className="w-5 h-5 text-gray-500" />
};

const CIRCUIT_BREAKER_COLORS = {
  closed: 'text-green-600 bg-green-100 dark:bg-green-900/20',
  open: 'text-red-600 bg-red-100 dark:bg-red-900/20',
  half_open: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20'
};

export default function SLODashboard() {
  const [selectedSLO, setSelectedSLO] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'detailed'>('overview');

  // Fetch dashboard data
  const { data: dashboardData, isLoading, error, refetch } = useQuery({
    queryKey: ['slo-dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/monitoring/slo?dashboard=true');
      if (!response.ok) throw new Error('Failed to fetch SLO dashboard');
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch detailed SLO data when selected
  const { data: sloDetailData } = useQuery({
    queryKey: ['slo-detail', selectedSLO],
    queryFn: async () => {
      if (!selectedSLO) return null;
      const response = await fetch(`/api/monitoring/slo?sloId=${selectedSLO}`);
      if (!response.ok) throw new Error('Failed to fetch SLO details');
      return response.json();
    },
    enabled: !!selectedSLO,
    refetchInterval: 3000,
  });

  const dashboard: HealthDashboard = dashboardData?.dashboard;
  const sloDetail: SLODetail = sloDetailData?.slo;

  const formatPercent = (value: number, decimals = 2) => {
    return `${value.toFixed(decimals)}%`;
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const getHealthScore = () => {
    if (!dashboard) return 0;
    const { healthy, total } = dashboard.overall;
    return total > 0 ? (healthy / total) * 100 : 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading SLO dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Failed to load SLO dashboard
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg flex items-center justify-center">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              SLO Monitoring
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Real-time service level objectives and health monitoring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode(viewMode === 'overview' ? 'detailed' : 'overview')}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Eye className="w-4 h-4" />
            {viewMode === 'overview' ? 'Detailed View' : 'Overview'}
          </button>
          
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Health Score */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            System Health Overview
          </h2>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Last updated: {new Date(dashboardData.timestamp).toLocaleTimeString()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Health Score Gauge */}
          <div className="md:col-span-2">
            <div className="text-center">
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="stroke-gray-200 dark:stroke-gray-700"
                    fill="none"
                    strokeWidth="3"
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={`${getHealthScore() >= 95 ? 'stroke-green-500' : 
                      getHealthScore() >= 85 ? 'stroke-yellow-500' : 'stroke-red-500'}`}
                    fill="none"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${getHealthScore()}, 100`}
                    d="M18 2.0845
                      a 15.9155 15.9155 0 0 1 0 31.831
                      a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {Math.round(getHealthScore())}%
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Health Score</div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Overall system health based on SLO compliance
              </p>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="md:col-span-3 grid grid-cols-2 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-6 h-6 text-green-500" />
                <span className="text-2xl font-bold text-green-600">{dashboard.overall.healthy}</span>
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">Healthy SLOs</div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
                <span className="text-2xl font-bold text-yellow-600">{dashboard.overall.warning}</span>
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300">Warning SLOs</div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <XCircle className="w-6 h-6 text-red-500" />
                <span className="text-2xl font-bold text-red-600">{dashboard.overall.critical}</span>
              </div>
              <div className="text-sm text-red-700 dark:text-red-300">Critical SLOs</div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/20 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <Target className="w-6 h-6 text-gray-500" />
                <span className="text-2xl font-bold text-gray-600 dark:text-gray-300">{dashboard.overall.total}</span>
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">Total SLOs</div>
            </div>
          </div>
        </div>
      </div>

      {/* Circuit Breakers Status */}
      {dashboard.circuitBreakers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Circuit Breakers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboard.circuitBreakers.map((breaker) => (
              <div key={breaker.id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {breaker.pluginId}
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${CIRCUIT_BREAKER_COLORS[breaker.state]}`}>
                    {breaker.state.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Failures: {breaker.failureCount}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SLO List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Service Level Objectives
          </h2>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {dashboard.slos.map((slo) => (
            <motion.div
              key={slo.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                selectedSLO === slo.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
              onClick={() => setSelectedSLO(selectedSLO === slo.id ? null : slo.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {STATUS_ICONS[slo.status]}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {slo.name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Target: {formatPercent(slo.target)} • Current: {formatPercent(slo.current)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[slo.status]}`}>
                      {slo.status.toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Error Budget: {formatPercent(slo.errorBudget)}
                    </div>
                  </div>

                  {slo.violations > 0 && (
                    <div className="text-right">
                      <div className="text-sm font-medium text-red-600">
                        {slo.violations} violations
                      </div>
                    </div>
                  )}

                  <div className="w-24">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Compliance
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          slo.current >= slo.target ? 'bg-green-500' :
                          slo.current >= slo.target * 0.95 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ 
                          width: `${Math.min(100, (slo.current / slo.target) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed View */}
              <AnimatePresence>
                {selectedSLO === slo.id && sloDetail && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Metrics */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                          Current Metrics
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Error Budget Remaining</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {formatPercent(sloDetail.errorBudget)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Burn Rate</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {sloDetail.burnRate.toFixed(2)}x
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Last Updated</span>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {new Date(sloDetail.lastUpdated).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Recent Violations */}
                      {sloDetail.violations.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                            Recent Violations
                          </h4>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {sloDetail.violations.slice(0, 5).map((violation) => (
                              <div key={violation.id} className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                                <div className="flex items-center justify-between mb-1">
                                  <span className={`text-xs font-medium ${
                                    violation.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'
                                  }`}>
                                    {violation.severity.toUpperCase()}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatDuration(violation.duration)}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  Value: {violation.value.toFixed(2)} (threshold: {violation.threshold})
                                </div>
                                {violation.actionsTaken.length > 0 && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    Actions: {violation.actionsTaken.join(', ')}
                                  </div>
                                )}
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
      </div>

      {/* Empty State */}
      {dashboard.slos.length === 0 && (
        <div className="text-center py-12">
          <Target className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No SLOs configured
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Configure Service Level Objectives to monitor system health
          </p>
        </div>
      )}
    </div>
  );
}