import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    await prisma.integration.updateMany({
      where: {
        provider: 'GITHUB',
        status: 'ACTIVE',
      },
      data: {
        status: 'INACTIVE',
      },
    });

    return NextResponse.json({ success: true, connected: false });
  } catch (error) {
    console.error('GitHub disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect GitHub integration' },
      { status: 500 }
    );
  }
}
