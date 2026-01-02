# NEXT Portal

**Enterprise-Grade Internal Developer Platform**

A modern, AI-powered Internal Developer Platform (IDP) designed to compete with Spotify Backstage, Harness IDP, and Cortex. Built for Fortune 500 scale with enterprise security, multi-tenant architecture, and comprehensive developer experience optimization.

---

## Overview

NEXT Portal is a comprehensive Internal Developer Platform that provides:

- **Service Catalog** - Centralized discovery and management of all services, APIs, and resources
- **Software Templates** - Golden path templates for rapid service scaffolding
- **Integration Hub** - No-code integration with GitHub, GitLab, Jira, Kubernetes, and more
- **Quality Scorecards** - Automated service quality scoring and compliance tracking
- **Cost Management** - FinOps integration with cloud cost visibility and optimization
- **Real-time Dashboard** - Customizable widgets with WebSocket-powered live updates
- **Plugin Marketplace** - Extensible architecture with 1,000+ plugin support

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Framework** | Next.js 15.4.4 (App Router) |
| **Language** | TypeScript 5.3.3 |
| **Database** | PostgreSQL 15 + Prisma ORM 6.12 |
| **Cache** | Redis 7 / ioredis |
| **UI** | Radix UI + Tailwind CSS 3.4 |
| **State** | Zustand + React Query 5 |
| **Real-time** | Socket.io 4.8 / WebSocket |
| **API** | REST + GraphQL (Apollo) |
| **Auth** | NextAuth 4.24 (OAuth/SAML/MFA) |
| **Visualization** | D3.js + Recharts + React Force Graph |
| **Observability** | OpenTelemetry + Prometheus + Jaeger |
| **Cloud** | AWS / Azure / GCP SDKs |
| **Container** | Docker + Kubernetes |

---

## Quick Start

### Prerequisites

- Node.js >= 18.17.0
- Docker >= 24.0.0
- PostgreSQL 15 (or use Docker)
- Redis 7 (or use Docker)

### One-Command Setup

```bash
git clone https://github.com/your-org/NEXT-Portal.git
cd NEXT-Portal
./scripts/setup.sh
```

### Manual Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your settings

# Start database services
docker-compose up -d db redis

# Run database migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Start development server
npm run dev
```

Access the portal at **http://localhost:4400**

---

## Project Structure

```
NEXT-Portal/
├── src/
│   ├── app/                    # Next.js App Router pages & API routes
│   │   ├── api/               # 80+ REST API endpoints
│   │   ├── dashboard/         # Dashboard page
│   │   ├── catalog/           # Service catalog
│   │   ├── create/            # Service scaffolding
│   │   ├── plugins/           # Plugin management
│   │   ├── kubernetes/        # K8s cluster management
│   │   └── ...
│   ├── components/            # React components
│   │   ├── ui/               # Base UI components (Radix)
│   │   ├── dashboard/        # Dashboard widgets
│   │   ├── catalog/          # Catalog components
│   │   └── ...
│   ├── services/             # Business logic services
│   │   ├── integrations/     # Integration providers
│   │   ├── scorecards/       # Quality scoring engine
│   │   ├── cost/             # Cost management
│   │   ├── scaffolder/       # Template execution
│   │   └── analytics/        # DORA metrics
│   ├── lib/                  # Shared utilities
│   │   ├── auth/             # Authentication
│   │   ├── prisma.ts         # Database client
│   │   └── websocket/        # Real-time services
│   └── middleware/           # Edge middleware
├── prisma/
│   ├── schema.prisma         # Database schema (50+ models)
│   └── migrations/           # Database migrations
├── infrastructure/           # Kubernetes & cloud configs
├── scripts/                  # Utility scripts
├── tests/                    # Test suites
└── docs/                     # Documentation
```

---

## Core Features

### Service Catalog

- 7 entity types: Service, Website, Library, Documentation, Tool, Database, Infrastructure
- Dependency graph visualization with D3/Force Graph
- Automated health monitoring with configurable checks
- Full-text search with advanced filtering
- Lifecycle management (experimental, development, production, deprecated)

### Software Templates (Scaffolder)

- Parameterized templates with JSON Schema validation
- Multi-step wizard UI
- GitHub/GitLab repository creation
- Automatic catalog registration
- Job status tracking with real-time updates

### Integration Hub

Built-in providers:
- **GitHub** - Repository sync, PR automation
- **GitLab** - Project sync, CI/CD integration
- **Jira** - Issue tracking, workflow automation
- **Kubernetes** - Cluster management, workload discovery
- **ArgoCD** - GitOps deployment tracking
- **Datadog** - Monitoring integration
- **Slack** - Notifications and alerts

### Quality Scorecards

- Configurable rule engine with weighted scoring
- Levels: Gold, Silver, Bronze, Failing
- Built-in checks: ownership, documentation, health, security, lifecycle
- Historical trend tracking
- Team-level aggregation

### Dashboard & Analytics

- Real-time WebSocket updates
- Customizable widget grid (React Grid Layout)
- Built-in widgets: Cluster Status, Cost Overview, Service Counts, Deployment Status
- DORA metrics: Deployment Frequency, Lead Time, MTTR, Change Failure Rate
- Executive dashboards with cost visibility

### Multi-Tenant Architecture

- Row-level security with tenant isolation
- Edge middleware for tenant context
- Per-tenant configuration and branding
- Team-based access control (RBAC)

---

## API Reference

### Authentication
```
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Service Catalog
```
GET    /api/catalog/entities
POST   /api/catalog/entities
GET    /api/catalog/entities/:id
PUT    /api/catalog/entities/:id
DELETE /api/catalog/entities/:id
GET    /api/catalog/stats
```

### Templates & Scaffolding
```
GET  /api/templates
POST /api/templates
GET  /api/scaffolder/templates
POST /api/scaffolder/jobs
GET  /api/scaffolder/jobs/:id
```

### Integrations
```
GET  /api/integrations
POST /api/integrations
POST /api/integrations/:id/sync
```

### Scorecards
```
GET  /api/scorecards
POST /api/scorecards
GET  /api/scorecards/:id
POST /api/scorecards/:id/evaluate
```

### Dashboard
```
GET  /api/dashboard/widget
POST /api/dashboard/widget
```

Full API documentation available at `/api/docs` when running locally.

---

## Configuration

### Environment Variables

```env
# Core
NODE_ENV=development
PORT=4400
NEXT_PUBLIC_APP_URL=http://localhost:4400

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/next_portal
REDIS_URL=redis://localhost:6379

# Authentication
NEXTAUTH_URL=http://localhost:4400
NEXTAUTH_SECRET=your-secret-key

# OAuth (optional)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Integrations (optional)
GITHUB_TOKEN=
GITLAB_TOKEN=
JIRA_URL=
JIRA_TOKEN=

# Cloud Providers (optional)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AZURE_SUBSCRIPTION_ID=
GCP_PROJECT_ID=

# Feature Flags
ENABLE_WEBSOCKET=true
ENABLE_COST_TRACKING=true
ENABLE_ANALYTICS=true
```

---

## Development

### Available Scripts

```bash
# Development
npm run dev              # Start dev server on port 4400
npm run dev:all          # Start with WebSocket server

# Building
npm run build            # Production build
npm run build:analyze    # Build with bundle analysis
npm run start            # Start production server

# Database
npm run db:migrate       # Run migrations
npm run db:generate      # Generate Prisma client
npm run db:seed          # Seed sample data
npm run db:studio        # Open Prisma Studio

# Testing
npm run test             # Unit tests (Jest)
npm run test:e2e         # E2E tests (Playwright)
npm run test:visual      # Visual regression tests
npm run test:coverage    # Coverage report

# Code Quality
npm run lint             # ESLint
npm run lint:fix         # Auto-fix lint issues
npm run typecheck        # TypeScript check
npm run format           # Prettier format
```

### Testing

```bash
# Run all tests
npm run test:all

# Run specific test suites
npm run test:e2e                    # End-to-end
npm run test:visual                 # Visual regression
npm run test:accessibility          # A11y tests
npm run test:performance            # Load tests (k6)
```

---

## Deployment

### Docker

```bash
# Build image
docker build -t next-portal:latest .

# Run container
docker run -p 4400:4400 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  next-portal:latest
```

### Docker Compose

```bash
# Start all services
docker-compose -f docker-compose.full.yml up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -f infrastructure/kubernetes/

# Verify deployment
kubectl get pods -n next-portal
```

See `infrastructure/` directory for cloud-specific deployment guides (AWS, Azure, GCP).

---

## Architecture

```
                    Load Balancer
                         |
            +------------+------------+
            |                         |
      Next.js App               WebSocket Server
      (Port 4400)               (Port 3001)
            |                         |
            +------------+------------+
                         |
            +------------+------------+
            |            |            |
       PostgreSQL     Redis       Backstage
       (Primary)     (Cache)      (Optional)
```

### Key Design Decisions

- **App Router**: Next.js 15 with server components for optimal performance
- **Edge Middleware**: Rate limiting, bot detection, tenant context at the edge
- **Multi-layer Caching**: Redis for sessions/API responses, React Query for client-side
- **Event-Driven**: WebSocket for real-time updates, avoiding polling
- **Plugin Architecture**: Dynamic loading with security scanning and version management

---

## Security

- **Authentication**: OAuth 2.0, SAML/SSO, API Keys, MFA (TOTP)
- **Authorization**: RBAC with team-based permissions
- **Data Protection**: Encryption at rest and in transit (TLS 1.3)
- **Multi-Tenancy**: Row-level security with tenant isolation
- **Audit Logging**: Comprehensive activity tracking
- **Compliance Ready**: SOC 2, GDPR, HIPAA frameworks

---

## Performance

| Metric | Target |
|--------|--------|
| API Response (P50) | < 50ms |
| API Response (P95) | < 200ms |
| Concurrent Users | 10,000+ |
| Uptime SLA | 99.99% |
| Page Load (LCP) | < 2.5s |

---

## Documentation

Detailed documentation is available in the `docs/` directory:

- [Technical Architecture](docs/TECHNICAL_ARCHITECTURE_DOCUMENTATION.md)
- [API Reference](docs/API_REFERENCE.md)
- [Database Schema](docs/DATABASE_SCHEMA_DOCUMENTATION.md)
- [Deployment Guide](docs/PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Security Guide](docs/ENTERPRISE_SECURITY_AUDIT_REPORT.md)
- [OAuth Setup](docs/OAUTH_SETUP_GUIDE.md)

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and add tests
4. Run tests: `npm run test`
5. Commit: `git commit -m "feat: add my feature"`
6. Push: `git push origin feature/my-feature`
7. Open a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance

---

## License

Apache 2.0 License - see [LICENSE](LICENSE) for details.

---

## Support

- [GitHub Issues](https://github.com/your-org/NEXT-Portal/issues)
- [Documentation](docs/)
