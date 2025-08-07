import { describe, it, expect, beforeAll, afterEach, afterAll } from '@jest/globals';
import axios from 'axios';
import { Pact } from '@pact-foundation/pact';
import { join } from 'path';

// Example consumer test using the contract testing framework
describe('Backstage Catalog Consumer', () => {
  const pact = new Pact({
    consumer: 'backstage-portal',
    provider: 'catalog-service',
    port: 3001,
    log: join(__dirname, '../../logs/pact.log'),
    dir: join(__dirname, '../../pacts'),
    spec: 2,
    logLevel: 'info'
  });

  beforeAll(async () => {
    await pact.setup();
  });

  afterEach(async () => {
    await pact.verify();
  });

  afterAll(async () => {
    await pact.finalize();
  });

  describe('GET /entities', () => {
    it('should return a list of entities', async () => {
      // Arrange
      await pact.addInteraction({
        state: 'there are entities in the catalog',
        uponReceiving: 'a request to get all entities',
        withRequest: {
          method: 'GET',
          path: '/entities',
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer valid-token'
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            entities: [
              {
                apiVersion: 'backstage.io/v1alpha1',
                kind: 'Component',
                metadata: {
                  name: 'example-service',
                  namespace: 'default',
                  title: 'Example Service',
                  description: 'An example microservice'
                },
                spec: {
                  type: 'service',
                  owner: 'platform-team',
                  lifecycle: 'production'
                }
              }
            ],
            totalCount: 1
          }
        }
      });

      // Act
      const response = await axios.get('http://localhost:3001/entities', {
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer valid-token'
        }
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('entities');
      expect(response.data.entities).toHaveLength(1);
      expect(response.data.entities[0]).toMatchObject({
        kind: 'Component',
        metadata: {
          name: 'example-service'
        }
      });
    });

    it('should handle unauthorized requests', async () => {
      // Arrange
      await pact.addInteraction({
        uponReceiving: 'an unauthorized request to get entities',
        withRequest: {
          method: 'GET',
          path: '/entities',
          headers: {
            'Accept': 'application/json'
            // No Authorization header
          }
        },
        willRespondWith: {
          status: 401,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            error: 'Unauthorized',
            message: 'Authentication required'
          }
        }
      });

      // Act
      try {
        await axios.get('http://localhost:3001/entities', {
          headers: {
            'Accept': 'application/json'
          },
          validateStatus: () => true
        });
      } catch (error: any) {
        // Assert
        expect(error.response.status).toBe(401);
        expect(error.response.data).toMatchObject({
          error: 'Unauthorized'
        });
      }
    });

    it('should filter entities by kind', async () => {
      // Arrange
      await pact.addInteraction({
        state: 'there are different types of entities',
        uponReceiving: 'a request to get entities filtered by kind',
        withRequest: {
          method: 'GET',
          path: '/entities',
          query: {
            'filter': 'kind=Component'
          },
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer valid-token'
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            entities: [
              {
                apiVersion: 'backstage.io/v1alpha1',
                kind: 'Component',
                metadata: {
                  name: 'component-service',
                  namespace: 'default'
                },
                spec: {
                  type: 'service',
                  owner: 'team-a'
                }
              }
            ],
            totalCount: 1
          }
        }
      });

      // Act
      const response = await axios.get('http://localhost:3001/entities', {
        params: {
          filter: 'kind=Component'
        },
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer valid-token'
        }
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.data.entities).toHaveLength(1);
      expect(response.data.entities[0].kind).toBe('Component');
    });
  });

  describe('POST /entities', () => {
    it('should create a new entity', async () => {
      // Arrange
      const newEntity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        metadata: {
          name: 'new-service',
          namespace: 'default',
          title: 'New Service'
        },
        spec: {
          type: 'service',
          owner: 'platform-team',
          lifecycle: 'experimental'
        }
      };

      await pact.addInteraction({
        state: 'the system is ready to accept new entities',
        uponReceiving: 'a request to create a new entity',
        withRequest: {
          method: 'POST',
          path: '/entities',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer valid-token'
          },
          body: newEntity
        },
        willRespondWith: {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
            'Location': '/entities/default/component/new-service'
          },
          body: {
            ...newEntity,
            metadata: {
              ...newEntity.metadata,
              uid: '123e4567-e89b-12d3-a456-426614174000',
              resourceVersion: '1',
              generation: 1,
              creationTimestamp: '2023-01-01T00:00:00Z'
            }
          }
        }
      });

      // Act
      const response = await axios.post('http://localhost:3001/entities', newEntity, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer valid-token'
        }
      });

      // Assert
      expect(response.status).toBe(201);
      expect(response.headers.location).toBe('/entities/default/component/new-service');
      expect(response.data.metadata).toHaveProperty('uid');
      expect(response.data.metadata.name).toBe('new-service');
    });

    it('should reject invalid entity data', async () => {
      // Arrange
      const invalidEntity = {
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Component',
        // Missing required metadata
        spec: {
          type: 'service'
        }
      };

      await pact.addInteraction({
        uponReceiving: 'a request to create an invalid entity',
        withRequest: {
          method: 'POST',
          path: '/entities',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer valid-token'
          },
          body: invalidEntity
        },
        willRespondWith: {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            error: 'Bad Request',
            message: 'Invalid entity data',
            details: [
              'metadata.name is required',
              'metadata.namespace is required'
            ]
          }
        }
      });

      // Act & Assert
      try {
        await axios.post('http://localhost:3001/entities', invalidEntity, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer valid-token'
          },
          validateStatus: () => true
        });
      } catch (error: any) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.error).toBe('Bad Request');
        expect(error.response.data.details).toContain('metadata.name is required');
      }
    });
  });

  describe('GET /entities/:namespace/:kind/:name', () => {
    it('should return a specific entity', async () => {
      // Arrange
      await pact.addInteraction({
        state: 'entity default/component/example-service exists',
        uponReceiving: 'a request to get a specific entity',
        withRequest: {
          method: 'GET',
          path: '/entities/default/component/example-service',
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer valid-token'
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'ETag': '"123"'
          },
          body: {
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Component',
            metadata: {
              name: 'example-service',
              namespace: 'default',
              uid: '123e4567-e89b-12d3-a456-426614174000',
              title: 'Example Service',
              description: 'An example microservice'
            },
            spec: {
              type: 'service',
              owner: 'platform-team',
              lifecycle: 'production'
            },
            relations: [
              {
                type: 'ownedBy',
                targetRef: 'group:default/platform-team'
              }
            ]
          }
        }
      });

      // Act
      const response = await axios.get('http://localhost:3001/entities/default/component/example-service', {
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer valid-token'
        }
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.headers.etag).toBe('"123"');
      expect(response.data.metadata.name).toBe('example-service');
      expect(response.data.spec.owner).toBe('platform-team');
      expect(response.data.relations).toHaveLength(1);
    });

    it('should return 404 for non-existent entity', async () => {
      // Arrange
      await pact.addInteraction({
        uponReceiving: 'a request to get a non-existent entity',
        withRequest: {
          method: 'GET',
          path: '/entities/default/component/non-existent',
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer valid-token'
          }
        },
        willRespondWith: {
          status: 404,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            error: 'Not Found',
            message: 'Entity not found'
          }
        }
      });

      // Act & Assert
      try {
        await axios.get('http://localhost:3001/entities/default/component/non-existent', {
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer valid-token'
          },
          validateStatus: () => true
        });
      } catch (error: any) {
        expect(error.response.status).toBe(404);
        expect(error.response.data.error).toBe('Not Found');
      }
    });
  });

  describe('DELETE /entities/:namespace/:kind/:name', () => {
    it('should delete an existing entity', async () => {
      // Arrange
      await pact.addInteraction({
        state: 'entity default/component/example-service exists and can be deleted',
        uponReceiving: 'a request to delete an entity',
        withRequest: {
          method: 'DELETE',
          path: '/entities/default/component/example-service',
          headers: {
            'Authorization': 'Bearer valid-token'
          }
        },
        willRespondWith: {
          status: 204,
          headers: {}
        }
      });

      // Act
      const response = await axios.delete('http://localhost:3001/entities/default/component/example-service', {
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      });

      // Assert
      expect(response.status).toBe(204);
    });

    it('should return 403 when deletion is not allowed', async () => {
      // Arrange
      await pact.addInteraction({
        state: 'entity default/component/protected-service exists but cannot be deleted',
        uponReceiving: 'a request to delete a protected entity',
        withRequest: {
          method: 'DELETE',
          path: '/entities/default/component/protected-service',
          headers: {
            'Authorization': 'Bearer valid-token'
          }
        },
        willRespondWith: {
          status: 403,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            error: 'Forbidden',
            message: 'Entity deletion not allowed',
            reason: 'Entity is referenced by other entities'
          }
        }
      });

      // Act & Assert
      try {
        await axios.delete('http://localhost:3001/entities/default/component/protected-service', {
          headers: {
            'Authorization': 'Bearer valid-token'
          },
          validateStatus: () => true
        });
      } catch (error: any) {
        expect(error.response.status).toBe(403);
        expect(error.response.data.error).toBe('Forbidden');
      }
    });
  });
});

// Test with provider state setup
describe('Catalog Consumer with State Setup', () => {
  const pact = new Pact({
    consumer: 'backstage-portal',
    provider: 'catalog-service',
    port: 3002,
    log: join(__dirname, '../../logs/pact-state.log'),
    dir: join(__dirname, '../../pacts'),
    spec: 2,
    logLevel: 'info'
  });

  beforeAll(async () => {
    await pact.setup();
  });

  afterEach(async () => {
    await pact.verify();
  });

  afterAll(async () => {
    await pact.finalize();
  });

  it('should handle complex entity relationships', async () => {
    await pact.addInteraction({
      state: 'there is a system with multiple components',
      stateParams: {
        systemName: 'payment-system',
        componentCount: 3
      },
      uponReceiving: 'a request to get system components',
      withRequest: {
        method: 'GET',
        path: '/entities',
        query: {
          'filter': 'spec.system=payment-system,kind=Component'
        },
        headers: {
          'Accept': 'application/json',
          'Authorization': 'Bearer valid-token'
        }
      },
      willRespondWith: {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          entities: [
            {
              kind: 'Component',
              metadata: { name: 'payment-api' },
              spec: { type: 'service', system: 'payment-system' }
            },
            {
              kind: 'Component',
              metadata: { name: 'payment-processor' },
              spec: { type: 'service', system: 'payment-system' }
            },
            {
              kind: 'Component',
              metadata: { name: 'payment-ui' },
              spec: { type: 'website', system: 'payment-system' }
            }
          ],
          totalCount: 3
        }
      }
    });

    const response = await axios.get('http://localhost:3002/entities', {
      params: {
        filter: 'spec.system=payment-system,kind=Component'
      },
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer valid-token'
      }
    });

    expect(response.status).toBe(200);
    expect(response.data.entities).toHaveLength(3);
    expect(response.data.entities.every((e: any) => e.spec.system === 'payment-system')).toBe(true);
  });
});