# NEXT Portal Documentation

This directory contains comprehensive documentation for the NEXT Portal Internal Developer Platform.

---

## Quick Links

- [Main README](../README.md) - Project overview and quick start
- [PRD](../PRD.md) - Product Requirements Document with moat and features

---

## Documentation Index

### Architecture

| Document | Description |
|----------|-------------|
| [Technical Architecture](TECHNICAL_ARCHITECTURE_DOCUMENTATION.md) | Complete system architecture and design |
| [Database Schema](DATABASE_SCHEMA_DOCUMENTATION.md) | Prisma schema and data models |
| [Backend Architecture Plan](BACKEND_ARCHITECTURE_PLAN.md) | Backend service design |
| [Architecture Summary](architecture/ARCHITECTURE_SUMMARY.md) | High-level architecture overview |

### API Reference

| Document | Description |
|----------|-------------|
| [API Reference](API_REFERENCE.md) | Complete REST/GraphQL API documentation |
| [API Documentation](API_DOCUMENTATION.md) | Detailed API specifications |
| [Marketplace API](api/MARKETPLACE_API.md) | Plugin marketplace API |
| [API Versioning](api-versioning/README.md) | API version management |

### Deployment and Operations

| Document | Description |
|----------|-------------|
| [Production Deployment Guide](PRODUCTION_DEPLOYMENT_GUIDE.md) | Production deployment procedures |
| [Production Setup](PRODUCTION_SETUP.md) | Environment configuration |
| [Operational Runbook](OPERATIONAL_RUNBOOK.md) | Day-to-day operations |
| [Maintenance Procedures](MAINTENANCE_PROCEDURES.md) | System maintenance |
| [Enterprise Operational Runbooks](ENTERPRISE_OPERATIONAL_RUNBOOKS.md) | Enterprise ops procedures |

### Security and Compliance

| Document | Description |
|----------|-------------|
| [Enterprise Security Audit](ENTERPRISE_SECURITY_AUDIT_REPORT.md) | Security assessment |
| [OAuth Setup Guide](OAUTH_SETUP_GUIDE.md) | OAuth provider configuration |
| [Security Compliance](architecture/SECURITY_COMPLIANCE.md) | Compliance frameworks |

### Plugin System

| Document | Description |
|----------|-------------|
| [Plugin Marketplace Architecture](PLUGIN_MARKETPLACE_ARCHITECTURE.md) | Marketplace design |
| [Plugin Management](PLUGIN_MANAGEMENT_IMPLEMENTATION.md) | Plugin lifecycle |
| [Enterprise Plugin Management](ENTERPRISE_PLUGIN_MANAGEMENT.md) | Enterprise features |
| [Plugin Quality Gates](PLUGIN_QUALITY_GATE_SYSTEM.md) | Quality assurance |
| [Plugin Observability](PLUGIN_OBSERVABILITY.md) | Monitoring plugins |

### Testing

| Document | Description |
|----------|-------------|
| [Comprehensive Testing Strategy](COMPREHENSIVE_TESTING_STRATEGY.md) | Test strategy |
| [Testing Framework Summary](TESTING_FRAMEWORK_SUMMARY.md) | Test infrastructure |
| [Code Review Guidelines](CODE_REVIEW_GUIDELINES.md) | Review standards |

### Performance and Monitoring

| Document | Description |
|----------|-------------|
| [Performance Optimization Guide](PERFORMANCE_OPTIMIZATION_GUIDE.md) | Performance tuning |
| [Monitoring Implementation](COMPREHENSIVE_MONITORING_IMPLEMENTATION.md) | Observability setup |
| [Production Monitoring](PRODUCTION_MONITORING_IMPLEMENTATION.md) | Production monitoring |

### Developer Experience

| Document | Description |
|----------|-------------|
| [Developer Onboarding](DEVELOPER_ONBOARDING.md) | Getting started guide |
| [Integration Guide](INTEGRATION_AND_OPERATIONS_GUIDE.md) | Integration patterns |
| [Real-time Integration](REALTIME_INTEGRATION_GUIDE.md) | WebSocket setup |

### Business and Strategy

| Document | Description |
|----------|-------------|
| [Market Analysis](MARKET_ANALYSIS_COMPETITIVE_INTELLIGENCE.md) | Competitive landscape |
| [GTM Strategy](GTM_STRATEGY_COMPREHENSIVE.md) | Go-to-market plan |
| [Executive Pitch Deck](EXECUTIVE_PITCH_DECK.md) | Investor/sales deck |
| [Innovation Roadmap](INNOVATION_ROADMAP.md) | Future vision |
| [Financial Models](FINANCIAL_MODELS_PROJECTIONS.md) | Revenue projections |
| [Sales Battlecards](SALES_BATTLECARDS_OBJECTION_GUIDE.md) | Competitive positioning |

### Enterprise Features

| Document | Description |
|----------|-------------|
| [Multi-Tenant Implementation](ENTERPRISE_MULTI_TENANT_IMPLEMENTATION.md) | Multi-tenancy |
| [Enterprise Authentication](ENTERPRISE_AUTHENTICATION_SUMMARY.md) | SSO/SAML setup |
| [SaaS Model](SAAS_MODEL_IMPLEMENTATION.md) | SaaS architecture |
| [Production Readiness](ENTERPRISE_PRODUCTION_READINESS_REPORT.md) | Enterprise checklist |

### Development History

| Document | Description |
|----------|-------------|
| [Changelog](CHANGELOG.md) | Version history |
| [Development Roadmap](DEVELOPMENT_ROADMAP.md) | Feature roadmap |
| [Implementation Status](IMPLEMENTATION_STATUS.md) | Current progress |

---

## Document Structure

```
docs/
+-- architecture/         # Architecture Decision Records (ADRs)
+-- architecture-v2/      # Next-gen architecture plans
+-- api/                  # API-specific documentation
+-- api-versioning/       # API version management
+-- guides/               # How-to guides
+-- *.md                  # Core documentation
```

---

## Contributing to Documentation

1. Use clear, concise language
2. Include code examples where relevant
3. Keep diagrams up-to-date
4. Follow Markdown best practices
5. Update this index when adding new documents

---

**Last Updated**: 2026-01-01
