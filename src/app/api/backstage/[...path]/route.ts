/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import { NextResponse } from 'next/server';

import type { NextRequest} from 'next/server';

const BACKSTAGE_URL = process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:4402';

// Proxy handler for Backstage API requests
export async function GET(
 request: NextRequest,
 { params }: { params: { path: string[] } }
) {
 try {
 const path = params.path.join('/');
 const url = new URL(request.url);
 const backstageUrl = `${BACKSTAGE_URL}/api/${path}${url.search}`;

 const response = await fetch(backstageUrl, {
 method: 'GET',
 headers: {
 'Content-Type': 'application/json',
 // Forward auth headers if present
 ...(request.headers.get('Authorization') && {
 'Authorization': request.headers.get('Authorization')!,
 }),
 },
 });

 const data = await response.json() as unknown;

 return NextResponse.json(data, {
 status: response.status,
 headers: {
 'Content-Type': 'application/json',
 },
 });
 } catch (error) {
 console.error('Backstage API proxy error:', error);
 return NextResponse.json(
 { error: 'Failed to proxy request to Backstage' },
 { status: 500 }
 );
 }
}

export async function POST(
 request: NextRequest,
 { params }: { params: { path: string[] } }
) {
 try {
 const path = params.path.join('/');
 const body = await request.json() as unknown;
 const backstageUrl = `${BACKSTAGE_URL}/api/${path}`;

 const response = await fetch(backstageUrl, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 // Forward auth headers if present
 ...(request.headers.get('Authorization') && {
 'Authorization': request.headers.get('Authorization')!,
 }),
 },
 body: JSON.stringify(body as Record<string, unknown>),
 });

 const data = await response.json() as unknown;

 return NextResponse.json(data, {
 status: response.status,
 headers: {
 'Content-Type': 'application/json',
 },
 });
 } catch (error) {
 console.error('Backstage API proxy error:', error);
 return NextResponse.json(
 { error: 'Failed to proxy request to Backstage' },
 { status: 500 }
 );
 }
}

export async function PUT(
 request: NextRequest,
 { params }: { params: { path: string[] } }
) {
 try {
 const path = params.path.join('/');
 const body = await request.json() as unknown;
 const backstageUrl = `${BACKSTAGE_URL}/api/${path}`;

 const response = await fetch(backstageUrl, {
 method: 'PUT',
 headers: {
 'Content-Type': 'application/json',
 // Forward auth headers if present
 ...(request.headers.get('Authorization') && {
 'Authorization': request.headers.get('Authorization')!,
 }),
 },
 body: JSON.stringify(body as Record<string, unknown>),
 });

 const data = await response.json() as unknown;

 return NextResponse.json(data, {
 status: response.status,
 headers: {
 'Content-Type': 'application/json',
 },
 });
 } catch (error) {
 console.error('Backstage API proxy error:', error);
 return NextResponse.json(
 { error: 'Failed to proxy request to Backstage' },
 { status: 500 }
 );
 }
}

export async function DELETE(
 request: NextRequest,
 { params }: { params: { path: string[] } }
) {
 try {
 const path = params.path.join('/');
 const backstageUrl = `${BACKSTAGE_URL}/api/${path}`;

 const response = await fetch(backstageUrl, {
 method: 'DELETE',
 headers: {
 'Content-Type': 'application/json',
 // Forward auth headers if present
 ...(request.headers.get('Authorization') && {
 'Authorization': request.headers.get('Authorization')!,
 }),
 },
 });

 // Handle empty responses
 let data: unknown = null;
 const contentType = response.headers.get('content-type');
 if (contentType && contentType.includes('application/json')) {
 data = await response.json() as unknown;
 }

 return NextResponse.json(data || { success: true }, {
 status: response.status,
 headers: {
 'Content-Type': 'application/json',
 },
 });
 } catch (error) {
 console.error('Backstage API proxy error:', error);
 return NextResponse.json(
 { error: 'Failed to proxy request to Backstage' },
 { status: 500 }
 );
 }
}