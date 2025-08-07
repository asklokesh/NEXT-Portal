/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

const BACKSTAGE_API_URL = process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:4402';
const BACKSTAGE_API_TOKEN = process.env.BACKSTAGE_API_TOKEN;

export async function GET(
 request: NextRequest,
 { params }: { params: { taskId: string } }
) {
 try {
 const { taskId } = params;
 
 // Handle mock tasks for demo purposes
 if (taskId.startsWith('mock-task-')) {
 const createdTime = parseInt(taskId.replace('mock-task-', ''));
 const elapsed = Date.now() - createdTime;
 
 // Simulate task progression
 let status: 'open' | 'processing' | 'completed' | 'failed' = 'processing';
 const steps = [
 {
 id: 'fetch',
 name: 'Fetch Template',
 action: 'fetch:template',
 status: 'completed' as const,
 startedAt: new Date(createdTime).toISOString(),
 endedAt: new Date(createdTime + 2000).toISOString(),
 log: [
 {
 body: 'Fetching template from repository...',
 level: 'info' as const,
 createdAt: new Date(createdTime + 500).toISOString(),
 },
 {
 body: 'Template fetched successfully',
 level: 'info' as const,
 createdAt: new Date(createdTime + 2000).toISOString(),
 },
 ],
 },
 {
 id: 'publish',
 name: 'Publish to GitHub',
 action: 'publish:github',
 status: elapsed > 5000 ? 'completed' : elapsed > 2000 ? 'processing' : 'open',
 startedAt: elapsed > 2000 ? new Date(createdTime + 2000).toISOString() : undefined,
 endedAt: elapsed > 5000 ? new Date(createdTime + 5000).toISOString() : undefined,
 log: elapsed > 2000 ? [
 {
 body: 'Creating GitHub repository...',
 level: 'info' as const,
 createdAt: new Date(createdTime + 2500).toISOString(),
 },
 ...(elapsed > 4000 ? [{
 body: 'Repository created successfully',
 level: 'info' as const,
 createdAt: new Date(createdTime + 4000).toISOString(),
 }] : []),
 ] : [],
 },
 {
 id: 'register',
 name: 'Register in Catalog',
 action: 'catalog:register',
 status: elapsed > 8000 ? 'completed' : elapsed > 5000 ? 'processing' : 'open',
 startedAt: elapsed > 5000 ? new Date(createdTime + 5000).toISOString() : undefined,
 endedAt: elapsed > 8000 ? new Date(createdTime + 8000).toISOString() : undefined,
 log: elapsed > 5000 ? [
 {
 body: 'Registering component in service catalog...',
 level: 'info' as const,
 createdAt: new Date(createdTime + 5500).toISOString(),
 },
 ...(elapsed > 7000 ? [{
 body: 'Component registered successfully',
 level: 'info' as const,
 createdAt: new Date(createdTime + 7000).toISOString(),
 }] : []),
 ] : [],
 },
 ];

 if (elapsed > 8000) {
 status = 'completed';
 }

 return NextResponse.json({
 id: taskId,
 spec: {
 templateInfo: {
 entityRef: 'template:default/nodejs-backend',
 },
 parameters: {
 name: 'my-new-service',
 description: 'A new Node.js backend service',
 owner: 'platform-team',
 },
 },
 status,
 createdAt: new Date(createdTime).toISOString(),
 lastHeartbeatAt: new Date().toISOString(),
 steps,
 });
 }
 
 // Build Backstage API URL
 const backstageUrl = new URL(`/api/scaffolder/v2/tasks/${taskId}`, BACKSTAGE_API_URL);

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
 throw new Error(`Task not found: ${taskId}`);
 }

 const data = await response.json() as unknown;
 return NextResponse.json(data);
 } catch (error) {
 console.error('Error fetching task:', error);
 
 return NextResponse.json(
 { 
 error: 'Failed to fetch task',
 message: error instanceof Error ? error.message : 'Unknown error',
 },
 { status: 500 }
 );
 }
}