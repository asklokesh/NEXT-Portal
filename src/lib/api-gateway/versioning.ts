import { z } from 'zod';
import { Redis } from 'ioredis';

export interface APIVersion {
  version: string;
  isDefault: boolean;
  isDeprecated: boolean;
  deprecationDate?: Date;
  sunsetDate?: Date;
  description: string;
  changelog: string[];
  supportedUntil?: Date;
  breakingChanges: boolean;
  backwardCompatible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VersioningStrategy {
  type: 'header' | 'query' | 'path' | 'accept' | 'content-type';
  parameterName?: string; // For header/query strategies
  headerName?: string; // For header strategy
  pathPrefix?: string; // For path strategy
  mediaTypePattern?: string; // For accept/content-type strategies
  defaultVersion: string;
  fallbackBehavior: 'latest' | 'default' | 'error';
}

export interface RouteVersion {
  routeId: string;
  path: string;
  method: string;
  version: string;
  upstreamUrl: string;
  enabled: boolean;
  metadata: {
    description?: string;
    tags?: string[];
    deprecated?: boolean;
    experimental?: boolean;
  };
}

const VersioningConfigSchema = z.object({
  strategy: z.object({
    type: z.enum(['header', 'query', 'path', 'accept', 'content-type']),
    parameterName: z.string().optional(),
    headerName: z.string().optional(),
    pathPrefix: z.string().optional(),
    mediaTypePattern: z.string().optional(),
    defaultVersion: z.string(),
    fallbackBehavior: z.enum(['latest', 'default', 'error']),
  }),
  versions: z.array(z.object({
    version: z.string(),
    isDefault: z.boolean(),
    isDeprecated: z.boolean(),
    deprecationDate: z.string().optional(),
    sunsetDate: z.string().optional(),
    description: z.string(),
    changelog: z.array(z.string()),
    supportedUntil: z.string().optional(),
    breakingChanges: z.boolean(),
    backwardCompatible: z.boolean(),
  })),
});

export class APIVersioningManager {
  private redis: Redis;
  private versions: Map<string, APIVersion> = new Map();
  private routes: Map<string, RouteVersion[]> = new Map();
  private versioningStrategy: VersioningStrategy;

  constructor(redis: Redis, strategy: VersioningStrategy) {
    this.redis = redis;
    this.versioningStrategy = strategy;
  }

  /**
   * Extract version from request
   */
  async extractVersion(request: {
    headers: Record<string, string>;
    query: Record<string, string>;
    path: string;
    method: string;
  }): Promise<{
    version: string;
    source: string;
    isDefault: boolean;
  }> {
    let version: string | undefined;
    let source: string;

    switch (this.versioningStrategy.type) {
      case 'header':
        const headerName = this.versioningStrategy.headerName || 'API-Version';
        version = request.headers[headerName] || request.headers[headerName.toLowerCase()];
        source = 'header';
        break;

      case 'query':
        const paramName = this.versioningStrategy.parameterName || 'version';
        version = request.query[paramName];
        source = 'query';
        break;

      case 'path':
        const pathPrefix = this.versioningStrategy.pathPrefix || '/v';
        const pathMatch = request.path.match(new RegExp(`^${pathPrefix}(\\d+(?:\\.\\d+)?)`));
        if (pathMatch) {
          version = pathMatch[1];
        }
        source = 'path';
        break;

      case 'accept':
        const acceptHeader = request.headers['accept'] || request.headers['Accept'];
        if (acceptHeader && this.versioningStrategy.mediaTypePattern) {
          const regex = new RegExp(this.versioningStrategy.mediaTypePattern);
          const match = acceptHeader.match(regex);
          if (match) {
            version = match[1];
          }
        }
        source = 'accept-header';
        break;

      case 'content-type':
        const contentTypeHeader = request.headers['content-type'] || request.headers['Content-Type'];
        if (contentTypeHeader && this.versioningStrategy.mediaTypePattern) {
          const regex = new RegExp(this.versioningStrategy.mediaTypePattern);
          const match = contentTypeHeader.match(regex);
          if (match) {
            version = match[1];
          }
        }
        source = 'content-type-header';
        break;

      default:
        source = 'default';
    }

    // Handle fallback behavior if no version found
    if (!version) {
      switch (this.versioningStrategy.fallbackBehavior) {
        case 'default':
          version = this.versioningStrategy.defaultVersion;
          break;
        case 'latest':
          version = await this.getLatestVersion();
          break;
        case 'error':
          throw new Error('API version is required but not provided');
      }
      source = 'fallback';
    }

    // Validate version exists
    const versionExists = await this.versionExists(version);
    if (!versionExists) {
      if (this.versioningStrategy.fallbackBehavior === 'error') {
        throw new Error(`Unsupported API version: ${version}`);
      } else {
        version = this.versioningStrategy.defaultVersion;
        source = 'fallback-invalid';
      }
    }

    return {
      version,
      source,
      isDefault: version === this.versioningStrategy.defaultVersion,
    };
  }

  /**
   * Register API version
   */
  async registerVersion(version: APIVersion): Promise<void> {
    await this.redis.hset(
      `api_version:${version.version}`,
      'data',
      JSON.stringify({
        ...version,
        createdAt: version.createdAt.toISOString(),
        updatedAt: version.updatedAt.toISOString(),
        deprecationDate: version.deprecationDate?.toISOString(),
        sunsetDate: version.sunsetDate?.toISOString(),
        supportedUntil: version.supportedUntil?.toISOString(),
      })
    );

    this.versions.set(version.version, version);

    // Update version index
    await this.updateVersionIndex();
  }

  /**
   * Get API version details
   */
  async getVersion(version: string): Promise<APIVersion | null> {
    // Check cache first
    if (this.versions.has(version)) {
      return this.versions.get(version)!;
    }

    // Load from Redis
    const data = await this.redis.hget(`api_version:${version}`, 'data');
    if (!data) return null;

    const versionData = JSON.parse(data);
    const apiVersion: APIVersion = {
      ...versionData,
      createdAt: new Date(versionData.createdAt),
      updatedAt: new Date(versionData.updatedAt),
      deprecationDate: versionData.deprecationDate ? new Date(versionData.deprecationDate) : undefined,
      sunsetDate: versionData.sunsetDate ? new Date(versionData.sunsetDate) : undefined,
      supportedUntil: versionData.supportedUntil ? new Date(versionData.supportedUntil) : undefined,
    };

    this.versions.set(version, apiVersion);
    return apiVersion;
  }

  /**
   * List all available versions
   */
  async listVersions(): Promise<APIVersion[]> {
    const versionKeys = await this.redis.keys('api_version:*');
    const versions: APIVersion[] = [];

    for (const key of versionKeys) {
      const versionId = key.replace('api_version:', '');
      const version = await this.getVersion(versionId);
      if (version) {
        versions.push(version);
      }
    }

    // Sort by version (semantic versioning)
    return versions.sort((a, b) => this.compareVersions(a.version, b.version));
  }

  /**
   * Register versioned route
   */
  async registerRoute(route: RouteVersion): Promise<void> {
    const routeKey = `${route.method}:${route.path}`;
    
    // Get existing routes for this path/method
    const existingRoutes = this.routes.get(routeKey) || [];
    
    // Remove existing route with same version if it exists
    const filteredRoutes = existingRoutes.filter(r => r.version !== route.version);
    filteredRoutes.push(route);
    
    this.routes.set(routeKey, filteredRoutes);

    // Store in Redis
    await this.redis.hset(
      `versioned_route:${routeKey}`,
      route.version,
      JSON.stringify(route)
    );
  }

  /**
   * Find route for specific version
   */
  async findRoute(
    method: string,
    path: string,
    version: string
  ): Promise<RouteVersion | null> {
    const routeKey = `${method}:${path}`;
    
    // Check cache first
    const cachedRoutes = this.routes.get(routeKey);
    if (cachedRoutes) {
      const route = cachedRoutes.find(r => r.version === version && r.enabled);
      if (route) return route;
    }

    // Load from Redis
    const routeData = await this.redis.hget(`versioned_route:${routeKey}`, version);
    if (!routeData) {
      // Try to find closest compatible version
      return this.findCompatibleRoute(method, path, version);
    }

    const route: RouteVersion = JSON.parse(routeData);
    
    // Cache the route
    if (!this.routes.has(routeKey)) {
      this.routes.set(routeKey, []);
    }
    this.routes.get(routeKey)!.push(route);

    return route.enabled ? route : null;
  }

  /**
   * Find compatible route for version (backward compatibility)
   */
  private async findCompatibleRoute(
    method: string,
    path: string,
    requestedVersion: string
  ): Promise<RouteVersion | null> {
    const routeKey = `${method}:${path}`;
    
    // Get all versions for this route
    const allVersions = await this.redis.hgetall(`versioned_route:${routeKey}`);
    const availableVersions = Object.keys(allVersions);
    
    if (availableVersions.length === 0) return null;

    // Sort versions and find the highest version that's less than or equal to requested
    const sortedVersions = availableVersions.sort((a, b) => this.compareVersions(a, b));
    
    for (let i = sortedVersions.length - 1; i >= 0; i--) {
      const version = sortedVersions[i];
      if (this.compareVersions(version, requestedVersion) <= 0) {
        const route: RouteVersion = JSON.parse(allVersions[version]);
        
        // Check if this version is backward compatible
        const versionInfo = await this.getVersion(version);
        if (versionInfo?.backwardCompatible && route.enabled) {
          return route;
        }
      }
    }

    return null;
  }

  /**
   * Check if version is deprecated
   */
  async isDeprecated(version: string): Promise<{
    deprecated: boolean;
    deprecationDate?: Date;
    sunsetDate?: Date;
    message?: string;
  }> {
    const versionInfo = await this.getVersion(version);
    
    if (!versionInfo) {
      return { deprecated: false };
    }

    if (!versionInfo.isDeprecated) {
      return { deprecated: false };
    }

    return {
      deprecated: true,
      deprecationDate: versionInfo.deprecationDate,
      sunsetDate: versionInfo.sunsetDate,
      message: `API version ${version} is deprecated. ${
        versionInfo.sunsetDate 
          ? `It will be sunset on ${versionInfo.sunsetDate.toISOString().split('T')[0]}.`
          : ''
      }`,
    };
  }

  /**
   * Generate version compatibility matrix
   */
  async getCompatibilityMatrix(): Promise<{
    versions: string[];
    compatibility: Record<string, string[]>;
  }> {
    const allVersions = await this.listVersions();
    const versions = allVersions.map(v => v.version);
    const compatibility: Record<string, string[]> = {};

    for (const version of versions) {
      const versionInfo = await this.getVersion(version.version);
      if (versionInfo?.backwardCompatible) {
        // Find all versions this one is compatible with
        const compatibleVersions = versions.filter(v => 
          this.compareVersions(v, version.version) <= 0
        );
        compatibility[version.version] = compatibleVersions;
      } else {
        compatibility[version.version] = [version.version];
      }
    }

    return { versions, compatibility };
  }

  /**
   * Create migration plan between versions
   */
  async createMigrationPlan(fromVersion: string, toVersion: string): Promise<{
    feasible: boolean;
    steps: string[];
    breakingChanges: string[];
    warnings: string[];
  }> {
    const from = await this.getVersion(fromVersion);
    const to = await this.getVersion(toVersion);

    if (!from || !to) {
      return {
        feasible: false,
        steps: [],
        breakingChanges: ['One or both versions not found'],
        warnings: [],
      };
    }

    const comparison = this.compareVersions(fromVersion, toVersion);
    const steps: string[] = [];
    const breakingChanges: string[] = [];
    const warnings: string[] = [];

    if (comparison === 0) {
      return {
        feasible: true,
        steps: ['No migration needed - versions are identical'],
        breakingChanges: [],
        warnings: [],
      };
    }

    if (comparison > 0) {
      warnings.push('Downgrading to an older version may not be supported');
    }

    // Add migration steps based on changelog
    if (to.changelog.length > 0) {
      steps.push(...to.changelog.map(change => `• ${change}`));
    }

    if (to.breakingChanges) {
      breakingChanges.push('This migration includes breaking changes');
    }

    if (from.isDeprecated) {
      warnings.push(`Source version ${fromVersion} is deprecated`);
    }

    if (to.isDeprecated) {
      warnings.push(`Target version ${toVersion} is deprecated`);
    }

    return {
      feasible: true,
      steps,
      breakingChanges,
      warnings,
    };
  }

  /**
   * Check if version exists
   */
  private async versionExists(version: string): Promise<boolean> {
    const exists = await this.redis.hexists(`api_version:${version}`, 'data');
    return exists === 1;
  }

  /**
   * Get latest version
   */
  private async getLatestVersion(): Promise<string> {
    const versions = await this.listVersions();
    if (versions.length === 0) {
      return this.versioningStrategy.defaultVersion;
    }

    // Return the highest version that's not deprecated
    const activeVersions = versions.filter(v => !v.isDeprecated);
    if (activeVersions.length === 0) {
      return versions[versions.length - 1].version; // Return latest even if deprecated
    }

    return activeVersions[activeVersions.length - 1].version;
  }

  /**
   * Update version index for faster lookups
   */
  private async updateVersionIndex(): Promise<void> {
    const versions = Array.from(this.versions.keys());
    await this.redis.sadd('api_versions_index', ...versions);
  }

  /**
   * Compare two semantic versions
   * Returns: -1 if a < b, 0 if a === b, 1 if a > b
   */
  private compareVersions(a: string, b: string): number {
    const parseVersion = (version: string) => {
      const parts = version.split('.').map(part => {
        const num = parseInt(part, 10);
        return isNaN(num) ? 0 : num;
      });
      while (parts.length < 3) parts.push(0);
      return parts;
    };

    const [aMajor, aMinor, aPatch] = parseVersion(a);
    const [bMajor, bMinor, bPatch] = parseVersion(b);

    if (aMajor !== bMajor) return aMajor - bMajor;
    if (aMinor !== bMinor) return aMinor - bMinor;
    return aPatch - bPatch;
  }
}

/**
 * Content negotiation for different API versions
 */
export class ContentNegotiator {
  /**
   * Negotiate content type based on Accept header and API version
   */
  negotiateContentType(
    acceptHeader: string,
    version: string,
    availableTypes: string[]
  ): {
    contentType: string;
    quality: number;
  } | null {
    if (!acceptHeader) {
      return { contentType: availableTypes[0] || 'application/json', quality: 1.0 };
    }

    const acceptedTypes = this.parseAcceptHeader(acceptHeader);
    
    for (const accepted of acceptedTypes) {
      for (const available of availableTypes) {
        if (this.mediaTypeMatches(accepted.type, available)) {
          return {
            contentType: available,
            quality: accepted.quality,
          };
        }
      }
    }

    return null;
  }

  /**
   * Parse Accept header into structured format
   */
  private parseAcceptHeader(acceptHeader: string): Array<{
    type: string;
    quality: number;
    params: Record<string, string>;
  }> {
    return acceptHeader
      .split(',')
      .map(type => {
        const [mediaType, ...params] = type.trim().split(';');
        const parsedParams: Record<string, string> = {};
        let quality = 1.0;

        for (const param of params) {
          const [key, value] = param.trim().split('=');
          if (key === 'q') {
            quality = parseFloat(value) || 1.0;
          } else {
            parsedParams[key] = value;
          }
        }

        return {
          type: mediaType.trim(),
          quality,
          params: parsedParams,
        };
      })
      .sort((a, b) => b.quality - a.quality);
  }

  /**
   * Check if media types match
   */
  private mediaTypeMatches(pattern: string, contentType: string): boolean {
    if (pattern === '*/*') return true;
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      return contentType.startsWith(prefix);
    }
    return pattern === contentType;
  }
}