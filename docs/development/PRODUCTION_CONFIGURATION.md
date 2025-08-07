# Production Configuration Guide

This guide explains how to configure the Backstage IDP Wrapper for production use with real data sources and monitoring systems.

## Table of Contents

1. [Overview](#overview)
2. [Core Requirements](#core-requirements)
3. [Backstage Integration](#backstage-integration)
4. [Cloud Provider Integration](#cloud-provider-integration)
5. [Monitoring Integration](#monitoring-integration)
6. [Security Configuration](#security-configuration)
7. [Verification Steps](#verification-steps)

## Overview

The platform is designed to work with real production systems. All mock data fallbacks have been removed to ensure you're always working with real data from your infrastructure.

## Core Requirements

### Database Setup

```bash
# PostgreSQL is required for persistent storage
DATABASE_URL="postgresql://user:password@host:5432/backstage_idp?schema=public"

# Ensure these are set to false for production
USE_MOCK_DB="false"
USE_MOCK_DATA="false"
```

### Backstage Backend

The platform requires a running Backstage instance:

```bash
# Backstage API endpoint
BACKSTAGE_API_URL="https://backstage.yourcompany.com"

# Optional: API token for authenticated requests
BACKSTAGE_API_TOKEN="your-backstage-api-token"
```

## Backstage Integration

### 1. Catalog API

The catalog integration fetches real entities from your Backstage instance:

```typescript
// All catalog data comes from Backstage
GET /api/catalog/entities -> Backstage /api/catalog/entities
GET /api/catalog/stats -> Calculated from real Backstage entities
```

### 2. TechDocs

Technical documentation is fetched from Backstage TechDocs:

```bash
# Ensure TechDocs is enabled in your Backstage instance
# The wrapper will fetch documentation metadata and content
```

### 3. Scaffolder Templates

Software templates are fetched from your Backstage scaffolder:

```bash
# Templates API integration
GET /api/backstage/scaffolder/templates -> Backstage templates
```

## Cloud Provider Integration

### AWS Configuration

```bash
# Required for AWS cost tracking and resource discovery
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"

# IAM permissions required:
# - ce:GetCostAndUsage (Cost Explorer)
# - ec2:Describe* (EC2 resources)
# - rds:Describe* (RDS databases)
# - s3:List* (S3 buckets)
```

### Azure Configuration

```bash
# Required for Azure cost tracking and resource discovery
AZURE_SUBSCRIPTION_ID="your-subscription-id"
AZURE_TENANT_ID="your-tenant-id"
AZURE_CLIENT_ID="your-client-id"
AZURE_CLIENT_SECRET="your-client-secret"

# Required permissions:
# - Cost Management Reader
# - Reader on resource groups
```

### Google Cloud Configuration

```bash
# Required for GCP cost tracking and resource discovery
GCP_PROJECT_ID="your-project-id"
GCP_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# Required IAM roles:
# - Billing Account Viewer
# - Compute Viewer
# - Cloud SQL Viewer
```

## Monitoring Integration

### Prometheus Configuration

```bash
# Required for real-time metrics
PROMETHEUS_URL="http://prometheus.yourcompany.com:9090"

# The platform will query metrics using PromQL:
# - container_cpu_usage_seconds_total
# - container_memory_usage_bytes
# - http_request_duration_seconds
# - http_requests_total
```

### Grafana Configuration

```bash
# Required for dashboard integration
GRAFANA_URL="https://grafana.yourcompany.com"
GRAFANA_API_KEY="your-grafana-api-key"

# Required permissions:
# - Dashboard read access
# - Data source query access
```

## Security Configuration

### Authentication

```bash
# Production authentication setup
NEXTAUTH_URL="https://idp.yourcompany.com"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Backstage auth token for API requests
BACKSTAGE_AUTH_TOKEN="your-auth-token"
```

### API Rate Limiting

```bash
# Protect against abuse
API_RATE_LIMIT="100" # requests per window
API_RATE_LIMIT_WINDOW="60" # seconds
```

## Verification Steps

### 1. Check Backstage Connection

```bash
# Verify catalog API
curl -H "Authorization: Bearer $BACKSTAGE_API_TOKEN" \
 $BACKSTAGE_API_URL/api/catalog/entities

# Should return real entities from your catalog
```

### 2. Check Cloud Provider Integration

```bash
# Verify cost API
curl http://localhost:4400/api/costs

# Should return real cost data or configuration warning
```

### 3. Check Monitoring Integration

```bash
# Verify metrics API
curl http://localhost:4400/api/catalog/entities/by-name/Component/default/your-service/metrics

# Should return real metrics or configuration warning
```

## Troubleshooting

### Common Issues

1. **"Backstage API unavailable"**
 - Ensure BACKSTAGE_API_URL is correct
 - Check network connectivity
 - Verify API token if using authentication

2. **"Configure cloud provider credentials"**
 - Set appropriate environment variables
 - Ensure IAM permissions are correct
 - Test credentials with cloud CLI tools

3. **"No monitoring systems configured"**
 - Set PROMETHEUS_URL or GRAFANA_URL
 - Verify monitoring endpoints are accessible
 - Check API keys are valid

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
# Add to .env
LOG_LEVEL="debug"
SHOW_STACK_TRACES="true"
```

## Production Checklist

- [ ] PostgreSQL database configured and accessible
- [ ] Backstage backend running and accessible
- [ ] Cloud provider credentials configured (if using cost tracking)
- [ ] Monitoring systems configured (if using metrics)
- [ ] Authentication secrets generated
- [ ] Rate limiting configured
- [ ] SSL/TLS certificates installed
- [ ] Environment variables set in production
- [ ] Health checks passing
- [ ] Backup strategy implemented

## Support

For issues with production configuration:
1. Check logs for specific error messages
2. Verify all required environment variables are set
3. Test individual integrations in isolation
4. Contact support with error logs and configuration (sanitized)