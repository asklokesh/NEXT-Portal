/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

const BACKSTAGE_API_URL = process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:4402';
const BACKSTAGE_API_TOKEN = process.env.BACKSTAGE_API_TOKEN;

export async function GET(request: NextRequest) {
 try {
 const { searchParams } = new URL(request.url);
 
 // Build Backstage API URL
 const backstageUrl = new URL('/api/scaffolder/v2/tasks', BACKSTAGE_API_URL);
 
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

 const response = await fetch(backstageUrl.toString(), {
 method: 'GET',
 headers,
 signal: AbortSignal.timeout(30000),
 });

 if (!response.ok) {
 console.error('Backstage API error:', response.status, response.statusText);
 
 // Return mock empty tasks if Backstage is not available
 return NextResponse.json({ tasks: [] });
 }

 const data = await response.json() as unknown;
 return NextResponse.json(data);
 } catch (error) {
 console.error('Error fetching tasks:', error);
 
 return NextResponse.json(
 { 
 error: 'Failed to fetch tasks',
 message: error instanceof Error ? error.message : 'Unknown error',
 },
 { status: 500 }
 );
 }
}

export async function POST(request: NextRequest) {
 try {
 const body = await request.json() as unknown;
 
 // Build Backstage API URL
 const backstageUrl = new URL('/api/scaffolder/v2/tasks', BACKSTAGE_API_URL);

 const headers: HeadersInit = {
 'Content-Type': 'application/json',
 };

 if (BACKSTAGE_API_TOKEN) {
 headers['Authorization'] = `Bearer ${BACKSTAGE_API_TOKEN}`;
 }

 const response = await fetch(backstageUrl.toString(), {
 method: 'POST',
 headers,
 body: JSON.stringify(body),
 signal: AbortSignal.timeout(30000),
 });

 if (!response.ok) {
 console.error('Backstage API error:', response.status, response.statusText);
 
 // Return mock task if Backstage is not available
 if (response.status === 404 || response.status === 503) {
 const mockTaskId = `mock-task-${Date.now()}`;
 return NextResponse.json({ taskId: mockTaskId });
 }

 const errorText = await response.text();
 throw new Error(`Backstage API error: ${response.status} ${errorText}`);
 }

 const data = await response.json() as unknown;
 return NextResponse.json(data);
 } catch (error) {
 console.error('Error creating task:', error);
 
 return NextResponse.json(
 { 
 error: 'Failed to execute template',
 message: error instanceof Error ? error.message : 'Unknown error',
 },
 { status: 500 }
 );
 }
}