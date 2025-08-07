import { PluginInstaller } from '../plugin-installer';
import { DockerService } from '../docker-plugin-installer';
import { KubernetesService } from '../../kubernetes/client';
import { VaultService } from '../../vault/vault-client';
import { NotificationService } from '../../notifications/service';

// Mock dependencies
jest.mock('../docker-plugin-installer');
jest.mock('../../kubernetes/client');
jest.mock('../../vault/vault-client');
jest.mock('../../notifications/service');

const mockDockerService = DockerService as jest.MockedClass<typeof DockerService>;
const mockKubernetesService = KubernetesService as jest.MockedClass<typeof KubernetesService>;
const mockVaultService = VaultService as jest.MockedClass<typeof VaultService>;
const mockNotificationService = NotificationService as jest.MockedClass<typeof NotificationService>;

describe('PluginInstaller', () => {
  let installer: PluginInstaller;
  let mockDockerInstance: jest.Mocked<DockerService>;
  let mockK8sInstance: jest.Mocked<KubernetesService>;
  let mockVaultInstance: jest.Mocked<VaultService>;
  let mockNotificationInstance: jest.Mocked<NotificationService>;

  beforeEach(() => {
    // Setup mock instances
    mockDockerInstance = {
      pullImage: jest.fn(),
      createContainer: jest.fn(),
      startContainer: jest.fn(),
      stopContainer: jest.fn(),
      removeContainer: jest.fn(),
      getContainerLogs: jest.fn(),
      inspectContainer: jest.fn(),
      listContainers: jest.fn(),
      buildImage: jest.fn(),
      createNetwork: jest.fn(),
      createVolume: jest.fn(),
      cleanup: jest.fn(),
    } as any;

    mockK8sInstance = {
      createNamespace: jest.fn(),
      createDeployment: jest.fn(),
      createService: jest.fn(),
      createConfigMap: jest.fn(),
      createSecret: jest.fn(),
      deleteResource: jest.fn(),
      getResource: jest.fn(),
      listResources: jest.fn(),
      updateResource: jest.fn(),
      watchResource: jest.fn(),
      applyManifest: jest.fn(),
      getClusterInfo: jest.fn(),
    } as any;

    mockVaultInstance = {
      getSecret: jest.fn(),
      setSecret: jest.fn(),
      deleteSecret: jest.fn(),
      listSecrets: jest.fn(),
      createPolicy: jest.fn(),
      createRole: jest.fn(),
      generateToken: jest.fn(),
      renewToken: jest.fn(),
      revokeToken: jest.fn(),
    } as any;

    mockNotificationInstance = {
      sendNotification: jest.fn(),
      broadcastNotification: jest.fn(),
      createChannel: jest.fn(),
      subscribeToChannel: jest.fn(),
    } as any;

    // Mock constructors
    mockDockerService.mockImplementation(() => mockDockerInstance);
    mockKubernetesService.mockImplementation(() => mockK8sInstance);
    mockVaultService.mockImplementation(() => mockVaultInstance);
    mockNotificationService.mockImplementation(() => mockNotificationInstance);

    installer = new PluginInstaller();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Plugin Installation', () => {
    const mockPlugin = createMockPlugin({
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      deployment: {
        type: 'docker',
        image: 'test/plugin:1.0.0',
        ports: [{ container: 3000, host: 8080 }],
        env: {
          NODE_ENV: 'production',
          API_URL: 'http://localhost:3001',
        },
      },
    });

    it('should install a Docker plugin successfully', async () => {
      // Mock successful Docker operations
      mockDockerInstance.pullImage.mockResolvedValue({ success: true });
      mockDockerInstance.createContainer.mockResolvedValue({
        id: 'container-123',
        name: 'test-plugin-container',
      });
      mockDockerInstance.startContainer.mockResolvedValue({ success: true });
      mockDockerInstance.inspectContainer.mockResolvedValue({
        State: { Status: 'running', Health: { Status: 'healthy' } },
      });

      const result = await installer.installPlugin(mockPlugin);

      expect(result.success).toBe(true);
      expect(result.containerId).toBe('container-123');
      expect(mockDockerInstance.pullImage).toHaveBeenCalledWith('test/plugin:1.0.0');
      expect(mockDockerInstance.createContainer).toHaveBeenCalledWith({
        image: 'test/plugin:1.0.0',
        name: expect.stringContaining('test-plugin'),
        env: mockPlugin.deployment.env,
        ports: mockPlugin.deployment.ports,
        labels: expect.objectContaining({
          'backstage.plugin.id': 'test-plugin',
          'backstage.plugin.version': '1.0.0',
        }),
      });
      expect(mockDockerInstance.startContainer).toHaveBeenCalledWith('container-123');
    });

    it('should install a Kubernetes plugin successfully', async () => {
      const k8sPlugin = createMockPlugin({
        id: 'k8s-plugin',
        deployment: {
          type: 'kubernetes',
          manifests: [
            {
              apiVersion: 'apps/v1',
              kind: 'Deployment',
              metadata: { name: 'k8s-plugin' },
              spec: {
                replicas: 2,
                selector: { matchLabels: { app: 'k8s-plugin' } },
                template: {
                  metadata: { labels: { app: 'k8s-plugin' } },
                  spec: {
                    containers: [{
                      name: 'plugin',
                      image: 'test/k8s-plugin:1.0.0',
                      ports: [{ containerPort: 3000 }],
                    }],
                  },
                },
              },
            },
          ],
        },
      });

      mockK8sInstance.createNamespace.mockResolvedValue({ success: true });
      mockK8sInstance.applyManifest.mockResolvedValue({ success: true });
      mockK8sInstance.getResource.mockResolvedValue({
        status: { readyReplicas: 2, replicas: 2 },
      });

      const result = await installer.installPlugin(k8sPlugin);

      expect(result.success).toBe(true);
      expect(mockK8sInstance.createNamespace).toHaveBeenCalledWith(
        expect.stringContaining('k8s-plugin')
      );
      expect(mockK8sInstance.applyManifest).toHaveBeenCalledWith(
        k8sPlugin.deployment.manifests[0],
        expect.any(String)
      );
    });

    it('should handle Docker installation failures', async () => {
      mockDockerInstance.pullImage.mockRejectedValue(
        new Error('Failed to pull image')
      );

      const result = await installer.installPlugin(mockPlugin);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to pull image');
      expect(mockNotificationInstance.sendNotification).toHaveBeenCalledWith({
        type: 'error',
        title: 'Plugin Installation Failed',
        message: expect.stringContaining('Failed to pull image'),
        pluginId: 'test-plugin',
      });
    });

    it('should handle Kubernetes installation failures', async () => {
      const k8sPlugin = createMockPlugin({
        deployment: { type: 'kubernetes', manifests: [] },
      });

      mockK8sInstance.createNamespace.mockRejectedValue(
        new Error('Namespace creation failed')
      );

      const result = await installer.installPlugin(k8sPlugin);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Namespace creation failed');
    });

    it('should validate plugin configuration before installation', async () => {
      const invalidPlugin = createMockPlugin({
        deployment: { type: 'docker' }, // Missing required image field
      });

      const result = await installer.installPlugin(invalidPlugin);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid plugin configuration');
    });

    it('should handle plugin dependencies', async () => {
      const dependentPlugin = createMockPlugin({
        id: 'dependent-plugin',
        dependencies: ['dependency-1', 'dependency-2'],
        deployment: { type: 'docker', image: 'test/dependent:1.0.0' },
      });

      // Mock dependency checks
      installer.isPluginInstalled = jest.fn()
        .mockResolvedValueOnce(true)  // dependency-1 is installed
        .mockResolvedValueOnce(false); // dependency-2 is not installed

      const result = await installer.installPlugin(dependentPlugin);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing dependencies: dependency-2');
    });

    it('should create plugin secrets in Vault', async () => {
      const pluginWithSecrets = createMockPlugin({
        secrets: {
          'database-password': 'secret-value',
          'api-key': 'another-secret',
        },
      });

      mockVaultInstance.setSecret.mockResolvedValue({ success: true });
      mockDockerInstance.pullImage.mockResolvedValue({ success: true });
      mockDockerInstance.createContainer.mockResolvedValue({ id: 'container-123' });
      mockDockerInstance.startContainer.mockResolvedValue({ success: true });
      mockDockerInstance.inspectContainer.mockResolvedValue({
        State: { Status: 'running' },
      });

      const result = await installer.installPlugin(pluginWithSecrets);

      expect(result.success).toBe(true);
      expect(mockVaultInstance.setSecret).toHaveBeenCalledTimes(2);
      expect(mockVaultInstance.setSecret).toHaveBeenCalledWith(
        expect.stringContaining('database-password'),
        'secret-value'
      );
      expect(mockVaultInstance.setSecret).toHaveBeenCalledWith(
        expect.stringContaining('api-key'),
        'another-secret'
      );
    });
  });

  describe('Plugin Uninstallation', () => {
    it('should uninstall a Docker plugin successfully', async () => {
      const installation = createMockPluginInstallation(
        createMockPlugin({ id: 'test-plugin' }),
        {
          containerId: 'container-123',
          type: 'docker',
        }
      );

      mockDockerInstance.stopContainer.mockResolvedValue({ success: true });
      mockDockerInstance.removeContainer.mockResolvedValue({ success: true });

      const result = await installer.uninstallPlugin('test-plugin');

      expect(result.success).toBe(true);
      expect(mockDockerInstance.stopContainer).toHaveBeenCalledWith('container-123');
      expect(mockDockerInstance.removeContainer).toHaveBeenCalledWith('container-123');
    });

    it('should uninstall a Kubernetes plugin successfully', async () => {
      const installation = createMockPluginInstallation(
        createMockPlugin({ id: 'k8s-plugin' }),
        {
          namespace: 'k8s-plugin-namespace',
          type: 'kubernetes',
        }
      );

      mockK8sInstance.deleteResource.mockResolvedValue({ success: true });

      const result = await installer.uninstallPlugin('k8s-plugin');

      expect(result.success).toBe(true);
      expect(mockK8sInstance.deleteResource).toHaveBeenCalledWith(
        'namespace',
        'k8s-plugin-namespace'
      );
    });

    it('should handle uninstallation of non-existent plugin', async () => {
      installer.getPluginInstallation = jest.fn().mockResolvedValue(null);

      const result = await installer.uninstallPlugin('non-existent-plugin');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Plugin not found');
    });

    it('should clean up plugin secrets during uninstallation', async () => {
      const installation = createMockPluginInstallation(
        createMockPlugin({
          id: 'plugin-with-secrets',
          secrets: { 'db-password': 'secret' },
        }),
        { containerId: 'container-123', type: 'docker' }
      );

      mockDockerInstance.stopContainer.mockResolvedValue({ success: true });
      mockDockerInstance.removeContainer.mockResolvedValue({ success: true });
      mockVaultInstance.deleteSecret.mockResolvedValue({ success: true });

      const result = await installer.uninstallPlugin('plugin-with-secrets');

      expect(result.success).toBe(true);
      expect(mockVaultInstance.deleteSecret).toHaveBeenCalledWith(
        expect.stringContaining('plugin-with-secrets/db-password')
      );
    });
  });

  describe('Plugin Updates', () => {
    it('should update a plugin to new version', async () => {
      const currentPlugin = createMockPlugin({
        id: 'update-test',
        version: '1.0.0',
      });

      const updatedPlugin = createMockPlugin({
        id: 'update-test',
        version: '1.1.0',
      });

      const installation = createMockPluginInstallation(currentPlugin, {
        containerId: 'container-123',
        type: 'docker',
      });

      // Mock successful update operations
      mockDockerInstance.pullImage.mockResolvedValue({ success: true });
      mockDockerInstance.stopContainer.mockResolvedValue({ success: true });
      mockDockerInstance.removeContainer.mockResolvedValue({ success: true });
      mockDockerInstance.createContainer.mockResolvedValue({
        id: 'container-456',
      });
      mockDockerInstance.startContainer.mockResolvedValue({ success: true });
      mockDockerInstance.inspectContainer.mockResolvedValue({
        State: { Status: 'running' },
      });

      const result = await installer.updatePlugin('update-test', updatedPlugin);

      expect(result.success).toBe(true);
      expect(result.newContainerId).toBe('container-456');
      expect(mockDockerInstance.stopContainer).toHaveBeenCalledWith('container-123');
      expect(mockDockerInstance.removeContainer).toHaveBeenCalledWith('container-123');
    });

    it('should rollback on update failure', async () => {
      const currentPlugin = createMockPlugin({ version: '1.0.0' });
      const updatedPlugin = createMockPlugin({ version: '1.1.0' });
      
      mockDockerInstance.pullImage.mockResolvedValue({ success: true });
      mockDockerInstance.stopContainer.mockResolvedValue({ success: true });
      mockDockerInstance.createContainer.mockRejectedValue(
        new Error('Failed to create new container')
      );
      mockDockerInstance.startContainer.mockResolvedValue({ success: true });

      const result = await installer.updatePlugin('rollback-test', updatedPlugin);

      expect(result.success).toBe(false);
      // Should attempt to restart old container
      expect(mockDockerInstance.startContainer).toHaveBeenCalled();
    });
  });

  describe('Plugin Health Monitoring', () => {
    it('should check plugin health for Docker containers', async () => {
      const pluginId = 'health-test';
      const installation = createMockPluginInstallation(
        createMockPlugin({ id: pluginId }),
        { containerId: 'container-123', type: 'docker' }
      );

      mockDockerInstance.inspectContainer.mockResolvedValue({
        State: {
          Status: 'running',
          Health: {
            Status: 'healthy',
            FailingStreak: 0,
          },
        },
      });

      const health = await installer.checkPluginHealth(pluginId);

      expect(health.status).toBe('healthy');
      expect(health.uptime).toBeGreaterThan(0);
      expect(mockDockerInstance.inspectContainer).toHaveBeenCalledWith('container-123');
    });

    it('should check plugin health for Kubernetes pods', async () => {
      const pluginId = 'k8s-health-test';
      const installation = createMockPluginInstallation(
        createMockPlugin({ id: pluginId }),
        { namespace: 'plugin-namespace', type: 'kubernetes' }
      );

      mockK8sInstance.getResource.mockResolvedValue({
        status: {
          phase: 'Running',
          conditions: [
            { type: 'Ready', status: 'True' },
            { type: 'Initialized', status: 'True' },
          ],
        },
      });

      const health = await installer.checkPluginHealth(pluginId);

      expect(health.status).toBe('healthy');
      expect(mockK8sInstance.getResource).toHaveBeenCalledWith(
        'pods',
        expect.any(String),
        'plugin-namespace'
      );
    });

    it('should detect unhealthy plugins', async () => {
      const pluginId = 'unhealthy-plugin';
      const installation = createMockPluginInstallation(
        createMockPlugin({ id: pluginId }),
        { containerId: 'container-456', type: 'docker' }
      );

      mockDockerInstance.inspectContainer.mockResolvedValue({
        State: {
          Status: 'exited',
          ExitCode: 1,
          Health: {
            Status: 'unhealthy',
            FailingStreak: 3,
          },
        },
      });

      const health = await installer.checkPluginHealth(pluginId);

      expect(health.status).toBe('unhealthy');
      expect(health.error).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    it('should validate plugin configuration schema', async () => {
      const pluginWithSchema = createMockPlugin({
        config: {
          required: true,
          schema: {
            type: 'object',
            properties: {
              apiUrl: { type: 'string', format: 'uri' },
              timeout: { type: 'number', minimum: 1000 },
            },
            required: ['apiUrl'],
          },
        },
      });

      const validConfig = {
        apiUrl: 'https://api.example.com',
        timeout: 5000,
      };

      const isValid = await installer.validatePluginConfig(
        pluginWithSchema,
        validConfig
      );

      expect(isValid.valid).toBe(true);
    });

    it('should reject invalid plugin configuration', async () => {
      const pluginWithSchema = createMockPlugin({
        config: {
          schema: {
            type: 'object',
            properties: {
              apiUrl: { type: 'string', format: 'uri' },
            },
            required: ['apiUrl'],
          },
        },
      });

      const invalidConfig = {
        apiUrl: 'not-a-valid-url',
      };

      const isValid = await installer.validatePluginConfig(
        pluginWithSchema,
        invalidConfig
      );

      expect(isValid.valid).toBe(false);
      expect(isValid.errors).toHaveLength(1);
      expect(isValid.errors[0]).toContain('format');
    });

    it('should apply configuration updates to running plugins', async () => {
      const pluginId = 'config-update-test';
      const installation = createMockPluginInstallation(
        createMockPlugin({ id: pluginId }),
        { containerId: 'container-789', type: 'docker' }
      );

      const newConfig = {
        debugMode: true,
        logLevel: 'debug',
      };

      mockDockerInstance.inspectContainer.mockResolvedValue({
        State: { Status: 'running' },
      });

      const result = await installer.updatePluginConfig(pluginId, newConfig);

      expect(result.success).toBe(true);
      // Should trigger container restart with new config
      expect(mockDockerInstance.stopContainer).toHaveBeenCalled();
      expect(mockDockerInstance.startContainer).toHaveBeenCalled();
    });
  });

  describe('Resource Management', () => {
    it('should enforce resource limits for Docker plugins', async () => {
      const resourceConstrainedPlugin = createMockPlugin({
        deployment: {
          type: 'docker',
          image: 'test/plugin:1.0.0',
          resources: {
            limits: {
              memory: '512Mi',
              cpu: '0.5',
            },
            requests: {
              memory: '256Mi',
              cpu: '0.25',
            },
          },
        },
      });

      mockDockerInstance.pullImage.mockResolvedValue({ success: true });
      mockDockerInstance.createContainer.mockResolvedValue({
        id: 'resource-container',
      });
      mockDockerInstance.startContainer.mockResolvedValue({ success: true });
      mockDockerInstance.inspectContainer.mockResolvedValue({
        State: { Status: 'running' },
      });

      const result = await installer.installPlugin(resourceConstrainedPlugin);

      expect(result.success).toBe(true);
      expect(mockDockerInstance.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          hostConfig: expect.objectContaining({
            Memory: 536870912, // 512Mi in bytes
            CpuQuota: 50000,   // 0.5 CPU
          }),
        })
      );
    });

    it('should track plugin resource usage', async () => {
      const pluginId = 'resource-tracking-test';
      const installation = createMockPluginInstallation(
        createMockPlugin({ id: pluginId }),
        { containerId: 'container-stats', type: 'docker' }
      );

      mockDockerInstance.inspectContainer.mockResolvedValue({
        State: { Status: 'running' },
        Stats: {
          memory_stats: { usage: 268435456, limit: 536870912 }, // 256Mi used, 512Mi limit
          cpu_stats: { cpu_usage: { total_usage: 1000000000 } },
        },
      });

      const stats = await installer.getPluginResourceUsage(pluginId);

      expect(stats.memory.used).toBe('256Mi');
      expect(stats.memory.limit).toBe('512Mi');
      expect(stats.memory.percentage).toBe(50);
    });
  });

  describe('Backup and Restore', () => {
    it('should create plugin backup before updates', async () => {
      const pluginId = 'backup-test';
      const installation = createMockPluginInstallation(
        createMockPlugin({ id: pluginId }),
        { containerId: 'backup-container', type: 'docker' }
      );

      installer.createPluginBackup = jest.fn().mockResolvedValue({
        success: true,
        backupId: 'backup-123',
        timestamp: new Date().toISOString(),
      });

      const updatedPlugin = createMockPlugin({
        id: pluginId,
        version: '2.0.0',
      });

      await installer.updatePlugin(pluginId, updatedPlugin);

      expect(installer.createPluginBackup).toHaveBeenCalledWith(pluginId);
    });

    it('should restore plugin from backup on failure', async () => {
      const pluginId = 'restore-test';
      const backupId = 'backup-456';

      installer.restorePluginFromBackup = jest.fn().mockResolvedValue({
        success: true,
        restoredVersion: '1.0.0',
      });

      const result = await installer.restorePluginFromBackup(pluginId, backupId);

      expect(result.success).toBe(true);
      expect(result.restoredVersion).toBe('1.0.0');
    });
  });
});