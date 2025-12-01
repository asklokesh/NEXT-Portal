/**
 * Page Builder API - Individual Page Operations
 * Get, update, delete, and manage individual pages
 */

import { NextRequest, NextResponse } from 'next/server';

// Type definitions (shared with parent route)
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

// In-memory storage (shared with parent route in production)
// This is a simplified version - in production, use a proper database
const pages: Map<string, PortalPage> = new Map();

// Version history for each page
const pageVersions: Map<string, PortalPage[]> = new Map();

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ pageId: string }>;
}

/**
 * GET /api/builder/pages/[pageId]
 * Get a specific page by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { pageId } = await params;
    const { searchParams } = new URL(request.url);
    const version = searchParams.get('version');

    // Get specific version if requested
    if (version) {
      const versions = pageVersions.get(pageId);
      if (versions) {
        const versionNum = parseInt(version);
        const page = versions.find((v) => v.metadata.version === versionNum);
        if (page) {
          return NextResponse.json(page);
        }
      }
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    const page = pages.get(pageId);
    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(page);
  } catch (error) {
    console.error('Failed to get page:', error);
    return NextResponse.json(
      { error: 'Failed to get page' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/builder/pages/[pageId]
 * Update a page
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { pageId } = await params;
    const body = await request.json();

    const existingPage = pages.get(pageId);
    if (!existingPage) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    // Check for path conflicts (excluding current page)
    if (body.path && body.path !== existingPage.path) {
      const conflictingPage = Array.from(pages.values()).find(
        (p) => p.path === body.path && p.id !== pageId
      );
      if (conflictingPage) {
        return NextResponse.json(
          { error: 'A page with this path already exists' },
          { status: 409 }
        );
      }
    }

    // Store current version in history
    let versions = pageVersions.get(pageId) || [];
    versions.push({ ...existingPage });
    // Keep last 50 versions
    if (versions.length > 50) {
      versions = versions.slice(-50);
    }
    pageVersions.set(pageId, versions);

    const now = new Date().toISOString();
    const updatedPage: PortalPage = {
      ...existingPage,
      ...body,
      id: pageId, // Ensure ID doesn't change
      metadata: {
        ...existingPage.metadata,
        updatedAt: now,
        updatedBy: 'current-user', // Replace with actual user
        version: existingPage.metadata.version + 1,
      },
    };

    pages.set(pageId, updatedPage);

    return NextResponse.json(updatedPage);
  } catch (error) {
    console.error('Failed to update page:', error);
    return NextResponse.json(
      { error: 'Failed to update page' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/builder/pages/[pageId]
 * Partial update (e.g., status change, publish)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { pageId } = await params;
    const body = await request.json();

    const existingPage = pages.get(pageId);
    if (!existingPage) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const updates: Partial<PortalPage> = {};

    // Handle status changes
    if (body.status) {
      updates.metadata = {
        ...existingPage.metadata,
        status: body.status,
        updatedAt: now,
        updatedBy: 'current-user',
      };

      if (body.status === 'published') {
        updates.metadata.publishedAt = now;
      }
    }

    // Handle other partial updates
    if (body.name) updates.name = body.name;
    if (body.description) updates.description = body.description;
    if (body.settings) updates.settings = { ...existingPage.settings, ...body.settings };
    if (body.permissions) updates.permissions = { ...existingPage.permissions, ...body.permissions };

    const updatedPage: PortalPage = {
      ...existingPage,
      ...updates,
    };

    pages.set(pageId, updatedPage);

    return NextResponse.json(updatedPage);
  } catch (error) {
    console.error('Failed to patch page:', error);
    return NextResponse.json(
      { error: 'Failed to update page' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/builder/pages/[pageId]
 * Delete a page (or archive it)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { pageId } = await params;
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    const existingPage = pages.get(pageId);
    if (!existingPage) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    if (permanent) {
      // Permanently delete the page and its version history
      pages.delete(pageId);
      pageVersions.delete(pageId);
      return NextResponse.json({ success: true, deleted: true });
    } else {
      // Archive the page (soft delete)
      const now = new Date().toISOString();
      const archivedPage: PortalPage = {
        ...existingPage,
        metadata: {
          ...existingPage.metadata,
          status: 'archived',
          updatedAt: now,
          updatedBy: 'current-user',
        },
      };
      pages.set(pageId, archivedPage);
      return NextResponse.json({ success: true, archived: true });
    }
  } catch (error) {
    console.error('Failed to delete page:', error);
    return NextResponse.json(
      { error: 'Failed to delete page' },
      { status: 500 }
    );
  }
}
