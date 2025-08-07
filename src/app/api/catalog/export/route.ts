import { NextRequest, NextResponse } from 'next/server';
import BulkExporter, { ExportOptions, ExportFilters } from '@/lib/export/BulkExporter';
import { z } from 'zod';

// Request validation schema
const ExportRequestSchema = z.object({
  options: z.object({
    format: z.enum(['yaml', 'json', 'csv', 'excel', 'zip']),
    template: z.string().optional(),
    includeMetadata: z.boolean().optional(),
    compression: z.boolean().optional(),
    filename: z.string().optional(),
    fields: z.array(z.string()).optional(),
    groupBy: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }),
  filters: z.object({
    kinds: z.array(z.string()).optional(),
    namespaces: z.array(z.string()).optional(),
    labels: z.record(z.string()).optional(),
    annotations: z.record(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    owners: z.array(z.string()).optional(),
    lifecycle: z.array(z.string()).optional(),
    dateRange: z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      field: z.enum(['created', 'updated']).optional(),
    }).optional(),
    customQuery: z.string().optional(),
  }).optional(),
  entityIds: z.array(z.string()).optional(),
});

// Mock entity data for demonstration - in production this would come from Backstage
const mockEntities = [
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'user-service',
      namespace: 'default',
      title: 'User Management Service',
      description: 'RESTful service for user authentication and management',
      tags: ['auth', 'users', 'rest-api'],
      annotations: {
        'backstage.io/source-location': 'https://github.com/company/user-service',
        'backstage.io/language': 'TypeScript',
      },
      labels: {
        system: 'authentication',
        owner: 'platform-team',
      },
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-08-01T15:30:00Z',
    },
    spec: {
      type: 'service',
      lifecycle: 'production',
      owner: 'platform-team',
      system: 'authentication',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: {
      name: 'user-api',
      namespace: 'default',
      title: 'User Management API',
      description: 'RESTful API for user management',
      tags: ['api', 'users', 'openapi'],
      annotations: {
        'backstage.io/definition-at-location': 'https://api.example.com/openapi.json',
      },
      labels: {
        system: 'authentication',
        owner: 'platform-team',
      },
      createdAt: '2024-01-20T12:00:00Z',
      updatedAt: '2024-07-15T09:45:00Z',
    },
    spec: {
      type: 'openapi',
      lifecycle: 'production',
      owner: 'platform-team',
      system: 'authentication',
      definition: '$ref: https://api.example.com/openapi.json',
    },
  },
  {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: {
      name: 'user-database',
      namespace: 'default',
      title: 'User Database',
      description: 'PostgreSQL database for user data',
      tags: ['database', 'postgres', 'storage'],
      annotations: {
        'backstage.io/cloud-provider': 'aws',
        'backstage.io/region': 'us-east-1',
      },
      labels: {
        system: 'authentication',
        owner: 'platform-team',
        environment: 'production',
      },
      createdAt: '2024-01-10T08:00:00Z',
      updatedAt: '2024-06-30T14:20:00Z',
    },
    spec: {
      type: 'database',
      owner: 'platform-team',
      system: 'authentication',
    },
  },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const validation = ExportRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request parameters',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { options, filters, entityIds } = validation.data;

    // Get entities to export
    let entitiesToExport = mockEntities;

    // In production, you would fetch entities from Backstage based on entityIds or filters
    // For now, we'll use the mock data and apply basic filtering

    if (entityIds && entityIds.length > 0) {
      entitiesToExport = mockEntities.filter(entity => 
        entityIds.includes(`${entity.kind}:${entity.metadata.namespace}/${entity.metadata.name}`)
      );
    }

    // Apply basic filters
    if (filters) {
      if (filters.kinds && filters.kinds.length > 0) {
        entitiesToExport = entitiesToExport.filter(entity => 
          filters.kinds!.includes(entity.kind)
        );
      }

      if (filters.namespaces && filters.namespaces.length > 0) {
        entitiesToExport = entitiesToExport.filter(entity => 
          filters.namespaces!.includes(entity.metadata.namespace || 'default')
        );
      }

      if (filters.owners && filters.owners.length > 0) {
        entitiesToExport = entitiesToExport.filter(entity => 
          entity.spec?.owner && filters.owners!.includes(entity.spec.owner)
        );
      }

      if (filters.tags && filters.tags.length > 0) {
        entitiesToExport = entitiesToExport.filter(entity => 
          entity.metadata.tags?.some(tag => filters.tags!.includes(tag))
        );
      }

      if (filters.lifecycle && filters.lifecycle.length > 0) {
        entitiesToExport = entitiesToExport.filter(entity => 
          entity.spec?.lifecycle && filters.lifecycle!.includes(entity.spec.lifecycle)
        );
      }

      // Date range filtering
      if (filters.dateRange) {
        const { from, to, field = 'created' } = filters.dateRange;
        entitiesToExport = entitiesToExport.filter(entity => {
          const dateField = field === 'updated' 
            ? entity.metadata.updatedAt 
            : entity.metadata.createdAt;
          
          if (!dateField) return true;
          
          const date = new Date(dateField);
          if (from && date < new Date(from)) return false;
          if (to && date > new Date(to)) return false;
          
          return true;
        });
      }
    }

    if (entitiesToExport.length === 0) {
      return NextResponse.json(
        { error: 'No entities found matching the specified criteria' },
        { status: 404 }
      );
    }

    // Create exporter and perform export
    const exporter = new BulkExporter();
    const exportResult = await exporter.exportEntities(entitiesToExport, {
      ...options,
      filters,
    });

    // Determine content type and filename
    let contentType: string;
    let fileExtension: string;
    
    switch (options.format) {
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
      case 'zip':
        contentType = 'application/zip';
        fileExtension = 'zip';
        break;
      default:
        contentType = 'application/octet-stream';
        fileExtension = options.format;
    }

    const filename = options.filename || exportResult.filename;

    // Return the exported file
    return new NextResponse(exportResult.fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': exportResult.fileBuffer.byteLength.toString(),
        'X-Export-Metadata': JSON.stringify({
          totalEntities: exportResult.metadata.totalEntities,
          filteredEntities: exportResult.metadata.filteredEntities,
          exportedAt: exportResult.metadata.exportedAt.toISOString(),
          format: exportResult.format,
        }),
      },
    });

  } catch (error) {
    console.error('Export API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Export failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle export preview requests
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const template = searchParams.get('template');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    
    // Parse filters from query parameters
    const filters: ExportFilters = {};
    
    if (searchParams.get('kinds')) {
      filters.kinds = searchParams.get('kinds')!.split(',').map(k => k.trim());
    }
    
    if (searchParams.get('namespaces')) {
      filters.namespaces = searchParams.get('namespaces')!.split(',').map(n => n.trim());
    }
    
    if (searchParams.get('owners')) {
      filters.owners = searchParams.get('owners')!.split(',').map(o => o.trim());
    }
    
    if (searchParams.get('tags')) {
      filters.tags = searchParams.get('tags')!.split(',').map(t => t.trim());
    }

    // Get entities and apply filters (same logic as POST)
    let entitiesToExport = mockEntities;

    if (filters.kinds && filters.kinds.length > 0) {
      entitiesToExport = entitiesToExport.filter(entity => 
        filters.kinds!.includes(entity.kind)
      );
    }

    if (filters.namespaces && filters.namespaces.length > 0) {
      entitiesToExport = entitiesToExport.filter(entity => 
        filters.namespaces!.includes(entity.metadata.namespace || 'default')
      );
    }

    if (filters.owners && filters.owners.length > 0) {
      entitiesToExport = entitiesToExport.filter(entity => 
        entity.spec?.owner && filters.owners!.includes(entity.spec.owner)
      );
    }

    if (filters.tags && filters.tags.length > 0) {
      entitiesToExport = entitiesToExport.filter(entity => 
        entity.metadata.tags?.some(tag => filters.tags!.includes(tag))
      );
    }

    // Create exporter and generate preview
    const exporter = new BulkExporter();
    const previewData = await exporter.previewExport(entitiesToExport, {
      format: format as any,
      template,
      filters,
    }, limit);

    return NextResponse.json({
      preview: previewData,
      statistics: {
        totalEntities: mockEntities.length,
        filteredEntities: entitiesToExport.length,
        previewEntities: previewData.length,
      },
      availableTemplates: exporter.getAvailableTemplates(),
      metadata: {
        format,
        template,
        filters,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Export preview error:', error);
    
    return NextResponse.json(
      { 
        error: 'Export preview failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Handle export template and filter options
export async function OPTIONS(request: NextRequest) {
  try {
    const exporter = new BulkExporter();
    
    // Get unique values for filter options from the mock data
    const kinds = [...new Set(mockEntities.map(e => e.kind))];
    const namespaces = [...new Set(mockEntities.map(e => e.metadata.namespace || 'default'))];
    const owners = [...new Set(mockEntities.map(e => e.spec?.owner).filter(Boolean))];
    const systems = [...new Set(mockEntities.map(e => e.spec?.system).filter(Boolean))];
    const lifecycles = [...new Set(mockEntities.map(e => e.spec?.lifecycle).filter(Boolean))];
    const allTags = mockEntities.flatMap(e => e.metadata.tags || []);
    const tags = [...new Set(allTags)];

    return NextResponse.json({
      formats: ['yaml', 'json', 'csv', 'excel', 'zip'],
      templates: exporter.getAvailableTemplates(),
      filters: {
        kinds,
        namespaces,
        owners,
        systems,
        lifecycles,
        tags,
      },
      sortOptions: {
        fields: ['metadata.name', 'kind', 'metadata.createdAt', 'metadata.updatedAt', 'spec.owner'],
        orders: ['asc', 'desc'],
      },
      limits: {
        maxEntities: 10000,
        maxFileSize: '100MB',
      },
    });

  } catch (error) {
    console.error('Export options error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to get export options',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}