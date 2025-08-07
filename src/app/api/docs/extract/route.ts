import { NextRequest, NextResponse } from 'next/server';
import { DocumentationExtractor } from '@/lib/docs/DocumentationExtractor';
import { MarkdownProcessor } from '@/lib/docs/MarkdownProcessor';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';

const extractRequestSchema = z.object({
  paths: z.array(z.string()).optional(),
  files: z.array(z.string()).optional(),
  options: z.object({
    includePrivate: z.boolean().optional(),
    includeInternal: z.boolean().optional(),
    extractExamples: z.boolean().optional(),
    followImports: z.boolean().optional(),
    maxDepth: z.number().optional(),
  }).optional(),
  format: z.enum(['json', 'markdown', 'html']).default('json'),
  includeMarkdown: z.boolean().default(false),
});

type ExtractRequest = z.infer<typeof extractRequestSchema>;

/**
 * @api {post} /api/docs/extract Extract Documentation
 * @apiName ExtractDocumentation
 * @apiGroup Documentation
 * @apiVersion 1.0.0
 * 
 * @apiDescription Extract documentation from source code files or directories.
 * Supports TypeScript, JavaScript, Python, Java, and Rust files.
 * 
 * @apiBody {String[]} [paths] Array of directory paths to scan for source files
 * @apiBody {String[]} [files] Array of specific file paths to extract from
 * @apiBody {Object} [options] Extraction options
 * @apiBody {Boolean} [options.includePrivate=false] Include private members in extraction
 * @apiBody {Boolean} [options.includeInternal=false] Include internal documentation
 * @apiBody {Boolean} [options.extractExamples=true] Extract code examples from documentation
 * @apiBody {Boolean} [options.followImports=false] Follow import statements
 * @apiBody {Number} [options.maxDepth=3] Maximum depth for following imports
 * @apiBody {String} [format=json] Output format: 'json', 'markdown', or 'html'
 * @apiBody {Boolean} [includeMarkdown=false] Also process any markdown files found
 * 
 * @apiSuccess {Object} documentation Extracted documentation
 * @apiSuccess {Object[]} documentation.functions Array of function documentation
 * @apiSuccess {Object[]} documentation.classes Array of class documentation
 * @apiSuccess {Object[]} documentation.interfaces Array of interface documentation
 * @apiSuccess {Object[]} documentation.types Array of type documentation
 * @apiSuccess {Object[]} documentation.constants Array of constant documentation
 * @apiSuccess {Object[]} documentation.apiEndpoints Array of API endpoint documentation
 * @apiSuccess {Object} documentation.metadata File metadata
 * 
 * @apiError {String} error Error message
 * @apiError {Number} status HTTP status code
 * 
 * @apiExample {json} Request Example:
 * {
 *   "paths": ["./src/lib", "./src/components"],
 *   "options": {
 *     "includePrivate": false,
 *     "extractExamples": true
 *   },
 *   "format": "json",
 *   "includeMarkdown": true
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = extractRequestSchema.parse(body);

    if (!data.paths && !data.files) {
      return NextResponse.json(
        { error: 'Either paths or files must be provided' },
        { status: 400 }
      );
    }

    const extractor = new DocumentationExtractor(data.options);
    const markdownProcessor = new MarkdownProcessor();

    const results = new Map<string, any>();
    const markdownResults = new Map<string, any>();

    // Extract from paths or files
    const filesToProcess = data.files || [];
    
    if (data.paths) {
      for (const inputPath of data.paths) {
        try {
          // Resolve relative paths
          const resolvedPath = path.resolve(process.cwd(), inputPath);
          
          // Check if path exists
          await fs.access(resolvedPath);
          
          const pathResults = await extractor.extractFromPaths([resolvedPath]);
          
          // Merge results
          for (const [filePath, documentation] of pathResults) {
            results.set(filePath, documentation);
          }

          // Also find and process markdown files if requested
          if (data.includeMarkdown) {
            const markdownFiles = await findMarkdownFiles(resolvedPath);
            for (const markdownFile of markdownFiles) {
              try {
                const processed = await markdownProcessor.processMarkdownFile(markdownFile);
                markdownResults.set(markdownFile, processed);
              } catch (error) {
                console.warn(`Failed to process markdown file ${markdownFile}:`, error);
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to process path ${inputPath}:`, error);
        }
      }
    }

    if (data.files) {
      for (const filePath of data.files) {
        try {
          const resolvedPath = path.resolve(process.cwd(), filePath);
          await fs.access(resolvedPath);
          
          if (filePath.endsWith('.md') && data.includeMarkdown) {
            const processed = await markdownProcessor.processMarkdownFile(resolvedPath);
            markdownResults.set(resolvedPath, processed);
          } else {
            const documentation = await extractor.extractFromFile(resolvedPath);
            results.set(resolvedPath, documentation);
          }
        } catch (error) {
          console.warn(`Failed to process file ${filePath}:`, error);
        }
      }
    }

    // Format the results
    const documentation = {
      code: Object.fromEntries(results),
      markdown: Object.fromEntries(markdownResults),
      extractedAt: new Date().toISOString(),
      totalFiles: results.size + markdownResults.size,
      cacheStats: extractor.getCacheStats(),
    };

    // Return in requested format
    switch (data.format) {
      case 'markdown':
        const markdownContent = await convertToMarkdown(documentation);
        return new NextResponse(markdownContent, {
          headers: {
            'Content-Type': 'text/markdown',
            'Content-Disposition': 'attachment; filename="documentation.md"',
          },
        });

      case 'html':
        const htmlContent = await convertToHtml(documentation, markdownProcessor);
        return new NextResponse(htmlContent, {
          headers: {
            'Content-Type': 'text/html',
            'Content-Disposition': 'attachment; filename="documentation.html"',
          },
        });

      default:
        return NextResponse.json(documentation);
    }
  } catch (error) {
    console.error('Documentation extraction failed:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to extract documentation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * @api {get} /api/docs/extract Get Extraction Status
 * @apiName GetExtractionStatus
 * @apiGroup Documentation
 * @apiVersion 1.0.0
 * 
 * @apiDescription Get the current status of documentation extraction cache.
 * 
 * @apiSuccess {Object} status Cache status information
 * @apiSuccess {Number} status.cacheSize Number of cached items
 * @apiSuccess {Number} status.maxAge Maximum cache age in milliseconds
 * @apiSuccess {String[]} status.supportedLanguages List of supported programming languages
 * @apiSuccess {String[]} status.supportedFormats List of supported output formats
 */
export async function GET() {
  try {
    const extractor = new DocumentationExtractor();
    const markdownProcessor = new MarkdownProcessor();

    return NextResponse.json({
      status: 'ready',
      cache: extractor.getCacheStats(),
      markdownCache: markdownProcessor.getCacheStats(),
      supportedLanguages: ['typescript', 'javascript', 'python', 'java', 'rust'],
      supportedFormats: ['json', 'markdown', 'html'],
      version: '1.0.0',
    });
  } catch (error) {
    console.error('Failed to get extraction status:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}

// Helper functions
async function findMarkdownFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  
  async function scanDirectory(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !shouldSkipDirectory(entry.name)) {
          await scanDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  await scanDirectory(directory);
  return files;
}

function shouldSkipDirectory(name: string): boolean {
  const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
  return skipDirs.includes(name) || name.startsWith('.');
}

async function convertToMarkdown(documentation: any): Promise<string> {
  let markdown = `# Documentation\n\n`;
  markdown += `Generated on ${new Date().toISOString()}\n\n`;
  markdown += `Total files processed: ${documentation.totalFiles}\n\n`;

  // Add code documentation
  if (Object.keys(documentation.code).length > 0) {
    markdown += `## Code Documentation\n\n`;
    
    for (const [filePath, doc] of Object.entries(documentation.code)) {
      const fileDoc = doc as any;
      markdown += `### ${path.basename(filePath)}\n\n`;
      markdown += `**File:** \`${filePath}\`\n\n`;
      
      if (fileDoc.functions?.length > 0) {
        markdown += `#### Functions\n\n`;
        for (const func of fileDoc.functions) {
          markdown += `##### ${func.name}\n\n`;
          markdown += `\`\`\`${fileDoc.metadata.language}\n${func.signature}\n\`\`\`\n\n`;
          if (func.documentation.description) {
            markdown += `${func.documentation.description}\n\n`;
          }
          if (func.documentation.params?.length > 0) {
            markdown += `**Parameters:**\n\n`;
            for (const param of func.documentation.params) {
              markdown += `- \`${param.name}\`${param.type ? ` (${param.type})` : ''}`;
              if (param.description) {
                markdown += `: ${param.description}`;
              }
              markdown += `\n`;
            }
            markdown += `\n`;
          }
        }
      }

      if (fileDoc.classes?.length > 0) {
        markdown += `#### Classes\n\n`;
        for (const cls of fileDoc.classes) {
          markdown += `##### ${cls.name}\n\n`;
          if (cls.documentation.description) {
            markdown += `${cls.documentation.description}\n\n`;
          }
          if (cls.methods?.length > 0) {
            markdown += `**Methods:**\n\n`;
            for (const method of cls.methods) {
              markdown += `- \`${method.signature}\``;
              if (method.documentation.description) {
                markdown += `: ${method.documentation.description}`;
              }
              markdown += `\n`;
            }
            markdown += `\n`;
          }
        }
      }
    }
  }

  // Add markdown documentation
  if (Object.keys(documentation.markdown).length > 0) {
    markdown += `## Markdown Documentation\n\n`;
    for (const [filePath, doc] of Object.entries(documentation.markdown)) {
      const markdownDoc = doc as any;
      markdown += `### ${path.basename(filePath)}\n\n`;
      markdown += `**File:** \`${filePath}\`\n\n`;
      if (markdownDoc.wordCount) {
        markdown += `**Word count:** ${markdownDoc.wordCount} words (${markdownDoc.readingTime} min read)\n\n`;
      }
      if (markdownDoc.toc?.length > 0) {
        markdown += `**Table of Contents:**\n\n`;
        for (const item of markdownDoc.toc) {
          markdown += `${'  '.repeat(item.level - 1)}- [${item.title}](#${item.anchor})\n`;
        }
        markdown += `\n`;
      }
    }
  }

  return markdown;
}

async function convertToHtml(documentation: any, markdownProcessor: MarkdownProcessor): Promise<string> {
  const markdownContent = await convertToMarkdown(documentation);
  const processed = await markdownProcessor.processMarkdown(markdownContent);
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Documentation</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.6;
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          color: #333;
        }
        
        h1, h2, h3, h4, h5, h6 {
          color: #2c3e50;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }
        
        h1 { border-bottom: 2px solid #3498db; padding-bottom: 0.5rem; }
        h2 { border-bottom: 1px solid #bdc3c7; padding-bottom: 0.3rem; }
        
        code {
          background: #f8f9fa;
          padding: 0.2rem 0.4rem;
          border-radius: 0.25rem;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 0.875rem;
        }
        
        pre {
          background: #2d3748;
          color: #e2e8f0;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        
        pre code {
          background: none;
          padding: 0;
          color: inherit;
        }
        
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
        }
        
        th, td {
          border: 1px solid #bdc3c7;
          padding: 0.75rem;
          text-align: left;
        }
        
        th {
          background: #ecf0f1;
          font-weight: 600;
        }
        
        .toc {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 0.5rem;
          margin: 2rem 0;
        }
        
        .toc ul {
          list-style: none;
          padding-left: 1rem;
        }
        
        .toc a {
          color: #3498db;
          text-decoration: none;
        }
        
        .toc a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      ${processed.html}
    </body>
    </html>
  `;
}