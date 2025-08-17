# Enterprise IDP Platform - API Reference Documentation

## Table of Contents

1. [Authentication](#authentication)
2. [Plugin Management](#plugin-management)
3. [Service Catalog](#service-catalog)
4. [Marketplace](#marketplace)
5. [Analytics & Monitoring](#analytics--monitoring)
6. [Notifications](#notifications)
7. [WebSocket Events](#websocket-events)
8. [Error Codes](#error-codes)

---

## Authentication

### Overview

The platform uses OAuth2/OIDC for authentication with support for multiple providers and MFA.

### Base URL
```
Production: https://api.platform.company.com
Staging: https://api-staging.platform.company.com
Development: http://localhost:3000
```

### Authentication Headers
```http
Authorization: Bearer <access_token>
X-API-Key: <api_key>  # Alternative for service accounts
```

---

## Authentication Endpoints

### POST /api/auth/login
Authenticate user with email and password.

**Request:**
```json
{
  "email": "user@company.com",
  "password": "secure_password",
  "mfaCode": "123456"  // Optional, required if MFA enabled
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "usr_123",
    "email": "user@company.com",
    "name": "John Doe",
    "role": "DEVELOPER",
    "mfaEnabled": true
  },
  "expiresIn": 3600
}
```

### POST /api/auth/logout
Logout current user and invalidate tokens.

**Response:**
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

### GET /api/auth/me
Get current authenticated user profile.

**Response:**
```json
{
  "id": "usr_123",
  "email": "user@company.com",
  "name": "John Doe",
  "username": "johndoe",
  "role": "DEVELOPER",
  "teams": [
    {
      "id": "team_456",
      "name": "platform-team",
      "role": "MAINTAINER"
    }
  ],
  "permissions": [
    "catalog:read",
    "catalog:write",
    "plugins:install"
  ],
  "lastLogin": "2024-01-15T10:30:00Z"
}
```

### POST /api/auth/refresh
Refresh access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

---

## Plugin Management

### GET /api/plugins
List all available plugins with filtering and pagination.

**Query Parameters:**
- `status` (string): Filter by status (available, installed, disabled)
- `category` (string): Filter by category
- `search` (string): Search in name and description
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `sort` (string): Sort field (name, installs, rating, updated)
- `order` (string): Sort order (asc, desc)

**Response:**
```json
{
  "plugins": [
    {
      "id": "plg_789",
      "name": "@backstage/plugin-catalog",
      "displayName": "Service Catalog",
      "description": "Manage your service catalog",
      "version": "1.2.3",
      "category": "Core",
      "status": "installed",
      "author": {
        "name": "Backstage Team",
        "email": "team@backstage.io"
      },
      "rating": 4.8,
      "installs": 15234,
      "license": "Apache-2.0",
      "compatibility": {
        "backstage": ">=1.20.0",
        "platform": ">=2.0.0"
      },
      "dependencies": [
        {
          "name": "@backstage/core",
          "version": "^1.0.0"
        }
      ],
      "config": {
        "enabled": true,
        "settings": {}
      },
      "health": {
        "status": "healthy",
        "lastCheck": "2024-01-15T10:00:00Z",
        "metrics": {
          "cpu": 2.5,
          "memory": 128,
          "responseTime": 45
        }
      }
    }
  ],
  "total": 250,
  "page": 1,
  "pages": 13
}
```

### GET /api/plugins/:id
Get detailed information about a specific plugin.

**Response:**
```json
{
  "id": "plg_789",
  "name": "@backstage/plugin-catalog",
  "displayName": "Service Catalog",
  "description": "Comprehensive service catalog management",
  "longDescription": "...",
  "version": "1.2.3",
  "versions": [
    {
      "version": "1.2.3",
      "releaseDate": "2024-01-10",
      "changelog": "Bug fixes and performance improvements"
    },
    {
      "version": "1.2.2",
      "releaseDate": "2024-01-05",
      "changelog": "Security patches"
    }
  ],
  "screenshots": [
    "https://cdn.platform.com/plugins/catalog/screen1.png"
  ],
  "documentation": "https://docs.platform.com/plugins/catalog",
  "repository": "https://github.com/backstage/backstage",
  "requirements": {
    "cpu": "500m",
    "memory": "256Mi",
    "storage": "1Gi"
  },
  "permissions": [
    "catalog:read",
    "catalog:write"
  ],
  "configuration": {
    "schema": {
      "type": "object",
      "properties": {
        "refreshInterval": {
          "type": "number",
          "default": 300
        }
      }
    }
  }
}
```

### POST /api/plugins/install
Install a new plugin or update existing one.

**Request:**
```json
{
  "name": "@backstage/plugin-catalog",
  "version": "1.2.3",  // Optional, latest if not specified
  "config": {
    "refreshInterval": 300
  },
  "autoEnable": true
}
```

**Response:**
```json
{
  "taskId": "task_abc123",
  "status": "pending",
  "plugin": {
    "id": "plg_789",
    "name": "@backstage/plugin-catalog",
    "version": "1.2.3"
  },
  "estimatedTime": 30,
  "message": "Plugin installation initiated"
}
```

### GET /api/plugins/install/:taskId/progress
Get installation progress for a plugin.

**Response:**
```json
{
  "taskId": "task_abc123",
  "status": "in_progress",
  "progress": 65,
  "currentStep": "Installing dependencies",
  "steps": [
    {
      "name": "Validation",
      "status": "completed",
      "duration": 2
    },
    {
      "name": "Dependency resolution",
      "status": "completed",
      "duration": 5
    },
    {
      "name": "Installing dependencies",
      "status": "in_progress",
      "progress": 30
    },
    {
      "name": "Configuration",
      "status": "pending"
    }
  ],
  "logs": [
    "2024-01-15T10:30:00Z: Starting installation",
    "2024-01-15T10:30:02Z: Plugin validated successfully",
    "2024-01-15T10:30:07Z: Dependencies resolved"
  ]
}
```

### DELETE /api/plugins/uninstall
Uninstall a plugin.

**Request:**
```json
{
  "pluginId": "plg_789",
  "removeData": false,  // Keep plugin data
  "force": false  // Force uninstall even with dependencies
}
```

**Response:**
```json
{
  "success": true,
  "message": "Plugin uninstalled successfully",
  "backupId": "backup_xyz789"  // ID of data backup if created
}
```

### PUT /api/plugins/update
Update plugin to a new version.

**Request:**
```json
{
  "pluginId": "plg_789",
  "version": "1.2.4",
  "backup": true,  // Create backup before update
  "rollbackOnFailure": true
}
```

**Response:**
```json
{
  "taskId": "task_def456",
  "status": "pending",
  "fromVersion": "1.2.3",
  "toVersion": "1.2.4",
  "changelog": "Security updates and bug fixes"
}
```

### POST /api/plugins/rollback
Rollback plugin to previous version.

**Request:**
```json
{
  "pluginId": "plg_789",
  "targetVersion": "1.2.2",  // Optional, previous version if not specified
  "restoreData": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Plugin rolled back successfully",
  "fromVersion": "1.2.3",
  "toVersion": "1.2.2"
}
```

### GET /api/plugins/health
Get health status of all installed plugins.

**Response:**
```json
{
  "summary": {
    "total": 25,
    "healthy": 23,
    "warning": 1,
    "critical": 1
  },
  "plugins": [
    {
      "id": "plg_789",
      "name": "@backstage/plugin-catalog",
      "status": "healthy",
      "uptime": 86400,
      "lastCheck": "2024-01-15T10:30:00Z",
      "metrics": {
        "cpu": {
          "usage": 2.5,
          "limit": 100
        },
        "memory": {
          "usage": 128,
          "limit": 256
        },
        "requests": {
          "rate": 150,
          "errors": 2,
          "latency_p50": 45,
          "latency_p99": 200
        }
      },
      "checks": [
        {
          "name": "Database Connection",
          "status": "passing",
          "message": "Connected"
        },
        {
          "name": "API Availability",
          "status": "passing",
          "latency": 25
        }
      ]
    }
  ]
}
```

### GET /api/plugins/dependencies
Analyze plugin dependencies.

**Query Parameters:**
- `pluginId` (string): Plugin to analyze

**Response:**
```json
{
  "plugin": {
    "id": "plg_789",
    "name": "@backstage/plugin-catalog"
  },
  "directDependencies": [
    {
      "name": "@backstage/core",
      "version": "^1.0.0",
      "installed": true,
      "currentVersion": "1.0.5"
    }
  ],
  "transitiveDependencies": [
    {
      "name": "react",
      "version": "^18.0.0",
      "installed": true,
      "currentVersion": "18.2.0"
    }
  ],
  "conflicts": [],
  "suggestions": [
    {
      "type": "update",
      "plugin": "@backstage/core",
      "reason": "Security vulnerability fixed in 1.0.6",
      "fromVersion": "1.0.5",
      "toVersion": "1.0.6"
    }
  ]
}
```

---

## Service Catalog

### GET /api/catalog/entities
List catalog entities with filtering.

**Query Parameters:**
- `kind` (string): Entity kind (Component, API, System, Domain, Resource)
- `type` (string): Entity type (service, website, library, etc.)
- `lifecycle` (string): Lifecycle stage (production, experimental, deprecated)
- `owner` (string): Owner team or user
- `search` (string): Search in name and description
- `tags` (array): Filter by tags
- `page` (number): Page number
- `limit` (number): Items per page

**Response:**
```json
{
  "entities": [
    {
      "uid": "ent_abc123",
      "kind": "Component",
      "metadata": {
        "name": "user-service",
        "namespace": "default",
        "description": "User management service",
        "labels": {
          "team": "platform",
          "tier": "backend"
        },
        "annotations": {
          "backstage.io/managed-by": "github",
          "pagerduty.com/service-id": "PD123"
        },
        "tags": ["java", "spring-boot", "api"]
      },
      "spec": {
        "type": "service",
        "lifecycle": "production",
        "owner": "team:platform",
        "system": "user-management",
        "providesApis": ["user-api"],
        "consumesApis": ["auth-api"],
        "dependsOn": ["database:users-db"]
      },
      "status": {
        "health": "healthy",
        "lastDeployed": "2024-01-15T09:00:00Z",
        "version": "2.3.4"
      },
      "relations": [
        {
          "type": "ownedBy",
          "target": "team:platform"
        },
        {
          "type": "providesApi",
          "target": "api:user-api"
        }
      ]
    }
  ],
  "total": 450,
  "page": 1,
  "pages": 23
}
```

### GET /api/catalog/entities/:uid
Get specific entity by UID.

**Response:**
```json
{
  "uid": "ent_abc123",
  "kind": "Component",
  "metadata": {
    "name": "user-service",
    "namespace": "default",
    "description": "User management service",
    "createdAt": "2023-06-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z",
    "deletedAt": null,
    "etag": "abc123def456"
  },
  "spec": {
    "type": "service",
    "lifecycle": "production",
    "owner": "team:platform"
  },
  "status": {
    "health": "healthy",
    "metrics": {
      "uptime": 99.99,
      "responseTime": 45,
      "errorRate": 0.01
    }
  },
  "history": [
    {
      "version": 2,
      "timestamp": "2024-01-15T10:00:00Z",
      "author": "user@company.com",
      "message": "Updated description"
    }
  ]
}
```

### POST /api/catalog/entities
Create a new catalog entity.

**Request:**
```json
{
  "kind": "Component",
  "metadata": {
    "name": "new-service",
    "namespace": "default",
    "description": "New microservice"
  },
  "spec": {
    "type": "service",
    "lifecycle": "experimental",
    "owner": "team:platform"
  }
}
```

**Response:**
```json
{
  "uid": "ent_def456",
  "kind": "Component",
  "metadata": {
    "name": "new-service",
    "namespace": "default"
  },
  "message": "Entity created successfully"
}
```

### PUT /api/catalog/entities/:uid
Update an existing entity.

**Request:**
```json
{
  "metadata": {
    "description": "Updated description",
    "labels": {
      "version": "2.0.0"
    }
  },
  "spec": {
    "lifecycle": "production"
  }
}
```

**Response:**
```json
{
  "uid": "ent_abc123",
  "message": "Entity updated successfully",
  "version": 3
}
```

### DELETE /api/catalog/entities/:uid
Delete a catalog entity.

**Query Parameters:**
- `cascade` (boolean): Delete related entities
- `force` (boolean): Force delete even with dependencies

**Response:**
```json
{
  "success": true,
  "message": "Entity deleted successfully",
  "affected": [
    "ent_abc123"
  ]
}
```

### GET /api/catalog/entities/:uid/relations
Get entity relationships.

**Response:**
```json
{
  "entity": {
    "uid": "ent_abc123",
    "name": "user-service"
  },
  "relations": {
    "incoming": [
      {
        "type": "dependsOn",
        "source": {
          "uid": "ent_xyz789",
          "kind": "Component",
          "name": "frontend-app"
        }
      }
    ],
    "outgoing": [
      {
        "type": "ownedBy",
        "target": {
          "uid": "team_123",
          "kind": "Group",
          "name": "platform-team"
        }
      },
      {
        "type": "dependsOn",
        "target": {
          "uid": "ent_db123",
          "kind": "Resource",
          "name": "users-database"
        }
      }
    ]
  },
  "graph": {
    "nodes": [
      {
        "id": "ent_abc123",
        "label": "user-service",
        "type": "Component"
      }
    ],
    "edges": [
      {
        "source": "ent_abc123",
        "target": "ent_db123",
        "type": "dependsOn"
      }
    ]
  }
}
```

### POST /api/catalog/import
Import entities from various sources.

**Request:**
```json
{
  "source": "github",
  "repository": "https://github.com/company/services",
  "branch": "main",
  "path": "catalog-info.yaml",
  "dryRun": false
}
```

**Response:**
```json
{
  "taskId": "import_task_123",
  "status": "processing",
  "source": "github",
  "discovered": 15,
  "message": "Import task initiated"
}
```

### GET /api/catalog/search
Advanced search with semantic capabilities.

**Request:**
```json
{
  "query": "user authentication service",
  "filters": {
    "kind": ["Component", "API"],
    "lifecycle": ["production"],
    "owner": ["team:platform"]
  },
  "semantic": true,
  "limit": 20
}
```

**Response:**
```json
{
  "results": [
    {
      "entity": {
        "uid": "ent_abc123",
        "kind": "Component",
        "name": "auth-service"
      },
      "score": 0.95,
      "highlights": {
        "description": "User <em>authentication</em> and authorization <em>service</em>"
      },
      "explanation": "High relevance due to exact match on 'authentication service'"
    }
  ],
  "total": 8,
  "suggestions": [
    "Did you mean: user authorization service?"
  ],
  "facets": {
    "kind": {
      "Component": 6,
      "API": 2
    },
    "lifecycle": {
      "production": 5,
      "experimental": 3
    }
  }
}
```

---

## Marketplace

### GET /api/marketplace/plugins
Browse marketplace plugins.

**Query Parameters:**
- `category` (string): Plugin category
- `featured` (boolean): Show only featured plugins
- `verified` (boolean): Show only verified plugins
- `minRating` (number): Minimum rating (1-5)
- `license` (string): License type
- `sort` (string): Sort by (popular, trending, newest, rating)

**Response:**
```json
{
  "plugins": [
    {
      "id": "mkt_plg_123",
      "name": "advanced-monitoring",
      "displayName": "Advanced Monitoring Suite",
      "vendor": {
        "id": "vendor_456",
        "name": "MonitorCorp",
        "verified": true
      },
      "description": "Comprehensive monitoring solution",
      "category": "Observability",
      "price": {
        "model": "subscription",
        "amount": 99,
        "currency": "USD",
        "period": "monthly",
        "trial": {
          "available": true,
          "duration": 14
        }
      },
      "rating": {
        "average": 4.7,
        "count": 234
      },
      "installs": 5678,
      "featured": true,
      "verified": true,
      "screenshots": [
        "https://marketplace.platform.com/screenshots/monitoring-1.png"
      ]
    }
  ],
  "total": 150,
  "categories": [
    {
      "name": "Observability",
      "count": 45
    },
    {
      "name": "Security",
      "count": 38
    }
  ]
}
```

### POST /api/marketplace/plugins/:id/install
Install a marketplace plugin.

**Request:**
```json
{
  "environment": "production",
  "acceptTerms": true,
  "paymentMethod": "pm_123",  // For paid plugins
  "config": {
    "apiKey": "monitoring_api_key"
  }
}
```

**Response:**
```json
{
  "orderId": "order_789",
  "pluginId": "mkt_plg_123",
  "status": "processing",
  "license": {
    "key": "LIC-XXXX-XXXX-XXXX",
    "validUntil": "2025-01-15T00:00:00Z"
  },
  "installationTaskId": "task_install_456"
}
```

### GET /api/marketplace/revenue
Get revenue analytics for vendors.

**Query Parameters:**
- `period` (string): Period (day, week, month, year)
- `startDate` (string): Start date
- `endDate` (string): End date

**Response:**
```json
{
  "summary": {
    "totalRevenue": 45678.90,
    "totalInstalls": 1234,
    "activeSubscriptions": 890,
    "churnRate": 2.5
  },
  "plugins": [
    {
      "id": "mkt_plg_123",
      "name": "advanced-monitoring",
      "revenue": 12345.67,
      "installs": 345,
      "subscriptions": {
        "active": 234,
        "new": 45,
        "churned": 12
      }
    }
  ],
  "timeline": [
    {
      "date": "2024-01-01",
      "revenue": 1234.56,
      "installs": 23
    }
  ]
}
```

---

## Analytics & Monitoring

### GET /api/metrics
Get platform metrics.

**Query Parameters:**
- `metrics` (array): Specific metrics to retrieve
- `period` (string): Time period (1h, 24h, 7d, 30d)
- `aggregation` (string): Aggregation type (sum, avg, max, min)

**Response:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "period": "24h",
  "metrics": {
    "system": {
      "cpu": {
        "usage": 45.2,
        "cores": 16
      },
      "memory": {
        "usage": 12.5,
        "total": 64,
        "unit": "GB"
      },
      "disk": {
        "usage": 234.5,
        "total": 1000,
        "unit": "GB"
      }
    },
    "application": {
      "requests": {
        "total": 1234567,
        "rate": 234.5,
        "errors": 123,
        "errorRate": 0.01
      },
      "latency": {
        "p50": 45,
        "p95": 150,
        "p99": 500,
        "unit": "ms"
      },
      "users": {
        "active": 1234,
        "total": 5678
      }
    },
    "plugins": {
      "installed": 45,
      "active": 42,
      "failed": 1
    },
    "catalog": {
      "entities": 4567,
      "components": 2345,
      "apis": 234,
      "systems": 45
    }
  }
}
```

### GET /api/monitoring/alerts
Get active monitoring alerts.

**Query Parameters:**
- `severity` (string): Filter by severity (critical, warning, info)
- `status` (string): Filter by status (firing, resolved, silenced)
- `service` (string): Filter by service

**Response:**
```json
{
  "alerts": [
    {
      "id": "alert_123",
      "name": "High CPU Usage",
      "severity": "warning",
      "status": "firing",
      "service": "catalog-service",
      "description": "CPU usage above 80% for 5 minutes",
      "value": 85.2,
      "threshold": 80,
      "startedAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:25:00Z",
      "labels": {
        "team": "platform",
        "environment": "production"
      },
      "annotations": {
        "runbook": "https://docs.platform.com/runbooks/high-cpu",
        "dashboard": "https://grafana.platform.com/d/cpu-usage"
      }
    }
  ],
  "summary": {
    "total": 5,
    "critical": 1,
    "warning": 3,
    "info": 1
  }
}
```

### GET /api/cost-analytics
Get cost analytics and FinOps data.

**Response:**
```json
{
  "period": "2024-01",
  "summary": {
    "totalCost": 45678.90,
    "projection": 48000.00,
    "budget": 50000.00,
    "savingsOpportunity": 3456.78
  },
  "breakdown": {
    "byService": [
      {
        "service": "catalog-service",
        "cost": 5678.90,
        "percentage": 12.4,
        "trend": "increasing"
      }
    ],
    "byResource": [
      {
        "resource": "compute",
        "cost": 23456.78,
        "percentage": 51.3
      },
      {
        "resource": "storage",
        "cost": 12345.67,
        "percentage": 27.0
      }
    ],
    "byTeam": [
      {
        "team": "platform",
        "cost": 15678.90,
        "budget": 20000.00,
        "utilization": 78.4
      }
    ]
  },
  "recommendations": [
    {
      "type": "rightsizing",
      "resource": "catalog-service",
      "current": "c5.2xlarge",
      "recommended": "c5.xlarge",
      "savingsPerMonth": 234.56,
      "confidence": 0.85
    }
  ]
}
```

---

## Notifications

### GET /api/notifications
Get user notifications.

**Query Parameters:**
- `status` (string): Filter by status (unread, read, archived)
- `type` (string): Filter by type (info, warning, error, success)
- `limit` (number): Number of notifications

**Response:**
```json
{
  "notifications": [
    {
      "id": "notif_123",
      "type": "info",
      "title": "Plugin Update Available",
      "message": "A new version of catalog plugin is available",
      "status": "unread",
      "priority": "medium",
      "createdAt": "2024-01-15T10:00:00Z",
      "data": {
        "pluginId": "plg_789",
        "currentVersion": "1.2.3",
        "newVersion": "1.2.4"
      },
      "actions": [
        {
          "label": "Update Now",
          "action": "plugin:update",
          "data": {
            "pluginId": "plg_789",
            "version": "1.2.4"
          }
        }
      ]
    }
  ],
  "unreadCount": 5,
  "total": 45
}
```

### POST /api/notifications/bulk
Send bulk notifications.

**Request:**
```json
{
  "recipients": {
    "teams": ["platform", "backend"],
    "users": ["user@company.com"],
    "roles": ["ADMIN"]
  },
  "notification": {
    "type": "warning",
    "title": "Scheduled Maintenance",
    "message": "Platform maintenance scheduled for Sunday",
    "priority": "high",
    "channels": ["email", "slack", "in-app"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "sent": 145,
  "failed": 2,
  "details": {
    "email": {
      "sent": 145,
      "failed": 0
    },
    "slack": {
      "sent": 143,
      "failed": 2
    }
  }
}
```

---

## WebSocket Events

### Connection

```javascript
const ws = new WebSocket('wss://api.platform.com/ws');

ws.on('open', () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'Bearer <access_token>'
  }));
  
  // Subscribe to events
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['plugins', 'catalog', 'deployments']
  }));
});
```

### Event Types

#### Plugin Events
```json
{
  "type": "plugin:installed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "pluginId": "plg_789",
    "name": "@backstage/plugin-catalog",
    "version": "1.2.3",
    "installedBy": "user@company.com"
  }
}
```

#### Catalog Events
```json
{
  "type": "catalog:entity:updated",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "uid": "ent_abc123",
    "kind": "Component",
    "name": "user-service",
    "changes": {
      "spec.lifecycle": {
        "old": "experimental",
        "new": "production"
      }
    }
  }
}
```

#### Deployment Events
```json
{
  "type": "deployment:status",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "deploymentId": "dep_456",
    "service": "user-service",
    "environment": "production",
    "status": "in_progress",
    "progress": 65,
    "step": "Rolling update"
  }
}
```

---

## Error Codes

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 502 | Bad Gateway |
| 503 | Service Unavailable |

### Application Error Codes

```json
{
  "error": {
    "code": "PLUGIN_NOT_FOUND",
    "message": "The requested plugin does not exist",
    "details": {
      "pluginId": "plg_invalid"
    },
    "requestId": "req_abc123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

| Code | Description |
|------|-------------|
| AUTH_INVALID_CREDENTIALS | Invalid username or password |
| AUTH_TOKEN_EXPIRED | Authentication token has expired |
| AUTH_MFA_REQUIRED | MFA verification required |
| PLUGIN_NOT_FOUND | Plugin does not exist |
| PLUGIN_ALREADY_INSTALLED | Plugin is already installed |
| PLUGIN_DEPENDENCY_ERROR | Plugin dependency conflict |
| CATALOG_ENTITY_NOT_FOUND | Catalog entity not found |
| CATALOG_VALIDATION_ERROR | Entity validation failed |
| PERMISSION_DENIED | Insufficient permissions |
| RATE_LIMIT_EXCEEDED | API rate limit exceeded |
| RESOURCE_CONFLICT | Resource conflict detected |
| VALIDATION_ERROR | Request validation failed |

---

## Rate Limiting

### Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642255200
X-RateLimit-Reset-After: 3600
```

### Rate Limit Response

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "API rate limit exceeded",
    "retryAfter": 3600,
    "limit": 1000,
    "reset": "2024-01-15T11:00:00Z"
  }
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { PlatformClient } from '@platform/sdk';

const client = new PlatformClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.platform.com'
});

// List plugins
const plugins = await client.plugins.list({
  status: 'installed',
  limit: 20
});

// Install plugin
const task = await client.plugins.install({
  name: '@backstage/plugin-catalog',
  version: '1.2.3'
});

// Watch installation progress
await client.plugins.watchInstallation(task.taskId, {
  onProgress: (progress) => {
    console.log(`Installation ${progress.progress}% complete`);
  },
  onComplete: (result) => {
    console.log('Installation completed', result);
  }
});
```

### Python

```python
from platform_sdk import PlatformClient

client = PlatformClient(
    api_key='your-api-key',
    base_url='https://api.platform.com'
)

# List catalog entities
entities = client.catalog.list_entities(
    kind='Component',
    lifecycle='production'
)

# Create new entity
entity = client.catalog.create_entity({
    'kind': 'Component',
    'metadata': {
        'name': 'new-service',
        'namespace': 'default'
    },
    'spec': {
        'type': 'service',
        'lifecycle': 'experimental',
        'owner': 'team:platform'
    }
})
```

### Go

```go
package main

import (
    "github.com/platform/sdk-go"
)

func main() {
    client := sdk.NewClient(
        sdk.WithAPIKey("your-api-key"),
        sdk.WithBaseURL("https://api.platform.com"),
    )
    
    // Get plugin health
    health, err := client.Plugins.GetHealth(context.Background())
    if err != nil {
        log.Fatal(err)
    }
    
    fmt.Printf("Healthy plugins: %d/%d\n", 
        health.Summary.Healthy, 
        health.Summary.Total)
}
```

---

## Webhooks

### Webhook Configuration

```json
{
  "url": "https://your-server.com/webhooks/platform",
  "events": [
    "plugin.installed",
    "plugin.updated",
    "catalog.entity.created",
    "catalog.entity.updated",
    "deployment.completed"
  ],
  "secret": "webhook_secret_key",
  "active": true
}
```

### Webhook Payload

```json
{
  "id": "evt_123",
  "type": "plugin.installed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "pluginId": "plg_789",
    "name": "@backstage/plugin-catalog",
    "version": "1.2.3"
  },
  "signature": "sha256=abcdef..."
}
```

### Webhook Verification

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return `sha256=${hash}` === signature;
}
```

---

*API Documentation Version: 1.0.0*  
*Last Updated: 2025-08-08*  
*OpenAPI Specification: Available at `/api/openapi.json`*