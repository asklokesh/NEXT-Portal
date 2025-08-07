/* eslint-disable @typescript-eslint/no-unused-vars */
import { OAuthProvider } from './types';

export class AzureADProvider implements OAuthProvider {
 private clientId: string;
 private clientSecret: string;
 private tenantId: string;
 private redirectUri: string;

 constructor(config: {
 clientId: string;
 clientSecret: string;
 tenantId: string;
 redirectUri: string;
 }) {
 this.clientId = config.clientId;
 this.clientSecret = config.clientSecret;
 this.tenantId = config.tenantId;
 this.redirectUri = config.redirectUri;
 }

 getAuthorizationUrl(state: string): string {
 const params = new URLSearchParams({
 client_id: this.clientId,
 response_type: 'code',
 redirect_uri: this.redirectUri,
 response_mode: 'query',
 scope: 'openid profile email User.Read',
 state,
 });

 return `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
 }

 async exchangeCodeForToken(code: string): Promise<{
 access_token: string;
 id_token: string;
 refresh_token?: string;
 expires_in: number;
 }> {
 const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
 
 const params = new URLSearchParams({
 client_id: this.clientId,
 scope: 'openid profile email User.Read',
 code,
 redirect_uri: this.redirectUri,
 grant_type: 'authorization_code',
 client_secret: this.clientSecret,
 });

 const response = await fetch(tokenUrl, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/x-www-form-urlencoded',
 },
 body: params.toString(),
 });

 if (!response.ok) {
 const error = await response.text();
 throw new Error(`Failed to exchange code for token: ${error}`);
 }

 return response.json();
 }

 async getUserInfo(accessToken: string): Promise<{
 id: string;
 email: string;
 name: string;
 picture?: string;
 groups?: string[];
 }> {
 const graphUrl = 'https://graph.microsoft.com/v1.0/me';
 
 const response = await fetch(graphUrl, {
 headers: {
 Authorization: `Bearer ${accessToken}`,
 },
 });

 if (!response.ok) {
 throw new Error('Failed to fetch user info');
 }

 const data = await response.json();
 
 // Fetch user groups
 let groups: string[] = [];
 try {
 const groupsResponse = await fetch('https://graph.microsoft.com/v1.0/me/memberOf', {
 headers: {
 Authorization: `Bearer ${accessToken}`,
 },
 });

 if (groupsResponse.ok) {
 const groupsData = await groupsResponse.json();
 groups = groupsData.value.map((group: any) => group.displayName);
 }
 } catch (error) {
 console.error('Failed to fetch user groups:', error);
 }
 
 return {
 id: data.id,
 email: data.mail || data.userPrincipalName,
 name: data.displayName,
 picture: undefined, // Azure AD doesn't provide profile pictures via Graph API easily
 groups,
 };
 }

 async refreshToken(refreshToken: string): Promise<{
 access_token: string;
 id_token: string;
 refresh_token?: string;
 expires_in: number;
 }> {
 const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
 
 const params = new URLSearchParams({
 client_id: this.clientId,
 scope: 'openid profile email User.Read',
 refresh_token: refreshToken,
 grant_type: 'refresh_token',
 client_secret: this.clientSecret,
 });

 const response = await fetch(tokenUrl, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/x-www-form-urlencoded',
 },
 body: params.toString(),
 });

 if (!response.ok) {
 throw new Error('Failed to refresh token');
 }

 return response.json();
 }

 async revokeToken(token: string): Promise<void> {
 // Azure AD doesn't provide a revoke endpoint
 // Tokens expire naturally based on their lifetime
 console.log('Azure AD does not support token revocation');
 }
}

export const createAzureADProvider = () => {
 return new AzureADProvider({
 clientId: process.env.AZURE_AD_CLIENT_ID || '',
 clientSecret: process.env.AZURE_AD_CLIENT_SECRET || '',
 tenantId: process.env.AZURE_AD_TENANT_ID || '',
 redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/azure/callback`,
 });
};