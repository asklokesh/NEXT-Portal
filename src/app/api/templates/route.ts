/**
 * Software Templates API
 * List and create templates via ScaffoldOrchestrator
 */

import { NextRequest, NextResponse } from 'next/server';
import { getScaffoldOrchestrator } from '@/services/scaffolding/scaffold-orchestrator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/templates
 * List all templates with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orchestrator = getScaffoldOrchestrator();

    const filters = {
      category: searchParams.get('category') || undefined,
      technology: searchParams.get('technology') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const templates = await orchestrator.getTemplates(filters);

    return NextResponse.json({
      templates,
      total: templates.length,
      pagination: {
        limit: 50,
        offset: 0,
        hasMore: false
      }
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
 * POST /api/templates
 * Create a new template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const orchestrator = getScaffoldOrchestrator();

    // Basic validation
    if (!body.id || !body.name) {
      // If ID is missing but name exists, generate ID
      if (body.name && !body.id) {
        body.id = body.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      } else if (!body.name) {
        return NextResponse.json(
          { error: 'Name is required' },
          { status: 400 }
        );
      }
    }

    // Add default fields if missing to match ServiceTemplate interface
    const newTemplate = {
      ...body,
      description: body.description || '',
      version: body.version || '1.0.0',
      technology: body.technology || 'general',
      category: body.category || 'service',
      parameters: body.parameters || [],
      files: body.files || [],
      hooks: body.hooks || [],
      dependencies: body.dependencies || [],
      metadata: body.metadata || {
        author: 'user',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: [],
        documentation: ''
      }
    };

    await orchestrator.addTemplate(newTemplate);

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    console.error('Failed to create template:', error);
    return NextResponse.json(
      { error: 'Failed to create template: ' + String(error) },
      { status: 500 }
    );
  }
}
