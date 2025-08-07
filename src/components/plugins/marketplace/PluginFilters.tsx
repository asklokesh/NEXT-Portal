'use client';

import React, { useState, useMemo } from 'react';
import {
  Filter,
  X,
  Check,
  Star,
  Shield,
  Award,
  Clock,
  Download,
  Users,
  Globe,
  Package,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Search,
} from 'lucide-react';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

interface PluginFiltersProps {
  filters: {
    compatibility: string[];
    pricing: string[];
    tags: string[];
    organization: string[];
    minRating: number;
    onlyOfficial: boolean;
    onlyInstalled: boolean;
    onlyRecent: boolean;
  };
  onFiltersChange: (filters: any) => void;
  availablePlugins: BackstagePlugin[];
}

interface FilterSection {
  key: string;
  label: string;
  icon: any;
  component: React.ComponentType<any>;
}

function CompatibilityFilter({ filters, onChange, plugins }: any) {
  const compatibilityOptions = [
    { value: 'backstage-1.18+', label: 'Backstage 1.18+', count: 85 },
    { value: 'node-18+', label: 'Node.js 18+', count: 92 },
    { value: 'react-18+', label: 'React 18+', count: 78 },
    { value: 'typescript', label: 'TypeScript', count: 95 },
  ];

  return (
    <div className="space-y-3">
      {compatibilityOptions.map(option => (
        <label key={option.value} className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.compatibility.includes(option.value)}
            onChange={(e) => {
              const updated = e.target.checked
                ? [...filters.compatibility, option.value]
                : filters.compatibility.filter((v: string) => v !== option.value);
              onChange('compatibility', updated);
            }}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
            {option.label}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({option.count})
          </span>
        </label>
      ))}
    </div>
  );
}

function PricingFilter({ filters, onChange }: any) {
  const pricingOptions = [
    { value: 'free', label: 'Free', icon: Package, count: 147 },
    { value: 'open-source', label: 'Open Source', icon: Globe, count: 132 },
    { value: 'commercial', label: 'Commercial', icon: Shield, count: 23 },
    { value: 'enterprise', label: 'Enterprise', icon: Award, count: 8 },
  ];

  return (
    <div className="space-y-3">
      {pricingOptions.map(option => {
        const Icon = option.icon;
        return (
          <label key={option.value} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.pricing.includes(option.value)}
              onChange={(e) => {
                const updated = e.target.checked
                  ? [...filters.pricing, option.value]
                  : filters.pricing.filter((v: string) => v !== option.value);
                onChange('pricing', updated);
              }}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <Icon className="w-4 h-4 text-gray-500" />
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
              {option.label}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({option.count})
            </span>
          </label>
        );
      })}
    </div>
  );
}

function TagsFilter({ filters, onChange, plugins }: any) {
  const [searchTags, setSearchTags] = useState('');
  
  // Extract all unique tags from plugins
  const allTags = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    plugins.forEach((plugin: BackstagePlugin) => {
      plugin.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Show top 20 tags
  }, [plugins]);

  const filteredTags = allTags.filter(({ tag }) =>
    tag.toLowerCase().includes(searchTags.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search tags..."
          value={searchTags}
          onChange={(e) => setSearchTags(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="max-h-48 overflow-y-auto space-y-2">
        {filteredTags.map(({ tag, count }) => (
          <label key={tag} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.tags.includes(tag)}
              onChange={(e) => {
                const updated = e.target.checked
                  ? [...filters.tags, tag]
                  : filters.tags.filter((t: string) => t !== tag);
                onChange('tags', updated);
              }}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
              {tag}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({count})
            </span>
          </label>
        ))}
      </div>

      {filteredTags.length === 0 && searchTags && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No tags found matching "{searchTags}"
        </p>
      )}
    </div>
  );
}

function OrganizationFilter({ filters, onChange, plugins }: any) {
  const organizations = useMemo(() => {
    const orgCounts: Record<string, number> = {};
    plugins.forEach((plugin: BackstagePlugin) => {
      const org = plugin.author;
      orgCounts[org] = (orgCounts[org] || 0) + 1;
    });
    
    return Object.entries(orgCounts)
      .map(([org, count]) => ({ org, count }))
      .sort((a, b) => b.count - a.count);
  }, [plugins]);

  return (
    <div className="space-y-3">
      {organizations.slice(0, 10).map(({ org, count }) => (
        <label key={org} className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.organization.includes(org)}
            onChange={(e) => {
              const updated = e.target.checked
                ? [...filters.organization, org]
                : filters.organization.filter((o: string) => o !== org);
              onChange('organization', updated);
            }}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <div className="flex-1">
            <span className="text-sm text-gray-700 dark:text-gray-300">{org}</span>
            {org === 'Backstage' && (
              <Award className="w-3 h-3 text-blue-500 inline ml-1" title="Official" />
            )}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({count})
          </span>
        </label>
      ))}
    </div>
  );
}

function RatingFilter({ filters, onChange }: any) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Minimum Rating: {filters.minRating} stars
        </label>
        <input
          type="range"
          min="0"
          max="5"
          step="0.5"
          value={filters.minRating}
          onChange={(e) => onChange('minRating', parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
        />
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>0</span>
          <span>2.5</span>
          <span>5</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= filters.minRating
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function QuickFilters({ filters, onChange }: any) {
  const quickOptions = [
    {
      key: 'onlyOfficial',
      label: 'Official only',
      icon: Award,
      description: 'Show only official Backstage plugins',
    },
    {
      key: 'onlyInstalled',
      label: 'Installed only',
      icon: Check,
      description: 'Show only installed plugins',
    },
    {
      key: 'onlyRecent',
      label: 'Recent updates',
      icon: Clock,
      description: 'Show plugins updated in last 30 days',
    },
  ];

  return (
    <div className="space-y-3">
      {quickOptions.map(option => {
        const Icon = option.icon;
        return (
          <label key={option.key} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={filters[option.key]}
              onChange={(e) => onChange(option.key, e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {option.label}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {option.description}
              </p>
            </div>
          </label>
        );
      })}
    </div>
  );
}

export function PluginFilters({ filters, onFiltersChange, availablePlugins }: PluginFiltersProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    quick: true,
    compatibility: false,
    pricing: false,
    tags: false,
    organization: false,
    rating: false,
  });

  const filterSections: FilterSection[] = [
    {
      key: 'quick',
      label: 'Quick Filters',
      icon: Filter,
      component: QuickFilters,
    },
    {
      key: 'compatibility',
      label: 'Compatibility',
      icon: Shield,
      component: CompatibilityFilter,
    },
    {
      key: 'pricing',
      label: 'Pricing',
      icon: Package,
      component: PricingFilter,
    },
    {
      key: 'tags',
      label: 'Tags',
      icon: Globe,
      component: TagsFilter,
    },
    {
      key: 'organization',
      label: 'Organization',
      icon: Users,
      component: OrganizationFilter,
    },
    {
      key: 'rating',
      label: 'Rating',
      icon: Star,
      component: RatingFilter,
    },
  ];

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateFilter = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      compatibility: [],
      pricing: [],
      tags: [],
      organization: [],
      minRating: 0,
      onlyOfficial: false,
      onlyInstalled: false,
      onlyRecent: false,
    });
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    return false;
  });

  const activeFilterCount = Object.entries(filters).reduce((count, [key, value]) => {
    if (Array.isArray(value)) return count + value.length;
    if (typeof value === 'boolean' && value) return count + 1;
    if (typeof value === 'number' && value > 0) return count + 1;
    return count;
  }, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Advanced Filters
          </h3>
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
              {activeFilterCount} active
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Clear All
          </button>
        )}
      </div>

      <div className="space-y-4">
        {filterSections.map(section => {
          const Icon = section.icon;
          const FilterComponent = section.component;
          const isExpanded = expandedSections[section.key];

          return (
            <div key={section.key} className="border border-gray-200 dark:border-gray-600 rounded-lg">
              <button
                onClick={() => toggleSection(section.key)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-gray-500" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {section.label}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                )}
              </button>
              
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="pt-4">
                    <FilterComponent
                      filters={filters}
                      onChange={updateFilter}
                      plugins={availablePlugins}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Active Filters
          </h4>
          <div className="flex flex-wrap gap-2">
            {filters.compatibility.map((comp: string) => (
              <span key={comp} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 rounded-full text-xs">
                {comp}
                <button
                  onClick={() => updateFilter('compatibility', filters.compatibility.filter((c: string) => c !== comp))}
                  className="text-blue-600 hover:text-blue-800 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {filters.tags.slice(0, 3).map((tag: string) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 rounded-full text-xs">
                {tag}
                <button
                  onClick={() => updateFilter('tags', filters.tags.filter((t: string) => t !== tag))}
                  className="text-green-600 hover:text-green-800 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {filters.tags.length > 3 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                +{filters.tags.length - 3} more tags
              </span>
            )}
            {filters.onlyOfficial && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 rounded-full text-xs">
                Official Only
                <button
                  onClick={() => updateFilter('onlyOfficial', false)}
                  className="text-purple-600 hover:text-purple-800 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.minRating > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300 rounded-full text-xs">
                {filters.minRating}+ stars
                <button
                  onClick={() => updateFilter('minRating', 0)}
                  className="text-yellow-600 hover:text-yellow-800 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}