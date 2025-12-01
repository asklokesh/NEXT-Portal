# NEXT Portal - Enterprise Internal Developer Portal

<p align="center">
  <img src="public/logo.svg" alt="NEXT Portal Logo" width="200" />
</p>

<p align="center">
  <strong>A Modern, Enterprise-Grade Internal Developer Portal</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#installation">Installation</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Overview

NEXT Portal is a comprehensive Internal Developer Portal (IDP) designed to compete with Spotify Portal (AiKA) and Harness IDP. Built on top of Backstage, it provides a seamless, no-code experience for developers and platform teams.

### Key Differentiators

- **AI-Powered Knowledge Assistant** - Natural language interface for documentation, troubleshooting, and code assistance
- **No-Code Portal Builder** - Drag-and-drop page creation without writing code
- **DORA Metrics & Analytics** - Built-in DevOps performance tracking
- **Enterprise Security** - RBAC, SSO/SAML, audit logging, and compliance
- **Self-Service Actions** - One-click deployments, scaling, and operations
- **Golden Path Templates** - Standardized service scaffolding

---

## Features

### Phase 1: AI Knowledge Assistant
- Conversational AI for documentation Q&A
- Code explanation and troubleshooting
- RAG-based knowledge retrieval
- Multi-model support (GPT, Claude)

### Phase 2: No-Code Portal Builder
- Drag-and-drop page editor
- 50+ pre-built widgets
- Theme customization
- Responsive design tools

### Phase 3: Service Health & Scorecards
- Real-time health monitoring
- Custom scorecards (security, reliability, documentation)
- SLO/SLI tracking
- Incident management integration

### Phase 4: Golden Paths & Templates
- Software templates with wizard UI
- Multi-language support (Node.js, Python, Go, Java, etc.)
- Template execution engine
- GitHub/GitLab integration

### Phase 5: Self-Service Actions
- One-click deployments
- Scale, restart, rollback operations
- Approval workflows
- Audit trail

### Phase 6: Software Catalog Enhancements
- 13 entity types (Component, API, Resource, etc.)
- Dependency graph visualization
- Faceted search
- Entity lifecycle management

### Phase 7: Data & Analytics
- DORA metrics dashboard
- Cost analytics and optimization
- Developer productivity metrics
- Custom dashboards

### Phase 8: Enterprise Security
- Role-Based Access Control (RBAC)
- SSO/SAML/OIDC support
- MFA enrollment
- Comprehensive audit logging
- SOC2, GDPR, HIPAA compliance

### Phase 9: Developer Experience
- CLI tool for portal operations
- Auto-generated API documentation
- SDK generation (TypeScript, Python)
- IDE integrations

---

## Quick Start

### One-Click Setup (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/NEXT-Portal.git
cd NEXT-Portal

# Run the setup script
./scripts/setup.sh
```

This will:
1. Check prerequisites (Node.js, Docker)
2. Install dependencies
3. Set up the database
4. Start all services
5. Open the portal in your browser

### Using Docker Compose

```bash
# Start everything with Docker
docker-compose -f docker-compose.full.yml up -d

# View logs
docker-compose -f docker-compose.full.yml logs -f

# Stop everything
docker-compose -f docker-compose.full.yml down
```

### Manual Development Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Set up database
npm run db:setup

# Start development server
npm run dev
```

Access the portal at: **http://localhost:4400**

---

## Installation

### Prerequisites

| Software | Version | Required |
|----------|---------|----------|
| Node.js | >= 18.17.0 | ✅ Yes |
| npm | >= 9.0.0 | ✅ Yes |
| Docker | >= 24.0.0 | ✅ Yes |
| Docker Compose | >= 2.20.0 | ✅ Yes |
| PostgreSQL | >= 15 | Optional (Docker included) |
| Redis | >= 7 | Optional (Docker included) |

### Step-by-Step Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/your-org/NEXT-Portal.git
cd NEXT-Portal
```

#### 2. Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env.local

# Edit the configuration
nano .env.local
```

#### 3. Database Setup

**Option A: Using Docker (Recommended)**
```bash
# Start PostgreSQL and Redis
docker-compose up -d db redis

# Run migrations
npm run db:migrate

# Seed sample data
npm run db:seed
```

**Option B: Using Existing Database**
```bash
# Set your database URL in .env.local
DATABASE_URL="postgresql://user:password@host:5432/database"

# Run migrations
npm run db:migrate
```

#### 4. Install Dependencies

```bash
# Install Node.js packages
npm install

# Generate Prisma client
npm run db:generate
```

#### 5. Start the Application

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm run build
npm run start
```

---

## Configuration

### Environment Variables

Create a `.env.local` file with the following variables:

```env
# =============================================================================
# Core Application Settings
# =============================================================================
NODE_ENV=development
PORT=4400
NEXT_PUBLIC_APP_URL=http://localhost:4400

# =============================================================================
# Database Configuration
# =============================================================================
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/next_portal
USE_MOCK_DB=false
USE_MOCK_DATA=false

# =============================================================================
# Redis Configuration
# =============================================================================
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=
REDIS_TLS_ENABLED=false

# =============================================================================
# Authentication
# =============================================================================
NEXTAUTH_URL=http://localhost:4400
NEXTAUTH_SECRET=your-super-secret-key-change-in-production

# SSO/SAML Configuration (optional)
SSO_ENABLED=false
SAML_ENTITY_ID=
SAML_SSO_URL=
SAML_CERTIFICATE=

# OAuth Providers (optional)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# =============================================================================
# External Integrations
# =============================================================================
# Backstage
BACKSTAGE_API_URL=http://localhost:7007
BACKSTAGE_API_TOKEN=

# Git Providers
GITHUB_TOKEN=
GITLAB_TOKEN=
BITBUCKET_TOKEN=

# CI/CD
JENKINS_URL=
JENKINS_USER=
JENKINS_TOKEN=
ARGOCD_URL=
ARGOCD_TOKEN=

# Monitoring
PROMETHEUS_URL=http://localhost:9090
GRAFANA_URL=http://localhost:3000
GRAFANA_API_KEY=
DATADOG_API_KEY=
DATADOG_APP_KEY=

# Incident Management
PAGERDUTY_API_KEY=
OPSGENIE_API_KEY=

# =============================================================================
# Cloud Providers
# =============================================================================
# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# Azure
AZURE_SUBSCRIPTION_ID=
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=

# GCP
GCP_PROJECT_ID=
GCP_SERVICE_ACCOUNT_KEY=

# =============================================================================
# Feature Flags
# =============================================================================
ENABLE_AI_ASSISTANT=true
ENABLE_PORTAL_BUILDER=true
ENABLE_SCORECARDS=true
ENABLE_TEMPLATES=true
ENABLE_ACTIONS=true
ENABLE_ANALYTICS=true
ENABLE_ENTERPRISE=true
ENABLE_WEBSOCKET=true
ENABLE_NOTIFICATIONS=true
ENABLE_AUDIT_LOGS=true
ENABLE_COST_TRACKING=true

# =============================================================================
# AI Configuration
# =============================================================================
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
AI_MODEL=gpt-4
AI_MAX_TOKENS=4096

# =============================================================================
# Performance & Limits
# =============================================================================
API_RATE_LIMIT=100
API_RATE_LIMIT_WINDOW=60
MAX_UPLOAD_SIZE=10mb
```

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer                             │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                      NEXT Portal (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Pages &   │  │     API     │  │  WebSocket  │              │
│  │ Components  │  │   Routes    │  │   Server    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
    ┌─────────────────────────┼─────────────────────────┐
    │                         │                         │
┌───▼───┐               ┌─────▼─────┐             ┌─────▼─────┐
│ Redis │               │PostgreSQL │             │ Backstage │
│ Cache │               │  Database │             │  Backend  │
└───────┘               └───────────┘             └───────────┘
```

### Service Components

| Service | Port | Description |
|---------|------|-------------|
| NEXT Portal | 4400 | Main application |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Caching & sessions |
| WebSocket | 3001 | Real-time updates |
| Backstage | 7007 | Catalog backend |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3000 | Dashboards |

### Directory Structure

```
NEXT-Portal/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   ├── (dashboard)/       # Dashboard pages
│   │   └── layout.tsx         # Root layout
│   ├── components/            # React components
│   │   ├── ui/               # Base UI components
│   │   ├── catalog/          # Catalog components
│   │   ├── templates/        # Template components
│   │   ├── actions/          # Action components
│   │   ├── analytics/        # Analytics dashboards
│   │   └── portal-builder/   # Portal builder components
│   ├── services/             # Business logic
│   │   ├── ai/              # AI assistant service
│   │   ├── catalog/         # Catalog service
│   │   ├── templates/       # Template service
│   │   ├── actions/         # Action service
│   │   ├── analytics/       # Analytics service
│   │   ├── enterprise/      # Enterprise features
│   │   │   ├── rbac/       # Role-based access control
│   │   │   ├── audit/      # Audit logging
│   │   │   └── sso/        # SSO integration
│   │   └── developer-experience/
│   │       ├── cli/        # CLI tool
│   │       └── docs/       # API documentation
│   ├── lib/                  # Shared utilities
│   └── hooks/                # React hooks
├── prisma/                   # Database schema
├── public/                   # Static assets
├── scripts/                  # Setup & utility scripts
├── tests/                    # Test suites
├── docker-compose.yml        # Docker configuration
└── package.json              # Project manifest
```

---

## Development

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Visual regression tests
npm run test:visual

# All tests
npm run test:all
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix lint issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run typecheck
```

### Database Operations

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Reset database
npm run db:reset

# Open Prisma Studio
npm run db:studio
```

### Building for Production

```bash
# Build the application
npm run build

# Build with bundle analysis
npm run analyze

# Start production server
npm run start
```

---

## Deployment

### Docker Deployment

```bash
# Build Docker image
docker build -t next-portal:latest .

# Run container
docker run -p 4400:4400 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  next-portal:latest
```

### Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f infrastructure/kubernetes/

# Check deployment status
kubectl get pods -n next-portal
```

### Cloud Deployments

- **AWS**: See `infrastructure/aws/README.md`
- **Azure**: See `infrastructure/azure/README.md`
- **GCP**: See `infrastructure/gcp/README.md`

---

## CLI Tool

The NEXT Portal CLI provides command-line access to portal features:

```bash
# Install globally
npm install -g @next-portal/cli

# Login
portal login

# List catalog entities
portal catalog list -k Component

# Run a template
portal template run nodejs-service

# Execute an action
portal action run deploy -e Component:default/api-gateway

# View DORA metrics
portal analytics dora --team platform-team
```

See [CLI Documentation](docs/cli.md) for full reference.

---

## API Documentation

API documentation is auto-generated and available at:

- **Swagger UI**: http://localhost:4400/api/docs
- **ReDoc**: http://localhost:4400/api/redoc
- **OpenAPI Spec**: http://localhost:4400/api/openapi.json

### SDK Generation

```bash
# Generate TypeScript SDK
portal sdk generate --language typescript --output ./sdk

# Generate Python SDK
portal sdk generate --language python --output ./sdk-python
```

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm run test`
5. Commit: `git commit -m "feat: add my feature"`
6. Push: `git push origin feature/my-feature`
7. Open a Pull Request

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance

---

## Support

- **Documentation**: [docs.next-portal.io](https://docs.next-portal.io)
- **Issues**: [GitHub Issues](https://github.com/your-org/NEXT-Portal/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/NEXT-Portal/discussions)
- **Slack**: [#next-portal](https://your-org.slack.com/channels/next-portal)

---

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by the Platform Team
</p>
