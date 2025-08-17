#!/bin/bash
# Minimal local startup using Docker Compose
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; }
sec()  { echo -e "\n${BLUE}=== $1 ===${NC}"; }

if [ ! -f "docker-compose.yml" ] || [ ! -f "Dockerfile" ]; then
  err "Run from repository root (docker-compose.yml not found)."; exit 1
fi

if ! command -v docker &>/dev/null; then err "Docker is required"; exit 1; fi
if ! command -v docker compose &>/dev/null && ! command -v docker-compose &>/dev/null; then err "Docker Compose is required"; exit 1; fi

sec "Environment"
# Create .env from example if available and missing
if [ ! -f ".env" ]; then
  if [ -f "env.local.example" ]; then
    cp env.local.example .env
    info "Created .env from env.local.example"
  else
    warn "No env.local.example found. Ensure required env vars are provided."
  fi
fi

sec "Starting dependencies (db, redis)"
docker compose up -d db redis

# Wait for services
sleep 3
info "Waiting for PostgreSQL to be healthy..."
for i in {1..30}; do
  if docker compose ps --format json | grep -q '"db"'; then
    break
  fi
  sleep 1
done

sec "Database migrations"
# Run prisma migrations inside app image without starting full stack
docker compose run --rm idp-platform npx prisma migrate deploy || warn "Migrate deploy failed; continuing"
docker compose run --rm idp-platform npx prisma generate || true

sec "Starting application"
docker compose up -d idp-platform

info "Waiting for app health..."
for i in {1..30}; do
  if curl -fsS http://localhost:4400/api/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo -e "\n${GREEN}SaaS IDP is up!${NC}"
echo "- App: http://localhost:4400"
echo "- DB:  postgresql://postgres:postgres@localhost:5432/idp_wrapper"
echo "- Redis: redis://localhost:6379"

echo -e "\nTo stop: docker compose down"