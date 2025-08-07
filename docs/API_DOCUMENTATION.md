# API Documentation - Backstage IDP Portal
## REST API Reference Guide

---

## Overview
The Backstage IDP Portal provides a comprehensive REST API for managing entities, templates, plugins, and platform features. All APIs follow RESTful conventions and return JSON responses.

**Base URL**: `https://api.idp.example.com`
**Version**: v1
**Authentication**: Bearer token (JWT)

---

## Authentication

### Obtaining a Token
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}

Response: 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "roles": ["developer", "admin"]
  }
}
```

### Using the Token
Include the token in the Authorization header:
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Refreshing Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Response: 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

---

## Catalog API

### List Entities
```http
GET /api/catalog/entities
Query Parameters:
  - kind: string (optional) - Filter by entity kind (Component, System, API, etc.)
  - namespace: string (optional) - Filter by namespace
  - page: number (default: 1)
  - limit: number (default: 20, max: 100)
  - search: string (optional) - Search in entity names and descriptions

Response: 200 OK
{
  "items": [
    {
      "apiVersion": "backstage.io/v1alpha1",
      "kind": "Component",
      "metadata": {
        "name": "user-service",
        "namespace": "default",
        "uid": "uuid-123",
        "description": "User management service"
      },
      "spec": {
        "type": "service",
        "lifecycle": "production",
        "owner": "team-platform"
      }
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 20
}
```

### Get Entity
```http
GET /api/catalog/entities/{kind}/{namespace}/{name}

Response: 200 OK
{
  "apiVersion": "backstage.io/v1alpha1",
  "kind": "Component",
  "metadata": {...},
  "spec": {...},
  "relations": [
    {
      "type": "dependsOn",
      "target": {
        "kind": "Component",
        "namespace": "default",
        "name": "database-service"
      }
    }
  ]
}
```

### Create Entity
```http
POST /api/catalog/entities
Content-Type: application/json

{
  "apiVersion": "backstage.io/v1alpha1",
  "kind": "Component",
  "metadata": {
    "name": "new-service",
    "namespace": "default",
    "description": "New microservice"
  },
  "spec": {
    "type": "service",
    "lifecycle": "experimental",
    "owner": "team-platform"
  }
}

Response: 201 Created
{
  "apiVersion": "backstage.io/v1alpha1",
  "kind": "Component",
  "metadata": {
    "uid": "uuid-456",
    ...
  }
}
```

### Update Entity
```http
PUT /api/catalog/entities/{kind}/{namespace}/{name}
Content-Type: application/json

{
  "metadata": {
    "description": "Updated description"
  },
  "spec": {
    "lifecycle": "production"
  }
}

Response: 200 OK
{
  "apiVersion": "backstage.io/v1alpha1",
  "kind": "Component",
  ...
}
```

### Delete Entity
```http
DELETE /api/catalog/entities/{kind}/{namespace}/{name}

Response: 204 No Content
```

### Validate Entity
```http
POST /api/catalog/entities/validate
Content-Type: application/json

{
  "apiVersion": "backstage.io/v1alpha1",
  "kind": "Component",
  ...
}

Response: 200 OK
{
  "valid": true,
  "errors": []
}

Response: 400 Bad Request
{
  "valid": false,
  "errors": [
    {
      "path": "spec.type",
      "message": "Invalid type 'unknown'. Must be one of: service, website, library"
    }
  ]
}
```

---

## Templates API

### List Templates
```http
GET /api/templates
Query Parameters:
  - category: string (optional) - Filter by category
  - tags: string[] (optional) - Filter by tags
  - search: string (optional)

Response: 200 OK
{
  "items": [
    {
      "id": "react-app-template",
      "name": "React Application",
      "description": "Create a new React application with TypeScript",
      "category": "frontend",
      "tags": ["react", "typescript", "frontend"],
      "owner": "platform-team",
      "version": "1.2.0",
      "popularity": 245
    }
  ],
  "total": 32
}
```

### Get Template
```http
GET /api/templates/{templateId}

Response: 200 OK
{
  "id": "react-app-template",
  "name": "React Application",
  "spec": {
    "owner": "platform-team",
    "type": "service",
    "parameters": [
      {
        "name": "name",
        "type": "string",
        "required": true,
        "description": "Application name"
      }
    ],
    "steps": [
      {
        "id": "fetch",
        "name": "Fetch base",
        "action": "fetch:template"
      }
    ]
  }
}
```

### Execute Template
```http
POST /api/templates/{templateId}/execute
Content-Type: application/json

{
  "parameters": {
    "name": "my-new-app",
    "description": "My new application",
    "owner": "team-frontend"
  },
  "dryRun": false
}

Response: 202 Accepted
{
  "taskId": "task-789",
  "status": "pending",
  "createdAt": "2025-08-07T10:00:00Z"
}
```

### Get Template Execution Status
```http
GET /api/tasks/{taskId}

Response: 200 OK
{
  "taskId": "task-789",
  "status": "completed",
  "result": {
    "repository": "https://github.com/org/my-new-app",
    "entityRef": "component:default/my-new-app"
  },
  "createdAt": "2025-08-07T10:00:00Z",
  "completedAt": "2025-08-07T10:01:30Z"
}
```

---

## Search API

### Global Search
```http
POST /api/search
Content-Type: application/json

{
  "query": "user service",
  "filters": {
    "kind": ["Component", "API"],
    "lifecycle": ["production"]
  },
  "facets": ["kind", "lifecycle", "owner"],
  "page": 1,
  "limit": 20
}

Response: 200 OK
{
  "results": [
    {
      "entity": {
        "kind": "Component",
        "namespace": "default",
        "name": "user-service"
      },
      "score": 0.95,
      "highlights": {
        "description": ["Manages <em>user</em> authentication and profiles"]
      }
    }
  ],
  "facets": {
    "kind": {
      "Component": 45,
      "API": 12
    },
    "lifecycle": {
      "production": 30,
      "experimental": 27
    }
  },
  "total": 57
}
```

---

## Metrics API

### Service Metrics
```http
GET /api/metrics/services/{serviceName}
Query Parameters:
  - from: ISO8601 datetime
  - to: ISO8601 datetime
  - resolution: string (1m, 5m, 1h, 1d)

Response: 200 OK
{
  "service": "user-service",
  "metrics": {
    "availability": 99.95,
    "latency": {
      "p50": 45,
      "p95": 120,
      "p99": 250
    },
    "throughput": 1500,
    "errorRate": 0.05
  },
  "timeseries": [
    {
      "timestamp": "2025-08-07T10:00:00Z",
      "availability": 100,
      "latency": 42,
      "throughput": 1520,
      "errors": 0
    }
  ]
}
```

### Cost Metrics
```http
GET /api/cost/services
Query Parameters:
  - provider: string (aws, azure, gcp)
  - from: ISO8601 datetime
  - to: ISO8601 datetime
  - groupBy: string (service, team, environment)

Response: 200 OK
{
  "total": 15420.50,
  "currency": "USD",
  "period": {
    "from": "2025-08-01T00:00:00Z",
    "to": "2025-08-07T23:59:59Z"
  },
  "breakdown": [
    {
      "service": "user-service",
      "cost": 3240.20,
      "change": 5.2,
      "resources": {
        "compute": 2100.00,
        "storage": 540.20,
        "network": 600.00
      }
    }
  ]
}
```

---

## Plugins API

### List Plugins
```http
GET /api/plugins
Query Parameters:
  - status: string (enabled, disabled, all)
  - category: string

Response: 200 OK
{
  "plugins": [
    {
      "id": "kubernetes-backend",
      "name": "Kubernetes Backend",
      "version": "0.11.5",
      "status": "enabled",
      "category": "infrastructure",
      "dependencies": ["catalog-backend"],
      "config": {
        "clusters": ["production", "staging"]
      }
    }
  ]
}
```

### Enable/Disable Plugin
```http
POST /api/plugins/{pluginId}/status
Content-Type: application/json

{
  "enabled": true,
  "config": {
    "apiKey": "..."
  }
}

Response: 200 OK
{
  "id": "kubernetes-backend",
  "status": "enabled"
}
```

---

## WebSocket Events

### Connection
```javascript
const ws = new WebSocket('wss://api.idp.example.com/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'Bearer eyJhbGciOiJIUzI1NiIs...'
  }));
};
```

### Event Types
```javascript
// Entity Update
{
  "type": "entity.updated",
  "payload": {
    "entity": {
      "kind": "Component",
      "namespace": "default",
      "name": "user-service"
    },
    "changes": ["spec.lifecycle"]
  }
}

// Deployment Status
{
  "type": "deployment.status",
  "payload": {
    "service": "user-service",
    "environment": "production",
    "status": "in_progress",
    "progress": 65
  }
}

// System Alert
{
  "type": "system.alert",
  "payload": {
    "severity": "warning",
    "message": "High memory usage detected",
    "service": "database-service"
  }
}
```

---

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "spec.type",
        "message": "Invalid type"
      }
    ],
    "requestId": "req-123456"
  }
}
```

### Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Input validation failed |
| CONFLICT | 409 | Resource already exists |
| RATE_LIMIT | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Rate Limiting

API requests are rate limited per user:
- **Standard tier**: 1000 requests/hour
- **Premium tier**: 10000 requests/hour

Rate limit headers:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1691406000
```

---

## Pagination

All list endpoints support pagination:
```http
GET /api/catalog/entities?page=2&limit=50

Response Headers:
X-Total-Count: 500
X-Page-Count: 10
Link: <https://api.idp.example.com/api/catalog/entities?page=3&limit=50>; rel="next",
      <https://api.idp.example.com/api/catalog/entities?page=1&limit=50>; rel="prev",
      <https://api.idp.example.com/api/catalog/entities?page=10&limit=50>; rel="last"
```

---

## Versioning

API version is included in the URL path:
- Current: `/api/v1/...`
- Legacy: `/api/v0/...` (deprecated)

Version sunset dates are announced 6 months in advance via:
```http
Sunset: Sat, 31 Dec 2025 23:59:59 GMT
Deprecation: true
```

---

## SDK Examples

### JavaScript/TypeScript
```typescript
import { BackstageClient } from '@backstage/idp-sdk';

const client = new BackstageClient({
  baseUrl: 'https://api.idp.example.com',
  token: process.env.IDP_TOKEN
});

// List entities
const entities = await client.catalog.listEntities({
  kind: 'Component',
  namespace: 'default'
});

// Create entity
const newEntity = await client.catalog.createEntity({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'new-service'
  },
  spec: {
    type: 'service',
    owner: 'platform-team'
  }
});
```

### Python
```python
from backstage_sdk import BackstageClient

client = BackstageClient(
    base_url='https://api.idp.example.com',
    token=os.environ['IDP_TOKEN']
)

# List entities
entities = client.catalog.list_entities(
    kind='Component',
    namespace='default'
)

# Execute template
task = client.templates.execute(
    template_id='react-app-template',
    parameters={
        'name': 'my-app',
        'owner': 'frontend-team'
    }
)
```

### Go
```go
import "github.com/backstage/idp-sdk-go"

client := backstage.NewClient(
    "https://api.idp.example.com",
    os.Getenv("IDP_TOKEN"),
)

// List entities
entities, err := client.Catalog.ListEntities(&backstage.ListOptions{
    Kind: "Component",
    Namespace: "default",
})

// Create entity
entity, err := client.Catalog.CreateEntity(&backstage.Entity{
    APIVersion: "backstage.io/v1alpha1",
    Kind: "Component",
    Metadata: backstage.Metadata{
        Name: "new-service",
    },
})
```

---

## Support

- **Documentation**: https://docs.idp.example.com
- **API Status**: https://status.idp.example.com
- **Support**: support@idp.example.com
- **Community**: https://slack.idp.example.com

---

**Version**: 1.0.0
**Last Updated**: 2025-08-07
**OpenAPI Spec**: [Download](https://api.idp.example.com/openapi.json)