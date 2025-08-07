import { NextRequest, NextResponse } from 'next/server';
import { APIDocGenerator } from '@/lib/docs/APIDocGenerator';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';

const generateRequestSchema = z.object({
  type: z.enum(['openapi', 'graphql', 'postman']),
  source: z.object({
    routesDirectory: z.string().optional(),
    schemaFile: z.string().optional(),
    openApiSpec: z.any().optional(),
  }),
  options: z.object({
    includeExamples: z.boolean().optional(),
    inferTypes: z.boolean().optional(),
    includeInternal: z.boolean().optional(),
    validateResponses: z.boolean().optional(),
    extractSchemas: z.boolean().optional(),
  }).optional(),
  output: z.object({
    format: z.enum(['json', 'yaml', 'html']).optional(),
    filename: z.string().optional(),
    title: z.string().optional(),
    version: z.string().optional(),
    description: z.string().optional(),
  }).optional(),
});

type GenerateRequest = z.infer<typeof generateRequestSchema>;

/**
 * @api {post} /api/docs/generate Generate API Documentation
 * @apiName GenerateAPIDocumentation
 * @apiGroup Documentation
 * @apiVersion 1.0.0
 * 
 * @apiDescription Generate API documentation in various formats (OpenAPI, GraphQL, Postman).
 * Can extract from Next.js API routes, GraphQL schema files, or existing OpenAPI specifications.
 * 
 * @apiBody {String} type Documentation type: 'openapi', 'graphql', or 'postman'
 * @apiBody {Object} source Source configuration
 * @apiBody {String} [source.routesDirectory] Directory containing Next.js API routes
 * @apiBody {String} [source.schemaFile] Path to GraphQL schema file
 * @apiBody {Object} [source.openApiSpec] Existing OpenAPI specification to enhance
 * @apiBody {Object} [options] Generation options
 * @apiBody {Boolean} [options.includeExamples=true] Include code examples
 * @apiBody {Boolean} [options.inferTypes=true] Infer types from code
 * @apiBody {Boolean} [options.includeInternal=false] Include internal endpoints
 * @apiBody {Boolean} [options.validateResponses=true] Validate response schemas
 * @apiBody {Boolean} [options.extractSchemas=true] Extract TypeScript schemas
 * @apiBody {Object} [output] Output configuration
 * @apiBody {String} [output.format=json] Output format: 'json', 'yaml', or 'html'
 * @apiBody {String} [output.filename] Custom filename for download
 * @apiBody {String} [output.title] Documentation title
 * @apiBody {String} [output.version=1.0.0] API version
 * @apiBody {String} [output.description] API description
 * 
 * @apiSuccess {Object|String} documentation Generated documentation
 * @apiSuccess {String} format Output format used
 * @apiSuccess {Number} endpointsCount Number of endpoints documented
 * @apiSuccess {String} generatedAt Generation timestamp
 * 
 * @apiError {String} error Error message
 * @apiError {Number} status HTTP status code
 * 
 * @apiExample {json} OpenAPI Generation Request:
 * {
 *   "type": "openapi",
 *   "source": {
 *     "routesDirectory": "./src/app/api"
 *   },
 *   "options": {
 *     "includeExamples": true,
 *     "extractSchemas": true
 *   },
 *   "output": {
 *     "format": "json",
 *     "title": "My API",
 *     "version": "1.0.0"
 *   }
 * }
 * 
 * @apiExample {json} GraphQL Generation Request:
 * {
 *   "type": "graphql",
 *   "source": {
 *     "schemaFile": "./schema.graphql"
 *   },
 *   "output": {
 *     "format": "html",
 *     "title": "GraphQL API Documentation"
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = generateRequestSchema.parse(body);

    const generator = new APIDocGenerator(data.options);
    let documentation: any;
    let endpointsCount = 0;

    switch (data.type) {
      case 'openapi':
        if (!data.source.routesDirectory && !data.source.openApiSpec) {
          return NextResponse.json(
            { error: 'Either routesDirectory or openApiSpec must be provided for OpenAPI generation' },
            { status: 400 }
          );
        }

        if (data.source.routesDirectory) {
          const resolvedPath = path.resolve(process.cwd(), data.source.routesDirectory);
          await fs.access(resolvedPath);
          
          documentation = await generator.generateOpenAPIFromRoutes(resolvedPath);
          
          // Override info if provided
          if (data.output?.title) {
            documentation.info.title = data.output.title;
          }
          if (data.output?.version) {
            documentation.info.version = data.output.version;
          }
          if (data.output?.description) {
            documentation.info.description = data.output.description;
          }

          endpointsCount = Object.keys(documentation.paths).length;
        } else if (data.source.openApiSpec) {
          documentation = data.source.openApiSpec;
          endpointsCount = Object.keys(documentation.paths || {}).length;
        }
        break;

      case 'graphql':
        if (!data.source.schemaFile) {
          return NextResponse.json(
            { error: 'schemaFile must be provided for GraphQL generation' },
            { status: 400 }
          );
        }

        const schemaPath = path.resolve(process.cwd(), data.source.schemaFile);
        await fs.access(schemaPath);
        
        documentation = await generator.generateGraphQLSchema(schemaPath);
        endpointsCount = documentation.queries.length + documentation.mutations.length + documentation.subscriptions.length;
        break;

      case 'postman':
        if (!data.source.openApiSpec && !data.source.routesDirectory) {
          return NextResponse.json(
            { error: 'Either openApiSpec or routesDirectory must be provided for Postman generation' },
            { status: 400 }
          );
        }

        let openApiSpec = data.source.openApiSpec;
        
        if (!openApiSpec && data.source.routesDirectory) {
          const resolvedPath = path.resolve(process.cwd(), data.source.routesDirectory);
          await fs.access(resolvedPath);
          openApiSpec = await generator.generateOpenAPIFromRoutes(resolvedPath);
        }

        documentation = generator.generatePostmanCollection(openApiSpec);
        endpointsCount = documentation.item?.length || 0;
        break;

      default:
        return NextResponse.json(
          { error: `Unsupported documentation type: ${data.type}` },
          { status: 400 }
        );
    }

    // Format output
    const outputFormat = data.output?.format || 'json';
    const filename = data.output?.filename || `${data.type}-documentation`;

    switch (outputFormat) {
      case 'yaml':
        const yaml = await convertToYaml(documentation);
        return new NextResponse(yaml, {
          headers: {
            'Content-Type': 'application/x-yaml',
            'Content-Disposition': `attachment; filename="${filename}.yaml"`,
          },
        });

      case 'html':
        const html = await convertToHtml(documentation, data);
        return new NextResponse(html, {
          headers: {
            'Content-Type': 'text/html',
            'Content-Disposition': `attachment; filename="${filename}.html"`,
          },
        });

      default:
        const response = {
          documentation,
          format: outputFormat,
          endpointsCount,
          generatedAt: new Date().toISOString(),
          type: data.type,
          cacheStats: generator.getCacheStats(),
        };

        // Set download headers if filename is provided
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        if (data.output?.filename) {
          headers['Content-Disposition'] = `attachment; filename="${filename}.json"`;
        }

        return NextResponse.json(response, { headers });
    }
  } catch (error) {
    console.error('Documentation generation failed:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate documentation', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * @api {get} /api/docs/generate Get Generation Status
 * @apiName GetGenerationStatus
 * @apiGroup Documentation
 * @apiVersion 1.0.0
 * 
 * @apiDescription Get the current status of documentation generation services.
 * 
 * @apiSuccess {Object} status Service status information
 * @apiSuccess {String[]} status.supportedTypes List of supported documentation types
 * @apiSuccess {String[]} status.supportedFormats List of supported output formats
 * @apiSuccess {Object} status.cache Cache status information
 * @apiSuccess {String} status.version Service version
 */
export async function GET() {
  try {
    const generator = new APIDocGenerator();

    return NextResponse.json({
      status: 'ready',
      supportedTypes: ['openapi', 'graphql', 'postman'],
      supportedFormats: ['json', 'yaml', 'html'],
      cache: generator.getCacheStats(),
      version: '1.0.0',
      features: {
        openapi: {
          description: 'Generate OpenAPI 3.0 specifications from Next.js API routes',
          supportedSources: ['routesDirectory', 'openApiSpec'],
        },
        graphql: {
          description: 'Generate GraphQL documentation from schema files',
          supportedSources: ['schemaFile'],
        },
        postman: {
          description: 'Generate Postman collections from OpenAPI specifications',
          supportedSources: ['openApiSpec', 'routesDirectory'],
        },
      },
    });
  } catch (error) {
    console.error('Failed to get generation status:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 }
    );
  }
}

/**
 * @api {post} /api/docs/generate/validate Validate API Documentation
 * @apiName ValidateAPIDocumentation
 * @apiGroup Documentation
 * @apiVersion 1.0.0
 * 
 * @apiDescription Validate an OpenAPI specification for correctness and completeness.
 * 
 * @apiBody {Object} spec OpenAPI specification to validate
 * 
 * @apiSuccess {Boolean} valid Whether the specification is valid
 * @apiSuccess {Object[]} errors Array of validation errors
 * @apiSuccess {String} errors[].path Path to the error in the specification
 * @apiSuccess {String} errors[].message Error message
 * @apiSuccess {String} errors[].severity Error severity: 'error' or 'warning'
 * 
 * @apiError {String} error Error message
 * @apiError {Number} status HTTP status code
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.spec) {
      return NextResponse.json(
        { error: 'OpenAPI specification must be provided' },
        { status: 400 }
      );
    }

    const generator = new APIDocGenerator();
    const validation = await generator.validateOpenAPISpec(body.spec);

    return NextResponse.json(validation);
  } catch (error) {
    console.error('Validation failed:', error);
    return NextResponse.json(
      { error: 'Failed to validate specification', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper functions
async function convertToYaml(documentation: any): Promise<string> {
  // Simple YAML conversion - in production you'd use a proper YAML library
  return JSON.stringify(documentation, null, 2)
    .replace(/^\s*"([^"]+)":/gm, '$1:') // Remove quotes from keys
    .replace(/": "/g, ': "') // Fix spacing
    .replace(/",$/gm, ',') // Remove trailing quotes
    .replace(/^(\s*)"([^"]+)"$/gm, '$1$2'); // Remove quotes from values
}

async function convertToHtml(documentation: any, data: GenerateRequest): Promise<string> {
  const title = data.output?.title || 'API Documentation';
  const type = data.type;

  let content = '';

  switch (type) {
    case 'openapi':
      content = generateOpenAPIHtml(documentation);
      break;
    case 'graphql':
      content = generateGraphQLHtml(documentation);
      break;
    case 'postman':
      content = generatePostmanHtml(documentation);
      break;
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          line-height: 1.6;
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
          color: #333;
          background: #f8f9fa;
        }

        .container {
          background: white;
          padding: 2rem;
          border-radius: 0.5rem;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        
        h1 {
          color: #2c3e50;
          border-bottom: 3px solid #3498db;
          padding-bottom: 0.5rem;
          margin-bottom: 2rem;
        }
        
        h2 {
          color: #34495e;
          border-bottom: 1px solid #bdc3c7;
          padding-bottom: 0.3rem;
          margin-top: 2rem;
        }
        
        h3 {
          color: #2c3e50;
          margin-top: 1.5rem;
        }
        
        .endpoint {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 0.5rem;
          padding: 1rem;
          margin: 1rem 0;
        }
        
        .method {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-weight: bold;
          font-size: 0.875rem;
          text-transform: uppercase;
          margin-right: 0.5rem;
        }
        
        .method.get { background: #28a745; color: white; }
        .method.post { background: #007bff; color: white; }
        .method.put { background: #ffc107; color: black; }
        .method.delete { background: #dc3545; color: white; }
        .method.patch { background: #6f42c1; color: white; }
        
        .path {
          font-family: 'Monaco', 'Menlo', monospace;
          background: #e9ecef;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-size: 0.9rem;
        }
        
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
        
        .parameter {
          background: white;
          border: 1px solid #dee2e6;
          border-radius: 0.25rem;
          padding: 0.75rem;
          margin: 0.5rem 0;
        }
        
        .parameter-name {
          font-weight: bold;
          color: #495057;
        }
        
        .parameter-type {
          background: #e9ecef;
          padding: 0.1rem 0.3rem;
          border-radius: 0.2rem;
          font-size: 0.8rem;
          margin-left: 0.5rem;
        }
        
        .required {
          color: #dc3545;
          font-size: 0.8rem;
        }
        
        .response-code {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          font-weight: bold;
          font-size: 0.875rem;
          margin-right: 0.5rem;
        }
        
        .response-200 { background: #d4edda; color: #155724; }
        .response-400 { background: #f8d7da; color: #721c24; }
        .response-500 { background: #f8d7da; color: #721c24; }
        
        .toc {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 0.5rem;
          margin: 2rem 0;
        }
        
        .toc ul {
          list-style: none;
          padding-left: 0;
        }
        
        .toc li {
          margin: 0.25rem 0;
        }
        
        .toc a {
          color: #3498db;
          text-decoration: none;
        }
        
        .toc a:hover {
          text-decoration: underline;
        }
        
        .info-section {
          background: #e3f2fd;
          border-left: 4px solid #2196f3;
          padding: 1rem;
          margin: 1rem 0;
        }
        
        .warning-section {
          background: #fff3e0;
          border-left: 4px solid #ff9800;
          padding: 1rem;
          margin: 1rem 0;
        }

        .schema {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 0.5rem;
          padding: 1rem;
          margin: 1rem 0;
        }

        .property {
          margin: 0.5rem 0;
          padding: 0.5rem;
          background: white;
          border-radius: 0.25rem;
        }

        .property-name {
          font-weight: bold;
          color: #2c3e50;
        }

        .property-type {
          color: #7f8c8d;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>${title}</h1>
        <div class="info-section">
          <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
          <strong>Type:</strong> ${type.toUpperCase()}<br>
          <strong>Format:</strong> HTML
        </div>
        ${content}
      </div>
    </body>
    </html>
  `;
}

function generateOpenAPIHtml(spec: any): string {
  let html = '';

  // API Info
  html += `
    <h2>API Information</h2>
    <div class="info-section">
      <strong>Title:</strong> ${spec.info.title}<br>
      <strong>Version:</strong> ${spec.info.version}<br>
      ${spec.info.description ? `<strong>Description:</strong> ${spec.info.description}<br>` : ''}
    </div>
  `;

  // Table of Contents
  const pathKeys = Object.keys(spec.paths || {});
  if (pathKeys.length > 0) {
    html += `
      <div class="toc">
        <h3>Endpoints</h3>
        <ul>
          ${pathKeys.map(path => `
            <li><a href="#${path.replace(/[^a-zA-Z0-9]/g, '-')}">${path}</a></li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  // Servers
  if (spec.servers && spec.servers.length > 0) {
    html += `
      <h2>Servers</h2>
      ${spec.servers.map((server: any) => `
        <div class="endpoint">
          <code>${server.url}</code>
          ${server.description ? `<p>${server.description}</p>` : ''}
        </div>
      `).join('')}
    `;
  }

  // Endpoints
  if (pathKeys.length > 0) {
    html += `<h2>Endpoints</h2>`;
    
    for (const path of pathKeys) {
      const methods = spec.paths[path];
      
      html += `<h3 id="${path.replace(/[^a-zA-Z0-9]/g, '-')}">${path}</h3>`;
      
      for (const [method, operation] of Object.entries(methods)) {
        const op = operation as any;
        
        html += `
          <div class="endpoint">
            <div>
              <span class="method ${method}">${method}</span>
              <span class="path">${path}</span>
            </div>
            
            ${op.summary ? `<h4>${op.summary}</h4>` : ''}
            ${op.description ? `<p>${op.description}</p>` : ''}
            
            ${op.parameters && op.parameters.length > 0 ? `
              <h5>Parameters</h5>
              ${op.parameters.map((param: any) => `
                <div class="parameter">
                  <span class="parameter-name">${param.name}</span>
                  <span class="parameter-type">${param.in}</span>
                  ${param.required ? '<span class="required">required</span>' : ''}
                  ${param.description ? `<p>${param.description}</p>` : ''}
                </div>
              `).join('')}
            ` : ''}
            
            ${op.responses ? `
              <h5>Responses</h5>
              ${Object.entries(op.responses).map(([code, response]: [string, any]) => `
                <div class="parameter">
                  <span class="response-code response-${code}">${code}</span>
                  <span>${response.description}</span>
                </div>
              `).join('')}
            ` : ''}
          </div>
        `;
      }
    }
  }

  // Schemas
  if (spec.components?.schemas && Object.keys(spec.components.schemas).length > 0) {
    html += `<h2>Schemas</h2>`;
    
    for (const [schemaName, schema] of Object.entries(spec.components.schemas)) {
      const schemaObj = schema as any;
      
      html += `
        <div class="schema">
          <h3>${schemaName}</h3>
          ${schemaObj.description ? `<p>${schemaObj.description}</p>` : ''}
          
          ${schemaObj.properties ? `
            <h4>Properties</h4>
            ${Object.entries(schemaObj.properties).map(([propName, prop]: [string, any]) => `
              <div class="property">
                <span class="property-name">${propName}</span>
                <span class="property-type">${prop.type || 'unknown'}</span>
                ${prop.description ? `<p>${prop.description}</p>` : ''}
              </div>
            `).join('')}
          ` : ''}
        </div>
      `;
    }
  }

  return html;
}

function generateGraphQLHtml(schema: any): string {
  let html = '';

  // Types
  if (schema.types && schema.types.length > 0) {
    html += `<h2>Types</h2>`;
    
    for (const type of schema.types) {
      html += `
        <div class="schema">
          <h3>${type.name} (${type.kind})</h3>
          ${type.description ? `<p>${type.description}</p>` : ''}
          
          ${type.fields && type.fields.length > 0 ? `
            <h4>Fields</h4>
            ${type.fields.map((field: any) => `
              <div class="property">
                <span class="property-name">${field.name}</span>
                <span class="property-type">${field.type}</span>
                ${field.description ? `<p>${field.description}</p>` : ''}
              </div>
            `).join('')}
          ` : ''}
          
          ${type.enumValues && type.enumValues.length > 0 ? `
            <h4>Values</h4>
            ${type.enumValues.map((value: any) => `
              <div class="property">
                <span class="property-name">${value.name}</span>
                ${value.description ? `<p>${value.description}</p>` : ''}
              </div>
            `).join('')}
          ` : ''}
        </div>
      `;
    }
  }

  // Queries
  if (schema.queries && schema.queries.length > 0) {
    html += `<h2>Queries</h2>`;
    
    for (const query of schema.queries) {
      html += `
        <div class="endpoint">
          <h3>${query.name}</h3>
          <span class="property-type">Returns: ${query.type}</span>
          ${query.description ? `<p>${query.description}</p>` : ''}
          
          ${query.args && query.args.length > 0 ? `
            <h4>Arguments</h4>
            ${query.args.map((arg: any) => `
              <div class="parameter">
                <span class="parameter-name">${arg.name}</span>
                <span class="parameter-type">${arg.type}</span>
                ${arg.description ? `<p>${arg.description}</p>` : ''}
              </div>
            `).join('')}
          ` : ''}
        </div>
      `;
    }
  }

  // Mutations
  if (schema.mutations && schema.mutations.length > 0) {
    html += `<h2>Mutations</h2>`;
    
    for (const mutation of schema.mutations) {
      html += `
        <div class="endpoint">
          <h3>${mutation.name}</h3>
          <span class="property-type">Returns: ${mutation.type}</span>
          ${mutation.description ? `<p>${mutation.description}</p>` : ''}
          
          ${mutation.args && mutation.args.length > 0 ? `
            <h4>Arguments</h4>
            ${mutation.args.map((arg: any) => `
              <div class="parameter">
                <span class="parameter-name">${arg.name}</span>
                <span class="parameter-type">${arg.type}</span>
                ${arg.description ? `<p>${arg.description}</p>` : ''}
              </div>
            `).join('')}
          ` : ''}
        </div>
      `;
    }
  }

  // Subscriptions
  if (schema.subscriptions && schema.subscriptions.length > 0) {
    html += `<h2>Subscriptions</h2>`;
    
    for (const subscription of schema.subscriptions) {
      html += `
        <div class="endpoint">
          <h3>${subscription.name}</h3>
          <span class="property-type">Returns: ${subscription.type}</span>
          ${subscription.description ? `<p>${subscription.description}</p>` : ''}
          
          ${subscription.args && subscription.args.length > 0 ? `
            <h4>Arguments</h4>
            ${subscription.args.map((arg: any) => `
              <div class="parameter">
                <span class="parameter-name">${arg.name}</span>
                <span class="parameter-type">${arg.type}</span>
                ${arg.description ? `<p>${arg.description}</p>` : ''}
              </div>
            `).join('')}
          ` : ''}
        </div>
      `;
    }
  }

  return html;
}

function generatePostmanHtml(collection: any): string {
  let html = `
    <h2>Postman Collection</h2>
    <div class="info-section">
      <strong>Name:</strong> ${collection.info.name}<br>
      ${collection.info.description ? `<strong>Description:</strong> ${collection.info.description}<br>` : ''}
    </div>
  `;

  if (collection.item && collection.item.length > 0) {
    html += `<h3>Requests</h3>`;
    
    for (const item of collection.item) {
      html += `
        <div class="endpoint">
          <h4>${item.name}</h4>
          <div>
            <span class="method ${item.request.method.toLowerCase()}">${item.request.method}</span>
            <span class="path">${item.request.url.raw}</span>
          </div>
          
          ${item.request.header && item.request.header.length > 0 ? `
            <h5>Headers</h5>
            ${item.request.header.map((header: any) => `
              <div class="parameter">
                <span class="parameter-name">${header.key}</span>
                <span>${header.value}</span>
              </div>
            `).join('')}
          ` : ''}
          
          ${item.request.body ? `
            <h5>Request Body</h5>
            <pre><code>${item.request.body.raw || 'No body'}</code></pre>
          ` : ''}
        </div>
      `;
    }
  }

  return html;
}