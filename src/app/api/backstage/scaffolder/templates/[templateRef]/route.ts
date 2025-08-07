/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

const BACKSTAGE_API_URL = process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:4402';
const BACKSTAGE_API_TOKEN = process.env.BACKSTAGE_API_TOKEN;

export async function GET(
 request: NextRequest,
 { params }: { params: { templateRef: string } }
) {
 try {
 const templateRef = decodeURIComponent(params.templateRef);
 
 // Build Backstage API URL
 const backstageUrl = new URL(`/api/scaffolder/v2/templates/${encodeURIComponent(templateRef)}`, BACKSTAGE_API_URL);

 const headers: HeadersInit = {
 'Content-Type': 'application/json',
 };

 if (BACKSTAGE_API_TOKEN) {
 headers['Authorization'] = `Bearer ${BACKSTAGE_API_TOKEN}`;
 }

 const response = await fetch(backstageUrl.toString(), {
 method: 'GET',
 headers,
 signal: AbortSignal.timeout(30000),
 });

 if (!response.ok) {
 console.error('Backstage API error:', response.status, response.statusText);
 
 // Return mock data for specific template if Backstage is not available
 if (response.status === 404 || response.status === 503) {
 if (templateRef.includes('nodejs-backend')) {
 return NextResponse.json({
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
 default: 'platform-team',
 },
 },
 },
 {
 title: 'Repository Configuration',
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
 enableDocs: {
 title: 'Enable Documentation',
 type: 'boolean',
 description: 'Create documentation site with TechDocs',
 default: true,
 },
 enableTests: {
 title: 'Enable Testing',
 type: 'boolean',
 description: 'Include Jest testing setup',
 default: true,
 },
 },
 },
 ],
 steps: [
 {
 id: 'fetch',
 name: 'Fetch Skeleton + Template',
 action: 'fetch:template',
 },
 {
 id: 'publish',
 name: 'Publish to GitHub',
 action: 'publish:github',
 },
 {
 id: 'register',
 name: 'Register in Catalog',
 action: 'catalog:register',
 },
 ],
 },
 });
 }
 }

 throw new Error(`Template not found: ${templateRef}`);
 }

 const data = await response.json() as unknown;
 return NextResponse.json(data);
 } catch (error) {
 console.error('Error fetching template:', error);
 
 return NextResponse.json(
 { 
 error: 'Failed to fetch template',
 message: error instanceof Error ? error.message : 'Unknown error',
 },
 { status: 500 }
 );
 }
}