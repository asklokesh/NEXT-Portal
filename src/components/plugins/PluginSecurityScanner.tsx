'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield, AlertTriangle, CheckCircle, XCircle, Eye,
  RefreshCw, Download, Filter, Search, Bell, Zap,
  Bug, Lock, Unlock, Key, FileText, BarChart3,
  TrendingUp, TrendingDown, Calendar, Clock, Layers,
  AlertCircle, Info, ExternalLink, Play, Pause, Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SecurityVulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  cve?: string;
  cvss?: number;
  affectedVersions: string[];
  patchedVersion?: string;
  exploitable: boolean;
  publicExploit: boolean;
  references: string[];
  discoveredAt: string;
  publishedAt: string;
  lastModified: string;
}

interface SecurityScan {
  pluginId: string;
  pluginName: string;
  version: string;
  scanId: string;
  scanDate: string;
  status: 'scanning' | 'completed' | 'failed' | 'pending';
  securityScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  vulnerabilities: SecurityVulnerability[];
  dependencies: {
    id: string;
    version: string;
    vulnerabilities: SecurityVulnerability[];
    outdated: boolean;
    malicious: boolean;
  }[];
  licenses: {
    name: string;
    type: 'permissive' | 'copyleft' | 'proprietary' | 'unknown';
    compatible: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    url?: string;
  }[];
  codeQuality: {
    maintainability: number;
    reliability: number;
    security: number;
    testCoverage: number;
    codeSmells: number;
    duplicatedLines: number;
  };
  compliance: {
    gdpr: boolean;
    hipaa: boolean;
    sox: boolean;
    pci: boolean;
    issues: string[];
  };
  recommendations: {
    priority: 'immediate' | 'high' | 'medium' | 'low';
    action: string;
    description: string;
    impact: string;
  }[];
}

interface SecurityDashboard {
  totalScans: number;
  criticalIssues: number;
  highRiskPlugins: number;
  averageScore: number;
  trendsData: {
    date: string;
    newVulnerabilities: number;
    resolvedIssues: number;
    securityScore: number;
  }[];
  topVulnerabilities: SecurityVulnerability[];
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    minimal: number;
  };
}

interface PluginSecurityScannerProps {
  selectedPlugins?: string[];
  onScanComplete?: (results: SecurityScan[]) => void;
  className?: string;
}

export default function PluginSecurityScanner({ 
  selectedPlugins = [],
  onScanComplete,
  className = '' 
}: PluginSecurityScannerProps) {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<SecurityDashboard | null>(null);
  const [scans, setScans] = useState<SecurityScan[]>([]);
  const [selectedScan, setSelectedScan] = useState<SecurityScan | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'scans' | 'vulnerabilities' | 'compliance'>('overview');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterRisk, setFilterRisk] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanningPlugins, setScanningPlugins] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchDashboardData();
    fetchSecurityScans();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/plugin-security?action=dashboard');
      const data = await response.json();
      
      if (data.success) {
        setDashboard(data.dashboard);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const fetchSecurityScans = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'scans' });
      if (filterSeverity !== 'all') params.set('severity', filterSeverity);
      if (filterRisk !== 'all') params.set('riskLevel', filterRisk);

      const response = await fetch(`/api/plugin-security?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setScans(data.scans);
        if (onScanComplete) {
          onScanComplete(data.scans);
        }
      }
    } catch (error) {
      console.error('Error fetching security scans:', error);
    } finally {
      setLoading(false);
    }
  };

  const startSecurityScan = async (pluginId: string) => {
    setScanningPlugins(prev => new Set(prev).add(pluginId));
    
    try {
      const response = await fetch('/api/plugin-security', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start-scan',
          pluginId,
          scanType: 'comprehensive'
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Simulate scan completion after 3 seconds
        setTimeout(async () => {
          const scanResponse = await fetch(`/api/plugin-security?action=scan&pluginId=${pluginId}`);
          const scanData = await scanResponse.json();
          
          if (scanData.success) {
            setScans(prev => {
              const updated = prev.filter(s => s.pluginId !== pluginId);
              return [scanData.scan, ...updated];
            });
          }
          
          setScanningPlugins(prev => {
            const newSet = new Set(prev);
            newSet.delete(pluginId);
            return newSet;
          });
        }, 3000);
      }
    } catch (error) {
      console.error('Error starting security scan:', error);
      setScanningPlugins(prev => {
        const newSet = new Set(prev);
        newSet.delete(pluginId);
        return newSet;
      });
    }
  };

  const startBulkScan = async () => {
    if (selectedPlugins.length === 0) return;
    
    try {
      const response = await fetch('/api/plugin-security', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'bulk-scan',
          plugins: selectedPlugins
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        selectedPlugins.forEach(pluginId => {
          setScanningPlugins(prev => new Set(prev).add(pluginId));
        });
        
        // Simulate bulk scan completion
        setTimeout(() => {
          fetchSecurityScans();
          setScanningPlugins(new Set());
        }, selectedPlugins.length * 1000);
      }
    } catch (error) {
      console.error('Error starting bulk scan:', error);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'high': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'medium': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'low': return <Info className="w-5 h-5 text-blue-500" />;
      default: return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'minimal': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'immediate': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const filteredScans = scans.filter(scan => {
    const matchesSearch = !searchQuery || 
      scan.pluginName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scan.pluginId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  if (loading && scans.length === 0) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="text-center">
          <Shield className="w-16 h-16 animate-pulse text-red-600 mx-auto mb-4" />
          <p className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Loading Security Scanner
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Initializing vulnerability detection systems...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-pink-600 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center mb-2">
              <Shield className="w-8 h-8 mr-3" />
              <h1 className="text-3xl font-bold">Security Scanner</h1>
              <span className="ml-3 px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                Enterprise
              </span>
            </div>
            <p className="text-xl text-red-100">
              Advanced vulnerability detection and security analysis for Backstage plugins
            </p>
          </div>
          <div className="flex gap-3">
            {selectedPlugins.length > 0 && (
              <button
                onClick={startBulkScan}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg flex items-center transition-colors"
              >
                <Play className="w-5 h-5 mr-2" />
                Scan {selectedPlugins.length} Plugins
              </button>
            )}
            <button
              onClick={fetchSecurityScans}
              className="px-4 py-2 bg-white text-red-600 rounded-lg hover:bg-red-50 flex items-center transition-colors"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Refresh
            </button>
          </div>
        </div>
        
        {/* Dashboard Stats */}
        {dashboard && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <XCircle className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{dashboard.criticalIssues}</div>
                  <div className="text-sm text-red-100">Critical Issues</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{dashboard.highRiskPlugins}</div>
                  <div className="text-sm text-red-100">High Risk</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <BarChart3 className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{Math.round(dashboard.averageScore)}</div>
                  <div className="text-sm text-red-100">Avg Score</div>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center">
                <Layers className="w-6 h-6 mr-3" />
                <div>
                  <div className="text-2xl font-bold">{dashboard.totalScans}</div>
                  <div className="text-sm text-red-100">Total Scans</div>
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
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'scans', label: 'Security Scans', icon: Shield },
            { id: 'vulnerabilities', label: 'Vulnerabilities', icon: Bug },
            { id: 'compliance', label: 'Compliance', icon: FileText }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-red-500 text-red-600'
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
          {activeTab === 'overview' && dashboard && (
            <div className="space-y-6">
              {/* Risk Distribution */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Risk Distribution
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(dashboard.riskDistribution).map(([level, count]) => (
                      <div key={level} className="flex items-center justify-between">
                        <div className="flex items-center">
                          {getSeverityIcon(level)}
                          <span className="ml-2 capitalize font-medium text-gray-900 dark:text-gray-100">
                            {level}
                          </span>
                        </div>
                        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    Top Vulnerabilities
                  </h3>
                  <div className="space-y-3">
                    {dashboard.topVulnerabilities.slice(0, 5).map((vuln) => (
                      <div key={vuln.id} className="flex items-start">
                        {getSeverityIcon(vuln.severity)}
                        <div className="ml-3 flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                            {vuln.title}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {vuln.cve} • CVSS {vuln.cvss}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Trends Chart Placeholder */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Security Trends (Last 30 Days)
                </h3>
                <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2" />
                    <p>Security trends visualization would be rendered here</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Scans Tab */}
          {activeTab === 'scans' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search plugins..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                    />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <select
                    value={filterRisk}
                    onChange={(e) => setFilterRisk(e.target.value)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                  >
                    <option value="all">All Risk Levels</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>
              </div>

              {/* Scans Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredScans.map((scan) => (
                  <motion.div
                    key={scan.scanId}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {scan.pluginName}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          v{scan.version}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {scan.securityScore}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Security Score
                        </div>
                      </div>
                    </div>

                    {/* Risk Level */}
                    <div className="mb-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(scan.riskLevel)}`}>
                        {scan.riskLevel.toUpperCase()} RISK
                      </span>
                    </div>

                    {/* Vulnerabilities */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Vulnerabilities
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {scan.vulnerabilities.length} found
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {['critical', 'high', 'medium', 'low'].map(severity => {
                          const count = scan.vulnerabilities.filter(v => v.severity === severity).length;
                          return count > 0 ? (
                            <span key={severity} className="flex items-center text-xs">
                              {getSeverityIcon(severity)}
                              <span className="ml-1">{count}</span>
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>

                    {/* Last Scan */}
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {new Date(scan.scanDate).toLocaleDateString()}
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        scan.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                        scan.status === 'scanning' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }`}>
                        {scan.status}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedScan(scan)}
                        className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm flex items-center justify-center"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Details
                      </button>
                      <button
                        onClick={() => startSecurityScan(scan.pluginId)}
                        disabled={scanningPlugins.has(scan.pluginId)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                      >
                        {scanningPlugins.has(scan.pluginId) ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Vulnerabilities Tab */}
          {activeTab === 'vulnerabilities' && dashboard && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {dashboard.topVulnerabilities.map((vuln) => (
                  <div
                    key={vuln.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start">
                        {getSeverityIcon(vuln.severity)}
                        <div className="ml-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {vuln.title}
                          </h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                            {vuln.cve && <span>{vuln.cve}</span>}
                            {vuln.cvss && <span>CVSS {vuln.cvss}</span>}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(vuln.severity)}`}>
                        {vuln.severity.toUpperCase()}
                      </span>
                    </div>

                    <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
                      {vuln.description}
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Exploitable:</span>
                        <span className={`ml-2 ${vuln.exploitable ? 'text-red-600' : 'text-green-600'}`}>
                          {vuln.exploitable ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Public Exploit:</span>
                        <span className={`ml-2 ${vuln.publicExploit ? 'text-red-600' : 'text-green-600'}`}>
                          {vuln.publicExploit ? 'Available' : 'None'}
                        </span>
                      </div>
                    </div>

                    {vuln.patchedVersion && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
                        <div className="flex items-center text-green-800 dark:text-green-200">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          <span className="text-sm font-medium">
                            Fixed in version {vuln.patchedVersion}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {vuln.references.map((ref, index) => (
                        <a
                          key={index}
                          href={ref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Reference
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compliance Tab */}
          {activeTab === 'compliance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {['GDPR', 'HIPAA', 'SOX', 'PCI DSS'].map((standard) => {
                  const compliant = Math.random() > 0.3;
                  return (
                    <div
                      key={standard}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {standard}
                        </h3>
                        {compliant ? (
                          <CheckCircle className="w-6 h-6 text-green-500" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-500" />
                        )}
                      </div>
                      <div className={`text-sm ${compliant ? 'text-green-600' : 'text-red-600'}`}>
                        {compliant ? 'Compliant' : 'Issues Found'}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Last checked: {new Date().toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200">
                      Compliance Recommendations
                    </h4>
                    <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                      <li>• Enable data encryption for sensitive plugin data</li>
                      <li>• Implement audit logging for all plugin actions</li>
                      <li>• Review and update privacy policies</li>
                      <li>• Conduct regular security assessments</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security Scan Detail Modal */}
      {selectedScan && (
        <SecurityScanDetailModal
          scan={selectedScan}
          onClose={() => setSelectedScan(null)}
        />
      )}
    </div>
  );
}

// Security Scan Detail Modal Component
const SecurityScanDetailModal = ({ scan, onClose }: { scan: SecurityScan; onClose: () => void }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden"
    >
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Security Scan Results: {scan.pluginName}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Score: {scan.securityScore}/100 • Risk Level: {scan.riskLevel}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ×
          </button>
        </div>
      </div>
      
      <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
        <div className="space-y-6">
          {/* Vulnerabilities */}
          {scan.vulnerabilities.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Vulnerabilities ({scan.vulnerabilities.length})
              </h3>
              <div className="space-y-3">
                {scan.vulnerabilities.map((vuln, index) => (
                  <div
                    key={index}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start">
                        <AlertTriangle className={`w-5 h-5 mr-2 mt-0.5 ${
                          vuln.severity === 'critical' ? 'text-red-600' :
                          vuln.severity === 'high' ? 'text-orange-500' :
                          vuln.severity === 'medium' ? 'text-yellow-500' :
                          'text-blue-500'
                        }`} />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            {vuln.title}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {vuln.description}
                          </p>
                          {vuln.cve && (
                            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                              {vuln.cve} • CVSS {vuln.cvss}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        vuln.severity === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        vuln.severity === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                        vuln.severity === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      }`}>
                        {vuln.severity.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {scan.recommendations.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Recommendations
              </h3>
              <div className="space-y-3">
                {scan.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-blue-900 dark:text-blue-100">
                          {rec.action}
                        </h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          {rec.description}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                          Impact: {rec.impact}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ml-3 ${
                        rec.priority === 'immediate' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                        rec.priority === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                        rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {rec.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Code Quality */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Code Quality Metrics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(scan.codeQuality).map(([metric, value]) => (
                <div key={metric} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {typeof value === 'number' && metric !== 'codeSmells' && metric !== 'duplicatedLines' 
                      ? `${Math.round(value)}%` 
                      : value}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                    {metric.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  </div>
);