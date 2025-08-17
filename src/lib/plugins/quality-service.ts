/**
 * Plugin Quality Grading Service
 * Calculates quality grades (A-F) based on health metrics and metadata
 */

export type QualityGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface QualityMetrics {
  healthScore: number; // 0-100
  downloads: number;
  stars: number;
  lastUpdated: string;
  hasDocumentation: boolean;
  hasTests: boolean;
  hasTyping: boolean;
  vulnerabilityCount: number;
  maintainerResponseTime: number; // in hours
  communityActivity: number; // 0-100
}

export interface QualityResult {
  grade: QualityGrade;
  score: number;
  breakdown: {
    health: number;
    popularity: number;
    maintenance: number;
    security: number;
    documentation: number;
  };
  recommendations: string[];
}

/**
 * Calculate quality grade based on health score and other metrics
 * A: 90-100% health + high quality indicators
 * B: 80-89% health + good quality indicators  
 * C: 70-79% health + average quality indicators
 * D: 60-69% health + poor quality indicators
 * F: 0-59% health or critical issues
 */
export function calculateQualityGrade(metrics: Partial<QualityMetrics>): QualityResult {
  const {
    healthScore = 0,
    downloads = 0,
    stars = 0,
    lastUpdated,
    hasDocumentation = false,
    hasTests = false,
    hasTyping = false,
    vulnerabilityCount = 0,
    maintainerResponseTime = 168, // 1 week default
    communityActivity = 0
  } = metrics;

  // Calculate component scores (0-100)
  const healthComponent = Math.max(0, Math.min(100, healthScore));
  
  // Popularity score based on downloads and stars
  const popularityComponent = Math.min(100, 
    (Math.log10(downloads + 1) * 10) + (Math.log10(stars + 1) * 5)
  );

  // Maintenance score based on last update and response time
  const daysSinceUpdate = lastUpdated ? 
    (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24) : 365;
  const updateScore = Math.max(0, 100 - (daysSinceUpdate / 30) * 10); // Penalize old updates
  const responseScore = Math.max(0, 100 - (maintainerResponseTime / 24) * 5); // Penalize slow response
  const maintenanceComponent = (updateScore + responseScore + communityActivity) / 3;

  // Security score (vulnerabilities heavily penalize)
  const securityComponent = Math.max(0, 100 - (vulnerabilityCount * 25));

  // Documentation score
  const docScore = (hasDocumentation ? 50 : 0) + (hasTests ? 30 : 0) + (hasTyping ? 20 : 0);
  const documentationComponent = Math.min(100, docScore);

  // Weighted overall score
  const weights = {
    health: 0.35,      // 35% - Primary factor
    popularity: 0.15,   // 15% - Community adoption
    maintenance: 0.25,  // 25% - Active maintenance
    security: 0.15,     // 15% - Security posture
    documentation: 0.10 // 10% - Documentation quality
  };

  const overallScore = 
    (healthComponent * weights.health) +
    (popularityComponent * weights.popularity) +
    (maintenanceComponent * weights.maintenance) +
    (securityComponent * weights.security) +
    (documentationComponent * weights.documentation);

  // Determine grade with additional quality checks
  let grade: QualityGrade;
  const recommendations: string[] = [];

  // Critical issues that force lower grades
  if (vulnerabilityCount > 0) {
    if (vulnerabilityCount >= 3) grade = 'F';
    else if (vulnerabilityCount >= 2) grade = 'D';
    else grade = Math.min('C' as QualityGrade, getGradeByScore(overallScore));
    recommendations.push(`Address ${vulnerabilityCount} security vulnerabilities`);
  } else if (daysSinceUpdate > 365) {
    grade = Math.min('D' as QualityGrade, getGradeByScore(overallScore));
    recommendations.push('Package appears abandoned - not updated in over a year');
  } else {
    grade = getGradeByScore(overallScore);
  }

  // Add specific recommendations
  if (!hasDocumentation) recommendations.push('Add comprehensive documentation');
  if (!hasTests) recommendations.push('Add automated tests');
  if (!hasTyping) recommendations.push('Add TypeScript support');
  if (maintenanceComponent < 50) recommendations.push('Improve maintainer responsiveness');
  if (popularityComponent < 30) recommendations.push('Increase community engagement');

  return {
    grade,
    score: Math.round(overallScore * 100) / 100,
    breakdown: {
      health: Math.round(healthComponent * 100) / 100,
      popularity: Math.round(popularityComponent * 100) / 100,
      maintenance: Math.round(maintenanceComponent * 100) / 100,
      security: Math.round(securityComponent * 100) / 100,
      documentation: Math.round(documentationComponent * 100) / 100
    },
    recommendations
  };
}

/**
 * Convert numeric score to letter grade
 */
function getGradeByScore(score: number): QualityGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Calculate health score from NPM package data
 */
export function calculateHealthFromNpmData(npmData: any): number {
  const pkg = npmData.package || {};
  const score = npmData.score || {};
  
  // Use NPM's search score if available (0-1 scale)
  if (score.final) {
    return Math.round(score.final * 100);
  }

  // Fallback calculation based on package metadata
  let health = 50; // Start with neutral

  // Boost for good metadata
  if (pkg.description) health += 10;
  if (pkg.keywords && pkg.keywords.length > 0) health += 10;
  if (pkg.license) health += 5;
  if (pkg.homepage || pkg.repository) health += 10;

  // Boost for recent updates
  if (pkg.date) {
    const daysSinceUpdate = (Date.now() - new Date(pkg.date).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 30) health += 15;
    else if (daysSinceUpdate < 90) health += 10;
    else if (daysSinceUpdate < 180) health += 5;
    else if (daysSinceUpdate > 365) health -= 20;
  }

  // Boost for community engagement (using weekly downloads as proxy)
  const weeklyDownloads = npmData.downloads?.weekly || 0;
  if (weeklyDownloads > 10000) health += 15;
  else if (weeklyDownloads > 1000) health += 10;
  else if (weeklyDownloads > 100) health += 5;

  return Math.max(0, Math.min(100, health));
}

/**
 * Enhanced plugin categorization for Spotify Portal-style categories
 */
export type SpotifyPortalCategory = 
  | 'open-source' 
  | 'enterprise-premium' 
  | 'third-party-verified' 
  | 'custom-internal';

export function categorizePluginForPortal(
  name: string, 
  keywords: string[], 
  author?: string,
  downloads?: number
): SpotifyPortalCategory {
  const nameStr = name.toLowerCase();
  const keywordStr = keywords.join(' ').toLowerCase();
  const authorStr = (author || '').toLowerCase();

  // Enterprise Premium - Official Backstage and well-known enterprise vendors
  if (nameStr.startsWith('@backstage/') && authorStr.includes('backstage')) {
    return 'enterprise-premium';
  }

  if (authorStr.includes('roadiehq') || 
      authorStr.includes('spotify') ||
      authorStr.includes('frontside') ||
      nameStr.includes('@roadiehq/') ||
      nameStr.includes('@spotify/')) {
    return 'enterprise-premium';
  }

  // Third-party Verified - High download count and quality indicators
  if (downloads && downloads > 5000 && 
      (keywordStr.includes('backstage') || keywordStr.includes('plugin'))) {
    return 'third-party-verified';
  }

  // Custom Internal - Marked with internal keywords or specific patterns
  if (keywordStr.includes('internal') || 
      keywordStr.includes('private') ||
      keywordStr.includes('custom') ||
      nameStr.includes('-internal') ||
      nameStr.includes('@internal/')) {
    return 'custom-internal';
  }

  // Default to open-source
  return 'open-source';
}

/**
 * Calculate comprehensive plugin metadata for Portal UI
 */
export function enrichPluginForPortal(npmData: any) {
  const pkg = npmData.package || {};
  const score = npmData.score || {};
  
  const healthScore = calculateHealthFromNpmData(npmData);
  const downloads = npmData.downloads?.weekly || 0;
  const stars = Math.round((score.final || 0) * 1000); // Convert to approximate stars
  
  const qualityMetrics: Partial<QualityMetrics> = {
    healthScore,
    downloads,
    stars,
    lastUpdated: pkg.date,
    hasDocumentation: !!(pkg.homepage || pkg.repository),
    hasTests: pkg.keywords?.includes('test') || false,
    hasTyping: pkg.keywords?.includes('typescript') || pkg.name?.includes('types') || false,
    vulnerabilityCount: 0, // Would need security scan data
    communityActivity: Math.min(100, Math.log10(downloads + 1) * 20)
  };

  const qualityResult = calculateQualityGrade(qualityMetrics);
  const portalCategory = categorizePluginForPortal(
    pkg.name, 
    pkg.keywords || [], 
    pkg.author?.name,
    downloads
  );

  return {
    id: pkg.name,
    name: pkg.name,
    title: pkg.name
      .replace('@backstage/plugin-', '')
      .replace('@roadiehq/backstage-plugin-', '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l: string) => l.toUpperCase()),
    description: (pkg.description || 'No description available').slice(0, 200),
    version: pkg.version,
    author: pkg.author?.name || pkg.maintainers?.[0]?.name || 'Community',
    maintainer: pkg.maintainers?.[0]?.name || pkg.author?.name || 'Community',
    category: portalCategory,
    health: qualityResult.score,
    qualityGrade: qualityResult.grade,
    qualityBreakdown: qualityResult.breakdown,
    recommendations: qualityResult.recommendations,
    downloads,
    stars,
    tags: (pkg.keywords || []).slice(0, 10),
    lastUpdated: pkg.date,
    npm: `https://www.npmjs.com/package/${pkg.name}`,
    homepage: pkg.links?.homepage || pkg.links?.repository,
    repository: pkg.links?.repository,
    installed: false,
    enabled: false,
    configurable: true
  };
}