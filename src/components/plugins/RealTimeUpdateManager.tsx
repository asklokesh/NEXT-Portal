'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap, Activity, Webhook, GitBranch, RefreshCw, CheckCircle,
  XCircle, AlertTriangle, Clock, Settings, Plus, Trash2,
  Eye, EyeOff, Play, Pause, RotateCw, Globe, Shield,
  Package, Users, Database, Server, Code, FileText,
  Bell, BellOff, Volume2, VolumeX, Filter, Search,
  ArrowRight, ExternalLink, Copy, Download, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  lastTriggered?: string;
  successRate: number;
  totalRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  headers: Record<string, string>;
  retryPolicy: {
    maxRetries: number;
    backoffStrategy: 'linear' | 'exponential';
    initialDelay: number;
  };
}

interface LiveUpdate {
  id: string;
  type: 'plugin-update' | 'security-alert' | 'health-check' | 'deployment' | 'configuration';
  title: string;
  message: string;
  source: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  data?: any;
  acknowledged: boolean;
}

interface RealtimeConnection {
  id: string;
  name: string;
  type: 'websocket' | 'sse' | 'polling';
  url: string;
  status: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  lastActivity: string;
  messageCount: number;
  enabled: boolean;
  config: {
    reconnectAttempts: number;
    heartbeatInterval: number;
    timeout: number;
  };
}

const MOCK_WEBHOOKS: WebhookEndpoint[] = [
  {
    id: 'github-updates',
    name: 'GitHub Plugin Updates',
    url: 'https://api.example.com/webhooks/github',
    events: ['plugin.updated', 'security.vulnerability', 'release.published'],
    secret: '••••••••••••••••',
    active: true,
    lastTriggered: '2024-01-13T10:30:00Z',
    successRate: 98.5,
    totalRequests: 1247,
    failedRequests: 19,
    averageResponseTime: 142,
    headers: {
      'X-API-Key': '••••••••••••••••',
      'Content-Type': 'application/json'
    },
    retryPolicy: {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      initialDelay: 1000
    }
  },
  {
    id: 'npm-registry',
    name: 'NPM Registry Updates',
    url: 'https://api.example.com/webhooks/npm',
    events: ['package.updated', 'package.published', 'security.advisory'],
    active: true,
    lastTriggered: '2024-01-13T09:15:00Z',
    successRate: 99.2,
    totalRequests: 892,
    failedRequests: 7,
    averageResponseTime: 89,
    headers: {
      'Authorization': 'Bearer ••••••••••••••••'
    },
    retryPolicy: {
      maxRetries: 2,
      backoffStrategy: 'linear',
      initialDelay: 500
    }
  }
];

const MOCK_LIVE_UPDATES: LiveUpdate[] = [
  {
    id: '1',
    type: 'plugin-update',
    title: '@backstage/plugin-catalog updated',
    message: 'New version 1.15.1 available with security fixes',
    source: 'NPM Registry',
    timestamp: '2024-01-13T10:35:00Z',
    severity: 'info',
    acknowledged: false
  },
  {
    id: '2',
    type: 'security-alert',
    title: 'Critical vulnerability detected',
    message: 'CVE-2024-0001 found in @backstage/plugin-kubernetes',
    source: 'Security Scanner',
    timestamp: '2024-01-13T10:32:00Z',
    severity: 'error',
    acknowledged: false
  },
  {
    id: '3',
    type: 'deployment',
    title: 'Plugin deployment completed',
    message: 'TechDocs plugin successfully deployed to production',
    source: 'CI/CD Pipeline',
    timestamp: '2024-01-13T10:28:00Z',
    severity: 'success',
    acknowledged: true
  }
];

const MOCK_CONNECTIONS: RealtimeConnection[] = [
  {
    id: 'main-websocket',
    name: 'Main WebSocket Connection',
    type: 'websocket',
    url: 'wss://api.example.com/ws/plugins',
    status: 'connected',
    lastActivity: '2024-01-13T10:36:00Z',
    messageCount: 2847,
    enabled: true,
    config: {
      reconnectAttempts: 5,
      heartbeatInterval: 30000,
      timeout: 60000
    }
  },
  {
    id: 'github-sse',
    name: 'GitHub Server-Sent Events',
    type: 'sse',
    url: 'https://api.github.com/events/plugins',
    status: 'connected',
    lastActivity: '2024-01-13T10:35:00Z',
    messageCount: 156,
    enabled: true,
    config: {
      reconnectAttempts: 3,
      heartbeatInterval: 60000,
      timeout: 120000
    }
  }
];

export default function RealTimeUpdateManager() {
  const [activeTab, setActiveTab] = useState<'live-updates' | 'webhooks' | 'connections'>('live-updates');
  const [liveUpdates, setLiveUpdates] = useState<LiveUpdate[]>(MOCK_LIVE_UPDATES);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>(MOCK_WEBHOOKS);
  const [connections, setConnections] = useState<RealtimeConnection[]>(MOCK_CONNECTIONS);
  const [notifications, setNotifications] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookEndpoint | null>(null);
  const [showWebhookModal, setShowWebhookModal] = useState(false);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate new updates
      if (Math.random() < 0.3) { // 30% chance every 5 seconds
        const newUpdate: LiveUpdate = {
          id: Date.now().toString(),
          type: ['plugin-update', 'security-alert', 'health-check', 'deployment', 'configuration'][Math.floor(Math.random() * 5)] as any,
          title: 'New update received',
          message: 'Real-time update simulation',
          source: 'System',
          timestamp: new Date().toISOString(),
          severity: ['info', 'warning', 'error', 'success'][Math.floor(Math.random() * 4)] as any,
          acknowledged: false
        };
        setLiveUpdates(prev => [newUpdate, ...prev.slice(0, 49)]); // Keep only last 50 updates
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const acknowledgeUpdate = useCallback((id: string) => {
    setLiveUpdates(prev =>
      prev.map(update =>
        update.id === id ? { ...update, acknowledged: true } : update
      )
    );
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-red-600 bg-red-100 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'success': return 'text-green-600 bg-green-100 border-green-200';
      default: return 'text-blue-600 bg-blue-100 border-blue-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return XCircle;
      case 'warning': return AlertTriangle;
      case 'success': return CheckCircle;
      default: return Info;
    }
  };

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600 bg-green-100';
      case 'disconnected': return 'text-red-600 bg-red-100';
      case 'reconnecting': return 'text-yellow-600 bg-yellow-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const renderLiveUpdates = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Updates</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setNotifications(!notifications)}
            className={`px-3 py-2 rounded-lg flex items-center gap-2 ${
              notifications ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {notifications ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            Notifications
          </button>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="all">All Severities</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="success">Success</option>
            <option value="info">Info</option>
          </select>
        </div>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {liveUpdates
          .filter(update => filterSeverity === 'all' || update.severity === filterSeverity)
          .map((update) => {
            const SeverityIcon = getSeverityIcon(update.severity);
            return (
              <motion.div
                key={update.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 border rounded-lg ${getSeverityColor(update.severity)} ${
                  update.acknowledged ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <SeverityIcon className="h-5 w-5 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{update.title}</div>
                      <div className="text-sm text-gray-600 mt-1">{update.message}</div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                        <span>{update.source}</span>
                        <span>{new Date(update.timestamp).toLocaleString()}</span>
                        <span className={`px-2 py-1 rounded-full ${getSeverityColor(update.severity)}`}>
                          {update.type.replace('-', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!update.acknowledged && (
                    <button
                      onClick={() => acknowledgeUpdate(update.id)}
                      className="px-3 py-1 text-sm bg-white bg-opacity-50 hover:bg-opacity-75 rounded border"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
      </div>
    </div>
  );

  const renderWebhooks = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Webhook Endpoints</h3>
        <button
          onClick={() => setShowWebhookModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Webhook
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {webhooks.map((webhook) => (
          <div
            key={webhook.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Webhook className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-gray-900 dark:text-white">{webhook.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${webhook.active ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className={`text-sm ${webhook.active ? 'text-green-600' : 'text-red-600'}`}>
                  {webhook.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center justify-between">
                <span>URL:</span>
                <span className="font-mono text-xs">{webhook.url}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Success Rate:</span>
                <span className="font-medium text-green-600">{webhook.successRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Avg Response:</span>
                <span>{webhook.averageResponseTime}ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total Requests:</span>
                <span>{webhook.totalRequests.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-1 mb-2">
                {webhook.events.slice(0, 3).map((event) => (
                  <span key={event} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {event}
                  </span>
                ))}
                {webhook.events.length > 3 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                    +{webhook.events.length - 3} more
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Last triggered: {webhook.lastTriggered ? new Date(webhook.lastTriggered).toLocaleString() : 'Never'}
                </span>
                <button
                  onClick={() => setSelectedWebhook(webhook)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderConnections = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Real-time Connections</h3>
        <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh All
        </button>
      </div>

      <div className="space-y-3">
        {connections.map((connection) => (
          <div
            key={connection.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {connection.type === 'websocket' && <Zap className="h-5 w-5 text-purple-600" />}
                  {connection.type === 'sse' && <Activity className="h-5 w-5 text-green-600" />}
                  {connection.type === 'polling' && <RefreshCw className="h-5 w-5 text-blue-600" />}
                  <span className="font-medium text-gray-900 dark:text-white">{connection.name}</span>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConnectionStatusColor(connection.status)}`}>
                  {connection.status}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button className={`p-1 rounded ${connection.enabled ? 'text-green-600 hover:bg-green-100' : 'text-gray-400'}`}>
                  {connection.enabled ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
                <button className="p-1 text-gray-600 hover:bg-gray-100 rounded">
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Type:</span>
                <div className="font-medium text-gray-900 dark:text-white uppercase">{connection.type}</div>
              </div>
              <div>
                <span className="text-gray-500">Messages:</span>
                <div className="font-medium text-gray-900 dark:text-white">{connection.messageCount.toLocaleString()}</div>
              </div>
              <div>
                <span className="text-gray-500">Last Activity:</span>
                <div className="font-medium text-gray-900 dark:text-white">
                  {new Date(connection.lastActivity).toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-gray-500">Reconnects:</span>
                <div className="font-medium text-gray-900 dark:text-white">{connection.config.reconnectAttempts}</div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs font-mono text-gray-500 break-all">{connection.url}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Real-time Update Manager
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor live plugin updates, webhooks, and real-time connections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Active Webhooks',
            value: webhooks.filter(w => w.active).length.toString(),
            total: webhooks.length,
            icon: Webhook,
            color: 'blue'
          },
          {
            label: 'Live Connections',
            value: connections.filter(c => c.status === 'connected').length.toString(),
            total: connections.length,
            icon: Zap,
            color: 'green'
          },
          {
            label: 'Unacknowledged',
            value: liveUpdates.filter(u => !u.acknowledged).length.toString(),
            total: liveUpdates.length,
            icon: Bell,
            color: 'red'
          },
          {
            label: 'Messages Today',
            value: connections.reduce((sum, c) => sum + c.messageCount, 0).toLocaleString(),
            total: null,
            icon: Activity,
            color: 'purple'
          }
        ].map((stat, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stat.value}{stat.total && `/${stat.total}`}
                </p>
              </div>
              <div className={`p-3 bg-${stat.color}-100 dark:bg-${stat.color}-900/20 rounded-lg`}>
                <stat.icon className={`h-6 w-6 text-${stat.color}-600 dark:text-${stat.color}-400`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'live-updates', label: 'Live Updates', icon: Activity },
            { id: 'webhooks', label: 'Webhooks', icon: Webhook },
            { id: 'connections', label: 'Connections', icon: Zap }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {activeTab === 'live-updates' && renderLiveUpdates()}
            {activeTab === 'webhooks' && renderWebhooks()}
            {activeTab === 'connections' && renderConnections()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export { RealTimeUpdateManager };