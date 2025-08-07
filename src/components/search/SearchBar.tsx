'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Filter, TrendingUp, Clock, Command } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  onClear: () => void;
  placeholder?: string;
  showFilters?: boolean;
  onToggleFilters?: () => void;
  filtersActive?: boolean;
  suggestions?: SearchSuggestion[];
  popularQueries?: string[];
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

interface SearchSuggestion {
  text: string;
  type: 'completion' | 'correction' | 'filter' | 'related';
  score: number;
  metadata?: Record<string, any>;
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  onClear,
  placeholder = "Search catalog, docs, templates...",
  showFilters = true,
  onToggleFilters,
  filtersActive = false,
  suggestions = [],
  popularQueries = [],
  className,
  size = 'md'
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSuggestions, setCurrentSuggestions] = useState<SearchSuggestion[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const debouncedValue = useDebounce(value, 300);

  // Size variants
  const sizeVariants = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-12 text-lg'
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
  };

  // Fetch suggestions when debounced value changes
  useEffect(() => {
    if (debouncedValue.trim().length >= 2) {
      fetchSuggestions(debouncedValue);
    } else {
      setCurrentSuggestions([]);
    }
  }, [debouncedValue]);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data.success) {
        setCurrentSuggestions(data.data.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSearch(value);
    setShowSuggestions(false);
    inputRef.current?.blur();
  }, [value, onSearch]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setActiveSuggestionIndex(-1);
    setShowSuggestions(true);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const suggestionCount = currentSuggestions.length + (popularQueries.length > 0 && !value ? popularQueries.length : 0);
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveSuggestionIndex(prev => 
          prev < suggestionCount - 1 ? prev + 1 : prev
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setActiveSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
        
      case 'Enter':
        e.preventDefault();
        if (activeSuggestionIndex >= 0 && suggestionCount > 0) {
          // Handle suggestion selection
          if (!value && popularQueries.length > 0) {
            // Popular query selection
            if (activeSuggestionIndex < popularQueries.length) {
              const selectedQuery = popularQueries[activeSuggestionIndex];
              onChange(selectedQuery);
              onSearch(selectedQuery);
            }
          } else if (currentSuggestions.length > 0) {
            // Regular suggestion selection
            const selectedSuggestion = currentSuggestions[activeSuggestionIndex];
            if (selectedSuggestion) {
              onChange(selectedSuggestion.text);
              if (selectedSuggestion.type !== 'correction') {
                onSearch(selectedSuggestion.text);
              }
            }
          }
          setShowSuggestions(false);
        } else {
          handleSubmit(e);
        }
        break;
        
      case 'Escape':
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
        inputRef.current?.blur();
        break;
        
      case 'Tab':
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
        break;
    }
  }, [activeSuggestionIndex, currentSuggestions, popularQueries, value, onChange, onSearch, handleSubmit]);

  const handleSuggestionClick = useCallback((suggestion: SearchSuggestion) => {
    onChange(suggestion.text);
    if (suggestion.type !== 'correction') {
      onSearch(suggestion.text);
    }
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [onChange, onSearch]);

  const handlePopularQueryClick = useCallback((query: string) => {
    onChange(query);
    onSearch(query);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [onChange, onSearch]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setShowSuggestions(true);
  }, []);

  const handleBlur = useCallback(() => {
    // Delay hiding suggestions to allow for click events
    setTimeout(() => {
      setIsFocused(false);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }, 200);
  }, []);

  const handleClear = useCallback(() => {
    onChange('');
    onClear();
    setCurrentSuggestions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [onChange, onClear]);

  const getSuggestionIcon = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'correction': return '🔤';
      case 'filter': return '🏷️';
      case 'related': return '🔗';
      default: return '🔍';
    }
  };

  const displaySuggestions = showSuggestions && (currentSuggestions.length > 0 || (popularQueries.length > 0 && !value));

  return (
    <div className={cn("relative w-full", className)}>
      <form onSubmit={handleSubmit} className="relative">
        <div className={cn(
          "relative flex items-center w-full rounded-lg border bg-background transition-colors",
          "hover:border-primary/50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20",
          sizeVariants[size],
          isFocused && "border-primary ring-1 ring-primary/20",
          filtersActive && "border-orange-500/50 bg-orange-50/50"
        )}>
          <Search 
            className={cn(
              "absolute left-3 text-muted-foreground transition-colors",
              isFocused && "text-primary"
            )}
            size={iconSizes[size]}
          />
          
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className={cn(
              "flex-1 bg-transparent outline-none placeholder:text-muted-foreground",
              `pl-${iconSizes[size] + 24}`,
              showFilters ? "pr-20" : value ? "pr-10" : "pr-4"
            )}
            autoComplete="off"
            spellCheck="false"
          />

          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute right-16 flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
            </div>
          )}

          {/* Clear button */}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-10 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={iconSizes[size] - 4} />
            </button>
          )}

          {/* Filters button */}
          {showFilters && onToggleFilters && (
            <button
              type="button"
              onClick={onToggleFilters}
              className={cn(
                "absolute right-3 p-1 rounded transition-colors",
                "text-muted-foreground hover:text-foreground",
                filtersActive && "text-orange-600 bg-orange-100 hover:bg-orange-200"
              )}
              title="Toggle filters"
            >
              <Filter size={iconSizes[size] - 4} />
            </button>
          )}
        </div>

        {/* Search suggestions dropdown */}
        {displaySuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-auto">
            {/* Current suggestions */}
            {currentSuggestions.length > 0 && (
              <div>
                {currentSuggestions.map((suggestion, index) => (
                  <button
                    key={`suggestion-${index}`}
                    ref={el => suggestionRefs.current[index] = el}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                      "hover:bg-accent focus:bg-accent focus:outline-none",
                      activeSuggestionIndex === index && "bg-accent"
                    )}
                  >
                    <span className="text-lg">
                      {getSuggestionIcon(suggestion.type)}
                    </span>
                    <div className="flex-1">
                      <div className="font-medium">
                        {suggestion.text}
                      </div>
                      {suggestion.type === 'correction' && (
                        <div className="text-xs text-muted-foreground">
                          Did you mean...?
                        </div>
                      )}
                      {suggestion.metadata?.kind && (
                        <div className="text-xs text-muted-foreground">
                          {suggestion.metadata.kind}
                        </div>
                      )}
                    </div>
                    {suggestion.type === 'filter' && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        Filter
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Popular queries (shown when no input) */}
            {!value && popularQueries.length > 0 && (
              <div>
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground border-t border-border bg-accent/50">
                  <TrendingUp className="inline w-3 h-3 mr-1" />
                  Popular searches
                </div>
                {popularQueries.map((query, index) => {
                  const adjustedIndex = currentSuggestions.length + index;
                  return (
                    <button
                      key={`popular-${index}`}
                      ref={el => suggestionRefs.current[adjustedIndex] = el}
                      type="button"
                      onClick={() => handlePopularQueryClick(query)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                        "hover:bg-accent focus:bg-accent focus:outline-none",
                        activeSuggestionIndex === adjustedIndex && "bg-accent"
                      )}
                    >
                      <TrendingUp size={16} className="text-muted-foreground" />
                      <span className="flex-1">{query}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Keyboard shortcuts hint */}
            <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border bg-accent/30">
              <Command className="inline w-3 h-3 mr-1" />
              Use ↑↓ to navigate, Enter to select, Esc to close
            </div>
          </div>
        )}
      </form>
    </div>
  );
}