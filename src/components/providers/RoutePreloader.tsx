'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Define routes that should be prefetched based on the current route
const ROUTE_PREFETCH_MAP: Record<string, string[]> = {
 '/': ['/dashboard', '/catalog', '/templates'],
 '/dashboard': ['/analytics', '/monitoring', '/cost'],
 '/catalog': ['/catalog/create', '/templates'],
 '/templates': ['/templates/create', '/templates/builder'],
 '/admin': ['/admin/plugins', '/admin/config', '/admin/maintenance'],
};

export const RoutePreloader = ({ children }: { children: React.ReactNode }) => {
 const pathname = usePathname();
 const router = useRouter();

 useEffect(() => {
 // Prefetch related routes based on current path
 const routesToPrefetch = ROUTE_PREFETCH_MAP[pathname] || [];
 
 // Use requestIdleCallback for non-blocking prefetch
 if ('requestIdleCallback' in window) {
 requestIdleCallback(() => {
 routesToPrefetch.forEach(route => {
 router.prefetch(route);
 });
 });
 } else {
 // Fallback for browsers that don't support requestIdleCallback
 setTimeout(() => {
 routesToPrefetch.forEach(route => {
 router.prefetch(route);
 });
 }, 0);
 }

 // Also prefetch common heavy routes after initial page load
 const prefetchCommonRoutes = () => {
 const commonRoutes = ['/analytics', '/monitoring', '/templates', '/cost'];
 commonRoutes.forEach(route => {
 if (route !== pathname) {
 router.prefetch(route);
 }
 });
 };

 // Delay common route prefetching to avoid blocking initial render
 const timer = setTimeout(prefetchCommonRoutes, 5000);

 return () => clearTimeout(timer);
 }, [pathname, router]);

 return <>{children}</>;
};