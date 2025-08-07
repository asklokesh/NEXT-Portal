import { NextRequest, NextResponse } from 'next/server';
import { templateEngine } from '@/lib/templates/engine';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const success = templateEngine.cancelExecution(params.id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to cancel execution' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling execution:', error);
    return NextResponse.json(
      { error: 'Failed to cancel execution' },
      { status: 500 }
    );
  }
}