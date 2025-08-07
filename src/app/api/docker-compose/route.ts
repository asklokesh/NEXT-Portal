import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

interface DockerComposeRequest {
  installId: string;
  pluginId: string;
  environment?: 'development' | 'production';
  services?: string[];
}

// Generate docker-compose.yml for full Backstage stack
const createDockerCompose = (pluginId: string, installId: string, environment: string) => {
  const pluginName = pluginId.replace(/[@/]/g, '-').toLowerCase();
  const dbPassword = Buffer.from(Date.now().toString()).toString('base64').slice(0, 16);
  
  return `
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15
    restart: unless-stopped
    environment:
      POSTGRES_USER: backstage
      POSTGRES_PASSWORD: ${dbPassword}
      POSTGRES_DB: backstage_plugin_${pluginName}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql:ro
    ports:
      - "5432:5432"
    networks:
      - backstage-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U backstage"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backstage Backend
  backstage-backend:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    restart: unless-stopped
    environment:
      NODE_ENV: ${environment}
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: backstage
      POSTGRES_PASSWORD: ${dbPassword}
      BACKEND_SECRET: ${Buffer.from(pluginId + Date.now().toString()).toString('base64')}
      LOG_LEVEL: info
      PLUGIN_ID: ${pluginId}
      INSTALL_ID: ${installId}
    ports:
      - "7007:7007"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - backstage-network
    volumes:
      - ./app-config.yaml:/app/app-config.yaml:ro
      - ./app-config.production.yaml:/app/app-config.production.yaml:ro
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7007/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Backstage Frontend
  backstage-frontend:
    build:
      context: .
      dockerfile: packages/app/Dockerfile
      target: ${environment}
    restart: unless-stopped
    environment:
      NODE_ENV: ${environment}
      BACKEND_URL: http://backstage-backend:7007
    ports:
      - "3000:3000"
    depends_on:
      backstage-backend:
        condition: service_healthy
    networks:
      - backstage-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  # Redis Cache (for better performance)
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    networks:
      - backstage-network
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - backstage-frontend
      - backstage-backend
    networks:
      - backstage-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Plugin Health Monitor
  plugin-monitor:
    image: prom/prometheus:latest
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    networks:
      - backstage-network

  # Grafana Dashboard
  grafana:
    image: grafana/grafana:latest
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: backstage123
      GF_INSTALL_PLUGINS: grafana-clock-panel,grafana-simple-json-datasource
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
    networks:
      - backstage-network
    depends_on:
      - plugin-monitor

networks:
  backstage-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local
`;
};

// Generate nginx configuration
const createNginxConfig = () => {
  return `
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backstage-backend:7007;
    }
    
    upstream frontend {
        server backstage-frontend:3000;
    }

    server {
        listen 80;
        server_name localhost;

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\\n";
            add_header Content-Type text/plain;
        }

        # API routes to backend
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }

        # Static files and frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket support
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
`;
};

// Generate Prometheus configuration
const createPrometheusConfig = (pluginId: string) => {
  return `
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  # - "first_rules.yml"
  # - "second_rules.yml"

scrape_configs:
  - job_name: 'backstage-backend'
    static_configs:
      - targets: ['backstage-backend:7007']
    metrics_path: '/api/metrics'
    scrape_interval: 30s

  - job_name: 'backstage-frontend'
    static_configs:
      - targets: ['backstage-frontend:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
    scrape_interval: 30s

  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 30s

  - job_name: 'plugin-specific'
    static_configs:
      - targets: ['backstage-backend:7007']
    metrics_path: '/api/plugins/${pluginId}/metrics'
    scrape_interval: 10s
`;
};

// Generate database initialization script
const createInitDbScript = (pluginId: string) => {
  const pluginName = pluginId.replace(/[@/]/g, '_').toLowerCase();
  
  return `
-- Initialize database for Backstage plugin: ${pluginId}

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create plugin-specific schema
CREATE SCHEMA IF NOT EXISTS ${pluginName};

-- Create basic tables that most Backstage plugins need
CREATE TABLE IF NOT EXISTS ${pluginName}.entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id VARCHAR(255) NOT NULL,
    entity_ref VARCHAR(512) NOT NULL UNIQUE,
    kind VARCHAR(100) NOT NULL,
    namespace VARCHAR(100) DEFAULT 'default',
    name VARCHAR(255) NOT NULL,
    metadata JSONB NOT NULL,
    spec JSONB,
    status JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_${pluginName}_entities_kind ON ${pluginName}.entities(kind);
CREATE INDEX IF NOT EXISTS idx_${pluginName}_entities_namespace ON ${pluginName}.entities(namespace);
CREATE INDEX IF NOT EXISTS idx_${pluginName}_entities_name ON ${pluginName}.entities(name);

-- Create plugin configuration table
CREATE TABLE IF NOT EXISTS ${pluginName}.plugin_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default plugin configuration
INSERT INTO ${pluginName}.plugin_config (key, value) VALUES 
    ('plugin_id', '"${pluginId}"'),
    ('enabled', 'true'),
    ('install_date', '"' || NOW()::text || '"')
ON CONFLICT (key) DO NOTHING;

-- Create plugin metrics table
CREATE TABLE IF NOT EXISTS ${pluginName}.plugin_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value NUMERIC NOT NULL,
    labels JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_${pluginName}_metrics_name ON ${pluginName}.plugin_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_${pluginName}_metrics_timestamp ON ${pluginName}.plugin_metrics(timestamp);

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA ${pluginName} TO backstage;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${pluginName} TO backstage;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${pluginName} TO backstage;
`;
};

// Generate production app config
const createProductionAppConfig = (pluginId: string) => {
  return `
# Production configuration for Backstage with ${pluginId}

app:
  # Should be the same as backend.baseUrl when using the embedded proxy
  baseUrl: http://localhost

backend:
  baseUrl: http://localhost
  listen:
    port: 7007
    host: 0.0.0.0
  database:
    client: pg
    connection:
      host: \${POSTGRES_HOST}
      port: \${POSTGRES_PORT}
      user: \${POSTGRES_USER}
      password: \${POSTGRES_PASSWORD}
      database: backstage_plugin_${pluginId.replace(/[@/]/g, '_').toLowerCase()}
  cache:
    store: redis
    connection: redis://redis:6379

auth:
  providers:
    guest: {}

# Plugin-specific configuration
${pluginId.replace(/[@/]/g, '_')}:
  enabled: true
  environment: production
`;
};

export async function POST(request: NextRequest) {
  try {
    const { installId, pluginId, environment = 'development', services = [] }: DockerComposeRequest = await request.json();

    if (!installId || !pluginId) {
      return NextResponse.json({
        success: false,
        error: 'Install ID and plugin ID are required'
      }, { status: 400 });
    }

    const workDir = path.join(process.cwd(), 'plugin-runtime', installId);
    
    // Ensure directory exists
    await fs.mkdir(workDir, { recursive: true });

    // Generate all configuration files
    const files = [
      {
        path: 'docker-compose.yml',
        content: createDockerCompose(pluginId, installId, environment)
      },
      {
        path: 'nginx.conf',
        content: createNginxConfig()
      },
      {
        path: 'prometheus.yml',
        content: createPrometheusConfig(pluginId)
      },
      {
        path: 'init-db.sql',
        content: createInitDbScript(pluginId)
      },
      {
        path: 'app-config.production.yaml',
        content: createProductionAppConfig(pluginId)
      },
      {
        path: '.env',
        content: `
# Environment variables for Docker Compose
COMPOSE_PROJECT_NAME=backstage-plugin-${pluginId.replace(/[@/]/g, '-').toLowerCase()}
PLUGIN_ID=${pluginId}
INSTALL_ID=${installId}
ENVIRONMENT=${environment}
NODE_ENV=${environment}
`
      },
      {
        path: 'Makefile',
        content: `
# Backstage Plugin Development Environment
# Plugin: ${pluginId}

.PHONY: help build up down logs clean restart health

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \\033[36m%-15s\\033[0m %s\\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Build all services
	docker-compose build --no-cache

up: ## Start all services
	docker-compose up -d
	@echo "Backstage is starting up..."
	@echo "Frontend: http://localhost:3000"
	@echo "Backend: http://localhost:7007"
	@echo "Grafana: http://localhost:3001 (admin/backstage123)"
	@echo "Prometheus: http://localhost:9090"

down: ## Stop all services
	docker-compose down

logs: ## View logs from all services
	docker-compose logs -f

logs-backend: ## View backend logs
	docker-compose logs -f backstage-backend

logs-frontend: ## View frontend logs
	docker-compose logs -f backstage-frontend

clean: ## Clean up containers, networks, and volumes
	docker-compose down -v --remove-orphans
	docker system prune -f

restart: down up ## Restart all services

health: ## Check health of all services
	@echo "Checking service health..."
	@docker-compose ps
	@echo ""
	@echo "Backend health:"
	@curl -f http://localhost:7007/api/health || echo "Backend not healthy"
	@echo ""
	@echo "Frontend health:"
	@curl -f http://localhost:3000 || echo "Frontend not healthy"

dev: ## Start in development mode with hot reload
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

prod: ## Start in production mode
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
`
      }
    ];

    // Write all files
    for (const file of files) {
      await fs.writeFile(path.join(workDir, file.path), file.content);
    }

    return NextResponse.json({
      success: true,
      message: `Docker Compose stack generated for ${pluginId}`,
      files: files.map(f => f.path),
      services: [
        'postgres',
        'backstage-backend', 
        'backstage-frontend',
        'redis',
        'nginx',
        'plugin-monitor',
        'grafana'
      ],
      endpoints: {
        frontend: 'http://localhost:3000',
        backend: 'http://localhost:7007',
        grafana: 'http://localhost:3001',
        prometheus: 'http://localhost:9090'
      },
      commands: {
        start: 'make up',
        stop: 'make down',
        logs: 'make logs',
        health: 'make health'
      }
    });

  } catch (error) {
    console.error('Error generating Docker Compose stack:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate Docker Compose configuration'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const installId = searchParams.get('installId');

    if (!installId) {
      return NextResponse.json({
        success: false,
        error: 'Install ID is required'
      }, { status: 400 });
    }

    const workDir = path.join(process.cwd(), 'plugin-runtime', installId);
    
    try {
      const composeFile = await fs.readFile(path.join(workDir, 'docker-compose.yml'), 'utf8');
      return NextResponse.json({
        success: true,
        composeFile,
        workDir
      });
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Docker Compose file not found'
      }, { status: 404 });
    }

  } catch (error) {
    console.error('Error reading Docker Compose configuration:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to read Docker Compose configuration'
    }, { status: 500 });
  }
}