import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { BackstageVersionCompatibility } from '@/services/compatibility/backstage-version';
import { PluginCompatibilityChecker } from '@/services/compatibility/plugin-checker';
import { APIVersionManager } from '@/services/compatibility/api-version-manager';
import { SchemaValidator } from '@/services/compatibility/schema-validator';

// Backstage version test matrix
const BACKSTAGE_VERSIONS = [
  {
    version: '1.40.0',
    apiVersion: '1.40',
    features: ['catalog-v2', 'scaffolder-v3', 'techdocs-v2'],
    deprecatedFeatures: ['catalog-v1-legacy'],
    breaking: false,
    lts: false
  },
  {
    version: '1.39.0',
    apiVersion: '1.39',
    features: ['catalog-v2', 'scaffolder-v3', 'techdocs-v2'],
    deprecatedFeatures: ['catalog-v1-legacy', 'old-auth-system'],
    breaking: false,
    lts: true // Long-term support
  },
  {
    version: '1.35.0',
    apiVersion: '1.35',
    features: ['catalog-v1', 'scaffolder-v2', 'techdocs-v1'],
    deprecatedFeatures: [],
    breaking: false,
    lts: true
  },
  {
    version: '1.30.0',
    apiVersion: '1.30',
    features: ['catalog-v1', 'scaffolder-v2'],
    deprecatedFeatures: ['legacy-plugin-system'],
    breaking: true, // Major breaking changes
    lts: false
  }
];

const TEST_PLUGINS = {
  'modern-plugin': {
    id: '@backstage/plugin-modern-test',
    backstageVersion: '^1.39.0',
    apiDependencies: {
      '@backstage/core-plugin-api': '^1.9.0',
      '@backstage/catalog-model': '^1.7.0'
    },
    features: ['catalog-v2', 'scaffolder-v3'],
    schema: {
      version: '1.0',
      apiVersion: 'v1',
      kind: 'Component'
    }
  },
  'legacy-plugin': {
    id: '@backstage/plugin-legacy-test',
    backstageVersion: '^1.30.0',
    apiDependencies: {
      '@backstage/core-plugin-api': '^1.5.0',
      '@backstage/catalog-model': '^1.3.0'
    },
    features: ['catalog-v1', 'scaffolder-v2'],
    schema: {
      version: '0.9',
      apiVersion: 'v1beta1',
      kind: 'Component'
    }
  },
  'cutting-edge-plugin': {
    id: '@backstage/plugin-cutting-edge',
    backstageVersion: '^1.40.0',
    apiDependencies: {
      '@backstage/core-plugin-api': '^1.10.0',
      '@backstage/catalog-model': '^1.8.0'
    },
    features: ['catalog-v2', 'scaffolder-v3', 'new-experimental-api'],
    schema: {
      version: '2.0',
      apiVersion: 'v2alpha1',
      kind: 'Component'
    }
  },
  'flexible-plugin': {
    id: '@backstage/plugin-flexible',
    backstageVersion: '>=1.35.0',
    apiDependencies: {
      '@backstage/core-plugin-api': '>=1.7.0',
      '@backstage/catalog-model': '>=1.5.0'
    },
    features: ['catalog-v1', 'catalog-v2'], // Supports both
    schema: {
      version: '1.5',
      apiVersion: 'v1',
      kind: 'Component'
    }
  }
};

// Mock implementations
jest.mock('@/services/compatibility/backstage-version');
jest.mock('@/services/compatibility/plugin-checker');
jest.mock('@/services/compatibility/api-version-manager');
jest.mock('@/services/compatibility/schema-validator');

describe('Backstage Version Compatibility Testing', () => {
  let versionCompatibility: jest.Mocked<BackstageVersionCompatibility>;
  let pluginChecker: jest.Mocked<PluginCompatibilityChecker>;
  let apiVersionManager: jest.Mocked<APIVersionManager>;
  let schemaValidator: jest.Mocked<SchemaValidator>;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.BACKSTAGE_VERSION_CHECK = 'strict';
  });

  beforeEach(() => {
    jest.clearAllMocks();

    versionCompatibility = new BackstageVersionCompatibility() as jest.Mocked<BackstageVersionCompatibility>;
    pluginChecker = new PluginCompatibilityChecker() as jest.Mocked<PluginCompatibilityChecker>;
    apiVersionManager = new APIVersionManager() as jest.Mocked<APIVersionManager>;
    schemaValidator = new SchemaValidator() as jest.Mocked<SchemaValidator>;

    setupVersionCompatibilityMocks();
    setupPluginCheckerMocks();
    setupAPIVersionManagerMocks();
    setupSchemaValidatorMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    delete process.env.NODE_ENV;
    delete process.env.BACKSTAGE_VERSION_CHECK;
  });

  function setupVersionCompatibilityMocks() {
    versionCompatibility.getCurrentVersion.mockReturnValue('1.39.0');
    
    versionCompatibility.checkCompatibility.mockImplementation(async (pluginVersion, backstageVersion) => {
      const plugin = Object.values(TEST_PLUGINS).find(p => p.backstageVersion === pluginVersion);
      const version = BACKSTAGE_VERSIONS.find(v => v.version === backstageVersion);
      
      if (!plugin || !version) {
        return {
          compatible: false,
          reason: 'Unknown version',
          recommendations: []
        };
      }

      // Simple compatibility logic
      const compatible = plugin.features.some(feature => version.features.includes(feature));
      
      return {
        compatible,
        reason: compatible ? 'Compatible' : 'Feature mismatch',
        warnings: plugin.features.filter(f => version.deprecatedFeatures.includes(f)),
        recommendations: compatible ? [] : ['Update plugin version', 'Check API compatibility']
      };
    });
  }

  function setupPluginCheckerMocks() {
    pluginChecker.validatePlugin.mockImplementation(async (plugin, targetVersion) => {
      const backstageVersion = BACKSTAGE_VERSIONS.find(v => v.version === targetVersion);
      
      if (!backstageVersion) {
        return {
          valid: false,
          errors: ['Unknown Backstage version'],
          warnings: []
        };
      }

      const errors: string[] = [];
      const warnings: string[] = [];

      // Check feature compatibility
      plugin.features.forEach(feature => {
        if (!backstageVersion.features.includes(feature)) {
          errors.push(`Feature '${feature}' not supported in Backstage ${targetVersion}`);
        }
        if (backstageVersion.deprecatedFeatures.includes(feature)) {
          warnings.push(`Feature '${feature}' is deprecated in Backstage ${targetVersion}`);
        }
      });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        compatibility: {
          breaking: backstageVersion.breaking && errors.length > 0,
          deprecated: warnings.length > 0
        }
      };
    });
  }

  function setupAPIVersionManagerMocks() {
    apiVersionManager.checkAPICompatibility.mockImplementation(async (apiDeps, backstageVersion) => {
      const version = BACKSTAGE_VERSIONS.find(v => v.version === backstageVersion);
      
      if (!version) {
        return {
          compatible: false,
          incompatibleAPIs: Object.keys(apiDeps),
          missingAPIs: [],
          recommendations: ['Update to supported Backstage version']
        };
      }

      // Mock API compatibility based on version
      const incompatibleAPIs: string[] = [];
      const missingAPIs: string[] = [];

      Object.entries(apiDeps).forEach(([api, requiredVersion]) => {
        // Simplified version check
        const versionNumber = parseFloat(version.apiVersion);
        const requiredNumber = parseFloat(requiredVersion.replace(/[^\d.]/g, ''));
        
        if (requiredNumber > versionNumber + 0.5) {
          incompatibleAPIs.push(api);
        }
        
        if (requiredNumber > versionNumber + 1.0) {
          missingAPIs.push(api);
        }
      });

      return {
        compatible: incompatibleAPIs.length === 0 && missingAPIs.length === 0,
        incompatibleAPIs,
        missingAPIs,
        recommendations: incompatibleAPIs.length > 0 ? ['Update API dependencies'] : []
      };
    });
  }

  function setupSchemaValidatorMocks() {
    schemaValidator.validateSchema.mockImplementation(async (pluginSchema, backstageVersion) => {
      const version = BACKSTAGE_VERSIONS.find(v => v.version === backstageVersion);
      
      if (!version) {
        return {
          valid: false,
          errors: ['Unknown Backstage version for schema validation'],
          schemaVersion: pluginSchema.version
        };
      }

      const errors: string[] = [];
      
      // Version-specific schema validation
      if (version.version >= '1.35.0' && pluginSchema.apiVersion.includes('beta')) {
        errors.push('Beta API versions not supported in stable releases');
      }
      
      if (version.version >= '1.40.0' && parseFloat(pluginSchema.version) < 1.0) {
        errors.push('Schema version must be >= 1.0 for Backstage 1.40+');
      }

      return {
        valid: errors.length === 0,
        errors,
        schemaVersion: pluginSchema.version,
        supportedVersions: version.features.includes('catalog-v2') ? ['1.0', '2.0'] : ['0.9', '1.0']
      };
    });
  }

  describe('Version Compatibility Matrix', () => {
    it('should validate modern plugin with current Backstage version', async () => {
      const plugin = TEST_PLUGINS['modern-plugin'];
      const result = await versionCompatibility.checkCompatibility(
        plugin.backstageVersion,
        '1.39.0'
      );

      expect(result.compatible).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(result.recommendations).toEqual([]);
    });

    it('should detect incompatibility with legacy plugin on modern Backstage', async () => {
      const plugin = TEST_PLUGINS['legacy-plugin'];
      const result = await pluginChecker.validatePlugin(plugin, '1.40.0');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Feature 'scaffolder-v2' not supported in Backstage 1.40.0");
    });

    it('should handle cutting-edge plugin with older Backstage', async () => {
      const plugin = TEST_PLUGINS['cutting-edge-plugin'];
      const result = await pluginChecker.validatePlugin(plugin, '1.35.0');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.compatibility?.breaking).toBe(true);
    });

    it('should validate flexible plugin across multiple versions', async () => {
      const plugin = TEST_PLUGINS['flexible-plugin'];
      
      const testVersions = ['1.35.0', '1.39.0', '1.40.0'];
      
      for (const version of testVersions) {
        const result = await pluginChecker.validatePlugin(plugin, version);
        expect(result.valid).toBe(true);
      }
    });

    it('should generate compatibility matrix for all plugins', async () => {
      const compatibilityMatrix: Record<string, Record<string, boolean>> = {};
      
      for (const [pluginName, plugin] of Object.entries(TEST_PLUGINS)) {
        compatibilityMatrix[pluginName] = {};
        
        for (const version of BACKSTAGE_VERSIONS) {
          const result = await pluginChecker.validatePlugin(plugin, version.version);
          compatibilityMatrix[pluginName][version.version] = result.valid;
        }
      }

      // Verify expected compatibility patterns
      expect(compatibilityMatrix['modern-plugin']['1.39.0']).toBe(true);
      expect(compatibilityMatrix['legacy-plugin']['1.40.0']).toBe(false);
      expect(compatibilityMatrix['flexible-plugin']['1.35.0']).toBe(true);
      expect(compatibilityMatrix['flexible-plugin']['1.40.0']).toBe(true);
    });
  });

  describe('API Version Compatibility', () => {
    it('should validate API dependencies for modern plugin', async () => {
      const plugin = TEST_PLUGINS['modern-plugin'];
      const result = await apiVersionManager.checkAPICompatibility(
        plugin.apiDependencies,
        '1.39.0'
      );

      expect(result.compatible).toBe(true);
      expect(result.incompatibleAPIs).toEqual([]);
      expect(result.missingAPIs).toEqual([]);
    });

    it('should detect incompatible API versions', async () => {
      const plugin = TEST_PLUGINS['cutting-edge-plugin'];
      const result = await apiVersionManager.checkAPICompatibility(
        plugin.apiDependencies,
        '1.35.0'
      );

      expect(result.compatible).toBe(false);
      expect(result.incompatibleAPIs.length).toBeGreaterThan(0);
      expect(result.recommendations).toContain('Update API dependencies');
    });

    it('should identify missing APIs', async () => {
      const futurePlugin = {
        '@backstage/future-api': '^2.0.0',
        '@backstage/experimental-api': '^1.0.0'
      };

      const result = await apiVersionManager.checkAPICompatibility(
        futurePlugin,
        '1.39.0'
      );

      expect(result.compatible).toBe(false);
      expect(result.missingAPIs.length).toBeGreaterThan(0);
    });

    it('should handle API deprecation warnings', async () => {
      // Mock deprecated API detection
      apiVersionManager.checkAPICompatibility.mockResolvedValueOnce({
        compatible: true,
        incompatibleAPIs: [],
        missingAPIs: [],
        deprecatedAPIs: ['@backstage/legacy-api'],
        recommendations: ['Migrate from deprecated APIs'],
        warnings: ['@backstage/legacy-api will be removed in v1.41.0']
      });

      const legacyDeps = {
        '@backstage/core-plugin-api': '^1.7.0',
        '@backstage/legacy-api': '^1.0.0'
      };

      const result = await apiVersionManager.checkAPICompatibility(legacyDeps, '1.39.0');

      expect(result.compatible).toBe(true);
      expect(result.deprecatedAPIs).toContain('@backstage/legacy-api');
      expect(result.warnings).toContain('@backstage/legacy-api will be removed in v1.41.0');
    });
  });

  describe('Schema Validation Across Versions', () => {
    it('should validate schema for modern Backstage version', async () => {
      const plugin = TEST_PLUGINS['modern-plugin'];
      const result = await schemaValidator.validateSchema(plugin.schema, '1.39.0');

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.supportedVersions).toContain('1.0');
    });

    it('should reject beta schemas in stable Backstage', async () => {
      const plugin = TEST_PLUGINS['cutting-edge-plugin']; // Has v2alpha1 schema
      const result = await schemaValidator.validateSchema(plugin.schema, '1.40.0');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Beta API versions not supported in stable releases');
    });

    it('should enforce schema version requirements', async () => {
      const legacySchema = {
        version: '0.5',
        apiVersion: 'v1',
        kind: 'Component'
      };

      const result = await schemaValidator.validateSchema(legacySchema, '1.40.0');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Schema version must be >= 1.0 for Backstage 1.40+');
    });

    it('should support schema evolution', async () => {
      schemaValidator.migrateSchema = jest.fn().mockResolvedValue({
        migrated: true,
        fromVersion: '0.9',
        toVersion: '1.0',
        changes: [
          'Updated apiVersion from v1beta1 to v1',
          'Added required metadata.namespace field'
        ],
        warnings: ['Some deprecated fields were removed']
      });

      const legacySchema = {
        version: '0.9',
        apiVersion: 'v1beta1',
        kind: 'Component'
      };

      const migration = await schemaValidator.migrateSchema(legacySchema, '1.0');

      expect(migration.migrated).toBe(true);
      expect(migration.fromVersion).toBe('0.9');
      expect(migration.toVersion).toBe('1.0');
      expect(migration.changes.length).toBeGreaterThan(0);
    });
  });

  describe('Breaking Change Detection', () => {
    it('should identify breaking changes between versions', async () => {
      versionCompatibility.detectBreakingChanges = jest.fn().mockResolvedValue({
        hasBreakingChanges: true,
        changes: [
          {
            type: 'api-removal',
            description: 'Removed legacy catalog API',
            affectedPlugins: ['@backstage/plugin-legacy-test'],
            migrationPath: 'Update to catalog-v2 API'
          },
          {
            type: 'schema-change',
            description: 'Changed entity schema format',
            affectedPlugins: ['@backstage/plugin-legacy-test'],
            migrationPath: 'Update entity definitions to new schema'
          }
        ],
        migrationGuide: 'https://backstage.io/docs/migration/v1.40'
      });

      const changes = await versionCompatibility.detectBreakingChanges('1.35.0', '1.40.0');

      expect(changes.hasBreakingChanges).toBe(true);
      expect(changes.changes).toHaveLength(2);
      expect(changes.changes[0].type).toBe('api-removal');
      expect(changes.migrationGuide).toBeDefined();
    });

    it('should provide migration recommendations', async () => {
      versionCompatibility.generateMigrationPlan = jest.fn().mockResolvedValue({
        fromVersion: '1.35.0',
        toVersion: '1.40.0',
        steps: [
          {
            step: 1,
            description: 'Update core dependencies',
            commands: ['npm update @backstage/core-plugin-api'],
            automated: true
          },
          {
            step: 2,
            description: 'Migrate to catalog-v2 API',
            changes: ['Replace catalogApi.getEntities with new method'],
            automated: false
          },
          {
            step: 3,
            description: 'Update entity schemas',
            changes: ['Update entity YAML files to new format'],
            automated: false
          }
        ],
        estimatedTime: '2-4 hours',
        riskLevel: 'medium'
      });

      const migrationPlan = await versionCompatibility.generateMigrationPlan('1.35.0', '1.40.0');

      expect(migrationPlan.steps).toHaveLength(3);
      expect(migrationPlan.steps[0].automated).toBe(true);
      expect(migrationPlan.riskLevel).toBe('medium');
    });
  });

  describe('LTS Version Support', () => {
    it('should identify LTS versions', async () => {
      versionCompatibility.getLTSVersions = jest.fn().mockReturnValue([
        { version: '1.39.0', supportUntil: '2025-06-01' },
        { version: '1.35.0', supportUntil: '2025-01-01' }
      ]);

      const ltsVersions = versionCompatibility.getLTSVersions();

      expect(ltsVersions).toHaveLength(2);
      expect(ltsVersions[0].version).toBe('1.39.0');
      expect(ltsVersions[1].version).toBe('1.35.0');
    });

    it('should recommend LTS versions for production', async () => {
      versionCompatibility.recommendVersion = jest.fn().mockImplementation((environment) => {
        if (environment === 'production') {
          return {
            recommended: '1.39.0',
            reason: 'Latest LTS with extended support',
            alternatives: ['1.35.0'],
            warnings: []
          };
        } else {
          return {
            recommended: '1.40.0',
            reason: 'Latest stable with newest features',
            alternatives: ['1.39.0'],
            warnings: ['May have compatibility issues with some plugins']
          };
        }
      });

      const prodRecommendation = versionCompatibility.recommendVersion('production');
      const devRecommendation = versionCompatibility.recommendVersion('development');

      expect(prodRecommendation.recommended).toBe('1.39.0');
      expect(devRecommendation.recommended).toBe('1.40.0');
    });
  });

  describe('Compatibility Testing Automation', () => {
    it('should run automated compatibility tests', async () => {
      versionCompatibility.runCompatibilityTests = jest.fn().mockResolvedValue({
        testSuite: 'plugin-compatibility',
        results: [
          {
            pluginId: '@backstage/plugin-modern-test',
            backstageVersion: '1.39.0',
            passed: true,
            tests: {
              api: 'passed',
              schema: 'passed',
              features: 'passed'
            }
          },
          {
            pluginId: '@backstage/plugin-legacy-test',
            backstageVersion: '1.40.0',
            passed: false,
            tests: {
              api: 'failed',
              schema: 'passed',
              features: 'failed'
            },
            errors: ['API incompatibility detected']
          }
        ],
        summary: {
          totalTests: 8,
          passed: 6,
          failed: 2,
          compatibility: '75%'
        }
      });

      const testResults = await versionCompatibility.runCompatibilityTests([
        TEST_PLUGINS['modern-plugin'],
        TEST_PLUGINS['legacy-plugin']
      ], ['1.39.0', '1.40.0']);

      expect(testResults.results).toHaveLength(2);
      expect(testResults.summary.passed).toBe(6);
      expect(testResults.summary.failed).toBe(2);
    });

    it('should generate compatibility reports', async () => {
      versionCompatibility.generateCompatibilityReport = jest.fn().mockResolvedValue({
        reportId: 'compat-report-123',
        generatedAt: new Date().toISOString(),
        summary: {
          totalPlugins: 4,
          compatiblePlugins: 3,
          incompatiblePlugins: 1,
          warningsCount: 2
        },
        details: {
          compatible: ['modern-plugin', 'flexible-plugin'],
          incompatible: ['legacy-plugin'],
          warnings: [
            'cutting-edge-plugin uses experimental APIs'
          ]
        },
        recommendations: [
          'Update legacy-plugin to latest version',
          'Consider using stable APIs instead of experimental ones'
        ]
      });

      const report = await versionCompatibility.generateCompatibilityReport(
        Object.values(TEST_PLUGINS),
        '1.39.0'
      );

      expect(report.summary.totalPlugins).toBe(4);
      expect(report.summary.compatiblePlugins).toBe(3);
      expect(report.details.compatible).toContain('modern-plugin');
      expect(report.details.incompatible).toContain('legacy-plugin');
    });
  });

  describe('Continuous Compatibility Monitoring', () => {
    it('should monitor compatibility across version updates', async () => {
      versionCompatibility.setupContinuousMonitoring = jest.fn().mockResolvedValue({
        monitoringId: 'monitor-123',
        watchedVersions: ['1.39.0', '1.40.0', '1.41.0-rc'],
        notifications: {
          email: 'admin@company.com',
          slack: '#backstage-updates'
        },
        schedule: 'daily',
        lastCheck: new Date().toISOString()
      });

      const monitoring = await versionCompatibility.setupContinuousMonitoring({
        plugins: Object.values(TEST_PLUGINS),
        versions: ['1.39.0', '1.40.0', '1.41.0-rc'],
        notifications: {
          email: 'admin@company.com',
          slack: '#backstage-updates'
        }
      });

      expect(monitoring.monitoringId).toBeDefined();
      expect(monitoring.watchedVersions).toHaveLength(3);
      expect(monitoring.schedule).toBe('daily');
    });

    it('should alert on compatibility issues', async () => {
      versionCompatibility.processCompatibilityAlert = jest.fn().mockResolvedValue({
        alertId: 'alert-456',
        severity: 'high',
        message: 'Plugin incompatibility detected with Backstage 1.41.0-rc',
        affectedPlugins: ['@backstage/plugin-legacy-test'],
        recommendedActions: [
          'Update plugin to compatible version',
          'Contact plugin maintainer for support'
        ],
        acknowledged: false
      });

      const alert = await versionCompatibility.processCompatibilityAlert({
        newVersion: '1.41.0-rc',
        incompatiblePlugins: ['@backstage/plugin-legacy-test'],
        breakingChanges: ['Removed legacy API endpoints']
      });

      expect(alert.severity).toBe('high');
      expect(alert.affectedPlugins).toContain('@backstage/plugin-legacy-test');
      expect(alert.recommendedActions).toHaveLength(2);
    });
  });
});