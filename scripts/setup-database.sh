#!/bin/bash

# Setup script for Backstage IDP Database
set -e

echo " Setting up Backstage IDP Database..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
 echo -e "${RED} Docker is not running. Please start Docker first.${NC}"
 exit 1
fi

# Start required services
echo -e "${YELLOW} Starting PostgreSQL and Redis containers...${NC}"
docker-compose -f config/docker/docker-compose.dev.yml up -d postgres redis

# Wait for PostgreSQL to be ready
echo -e "${YELLOW} Waiting for PostgreSQL to be ready...${NC}"
for i in {1..30}; do
 if docker-compose -f config/docker/docker-compose.dev.yml exec -T postgres pg_isready -U backstage_user -d backstage_idp > /dev/null 2>&1; then
 echo -e "${GREEN} PostgreSQL is ready!${NC}"
 break
 fi
 
 if [ $i -eq 30 ]; then
 echo -e "${RED} PostgreSQL failed to start within 30 seconds${NC}"
 exit 1
 fi
 
 sleep 1
done

# Wait for Redis to be ready
echo -e "${YELLOW} Waiting for Redis to be ready...${NC}"
for i in {1..15}; do
 if docker-compose -f config/docker/docker-compose.dev.yml exec -T redis redis-cli ping > /dev/null 2>&1; then
 echo -e "${GREEN} Redis is ready!${NC}"
 break
 fi
 
 if [ $i -eq 15 ]; then
 echo -e "${RED} Redis failed to start within 15 seconds${NC}"
 exit 1
 fi
 
 sleep 1
done

# Generate Prisma client
echo -e "${YELLOW} Generating Prisma client...${NC}"
npx prisma generate

# Run database migrations
echo -e "${YELLOW} Running database migrations...${NC}"
npx prisma db push --accept-data-loss

# Check if we should seed the database
if [[ "$1" == "--seed" ]]; then
 echo -e "${YELLOW} Seeding database with sample data...${NC}"
 npm run db:seed
fi

# Verify database connection
echo -e "${YELLOW} Verifying database connection...${NC}"
if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
 echo -e "${GREEN} Database connection verified!${NC}"
else
 echo -e "${RED} Database connection failed${NC}"
 exit 1
fi

echo -e "${GREEN} Database setup completed successfully!${NC}"
echo ""
echo " Services running:"
echo " - PostgreSQL: localhost:5432"
echo " - Redis: localhost:6379"
echo ""
echo " Management commands:"
echo " - View logs: docker-compose -f config/docker/docker-compose.dev.yml logs -f"
echo " - Stop services: docker-compose -f config/docker/docker-compose.dev.yml down"
echo " - Reset database: npm run db:reset"
echo " - View data: npm run db:studio"
echo ""
echo -e "${GREEN}Ready to start development! ${NC}"