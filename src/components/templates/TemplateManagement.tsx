'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 Plus,
 Search,
 Filter,
 LayoutGrid,
 List,
 GitBranch,
 Settings,
 Download,
 Upload,
 FileText,
 Package,
 BarChart3,
 Shield,
 Users,
 Clock,
 ChevronRight,
 Star,
 TrendingUp,
 AlertCircle,
 CheckCircle,
 XCircle,
 MoreVertical,
 Eye,
 Edit,
 Copy,
 Trash2,
 Play,
 ArrowLeft
} from 'lucide-react';
import React, { useState, useCallback } from 'react';

import { cn } from '@/lib/utils';

import { FileEditor } from './TemplateBuilder/FileEditor';
import { ParameterBuilder } from './TemplateBuilder/ParameterBuilder';
import { StepWizard } from './TemplateBuilder/StepWizard';
import { TemplateGrid } from './TemplateMarketplace/TemplateGrid';
import { LivePreview } from './TemplatePreview/LivePreview';
import { TemplateListItem} from './types';

import type { Template, EditorFile } from './types';

interface TemplateManagementProps {
 className?: string;
}

type ViewMode = 'list' | 'grid' | 'builder' | 'preview' | 'analytics';

interface TemplateStats {
 total: number;
 published: number;
 draft: number;
 archived: number;
 totalUsage: number;
 weeklyGrowth: number;
}

// Mock data for templates
const MOCK_TEMPLATES: TemplateListItem[] = [
 {
 id: 'nodejs-service',
 metadata: {
 name: 'nodejs-service',
 title: 'Node.js Microservice',
 description: 'Production-ready Node.js microservice with Express, TypeScript, and Docker',
 category: 'service',
 tags: ['nodejs', 'typescript', 'microservice', 'docker'],
 author: 'backstage',
 createdAt: '2024-01-15T10:00:00Z',
 updatedAt: '2024-01-20T15:30:00Z',
 },
 status: 'published',
 version: '1.2.0',
 owner: {
 name: 'Platform Team',
 email: 'platform@company.com',
 },
 stats: {
 downloads: 1250,
 stars: 45,
 forks: 12,
 rating: 4.8,
 },
 },
 {
 id: 'react-webapp',
 metadata: {
 name: 'react-webapp',
 title: 'React Web Application',
 description: 'Modern React application with TypeScript, Vite, and TailwindCSS',
 category: 'website',
 tags: ['react', 'typescript', 'vite', 'tailwindcss'],
 author: 'frontend-team',
 createdAt: '2024-01-10T09:00:00Z',
 updatedAt: '2024-01-18T14:20:00Z',
 },
 status: 'published',
 version: '2.0.0',
 owner: {
 name: 'Frontend Team',
 email: 'frontend@company.com',
 },
 stats: {
 downloads: 2100,
 stars: 67,
 forks: 23,
 rating: 4.9,
 },
 },
 {
 id: 'python-api',
 metadata: {
 name: 'python-api',
 title: 'Python REST API',
 description: 'FastAPI service with async support, OpenAPI docs, and PostgreSQL',
 category: 'service',
 tags: ['python', 'fastapi', 'postgresql', 'async'],
 author: 'backend-team',
 createdAt: '2024-01-05T11:00:00Z',
 updatedAt: '2024-01-22T16:45:00Z',
 },
 status: 'draft',
 version: '0.9.0',
 owner: {
 name: 'Backend Team',
 email: 'backend@company.com',
 },
 stats: {
 downloads: 0,
 stars: 12,
 forks: 3,
 rating: 0,
 },
 },
];

// Template list item component
const TemplateListItem: React.FC<{
 template: TemplateListItem;
 onView: () => void;
 onEdit: () => void;
 onDelete: () => void;
}> = ({ template, onView, onEdit, onDelete }) => {
 const [showMenu, setShowMenu] = useState(false);

 const statusColors = {
 published: 'text-green-600 bg-green-50',
 draft: 'text-yellow-600 bg-yellow-50',
 archived: 'text-gray-600 bg-gray-50',
 };

 const statusIcons = {
 published: CheckCircle,
 draft: AlertCircle,
 archived: XCircle,
 };

 const StatusIcon = statusIcons[template.status];

 return (
 <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
 <div className="flex items-center gap-4 flex-1">
 <div className="p-2 rounded-lg bg-primary/10">
 <Package className="w-5 h-5 text-primary" />
 </div>
 
 <div className="flex-1">
 <div className="flex items-center gap-2">
 <h3 className="font-medium">{template.metadata.title}</h3>
 <span className="text-sm text-muted-foreground">v{template.version}</span>
 {template.metadata.author === 'backstage' && (
 <Shield className="w-4 h-4 text-primary" />
 )}
 </div>
 <p className="text-sm text-muted-foreground line-clamp-1">
 {template.metadata.description}
 </p>
 <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
 <span>{template.owner.name}</span>
 <span>•</span>
 <span>Updated {new Date(template.metadata.updatedAt || '').toLocaleDateString()}</span>
 </div>
 </div>
 </div>

 <div className="flex items-center gap-6">
 {/* Stats */}
 <div className="flex items-center gap-4 text-sm text-muted-foreground">
 <div className="flex items-center gap-1">
 <Download className="w-4 h-4" />
 <span>{template.stats.downloads.toLocaleString()}</span>
 </div>
 <div className="flex items-center gap-1">
 <Star className="w-4 h-4" />
 <span>{template.stats.stars}</span>
 </div>
 </div>

 {/* Status */}
 <div className={cn(
 'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
 statusColors[template.status]
 )}>
 <StatusIcon className="w-3 h-3" />
 <span className="capitalize">{template.status}</span>
 </div>

 {/* Actions */}
 <div className="relative">
 <button
 onClick={() => setShowMenu(!showMenu)}
 className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground"
 >
 <MoreVertical className="w-4 h-4" />
 </button>
 
 {showMenu && (
 <div className="absolute right-0 top-full mt-1 w-48 rounded-md shadow-lg bg-popover border border-border z-10">
 <div className="py-1">
 <button
 onClick={() => {
 onView();
 setShowMenu(false);
 }}
 className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
 >
 <Eye className="w-4 h-4" />
 View Details
 </button>
 <button
 onClick={() => {
 onEdit();
 setShowMenu(false);
 }}
 className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
 >
 <Edit className="w-4 h-4" />
 Edit Template
 </button>
 <button
 onClick={() => {
 // Handle duplicate
 setShowMenu(false);
 }}
 className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
 >
 <Copy className="w-4 h-4" />
 Duplicate
 </button>
 <div className="border-t border-border my-1" />
 <button
 onClick={() => {
 onDelete();
 setShowMenu(false);
 }}
 className="flex items-center gap-2 w-full px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
 >
 <Trash2 className="w-4 h-4" />
 Delete
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
};

// Stats card component
const StatsCard: React.FC<{
 title: string;
 value: string | number;
 change?: number;
 icon: React.ReactNode;
}> = ({ title, value, change, icon }) => {
 return (
 <div className="p-6 rounded-lg border bg-card">
 <div className="flex items-center justify-between mb-4">
 <span className="text-sm text-muted-foreground">{title}</span>
 {icon}
 </div>
 <div className="space-y-1">
 <p className="text-2xl font-bold">{value}</p>
 {change !== undefined && (
 <p className={cn(
 'text-sm flex items-center gap-1',
 change >= 0 ? 'text-green-600' : 'text-red-600'
 )}>
 <TrendingUp className="w-4 h-4" />
 {change >= 0 ? '+' : ''}{change}% from last week
 </p>
 )}
 </div>
 </div>
 );
};

// Main template management component
export const TemplateManagement: React.FC<TemplateManagementProps> = ({
 className,
}) => {
 const [viewMode, setViewMode] = useState<ViewMode>('list');
 const [selectedTemplate, setSelectedTemplate] = useState<Partial<Template> | null>(null);
 const [searchTerm, setSearchTerm] = useState('');
 const [filterStatus, setFilterStatus] = useState<string>('all');
 const [templates, setTemplates] = useState<TemplateListItem[]>(MOCK_TEMPLATES);
 const [testParameters, setTestParameters] = useState<Record<string, any>>({});

 // Mock stats
 const stats: TemplateStats = {
 total: templates.length,
 published: templates.filter(t => t.status === 'published').length,
 draft: templates.filter(t => t.status === 'draft').length,
 archived: templates.filter(t => t.status === 'archived').length,
 totalUsage: templates.reduce((sum, t) => sum + t.stats.downloads, 0),
 weeklyGrowth: 12.5,
 };

 // Handlers
 const handleCreateTemplate = () => {
 setSelectedTemplate({
 metadata: {
 name: '',
 title: '',
 description: '',
 tags: [],
 category: '',
 },
 spec: {
 owner: '',
 type: 'service',
 parameters: [],
 steps: [],
 },
 });
 setViewMode('builder');
 };

 const handleEditTemplate = (template: TemplateListItem) => {
 // In real app, would fetch full template data
 setSelectedTemplate({
 id: template.id,
 metadata: template.metadata,
 spec: {
 owner: template.owner.email,
 type: 'service',
 parameters: [
 {
 title: 'Basic Information',
 required: ['name', 'description'],
 properties: {
 name: {
 title: 'Name',
 type: 'string',
 description: 'Unique name of the component',
 },
 description: {
 title: 'Description',
 type: 'string',
 description: 'Help others understand what this is for',
 },
 },
 },
 ],
 steps: [],
 },
 });
 setViewMode('builder');
 };

 const handleTemplateChange = (template: Partial<Template>) => {
 setSelectedTemplate(template);
 };

 const handleSaveTemplate = async () => {
 // Mock save
 console.log('Saving template:', selectedTemplate);
 await new Promise(resolve => setTimeout(resolve, 1000));
 };

 const handlePreviewTemplate = () => {
 setViewMode('preview');
 };

 // Filtered templates
 const filteredTemplates = templates.filter(template => {
 const matchesSearch = searchTerm === '' || 
 template.metadata.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
 template.metadata.description?.toLowerCase().includes(searchTerm.toLowerCase());
 
 const matchesStatus = filterStatus === 'all' || template.status === filterStatus;
 
 return matchesSearch && matchesStatus;
 });

 // Render builder view
 if (viewMode === 'builder' && selectedTemplate) {
 return (
 <div className={cn('h-full flex flex-col', className)}>
 <StepWizard
 template={selectedTemplate}
 onTemplateChange={handleTemplateChange}
 onSave={handleSaveTemplate}
 onPreview={handlePreviewTemplate}
 onTest={() => setViewMode('preview')}
 />
 <div className="p-4 border-t border-border">
 <button
 onClick={() => {
 setViewMode('list');
 setSelectedTemplate(null);
 }}
 className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Templates
 </button>
 </div>
 </div>
 );
 }

 // Render preview view
 if (viewMode === 'preview' && selectedTemplate) {
 return (
 <div className={cn('h-full flex flex-col', className)}>
 <div className="flex items-center justify-between p-4 border-b border-border">
 <h2 className="text-xl font-bold">Template Preview</h2>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setViewMode('builder')}
 className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-accent hover:text-accent-foreground"
 >
 <Edit className="w-4 h-4" />
 Edit Template
 </button>
 <button
 onClick={() => {
 setViewMode('list');
 setSelectedTemplate(null);
 }}
 className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-accent hover:text-accent-foreground"
 >
 <ArrowLeft className="w-4 h-4" />
 Back
 </button>
 </div>
 </div>
 <div className="flex-1">
 <LivePreview
 template={selectedTemplate}
 parameters={testParameters}
 onParameterChange={setTestParameters}
 />
 </div>
 </div>
 );
 }

 // Render analytics view
 if (viewMode === 'analytics') {
 return (
 <div className={cn('p-6 space-y-6', className)}>
 <div className="flex items-center justify-between">
 <h2 className="text-2xl font-bold">Template Analytics</h2>
 <button
 onClick={() => setViewMode('list')}
 className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Templates
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <StatsCard
 title="Total Templates"
 value={stats.total}
 icon={<Package className="w-5 h-5 text-muted-foreground" />}
 />
 <StatsCard
 title="Published"
 value={stats.published}
 change={stats.weeklyGrowth}
 icon={<CheckCircle className="w-5 h-5 text-green-600" />}
 />
 <StatsCard
 title="Total Usage"
 value={stats.totalUsage.toLocaleString()}
 change={23.5}
 icon={<Download className="w-5 h-5 text-blue-600" />}
 />
 <StatsCard
 title="Active Users"
 value="245"
 change={8.2}
 icon={<Users className="w-5 h-5 text-purple-600" />}
 />
 </div>

 {/* Additional analytics content would go here */}
 </div>
 );
 }

 // Render list/grid view
 return (
 <div className={cn('flex flex-col h-full', className)}>
 {/* Header */}
 <div className="p-6 border-b border-border">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-2xl font-bold">Template Management</h1>
 <p className="text-sm text-muted-foreground mt-1">
 Create and manage software templates for your organization
 </p>
 </div>
 
 <button
 onClick={handleCreateTemplate}
 className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
 >
 <Plus className="w-4 h-4" />
 Create Template
 </button>
 </div>

 {/* Search and filters */}
 <div className="flex items-center gap-4">
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
 <input
 type="text"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 placeholder="Search templates..."
 className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background"
 />
 </div>

 <select
 value={filterStatus}
 onChange={(e) => setFilterStatus(e.target.value)}
 className="px-4 py-2 rounded-md border border-input bg-background"
 >
 <option value="all">All Status</option>
 <option value="published">Published</option>
 <option value="draft">Draft</option>
 <option value="archived">Archived</option>
 </select>

 <div className="flex items-center rounded-md border border-input">
 <button
 onClick={() => setViewMode('list')}
 className={cn(
 'p-2 transition-colors',
 viewMode === 'list' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'
 )}
 >
 <List className="w-4 h-4" />
 </button>
 <button
 onClick={() => setViewMode('grid')}
 className={cn(
 'p-2 transition-colors',
 viewMode === 'grid' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'
 )}
 >
 <LayoutGrid className="w-4 h-4" />
 </button>
 </div>

 <button
 onClick={() => setViewMode('analytics')}
 className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-accent hover:text-accent-foreground"
 >
 <BarChart3 className="w-4 h-4" />
 Analytics
 </button>
 </div>
 </div>

 {/* Quick stats */}
 <div className="flex items-center gap-6 px-6 py-3 bg-muted/50 text-sm">
 <span className="text-muted-foreground">
 {filteredTemplates.length} templates
 </span>
 <div className="flex items-center gap-4">
 <span className="flex items-center gap-1">
 <div className="w-2 h-2 rounded-full bg-green-600" />
 {stats.published} Published
 </span>
 <span className="flex items-center gap-1">
 <div className="w-2 h-2 rounded-full bg-yellow-600" />
 {stats.draft} Draft
 </span>
 <span className="flex items-center gap-1">
 <div className="w-2 h-2 rounded-full bg-gray-600" />
 {stats.archived} Archived
 </span>
 </div>
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto">
 {viewMode === 'list' ? (
 <div className="divide-y divide-border">
 {filteredTemplates.map((template) => (
 <TemplateListItem
 key={template.id}
 template={template}
 onView={() => console.log('View', template.id)}
 onEdit={() => handleEditTemplate(template)}
 onDelete={() => console.log('Delete', template.id)}
 />
 ))}
 </div>
 ) : viewMode === 'grid' ? (
 <TemplateGrid
 templates={filteredTemplates}
 onTemplateClick={(template) => handleEditTemplate(template)}
 className="p-6"
 />
 ) : null}

 {filteredTemplates.length === 0 && (
 <div className="flex flex-col items-center justify-center h-64 text-center">
 <Package className="w-12 h-12 text-muted-foreground mb-4" />
 <h3 className="font-semibold mb-2">No templates found</h3>
 <p className="text-sm text-muted-foreground max-w-md">
 {searchTerm || filterStatus !== 'all'
 ? 'Try adjusting your search or filters'
 : 'Get started by creating your first template'}
 </p>
 {!searchTerm && filterStatus === 'all' && (
 <button
 onClick={handleCreateTemplate}
 className="mt-4 flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
 >
 <Plus className="w-4 h-4" />
 Create Template
 </button>
 )}
 </div>
 )}
 </div>
 </div>
 );
};