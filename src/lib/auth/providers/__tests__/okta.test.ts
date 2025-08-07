import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { OktaProvider } from '../okta';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('OktaProvider', () => {
 let provider: OktaProvider;
 const mockConfig = {
 domain: 'test.okta.com',
 clientId: 'test-client-id',
 clientSecret: 'test-client-secret',
 redirectUri: 'http://localhost:3000/api/auth/callback/okta',
 };

 beforeEach(() => {
 jest.clearAllMocks();
 provider = new OktaProvider(mockConfig);
 });

 describe('getAuthorizationUrl', () => {
 it('should generate correct authorization URL', () => {
 const state = 'test-state';
 const url = provider.getAuthorizationUrl(state);

 expect(url).toContain(`https://${mockConfig.domain}/oauth2/default/v1/authorize`);
 expect(url).toContain(`client_id=${mockConfig.clientId}`);
 expect(url).toContain(`redirect_uri=${encodeURIComponent(mockConfig.redirectUri)}`);
 expect(url).toContain('response_type=code');
 expect(url).toContain('scope=openid+profile+email+groups');
 expect(url).toContain(`state=${state}`);
 });
 });

 describe('exchangeCodeForToken', () => {
 it('should exchange code for access token', async () => {
 const mockTokenResponse = {
 access_token: 'test-access-token',
 token_type: 'Bearer',
 expires_in: 3600,
 scope: 'openid profile email',
 id_token: 'test-id-token',
 refresh_token: 'test-refresh-token',
 };

 (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
 ok: true,
 json: async () => mockTokenResponse,
 } as Response);

 const result = await provider.exchangeCodeForToken('test-code');

 expect(result).toEqual(mockTokenResponse);
 expect(global.fetch).toHaveBeenCalledWith(
 `https://${mockConfig.domain}/oauth2/default/v1/token`,
 {
 method: 'POST',
 headers: {
 'Content-Type': 'application/x-www-form-urlencoded',
 },
 body: expect.stringContaining('grant_type=authorization_code'),
 }
 );
 });

 it('should throw error on failed token exchange', async () => {
 (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
 ok: false,
 status: 400,
 statusText: 'Bad Request',
 text: async () => 'Invalid grant',
 } as Response);

 await expect(provider.exchangeCodeForToken('invalid-code')).rejects.toThrow(
 'Failed to exchange code for token: Invalid grant'
 );
 });
 });

 describe('getUserInfo', () => {
 it('should fetch user information', async () => {
 const mockUserInfo = {
 sub: '00u1234567890',
 name: 'Test User',
 email: 'test@example.com',
 preferred_username: 'testuser',
 picture: 'https://example.com/avatar.jpg',
 email_verified: true,
 groups: ['Engineering', 'Developers'],
 };

 (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
 ok: true,
 json: async () => mockUserInfo,
 } as Response);

 const result = await provider.getUserInfo('test-access-token');

 expect(result).toEqual({
 id: mockUserInfo.sub,
 email: mockUserInfo.email,
 name: mockUserInfo.name,
 picture: mockUserInfo.picture,
 groups: mockUserInfo.groups,
 });

 expect(global.fetch).toHaveBeenCalledWith(
 `https://${mockConfig.domain}/oauth2/default/v1/userinfo`,
 {
 headers: {
 'Authorization': 'Bearer test-access-token',
 },
 }
 );
 });

 it('should throw error on failed user info fetch', async () => {
 (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
 ok: false,
 status: 401,
 statusText: 'Unauthorized',
 } as Response);

 await expect(provider.getUserInfo('invalid-token')).rejects.toThrow(
 'Failed to fetch user info'
 );
 });
 });

 describe('refreshToken', () => {
 it('should refresh access token', async () => {
 const mockTokenResponse = {
 access_token: 'new-access-token',
 token_type: 'Bearer',
 expires_in: 3600,
 scope: 'openid profile email',
 id_token: 'new-id-token',
 refresh_token: 'new-refresh-token',
 };

 (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
 ok: true,
 json: async () => mockTokenResponse,
 } as Response);

 const result = await provider.refreshToken('test-refresh-token');

 expect(result).toEqual(mockTokenResponse);
 expect(global.fetch).toHaveBeenCalledWith(
 `https://${mockConfig.domain}/oauth2/default/v1/token`,
 {
 method: 'POST',
 headers: {
 'Content-Type': 'application/x-www-form-urlencoded',
 },
 body: expect.stringContaining('grant_type=refresh_token'),
 }
 );
 });

 it('should throw error on failed token refresh', async () => {
 (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
 ok: false,
 status: 400,
 statusText: 'Bad Request',
 } as Response);

 await expect(provider.refreshToken('invalid-refresh-token')).rejects.toThrow(
 'Failed to refresh token'
 );
 });
 });

 describe('revokeToken', () => {
 it('should revoke token', async () => {
 (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
 ok: true,
 } as Response);

 await provider.revokeToken('test-access-token');

 expect(global.fetch).toHaveBeenCalledWith(
 `https://${mockConfig.domain}/oauth2/default/v1/revoke`,
 {
 method: 'POST',
 headers: {
 'Content-Type': 'application/x-www-form-urlencoded',
 },
 body: expect.stringContaining('token=test-access-token'),
 }
 );
 });
 });

 describe('Error Handling', () => {
 it('should handle network errors gracefully', async () => {
 (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
 new Error('Network error')
 );

 await expect(provider.getUserInfo('test-token')).rejects.toThrow('Network error');
 });

 it('should handle malformed JSON responses', async () => {
 (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
 ok: true,
 json: async () => {
 throw new Error('Invalid JSON');
 },
 } as Response);

 await expect(provider.getUserInfo('test-token')).rejects.toThrow('Invalid JSON');
 });
 });
});