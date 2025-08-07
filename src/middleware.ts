import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { permissionCheckMiddleware } from './middleware/permission-check';

// Security headers configuration
const isDevelopment = process.env.NODE_ENV === 'development';

const cspDirectives = [
 "default-src 'self'",
 "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
 "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
 "font-src 'self' https://fonts.gstatic.com",
 "img-src 'self' data: https: blob:",
 "connect-src 'self' http: https: wss: ws:",
 "frame-ancestors 'none'",
 "base-uri 'self'",
 "form-action 'self'",
 "object-src 'none'"
];

// Only add upgrade-insecure-requests in production with HTTPS enabled
if (!isDevelopment && process.env.FORCE_HTTPS === 'true') {
 cspDirectives.push("upgrade-insecure-requests");
}

const securityHeaders: Record<string, string> = {
 // Content Security Policy
 'Content-Security-Policy': cspDirectives.join('; '),
 
 // Additional security headers
 'X-DNS-Prefetch-Control': 'on',
 'X-Content-Type-Options': 'nosniff',
 'X-Frame-Options': 'DENY',
 'X-XSS-Protection': '1; mode=block',
 'Referrer-Policy': 'strict-origin-when-cross-origin',
 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

// Only add HSTS in production
if (!isDevelopment) {
 securityHeaders['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload';
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

// In-memory store for rate limiting (use Redis in production)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

// Clean up old entries periodically
setInterval(() => {
 const now = Date.now();
 for (const [key, value] of requestCounts.entries()) {
 if (value.resetTime < now) {
 requestCounts.delete(key);
 }
 }
}, 60 * 1000);

function getRateLimitKey(request: NextRequest): string {
 const ip = request.headers.get('x-forwarded-for') || 
 request.headers.get('x-real-ip') || 
 'unknown';
 return `${ip}:${request.nextUrl.pathname}`;
}

function checkRateLimit(request: NextRequest): boolean {
 // Skip rate limiting for static assets
 if (request.nextUrl.pathname.startsWith('/_next/') ||
 request.nextUrl.pathname.startsWith('/static/') ||
 request.nextUrl.pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/)) {
 return true;
 }

 const key = getRateLimitKey(request);
 const now = Date.now();
 const limit = requestCounts.get(key);

 if (!limit || limit.resetTime < now) {
 requestCounts.set(key, {
 count: 1,
 resetTime: now + RATE_LIMIT_WINDOW
 });
 return true;
 }

 if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
 return false;
 }

 limit.count++;
 return true;
}

export async function middleware(request: NextRequest) {
 // Handle HTTPS redirect in production only
 if (!isDevelopment && process.env.FORCE_HTTPS === 'true') {
 const proto = request.headers.get('x-forwarded-proto');
 if (proto === 'http') {
 const url = request.nextUrl.clone();
 url.protocol = 'https:';
 return NextResponse.redirect(url);
 }
 }

 // Check permissions for API routes
 if (request.nextUrl.pathname.startsWith('/api/')) {
 const permissionResponse = await permissionCheckMiddleware(request);
 if (permissionResponse) {
 return permissionResponse;
 }
 }

 // Check rate limit for API routes
 if (request.nextUrl.pathname.startsWith('/api/')) {
 if (!checkRateLimit(request)) {
 return new NextResponse(
 JSON.stringify({ error: 'Too many requests' }),
 {
 status: 429,
 headers: {
 'Content-Type': 'application/json',
 'Retry-After': '60'
 }
 }
 );
 }
 }

 // Apply security headers to all responses
 const response = NextResponse.next();
 
 Object.entries(securityHeaders).forEach(([key, value]) => {
 response.headers.set(key, value);
 });

 // Add request ID for tracing
 const requestId = crypto.randomUUID();
 response.headers.set('X-Request-ID', requestId);

 // CORS configuration for API routes
 if (request.nextUrl.pathname.startsWith('/api/')) {
 const origin = request.headers.get('origin');
 const defaultOrigins = ['http://localhost:3000', 'http://localhost:4400', 'http://localhost:4401'];
 const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || defaultOrigins;
 
 if (origin && allowedOrigins.includes(origin)) {
 response.headers.set('Access-Control-Allow-Origin', origin);
 response.headers.set('Access-Control-Allow-Credentials', 'true');
 }
 
 if (request.method === 'OPTIONS') {
 response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
 response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
 response.headers.set('Access-Control-Max-Age', '86400');
 return new NextResponse(null, { status: 200, headers: response.headers });
 }
 }

 return response;
}

export const config = {
 matcher: [
 /*
 * Match all request paths except for the ones starting with:
 * - _next/static (static files)
 * - _next/image (image optimization files)
 * - favicon.ico (favicon file)
 */
 '/((?!_next/static|_next/image|favicon.ico).*)',
 ],
};