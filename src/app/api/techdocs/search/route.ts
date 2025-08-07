import { NextRequest, NextResponse } from 'next/server';
import TechDocsService from '@/lib/techdocs/TechDocsService';

const techDocsService = new TechDocsService({
  storageProvider: 'local',
  storageConfig: {
    basePath: process.env.TECHDOCS_STORAGE_PATH || './techdocs-storage'
  },
  cacheDuration: 5 * 60 * 1000,
  supportedFormats: ['.md', '.mdx'],
  enableVersioning: true,
  enableSearch: true,
  enableLiveReload: process.env.NODE_ENV === 'development'
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const entityRef = searchParams.get('entityRef');
    const tags = searchParams.get('tags')?.split(',');
    const owner = searchParams.get('owner');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    const results = await techDocsService.search(query, {
      entityRef,
      tags,
      owner
    });

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
      query
    });
  } catch (error) {
    console.error('TechDocs search failed:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}