/**
 * CDN configuration and utilities
 */

export const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || '';

/**
 * Get the full URL for a static asset
 * @param path - The path to the asset (e.g., '/images/logo.png')
 * @returns The full URL including CDN if configured
 */
export function getAssetUrl(path: string): string {
 if (!path) return '';
 
 // If CDN is configured and this is a static asset
 if (CDN_URL && isStaticAsset(path)) {
 // Ensure path starts with /
 const normalizedPath = path.startsWith('/') ? path : `/${path}`;
 return `${CDN_URL}${normalizedPath}`;
 }
 
 // Return path as-is for non-static assets or when CDN is not configured
 return path;
}

/**
 * Check if a path is a static asset that should be served from CDN
 */
function isStaticAsset(path: string): boolean {
 const staticPatterns = [
 /^\/images\//,
 /^\/fonts\//,
 /^\/icons\//,
 /^\/static\//,
 /^\/_next\/static\//,
 /\.(png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|otf|css|js)$/i,
 ];
 
 return staticPatterns.some(pattern => pattern.test(path));
}

/**
 * Preload critical assets
 */
export function preloadAssets(assets: string[]): void {
 if (typeof window === 'undefined') return;
 
 assets.forEach(asset => {
 const url = getAssetUrl(asset);
 const link = document.createElement('link');
 link.rel = 'preload';
 link.href = url;
 
 // Determine 'as' attribute based on file extension
 if (/\.(woff2?|ttf|otf)$/i.test(asset)) {
 link.as = 'font';
 link.crossOrigin = 'anonymous';
 } else if (/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(asset)) {
 link.as = 'image';
 } else if (/\.css$/i.test(asset)) {
 link.as = 'style';
 } else if (/\.js$/i.test(asset)) {
 link.as = 'script';
 }
 
 document.head.appendChild(link);
 });
}

/**
 * Configure image optimization for CDN
 */
export function getCDNImageLoader({ src, width, quality }: {
 src: string;
 width: number;
 quality?: number;
}) {
 // If using a CDN that supports image optimization (e.g., Cloudinary, Imgix)
 if (CDN_URL && process.env.NEXT_PUBLIC_CDN_SUPPORTS_OPTIMIZATION === 'true') {
 const params = new URLSearchParams({
 w: width.toString(),
 q: (quality || 75).toString(),
 });
 return `${CDN_URL}/optimize${src}?${params.toString()}`;
 }
 
 // Fall back to Next.js default image optimization
 return src;
}

/**
 * Get srcset for responsive images
 */
export function getResponsiveImageSrcSet(
 src: string,
 sizes: number[] = [640, 750, 828, 1080, 1200, 1920]
): string {
 return sizes
 .map(size => {
 const url = getCDNImageLoader({ src, width: size });
 return `${url} ${size}w`;
 })
 .join(', ');
}

/**
 * Prefetch resources for better performance
 */
export function prefetchResources(resources: string[]): void {
 if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
 
 resources.forEach(resource => {
 const url = getAssetUrl(resource);
 const link = document.createElement('link');
 link.rel = 'prefetch';
 link.href = url;
 document.head.appendChild(link);
 });
}

/**
 * DNS prefetch for external domains
 */
export function dnsPrefetch(domains: string[]): void {
 if (typeof window === 'undefined') return;
 
 domains.forEach(domain => {
 const link = document.createElement('link');
 link.rel = 'dns-prefetch';
 link.href = domain;
 document.head.appendChild(link);
 });
}

/**
 * Preconnect to external domains
 */
export function preconnect(domains: string[]): void {
 if (typeof window === 'undefined') return;
 
 domains.forEach(domain => {
 const link = document.createElement('link');
 link.rel = 'preconnect';
 link.href = domain;
 link.crossOrigin = 'anonymous';
 document.head.appendChild(link);
 });
}