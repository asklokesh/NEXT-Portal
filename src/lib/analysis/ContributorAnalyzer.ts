import { simpleGit, SimpleGit, LogResult, DiffResult } from 'simple-git';
import * as path from 'path';

/**
 * Contributor activity levels based on commit frequency and impact
 */
export enum ActivityLevel {
  VERY_HIGH = 'very_high',  // Daily commits, high impact
  HIGH = 'high',            // Regular commits, good impact
  MEDIUM = 'medium',        // Weekly commits, moderate impact
  LOW = 'low',              // Monthly commits, low impact
  INACTIVE = 'inactive'     // No recent activity
}

/**
 * Code contribution types for impact analysis
 */
export enum ContributionType {
  FEATURE = 'feature',           // New feature development
  BUGFIX = 'bugfix',            // Bug fixes
  REFACTORING = 'refactoring',  // Code improvements
  DOCUMENTATION = 'documentation', // Docs updates
  TESTING = 'testing',          // Test additions
  CONFIGURATION = 'configuration', // Config changes
  MAINTENANCE = 'maintenance'    // General maintenance
}

/**
 * Expertise level in specific areas
 */
export enum ExpertiseLevel {
  DOMAIN_EXPERT = 'domain_expert',     // Deep expertise, go-to person
  EXPERIENCED = 'experienced',         // Strong knowledge
  COMPETENT = 'competent',            // Working knowledge
  BEGINNER = 'beginner',              // Basic understanding
  UNFAMILIAR = 'unfamiliar'           // No experience
}

/**
 * Individual contributor analysis result
 */
export interface ContributorProfile {
  name: string;
  email: string;
  totalCommits: number;
  totalLinesAdded: number;
  totalLinesDeleted: number;
  totalLinesModified: number;
  firstCommit: Date;
  lastCommit: Date;
  activityLevel: ActivityLevel;
  activityScore: number; // 0-100
  
  // Time-based analysis
  commitFrequency: {
    daily: number;
    weekly: number;
    monthly: number;
    trends: { period: string; commits: number }[];
  };
  
  // Contribution patterns
  contributions: {
    type: ContributionType;
    count: number;
    linesImpacted: number;
    files: string[];
    recentActivity: Date;
  }[];
  
  // Expertise mapping
  expertise: Map<string, {
    level: ExpertiseLevel;
    confidence: number; // 0-100
    filesModified: number;
    linesContributed: number;
    lastActivity: Date;
    keyContributions: string[];
  }>;
  
  // Collaboration patterns
  collaboration: {
    frequentCollaborators: string[];
    codeReviewParticipation: number;
    mentorshipIndicators: string[];
    crossTeamWork: string[];
  };
  
  // Quality indicators
  quality: {
    bugfixRatio: number; // bugfix commits / total commits
    testCoverage: number; // test files modified / total files
    documentationRatio: number; // doc changes / code changes
    reviewComments: number;
  };
  
  // Files and areas of focus
  primaryFiles: string[];
  primaryDirectories: string[];
  languageBreakdown: Map<string, number>;
  frameworkExperience: Map<string, number>;
}

/**
 * Team collaboration analysis
 */
export interface CollaborationPattern {
  contributor1: string;
  contributor2: string;
  sharedFiles: string[];
  collaborationScore: number; // 0-100
  workingStyle: 'sequential' | 'parallel' | 'review-based' | 'paired';
  frequency: number; // collaborations per month
  domains: string[];
}

/**
 * Repository contribution overview
 */
export interface RepositoryInsights {
  totalContributors: number;
  activeContributors: number; // active in last 90 days
  topContributors: ContributorProfile[];
  expertiseDistribution: Map<string, string[]>; // domain -> contributors
  collaborationNetwork: CollaborationPattern[];
  codeHealthMetrics: {
    averageCommitSize: number;
    testToCodeRatio: number;
    documentationCoverage: number;
    technicalDebtIndicators: string[];
  };
  riskAnalysis: {
    keyPersonRisks: string[]; // areas dependent on single person
    knowledgeGaps: string[]; // areas with low expertise
    maintainerBurnout: string[]; // overloaded contributors
  };
}

/**
 * Comprehensive Git commit and contributor analysis system
 */
export class ContributorAnalyzer {
  private git: SimpleGit;
  private contributorCache: Map<string, ContributorProfile> = new Map();
  private analysisCache: Map<string, any> = new Map();
  
  constructor(private repositoryPath: string) {
    this.git = simpleGit(repositoryPath);
  }

  /**
   * Analyze all contributors in the repository
   */
  async analyzeAllContributors(timeWindowDays = 365): Promise<Map<string, ContributorProfile>> {
    const cacheKey = `all_contributors_${timeWindowDays}`;
    
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey);
    }

    try {
      const since = new Date();
      since.setDate(since.getDate() - timeWindowDays);

      // Get all commits in the time window
      const log = await this.git.log({
        since: since.toISOString(),
        '--format': 'fuller',
        '--numstat': true
      });

      const contributors = new Map<string, ContributorProfile>();

      // Group commits by contributor
      const commitsByContributor = new Map<string, any[]>();
      
      for (const commit of log.all) {
        const author = commit.author_name;
        if (!commitsByContributor.has(author)) {
          commitsByContributor.set(author, []);
        }
        commitsByContributor.get(author)!.push(commit);
      }

      // Analyze each contributor
      for (const [author, commits] of commitsByContributor) {
        const profile = await this.analyzeContributor(author, commits, timeWindowDays);
        contributors.set(author, profile);
      }

      this.analysisCache.set(cacheKey, contributors);
      return contributors;
    } catch (error) {
      console.error('Error analyzing contributors:', error);
      return new Map();
    }
  }

  /**
   * Analyze a specific contributor's patterns and expertise
   */
  async analyzeContributor(
    contributorName: string, 
    commits?: any[], 
    timeWindowDays = 365
  ): Promise<ContributorProfile> {
    const cacheKey = `${contributorName}_${timeWindowDays}`;
    
    if (this.contributorCache.has(cacheKey)) {
      return this.contributorCache.get(cacheKey)!;
    }

    try {
      // Get contributor's commits if not provided
      if (!commits) {
        const since = new Date();
        since.setDate(since.getDate() - timeWindowDays);
        
        const log = await this.git.log({
          since: since.toISOString(),
          '--format': 'fuller',
          '--author': contributorName
        });
        commits = log.all;
      }

      if (commits.length === 0) {
        return this.createEmptyProfile(contributorName);
      }

      // Basic metrics
      const totalCommits = commits.length;
      const firstCommit = new Date(commits[commits.length - 1].date);
      const lastCommit = new Date(commits[0].date);
      
      // Analyze commit patterns and file changes
      let totalLinesAdded = 0;
      let totalLinesDeleted = 0;
      const filesModified = new Set<string>();
      const languageBreakdown = new Map<string, number>();
      const directoryActivity = new Map<string, number>();
      const contributionTypes = new Map<ContributionType, number>();

      for (const commit of commits) {
        // Analyze commit message for contribution type
        const contributionType = this.classifyCommit(commit.message);
        contributionTypes.set(contributionType, (contributionTypes.get(contributionType) || 0) + 1);

        // Get file changes for this commit
        try {
          const diff = await this.git.show([
            '--format=',
            '--numstat',
            commit.hash
          ]);
          
          const { added, deleted, files } = this.parseNumstat(diff);
          totalLinesAdded += added;
          totalLinesDeleted += deleted;
          
          files.forEach(file => {
            filesModified.add(file);
            
            // Track language usage
            const language = this.detectLanguage(file);
            if (language) {
              languageBreakdown.set(language, (languageBreakdown.get(language) || 0) + 1);
            }
            
            // Track directory activity
            const directory = path.dirname(file);
            directoryActivity.set(directory, (directoryActivity.get(directory) || 0) + 1);
          });
        } catch (diffError) {
          // Continue if diff fails
        }
      }

      // Calculate activity metrics
      const daysSinceFirst = (lastCommit.getTime() - firstCommit.getTime()) / (1000 * 60 * 60 * 24);
      const commitFrequency = {
        daily: totalCommits / Math.max(daysSinceFirst, 1),
        weekly: (totalCommits / Math.max(daysSinceFirst, 1)) * 7,
        monthly: (totalCommits / Math.max(daysSinceFirst, 1)) * 30,
        trends: this.calculateCommitTrends(commits)
      };

      const activityLevel = this.calculateActivityLevel(commitFrequency, totalCommits, daysSinceFirst);
      const activityScore = this.calculateActivityScore(commitFrequency, totalCommits, totalLinesAdded + totalLinesDeleted);

      // Build expertise map
      const expertise = await this.buildExpertiseMap(
        Array.from(filesModified), 
        directoryActivity, 
        languageBreakdown, 
        contributorName
      );

      // Analyze collaboration patterns
      const collaboration = await this.analyzeCollaboration(contributorName, Array.from(filesModified));

      // Calculate quality metrics
      const quality = this.calculateQualityMetrics(contributionTypes, Array.from(filesModified), totalCommits);

      // Build contributions array
      const contributions = Array.from(contributionTypes.entries()).map(([type, count]) => ({
        type,
        count,
        linesImpacted: Math.round((totalLinesAdded + totalLinesDeleted) * (count / totalCommits)),
        files: this.getFilesForContributionType(type, Array.from(filesModified)),
        recentActivity: lastCommit
      }));

      const profile: ContributorProfile = {
        name: contributorName,
        email: commits[0]?.author_email || '',
        totalCommits,
        totalLinesAdded,
        totalLinesDeleted,
        totalLinesModified: totalLinesAdded + totalLinesDeleted,
        firstCommit,
        lastCommit,
        activityLevel,
        activityScore,
        commitFrequency,
        contributions,
        expertise,
        collaboration,
        quality,
        primaryFiles: this.getPrimaryFiles(Array.from(filesModified), directoryActivity),
        primaryDirectories: Array.from(directoryActivity.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([dir]) => dir),
        languageBreakdown,
        frameworkExperience: this.detectFrameworkExperience(Array.from(filesModified))
      };

      this.contributorCache.set(cacheKey, profile);
      return profile;
    } catch (error) {
      console.error(`Error analyzing contributor ${contributorName}:`, error);
      return this.createEmptyProfile(contributorName);
    }
  }

  /**
   * Identify expertise areas and confidence levels
   */
  async identifyExpertiseAreas(contributorName: string): Promise<Map<string, ExpertiseLevel>> {
    const profile = await this.analyzeContributor(contributorName);
    const expertiseAreas = new Map<string, ExpertiseLevel>();

    for (const [domain, data] of profile.expertise) {
      expertiseAreas.set(domain, data.level);
    }

    return expertiseAreas;
  }

  /**
   * Analyze collaboration patterns between contributors
   */
  async analyzeCollaborationPatterns(): Promise<CollaborationPattern[]> {
    const contributors = await this.analyzeAllContributors();
    const patterns: CollaborationPattern[] = [];
    const contributorNames = Array.from(contributors.keys());

    for (let i = 0; i < contributorNames.length; i++) {
      for (let j = i + 1; j < contributorNames.length; j++) {
        const contributor1 = contributorNames[i];
        const contributor2 = contributorNames[j];
        
        const pattern = await this.analyzeCollaborationBetween(contributor1, contributor2, contributors);
        if (pattern.collaborationScore > 20) { // Only include meaningful collaborations
          patterns.push(pattern);
        }
      }
    }

    return patterns.sort((a, b) => b.collaborationScore - a.collaborationScore);
  }

  /**
   * Track activity levels over time
   */
  async trackActivityLevels(timeWindowDays = 365): Promise<Map<string, {
    current: ActivityLevel;
    trend: 'increasing' | 'decreasing' | 'stable';
    monthlyActivity: { month: string; commits: number; score: number }[];
  }>> {
    const contributors = await this.analyzeAllContributors(timeWindowDays);
    const activityTracking = new Map();

    for (const [name, profile] of contributors) {
      const monthlyActivity = await this.getMonthlyActivity(name, timeWindowDays);
      const trend = this.calculateActivityTrend(monthlyActivity);

      activityTracking.set(name, {
        current: profile.activityLevel,
        trend,
        monthlyActivity
      });
    }

    return activityTracking;
  }

  /**
   * Generate comprehensive repository insights
   */
  async generateRepositoryInsights(): Promise<RepositoryInsights> {
    const contributors = await this.analyzeAllContributors();
    const collaborationPatterns = await this.analyzeCollaborationPatterns();
    
    const activeContributors = Array.from(contributors.values())
      .filter(profile => profile.activityLevel !== ActivityLevel.INACTIVE);

    const topContributors = Array.from(contributors.values())
      .sort((a, b) => b.activityScore - a.activityScore)
      .slice(0, 10);

    // Build expertise distribution
    const expertiseDistribution = new Map<string, string[]>();
    for (const [name, profile] of contributors) {
      for (const [domain, data] of profile.expertise) {
        if (data.level === ExpertiseLevel.DOMAIN_EXPERT || data.level === ExpertiseLevel.EXPERIENCED) {
          if (!expertiseDistribution.has(domain)) {
            expertiseDistribution.set(domain, []);
          }
          expertiseDistribution.get(domain)!.push(name);
        }
      }
    }

    // Calculate code health metrics
    const codeHealthMetrics = this.calculateCodeHealthMetrics(contributors);
    
    // Identify risks
    const riskAnalysis = this.identifyRisks(contributors, expertiseDistribution);

    return {
      totalContributors: contributors.size,
      activeContributors: activeContributors.length,
      topContributors,
      expertiseDistribution,
      collaborationNetwork: collaborationPatterns,
      codeHealthMetrics,
      riskAnalysis
    };
  }

  // Private helper methods

  private createEmptyProfile(name: string): ContributorProfile {
    return {
      name,
      email: '',
      totalCommits: 0,
      totalLinesAdded: 0,
      totalLinesDeleted: 0,
      totalLinesModified: 0,
      firstCommit: new Date(),
      lastCommit: new Date(),
      activityLevel: ActivityLevel.INACTIVE,
      activityScore: 0,
      commitFrequency: { daily: 0, weekly: 0, monthly: 0, trends: [] },
      contributions: [],
      expertise: new Map(),
      collaboration: { 
        frequentCollaborators: [], 
        codeReviewParticipation: 0, 
        mentorshipIndicators: [], 
        crossTeamWork: [] 
      },
      quality: { bugfixRatio: 0, testCoverage: 0, documentationRatio: 0, reviewComments: 0 },
      primaryFiles: [],
      primaryDirectories: [],
      languageBreakdown: new Map(),
      frameworkExperience: new Map()
    };
  }

  private classifyCommit(message: string): ContributionType {
    const msgLower = message.toLowerCase();
    
    if (msgLower.includes('fix') || msgLower.includes('bug') || msgLower.includes('issue')) {
      return ContributionType.BUGFIX;
    }
    if (msgLower.includes('test') || msgLower.includes('spec')) {
      return ContributionType.TESTING;
    }
    if (msgLower.includes('doc') || msgLower.includes('readme') || msgLower.includes('comment')) {
      return ContributionType.DOCUMENTATION;
    }
    if (msgLower.includes('refactor') || msgLower.includes('cleanup') || msgLower.includes('improve')) {
      return ContributionType.REFACTORING;
    }
    if (msgLower.includes('config') || msgLower.includes('setup') || msgLower.includes('build')) {
      return ContributionType.CONFIGURATION;
    }
    if (msgLower.includes('feat') || msgLower.includes('add') || msgLower.includes('implement')) {
      return ContributionType.FEATURE;
    }
    
    return ContributionType.MAINTENANCE;
  }

  private parseNumstat(diff: string): { added: number; deleted: number; files: string[] } {
    const lines = diff.split('\n').filter(line => line.trim());
    let added = 0;
    let deleted = 0;
    const files: string[] = [];

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const addedNum = parseInt(parts[0], 10);
        const deletedNum = parseInt(parts[1], 10);
        const fileName = parts[2];

        if (!isNaN(addedNum)) added += addedNum;
        if (!isNaN(deletedNum)) deleted += deletedNum;
        
        if (fileName && !fileName.startsWith('Binary file')) {
          files.push(fileName);
        }
      }
    }

    return { added, deleted, files };
  }

  private detectLanguage(filePath: string): string | null {
    const extension = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.css': 'css',
      '.scss': 'scss',
      '.html': 'html',
      '.vue': 'vue',
      '.svelte': 'svelte'
    };

    return languageMap[extension] || null;
  }

  private calculateCommitTrends(commits: any[]): { period: string; commits: number }[] {
    const trends: { period: string; commits: number }[] = [];
    const monthlyCommits = new Map<string, number>();

    commits.forEach(commit => {
      const date = new Date(commit.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyCommits.set(monthKey, (monthlyCommits.get(monthKey) || 0) + 1);
    });

    for (const [period, commitCount] of monthlyCommits) {
      trends.push({ period, commits: commitCount });
    }

    return trends.sort((a, b) => a.period.localeCompare(b.period));
  }

  private calculateActivityLevel(
    frequency: { daily: number; weekly: number; monthly: number }, 
    totalCommits: number, 
    daysSinceFirst: number
  ): ActivityLevel {
    if (frequency.weekly >= 5) return ActivityLevel.VERY_HIGH;
    if (frequency.weekly >= 2) return ActivityLevel.HIGH;
    if (frequency.monthly >= 4) return ActivityLevel.MEDIUM;
    if (totalCommits > 5 && daysSinceFirst < 90) return ActivityLevel.LOW;
    return ActivityLevel.INACTIVE;
  }

  private calculateActivityScore(
    frequency: { daily: number; weekly: number; monthly: number },
    totalCommits: number,
    totalLines: number
  ): number {
    let score = 0;
    
    // Frequency score (0-40 points)
    score += Math.min(frequency.weekly * 5, 40);
    
    // Volume score (0-30 points)
    score += Math.min(totalCommits * 0.5, 30);
    
    // Impact score (0-30 points)
    score += Math.min(Math.log(totalLines + 1) * 3, 30);

    return Math.min(Math.round(score), 100);
  }

  private async buildExpertiseMap(
    files: string[], 
    directoryActivity: Map<string, number>,
    languageBreakdown: Map<string, number>,
    contributor: string
  ): Promise<Map<string, {
    level: ExpertiseLevel;
    confidence: number;
    filesModified: number;
    linesContributed: number;
    lastActivity: Date;
    keyContributions: string[];
  }>> {
    const expertise = new Map();

    // Language expertise
    for (const [language, fileCount] of languageBreakdown) {
      const level = this.determineLanguageExpertise(fileCount, files.length);
      expertise.set(language, {
        level,
        confidence: Math.min((fileCount / files.length) * 100, 100),
        filesModified: fileCount,
        linesContributed: 0, // Would need more detailed analysis
        lastActivity: new Date(),
        keyContributions: files.filter(f => this.detectLanguage(f) === language).slice(0, 5)
      });
    }

    // Domain expertise based on directory activity
    for (const [directory, activity] of directoryActivity) {
      const domain = this.mapDirectoryToDomain(directory);
      if (domain) {
        const level = this.determineDomainExpertise(activity, files.length);
        expertise.set(domain, {
          level,
          confidence: Math.min((activity / files.length) * 100, 100),
          filesModified: activity,
          linesContributed: 0,
          lastActivity: new Date(),
          keyContributions: files.filter(f => f.startsWith(directory)).slice(0, 5)
        });
      }
    }

    return expertise;
  }

  private determineLanguageExpertise(fileCount: number, totalFiles: number): ExpertiseLevel {
    const ratio = fileCount / totalFiles;
    if (ratio > 0.6 && fileCount > 20) return ExpertiseLevel.DOMAIN_EXPERT;
    if (ratio > 0.4 && fileCount > 10) return ExpertiseLevel.EXPERIENCED;
    if (ratio > 0.2 && fileCount > 5) return ExpertiseLevel.COMPETENT;
    if (fileCount > 2) return ExpertiseLevel.BEGINNER;
    return ExpertiseLevel.UNFAMILIAR;
  }

  private determineDomainExpertise(activity: number, totalActivity: number): ExpertiseLevel {
    const ratio = activity / totalActivity;
    if (ratio > 0.5 && activity > 15) return ExpertiseLevel.DOMAIN_EXPERT;
    if (ratio > 0.3 && activity > 8) return ExpertiseLevel.EXPERIENCED;
    if (ratio > 0.15 && activity > 4) return ExpertiseLevel.COMPETENT;
    if (activity > 2) return ExpertiseLevel.BEGINNER;
    return ExpertiseLevel.UNFAMILIAR;
  }

  private mapDirectoryToDomain(directory: string): string | null {
    const domainMappings: Record<string, string> = {
      'src/components': 'frontend',
      'src/pages': 'frontend',
      'src/api': 'backend',
      'src/services': 'backend',
      'src/lib': 'core',
      'src/utils': 'utilities',
      'src/hooks': 'frontend',
      'tests': 'testing',
      'docs': 'documentation',
      'k8s': 'devops',
      'docker': 'devops',
      'scripts': 'automation',
      '.github': 'ci-cd'
    };

    for (const [path, domain] of Object.entries(domainMappings)) {
      if (directory.includes(path)) {
        return domain;
      }
    }

    return null;
  }

  private async analyzeCollaboration(contributorName: string, files: string[]): Promise<{
    frequentCollaborators: string[];
    codeReviewParticipation: number;
    mentorshipIndicators: string[];
    crossTeamWork: string[];
  }> {
    const collaboration = {
      frequentCollaborators: [],
      codeReviewParticipation: 0,
      mentorshipIndicators: [],
      crossTeamWork: []
    };

    // Find collaborators by analyzing shared files
    const collaborators = new Map<string, number>();
    
    for (const file of files.slice(0, 50)) { // Limit for performance
      try {
        const log = await this.git.log({ file, maxCount: 20 });
        
        for (const commit of log.all) {
          if (commit.author_name !== contributorName) {
            collaborators.set(commit.author_name, (collaborators.get(commit.author_name) || 0) + 1);
          }
        }
      } catch (error) {
        // Continue if log fails for this file
      }
    }

    // Sort collaborators by frequency
    const sortedCollaborators = Array.from(collaborators.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name]) => name);

    collaboration.frequentCollaborators = sortedCollaborators;

    return collaboration;
  }

  private calculateQualityMetrics(
    contributionTypes: Map<ContributionType, number>,
    files: string[],
    totalCommits: number
  ): {
    bugfixRatio: number;
    testCoverage: number;
    documentationRatio: number;
    reviewComments: number;
  } {
    const bugfixCount = contributionTypes.get(ContributionType.BUGFIX) || 0;
    const testFiles = files.filter(f => f.includes('test') || f.includes('spec')).length;
    const docFiles = files.filter(f => f.includes('doc') || f.endsWith('.md')).length;

    return {
      bugfixRatio: (bugfixCount / totalCommits) * 100,
      testCoverage: (testFiles / files.length) * 100,
      documentationRatio: (docFiles / files.length) * 100,
      reviewComments: 0 // Would need GitHub API integration
    };
  }

  private getFilesForContributionType(type: ContributionType, files: string[]): string[] {
    switch (type) {
      case ContributionType.TESTING:
        return files.filter(f => f.includes('test') || f.includes('spec')).slice(0, 5);
      case ContributionType.DOCUMENTATION:
        return files.filter(f => f.includes('doc') || f.endsWith('.md')).slice(0, 5);
      case ContributionType.CONFIGURATION:
        return files.filter(f => f.includes('config') || f.endsWith('.yml') || f.endsWith('.yaml')).slice(0, 5);
      default:
        return files.slice(0, 5);
    }
  }

  private getPrimaryFiles(files: string[], directoryActivity: Map<string, number>): string[] {
    // Return files from most active directories
    const topDirectories = Array.from(directoryActivity.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([dir]) => dir);

    const primaryFiles: string[] = [];
    
    for (const dir of topDirectories) {
      const dirFiles = files.filter(f => f.startsWith(dir)).slice(0, 3);
      primaryFiles.push(...dirFiles);
    }

    return primaryFiles.slice(0, 10);
  }

  private detectFrameworkExperience(files: string[]): Map<string, number> {
    const frameworks = new Map<string, number>();
    
    for (const file of files) {
      const fileName = path.basename(file).toLowerCase();
      const content = file.toLowerCase();
      
      // React
      if (fileName.includes('react') || content.includes('component') || file.endsWith('.jsx') || file.endsWith('.tsx')) {
        frameworks.set('react', (frameworks.get('react') || 0) + 1);
      }
      
      // Next.js
      if (content.includes('next') || fileName.includes('page.') || fileName.includes('layout.')) {
        frameworks.set('nextjs', (frameworks.get('nextjs') || 0) + 1);
      }
      
      // Node.js
      if (fileName.includes('server') || fileName.includes('api') || content.includes('node_modules')) {
        frameworks.set('nodejs', (frameworks.get('nodejs') || 0) + 1);
      }
      
      // Testing frameworks
      if (fileName.includes('jest') || fileName.includes('cypress') || fileName.includes('playwright')) {
        frameworks.set('testing', (frameworks.get('testing') || 0) + 1);
      }
    }

    return frameworks;
  }

  private async analyzeCollaborationBetween(
    contributor1: string, 
    contributor2: string, 
    contributors: Map<string, ContributorProfile>
  ): Promise<CollaborationPattern> {
    const profile1 = contributors.get(contributor1)!;
    const profile2 = contributors.get(contributor2)!;
    
    // Find shared files
    const files1 = new Set(profile1.primaryFiles);
    const files2 = new Set(profile2.primaryFiles);
    const sharedFiles = Array.from(files1).filter(f => files2.has(f));
    
    // Calculate collaboration score
    const collaborationScore = Math.min((sharedFiles.length / Math.max(files1.size, files2.size)) * 100, 100);
    
    // Determine working style (simplified)
    let workingStyle: 'sequential' | 'parallel' | 'review-based' | 'paired' = 'sequential';
    if (collaborationScore > 60) workingStyle = 'paired';
    else if (collaborationScore > 30) workingStyle = 'parallel';
    else if (sharedFiles.length > 0) workingStyle = 'review-based';

    return {
      contributor1,
      contributor2,
      sharedFiles,
      collaborationScore,
      workingStyle,
      frequency: sharedFiles.length / 4, // Rough estimate: shared files per month
      domains: [...new Set([...profile1.primaryDirectories, ...profile2.primaryDirectories])]
    };
  }

  private async getMonthlyActivity(contributorName: string, timeWindowDays: number): Promise<{
    month: string; 
    commits: number; 
    score: number 
  }[]> {
    // This would analyze commit history month by month
    // Simplified implementation for now
    return [];
  }

  private calculateActivityTrend(monthlyActivity: { month: string; commits: number; score: number }[]): 'increasing' | 'decreasing' | 'stable' {
    if (monthlyActivity.length < 2) return 'stable';
    
    const recent = monthlyActivity.slice(-3);
    const earlier = monthlyActivity.slice(-6, -3);
    
    const recentAvg = recent.reduce((sum, m) => sum + m.commits, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, m) => sum + m.commits, 0) / earlier.length;
    
    if (recentAvg > earlierAvg * 1.2) return 'increasing';
    if (recentAvg < earlierAvg * 0.8) return 'decreasing';
    return 'stable';
  }

  private calculateCodeHealthMetrics(contributors: Map<string, ContributorProfile>): {
    averageCommitSize: number;
    testToCodeRatio: number;
    documentationCoverage: number;
    technicalDebtIndicators: string[];
  } {
    const profiles = Array.from(contributors.values());
    
    const averageCommitSize = profiles.reduce((sum, p) => 
      sum + (p.totalLinesModified / Math.max(p.totalCommits, 1)), 0
    ) / profiles.length;

    const testContributions = profiles.reduce((sum, p) => 
      sum + (p.contributions.find(c => c.type === ContributionType.TESTING)?.count || 0), 0
    );
    const totalContributions = profiles.reduce((sum, p) => sum + p.totalCommits, 0);
    const testToCodeRatio = (testContributions / totalContributions) * 100;

    const docContributions = profiles.reduce((sum, p) => 
      sum + (p.contributions.find(c => c.type === ContributionType.DOCUMENTATION)?.count || 0), 0
    );
    const documentationCoverage = (docContributions / totalContributions) * 100;

    const technicalDebtIndicators: string[] = [];
    if (averageCommitSize > 200) technicalDebtIndicators.push('Large commit sizes detected');
    if (testToCodeRatio < 15) technicalDebtIndicators.push('Low test coverage');
    if (documentationCoverage < 10) technicalDebtIndicators.push('Insufficient documentation');

    return {
      averageCommitSize,
      testToCodeRatio,
      documentationCoverage,
      technicalDebtIndicators
    };
  }

  private identifyRisks(
    contributors: Map<string, ContributorProfile>,
    expertiseDistribution: Map<string, string[]>
  ): {
    keyPersonRisks: string[];
    knowledgeGaps: string[];
    maintainerBurnout: string[];
  } {
    const keyPersonRisks: string[] = [];
    const knowledgeGaps: string[] = [];
    const maintainerBurnout: string[] = [];

    // Key person risks (domains with only one expert)
    for (const [domain, experts] of expertiseDistribution) {
      if (experts.length === 1) {
        keyPersonRisks.push(`${domain} (only ${experts[0]})`);
      }
    }

    // Knowledge gaps (domains with no experts)
    const commonDomains = ['frontend', 'backend', 'testing', 'devops', 'documentation'];
    for (const domain of commonDomains) {
      if (!expertiseDistribution.has(domain) || expertiseDistribution.get(domain)!.length === 0) {
        knowledgeGaps.push(domain);
      }
    }

    // Maintainer burnout (very high activity contributors)
    for (const [name, profile] of contributors) {
      if (profile.activityLevel === ActivityLevel.VERY_HIGH && profile.totalCommits > 100) {
        maintainerBurnout.push(name);
      }
    }

    return { keyPersonRisks, knowledgeGaps, maintainerBurnout };
  }
}