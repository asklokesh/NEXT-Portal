/**
 * Page Builder API - Import
 * Import page configurations from exported files
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

interface ImportOptions {
  overwrite?: boolean;
  generateNewIds?: boolean;
  targetPath?: string;
}

interface ImportResult {
  success: boolean;
  imported: {
    pages: number;
    templates: number;
  };
  errors: Array<{
    type: string;
    name: string;
    error: string;
  }>;
  warnings: string[];
}

/**
 * POST /api/builder/import
 * Import pages from an exported file
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const optionsStr = formData.get('options') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const options: ImportOptions = optionsStr ? JSON.parse(optionsStr) : {};

    // Read and parse the file
    const content = await file.text();
    let importData;

    try {
      importData = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON file' },
        { status: 400 }
      );
    }

    // Validate import format
    if (!importData.version || !importData.pages) {
      return NextResponse.json(
        { error: 'Invalid import format. Missing required fields.' },
        { status: 400 }
      );
    }

    const result: ImportResult = {
      success: true,
      imported: {
        pages: 0,
        templates: 0,
      },
      errors: [],
      warnings: [],
    };

    // Process pages
    if (Array.isArray(importData.pages)) {
      for (const page of importData.pages) {
        try {
          // In production, this would:
          // 1. Validate the page structure
          // 2. Check for conflicts
          // 3. Generate new IDs if requested
          // 4. Save to database

          if (options.generateNewIds) {
            page.id = uuidv4();
          }

          result.imported.pages++;
        } catch (error) {
          result.errors.push({
            type: 'page',
            name: page.name || 'Unknown',
            error: String(error),
          });
        }
      }
    }

    // Process templates
    if (Array.isArray(importData.templates)) {
      for (const template of importData.templates) {
        try {
          if (options.generateNewIds) {
            template.id = uuidv4();
          }

          result.imported.templates++;
        } catch (error) {
          result.errors.push({
            type: 'template',
            name: template.name || 'Unknown',
            error: String(error),
          });
        }
      }
    }

    // Add warnings if there were version mismatches
    if (importData.version !== '1.0.0') {
      result.warnings.push(
        `Import file version ${importData.version} may not be fully compatible`
      );
    }

    result.success = result.errors.length === 0;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to import pages:', error);
    return NextResponse.json(
      { error: 'Failed to import pages' },
      { status: 500 }
    );
  }
}
