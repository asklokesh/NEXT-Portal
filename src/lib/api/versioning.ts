import { NextRequest, NextResponse } from 'next/server';

export type APIVersion = 'v1' | 'v2';

export interface VersionedHandler {
 v1?: (request: NextRequest) => Promise<NextResponse>;
 v2?: (request: NextRequest) => Promise<NextResponse>;
}

export const API_VERSIONS = {
 v1: '1.0',
 v2: '2.0',
} as const;

export const CURRENT_VERSION: APIVersion = 'v1';
export const SUPPORTED_VERSIONS: APIVersion[] = ['v1', 'v2'];

/**
 * Extract API version from request
 */
export function getAPIVersion(request: NextRequest): APIVersion {
 // Check header first
 const headerVersion = request.headers.get('X-API-Version');
 if (headerVersion && isValidVersion(headerVersion)) {
 return headerVersion as APIVersion;
 }

 // Check query parameter
 const queryVersion = request.nextUrl.searchParams.get('version');
 if (queryVersion && isValidVersion(queryVersion)) {
 return queryVersion as APIVersion;
 }

 // Check URL path
 const pathMatch = request.nextUrl.pathname.match(/\/api\/(v\d+)\//);
 if (pathMatch && isValidVersion(pathMatch[1])) {
 return pathMatch[1] as APIVersion;
 }

 // Default to current version
 return CURRENT_VERSION;
}

/**
 * Check if version is valid
 */
function isValidVersion(version: string): boolean {
 return SUPPORTED_VERSIONS.includes(version as APIVersion);
}

/**
 * Create versioned API handler
 */
export function versionedHandler(handlers: VersionedHandler) {
 return async (request: NextRequest): Promise<NextResponse> => {
 const version = getAPIVersion(request);
 const handler = handlers[version];

 if (!handler) {
 return NextResponse.json(
 {
 error: 'Unsupported API version',
 message: `Version ${version} is not supported for this endpoint`,
 supported_versions: SUPPORTED_VERSIONS,
 current_version: CURRENT_VERSION,
 },
 { 
 status: 400,
 headers: {
 'X-API-Version': CURRENT_VERSION,
 'X-API-Deprecated': version < CURRENT_VERSION ? 'true' : 'false',
 }
 }
 );
 }

 // Add version headers to response
 const response = await handler(request);
 response.headers.set('X-API-Version', version);
 
 // Add deprecation warning for old versions
 if (version < CURRENT_VERSION) {
 response.headers.set('X-API-Deprecated', 'true');
 response.headers.set('X-API-Sunset-Date', getSunsetDate(version));
 response.headers.set(
 'X-API-Deprecation-Info',
 `This API version is deprecated. Please upgrade to ${CURRENT_VERSION}`
 );
 }

 return response;
 };
}

/**
 * Get sunset date for deprecated version
 */
function getSunsetDate(version: APIVersion): string {
 const sunsetDates: Record<string, string> = {
 v1: '2025-01-01',
 };
 
 return sunsetDates[version] || 'TBD';
}

/**
 * Version-specific response transformers
 */
export const responseTransformers = {
 v1: {
 service: (data: any) => ({
 id: data.id,
 name: data.metadata?.name,
 namespace: data.metadata?.namespace,
 kind: data.kind,
 spec: data.spec,
 // v1 format
 }),
 
 template: (data: any) => ({
 id: data.metadata?.uid,
 name: data.metadata?.name,
 title: data.metadata?.title,
 description: data.metadata?.description,
 // v1 format
 }),
 },
 
 v2: {
 service: (data: any) => ({
 id: data.id,
 metadata: {
 name: data.metadata?.name,
 namespace: data.metadata?.namespace,
 labels: data.metadata?.labels,
 annotations: data.metadata?.annotations,
 },
 kind: data.kind,
 apiVersion: data.apiVersion,
 spec: data.spec,
 status: data.status,
 // v2 format with more details
 }),
 
 template: (data: any) => ({
 id: data.metadata?.uid,
 metadata: {
 name: data.metadata?.name,
 title: data.metadata?.title,
 description: data.metadata?.description,
 tags: data.metadata?.tags,
 },
 spec: data.spec,
 steps: data.spec?.steps,
 parameters: data.spec?.parameters,
 // v2 format with full spec
 }),
 },
};

/**
 * Apply version-specific transformation
 */
export function transformResponse(
 version: APIVersion,
 type: keyof typeof responseTransformers.v1,
 data: any
): any {
 const transformer = responseTransformers[version]?.[type];
 if (!transformer) {
 return data;
 }
 
 if (Array.isArray(data)) {
 return data.map(transformer);
 }
 
 return transformer(data);
}

/**
 * Version migration helpers
 */
export const migrations = {
 v1ToV2: {
 request: (data: any) => {
 // Transform v1 request format to v2
 return {
 ...data,
 // Add v2 specific fields
 apiVersion: 'backstage.io/v1alpha1',
 };
 },
 
 response: (data: any) => {
 // Transform v2 response back to v1 format
 if (data.metadata) {
 return {
 ...data,
 metadata: {
 name: data.metadata.name,
 namespace: data.metadata.namespace,
 },
 };
 }
 return data;
 },
 },
};

/**
 * Deprecated endpoint handler
 */
export function deprecatedEndpoint(
 replacementPath: string,
 sunsetDate: string = '2025-01-01'
) {
 return () => {
 return NextResponse.json(
 {
 error: 'Deprecated endpoint',
 message: 'This endpoint has been deprecated',
 replacement: replacementPath,
 sunset_date: sunsetDate,
 documentation: 'https://docs.backstage-idp.com/api/migration',
 },
 {
 status: 410, // Gone
 headers: {
 'X-API-Deprecated': 'true',
 'X-API-Sunset-Date': sunsetDate,
 'X-API-Replacement': replacementPath,
 },
 }
 );
 };
}

/**
 * Create backwards compatible handler
 */
export function backwardsCompatible<T>(
 newImplementation: (request: NextRequest) => Promise<T>,
 transformer?: (data: T, version: APIVersion) => any
) {
 return async (request: NextRequest): Promise<NextResponse> => {
 const version = getAPIVersion(request);
 
 try {
 const result = await newImplementation(request);
 
 // Apply version-specific transformation if needed
 const transformed = transformer ? transformer(result, version) : result;
 
 return NextResponse.json(transformed, {
 headers: {
 'X-API-Version': version,
 },
 });
 } catch (error: any) {
 return NextResponse.json(
 {
 error: error.message || 'Internal server error',
 code: error.code || 'INTERNAL_ERROR',
 version,
 },
 {
 status: error.statusCode || 500,
 headers: {
 'X-API-Version': version,
 },
 }
 );
 }
 };
}