import { NextRequest, NextResponse } from 'next/server';
import BulkImporter, { ImportOptions, ImportResult } from '@/lib/import/BulkImporter';
import { z } from 'zod';

// Request validation schema
const ImportRequestSchema = z.object({
  options: z.object({
    format: z.enum(['auto', 'yaml', 'json', 'csv', 'excel']).optional(),
    validateOnly: z.boolean().optional(),
    conflictResolution: z.enum(['skip', 'overwrite', 'merge', 'prompt']).optional(),
    batchSize: z.number().min(1).max(1000).optional(),
    dryRun: z.boolean().optional(),
    templateMapping: z.record(z.any()).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const optionsStr = formData.get('options') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/json',
      'text/yaml',
      'application/x-yaml',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    const allowedExtensions = ['.json', '.yaml', '.yml', '.csv', '.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload JSON, YAML, CSV, or Excel files.' },
        { status: 400 }
      );
    }

    // Parse and validate options
    let importOptions: ImportOptions = {
      format: 'auto',
      validateOnly: false,
      conflictResolution: 'prompt',
      batchSize: 100,
      dryRun: false,
    };

    if (optionsStr) {
      try {
        const parsedOptions = JSON.parse(optionsStr);
        const validation = ImportRequestSchema.safeParse({ options: parsedOptions });
        
        if (validation.success) {
          importOptions = { ...importOptions, ...validation.data.options };
        } else {
          return NextResponse.json(
            { error: 'Invalid import options', details: validation.error.issues },
            { status: 400 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid JSON in options parameter' },
          { status: 400 }
        );
      }
    }

    // Create importer instance
    const importer = new BulkImporter(importOptions);
    
    // Convert file to buffer
    const fileBuffer = await file.arrayBuffer();
    
    // Perform import
    const result: ImportResult = await importer.importFromFile(
      fileBuffer,
      file.name,
      importOptions
    );

    // Return result
    return NextResponse.json({
      success: result.success,
      processed: result.processed,
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
      conflicts: result.conflicts,
      preview: importOptions.validateOnly ? result.preview : undefined,
      metadata: {
        filename: file.name,
        fileSize: file.size,
        options: importOptions,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Import API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Import failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        success: false,
        processed: 0,
        imported: 0,
        skipped: 0,
        errors: [{
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'IMPORT_API_ERROR',
          severity: 'error' as const,
        }],
        conflicts: [],
      },
      { status: 500 }
    );
  }
}

// Handle template download requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get('kind');
    const format = searchParams.get('format');
    const samples = parseInt(searchParams.get('samples') || '3', 10);

    if (!kind || !format) {      return NextResponse.json(
        { error: 'Missing required parameters: kind and format' },
        { status: 400 }
      );
    }

    // Validate parameters
    const validKinds = ['Service', 'Component', 'API', 'Resource'];
    const validFormats = ['csv', 'excel', 'yaml', 'json'];

    if (!validKinds.includes(kind)) {
      return NextResponse.json(
        { error: `Invalid kind. Must be one of: ${validKinds.join(', ')}` },
        { status: 400 }
      );
    }

    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    if (samples < 1 || samples > 10) {
      return NextResponse.json(
        { error: 'Samples must be between 1 and 10' },
        { status: 400 }
      );
    }

    // Generate template
    const templateBuffer = await BulkImporter.createImportTemplate(
      kind,
      format as any,
      samples
    );

    // Determine content type and filename
    let contentType: string;
    let fileExtension: string;
    
    switch (format) {
      case 'csv':
        contentType = 'text/csv';
        fileExtension = 'csv';
        break;
      case 'excel':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileExtension = 'xlsx';
        break;
      case 'yaml':
        contentType = 'text/yaml';
        fileExtension = 'yaml';
        break;
      case 'json':
        contentType = 'application/json';
        fileExtension = 'json';
        break;
      default:
        contentType = 'application/octet-stream';
        fileExtension = format;
    }

    const filename = `${kind.toLowerCase()}-template.${fileExtension}`;

    // Return file
    return new NextResponse(templateBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': templateBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('Template download error:', error);
    
    return NextResponse.json(
      { 
        error: 'Template generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle validation-only requests
export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const optionsStr = formData.get('options') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Parse options with validation enabled
    let importOptions: ImportOptions = {
      format: 'auto',
      validateOnly: true,
      conflictResolution: 'prompt',
      batchSize: 100,
      dryRun: true,
    };

    if (optionsStr) {
      try {
        const parsedOptions = JSON.parse(optionsStr);
        const validation = ImportRequestSchema.safeParse({ options: parsedOptions });
        
        if (validation.success) {
          importOptions = { 
            ...importOptions, 
            ...validation.data.options,
            validateOnly: true,
            dryRun: true,
          };
        }
      } catch (error) {
        // Use default options if parsing fails
      }
    }

    const importer = new BulkImporter(importOptions);
    const fileBuffer = await file.arrayBuffer();
    
    const result = await importer.importFromFile(
      fileBuffer,
      file.name,
      importOptions
    );

    return NextResponse.json({
      valid: result.success,
      entities: result.preview || [],
      errors: result.errors,
      statistics: {
        total: result.processed,
        valid: result.preview?.filter(e => e.status === 'valid').length || 0,
        warnings: result.preview?.filter(e => e.status === 'warning').length || 0,
        invalid: result.preview?.filter(e => e.status === 'invalid').length || 0,
      },
      metadata: {
        filename: file.name,
        fileSize: file.size,
        detectedFormat: importOptions.format,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Validation API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Validation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        valid: false,
        entities: [],
        errors: [{
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'VALIDATION_API_ERROR',
          severity: 'error' as const,
        }],
        statistics: {
          total: 0,
          valid: 0,
          warnings: 0,
          invalid: 1,
        },
      },
      { status: 500 }
    );
  }
}