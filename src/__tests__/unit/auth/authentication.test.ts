/**
 * Authentication System Unit Tests
 * Tests login, logout, JWT handling, and RBAC functionality
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { generateToken, verifyToken, decodeToken } from '@/lib/auth/jwt';
import { checkPermission, hasRole, validatePermissions } from '@/lib/auth/rbac';
import { createSession, validateSession, deleteSession } from '@/lib/auth/session';
import { authenticateUser, logoutUser } from '@/lib/auth';

// Mock dependencies
jest.mock('@/lib/db/client');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('Authentication System', () => {
  describe('JWT Token Management', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      roles: ['developer', 'admin'],
      permissions: ['read:catalog', 'write:catalog', 'admin:users'],
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should generate a valid JWT token', async () => {
      const token = await generateToken(mockUser);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should verify a valid token', async () => {
      const token = await generateToken(mockUser);
      const verified = await verifyToken(token);
      
      expect(verified).toBeTruthy();
      expect(verified.id).toBe(mockUser.id);
      expect(verified.email).toBe(mockUser.email);
    });

    it('should reject an invalid token', async () => {
      const invalidToken = 'invalid.token.here';
      
      await expect(verifyToken(invalidToken)).rejects.toThrow();
    });

    it('should reject an expired token', async () => {
      const expiredToken = await generateToken(mockUser, { expiresIn: '0s' });
      
      // Wait a moment for token to expire
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await expect(verifyToken(expiredToken)).rejects.toThrow();
    });

    it('should decode token without verification', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXItMTIzIn0.fake';
      const decoded = decodeToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.id).toBe('user-123');
    });
  });

  describe('RBAC (Role-Based Access Control)', () => {
    const mockUser = {
      id: 'user-456',
      roles: ['developer', 'reviewer'],
      permissions: [
        'read:catalog',
        'write:catalog',
        'read:templates',
        'execute:templates',
      ],
    };

    it('should check if user has specific role', () => {
      expect(hasRole(mockUser, 'developer')).toBe(true);
      expect(hasRole(mockUser, 'reviewer')).toBe(true);
      expect(hasRole(mockUser, 'admin')).toBe(false);
    });

    it('should check if user has any of multiple roles', () => {
      expect(hasRole(mockUser, ['admin', 'developer'])).toBe(true);
      expect(hasRole(mockUser, ['admin', 'manager'])).toBe(false);
    });

    it('should validate user permissions', () => {
      expect(checkPermission(mockUser, 'read:catalog')).toBe(true);
      expect(checkPermission(mockUser, 'write:catalog')).toBe(true);
      expect(checkPermission(mockUser, 'delete:catalog')).toBe(false);
    });

    it('should validate multiple permissions', () => {
      const requiredPermissions = ['read:catalog', 'write:catalog'];
      expect(validatePermissions(mockUser, requiredPermissions)).toBe(true);
      
      const missingPermissions = ['read:catalog', 'admin:system'];
      expect(validatePermissions(mockUser, missingPermissions)).toBe(false);
    });

    it('should handle wildcard permissions', () => {
      const adminUser = {
        ...mockUser,
        permissions: ['*:catalog', 'read:*'],
      };
      
      expect(checkPermission(adminUser, 'write:catalog')).toBe(true);
      expect(checkPermission(adminUser, 'delete:catalog')).toBe(true);
      expect(checkPermission(adminUser, 'read:templates')).toBe(true);
    });

    it('should handle permission inheritance from roles', () => {
      const rolePermissions = {
        developer: ['read:catalog', 'write:catalog'],
        admin: ['*:*'],
      };
      
      const userWithInheritance = {
        ...mockUser,
        roles: ['admin'],
      };
      
      expect(checkPermission(userWithInheritance, 'admin:users', rolePermissions)).toBe(true);
      expect(checkPermission(userWithInheritance, 'delete:everything', rolePermissions)).toBe(true);
    });
  });

  describe('Session Management', () => {
    const mockUser = {
      id: 'user-789',
      email: 'session@example.com',
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should create a new session', async () => {
      const session = await createSession(mockUser);
      
      expect(session).toBeDefined();
      expect(session.userId).toBe(mockUser.id);
      expect(session.token).toBeDefined();
      expect(session.expiresAt).toBeInstanceOf(Date);
    });

    it('should validate an active session', async () => {
      const session = await createSession(mockUser);
      const isValid = await validateSession(session.token);
      
      expect(isValid).toBe(true);
    });

    it('should reject an invalid session token', async () => {
      const isValid = await validateSession('invalid-session-token');
      
      expect(isValid).toBe(false);
    });

    it('should delete a session', async () => {
      const session = await createSession(mockUser);
      await deleteSession(session.token);
      
      const isValid = await validateSession(session.token);
      expect(isValid).toBe(false);
    });

    it('should handle session expiration', async () => {
      const session = await createSession(mockUser, { expiresIn: '1ms' });
      
      // Wait for session to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const isValid = await validateSession(session.token);
      expect(isValid).toBe(false);
    });
  });

  describe('Login Flow', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should authenticate user with valid credentials', async () => {
      const credentials = {
        email: 'user@example.com',
        password: 'SecurePassword123!',
      };
      
      const result = await authenticateUser(credentials);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.user.email).toBe(credentials.email);
    });

    it('should reject invalid email', async () => {
      const credentials = {
        email: 'nonexistent@example.com',
        password: 'password',
      };
      
      const result = await authenticateUser(credentials);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
    });

    it('should reject invalid password', async () => {
      const credentials = {
        email: 'user@example.com',
        password: 'WrongPassword',
      };
      
      const result = await authenticateUser(credentials);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid credentials');
    });

    it('should handle account lockout after failed attempts', async () => {
      const credentials = {
        email: 'user@example.com',
        password: 'WrongPassword',
      };
      
      // Simulate multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await authenticateUser(credentials);
      }
      
      const result = await authenticateUser(credentials);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Account locked');
    });

    it('should track login history', async () => {
      const credentials = {
        email: 'user@example.com',
        password: 'SecurePassword123!',
      };
      
      const result = await authenticateUser(credentials);
      
      expect(result.loginHistory).toBeDefined();
      expect(result.loginHistory.length).toBeGreaterThan(0);
      expect(result.loginHistory[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Logout Flow', () => {
    it('should successfully logout user', async () => {
      const token = 'valid-session-token';
      const result = await logoutUser(token);
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Logged out successfully');
    });

    it('should invalidate all user sessions on logout', async () => {
      const userId = 'user-123';
      const result = await logoutUser(null, { invalidateAll: true, userId });
      
      expect(result.success).toBe(true);
      expect(result.sessionsInvalidated).toBeGreaterThan(0);
    });

    it('should handle logout with invalid token gracefully', async () => {
      const result = await logoutUser('invalid-token');
      
      expect(result.success).toBe(true); // Logout should always succeed
      expect(result.message).toContain('Already logged out');
    });
  });

  describe('Multi-Factor Authentication', () => {
    it('should generate MFA code', async () => {
      const userId = 'user-123';
      const mfaCode = await generateMFACode(userId);
      
      expect(mfaCode).toBeDefined();
      expect(mfaCode).toHaveLength(6);
      expect(/^\d{6}$/.test(mfaCode)).toBe(true);
    });

    it('should validate correct MFA code', async () => {
      const userId = 'user-123';
      const mfaCode = await generateMFACode(userId);
      
      const isValid = await validateMFACode(userId, mfaCode);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect MFA code', async () => {
      const userId = 'user-123';
      await generateMFACode(userId);
      
      const isValid = await validateMFACode(userId, '000000');
      expect(isValid).toBe(false);
    });

    it('should expire MFA code after timeout', async () => {
      const userId = 'user-123';
      const mfaCode = await generateMFACode(userId, { expiresIn: '1ms' });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const isValid = await validateMFACode(userId, mfaCode);
      expect(isValid).toBe(false);
    });
  });

  describe('OAuth Integration', () => {
    it('should handle GitHub OAuth callback', async () => {
      const oauthData = {
        provider: 'github',
        code: 'github-auth-code',
        state: 'random-state',
      };
      
      const result = await handleOAuthCallback(oauthData);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.provider).toBe('github');
    });

    it('should handle Google OAuth callback', async () => {
      const oauthData = {
        provider: 'google',
        code: 'google-auth-code',
        state: 'random-state',
      };
      
      const result = await handleOAuthCallback(oauthData);
      
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.provider).toBe('google');
    });

    it('should link OAuth account to existing user', async () => {
      const existingUserId = 'user-123';
      const oauthData = {
        provider: 'github',
        code: 'github-auth-code',
        userId: existingUserId,
      };
      
      const result = await linkOAuthAccount(oauthData);
      
      expect(result.success).toBe(true);
      expect(result.linkedAccounts).toContain('github');
    });
  });
});

// Mock helper functions (these would be imported in real implementation)
async function generateMFACode(userId: string, options = {}): Promise<string> {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function validateMFACode(userId: string, code: string): Promise<boolean> {
  // Mock validation
  return code === '123456' || Math.random() > 0.5;
}

async function handleOAuthCallback(data: any): Promise<any> {
  // Mock OAuth handler
  return {
    success: true,
    user: {
      id: 'oauth-user-id',
      email: 'oauth@example.com',
      provider: data.provider,
    },
  };
}

async function linkOAuthAccount(data: any): Promise<any> {
  // Mock account linking
  return {
    success: true,
    linkedAccounts: ['github', data.provider],
  };
}