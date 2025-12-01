'use client';

/**
 * Entity Search Component
 * Search and filter entities with faceted navigation
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  Filter,
  X,
  ChevronDown,
  Grid3X3,
  List,
  Server,
  Code,
  Database,
  Users,
  Boxes,
  Layers,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  Entity,
  EntityKind,
  EntitySearchQuery,
  EntitySearchResults,
  EntityFacets,
  FacetBucket,
} from '@/services/catalog/entity-types';
import { EntityCard } from './EntityCard';

interface EntitySearchProps {
  onSearch: (query: EntitySearchQuery) => Promise<EntitySearchResults>;
  onSelect: (entity: Entity) => void;
  initialResults?: EntitySearchResults;
  className?: string;
}

type ViewMode = 'grid' | 'list';

const KIND_CONFIG: Record<EntityKind, { icon: React.ElementType; label: string }> = {
  Component: { icon: Server, label: 'Components' },
  API: { icon: Code, label: 'APIs' },
  Resource: { icon: Database, label: 'Resources' },
  System: { icon: Boxes, label: 'Systems' },
  Domain: { icon: Layers, label: 'Domains' },
  Group: { icon: Users, label: 'Groups' },
  User: { icon: Users, label: 'Users' },
  Location: { icon: Database, label: 'Locations' },
  Template: { icon: Database, label: 'Templates' },
  Infrastructure: { icon: Database, label: 'Infrastructure' },
  Pipeline: { icon: Database, label: 'Pipelines' },
  Environment: { icon: Database, label: 'Environments' },
  Secret: { icon: Database, label: 'Secrets' },
};

const SORTABLE_FIELDS = [
  { value: 'metadata.name', label: 'Name' },
  { value: 'metadata.title', label: 'Title' },
  { value: 'spec.lifecycle', label: 'Lifecycle' },
];

export function EntitySearch({
  onSearch,
  onSelect,
  initialResults,
  className,
}: EntitySearchProps) {
  const [searchText, setSearchText] = useState('');
  const [selectedKinds, setSelectedKinds] = useState<Set<EntityKind>>(new Set());
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedOwners, setSelectedOwners] = useState<Set<string>>(new Set());
  const [selectedLifecycles, setSelectedLifecycles] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<string>('metadata.name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [results, setResults] = useState<EntitySearchResults | null>(initialResults || null);
  const [isLoading, setIsLoading] = useState(false);

  // Build and execute search query
  const executeSearch = useCallback(async () => {
    setIsLoading(true);
    try {
      const query: EntitySearchQuery = {
        text: searchText || undefined,
        kinds: selectedKinds.size > 0 ? Array.from(selectedKinds) : undefined,
        filters: [
          ...Array.from(selectedTags).map((tag) => ({
            field: 'metadata.tags',
            operator: 'contains' as const,
            value: tag,
          })),
          ...Array.from(selectedOwners).map((owner) => ({
            field: 'spec.owner',
            operator: 'eq' as const,
            value: owner,
          })),
          ...Array.from(selectedLifecycles).map((lifecycle) => ({
            field: 'spec.lifecycle',
            operator: 'eq' as const,
            value: lifecycle,
          })),
        ],
        sortBy: { field: sortBy, direction: sortDirection },
        page,
        pageSize,
        facets: ['kinds', 'types', 'owners', 'tags', 'lifecycles'],
      };

      const searchResults = await onSearch(query);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [
    searchText,
    selectedKinds,
    selectedTags,
    selectedOwners,
    selectedLifecycles,
    sortBy,
    sortDirection,
    page,
    pageSize,
    onSearch,
  ]);

  // Debounced search on text change
  React.useEffect(() => {
    const timer = setTimeout(() => {
      executeSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [executeSearch]);

  // Toggle kind filter
  const toggleKind = (kind: EntityKind) => {
    setSelectedKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
    setPage(1);
  };

  // Toggle tag filter
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
    setPage(1);
  };

  // Toggle owner filter
  const toggleOwner = (owner: string) => {
    setSelectedOwners((prev) => {
      const next = new Set(prev);
      if (next.has(owner)) {
        next.delete(owner);
      } else {
        next.add(owner);
      }
      return next;
    });
    setPage(1);
  };

  // Toggle lifecycle filter
  const toggleLifecycle = (lifecycle: string) => {
    setSelectedLifecycles((prev) => {
      const next = new Set(prev);
      if (next.has(lifecycle)) {
        next.delete(lifecycle);
      } else {
        next.add(lifecycle);
      }
      return next;
    });
    setPage(1);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchText('');
    setSelectedKinds(new Set());
    setSelectedTags(new Set());
    setSelectedOwners(new Set());
    setSelectedLifecycles(new Set());
    setPage(1);
  };

  const hasActiveFilters =
    searchText ||
    selectedKinds.size > 0 ||
    selectedTags.size > 0 ||
    selectedOwners.size > 0 ||
    selectedLifecycles.size > 0;

  const totalPages = results ? Math.ceil(results.total / pageSize) : 0;

  // Render facet section
  const renderFacetSection = (
    title: string,
    facets: FacetBucket[] | undefined,
    selectedSet: Set<string>,
    toggleFn: (value: string) => void,
    maxItems = 10
  ) => {
    if (!facets || facets.length === 0) return null;

    return (
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {title}
        </h4>
        <div className="space-y-1">
          {facets.slice(0, maxItems).map((facet) => (
            <button
              key={facet.value}
              onClick={() => toggleFn(facet.value)}
              className={cn(
                'flex items-center justify-between w-full px-2 py-1.5 text-sm rounded-lg transition-colors',
                selectedSet.has(facet.value)
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              )}
            >
              <span className="truncate">{facet.label || facet.value}</span>
              <span className="text-xs text-gray-400 ml-2">{facet.count}</span>
            </button>
          ))}
          {facets.length > maxItems && (
            <p className="text-xs text-gray-400 px-2 py-1">
              +{facets.length - maxItems} more
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Search Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 space-y-4">
        {/* Search Input */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search entities..."
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button
            variant={showFilters ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-blue-500 text-white">
                {selectedKinds.size +
                  selectedTags.size +
                  selectedOwners.size +
                  selectedLifecycles.size}
              </span>
            )}
          </Button>

          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-l-lg transition-colors',
                viewMode === 'grid'
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-r-lg transition-colors',
                viewMode === 'list'
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                  : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Kind Quick Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['Component', 'API', 'System', 'Group', 'Resource'] as EntityKind[]).map((kind) => {
            const config = KIND_CONFIG[kind];
            const Icon = config.icon;
            const isSelected = selectedKinds.has(kind);
            const count = results?.facets?.kinds?.find((f) => f.value === kind)?.count || 0;

            return (
              <button
                key={kind}
                onClick={() => toggleKind(kind)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  isSelected
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {config.label}
                <span className="text-xs opacity-60">({count})</span>
              </button>
            );
          })}

          {/* Sort */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="text-sm bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1 border-0"
            >
              {SORTABLE_FIELDS.map((field) => (
                <option key={field.value} value={field.value}>
                  {field.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                setPage(1);
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {sortDirection === 'asc' ? '↑' : '↓'}
            </button>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Facets Sidebar */}
        {showFilters && results?.facets && (
          <div className="w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4 space-y-6">
            {renderFacetSection(
              'Types',
              results.facets.types,
              new Set(),
              () => {}
            )}
            {renderFacetSection(
              'Owners',
              results.facets.owners?.map((f) => ({
                ...f,
                label: f.value.replace('group:default/', ''),
              })),
              selectedOwners,
              toggleOwner
            )}
            {renderFacetSection(
              'Lifecycle',
              results.facets.lifecycles,
              selectedLifecycles,
              toggleLifecycle
            )}
            {renderFacetSection(
              'Tags',
              results.facets.tags,
              selectedTags,
              toggleTag,
              15
            )}
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Results Count */}
          <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            {isLoading ? (
              'Searching...'
            ) : results ? (
              <>
                {results.total} {results.total === 1 ? 'entity' : 'entities'} found
              </>
            ) : (
              'Start searching...'
            )}
          </div>

          {/* Results Grid/List */}
          {results && results.items.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.items.map((entity) => (
                  <EntityCard
                    key={`${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`}
                    entity={entity}
                    onSelect={() => onSelect(entity)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {results.items.map((entity) => (
                  <EntityCard
                    key={`${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`}
                    entity={entity}
                    compact
                    onSelect={() => onSelect(entity)}
                  />
                ))}
              </div>
            )
          ) : !isLoading && results ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No entities found
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Try adjusting your search or filters
              </p>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>
                  Clear all filters
                </Button>
              )}
            </div>
          ) : null}

          {/* Pagination */}
          {results && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EntitySearch;
