# Backstage Integration Guide

This guide explains how to run the UI wrapper with a local Backstage instance for development and testing.

## Prerequisites

- Node.js 20 or 22
- Yarn package manager
- Docker and Docker Compose (optional, for containerized setup)
- PostgreSQL (if not using Docker)

## Quick Start

### Option 1: Using the Setup Script (Recommended)

```bash
# Run the automated setup script
./scripts/setup-backstage-integration.sh
```

This script will:
- Check prerequisites
- Create necessary environment files
- Start both Backstage and the UI wrapper
- Wait for services to be ready

### Option 2: Using Docker Compose

```bash
# Start all services with Docker Compose
docker-compose -f docker-compose.backstage.yml up

# Or run in detached mode
docker-compose -f docker-compose.backstage.yml up -d
```

### Option 3: Manual Setup

#### 1. Install Backstage Dependencies

```bash
cd backstage
yarn install
```

#### 2. Configure Backstage

Create `backstage/app-config.local.yaml`:

```yaml
app:
 title: Local Backstage Instance
 baseUrl: http://localhost:3000 # UI wrapper URL

backend:
 baseUrl: http://localhost:7007
 listen:
 port: 7007
 cors:
 origin: http://localhost:3000
 methods: [GET, HEAD, PATCH, POST, PUT, DELETE]
 credentials: true
 database:
 client: better-sqlite3
 connection: ':memory:'

auth:
 providers:
 guest:
 dangerouslyAllowOutsideDevelopment: true
```

#### 3. Start Backstage

```bash
cd backstage
yarn dev
```

#### 4. Configure UI Wrapper

Create `.env.local` in the root directory:

```env
# Backstage Integration
NEXT_PUBLIC_BACKSTAGE_URL=http://localhost:7007
NEXT_PUBLIC_BACKSTAGE_API_URL=http://localhost:7007/api
BACKSTAGE_API_URL=http://localhost:7007/api

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/idp

# Enable demo mode for development
NEXT_PUBLIC_DEMO_MODE=false
```

#### 5. Start UI Wrapper

```bash
# In the root directory
yarn dev
```

## Accessing the Services

- **UI Wrapper**: http://localhost:3000
- **Backstage API**: http://localhost:7007
- **Backstage UI** (if needed): http://localhost:7007

## Integration Architecture

```
┌─────────────────┐ ┌──────────────────┐ ┌─────────────────┐
│ │ │ │ │ │
│ UI Wrapper │────▶│ Backstage API │────▶│ PostgreSQL │
│ (Next.js) │ │ (Express) │ │ │
│ │ │ │ │ │
└─────────────────┘ └──────────────────┘ └─────────────────┘
 :3000 :7007 :5432
```

### API Proxy Configuration

The UI wrapper proxies all `/api/backstage/*` requests to the Backstage backend:

```
UI Wrapper Request: GET /api/backstage/catalog/entities

Proxied to: GET http://localhost:7007/api/catalog/entities
```

## Key Integration Points

### 1. Service Catalog

The UI wrapper fetches and displays Backstage catalog entities:

```typescript
// In UI wrapper code
const response = await fetch('/api/backstage/catalog/entities');
```

### 2. Software Templates

Templates are fetched from Backstage and executed through the Scaffolder API:

```typescript
// Fetch templates
const templates = await fetch('/api/backstage/catalog/entities?filter=kind=Template');

// Execute template
const task = await fetch('/api/backstage/scaffolder/v1/tasks', {
 method: 'POST',
 body: JSON.stringify({ templateRef, values })
});
```

### 3. Authentication

For local development, guest authentication is enabled. In production, configure proper auth providers.

### 4. Real-time Updates

The UI wrapper can establish WebSocket connections for real-time catalog updates:

```typescript
const ws = new WebSocket('ws://localhost:7007/api/events');
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 7007, and 5432 are not in use
2. **CORS errors**: Check that Backstage cors configuration includes the UI wrapper URL
3. **Database connection**: Verify PostgreSQL is running and accessible
4. **API timeout**: Increase timeout in axios configuration if needed

### Debug Mode

Enable debug logging:

```bash
# For UI wrapper
DEBUG=* yarn dev

# For Backstage
LOG_LEVEL=debug yarn dev
```

### Health Checks

- UI Wrapper: http://localhost:3000/api/health
- Backstage: http://localhost:7007/api/catalog/entities

## Development Workflow

1. Make changes to UI wrapper code
2. Hot reload will automatically update the UI
3. For Backstage plugin changes, restart Backstage
4. Use the browser DevTools to inspect API calls

## Testing Integration

```bash
# Run integration tests
yarn test:integration

# Run E2E tests with both services
yarn test:e2e
```

## Production Deployment

For production deployment:

1. Build both applications
2. Configure proper authentication
3. Use external PostgreSQL database
4. Set up proper CORS policies
5. Configure SSL/TLS
6. Use environment-specific configurations

See the main deployment guide for detailed instructions.