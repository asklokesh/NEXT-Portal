'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 Search, 
 Filter, 
 Star, 
 Download, 
 GitFork,
 Clock,
 Shield,
 TrendingUp,
 Package,
 Globe,
 Server,
 FileText,
 Wrench,
 MoreVertical,
 ExternalLink,
 Heart,
 Play,
 LayoutGrid,
 GitCompare,
 ArrowLeft,
 Plus
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { useTemplatePreferences } from '@/hooks/useTemplatePreferences';
import { cn } from '@/lib/utils';
import { useTemplates } from '@/services/backstage/hooks/useScaffolder';


import { AdvancedSearch } from './AdvancedSearch';
import { TemplateComparison } from '../TemplateComparison/TemplateComparison';
import { TemplateDetailsView } from '../TemplateDetails/TemplateDetailsView';
import { TemplateQuickAccess } from '../TemplateQuickAccess/TemplateQuickAccess';

import type { TemplateEntity } from '@/services/backstage/types/templates';

interface TemplateGridProps {
 className?: string;
}

interface TemplateCardProps {
 template: TemplateEntity;
 onClick?: () => void;
}

interface CategoryFilterProps {
 categories: Array<{
 id: string;
 name: string;
 description: string;
 icon: React.ReactNode;
 count: number;
 }>;
 selectedCategory: string | null;
 onChange: (category: string | null) => void;
}

// Template categories
const TEMPLATE_CATEGORIES = [
 { id: 'all', name: 'All Templates', description: 'Browse all available templates', icon: <Package className="w-5 h-5" />, count: 0 },
 { id: 'service', name: 'Services', description: 'Backend services and APIs', icon: <Server className="w-5 h-5" />, count: 0 },
 { id: 'website', name: 'Websites', description: 'Frontend applications and websites', icon: <Globe className="w-5 h-5" />, count: 0 },
 { id: 'library', name: 'Libraries', description: 'Shared libraries and packages', icon: <Package className="w-5 h-5" />, count: 0 },
 { id: 'documentation', name: 'Documentation', description: 'Documentation sites and tools', icon: <FileText className="w-5 h-5" />, count: 0 },
 { id: 'infrastructure', name: 'Infrastructure', description: 'Infrastructure as code templates', icon: <Wrench className="w-5 h-5" />, count: 0 },
];

// Sort options
const SORT_OPTIONS = [
 { value: 'popular', label: 'Most Popular' },
 { value: 'recent', label: 'Recently Added' },
 { value: 'trending', label: 'Trending' },
 { value: 'rating', label: 'Highest Rated' },
 { value: 'name', label: 'Name (A-Z)' },
];

// Template card component
const TemplateCard: React.FC<TemplateCardProps> = ({ template, onClick }) => {
 const [isLiked, setIsLiked] = useState(false);
 const [showMenu, setShowMenu] = useState(false);

 const templateType = template.spec.type || 'service';
 const categoryIcon = {
 service: <Server className="w-5 h-5" />,
 website: <Globe className="w-5 h-5" />,
 library: <Package className="w-5 h-5" />,
 documentation: <FileText className="w-5 h-5" />,
 infrastructure: <Wrench className="w-5 h-5" />,
 }[templateType] || <Package className="w-5 h-5" />;

 return (
 <div
 className={cn(
 'group relative flex flex-col p-6 rounded-lg border bg-card',
 'hover:shadow-md hover:border-primary/50 transition-all duration-200',
 'cursor-pointer'
 )}
 onClick={onClick}
 >
 {/* Verified badge */}
 {template.metadata.namespace === 'default' && (
 <div className="absolute top-3 right-3">
 <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary">
 <Shield className="w-3 h-3" />
 <span className="text-xs font-medium">Official</span>
 </div>
 </div>
 )}

 {/* Header */}
 <div className="flex items-start gap-4 mb-4">
 <div className={cn(
 'p-3 rounded-lg',
 'bg-primary/10 text-primary'
 )}>
 {categoryIcon}
 </div>
 
 <div className="flex-1 min-w-0">
 <h3 className="font-semibold text-lg truncate pr-8">
 {template.metadata.title || template.metadata.name}
 </h3>
 <p className="text-sm text-muted-foreground">
 by {template.spec.owner}
 </p>
 </div>
 </div>

 {/* Description */}
 <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
 {template.metadata.description}
 </p>

 {/* Tags */}
 {template.metadata.tags && template.metadata.tags.length > 0 && (
 <div className="flex flex-wrap gap-1 mb-4">
 {template.metadata.tags.slice(0, 3).map((tag) => (
 <span
 key={tag}
 className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground"
 >
 {tag}
 </span>
 ))}
 {template.metadata.tags.length > 3 && (
 <span className="text-xs text-muted-foreground">
 +{template.metadata.tags.length - 3}
 </span>
 )}
 </div>
 )}

 {/* Stats */}
 <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
 <div className="flex items-center gap-1">
 <Star className="w-4 h-4" />
 <span>New</span>
 </div>
 <div className="flex items-center gap-1">
 <Download className="w-4 h-4" />
 <span>0</span>
 </div>
 <div className="flex items-center gap-1">
 <GitFork className="w-4 h-4" />
 <span>0</span>
 </div>
 </div>

 {/* Actions */}
 <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
 <div className="flex items-center gap-2">
 <button
 onClick={(e) => {
 e.stopPropagation();
 setIsLiked(!isLiked);
 }}
 className={cn(
 'p-2 rounded-md transition-colors',
 isLiked 
 ? 'text-red-500 hover:bg-red-50' 
 : 'text-muted-foreground hover:text-foreground hover:bg-accent'
 )}
 >
 <Heart className={cn('w-4 h-4', isLiked && 'fill-current')} />
 </button>
 
 <button
 onClick={(e) => {
 e.stopPropagation();
 // Handle fork
 }}
 className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
 >
 <GitFork className="w-4 h-4" />
 </button>
 </div>

 <div className="relative">
 <button
 onClick={(e) => {
 e.stopPropagation();
 setShowMenu(!showMenu);
 }}
 className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
 >
 <MoreVertical className="w-4 h-4" />
 </button>
 
 {showMenu && (
 <div className="absolute right-0 top-full mt-1 w-48 rounded-md shadow-lg bg-popover border border-border z-10">
 <div className="py-1">
 <button
 onClick={(e) => {
 e.stopPropagation();
 // Handle view source
 }}
 className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
 >
 <ExternalLink className="w-4 h-4" />
 View Source
 </button>
 <button
 onClick={(e) => {
 e.stopPropagation();
 // Handle download
 }}
 className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
 >
 <Download className="w-4 h-4" />
 Download
 </button>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Updated indicator */}
 {template.metadata.updatedAt && 
 new Date(template.metadata.updatedAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000 && (
 <div className="absolute top-0 left-0 px-2 py-1 bg-green-500 text-white text-xs rounded-tl-lg rounded-br-lg">
 Updated
 </div>
 )}
 </div>
 );
};

// Category filter sidebar
const CategoryFilter: React.FC<CategoryFilterProps> = ({ 
 categories, 
 selectedCategory, 
 onChange 
}) => {
 return (
 <div className="space-y-1">
 {categories.map((category) => (
 <button
 key={category.id}
 onClick={() => onChange(category.id === 'all' ? null : category.id)}
 className={cn(
 'flex items-center gap-3 w-full px-3 py-2 rounded-md text-left',
 'hover:bg-accent hover:text-accent-foreground transition-colors',
 (selectedCategory === category.id || (category.id === 'all' && !selectedCategory)) &&
 'bg-accent text-accent-foreground'
 )}
 >
 <span className="text-muted-foreground">{category.icon}</span>
 <div className="flex-1">
 <div className="font-medium">{category.name}</div>
 <div className="text-xs text-muted-foreground">{category.description}</div>
 </div>
 <span className="text-sm text-muted-foreground">{category.count}</span>
 </button>
 ))}
 </div>
 );
};

// Main template grid component
export const TemplateGrid: React.FC<TemplateGridProps> = ({
 className,
}) => {
 const router = useRouter();
 const [viewMode, setViewMode] = useState<'browse' | 'compare' | 'quick-access'>('browse');
 const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
 const [compareTemplates, setCompareTemplates] = useState<string[]>([]);
 const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
 const [searchFilters, setSearchFilters] = useState<any>({
 query: '',
 categories: [],
 owners: [],
 tags: [],
 dateRange: {},
 sortBy: 'recent',
 sortOrder: 'desc',
 });

 // Fetch templates from Backstage
 const { data: templates = [], isLoading, error } = useTemplates();
 
 // Template preferences
 const { addToRecentlyUsed, toggleFavorite, isFavorite } = useTemplatePreferences();
 
 // Apply search filters - moved here to be called before any conditional returns
 const filteredTemplates = useMemo(() => {
 let filtered = [...templates];

 // Apply search query
 if (searchFilters.query) {
 const term = searchFilters.query.toLowerCase();
 filtered = filtered.filter(
 (template) =>
 (template.metadata.title || template.metadata.name).toLowerCase().includes(term) ||
 template.metadata.description?.toLowerCase().includes(term) ||
 template.metadata.tags?.some((tag) => tag.toLowerCase().includes(term))
 );
 }

 // Apply category filters
 if (searchFilters.categories.length > 0) {
 filtered = filtered.filter(template => 
 searchFilters.categories.includes(template.spec.type)
 );
 }

 // Apply owner filters
 if (searchFilters.owners.length > 0) {
 filtered = filtered.filter(template => 
 searchFilters.owners.includes(template.spec.owner)
 );
 }

 // Apply tag filters
 if (searchFilters.tags.length > 0) {
 filtered = filtered.filter(template => 
 template.metadata.tags?.some(tag => searchFilters.tags.includes(tag))
 );
 }

 // Apply date range filters
 if (searchFilters.dateRange.start || searchFilters.dateRange.end) {
 filtered = filtered.filter(template => {
 const createdAt = template.metadata.annotations?.['backstage.io/managed-by-origin-location'];
 if (!createdAt) return false;
 
 const templateDate = new Date(createdAt);
 if (searchFilters.dateRange.start && templateDate < new Date(searchFilters.dateRange.start)) return false;
 if (searchFilters.dateRange.end && templateDate > new Date(searchFilters.dateRange.end)) return false;
 
 return true;
 });
 }

 // Apply sorting
 switch (searchFilters.sortBy) {
 case 'name':
 filtered.sort((a, b) => {
 const nameA = (a.metadata.title || a.metadata.name).toLowerCase();
 const nameB = (b.metadata.title || b.metadata.name).toLowerCase();
 return searchFilters.sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
 });
 break;
 case 'recent':
 filtered.sort((a, b) => {
 const dateA = new Date(a.metadata.annotations?.['backstage.io/managed-by-origin-location'] || 0);
 const dateB = new Date(b.metadata.annotations?.['backstage.io/managed-by-origin-location'] || 0);
 return searchFilters.sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
 });
 break;
 case 'popular':
 default:
 // Default sorting by name
 filtered.sort((a, b) => (a.metadata.title || a.metadata.name).localeCompare(b.metadata.title || b.metadata.name));
 break;
 }

 return filtered;
 }, [templates, searchFilters]);

 // Update category counts
 const categoriesWithCounts = useMemo(() => {
 const counts: Record<string, number> = {};
 
 templates.forEach((template) => {
 const category = template.spec.type || 'other';
 counts[category] = (counts[category] || 0) + 1;
 });

 return TEMPLATE_CATEGORIES.map((category) => ({
 ...category,
 count: category.id === 'all' ? templates.length : counts[category.id] || 0,
 }));
 }, [templates]);

 // Show template details if one is selected
 if (selectedTemplate) {
 return (
 <TemplateDetailsView
 templateRef={selectedTemplate}
 onBack={() => setSelectedTemplate(null)}
 className={className}
 />
 );
 }

 // Loading state
 if (isLoading) {
 return (
 <div className={cn('flex items-center justify-center h-96', className)}>
 <div className="text-center">
 <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
 <p className="text-muted-foreground">Loading templates...</p>
 </div>
 </div>
 );
 }

 // Error state
 if (error) {
 return (
 <div className={cn('flex flex-col items-center justify-center h-96', className)}>
 <Package className="w-12 h-12 text-destructive mb-4" />
 <h3 className="text-lg font-semibold mb-2">Failed to load templates</h3>
 <p className="text-sm text-muted-foreground mb-4">
 {error.message || 'An error occurred while loading templates'}
 </p>
 </div>
 );
 }


 const handleCategoryChange = (category: string | null) => {
 setSelectedCategory(category);
 };

 const handleTemplateClick = (template: TemplateEntity) => {
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 addToRecentlyUsed(templateRef, template);
 setSelectedTemplate(templateRef);
 };

 const handleUseTemplate = (templateRef: string) => {
 const template = templates.find(t => 
 `${t.kind}:${t.metadata.namespace || 'default'}/${t.metadata.name}` === templateRef
 );
 
 if (template) {
 addToRecentlyUsed(templateRef, template);
 setSelectedTemplate(templateRef);
 }
 };

 // Render comparison view
 if (viewMode === 'compare') {
 return (
 <div className={cn('h-full', className)}>
 <div className="p-6 border-b border-border">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <button
 onClick={() => setViewMode('browse')}
 className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
 >
 <ArrowLeft className="w-4 h-4" />
 Back to Browse
 </button>
 
 <div className="flex gap-2">
 <button
 onClick={() => setViewMode('browse')}
 className={cn(
 'px-3 py-1 rounded-md text-sm transition-colors',
 viewMode === 'browse' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
 )}
 >
 Browse
 </button>
 <button
 onClick={() => setViewMode('compare')}
 className={cn(
 'px-3 py-1 rounded-md text-sm transition-colors',
 viewMode === 'compare' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
 )}
 >
 Compare
 </button>
 </div>
 </div>
 </div>
 </div>
 
 <div className="flex-1 overflow-y-auto p-6">
 <TemplateComparison
 initialTemplates={compareTemplates}
 onUseTemplate={handleUseTemplate}
 />
 </div>
 </div>
 );
 }

 return (
 <div className={cn('flex h-full', className)}>
 {/* Sidebar with quick access and filters */}
 <div className="w-80 flex-shrink-0 border-r border-border bg-muted/50 overflow-y-auto">
 {/* Quick access */}
 <div className="p-4">
 <TemplateQuickAccess compact />
 </div>
 
 <div className="border-t border-border">
 <div className="p-4">
 <h3 className="font-medium mb-3 flex items-center gap-2">
 <TrendingUp className="w-4 h-4 text-primary" />
 Recently Added
 </h3>
 <div className="space-y-2">
 {templates.slice(0, 3).map((template) => (
 <button
 key={template.metadata.uid}
 onClick={() => handleTemplateClick(template)}
 className="w-full text-left p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
 >
 <div className="font-medium text-sm truncate">
 {template.metadata.title || template.metadata.name}
 </div>
 <div className="text-xs text-muted-foreground">
 {template.spec.type} template
 </div>
 </button>
 ))}
 </div>
 </div>
 </div>
 </div>

 {/* Main content */}
 <div className="flex-1 flex flex-col">
 {/* Header with view modes */}
 <div className="p-6 border-b border-border space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold">Template Marketplace</h1>
 <p className="text-sm text-muted-foreground">
 Discover and use templates to bootstrap your projects
 </p>
 </div>
 
 <div className="flex items-center gap-2">
 <button
 onClick={() => router.push('/templates/create')}
 className="px-3 py-2 rounded-md text-sm bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center gap-2"
 >
 <Plus className="w-4 h-4" />
 Create New Service
 </button>
 <button
 onClick={() => setViewMode('compare')}
 className="px-3 py-2 rounded-md text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
 >
 <Plus className="w-4 h-4" />
 Create Template
 </button>
 <div className="w-px h-6 bg-border" />
 <button
 onClick={() => setViewMode('browse')}
 className={cn(
 'px-3 py-2 rounded-md text-sm transition-colors',
 viewMode === 'browse' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
 )}
 >
 <LayoutGrid className="w-4 h-4 mr-2" />
 Browse
 </button>
 <button
 onClick={() => setViewMode('compare')}
 className={cn(
 'px-3 py-2 rounded-md text-sm transition-colors',
 viewMode === 'compare' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
 )}
 >
 <GitCompare className="w-4 h-4 mr-2" />
 Compare
 </button>
 </div>
 </div>

 {/* Advanced search */}
 <AdvancedSearch
 templates={templates}
 onFiltersChange={setSearchFilters}
 />
 </div>

 {/* Results count */}
 <div className="px-6 py-3 bg-muted/50 text-sm text-muted-foreground">
 Showing {filteredTemplates.length} of {templates.length} templates
 </div>

 {/* Template grid */}
 <div className="flex-1 overflow-y-auto p-6">
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {filteredTemplates.map((template) => (
 <div key={template.metadata.uid} className="relative group">
 <TemplateCard
 template={template}
 onClick={() => handleTemplateClick(template)}
 />
 
 {/* Quick actions overlay */}
 <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
 <button
 onClick={(e) => {
 e.stopPropagation();
 const templateRef = `${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`;
 toggleFavorite(templateRef);
 }}
 className={cn(
 'p-1 rounded hover:bg-accent transition-colors',
 isFavorite(`${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`)
 ? 'text-red-500'
 : 'text-muted-foreground'
 )}
 >
 <Heart className={cn(
 'w-4 h-4',
 isFavorite(`${template.kind}:${template.metadata.namespace || 'default'}/${template.metadata.name}`) && 'fill-current'
 )} />
 </button>
 </div>
 </div>
 ))}
 </div>

 {filteredTemplates.length === 0 && (
 <div className="flex flex-col items-center justify-center h-64 text-center">
 <Package className="w-12 h-12 text-muted-foreground mb-4" />
 <h3 className="font-semibold mb-2">No templates found</h3>
 <p className="text-sm text-muted-foreground max-w-md">
 Try adjusting your search filters to find what you're looking for.
 </p>
 </div>
 )}
 </div>
 </div>
 </div>
 );
};