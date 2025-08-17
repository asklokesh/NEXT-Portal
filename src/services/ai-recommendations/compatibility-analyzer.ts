import { EventEmitter } from 'events';
import { prisma } from '@/lib/db/client';
import * as tf from '@tensorflow/tfjs-node';

interface CompatibilityAnalysis {
  pluginId: string;
  overallCompatibility: 'excellent' | 'good' | 'fair' | 'poor' | 'incompatible';
  compatibilityScore: number; // 0-1
  conflictPredictions: ConflictPrediction[];
  dependencyAnalysis: DependencyAnalysis;
  performanceImpact: PerformanceImpactPrediction;
  migrationComplexity: MigrationComplexityAnalysis;
  recommendations: CompatibilityRecommendation[];
  riskAssessment: RiskAssessment;
}

interface ConflictPrediction {
  type: 'port' | 'dependency' | 'configuration' | 'resource' | 'api' | 'database';
  conflictsWith: string[]; // Plugin IDs
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number; // 0-1
  description: string;
  resolution: string;
  autoResolvable: boolean;
}

interface DependencyAnalysis {
  sharedDependencies: SharedDependency[];
  versionConflicts: VersionConflict[];
  circularDependencies: CircularDependency[];
  dependencyGraph: DependencyNode[];
  securityVulnerabilities: SecurityVulnerability[];
}

interface SharedDependency {
  dependency: string;
  version: string;
  sharedBy: string[]; // Plugin IDs
  conflictRisk: 'low' | 'medium' | 'high';
}

interface VersionConflict {
  dependency: string;
  conflictingVersions: { pluginId: string; version: string }[];
  resolution: 'upgrade' | 'downgrade' | 'peerDependency' | 'manual';
  effort: 'low' | 'medium' | 'high';
}

interface CircularDependency {
  cycle: string[]; // Plugin IDs forming the cycle
  severity: 'warning' | 'error';
  breakPoint: string; // Suggested plugin to modify
}

interface DependencyNode {
  pluginId: string;
  dependencies: string[];
  dependents: string[];
  depth: number;
  criticalPath: boolean;
}

interface SecurityVulnerability {
  pluginId: string;
  vulnerability: {
    cveId?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedVersions: string[];
    patchAvailable: boolean;
  };
}

interface PerformanceImpactPrediction {
  memoryImpact: {
    predicted: number; // MB
    confidence: number;
    factors: string[];
  };
  cpuImpact: {
    predicted: number; // Percentage
    confidence: number;
    factors: string[];
  };
  networkImpact: {
    predicted: number; // Requests per hour
    confidence: number;
    factors: string[];
  };
  startupTime: {
    predicted: number; // Seconds
    confidence: number;
    factors: string[];
  };
  overallRating: 'excellent' | 'good' | 'moderate' | 'poor';
}

interface MigrationComplexityAnalysis {
  complexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex';
  estimatedHours: number;
  migrationSteps: MigrationStep[];
  automationPossible: boolean;
  rollbackComplexity: 'easy' | 'moderate' | 'difficult';
  testingRequired: TestingRequirement[];
}

interface MigrationStep {
  step: number;
  description: string;
  type: 'configuration' | 'code_change' | 'data_migration' | 'dependency_update' | 'testing';
  estimatedTime: number; // Minutes
  automatable: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

interface TestingRequirement {
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
  scope: string;
  estimatedTime: number; // Minutes
  priority: 'low' | 'medium' | 'high';
}

interface CompatibilityRecommendation {
  type: 'install_together' | 'install_separately' | 'configure_first' | 'upgrade_dependency' | 'avoid_combination';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  actionItems: string[];
}

interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  mitigationStrategies: MitigationStrategy[];
  rollbackPlan: RollbackStep[];
}

interface RiskFactor {
  factor: string;
  impact: 'low' | 'medium' | 'high';
  probability: 'low' | 'medium' | 'high';
  description: string;
}

interface MitigationStrategy {
  risk: string;
  strategy: string;
  effort: 'low' | 'medium' | 'high';
  effectiveness: 'low' | 'medium' | 'high';
}

interface RollbackStep {
  step: number;
  action: string;
  timeRequired: number; // Minutes
  complexity: 'easy' | 'moderate' | 'difficult';
}

export class CompatibilityAnalyzer extends EventEmitter {
  private compatibilityModel: tf.LayersModel | null = null;
  private conflictPredictionModel: tf.LayersModel | null = null;
  private performanceModel: tf.LayersModel | null = null;
  private knowledgeBase: Map<string, any> = new Map();
  private compatibilityMatrix: Map<string, Map<string, number>> = new Map();
  private isInitialized = false;

  constructor() {
    super();
    this.initialize();
  }

  private async initialize() {
    console.log('Initializing Plugin Compatibility Analyzer...');
    try {
      await this.loadModels();
      await this.buildKnowledgeBase();
      await this.buildCompatibilityMatrix();
      this.isInitialized = true;
      console.log('Plugin Compatibility Analyzer initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize compatibility analyzer:', error);
      this.emit('initialization_error', error);
    }
  }

  private async loadModels() {
    try {
      this.compatibilityModel = await tf.loadLayersModel('/ai-models/compatibility/model.json');
      this.conflictPredictionModel = await tf.loadLayersModel('/ai-models/conflict-prediction/model.json');
      this.performanceModel = await tf.loadLayersModel('/ai-models/performance-prediction/model.json');
      console.log('ML models loaded successfully');
    } catch (error) {
      console.warn('Pre-trained models not found, creating new models');
      this.compatibilityModel = this.createCompatibilityModel();
      this.conflictPredictionModel = this.createConflictPredictionModel();
      this.performanceModel = this.createPerformanceModel();
    }
  }

  private createCompatibilityModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [150], units: 256, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Compatibility score
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  private createConflictPredictionModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [100], units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 6, activation: 'softmax' }) // 6 conflict types
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  private createPerformanceModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [75], units: 128, activation: 'relu' }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 4, activation: 'linear' }) // Memory, CPU, Network, Startup time
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: ['mae']
    });

    return model;
  }

  private async buildKnowledgeBase() {
    // Load compatibility rules and historical data
    const knownConflicts = [
      {
        plugins: ['@backstage/plugin-jenkins', '@backstage/plugin-github-actions'],
        type: 'configuration',
        severity: 'medium',
        description: 'Both plugins may compete for CI/CD workflow definitions'
      },
      {
        plugins: ['@backstage/plugin-prometheus', '@backstage/plugin-datadog'],
        type: 'resource',
        severity: 'low',
        description: 'Redundant monitoring capabilities - consider using one primary solution'
      },
      {
        plugins: ['@backstage/plugin-kubernetes', '@backstage/plugin-docker'],
        type: 'api',
        severity: 'low',
        description: 'Complementary plugins that enhance each other',
        relationship: 'enhancement'
      }
    ];

    const performanceProfiles = [
      {
        category: 'MONITORING_OBSERVABILITY',
        avgMemoryMB: 45,
        avgCpuPercent: 12,
        avgNetworkRPH: 3600,
        avgStartupSec: 8
      },
      {
        category: 'CICD',
        avgMemoryMB: 30,
        avgCpuPercent: 8,
        avgNetworkRPH: 1200,
        avgStartupSec: 5
      },
      {
        category: 'DATABASE',
        avgMemoryMB: 60,
        avgCpuPercent: 15,
        avgNetworkRPH: 7200,
        avgStartupSec: 12
      }
    ];

    this.knowledgeBase.set('conflicts', knownConflicts);
    this.knowledgeBase.set('performance', performanceProfiles);

    console.log('Knowledge base built with compatibility rules');
  }

  private async buildCompatibilityMatrix() {
    const plugins = await prisma.plugin.findMany();
    
    for (const plugin1 of plugins) {
      const compatibilityRow = new Map<string, number>();
      
      for (const plugin2 of plugins) {
        if (plugin1.id !== plugin2.id) {
          const score = this.calculateBasicCompatibility(plugin1, plugin2);
          compatibilityRow.set(plugin2.id, score);
        }
      }
      
      this.compatibilityMatrix.set(plugin1.id, compatibilityRow);
    }

    console.log(`Built compatibility matrix for ${plugins.length} plugins`);
  }

  private calculateBasicCompatibility(plugin1: any, plugin2: any): number {
    let score = 0.5; // Base compatibility score

    // Same category may indicate redundancy
    if (plugin1.category === plugin2.category) {
      if (plugin1.subcategory === plugin2.subcategory) {
        score -= 0.3; // Likely redundant
      } else {
        score += 0.1; // Related but different
      }
    }

    // Check for known conflicts
    const conflicts = this.knowledgeBase.get('conflicts') || [];
    for (const conflict of conflicts) {
      if (conflict.plugins.includes(plugin1.name) && conflict.plugins.includes(plugin2.name)) {
        if (conflict.relationship === 'enhancement') {
          score += 0.4;
        } else {
          score -= conflict.severity === 'high' ? 0.4 : 0.2;
        }
        break;
      }
    }

    // Consider plugin maturity
    if (plugin1.lifecycle === 'STABLE' && plugin2.lifecycle === 'STABLE') {
      score += 0.1;
    } else if (plugin1.lifecycle === 'ALPHA' || plugin2.lifecycle === 'ALPHA') {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  async analyzeCompatibility(
    targetPluginId: string,
    existingPluginIds: string[]
  ): Promise<CompatibilityAnalysis> {
    if (!this.isInitialized) {
      throw new Error('Compatibility analyzer not initialized');
    }

    const targetPlugin = await prisma.plugin.findUnique({
      where: { id: targetPluginId },
      include: {
        versions: { orderBy: { createdAt: 'desc' }, take: 1 },
        vulnerabilities: true
      }
    });

    if (!targetPlugin) {
      throw new Error(`Plugin ${targetPluginId} not found`);
    }

    const existingPlugins = await prisma.plugin.findMany({
      where: { id: { in: existingPluginIds } },
      include: {
        versions: { orderBy: { createdAt: 'desc' }, take: 1 },
        vulnerabilities: true
      }
    });

    // Perform comprehensive analysis
    const conflictPredictions = await this.predictConflicts(targetPlugin, existingPlugins);
    const dependencyAnalysis = await this.analyzeDependencies(targetPlugin, existingPlugins);
    const performanceImpact = await this.predictPerformanceImpact(targetPlugin, existingPlugins);
    const migrationComplexity = await this.analyzeMigrationComplexity(targetPlugin, existingPlugins);
    const recommendations = this.generateRecommendations(targetPlugin, existingPlugins, conflictPredictions);
    const riskAssessment = this.assessRisk(conflictPredictions, dependencyAnalysis, performanceImpact);

    // Calculate overall compatibility score
    const compatibilityScore = this.calculateOverallCompatibility(
      conflictPredictions,
      dependencyAnalysis,
      performanceImpact,
      riskAssessment
    );

    const overallCompatibility = this.determineCompatibilityRating(compatibilityScore);

    return {
      pluginId: targetPluginId,
      overallCompatibility,
      compatibilityScore,
      conflictPredictions,
      dependencyAnalysis,
      performanceImpact,
      migrationComplexity,
      recommendations,
      riskAssessment
    };
  }

  private async predictConflicts(
    targetPlugin: any,
    existingPlugins: any[]
  ): Promise<ConflictPrediction[]> {
    const conflicts: ConflictPrediction[] = [];

    for (const existingPlugin of existingPlugins) {
      // Check known conflicts from knowledge base
      const knownConflicts = this.knowledgeBase.get('conflicts') || [];
      const knownConflict = knownConflicts.find((c: any) =>
        c.plugins.includes(targetPlugin.name) && c.plugins.includes(existingPlugin.name)
      );

      if (knownConflict) {
        conflicts.push({
          type: knownConflict.type,
          conflictsWith: [existingPlugin.id],
          severity: knownConflict.severity,
          probability: 0.9,
          description: knownConflict.description,
          resolution: this.generateResolution(knownConflict),
          autoResolvable: knownConflict.severity === 'low'
        });
      }

      // Predict port conflicts
      if (targetPlugin.defaultPort && existingPlugin.defaultPort === targetPlugin.defaultPort) {
        conflicts.push({
          type: 'port',
          conflictsWith: [existingPlugin.id],
          severity: 'medium',
          probability: 1.0,
          description: `Both plugins attempt to use port ${targetPlugin.defaultPort}`,
          resolution: 'Configure different ports for each plugin',
          autoResolvable: true
        });
      }

      // Predict dependency conflicts
      const targetDeps = targetPlugin.versions?.[0]?.dependencies || {};
      const existingDeps = existingPlugin.versions?.[0]?.dependencies || {};

      for (const [depName, targetVersion] of Object.entries(targetDeps)) {
        if (existingDeps[depName] && existingDeps[depName] !== targetVersion) {
          conflicts.push({
            type: 'dependency',
            conflictsWith: [existingPlugin.id],
            severity: this.assessDependencyConflictSeverity(depName, targetVersion, existingDeps[depName]),
            probability: 0.8,
            description: `Dependency version conflict for ${depName}: ${targetVersion} vs ${existingDeps[depName]}`,
            resolution: 'Use peer dependencies or upgrade to compatible versions',
            autoResolvable: false
          });
        }
      }
    }

    return conflicts;
  }

  private generateResolution(conflict: any): string {
    const resolutions = {
      'configuration': 'Review and adjust plugin configurations to avoid overlaps',
      'resource': 'Consider using one primary solution or configure resource allocation',
      'api': 'Ensure API endpoints don\'t conflict or implement proper routing',
      'port': 'Configure different ports for each plugin',
      'dependency': 'Update to compatible dependency versions'
    };

    return resolutions[conflict.type as keyof typeof resolutions] || 'Manual resolution required';
  }

  private assessDependencyConflictSeverity(
    depName: string,
    version1: string,
    version2: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Simplified version conflict assessment
    const criticalDeps = ['react', 'react-dom', 'typescript', '@backstage/core'];
    
    if (criticalDeps.includes(depName)) {
      return 'high';
    }

    // Check if major versions differ
    const v1Major = parseInt(version1.replace(/[^\d]/g, ''));
    const v2Major = parseInt(version2.replace(/[^\d]/g, ''));

    if (v1Major !== v2Major) {
      return 'medium';
    }

    return 'low';
  }

  private async analyzeDependencies(
    targetPlugin: any,
    existingPlugins: any[]
  ): Promise<DependencyAnalysis> {
    const sharedDependencies: SharedDependency[] = [];
    const versionConflicts: VersionConflict[] = [];
    const circularDependencies: CircularDependency[] = [];
    const securityVulnerabilities: SecurityVulnerability[] = [];

    const targetDeps = targetPlugin.versions?.[0]?.dependencies || {};

    // Analyze shared dependencies
    const dependencyMap = new Map<string, { pluginId: string; version: string }[]>();
    
    for (const existingPlugin of existingPlugins) {
      const existingDeps = existingPlugin.versions?.[0]?.dependencies || {};
      
      for (const [depName, version] of Object.entries(existingDeps)) {
        if (!dependencyMap.has(depName)) {
          dependencyMap.set(depName, []);
        }
        dependencyMap.get(depName)!.push({
          pluginId: existingPlugin.id,
          version: version as string
        });
      }
    }

    // Add target plugin dependencies
    for (const [depName, version] of Object.entries(targetDeps)) {
      if (!dependencyMap.has(depName)) {
        dependencyMap.set(depName, []);
      }
      dependencyMap.get(depName)!.push({
        pluginId: targetPlugin.id,
        version: version as string
      });
    }

    // Identify shared dependencies and conflicts
    for (const [depName, plugins] of dependencyMap.entries()) {
      if (plugins.length > 1) {
        const uniqueVersions = [...new Set(plugins.map(p => p.version))];
        
        sharedDependencies.push({
          dependency: depName,
          version: uniqueVersions[0], // Most common version
          sharedBy: plugins.map(p => p.pluginId),
          conflictRisk: uniqueVersions.length > 1 ? 'high' : 'low'
        });

        if (uniqueVersions.length > 1) {
          versionConflicts.push({
            dependency: depName,
            conflictingVersions: plugins.map(p => ({
              pluginId: p.pluginId,
              version: p.version
            })),
            resolution: this.determineResolutionStrategy(depName, uniqueVersions),
            effort: this.estimateResolutionEffort(depName, uniqueVersions)
          });
        }
      }
    }

    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph([targetPlugin, ...existingPlugins]);

    // Check for security vulnerabilities
    for (const plugin of [targetPlugin, ...existingPlugins]) {
      if (plugin.vulnerabilities?.length > 0) {
        for (const vuln of plugin.vulnerabilities) {
          securityVulnerabilities.push({
            pluginId: plugin.id,
            vulnerability: {
              cveId: vuln.cveId,
              severity: vuln.severity.toLowerCase() as any,
              description: vuln.description,
              affectedVersions: vuln.affectedVersions,
              patchAvailable: vuln.patchedVersions.length > 0
            }
          });
        }
      }
    }

    return {
      sharedDependencies,
      versionConflicts,
      circularDependencies,
      dependencyGraph,
      securityVulnerabilities
    };
  }

  private determineResolutionStrategy(
    depName: string,
    versions: string[]
  ): 'upgrade' | 'downgrade' | 'peerDependency' | 'manual' {
    // Simplified resolution strategy
    const isFrameworkDep = ['react', 'angular', 'vue'].includes(depName);
    const isCoreDep = depName.startsWith('@backstage/');

    if (isFrameworkDep || isCoreDep) {
      return 'upgrade'; // Usually safe to upgrade framework deps
    }

    return 'peerDependency'; // Use peer dependencies for flexibility
  }

  private estimateResolutionEffort(
    depName: string,
    versions: string[]
  ): 'low' | 'medium' | 'high' {
    const majorVersionChanges = this.countMajorVersionChanges(versions);
    
    if (majorVersionChanges === 0) return 'low';
    if (majorVersionChanges === 1) return 'medium';
    return 'high';
  }

  private countMajorVersionChanges(versions: string[]): number {
    const majorVersions = versions.map(v => parseInt(v.split('.')[0] || '0'));
    return new Set(majorVersions).size - 1;
  }

  private buildDependencyGraph(plugins: any[]): DependencyNode[] {
    const nodes: DependencyNode[] = [];
    
    for (const plugin of plugins) {
      const dependencies = Object.keys(plugin.versions?.[0]?.dependencies || {});
      const dependents = plugins
        .filter(p => p.id !== plugin.id)
        .filter(p => {
          const deps = Object.keys(p.versions?.[0]?.dependencies || {});
          return deps.includes(plugin.name);
        })
        .map(p => p.id);

      nodes.push({
        pluginId: plugin.id,
        dependencies,
        dependents,
        depth: this.calculateDepth(plugin, plugins),
        criticalPath: dependencies.length > 5 || dependents.length > 3
      });
    }

    return nodes;
  }

  private calculateDepth(plugin: any, allPlugins: any[]): number {
    // Simplified depth calculation
    const dependencies = Object.keys(plugin.versions?.[0]?.dependencies || {});
    return dependencies.length > 0 ? Math.max(1, dependencies.length / 5) : 0;
  }

  private async predictPerformanceImpact(
    targetPlugin: any,
    existingPlugins: any[]
  ): Promise<PerformanceImpactPrediction> {
    // Get performance profile for target plugin category
    const performanceProfiles = this.knowledgeBase.get('performance') || [];
    const profile = performanceProfiles.find((p: any) => p.category === targetPlugin.category) || {
      avgMemoryMB: 35,
      avgCpuPercent: 10,
      avgNetworkRPH: 2400,
      avgStartupSec: 6
    };

    // Calculate cumulative impact
    const currentPluginsImpact = existingPlugins.length * 0.1; // Base multiplier

    return {
      memoryImpact: {
        predicted: Math.round(profile.avgMemoryMB * (1 + currentPluginsImpact)),
        confidence: 0.75,
        factors: ['Plugin category', 'Existing plugin count', 'Historical data']
      },
      cpuImpact: {
        predicted: Math.round(profile.avgCpuPercent * (1 + currentPluginsImpact)),
        confidence: 0.7,
        factors: ['Plugin functionality', 'Background tasks', 'API calls']
      },
      networkImpact: {
        predicted: Math.round(profile.avgNetworkRPH * (1 + currentPluginsImpact)),
        confidence: 0.65,
        factors: ['External API usage', 'Data synchronization', 'Monitoring calls']
      },
      startupTime: {
        predicted: Math.round(profile.avgStartupSec * (1 + currentPluginsImpact * 0.5)),
        confidence: 0.8,
        factors: ['Initialization complexity', 'Dependency loading', 'Configuration parsing']
      },
      overallRating: this.calculatePerformanceRating(profile, currentPluginsImpact)
    };
  }

  private calculatePerformanceRating(
    profile: any,
    impact: number
  ): 'excellent' | 'good' | 'moderate' | 'poor' {
    const score = (100 - profile.avgMemoryMB) * 0.3 + 
                  (100 - profile.avgCpuPercent * 5) * 0.3 + 
                  (100 - profile.avgStartupSec * 10) * 0.4;
    
    const adjustedScore = score * (1 - impact * 0.2);

    if (adjustedScore > 80) return 'excellent';
    if (adjustedScore > 65) return 'good';
    if (adjustedScore > 45) return 'moderate';
    return 'poor';
  }

  private async analyzeMigrationComplexity(
    targetPlugin: any,
    existingPlugins: any[]
  ): Promise<MigrationComplexityAnalysis> {
    // Analyze migration complexity based on plugin characteristics
    let complexity: MigrationComplexityAnalysis['complexity'] = 'simple';
    let estimatedHours = 2;
    const migrationSteps: MigrationStep[] = [];
    const testingRequired: TestingRequirement[] = [];

    // Base migration steps
    migrationSteps.push(
      {
        step: 1,
        description: 'Install plugin dependencies',
        type: 'dependency_update',
        estimatedTime: 15,
        automatable: true,
        riskLevel: 'low'
      },
      {
        step: 2,
        description: 'Add plugin configuration',
        type: 'configuration',
        estimatedTime: 30,
        automatable: false,
        riskLevel: 'medium'
      },
      {
        step: 3,
        description: 'Update application code',
        type: 'code_change',
        estimatedTime: 60,
        automatable: false,
        riskLevel: 'medium'
      }
    );

    // Adjust complexity based on plugin characteristics
    if (targetPlugin.category === 'DATABASE' || targetPlugin.category === 'AUTHENTICATION') {
      complexity = 'complex';
      estimatedHours = 8;
      migrationSteps.push({
        step: 4,
        description: 'Migrate existing data/users',
        type: 'data_migration',
        estimatedTime: 180,
        automatable: false,
        riskLevel: 'high'
      });
    }

    if (existingPlugins.length > 10) {
      complexity = complexity === 'complex' ? 'very_complex' : 'moderate';
      estimatedHours += 2;
    }

    // Required testing
    testingRequired.push(
      {
        type: 'unit',
        scope: 'Plugin functionality',
        estimatedTime: 60,
        priority: 'high'
      },
      {
        type: 'integration',
        scope: 'Plugin interactions',
        estimatedTime: 90,
        priority: 'high'
      }
    );

    if (complexity === 'complex' || complexity === 'very_complex') {
      testingRequired.push({
        type: 'e2e',
        scope: 'Complete user workflows',
        estimatedTime: 120,
        priority: 'high'
      });
    }

    return {
      complexity,
      estimatedHours,
      migrationSteps,
      automationPossible: migrationSteps.some(step => step.automatable),
      rollbackComplexity: complexity === 'very_complex' ? 'difficult' : 
                         complexity === 'complex' ? 'moderate' : 'easy',
      testingRequired
    };
  }

  private generateRecommendations(
    targetPlugin: any,
    existingPlugins: any[],
    conflicts: ConflictPrediction[]
  ): CompatibilityRecommendation[] {
    const recommendations: CompatibilityRecommendation[] = [];

    // High-severity conflicts
    const criticalConflicts = conflicts.filter(c => c.severity === 'critical' || c.severity === 'high');
    if (criticalConflicts.length > 0) {
      recommendations.push({
        type: 'configure_first',
        title: 'Resolve Critical Conflicts Before Installation',
        description: 'Address high-priority conflicts to prevent system instability',
        priority: 'high',
        actionItems: criticalConflicts.map(c => `Resolve ${c.type} conflict: ${c.description}`)
      });
    }

    // Redundant plugins
    const redundantPlugins = existingPlugins.filter(p => 
      p.category === targetPlugin.category && p.subcategory === targetPlugin.subcategory
    );
    
    if (redundantPlugins.length > 0) {
      recommendations.push({
        type: 'avoid_combination',
        title: 'Consider Plugin Redundancy',
        description: 'You already have similar plugins installed',
        priority: 'medium',
        actionItems: [
          'Evaluate if both plugins are necessary',
          'Consider using the most feature-complete option',
          'Review functionality overlap'
        ]
      });
    }

    // Complementary plugins
    const complementaryPlugins = this.findComplementaryPlugins(targetPlugin, existingPlugins);
    if (complementaryPlugins.length > 0) {
      recommendations.push({
        type: 'install_together',
        title: 'Enhanced Functionality Available',
        description: 'This plugin works great with your existing plugins',
        priority: 'low',
        actionItems: complementaryPlugins.map(p => `Consider configuring ${p} for enhanced integration`)
      });
    }

    return recommendations;
  }

  private findComplementaryPlugins(targetPlugin: any, existingPlugins: any[]): string[] {
    // Define complementary plugin relationships
    const complementaryRelationships = {
      '@backstage/plugin-kubernetes': ['@backstage/plugin-docker'],
      '@backstage/plugin-catalog': ['@backstage/plugin-techdocs'],
      '@backstage/plugin-github-actions': ['@backstage/plugin-sonarqube']
    };

    const complements: string[] = [];
    const targetName = targetPlugin.name;

    for (const existingPlugin of existingPlugins) {
      const existingName = existingPlugin.name;
      
      if (complementaryRelationships[targetName as keyof typeof complementaryRelationships]?.includes(existingName) ||
          complementaryRelationships[existingName as keyof typeof complementaryRelationships]?.includes(targetName)) {
        complements.push(existingPlugin.displayName);
      }
    }

    return complements;
  }

  private assessRisk(
    conflicts: ConflictPrediction[],
    dependencies: DependencyAnalysis,
    performance: PerformanceImpactPrediction
  ): RiskAssessment {
    const riskFactors: RiskFactor[] = [];
    const mitigationStrategies: MitigationStrategy[] = [];

    // Conflict risks
    const highSeverityConflicts = conflicts.filter(c => c.severity === 'high' || c.severity === 'critical');
    if (highSeverityConflicts.length > 0) {
      riskFactors.push({
        factor: 'High-severity conflicts detected',
        impact: 'high',
        probability: 'high',
        description: `${highSeverityConflicts.length} critical compatibility issues found`
      });

      mitigationStrategies.push({
        risk: 'High-severity conflicts',
        strategy: 'Address conflicts through configuration changes and dependency updates',
        effort: 'high',
        effectiveness: 'high'
      });
    }

    // Dependency risks
    if (dependencies.versionConflicts.length > 3) {
      riskFactors.push({
        factor: 'Multiple dependency conflicts',
        impact: 'medium',
        probability: 'high',
        description: 'Complex dependency resolution required'
      });
    }

    // Performance risks
    if (performance.overallRating === 'poor') {
      riskFactors.push({
        factor: 'Poor performance impact',
        impact: 'medium',
        probability: 'medium',
        description: 'Plugin may significantly impact system performance'
      });
    }

    // Security risks
    const criticalVulns = dependencies.securityVulnerabilities.filter(v => v.vulnerability.severity === 'critical');
    if (criticalVulns.length > 0) {
      riskFactors.push({
        factor: 'Security vulnerabilities',
        impact: 'high',
        probability: 'high',
        description: 'Critical security vulnerabilities found in dependencies'
      });
    }

    const overallRisk = this.calculateOverallRisk(riskFactors);

    return {
      overallRisk,
      riskFactors,
      mitigationStrategies,
      rollbackPlan: this.generateRollbackPlan(overallRisk)
    };
  }

  private calculateOverallRisk(riskFactors: RiskFactor[]): 'low' | 'medium' | 'high' | 'critical' {
    if (riskFactors.length === 0) return 'low';

    const highRisks = riskFactors.filter(r => r.impact === 'high' && r.probability === 'high').length;
    const mediumRisks = riskFactors.filter(r => 
      (r.impact === 'high' && r.probability === 'medium') ||
      (r.impact === 'medium' && r.probability === 'high')
    ).length;

    if (highRisks > 2) return 'critical';
    if (highRisks > 0) return 'high';
    if (mediumRisks > 2) return 'high';
    if (mediumRisks > 0) return 'medium';
    return 'low';
  }

  private generateRollbackPlan(overallRisk: string): RollbackStep[] {
    const baseSteps: RollbackStep[] = [
      {
        step: 1,
        action: 'Stop plugin services',
        timeRequired: 5,
        complexity: 'easy'
      },
      {
        step: 2,
        action: 'Remove plugin configuration',
        timeRequired: 10,
        complexity: 'easy'
      },
      {
        step: 3,
        action: 'Uninstall plugin dependencies',
        timeRequired: 15,
        complexity: 'moderate'
      },
      {
        step: 4,
        action: 'Restart core services',
        timeRequired: 10,
        complexity: 'easy'
      }
    ];

    if (overallRisk === 'high' || overallRisk === 'critical') {
      baseSteps.push({
        step: 5,
        action: 'Restore data backups if necessary',
        timeRequired: 60,
        complexity: 'difficult'
      });
    }

    return baseSteps;
  }

  private calculateOverallCompatibility(
    conflicts: ConflictPrediction[],
    dependencies: DependencyAnalysis,
    performance: PerformanceImpactPrediction,
    risk: RiskAssessment
  ): number {
    let score = 1.0;

    // Penalize for conflicts
    const criticalConflicts = conflicts.filter(c => c.severity === 'critical').length;
    const highConflicts = conflicts.filter(c => c.severity === 'high').length;
    score -= (criticalConflicts * 0.3) + (highConflicts * 0.2);

    // Penalize for dependency issues
    score -= dependencies.versionConflicts.length * 0.05;

    // Penalize for poor performance
    const performancePenalty = {
      'poor': 0.2,
      'moderate': 0.1,
      'good': 0.05,
      'excellent': 0
    };
    score -= performancePenalty[performance.overallRating] || 0;

    // Penalize for high risk
    const riskPenalty = {
      'critical': 0.3,
      'high': 0.2,
      'medium': 0.1,
      'low': 0
    };
    score -= riskPenalty[risk.overallRisk] || 0;

    return Math.max(0, Math.min(1, score));
  }

  private determineCompatibilityRating(score: number): 'excellent' | 'good' | 'fair' | 'poor' | 'incompatible' {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.75) return 'good';
    if (score >= 0.5) return 'fair';
    if (score >= 0.25) return 'poor';
    return 'incompatible';
  }
}

// Export singleton instance
export const compatibilityAnalyzer = new CompatibilityAnalyzer();