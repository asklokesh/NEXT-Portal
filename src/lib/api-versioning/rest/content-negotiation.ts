/**
 * REST API Content Negotiation Engine
 * 
 * Advanced content negotiation for REST API versioning with media type versioning,
 * header-based versioning, and automatic format transformation
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  VERSION_HEADERS, 
  VERSION_QUERY_PARAMS, 
  MEDIA_TYPES,
  VERSION_STATUS 
} from '../constants';

export interface VersionRequest {
  version: string;
  format: 'json' | 'xml' | 'yaml' | 'protobuf';
  acceptableVersions: string[];
  clientId?: string;
  preview?: boolean;
}

export interface VersionedResponse {
  version: string;
  data: any;
  headers: Record<string, string>;
  format: string;
  metadata: ResponseMetadata;
}

export interface ResponseMetadata {
  deprecation?: DeprecationInfo;
  sunset?: SunsetInfo;
  migration?: MigrationInfo;
  alternatives?: AlternativeInfo[];
}

export interface DeprecationInfo {
  version: string;
  date: Date;
  reason: string;
  replacement?: string;
}

export interface SunsetInfo {
  version: string;
  date: Date;
  reason: string;
  migration: string;
}

export interface MigrationInfo {
  available: boolean;
  version: string;
  url: string;
  automated: boolean;
}

export interface AlternativeInfo {
  version: string;
  url: string;
  description: string;
}

export interface ContentNegotiationConfig {
  defaultVersion: string;
  supportedVersions: string[];
  deprecatedVersions: Record<string, DeprecationInfo>;
  sunsetVersions: Record<string, SunsetInfo>;
  versionAliases: Record<string, string>;
  formatTransformers: Record<string, FormatTransformer>;
  compatibilityMatrix: Record<string, string[]>;
}

export interface FormatTransformer {
  transform: (data: any, version: string) => Promise<any>;
  contentType: string;
}

export class ContentNegotiationEngine {
  private config: ContentNegotiationConfig;
  private versionCache = new Map<string, any>();

  constructor(config: ContentNegotiationConfig) {
    this.config = config;
  }

  /**
   * Negotiate version and format from request
   */
  negotiateVersion(request: NextRequest): VersionRequest {
    const version = this.extractVersion(request);
    const format = this.extractFormat(request);
    const acceptableVersions = this.extractAcceptableVersions(request);
    const clientId = this.extractClientId(request);
    const preview = this.extractPreviewFlag(request);

    // Resolve version aliases
    const resolvedVersion = this.config.versionAliases[version] || version;

    // Validate version support
    if (!this.isVersionSupported(resolvedVersion)) {
      throw new Error(`Version ${resolvedVersion} is not supported`);
    }

    return {
      version: resolvedVersion,
      format,
      acceptableVersions,
      clientId,
      preview
    };
  }

  /**
   * Create versioned response with appropriate headers
   */
  async createVersionedResponse(
    data: any,
    versionRequest: VersionRequest,
    endpoint: string
  ): Promise<VersionedResponse> {
    const { version, format, clientId } = versionRequest;

    // Transform data to requested version format
    const transformedData = await this.transformDataToVersion(data, version, endpoint);

    // Apply format transformation
    const formattedData = await this.applyFormatTransformation(transformedData, format, version);

    // Generate response headers
    const headers = this.generateResponseHeaders(version, format, endpoint);

    // Generate metadata
    const metadata = this.generateResponseMetadata(version, endpoint);

    return {
      version,
      data: formattedData,
      headers,
      format,
      metadata
    };
  }

  /**
   * Transform data between API versions
   */
  async transformDataToVersion(data: any, targetVersion: string, endpoint: string): Promise<any> {
    const transformer = this.getVersionTransformer(targetVersion, endpoint);
    
    if (!transformer) {
      return data;
    }

    return await transformer.transform(data, targetVersion);
  }

  /**
   * Generate appropriate HTTP response with versioning headers
   */
  createHttpResponse(versionedResponse: VersionedResponse, status = 200): NextResponse {
    const response = NextResponse.json(versionedResponse.data, { status });

    // Add versioning headers
    Object.entries(versionedResponse.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Add metadata headers
    if (versionedResponse.metadata.deprecation) {
      response.headers.set(
        VERSION_HEADERS.DEPRECATED,
        `true; date="${versionedResponse.metadata.deprecation.date.toISOString()}"`
      );
    }

    if (versionedResponse.metadata.sunset) {
      response.headers.set(
        VERSION_HEADERS.SUNSET,
        versionedResponse.metadata.sunset.date.toISOString()
      );
    }

    if (versionedResponse.metadata.migration?.available) {
      response.headers.set(
        VERSION_HEADERS.MIGRATION,
        versionedResponse.metadata.migration.url
      );
    }

    // Add CORS headers for version negotiation
    response.headers.set('Access-Control-Expose-Headers', 
      Object.values(VERSION_HEADERS).join(', ')
    );

    return response;
  }

  /**
   * Handle version upgrade requests
   */
  async handleVersionUpgrade(
    fromVersion: string,
    toVersion: string,
    data: any,
    endpoint: string
  ): Promise<VersionedResponse> {
    // Validate upgrade path
    if (!this.isUpgradeSupported(fromVersion, toVersion)) {
      throw new Error(`Upgrade from ${fromVersion} to ${toVersion} is not supported`);
    }

    // Apply incremental transformations
    const transformedData = await this.applyIncrementalUpgrade(data, fromVersion, toVersion, endpoint);

    // Create versioned response
    return this.createVersionedResponse(
      transformedData,
      { version: toVersion, format: 'json', acceptableVersions: [toVersion] },
      endpoint
    );
  }

  /**
   * Extract version from request using multiple strategies
   */
  private extractVersion(request: NextRequest): string {
    // 1. Check version header
    const headerVersion = request.headers.get(VERSION_HEADERS.VERSION) ||
                         request.headers.get(VERSION_HEADERS.ACCEPT_VERSION);
    if (headerVersion) {
      return headerVersion;
    }

    // 2. Check query parameter
    const queryVersion = request.nextUrl.searchParams.get(VERSION_QUERY_PARAMS.VERSION);
    if (queryVersion) {
      return queryVersion;
    }

    // 3. Check Accept header media type versioning
    const acceptHeader = request.headers.get('accept') || '';
    const mediaTypeVersion = this.extractVersionFromMediaType(acceptHeader);
    if (mediaTypeVersion) {
      return mediaTypeVersion;
    }

    // 4. Check URL path versioning
    const pathVersion = this.extractVersionFromPath(request.nextUrl.pathname);
    if (pathVersion) {
      return pathVersion;
    }

    // 5. Use default version
    return this.config.defaultVersion;
  }

  /**
   * Extract format from request
   */
  private extractFormat(request: NextRequest): 'json' | 'xml' | 'yaml' | 'protobuf' {
    // Check query parameter
    const queryFormat = request.nextUrl.searchParams.get(VERSION_QUERY_PARAMS.FORMAT) as any;
    if (queryFormat && ['json', 'xml', 'yaml', 'protobuf'].includes(queryFormat)) {
      return queryFormat;
    }

    // Check Accept header
    const acceptHeader = request.headers.get('accept') || '';
    
    if (acceptHeader.includes('application/xml')) return 'xml';
    if (acceptHeader.includes('application/yaml') || acceptHeader.includes('text/yaml')) return 'yaml';
    if (acceptHeader.includes('application/x-protobuf')) return 'protobuf';
    
    return 'json'; // default
  }

  /**
   * Extract acceptable versions from Accept header
   */
  private extractAcceptableVersions(request: NextRequest): string[] {
    const acceptVersionHeader = request.headers.get(VERSION_HEADERS.ACCEPT_VERSION);
    if (!acceptVersionHeader) {
      return this.config.supportedVersions;
    }

    return acceptVersionHeader
      .split(',')
      .map(v => v.trim())
      .filter(v => this.isVersionSupported(v));
  }

  /**
   * Extract client ID from request
   */
  private extractClientId(request: NextRequest): string | undefined {
    return request.headers.get('x-client-id') || 
           request.headers.get('user-agent') ||
           undefined;
  }

  /**
   * Extract preview flag
   */
  private extractPreviewFlag(request: NextRequest): boolean {
    return request.nextUrl.searchParams.get(VERSION_QUERY_PARAMS.PREVIEW) === 'true' ||
           request.headers.get('x-preview') === 'true';
  }

  /**
   * Extract version from media type
   */
  private extractVersionFromMediaType(acceptHeader: string): string | null {
    const mediaTypeMatch = acceptHeader.match(/application\/vnd\.api\+json;version=([^,\s]+)/);
    return mediaTypeMatch ? mediaTypeMatch[1] : null;
  }

  /**
   * Extract version from URL path
   */
  private extractVersionFromPath(pathname: string): string | null {
    const pathMatch = pathname.match(/\/api\/v(\d+(?:\.\d+)*)\//);
    return pathMatch ? pathMatch[1] : null;
  }

  /**
   * Check if version is supported
   */
  private isVersionSupported(version: string): boolean {
    return this.config.supportedVersions.includes(version) ||
           Object.keys(this.config.versionAliases).includes(version);
  }

  /**
   * Generate response headers
   */
  private generateResponseHeaders(version: string, format: string, endpoint: string): Record<string, string> {
    const headers: Record<string, string> = {};

    headers[VERSION_HEADERS.VERSION] = version;
    headers[VERSION_HEADERS.CONTENT_VERSION] = version;
    headers['Content-Type'] = this.getContentType(format, version);

    // Add compatibility information
    const compatibleVersions = this.config.compatibilityMatrix[version] || [];
    if (compatibleVersions.length > 0) {
      headers[VERSION_HEADERS.COMPATIBILITY] = compatibleVersions.join(', ');
    }

    return headers;
  }

  /**
   * Generate response metadata
   */
  private generateResponseMetadata(version: string, endpoint: string): ResponseMetadata {
    const metadata: ResponseMetadata = {};

    // Check for deprecation
    const deprecation = this.config.deprecatedVersions[version];
    if (deprecation) {
      metadata.deprecation = deprecation;
    }

    // Check for sunset
    const sunset = this.config.sunsetVersions[version];
    if (sunset) {
      metadata.sunset = sunset;
    }

    // Add migration information
    const latestVersion = this.getLatestVersion();
    if (version !== latestVersion) {
      metadata.migration = {
        available: true,
        version: latestVersion,
        url: `/api/migrate/${version}/${latestVersion}`,
        automated: this.isAutomaticMigrationAvailable(version, latestVersion)
      };
    }

    // Add alternatives
    metadata.alternatives = this.getAlternativeVersions(version, endpoint);

    return metadata;
  }

  /**
   * Get content type for format and version
   */
  private getContentType(format: string, version: string): string {
    const formatMap = {
      json: `application/vnd.api+json;version=${version}`,
      xml: `application/vnd.api+xml;version=${version}`,
      yaml: `application/vnd.api+yaml;version=${version}`,
      protobuf: `application/vnd.api+protobuf;version=${version}`
    };

    return formatMap[format] || formatMap.json;
  }

  /**
   * Apply format transformation
   */
  private async applyFormatTransformation(data: any, format: string, version: string): Promise<any> {
    const transformer = this.config.formatTransformers[format];
    
    if (!transformer) {
      return data; // Return as-is if no transformer
    }

    return await transformer.transform(data, version);
  }

  /**
   * Get version transformer
   */
  private getVersionTransformer(version: string, endpoint: string): FormatTransformer | null {
    const cacheKey = `${version}:${endpoint}`;
    
    if (this.versionCache.has(cacheKey)) {
      return this.versionCache.get(cacheKey);
    }

    // Mock transformer - in reality this would load from a registry
    const transformer = {
      transform: async (data: any, targetVersion: string) => {
        // Apply version-specific transformations
        return this.applyVersionSpecificTransformations(data, targetVersion, endpoint);
      },
      contentType: 'application/json'
    };

    this.versionCache.set(cacheKey, transformer);
    return transformer;
  }

  /**
   * Apply version-specific data transformations
   */
  private async applyVersionSpecificTransformations(data: any, version: string, endpoint: string): Promise<any> {
    // Mock implementation - would contain actual transformation logic
    const transformedData = { ...data };

    // Example: Add version-specific fields
    if (version.startsWith('2.')) {
      transformedData._version = '2.x';
      transformedData._links = {
        self: { href: `${endpoint}?version=${version}` }
      };
    }

    // Example: Remove deprecated fields for newer versions
    if (version.startsWith('3.')) {
      delete transformedData.legacy_field;
      transformedData._metadata = {
        version,
        generated: new Date().toISOString()
      };
    }

    return transformedData;
  }

  /**
   * Check if upgrade is supported
   */
  private isUpgradeSupported(fromVersion: string, toVersion: string): boolean {
    const compatibleVersions = this.config.compatibilityMatrix[fromVersion] || [];
    return compatibleVersions.includes(toVersion);
  }

  /**
   * Apply incremental upgrade transformations
   */
  private async applyIncrementalUpgrade(
    data: any,
    fromVersion: string,
    toVersion: string,
    endpoint: string
  ): Promise<any> {
    // Get all intermediate versions
    const intermediateVersions = this.getIntermediateVersions(fromVersion, toVersion);
    
    let currentData = data;
    let currentVersion = fromVersion;

    // Apply transformations step by step
    for (const nextVersion of intermediateVersions.concat([toVersion])) {
      currentData = await this.transformDataToVersion(currentData, nextVersion, endpoint);
      currentVersion = nextVersion;
    }

    return currentData;
  }

  /**
   * Get intermediate versions for upgrade path
   */
  private getIntermediateVersions(fromVersion: string, toVersion: string): string[] {
    // Mock implementation - would calculate actual upgrade path
    return [];
  }

  /**
   * Get latest supported version
   */
  private getLatestVersion(): string {
    return this.config.supportedVersions[this.config.supportedVersions.length - 1];
  }

  /**
   * Check if automatic migration is available
   */
  private isAutomaticMigrationAvailable(fromVersion: string, toVersion: string): boolean {
    // Mock implementation - would check migration capabilities
    return true;
  }

  /**
   * Get alternative versions for an endpoint
   */
  private getAlternativeVersions(version: string, endpoint: string): AlternativeInfo[] {
    return this.config.supportedVersions
      .filter(v => v !== version)
      .map(v => ({
        version: v,
        url: `${endpoint}?version=${v}`,
        description: `API version ${v}`
      }));
  }
}

export default ContentNegotiationEngine;