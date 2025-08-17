# Getting Started with Spotify Plugins for Backstage

Transform your Backstage instance with premium plugins designed by the team that created Backstage. This guide will help you get started quickly and efficiently.

## Overview

Spotify Plugins for Backstage provide enterprise-grade features that extend the core Backstage platform with advanced capabilities for quality management, analytics, AI assistance, learning collaboration, and access control.

### What's Included

- **Soundcheck**: Tech health management and standards enforcement
- **Insights**: Usage analytics and adoption measurement
- **AiKA**: AI-powered knowledge assistant
- **Skill Exchange**: Internal learning marketplace
- **RBAC**: Role-based access control

## Prerequisites

### System Requirements

**Minimum Backstage Version**: v1.16.0 or higher
**Node.js Version**: 18.x or higher
**Yarn Version**: 1.22.x or higher

**Infrastructure Requirements**:
- PostgreSQL 12+ database
- Redis 6+ for caching
- Kubernetes cluster (for production deployments)
- Docker and Docker Compose for local development

### Licensing

To utilize Spotify Plugins for Backstage, you must first obtain a valid license key. Licenses are available through multiple channels:

#### Purchase Options

**Enterprise Sales**
- Contact our [sales team](https://backstage.spotify.com/contact-us/talk-to-us/) for enterprise licensing
- Custom pricing for large organizations
- Volume discounts available
- Dedicated account management and support

**AWS Marketplace**
- Purchase directly through [AWS Marketplace](https://aws.amazon.com/marketplace)
- Consolidated billing with your AWS account
- Simplified procurement for AWS customers
- Pay-as-you-go or annual licensing options

**Partner Channels**
- Authorized reseller network
- System integrator partnerships
- Consulting partner offerings

#### License Management

**License Key Activation**
```bash
# Set your license key as an environment variable
export SPOTIFY_PLUGINS_LICENSE_KEY="your-license-key-here"

# Or add to your app-config.yaml
spotify:
  plugins:
    licenseKey: ${SPOTIFY_PLUGINS_LICENSE_KEY}
```

**License Validation**
- Automatic license validation on startup
- Graceful degradation for license issues
- Clear error messages and resolution guidance
- License usage monitoring and reporting

## Installation Guide

### Quick Start (Development)

**1. Add Package Dependencies**
```bash
# Install core plugin packages
yarn add @spotify/backstage-plugin-soundcheck
yarn add @spotify/backstage-plugin-insights
yarn add @spotify/backstage-plugin-aika
yarn add @spotify/backstage-plugin-skill-exchange
yarn add @spotify/backstage-plugin-rbac

# Install backend packages
yarn add @spotify/backstage-plugin-soundcheck-backend
yarn add @spotify/backstage-plugin-insights-backend
yarn add @spotify/backstage-plugin-aika-backend
yarn add @spotify/backstage-plugin-skill-exchange-backend
yarn add @spotify/backstage-plugin-rbac-backend
```

**2. Configure Frontend Plugins**

Add to `packages/app/src/App.tsx`:
```typescript
import { SoundcheckPage } from '@spotify/backstage-plugin-soundcheck';
import { InsightsPage } from '@spotify/backstage-plugin-insights';
import { AiKAPage } from '@spotify/backstage-plugin-aika';
import { SkillExchangePage } from '@spotify/backstage-plugin-skill-exchange';
import { RBACPage } from '@spotify/backstage-plugin-rbac';

// Add routes
<Route path="/soundcheck" element={<SoundcheckPage />} />
<Route path="/insights" element={<InsightsPage />} />
<Route path="/aika" element={<AiKAPage />} />
<Route path="/skill-exchange" element={<SkillExchangePage />} />
<Route path="/rbac" element={<RBACPage />} />
```

**3. Configure Backend Services**

Add to `packages/backend/src/index.ts`:
```typescript
import soundcheck from '@spotify/backstage-plugin-soundcheck-backend';
import insights from '@spotify/backstage-plugin-insights-backend';
import aika from '@spotify/backstage-plugin-aika-backend';
import skillExchange from '@spotify/backstage-plugin-skill-exchange-backend';
import rbac from '@spotify/backstage-plugin-rbac-backend';

// Add backend services
backend.add(soundcheck);
backend.add(insights);
backend.add(aika);
backend.add(skillExchange);
backend.add(rbac);
```

**4. Update Configuration**

Add to your `app-config.yaml`:
```yaml
spotify:
  plugins:
    licenseKey: ${SPOTIFY_PLUGINS_LICENSE_KEY}
    
soundcheck:
  enabled: true
  tracks:
    - basic-health
    - security
    - reliability
    
insights:
  enabled: true
  dataRetention: 90d
  
aika:
  enabled: true
  modelProvider: openai
  
skillExchange:
  enabled: true
  enableCertifications: true
  
rbac:
  enabled: true
  defaultPolicy: read-only
```

### Production Installation

**1. Infrastructure Setup**

```bash
# Deploy PostgreSQL with plugins schema
kubectl apply -f k8s/postgres-deployment.yaml

# Deploy Redis cluster
kubectl apply -f k8s/redis-deployment.yaml

# Apply network policies
kubectl apply -f k8s/network-policies.yaml
```

**2. Secrets Management**
```bash
# Create license secret
kubectl create secret generic spotify-plugins-license \
  --from-literal=license-key='your-license-key'

# Create database credentials
kubectl create secret generic postgres-credentials \
  --from-literal=username='backstage' \
  --from-literal=password='secure-password'
```

**3. Application Deployment**
```bash
# Deploy Backstage with Spotify plugins
kubectl apply -f k8s/backstage-deployment.yaml

# Verify deployment
kubectl get pods -l app=backstage
kubectl logs -l app=backstage --tail=100
```

## Configuration Guide

### Environment Variables

**Required Variables**
```bash
# License configuration
SPOTIFY_PLUGINS_LICENSE_KEY="your-license-key"

# Database configuration
POSTGRES_HOST="your-db-host"
POSTGRES_PORT="5432"
POSTGRES_USER="backstage"
POSTGRES_PASSWORD="your-db-password"
POSTGRES_DATABASE="backstage"

# Redis configuration (optional but recommended)
REDIS_HOST="your-redis-host"
REDIS_PORT="6379"
```

**Optional Variables**
```bash
# Plugin-specific configuration
SOUNDCHECK_ENABLED="true"
INSIGHTS_ENABLED="true"
AIKA_ENABLED="true"
SKILL_EXCHANGE_ENABLED="true"
RBAC_ENABLED="true"

# Integration configuration
GITHUB_TOKEN="your-github-token"
SLACK_BOT_TOKEN="your-slack-token"
OPENAI_API_KEY="your-openai-key"
```

### Database Schema

**Automatic Schema Migration**
```bash
# Run database migrations
yarn backstage-cli backend:dev --config ../../app-config.yaml \
  --config ../../app-config.local.yaml
```

**Manual Schema Setup**
```sql
-- Create plugin-specific schemas
CREATE SCHEMA IF NOT EXISTS soundcheck;
CREATE SCHEMA IF NOT EXISTS insights;
CREATE SCHEMA IF NOT EXISTS aika;
CREATE SCHEMA IF NOT EXISTS skill_exchange;
CREATE SCHEMA IF NOT EXISTS rbac;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA soundcheck TO backstage;
GRANT ALL PRIVILEGES ON SCHEMA insights TO backstage;
GRANT ALL PRIVILEGES ON SCHEMA aika TO backstage;
GRANT ALL PRIVILEGES ON SCHEMA skill_exchange TO backstage;
GRANT ALL PRIVILEGES ON SCHEMA rbac TO backstage;
```

## Version Management

### Compatibility Matrix

| Spotify Plugins | Backstage Version | Node.js | PostgreSQL | Redis |
|-----------------|-------------------|---------|------------|-------|
| 3.x.x           | 1.26.x - 1.28.x  | 18.x+   | 12+        | 6+    |
| 2.x.x           | 1.20.x - 1.25.x  | 16.x+   | 11+        | 5+    |
| 1.x.x           | 1.16.x - 1.19.x  | 16.x+   | 11+        | 5+    |

### Upgrade Process

**1. Check Current Versions**
```bash
# Check Backstage version
yarn backstage-cli version

# Check plugin versions
yarn list --pattern "@spotify/backstage*"
```

**2. Update Dependencies**
```bash
# Update all Spotify plugins
yarn backstage-cli versions:bump --pattern "@spotify/backstage*"

# Update Backstage core (if needed)
yarn backstage-cli versions:bump
```

**3. Review Breaking Changes**
```bash
# Check release notes
curl -s https://api.github.com/repos/spotify/backstage-plugins/releases/latest

# Review migration guide
open https://backstage.spotify.com/docs/migrations/
```

**4. Test and Validate**
```bash
# Run tests
yarn test

# Start development server
yarn dev

# Validate plugin functionality
curl http://localhost:7007/api/soundcheck/health
```

### Automated Upgrades

**GitHub Actions Workflow**
```yaml
name: Update Spotify Plugins
on:
  schedule:
    - cron: '0 9 * * MON'  # Weekly on Mondays
  workflow_dispatch:

jobs:
  update-plugins:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
      - name: Update plugins
        run: |
          yarn backstage-cli versions:bump --pattern "@spotify/backstage*"
          yarn install
          yarn test
      - name: Create PR
        uses: peter-evans/create-pull-request@v5
        with:
          title: 'chore: update Spotify plugins'
          body: 'Automated update of Spotify plugins to latest versions'
```

## Verification & Testing

### Health Checks

**Plugin Health Endpoints**
```bash
# Check all plugin health
curl http://localhost:7007/api/health

# Individual plugin health
curl http://localhost:7007/api/soundcheck/health
curl http://localhost:7007/api/insights/health
curl http://localhost:7007/api/aika/health
curl http://localhost:7007/api/skill-exchange/health
curl http://localhost:7007/api/rbac/health
```

**License Validation**
```bash
# Validate license status
curl http://localhost:7007/api/spotify-plugins/license/status
```

### Functional Testing

**Automated Test Suite**
```bash
# Run plugin-specific tests
yarn test packages/app/src/plugins/spotify

# Integration tests
yarn test:integration

# E2E tests
yarn test:e2e
```

**Manual Verification Checklist**
- [ ] All plugins load without errors
- [ ] Navigation menu shows plugin routes
- [ ] Plugin pages render correctly
- [ ] API endpoints respond successfully
- [ ] Database connections are established
- [ ] License validation passes

## Getting Help

### Support Channels

**Documentation**
- [Complete Plugin Documentation](https://backstage.spotify.com/docs/plugins/)
- [API Reference](https://backstage.spotify.com/docs/api/)
- [Migration Guides](https://backstage.spotify.com/docs/migrations/)

**Community Support**
- [Discord Community](https://discord.gg/backstage)
- [GitHub Discussions](https://github.com/spotify/backstage-plugins/discussions)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/backstage)

**Enterprise Support**
- Priority support for licensed customers
- Dedicated support portal
- Technical account management
- Professional services available

### Troubleshooting

**Common Issues**
- [License activation problems](troubleshooting/license-issues.md)
- [Database connection errors](troubleshooting/database-issues.md)
- [Plugin loading failures](troubleshooting/plugin-issues.md)
- [Performance optimization](troubleshooting/performance.md)

**Debug Mode**
```bash
# Enable debug logging
export DEBUG="spotify:*"
yarn dev

# Check plugin logs
kubectl logs -l app=backstage | grep spotify
```

---

**Next Steps**: 
- Explore individual plugin documentation: [Soundcheck](soundcheck.md), [Insights](insights.md), [AiKA](aika.md), [Skill Exchange](skill-exchange.md), [RBAC](rbac.md)
- Review [advanced configuration options](advanced-configuration.md)
- Set up [monitoring and observability](monitoring.md)