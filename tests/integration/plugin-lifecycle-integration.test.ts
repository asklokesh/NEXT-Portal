/**
 * Integration tests for Plugin Lifecycle Management
 * Tests the complete flow from plugin discovery to installation, configuration, and monitoring
 */

import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { spawn, ChildProcess } from 'child_process';
import axios, { AxiosInstance } from 'axios';
import { WebSocket } from 'ws';

// Test configuration
const TEST_CONFIG = {
  apiUrl: process.env.TEST_API_URL || 'http://localhost:4400',
  redisUrl: process.env.TEST_REDIS_URL || 'redis://localhost:6379',
  postgresUrl: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nextportal_test',
  timeout: 30000,
};

describe('Plugin Lifecycle Integration Tests', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let api: AxiosInstance;
  let backstageProcess: ChildProcess | null = null;
  let testTenantId: string;
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    // Initialize database connection
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: TEST_CONFIG.postgresUrl,
        },
      },
    });

    // Initialize Redis connection
    redis = new Redis(TEST_CONFIG.redisUrl);

    // Initialize API client
    api = axios.create({
      baseURL: TEST_CONFIG.apiUrl,
      timeout: TEST_CONFIG.timeout,
    });

    // Set up test environment
    await setupTestEnvironment();
  }, 60000);

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestEnvironment();
    
    // Close connections
    await prisma.$disconnect();
    await redis.quit();
    
    // Stop Backstage process
    if (backstageProcess) {
      backstageProcess.kill('SIGTERM');
    }
  }, 30000);

  beforeEach(async () => {
    // Clean up plugin installations before each test
    await cleanupPluginInstallations();
  });

  afterEach(async () => {
    // Verify no resource leaks
    await verifyResourceCleanup();
  });

  describe('Plugin Discovery and Search', () => {
    it('should discover available plugins from registry', async () => {
      const response = await api.get('/api/plugins', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: {
          includeQuality: true,
          category: 'all',
          sortBy: 'relevance',
        },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('plugins');
      expect(response.data.plugins).toBeInstanceOf(Array);
      expect(response.data.plugins.length).toBeGreaterThan(0);
      
      // Verify plugin structure
      const plugin = response.data.plugins[0];
      expect(plugin).toHaveProperty('id');
      expect(plugin).toHaveProperty('name');
      expect(plugin).toHaveProperty('version');
      expect(plugin).toHaveProperty('description');
      expect(plugin).toHaveProperty('health');
      expect(plugin).toHaveProperty('qualityGrade');
    });

    it('should filter plugins by category and search query', async () => {
      const searchResponse = await api.get('/api/plugins', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: {
          search: 'kubernetes',
          category: 'infrastructure',
          includeQuality: true,
        },
      });

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.data.plugins).toBeInstanceOf(Array);
      
      // All plugins should match search criteria
      searchResponse.data.plugins.forEach((plugin: any) => {
        const matchesSearch = 
          plugin.name.toLowerCase().includes('kubernetes') ||
          plugin.description.toLowerCase().includes('kubernetes') ||
          plugin.tags.some((tag: string) => tag.toLowerCase().includes('kubernetes'));
        
        expect(matchesSearch).toBe(true);
        expect(plugin.category.toLowerCase()).toContain('infrastructure');
      });
    });

    it('should cache plugin search results', async () => {
      const searchParams = {
        search: 'catalog',
        category: 'core',
        includeQuality: true,
      };

      // First request
      const start1 = Date.now();
      const response1 = await api.get('/api/plugins', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: searchParams,
      });
      const duration1 = Date.now() - start1;

      expect(response1.status).toBe(200);
      expect(response1.headers['x-cache']).toBe('MISS');

      // Second request (should be cached)
      const start2 = Date.now();
      const response2 = await api.get('/api/plugins', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: searchParams,
      });
      const duration2 = Date.now() - start2;

      expect(response2.status).toBe(200);
      expect(response2.headers['x-cache']).toBe('HIT');
      expect(duration2).toBeLessThan(duration1);
      expect(response2.data).toEqual(response1.data);
    });
  });

  describe('Plugin Installation Flow', () => {
    it('should install a Backstage plugin end-to-end', async () => {
      const pluginId = '@backstage/plugin-catalog';
      
      // 1. Get plugin details
      const pluginResponse = await api.get('/api/plugins', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { search: 'catalog' },
      });
      
      const catalogPlugin = pluginResponse.data.plugins.find(
        (p: any) => p.id === pluginId
      );
      expect(catalogPlugin).toBeDefined();

      // 2. Install the plugin
      const installResponse = await api.post('/api/plugins', {
        action: 'install',
        pluginId,
        version: catalogPlugin.version,
        config: {
          enabled: true,
          tenantId: testTenantId,
        },
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(installResponse.status).toBe(200);
      expect(installResponse.data.success).toBe(true);
      expect(installResponse.data.status).toBe('completed');

      // 3. Verify installation in database
      const installation = await prisma.pluginInstallation.findFirst({
        where: {
          pluginId,
          tenantId: testTenantId,
        },
      });

      expect(installation).toBeTruthy();
      expect(installation?.status).toBe('installed');
      expect(installation?.version).toBe(catalogPlugin.version);

      // 4. Verify plugin is enabled
      const statusResponse = await api.get('/api/plugins/status', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { pluginId },
      });

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.data.installed).toBe(true);
      expect(statusResponse.data.enabled).toBe(true);
      expect(statusResponse.data.health).toBeDefined();
    });

    it('should handle plugin installation with dependencies', async () => {
      const pluginId = '@roadiehq/backstage-plugin-argo-cd';
      
      // Install plugin with dependencies
      const installResponse = await api.post('/api/plugins', {
        action: 'install',
        pluginId,
        config: {
          enabled: true,
          resolveDependencies: true,
        },
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(installResponse.status).toBe(200);
      expect(installResponse.data.success).toBe(true);

      // Verify dependencies were installed
      const dependenciesResponse = await api.get('/api/plugin-dependencies', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { pluginId },
      });

      expect(dependenciesResponse.status).toBe(200);
      expect(dependenciesResponse.data.dependencies).toBeInstanceOf(Array);
      
      // All dependencies should be installed
      for (const dep of dependenciesResponse.data.dependencies) {
        const depInstallation = await prisma.pluginInstallation.findFirst({
          where: {
            pluginId: dep.id,
            tenantId: testTenantId,
          },
        });
        expect(depInstallation?.status).toBe('installed');
      }
    });

    it('should rollback installation on failure', async () => {
      const invalidPluginId = '@invalid/plugin-that-does-not-exist';
      
      const installResponse = await api.post('/api/plugins', {
        action: 'install',
        pluginId: invalidPluginId,
        version: '1.0.0',
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(installResponse.status).toBe(400);
      expect(installResponse.data.success).toBe(false);

      // Verify no partial installation exists
      const installation = await prisma.pluginInstallation.findFirst({
        where: {
          pluginId: invalidPluginId,
          tenantId: testTenantId,
        },
      });

      expect(installation).toBeNull();
    });
  });

  describe('Plugin Configuration Management', () => {
    let installedPluginId: string;

    beforeEach(async () => {
      // Install a plugin for configuration tests
      installedPluginId = '@backstage/plugin-kubernetes';
      
      await api.post('/api/plugins', {
        action: 'install',
        pluginId: installedPluginId,
        config: { enabled: true },
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    });

    it('should configure plugin with valid configuration', async () => {
      const config = {
        clusterUrl: 'https://k8s.example.com',
        authType: 'service-account',
        namespace: 'default',
        refreshInterval: 30000,
      };

      const configResponse = await api.post('/api/plugins', {
        action: 'configure',
        pluginId: installedPluginId,
        config,
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(configResponse.status).toBe(200);
      expect(configResponse.data.success).toBe(true);

      // Verify configuration was saved
      const installation = await prisma.pluginInstallation.findFirst({
        where: {
          pluginId: installedPluginId,
          tenantId: testTenantId,
        },
      });

      expect(installation?.config).toEqual(config);
    });

    it('should validate configuration schema', async () => {
      const invalidConfig = {
        clusterUrl: 'invalid-url',
        authType: 'invalid-auth-type',
        refreshInterval: 'not-a-number',
      };

      const configResponse = await api.post('/api/plugins', {
        action: 'configure',
        pluginId: installedPluginId,
        config: invalidConfig,
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(configResponse.status).toBe(400);
      expect(configResponse.data.success).toBe(false);
      expect(configResponse.data.error).toContain('validation');
    });

    it('should support configuration hot-reload', async () => {
      const initialConfig = { refreshInterval: 30000 };
      const updatedConfig = { refreshInterval: 60000 };

      // Initial configuration
      await api.post('/api/plugins', {
        action: 'configure',
        pluginId: installedPluginId,
        config: initialConfig,
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      // Update configuration
      const updateResponse = await api.post('/api/plugins', {
        action: 'configure',
        pluginId: installedPluginId,
        config: updatedConfig,
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.success).toBe(true);

      // Verify configuration was updated
      const statusResponse = await api.get('/api/plugins/status', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { pluginId: installedPluginId },
      });

      expect(statusResponse.data.config.refreshInterval).toBe(60000);
    });
  });

  describe('Plugin Health Monitoring', () => {
    let monitoredPluginId: string;

    beforeEach(async () => {
      monitoredPluginId = '@backstage/plugin-catalog';
      
      // Install and configure plugin for monitoring
      await api.post('/api/plugins', {
        action: 'install',
        pluginId: monitoredPluginId,
        config: { 
          enabled: true,
          monitoring: {
            healthChecks: true,
            metrics: true,
          },
        },
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
    });

    it('should monitor plugin health status', async () => {
      const healthResponse = await api.get('/api/plugin-health', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { pluginId: monitoredPluginId },
      });

      expect(healthResponse.status).toBe(200);
      expect(healthResponse.data).toHaveProperty('health');
      expect(healthResponse.data).toHaveProperty('status');
      expect(healthResponse.data).toHaveProperty('lastCheck');
      expect(healthResponse.data).toHaveProperty('metrics');

      expect(['healthy', 'degraded', 'unhealthy']).toContain(healthResponse.data.health);
    });

    it('should collect plugin performance metrics', async () => {
      const metricsResponse = await api.get('/api/metrics', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { 
          pluginId: monitoredPluginId,
          timeRange: '1h',
        },
      });

      expect(metricsResponse.status).toBe(200);
      expect(metricsResponse.data).toHaveProperty('metrics');
      expect(metricsResponse.data.metrics).toHaveProperty('responseTime');
      expect(metricsResponse.data.metrics).toHaveProperty('errorRate');
      expect(metricsResponse.data.metrics).toHaveProperty('throughput');
      expect(metricsResponse.data.metrics).toHaveProperty('memoryUsage');
    });

    it('should trigger alerts for unhealthy plugins', async () => {
      // Simulate plugin becoming unhealthy
      await api.post('/api/plugins/test/simulate-failure', {
        pluginId: monitoredPluginId,
        failureType: 'health-check-failure',
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      // Wait for health check to detect failure
      await new Promise(resolve => setTimeout(resolve, 5000));

      const alertsResponse = await api.get('/api/monitoring/alerts', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { 
          severity: 'warning',
          status: 'active',
        },
      });

      expect(alertsResponse.status).toBe(200);
      const pluginAlert = alertsResponse.data.alerts.find(
        (alert: any) => alert.source === monitoredPluginId
      );
      
      expect(pluginAlert).toBeTruthy();
      expect(pluginAlert.type).toBe('plugin-health-degraded');
    });
  });

  describe('Real-time Plugin Updates', () => {
    let websocket: WebSocket;

    beforeEach(async () => {
      // Connect to WebSocket for real-time updates
      websocket = new WebSocket(`${TEST_CONFIG.apiUrl.replace('http', 'ws')}/ws`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      await new Promise<void>((resolve) => {
        websocket.on('open', () => resolve());
      });
    });

    afterEach(async () => {
      if (websocket) {
        websocket.close();
      }
    });

    it('should broadcast plugin installation events', async () => {
      const pluginId = '@roadiehq/backstage-plugin-jira';
      
      // Listen for WebSocket events
      const events: any[] = [];
      websocket.on('message', (data) => {
        events.push(JSON.parse(data.toString()));
      });

      // Install plugin
      await api.post('/api/plugins', {
        action: 'install',
        pluginId,
        config: { enabled: true },
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      // Wait for WebSocket events
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify events were received
      const installEvent = events.find(
        event => event.type === 'plugin-installed' && event.pluginId === pluginId
      );
      
      expect(installEvent).toBeTruthy();
      expect(installEvent.tenantId).toBe(testTenantId);
      expect(installEvent.status).toBe('installed');
    });

    it('should stream plugin health updates', async () => {
      const pluginId = '@backstage/plugin-catalog';
      
      // Subscribe to plugin health updates
      websocket.send(JSON.stringify({
        type: 'subscribe',
        topic: 'plugin-health',
        pluginId,
      }));

      const healthUpdates: any[] = [];
      websocket.on('message', (data) => {
        const event = JSON.parse(data.toString());
        if (event.type === 'plugin-health-update') {
          healthUpdates.push(event);
        }
      });

      // Wait for health updates
      await new Promise(resolve => setTimeout(resolve, 10000));

      expect(healthUpdates.length).toBeGreaterThan(0);
      
      const update = healthUpdates[0];
      expect(update.pluginId).toBe(pluginId);
      expect(update).toHaveProperty('health');
      expect(update).toHaveProperty('metrics');
      expect(update).toHaveProperty('timestamp');
    });
  });

  describe('Multi-tenant Plugin Isolation', () => {
    let tenant2Id: string;
    let tenant2Token: string;

    beforeEach(async () => {
      // Create second tenant for isolation testing
      const tenant2 = await prisma.tenant.create({
        data: {
          name: 'Test Tenant 2',
          domain: 'tenant2.test.com',
          isActive: true,
        },
      });
      tenant2Id = tenant2.id;

      // Create user for second tenant
      const user2 = await prisma.user.create({
        data: {
          email: 'user2@tenant2.test.com',
          name: 'Test User 2',
          tenantId: tenant2Id,
          role: 'admin',
          isActive: true,
        },
      });

      // Generate auth token for second tenant
      const loginResponse = await api.post('/api/auth/login', {
        email: 'user2@tenant2.test.com',
        password: 'testpassword',
      });
      tenant2Token = loginResponse.data.token;
    });

    afterEach(async () => {
      // Cleanup second tenant
      await prisma.pluginInstallation.deleteMany({
        where: { tenantId: tenant2Id },
      });
      await prisma.user.deleteMany({
        where: { tenantId: tenant2Id },
      });
      await prisma.tenant.delete({
        where: { id: tenant2Id },
      });
    });

    it('should isolate plugin installations between tenants', async () => {
      const pluginId = '@backstage/plugin-kubernetes';

      // Install plugin for tenant 1
      await api.post('/api/plugins', {
        action: 'install',
        pluginId,
        config: { enabled: true },
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      // Verify tenant 1 has the plugin
      const tenant1Status = await api.get('/api/plugins/status', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { pluginId },
      });
      expect(tenant1Status.data.installed).toBe(true);

      // Verify tenant 2 does not have the plugin
      const tenant2Status = await api.get('/api/plugins/status', {
        headers: { Authorization: `Bearer ${tenant2Token}` },
        params: { pluginId },
      });
      expect(tenant2Status.data.installed).toBe(false);

      // Install plugin for tenant 2 with different config
      await api.post('/api/plugins', {
        action: 'install',
        pluginId,
        config: { 
          enabled: true,
          customSetting: 'tenant2-value',
        },
      }, {
        headers: { Authorization: `Bearer ${tenant2Token}` },
      });

      // Verify both tenants have isolated configurations
      const tenant1Config = await api.get('/api/plugins/status', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { pluginId },
      });

      const tenant2Config = await api.get('/api/plugins/status', {
        headers: { Authorization: `Bearer ${tenant2Token}` },
        params: { pluginId },
      });

      expect(tenant1Config.data.config).not.toHaveProperty('customSetting');
      expect(tenant2Config.data.config.customSetting).toBe('tenant2-value');
    });

    it('should prevent cross-tenant plugin access', async () => {
      const pluginId = '@backstage/plugin-catalog';

      // Install plugin for tenant 1
      await api.post('/api/plugins', {
        action: 'install',
        pluginId,
        config: { enabled: true },
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      // Try to access tenant 1's plugin with tenant 2's token
      const unauthorizedResponse = await api.get('/api/plugins/status', {
        headers: { 
          Authorization: `Bearer ${tenant2Token}`,
          'X-Tenant-ID': testTenantId, // Attempt to access different tenant
        },
        params: { pluginId },
      });

      expect(unauthorizedResponse.status).toBe(403);
    });
  });

  describe('Plugin Security and Validation', () => {
    it('should scan plugins for security vulnerabilities', async () => {
      const pluginId = '@backstage/plugin-github-actions';

      // Install plugin with security scanning enabled
      const installResponse = await api.post('/api/plugins', {
        action: 'install',
        pluginId,
        config: { 
          enabled: true,
          securityScan: true,
        },
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(installResponse.status).toBe(200);

      // Check security scan results
      const securityResponse = await api.get('/api/plugin-security', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { pluginId },
      });

      expect(securityResponse.status).toBe(200);
      expect(securityResponse.data).toHaveProperty('scanResults');
      expect(securityResponse.data).toHaveProperty('vulnerabilities');
      expect(securityResponse.data).toHaveProperty('riskScore');
      expect(securityResponse.data).toHaveProperty('lastScan');
    });

    it('should enforce plugin compatibility requirements', async () => {
      const incompatiblePlugin = {
        id: '@test/incompatible-plugin',
        version: '1.0.0',
        backstageVersion: '0.10.0', // Very old version
      };

      // Try to install incompatible plugin
      const installResponse = await api.post('/api/plugins', {
        action: 'install',
        pluginId: incompatiblePlugin.id,
        version: incompatiblePlugin.version,
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      expect(installResponse.status).toBe(400);
      expect(installResponse.data.error).toContain('compatibility');
    });

    it('should validate plugin permissions and capabilities', async () => {
      const privilegedPluginId = '@test/privileged-plugin';

      // Mock plugin that requires elevated permissions
      const installResponse = await api.post('/api/plugins', {
        action: 'install',
        pluginId: privilegedPluginId,
        config: { 
          enabled: true,
          permissions: ['read:secrets', 'write:database'],
        },
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      // Should require approval for privileged plugins
      expect(installResponse.status).toBe(202); // Accepted, pending approval
      expect(installResponse.data.status).toBe('pending-approval');

      // Verify approval workflow was triggered
      const approvalResponse = await api.get('/api/plugins/approval', {
        headers: { Authorization: `Bearer ${authToken}` },
        params: { pluginId: privilegedPluginId },
      });

      expect(approvalResponse.status).toBe(200);
      expect(approvalResponse.data.status).toBe('pending');
      expect(approvalResponse.data.requiredPermissions).toContain('read:secrets');
    });
  });

  // Helper functions
  async function setupTestEnvironment() {
    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Tenant',
        domain: 'test.com',
        isActive: true,
      },
    });
    testTenantId = tenant.id;

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'test@test.com',
        name: 'Test User',
        tenantId: testTenantId,
        role: 'admin',
        isActive: true,
      },
    });
    testUserId = user.id;

    // Generate auth token
    const loginResponse = await api.post('/api/auth/login', {
      email: 'test@test.com',
      password: 'testpassword',
    });
    authToken = loginResponse.data.token;

    // Start mock Backstage instance
    await startMockBackstage();
  }

  async function cleanupTestEnvironment() {
    // Remove test data
    await prisma.pluginInstallation.deleteMany({
      where: { tenantId: testTenantId },
    });
    await prisma.user.deleteMany({
      where: { tenantId: testTenantId },
    });
    await prisma.tenant.delete({
      where: { id: testTenantId },
    });

    // Clear Redis cache
    await redis.flushall();
  }

  async function cleanupPluginInstallations() {
    await prisma.pluginInstallation.deleteMany({
      where: { tenantId: testTenantId },
    });
  }

  async function verifyResourceCleanup() {
    // Check for memory leaks, open connections, etc.
    const openConnections = await redis.client('list');
    expect(openConnections.split('\n').length).toBeLessThan(10);
  }

  async function startMockBackstage() {
    if (process.env.CI) {
      // In CI environment, assume Backstage is already running
      return;
    }

    backstageProcess = spawn('npm', ['run', 'mock-backstage'], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    // Wait for Backstage to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Backstage startup timeout'));
      }, 30000);

      backstageProcess!.stdout?.on('data', (data) => {
        if (data.toString().includes('Backstage backend started')) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  }
});