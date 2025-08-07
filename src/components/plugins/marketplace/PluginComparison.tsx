'use client';

import React, { useState } from 'react';
import {
  X,
  Check,
  Star,
  Download,
  Award,
  Shield,
  Clock,
  Users,
  ExternalLink,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Package,
  Globe,
  GitBranch,
  Database,
  Activity,
  Code,
  Sparkles,
  Layers,
  Terminal,
} from 'lucide-react';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

interface PluginComparisonProps {
  plugins: BackstagePlugin[];
  onClose: () => void;
  onSelectPlugin: (pluginId: string) => void;
}

interface ComparisonRow {
  label: string;
  key: string;
  type: 'text' | 'number' | 'rating' | 'boolean' | 'list' | 'date' | 'size' | 'url';
  category: 'basic' | 'metrics' | 'technical' | 'compatibility';
  important?: boolean;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  // Basic Information
  { label: 'Plugin Name', key: 'title', type: 'text', category: 'basic', important: true },
  { label: 'Version', key: 'version', type: 'text', category: 'basic' },
  { label: 'Author', key: 'author', type: 'text', category: 'basic' },
  { label: 'Category', key: 'category', type: 'text', category: 'basic' },
  { label: 'Official Plugin', key: 'official', type: 'boolean', category: 'basic' },
  { label: 'Featured', key: 'featured', type: 'boolean', category: 'basic' },
  { label: 'Installation Status', key: 'installed', type: 'boolean', category: 'basic', important: true },

  // Metrics
  { label: 'Downloads', key: 'downloads', type: 'number', category: 'metrics', important: true },
  { label: 'Stars', key: 'stars', type: 'number', category: 'metrics' },
  { label: 'Rating', key: 'rating', type: 'rating', category: 'metrics', important: true },
  { label: 'Last Updated', key: 'lastUpdated', type: 'date', category: 'metrics' },

  // Technical Details
  { label: 'Description', key: 'description', type: 'text', category: 'technical' },
  { label: 'Tags', key: 'tags', type: 'list', category: 'technical' },
  { label: 'Dependencies', key: 'dependencies', type: 'list', category: 'technical' },
  { label: 'Configurable', key: 'configurable', type: 'boolean', category: 'technical' },
  { label: 'Repository', key: 'repository', type: 'url', category: 'technical' },
  { label: 'Homepage', key: 'homepage', type: 'url', category: 'technical' },

  // Compatibility
  { label: 'Backstage Version', key: 'compatibility.backstageVersion', type: 'text', category: 'compatibility' },
  { label: 'Node Version', key: 'compatibility.nodeVersion', type: 'text', category: 'compatibility' },
  { label: 'NPM Version', key: 'compatibility.npmVersion', type: 'text', category: 'compatibility' },
];

const CATEGORY_ICONS: Record<string, any> = {
  'ci-cd': GitBranch,
  'monitoring': Activity,
  'infrastructure': Database,
  'security': Shield,
  'analytics': Sparkles,
  'documentation': Code,
  'cost-management': Layers,
  'development-tools': Terminal,
  'default': Package,
};

function formatValue(value: any, type: ComparisonRow['type']): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-400 dark:text-gray-500">N/A</span>;
  }

  switch (type) {
    case 'boolean':
      return value ? (
        <CheckCircle className="w-5 h-5 text-green-500" />
      ) : (
        <XCircle className="w-5 h-5 text-gray-400" />
      );

    case 'rating':
      return (
        <div className="flex items-center gap-1">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= Math.floor(value)
                    ? 'text-yellow-400 fill-current'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-sm ml-1">{value.toFixed(1)}</span>
        </div>
      );

    case 'number':
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toLocaleString();

    case 'date':
      const date = new Date(value);
      const now = new Date();
      const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffInDays < 1) return 'Today';
      if (diffInDays < 7) return `${diffInDays}d ago`;
      if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
      if (diffInDays < 365) return `${Math.floor(diffInDays / 30)}mo ago`;
      return `${Math.floor(diffInDays / 365)}y ago`;

    case 'list':
      if (!Array.isArray(value) || value.length === 0) {
        return <span className="text-gray-400 dark:text-gray-500">None</span>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          {value.slice(0, 3).map((item, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
            >
              {item}
            </span>
          ))}
          {value.length > 3 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              +{value.length - 3} more
            </span>
          )}
        </div>
      );

    case 'url':
      return value ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
        >
          <ExternalLink className="w-4 h-4 mr-1" />
          Link
        </a>
      ) : (
        <span className="text-gray-400 dark:text-gray-500">N/A</span>
      );

    case 'text':
    default:
      if (typeof value === 'string' && value.length > 100) {
        return (
          <div className="group relative">
            <span className="line-clamp-2">{value}</span>
            <div className="absolute left-0 top-full mt-2 p-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 max-w-xs">
              {value}
            </div>
          </div>
        );
      }
      return value.toString();
  }
}

function getValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function getWinner(plugins: BackstagePlugin[], key: string, type: ComparisonRow['type']): number | null {
  const values = plugins.map(p => getValue(p, key));
  
  if (type === 'number') {
    const maxValue = Math.max(...values.filter(v => typeof v === 'number'));
    return values.findIndex(v => v === maxValue);
  }
  
  if (type === 'rating') {
    const maxRating = Math.max(...values.filter(v => typeof v === 'number'));
    return values.findIndex(v => v === maxRating);
  }
  
  if (type === 'boolean') {
    const trueIndex = values.findIndex(v => v === true);
    return trueIndex >= 0 ? trueIndex : null;
  }
  
  if (type === 'date') {
    const dates = values
      .map(v => v ? new Date(v).getTime() : 0)
      .filter(d => d > 0);
    if (dates.length === 0) return null;
    
    const maxDate = Math.max(...dates);
    return values.findIndex(v => v && new Date(v).getTime() === maxDate);
  }
  
  return null;
}

export function PluginComparison({ plugins, onClose, onSelectPlugin }: PluginComparisonProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'basic' | 'metrics' | 'technical' | 'compatibility'>('all');

  const filteredRows = selectedCategory === 'all' 
    ? COMPARISON_ROWS 
    : COMPARISON_ROWS.filter(row => row.category === selectedCategory);

  const categories = [
    { id: 'all', label: 'All', icon: Package },
    { id: 'basic', label: 'Basic Info', icon: Info },
    { id: 'metrics', label: 'Metrics', icon: Activity },
    { id: 'technical', label: 'Technical', icon: Code },
    { id: 'compatibility', label: 'Compatibility', icon: Shield },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="relative flex h-full">
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 ml-auto max-w-6xl w-full">
          {/* Header */}
          <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Plugin Comparison
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Compare {plugins.length} plugins side by side
                </p>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Category Filters */}
          <div className="flex-shrink-0 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex gap-2 overflow-x-auto">
              {categories.map(category => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {category.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comparison Table */}
          <div className="flex-1 overflow-auto">
            <div className="min-w-full">
              <table className="w-full">
                {/* Plugin Headers */}
                <thead className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-10">
                  <tr>
                    <th className="w-48 px-6 py-4 text-left bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Attribute
                      </span>
                    </th>
                    {plugins.map((plugin, index) => {
                      const Icon = CATEGORY_ICONS[plugin.category] || CATEGORY_ICONS.default;
                      return (
                        <th
                          key={plugin.id}
                          className="px-6 py-4 text-left min-w-64 border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Icon className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <button
                                onClick={() => onSelectPlugin(plugin.id)}
                                className="text-left"
                              >
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                  {plugin.title}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  v{plugin.version}
                                </p>
                              </button>
                              
                              <div className="flex items-center gap-1 mt-2">
                                {plugin.official && (
                                  <Award className="w-4 h-4 text-blue-500" title="Official" />
                                )}
                                {plugin.featured && (
                                  <Star className="w-4 h-4 text-yellow-500" title="Featured" />
                                )}
                                {plugin.installed && (
                                  <CheckCircle className="w-4 h-4 text-green-500" title="Installed" />
                                )}
                              </div>
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* Comparison Rows */}
                <tbody>
                  {filteredRows.map((row, rowIndex) => {
                    const winner = getWinner(plugins, row.key, row.type);
                    
                    return (
                      <tr
                        key={row.key}
                        className={`border-b border-gray-200 dark:border-gray-700 ${
                          row.important ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                        } ${rowIndex % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}
                      >
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2">
                            {row.label}
                            {row.important && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full" title="Important attribute" />
                            )}
                          </div>
                        </td>
                        {plugins.map((plugin, pluginIndex) => (
                          <td
                            key={`${plugin.id}-${row.key}`}
                            className={`px-6 py-4 border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${
                              winner === pluginIndex ? 'bg-green-50 dark:bg-green-900/20' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {formatValue(getValue(plugin, row.key), row.type)}
                              {winner === pluginIndex && row.type !== 'text' && (
                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" title="Best in category" />
                              )}
                            </div>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Best in category</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <span>Important attribute</span>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    // Export comparison data
                    const data = filteredRows.map(row => ({
                      attribute: row.label,
                      ...plugins.reduce((acc, plugin, index) => {
                        acc[`plugin_${index + 1}`] = getValue(plugin, row.key);
                        return acc;
                      }, {} as Record<string, any>)
                    }));
                    
                    const csv = [
                      ['Attribute', ...plugins.map(p => p.title)].join(','),
                      ...data.map(row => [
                        row.attribute,
                        ...plugins.map((_, index) => row[`plugin_${index + 1}`] || 'N/A')
                      ].join(','))
                    ].join('\n');
                    
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'plugin-comparison.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}