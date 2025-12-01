'use client';

/**
 * Template Gallery Component
 * Browse and select pre-built page templates
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  Layout,
  Activity,
  FileText,
  Users,
  Settings,
  Box,
  BarChart3,
  Home,
  Globe,
  Code,
  Database,
  Star,
  Sparkles,
  ChevronRight,
  Eye,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { PageConfig } from './types';

interface PageTemplate {
  id: string;
  name: string;
  description: string;
  category: 'service' | 'team' | 'dashboard' | 'documentation' | 'custom';
  icon: React.ElementType;
  preview?: string;
  tags: string[];
  featured?: boolean;
  config: Partial<PageConfig>;
}

const PAGE_TEMPLATES: PageTemplate[] = [
  // Service Templates
  {
    id: 'service-overview',
    name: 'Service Overview',
    description: 'Complete service detail page with health, dependencies, and documentation',
    category: 'service',
    icon: Box,
    tags: ['service', 'overview', 'health'],
    featured: true,
    config: {
      name: 'Service Overview',
      layout: { type: 'grid', columns: 12, gap: 'default' },
      widgets: [
        { type: 'service-card', position: { x: 0, y: 0, width: 4, height: 3 } },
        { type: 'scorecard', position: { x: 4, y: 0, width: 4, height: 3 } },
        { type: 'stats-card', position: { x: 8, y: 0, width: 4, height: 3 } },
        { type: 'dependency-graph', position: { x: 0, y: 3, width: 8, height: 6 } },
        { type: 'deployments', position: { x: 8, y: 3, width: 4, height: 6 } },
        { type: 'tech-docs', position: { x: 0, y: 9, width: 12, height: 6 } },
      ],
    },
  },
  {
    id: 'api-detail',
    name: 'API Documentation',
    description: 'API reference page with endpoints, schemas, and usage examples',
    category: 'service',
    icon: Code,
    tags: ['api', 'documentation', 'endpoints'],
    config: {
      name: 'API Documentation',
      layout: { type: 'sidebar', columns: 12 },
      widgets: [
        { type: 'api-docs', position: { x: 0, y: 0, width: 12, height: 8 } },
      ],
    },
  },
  {
    id: 'service-health',
    name: 'Service Health Dashboard',
    description: 'Real-time health monitoring with metrics and incident tracking',
    category: 'service',
    icon: Activity,
    tags: ['health', 'monitoring', 'metrics'],
    config: {
      name: 'Health Dashboard',
      layout: { type: 'grid', columns: 12 },
      widgets: [
        { type: 'scorecard', position: { x: 0, y: 0, width: 3, height: 4 } },
        { type: 'gauge', position: { x: 3, y: 0, width: 3, height: 4 } },
        { type: 'gauge', position: { x: 6, y: 0, width: 3, height: 4 } },
        { type: 'gauge', position: { x: 9, y: 0, width: 3, height: 4 } },
        { type: 'metric-chart', position: { x: 0, y: 4, width: 8, height: 4 } },
        { type: 'incidents', position: { x: 8, y: 4, width: 4, height: 4 } },
      ],
    },
  },

  // Team Templates
  {
    id: 'team-home',
    name: 'Team Home',
    description: 'Team landing page with owned services, members, and activity',
    category: 'team',
    icon: Users,
    tags: ['team', 'home', 'members'],
    featured: true,
    config: {
      name: 'Team Home',
      layout: { type: 'grid', columns: 12 },
      widgets: [
        { type: 'team-card', position: { x: 0, y: 0, width: 4, height: 3 } },
        { type: 'stats-card', position: { x: 4, y: 0, width: 4, height: 3 } },
        { type: 'pagerduty', position: { x: 8, y: 0, width: 4, height: 3 } },
        { type: 'entity-list', position: { x: 0, y: 3, width: 8, height: 5 } },
        { type: 'github-activity', position: { x: 8, y: 3, width: 4, height: 5 } },
      ],
    },
  },
  {
    id: 'team-services',
    name: 'Team Services',
    description: 'Overview of all services owned by the team',
    category: 'team',
    icon: Database,
    tags: ['team', 'services', 'catalog'],
    config: {
      name: 'Team Services',
      layout: { type: 'grid', columns: 12 },
      widgets: [
        { type: 'entity-list', position: { x: 0, y: 0, width: 12, height: 8 } },
      ],
    },
  },

  // Dashboard Templates
  {
    id: 'executive-dashboard',
    name: 'Executive Dashboard',
    description: 'High-level metrics and KPIs for leadership',
    category: 'dashboard',
    icon: BarChart3,
    tags: ['dashboard', 'executive', 'kpis'],
    featured: true,
    config: {
      name: 'Executive Dashboard',
      layout: { type: 'grid', columns: 12 },
      widgets: [
        { type: 'stats-card', position: { x: 0, y: 0, width: 3, height: 2 } },
        { type: 'stats-card', position: { x: 3, y: 0, width: 3, height: 2 } },
        { type: 'stats-card', position: { x: 6, y: 0, width: 3, height: 2 } },
        { type: 'stats-card', position: { x: 9, y: 0, width: 3, height: 2 } },
        { type: 'bar-chart', position: { x: 0, y: 2, width: 6, height: 4 } },
        { type: 'pie-chart', position: { x: 6, y: 2, width: 6, height: 4 } },
        { type: 'metric-chart', position: { x: 0, y: 6, width: 12, height: 4 } },
      ],
    },
  },
  {
    id: 'deployment-dashboard',
    name: 'Deployment Dashboard',
    description: 'Track deployments across all environments',
    category: 'dashboard',
    icon: Activity,
    tags: ['dashboard', 'deployments', 'cicd'],
    config: {
      name: 'Deployment Dashboard',
      layout: { type: 'grid', columns: 12 },
      widgets: [
        { type: 'environment-status', position: { x: 0, y: 0, width: 12, height: 3 } },
        { type: 'deployments', position: { x: 0, y: 3, width: 6, height: 5 } },
        { type: 'pipeline-status', position: { x: 6, y: 3, width: 6, height: 5 } },
      ],
    },
  },
  {
    id: 'incident-dashboard',
    name: 'Incident Dashboard',
    description: 'Monitor and manage active incidents',
    category: 'dashboard',
    icon: Activity,
    tags: ['dashboard', 'incidents', 'monitoring'],
    config: {
      name: 'Incident Dashboard',
      layout: { type: 'grid', columns: 12 },
      widgets: [
        { type: 'incidents', position: { x: 0, y: 0, width: 8, height: 6 } },
        { type: 'pagerduty', position: { x: 8, y: 0, width: 4, height: 6 } },
      ],
    },
  },

  // Documentation Templates
  {
    id: 'docs-home',
    name: 'Documentation Home',
    description: 'Landing page for technical documentation',
    category: 'documentation',
    icon: FileText,
    tags: ['documentation', 'home', 'techdocs'],
    config: {
      name: 'Documentation',
      layout: { type: 'grid', columns: 12 },
      widgets: [
        { type: 'search-bar', position: { x: 0, y: 0, width: 12, height: 1 } },
        { type: 'markdown', position: { x: 0, y: 1, width: 12, height: 6 } },
      ],
    },
  },
  {
    id: 'getting-started',
    name: 'Getting Started Guide',
    description: 'Onboarding guide for new developers',
    category: 'documentation',
    icon: Sparkles,
    tags: ['documentation', 'onboarding', 'guide'],
    config: {
      name: 'Getting Started',
      layout: { type: 'sidebar', columns: 12 },
      widgets: [
        { type: 'markdown', position: { x: 0, y: 0, width: 12, height: 8 } },
      ],
    },
  },

  // Custom Templates
  {
    id: 'blank-page',
    name: 'Blank Page',
    description: 'Start from scratch with an empty canvas',
    category: 'custom',
    icon: Layout,
    tags: ['blank', 'custom', 'empty'],
    config: {
      name: 'New Page',
      layout: { type: 'grid', columns: 12, gap: 'default' },
      widgets: [],
    },
  },
  {
    id: 'portal-home',
    name: 'Portal Home',
    description: 'Developer portal landing page',
    category: 'custom',
    icon: Home,
    tags: ['home', 'landing', 'portal'],
    featured: true,
    config: {
      name: 'Developer Portal',
      layout: { type: 'grid', columns: 12 },
      widgets: [
        { type: 'search-bar', position: { x: 2, y: 0, width: 8, height: 1 } },
        { type: 'stats-card', position: { x: 0, y: 1, width: 3, height: 2 } },
        { type: 'stats-card', position: { x: 3, y: 1, width: 3, height: 2 } },
        { type: 'stats-card', position: { x: 6, y: 1, width: 3, height: 2 } },
        { type: 'stats-card', position: { x: 9, y: 1, width: 3, height: 2 } },
        { type: 'entity-list', position: { x: 0, y: 3, width: 8, height: 5 } },
        { type: 'github-activity', position: { x: 8, y: 3, width: 4, height: 5 } },
      ],
    },
  },
];

const CATEGORY_INFO = {
  service: { label: 'Service Pages', icon: Box, color: 'text-blue-500' },
  team: { label: 'Team Pages', icon: Users, color: 'text-green-500' },
  dashboard: { label: 'Dashboards', icon: BarChart3, color: 'text-purple-500' },
  documentation: { label: 'Documentation', icon: FileText, color: 'text-orange-500' },
  custom: { label: 'Custom', icon: Layout, color: 'text-gray-500' },
};

interface TemplateCardProps {
  template: PageTemplate;
  onSelect: () => void;
  onPreview?: () => void;
}

function TemplateCard({ template, onSelect, onPreview }: TemplateCardProps) {
  const Icon = template.icon;
  const category = CATEGORY_INFO[template.category];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        'group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700',
        'hover:border-blue-400 hover:shadow-lg transition-all duration-200 overflow-hidden'
      )}
    >
      {/* Featured Badge */}
      {template.featured && (
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium">
            <Star className="h-3 w-3" />
            Featured
          </span>
        </div>
      )}

      {/* Preview Area */}
      <div className="aspect-video bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center border-b border-gray-200 dark:border-gray-700">
        <Icon className={cn('h-16 w-16', category.color)} />
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">{template.name}</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
          {template.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          {template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button onClick={onSelect} size="sm" className="flex-1">
            <Plus className="h-4 w-4 mr-1" />
            Use Template
          </Button>
          {onPreview && (
            <Button onClick={onPreview} variant="outline" size="sm">
              <Eye className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface TemplateGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: PageTemplate) => void;
}

export function TemplateGallery({
  isOpen,
  onClose,
  onSelectTemplate,
}: TemplateGalleryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<PageTemplate | null>(null);

  const filteredTemplates = useMemo(() => {
    return PAGE_TEMPLATES.filter((template) => {
      const matchesSearch =
        !searchQuery ||
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = !selectedCategory || template.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const featuredTemplates = filteredTemplates.filter((t) => t.featured);
  const otherTemplates = filteredTemplates.filter((t) => !t.featured);

  const categories = Object.entries(CATEGORY_INFO) as [
    keyof typeof CATEGORY_INFO,
    (typeof CATEGORY_INFO)[keyof typeof CATEGORY_INFO]
  ][];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-4 md:inset-8 lg:inset-16 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Choose a Template
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Start with a pre-built template or create from scratch
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Search and Filters */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates..."
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
                    !selectedCategory
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  )}
                >
                  All
                </button>
                {categories.map(([key, info]) => {
                  const CategoryIcon = info.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedCategory(key)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
                        selectedCategory === key
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      )}
                    >
                      <CategoryIcon className="h-3.5 w-3.5" />
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Template Grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-16">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg text-gray-600 dark:text-gray-400">No templates found</p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    Try adjusting your search or filters
                  </p>
                </div>
              ) : (
                <>
                  {/* Featured Templates */}
                  {featuredTemplates.length > 0 && (
                    <div className="mb-8">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-500" />
                        Featured Templates
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        <AnimatePresence>
                          {featuredTemplates.map((template) => (
                            <TemplateCard
                              key={template.id}
                              template={template}
                              onSelect={() => {
                                onSelectTemplate(template);
                                onClose();
                              }}
                              onPreview={() => setPreviewTemplate(template)}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}

                  {/* Other Templates */}
                  {otherTemplates.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                        {featuredTemplates.length > 0 ? 'More Templates' : 'All Templates'}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        <AnimatePresence>
                          {otherTemplates.map((template) => (
                            <TemplateCard
                              key={template.id}
                              template={template}
                              onSelect={() => {
                                onSelectTemplate(template);
                                onClose();
                              }}
                              onPreview={() => setPreviewTemplate(template)}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export { PAGE_TEMPLATES, type PageTemplate };
export default TemplateGallery;
