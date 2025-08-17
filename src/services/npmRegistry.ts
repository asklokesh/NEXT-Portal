import axios from 'axios';
import semver from 'semver';
import { z } from 'zod';

// NPM Package Schema
const NPMPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  author: z.union([
    z.string(),
    z.object({
      name: z.string(),
      email: z.string().optional(),
      url: z.string().optional()
    })
  ]).optional(),
  maintainers: z.array(z.object({
    name: z.string(),
    email: z.string().optional()
  })).optional(),
  repository: z.object({
    type: z.string(),
    url: z.string()
  }).optional(),
  homepage: z.string().optional(),
  bugs: z.object({
    url: z.string().optional(),
    email: z.string().optional()
  }).optional(),
  license: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  peerDependencies: z.record(z.string()).optional()
});

// Vulnerability Report Schema
const VulnerabilitySchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.enum(['low', 'moderate', 'high', 'critical']),
  cves: z.array(z.string()).optional(),
  vulnerable_versions: z.string(),
  patched_versions: z.string().optional(),
  overview: z.string(),
  recommendation: z.string().optional(),
  references: z.array(z.string()).optional()
});

export interface NPMPackageInfo {
  name: string;
  version: string;
  description?: string;
  author?: string | { name: string; email?: string; url?: string };
  maintainers?: Array<{ name: string; email?: string }>;
  repository?: { type: string; url: string };
  homepage?: string;
  license?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  publishedAt?: string;
  downloads?: number;
  stars?: number;
  issues?: number;
  quality?: number;
  popularity?: number;
  maintenance?: number;
}

export interface PluginSearchResult {
  package: NPMPackageInfo;
  score: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
  searchScore: number;
  isBackstagePlugin: boolean;
  compatibilityScore?: number;
}

export interface DependencyAnalysis {
  direct: Record<string, string>;
  peer: Record<string, string>;
  dev: Record<string, string>;
  totalDependencies: number;
  securityIssues: number;
  outdatedDependencies: string[];
  conflictingDependencies: string[];
  missingPeerDependencies: string[];
}

export interface SecurityVulnerability {
  id: string;
  title: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  cves?: string[];
  vulnerableVersions: string;
  patchedVersions?: string;
  overview: string;
  recommendation?: string;
  references?: string[];
  affectedPackage: string;
  installedVersion?: string;
}

export interface LicenseCompatibility {
  license: string;
  isCompatible: boolean;
  isOSI: boolean;
  isFSF: boolean;
  conflicts: string[];
  restrictions: string[];
  commercialUse: boolean;
  modification: boolean;
  distribution: boolean;
  privatUse: boolean;
  patentUse: boolean;
}

export interface PluginMetadata {
  package: NPMPackageInfo;
  versions: string[];
  latestVersion: string;
  backstageCompatibility?: Record<string, string>;
  dependencies: DependencyAnalysis;
  security: {
    vulnerabilities: SecurityVulnerability[];
    score: number;
    lastScanned: Date;
  };
  license: LicenseCompatibility;
  quality: {
    score: number;
    tests: boolean;
    documentation: boolean;
    changelog: boolean;
    readme: boolean;
    typescript: boolean;
  };
  popularity: {
    downloads: {
      weekly: number;
      monthly: number;
      yearly: number;
    };
    stars: number;
    forks: number;
    issues: number;
  };
  lastPublished: Date;
  lastModified: Date;
}

export class NPMRegistryService {
  private readonly npmRegistry = 'https://registry.npmjs.org';
  private readonly npmSearch = 'https://api.npms.io/v2';
  private readonly securityAdvisory = 'https://api.npmjs.org/security/advisories';
  private readonly cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Search for Backstage plugins in NPM registry
   */
  async searchBackstagePlugins(
    query: string,
    options: {
      size?: number;
      from?: number;
      quality?: number;
      popularity?: number;
      maintenance?: number;
    } = {}
  ): Promise<PluginSearchResult[]> {
    const cacheKey = `search:${query}:${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const searchQuery = query || '@backstage/plugin';
      const response = await axios.get(`${this.npmSearch}/search`, {
        params: {
          q: searchQuery,
          size: options.size || 50,
          from: options.from || 0,
          quality: options.quality,
          popularity: options.popularity,
          maintenance: options.maintenance
        }
      });

      const results: PluginSearchResult[] = response.data.results.map((result: any) => ({
        package: this.normalizePackageInfo(result.package),
        score: result.score,
        searchScore: result.searchScore,
        isBackstagePlugin: this.isBackstagePlugin(result.package.name),
        compatibilityScore: this.calculateCompatibilityScore(result.package)
      }));

      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.error('Failed to search NPM registry:', error);
      throw new Error('Failed to search for plugins');
    }
  }

  /**
   * Fetch detailed metadata for a specific plugin
   */
  async fetchPluginMetadata(packageName: string, version?: string): Promise<PluginMetadata> {
    const cacheKey = `metadata:${packageName}:${version || 'latest'}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Fetch package info
      const packageUrl = version 
        ? `${this.npmRegistry}/${packageName}/${version}`
        : `${this.npmRegistry}/${packageName}/latest`;
      
      const packageResponse = await axios.get(packageUrl);
      const packageData = NPMPackageSchema.parse(packageResponse.data);

      // Fetch all versions
      const versionsResponse = await axios.get(`${this.npmRegistry}/${packageName}`);
      const versions = Object.keys(versionsResponse.data.versions || {});

      // Fetch download stats
      const downloadsResponse = await axios.get(
        `https://api.npmjs.org/downloads/point/last-week/${packageName}`
      );
      const downloads = downloadsResponse.data.downloads || 0;

      // Analyze dependencies
      const dependencies = await this.analyzeDependencies(packageData);

      // Check security vulnerabilities
      const security = await this.checkSecurityVulnerabilities(packageName, packageData.version);

      // Check license compatibility
      const license = await this.checkLicenseCompatibility(packageData.license || 'UNLICENSED');

      // Calculate quality metrics
      const quality = this.calculateQualityMetrics(packageData);

      // Get popularity metrics
      const popularity = await this.getPopularityMetrics(packageName);

      const metadata: PluginMetadata = {
        package: this.normalizePackageInfo(packageData),
        versions,
        latestVersion: versionsResponse.data['dist-tags']?.latest || packageData.version,
        backstageCompatibility: this.extractBackstageCompatibility(packageData),
        dependencies,
        security,
        license,
        quality,
        popularity,
        lastPublished: new Date(packageResponse.data.time?.modified || new Date()),
        lastModified: new Date(packageResponse.data.time?.modified || new Date())
      };

      this.setCache(cacheKey, metadata);
      return metadata;
    } catch (error) {
      console.error(`Failed to fetch metadata for ${packageName}:`, error);
      throw new Error(`Failed to fetch plugin metadata for ${packageName}`);
    }
  }

  /**
   * Discover available versions for a plugin
   */
  async discoverVersions(packageName: string): Promise<{
    versions: string[];
    latest: string;
    stable: string[];
    prerelease: string[];
    deprecated: string[];
  }> {
    const cacheKey = `versions:${packageName}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${this.npmRegistry}/${packageName}`);
      const allVersions = Object.keys(response.data.versions || {});
      
      const result = {
        versions: allVersions,
        latest: response.data['dist-tags']?.latest || '',
        stable: allVersions.filter(v => !semver.prerelease(v)),
        prerelease: allVersions.filter(v => semver.prerelease(v)),
        deprecated: Object.entries(response.data.versions || {})
          .filter(([_, data]: [string, any]) => data.deprecated)
          .map(([version]) => version)
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Failed to discover versions for ${packageName}:`, error);
      throw new Error(`Failed to discover versions for ${packageName}`);
    }
  }

  /**
   * Analyze plugin dependencies
   */
  private async analyzeDependencies(packageData: any): Promise<DependencyAnalysis> {
    const direct = packageData.dependencies || {};
    const peer = packageData.peerDependencies || {};
    const dev = packageData.devDependencies || {};

    const outdated: string[] = [];
    const conflicting: string[] = [];
    const missingPeer: string[] = [];

    // Check for outdated dependencies
    for (const [dep, version] of Object.entries(direct)) {
      try {
        const latestResponse = await axios.get(`${this.npmRegistry}/${dep}/latest`);
        const latest = latestResponse.data.version;
        if (!semver.satisfies(latest, version as string)) {
          outdated.push(`${dep}@${version} (latest: ${latest})`);
        }
      } catch (error) {
        // Skip if package not found
      }
    }

    // Check for conflicts between direct and peer dependencies
    for (const [dep, peerVersion] of Object.entries(peer)) {
      if (direct[dep]) {
        const directVersion = direct[dep];
        if (!semver.intersects(directVersion, peerVersion as string)) {
          conflicting.push(`${dep}: direct(${directVersion}) vs peer(${peerVersion})`);
        }
      } else {
        missingPeer.push(`${dep}@${peerVersion}`);
      }
    }

    return {
      direct,
      peer,
      dev,
      totalDependencies: Object.keys(direct).length + Object.keys(peer).length,
      securityIssues: 0, // Will be updated by security check
      outdatedDependencies: outdated,
      conflictingDependencies: conflicting,
      missingPeerDependencies: missingPeer
    };
  }

  /**
   * Check for security vulnerabilities
   */
  private async checkSecurityVulnerabilities(
    packageName: string,
    version: string
  ): Promise<{
    vulnerabilities: SecurityVulnerability[];
    score: number;
    lastScanned: Date;
  }> {
    try {
      // Use npm audit API
      const response = await axios.post('https://registry.npmjs.org/-/npm/v1/security/audits', {
        name: packageName,
        version,
        requires: {
          [packageName]: version
        }
      });

      const vulnerabilities: SecurityVulnerability[] = [];
      const advisories = response.data.advisories || {};

      for (const advisory of Object.values(advisories)) {
        const vuln = VulnerabilitySchema.parse(advisory);
        vulnerabilities.push({
          id: vuln.id,
          title: vuln.title,
          severity: vuln.severity,
          cves: vuln.cves,
          vulnerableVersions: vuln.vulnerable_versions,
          patchedVersions: vuln.patched_versions,
          overview: vuln.overview,
          recommendation: vuln.recommendation,
          references: vuln.references,
          affectedPackage: packageName,
          installedVersion: version
        });
      }

      // Calculate security score (0-100)
      const severityWeights = {
        critical: 40,
        high: 30,
        moderate: 20,
        low: 10
      };

      let totalWeight = 0;
      for (const vuln of vulnerabilities) {
        totalWeight += severityWeights[vuln.severity];
      }

      const score = Math.max(0, 100 - totalWeight);

      return {
        vulnerabilities,
        score,
        lastScanned: new Date()
      };
    } catch (error) {
      console.error('Failed to check security vulnerabilities:', error);
      return {
        vulnerabilities: [],
        score: 100,
        lastScanned: new Date()
      };
    }
  }

  /**
   * Check license compatibility
   */
  private async checkLicenseCompatibility(license: string): Promise<LicenseCompatibility> {
    // Define common open source licenses and their properties
    const licenseDatabase: Record<string, Partial<LicenseCompatibility>> = {
      'MIT': {
        isCompatible: true,
        isOSI: true,
        isFSF: true,
        conflicts: [],
        restrictions: [],
        commercialUse: true,
        modification: true,
        distribution: true,
        privatUse: true,
        patentUse: false
      },
      'Apache-2.0': {
        isCompatible: true,
        isOSI: true,
        isFSF: true,
        conflicts: ['GPL-2.0'],
        restrictions: ['Patent grant'],
        commercialUse: true,
        modification: true,
        distribution: true,
        privatUse: true,
        patentUse: true
      },
      'GPL-3.0': {
        isCompatible: false,
        isOSI: true,
        isFSF: true,
        conflicts: ['MIT', 'Apache-2.0', 'BSD'],
        restrictions: ['Copyleft', 'Disclose source'],
        commercialUse: true,
        modification: true,
        distribution: true,
        privatUse: true,
        patentUse: true
      },
      'ISC': {
        isCompatible: true,
        isOSI: true,
        isFSF: true,
        conflicts: [],
        restrictions: [],
        commercialUse: true,
        modification: true,
        distribution: true,
        privatUse: true,
        patentUse: false
      },
      'BSD-3-Clause': {
        isCompatible: true,
        isOSI: true,
        isFSF: true,
        conflicts: [],
        restrictions: ['No endorsement'],
        commercialUse: true,
        modification: true,
        distribution: true,
        privatUse: true,
        patentUse: false
      },
      'UNLICENSED': {
        isCompatible: false,
        isOSI: false,
        isFSF: false,
        conflicts: [],
        restrictions: ['Proprietary'],
        commercialUse: false,
        modification: false,
        distribution: false,
        privatUse: true,
        patentUse: false
      }
    };

    const normalizedLicense = license.toUpperCase().replace(/[^A-Z0-9\-\.]/g, '');
    const licenseInfo = licenseDatabase[normalizedLicense] || licenseDatabase['UNLICENSED'];

    return {
      license,
      isCompatible: licenseInfo.isCompatible || false,
      isOSI: licenseInfo.isOSI || false,
      isFSF: licenseInfo.isFSF || false,
      conflicts: licenseInfo.conflicts || [],
      restrictions: licenseInfo.restrictions || [],
      commercialUse: licenseInfo.commercialUse || false,
      modification: licenseInfo.modification || false,
      distribution: licenseInfo.distribution || false,
      privatUse: licenseInfo.privatUse || false,
      patentUse: licenseInfo.patentUse || false
    };
  }

  /**
   * Calculate quality metrics for a package
   */
  private calculateQualityMetrics(packageData: any): {
    score: number;
    tests: boolean;
    documentation: boolean;
    changelog: boolean;
    readme: boolean;
    typescript: boolean;
  } {
    let score = 0;
    const metrics = {
      tests: false,
      documentation: false,
      changelog: false,
      readme: false,
      typescript: false
    };

    // Check for test scripts
    if (packageData.scripts?.test && packageData.scripts.test !== 'echo "Error: no test specified" && exit 1') {
      metrics.tests = true;
      score += 20;
    }

    // Check for documentation
    if (packageData.homepage || packageData.repository?.url) {
      metrics.documentation = true;
      score += 20;
    }

    // Check for TypeScript
    if (packageData.types || packageData.typings || packageData.devDependencies?.typescript) {
      metrics.typescript = true;
      score += 20;
    }

    // Check for README (assume it exists if description is present)
    if (packageData.description) {
      metrics.readme = true;
      score += 20;
    }

    // Check for proper versioning (bonus points)
    if (semver.valid(packageData.version)) {
      score += 20;
    }

    return {
      score: Math.min(100, score),
      ...metrics
    };
  }

  /**
   * Get popularity metrics for a package
   */
  private async getPopularityMetrics(packageName: string): Promise<{
    downloads: {
      weekly: number;
      monthly: number;
      yearly: number;
    };
    stars: number;
    forks: number;
    issues: number;
  }> {
    try {
      // Fetch download stats
      const [weeklyRes, monthlyRes, yearlyRes] = await Promise.all([
        axios.get(`https://api.npmjs.org/downloads/point/last-week/${packageName}`),
        axios.get(`https://api.npmjs.org/downloads/point/last-month/${packageName}`),
        axios.get(`https://api.npmjs.org/downloads/point/last-year/${packageName}`)
      ]);

      // Try to get GitHub stats if repository is available
      let stars = 0, forks = 0, issues = 0;
      try {
        const packageRes = await axios.get(`${this.npmRegistry}/${packageName}/latest`);
        const repoUrl = packageRes.data.repository?.url;
        if (repoUrl && repoUrl.includes('github.com')) {
          const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
          if (match) {
            const [, owner, repo] = match;
            const githubRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}`);
            stars = githubRes.data.stargazers_count || 0;
            forks = githubRes.data.forks_count || 0;
            issues = githubRes.data.open_issues_count || 0;
          }
        }
      } catch (error) {
        // GitHub API might fail, continue with zeros
      }

      return {
        downloads: {
          weekly: weeklyRes.data.downloads || 0,
          monthly: monthlyRes.data.downloads || 0,
          yearly: yearlyRes.data.downloads || 0
        },
        stars,
        forks,
        issues
      };
    } catch (error) {
      return {
        downloads: { weekly: 0, monthly: 0, yearly: 0 },
        stars: 0,
        forks: 0,
        issues: 0
      };
    }
  }

  /**
   * Check if a package is a Backstage plugin
   */
  private isBackstagePlugin(packageName: string): boolean {
    return packageName.startsWith('@backstage/plugin-') ||
           packageName.includes('backstage-plugin-') ||
           packageName.endsWith('-backstage-plugin');
  }

  /**
   * Extract Backstage compatibility information
   */
  private extractBackstageCompatibility(packageData: any): Record<string, string> | undefined {
    const compatibility: Record<string, string> = {};

    // Check peer dependencies for Backstage packages
    if (packageData.peerDependencies) {
      for (const [dep, version] of Object.entries(packageData.peerDependencies)) {
        if (dep.startsWith('@backstage/')) {
          compatibility[dep] = version as string;
        }
      }
    }

    return Object.keys(compatibility).length > 0 ? compatibility : undefined;
  }

  /**
   * Calculate compatibility score
   */
  private calculateCompatibilityScore(packageData: any): number {
    let score = 100;

    // Check for Backstage peer dependencies
    const backstageDeps = Object.keys(packageData.peerDependencies || {})
      .filter(dep => dep.startsWith('@backstage/'));
    
    if (backstageDeps.length === 0) {
      score -= 30; // No Backstage dependencies
    }

    // Check for TypeScript support
    if (!packageData.types && !packageData.typings) {
      score -= 20;
    }

    // Check for proper versioning
    if (!semver.valid(packageData.version)) {
      score -= 10;
    }

    // Check for documentation
    if (!packageData.homepage && !packageData.repository) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  /**
   * Normalize package info
   */
  private normalizePackageInfo(data: any): NPMPackageInfo {
    return {
      name: data.name,
      version: data.version,
      description: data.description,
      author: data.author,
      maintainers: data.maintainers,
      repository: data.repository,
      homepage: data.homepage,
      license: data.license,
      keywords: data.keywords,
      dependencies: data.dependencies,
      devDependencies: data.devDependencies,
      peerDependencies: data.peerDependencies,
      publishedAt: data.date,
      downloads: data.downloads?.downloads,
      stars: data.stars,
      issues: data.issues,
      quality: data.score?.detail?.quality,
      popularity: data.score?.detail?.popularity,
      maintenance: data.score?.detail?.maintenance
    };
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const npmRegistryService = new NPMRegistryService();