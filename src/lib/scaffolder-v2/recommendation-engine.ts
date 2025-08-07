import { ScaffolderTemplate, TemplateRecommendation, AITemplateRequest } from './types';

export class TemplateRecommendationEngine {
  private static instance: TemplateRecommendationEngine;
  private userProfiles: Map<string, UserProfile> = new Map();
  private templateUsageData: Map<string, TemplateUsageData> = new Map();
  private contextAnalyzer: ContextAnalyzer;
  private mlModel: RecommendationMLModel;

  private constructor() {
    this.contextAnalyzer = new ContextAnalyzer();
    this.mlModel = new RecommendationMLModel();
  }

  static getInstance(): TemplateRecommendationEngine {
    if (!this.instance) {
      this.instance = new TemplateRecommendationEngine();
    }
    return this.instance;
  }

  /**
   * Get personalized template recommendations for a user
   */
  async getRecommendations(
    userId: string,
    context: RecommendationContext,
    limit: number = 10
  ): Promise<TemplateRecommendation[]> {
    const userProfile = await this.getUserProfile(userId);
    const availableTemplates = await this.getAvailableTemplates();
    
    const recommendations: TemplateRecommendation[] = [];

    for (const template of availableTemplates) {
      const score = await this.calculateRecommendationScore(
        template,
        userProfile,
        context
      );

      if (score.total > 0.3) { // Threshold for showing recommendations
        recommendations.push({
          template,
          score: score.total,
          reasoning: score.reasoning,
          context: score.breakdown
        });
      }
    }

    // Sort by score and apply ML model refinement
    recommendations.sort((a, b) => b.score - a.score);
    const refinedRecommendations = await this.mlModel.refineRecommendations(
      recommendations,
      userProfile,
      context
    );

    return refinedRecommendations.slice(0, limit);
  }

  /**
   * Get templates similar to a given template
   */
  async getSimilarTemplates(
    templateId: string,
    limit: number = 5
  ): Promise<TemplateRecommendation[]> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const allTemplates = await this.getAvailableTemplates();
    const similarities: TemplateRecommendation[] = [];

    for (const otherTemplate of allTemplates) {
      if (otherTemplate.id === templateId) continue;

      const similarity = await this.calculateTemplateSimilarity(
        template,
        otherTemplate
      );

      if (similarity.score > 0.4) {
        similarities.push({
          template: otherTemplate,
          score: similarity.score,
          reasoning: similarity.reasoning,
          context: {
            similarUsage: similarity.breakdown.technology,
            teamMatch: similarity.breakdown.category,
            technologyFit: similarity.breakdown.complexity,
            projectMatch: similarity.breakdown.metadata
          }
        });
      }
    }

    return similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get trending templates based on recent usage
   */
  async getTrendingTemplates(
    timeWindow: 'day' | 'week' | 'month' = 'week',
    limit: number = 10
  ): Promise<TemplateRecommendation[]> {
    const timeThreshold = this.getTimeThreshold(timeWindow);
    const templates = await this.getAvailableTemplates();
    const trending: TemplateRecommendation[] = [];

    for (const template of templates) {
      const usage = this.templateUsageData.get(template.id);
      if (!usage) continue;

      const recentUsage = usage.usageHistory.filter(
        u => new Date(u.timestamp) >= timeThreshold
      );

      if (recentUsage.length > 0) {
        const trendScore = this.calculateTrendScore(recentUsage, usage);
        
        trending.push({
          template,
          score: trendScore.score,
          reasoning: trendScore.reasoning,
          context: {
            similarUsage: recentUsage.length,
            teamMatch: usage.successRate,
            technologyFit: template.metadata.rating,
            projectMatch: trendScore.growthRate
          }
        });
      }
    }

    return trending
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get context-aware recommendations based on project analysis
   */
  async getContextualRecommendations(
    projectContext: ProjectContext,
    limit: number = 8
  ): Promise<TemplateRecommendation[]> {
    const analyzedContext = await this.contextAnalyzer.analyze(projectContext);
    const templates = await this.getAvailableTemplates();
    const contextual: TemplateRecommendation[] = [];

    for (const template of templates) {
      const contextMatch = await this.calculateContextMatch(
        template,
        analyzedContext
      );

      if (contextMatch.score > 0.5) {
        contextual.push({
          template,
          score: contextMatch.score,
          reasoning: contextMatch.reasoning,
          context: contextMatch.breakdown
        });
      }
    }

    return contextual
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get smart recommendations based on natural language query
   */
  async getSmartRecommendations(
    query: string,
    userId?: string,
    limit: number = 5
  ): Promise<TemplateRecommendation[]> {
    const intentAnalysis = await this.analyzeIntent(query);
    const templates = await this.getAvailableTemplates();
    const userProfile = userId ? await this.getUserProfile(userId) : null;

    const smart: TemplateRecommendation[] = [];

    for (const template of templates) {
      const relevance = await this.calculateQueryRelevance(
        template,
        intentAnalysis,
        userProfile
      );

      if (relevance.score > 0.4) {
        smart.push({
          template,
          score: relevance.score,
          reasoning: relevance.reasoning,
          context: {
            similarUsage: relevance.intentMatch,
            teamMatch: relevance.userMatch,
            technologyFit: relevance.techMatch,
            projectMatch: relevance.complexityMatch
          }
        });
      }
    }

    return smart
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Record template usage for learning
   */
  async recordUsage(
    templateId: string,
    userId: string,
    context: UsageContext,
    outcome: UsageOutcome
  ): Promise<void> {
    // Update user profile
    const userProfile = await this.getUserProfile(userId);
    userProfile.updateUsage(templateId, context, outcome);
    this.userProfiles.set(userId, userProfile);

    // Update template usage data
    let usage = this.templateUsageData.get(templateId);
    if (!usage) {
      usage = new TemplateUsageData(templateId);
      this.templateUsageData.set(templateId, usage);
    }
    
    usage.recordUsage(userId, context, outcome);

    // Feed data to ML model for learning
    await this.mlModel.learn(templateId, userId, context, outcome);
  }

  /**
   * Get template usage analytics
   */
  async getUsageAnalytics(templateId: string): Promise<TemplateAnalytics> {
    const usage = this.templateUsageData.get(templateId);
    if (!usage) {
      throw new Error(`No usage data found for template ${templateId}`);
    }

    return {
      totalUsages: usage.usageHistory.length,
      successRate: usage.successRate,
      averageRating: usage.averageRating,
      popularTechnologies: usage.getPopularTechnologies(),
      userDistribution: usage.getUserDistribution(),
      timeDistribution: usage.getTimeDistribution(),
      conversionRate: usage.conversionRate
    };
  }

  // Private helper methods
  private async getUserProfile(userId: string): Promise<UserProfile> {
    let profile = this.userProfiles.get(userId);
    if (!profile) {
      profile = new UserProfile(userId);
      this.userProfiles.set(userId, profile);
    }
    return profile;
  }

  private async getAvailableTemplates(): Promise<ScaffolderTemplate[]> {
    // In a real implementation, this would fetch from database
    // For now, return mock data
    return [];
  }

  private async getTemplate(templateId: string): Promise<ScaffolderTemplate | null> {
    const templates = await this.getAvailableTemplates();
    return templates.find(t => t.id === templateId) || null;
  }

  private async calculateRecommendationScore(
    template: ScaffolderTemplate,
    userProfile: UserProfile,
    context: RecommendationContext
  ): Promise<RecommendationScore> {
    const weights = {
      userHistory: 0.3,
      templatePopularity: 0.2,
      contextMatch: 0.25,
      technologyFit: 0.15,
      recency: 0.1
    };

    const userHistoryScore = this.calculateUserHistoryScore(template, userProfile);
    const popularityScore = this.calculatePopularityScore(template);
    const contextScore = await this.calculateContextScore(template, context);
    const technologyScore = this.calculateTechnologyScore(template, context);
    const recencyScore = this.calculateRecencyScore(template);

    const total = 
      userHistoryScore * weights.userHistory +
      popularityScore * weights.templatePopularity +
      contextScore * weights.contextMatch +
      technologyScore * weights.technologyFit +
      recencyScore * weights.recency;

    return {
      total,
      reasoning: this.generateScoreReasoning(template, {
        userHistory: userHistoryScore,
        popularity: popularityScore,
        context: contextScore,
        technology: technologyScore,
        recency: recencyScore
      }),
      breakdown: {
        similarUsage: userHistoryScore,
        teamMatch: contextScore,
        technologyFit: technologyScore,
        projectMatch: popularityScore
      }
    };
  }

  private calculateUserHistoryScore(
    template: ScaffolderTemplate,
    userProfile: UserProfile
  ): number {
    // Score based on user's past template usage patterns
    let score = 0.5; // Base score

    // Check technology preferences
    const userTechPrefs = userProfile.getTechnologyPreferences();
    const templateTechs = template.tags.filter(tag => 
      userTechPrefs.some(pref => pref.technology === tag)
    );
    
    if (templateTechs.length > 0) {
      score += 0.3 * (templateTechs.length / template.tags.length);
    }

    // Check category preferences
    const categoryPref = userProfile.getCategoryPreference(template.category);
    score += categoryPref * 0.2;

    // Check complexity match
    const complexityMatch = userProfile.getComplexityPreference(template.metadata.complexity);
    score += complexityMatch * 0.1;

    return Math.min(score, 1.0);
  }

  private calculatePopularityScore(template: ScaffolderTemplate): number {
    const maxDownloads = 10000; // Normalize against this value
    const downloadScore = Math.min(template.metadata.downloads / maxDownloads, 1.0);
    const ratingScore = template.metadata.rating / 5.0;
    
    return (downloadScore * 0.6) + (ratingScore * 0.4);
  }

  private async calculateContextScore(
    template: ScaffolderTemplate,
    context: RecommendationContext
  ): Promise<number> {
    let score = 0;

    // Project type match
    if (context.projectType && template.category.toLowerCase().includes(context.projectType.toLowerCase())) {
      score += 0.4;
    }

    // Team size considerations
    if (context.teamSize) {
      const templateComplexity = template.metadata.complexity;
      const isAppropriate = this.isComplexityAppropriateForTeam(templateComplexity, context.teamSize);
      if (isAppropriate) score += 0.3;
    }

    // Deadline considerations
    if (context.urgency) {
      const estimatedTime = this.parseEstimatedTime(template.metadata.estimatedTime);
      const isWithinDeadline = this.isWithinDeadline(estimatedTime, context.urgency);
      if (isWithinDeadline) score += 0.3;
    }

    return Math.min(score, 1.0);
  }

  private calculateTechnologyScore(
    template: ScaffolderTemplate,
    context: RecommendationContext
  ): number {
    if (!context.preferredTechnologies || context.preferredTechnologies.length === 0) {
      return 0.5; // Neutral score
    }

    const matchingTechs = template.tags.filter(tag =>
      context.preferredTechnologies!.some(tech => 
        tech.toLowerCase().includes(tag.toLowerCase()) || 
        tag.toLowerCase().includes(tech.toLowerCase())
      )
    );

    return matchingTechs.length / Math.max(context.preferredTechnologies.length, template.tags.length);
  }

  private calculateRecencyScore(template: ScaffolderTemplate): number {
    const now = new Date();
    const updated = new Date(template.metadata.updated);
    const daysSinceUpdate = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
    
    // More recent updates get higher scores
    if (daysSinceUpdate < 30) return 1.0;
    if (daysSinceUpdate < 90) return 0.8;
    if (daysSinceUpdate < 180) return 0.6;
    if (daysSinceUpdate < 365) return 0.4;
    return 0.2;
  }

  private async calculateTemplateSimilarity(
    template1: ScaffolderTemplate,
    template2: ScaffolderTemplate
  ): Promise<SimilarityScore> {
    let score = 0;
    const breakdown = { technology: 0, category: 0, complexity: 0, metadata: 0 };

    // Technology similarity
    const commonTechs = template1.tags.filter(tag => template2.tags.includes(tag));
    breakdown.technology = commonTechs.length / Math.max(template1.tags.length, template2.tags.length);
    score += breakdown.technology * 0.4;

    // Category similarity
    breakdown.category = template1.category === template2.category ? 1.0 : 0.0;
    score += breakdown.category * 0.3;

    // Complexity similarity
    const complexityMap = { simple: 1, medium: 2, complex: 3 };
    const diff = Math.abs(
      complexityMap[template1.metadata.complexity] - 
      complexityMap[template2.metadata.complexity]
    );
    breakdown.complexity = 1.0 - (diff / 2);
    score += breakdown.complexity * 0.2;

    // Metadata similarity (author, ratings, etc.)
    breakdown.metadata = template1.author.email === template2.author.email ? 0.5 : 0.0;
    score += breakdown.metadata * 0.1;

    return {
      score,
      reasoning: `Templates share ${(breakdown.technology * 100).toFixed(0)}% technology overlap, same category: ${breakdown.category === 1.0}, complexity match: ${(breakdown.complexity * 100).toFixed(0)}%`,
      breakdown
    };
  }

  private calculateTrendScore(
    recentUsage: UsageRecord[],
    overallUsage: TemplateUsageData
  ): TrendScore {
    const totalUsage = overallUsage.usageHistory.length;
    const recentCount = recentUsage.length;
    
    // Calculate growth rate
    const recentPeriodRatio = recentCount / Math.max(totalUsage, 1);
    const growthRate = recentPeriodRatio > 0.3 ? recentPeriodRatio : 0;
    
    // Calculate velocity (usage per day)
    const daysCovered = this.calculateDaysCovered(recentUsage);
    const velocity = daysCovered > 0 ? recentCount / daysCovered : 0;
    
    const score = Math.min((growthRate * 0.6) + (velocity * 0.4), 1.0);
    
    return {
      score,
      reasoning: `Growing ${(growthRate * 100).toFixed(0)}% usage rate with ${velocity.toFixed(1)} uses/day`,
      growthRate,
      velocity
    };
  }

  private async calculateContextMatch(
    template: ScaffolderTemplate,
    context: AnalyzedProjectContext
  ): Promise<ContextMatchScore> {
    let score = 0;
    const reasoning: string[] = [];

    // Technology stack match
    const techMatch = this.calculateTechStackMatch(template.tags, context.detectedTechnologies);
    score += techMatch * 0.4;
    if (techMatch > 0.7) reasoning.push(`Strong technology match (${(techMatch * 100).toFixed(0)}%)`);

    // Architecture pattern match
    const archMatch = this.calculateArchitectureMatch(template, context.suggestedArchitecture);
    score += archMatch * 0.3;
    if (archMatch > 0.6) reasoning.push(`Architecture alignment (${(archMatch * 100).toFixed(0)}%)`);

    // Complexity appropriateness
    const complexityMatch = this.calculateComplexityMatch(template.metadata.complexity, context.projectComplexity);
    score += complexityMatch * 0.2;
    if (complexityMatch > 0.8) reasoning.push('Appropriate complexity level');

    // Integration requirements
    const integrationMatch = this.calculateIntegrationMatch(template, context.requiredIntegrations);
    score += integrationMatch * 0.1;
    if (integrationMatch > 0.5) reasoning.push('Supports required integrations');

    return {
      score,
      reasoning: reasoning.join(', '),
      breakdown: {
        similarUsage: techMatch,
        teamMatch: archMatch,
        technologyFit: complexityMatch,
        projectMatch: integrationMatch
      }
    };
  }

  private async analyzeIntent(query: string): Promise<IntentAnalysis> {
    // Simulate AI-powered intent analysis
    const intent = {
      primaryIntent: 'create',
      entities: this.extractEntities(query),
      technologies: this.extractTechnologies(query),
      complexity: this.extractComplexity(query),
      urgency: this.extractUrgency(query),
      confidence: 0.8
    };

    return intent;
  }

  private async calculateQueryRelevance(
    template: ScaffolderTemplate,
    intent: IntentAnalysis,
    userProfile: UserProfile | null
  ): Promise<QueryRelevanceScore> {
    let score = 0;

    // Intent match
    const intentMatch = this.calculateIntentMatch(template, intent);
    score += intentMatch * 0.4;

    // Technology match
    const techMatch = this.calculateTechStackMatch(template.tags, intent.technologies);
    score += techMatch * 0.3;

    // User preference match (if user profile available)
    const userMatch = userProfile ? this.calculateUserHistoryScore(template, userProfile) : 0.5;
    score += userMatch * 0.2;

    // Complexity match
    const complexityMatch = template.metadata.complexity === intent.complexity ? 1.0 : 0.5;
    score += complexityMatch * 0.1;

    return {
      score,
      reasoning: `Intent match: ${(intentMatch * 100).toFixed(0)}%, Tech match: ${(techMatch * 100).toFixed(0)}%`,
      intentMatch,
      userMatch,
      techMatch,
      complexityMatch
    };
  }

  // Utility methods
  private getTimeThreshold(timeWindow: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (timeWindow) {
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  private generateScoreReasoning(template: ScaffolderTemplate, scores: any): string {
    const reasons = [];
    
    if (scores.userHistory > 0.7) reasons.push('matches your preferences');
    if (scores.popularity > 0.7) reasons.push('highly rated by community');
    if (scores.context > 0.7) reasons.push('fits your project context');
    if (scores.technology > 0.7) reasons.push('uses preferred technologies');
    if (scores.recency > 0.8) reasons.push('recently updated');

    return reasons.length > 0 
      ? `Recommended because it ${reasons.join(', ')}`
      : 'Good general-purpose template';
  }

  private isComplexityAppropriateForTeam(complexity: string, teamSize: number): boolean {
    if (teamSize <= 2) return complexity === 'simple';
    if (teamSize <= 5) return complexity === 'simple' || complexity === 'medium';
    return true; // Large teams can handle any complexity
  }

  private parseEstimatedTime(timeString: string): number {
    // Parse time strings like "5-15 minutes" into minutes
    const match = timeString.match(/(\d+)(?:-(\d+))?\s*minutes?/);
    if (match) {
      const min = parseInt(match[1]);
      const max = match[2] ? parseInt(match[2]) : min;
      return (min + max) / 2;
    }
    return 30; // Default to 30 minutes
  }

  private isWithinDeadline(estimatedMinutes: number, urgency: string): boolean {
    const urgencyLimits = {
      low: 120,      // 2 hours
      medium: 60,    // 1 hour
      high: 30       // 30 minutes
    };
    
    return estimatedMinutes <= (urgencyLimits[urgency as keyof typeof urgencyLimits] || 60);
  }

  private calculateDaysCovered(usageRecords: UsageRecord[]): number {
    if (usageRecords.length === 0) return 0;
    
    const timestamps = usageRecords.map(r => new Date(r.timestamp).getTime());
    const earliest = Math.min(...timestamps);
    const latest = Math.max(...timestamps);
    
    return Math.max(1, Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24)));
  }

  private calculateTechStackMatch(templateTags: string[], contextTechs: string[]): number {
    if (contextTechs.length === 0) return 0.5;
    
    const matches = templateTags.filter(tag =>
      contextTechs.some(tech => 
        tech.toLowerCase().includes(tag.toLowerCase()) ||
        tag.toLowerCase().includes(tech.toLowerCase())
      )
    );
    
    return matches.length / Math.max(templateTags.length, contextTechs.length);
  }

  private calculateArchitectureMatch(template: ScaffolderTemplate, architecture: string): number {
    // Simplified architecture matching
    const archKeywords = {
      microservice: ['microservice', 'service', 'api'],
      monolith: ['monolith', 'full-stack', 'app'],
      serverless: ['serverless', 'lambda', 'function'],
      library: ['library', 'package', 'component']
    };

    const templateArch = template.category.toLowerCase();
    const keywords = archKeywords[architecture as keyof typeof archKeywords] || [];
    
    return keywords.some(keyword => templateArch.includes(keyword)) ? 1.0 : 0.3;
  }

  private calculateComplexityMatch(templateComplexity: string, projectComplexity: string): number {
    if (templateComplexity === projectComplexity) return 1.0;
    
    const complexityOrder = ['simple', 'medium', 'complex'];
    const templateIdx = complexityOrder.indexOf(templateComplexity);
    const projectIdx = complexityOrder.indexOf(projectComplexity);
    
    const diff = Math.abs(templateIdx - projectIdx);
    return Math.max(0, 1.0 - (diff * 0.3));
  }

  private calculateIntegrationMatch(template: ScaffolderTemplate, integrations: string[]): number {
    if (integrations.length === 0) return 0.5;
    
    const templateIntegrations = template.tags.filter(tag =>
      integrations.some(integration => 
        tag.toLowerCase().includes(integration.toLowerCase())
      )
    );
    
    return templateIntegrations.length / integrations.length;
  }

  private calculateIntentMatch(template: ScaffolderTemplate, intent: IntentAnalysis): number {
    // Map intents to template categories/types
    const intentMappings = {
      create: ['service', 'app', 'component'],
      deploy: ['deployment', 'infrastructure'],
      test: ['testing', 'quality'],
      monitor: ['monitoring', 'observability']
    };

    const expectedTypes = intentMappings[intent.primaryIntent as keyof typeof intentMappings] || [];
    const templateType = template.category.toLowerCase();
    
    return expectedTypes.some(type => templateType.includes(type)) ? 1.0 : 0.3;
  }

  private extractEntities(query: string): string[] {
    // Simplified entity extraction
    const entities = [];
    const entityPatterns = {
      project: /\b(project|app|application|service)\b/gi,
      database: /\b(database|db|postgres|mysql|mongo)\b/gi,
      frontend: /\b(frontend|ui|react|vue|angular)\b/gi,
      backend: /\b(backend|api|server)\b/gi
    };

    for (const [entity, pattern] of Object.entries(entityPatterns)) {
      if (pattern.test(query)) {
        entities.push(entity);
      }
    }

    return entities;
  }

  private extractTechnologies(query: string): string[] {
    const techKeywords = [
      'react', 'vue', 'angular', 'typescript', 'javascript', 'node',
      'python', 'java', 'go', 'rust', 'docker', 'kubernetes',
      'postgres', 'mysql', 'mongodb', 'redis', 'aws', 'gcp', 'azure'
    ];

    const queryLower = query.toLowerCase();
    return techKeywords.filter(tech => queryLower.includes(tech));
  }

  private extractComplexity(query: string): string {
    if (/\b(simple|basic|minimal|quick)\b/i.test(query)) return 'simple';
    if (/\b(complex|advanced|enterprise|sophisticated)\b/i.test(query)) return 'complex';
    return 'medium';
  }

  private extractUrgency(query: string): string {
    if (/\b(urgent|asap|immediately|critical)\b/i.test(query)) return 'high';
    if (/\b(soon|quick|fast)\b/i.test(query)) return 'medium';
    return 'low';
  }
}

// Supporting classes and interfaces
class UserProfile {
  constructor(
    public userId: string,
    public preferences: UserPreferences = {},
    public usageHistory: TemplateUsage[] = [],
    public ratings: TemplateRating[] = []
  ) {}

  updateUsage(templateId: string, context: UsageContext, outcome: UsageOutcome): void {
    this.usageHistory.push({
      templateId,
      timestamp: new Date().toISOString(),
      context,
      outcome
    });

    // Keep only last 100 usages
    if (this.usageHistory.length > 100) {
      this.usageHistory = this.usageHistory.slice(-100);
    }
  }

  getTechnologyPreferences(): TechPreference[] {
    const techUsage = new Map<string, number>();
    
    for (const usage of this.usageHistory) {
      if (usage.outcome.success && usage.context.technologies) {
        for (const tech of usage.context.technologies) {
          techUsage.set(tech, (techUsage.get(tech) || 0) + 1);
        }
      }
    }

    return Array.from(techUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([technology, count]) => ({ technology, preference: count / this.usageHistory.length }));
  }

  getCategoryPreference(category: string): number {
    const categoryUsages = this.usageHistory.filter(u => 
      u.context.category === category && u.outcome.success
    );
    return categoryUsages.length / Math.max(this.usageHistory.length, 1);
  }

  getComplexityPreference(complexity: string): number {
    const complexityUsages = this.usageHistory.filter(u =>
      u.context.complexity === complexity && u.outcome.success
    );
    return complexityUsages.length / Math.max(this.usageHistory.length, 1);
  }
}

class TemplateUsageData {
  public usageHistory: UsageRecord[] = [];
  public successRate = 0;
  public averageRating = 0;
  public conversionRate = 0;

  constructor(public templateId: string) {}

  recordUsage(userId: string, context: UsageContext, outcome: UsageOutcome): void {
    this.usageHistory.push({
      userId,
      timestamp: new Date().toISOString(),
      context,
      outcome
    });

    this.updateMetrics();
  }

  private updateMetrics(): void {
    const successful = this.usageHistory.filter(u => u.outcome.success);
    this.successRate = successful.length / this.usageHistory.length;

    const ratings = this.usageHistory
      .map(u => u.outcome.rating)
      .filter(r => r !== undefined) as number[];
    
    this.averageRating = ratings.length > 0 
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
      : 0;

    // Conversion rate: users who completed vs started
    const completed = this.usageHistory.filter(u => u.outcome.completed);
    this.conversionRate = completed.length / this.usageHistory.length;
  }

  getPopularTechnologies(): string[] {
    const techCount = new Map<string, number>();
    
    for (const usage of this.usageHistory) {
      if (usage.context.technologies) {
        for (const tech of usage.context.technologies) {
          techCount.set(tech, (techCount.get(tech) || 0) + 1);
        }
      }
    }

    return Array.from(techCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tech]) => tech);
  }

  getUserDistribution(): { uniqueUsers: number; repeatUsers: number } {
    const userIds = new Set(this.usageHistory.map(u => u.userId));
    const uniqueUsers = userIds.size;
    const repeatUsers = this.usageHistory.length - uniqueUsers;
    
    return { uniqueUsers, repeatUsers };
  }

  getTimeDistribution(): { [hour: number]: number } {
    const hourCounts: { [hour: number]: number } = {};
    
    for (const usage of this.usageHistory) {
      const hour = new Date(usage.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }

    return hourCounts;
  }
}

class ContextAnalyzer {
  async analyze(context: ProjectContext): Promise<AnalyzedProjectContext> {
    return {
      detectedTechnologies: this.detectTechnologies(context),
      suggestedArchitecture: this.suggestArchitecture(context),
      projectComplexity: this.assessComplexity(context),
      requiredIntegrations: this.identifyIntegrations(context),
      teamStructure: this.analyzeTeamStructure(context),
      deploymentRequirements: this.analyzeDeployment(context)
    };
  }

  private detectTechnologies(context: ProjectContext): string[] {
    // Analyze project files, dependencies, etc.
    return context.existingTechnologies || [];
  }

  private suggestArchitecture(context: ProjectContext): string {
    // AI-powered architecture suggestion
    if (context.projectType?.includes('micro')) return 'microservice';
    if (context.projectType?.includes('library')) return 'library';
    return 'monolith';
  }

  private assessComplexity(context: ProjectContext): string {
    let complexityScore = 0;
    
    if (context.teamSize && context.teamSize > 5) complexityScore += 1;
    if (context.expectedFeatures && context.expectedFeatures > 10) complexityScore += 1;
    if (context.integrationRequirements && context.integrationRequirements.length > 3) complexityScore += 1;

    if (complexityScore >= 2) return 'complex';
    if (complexityScore >= 1) return 'medium';
    return 'simple';
  }

  private identifyIntegrations(context: ProjectContext): string[] {
    return context.integrationRequirements || [];
  }

  private analyzeTeamStructure(context: ProjectContext): any {
    return {
      size: context.teamSize || 1,
      experience: context.teamExperience || 'medium',
      structure: context.teamSize && context.teamSize > 5 ? 'distributed' : 'small'
    };
  }

  private analyzeDeployment(context: ProjectContext): any {
    return {
      target: context.deploymentTarget || 'cloud',
      scale: context.expectedScale || 'small',
      requirements: context.deploymentRequirements || []
    };
  }
}

class RecommendationMLModel {
  async refineRecommendations(
    recommendations: TemplateRecommendation[],
    userProfile: UserProfile,
    context: RecommendationContext
  ): Promise<TemplateRecommendation[]> {
    // Simulate ML model refinement
    return recommendations.map(rec => ({
      ...rec,
      score: rec.score * (0.9 + Math.random() * 0.2) // Add some ML magic
    })).sort((a, b) => b.score - a.score);
  }

  async learn(
    templateId: string,
    userId: string,
    context: UsageContext,
    outcome: UsageOutcome
  ): Promise<void> {
    // Store learning data for future model training
    console.log(`Learning from usage: ${templateId} by ${userId} - ${outcome.success ? 'success' : 'failure'}`);
  }
}

// Type definitions
interface RecommendationContext {
  projectType?: string;
  teamSize?: number;
  urgency?: string;
  preferredTechnologies?: string[];
  deploymentTarget?: string;
  budget?: number;
}

interface ProjectContext {
  existingTechnologies?: string[];
  projectType?: string;
  teamSize?: number;
  teamExperience?: string;
  expectedFeatures?: number;
  integrationRequirements?: string[];
  deploymentTarget?: string;
  expectedScale?: string;
  deploymentRequirements?: string[];
}

interface AnalyzedProjectContext {
  detectedTechnologies: string[];
  suggestedArchitecture: string;
  projectComplexity: string;
  requiredIntegrations: string[];
  teamStructure: any;
  deploymentRequirements: any;
}

interface UserPreferences {
  favoriteCategories?: string[];
  preferredComplexity?: string;
  avoidedTechnologies?: string[];
  defaultDeploymentTarget?: string;
}

interface TemplateUsage {
  templateId: string;
  timestamp: string;
  context: UsageContext;
  outcome: UsageOutcome;
}

interface UsageContext {
  technologies?: string[];
  category?: string;
  complexity?: string;
  teamSize?: number;
  projectType?: string;
}

interface UsageOutcome {
  success: boolean;
  completed: boolean;
  rating?: number;
  feedback?: string;
  executionTime?: number;
  errors?: string[];
}

interface UsageRecord {
  userId: string;
  timestamp: string;
  context: UsageContext;
  outcome: UsageOutcome;
}

interface TechPreference {
  technology: string;
  preference: number;
}

interface RecommendationScore {
  total: number;
  reasoning: string;
  breakdown: {
    similarUsage: number;
    teamMatch: number;
    technologyFit: number;
    projectMatch: number;
  };
}

interface SimilarityScore {
  score: number;
  reasoning: string;
  breakdown: {
    technology: number;
    category: number;
    complexity: number;
    metadata: number;
  };
}

interface TrendScore {
  score: number;
  reasoning: string;
  growthRate: number;
  velocity: number;
}

interface ContextMatchScore {
  score: number;
  reasoning: string;
  breakdown: {
    similarUsage: number;
    teamMatch: number;
    technologyFit: number;
    projectMatch: number;
  };
}

interface IntentAnalysis {
  primaryIntent: string;
  entities: string[];
  technologies: string[];
  complexity: string;
  urgency: string;
  confidence: number;
}

interface QueryRelevanceScore {
  score: number;
  reasoning: string;
  intentMatch: number;
  userMatch: number;
  techMatch: number;
  complexityMatch: number;
}

interface TemplateAnalytics {
  totalUsages: number;
  successRate: number;
  averageRating: number;
  popularTechnologies: string[];
  userDistribution: {
    uniqueUsers: number;
    repeatUsers: number;
  };
  timeDistribution: { [hour: number]: number };
  conversionRate: number;
}