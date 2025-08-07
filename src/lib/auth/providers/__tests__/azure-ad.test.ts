import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AzureADProvider } from '../azure-ad';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Suppress console.log for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
beforeAll(() => {
 console.log = jest.fn();
 console.error = jest.fn();
});
afterAll(() => {
 console.log = originalConsoleLog;
 console.error = originalConsoleError;
});

describe('AzureADProvider', () => {
 let provider: AzureADProvider;
 const mockConfig = {
 tenantId: 'test-tenant-id',
 clientId: 'test-client-id',
 clientSecret: 'test-client-secret',
 redirectUri: 'http://localhost:3000/api/auth/callback/azure-ad',
 };

 beforeEach(() => {
 jest.clearAllMocks();
 provider = new AzureADProvider(mockConfig);
 });

 describe('getAuthorizationUrl', () => {
 it('should generate correct authorization URL', () => {
 const state = 'test-state';
 const url = provider.getAuthorizationUrl(state);

 expect(url).toContain(`https://login.microsoftonline.com/${mockConfig.tenantId}/oauth2/v2.0/authorize`);
 expect(url).toContain(`client_id=${mockConfig.clientId}`);
 expect(url).toContain(`redirect_uri=${encodeURIComponent(mockConfig.redirectUri)}`);
 expect(url).toContain('response_type=code');
 expect(url).toContain('scope=openid+profile+email+User.Read');
 expect(url).toContain(`state=${state}`);
 expect(url).toContain('response_mode=query');
 });
 });

 describe('exchangeCodeForToken', () => {
 it('should exchange code for access token', async () => {
 const mockTokenResponse = {
 access_token: 'test-access-token',
 token_type: 'Bearer',
 expires_in: 3600,
 scope: 'openid profile email User.Read',
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
 `https://login.microsoftonline.com/${mockConfig.tenantId}/oauth2/v2.0/token`,
 {
 method: 'POST',
 headers: {
 'Content-Type': 'application/x-www-form-urlencoded',
 },
 body: expect.stringContaining('grant_type=authorization_code'),
 }
 );

 // Verify the body contains all required parameters
 const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
 const body = fetchCall[1]?.body as string;
 expect(body).toContain(`client_id=${mockConfig.clientId}`);
 expect(body).toContain(`client_secret=${mockConfig.clientSecret}`);
 expect(body).toContain('code=test-code');
 expect(body).toContain(`redirect_uri=${encodeURIComponent(mockConfig.redirectUri)}`);
 });

 it('should throw error on failed token exchange', async () => {
 const errorResponse = {
 error: 'invalid_grant',
 error_description: 'The provided authorization code is invalid.',
 };

 (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
 ok: false,
 status: 400,
 statusText: 'Bad Request',
 text: async () => JSON.stringify(errorResponse),
 } as Response);

 await expect(provider.exchangeCodeForToken('invalid-code')).rejects.toThrow(
 `Failed to exchange code for token: ${JSON.stringify(errorResponse)}`
 );
 });
 });

 describe('getUserInfo', () => {
 it('should fetch user information from Microsoft Graph', async () => {
 const mockUserInfo = {
 id: '1234567890',
 displayName: 'Test User',
 mail: 'test@example.com',
 userPrincipalName: 'test@example.com',
 givenName: 'Test',
 surname: 'User',
 };

 const mockGroupsResponse = {
 value: [
 {
 id: 'group-1',
 displayName: 'Engineering',
 },
 {
 id: 'group-2', 
 displayName: 'Managers',
 },
 ],
 };

 (global.fetch as jest.MockedFunction<typeof fetch>)
 .mockResolvedValueOnce({
 ok: true,
 json: async () => mockUserInfo,
 } as Response)
 .mockResolvedValueOnce({
 ok: true,
 json: async () => mockGroupsResponse,
 } as Response);

 const result = await provider.getUserInfo('test-access-token');

 expect(result).toEqual({
 id: mockUserInfo.id,
 email: mockUserInfo.mail,
 name: mockUserInfo.displayName,
 picture: undefined,
 groups: ['Engineering', 'Managers'],
 });

 expect(global.fetch).toHaveBeenCalledWith(
 'https://graph.microsoft.com/v1.0/me',
 {
 headers: {
 'Authorization': 'Bearer test-access-token',
 },
 }
 );

 expect(global.fetch).toHaveBeenCalledWith(
 'https://graph.microsoft.com/v1.0/me/memberOf',
 {
 headers: {
 'Authorization': 'Bearer test-access-token',
 },
 }
 );
 });

 it('should handle users without mail property', async () => {
 const mockUserInfo = {
 id: '1234567890',
 displayName: 'Test User',
 userPrincipalName: 'test@example.com',
 givenName: 'Test',
 surname: 'User',
 };

 (global.fetch as jest.MockedFunction<typeof fetch>)
 .mockResolvedValueOnce({
 ok: true,
 json: async () => mockUserInfo,
 } as Response)
 .mockResolvedValueOnce({
 ok: false,
 status: 403,
 } as Response);

 const result = await provider.getUserInfo('test-access-token');

 expect(result.email).toBe(mockUserInfo.userPrincipalName);
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

 it('should handle failed groups fetch gracefully', async () => {
 const mockUserInfo = {
 id: '1234567890',
 displayName: 'Test User',
 mail: 'test@example.com',
 };

 (global.fetch as jest.MockedFunction<typeof fetch>)
 .mockResolvedValueOnce({
 ok: true,
 json: async () => mockUserInfo,
 } as Response)
 .mockRejectedValueOnce(new Error('Network error'));

 const result = await provider.getUserInfo('test-access-token');

 expect(result.groups).toEqual([]);
 expect(console.error).toHaveBeenCalledWith(
 'Failed to fetch user groups:',
 expect.any(Error)
 );
 });
 });

 describe('refreshToken', () => {
 it('should refresh access token', async () => {
 const mockTokenResponse = {
 access_token: 'new-access-token',
 token_type: 'Bearer',
 expires_in: 3600,
 scope: 'openid profile email User.Read',
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
 `https://login.microsoftonline.com/${mockConfig.tenantId}/oauth2/v2.0/token`,
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
 it('should log message that Azure AD does not support token revocation', async () => {
 await provider.revokeToken('test-token');

 expect(console.log).toHaveBeenCalledWith(
 'Azure AD does not support token revocation'
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