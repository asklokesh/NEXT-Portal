import { NextRequest, NextResponse } from 'next/server';
import { OwnershipManager, OwnershipSource, OwnershipConfidence } from '@/lib/ownership/OwnershipManager';
import { TeamManager } from '@/lib/teams/TeamManager';

/**
 * API endpoint for assigning ownership to teams
 * POST /api/ownership/assign
 */

interface AssignOwnershipRequest {
  path: string;
  teamId: string;
  source?: OwnershipSource;
  confidence?: OwnershipConfidence;
  notes?: string;
  override?: boolean; // Force assignment even if conflicts exist
}

interface AssignOwnershipResponse {
  success: boolean;
  message: string;
  assignment?: {
    path: string;
    teamId: string;
    teamName: string;
    confidence: OwnershipConfidence;
    score: number;
    source: OwnershipSource;
    assignedAt: string;
  };
  conflicts?: Array<{
    path: string;
    existingTeam: string;
    newTeam: string;
    reason: string;
  }>;
}

// Initialize managers (in production, these would be singleton instances)
let ownershipManager: OwnershipManager;
let teamManager: TeamManager;

function initManagers() {
  if (!ownershipManager) {
    // Use current working directory or repository path from env
    const repoPath = process.env.REPOSITORY_PATH || process.cwd();
    ownershipManager = new OwnershipManager(repoPath);
    teamManager = new TeamManager();
  }
}

export async function POST(request: NextRequest) {
  try {
    initManagers();
    
    const body: AssignOwnershipRequest = await request.json();
    
    // Validate required fields
    if (!body.path || !body.teamId) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Path and teamId are required' 
        },
        { status: 400 }
      );
    }

    // Validate team exists
    const team = teamManager.getTeam(body.teamId);
    if (!team) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Team ${body.teamId} not found` 
        },
        { status: 404 }
      );
    }

    // Check for existing ownership
    const existingOwnership = await ownershipManager.getOwnership(body.path);
    
    // Handle conflicts if not overriding
    if (existingOwnership.primary && !body.override) {
      if (existingOwnership.primary.teamId !== body.teamId) {
        return NextResponse.json({
          success: false,
          message: 'Ownership conflict detected',
          conflicts: [{
            path: body.path,
            existingTeam: existingOwnership.primary.teamName,
            newTeam: team.name,
            reason: `File already assigned to ${existingOwnership.primary.teamName} with ${existingOwnership.primary.confidence} confidence`
          }]
        }, { status: 409 });
      }
    }

    // Determine confidence level
    let confidence = body.confidence || OwnershipConfidence.HIGH;
    if (body.source === OwnershipSource.AUTO_ASSIGNED) {
      confidence = OwnershipConfidence.MEDIUM;
    }

    // Calculate confidence score
    const score = calculateConfidenceScore(confidence, body.source || OwnershipSource.MANUAL);

    // Create assignment record (in practice, this would be saved to database)
    const assignment = {
      path: body.path,
      teamId: body.teamId,
      teamName: team.name,
      confidence,
      score,
      source: body.source || OwnershipSource.MANUAL,
      contributors: [], // Would be populated from git analysis
      lastActive: new Date(),
      pathPatterns: [body.path],
      manualOverride: body.override || false,
      notes: body.notes,
      assignedAt: new Date().toISOString(),
      assignedBy: 'system' // Would come from authentication
    };

    // Log the assignment
    console.log(`Ownership assigned: ${body.path} -> ${team.name} (${confidence})`);

    // In production, save to database here
    // await saveOwnershipAssignment(assignment);

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${body.path} to ${team.name}`,
      assignment: {
        path: assignment.path,
        teamId: assignment.teamId,
        teamName: assignment.teamName,
        confidence: assignment.confidence,
        score: assignment.score,
        source: assignment.source,
        assignedAt: assignment.assignedAt
      }
    });

  } catch (error) {
    console.error('Error in ownership assignment:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error during ownership assignment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    initManagers();
    
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    
    if (!path) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Path parameter is required' 
        },
        { status: 400 }
      );
    }

    // Get current ownership for the path
    const ownership = await ownershipManager.getOwnership(path);
    
    return NextResponse.json({
      success: true,
      ownership: {
        path,
        primary: ownership.primary ? {
          teamId: ownership.primary.teamId,
          teamName: ownership.primary.teamName,
          confidence: ownership.primary.confidence,
          score: ownership.primary.score,
          source: ownership.primary.source,
          contributors: ownership.primary.contributors,
          lastActive: ownership.primary.lastActive.toISOString()
        } : null,
        alternatives: ownership.alternatives.map(alt => ({
          teamId: alt.teamId,
          teamName: alt.teamName,
          confidence: alt.confidence,
          score: alt.score,
          source: alt.source
        })),
        conflicts: ownership.conflicts.map(conflict => ({
          id: conflict.id,
          path: conflict.path,
          conflictingTeams: conflict.conflictingTeams.map(team => ({
            teamId: team.teamId,
            teamName: team.teamName,
            confidence: team.confidence,
            score: team.score
          })),
          resolved: conflict.resolved
        })),
        confidence: ownership.confidence
      }
    });

  } catch (error) {
    console.error('Error getting ownership info:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error retrieving ownership information',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    initManagers();
    
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    
    if (!path) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Path parameter is required' 
        },
        { status: 400 }
      );
    }

    // In production, remove ownership assignment from database
    // await removeOwnershipAssignment(path);
    
    console.log(`Ownership removed for path: ${path}`);

    return NextResponse.json({
      success: true,
      message: `Ownership assignment removed for ${path}`
    });

  } catch (error) {
    console.error('Error removing ownership:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error removing ownership assignment',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Helper functions

function calculateConfidenceScore(confidence: OwnershipConfidence, source: OwnershipSource): number {
  let baseScore = 0;
  
  // Base score from confidence level
  switch (confidence) {
    case OwnershipConfidence.HIGH:
      baseScore = 85;
      break;
    case OwnershipConfidence.MEDIUM:
      baseScore = 65;
      break;
    case OwnershipConfidence.LOW:
      baseScore = 35;
      break;
    case OwnershipConfidence.UNKNOWN:
      baseScore = 10;
      break;
  }
  
  // Adjust based on source reliability
  switch (source) {
    case OwnershipSource.CODEOWNERS:
      baseScore += 10; // CODEOWNERS is highly reliable
      break;
    case OwnershipSource.MANUAL:
      baseScore += 5; // Manual assignment is reliable
      break;
    case OwnershipSource.GIT_HISTORY:
      // No adjustment - baseline reliability
      break;
    case OwnershipSource.AUTO_ASSIGNED:
      baseScore -= 5; // Auto-assignment is less reliable
      break;
    case OwnershipSource.TEAM_STRUCTURE:
      baseScore -= 3; // Team structure inference is moderately reliable
      break;
  }
  
  return Math.min(Math.max(baseScore, 0), 100);
}

// Placeholder functions for database operations
// In production, these would interact with your database

async function saveOwnershipAssignment(assignment: any): Promise<void> {
  // Save to database (PostgreSQL, MongoDB, etc.)
  // Example:
  // await db.ownershipAssignments.create(assignment);
}

async function removeOwnershipAssignment(path: string): Promise<void> {
  // Remove from database
  // Example:
  // await db.ownershipAssignments.deleteMany({ path });
}

async function getOwnershipAssignments(filters?: any): Promise<any[]> {
  // Get from database with optional filters
  // Example:
  // return await db.ownershipAssignments.find(filters);
  return [];
}