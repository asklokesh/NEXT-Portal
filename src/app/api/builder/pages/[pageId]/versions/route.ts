/**
 * Page Builder API - Page Version History
 * Get and manage version history for pages
 */

import { NextRequest, NextResponse } from 'next/server';

interface PageVersion {
  version: number;
  createdAt: string;
  createdBy: string;
  changes?: string;
}

// In-memory storage for version metadata
const versionMetadata: Map<string, PageVersion[]> = new Map();

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ pageId: string }>;
}

/**
 * GET /api/builder/pages/[pageId]/versions
 * Get version history for a page
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { pageId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get version history
    let versions = versionMetadata.get(pageId) || [];

    // Sort by version number descending
    versions.sort((a, b) => b.version - a.version);

    // Pagination
    const total = versions.length;
    versions = versions.slice(offset, offset + limit);

    return NextResponse.json({
      pageId,
      versions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Failed to get page versions:', error);
    return NextResponse.json(
      { error: 'Failed to get page versions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/builder/pages/[pageId]/versions/restore
 * Restore a specific version
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { pageId } = await params;
    const body = await request.json();

    if (!body.version) {
      return NextResponse.json(
        { error: 'Version number is required' },
        { status: 400 }
      );
    }

    // In production, this would:
    // 1. Get the page data for the specified version
    // 2. Create a new version with the restored content
    // 3. Update the current page

    return NextResponse.json({
      success: true,
      message: `Page restored to version ${body.version}`,
      pageId,
      restoredVersion: body.version,
    });
  } catch (error) {
    console.error('Failed to restore page version:', error);
    return NextResponse.json(
      { error: 'Failed to restore page version' },
      { status: 500 }
    );
  }
}
