const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
 res.json({ status: 'ok' });
});

// Catalog API endpoints will be defined later with plugin support

// Scaffolder/Templates API endpoints
app.get('/api/scaffolder/v2/templates', (req, res) => {
 res.json({
 templates: [
 {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'nodejs-template',
 title: 'Node.js Service',
 description: 'Create a Node.js backend service',
 tags: ['nodejs', 'backend', 'typescript'],
 },
 spec: {
 type: 'service',
 owner: 'platform-team',
 parameters: {
 required: ['name', 'description'],
 properties: {
 name: {
 type: 'string',
 title: 'Name',
 description: 'Unique name of the service',
 },
 description: {
 type: 'string',
 title: 'Description',
 description: 'Help others understand what this service is for',
 },
 },
 },
 steps: [
 {
 id: 'fetch',
 name: 'Fetch Template',
 action: 'fetch:template',
 },
 {
 id: 'publish',
 name: 'Publish',
 action: 'publish:github',
 },
 ],
 output: {
 links: [
 {
 title: 'Repository',
 url: '${{ steps.publish.output.remoteUrl }}',
 },
 ],
 },
 },
 },
 {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'react-app-template',
 title: 'React Application',
 description: 'Create a React frontend application',
 tags: ['react', 'frontend', 'typescript'],
 },
 spec: {
 type: 'website',
 owner: 'platform-team',
 parameters: {
 required: ['name', 'description'],
 properties: {
 name: {
 type: 'string',
 title: 'Name',
 description: 'Unique name of the application',
 },
 description: {
 type: 'string',
 title: 'Description',
 description: 'Help others understand what this app is for',
 },
 },
 },
 steps: [
 {
 id: 'fetch',
 name: 'Fetch Template',
 action: 'fetch:template',
 },
 {
 id: 'publish',
 name: 'Publish',
 action: 'publish:github',
 },
 ],
 output: {
 links: [
 {
 title: 'Repository',
 url: '${{ steps.publish.output.remoteUrl }}',
 },
 ],
 },
 },
 },
 ]
 });
});

// Get single template
app.get('/api/scaffolder/v2/templates/:namespace/:name', (req, res) => {
 res.json({
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: req.params.name,
 namespace: req.params.namespace,
 title: 'Template',
 description: 'Template description',
 },
 spec: {
 type: 'service',
 owner: 'platform-team',
 parameters: {},
 steps: [],
 },
 });
});

// Scaffolder actions
app.get('/api/scaffolder/v2/actions', (req, res) => {
 res.json([
 {
 id: 'fetch:template',
 description: 'Fetch a template',
 },
 {
 id: 'publish:github',
 description: 'Publish to GitHub',
 },
 ]);
});

// Tasks endpoints
app.get('/api/scaffolder/v2/tasks', (req, res) => {
 res.json({
 tasks: [],
 });
});

app.get('/api/scaffolder/v2/tasks/:taskId', (req, res) => {
 res.json({
 id: req.params.taskId,
 status: 'completed',
 createdAt: new Date().toISOString(),
 });
});

// Plugin endpoints
app.get('/api/plugins', (req, res) => {
 res.json({
 plugins: [
 {
 id: 'github-actions',
 name: 'GitHub Actions',
 description: 'GitHub Actions integration',
 version: '1.0.0',
 enabled: true,
 },
 {
 id: 'kubernetes',
 name: 'Kubernetes',
 description: 'Kubernetes integration',
 version: '1.0.0',
 enabled: true,
 },
 ],
 });
});

// Plugin v2 endpoints - for plugin marketplace
app.get('/api/plugins/v2', (req, res) => {
 // Return the full marketplace plugins
 const marketplacePlugins = require('../src/lib/plugins/marketplace-plugins.json');
 res.json({
 success: true,
 plugins: marketplacePlugins.plugins || [],
 total: marketplacePlugins.plugins ? marketplacePlugins.plugins.length : 0
 });
});

// Backstage catalog format for plugins
app.get('/api/catalog/entities', (req, res) => {
 const { filter } = req.query;
 
 if (filter && filter.includes('kind=Plugin')) {
 // Return plugins in Backstage catalog format
 const marketplacePlugins = require('../src/lib/plugins/marketplace-plugins.json');
 const catalogPlugins = marketplacePlugins.plugins.map(plugin => ({
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Plugin',
 metadata: {
 name: plugin.id,
 title: plugin.title,
 description: plugin.description,
 annotations: {
 'backstage.io/managed-by-location': 'url:https://github.com/backstage/backstage',
 'npm/package': plugin.npm || ''
 }
 },
 spec: {
 type: 'plugin',
 lifecycle: 'production',
 owner: plugin.author || 'backstage',
 version: plugin.version,
 category: plugin.category,
 tags: plugin.tags || []
 }
 }));
 
 res.json({
 items: catalogPlugins
 });
 } else {
 // Return regular components
 res.json({
 items: [
 {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: 'user-service',
 namespace: 'default',
 uid: 'uid-1',
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'team-a',
 },
 },
 {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: 'notification-service',
 namespace: 'default',
 uid: 'uid-2',
 },
 spec: {
 type: 'service',
 lifecycle: 'production',
 owner: 'team-b',
 },
 },
 ],
 });
 }
});

// Version endpoint
app.get('/api/version', (req, res) => {
 res.json({
 version: '1.0.0',
 gitCommit: 'abc123',
 });
});

// Techdocs endpoints
app.get('/api/techdocs/entities', (req, res) => {
 res.json({
 items: [],
 });
});

// Cost insights endpoints
app.get('/api/cost-insights/entities', (req, res) => {
 res.json({
 entities: [],
 });
});

const PORT = process.env.PORT || 4402;
app.listen(PORT, () => {
 console.log(`Mock Backstage API running on port ${PORT}`);
});