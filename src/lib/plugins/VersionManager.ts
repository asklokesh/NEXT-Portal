/**
 * Plugin Version Manager
 * 
 * Semantic version parsing, constraint resolution, upgrade path planning,
 * breaking change detection, and migration guide generation.
 */

import semver from 'semver';
import { Plugin, VersionConstraint, UpgradePath, BreakingChange, MigrationGuide } from './types';

export interface VersionInfo {
  version: string;
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
  build: string[];
  isStable: boolean;
  releaseDate?: string;
  changelog?: string;
}

export interface VersionRange {
  min: string;
  max: string;
  includes: {
    min: boolean;
    max: boolean;
  };
  satisfiesConstraint: string;
}

export interface UpgradeAnalysis {
  currentVersion: string;
  targetVersion: string;
  upgradePath: UpgradePath[];
  breakingChanges: BreakingChange[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedEffort: number; // hours
  requiredActions: string[];
  migrationGuide?: MigrationGuide;
}

export interface VersionConflictResolution {
  conflictingVersions: string[];
  recommendedVersion: string;
  resolutionStrategy: 'latest' | 'lts' | 'compatible' | 'manual';
  reasoning: string;
  alternatives: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch' | 'prerelease';
  changes: {
    breaking: string[];
    features: string[];
    fixes: string[];
    deprecated: string[];
  };
}

export class VersionManager {
  private versionCache: Map<string, VersionInfo> = new Map();
  private changelogCache: Map<string, ChangelogEntry[]> = new Map();
  private migrationGuides: Map<string, MigrationGuide> = new Map();

  constructor() {
    this.loadMigrationGuides();
  }

  /**
   * Parse semantic version into detailed information
   */
  parseVersion(version: string): VersionInfo | null {
    if (this.versionCache.has(version)) {
      return this.versionCache.get(version)!;
    }

    const parsed = semver.parse(version);
    if (!parsed) {
      return null;
    }

    const versionInfo: VersionInfo = {
      version: parsed.version,
      major: parsed.major,
      minor: parsed.minor,
      patch: parsed.patch,
      prerelease: parsed.prerelease,
      build: parsed.build,
      isStable: parsed.prerelease.length === 0
    };

    this.versionCache.set(version, versionInfo);
    return versionInfo;
  }

  /**
   * Resolve version constraints to find satisfying versions
   */
  resolveConstraints(
    constraints: VersionConstraint[],
    availableVersions: string[]
  ): VersionConflictResolution {
    const satisfyingVersions: Set<string> = new Set();
    const conflictingConstraints: VersionConstraint[] = [];

    // Find versions that satisfy all constraints
    for (const version of availableVersions) {
      let satisfiesAll = true;
      
      for (const constraint of constraints) {
        if (!semver.satisfies(version, constraint.range)) {
          satisfiesAll = false;
          break;
        }
      }
      
      if (satisfiesAll) {
        satisfyingVersions.add(version);
      }
    }

    // If no version satisfies all constraints, identify conflicts
    if (satisfyingVersions.size === 0) {
      for (let i = 0; i < constraints.length; i++) {
        for (let j = i + 1; j < constraints.length; j++) {
          const constraint1 = constraints[i];
          const constraint2 = constraints[j];
          
          if (!this.areConstraintsCompatible(constraint1.range, constraint2.range)) {
            conflictingConstraints.push(constraint1, constraint2);
          }
        }
      }
    }

    const sortedVersions = Array.from(satisfyingVersions).sort(semver.rcompare);
    
    return {
      conflictingVersions: conflictingConstraints.map(c => c.range),
      recommendedVersion: this.selectRecommendedVersion(sortedVersions),
      resolutionStrategy: this.determineResolutionStrategy(constraints, sortedVersions),
      reasoning: this.generateResolutionReasoning(constraints, sortedVersions),
      alternatives: sortedVersions.slice(1, 4) // Top 3 alternatives
    };
  }

  /**
   * Plan upgrade path between versions
   */
  async planUpgradePath(
    pluginId: string,
    currentVersion: string,
    targetVersion: string
  ): Promise<UpgradeAnalysis> {
    const currentInfo = this.parseVersion(currentVersion);
    const targetInfo = this.parseVersion(targetVersion);
    
    if (!currentInfo || !targetInfo) {
      throw new Error('Invalid version format');
    }

    // Check if upgrade is needed
    if (semver.gte(currentVersion, targetVersion)) {
      return {
        currentVersion,
        targetVersion,
        upgradePath: [],
        breakingChanges: [],
        riskLevel: 'low',
        estimatedEffort: 0,
        requiredActions: ['No upgrade needed - current version is up to date']
      };
    }

    // Calculate upgrade path
    const upgradePath = await this.calculateUpgradePath(
      pluginId,
      currentVersion,
      targetVersion
    );

    // Detect breaking changes
    const breakingChanges = await this.detectBreakingChanges(
      pluginId,
      currentVersion,
      targetVersion
    );

    // Assess risk level
    const riskLevel = this.assessUpgradeRisk(currentInfo, targetInfo, breakingChanges);

    // Estimate effort
    const estimatedEffort = this.estimateUpgradeEffort(upgradePath, breakingChanges);

    // Generate required actions
    const requiredActions = this.generateRequiredActions(upgradePath, breakingChanges);

    // Get migration guide if available
    const migrationGuide = this.migrationGuides.get(
      `${pluginId}:${currentInfo.major}to${targetInfo.major}`
    );

    return {
      currentVersion,
      targetVersion,
      upgradePath,
      breakingChanges,
      riskLevel,
      estimatedEffort,
      requiredActions,
      migrationGuide
    };
  }

  /**
   * Detect breaking changes between versions
   */
  async detectBreakingChanges(
    pluginId: string,
    fromVersion: string,
    toVersion: string
  ): Promise<BreakingChange[]> {
    const breakingChanges: BreakingChange[] = [];
    
    // Get changelog entries between versions
    const changelog = await this.getChangelogBetweenVersions(
      pluginId,
      fromVersion,
      toVersion
    );

    for (const entry of changelog) {
      for (const change of entry.changes.breaking) {
        breakingChanges.push({
          version: entry.version,
          type: 'api',
          description: change,
          impact: this.assessChangeImpact(change),
          migrationPath: this.generateMigrationPath(change),
          autoFixable: this.isAutoFixable(change)
        });
      }

      // Detect version bump breaking changes
      if (entry.type === 'major') {
        breakingChanges.push({
          version: entry.version,
          type: 'major',
          description: 'Major version bump - potential breaking changes',
          impact: 'high',
          migrationPath: 'Review changelog and test thoroughly',
          autoFixable: false
        });
      }
    }

    return breakingChanges;
  }

  /**
   * Generate migration guide
   */
  generateMigrationGuide(
    pluginId: string,
    fromVersion: string,
    toVersion: string,
    breakingChanges: BreakingChange[]
  ): MigrationGuide {
    const fromInfo = this.parseVersion(fromVersion)!;
    const toInfo = this.parseVersion(toVersion)!;

    const guide: MigrationGuide = {
      id: `${pluginId}-${fromVersion}-to-${toVersion}`,
      title: `Migrate ${pluginId} from ${fromVersion} to ${toVersion}`,
      overview: this.generateMigrationOverview(fromInfo, toInfo, breakingChanges),
      steps: this.generateMigrationSteps(breakingChanges),
      codeExamples: this.generateCodeExamples(breakingChanges),
      warnings: this.generateMigrationWarnings(breakingChanges),
      estimatedTime: this.estimateUpgradeEffort([], breakingChanges),
      difficulty: this.assessMigrationDifficulty(breakingChanges),
      automatedSteps: breakingChanges.filter(c => c.autoFixable).length,
      manualSteps: breakingChanges.filter(c => !c.autoFixable).length
    };

    return guide;
  }

  /**
   * Find compatible version range
   */
  findCompatibleRange(versions: string[], constraints: string[]): VersionRange | null {
    const sortedVersions = versions.sort(semver.compare);
    let minVersion = sortedVersions[0];
    let maxVersion = sortedVersions[sortedVersions.length - 1];

    // Apply constraints to narrow the range
    for (const constraint of constraints) {
      const satisfyingVersions = versions.filter(v => semver.satisfies(v, constraint));
      if (satisfyingVersions.length === 0) {
        return null; // No compatible versions found
      }

      const constraintMin = satisfyingVersions.sort(semver.compare)[0];
      const constraintMax = satisfyingVersions.sort(semver.rcompare)[0];

      if (semver.gt(constraintMin, minVersion)) {
        minVersion = constraintMin;
      }
      if (semver.lt(constraintMax, maxVersion)) {
        maxVersion = constraintMax;
      }
    }

    // Generate constraint string that satisfies the range
    const satisfiesConstraint = this.generateRangeConstraint(minVersion, maxVersion);

    return {
      min: minVersion,
      max: maxVersion,
      includes: {
        min: true,
        max: true
      },
      satisfiesConstraint
    };
  }

  /**
   * Get latest stable version
   */
  getLatestStableVersion(versions: string[]): string | null {
    const stableVersions = versions.filter(v => {
      const parsed = semver.parse(v);
      return parsed && parsed.prerelease.length === 0;
    });

    if (stableVersions.length === 0) {
      return null;
    }

    return stableVersions.sort(semver.rcompare)[0];
  }

  /**
   * Get next major/minor/patch version
   */
  getNextVersion(currentVersion: string, type: 'major' | 'minor' | 'patch'): string {
    return semver.inc(currentVersion, type) || currentVersion;
  }

  /**
   * Check if version satisfies constraint
   */
  satisfiesConstraint(version: string, constraint: string): boolean {
    return semver.satisfies(version, constraint);
  }

  /**
   * Private helper methods
   */

  private loadMigrationGuides(): void {
    // Load pre-defined migration guides
    // This would typically load from a database or API
    
    // Example migration guide for major version upgrade
    this.migrationGuides.set('example-plugin:1to2', {
      id: 'example-plugin-1to2',
      title: 'Migrate Example Plugin from v1 to v2',
      overview: 'Major API changes and new configuration format',
      steps: [
        {
          title: 'Update configuration format',
          description: 'The configuration format has changed in v2',
          code: {
            before: '// v1 config\nconfig: { option: "value" }',
            after: '// v2 config\nconfig: {\n  newFormat: {\n    option: "value"\n  }\n}'
          }
        }
      ],
      codeExamples: [],
      warnings: ['Backup your configuration before upgrading'],
      estimatedTime: 2,
      difficulty: 'medium',
      automatedSteps: 1,
      manualSteps: 2
    });
  }

  private areConstraintsCompatible(constraint1: string, constraint2: string): boolean {
    // Check if two version constraints are compatible
    try {
      const range1 = new semver.Range(constraint1);
      const range2 = new semver.Range(constraint2);
      
      // Find intersection of ranges
      // This is a simplified check - in practice, you'd need more sophisticated logic
      return range1.intersects(range2);
    } catch {
      return false;
    }
  }

  private selectRecommendedVersion(versions: string[]): string {
    if (versions.length === 0) {
      throw new Error('No compatible versions found');
    }

    // Prefer latest stable version
    const stableVersions = versions.filter(v => {
      const parsed = semver.parse(v);
      return parsed && parsed.prerelease.length === 0;
    });

    if (stableVersions.length > 0) {
      return stableVersions[0]; // Already sorted in descending order
    }

    // If no stable versions, return latest prerelease
    return versions[0];
  }

  private determineResolutionStrategy(
    constraints: VersionConstraint[],
    satisfyingVersions: string[]
  ): 'latest' | 'lts' | 'compatible' | 'manual' {
    if (satisfyingVersions.length === 0) {
      return 'manual';
    }

    // Check if any constraint prefers LTS
    const hasLtsPreference = constraints.some(c => c.preferLts);
    if (hasLtsPreference) {
      return 'lts';
    }

    // Check if constraints are very restrictive
    const hasStrictConstraints = constraints.some(c => c.range.includes('='));
    if (hasStrictConstraints) {
      return 'compatible';
    }

    return 'latest';
  }

  private generateResolutionReasoning(
    constraints: VersionConstraint[],
    satisfyingVersions: string[]
  ): string {
    if (satisfyingVersions.length === 0) {
      return 'No version satisfies all constraints. Manual resolution required.';
    }

    if (satisfyingVersions.length === 1) {
      return `Only one version (${satisfyingVersions[0]}) satisfies all constraints.`;
    }

    return `${satisfyingVersions.length} versions satisfy constraints. Recommending latest stable version.`;
  }

  private async calculateUpgradePath(
    pluginId: string,
    fromVersion: string,
    toVersion: string
  ): Promise<UpgradePath[]> {
    const path: UpgradePath[] = [];
    const fromInfo = this.parseVersion(fromVersion)!;
    const toInfo = this.parseVersion(toVersion)!;

    // For major version jumps, create intermediate steps
    if (toInfo.major > fromInfo.major) {
      for (let major = fromInfo.major + 1; major <= toInfo.major; major++) {
        const stepVersion = major === toInfo.major ? toVersion : `${major}.0.0`;
        path.push({
          from: path.length === 0 ? fromVersion : path[path.length - 1].to,
          to: stepVersion,
          type: 'major',
          description: `Upgrade to v${major} (major version change)`,
          estimatedTime: 4, // hours
          breakingChanges: await this.getBreakingChangesForVersion(pluginId, stepVersion)
        });
      }
    } else if (toInfo.minor > fromInfo.minor || toInfo.patch > fromInfo.patch) {
      // Direct minor/patch upgrade
      path.push({
        from: fromVersion,
        to: toVersion,
        type: toInfo.minor > fromInfo.minor ? 'minor' : 'patch',
        description: `Upgrade to ${toVersion}`,
        estimatedTime: toInfo.minor > fromInfo.minor ? 1 : 0.5,
        breakingChanges: []
      });
    }

    return path;
  }

  private async getBreakingChangesForVersion(
    pluginId: string,
    version: string
  ): Promise<string[]> {
    // This would fetch breaking changes from changelog or API
    // For now, return placeholder data
    return [];
  }

  private assessUpgradeRisk(
    currentInfo: VersionInfo,
    targetInfo: VersionInfo,
    breakingChanges: BreakingChange[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (breakingChanges.length === 0 && targetInfo.major === currentInfo.major) {
      return 'low';
    }

    if (targetInfo.major > currentInfo.major) {
      if (breakingChanges.length > 5) {
        return 'critical';
      } else if (breakingChanges.length > 2) {
        return 'high';
      } else {
        return 'medium';
      }
    }

    if (breakingChanges.length > 3) {
      return 'high';
    } else if (breakingChanges.length > 1) {
      return 'medium';
    }

    return 'low';
  }

  private estimateUpgradeEffort(
    upgradePath: UpgradePath[],
    breakingChanges: BreakingChange[]
  ): number {
    let totalHours = 0;

    // Base effort for upgrade path
    totalHours += upgradePath.reduce((sum, step) => sum + step.estimatedTime, 0);

    // Additional effort for breaking changes
    for (const change of breakingChanges) {
      switch (change.impact) {
        case 'low':
          totalHours += 0.5;
          break;
        case 'medium':
          totalHours += 2;
          break;
        case 'high':
          totalHours += 8;
          break;
        case 'critical':
          totalHours += 16;
          break;
      }
    }

    // Add testing time
    totalHours += Math.max(2, totalHours * 0.3);

    return Math.round(totalHours * 10) / 10; // Round to 1 decimal place
  }

  private generateRequiredActions(
    upgradePath: UpgradePath[],
    breakingChanges: BreakingChange[]
  ): string[] {
    const actions: string[] = [];

    actions.push('Create backup of current installation');
    actions.push('Review all breaking changes and migration notes');

    for (const step of upgradePath) {
      actions.push(`Upgrade to ${step.to} (${step.description})`);
      if (step.breakingChanges.length > 0) {
        actions.push(`Address ${step.breakingChanges.length} breaking changes`);
      }
    }

    // Add specific actions for breaking changes
    const manualChanges = breakingChanges.filter(c => !c.autoFixable);
    if (manualChanges.length > 0) {
      actions.push(`Manually address ${manualChanges.length} non-automated breaking changes`);
    }

    actions.push('Run comprehensive tests');
    actions.push('Update documentation');

    return actions;
  }

  private async getChangelogBetweenVersions(
    pluginId: string,
    fromVersion: string,
    toVersion: string
  ): Promise<ChangelogEntry[]> {
    // This would fetch from changelog API or parse changelog files
    // For now, return mock data
    return [];
  }

  private assessChangeImpact(change: string): 'low' | 'medium' | 'high' | 'critical' {
    const keywords = {
      critical: ['removed', 'deleted', 'deprecated api'],
      high: ['changed signature', 'renamed', 'moved'],
      medium: ['updated', 'modified', 'enhanced'],
      low: ['improved', 'optimized', 'fixed']
    };

    const changeLower = change.toLowerCase();
    
    for (const [level, words] of Object.entries(keywords)) {
      if (words.some(word => changeLower.includes(word))) {
        return level as 'low' | 'medium' | 'high' | 'critical';
      }
    }

    return 'medium'; // Default
  }

  private generateMigrationPath(change: string): string {
    // Generate migration suggestions based on the change description
    if (change.includes('removed')) {
      return 'Find alternative API or remove usage';
    } else if (change.includes('renamed')) {
      return 'Update all references to use new name';
    } else if (change.includes('signature changed')) {
      return 'Update function calls to match new signature';
    }
    
    return 'Review change and update code accordingly';
  }

  private isAutoFixable(change: string): boolean {
    const autoFixablePatterns = [
      'renamed',
      'moved to',
      'import path changed'
    ];

    return autoFixablePatterns.some(pattern => 
      change.toLowerCase().includes(pattern)
    );
  }

  private generateMigrationOverview(
    fromInfo: VersionInfo,
    toInfo: VersionInfo,
    breakingChanges: BreakingChange[]
  ): string {
    const versionType = toInfo.major > fromInfo.major ? 'major' : 
                       toInfo.minor > fromInfo.minor ? 'minor' : 'patch';
    
    const overview = `This guide covers migrating from version ${fromInfo.version} to ${toInfo.version}. `;
    
    if (versionType === 'major') {
      return overview + `This is a major version upgrade with ${breakingChanges.length} breaking changes. ` +
             'Significant testing and code updates may be required.';
    } else if (breakingChanges.length > 0) {
      return overview + `This upgrade includes ${breakingChanges.length} breaking changes that require attention.`;
    } else {
      return overview + 'This is a straightforward upgrade with no breaking changes.';
    }
  }

  private generateMigrationSteps(breakingChanges: BreakingChange[]): Array<{
    title: string;
    description: string;
    code?: { before: string; after: string };
  }> {
    return breakingChanges.map((change, index) => ({
      title: `Step ${index + 1}: ${change.description}`,
      description: change.migrationPath,
      code: change.codeExample ? {
        before: change.codeExample.before,
        after: change.codeExample.after
      } : undefined
    }));
  }

  private generateCodeExamples(breakingChanges: BreakingChange[]): Array<{
    title: string;
    before: string;
    after: string;
  }> {
    return breakingChanges
      .filter(change => change.codeExample)
      .map(change => ({
        title: change.description,
        before: change.codeExample!.before,
        after: change.codeExample!.after
      }));
  }

  private generateMigrationWarnings(breakingChanges: BreakingChange[]): string[] {
    const warnings: string[] = [];
    
    const criticalChanges = breakingChanges.filter(c => c.impact === 'critical');
    if (criticalChanges.length > 0) {
      warnings.push(`${criticalChanges.length} critical breaking changes require immediate attention`);
    }

    const nonAutoFixable = breakingChanges.filter(c => !c.autoFixable);
    if (nonAutoFixable.length > 0) {
      warnings.push(`${nonAutoFixable.length} changes require manual intervention`);
    }

    warnings.push('Always test in a development environment before upgrading production');
    warnings.push('Create a backup before starting the migration');

    return warnings;
  }

  private assessMigrationDifficulty(breakingChanges: BreakingChange[]): 'easy' | 'medium' | 'hard' {
    const criticalCount = breakingChanges.filter(c => c.impact === 'critical').length;
    const highCount = breakingChanges.filter(c => c.impact === 'high').length;
    const manualCount = breakingChanges.filter(c => !c.autoFixable).length;

    if (criticalCount > 0 || manualCount > 3) {
      return 'hard';
    } else if (highCount > 0 || manualCount > 0) {
      return 'medium';
    }

    return 'easy';
  }

  private generateRangeConstraint(minVersion: string, maxVersion: string): string {
    if (minVersion === maxVersion) {
      return minVersion;
    }

    const minInfo = semver.parse(minVersion)!;
    const maxInfo = semver.parse(maxVersion)!;

    if (minInfo.major === maxInfo.major) {
      return `~${minVersion}`;
    } else {
      return `>=${minVersion} <${maxInfo.major + 1}.0.0`;
    }
  }
}

export default VersionManager;