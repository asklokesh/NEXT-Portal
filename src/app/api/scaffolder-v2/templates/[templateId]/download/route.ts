import { NextRequest, NextResponse } from 'next/server';
import { TemplateMarketplaceEngine } from '@/lib/scaffolder-v2/marketplace-engine';

const marketplaceEngine = TemplateMarketplaceEngine.getInstance();

export async function POST(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    // Download template and increment counter
    const template = await marketplaceEngine.downloadTemplate(
      params.templateId,
      userId || undefined
    );

    return NextResponse.json({
      template,
      downloadedAt: new Date().toISOString(),
      message: 'Template downloaded successfully'
    });
  } catch (error) {
    console.error('Error downloading template:', error);
    
    if ((error as Error).message.includes('not found')) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to download template' },
      { status: 500 }
    );
  }
}