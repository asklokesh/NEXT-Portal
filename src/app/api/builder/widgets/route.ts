/**
 * Page Builder API - Widget Registry
 * Get available widgets and their configurations
 */

import { NextRequest, NextResponse } from 'next/server';

interface WidgetConfigField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'color' | 'json';
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  helpText?: string;
}

interface WidgetDefinition {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: 'catalog' | 'metrics' | 'deployment' | 'documentation' | 'integration' | 'layout' | 'custom';
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  maxSize?: { width: number; height: number };
  configFields: WidgetConfigField[];
  dataSourceSupport: {
    types: string[];
    required: boolean;
  };
  preview?: string;
}

// Widget definitions registry
const widgetDefinitions: WidgetDefinition[] = [
  // Catalog Widgets
  {
    type: 'service-card',
    name: 'Service Card',
    description: 'Display service information with health status',
    icon: 'Box',
    category: 'catalog',
    defaultSize: { width: 4, height: 3 },
    minSize: { width: 3, height: 2 },
    configFields: [
      { name: 'showHealth', label: 'Show Health Status', type: 'boolean', defaultValue: true },
      { name: 'showOwner', label: 'Show Owner', type: 'boolean', defaultValue: true },
      { name: 'showLinks', label: 'Show Quick Links', type: 'boolean', defaultValue: true },
    ],
    dataSourceSupport: { types: ['catalog'], required: true },
  },
  {
    type: 'entity-list',
    name: 'Entity List',
    description: 'List of catalog entities with filtering',
    icon: 'List',
    category: 'catalog',
    defaultSize: { width: 6, height: 4 },
    minSize: { width: 4, height: 3 },
    configFields: [
      {
        name: 'entityKind',
        label: 'Entity Kind',
        type: 'select',
        options: [
          { label: 'Component', value: 'Component' },
          { label: 'API', value: 'API' },
          { label: 'System', value: 'System' },
          { label: 'Domain', value: 'Domain' },
          { label: 'Resource', value: 'Resource' },
          { label: 'User', value: 'User' },
          { label: 'Group', value: 'Group' },
        ],
        defaultValue: 'Component',
      },
      { name: 'pageSize', label: 'Page Size', type: 'number', defaultValue: 10 },
      { name: 'showFilters', label: 'Show Filters', type: 'boolean', defaultValue: true },
    ],
    dataSourceSupport: { types: ['catalog'], required: true },
  },
  {
    type: 'dependency-graph',
    name: 'Dependency Graph',
    description: 'Interactive service dependency visualization',
    icon: 'GitBranch',
    category: 'catalog',
    defaultSize: { width: 8, height: 6 },
    minSize: { width: 6, height: 4 },
    configFields: [
      { name: 'depth', label: 'Graph Depth', type: 'number', defaultValue: 2 },
      { name: 'direction', label: 'Direction', type: 'select', options: [
        { label: 'Both', value: 'both' },
        { label: 'Upstream', value: 'upstream' },
        { label: 'Downstream', value: 'downstream' },
      ], defaultValue: 'both' },
      { name: 'showLabels', label: 'Show Labels', type: 'boolean', defaultValue: true },
    ],
    dataSourceSupport: { types: ['catalog'], required: true },
  },

  // Metrics Widgets
  {
    type: 'scorecard',
    name: 'Scorecard',
    description: 'Service health scorecard with checks',
    icon: 'CheckCircle',
    category: 'metrics',
    defaultSize: { width: 4, height: 4 },
    minSize: { width: 3, height: 3 },
    configFields: [
      { name: 'showDetails', label: 'Show Check Details', type: 'boolean', defaultValue: true },
      { name: 'maxChecks', label: 'Max Checks to Show', type: 'number', defaultValue: 5 },
    ],
    dataSourceSupport: { types: ['catalog', 'api'], required: true },
  },
  {
    type: 'stats-card',
    name: 'Stats Card',
    description: 'Key performance indicator display',
    icon: 'TrendingUp',
    category: 'metrics',
    defaultSize: { width: 3, height: 2 },
    minSize: { width: 2, height: 2 },
    configFields: [
      { name: 'format', label: 'Number Format', type: 'select', options: [
        { label: 'Number', value: 'number' },
        { label: 'Percentage', value: 'percentage' },
        { label: 'Currency', value: 'currency' },
        { label: 'Duration', value: 'duration' },
      ], defaultValue: 'number' },
      { name: 'showTrend', label: 'Show Trend', type: 'boolean', defaultValue: true },
      { name: 'trendLabel', label: 'Trend Label', type: 'text', defaultValue: 'vs last week' },
    ],
    dataSourceSupport: { types: ['api', 'metrics', 'static'], required: true },
  },
  {
    type: 'metric-chart',
    name: 'Metric Chart',
    description: 'Line or bar chart for metrics',
    icon: 'LineChart',
    category: 'metrics',
    defaultSize: { width: 6, height: 4 },
    minSize: { width: 4, height: 3 },
    configFields: [
      { name: 'chartType', label: 'Chart Type', type: 'select', options: [
        { label: 'Line', value: 'line' },
        { label: 'Bar', value: 'bar' },
        { label: 'Area', value: 'area' },
      ], defaultValue: 'line' },
      { name: 'showLegend', label: 'Show Legend', type: 'boolean', defaultValue: true },
      { name: 'showGrid', label: 'Show Grid', type: 'boolean', defaultValue: true },
    ],
    dataSourceSupport: { types: ['api', 'metrics'], required: true },
  },
  {
    type: 'incidents',
    name: 'Incidents',
    description: 'Active incidents and alerts',
    icon: 'AlertTriangle',
    category: 'metrics',
    defaultSize: { width: 4, height: 4 },
    minSize: { width: 3, height: 3 },
    configFields: [
      { name: 'maxItems', label: 'Max Items', type: 'number', defaultValue: 5 },
      { name: 'showSeverity', label: 'Show Severity', type: 'boolean', defaultValue: true },
      { name: 'filterSeverity', label: 'Min Severity', type: 'select', options: [
        { label: 'All', value: 'all' },
        { label: 'Warning+', value: 'warning' },
        { label: 'Critical Only', value: 'critical' },
      ], defaultValue: 'all' },
    ],
    dataSourceSupport: { types: ['api', 'integration'], required: true },
  },

  // Deployment Widgets
  {
    type: 'deployments',
    name: 'Deployments',
    description: 'Recent deployments timeline',
    icon: 'Activity',
    category: 'deployment',
    defaultSize: { width: 6, height: 4 },
    minSize: { width: 4, height: 3 },
    configFields: [
      { name: 'maxItems', label: 'Max Items', type: 'number', defaultValue: 5 },
      { name: 'showStatus', label: 'Show Status', type: 'boolean', defaultValue: true },
      { name: 'filterEnvironment', label: 'Environment', type: 'select', options: [
        { label: 'All', value: '' },
        { label: 'Production', value: 'production' },
        { label: 'Staging', value: 'staging' },
        { label: 'Development', value: 'development' },
      ], defaultValue: '' },
    ],
    dataSourceSupport: { types: ['api', 'integration'], required: true },
  },
  {
    type: 'pipeline-status',
    name: 'Pipeline Status',
    description: 'CI/CD pipeline status overview',
    icon: 'Workflow',
    category: 'deployment',
    defaultSize: { width: 6, height: 3 },
    minSize: { width: 4, height: 2 },
    configFields: [
      { name: 'showBranch', label: 'Show Branch', type: 'boolean', defaultValue: true },
      { name: 'showDuration', label: 'Show Duration', type: 'boolean', defaultValue: true },
    ],
    dataSourceSupport: { types: ['api', 'integration'], required: true },
  },

  // Documentation Widgets
  {
    type: 'tech-docs',
    name: 'TechDocs',
    description: 'Embedded technical documentation',
    icon: 'FileText',
    category: 'documentation',
    defaultSize: { width: 8, height: 6 },
    minSize: { width: 6, height: 4 },
    configFields: [
      { name: 'entityRef', label: 'Entity Reference', type: 'text', required: true },
      { name: 'showToc', label: 'Show Table of Contents', type: 'boolean', defaultValue: true },
    ],
    dataSourceSupport: { types: ['catalog'], required: true },
  },
  {
    type: 'markdown',
    name: 'Markdown',
    description: 'Rich text markdown content',
    icon: 'FileText',
    category: 'documentation',
    defaultSize: { width: 6, height: 4 },
    minSize: { width: 3, height: 2 },
    configFields: [
      { name: 'content', label: 'Content', type: 'text', required: true, helpText: 'Markdown content' },
    ],
    dataSourceSupport: { types: ['static'], required: false },
  },

  // Integration Widgets
  {
    type: 'github-activity',
    name: 'GitHub Activity',
    description: 'Recent commits and PRs',
    icon: 'GitBranch',
    category: 'integration',
    defaultSize: { width: 6, height: 4 },
    minSize: { width: 4, height: 3 },
    configFields: [
      { name: 'maxItems', label: 'Max Items', type: 'number', defaultValue: 5 },
      { name: 'showCommits', label: 'Show Commits', type: 'boolean', defaultValue: true },
      { name: 'showPRs', label: 'Show Pull Requests', type: 'boolean', defaultValue: true },
    ],
    dataSourceSupport: { types: ['integration'], required: true },
  },
  {
    type: 'pagerduty',
    name: 'PagerDuty',
    description: 'On-call schedule and incidents',
    icon: 'Bell',
    category: 'integration',
    defaultSize: { width: 4, height: 3 },
    minSize: { width: 3, height: 2 },
    configFields: [
      { name: 'showSchedule', label: 'Show Schedule', type: 'boolean', defaultValue: true },
      { name: 'showIncidents', label: 'Show Incidents', type: 'boolean', defaultValue: true },
    ],
    dataSourceSupport: { types: ['integration'], required: true },
  },

  // Layout Widgets
  {
    type: 'tabs',
    name: 'Tabs',
    description: 'Tabbed content container',
    icon: 'Layout',
    category: 'layout',
    defaultSize: { width: 12, height: 6 },
    minSize: { width: 6, height: 4 },
    configFields: [
      { name: 'tabs', label: 'Tab Configuration', type: 'json', defaultValue: [] },
    ],
    dataSourceSupport: { types: [], required: false },
  },
  {
    type: 'divider',
    name: 'Divider',
    description: 'Visual section separator',
    icon: 'Minus',
    category: 'layout',
    defaultSize: { width: 12, height: 1 },
    maxSize: { width: 12, height: 1 },
    configFields: [
      { name: 'label', label: 'Section Label', type: 'text' },
    ],
    dataSourceSupport: { types: [], required: false },
  },

  // Custom Widgets
  {
    type: 'iframe',
    name: 'iFrame',
    description: 'Embed external content',
    icon: 'Globe',
    category: 'custom',
    defaultSize: { width: 6, height: 4 },
    minSize: { width: 3, height: 2 },
    configFields: [
      { name: 'url', label: 'URL', type: 'text', required: true },
      { name: 'allowFullscreen', label: 'Allow Fullscreen', type: 'boolean', defaultValue: true },
    ],
    dataSourceSupport: { types: [], required: false },
  },
  {
    type: 'search-bar',
    name: 'Search Bar',
    description: 'Catalog search input',
    icon: 'Search',
    category: 'custom',
    defaultSize: { width: 6, height: 1 },
    maxSize: { width: 12, height: 1 },
    configFields: [
      { name: 'placeholder', label: 'Placeholder', type: 'text', defaultValue: 'Search...' },
      { name: 'searchScope', label: 'Search Scope', type: 'select', options: [
        { label: 'All', value: 'all' },
        { label: 'Services', value: 'services' },
        { label: 'APIs', value: 'apis' },
        { label: 'Documentation', value: 'docs' },
      ], defaultValue: 'all' },
    ],
    dataSourceSupport: { types: [], required: false },
  },
  {
    type: 'action-button',
    name: 'Action Button',
    description: 'Self-service action trigger',
    icon: 'Play',
    category: 'custom',
    defaultSize: { width: 2, height: 1 },
    minSize: { width: 2, height: 1 },
    configFields: [
      { name: 'label', label: 'Button Label', type: 'text', required: true },
      { name: 'actionId', label: 'Action ID', type: 'text', required: true },
      { name: 'variant', label: 'Style', type: 'select', options: [
        { label: 'Primary', value: 'primary' },
        { label: 'Secondary', value: 'secondary' },
        { label: 'Danger', value: 'danger' },
      ], defaultValue: 'primary' },
    ],
    dataSourceSupport: { types: [], required: false },
  },
];

export const dynamic = 'force-dynamic';

/**
 * GET /api/builder/widgets
 * Get all available widgets
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let results = [...widgetDefinitions];

    // Filter by category
    if (category) {
      results = results.filter((w) => w.category === category);
    }

    // Group by category for easier consumption
    const grouped = results.reduce((acc, widget) => {
      if (!acc[widget.category]) {
        acc[widget.category] = [];
      }
      acc[widget.category].push(widget);
      return acc;
    }, {} as Record<string, WidgetDefinition[]>);

    return NextResponse.json({
      widgets: results,
      grouped,
      categories: ['catalog', 'metrics', 'deployment', 'documentation', 'integration', 'layout', 'custom'],
      total: results.length,
    });
  } catch (error) {
    console.error('Failed to get widgets:', error);
    return NextResponse.json(
      { error: 'Failed to get widgets' },
      { status: 500 }
    );
  }
}
