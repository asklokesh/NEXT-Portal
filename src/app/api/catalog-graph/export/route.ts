import { NextRequest, NextResponse } from 'next/server';
import { GraphExportEngine } from '@/lib/catalog-graph/export';
import type { 
  DependencyGraph, 
  GraphExportOptions,
  GraphAnalytics,
} from '@/lib/catalog-graph/types';

const exportEngine = new GraphExportEngine();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { graph, options, analytics } = body;

    if (!graph) {
      return NextResponse.json(
        { error: 'Graph data is required' },
        { status: 400 }
      );
    }

    const dependencyGraph = graph as DependencyGraph;
    const exportOptions = options as GraphExportOptions;
    const graphAnalytics = analytics as GraphAnalytics | undefined;

    // Validate export options
    const availableFormats = exportEngine.getAvailableFormats().map(f => f.format);
    if (!availableFormats.includes(exportOptions.format)) {
      return NextResponse.json(
        { error: `Unsupported format: ${exportOptions.format}. Available formats: ${availableFormats.join(', ')}` },
        { status: 400 }
      );
    }

    // Special handling for image formats that require canvas
    if (exportOptions.format === 'png') {
      return NextResponse.json(
        { 
          error: 'PNG export requires canvas element from client side. Use client-side export for PNG format.',
          suggestion: 'Use SVG format for server-side image export or implement client-side PNG export.',
        },
        { status: 400 }
      );
    }

    // Export the graph
    const result = await exportEngine.exportGraph(
      dependencyGraph,
      exportOptions,
      undefined, // canvas not available server-side
      graphAnalytics
    );

    // For text-based formats, return the data directly
    if (['json', 'csv', 'graphml', 'gexf'].includes(exportOptions.format)) {
      const headers = new Headers();
      headers.set('Content-Type', result.mimeType);
      headers.set('Content-Disposition', `attachment; filename="${result.filename}"`);
      
      if (result.data instanceof Blob) {
        const text = await result.data.text();
        return new Response(text, { headers });
      } else {
        return new Response(result.data as string, { headers });
      }
    }

    // For binary formats (SVG), return as blob
    if (result.data instanceof Blob) {
      const arrayBuffer = await result.data.arrayBuffer();
      const headers = new Headers();
      headers.set('Content-Type', result.mimeType);
      headers.set('Content-Disposition', `attachment; filename="${result.filename}"`);
      
      return new Response(arrayBuffer, { headers });
    }

    // Return metadata about the export
    return NextResponse.json({
      success: true,
      filename: result.filename,
      mimeType: result.mimeType,
      size: result.size,
      format: exportOptions.format,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error exporting graph:', error);
    return NextResponse.json(
      { error: 'Failed to export graph' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestType = searchParams.get('type') || 'formats';

    switch (requestType) {
      case 'formats':
        const availableFormats = exportEngine.getAvailableFormats();
        return NextResponse.json({
          formats: availableFormats,
          timestamp: new Date().toISOString(),
        });

      case 'options':
        const format = searchParams.get('format') as GraphExportOptions['format'];
        if (!format) {
          return NextResponse.json(
            { error: 'Format parameter is required' },
            { status: 400 }
          );
        }

        const formatInfo = exportEngine.getAvailableFormats().find(f => f.format === format);
        if (!formatInfo) {
          return NextResponse.json(
            { error: `Unsupported format: ${format}` },
            { status: 400 }
          );
        }

        // Return format-specific options
        const options = {
          format,
          name: formatInfo.name,
          description: formatInfo.description,
          supportsMetadata: formatInfo.supportsMetadata,
          requiresCanvas: formatInfo.requiresCanvas,
          defaultOptions: this.getDefaultOptionsForFormat(format),
          availableResolutions: [
            { name: 'HD (1920x1080)', width: 1920, height: 1080 },
            { name: '4K (3840x2160)', width: 3840, height: 2160 },
            { name: 'Custom', width: 0, height: 0 },
          ],
          qualityOptions: ['low', 'medium', 'high'],
        };

        return NextResponse.json(options);

      case 'batch-status':
        // In a real implementation, this would check the status of batch export jobs
        return NextResponse.json({
          message: 'Batch export status endpoint not implemented',
          suggestion: 'Use individual export requests for now',
        });

      default:
        return NextResponse.json(
          { error: `Unknown request type: ${requestType}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling export request:', error);
    return NextResponse.json(
      { error: 'Failed to handle export request' },
      { status: 500 }
    );
  }
}

// Helper function to get default options for each format
function getDefaultOptionsForFormat(format: GraphExportOptions['format']) {
  const defaults: Record<GraphExportOptions['format'], Partial<GraphExportOptions>> = {
    png: {
      includeMetadata: true,
      resolution: { width: 1920, height: 1080 },
      quality: 'high',
    },
    svg: {
      includeMetadata: true,
      resolution: { width: 1200, height: 800 },
    },
    json: {
      includeMetadata: true,
    },
    csv: {
      includeMetadata: true,
    },
    graphml: {
      includeMetadata: true,
    },
    gexf: {
      includeMetadata: true,
    },
  };

  return defaults[format] || { includeMetadata: true };
}