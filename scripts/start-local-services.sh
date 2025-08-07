#!/bin/bash

# Start local services for development

echo "Starting local services..."

# Start PostgreSQL (using Homebrew or local installation)
if command -v postgres &> /dev/null; then
 echo "Starting PostgreSQL..."
 pg_ctl -D /usr/local/var/postgres start 2>/dev/null || \
 pg_ctl -D /opt/homebrew/var/postgres start 2>/dev/null || \
 pg_ctl -D /usr/local/var/postgresql@14 start 2>/dev/null || \
 echo "PostgreSQL might already be running or needs manual start"
else
 echo "PostgreSQL not found. Please install it first."
fi

# Start Redis (using Homebrew or local installation)
if command -v redis-server &> /dev/null; then
 echo "Starting Redis..."
 redis-server --daemonize yes --port 6379 --appendonly yes --dir /tmp
else
 echo "Redis not found. Please install it first."
fi

# Wait for services to start
sleep 2

# Check if services are running
echo ""
echo "Checking service status..."
if lsof -i :5432 &> /dev/null; then
 echo " PostgreSQL is running on port 5432"
else
 echo " PostgreSQL is not running"
fi

if lsof -i :6379 &> /dev/null; then
 echo " Redis is running on port 6379"
else
 echo " Redis is not running"
fi

# Create database if it doesn't exist
echo ""
echo "Setting up database..."
createdb backstage_idp 2>/dev/null || echo "Database might already exist"

# Run Prisma migrations
echo ""
echo "Running database migrations..."
cd /Users/lokesh/git/saas-idp
npm run db:migrate || npx prisma db push

echo ""
echo "Services setup complete!"