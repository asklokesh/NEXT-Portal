import { NextRequest, NextResponse } from 'next/server';
import { templateEngine } from '@/lib/templates/engine';
import { templateClient } from '@/lib/templates/client';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { templateName, parameters } = body;

    if (!templateName) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    // Fetch the template
    const template = await templateClient.getTemplate(templateName);
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Execute the template
    const execution = await templateEngine.execute(
      template,
      parameters || {},
      auth.userId
    );

    return NextResponse.json(execution);
  } catch (error) {
    console.error('Error executing template:', error);
    return NextResponse.json(
      { error: 'Failed to execute template' },
      { status: 500 }
    );
  }
}