/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

const BACKSTAGE_API_URL = process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:4402';
const BACKSTAGE_API_TOKEN = process.env.BACKSTAGE_API_TOKEN;

export async function GET(request: NextRequest) {
 try {
 // First, try to fetch from real Backstage API
 const backstageResponse = await fetch(`${BACKSTAGE_API_URL}/api/scaffolder/v2/templates`, {
 headers: BACKSTAGE_API_TOKEN ? { Authorization: `Bearer ${BACKSTAGE_API_TOKEN}` } : {},
 });

 if (backstageResponse.ok) {
 console.log('Templates API returning real Backstage data');
 const data = await backstageResponse.json();
 return NextResponse.json(data);
 }

 console.warn('Backstage API unavailable, falling back to minimal template data');
 return NextResponse.json({
 items: [
 {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'nodejs-backend',
 title: 'Node.js Backend Service',
 description: 'Create a new Node.js backend service with TypeScript, Express, and Docker',
 tags: ['nodejs', 'typescript', 'backend', 'express', 'microservice'],
 uid: 'template:default/nodejs-backend',
 namespace: 'default',
 annotations: {
 'backstage.io/managed-by': 'platform-team',
 'backstage.io/source-location': 'url:https://github.com/backstage/software-templates/tree/main/scaffolder-templates/nodejs-backend/',
 },
 },
 spec: {
 type: 'service',
 owner: 'platform-team',
 parameters: [
 {
 title: 'Basic Information',
 required: ['name', 'description', 'owner'],
 properties: {
 name: {
 title: 'Name',
 type: 'string',
 description: 'Unique name of the service',
 pattern: '^[a-z0-9-]+$',
 },
 description: {
 title: 'Description',
 type: 'string',
 description: 'Description of the service',
 },
 owner: {
 title: 'Owner',
 type: 'string',
 description: 'Owner of the component',
 'ui:field': 'OwnerPicker',
 'ui:options': {
 catalogFilter: {
 kind: ['Group', 'User'],
 },
 },
 },
 },
 },
 {
 title: 'Choose a location',
 required: ['repoUrl'],
 properties: {
 repoUrl: {
 title: 'Repository Location',
 type: 'string',
 'ui:field': 'RepoUrlPicker',
 'ui:options': {
 allowedHosts: ['github.com', 'gitlab.com'],
 },
 },
 },
 },
 ],
 steps: [
 {
 id: 'fetch',
 name: 'Fetch Skeleton + Template',
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
 {
 id: 'publish',
 name: 'Publish',
 action: 'publish:github',
 input: {
 allowedHosts: ['github.com'],
 description: 'This is ${{ parameters.name }}',
 repoUrl: '${{ parameters.repoUrl }}',
 },
 },
 {
 id: 'register',
 name: 'Register',
 action: 'catalog:register',
 input: {
 repoContentsUrl: '${{ steps.publish.output.repoContentsUrl }}',
 catalogInfoPath: '/catalog-info.yaml',
 },
 },
 ],
 },
 },
 {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'react-webapp',
 title: 'React Web Application',
 description: 'Create a modern React web application with TypeScript and Vite',
 tags: ['react', 'typescript', 'frontend', 'vite', 'spa'],
 uid: 'template:default/react-webapp',
 namespace: 'default',
 annotations: {
 'backstage.io/managed-by': 'frontend-team',
 },
 },
 spec: {
 type: 'website',
 owner: 'frontend-team',
 parameters: [
 {
 title: 'Application Details',
 required: ['name', 'description'],
 properties: {
 name: {
 title: 'Name',
 type: 'string',
 description: 'Unique name of the application',
 pattern: '^[a-z0-9-]+$',
 },
 description: {
 title: 'Description',
 type: 'string',
 description: 'Description of the application',
 },
 enableTesting: {
 title: 'Enable Testing',
 type: 'boolean',
 description: 'Include Jest and React Testing Library setup',
 default: true,
 },
 enableStorybook: {
 title: 'Enable Storybook',
 type: 'boolean',
 description: 'Include Storybook for component development',
 default: false,
 },
 },
 },
 ],
 steps: [
 {
 id: 'fetch',
 name: 'Fetch Template',
 action: 'fetch:template',
 input: {
 url: './react-template',
 values: {
 name: '${{ parameters.name }}',
 description: '${{ parameters.description }}',
 enableTesting: '${{ parameters.enableTesting }}',
 enableStorybook: '${{ parameters.enableStorybook }}',
 },
 },
 },
 {
 id: 'publish',
 name: 'Publish to GitHub',
 action: 'publish:github',
 input: {
 allowedHosts: ['github.com'],
 description: '${{ parameters.description }}',
 repoUrl: 'github.com?owner=my-org&repo=${{ parameters.name }}',
 },
 },
 ],
 },
 },
 {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'python-fastapi',
 title: 'Python FastAPI Service',
 description: 'Create a Python web service using FastAPI framework with automatic OpenAPI docs',
 tags: ['python', 'fastapi', 'api', 'openapi', 'microservice'],
 uid: 'template:default/python-fastapi',
 namespace: 'default',
 annotations: {
 'backstage.io/managed-by': 'backend-team',
 },
 },
 spec: {
 type: 'service',
 owner: 'backend-team',
 parameters: [
 {
 title: 'Service Information',
 required: ['name', 'description', 'owner'],
 properties: {
 name: {
 title: 'Service Name',
 type: 'string',
 description: 'Name of the FastAPI service',
 pattern: '^[a-z0-9-]+$',
 },
 description: {
 title: 'Description',
 type: 'string',
 description: 'What does this service do?',
 },
 owner: {
 title: 'Owner',
 type: 'string',
 description: 'Team or person responsible for this service',
 'ui:field': 'OwnerPicker',
 },
 includeDatabase: {
 title: 'Include Database',
 type: 'boolean',
 description: 'Add SQLAlchemy and database migrations',
 default: true,
 },
 },
 },
 ],
 steps: [
 {
 id: 'fetch',
 name: 'Fetch FastAPI Template',
 action: 'fetch:template',
 input: {
 url: './fastapi-template',
 values: {
 name: '${{ parameters.name }}',
 description: '${{ parameters.description }}',
 owner: '${{ parameters.owner }}',
 includeDatabase: '${{ parameters.includeDatabase }}',
 },
 },
 },
 ],
 },
 },
 {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'kubernetes-app',
 title: 'Kubernetes Application',
 description: 'Deploy any application to Kubernetes with Helm charts and monitoring',
 tags: ['kubernetes', 'helm', 'deployment', 'monitoring', 'devops'],
 uid: 'template:default/kubernetes-app',
 namespace: 'default',
 annotations: {
 'backstage.io/managed-by': 'platform-team',
 },
 },
 spec: {
 type: 'resource',
 owner: 'platform-team',
 parameters: [
 {
 title: 'Application Details',
 required: ['name', 'namespace', 'image'],
 properties: {
 name: {
 title: 'Application Name',
 type: 'string',
 description: 'Name of the Kubernetes application',
 },
 namespace: {
 title: 'Kubernetes Namespace',
 type: 'string',
 description: 'Target namespace for deployment',
 default: 'default',
 },
 image: {
 title: 'Container Image',
 type: 'string',
 description: 'Docker image to deploy',
 },
 replicas: {
 title: 'Replicas',
 type: 'integer',
 description: 'Number of replicas to run',
 default: 1,
 },
 },
 },
 {
 title: 'Configuration',
 properties: {
 enableMonitoring: {
 title: 'Enable Monitoring',
 type: 'boolean',
 description: 'Add Prometheus monitoring',
 default: true,
 },
 enableIngress: {
 title: 'Enable Ingress',
 type: 'boolean',
 description: 'Expose via ingress controller',
 default: false,
 },
 },
 },
 ],
 steps: [
 {
 id: 'fetch-helm',
 name: 'Generate Helm Chart',
 action: 'fetch:template',
 input: {
 url: './k8s-helm-template',
 values: {
 name: '${{ parameters.name }}',
 namespace: '${{ parameters.namespace }}',
 image: '${{ parameters.image }}',
 replicas: '${{ parameters.replicas }}',
 enableMonitoring: '${{ parameters.enableMonitoring }}',
 enableIngress: '${{ parameters.enableIngress }}',
 },
 },
 },
 ],
 },
 },
 {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'nextjs-app',
 title: 'Next.js Application',
 description: 'Create a full-stack Next.js application with TypeScript and Tailwind CSS',
 tags: ['nextjs', 'react', 'typescript', 'tailwind', 'fullstack'],
 uid: 'template:default/nextjs-app',
 namespace: 'default',
 annotations: {
 'backstage.io/managed-by': 'frontend-team',
 },
 },
 spec: {
 type: 'website',
 owner: 'frontend-team',
 parameters: [
 {
 title: 'Project Setup',
 required: ['name', 'description'],
 properties: {
 name: {
 title: 'Project Name',
 type: 'string',
 description: 'Name of your Next.js project',
 pattern: '^[a-z0-9-]+$',
 },
 description: {
 title: 'Description',
 type: 'string',
 description: 'Brief description of the project',
 },
 includeAuth: {
 title: 'Include Authentication',
 type: 'boolean',
 description: 'Add NextAuth.js setup',
 default: false,
 },
 includeDatabase: {
 title: 'Include Database',
 type: 'boolean',
 description: 'Add Prisma ORM setup',
 default: false,
 },
 },
 },
 ],
 steps: [
 {
 id: 'fetch',
 name: 'Generate Next.js App',
 action: 'fetch:template',
 input: {
 url: './nextjs-template',
 values: {
 name: '${{ parameters.name }}',
 description: '${{ parameters.description }}',
 includeAuth: '${{ parameters.includeAuth }}',
 includeDatabase: '${{ parameters.includeDatabase }}',
 },
 },
 },
 ],
 },
 },
 {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'documentation-site',
 title: 'Documentation Site',
 description: 'Create a documentation website using Backstage TechDocs',
 tags: ['documentation', 'techdocs', 'mkdocs', 'markdown'],
 uid: 'template:default/documentation-site',
 namespace: 'default',
 annotations: {
 'backstage.io/managed-by': 'docs-team',
 },
 },
 spec: {
 type: 'documentation',
 owner: 'docs-team',
 parameters: [
 {
 title: 'Documentation Setup',
 required: ['name', 'description'],
 properties: {
 name: {
 title: 'Documentation Name',
 type: 'string',
 description: 'Name of the documentation site',
 },
 description: {
 title: 'Description',
 type: 'string',
 description: 'What does this documentation cover?',
 },
 includeAPI: {
 title: 'Include API Docs',
 type: 'boolean',
 description: 'Add OpenAPI specification sections',
 default: false,
 },
 },
 },
 ],
 steps: [
 {
 id: 'fetch',
 name: 'Generate Documentation',
 action: 'fetch:template',
 input: {
 url: './docs-template',
 values: {
 name: '${{ parameters.name }}',
 description: '${{ parameters.description }}',
 includeAPI: '${{ parameters.includeAPI }}',
 },
 },
 },
 ],
 },
 },
 ],
 });
 } catch (error) {
 console.error('Error in templates API:', error);
 
 // Return comprehensive fallback templates even on error
 return NextResponse.json({
 items: [
 {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'basic-service',
 title: 'Basic Service Template',
 description: 'A simple service template to get started',
 tags: ['basic', 'service'],
 uid: 'template:default/basic-service',
 namespace: 'default',
 },
 spec: {
 type: 'service',
 owner: 'platform-team',
 parameters: [
 {
 title: 'Basic Information',
 required: ['name'],
 properties: {
 name: {
 title: 'Name',
 type: 'string',
 description: 'Name of the service',
 },
 },
 },
 ],
 steps: [],
 },
 },
 ],
 });
 }
}