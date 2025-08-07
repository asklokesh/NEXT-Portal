import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { metadataSchemaManager } from '@/lib/metadata/MetadataSchemaManager';

// Request validation schemas
const updateMetadataSchema = z.object({
  entityId: z.string().min(1, 'Entity ID is required'),
  schemaId: z.string().min(1, 'Schema ID is required'),
  data: z.record(z.any()),
  generateBackstageYaml: z.boolean().optional().default(false),
});

const bulkUpdateMetadataSchema = z.object({
  schemaId: z.string().min(1, 'Schema ID is required'),
  updates: z.array(z.object({
    entityId: z.string().min(1, 'Entity ID is required'),
    data: z.record(z.any()),
  })),
  generateBackstageYaml: z.boolean().optional().default(false),
});

const validateMetadataSchema = z.object({
  schemaId: z.string().min(1, 'Schema ID is required'),
  data: z.record(z.any()),
});

const migrateMetadataSchema = z.object({
  schemaId: z.string().min(1, 'Schema ID is required'),
  fromVersion: z.string().min(1, 'From version is required'),
  toVersion: z.string().min(1, 'To version is required'),
  data: z.record(z.any()),
});

// POST /api/catalog/metadata/update - Update entity metadata
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Check if this is a bulk update
    if ('updates' in body) {
      return handleBulkUpdate(body);
    }
    
    // Validate request body for single update
    const validatedData = updateMetadataSchema.parse(body);
    
    // Get schema
    const schema = metadataSchemaManager.getSchema(validatedData.schemaId);
    if (!schema) {
      return NextResponse.json(
        {
          success: false,
          error: 'Schema not found',
        },
        { status: 404 }
      );
    }

    // Validate metadata against schema
    const validation = metadataSchemaManager.validateData(validatedData.schemaId, validatedData.data);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          validation: validation.errors,
        },
        { status: 400 }
      );
    }

    // Generate Backstage YAML if requested
    let backstageYaml;
    if (validatedData.generateBackstageYaml) {
      try {
        backstageYaml = metadataSchemaManager.generateBackstageYaml(validatedData.schemaId, validatedData.data);
      } catch (error) {
        console.error('Failed to generate Backstage YAML:', error);
      }
    }

    // In production, you would save the metadata to a database here
    // For now, we'll just return success with the processed data
    const result = {
      entityId: validatedData.entityId,
      schemaId: validatedData.schemaId,
      schemaVersion: schema.version,
      data: validatedData.data,
      validation,
      ...(backstageYaml && { backstageYaml }),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Metadata updated successfully',
    });
  } catch (error) {
    console.error('Error updating metadata:', error);
    
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
        error: 'Failed to update metadata',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle bulk metadata updates
async function handleBulkUpdate(body: any) {
  try {
    // Validate bulk update request
    const validatedData = bulkUpdateMetadataSchema.parse(body);
    
    // Get schema
    const schema = metadataSchemaManager.getSchema(validatedData.schemaId);
    if (!schema) {
      return NextResponse.json(
        {
          success: false,
          error: 'Schema not found',
        },
        { status: 404 }
      );
    }

    const results = [];
    const errors = [];

    // Process each update
    for (const update of validatedData.updates) {
      try {
        // Validate metadata against schema
        const validation = metadataSchemaManager.validateData(validatedData.schemaId, update.data);
        
        let backstageYaml;
        if (validatedData.generateBackstageYaml) {
          try {
            backstageYaml = metadataSchemaManager.generateBackstageYaml(validatedData.schemaId, update.data);
          } catch (error) {
            console.error(`Failed to generate Backstage YAML for entity ${update.entityId}:`, error);
          }
        }

        const result = {
          entityId: update.entityId,
          schemaId: validatedData.schemaId,
          schemaVersion: schema.version,
          data: update.data,
          validation,
          ...(backstageYaml && { backstageYaml }),
          updatedAt: new Date().toISOString(),
        };

        if (validation.valid) {
          results.push(result);
        } else {
          errors.push({
            entityId: update.entityId,
            error: 'Validation failed',
            validation: validation.errors,
          });
        }
      } catch (error) {
        errors.push({
          entityId: update.entityId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed: results.length,
        failed: errors.length,
        results,
        errors,
      },
      message: `Bulk update completed. ${results.length} successful, ${errors.length} failed.`,
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    
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
        error: 'Failed to process bulk update',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PUT /api/catalog/metadata/update - Validate metadata without saving
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = validateMetadataSchema.parse(body);
    
    // Get schema
    const schema = metadataSchemaManager.getSchema(validatedData.schemaId);
    if (!schema) {
      return NextResponse.json(
        {
          success: false,
          error: 'Schema not found',
        },
        { status: 404 }
      );
    }

    // Validate metadata against schema
    const validation = metadataSchemaManager.validateData(validatedData.schemaId, validatedData.data);
    
    // Generate Backstage YAML preview
    let backstageYaml;
    try {
      backstageYaml = metadataSchemaManager.generateBackstageYaml(validatedData.schemaId, validatedData.data);
    } catch (error) {
      console.error('Failed to generate Backstage YAML:', error);
    }

    return NextResponse.json({
      success: true,
      data: {
        schemaId: validatedData.schemaId,
        schemaVersion: schema.version,
        validation,
        ...(backstageYaml && { backstageYaml }),
      },
      message: 'Metadata validation completed',
    });
  } catch (error) {
    console.error('Error validating metadata:', error);
    
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
        error: 'Failed to validate metadata',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PATCH /api/catalog/metadata/update - Migrate metadata between schema versions
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = migrateMetadataSchema.parse(body);
    
    // Get schema
    const schema = metadataSchemaManager.getSchema(validatedData.schemaId);
    if (!schema) {
      return NextResponse.json(
        {
          success: false,
          error: 'Schema not found',
        },
        { status: 404 }
      );
    }

    // Migrate data
    const migratedData = await metadataSchemaManager.migrateData(
      validatedData.schemaId,
      validatedData.fromVersion,
      validatedData.toVersion,
      validatedData.data
    );

    // Validate migrated data
    const validation = metadataSchemaManager.validateData(validatedData.schemaId, migratedData);
    
    return NextResponse.json({
      success: true,
      data: {
        schemaId: validatedData.schemaId,
        fromVersion: validatedData.fromVersion,
        toVersion: validatedData.toVersion,
        originalData: validatedData.data,
        migratedData,
        validation,
      },
      message: 'Metadata migration completed',
    });
  } catch (error) {
    console.error('Error migrating metadata:', error);
    
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
        error: 'Failed to migrate metadata',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}