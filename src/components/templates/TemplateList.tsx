'use client';

/**
 * Template List Component
 * Browse, search, and filter software templates
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Star,
  Shield,
  ChevronDown,
  X,
  Server,
  Globe,
  Library,
  Database,
  Brain,
  FileText,
  Settings,
  GitBranch,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { SoftwareTemplate, TemplateCategory } from '@/services/templates/types';
import { TemplateCard } from './TemplateCard';

interface TemplateListProps {
  templates: SoftwareTemplate[];
  onSelect: (template: SoftwareTemplate) => void;
  onExecute: (template: SoftwareTemplate) => void;
  className?: string;
}

type ViewMode = 'grid' | 'list';
type SortOption = 'name' | 'popularity' | 'recent' | 'recommended';

const CATEGORY_CONFIG: Record<
  TemplateCategory,
  { label: string; icon: React.ElementType; color: string }
> = {
  service: { label: 'Service', icon: Server, color: 'text-blue-600' },
  frontend: { label: 'Frontend', icon: Globe, color: 'text-purple-600' },
  backend: { label: 'Backend', icon: Server, color: 'text-green-600' },
  library: { label: 'Library', icon: Library, color: 'text-orange-600' },
  infrastructure: { label: 'Infrastructure', icon: Database, color: 'text-gray-600' },
  'data-pipeline': { label: 'Data Pipeline', icon: GitBranch, color: 'text-cyan-600' },
  'ml-model': { label: 'ML Model', icon: Brain, color: 'text-pink-600' },
  documentation: { label: 'Documentation', icon: FileText, color: 'text-yellow-600' },
  custom: { label: 'Custom', icon: Settings, color: 'text-gray-500' },
};

export function TemplateList({
  templates,
  onSelect,
  onExecute,
  className,
}: TemplateListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedCategories, setSelectedCategories] = useState<Set<TemplateCategory>>(
    new Set()
  );
  const [showGoldenPathOnly, setShowGoldenPathOnly] = useState(false);
  const [showRecommendedOnly, setShowRecommendedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [showFilters, setShowFilters] = useState(false);

  // Get unique tags from all templates
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    templates.forEach((t) => t.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [templates]);

  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let result = [...templates];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Category filter
    if (selectedCategories.size > 0) {
      result = result.filter((t) => selectedCategories.has(t.category));
    }

    // Tag filter
    if (selectedTags.size > 0) {
      result = result.filter((t) =>
        t.tags.some((tag) => selectedTags.has(tag))
      );
    }

    // Golden path filter
    if (showGoldenPathOnly) {
      result = result.filter((t) => t.goldenPath?.enabled);
    }

    // Recommended filter
    if (showRecommendedOnly) {
      result = result.filter((t) => t.goldenPath?.recommended);
    }

    // Sort
    switch (sortBy) {
      case 'name':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'popularity':
        result.sort((a, b) => b.metadata.usageCount - a.metadata.usageCount);
        break;
      case 'recent':
        result.sort(
          (a, b) =>
            new Date(b.metadata.lastUpdated).getTime() -
            new Date(a.metadata.lastUpdated).getTime()
        );
        break;
      case 'recommended':
        result.sort((a, b) => {
          // Recommended first, then golden path, then by popularity
          if (a.goldenPath?.recommended && !b.goldenPath?.recommended) return -1;
          if (!a.goldenPath?.recommended && b.goldenPath?.recommended) return 1;
          if (a.goldenPath?.enabled && !b.goldenPath?.enabled) return -1;
          if (!a.goldenPath?.enabled && b.goldenPath?.enabled) return 1;
          return b.metadata.usageCount - a.metadata.usageCount;
        });
        break;
    }

    return result;
  }, [
    templates,
    searchQuery,
    selectedCategories,
    selectedTags,
    showGoldenPathOnly,
    showRecommendedOnly,
    sortBy,
  ]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    templates.forEach((t) => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return counts;
  }, [templates]);

  const toggleCategory = (category: TemplateCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

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
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategories(new Set());
    setSelectedTags(new Set());
    setShowGoldenPathOnly(false);
    setShowRecommendedOnly(false);
  };

  const hasActiveFilters =
    searchQuery ||
    selectedCategories.size > 0 ||
    selectedTags.size > 0 ||
    showGoldenPathOnly ||
    showRecommendedOnly;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 space-y-4">
        {/* Search and View Toggle */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
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
                {selectedCategories.size +
                  selectedTags.size +
                  (showGoldenPathOnly ? 1 : 0) +
                  (showRecommendedOnly ? 1 : 0)}
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

        {/* Quick Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowGoldenPathOnly(!showGoldenPathOnly)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              showGoldenPathOnly
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            <Shield className="h-3.5 w-3.5" />
            Golden Path
          </button>
          <button
            onClick={() => setShowRecommendedOnly(!showRecommendedOnly)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              showRecommendedOnly
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            <Star className="h-3.5 w-3.5" />
            Recommended
          </button>

          <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-2" />

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="appearance-none pl-3 pr-8 py-1.5 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-0 focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="recommended">Sort: Recommended</option>
              <option value="name">Sort: Name</option>
              <option value="popularity">Sort: Most Used</option>
              <option value="recent">Sort: Recently Updated</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {hasActiveFilters && (
            <>
              <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-2" />
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium"
              >
                Clear all filters
              </button>
            </>
          )}
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
            {/* Categories */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Categories
              </h4>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CATEGORY_CONFIG) as TemplateCategory[]).map((category) => {
                  const config = CATEGORY_CONFIG[category];
                  const Icon = config.icon;
                  const count = categoryCounts[category] || 0;
                  const isSelected = selectedCategories.has(category);

                  return (
                    <button
                      key={category}
                      onClick={() => toggleCategory(category)}
                      disabled={count === 0}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                        isSelected
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-2 ring-blue-500'
                          : count > 0
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                          : 'bg-gray-50 dark:bg-gray-900 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5', config.color)} />
                      {config.label}
                      <span className="text-xs opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tags */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {allTags.slice(0, 20).map((tag) => {
                  const isSelected = selectedTags.has(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        'px-2 py-1 rounded-md text-xs font-medium transition-colors',
                        isSelected
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
                {allTags.length > 20 && (
                  <span className="px-2 py-1 text-xs text-gray-500">
                    +{allTags.length - 20} more
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
        {filteredTemplates.length} {filteredTemplates.length === 1 ? 'template' : 'templates'} found
      </div>

      {/* Template Grid/List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredTemplates.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mx-auto flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No templates found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Try adjusting your filters or search query
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Clear all filters
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={() => onSelect(template)}
                onExecute={() => onExecute(template)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                compact
                onSelect={() => onSelect(template)}
                onExecute={() => onExecute(template)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TemplateList;
