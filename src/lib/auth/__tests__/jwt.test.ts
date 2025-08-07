import { describe, it, expect, beforeEach } from '@jest/globals';
import { generateTokens, verifyToken, isTokenExpired, extractTokenFromHeader, generateApiKey, hashApiKey, verifyApiKey } from '../jwt';

describe('JWT Token Management', () => {
 const mockUser = {
 id: 'test-user-id',
 email: 'test@example.com',
 name: 'Test User',
 role: 'USER' as const,
 isActive: true,
 createdAt: new Date(),
 updatedAt: new Date(),
 };

 beforeEach(() => {
 jest.clearAllMocks();
 process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-only';
 process.env.JWT_EXPIRES_IN = '15m';
 });

 describe('generateTokens', () => {
 it('should generate access and refresh tokens', () => {
 const tokens = generateTokens(mockUser);

 expect(tokens).toHaveProperty('accessToken');
 expect(tokens).toHaveProperty('refreshToken');
 expect(tokens).toHaveProperty('expiresIn');
 expect(typeof tokens.accessToken).toBe('string');
 expect(typeof tokens.refreshToken).toBe('string');
 expect(typeof tokens.expiresIn).toBe('number');
 expect(tokens.accessToken.split('.').length).toBe(3); // JWT has 3 parts
 expect(tokens.refreshToken.split('.').length).toBe(3);
 });

 it('should include user data in access token payload', () => {
 const tokens = generateTokens(mockUser);
 const payload = verifyToken(tokens.accessToken);

 expect(payload).not.toBeNull();
 expect(payload?.userId).toBe(mockUser.id);
 expect(payload?.email).toBe(mockUser.email);
 expect(payload?.role).toBe(mockUser.role);
 });
 });

 describe('verifyToken', () => {
 it('should verify a valid token', () => {
 const tokens = generateTokens(mockUser);
 const payload = verifyToken(tokens.accessToken);

 expect(payload).not.toBeNull();
 expect(payload).toMatchObject({
 userId: mockUser.id,
 email: mockUser.email,
 role: mockUser.role,
 iat: expect.any(Number),
 exp: expect.any(Number),
 });
 });

 it('should return null for invalid token', () => {
 const payload = verifyToken('invalid.token.format');

 expect(payload).toBeNull();
 });

 it('should return null for token with invalid signature', () => {
 // Create a manually crafted token with invalid signature
 const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItaWQiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiVVNFUiIsImlhdCI6MTY0NTEyMzIwMCwiZXhwIjoxNjQ1MjA5NjAwfQ.invalid_signature_here';
 const payload = verifyToken(invalidToken);

 expect(payload).toBeNull();
 });

 it('should return null for empty token', () => {
 const payload = verifyToken('');

 expect(payload).toBeNull();
 });
 });

 describe('isTokenExpired', () => {
 it('should detect non-expired token', () => {
 const tokens = generateTokens(mockUser);
 const expired = isTokenExpired(tokens.accessToken);

 expect(expired).toBe(false);
 });

 it('should detect expired token', () => {
 // Create an expired token
 const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZXhwIjoxfQ.invalid';
 const expired = isTokenExpired(expiredToken);

 expect(expired).toBe(true);
 });

 it('should return true for invalid token', () => {
 const expired = isTokenExpired('invalid.token');

 expect(expired).toBe(true);
 });
 });

 describe('extractTokenFromHeader', () => {
 it('should extract token from valid Bearer header', () => {
 const token = 'test-token-123';
 const header = `Bearer ${token}`;
 const extracted = extractTokenFromHeader(header);

 expect(extracted).toBe(token);
 });

 it('should return null for missing header', () => {
 const extracted = extractTokenFromHeader(null);

 expect(extracted).toBeNull();
 });

 it('should return null for invalid header format', () => {
 expect(extractTokenFromHeader('InvalidFormat')).toBeNull();
 expect(extractTokenFromHeader('Basic token')).toBeNull();
 expect(extractTokenFromHeader('Bearer')).toBeNull();
 });
 });

 describe('API Key Functions', () => {
 it('should generate API key with correct format', () => {
 const apiKey = generateApiKey();

 expect(apiKey).toMatch(/^bk_[a-f0-9]{64}$/);
 expect(apiKey.length).toBe(67); // 'bk_' + 64 hex chars
 });

 it('should generate unique API keys', () => {
 const key1 = generateApiKey();
 const key2 = generateApiKey();

 expect(key1).not.toBe(key2);
 });

 it('should hash and verify API key', async () => {
 const apiKey = generateApiKey();
 const hash = await hashApiKey(apiKey);

 expect(typeof hash).toBe('string');
 expect(hash).not.toBe(apiKey); // Should be hashed

 const isValid = await verifyApiKey(apiKey, hash);
 expect(isValid).toBe(true);

 const isInvalid = await verifyApiKey('wrong-key', hash);
 expect(isInvalid).toBe(false);
 });

 it('should handle API key verification errors', async () => {
 const result = await verifyApiKey('test-key', 'invalid-hash');

 expect(result).toBe(false);
 });
 });
});