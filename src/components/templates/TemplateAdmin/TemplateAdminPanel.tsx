'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 Shield,
 Settings,
 Users,
 BarChart3,
 Package,
 AlertTriangle,
 CheckCircle,
 XCircle,
 Clock,
 Eye,
 EyeOff,
 Edit,
 Trash2,
 Upload,
 Download,
 Filter,
 Search,
 MoreVertical,
 Activity,
 Calendar,
 TrendingUp,
 TrendingDown,
 Ban,
 Star,
 GitBranch,
 Zap,
 FileText,
 Globe,
 Database,
 UserCheck,
 AlertOctagon
} from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { cn } from '@/lib/utils';
import { useTemplates } from '@/services/backstage/hooks/useScaffolder';

import { TemplateDetailsModal } from './TemplateDetailsModal';

import type { TemplateEntity } from '@/services/backstage/types/templates';

interface TemplateAdminPanelProps {
 className?: string;
}

interface AdminTemplate extends TemplateEntity {
 adminMetadata: {
 status: 'approved' | 'pending' | 'rejected' | 'suspended';
 visibility: 'public' | 'private' | 'restricted';
 approvedBy?: string;
 approvedAt?: string;
 rejectionReason?: string;
 lastReviewed?: string;
 usageStats: {
 totalExecutions: number;
 successfulExecutions: number;
 failedExecutions: number;
 averageExecutionTime: number;
 lastUsed?: string;
 popularityScore: number;
 };
 securityAnalysis: {
 vulnerabilities: number;
 securityScore: number;
 lastScanned: string;
 issues: Array<{
 severity: 'high' | 'medium' | 'low';
 type: string;
 description: string;
 }>;
 };
 qualityMetrics: {
 documentation: number;
 testCoverage: number;
 codeQuality: number;
 maintainability: number;
 };
 };
}

interface AdminStats {
 totalTemplates: number;
 pendingApproval: number;
 approvedTemplates: number;
 rejectedTemplates: number;
 suspendedTemplates: number;
 totalExecutions: number;
 successRate: number;
 averageApprovalTime: number;
 securityIssues: number;
}

const TEMPLATE_STATUS_CONFIG = {
 approved: {
 color: 'bg-green-100 text-green-800 border-green-200',
 icon: CheckCircle,
 label: 'Approved',
 },
 pending: {
 color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
 icon: Clock,
 label: 'Pending Review',
 },
 rejected: {
 color: 'bg-red-100 text-red-800 border-red-200',
 icon: XCircle,
 label: 'Rejected',
 },
 suspended: {
 color: 'bg-gray-100 text-gray-800 border-gray-200',
 icon: Ban,
 label: 'Suspended',
 },
};

const VISIBILITY_CONFIG = {
 public: {
 color: 'bg-blue-100 text-blue-800',
 icon: Globe,
 label: 'Public',
 },
 private: {
 color: 'bg-purple-100 text-purple-800',
 icon: EyeOff,
 label: 'Private',
 },
 restricted: {
 color: 'bg-orange-100 text-orange-800',
 icon: Shield,
 label: 'Restricted',
 },
};

const AdminStatsCard: React.FC<{
 title: string;
 value: string | number;
 change?: { value: number; direction: 'up' | 'down' };
 icon: React.ComponentType<{ className?: string }>;
 className?: string;
}> = ({ title, value, change, icon: Icon, className }) => (
 <div className={cn('bg-card rounded-lg border p-6', className)}>
 <div className="flex items-center justify-between mb-4">
 <div className="p-2 rounded-lg bg-primary/10">
 <Icon className="w-5 h-5 text-primary" />
 </div>
 {change && (
 <div className={cn(
 'flex items-center gap-1 text-sm',
 change.direction === 'up' ? 'text-green-600' : 'text-red-600'
 )}>
 {change.direction === 'up' ? (
 <TrendingUp className="w-3 h-3" />
 ) : (
 <TrendingDown className="w-3 h-3" />
 )}
 <span>{Math.abs(change.value)}%</span>
 </div>
 )}
 </div>
 <div className="space-y-1">
 <div className="text-2xl font-bold">{value}</div>
 <div className="text-sm text-muted-foreground">{title}</div>
 </div>
 </div>
);

const TemplateAdminRow: React.FC<{
 template: AdminTemplate;
 onStatusChange: (templateRef: string, status: AdminTemplate['adminMetadata']['status']) => void;
 onVisibilityChange: (templateRef: string, visibility: AdminTemplate['adminMetadata']['visibility']) => void;
 onView: (template: AdminTemplate) => void;
 onEdit: (template: AdminTemplate) => void;
 onDelete: (template: AdminTemplate) => void;
}> = ({ template, onStatusChange, onVisibilityChange, onView, onEdit, onDelete }) => {
 const [showMenu, setShowMenu] = useState(false);
 
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 const statusConfig = TEMPLATE_STATUS_CONFIG[template.adminMetadata.status];
 const visibilityConfig = VISIBILITY_CONFIG[template.adminMetadata.visibility];
 const StatusIcon = statusConfig.icon;
 const VisibilityIcon = visibilityConfig.icon;
 
 const securityRisk = template.adminMetadata.securityAnalysis.vulnerabilities > 0 ? 'high' :
 template.adminMetadata.securityAnalysis.securityScore < 70 ? 'medium' : 'low';

 return (
 <tr className="hover:bg-accent/30">
 <td className="p-4">
 <div className="flex items-start gap-3">
 <div className="p-2 rounded-lg bg-primary/10">
 <Package className="w-4 h-4 text-primary" />
 </div>
 <div>
 <h4 className="font-medium">{template.metadata.title || template.metadata.name}</h4>
 <p className="text-sm text-muted-foreground">{template.spec.owner}</p>
 <p className="text-xs text-muted-foreground capitalize">{template.spec.type}</p>
 </div>
 </div>
 </td>
 
 <td className="p-4">
 <div className={cn(
 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border',
 statusConfig.color
 )}>
 <StatusIcon className="w-3 h-3" />
 {statusConfig.label}
 </div>
 </td>
 
 <td className="p-4">
 <div className={cn(
 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
 visibilityConfig.color
 )}>
 <VisibilityIcon className="w-3 h-3" />
 {visibilityConfig.label}
 </div>
 </td>
 
 <td className="p-4">
 <div className="space-y-1 text-sm">
 <div className="flex items-center gap-2">
 <Activity className="w-3 h-3 text-blue-600" />
 <span>{template.adminMetadata.usageStats.totalExecutions}</span>
 </div>
 <div className="flex items-center gap-2">
 <CheckCircle className="w-3 h-3 text-green-600" />
 <span>{Math.round((template.adminMetadata.usageStats.successfulExecutions / Math.max(template.adminMetadata.usageStats.totalExecutions, 1)) * 100)}%</span>
 </div>
 </div>
 </td>
 
 <td className="p-4">
 <div className={cn(
 'flex items-center gap-1 text-sm',
 securityRisk === 'high' ? 'text-red-600' :
 securityRisk === 'medium' ? 'text-yellow-600' : 'text-green-600'
 )}>
 <Shield className="w-3 h-3" />
 <span>{template.adminMetadata.securityAnalysis.securityScore}</span>
 {template.adminMetadata.securityAnalysis.vulnerabilities > 0 && (
 <span className="text-red-600">({template.adminMetadata.securityAnalysis.vulnerabilities})</span>
 )}
 </div>
 </td>
 
 <td className="p-4">
 <div className="flex items-center gap-1">
 {[1, 2, 3, 4, 5].map(i => (
 <Star
 key={i}
 className={cn(
 'w-3 h-3',
 i <= template.adminMetadata.usageStats.popularityScore
 ? 'text-yellow-500 fill-current'
 : 'text-gray-300'
 )}
 />
 ))}
 </div>
 </td>
 
 <td className="p-4">
 {template.adminMetadata.lastReviewed ? (
 <span className="text-sm text-muted-foreground">
 {new Date(template.adminMetadata.lastReviewed).toLocaleDateString()}
 </span>
 ) : (
 <span className="text-sm text-muted-foreground">Never</span>
 )}
 </td>
 
 <td className="p-4">
 <div className="relative">
 <button
 onClick={() => setShowMenu(!showMenu)}
 className="p-1 rounded hover:bg-accent transition-colors"
 >
 <MoreVertical className="w-4 h-4" />
 </button>
 
 {showMenu && (
 <div className="absolute right-0 top-full mt-1 w-48 rounded-md shadow-lg bg-popover border border-border z-10">
 <div className="py-1">
 <button
 onClick={() => {
 onView(template);
 setShowMenu(false);
 }}
 className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
 >
 <Eye className="w-4 h-4" />
 View Details
 </button>
 
 <button
 onClick={() => {
 onEdit(template);
 setShowMenu(false);
 }}
 className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
 >
 <Edit className="w-4 h-4" />
 Edit Template
 </button>
 
 <div className="border-t border-border my-1" />
 
 <div className="px-3 py-1">
 <div className="text-xs font-medium text-muted-foreground mb-1">Status</div>
 {(['approved', 'pending', 'rejected', 'suspended'] as const).map(status => {
 const StatusIcon = TEMPLATE_STATUS_CONFIG[status].icon;
 return (
 <button
 key={status}
 onClick={() => {
 onStatusChange(templateRef, status);
 setShowMenu(false);
 }}
 disabled={template.adminMetadata.status === status}
 className={cn(
 'flex items-center gap-2 w-full px-2 py-1 text-xs rounded hover:bg-accent',
 template.adminMetadata.status === status && 'opacity-50 cursor-not-allowed'
 )}
 >
 <StatusIcon className="w-3 h-3" />
 {TEMPLATE_STATUS_CONFIG[status].label}
 </button>
 );
 })}
 </div>
 
 <div className="border-t border-border my-1" />
 
 <div className="px-3 py-1">
 <div className="text-xs font-medium text-muted-foreground mb-1">Visibility</div>
 {(['public', 'private', 'restricted'] as const).map(visibility => {
 const VisibilityIcon = VISIBILITY_CONFIG[visibility].icon;
 return (
 <button
 key={visibility}
 onClick={() => {
 onVisibilityChange(templateRef, visibility);
 setShowMenu(false);
 }}
 disabled={template.adminMetadata.visibility === visibility}
 className={cn(
 'flex items-center gap-2 w-full px-2 py-1 text-xs rounded hover:bg-accent',
 template.adminMetadata.visibility === visibility && 'opacity-50 cursor-not-allowed'
 )}
 >
 <VisibilityIcon className="w-3 h-3" />
 {VISIBILITY_CONFIG[visibility].label}
 </button>
 );
 })}
 </div>
 
 <div className="border-t border-border my-1" />
 
 <button
 onClick={() => {
 onDelete(template);
 setShowMenu(false);
 }}
 className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
 >
 <Trash2 className="w-4 h-4" />
 Delete Template
 </button>
 </div>
 </div>
 )}
 </div>
 </td>
 </tr>
 );
};

export const TemplateAdminPanel: React.FC<TemplateAdminPanelProps> = ({ className }) => {
 const [activeTab, setActiveTab] = useState<'overview' | 'templates' | 'analytics' | 'settings'>('overview');
 const [searchTerm, setSearchTerm] = useState('');
 const [statusFilter, setStatusFilter] = useState<'all' | AdminTemplate['adminMetadata']['status']>('all');
 const [visibilityFilter, setVisibilityFilter] = useState<'all' | AdminTemplate['adminMetadata']['visibility']>('all');
 const [selectedTemplate, setSelectedTemplate] = useState<AdminTemplate | null>(null);

 const { data: baseTemplates = [] } = useTemplates();

 // Mock admin data - in real implementation, fetch from admin API
 const adminTemplates: AdminTemplate[] = useMemo(() => {
 return baseTemplates.map(template => ({
 ...template,
 adminMetadata: {
 status: Math.random() > 0.8 ? 'pending' : Math.random() > 0.9 ? 'rejected' : 'approved',
 visibility: Math.random() > 0.7 ? 'private' : Math.random() > 0.9 ? 'restricted' : 'public',
 approvedBy: 'admin@company.com',
 approvedAt: '2024-01-20T10:00:00Z',
 lastReviewed: '2024-01-20T10:00:00Z',
 usageStats: {
 totalExecutions: Math.floor(Math.random() * 200),
 successfulExecutions: Math.floor(Math.random() * 180),
 failedExecutions: Math.floor(Math.random() * 20),
 averageExecutionTime: 30000 + Math.random() * 120000,
 lastUsed: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
 popularityScore: Math.floor(Math.random() * 5) + 1,
 },
 securityAnalysis: {
 vulnerabilities: Math.random() > 0.8 ? Math.floor(Math.random() * 3) : 0,
 securityScore: Math.floor(Math.random() * 40) + 60,
 lastScanned: '2024-01-20T10:00:00Z',
 issues: [],
 },
 qualityMetrics: {
 documentation: Math.floor(Math.random() * 40) + 60,
 testCoverage: Math.floor(Math.random() * 40) + 60,
 codeQuality: Math.floor(Math.random() * 40) + 60,
 maintainability: Math.floor(Math.random() * 40) + 60,
 },
 },
 }));
 }, [baseTemplates]);

 // Calculate admin stats
 const adminStats: AdminStats = useMemo(() => {
 const totalTemplates = adminTemplates.length;
 const pendingApproval = adminTemplates.filter(t => t.adminMetadata.status === 'pending').length;
 const approvedTemplates = adminTemplates.filter(t => t.adminMetadata.status === 'approved').length;
 const rejectedTemplates = adminTemplates.filter(t => t.adminMetadata.status === 'rejected').length;
 const suspendedTemplates = adminTemplates.filter(t => t.adminMetadata.status === 'suspended').length;
 
 const totalExecutions = adminTemplates.reduce((sum, t) => sum + t.adminMetadata.usageStats.totalExecutions, 0);
 const totalSuccessful = adminTemplates.reduce((sum, t) => sum + t.adminMetadata.usageStats.successfulExecutions, 0);
 const successRate = totalExecutions > 0 ? (totalSuccessful / totalExecutions) * 100 : 0;
 
 const securityIssues = adminTemplates.reduce((sum, t) => sum + t.adminMetadata.securityAnalysis.vulnerabilities, 0);

 return {
 totalTemplates,
 pendingApproval,
 approvedTemplates,
 rejectedTemplates,
 suspendedTemplates,
 totalExecutions,
 successRate,
 averageApprovalTime: 2.5, // Mock data
 securityIssues,
 };
 }, [adminTemplates]);

 // Filter templates
 const filteredTemplates = useMemo(() => {
 let filtered = [...adminTemplates];

 if (searchTerm) {
 const term = searchTerm.toLowerCase();
 filtered = filtered.filter(template =>
 (template.metadata.title || template.metadata.name).toLowerCase().includes(term) ||
 template.metadata.description?.toLowerCase().includes(term) ||
 template.spec.owner.toLowerCase().includes(term)
 );
 }

 if (statusFilter !== 'all') {
 filtered = filtered.filter(template => template.adminMetadata.status === statusFilter);
 }

 if (visibilityFilter !== 'all') {
 filtered = filtered.filter(template => template.adminMetadata.visibility === visibilityFilter);
 }

 return filtered;
 }, [adminTemplates, searchTerm, statusFilter, visibilityFilter]);

 const handleStatusChange = (templateRef: string, status: AdminTemplate['adminMetadata']['status']) => {
 console.log('Change status:', templateRef, status);
 // In real implementation, call admin API
 };

 const handleVisibilityChange = (templateRef: string, visibility: AdminTemplate['adminMetadata']['visibility']) => {
 console.log('Change visibility:', templateRef, visibility);
 // In real implementation, call admin API
 };

 const handleViewTemplate = (template: AdminTemplate) => {
 setSelectedTemplate(template);
 };

 const handleEditTemplate = (template: AdminTemplate) => {
 console.log('Edit template:', template.metadata.name);
 };

 const handleDeleteTemplate = (template: AdminTemplate) => {
 console.log('Delete template:', template.metadata.name);
 };

 return (
 <div className={cn('h-full flex flex-col', className)}>
 {/* Header */}
 <div className="p-6 border-b border-border">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Shield className="w-6 h-6 text-primary" />
 <div>
 <h1 className="text-2xl font-bold">Template Administration</h1>
 <p className="text-sm text-muted-foreground">
 Manage template lifecycle, security, and governance
 </p>
 </div>
 </div>

 <div className="flex items-center gap-2">
 <button className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-accent">
 <Upload className="w-4 h-4" />
 Import Templates
 </button>
 <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
 <Package className="w-4 h-4" />
 Create Template
 </button>
 </div>
 </div>

 {/* Navigation tabs */}
 <div className="flex mt-6 border-b">
 {[
 { id: 'overview', label: 'Overview', icon: BarChart3 },
 { id: 'templates', label: 'Templates', icon: Package },
 { id: 'analytics', label: 'Analytics', icon: Activity },
 { id: 'settings', label: 'Settings', icon: Settings },
 ].map(tab => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={cn(
 'flex items-center gap-1 px-4 py-2 text-sm transition-colors border-b-2',
 activeTab === tab.id
 ? 'border-primary text-primary'
 : 'border-transparent text-muted-foreground hover:text-foreground'
 )}
 >
 <tab.icon className="w-4 h-4" />
 {tab.label}
 </button>
 ))}
 </div>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto">
 {activeTab === 'overview' && (
 <div className="p-6 space-y-6">
 {/* Stats overview */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <AdminStatsCard
 title="Total Templates"
 value={adminStats.totalTemplates}
 change={{ value: 12, direction: 'up' }}
 icon={Package}
 />
 <AdminStatsCard
 title="Pending Approval"
 value={adminStats.pendingApproval}
 change={{ value: 5, direction: 'down' }}
 icon={Clock}
 className={adminStats.pendingApproval > 0 ? 'border-yellow-200 bg-yellow-50' : ''}
 />
 <AdminStatsCard
 title="Success Rate"
 value={`${Math.round(adminStats.successRate)}%`}
 change={{ value: 3, direction: 'up' }}
 icon={CheckCircle}
 />
 <AdminStatsCard
 title="Security Issues"
 value={adminStats.securityIssues}
 change={{ value: 15, direction: 'down' }}
 icon={AlertOctagon}
 className={adminStats.securityIssues > 0 ? 'border-red-200 bg-red-50' : ''}
 />
 </div>

 {/* Quick actions */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="bg-card rounded-lg border p-6">
 <h3 className="font-semibold mb-4 flex items-center gap-2">
 <AlertTriangle className="w-5 h-5 text-yellow-600" />
 Pending Actions
 </h3>
 <div className="space-y-3">
 <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200">
 <div>
 <p className="font-medium text-yellow-800">{adminStats.pendingApproval} templates awaiting review</p>
 <p className="text-sm text-yellow-600">Average approval time: {adminStats.averageApprovalTime} days</p>
 </div>
 <button
 onClick={() => {
 setActiveTab('templates');
 setStatusFilter('pending');
 }}
 className="px-3 py-1 rounded text-sm bg-yellow-600 text-white hover:bg-yellow-700"
 >
 Review
 </button>
 </div>
 
 {adminStats.securityIssues > 0 && (
 <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
 <div>
 <p className="font-medium text-red-800">{adminStats.securityIssues} security issues found</p>
 <p className="text-sm text-red-600">Requires immediate attention</p>
 </div>
 <button className="px-3 py-1 rounded text-sm bg-red-600 text-white hover:bg-red-700">
 Investigate
 </button>
 </div>
 )}
 </div>
 </div>

 <div className="bg-card rounded-lg border p-6">
 <h3 className="font-semibold mb-4 flex items-center gap-2">
 <TrendingUp className="w-5 h-5 text-green-600" />
 Recent Activity
 </h3>
 <div className="space-y-3 text-sm">
 <div className="flex items-center gap-3">
 <div className="w-2 h-2 rounded-full bg-green-500" />
 <span>Template "React Service" approved by admin@company.com</span>
 <span className="text-muted-foreground ml-auto">2h ago</span>
 </div>
 <div className="flex items-center gap-3">
 <div className="w-2 h-2 rounded-full bg-blue-500" />
 <span>New template "Python API" submitted for review</span>
 <span className="text-muted-foreground ml-auto">4h ago</span>
 </div>
 <div className="flex items-center gap-3">
 <div className="w-2 h-2 rounded-full bg-yellow-500" />
 <span>Security scan completed for 5 templates</span>
 <span className="text-muted-foreground ml-auto">6h ago</span>
 </div>
 <div className="flex items-center gap-3">
 <div className="w-2 h-2 rounded-full bg-red-500" />
 <span>Template "Legacy Service" suspended due to vulnerabilities</span>
 <span className="text-muted-foreground ml-auto">1d ago</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {activeTab === 'templates' && (
 <div className="p-6 space-y-6">
 {/* Filters */}
 <div className="flex items-center gap-4">
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Search templates..."
 className="w-full pl-10 pr-4 py-2 rounded-lg border border-border bg-background"
 />
 </div>
 
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value as any)}
 className="px-3 py-2 rounded-lg border border-border bg-background"
 >
 <option value="all">All Statuses</option>
 <option value="approved">Approved</option>
 <option value="pending">Pending</option>
 <option value="rejected">Rejected</option>
 <option value="suspended">Suspended</option>
 </select>
 
 <select
 value={visibilityFilter}
 onChange={(e) => setVisibilityFilter(e.target.value as any)}
 className="px-3 py-2 rounded-lg border border-border bg-background"
 >
 <option value="all">All Visibility</option>
 <option value="public">Public</option>
 <option value="private">Private</option>
 <option value="restricted">Restricted</option>
 </select>
 
 <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-accent">
 <Download className="w-4 h-4" />
 Export
 </button>
 </div>

 {/* Results count */}
 <div className="text-sm text-muted-foreground">
 Showing {filteredTemplates.length} of {adminTemplates.length} templates
 </div>

 {/* Templates table */}
 <div className="bg-card rounded-lg border overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-muted/50">
 <tr>
 <th className="text-left p-4 font-medium">Template</th>
 <th className="text-left p-4 font-medium">Status</th>
 <th className="text-left p-4 font-medium">Visibility</th>
 <th className="text-left p-4 font-medium">Usage</th>
 <th className="text-left p-4 font-medium">Security</th>
 <th className="text-left p-4 font-medium">Rating</th>
 <th className="text-left p-4 font-medium">Last Review</th>
 <th className="text-left p-4 font-medium">Actions</th>
 </tr>
 </thead>
 <tbody>
 {filteredTemplates.map((template) => (
 <TemplateAdminRow
 key={template.metadata.uid}
 template={template}
 onStatusChange={handleStatusChange}
 onVisibilityChange={handleVisibilityChange}
 onView={handleViewTemplate}
 onEdit={handleEditTemplate}
 onDelete={handleDeleteTemplate}
 />
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {filteredTemplates.length === 0 && (
 <div className="text-center py-12">
 <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
 <h3 className="text-lg font-semibold mb-2">No templates found</h3>
 <p className="text-muted-foreground">
 Try adjusting your search filters to find what you're looking for.
 </p>
 </div>
 )}
 </div>
 )}

 {activeTab === 'analytics' && (
 <div className="p-6 space-y-6">
 <div className="text-center py-12">
 <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
 <h3 className="text-lg font-semibold mb-2">Analytics Dashboard</h3>
 <p className="text-muted-foreground">
 Detailed analytics and reporting features will be implemented here.
 </p>
 </div>
 </div>
 )}

 {activeTab === 'settings' && (
 <div className="p-6 space-y-6">
 <div className="text-center py-12">
 <Settings className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
 <h3 className="text-lg font-semibold mb-2">Admin Settings</h3>
 <p className="text-muted-foreground">
 Administrative configuration options will be implemented here.
 </p>
 </div>
 </div>
 )}
 </div>

 {/* Template details modal */}
 {selectedTemplate && (
 <TemplateDetailsModal
 template={selectedTemplate}
 onClose={() => setSelectedTemplate(null)}
 onStatusChange={(status) => {
 handleStatusChange(
 `${selectedTemplate.kind}:${selectedTemplate.metadata.namespace || 'default'}/${selectedTemplate.metadata.name}`,
 status
 );
 setSelectedTemplate({ ...selectedTemplate, adminMetadata: { ...selectedTemplate.adminMetadata, status } });
 }}
 onVisibilityChange={(visibility) => {
 handleVisibilityChange(
 `${selectedTemplate.kind}:${selectedTemplate.metadata.namespace || 'default'}/${selectedTemplate.metadata.name}`,
 visibility
 );
 setSelectedTemplate({ ...selectedTemplate, adminMetadata: { ...selectedTemplate.adminMetadata, visibility } });
 }}
 />
 )}
 </div>
 );
};