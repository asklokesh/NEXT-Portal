import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { metadataSchemaManager, MetadataSchema } from '@/lib/metadata/MetadataSchemaManager';

// Request validation schemas
const createSchemaSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  entityKind: z.string().optional(),
  version: z.string().min(1, 'Version is required'),
  fields: z.array(z.any()).default([]),
  layout: z.any().optional(),
});

const updateSchemaSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional(),
  entityKind: z.string().optional(),
  version: z.string().min(1, 'Version is required').optional(),
  fields: z.array(z.any()).optional(),
  layout: z.any().optional(),
  active: z.boolean().optional(),
});

// GET /api/catalog/metadata/schemas - List all schemas
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityKind = searchParams.get('entityKind');
    const active = searchParams.get('active') !== 'false';

    let schemas: MetadataSchema[];

    if (entityKind) {
      schemas = metadataSchemaManager.getSchemasByEntityKind(entityKind);
    } else {
      schemas = metadataSchemaManager.getAllSchemas();
    }

    // Filter by active status if needed
    if (!active) {
      schemas = schemas.filter(schema => !schema.active);
    }

    return NextResponse.json({
      success: true,
      data: schemas,
      count: schemas.length,
    });
  } catch (error) {
    console.error('Error fetching schemas:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch schemas',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/catalog/metadata/schemas - Create new schema
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = createSchemaSchema.parse(body);
    
    // Create schema
    const schema = await metadataSchemaManager.createSchema({
      ...validatedData,
      createdBy: 'api-user', // In production, get from auth context
      active: true,
    });

    return NextResponse.json({
      success: true,
      data: schema,
      message: 'Schema created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating schema:', error);
    
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
        error: 'Failed to create schema',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PUT /api/catalog/metadata/schemas?id={schemaId} - Update schema
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schemaId = searchParams.get('id');

    if (!schemaId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Schema ID is required',
        },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validatedData = updateSchemaSchema.parse(body);
    
    // Update schema
    const schema = await metadataSchemaManager.updateSchema(schemaId, validatedData);

    return NextResponse.json({
      success: true,
      data: schema,
      message: 'Schema updated successfully',
    });
  } catch (error) {
    console.error('Error updating schema:', error);
    
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
        error: 'Failed to update schema',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/catalog/metadata/schemas?id={schemaId} - Delete (deactivate) schema
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schemaId = searchParams.get('id');

    if (!schemaId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Schema ID is required',
        },
        { status: 400 }
      );
    }

    const success = await metadataSchemaManager.deleteSchema(schemaId);

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Schema not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Schema deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting schema:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete schema',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}