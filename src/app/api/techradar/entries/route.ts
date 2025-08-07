import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { techRadarClient } from '@/lib/techradar/client';
import { TechRadarEntry, TechRadarFilters } from '@/lib/techradar/types';

async function getEntriesHandler(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    
    // Parse filters from query parameters
    const filters: TechRadarFilters = {};
    
    if (searchParams.get('quadrant')) {
      filters.quadrant = searchParams.get('quadrant')!;
    }
    
    if (searchParams.get('ring')) {
      filters.ring = searchParams.get('ring')!;
    }
    
    if (searchParams.get('isNew')) {
      filters.isNew = searchParams.get('isNew') === 'true';
    }
    
    if (searchParams.get('moved')) {
      const moved = searchParams.get('moved');
      if (moved === '1' || moved === '-1' || moved === '0') {
        filters.moved = parseInt(moved) as 0 | 1 | -1;
      }
    }
    
    if (searchParams.get('search')) {
      filters.search = searchParams.get('search')!;
    }
    
    if (searchParams.get('maturity')) {
      filters.maturity = searchParams.get('maturity')!;
    }
    
    if (searchParams.get('tags')) {
      filters.tags = searchParams.get('tags')!.split(',');
    }

    const entries = await techRadarClient.getEntries(filters);

    return NextResponse.json({
      entries,
      count: entries.length,
      filters,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching tech radar entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tech radar entries' },
      { status: 500 }
    );
  }
}

async function postEntriesHandler(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { filters } = body;

    const entries = await techRadarClient.getEntries(filters);

    return NextResponse.json({
      entries,
      count: entries.length,
      filters,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching tech radar entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tech radar entries' },
      { status: 500 }
    );
  }
}

async function putEntriesHandler(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { entry } = body;

    if (!entry || !entry.name || !entry.quadrant || !entry.ring) {
      return NextResponse.json(
        { error: 'Entry name, quadrant, and ring are required' },
        { status: 400 }
      );
    }

    // Add timestamp if creating new entry
    if (!entry.id) {
      entry.lastUpdated = new Date().toISOString();
    }

    const savedEntry = await techRadarClient.saveEntry(entry);

    return NextResponse.json({
      entry: savedEntry,
      message: entry.id ? 'Entry updated successfully' : 'Entry created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving tech radar entry:', error);
    return NextResponse.json(
      { error: 'Failed to save tech radar entry' },
      { status: 500 }
    );
  }
}

// Apply authentication middleware
export const GET = withAuth(getEntriesHandler);
export const POST = withAuth(postEntriesHandler);
export const PUT = withAuth(putEntriesHandler);