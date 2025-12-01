/**
 * Individual Template API
 * Get, update, delete templates
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTemplateEngine } from '@/services/templates';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ templateId: string }>;
}

/**
 * GET /api/templates/[templateId]
 * Get a specific template
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { templateId } = await params;
    const engine = getTemplateEngine();

    const template = await engine.getTemplate(templateId);
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Failed to get template:', error);
    return NextResponse.json(
      { error: 'Failed to get template' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/templates/[templateId]
 * Update a template
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { templateId } = await params;
    const body = await request.json();
    const engine = getTemplateEngine();

    const updated = await engine.updateTemplate(templateId, body);
    if (!updated) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/[templateId]
 * Delete a template
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { templateId } = await params;
    const engine = getTemplateEngine();

    const deleted = await engine.deleteTemplate(templateId);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
