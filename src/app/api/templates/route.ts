/**
 * Software Templates API
 * List and create templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTemplateEngine } from '@/services/templates';

export const dynamic = 'force-dynamic';

/**
 * GET /api/templates
 * List all templates with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const engine = getTemplateEngine();

    const options = {
      category: searchParams.get('category') || undefined,
      type: searchParams.get('type') || undefined,
      owner: searchParams.get('owner') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      goldenPath: searchParams.get('goldenPath') === 'true' ? true : undefined,
      tags: searchParams.get('tags')?.split(',') || undefined,
    };

    const result = await engine.listTemplates(options as Parameters<typeof engine.listTemplates>[0]);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to list templates:', error);
    return NextResponse.json(
      { error: 'Failed to list templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates
 * Create a new template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const engine = getTemplateEngine();

    // Validate required fields
    if (!body.name || !body.title || !body.steps) {
      return NextResponse.json(
        { error: 'Name, title, and steps are required' },
        { status: 400 }
      );
    }

    const template = await engine.createTemplate(body);

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Failed to create template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
