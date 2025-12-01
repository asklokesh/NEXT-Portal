/**
 * Page Builder API - Templates
 * Manage page templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

interface PageTemplate {
  id: string;
  name: string;
  description: string;
  category: 'service' | 'team' | 'dashboard' | 'documentation' | 'custom';
  thumbnail?: string;
  tags: string[];
  featured: boolean;
  config: {
    layout: {
      type: string;
      columns?: number;
      gap?: string;
    };
    widgets: Array<{
      type: string;
      position: { x: number; y: number; width: number; height: number };
      config?: Record<string, unknown>;
    }>;
    settings?: Record<string, unknown>;
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    usageCount: number;
    isSystem: boolean;
  };
}

// In-memory storage for templates
const templates: Map<string, PageTemplate> = new Map();

// Initialize with default templates
const initializeDefaultTemplates = () => {
  if (templates.size === 0) {
    const defaultTemplates: PageTemplate[] = [
      {
        id: 'service-overview',
        name: 'Service Overview',
        description: 'Complete service detail page with health, dependencies, and documentation',
        category: 'service',
        tags: ['service', 'overview', 'health'],
        featured: true,
        config: {
          layout: { type: 'grid', columns: 12, gap: 'default' },
          widgets: [
            { type: 'service-card', position: { x: 0, y: 0, width: 4, height: 3 } },
            { type: 'scorecard', position: { x: 4, y: 0, width: 4, height: 3 } },
            { type: 'stats-card', position: { x: 8, y: 0, width: 4, height: 3 } },
            { type: 'dependency-graph', position: { x: 0, y: 3, width: 8, height: 6 } },
            { type: 'deployments', position: { x: 8, y: 3, width: 4, height: 6 } },
          ],
        },
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system',
          usageCount: 0,
          isSystem: true,
        },
      },
      {
        id: 'team-home',
        name: 'Team Home',
        description: 'Team landing page with owned services, members, and activity',
        category: 'team',
        tags: ['team', 'home', 'members'],
        featured: true,
        config: {
          layout: { type: 'grid', columns: 12 },
          widgets: [
            { type: 'team-card', position: { x: 0, y: 0, width: 4, height: 3 } },
            { type: 'stats-card', position: { x: 4, y: 0, width: 4, height: 3 } },
            { type: 'pagerduty', position: { x: 8, y: 0, width: 4, height: 3 } },
            { type: 'entity-list', position: { x: 0, y: 3, width: 8, height: 5 } },
            { type: 'github-activity', position: { x: 8, y: 3, width: 4, height: 5 } },
          ],
        },
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system',
          usageCount: 0,
          isSystem: true,
        },
      },
      {
        id: 'executive-dashboard',
        name: 'Executive Dashboard',
        description: 'High-level metrics and KPIs for leadership',
        category: 'dashboard',
        tags: ['dashboard', 'executive', 'kpis'],
        featured: true,
        config: {
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
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system',
          usageCount: 0,
          isSystem: true,
        },
      },
      {
        id: 'blank-page',
        name: 'Blank Page',
        description: 'Start from scratch with an empty canvas',
        category: 'custom',
        tags: ['blank', 'custom', 'empty'],
        featured: false,
        config: {
          layout: { type: 'grid', columns: 12, gap: 'default' },
          widgets: [],
        },
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system',
          usageCount: 0,
          isSystem: true,
        },
      },
    ];

    for (const template of defaultTemplates) {
      templates.set(template.id, template);
    }
  }
};

initializeDefaultTemplates();

export const dynamic = 'force-dynamic';

/**
 * GET /api/builder/templates
 * List all templates with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const featured = searchParams.get('featured');

    let results = Array.from(templates.values());

    // Filter by category
    if (category) {
      results = results.filter((t) => t.category === category);
    }

    // Filter by featured
    if (featured === 'true') {
      results = results.filter((t) => t.featured);
    }

    // Search by name, description, or tags
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description.toLowerCase().includes(searchLower) ||
          t.tags.some((tag) => tag.toLowerCase().includes(searchLower))
      );
    }

    // Sort: featured first, then by usage count
    results.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return b.metadata.usageCount - a.metadata.usageCount;
    });

    return NextResponse.json({
      templates: results,
      total: results.length,
    });
  } catch (error) {
    console.error('Failed to list templates:', error);
    return NextResponse.json(
      { error: 'Failed to list templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/builder/templates
 * Create a new template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.config) {
      return NextResponse.json(
        { error: 'Name and config are required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const newTemplate: PageTemplate = {
      id: body.id || uuidv4(),
      name: body.name,
      description: body.description || '',
      category: body.category || 'custom',
      thumbnail: body.thumbnail,
      tags: body.tags || [],
      featured: body.featured || false,
      config: body.config,
      metadata: {
        createdAt: now,
        updatedAt: now,
        createdBy: 'current-user',
        usageCount: 0,
        isSystem: false,
      },
    };

    templates.set(newTemplate.id, newTemplate);

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    console.error('Failed to create template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
