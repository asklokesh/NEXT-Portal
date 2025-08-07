'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
 Award,
 Star,
 CheckCircle,
 XCircle,
 Clock,
 TrendingUp,
 Calendar,
 User,
 Search,
 Filter,
 Eye,
 Download,
 RefreshCw,
 AlertTriangle,
 Shield,
 Trophy,
 Target,
 Zap,
 Medal
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CertificationLevel {
 id: string;
 name: string;
 description: string;
 color: string;
 icon: React.ComponentType<any>;
 requirements: {
 minScore: number;
 requiredChecks: string[];
 additionalCriteria: string[];
 };
 benefits: string[];
 validityPeriod: number; // days
}

interface ServiceCertification {
 id: string;
 entityId: string;
 entityName: string;
 entityType: string;
 level: string;
 levelName: string;
 category?: string;
 issuedAt: string;
 expiresAt: string;
 issuedBy: string;
 status: 'active' | 'expired' | 'revoked' | 'pending';
 score: number;
 criteria: Array<{
 name: string;
 description: string;
 required: boolean;
 met: boolean;
 evidence?: string;
 }>;
 renewalHistory: Array<{
 date: string;
 previousLevel: string;
 newLevel: string;
 score: number;
 }>;
}

interface CertificationTemplate {
 id: string;
 name: string;
 description: string;
 category: string;
 levels: string[]; // certification level IDs
 autoRenewal: boolean;
 notificationPeriod: number; // days before expiry
}

export function CertificationSystem() {
 const [activeTab, setActiveTab] = useState<'overview' | 'certifications' | 'levels' | 'templates'>('overview');
 const [selectedLevel, setSelectedLevel] = useState('all');
 const [selectedStatus, setSelectedStatus] = useState('all');
 const [searchQuery, setSearchQuery] = useState('');
 const [sortBy, setSortBy] = useState<'name' | 'level' | 'issued' | 'expires'>('name');
 const queryClient = useQueryClient();

 // Certification levels configuration
 const certificationLevels: CertificationLevel[] = [
 {
 id: 'bronze',
 name: 'Bronze',
 description: 'Basic quality standards met',
 color: 'text-amber-600',
 icon: Medal,
 requirements: {
 minScore: 70,
 requiredChecks: ['docs-readme-exists', 'reliability-health-check'],
 additionalCriteria: ['Active maintenance', 'Basic documentation']
 },
 benefits: [
 'Quality badge display',
 'Basic support priority',
 'Quality dashboard visibility'
 ],
 validityPeriod: 90
 },
 {
 id: 'silver',
 name: 'Silver',
 description: 'Enhanced quality and reliability standards',
 color: 'text-gray-600',
 icon: Award,
 requirements: {
 minScore: 85,
 requiredChecks: [
 'docs-readme-exists',
 'reliability-health-check',
 'testing-unit-coverage',
 'performance-response-time'
 ],
 additionalCriteria: [
 'Comprehensive testing',
 'Performance monitoring',
 'Documentation completeness'
 ]
 },
 benefits: [
 'All Bronze benefits',
 'Enhanced support priority',
 'Performance optimization recommendations',
 'Advanced monitoring features'
 ],
 validityPeriod: 180
 },
 {
 id: 'gold',
 name: 'Gold',
 description: 'Production-ready with comprehensive quality controls',
 color: 'text-yellow-500',
 icon: Star,
 requirements: {
 minScore: 95,
 requiredChecks: [
 'security-api-authentication',
 'docs-readme-exists',
 'reliability-health-check',
 'testing-unit-coverage',
 'performance-response-time'
 ],
 additionalCriteria: [
 'Security best practices',
 'Comprehensive monitoring',
 'Disaster recovery plan',
 'Performance SLA compliance'
 ]
 },
 benefits: [
 'All Silver benefits',
 'Production deployment approval',
 'Premium support priority',
 'Security certification',
 'Compliance reporting'
 ],
 validityPeriod: 365
 },
 {
 id: 'platinum',
 name: 'Platinum',
 description: 'Excellence in all quality dimensions',
 color: 'text-purple-600',
 icon: Trophy,
 requirements: {
 minScore: 98,
 requiredChecks: [
 'security-api-authentication',
 'docs-readme-exists',
 'reliability-health-check',
 'testing-unit-coverage',
 'performance-response-time'
 ],
 additionalCriteria: [
 'Zero critical issues',
 'Exceptional performance metrics',
 'Industry compliance standards',
 'Continuous improvement practices',
 'Community contributions'
 ]
 },
 benefits: [
 'All Gold benefits',
 'Executive recognition',
 'Best practice showcase',
 'Mentorship opportunities',
 'Conference presentation eligibility'
 ],
 validityPeriod: 365
 }
 ];

 // Mock certification data
 const mockCertifications: ServiceCertification[] = [
 {
 id: 'cert-1',
 entityId: 'user-service',
 entityName: 'User Service',
 entityType: 'Component',
 level: 'gold',
 levelName: 'Gold',
 category: 'Backend Service',
 issuedAt: '2024-01-15T00:00:00Z',
 expiresAt: '2025-01-15T00:00:00Z',
 issuedBy: 'Platform Team',
 status: 'active',
 score: 96,
 criteria: [
 {
 name: 'Security Authentication',
 description: 'API endpoints require proper authentication',
 required: true,
 met: true,
 evidence: 'OAuth 2.0 implementation verified'
 },
 {
 name: 'Documentation Complete',
 description: 'Comprehensive README and API documentation',
 required: true,
 met: true,
 evidence: 'README.md and OpenAPI spec available'
 },
 {
 name: 'Health Monitoring',
 description: 'Health check endpoint and monitoring',
 required: true,
 met: true,
 evidence: '/health endpoint returns detailed status'
 }
 ],
 renewalHistory: [
 {
 date: '2024-01-15T00:00:00Z',
 previousLevel: 'silver',
 newLevel: 'gold',
 score: 96
 }
 ]
 },
 {
 id: 'cert-2',
 entityId: 'payment-service',
 entityName: 'Payment Service',
 entityType: 'Component',
 level: 'silver',
 levelName: 'Silver',
 category: 'Backend Service',
 issuedAt: '2024-01-10T00:00:00Z',
 expiresAt: '2024-07-10T00:00:00Z',
 issuedBy: 'Security Team',
 status: 'active',
 score: 87,
 criteria: [
 {
 name: 'Documentation',
 description: 'Basic documentation requirements',
 required: true,
 met: true
 },
 {
 name: 'Testing Coverage',
 description: 'Unit test coverage above 80%',
 required: true,
 met: true,
 evidence: '85% test coverage achieved'
 },
 {
 name: 'Performance Standards',
 description: 'Response time within acceptable limits',
 required: false,
 met: false
 }
 ],
 renewalHistory: []
 },
 {
 id: 'cert-3',
 entityId: 'notification-service',
 entityName: 'Notification Service',
 entityType: 'Component',
 level: 'bronze',
 levelName: 'Bronze',
 issuedAt: '2024-01-05T00:00:00Z',
 expiresAt: '2024-04-05T00:00:00Z',
 issuedBy: 'Platform Team',
 status: 'expired',
 score: 72,
 criteria: [
 {
 name: 'Basic Documentation',
 description: 'README file exists',
 required: true,
 met: true
 },
 {
 name: 'Health Check',
 description: 'Basic health endpoint',
 required: true,
 met: true
 }
 ],
 renewalHistory: []
 }
 ];

 // Filter and sort certifications
 const filteredCertifications = useMemo(() => {
 let filtered = mockCertifications.filter(cert => {
 if (selectedLevel !== 'all' && cert.level !== selectedLevel) return false;
 if (selectedStatus !== 'all' && cert.status !== selectedStatus) return false;
 if (searchQuery && !cert.entityName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
 return true;
 });

 // Sort certifications
 filtered.sort((a, b) => {
 switch (sortBy) {
 case 'name':
 return a.entityName.localeCompare(b.entityName);
 case 'level':
 const levelOrder = { platinum: 4, gold: 3, silver: 2, bronze: 1 };
 return (levelOrder[b.level as keyof typeof levelOrder] || 0) - (levelOrder[a.level as keyof typeof levelOrder] || 0);
 case 'issued':
 return new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime();
 case 'expires':
 return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
 default:
 return 0;
 }
 });

 return filtered;
 }, [mockCertifications, selectedLevel, selectedStatus, searchQuery, sortBy]);

 // Calculate summary stats
 const stats = useMemo(() => {
 const total = mockCertifications.length;
 const active = mockCertifications.filter(c => c.status === 'active').length;
 const expired = mockCertifications.filter(c => c.status === 'expired').length;
 const expiringSoon = mockCertifications.filter(c => {
 const thirtyDaysFromNow = new Date();
 thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
 return c.status === 'active' && new Date(c.expiresAt) <= thirtyDaysFromNow;
 }).length;

 const levelCounts = certificationLevels.reduce((acc, level) => {
 acc[level.id] = mockCertifications.filter(c => c.level === level.id && c.status === 'active').length;
 return acc;
 }, {} as Record<string, number>);

 return { total, active, expired, expiringSoon, levelCounts };
 }, [mockCertifications, certificationLevels]);

 // Renewal mutation
 const renewCertificationMutation = useMutation({
 mutationFn: async (certificationId: string) => {
 // Simulate API call
 await new Promise(resolve => setTimeout(resolve, 1000));
 return { success: true };
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ['certifications'] });
 toast.success('Certification renewal initiated');
 },
 onError: () => {
 toast.error('Failed to renew certification');
 }
 });

 const getLevelConfig = (levelId: string) => {
 return certificationLevels.find(l => l.id === levelId) || certificationLevels[0];
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case 'active': return 'bg-green-100 text-green-800';
 case 'expired': return 'bg-red-100 text-red-800';
 case 'revoked': return 'bg-gray-100 text-gray-800';
 case 'pending': return 'bg-yellow-100 text-yellow-800';
 default: return 'bg-gray-100 text-gray-600';
 }
 };

 const getStatusIcon = (status: string) => {
 switch (status) {
 case 'active': return <CheckCircle className="w-4 h-4 text-green-600" />;
 case 'expired': return <Clock className="w-4 h-4 text-red-600" />;
 case 'revoked': return <XCircle className="w-4 h-4 text-gray-600" />;
 case 'pending': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
 default: return <Clock className="w-4 h-4 text-gray-400" />;
 }
 };

 const isExpiringSoon = (expiresAt: string) => {
 const thirtyDaysFromNow = new Date();
 thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
 return new Date(expiresAt) <= thirtyDaysFromNow;
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg p-8 text-white">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-3xl font-bold mb-2">Certification System</h1>
 <p className="text-purple-100 mb-4">
 Recognize and track service quality achievements with milestone certifications
 </p>
 
 <div className="flex items-center space-x-6">
 <div className="text-center">
 <div className="text-2xl font-bold">{stats.active}</div>
 <div className="text-sm text-purple-100">Active Certifications</div>
 </div>
 <div className="text-center">
 <div className="text-2xl font-bold">{stats.levelCounts.platinum + stats.levelCounts.gold}</div>
 <div className="text-sm text-purple-100">Premium Certified</div>
 </div>
 <div className="text-center">
 <div className="text-2xl font-bold">{stats.expiringSoon}</div>
 <div className="text-sm text-purple-100">Expiring Soon</div>
 </div>
 </div>
 </div>
 
 <div className="text-right">
 <div className="text-4xl font-bold mb-2">{Math.round((stats.active / stats.total) * 100)}%</div>
 <div className="text-sm text-purple-100">Certification Rate</div>
 </div>
 </div>
 </div>

 {/* Navigation Tabs */}
 <div className="border-b border-gray-200 dark:border-gray-700">
 <nav className="flex space-x-8">
 {[
 { key: 'overview', label: 'Overview', icon: Trophy },
 { key: 'certifications', label: 'Certifications', icon: Award },
 { key: 'levels', label: 'Certification Levels', icon: Star },
 { key: 'templates', label: 'Templates', icon: Target }
 ].map(({ key, label, icon: Icon }) => (
 <button
 key={key}
 onClick={() => setActiveTab(key as any)}
 className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
 activeTab === key
 ? 'border-purple-500 text-purple-600'
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
 {/* Level Distribution */}
 <div>
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Certification Levels Distribution
 </h2>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 {certificationLevels.map((level) => {
 const Icon = level.icon;
 const count = stats.levelCounts[level.id] || 0;
 
 return (
 <div
 key={level.id}
 className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
 >
 <div className="flex items-center justify-between mb-3">
 <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
 <Icon className={`w-6 h-6 ${level.color}`} />
 </div>
 <div className="text-right">
 <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{count}</div>
 <div className="text-sm text-gray-500">services</div>
 </div>
 </div>
 <h3 className="font-semibold text-gray-900 dark:text-gray-100">{level.name}</h3>
 <p className="text-sm text-gray-600 dark:text-gray-300">{level.description}</p>
 </div>
 );
 })}
 </div>
 </div>

 {/* Recent Certifications */}
 <div>
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Recent Certifications
 </h2>
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-gray-50 dark:bg-gray-700">
 <tr>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
 Service
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
 Level
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
 Score
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
 Issued
 </th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
 Status
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
 {mockCertifications.slice(0, 5).map((cert) => {
 const levelConfig = getLevelConfig(cert.level);
 const Icon = levelConfig.icon;
 
 return (
 <tr key={cert.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {cert.entityName}
 </div>
 <div className="text-sm text-gray-500">{cert.entityType}</div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="flex items-center space-x-2">
 <Icon className={`w-4 h-4 ${levelConfig.color}`} />
 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {cert.levelName}
 </span>
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {cert.score}%
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="text-sm text-gray-500">
 {new Date(cert.issuedAt).toLocaleDateString()}
 </div>
 </td>
 <td className="px-6 py-4 whitespace-nowrap">
 <div className="flex items-center space-x-2">
 {getStatusIcon(cert.status)}
 <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(cert.status)}`}>
 {cert.status}
 </span>
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Certifications Tab */}
 {activeTab === 'certifications' && (
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
 value={selectedLevel}
 onChange={(e) => setSelectedLevel(e.target.value)}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="all">All Levels</option>
 {certificationLevels.map(level => (
 <option key={level.id} value={level.id}>
 {level.name}
 </option>
 ))}
 </select>
 <select
 value={selectedStatus}
 onChange={(e) => setSelectedStatus(e.target.value)}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="all">All Status</option>
 <option value="active">Active</option>
 <option value="expired">Expired</option>
 <option value="pending">Pending</option>
 <option value="revoked">Revoked</option>
 </select>
 <select
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value as any)}
 className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 >
 <option value="name">Sort by Name</option>
 <option value="level">Sort by Level</option>
 <option value="issued">Sort by Issued Date</option>
 <option value="expires">Sort by Expiry</option>
 </select>
 </div>

 {/* Certifications Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {filteredCertifications.map((cert) => {
 const levelConfig = getLevelConfig(cert.level);
 const Icon = levelConfig.icon;
 const expiringSoon = isExpiringSoon(cert.expiresAt);
 
 return (
 <div
 key={cert.id}
 className={`bg-white dark:bg-gray-800 rounded-lg border-2 p-6 ${
 cert.status === 'active' ? 'border-gray-200 dark:border-gray-700' : 
 cert.status === 'expired' ? 'border-red-200 dark:border-red-800' :
 'border-gray-200 dark:border-gray-700'
 }`}
 >
 {/* Header */}
 <div className="flex items-start justify-between mb-4">
 <div className="flex items-center space-x-3">
 <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
 <Icon className={`w-6 h-6 ${levelConfig.color}`} />
 </div>
 <div>
 <h3 className="font-semibold text-gray-900 dark:text-gray-100">
 {cert.entityName}
 </h3>
 <p className="text-sm text-gray-600 dark:text-gray-300">
 {cert.levelName} Certification
 </p>
 </div>
 </div>
 <div className="flex items-center space-x-2">
 {getStatusIcon(cert.status)}
 {expiringSoon && cert.status === 'active' && (
 <AlertTriangle className="w-4 h-4 text-yellow-500" />
 )}
 </div>
 </div>

 {/* Score */}
 <div className="mb-4">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
 Quality Score
 </span>
 <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
 {cert.score}%
 </span>
 </div>
 <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
 <div
 className={`h-2 rounded-full ${
 cert.score >= 95 ? 'bg-green-500' :
 cert.score >= 85 ? 'bg-blue-500' :
 cert.score >= 70 ? 'bg-yellow-500' :
 'bg-red-500'
 }`}
 style={{ width: `${cert.score}%` }}
 />
 </div>
 </div>

 {/* Criteria Progress */}
 <div className="mb-4">
 <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
 Criteria Met
 </div>
 <div className="space-y-1">
 {cert.criteria.slice(0, 3).map((criterion, index) => (
 <div key={index} className="flex items-center space-x-2">
 {criterion.met ? (
 <CheckCircle className="w-3 h-3 text-green-500" />
 ) : (
 <XCircle className="w-3 h-3 text-red-500" />
 )}
 <span className="text-xs text-gray-600 dark:text-gray-400">
 {criterion.name}
 </span>
 </div>
 ))}
 {cert.criteria.length > 3 && (
 <div className="text-xs text-gray-500">
 +{cert.criteria.length - 3} more criteria
 </div>
 )}
 </div>
 </div>

 {/* Dates */}
 <div className="space-y-2 mb-4">
 <div className="flex items-center justify-between text-sm">
 <span className="text-gray-600 dark:text-gray-400">Issued:</span>
 <span className="text-gray-900 dark:text-gray-100">
 {new Date(cert.issuedAt).toLocaleDateString()}
 </span>
 </div>
 <div className="flex items-center justify-between text-sm">
 <span className="text-gray-600 dark:text-gray-400">Expires:</span>
 <span className={`${expiringSoon ? 'text-yellow-600' : 'text-gray-900 dark:text-gray-100'}`}>
 {new Date(cert.expiresAt).toLocaleDateString()}
 </span>
 </div>
 </div>

 {/* Actions */}
 <div className="flex space-x-2">
 <button className="flex-1 text-center text-blue-600 hover:text-blue-800 text-sm font-medium py-2 border border-blue-200 rounded">
 <Eye className="w-4 h-4 inline mr-1" />
 View Details
 </button>
 {cert.status === 'expired' && (
 <button
 onClick={() => renewCertificationMutation.mutate(cert.id)}
 disabled={renewCertificationMutation.isPending}
 className="flex-1 text-center text-green-600 hover:text-green-800 text-sm font-medium py-2 border border-green-200 rounded disabled:opacity-50"
 >
 <RefreshCw className="w-4 h-4 inline mr-1" />
 Renew
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Levels Tab */}
 {activeTab === 'levels' && (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Certification Levels
 </h2>
 <button className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
 <Star className="w-4 h-4 mr-2" />
 Create Level
 </button>
 </div>

 <div className="space-y-6">
 {certificationLevels.map((level) => {
 const Icon = level.icon;
 const count = stats.levelCounts[level.id] || 0;
 
 return (
 <div
 key={level.id}
 className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
 >
 <div className="flex items-start justify-between mb-4">
 <div className="flex items-center space-x-4">
 <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
 <Icon className={`w-8 h-8 ${level.color}`} />
 </div>
 <div>
 <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 {level.name}
 </h3>
 <p className="text-gray-600 dark:text-gray-300 mb-2">
 {level.description}
 </p>
 <div className="flex items-center space-x-4 text-sm text-gray-500">
 <span>{count} certified services</span>
 <span>Valid for {level.validityPeriod} days</span>
 </div>
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 {/* Requirements */}
 <div>
 <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
 Requirements
 </h4>
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-sm text-gray-600 dark:text-gray-400">
 Minimum Score
 </span>
 <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
 {level.requirements.minScore}%
 </span>
 </div>
 <div className="space-y-1">
 <span className="text-sm text-gray-600 dark:text-gray-400">
 Required Checks:
 </span>
 {level.requirements.requiredChecks.map((check, index) => (
 <div key={index} className="flex items-center space-x-2">
 <CheckCircle className="w-3 h-3 text-green-500" />
 <span className="text-xs text-gray-600 dark:text-gray-400">
 {check.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
 </span>
 </div>
 ))}
 </div>
 <div className="space-y-1">
 <span className="text-sm text-gray-600 dark:text-gray-400">
 Additional Criteria:
 </span>
 {level.requirements.additionalCriteria.map((criteria, index) => (
 <div key={index} className="flex items-center space-x-2">
 <Target className="w-3 h-3 text-blue-500" />
 <span className="text-xs text-gray-600 dark:text-gray-400">
 {criteria}
 </span>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Benefits */}
 <div>
 <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
 Benefits
 </h4>
 <div className="space-y-1">
 {level.benefits.map((benefit, index) => (
 <div key={index} className="flex items-center space-x-2">
 <Zap className="w-3 h-3 text-purple-500" />
 <span className="text-xs text-gray-600 dark:text-gray-400">
 {benefit}
 </span>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Templates Tab */}
 {activeTab === 'templates' && (
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 Certification Templates
 </h2>
 <button className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
 <Target className="w-4 h-4 mr-2" />
 Create Template
 </button>
 </div>

 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
 <div className="text-center">
 <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 No Certification Templates Yet
 </h3>
 <p className="text-gray-600 dark:text-gray-400 mb-6">
 Create certification templates to standardize quality requirements across different service categories
 </p>
 <button className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
 Create Your First Template
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}