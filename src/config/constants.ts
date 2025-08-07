/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
export const APP_CONFIG = {
 name: 'Backstage IDP Wrapper',
 version: '1.0.0',
 description: 'Enterprise-grade UI wrapper and no-code platform for Backstage.io',
} as const;

export const API_ENDPOINTS = {
 backstage: {
 get base() {
 return typeof window !== 'undefined' 
 ? window.location.origin.replace(':4400', ':7007')
 : process.env['NEXT_PUBLIC_BACKSTAGE_API_URL'] || 'http://localhost:7007';
 },
 catalog: '/api/catalog',
 techdocs: '/api/techdocs',
 scaffolder: '/api/scaffolder',
 auth: '/api/auth',
 },
} as const;

export const QUERY_KEYS = {
 services: 'services',
 service: (id: string) => ['service', id] as const,
 teams: 'teams',
 team: (id: string) => ['team', id] as const,
 users: 'users',
 user: (id: string) => ['user', id] as const,
 templates: 'templates',
 template: (id: string) => ['template', id] as const,
} as const;

export const ROUTES = {
 home: '/',
 services: '/services',
 service: (id: string) => `/services/${id}` as const,
 teams: '/teams',
 team: (id: string) => `/teams/${id}` as const,
 templates: '/templates',
 template: (id: string) => `/templates/${id}` as const,
 noCode: '/no-code',
 settings: '/settings',
 docs: '/docs',
} as const;

export const UI_CONFIG = {
 animation: {
 duration: 200,
 easing: 'ease-in-out',
 },
 toast: {
 duration: 4000,
 position: 'bottom-right' as const,
 },
 table: {
 pageSize: 20,
 pageSizeOptions: [10, 20, 50, 100],
 },
 search: {
 debounceMs: 300,
 },
} as const;

export const FEATURE_FLAGS = {
 enableNoCode: true,
 enableAnalytics: true,
 enableWebSockets: true,
 enableOfflineMode: false,
} as const;