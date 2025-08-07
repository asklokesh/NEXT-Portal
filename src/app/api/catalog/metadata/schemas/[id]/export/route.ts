import { NextRequest, NextResponse } from 'next/server';
import { metadataSchemaManager } from '@/lib/metadata/MetadataSchemaManager';

// GET /api/catalog/metadata/schemas/[id]/export - Export schema
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const schemaId = params.id;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    // Get schema
    const schema = metadataSchemaManager.getSchema(schemaId);
    if (!schema) {
      return NextResponse.json(
        {
          success: false,
          error: 'Schema not found',
        },
        { status: 404 }
      );
    }

    // Export schema
    const exportedSchema = metadataSchemaManager.exportSchema(schemaId);

    if (format === 'download') {
      // Return as downloadable file
      const filename = `${schema.name.replace(/\s+/g, '_')}_v${schema.version}_schema.json`;
      
      return new NextResponse(exportedSchema, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Return as API response
    return NextResponse.json({
      success: true,
      data: {
        schema: JSON.parse(exportedSchema),
        exportedAt: new Date().toISOString(),
      },
      message: 'Schema exported successfully',
    });
  } catch (error) {
    console.error('Error exporting schema:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export schema',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}