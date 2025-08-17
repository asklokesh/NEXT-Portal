'use client';

import React, { useState, useEffect } from 'react';
import {
  Award, Shield, CheckCircle, XCircle, AlertTriangle,
  TrendingUp, TrendingDown, BarChart3, PieChart, Target,
  Clock, Users, GitBranch, Package, Star, ArrowUp, ArrowDown,
  Filter, Search, RefreshCw, Download, Settings, Info,
  FileCheck2, Bug, Zap, Globe, Lock, Activity, Eye, Code
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QualityMetric {
  id: string;
  name: string;
  category: 'security' | 'performance' | 'maintainability' | 'reliability' | 'documentation';
  weight: number;
  score: number;
  status: 'passing' | 'warning' | 'failing';
  trend: 'up' | 'down' | 'stable';
  description: string;
  checks: QualityCheck[];
}

interface QualityCheck {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  automatedFix?: boolean;
}

interface PluginQualityScore {
  id: string;
  name: string;
  version: string;
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  category: 'open-source' | 'enterprise-premium' | 'third-party-verified' | 'custom-internal';
  lastEvaluated: string;
  metrics: QualityMetric[];
  trending: 'up' | 'down' | 'stable';
  issues: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recommendations: string[];
}

const MOCK_QUALITY_SCORES: PluginQualityScore[] = [
  {
    id: 'backstage-catalog',
    name: '@backstage/plugin-catalog',
    version: '1.15.0',
    overallScore: 92,
    grade: 'A',
    category: 'open-source',
    lastEvaluated: '2024-01-13T10:30:00Z',
    trending: 'up',
    issues: { critical: 0, high: 1, medium: 3, low: 8 },
    recommendations: [
      'Update to TypeScript 5.0 for better type safety',
      'Add integration tests for entity validation',
      'Improve error handling in catalog sync'
    ],
    metrics: [
      {
        id: 'security',
        name: 'Security',
        category: 'security',
        weight: 25,
        score: 88,
        status: 'passing',
        trend: 'up',
        description: 'Security vulnerabilities and best practices',
        checks: [
          { id: 'vulns', name: 'Vulnerability Scan', status: 'pass', message: 'No critical vulnerabilities found', severity: 'low' },
          { id: 'deps', name: 'Dependency Audit', status: 'warning', message: '1 dependency needs update', severity: 'medium' },
          { id: 'auth', name: 'Authentication', status: 'pass', message: 'Proper auth integration', severity: 'low' }
        ]
      },
      {
        id: 'performance',
        name: 'Performance',
        category: 'performance',
        weight: 20,
        score: 95,
        status: 'passing',
        trend: 'stable',
        description: 'Runtime performance and resource usage',
        checks: [
          { id: 'load-time', name: 'Load Time', status: 'pass', message: 'Average load time: 1.2s', severity: 'low' },
          { id: 'memory', name: 'Memory Usage', status: 'pass', message: 'Memory usage within limits', severity: 'low' },
          { id: 'bundle-size', name: 'Bundle Size', status: 'pass', message: 'Bundle size: 245KB', severity: 'low' }
        ]
      },
      {
        id: 'maintainability',
        name: 'Maintainability',
        category: 'maintainability',
        weight: 20,
        score: 90,
        status: 'passing',
        trend: 'up',
        description: 'Code quality and maintainability',
        checks: [
          { id: 'complexity', name: 'Code Complexity', status: 'pass', message: 'Cyclomatic complexity: 12', severity: 'low' },
          { id: 'coverage', name: 'Test Coverage', status: 'pass', message: 'Coverage: 85%', severity: 'low' },
          { id: 'linting', name: 'Code Style', status: 'pass', message: 'No linting errors', severity: 'low' }
        ]
      },
      {
        id: 'reliability',
        name: 'Reliability',
        category: 'reliability',
        weight: 20,
        score: 94,
        status: 'passing',
        trend: 'stable',
        description: 'Stability and error handling',
        checks: [
          { id: 'errors', name: 'Error Rate', status: 'pass', message: 'Error rate: 0.02%', severity: 'low' },
          { id: 'uptime', name: 'Uptime', status: 'pass', message: 'Uptime: 99.9%', severity: 'low' },
          { id: 'recovery', name: 'Error Recovery', status: 'pass', message: 'Proper error boundaries', severity: 'low' }
        ]
      },
      {
        id: 'documentation',
        name: 'Documentation',
        category: 'documentation',
        weight: 15,
        score: 87,
        status: 'warning',
        trend: 'down',
        description: 'Documentation completeness and quality',
        checks: [
          { id: 'readme', name: 'README Quality', status: 'pass', message: 'Comprehensive README', severity: 'low' },
          { id: 'api-docs', name: 'API Documentation', status: 'warning', message: 'Missing API examples', severity: 'medium' },
          { id: 'changelog', name: 'Changelog', status: 'pass', message: 'Up-to-date changelog', severity: 'low' }
        ]
      }
    ]
  },
  {
    id: 'backstage-kubernetes',
    name: '@backstage/plugin-kubernetes',
    version: '0.11.2',
    overallScore: 76,
    grade: 'C',
    category: 'open-source',
    lastEvaluated: '2024-01-13T09:15:00Z',
    trending: 'down',
    issues: { critical: 2, high: 4, medium: 8, low: 12 },
    recommendations: [
      'Critical: Update Kubernetes client library for security patch',
      'High: Implement proper resource cleanup on unmount',
      'Medium: Add loading states for better UX'
    ],
    metrics: [
      {
        id: 'security',
        name: 'Security',
        category: 'security',
        weight: 25,
        score: 65,
        status: 'warning',
        trend: 'down',
        description: 'Security vulnerabilities and best practices',
        checks: [
          { id: 'vulns', name: 'Vulnerability Scan', status: 'fail', message: '2 critical vulnerabilities found', severity: 'critical', automatedFix: true },
          { id: 'deps', name: 'Dependency Audit', status: 'warning', message: '4 dependencies need update', severity: 'high' },
          { id: 'auth', name: 'Authentication', status: 'pass', message: 'Proper auth integration', severity: 'low' }
        ]
      }
    ]
  }
];

export default function QualityGateDashboard() {
  const [selectedPlugin, setSelectedPlugin] = useState<PluginQualityScore | null>(null);
  const [filterGrade, setFilterGrade] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'lastEvaluated'>('score');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredPlugins = MOCK_QUALITY_SCORES.filter(plugin => {
    const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = filterGrade === 'all' || plugin.grade === filterGrade;
    const matchesCategory = filterCategory === 'all' || plugin.category === filterCategory;
    return matchesSearch && matchesGrade && matchesCategory;
  }).sort((a, b) => {
    if (sortBy === 'score') return b.overallScore - a.overallScore;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'lastEvaluated') return new Date(b.lastEvaluated).getTime() - new Date(a.lastEvaluated).getTime();
    return 0;
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 80) return 'text-yellow-600';
    if (score >= 70) return 'text-orange-600';
    return 'text-red-600';
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-100 text-green-700 border-green-300';
      case 'B': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'C': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'D': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'F': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'open-source': return Globe;
      case 'enterprise-premium': return Shield;
      case 'third-party-verified': return CheckCircle;
      case 'custom-internal': return Code;
      default: return Package;
    }
  };

  const renderOverviewCards = () => {
    const totalPlugins = MOCK_QUALITY_SCORES.length;
    const averageScore = Math.round(MOCK_QUALITY_SCORES.reduce((sum, p) => sum + p.overallScore, 0) / totalPlugins);
    const passingPlugins = MOCK_QUALITY_SCORES.filter(p => p.overallScore >= 80).length;
    const criticalIssues = MOCK_QUALITY_SCORES.reduce((sum, p) => sum + p.issues.critical, 0);

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          {
            label: 'Average Quality Score',
            value: `${averageScore}%`,
            icon: Target,
            color: 'blue',
            trend: '+2.3%',
            description: 'Overall plugin quality'
          },
          {
            label: 'Plugins Passing',
            value: `${passingPlugins}/${totalPlugins}`,
            icon: CheckCircle,
            color: 'green',
            trend: `${Math.round((passingPlugins / totalPlugins) * 100)}%`,
            description: 'Score ≥ 80%'
          },
          {
            label: 'Critical Issues',
            value: criticalIssues.toString(),
            icon: AlertTriangle,
            color: criticalIssues > 0 ? 'red' : 'green',
            trend: criticalIssues > 0 ? 'Needs attention' : 'All clear',
            description: 'Across all plugins'
          },
          {
            label: 'Quality Trend',
            value: '+5.2%',
            icon: TrendingUp,
            color: 'emerald',
            trend: 'This month',
            description: 'Quality improvement'
          }
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 bg-${stat.color}-100 dark:bg-${stat.color}-900/20 rounded-lg`}>
                <stat.icon className={`h-6 w-6 text-${stat.color}-600 dark:text-${stat.color}-400`} />
              </div>
              <span className={`text-sm font-medium text-${stat.color}-600 dark:text-${stat.color}-400`}>
                {stat.trend}
              </span>
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{stat.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{stat.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  const renderPluginCard = (plugin: PluginQualityScore) => {
    const CategoryIcon = getCategoryIcon(plugin.category);
    
    return (
      <motion.div
        key={plugin.id}
        whileHover={{ scale: 1.02 }}
        onClick={() => setSelectedPlugin(plugin)}
        className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 cursor-pointer transition-all"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{plugin.name}</h3>
              <p className="text-sm text-gray-500">v{plugin.version}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getGradeColor(plugin.grade)}`}>
              Grade {plugin.grade}
            </span>
            <CategoryIcon className="h-4 w-4 text-gray-400" />
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Quality Score</span>
            <span className={`font-bold text-lg ${getScoreColor(plugin.overallScore)}`}>
              {plugin.overallScore}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                plugin.overallScore >= 90 ? 'bg-green-500' :
                plugin.overallScore >= 80 ? 'bg-yellow-500' :
                plugin.overallScore >= 70 ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ width: `${plugin.overallScore}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">{plugin.issues.critical}</div>
            <div className="text-xs text-gray-500">Critical</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">{plugin.issues.high}</div>
            <div className="text-xs text-gray-500">High</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-600">{plugin.issues.medium}</div>
            <div className="text-xs text-gray-500">Medium</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-600">{plugin.issues.low}</div>
            <div className="text-xs text-gray-500">Low</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Last evaluated: {new Date(plugin.lastEvaluated).toLocaleDateString()}</span>
          <div className="flex items-center gap-1">
            {plugin.trending === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
            {plugin.trending === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
            {plugin.trending === 'stable' && <Activity className="h-4 w-4 text-gray-400" />}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderDetailModal = () => {
    if (!selectedPlugin) return null;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={() => setSelectedPlugin(null)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-4xl w-full max-h-[90vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedPlugin.name}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Quality Assessment Report
                </p>
              </div>
              <button
                onClick={() => setSelectedPlugin(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <XCircle className="h-6 w-6 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Metrics Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {selectedPlugin.metrics.map((metric) => (
                <div key={metric.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {metric.name}
                    </h3>
                    <span className={`font-bold ${getScoreColor(metric.score)}`}>
                      {metric.score}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    {metric.checks.map((check) => (
                      <div key={check.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {check.status === 'pass' && <CheckCircle className="h-4 w-4 text-green-500" />}
                          {check.status === 'fail' && <XCircle className="h-4 w-4 text-red-500" />}
                          {check.status === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {check.name}
                          </span>
                          {check.automatedFix && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                              Auto-fix
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{check.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Recommendations */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                Recommendations
              </h3>
              <ul className="space-y-2">
                {selectedPlugin.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-200">
                    <Target className="h-4 w-4 mt-0.5" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Quality Gates Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Soundcheck-style quality assessment for all plugins
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Re-evaluate All
          </button>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </button>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      {renderOverviewCards()}

      {/* Filters and Search */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg"
            >
              <option value="all">All Grades</option>
              <option value="A">Grade A</option>
              <option value="B">Grade B</option>
              <option value="C">Grade C</option>
              <option value="D">Grade D</option>
              <option value="F">Grade F</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg"
            >
              <option value="all">All Categories</option>
              <option value="open-source">Open Source</option>
              <option value="enterprise-premium">Enterprise Premium</option>
              <option value="third-party-verified">Third-party Verified</option>
              <option value="custom-internal">Custom Internal</option>
            </select>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-gray-600 rounded-lg"
            >
              <option value="score">Sort by Score</option>
              <option value="name">Sort by Name</option>
              <option value="lastEvaluated">Sort by Date</option>
            </select>
          </div>
        </div>
      </div>

      {/* Plugin Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPlugins.map(renderPluginCard)}
      </div>

      {/* Empty State */}
      {filteredPlugins.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Package className="h-16 w-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No plugins found
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Try adjusting your filters or search criteria
          </p>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedPlugin && renderDetailModal()}
      </AnimatePresence>
    </div>
  );
}

export { QualityGateDashboard };