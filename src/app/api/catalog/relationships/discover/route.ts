import { NextRequest, NextResponse } from 'next/server';
import { RelationshipDiscovery, DEFAULT_DISCOVERY_CONFIG, DiscoveredRelationship, DiscoveryMethod } from '@/lib/discovery/RelationshipDiscovery';
import { CodeAnalyzer } from '@/lib/analysis/CodeAnalyzer';
import { RelationshipPredictor } from '@/lib/ml/RelationshipPredictor';
import { Entity } from '@backstage/catalog-model';
import winston from 'winston';

/**
 * Types for the discovery API
 */
interface DiscoveryRequest {
  entityId?: string;
  methods?: DiscoveryMethod[];
  confidenceThreshold?: number;
  autoConfirmThreshold?: number;
  maxResults?: number;
  includeExisting?: boolean;
}

interface DiscoveryResponse {
  success: boolean;
  data?: {
    relationships: DiscoveredRelationship[];
    stats: {
      totalFound: number;
      byMethod: Record<DiscoveryMethod, number>;
      byConfidence: {
        high: number; // >= 0.8
        medium: number; // 0.5 - 0.8
        low: number; // < 0.5
      };
      processingTime: number;
    };
    metadata: {
      timestamp: string;
      requestId: string;
      version: string;
    };
  };
  error?: string;
  requestId: string;
}

// Initialize services
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

const codeAnalyzer = new CodeAnalyzer(logger);
const mlPredictor = new RelationshipPredictor(logger);
const discoveryService = new RelationshipDiscovery(
  DEFAULT_DISCOVERY_CONFIG,
  logger,
  codeAnalyzer,
  mlPredictor
);

/**
 * POST /api/catalog/relationships/discover
 * Discover relationships for entities
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  try {
    const body: DiscoveryRequest = await request.json();
    
    logger.info('Starting relationship discovery', { 
      requestId, 
      entityId: body.entityId,
      methods: body.methods 
    });

    // Validate request
    const validationError = validateDiscoveryRequest(body);
    if (validationError) {
      return NextResponse.json({
        success: false,
        error: validationError,
        requestId
      } as DiscoveryResponse, { status: 400 });
    }

    // Get entities to analyze
    const entities = await getEntitiesForDiscovery(body.entityId);
    if (entities.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No entities found for discovery',
        requestId
      } as DiscoveryResponse, { status: 404 });
    }

    // Configure discovery service
    const config = {
      ...DEFAULT_DISCOVERY_CONFIG,
      enabledMethods: body.methods || DEFAULT_DISCOVERY_CONFIG.enabledMethods,
      confidenceThreshold: body.confidenceThreshold || DEFAULT_DISCOVERY_CONFIG.confidenceThreshold,
      autoConfirmThreshold: body.autoConfirmThreshold || DEFAULT_DISCOVERY_CONFIG.autoConfirmThreshold,
      maxRelationshipsPerEntity: body.maxResults || DEFAULT_DISCOVERY_CONFIG.maxRelationshipsPerEntity
    };

    // Update discovery service configuration
    const discoveryServiceWithConfig = new RelationshipDiscovery(
      config,
      logger,
      codeAnalyzer,
      mlPredictor
    );

    // Run discovery
    const allRelationships: DiscoveredRelationship[] = [];
    
    for (const entity of entities) {
      try {
        const entityRelationships = await discoveryServiceWithConfig.discoverForEntity(entity);
        allRelationships.push(...entityRelationships);
      } catch (error) {
        logger.error(`Discovery failed for entity ${entity.metadata.name}:`, error);
        // Continue with other entities
      }
    }

    // Filter and sort results
    const filteredRelationships = allRelationships
      .filter(rel => rel.confidence >= config.confidenceThreshold)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, body.maxResults || 100);

    // Auto-confirm high-confidence relationships
    for (const relationship of filteredRelationships) {
      if (relationship.confidence >= config.autoConfirmThreshold) {
        await discoveryServiceWithConfig.confirmRelationship(relationship.id, 'system');
        logger.info(`Auto-confirmed relationship: ${relationship.id}`);
      }
    }

    // Calculate statistics
    const stats = calculateDiscoveryStats(filteredRelationships, Date.now() - startTime);

    const response: DiscoveryResponse = {
      success: true,
      data: {
        relationships: filteredRelationships,
        stats,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      },
      requestId
    };

    logger.info('Discovery completed successfully', {
      requestId,
      relationshipsFound: filteredRelationships.length,
      processingTime: stats.processingTime
    });

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Discovery request failed:', { requestId, error });
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      requestId
    } as DiscoveryResponse, { status: 500 });
  }
}

/**
 * GET /api/catalog/relationships/discover
 * Get discovery status and recent results
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityId = searchParams.get('entityId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get existing discovered relationships
    const allRelationships = discoveryService.getDiscoveredRelationships();
    
    let filteredRelationships = allRelationships;
    if (entityId) {
      filteredRelationships = discoveryService.getRelationshipsForEntity(entityId);
    }

    // Apply pagination
    const paginatedRelationships = filteredRelationships
      .slice(offset, offset + limit);

    const response = {
      success: true,
      data: {
        relationships: paginatedRelationships,
        pagination: {
          total: filteredRelationships.length,
          limit,
          offset,
          hasMore: offset + limit < filteredRelationships.length
        },
        stats: calculateDiscoveryStats(allRelationships, 0),
        metadata: {
          timestamp: new Date().toISOString(),
          requestId,
          version: '1.0.0'
        }
      },
      requestId
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Failed to get discovery results:', { requestId, error });
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      requestId
    }, { status: 500 });
  }
}

/**
 * Utility functions
 */
function validateDiscoveryRequest(body: DiscoveryRequest): string | null {
  if (body.confidenceThreshold !== undefined) {
    if (body.confidenceThreshold < 0 || body.confidenceThreshold > 1) {
      return 'confidenceThreshold must be between 0 and 1';
    }
  }

  if (body.autoConfirmThreshold !== undefined) {
    if (body.autoConfirmThreshold < 0 || body.autoConfirmThreshold > 1) {
      return 'autoConfirmThreshold must be between 0 and 1';
    }
  }

  if (body.maxResults !== undefined) {
    if (body.maxResults < 1 || body.maxResults > 1000) {
      return 'maxResults must be between 1 and 1000';
    }
  }

  if (body.methods) {
    const validMethods = Object.values(DiscoveryMethod);
    for (const method of body.methods) {
      if (!validMethods.includes(method)) {
        return `Invalid discovery method: ${method}`;
      }
    }
  }

  return null;
}

async function getEntitiesForDiscovery(entityId?: string): Promise<Entity[]> {
  try {
    if (entityId) {
      // Get specific entity
      const response = await fetch(`${process.env.BACKSTAGE_BASE_URL}/api/catalog/entities/${entityId}`);
      if (response.ok) {
        const entity = await response.json();
        return [entity];
      }
      return [];
    } else {
      // Get all entities
      const response = await fetch(`${process.env.BACKSTAGE_BASE_URL}/api/catalog/entities`);
      if (response.ok) {
        const entities = await response.json();
        return Array.isArray(entities) ? entities : entities.items || [];
      }
      return [];
    }
  } catch (error) {
    logger.error('Failed to fetch entities:', error);
    
    // Fallback to mock data for development
    return getMockEntities(entityId);
  }
}

function getMockEntities(entityId?: string): Entity[] {
  const mockEntities: Entity[] = [
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'user-service',
        namespace: 'default',
        description: 'User management service',
        tags: ['backend', 'api', 'users'],
        annotations: {
          'github.com/project-slug': 'example-org/user-service',
          'backstage.io/source-location': 'url:https://github.com/example-org/user-service'
        }
      },
      spec: {
        type: 'service',
        lifecycle: 'production',
        owner: 'platform-team',
        providesApis: ['user-api']
      }
    },
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: {
        name: 'order-service',
        namespace: 'default',
        description: 'Order processing service',
        tags: ['backend', 'api', 'orders'],
        annotations: {
          'github.com/project-slug': 'example-org/order-service',
          'backstage.io/source-location': 'url:https://github.com/example-org/order-service'
        }
      },
      spec: {
        type: 'service',
        lifecycle: 'production',
        owner: 'commerce-team',
        consumesApis: ['user-api', 'payment-api']
      }
    },
    {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'API',
      metadata: {
        name: 'user-api',
        namespace: 'default',
        description: 'User management API',
        tags: ['api', 'rest']
      },
      spec: {
        type: 'openapi',
        lifecycle: 'production',
        owner: 'platform-team',
        definition: {
          $text: 'https://github.com/example-org/user-service/blob/main/api/openapi.yaml'
        }
      }
    }
  ];

  if (entityId) {
    return mockEntities.filter(entity => 
      `${entity.kind.toLowerCase()}:${entity.metadata.namespace}/${entity.metadata.name}` === entityId ||
      entity.metadata.name === entityId
    );
  }

  return mockEntities;
}

function calculateDiscoveryStats(
  relationships: DiscoveredRelationship[], 
  processingTime: number
) {
  const stats = {
    totalFound: relationships.length,
    byMethod: {} as Record<DiscoveryMethod, number>,
    byConfidence: {
      high: 0,
      medium: 0,
      low: 0
    },
    processingTime
  };

  // Initialize method counts
  for (const method of Object.values(DiscoveryMethod)) {
    stats.byMethod[method] = 0;
  }

  // Count relationships by method and confidence
  for (const relationship of relationships) {
    stats.byMethod[relationship.discoveryMethod]++;
    
    if (relationship.confidence >= 0.8) {
      stats.byConfidence.high++;
    } else if (relationship.confidence >= 0.5) {
      stats.byConfidence.medium++;
    } else {
      stats.byConfidence.low++;
    }
  }

  return stats;
}

function generateRequestId(): string {
  return `disc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}