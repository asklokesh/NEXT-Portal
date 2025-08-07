# Portal Management Scripts

This directory contains scripts to manage the entire Backstage IDP Portal ecosystem.

## Quick Start

```bash
# Start all services
./scripts/start-all.sh

# Stop all services
./scripts/stop-all.sh

# Restart all services
./scripts/restart-all.sh

# Check status of all services
./scripts/status.sh
```

## Using npm scripts

You can also use npm scripts from the project root:

```bash
# Start all services
npm run start:all

# Stop all services
npm run stop:all

# Restart all services
npm run restart:all

# Check status
npm run status
```

## What Gets Started

The `start-all.sh` script starts the following services in order:

1. **PostgreSQL** (via Docker) - Database on port 5432
2. **Redis** (via Docker) - Cache on port 6379
3. **Backstage Backend** - API server on port 4410
 - If no Backstage installation is found, starts a mock server
4. **Next.js Frontend** - UI on port 4400

## Services and Ports

| Service | Port | URL |
|---------|------|-----|
| PostgreSQL | 5432 | postgresql://localhost:5432/backstage |
| Redis | 6379 | redis://localhost:6379 |
| Backstage Backend | 4410 | http://localhost:4410 |
| Next.js Frontend | 4400 | http://localhost:4400 |

## Logs

Service logs are stored in the `logs/` directory:
- `backstage.log` - Backstage backend logs
- `nextjs.log` - Next.js frontend logs
- `mock-backstage.log` - Mock Backstage server logs (if used)

View logs in real-time:
```bash
# All logs
tail -f logs/*.log

# Specific service
tail -f logs/nextjs.log
```

## Environment Setup

The scripts will:
1. Create `.env.local` from `.env.example` if it doesn't exist
2. Install npm dependencies if `node_modules` doesn't exist
3. Run database migrations if Prisma is configured
4. Create the logs directory

## Troubleshooting

### Port Already in Use
If you see "address already in use" errors:
```bash
# Stop all services first
./scripts/stop-all.sh

# Or manually kill processes on specific ports
lsof -ti:4400 | xargs kill -9 # Kill Next.js
lsof -ti:4410 | xargs kill -9 # Kill Backstage
```

### Docker Not Running
Make sure Docker Desktop is running before starting services.

### Permission Denied
Make scripts executable:
```bash
chmod +x scripts/*.sh
```

### Services Not Starting
Check the status and logs:
```bash
./scripts/status.sh
tail -f logs/*.log
```

## Mock Backstage Server

If you don't have a real Backstage installation, the scripts will automatically start a mock server that provides:
- Basic catalog API endpoints
- Template/scaffolder endpoints
- Health checks
- Plugin discovery

The mock server is sufficient for development and testing the UI wrapper features.