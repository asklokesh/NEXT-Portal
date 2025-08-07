import { NextRequest, NextResponse } from 'next/server';
import { TeamManager, Team, TeamMember, TeamRole, SkillLevel, CapacityStatus } from '@/lib/teams/TeamManager';

/**
 * API endpoint for team management operations
 * GET /api/ownership/teams - List all teams
 * POST /api/ownership/teams - Create a new team
 * PUT /api/ownership/teams - Update a team
 * DELETE /api/ownership/teams - Delete a team
 */

interface CreateTeamRequest {
  name: string;
  description?: string;
  type?: string;
  parentTeamId?: string;
  domains?: string[];
  technologies?: string[];
}

interface UpdateTeamRequest {
  id: string;
  name?: string;
  description?: string;
  domains?: string[];
  technologies?: string[];
  settings?: {
    autoAssignmentEnabled?: boolean;
    workloadBalancing?: boolean;
    crossTrainingEnabled?: boolean;
    rotationEnabled?: boolean;
  };
}

interface AddMemberRequest {
  teamId: string;
  member: {
    name: string;
    email: string;
    role?: TeamRole;
    skills?: Array<{ name: string; level: SkillLevel }>;
    expertise?: string[];
    capacity?: {
      maxCapacity?: number;
      currentLoad?: number;
    };
  };
}

// Initialize team manager (in production, this would be a singleton)
let teamManager: TeamManager;

function initTeamManager() {
  if (!teamManager) {
    teamManager = new TeamManager();
    // Initialize with some sample teams for development
    initializeSampleTeams();
  }
}

export async function GET(request: NextRequest) {
  try {
    initTeamManager();
    
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('id');
    const includeAnalytics = searchParams.get('analytics') === 'true';
    const includeMembers = searchParams.get('members') === 'true';
    
    if (teamId) {
      // Get specific team
      const team = teamManager.getTeam(teamId);
      if (!team) {
        return NextResponse.json(
          { success: false, message: 'Team not found' },
          { status: 404 }
        );
      }
      
      let analytics = null;
      if (includeAnalytics) {
        analytics = await teamManager.getTeamAnalytics(teamId);
      }
      
      return NextResponse.json({
        success: true,
        team: formatTeamResponse(team, includeMembers),
        analytics
      });
    } else {
      // Get all teams
      const teams = teamManager.getAllTeams();
      const hierarchy = teamManager.getTeamHierarchy();
      
      return NextResponse.json({
        success: true,
        teams: teams.map(team => formatTeamResponse(team, includeMembers)),
        hierarchy: hierarchy ? formatHierarchyResponse(hierarchy) : null,
        totalTeams: teams.length,
        activeTeams: teams.filter(t => t.members.size > 0).length
      });
    }
    
  } catch (error) {
    console.error('Error in teams GET:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error retrieving teams',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    initTeamManager();
    
    const body: CreateTeamRequest = await request.json();
    
    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { success: false, message: 'Team name is required' },
        { status: 400 }
      );
    }
    
    // Check if team name already exists
    const existingTeams = teamManager.getAllTeams();
    const nameExists = existingTeams.some(team => 
      team.name.toLowerCase() === body.name.toLowerCase()
    );
    
    if (nameExists) {
      return NextResponse.json(
        { success: false, message: 'Team name already exists' },
        { status: 409 }
      );
    }
    
    // Validate parent team if specified
    if (body.parentTeamId) {
      const parentTeam = teamManager.getTeam(body.parentTeamId);
      if (!parentTeam) {
        return NextResponse.json(
          { success: false, message: 'Parent team not found' },
          { status: 404 }
        );
      }
    }
    
    // Create the team
    const team = await teamManager.createTeam({
      name: body.name,
      description: body.description || '',
      type: body.type as any || 'feature_team',
      parentTeamId: body.parentTeamId,
      domains: body.domains || [],
      technologies: body.technologies || []
    });
    
    console.log(`Team created: ${team.name} (${team.id})`);
    
    return NextResponse.json({
      success: true,
      message: `Team ${team.name} created successfully`,
      team: formatTeamResponse(team, false)
    });
    
  } catch (error) {
    console.error('Error creating team:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error creating team',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    initTeamManager();
    
    const body: UpdateTeamRequest = await request.json();
    
    if (!body.id) {
      return NextResponse.json(
        { success: false, message: 'Team ID is required' },
        { status: 400 }
      );
    }
    
    const team = teamManager.getTeam(body.id);
    if (!team) {
      return NextResponse.json(
        { success: false, message: 'Team not found' },
        { status: 404 }
      );
    }
    
    // Update team properties
    if (body.name) team.name = body.name;
    if (body.description !== undefined) team.description = body.description;
    if (body.domains) team.domains = body.domains;
    if (body.technologies) team.technologies = body.technologies;
    if (body.settings) {
      team.settings = { ...team.settings, ...body.settings };
    }
    
    team.updatedAt = new Date();
    
    console.log(`Team updated: ${team.name} (${team.id})`);
    
    return NextResponse.json({
      success: true,
      message: `Team ${team.name} updated successfully`,
      team: formatTeamResponse(team, false)
    });
    
  } catch (error) {
    console.error('Error updating team:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error updating team',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    initTeamManager();
    
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('id');
    
    if (!teamId) {
      return NextResponse.json(
        { success: false, message: 'Team ID is required' },
        { status: 400 }
      );
    }
    
    const team = teamManager.getTeam(teamId);
    if (!team) {
      return NextResponse.json(
        { success: false, message: 'Team not found' },
        { status: 404 }
      );
    }
    
    // Check if team has members
    if (team.members.size > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Cannot delete team with active members. Remove members first.' 
        },
        { status: 409 }
      );
    }
    
    // Check if team has child teams
    const allTeams = teamManager.getAllTeams();
    const hasChildren = allTeams.some(t => t.parentTeamId === teamId);
    
    if (hasChildren) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Cannot delete team with child teams. Reassign child teams first.' 
        },
        { status: 409 }
      );
    }
    
    // In production, remove from database
    // await deleteTeamFromDatabase(teamId);
    
    console.log(`Team deleted: ${team.name} (${teamId})`);
    
    return NextResponse.json({
      success: true,
      message: `Team ${team.name} deleted successfully`
    });
    
  } catch (error) {
    console.error('Error deleting team:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error deleting team',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Helper functions

function formatTeamResponse(team: Team, includeMembers: boolean = false) {
  const response: any = {
    id: team.id,
    name: team.name,
    description: team.description,
    type: team.type,
    parentTeamId: team.parentTeamId,
    memberCount: team.members.size,
    domains: team.domains,
    technologies: team.technologies,
    capacity: {
      totalCapacity: team.capacity.totalCapacity,
      usedCapacity: team.capacity.usedCapacity,
      availableCapacity: team.capacity.availableCapacity,
      utilization: team.capacity.totalCapacity > 0 
        ? Math.round((team.capacity.usedCapacity / team.capacity.totalCapacity) * 100) 
        : 0
    },
    metrics: {
      averageResponseTime: team.metrics.averageResponseTime,
      throughput: team.metrics.throughput,
      qualityScore: team.metrics.qualityScore,
      collaborationScore: team.metrics.collaborationScore,
      knowledgeSpread: team.metrics.knowledgeSpread
    },
    settings: team.settings,
    responsibilityCount: team.responsibilities.length,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
    recentActivity: getRecentActivitySummary(team),
    expertiseAreas: getTeamExpertiseAreas(team),
    primaryDomains: team.domains.slice(0, 3)
  };
  
  if (includeMembers) {
    response.members = Array.from(team.members.values()).map(formatMemberResponse);
  }
  
  return response;
}

function formatMemberResponse(member: TeamMember) {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    isActive: member.isActive,
    joinedAt: member.joinedAt.toISOString(),
    skills: Array.from(member.skills.entries()).map(([skill, level]) => ({
      name: skill,
      level
    })),
    expertise: member.expertise,
    capacity: {
      status: member.capacity.status,
      currentLoad: member.capacity.currentLoad,
      maxCapacity: member.capacity.maxCapacity,
      utilization: Math.round((member.capacity.currentLoad / member.capacity.maxCapacity) * 100),
      availableFrom: member.capacity.availableFrom?.toISOString()
    },
    preferences: member.preferences,
    metrics: {
      totalCommits: member.metrics.totalCommits,
      averageResponseTime: member.metrics.averageResponseTime,
      reviewThroughput: member.metrics.reviewThroughput,
      mentoringHours: member.metrics.mentoringHours,
      lastActiveDate: member.metrics.lastActiveDate.toISOString()
    }
  };
}

function formatHierarchyResponse(hierarchy: any): any {
  return {
    team: formatTeamResponse(hierarchy.team, false),
    children: hierarchy.children.map(formatHierarchyResponse),
    level: hierarchy.level
  };
}

function getRecentActivitySummary(team: Team): string {
  // In production, this would check actual activity from database
  const daysSinceUpdate = Math.floor((Date.now() - team.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceUpdate === 0) return 'Today';
  if (daysSinceUpdate === 1) return 'Yesterday';
  if (daysSinceUpdate < 7) return `${daysSinceUpdate} days ago`;
  if (daysSinceUpdate < 30) return `${Math.floor(daysSinceUpdate / 7)} weeks ago`;
  return `${Math.floor(daysSinceUpdate / 30)} months ago`;
}

function getTeamExpertiseAreas(team: Team): string[] {
  const expertiseAreas = new Set<string>();
  
  // Add domains as expertise areas
  team.domains.forEach(domain => expertiseAreas.add(domain));
  
  // Add technologies as expertise areas
  team.technologies.forEach(tech => expertiseAreas.add(tech));
  
  // Add member expertise
  for (const member of team.members.values()) {
    member.expertise.forEach(area => expertiseAreas.add(area));
  }
  
  return Array.from(expertiseAreas).slice(0, 8); // Limit to top 8
}

async function initializeSampleTeams() {
  try {
    // Create sample teams for development/demo
    const frontendTeam = await teamManager.createTeam({
      name: 'Frontend Team',
      description: 'Responsible for user interface and user experience',
      type: 'feature_team' as any,
      domains: ['frontend', 'ui', 'ux'],
      technologies: ['react', 'typescript', 'css', 'next.js']
    });
    
    const backendTeam = await teamManager.createTeam({
      name: 'Backend Team',
      description: 'Responsible for server-side logic and APIs',
      type: 'feature_team' as any,
      domains: ['backend', 'api', 'database'],
      technologies: ['node.js', 'typescript', 'postgresql', 'redis']
    });
    
    const devopsTeam = await teamManager.createTeam({
      name: 'DevOps Team',
      description: 'Responsible for infrastructure and deployment',
      type: 'platform_team' as any,
      domains: ['infrastructure', 'deployment', 'monitoring'],
      technologies: ['kubernetes', 'docker', 'terraform', 'prometheus']
    });
    
    // Add sample members
    await teamManager.addTeamMember(frontendTeam.id, {
      name: 'Alice Frontend',
      email: 'alice@example.com',
      role: TeamRole.LEAD,
      skills: new Map([
        ['react', SkillLevel.EXPERT],
        ['typescript', SkillLevel.ADVANCED],
        ['css', SkillLevel.ADVANCED]
      ]),
      expertise: ['frontend', 'ui', 'accessibility'],
      capacity: {
        status: CapacityStatus.AVAILABLE,
        currentLoad: 70,
        maxCapacity: 40
      }
    });
    
    await teamManager.addTeamMember(backendTeam.id, {
      name: 'Bob Backend',
      email: 'bob@example.com',
      role: TeamRole.LEAD,
      skills: new Map([
        ['node.js', SkillLevel.EXPERT],
        ['typescript', SkillLevel.EXPERT],
        ['postgresql', SkillLevel.ADVANCED]
      ]),
      expertise: ['backend', 'api', 'database'],
      capacity: {
        status: CapacityStatus.BUSY,
        currentLoad: 85,
        maxCapacity: 40
      }
    });
    
    console.log('Sample teams initialized');
  } catch (error) {
    console.error('Error initializing sample teams:', error);
  }
}