#!/bin/bash

# PM2 Startup Script for SaaS IDP Portal

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting SaaS IDP Portal with PM2...${NC}"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}PM2 is not installed. Installing...${NC}"
    npm install -g pm2
fi

# Stop any existing PM2 processes
echo -e "${YELLOW}Stopping existing PM2 processes...${NC}"
pm2 stop all 2>/dev/null || true
pm2 delete all 2>/dev/null || true

# Create logs directory if it doesn't exist
mkdir -p logs

# Start Docker services first
echo -e "${YELLOW}Starting Docker services...${NC}"
docker-compose up -d

# Wait for services to be ready
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
sleep 5

# Build the application
echo -e "${YELLOW}Building application...${NC}"
npm run build

# Start PM2 processes
echo -e "${GREEN}Starting PM2 processes...${NC}"
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Generate startup script (optional - requires sudo)
echo -e "${YELLOW}To enable auto-start on system boot, run:${NC}"
echo "pm2 startup"
echo "Then follow the instructions provided"

# Show status
echo -e "${GREEN}PM2 Status:${NC}"
pm2 status

# Monitor logs (optional)
echo -e "${YELLOW}To monitor logs in real-time, run:${NC}"
echo "pm2 logs"

echo -e "${GREEN}Portal is now running with PM2!${NC}"
echo -e "${GREEN}Access the portal at: http://localhost:3000${NC}"