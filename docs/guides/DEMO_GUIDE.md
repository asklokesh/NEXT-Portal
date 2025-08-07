# 5-Minute Demo Guide

## Pre-Demo Checklist

```bash
# Ensure everything is running
docker-compose ps
# or
./scripts/status.sh
```

## Demo Flow (5 minutes)

### 1. Dashboard Overview (30 seconds)
- Show real-time metrics
- Point out service health indicators
- Highlight recent activity feed

### 2. Service Catalog (1 minute)
- Show existing services
- Demonstrate search and filtering
- Click into a service to show details
- Show service relationships

### 3. Plugin Marketplace (1 minute)
- Show 50+ available plugins
- Install a plugin live (e.g., GitHub Actions)
- Show instant configuration

### 4. Template Creation (1 minute)
- Create new service from template
- Show no-code form builder
- Deploy a sample microservice

### 5. AI Features (30 seconds)
- Semantic search: "Show me all Node.js services"
- Smart categorization in action
- Cost insights dashboard

### 6. Key Differentiators (1 minute)
- **No YAML editing** - Everything is visual
- **Real-time sync** - Live updates
- **Enterprise ready** - RBAC, SSO, Audit logs
- **Cloud agnostic** - Works with AWS, GCP, Azure

## Troubleshooting

If something isn't working:
```bash
# Quick restart
./scripts/restart-all.sh

# Check logs
docker-compose logs -f
```

## Post-Demo

- Share the QUICK_START.md for easy setup
- Mention full documentation in /docs
- Highlight extensibility and customization options