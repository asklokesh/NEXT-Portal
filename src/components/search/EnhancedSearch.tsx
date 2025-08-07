'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
 Search,
 X,
 Filter,
 Clock,
 TrendingUp,
 Package,
 FileText,
 Users,
 ChevronRight,
 Loader2,
 Tag,
 Calendar
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { searchService } from '@/services/search/search-service';
import type { SearchResponse, SearchFilters, SearchSuggestion, SearchResult } from '@/services/search/search-service';
import { useDebounce } from '@/hooks/useDebounce';

export default function EnhancedSearch() {
 const router = useRouter();
 const [isOpen, setIsOpen] = useState(false);
 const [query, setQuery] = useState('');
 const [filters, setFilters] = useState<SearchFilters>({});
 const [results, setResults] = useState<SearchResponse | null>(null);
 const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
 const [isLoading, setIsLoading] = useState(false);
 const [showFilters, setShowFilters] = useState(false);
 const [selectedFacets, setSelectedFacets] = useState<Record<string, string[]>>({});
 const searchInputRef = useRef<HTMLInputElement>(null);
 
 const debouncedQuery = useDebounce(query, 300);

 // Keyboard shortcut to open search
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
 e.preventDefault();
 setIsOpen(true);
 } else if (e.key === 'Escape' && isOpen) {
 setIsOpen(false);
 }
 };

 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [isOpen]);

 // Focus input when opened
 useEffect(() => {
 if (isOpen && searchInputRef.current) {
 searchInputRef.current.focus();
 }
 }, [isOpen]);

 // Fetch suggestions
 useEffect(() => {
 if (debouncedQuery.length >= 2) {
 searchService.getSuggestions(debouncedQuery).then(setSuggestions);
 } else {
 setSuggestions([]);
 }
 }, [debouncedQuery]);

 // Perform search
 const performSearch = useCallback(async () => {
 if (!query.trim()) return;
 
 setIsLoading(true);
 try {
 const searchFilters: SearchFilters = {
 types: selectedFacets.type,
 kinds: selectedFacets.kind,
 owners: selectedFacets.owner,
 tags: selectedFacets.tags
 };
 
 const response = await searchService.search(query, searchFilters);
 setResults(response);
 setShowFilters(true);
 } catch (error) {
 console.error('Search failed:', error);
 } finally {
 setIsLoading(false);
 }
 }, [query, selectedFacets]);

 // Handle search submit
 const handleSearch = (e: React.FormEvent) => {
 e.preventDefault();
 performSearch();
 };

 // Handle suggestion click
 const handleSuggestionClick = (suggestion: SearchSuggestion) => {
 if (suggestion.metadata?.url) {
 router.push(suggestion.metadata.url);
 setIsOpen(false);
 } else {
 setQuery(suggestion.text);
 performSearch();
 }
 };

 // Handle result click
 const handleResultClick = (result: SearchResult) => {
 router.push(result.url);
 setIsOpen(false);
 };

 // Toggle facet selection
 const toggleFacet = (facetField: string, value: string) => {
 setSelectedFacets(prev => {
 const current = prev[facetField] || [];
 const updated = current.includes(value)
 ? current.filter(v => v !== value)
 : [...current, value];
 
 return {
 ...prev,
 [facetField]: updated
 };
 });
 };

 // Clear all filters
 const clearFilters = () => {
 setSelectedFacets({});
 };

 // Get icon for result type
 const getResultIcon = (type: string) => {
 switch (type) {
 case 'entity':
 return <Package className="w-4 h-4" />;
 case 'template':
 return <FileText className="w-4 h-4" />;
 case 'user':
 case 'group':
 return <Users className="w-4 h-4" />;
 default:
 return <Package className="w-4 h-4" />;
 }
 };

 if (!isOpen) {
 return (
 <button
 onClick={() => setIsOpen(true)}
 className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
 >
 <Search className="w-4 h-4" />
 <span>Search</span>
 <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-gray-200 dark:bg-gray-600 rounded">
 K
 </kbd>
 </button>
 );
 }

 return (
 <div className="fixed inset-0 z-50 overflow-y-auto">
 <div className="fixed inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
 
 <div className="relative min-h-screen flex items-start justify-center pt-[10vh] px-4">
 <div className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-lg shadow-2xl">
 {/* Search Header */}
 <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
 <Search className="w-5 h-5 text-gray-400" />
 <form onSubmit={handleSearch} className="flex-1">
 <input
 ref={searchInputRef}
 type="text"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 placeholder="Search entities, templates, users..."
 className="w-full bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none"
 />
 </form>
 {isLoading && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
 <button
 onClick={() => setShowFilters(!showFilters)}
 className={`p-1.5 rounded-md transition-colors ${
 showFilters 
 ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
 : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
 }`}
 >
 <Filter className="w-4 h-4" />
 </button>
 <button
 onClick={() => setIsOpen(false)}
 className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 {/* Main Content */}
 <div className="flex max-h-[60vh]">
 {/* Results/Suggestions */}
 <div className={`flex-1 overflow-y-auto ${showFilters ? 'border-r border-gray-200 dark:border-gray-700' : ''}`}>
 {/* Suggestions */}
 {!results && suggestions.length > 0 && (
 <div className="p-2">
 {suggestions.map((suggestion, index) => (
 <button
 key={index}
 onClick={() => handleSuggestionClick(suggestion)}
 className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
 >
 {suggestion.type === 'recent' && <Clock className="w-4 h-4 text-gray-400" />}
 {suggestion.type === 'popular' && <TrendingUp className="w-4 h-4 text-gray-400" />}
 {suggestion.type === 'entity' && <Package className="w-4 h-4 text-gray-400" />}
 {suggestion.type === 'template' && <FileText className="w-4 h-4 text-gray-400" />}
 <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">
 {suggestion.text}
 </span>
 <ChevronRight className="w-4 h-4 text-gray-400" />
 </button>
 ))}
 </div>
 )}

 {/* Search Results */}
 {results && (
 <div className="p-2">
 {results.results.length === 0 ? (
 <div className="text-center py-8">
 <p className="text-gray-500 dark:text-gray-400">
 No results found for "{query}"
 </p>
 </div>
 ) : (
 <>
 <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
 {results.total} results ({results.took}ms)
 </div>
 {results.results.map((result) => (
 <button
 key={result.id}
 onClick={() => handleResultClick(result)}
 className="w-full flex items-start gap-3 px-3 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
 >
 <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
 {getResultIcon(result.type)}
 </div>
 <div className="flex-1 min-w-0">
 <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
 {result.title}
 </h4>
 {result.description && (
 <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">
 {result.description}
 </p>
 )}
 {result.highlights && result.highlights.length > 0 && (
 <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
 {result.highlights.map((highlight, idx) => (
 <p 
 key={idx}
 className="line-clamp-1"
 dangerouslySetInnerHTML={{ __html: highlight }}
 />
 ))}
 </div>
 )}
 <div className="flex items-center gap-4 mt-1">
 <span className="text-xs text-gray-500 dark:text-gray-400">
 {result.type}
 </span>
 {result.metadata.owner && (
 <span className="text-xs text-gray-500 dark:text-gray-400">
 {result.metadata.owner}
 </span>
 )}
 {result.metadata.tags && result.metadata.tags.length > 0 && (
 <div className="flex items-center gap-1">
 <Tag className="w-3 h-3 text-gray-400" />
 <span className="text-xs text-gray-500 dark:text-gray-400">
 {result.metadata.tags.length}
 </span>
 </div>
 )}
 </div>
 </div>
 <ChevronRight className="w-4 h-4 text-gray-400 mt-1" />
 </button>
 ))}
 </>
 )}
 </div>
 )}

 {/* Initial State */}
 {!results && suggestions.length === 0 && (
 <div className="p-6 text-center">
 <p className="text-gray-500 dark:text-gray-400 mb-4">
 Start typing to search across all entities and templates
 </p>
 <div className="flex justify-center gap-4 text-xs text-gray-400">
 <span>Press</span>
 <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Enter</kbd>
 <span>to search</span>
 <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Esc</kbd>
 <span>to close</span>
 </div>
 </div>
 )}
 </div>

 {/* Filters Sidebar */}
 {showFilters && results && (
 <div className="w-64 p-4 overflow-y-auto">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-medium text-gray-900 dark:text-gray-100">
 Filters
 </h3>
 <button
 onClick={clearFilters}
 className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
 >
 Clear all
 </button>
 </div>

 {results.facets.map((facet) => (
 <div key={facet.field} className="mb-6">
 <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
 {facet.field}
 </h4>
 <div className="space-y-1">
 {facet.values.map((value) => (
 <label
 key={value.value}
 className="flex items-center gap-2 text-sm cursor-pointer hover:text-gray-900 dark:hover:text-gray-100"
 >
 <input
 type="checkbox"
 checked={value.selected || false}
 onChange={() => toggleFacet(facet.field, value.value)}
 className="h-3 w-3 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
 />
 <span className="flex-1 text-gray-700 dark:text-gray-300">
 {value.value}
 </span>
 <span className="text-xs text-gray-500 dark:text-gray-400">
 ({value.count})
 </span>
 </label>
 ))}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
 <div className="flex items-center gap-4">
 <span className="flex items-center gap-1">
 <Search className="w-3 h-3" />
 Type to search
 </span>
 <span className="flex items-center gap-1">
 <Filter className="w-3 h-3" />
 Filter results
 </span>
 </div>
 <button
 onClick={() => searchService.clearSearchHistory()}
 className="hover:text-gray-700 dark:hover:text-gray-300"
 >
 Clear history
 </button>
 </div>
 </div>
 </div>
 </div>
 );
}