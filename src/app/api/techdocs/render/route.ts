import { NextRequest, NextResponse } from 'next/server';
import TechDocsService from '@/lib/techdocs/TechDocsService';

const techDocsService = new TechDocsService({
  storageProvider: 'local',
  storageConfig: {
    basePath: process.env.TECHDOCS_STORAGE_PATH || './techdocs-storage'
  },
  cacheDuration: 5 * 60 * 1000, // 5 minutes
  supportedFormats: ['.md', '.mdx'],
  enableVersioning: true,
  enableSearch: true,
  enableLiveReload: process.env.NODE_ENV === 'development'
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entity, sourcePath, options } = body;

    if (!entity || !sourcePath) {
      return NextResponse.json(
        { error: 'Entity and sourcePath are required' },
        { status: 400 }
      );
    }

    const pages = await techDocsService.renderDocs(entity, sourcePath, options);

    return NextResponse.json({
      success: true,
      pages,
      count: pages.length
    });
  } catch (error) {
    console.error('Failed to render TechDocs:', error);
    return NextResponse.json(
      { error: 'Failed to render documentation' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityRef = searchParams.get('entityRef');
    const pagePath = searchParams.get('page');

    if (!entityRef) {
      return NextResponse.json(
        { error: 'entityRef is required' },
        { status: 400 }
      );
    }

    if (pagePath) {
      const page = await techDocsService.getPage(entityRef, pagePath);
      if (!page) {
        return NextResponse.json(
          { error: 'Page not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(page);
    }

    const pages = await techDocsService.getDocsForEntity(entityRef);
    return NextResponse.json({
      success: true,
      pages,
      count: pages.length
    });
  } catch (error) {
    console.error('Failed to get TechDocs:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve documentation' },
      { status: 500 }
    );
  }
}