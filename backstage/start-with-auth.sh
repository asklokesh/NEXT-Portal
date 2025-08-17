#!/bin/bash

# Backstage with GitHub Authentication Startup Script
set -e

echo "🚀 Starting Backstage with GitHub Authentication..."

# Check if required environment variables are set
check_env_var() {
    if [ -z "${!1}" ]; then
        echo "❌ Error: Environment variable $1 is not set"
        echo "Please check your .env file or set the variable manually"
        exit 1
    fi
}

echo "📋 Checking environment variables..."

# Check required GitHub OAuth variables
check_env_var AUTH_GITHUB_CLIENT_ID
check_env_var AUTH_GITHUB_CLIENT_SECRET

echo "✅ Environment variables are set"

# Set default values for optional variables
export POSTGRES_HOST=${POSTGRES_HOST:-localhost}
export POSTGRES_PORT=${POSTGRES_PORT:-5432}
export POSTGRES_USER=${POSTGRES_USER:-postgres}
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
export POSTGRES_DB=${POSTGRES_DB:-backstage_dev}

echo "🔧 Configuration:"
echo "  - GitHub OAuth Client ID: ${AUTH_GITHUB_CLIENT_ID:0:10}..."
echo "  - Database: ${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
echo "  - Backend URL: http://localhost:7007"
echo "  - Frontend URL: http://localhost:3000"

echo ""
echo "👥 Admin Users configured:"
echo "  - admin-user (update in authModuleGithubProvider.ts)"
echo "  - portal-admin (update in authModuleGithubProvider.ts)"
echo ""
echo "⚠️  IMPORTANT: Update the ADMIN_USERS array in packages/backend/src/authModuleGithubProvider.ts"
echo "   with your actual GitHub username to get admin access!"
echo ""

# Start the backend
echo "🚀 Starting Backstage backend on port 7007..."
cd packages/backend
yarn start &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 5

echo "✅ Backend started with PID $BACKEND_PID"
echo ""
echo "🌟 Backstage is ready!"
echo ""
echo "📖 Next steps:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Click 'Sign in with GitHub'"
echo "3. Authorize the application"
echo "4. You should be signed in as an admin user (if your GitHub username is in ADMIN_USERS)"
echo ""
echo "🔧 Troubleshooting:"
echo "- If auth fails, check your GitHub OAuth app settings"
echo "- Callback URL should be: http://localhost:7007/api/auth/github/handler/frame"
echo "- Make sure your GitHub username is in the ADMIN_USERS array"
echo ""
echo "Press Ctrl+C to stop the backend"

# Wait for the backend process
wait $BACKEND_PID