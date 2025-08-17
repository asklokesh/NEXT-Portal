# Enterprise IDP Platform - Integration and Operations Guide

## Table of Contents

1. [Backstage.io Integration](#backstageio-integration)
2. [OAuth Provider Setup](#oauth-provider-setup)
3. [Monitoring System Integration](#monitoring-system-integration)
4. [CI/CD Pipeline Integration](#cicd-pipeline-integration)
5. [Cloud Provider Deployment](#cloud-provider-deployment)
6. [Operations Manual](#operations-manual)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Performance Tuning](#performance-tuning)

---

## Backstage.io Integration

### Overview

The platform provides seamless bidirectional integration with Backstage.io, extending its capabilities while maintaining compatibility.

### Integration Architecture

```yaml
Integration Points:
  - Shared Authentication
  - Catalog Synchronization
  - Plugin Registry
  - Template Scaffolder
  - TechDocs Integration
  - API Proxy
```

### Setup Instructions

#### 1. Configure Backstage Backend

```yaml
# backstage/app-config.yaml
app:
  title: Enterprise IDP Platform
  baseUrl: http://localhost:3000

backend:
  baseUrl: http://localhost:7007
  cors:
    origin: http://localhost:3000
    methods: [GET, POST, PUT, DELETE, OPTIONS]
    credentials: true

integrations:
  github:
    - host: github.com
      token: ${GITHUB_TOKEN}

catalog:
  import:
    entityFilename: catalog-info.yaml
  rules:
    - allow: [Component, System, API, Resource, Location]
  locations:
    - type: url
      target: https://github.com/company/*/blob/main/catalog-info.yaml

auth:
  environment: development
  providers:
    github:
      development:
        clientId: ${GITHUB_CLIENT_ID}
        clientSecret: ${GITHUB_CLIENT_SECRET}
    google:
      development:
        clientId: ${GOOGLE_CLIENT_ID}
        clientSecret: ${GOOGLE_CLIENT_SECRET}

# IDP Platform Integration
idp:
  enabled: true
  apiUrl: http://localhost:3000/api
  apiKey: ${IDP_API_KEY}
  syncInterval: 300 # seconds
  features:
    catalogSync: true
    pluginRegistry: true
    enhancedSearch: true
    aiRecommendations: true
```

#### 2. Install Integration Package

```bash
# In backstage directory
yarn add @idp-platform/backstage-integration

# Update packages/backend/src/index.ts
import { createIdpIntegration } from '@idp-platform/backstage-integration';

const idpIntegration = createIdpIntegration({
  apiUrl: process.env.IDP_API_URL,
  apiKey: process.env.IDP_API_KEY,
});

backend.add(idpIntegration);
```

#### 3. Configure Catalog Sync

```typescript
// backstage/packages/backend/src/plugins/catalog.ts
import { CatalogBuilder } from '@backstage/plugin-catalog-backend';
import { IdpCatalogProcessor } from '@idp-platform/catalog-processor';

export default async function createPlugin(env: PluginEnvironment) {
  const builder = await CatalogBuilder.create(env);
  
  // Add IDP catalog processor
  builder.addProcessor(new IdpCatalogProcessor({
    apiUrl: env.config.getString('idp.apiUrl'),
    apiKey: env.config.getString('idp.apiKey'),
  }));
  
  // Enable bidirectional sync
  builder.addEntityProvider(
    IdpEntityProvider.fromConfig(env.config, {
      logger: env.logger,
      schedule: {
        frequency: { minutes: 5 },
        timeout: { minutes: 15 },
      },
    }),
  );
  
  const { processingEngine, router } = await builder.build();
  await processingEngine.start();
  return router;
}
```

#### 4. Setup Plugin Registry Integration

```typescript
// src/lib/backstage/plugin-registry-sync.ts
import { BackstagePluginRegistry } from '@backstage/plugin-catalog';
import { IdpPluginRegistry } from '@idp-platform/plugin-registry';

export class PluginRegistrySync {
  private backstageRegistry: BackstagePluginRegistry;
  private idpRegistry: IdpPluginRegistry;
  
  async syncPlugins() {
    // Fetch plugins from Backstage
    const backstagePlugins = await this.backstageRegistry.list();
    
    // Fetch plugins from IDP platform
    const idpPlugins = await this.idpRegistry.list();
    
    // Merge and reconcile plugins
    const mergedPlugins = this.reconcilePlugins(backstagePlugins, idpPlugins);
    
    // Update both registries
    await this.updateRegistries(mergedPlugins);
  }
  
  private reconcilePlugins(backstage: Plugin[], idp: Plugin[]) {
    // Implement conflict resolution logic
    // Priority: IDP platform > Backstage
    const pluginMap = new Map();
    
    backstage.forEach(plugin => {
      pluginMap.set(plugin.id, plugin);
    });
    
    idp.forEach(plugin => {
      const existing = pluginMap.get(plugin.id);
      if (!existing || plugin.version > existing.version) {
        pluginMap.set(plugin.id, plugin);
      }
    });
    
    return Array.from(pluginMap.values());
  }
}
```

### Advanced Integration Features

#### 1. Shared Authentication

```typescript
// Shared session management
export class SharedAuthProvider {
  async validateBackstageToken(token: string): Promise<User> {
    const response = await fetch(`${BACKSTAGE_URL}/api/auth/validate`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Invalid Backstage token');
    }
    
    return response.json();
  }
  
  async exchangeTokens(backstageToken: string): Promise<IdpToken> {
    // Exchange Backstage token for IDP platform token
    const response = await fetch('/api/auth/exchange', {
      method: 'POST',
      body: JSON.stringify({ backstageToken }),
    });
    
    return response.json();
  }
}
```

#### 2. Entity Metadata Enrichment

```yaml
# Enhanced entity with IDP metadata
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: user-service
  annotations:
    idp-platform/service-id: svc_123
    idp-platform/health-check: https://api.example.com/health
    idp-platform/cost-center: engineering
    idp-platform/compliance: soc2,gdpr
spec:
  type: service
  lifecycle: production
  owner: platform-team
```

---

## OAuth Provider Setup

### GitHub OAuth Configuration

#### 1. Create GitHub OAuth App

```bash
# Navigate to GitHub Settings > Developer settings > OAuth Apps
# Create new OAuth App with:

Application name: IDP Platform
Homepage URL: https://platform.company.com
Authorization callback URL: https://platform.company.com/api/auth/github/callback
```

#### 2. Configure GitHub Integration

```typescript
// src/lib/auth/github-provider.ts
import { Octokit } from '@octokit/rest';
import { createOAuthAppAuth } from '@octokit/auth-oauth-app';

export class GitHubAuthProvider {
  private octokit: Octokit;
  
  constructor() {
    this.octokit = new Octokit({
      authStrategy: createOAuthAppAuth,
      auth: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      },
    });
  }
  
  async authenticate(code: string) {
    const { data } = await this.octokit.request('POST /login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    });
    
    const { access_token } = data;
    
    // Get user info
    const userOctokit = new Octokit({ auth: access_token });
    const { data: user } = await userOctokit.users.getAuthenticated();
    const { data: emails } = await userOctokit.users.listEmailsForAuthenticated();
    
    return {
      provider: 'github',
      providerId: user.id.toString(),
      email: emails.find(e => e.primary)?.email,
      name: user.name,
      username: user.login,
      avatar: user.avatar_url,
      accessToken: access_token,
    };
  }
}
```

### Google OAuth Configuration

#### 1. Setup Google Cloud Console

```bash
# 1. Go to Google Cloud Console
# 2. Create or select a project
# 3. Enable Google+ API
# 4. Create OAuth 2.0 credentials

Authorized JavaScript origins:
- https://platform.company.com
- http://localhost:3000 (for development)

Authorized redirect URIs:
- https://platform.company.com/api/auth/google/callback
- http://localhost:3000/api/auth/google/callback
```

#### 2. Implement Google OAuth

```typescript
// src/lib/auth/google-provider.ts
import { OAuth2Client } from 'google-auth-library';

export class GoogleAuthProvider {
  private client: OAuth2Client;
  
  constructor() {
    this.client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.APP_URL}/api/auth/google/callback`
    );
  }
  
  getAuthUrl(): string {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      prompt: 'consent',
    });
  }
  
  async authenticate(code: string) {
    const { tokens } = await this.client.getToken(code);
    this.client.setCredentials(tokens);
    
    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });
    
    const payload = ticket.getPayload();
    
    return {
      provider: 'google',
      providerId: payload!.sub,
      email: payload!.email,
      name: payload!.name,
      avatar: payload!.picture,
      accessToken: tokens.access_token,
    };
  }
}
```

### SAML/SSO Enterprise Setup

#### 1. Configure SAML Provider

```typescript
// src/lib/auth/saml-provider.ts
import * as saml2 from 'saml2-js';

export class SAMLAuthProvider {
  private serviceProvider: saml2.ServiceProvider;
  private identityProvider: saml2.IdentityProvider;
  
  constructor() {
    this.serviceProvider = new saml2.ServiceProvider({
      entity_id: 'https://platform.company.com',
      private_key: process.env.SAML_PRIVATE_KEY!,
      certificate: process.env.SAML_CERTIFICATE!,
      assert_endpoint: 'https://platform.company.com/api/auth/saml/assert',
    });
    
    this.identityProvider = new saml2.IdentityProvider({
      sso_login_url: process.env.SAML_SSO_URL!,
      sso_logout_url: process.env.SAML_LOGOUT_URL!,
      certificates: [process.env.SAML_IDP_CERT!],
    });
  }
  
  createLoginRequest() {
    return new Promise((resolve, reject) => {
      this.serviceProvider.create_login_request_url(
        this.identityProvider,
        {},
        (err, login_url) => {
          if (err) reject(err);
          else resolve(login_url);
        }
      );
    });
  }
  
  async validateResponse(samlResponse: string) {
    return new Promise((resolve, reject) => {
      this.serviceProvider.post_assert(
        this.identityProvider,
        { request_body: { SAMLResponse: samlResponse } },
        (err, saml_response) => {
          if (err) reject(err);
          else resolve({
            provider: 'saml',
            providerId: saml_response.user.name_id,
            email: saml_response.user.attributes.email,
            name: saml_response.user.attributes.name,
            groups: saml_response.user.attributes.groups,
          });
        }
      );
    });
  }
}
```

---

## Monitoring System Integration

### Prometheus Integration

#### 1. Configure Prometheus Scraping

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'idp-platform'
    static_configs:
      - targets: ['platform:3000']
    metrics_path: '/metrics'
    
  - job_name: 'idp-backstage'
    static_configs:
      - targets: ['backstage:7007']
    metrics_path: '/metrics'
    
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
      
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']

rule_files:
  - '/etc/prometheus/rules/*.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

#### 2. Custom Metrics Implementation

```typescript
// src/lib/monitoring/metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Plugin metrics
export const pluginInstallCounter = new Counter({
  name: 'idp_plugin_installs_total',
  help: 'Total number of plugin installations',
  labelNames: ['plugin', 'version', 'status'],
});

export const pluginHealthGauge = new Gauge({
  name: 'idp_plugin_health_status',
  help: 'Plugin health status (1=healthy, 0=unhealthy)',
  labelNames: ['plugin', 'environment'],
});

// API metrics
export const apiRequestDuration = new Histogram({
  name: 'idp_api_request_duration_seconds',
  help: 'API request duration in seconds',
  labelNames: ['method', 'endpoint', 'status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

// Catalog metrics
export const catalogEntityGauge = new Gauge({
  name: 'idp_catalog_entities_total',
  help: 'Total number of catalog entities',
  labelNames: ['kind', 'type', 'lifecycle'],
});

// Export metrics endpoint
export function getMetrics() {
  return register.metrics();
}
```

### Grafana Dashboard Configuration

#### 1. Import Dashboard JSON

```json
{
  "dashboard": {
    "title": "IDP Platform Overview",
    "panels": [
      {
        "title": "API Request Rate",
        "targets": [
          {
            "expr": "rate(idp_api_request_duration_seconds_count[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Plugin Health Status",
        "targets": [
          {
            "expr": "idp_plugin_health_status",
            "legendFormat": "{{plugin}} ({{environment}})"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Catalog Entities",
        "targets": [
          {
            "expr": "sum(idp_catalog_entities_total) by (kind)",
            "legendFormat": "{{kind}}"
          }
        ],
        "type": "piechart"
      },
      {
        "title": "API Latency (P95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(idp_api_request_duration_seconds_bucket[5m]))",
            "legendFormat": "P95 Latency"
          }
        ],
        "type": "gauge"
      }
    ]
  }
}
```

### ELK Stack Integration

#### 1. Logstash Configuration

```ruby
# logstash.conf
input {
  beats {
    port => 5044
  }
  
  tcp {
    port => 5000
    codec => json
  }
}

filter {
  if [app] == "idp-platform" {
    json {
      source => "message"
    }
    
    date {
      match => [ "timestamp", "ISO8601" ]
    }
    
    if [level] == "error" {
      mutate {
        add_tag => [ "error", "alert" ]
      }
    }
  }
  
  # Parse API access logs
  if [type] == "access_log" {
    grok {
      match => { 
        "message" => "%{COMBINEDAPACHELOG}" 
      }
    }
    
    geoip {
      source => "clientip"
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "idp-platform-%{+YYYY.MM.dd}"
  }
  
  if "alert" in [tags] {
    email {
      to => "platform-team@company.com"
      subject => "IDP Platform Alert: %{message}"
    }
  }
}
```

#### 2. Kibana Dashboard Setup

```json
{
  "version": "8.0.0",
  "objects": [
    {
      "id": "idp-platform-dashboard",
      "type": "dashboard",
      "attributes": {
        "title": "IDP Platform Monitoring",
        "panels": [
          {
            "visualization": "error-rate-timeline",
            "gridData": {
              "x": 0,
              "y": 0,
              "w": 48,
              "h": 15
            }
          },
          {
            "visualization": "api-response-times",
            "gridData": {
              "x": 0,
              "y": 15,
              "w": 24,
              "h": 15
            }
          },
          {
            "visualization": "top-errors",
            "gridData": {
              "x": 24,
              "y": 15,
              "w": 24,
              "h": 15
            }
          }
        ]
      }
    }
  ]
}
```

---

## CI/CD Pipeline Integration

### GitHub Actions Integration

#### 1. Plugin Validation Workflow

```yaml
# .github/workflows/plugin-validation.yml
name: Plugin Validation

on:
  pull_request:
    paths:
      - 'plugins/**'
      - 'package.json'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Validate plugin structure
        run: npm run plugin:validate
      
      - name: Security scan
        run: npm audit --audit-level=moderate
      
      - name: License check
        run: npm run license:check
      
      - name: Test plugin
        run: npm run plugin:test
      
      - name: Build plugin
        run: npm run plugin:build
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: plugin-validation-results
          path: validation-results.json
```

#### 2. Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
    
env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    
    steps:
      - name: Deploy to Kubernetes
        uses: azure/k8s-deploy@v4
        with:
          manifests: |
            k8s/application-deployment.yaml
            k8s/service.yaml
          images: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          kubectl-version: 'latest'
```

### Jenkins Integration

#### 1. Jenkinsfile

```groovy
pipeline {
    agent any
    
    environment {
        DOCKER_REGISTRY = 'registry.company.com'
        IMAGE_NAME = 'idp-platform'
        SONAR_HOST = 'https://sonar.company.com'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        
        stage('Build') {
            steps {
                sh 'npm ci'
                sh 'npm run build'
            }
        }
        
        stage('Test') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        sh 'npm run test:unit'
                    }
                }
                stage('Integration Tests') {
                    steps {
                        sh 'npm run test:integration'
                    }
                }
                stage('E2E Tests') {
                    steps {
                        sh 'npm run test:e2e'
                    }
                }
            }
        }
        
        stage('Code Quality') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh 'npm run sonar'
                }
                timeout(time: 1, unit: 'HOURS') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }
        
        stage('Security Scan') {
            steps {
                sh 'npm audit --production'
                sh 'trivy fs --severity HIGH,CRITICAL .'
            }
        }
        
        stage('Build Docker Image') {
            steps {
                script {
                    docker.build("${DOCKER_REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER}")
                }
            }
        }
        
        stage('Push to Registry') {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", 'docker-credentials') {
                        docker.image("${DOCKER_REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER}").push()
                        docker.image("${DOCKER_REGISTRY}/${IMAGE_NAME}:${BUILD_NUMBER}").push('latest')
                    }
                }
            }
        }
        
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                script {
                    kubernetesDeploy(
                        configs: 'k8s/*.yaml',
                        kubeconfigId: 'kubeconfig',
                        enableConfigSubstitution: true
                    )
                }
            }
        }
    }
    
    post {
        always {
            junit 'test-results/**/*.xml'
            publishHTML([
                reportDir: 'coverage',
                reportFiles: 'index.html',
                reportName: 'Coverage Report'
            ])
        }
        success {
            slackSend(
                color: 'good',
                message: "Build Successful: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
            )
        }
        failure {
            slackSend(
                color: 'danger',
                message: "Build Failed: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
            )
        }
    }
}
```

---

## Cloud Provider Deployment

### AWS Deployment

#### 1. Terraform Configuration

```hcl
# main.tf
provider "aws" {
  region = var.aws_region
}

# VPC Configuration
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "idp-platform-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = true
  enable_dns_hostnames = true
  
  tags = {
    Environment = var.environment
    Project     = "idp-platform"
  }
}

# EKS Cluster
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  
  cluster_name    = "idp-platform-cluster"
  cluster_version = "1.28"
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
  
  node_groups = {
    main = {
      desired_capacity = 3
      max_capacity     = 10
      min_capacity     = 2
      
      instance_types = ["t3.xlarge"]
      
      k8s_labels = {
        Environment = var.environment
        NodeGroup   = "main"
      }
    }
  }
}

# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier = "idp-platform-db"
  
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.r6g.xlarge"
  
  allocated_storage     = 100
  storage_encrypted     = true
  storage_type          = "gp3"
  
  db_name  = "idp_platform"
  username = var.db_username
  password = var.db_password
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  multi_az               = true
  publicly_accessible    = false
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  tags = {
    Environment = var.environment
    Project     = "idp-platform"
  }
}

# ElastiCache Redis
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "idp-platform-cache"
  replication_group_description = "Redis cluster for IDP Platform"
  
  engine               = "redis"
  node_type            = "cache.r6g.xlarge"
  number_cache_clusters = 3
  
  port = 6379
  
  subnet_group_name = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  snapshot_retention_limit = 7
  snapshot_window          = "03:00-05:00"
  
  tags = {
    Environment = var.environment
    Project     = "idp-platform"
  }
}

# S3 Buckets
resource "aws_s3_bucket" "artifacts" {
  bucket = "idp-platform-artifacts-${var.environment}"
  
  tags = {
    Environment = var.environment
    Project     = "idp-platform"
  }
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  
  origin {
    domain_name = aws_alb.main.dns_name
    origin_id   = "alb"
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }
  
  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "alb"
    
    forwarded_values {
      query_string = true
      headers      = ["*"]
      
      cookies {
        forward = "all"
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  viewer_certificate {
    cloudfront_default_certificate = true
  }
  
  tags = {
    Environment = var.environment
    Project     = "idp-platform"
  }
}
```

### GCP Deployment

#### 1. Terraform Configuration for GCP

```hcl
# gcp-main.tf
provider "google" {
  project = var.gcp_project
  region  = var.gcp_region
}

# GKE Cluster
resource "google_container_cluster" "primary" {
  name     = "idp-platform-cluster"
  location = var.gcp_region
  
  initial_node_count = 3
  
  node_config {
    machine_type = "n2-standard-4"
    
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
    
    labels = {
      environment = var.environment
      project     = "idp-platform"
    }
  }
  
  master_auth {
    client_certificate_config {
      issue_client_certificate = false
    }
  }
  
  network_policy {
    enabled = true
  }
  
  addons_config {
    http_load_balancing {
      disabled = false
    }
    
    horizontal_pod_autoscaling {
      disabled = false
    }
  }
}

# Cloud SQL PostgreSQL
resource "google_sql_database_instance" "postgres" {
  name             = "idp-platform-db"
  database_version = "POSTGRES_15"
  region           = var.gcp_region
  
  settings {
    tier = "db-custom-4-16384"
    
    disk_config {
      size = 100
      type = "PD_SSD"
    }
    
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
    }
    
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }
    
    database_flags {
      name  = "max_connections"
      value = "200"
    }
  }
}

# Memorystore Redis
resource "google_redis_instance" "cache" {
  name           = "idp-platform-cache"
  tier           = "STANDARD_HA"
  memory_size_gb = 16
  region         = var.gcp_region
  
  redis_version = "REDIS_7_0"
  
  authorized_network = google_compute_network.vpc.id
  
  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }
}

# Cloud Storage Bucket
resource "google_storage_bucket" "artifacts" {
  name          = "idp-platform-artifacts-${var.environment}"
  location      = var.gcp_region
  force_destroy = false
  
  versioning {
    enabled = true
  }
  
  encryption {
    default_kms_key_name = google_kms_crypto_key.storage.id
  }
  
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

# Cloud CDN
resource "google_compute_backend_service" "cdn" {
  name        = "idp-platform-cdn"
  protocol    = "HTTPS"
  timeout_sec = 10
  
  backend {
    group = google_compute_instance_group_manager.app.instance_group
  }
  
  cdn_policy {
    cache_mode = "CACHE_ALL_STATIC"
    default_ttl = 3600
    max_ttl     = 86400
    
    cache_key_policy {
      include_host         = true
      include_protocol     = true
      include_query_string = true
    }
  }
  
  health_checks = [google_compute_health_check.app.id]
}
```

### Azure Deployment

#### 1. Terraform Configuration for Azure

```hcl
# azure-main.tf
provider "azurerm" {
  features {}
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "idp-platform-rg"
  location = var.azure_region
}

# AKS Cluster
resource "azurerm_kubernetes_cluster" "main" {
  name                = "idp-platform-aks"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "idp-platform"
  
  default_node_pool {
    name       = "default"
    node_count = 3
    vm_size    = "Standard_D4s_v3"
    
    enable_auto_scaling = true
    min_count          = 2
    max_count          = 10
  }
  
  identity {
    type = "SystemAssigned"
  }
  
  network_profile {
    network_plugin    = "azure"
    network_policy    = "calico"
    load_balancer_sku = "standard"
  }
  
  addon_profile {
    oms_agent {
      enabled                    = true
      log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
    }
  }
}

# Azure Database for PostgreSQL
resource "azurerm_postgresql_flexible_server" "main" {
  name                = "idp-platform-psql"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  
  version    = "15"
  sku_name   = "GP_Standard_D4s_v3"
  storage_mb = 102400
  
  backup_retention_days        = 30
  geo_redundant_backup_enabled = true
  
  administrator_login    = var.db_username
  administrator_password = var.db_password
  
  zone = "1"
  
  high_availability {
    mode                      = "ZoneRedundant"
    standby_availability_zone = "2"
  }
}

# Azure Cache for Redis
resource "azurerm_redis_cache" "main" {
  name                = "idp-platform-redis"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  
  capacity = 2
  family   = "P"
  sku_name = "Premium"
  
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"
  
  redis_configuration {
    enable_authentication = true
    maxmemory_policy     = "allkeys-lru"
  }
  
  patch_schedule {
    day_of_week    = "Sunday"
    start_hour_utc = 3
  }
}

# Storage Account
resource "azurerm_storage_account" "main" {
  name                     = "idpplatformstg${var.environment}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "GRS"
  
  blob_properties {
    versioning_enabled = true
    
    delete_retention_policy {
      days = 30
    }
  }
}

# Azure CDN
resource "azurerm_cdn_profile" "main" {
  name                = "idp-platform-cdn"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "Standard_Microsoft"
}

resource "azurerm_cdn_endpoint" "main" {
  name                = "idp-platform-endpoint"
  profile_name        = azurerm_cdn_profile.main.name
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  
  origin {
    name      = "primary"
    host_name = azurerm_kubernetes_cluster.main.fqdn
  }
}
```

---

## Operations Manual

### Daily Operations

#### 1. Health Check Procedures

```bash
#!/bin/bash
# daily-health-check.sh

echo "=== IDP Platform Daily Health Check ==="
echo "Date: $(date)"

# Check API health
echo -n "API Health: "
curl -s http://platform.company.com/api/health | jq -r '.status'

# Check database connections
echo -n "Database Status: "
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1" > /dev/null 2>&1 && echo "OK" || echo "FAILED"

# Check Redis
echo -n "Redis Status: "
redis-cli ping > /dev/null 2>&1 && echo "OK" || echo "FAILED"

# Check disk usage
echo "Disk Usage:"
df -h | grep -E '(Filesystem|/data|/logs)'

# Check running pods
echo "Kubernetes Pods:"
kubectl get pods -n idp-platform --no-headers | awk '{print $1, $2, $3}'

# Check recent errors
echo "Recent Errors (last hour):"
kubectl logs -n idp-platform -l app=idp-platform --since=1h | grep ERROR | tail -5

# Check backup status
echo "Last Backup:"
aws s3 ls s3://idp-platform-backups/ --recursive | tail -1
```

#### 2. Maintenance Tasks

```yaml
# maintenance-schedule.yaml
daily:
  - time: "02:00"
    tasks:
      - database_backup
      - log_rotation
      - cache_cleanup
      
weekly:
  - day: "Sunday"
    time: "03:00"
    tasks:
      - security_scan
      - dependency_updates
      - performance_analysis
      
monthly:
  - day: 1
    time: "04:00"
    tasks:
      - full_system_backup
      - certificate_renewal_check
      - capacity_planning_review
```

### Incident Response

#### 1. Incident Response Playbook

```markdown
# Incident Response Playbook

## Severity Levels

- **P1 (Critical)**: Complete service outage
- **P2 (High)**: Major feature unavailable
- **P3 (Medium)**: Performance degradation
- **P4 (Low)**: Minor issues

## Response Times

| Severity | Response Time | Resolution Time |
|----------|--------------|-----------------|
| P1       | 15 minutes   | 2 hours        |
| P2       | 30 minutes   | 4 hours        |
| P3       | 2 hours      | 1 business day |
| P4       | 4 hours      | 3 business days|

## Escalation Path

1. On-call Engineer
2. Team Lead
3. Platform Manager
4. VP of Engineering

## Response Steps

1. **Acknowledge** incident within response time
2. **Assess** severity and impact
3. **Communicate** to stakeholders
4. **Investigate** root cause
5. **Mitigate** immediate impact
6. **Resolve** underlying issue
7. **Verify** resolution
8. **Document** incident report
9. **Review** in post-mortem
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Plugin Installation Failures

```bash
# Issue: Plugin installation hangs
# Solution: Check npm registry connectivity
npm ping
npm config get registry

# Clear npm cache
npm cache clean --force

# Check disk space
df -h /var/lib/docker

# Restart plugin installer service
kubectl rollout restart deployment/plugin-installer -n idp-platform

# Check installer logs
kubectl logs -n idp-platform -l app=plugin-installer --tail=100
```

#### 2. Database Connection Issues

```bash
# Test database connectivity
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT version()"

# Check connection pool status
SELECT count(*) FROM pg_stat_activity WHERE datname = 'idp_platform';

# Kill idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'idp_platform' 
  AND state = 'idle' 
  AND state_change < NOW() - INTERVAL '10 minutes';

# Restart connection pool
kubectl rollout restart deployment/pgbouncer -n idp-platform
```

#### 3. High Memory Usage

```bash
# Identify memory-consuming processes
ps aux --sort=-%mem | head -10

# Check Node.js memory usage
node -e "console.log(process.memoryUsage())"

# Trigger garbage collection (if --expose-gc flag is set)
node --expose-gc -e "global.gc()"

# Increase memory limit
export NODE_OPTIONS="--max-old-space-size=8192"

# Restart application
pm2 restart all
```

#### 4. Slow API Response Times

```bash
# Check slow queries
psql -c "SELECT * FROM pg_stat_statements ORDER BY mean DESC LIMIT 10"

# Analyze query plan
EXPLAIN ANALYZE SELECT * FROM services WHERE team_id = 'team_123';

# Update statistics
ANALYZE services;

# Clear Redis cache
redis-cli FLUSHDB

# Check API metrics
curl http://localhost:3000/metrics | grep api_request_duration
```

---

## Performance Tuning

### Database Optimization

```sql
-- PostgreSQL tuning parameters
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET work_mem = '32MB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '4GB';
ALTER SYSTEM SET max_worker_processes = 8;
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET max_parallel_workers = 8;
ALTER SYSTEM SET max_parallel_maintenance_workers = 4;

-- Reload configuration
SELECT pg_reload_conf();
```

### Application Optimization

```javascript
// PM2 ecosystem configuration
module.exports = {
  apps: [{
    name: 'idp-platform',
    script: './dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '2G',
    
    env: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=4096'
    },
    
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    merge_logs: true,
    
    min_uptime: '10s',
    max_restarts: 10,
    
    autorestart: true,
    watch: false,
    
    kill_timeout: 5000,
    listen_timeout: 10000,
    
    instance_var: 'INSTANCE_ID'
  }]
};
```

### Cache Optimization

```yaml
# Redis optimization
redis-config:
  maxmemory: 4gb
  maxmemory-policy: allkeys-lru
  
  # Persistence
  save: ""  # Disable RDB snapshots
  appendonly: yes
  appendfsync: everysec
  
  # Performance
  tcp-keepalive: 60
  timeout: 300
  
  # Memory optimization
  lazyfree-lazy-eviction: yes
  lazyfree-lazy-expire: yes
  lazyfree-lazy-server-del: yes
  
  # Connection limits
  maxclients: 10000
```

---

*Integration and Operations Guide Version: 1.0.0*  
*Last Updated: 2025-08-08*  
*Platform Version: 2.0.0*