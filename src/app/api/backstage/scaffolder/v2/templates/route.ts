/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

const BACKSTAGE_API_URL = process.env.BACKSTAGE_API_URL || process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:7007';
const BACKSTAGE_API_TOKEN = process.env.BACKSTAGE_API_TOKEN;

export async function GET(request: NextRequest) {
 try {
 const { searchParams } = new URL(request.url);
 
 // Build Backstage API URL
 const backstageUrl = new URL('/api/scaffolder/v2/templates', BACKSTAGE_API_URL);
 
 // Forward query parameters
 searchParams.forEach((value, key) => {
 backstageUrl.searchParams.append(key, value);
 });

 const headers: HeadersInit = {
 'Content-Type': 'application/json',
 };

 if (BACKSTAGE_API_TOKEN) {
 headers['Authorization'] = `Bearer ${BACKSTAGE_API_TOKEN}`;
 }

 let response;
 try {
 response = await fetch(backstageUrl.toString(), {
 method: 'GET',
 headers,
 // Add timeout
 signal: AbortSignal.timeout(3000), // 3 second timeout
 });
 } catch (fetchError) {
 console.log('Backstage API not available, returning mock data:', fetchError instanceof Error ? fetchError.message : 'Unknown error');
 // Return mock data if can't connect to Backstage
 return NextResponse.json({
 items: [
 {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'nodejs-backend',
 title: 'Node.js Backend Service',
 description: 'Create a new Node.js backend service with TypeScript, Express, and Docker',
 tags: ['nodejs', 'typescript', 'backend', 'express'],
 uid: 'template:default/nodejs-backend',
 namespace: 'default',
 annotations: {
 'backstage.io/managed-by': 'platform-team',
 },
 },
 spec: {
 type: 'service',
 owner: 'platform-team',
 parameters: [
 {
 title: 'Basic Information',
 required: ['name', 'description'],
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
 },
 },
 },
 {
 title: 'Repository',
 required: ['repoUrl'],
 properties: {
 repoUrl: {
 title: 'Repository Location',
 type: 'string',
 'ui:field': 'RepoUrlPicker',
 'ui:options': {
 allowedHosts: ['github.com'],
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
 tags: ['react', 'typescript', 'frontend', 'vite'],
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
 ],
 });
 }

 if (!response.ok) {
 console.error('Backstage API error:', response.status, response.statusText);
 
 // Return mock data if Backstage is not available
 if (response.status === 404 || response.status === 503) {
 return NextResponse.json({
 items: [
 {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'nodejs-backend',
 title: 'Node.js Backend Service',
 description: 'Create a new Node.js backend service with TypeScript, Express, and Docker',
 tags: ['nodejs', 'typescript', 'backend', 'express'],
 uid: 'template:default/nodejs-backend',
 namespace: 'default',
 annotations: {
 'backstage.io/managed-by': 'platform-team',
 },
 },
 spec: {
 type: 'service',
 owner: 'platform-team',
 parameters: [
 {
 title: 'Basic Information',
 required: ['name', 'description'],
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
 },
 },
 },
 {
 title: 'Repository',
 required: ['repoUrl'],
 properties: {
 repoUrl: {
 title: 'Repository Location',
 type: 'string',
 'ui:field': 'RepoUrlPicker',
 'ui:options': {
 allowedHosts: ['github.com'],
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
 tags: ['react', 'typescript', 'frontend', 'vite'],
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
 ],
 });
 }

 throw new Error(`Backstage API error: ${response.status} ${response.statusText}`);
 }

 const data = await response.json() as unknown;
 return NextResponse.json(data);
 } catch (error) {
 console.error('Error proxying to Backstage:', error);
 
 // Return error response
 return NextResponse.json(
 { 
 error: 'Failed to fetch templates',
 message: error instanceof Error ? error.message : 'Unknown error',
 },
 { status: 500 }
 );
 }
}