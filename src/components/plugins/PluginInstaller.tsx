'use client';

import React, { useState, useEffect } from 'react';
import {
  Play, Square, Trash2, ExternalLink, Terminal, Package,
  Container, Cloud, Monitor, CheckCircle, XCircle, Clock,
  AlertTriangle, RefreshCw, Download, Settings, Eye,
  Cpu, MemoryStick, HardDrive, Network, Globe, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PluginInstallStatus {
  pluginId: string;
  status: 'pending' | 'installing' | 'building' | 'deploying' | 'running' | 'failed' | 'stopped';
  containerId?: string;
  namespace?: string;
  serviceUrl?: string;
  healthCheckUrl?: string;
  logs: string[];
  error?: string;
  startedAt: string;
  completedAt?: string;
  resources: {
    cpu: string;
    memory: string;
    storage: string;
  };
}

interface PluginInstallerProps {
  pluginId: string;
  pluginName: string;
  version?: string;
  onInstallComplete?: (status: PluginInstallStatus) => void;
  onInstallFailed?: (error: string) => void;
  className?: string;
}

export default function PluginInstaller({
  pluginId,
  pluginName,
  version = 'latest',
  onInstallComplete,
  onInstallFailed,
  className = ''
}: PluginInstallerProps) {
  const [installing, setInstalling] = useState(false);
  const [environment, setEnvironment] = useState<'local' | 'kubernetes'>('local');
  const [namespace, setNamespace] = useState('');
  const [installId, setInstallId] = useState<string | null>(null);
  const [status, setStatus] = useState<PluginInstallStatus | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [config, setConfig] = useState<Record<string, any>>({});

  useEffect(() => {
    if (installId) {
      const interval = setInterval(pollInstallStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [installId]);

  const pollInstallStatus = async () => {
    if (!installId) return;

    try {
      const response = await fetch(`/api/plugin-installer?installId=${installId}`);
      const data = await response.json();

      if (data.success) {
        setStatus(data);
        
        if (data.status === 'running') {
          setInstalling(false);
          if (onInstallComplete) {
            onInstallComplete(data);
          }
        } else if (data.status === 'failed') {
          setInstalling(false);
          if (onInstallFailed) {
            onInstallFailed(data.error || 'Installation failed');
          }
        }
      }
    } catch (error) {
      console.error('Error polling install status:', error);
    }
  };

  const startInstallation = async () => {
    setInstalling(true);
    setStatus(null);
    setInstallId(null);

    try {
      const response = await fetch('/api/plugin-installer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pluginId,
          version,
          environment,
          namespace: environment === 'kubernetes' ? namespace || undefined : undefined,
          config
        }),
      });

      const data = await response.json();

      if (data.success) {
        setInstallId(data.installId);
      } else {
        setInstalling(false);
        if (onInstallFailed) {
          onInstallFailed(data.error || 'Failed to start installation');
        }
      }
    } catch (error) {
      setInstalling(false);
      const errorMessage = error instanceof Error ? error.message : 'Installation failed';
      if (onInstallFailed) {
        onInstallFailed(errorMessage);
      }
    }
  };

  const stopInstallation = async () => {
    if (!installId) return;

    try {
      const response = await fetch(`/api/plugin-installer?installId=${installId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setStatus(prev => prev ? { ...prev, status: 'stopped' } : null);
        setInstalling(false);
        setInstallId(null);
      }
    } catch (error) {
      console.error('Error stopping installation:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'installing': return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'building': return <Package className="w-5 h-5 text-orange-500 animate-pulse" />;
      case 'deploying': return <Cloud className="w-5 h-5 text-purple-500 animate-pulse" />;
      case 'running': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'stopped': return <Square className="w-5 h-5 text-gray-500" />;
      default: return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'installing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'building': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'deploying': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'running': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'stopped': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Install {pluginName}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {pluginId}@{version}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {status && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status.status)}`}>
                {getStatusIcon(status.status)}
                <span className="ml-2 capitalize">{status.status}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Configuration */}
      {!status && (
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Environment
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setEnvironment('local')}
                className={`p-4 border-2 rounded-lg transition-colors ${
                  environment === 'local'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <Container className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Local Docker</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Run in local Docker container
                </div>
              </button>
              <button
                onClick={() => setEnvironment('kubernetes')}
                className={`p-4 border-2 rounded-lg transition-colors ${
                  environment === 'kubernetes'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <Cloud className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Kubernetes</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Deploy to Kubernetes cluster
                </div>
              </button>
            </div>
          </div>

          {environment === 'kubernetes' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Namespace (optional)
              </label>
              <input
                type="text"
                value={namespace}
                onChange={(e) => setNamespace(e.target.value)}
                placeholder={`backstage-plugin-${pluginId.replace(/[@\/]/g, '-').toLowerCase()}`}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Leave empty to auto-generate namespace name
              </p>
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
              Resource Requirements
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center">
                <Cpu className="w-4 h-4 text-blue-500 mr-2" />
                <span className="text-gray-600 dark:text-gray-400">
                  {environment === 'kubernetes' ? '500m CPU' : '1 CPU Core'}
                </span>
              </div>
              <div className="flex items-center">
                <MemoryStick className="w-4 h-4 text-green-500 mr-2" />
                <span className="text-gray-600 dark:text-gray-400">
                  {environment === 'kubernetes' ? '1Gi RAM' : '1GB RAM'}
                </span>
              </div>
              <div className="flex items-center">
                <HardDrive className="w-4 h-4 text-orange-500 mr-2" />
                <span className="text-gray-600 dark:text-gray-400">2GB Storage</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={startInstallation}
              disabled={installing}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <Play className="w-5 h-5 mr-2" />
              {installing ? 'Starting...' : 'Install Plugin'}
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p>This will:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Download and build the plugin from NPM</li>
              <li>Create a containerized Backstage instance</li>
              <li>
                {environment === 'kubernetes' 
                  ? 'Deploy to your Kubernetes cluster with isolated namespace'
                  : 'Run locally in Docker with port forwarding'
                }
              </li>
              <li>Provide health monitoring and management interface</li>
            </ul>
          </div>
        </div>
      )}

      {/* Installation Status */}
      {status && (
        <div className="p-6">
          <div className="space-y-4">
            {/* Status Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
                  {getStatusIcon(status.status)}
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">
                  {status.status}
                </div>
                {status.error && (
                  <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {status.error}
                  </div>
                )}
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Environment</span>
                  {environment === 'kubernetes' ? (
                    <Cloud className="w-5 h-5 text-purple-500" />
                  ) : (
                    <Container className="w-5 h-5 text-blue-500" />
                  )}
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {environment === 'kubernetes' ? 'Kubernetes' : 'Docker'}
                </div>
                {status.namespace && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Namespace: {status.namespace}
                  </div>
                )}
              </div>
            </div>

            {/* Resource Usage */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                Resource Allocation
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <Cpu className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {status.resources.cpu}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">CPU</div>
                </div>
                <div className="text-center">
                  <MemoryStick className="w-6 h-6 text-green-500 mx-auto mb-1" />
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {status.resources.memory}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Memory</div>
                </div>
                <div className="text-center">
                  <HardDrive className="w-6 h-6 text-orange-500 mx-auto mb-1" />
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {status.resources.storage}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Storage</div>
                </div>
              </div>
            </div>

            {/* Service URLs */}
            {status.serviceUrl && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-green-900 dark:text-green-100">
                      Plugin Running
                    </h4>
                    <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                      <div className="flex items-center">
                        <Globe className="w-4 h-4 mr-2" />
                        <span>Service: {status.serviceUrl}</span>
                      </div>
                      {status.healthCheckUrl && (
                        <div className="flex items-center mt-1">
                          <Monitor className="w-4 h-4 mr-2" />
                          <span>Health: {status.healthCheckUrl}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <a
                    href={status.serviceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 flex items-center"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Open
                  </a>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {status.status === 'running' && (
                <button
                  onClick={stopInstallation}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Plugin
                </button>
              )}
              
              {(status.status === 'failed' || status.status === 'stopped') && (
                <button
                  onClick={startInstallation}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry Installation
                </button>
              )}
              
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
              >
                <Terminal className="w-4 h-4 mr-2" />
                {showLogs ? 'Hide' : 'Show'} Logs
              </button>
            </div>

            {/* Installation Logs */}
            <AnimatePresence>
              {showLogs && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-black rounded-lg p-4 font-mono text-sm text-green-400 overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-semibold">Installation Logs</span>
                    <button
                      onClick={() => setShowLogs(false)}
                      className="text-gray-400 hover:text-white"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {status.logs.map((log, index) => (
                      <div key={index} className="mb-1">
                        <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span>{' '}
                        {log}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Timing Info */}
            <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3">
              <div className="flex justify-between">
                <span>Started: {new Date(status.startedAt).toLocaleString()}</span>
                {status.completedAt && (
                  <span>Completed: {new Date(status.completedAt).toLocaleString()}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}