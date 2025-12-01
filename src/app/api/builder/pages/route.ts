/**
 * Page Builder API - Pages CRUD
 * Manage custom portal pages
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Type definitions
interface PageWidget {
  id: string;
  type: string;
  position: { x: number; y: number; width: number; height: number };
  config: Record<string, unknown>;
}

interface PortalPage {
  id: string;
  name: string;
  path: string;
  description?: string;
  layout: {
    type: 'grid' | 'tabs' | 'sidebar' | 'full-width';
    columns?: number;
    gap?: string;
  };
  widgets: PageWidget[];
  settings: Record<string, unknown>;
  permissions?: {
    view?: string[];
    edit?: string[];
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    updatedBy: string;
    version: number;
    status: 'draft' | 'published' | 'archived';
    publishedAt?: string;
  };
}

// In-memory storage (replace with database in production)
const pages: Map<string, PortalPage> = new Map();

// Initialize with default pages
const initializeDefaultPages = () => {
  if (pages.size === 0) {
    const defaultPages: PortalPage[] = [
      {
        id: 'home',
        name: 'Developer Portal Home',
        path: '/',
        description: 'Main landing page for the developer portal',
        layout: { type: 'grid', columns: 12, gap: 'default' },
        widgets: [
          {
            id: 'search-1',
            type: 'search-bar',
            position: { x: 2, y: 0, width: 8, height: 1 },
            config: { placeholder: 'Search services, APIs, documentation...' },
          },
          {
            id: 'stats-1',
            type: 'stats-card',
            position: { x: 0, y: 1, width: 3, height: 2 },
            config: { title: 'Services', metric: 'total_services' },
          },
          {
            id: 'stats-2',
            type: 'stats-card',
            position: { x: 3, y: 1, width: 3, height: 2 },
            config: { title: 'APIs', metric: 'total_apis' },
          },
          {
            id: 'stats-3',
            type: 'stats-card',
            position: { x: 6, y: 1, width: 3, height: 2 },
            config: { title: 'Teams', metric: 'total_teams' },
          },
          {
            id: 'stats-4',
            type: 'stats-card',
            position: { x: 9, y: 1, width: 3, height: 2 },
            config: { title: 'Deployments', metric: 'deployments_today' },
          },
        ],
        settings: { theme: 'inherit' },
        permissions: { view: ['*'], edit: ['group:admins'] },
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'system',
          updatedBy: 'system',
          version: 1,
          status: 'published',
          publishedAt: new Date().toISOString(),
        },
      },
    ];

    for (const page of defaultPages) {
      pages.set(page.id, page);
    }
  }
};

initializeDefaultPages();

export const dynamic = 'force-dynamic';

/**
 * GET /api/builder/pages
 * List all pages with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let results = Array.from(pages.values());

    // Filter by status
    if (status) {
      results = results.filter((p) => p.metadata.status === status);
    }

    // Search by name or path
    if (search) {
      const searchLower = search.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.path.toLowerCase().includes(searchLower)
      );
    }

    // Sort by updated date
    results.sort(
      (a, b) =>
        new Date(b.metadata.updatedAt).getTime() -
        new Date(a.metadata.updatedAt).getTime()
    );

    // Pagination
    const total = results.length;
    results = results.slice(offset, offset + limit);

    return NextResponse.json({
      pages: results,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Failed to list pages:', error);
    return NextResponse.json(
      { error: 'Failed to list pages' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/builder/pages
 * Create a new page
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.path) {
      return NextResponse.json(
        { error: 'Name and path are required' },
        { status: 400 }
      );
    }

    // Check for duplicate path
    const existingPage = Array.from(pages.values()).find(
      (p) => p.path === body.path
    );
    if (existingPage) {
      return NextResponse.json(
        { error: 'A page with this path already exists' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const newPage: PortalPage = {
      id: body.id || uuidv4(),
      name: body.name,
      path: body.path,
      description: body.description,
      layout: body.layout || { type: 'grid', columns: 12, gap: 'default' },
      widgets: body.widgets || [],
      settings: body.settings || {},
      permissions: body.permissions || { view: ['*'], edit: ['group:admins'] },
      metadata: {
        createdAt: now,
        updatedAt: now,
        createdBy: 'current-user', // Replace with actual user
        updatedBy: 'current-user',
        version: 1,
        status: 'draft',
      },
    };

    pages.set(newPage.id, newPage);

    return NextResponse.json(newPage, { status: 201 });
  } catch (error) {
    console.error('Failed to create page:', error);
    return NextResponse.json(
      { error: 'Failed to create page' },
      { status: 500 }
    );
  }
}
