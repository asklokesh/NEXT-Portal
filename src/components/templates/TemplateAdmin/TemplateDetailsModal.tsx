'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 X,
 Package,
 Shield,
 BarChart3,
 FileText,
 GitBranch,
 Clock,
 User,
 Globe,
 AlertTriangle,
 CheckCircle,
 XCircle,
 Activity,
 Download,
 Eye,
 Edit,
 Ban,
 Star,
 Calendar,
 Code,
 Settings,
 Zap
} from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';

import type { TemplateEntity } from '@/services/backstage/types/templates';

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

interface TemplateDetailsModalProps {
 template: AdminTemplate;
 onClose: () => void;
 onStatusChange: (status: AdminTemplate['adminMetadata']['status']) => void;
 onVisibilityChange: (visibility: AdminTemplate['adminMetadata']['visibility']) => void;
}

const MetricCard: React.FC<{
 title: string;
 value: string | number;
 icon: React.ComponentType<{ className?: string }>;
 color?: string;
 description?: string;
}> = ({ title, value, icon: Icon, color = 'text-primary', description }) => (
 <div className="bg-card rounded-lg border p-4">
 <div className="flex items-center gap-2 mb-2">
 <Icon className={cn('w-4 h-4', color)} />
 <span className="font-medium text-sm">{title}</span>
 </div>
 <div className="text-2xl font-bold mb-1">{value}</div>
 {description && (
 <div className="text-xs text-muted-foreground">{description}</div>
 )}
 </div>
);

const QualityIndicator: React.FC<{
 label: string;
 score: number;
}> = ({ label, score }) => (
 <div className="flex items-center justify-between">
 <span className="text-sm">{label}</span>
 <div className="flex items-center gap-2">
 <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
 <div 
 className={cn(
 'h-full transition-all',
 score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
 )}
 style={{ width: `${Math.min(score, 100)}%` }}
 />
 </div>
 <span className={cn(
 'text-sm font-medium w-8',
 score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'
 )}>
 {score}
 </span>
 </div>
 </div>
);

export const TemplateDetailsModal: React.FC<TemplateDetailsModalProps> = ({
 template,
 onClose,
 onStatusChange,
 onVisibilityChange,
}) => {
 const [activeTab, setActiveTab] = useState<'overview' | 'security' | 'quality' | 'usage' | 'history'>('overview');

 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 const successRate = template.adminMetadata.usageStats.totalExecutions > 0 
 ? (template.adminMetadata.usageStats.successfulExecutions / template.adminMetadata.usageStats.totalExecutions) * 100 
 : 0;

 return (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-background rounded-lg border w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between p-6 border-b">
 <div className="flex items-center gap-4">
 <div className="p-3 rounded-lg bg-primary/10">
 <Package className="w-6 h-6 text-primary" />
 </div>
 <div>
 <h2 className="text-xl font-semibold">
 {template.metadata.title || template.metadata.name}
 </h2>
 <p className="text-sm text-muted-foreground">
 {template.spec.type} template by {template.spec.owner}
 </p>
 </div>
 </div>
 
 <div className="flex items-center gap-2">
 <div className="flex items-center gap-2">
 <select
 value={template.adminMetadata.status}
 onChange={(e) => onStatusChange(e.target.value as any)}
 className="px-3 py-1 rounded border border-input bg-background text-sm"
 >
 <option value="approved">Approved</option>
 <option value="pending">Pending</option>
 <option value="rejected">Rejected</option>
 <option value="suspended">Suspended</option>
 </select>
 
 <select
 value={template.adminMetadata.visibility}
 onChange={(e) => onVisibilityChange(e.target.value as any)}
 className="px-3 py-1 rounded border border-input bg-background text-sm"
 >
 <option value="public">Public</option>
 <option value="private">Private</option>
 <option value="restricted">Restricted</option>
 </select>
 </div>
 
 <button
 onClick={onClose}
 className="p-2 rounded-md hover:bg-accent transition-colors"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 </div>

 {/* Navigation */}
 <div className="flex border-b">
 {[
 { id: 'overview', label: 'Overview', icon: FileText },
 { id: 'security', label: 'Security', icon: Shield },
 { id: 'quality', label: 'Quality', icon: BarChart3 },
 { id: 'usage', label: 'Usage', icon: Activity },
 { id: 'history', label: 'History', icon: Clock },
 ].map(tab => (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id as any)}
 className={cn(
 'flex items-center gap-1 px-4 py-3 text-sm transition-colors border-b-2',
 activeTab === tab.id
 ? 'border-primary text-primary bg-primary/5'
 : 'border-transparent text-muted-foreground hover:text-foreground'
 )}
 >
 <tab.icon className="w-4 h-4" />
 {tab.label}
 </button>
 ))}
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-6">
 {activeTab === 'overview' && (
 <div className="space-y-6">
 {/* Basic information */}
 <div>
 <h3 className="text-lg font-semibold mb-4">Template Information</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="space-y-3">
 <div>
 <label className="text-sm font-medium text-muted-foreground">Description</label>
 <p className="text-sm">{template.metadata.description || 'No description provided'}</p>
 </div>
 
 <div>
 <label className="text-sm font-medium text-muted-foreground">Owner</label>
 <p className="text-sm">{template.spec.owner}</p>
 </div>
 
 <div>
 <label className="text-sm font-medium text-muted-foreground">Type</label>
 <p className="text-sm capitalize">{template.spec.type}</p>
 </div>
 
 <div>
 <label className="text-sm font-medium text-muted-foreground">Namespace</label>
 <p className="text-sm">{template.metadata.namespace || 'default'}</p>
 </div>
 </div>
 
 <div className="space-y-3">
 <div>
 <label className="text-sm font-medium text-muted-foreground">Tags</label>
 <div className="flex flex-wrap gap-1 mt-1">
 {(template.metadata.tags || []).map(tag => (
 <span key={tag} className="px-2 py-1 rounded-full text-xs bg-secondary">
 {tag}
 </span>
 ))}
 {(!template.metadata.tags || template.metadata.tags.length === 0) && (
 <span className="text-sm text-muted-foreground">No tags</span>
 )}
 </div>
 </div>
 
 <div>
 <label className="text-sm font-medium text-muted-foreground">Parameters</label>
 <p className="text-sm">
 {(() => {
 const params = Array.isArray(template.spec.parameters) 
 ? template.spec.parameters[0] 
 : template.spec.parameters;
 return Object.keys(params.properties).length;
 })()} parameters
 </p>
 </div>
 
 <div>
 <label className="text-sm font-medium text-muted-foreground">Steps</label>
 <p className="text-sm">{template.spec.steps.length} steps</p>
 </div>
 
 <div>
 <label className="text-sm font-medium text-muted-foreground">Created</label>
 <p className="text-sm">
 {template.metadata.annotations?.['backstage.io/managed-by-origin-location'] 
 ? new Date(template.metadata.annotations['backstage.io/managed-by-origin-location']).toLocaleDateString()
 : 'Unknown'}
 </p>
 </div>
 </div>
 </div>
 </div>

 {/* Quick metrics */}
 <div>
 <h3 className="text-lg font-semibold mb-4">Quick Metrics</h3>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <MetricCard
 title="Total Uses"
 value={template.adminMetadata.usageStats.totalExecutions}
 icon={Activity}
 color="text-blue-600"
 />
 <MetricCard
 title="Success Rate"
 value={`${Math.round(successRate)}%`}
 icon={CheckCircle}
 color="text-green-600"
 />
 <MetricCard
 title="Security Score"
 value={template.adminMetadata.securityAnalysis.securityScore}
 icon={Shield}
 color={template.adminMetadata.securityAnalysis.securityScore >= 80 ? 'text-green-600' : 'text-yellow-600'}
 />
 <MetricCard
 title="Popularity"
 value={
 <div className="flex">
 {[1, 2, 3, 4, 5].map(i => (
 <Star
 key={i}
 className={cn(
 'w-4 h-4',
 i <= template.adminMetadata.usageStats.popularityScore
 ? 'text-yellow-500 fill-current'
 : 'text-gray-300'
 )}
 />
 ))}
 </div>
 }
 icon={Star}
 color="text-yellow-600"
 />
 </div>
 </div>
 </div>
 )}

 {activeTab === 'security' && (
 <div className="space-y-6">
 <div>
 <h3 className="text-lg font-semibold mb-4">Security Analysis</h3>
 
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
 <MetricCard
 title="Security Score"
 value={template.adminMetadata.securityAnalysis.securityScore}
 icon={Shield}
 color={template.adminMetadata.securityAnalysis.securityScore >= 80 ? 'text-green-600' : 'text-red-600'}
 description="Overall security rating"
 />
 <MetricCard
 title="Vulnerabilities"
 value={template.adminMetadata.securityAnalysis.vulnerabilities}
 icon={AlertTriangle}
 color="text-red-600"
 description="Known security issues"
 />
 <MetricCard
 title="Last Scan"
 value={new Date(template.adminMetadata.securityAnalysis.lastScanned).toLocaleDateString()}
 icon={Clock}
 description="Security scan date"
 />
 </div>

 {template.adminMetadata.securityAnalysis.issues.length > 0 ? (
 <div>
 <h4 className="font-medium mb-3">Security Issues</h4>
 <div className="space-y-2">
 {template.adminMetadata.securityAnalysis.issues.map((issue, index) => (
 <div
 key={index}
 className={cn(
 'p-3 rounded-lg border',
 issue.severity === 'high' && 'bg-red-50 border-red-200',
 issue.severity === 'medium' && 'bg-yellow-50 border-yellow-200',
 issue.severity === 'low' && 'bg-blue-50 border-blue-200'
 )}
 >
 <div className="flex items-center gap-2 mb-1">
 <AlertTriangle className={cn(
 'w-4 h-4',
 issue.severity === 'high' && 'text-red-600',
 issue.severity === 'medium' && 'text-yellow-600',
 issue.severity === 'low' && 'text-blue-600'
 )} />
 <span className="font-medium capitalize">{issue.severity} - {issue.type}</span>
 </div>
 <p className="text-sm">{issue.description}</p>
 </div>
 ))}
 </div>
 </div>
 ) : (
 <div className="text-center py-8">
 <Shield className="w-12 h-12 mx-auto mb-3 text-green-600" />
 <h4 className="font-medium text-green-600 mb-1">No Security Issues Found</h4>
 <p className="text-sm text-muted-foreground">This template passed all security checks</p>
 </div>
 )}
 </div>
 </div>
 )}

 {activeTab === 'quality' && (
 <div className="space-y-6">
 <div>
 <h3 className="text-lg font-semibold mb-4">Quality Metrics</h3>
 
 <div className="bg-card rounded-lg border p-6 space-y-4">
 <QualityIndicator
 label="Documentation"
 score={template.adminMetadata.qualityMetrics.documentation}
 />
 <QualityIndicator
 label="Test Coverage"
 score={template.adminMetadata.qualityMetrics.testCoverage}
 />
 <QualityIndicator
 label="Code Quality"
 score={template.adminMetadata.qualityMetrics.codeQuality}
 />
 <QualityIndicator
 label="Maintainability"
 score={template.adminMetadata.qualityMetrics.maintainability}
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="bg-card rounded-lg border p-4">
 <h4 className="font-medium mb-3">Template Structure</h4>
 <div className="space-y-2 text-sm">
 <div className="flex justify-between">
 <span>Parameters:</span>
 <span>{(() => {
 const params = Array.isArray(template.spec.parameters) 
 ? template.spec.parameters[0] 
 : template.spec.parameters;
 return Object.keys(params.properties).length;
 })()}</span>
 </div>
 <div className="flex justify-between">
 <span>Required Parameters:</span>
 <span>{(() => {
 const params = Array.isArray(template.spec.parameters) 
 ? template.spec.parameters[0] 
 : template.spec.parameters;
 return (params.required || []).length;
 })()}</span>
 </div>
 <div className="flex justify-between">
 <span>Steps:</span>
 <span>{template.spec.steps.length}</span>
 </div>
 <div className="flex justify-between">
 <span>Has Documentation:</span>
 <span>{template.metadata.description ? 'Yes' : 'No'}</span>
 </div>
 </div>
 </div>

 <div className="bg-card rounded-lg border p-4">
 <h4 className="font-medium mb-3">Template Features</h4>
 <div className="space-y-2 text-sm">
 <div className="flex items-center justify-between">
 <span>Git Publishing:</span>
 {template.spec.steps.some(step => step.action.includes('publish')) ? (
 <CheckCircle className="w-4 h-4 text-green-600" />
 ) : (
 <XCircle className="w-4 h-4 text-red-600" />
 )}
 </div>
 <div className="flex items-center justify-between">
 <span>Catalog Registration:</span>
 {template.spec.steps.some(step => step.action.includes('catalog:register')) ? (
 <CheckCircle className="w-4 h-4 text-green-600" />
 ) : (
 <XCircle className="w-4 h-4 text-red-600" />
 )}
 </div>
 <div className="flex items-center justify-between">
 <span>Advanced Fields:</span>
 {(() => {
 const params = Array.isArray(template.spec.parameters) 
 ? template.spec.parameters[0] 
 : template.spec.parameters;
 const hasAdvanced = Object.values(params.properties).some(prop => 
 prop['ui:field'] === 'EntityPicker' || 
 prop['ui:field'] === 'RepoUrlPicker'
 );
 return hasAdvanced ? (
 <CheckCircle className="w-4 h-4 text-green-600" />
 ) : (
 <XCircle className="w-4 h-4 text-red-600" />
 );
 })()}
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {activeTab === 'usage' && (
 <div className="space-y-6">
 <div>
 <h3 className="text-lg font-semibold mb-4">Usage Statistics</h3>
 
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
 <MetricCard
 title="Total Executions"
 value={template.adminMetadata.usageStats.totalExecutions}
 icon={Activity}
 color="text-blue-600"
 />
 <MetricCard
 title="Successful"
 value={template.adminMetadata.usageStats.successfulExecutions}
 icon={CheckCircle}
 color="text-green-600"
 />
 <MetricCard
 title="Failed"
 value={template.adminMetadata.usageStats.failedExecutions}
 icon={XCircle}
 color="text-red-600"
 />
 <MetricCard
 title="Avg. Time"
 value={`${Math.round(template.adminMetadata.usageStats.averageExecutionTime / 1000)}s`}
 icon={Clock}
 />
 </div>

 <div className="bg-card rounded-lg border p-6">
 <h4 className="font-medium mb-4">Performance Metrics</h4>
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <span>Success Rate</span>
 <div className="flex items-center gap-2">
 <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
 <div 
 className="h-full bg-green-500 transition-all"
 style={{ width: `${successRate}%` }}
 />
 </div>
 <span className="text-sm font-medium">{Math.round(successRate)}%</span>
 </div>
 </div>
 
 <div className="flex items-center justify-between">
 <span>Popularity Score</span>
 <div className="flex">
 {[1, 2, 3, 4, 5].map(i => (
 <Star
 key={i}
 className={cn(
 'w-4 h-4',
 i <= template.adminMetadata.usageStats.popularityScore
 ? 'text-yellow-500 fill-current'
 : 'text-gray-300'
 )}
 />
 ))}
 </div>
 </div>
 
 <div className="flex items-center justify-between">
 <span>Last Used</span>
 <span className="text-sm">
 {template.adminMetadata.usageStats.lastUsed 
 ? new Date(template.adminMetadata.usageStats.lastUsed).toLocaleDateString()
 : 'Never'
 }
 </span>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {activeTab === 'history' && (
 <div className="space-y-6">
 <div>
 <h3 className="text-lg font-semibold mb-4">Template History</h3>
 
 <div className="space-y-4">
 {/* Mock history events */}
 <div className="bg-card rounded-lg border p-4">
 <div className="flex items-start gap-3">
 <div className="p-2 rounded-full bg-green-100">
 <CheckCircle className="w-4 h-4 text-green-600" />
 </div>
 <div className="flex-1">
 <h4 className="font-medium">Template Approved</h4>
 <p className="text-sm text-muted-foreground">
 Approved by {template.adminMetadata.approvedBy} on{' '}
 {template.adminMetadata.approvedAt 
 ? new Date(template.adminMetadata.approvedAt).toLocaleDateString()
 : 'Unknown date'
 }
 </p>
 </div>
 <span className="text-xs text-muted-foreground">
 {template.adminMetadata.approvedAt 
 ? new Date(template.adminMetadata.approvedAt).toLocaleDateString()
 : 'Unknown'
 }
 </span>
 </div>
 </div>
 
 <div className="bg-card rounded-lg border p-4">
 <div className="flex items-start gap-3">
 <div className="p-2 rounded-full bg-blue-100">
 <Shield className="w-4 h-4 text-blue-600" />
 </div>
 <div className="flex-1">
 <h4 className="font-medium">Security Scan Completed</h4>
 <p className="text-sm text-muted-foreground">
 Security analysis completed with score: {template.adminMetadata.securityAnalysis.securityScore}
 </p>
 </div>
 <span className="text-xs text-muted-foreground">
 {new Date(template.adminMetadata.securityAnalysis.lastScanned).toLocaleDateString()}
 </span>
 </div>
 </div>
 
 <div className="bg-card rounded-lg border p-4">
 <div className="flex items-start gap-3">
 <div className="p-2 rounded-full bg-purple-100">
 <Package className="w-4 h-4 text-purple-600" />
 </div>
 <div className="flex-1">
 <h4 className="font-medium">Template Created</h4>
 <p className="text-sm text-muted-foreground">
 Template was created and submitted for review
 </p>
 </div>
 <span className="text-xs text-muted-foreground">
 {template.metadata.annotations?.['backstage.io/managed-by-origin-location'] 
 ? new Date(template.metadata.annotations['backstage.io/managed-by-origin-location']).toLocaleDateString()
 : 'Unknown'
 }
 </span>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="flex items-center justify-between p-6 border-t bg-muted/30">
 <div className="text-sm text-muted-foreground">
 Template ID: {templateRef}
 </div>
 
 <div className="flex items-center gap-2">
 <button className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-accent">
 <Download className="w-4 h-4" />
 Export
 </button>
 <button className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-accent">
 <Edit className="w-4 h-4" />
 Edit
 </button>
 <button className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
 <Eye className="w-4 h-4" />
 View Template
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};