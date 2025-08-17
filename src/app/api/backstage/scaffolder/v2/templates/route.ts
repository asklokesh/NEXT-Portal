/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

const BACKSTAGE_API_URL = process.env.BACKSTAGE_API_URL || process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:7007';
const BACKSTAGE_API_TOKEN = process.env.BACKSTAGE_API_TOKEN;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Build Backstage API URL
    const backstageUrl = new URL('/api/scaffolder/v2/templates', BACKSTAGE_API_URL);
    
    // Forward query parameters
    searchParams.forEach((value, key) => {
      backstageUrl.searchParams.append(key, value);
    });

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (BACKSTAGE_API_TOKEN) {
      headers['Authorization'] = `Bearer ${BACKSTAGE_API_TOKEN}`;
    }

    let response;
    try {
      response = await fetch(backstageUrl.toString(), {
        method: 'GET',
        headers,
        // Add timeout
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
    } catch (fetchError) {
      console.error('Backstage API connection failed:', fetchError instanceof Error ? fetchError.message : 'Unknown error');
      // Production mode: return error when Backstage is not available
      return NextResponse.json({
        error: 'Scaffolder templates unavailable',
        message: 'Backstage service is not accessible. Please ensure Backstage is running and properly configured.',
        details: fetchError instanceof Error ? fetchError.message : 'Unknown connection error',
        suggestions: [
          'Verify BACKSTAGE_API_URL environment variable',
          'Check if Backstage is running on the configured port',
          'Ensure network connectivity to Backstage instance'
        ]
      }, { status: 503 });
    }

    if (!response.ok) {
      console.error('Backstage API error:', response.status, response.statusText);
      
      // Production mode: return proper error for any API issues
      console.error('Backstage API returned error status:', response.status, response.statusText);
      return NextResponse.json({
        error: 'Scaffolder templates unavailable',
        message: 'Backstage scaffolder service returned an error',
        status: response.status,
        statusText: response.statusText,
        suggestions: [
          'Check Backstage service health',
          'Verify API authentication if required',
          'Review Backstage logs for errors'
        ]
      }, { status: response.status });
    }

    const data = await response.json() as unknown;
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying to Backstage:', error);
    
    // Production mode: return proper error response
    return NextResponse.json({
      error: 'Scaffolder service error',
      message: 'Failed to retrieve templates from Backstage scaffolder service',
      details: error instanceof Error ? error.message : 'Unknown error occurred',
      suggestions: [
        'Check system logs for detailed error information',
        'Verify Backstage configuration and connectivity',
        'Contact system administrator if issue persists'
      ]
    }, { status: 500 });
  }
}