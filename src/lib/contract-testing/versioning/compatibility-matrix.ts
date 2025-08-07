import { ContractVersion, CompatibilityResult } from '../types';
import { SemanticVersionManager } from './semantic-version';
import { CompatibilityChecker } from '../core/compatibility-checker';
import { Logger } from 'winston';

export interface CompatibilityMatrixEntry {
  consumerName: string;
  consumerVersion: string;
  providerName: string;
  providerVersion: string;
  isCompatible: boolean;
  compatibilityScore: number;
  lastTested: Date;
  testResults?: CompatibilityResult;
  environment?: string;
  tags?: string[];
}

export interface MatrixFilters {
  consumer?: string;
  provider?: string;
  environment?: string;
  minCompatibilityScore?: number;
  dateRange?: {
    from: Date;
    to: Date;
  };
  includePreRelease?: boolean;
}

export interface MatrixSummary {
  totalCombinations: number;
  compatibleCombinations: number;
  incompatibleCombinations: number;
  averageCompatibilityScore: number;
  lastUpdated: Date;
  environmentBreakdown: Record<string, {
    total: number;
    compatible: number;
    averageScore: number;
  }>;
}

export class CompatibilityMatrix {
  private logger: Logger;
  private versionManager: SemanticVersionManager;
  private compatibilityChecker: CompatibilityChecker;
  private matrix: Map<string, CompatibilityMatrixEntry>;

  constructor(logger: Logger) {
    this.logger = logger;
    this.versionManager = new SemanticVersionManager();
    this.compatibilityChecker = new CompatibilityChecker(logger);
    this.matrix = new Map();
  }

  /**
   * Add entry to compatibility matrix
   */
  addEntry(entry: CompatibilityMatrixEntry): void {
    const key = this.generateMatrixKey(
      entry.consumerName,
      entry.consumerVersion,
      entry.providerName,
      entry.providerVersion,
      entry.environment
    );

    this.matrix.set(key, {
      ...entry,
      lastTested: new Date()
    });

    this.logger.debug('Added compatibility matrix entry', {
      key,
      compatible: entry.isCompatible,
      score: entry.compatibilityScore
    });
  }

  /**
   * Update entry in compatibility matrix
   */
  updateEntry(
    consumerName: string,
    consumerVersion: string,
    providerName: string,
    providerVersion: string,
    updates: Partial<CompatibilityMatrixEntry>,
    environment?: string
  ): void {
    const key = this.generateMatrixKey(
      consumerName,
      consumerVersion,
      providerName,
      providerVersion,
      environment
    );

    const existing = this.matrix.get(key);
    if (existing) {
      this.matrix.set(key, {
        ...existing,
        ...updates,
        lastTested: new Date()
      });

      this.logger.debug('Updated compatibility matrix entry', { key });
    } else {
      this.logger.warn('Attempted to update non-existent matrix entry', { key });
    }
  }

  /**
   * Get compatibility entry
   */
  getEntry(
    consumerName: string,
    consumerVersion: string,
    providerName: string,
    providerVersion: string,
    environment?: string
  ): CompatibilityMatrixEntry | null {
    const key = this.generateMatrixKey(
      consumerName,
      consumerVersion,
      providerName,
      providerVersion,
      environment
    );

    return this.matrix.get(key) || null;
  }

  /**
   * Check if specific combination is compatible
   */
  isCompatible(
    consumerName: string,
    consumerVersion: string,
    providerName: string,
    providerVersion: string,
    environment?: string
  ): boolean | null {
    const entry = this.getEntry(
      consumerName,
      consumerVersion,
      providerName,
      providerVersion,
      environment
    );

    return entry ? entry.isCompatible : null;
  }

  /**
   * Find compatible provider versions for a consumer
   */
  findCompatibleProviderVersions(
    consumerName: string,
    consumerVersion: string,
    providerName: string,
    environment?: string
  ): CompatibilityMatrixEntry[] {
    const compatibleEntries: CompatibilityMatrixEntry[] = [];

    this.matrix.forEach((entry, key) => {
      if (
        entry.consumerName === consumerName &&
        entry.consumerVersion === consumerVersion &&
        entry.providerName === providerName &&
        entry.isCompatible &&
        (!environment || entry.environment === environment)
      ) {
        compatibleEntries.push(entry);
      }
    });

    // Sort by provider version (latest first)
    compatibleEntries.sort((a, b) =>
      this.versionManager.compareVersions(b.providerVersion, a.providerVersion)
    );

    return compatibleEntries;
  }

  /**
   * Find compatible consumer versions for a provider
   */
  findCompatibleConsumerVersions(
    providerName: string,
    providerVersion: string,
    consumerName?: string,
    environment?: string
  ): CompatibilityMatrixEntry[] {
    const compatibleEntries: CompatibilityMatrixEntry[] = [];

    this.matrix.forEach((entry, key) => {
      if (
        entry.providerName === providerName &&
        entry.providerVersion === providerVersion &&
        entry.isCompatible &&
        (!consumerName || entry.consumerName === consumerName) &&
        (!environment || entry.environment === environment)
      ) {
        compatibleEntries.push(entry);
      }
    });

    // Sort by consumer version (latest first)
    compatibleEntries.sort((a, b) =>
      this.versionManager.compareVersions(b.consumerVersion, a.consumerVersion)
    );

    return compatibleEntries;
  }

  /**
   * Get latest compatible version for a consumer-provider pair
   */
  getLatestCompatibleVersion(
    consumerName: string,
    providerName: string,
    environment?: string
  ): {
    consumerVersion: string;
    providerVersion: string;
    entry: CompatibilityMatrixEntry;
  } | null {
    const entries: CompatibilityMatrixEntry[] = [];

    this.matrix.forEach((entry) => {
      if (
        entry.consumerName === consumerName &&
        entry.providerName === providerName &&
        entry.isCompatible &&
        (!environment || entry.environment === environment)
      ) {
        entries.push(entry);
      }
    });

    if (entries.length === 0) {
      return null;
    }

    // Find entry with latest versions
    entries.sort((a, b) => {
      const providerVersionDiff = this.versionManager.compareVersions(
        b.providerVersion,
        a.providerVersion
      );
      if (providerVersionDiff !== 0) {
        return providerVersionDiff;
      }
      return this.versionManager.compareVersions(
        b.consumerVersion,
        a.consumerVersion
      );
    });

    const latest = entries[0];
    return {
      consumerVersion: latest.consumerVersion,
      providerVersion: latest.providerVersion,
      entry: latest
    };
  }

  /**
   * Get matrix entries with filters
   */
  getEntries(filters: MatrixFilters = {}): CompatibilityMatrixEntry[] {
    const entries: CompatibilityMatrixEntry[] = [];

    this.matrix.forEach((entry) => {
      if (this.entryMatchesFilters(entry, filters)) {
        entries.push(entry);
      }
    });

    return entries.sort((a, b) => b.lastTested.getTime() - a.lastTested.getTime());
  }

  /**
   * Generate compatibility report
   */
  generateCompatibilityReport(filters: MatrixFilters = {}): MatrixSummary {
    const entries = this.getEntries(filters);
    const compatible = entries.filter(entry => entry.isCompatible);
    const incompatible = entries.filter(entry => !entry.isCompatible);

    const totalScore = entries.reduce((sum, entry) => sum + entry.compatibilityScore, 0);
    const averageScore = entries.length > 0 ? totalScore / entries.length : 0;

    // Environment breakdown
    const environmentBreakdown: Record<string, any> = {};
    entries.forEach(entry => {
      const env = entry.environment || 'default';
      if (!environmentBreakdown[env]) {
        environmentBreakdown[env] = {
          total: 0,
          compatible: 0,
          totalScore: 0
        };
      }

      environmentBreakdown[env].total++;
      environmentBreakdown[env].totalScore += entry.compatibilityScore;
      if (entry.isCompatible) {
        environmentBreakdown[env].compatible++;
      }
    });

    // Calculate average scores per environment
    Object.keys(environmentBreakdown).forEach(env => {
      const envData = environmentBreakdown[env];
      envData.averageScore = envData.total > 0 ? envData.totalScore / envData.total : 0;
      delete envData.totalScore;
    });

    return {
      totalCombinations: entries.length,
      compatibleCombinations: compatible.length,
      incompatibleCombinations: incompatible.length,
      averageCompatibilityScore: Math.round(averageScore * 100) / 100,
      lastUpdated: new Date(),
      environmentBreakdown
    };
  }

  /**
   * Identify version upgrade paths
   */
  getUpgradePaths(
    consumerName: string,
    currentConsumerVersion: string,
    providerName: string,
    currentProviderVersion: string,
    targetProviderVersion: string,
    environment?: string
  ): {
    path: string[];
    isViable: boolean;
    blockers: string[];
  } {
    const path: string[] = [];
    const blockers: string[] = [];

    // Get all versions between current and target
    const allProviderVersions = this.getAllVersionsForProvider(providerName);
    const sortedVersions = allProviderVersions
      .filter(version =>
        this.versionManager.compareVersions(version, currentProviderVersion) >= 0 &&
        this.versionManager.compareVersions(version, targetProviderVersion) <= 0
      )
      .sort(this.versionManager.compareVersions.bind(this.versionManager));

    // Check each step in the upgrade path
    let currentVersion = currentProviderVersion;
    path.push(currentVersion);

    for (const nextVersion of sortedVersions) {
      if (nextVersion === currentVersion) continue;

      const isCompatible = this.isCompatible(
        consumerName,
        currentConsumerVersion,
        providerName,
        nextVersion,
        environment
      );

      if (isCompatible === false) {
        blockers.push(`${consumerName}@${currentConsumerVersion} is incompatible with ${providerName}@${nextVersion}`);
      } else if (isCompatible === null) {
        blockers.push(`Compatibility unknown for ${consumerName}@${currentConsumerVersion} and ${providerName}@${nextVersion}`);
      } else {
        path.push(nextVersion);
        currentVersion = nextVersion;
      }
    }

    return {
      path,
      isViable: blockers.length === 0 && path.includes(targetProviderVersion),
      blockers
    };
  }

  /**
   * Get dependency graph for compatibility visualization
   */
  getDependencyGraph(environment?: string): {
    nodes: { id: string; label: string; type: 'consumer' | 'provider'; version: string }[];
    edges: { from: string; to: string; compatible: boolean; score: number }[];
  } {
    const nodes = new Map();
    const edges: any[] = [];

    this.matrix.forEach((entry) => {
      if (environment && entry.environment !== environment) {
        return;
      }

      const consumerId = `${entry.consumerName}@${entry.consumerVersion}`;
      const providerId = `${entry.providerName}@${entry.providerVersion}`;

      // Add nodes
      nodes.set(consumerId, {
        id: consumerId,
        label: entry.consumerName,
        type: 'consumer',
        version: entry.consumerVersion
      });

      nodes.set(providerId, {
        id: providerId,
        label: entry.providerName,
        type: 'provider',
        version: entry.providerVersion
      });

      // Add edge
      edges.push({
        from: consumerId,
        to: providerId,
        compatible: entry.isCompatible,
        score: entry.compatibilityScore
      });
    });

    return {
      nodes: Array.from(nodes.values()),
      edges
    };
  }

  /**
   * Export compatibility matrix to JSON
   */
  exportMatrix(): any {
    const entries: CompatibilityMatrixEntry[] = [];
    this.matrix.forEach((entry) => {
      entries.push(entry);
    });

    return {
      exportDate: new Date().toISOString(),
      totalEntries: entries.length,
      entries
    };
  }

  /**
   * Import compatibility matrix from JSON
   */
  importMatrix(data: any): void {
    if (!data.entries || !Array.isArray(data.entries)) {
      throw new Error('Invalid import data format');
    }

    this.matrix.clear();

    data.entries.forEach((entry: CompatibilityMatrixEntry) => {
      // Validate required fields
      if (!entry.consumerName || !entry.consumerVersion ||
          !entry.providerName || !entry.providerVersion) {
        this.logger.warn('Skipping invalid matrix entry', { entry });
        return;
      }

      // Convert date strings back to Date objects
      entry.lastTested = new Date(entry.lastTested);

      this.addEntry(entry);
    });

    this.logger.info('Imported compatibility matrix', {
      totalEntries: data.entries.length,
      validEntries: this.matrix.size
    });
  }

  /**
   * Clear matrix entries matching filters
   */
  clearEntries(filters: MatrixFilters = {}): number {
    let removedCount = 0;
    const keysToRemove: string[] = [];

    this.matrix.forEach((entry, key) => {
      if (this.entryMatchesFilters(entry, filters)) {
        keysToRemove.push(key);
        removedCount++;
      }
    });

    keysToRemove.forEach(key => this.matrix.delete(key));

    this.logger.info('Cleared matrix entries', { removedCount, totalRemaining: this.matrix.size });
    return removedCount;
  }

  /**
   * Get stale entries that need re-testing
   */
  getStaleEntries(maxAge: number = 7 * 24 * 60 * 60 * 1000): CompatibilityMatrixEntry[] {
    const cutoffDate = new Date(Date.now() - maxAge);
    const staleEntries: CompatibilityMatrixEntry[] = [];

    this.matrix.forEach((entry) => {
      if (entry.lastTested < cutoffDate) {
        staleEntries.push(entry);
      }
    });

    return staleEntries.sort((a, b) => a.lastTested.getTime() - b.lastTested.getTime());
  }

  private generateMatrixKey(
    consumerName: string,
    consumerVersion: string,
    providerName: string,
    providerVersion: string,
    environment?: string
  ): string {
    const env = environment || 'default';
    return `${consumerName}@${consumerVersion}:${providerName}@${providerVersion}:${env}`;
  }

  private entryMatchesFilters(entry: CompatibilityMatrixEntry, filters: MatrixFilters): boolean {
    if (filters.consumer && entry.consumerName !== filters.consumer) {
      return false;
    }

    if (filters.provider && entry.providerName !== filters.provider) {
      return false;
    }

    if (filters.environment && entry.environment !== filters.environment) {
      return false;
    }

    if (filters.minCompatibilityScore !== undefined &&
        entry.compatibilityScore < filters.minCompatibilityScore) {
      return false;
    }

    if (filters.dateRange) {
      if (entry.lastTested < filters.dateRange.from ||
          entry.lastTested > filters.dateRange.to) {
        return false;
      }
    }

    if (filters.includePreRelease === false) {
      if (this.versionManager.isPreRelease(entry.consumerVersion) ||
          this.versionManager.isPreRelease(entry.providerVersion)) {
        return false;
      }
    }

    return true;
  }

  private getAllVersionsForProvider(providerName: string): string[] {
    const versions = new Set<string>();

    this.matrix.forEach((entry) => {
      if (entry.providerName === providerName) {
        versions.add(entry.providerVersion);
      }
    });

    return Array.from(versions);
  }
}