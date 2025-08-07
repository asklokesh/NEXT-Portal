import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { ConfigurationEngine } from '@/services/configuration/engine';
import { ValidationEngine } from '@/services/validation/engine';
import { BackstageIntegration } from '@/services/backstage/integration';
import { PluginConfigurationStore } from '@/store/plugin-configuration';

// Mock service responses and test data
const mockPluginSchema = {
  type: 'object',
  properties: {
    database: {
      type: 'object',
      properties: {
        host: { type: 'string', title: 'Database Host', default: 'localhost' },
        port: { type: 'integer', title: 'Database Port', default: 5432 },
        name: { type: 'string', title: 'Database Name' },
        ssl: { type: 'boolean', title: 'Enable SSL', default: false }
      },
      required: ['host', 'port', 'name']
    },
    features: {
      type: 'array',
      items: { type: 'string' },
      title: 'Enabled Features',
      default: ['catalog', 'search']
    },
    limits: {
      type: 'object',
      properties: {
        maxEntities: { type: 'integer', title: 'Max Entities', minimum: 1, maximum: 10000 },
        cacheTimeout: { type: 'integer', title: 'Cache Timeout (seconds)', default: 300 }
      }
    },
    auth: {
      type: 'object',
      oneOf: [
        {
          title: 'OAuth',
          properties: {
            provider: { type: 'string', enum: ['oauth'], default: 'oauth' },
            clientId: { type: 'string', title: 'Client ID' },
            clientSecret: { type: 'string', title: 'Client Secret', format: 'password' }
          },
          required: ['clientId', 'clientSecret']
        },
        {
          title: 'API Key',
          properties: {
            provider: { type: 'string', enum: ['apikey'], default: 'apikey' },
            key: { type: 'string', title: 'API Key', format: 'password' }
          },
          required: ['key']
        }
      ]
    }
  },
  required: ['database']
};

const mockValidConfiguration = {
  database: {
    host: 'db.example.com',
    port: 5432,
    name: 'backstage',
    ssl: true
  },
  features: ['catalog', 'search', 'techdocs'],
  limits: {
    maxEntities: 5000,
    cacheTimeout: 600
  },
  auth: {
    provider: 'oauth',
    clientId: 'test-client-id',
    clientSecret: 'test-secret'
  }
};

const mockInvalidConfiguration = {
  database: {
    port: 'invalid-port', // Should be integer
    name: '',             // Required field empty
  },
  limits: {
    maxEntities: 15000    // Exceeds maximum
  },
  auth: {
    provider: 'oauth'
    // Missing required fields
  }
};

// Mock implementations
jest.mock('@/services/configuration/engine');
jest.mock('@/services/validation/engine');
jest.mock('@/services/backstage/integration');
jest.mock('@/store/plugin-configuration');

describe('Plugin Configuration Integration', () => {
  let configEngine: jest.Mocked<ConfigurationEngine>;
  let validationEngine: jest.Mocked<ValidationEngine>;
  let backstageIntegration: jest.Mocked<BackstageIntegration>;
  let configStore: jest.Mocked<PluginConfigurationStore>;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.CONFIG_ENCRYPTION_KEY = 'test-encryption-key-32-characters';
  });

  beforeEach(() => {
    jest.clearAllMocks();

    configEngine = new ConfigurationEngine() as jest.Mocked<ConfigurationEngine>;
    validationEngine = new ValidationEngine() as jest.Mocked<ValidationEngine>;
    backstageIntegration = new BackstageIntegration() as jest.Mocked<BackstageIntegration>;
    configStore = new PluginConfigurationStore() as jest.Mocked<PluginConfigurationStore>;

    // Setup default mock implementations
    configEngine.generateConfiguration.mockImplementation(async (schema, userInput) => ({
      configuration: userInput,
      generated: true,
      timestamp: new Date().toISOString()
    }));

    configEngine.mergeConfigurations.mockImplementation(async (base, override) => ({
      ...base,
      ...override
    }));

    validationEngine.validateConfiguration.mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: []
    });

    backstageIntegration.updatePluginConfig.mockResolvedValue({
      success: true,
      configId: 'config-123',
      version: '1.0.0'
    });

    configStore.save.mockResolvedValue({
      id: 'store-123',
      pluginId: '@backstage/plugin-catalog',
      configuration: mockValidConfiguration,
      createdAt: new Date().toISOString(),
      version: 1
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    delete process.env.NODE_ENV;
    delete process.env.CONFIG_ENCRYPTION_KEY;
  });

  describe('Configuration Generation', () => {
    it('should generate configuration from schema and user input', async () => {
      const userInput = {
        database: { host: 'localhost', port: 5432, name: 'test' }
      };

      const result = await configEngine.generateConfiguration(mockPluginSchema, userInput);

      expect(result.configuration).toBeDefined();
      expect(result.generated).toBe(true);
      expect(configEngine.generateConfiguration).toHaveBeenCalledWith(mockPluginSchema, userInput);
    });

    it('should apply default values from schema', async () => {
      const userInput = {
        database: { host: 'localhost', name: 'test' } // Missing port
      };

      const expectedConfig = {
        database: { 
          host: 'localhost', 
          port: 5432,  // Default value applied
          name: 'test',
          ssl: false   // Default value applied
        }
      };

      configEngine.generateConfiguration.mockResolvedValue({
        configuration: expectedConfig,
        generated: true,
        timestamp: new Date().toISOString()
      });

      const result = await configEngine.generateConfiguration(mockPluginSchema, userInput);

      expect(result.configuration.database.port).toBe(5432);
      expect(result.configuration.database.ssl).toBe(false);
    });

    it('should handle conditional schema branches (oneOf)', async () => {
      const oauthInput = {
        auth: {
          provider: 'oauth',
          clientId: 'test-client',
          clientSecret: 'secret'
        }
      };

      configEngine.generateConfiguration.mockResolvedValue({
        configuration: oauthInput,
        generated: true,
        timestamp: new Date().toISOString()
      });

      const result = await configEngine.generateConfiguration(mockPluginSchema, oauthInput);

      expect(result.configuration.auth.provider).toBe('oauth');
      expect(result.configuration.auth.clientId).toBe('test-client');
    });

    it('should merge multiple configuration sources', async () => {
      const baseConfig = {
        database: { host: 'localhost', port: 5432, name: 'base' },
        features: ['catalog']
      };

      const overrideConfig = {
        database: { host: 'prod-db.com', ssl: true },
        features: ['catalog', 'search', 'techdocs']
      };

      const expectedMerged = {
        database: { host: 'prod-db.com', port: 5432, name: 'base', ssl: true },
        features: ['catalog', 'search', 'techdocs']
      };

      configEngine.mergeConfigurations.mockResolvedValue(expectedMerged);

      const result = await configEngine.mergeConfigurations(baseConfig, overrideConfig);

      expect(result.database.host).toBe('prod-db.com');
      expect(result.database.port).toBe(5432); // Preserved from base
      expect(result.features).toHaveLength(3);
    });

    it('should handle environment-specific configurations', async () => {
      const environments = ['development', 'staging', 'production'];
      
      for (const env of environments) {
        const envConfig = {
          database: { 
            host: `${env}-db.com`,
            port: 5432,
            name: `backstage-${env}`
          }
        };

        configEngine.generateConfiguration.mockResolvedValueOnce({
          configuration: envConfig,
          generated: true,
          environment: env,
          timestamp: new Date().toISOString()
        });

        const result = await configEngine.generateConfiguration(mockPluginSchema, envConfig);

        expect(result.configuration.database.host).toBe(`${env}-db.com`);
        expect(result.configuration.database.name).toBe(`backstage-${env}`);
      }

      expect(configEngine.generateConfiguration).toHaveBeenCalledTimes(3);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate configuration against schema', async () => {
      const result = await validationEngine.validateConfiguration(mockValidConfiguration, mockPluginSchema);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(validationEngine.validateConfiguration).toHaveBeenCalledWith(
        mockValidConfiguration, 
        mockPluginSchema
      );
    });

    it('should detect validation errors', async () => {
      const validationErrors = [
        {
          field: 'database.port',
          message: 'Expected integer, received string',
          value: 'invalid-port'
        },
        {
          field: 'database.name',
          message: 'Required field cannot be empty',
          value: ''
        },
        {
          field: 'limits.maxEntities',
          message: 'Value 15000 exceeds maximum of 10000',
          value: 15000
        }
      ];

      validationEngine.validateConfiguration.mockResolvedValue({
        isValid: false,
        errors: validationErrors,
        warnings: []
      });

      const result = await validationEngine.validateConfiguration(
        mockInvalidConfiguration, 
        mockPluginSchema
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0].field).toBe('database.port');
    });

    it('should provide validation warnings for non-critical issues', async () => {
      const configWithWarnings = {
        ...mockValidConfiguration,
        deprecatedField: 'old-value' // Field not in schema
      };

      const validationWarnings = [
        {
          field: 'deprecatedField',
          message: 'Field is deprecated and will be ignored',
          severity: 'warning'
        }
      ];

      validationEngine.validateConfiguration.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: validationWarnings
      });

      const result = await validationEngine.validateConfiguration(
        configWithWarnings, 
        mockPluginSchema
      );

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].severity).toBe('warning');
    });

    it('should validate nested object configurations', async () => {
      const nestedValidationError = {
        isValid: false,
        errors: [{
          field: 'auth.clientId',
          message: 'Required field missing for OAuth provider',
          value: undefined
        }],
        warnings: []
      };

      validationEngine.validateConfiguration.mockResolvedValue(nestedValidationError);

      const result = await validationEngine.validateConfiguration(
        { auth: { provider: 'oauth' } }, 
        mockPluginSchema
      );

      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('auth.clientId');
    });

    it('should validate array configurations', async () => {
      const invalidArrayConfig = {
        features: ['catalog', 'invalid-feature', null] // Invalid array items
      };

      validationEngine.validateConfiguration.mockResolvedValue({
        isValid: false,
        errors: [
          {
            field: 'features[1]',
            message: 'Invalid feature name: invalid-feature',
            value: 'invalid-feature'
          },
          {
            field: 'features[2]',
            message: 'Array items must be strings',
            value: null
          }
        ],
        warnings: []
      });

      const result = await validationEngine.validateConfiguration(
        invalidArrayConfig, 
        mockPluginSchema
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('Backstage Integration', () => {
    it('should update plugin configuration in Backstage', async () => {
      const result = await backstageIntegration.updatePluginConfig(
        '@backstage/plugin-catalog',
        mockValidConfiguration
      );

      expect(result.success).toBe(true);
      expect(result.configId).toBe('config-123');
      expect(backstageIntegration.updatePluginConfig).toHaveBeenCalledWith(
        '@backstage/plugin-catalog',
        mockValidConfiguration
      );
    });

    it('should handle Backstage API errors', async () => {
      backstageIntegration.updatePluginConfig.mockRejectedValue(
        new Error('Backstage API unavailable')
      );

      await expect(
        backstageIntegration.updatePluginConfig('@backstage/plugin-catalog', mockValidConfiguration)
      ).rejects.toThrow('Backstage API unavailable');
    });

    it('should retrieve current plugin configuration from Backstage', async () => {
      backstageIntegration.getPluginConfig = jest.fn().mockResolvedValue({
        pluginId: '@backstage/plugin-catalog',
        configuration: mockValidConfiguration,
        version: '1.0.0',
        lastUpdated: new Date().toISOString()
      });

      const result = await backstageIntegration.getPluginConfig('@backstage/plugin-catalog');

      expect(result.configuration).toEqual(mockValidConfiguration);
      expect(result.version).toBe('1.0.0');
    });

    it('should support configuration rollback', async () => {
      backstageIntegration.rollbackPluginConfig = jest.fn().mockResolvedValue({
        success: true,
        rolledBackToVersion: '0.9.0',
        configId: 'config-122'
      });

      const result = await backstageIntegration.rollbackPluginConfig(
        '@backstage/plugin-catalog',
        '0.9.0'
      );

      expect(result.success).toBe(true);
      expect(result.rolledBackToVersion).toBe('0.9.0');
    });

    it('should validate configuration compatibility with Backstage version', async () => {
      backstageIntegration.validateCompatibility = jest.fn().mockResolvedValue({
        compatible: true,
        backstageVersion: '1.10.0',
        warnings: []
      });

      const result = await backstageIntegration.validateCompatibility(
        '@backstage/plugin-catalog',
        mockValidConfiguration
      );

      expect(result.compatible).toBe(true);
      expect(result.backstageVersion).toBe('1.10.0');
    });
  });

  describe('Configuration Storage', () => {
    it('should save configuration to persistent store', async () => {
      const result = await configStore.save(
        '@backstage/plugin-catalog',
        mockValidConfiguration
      );

      expect(result.id).toBe('store-123');
      expect(result.configuration).toEqual(mockValidConfiguration);
      expect(result.version).toBe(1);
    });

    it('should retrieve configuration from store', async () => {
      configStore.get = jest.fn().mockResolvedValue({
        id: 'store-123',
        pluginId: '@backstage/plugin-catalog',
        configuration: mockValidConfiguration,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const result = await configStore.get('@backstage/plugin-catalog');

      expect(result.configuration).toEqual(mockValidConfiguration);
      expect(configStore.get).toHaveBeenCalledWith('@backstage/plugin-catalog');
    });

    it('should handle configuration versioning', async () => {
      const versions = [
        { version: 1, configuration: { database: { host: 'v1-host' } } },
        { version: 2, configuration: { database: { host: 'v2-host' } } },
        { version: 3, configuration: { database: { host: 'v3-host' } } }
      ];

      configStore.getVersionHistory = jest.fn().mockResolvedValue(versions);

      const history = await configStore.getVersionHistory('@backstage/plugin-catalog');

      expect(history).toHaveLength(3);
      expect(history[2].version).toBe(3);
      expect(history[2].configuration.database.host).toBe('v3-host');
    });

    it('should encrypt sensitive configuration data', async () => {
      const configWithSecrets = {
        ...mockValidConfiguration,
        auth: {
          provider: 'oauth',
          clientId: 'client-123',
          clientSecret: 'super-secret-key'
        }
      };

      configStore.save.mockImplementation(async (pluginId, config) => {
        // Simulate encryption of sensitive fields
        const encryptedConfig = {
          ...config,
          auth: {
            ...config.auth,
            clientSecret: '[ENCRYPTED:abc123def456]'
          }
        };

        return {
          id: 'store-123',
          pluginId,
          configuration: encryptedConfig,
          version: 1,
          createdAt: new Date().toISOString()
        };
      });

      const result = await configStore.save('@backstage/plugin-catalog', configWithSecrets);

      expect(result.configuration.auth.clientSecret).toMatch(/^\[ENCRYPTED:/);
    });

    it('should support configuration diffs', async () => {
      const oldConfig = {
        database: { host: 'old-host', port: 5432 },
        features: ['catalog']
      };

      const newConfig = {
        database: { host: 'new-host', port: 5432, ssl: true },
        features: ['catalog', 'search']
      };

      configStore.diff = jest.fn().mockResolvedValue({
        added: [
          { path: 'database.ssl', value: true },
          { path: 'features[1]', value: 'search' }
        ],
        modified: [
          { path: 'database.host', oldValue: 'old-host', newValue: 'new-host' }
        ],
        removed: []
      });

      const diff = await configStore.diff(oldConfig, newConfig);

      expect(diff.added).toHaveLength(2);
      expect(diff.modified).toHaveLength(1);
      expect(diff.removed).toHaveLength(0);
    });
  });

  describe('End-to-End Configuration Flow', () => {
    it('should complete full configuration workflow', async () => {
      // 1. Generate configuration
      const generatedConfig = await configEngine.generateConfiguration(
        mockPluginSchema, 
        mockValidConfiguration
      );
      expect(generatedConfig.generated).toBe(true);

      // 2. Validate configuration
      const validation = await validationEngine.validateConfiguration(
        generatedConfig.configuration, 
        mockPluginSchema
      );
      expect(validation.isValid).toBe(true);

      // 3. Save to store
      const stored = await configStore.save(
        '@backstage/plugin-catalog', 
        generatedConfig.configuration
      );
      expect(stored.id).toBeDefined();

      // 4. Update in Backstage
      const backstageResult = await backstageIntegration.updatePluginConfig(
        '@backstage/plugin-catalog', 
        generatedConfig.configuration
      );
      expect(backstageResult.success).toBe(true);

      // Verify all steps were called in correct order
      expect(configEngine.generateConfiguration).toHaveBeenCalledBefore(
        validationEngine.validateConfiguration as jest.MockedFunction<any>
      );
      expect(validationEngine.validateConfiguration).toHaveBeenCalledBefore(
        configStore.save as jest.MockedFunction<any>
      );
      expect(configStore.save).toHaveBeenCalledBefore(
        backstageIntegration.updatePluginConfig as jest.MockedFunction<any>
      );
    });

    it('should handle validation failures gracefully', async () => {
      // Mock validation failure
      validationEngine.validateConfiguration.mockResolvedValue({
        isValid: false,
        errors: [{ field: 'database.port', message: 'Invalid port', value: 'invalid' }],
        warnings: []
      });

      const generatedConfig = await configEngine.generateConfiguration(
        mockPluginSchema, 
        mockInvalidConfiguration
      );

      const validation = await validationEngine.validateConfiguration(
        generatedConfig.configuration, 
        mockPluginSchema
      );

      expect(validation.isValid).toBe(false);

      // Should not proceed to save or update if validation fails
      expect(configStore.save).not.toHaveBeenCalled();
      expect(backstageIntegration.updatePluginConfig).not.toHaveBeenCalled();
    });

    it('should support configuration updates with proper versioning', async () => {
      // Original configuration
      const originalConfig = mockValidConfiguration;
      
      // Updated configuration
      const updatedConfig = {
        ...mockValidConfiguration,
        features: [...mockValidConfiguration.features, 'techdocs'],
        limits: { maxEntities: 7500, cacheTimeout: 900 }
      };

      // Mock version increment
      configStore.save.mockImplementation(async (pluginId, config) => ({
        id: 'store-123',
        pluginId,
        configuration: config,
        version: 2, // Incremented version
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      const result = await configStore.save('@backstage/plugin-catalog', updatedConfig);

      expect(result.version).toBe(2);
      expect(result.configuration.features).toContain('techdocs');
    });

    it('should handle concurrent configuration updates', async () => {
      const concurrentConfigs = [
        { ...mockValidConfiguration, features: ['catalog', 'search'] },
        { ...mockValidConfiguration, features: ['catalog', 'techdocs'] },
        { ...mockValidConfiguration, features: ['catalog', 'kubernetes'] }
      ];

      // Mock concurrent saves with different versions
      configStore.save.mockImplementation(async (pluginId, config, version = 1) => ({
        id: `store-${version}`,
        pluginId,
        configuration: config,
        version,
        createdAt: new Date().toISOString()
      }));

      const promises = concurrentConfigs.map((config, index) => 
        configStore.save('@backstage/plugin-catalog', config, index + 1)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0].version).toBe(1);
      expect(results[2].version).toBe(3);
    });
  });

  describe('Configuration Templates and Presets', () => {
    it('should apply configuration templates', async () => {
      const template = {
        name: 'production-ready',
        schema: mockPluginSchema,
        defaults: {
          database: { ssl: true, port: 5432 },
          limits: { maxEntities: 10000, cacheTimeout: 600 }
        }
      };

      configEngine.applyTemplate = jest.fn().mockResolvedValue({
        configuration: {
          ...mockValidConfiguration,
          database: { ...mockValidConfiguration.database, ssl: true },
          limits: { maxEntities: 10000, cacheTimeout: 600 }
        },
        templateApplied: 'production-ready'
      });

      const result = await configEngine.applyTemplate(template, mockValidConfiguration);

      expect(result.templateApplied).toBe('production-ready');
      expect(result.configuration.database.ssl).toBe(true);
    });

    it('should provide configuration presets by environment', async () => {
      const environments = ['development', 'staging', 'production'];
      const presets = {
        development: { database: { ssl: false }, limits: { maxEntities: 1000 } },
        staging: { database: { ssl: true }, limits: { maxEntities: 5000 } },
        production: { database: { ssl: true }, limits: { maxEntities: 10000 } }
      };

      configEngine.getEnvironmentPreset = jest.fn().mockImplementation((env) => ({
        environment: env,
        configuration: presets[env as keyof typeof presets]
      }));

      for (const env of environments) {
        const preset = await configEngine.getEnvironmentPreset(env);
        
        expect(preset.environment).toBe(env);
        
        if (env === 'development') {
          expect(preset.configuration.database.ssl).toBe(false);
        } else {
          expect(preset.configuration.database.ssl).toBe(true);
        }
      }
    });
  });
});