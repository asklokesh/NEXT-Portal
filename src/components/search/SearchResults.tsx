'use client';

import React, { useState, useCallback } from 'react';
import { 
  ExternalLink, 
  Clock, 
  User, 
  Tag, 
  Activity,
  Heart,
  Eye,
  ChevronRight,
  Layers,
  Code,
  FileText,
  Template,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

export interface SearchResultItem {
  id: string;
  title: string;
  description?: string;
  kind: string;
  owner?: string;
  tags: string[];
  url?: string;
  score: number;
  highlights: Record<string, string[]>;
  metadata: {
    namespace?: string;
    lifecycle?: string;
    healthScore?: number;
    lastUpdated?: string;
    technologies?: string[];
    languages?: string[];
  };
  source: any;
}

export interface SearchResultsProps {
  results: SearchResultItem[];
  total: number;
  loading?: boolean;
  error?: string;
  query?: string;
  from?: number;
  size?: number;
  took?: number;
  onResultClick?: (result: SearchResultItem, position: number) => void;
  onLoadMore?: () => void;
  onSortChange?: (sort: string) => void;
  sortBy?: string;
  className?: string;
}

const sortOptions = [
  { value: '_score:desc', label: 'Relevance' },
  { value: 'lastUpdated:desc', label: 'Recently Updated' },
  { value: 'name:asc', label: 'Name (A-Z)' },
  { value: 'name:desc', label: 'Name (Z-A)' },
  { value: 'healthScore:desc', label: 'Health Score' },
  { value: 'kind:asc', label: 'Kind' }
];

export function SearchResults({
  results,
  total,
  loading = false,
  error,
  query,
  from = 0,
  size = 20,
  took,
  onResultClick,
  onLoadMore,
  onSortChange,
  sortBy = '_score:desc',
  className
}: SearchResultsProps) {
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((resultId: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  }, []);

  const handleResultClick = useCallback((result: SearchResultItem, index: number) => {
    onResultClick?.(result, from + index);
    
    // Track click analytics
    if (query) {
      fetch('/api/search/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track-click',
          query,
          entityId: result.id,
          position: from + index
        })
      }).catch(console.error);
    }
  }, [onResultClick, from, query]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  };

  const getKindIcon = (kind: string) => {
    switch (kind.toLowerCase()) {
      case 'component': return Layers;
      case 'api': return Code;
      case 'resource': return FileText;
      case 'template': return Template;
      case 'system': return Activity;
      case 'domain': return Activity;
      default: return Layers;
    }
  };

  const getKindColor = (kind: string) => {
    switch (kind.toLowerCase()) {
      case 'component': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'api': return 'bg-green-100 text-green-800 border-green-200';
      case 'resource': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'template': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'system': return 'bg-red-100 text-red-800 border-red-200';
      case 'domain': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getHealthScoreColor = (score?: number) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getHealthScoreIcon = (score?: number) => {
    if (!score) return Activity;
    if (score >= 80) return Heart;
    if (score >= 60) return Activity;
    return Activity;
  };

  const highlightText = (text: string, highlights?: string[]) => {
    if (!highlights || highlights.length === 0) return text;
    
    // Use the first highlight if available
    const highlight = highlights[0];
    if (highlight) {
      return <span dangerouslySetInnerHTML={{ __html: highlight }} />;
    }
    
    return text;
  };

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12", className)}>
        <Search className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Search Error</h3>
        <p className="text-muted-foreground text-center max-w-md">
          {error}
        </p>
      </div>
    );
  }

  if (loading && results.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
                <div className="h-6 w-16 bg-gray-200 rounded" />
              </div>
              <div className="h-3 bg-gray-200 rounded w-full mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/3" />
              <div className="flex gap-2 mt-4">
                <div className="h-5 w-12 bg-gray-200 rounded" />
                <div className="h-5 w-16 bg-gray-200 rounded" />
                <div className="h-5 w-14 bg-gray-200 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (results.length === 0 && !loading) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12", className)}>
        <Search className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No results found</h3>
        <p className="text-muted-foreground text-center max-w-md">
          {query ? (
            <>
              No results found for "<strong>{query}</strong>". 
              Try adjusting your search terms or filters.
            </>
          ) : (
            'No results found. Try entering a search query.'
          )}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search results header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString()} results
            {query && (
              <>
                {' '}for "<strong>{query}</strong>"
              </>
            )}
            {took && (
              <span className="ml-2">({took}ms)</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Search results */}
      <div className="space-y-3">
        {results.map((result, index) => {
          const KindIcon = getKindIcon(result.kind);
          const HealthIcon = getHealthScoreIcon(result.metadata.healthScore);
          const isExpanded = expandedResults.has(result.id);
          
          return (
            <Card 
              key={result.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleResultClick(result, index)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", getKindColor(result.kind))}
                      >
                        <KindIcon className="w-3 h-3 mr-1" />
                        {result.kind}
                      </Badge>
                      
                      {result.metadata.namespace && (
                        <Badge variant="outline" className="text-xs">
                          {result.metadata.namespace}
                        </Badge>
                      )}

                      {result.metadata.lifecycle && (
                        <Badge variant="outline" className="text-xs">
                          <Activity className="w-3 h-3 mr-1" />
                          {result.metadata.lifecycle}
                        </Badge>
                      )}

                      {result.metadata.healthScore && (
                        <div className={cn(
                          "flex items-center gap-1 text-xs",
                          getHealthScoreColor(result.metadata.healthScore)
                        )}>
                          <HealthIcon className="w-3 h-3" />
                          {result.metadata.healthScore}%
                        </div>
                      )}
                    </div>

                    <h3 className="text-lg font-semibold text-foreground mb-1 truncate">
                      {highlightText(result.title, result.highlights.title || result.highlights.name)}
                    </h3>

                    {result.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {highlightText(result.description, result.highlights.description)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        Score: {Math.round(result.score * 100)}%
                      </div>
                      {result.url && (
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Metadata row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  {result.owner && (
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {result.owner}
                    </div>
                  )}

                  {result.metadata.lastUpdated && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(result.metadata.lastUpdated)}
                    </div>
                  )}

                  {result.metadata.technologies?.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Code className="w-3 h-3" />
                      {result.metadata.technologies.slice(0, 2).join(', ')}
                      {result.metadata.technologies.length > 2 && (
                        <span>+{result.metadata.technologies.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Tags */}
                {result.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {result.tags.slice(0, isExpanded ? undefined : 3).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        <Tag className="w-2.5 h-2.5 mr-1" />
                        {highlightText(tag, result.highlights.tags)}
                      </Badge>
                    ))}
                    {!isExpanded && result.tags.length > 3 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(result.id);
                        }}
                        className="h-5 px-2 text-xs"
                      >
                        +{result.tags.length - 3} more
                      </Button>
                    )}
                  </div>
                )}

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t pt-3 mt-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {result.metadata.languages?.length > 0 && (
                        <div>
                          <span className="font-medium">Languages:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.metadata.languages.map(lang => (
                              <Badge key={lang} variant="outline" className="text-xs">
                                {lang}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.metadata.technologies?.length > 0 && (
                        <div>
                          <span className="font-medium">Technologies:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {result.metadata.technologies.map(tech => (
                              <Badge key={tech} variant="outline" className="text-xs">
                                {tech}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(result.id);
                      }}
                      className="mt-2"
                    >
                      Show less
                    </Button>
                  </div>
                )}

                {/* Expand/collapse toggle */}
                {!isExpanded && (result.metadata.languages?.length > 0 || result.metadata.technologies?.length > 3) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(result.id);
                    }}
                    className="mt-2"
                  >
                    <ChevronRight className="w-4 h-4 mr-1" />
                    Show more details
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Load more button */}
      {results.length > 0 && results.length < total && onLoadMore && (
        <div className="flex justify-center pt-6">
          <Button 
            onClick={onLoadMore} 
            disabled={loading}
            variant="outline"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent mr-2" />
                Loading...
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Load more results ({total - results.length} remaining)
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}