/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { rest } from 'msw';

import type { 
 UserInfo, 
 SessionInfo, 
 AuthorizeResponse,
 ApiKey 
} from '../types/auth';
import type { 
 Entity, 
 ComponentEntity, 
 ApiEntity, 
 SystemEntity, 
 UserEntity, 
 GroupEntity 
} from '../types/entities';
import type { 
 TechDocsMetadata,
 TechDocsSearchResponse 
} from '../types/techdocs';
import type { 
 TemplateEntity, 
 Task, 
 Action 
} from '../types/templates';

// Mock data generators
const createMockComponent = (id: string, name: string): ComponentEntity => ({
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: name.toLowerCase().replace(/\s+/g, '-'),
 title: name,
 description: `Mock component ${name}`,
 labels: {
 'backstage.io/managed-by-location': `url:https://github.com/example/${name}`,
 },
 annotations: {
 'backstage.io/managed-by-origin-location': `url:https://github.com/example/${name}/blob/main/catalog-info.yaml`,
 },
 tags: ['typescript', 'react', 'frontend'],
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'team-alpha',
 system: 'payment-system',
 },
});

const createMockApi = (id: string, name: string): ApiEntity => ({
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'API',
 metadata: {
 name: name.toLowerCase().replace(/\s+/g, '-'),
 title: name,
 description: `Mock API ${name}`,
 },
 spec: {
 type: 'openapi',
 lifecycle: 'production',
 owner: 'team-alpha',
 definition: 'openapi: 3.0.0\ninfo:\n title: Mock API\n version: 1.0.0\npaths: {}',
 },
});

const createMockSystem = (id: string, name: string): SystemEntity => ({
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'System',
 metadata: {
 name: name.toLowerCase().replace(/\s+/g, '-'),
 title: name,
 description: `Mock system ${name}`,
 },
 spec: {
 owner: 'team-alpha',
 },
});

const createMockUser = (id: string, name: string): UserEntity => ({
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'User',
 metadata: {
 name: name.toLowerCase().replace(/\s+/g, '-'),
 title: name,
 },
 spec: {
 profile: {
 displayName: name,
 email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
 picture: `https://avatar.example.com/${id}`,
 },
 memberOf: ['team-alpha'],
 },
});

const createMockGroup = (id: string, name: string): GroupEntity => ({
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Group',
 metadata: {
 name: name.toLowerCase().replace(/\s+/g, '-'),
 title: name,
 description: `Mock group ${name}`,
 },
 spec: {
 type: 'team',
 profile: {
 displayName: name,
 },
 children: [],
 members: ['john-doe', 'jane-smith'],
 },
});

const createMockTemplate = (id: string, name: string): TemplateEntity => ({
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: name.toLowerCase().replace(/\s+/g, '-'),
 title: name,
 description: `Mock template ${name}`,
 tags: ['react', 'typescript', 'frontend'],
 },
 spec: {
 type: 'service',
 owner: 'team-alpha',
 parameters: {
 type: 'object',
 properties: {
 name: {
 title: 'Name',
 type: 'string',
 description: 'Unique name of the component',
 },
 description: {
 title: 'Description',
 type: 'string',
 description: 'Help others understand what this service is for.',
 },
 },
 required: ['name'],
 },
 steps: [
 {
 id: 'fetch',
 name: 'Fetch Skeleton',
 action: 'fetch:template',
 input: {
 url: './skeleton',
 values: {
 name: '${{ parameters.name }}',
 description: '${{ parameters.description }}',
 },
 },
 },
 {
 id: 'publish',
 name: 'Publish',
 action: 'publish:github',
 input: {
 allowedHosts: ['github.com'],
 description: '${{ parameters.description }}',
 repoUrl: 'github.com?repo=${{ parameters.name }}&owner=example',
 },
 },
 ],
 },
});

const createMockTask = (id: string, templateRef: string): Task => ({
 id,
 spec: {
 templateInfo: {
 entityRef: templateRef,
 },
 parameters: {
 name: 'my-new-service',
 description: 'A service created from a template',
 },
 },
 status: Math.random() > 0.5 ? 'completed' : 'processing',
 createdAt: new Date().toISOString(),
 steps: [
 {
 id: 'fetch',
 name: 'Fetch Skeleton',
 action: 'fetch:template',
 status: 'completed',
 },
 {
 id: 'publish',
 name: 'Publish',
 action: 'publish:github',
 status: Math.random() > 0.5 ? 'completed' : 'processing',
 },
 ],
});

// Mock data sets
const mockComponents = Array.from({ length: 25 }, (_, i) => 
 createMockComponent(`comp-${i}`, `Component ${i + 1}`)
);

const mockApis = Array.from({ length: 8 }, (_, i) => 
 createMockApi(`api-${i}`, `API ${i + 1}`)
);

const mockSystems = Array.from({ length: 5 }, (_, i) => 
 createMockSystem(`sys-${i}`, `System ${i + 1}`)
);

const mockUsers = Array.from({ length: 15 }, (_, i) => 
 createMockUser(`user-${i}`, `User ${i + 1}`)
);

const mockGroups = Array.from({ length: 5 }, (_, i) => 
 createMockGroup(`group-${i}`, `Team ${i + 1}`)
);

const mockTemplates = Array.from({ length: 10 }, (_, i) => 
 createMockTemplate(`template-${i}`, `Template ${i + 1}`)
);

const mockTasks = Array.from({ length: 20 }, (_, i) => 
 createMockTask(`task-${i}`, `template:default/template-${i % 10}`)
);

const allMockEntities: Entity[] = [
 ...mockComponents,
 ...mockApis,
 ...mockSystems,
 ...mockUsers,
 ...mockGroups,
];

const mockActions: Action[] = [
 {
 id: 'fetch:template',
 description: 'Downloads a skeleton, templating variables into file and directory names and content',
 schema: {
 input: {
 type: 'object',
 properties: {
 url: {
 title: 'Repository URL',
 description: 'Relative path or absolute URL pointing to the directory tree to fetch',
 type: 'string',
 },
 values: {
 title: 'Template Values',
 description: 'Values to pass on to the templating engine',
 type: 'object',
 },
 },
 required: ['url'],
 },
 },
 },
 {
 id: 'publish:github',
 description: 'Initializes a git repository and publishes it to GitHub',
 schema: {
 input: {
 type: 'object',
 properties: {
 repoUrl: {
 title: 'Repository Location',
 type: 'string',
 },
 description: {
 title: 'Repository Description',
 type: 'string',
 },
 },
 required: ['repoUrl'],
 },
 },
 },
];

// API handlers
export const handlers = [
 // Catalog API handlers
 rest.get('/api/catalog/entities', (req, res, ctx) => {
 const url = new URL(req.url);
 const filter = url.searchParams.getAll('filter');
 const limit = parseInt(url.searchParams.get('limit') || '20');
 const offset = parseInt(url.searchParams.get('offset') || '0');

 let filteredEntities = [...allMockEntities];

 // Apply filters
 filter.forEach(f => {
 const [key, value] = f.split('=');
 if (key === 'kind') {
 filteredEntities = filteredEntities.filter(e => e.kind === value);
 }
 if (key === 'spec.owner') {
 filteredEntities = filteredEntities.filter(e => (e.spec as any)?.owner === value);
 }
 });

 const paginatedEntities = filteredEntities.slice(offset, offset + limit);

 return res(
 ctx.delay(100),
 ctx.json({
 items: paginatedEntities,
 totalItems: filteredEntities.length,
 })
 );
 }),

 rest.get('/api/catalog/entities/by-name/:kind/:namespace/:name', (req, res, ctx) => {
 const { kind, namespace, name } = req.params;
 const entity = allMockEntities.find(e => 
 e.kind === kind && 
 (e.metadata.namespace || 'default') === namespace && 
 e.metadata.name === name
 );

 if (!entity) {
 return res(ctx.status(404), ctx.json({ error: 'Entity not found' }));
 }

 return res(ctx.delay(50), ctx.json(entity));
 }),

 rest.get('/api/catalog/entities/search', (req, res, ctx) => {
 const url = new URL(req.url);
 const term = url.searchParams.get('term') || '';
 
 const results = allMockEntities
 .filter(e => 
 e.metadata.name.includes(term.toLowerCase()) ||
 e.metadata.title?.toLowerCase().includes(term.toLowerCase()) ||
 e.metadata.description?.toLowerCase().includes(term.toLowerCase())
 )
 .slice(0, 10)
 .map(entity => ({
 entity,
 rank: 1.0,
 }));

 return res(
 ctx.delay(150),
 ctx.json({ results })
 );
 }),

 rest.get('/api/catalog/locations', (req, res, ctx) => {
 return res(
 ctx.delay(100),
 ctx.json({
 items: [
 {
 id: 'location-1',
 type: 'url',
 target: 'https://github.com/example/backstage-catalog/blob/main/catalog-info.yaml',
 },
 ],
 })
 );
 }),

 // Scaffolder API handlers
 rest.get('/api/scaffolder/v2/templates', (req, res, ctx) => {
 return res(
 ctx.delay(100),
 ctx.json({ items: mockTemplates })
 );
 }),

 rest.get('/api/scaffolder/v2/templates/:templateRef', (req, res, ctx) => {
 const { templateRef } = req.params;
 const template = mockTemplates.find(t => 
 `template:default/${t.metadata.name}` === templateRef
 );

 if (!template) {
 return res(ctx.status(404), ctx.json({ error: 'Template not found' }));
 }

 return res(ctx.delay(50), ctx.json(template));
 }),

 rest.post('/api/scaffolder/v2/tasks', (req, res, ctx) => {
 const taskId = `task-${Date.now()}`;
 return res(
 ctx.delay(200),
 ctx.json({ taskId })
 );
 }),

 rest.get('/api/scaffolder/v2/tasks/:taskId', (req, res, ctx) => {
 const { taskId } = req.params;
 const task = mockTasks.find(t => t.id === taskId) || mockTasks[0];
 
 return res(ctx.delay(50), ctx.json(task));
 }),

 rest.get('/api/scaffolder/v2/tasks', (req, res, ctx) => {
 return res(
 ctx.delay(100),
 ctx.json({ tasks: mockTasks.slice(0, 10) })
 );
 }),

 rest.get('/api/scaffolder/v2/actions', (req, res, ctx) => {
 return res(
 ctx.delay(100),
 ctx.json({ actions: mockActions })
 );
 }),

 // TechDocs API handlers
 rest.get('/api/techdocs/metadata/:namespace/:kind/:name', (req, res, ctx) => {
 const mockMetadata: TechDocsMetadata = {
 site_name: 'Mock Documentation',
 site_description: 'Mock documentation for testing',
 etag: 'mock-etag-123',
 build_timestamp: Date.now(),
 files: ['index.html', 'api.html', 'guides.html'],
 };

 return res(ctx.delay(50), ctx.json(mockMetadata));
 }),

 rest.get('/api/techdocs/static/docs/:namespace/:kind/:name/*', (req, res, ctx) => {
 const htmlContent = `
 <!DOCTYPE html>
 <html>
 <head><title>Mock Documentation</title></head>
 <body>
 <h1>Mock Documentation</h1>
 <p>This is mock documentation content for testing purposes.</p>
 </body>
 </html>
 `;

 return res(
 ctx.delay(100),
 ctx.set('Content-Type', 'text/html'),
 ctx.text(htmlContent)
 );
 }),

 rest.get('/api/techdocs/search', (req, res, ctx) => {
 const url = new URL(req.url);
 const term = url.searchParams.get('term') || '';

 const mockSearchResponse: TechDocsSearchResponse = {
 results: [
 {
 title: 'Getting Started',
 text: `Mock documentation content about ${term}`,
 location: '/docs/default/component/mock-service/getting-started/',
 entityRef: 'component:default/mock-service',
 rank: 1.0,
 },
 {
 title: 'API Reference',
 text: `API documentation mentioning ${term}`,
 location: '/docs/default/component/mock-service/api/',
 entityRef: 'component:default/mock-service',
 rank: 0.8,
 },
 ],
 };

 return res(ctx.delay(150), ctx.json(mockSearchResponse));
 }),

 // Auth API handlers
 rest.get('/api/auth/v1/user-info', (req, res, ctx) => {
 const mockUserInfo: UserInfo = {
 entityRef: 'user:default/john-doe',
 profile: {
 displayName: 'John Doe',
 email: 'john.doe@example.com',
 picture: 'https://avatar.example.com/john-doe',
 },
 identity: {
 type: 'user',
 userEntityRef: 'user:default/john-doe',
 ownershipEntityRefs: ['user:default/john-doe', 'group:default/team-alpha'],
 },
 };

 return res(ctx.delay(50), ctx.json(mockUserInfo));
 }),

 rest.get('/api/auth/v1/session', (req, res, ctx) => {
 const mockSession: SessionInfo = {
 userEntityRef: 'user:default/john-doe',
 profile: {
 displayName: 'John Doe',
 email: 'john.doe@example.com',
 picture: 'https://avatar.example.com/john-doe',
 },
 expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
 permissions: [
 'catalog.entity.read',
 'catalog.entity.create',
 'scaffolder.action.execute',
 'techdocs.entity.read',
 ],
 groups: [
 {
 groupEntityRef: 'group:default/team-alpha',
 role: 'member',
 },
 ],
 };

 return res(ctx.delay(50), ctx.json(mockSession));
 }),

 rest.post('/api/auth/v1/authorize', (req, res, ctx) => {
 // Mock all permissions as allowed for development
 const mockResponse: AuthorizeResponse = {
 result: 'ALLOW',
 };

 return res(ctx.delay(30), ctx.json(mockResponse));
 }),

 rest.get('/api/auth/v1/api-keys', (req, res, ctx) => {
 const mockApiKeys: ApiKey[] = [
 {
 id: 'key-1',
 name: 'Development Key',
 description: 'API key for local development',
 prefix: 'bsk_dev',
 createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
 lastUsedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
 permissions: ['catalog.entity.read'],
 },
 ];

 return res(
 ctx.delay(100),
 ctx.json({ items: mockApiKeys, total: mockApiKeys.length })
 );
 }),

 // Health check
 rest.get('/api/health', (req, res, ctx) => {
 return res(ctx.json({ status: 'ok' }));
 }),

 // Catch-all for unhandled requests
 rest.all('*', (req, res, ctx) => {
 console.warn(`Unhandled ${req.method} request to ${req.url}`);
 return res(
 ctx.status(404),
 ctx.json({ error: 'Mock handler not found' })
 );
 }),
];

export { mockComponents, mockTemplates, mockTasks, allMockEntities };