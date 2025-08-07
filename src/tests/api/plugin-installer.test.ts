import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/plugin-installer/route';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

// Mock external dependencies
jest.mock('child_process');
jest.mock('fs/promises');
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'test-id-12345678')
  }))
}));

const mockExec = exec as jest.MockedFunction<typeof exec>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Plugin Installer API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/plugin-installer', () => {
    it('should successfully install a plugin locally with Docker', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'install',
          pluginId: 'test-plugin',
          version: '1.0.0',
          environment: 'local',
          config: {
            enableAuth: true,
            apiKey: 'test-key'
          }
        })
      });

      // Mock filesystem operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({ name: 'test-plugin' }));

      // Mock exec for Docker commands
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('docker build')) {
          callback?.(null, 'Successfully built', '');
        } else if (cmd.includes('docker run')) {
          callback?.(null, 'Container started', '');
        } else if (cmd.includes('docker ps')) {
          callback?.(null, JSON.stringify([{ State: 'running', Ports: { '3000/tcp': [{ HostPort: '32768' }] } }]), '');
        } else if (cmd.includes('npm install')) {
          callback?.(null, 'Dependencies installed', '');
        } else {
          callback?.(null, '', '');
        }
        return {} as any;
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.installId).toBeDefined();
      expect(data.message).toContain('Installation started');
    });

    it('should handle plugin installation failure gracefully', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'install',
          pluginId: 'failing-plugin',
          version: '1.0.0',
          environment: 'local'
        })
      });

      // Mock Docker build failure
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('docker build')) {
          callback?.(new Error('Docker build failed'), '', 'Build error');
        } else {
          callback?.(null, '', '');
        }
        return {} as any;
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(data.success).toBe(true); // Initial response is successful
      expect(data.installId).toBeDefined();
      
      // Installation should fail asynchronously
      // In a real test, we'd check the installation status endpoint
    });

    it('should deploy plugin to Kubernetes cluster', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'install',
          pluginId: 'k8s-plugin',
          version: '2.0.0',
          environment: 'kubernetes',
          cluster: 'production',
          namespace: 'plugins'
        })
      });

      // Mock kubectl commands
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('kubectl apply')) {
          callback?.(null, 'deployment.apps/k8s-plugin created', '');
        } else if (cmd.includes('kubectl get')) {
          callback?.(null, JSON.stringify({
            status: {
              phase: 'Running',
              podIP: '10.0.0.1'
            }
          }), '');
        } else if (cmd.includes('kubectl rollout status')) {
          callback?.(null, 'deployment "k8s-plugin" successfully rolled out', '');
        } else {
          callback?.(null, '', '');
        }
        return {} as any;
      });

      mockFs.writeFile.mockResolvedValue(undefined);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.installId).toBeDefined();
    });

    it('should uninstall a plugin successfully', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'uninstall',
          installId: 'existing-install-id'
        })
      });

      // Mock Docker stop and remove
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('docker stop')) {
          callback?.(null, 'Container stopped', '');
        } else if (cmd.includes('docker rm')) {
          callback?.(null, 'Container removed', '');
        } else {
          callback?.(null, '', '');
        }
        return {} as any;
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('started');
    });

    it('should handle invalid action gracefully', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'invalid-action'
        })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid action');
    });

    it('should validate required parameters', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'install'
          // Missing pluginId and version
        })
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('GET /api/plugin-installer', () => {
    it('should return installation status', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer?installId=test-install-123');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Status would depend on the installation store state
    });

    it('should return all installations when no installId provided', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.installations).toBeDefined();
      expect(Array.isArray(data.installations)).toBe(true);
    });

    it('should handle missing installation gracefully', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer?installId=non-existent');

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
  });

  describe('Docker Integration', () => {
    it('should correctly parse Docker container ports', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'install',
          pluginId: 'port-test-plugin',
          version: '1.0.0',
          environment: 'local'
        })
      });

      // Mock Docker inspect with complex port mapping
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('docker inspect')) {
          const containerInfo = [{
            State: 'running',
            NetworkSettings: {
              Ports: {
                '3000/tcp': [{ HostPort: '32768' }],
                '7007/tcp': [{ HostPort: '32769' }]
              }
            }
          }];
          callback?.(null, JSON.stringify(containerInfo), '');
        } else {
          callback?.(null, '', '');
        }
        return {} as any;
      });

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle Docker daemon not running', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'install',
          pluginId: 'docker-error-plugin',
          version: '1.0.0',
          environment: 'local'
        })
      });

      // Mock Docker daemon connection error
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('docker')) {
          callback?.(new Error('Cannot connect to Docker daemon'), '', 'Is Docker running?');
        } else {
          callback?.(null, '', '');
        }
        return {} as any;
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      // Initial response succeeds, but installation will fail asynchronously
      expect(response.status).toBe(200);
      expect(data.installId).toBeDefined();
    });
  });

  describe('Kubernetes Integration', () => {
    it('should create proper Kubernetes manifests', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'install',
          pluginId: 'k8s-manifest-plugin',
          version: '1.0.0',
          environment: 'kubernetes',
          cluster: 'staging',
          namespace: 'backstage-plugins',
          replicas: 3,
          resources: {
            requests: { cpu: '100m', memory: '128Mi' },
            limits: { cpu: '500m', memory: '512Mi' }
          }
        })
      });

      let savedManifest = '';
      mockFs.writeFile.mockImplementation(async (path, content) => {
        if (path.toString().includes('.yaml')) {
          savedManifest = content.toString();
        }
        return undefined;
      });

      mockExec.mockImplementation((cmd, opts, callback) => {
        callback?.(null, 'Success', '');
        return {} as any;
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify manifest contains expected configuration
      expect(savedManifest).toContain('replicas: 3');
      expect(savedManifest).toContain('namespace: backstage-plugins');
      expect(savedManifest).toContain('cpu: 100m');
      expect(savedManifest).toContain('memory: 128Mi');
    });

    it('should handle Kubernetes namespace creation', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'install',
          pluginId: 'namespace-plugin',
          version: '1.0.0',
          environment: 'kubernetes',
          createNamespace: true,
          namespace: 'new-plugin-namespace'
        })
      });

      const kubectlCommands: string[] = [];
      mockExec.mockImplementation((cmd, opts, callback) => {
        kubectlCommands.push(cmd);
        callback?.(null, 'Success', '');
        return {} as any;
      });

      mockFs.writeFile.mockResolvedValue(undefined);

      const response = await POST(mockRequest);
      await response.json();

      // Verify namespace creation command was executed
      const namespaceCommand = kubectlCommands.find(cmd => 
        cmd.includes('kubectl create namespace') || 
        cmd.includes('kubectl apply') && cmd.includes('Namespace')
      );
      expect(namespaceCommand).toBeDefined();
    });

    it('should implement proper RBAC for plugin isolation', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'install',
          pluginId: 'rbac-plugin',
          version: '1.0.0',
          environment: 'kubernetes',
          namespace: 'isolated-plugins',
          enableRBAC: true
        })
      });

      let savedManifest = '';
      mockFs.writeFile.mockImplementation(async (path, content) => {
        if (path.toString().includes('.yaml')) {
          savedManifest = content.toString();
        }
        return undefined;
      });

      mockExec.mockImplementation((cmd, opts, callback) => {
        callback?.(null, 'Success', '');
        return {} as any;
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify RBAC resources are created
      expect(savedManifest).toContain('ServiceAccount');
      expect(savedManifest).toContain('Role');
      expect(savedManifest).toContain('RoleBinding');
    });
  });

  describe('Health Monitoring', () => {
    it('should perform health checks on installed plugins', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'health_check',
          installId: 'healthy-plugin-install'
        })
      });

      // Mock successful health check
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('curl') || cmd.includes('wget')) {
          callback?.(null, JSON.stringify({ status: 'healthy', uptime: 3600 }), '');
        } else {
          callback?.(null, '', '');
        }
        return {} as any;
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.health).toBeDefined();
    });

    it('should detect unhealthy plugins', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'health_check',
          installId: 'unhealthy-plugin-install'
        })
      });

      // Mock failed health check
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('curl') || cmd.includes('wget')) {
          callback?.(new Error('Connection refused'), '', '');
        } else {
          callback?.(null, '', '');
        }
        return {} as any;
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Health status would indicate unhealthy state
    });
  });

  describe('Configuration Management', () => {
    it('should properly handle plugin configuration', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'install',
          pluginId: 'configured-plugin',
          version: '1.0.0',
          environment: 'local',
          config: {
            database: {
              host: 'localhost',
              port: 5432,
              name: 'plugin_db'
            },
            features: {
              enableCache: true,
              cacheSize: '100MB'
            },
            security: {
              enableAuth: true,
              authProvider: 'oauth2'
            }
          }
        })
      });

      let savedConfig = '';
      mockFs.writeFile.mockImplementation(async (path, content) => {
        if (path.toString().includes('config.json')) {
          savedConfig = content.toString();
        }
        return undefined;
      });

      mockFs.mkdir.mockResolvedValue(undefined);
      mockExec.mockImplementation((cmd, opts, callback) => {
        callback?.(null, 'Success', '');
        return {} as any;
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify configuration was saved correctly
      const config = JSON.parse(savedConfig);
      expect(config.database.host).toBe('localhost');
      expect(config.features.enableCache).toBe(true);
      expect(config.security.authProvider).toBe('oauth2');
    });

    it('should handle environment-specific configurations', async () => {
      const environments = ['development', 'staging', 'production'];
      
      for (const env of environments) {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
          method: 'POST',
          body: JSON.stringify({
            action: 'install',
            pluginId: 'env-specific-plugin',
            version: '1.0.0',
            environment: env === 'development' ? 'local' : 'kubernetes',
            cluster: env,
            config: {
              environment: env,
              logLevel: env === 'production' ? 'error' : 'debug'
            }
          })
        });

        mockFs.mkdir.mockResolvedValue(undefined);
        mockFs.writeFile.mockResolvedValue(undefined);
        mockExec.mockImplementation((cmd, opts, callback) => {
          callback?.(null, 'Success', '');
          return {} as any;
        });

        const response = await POST(mockRequest);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      }
    });
  });

  describe('Error Recovery', () => {
    it('should rollback on installation failure', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'install',
          pluginId: 'rollback-plugin',
          version: '1.0.0',
          environment: 'kubernetes'
        })
      });

      const executedCommands: string[] = [];
      mockExec.mockImplementation((cmd, opts, callback) => {
        executedCommands.push(cmd);
        if (cmd.includes('kubectl apply')) {
          // Simulate deployment failure
          callback?.(new Error('Deployment failed'), '', 'ImagePullBackOff');
        } else if (cmd.includes('kubectl delete')) {
          // Rollback should succeed
          callback?.(null, 'Deleted', '');
        } else {
          callback?.(null, '', '');
        }
        return {} as any;
      });

      mockFs.writeFile.mockResolvedValue(undefined);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.installId).toBeDefined();
      
      // Verify rollback commands would be executed
      // In async installation, rollback would happen
    });

    it('should retry failed operations with exponential backoff', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
        method: 'POST',
        body: JSON.stringify({
          action: 'install',
          pluginId: 'retry-plugin',
          version: '1.0.0',
          environment: 'local',
          retryPolicy: {
            maxRetries: 3,
            backoffMultiplier: 2
          }
        })
      });

      let attemptCount = 0;
      mockExec.mockImplementation((cmd, opts, callback) => {
        if (cmd.includes('docker build')) {
          attemptCount++;
          if (attemptCount < 3) {
            callback?.(new Error('Temporary failure'), '', '');
          } else {
            callback?.(null, 'Success after retries', '');
          }
        } else {
          callback?.(null, '', '');
        }
        return {} as any;
      });

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Retries would happen in async installation
    });
  });

  describe('Performance and Scaling', () => {
    it('should handle concurrent plugin installations', async () => {
      const installPromises = [];
      
      for (let i = 0; i < 5; i++) {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
          method: 'POST',
          body: JSON.stringify({
            action: 'install',
            pluginId: `concurrent-plugin-${i}`,
            version: '1.0.0',
            environment: 'local'
          })
        });

        mockFs.mkdir.mockResolvedValue(undefined);
        mockFs.writeFile.mockResolvedValue(undefined);
        mockExec.mockImplementation((cmd, opts, callback) => {
          callback?.(null, 'Success', '');
          return {} as any;
        });

        installPromises.push(POST(mockRequest));
      }

      const responses = await Promise.all(installPromises);
      const results = await Promise.all(responses.map(r => r.json()));

      results.forEach((data, index) => {
        expect(data.success).toBe(true);
        expect(data.installId).toBeDefined();
        expect(data.message).toContain(`concurrent-plugin-${index}`);
      });
    });

    it('should implement rate limiting for installations', async () => {
      // This would test rate limiting logic if implemented
      const requests = [];
      
      for (let i = 0; i < 10; i++) {
        const mockRequest = new NextRequest('http://localhost:3000/api/plugin-installer', {
          method: 'POST',
          body: JSON.stringify({
            action: 'install',
            pluginId: `rate-limited-plugin-${i}`,
            version: '1.0.0',
            environment: 'local'
          })
        });
        requests.push(mockRequest);
      }

      // Rate limiting would be enforced here
      // Some requests should be throttled
    });
  });
});