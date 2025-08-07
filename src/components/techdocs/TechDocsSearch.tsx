'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  FileText,
  Hash,
  Clock,
  TrendingUp,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface TechDocsSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

interface SearchResult {
  id: string;
  title: string;
  path: string;
  snippet: string;
  type: 'page' | 'section' | 'code';
  entity?: string;
  relevance: number;
}

export function TechDocsSearch({
  onSearch,
  placeholder = 'Search documentation...',
  className,
}: TechDocsSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [popularSearches] = useState<string[]>([
    'API Reference',
    'Getting Started',
    'Configuration',
    'Deployment',
    'Authentication',
  ]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem('techdocs-recent-searches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    // Keyboard shortcut to open search
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (query.length > 2) {
      performSearch(query);
    } else {
      setResults([]);
    }
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    
    // Simulate search API call
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock search results
    const mockResults: SearchResult[] = [
      {
        id: '1',
        title: 'Getting Started with ' + searchQuery,
        path: '/docs/getting-started',
        snippet: 'Learn how to get started with our platform and set up your first project...',
        type: 'page',
        entity: 'backstage-backend',
        relevance: 0.95,
      },
      {
        id: '2',
        title: 'API Reference',
        path: '/docs/api-reference',
        snippet: `API documentation for ${searchQuery} endpoints and authentication...`,
        type: 'section',
        entity: 'user-service',
        relevance: 0.85,
      },
      {
        id: '3',
        title: 'Configuration Options',
        path: '/docs/configuration',
        snippet: `Configure ${searchQuery} using environment variables and config files...`,
        type: 'page',
        entity: 'backstage-backend',
        relevance: 0.75,
      },
      {
        id: '4',
        title: 'Code Example',
        path: '/docs/examples',
        snippet: `\`\`\`javascript\nconst ${searchQuery} = require('${searchQuery}');\n\`\`\``,
        type: 'code',
        entity: 'user-service',
        relevance: 0.65,
      },
    ];
    
    setResults(mockResults.filter(r => r.relevance > 0.5));
    setLoading(false);
  };

  const handleSearch = (searchQuery: string) => {
    if (searchQuery) {
      // Add to recent searches
      const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('techdocs-recent-searches', JSON.stringify(updated));
      
      onSearch(searchQuery);
      setOpen(false);
      setQuery('');
    }
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('techdocs-recent-searches');
  };

  return (
    <>
      <div className={cn("relative", className)}>
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          className="w-full justify-start text-muted-foreground"
        >
          <Search className="mr-2 h-4 w-4" />
          {placeholder}
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          ref={inputRef}
          placeholder={placeholder}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <CommandEmpty>
              <Loader2 className="h-4 w-4 animate-spin mx-auto" />
              <p className="mt-2">Searching...</p>
            </CommandEmpty>
          )}

          {!loading && query && results.length === 0 && (
            <CommandEmpty>
              No results found for "{query}"
            </CommandEmpty>
          )}

          {!loading && query && results.length > 0 && (
            <CommandGroup heading="Search Results">
              {results.map((result) => (
                <CommandItem
                  key={result.id}
                  onSelect={() => handleSearch(result.title)}
                >
                  <div className="flex items-start gap-3 w-full">
                    <div className="mt-1">
                      {result.type === 'page' ? (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      ) : result.type === 'section' ? (
                        <Hash className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <span className="text-xs font-mono text-muted-foreground">{'{ }'}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{result.title}</span>
                        {result.entity && (
                          <Badge variant="outline" className="text-xs">
                            {result.entity}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {result.snippet}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {result.path}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!query && recentSearches.length > 0 && (
            <CommandGroup heading="Recent Searches">
              {recentSearches.map((search) => (
                <CommandItem
                  key={search}
                  onSelect={() => {
                    setQuery(search);
                    handleSearch(search);
                  }}
                >
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  {search}
                </CommandItem>
              ))}
              <CommandItem onSelect={clearRecentSearches}>
                <X className="mr-2 h-4 w-4 text-muted-foreground" />
                Clear recent searches
              </CommandItem>
            </CommandGroup>
          )}

          {!query && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Popular Searches">
                {popularSearches.map((search) => (
                  <CommandItem
                    key={search}
                    onSelect={() => {
                      setQuery(search);
                      handleSearch(search);
                    }}
                  >
                    <TrendingUp className="mr-2 h-4 w-4 text-muted-foreground" />
                    {search}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}