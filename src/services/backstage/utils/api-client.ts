/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import axios, { AxiosResponse } from 'axios';


import { API_ENDPOINTS } from '@/config/constants';
import { getErrorMessage } from '@/lib/utils';

import type { ErrorResponse, RequestOptions } from '../types/common';
import type { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import type { z } from 'zod';

export interface ApiClientConfig {
 baseURL: string;
 timeout?: number;
 maxRetries?: number;
 retryDelay?: number;
 enableCache?: boolean;
 cacheTTL?: number;
}

export interface CacheEntry<T> {
 data: T;
 timestamp: number;
 ttl: number;
}

export class BackstageApiError extends Error {
 public readonly status: number;
 public readonly code: string;
 public readonly details?: Record<string, unknown>;

 constructor(
 message: string,
 status: number,
 code: string,
 details?: Record<string, unknown>
 ) {
 super(message);
 this.name = 'BackstageApiError';
 this.status = status;
 this.code = code;
 this.details = details;
 }
}

export class BackstageApiClient {
 private readonly client: AxiosInstance;
 private readonly cache = new Map<string, CacheEntry<unknown>>();
 private readonly config: Required<ApiClientConfig>;

 constructor(config: ApiClientConfig) {
 this.config = {
 timeout: 10000,
 maxRetries: 3,
 retryDelay: 1000,
 enableCache: true,
 cacheTTL: 5 * 60 * 1000, // 5 minutes
 ...config,
 };

 this.client = axios.create({
 baseURL: this.config.baseURL,
 timeout: this.config.timeout,
 headers: {
 'Content-Type': 'application/json',
 'Accept': 'application/json',
 },
 });

 this.setupInterceptors();
 }

 private setupInterceptors(): void {
 // Request interceptor
 this.client.interceptors.request.use(
 (config) => {
 // Add authentication token if available
 const token = this.getAuthToken();
 if (token) {
 config.headers.Authorization = `Bearer ${token}`;
 }

 // Add request timestamp for monitoring
 config.metadata = { startTime: Date.now() };

 console.debug('API Request:', {
 method: config.method?.toUpperCase(),
 url: config.url,
 params: config.params,
 });

 return config;
 },
 (error) => {
 console.error('Request interceptor error:', error);
 return Promise.reject(error);
 }
 );

 // Response interceptor
 this.client.interceptors.response.use(
 (response) => {
 const duration = Date.now() - (response.config.metadata?.startTime || 0);
 
 console.debug('API Response:', {
 method: response.config.method?.toUpperCase(),
 url: response.config.url,
 status: response.status,
 duration: `${duration}ms`,
 });

 return response;
 },
 async (error: AxiosError) => {
 const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

 // Handle authentication errors
 if (error.response?.status === 401) {
 await this.handleAuthError();
 return Promise.reject(this.createApiError(error));
 }

 // Handle rate limiting
 if (error.response?.status === 429) {
 const retryAfter = error.response.headers['retry-after'];
 const delay = retryAfter ? parseInt(retryAfter) * 1000 : this.config.retryDelay;
 
 console.warn(`Rate limited. Retrying after ${delay}ms`);
 await this.delay(delay);
 
 if (!originalRequest._retry && originalRequest) {
 originalRequest._retry = true;
 return this.client.request(originalRequest);
 }
 }

 // Handle retryable errors
 if (this.isRetryableError(error) && !originalRequest._retry && originalRequest) {
 const retryCount = (originalRequest as any).__retryCount || 0;
 
 if (retryCount < this.config.maxRetries) {
 (originalRequest as any).__retryCount = retryCount + 1;
 originalRequest._retry = true;
 
 const delay = this.config.retryDelay * Math.pow(2, retryCount); // Exponential backoff
 console.warn(`Retrying request (${retryCount + 1}/${this.config.maxRetries}) after ${delay}ms`);
 
 await this.delay(delay);
 return this.client.request(originalRequest);
 }
 }

 console.error('API Error:', {
 method: error.config?.method?.toUpperCase(),
 url: error.config?.url,
 status: error.response?.status,
 message: error.message,
 });

 return Promise.reject(this.createApiError(error));
 }
 );
 }

 private isRetryableError(error: AxiosError): boolean {
 if (!error.response) return true; // Network errors are retryable
 
 const status = error.response.status;
 return status >= 500 || status === 408 || status === 429;
 }

 private createApiError(error: AxiosError): BackstageApiError {
 const status = error.response?.status || 0;
 const message = error.response?.data?.error?.message || error.message;
 const code = error.response?.data?.error?.name || error.code || 'UNKNOWN_ERROR';
 const details = error.response?.data?.error?.details;

 return new BackstageApiError(message, status, code, details);
 }

 private async handleAuthError(): Promise<void> {
 // Implement authentication refresh logic here
 console.warn('Authentication error - implement token refresh');
 }

 private getAuthToken(): string | null {
 // Get token from storage or context
 if (typeof window !== 'undefined') {
 return localStorage.getItem('backstage_token');
 }
 return null;
 }

 private delay(ms: number): Promise<void> {
 return new Promise(resolve => setTimeout(resolve, ms));
 }

 private getCacheKey(method: string, url: string, params?: unknown): string {
 return `${method}:${url}:${JSON.stringify(params || {})}`;
 }

 private getCachedData<T>(key: string): T | null {
 if (!this.config.enableCache) return null;

 const entry = this.cache.get(key) as CacheEntry<T> | undefined;
 if (!entry) return null;

 const now = Date.now();
 if (now - entry.timestamp > entry.ttl) {
 this.cache.delete(key);
 return null;
 }

 return entry.data;
 }

 private setCachedData<T>(key: string, data: T, ttl?: number): void {
 if (!this.config.enableCache) return;

 this.cache.set(key, {
 data,
 timestamp: Date.now(),
 ttl: ttl ?? this.config.cacheTTL,
 });
 }

 public clearCache(pattern?: string): void {
 if (pattern) {
 const regex = new RegExp(pattern);
 for (const key of this.cache.keys()) {
 if (regex.test(key)) {
 this.cache.delete(key);
 }
 }
 } else {
 this.cache.clear();
 }
 }

 public async get<T>(
 url: string,
 params?: unknown,
 options: RequestOptions = {}
 ): Promise<T> {
 const cacheKey = this.getCacheKey('GET', url, params);
 
 if (options.cache !== false) {
 const cachedData = this.getCachedData<T>(cacheKey);
 if (cachedData) {
 return cachedData;
 }
 }

 const response = await this.client.get<T>(url, {
 params,
 signal: options.signal,
 timeout: options.timeout,
 });

 if (options.cache !== false) {
 this.setCachedData(cacheKey, response.data, options.cacheTTL);
 }

 return response.data;
 }

 public async post<T>(
 url: string,
 data?: unknown,
 options: RequestOptions = {}
 ): Promise<T> {
 // Clear related cache entries on POST
 this.clearCache(url.split('/')[0]);

 const response = await this.client.post<T>(url, data, {
 signal: options.signal,
 timeout: options.timeout,
 });

 return response.data;
 }

 public async put<T>(
 url: string,
 data?: unknown,
 options: RequestOptions = {}
 ): Promise<T> {
 // Clear related cache entries on PUT
 this.clearCache(url.split('/')[0]);

 const response = await this.client.put<T>(url, data, {
 signal: options.signal,
 timeout: options.timeout,
 });

 return response.data;
 }

 public async delete<T>(
 url: string,
 options: RequestOptions = {}
 ): Promise<T> {
 // Clear related cache entries on DELETE
 this.clearCache(url.split('/')[0]);

 const response = await this.client.delete<T>(url, {
 signal: options.signal,
 timeout: options.timeout,
 });

 return response.data;
 }

 public async patch<T>(
 url: string,
 data?: unknown,
 options: RequestOptions = {}
 ): Promise<T> {
 // Clear related cache entries on PATCH
 this.clearCache(url.split('/')[0]);

 const response = await this.client.patch<T>(url, data, {
 signal: options.signal,
 timeout: options.timeout,
 });

 return response.data;
 }

 // Typed request method with schema validation
 public async request<T>(
 config: AxiosRequestConfig,
 schema?: z.ZodSchema<T>,
 options: RequestOptions = {}
 ): Promise<T> {
 const response = await this.client.request<T>({
 ...config,
 signal: options.signal,
 timeout: options.timeout,
 });

 if (schema) {
 try {
 return schema.parse(response.data);
 } catch (error) {
 throw new BackstageApiError(
 `Invalid response format: ${getErrorMessage(error)}`,
 response.status,
 'VALIDATION_ERROR',
 { originalData: response.data }
 );
 }
 }

 return response.data;
 }

 // Health check
 public async healthCheck(): Promise<{ status: 'ok' | 'error'; timestamp: number }> {
 try {
 await this.get('/health');
 return { status: 'ok', timestamp: Date.now() };
 } catch {
 return { status: 'error', timestamp: Date.now() };
 }
 }

 // Get cache statistics
 public getCacheStats(): { size: number; entries: string[] } {
 return {
 size: this.cache.size,
 entries: Array.from(this.cache.keys()),
 };
 }
}

// Create singleton instances for each Backstage service
export const createBackstageClient = (service: string): BackstageApiClient => {
 const baseURL = `/api/backstage/${service}`; // Use our Next.js API routes
 
 return new BackstageApiClient({
 baseURL,
 timeout: 15000,
 maxRetries: 3,
 retryDelay: 1000,
 enableCache: true,
 cacheTTL: 5 * 60 * 1000, // 5 minutes
 });
};