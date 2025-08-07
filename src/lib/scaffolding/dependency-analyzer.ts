/**
 * Dependency Analyzer
 * 
 * Analyzes and recommends dependencies based on service configuration
 * and technology stack choices.
 */

import { WizardData } from './service-creation-wizard';

export interface DependencyInfo {
  name: string;
  version: string;
  purpose: string;
  optional: boolean;
  category: 'runtime' | 'build' | 'test' | 'dev';
  security: {
    vulnerabilities: number;
    lastSecurityUpdate: string;
    trustScore: number; // 0-100
  };
  maintenance: {
    lastUpdate: string;
    maintainerCount: number;
    issueCount: number;
    weeklyDownloads: number;
  };
  alternatives: string[];
  conflictsWith: string[];
  requires: string[];
}

export interface DependencyRecommendation {
  dependency: DependencyInfo;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  impact: {
    bundleSize: 'small' | 'medium' | 'large';
    performance: 'positive' | 'neutral' | 'negative';
    security: 'secure' | 'moderate' | 'risky';
  };
}

export interface DependencyAnalysisResult {
  dependencies: DependencyInfo[];
  recommendations: DependencyRecommendation[];
  conflicts: Array<{
    dependency1: string;
    dependency2: string;
    reason: string;
    resolution: string;
  }>;
  securityReport: {
    totalVulnerabilities: number;
    criticalVulnerabilities: number;
    recommendedUpdates: string[];
  };
  bundleAnalysis: {
    estimatedSize: string;
    heavyDependencies: string[];
    optimizationSuggestions: string[];
  };
}

export class DependencyAnalyzer {
  private dependencyDatabase: Map<string, DependencyInfo> = new Map();
  private technologyMappings: Map<string, string[]> = new Map();

  constructor() {
    this.initializeDependencyDatabase();
    this.initializeTechnologyMappings();
  }

  /**
   * Analyze dependencies for a service configuration
   */
  async analyzeDependencies(wizardData: WizardData): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    const dependencyNames = new Set<string>();

    // Core dependencies based on technology stack
    if (wizardData.technologyStack) {
      const techDeps = await this.getDependenciesForTechnology(wizardData.technologyStack);
      techDeps.forEach(dep => {
        if (!dependencyNames.has(dep.name)) {
          dependencies.push(dep);
          dependencyNames.add(dep.name);
        }
      });
    }

    // Architecture pattern dependencies
    if (wizardData.architecturePattern) {
      const archDeps = await this.getDependenciesForArchitecture(wizardData.architecturePattern);
      archDeps.forEach(dep => {
        if (!dependencyNames.has(dep.name)) {
          dependencies.push(dep);
          dependencyNames.add(dep.name);
        }
      });
    }

    // Integration dependencies
    if (wizardData.integrationRequirements) {
      const integrationDeps = await this.getDependenciesForIntegrations(wizardData.integrationRequirements);
      integrationDeps.forEach(dep => {
        if (!dependencyNames.has(dep.name)) {
          dependencies.push(dep);
          dependencyNames.add(dep.name);
        }
      });
    }

    // Deployment dependencies
    if (wizardData.deploymentConfiguration) {
      const deploymentDeps = await this.getDependenciesForDeployment(wizardData.deploymentConfiguration);
      deploymentDeps.forEach(dep => {
        if (!dependencyNames.has(dep.name)) {
          dependencies.push(dep);
          dependencyNames.add(dep.name);
        }
      });
    }

    // Resolve transitive dependencies
    const allDependencies = await this.resolveTransitiveDependencies(dependencies);
    
    return allDependencies;
  }

  /**
   * Get comprehensive dependency analysis
   */
  async getFullAnalysis(wizardData: WizardData): Promise<DependencyAnalysisResult> {
    const dependencies = await this.analyzeDependencies(wizardData);
    
    const recommendations = await this.generateRecommendations(dependencies, wizardData);
    const conflicts = await this.analyzeConflicts(dependencies);
    const securityReport = await this.generateSecurityReport(dependencies);
    const bundleAnalysis = await this.analyzeBundleImpact(dependencies);

    return {
      dependencies,
      recommendations,
      conflicts,
      securityReport,
      bundleAnalysis
    };
  }

  /**
   * Check for dependency vulnerabilities
   */
  async checkSecurity(dependencies: string[]): Promise<Array<{
    dependency: string;
    vulnerabilities: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      cve: string;
      fixAvailable: boolean;
      recommendedVersion: string;
    }>;
  }>> {
    const securityReport: any[] = [];

    for (const depName of dependencies) {
      const dep = this.dependencyDatabase.get(depName);
      if (dep && dep.security.vulnerabilities > 0) {
        securityReport.push({
          dependency: depName,
          vulnerabilities: [
            {
              severity: dep.security.trustScore < 30 ? 'high' : dep.security.trustScore < 60 ? 'medium' : 'low',
              description: `Security concerns with ${depName}`,
              cve: 'CVE-EXAMPLE-2024',
              fixAvailable: true,
              recommendedVersion: 'latest'
            }
          ]
        });
      }
    }

    return securityReport;
  }

  /**
   * Optimize dependency list
   */
  async optimizeDependencies(dependencies: DependencyInfo[]): Promise<{
    optimized: DependencyInfo[];
    removed: Array<{ dependency: string; reason: string }>;
    suggestions: string[];
  }> {
    const optimized: DependencyInfo[] = [];
    const removed: Array<{ dependency: string; reason: string }> = [];
    const suggestions: string[] = [];

    for (const dep of dependencies) {
      // Check if dependency is necessary
      if (this.isDependencyNecessary(dep, dependencies)) {
        optimized.push(dep);
      } else {
        removed.push({
          dependency: dep.name,
          reason: 'Functionality provided by another dependency'
        });
      }
    }

    // Generate optimization suggestions
    suggestions.push(...this.generateOptimizationSuggestions(optimized));

    return {
      optimized,
      removed,
      suggestions
    };
  }

  /**
   * Get dependencies for technology stack
   */
  private async getDependenciesForTechnology(tech: any): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];

    // Language-specific dependencies
    const languageDeps = this.technologyMappings.get(tech.primaryLanguage) || [];
    for (const depName of languageDeps) {
      const dep = this.dependencyDatabase.get(depName);
      if (dep) dependencies.push(dep);
    }

    // Framework dependencies
    if (tech.framework) {
      const frameworkDeps = this.technologyMappings.get(tech.framework) || [];
      for (const depName of frameworkDeps) {
        const dep = this.dependencyDatabase.get(depName);
        if (dep) dependencies.push(dep);
      }
    }

    // Database dependencies
    if (tech.database) {
      const dbDeps = this.technologyMappings.get(tech.database) || [];
      for (const depName of dbDeps) {
        const dep = this.dependencyDatabase.get(depName);
        if (dep) dependencies.push(dep);
      }
    }

    return dependencies;
  }

  /**
   * Get dependencies for architecture pattern
   */
  private async getDependenciesForArchitecture(arch: any): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];

    // Pattern-specific dependencies
    if (arch.pattern === 'microservice') {
      const microserviceDeps = ['cors', 'helmet', 'express-rate-limit'];
      for (const depName of microserviceDeps) {
        const dep = this.dependencyDatabase.get(depName);
        if (dep) dependencies.push(dep);
      }
    }

    if (arch.apiStyle === 'graphql') {
      const graphqlDeps = ['apollo-server', 'graphql'];
      for (const depName of graphqlDeps) {
        const dep = this.dependencyDatabase.get(depName);
        if (dep) dependencies.push(dep);
      }
    }

    return dependencies;
  }

  /**
   * Get dependencies for integrations
   */
  private async getDependenciesForIntegrations(integrations: any): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];

    // Authentication dependencies
    if (integrations.security?.authentication) {
      const authDeps = ['passport', 'jsonwebtoken', 'bcrypt'];
      for (const depName of authDeps) {
        const dep = this.dependencyDatabase.get(depName);
        if (dep) dependencies.push(dep);
      }
    }

    // Monitoring dependencies
    if (integrations.monitoring?.metrics) {
      const monitoringDeps = ['prometheus-client', 'winston'];
      for (const depName of monitoringDeps) {
        const dep = this.dependencyDatabase.get(depName);
        if (dep) dependencies.push(dep);
      }
    }

    return dependencies;
  }

  /**
   * Get dependencies for deployment
   */
  private async getDependenciesForDeployment(deployment: any): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];

    // Container dependencies
    if (deployment.containerization) {
      const containerDeps = ['dockerode'];
      for (const depName of containerDeps) {
        const dep = this.dependencyDatabase.get(depName);
        if (dep) dependencies.push(dep);
      }
    }

    return dependencies;
  }

  /**
   * Resolve transitive dependencies
   */
  private async resolveTransitiveDependencies(dependencies: DependencyInfo[]): Promise<DependencyInfo[]> {
    const resolved: DependencyInfo[] = [...dependencies];
    const seen = new Set(dependencies.map(d => d.name));

    for (const dep of dependencies) {
      for (const reqName of dep.requires) {
        if (!seen.has(reqName)) {
          const reqDep = this.dependencyDatabase.get(reqName);
          if (reqDep) {
            resolved.push(reqDep);
            seen.add(reqName);
          }
        }
      }
    }

    return resolved;
  }

  /**
   * Generate dependency recommendations
   */
  private async generateRecommendations(
    dependencies: DependencyInfo[], 
    wizardData: WizardData
  ): Promise<DependencyRecommendation[]> {
    const recommendations: DependencyRecommendation[] = [];

    // Security recommendations
    for (const dep of dependencies) {
      if (dep.security.trustScore < 60) {
        const alternatives = dep.alternatives.filter(alt => {
          const altDep = this.dependencyDatabase.get(alt);
          return altDep && altDep.security.trustScore > dep.security.trustScore;
        });

        if (alternatives.length > 0) {
          recommendations.push({
            dependency: dep,
            reason: `Consider ${alternatives[0]} as a more secure alternative`,
            priority: dep.security.trustScore < 30 ? 'high' : 'medium',
            impact: {
              bundleSize: 'medium',
              performance: 'neutral',
              security: 'secure'
            }
          });
        }
      }
    }

    // Performance recommendations
    const heavyDeps = dependencies.filter(dep => this.estimateBundleSize(dep) > 1000); // KB
    for (const dep of heavyDeps) {
      recommendations.push({
        dependency: dep,
        reason: `${dep.name} adds significant bundle size - consider alternatives or tree shaking`,
        priority: 'medium',
        impact: {
          bundleSize: 'large',
          performance: 'negative',
          security: 'neutral'
        }
      });
    }

    return recommendations;
  }

  /**
   * Analyze dependency conflicts
   */
  private async analyzeConflicts(dependencies: DependencyInfo[]): Promise<any[]> {
    const conflicts: any[] = [];

    for (let i = 0; i < dependencies.length; i++) {
      for (let j = i + 1; j < dependencies.length; j++) {
        const dep1 = dependencies[i];
        const dep2 = dependencies[j];

        if (dep1.conflictsWith.includes(dep2.name)) {
          conflicts.push({
            dependency1: dep1.name,
            dependency2: dep2.name,
            reason: `${dep1.name} conflicts with ${dep2.name}`,
            resolution: `Choose one or use compatibility layer`
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Generate security report
   */
  private async generateSecurityReport(dependencies: DependencyInfo[]): Promise<any> {
    let totalVulnerabilities = 0;
    let criticalVulnerabilities = 0;
    const recommendedUpdates: string[] = [];

    for (const dep of dependencies) {
      totalVulnerabilities += dep.security.vulnerabilities;
      
      if (dep.security.trustScore < 30) {
        criticalVulnerabilities++;
        recommendedUpdates.push(`Update ${dep.name} to latest version`);
      }
    }

    return {
      totalVulnerabilities,
      criticalVulnerabilities,
      recommendedUpdates
    };
  }

  /**
   * Analyze bundle impact
   */
  private async analyzeBundleImpact(dependencies: DependencyInfo[]): Promise<any> {
    let totalSize = 0;
    const heavyDependencies: string[] = [];
    const optimizationSuggestions: string[] = [];

    for (const dep of dependencies) {
      const size = this.estimateBundleSize(dep);
      totalSize += size;
      
      if (size > 500) { // KB
        heavyDependencies.push(dep.name);
        optimizationSuggestions.push(`Consider code splitting for ${dep.name}`);
      }
    }

    return {
      estimatedSize: `${Math.round(totalSize / 1024)} MB`,
      heavyDependencies,
      optimizationSuggestions
    };
  }

  /**
   * Check if dependency is necessary
   */
  private isDependencyNecessary(dep: DependencyInfo, allDeps: DependencyInfo[]): boolean {
    // Check if another dependency provides the same functionality
    for (const otherDep of allDeps) {
      if (otherDep.name !== dep.name && 
          otherDep.purpose === dep.purpose && 
          otherDep.security.trustScore > dep.security.trustScore) {
        return false;
      }
    }
    return true;
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(dependencies: DependencyInfo[]): string[] {
    const suggestions: string[] = [];

    // Check for unused dependencies
    const potentiallyUnused = dependencies.filter(dep => 
      dep.category === 'dev' && dep.optional
    );
    
    if (potentiallyUnused.length > 0) {
      suggestions.push('Review dev dependencies to ensure they are still needed');
    }

    // Check for outdated dependencies
    const outdated = dependencies.filter(dep => {
      const daysSinceUpdate = this.daysSinceDate(dep.maintenance.lastUpdate);
      return daysSinceUpdate > 365; // Over a year
    });

    if (outdated.length > 0) {
      suggestions.push('Update outdated dependencies for security and performance');
    }

    return suggestions;
  }

  /**
   * Estimate bundle size for a dependency
   */
  private estimateBundleSize(dep: DependencyInfo): number {
    // Simplified estimation based on dependency characteristics
    const baseSizes: Record<string, number> = {
      'runtime': 100,
      'build': 50,
      'test': 200,
      'dev': 75
    };

    const baseSize = baseSizes[dep.category] || 100;
    const popularityMultiplier = dep.maintenance.weeklyDownloads > 1000000 ? 1.5 : 1;
    
    return Math.round(baseSize * popularityMultiplier);
  }

  /**
   * Calculate days since a date
   */
  private daysSinceDate(dateString: string): number {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Initialize dependency database with common dependencies
   */
  private initializeDependencyDatabase(): void {
    const dependencies: DependencyInfo[] = [
      {
        name: 'express',
        version: '^4.18.0',
        purpose: 'Web application framework',
        optional: false,
        category: 'runtime',
        security: {
          vulnerabilities: 0,
          lastSecurityUpdate: '2024-01-15',
          trustScore: 95
        },
        maintenance: {
          lastUpdate: '2024-01-20',
          maintainerCount: 25,
          issueCount: 45,
          weeklyDownloads: 25000000
        },
        alternatives: ['koa', 'fastify', 'nestjs'],
        conflictsWith: [],
        requires: []
      },
      {
        name: 'winston',
        version: '^3.8.0',
        purpose: 'Logging library',
        optional: false,
        category: 'runtime',
        security: {
          vulnerabilities: 0,
          lastSecurityUpdate: '2023-12-10',
          trustScore: 90
        },
        maintenance: {
          lastUpdate: '2023-12-15',
          maintainerCount: 15,
          issueCount: 30,
          weeklyDownloads: 8000000
        },
        alternatives: ['pino', 'bunyan'],
        conflictsWith: [],
        requires: []
      }
    ];

    for (const dep of dependencies) {
      this.dependencyDatabase.set(dep.name, dep);
    }
  }

  /**
   * Initialize technology to dependency mappings
   */
  private initializeTechnologyMappings(): void {
    this.technologyMappings.set('javascript', ['express', 'winston']);
    this.technologyMappings.set('nodejs', ['express', 'winston']);
    this.technologyMappings.set('express', ['express']);
    this.technologyMappings.set('postgresql', ['pg', 'knex']);
    this.technologyMappings.set('mongodb', ['mongoose', 'mongodb']);
  }
}