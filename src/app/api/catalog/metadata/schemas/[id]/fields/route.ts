import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { metadataSchemaManager, FieldDefinition, FieldType } from '@/lib/metadata/MetadataSchemaManager';

// Request validation schemas
const addFieldSchema = z.object({
  name: z.string().min(1, 'Field name is required'),
  label: z.string().min(1, 'Field label is required'),
  type: z.enum(['text', 'number', 'boolean', 'select', 'multi-select', 'date', 'json', 'url', 'email']),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional().default(false),
  defaultValue: z.any().optional(),
  validation: z.array(z.any()).optional(),
  options: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional(),
  conditional: z.any().optional(),
  backstageMapping: z.object({
    path: z.string(),
    transform: z.string().optional(),
  }).optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional().default({ x: 0, y: 0, width: 12, height: 1 }),
});

const updateFieldSchema = addFieldSchema.partial().omit({ name: true });

// POST /api/catalog/metadata/schemas/[id]/fields - Add field to schema
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const schemaId = params.id;
    const body = await request.json();
    
    // Validate request body
    const validatedData = addFieldSchema.parse(body);
    
    // Add field to schema
    const updatedSchema = await metadataSchemaManager.addField(schemaId, validatedData);

    return NextResponse.json({
      success: true,
      data: updatedSchema,
      message: 'Field added successfully',
    });
  } catch (error) {
    console.error('Error adding field:', error);
    
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
        error: 'Failed to add field',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PUT /api/catalog/metadata/schemas/[id]/fields?fieldId={fieldId} - Update field
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const schemaId = params.id;
    const { searchParams } = new URL(request.url);
    const fieldId = searchParams.get('fieldId');

    if (!fieldId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Field ID is required',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validatedData = updateFieldSchema.parse(body);
    
    // Update field in schema
    const updatedSchema = await metadataSchemaManager.updateField(schemaId, fieldId, validatedData);

    return NextResponse.json({
      success: true,
      data: updatedSchema,
      message: 'Field updated successfully',
    });
  } catch (error) {
    console.error('Error updating field:', error);
    
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
        error: 'Failed to update field',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/catalog/metadata/schemas/[id]/fields?fieldId={fieldId} - Remove field
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const schemaId = params.id;
    const { searchParams } = new URL(request.url);
    const fieldId = searchParams.get('fieldId');

    if (!fieldId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Field ID is required',
        },
        { status: 400 }
      );
    }

    // Remove field from schema
    const updatedSchema = await metadataSchemaManager.removeField(schemaId, fieldId);

    return NextResponse.json({
      success: true,
      data: updatedSchema,
      message: 'Field removed successfully',
    });
  } catch (error) {
    console.error('Error removing field:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove field',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}