/**
 * Semantic Version Engine
 * 
 * Advanced semantic versioning with automatic compatibility detection
 * and breaking change analysis
 */

import { SemanticVersion, ChangelogEntry, IMPACT_LEVELS } from '../types';

export class SemanticVersionEngine {
  private static readonly VERSION_REGEX = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

  /**
   * Parse a version string into a SemanticVersion object
   */
  static parse(versionString: string): SemanticVersion {
    const match = versionString.match(this.VERSION_REGEX);
    
    if (!match) {
      throw new Error(`Invalid semantic version: ${versionString}`);
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      prerelease: match[4] || undefined,
      buildMetadata: match[5] || undefined,
      raw: versionString
    };
  }

  /**
   * Compare two versions
   * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
   */
  static compare(v1: SemanticVersion | string, v2: SemanticVersion | string): number {
    const version1 = typeof v1 === 'string' ? this.parse(v1) : v1;
    const version2 = typeof v2 === 'string' ? this.parse(v2) : v2;

    // Compare major
    if (version1.major !== version2.major) {
      return version1.major > version2.major ? 1 : -1;
    }

    // Compare minor
    if (version1.minor !== version2.minor) {
      return version1.minor > version2.minor ? 1 : -1;
    }

    // Compare patch
    if (version1.patch !== version2.patch) {
      return version1.patch > version2.patch ? 1 : -1;
    }

    // Compare prerelease
    return this.comparePrerelease(version1.prerelease, version2.prerelease);
  }

  /**
   * Check if two versions are compatible
   */
  static isCompatible(v1: SemanticVersion | string, v2: SemanticVersion | string): boolean {
    const version1 = typeof v1 === 'string' ? this.parse(v1) : v1;
    const version2 = typeof v2 === 'string' ? this.parse(v2) : v2;

    // Major version changes are breaking
    if (version1.major !== version2.major) {
      return false;
    }

    // Minor and patch version increases are backward compatible
    return this.compare(version1, version2) <= 0;
  }

  /**
   * Determine if upgrade is breaking
   */
  static isBreakingChange(from: SemanticVersion | string, to: SemanticVersion | string): boolean {
    const fromVersion = typeof from === 'string' ? this.parse(from) : from;
    const toVersion = typeof to === 'string' ? this.parse(to) : to;

    return toVersion.major > fromVersion.major;
  }

  /**
   * Get next version based on change type
   */
  static getNextVersion(current: SemanticVersion | string, changeType: 'major' | 'minor' | 'patch'): SemanticVersion {
    const currentVersion = typeof current === 'string' ? this.parse(current) : current;

    switch (changeType) {
      case 'major':
        return {
          ...currentVersion,
          major: currentVersion.major + 1,
          minor: 0,
          patch: 0,
          prerelease: undefined,
          raw: `${currentVersion.major + 1}.0.0`
        };

      case 'minor':
        return {
          ...currentVersion,
          minor: currentVersion.minor + 1,
          patch: 0,
          prerelease: undefined,
          raw: `${currentVersion.major}.${currentVersion.minor + 1}.0`
        };

      case 'patch':
        return {
          ...currentVersion,
          patch: currentVersion.patch + 1,
          prerelease: undefined,
          raw: `${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch + 1}`
        };

      default:
        throw new Error(`Unknown change type: ${changeType}`);
    }
  }

  /**
   * Analyze changelog entries to determine version bump type
   */
  static analyzeChangelog(entries: ChangelogEntry[]): 'major' | 'minor' | 'patch' {
    const hasBreaking = entries.some(entry => 
      entry.impact === IMPACT_LEVELS.BREAKING || 
      entry.type === 'removed'
    );

    if (hasBreaking) {
      return 'major';
    }

    const hasFeatures = entries.some(entry => 
      entry.type === 'added' && 
      entry.impact !== IMPACT_LEVELS.LOW
    );

    if (hasFeatures) {
      return 'minor';
    }

    return 'patch';
  }

  /**
   * Get version range for compatibility
   */
  static getCompatibleRange(version: SemanticVersion | string): string {
    const v = typeof version === 'string' ? this.parse(version) : version;
    
    if (v.major === 0) {
      // For 0.x.x versions, only patch versions are compatible
      return `~${v.raw}`;
    }

    // For 1.x.x and above, minor versions are compatible
    return `^${v.raw}`;
  }

  /**
   * Check if version satisfies range
   */
  static satisfiesRange(version: SemanticVersion | string, range: string): boolean {
    const v = typeof version === 'string' ? this.parse(version) : version;

    if (range.startsWith('^')) {
      const baseVersion = this.parse(range.substring(1));
      return v.major === baseVersion.major && this.compare(v, baseVersion) >= 0;
    }

    if (range.startsWith('~')) {
      const baseVersion = this.parse(range.substring(1));
      return v.major === baseVersion.major && 
             v.minor === baseVersion.minor && 
             v.patch >= baseVersion.patch;
    }

    // Exact match
    return v.raw === range;
  }

  /**
   * Get all versions between two versions
   */
  static getVersionsBetween(from: SemanticVersion | string, to: SemanticVersion | string, versions: string[]): string[] {
    const fromVersion = typeof from === 'string' ? this.parse(from) : from;
    const toVersion = typeof to === 'string' ? this.parse(to) : to;

    return versions
      .filter(v => {
        const version = this.parse(v);
        return this.compare(version, fromVersion) > 0 && this.compare(version, toVersion) <= 0;
      })
      .sort((a, b) => this.compare(a, b));
  }

  /**
   * Generate version metadata
   */
  static generateMetadata(version: SemanticVersion, changelog: ChangelogEntry[]): Record<string, any> {
    return {
      version: version.raw,
      breaking: changelog.some(entry => entry.impact === IMPACT_LEVELS.BREAKING),
      changes: changelog.length,
      addedFeatures: changelog.filter(entry => entry.type === 'added').length,
      deprecatedFeatures: changelog.filter(entry => entry.type === 'deprecated').length,
      removedFeatures: changelog.filter(entry => entry.type === 'removed').length,
      bugFixes: changelog.filter(entry => entry.type === 'fixed').length,
      securityFixes: changelog.filter(entry => entry.type === 'security').length,
      highImpactChanges: changelog.filter(entry => 
        entry.impact === IMPACT_LEVELS.HIGH || entry.impact === IMPACT_LEVELS.BREAKING
      ).length
    };
  }

  private static comparePrerelease(pre1?: string, pre2?: string): number {
    if (!pre1 && !pre2) return 0;
    if (!pre1) return 1;
    if (!pre2) return -1;

    const parts1 = pre1.split('.');
    const parts2 = pre2.split('.');
    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
      const part1 = parts1[i];
      const part2 = parts2[i];

      if (!part1) return -1;
      if (!part2) return 1;

      const num1 = parseInt(part1, 10);
      const num2 = parseInt(part2, 10);

      if (!isNaN(num1) && !isNaN(num2)) {
        if (num1 !== num2) return num1 > num2 ? 1 : -1;
      } else {
        if (part1 !== part2) return part1 > part2 ? 1 : -1;
      }
    }

    return 0;
  }
}

export default SemanticVersionEngine;