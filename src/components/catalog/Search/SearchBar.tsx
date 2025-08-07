'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, jsx-a11y/role-supports-aria-props */

import Fuse from 'fuse.js';
import { 
 Search, 
 X, 
 Command, 
 Clock, 
 Star as _Star, 
 TrendingUp,
 Filter as _Filter,
 Sparkles,
 ArrowRight,
 Hash,
 User,
 Tag
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

import type { ServiceEntity } from '../types';

interface SearchBarProps {
 services: ServiceEntity[];
 value?: string;
 onChange?: (value: string) => void;
 onSelect?: (service: ServiceEntity) => void;
 placeholder?: string;
 className?: string;
 showSuggestions?: boolean;
 showRecentSearches?: boolean;
 recentSearches?: string[];
 popularSearches?: string[];
 onClear?: () => void;
}

interface SearchSuggestion {
 type: 'service' | 'query' | 'tag' | 'owner' | 'system';
 label: string;
 value: string;
 entity?: ServiceEntity;
 icon?: React.ReactNode;
 description?: string;
 count?: number;
}

// Initialize Fuse.js search instance
const createFuseInstance = (services: ServiceEntity[]) => {
 return new Fuse(services, {
 keys: [
 { name: 'metadata.name', weight: 3 },
 { name: 'metadata.title', weight: 2.5 },
 { name: 'metadata.description', weight: 1.5 },
 { name: 'metadata.tags', weight: 2 },
 { name: 'spec.owner', weight: 1 },
 { name: 'spec.system', weight: 1 },
 { name: 'metadata.labels', weight: 0.5 },
 ],
 threshold: 0.4,
 includeScore: true,
 includeMatches: true,
 minMatchCharLength: 2,
 shouldSort: true,
 ignoreLocation: true,
 useExtendedSearch: true,
 });
};

// Search suggestion item component
const SuggestionItem: React.FC<{
 suggestion: SearchSuggestion;
 isActive: boolean;
 onClick: () => void;
}> = ({ suggestion, isActive, onClick }) => {
 const iconMap = {
 service: <Hash className="w-4 h-4" />,
 tag: <Tag className="w-4 h-4" />,
 owner: <User className="w-4 h-4" />,
 query: <Search className="w-4 h-4" />,
 system: <Sparkles className="w-4 h-4" />,
 };

 return (
 <button
 onClick={onClick}
 className={cn(
 'flex items-center gap-3 w-full px-4 py-2 text-left',
 'hover:bg-accent hover:text-accent-foreground',
 'transition-colors duration-150',
 isActive && 'bg-accent text-accent-foreground'
 )}
 >
 <span className="text-muted-foreground">
 {suggestion.icon || iconMap[suggestion.type]}
 </span>
 
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="font-medium truncate">{suggestion.label}</span>
 {suggestion.count !== undefined && (
 <span className="text-xs text-muted-foreground">
 ({suggestion.count})
 </span>
 )}
 </div>
 {suggestion.description && (
 <p className="text-xs text-muted-foreground truncate">
 {suggestion.description}
 </p>
 )}
 </div>
 
 <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
 </button>
 );
};

// Main search bar component
export const SearchBar: React.FC<SearchBarProps> = ({
 services,
 value = '',
 onChange,
 onSelect,
 placeholder = 'Search services, APIs, owners, tags...',
 className,
 showSuggestions = true,
 showRecentSearches = true,
 recentSearches = [],
 popularSearches = [],
 onClear,
}) => {
 const [localValue, setLocalValue] = useState(value);
 const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
 const [showDropdown, setShowDropdown] = useState(false);
 const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
 const [isSearching, setIsSearching] = useState(false);
 
 const inputRef = useRef<HTMLInputElement>(null);
 const dropdownRef = useRef<HTMLDivElement>(null);
 const fuseRef = useRef<Fuse<ServiceEntity>>();
 
 const debouncedValue = useDebounce(localValue, 200);

 // Initialize Fuse instance
 useEffect(() => {
 fuseRef.current = createFuseInstance(services);
 }, [services]);

 // Generate suggestions based on search input
 const generateSuggestions = useCallback((searchValue: string): SearchSuggestion[] => {
 if (!searchValue.trim() || !fuseRef.current) {
 return [];
 }

 setIsSearching(true);
 const results: SearchSuggestion[] = [];
 
 // Search for services
 const fuseResults = fuseRef.current.search(searchValue, { limit: 5 });
 
 fuseResults.forEach(result => {
 results.push({
 type: 'service',
 label: result.item.metadata.title || result.item.metadata.name,
 value: result.item.metadata.name,
 entity: result.item,
 description: result.item.metadata.description,
 });
 });

 // Extract and suggest tags
 const tagMatches = new Map<string, number>();
 services.forEach(service => {
 service.metadata.tags?.forEach(tag => {
 if (tag.toLowerCase().includes(searchValue.toLowerCase())) {
 tagMatches.set(tag, (tagMatches.get(tag) || 0) + 1);
 }
 });
 });

 Array.from(tagMatches.entries())
 .sort((a, b) => b[1] - a[1])
 .slice(0, 3)
 .forEach(([tag, count]) => {
 results.push({
 type: 'tag',
 label: tag,
 value: `tag:${tag}`,
 count,
 });
 });

 // Extract and suggest owners
 const ownerMatches = new Map<string, number>();
 services.forEach(service => {
 const owner = service.spec.owner.replace('group:', '').replace('user:', '');
 if (owner.toLowerCase().includes(searchValue.toLowerCase())) {
 ownerMatches.set(owner, (ownerMatches.get(owner) || 0) + 1);
 }
 });

 Array.from(ownerMatches.entries())
 .sort((a, b) => b[1] - a[1])
 .slice(0, 2)
 .forEach(([owner, count]) => {
 results.push({
 type: 'owner',
 label: owner,
 value: `owner:${owner}`,
 count,
 });
 });

 setIsSearching(false);
 return results;
 }, [services]);

 // Handle search input changes
 useEffect(() => {
 if (debouncedValue) {
 const newSuggestions = generateSuggestions(debouncedValue);
 setSuggestions(newSuggestions);
 setShowDropdown(true);
 } else if (showRecentSearches && recentSearches.length > 0) {
 // Show recent searches when input is empty
 const recentSuggestions: SearchSuggestion[] = recentSearches.map(search => ({
 type: 'query',
 label: search,
 value: search,
 icon: <Clock className="w-4 h-4" />,
 }));
 setSuggestions(recentSuggestions);
 } else {
 setSuggestions([]);
 }
 }, [debouncedValue, generateSuggestions, showRecentSearches, recentSearches]);

 // Handle input changes
 const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
 const newValue = e.target.value;
 setLocalValue(newValue);
 onChange?.(newValue);
 setActiveSuggestionIndex(-1);
 }, [onChange]);

 // Handle suggestion selection
 const handleSuggestionClick = useCallback((suggestion: SearchSuggestion) => {
 if (suggestion.type === 'service' && suggestion.entity) {
 onSelect?.(suggestion.entity);
 setShowDropdown(false);
 } else {
 setLocalValue(suggestion.value);
 onChange?.(suggestion.value);
 }
 
 inputRef.current?.focus();
 }, [onChange, onSelect]);

 // Keyboard navigation
 const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
 if (!showDropdown || suggestions.length === 0) return;

 switch (e.key) {
 case 'ArrowDown':
 e.preventDefault();
 setActiveSuggestionIndex(prev => 
 prev < suggestions.length - 1 ? prev + 1 : 0
 );
 break;
 
 case 'ArrowUp':
 e.preventDefault();
 setActiveSuggestionIndex(prev => 
 prev > 0 ? prev - 1 : suggestions.length - 1
 );
 break;
 
 case 'Enter':
 e.preventDefault();
 if (activeSuggestionIndex >= 0) {
 handleSuggestionClick(suggestions[activeSuggestionIndex]);
 }
 break;
 
 case 'Escape':
 setShowDropdown(false);
 setActiveSuggestionIndex(-1);
 break;
 }
 }, [showDropdown, suggestions, activeSuggestionIndex, handleSuggestionClick]);

 // Clear search
 const handleClear = useCallback(() => {
 setLocalValue('');
 onChange?.('');
 onClear?.();
 inputRef.current?.focus();
 }, [onChange, onClear]);

 // Click outside to close dropdown
 useEffect(() => {
 const handleClickOutside = (event: MouseEvent) => {
 if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
 setShowDropdown(false);
 }
 };

 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }, []);

 // Popular searches section
 const showPopularSearches = popularSearches.length > 0 && !localValue && showDropdown;

 return (
 <div className={cn('relative', className)} ref={dropdownRef}>
 {/* Search input */}
 <div className="relative">
 <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
 <Search className={cn('w-5 h-5', isSearching && 'animate-pulse')} />
 </div>
 
 <input
 ref={inputRef}
 type="text"
 value={localValue}
 onChange={handleInputChange}
 onKeyDown={handleKeyDown}
 onFocus={() => setShowDropdown(true)}
 placeholder={placeholder}
 className={cn(
 'w-full pl-10 pr-10 py-2 rounded-lg border',
 'bg-background text-foreground',
 'placeholder:text-muted-foreground',
 'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
 'transition-all duration-200'
 )}
 aria-label="Search catalog"
 aria-autocomplete="list"
 aria-controls="search-suggestions"
 aria-expanded={showDropdown}
 />
 
 {/* Keyboard shortcut hint */}
 <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
 {localValue && (
 <button
 onClick={handleClear}
 className="p-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors"
 aria-label="Clear search"
 >
 <X className="w-4 h-4" />
 </button>
 )}
 
 <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border bg-muted text-muted-foreground">
 <Command className="w-3 h-3" />K
 </kbd>
 </div>
 </div>

 {/* Suggestions dropdown */}
 {showDropdown && (suggestions.length > 0 || showPopularSearches) && showSuggestions && (
 <div
 id="search-suggestions"
 className={cn(
 'absolute top-full left-0 right-0 mt-2 rounded-lg',
 'bg-popover border border-border shadow-lg',
 'max-h-96 overflow-y-auto z-50'
 )}
 role="listbox"
 >
 {/* Recent/Popular searches header */}
 {(showRecentSearches || showPopularSearches) && !localValue && (
 <div className="px-4 py-2 border-b border-border">
 <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-2">
 {showRecentSearches ? (
 <>
 <Clock className="w-3 h-3" />
 Recent Searches
 </>
 ) : (
 <>
 <TrendingUp className="w-3 h-3" />
 Popular Searches
 </>
 )}
 </h4>
 </div>
 )}

 {/* Suggestions list */}
 <div className="py-1">
 {suggestions.map((suggestion, index) => (
 <SuggestionItem
 key={`${suggestion.type}-${suggestion.value}`}
 suggestion={suggestion}
 isActive={index === activeSuggestionIndex}
 onClick={() => handleSuggestionClick(suggestion)}
 />
 ))}
 </div>

 {/* Search tips */}
 {localValue && suggestions.length > 0 && (
 <div className="px-4 py-2 border-t border-border bg-muted/50">
 <p className="text-xs text-muted-foreground">
 <span className="font-medium">Pro tip:</span> Use filters like{' '}
 <code className="px-1 py-0.5 rounded bg-background">owner:platform</code> or{' '}
 <code className="px-1 py-0.5 rounded bg-background">tag:frontend</code>
 </p>
 </div>
 )}
 </div>
 )}
 </div>
 );
};