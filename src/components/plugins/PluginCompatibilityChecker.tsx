'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield, CheckCircle, AlertTriangle, XCircle, Info,
  Monitor, Cpu, MemoryStick, HardDrive, Settings,
  RefreshCw, Download, Filter, Search, AlertCircle,
  Package, Zap, Code, TrendingUp, Layers, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CompatibilityRequirement {
  name: string;
  version: string;
  required: boolean;
  current?: string;
  compatible: boolean;
  severity: 'error' | 'warning' | 'info';
  message?: string;
}

interface PluginCompatibility {
  pluginId: string;
  pluginName: string;
  version: string;
  overallCompatibility: 'compatible' | 'warning' | 'incompatible';
  compatibilityScore: number;
  requirements: {
    backstage: CompatibilityRequirement;
    node: CompatibilityRequirement;
    react: CompatibilityRequirement;
    typescript?: CompatibilityRequirement;
  };
  peerDependencies: CompatibilityRequirement[];
  conflicts: {
    pluginId: string;
    pluginName: string;
    reason: string;
    severity: 'error' | 'warning';
    workaround?: string;
  }[];
  recommendations: {
    action: 'upgrade' | 'downgrade' | 'install' | 'uninstall' | 'configure';
    target: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  runtimeRequirements: {
    memory: {
      minimum: number;
      recommended: number;
      current?: number;
      compatible: boolean;
    };
    cpu: {
      minimum: number;
      recommended: number;
      current?: number;
      compatible: boolean;
    };
    disk: {
      minimum: number;
      recommended: number;
      current?: number;
      compatible: boolean;
    };
  };
  platformSupport: {
    os: string[];
    architecture: string[];
    containers: boolean;
    kubernetes: boolean;
  };
}

interface SystemInfo {
  backstageVersion: string;
  nodeVersion: string;
  reactVersion: string;
  typescriptVersion: string;
  platform: {
    os: string;
    architecture: string;
    memory: number;
    cpu: number;
    disk: number;
  };
  installedPlugins: string[];
}

interface PluginCompatibilityCheckerProps {
  selectedPlugins?: string[];
  onCompatibilityChange?: (compatibility: any) => void;
  className?: string;
}

export default function PluginCompatibilityChecker({ 
  selectedPlugins = [], 
  onCompatibilityChange,
  className = '' 
}: PluginCompatibilityCheckerProps) {
  const [loading, setLoading] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [compatibilityResults, setCompatibilityResults] = useState<PluginCompatibility[]>([]);
  const [globalConflicts, setGlobalConflicts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'requirements' | 'conflicts' | 'system'>('overview');

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  useEffect(() => {
    if (selectedPlugins.length > 0 && systemInfo) {
      checkCompatibility();
    } else {
      setCompatibilityResults([]);
      setGlobalConflicts([]);
      setSummary(null);
    }
  }, [selectedPlugins, systemInfo]);

  const fetchSystemInfo = async () => {
    try {
      const response = await fetch('/api/plugin-compatibility?action=system-info');
      const data = await response.json();
      
      if (data.success) {
        setSystemInfo(data.systemInfo);
      }
    } catch (error) {
      console.error('Error fetching system info:', error);
    }
  };

  const checkCompatibility = async () => {
    if (selectedPlugins.length === 0) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        plugins: selectedPlugins.join(','),
        action: 'check'
      });
      
      const response = await fetch(`/api/plugin-compatibility?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setCompatibilityResults(data.compatibilityResults);
        setGlobalConflicts(data.globalConflicts);
        setSummary(data.summary);
        
        if (onCompatibilityChange) {
          onCompatibilityChange(data);
        }
      }
    } catch (error) {
      console.error('Error checking compatibility:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCompatibilityIcon = (compatibility: string) => {
    switch (compatibility) {
      case 'compatible': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'incompatible': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getRequirementIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info': return <CheckCircle className="w-4 h-4 text-green-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const formatBytes = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
  };

  if (selectedPlugins.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}>
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Plugin Compatibility Checker
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Select plugins to analyze their compatibility with your system
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center mb-2">
              <Shield className="w-8 h-8 mr-3" />
              <h1 className="text-3xl font-bold">Compatibility Checker</h1>
              {loading && <RefreshCw className="w-6 h-6 animate-spin ml-3" />}
            </div>
            <p className="text-xl text-indigo-100">
              Ensuring plugin compatibility with your Backstage environment
            </p>
          </div>
          <button
            onClick={checkCompatibility}
            disabled={loading}
            className="px-4 py-2 bg-white text-indigo-600 rounded-lg hover:bg-indigo-50 flex items-center transition-colors"
          >
            <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Recheck
          </button>
        </div>
        
        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{summary.compatiblePlugins}</div>
                  <div className="text-sm text-indigo-100">Compatible</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{summary.warningPlugins}</div>
                  <div className="text-sm text-indigo-100">Warnings</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <XCircle className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{summary.incompatiblePlugins}</div>
                  <div className="text-sm text-indigo-100">Incompatible</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <TrendingUp className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{Math.round(summary.averageScore)}%</div>
                  <div className="text-sm text-indigo-100">Avg Score</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'requirements', label: 'Requirements', icon: Package },
            { id: 'conflicts', label: 'Conflicts', icon: AlertTriangle },
            { id: 'system', label: 'System Info', icon: Monitor }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {compatibilityResults.map((plugin) => (
                <div
                  key={plugin.pluginId}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedPlugin(
                      expandedPlugin === plugin.pluginId ? null : plugin.pluginId
                    )}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center">
                      {getCompatibilityIcon(plugin.overallCompatibility)}
                      <span className="font-medium text-gray-900 dark:text-gray-100 ml-3">
                        {plugin.pluginName}
                      </span>
                      <span className="ml-2 px-2 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 rounded text-xs">
                        {plugin.compatibilityScore}% compatible
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        plugin.overallCompatibility === 'compatible' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : plugin.overallCompatibility === 'warning'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {plugin.overallCompatibility}
                      </span>
                    </div>
                  </button>

                  <AnimatePresence>
                    {expandedPlugin === plugin.pluginId && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-200 dark:border-gray-700"
                      >
                        <div className="p-4 space-y-4">
                          {/* Core Requirements */}
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                              Core Requirements
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {Object.entries(plugin.requirements).map(([key, req]) => {
                                if (!req) return null;
                                return (
                                  <div
                                    key={key}
                                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-600"
                                  >
                                    <div className="flex items-center">
                                      {getRequirementIcon(req.severity)}
                                      <div className="ml-3">
                                        <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                                          {req.name}
                                        </div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                          Required: {req.version}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {req.current}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Recommendations */}
                          {plugin.recommendations.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                                Recommendations
                              </h4>
                              <div className="space-y-2">
                                {plugin.recommendations.map((rec, index) => (
                                  <div
                                    key={index}
                                    className="flex items-start p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded"
                                  >
                                    <Info className="w-4 h-4 text-blue-600 mr-2 mt-0.5" />
                                    <div className="flex-1">
                                      <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                        {rec.action.charAt(0).toUpperCase() + rec.action.slice(1)} {rec.target}
                                      </div>
                                      <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                        {rec.reason}
                                      </div>
                                    </div>
                                    <span className={`px-2 py-1 text-xs font-medium rounded ${getPriorityColor(rec.priority)}`}>
                                      {rec.priority}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}

          {/* Requirements Tab */}
          {activeTab === 'requirements' && (
            <div className="space-y-6">
              {compatibilityResults.map((plugin) => (
                <div key={plugin.pluginId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    {plugin.pluginName}
                  </h3>
                  
                  {/* Runtime Requirements */}
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                      Runtime Requirements
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="flex items-center mb-2">
                          <MemoryStick className="w-5 h-5 text-blue-600 mr-2" />
                          <span className="font-medium">Memory</span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <div>Min: {formatBytes(plugin.runtimeRequirements.memory.minimum)}</div>
                          <div>Rec: {formatBytes(plugin.runtimeRequirements.memory.recommended)}</div>
                          <div>Available: {formatBytes(plugin.runtimeRequirements.memory.current || 0)}</div>
                        </div>
                        <div className={`mt-2 text-xs font-medium ${
                          plugin.runtimeRequirements.memory.compatible 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {plugin.runtimeRequirements.memory.compatible ? 'Compatible' : 'Insufficient'}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="flex items-center mb-2">
                          <Cpu className="w-5 h-5 text-orange-600 mr-2" />
                          <span className="font-medium">CPU</span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <div>Min: {plugin.runtimeRequirements.cpu.minimum} cores</div>
                          <div>Rec: {plugin.runtimeRequirements.cpu.recommended} cores</div>
                          <div>Available: {plugin.runtimeRequirements.cpu.current || 0} cores</div>
                        </div>
                        <div className={`mt-2 text-xs font-medium ${
                          plugin.runtimeRequirements.cpu.compatible 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {plugin.runtimeRequirements.cpu.compatible ? 'Compatible' : 'Insufficient'}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="flex items-center mb-2">
                          <HardDrive className="w-5 h-5 text-green-600 mr-2" />
                          <span className="font-medium">Disk</span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <div>Min: {formatBytes(plugin.runtimeRequirements.disk.minimum)}</div>
                          <div>Rec: {formatBytes(plugin.runtimeRequirements.disk.recommended)}</div>
                          <div>Available: {formatBytes(plugin.runtimeRequirements.disk.current || 0)}</div>
                        </div>
                        <div className={`mt-2 text-xs font-medium ${
                          plugin.runtimeRequirements.disk.compatible 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {plugin.runtimeRequirements.disk.compatible ? 'Compatible' : 'Insufficient'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Platform Support */}
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                      Platform Support
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">OS Support</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {plugin.platformSupport.os.map((os) => (
                            <span key={os} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                              {os}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Architecture</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {plugin.platformSupport.architecture.map((arch) => (
                            <span key={arch} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                              {arch}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Containers</span>
                        <div className={`mt-1 text-sm ${plugin.platformSupport.containers ? 'text-green-600' : 'text-red-600'}`}>
                          {plugin.platformSupport.containers ? 'Supported' : 'Not Supported'}
                        </div>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Kubernetes</span>
                        <div className={`mt-1 text-sm ${plugin.platformSupport.kubernetes ? 'text-green-600' : 'text-red-600'}`}>
                          {plugin.platformSupport.kubernetes ? 'Supported' : 'Not Supported'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Conflicts Tab */}
          {activeTab === 'conflicts' && (
            <div className="space-y-4">
              {globalConflicts.length === 0 && compatibilityResults.every(r => r.conflicts.length === 0) ? (
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
                        <XCircle className="w-5 h-5 text-red-500 mr-3 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-medium text-red-900 dark:text-red-100">
                            Plugin Conflict
                          </h4>
                          <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                            {conflict.reason}
                          </p>
                          <div className="flex items-center mt-2 space-x-2">
                            {conflict.plugins.map((pluginId: string) => (
                              <span
                                key={pluginId}
                                className="px-2 py-1 bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 text-xs rounded"
                              >
                                {pluginId}
                              </span>
                            ))}
                          </div>
                          {conflict.workaround && (
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                              <div className="text-xs font-medium text-blue-900 dark:text-blue-100">
                                Workaround:
                              </div>
                              <div className="text-xs text-blue-700 dark:text-blue-300">
                                {conflict.workaround}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* System Info Tab */}
          {activeTab === 'system' && systemInfo && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Software Versions
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Backstage</span>
                      <span className="font-medium">{systemInfo.backstageVersion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Node.js</span>
                      <span className="font-medium">{systemInfo.nodeVersion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">React</span>
                      <span className="font-medium">{systemInfo.reactVersion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">TypeScript</span>
                      <span className="font-medium">{systemInfo.typescriptVersion}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    System Resources
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Memory</span>
                      <span className="font-medium">{formatBytes(systemInfo.platform.memory)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">CPU Cores</span>
                      <span className="font-medium">{systemInfo.platform.cpu}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Disk Space</span>
                      <span className="font-medium">{formatBytes(systemInfo.platform.disk)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">OS</span>
                      <span className="font-medium">{systemInfo.platform.os}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Architecture</span>
                      <span className="font-medium">{systemInfo.platform.architecture}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Installed Plugins ({systemInfo.installedPlugins.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {systemInfo.installedPlugins.map((pluginId) => (
                    <div
                      key={pluginId}
                      className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-sm"
                    >
                      {pluginId}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}