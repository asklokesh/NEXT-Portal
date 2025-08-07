import { compareVersions, satisfies } from 'compare-versions';

export interface BackstageVersion {
 version: string;
 releaseDate: Date;
 breaking: boolean;
 deprecated?: string[];
 migrations?: VersionMigration[];
}

export interface VersionMigration {
 from: string;
 to: string;
 description: string;
 automatic: boolean;
 migration: () => Promise<void>;
}

export interface CompatibilityReport {
 currentVersion: string;
 targetVersion: string;
 compatible: boolean;
 breakingChanges: string[];
 deprecations: string[];
 requiredMigrations: VersionMigration[];
 recommendations: string[];
}

export interface ApiEndpoint {
 path: string;
 method: string;
 deprecated?: boolean;
 replacedBy?: string;
 addedIn?: string;
 removedIn?: string;
}

export class BackstageVersionManager {
 private static instance: BackstageVersionManager;
 private currentVersion: string = '1.20.0'; // Default version
 private supportedVersions: BackstageVersion[] = [
 {
 version: '1.18.0',
 releaseDate: new Date('2023-09-01'),
 breaking: false,
 },
 {
 version: '1.19.0',
 releaseDate: new Date('2023-10-01'),
 breaking: false,
 },
 {
 version: '1.20.0',
 releaseDate: new Date('2023-11-01'),
 breaking: true,
 deprecated: [
 'POST /api/techdocs/entities/:namespace/:kind/:name/docs',
 'GET /api/catalog/entities/by-name/:kind/:namespace/:name'
 ],
 migrations: [
 {
 from: '1.19.0',
 to: '1.20.0',
 description: 'Update catalog entity API endpoints',
 automatic: true,
 migration: async () => {
 console.log('Migrating catalog endpoints...');
 }
 }
 ]
 },
 {
 version: '1.21.0',
 releaseDate: new Date('2023-12-01'),
 breaking: false,
 },
 {
 version: '1.22.0',
 releaseDate: new Date('2024-01-01'),
 breaking: true,
 deprecated: [
 'GET /api/scaffolder/v1/templates',
 ],
 migrations: [
 {
 from: '1.21.0',
 to: '1.22.0',
 description: 'Update scaffolder API to v2',
 automatic: true,
 migration: async () => {
 console.log('Migrating scaffolder endpoints...');
 }
 }
 ]
 }
 ];

 private apiCompatibilityMap: Record<string, ApiEndpoint[]> = {
 catalog: [
 {
 path: '/api/catalog/entities',
 method: 'GET',
 addedIn: '1.0.0'
 },
 {
 path: '/api/catalog/entities/by-name/:kind/:namespace/:name',
 method: 'GET',
 deprecated: true,
 replacedBy: '/api/catalog/entities/by-uid/:uid',
 removedIn: '1.21.0'
 },
 {
 path: '/api/catalog/entities/by-uid/:uid',
 method: 'GET',
 addedIn: '1.20.0'
 }
 ],
 scaffolder: [
 {
 path: '/api/scaffolder/v1/templates',
 method: 'GET',
 deprecated: true,
 replacedBy: '/api/scaffolder/v2/templates',
 removedIn: '1.23.0'
 },
 {
 path: '/api/scaffolder/v2/templates',
 method: 'GET',
 addedIn: '1.22.0'
 }
 ]
 };

 private constructor() {}

 static getInstance(): BackstageVersionManager {
 if (!BackstageVersionManager.instance) {
 BackstageVersionManager.instance = new BackstageVersionManager();
 }
 return BackstageVersionManager.instance;
 }

 async detectBackstageVersion(): Promise<string> {
 try {
 const response = await fetch('/api/backstage/version');
 if (response.ok) {
 const data = await response.json();
 this.currentVersion = data.version;
 return data.version;
 }
 } catch (error) {
 console.warn('Could not detect Backstage version, using default:', this.currentVersion);
 }
 return this.currentVersion;
 }

 setVersion(version: string): void {
 this.currentVersion = version;
 }

 getVersion(): string {
 return this.currentVersion;
 }

 checkCompatibility(targetVersion: string): CompatibilityReport {
 const report: CompatibilityReport = {
 currentVersion: this.currentVersion,
 targetVersion,
 compatible: true,
 breakingChanges: [],
 deprecations: [],
 requiredMigrations: [],
 recommendations: []
 };

 // Check if versions are compatible
 const comparison = compareVersions(this.currentVersion, targetVersion);
 
 if (comparison === 0) {
 report.recommendations.push('You are already on the target version');
 return report;
 }

 // Find all versions between current and target
 const versionsToCheck = this.supportedVersions.filter(v => {
 if (comparison < 0) {
 // Upgrading
 return compareVersions(v.version, this.currentVersion) > 0 && 
 compareVersions(v.version, targetVersion) <= 0;
 } else {
 // Downgrading
 return compareVersions(v.version, targetVersion) >= 0 && 
 compareVersions(v.version, this.currentVersion) < 0;
 }
 });

 // Check for breaking changes
 versionsToCheck.forEach(version => {
 if (version.breaking) {
 report.compatible = false;
 report.breakingChanges.push(
 `Version ${version.version} contains breaking changes`
 );
 }

 if (version.deprecated) {
 report.deprecations.push(...version.deprecated);
 }

 if (version.migrations) {
 report.requiredMigrations.push(...version.migrations);
 }
 });

 // Add recommendations
 if (report.breakingChanges.length > 0) {
 report.recommendations.push(
 'Review breaking changes before upgrading',
 'Test thoroughly in a staging environment',
 'Backup your data before proceeding'
 );
 }

 if (report.requiredMigrations.length > 0) {
 const autoMigrations = report.requiredMigrations.filter(m => m.automatic);
 const manualMigrations = report.requiredMigrations.filter(m => !m.automatic);
 
 if (autoMigrations.length > 0) {
 report.recommendations.push(
 `${autoMigrations.length} migrations can be applied automatically`
 );
 }
 
 if (manualMigrations.length > 0) {
 report.recommendations.push(
 `${manualMigrations.length} migrations require manual intervention`
 );
 }
 }

 return report;
 }

 getCompatibleApiEndpoint(path: string, method: string): ApiEndpoint | null {
 // Find the API endpoint across all categories
 for (const endpoints of Object.values(this.apiCompatibilityMap)) {
 const endpoint = endpoints.find(e => 
 e.path === path && e.method === method
 );
 
 if (endpoint) {
 // Check if endpoint is available in current version
 if (endpoint.addedIn && compareVersions(this.currentVersion, endpoint.addedIn) < 0) {
 return null; // Not yet available
 }
 
 if (endpoint.removedIn && compareVersions(this.currentVersion, endpoint.removedIn) >= 0) {
 return null; // Already removed
 }
 
 return endpoint;
 }
 }
 
 return null;
 }

 translateApiCall(path: string, method: string): { path: string; method: string; deprecated: boolean } {
 const endpoint = this.getCompatibleApiEndpoint(path, method);
 
 if (!endpoint) {
 // Try to find a replacement
 for (const endpoints of Object.values(this.apiCompatibilityMap)) {
 const deprecated = endpoints.find(e => 
 e.replacedBy && e.path === path && e.method === method
 );
 
 if (deprecated && deprecated.replacedBy) {
 const replacement = endpoints.find(e => 
 e.path === deprecated.replacedBy && e.method === method
 );
 
 if (replacement && this.getCompatibleApiEndpoint(replacement.path, replacement.method)) {
 return {
 path: replacement.path,
 method: replacement.method,
 deprecated: true
 };
 }
 }
 }
 }
 
 return {
 path,
 method,
 deprecated: endpoint?.deprecated || false
 };
 }

 async runMigrations(fromVersion: string, toVersion: string): Promise<void> {
 const report = this.checkCompatibility(toVersion);
 
 if (!report.compatible && !confirm('There are breaking changes. Continue?')) {
 throw new Error('Migration cancelled by user');
 }
 
 for (const migration of report.requiredMigrations) {
 if (migration.automatic) {
 console.log(`Running migration: ${migration.description}`);
 await migration.migration();
 } else {
 console.warn(`Manual migration required: ${migration.description}`);
 }
 }
 
 this.currentVersion = toVersion;
 console.log(`Successfully migrated to version ${toVersion}`);
 }

 getSupportedVersionRange(): { min: string; max: string } {
 const versions = this.supportedVersions.map(v => v.version).sort(compareVersions);
 return {
 min: versions[0],
 max: versions[versions.length - 1]
 };
 }

 isVersionSupported(version: string): boolean {
 const range = this.getSupportedVersionRange();
 return compareVersions(version, range.min) >= 0 && 
 compareVersions(version, range.max) <= 0;
 }
}

export const versionManager = BackstageVersionManager.getInstance();