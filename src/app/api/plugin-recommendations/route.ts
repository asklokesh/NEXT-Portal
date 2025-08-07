import { NextRequest, NextResponse } from 'next/server';

interface UserProfile {
  userId: string;
  teamId: string;
  role: string;
  department: string;
  experience: 'junior' | 'mid' | 'senior' | 'principal';
  interests: string[];
  usagePatterns: {
    mostUsedPlugins: string[];
    timeSpentPerPlugin: Record<string, number>;
    featuresUsed: string[];
    lastActiveTime: string;
  };
  teamNeeds: {
    primaryTech: string[];
    workflows: string[];
    painPoints: string[];
    goals: string[];
  };
}

interface PluginRecommendation {
  pluginId: string;
  pluginName: string;
  description: string;
  category: string;
  score: number; // 0-100
  confidence: number; // 0-100
  reasoning: {
    primary: string;
    factors: string[];
    benefits: string[];
  };
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  timeToValue: 'immediate' | 'days' | 'weeks';
  prerequisites: string[];
  similarUsers: {
    count: number;
    adoptionRate: number;
    satisfaction: number;
  };
  metadata: {
    downloads: number;
    stars: number;
    lastUpdate: string;
    maintainers: number;
    communitySize: number;
  };
}

interface RecommendationContext {
  userProfile: UserProfile;
  installedPlugins: string[];
  teamPlugins: string[];
  organizationTrends: string[];
  industryTrends: string[];
  currentGoals: string[];
}

// Mock user profiles and data
const MOCK_USER_PROFILES: Record<string, UserProfile> = {
  'user1': {
    userId: 'user1',
    teamId: 'platform-team',
    role: 'Platform Engineer',
    department: 'Engineering',
    experience: 'senior',
    interests: ['kubernetes', 'monitoring', 'automation', 'devops'],
    usagePatterns: {
      mostUsedPlugins: ['@backstage/plugin-catalog', '@backstage/plugin-kubernetes'],
      timeSpentPerPlugin: {
        '@backstage/plugin-catalog': 120,
        '@backstage/plugin-kubernetes': 90,
        '@backstage/plugin-techdocs': 45
      },
      featuresUsed: ['service-discovery', 'k8s-monitoring', 'documentation'],
      lastActiveTime: new Date().toISOString()
    },
    teamNeeds: {
      primaryTech: ['kubernetes', 'docker', 'terraform', 'prometheus'],
      workflows: ['ci-cd', 'monitoring', 'incident-response'],
      painPoints: ['manual deployments', 'poor visibility', 'documentation gaps'],
      goals: ['improve automation', 'better monitoring', 'faster incident response']
    }
  },
  'user2': {
    userId: 'user2',
    teamId: 'frontend-team',
    role: 'Frontend Developer',
    department: 'Engineering',
    experience: 'mid',
    interests: ['react', 'ui-development', 'testing', 'performance'],
    usagePatterns: {
      mostUsedPlugins: ['@backstage/plugin-catalog', '@backstage/plugin-techdocs'],
      timeSpentPerPlugin: {
        '@backstage/plugin-catalog': 60,
        '@backstage/plugin-techdocs': 80,
        '@spotify/backstage-plugin-lighthouse': 30
      },
      featuresUsed: ['component-discovery', 'documentation', 'performance-monitoring'],
      lastActiveTime: new Date().toISOString()
    },
    teamNeeds: {
      primaryTech: ['react', 'typescript', 'webpack', 'jest'],
      workflows: ['development', 'testing', 'code-review'],
      painPoints: ['slow builds', 'inconsistent ui', 'testing gaps'],
      goals: ['improve performance', 'better testing', 'consistent design system']
    }
  }
};

// Plugin recommendation database with scoring factors
const PLUGIN_RECOMMENDATIONS_DB = {
  '@backstage/plugin-jenkins': {
    pluginId: '@backstage/plugin-jenkins',
    pluginName: 'Jenkins',
    description: 'Integrate Jenkins CI/CD pipelines and build information directly into Backstage',
    category: 'ci-cd',
    tags: ['ci-cd', 'builds', 'automation', 'devops'],
    difficulty: 'medium',
    timeToValue: 'days',
    prerequisites: ['jenkins-server', 'api-tokens'],
    metadata: {
      downloads: 15420,
      stars: 89,
      lastUpdate: '2024-01-15',
      maintainers: 8,
      communitySize: 1200
    },
    scoringFactors: {
      keywords: ['ci-cd', 'jenkins', 'builds', 'automation', 'devops'],
      roles: ['platform-engineer', 'devops-engineer', 'sre'],
      departments: ['engineering', 'platform'],
      experience: ['mid', 'senior', 'principal'],
      teamNeeds: ['ci-cd', 'automation', 'monitoring'],
      painPoints: ['manual deployments', 'build visibility']
    }
  },
  '@roadiehq/backstage-plugin-github-actions': {
    pluginId: '@roadiehq/backstage-plugin-github-actions',
    pluginName: 'GitHub Actions',
    description: 'View and monitor GitHub Actions workflows and runs within Backstage',
    category: 'ci-cd',
    tags: ['github', 'actions', 'ci-cd', 'workflows'],
    difficulty: 'easy',
    timeToValue: 'immediate',
    prerequisites: ['github-repo', 'github-token'],
    metadata: {
      downloads: 28750,
      stars: 156,
      lastUpdate: '2024-01-20',
      maintainers: 12,
      communitySize: 2800
    },
    scoringFactors: {
      keywords: ['github', 'actions', 'ci-cd', 'workflows', 'automation'],
      roles: ['developer', 'platform-engineer', 'devops-engineer'],
      departments: ['engineering'],
      experience: ['junior', 'mid', 'senior'],
      teamNeeds: ['ci-cd', 'automation', 'github-integration'],
      painPoints: ['manual deployments', 'workflow visibility']
    }
  },
  '@spotify/backstage-plugin-lighthouse': {
    pluginId: '@spotify/backstage-plugin-lighthouse',
    pluginName: 'Lighthouse',
    description: 'Website performance auditing and monitoring using Google Lighthouse',
    category: 'quality',
    tags: ['performance', 'lighthouse', 'auditing', 'frontend'],
    difficulty: 'easy',
    timeToValue: 'immediate',
    prerequisites: ['lighthouse-server'],
    metadata: {
      downloads: 12340,
      stars: 78,
      lastUpdate: '2024-01-18',
      maintainers: 6,
      communitySize: 890
    },
    scoringFactors: {
      keywords: ['performance', 'lighthouse', 'frontend', 'auditing', 'quality'],
      roles: ['frontend-developer', 'ui-developer', 'qa-engineer'],
      departments: ['engineering', 'product'],
      experience: ['junior', 'mid', 'senior'],
      teamNeeds: ['performance-monitoring', 'quality-assurance'],
      painPoints: ['slow performance', 'inconsistent ui']
    }
  },
  '@backstage/plugin-cost-insights': {
    pluginId: '@backstage/plugin-cost-insights',
    pluginName: 'Cost Insights',
    description: 'Track and analyze cloud costs across your infrastructure and services',
    category: 'cost',
    tags: ['cost', 'cloud', 'optimization', 'insights'],
    difficulty: 'hard',
    timeToValue: 'weeks',
    prerequisites: ['cloud-billing-api', 'cost-data'],
    metadata: {
      downloads: 8920,
      stars: 92,
      lastUpdate: '2024-01-12',
      maintainers: 10,
      communitySize: 650
    },
    scoringFactors: {
      keywords: ['cost', 'cloud', 'optimization', 'finops', 'billing'],
      roles: ['platform-engineer', 'finops-engineer', 'engineering-manager'],
      departments: ['engineering', 'finance', 'platform'],
      experience: ['senior', 'principal'],
      teamNeeds: ['cost-optimization', 'cloud-management'],
      painPoints: ['high cloud costs', 'cost visibility']
    }
  },
  '@roadiehq/backstage-plugin-prometheus': {
    pluginId: '@roadiehq/backstage-plugin-prometheus',
    pluginName: 'Prometheus',
    description: 'Monitor application metrics and create custom dashboards with Prometheus',
    category: 'monitoring',
    tags: ['prometheus', 'metrics', 'monitoring', 'observability'],
    difficulty: 'medium',
    timeToValue: 'days',
    prerequisites: ['prometheus-server', 'metrics-endpoints'],
    metadata: {
      downloads: 18650,
      stars: 134,
      lastUpdate: '2024-01-22',
      maintainers: 15,
      communitySize: 1850
    },
    scoringFactors: {
      keywords: ['prometheus', 'metrics', 'monitoring', 'observability', 'dashboards'],
      roles: ['platform-engineer', 'sre', 'devops-engineer'],
      departments: ['engineering', 'platform', 'operations'],
      experience: ['mid', 'senior', 'principal'],
      teamNeeds: ['monitoring', 'observability', 'metrics'],
      painPoints: ['poor visibility', 'no metrics', 'incident response']
    }
  },
  '@backstage/plugin-sonarqube': {
    pluginId: '@backstage/plugin-sonarqube',
    pluginName: 'SonarQube',
    description: 'Code quality analysis and security scanning integration with SonarQube',
    category: 'quality',
    tags: ['sonarqube', 'code-quality', 'security', 'analysis'],
    difficulty: 'medium',
    timeToValue: 'days',
    prerequisites: ['sonarqube-server', 'project-keys'],
    metadata: {
      downloads: 11230,
      stars: 67,
      lastUpdate: '2024-01-16',
      maintainers: 9,
      communitySize: 980
    },
    scoringFactors: {
      keywords: ['sonarqube', 'code-quality', 'security', 'static-analysis'],
      roles: ['developer', 'qa-engineer', 'security-engineer'],
      departments: ['engineering', 'quality', 'security'],
      experience: ['mid', 'senior'],
      teamNeeds: ['code-quality', 'security-scanning', 'static-analysis'],
      painPoints: ['code quality issues', 'security vulnerabilities']
    }
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'user1';
    const limit = parseInt(searchParams.get('limit') || '10');
    const category = searchParams.get('category');
    const context = searchParams.get('context'); // 'personal', 'team', 'trending'

    const userProfile = MOCK_USER_PROFILES[userId];
    if (!userProfile) {
      return NextResponse.json({
        success: false,
        error: 'User profile not found'
      }, { status: 404 });
    }

    const recommendationContext: RecommendationContext = {
      userProfile,
      installedPlugins: userProfile.usagePatterns.mostUsedPlugins,
      teamPlugins: ['@backstage/plugin-catalog', '@backstage/plugin-techdocs', '@backstage/plugin-kubernetes'],
      organizationTrends: ['kubernetes', 'github-actions', 'prometheus', 'sonarqube'],
      industryTrends: ['observability', 'security', 'cost-optimization', 'automation'],
      currentGoals: userProfile.teamNeeds.goals
    };

    let recommendations = generateRecommendations(recommendationContext);

    // Filter by category if specified
    if (category && category !== 'all') {
      recommendations = recommendations.filter(rec => rec.category === category);
    }

    // Sort by score and take top results
    recommendations = recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Add similar user data
    recommendations = recommendations.map(rec => ({
      ...rec,
      similarUsers: generateSimilarUserData(rec, userProfile)
    }));

    return NextResponse.json({
      success: true,
      recommendations,
      context: recommendationContext,
      metadata: {
        totalRecommendations: Object.keys(PLUGIN_RECOMMENDATIONS_DB).length,
        filteredCount: recommendations.length,
        userProfile: {
          id: userProfile.userId,
          role: userProfile.role,
          experience: userProfile.experience,
          interests: userProfile.interests
        }
      }
    });

  } catch (error) {
    console.error('Error generating plugin recommendations:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, feedback, pluginId, action } = await request.json();

    if (!userId || !action) {
      return NextResponse.json({
        success: false,
        error: 'User ID and action are required'
      }, { status: 400 });
    }

    // Handle different feedback actions
    switch (action) {
      case 'like':
        // Record positive feedback
        console.log(`User ${userId} liked recommendation for ${pluginId}`);
        break;
      
      case 'dislike':
        // Record negative feedback
        console.log(`User ${userId} disliked recommendation for ${pluginId}`);
        break;
      
      case 'install':
        // Track installation from recommendation
        console.log(`User ${userId} installed ${pluginId} from recommendation`);
        break;
      
      case 'dismiss':
        // Don't show this recommendation again
        console.log(`User ${userId} dismissed recommendation for ${pluginId}`);
        break;
      
      case 'interested':
        // User marked as interested but didn't install yet
        console.log(`User ${userId} marked interest in ${pluginId}`);
        break;
    }

    return NextResponse.json({
      success: true,
      message: `Feedback recorded for ${action} on ${pluginId}`
    });

  } catch (error) {
    console.error('Error processing recommendation feedback:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

function generateRecommendations(context: RecommendationContext): PluginRecommendation[] {
  const recommendations: PluginRecommendation[] = [];
  const { userProfile, installedPlugins } = context;

  for (const [pluginId, pluginData] of Object.entries(PLUGIN_RECOMMENDATIONS_DB)) {
    // Skip if already installed
    if (installedPlugins.includes(pluginId)) {
      continue;
    }

    const score = calculateRecommendationScore(pluginData, context);
    const confidence = calculateConfidence(pluginData, context);
    
    if (score > 20) { // Only recommend if score is above threshold
      const reasoning = generateReasoning(pluginData, context, score);
      
      recommendations.push({
        pluginId: pluginData.pluginId,
        pluginName: pluginData.pluginName,
        description: pluginData.description,
        category: pluginData.category,
        score: Math.round(score),
        confidence: Math.round(confidence),
        reasoning,
        tags: pluginData.tags,
        difficulty: pluginData.difficulty as any,
        timeToValue: pluginData.timeToValue as any,
        prerequisites: pluginData.prerequisites,
        similarUsers: {
          count: 0, // Will be filled later
          adoptionRate: 0,
          satisfaction: 0
        },
        metadata: pluginData.metadata
      });
    }
  }

  return recommendations;
}

function calculateRecommendationScore(pluginData: any, context: RecommendationContext): number {
  let score = 0;
  const { userProfile } = context;
  const factors = pluginData.scoringFactors;

  // Role matching (25 points max)
  const roleMatch = factors.roles.includes(userProfile.role.toLowerCase().replace(' ', '-'));
  if (roleMatch) score += 25;

  // Department matching (20 points max)
  const deptMatch = factors.departments.includes(userProfile.department.toLowerCase());
  if (deptMatch) score += 20;

  // Experience level matching (15 points max)
  const expMatch = factors.experience.includes(userProfile.experience);
  if (expMatch) score += 15;

  // Interest/keyword matching (30 points max)
  const interestMatches = userProfile.interests.filter(interest => 
    factors.keywords.some((keyword: string) => 
      keyword.includes(interest) || interest.includes(keyword)
    )
  );
  score += Math.min(30, interestMatches.length * 10);

  // Team needs matching (20 points max)
  const needMatches = userProfile.teamNeeds.workflows.filter(need =>
    factors.teamNeeds.some((teamNeed: string) => 
      teamNeed.includes(need) || need.includes(teamNeed)
    )
  );
  score += Math.min(20, needMatches.length * 7);

  // Pain point addressing (25 points max)
  const painPointMatches = userProfile.teamNeeds.painPoints.filter(pain =>
    factors.painPoints.some((factorPain: string) => 
      factorPain.includes(pain) || pain.includes(factorPain)
    )
  );
  score += Math.min(25, painPointMatches.length * 8);

  // Plugin popularity boost (10 points max)
  const popularityScore = Math.min(10, (pluginData.metadata.downloads / 5000) * 2);
  score += popularityScore;

  // Recent updates boost (5 points max)
  const lastUpdate = new Date(pluginData.metadata.lastUpdate);
  const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
  const freshnessScore = Math.max(0, 5 - (daysSinceUpdate / 30));
  score += freshnessScore;

  return Math.min(100, score);
}

function calculateConfidence(pluginData: any, context: RecommendationContext): number {
  let confidence = 50; // Base confidence

  // High downloads = higher confidence
  if (pluginData.metadata.downloads > 20000) confidence += 20;
  else if (pluginData.metadata.downloads > 10000) confidence += 10;

  // More maintainers = higher confidence
  if (pluginData.metadata.maintainers > 10) confidence += 15;
  else if (pluginData.metadata.maintainers > 5) confidence += 10;

  // Recent updates = higher confidence
  const lastUpdate = new Date(pluginData.metadata.lastUpdate);
  const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 30) confidence += 15;
  else if (daysSinceUpdate < 90) confidence += 5;

  // Strong user profile match = higher confidence
  const { userProfile } = context;
  const factors = pluginData.scoringFactors;
  
  const strongMatches = [
    factors.roles.includes(userProfile.role.toLowerCase().replace(' ', '-')),
    factors.departments.includes(userProfile.department.toLowerCase()),
    userProfile.interests.some((interest: string) => 
      factors.keywords.some((keyword: string) => keyword.includes(interest))
    )
  ].filter(Boolean).length;

  confidence += strongMatches * 5;

  return Math.min(100, confidence);
}

function generateReasoning(pluginData: any, context: RecommendationContext, score: number) {
  const { userProfile } = context;
  const factors = pluginData.scoringFactors;
  
  let primary = '';
  const reasoningFactors = [];
  const benefits = [];

  // Determine primary reason
  if (factors.roles.includes(userProfile.role.toLowerCase().replace(' ', '-'))) {
    primary = `Perfect match for your role as ${userProfile.role}`;
  } else if (userProfile.interests.some((interest: string) => 
    factors.keywords.some((keyword: string) => keyword.includes(interest))
  )) {
    const matchingInterests = userProfile.interests.filter((interest: string) => 
      factors.keywords.some((keyword: string) => keyword.includes(interest))
    );
    primary = `Aligns with your interests in ${matchingInterests.join(', ')}`;
  } else {
    primary = `Could benefit your ${userProfile.department} team`;
  }

  // Add specific factors
  if (factors.departments.includes(userProfile.department.toLowerCase())) {
    reasoningFactors.push(`Commonly used in ${userProfile.department} teams`);
  }

  if (userProfile.teamNeeds.painPoints.some(pain =>
    factors.painPoints.some((factorPain: string) => factorPain.includes(pain))
  )) {
    reasoningFactors.push('Addresses current team pain points');
  }

  if (pluginData.difficulty === 'easy') {
    reasoningFactors.push('Easy to implement and configure');
  }

  if (pluginData.timeToValue === 'immediate') {
    reasoningFactors.push('Provides immediate value after installation');
  }

  // Add benefits
  benefits.push(`Enhance ${pluginData.category} capabilities`);
  
  if (pluginData.metadata.downloads > 15000) {
    benefits.push('Trusted by thousands of developers');
  }
  
  if (pluginData.metadata.communitySize > 1000) {
    benefits.push('Strong community support');
  }

  benefits.push('Seamless Backstage integration');

  return {
    primary,
    factors: reasoningFactors,
    benefits
  };
}

function generateSimilarUserData(recommendation: PluginRecommendation, userProfile: UserProfile) {
  // Simulate similar user data based on plugin and user characteristics
  const baseAdoption = Math.random() * 0.4 + 0.3; // 30-70%
  const baseSatisfaction = Math.random() * 1.5 + 3.5; // 3.5-5.0
  
  let userCount = Math.floor(Math.random() * 200 + 50); // 50-250 users
  
  // Adjust based on plugin popularity
  if (recommendation.metadata.downloads > 20000) {
    userCount *= 2;
  }
  
  return {
    count: userCount,
    adoptionRate: Math.round(baseAdoption * 100),
    satisfaction: Math.round(baseSatisfaction * 10) / 10
  };
}