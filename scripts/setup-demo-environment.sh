#!/bin/bash

# ===========================================
# PRODUCTION-READY DEMO ENVIRONMENT SETUP
# ===========================================
# Sets up complete demo environment for sales demos, POCs, and evaluations
# Competing with Spotify's Backstage Portal

set -e

echo "=========================================="
echo "🚀 NEXT Portal Demo Environment Setup"
echo "=========================================="
echo ""
echo "Setting up production-ready demo environment..."
echo "This will configure a complete TechCorp demo scenario"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[STATUS]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
print_status "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

print_success "Prerequisites check passed"

# Step 1: Stop any existing services
print_status "Stopping existing services..."
./scripts/stop-all.sh 2>/dev/null || true

# Step 2: Start infrastructure services
print_status "Starting infrastructure services (PostgreSQL, Redis)..."
docker-compose up -d db redis

# Wait for services to be healthy
print_status "Waiting for database to be ready..."
sleep 5

# Step 3: Initialize database with demo data
print_status "Initializing database with demo data..."
npx prisma migrate deploy 2>/dev/null || true
npx prisma db seed 2>/dev/null || true

# Step 4: Start mock Backstage server with enhanced demo data
print_status "Starting enhanced Backstage mock server..."
pkill -f "mock-backstage-server" 2>/dev/null || true
nohup node scripts/mock-backstage-server.js > logs/mock-backstage.log 2>&1 &
MOCK_PID=$!
echo $MOCK_PID > .mock-backstage.pid

sleep 3

# Step 5: Create demo environment configuration
print_status "Creating demo environment configuration..."
cat > .env.demo << 'EOF'
# Demo Environment Configuration
NODE_ENV=development
PORT=4400
NEXT_PUBLIC_API_URL=http://localhost:4400

# Demo Mode
DEMO_MODE=true
DEMO_COMPANY=TechCorp
DEMO_USER_COUNT=500
DEMO_PLUGIN_COUNT=50
DEMO_SERVICE_COUNT=75

# Backstage Integration
BACKSTAGE_API_URL=http://localhost:4402
BACKSTAGE_AUTH_ENABLED=false

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/saas_idp

# Redis
REDIS_URL=redis://localhost:6379

# Feature Flags - All enabled for demo
FEATURE_AI_RECOMMENDATIONS=true
FEATURE_COST_OPTIMIZATION=true
FEATURE_COMPLIANCE_MONITORING=true
FEATURE_PLUGIN_MARKETPLACE=true
FEATURE_ADVANCED_ANALYTICS=true
FEATURE_MULTI_ENVIRONMENT=true
FEATURE_WHITE_LABEL=true

# Demo Personas
DEMO_PERSONAS=developer,manager,executive,admin

# Mock Data Generation
GENERATE_MOCK_METRICS=true
GENERATE_MOCK_ALERTS=true
GENERATE_MOCK_COSTS=true
GENERATE_MOCK_COMPLIANCE=true

# Demo Scripts
ENABLE_GUIDED_TOUR=true
ENABLE_INTERACTIVE_DEMOS=true
ENABLE_ROI_CALCULATOR=true

# Sales Features
SHOW_COMPETITIVE_COMPARISON=true
SHOW_CUSTOMER_TESTIMONIALS=true
SHOW_CASE_STUDIES=true
EOF

# Step 6: Copy demo env to active env
cp .env.demo .env.local

print_success "Demo environment configuration created"

# Step 7: Start the Next.js application
print_status "Starting NEXT Portal application..."
if [ -f ".nextjs.pid" ]; then
    kill $(cat .nextjs.pid) 2>/dev/null || true
    rm .nextjs.pid
fi

nohup npm run dev > logs/nextjs-demo.log 2>&1 &
NEXTJS_PID=$!
echo $NEXTJS_PID > .nextjs.pid

# Step 8: Wait for application to be ready
print_status "Waiting for application to start..."
for i in {1..30}; do
    if curl -s http://localhost:4400/api/health > /dev/null 2>&1; then
        print_success "Application is ready!"
        break
    fi
    echo -n "."
    sleep 2
done
echo ""

# Step 9: Generate comprehensive demo data
print_status "Generating TechCorp demo data..."
node scripts/generate-demo-data.js

# Step 10: Verify all services
print_status "Verifying demo environment..."
echo ""
echo "Service Status:"
echo "==============="

# Check PostgreSQL
if docker ps | grep -q saas-idp-db-1; then
    echo "✅ PostgreSQL: Running"
else
    echo "❌ PostgreSQL: Not running"
fi

# Check Redis
if docker ps | grep -q saas-idp-redis-1; then
    echo "✅ Redis: Running"
else
    echo "❌ Redis: Not running"
fi

# Check Mock Backstage
if curl -s http://localhost:4402/api/catalog/entities > /dev/null 2>&1; then
    echo "✅ Mock Backstage: Running on port 4402"
else
    echo "❌ Mock Backstage: Not responding"
fi

# Check Next.js
if curl -s http://localhost:4400/api/health > /dev/null 2>&1; then
    echo "✅ NEXT Portal: Running on port 4400"
else
    echo "❌ NEXT Portal: Not responding"
fi

echo ""
echo "=========================================="
echo "🎉 Demo Environment Setup Complete!"
echo "=========================================="
echo ""
echo "Access Points:"
echo "• Main Portal: http://localhost:4400"
echo "• Mock Backstage API: http://localhost:4402"
echo "• Health Check: http://localhost:4400/api/health"
echo ""
echo "Demo Features Available:"
echo "• 50+ pre-configured plugins with various states"
echo "• TechCorp organization with multiple teams"
echo "• Cost optimization scenarios showing $2M+ savings"
echo "• Compliance violations and remediation examples"
echo "• AI-powered recommendations"
echo "• Real-time monitoring dashboards"
echo ""
echo "Demo Personas (auto-login):"
echo "• Developer: dev@techcorp.com"
echo "• Manager: manager@techcorp.com"
echo "• Executive: exec@techcorp.com"
echo "• Admin: admin@techcorp.com"
echo ""
echo "Quick Actions:"
echo "• Start guided tour: Click 'Start Tour' button on homepage"
echo "• View ROI calculator: Go to /demo/roi"
echo "• Reset demo data: ./scripts/reset-demo.sh"
echo "• Stop all services: ./scripts/stop-all.sh"
echo ""
echo "Sales Demo Scripts:"
echo "• 15-min Executive Overview: /demo/scripts/executive"
echo "• 45-min Technical Deep-dive: /demo/scripts/technical"
echo "• Feature Demos: /demo/scripts/features"
echo ""
print_success "Demo environment is ready for customer demonstrations!"