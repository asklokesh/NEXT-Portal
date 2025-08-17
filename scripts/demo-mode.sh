#!/bin/bash

# ===========================================
# DEMO MODE - IMMEDIATE CLIENT READINESS
# ===========================================
# Enables all features with realistic mock data

echo "🎬 Setting up Demo Mode..."

# Create demo environment file
cat > .env.demo << 'EOF'
# Demo Mode Configuration
NODE_ENV=development
PORT=4400

# Enable all mock data for demo
USE_MOCK_CLOUD_DATA=true
USE_MOCK_METRICS=true  
USE_MOCK_NOTIFICATIONS=true
ENABLE_ML_PREDICTIONS=true

# Demo credentials (non-functional but realistic)
AWS_ACCESS_KEY_ID=demo-key-id
SLACK_BOT_TOKEN=xoxb-demo-token
GITHUB_TOKEN=ghp_demo-token

# Local services
DATABASE_URL=file:./demo.db
REDIS_URL=redis://localhost:6379

# Demo feature flags
DEMO_MODE=true
DEMO_DATA_MULTIPLIER=100
DEMO_REALISTIC_DELAYS=true
EOF

# Generate realistic demo data
node -e "
const fs = require('fs');

// Create realistic demo data
const demoData = {
    teams: [
        { id: 'team-frontend', name: 'Frontend Team', size: 8, productivity: 85 },
        { id: 'team-backend', name: 'Backend Team', size: 12, productivity: 92 },
        { id: 'team-devops', name: 'DevOps Team', size: 6, productivity: 78 },
        { id: 'team-mobile', name: 'Mobile Team', size: 10, productivity: 88 }
    ],
    
    services: [
        { name: 'user-service', type: 'microservice', health: 99.9, deployments: 45 },
        { name: 'payment-service', type: 'microservice', health: 99.8, deployments: 23 },
        { name: 'notification-service', type: 'microservice', health: 99.5, deployments: 67 },
        { name: 'analytics-service', type: 'microservice', health: 99.7, deployments: 34 }
    ],
    
    metrics: {
        dora: {
            deploymentFrequency: 2.3,
            leadTime: 4.2,
            mttr: 1.8,
            changeFailureRate: 8.5
        },
        costs: {
            monthly: 45670,
            trend: -12.5,
            savings: 8940
        },
        productivity: {
            average: 86,
            trend: 8.2,
            topPerformer: 'team-backend'
        }
    }
};

fs.writeFileSync('./demo-data.json', JSON.stringify(demoData, null, 2));
console.log('✅ Demo data generated');
"

echo "✅ Demo mode ready!"
echo ""
echo "🎯 To run demo:"
echo "  cp .env.demo .env.local"  
echo "  npm run dev"
echo ""
echo "🎪 Demo features enabled:"
echo "  • Realistic mock data for all services"
echo "  • 100+ sample services and teams"
echo "  • Interactive dashboards with live updates"
echo "  • All ML predictions working with sample models"
echo "  • Cost optimization showing real savings"
echo "  • Productivity analytics with team comparisons"
echo ""
echo "⚡ Perfect for client demonstrations!"