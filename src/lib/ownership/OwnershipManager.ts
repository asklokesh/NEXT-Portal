import { simpleGit, SimpleGit } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Ownership confidence levels for auto-assignment decisions
 */
export enum OwnershipConfidence {
  HIGH = 'high',        // 80-100% confidence
  MEDIUM = 'medium',    // 50-79% confidence  
  LOW = 'low',          // 20-49% confidence
  UNKNOWN = 'unknown'   // 0-19% confidence
}

/**
 * Ownership source types for tracking how ownership was determined
 */
export enum OwnershipSource {
  CODEOWNERS = 'codeowners',
  GIT_HISTORY = 'git_history',
  MANUAL = 'manual',
  AUTO_ASSIGNED = 'auto_assigned',
  TEAM_STRUCTURE = 'team_structure'
}

/**
 * Team ownership assignment with confidence scoring
 */
export interface TeamOwnership {
  teamId: string;
  teamName: string;
  confidence: OwnershipConfidence;
  score: number; // 0-100 numerical confidence score
  source: OwnershipSource;
  contributors: string[];
  lastActive: Date;
  pathPatterns: string[];
  manualOverride?: boolean;
}

/**
 * Ownership conflict when multiple teams have claims
 */
export interface OwnershipConflict {
  id: string;
  path: string;
  conflictingTeams: TeamOwnership[];
  resolutionStrategy: ConflictResolutionStrategy;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  notes?: string;
}

/**
 * Strategies for resolving ownership conflicts
 */
export enum ConflictResolutionStrategy {
  HIGHEST_CONFIDENCE = 'highest_confidence',
  MOST_RECENT_ACTIVITY = 'most_recent_activity',
  MOST_CONTRIBUTORS = 'most_contributors',
  MANUAL_REVIEW = 'manual_review',
  SHARED_OWNERSHIP = 'shared_ownership'
}

/**
 * Auto-assignment rule configuration
 */
export interface AutoAssignmentRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: {
    pathPatterns?: string[];
    fileTypes?: string[];
    repositoryPatterns?: string[];
    minCommits?: number;
    minContributors?: number;
    timeWindow?: number; // days
  };
  actions: {
    assignToTeam?: string;
    requiresApproval?: boolean;
    confidence?: OwnershipConfidence;
  };
}

/**
 * CODEOWNERS file parser result
 */
interface CodeownersEntry {
  pattern: string;
  owners: string[];
  line: number;
}

/**
 * Git commit analysis result
 */
interface CommitAnalysis {
  file: string;
  contributors: Map<string, {
    commits: number;
    lines: number;
    lastCommit: Date;
    firstCommit: Date;
  }>;
  totalCommits: number;
  createdAt: Date;
  lastModified: Date;
}

/**
 * Comprehensive ownership management system with team auto-assignment
 */
export class OwnershipManager {
  private git: SimpleGit;
  private codeownersCache: Map<string, CodeownersEntry[]> = new Map();
  private commitAnalysisCache: Map<string, CommitAnalysis> = new Map();
  private autoAssignmentRules: AutoAssignmentRule[] = [];
  private conflicts: Map<string, OwnershipConflict> = new Map();

  constructor(
    private repositoryPath: string,
    private teamManager?: any // Will be injected later
  ) {
    this.git = simpleGit(repositoryPath);
    this.loadDefaultRules();
  }

  /**
   * Discover teams from CODEOWNERS files across the repository
   */
  async discoverTeamsFromCodeowners(): Promise<Map<string, TeamOwnership>> {
    const teams = new Map<string, TeamOwnership>();
    
    try {
      // Find all CODEOWNERS files
      const codeownersFiles = await this.findCodeownersFiles();
      
      for (const filePath of codeownersFiles) {
        const entries = await this.parseCodeownersFile(filePath);
        
        for (const entry of entries) {
          for (const owner of entry.owners) {
            // Extract team name from GitHub team format (@org/team)
            const teamName = this.extractTeamName(owner);
            if (!teamName) continue;

            const teamId = this.generateTeamId(teamName);
            
            if (!teams.has(teamId)) {
              teams.set(teamId, {
                teamId,
                teamName,
                confidence: OwnershipConfidence.HIGH,
                score: 90,
                source: OwnershipSource.CODEOWNERS,
                contributors: [],
                lastActive: new Date(),
                pathPatterns: []
              });
            }

            const team = teams.get(teamId)!;
            team.pathPatterns.push(entry.pattern);
          }
        }
      }

      return teams;
    } catch (error) {
      console.error('Error discovering teams from CODEOWNERS:', error);
      return new Map();
    }
  }

  /**
   * Analyze Git commit history to identify ownership patterns
   */
  async analyzeGitHistory(filePath: string, timeWindowDays = 90): Promise<CommitAnalysis> {
    const cacheKey = `${filePath}_${timeWindowDays}`;
    
    if (this.commitAnalysisCache.has(cacheKey)) {
      return this.commitAnalysisCache.get(cacheKey)!;
    }

    try {
      const since = new Date();
      since.setDate(since.getDate() - timeWindowDays);

      const log = await this.git.log({
        file: filePath,
        since: since.toISOString(),
        '--format': 'fuller'
      });

      const contributors = new Map<string, {
        commits: number;
        lines: number;
        lastCommit: Date;
        firstCommit: Date;
      }>();

      for (const commit of log.all) {
        const author = commit.author_name;
        const date = new Date(commit.date);

        if (!contributors.has(author)) {
          contributors.set(author, {
            commits: 0,
            lines: 0,
            lastCommit: date,
            firstCommit: date
          });
        }

        const contrib = contributors.get(author)!;
        contrib.commits++;
        contrib.lastCommit = date > contrib.lastCommit ? date : contrib.lastCommit;
        contrib.firstCommit = date < contrib.firstCommit ? date : contrib.firstCommit;

        // Get line changes for this commit
        try {
          const diff = await this.git.show([
            '--format=', 
            '--numstat', 
            commit.hash, 
            '--', 
            filePath
          ]);
          
          const lines = this.parseNumstat(diff);
          contrib.lines += lines.added + lines.deleted;
        } catch (diffError) {
          // Continue if diff fails for this commit
        }
      }

      const analysis: CommitAnalysis = {
        file: filePath,
        contributors,
        totalCommits: log.all.length,
        createdAt: log.all.length > 0 ? new Date(log.all[log.all.length - 1].date) : new Date(),
        lastModified: log.all.length > 0 ? new Date(log.all[0].date) : new Date()
      };

      this.commitAnalysisCache.set(cacheKey, analysis);
      return analysis;
    } catch (error) {
      console.error('Error analyzing git history:', error);
      return {
        file: filePath,
        contributors: new Map(),
        totalCommits: 0,
        createdAt: new Date(),
        lastModified: new Date()
      };
    }
  }

  /**
   * Identify active contributors based on recent commit activity
   */
  async identifyActiveContributors(timeWindowDays = 30): Promise<Map<string, {
    commits: number;
    filesModified: Set<string>;
    teams: string[];
    expertise: string[];
    lastActivity: Date;
  }>> {
    const contributors = new Map();
    
    try {
      const since = new Date();
      since.setDate(since.getDate() - timeWindowDays);

      const log = await this.git.log({
        since: since.toISOString(),
        '--format': 'fuller'
      });

      for (const commit of log.all) {
        const author = commit.author_name;
        const date = new Date(commit.date);

        if (!contributors.has(author)) {
          contributors.set(author, {
            commits: 0,
            filesModified: new Set<string>(),
            teams: [],
            expertise: [],
            lastActivity: date
          });
        }

        const contrib = contributors.get(author);
        contrib.commits++;
        contrib.lastActivity = date > contrib.lastActivity ? date : contrib.lastActivity;

        // Get files modified in this commit
        try {
          const files = await this.git.show(['--format=', '--name-only', commit.hash]);
          const fileList = files.trim().split('\n').filter(f => f);
          
          fileList.forEach(file => {
            contrib.filesModified.add(file);
            // Extract expertise areas from file paths
            const expertise = this.extractExpertiseFromPath(file);
            expertise.forEach(exp => {
              if (!contrib.expertise.includes(exp)) {
                contrib.expertise.push(exp);
              }
            });
          });
        } catch (filesError) {
          // Continue if file listing fails
        }
      }

      return contributors;
    } catch (error) {
      console.error('Error identifying active contributors:', error);
      return new Map();
    }
  }

  /**
   * Detect team boundaries and collaboration patterns
   */
  async detectTeamBoundaries(): Promise<{
    teamClusters: Map<string, string[]>;
    collaborationMatrix: Map<string, Map<string, number>>;
    boundaryFiles: string[];
  }> {
    const teamClusters = new Map<string, string[]>();
    const collaborationMatrix = new Map<string, Map<string, number>>();
    const boundaryFiles: string[] = [];

    try {
      // Analyze collaboration patterns across files
      const files = await this.git.raw(['ls-files']).then(files => 
        files.trim().split('\n').filter(f => f && this.isRelevantFile(f))
      );

      for (const file of files.slice(0, 100)) { // Limit for performance
        const analysis = await this.analyzeGitHistory(file, 180);
        const contributors = Array.from(analysis.contributors.keys());

        // Build collaboration matrix
        for (let i = 0; i < contributors.length; i++) {
          for (let j = i + 1; j < contributors.length; j++) {
            const contributor1 = contributors[i];
            const contributor2 = contributors[j];

            if (!collaborationMatrix.has(contributor1)) {
              collaborationMatrix.set(contributor1, new Map());
            }
            if (!collaborationMatrix.has(contributor2)) {
              collaborationMatrix.set(contributor2, new Map());
            }

            const collab1 = collaborationMatrix.get(contributor1)!;
            const collab2 = collaborationMatrix.get(contributor2)!;

            collab1.set(contributor2, (collab1.get(contributor2) || 0) + 1);
            collab2.set(contributor1, (collab2.get(contributor1) || 0) + 1);
          }
        }

        // Identify boundary files (files modified by multiple potential teams)
        if (contributors.length > 3) {
          boundaryFiles.push(file);
        }
      }

      // Cluster contributors into teams based on collaboration frequency
      const processed = new Set<string>();
      let teamId = 0;

      for (const [contributor, collabs] of collaborationMatrix) {
        if (processed.has(contributor)) continue;

        const team = [contributor];
        processed.add(contributor);

        // Find closely collaborating contributors
        const sortedCollabs = Array.from(collabs.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5); // Top 5 collaborators

        for (const [collaborator, frequency] of sortedCollabs) {
          if (!processed.has(collaborator) && frequency > 2) {
            team.push(collaborator);
            processed.add(collaborator);
          }
        }

        if (team.length > 1) {
          teamClusters.set(`auto-team-${teamId++}`, team);
        }
      }

      return { teamClusters, collaborationMatrix, boundaryFiles };
    } catch (error) {
      console.error('Error detecting team boundaries:', error);
      return { 
        teamClusters: new Map(), 
        collaborationMatrix: new Map(), 
        boundaryFiles: [] 
      };
    }
  }

  /**
   * Resolve ownership conflicts using configured strategies
   */
  async resolveOwnershipConflicts(
    conflicts: OwnershipConflict[],
    strategy = ConflictResolutionStrategy.HIGHEST_CONFIDENCE
  ): Promise<Map<string, TeamOwnership>> {
    const resolutions = new Map<string, TeamOwnership>();

    for (const conflict of conflicts) {
      let resolvedTeam: TeamOwnership;

      switch (strategy) {
        case ConflictResolutionStrategy.HIGHEST_CONFIDENCE:
          resolvedTeam = conflict.conflictingTeams.reduce((prev, current) =>
            current.score > prev.score ? current : prev
          );
          break;

        case ConflictResolutionStrategy.MOST_RECENT_ACTIVITY:
          resolvedTeam = conflict.conflictingTeams.reduce((prev, current) =>
            current.lastActive > prev.lastActive ? current : prev
          );
          break;

        case ConflictResolutionStrategy.MOST_CONTRIBUTORS:
          resolvedTeam = conflict.conflictingTeams.reduce((prev, current) =>
            current.contributors.length > prev.contributors.length ? current : prev
          );
          break;

        case ConflictResolutionStrategy.SHARED_OWNERSHIP:
          // Create a merged ownership entry
          resolvedTeam = {
            teamId: `shared-${conflict.conflictingTeams.map(t => t.teamId).join('-')}`,
            teamName: `Shared: ${conflict.conflictingTeams.map(t => t.teamName).join(', ')}`,
            confidence: OwnershipConfidence.MEDIUM,
            score: Math.max(...conflict.conflictingTeams.map(t => t.score)) - 10,
            source: OwnershipSource.AUTO_ASSIGNED,
            contributors: [...new Set(conflict.conflictingTeams.flatMap(t => t.contributors))],
            lastActive: new Date(Math.max(...conflict.conflictingTeams.map(t => t.lastActive.getTime()))),
            pathPatterns: [...new Set(conflict.conflictingTeams.flatMap(t => t.pathPatterns))]
          };
          break;

        default:
          resolvedTeam = conflict.conflictingTeams[0];
      }

      resolutions.set(conflict.path, resolvedTeam);
      
      // Mark conflict as resolved
      conflict.resolved = true;
      conflict.resolvedAt = new Date();
      this.conflicts.set(conflict.id, conflict);
    }

    return resolutions;
  }

  /**
   * Apply auto-assignment rules to determine ownership
   */
  async applyAutoAssignmentRules(filePath: string): Promise<TeamOwnership | null> {
    const analysis = await this.analyzeGitHistory(filePath);
    
    for (const rule of this.autoAssignmentRules.filter(r => r.enabled).sort((a, b) => b.priority - a.priority)) {
      if (await this.matchesRule(filePath, analysis, rule)) {
        if (rule.actions.assignToTeam) {
          return {
            teamId: rule.actions.assignToTeam,
            teamName: await this.getTeamName(rule.actions.assignToTeam),
            confidence: rule.actions.confidence || OwnershipConfidence.MEDIUM,
            score: this.calculateConfidenceScore(rule.actions.confidence || OwnershipConfidence.MEDIUM),
            source: OwnershipSource.AUTO_ASSIGNED,
            contributors: Array.from(analysis.contributors.keys()),
            lastActive: analysis.lastModified,
            pathPatterns: rule.conditions.pathPatterns || []
          };
        }
      }
    }

    return null;
  }

  /**
   * Get comprehensive ownership information for a file or path
   */
  async getOwnership(filePath: string): Promise<{
    primary: TeamOwnership | null;
    alternatives: TeamOwnership[];
    conflicts: OwnershipConflict[];
    confidence: OwnershipConfidence;
  }> {
    const ownership = {
      primary: null as TeamOwnership | null,
      alternatives: [] as TeamOwnership[],
      conflicts: [] as OwnershipConflict[],
      confidence: OwnershipConfidence.UNKNOWN
    };

    try {
      // 1. Check for manual overrides first
      const manualOwnership = await this.getManualOwnership(filePath);
      if (manualOwnership) {
        ownership.primary = manualOwnership;
        ownership.confidence = OwnershipConfidence.HIGH;
        return ownership;
      }

      // 2. Check CODEOWNERS
      const codeownersOwnership = await this.getCodeownersOwnership(filePath);
      if (codeownersOwnership) {
        ownership.primary = codeownersOwnership;
        ownership.confidence = OwnershipConfidence.HIGH;
        return ownership;
      }

      // 3. Apply auto-assignment rules
      const autoAssigned = await this.applyAutoAssignmentRules(filePath);
      if (autoAssigned) {
        ownership.primary = autoAssigned;
        ownership.confidence = autoAssigned.confidence;
      }

      // 4. Analyze git history for alternative ownership
      const gitOwnership = await this.getGitHistoryOwnership(filePath);
      if (gitOwnership.length > 0) {
        if (!ownership.primary) {
          ownership.primary = gitOwnership[0];
          ownership.confidence = gitOwnership[0].confidence;
        } else {
          ownership.alternatives = gitOwnership;
        }
      }

      // 5. Check for conflicts
      const pathConflicts = Array.from(this.conflicts.values())
        .filter(c => c.path === filePath && !c.resolved);
      ownership.conflicts = pathConflicts;

      return ownership;
    } catch (error) {
      console.error('Error getting ownership:', error);
      return ownership;
    }
  }

  // Private helper methods

  private loadDefaultRules(): void {
    this.autoAssignmentRules = [
      {
        id: 'frontend-team',
        name: 'Frontend Team Auto-Assignment',
        enabled: true,
        priority: 100,
        conditions: {
          pathPatterns: ['src/**/*.tsx', 'src/**/*.jsx', 'src/**/*.css', 'src/**/*.scss'],
          minCommits: 3
        },
        actions: {
          assignToTeam: 'frontend-team',
          confidence: OwnershipConfidence.MEDIUM
        }
      },
      {
        id: 'backend-team',
        name: 'Backend Team Auto-Assignment',
        enabled: true,
        priority: 100,
        conditions: {
          pathPatterns: ['src/**/*.py', 'src/**/*.java', 'src/**/*.go', 'api/**/*'],
          minCommits: 3
        },
        actions: {
          assignToTeam: 'backend-team',
          confidence: OwnershipConfidence.MEDIUM
        }
      },
      {
        id: 'devops-team',
        name: 'DevOps Team Auto-Assignment',
        enabled: true,
        priority: 90,
        conditions: {
          pathPatterns: ['k8s/**/*', 'docker/**/*', '*.yml', '*.yaml', 'terraform/**/*'],
          minCommits: 2
        },
        actions: {
          assignToTeam: 'devops-team',
          confidence: OwnershipConfidence.HIGH
        }
      }
    ];
  }

  private async findCodeownersFiles(): Promise<string[]> {
    const possiblePaths = [
      'CODEOWNERS',
      '.github/CODEOWNERS',
      '.gitlab/CODEOWNERS',
      'docs/CODEOWNERS'
    ];

    const existingFiles: string[] = [];
    
    for (const filePath of possiblePaths) {
      try {
        const fullPath = path.join(this.repositoryPath, filePath);
        await fs.access(fullPath);
        existingFiles.push(fullPath);
      } catch {
        // File doesn't exist, continue
      }
    }

    return existingFiles;
  }

  private async parseCodeownersFile(filePath: string): Promise<CodeownersEntry[]> {
    if (this.codeownersCache.has(filePath)) {
      return this.codeownersCache.get(filePath)!;
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const entries: CodeownersEntry[] = [];

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 2) {
            entries.push({
              pattern: parts[0],
              owners: parts.slice(1),
              line: index + 1
            });
          }
        }
      });

      this.codeownersCache.set(filePath, entries);
      return entries;
    } catch (error) {
      console.error(`Error parsing CODEOWNERS file ${filePath}:`, error);
      return [];
    }
  }

  private extractTeamName(owner: string): string | null {
    // Handle GitHub team format (@org/team)
    const githubTeamMatch = owner.match(/@[\w-]+\/([\w-]+)/);
    if (githubTeamMatch) {
      return githubTeamMatch[1];
    }

    // Handle email format
    if (owner.includes('@')) {
      return owner.split('@')[0];
    }

    // Handle plain username
    if (owner.startsWith('@')) {
      return owner.substring(1);
    }

    return null;
  }

  private generateTeamId(teamName: string): string {
    return teamName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  private parseNumstat(diff: string): { added: number; deleted: number } {
    const lines = diff.split('\n').filter(line => line.trim());
    let added = 0;
    let deleted = 0;

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const addedNum = parseInt(parts[0], 10);
        const deletedNum = parseInt(parts[1], 10);
        
        if (!isNaN(addedNum)) added += addedNum;
        if (!isNaN(deletedNum)) deleted += deletedNum;
      }
    }

    return { added, deleted };
  }

  private extractExpertiseFromPath(filePath: string): string[] {
    const expertise: string[] = [];
    const pathLower = filePath.toLowerCase();

    // Language expertise
    if (pathLower.endsWith('.ts') || pathLower.endsWith('.tsx')) expertise.push('typescript');
    if (pathLower.endsWith('.js') || pathLower.endsWith('.jsx')) expertise.push('javascript');
    if (pathLower.endsWith('.py')) expertise.push('python');
    if (pathLower.endsWith('.java')) expertise.push('java');
    if (pathLower.endsWith('.go')) expertise.push('go');
    if (pathLower.endsWith('.rs')) expertise.push('rust');

    // Domain expertise
    if (pathLower.includes('/frontend/') || pathLower.includes('/ui/')) expertise.push('frontend');
    if (pathLower.includes('/backend/') || pathLower.includes('/api/')) expertise.push('backend');
    if (pathLower.includes('/test/') || pathLower.includes('.test.')) expertise.push('testing');
    if (pathLower.includes('/docs/') || pathLower.includes('.md')) expertise.push('documentation');
    if (pathLower.includes('docker') || pathLower.includes('k8s') || pathLower.includes('.yml')) expertise.push('devops');

    return expertise;
  }

  private isRelevantFile(filePath: string): boolean {
    const irrelevantExtensions = ['.log', '.tmp', '.cache', '.lock'];
    const irrelevantPaths = ['node_modules/', '.git/', 'coverage/', 'dist/', 'build/'];

    return !irrelevantExtensions.some(ext => filePath.endsWith(ext)) &&
           !irrelevantPaths.some(path => filePath.includes(path));
  }

  private async matchesRule(filePath: string, analysis: CommitAnalysis, rule: AutoAssignmentRule): Promise<boolean> {
    // Check path patterns
    if (rule.conditions.pathPatterns) {
      const matches = rule.conditions.pathPatterns.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(filePath);
      });
      if (!matches) return false;
    }

    // Check minimum commits
    if (rule.conditions.minCommits && analysis.totalCommits < rule.conditions.minCommits) {
      return false;
    }

    // Check minimum contributors
    if (rule.conditions.minContributors && analysis.contributors.size < rule.conditions.minContributors) {
      return false;
    }

    // Check time window
    if (rule.conditions.timeWindow) {
      const windowStart = new Date();
      windowStart.setDate(windowStart.getDate() - rule.conditions.timeWindow);
      if (analysis.lastModified < windowStart) {
        return false;
      }
    }

    return true;
  }

  private calculateConfidenceScore(confidence: OwnershipConfidence): number {
    switch (confidence) {
      case OwnershipConfidence.HIGH: return 85;
      case OwnershipConfidence.MEDIUM: return 65;
      case OwnershipConfidence.LOW: return 35;
      case OwnershipConfidence.UNKNOWN: return 10;
    }
  }

  private async getTeamName(teamId: string): Promise<string> {
    // This would integrate with TeamManager when available
    return teamId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private async getManualOwnership(filePath: string): Promise<TeamOwnership | null> {
    // This would check database for manual ownership assignments
    return null;
  }

  private async getCodeownersOwnership(filePath: string): Promise<TeamOwnership | null> {
    const codeownersFiles = await this.findCodeownersFiles();
    
    for (const file of codeownersFiles) {
      const entries = await this.parseCodeownersFile(file);
      
      // Find matching pattern (process in reverse order for precedence)
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        const regex = new RegExp(entry.pattern.replace(/\*/g, '.*'));
        
        if (regex.test(filePath)) {
          // Return first team owner found
          for (const owner of entry.owners) {
            const teamName = this.extractTeamName(owner);
            if (teamName) {
              return {
                teamId: this.generateTeamId(teamName),
                teamName,
                confidence: OwnershipConfidence.HIGH,
                score: 95,
                source: OwnershipSource.CODEOWNERS,
                contributors: [],
                lastActive: new Date(),
                pathPatterns: [entry.pattern]
              };
            }
          }
        }
      }
    }

    return null;
  }

  private async getGitHistoryOwnership(filePath: string): Promise<TeamOwnership[]> {
    const analysis = await this.analyzeGitHistory(filePath);
    const teams: TeamOwnership[] = [];

    // Create ownership entries based on top contributors
    const sortedContributors = Array.from(analysis.contributors.entries())
      .sort(([,a], [,b]) => (b.commits * 2 + b.lines) - (a.commits * 2 + a.lines))
      .slice(0, 3);

    for (const [contributor, stats] of sortedContributors) {
      const score = Math.min(95, (stats.commits * 10) + Math.log(stats.lines + 1) * 5);
      const confidence = score > 70 ? OwnershipConfidence.HIGH :
                        score > 40 ? OwnershipConfidence.MEDIUM :
                        score > 20 ? OwnershipConfidence.LOW :
                        OwnershipConfidence.UNKNOWN;

      teams.push({
        teamId: `contributor-${this.generateTeamId(contributor)}`,
        teamName: `${contributor} (Individual)`,
        confidence,
        score,
        source: OwnershipSource.GIT_HISTORY,
        contributors: [contributor],
        lastActive: stats.lastCommit,
        pathPatterns: [filePath]
      });
    }

    return teams;
  }
}