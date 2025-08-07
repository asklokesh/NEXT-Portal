import { describe, it, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { Verifier } from '@pact-foundation/pact';
import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';
import axios from 'axios';

// Example provider verification test
describe('Catalog Service Provider Verification', () => {
  let server: ChildProcess;
  const PORT = 3003;
  const BASE_URL = `http://localhost:${PORT}`;

  beforeAll(async () => {
    // Start the provider service
    server = spawn('npm', ['run', 'start:test'], {
      env: { ...process.env, PORT: PORT.toString() },
      stdio: 'pipe'
    });

    // Wait for server to be ready
    let retries = 30;
    while (retries > 0) {
      try {
        await axios.get(`${BASE_URL}/health`);
        break;
      } catch {
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (retries === 0) {
      throw new Error('Provider service failed to start');
    }
  }, 60000);

  afterAll(async () => {
    if (server) {
      server.kill();
    }
  });

  // Provider state setup handlers
  const stateHandlers = {
    'there are entities in the catalog': async () => {
      // Setup test data
      await axios.post(`${BASE_URL}/_test/setup`, {
        entities: [
          {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: {
              name: 'example-service',
              namespace: 'default',
              title: 'Example Service'
            },
            spec: {
              type: 'service',
              owner: 'platform-team',
              lifecycle: 'production'
            }
          }
        ]
      });
    },

    'there are different types of entities': async () => {
      await axios.post(`${BASE_URL}/_test/setup`, {
        entities: [
          {
            kind: 'Component',
            metadata: { name: 'component-service', namespace: 'default' },
            spec: { type: 'service', owner: 'team-a' }
          },
          {
            kind: 'User',
            metadata: { name: 'john-doe', namespace: 'default' },
            spec: { profile: { displayName: 'John Doe' } }
          }
        ]
      });
    },

    'the system is ready to accept new entities': async () => {
      await axios.post(`${BASE_URL}/_test/setup`, {
        readyForNewEntities: true
      });
    },

    'entity default/component/example-service exists': async () => {
      await axios.post(`${BASE_URL}/_test/setup`, {
        entities: [
          {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: {
              name: 'example-service',
              namespace: 'default',
              uid: '123e4567-e89b-12d3-a456-426614174000',
              title: 'Example Service'
            },
            spec: {
              type: 'service',
              owner: 'platform-team',
              lifecycle: 'production'
            }
          }
        ]
      });
    },

    'entity default/component/example-service exists and can be deleted': async () => {
      await axios.post(`${BASE_URL}/_test/setup`, {
        entities: [
          {
            metadata: { name: 'example-service', namespace: 'default' },
            deletable: true
          }
        ]
      });
    },

    'entity default/component/protected-service exists but cannot be deleted': async () => {
      await axios.post(`${BASE_URL}/_test/setup`, {
        entities: [
          {
            metadata: { name: 'protected-service', namespace: 'default' },
            deletable: false,
            protected: true
          }
        ]
      });
    },

    'there is a system with multiple components': async (params: any) => {
      const { systemName, componentCount } = params;
      const entities = [];
      
      for (let i = 0; i < componentCount; i++) {
        entities.push({
          kind: 'Component',
          metadata: { name: `${systemName}-component-${i}` },
          spec: { system: systemName, type: i === 0 ? 'service' : 'library' }
        });
      }
      
      await axios.post(`${BASE_URL}/_test/setup`, { entities });
    }
  };

  beforeEach(async () => {
    // Clean up test data before each test
    await axios.delete(`${BASE_URL}/_test/cleanup`);
  });

  it('should verify all consumer contracts', async () => {
    const verifier = new Verifier({
      providerBaseUrl: BASE_URL,
      pactBrokerUrl: process.env.PACT_BROKER_BASE_URL,
      pactBrokerToken: process.env.PACT_BROKER_TOKEN,
      provider: 'catalog-service',
      providerVersion: process.env.PROVIDER_VERSION || '1.0.0',
      publishVerificationResult: true,
      consumerVersionSelectors: [
        { latest: true },
        { deployed: true },
        { mainBranch: true }
      ],
      enablePending: true,
      includeWipPactsSince: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      
      // State setup
      stateHandlers,
      
      // Request filters for sensitive data
      requestFilter: (req, res, next) => {
        // Remove sensitive headers from logs
        if (req.headers.authorization) {
          req.headers.authorization = 'Bearer [REDACTED]';
        }
        next();
      },

      // Custom verification options
      timeout: 30000,
      logLevel: process.env.LOG_LEVEL || 'info',
      
      // Provider version tags
      providerVersionTags: ['latest', process.env.BRANCH_NAME || 'main'],
      
      // Consumer version tags to verify against
      consumerVersionTags: ['latest', 'production']
    });

    await verifier.verifyProvider();
  }, 120000);
});

// Advanced provider verification with dynamic configuration
describe('Advanced Provider Verification', () => {
  let server: ChildProcess;
  const PORT = 3004;
  const BASE_URL = `http://localhost:${PORT}`;

  beforeAll(async () => {
    // Start provider with specific configuration
    server = spawn('npm', ['run', 'start:test:advanced'], {
      env: {
        ...process.env,
        PORT: PORT.toString(),
        NODE_ENV: 'test',
        DB_HOST: 'localhost',
        DB_NAME: 'test_catalog'
      },
      stdio: 'pipe'
    });

    // Wait for readiness
    let retries = 30;
    while (retries > 0) {
      try {
        const response = await axios.get(`${BASE_URL}/health`);
        if (response.data.status === 'ok') break;
      } catch {
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }, 60000);

  afterAll(async () => {
    if (server) {
      server.kill();
    }
  });

  it('should verify contracts with custom selectors', async () => {
    const verifier = new Verifier({
      providerBaseUrl: BASE_URL,
      pactUrls: [
        join(__dirname, '../../pacts/backstage-portal-catalog-service.json')
      ],
      provider: 'catalog-service',
      providerVersion: `${process.env.GIT_COMMIT || 'local'}-${Date.now()}`,
      
      // Advanced consumer version selectors
      consumerVersionSelectors: [
        { tag: 'main', latest: true },
        { tag: 'production', latest: true },
        { branch: 'main', latest: true },
        { deployedOrReleased: true }
      ],
      
      publishVerificationResult: Boolean(process.env.CI),
      
      // State handlers with cleanup
      stateHandlers: {
        ...stateHandlers,
        
        // Global setup/teardown
        '__setup__': async () => {
          console.log('Setting up provider test environment');
          await axios.post(`${BASE_URL}/_test/global-setup`);
        },
        
        '__teardown__': async () => {
          console.log('Tearing down provider test environment');
          await axios.post(`${BASE_URL}/_test/global-teardown`);
        }
      },
      
      // Verification hooks
      beforeEach: async () => {
        // Reset state before each interaction
        await axios.post(`${BASE_URL}/_test/reset`);
      },
      
      afterEach: async (interaction: any) => {
        // Log interaction results
        console.log(`Verified interaction: ${interaction.description}`);
      },
      
      // Custom headers for all requests
      customProviderHeaders: ['X-Test-Mode: verification'],
      
      // Logging configuration
      logDir: join(__dirname, '../../logs'),
      format: 'RspecJunitFormatter',
      out: join(__dirname, '../../reports/pact-verification.xml'),
      
      verbose: true
    });

    await verifier.verifyProvider();
  });

  it('should verify with conditional state setup', async () => {
    const verifier = new Verifier({
      providerBaseUrl: BASE_URL,
      pactUrls: [
        join(__dirname, '../../pacts/backstage-portal-catalog-service.json')
      ],
      provider: 'catalog-service',
      providerVersion: 'conditional-test',
      
      stateHandlers: {
        // Conditional state setup based on environment
        'database is populated with test data': async (params: any) => {
          const testEnv = process.env.TEST_ENV || 'minimal';
          
          switch (testEnv) {
            case 'full':
              await axios.post(`${BASE_URL}/_test/setup-full-dataset`);
              break;
            case 'minimal':
              await axios.post(`${BASE_URL}/_test/setup-minimal-dataset`);
              break;
            default:
              await axios.post(`${BASE_URL}/_test/setup-empty-dataset`);
          }
        },
        
        // Dynamic state based on parameters
        'user has specific permissions': async (params: any) => {
          const { userId, permissions } = params;
          await axios.post(`${BASE_URL}/_test/setup-user-permissions`, {
            userId,
            permissions: permissions || ['read:entities']
          });
        }
      },
      
      // Failure handling
      monkeypatch: {
        // Custom error handling
        after_verification_reports_published: async (result: any) => {
          if (!result.success) {
            console.error('Verification failed, generating debug report...');
            await axios.post(`${BASE_URL}/_test/generate-debug-report`);
          }
        }
      }
    });

    await verifier.verifyProvider();
  });
});

// Mock provider for testing complex scenarios
describe('Mock Provider Scenarios', () => {
  it('should handle provider state transitions', async () => {
    const verifier = new Verifier({
      providerBaseUrl: 'http://localhost:3005',
      pactUrls: [
        join(__dirname, '../../pacts/complex-workflow-test.json')
      ],
      provider: 'catalog-service',
      providerVersion: 'mock-test',
      
      stateHandlers: {
        'workflow is in initial state': async () => {
          // Setup initial workflow state
        },
        
        'workflow has progressed to step 2': async (params: any) => {
          // Setup intermediate state
          const { workflowId, previousSteps } = params;
          // Apply state transitions
        },
        
        'workflow is completed': async (params: any) => {
          // Setup final state
          const { workflowId, result } = params;
          // Set completion state
        }
      },
      
      // State change callbacks
      stateChangeHandlers: {
        setup: async (state: string, params: any) => {
          console.log(`Setting up state: ${state}`, params);
        },
        
        teardown: async (state: string, params: any) => {
          console.log(`Tearing down state: ${state}`, params);
        }
      }
    });

    await verifier.verifyProvider();
  });
});