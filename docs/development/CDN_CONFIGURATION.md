# CDN Configuration Guide

This guide explains how to configure and use CDN (Content Delivery Network) support in the Backstage IDP Wrapper for improved performance and scalability.

## Overview

The platform includes built-in CDN support to:
- Serve static assets from edge locations closer to users
- Reduce server load and bandwidth costs
- Improve page load times globally
- Enable better caching strategies

## Configuration

### Environment Variables

```bash
# CDN URL (without trailing slash)
CDN_URL=https://cdn.example.com

# CDN provider-specific settings
CDN_PROVIDER=cloudfront # Options: cloudfront, cloudflare, fastly, akamai
CDN_BUCKET=my-static-assets-bucket
CDN_REGION=us-east-1

# Enable CDN image optimization (if supported by provider)
NEXT_PUBLIC_CDN_SUPPORTS_OPTIMIZATION=true
```

### Supported CDN Providers

#### AWS CloudFront
```bash
CDN_URL=https://d1234567890.cloudfront.net
CDN_PROVIDER=cloudfront
CDN_BUCKET=my-s3-bucket
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
CLOUDFRONT_DISTRIBUTION_ID=E1234567890
```

#### Cloudflare
```bash
CDN_URL=https://cdn.yourdomain.com
CDN_PROVIDER=cloudflare
CLOUDFLARE_ZONE_ID=your-zone-id
CLOUDFLARE_API_TOKEN=your-api-token
```

#### Fastly
```bash
CDN_URL=https://cdn.fastly.com/your-service
CDN_PROVIDER=fastly
FASTLY_API_KEY=your-api-key
FASTLY_SERVICE_ID=your-service-id
```

## Usage

### Automatic CDN Usage

Once configured, the following assets are automatically served from CDN:
- JavaScript bundles (`/_next/static/`)
- CSS files
- Fonts (`/fonts/`)
- Images (`/images/`, `/icons/`)
- Other static assets

### CDN Image Component

Use the `CDNImage` component for optimized image loading:

```tsx
import { CDNImage } from '@/components/ui/CDNImage';

<CDNImage
 src="/images/hero.png"
 alt="Hero Image"
 width={1200}
 height={600}
 priority
/>
```

### Programmatic CDN Usage

```tsx
import { getAssetUrl, preloadAssets } from '@/lib/cdn';

// Get CDN URL for an asset
const logoUrl = getAssetUrl('/images/logo.png');

// Preload critical assets
preloadAssets([
 '/fonts/inter-var.woff2',
 '/images/hero.png',
]);
```

## Deployment

### Build with CDN

```bash
# Build and deploy to CDN
npm run build:prod

# Or separately
npm run build
npm run cdn:deploy
```

### Manual CDN Deployment

```bash
# Set environment variables
export CDN_URL=https://cdn.example.com
export CDN_BUCKET=my-bucket

# Run deployment script
node scripts/cdn-deploy.js
```

## Caching Strategy

### Cache Headers

Different asset types have optimized cache headers:

| Asset Type | Cache Control | Max Age |
|------------|--------------|---------|
| JS/CSS (hashed) | `immutable` | 1 year |
| Fonts | `immutable` | 1 year |
| Images | `stale-while-revalidate` | 30 days |
| Icons | `stale-while-revalidate` | 30 days |
| API responses | `no-cache` | 0 |

### Cache Invalidation

For CloudFront:
```bash
aws cloudfront create-invalidation \
 --distribution-id E1234567890 \
 --paths "/_next/static/*" "/images/*"
```

For Cloudflare:
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/{zone_id}/purge_cache" \
 -H "Authorization: Bearer {api_token}" \
 -H "Content-Type: application/json" \
 --data '{"files":["https://cdn.example.com/images/hero.png"]}'
```

## Performance Optimization

### 1. Image Optimization

If your CDN supports image optimization:
```bash
NEXT_PUBLIC_CDN_SUPPORTS_OPTIMIZATION=true
```

This enables on-the-fly image resizing and format conversion.

### 2. Preloading Critical Assets

The CDNProvider automatically preloads critical assets:
```tsx
// In app/layout.tsx
const CRITICAL_ASSETS = [
 '/fonts/inter-var.woff2',
 '/icons/icon-192x192.png',
];
```

### 3. Route-based Prefetching

Resources are prefetched based on the current route:
```tsx
const ROUTE_PREFETCH_MAP = {
 '/dashboard': ['/images/dashboard-bg.png'],
 '/catalog': ['/images/catalog-hero.png'],
};
```

### 4. DNS Prefetch

External domains are prefetched for faster connections:
```tsx
const EXTERNAL_DOMAINS = [
 'https://fonts.googleapis.com',
 'https://fonts.gstatic.com',
];
```

## Monitoring

### CloudFront Metrics
- Cache hit ratio
- Origin bandwidth usage
- Request count by edge location

### Cloudflare Analytics
- Cached vs uncached requests
- Bandwidth saved
- Performance metrics

### Custom Monitoring
```tsx
// Track CDN performance
if (window.performance) {
 const resources = window.performance.getEntriesByType('resource');
 resources.forEach(resource => {
 if (resource.name.includes(CDN_URL)) {
 console.log(`CDN ${resource.name}: ${resource.duration}ms`);
 }
 });
}
```

## Troubleshooting

### Assets Not Loading from CDN

1. Check environment variables:
 ```bash
 echo $CDN_URL
 echo $NEXT_PUBLIC_CDN_URL
 ```

2. Verify Next.js configuration:
 ```js
 // next.config.js
 assetPrefix: process.env.CDN_URL || '',
 ```

3. Check browser network tab for asset URLs

### CORS Issues

Add CORS headers to your CDN:
```json
{
 "AllowedOrigins": ["https://yourdomain.com"],
 "AllowedMethods": ["GET", "HEAD"],
 "AllowedHeaders": ["*"],
 "MaxAgeSeconds": 3600
}
```

### Cache Not Updating

1. Check cache headers in browser DevTools
2. Perform cache invalidation
3. Use versioned filenames for critical updates

## Best Practices

1. **Use Immutable Assets**: Leverage Next.js's automatic file hashing
2. **Optimize Images**: Use WebP format with fallbacks
3. **Monitor Performance**: Track cache hit rates and latency
4. **Set Up Alerts**: Monitor CDN availability and performance
5. **Test Globally**: Verify performance from different regions
6. **Use HTTP/2**: Ensure CDN supports HTTP/2 for multiplexing
7. **Enable Compression**: Use Brotli or gzip compression
8. **Security Headers**: Configure security headers at CDN level

## Cost Optimization

1. **Set appropriate cache durations** to reduce origin requests
2. **Use image optimization** to reduce bandwidth
3. **Monitor usage** and adjust cache strategies
4. **Consider regional CDNs** for specific geographic needs
5. **Implement bandwidth alerts** to prevent bill shock

## Security Considerations

1. **Use HTTPS only** for all CDN assets
2. **Implement CSP headers** to prevent XSS
3. **Restrict bucket access** to CDN only
4. **Enable CDN logs** for security monitoring
5. **Use signed URLs** for sensitive content
6. **Regular security audits** of CDN configuration