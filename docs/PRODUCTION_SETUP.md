# Production Setup

## Overview

The SaaS IDP Portal is now running in production mode with optimized performance.

## Running Services

1. **PostgreSQL Database**: localhost:5432 (Docker)
2. **Redis Cache**: localhost:6379 (Docker)
3. **Mock Backstage API**: localhost:4402 (Simulates real Backstage backend)
4. **Next.js Production Server**: localhost:4400 (Optimized build)

## Why Mock Backstage API?

The portal uses a mock Backstage API for the following reasons:

1. **Standalone Demo**: Allows the portal to run without requiring a full Backstage installation
2. **Consistent API**: Provides stable endpoints for demonstration purposes
3. **Performance**: Lightweight service that starts quickly
4. **Flexibility**: Easy to modify responses for different demo scenarios

## Production Features

- **Optimized Build**: All JavaScript is minified and bundled
- **Static Generation**: Pages are pre-rendered for faster loading
- **Production Caching**: Enhanced performance with Redis caching
- **Security Headers**: Production-ready security configurations
- **Error Handling**: Graceful error pages and logging

## Access Points

- **Main Portal**: http://localhost:4400
- **Health Check**: http://localhost:4400/api/health
- **API Documentation**: http://localhost:4400/api-docs

## Performance Optimizations

- Server-side rendering for initial page loads
- Static page generation where possible
- Optimized image loading
- Code splitting for faster initial load
- Production-grade caching strategies

## Commands

```bash
# Start production
./scripts/start-production.sh

# Stop production
./scripts/stop-production.sh

# Monitor logs
tail -f logs/nextjs-prod.log
tail -f logs/backstage-prod.log

# Check status
./scripts/status.sh
```

## Integration with Real Backstage

To connect to a real Backstage instance:

1. Update `.env.local` with your Backstage URL:
   ```
   BACKSTAGE_BACKEND_URL=http://your-backstage:7007
   ```

2. Restart the production server:
   ```bash
   ./scripts/stop-production.sh
   ./scripts/start-production.sh
   ```

The portal will automatically use the real Backstage API instead of the mock.