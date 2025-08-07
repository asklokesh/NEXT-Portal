/**
 * Technology Detector
 * 
 * Intelligent technology stack detection and recommendation system.
 */

import { WizardRecommendation } from './service-creation-wizard';

export interface TechnologyRecommendationRequest {
  serviceType: string;
  teamPreferences: string;
  organizationStandards: any;
  existingServices?: string[];
  performanceRequirements?: 'low' | 'medium' | 'high';
  scalabilityRequirements?: 'low' | 'medium' | 'high';
  developmentSpeed?: 'slow' | 'medium' | 'fast';
}

export interface TechnologyProfile {
  name: string;
  category: 'language' | 'framework' | 'database' | 'cache' | 'messaging' | 'monitoring';
  description: string;
  pros: string[];
  cons: string[];
  bestFor: string[];
  complexity: 'low' | 'medium' | 'high';
  maturity: 'emerging' | 'stable' | 'mature' | 'legacy';
  communitySupport: 'low' | 'medium' | 'high';
  learningCurve: 'easy' | 'medium' | 'steep';
  dependencies: string[];
  alternatives: string[];
  marketShare: number; // Percentage
  trendsScore: number; // -100 to 100 (declining to growing)
}

export class TechnologyDetector {
  private technologyProfiles: Map<string, TechnologyProfile> = new Map();
  
  constructor() {
    this.initializeTechnologyProfiles();
  }

  /**
   * Get technology recommendations based on requirements
   */
  async getRecommendations(request: TechnologyRecommendationRequest): Promise<WizardRecommendation[]> {
    const recommendations: WizardRecommendation[] = [];

    // Primary language recommendations
    const languageRecommendations = await this.recommendLanguages(request);
    recommendations.push(...languageRecommendations);

    // Framework recommendations
    const frameworkRecommendations = await this.recommendFrameworks(request);
    recommendations.push(...frameworkRecommendations);

    // Database recommendations
    const databaseRecommendations = await this.recommendDatabases(request);
    recommendations.push(...databaseRecommendations);

    // Additional technology recommendations
    const additionalRecommendations = await this.recommendAdditionalTechnologies(request);
    recommendations.push(...additionalRecommendations);

    return recommendations.sort((a, b) => this.getRecommendationPriority(a) - this.getRecommendationPriority(b));
  }

  /**
   * Analyze technology compatibility
   */
  analyzeTechnologyCompatibility(technologies: string[]): {
    compatible: boolean;
    conflicts: Array<{
      tech1: string;
      tech2: string;
      reason: string;
      severity: 'warning' | 'error';
    }>;
    suggestions: string[];
  } {
    const conflicts: any[] = [];
    const suggestions: string[] = [];

    // Check for known conflicts
    const conflictMatrix = this.getConflictMatrix();
    
    for (let i = 0; i < technologies.length; i++) {
      for (let j = i + 1; j < technologies.length; j++) {
        const conflict = conflictMatrix.get(`${technologies[i]}-${technologies[j]}`);
        if (conflict) {
          conflicts.push({
            tech1: technologies[i],
            tech2: technologies[j],
            reason: conflict.reason,
            severity: conflict.severity
          });
        }
      }
    }

    // Generate suggestions
    if (technologies.includes('react') && !technologies.includes('typescript')) {
      suggestions.push('Consider adding TypeScript for better type safety with React');
    }

    if (technologies.includes('nodejs') && !technologies.includes('express')) {
      suggestions.push('Express.js is commonly used with Node.js for web APIs');
    }

    return {
      compatible: conflicts.filter(c => c.severity === 'error').length === 0,
      conflicts,
      suggestions
    };
  }

  /**
   * Get technology trends and insights
   */
  getTechnologyTrends(technology: string): {
    trend: 'growing' | 'stable' | 'declining';
    trendsScore: number;
    marketShare: number;
    adoption: 'early' | 'mainstream' | 'late';
    futureOutlook: 'promising' | 'stable' | 'uncertain';
    alternatives: string[];
  } {
    const profile = this.technologyProfiles.get(technology.toLowerCase());
    
    if (!profile) {
      return {
        trend: 'stable',
        trendsScore: 0,
        marketShare: 0,
        adoption: 'early',
        futureOutlook: 'uncertain',
        alternatives: []
      };
    }

    return {
      trend: profile.trendsScore > 20 ? 'growing' : profile.trendsScore < -20 ? 'declining' : 'stable',
      trendsScore: profile.trendsScore,
      marketShare: profile.marketShare,
      adoption: profile.marketShare > 30 ? 'mainstream' : profile.marketShare > 5 ? 'early' : 'late',
      futureOutlook: this.calculateFutureOutlook(profile),
      alternatives: profile.alternatives
    };
  }

  /**
   * Recommend languages based on requirements
   */
  private async recommendLanguages(request: TechnologyRecommendationRequest): Promise<WizardRecommendation[]> {
    const recommendations: WizardRecommendation[] = [];
    
    const languageScores = new Map<string, number>();

    // Score languages based on service type
    const serviceTypeMapping = {
      'web-api': { 'javascript': 9, 'python': 8, 'java': 7, 'go': 8, 'csharp': 7 },
      'data-processing': { 'python': 10, 'scala': 8, 'java': 7, 'r': 9 },
      'real-time': { 'go': 10, 'rust': 9, 'cpp': 8, 'java': 7 },
      'machine-learning': { 'python': 10, 'r': 8, 'julia': 7, 'scala': 6 },
      'mobile-backend': { 'javascript': 8, 'python': 7, 'java': 8, 'go': 7 },
      'general': { 'javascript': 8, 'python': 9, 'java': 8, 'go': 7, 'csharp': 7 }
    };

    const typeScores = serviceTypeMapping[request.serviceType as keyof typeof serviceTypeMapping] || serviceTypeMapping.general;
    
    for (const [language, score] of Object.entries(typeScores)) {
      languageScores.set(language, score);
    }

    // Adjust scores based on requirements
    if (request.performanceRequirements === 'high') {
      languageScores.set('go', (languageScores.get('go') || 0) + 2);
      languageScores.set('rust', (languageScores.get('rust') || 0) + 2);
      languageScores.set('cpp', (languageScores.get('cpp') || 0) + 1);
    }

    if (request.developmentSpeed === 'fast') {
      languageScores.set('javascript', (languageScores.get('javascript') || 0) + 2);
      languageScores.set('python', (languageScores.get('python') || 0) + 2);
    }

    // Generate recommendations
    const sortedLanguages = Array.from(languageScores.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    for (const [language, score] of sortedLanguages) {
      const profile = this.technologyProfiles.get(language);
      if (profile) {
        recommendations.push({
          type: 'technology',
          title: `${profile.name} Programming Language`,
          description: profile.description,
          severity: score >= 8 ? 'info' : 'warning',
          suggestion: `Consider using ${profile.name} for this service`,
          impact: {
            complexity: profile.complexity,
            maintenance: this.mapComplexityToMaintenance(profile.complexity),
            performance: score >= 8 ? 'positive' : 'neutral'
          }
        });
      }
    }

    return recommendations;
  }

  /**
   * Recommend frameworks based on language and requirements
   */
  private async recommendFrameworks(request: TechnologyRecommendationRequest): Promise<WizardRecommendation[]> {
    const recommendations: WizardRecommendation[] = [];

    const frameworkMapping = {
      'javascript': [
        { name: 'express', score: 9, use: 'Simple REST APIs' },
        { name: 'nestjs', score: 8, use: 'Enterprise applications' },
        { name: 'koa', score: 7, use: 'Minimalist approach' }
      ],
      'python': [
        { name: 'fastapi', score: 9, use: 'Modern APIs with auto-documentation' },
        { name: 'django', score: 8, use: 'Full-featured web applications' },
        { name: 'flask', score: 7, use: 'Lightweight services' }
      ],
      'java': [
        { name: 'spring-boot', score: 9, use: 'Enterprise applications' },
        { name: 'micronaut', score: 8, use: 'Microservices' },
        { name: 'quarkus', score: 7, use: 'Cloud-native applications' }
      ]
    };

    // This would be determined from the previous language selection
    const selectedLanguage = 'javascript'; // Placeholder

    const frameworks = frameworkMapping[selectedLanguage as keyof typeof frameworkMapping] || [];
    
    for (const framework of frameworks.slice(0, 2)) {
      recommendations.push({
        type: 'technology',
        title: `${framework.name} Framework`,
        description: `Best for: ${framework.use}`,
        severity: 'info',
        suggestion: `Consider using ${framework.name} framework`,
        impact: {
          complexity: 'medium',
          maintenance: 'medium',
          performance: 'positive'
        }
      });
    }

    return recommendations;
  }

  /**
   * Recommend databases based on service requirements
   */
  private async recommendDatabases(request: TechnologyRecommendationRequest): Promise<WizardRecommendation[]> {
    const recommendations: WizardRecommendation[] = [];

    const databaseRecommendations = [
      {
        name: 'PostgreSQL',
        useCase: 'Relational data with ACID compliance',
        score: 9,
        type: 'relational'
      },
      {
        name: 'MongoDB',
        useCase: 'Document-based flexible schema',
        score: 8,
        type: 'document'
      },
      {
        name: 'Redis',
        useCase: 'Caching and session storage',
        score: 7,
        type: 'cache'
      }
    ];

    for (const db of databaseRecommendations) {
      recommendations.push({
        type: 'technology',
        title: `${db.name} Database`,
        description: db.useCase,
        severity: 'info',
        suggestion: `Consider ${db.name} for data storage`,
        impact: {
          complexity: 'medium',
          maintenance: 'medium',
          performance: 'positive'
        }
      });
    }

    return recommendations;
  }

  /**
   * Recommend additional technologies
   */
  private async recommendAdditionalTechnologies(request: TechnologyRecommendationRequest): Promise<WizardRecommendation[]> {
    const recommendations: WizardRecommendation[] = [];

    // Monitoring recommendations
    if (request.scalabilityRequirements === 'high') {
      recommendations.push({
        type: 'technology',
        title: 'Monitoring and Observability',
        description: 'Essential for high-scale services',
        severity: 'warning',
        suggestion: 'Add Prometheus + Grafana for monitoring',
        impact: {
          complexity: 'medium',
          maintenance: 'medium',
          performance: 'positive'
        }
      });
    }

    // Message queue recommendations
    if (request.serviceType === 'real-time' || request.scalabilityRequirements === 'high') {
      recommendations.push({
        type: 'technology',
        title: 'Message Queue',
        description: 'For asynchronous communication and scaling',
        severity: 'info',
        suggestion: 'Consider Redis Pub/Sub or Apache Kafka',
        impact: {
          complexity: 'high',
          maintenance: 'medium',
          performance: 'positive'
        }
      });
    }

    return recommendations;
  }

  /**
   * Initialize technology profiles database
   */
  private initializeTechnologyProfiles(): void {
    const profiles: TechnologyProfile[] = [
      {
        name: 'JavaScript',
        category: 'language',
        description: 'Dynamic programming language for web development',
        pros: ['Fast development', 'Large ecosystem', 'Full-stack capability'],
        cons: ['Runtime errors', 'Performance limitations'],
        bestFor: ['Web APIs', 'Real-time applications', 'Rapid prototyping'],
        complexity: 'low',
        maturity: 'mature',
        communitySupport: 'high',
        learningCurve: 'easy',
        dependencies: [],
        alternatives: ['TypeScript', 'Python', 'Go'],
        marketShare: 67.7,
        trendsScore: 15
      },
      {
        name: 'Python',
        category: 'language',
        description: 'High-level programming language with emphasis on code readability',
        pros: ['Readable syntax', 'Rich libraries', 'Data science support'],
        cons: ['Performance limitations', 'GIL for threading'],
        bestFor: ['Data processing', 'Machine learning', 'Web APIs'],
        complexity: 'low',
        maturity: 'mature',
        communitySupport: 'high',
        learningCurve: 'easy',
        dependencies: [],
        alternatives: ['JavaScript', 'Go', 'Java'],
        marketShare: 48.2,
        trendsScore: 25
      },
      {
        name: 'Go',
        category: 'language',
        description: 'Statically typed language designed for simplicity and efficiency',
        pros: ['High performance', 'Concurrent programming', 'Fast compilation'],
        cons: ['Verbose error handling', 'Limited generics'],
        bestFor: ['Microservices', 'System programming', 'Cloud applications'],
        complexity: 'medium',
        maturity: 'stable',
        communitySupport: 'high',
        learningCurve: 'medium',
        dependencies: [],
        alternatives: ['Rust', 'JavaScript', 'Java'],
        marketShare: 11.5,
        trendsScore: 35
      }
    ];

    for (const profile of profiles) {
      this.technologyProfiles.set(profile.name.toLowerCase(), profile);
    }
  }

  /**
   * Get conflict matrix for technology compatibility
   */
  private getConflictMatrix(): Map<string, { reason: string; severity: 'warning' | 'error' }> {
    const conflicts = new Map<string, { reason: string; severity: 'warning' | 'error' }>();
    
    // Example conflicts
    conflicts.set('mysql-postgresql', {
      reason: 'Using multiple SQL databases may increase complexity',
      severity: 'warning'
    });
    
    conflicts.set('rest-graphql', {
      reason: 'Mixing REST and GraphQL APIs can confuse consumers',
      severity: 'warning'
    });

    return conflicts;
  }

  /**
   * Calculate future outlook for technology
   */
  private calculateFutureOutlook(profile: TechnologyProfile): 'promising' | 'stable' | 'uncertain' {
    if (profile.trendsScore > 20 && profile.communitySupport === 'high') {
      return 'promising';
    } else if (profile.maturity === 'mature' && profile.trendsScore > -10) {
      return 'stable';
    } else {
      return 'uncertain';
    }
  }

  /**
   * Map complexity to maintenance effort
   */
  private mapComplexityToMaintenance(complexity: string): 'low' | 'medium' | 'high' {
    const mapping: Record<string, 'low' | 'medium' | 'high'> = {
      'low': 'low',
      'medium': 'medium',
      'high': 'high'
    };
    return mapping[complexity] || 'medium';
  }

  /**
   * Get recommendation priority for sorting
   */
  private getRecommendationPriority(recommendation: WizardRecommendation): number {
    const severityPriority = {
      'error': 1,
      'warning': 2,
      'info': 3
    };
    
    const typePriority = {
      'technology': 1,
      'pattern': 2,
      'integration': 3,
      'best-practice': 4,
      'security': 1
    };

    return (severityPriority[recommendation.severity] * 10) + typePriority[recommendation.type];
  }
}