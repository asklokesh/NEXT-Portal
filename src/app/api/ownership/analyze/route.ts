import { NextRequest, NextResponse } from 'next/server';
import { OwnershipManager, OwnershipConfidence, OwnershipSource } from '@/lib/ownership/OwnershipManager';
import { TeamManager } from '@/lib/teams/TeamManager';
import { ContributorAnalyzer, ActivityLevel, ExpertiseLevel } from '@/lib/analysis/ContributorAnalyzer';

/**
 * API endpoint for ownership analysis operations
 * GET /api/ownership/analyze - Get current ownership analysis
 * POST /api/ownership/analyze - Run new ownership analysis
 */

interface AnalysisRequest {
  fullAnalysis?: boolean;
  timeWindowDays?: number;
  paths?: string[]; // Specific paths to analyze
  includeGitHistory?: boolean;
  includeContributorAnalysis?: boolean;
  generateConflictResolutions?: boolean;
}

interface AnalysisResponse {
  success: boolean;
  message?: string;
  analysis?: {
    totalFiles: number;
    analyzedFiles: number;
    assignedFiles: number;
    conflictedFiles: number;
    timeWindow: number;
    completedAt: string;
  };
  records?: OwnershipRecord[];
  contributors?: ContributorSummary[];
  teams?: TeamSummary[];
  conflicts?: ConflictSummary[];
  recommendations?: string[];
  stats?: OwnershipStats;
}

interface OwnershipRecord {
  id: string;
  path: string;
  teamId: string;
  teamName: string;
  confidence: string;
  score: number;
  source: string;
  contributors: string[];
  lastActive: string;
  conflicted: boolean;
  manualOverride?: boolean;
}

interface ContributorSummary {
  name: string;
  email: string;
  totalCommits: number;
  activityLevel: string;
  activityScore: number;
  expertise: Array<{
    area: string;
    level: string;
    confidence: number;
  }>;
  primaryFiles: string[];
  languageBreakdown: Array<{
    language: string;
    fileCount: number;
  }>;
}

interface TeamSummary {
  id: string;
  name: string;
  memberCount: number;
  capacityUtilization: number;
  primaryDomains: string[];
  recentActivity: string;
  expertiseAreas: string[];
  fileOwnership: number;
  conflictCount: number;
}

interface ConflictSummary {
  id: string;
  path: string;
  conflictingTeams: Array<{
    teamId: string;
    teamName: string;
    confidence: string;
    score: number;
  }>;
  status: string;
  recommendedResolution: string;
}

interface OwnershipStats {
  totalFiles: number;
  assignedFiles: number;
  unassignedFiles: number;
  conflictedFiles: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
  teamDistribution: Array<{
    teamName: string;
    fileCount: number;
    percentage: number;
  }>;
  sourceDistribution: {
    codeowners: number;
    git_history: number;
    manual: number;
    auto_assigned: number;
  };
}

// Initialize managers
let ownershipManager: OwnershipManager;
let teamManager: TeamManager;
let contributorAnalyzer: ContributorAnalyzer;

function initManagers() {
  if (!ownershipManager) {
    const repoPath = process.env.REPOSITORY_PATH || process.cwd();
    ownershipManager = new OwnershipManager(repoPath);
    teamManager = new TeamManager();
    contributorAnalyzer = new ContributorAnalyzer(repoPath);
  }
}

export async function GET(request: NextRequest) {
  try {
    initManagers();
    
    const { searchParams } = new URL(request.url);
    const includeContributors = searchParams.get('contributors') === 'true';
    const includeConflicts = searchParams.get('conflicts') === 'true';
    const includeStats = searchParams.get('stats') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');
    
    // Get cached analysis results or generate mock data for demo
    const records = await generateMockOwnershipRecords(limit);
    const teams = await generateTeamSummaries();
    
    let contributors: ContributorSummary[] = [];
    let conflicts: ConflictSummary[] = [];
    let stats: OwnershipStats | undefined;
    
    if (includeContributors) {
      contributors = await generateContributorSummaries();
    }
    
    if (includeConflicts) {
      conflicts = await generateConflictSummaries();
    }
    
    if (includeStats) {
      stats = await generateOwnershipStats(records);
    }
    
    return NextResponse.json({
      success: true,
      records,
      contributors,
      teams,
      conflicts,
      stats,
      analysis: {
        totalFiles: records.length + 500, // Mock additional files
        analyzedFiles: records.length,
        assignedFiles: records.filter(r => r.teamId && !r.conflicted).length,
        conflictedFiles: records.filter(r => r.conflicted).length,
        timeWindow: 90,
        completedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error in ownership analysis GET:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error retrieving ownership analysis',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    initManagers();
    
    const body: AnalysisRequest = await request.json();
    const timeWindow = body.timeWindowDays || 90;
    
    console.log('Starting ownership analysis...', { 
      fullAnalysis: body.fullAnalysis,
      timeWindow,
      paths: body.paths?.length || 'all'
    });
    
    const analysis = {
      totalFiles: 0,
      analyzedFiles: 0,
      assignedFiles: 0,
      conflictedFiles: 0,
      timeWindow,
      completedAt: new Date().toISOString()
    };
    
    const recommendations: string[] = [];
    
    if (body.fullAnalysis) {
      // Run comprehensive analysis
      
      // 1. Discover teams from CODEOWNERS
      console.log('Discovering teams from CODEOWNERS...');
      const codeownersTeams = await ownershipManager.discoverTeamsFromCodeowners();
      console.log(`Found ${codeownersTeams.size} teams from CODEOWNERS`);
      
      if (codeownersTeams.size > 0) {
        recommendations.push(`Discovered ${codeownersTeams.size} teams from CODEOWNERS files`);
      } else {
        recommendations.push('No CODEOWNERS files found. Consider creating them for better ownership tracking.');
      }
      
      // 2. Analyze active contributors
      if (body.includeContributorAnalysis) {
        console.log('Analyzing contributors...');
        const contributors = await contributorAnalyzer.analyzeAllContributors(timeWindow);
        console.log(`Analyzed ${contributors.size} contributors`);
        
        const activeContributors = Array.from(contributors.values())
          .filter(c => c.activityLevel !== ActivityLevel.INACTIVE);
        
        recommendations.push(`Found ${activeContributors.length} active contributors in the last ${timeWindow} days`);
        
        if (activeContributors.length < 5) {
          recommendations.push('Low contributor activity detected. Consider team capacity planning.');
        }
      }
      
      // 3. Detect team boundaries
      console.log('Detecting team boundaries...');
      const teamBoundaries = await ownershipManager.detectTeamBoundaries();
      console.log(`Detected ${teamBoundaries.teamClusters.size} potential team clusters`);
      
      if (teamBoundaries.boundaryFiles.length > 0) {
        recommendations.push(`${teamBoundaries.boundaryFiles.length} files are modified by multiple teams - consider refactoring or shared ownership`);
      }
      
      // 4. Generate repository insights
      if (body.includeContributorAnalysis) {
        console.log('Generating repository insights...');
        const insights = await contributorAnalyzer.generateRepositoryInsights();
        
        if (insights.riskAnalysis.keyPersonRisks.length > 0) {
          recommendations.push(`Key person risks identified: ${insights.riskAnalysis.keyPersonRisks.slice(0, 3).join(', ')}`);
        }
        
        if (insights.riskAnalysis.knowledgeGaps.length > 0) {
          recommendations.push(`Knowledge gaps found in: ${insights.riskAnalysis.knowledgeGaps.join(', ')}`);
        }
      }
      
      // 5. Apply auto-assignment rules
      console.log('Applying auto-assignment rules...');
      // In a real implementation, this would iterate through files
      const sampleFiles = [
        'src/components/ui/button.tsx',
        'src/app/api/users/route.ts',
        'k8s/deployment.yaml',
        'src/hooks/useAuth.ts'
      ];
      
      let autoAssigned = 0;
      for (const file of sampleFiles) {
        const assignment = await ownershipManager.applyAutoAssignmentRules(file);
        if (assignment) {
          autoAssigned++;
        }
      }
      
      if (autoAssigned > 0) {
        recommendations.push(`Auto-assigned ownership for ${autoAssigned} files based on patterns`);
      }
      
      analysis.totalFiles = 1500; // Mock total
      analysis.analyzedFiles = 800; // Mock analyzed
      analysis.assignedFiles = 650; // Mock assigned
      analysis.conflictedFiles = 25; // Mock conflicts
      
    } else {
      // Quick analysis
      console.log('Running quick ownership analysis...');
      
      // Mock quick analysis results
      analysis.totalFiles = 1200;
      analysis.analyzedFiles = 500;
      analysis.assignedFiles = 400;
      analysis.conflictedFiles = 15;
      
      recommendations.push('Quick analysis completed. Run full analysis for comprehensive results.');
    }
    
    console.log('Ownership analysis completed:', analysis);
    
    return NextResponse.json({
      success: true,
      message: 'Ownership analysis completed successfully',
      analysis,
      recommendations
    });
    
  } catch (error) {
    console.error('Error in ownership analysis POST:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error running ownership analysis',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Mock data generation functions for demo purposes

async function generateMockOwnershipRecords(limit: number): Promise<OwnershipRecord[]> {
  const teams = await generateTeamSummaries();
  const records: OwnershipRecord[] = [];
  
  const samplePaths = [
    'src/components/ui/button.tsx',
    'src/components/ui/card.tsx',
    'src/components/ui/dialog.tsx',
    'src/app/api/users/route.ts',
    'src/app/api/auth/route.ts',
    'src/app/api/teams/route.ts',
    'src/lib/auth.ts',
    'src/lib/database.ts',
    'src/hooks/useAuth.ts',
    'src/hooks/useTeams.ts',
    'k8s/deployment.yaml',
    'k8s/service.yaml',
    'docker/Dockerfile',
    'scripts/deploy.sh',
    'docs/README.md',
    'docs/api.md',
    'tests/auth.test.ts',
    'tests/components.test.tsx'
  ];
  
  const sources = ['codeowners', 'git_history', 'manual', 'auto_assigned'];
  const confidences = ['high', 'medium', 'low', 'unknown'];
  
  for (let i = 0; i < Math.min(limit, samplePaths.length * 3); i++) {
    const path = samplePaths[i % samplePaths.length];
    const team = teams[Math.floor(Math.random() * teams.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    const confidence = confidences[Math.floor(Math.random() * confidences.length)];
    const conflicted = Math.random() < 0.15; // 15% conflict rate
    
    records.push({
      id: `record_${i}`,
      path: `${path}_${Math.floor(i / samplePaths.length)}`,
      teamId: team.id,
      teamName: team.name,
      confidence,
      score: Math.floor(Math.random() * 40) + (confidence === 'high' ? 60 : confidence === 'medium' ? 40 : 20),
      source,
      contributors: [`contributor_${Math.floor(Math.random() * 10)}`, `contributor_${Math.floor(Math.random() * 10)}`],
      lastActive: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      conflicted,
      manualOverride: Math.random() < 0.1
    });
  }
  
  return records;
}

async function generateTeamSummaries(): Promise<TeamSummary[]> {
  const teams = teamManager.getAllTeams();
  
  return teams.map(team => ({
    id: team.id,
    name: team.name,
    memberCount: team.members.size,
    capacityUtilization: Math.floor(Math.random() * 40) + 60, // 60-100%
    primaryDomains: team.domains.slice(0, 3),
    recentActivity: `${Math.floor(Math.random() * 7) + 1} days ago`,
    expertiseAreas: [...team.domains, ...team.technologies].slice(0, 5),
    fileOwnership: Math.floor(Math.random() * 200) + 50,
    conflictCount: Math.floor(Math.random() * 5)
  }));
}

async function generateContributorSummaries(): Promise<ContributorSummary[]> {
  const contributors: ContributorSummary[] = [];
  const names = ['Alice Frontend', 'Bob Backend', 'Carol DevOps', 'Dave Fullstack', 'Eve Mobile'];
  const languages = ['typescript', 'javascript', 'python', 'go', 'rust'];
  const expertiseAreas = ['frontend', 'backend', 'devops', 'testing', 'documentation'];
  
  for (let i = 0; i < names.length; i++) {
    contributors.push({
      name: names[i],
      email: `${names[i].toLowerCase().replace(' ', '.')}@example.com`,
      totalCommits: Math.floor(Math.random() * 500) + 100,
      activityLevel: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
      activityScore: Math.floor(Math.random() * 40) + 60,
      expertise: expertiseAreas.slice(0, Math.floor(Math.random() * 3) + 1).map(area => ({
        area,
        level: ['expert', 'experienced', 'competent'][Math.floor(Math.random() * 3)],
        confidence: Math.floor(Math.random() * 30) + 70
      })),
      primaryFiles: [
        `src/components/${names[i].split(' ')[0].toLowerCase()}.tsx`,
        `src/lib/${names[i].split(' ')[0].toLowerCase()}.ts`
      ],
      languageBreakdown: languages.slice(0, Math.floor(Math.random() * 3) + 1).map(lang => ({
        language: lang,
        fileCount: Math.floor(Math.random() * 50) + 10
      }))
    });
  }
  
  return contributors;
}

async function generateConflictSummaries(): Promise<ConflictSummary[]> {
  const conflicts: ConflictSummary[] = [];
  const teams = await generateTeamSummaries();
  
  const conflictPaths = [
    'src/shared/utils.ts',
    'src/components/common/layout.tsx',
    'config/database.ts',
    'scripts/shared-deploy.sh'
  ];
  
  for (let i = 0; i < conflictPaths.length; i++) {
    const conflictingTeams = teams.slice(0, Math.floor(Math.random() * 2) + 2).map(team => ({
      teamId: team.id,
      teamName: team.name,
      confidence: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)],
      score: Math.floor(Math.random() * 40) + 40
    }));
    
    conflicts.push({
      id: `conflict_${i}`,
      path: conflictPaths[i],
      conflictingTeams,
      status: 'pending',
      recommendedResolution: 'highest_confidence'
    });
  }
  
  return conflicts;
}

async function generateOwnershipStats(records: OwnershipRecord[]): Promise<OwnershipStats> {
  const totalFiles = records.length + 400; // Mock additional files
  const assignedFiles = records.filter(r => r.teamId && !r.conflicted).length;
  const conflictedFiles = records.filter(r => r.conflicted).length;
  
  // Count confidence distribution
  const confidenceDistribution = {
    high: records.filter(r => r.confidence === 'high').length,
    medium: records.filter(r => r.confidence === 'medium').length,
    low: records.filter(r => r.confidence === 'low').length,
    unknown: records.filter(r => r.confidence === 'unknown').length
  };
  
  // Count team distribution
  const teamCounts = new Map<string, number>();
  records.forEach(r => {
    if (r.teamName) {
      teamCounts.set(r.teamName, (teamCounts.get(r.teamName) || 0) + 1);
    }
  });
  
  const teamDistribution = Array.from(teamCounts.entries())
    .map(([teamName, fileCount]) => ({
      teamName,
      fileCount,
      percentage: Math.round((fileCount / assignedFiles) * 100)
    }))
    .sort((a, b) => b.fileCount - a.fileCount);
  
  // Count source distribution
  const sourceDistribution = {
    codeowners: records.filter(r => r.source === 'codeowners').length,
    git_history: records.filter(r => r.source === 'git_history').length,
    manual: records.filter(r => r.source === 'manual').length,
    auto_assigned: records.filter(r => r.source === 'auto_assigned').length
  };
  
  return {
    totalFiles,
    assignedFiles,
    unassignedFiles: totalFiles - assignedFiles - conflictedFiles,
    conflictedFiles,
    confidenceDistribution,
    teamDistribution,
    sourceDistribution
  };
}