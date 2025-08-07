# Backstage Developer Portal SDK Suite

A comprehensive Software Development Kit (SDK) suite for the Backstage-based SaaS Developer Portal, providing multi-language support and complete tooling for seamless integration.

![Backstage SDK](https://img.shields.io/badge/Backstage-SDK-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)
![Python](https://img.shields.io/badge/Python-Ready-green)
![CLI](https://img.shields.io/badge/CLI-Available-orange)
![Browser Extension](https://img.shields.io/badge/Browser%20Extension-Available-purple)

## Overview

This SDK suite enables developers to interact with the Backstage Developer Portal programmatically across multiple languages and platforms. Built for enterprise-scale deployments supporting thousands of developers and hundreds of clients.

## Features

### 🚀 Multi-Language Support
- **TypeScript/JavaScript**: Full-featured SDK with REST, GraphQL, and WebSocket clients
- **Python**: Async-first SDK with type safety using Pydantic
- **CLI Tool**: Cross-platform command-line interface for all portal operations
- **Browser Extension**: Chrome/Firefox extension for seamless portal integration

### 🔧 Core Capabilities
- **Authentication**: API key and Bearer token support with auto-refresh
- **Plugin Management**: Install, configure, and manage portal plugins
- **Workflow Execution**: Create and execute deployment workflows
- **Real-time Events**: WebSocket-based event streaming
- **Search & Discovery**: Powerful search across portal resources
- **Notifications**: Send and receive portal notifications
- **System Monitoring**: Health checks and metrics collection

### 🏗️ Enterprise Features
- **Circuit Breaker Pattern**: Fault tolerance and resilience
- **Retry Logic**: Configurable retry with exponential backoff
- **Rate Limiting**: Built-in rate limiting and throttling
- **Multi-tenant Support**: Tenant-aware operations
- **Comprehensive Testing**: Unit, integration, and E2E test utilities
- **Production Ready**: Optimized for high-scale deployments

## Quick Start

### TypeScript/JavaScript

```bash
npm install @backstage-idp/sdk-typescript
```

```typescript
import { createBackstageClient } from '@backstage-idp/sdk-typescript';

const client = createBackstageClient({
  baseURL: 'https://portal.company.com/api',
  apiKey: 'your-api-key'
});

// Check system health
const health = await client.system.getHealth();
console.log('Portal status:', health.status);

// List plugins
const plugins = await client.plugins.list();
console.log('Available plugins:', plugins.total);

// Install plugin
await client.plugins.install({
  pluginId: '@backstage/plugin-catalog',
  version: 'latest'
});
```

### Python

```bash
pip install backstage-idp-sdk
```

```python
import asyncio
from backstage_idp_sdk import create_client, ClientConfig

async def main():
    config = ClientConfig(
        base_url='https://portal.company.com/api',
        api_key='your-api-key'
    )
    
    async with create_client(config) as client:
        # Check system health
        health = await client.system.get_health()
        print(f"Portal status: {health.status}")
        
        # List plugins
        plugins = await client.plugins.list()
        print(f"Available plugins: {plugins.total}")
        
        # Install plugin
        result = await client.plugins.install(
            PluginInstallRequest(
                plugin_id='@backstage/plugin-catalog',
                version='latest'
            )
        )
        print(f"Installation: {result.success}")

asyncio.run(main())
```

### CLI Tool

```bash
npm install -g @backstage-idp/cli
```

```bash
# Initialize configuration
backstage-cli init

# Check system health
backstage-cli health

# List plugins
backstage-cli plugins list

# Install plugin
backstage-cli plugins install @backstage/plugin-catalog

# Create and execute workflow
backstage-cli workflows create --name "Deploy Service" --template deployment
backstage-cli workflows execute workflow-id-123

# Search portal resources
backstage-cli search "microservice"
```

### Browser Extension

1. Download from [Chrome Web Store](#) or [Firefox Add-ons](#)
2. Configure your portal URL and authentication
3. Access portal features from any webpage:
   - Quick search portal resources
   - Register current page as component
   - View real-time notifications
   - Execute common workflows

## Architecture

### SDK Components

```
├── sdk/
│   ├── typescript/          # TypeScript/JavaScript SDK
│   │   ├── src/
│   │   │   ├── client/      # HTTP, GraphQL, WebSocket clients
│   │   │   ├── auth/        # Authentication management
│   │   │   ├── types/       # Type definitions
│   │   │   └── utils/       # Utilities and testing
│   │   └── dist/            # Compiled output
│   │
│   ├── python/              # Python SDK
│   │   ├── backstage_idp_sdk/
│   │   │   ├── client/      # Async HTTP client
│   │   │   ├── auth/        # Auth management
│   │   │   ├── types/       # Pydantic models
│   │   │   └── utils/       # Testing utilities
│   │   └── setup.py
│   │
│   └── specs/               # OpenAPI specifications
│       └── backstage-api.yaml
│
├── cli/                     # Command-line interface
│   ├── src/
│   │   ├── commands/        # CLI commands
│   │   ├── config/          # Configuration management
│   │   └── utils/           # Utilities
│   └── package.json
│
├── browser-extension/       # Browser extension
│   ├── src/
│   │   ├── background.ts    # Background service worker
│   │   ├── popup/           # Extension popup UI
│   │   └── content/         # Content scripts
│   └── manifest.json
│
└── examples/               # Usage examples
    ├── typescript/         # TypeScript examples
    ├── python/            # Python examples
    ├── cli/              # CLI usage examples
    └── integration/      # CI/CD integration examples
```

### Key Design Principles

1. **Type Safety**: Full TypeScript support with generated types from OpenAPI
2. **Async First**: Non-blocking operations with proper error handling
3. **Resilience**: Circuit breakers, retries, and graceful degradation
4. **Extensibility**: Plugin-based architecture for custom functionality
5. **Testing**: Comprehensive test utilities and mock clients
6. **Documentation**: API docs generated from OpenAPI specifications

## Installation

### Prerequisites

- **TypeScript SDK**: Node.js ≥ 18.17.0
- **Python SDK**: Python ≥ 3.8
- **CLI Tool**: Node.js ≥ 18.0.0
- **Browser Extension**: Chrome ≥ 88 or Firefox ≥ 78

### Package Installation

```bash
# TypeScript SDK
npm install @backstage-idp/sdk-typescript

# Python SDK  
pip install backstage-idp-sdk

# CLI Tool
npm install -g @backstage-idp/cli

# All SDKs (from source)
git clone https://github.com/backstage/backstage-idp-sdk.git
cd backstage-idp-sdk
npm run build:all
```

## Configuration

### Environment Variables

```bash
# Portal Configuration
export BACKSTAGE_BASE_URL="https://portal.company.com/api"
export BACKSTAGE_API_KEY="your-api-key"
export BACKSTAGE_BEARER_TOKEN="your-bearer-token"

# SDK Configuration
export BACKSTAGE_TIMEOUT="30000"
export BACKSTAGE_RETRIES="3"
export BACKSTAGE_LOG_LEVEL="info"
```

### Configuration Files

#### TypeScript/JavaScript
```javascript
// backstage.config.js
module.exports = {
  baseURL: 'https://portal.company.com/api',
  apiKey: process.env.BACKSTAGE_API_KEY,
  timeout: 30000,
  retries: 3,
  circuitBreakerOptions: {
    threshold: 5,
    timeout: 60000,
    resetTimeout: 30000
  }
};
```

#### Python
```yaml
# .backstage.yaml
base_url: https://portal.company.com/api
api_key: ${BACKSTAGE_API_KEY}
timeout: 30.0
retries: 3
verify_ssl: true
```

#### CLI
```yaml
# ~/.backstage-cli.yaml
baseURL: https://portal.company.com/api
apiKey: your-api-key
timeout: 30000
retries: 3
format: table
logLevel: info
```

## Advanced Usage

### Real-time Event Handling

```typescript
// TypeScript
await client.connect();

client.events.onPluginEvent((event) => {
  console.log('Plugin event:', event.type, event.data);
});

client.events.onWorkflowEvent((event) => {
  console.log('Workflow event:', event.type, event.data);
});
```

```python
# Python
async with create_client(config) as client:
    await client.connect()
    
    def on_plugin_event(event):
        print(f"Plugin event: {event['type']}")
    
    subscription = await client.events.on_plugin_event(on_plugin_event)
    await asyncio.sleep(30)  # Listen for events
    await client.events.unsubscribe(subscription)
```

### GraphQL Operations

```typescript
// TypeScript
const result = await client.graphql.query(
  client.graphql.queries.getPlugins,
  { limit: 10, category: 'monitoring' }
);

const mutation = await client.graphql.mutate(
  client.graphql.mutations.createWorkflow,
  { name: 'Deploy Service', steps: [...] }
);
```

### Batch Operations

```typescript
// TypeScript
const results = await client.batch.execute([
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/plugins' },
  { method: 'POST', path: '/workflows', data: {...} }
]);
```

### Circuit Breaker and Resilience

```typescript
// TypeScript - Circuit breaker status
const cbStatus = client.utils.getStatistics().circuitBreaker;
console.log('Circuit breaker state:', cbStatus.state);

// Reset circuit breaker
client.httpClient.resetCircuitBreaker();
```

## Testing

### Unit Testing with Mock Client

```typescript
// TypeScript
import { createMockClient } from '@backstage-idp/sdk-typescript';

const mockClient = createMockClient({
  plugins: [
    { id: 'test-plugin', name: 'Test Plugin', status: 'installed' }
  ]
});

const plugins = await mockClient.plugins.list();
expect(plugins.items).toHaveLength(1);
```

```python
# Python
from backstage_idp_sdk.testing import create_mock_client

mock_client = create_mock_client({
    'plugins': [
        {'id': 'test-plugin', 'name': 'Test Plugin', 'status': 'installed'}
    ]
})

async with mock_client as client:
    plugins = await client.plugins.list()
    assert len(plugins.items) == 1
```

### Integration Testing

```bash
# Start test environment
docker-compose -f test-environments/docker-compose.test.yml up -d

# Run integration tests
npm run test:integration    # TypeScript
pytest tests/integration/  # Python
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Deploy with Backstage
  env:
    BACKSTAGE_API_KEY: ${{ secrets.BACKSTAGE_API_KEY }}
  run: |
    backstage-cli workflows create --name "Deploy ${{ github.repository }}"
    backstage-cli workflows execute --wait
```

### Jenkins Pipeline

```groovy
pipeline {
  agent any
  stages {
    stage('Deploy') {
      steps {
        withCredentials([string(credentialsId: 'backstage-api-key', variable: 'API_KEY')]) {
          sh '''
            backstage-cli config set apiKey "$API_KEY"
            backstage-cli workflows create --template deployment
            backstage-cli workflows execute --wait
          '''
        }
      }
    }
  }
}
```

## API Reference

### Core Classes

#### TypeScript
- `BackstageClient` - Main client class
- `HttpClient` - HTTP operations with resilience features
- `GraphQLClient` - GraphQL query and mutation client
- `WebSocketClient` - Real-time event handling
- `AuthManager` - Authentication and token management

#### Python  
- `BackstageClient` - Main async client class
- `HttpClient` - Async HTTP client with circuit breaker
- `GraphQLClient` - Async GraphQL operations
- `WebSocketClient` - Async WebSocket client
- `AuthManager` - Async authentication management

### API Endpoints

| Endpoint | TypeScript | Python | CLI | Description |
|----------|------------|---------|-----|-------------|
| `/health` | `client.system.getHealth()` | `client.system.get_health()` | `backstage-cli health` | System health check |
| `/plugins` | `client.plugins.list()` | `client.plugins.list()` | `backstage-cli plugins list` | List plugins |
| `/workflows` | `client.workflows.list()` | `client.workflows.list()` | `backstage-cli workflows list` | List workflows |
| `/search` | `client.search()` | `client.search()` | `backstage-cli search` | Global search |
| `/notifications` | `client.notifications.list()` | `client.notifications.list()` | `backstage-cli notifications list` | List notifications |

## Troubleshooting

### Common Issues

#### Authentication Errors
```bash
# Check credentials
backstage-cli auth status

# Refresh expired tokens  
backstage-cli auth refresh

# Re-authenticate
backstage-cli auth login
```

#### Connection Issues
```bash
# Test connectivity
backstage-cli test connection

# Check configuration
backstage-cli config validate

# Enable debug logging
backstage-cli --debug health
```

#### Performance Issues
```bash
# Increase timeout
backstage-cli config set timeout 60000

# Reduce retries for faster failure
backstage-cli config set retries 1

# Check circuit breaker status
backstage-cli debug circuit-breaker
```

### Debug Information

Enable debug logging for detailed troubleshooting:

```typescript
// TypeScript
import { createDevClient } from '@backstage-idp/sdk-typescript';
const client = createDevClient({ debug: true });
```

```python
# Python
import logging
logging.getLogger('backstage_idp_sdk').setLevel(logging.DEBUG)
```

```bash
# CLI
backstage-cli --debug <command>
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/backstage/backstage-idp-sdk.git
cd backstage-idp-sdk

# Install dependencies
npm install

# Build all packages
npm run build:all

# Run tests
npm run test:all

# Start development server
npm run dev
```

### Code Style

- **TypeScript**: ESLint + Prettier
- **Python**: Black + isort + mypy
- **Documentation**: Markdown with spell check
- **Commit Messages**: Conventional Commits format

## Support

### Documentation
- [API Documentation](https://backstage-idp-sdk.readthedocs.io/)
- [Examples Repository](./examples/)
- [Integration Guides](./docs/integration/)

### Community
- [Discord Community](#)
- [GitHub Discussions](https://github.com/backstage/backstage-idp-sdk/discussions)
- [Stack Overflow Tag: backstage-sdk](https://stackoverflow.com/questions/tagged/backstage-sdk)

### Enterprise Support
For enterprise support, training, and consulting services, contact us at [support@backstage-idp.com](mailto:support@backstage-idp.com).

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Roadmap

### Version 1.1 (Q2 2024)
- [ ] Go SDK implementation
- [ ] Java SDK implementation  
- [ ] Webhook SDK for event handling
- [ ] Plugin development toolkit
- [ ] Performance optimizations

### Version 1.2 (Q3 2024)
- [ ] Mobile SDK (React Native)
- [ ] VS Code extension
- [ ] Advanced workflow templates
- [ ] Multi-region support
- [ ] Enhanced security features

### Version 2.0 (Q4 2024)
- [ ] AI-powered code generation
- [ ] Advanced analytics and insights
- [ ] Kubernetes operator
- [ ] Serverless deployment options
- [ ] Enhanced multi-tenancy

---

**Built with ❤️ by the Backstage community**

For more information, visit [backstage.io](https://backstage.io) or our [documentation site](https://backstage-idp-sdk.readthedocs.io/).