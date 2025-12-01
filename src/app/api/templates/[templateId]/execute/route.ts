/**
 * Template Execution API
 * Execute templates and manage executions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTemplateEngine } from '@/services/templates';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ templateId: string }>;
}

/**
 * POST /api/templates/[templateId]/execute
 * Execute a template
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { templateId } = await params;
    const body = await request.json();
    const engine = getTemplateEngine();

    const { parameters = {}, dryRun = false } = body;

    // In production, get userId from session
    const userId = 'current-user';

    const result = await engine.executeTemplate(
      templateId,
      parameters,
      userId,
      dryRun
    );

    return NextResponse.json(result, { status: dryRun ? 200 : 202 });
  } catch (error) {
    console.error('Failed to execute template:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/templates/[templateId]/execute
 * List executions for a template
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { templateId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || undefined;
    const engine = getTemplateEngine();

    const executions = await engine.listExecutions(templateId, userId);

    return NextResponse.json({
      executions,
      total: executions.length,
    });
  } catch (error) {
    console.error('Failed to list executions:', error);
    return NextResponse.json(
      { error: 'Failed to list executions' },
      { status: 500 }
    );
  }
}
