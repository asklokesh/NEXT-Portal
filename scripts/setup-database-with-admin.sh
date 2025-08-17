#!/bin/bash

# Enterprise Database Setup Script with Admin User Creation
# This script sets up PostgreSQL, creates the database, and initializes admin credentials

set -e

echo "🚀 Setting up Enterprise Database with Admin User"
echo "=================================================="

# Check if running on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "📋 Detected macOS environment"
    
    # Check if Homebrew is installed
    if ! command -v brew &> /dev/null; then
        echo "❌ Homebrew not found. Please install Homebrew first:"
        echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        exit 1
    fi
    
    # Install PostgreSQL if not installed
    if ! command -v psql &> /dev/null; then
        echo "📦 Installing PostgreSQL via Homebrew..."
        brew install postgresql@15
        brew services start postgresql@15
        
        # Add to PATH
        export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
        
        echo "✅ PostgreSQL installed and started"
    else
        echo "✅ PostgreSQL already installed"
        
        # Make sure it's running
        brew services restart postgresql@15 2>/dev/null || brew services start postgresql@15
    fi
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "📋 Detected Linux environment"
    
    # Ubuntu/Debian
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y postgresql postgresql-contrib
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
    
    # RHEL/CentOS/Fedora
    elif command -v yum &> /dev/null; then
        sudo yum install -y postgresql-server postgresql-contrib
        sudo postgresql-setup initdb
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
    
    # Arch Linux
    elif command -v pacman &> /dev/null; then
        sudo pacman -S postgresql
        sudo -u postgres initdb -D /var/lib/postgres/data
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
    fi
    
else
    echo "❌ Unsupported operating system: $OSTYPE"
    echo "Please install PostgreSQL manually and run this script again"
    exit 1
fi

# Wait a moment for PostgreSQL to fully start
sleep 3

echo "🔧 Setting up database and user..."

# Database configuration
DB_NAME="idp_wrapper"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Create database if it doesn't exist
echo "📊 Creating database: $DB_NAME"

if [[ "$OSTYPE" == "darwin"* ]]; then
    # On macOS with Homebrew PostgreSQL
    createdb $DB_NAME 2>/dev/null || echo "Database $DB_NAME already exists"
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # On Linux
    sudo -u postgres createdb $DB_NAME 2>/dev/null || echo "Database $DB_NAME already exists"
    
    # Set password for postgres user
    sudo -u postgres psql -c "ALTER USER postgres PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
fi

# Test database connection
echo "🔍 Testing database connection..."

DB_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?schema=public"

if psql "$DB_URL" -c "SELECT 1;" &> /dev/null; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    echo "Please check your PostgreSQL installation"
    exit 1
fi

# Update .env file with correct database URL
echo "📝 Updating .env file..."

if [ -f ".env" ]; then
    # Backup original .env
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    
    # Update DATABASE_URL
    sed -i.tmp "s|DATABASE_URL=.*|DATABASE_URL=\"$DB_URL\"|g" .env
    rm .env.tmp 2>/dev/null || true
    
    echo "✅ .env file updated with database URL"
else
    echo "⚠️ .env file not found, creating one..."
    cat > .env << EOF
DATABASE_URL="$DB_URL"
USE_MOCK_DB="false"
USE_MOCK_DATA="false"

# Database connection pool settings (development)
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_ACQUIRE_TIMEOUT=15000
DB_IDLE_TIMEOUT=120000
DB_MAX_RETRIES=3
DB_RETRY_DELAY=1000
DB_HEALTH_CHECK_INTERVAL=30000
DB_SLOW_QUERY_THRESHOLD=2000
DB_ENABLE_LOGGING=true
DB_ENABLE_METRICS=true

# Authentication
NEXTAUTH_URL="http://localhost:4400"
NEXTAUTH_SECRET="development-secret-key-change-in-production"

# Admin credentials
ADMIN_EMAIL="admin@company.com"
ADMIN_PASSWORD="Admin123!"
ADMIN_NAME="System Administrator"

# Backup settings (development)
BACKUP_ENABLED=false
BACKUP_PROVIDER=local
BACKUP_PATH=./backups
BACKUP_ENCRYPTION=false
BACKUP_COMPRESSION=true
EOF
fi

echo "🗄️ Running database migrations..."

# Generate Prisma client
npm run db:generate

# Apply database schema
npm run db:push

echo "👤 Creating admin user..."

# Create admin user script
cat > scripts/create-admin-user.js << 'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@company.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
    const adminName = process.env.ADMIN_NAME || 'System Administrator';
    
    console.log('🔍 Checking for existing admin user...');
    
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists:', adminEmail);
      
      // Update password if it's different
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await prisma.user.update({
        where: { email: adminEmail },
        data: { password: passwordHash }
      });
      
      console.log('🔑 Admin password updated');
      return;
    }
    
    console.log('👤 Creating new admin user...');
    
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    
    const adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        password: passwordHash,
        provider: 'local',
        providerId: 'local_' + Date.now(),
        role: 'ADMIN',
        isActive: true,
        lastLogin: new Date()
      }
    });
    
    console.log('✅ Admin user created successfully!');
    console.log('📧 Email:', adminUser.email);
    console.log('🔑 Password:', adminPassword);
    console.log('👑 Role:', adminUser.role);
    console.log('');
    console.log('🌐 Login URL: http://localhost:4400/login');
    console.log('');
    
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
EOF

# Run the admin user creation script
node scripts/create-admin-user.js

echo ""
echo "🎉 Database setup completed successfully!"
echo "=================================================="
echo "📊 Database: $DB_NAME"
echo "🔗 URL: $DB_URL"
echo "👤 Admin Email: ${ADMIN_EMAIL:-admin@company.com}"
echo "🔑 Admin Password: ${ADMIN_PASSWORD:-Admin123!}"
echo "🌐 Login URL: http://localhost:4400/login"
echo ""
echo "🚀 You can now start the application with:"
echo "   npm run dev"
echo ""
echo "📋 To check database health:"
echo "   curl http://localhost:4400/api/health/database"
echo ""