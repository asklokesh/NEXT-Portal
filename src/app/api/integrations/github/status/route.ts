import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const integration = await prisma.integration.findFirst({
      where: {
        provider: 'GITHUB',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        status: true,
        config: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!integration) {
      return NextResponse.json({ connected: false });
    }

    const config = integration.config as Record<string, any> | null;

    return NextResponse.json({
      connected: true,
      integration: {
        id: integration.id,
        name: integration.name,
        status: integration.status,
        installedAt: integration.createdAt,
        updatedAt: integration.updatedAt,
        org: config?.org || null,
        repos: config?.repos || [],
      },
    });
  } catch (error) {
    console.error('GitHub status check error:', error);
    return NextResponse.json({ connected: false });
  }
}
