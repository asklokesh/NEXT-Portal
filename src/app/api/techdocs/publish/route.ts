import { NextRequest, NextResponse } from 'next/server';
import TechDocsService from '@/lib/techdocs/TechDocsService';

const techDocsService = new TechDocsService({
  storageProvider: process.env.TECHDOCS_STORAGE_PROVIDER as any || 'local',
  storageConfig: {
    basePath: process.env.TECHDOCS_STORAGE_PATH || './techdocs-storage',
    bucket: process.env.TECHDOCS_S3_BUCKET,
    region: process.env.TECHDOCS_S3_REGION,
    projectId: process.env.TECHDOCS_GCS_PROJECT,
    containerName: process.env.TECHDOCS_AZURE_CONTAINER
  },
  cacheDuration: 5 * 60 * 1000,
  supportedFormats: ['.md', '.mdx', '.adoc'],
  enableVersioning: true,
  enableSearch: true,
  enableLiveReload: false
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entity, sourcePath, version, message } = body;

    if (!entity || !sourcePath) {
      return NextResponse.json(
        { error: 'Entity and sourcePath are required' },
        { status: 400 }
      );
    }

    await techDocsService.publish(entity, sourcePath, version, message);

    return NextResponse.json({
      success: true,
      message: 'Documentation published successfully',
      entityRef: `${entity.kind}:${entity.namespace}/${entity.name}`,
      version: version || 'latest'
    });
  } catch (error) {
    console.error('Failed to publish TechDocs:', error);
    return NextResponse.json(
      { error: 'Failed to publish documentation' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityRef = searchParams.get('entityRef');

    if (!entityRef) {
      return NextResponse.json(
        { error: 'entityRef is required' },
        { status: 400 }
      );
    }

    await techDocsService.deleteDocs(entityRef);

    return NextResponse.json({
      success: true,
      message: 'Documentation deleted successfully',
      entityRef
    });
  } catch (error) {
    console.error('Failed to delete TechDocs:', error);
    return NextResponse.json(
      { error: 'Failed to delete documentation' },
      { status: 500 }
    );
  }
}