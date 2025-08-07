'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, no-case-declarations, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return, react/function-component-definition */

import { motion, AnimatePresence } from 'framer-motion';
import {
 Search,
 Filter,
 SortAsc,
 SortDesc,
 Grid,
 List,
 Package,
 FileText,
 Zap,
 Users,
 Database,
 Server,
 Globe,
 Clock,
 TrendingUp,
 ArrowRight,
 Tag,
 Star,
 ExternalLink,
 ChevronDown,
 ChevronUp,
 X,
 Calendar,
 Hash,
 AtSign
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useEffect, useCallback, Suspense } from 'react';

import { backstageClient } from '@/lib/backstage/client';

import type { Entity, ServiceEntity, TemplateEntityV1beta3 } from '@/lib/backstage/types';

interface SearchResult {
 id: string;
 type: 'entity' | 'template' | 'api' | 'documentation' | 'user' | 'system';
 title: string;
 subtitle?: string;
 description?: string;
 url: string;
 icon: React.ReactNode;
 metadata?: {
 owner?: string;
 lifecycle?: string;
 system?: string;
 tags?: string[];
 lastUpdated?: string;
 score?: number;
 };
 highlights?: string[];
}

interface SearchFilters {
 types: string[];
 owners: string[];
 systems: string[];
 lifecycles: string[];
 tags: string[];
 timeRange?: 'day' | 'week' | 'month' | 'year';
}

interface SearchStats {
 totalResults: number;
 byType: Record<string, number>;
 executionTime: number;
}

const SearchPageContent = () => {
 const router = useRouter();
 const searchParams = useSearchParams();
 const initialQuery = searchParams.get('q') || '';

 // State
 const [query, setQuery] = useState(initialQuery);
 const [results, setResults] = useState<SearchResult[]>([]);
 const [loading, setLoading] = useState(false);
 const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
 const [sortBy, setSortBy] = useState<'relevance' | 'name' | 'updated' | 'owner'>('relevance');
 const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
 const [showFilters, setShowFilters] = useState(false);
 const [stats, setStats] = useState<SearchStats>({ totalResults: 0, byType: {}, executionTime: 0 });
 const [filters, setFilters] = useState<SearchFilters>({
 types: [],
 owners: [],
 systems: [],
 lifecycles: [],
 tags: []
 });

 // Available filter options (would be loaded from API)
 const filterOptions = {
 types: [
 { value: 'entity', label: 'Services & Components', count: 0 },
 { value: 'template', label: 'Templates', count: 0 },
 { value: 'api', label: 'APIs', count: 0 },
 { value: 'documentation', label: 'Documentation', count: 0 },
 { value: 'user', label: 'Users', count: 0 },
 { value: 'system', label: 'Systems', count: 0 }
 ],
 owners: ['platform-team', 'data-team', 'frontend-team', 'backend-team'],
 systems: ['user-management', 'payment-processing', 'analytics', 'monitoring'],
 lifecycles: ['experimental', 'production', 'deprecated'],
 tags: ['api', 'database', 'frontend', 'backend', 'monitoring', 'security']
 };

 // Search function
 const performSearch = useCallback(async (searchQuery: string) => {
 if (!searchQuery.trim()) {
 setResults([]);
 setStats({ totalResults: 0, byType: {}, executionTime: 0 });
 return;
 }

 try {
 setLoading(true);
 const startTime = Date.now();

 // Search entities
 const entities = await backstageClient.getCatalogEntities({
 filter: {
 'metadata.name': searchQuery,
 'metadata.title': searchQuery,
 'metadata.description': searchQuery,
 'metadata.tags': searchQuery
 }
 });

 // Search templates
 const templates = await backstageClient.getTemplates();

 // Process and filter results
 let allResults: SearchResult[] = [];

 // Process entities
 const entityResults = entities
 .filter(entity => applyEntityFilters(entity))
 .map(entity => ({
 id: `entity-${entity.metadata.namespace}-${entity.kind}-${entity.metadata.name}`,
 type: 'entity' as const,
 title: entity.metadata.title || entity.metadata.name,
 subtitle: `${entity.kind} • ${entity.metadata.namespace}`,
 description: entity.metadata.description,
 url: `/catalog/${entity.metadata.namespace}/${entity.kind.toLowerCase()}/${entity.metadata.name}`,
 icon: getEntityIcon(entity.kind, (entity as ServiceEntity).spec?.type),
 metadata: {
 owner: entity.spec && 'owner' in entity.spec ? (entity.spec as any).owner : undefined,
 lifecycle: entity.spec && 'lifecycle' in entity.spec ? (entity.spec as any).lifecycle : undefined,
 system: entity.spec && 'system' in entity.spec ? (entity.spec as any).system : undefined,
 tags: entity.metadata.tags,
 lastUpdated: entity.metadata.annotations?.['backstage.io/updated-at'],
 score: calculateScore(entity, searchQuery)
 },
 highlights: getHighlights(entity, searchQuery)
 }));

 // Process templates
 const templateResults = templates
 .filter(template => applyTemplateFilters(template, searchQuery))
 .map(template => ({
 id: `template-${template.metadata.namespace}-${template.metadata.name}`,
 type: 'template' as const,
 title: template.metadata.title || template.metadata.name,
 subtitle: `Template • ${template.metadata.namespace}`,
 description: template.metadata.description,
 url: `/templates/${template.metadata.namespace}/${template.metadata.name}`,
 icon: <FileText className="w-6 h-6 text-blue-600" />,
 metadata: {
 tags: template.metadata.tags,
 score: calculateTemplateScore(template, searchQuery)
 }
 }));

 // Add mock results for other types
 const mockResults: SearchResult[] = [
 {
 id: 'api-user-service',
 type: 'api',
 title: 'User Service API',
 subtitle: 'REST API • v1.2.0',
 description: 'Comprehensive user management and authentication API with JWT support',
 url: '/apis/user-service',
 icon: <Zap className="w-6 h-6 text-green-600" />,
 metadata: {
 owner: 'platform-team',
 tags: ['authentication', 'users', 'rest', 'jwt'],
 score: searchQuery.toLowerCase().includes('user') ? 0.9 : 0.1
 }
 },
 {
 id: 'docs-getting-started',
 type: 'documentation',
 title: 'Getting Started Guide',
 subtitle: 'Documentation • Platform Docs',
 description: 'Complete guide to getting started with the platform, including setup and first service creation',
 url: '/docs/getting-started',
 icon: <FileText className="w-6 h-6 text-purple-600" />,
 metadata: {
 tags: ['tutorial', 'beginner', 'setup'],
 score: searchQuery.toLowerCase().includes('getting') || 
 searchQuery.toLowerCase().includes('start') ? 0.8 : 0.1
 }
 }
 ].filter(item => {
 if (filters.types.length > 0 && !filters.types.includes(item.type)) {
 return false;
 }
 const queryLower = searchQuery.toLowerCase();
 return item.title.toLowerCase().includes(queryLower) ||
 item.description?.toLowerCase().includes(queryLower) ||
 item.metadata?.tags?.some(tag => tag.toLowerCase().includes(queryLower));
 });

 allResults = [...entityResults, ...templateResults, ...mockResults];

 // Apply sorting
 allResults = applySorting(allResults);

 // Calculate stats
 const executionTime = Date.now() - startTime;
 const byType = allResults.reduce((acc, result) => {
 acc[result.type] = (acc[result.type] || 0) + 1;
 return acc;
 }, {} as Record<string, number>);

 setResults(allResults);
 setStats({
 totalResults: allResults.length,
 byType,
 executionTime
 });

 } catch (error) {
 console.error('Search failed:', error);
 setResults([]);
 setStats({ totalResults: 0, byType: {}, executionTime: 0 });
 } finally {
 setLoading(false);
 }
 }, [filters, sortBy, sortOrder]);

 // Helper functions
 const applyEntityFilters = (entity: Entity): boolean => {
 if (filters.types.length > 0 && !filters.types.includes('entity')) return false;
 if (filters.owners.length > 0 && entity.spec && 'owner' in entity.spec) {
 const owner = (entity.spec as any).owner;
 if (!filters.owners.includes(owner)) return false;
 }
 if (filters.lifecycles.length > 0 && entity.spec && 'lifecycle' in entity.spec) {
 const lifecycle = (entity.spec as any).lifecycle;
 if (!filters.lifecycles.includes(lifecycle)) return false;
 }
 if (filters.systems.length > 0 && entity.spec && 'system' in entity.spec) {
 const system = (entity.spec as any).system;
 if (!filters.systems.includes(system)) return false;
 }
 if (filters.tags.length > 0) {
 const entityTags = entity.metadata.tags || [];
 if (!filters.tags.some(tag => entityTags.includes(tag))) return false;
 }
 return true;
 };

 const applyTemplateFilters = (template: TemplateEntityV1beta3, searchQuery: string): boolean => {
 if (filters.types.length > 0 && !filters.types.includes('template')) return false;
 
 const name = template.metadata.name.toLowerCase();
 const title = (template.metadata.title || '').toLowerCase();
 const description = (template.metadata.description || '').toLowerCase();
 const query = searchQuery.toLowerCase();
 
 return name.includes(query) || 
 title.includes(query) || 
 description.includes(query) ||
 (template.metadata.tags || []).some(tag => tag.toLowerCase().includes(query));
 };

 const applySorting = (results: SearchResult[]): SearchResult[] => {
 return [...results].sort((a, b) => {
 let comparison = 0;
 
 switch (sortBy) {
 case 'relevance':
 comparison = (b.metadata?.score || 0) - (a.metadata?.score || 0);
 break;
 case 'name':
 comparison = a.title.localeCompare(b.title);
 break;
 case 'updated':
 const aTime = a.metadata?.lastUpdated ? new Date(a.metadata.lastUpdated).getTime() : 0;
 const bTime = b.metadata?.lastUpdated ? new Date(b.metadata.lastUpdated).getTime() : 0;
 comparison = bTime - aTime;
 break;
 case 'owner':
 comparison = (a.metadata?.owner || '').localeCompare(b.metadata?.owner || '');
 break;
 }
 
 return sortOrder === 'desc' ? comparison : -comparison;
 });
 };

 const getEntityIcon = (kind: string, type?: string) => {
 switch (kind.toLowerCase()) {
 case 'component':
 switch (type) {
 case 'service': return <Server className="w-6 h-6 text-blue-600" />;
 case 'website': return <Globe className="w-6 h-6 text-green-600" />;
 case 'library': return <Package className="w-6 h-6 text-purple-600" />;
 default: return <Package className="w-6 h-6 text-gray-600" />;
 }
 case 'api': return <Zap className="w-6 h-6 text-yellow-600" />;
 case 'system': return <Database className="w-6 h-6 text-red-600" />;
 case 'user': return <Users className="w-6 h-6 text-pink-600" />;
 default: return <Package className="w-6 h-6 text-gray-600" />;
 }
 };

 const calculateScore = (entity: Entity, searchQuery: string): number => {
 const query = searchQuery.toLowerCase();
 let score = 0;

 if (entity.metadata.name.toLowerCase() === query) score += 10;
 else if (entity.metadata.name.toLowerCase().includes(query)) score += 5;
 
 if (entity.metadata.title?.toLowerCase().includes(query)) score += 3;
 if (entity.metadata.description?.toLowerCase().includes(query)) score += 2;
 if (entity.metadata.tags?.some(tag => tag.toLowerCase().includes(query))) score += 2;
 
 return score;
 };

 const calculateTemplateScore = (template: TemplateEntityV1beta3, searchQuery: string): number => {
 const query = searchQuery.toLowerCase();
 let score = 0;

 if (template.metadata.name.toLowerCase().includes(query)) score += 5;
 if (template.metadata.title?.toLowerCase().includes(query)) score += 3;
 if (template.metadata.description?.toLowerCase().includes(query)) score += 2;
 if (template.metadata.tags?.some(tag => tag.toLowerCase().includes(query))) score += 2;

 return score;
 };

 const getHighlights = (entity: Entity, searchQuery: string): string[] => {
 const highlights: string[] = [];
 const query = searchQuery.toLowerCase();
 
 if (entity.metadata.name.toLowerCase().includes(query)) {
 highlights.push(`Name: ${entity.metadata.name}`);
 }
 
 if (entity.metadata.description?.toLowerCase().includes(query)) {
 const desc = entity.metadata.description;
 const index = desc.toLowerCase().indexOf(query);
 const start = Math.max(0, index - 20);
 const end = Math.min(desc.length, index + query.length + 20);
 highlights.push(`...${desc.slice(start, end)}...`);
 }

 return highlights;
 };

 // Update search when query changes
 useEffect(() => {
 const timer = setTimeout(() => {
 void performSearch(query);
 }, 300);

 return () => clearTimeout(timer);
 }, [query, performSearch]);

 // Update URL when query changes
 useEffect(() => {
 if (query !== initialQuery) {
 const newUrl = query ? `/search?q=${encodeURIComponent(query)}` : '/search';
 router.replace(newUrl);
 }
 }, [query, initialQuery, router]);

 return (
 <div className="space-y-6">
 {/* Search Header */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
 Search Platform
 </h1>
 
 <div className="flex flex-col lg:flex-row gap-4">
 {/* Search Input */}
 <div className="flex-1 relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
 <input
 type="text"
 placeholder="Search services, templates, APIs, docs..."
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 />
 </div>
 
 {/* Controls */}
 <div className="flex items-center gap-2">
 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`px-4 py-3 rounded-md flex items-center gap-2 ${
 showFilters 
 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
 : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
 }`}
 >
 <Filter className="w-4 h-4" />
 Filters
 {Object.values(filters).some(arr => arr.length > 0) && (
 <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
 {Object.values(filters).reduce((acc, arr) => acc + arr.length, 0)}
 </span>
 )}
 </button>
 
 <select
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value as any)}
 className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
 >
 <option value="relevance">Relevance</option>
 <option value="name">Name</option>
 <option value="updated">Last Updated</option>
 <option value="owner">Owner</option>
 </select>
 
 <button
 onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
 className="p-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
 >
 {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
 </button>
 
 <div className="flex rounded-md border border-gray-300 dark:border-gray-600">
 <button
 onClick={() => setViewMode('list')}
 className={`p-3 ${viewMode === 'list' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}
 >
 <List className="w-4 h-4" />
 </button>
 <button
 onClick={() => setViewMode('grid')}
 className={`p-3 ${viewMode === 'grid' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'}`}
 >
 <Grid className="w-4 h-4" />
 </button>
 </div>
 </div>
 </div>
 </div>

 {/* Filters Panel */}
 <AnimatePresence>
 {showFilters && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 overflow-hidden"
 >
 <div className="space-y-4">
 {/* Type Filters */}
 <div>
 <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</h3>
 <div className="flex flex-wrap gap-2">
 {filterOptions.types.map(type => (
 <button
 key={type.value}
 onClick={() => {
 setFilters(prev => ({
 ...prev,
 types: prev.types.includes(type.value)
 ? prev.types.filter(t => t !== type.value)
 : [...prev.types, type.value]
 }));
 }}
 className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
 filters.types.includes(type.value)
 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
 : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
 }`}
 >
 {type.label}
 </button>
 ))}
 </div>
 </div>

 {/* Clear Filters */}
 {Object.values(filters).some(arr => arr.length > 0) && (
 <button
 onClick={() => setFilters({
 types: [],
 owners: [],
 systems: [],
 lifecycles: [],
 tags: []
 })}
 className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
 >
 Clear all filters
 </button>
 )}
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Search Stats */}
 <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
 <div className="flex items-center gap-4">
 <span>
 {loading ? 'Searching...' : `${stats.totalResults.toLocaleString()} results`}
 </span>
 {!loading && stats.executionTime > 0 && (
 <span>in {stats.executionTime}ms</span>
 )}
 </div>
 
 {Object.keys(stats.byType).length > 0 && (
 <div className="flex items-center gap-4">
 {Object.entries(stats.byType).map(([type, count]) => (
 <span key={type} className="capitalize">
 {type}: {count}
 </span>
 ))}
 </div>
 )}
 </div>

 {/* Search Results */}
 <div>
 {loading && (
 <div className="flex items-center justify-center py-12">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
 </div>
 )}

 {!loading && results.length === 0 && query.trim() !== '' && (
 <div className="text-center py-12">
 <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 No results found
 </h3>
 <p className="text-gray-500 dark:text-gray-400">
 Try adjusting your search terms or filters
 </p>
 </div>
 )}

 {!loading && results.length === 0 && query.trim() === '' && (
 <div className="text-center py-12">
 <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 Start searching
 </h3>
 <p className="text-gray-500 dark:text-gray-400">
 Enter a search term to find services, templates, APIs, and documentation
 </p>
 </div>
 )}

 {!loading && results.length > 0 && (
 <div className={
 viewMode === 'grid' 
 ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
 : 'space-y-4'
 }>
 {results.map((result, index) => (
 <motion.div
 key={result.id}
 initial={{ opacity: 0, y: 20 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.05 }}
 className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all cursor-pointer ${
 viewMode === 'list' ? 'flex items-start gap-4' : ''
 }`}
 onClick={() => router.push(result.url)}
 >
 <div className={`flex-shrink-0 ${viewMode === 'list' ? '' : 'mb-4'}`}>
 {result.icon}
 </div>
 
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between mb-2">
 <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
 {result.title}
 </h3>
 <ArrowRight className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
 </div>
 
 {result.subtitle && (
 <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
 {result.subtitle}
 </p>
 )}
 
 {result.description && (
 <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
 {result.description}
 </p>
 )}
 
 {result.metadata?.tags && result.metadata.tags.length > 0 && (
 <div className="flex flex-wrap gap-1 mb-3">
 {result.metadata.tags.slice(0, 3).map(tag => (
 <span
 key={tag}
 className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
 >
 <Tag className="w-3 h-3" />
 {tag}
 </span>
 ))}
 {result.metadata.tags.length > 3 && (
 <span className="text-xs text-gray-500 dark:text-gray-400">
 +{result.metadata.tags.length - 3} more
 </span>
 )}
 </div>
 )}
 
 {result.highlights && result.highlights.length > 0 && (
 <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
 {result.highlights.slice(0, 2).map((highlight, i) => (
 <div key={i} className="truncate">
 {highlight}
 </div>
 ))}
 </div>
 )}
 
 {result.metadata && (
 <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
 {result.metadata.owner && (
 <span className="flex items-center gap-1">
 <AtSign className="w-3 h-3" />
 {result.metadata.owner}
 </span>
 )}
 {result.metadata.lastUpdated && (
 <span className="flex items-center gap-1">
 <Calendar className="w-3 h-3" />
 {new Date(result.metadata.lastUpdated).toLocaleDateString()}
 </span>
 )}
 {result.metadata.score && result.metadata.score > 0 && (
 <span className="flex items-center gap-1">
 <TrendingUp className="w-3 h-3" />
 {(result.metadata.score * 10).toFixed(1)}% match
 </span>
 )}
 </div>
 )}
 </div>
 </motion.div>
 ))}
 </div>
 )}
 </div>
 </div>
 );
}

export default function SearchPage() {
 return (
 <Suspense fallback={
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 }>
 <SearchPageContent />
 </Suspense>
 );
}