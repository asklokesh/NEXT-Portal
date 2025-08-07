'use client';

import React, { useState, useEffect } from 'react';
import {
  GitBranch, AlertTriangle, CheckCircle, Info, Package,
  Loader2, Download, AlertCircle, ArrowRight, Clock,
  Shield, Zap, RefreshCw, ExternalLink, Code,
  Search, Filter, X, Plus, Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PluginDependency {
  id: string;
  name: string;
  version: string;
  type: 'peer' | 'dev' | 'runtime' | 'optional';
  required: boolean;
  description?: string;
}

interface DependencyResolution {
  pluginId: string;
  dependencies: PluginDependency[];
  conflicts: Array<{
    plugin: string;
    reason: string;
    severity: 'warning' | 'error';
  }>;
  recommendations: Array<{
    plugin: string;
    reason: string;
    type: 'install' | 'upgrade' | 'downgrade';
  }>;
  installOrder: string[];
  totalSize: number;
}

interface DependencyResolverProps {
  selectedPlugins: string[];
  onPluginAdd?: (pluginId: string) => void;
  onPluginRemove?: (pluginId: string) => void;
  className?: string;
}

export default function DependencyResolver({ 
  selectedPlugins, 
  onPluginAdd, 
  onPluginRemove,
  className = '' 
}: DependencyResolverProps) {
  const [loading, setLoading] = useState(false);
  const [resolutions, setResolutions] = useState<DependencyResolution[]>([]);
  const [globalConflicts, setGlobalConflicts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dependencies' | 'conflicts' | 'recommendations'>('dependencies');

  useEffect(() => {
    if (selectedPlugins.length > 0) {
      resolveDependencies();
    } else {
      setResolutions([]);
      setGlobalConflicts([]);
      setSummary(null);
    }
  }, [selectedPlugins]);

  const resolveDependencies = async () => {
    if (selectedPlugins.length === 0) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        plugins: selectedPlugins.join(','),
        action: 'resolve'
      });
      
      const response = await fetch(`/api/plugin-dependencies?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setResolutions(data.resolutions || []);
        setGlobalConflicts(data.globalConflicts || []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Error resolving dependencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDependencyTypeColor = (type: string) => {
    switch (type) {
      case 'runtime': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'peer': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'dev': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'optional': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getSeverityIcon = (severity: 'warning' | 'error') => {
    return severity === 'error' ? 
      <AlertCircle className="w-4 h-4 text-red-500" /> :
      <AlertTriangle className="w-4 h-4 text-yellow-500" />;
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'install': return <Plus className="w-4 h-4 text-green-500" />;
      case 'upgrade': return <ArrowRight className="w-4 h-4 text-blue-500" />;
      case 'downgrade': return <Minus className="w-4 h-4 text-orange-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  if (selectedPlugins.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="text-center">
          <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Dependency Resolver
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Select plugins to analyze their dependencies and compatibility
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center mb-2">
              <GitBranch className="w-6 h-6 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Dependency Analysis
              </h3>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-blue-600 ml-2" />}
            </div>
            {summary && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {summary.totalPlugins} plugins • {summary.totalDependencies} dependencies
                {summary.totalConflicts > 0 && (
                  <span className="text-red-600 ml-2">
                    • {summary.totalConflicts} conflicts
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={resolveDependencies}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center text-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="flex items-center">
                <Package className="w-5 h-5 text-blue-600 mr-2" />
                <div>
                  <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                    {summary.totalDependencies}
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    Dependencies
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                <div>
                  <div className="text-lg font-semibold text-red-900 dark:text-red-100">
                    {summary.totalConflicts}
                  </div>
                  <div className="text-xs text-red-600 dark:text-red-400">
                    Conflicts
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <div className="flex items-center">
                <Download className="w-5 h-5 text-green-600 mr-2" />
                <div>
                  <div className="text-lg font-semibold text-green-900 dark:text-green-100">
                    {formatSize(summary.estimatedSize)}
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400">
                    Est. Size
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-purple-600 mr-2" />
                <div>
                  <div className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                    ~2m
                  </div>
                  <div className="text-xs text-purple-600 dark:text-purple-400">
                    Install Time
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'dependencies', label: 'Dependencies', icon: Package },
          { id: 'conflicts', label: 'Conflicts', icon: AlertTriangle },
          { id: 'recommendations', label: 'Recommendations', icon: Zap }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* Dependencies Tab */}
        {activeTab === 'dependencies' && (
          <div className="space-y-4">
            {resolutions.map((resolution) => (
              <div
                key={resolution.pluginId}
                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedPlugin(
                    expandedPlugin === resolution.pluginId ? null : resolution.pluginId
                  )}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-center">
                    <Code className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-3" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {resolution.pluginId}
                    </span>
                    <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs">
                      {resolution.dependencies.length} deps
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                      {formatSize(resolution.totalSize)}
                    </span>
                    <motion.div
                      animate={{ rotate: expandedPlugin === resolution.pluginId ? 90 : 0 }}
                      className="text-gray-400"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </motion.div>
                  </div>
                </button>

                <AnimatePresence>
                  {expandedPlugin === resolution.pluginId && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-200 dark:border-gray-700"
                    >
                      <div className="p-4 space-y-3">
                        {resolution.dependencies.map((dep) => (
                          <div
                            key={dep.id}
                            className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-600"
                          >
                            <div className="flex items-center">
                              <Package className="w-4 h-4 text-gray-500 mr-3" />
                              <div>
                                <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                  {dep.name || dep.id}
                                </div>
                                {dep.description && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {dep.description}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${getDependencyTypeColor(dep.type)}`}>
                                {dep.type}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {dep.version}
                              </span>
                              {dep.required && (
                                <span className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 px-1 rounded">
                                  required
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}

        {/* Conflicts Tab */}
        {activeTab === 'conflicts' && (
          <div className="space-y-4">
            {globalConflicts.length === 0 && resolutions.every(r => r.conflicts.length === 0) ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  No Conflicts Found
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  All selected plugins are compatible with each other
                </p>
              </div>
            ) : (
              <>
                {globalConflicts.map((conflict, index) => (
                  <div
                    key={index}
                    className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg"
                  >
                    <div className="flex items-start">
                      {getSeverityIcon(conflict.severity)}
                      <div className="ml-3 flex-1">
                        <h4 className="font-medium text-red-900 dark:text-red-100">
                          Global Conflict
                        </h4>
                        <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                          {conflict.reason}
                        </p>
                        <div className="flex items-center mt-2 space-x-2">
                          {conflict.plugins.map((plugin: string) => (
                            <span
                              key={plugin}
                              className="px-2 py-1 bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 text-xs rounded"
                            >
                              {plugin}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {resolutions.map((resolution) =>
                  resolution.conflicts.map((conflict, index) => (
                    <div
                      key={`${resolution.pluginId}-${index}`}
                      className="p-4 border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
                    >
                      <div className="flex items-start">
                        {getSeverityIcon(conflict.severity)}
                        <div className="ml-3 flex-1">
                          <h4 className="font-medium text-yellow-900 dark:text-yellow-100">
                            Plugin Conflict
                          </h4>
                          <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                            {conflict.reason}
                          </p>
                          <div className="flex items-center mt-2 space-x-2">
                            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 text-xs rounded">
                              {resolution.pluginId}
                            </span>
                            <ArrowRight className="w-4 h-4 text-yellow-600" />
                            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 text-xs rounded">
                              {conflict.plugin}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <div className="space-y-4">
            {resolutions.every(r => r.recommendations.length === 0) ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  No Recommendations
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Your plugin selection looks complete
                </p>
              </div>
            ) : (
              resolutions.map((resolution) =>
                resolution.recommendations.map((recommendation, index) => (
                  <div
                    key={`${resolution.pluginId}-${index}`}
                    className="p-4 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start">
                        {getRecommendationIcon(recommendation.type)}
                        <div className="ml-3 flex-1">
                          <h4 className="font-medium text-blue-900 dark:text-blue-100">
                            {recommendation.type === 'install' ? 'Install' : 
                             recommendation.type === 'upgrade' ? 'Upgrade' : 'Downgrade'}: {recommendation.plugin}
                          </h4>
                          <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
                            {recommendation.reason}
                          </p>
                        </div>
                      </div>
                      {onPluginAdd && recommendation.type === 'install' && (
                        <button
                          onClick={() => onPluginAdd(recommendation.plugin)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          Add Plugin
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}