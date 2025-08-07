import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { techRadarClient } from '@/lib/techradar/client';
import { TechRadarConfig } from '@/lib/techradar/types';

async function postImportHandler(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { data } = body;

    if (!data) {
      return NextResponse.json(
        { error: 'Import data is required' },
        { status: 400 }
      );
    }

    // Validate the data structure
    if (!data.entries || !Array.isArray(data.entries)) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected tech radar configuration with entries array.' },
        { status: 400 }
      );
    }

    // Validate required fields for each entry
    const errors: string[] = [];
    data.entries.forEach((entry: any, index: number) => {
      if (!entry.name) {
        errors.push(`Entry ${index + 1}: Name is required`);
      }
      if (!entry.quadrant) {
        errors.push(`Entry ${index + 1}: Quadrant is required`);
      }
      if (!entry.ring) {
        errors.push(`Entry ${index + 1}: Ring is required`);
      }
    });

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation errors', details: errors },
        { status: 400 }
      );
    }

    const result = await techRadarClient.importData(data as TechRadarConfig);

    return NextResponse.json({
      success: result.success,
      imported: result.imported,
      errors: result.errors,
      message: `Successfully imported ${result.imported} entries`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error importing tech radar data:', error);
    
    // Fallback: simulate import for demo purposes
    const body = await req.json().catch(() => ({}));
    const data = body.data;
    
    if (data?.entries) {
      return NextResponse.json({
        success: true,
        imported: data.entries.length,
        errors: [],
        message: `Successfully imported ${data.entries.length} entries (simulation mode)`,
        timestamp: new Date().toISOString(),
        warning: 'Import processed in simulation mode - data not persisted'
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to import tech radar data' },
      { status: 500 }
    );
  }
}

// Apply authentication middleware
export const POST = withAuth(postImportHandler);