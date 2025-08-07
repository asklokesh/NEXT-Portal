/**
 * Team hierarchy and management system for ownership assignments
 */

/**
 * Team member role and permission levels
 */
export enum TeamRole {
  LEAD = 'lead',
  SENIOR = 'senior',
  MEMBER = 'member',
  CONTRIBUTOR = 'contributor',
  OBSERVER = 'observer'
}

/**
 * Team member skill proficiency levels
 */
export enum SkillLevel {
  EXPERT = 'expert',      // 4+ years experience
  ADVANCED = 'advanced',  // 2-4 years experience
  INTERMEDIATE = 'intermediate', // 1-2 years experience
  BEGINNER = 'beginner',  // <1 year experience
  LEARNING = 'learning'   // Currently learning
}

/**
 * Team capacity status for workload management
 */
export enum CapacityStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  OVERLOADED = 'overloaded',
  UNAVAILABLE = 'unavailable'
}

/**
 * Responsibility types within teams
 */
export enum ResponsibilityType {
  PRIMARY = 'primary',         // Primary owner/maintainer
  SECONDARY = 'secondary',     // Secondary owner/backup
  REVIEWER = 'reviewer',       // Code review responsibilities  
  CONSULTANT = 'consultant',   // Domain expert consultation
  OBSERVER = 'observer'        // Monitoring/awareness only
}

/**
 * Individual team member information
 */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  joinedAt: Date;
  isActive: boolean;
  skills: Map<string, SkillLevel>;
  expertise: string[]; // Domain areas of expertise
  capacity: {
    status: CapacityStatus;
    currentLoad: number; // 0-100 percentage
    maxCapacity: number; // Hours per sprint/week
    availableFrom?: Date;
  };
  preferences: {
    domains: string[]; // Preferred work domains
    technologies: string[]; // Preferred technologies
    workTypes: string[]; // e.g., 'development', 'review', 'mentoring'
  };
  metrics: {
    totalCommits: number;
    averageResponseTime: number; // hours
    reviewThroughput: number; // reviews per week
    mentoringHours: number; // per month
    lastActiveDate: Date;
  };
}

/**
 * Team structure and information
 */
export interface Team {
  id: string;
  name: string;
  description: string;
  type: TeamType;
  parentTeamId?: string; // For hierarchical teams
  members: Map<string, TeamMember>;
  responsibilities: TeamResponsibility[];
  domains: string[]; // Technical/business domains
  technologies: string[]; // Primary technologies
  capacity: {
    totalCapacity: number;
    usedCapacity: number;
    availableCapacity: number;
    sprintCapacity: number;
  };
  metrics: {
    averageResponseTime: number;
    throughput: number; // tasks/features per sprint
    qualityScore: number; // 0-100 based on defects, reviews, etc.
    collaborationScore: number; // cross-team collaboration frequency
    knowledgeSpread: number; // how distributed expertise is
  };
  settings: {
    autoAssignmentEnabled: boolean;
    workloadBalancing: boolean;
    crossTrainingEnabled: boolean;
    rotationEnabled: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Team types for different organizational structures
 */
export enum TeamType {
  FEATURE_TEAM = 'feature_team',
  PLATFORM_TEAM = 'platform_team',
  SUPPORT_TEAM = 'support_team',
  GUILD = 'guild',
  WORKING_GROUP = 'working_group',
  DEPARTMENT = 'department'
}

/**
 * Team responsibility assignment
 */
export interface TeamResponsibility {
  id: string;
  type: ResponsibilityType;
  scope: string; // e.g., "frontend/components/*", "user-service"
  description: string;
  assignedMemberIds: string[];
  priority: number; // 1-10
  timeAllocation: number; // percentage of team capacity
  skills: string[]; // required skills
  automated: boolean; // whether auto-assignment applies
  createdAt: Date;
  reviewDate?: Date; // when to review this responsibility
}

/**
 * Team hierarchy node for organizational structure
 */
export interface TeamHierarchy {
  team: Team;
  children: TeamHierarchy[];
  parent?: TeamHierarchy;
  level: number;
}

/**
 * Skill and expertise mapping for the organization
 */
export interface SkillMatrix {
  skills: Map<string, {
    category: string;
    description: string;
    levels: Map<SkillLevel, string>; // level descriptions
    relatedSkills: string[];
    demand: number; // organizational demand score 1-10
  }>;
  expertiseAreas: Map<string, {
    description: string;
    requiredSkills: string[];
    teams: string[];
    criticality: number; // business criticality 1-10
  }>;
}

/**
 * Workload assignment and tracking
 */
export interface WorkloadAssignment {
  id: string;
  teamId: string;
  memberId: string;
  taskId: string;
  taskType: string;
  estimatedHours: number;
  actualHours?: number;
  assignedAt: Date;
  dueDate?: Date;
  completedAt?: Date;
  status: 'assigned' | 'in_progress' | 'review' | 'completed' | 'blocked';
  priority: number;
  skills: string[];
}

/**
 * Comprehensive team management system
 */
export class TeamManager {
  private teams: Map<string, Team> = new Map();
  private members: Map<string, TeamMember> = new Map();
  private hierarchy: TeamHierarchy | null = null;
  private skillMatrix: SkillMatrix;
  private workloadAssignments: Map<string, WorkloadAssignment> = new Map();
  private responsibilityMatrix: Map<string, TeamResponsibility[]> = new Map();

  constructor() {
    this.skillMatrix = this.initializeSkillMatrix();
  }

  /**
   * Create a new team with basic configuration
   */
  async createTeam(teamData: Partial<Team>): Promise<Team> {
    const team: Team = {
      id: teamData.id || this.generateId(),
      name: teamData.name || 'Unnamed Team',
      description: teamData.description || '',
      type: teamData.type || TeamType.FEATURE_TEAM,
      parentTeamId: teamData.parentTeamId,
      members: new Map(),
      responsibilities: [],
      domains: teamData.domains || [],
      technologies: teamData.technologies || [],
      capacity: {
        totalCapacity: 0,
        usedCapacity: 0,
        availableCapacity: 0,
        sprintCapacity: 0
      },
      metrics: {
        averageResponseTime: 0,
        throughput: 0,
        qualityScore: 100,
        collaborationScore: 0,
        knowledgeSpread: 0
      },
      settings: {
        autoAssignmentEnabled: true,
        workloadBalancing: true,
        crossTrainingEnabled: false,
        rotationEnabled: false
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.teams.set(team.id, team);
    await this.rebuildHierarchy();
    return team;
  }

  /**
   * Add a member to a team with role and skills
   */
  async addTeamMember(teamId: string, memberData: Partial<TeamMember>): Promise<TeamMember> {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    const member: TeamMember = {
      id: memberData.id || this.generateId(),
      name: memberData.name || 'Unknown Member',
      email: memberData.email || '',
      role: memberData.role || TeamRole.MEMBER,
      joinedAt: memberData.joinedAt || new Date(),
      isActive: memberData.isActive !== false,
      skills: memberData.skills || new Map(),
      expertise: memberData.expertise || [],
      capacity: {
        status: CapacityStatus.AVAILABLE,
        currentLoad: 0,
        maxCapacity: 40, // 40 hours per week default
        ...memberData.capacity
      },
      preferences: {
        domains: [],
        technologies: [],
        workTypes: ['development'],
        ...memberData.preferences
      },
      metrics: {
        totalCommits: 0,
        averageResponseTime: 24,
        reviewThroughput: 5,
        mentoringHours: 0,
        lastActiveDate: new Date(),
        ...memberData.metrics
      }
    };

    team.members.set(member.id, member);
    this.members.set(member.id, member);
    await this.updateTeamCapacity(teamId);
    
    return member;
  }

  /**
   * Track and manage team capacity and workload
   */
  async updateTeamCapacity(teamId: string): Promise<void> {
    const team = this.teams.get(teamId);
    if (!team) return;

    let totalCapacity = 0;
    let usedCapacity = 0;

    for (const member of team.members.values()) {
      if (member.isActive && member.capacity.status !== CapacityStatus.UNAVAILABLE) {
        totalCapacity += member.capacity.maxCapacity;
        usedCapacity += (member.capacity.currentLoad / 100) * member.capacity.maxCapacity;
      }
    }

    team.capacity = {
      totalCapacity,
      usedCapacity,
      availableCapacity: totalCapacity - usedCapacity,
      sprintCapacity: totalCapacity * 0.8 // Account for meetings, admin tasks
    };

    team.updatedAt = new Date();
  }

  /**
   * Create and manage responsibility assignments
   */
  async assignResponsibility(
    teamId: string,
    responsibility: Omit<TeamResponsibility, 'id' | 'createdAt'>
  ): Promise<TeamResponsibility> {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    const newResponsibility: TeamResponsibility = {
      id: this.generateId(),
      createdAt: new Date(),
      ...responsibility
    };

    team.responsibilities.push(newResponsibility);
    
    // Update team responsibility matrix
    if (!this.responsibilityMatrix.has(teamId)) {
      this.responsibilityMatrix.set(teamId, []);
    }
    this.responsibilityMatrix.get(teamId)!.push(newResponsibility);

    return newResponsibility;
  }

  /**
   * Build and maintain team hierarchy
   */
  async rebuildHierarchy(): Promise<TeamHierarchy | null> {
    const rootTeams = Array.from(this.teams.values()).filter(team => !team.parentTeamId);
    
    if (rootTeams.length === 0) {
      this.hierarchy = null;
      return null;
    }

    // For simplicity, use first root team as hierarchy root
    // In practice, you might have multiple hierarchies or a virtual root
    const rootTeam = rootTeams[0];
    this.hierarchy = await this.buildHierarchyNode(rootTeam, null, 0);
    
    return this.hierarchy;
  }

  /**
   * Get team hierarchy with depth and relationships
   */
  getTeamHierarchy(): TeamHierarchy | null {
    return this.hierarchy;
  }

  /**
   * Find optimal team for assignment based on skills, capacity, and preferences
   */
  async findOptimalTeam(requirements: {
    skills: string[];
    domain?: string;
    workload: number; // hours
    priority: number;
    preferredTeams?: string[];
  }): Promise<{
    team: Team;
    members: TeamMember[];
    confidence: number;
    reasoning: string;
  } | null> {
    const candidates: Array<{
      team: Team;
      score: number;
      members: TeamMember[];
      reasoning: string[];
    }> = [];

    for (const team of this.teams.values()) {
      // Skip teams without capacity
      if (team.capacity.availableCapacity < requirements.workload) {
        continue;
      }

      let score = 0;
      const reasoning: string[] = [];
      const suitableMembers: TeamMember[] = [];

      // Skill matching
      const teamSkills = this.getTeamSkills(team);
      const skillMatches = requirements.skills.filter(skill => teamSkills.has(skill));
      const skillScore = (skillMatches.length / requirements.skills.length) * 40;
      score += skillScore;
      if (skillScore > 0) {
        reasoning.push(`${skillMatches.length}/${requirements.skills.length} required skills available`);
      }

      // Domain expertise
      if (requirements.domain && team.domains.includes(requirements.domain)) {
        score += 20;
        reasoning.push(`Team has domain expertise in ${requirements.domain}`);
      }

      // Capacity availability
      const capacityRatio = team.capacity.availableCapacity / team.capacity.totalCapacity;
      const capacityScore = capacityRatio * 20;
      score += capacityScore;
      reasoning.push(`${Math.round(capacityRatio * 100)}% capacity available`);

      // Team preferences
      if (requirements.preferredTeams?.includes(team.id)) {
        score += 15;
        reasoning.push('Preferred team for this type of work');
      }

      // Team performance metrics
      const performanceScore = (team.metrics.qualityScore / 100) * 10;
      score += performanceScore;

      // Find suitable members within team
      for (const member of team.members.values()) {
        if (member.isActive && member.capacity.status === CapacityStatus.AVAILABLE) {
          const memberSkillScore = requirements.skills.filter(skill => 
            member.skills.has(skill) && 
            member.skills.get(skill) !== SkillLevel.LEARNING
          ).length;
          
          if (memberSkillScore > 0) {
            suitableMembers.push(member);
          }
        }
      }

      if (suitableMembers.length > 0) {
        score += Math.min(suitableMembers.length * 5, 15); // Bonus for member availability
        reasoning.push(`${suitableMembers.length} suitable team members available`);
      }

      candidates.push({ team, score, members: suitableMembers, reasoning });
    }

    // Sort by score and return best match
    candidates.sort((a, b) => b.score - a.score);
    
    if (candidates.length > 0 && candidates[0].score > 30) { // Minimum threshold
      const best = candidates[0];
      return {
        team: best.team,
        members: best.members,
        confidence: Math.min(best.score, 100),
        reasoning: best.reasoning.join('; ')
      };
    }

    return null;
  }

  /**
   * Balance workload across team members
   */
  async balanceWorkload(teamId: string): Promise<{
    assignments: WorkloadAssignment[];
    rebalanced: boolean;
    recommendations: string[];
  }> {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    const activeMembers = Array.from(team.members.values())
      .filter(m => m.isActive && m.capacity.status !== CapacityStatus.UNAVAILABLE);

    if (activeMembers.length === 0) {
      return { assignments: [], rebalanced: false, recommendations: ['No active team members available'] };
    }

    // Get current assignments for this team
    const teamAssignments = Array.from(this.workloadAssignments.values())
      .filter(assignment => assignment.teamId === teamId && assignment.status !== 'completed');

    // Calculate current workload distribution
    const memberWorkloads = new Map<string, number>();
    activeMembers.forEach(member => {
      const memberAssignments = teamAssignments.filter(a => a.memberId === member.id);
      const totalHours = memberAssignments.reduce((sum, a) => sum + a.estimatedHours, 0);
      memberWorkloads.set(member.id, totalHours);
    });

    // Identify imbalances
    const workloads = Array.from(memberWorkloads.values());
    const averageWorkload = workloads.reduce((sum, load) => sum + load, 0) / workloads.length;
    const maxWorkload = Math.max(...workloads);
    const minWorkload = Math.min(...workloads);
    
    const recommendations: string[] = [];
    let rebalanced = false;

    // Check for significant imbalance (>20% difference from average)
    if (maxWorkload - minWorkload > averageWorkload * 0.4) {
      recommendations.push('Significant workload imbalance detected');
      
      // Find overloaded and underloaded members
      const overloaded = activeMembers.filter(m => 
        memberWorkloads.get(m.id)! > averageWorkload * 1.2
      );
      const underloaded = activeMembers.filter(m => 
        memberWorkloads.get(m.id)! < averageWorkload * 0.8
      );

      if (overloaded.length > 0 && underloaded.length > 0) {
        recommendations.push(`Consider reassigning work from ${overloaded.map(m => m.name).join(', ')} to ${underloaded.map(m => m.name).join(', ')}`);
        rebalanced = true;
      }
    }

    // Check individual capacity limits
    for (const member of activeMembers) {
      const currentLoad = memberWorkloads.get(member.id)!;
      const capacity = member.capacity.maxCapacity;
      
      if (currentLoad > capacity * 0.9) {
        recommendations.push(`${member.name} is approaching capacity limit (${currentLoad}/${capacity} hours)`);
        member.capacity.status = CapacityStatus.BUSY;
      } else if (currentLoad > capacity) {
        recommendations.push(`${member.name} is over capacity (${currentLoad}/${capacity} hours)`);
        member.capacity.status = CapacityStatus.OVERLOADED;
      }
    }

    return {
      assignments: teamAssignments,
      rebalanced,
      recommendations
    };
  }

  /**
   * Get comprehensive team analytics and insights
   */
  async getTeamAnalytics(teamId: string): Promise<{
    overview: {
      memberCount: number;
      activeMembers: number;
      capacityUtilization: number;
      skillCoverage: Map<string, number>;
    };
    performance: {
      throughput: number;
      responseTime: number;
      qualityScore: number;
      collaborationIndex: number;
    };
    risks: {
      singlePointsOfFailure: string[];
      skillGaps: string[];
      capacityRisks: string[];
      knowledgeConcentration: Map<string, string[]>;
    };
    recommendations: string[];
  }> {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error(`Team ${teamId} not found`);
    }

    const activeMembers = Array.from(team.members.values()).filter(m => m.isActive);
    const skillCoverage = this.calculateSkillCoverage(team);
    
    // Calculate performance metrics
    const avgResponseTime = activeMembers.length > 0 
      ? activeMembers.reduce((sum, m) => sum + m.metrics.averageResponseTime, 0) / activeMembers.length
      : 0;

    // Identify risks
    const singlePointsOfFailure: string[] = [];
    const skillGaps: string[] = [];
    const capacityRisks: string[] = [];
    const knowledgeConcentration = new Map<string, string[]>();

    // Check for single points of failure (skills held by only one person)
    for (const [skill, memberCount] of skillCoverage) {
      if (memberCount === 1) {
        const skillHolder = activeMembers.find(m => 
          m.skills.has(skill) && m.skills.get(skill) !== SkillLevel.LEARNING
        );
        if (skillHolder) {
          singlePointsOfFailure.push(`${skill} (only ${skillHolder.name})`);
          
          if (!knowledgeConcentration.has(skillHolder.name)) {
            knowledgeConcentration.set(skillHolder.name, []);
          }
          knowledgeConcentration.get(skillHolder.name)!.push(skill);
        }
      }
    }

    // Check for required skills missing from team
    const requiredSkills = this.getRequiredSkillsForDomains(team.domains);
    for (const skill of requiredSkills) {
      if (!skillCoverage.has(skill) || skillCoverage.get(skill)! === 0) {
        skillGaps.push(skill);
      }
    }

    // Check capacity risks
    const overloadedMembers = activeMembers.filter(m => 
      m.capacity.status === CapacityStatus.OVERLOADED
    );
    if (overloadedMembers.length > 0) {
      capacityRisks.push(`${overloadedMembers.length} members overloaded`);
    }

    if (team.capacity.availableCapacity < team.capacity.totalCapacity * 0.1) {
      capacityRisks.push('Very low available capacity (<10%)');
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (singlePointsOfFailure.length > 0) {
      recommendations.push('Cross-train team members to reduce single points of failure');
    }
    
    if (skillGaps.length > 0) {
      recommendations.push(`Address skill gaps: ${skillGaps.slice(0, 3).join(', ')}`);
    }
    
    if (capacityRisks.length > 0) {
      recommendations.push('Consider adding team members or redistributing workload');
    }

    if (team.metrics.qualityScore < 80) {
      recommendations.push('Focus on improving code quality and review processes');
    }

    return {
      overview: {
        memberCount: team.members.size,
        activeMembers: activeMembers.length,
        capacityUtilization: (team.capacity.usedCapacity / team.capacity.totalCapacity) * 100,
        skillCoverage
      },
      performance: {
        throughput: team.metrics.throughput,
        responseTime: avgResponseTime,
        qualityScore: team.metrics.qualityScore,
        collaborationIndex: team.metrics.collaborationScore
      },
      risks: {
        singlePointsOfFailure,
        skillGaps,
        capacityRisks,
        knowledgeConcentration
      },
      recommendations
    };
  }

  // Private helper methods

  private async buildHierarchyNode(
    team: Team, 
    parent: TeamHierarchy | null, 
    level: number
  ): Promise<TeamHierarchy> {
    const node: TeamHierarchy = {
      team,
      children: [],
      parent: parent || undefined,
      level
    };

    // Find child teams
    const children = Array.from(this.teams.values())
      .filter(t => t.parentTeamId === team.id);

    for (const child of children) {
      const childNode = await this.buildHierarchyNode(child, node, level + 1);
      node.children.push(childNode);
    }

    return node;
  }

  private getTeamSkills(team: Team): Map<string, number> {
    const skills = new Map<string, number>();
    
    for (const member of team.members.values()) {
      if (!member.isActive) continue;
      
      for (const [skill, level] of member.skills) {
        if (level !== SkillLevel.LEARNING) {
          skills.set(skill, (skills.get(skill) || 0) + 1);
        }
      }
    }

    return skills;
  }

  private calculateSkillCoverage(team: Team): Map<string, number> {
    return this.getTeamSkills(team);
  }

  private getRequiredSkillsForDomains(domains: string[]): string[] {
    const requiredSkills: string[] = [];
    
    for (const domain of domains) {
      const expertiseArea = this.skillMatrix.expertiseAreas.get(domain);
      if (expertiseArea) {
        requiredSkills.push(...expertiseArea.requiredSkills);
      }
    }

    return [...new Set(requiredSkills)];
  }

  private initializeSkillMatrix(): SkillMatrix {
    const skills = new Map([
      ['typescript', {
        category: 'Programming Languages',
        description: 'TypeScript development',
        levels: new Map([
          [SkillLevel.BEGINNER, 'Basic syntax and types'],
          [SkillLevel.INTERMEDIATE, 'Advanced types and patterns'],
          [SkillLevel.ADVANCED, 'Complex type systems and generics'],
          [SkillLevel.EXPERT, 'Type system design and tooling']
        ]),
        relatedSkills: ['javascript', 'react', 'node.js'],
        demand: 9
      }],
      ['react', {
        category: 'Frontend Frameworks',
        description: 'React development',
        levels: new Map([
          [SkillLevel.BEGINNER, 'Basic components and hooks'],
          [SkillLevel.INTERMEDIATE, 'State management and performance'],
          [SkillLevel.ADVANCED, 'Custom hooks and patterns'],
          [SkillLevel.EXPERT, 'Framework architecture and optimization']
        ]),
        relatedSkills: ['typescript', 'html', 'css', 'testing'],
        demand: 8
      }],
      ['devops', {
        category: 'Infrastructure',
        description: 'DevOps and infrastructure management',
        levels: new Map([
          [SkillLevel.BEGINNER, 'Basic CI/CD and deployment'],
          [SkillLevel.INTERMEDIATE, 'Container orchestration'],
          [SkillLevel.ADVANCED, 'Infrastructure as code'],
          [SkillLevel.EXPERT, 'Platform engineering and automation']
        ]),
        relatedSkills: ['kubernetes', 'docker', 'terraform', 'monitoring'],
        demand: 7
      }]
    ]);

    const expertiseAreas = new Map([
      ['frontend', {
        description: 'Frontend development and user interfaces',
        requiredSkills: ['typescript', 'react', 'css', 'testing'],
        teams: ['frontend-team'],
        criticality: 8
      }],
      ['backend', {
        description: 'Backend services and APIs',
        requiredSkills: ['typescript', 'node.js', 'databases', 'testing'],
        teams: ['backend-team'],
        criticality: 9
      }],
      ['infrastructure', {
        description: 'Platform and infrastructure management',
        requiredSkills: ['devops', 'kubernetes', 'monitoring', 'security'],
        teams: ['platform-team', 'devops-team'],
        criticality: 10
      }]
    ]);

    return { skills, expertiseAreas };
  }

  private generateId(): string {
    return `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public getter methods for external access
  
  getTeam(teamId: string): Team | undefined {
    return this.teams.get(teamId);
  }

  getAllTeams(): Team[] {
    return Array.from(this.teams.values());
  }

  getMember(memberId: string): TeamMember | undefined {
    return this.members.get(memberId);
  }

  getTeamMembers(teamId: string): TeamMember[] {
    const team = this.teams.get(teamId);
    return team ? Array.from(team.members.values()) : [];
  }

  getSkillMatrix(): SkillMatrix {
    return this.skillMatrix;
  }
}