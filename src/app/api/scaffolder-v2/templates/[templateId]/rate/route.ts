import { NextRequest, NextResponse } from 'next/server';
import { TemplateMarketplaceEngine } from '@/lib/scaffolder-v2/marketplace-engine';

const marketplaceEngine = TemplateMarketplaceEngine.getInstance();

export async function POST(
  request: NextRequest,
  { params }: { params: { templateId: string } }
) {
  try {
    const body = await request.json();
    const { userId, rating, review } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    await marketplaceEngine.rateTemplate(
      params.templateId,
      userId,
      rating,
      review
    );

    return NextResponse.json({
      success: true,
      message: 'Rating submitted successfully'
    });
  } catch (error) {
    console.error('Error rating template:', error);
    
    if ((error as Error).message.includes('not found')) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to submit rating' },
      { status: 500 }
    );
  }
}