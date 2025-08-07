'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { 
 Search,
 Filter,
 X,
 ChevronDown,
 Calendar,
 Star,
 Download,
 User,
 Tag,
 SlidersHorizontal,
 RotateCcw
} from 'lucide-react';
import React, { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';

import type { TemplateEntity } from '@/services/backstage/types/templates';

interface SearchFilters {
 query: string;
 categories: string[];
 owners: string[];
 tags: string[];
 dateRange: {
 start?: string;
 end?: string;
 };
 minRating?: number;
 minDownloads?: number;
 sortBy: 'name' | 'recent' | 'popular' | 'rating';
 sortOrder: 'asc' | 'desc';
}

interface AdvancedSearchProps {
 templates: TemplateEntity[];
 onFiltersChange: (filters: SearchFilters) => void;
 className?: string;
}

interface FilterChipProps {
 label: string;
 value: string;
 onRemove: () => void;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, value, onRemove }) => (
 <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
 <span className="font-medium">{label}:</span>
 <span>{value}</span>
 <button
 onClick={onRemove}
 className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
 >
 <X className="w-3 h-3" />
 </button>
 </span>
);

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({
 templates,
 onFiltersChange,
 className,
}) => {
 const [filters, setFilters] = useState<SearchFilters>({
 query: '',
 categories: [],
 owners: [],
 tags: [],
 dateRange: {},
 sortBy: 'recent',
 sortOrder: 'desc',
 });

 const [showAdvanced, setShowAdvanced] = useState(false);
 const [showSuggestions, setShowSuggestions] = useState(false);

 // Extract unique values for filter options
 const availableCategories = [...new Set(templates.map(t => t.spec.type))].filter(Boolean);
 const availableOwners = [...new Set(templates.map(t => t.spec.owner))].filter(Boolean);
 const availableTags = [...new Set(templates.flatMap(t => t.metadata.tags || []))].filter(Boolean);

 // Generate search suggestions
 const searchSuggestions = React.useMemo(() => {
 if (!filters.query || filters.query.length < 2) return [];

 const query = filters.query.toLowerCase();
 const suggestions = new Set<string>();

 templates.forEach(template => {
 // Template names
 if (template.metadata.name.toLowerCase().includes(query)) {
 suggestions.add(template.metadata.name);
 }
 
 // Template titles
 if (template.metadata.title?.toLowerCase().includes(query)) {
 suggestions.add(template.metadata.title);
 }

 // Tags
 template.metadata.tags?.forEach(tag => {
 if (tag.toLowerCase().includes(query)) {
 suggestions.add(tag);
 }
 });

 // Owners
 if (template.spec.owner.toLowerCase().includes(query)) {
 suggestions.add(template.spec.owner);
 }
 });

 return Array.from(suggestions).slice(0, 8);
 }, [filters.query, templates]);

 useEffect(() => {
 onFiltersChange(filters);
 }, [filters, onFiltersChange]);

 const updateFilters = (updates: Partial<SearchFilters>) => {
 setFilters(prev => ({ ...prev, ...updates }));
 };

 const addFilter = (type: keyof Pick<SearchFilters, 'categories' | 'owners' | 'tags'>, value: string) => {
 if (!filters[type].includes(value)) {
 updateFilters({
 [type]: [...filters[type], value],
 });
 }
 };

 const removeFilter = (type: keyof Pick<SearchFilters, 'categories' | 'owners' | 'tags'>, value: string) => {
 updateFilters({
 [type]: filters[type].filter(item => item !== value),
 });
 };

 const clearAllFilters = () => {
 setFilters({
 query: '',
 categories: [],
 owners: [],
 tags: [],
 dateRange: {},
 sortBy: 'recent',
 sortOrder: 'desc',
 });
 };

 const hasActiveFilters = filters.query || 
 filters.categories.length > 0 || 
 filters.owners.length > 0 || 
 filters.tags.length > 0 ||
 filters.minRating ||
 filters.minDownloads ||
 filters.dateRange.start ||
 filters.dateRange.end;

 return (
 <div className={cn('space-y-4', className)}>
 {/* Main search bar */}
 <div className="relative">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
 <input
 type="text"
 value={filters.query}
 onChange={(e) => {
 updateFilters({ query: e.target.value });
 setShowSuggestions(e.target.value.length >= 2);
 }}
 onFocus={() => setShowSuggestions(filters.query.length >= 2)}
 onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
 placeholder="Search templates by name, tags, or description..."
 className="w-full pl-10 pr-20 py-3 rounded-lg border border-input bg-background text-lg"
 />
 <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
 <button
 onClick={() => setShowAdvanced(!showAdvanced)}
 className={cn(
 'p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors',
 showAdvanced && 'bg-accent text-accent-foreground'
 )}
 title="Advanced filters"
 >
 <SlidersHorizontal className="w-4 h-4" />
 </button>
 {hasActiveFilters && (
 <button
 onClick={clearAllFilters}
 className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
 title="Clear all filters"
 >
 <RotateCcw className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>

 {/* Search suggestions */}
 {showSuggestions && searchSuggestions.length > 0 && (
 <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-10">
 <div className="p-2">
 <div className="text-xs text-muted-foreground mb-2">Suggestions</div>
 {searchSuggestions.map((suggestion, index) => (
 <button
 key={index}
 onClick={() => {
 updateFilters({ query: suggestion });
 setShowSuggestions(false);
 }}
 className="w-full text-left px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
 >
 {suggestion}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>

 {/* Advanced filters panel */}
 {showAdvanced && (
 <div className="bg-card rounded-lg border p-6 space-y-6">
 <div className="flex items-center justify-between">
 <h3 className="text-lg font-semibold">Advanced Filters</h3>
 <button
 onClick={() => setShowAdvanced(false)}
 className="p-1 rounded-md hover:bg-accent hover:text-accent-foreground"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {/* Categories */}
 <div>
 <label className="text-sm font-medium mb-2 block">Categories</label>
 <div className="space-y-1">
 {availableCategories.map(category => (
 <label key={category} className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={filters.categories.includes(category)}
 onChange={(e) => {
 if (e.target.checked) {
 addFilter('categories', category);
 } else {
 removeFilter('categories', category);
 }
 }}
 className="w-4 h-4 rounded border-input"
 />
 <span className="text-sm capitalize">{category}</span>
 </label>
 ))}
 </div>
 </div>

 {/* Owners */}
 <div>
 <label className="text-sm font-medium mb-2 block">Owners</label>
 <div className="space-y-1 max-h-32 overflow-y-auto">
 {availableOwners.map(owner => (
 <label key={owner} className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={filters.owners.includes(owner)}
 onChange={(e) => {
 if (e.target.checked) {
 addFilter('owners', owner);
 } else {
 removeFilter('owners', owner);
 }
 }}
 className="w-4 h-4 rounded border-input"
 />
 <span className="text-sm">{owner}</span>
 </label>
 ))}
 </div>
 </div>

 {/* Tags */}
 <div>
 <label className="text-sm font-medium mb-2 block">Tags</label>
 <div className="space-y-1 max-h-32 overflow-y-auto">
 {availableTags.slice(0, 10).map(tag => (
 <label key={tag} className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={filters.tags.includes(tag)}
 onChange={(e) => {
 if (e.target.checked) {
 addFilter('tags', tag);
 } else {
 removeFilter('tags', tag);
 }
 }}
 className="w-4 h-4 rounded border-input"
 />
 <span className="text-sm">{tag}</span>
 </label>
 ))}
 </div>
 </div>

 {/* Date Range */}
 <div>
 <label className="text-sm font-medium mb-2 block">Date Range</label>
 <div className="space-y-2">
 <input
 type="date"
 value={filters.dateRange.start || ''}
 onChange={(e) => updateFilters({
 dateRange: { ...filters.dateRange, start: e.target.value }
 })}
 className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
 placeholder="Start date"
 />
 <input
 type="date"
 value={filters.dateRange.end || ''}
 onChange={(e) => updateFilters({
 dateRange: { ...filters.dateRange, end: e.target.value }
 })}
 className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
 placeholder="End date"
 />
 </div>
 </div>

 {/* Rating & Downloads */}
 <div>
 <label className="text-sm font-medium mb-2 block">Minimum Rating</label>
 <select
 value={filters.minRating || ''}
 onChange={(e) => updateFilters({
 minRating: e.target.value ? Number(e.target.value) : undefined
 })}
 className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
 >
 <option value="">Any rating</option>
 <option value="4">4+ stars</option>
 <option value="3">3+ stars</option>
 <option value="2">2+ stars</option>
 <option value="1">1+ stars</option>
 </select>
 </div>

 {/* Sort Options */}
 <div>
 <label className="text-sm font-medium mb-2 block">Sort By</label>
 <div className="space-y-2">
 <select
 value={filters.sortBy}
 onChange={(e) => updateFilters({
 sortBy: e.target.value as SearchFilters['sortBy']
 })}
 className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
 >
 <option value="recent">Most Recent</option>
 <option value="popular">Most Popular</option>
 <option value="name">Name</option>
 <option value="rating">Rating</option>
 </select>
 <select
 value={filters.sortOrder}
 onChange={(e) => updateFilters({
 sortOrder: e.target.value as 'asc' | 'desc'
 })}
 className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
 >
 <option value="desc">Descending</option>
 <option value="asc">Ascending</option>
 </select>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Active filters */}
 {hasActiveFilters && (
 <div className="flex flex-wrap gap-2 items-center">
 <span className="text-sm text-muted-foreground">Active filters:</span>
 
 {filters.categories.map(category => (
 <FilterChip
 key={category}
 label="Category"
 value={category}
 onRemove={() => removeFilter('categories', category)}
 />
 ))}
 
 {filters.owners.map(owner => (
 <FilterChip
 key={owner}
 label="Owner"
 value={owner}
 onRemove={() => removeFilter('owners', owner)}
 />
 ))}
 
 {filters.tags.map(tag => (
 <FilterChip
 key={tag}
 label="Tag"
 value={tag}
 onRemove={() => removeFilter('tags', tag)}
 />
 ))}
 
 {filters.minRating && (
 <FilterChip
 label="Min Rating"
 value={`${filters.minRating}+`}
 onRemove={() => updateFilters({ minRating: undefined })}
 />
 )}
 
 {filters.dateRange.start && (
 <FilterChip
 label="From"
 value={new Date(filters.dateRange.start).toLocaleDateString()}
 onRemove={() => updateFilters({
 dateRange: { ...filters.dateRange, start: undefined }
 })}
 />
 )}
 
 {filters.dateRange.end && (
 <FilterChip
 label="To"
 value={new Date(filters.dateRange.end).toLocaleDateString()}
 onRemove={() => updateFilters({
 dateRange: { ...filters.dateRange, end: undefined }
 })}
 />
 )}
 </div>
 )}
 </div>
 );
};