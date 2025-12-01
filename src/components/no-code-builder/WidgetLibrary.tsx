'use client';

/**
 * Widget Library Component
 * Displays available widgets organized by category for drag-and-drop
 */

import React, { useState, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  BarChart3,
  Table,
  FileText,
  GitBranch,
  Activity,
  Clock,
  Users,
  AlertTriangle,
  Link,
  Code,
  Database,
  Settings,
  Box,
  Layout,
  PieChart,
  LineChart,
  TrendingUp,
  Gauge,
  List,
  Grid,
  Calendar,
  MessageSquare,
  Bell,
  Search,
  Filter,
  Bookmark,
  Star,
  CheckCircle,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Workflow,
  Shield,
  Terminal,
  Globe,
  Cpu,
  HardDrive,
  Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetType, WidgetConfig } from './types';

interface WidgetDefinition {
  type: WidgetType;
  name: string;
  description: string;
  icon: React.ElementType;
  category: 'catalog' | 'metrics' | 'deployment' | 'documentation' | 'custom' | 'layout' | 'integration';
  defaultConfig: Partial<WidgetConfig>;
  defaultSize: { width: number; height: number };
}

const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  // Catalog Widgets
  {
    type: 'service-card',
    name: 'Service Card',
    description: 'Display service information with health status',
    icon: Box,
    category: 'catalog',
    defaultConfig: { title: 'Service Card' },
    defaultSize: { width: 4, height: 3 },
  },
  {
    type: 'entity-list',
    name: 'Entity List',
    description: 'List of catalog entities with filtering',
    icon: List,
    category: 'catalog',
    defaultConfig: { title: 'Entities' },
    defaultSize: { width: 6, height: 4 },
  },
  {
    type: 'dependency-graph',
    name: 'Dependency Graph',
    description: 'Interactive service dependency visualization',
    icon: GitBranch,
    category: 'catalog',
    defaultConfig: { title: 'Dependencies' },
    defaultSize: { width: 8, height: 6 },
  },
  {
    type: 'team-card',
    name: 'Team Card',
    description: 'Team information and members',
    icon: Users,
    category: 'catalog',
    defaultConfig: { title: 'Team' },
    defaultSize: { width: 4, height: 3 },
  },
  {
    type: 'api-list',
    name: 'API List',
    description: 'List of APIs with documentation links',
    icon: Globe,
    category: 'catalog',
    defaultConfig: { title: 'APIs' },
    defaultSize: { width: 6, height: 4 },
  },

  // Metrics Widgets
  {
    type: 'scorecard',
    name: 'Scorecard',
    description: 'Service health scorecard with checks',
    icon: CheckCircle,
    category: 'metrics',
    defaultConfig: { title: 'Health Score' },
    defaultSize: { width: 4, height: 4 },
  },
  {
    type: 'metric-chart',
    name: 'Metric Chart',
    description: 'Line or bar chart for metrics',
    icon: LineChart,
    category: 'metrics',
    defaultConfig: { title: 'Metrics' },
    defaultSize: { width: 6, height: 4 },
  },
  {
    type: 'stats-card',
    name: 'Stats Card',
    description: 'Key performance indicator display',
    icon: TrendingUp,
    category: 'metrics',
    defaultConfig: { title: 'Statistics' },
    defaultSize: { width: 3, height: 2 },
  },
  {
    type: 'gauge',
    name: 'Gauge',
    description: 'Circular gauge for percentage metrics',
    icon: Gauge,
    category: 'metrics',
    defaultConfig: { title: 'Gauge' },
    defaultSize: { width: 2, height: 2 },
  },
  {
    type: 'pie-chart',
    name: 'Pie Chart',
    description: 'Distribution visualization',
    icon: PieChart,
    category: 'metrics',
    defaultConfig: { title: 'Distribution' },
    defaultSize: { width: 4, height: 4 },
  },
  {
    type: 'bar-chart',
    name: 'Bar Chart',
    description: 'Comparison bar chart',
    icon: BarChart3,
    category: 'metrics',
    defaultConfig: { title: 'Comparison' },
    defaultSize: { width: 6, height: 4 },
  },
  {
    type: 'incidents',
    name: 'Incidents',
    description: 'Active incidents and alerts',
    icon: AlertTriangle,
    category: 'metrics',
    defaultConfig: { title: 'Incidents' },
    defaultSize: { width: 4, height: 4 },
  },

  // Deployment Widgets
  {
    type: 'deployments',
    name: 'Deployments',
    description: 'Recent deployments timeline',
    icon: Activity,
    category: 'deployment',
    defaultConfig: { title: 'Deployments' },
    defaultSize: { width: 6, height: 4 },
  },
  {
    type: 'pipeline-status',
    name: 'Pipeline Status',
    description: 'CI/CD pipeline status overview',
    icon: Workflow,
    category: 'deployment',
    defaultConfig: { title: 'Pipelines' },
    defaultSize: { width: 6, height: 3 },
  },
  {
    type: 'environment-status',
    name: 'Environment Status',
    description: 'Environment health across stages',
    icon: Server,
    category: 'deployment',
    defaultConfig: { title: 'Environments' },
    defaultSize: { width: 8, height: 3 },
  },
  {
    type: 'resource-usage',
    name: 'Resource Usage',
    description: 'CPU, memory, and storage usage',
    icon: Cpu,
    category: 'deployment',
    defaultConfig: { title: 'Resources' },
    defaultSize: { width: 4, height: 3 },
  },

  // Documentation Widgets
  {
    type: 'tech-docs',
    name: 'TechDocs',
    description: 'Embedded technical documentation',
    icon: FileText,
    category: 'documentation',
    defaultConfig: { title: 'Documentation' },
    defaultSize: { width: 8, height: 6 },
  },
  {
    type: 'api-docs',
    name: 'API Docs',
    description: 'OpenAPI documentation viewer',
    icon: Code,
    category: 'documentation',
    defaultConfig: { title: 'API Reference' },
    defaultSize: { width: 8, height: 6 },
  },
  {
    type: 'readme',
    name: 'README',
    description: 'Service README display',
    icon: Info,
    category: 'documentation',
    defaultConfig: { title: 'README' },
    defaultSize: { width: 6, height: 4 },
  },
  {
    type: 'changelog',
    name: 'Changelog',
    description: 'Recent changes and releases',
    icon: Clock,
    category: 'documentation',
    defaultConfig: { title: 'Changelog' },
    defaultSize: { width: 4, height: 4 },
  },

  // Integration Widgets
  {
    type: 'github-activity',
    name: 'GitHub Activity',
    description: 'Recent commits and PRs',
    icon: GitBranch,
    category: 'integration',
    defaultConfig: { title: 'GitHub Activity' },
    defaultSize: { width: 6, height: 4 },
  },
  {
    type: 'jira-issues',
    name: 'Jira Issues',
    description: 'Related Jira issues',
    icon: Bookmark,
    category: 'integration',
    defaultConfig: { title: 'Jira Issues' },
    defaultSize: { width: 6, height: 4 },
  },
  {
    type: 'slack-channel',
    name: 'Slack Channel',
    description: 'Team Slack channel integration',
    icon: MessageSquare,
    category: 'integration',
    defaultConfig: { title: 'Slack' },
    defaultSize: { width: 4, height: 3 },
  },
  {
    type: 'pagerduty',
    name: 'PagerDuty',
    description: 'On-call schedule and incidents',
    icon: Bell,
    category: 'integration',
    defaultConfig: { title: 'On-Call' },
    defaultSize: { width: 4, height: 3 },
  },
  {
    type: 'datadog',
    name: 'Datadog',
    description: 'Datadog dashboard embed',
    icon: Activity,
    category: 'integration',
    defaultConfig: { title: 'Datadog' },
    defaultSize: { width: 6, height: 4 },
  },
  {
    type: 'grafana',
    name: 'Grafana',
    description: 'Grafana panel embed',
    icon: LineChart,
    category: 'integration',
    defaultConfig: { title: 'Grafana' },
    defaultSize: { width: 6, height: 4 },
  },

  // Layout Widgets
  {
    type: 'tabs',
    name: 'Tabs',
    description: 'Tabbed content container',
    icon: Layout,
    category: 'layout',
    defaultConfig: { title: 'Tabs' },
    defaultSize: { width: 12, height: 6 },
  },
  {
    type: 'grid-container',
    name: 'Grid Container',
    description: 'Nested grid layout',
    icon: Grid,
    category: 'layout',
    defaultConfig: { title: 'Grid' },
    defaultSize: { width: 12, height: 6 },
  },
  {
    type: 'accordion',
    name: 'Accordion',
    description: 'Collapsible content sections',
    icon: ChevronDown,
    category: 'layout',
    defaultConfig: { title: 'Accordion' },
    defaultSize: { width: 6, height: 4 },
  },
  {
    type: 'divider',
    name: 'Divider',
    description: 'Visual section separator',
    icon: Settings,
    category: 'layout',
    defaultConfig: { title: '' },
    defaultSize: { width: 12, height: 1 },
  },

  // Custom Widgets
  {
    type: 'custom-component',
    name: 'Custom Component',
    description: 'Custom React component',
    icon: Sparkles,
    category: 'custom',
    defaultConfig: { title: 'Custom' },
    defaultSize: { width: 6, height: 4 },
  },
  {
    type: 'iframe',
    name: 'iFrame',
    description: 'Embed external content',
    icon: Globe,
    category: 'custom',
    defaultConfig: { title: 'Embed' },
    defaultSize: { width: 6, height: 4 },
  },
  {
    type: 'markdown',
    name: 'Markdown',
    description: 'Rich text markdown content',
    icon: FileText,
    category: 'custom',
    defaultConfig: { title: 'Content' },
    defaultSize: { width: 6, height: 4 },
  },
  {
    type: 'action-button',
    name: 'Action Button',
    description: 'Self-service action trigger',
    icon: Terminal,
    category: 'custom',
    defaultConfig: { title: 'Action' },
    defaultSize: { width: 2, height: 1 },
  },
  {
    type: 'search-bar',
    name: 'Search Bar',
    description: 'Catalog search input',
    icon: Search,
    category: 'custom',
    defaultConfig: { title: '' },
    defaultSize: { width: 6, height: 1 },
  },
];

const CATEGORY_INFO = {
  catalog: { label: 'Catalog', icon: Database, color: 'text-blue-500' },
  metrics: { label: 'Metrics & Health', icon: Activity, color: 'text-green-500' },
  deployment: { label: 'Deployment', icon: Workflow, color: 'text-purple-500' },
  documentation: { label: 'Documentation', icon: FileText, color: 'text-orange-500' },
  integration: { label: 'Integrations', icon: Link, color: 'text-pink-500' },
  layout: { label: 'Layout', icon: Layout, color: 'text-gray-500' },
  custom: { label: 'Custom', icon: Sparkles, color: 'text-yellow-500' },
};

interface DraggableWidgetItemProps {
  widget: WidgetDefinition;
}

function DraggableWidgetItem({ widget }: DraggableWidgetItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `widget-${widget.type}`,
    data: {
      type: 'widget',
      widgetType: widget.type,
      widgetDefinition: widget,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const Icon = widget.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700',
        'bg-white dark:bg-gray-800 cursor-grab hover:border-blue-400 hover:shadow-sm',
        'transition-all duration-150',
        isDragging && 'opacity-50 cursor-grabbing shadow-lg'
      )}
    >
      <div className="flex-shrink-0 p-2 rounded-md bg-gray-100 dark:bg-gray-700">
        <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {widget.name}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
          {widget.description}
        </div>
      </div>
    </div>
  );
}

interface WidgetLibraryProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  collapsedCategories?: string[];
  onToggleCategory?: (category: string) => void;
  className?: string;
}

export function WidgetLibrary({
  searchQuery = '',
  onSearchChange,
  collapsedCategories = [],
  onToggleCategory,
  className,
}: WidgetLibraryProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [localCollapsed, setLocalCollapsed] = useState<Set<string>>(new Set(collapsedCategories));

  const search = onSearchChange ? searchQuery : localSearch;
  const collapsed = onToggleCategory ? new Set(collapsedCategories) : localCollapsed;

  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      setLocalSearch(value);
    }
  };

  const handleToggleCategory = (category: string) => {
    if (onToggleCategory) {
      onToggleCategory(category);
    } else {
      setLocalCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(category)) {
          next.delete(category);
        } else {
          next.add(category);
        }
        return next;
      });
    }
  };

  const filteredWidgets = useMemo(() => {
    if (!search.trim()) return WIDGET_DEFINITIONS;
    const query = search.toLowerCase();
    return WIDGET_DEFINITIONS.filter(
      (w) =>
        w.name.toLowerCase().includes(query) ||
        w.description.toLowerCase().includes(query) ||
        w.type.toLowerCase().includes(query)
    );
  }, [search]);

  const groupedWidgets = useMemo(() => {
    const groups: Record<string, WidgetDefinition[]> = {};
    for (const widget of filteredWidgets) {
      if (!groups[widget.category]) {
        groups[widget.category] = [];
      }
      groups[widget.category].push(widget);
    }
    return groups;
  }, [filteredWidgets]);

  const categories = Object.keys(CATEGORY_INFO) as Array<keyof typeof CATEGORY_INFO>;

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Search */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search widgets..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Widget List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {categories.map((category) => {
          const widgets = groupedWidgets[category];
          if (!widgets || widgets.length === 0) return null;

          const info = CATEGORY_INFO[category];
          const CategoryIcon = info.icon;
          const isCollapsed = collapsed.has(category);

          return (
            <div key={category}>
              <button
                onClick={() => handleToggleCategory(category)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
                <CategoryIcon className={cn('h-4 w-4', info.color)} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {info.label}
                </span>
                <span className="ml-auto text-xs text-gray-400">{widgets.length}</span>
              </button>

              {!isCollapsed && (
                <div className="mt-2 space-y-2 ml-6">
                  {widgets.map((widget) => (
                    <DraggableWidgetItem key={widget.type} widget={widget} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredWidgets.length === 0 && (
          <div className="text-center py-8">
            <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No widgets match your search
            </p>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Drag widgets to the canvas to add them to your page
        </p>
      </div>
    </div>
  );
}

export { WIDGET_DEFINITIONS, type WidgetDefinition };
export default WidgetLibrary;
