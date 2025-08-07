import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { techRadarClient } from '@/lib/techradar/client';

async function getExportHandler(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'json';

    if (!['json', 'csv'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Supported formats: json, csv' },
        { status: 400 }
      );
    }

    const blob = await techRadarClient.exportData(format as 'json' | 'csv');
    
    const headers = new Headers();
    headers.set('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
    headers.set('Content-Disposition', `attachment; filename="techradar.${format}"`);

    return new NextResponse(blob, { headers });
  } catch (error) {
    console.error('Error exporting tech radar data:', error);
    
    // Fallback: generate export from available data
    try {
      const config = await techRadarClient.getRadarConfig();
      const { searchParams } = new URL(req.url);
      const format = searchParams.get('format') || 'json';
      
      if (format === 'json') {
        const jsonData = JSON.stringify(config, null, 2);
        return new NextResponse(jsonData, {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="techradar.json"'
          }
        });
      } else if (format === 'csv') {
        // Generate CSV from entries
        const csvHeader = 'Name,Quadrant,Ring,Description,Tags,Maturity,IsNew,Moved,Owner,LastUpdated,URL\n';
        const csvRows = config.entries.map(entry => [
          entry.name,
          entry.quadrant.name,
          entry.ring.name,
          entry.description || '',
          entry.tags?.join(';') || '',
          entry.maturity || '',
          entry.isNew ? 'Yes' : 'No',
          entry.moved === 1 ? 'Up' : entry.moved === -1 ? 'Down' : 'No Change',
          entry.owner || '',
          entry.lastUpdated || '',
          entry.url || ''
        ].map(field => `"${field.toString().replace(/"/g, '""')}"`).join(','));
        
        const csvData = csvHeader + csvRows.join('\n');
        
        return new NextResponse(csvData, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="techradar.csv"'
          }
        });
      }
    } catch (fallbackError) {
      console.error('Fallback export failed:', fallbackError);
    }
    
    return NextResponse.json(
      { error: 'Failed to export tech radar data' },
      { status: 500 }
    );
  }
}

// Apply authentication middleware
export const GET = withAuth(getExportHandler);