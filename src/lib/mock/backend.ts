/* eslint-disable @typescript-eslint/no-unused-vars */

// Mock backend for development when real services are not available

export const mockBackend = {
 // Mock database data
 database: {
 services: [
 {
 id: 'user-service',
 name: 'user-service',
 displayName: 'User Service',
 description: 'Manages user authentication and profiles',
 type: 'SERVICE',
 lifecycle: 'PRODUCTION',
 namespace: 'default',
 system: 'auth-system',
 domain: 'authentication',
 gitRepo: 'https://github.com/example/user-service',
 tags: ['auth', 'critical'],
 labels: { team: 'platform' },
 annotations: { 'backstage.io/managed-by-location': 'url:https://github.com/example/user-service/catalog-info.yaml' },
 ownerId: 'user-1',
 teamId: 'team-1',
 createdAt: new Date('2024-01-01'),
 updatedAt: new Date('2024-01-15'),
 },
 {
 id: 'payment-service',
 name: 'payment-service',
 displayName: 'Payment Service',
 description: 'Handles payment processing and billing',
 type: 'SERVICE',
 lifecycle: 'PRODUCTION',
 namespace: 'default',
 system: 'billing-system',
 domain: 'commerce',
 gitRepo: 'https://github.com/example/payment-service',
 tags: ['payments', 'critical'],
 labels: { team: 'payments' },
 annotations: { 'backstage.io/managed-by-location': 'url:https://github.com/example/payment-service/catalog-info.yaml' },
 ownerId: 'user-2',
 teamId: 'team-2',
 createdAt: new Date('2024-01-05'),
 updatedAt: new Date('2024-01-20'),
 },
 {
 id: 'inventory-service',
 name: 'inventory-service',
 displayName: 'Inventory Service',
 description: 'Manages product inventory and stock levels',
 type: 'SERVICE',
 lifecycle: 'PRODUCTION',
 namespace: 'default',
 system: 'inventory-system',
 domain: 'commerce',
 gitRepo: 'https://github.com/example/inventory-service',
 tags: ['inventory', 'backend'],
 labels: { team: 'inventory' },
 annotations: { 'backstage.io/managed-by-location': 'url:https://github.com/example/inventory-service/catalog-info.yaml' },
 ownerId: 'user-3',
 teamId: 'team-3',
 createdAt: new Date('2024-01-10'),
 updatedAt: new Date('2024-01-25'),
 },
 {
 id: 'notification-service',
 name: 'notification-service',
 displayName: 'Notification Service',
 description: 'Handles email, SMS, and push notifications',
 type: 'SERVICE',
 lifecycle: 'PRODUCTION',
 namespace: 'default',
 system: 'communication-system',
 domain: 'infrastructure',
 gitRepo: 'https://github.com/example/notification-service',
 tags: ['notifications', 'infrastructure'],
 labels: { team: 'platform' },
 annotations: { 'backstage.io/managed-by-location': 'url:https://github.com/example/notification-service/catalog-info.yaml' },
 ownerId: 'user-1',
 teamId: 'team-1',
 createdAt: new Date('2024-01-08'),
 updatedAt: new Date('2024-01-22'),
 },
 {
 id: 'search-service',
 name: 'search-service',
 displayName: 'Search Service',
 description: 'Provides full-text search capabilities',
 type: 'SERVICE',
 lifecycle: 'EXPERIMENTAL',
 namespace: 'default',
 system: 'search-system',
 domain: 'data',
 gitRepo: 'https://github.com/example/search-service',
 tags: ['search', 'elasticsearch'],
 labels: { team: 'search' },
 annotations: { 'backstage.io/managed-by-location': 'url:https://github.com/example/search-service/catalog-info.yaml' },
 ownerId: 'user-4',
 teamId: 'team-4',
 createdAt: new Date('2024-01-15'),
 updatedAt: new Date('2024-01-28'),
 },
 {
 id: 'analytics-service',
 name: 'analytics-service',
 displayName: 'Analytics Service',
 description: 'Collects and processes analytics data',
 type: 'SERVICE',
 lifecycle: 'PRODUCTION',
 namespace: 'default',
 system: 'analytics-system',
 domain: 'data',
 gitRepo: 'https://github.com/example/analytics-service',
 tags: ['analytics', 'data'],
 labels: { team: 'data' },
 annotations: { 'backstage.io/managed-by-location': 'url:https://github.com/example/analytics-service/catalog-info.yaml' },
 ownerId: 'user-5',
 teamId: 'team-5',
 createdAt: new Date('2024-01-12'),
 updatedAt: new Date('2024-01-26'),
 },
 ],
 templates: [
 {
 id: 'react-template',
 name: 'react-template',
 displayName: 'React Application',
 description: 'Create a new React application with TypeScript and best practices',
 type: 'SCAFFOLDER',
 category: 'frontend',
 tags: ['react', 'typescript', 'frontend'],
 content: {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'react-template',
 title: 'React Application',
 description: 'Create a new React application',
 },
 spec: {
 owner: 'platform-team',
 type: 'service',
 parameters: [
 {
 title: 'Basic Information',
 required: ['name', 'description'],
 properties: {
 name: {
 title: 'Name',
 type: 'string',
 pattern: '^[a-z0-9-]+$',
 },
 description: {
 title: 'Description',
 type: 'string',
 },
 },
 },
 ],
 steps: [
 {
 id: 'fetch',
 name: 'Fetch Base',
 action: 'fetch:template',
 input: {
 url: './skeleton',
 values: {
 name: '${{ parameters.name }}',
 description: '${{ parameters.description }}',
 },
 },
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
 owner: 'platform-team',
 isActive: true,
 createdAt: new Date('2024-01-01'),
 updatedAt: new Date('2024-01-01'),
 },
 {
 id: 'nodejs-template',
 name: 'nodejs-template',
 displayName: 'Node.js Service',
 description: 'Create a new Node.js microservice with Express and TypeScript',
 type: 'SCAFFOLDER',
 category: 'backend',
 tags: ['nodejs', 'typescript', 'backend'],
 content: {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'nodejs-template',
 title: 'Node.js Service',
 description: 'Create a new Node.js microservice',
 },
 spec: {
 owner: 'platform-team',
 type: 'service',
 parameters: [
 {
 title: 'Service Details',
 required: ['name', 'description', 'owner'],
 properties: {
 name: {
 title: 'Name',
 type: 'string',
 pattern: '^[a-z0-9-]+$',
 },
 description: {
 title: 'Description',
 type: 'string',
 },
 owner: {
 title: 'Owner',
 type: 'string',
 ui: 'OwnerPicker',
 },
 },
 },
 ],
 steps: [
 {
 id: 'fetch',
 name: 'Fetch Base',
 action: 'fetch:template',
 input: {
 url: './skeleton',
 values: {
 name: '${{ parameters.name }}',
 description: '${{ parameters.description }}',
 owner: '${{ parameters.owner }}',
 },
 },
 },
 ],
 output: {
 links: [
 {
 title: 'Repository',
 url: '${{ steps.publish.output.remoteUrl }}',
 },
 {
 title: 'Open in catalog',
 icon: 'catalog',
 entityRef: '${{ steps.register.output.entityRef }}',
 },
 ],
 },
 },
 },
 owner: 'platform-team',
 isActive: true,
 createdAt: new Date('2024-01-02'),
 updatedAt: new Date('2024-01-02'),
 },
 ],
 users: [
 {
 id: 'user-1',
 email: 'admin@example.com',
 name: 'Admin User',
 role: 'ADMIN',
 isActive: true,
 createdAt: new Date('2024-01-01'),
 updatedAt: new Date('2024-01-01'),
 },
 ],
 teams: [
 {
 id: 'team-1',
 name: 'platform-team',
 displayName: 'Platform Team',
 description: 'Core platform team',
 createdAt: new Date('2024-01-01'),
 updatedAt: new Date('2024-01-01'),
 },
 ],
 },

 // Mock API responses
 async getTemplates() {
 // Simulate network delay
 await new Promise(resolve => setTimeout(resolve, 100));
 return this.database.templates;
 },

 async getServices() {
 await new Promise(resolve => setTimeout(resolve, 100));
 return this.database.services;
 },

 async getCatalogEntities() {
 await new Promise(resolve => setTimeout(resolve, 100));
 
 // Convert services to Backstage entities
 const serviceEntities = this.database.services.map(service => ({
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name: service.name,
 namespace: service.namespace || 'default',
 title: service.displayName,
 description: service.description,
 tags: service.tags || [],
 annotations: service.annotations || {},
 },
 spec: {
 type: service.type?.toLowerCase() || 'service',
 lifecycle: service.lifecycle?.toLowerCase() || 'production',
 owner: 'team-alpha',
 system: service.system,
 domain: service.domain,
 },
 status: {
 items: [
 {
 type: 'health',
 level: 'info',
 message: 'Service is healthy',
 },
 ],
 },
 }));

 // Convert templates to Backstage entities
 const templateEntities = this.database.templates.map(template => ({
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: template.name,
 namespace: 'default',
 title: template.content.metadata.title,
 description: template.content.metadata.description,
 tags: template.tags || ['template'],
 annotations: {
 'backstage.io/managed-by-location': 'url:https://github.com/company/templates/' + template.name + '/template.yaml',
 },
 },
 spec: template.content.spec,
 }));

 return [...serviceEntities, ...templateEntities];
 },

 async getCostData() {
 await new Promise(resolve => setTimeout(resolve, 100));
 return {
 aggregatedCosts: [
 {
 serviceId: 'user-service',
 serviceName: 'User Service',
 totalCost: 4523.45,
 currency: 'USD',
 breakdown: {
 aws: 2845.23,
 azure: 1567.89,
 gcp: 110.33,
 },
 trend: {
 current: 4523.45,
 previous: 3892.12,
 change: 631.33,
 changePercent: 16.2,
 },
 recommendations: [
 {
 type: 'rightsize',
 description: 'Reduce instance size from m5.2xlarge to m5.xlarge',
 estimatedSavings: 450,
 effort: 'low',
 impact: 'low',
 },
 ],
 },
 ],
 costSummary: {
 totalCost: 25000,
 currency: 'USD',
 periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
 periodEnd: new Date(),
 breakdown: {
 aws: 15000,
 azure: 8000,
 gcp: 2000,
 },
 topServices: [
 {
 serviceId: 'user-service',
 serviceName: 'User Service',
 cost: 4523.45,
 percentage: 18.1,
 },
 ],
 trends: {
 daily: [],
 monthly: [],
 },
 },
 };
 },

 async getHealth() {
 return {
 status: 'ok',
 database: false,
 redis: false,
 backstage: false,
 };
 },
};