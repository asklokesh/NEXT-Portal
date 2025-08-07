import { ScaffolderTemplate, TemplateMarketplace, TemplateCategory, TemplateRating } from './types';

export class TemplateMarketplaceEngine {
  private static instance: TemplateMarketplaceEngine;
  private templates: Map<string, ScaffolderTemplate> = new Map();
  private ratings: Map<string, TemplateRating[]> = new Map();
  private downloads: Map<string, number> = new Map();
  private categories: TemplateCategory[] = [];
  private searchIndex: MarketplaceSearchIndex;
  private contentModerator: ContentModerator;
  private communityManager: CommunityManager;

  private constructor() {
    this.searchIndex = new MarketplaceSearchIndex();
    this.contentModerator = new ContentModerator();
    this.communityManager = new CommunityManager();
    this.initializeCategories();
  }

  static getInstance(): TemplateMarketplaceEngine {
    if (!this.instance) {
      this.instance = new TemplateMarketplaceEngine();
    }
    return this.instance;
  }

  /**
   * Get marketplace data with featured, trending, and recent templates
   */
  async getMarketplace(userId?: string): Promise<TemplateMarketplace> {
    const allTemplates = Array.from(this.templates.values());
    
    const featured = await this.getFeaturedTemplates();
    const trending = await this.getTrendingTemplates();
    const recent = await this.getRecentTemplates();

    // Personalize for user if provided
    if (userId) {
      return this.personalizeMarketplace({
        templates: allTemplates,
        categories: this.categories,
        featured: featured.map(t => t.id),
        trending: trending.map(t => t.id),
        recent: recent.map(t => t.id)
      }, userId);
    }

    return {
      templates: allTemplates,
      categories: this.categories,
      featured: featured.map(t => t.id),
      trending: trending.map(t => t.id),
      recent: recent.map(t => t.id)
    };
  }

  /**
   * Search templates in marketplace
   */
  async searchTemplates(
    query: string,
    filters: MarketplaceFilters = {},
    userId?: string
  ): Promise<MarketplaceSearchResult> {
    const searchResults = await this.searchIndex.search(query, filters);
    
    // Apply personalization if user provided
    if (userId) {
      return this.personalizeSearchResults(searchResults, userId);
    }

    return searchResults;
  }

  /**
   * Get template details with enhanced information
   */
  async getTemplateDetails(templateId: string, userId?: string): Promise<EnhancedTemplateDetails> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const ratings = this.ratings.get(templateId) || [];
    const downloadCount = this.downloads.get(templateId) || 0;
    const relatedTemplates = await this.findRelatedTemplates(template, 5);
    const usageStats = await this.getUsageStatistics(templateId);
    const reviews = await this.getReviews(templateId);

    // Check if user has used this template
    const userUsage = userId ? await this.getUserTemplateUsage(userId, templateId) : null;

    return {
      template,
      ratings,
      downloadCount,
      relatedTemplates,
      usageStats,
      reviews,
      userUsage,
      compatibility: await this.checkCompatibility(template),
      securityScan: await this.getSecurityScanResults(templateId)
    };
  }

  /**
   * Publish template to marketplace
   */
  async publishTemplate(
    template: ScaffolderTemplate,
    publisherUserId: string,
    publishOptions: PublishOptions = {}
  ): Promise<PublishResult> {
    // Validate template before publishing
    const validation = await this.validateTemplate(template);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        templateId: template.id
      };
    }

    // Content moderation
    const moderation = await this.contentModerator.moderate(template);
    if (!moderation.approved) {
      return {
        success: false,
        errors: moderation.reasons,
        templateId: template.id
      };
    }

    // Security scan
    const securityScan = await this.performSecurityScan(template);
    if (securityScan.hasIssues && !publishOptions.ignoreSecurityWarnings) {
      return {
        success: false,
        errors: [`Security issues found: ${securityScan.issues.join(', ')}`],
        templateId: template.id,
        warnings: securityScan.warnings
      };
    }

    // Enhance template with marketplace metadata
    const enhancedTemplate = await this.enhanceTemplateForMarketplace(
      template,
      publisherUserId,
      publishOptions
    );

    // Store template
    this.templates.set(template.id, enhancedTemplate);
    
    // Initialize ratings and downloads
    this.ratings.set(template.id, []);
    this.downloads.set(template.id, 0);

    // Index for search
    await this.searchIndex.indexTemplate(enhancedTemplate);

    // Notify community
    await this.communityManager.notifyNewTemplate(enhancedTemplate);

    return {
      success: true,
      templateId: template.id,
      message: 'Template published successfully'
    };
  }

  /**
   * Update existing template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<ScaffolderTemplate>,
    publisherUserId: string
  ): Promise<PublishResult> {
    const existingTemplate = this.templates.get(templateId);
    if (!existingTemplate) {
      return {
        success: false,
        errors: [`Template ${templateId} not found`],
        templateId
      };
    }

    // Check ownership or admin permissions
    if (!await this.canUserModifyTemplate(publisherUserId, existingTemplate)) {
      return {
        success: false,
        errors: ['Insufficient permissions to modify template'],
        templateId
      };
    }

    const updatedTemplate = {
      ...existingTemplate,
      ...updates,
      metadata: {
        ...existingTemplate.metadata,
        updated: new Date().toISOString()
      }
    };

    // Re-validate and scan
    const validation = await this.validateTemplate(updatedTemplate);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        templateId
      };
    }

    // Store updated template
    this.templates.set(templateId, updatedTemplate);
    
    // Re-index for search
    await this.searchIndex.updateTemplate(updatedTemplate);

    return {
      success: true,
      templateId,
      message: 'Template updated successfully'
    };
  }

  /**
   * Rate and review template
   */
  async rateTemplate(
    templateId: string,
    userId: string,
    rating: number,
    review?: string
  ): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const templateRatings = this.ratings.get(templateId) || [];
    
    // Remove existing rating from same user
    const filteredRatings = templateRatings.filter(r => r.userId !== userId);
    
    // Add new rating
    const newRating: TemplateRating = {
      templateId,
      userId,
      rating,
      review,
      timestamp: new Date().toISOString()
    };

    filteredRatings.push(newRating);
    this.ratings.set(templateId, filteredRatings);

    // Update template's average rating
    await this.updateTemplateRating(templateId, filteredRatings);

    // Notify template author
    await this.communityManager.notifyTemplateRating(template, newRating);
  }

  /**
   * Download template (increment counter and return template)
   */
  async downloadTemplate(templateId: string, userId?: string): Promise<ScaffolderTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Increment download counter
    const currentDownloads = this.downloads.get(templateId) || 0;
    this.downloads.set(templateId, currentDownloads + 1);

    // Update template metadata
    template.metadata.downloads = currentDownloads + 1;

    // Record download for analytics
    if (userId) {
      await this.recordDownload(templateId, userId);
    }

    return template;
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(
    categoryId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ScaffolderTemplate[]> {
    const category = this.categories.find(c => c.id === categoryId);
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    const templates = Array.from(this.templates.values())
      .filter(t => t.category === category.name)
      .sort((a, b) => b.metadata.downloads - a.metadata.downloads)
      .slice(offset, offset + limit);

    return templates;
  }

  /**
   * Get user's published templates
   */
  async getUserTemplates(userId: string): Promise<ScaffolderTemplate[]> {
    return Array.from(this.templates.values())
      .filter(t => t.author.email === userId) // Assuming email as userId
      .sort((a, b) => new Date(b.metadata.created).getTime() - new Date(a.metadata.created).getTime());
  }

  /**
   * Get community analytics
   */
  async getCommunityAnalytics(): Promise<CommunityAnalytics> {
    const totalTemplates = this.templates.size;
    const totalDownloads = Array.from(this.downloads.values()).reduce((sum, count) => sum + count, 0);
    const totalRatings = Array.from(this.ratings.values()).reduce((sum, ratings) => sum + ratings.length, 0);
    
    const averageRating = totalRatings > 0 
      ? Array.from(this.ratings.values())
          .flat()
          .reduce((sum, r) => sum + r.rating, 0) / totalRatings 
      : 0;

    const topCategories = this.getTopCategories();
    const topAuthors = await this.getTopAuthors();
    const growthMetrics = await this.getGrowthMetrics();

    return {
      totalTemplates,
      totalDownloads,
      totalRatings,
      averageRating,
      topCategories,
      topAuthors,
      growthMetrics,
      activeUsers: await this.getActiveUsersCount()
    };
  }

  // Private helper methods
  private async getFeaturedTemplates(): Promise<ScaffolderTemplate[]> {
    // Algorithm to select featured templates based on quality, ratings, and usage
    const templates = Array.from(this.templates.values());
    
    return templates
      .filter(t => t.metadata.rating >= 4.0 && t.metadata.downloads > 50)
      .sort((a, b) => {
        // Weight by rating and downloads
        const scoreA = a.metadata.rating * 0.6 + (a.metadata.downloads / 100) * 0.4;
        const scoreB = b.metadata.rating * 0.6 + (b.metadata.downloads / 100) * 0.4;
        return scoreB - scoreA;
      })
      .slice(0, 8);
  }

  private async getTrendingTemplates(): Promise<ScaffolderTemplate[]> {
    // Calculate trending based on recent download velocity
    const templates = Array.from(this.templates.values());
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

    const trending = templates
      .map(template => {
        const recentDownloads = this.getRecentDownloads(template.id, weekAgo);
        const trendScore = recentDownloads * 10 + template.metadata.rating;
        return { template, trendScore };
      })
      .filter(item => item.trendScore > 5)
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, 6)
      .map(item => item.template);

    return trending;
  }

  private async getRecentTemplates(): Promise<ScaffolderTemplate[]> {
    return Array.from(this.templates.values())
      .sort((a, b) => new Date(b.metadata.created).getTime() - new Date(a.metadata.created).getTime())
      .slice(0, 10);
  }

  private async personalizeMarketplace(
    marketplace: TemplateMarketplace,
    userId: string
  ): Promise<TemplateMarketplace> {
    // Get user's preferences and history
    const userProfile = await this.getUserProfile(userId);
    
    // Reorder templates based on user preferences
    const personalizedTemplates = this.reorderByUserPreferences(
      marketplace.templates,
      userProfile
    );

    // Add personalized recommendations
    const recommendations = await this.getPersonalizedRecommendations(userId);

    return {
      ...marketplace,
      templates: personalizedTemplates,
      recommendations: recommendations.map(r => r.id)
    };
  }

  private async validateTemplate(template: ScaffolderTemplate): Promise<ValidationResult> {
    const errors: string[] = [];

    // Basic validation
    if (!template.name) errors.push('Template name is required');
    if (!template.description) errors.push('Template description is required');
    if (!template.spec.steps.length) errors.push('Template must have at least one step');

    // Validate parameters
    for (const param of template.spec.parameters) {
      if (!param.name) errors.push('Parameter name is required');
      if (!param.title) errors.push('Parameter title is required');
      if (param.required === undefined) errors.push(`Parameter ${param.name} must specify if required`);
    }

    // Validate steps
    for (const step of template.spec.steps) {
      if (!step.name) errors.push('Step name is required');
      if (!step.action) errors.push('Step action is required');
    }

    // Category validation
    const validCategories = this.categories.map(c => c.name);
    if (!validCategories.includes(template.category)) {
      errors.push(`Invalid category: ${template.category}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: []
    };
  }

  private async enhanceTemplateForMarketplace(
    template: ScaffolderTemplate,
    publisherUserId: string,
    options: PublishOptions
  ): Promise<ScaffolderTemplate> {
    const enhanced = {
      ...template,
      metadata: {
        ...template.metadata,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        downloads: 0,
        rating: 0,
        publisherId: publisherUserId,
        visibility: options.visibility || 'public',
        license: options.license || 'MIT',
        verified: false // Will be set by moderation process
      }
    };

    // Add marketplace-specific tags
    enhanced.tags = [
      ...enhanced.tags,
      ...(options.additionalTags || []),
      'marketplace',
      `complexity-${enhanced.metadata.complexity}`
    ];

    return enhanced;
  }

  private async performSecurityScan(template: ScaffolderTemplate): Promise<SecurityScanResult> {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Scan template steps for security issues
    for (const step of template.spec.steps) {
      // Check for dangerous actions
      if (step.action === 'run:shell' && step.input.command) {
        if (step.input.command.includes('curl') || step.input.command.includes('wget')) {
          warnings.push(`Step ${step.name} downloads from external sources`);
        }
        if (step.input.command.includes('sudo')) {
          issues.push(`Step ${step.name} requires sudo access`);
        }
      }

      // Check for hardcoded secrets
      const inputString = JSON.stringify(step.input);
      if (inputString.includes('password') || inputString.includes('secret')) {
        warnings.push(`Step ${step.name} may contain hardcoded secrets`);
      }
    }

    // Check template URLs
    for (const step of template.spec.steps) {
      if (step.action === 'fetch:template' && step.input.url) {
        if (!step.input.url.startsWith('https://')) {
          warnings.push(`Step ${step.name} uses non-HTTPS URL`);
        }
      }
    }

    return {
      hasIssues: issues.length > 0,
      issues,
      warnings,
      scannedAt: new Date().toISOString()
    };
  }

  private async findRelatedTemplates(
    template: ScaffolderTemplate,
    limit: number
  ): Promise<ScaffolderTemplate[]> {
    const allTemplates = Array.from(this.templates.values())
      .filter(t => t.id !== template.id);

    const similarities = allTemplates.map(otherTemplate => ({
      template: otherTemplate,
      similarity: this.calculateTemplateSimilarity(template, otherTemplate)
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(item => item.template);
  }

  private calculateTemplateSimilarity(
    template1: ScaffolderTemplate,
    template2: ScaffolderTemplate
  ): number {
    let similarity = 0;

    // Category similarity
    if (template1.category === template2.category) similarity += 0.3;

    // Tag similarity
    const commonTags = template1.tags.filter(tag => template2.tags.includes(tag));
    similarity += (commonTags.length / Math.max(template1.tags.length, template2.tags.length)) * 0.4;

    // Complexity similarity
    if (template1.metadata.complexity === template2.metadata.complexity) similarity += 0.2;

    // Author similarity (same organization/domain)
    const domain1 = template1.author.email.split('@')[1];
    const domain2 = template2.author.email.split('@')[1];
    if (domain1 === domain2) similarity += 0.1;

    return similarity;
  }

  private async updateTemplateRating(
    templateId: string,
    ratings: TemplateRating[]
  ): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) return;

    const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    template.metadata.rating = Math.round(averageRating * 10) / 10; // Round to 1 decimal
  }

  private getRecentDownloads(templateId: string, since: number): number {
    // In a real implementation, this would query download history
    // For now, simulate based on template popularity
    const template = this.templates.get(templateId);
    if (!template) return 0;

    const recentFactor = Math.max(0, 1 - ((Date.now() - new Date(template.metadata.updated).getTime()) / (30 * 24 * 60 * 60 * 1000)));
    return Math.floor(template.metadata.downloads * 0.1 * recentFactor);
  }

  private async getUserProfile(userId: string): Promise<UserProfile> {
    // Mock user profile - in real implementation, would fetch from database
    return {
      userId,
      preferences: {
        technologies: ['typescript', 'react'],
        categories: ['Frontend', 'Backend'],
        complexity: 'medium'
      },
      usageHistory: []
    };
  }

  private reorderByUserPreferences(
    templates: ScaffolderTemplate[],
    userProfile: UserProfile
  ): ScaffolderTemplate[] {
    return templates.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Score based on preferred technologies
      const aTechMatch = a.tags.filter(tag => 
        userProfile.preferences.technologies.includes(tag)
      ).length;
      const bTechMatch = b.tags.filter(tag => 
        userProfile.preferences.technologies.includes(tag)
      ).length;

      scoreA += aTechMatch * 2;
      scoreB += bTechMatch * 2;

      // Score based on preferred categories
      if (userProfile.preferences.categories.includes(a.category)) scoreA += 1;
      if (userProfile.preferences.categories.includes(b.category)) scoreB += 1;

      // Score based on preferred complexity
      if (a.metadata.complexity === userProfile.preferences.complexity) scoreA += 1;
      if (b.metadata.complexity === userProfile.preferences.complexity) scoreB += 1;

      return scoreB - scoreA;
    });
  }

  private async getPersonalizedRecommendations(userId: string): Promise<ScaffolderTemplate[]> {
    // Use recommendation engine for personalized suggestions
    const userProfile = await this.getUserProfile(userId);
    const templates = Array.from(this.templates.values());
    
    return templates
      .filter(t => this.isRecommendedForUser(t, userProfile))
      .sort((a, b) => b.metadata.rating - a.metadata.rating)
      .slice(0, 5);
  }

  private isRecommendedForUser(template: ScaffolderTemplate, userProfile: UserProfile): boolean {
    // Simple recommendation logic
    const hasTechMatch = template.tags.some(tag => 
      userProfile.preferences.technologies.includes(tag)
    );
    const hasCategoryMatch = userProfile.preferences.categories.includes(template.category);
    const hasComplexityMatch = template.metadata.complexity === userProfile.preferences.complexity;

    return hasTechMatch || hasCategoryMatch || hasComplexityMatch;
  }

  private getTopCategories(): CategoryStats[] {
    const categoryStats = new Map<string, number>();
    
    Array.from(this.templates.values()).forEach(template => {
      const count = categoryStats.get(template.category) || 0;
      categoryStats.set(template.category, count + 1);
    });

    return Array.from(categoryStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));
  }

  private async getTopAuthors(): Promise<AuthorStats[]> {
    const authorStats = new Map<string, AuthorStat>();

    Array.from(this.templates.values()).forEach(template => {
      const authorEmail = template.author.email;
      const stat = authorStats.get(authorEmail) || {
        name: template.author.name,
        email: authorEmail,
        templatesCount: 0,
        totalDownloads: 0,
        averageRating: 0
      };

      stat.templatesCount++;
      stat.totalDownloads += template.metadata.downloads;
      stat.averageRating += template.metadata.rating;
      
      authorStats.set(authorEmail, stat);
    });

    // Calculate average ratings
    Array.from(authorStats.values()).forEach(stat => {
      stat.averageRating = stat.averageRating / stat.templatesCount;
    });

    return Array.from(authorStats.values())
      .sort((a, b) => b.totalDownloads - a.totalDownloads)
      .slice(0, 10);
  }

  private async getGrowthMetrics(): Promise<GrowthMetrics> {
    // Mock growth metrics - in real implementation, would calculate from historical data
    return {
      weeklyGrowth: 15,
      monthlyGrowth: 45,
      yearlyGrowth: 200,
      newTemplatesThisWeek: 5,
      newAuthorsThisMonth: 12
    };
  }

  private async getActiveUsersCount(): Promise<number> {
    // Mock active users count
    return 2500;
  }

  private async canUserModifyTemplate(userId: string, template: ScaffolderTemplate): Promise<boolean> {
    // Check if user is the author or has admin privileges
    return template.author.email === userId; // Simplified check
  }

  private async recordDownload(templateId: string, userId: string): Promise<void> {
    // Record download for analytics
    console.log(`User ${userId} downloaded template ${templateId}`);
  }

  private async getUsageStatistics(templateId: string): Promise<UsageStats> {
    // Mock usage statistics
    return {
      totalExecutions: Math.floor(Math.random() * 500),
      successRate: 0.85 + Math.random() * 0.1,
      averageExecutionTime: 180 + Math.random() * 300,
      popularParameters: ['name', 'description', 'technology']
    };
  }

  private async getReviews(templateId: string): Promise<TemplateReview[]> {
    const ratings = this.ratings.get(templateId) || [];
    return ratings
      .filter(r => r.review && r.review.length > 0)
      .map(r => ({
        userId: r.userId,
        rating: r.rating,
        review: r.review!,
        timestamp: r.timestamp
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }

  private async getUserTemplateUsage(userId: string, templateId: string): Promise<UserTemplateUsage | null> {
    // Mock user usage data
    return {
      hasUsed: Math.random() > 0.5,
      lastUsed: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      usageCount: Math.floor(Math.random() * 10),
      lastRating: Math.floor(Math.random() * 5) + 1
    };
  }

  private async checkCompatibility(template: ScaffolderTemplate): Promise<CompatibilityInfo> {
    return {
      backstageVersion: '1.20.0+',
      nodeVersion: '18.0.0+',
      requirements: ['Docker', 'Git'],
      conflicts: [],
      warnings: []
    };
  }

  private async getSecurityScanResults(templateId: string): Promise<SecurityScanResult> {
    // Return cached security scan results
    return {
      hasIssues: false,
      issues: [],
      warnings: [],
      scannedAt: new Date().toISOString()
    };
  }

  private initializeCategories(): void {
    this.categories = [
      {
        id: 'frontend',
        name: 'Frontend',
        description: 'Web and mobile frontend applications',
        icon: 'layout',
        templateCount: 0
      },
      {
        id: 'backend',
        name: 'Backend',
        description: 'API services and backend applications',
        icon: 'server',
        templateCount: 0
      },
      {
        id: 'fullstack',
        name: 'Full Stack',
        description: 'Complete applications with frontend and backend',
        icon: 'layers',
        templateCount: 0
      },
      {
        id: 'library',
        name: 'Library',
        description: 'Reusable libraries and components',
        icon: 'package',
        templateCount: 0
      },
      {
        id: 'infrastructure',
        name: 'Infrastructure',
        description: 'Infrastructure as code and deployment templates',
        icon: 'cloud',
        templateCount: 0
      },
      {
        id: 'data',
        name: 'Data',
        description: 'Data processing and analytics applications',
        icon: 'database',
        templateCount: 0
      },
      {
        id: 'ml',
        name: 'Machine Learning',
        description: 'ML models and data science projects',
        icon: 'brain',
        templateCount: 0
      },
      {
        id: 'devops',
        name: 'DevOps',
        description: 'CI/CD pipelines and automation tools',
        icon: 'git-branch',
        templateCount: 0
      }
    ];
  }
}

// Supporting classes
class MarketplaceSearchIndex {
  private index: Map<string, string[]> = new Map();

  async search(query: string, filters: MarketplaceFilters): Promise<MarketplaceSearchResult> {
    // Simplified search implementation
    // In a real implementation, would use Elasticsearch or similar
    const results: ScaffolderTemplate[] = [];
    const totalCount = 100; // Mock total

    return {
      templates: results,
      totalCount,
      facets: {
        categories: this.getFacetCounts('category'),
        technologies: this.getFacetCounts('technology'),
        complexity: this.getFacetCounts('complexity')
      },
      suggestions: this.getSearchSuggestions(query)
    };
  }

  async indexTemplate(template: ScaffolderTemplate): Promise<void> {
    // Index template for search
    const searchableText = [
      template.name,
      template.description,
      ...template.tags,
      template.category,
      template.author.name
    ].join(' ').toLowerCase();

    this.index.set(template.id, searchableText.split(' '));
  }

  async updateTemplate(template: ScaffolderTemplate): Promise<void> {
    await this.indexTemplate(template);
  }

  private getFacetCounts(field: string): FacetCount[] {
    // Mock facet counts
    return [
      { value: 'React', count: 45 },
      { value: 'Node.js', count: 38 },
      { value: 'TypeScript', count: 32 }
    ];
  }

  private getSearchSuggestions(query: string): string[] {
    // Mock search suggestions
    return ['react typescript', 'nodejs api', 'microservice docker'];
  }
}

class ContentModerator {
  async moderate(template: ScaffolderTemplate): Promise<ModerationResult> {
    const issues: string[] = [];

    // Check for inappropriate content
    if (this.hasInappropriateContent(template)) {
      issues.push('Contains inappropriate content');
    }

    // Check for spam patterns
    if (this.isSpam(template)) {
      issues.push('Appears to be spam');
    }

    // Check for malicious code
    if (await this.hasMaliciousCode(template)) {
      issues.push('Contains potentially malicious code');
    }

    return {
      approved: issues.length === 0,
      reasons: issues,
      reviewedAt: new Date().toISOString()
    };
  }

  private hasInappropriateContent(template: ScaffolderTemplate): boolean {
    const inappropriateWords = ['spam', 'hack', 'malicious'];
    const text = [template.name, template.description].join(' ').toLowerCase();
    
    return inappropriateWords.some(word => text.includes(word));
  }

  private isSpam(template: ScaffolderTemplate): boolean {
    // Simple spam detection
    const hasExcessiveCapitalization = /[A-Z]{5,}/.test(template.name);
    const hasRepeatedChars = /(.)\1{4,}/.test(template.name);
    
    return hasExcessiveCapitalization || hasRepeatedChars;
  }

  private async hasMaliciousCode(template: ScaffolderTemplate): boolean {
    // Check for potentially malicious patterns in template steps
    for (const step of template.spec.steps) {
      if (step.action === 'run:shell') {
        const command = step.input.command as string;
        if (command && this.isMaliciousCommand(command)) {
          return true;
        }
      }
    }
    return false;
  }

  private isMaliciousCommand(command: string): boolean {
    const maliciousPatterns = [
      'rm -rf /',
      'format c:',
      ':(){ :|:& };:',
      'curl.*|.*sh',
      'wget.*|.*sh'
    ];

    return maliciousPatterns.some(pattern => 
      new RegExp(pattern, 'i').test(command)
    );
  }
}

class CommunityManager {
  async notifyNewTemplate(template: ScaffolderTemplate): Promise<void> {
    // Notify community about new template
    console.log(`New template published: ${template.name} by ${template.author.name}`);
  }

  async notifyTemplateRating(template: ScaffolderTemplate, rating: TemplateRating): Promise<void> {
    // Notify template author about new rating
    console.log(`Template ${template.name} received ${rating.rating} star rating`);
  }
}

// Type definitions
interface MarketplaceFilters {
  categories?: string[];
  technologies?: string[];
  complexity?: string[];
  rating?: number;
  author?: string;
  sortBy?: 'popularity' | 'rating' | 'recent' | 'downloads';
  sortOrder?: 'asc' | 'desc';
}

interface MarketplaceSearchResult {
  templates: ScaffolderTemplate[];
  totalCount: number;
  facets: {
    categories: FacetCount[];
    technologies: FacetCount[];
    complexity: FacetCount[];
  };
  suggestions: string[];
}

interface FacetCount {
  value: string;
  count: number;
}

interface EnhancedTemplateDetails {
  template: ScaffolderTemplate;
  ratings: TemplateRating[];
  downloadCount: number;
  relatedTemplates: ScaffolderTemplate[];
  usageStats: UsageStats;
  reviews: TemplateReview[];
  userUsage: UserTemplateUsage | null;
  compatibility: CompatibilityInfo;
  securityScan: SecurityScanResult;
}

interface UsageStats {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  popularParameters: string[];
}

interface TemplateReview {
  userId: string;
  rating: number;
  review: string;
  timestamp: string;
}

interface UserTemplateUsage {
  hasUsed: boolean;
  lastUsed?: string;
  usageCount: number;
  lastRating?: number;
}

interface CompatibilityInfo {
  backstageVersion: string;
  nodeVersion: string;
  requirements: string[];
  conflicts: string[];
  warnings: string[];
}

interface PublishOptions {
  visibility?: 'public' | 'private' | 'unlisted';
  license?: string;
  additionalTags?: string[];
  ignoreSecurityWarnings?: boolean;
}

interface PublishResult {
  success: boolean;
  templateId: string;
  errors?: string[];
  warnings?: string[];
  message?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface SecurityScanResult {
  hasIssues: boolean;
  issues: string[];
  warnings: string[];
  scannedAt: string;
}

interface ModerationResult {
  approved: boolean;
  reasons: string[];
  reviewedAt: string;
}

interface CommunityAnalytics {
  totalTemplates: number;
  totalDownloads: number;
  totalRatings: number;
  averageRating: number;
  topCategories: CategoryStats[];
  topAuthors: AuthorStats[];
  growthMetrics: GrowthMetrics;
  activeUsers: number;
}

interface CategoryStats {
  category: string;
  count: number;
}

interface AuthorStats {
  name: string;
  email: string;
  templatesCount: number;
  totalDownloads: number;
  averageRating: number;
}

interface AuthorStat {
  name: string;
  email: string;
  templatesCount: number;
  totalDownloads: number;
  averageRating: number;
}

interface GrowthMetrics {
  weeklyGrowth: number;
  monthlyGrowth: number;
  yearlyGrowth: number;
  newTemplatesThisWeek: number;
  newAuthorsThisMonth: number;
}

interface UserProfile {
  userId: string;
  preferences: {
    technologies: string[];
    categories: string[];
    complexity: string;
  };
  usageHistory: any[];
}