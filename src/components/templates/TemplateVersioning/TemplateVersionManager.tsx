'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 GitBranch,
 Clock,
 Tag,
 ArrowUpDown,
 Download,
 Eye,
 Edit,
 Copy,
 Trash2,
 Plus,
 CheckCircle,
 AlertTriangle,
 XCircle,
 MoreVertical,
 Calendar,
 User,
 FileText,
 Zap,
 History,
 ArrowRight,
 GitCommit,
 Package
} from 'lucide-react';
import React, { useState, useMemo } from 'react';

import { cn } from '@/lib/utils';

import type { TemplateEntity } from '@/services/backstage/types/templates';

interface TemplateVersion {
 version: string;
 templateRef: string;
 template: TemplateEntity;
 createdAt: string;
 createdBy: string;
 status: 'draft' | 'published' | 'deprecated' | 'archived';
 changeLog: string;
 isLatest: boolean;
 downloadCount: number;
 tags: string[];
 breaking: boolean;
 deprecated?: {
 reason: string;
 replacement?: string;
 deprecatedAt: string;
 };
}

interface TemplateVersionManagerProps {
 templateRef: string;
 className?: string;
}

interface VersionComparisonProps {
 fromVersion: TemplateVersion;
 toVersion: TemplateVersion;
 onClose: () => void;
}

const VERSION_STATUS_CONFIG = {
 draft: {
 color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
 icon: Edit,
 label: 'Draft',
 },
 published: {
 color: 'bg-green-100 text-green-800 border-green-200',
 icon: CheckCircle,
 label: 'Published',
 },
 deprecated: {
 color: 'bg-orange-100 text-orange-800 border-orange-200',
 icon: AlertTriangle,
 label: 'Deprecated',
 },
 archived: {
 color: 'bg-gray-100 text-gray-800 border-gray-200',
 icon: XCircle,
 label: 'Archived',
 },
};

const VersionComparison: React.FC<VersionComparisonProps> = ({
 fromVersion,
 toVersion,
 onClose,
}) => {
 const changes = useMemo(() => {
 // Mock change calculation - in real implementation, this would use a diff algorithm
 const fromParams = Array.isArray(fromVersion.template.spec.parameters)
 ? fromVersion.template.spec.parameters[0]
 : fromVersion.template.spec.parameters;
 const toParams = Array.isArray(toVersion.template.spec.parameters)
 ? toVersion.template.spec.parameters[0]
 : toVersion.template.spec.parameters;

 const fromParamKeys = Object.keys(fromParams.properties);
 const toParamKeys = Object.keys(toParams.properties);

 const added = toParamKeys.filter(key => !fromParamKeys.includes(key));
 const removed = fromParamKeys.filter(key => !toParamKeys.includes(key));
 const modified = toParamKeys.filter(key => 
 fromParamKeys.includes(key) && 
 JSON.stringify(fromParams.properties[key]) !== JSON.stringify(toParams.properties[key])
 );

 const stepChanges = {
 added: toVersion.template.spec.steps.length - fromVersion.template.spec.steps.length,
 modified: Math.floor(Math.random() * 3), // Mock
 };

 return {
 parameters: { added, removed, modified },
 steps: stepChanges,
 description: fromVersion.template.metadata.description !== toVersion.template.metadata.description,
 };
 }, [fromVersion, toVersion]);

 return (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-background rounded-lg border w-full max-w-4xl max-h-[80vh] overflow-y-auto">
 <div className="flex items-center justify-between p-6 border-b">
 <div>
 <h2 className="text-xl font-semibold">Version Comparison</h2>
 <p className="text-sm text-muted-foreground">
 Comparing {fromVersion.version} {toVersion.version}
 </p>
 </div>
 <button
 onClick={onClose}
 className="p-2 rounded-md hover:bg-accent transition-colors"
 >
 <XCircle className="w-5 h-5" />
 </button>
 </div>

 <div className="p-6 space-y-6">
 {/* Version headers */}
 <div className="grid grid-cols-2 gap-6">
 <div className="space-y-2">
 <h3 className="font-medium">From: {fromVersion.version}</h3>
 <div className="text-sm text-muted-foreground">
 <p>Released: {new Date(fromVersion.createdAt).toLocaleDateString()}</p>
 <p>By: {fromVersion.createdBy}</p>
 </div>
 </div>
 <div className="space-y-2">
 <h3 className="font-medium">To: {toVersion.version}</h3>
 <div className="text-sm text-muted-foreground">
 <p>Released: {new Date(toVersion.createdAt).toLocaleDateString()}</p>
 <p>By: {toVersion.createdBy}</p>
 </div>
 </div>
 </div>

 {/* Changes summary */}
 <div className="bg-muted/30 rounded-lg p-4">
 <h4 className="font-medium mb-3">Summary of Changes</h4>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
 <div>
 <span className="font-medium">Parameters:</span>
 <div className="mt-1 space-y-1">
 {changes.parameters.added.length > 0 && (
 <div className="text-green-600">+{changes.parameters.added.length} added</div>
 )}
 {changes.parameters.removed.length > 0 && (
 <div className="text-red-600">-{changes.parameters.removed.length} removed</div>
 )}
 {changes.parameters.modified.length > 0 && (
 <div className="text-blue-600">{changes.parameters.modified.length} modified</div>
 )}
 </div>
 </div>
 
 <div>
 <span className="font-medium">Steps:</span>
 <div className="mt-1 space-y-1">
 {changes.steps.added > 0 && (
 <div className="text-green-600">+{changes.steps.added} added</div>
 )}
 {changes.steps.modified > 0 && (
 <div className="text-blue-600">{changes.steps.modified} modified</div>
 )}
 </div>
 </div>

 <div>
 <span className="font-medium">Metadata:</span>
 <div className="mt-1 space-y-1">
 {changes.description && (
 <div className="text-blue-600">Description updated</div>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* Detailed changes */}
 {changes.parameters.added.length > 0 && (
 <div>
 <h4 className="font-medium text-green-600 mb-2">Added Parameters</h4>
 <div className="space-y-2">
 {changes.parameters.added.map(param => (
 <div key={param} className="flex items-center gap-2 text-sm">
 <Plus className="w-4 h-4 text-green-600" />
 <code className="px-2 py-1 rounded bg-green-50 text-green-800">{param}</code>
 </div>
 ))}
 </div>
 </div>
 )}

 {changes.parameters.removed.length > 0 && (
 <div>
 <h4 className="font-medium text-red-600 mb-2">Removed Parameters</h4>
 <div className="space-y-2">
 {changes.parameters.removed.map(param => (
 <div key={param} className="flex items-center gap-2 text-sm">
 <Trash2 className="w-4 h-4 text-red-600" />
 <code className="px-2 py-1 rounded bg-red-50 text-red-800 line-through">{param}</code>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Changelog */}
 <div>
 <h4 className="font-medium mb-2">Changelog</h4>
 <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap">
 {toVersion.changeLog || 'No changelog provided for this version.'}
 </div>
 </div>
 </div>
 </div>
 </div>
 );
};

const VersionCard: React.FC<{
 version: TemplateVersion;
 onCompare: (version: TemplateVersion) => void;
 onView: (version: TemplateVersion) => void;
 onDownload: (version: TemplateVersion) => void;
}> = ({ version, onCompare, onView, onDownload }) => {
 const [showMenu, setShowMenu] = useState(false);
 const statusConfig = VERSION_STATUS_CONFIG[version.status];
 const StatusIcon = statusConfig.icon;

 return (
 <div className="bg-card rounded-lg border p-4 hover:shadow-md transition-shadow">
 <div className="flex items-start justify-between mb-3">
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-2">
 <Tag className="w-4 h-4 text-muted-foreground" />
 <span className="font-semibold text-lg">{version.version}</span>
 {version.isLatest && (
 <span className="px-2 py-0.5 rounded-full text-xs bg-primary text-primary-foreground">
 Latest
 </span>
 )}
 {version.breaking && (
 <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 border border-red-200">
 Breaking
 </span>
 )}
 </div>
 </div>

 <div className="flex items-center gap-2">
 <div className={cn(
 'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border',
 statusConfig.color
 )}>
 <StatusIcon className="w-3 h-3" />
 {statusConfig.label}
 </div>

 <div className="relative">
 <button
 onClick={() => setShowMenu(!showMenu)}
 className="p-1 rounded hover:bg-accent transition-colors"
 >
 <MoreVertical className="w-4 h-4" />
 </button>

 {showMenu && (
 <div className="absolute right-0 top-full mt-1 w-40 rounded-md shadow-lg bg-popover border border-border z-10">
 <div className="py-1">
 <button
 onClick={() => {
 onView(version);
 setShowMenu(false);
 }}
 className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
 >
 <Eye className="w-4 h-4" />
 View Details
 </button>
 <button
 onClick={() => {
 onCompare(version);
 setShowMenu(false);
 }}
 className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
 >
 <ArrowUpDown className="w-4 h-4" />
 Compare
 </button>
 <button
 onClick={() => {
 onDownload(version);
 setShowMenu(false);
 }}
 className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
 >
 <Download className="w-4 h-4" />
 Download
 </button>
 <div className="border-t border-border my-1" />
 <button className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground">
 <Copy className="w-4 h-4" />
 Clone
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 <div className="space-y-2 text-sm">
 <div className="flex items-center gap-2 text-muted-foreground">
 <Calendar className="w-4 h-4" />
 <span>Released {new Date(version.createdAt).toLocaleDateString()}</span>
 </div>

 <div className="flex items-center gap-2 text-muted-foreground">
 <User className="w-4 h-4" />
 <span>By {version.createdBy}</span>
 </div>

 <div className="flex items-center gap-2 text-muted-foreground">
 <Download className="w-4 h-4" />
 <span>{version.downloadCount.toLocaleString()} downloads</span>
 </div>
 </div>

 {version.changeLog && (
 <div className="mt-3 p-3 bg-muted/30 rounded text-sm">
 <div className="font-medium mb-1">Changelog:</div>
 <div className="text-muted-foreground line-clamp-2">
 {version.changeLog}
 </div>
 </div>
 )}

 {version.deprecated && (
 <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded text-sm">
 <div className="flex items-center gap-2 font-medium text-orange-800 mb-1">
 <AlertTriangle className="w-4 h-4" />
 Deprecated
 </div>
 <div className="text-orange-700">
 {version.deprecated.reason}
 {version.deprecated.replacement && (
 <div className="mt-1">
 Use <code className="px-1 py-0.5 bg-orange-100 rounded">{version.deprecated.replacement}</code> instead
 </div>
 )}
 </div>
 </div>
 )}

 {version.tags.length > 0 && (
 <div className="mt-3 flex flex-wrap gap-1">
 {version.tags.map(tag => (
 <span
 key={tag}
 className="px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground"
 >
 {tag}
 </span>
 ))}
 </div>
 )}
 </div>
 );
};

export const TemplateVersionManager: React.FC<TemplateVersionManagerProps> = ({
 templateRef,
 className,
}) => {
 const [sortBy, setSortBy] = useState<'version' | 'date' | 'downloads'>('date');
 const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft' | 'deprecated'>('all');
 const [compareVersion, setCompareVersion] = useState<TemplateVersion | null>(null);
 const [showComparison, setShowComparison] = useState(false);

 // Mock version data - in real implementation, fetch from API
 const versions: TemplateVersion[] = useMemo(() => [
 {
 version: '2.1.0',
 templateRef,
 template: {} as TemplateEntity, // Would be populated with actual template data
 createdAt: '2024-01-20T10:00:00Z',
 createdBy: 'platform-team',
 status: 'published',
 changeLog: 'Added support for custom domain configuration\nImproved error handling in deployment steps\nUpdated documentation',
 isLatest: true,
 downloadCount: 245,
 tags: ['stable', 'recommended'],
 breaking: false,
 },
 {
 version: '2.0.0',
 templateRef,
 template: {} as TemplateEntity,
 createdAt: '2024-01-15T14:30:00Z',
 createdBy: 'platform-team',
 status: 'published',
 changeLog: 'Major update with breaking changes\nMigrated to new scaffolder API\nRestructured parameter schema\nAdded new deployment options',
 isLatest: false,
 downloadCount: 512,
 tags: ['major', 'breaking'],
 breaking: true,
 },
 {
 version: '1.9.2',
 templateRef,
 template: {} as TemplateEntity,
 createdAt: '2024-01-10T09:15:00Z',
 createdBy: 'dev-team',
 status: 'deprecated',
 changeLog: 'Security patch for dependency vulnerabilities\nBug fixes in template generation',
 isLatest: false,
 downloadCount: 1203,
 tags: ['security', 'patch'],
 breaking: false,
 deprecated: {
 reason: 'Superseded by v2.0.0 with improved architecture',
 replacement: '2.0.0',
 deprecatedAt: '2024-01-15T14:30:00Z',
 },
 },
 {
 version: '1.9.1',
 templateRef,
 template: {} as TemplateEntity,
 createdAt: '2024-01-05T16:45:00Z',
 createdBy: 'dev-team',
 status: 'archived',
 changeLog: 'Minor bug fixes and improvements',
 isLatest: false,
 downloadCount: 89,
 tags: ['patch'],
 breaking: false,
 },
 {
 version: '2.2.0-beta.1',
 templateRef,
 template: {} as TemplateEntity,
 createdAt: '2024-01-25T11:20:00Z',
 createdBy: 'platform-team',
 status: 'draft',
 changeLog: 'Beta release with experimental features\nNew parameter validation system\nEnhanced error reporting',
 isLatest: false,
 downloadCount: 23,
 tags: ['beta', 'experimental'],
 breaking: false,
 },
 ], [templateRef]);

 const filteredVersions = useMemo(() => {
 let filtered = [...versions];

 // Apply status filter
 if (filterStatus !== 'all') {
 filtered = filtered.filter(v => v.status === filterStatus);
 }

 // Apply sorting
 switch (sortBy) {
 case 'version':
 filtered.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
 break;
 case 'date':
 filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
 break;
 case 'downloads':
 filtered.sort((a, b) => b.downloadCount - a.downloadCount);
 break;
 }

 return filtered;
 }, [versions, sortBy, filterStatus]);

 const handleCompare = (version: TemplateVersion) => {
 if (compareVersion) {
 setShowComparison(true);
 } else {
 setCompareVersion(version);
 }
 };

 const handleView = (version: TemplateVersion) => {
 console.log('View version:', version.version);
 };

 const handleDownload = (version: TemplateVersion) => {
 console.log('Download version:', version.version);
 };

 return (
 <div className={cn('space-y-6', className)}>
 {/* Header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <GitBranch className="w-6 h-6 text-primary" />
 <div>
 <h2 className="text-2xl font-bold">Template Versions</h2>
 <p className="text-sm text-muted-foreground">
 Manage and track template versions over time
 </p>
 </div>
 </div>

 <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
 <Plus className="w-4 h-4" />
 Create Version
 </button>
 </div>

 {/* Filters and sorting */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div>
 <label className="text-sm font-medium">Status:</label>
 <select
 value={filterStatus}
 onChange={(e) => setFilterStatus(e.target.value as any)}
 className="ml-2 px-3 py-1 rounded border border-input bg-background text-sm"
 >
 <option value="all">All Statuses</option>
 <option value="published">Published</option>
 <option value="draft">Draft</option>
 <option value="deprecated">Deprecated</option>
 </select>
 </div>

 <div>
 <label className="text-sm font-medium">Sort by:</label>
 <select
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value as any)}
 className="ml-2 px-3 py-1 rounded border border-input bg-background text-sm"
 >
 <option value="date">Release Date</option>
 <option value="version">Version Number</option>
 <option value="downloads">Downloads</option>
 </select>
 </div>
 </div>

 {compareVersion && (
 <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
 <GitCommit className="w-4 h-4 text-blue-600" />
 <span className="text-sm text-blue-800">
 Comparing from {compareVersion.version}
 </span>
 <button
 onClick={() => setCompareVersion(null)}
 className="text-blue-600 hover:text-blue-800"
 >
 <XCircle className="w-4 h-4" />
 </button>
 </div>
 )}
 </div>

 {/* Version statistics */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <div className="bg-card rounded-lg border p-4">
 <div className="flex items-center gap-2 mb-2">
 <Package className="w-5 h-5 text-primary" />
 <span className="font-medium">Total Versions</span>
 </div>
 <div className="text-2xl font-bold">{versions.length}</div>
 </div>

 <div className="bg-card rounded-lg border p-4">
 <div className="flex items-center gap-2 mb-2">
 <CheckCircle className="w-5 h-5 text-green-600" />
 <span className="font-medium">Published</span>
 </div>
 <div className="text-2xl font-bold">
 {versions.filter(v => v.status === 'published').length}
 </div>
 </div>

 <div className="bg-card rounded-lg border p-4">
 <div className="flex items-center gap-2 mb-2">
 <Download className="w-5 h-5 text-blue-600" />
 <span className="font-medium">Total Downloads</span>
 </div>
 <div className="text-2xl font-bold">
 {versions.reduce((sum, v) => sum + v.downloadCount, 0).toLocaleString()}
 </div>
 </div>

 <div className="bg-card rounded-lg border p-4">
 <div className="flex items-center gap-2 mb-2">
 <History className="w-5 h-5 text-purple-600" />
 <span className="font-medium">Latest Version</span>
 </div>
 <div className="text-2xl font-bold">
 {versions.find(v => v.isLatest)?.version || 'N/A'}
 </div>
 </div>
 </div>

 {/* Version list */}
 <div className="space-y-4">
 {filteredVersions.map((version) => (
 <VersionCard
 key={version.version}
 version={version}
 onCompare={handleCompare}
 onView={handleView}
 onDownload={handleDownload}
 />
 ))}
 </div>

 {filteredVersions.length === 0 && (
 <div className="text-center py-12">
 <GitBranch className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
 <h3 className="text-lg font-semibold mb-2">No versions found</h3>
 <p className="text-muted-foreground">
 No versions match the current filters.
 </p>
 </div>
 )}

 {/* Version comparison modal */}
 {showComparison && compareVersion && (
 <VersionComparison
 fromVersion={compareVersion}
 toVersion={filteredVersions.find(v => v.version !== compareVersion.version) || filteredVersions[0]}
 onClose={() => {
 setShowComparison(false);
 setCompareVersion(null);
 }}
 />
 )}
 </div>
 );
};