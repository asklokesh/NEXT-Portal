#!/bin/bash

# ===========================================
# PRODUCTION ENVIRONMENT SETUP
# ===========================================
# Interactive script to configure production environment

set -e

echo "🚀 Production Environment Setup for Internal Developer Platform"
echo "=============================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to prompt for input with default
prompt_input() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " input
        eval "$var_name=\${input:-$default}"
    else
        read -p "$prompt: " input
        eval "$var_name=\"$input\""
    fi
}

# Function to prompt for password/secret
prompt_secret() {
    local prompt="$1"
    local var_name="$2"
    
    read -s -p "$prompt: " secret
    echo
    eval "$var_name=\"$secret\""
}

# Function to validate email
validate_email() {
    local email="$1"
    if [[ "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Function to validate URL
validate_url() {
    local url="$1"
    if [[ "$url" =~ ^https?:// ]]; then
        return 0
    else
        return 1
    fi
}

echo -e "${BLUE}📋 This script will guide you through configuring your production environment.${NC}"
echo -e "${YELLOW}⚠️  Make sure you have all necessary credentials ready.${NC}"
echo

# Check if .env.production already exists
if [ -f ".env.production" ]; then
    echo -e "${YELLOW}📁 .env.production already exists.${NC}"
    read -p "Do you want to overwrite it? (y/N): " overwrite
    if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
        echo "Exiting without changes."
        exit 0
    fi
    cp .env.production .env.production.backup
    echo -e "${GREEN}✅ Created backup: .env.production.backup${NC}"
fi

echo -e "\n${BLUE}🔧 BASIC CONFIGURATION${NC}"
echo "======================"

# Database configuration
echo -e "\n${YELLOW}📊 Database Configuration${NC}"
prompt_input "PostgreSQL connection URL" "postgresql://user:password@localhost:5432/saas_idp_prod" DATABASE_URL

# Authentication
echo -e "\n${YELLOW}🔐 Authentication Configuration${NC}"
prompt_secret "NextAuth secret (32+ characters)" NEXTAUTH_SECRET
prompt_input "Application URL" "https://your-domain.com" NEXTAUTH_URL

# Basic settings
prompt_input "Application port" "4400" PORT
prompt_input "Node environment" "production" NODE_ENV

echo -e "\n${BLUE}☁️  CLOUD PROVIDER CONFIGURATION${NC}"
echo "=================================="

# AWS Configuration
echo -e "\n${YELLOW}☁️  AWS Configuration${NC}"
read -p "Configure AWS integration? (y/N): " configure_aws
if [[ "$configure_aws" =~ ^[Yy]$ ]]; then
    prompt_input "AWS Access Key ID" "" AWS_ACCESS_KEY_ID
    prompt_secret "AWS Secret Access Key" AWS_SECRET_ACCESS_KEY
    prompt_input "AWS Region" "us-east-1" AWS_REGION
    USE_AWS="true"
else
    USE_AWS="false"
fi

# GCP Configuration
echo -e "\n${YELLOW}☁️  Google Cloud Configuration${NC}"
read -p "Configure GCP integration? (y/N): " configure_gcp
if [[ "$configure_gcp" =~ ^[Yy]$ ]]; then
    prompt_input "GCP Project ID" "" GCP_PROJECT_ID
    prompt_input "GCP Service Account Key Path" "/path/to/service-account.json" GCP_SERVICE_ACCOUNT_KEY
    USE_GCP="true"
else
    USE_GCP="false"
fi

# Azure Configuration
echo -e "\n${YELLOW}☁️  Azure Configuration${NC}"
read -p "Configure Azure integration? (y/N): " configure_azure
if [[ "$configure_azure" =~ ^[Yy]$ ]]; then
    prompt_input "Azure Subscription ID" "" AZURE_SUBSCRIPTION_ID
    prompt_input "Azure Client ID" "" AZURE_CLIENT_ID
    prompt_secret "Azure Client Secret" AZURE_CLIENT_SECRET
    prompt_input "Azure Tenant ID" "" AZURE_TENANT_ID
    USE_AZURE="true"
else
    USE_AZURE="false"
fi

echo -e "\n${BLUE}📢 NOTIFICATION SERVICES${NC}"
echo "========================="

# Slack Configuration
echo -e "\n${YELLOW}💬 Slack Configuration${NC}"
read -p "Configure Slack notifications? (y/N): " configure_slack
if [[ "$configure_slack" =~ ^[Yy]$ ]]; then
    prompt_secret "Slack Bot Token (xoxb-...)" SLACK_BOT_TOKEN
    prompt_input "Slack Webhook URL" "" SLACK_WEBHOOK_URL
fi

# Email Configuration
echo -e "\n${YELLOW}📧 Email Configuration${NC}"
read -p "Configure email notifications? (y/N): " configure_email
if [[ "$configure_email" =~ ^[Yy]$ ]]; then
    prompt_input "SMTP Host" "smtp.gmail.com" SMTP_HOST
    prompt_input "SMTP Port" "587" SMTP_PORT
    prompt_input "SMTP User (email)" "" SMTP_USER
    
    # Validate email
    while ! validate_email "$SMTP_USER"; do
        echo -e "${RED}❌ Invalid email format${NC}"
        prompt_input "SMTP User (email)" "" SMTP_USER
    done
    
    prompt_secret "SMTP Password" SMTP_PASSWORD
fi

echo -e "\n${BLUE}🔧 INTEGRATION SERVICES${NC}"
echo "======================="

# Backstage Configuration
echo -e "\n${YELLOW}🎭 Backstage Configuration${NC}"
prompt_input "Backstage Backend URL" "http://localhost:7007" BACKSTAGE_BACKEND_URL
prompt_input "Backstage API Token (optional)" "" BACKSTAGE_API_TOKEN

# GitHub Integration
echo -e "\n${YELLOW}🐙 GitHub Integration${NC}"
read -p "Configure GitHub integration? (y/N): " configure_github
if [[ "$configure_github" =~ ^[Yy]$ ]]; then
    prompt_secret "GitHub Personal Access Token" GITHUB_TOKEN
fi

# Monitoring Configuration
echo -e "\n${YELLOW}📊 Monitoring Configuration${NC}"
read -p "Configure monitoring systems? (y/N): " configure_monitoring
if [[ "$configure_monitoring" =~ ^[Yy]$ ]]; then
    prompt_input "Prometheus URL" "http://prometheus:9090" PROMETHEUS_URL
    prompt_input "Grafana URL" "http://grafana:3000" GRAFANA_URL
    prompt_secret "Grafana API Key (optional)" GRAFANA_API_KEY
fi

echo -e "\n${BLUE}⚙️  ADVANCED CONFIGURATION${NC}"
echo "=========================="

# Feature Flags
echo -e "\n${YELLOW}🎛️  Feature Flags${NC}"
if [[ "$USE_AWS" == "true" ]] || [[ "$USE_GCP" == "true" ]] || [[ "$USE_AZURE" == "true" ]]; then
    USE_MOCK_CLOUD_DATA="false"
    echo "✅ Real cloud data enabled (cloud providers configured)"
else
    USE_MOCK_CLOUD_DATA="true"
    echo "⚠️  Mock cloud data enabled (no cloud providers configured)"
fi

read -p "Enable ML predictions? (y/N): " enable_ml
if [[ "$enable_ml" =~ ^[Yy]$ ]]; then
    ENABLE_ML_PREDICTIONS="true"
    prompt_input "ML Models Path" "/app/models" ML_MODELS_PATH
else
    ENABLE_ML_PREDICTIONS="false"
fi

# Security Configuration
echo -e "\n${YELLOW}🔒 Security Configuration${NC}"
prompt_secret "Encryption Key (32 characters)" ENCRYPTION_KEY
prompt_secret "JWT Secret" JWT_SECRET

# Performance Settings
echo -e "\n${YELLOW}⚡ Performance Settings${NC}"
prompt_input "Max Concurrent Jobs" "5" MAX_CONCURRENT_JOBS
prompt_input "Cache TTL (seconds)" "3600" CACHE_TTL_SECONDS

echo -e "\n${BLUE}📝 GENERATING CONFIGURATION${NC}"
echo "============================"

# Create .env.production file
cat > .env.production << EOF
# ===========================================
# PRODUCTION ENVIRONMENT CONFIGURATION
# ===========================================
# Generated on $(date)

# Basic Configuration
NODE_ENV=$NODE_ENV
PORT=$PORT

# Database
DATABASE_URL="$DATABASE_URL"
REDIS_URL="redis://localhost:6379"

# Authentication
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
NEXTAUTH_URL="$NEXTAUTH_URL"

EOF

# Add cloud provider configurations
if [[ "$USE_AWS" == "true" ]]; then
cat >> .env.production << EOF
# AWS Configuration
AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID"
AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
AWS_REGION="$AWS_REGION"

EOF
fi

if [[ "$USE_GCP" == "true" ]]; then
cat >> .env.production << EOF
# GCP Configuration
GCP_PROJECT_ID="$GCP_PROJECT_ID"
GCP_SERVICE_ACCOUNT_KEY="$GCP_SERVICE_ACCOUNT_KEY"

EOF
fi

if [[ "$USE_AZURE" == "true" ]]; then
cat >> .env.production << EOF
# Azure Configuration
AZURE_SUBSCRIPTION_ID="$AZURE_SUBSCRIPTION_ID"
AZURE_CLIENT_ID="$AZURE_CLIENT_ID"
AZURE_CLIENT_SECRET="$AZURE_CLIENT_SECRET"
AZURE_TENANT_ID="$AZURE_TENANT_ID"

EOF
fi

# Add notification configurations
if [[ "$configure_slack" =~ ^[Yy]$ ]]; then
cat >> .env.production << EOF
# Slack Configuration
SLACK_BOT_TOKEN="$SLACK_BOT_TOKEN"
SLACK_WEBHOOK_URL="$SLACK_WEBHOOK_URL"

EOF
fi

if [[ "$configure_email" =~ ^[Yy]$ ]]; then
cat >> .env.production << EOF
# Email Configuration
SMTP_HOST="$SMTP_HOST"
SMTP_PORT="$SMTP_PORT"
SMTP_USER="$SMTP_USER"
SMTP_PASSWORD="$SMTP_PASSWORD"

EOF
fi

# Add remaining configurations
cat >> .env.production << EOF
# Backstage Integration
BACKSTAGE_BACKEND_URL="$BACKSTAGE_BACKEND_URL"
BACKSTAGE_API_TOKEN="$BACKSTAGE_API_TOKEN"

EOF

if [[ "$configure_github" =~ ^[Yy]$ ]]; then
cat >> .env.production << EOF
# GitHub Integration
GITHUB_TOKEN="$GITHUB_TOKEN"

EOF
fi

if [[ "$configure_monitoring" =~ ^[Yy]$ ]]; then
cat >> .env.production << EOF
# Monitoring
PROMETHEUS_URL="$PROMETHEUS_URL"
GRAFANA_URL="$GRAFANA_URL"
GRAFANA_API_KEY="$GRAFANA_API_KEY"

EOF
fi

cat >> .env.production << EOF
# Storage Paths
ML_MODELS_PATH="${ML_MODELS_PATH:-/app/models}"
DATA_WAREHOUSE_PATH="/app/data"
UPLOADS_PATH="/app/uploads"
LOGS_PATH="/app/logs"

# Feature Flags
USE_MOCK_CLOUD_DATA="$USE_MOCK_CLOUD_DATA"
USE_MOCK_METRICS="false"
USE_MOCK_NOTIFICATIONS="false"
ENABLE_ML_PREDICTIONS="$ENABLE_ML_PREDICTIONS"

# Security
ENCRYPTION_KEY="$ENCRYPTION_KEY"
JWT_SECRET="$JWT_SECRET"

# Performance
MAX_CONCURRENT_JOBS="$MAX_CONCURRENT_JOBS"
CACHE_TTL_SECONDS="$CACHE_TTL_SECONDS"

# Compliance
GDPR_ENABLED="true"
DATA_RETENTION_DAYS="2555"
AUDIT_LOGGING="true"
EOF

echo -e "${GREEN}✅ Configuration file created: .env.production${NC}"

# Set appropriate permissions
chmod 600 .env.production
echo -e "${GREEN}✅ File permissions set to 600 (owner read/write only)${NC}"

echo -e "\n${BLUE}🔍 VALIDATING CONFIGURATION${NC}"
echo "============================"

# Run validation
node -e "
const fs = require('fs');
const path = require('path');

// Load the configuration
require('dotenv').config({ path: '.env.production' });

console.log('🔍 Validating environment configuration...');

// Check required variables
const required = ['DATABASE_URL', 'NEXTAUTH_SECRET'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
    console.log('❌ Missing required variables:', missing.join(', '));
    process.exit(1);
}

// Check URL formats
const urls = ['DATABASE_URL', 'NEXTAUTH_URL', 'BACKSTAGE_BACKEND_URL'];
urls.forEach(key => {
    const url = process.env[key];
    if (url && !url.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/)) {
        console.log(\`⚠️  Invalid URL format for \${key}: \${url}\`);
    }
});

// Check if at least one cloud provider or mock mode
const hasCloudProvider = process.env.AWS_ACCESS_KEY_ID || 
                        process.env.GCP_PROJECT_ID || 
                        process.env.AZURE_CLIENT_ID;

if (!hasCloudProvider && process.env.USE_MOCK_CLOUD_DATA !== 'true') {
    console.log('⚠️  No cloud provider configured, but mock data is disabled');
    console.log('   Consider setting USE_MOCK_CLOUD_DATA=true or configuring a cloud provider');
}

console.log('✅ Basic validation passed');
"

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}🎉 PRODUCTION ENVIRONMENT SETUP COMPLETE!${NC}"
    echo "=========================================="
    echo
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "1. Review the generated .env.production file"
    echo "2. Test the configuration: ./scripts/deploy-production.sh --dry-run"
    echo "3. Deploy to production: ./scripts/deploy-production.sh"
    echo
    echo -e "${YELLOW}📁 Files created:${NC}"
    echo "  • .env.production (production environment variables)"
    if [ -f ".env.production.backup" ]; then
        echo "  • .env.production.backup (backup of previous config)"
    fi
    echo
    echo -e "${YELLOW}🔒 Security Notes:${NC}"
    echo "  • .env.production has been set to 600 permissions"
    echo "  • Never commit this file to version control"
    echo "  • Store backups securely"
    echo
    echo -e "${BLUE}🚀 Ready to deploy!${NC}"
else
    echo -e "${RED}❌ Configuration validation failed${NC}"
    echo "Please review the errors above and run the script again."
    exit 1
fi