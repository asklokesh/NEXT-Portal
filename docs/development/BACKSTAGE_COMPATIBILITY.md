# Backstage v1.41.0 Compatibility

This SaaS IDP platform is fully compatible with Backstage v1.41.0 and leverages the latest features and improvements.

## Key v1.41.0 Features Integrated

### Enhanced Plugin System
- **New Plugin Architecture**: Updated plugin installation to work with v1.41.0's improved plugin system
- **Better Plugin Discovery**: Enhanced plugin marketplace integration with npm registry
- **Simplified Configuration**: No-code plugin configuration that works seamlessly with v1.41.0

### Improved Catalog API
- **Enhanced Entity Management**: Updated catalog integration to use v1.41.0's improved entity API
- **Better Filtering**: Leverage new filtering and pagination capabilities
- **Performance Improvements**: Optimized queries for large catalogs

### Advanced Integration Features
- **Real-time Synchronization**: Seamless sync between SaaS IDP and Backstage v1.41.0
- **Enhanced Security**: Updated authentication and authorization patterns
- **Better Error Handling**: Improved error reporting and recovery

## API Compatibility

### Catalog API (v1.41.0)
```typescript
// Enhanced entity fetching with pagination
GET /api/catalog/entities?limit=500&offset=0

// Improved health checks
GET /api/catalog/health
GET /health
```

### Plugin API (v1.41.0)
```typescript
// Seamless plugin installation
POST /api/plugins
{
 "action": "install",
 "pluginId": "kubernetes",
 "version": "latest",
 "config": { ... }
}

// Configuration with Backstage integration
POST /api/plugins
{
 "action": "configure", 
 "pluginId": "jira",
 "config": { ... }
}
```

### Integration API (v1.41.0)
```typescript
// Health check
GET /api/backstage/integration?action=health

// Entity synchronization
GET /api/backstage/integration?action=entities

// Plugin installation with Backstage sync
POST /api/backstage/integration
{
 "action": "install-plugin",
 "pluginId": "github-actions",
 "config": { ... }
}
```

## Environment Variables

### Required for v1.41.0 Integration
```bash
# Backstage Backend URL (v1.41.0)
BACKSTAGE_API_URL=http://localhost:7007
BACKSTAGE_BACKEND_URL=http://localhost:7007

# Optional: API Token for authenticated requests
BACKSTAGE_API_TOKEN=your-api-token

# Integration Settings
BACKSTAGE_NAMESPACE=default
BACKSTAGE_AUTO_SYNC=true
BACKSTAGE_SYNC_INTERVAL=30000
BACKSTAGE_RETRY_ATTEMPTS=3
```

## Migration from Previous Versions

### From v1.20.0 to v1.41.0
1. **API Endpoints**: Updated all API calls to use v1.41.0 compatible endpoints
2. **Authentication**: Enhanced authentication handling for new security features
3. **Entity Schema**: Updated entity schemas to match v1.41.0 specifications
4. **Plugin System**: Migrated to new plugin architecture

### Breaking Changes Handled
- **Catalog API**: Updated pagination and filtering parameters
- **Plugin API**: Enhanced plugin configuration format
- **Health Checks**: Added fallback health check endpoints

## Features Exclusive to v1.41.0

### Advanced Plugin Management
- **Dynamic Configuration**: Real-time plugin configuration updates
- **Health Monitoring**: Plugin-specific health checks and monitoring
- **Dependency Management**: Automatic handling of plugin dependencies

### Enhanced Service Catalog
- **Rich Metadata**: Support for v1.41.0's enhanced metadata format
- **Relationship Mapping**: Advanced entity relationship handling
- **Performance Optimization**: Optimized queries and caching

### Improved Developer Experience
- **No-Code Configuration**: Visual configuration of all v1.41.0 features
- **Real-time Sync**: Instant synchronization with Backstage backend
- **Error Recovery**: Automatic error recovery and retry mechanisms

## Testing v1.41.0 Integration

### Health Check
```bash
curl http://localhost:4400/api/backstage/integration?action=health
```

### Plugin Installation Test
```bash
curl -X POST http://localhost:4400/api/plugins \
 -H "Content-Type: application/json" \
 -d '{
 "action": "install",
 "pluginId": "kubernetes", 
 "config": {
 "clusterName": "test-cluster",
 "apiServerUrl": "https://kubernetes.default.svc"
 }
 }'
```

### Entity Sync Test
```bash
curl http://localhost:4400/api/backstage/integration?action=entities
```

## Support and Compatibility

- **Minimum Backstage Version**: v1.41.0
- **Recommended Version**: v1.41.0 (latest)
- **Backward Compatibility**: Limited support for v1.40.x with warnings
- **Forward Compatibility**: Ready for v1.42.0 when released

## Roadmap

### Upcoming v1.42.0 Features
- Enhanced plugin marketplace
- Advanced workflow automation
- Improved security features
- Better performance monitoring

The SaaS IDP platform will continue to stay current with the latest Backstage releases to provide the best developer platform experience.