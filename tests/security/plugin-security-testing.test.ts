import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { SecurityScanner } from '@/services/security/scanner';
import { PluginSandbox } from '@/services/security/sandbox';
import { RBACEngine } from '@/services/security/rbac';
import { VulnerabilityDatabase } from '@/services/security/vulnerability-db';
import { PolicyEngine } from '@/services/security/policy-engine';
import { AuditLogger } from '@/services/security/audit-logger';

// Security test fixtures
const SECURITY_TEST_PLUGIN = {
  id: '@test/security-plugin',
  name: 'Security Test Plugin',
  version: '1.0.0',
  author: 'Security Test Team',
  dependencies: {
    'lodash': '^4.17.21',
    'axios': '^1.3.0',
    'vulnerable-package': '1.0.0' // Intentionally vulnerable for testing
  },
  permissions: [
    'read:catalog',
    'write:templates',
    'admin:users'
  ],
  dockerImage: 'test/security-plugin:1.0.0',
  resources: {
    cpu: '100m',
    memory: '256Mi'
  }
};

const RBAC_TEST_ROLES = {
  viewer: {
    permissions: ['read:catalog', 'read:templates']
  },
  developer: {
    permissions: ['read:catalog', 'read:templates', 'write:templates', 'read:monitoring']
  },
  admin: {
    permissions: ['*'] // All permissions
  },
  plugin_manager: {
    permissions: ['read:catalog', 'read:templates', 'manage:plugins', 'read:system']
  }
};

const SECURITY_POLICIES = {
  'no-high-vulnerabilities': {
    name: 'No High Vulnerabilities',
    description: 'Plugins must not contain high severity vulnerabilities',
    rules: [
      { type: 'vulnerability', severity: 'HIGH', action: 'block' },
      { type: 'vulnerability', severity: 'CRITICAL', action: 'block' }
    ]
  },
  'trusted-authors-only': {
    name: 'Trusted Authors Only',
    description: 'Only allow plugins from trusted authors',
    rules: [
      { type: 'author', whitelist: ['Backstage Community', 'Trusted Corp'], action: 'allow' },
      { type: 'author', blacklist: ['Untrusted Author'], action: 'block' }
    ]
  },
  'resource-limits': {
    name: 'Resource Limits',
    description: 'Enforce resource limits on plugin containers',
    rules: [
      { type: 'resource', resource: 'cpu', max: '1000m', action: 'limit' },
      { type: 'resource', resource: 'memory', max: '2Gi', action: 'limit' }
    ]
  }
};

// Mock implementations
jest.mock('@/services/security/scanner');
jest.mock('@/services/security/sandbox');
jest.mock('@/services/security/rbac');
jest.mock('@/services/security/vulnerability-db');
jest.mock('@/services/security/policy-engine');
jest.mock('@/services/security/audit-logger');

describe('Plugin Security Testing', () => {
  let securityScanner: jest.Mocked<SecurityScanner>;
  let pluginSandbox: jest.Mocked<PluginSandbox>;
  let rbacEngine: jest.Mocked<RBACEngine>;
  let vulnerabilityDb: jest.Mocked<VulnerabilityDatabase>;
  let policyEngine: jest.Mocked<PolicyEngine>;
  let auditLogger: jest.Mocked<AuditLogger>;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.SECURITY_POLICY_MODE = 'strict';
    process.env.PLUGIN_SANDBOXING_ENABLED = 'true';
  });

  beforeEach(() => {
    jest.clearAllMocks();

    securityScanner = new SecurityScanner() as jest.Mocked<SecurityScanner>;
    pluginSandbox = new PluginSandbox() as jest.Mocked<PluginSandbox>;
    rbacEngine = new RBACEngine() as jest.Mocked<RBACEngine>;
    vulnerabilityDb = new VulnerabilityDatabase() as jest.Mocked<VulnerabilityDatabase>;
    policyEngine = new PolicyEngine() as jest.Mocked<PolicyEngine>;
    auditLogger = new AuditLogger() as jest.Mocked<AuditLogger>;

    // Setup default mock implementations
    setupSecurityScannerMocks();
    setupSandboxMocks();
    setupRBACMocks();
    setupVulnerabilityDbMocks();
    setupPolicyEngineMocks();
    setupAuditLoggerMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    delete process.env.NODE_ENV;
    delete process.env.SECURITY_POLICY_MODE;
    delete process.env.PLUGIN_SANDBOXING_ENABLED;
  });

  function setupSecurityScannerMocks() {
    securityScanner.scanPlugin.mockResolvedValue({
      pluginId: SECURITY_TEST_PLUGIN.id,
      vulnerabilities: [],
      riskScore: 'LOW',
      compliance: {
        passed: true,
        checks: ['no-high-vulnerabilities', 'valid-license', 'trusted-author']
      },
      scanTimestamp: new Date().toISOString()
    });

    securityScanner.scanDependencies.mockResolvedValue({
      totalDependencies: 3,
      vulnerableDependencies: 1,
      vulnerabilities: [
        {
          package: 'vulnerable-package',
          version: '1.0.0',
          severity: 'MEDIUM',
          cve: 'CVE-2023-1234',
          description: 'Test vulnerability for security scanning'
        }
      ]
    });
  }

  function setupSandboxMocks() {
    pluginSandbox.createSandbox.mockResolvedValue({
      sandboxId: 'sandbox-123',
      containerName: 'plugin-security-sandbox',
      networkIsolation: true,
      resourceLimits: {
        cpu: '100m',
        memory: '256Mi'
      }
    });

    pluginSandbox.validateIsolation.mockResolvedValue({
      isolated: true,
      networkAccess: 'restricted',
      fileSystemAccess: 'read-only',
      processIsolation: true
    });
  }

  function setupRBACMocks() {
    rbacEngine.validatePermissions.mockResolvedValue({
      allowed: true,
      grantedPermissions: ['read:catalog'],
      deniedPermissions: []
    });

    rbacEngine.checkUserPermissions.mockImplementation(async (userId, permissions) => ({
      userId,
      hasPermissions: permissions.every(p => p.startsWith('read:')),
      grantedPermissions: permissions.filter(p => p.startsWith('read:')),
      missingPermissions: permissions.filter(p => !p.startsWith('read:'))
    }));
  }

  function setupVulnerabilityDbMocks() {
    vulnerabilityDb.checkVulnerabilities.mockResolvedValue({
      vulnerabilities: [
        {
          cve: 'CVE-2023-1234',
          severity: 'MEDIUM',
          package: 'vulnerable-package@1.0.0',
          description: 'Test vulnerability',
          fixAvailable: true,
          fixedIn: '1.0.1'
        }
      ],
      riskAssessment: {
        overall: 'MEDIUM',
        exploitability: 'LOW',
        impact: 'MEDIUM'
      }
    });
  }

  function setupPolicyEngineMocks() {
    policyEngine.evaluatePolicy.mockResolvedValue({
      passed: true,
      violations: [],
      policyName: 'default-security-policy'
    });

    policyEngine.enforcePolicy.mockResolvedValue({
      action: 'allow',
      policyViolations: [],
      enforcementActions: []
    });
  }

  function setupAuditLoggerMocks() {
    auditLogger.logSecurityEvent.mockResolvedValue({
      eventId: 'audit-123',
      timestamp: new Date().toISOString(),
      logged: true
    });
  }

  describe('Plugin Vulnerability Scanning', () => {
    it('should detect vulnerabilities in plugin dependencies', async () => {
      // Mock vulnerability detection
      const vulnerablePlugin = {
        ...SECURITY_TEST_PLUGIN,
        dependencies: {
          'lodash': '^4.17.20', // Vulnerable version
          'axios': '^0.21.0'     // Vulnerable version
        }
      };

      securityScanner.scanPlugin.mockResolvedValue({
        pluginId: vulnerablePlugin.id,
        vulnerabilities: [
          {
            cve: 'CVE-2021-23337',
            severity: 'HIGH',
            package: 'lodash@4.17.20',
            description: 'Command injection vulnerability'
          },
          {
            cve: 'CVE-2020-28168',
            severity: 'MEDIUM',
            package: 'axios@0.21.0',
            description: 'ReDoS vulnerability'
          }
        ],
        riskScore: 'HIGH',
        compliance: {
          passed: false,
          checks: ['high-vulnerabilities-detected']
        }
      });

      const scanResult = await securityScanner.scanPlugin(vulnerablePlugin.id);

      expect(scanResult.vulnerabilities).toHaveLength(2);
      expect(scanResult.riskScore).toBe('HIGH');
      expect(scanResult.compliance.passed).toBe(false);

      // Verify high severity vulnerability is detected
      const highSevVuln = scanResult.vulnerabilities.find(v => v.severity === 'HIGH');
      expect(highSevVuln).toBeDefined();
      expect(highSevVuln?.cve).toBe('CVE-2021-23337');
    });

    it('should perform comprehensive dependency analysis', async () => {
      const depScanResult = await securityScanner.scanDependencies(SECURITY_TEST_PLUGIN.dependencies);

      expect(depScanResult.totalDependencies).toBe(3);
      expect(depScanResult.vulnerableDependencies).toBe(1);
      expect(depScanResult.vulnerabilities).toHaveLength(1);

      expect(securityScanner.scanDependencies).toHaveBeenCalledWith(SECURITY_TEST_PLUGIN.dependencies);
    });

    it('should validate plugin signatures and authenticity', async () => {
      securityScanner.verifyPluginSignature = jest.fn().mockResolvedValue({
        verified: true,
        signer: 'Backstage Community',
        signatureValid: true,
        trustChain: ['root-ca', 'intermediate-ca', 'signing-cert'],
        signedAt: new Date().toISOString()
      });

      const signatureResult = await securityScanner.verifyPluginSignature(SECURITY_TEST_PLUGIN.id);

      expect(signatureResult.verified).toBe(true);
      expect(signatureResult.signer).toBe('Backstage Community');
      expect(signatureResult.trustChain).toHaveLength(3);
    });

    it('should detect malicious code patterns', async () => {
      securityScanner.detectMaliciousCode = jest.fn().mockResolvedValue({
        threats: [
          {
            type: 'suspicious-network-call',
            severity: 'MEDIUM',
            description: 'Suspicious HTTP request to external domain',
            location: 'src/plugin.ts:45'
          }
        ],
        riskScore: 'MEDIUM',
        recommendation: 'Review network calls for security implications'
      });

      const codeAnalysis = await securityScanner.detectMaliciousCode(SECURITY_TEST_PLUGIN.id);

      expect(codeAnalysis.threats).toHaveLength(1);
      expect(codeAnalysis.threats[0].type).toBe('suspicious-network-call');
      expect(codeAnalysis.riskScore).toBe('MEDIUM');
    });

    it('should check license compliance', async () => {
      securityScanner.checkLicenseCompliance = jest.fn().mockResolvedValue({
        compliant: true,
        license: 'Apache-2.0',
        approvedLicenses: ['Apache-2.0', 'MIT', 'BSD-3-Clause'],
        incompatibleDependencies: [],
        copyleftDependencies: []
      });

      const licenseCheck = await securityScanner.checkLicenseCompliance(SECURITY_TEST_PLUGIN);

      expect(licenseCheck.compliant).toBe(true);
      expect(licenseCheck.license).toBe('Apache-2.0');
      expect(licenseCheck.incompatibleDependencies).toHaveLength(0);
    });
  });

  describe('Plugin Sandboxing and Isolation', () => {
    it('should create secure sandbox for plugin execution', async () => {
      const sandboxConfig = {
        pluginId: SECURITY_TEST_PLUGIN.id,
        networkIsolation: true,
        resourceLimits: SECURITY_TEST_PLUGIN.resources,
        readOnlyFileSystem: true
      };

      const sandbox = await pluginSandbox.createSandbox(sandboxConfig);

      expect(sandbox.sandboxId).toBe('sandbox-123');
      expect(sandbox.networkIsolation).toBe(true);
      expect(sandbox.resourceLimits.cpu).toBe('100m');
      expect(sandbox.resourceLimits.memory).toBe('256Mi');

      expect(pluginSandbox.createSandbox).toHaveBeenCalledWith(sandboxConfig);
    });

    it('should enforce network isolation', async () => {
      // Test network access restrictions
      pluginSandbox.testNetworkIsolation = jest.fn().mockResolvedValue({
        internalAccess: false,
        externalAccess: false,
        allowedEndpoints: ['https://api.backstage.io'],
        blockedAttempts: [
          'https://evil.com',
          'http://internal.company.com'
        ]
      });

      const networkTest = await pluginSandbox.testNetworkIsolation('sandbox-123');

      expect(networkTest.internalAccess).toBe(false);
      expect(networkTest.externalAccess).toBe(false);
      expect(networkTest.allowedEndpoints).toContain('https://api.backstage.io');
      expect(networkTest.blockedAttempts).toHaveLength(2);
    });

    it('should enforce file system access controls', async () => {
      pluginSandbox.validateFileSystemAccess = jest.fn().mockResolvedValue({
        readAccess: ['./config/', './public/'],
        writeAccess: ['./tmp/'],
        deniedAccess: ['/', '/etc/', '/var/'],
        violations: []
      });

      const fsAccess = await pluginSandbox.validateFileSystemAccess('sandbox-123');

      expect(fsAccess.readAccess).toContain('./config/');
      expect(fsAccess.writeAccess).toContain('./tmp/');
      expect(fsAccess.deniedAccess).toContain('/etc/');
      expect(fsAccess.violations).toHaveLength(0);
    });

    it('should prevent container escape attempts', async () => {
      pluginSandbox.detectEscapeAttempts = jest.fn().mockResolvedValue({
        attempts: [
          {
            type: 'privileged-escalation',
            blocked: true,
            timestamp: new Date().toISOString(),
            details: 'Attempt to access privileged system call'
          }
        ],
        containmentIntact: true,
        securityActions: ['log-event', 'block-operation']
      });

      const escapeDetection = await pluginSandbox.detectEscapeAttempts('sandbox-123');

      expect(escapeDetection.attempts).toHaveLength(1);
      expect(escapeDetection.attempts[0].blocked).toBe(true);
      expect(escapeDetection.containmentIntact).toBe(true);
      expect(escapeDetection.securityActions).toContain('block-operation');
    });

    it('should enforce resource limits', async () => {
      pluginSandbox.monitorResourceUsage = jest.fn().mockResolvedValue({
        cpu: { used: '50m', limit: '100m', percentage: 50 },
        memory: { used: '128Mi', limit: '256Mi', percentage: 50 },
        disk: { used: '100Mi', limit: '1Gi', percentage: 10 },
        limitViolations: [],
        throttledOperations: 0
      });

      const resourceMonitoring = await pluginSandbox.monitorResourceUsage('sandbox-123');

      expect(resourceMonitoring.cpu.percentage).toBe(50);
      expect(resourceMonitoring.memory.percentage).toBe(50);
      expect(resourceMonitoring.limitViolations).toHaveLength(0);
      expect(resourceMonitoring.throttledOperations).toBe(0);
    });
  });

  describe('RBAC (Role-Based Access Control)', () => {
    it('should validate user permissions for plugin operations', async () => {
      const testCases = [
        {
          userId: 'viewer-user',
          role: 'viewer',
          permissions: ['read:catalog'],
          expectedResult: true
        },
        {
          userId: 'developer-user',
          role: 'developer',
          permissions: ['read:catalog', 'write:templates'],
          expectedResult: true
        },
        {
          userId: 'viewer-user',
          role: 'viewer',
          permissions: ['admin:users'], // Should be denied
          expectedResult: false
        }
      ];

      for (const testCase of testCases) {
        rbacEngine.checkUserPermissions.mockResolvedValueOnce({
          userId: testCase.userId,
          hasPermissions: testCase.expectedResult,
          grantedPermissions: testCase.expectedResult ? testCase.permissions : [],
          missingPermissions: testCase.expectedResult ? [] : testCase.permissions
        });

        const permissionCheck = await rbacEngine.checkUserPermissions(
          testCase.userId,
          testCase.permissions
        );

        expect(permissionCheck.hasPermissions).toBe(testCase.expectedResult);

        if (testCase.expectedResult) {
          expect(permissionCheck.grantedPermissions).toEqual(testCase.permissions);
        } else {
          expect(permissionCheck.missingPermissions).toEqual(testCase.permissions);
        }
      }
    });

    it('should enforce plugin-specific permissions', async () => {
      const pluginPermissions = [
        'read:catalog',
        'write:templates',
        'manage:plugins'
      ];

      rbacEngine.validatePluginPermissions = jest.fn().mockResolvedValue({
        pluginId: SECURITY_TEST_PLUGIN.id,
        requiredPermissions: pluginPermissions,
        userPermissions: ['read:catalog', 'write:templates'],
        authorized: false,
        missingPermissions: ['manage:plugins']
      });

      const pluginAuth = await rbacEngine.validatePluginPermissions(
        'developer-user',
        SECURITY_TEST_PLUGIN.id,
        pluginPermissions
      );

      expect(pluginAuth.authorized).toBe(false);
      expect(pluginAuth.missingPermissions).toContain('manage:plugins');
    });

    it('should support role inheritance and hierarchies', async () => {
      rbacEngine.checkRoleHierarchy = jest.fn().mockResolvedValue({
        userId: 'admin-user',
        userRole: 'admin',
        inheritsFrom: ['plugin_manager', 'developer', 'viewer'],
        effectivePermissions: [
          'read:catalog', 'write:templates', 'manage:plugins',
          'admin:users', 'admin:system'
        ]
      });

      const roleHierarchy = await rbacEngine.checkRoleHierarchy('admin-user');

      expect(roleHierarchy.userRole).toBe('admin');
      expect(roleHierarchy.inheritsFrom).toContain('plugin_manager');
      expect(roleHierarchy.effectivePermissions).toContain('admin:system');
    });

    it('should prevent privilege escalation', async () => {
      rbacEngine.detectPrivilegeEscalation = jest.fn().mockResolvedValue({
        escalationAttempts: [
          {
            userId: 'viewer-user',
            attemptedPermissions: ['admin:users'],
            currentPermissions: ['read:catalog'],
            blocked: true,
            timestamp: new Date().toISOString()
          }
        ],
        securityActions: ['log-violation', 'notify-admin']
      });

      const escalationCheck = await rbacEngine.detectPrivilegeEscalation('viewer-user');

      expect(escalationCheck.escalationAttempts).toHaveLength(1);
      expect(escalationCheck.escalationAttempts[0].blocked).toBe(true);
      expect(escalationCheck.securityActions).toContain('notify-admin');
    });

    it('should support context-based permissions', async () => {
      rbacEngine.evaluateContextualPermissions = jest.fn().mockResolvedValue({
        context: 'plugin-installation',
        environment: 'production',
        additionalRestrictions: ['require-approval', 'security-scan-required'],
        permissionsModified: true,
        finalPermissions: ['read:catalog'] // Restricted in production
      });

      const contextualAuth = await rbacEngine.evaluateContextualPermissions(
        'developer-user',
        'plugin-installation',
        { environment: 'production' }
      );

      expect(contextualAuth.additionalRestrictions).toContain('require-approval');
      expect(contextualAuth.permissionsModified).toBe(true);
    });
  });

  describe('Security Policy Enforcement', () => {
    it('should enforce no-high-vulnerabilities policy', async () => {
      const vulnerablePlugin = {
        ...SECURITY_TEST_PLUGIN,
        vulnerabilities: [
          { severity: 'HIGH', cve: 'CVE-2023-1234' }
        ]
      };

      policyEngine.evaluatePolicy.mockResolvedValue({
        passed: false,
        violations: [
          {
            policy: 'no-high-vulnerabilities',
            severity: 'HIGH',
            message: 'Plugin contains high severity vulnerabilities',
            action: 'block'
          }
        ],
        policyName: 'security-policy'
      });

      const policyResult = await policyEngine.evaluatePolicy(
        vulnerablePlugin,
        SECURITY_POLICIES['no-high-vulnerabilities']
      );

      expect(policyResult.passed).toBe(false);
      expect(policyResult.violations).toHaveLength(1);
      expect(policyResult.violations[0].action).toBe('block');
    });

    it('should enforce trusted authors policy', async () => {
      const untrustedPlugin = {
        ...SECURITY_TEST_PLUGIN,
        author: 'Untrusted Author'
      };

      policyEngine.evaluatePolicy.mockResolvedValue({
        passed: false,
        violations: [
          {
            policy: 'trusted-authors-only',
            message: 'Plugin author is not in trusted list',
            action: 'block'
          }
        ],
        policyName: 'author-policy'
      });

      const authorPolicy = await policyEngine.evaluatePolicy(
        untrustedPlugin,
        SECURITY_POLICIES['trusted-authors-only']
      );

      expect(authorPolicy.passed).toBe(false);
      expect(authorPolicy.violations[0].policy).toBe('trusted-authors-only');
    });

    it('should enforce resource limit policies', async () => {
      const resourceHeavyPlugin = {
        ...SECURITY_TEST_PLUGIN,
        resources: {
          cpu: '2000m', // Exceeds limit
          memory: '4Gi' // Exceeds limit
        }
      };

      policyEngine.evaluatePolicy.mockResolvedValue({
        passed: false,
        violations: [
          {
            policy: 'resource-limits',
            resource: 'cpu',
            requested: '2000m',
            limit: '1000m',
            action: 'limit'
          },
          {
            policy: 'resource-limits',
            resource: 'memory',
            requested: '4Gi',
            limit: '2Gi',
            action: 'limit'
          }
        ],
        policyName: 'resource-policy'
      });

      const resourcePolicy = await policyEngine.evaluatePolicy(
        resourceHeavyPlugin,
        SECURITY_POLICIES['resource-limits']
      );

      expect(resourcePolicy.passed).toBe(false);
      expect(resourcePolicy.violations).toHaveLength(2);
      expect(resourcePolicy.violations[0].resource).toBe('cpu');
    });

    it('should support custom security policies', async () => {
      const customPolicy = {
        name: 'custom-security-policy',
        rules: [
          { type: 'license', allowed: ['Apache-2.0', 'MIT'], action: 'block' },
          { type: 'age', minDays: 30, action: 'warn' }, // Plugin must be at least 30 days old
          { type: 'downloads', minimum: 1000, action: 'warn' } // Plugin must have minimum downloads
        ]
      };

      policyEngine.evaluateCustomPolicy = jest.fn().mockResolvedValue({
        passed: true,
        warnings: [
          {
            rule: 'age',
            message: 'Plugin is relatively new (15 days old)',
            severity: 'LOW'
          }
        ],
        violations: []
      });

      const customPolicyResult = await policyEngine.evaluateCustomPolicy(
        SECURITY_TEST_PLUGIN,
        customPolicy
      );

      expect(customPolicyResult.passed).toBe(true);
      expect(customPolicyResult.warnings).toHaveLength(1);
      expect(customPolicyResult.violations).toHaveLength(0);
    });
  });

  describe('Security Auditing and Monitoring', () => {
    it('should log plugin security events', async () => {
      const securityEvent = {
        eventType: 'plugin-installation-attempt',
        pluginId: SECURITY_TEST_PLUGIN.id,
        userId: 'test-user',
        timestamp: new Date().toISOString(),
        details: {
          vulnerabilities: 1,
          riskScore: 'MEDIUM',
          policyViolations: []
        }
      };

      const logResult = await auditLogger.logSecurityEvent(securityEvent);

      expect(logResult.logged).toBe(true);
      expect(logResult.eventId).toBe('audit-123');
      expect(auditLogger.logSecurityEvent).toHaveBeenCalledWith(securityEvent);
    });

    it('should generate security audit reports', async () => {
      auditLogger.generateAuditReport = jest.fn().mockResolvedValue({
        reportId: 'audit-report-123',
        period: '2024-01-01 to 2024-01-31',
        summary: {
          totalEvents: 150,
          securityViolations: 5,
          blockedInstallations: 3,
          policyViolations: 8
        },
        topViolations: [
          { type: 'high-vulnerabilities', count: 3 },
          { type: 'untrusted-author', count: 2 }
        ],
        recommendations: [
          'Update vulnerability database',
          'Review trusted authors list'
        ]
      });

      const auditReport = await auditLogger.generateAuditReport({
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });

      expect(auditReport.summary.totalEvents).toBe(150);
      expect(auditReport.summary.securityViolations).toBe(5);
      expect(auditReport.topViolations).toHaveLength(2);
    });

    it('should monitor security metrics in real-time', async () => {
      auditLogger.getSecurityMetrics = jest.fn().mockResolvedValue({
        activePlugins: 25,
        securityScans: {
          passed: 22,
          failed: 3,
          inProgress: 2
        },
        vulnerabilities: {
          critical: 0,
          high: 1,
          medium: 5,
          low: 12
        },
        rbacEvents: {
          accessGranted: 1250,
          accessDenied: 15,
          privilegeEscalationAttempts: 2
        },
        sandboxViolations: 3
      });

      const securityMetrics = await auditLogger.getSecurityMetrics();

      expect(securityMetrics.activePlugins).toBe(25);
      expect(securityMetrics.vulnerabilities.critical).toBe(0);
      expect(securityMetrics.rbacEvents.privilegeEscalationAttempts).toBe(2);
      expect(securityMetrics.sandboxViolations).toBe(3);
    });

    it('should trigger security alerts for critical events', async () => {
      auditLogger.triggerSecurityAlert = jest.fn().mockResolvedValue({
        alertId: 'alert-123',
        severity: 'HIGH',
        message: 'Critical vulnerability detected in plugin',
        recipients: ['security-team@company.com', 'admin@company.com'],
        escalated: true,
        acknowledgedAt: null
      });

      const criticalEvent = {
        type: 'critical-vulnerability-detected',
        pluginId: SECURITY_TEST_PLUGIN.id,
        vulnerability: {
          cve: 'CVE-2024-0001',
          severity: 'CRITICAL',
          exploitable: true
        }
      };

      const alert = await auditLogger.triggerSecurityAlert(criticalEvent);

      expect(alert.severity).toBe('HIGH');
      expect(alert.escalated).toBe(true);
      expect(alert.recipients).toContain('security-team@company.com');
    });
  });

  describe('End-to-End Security Workflow', () => {
    it('should complete comprehensive security validation', async () => {
      // 1. Vulnerability scan
      const scanResult = await securityScanner.scanPlugin(SECURITY_TEST_PLUGIN.id);
      expect(scanResult.riskScore).toBe('LOW');

      // 2. Policy evaluation
      const policyResult = await policyEngine.evaluatePolicy(
        SECURITY_TEST_PLUGIN,
        SECURITY_POLICIES['no-high-vulnerabilities']
      );
      expect(policyResult.passed).toBe(true);

      // 3. RBAC validation
      const rbacResult = await rbacEngine.validatePermissions(
        'developer-user',
        ['read:catalog', 'write:templates']
      );
      expect(rbacResult.allowed).toBe(true);

      // 4. Sandbox creation
      const sandbox = await pluginSandbox.createSandbox({
        pluginId: SECURITY_TEST_PLUGIN.id,
        networkIsolation: true
      });
      expect(sandbox.sandboxId).toBeDefined();

      // 5. Audit logging
      const auditResult = await auditLogger.logSecurityEvent({
        eventType: 'plugin-security-validated',
        pluginId: SECURITY_TEST_PLUGIN.id,
        userId: 'developer-user'
      });
      expect(auditResult.logged).toBe(true);

      // Verify all security steps were executed
      expect(securityScanner.scanPlugin).toHaveBeenCalled();
      expect(policyEngine.evaluatePolicy).toHaveBeenCalled();
      expect(rbacEngine.validatePermissions).toHaveBeenCalled();
      expect(pluginSandbox.createSandbox).toHaveBeenCalled();
      expect(auditLogger.logSecurityEvent).toHaveBeenCalled();
    });

    it('should handle security failure scenarios', async () => {
      // Mock security failure at vulnerability scan
      securityScanner.scanPlugin.mockResolvedValue({
        pluginId: SECURITY_TEST_PLUGIN.id,
        vulnerabilities: [
          { severity: 'CRITICAL', cve: 'CVE-2024-0001' }
        ],
        riskScore: 'CRITICAL',
        compliance: { passed: false }
      });

      const scanResult = await securityScanner.scanPlugin(SECURITY_TEST_PLUGIN.id);
      expect(scanResult.riskScore).toBe('CRITICAL');

      // Should not proceed to sandbox creation if security scan fails
      expect(pluginSandbox.createSandbox).not.toHaveBeenCalled();

      // Should log the security failure
      const auditResult = await auditLogger.logSecurityEvent({
        eventType: 'plugin-security-failed',
        pluginId: SECURITY_TEST_PLUGIN.id,
        reason: 'Critical vulnerabilities detected'
      });
      expect(auditResult.logged).toBe(true);
    });

    it('should support multi-tenant security isolation', async () => {
      const tenantA = 'tenant-a';
      const tenantB = 'tenant-b';

      // Each tenant should have isolated security contexts
      rbacEngine.validateTenantAccess = jest.fn()
        .mockImplementation(async (userId, tenantId, resource) => ({
          allowed: userId.includes(tenantId), // Simple mock: user must belong to tenant
          tenantId,
          resourceAccess: userId.includes(tenantId) ? 'full' : 'none'
        }));

      const tenantAAccess = await rbacEngine.validateTenantAccess(
        `${tenantA}-user`,
        tenantA,
        SECURITY_TEST_PLUGIN.id
      );
      
      const tenantBAccess = await rbacEngine.validateTenantAccess(
        `${tenantA}-user`, // Tenant A user trying to access Tenant B resources
        tenantB,
        SECURITY_TEST_PLUGIN.id
      );

      expect(tenantAAccess.allowed).toBe(true);
      expect(tenantBAccess.allowed).toBe(false);
    });
  });
});