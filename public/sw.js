// Service Worker for Backstage IDP Wrapper
// Version: 1.0.0

const CACHE_VERSION = 'v1';
const CACHE_NAME = `backstage-idp-${CACHE_VERSION}`;
const RUNTIME_CACHE = `backstage-idp-runtime-${CACHE_VERSION}`;

// Assets to cache on install
const PRECACHE_ASSETS = [
 '/',
 '/dashboard',
 '/catalog',
 '/templates',
 '/offline.html',
 '/manifest.json',
 '/_next/static/css/*.css',
 '/_next/static/js/*.js',
 '/fonts/*.woff2',
];

// Cache strategies
const CACHE_STRATEGIES = {
 // Cache first, fallback to network
 cacheFirst: [
 /^\/fonts\//,
 /^\/images\//,
 /^\/icons\//,
 /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
 /\.(?:woff|woff2|ttf|otf)$/,
 ],
 
 // Network first, fallback to cache
 networkFirst: [
 /^\/api\//,
 /^\/dashboard/,
 /^\/catalog/,
 /^\/templates/,
 /\.(?:json)$/,
 ],
 
 // Stale while revalidate
 staleWhileRevalidate: [
 /^\/static\//,
 /\.(?:js|css)$/,
 ],
 
 // Network only
 networkOnly: [
 /^\/api\/auth/,
 /^\/api\/websocket/,
 /^\/api\/backstage\/catalog\/entities$/,
 ],
};

// Install event - cache essential assets
self.addEventListener('install', (event) => {
 console.log('[ServiceWorker] Install');
 
 event.waitUntil(
 caches.open(CACHE_NAME)
 .then((cache) => {
 console.log('[ServiceWorker] Pre-caching assets');
 // Filter out wildcard patterns and cache actual files
 const actualAssets = PRECACHE_ASSETS.filter(asset => !asset.includes('*'));
 return cache.addAll(actualAssets);
 })
 .then(() => self.skipWaiting())
 );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
 console.log('[ServiceWorker] Activate');
 
 event.waitUntil(
 caches.keys()
 .then((cacheNames) => {
 return Promise.all(
 cacheNames
 .filter((cacheName) => {
 return cacheName.startsWith('backstage-idp-') && cacheName !== CACHE_NAME;
 })
 .map((cacheName) => {
 console.log('[ServiceWorker] Removing old cache:', cacheName);
 return caches.delete(cacheName);
 })
 );
 })
 .then(() => self.clients.claim())
 );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
 const { request } = event;
 const url = new URL(request.url);
 
 // Skip non-GET requests
 if (request.method !== 'GET') {
 return;
 }
 
 // Skip chrome-extension and other non-http(s) requests
 if (!request.url.startsWith('http')) {
 return;
 }
 
 // Determine cache strategy
 let strategy = 'networkFirst'; // default
 
 for (const [strategyName, patterns] of Object.entries(CACHE_STRATEGIES)) {
 if (patterns.some(pattern => pattern.test(url.pathname) || pattern.test(request.url))) {
 strategy = strategyName;
 break;
 }
 }
 
 // Apply strategy
 switch (strategy) {
 case 'cacheFirst':
 event.respondWith(cacheFirst(request));
 break;
 
 case 'networkFirst':
 event.respondWith(networkFirst(request));
 break;
 
 case 'staleWhileRevalidate':
 event.respondWith(staleWhileRevalidate(request));
 break;
 
 case 'networkOnly':
 event.respondWith(networkOnly(request));
 break;
 
 default:
 event.respondWith(networkFirst(request));
 }
});

// Cache strategies implementation
async function cacheFirst(request) {
 const cache = await caches.open(RUNTIME_CACHE);
 const cached = await cache.match(request);
 
 if (cached) {
 return cached;
 }
 
 try {
 const response = await fetch(request);
 if (response.ok) {
 cache.put(request, response.clone());
 }
 return response;
 } catch (error) {
 console.error('[ServiceWorker] Fetch failed:', error);
 return offlineResponse();
 }
}

async function networkFirst(request) {
 try {
 const response = await fetch(request);
 if (response.ok) {
 const cache = await caches.open(RUNTIME_CACHE);
 cache.put(request, response.clone());
 }
 return response;
 } catch (error) {
 const cached = await caches.match(request);
 return cached || offlineResponse();
 }
}

async function staleWhileRevalidate(request) {
 const cache = await caches.open(RUNTIME_CACHE);
 const cached = await cache.match(request);
 
 const fetchPromise = fetch(request).then((response) => {
 if (response.ok) {
 cache.put(request, response.clone());
 }
 return response;
 });
 
 return cached || fetchPromise;
}

async function networkOnly(request) {
 try {
 return await fetch(request);
 } catch (error) {
 console.error('[ServiceWorker] Network request failed:', error);
 throw error;
 }
}

// Offline response
function offlineResponse() {
 return caches.match('/offline.html') || new Response(
 `
 <!DOCTYPE html>
 <html>
 <head>
 <title>Offline - Backstage IDP</title>
 <style>
 body {
 font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
 display: flex;
 align-items: center;
 justify-content: center;
 height: 100vh;
 margin: 0;
 background: #f5f5f5;
 }
 .offline-container {
 text-align: center;
 padding: 2rem;
 background: white;
 border-radius: 8px;
 box-shadow: 0 2px 8px rgba(0,0,0,0.1);
 }
 h1 { color: #333; margin-bottom: 1rem; }
 p { color: #666; margin-bottom: 2rem; }
 button {
 background: #2196F3;
 color: white;
 border: none;
 padding: 0.75rem 1.5rem;
 border-radius: 4px;
 cursor: pointer;
 font-size: 1rem;
 }
 button:hover { background: #1976D2; }
 </style>
 </head>
 <body>
 <div class="offline-container">
 <h1>You're Offline</h1>
 <p>It looks like you've lost your internet connection.<br>Some features may not be available.</p>
 <button onclick="window.location.reload()">Try Again</button>
 </div>
 </body>
 </html>
 `,
 {
 headers: { 'Content-Type': 'text/html' },
 status: 503,
 }
 );
}

// Background sync for failed requests
self.addEventListener('sync', (event) => {
 if (event.tag === 'sync-catalog') {
 event.waitUntil(syncCatalogData());
 }
});

async function syncCatalogData() {
 try {
 const response = await fetch('/api/backstage/catalog/entities');
 if (response.ok) {
 const cache = await caches.open(RUNTIME_CACHE);
 await cache.put('/api/backstage/catalog/entities', response);
 }
 } catch (error) {
 console.error('[ServiceWorker] Sync failed:', error);
 }
}

// Push notifications
self.addEventListener('push', (event) => {
 if (!event.data) return;
 
 const data = event.data.json();
 const options = {
 body: data.body,
 icon: '/icons/icon-192x192.png',
 badge: '/icons/badge-72x72.png',
 vibrate: [100, 50, 100],
 data: {
 dateOfArrival: Date.now(),
 primaryKey: 1,
 },
 actions: [
 {
 action: 'explore',
 title: 'View Details',
 },
 {
 action: 'close',
 title: 'Close',
 },
 ],
 };
 
 event.waitUntil(
 self.registration.showNotification(data.title, options)
 );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
 event.notification.close();
 
 if (event.action === 'explore') {
 event.waitUntil(
 clients.openWindow('/notifications')
 );
 }
});

// Message handler for cache updates
self.addEventListener('message', (event) => {
 if (event.data && event.data.type === 'SKIP_WAITING') {
 self.skipWaiting();
 }
 
 if (event.data && event.data.type === 'CLEAR_CACHE') {
 event.waitUntil(
 caches.keys().then((cacheNames) => {
 return Promise.all(
 cacheNames.map((cacheName) => caches.delete(cacheName))
 );
 })
 );
 }
});