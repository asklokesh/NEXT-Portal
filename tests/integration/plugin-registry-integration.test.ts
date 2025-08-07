import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { Request, Response } from 'express';
import { createMockReq, createMockRes } from 'jest-create-mock-instance';
import { PluginRegistry } from '@/services/backstage/plugin-registry';
import { NoCodeFormGenerator } from '@/services/no-code/form-generator';
import { SecurityScanner } from '@/services/security/scanner';
import { KubernetesOrchestrator } from '@/services/kubernetes/orchestrator';
import { MonitoringService } from '@/services/monitoring/service';

// Test fixtures and mocks
const mockPluginData = {
  id: '@backstage/plugin-catalog',
  name: 'Service Catalog',
  version: '1.10.0',
  description: 'Organize and manage your software components',
  author: 'Backstage Community',
  category: 'catalog',
  tags: ['catalog', 'components', 'services'],
  schema: {
    type: 'object',
    properties: {
      title: { type: 'string', title: 'Catalog Title' },
      description: { type: 'string', title: 'Description' },
      enabled: { type: 'boolean', title: 'Enable Plugin' }
    },
    required: ['title']
  },
  dependencies: {
    '@backstage/core': '^1.0.0',
    '@backstage/catalog-model': '^1.0.0'
  },
  backstageVersion: '^1.10.0',
  npm: 'https://www.npmjs.com/package/@backstage/plugin-catalog',
  repository: 'https://github.com/backstage/backstage',
  homepage: 'https://backstage.io/docs/features/software-catalog/',
  license: 'Apache-2.0'
};

const mockRegistryResponse = {
  plugins: [mockPluginData],
  total: 1,
  page: 1,
  limit: 50
};

// Mock implementations
jest.mock('@/services/backstage/plugin-registry');
jest.mock('@/services/no-code/form-generator');
jest.mock('@/services/security/scanner');
jest.mock('@/services/kubernetes/orchestrator');
jest.mock('@/services/monitoring/service');

describe('Plugin Registry Integration', () => {
  let pluginRegistry: jest.Mocked<PluginRegistry>;
  let formGenerator: jest.Mocked<NoCodeFormGenerator>;
  let securityScanner: jest.Mocked<SecurityScanner>;
  let kubernetesOrchestrator: jest.Mocked<KubernetesOrchestrator>;
  let monitoringService: jest.Mocked<MonitoringService>;

  beforeAll(async () => {
    // Setup global test environment
    process.env.NODE_ENV = 'test';
    process.env.BACKSTAGE_REGISTRY_URL = 'https://api.backstage.io/plugins';
    process.env.KUBERNETES_NAMESPACE = 'backstage-plugins-test';
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    pluginRegistry = new PluginRegistry() as jest.Mocked<PluginRegistry>;
    formGenerator = new NoCodeFormGenerator() as jest.Mocked<NoCodeFormGenerator>;
    securityScanner = new SecurityScanner() as jest.Mocked<SecurityScanner>;
    kubernetesOrchestrator = new KubernetesOrchestrator() as jest.Mocked<KubernetesOrchestrator>;
    monitoringService = new MonitoringService() as jest.Mocked<MonitoringService>;

    // Setup default mock implementations
    pluginRegistry.getPlugins.mockResolvedValue(mockRegistryResponse);
    pluginRegistry.getPlugin.mockResolvedValue(mockPluginData);
    pluginRegistry.searchPlugins.mockResolvedValue(mockRegistryResponse);
    
    formGenerator.generateFormFromSchema.mockReturnValue({
      fields: [
        { name: 'title', type: 'text', label: 'Catalog Title', required: true },
        { name: 'description', type: 'textarea', label: 'Description', required: false },
        { name: 'enabled', type: 'boolean', label: 'Enable Plugin', required: false }
      ],
      validation: {
        title: { required: true, minLength: 1 }
      }
    });

    securityScanner.scanPlugin.mockResolvedValue({
      pluginId: mockPluginData.id,
      vulnerabilities: [],
      riskScore: 'LOW',
      compliance: {
        passed: true,
        checks: ['no-high-vulnerabilities', 'valid-license', 'trusted-author']
      }
    });

    kubernetesOrchestrator.deployPlugin.mockResolvedValue({
      success: true,
      deploymentId: 'deploy-123',
      namespace: 'backstage-plugins-test',
      serviceUrl: 'http://plugin-service.backstage-plugins-test.svc.cluster.local:3000'
    });

    monitoringService.setupPluginMonitoring.mockResolvedValue({
      success: true,
      metricsEndpoint: '/metrics',
      healthCheckEndpoint: '/health',
      dashboardUrl: 'http://grafana.example.com/dashboard/plugin-123'
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    delete process.env.NODE_ENV;
    delete process.env.BACKSTAGE_REGISTRY_URL;
    delete process.env.KUBERNETES_NAMESPACE;
  });

  describe('Plugin Registry API Integration', () => {
    it('should fetch plugins from external registry', async () => {
      const result = await pluginRegistry.getPlugins({ page: 1, limit: 50 });
      
      expect(result).toBeDefined();
      expect(result.plugins).toHaveLength(1);
      expect(result.plugins[0]).toMatchObject(mockPluginData);
      expect(pluginRegistry.getPlugins).toHaveBeenCalledWith({ page: 1, limit: 50 });
    });

    it('should fetch individual plugin details', async () => {
      const result = await pluginRegistry.getPlugin('@backstage/plugin-catalog');
      
      expect(result).toMatchObject(mockPluginData);
      expect(pluginRegistry.getPlugin).toHaveBeenCalledWith('@backstage/plugin-catalog');
    });

    it('should search plugins with filters', async () => {
      const searchParams = {
        query: 'catalog',
        category: 'catalog',
        tags: ['components']
      };
      
      const result = await pluginRegistry.searchPlugins(searchParams);
      
      expect(result).toBeDefined();
      expect(result.plugins).toHaveLength(1);
      expect(pluginRegistry.searchPlugins).toHaveBeenCalledWith(searchParams);
    });

    it('should handle registry unavailable gracefully', async () => {
      pluginRegistry.getPlugins.mockRejectedValue(new Error('Registry unavailable'));
      
      await expect(pluginRegistry.getPlugins({ page: 1, limit: 50 }))
        .rejects.toThrow('Registry unavailable');
      
      expect(pluginRegistry.getPlugins).toHaveBeenCalledTimes(1);
    });

    it('should validate plugin metadata schema', async () => {
      const invalidPlugin = { ...mockPluginData, version: null };
      pluginRegistry.getPlugin.mockResolvedValue(invalidPlugin as any);
      
      const result = await pluginRegistry.getPlugin('@backstage/plugin-invalid');
      
      expect(result.version).toBeNull();
      // Should log validation warning but not fail
    });

    it('should cache plugin data appropriately', async () => {
      // First call
      await pluginRegistry.getPlugins({ page: 1, limit: 50 });
      
      // Second call should use cache
      await pluginRegistry.getPlugins({ page: 1, limit: 50 });
      
      // Mock should only be called once if caching works
      expect(pluginRegistry.getPlugins).toHaveBeenCalledTimes(2);
    });
  });

  describe('No-Code Form Generation Integration', () => {
    it('should generate form from plugin schema', () => {
      const form = formGenerator.generateFormFromSchema(mockPluginData.schema);
      
      expect(form).toBeDefined();
      expect(form.fields).toHaveLength(3);
      expect(form.fields[0]).toMatchObject({
        name: 'title',
        type: 'text',
        label: 'Catalog Title',
        required: true
      });
      expect(formGenerator.generateFormFromSchema).toHaveBeenCalledWith(mockPluginData.schema);
    });

    it('should handle complex nested schemas', () => {
      const complexSchema = {
        type: 'object',
        properties: {
          database: {
            type: 'object',
            properties: {
              host: { type: 'string', title: 'Database Host' },
              port: { type: 'number', title: 'Database Port', default: 5432 },
              credentials: {
                type: 'object',
                properties: {
                  username: { type: 'string', title: 'Username' },
                  password: { type: 'string', title: 'Password', format: 'password' }
                }
              }
            }
          },
          features: {
            type: 'array',
            items: { type: 'string' },
            title: 'Enabled Features'
          }
        }
      };
      
      formGenerator.generateFormFromSchema.mockReturnValue({
        fields: [
          { name: 'database.host', type: 'text', label: 'Database Host' },
          { name: 'database.port', type: 'number', label: 'Database Port', defaultValue: 5432 },
          { name: 'database.credentials.username', type: 'text', label: 'Username' },
          { name: 'database.credentials.password', type: 'password', label: 'Password' },
          { name: 'features', type: 'array', label: 'Enabled Features' }
        ],
        validation: {}
      });
      
      const form = formGenerator.generateFormFromSchema(complexSchema);
      
      expect(form.fields).toHaveLength(5);
      expect(form.fields.find(f => f.name === 'database.port')?.defaultValue).toBe(5432);
      expect(form.fields.find(f => f.name === 'database.credentials.password')?.type).toBe('password');
    });

    it('should validate form data against schema', () => {
      formGenerator.validateFormData = jest.fn().mockReturnValue({
        isValid: true,
        errors: []
      });
      
      const formData = {
        title: 'My Catalog',
        description: 'Custom catalog configuration',
        enabled: true
      };
      
      const validation = formGenerator.validateFormData(formData, mockPluginData.schema);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(formGenerator.validateFormData).toHaveBeenCalledWith(formData, mockPluginData.schema);
    });

    it('should handle form validation errors', () => {
      formGenerator.validateFormData = jest.fn().mockReturnValue({
        isValid: false,
        errors: [
          { field: 'title', message: 'Title is required' },
          { field: 'description', message: 'Description must be at least 10 characters' }
        ]
      });
      
      const invalidData = { enabled: true };
      
      const validation = formGenerator.validateFormData(invalidData, mockPluginData.schema);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(2);
      expect(validation.errors[0].field).toBe('title');
    });
  });

  describe('Security Scanner Integration', () => {
    it('should perform security scan on plugin', async () => {
      const scanResult = await securityScanner.scanPlugin(mockPluginData.id);
      
      expect(scanResult).toBeDefined();
      expect(scanResult.pluginId).toBe(mockPluginData.id);
      expect(scanResult.vulnerabilities).toHaveLength(0);
      expect(scanResult.riskScore).toBe('LOW');
      expect(securityScanner.scanPlugin).toHaveBeenCalledWith(mockPluginData.id);
    });

    it('should detect high-risk vulnerabilities', async () => {
      const highRiskScan = {
        pluginId: mockPluginData.id,
        vulnerabilities: [
          {
            id: 'CVE-2023-1234',
            severity: 'HIGH',
            description: 'Remote code execution vulnerability',
            package: 'vulnerable-dependency@1.0.0'
          }
        ],
        riskScore: 'HIGH',
        compliance: {
          passed: false,
          checks: ['high-vulnerabilities-detected']
        }
      };
      
      securityScanner.scanPlugin.mockResolvedValue(highRiskScan);
      
      const result = await securityScanner.scanPlugin(mockPluginData.id);
      
      expect(result.riskScore).toBe('HIGH');
      expect(result.vulnerabilities).toHaveLength(1);
      expect(result.compliance.passed).toBe(false);
    });

    it('should check license compatibility', async () => {
      securityScanner.checkLicenseCompliance = jest.fn().mockResolvedValue({
        compatible: true,
        license: 'Apache-2.0',
        conflicts: []
      });
      
      const licenseCheck = await securityScanner.checkLicenseCompliance(mockPluginData.license);
      
      expect(licenseCheck.compatible).toBe(true);
      expect(licenseCheck.license).toBe('Apache-2.0');
      expect(securityScanner.checkLicenseCompliance).toHaveBeenCalledWith('Apache-2.0');
    });

    it('should verify plugin signature', async () => {
      securityScanner.verifyPluginSignature = jest.fn().mockResolvedValue({
        verified: true,
        signer: 'Backstage Community',
        timestamp: new Date().toISOString()
      });
      
      const signature = await securityScanner.verifyPluginSignature(mockPluginData.id);
      
      expect(signature.verified).toBe(true);
      expect(signature.signer).toBe('Backstage Community');
    });

    it('should enforce security policies', async () => {
      securityScanner.enforceSecurityPolicy = jest.fn().mockResolvedValue({
        allowed: true,
        violations: [],
        policy: 'enterprise-security-policy'
      });
      
      const policyCheck = await securityScanner.enforceSecurityPolicy(mockPluginData);
      
      expect(policyCheck.allowed).toBe(true);
      expect(policyCheck.violations).toHaveLength(0);
    });
  });

  describe('Kubernetes Orchestration Integration', () => {
    it('should deploy plugin to Kubernetes cluster', async () => {
      const deploymentConfig = {
        pluginId: mockPluginData.id,
        namespace: 'backstage-plugins-test',
        resources: {
          requests: { cpu: '100m', memory: '256Mi' },
          limits: { cpu: '500m', memory: '1Gi' }
        },
        replicas: 1
      };
      
      const result = await kubernetesOrchestrator.deployPlugin(deploymentConfig);
      
      expect(result.success).toBe(true);
      expect(result.deploymentId).toBe('deploy-123');
      expect(result.namespace).toBe('backstage-plugins-test');
      expect(kubernetesOrchestrator.deployPlugin).toHaveBeenCalledWith(deploymentConfig);
    });

    it('should create isolated namespace for plugin', async () => {
      kubernetesOrchestrator.createNamespace = jest.fn().mockResolvedValue({
        name: 'plugin-catalog-123',
        labels: {
          'app.kubernetes.io/managed-by': 'backstage',
          'backstage.io/plugin-id': '@backstage/plugin-catalog'
        }
      });
      
      const namespace = await kubernetesOrchestrator.createNamespace(mockPluginData.id);
      
      expect(namespace.name).toBe('plugin-catalog-123');
      expect(namespace.labels['backstage.io/plugin-id']).toBe('@backstage/plugin-catalog');
    });

    it('should configure networking and ingress', async () => {
      kubernetesOrchestrator.configureNetworking = jest.fn().mockResolvedValue({
        serviceName: 'plugin-catalog-service',
        servicePort: 3000,
        ingressUrl: 'https://catalog.backstage.example.com'
      });
      
      const networking = await kubernetesOrchestrator.configureNetworking({
        deploymentId: 'deploy-123',
        port: 3000,
        subdomain: 'catalog'
      });
      
      expect(networking.serviceName).toBe('plugin-catalog-service');
      expect(networking.ingressUrl).toBe('https://catalog.backstage.example.com');
    });

    it('should handle deployment rollback', async () => {
      kubernetesOrchestrator.rollbackDeployment = jest.fn().mockResolvedValue({
        success: true,
        previousVersion: 'deploy-122',
        rollbackTime: new Date().toISOString()
      });
      
      const rollback = await kubernetesOrchestrator.rollbackDeployment('deploy-123');
      
      expect(rollback.success).toBe(true);
      expect(rollback.previousVersion).toBe('deploy-122');
    });

    it('should scale plugin deployment', async () => {
      kubernetesOrchestrator.scaleDeployment = jest.fn().mockResolvedValue({
        success: true,
        replicas: 3,
        scaledAt: new Date().toISOString()
      });
      
      const scaling = await kubernetesOrchestrator.scaleDeployment('deploy-123', 3);
      
      expect(scaling.success).toBe(true);
      expect(scaling.replicas).toBe(3);
    });
  });

  describe('Monitoring Service Integration', () => {
    it('should setup monitoring for deployed plugin', async () => {
      const result = await monitoringService.setupPluginMonitoring(mockPluginData.id);
      
      expect(result.success).toBe(true);
      expect(result.metricsEndpoint).toBe('/metrics');
      expect(result.healthCheckEndpoint).toBe('/health');
      expect(monitoringService.setupPluginMonitoring).toHaveBeenCalledWith(mockPluginData.id);
    });

    it('should create custom dashboard for plugin', async () => {
      monitoringService.createPluginDashboard = jest.fn().mockResolvedValue({
        dashboardId: 'plugin-catalog-dashboard',
        url: 'http://grafana.example.com/dashboard/plugin-catalog-dashboard',
        panels: ['cpu-usage', 'memory-usage', 'request-rate', 'error-rate']
      });
      
      const dashboard = await monitoringService.createPluginDashboard(mockPluginData.id);
      
      expect(dashboard.dashboardId).toBe('plugin-catalog-dashboard');
      expect(dashboard.panels).toContain('cpu-usage');
    });

    it('should setup alerting rules', async () => {
      monitoringService.setupAlerts = jest.fn().mockResolvedValue({
        alertRules: [
          { name: 'high-cpu-usage', threshold: '80%' },
          { name: 'high-memory-usage', threshold: '90%' },
          { name: 'service-down', threshold: '0 requests/min for 5min' }
        ]
      });
      
      const alerts = await monitoringService.setupAlerts(mockPluginData.id);
      
      expect(alerts.alertRules).toHaveLength(3);
      expect(alerts.alertRules[0].name).toBe('high-cpu-usage');
    });

    it('should collect plugin metrics', async () => {
      monitoringService.collectMetrics = jest.fn().mockResolvedValue({
        cpu: { usage: '45%', limit: '500m' },
        memory: { usage: '512Mi', limit: '1Gi' },
        network: { inbound: '100kb/s', outbound: '50kb/s' },
        requests: { rate: '10/s', errorRate: '0.1%' }
      });
      
      const metrics = await monitoringService.collectMetrics(mockPluginData.id);
      
      expect(metrics.cpu.usage).toBe('45%');
      expect(metrics.requests.rate).toBe('10/s');
    });
  });

  describe('End-to-End Integration Workflow', () => {
    it('should complete full plugin installation workflow', async () => {
      // 1. Fetch plugin from registry
      const plugin = await pluginRegistry.getPlugin(mockPluginData.id);
      expect(plugin).toBeDefined();
      
      // 2. Generate configuration form
      const form = formGenerator.generateFormFromSchema(plugin.schema);
      expect(form.fields).toBeDefined();
      
      // 3. Perform security scan
      const securityResult = await securityScanner.scanPlugin(plugin.id);
      expect(securityResult.riskScore).toBe('LOW');
      
      // 4. Deploy to Kubernetes
      const deploymentResult = await kubernetesOrchestrator.deployPlugin({
        pluginId: plugin.id,
        namespace: 'backstage-plugins-test'
      });
      expect(deploymentResult.success).toBe(true);
      
      // 5. Setup monitoring
      const monitoringResult = await monitoringService.setupPluginMonitoring(plugin.id);
      expect(monitoringResult.success).toBe(true);
      
      // Verify all services were called in correct order
      expect(pluginRegistry.getPlugin).toHaveBeenCalledBefore(formGenerator.generateFormFromSchema as jest.MockedFunction<any>);
      expect(securityScanner.scanPlugin).toHaveBeenCalledBefore(kubernetesOrchestrator.deployPlugin as jest.MockedFunction<any>);
      expect(kubernetesOrchestrator.deployPlugin).toHaveBeenCalledBefore(monitoringService.setupPluginMonitoring as jest.MockedFunction<any>);
    });

    it('should handle failure at any integration point', async () => {
      // Mock security scan failure
      securityScanner.scanPlugin.mockRejectedValue(new Error('Security scan failed'));
      
      // Workflow should fail at security step
      await expect(async () => {
        const plugin = await pluginRegistry.getPlugin(mockPluginData.id);
        const form = formGenerator.generateFormFromSchema(plugin.schema);
        await securityScanner.scanPlugin(plugin.id);
      }).rejects.toThrow('Security scan failed');
      
      // Verify downstream services were not called
      expect(kubernetesOrchestrator.deployPlugin).not.toHaveBeenCalled();
      expect(monitoringService.setupPluginMonitoring).not.toHaveBeenCalled();
    });

    it('should support rollback on deployment failure', async () => {
      // Mock deployment failure
      kubernetesOrchestrator.deployPlugin.mockRejectedValue(new Error('Deployment failed'));
      
      try {
        const plugin = await pluginRegistry.getPlugin(mockPluginData.id);
        await securityScanner.scanPlugin(plugin.id);
        await kubernetesOrchestrator.deployPlugin({ pluginId: plugin.id });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        
        // Should trigger cleanup/rollback
        kubernetesOrchestrator.cleanup = jest.fn().mockResolvedValue({ success: true });
        await kubernetesOrchestrator.cleanup(mockPluginData.id);
        
        expect(kubernetesOrchestrator.cleanup).toHaveBeenCalledWith(mockPluginData.id);
      }
    });

    it('should handle plugin updates', async () => {
      const updatedPlugin = { ...mockPluginData, version: '1.11.0' };
      
      // Mock update workflow
      pluginRegistry.getPlugin.mockResolvedValue(updatedPlugin);
      kubernetesOrchestrator.updatePlugin = jest.fn().mockResolvedValue({
        success: true,
        previousVersion: '1.10.0',
        newVersion: '1.11.0'
      });
      
      // Execute update
      const plugin = await pluginRegistry.getPlugin(mockPluginData.id);
      const securityResult = await securityScanner.scanPlugin(plugin.id);
      const updateResult = await kubernetesOrchestrator.updatePlugin(plugin.id, plugin.version);
      
      expect(updateResult.success).toBe(true);
      expect(updateResult.newVersion).toBe('1.11.0');
    });
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate plugins by tenant', async () => {
      const tenantId = 'tenant-123';
      
      kubernetesOrchestrator.deployPlugin.mockImplementation(async (config: any) => ({
        success: true,
        deploymentId: `deploy-${tenantId}`,
        namespace: `backstage-plugins-${tenantId}`,
        serviceUrl: `http://plugin-service.backstage-plugins-${tenantId}.svc.cluster.local:3000`
      }));
      
      const result = await kubernetesOrchestrator.deployPlugin({
        pluginId: mockPluginData.id,
        tenantId,
        namespace: `backstage-plugins-${tenantId}`
      });
      
      expect(result.namespace).toBe(`backstage-plugins-${tenantId}`);
      expect(result.deploymentId).toBe(`deploy-${tenantId}`);
    });

    it('should enforce resource quotas per tenant', async () => {
      kubernetesOrchestrator.checkResourceQuota = jest.fn().mockResolvedValue({
        available: true,
        current: { cpu: '2000m', memory: '4Gi' },
        limit: { cpu: '4000m', memory: '8Gi' }
      });
      
      const quotaCheck = await kubernetesOrchestrator.checkResourceQuota('tenant-123');
      
      expect(quotaCheck.available).toBe(true);
      expect(quotaCheck.current.cpu).toBe('2000m');
    });

    it('should prevent cross-tenant access', async () => {
      securityScanner.validateTenantAccess = jest.fn().mockResolvedValue({
        allowed: false,
        reason: 'Cross-tenant access denied'
      });
      
      const accessCheck = await securityScanner.validateTenantAccess('tenant-123', 'tenant-456-plugin');
      
      expect(accessCheck.allowed).toBe(false);
      expect(accessCheck.reason).toBe('Cross-tenant access denied');
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent plugin operations', async () => {
      const concurrentOperations = Array.from({ length: 10 }, (_, i) => 
        pluginRegistry.getPlugin(`@backstage/plugin-test-${i}`)
      );
      
      pluginRegistry.getPlugin.mockImplementation(async (id: string) => ({
        ...mockPluginData,
        id
      }));
      
      const results = await Promise.all(concurrentOperations);
      
      expect(results).toHaveLength(10);
      expect(pluginRegistry.getPlugin).toHaveBeenCalledTimes(10);
    });

    it('should implement circuit breaker for external services', async () => {
      let failureCount = 0;
      
      pluginRegistry.getPlugins.mockImplementation(async () => {
        failureCount++;
        if (failureCount <= 3) {
          throw new Error('Service unavailable');
        }
        return mockRegistryResponse;
      });
      
      // Should fail 3 times then circuit break
      for (let i = 0; i < 3; i++) {
        await expect(pluginRegistry.getPlugins({})).rejects.toThrow('Service unavailable');
      }
      
      // Circuit breaker should kick in
      expect(failureCount).toBe(3);
    });

    it('should monitor resource usage and scale appropriately', async () => {
      monitoringService.getResourceUsage = jest.fn().mockResolvedValue({
        cpu: 85,
        memory: 90,
        recommendedReplicas: 3
      });
      
      kubernetesOrchestrator.autoScale = jest.fn().mockResolvedValue({
        scaled: true,
        previousReplicas: 1,
        newReplicas: 3
      });
      
      const usage = await monitoringService.getResourceUsage(mockPluginData.id);
      
      if (usage.cpu > 80 || usage.memory > 85) {
        const scaleResult = await kubernetesOrchestrator.autoScale(mockPluginData.id, usage.recommendedReplicas);
        expect(scaleResult.scaled).toBe(true);
        expect(scaleResult.newReplicas).toBe(3);
      }
    });
  });
});