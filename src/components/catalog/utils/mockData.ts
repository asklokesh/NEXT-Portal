/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */

import type { ServiceEntity } from '../types';

const serviceTypes = ['service', 'website', 'library', 'documentation', 'tool'];
const lifecycles = ['experimental', 'production', 'deprecated'];
const healthStates = ['healthy', 'degraded', 'unhealthy', 'unknown'];
const owners = ['platform-team', 'frontend-team', 'backend-team', 'data-team', 'devops-team', 'security-team'];
const systems = ['customer-portal', 'internal-tools', 'data-platform', 'authentication', 'messaging', 'analytics'];
const domains = ['commerce', 'identity', 'infrastructure', 'data'];
const tags = ['frontend', 'backend', 'api', 'database', 'microservice', 'monolith', 'serverless', 'container', 'kubernetes', 'react', 'nodejs', 'python', 'java', 'golang'];

const serviceNames = [
 'user-service', 'auth-service', 'payment-service', 'notification-service',
 'catalog-api', 'search-api', 'recommendation-api', 'analytics-api',
 'admin-portal', 'customer-portal', 'merchant-dashboard', 'support-portal',
 'data-pipeline', 'event-processor', 'job-scheduler', 'cache-service',
 'email-service', 'sms-service', 'push-notification', 'webhook-handler',
 'inventory-service', 'order-service', 'shipping-service', 'billing-service',
 'content-service', 'media-service', 'storage-service', 'cdn-service',
 'monitoring-service', 'logging-service', 'metrics-collector', 'alerting-service',
 'feature-flags', 'config-service', 'secret-manager', 'audit-logger',
 'ml-service', 'prediction-api', 'training-pipeline', 'model-registry',
 'graphql-gateway', 'rest-gateway', 'websocket-server', 'grpc-service'
];

const descriptions = [
 'Handles user authentication and authorization',
 'Manages product catalog and inventory',
 'Processes payments and transactions',
 'Sends notifications to users',
 'Provides search functionality',
 'Generates recommendations for users',
 'Collects and analyzes user behavior',
 'Administrative interface for internal users',
 'Customer-facing web application',
 'Dashboard for merchant partners',
 'Support ticket management system',
 'ETL pipeline for data processing',
 'Real-time event stream processor',
 'Distributed job scheduling service',
 'Redis-based caching layer',
 'Email delivery service',
 'SMS gateway integration',
 'Push notification service',
 'Webhook delivery and retry logic',
 'Inventory tracking and management',
 'Order processing and fulfillment',
 'Shipping integration service',
 'Billing and invoice generation',
 'Content management system',
 'Media upload and processing',
 'Object storage abstraction',
 'CDN integration service',
 'Application performance monitoring',
 'Centralized logging aggregation',
 'Metrics collection and storage',
 'Alert routing and notification',
 'Feature toggle management',
 'Configuration management service',
 'Secrets and credentials vault',
 'Audit trail and compliance logging',
 'Machine learning inference service',
 'Prediction API endpoint',
 'ML model training pipeline',
 'Model versioning and registry',
 'GraphQL API gateway',
 'REST API gateway',
 'WebSocket connection handler',
 'gRPC service implementation'
];

function getRandomItem<T>(array: T[]): T {
 return array[Math.floor(Math.random() * array.length)];
}

function getRandomItems<T>(array: T[], min: number, max: number): T[] {
 const count = Math.floor(Math.random() * (max - min + 1)) + min;
 const shuffled = [...array].sort(() => 0.5 - Math.random());
 return shuffled.slice(0, count);
}

export function generateMockService(index: number): ServiceEntity {
 const name = serviceNames[index % serviceNames.length];
 const namespace = getRandomItem(['default', 'production', 'staging', 'development']);
 const type = getRandomItem(serviceTypes);
 const lifecycle = getRandomItem(lifecycles);
 const owner = getRandomItem(owners);
 const system = Math.random() > 0.3 ? getRandomItem(systems) : undefined;
 const domain = Math.random() > 0.5 ? getRandomItem(domains) : undefined;
 const health = getRandomItem(healthStates);
 const selectedTags = getRandomItems(tags, 1, 5);

 return {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Component',
 metadata: {
 name,
 namespace,
 uid: `${namespace}-${name}-${Date.now()}-${index}`,
 title: name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
 description: getRandomItem(descriptions),
 labels: {
 'backstage.io/techdocs-ref': 'dir:.',
 },
 annotations: {
 'backstage.io/managed-by-location': `url:https://github.com/example/${name}`,
 'github.com/project-slug': `example/${name}`,
 },
 tags: selectedTags,
 links: [
 {
 url: `https://github.com/example/${name}`,
 title: 'Source Code',
 icon: 'github',
 },
 {
 url: `https://example.com/docs/${name}`,
 title: 'Documentation',
 icon: 'docs',
 },
 ...(Math.random() > 0.5 ? [{
 url: `https://example.com/runbook/${name}`,
 title: 'Runbook',
 icon: 'alert',
 }] : []),
 ],
 },
 spec: {
 type: type as any,
 lifecycle: lifecycle as any,
 owner: `group:${owner}`,
 system,
 domain,
 dependsOn: Math.random() > 0.5 
 ? getRandomItems(serviceNames, 1, 3).map(s => `component:default/${s}`)
 : undefined,
 providesApis: type === 'service' && Math.random() > 0.5
 ? [`api:${name}-api`]
 : undefined,
 consumesApis: Math.random() > 0.5
 ? getRandomItems(['user-api', 'auth-api', 'catalog-api'], 1, 2).map(api => `api:${api}`)
 : undefined,
 },
 status: {
 health: health as any,
 incidents: health === 'unhealthy' ? Math.floor(Math.random() * 5) + 1 : 0,
 uptime: health === 'healthy' ? 99.9 : health === 'degraded' ? 95 : 85,
 lastDeployed: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
 version: `${Math.floor(Math.random() * 3)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 20)}`,
 metrics: {
 responseTime: Math.floor(Math.random() * 200) + 50,
 errorRate: health === 'healthy' ? Math.random() * 0.5 : Math.random() * 5,
 throughput: Math.floor(Math.random() * 1000) + 100,
 },
 },
 relations: [],
 };
}

export function generateMockServices(count: number): ServiceEntity[] {
 return Array.from({ length: count }, (_, i) => generateMockService(i));
}