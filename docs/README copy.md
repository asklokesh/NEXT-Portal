# Backstage Enterprise Portal

Enterprise-grade Internal Developer Portal built on Backstage.io with no-code capabilities and advanced plugin ecosystem.

## Quick Start

### Option 1: Docker Compose (Recommended)
```bash
# Start all services (PostgreSQL, Redis, Portal)
docker-compose up -d

# Access the portal
open http://localhost:4400
```

### Option 2: Local Development
```bash
# Install dependencies
npm install

# Start all services
./scripts/start-all.sh

# Or start individually
npm run dev          # Start portal on http://localhost:4400
```

## Key Features

- **Service Catalog**: Complete service registry with auto-discovery
- **Plugin Marketplace**: 50+ pre-configured Backstage plugins
- **No-Code Builder**: Visual configuration without YAML editing
- **AI-Powered**: Smart categorization and semantic search
- **Real-Time Sync**: WebSocket-based live updates
- **Cost Tracking**: Cloud cost analytics and budgeting
- **Health Monitoring**: Service health dashboards

## Project Structure

```
saas-idp/
├── src/                    # Application source code
├── scripts/               # Utility scripts
├── docker-compose.yml     # Docker services configuration
├── package.json          # Node.js dependencies
└── docs/                 # Documentation
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `./scripts/start-all.sh` - Start all services
- `./scripts/stop-all.sh` - Stop all services
- `./scripts/restart-all.sh` - Restart all services

## Requirements

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 14+ (via Docker)
- Redis 7+ (via Docker)

## Quick Links

- Portal: http://localhost:4400
- API Docs: http://localhost:4400/api-docs
- Health Check: http://localhost:4400/api/health

## Support

For issues or questions, please check the `/docs` folder or create an issue in the repository.