import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { metadataSchemaManager } from '@/lib/metadata/MetadataSchemaManager';

// Request validation schema
const importSchemaSchema = z.object({
  schemaJson: z.string().min(1, 'Schema JSON is required'),
  overwriteExisting: z.boolean().optional().default(false),
});

// POST /api/catalog/metadata/schemas/import - Import schema
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = importSchemaSchema.parse(body);
    
    let schemaData;
    try {
      schemaData = JSON.parse(validatedData.schemaJson);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON format',
          details: 'The provided schema JSON is not valid',
        },
        { status: 400 }
      );
    }

    // Check if schema with same name already exists
    const existingSchema = metadataSchemaManager.getSchemaByName(schemaData.name);
    if (existingSchema && !validatedData.overwriteExisting) {
      return NextResponse.json(
        {
          success: false,
          error: 'Schema already exists',
          details: `A schema with the name "${schemaData.name}" already exists. Use overwriteExisting=true to replace it.`,
          existingSchema: {
            id: existingSchema.id,
            name: existingSchema.name,
            version: existingSchema.version,
          },
        },
        { status: 409 }
      );
    }

    // Import schema
    const importedSchema = await metadataSchemaManager.importSchema(validatedData.schemaJson);

    // If overwriting, deactivate the existing schema
    if (existingSchema && validatedData.overwriteExisting) {
      await metadataSchemaManager.deleteSchema(existingSchema.id);
    }

    return NextResponse.json({
      success: true,
      data: importedSchema,
      message: 'Schema imported successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error importing schema:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to import schema',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}