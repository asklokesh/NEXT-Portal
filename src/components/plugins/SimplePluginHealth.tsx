'use client';

import React from 'react';
import { Activity, CheckCircle, AlertTriangle, XCircle, Cpu, HardDrive, Zap } from 'lucide-react';

export default function SimplePluginHealth() {
  const healthData = [
    { name: 'Software Catalog', status: 'healthy', score: 98, cpu: 12, memory: 156, uptime: '99.9%' },
    { name: 'TechDocs', status: 'healthy', score: 95, cpu: 8, memory: 98, uptime: '99.7%' },
    { name: 'Kubernetes', status: 'warning', score: 88, cpu: 24, memory: 234, uptime: '99.2%' }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'green';
      case 'warning': return 'yellow';
      case 'critical': return 'red';
      default: return 'gray';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Plugin Health Monitor</h2>
        <p className="text-gray-600 dark:text-gray-400">Monitor the health and performance of your installed plugins</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">2</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Healthy</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">1</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Warnings</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">0</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Critical</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3">
            <Activity className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">94%</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Score</p>
            </div>
          </div>
        </div>
      </div>

      {/* Plugin Health Details */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Plugin Health Status</h3>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            {healthData.map((plugin, index) => (
              <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(plugin.status)}
                    <h4 className="font-semibold text-gray-900 dark:text-white">{plugin.name}</h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full bg-${getStatusColor(plugin.status)}-100 text-${getStatusColor(plugin.status)}-800 dark:bg-${getStatusColor(plugin.status)}-900/20 dark:text-${getStatusColor(plugin.status)}-400`}>
                      {plugin.status}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{plugin.score}%</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Health Score</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-blue-500" />
                    <span className="text-gray-600 dark:text-gray-400">CPU: {plugin.cpu}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-green-500" />
                    <span className="text-gray-600 dark:text-gray-400">Memory: {plugin.memory}MB</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="text-gray-600 dark:text-gray-400">Uptime: {plugin.uptime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-purple-500" />
                    <span className="text-gray-600 dark:text-gray-400">Status: Active</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}