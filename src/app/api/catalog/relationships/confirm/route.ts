import { NextRequest, NextResponse } from 'next/server';
import { RelationshipDiscovery, DEFAULT_DISCOVERY_CONFIG } from '@/lib/discovery/RelationshipDiscovery';
import { CodeAnalyzer } from '@/lib/analysis/CodeAnalyzer';
import { RelationshipPredictor } from '@/lib/ml/RelationshipPredictor';
import winston from 'winston';

/**
 * Types for the confirmation API
 */
interface ConfirmationRequest {
  relationshipId: string;
  action: 'confirm' | 'reject';
  userId: string;
  feedback?: string;
  reason?: string;
}

interface BulkConfirmationRequest {
  relationships: Array<{
    relationshipId: string;
    action: 'confirm' | 'reject';
    feedback?: string;
    reason?: string;
  }>;
  userId: string;
}

interface ConfirmationResponse {
  success: boolean;
  data?: {
    relationshipId: string;
    status: 'confirmed' | 'rejected';
    updatedAt: string;
    userId: string;
  };
  error?: string;
  requestId: string;
}

interface BulkConfirmationResponse {
  success: boolean;
  data?: {
    processed: number;
    succeeded: number;
    failed: number;
    results: Array<{
      relationshipId: string;
      status: 'success' | 'error';
      action?: 'confirmed' | 'rejected';
      error?: string;
    }>;
  };
  error?: string;
  requestId: string;
}

interface RelationshipUpdateRequest {
  relationshipId: string;
  updates: {
    confidence?: number;
    metadata?: {
      notes?: string;
      tags?: string[];
      priority?: 'low' | 'medium' | 'high';
    };
  };
  userId: string;
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
 * POST /api/catalog/relationships/confirm
 * Confirm or reject a discovered relationship
 */
export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  
  try {
    const body: ConfirmationRequest = await request.json();
    
    logger.info('Processing relationship confirmation', { 
      requestId, 
      relationshipId: body.relationshipId,
      action: body.action,
      userId: body.userId
    });

    // Validate request
    const validationError = validateConfirmationRequest(body);
    if (validationError) {
      return NextResponse.json({
        success: false,
        error: validationError,
        requestId
      } as ConfirmationResponse, { status: 400 });
    }

    // Check if relationship exists
    const relationships = discoveryService.getDiscoveredRelationships();
    const relationship = relationships.find(r => r.id === body.relationshipId);
    
    if (!relationship) {
      return NextResponse.json({
        success: false,
        error: 'Relationship not found',
        requestId
      } as ConfirmationResponse, { status: 404 });
    }

    // Perform action
    try {
      if (body.action === 'confirm') {
        await discoveryService.confirmRelationship(body.relationshipId, body.userId);
        
        // Store feedback if provided
        if (body.feedback) {
          await storeFeedback(body.relationshipId, body.userId, body.feedback, 'confirmation');
        }
        
        logger.info('Relationship confirmed successfully', {
          requestId,
          relationshipId: body.relationshipId,
          userId: body.userId
        });

      } else if (body.action === 'reject') {
        await discoveryService.rejectRelationship(body.relationshipId, body.userId);
        
        // Store reason and feedback if provided
        if (body.reason || body.feedback) {
          await storeRejectionReason(body.relationshipId, body.userId, body.reason, body.feedback);
        }
        
        logger.info('Relationship rejected successfully', {
          requestId,
          relationshipId: body.relationshipId,
          userId: body.userId,
          reason: body.reason
        });
      }

      const response: ConfirmationResponse = {
        success: true,
        data: {
          relationshipId: body.relationshipId,
          status: body.action === 'confirm' ? 'confirmed' : 'rejected',
          updatedAt: new Date().toISOString(),
          userId: body.userId
        },
        requestId
      };

      return NextResponse.json(response);

    } catch (serviceError) {
      logger.error('Service error during confirmation:', { requestId, error: serviceError });
      
      return NextResponse.json({
        success: false,
        error: serviceError instanceof Error ? serviceError.message : 'Service error',
        requestId
      } as ConfirmationResponse, { status: 500 });
    }

  } catch (error) {
    logger.error('Confirmation request failed:', { requestId, error });
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      requestId
    } as ConfirmationResponse, { status: 500 });
  }
}

/**
 * PUT /api/catalog/relationships/confirm
 * Bulk confirm/reject multiple relationships
 */
export async function PUT(request: NextRequest) {
  const requestId = generateRequestId();
  
  try {
    const body: BulkConfirmationRequest = await request.json();
    
    logger.info('Processing bulk relationship confirmation', { 
      requestId, 
      count: body.relationships.length,
      userId: body.userId
    });

    // Validate request
    const validationError = validateBulkConfirmationRequest(body);
    if (validationError) {
      return NextResponse.json({
        success: false,
        error: validationError,
        requestId
      } as BulkConfirmationResponse, { status: 400 });
    }

    const results: Array<{
      relationshipId: string;
      status: 'success' | 'error';
      action?: 'confirmed' | 'rejected';
      error?: string;
    }> = [];

    let succeeded = 0;
    let failed = 0;

    // Process each relationship
    for (const relationshipAction of body.relationships) {
      try {
        const relationships = discoveryService.getDiscoveredRelationships();
        const relationship = relationships.find(r => r.id === relationshipAction.relationshipId);
        
        if (!relationship) {
          results.push({
            relationshipId: relationshipAction.relationshipId,
            status: 'error',
            error: 'Relationship not found'
          });
          failed++;
          continue;
        }

        if (relationshipAction.action === 'confirm') {
          await discoveryService.confirmRelationship(relationshipAction.relationshipId, body.userId);
          
          if (relationshipAction.feedback) {
            await storeFeedback(relationshipAction.relationshipId, body.userId, relationshipAction.feedback, 'confirmation');
          }
          
        } else if (relationshipAction.action === 'reject') {
          await discoveryService.rejectRelationship(relationshipAction.relationshipId, body.userId);
          
          if (relationshipAction.reason || relationshipAction.feedback) {
            await storeRejectionReason(relationshipAction.relationshipId, body.userId, relationshipAction.reason, relationshipAction.feedback);
          }
        }

        results.push({
          relationshipId: relationshipAction.relationshipId,
          status: 'success',
          action: relationshipAction.action === 'confirm' ? 'confirmed' : 'rejected'
        });
        succeeded++;

      } catch (error) {
        results.push({
          relationshipId: relationshipAction.relationshipId,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failed++;
      }
    }

    const response: BulkConfirmationResponse = {
      success: true,
      data: {
        processed: body.relationships.length,
        succeeded,
        failed,
        results
      },
      requestId
    };

    logger.info('Bulk confirmation completed', {
      requestId,
      processed: body.relationships.length,
      succeeded,
      failed
    });

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Bulk confirmation request failed:', { requestId, error });
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      requestId
    } as BulkConfirmationResponse, { status: 500 });
  }
}

/**
 * PATCH /api/catalog/relationships/confirm
 * Update relationship metadata and properties
 */
export async function PATCH(request: NextRequest) {
  const requestId = generateRequestId();
  
  try {
    const body: RelationshipUpdateRequest = await request.json();
    
    logger.info('Processing relationship update', { 
      requestId, 
      relationshipId: body.relationshipId,
      userId: body.userId
    });

    // Validate request
    if (!body.relationshipId || !body.userId) {
      return NextResponse.json({
        success: false,
        error: 'relationshipId and userId are required',
        requestId
      }, { status: 400 });
    }

    // Check if relationship exists
    const relationships = discoveryService.getDiscoveredRelationships();
    const relationship = relationships.find(r => r.id === body.relationshipId);
    
    if (!relationship) {
      return NextResponse.json({
        success: false,
        error: 'Relationship not found',
        requestId
      }, { status: 404 });
    }

    // Update relationship properties
    if (body.updates.confidence !== undefined) {
      if (body.updates.confidence < 0 || body.updates.confidence > 1) {
        return NextResponse.json({
          success: false,
          error: 'Confidence must be between 0 and 1',
          requestId
        }, { status: 400 });
      }
      relationship.confidence = body.updates.confidence;
    }

    if (body.updates.metadata) {
      // Store metadata updates
      await storeRelationshipMetadata(body.relationshipId, body.updates.metadata, body.userId);
    }

    logger.info('Relationship updated successfully', {
      requestId,
      relationshipId: body.relationshipId,
      updates: Object.keys(body.updates)
    });

    return NextResponse.json({
      success: true,
      data: {
        relationshipId: body.relationshipId,
        updatedAt: new Date().toISOString(),
        userId: body.userId
      },
      requestId
    });

  } catch (error) {
    logger.error('Relationship update failed:', { requestId, error });
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      requestId
    }, { status: 500 });
  }
}

/**
 * GET /api/catalog/relationships/confirm
 * Get confirmation history and statistics
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const relationshipId = searchParams.get('relationshipId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get all relationships
    const relationships = discoveryService.getDiscoveredRelationships();
    
    // Filter by user or relationship if specified
    let filteredRelationships = relationships;
    if (userId) {
      filteredRelationships = relationships.filter(r => r.confirmedBy === userId);
    }
    if (relationshipId) {
      filteredRelationships = relationships.filter(r => r.id === relationshipId);
    }

    // Apply pagination
    const paginatedRelationships = filteredRelationships.slice(offset, offset + limit);

    // Calculate statistics
    const stats = {
      total: relationships.length,
      confirmed: relationships.filter(r => r.status === 'confirmed').length,
      rejected: relationships.filter(r => r.status === 'rejected').length,
      pending: relationships.filter(r => r.status === 'discovered').length,
      userStats: userId ? {
        confirmations: relationships.filter(r => r.confirmedBy === userId && r.status === 'confirmed').length,
        rejections: relationships.filter(r => r.confirmedBy === userId && r.status === 'rejected').length
      } : undefined
    };

    const response = {
      success: true,
      data: {
        relationships: paginatedRelationships.map(r => ({
          id: r.id,
          sourceEntity: r.sourceEntity,
          targetEntity: r.targetEntity,
          type: r.type,
          confidence: r.confidence,
          status: r.status,
          confirmedBy: r.confirmedBy,
          confirmedAt: r.confirmedAt,
          createdAt: r.createdAt,
          discoveryMethod: r.discoveryMethod
        })),
        stats,
        pagination: {
          total: filteredRelationships.length,
          limit,
          offset,
          hasMore: offset + limit < filteredRelationships.length
        },
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
    logger.error('Failed to get confirmation history:', { requestId, error });
    
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
function validateConfirmationRequest(body: ConfirmationRequest): string | null {
  if (!body.relationshipId) {
    return 'relationshipId is required';
  }

  if (!body.action || !['confirm', 'reject'].includes(body.action)) {
    return 'action must be "confirm" or "reject"';
  }

  if (!body.userId) {
    return 'userId is required';
  }

  return null;
}

function validateBulkConfirmationRequest(body: BulkConfirmationRequest): string | null {
  if (!body.userId) {
    return 'userId is required';
  }

  if (!Array.isArray(body.relationships) || body.relationships.length === 0) {
    return 'relationships array is required and must not be empty';
  }

  if (body.relationships.length > 100) {
    return 'Maximum 100 relationships can be processed in a single request';
  }

  for (let i = 0; i < body.relationships.length; i++) {
    const rel = body.relationships[i];
    if (!rel.relationshipId) {
      return `relationships[${i}].relationshipId is required`;
    }
    if (!rel.action || !['confirm', 'reject'].includes(rel.action)) {
      return `relationships[${i}].action must be "confirm" or "reject"`;
    }
  }

  return null;
}

async function storeFeedback(
  relationshipId: string, 
  userId: string, 
  feedback: string, 
  type: 'confirmation' | 'rejection'
): Promise<void> {
  // In a real implementation, this would store feedback in a database
  logger.info('Storing feedback', { relationshipId, userId, type, feedback });
  
  // For now, we'll just log it
  // In production, you would:
  // 1. Store in database
  // 2. Use for ML model training
  // 3. Analytics and reporting
}

async function storeRejectionReason(
  relationshipId: string, 
  userId: string, 
  reason?: string, 
  feedback?: string
): Promise<void> {
  // In a real implementation, this would store rejection reasons in a database
  logger.info('Storing rejection reason', { relationshipId, userId, reason, feedback });
  
  // For now, we'll just log it
  // In production, this data would be valuable for:
  // 1. Improving ML models
  // 2. Understanding common rejection patterns
  // 3. UI/UX improvements
}

async function storeRelationshipMetadata(
  relationshipId: string, 
  metadata: any, 
  userId: string
): Promise<void> {
  // In a real implementation, this would store metadata updates in a database
  logger.info('Storing relationship metadata', { relationshipId, userId, metadata });
  
  // This could include:
  // 1. User notes
  // 2. Tags and categories
  // 3. Priority levels
  // 4. Custom attributes
}

function generateRequestId(): string {
  return `conf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}