import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface APIDocumentation {
  id: string;
  pluginId: string;
  version: string;
  title: string;
  description: string;
  baseUrl: string;
  spec: APISpec;
  endpoints: APIEndpoint[];
  models: DataModel[];
  authentication: AuthenticationDoc;
  examples: APIExample[];
  changelog: ChangelogEntry[];
  metadata: DocMetadata;
  generated: string;
  updated: string;
}

interface APISpec {
  type: 'openapi' | 'asyncapi' | 'graphql' | 'grpc' | 'custom';
  version: string;
  format: 'yaml' | 'json';
  content?: string;
  url?: string;
  validated: boolean;
  validationErrors?: string[];
}

interface APIEndpoint {
  id: string;
  path: string;
  method: string;
  summary: string;
  description: string;
  operationId: string;
  tags: string[];
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: Response[];
  security?: SecurityRequirement[];
  deprecated: boolean;
  examples: EndpointExample[];
  metrics?: EndpointMetrics;
}

interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description: string;
  required: boolean;
  deprecated: boolean;
  schema: Schema;
  example?: any;
  examples?: Record<string, any>;
}

interface RequestBody {
  description: string;
  required: boolean;
  content: Record<string, MediaType>;
}

interface MediaType {
  schema: Schema;
  example?: any;
  examples?: Record<string, any>;
  encoding?: Record<string, any>;
}

interface Response {
  statusCode: string;
  description: string;
  headers?: Record<string, Header>;
  content?: Record<string, MediaType>;
  links?: Record<string, Link>;
}

interface Header {
  description: string;
  required: boolean;
  deprecated: boolean;
  schema: Schema;
}

interface Link {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, any>;
  requestBody?: any;
  description?: string;
}

interface Schema {
  type: string;
  format?: string;
  description?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  enum?: any[];
  default?: any;
  example?: any;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  nullable?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  deprecated?: boolean;
  $ref?: string;
}

interface DataModel {
  id: string;
  name: string;
  description: string;
  type: 'object' | 'array' | 'enum' | 'union';
  schema: Schema;
  examples: any[];
  relationships?: ModelRelationship[];
  validations?: ValidationRule[];
}

interface ModelRelationship {
  type: 'has-one' | 'has-many' | 'belongs-to' | 'many-to-many';
  model: string;
  foreign_key?: string;
  through?: string;
}

interface ValidationRule {
  type: string;
  value: any;
  message: string;
}

interface AuthenticationDoc {
  type: 'none' | 'api-key' | 'oauth2' | 'basic' | 'bearer' | 'custom';
  description: string;
  flows?: OAuthFlow[];
  securitySchemes: SecurityScheme[];
  examples: AuthExample[];
}

interface OAuthFlow {
  type: 'implicit' | 'password' | 'client_credentials' | 'authorization_code';
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

interface SecurityScheme {
  type: string;
  description: string;
  name?: string;
  in?: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: Record<string, OAuthFlow>;
}

interface SecurityRequirement {
  [key: string]: string[];
}

interface APIExample {
  id: string;
  title: string;
  description: string;
  category: string;
  request: ExampleRequest;
  response: ExampleResponse;
  code: CodeExample[];
  tags: string[];
}

interface ExampleRequest {
  method: string;
  path: string;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: any;
  curl?: string;
}

interface ExampleResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: any;
  duration?: number;
}

interface CodeExample {
  language: string;
  label: string;
  code: string;
  dependencies?: string[];
}

interface EndpointExample {
  name: string;
  summary: string;
  value: any;
  externalValue?: string;
}

interface EndpointMetrics {
  usage: number;
  avgResponseTime: number;
  errorRate: number;
  lastUsed?: string;
}

interface ChangelogEntry {
  version: string;
  date: string;
  type: 'added' | 'changed' | 'deprecated' | 'removed' | 'fixed' | 'security';
  description: string;
  breaking: boolean;
  migration?: string;
}

interface DocMetadata {
  author: string;
  contact?: ContactInfo;
  license?: LicenseInfo;
  termsOfService?: string;
  externalDocs?: ExternalDoc[];
  tags: TagDoc[];
  servers: ServerDoc[];
  variables?: Record<string, any>;
}

interface ContactInfo {
  name?: string;
  email?: string;
  url?: string;
}

interface LicenseInfo {
  name: string;
  url?: string;
}

interface ExternalDoc {
  description: string;
  url: string;
}

interface TagDoc {
  name: string;
  description: string;
  externalDocs?: ExternalDoc;
}

interface ServerDoc {
  url: string;
  description: string;
  variables?: Record<string, ServerVariable>;
}

interface ServerVariable {
  default: string;
  description?: string;
  enum?: string[];
}

interface DocGenerator {
  id: string;
  name: string;
  type: 'swagger' | 'redoc' | 'slate' | 'docusaurus' | 'custom';
  config: GeneratorConfig;
  output: GeneratorOutput;
}

interface GeneratorConfig {
  theme?: string;
  logo?: string;
  favicon?: string;
  customCSS?: string;
  customJS?: string;
  features?: string[];
  plugins?: string[];
}

interface GeneratorOutput {
  format: 'html' | 'markdown' | 'pdf' | 'static-site';
  location: string;
  size?: number;
  generated?: string;
}

interface DocSearch {
  query: string;
  filters?: SearchFilter[];
  limit?: number;
  offset?: number;
}

interface SearchFilter {
  field: string;
  operator: string;
  value: any;
}

interface SearchResult {
  type: 'endpoint' | 'model' | 'example' | 'guide';
  title: string;
  description: string;
  url: string;
  highlights: string[];
  score: number;
}

interface DocAnalytics {
  views: number;
  searches: number;
  downloads: number;
  feedback: FeedbackStats;
  popular: PopularContent;
  coverage: CoverageStats;
}

interface FeedbackStats {
  helpful: number;
  notHelpful: number;
  comments: number;
  avgRating: number;
}

interface PopularContent {
  endpoints: string[];
  examples: string[];
  models: string[];
  searchTerms: string[];
}

interface CoverageStats {
  documented: number;
  undocumented: number;
  percentage: number;
  missingDescriptions: string[];
  missingExamples: string[];
}

// Storage
const documentations = new Map<string, APIDocumentation>();
const generators = new Map<string, DocGenerator>();
const analytics = new Map<string, DocAnalytics>();

// Initialize sample documentation
const initializeSampleDocs = () => {
  const sampleDoc: APIDocumentation = {
    id: crypto.randomBytes(8).toString('hex'),
    pluginId: '@backstage/plugin-catalog',
    version: '1.0.0',
    title: 'Backstage Catalog API',
    description: 'API for managing software catalog entities in Backstage',
    baseUrl: '/api/catalog',
    spec: {
      type: 'openapi',
      version: '3.0.0',
      format: 'yaml',
      validated: true
    },
    endpoints: [
      {
        id: 'e1',
        path: '/entities',
        method: 'GET',
        summary: 'List all entities',
        description: 'Returns a list of all entities in the catalog',
        operationId: 'listEntities',
        tags: ['Entities'],
        parameters: [
          {
            name: 'kind',
            in: 'query',
            description: 'Filter by entity kind',
            required: false,
            deprecated: false,
            schema: {
              type: 'string',
              enum: ['Component', 'API', 'System', 'Domain', 'Resource']
            }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of results',
            required: false,
            deprecated: false,
            schema: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20
            }
          }
        ],
        responses: [
          {
            statusCode: '200',
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Entity'
                  }
                }
              }
            }
          },
          {
            statusCode: '400',
            description: 'Bad request'
          }
        ],
        deprecated: false,
        examples: [
          {
            name: 'List components',
            summary: 'Get all components',
            value: {
              kind: 'Component'
            }
          }
        ],
        metrics: {
          usage: 15000,
          avgResponseTime: 45,
          errorRate: 0.02,
          lastUsed: new Date().toISOString()
        }
      },
      {
        id: 'e2',
        path: '/entities/{uid}',
        method: 'GET',
        summary: 'Get entity by UID',
        description: 'Returns a single entity by its unique identifier',
        operationId: 'getEntity',
        tags: ['Entities'],
        parameters: [
          {
            name: 'uid',
            in: 'path',
            description: 'Entity unique identifier',
            required: true,
            deprecated: false,
            schema: {
              type: 'string',
              pattern: '^[a-zA-Z0-9-]+$'
            },
            example: 'component-backend-123'
          }
        ],
        responses: [
          {
            statusCode: '200',
            description: 'Entity found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Entity'
                }
              }
            }
          },
          {
            statusCode: '404',
            description: 'Entity not found'
          }
        ],
        deprecated: false,
        examples: [],
        metrics: {
          usage: 8500,
          avgResponseTime: 25,
          errorRate: 0.05,
          lastUsed: new Date().toISOString()
        }
      },
      {
        id: 'e3',
        path: '/entities',
        method: 'POST',
        summary: 'Create entity',
        description: 'Creates a new entity in the catalog',
        operationId: 'createEntity',
        tags: ['Entities'],
        parameters: [],
        requestBody: {
          description: 'Entity to create',
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Entity'
              },
              example: {
                apiVersion: 'backstage.io/v1alpha1',
                kind: 'Component',
                metadata: {
                  name: 'my-service',
                  description: 'My microservice'
                },
                spec: {
                  type: 'service',
                  lifecycle: 'production',
                  owner: 'team-a'
                }
              }
            }
          }
        },
        responses: [
          {
            statusCode: '201',
            description: 'Entity created',
            headers: {
              'Location': {
                description: 'URL of created entity',
                required: true,
                deprecated: false,
                schema: {
                  type: 'string'
                }
              }
            }
          },
          {
            statusCode: '400',
            description: 'Invalid entity'
          }
        ],
        security: [
          {
            'bearerAuth': []
          }
        ],
        deprecated: false,
        examples: [],
        metrics: {
          usage: 2500,
          avgResponseTime: 120,
          errorRate: 0.08,
          lastUsed: new Date().toISOString()
        }
      }
    ],
    models: [
      {
        id: 'm1',
        name: 'Entity',
        description: 'Base entity model for all catalog items',
        type: 'object',
        schema: {
          type: 'object',
          required: ['apiVersion', 'kind', 'metadata'],
          properties: {
            apiVersion: {
              type: 'string',
              description: 'API version',
              example: 'backstage.io/v1alpha1'
            },
            kind: {
              type: 'string',
              description: 'Entity kind',
              enum: ['Component', 'API', 'System', 'Domain', 'Resource', 'Location', 'User', 'Group']
            },
            metadata: {
              type: 'object',
              description: 'Entity metadata',
              properties: {
                name: {
                  type: 'string',
                  description: 'Entity name',
                  pattern: '^[a-z0-9-]+$'
                },
                namespace: {
                  type: 'string',
                  description: 'Entity namespace',
                  default: 'default'
                },
                uid: {
                  type: 'string',
                  description: 'Unique identifier',
                  readOnly: true
                },
                description: {
                  type: 'string',
                  description: 'Human-readable description'
                },
                labels: {
                  type: 'object',
                  description: 'Key-value labels'
                },
                annotations: {
                  type: 'object',
                  description: 'Key-value annotations'
                },
                tags: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'Entity tags'
                }
              }
            },
            spec: {
              type: 'object',
              description: 'Entity specification'
            },
            relations: {
              type: 'array',
              items: {
                type: 'object'
              },
              description: 'Entity relationships',
              readOnly: true
            }
          }
        },
        examples: [
          {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: {
              name: 'petstore-api',
              description: 'Pet Store API Service'
            },
            spec: {
              type: 'service',
              lifecycle: 'production',
              owner: 'team-pet'
            }
          }
        ],
        relationships: [
          {
            type: 'has-many',
            model: 'Relation',
            foreign_key: 'entity_uid'
          }
        ],
        validations: [
          {
            type: 'required',
            value: ['apiVersion', 'kind', 'metadata'],
            message: 'Missing required fields'
          }
        ]
      }
    ],
    authentication: {
      type: 'bearer',
      description: 'Bearer token authentication using Backstage auth providers',
      flows: [],
      securitySchemes: [
        {
          type: 'http',
          description: 'Bearer token authentication',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      ],
      examples: [
        {
          title: 'Using Bearer Token',
          description: 'Include token in Authorization header',
          code: 'Authorization: Bearer <your-token-here>'
        }
      ]
    },
    examples: [
      {
        id: 'ex1',
        title: 'List all components',
        description: 'Retrieve all components from the catalog',
        category: 'read',
        request: {
          method: 'GET',
          path: '/entities?kind=Component',
          headers: {
            'Accept': 'application/json'
          },
          curl: 'curl -H "Accept: application/json" https://backstage.example.com/api/catalog/entities?kind=Component'
        },
        response: {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: [
            {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Component',
              metadata: {
                name: 'backend-service',
                uid: 'abc123'
              }
            }
          ]
        },
        code: [
          {
            language: 'javascript',
            label: 'Node.js',
            code: `const response = await fetch('https://backstage.example.com/api/catalog/entities?kind=Component', {
  headers: {
    'Accept': 'application/json'
  }
});
const entities = await response.json();`,
            dependencies: ['node-fetch']
          },
          {
            language: 'python',
            label: 'Python',
            code: `import requests

response = requests.get(
    'https://backstage.example.com/api/catalog/entities',
    params={'kind': 'Component'},
    headers={'Accept': 'application/json'}
)
entities = response.json()`,
            dependencies: ['requests']
          }
        ],
        tags: ['entities', 'components', 'list']
      }
    ],
    changelog: [
      {
        version: '1.0.0',
        date: '2024-01-15',
        type: 'added',
        description: 'Initial API release',
        breaking: false
      },
      {
        version: '1.1.0',
        date: '2024-02-01',
        type: 'added',
        description: 'Added filtering by multiple kinds',
        breaking: false
      },
      {
        version: '2.0.0',
        date: '2024-03-01',
        type: 'changed',
        description: 'Changed entity UID format',
        breaking: true,
        migration: 'https://docs.backstage.io/migrations/v2'
      }
    ],
    metadata: {
      author: 'Backstage Team',
      contact: {
        name: 'API Support',
        email: 'api@backstage.io',
        url: 'https://backstage.io/support'
      },
      license: {
        name: 'Apache 2.0',
        url: 'https://www.apache.org/licenses/LICENSE-2.0.html'
      },
      termsOfService: 'https://backstage.io/terms',
      externalDocs: [
        {
          description: 'Backstage Documentation',
          url: 'https://backstage.io/docs'
        }
      ],
      tags: [
        {
          name: 'Entities',
          description: 'Entity management operations'
        },
        {
          name: 'Relations',
          description: 'Entity relationship operations'
        }
      ],
      servers: [
        {
          url: 'https://backstage.example.com/api/catalog',
          description: 'Production server',
          variables: {}
        },
        {
          url: 'https://staging.backstage.example.com/api/catalog',
          description: 'Staging server',
          variables: {}
        }
      ]
    },
    generated: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  documentations.set(sampleDoc.id, sampleDoc);
};

// Initialize sample docs
initializeSampleDocs();

// Generate documentation
const generateDocumentation = async (
  pluginId: string,
  spec: any
): Promise<APIDocumentation> => {
  const doc: APIDocumentation = {
    id: crypto.randomBytes(8).toString('hex'),
    pluginId,
    version: spec.info?.version || '1.0.0',
    title: spec.info?.title || 'API Documentation',
    description: spec.info?.description || '',
    baseUrl: spec.servers?.[0]?.url || '/api',
    spec: {
      type: 'openapi',
      version: spec.openapi || '3.0.0',
      format: 'json',
      content: JSON.stringify(spec),
      validated: true
    },
    endpoints: [],
    models: [],
    authentication: {
      type: 'none',
      description: 'No authentication required',
      flows: [],
      securitySchemes: [],
      examples: []
    },
    examples: [],
    changelog: [],
    metadata: {
      author: spec.info?.contact?.name || 'Unknown',
      contact: spec.info?.contact,
      license: spec.info?.license,
      termsOfService: spec.info?.termsOfService,
      externalDocs: spec.externalDocs ? [spec.externalDocs] : [],
      tags: spec.tags || [],
      servers: spec.servers || [],
      variables: {}
    },
    generated: new Date().toISOString(),
    updated: new Date().toISOString()
  };

  // Parse endpoints from OpenAPI spec
  if (spec.paths) {
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(pathItem as any)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
          doc.endpoints.push({
            id: crypto.randomBytes(4).toString('hex'),
            path,
            method: method.toUpperCase(),
            summary: (operation as any).summary || '',
            description: (operation as any).description || '',
            operationId: (operation as any).operationId || '',
            tags: (operation as any).tags || [],
            parameters: (operation as any).parameters || [],
            requestBody: (operation as any).requestBody,
            responses: Object.entries((operation as any).responses || {}).map(
              ([code, response]) => ({
                statusCode: code,
                description: (response as any).description || '',
                content: (response as any).content
              })
            ),
            security: (operation as any).security,
            deprecated: (operation as any).deprecated || false,
            examples: []
          });
        }
      }
    }
  }

  // Parse models from components
  if (spec.components?.schemas) {
    for (const [name, schema] of Object.entries(spec.components.schemas)) {
      doc.models.push({
        id: crypto.randomBytes(4).toString('hex'),
        name,
        description: (schema as any).description || '',
        type: (schema as any).type || 'object',
        schema: schema as Schema,
        examples: (schema as any).examples || []
      });
    }
  }

  // Parse authentication
  if (spec.components?.securitySchemes) {
    doc.authentication.securitySchemes = Object.values(spec.components.securitySchemes);
  }

  return doc;
};

// Search documentation
const searchDocumentation = (
  doc: APIDocumentation,
  query: string
): SearchResult[] => {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  // Search endpoints
  doc.endpoints.forEach(endpoint => {
    if (
      endpoint.path.toLowerCase().includes(lowerQuery) ||
      endpoint.summary.toLowerCase().includes(lowerQuery) ||
      endpoint.description.toLowerCase().includes(lowerQuery)
    ) {
      results.push({
        type: 'endpoint',
        title: `${endpoint.method} ${endpoint.path}`,
        description: endpoint.summary,
        url: `#${endpoint.operationId}`,
        highlights: [],
        score: 1.0
      });
    }
  });

  // Search models
  doc.models.forEach(model => {
    if (
      model.name.toLowerCase().includes(lowerQuery) ||
      model.description.toLowerCase().includes(lowerQuery)
    ) {
      results.push({
        type: 'model',
        title: model.name,
        description: model.description,
        url: `#model-${model.name}`,
        highlights: [],
        score: 0.9
      });
    }
  });

  // Search examples
  doc.examples.forEach(example => {
    if (
      example.title.toLowerCase().includes(lowerQuery) ||
      example.description.toLowerCase().includes(lowerQuery)
    ) {
      results.push({
        type: 'example',
        title: example.title,
        description: example.description,
        url: `#example-${example.id}`,
        highlights: [],
        score: 0.8
      });
    }
  });

  return results;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'generate': {
        const { pluginId, spec } = body;
        const doc = await generateDocumentation(pluginId, spec);
        documentations.set(doc.id, doc);

        return NextResponse.json({
          success: true,
          documentation: doc
        });
      }

      case 'update': {
        const { id, updates } = body;
        const doc = documentations.get(id);

        if (!doc) {
          return NextResponse.json({
            success: false,
            error: 'Documentation not found'
          }, { status: 404 });
        }

        Object.assign(doc, updates, {
          updated: new Date().toISOString()
        });

        return NextResponse.json({
          success: true,
          documentation: doc
        });
      }

      case 'validate': {
        const { spec, type } = body;
        
        // Simple validation
        const errors: string[] = [];
        
        if (!spec) {
          errors.push('Specification is required');
        }
        
        if (type === 'openapi') {
          if (!spec.openapi) {
            errors.push('OpenAPI version is required');
          }
          if (!spec.info) {
            errors.push('Info object is required');
          }
          if (!spec.paths) {
            errors.push('Paths object is required');
          }
        }

        return NextResponse.json({
          success: errors.length === 0,
          valid: errors.length === 0,
          errors
        });
      }

      case 'search': {
        const { query, docId } = body;
        
        if (docId) {
          const doc = documentations.get(docId);
          if (!doc) {
            return NextResponse.json({
              success: false,
              error: 'Documentation not found'
            }, { status: 404 });
          }

          const results = searchDocumentation(doc, query);
          return NextResponse.json({
            success: true,
            results
          });
        }

        // Search across all docs
        let allResults: SearchResult[] = [];
        documentations.forEach(doc => {
          allResults = allResults.concat(searchDocumentation(doc, query));
        });

        return NextResponse.json({
          success: true,
          results: allResults
        });
      }

      case 'export': {
        const { id, format } = body;
        const doc = documentations.get(id);

        if (!doc) {
          return NextResponse.json({
            success: false,
            error: 'Documentation not found'
          }, { status: 404 });
        }

        let output: any;
        
        switch (format) {
          case 'openapi':
            output = {
              openapi: '3.0.0',
              info: {
                title: doc.title,
                description: doc.description,
                version: doc.version,
                contact: doc.metadata.contact,
                license: doc.metadata.license
              },
              servers: doc.metadata.servers,
              paths: {},
              components: {
                schemas: {},
                securitySchemes: {}
              }
            };
            break;
            
          case 'markdown':
            output = `# ${doc.title}\n\n${doc.description}\n\n## Endpoints\n\n${
              doc.endpoints.map(e => `### ${e.method} ${e.path}\n\n${e.description}`).join('\n\n')
            }`;
            break;
            
          default:
            output = doc;
        }

        return NextResponse.json({
          success: true,
          format,
          content: output
        });
      }

      case 'analyze': {
        const { id } = body;
        const doc = documentations.get(id);

        if (!doc) {
          return NextResponse.json({
            success: false,
            error: 'Documentation not found'
          }, { status: 404 });
        }

        const coverage: CoverageStats = {
          documented: doc.endpoints.filter(e => e.description).length,
          undocumented: doc.endpoints.filter(e => !e.description).length,
          percentage: 0,
          missingDescriptions: doc.endpoints
            .filter(e => !e.description)
            .map(e => `${e.method} ${e.path}`),
          missingExamples: doc.endpoints
            .filter(e => e.examples.length === 0)
            .map(e => `${e.method} ${e.path}`)
        };

        coverage.percentage = 
          (coverage.documented / (coverage.documented + coverage.undocumented)) * 100;

        const analysis: DocAnalytics = {
          views: Math.floor(Math.random() * 10000),
          searches: Math.floor(Math.random() * 1000),
          downloads: Math.floor(Math.random() * 500),
          feedback: {
            helpful: Math.floor(Math.random() * 100),
            notHelpful: Math.floor(Math.random() * 20),
            comments: Math.floor(Math.random() * 50),
            avgRating: 3.5 + Math.random() * 1.5
          },
          popular: {
            endpoints: doc.endpoints.slice(0, 5).map(e => e.path),
            examples: doc.examples.slice(0, 5).map(e => e.title),
            models: doc.models.slice(0, 5).map(m => m.name),
            searchTerms: ['entity', 'component', 'api', 'catalog', 'plugin']
          },
          coverage
        };

        analytics.set(id, analysis);

        return NextResponse.json({
          success: true,
          analytics: analysis
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Documentation API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process documentation request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const pluginId = searchParams.get('pluginId');
    const type = searchParams.get('type');

    if (id) {
      const doc = documentations.get(id);
      if (!doc) {
        return NextResponse.json({
          success: false,
          error: 'Documentation not found'
        }, { status: 404 });
      }

      const analysis = analytics.get(id);

      return NextResponse.json({
        success: true,
        documentation: doc,
        analytics: analysis
      });
    }

    if (pluginId) {
      const docs = Array.from(documentations.values()).filter(
        d => d.pluginId === pluginId
      );

      return NextResponse.json({
        success: true,
        documentations: docs
      });
    }

    if (type === 'generators') {
      return NextResponse.json({
        success: true,
        generators: Array.from(generators.values())
      });
    }

    // Return all documentations
    return NextResponse.json({
      success: true,
      documentations: Array.from(documentations.values()),
      total: documentations.size
    });

  } catch (error) {
    console.error('Documentation API GET error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch documentation'
    }, { status: 500 });
  }
}