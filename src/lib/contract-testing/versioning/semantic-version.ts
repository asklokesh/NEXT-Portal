import { ContractVersion, BreakingChange, Warning } from '../types';
import semver from 'semver';

export class SemanticVersionManager {
  /**
   * Parse version string into structured version object
   */
  parseVersion(versionString: string): ContractVersion {
    const parsed = semver.parse(versionString);
    if (!parsed) {
      throw new Error(`Invalid version string: ${versionString}`);
    }

    return {
      version: versionString,
      majorVersion: parsed.major,
      minorVersion: parsed.minor,
      patchVersion: parsed.patch,
      preRelease: parsed.prerelease.length > 0 ? parsed.prerelease.join('.') : undefined,
      build: parsed.build.length > 0 ? parsed.build.join('.') : undefined
    };
  }

  /**
   * Compare two versions
   */
  compareVersions(version1: string, version2: string): number {
    return semver.compare(version1, version2);
  }

  /**
   * Check if version satisfies range
   */
  satisfiesRange(version: string, range: string): boolean {
    return semver.satisfies(version, range);
  }

  /**
   * Get next version based on change type
   */
  getNextVersion(currentVersion: string, changeType: 'major' | 'minor' | 'patch'): string {
    switch (changeType) {
      case 'major':
        return semver.inc(currentVersion, 'major')!;
      case 'minor':
        return semver.inc(currentVersion, 'minor')!;
      case 'patch':
        return semver.inc(currentVersion, 'patch')!;
      default:
        throw new Error(`Invalid change type: ${changeType}`);
    }
  }

  /**
   * Determine required version bump based on breaking changes
   */
  determineVersionBump(breakingChanges: BreakingChange[], warnings: Warning[]): 'major' | 'minor' | 'patch' {
    // If there are any major breaking changes, require major version bump
    const hasMajorBreaking = breakingChanges.some(change => change.severity === 'major');
    if (hasMajorBreaking) {
      return 'major';
    }

    // If there are minor breaking changes, require minor version bump
    const hasMinorBreaking = breakingChanges.some(change => change.severity === 'minor');
    if (hasMinorBreaking) {
      return 'minor';
    }

    // If there are any changes (including warnings), require patch version bump
    if (breakingChanges.length > 0 || warnings.length > 0) {
      return 'patch';
    }

    return 'patch';
  }

  /**
   * Get compatible version ranges
   */
  getCompatibleRanges(version: string): {
    major: string;
    minor: string;
    patch: string;
  } {
    const parsed = this.parseVersion(version);
    
    return {
      major: `^${parsed.majorVersion}.0.0`,
      minor: `~${parsed.majorVersion}.${parsed.minorVersion}.0`,
      patch: `${version}`
    };
  }

  /**
   * Check if two versions are compatible
   */
  areVersionsCompatible(
    consumerVersion: string,
    providerVersion: string,
    compatibility: 'strict' | 'minor' | 'major' = 'minor'
  ): boolean {
    const consumer = this.parseVersion(consumerVersion);
    const provider = this.parseVersion(providerVersion);

    switch (compatibility) {
      case 'strict':
        return consumerVersion === providerVersion;
      
      case 'minor':
        return (
          consumer.majorVersion === provider.majorVersion &&
          consumer.minorVersion <= provider.minorVersion
        );
      
      case 'major':
        return consumer.majorVersion <= provider.majorVersion;
      
      default:
        return false;
    }
  }

  /**
   * Get version history and changes
   */
  getVersionHistory(versions: string[]): {
    version: string;
    type: 'major' | 'minor' | 'patch' | 'prerelease';
    changes: string[];
  }[] {
    const sortedVersions = versions.sort(semver.compare);
    const history = [];

    for (let i = 1; i < sortedVersions.length; i++) {
      const prev = sortedVersions[i - 1];
      const current = sortedVersions[i];
      const diff = semver.diff(prev, current);

      history.push({
        version: current,
        type: diff as 'major' | 'minor' | 'patch' | 'prerelease',
        changes: this.inferChangesFromVersionDiff(prev, current, diff)
      });
    }

    return history;
  }

  /**
   * Validate version string
   */
  isValidVersion(versionString: string): boolean {
    return semver.valid(versionString) !== null;
  }

  /**
   * Clean version string
   */
  cleanVersion(versionString: string): string {
    const cleaned = semver.clean(versionString);
    if (!cleaned) {
      throw new Error(`Cannot clean version string: ${versionString}`);
    }
    return cleaned;
  }

  /**
   * Generate pre-release version
   */
  generatePreReleaseVersion(
    baseVersion: string,
    preReleaseType: 'alpha' | 'beta' | 'rc' = 'alpha',
    identifier?: string
  ): string {
    const preReleaseId = identifier ? `${preReleaseType}.${identifier}` : preReleaseType;
    return semver.inc(baseVersion, 'prerelease', preReleaseId)!;
  }

  /**
   * Check if version is pre-release
   */
  isPreRelease(version: string): boolean {
    const parsed = semver.parse(version);
    return parsed ? parsed.prerelease.length > 0 : false;
  }

  /**
   * Get stable version from pre-release
   */
  getStableVersion(preReleaseVersion: string): string {
    const parsed = semver.parse(preReleaseVersion);
    if (!parsed) {
      throw new Error(`Invalid version: ${preReleaseVersion}`);
    }

    return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  }

  /**
   * Generate version tags for different environments
   */
  generateVersionTags(version: string): {
    latest: string;
    stable: string;
    environment: Record<string, string>;
  } {
    const isPreRelease = this.isPreRelease(version);
    const stableVersion = isPreRelease ? this.getStableVersion(version) : version;

    return {
      latest: version,
      stable: stableVersion,
      environment: {
        development: version,
        staging: isPreRelease ? version : this.generatePreReleaseVersion(version, 'beta'),
        production: stableVersion
      }
    };
  }

  /**
   * Calculate version distance between two versions
   */
  getVersionDistance(from: string, to: string): {
    major: number;
    minor: number;
    patch: number;
    total: number;
  } {
    const fromParsed = this.parseVersion(from);
    const toParsed = this.parseVersion(to);

    const majorDiff = Math.abs(toParsed.majorVersion - fromParsed.majorVersion);
    const minorDiff = Math.abs(toParsed.minorVersion - fromParsed.minorVersion);
    const patchDiff = Math.abs(toParsed.patchVersion - fromParsed.patchVersion);

    return {
      major: majorDiff,
      minor: minorDiff,
      patch: patchDiff,
      total: majorDiff * 10000 + minorDiff * 100 + patchDiff
    };
  }

  /**
   * Find closest compatible version from a list
   */
  findClosestCompatibleVersion(
    targetVersion: string,
    availableVersions: string[],
    compatibility: 'strict' | 'minor' | 'major' = 'minor'
  ): string | null {
    const compatibleVersions = availableVersions.filter(version =>
      this.areVersionsCompatible(targetVersion, version, compatibility)
    );

    if (compatibleVersions.length === 0) {
      return null;
    }

    // Sort by distance and return closest
    const versionsWithDistance = compatibleVersions.map(version => ({
      version,
      distance: this.getVersionDistance(targetVersion, version).total
    }));

    versionsWithDistance.sort((a, b) => a.distance - b.distance);
    return versionsWithDistance[0].version;
  }

  /**
   * Generate version migration path
   */
  generateMigrationPath(
    fromVersion: string,
    toVersion: string,
    availableVersions: string[]
  ): string[] {
    const sortedVersions = availableVersions
      .filter(v => semver.gte(v, fromVersion) && semver.lte(v, toVersion))
      .sort(semver.compare);

    if (sortedVersions.length === 0) {
      return [fromVersion, toVersion];
    }

    // Include intermediate major versions to ensure safe migration
    const migrationPath = [fromVersion];
    const fromParsed = this.parseVersion(fromVersion);
    const toParsed = this.parseVersion(toVersion);

    // Add major version milestones
    for (let major = fromParsed.majorVersion; major <= toParsed.majorVersion; major++) {
      const majorVersions = sortedVersions.filter(v => {
        const parsed = this.parseVersion(v);
        return parsed.majorVersion === major;
      });

      if (majorVersions.length > 0) {
        // Add the latest version of this major release
        migrationPath.push(majorVersions[majorVersions.length - 1]);
      }
    }

    // Ensure target version is included
    if (!migrationPath.includes(toVersion)) {
      migrationPath.push(toVersion);
    }

    // Remove duplicates and sort
    return [...new Set(migrationPath)].sort(semver.compare);
  }

  private inferChangesFromVersionDiff(
    prevVersion: string,
    currentVersion: string,
    diff: string | null
  ): string[] {
    const changes = [];

    switch (diff) {
      case 'major':
        changes.push('Breaking changes introduced');
        changes.push('API contract modified');
        break;
      case 'minor':
        changes.push('New features added');
        changes.push('Backward compatible changes');
        break;
      case 'patch':
        changes.push('Bug fixes');
        changes.push('Security updates');
        break;
      case 'prerelease':
        changes.push('Pre-release version');
        changes.push('Testing and development changes');
        break;
      default:
        changes.push('Version updated');
    }

    return changes;
  }
}