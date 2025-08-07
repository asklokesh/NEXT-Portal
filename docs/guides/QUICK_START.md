# Quick Start Guide - Backstage Enterprise Portal

## 1. One Command Start (Docker)

```bash
# Clone and start everything
git clone <repo-url> && cd saas-idp
docker-compose up -d
```

Portal will be available at: **http://localhost:4400**

## 2. One Command Start (Local)

```bash
# Start all services with one script
./scripts/start-all.sh
```

## 3. What's Running

- **Portal**: http://localhost:4400
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 4. Default Credentials

- **Admin User**: admin@example.com / admin123
- **Demo Mode**: Enabled (no auth required)

## 5. Key Features to Demo

1. **Dashboard** - Real-time metrics and insights
2. **Service Catalog** - All your services in one place
3. **Plugin Marketplace** - 50+ ready-to-use plugins
4. **Templates** - Create new services instantly
5. **Cost Tracking** - Cloud cost analytics

## Mobile Responsive

The portal works perfectly on tablets and mobile devices for on-the-go access.

## Stop Everything

```bash
./scripts/stop-all.sh
```

## Full Documentation

See the `/docs` folder for detailed guides.