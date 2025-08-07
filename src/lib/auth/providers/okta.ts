/* eslint-disable @typescript-eslint/no-unused-vars */
import { OAuthProvider } from './types';

export class OktaProvider implements OAuthProvider {
 private clientId: string;
 private clientSecret: string;
 private domain: string;
 private redirectUri: string;

 constructor(config: {
 clientId: string;
 clientSecret: string;
 domain: string;
 redirectUri: string;
 }) {
 this.clientId = config.clientId;
 this.clientSecret = config.clientSecret;
 this.domain = config.domain;
 this.redirectUri = config.redirectUri;
 }

 getAuthorizationUrl(state: string): string {
 const params = new URLSearchParams({
 client_id: this.clientId,
 response_type: 'code',
 scope: 'openid profile email groups',
 redirect_uri: this.redirectUri,
 state,
 });

 return `https://${this.domain}/oauth2/default/v1/authorize?${params.toString()}`;
 }

 async exchangeCodeForToken(code: string): Promise<{
 access_token: string;
 id_token: string;
 refresh_token?: string;
 expires_in: number;
 }> {
 const tokenUrl = `https://${this.domain}/oauth2/default/v1/token`;
 
 const params = new URLSearchParams({
 grant_type: 'authorization_code',
 code,
 redirect_uri: this.redirectUri,
 client_id: this.clientId,
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
 const userInfoUrl = `https://${this.domain}/oauth2/default/v1/userinfo`;
 
 const response = await fetch(userInfoUrl, {
 headers: {
 Authorization: `Bearer ${accessToken}`,
 },
 });

 if (!response.ok) {
 throw new Error('Failed to fetch user info');
 }

 const data = await response.json();
 
 return {
 id: data.sub,
 email: data.email,
 name: data.name || data.preferred_username,
 picture: data.picture,
 groups: data.groups || [],
 };
 }

 async refreshToken(refreshToken: string): Promise<{
 access_token: string;
 id_token: string;
 refresh_token?: string;
 expires_in: number;
 }> {
 const tokenUrl = `https://${this.domain}/oauth2/default/v1/token`;
 
 const params = new URLSearchParams({
 grant_type: 'refresh_token',
 refresh_token: refreshToken,
 client_id: this.clientId,
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
 const revokeUrl = `https://${this.domain}/oauth2/default/v1/revoke`;
 
 const params = new URLSearchParams({
 token,
 token_type_hint: 'access_token',
 client_id: this.clientId,
 client_secret: this.clientSecret,
 });

 await fetch(revokeUrl, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/x-www-form-urlencoded',
 },
 body: params.toString(),
 });
 }
}

export const createOktaProvider = () => {
 return new OktaProvider({
 clientId: process.env.OKTA_CLIENT_ID || '',
 clientSecret: process.env.OKTA_CLIENT_SECRET || '',
 domain: process.env.OKTA_DOMAIN || '',
 redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/okta/callback`,
 });
};