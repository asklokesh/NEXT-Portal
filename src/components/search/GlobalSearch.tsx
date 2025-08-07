'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { motion, AnimatePresence } from 'framer-motion';
import {
 Search,
 X,
 Clock,
 Package,
 FileText,
 Code,
 Users,
 GitBranch,
 Database,
 Server,
 Globe,
 Zap,
 ArrowRight,
 Filter,
 Tag,
 Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

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

interface RecentSearch {
 query: string;
 timestamp: string;
 resultCount: number;
}

interface GlobalSearchProps {
 isOpen: boolean;
 onClose: () => void;
 placeholder?: string;
 maxResults?: number;
}

export default function GlobalSearch({ 
 isOpen, 
 onClose, 
 placeholder = "Search services, templates, APIs, docs...",
 maxResults = 50 
}: GlobalSearchProps) {
 const router = useRouter();
 
 // State
 const [query, setQuery] = useState('');
 const [results, setResults] = useState<SearchResult[]>([]);
 const [loading, setLoading] = useState(false);
 const [selectedIndex, setSelectedIndex] = useState(0);
 const [showFilters, setShowFilters] = useState(false);
 const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
 const [filters, setFilters] = useState<SearchFilters>({
 types: [],
 owners: [],
 systems: [],
 lifecycles: [],
 tags: []
 });

 // Load recent searches from localStorage
 useEffect(() => {
 const saved = localStorage.getItem('backstage-recent-searches');
 if (saved) {
 try {
 setRecentSearches(JSON.parse(saved));
 } catch (error) {
 console.warn('Failed to load recent searches:', error);
 }
 }
 }, []);

 // Save recent searches to localStorage
 const saveRecentSearch = useCallback((searchQuery: string, resultCount: number) => {
 const newSearch: RecentSearch = {
 query: searchQuery,
 timestamp: new Date().toISOString(),
 resultCount
 };
 
 const updated = [newSearch, ...recentSearches.filter(s => s.query !== searchQuery)]
 .slice(0, 10); // Keep only last 10 searches
 
 setRecentSearches(updated);
 localStorage.setItem('backstage-recent-searches', JSON.stringify(updated));
 }, [recentSearches]);

 // Debounced search function
 const searchEntities = useCallback(async (searchQuery: string) => {
 if (!searchQuery.trim()) {
 setResults([]);
 return;
 }

 try {
 setLoading(true);
 
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
 
 // Process entities
 const entityResults: SearchResult[] = entities
 .filter(entity => {
 if (filters.types.length > 0 && !filters.types.includes(entity.kind.toLowerCase())) {
 return false;
 }
 if (filters.owners.length > 0 && entity.spec && 'owner' in entity.spec) {
 const owner = (entity.spec as any).owner;
 if (!filters.owners.includes(owner)) return false;
 }
 return true;
 })
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
 const templateResults: SearchResult[] = templates
 .filter(template => {
 const name = template.metadata.name.toLowerCase();
 const title = (template.metadata.title || '').toLowerCase();
 const description = (template.metadata.description || '').toLowerCase();
 const query = searchQuery.toLowerCase();
 
 return name.includes(query) || 
 title.includes(query) || 
 description.includes(query) ||
 (template.metadata.tags || []).some(tag => tag.toLowerCase().includes(query));
 })
 .map(template => ({
 id: `template-${template.metadata.namespace}-${template.metadata.name}`,
 type: 'template' as const,
 title: template.metadata.title || template.metadata.name,
 subtitle: `Template • ${template.metadata.namespace}`,
 description: template.metadata.description,
 url: `/templates/${template.metadata.namespace}/${template.metadata.name}`,
 icon: <FileText className="w-5 h-5 text-blue-600" />,
 metadata: {
 tags: template.metadata.tags,
 score: calculateTemplateScore(template, searchQuery)
 }
 }));

 // Mock additional search results for APIs, docs, etc.
 const mockResults: SearchResult[] = [
 {
 id: 'api-user-service',
 type: 'api',
 title: 'User Service API',
 subtitle: 'REST API • v1.2.0',
 description: 'User management and authentication API',
 url: '/apis/user-service',
 icon: <Zap className="w-5 h-5 text-green-600" />,
 metadata: {
 owner: 'platform-team',
 tags: ['authentication', 'users', 'rest'],
 score: searchQuery.toLowerCase().includes('user') ? 0.9 : 0.1
 }
 },
 {
 id: 'docs-getting-started',
 type: 'documentation',
 title: 'Getting Started Guide',
 subtitle: 'Documentation',
 description: 'Learn how to create your first service',
 url: '/docs/getting-started',
 icon: <FileText className="w-5 h-5 text-purple-600" />,
 metadata: {
 tags: ['tutorial', 'beginner'],
 score: searchQuery.toLowerCase().includes('getting') || 
 searchQuery.toLowerCase().includes('start') ? 0.8 : 0.1
 }
 }
 ].filter(item => {
 const queryLower = searchQuery.toLowerCase();
 return item.title.toLowerCase().includes(queryLower) ||
 item.description?.toLowerCase().includes(queryLower) ||
 item.metadata?.tags?.some(tag => tag.toLowerCase().includes(queryLower));
 });

 // Combine and sort results by score
 const allResults = [...entityResults, ...templateResults, ...mockResults]
 .sort((a, b) => (b.metadata?.score || 0) - (a.metadata?.score || 0))
 .slice(0, maxResults);

 setResults(allResults);
 setSelectedIndex(0);
 
 // Save to recent searches
 if (allResults.length > 0) {
 saveRecentSearch(searchQuery, allResults.length);
 }
 
 } catch (error) {
 console.error('Search failed:', error);
 toast.error('Search failed');
 } finally {
 setLoading(false);
 }
 }, [filters, maxResults, saveRecentSearch]);

 // Debounce search
 useEffect(() => {
 const timer = setTimeout(() => {
 if (query.trim()) {
 searchEntities(query);
 } else {
 setResults([]);
 }
 }, 300);

 return () => clearTimeout(timer);
 }, [query, searchEntities]);

 // Helper functions
 const getEntityIcon = (kind: string, type?: string) => {
 switch (kind.toLowerCase()) {
 case 'component':
 switch (type) {
 case 'service': return <Server className="w-5 h-5 text-blue-600" />;
 case 'website': return <Globe className="w-5 h-5 text-green-600" />;
 case 'library': return <Package className="w-5 h-5 text-purple-600" />;
 default: return <Code className="w-5 h-5 text-gray-600" />;
 }
 case 'api': return <Zap className="w-5 h-5 text-yellow-600" />;
 case 'system': return <Database className="w-5 h-5 text-red-600" />;
 case 'domain': return <GitBranch className="w-5 h-5 text-indigo-600" />;
 case 'user': return <Users className="w-5 h-5 text-pink-600" />;
 default: return <Package className="w-5 h-5 text-gray-600" />;
 }
 };

 const calculateScore = (entity: Entity, searchQuery: string): number => {
 const query = searchQuery.toLowerCase();
 let score = 0;

 // Exact name match gets highest score
 if (entity.metadata.name.toLowerCase() === query) score += 10;
 else if (entity.metadata.name.toLowerCase().includes(query)) score += 5;
 
 // Title match
 if (entity.metadata.title?.toLowerCase().includes(query)) score += 3;
 
 // Description match
 if (entity.metadata.description?.toLowerCase().includes(query)) score += 2;
 
 // Tag match
 if (entity.metadata.tags?.some(tag => tag.toLowerCase().includes(query))) score += 2;
 
 // Boost score for recently updated entities
 const updated = entity.metadata.annotations?.['backstage.io/updated-at'];
 if (updated) {
 const daysSinceUpdate = (Date.now() - new Date(updated).getTime()) / (1000 * 60 * 60 * 24);
 if (daysSinceUpdate < 7) score += 1;
 }

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

 // Keyboard navigation
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if (!isOpen) return;

 switch (e.key) {
 case 'ArrowDown':
 e.preventDefault();
 setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
 break;
 case 'ArrowUp':
 e.preventDefault();
 setSelectedIndex(prev => Math.max(prev - 1, 0));
 break;
 case 'Enter':
 e.preventDefault();
 if (results[selectedIndex]) {
 handleResultClick(results[selectedIndex]);
 }
 break;
 case 'Escape':
 e.preventDefault();
 onClose();
 break;
 }
 };

 if (isOpen) {
 document.addEventListener('keydown', handleKeyDown);
 return () => document.removeEventListener('keydown', handleKeyDown);
 }
 }, [isOpen, results, selectedIndex, onClose]);

 const handleResultClick = (result: SearchResult) => {
 router.push(result.url);
 onClose();
 };

 const handleRecentSearchClick = (search: RecentSearch) => {
 setQuery(search.query);
 };

 const clearRecentSearches = () => {
 setRecentSearches([]);
 localStorage.removeItem('backstage-recent-searches');
 };

 if (!isOpen) return null;

 return (
 <AnimatePresence>
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
 onClick={onClose}
 >
 <motion.div
 initial={{ opacity: 0, scale: 0.95, y: -20 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: -20 }}
 className="relative mx-auto mt-20 max-w-4xl"
 onClick={e => e.stopPropagation()}
 >
 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
 {/* Search Header */}
 <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
 <Search className="w-5 h-5 text-gray-400" />
 <input
 type="text"
 placeholder={placeholder}
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 className="flex-1 bg-transparent text-lg text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none"
 autoFocus
 />
 
 <div className="flex items-center gap-2">
 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`p-2 rounded-md transition-colors ${
 showFilters 
 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
 : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
 }`}
 >
 <Filter className="w-4 h-4" />
 </button>
 
 {loading && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
 
 <button
 onClick={onClose}
 className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Filters Panel */}
 <AnimatePresence>
 {showFilters && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 className="border-b border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900 overflow-hidden"
 >
 <div className="space-y-3">
 <div>
 <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
 Types
 </label>
 <div className="flex flex-wrap gap-2">
 {['entity', 'template', 'api', 'documentation'].map(type => (
 <button
 key={type}
 onClick={() => {
 setFilters(prev => ({
 ...prev,
 types: prev.types.includes(type)
 ? prev.types.filter(t => t !== type)
 : [...prev.types, type]
 }));
 }}
 className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
 filters.types.includes(type)
 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
 : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
 }`}
 >
 {type}
 </button>
 ))}
 </div>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Search Results */}
 <div className="max-h-96 overflow-y-auto">
 {query.trim() === '' && recentSearches.length > 0 && (
 <div className="p-4">
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
 Recent Searches
 </h3>
 <button
 onClick={clearRecentSearches}
 className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
 >
 Clear
 </button>
 </div>
 <div className="space-y-1">
 {recentSearches.slice(0, 5).map((search, _index) => (
 <button
 key={`${search.query}-${search.timestamp}`}
 onClick={() => handleRecentSearchClick(search)}
 className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-left transition-colors"
 >
 <Clock className="w-4 h-4 text-gray-400" />
 <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">
 {search.query}
 </span>
 <span className="text-xs text-gray-500 dark:text-gray-400">
 {search.resultCount} results
 </span>
 </button>
 ))}
 </div>
 </div>
 )}

 {query.trim() !== '' && (
 <>
 {results.length === 0 && !loading && (
 <div className="p-8 text-center">
 <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 No results found
 </h3>
 <p className="text-gray-500 dark:text-gray-400">
 Try adjusting your search terms or filters
 </p>
 </div>
 )}

 {results.map((result, index) => (
 <motion.button
 key={result.id}
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: index * 0.05 }}
 onClick={() => handleResultClick(result)}
 className={`w-full flex items-start gap-4 p-4 text-left transition-all ${
 index === selectedIndex
 ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500'
 : 'hover:bg-gray-50 dark:hover:bg-gray-700'
 }`}
 >
 <div className="flex-shrink-0 mt-1">
 {result.icon}
 </div>
 
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between mb-1">
 <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
 {result.title}
 </h3>
 <ArrowRight className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
 </div>
 
 {result.subtitle && (
 <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
 {result.subtitle}
 </p>
 )}
 
 {result.description && (
 <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
 {result.description}
 </p>
 )}
 
 {result.metadata?.tags && result.metadata.tags.length > 0 && (
 <div className="flex flex-wrap gap-1">
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
 <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
 {result.highlights.slice(0, 2).map((highlight, i) => (
 <div key={i} className="truncate">
 {highlight}
 </div>
 ))}
 </div>
 )}
 </div>
 </motion.button>
 ))}
 </>
 )}
 </div>

 {/* Footer */}
 <div className="p-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-4">
 <span> Navigate</span>
 <span> Select</span>
 <span>Esc Close</span>
 </div>
 {results.length > 0 && (
 <span>{results.length} results</span>
 )}
 </div>
 </div>
 </div>
 </motion.div>
 </motion.div>
 </AnimatePresence>
 );
}