import { NextRequest } from 'next/server';
import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

// Mock bcryptjs before any imports
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('$2a$10$hashedpassword'),
}));

// Mock the database client - using the correct API pattern (method-based)
const mockDbFindUnique = jest.fn();
const mockDbFindFirst = jest.fn();
const mockDbCreate = jest.fn();
const mockDbUpdate = jest.fn();
const mockDbFindMany = jest.fn();

jest.mock('@/lib/database/simple-client', () => ({
  db: {
    findUnique: (...args: any[]) => mockDbFindUnique(...args),
    findFirst: (...args: any[]) => mockDbFindFirst(...args),
    create: (...args: any[]) => mockDbCreate(...args),
    update: (...args: any[]) => mockDbUpdate(...args),
    findMany: (...args: any[]) => mockDbFindMany(...args),
    healthCheck: jest.fn().mockResolvedValue(true),
    getMetrics: jest.fn().mockReturnValue({ totalConnections: 1 }),
    getPrisma: jest.fn(() => ({
      $transaction: jest.fn((fn: any) => fn()),
    })),
  },
}));

// Mock the JWT security module
const mockJwtSecurity = {
  initialize: jest.fn().mockResolvedValue(undefined),
  generateDeviceFingerprint: jest.fn().mockReturnValue('mock-fingerprint'),
  generateAccessToken: jest.fn().mockResolvedValue('mock-access-token'),
  generateRefreshToken: jest.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
  revokeToken: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@/lib/auth/jwt-security-enhanced', () => ({
  jwtSecurity: mockJwtSecurity,
}));

// Mock the session security module
const mockSessionManager = {
  createSession: jest.fn().mockResolvedValue({
    id: 'session-123',
    userId: 'user-123',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }),
  validateSession: jest.fn().mockResolvedValue({ valid: true }),
  revokeSession: jest.fn().mockResolvedValue(undefined),
  getSession: jest.fn(),
};

jest.mock('@/lib/auth/session-security-enhanced', () => ({
  enhancedSessionManager: mockSessionManager,
}));

// Mock the Redis client used by sessions
jest.mock('@/lib/db/client', () => ({
  sessionRedis: {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue('PONG'),
  },
}));

// Mock lru-cache
jest.mock('lru-cache', () => ({
  LRUCache: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    has: jest.fn().mockReturnValue(false),
    delete: jest.fn(),
  })),
}));

// Import bcryptjs after mocking
const { compare } = require('bcryptjs');

describe('Authentication API Endpoints', () => {
  beforeEach(() => {
    const { __resetLoginAttemptsForTests } = require('@/app/api/auth/login/route');
    __resetLoginAttemptsForTests();
    jest.clearAllMocks();
    // Reset all mock implementations
    mockDbFindUnique.mockReset();
    mockDbFindFirst.mockReset();
    mockDbCreate.mockReset();
    mockDbUpdate.mockReset();
    mockDbFindMany.mockReset();

    // Default implementations
    mockDbFindFirst.mockResolvedValue(null);
    mockDbCreate.mockImplementation((model: string, args: any) =>
      Promise.resolve({ id: 'created-id', ...args.data }),
    );
    mockDbUpdate.mockImplementation((model: string, args: any) =>
      Promise.resolve({ id: args.where?.id || 'updated', ...args.data }),
    );

    // Reset session manager
    mockSessionManager.createSession.mockResolvedValue({
      id: 'session-123',
      userId: 'user-123',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  });

  afterEach(() => {
    // Don't reset modules as it breaks the mock chain
    // jest.resetModules();
  });

  describe('POST /api/auth/login', () => {
    // Dynamic import to allow mocks to be set up first
    const getLoginRoute = () => require('@/app/api/auth/login/route').POST;

    it('should authenticate user with valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@company.com',
        name: 'Test User',
        tenantId: 'tenant-123',
        role: 'user',
        isActive: true,
        password: '$2a$10$hashedpassword',
        emailVerified: new Date(),
      };

      mockDbFindUnique.mockImplementation((model: string) => {
        if (model === 'user') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      });

      compare.mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'ValidPassword123!',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.user.email).toBe(mockUser.email);
    });

    it('should reject when user is not found', async () => {
      mockDbFindUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid@company.com',
          password: 'WrongPassword123!',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid');
    });

    it('should reject when password is incorrect', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@company.com',
        name: 'Test User',
        isActive: true,
        password: '$2a$10$hashedpassword',
      };

      mockDbFindUnique.mockImplementation((model: string) => {
        if (model === 'user') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      });

      compare.mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'WrongPassword123!',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should validate input format - invalid email', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'invalid-email',
          password: 'ValidPassword123!',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid input');
    });

    it('should validate input format - empty password', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
          password: '',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(400);
    });

    it('should reject deactivated user accounts', async () => {
      const inactiveUser = {
        id: 'user-123',
        email: 'user@company.com',
        name: 'Test User',
        isActive: false,
        password: '$2a$10$hashedpassword',
      };

      mockDbFindUnique.mockImplementation((model: string) => {
        if (model === 'user') return Promise.resolve(inactiveUser);
        return Promise.resolve(null);
      });

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'ValidPassword123!',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('deactivated');
    });

    it('should reject users without password login enabled', async () => {
      const oauthUser = {
        id: 'user-123',
        email: 'oauth@company.com',
        name: 'OAuth User',
        isActive: true,
        password: null, // OAuth-only user
      };

      mockDbFindUnique.mockImplementation((model: string) => {
        if (model === 'user') return Promise.resolve(oauthUser);
        return Promise.resolve(null);
      });

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'oauth@company.com',
          password: 'SomePassword123!',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('not available');
    });

    it('should set secure cookies on successful login', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@company.com',
        name: 'Test User',
        tenantId: 'tenant-123',
        role: 'user',
        isActive: true,
        password: '$2a$10$hashedpassword',
      };

      mockDbFindUnique.mockImplementation((model: string) => {
        if (model === 'user') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      });

      compare.mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'ValidPassword123!',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(200);

      // Verify cookies are set
      const cookies = response.cookies.getAll();
      const cookieNames = cookies.map((c: any) => c.name);
      expect(cookieNames).toContain('access-token');
      expect(cookieNames).toContain('refresh-token');
      expect(cookieNames).toContain('session-id');
    });

    it('should add security headers to response', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@company.com',
        name: 'Test User',
        isActive: true,
        password: '$2a$10$hashedpassword',
      };

      mockDbFindUnique.mockImplementation((model: string) => {
        if (model === 'user') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      });

      compare.mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'ValidPassword123!',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('Cache-Control')).toContain('no-store');
    });

    it('should handle database errors gracefully', async () => {
      mockDbFindUnique.mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'ValidPassword123!',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('error');
    });

    it('should log successful login for audit', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@company.com',
        name: 'Test User',
        isActive: true,
        password: '$2a$10$hashedpassword',
        role: 'user',
      };

      mockDbFindUnique.mockImplementation((model: string) => {
        if (model === 'user') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      });

      compare.mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'ValidPassword123!',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(200);

      // Verify audit log was created
      expect(mockDbCreate).toHaveBeenCalledWith(
        'auditLog',
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LOGIN_SUCCESS',
            userId: 'user-123',
          }),
        }),
      );
    });

    it('should log failed login attempts for security audit', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@company.com',
        name: 'Test User',
        isActive: true,
        password: '$2a$10$hashedpassword',
      };

      mockDbFindUnique.mockImplementation((model: string) => {
        if (model === 'user') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      });

      compare.mockResolvedValue(false);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'WrongPassword123!',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(401);

      // Verify failed login was logged
      expect(mockDbCreate).toHaveBeenCalledWith(
        'auditLog',
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'LOGIN_FAILED',
          }),
        }),
      );
    });
  });

  describe('Input Validation', () => {
    const getLoginRoute = () => require('@/app/api/auth/login/route').POST;

    it('should reject missing email', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: 'password123',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(400);
    });

    it('should reject missing password', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(400);
    });

    it('should reject empty request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(400);
    });

    it('should handle invalid JSON gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json',
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      // Should return 500 since JSON parsing fails in the try block
      expect(response.status).toBe(500);
    });

    it('should normalize email to lowercase', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@company.com',
        name: 'Test User',
        isActive: true,
        password: '$2a$10$hashedpassword',
        role: 'user',
      };

      mockDbFindUnique.mockImplementation((model: string) => {
        if (model === 'user') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      });

      compare.mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'USER@COMPANY.COM', // Uppercase
          password: 'ValidPassword123!',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(200);

      // Verify that the email was normalized when querying
      expect(mockDbFindUnique).toHaveBeenCalledWith(
        'user',
        expect.objectContaining({
          where: expect.objectContaining({
            email: 'user@company.com', // Should be lowercase
          }),
        }),
      );
    });
  });

  describe('Session Management', () => {
    const getLoginRoute = () => require('@/app/api/auth/login/route').POST;

    it('should create a session on successful login', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@company.com',
        name: 'Test User',
        isActive: true,
        password: '$2a$10$hashedpassword',
        role: 'user',
        tenantId: 'tenant-123',
      };

      mockDbFindUnique.mockImplementation((model: string) => {
        if (model === 'user') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      });

      compare.mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'ValidPassword123!',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(200);

      // Verify session was created
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        'user-123',
        'user@company.com',
        'user',
        expect.any(Object), // device info
        expect.any(Object), // security context
        'tenant-123',
      );
    });

    it('should update last login timestamp', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@company.com',
        name: 'Test User',
        isActive: true,
        password: '$2a$10$hashedpassword',
        role: 'user',
      };

      mockDbFindUnique.mockImplementation((model: string) => {
        if (model === 'user') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      });

      compare.mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'ValidPassword123!',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.status).toBe(200);

      // Verify last login was updated
      expect(mockDbUpdate).toHaveBeenCalledWith(
        'user',
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            lastLogin: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('Security Features', () => {
    const getLoginRoute = () => require('@/app/api/auth/login/route').POST;

    it('should include request ID in response', async () => {
      mockDbFindUnique.mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'password',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      const data = await response.json();
      expect(data.requestId).toBeDefined();
      expect(typeof data.requestId).toBe('string');
    });

    it('should set XSS protection header', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'user@company.com',
        isActive: true,
        password: '$2a$10$hashedpassword',
        role: 'user',
      };

      mockDbFindUnique.mockImplementation((model: string) => {
        if (model === 'user') return Promise.resolve(mockUser);
        return Promise.resolve(null);
      });

      compare.mockResolvedValue(true);

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@company.com',
          password: 'ValidPassword123!',
        }),
      });

      const loginPOST = getLoginRoute();
      const response = await loginPOST(request);

      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });
  });
});
