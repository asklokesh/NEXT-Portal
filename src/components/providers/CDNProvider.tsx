'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { preloadAssets, prefetchResources, dnsPrefetch, preconnect } from '@/lib/cdn';

interface CDNProviderProps {
 children: React.ReactNode;
}

// Critical assets to preload
const CRITICAL_ASSETS = [
 '/fonts/inter-var.woff2',
 '/icons/icon-192x192.png',
];

// Resources to prefetch based on route
const ROUTE_PREFETCH_MAP: Record<string, string[]> = {
 '/dashboard': [
 '/images/dashboard-bg.png',
 '/_next/static/chunks/pages-dashboard.js',
 ],
 '/catalog': [
 '/images/catalog-hero.png',
 '/_next/static/chunks/pages-catalog.js',
 ],
 '/templates': [
 '/images/templates-bg.png',
 '/_next/static/chunks/pages-templates.js',
 ],
};

// External domains to optimize
const EXTERNAL_DOMAINS = [
 'https://fonts.googleapis.com',
 'https://fonts.gstatic.com',
];

export function CDNProvider({ children }: CDNProviderProps) {
 const pathname = usePathname();

 // Preload critical assets on mount
 useEffect(() => {
 preloadAssets(CRITICAL_ASSETS);
 }, []);

 // DNS prefetch and preconnect to external domains
 useEffect(() => {
 dnsPrefetch(EXTERNAL_DOMAINS);
 preconnect(EXTERNAL_DOMAINS);
 }, []);

 // Prefetch resources based on current route
 useEffect(() => {
 const routeResources = ROUTE_PREFETCH_MAP[pathname];
 if (routeResources) {
 // Delay prefetch to avoid competing with initial page load
 const timer = setTimeout(() => {
 prefetchResources(routeResources);
 }, 2000);

 return () => clearTimeout(timer);
 }
 }, [pathname]);

 // Prefetch adjacent routes
 useEffect(() => {
 if (typeof window === 'undefined' || !('requestIdleCallback' in window)) return;

 const adjacentRoutes = getAdjacentRoutes(pathname);
 
 window.requestIdleCallback(() => {
 adjacentRoutes.forEach(route => {
 const resources = ROUTE_PREFETCH_MAP[route];
 if (resources) {
 prefetchResources(resources);
 }
 });
 });
 }, [pathname]);

 return <>{children}</>;
}

// Get adjacent routes that user is likely to navigate to
function getAdjacentRoutes(currentPath: string): string[] {
 const routes = ['/dashboard', '/catalog', '/templates', '/create'];
 const currentIndex = routes.indexOf(currentPath);
 
 if (currentIndex === -1) return [];
 
 const adjacent: string[] = [];
 
 // Previous route
 if (currentIndex > 0) {
 adjacent.push(routes[currentIndex - 1]);
 }
 
 // Next route
 if (currentIndex < routes.length - 1) {
 adjacent.push(routes[currentIndex + 1]);
 }
 
 return adjacent;
}

// Hook to manually prefetch resources
export function usePrefetch() {
 const prefetch = (resources: string[]) => {
 if (typeof window === 'undefined') return;
 
 // Use requestIdleCallback if available
 if ('requestIdleCallback' in window) {
 window.requestIdleCallback(() => {
 prefetchResources(resources);
 });
 } else {
 // Fallback with setTimeout
 setTimeout(() => {
 prefetchResources(resources);
 }, 1);
 }
 };

 return { prefetch };
}