'use client';

import React, { useState, useCallback } from 'react';
import { 
  Filter, 
  X, 
  ChevronDown, 
  Search,
  Calendar,
  Users,
  Tag,
  Layers,
  Activity,
  Code,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';

export interface SearchFilters {
  kind?: string[];
  owner?: string[];
  tags?: string[];
  lifecycle?: string[];
  namespace?: string[];
  technology?: string[];
  healthScore?: {
    min?: number;
    max?: number;
  };
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  facets?: SearchFacets;
  onClear: () => void;
  className?: string;
}

export interface SearchFacets {
  kinds: FacetBucket[];
  owners: FacetBucket[];
  tags: FacetBucket[];
  technologies: FacetBucket[];
  lifecycles: FacetBucket[];
  healthScores: {
    min: number;
    max: number;
    avg: number;
  };
}

interface FacetBucket {
  key: string;
  count: number;
  selected?: boolean;
}

export function SearchFilters({
  filters,
  onFiltersChange,
  facets,
  onClear,
  className
}: SearchFiltersProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [facetSearch, setFacetSearch] = useState<Record<string, string>>({});

  const hasActiveFilters = Object.values(filters).some(value => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => v !== undefined);
    }
    return false;
  });

  const getActiveFilterCount = useCallback(() => {
    let count = 0;
    Object.entries(filters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        count += value.length;
      } else if (key === 'healthScore' && value) {
        if (value.min !== undefined || value.max !== undefined) count++;
      } else if (key === 'dateRange' && value) {
        if (value.start || value.end) count++;
      }
    });
    return count;
  }, [filters]);

  const updateFilter = useCallback((key: keyof SearchFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  }, [filters, onFiltersChange]);

  const toggleArrayFilter = useCallback((key: keyof SearchFilters, item: string) => {
    const currentArray = (filters[key] as string[]) || [];
    const newArray = currentArray.includes(item)
      ? currentArray.filter(i => i !== item)
      : [...currentArray, item];
    
    updateFilter(key, newArray.length > 0 ? newArray : undefined);
  }, [filters, updateFilter]);

  const removeFilter = useCallback((key: keyof SearchFilters, item?: string) => {
    if (item && Array.isArray(filters[key])) {
      const newArray = (filters[key] as string[]).filter(i => i !== item);
      updateFilter(key, newArray.length > 0 ? newArray : undefined);
    } else {
      updateFilter(key, undefined);
    }
  }, [filters, updateFilter]);

  const searchFacet = useCallback((facetName: string, query: string) => {
    setFacetSearch(prev => ({
      ...prev,
      [facetName]: query
    }));
  }, []);

  const filterFacetOptions = (options: FacetBucket[], facetName: string) => {
    const searchQuery = facetSearch[facetName]?.toLowerCase() || '';
    if (!searchQuery) return options;
    return options.filter(option => 
      option.key.toLowerCase().includes(searchQuery)
    );
  };

  const renderArrayFilter = (
    key: keyof SearchFilters,
    label: string,
    icon: React.ReactNode,
    options: FacetBucket[] = []
  ) => {
    const selectedValues = (filters[key] as string[]) || [];
    const filteredOptions = filterFacetOptions(options, key);

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className={cn(
              "justify-between",
              selectedValues.length > 0 && "border-primary bg-primary/5"
            )}
          >
            <div className="flex items-center gap-2">
              {icon}
              {label}
              {selectedValues.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                  {selectedValues.length}
                </Badge>
              )}
            </div>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-4 border-b">
            <div className="flex items-center gap-2 mb-2">
              {icon}
              <span className="font-medium">{label}</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${label.toLowerCase()}...`}
                value={facetSearch[key] || ''}
                onChange={(e) => searchFacet(key, e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-auto p-2">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.key}
                  className="flex items-center space-x-2 p-2 hover:bg-accent rounded-sm cursor-pointer"
                  onClick={() => toggleArrayFilter(key, option.key)}
                >
                  <Checkbox
                    checked={selectedValues.includes(option.key)}
                    onChange={() => {}} // Handled by onClick above
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm">{option.key}</span>
                    <Badge variant="outline" className="text-xs">
                      {option.count}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No {label.toLowerCase()} found
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Kind Filter */}
      {renderArrayFilter(
        'kind',
        'Kind',
        <Layers className="h-4 w-4" />,
        facets?.kinds
      )}

      {/* Owner Filter */}
      {renderArrayFilter(
        'owner',
        'Owner',
        <Users className="h-4 w-4" />,
        facets?.owners
      )}

      {/* Tags Filter */}
      {renderArrayFilter(
        'tags',
        'Tags',
        <Tag className="h-4 w-4" />,
        facets?.tags
      )}

      {/* Lifecycle Filter */}
      {renderArrayFilter(
        'lifecycle',
        'Lifecycle',
        <Activity className="h-4 w-4" />,
        facets?.lifecycles
      )}

      {/* Technology Filter */}
      {renderArrayFilter(
        'technology',
        'Technology',
        <Code className="h-4 w-4" />,
        facets?.technologies
      )}

      {/* Health Score Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className={cn(
              "justify-between",
              (filters.healthScore?.min !== undefined || filters.healthScore?.max !== undefined) && 
              "border-primary bg-primary/5"
            )}
          >
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Health Score
              {(filters.healthScore?.min !== undefined || filters.healthScore?.max !== undefined) && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                  1
                </Badge>
              )}
            </div>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <div>
              <Label>Health Score Range</Label>
              <div className="mt-2">
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[
                    filters.healthScore?.min || 0,
                    filters.healthScore?.max || 100
                  ]}
                  onValueChange={([min, max]) => {
                    updateFilter('healthScore', { min, max });
                  }}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{filters.healthScore?.min || 0}</span>
                  <span>{filters.healthScore?.max || 100}</span>
                </div>
              </div>
            </div>
            {facets?.healthScores && (
              <div className="text-sm text-muted-foreground">
                Average: {facets.healthScores.avg}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Date Range Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            className={cn(
              "justify-between",
              (filters.dateRange?.start || filters.dateRange?.end) && 
              "border-primary bg-primary/5"
            )}
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Last Updated
              {(filters.dateRange?.start || filters.dateRange?.end) && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                  1
                </Badge>
              )}
            </div>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4">
            <div className="mb-4">
              <Label>Select Date Range</Label>
            </div>
            <div className="flex gap-4">
              <div>
                <Label className="text-xs">From</Label>
                <Input
                  type="date"
                  value={filters.dateRange?.start ? 
                    filters.dateRange.start.toISOString().split('T')[0] : 
                    ''
                  }
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : undefined;
                    updateFilter('dateRange', {
                      ...filters.dateRange,
                      start: date
                    });
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Input
                  type="date"
                  value={filters.dateRange?.end ? 
                    filters.dateRange.end.toISOString().split('T')[0] : 
                    ''
                  }
                  onChange={(e) => {
                    const date = e.target.value ? new Date(e.target.value) : undefined;
                    updateFilter('dateRange', {
                      ...filters.dateRange,
                      end: date
                    });
                  }}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const sevenDaysAgo = new Date();
                  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                  updateFilter('dateRange', {
                    start: sevenDaysAgo,
                    end: new Date()
                  });
                }}
              >
                Last 7 days
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const thirtyDaysAgo = new Date();
                  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                  updateFilter('dateRange', {
                    start: thirtyDaysAgo,
                    end: new Date()
                  });
                }}
              >
                Last 30 days
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filters display */}
      {hasActiveFilters && (
        <>
          <Separator orientation="vertical" className="h-6" />
          
          <div className="flex flex-wrap gap-1">
            {/* Kind filters */}
            {filters.kind?.map(kind => (
              <Badge
                key={`kind-${kind}`}
                variant="secondary"
                className="gap-1 pr-1"
              >
                <Layers className="h-3 w-3" />
                {kind}
                <button
                  onClick={() => removeFilter('kind', kind)}
                  className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}

            {/* Owner filters */}
            {filters.owner?.map(owner => (
              <Badge
                key={`owner-${owner}`}
                variant="secondary"
                className="gap-1 pr-1"
              >
                <Users className="h-3 w-3" />
                {owner}
                <button
                  onClick={() => removeFilter('owner', owner)}
                  className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}

            {/* Tag filters */}
            {filters.tags?.map(tag => (
              <Badge
                key={`tag-${tag}`}
                variant="secondary"
                className="gap-1 pr-1"
              >
                <Tag className="h-3 w-3" />
                {tag}
                <button
                  onClick={() => removeFilter('tags', tag)}
                  className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}

            {/* Health score filter */}
            {(filters.healthScore?.min !== undefined || filters.healthScore?.max !== undefined) && (
              <Badge variant="secondary" className="gap-1 pr-1">
                <Activity className="h-3 w-3" />
                Health: {filters.healthScore.min || 0}-{filters.healthScore.max || 100}
                <button
                  onClick={() => removeFilter('healthScore')}
                  className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}

            {/* Date range filter */}
            {(filters.dateRange?.start || filters.dateRange?.end) && (
              <Badge variant="secondary" className="gap-1 pr-1">
                <Calendar className="h-3 w-3" />
                Date range
                <button
                  onClick={() => removeFilter('dateRange')}
                  className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground"
          >
            Clear all ({getActiveFilterCount()})
          </Button>
        </>
      )}
    </div>
  );
}