import { Pact, Interaction, Matchers } from '@pact-foundation/pact';
import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/globals';
import axios from 'axios';
import path from 'path';

const { like, eachLike, term, uuid } = Matchers;

// Plugin API Consumer Contract Tests
describe('Plugin Management API Consumer Contract', () => {
  let provider: Pact;

  beforeAll(async () => {
    provider = new Pact({
      consumer: 'plugin-management-frontend',
      provider: 'plugin-api-service',
      port: 1234,
      log: path.resolve(process.cwd(), 'tests/contracts/logs', 'pact.log'),
      dir: path.resolve(process.cwd(), 'tests/contracts/pacts'),
      spec: 2,
    });

    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  beforeEach(async () => {
    await provider.removeInteractions();
  });

  describe('Plugin Listing API', () => {
    it('should get a list of available plugins', async () => {
      // Arrange
      const expectedResponse = {
        plugins: eachLike({
          id: like('api-docs-plugin'),
          name: like('API Documentation'),
          version: like('1.2.0'),
          description: like('Generate and view API documentation'),
          author: like('Backstage Team'),
          category: like('Documentation'),
          tags: eachLike('api'),
          icon: like('file-text'),
          status: term({
            matcher: '^(available|installed|updating)$',
            generate: 'available'
          }),
          downloadCount: like(1500),
          rating: like(4.5),
          reviews: like(25),
          compatibility: eachLike('1.20.0'),
          lastUpdated: like('2024-01-15T10:00:00Z'),
          size: like('2.1 MB'),
          license: like('Apache-2.0'),
          homepage: like('https://example.com/plugin'),
          repository: like('https://github.com/example/plugin'),
        }),
        pagination: {
          page: like(1),
          limit: like(20),
          total: like(50),
          totalPages: like(3),
        },
        total: like(50),
      };

      await provider.addInteraction({
        state: 'plugins exist',
        uponReceiving: 'a request for plugins list',
        withRequest: {
          method: 'GET',
          path: '/api/plugins',
          query: {
            page: '1',
            limit: '20',
          },
          headers: {
            Accept: 'application/json',
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: expectedResponse,
        },
      } as Interaction);

      // Act
      const response = await axios.get('http://localhost:1234/api/plugins', {
        params: { page: 1, limit: 20 },
        headers: { Accept: 'application/json' },
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('plugins');
      expect(response.data).toHaveProperty('pagination');
      expect(response.data).toHaveProperty('total');
      expect(Array.isArray(response.data.plugins)).toBe(true);
      expect(response.data.plugins[0]).toHaveProperty('id');
      expect(response.data.plugins[0]).toHaveProperty('name');
      expect(response.data.plugins[0]).toHaveProperty('version');
    });

    it('should search plugins by query', async () => {
      await provider.addInteraction({
        state: 'plugins with search term exist',
        uponReceiving: 'a search request for plugins',
        withRequest: {
          method: 'GET',
          path: '/api/plugins',
          query: {
            q: 'api',
            page: '1',
            limit: '20',
          },
          headers: {
            Accept: 'application/json',
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            plugins: eachLike({
              id: like('api-docs-plugin'),
              name: like('API Documentation'),
              description: term({
                matcher: '.*api.*',
                generate: 'Generate and view API documentation'
              }),
              tags: eachLike('api'),
            }),
            pagination: {
              page: like(1),
              limit: like(20),
              total: like(5),
              totalPages: like(1),
            },
            total: like(5),
          },
        },
      } as Interaction);

      const response = await axios.get('http://localhost:1234/api/plugins', {
        params: { q: 'api', page: 1, limit: 20 },
        headers: { Accept: 'application/json' },
      });

      expect(response.status).toBe(200);
      expect(response.data.plugins.length).toBeGreaterThan(0);
      expect(response.data.total).toBeGreaterThan(0);
    });

    it('should filter plugins by category', async () => {
      await provider.addInteraction({
        state: 'plugins in Documentation category exist',
        uponReceiving: 'a request for plugins filtered by category',
        withRequest: {
          method: 'GET',
          path: '/api/plugins',
          query: {
            category: 'Documentation',
            page: '1',
            limit: '20',
          },
          headers: {
            Accept: 'application/json',
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            plugins: eachLike({
              id: like('api-docs-plugin'),
              name: like('API Documentation'),
              category: like('Documentation'),
            }),
            pagination: {
              page: like(1),
              limit: like(20),
              total: like(3),
              totalPages: like(1),
            },
            total: like(3),
          },
        },
      } as Interaction);

      const response = await axios.get('http://localhost:1234/api/plugins', {
        params: { category: 'Documentation', page: 1, limit: 20 },
        headers: { Accept: 'application/json' },
      });

      expect(response.status).toBe(200);
      expect(response.data.plugins.every(p => p.category === 'Documentation')).toBe(true);
    });
  });

  describe('Plugin Details API', () => {
    it('should get details for a specific plugin', async () => {
      const pluginId = 'api-docs-plugin';

      await provider.addInteraction({
        state: `plugin ${pluginId} exists`,
        uponReceiving: `a request for plugin ${pluginId} details`,
        withRequest: {
          method: 'GET',
          path: `/api/plugins/${pluginId}`,
          headers: {
            Accept: 'application/json',
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            id: like(pluginId),
            name: like('API Documentation'),
            version: like('1.2.0'),
            description: like('Comprehensive API documentation plugin'),
            author: like('Backstage Team'),
            category: like('Documentation'),
            tags: eachLike('api'),
            icon: like('file-text'),
            status: like('available'),
            downloadCount: like(1500),
            rating: like(4.5),
            reviews: like(25),
            compatibility: eachLike('1.20.0'),
            dependencies: eachLike({
              id: like('base-plugin'),
              version: like('>=1.0.0'),
              required: like(true),
            }),
            screenshots: eachLike('screenshot1.png'),
            documentation: like('https://docs.example.com/plugin'),
            changelog: eachLike({
              version: like('1.2.0'),
              date: like('2024-01-15T10:00:00Z'),
              changes: eachLike('Added new API endpoints'),
            }),
            config: {
              required: like(false),
              schema: {
                type: like('object'),
                properties: {
                  apiUrl: {
                    type: like('string'),
                    format: like('uri'),
                  },
                  timeout: {
                    type: like('number'),
                    minimum: like(1000),
                  },
                },
              },
            },
          },
        },
      } as Interaction);

      const response = await axios.get(`http://localhost:1234/api/plugins/${pluginId}`, {
        headers: { Accept: 'application/json' },
      });

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(pluginId);
      expect(response.data).toHaveProperty('name');
      expect(response.data).toHaveProperty('version');
      expect(response.data).toHaveProperty('config');
      expect(response.data).toHaveProperty('dependencies');
    });

    it('should return 404 for non-existent plugin', async () => {
      const pluginId = 'non-existent-plugin';

      await provider.addInteraction({
        state: 'plugin does not exist',
        uponReceiving: 'a request for non-existent plugin details',
        withRequest: {
          method: 'GET',
          path: `/api/plugins/${pluginId}`,
          headers: {
            Accept: 'application/json',
          },
        },
        willRespondWith: {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: like('Plugin not found'),
            message: like(`Plugin with id '${pluginId}' was not found`),
            statusCode: like(404),
          },
        },
      } as Interaction);

      try {
        await axios.get(`http://localhost:1234/api/plugins/${pluginId}`, {
          headers: { Accept: 'application/json' },
        });
        // Should not reach here
        expect(false).toBe(true);
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data).toHaveProperty('error');
      }
    });
  });

  describe('Plugin Installation API', () => {
    it('should install a plugin successfully', async () => {
      const pluginId = 'api-docs-plugin';
      const installationConfig = {
        config: {
          apiUrl: 'https://api.example.com',
          timeout: 5000,
          enableLogging: true,
        },
      };

      await provider.addInteraction({
        state: `plugin ${pluginId} is available for installation`,
        uponReceiving: `a request to install plugin ${pluginId}`,
        withRequest: {
          method: 'POST',
          path: `/api/plugins/${pluginId}/install`,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: term({
              matcher: '^Bearer .+$',
              generate: 'Bearer valid-jwt-token'
            }),
          },
          body: installationConfig,
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: like(true),
            message: like('Plugin installed successfully'),
            installationId: uuid(),
            containerId: like('container-12345'),
            status: like('installing'),
            estimatedDuration: like(30),
          },
        },
      } as Interaction);

      const response = await axios.post(
        `http://localhost:1234/api/plugins/${pluginId}/install`,
        installationConfig,
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer valid-jwt-token',
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data).toHaveProperty('installationId');
      expect(response.data).toHaveProperty('containerId');
    });

    it('should reject installation of already installed plugin', async () => {
      const pluginId = 'already-installed-plugin';

      await provider.addInteraction({
        state: `plugin ${pluginId} is already installed`,
        uponReceiving: `a request to install already installed plugin ${pluginId}`,
        withRequest: {
          method: 'POST',
          path: `/api/plugins/${pluginId}/install`,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: term({
              matcher: '^Bearer .+$',
              generate: 'Bearer valid-jwt-token'
            }),
          },
          body: {
            config: {},
          },
        },
        willRespondWith: {
          status: 409,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: like('Plugin already installed'),
            message: like(`Plugin '${pluginId}' is already installed`),
            statusCode: like(409),
            currentVersion: like('1.0.0'),
          },
        },
      } as Interaction);

      try {
        await axios.post(
          `http://localhost:1234/api/plugins/${pluginId}/install`,
          { config: {} },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: 'Bearer valid-jwt-token',
            },
          }
        );
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.response.status).toBe(409);
        expect(error.response.data.error).toBe('Plugin already installed');
      }
    });

    it('should validate installation configuration', async () => {
      const pluginId = 'config-validation-plugin';
      const invalidConfig = {
        config: {
          apiUrl: 'not-a-valid-url',
          timeout: -1,
        },
      };

      await provider.addInteraction({
        state: `plugin ${pluginId} requires valid configuration`,
        uponReceiving: `a request to install plugin ${pluginId} with invalid config`,
        withRequest: {
          method: 'POST',
          path: `/api/plugins/${pluginId}/install`,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: term({
              matcher: '^Bearer .+$',
              generate: 'Bearer valid-jwt-token'
            }),
          },
          body: invalidConfig,
        },
        willRespondWith: {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: like('Configuration validation failed'),
            message: like('The provided configuration is invalid'),
            statusCode: like(400),
            validationErrors: eachLike({
              field: like('apiUrl'),
              message: like('Must be a valid URL'),
            }),
          },
        },
      } as Interaction);

      try {
        await axios.post(
          `http://localhost:1234/api/plugins/${pluginId}/install`,
          invalidConfig,
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: 'Bearer valid-jwt-token',
            },
          }
        );
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('validationErrors');
        expect(Array.isArray(error.response.data.validationErrors)).toBe(true);
      }
    });
  });

  describe('Plugin Uninstallation API', () => {
    it('should uninstall a plugin successfully', async () => {
      const pluginId = 'installed-plugin';

      await provider.addInteraction({
        state: `plugin ${pluginId} is installed`,
        uponReceiving: `a request to uninstall plugin ${pluginId}`,
        withRequest: {
          method: 'DELETE',
          path: `/api/plugins/${pluginId}/uninstall`,
          headers: {
            Accept: 'application/json',
            Authorization: term({
              matcher: '^Bearer .+$',
              generate: 'Bearer valid-jwt-token'
            }),
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: like(true),
            message: like('Plugin uninstalled successfully'),
            uninstallationId: uuid(),
          },
        },
      } as Interaction);

      const response = await axios.delete(
        `http://localhost:1234/api/plugins/${pluginId}/uninstall`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: 'Bearer valid-jwt-token',
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data).toHaveProperty('uninstallationId');
    });

    it('should reject uninstallation of plugin with dependencies', async () => {
      const pluginId = 'base-plugin-with-dependents';

      await provider.addInteraction({
        state: `plugin ${pluginId} has dependent plugins`,
        uponReceiving: `a request to uninstall plugin ${pluginId} with dependencies`,
        withRequest: {
          method: 'DELETE',
          path: `/api/plugins/${pluginId}/uninstall`,
          headers: {
            Accept: 'application/json',
            Authorization: term({
              matcher: '^Bearer .+$',
              generate: 'Bearer valid-jwt-token'
            }),
          },
        },
        willRespondWith: {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: like('Cannot uninstall plugin with dependencies'),
            message: like('This plugin is required by other installed plugins'),
            statusCode: like(400),
            dependentPlugins: eachLike({
              id: like('dependent-plugin'),
              name: like('Dependent Plugin'),
            }),
          },
        },
      } as Interaction);

      try {
        await axios.delete(
          `http://localhost:1234/api/plugins/${pluginId}/uninstall`,
          {
            headers: {
              Accept: 'application/json',
              Authorization: 'Bearer valid-jwt-token',
            },
          }
        );
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data).toHaveProperty('dependentPlugins');
        expect(Array.isArray(error.response.data.dependentPlugins)).toBe(true);
      }
    });
  });

  describe('Plugin Configuration API', () => {
    it('should get plugin configuration', async () => {
      const pluginId = 'configured-plugin';

      await provider.addInteraction({
        state: `plugin ${pluginId} is installed with configuration`,
        uponReceiving: `a request for plugin ${pluginId} configuration`,
        withRequest: {
          method: 'GET',
          path: `/api/plugins/${pluginId}/config`,
          headers: {
            Accept: 'application/json',
            Authorization: term({
              matcher: '^Bearer .+$',
              generate: 'Bearer valid-jwt-token'
            }),
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            config: {
              apiUrl: like('https://api.example.com'),
              timeout: like(5000),
              enableLogging: like(true),
            },
            schema: {
              type: like('object'),
              properties: {
                apiUrl: {
                  type: like('string'),
                  format: like('uri'),
                },
                timeout: {
                  type: like('number'),
                  minimum: like(1000),
                },
                enableLogging: {
                  type: like('boolean'),
                },
              },
              required: eachLike('apiUrl'),
            },
            lastUpdated: like('2024-01-15T10:00:00Z'),
          },
        },
      } as Interaction);

      const response = await axios.get(
        `http://localhost:1234/api/plugins/${pluginId}/config`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: 'Bearer valid-jwt-token',
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('config');
      expect(response.data).toHaveProperty('schema');
      expect(response.data.config).toHaveProperty('apiUrl');
    });

    it('should update plugin configuration', async () => {
      const pluginId = 'configurable-plugin';
      const newConfig = {
        config: {
          apiUrl: 'https://new-api.example.com',
          timeout: 10000,
          enableLogging: false,
        },
      };

      await provider.addInteraction({
        state: `plugin ${pluginId} is installed`,
        uponReceiving: `a request to update plugin ${pluginId} configuration`,
        withRequest: {
          method: 'PUT',
          path: `/api/plugins/${pluginId}/config`,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: term({
              matcher: '^Bearer .+$',
              generate: 'Bearer valid-jwt-token'
            }),
          },
          body: newConfig,
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            success: like(true),
            message: like('Configuration updated successfully'),
            config: newConfig.config,
            requiresRestart: like(true),
          },
        },
      } as Interaction);

      const response = await axios.put(
        `http://localhost:1234/api/plugins/${pluginId}/config`,
        newConfig,
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer valid-jwt-token',
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.config).toEqual(newConfig.config);
    });
  });

  describe('Plugin Health API', () => {
    it('should get plugin health status', async () => {
      const pluginId = 'running-plugin';

      await provider.addInteraction({
        state: `plugin ${pluginId} is running`,
        uponReceiving: `a request for plugin ${pluginId} health status`,
        withRequest: {
          method: 'GET',
          path: `/api/plugins/${pluginId}/health`,
          headers: {
            Accept: 'application/json',
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            status: term({
              matcher: '^(healthy|unhealthy|starting|stopped)$',
              generate: 'healthy'
            }),
            uptime: like(3600),
            lastCheck: like('2024-01-15T10:00:00Z'),
            metrics: {
              memoryUsage: like(128),
              cpuUsage: like(15.5),
              responseTime: like(45),
              errorRate: like(0.1),
            },
            checks: eachLike({
              name: like('database-connection'),
              status: like('passing'),
              message: like('Database connection is healthy'),
            }),
          },
        },
      } as Interaction);

      const response = await axios.get(
        `http://localhost:1234/api/plugins/${pluginId}/health`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
      expect(response.data).toHaveProperty('metrics');
      expect(['healthy', 'unhealthy', 'starting', 'stopped']).toContain(response.data.status);
    });

    it('should get unhealthy plugin status', async () => {
      const pluginId = 'unhealthy-plugin';

      await provider.addInteraction({
        state: `plugin ${pluginId} is unhealthy`,
        uponReceiving: `a request for unhealthy plugin ${pluginId} health status`,
        withRequest: {
          method: 'GET',
          path: `/api/plugins/${pluginId}/health`,
          headers: {
            Accept: 'application/json',
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            status: like('unhealthy'),
            uptime: like(1800),
            lastCheck: like('2024-01-15T10:00:00Z'),
            error: like('Database connection failed'),
            metrics: {
              memoryUsage: like(512),
              cpuUsage: like(85.2),
              responseTime: like(2500),
              errorRate: like(25.5),
            },
            checks: eachLike({
              name: like('database-connection'),
              status: like('failing'),
              message: like('Connection timeout after 5 seconds'),
            }),
          },
        },
      } as Interaction);

      const response = await axios.get(
        `http://localhost:1234/api/plugins/${pluginId}/health`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('unhealthy');
      expect(response.data).toHaveProperty('error');
    });
  });

  describe('Plugin Categories API', () => {
    it('should get available plugin categories', async () => {
      await provider.addInteraction({
        state: 'categories exist',
        uponReceiving: 'a request for plugin categories',
        withRequest: {
          method: 'GET',
          path: '/api/plugins/categories',
          headers: {
            Accept: 'application/json',
          },
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            categories: eachLike({
              name: like('Documentation'),
              count: like(5),
              description: like('Tools for creating and managing documentation'),
            }),
          },
        },
      } as Interaction);

      const response = await axios.get('http://localhost:1234/api/plugins/categories', {
        headers: { Accept: 'application/json' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('categories');
      expect(Array.isArray(response.data.categories)).toBe(true);
      expect(response.data.categories[0]).toHaveProperty('name');
      expect(response.data.categories[0]).toHaveProperty('count');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should reject requests without authentication', async () => {
      const pluginId = 'secure-plugin';

      await provider.addInteraction({
        state: 'user is not authenticated',
        uponReceiving: 'a request to install plugin without authentication',
        withRequest: {
          method: 'POST',
          path: `/api/plugins/${pluginId}/install`,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: {
            config: {},
          },
        },
        willRespondWith: {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: like('Unauthorized'),
            message: like('Authentication required'),
            statusCode: like(401),
          },
        },
      } as Interaction);

      try {
        await axios.post(
          `http://localhost:1234/api/plugins/${pluginId}/install`,
          { config: {} },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          }
        );
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.error).toBe('Unauthorized');
      }
    });

    it('should reject requests with insufficient permissions', async () => {
      const pluginId = 'admin-only-plugin';

      await provider.addInteraction({
        state: 'user does not have admin permissions',
        uponReceiving: 'a request to install admin plugin with insufficient permissions',
        withRequest: {
          method: 'POST',
          path: `/api/plugins/${pluginId}/install`,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: term({
              matcher: '^Bearer .+$',
              generate: 'Bearer user-jwt-token'
            }),
          },
          body: {
            config: {},
          },
        },
        willRespondWith: {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: like('Forbidden'),
            message: like('Insufficient permissions'),
            statusCode: like(403),
            requiredPermission: like('plugin:install:admin'),
          },
        },
      } as Interaction);

      try {
        await axios.post(
          `http://localhost:1234/api/plugins/${pluginId}/install`,
          { config: {} },
          {
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: 'Bearer user-jwt-token',
            },
          }
        );
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.response.status).toBe(403);
        expect(error.response.data).toHaveProperty('requiredPermission');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      await provider.addInteraction({
        state: 'server error occurs',
        uponReceiving: 'a request that causes server error',
        withRequest: {
          method: 'GET',
          path: '/api/plugins/server-error-plugin',
          headers: {
            Accept: 'application/json',
          },
        },
        willRespondWith: {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            error: like('Internal Server Error'),
            message: like('An unexpected error occurred'),
            statusCode: like(500),
            timestamp: like('2024-01-15T10:00:00Z'),
            requestId: uuid(),
          },
        },
      } as Interaction);

      try {
        await axios.get('http://localhost:1234/api/plugins/server-error-plugin', {
          headers: { Accept: 'application/json' },
        });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.response.status).toBe(500);
        expect(error.response.data).toHaveProperty('error');
        expect(error.response.data).toHaveProperty('requestId');
      }
    });
  });
});