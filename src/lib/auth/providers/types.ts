export interface OAuthProvider {
 getAuthorizationUrl(state: string): string;
 
 exchangeCodeForToken(code: string): Promise<{
 access_token: string;
 id_token: string;
 refresh_token?: string;
 expires_in: number;
 }>;
 
 getUserInfo(accessToken: string): Promise<{
 id: string;
 email: string;
 name: string;
 picture?: string;
 groups?: string[];
 }>;
 
 refreshToken(refreshToken: string): Promise<{
 access_token: string;
 id_token: string;
 refresh_token?: string;
 expires_in: number;
 }>;
 
 revokeToken(token: string): Promise<void>;
}