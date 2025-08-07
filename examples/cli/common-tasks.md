# Backstage CLI - Common Tasks Examples

This document provides examples of common tasks using the Backstage CLI tool.

## Setup and Configuration

### Initial Setup
```bash
# Initialize CLI configuration
backstage-cli init

# Check current configuration
backstage-cli config list

# Set API key authentication
backstage-cli config set apiKey "your-api-key-here"

# Set bearer token authentication
backstage-cli config set bearerToken "your-bearer-token"

# Test connection
backstage-cli health
```

### Configuration Management
```bash
# View current configuration
backstage-cli config show

# Set timeout to 60 seconds
backstage-cli config set timeout 60000

# Enable debug logging
backstage-cli config set logLevel debug

# Export configuration to file
backstage-cli config export ~/.backstage-cli-backup.yaml

# Import configuration from file
backstage-cli config import ~/.backstage-cli-backup.yaml
```

## Authentication

### Login and Session Management
```bash
# Interactive login
backstage-cli auth login

# Login with specific credentials
backstage-cli auth login --api-key "your-key"
backstage-cli auth login --bearer-token "your-token"

# Check authentication status
backstage-cli auth status

# Logout and clear credentials
backstage-cli auth logout

# Refresh expired tokens
backstage-cli auth refresh
```

## Plugin Management

### Listing and Searching Plugins
```bash
# List all available plugins
backstage-cli plugins list

# List only installed plugins
backstage-cli plugins list --installed-only

# Search for plugins
backstage-cli plugins search "catalog"

# Filter plugins by category
backstage-cli plugins list --category "monitoring"

# Get detailed plugin information
backstage-cli plugins show @backstage/plugin-catalog

# List plugins in JSON format
backstage-cli plugins list --format json
```

### Installing and Managing Plugins
```bash
# Install a plugin
backstage-cli plugins install @backstage/plugin-catalog

# Install specific version
backstage-cli plugins install @backstage/plugin-techdocs --version "1.10.0"

# Install with custom configuration
backstage-cli plugins install @backstage/plugin-kubernetes \
  --config '{"refreshInterval": "30s", "enabled": true}'

# Install with configuration file
backstage-cli plugins install @backstage/plugin-jenkins \
  --config-file ./jenkins-config.yaml

# Uninstall a plugin
backstage-cli plugins uninstall @backstage/plugin-lighthouse

# Skip confirmation prompts
backstage-cli plugins install @backstage/plugin-catalog --yes
```

## Workflow Management

### Listing and Viewing Workflows
```bash
# List all workflows
backstage-cli workflows list

# Filter workflows by status
backstage-cli workflows list --status running

# Get workflow details
backstage-cli workflows show workflow-id-123

# List workflows in table format
backstage-cli workflows list --format table

# Show only recent workflows
backstage-cli workflows list --limit 10
```

### Creating and Executing Workflows
```bash
# Create workflow from template
backstage-cli workflows create \
  --name "Deploy Service" \
  --description "Automated deployment" \
  --template deployment

# Create workflow from file
backstage-cli workflows create --file ./workflow-definition.yaml

# Execute a workflow
backstage-cli workflows execute workflow-id-123

# Execute with parameters
backstage-cli workflows execute workflow-id-123 \
  --parameters '{"environment": "staging", "version": "1.0.0"}'

# Execute and follow progress
backstage-cli workflows execute workflow-id-123 --follow

# Delete a workflow
backstage-cli workflows delete workflow-id-123
```

## System Monitoring

### Health Checks and Status
```bash
# Basic health check
backstage-cli health

# Verbose health information
backstage-cli health --verbose

# Check specific service health
backstage-cli health --service database

# Health check with output formatting
backstage-cli health --format json
```

### Metrics and Analytics
```bash
# Get system metrics
backstage-cli metrics

# Metrics for specific time range
backstage-cli metrics --timerange 24h

# Export metrics to file
backstage-cli metrics --format json > metrics.json

# View performance metrics
backstage-cli metrics --type performance

# Get tenant analytics
backstage-cli tenants analytics --days 30
```

## Search and Discovery

### Searching Resources
```bash
# Basic search
backstage-cli search "microservice"

# Search specific resource types
backstage-cli search "api" --type service
backstage-cli search "docs" --type documentation

# Limit search results
backstage-cli search "kubernetes" --limit 5

# Search with formatting
backstage-cli search "monitoring" --format table
```

## Notifications

### Managing Notifications
```bash
# List all notifications
backstage-cli notifications list

# Show only unread notifications
backstage-cli notifications list --unread-only

# Mark notification as read
backstage-cli notifications mark-read notification-id-123

# Create a notification
backstage-cli notifications create \
  --title "Deployment Complete" \
  --message "Service deployed successfully" \
  --type success

# Clear all notifications
backstage-cli notifications clear --all
```

## Tenant Management

### Tenant Operations
```bash
# Get current tenant information
backstage-cli tenants current

# List user's tenants
backstage-cli tenants list

# Switch to different tenant
backstage-cli tenants switch tenant-id-456

# Get tenant analytics
backstage-cli tenants analytics

# Create new tenant (if authorized)
backstage-cli tenants create \
  --name "Development Team" \
  --domain "dev.company.com"
```

## Development and Debugging

### Development Server
```bash
# Start development server with auto-reload
backstage-cli dev serve

# Serve with custom port
backstage-cli dev serve --port 4500

# Enable debug mode
backstage-cli dev serve --debug

# Watch for file changes
backstage-cli dev serve --watch

# Serve with mock data
backstage-cli dev serve --mock
```

### Debugging and Troubleshooting
```bash
# Enable verbose logging for all commands
backstage-cli --verbose health

# Enable debug output
backstage-cli --debug plugins list

# Check configuration validity
backstage-cli config validate

# Test API connectivity
backstage-cli test connection

# Generate debug report
backstage-cli debug report
```

## Batch Operations

### Automation and Scripting
```bash
# Export data for backup
backstage-cli export --all --output backup.json

# Import data from backup
backstage-cli import --file backup.json

# Batch install plugins from file
backstage-cli plugins install --batch --file plugins.txt

# Execute multiple commands
backstage-cli batch --file commands.txt

# Generate reports
backstage-cli report --type usage --period 30d
```

### Pipeline Integration
```bash
# CI/CD friendly commands (no interactive prompts)
backstage-cli --non-interactive plugins install @backstage/plugin-catalog

# Exit codes for automation
backstage-cli health && echo "System healthy" || echo "System unhealthy"

# JSON output for parsing
backstage-cli plugins list --format json | jq '.items[].name'

# Set timeout for automation
backstage-cli --timeout 30 health
```

## Advanced Usage

### Custom Output Formats
```bash
# Table format (default for lists)
backstage-cli plugins list --format table

# JSON format for scripting
backstage-cli plugins list --format json

# YAML format for configuration
backstage-cli config show --format yaml

# CSV export
backstage-cli workflows list --format csv > workflows.csv
```

### Configuration Profiles
```bash
# Create configuration profile
backstage-cli config profile create production \
  --base-url "https://prod.company.com/api" \
  --api-key "prod-key"

# Switch to profile
backstage-cli config profile switch production

# List profiles
backstage-cli config profile list

# Delete profile
backstage-cli config profile delete staging
```

### Environment-Specific Operations
```bash
# Override configuration with environment variables
export BACKSTAGE_BASE_URL="https://staging.company.com/api"
export BACKSTAGE_API_KEY="staging-key"
backstage-cli health

# Use different config file
backstage-cli --config ./staging-config.yaml health

# Temporary authentication
backstage-cli --api-key "temp-key" plugins list
```

## Tips and Best Practices

### Performance Optimization
```bash
# Increase timeout for slow networks
backstage-cli config set timeout 60000

# Reduce retries for faster failure
backstage-cli config set retries 1

# Enable caching for repeated operations
backstage-cli config set cache.enabled true
```

### Security Best Practices
```bash
# Use environment variables for sensitive data
export BACKSTAGE_API_KEY="your-secret-key"
backstage-cli health

# Use bearer tokens for enhanced security
backstage-cli auth login --bearer-token "$(get-token-from-vault)"

# Clear credentials after use
backstage-cli auth logout
```

### Troubleshooting Common Issues
```bash
# Check connectivity
backstage-cli test connection

# Validate configuration
backstage-cli config validate

# Reset configuration to defaults
backstage-cli config reset

# Clear cache if experiencing issues
backstage-cli cache clear

# Get help for any command
backstage-cli <command> --help
```

For more detailed information, run `backstage-cli --help` or visit the documentation at [docs.backstage.io](https://docs.backstage.io).