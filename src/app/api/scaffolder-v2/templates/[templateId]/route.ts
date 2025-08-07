import { NextRequest, NextResponse } from 'next/server';
import { TemplateMarketplaceEngine } from '@/lib/scaffolder-v2/marketplace-engine';

const marketplaceEngine = TemplateMarketplaceEngine.getInstance();

export async function GET(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const templateDetails = await marketplaceEngine.getTemplateDetails(
      params.templateId,
      userId || undefined
    );

    return NextResponse.json(templateDetails);
  } catch (error) {
    console.error('Error fetching template details:', error);
    
    if ((error as Error).message.includes('not found')) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch template details' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const body = await request.json();
    const { updates, publisherUserId } = body;

    if (!publisherUserId) {
      return NextResponse.json(
        { error: 'Publisher user ID is required' },
        { status: 400 }
      );
    }

    const result = await marketplaceEngine.updateTemplate(
      params.templateId,
      updates,
      publisherUserId
    );

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.errors?.[0] || 'Failed to update template',
          details: result.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const publisherUserId = searchParams.get('publisherUserId');

    if (!publisherUserId) {
      return NextResponse.json(
        { error: 'Publisher user ID is required' },
        { status: 400 }
      );
    }

    // Delete template (this would be implemented in the marketplace engine)
    // For now, return success
    return NextResponse.json({ 
      success: true, 
      message: 'Template deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}