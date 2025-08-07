'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search,
  Filter,
  History,
  Bookmark,
  Wand2,
  Bot,
  Sparkles,
  Clock,
  Tag,
  User,
  Package,
  Settings,
  X,
  Plus,
  ArrowRight,
  Brain,
  Lightbulb,
  Target,
  Layers,
  Building2,
  Code,
  Zap,
  Eye,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from '@/services/backstage/types/entities';
import type {
  SearchFilters,
  SearchSuggestion,
  SearchHistory,
  QueryIntent,
  ParsedToken,
} from '@/lib/search/SemanticSearch';

interface SemanticSearchBarProps {
  entities: Entity[];
  onSearch: (query: string, filters: SearchFilters) => void;
  onFiltersChange: (filters: SearchFilters) => void;
  initialQuery?: string;
  initialFilters?: SearchFilters;
  suggestions: SearchSuggestion[];
  searchHistory: SearchHistory[];
  isLoading?: boolean;
  placeholder?: string;
  showQueryBuilder?: boolean;
  showSavedSearches?: boolean;
  className?: string;
}

interface VisualFilter {
  id: string;
  type: 'kind' | 'owner' | 'tag' | 'lifecycle' | 'namespace' | 'technology' | 'custom';
  label: string;
  value: string | string[];
  operator: 'equals' | 'contains' | 'startsWith' | 'in' | 'not';
  color?: string;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilters;
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
}

// Example patterns for query intent recognition
const QUERY_EXAMPLES: { [key: string]: string[] } = {
  basic: [
    'user service',
    'payment api',
    'frontend components',
  ],
  filtered: [
    'services owned by platform-team',
    'APIs tagged with authentication',
    'components in production lifecycle',
  ],
  complex: [
    'show me all Node.js services owned by platform team',
    'find databases used by user service',
    'list all APIs with health score above 80',
  ],
  technical: [
    'PostgreSQL databases',
    'React components',
    'Kubernetes services',
    'GraphQL APIs',
  ],
};

export function SemanticSearchBar({
  entities,
  onSearch,
  onFiltersChange,
  initialQuery = '',
  initialFilters = {},
  suggestions = [],
  searchHistory = [],
  isLoading = false,
  placeholder = 'Search catalog... (try: \"show me all Node.js services owned by platform team\")',
  showQueryBuilder = true,
  showSavedSearches = true,
  className,
}: SemanticSearchBarProps) {
  // State management
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [visualFilters, setVisualFilters] = useState<VisualFilter[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isQueryBuilderOpen, setIsQueryBuilderOpen] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [queryIntent, setQueryIntent] = useState<QueryIntent | null>(null);
  const [parsedTokens, setParsedTokens] = useState<ParsedToken[]>([]);
  const [showExamples, setShowExamples] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounced search query
  const debouncedQuery = useDebounce(query, 300);

  // Generate autocomplete suggestions
  const filteredSuggestions = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    
    return suggestions
      .filter(suggestion => 
        suggestion.query.toLowerCase().includes(query.toLowerCase()) &&
        suggestion.query !== query
      )
      .slice(0, 8);
  }, [query, suggestions]);

  // Parse query and extract intent
  useEffect(() => {
    if (query.trim()) {
      // Simulate query parsing (in real implementation, this would use SemanticSearch)
      const mockIntent: QueryIntent = {
        type: query.toLowerCase().startsWith('show') ? 'show' : 'search',
        category: query.toLowerCase().includes('service') ? 'service' : 'general',
        modifiers: [],
        negations: [],
      };
      setQueryIntent(mockIntent);

      // Mock token parsing
      const tokens: ParsedToken[] = query.split(' ').map(word => ({
        text: word,
        type: 'keyword',
        weight: 1.0,
      }));
      setParsedTokens(tokens);
    } else {
      setQueryIntent(null);
      setParsedTokens([]);
    }
  }, [query]);

  // Handle search execution
  const executeSearch = useCallback(() => {
    if (query.trim()) {
      onSearch(query, filters);
      setShowSuggestions(false);
      
      // Add to search history (simulate)
      // In real implementation, this would be handled by the SemanticSearch class
    }
  }, [query, filters, onSearch]);

  // Handle input changes
  const handleInputChange = (value: string) => {
    setQuery(value);
    setShowSuggestions(value.length > 0);
    setSelectedSuggestionIndex(-1);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredSuggestions.length === 0) {
      if (e.key === 'Enter') {
        executeSearch();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          const suggestion = filteredSuggestions[selectedSuggestionIndex];
          handleSuggestionSelect(suggestion);
        } else {
          executeSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.query);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    
    if (suggestion.type === 'filter') {
      // Parse filter suggestion and update filters
      // This would be implemented based on the specific filter format
    }
    
    // Execute search immediately
    setTimeout(() => executeSearch(), 100);
  };

  // Add visual filter
  const addVisualFilter = (type: VisualFilter['type'], value: string) => {
    const newFilter: VisualFilter = {
      id: Date.now().toString(),
      type,
      label: `${type}: ${value}`,
      value,
      operator: 'equals',
      color: getFilterColor(type),
    };
    setVisualFilters(prev => [...prev, newFilter]);
    updateFiltersFromVisual([...visualFilters, newFilter]);
  };

  // Remove visual filter
  const removeVisualFilter = (filterId: string) => {
    const updatedFilters = visualFilters.filter(f => f.id !== filterId);
    setVisualFilters(updatedFilters);
    updateFiltersFromVisual(updatedFilters);
  };

  // Update filters from visual filters
  const updateFiltersFromVisual = (visualFilters: VisualFilter[]) => {
    const newFilters: SearchFilters = {};
    
    visualFilters.forEach(filter => {
      const value = Array.isArray(filter.value) ? filter.value : [filter.value];
      
      switch (filter.type) {
        case 'kind':
          newFilters.kind = [...(newFilters.kind || []), ...value];
          break;
        case 'owner':
          newFilters.owner = [...(newFilters.owner || []), ...value];
          break;
        case 'tag':
          newFilters.tags = [...(newFilters.tags || []), ...value];
          break;
        case 'lifecycle':
          newFilters.lifecycle = [...(newFilters.lifecycle || []), ...value];
          break;
        case 'namespace':
          newFilters.namespace = [...(newFilters.namespace || []), ...value];
          break;
        case 'technology':
          newFilters.technology = [...(newFilters.technology || []), ...value];
          break;
      }
    });
    
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  // Get filter color based on type
  const getFilterColor = (type: VisualFilter['type']): string => {
    const colors = {
      kind: 'bg-blue-100 text-blue-800 border-blue-200',
      owner: 'bg-green-100 text-green-800 border-green-200',
      tag: 'bg-purple-100 text-purple-800 border-purple-200',
      lifecycle: 'bg-orange-100 text-orange-800 border-orange-200',
      namespace: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      technology: 'bg-pink-100 text-pink-800 border-pink-200',
      custom: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[type] || colors.custom;
  };

  // Save current search
  const saveCurrentSearch = () => {
    if (!query.trim()) return;
    
    const savedSearch: SavedSearch = {
      id: Date.now().toString(),
      name: query.slice(0, 50) + (query.length > 50 ? '...' : ''),
      query,
      filters,
      createdAt: new Date(),
      lastUsed: new Date(),
      useCount: 1,
    };
    
    setSavedSearches(prev => [savedSearch, ...prev.slice(0, 9)]); // Keep only 10 saved searches
  };

  // Load saved search
  const loadSavedSearch = (savedSearch: SavedSearch) => {
    setQuery(savedSearch.query);
    setFilters(savedSearch.filters);
    setVisualFilters([]); // Reset visual filters, they'll be rebuilt from filters
    executeSearch();
  };

  // Generate filter options from entities
  const filterOptions = useMemo(() => {
    const kinds = [...new Set(entities.map(e => e.kind))];
    const owners = [...new Set(entities.map(e => e.spec?.owner).filter(Boolean))];
    const lifecycles = [...new Set(entities.map(e => e.spec?.lifecycle).filter(Boolean))];
    const namespaces = [...new Set(entities.map(e => e.metadata.namespace || 'default'))];
    const allTags = entities.flatMap(e => e.metadata.tags || []);
    const tags = [...new Set(allTags)];
    
    return { kinds, owners, lifecycles, namespaces, tags };
  }, [entities]);

  return (
    <div className={cn('relative space-y-3', className)}>
      {/* Main Search Input */}
      <div className="relative">
        <div className="relative flex items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(query.length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={placeholder}
              className="pl-9 pr-32 text-sm"
              disabled={isLoading}
            />
            
            {/* Loading indicator */}
            {isLoading && (
              <Loader2 className="absolute right-24 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
            
            {/* Search actions */}
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
              {query && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setShowSuggestions(false);
                    inputRef.current?.focus();
                  }}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              
              {showQueryBuilder && (
                <Sheet open={isQueryBuilderOpen} onOpenChange={setIsQueryBuilderOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <Settings className="h-3 w-3" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[500px] sm:w-[600px]">
                    <QueryBuilderPanel
                      filters={visualFilters}
                      onAddFilter={addVisualFilter}
                      onRemoveFilter={removeVisualFilter}
                      filterOptions={filterOptions}
                    />
                  </SheetContent>
                </Sheet>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={executeSearch}
                disabled={!query.trim() || isLoading}
                className="h-6 px-2 text-xs"
              >
                Search
              </Button>
            </div>
          </div>
        </div>

        {/* Search Suggestions Dropdown */}
        {showSuggestions && (filteredSuggestions.length > 0 || searchHistory.length > 0) && (
          <Card className="absolute top-full left-0 right-0 z-50 mt-1 shadow-lg border">
            <CardContent className="p-0">
              <ScrollArea className="max-h-80">
                {/* Current Suggestions */}
                {filteredSuggestions.length > 0 && (
                  <div className="p-2">
                    <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                      <Sparkles className="h-3 w-3" />
                      Suggestions
                    </div>
                    {filteredSuggestions.map((suggestion, index) => (
                      <button
                        key={`suggestion-${index}`}
                        onClick={() => handleSuggestionSelect(suggestion)}
                        className={cn(
                          'w-full flex items-center gap-2 px-2 py-2 rounded text-sm text-left hover:bg-muted',
                          selectedSuggestionIndex === index && 'bg-muted'
                        )}
                      >
                        {getSuggestionIcon(suggestion.type)}
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{suggestion.query}</div>
                          {suggestion.category && (
                            <div className="text-xs text-muted-foreground">
                              {suggestion.category}
                            </div>
                          )}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {suggestion.type}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}

                {/* Search History */}
                {searchHistory.length > 0 && (
                  <>
                    {filteredSuggestions.length > 0 && <Separator />}
                    <div className="p-2">
                      <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground">
                        <History className="h-3 w-3" />
                        Recent Searches
                      </div>
                      {searchHistory.slice(0, 3).map((history, index) => (
                        <button
                          key={`history-${index}`}
                          onClick={() => {
                            setQuery(history.query);
                            executeSearch();
                          }}
                          className="w-full flex items-center gap-2 px-2 py-2 rounded text-sm text-left hover:bg-muted"
                        >
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{history.query}</div>
                            <div className="text-xs text-muted-foreground">
                              {history.resultCount} results • {history.timestamp.toLocaleDateString()}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* Query Examples */}
                <Separator />
                <div className="p-2">
                  <button
                    onClick={() => setShowExamples(!showExamples)}
                    className="w-full flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Lightbulb className="h-3 w-3" />
                    Query Examples
                    {showExamples ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  
                  {showExamples && (
                    <div className="mt-1 space-y-1">
                      {Object.entries(QUERY_EXAMPLES).map(([category, examples]) => (
                        <div key={category}>
                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground capitalize">
                            {category}
                          </div>
                          {examples.slice(0, 2).map((example, index) => (
                            <button
                              key={`${category}-${index}`}
                              onClick={() => {
                                setQuery(example);
                                setShowSuggestions(false);
                                setTimeout(() => executeSearch(), 100);
                              }}
                              className="w-full px-2 py-1 text-xs text-left hover:bg-muted rounded text-muted-foreground"
                            >
                              "{example}"
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Query Intent Display */}
      {queryIntent && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Brain className="h-3 w-3" />
          <span>Intent:</span>
          <Badge variant="outline" className="text-xs">
            {queryIntent.type}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {queryIntent.category}
          </Badge>
          {queryIntent.negations.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              excluding {queryIntent.negations.join(', ')}
            </Badge>
          )}
        </div>
      )}

      {/* Visual Filters */}
      {visualFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filters:</span>
          {visualFilters.map((filter) => (
            <Badge
              key={filter.id}
              variant="secondary"
              className={cn('flex items-center gap-1 text-xs', filter.color)}
            >
              {getFilterTypeIcon(filter.type)}
              {filter.label}
              <button
                onClick={() => removeVisualFilter(filter.id)}
                className="ml-1 hover:bg-black/10 rounded-full p-0.5"
              >
                <X className="h-2 w-2" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setVisualFilters([]);
              setFilters({});
              onFiltersChange({});
            }}
            className="h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}
      
      {/* Saved Searches */}
      {showSavedSearches && savedSearches.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Saved:</span>
          <div className="flex flex-wrap gap-1">
            {savedSearches.slice(0, 3).map((savedSearch) => (
              <Button
                key={savedSearch.id}
                variant="outline"
                size="sm"
                onClick={() => loadSavedSearch(savedSearch)}
                className="h-6 px-2 text-xs"
              >
                <Bookmark className="h-2 w-2 mr-1" />
                {savedSearch.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={saveCurrentSearch}
          disabled={!query.trim()}
          className="text-xs"
        >
          <Bookmark className="h-3 w-3 mr-1" />
          Save Search
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          className="text-xs"
        >
          <Filter className="h-3 w-3 mr-1" />
          Advanced
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Open help dialog or documentation
          }}
          className="text-xs"
        >
          <HelpCircle className="h-3 w-3 mr-1" />
          Help
        </Button>
      </div>
    </div>
  );
}

// Helper component for query builder
function QueryBuilderPanel({
  filters,
  onAddFilter,
  onRemoveFilter,
  filterOptions,
}: {
  filters: VisualFilter[];
  onAddFilter: (type: VisualFilter['type'], value: string) => void;
  onRemoveFilter: (filterId: string) => void;
  filterOptions: {
    kinds: string[];
    owners: string[];
    lifecycles: string[];
    namespaces: string[];
    tags: string[];
  };
}) {
  const [selectedFilterType, setSelectedFilterType] = useState<VisualFilter['type']>('kind');
  const [filterValue, setFilterValue] = useState('');

  const handleAddFilter = () => {
    if (filterValue.trim()) {
      onAddFilter(selectedFilterType, filterValue.trim());
      setFilterValue('');
    }
  };

  return (
    <div className="space-y-4">
      <SheetHeader>
        <SheetTitle>Visual Query Builder</SheetTitle>
        <SheetDescription>
          Build complex queries using visual filters and conditions
        </SheetDescription>
      </SheetHeader>

      {/* Add Filter Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="filter-type" className="text-xs">Filter Type</Label>
              <Select value={selectedFilterType} onValueChange={(value) => setSelectedFilterType(value as VisualFilter['type'])}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kind">Kind</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="tag">Tag</SelectItem>
                  <SelectItem value="lifecycle">Lifecycle</SelectItem>
                  <SelectItem value="namespace">Namespace</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="filter-value" className="text-xs">Value</Label>
              <div className="flex gap-1">
                <Input
                  id="filter-value"
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  placeholder="Enter value"
                  className="h-8 text-xs"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFilter()}
                />
                <Button size="sm" onClick={handleAddFilter} className="h-8 px-2">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Select Options */}
          {selectedFilterType === 'kind' && filterOptions.kinds.length > 0 && (
            <div>
              <Label className="text-xs">Quick Select:</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {filterOptions.kinds.map((kind) => (
                  <Button
                    key={kind}
                    variant="outline"
                    size="sm"
                    onClick={() => onAddFilter('kind', kind)}
                    className="h-6 px-2 text-xs"
                  >
                    {kind}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Filters */}
      {filters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filters.map((filter) => (
                <div key={filter.id} className="flex items-center justify-between p-2 rounded border">
                  <div className="flex items-center gap-2">
                    {getFilterTypeIcon(filter.type)}
                    <span className="text-sm">{filter.label}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveFilter(filter.id)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Helper functions
function getSuggestionIcon(type: SearchSuggestion['type']) {
  switch (type) {
    case 'completion':
      return <Target className="h-3 w-3 text-muted-foreground" />;
    case 'correction':
      return <Wand2 className="h-3 w-3 text-muted-foreground" />;
    case 'related':
      return <ArrowRight className="h-3 w-3 text-muted-foreground" />;
    case 'filter':
      return <Filter className="h-3 w-3 text-muted-foreground" />;
    default:
      return <Search className="h-3 w-3 text-muted-foreground" />;
  }
}

function getFilterTypeIcon(type: VisualFilter['type']) {
  switch (type) {
    case 'kind':
      return <Package className="h-3 w-3" />;
    case 'owner':
      return <User className="h-3 w-3" />;
    case 'tag':
      return <Tag className="h-3 w-3" />;
    case 'lifecycle':
      return <Zap className="h-3 w-3" />;
    case 'namespace':
      return <Building2 className="h-3 w-3" />;
    case 'technology':
      return <Code className="h-3 w-3" />;
    default:
      return <Filter className="h-3 w-3" />;
  }
}