import { NextRequest } from 'next/server';
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

// Mock external dependencies
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/auth', () => ({
  authOptions: {
    providers: [],
    callbacks: {},
  },
  validateSession: jest.fn(),
  createSession: jest.fn(),
  revokeSession: jest.fn(),
}));

jest.mock('@/lib/database/client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    session: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/security/rate-limiter', () => ({
  checkRateLimit: jest.fn(),
  incrementAttempts: jest.fn(),
  resetAttempts: jest.fn(),
}));

jest.mock('@/lib/monitoring/audit-logger', () => ({
  logAuthEvent: jest.fn(),
  logSecurityEvent: jest.fn(),
}));

// Import route handlers after mocking
const { POST: loginPOST } = require('@/app/api/auth/login/route');
const { POST: logoutPOST } = require('@/app/api/auth/logout/route');
const { GET: meGET } = require('@/app/api/auth/me/route');
const { POST: registerPOST } = require('@/app/api/auth/register/route');

describe('Authentication API Endpoints', () => {
  const mockPrisma = require('@/lib/database/client').prisma;
  const mockAuthLib = require('@/lib/auth');
  const mockRateLimit = require('@/lib/security/rate-limiter');
  const mockAuditLogger = require('@/lib/monitoring/audit-logger');

  beforeEach(() => {
    jest.clearAllMocks();
    mockRateLimit.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 10 });
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate user with valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@company.com',
        name: 'Test User',
        tenantId: 'tenant-123',
        role: 'user',
        isActive: true,
        emailVerified: new Date(),
      };

      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        token: 'jwt-token-123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockAuthLib.validateSession.mockResolvedValue(true);
      mockAuthLib.createSession.mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'ValidPassword123!',
        }),
      });

      const response = await loginPOST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        tenantId: mockUser.tenantId,
      });
      expect(data.token).toBe(mockSession.token);
      expect(mockAuditLogger.logAuthEvent).toHaveBeenCalledWith('login_success', mockUser.id);
    });

    it('should reject invalid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid@company.com',
          password: 'WrongPassword',
        }),
      });

      const response = await loginPOST(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid credentials');
      expect(mockAuditLogger.logSecurityEvent).toHaveBeenCalledWith('login_failed', expect.any(Object));
    });

    it('should enforce rate limiting', async () => {
      mockRateLimit.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetTime: Date.now() + 60000 });

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
        },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'password',
        }),
      });

      const response = await loginPOST(request);
      
      expect(response.status).toBe(429);
      const data = await response.json();
      expect(data.error).toContain('Too many login attempts');
      expect(response.headers.get('Retry-After')).toBeDefined();
    });

    it('should validate input format', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email',
          password: '',
        }),
      });

      const response = await loginPOST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid input');
    });

    it('should handle inactive user accounts', async () => {
      const inactiveUser = {
        id: 'user-123',
        email: 'user@company.com',
        name: 'Test User',
        tenantId: 'tenant-123',
        role: 'user',
        isActive: false,
        emailVerified: new Date(),
      };

      mockPrisma.user.findUnique.mockResolvedValue(inactiveUser);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'ValidPassword123!',
        }),
      });

      const response = await loginPOST(request);
      
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Account is inactive');
    });

    it('should handle multi-tenant login correctly', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@company.com',
        name: 'Test User',
        tenantId: 'tenant-123',
        role: 'admin',
        isActive: true,
        emailVerified: new Date(),
      };

      const mockTenant = {
        id: 'tenant-123',
        name: 'Company Inc',
        domain: 'company.com',
        isActive: true,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockAuthLib.createSession.mockResolvedValue({
        id: 'session-123',
        userId: 'user-123',
        token: 'jwt-token-123',
        tenantId: 'tenant-123',
      });

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-domain': 'company.com',
        },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'ValidPassword123!',
        }),
      });

      const response = await loginPOST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.tenant).toMatchObject({
        id: mockTenant.id,
        name: mockTenant.name,
        domain: mockTenant.domain,
      });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user successfully', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        token: 'jwt-token-123',
        user: {
          id: 'user-123',
          email: 'user@company.com',
        },
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockAuthLib.revokeSession.mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer jwt-token-123',
        },
      });

      const response = await logoutPOST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('Logged out successfully');
      expect(mockAuditLogger.logAuthEvent).toHaveBeenCalledWith('logout_success', 'user-123');
    });

    it('should handle logout with invalid session', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid-token',
        },
      });

      const response = await logoutPOST(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Invalid session');
    });

    it('should logout from all devices when specified', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        token: 'jwt-token-123',
        user: {
          id: 'user-123',
          email: 'user@company.com',
        },
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);
      mockPrisma.session.deleteMany.mockResolvedValue({ count: 3 });

      const request = new NextRequest('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer jwt-token-123',
        },
        body: JSON.stringify({ logoutAll: true }),
      });

      const response = await logoutPOST(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('all devices');
      expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@company.com',
        name: 'Test User',
        tenantId: 'tenant-123',
        role: 'admin',
        isActive: true,
        emailVerified: new Date(),
        tenant: {
          id: 'tenant-123',
          name: 'Company Inc',
          domain: 'company.com',
        },
      };

      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        token: 'jwt-token-123',
        user: mockUser,
      };

      mockPrisma.session.findUnique.mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: { 
          'Authorization': 'Bearer jwt-token-123',
        },
      });

      const response = await meGET(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
      });
      expect(data.tenant).toMatchObject({
        id: mockUser.tenant.id,
        name: mockUser.tenant.name,
      });
    });

    it('should handle unauthorized requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/me');

      const response = await meGET(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Unauthorized');
    });

    it('should handle expired sessions', async () => {
      const expiredSession = {
        id: 'session-123',
        userId: 'user-123',
        token: 'jwt-token-123',
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      mockPrisma.session.findUnique.mockResolvedValue(expiredSession);

      const request = new NextRequest('http://localhost:3000/api/auth/me', {
        headers: { 
          'Authorization': 'Bearer jwt-token-123',
        },
      });

      const response = await meGET(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Session expired');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user successfully', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Company Inc',
        domain: 'company.com',
        isActive: true,
        allowRegistration: true,
      };

      const newUser = {
        id: 'user-123',
        email: 'newuser@company.com',
        name: 'New User',
        tenantId: 'tenant-123',
        role: 'user',
        isActive: true,
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrisma.user.findUnique.mockResolvedValue(null); // User doesn't exist
      mockPrisma.user.create.mockResolvedValue(newUser);

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-domain': 'company.com',
        },
        body: JSON.stringify({
          email: 'newuser@company.com',
          password: 'SecurePassword123!',
          name: 'New User',
        }),
      });

      const response = await registerPOST(request);
      
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user.email).toBe('newuser@company.com');
      expect(mockAuditLogger.logAuthEvent).toHaveBeenCalledWith('user_registered', newUser.id);
    });

    it('should reject registration for existing user', async () => {
      const existingUser = {
        id: 'user-123',
        email: 'existing@company.com',
        name: 'Existing User',
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'existing@company.com',
          password: 'SecurePassword123!',
          name: 'New User',
        }),
      });

      const response = await registerPOST(request);
      
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toContain('already exists');
    });

    it('should validate password strength', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@company.com',
          password: '123', // Weak password
          name: 'New User',
        }),
      });

      const response = await registerPOST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Password requirements');
    });

    it('should handle tenant domain validation', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-domain': 'invalid-domain.com',
        },
        body: JSON.stringify({
          email: 'newuser@invalid-domain.com',
          password: 'SecurePassword123!',
          name: 'New User',
        }),
      });

      const response = await registerPOST(request);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid tenant');
    });

    it('should prevent registration when disabled for tenant', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Company Inc',
        domain: 'company.com',
        isActive: true,
        allowRegistration: false, // Registration disabled
      };

      mockPrisma.tenant.findUnique.mockResolvedValue(mockTenant);

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-domain': 'company.com',
        },
        body: JSON.stringify({
          email: 'newuser@company.com',
          password: 'SecurePassword123!',
          name: 'New User',
        }),
      });

      const response = await registerPOST(request);
      
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Registration is disabled');
    });
  });

  describe('Security and Multi-tenant Features', () => {
    it('should enforce tenant isolation in authentication', async () => {
      const userFromDifferentTenant = {
        id: 'user-456',
        email: 'user@othertenant.com',
        tenantId: 'tenant-456',
        isActive: true,
      };

      mockPrisma.user.findUnique.mockResolvedValue(userFromDifferentTenant);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-tenant-domain': 'company.com', // Different tenant
        },
        body: JSON.stringify({
          email: 'user@othertenant.com',
          password: 'ValidPassword123!',
        }),
      });

      const response = await loginPOST(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Invalid credentials');
    });

    it('should handle concurrent login attempts', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@company.com',
        isActive: true,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockAuthLib.createSession.mockResolvedValue({
        id: 'session-123',
        token: 'jwt-token-123',
      });

      const requests = Array.from({ length: 3 }, () =>
        loginPOST(new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'user@company.com',
            password: 'ValidPassword123!',
          }),
        }))
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed (concurrent logins allowed)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should audit failed authentication attempts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Mozilla/5.0 (Test Browser)',
        },
        body: JSON.stringify({
          email: 'attacker@evil.com',
          password: 'password',
        }),
      });

      await loginPOST(request);
      
      expect(mockAuditLogger.logSecurityEvent).toHaveBeenCalledWith(
        'login_failed',
        expect.objectContaining({
          email: 'attacker@evil.com',
          ip: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Test Browser)',
        })
      );
    });

    it('should handle database transaction failures gracefully', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('Database connection lost'));

      const request = new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'newuser@company.com',
          password: 'SecurePassword123!',
          name: 'New User',
        }),
      });

      const response = await registerPOST(request);
      
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Registration failed');
    });
  });
});