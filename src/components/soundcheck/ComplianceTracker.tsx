'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
 Shield,
 CheckCircle,
 AlertTriangle,
 XCircle,
 Clock,
 TrendingUp,
 TrendingDown,
 FileText,
 Award,
 Calendar,
 Filter,
 Download,
 Eye,
 Search,
 Target,
 BarChart3,
 Users,
 Building
} from 'lucide-react';

interface CompliancePolicy {
 id: string;
 name: string;
 description: string;
 scope: 'global' | 'team' | 'system' | 'component';
 enforcement: 'advisory' | 'warning' | 'blocking';
 requiredChecks: string[];
 expirationPeriod?: number; // days
 createdAt: string;
 createdBy: string;
}

interface ComplianceResult {
 entityId: string;
 entityName: string;
 entityType: string;
 policyId: string;
 policyName: string;
 status: 'compliant' | 'non-compliant' | 'warning' | 'expired';
 score: number;
 lastAssessed: string;
 expiresAt?: string;
 issues: Array<{
 checkId: string;
 checkName: string;
 severity: string;
 message: string;
 }>;
}

interface ComplianceReport {
 id: string;
 title: string;
 description: string;
 scope: {
 policies: string[];
 entities: string[];
 teams: string[];
 timeRange: {
 start: string;
 end: string;
 };
 };
 summary: {
 totalEntities: number;
 compliantEntities: number;
 complianceRate: number;
 criticalIssues: number;
 expiringSoon: number;
 };
 generatedAt: string;
 generatedBy: string;
}

export function ComplianceTracker() {
 const [activeTab, setActiveTab] = useState<'overview' | 'policies' | 'results' | 'reports'>('overview');
 const [selectedPolicy, setSelectedPolicy] = useState<string>('all');
 const [selectedScope, setSelectedScope] = useState<string>('all');
 const [searchQuery, setSearchQuery] = useState('');
 const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

 // Mock data - in real implementation, this would come from API
 const mockPolicies: CompliancePolicy[] = [
 {
 id: 'security-baseline',
 name: 'Security Baseline Policy',
 description: 'Minimum security requirements for all production services',
 scope: 'global',
 enforcement: 'blocking',
 requiredChecks: ['security-api-authentication', 'security-tls-enabled', 'security-secrets-encrypted'],
 expirationPeriod: 90,
 createdAt: '2024-01-15T00:00:00Z',
 createdBy: 'security-team'
 },
 {
 id: 'reliability-standard',
 name: 'Reliability Standard',
 description: 'Reliability requirements for high-availability services',
 scope: 'system',
 enforcement: 'warning',
 requiredChecks: ['reliability-health-check', 'reliability-sla-defined', 'monitoring-alerts-configured'],
 expirationPeriod: 180,
 createdAt: '2024-01-10T00:00:00Z',
 createdBy: 'platform-team'
 },
 {
 id: 'documentation-policy',
 name: 'Documentation Policy',
 description: 'Documentation requirements for all components',
 scope: 'component',
 enforcement: 'advisory',
 requiredChecks: ['docs-readme-exists', 'docs-api-documented', 'docs-runbook-available'],
 createdAt: '2024-02-01T00:00:00Z',
 createdBy: 'documentation-team'
 }
 ];

 const mockResults: ComplianceResult[] = [
 {
 entityId: 'user-service',
 entityName: 'User Service',
 entityType: 'Component',
 policyId: 'security-baseline',
 policyName: 'Security Baseline Policy',
 status: 'compliant',
 score: 95,
 lastAssessed: '2024-01-20T10:00:00Z',
 expiresAt: '2024-04-20T10:00:00Z',
 issues: []
 },
 {
 entityId: 'payment-service',
 entityName: 'Payment Service',
 entityType: 'Component',
 policyId: 'security-baseline',
 policyName: 'Security Baseline Policy',
 status: 'non-compliant',
 score: 65,
 lastAssessed: '2024-01-19T15:30:00Z',
 expiresAt: '2024-04-19T15:30:00Z',
 issues: [
 {
 checkId: 'security-api-authentication',
 checkName: 'API Authentication Required',
 severity: 'critical',
 message: 'API endpoints missing authentication'
 }
 ]
 },
 {
 entityId: 'notification-service',
 entityName: 'Notification Service',
 entityType: 'Component',
 policyId: 'reliability-standard',
 policyName: 'Reliability Standard',
 status: 'warning',
 score: 78,
 lastAssessed: '2024-01-18T09:15:00Z',
 expiresAt: '2024-07-18T09:15:00Z',
 issues: [
 {
 checkId: 'monitoring-alerts-configured',
 checkName: 'Monitoring Alerts Configured',
 severity: 'medium',
 message: 'Missing critical performance alerts'
 }
 ]
 }
 ];

 // Filter results based on selections
 const filteredResults = useMemo(() => {
 return mockResults.filter(result => {
 if (selectedPolicy !== 'all' && result.policyId !== selectedPolicy) return false;
 if (searchQuery && !result.entityName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
 return true;
 });
 }, [mockResults, selectedPolicy, searchQuery]);

 // Calculate summary statistics
 const summary = useMemo(() => {
 const total = filteredResults.length;
 const compliant = filteredResults.filter(r => r.status === 'compliant').length;
 const nonCompliant = filteredResults.filter(r => r.status === 'non-compliant').length;
 const warnings = filteredResults.filter(r => r.status === 'warning').length;
 const critical = filteredResults.filter(r => 
 r.issues.some(i => i.severity === 'critical')
 ).length;
 
 // Calculate expiring soon (within 30 days)
 const thirtyDaysFromNow = new Date();
 thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
 const expiring = filteredResults.filter(r => 
 r.expiresAt && new Date(r.expiresAt) <= thirtyDaysFromNow
 ).length;

 return {
 total,
 compliant,
 nonCompliant,
 warnings,
 critical,
 expiring,
 complianceRate: total > 0 ? Math.round((compliant / total) * 100) : 0
 };
 }, [filteredResults]);

 const getStatusIcon = (status: string) => {
 switch (status) {
 case 'compliant': return <CheckCircle className="w-4 h-4 text-green-600" />;
 case 'non-compliant': return <XCircle className="w-4 h-4 text-red-600" />;
 case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
 case 'expired': return <Clock className="w-4 h-4 text-gray-600" />;
 default: return <Clock className="w-4 h-4 text-gray-400" />;
 }
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'compliant': return 'bg-green-100 text-green-800';
 case 'non-compliant': return 'bg-red-100 text-red-800';
 case 'warning': return 'bg-yellow-100 text-yellow-800';
 case 'expired': return 'bg-gray-100 text-gray-800';
 default: return 'bg-gray-100 text-gray-600';
 }
 };

 const getEnforcementColor = (enforcement: string) => {
 switch (enforcement) {
 case 'blocking': return 'bg-red-100 text-red-800';
 case 'warning': return 'bg-yellow-100 text-yellow-800';
 case 'advisory': return 'bg-blue-100 text-blue-800';
 default: return 'bg-gray-100 text-gray-600';
 }
 };

 const getScopeIcon = (scope: string) => {
 switch (scope) {
 case 'global': return <Shield className="w-4 h-4" />;
 case 'system': return <Building className="w-4 h-4" />;
 case 'team': return <Users className="w-4 h-4" />;
 case 'component': return <Target className="w-4 h-4" />;
 default: return <Shield className="w-4 h-4" />;
 }
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-lg p-8 text-white">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-3xl font-bold mb-2">Compliance Tracker</h1>
 <p className="text-green-100 mb-4">
 Monitor policy compliance and track quality standards across your services
 </p>
 
 <div className="flex items-center space-x-6">
 <div className="text-center">
 <div className="text-2xl font-bold">{summary.complianceRate}%</div>
 <div className="text-sm text-green-100">Compliance Rate</div>
 </div>
 <div className="text-center">
 <div className="text-2xl font-bold">{summary.compliant}</div>
 <div className="text-sm text-green-100">Compliant Services</div>
 </div>
 <div className="text-center">
 <div className="text-2xl font-bold">{summary.critical}</div>
 <div className="text-sm text-green-100">Critical Issues</div>
 </div>
 <div className="text-center">
 <div className="text-2xl font-bold">{summary.expiring}</div>
 <div className="text-sm text-green-100">Expiring Soon</div>
 </div>
 </div>
 </div>
 
 <div className="flex space-x-3">
 <button className="flex items-center px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
 <Download className="w-4 h-4 mr-2" />
 Export Report
 </button>
 <button className="flex items-center px-4 py-2 bg-white text-green-600 hover:bg-green-50 rounded-lg transition-colors">
 <FileText className="w-4 h-4 mr-2" />
 Generate Report
 </button>
 </div>
 </div>
 </div>

 {/* Navigation Tabs */}
 <div className="border-b border-gray-200 dark:border-gray-700">
 <nav className="flex space-x-8">
 {[
 { key: 'overview', label: 'Overview', icon: BarChart3 },
 { key: 'policies', label: 'Policies', icon: Shield },
 { key: 'results', label: 'Compliance Results', icon: CheckCircle },
 { key: 'reports', label: 'Reports', icon: FileText }
 ].map(({ key, label, icon: Icon }) => (
 <button
 key={key}
 onClick={() => setActiveTab(key as any)}
 className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
 activeTab === key
 ? 'border-blue-500 text-blue-600'
 : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
 }`}
 >
 <Icon className="w-4 h-4 mr-2" />
 {label}
 </button>
 ))}
 </nav>
 </div>

 {/* Overview Tab */}
 {activeTab === 'overview' && (
 <div className="space-y-6">
 {/* Summary Cards */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Services</p>
 <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.total}</p>
 </div>
 <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
 <Target className="w-6 h-6 text-blue-600" />
 </div>
 </div>
 </div>

 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Compliant</p>
 <p className="text-2xl font-bold text-green-600">{summary.compliant}</p>
 </div>
 <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
 <CheckCircle className="w-6 h-6 text-green-600" />
 </div>
 </div>
 </div>

 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Non-Compliant</p>
 <p className="text-2xl font-bold text-red-600">{summary.nonCompliant}</p>
 </div>
 <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
 <XCircle className="w-6 h-6 text-red-600" />
 </div>
 </div>
 </div>

 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Expiring Soon</p>
 <p className="text-2xl font-bold text-yellow-600">{summary.expiring}</p>
 </div>
 <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
 <Clock className="w-6 h-6 text-yellow-600" />
 </div>
 </div>
 </div>
 </div>

 {/* Compliance Trends */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Compliance Trends
 </h3>
 <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
 <div className="text-center">
 <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
 <p>Compliance trend charts would be displayed here</p>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Policies Tab */}
 {activeTab === 'policies' && (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Compliance Policies ({mockPolicies.length})
 </h2>
 <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
 <Shield className="w-4 h-4 mr-2" />
 Create Policy
 </button>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
 {mockPolicies.map((policy) => (
 <div
 key={policy.id}
 className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
 >
 <div className="flex items-start justify-between mb-4">
 <div className="flex items-center space-x-3">
 <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
 {getScopeIcon(policy.scope)}
 </div>
 <div>
 <h3 className="font-semibold text-gray-900 dark:text-gray-100">
 {policy.name}
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-300 capitalize">
 {policy.scope} scope
 </p>
 </div>
 </div>
 <span className={`text-xs px-2 py-1 rounded uppercase font-medium ${getEnforcementColor(policy.enforcement)}`}>
 {policy.enforcement}
 </span>
 </div>

 <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
 {policy.description}
 </p>

 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
 Required Checks
 </span>
 <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
 {policy.requiredChecks.length}
 </span>
 </div>
 
 {policy.expirationPeriod && (
 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
 Expiration Period
 </span>
 <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
 {policy.expirationPeriod} days
 </span>
 </div>
 )}

 <div className="flex items-center justify-between">
 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
 Created By
 </span>
 <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
 {policy.createdBy}
 </span>
 </div>
 </div>

 <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
 <button className="w-full text-center text-blue-600 hover:text-blue-800 text-sm font-medium">
 View Policy Details
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Compliance Results Tab */}
 {activeTab === 'results' && (
 <div className="space-y-6">
 {/* Filters */}
 <div className="flex items-center space-x-4">
 <div className="flex-1 relative">
 <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
 <input
 type="text"
 placeholder="Search services..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 />
 </div>
 <select
 value={selectedPolicy}
 onChange={(e) => setSelectedPolicy(e.target.value)}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="all">All Policies</option>
 {mockPolicies.map(policy => (
 <option key={policy.id} value={policy.id}>
 {policy.name}
 </option>
 ))}
 </select>
 </div>

 {/* Results Table */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-gray-50 dark:bg-gray-700">
 <tr>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
 Service
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
 Policy
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
 Status
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
 Score
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
 Issues
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
 Last Assessed
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
 Actions
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
 {filteredResults.map((result) => (
 <tr key={`${result.entityId}-${result.policyId}`} className="hover:bg-gray-50 dark:hover:bg-gray-700">
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {result.entityName}
 </div>
 <div className="text-sm text-gray-500">
 {result.entityType}
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="text-sm text-gray-900 dark:text-gray-100">
 {result.policyName}
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="flex items-center space-x-2">
 {getStatusIcon(result.status)}
 <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
 {result.status.replace('-', ' ')}
 </span>
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {result.score}%
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="text-sm text-gray-900 dark:text-gray-100">
 {result.issues.length} issue{result.issues.length !== 1 ? 's' : ''}
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="text-sm text-gray-500">
 {new Date(result.lastAssessed).toLocaleDateString()}
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
 <Eye className="w-4 h-4 mr-1" />
 View Details
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )}

 {/* Reports Tab */}
 {activeTab === 'reports' && (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Compliance Reports
 </h2>
 <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
 <FileText className="w-4 h-4 mr-2" />
 Generate New Report
 </button>
 </div>

 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
 <div className="text-center">
 <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 No Reports Generated Yet
 </h3>
 <p className="text-gray-600 dark:text-gray-400 mb-6">
 Generate comprehensive compliance reports to track your organization's adherence to policies and standards
 </p>
 <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
 Generate Your First Report
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}