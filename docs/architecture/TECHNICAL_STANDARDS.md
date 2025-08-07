# Technical Standards and Engineering Guidelines

## Overview

This document establishes comprehensive technical standards and engineering guidelines for the Enhanced Plugin Management System. These standards ensure code quality, security, performance, and maintainability across all development activities.

## Code Quality Standards

### TypeScript/JavaScript Standards

#### Code Style and Formatting
```typescript
// ESLint Configuration
{
  "extends": [
    "@typescript-eslint/recommended",
    "@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  "rules": {
    // Enforce strict type checking
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/strict-boolean-expressions": "error",
    
    // Code complexity limits
    "complexity": ["error", 10],
    "max-lines-per-function": ["error", 50],
    "max-depth": ["error", 4],
    
    // Security rules
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error"
  }
}
```

#### Naming Conventions
```typescript
// Interfaces and Types
interface PluginConfiguration {
  readonly id: string;
  readonly version: SemVer;
  settings: PluginSettings;
}

// Classes
class PluginRegistryService {
  private readonly repository: PluginRepository;
  
  public async installPlugin(request: InstallPluginRequest): Promise<Plugin> {
    // Implementation
  }
}

// Constants
const DEFAULT_TIMEOUT_MS = 30_000;
const API_ENDPOINTS = {
  PLUGINS: '/api/v1/plugins',
  WORKFLOWS: '/api/v1/workflows'
} as const;

// Functions
function validatePluginMetadata(metadata: PluginMetadata): ValidationResult {
  // Implementation
}

// Enums
enum PluginStatus {
  PENDING = 'pending',
  INSTALLED = 'installed',
  FAILED = 'failed',
  DEPRECATED = 'deprecated'
}
```

#### Documentation Standards
```typescript
/**
 * Installs a plugin with the specified configuration.
 * 
 * @param pluginId - Unique identifier for the plugin
 * @param config - Installation configuration options
 * @returns Promise resolving to the installed plugin instance
 * @throws {PluginNotFoundError} When plugin doesn't exist
 * @throws {DependencyConflictError} When dependencies conflict
 * 
 * @example
 * ```typescript
 * const plugin = await installPlugin('my-plugin', {
 *   version: '1.0.0',
 *   environment: 'production'
 * });
 * ```
 */
async function installPlugin(
  pluginId: string, 
  config: InstallationConfig
): Promise<Plugin> {
  // Implementation
}
```

### React Component Standards

#### Component Structure
```typescript
// Component interface definition
interface PluginCardProps {
  plugin: Plugin;
  onInstall: (pluginId: string) => void;
  onUninstall: (pluginId: string) => void;
  className?: string;
}

// Component implementation
export function PluginCard({ 
  plugin, 
  onInstall, 
  onUninstall, 
  className 
}: PluginCardProps): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  
  const handleInstall = useCallback(async () => {
    setIsLoading(true);
    try {
      await onInstall(plugin.id);
    } finally {
      setIsLoading(false);
    }
  }, [plugin.id, onInstall]);
  
  return (
    <Card className={cn("plugin-card", className)}>
      <CardHeader>
        <CardTitle>{plugin.name}</CardTitle>
        <CardDescription>{plugin.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleInstall} 
          disabled={isLoading}
          aria-label={`Install ${plugin.name} plugin`}
        >
          {isLoading ? 'Installing...' : 'Install'}
        </Button>
      </CardContent>
    </Card>
  );
}

// Component display name for debugging
PluginCard.displayName = 'PluginCard';
```

#### Custom Hook Standards
```typescript
interface UsePluginInstallationOptions {
  onSuccess?: (plugin: Plugin) => void;
  onError?: (error: Error) => void;
  retryAttempts?: number;
}

interface UsePluginInstallationResult {
  install: (pluginId: string, config: InstallationConfig) => Promise<void>;
  uninstall: (pluginId: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Custom hook for plugin installation management
 */
export function usePluginInstallation(
  options: UsePluginInstallationOptions = {}
): UsePluginInstallationResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const install = useCallback(async (
    pluginId: string, 
    config: InstallationConfig
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const plugin = await pluginService.install(pluginId, config);
      options.onSuccess?.(plugin);
    } catch (err) {
      const error = err as Error;
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [options]);
  
  return { install, uninstall, isLoading, error };
}
```

## Testing Standards

### Test Structure and Organization
```typescript
// Test file structure: ComponentName.test.tsx
describe('PluginCard', () => {
  // Test setup
  const defaultProps: PluginCardProps = {
    plugin: mockPlugin,
    onInstall: jest.fn(),
    onUninstall: jest.fn()
  };
  
  // Test utilities
  const renderPluginCard = (props: Partial<PluginCardProps> = {}) => {
    return render(<PluginCard {...defaultProps} {...props} />);
  };
  
  // Group related tests
  describe('Rendering', () => {
    it('should render plugin information correctly', () => {
      renderPluginCard();
      
      expect(screen.getByText(mockPlugin.name)).toBeInTheDocument();
      expect(screen.getByText(mockPlugin.description)).toBeInTheDocument();
    });
    
    it('should handle loading state', () => {
      renderPluginCard();
      
      const installButton = screen.getByRole('button', { name: /install/i });
      fireEvent.click(installButton);
      
      expect(screen.getByText('Installing...')).toBeInTheDocument();
    });
  });
  
  describe('User Interactions', () => {
    it('should call onInstall when install button is clicked', async () => {
      const onInstall = jest.fn();
      renderPluginCard({ onInstall });
      
      const installButton = screen.getByRole('button', { name: /install/i });
      fireEvent.click(installButton);
      
      expect(onInstall).toHaveBeenCalledWith(mockPlugin.id);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle installation errors gracefully', async () => {
      const onInstall = jest.fn().mockRejectedValue(new Error('Installation failed'));
      renderPluginCard({ onInstall });
      
      const installButton = screen.getByRole('button', { name: /install/i });
      fireEvent.click(installButton);
      
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });
  });
});
```

### Test Coverage Requirements
- **Unit Tests**: 90% code coverage minimum
- **Integration Tests**: 80% coverage for API endpoints
- **E2E Tests**: 100% coverage for critical user journeys
- **Performance Tests**: All API endpoints must meet SLA requirements

### Testing Best Practices
```typescript
// Use data-testid for stable element selection
<button data-testid="install-plugin-button" onClick={handleInstall}>
  Install
</button>

// Mock external dependencies properly
jest.mock('../services/PluginService', () => ({
  PluginService: {
    install: jest.fn(),
    uninstall: jest.fn()
  }
}));

// Use proper assertions
expect(mockInstall).toHaveBeenCalledWith(
  expect.stringMatching(/^plugin-/),
  expect.objectContaining({
    version: expect.any(String),
    environment: 'production'
  })
);

// Test async operations properly
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
}, { timeout: 5000 });
```

## Security Standards

### Input Validation
```typescript
// Use Zod for runtime type validation
import { z } from 'zod';

const PluginConfigSchema = z.object({
  id: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  settings: z.record(z.string(), z.unknown()).optional(),
  dependencies: z.array(z.string()).optional()
});

export function validatePluginConfig(config: unknown): PluginConfig {
  return PluginConfigSchema.parse(config);
}

// Sanitize user inputs
import DOMPurify from 'dompurify';

function sanitizeHTML(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href']
  });
}
```

### Authentication and Authorization
```typescript
// JWT token validation middleware
import jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: string;
  organizationId: string;
  roles: string[];
  permissions: string[];
}

export function validateJWTToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new UnauthorizedError('Invalid token');
  }
}

// Permission checking
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as JWTPayload;
    
    if (!user.permissions.includes(permission)) {
      throw new ForbiddenError(`Missing required permission: ${permission}`);
    }
    
    next();
  };
}
```

### Data Protection
```typescript
// Encryption utilities
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
  cipher.setAAD(Buffer.from('additional-data'));
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
  decipher.setAAD(Buffer.from('additional-data'));
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

## Performance Standards

### Code Performance Guidelines
```typescript
// Use React.memo for expensive components
export const PluginList = React.memo<PluginListProps>(({ plugins, onInstall }) => {
  const virtualizer = useVirtualizer({
    count: plugins.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 10
  });
  
  return (
    <div ref={parentRef} className="plugin-list">
      {virtualizer.getVirtualItems().map((virtualRow) => (
        <PluginCard
          key={plugins[virtualRow.index].id}
          plugin={plugins[virtualRow.index]}
          onInstall={onInstall}
        />
      ))}
    </div>
  );
});

// Optimize expensive operations
export const usePluginSearch = (plugins: Plugin[], query: string) => {
  return useMemo(() => {
    if (!query.trim()) return plugins;
    
    const fuse = new Fuse(plugins, {
      keys: ['name', 'description', 'tags'],
      threshold: 0.3
    });
    
    return fuse.search(query).map(result => result.item);
  }, [plugins, query]);
};

// Use proper caching strategies
const pluginCache = new Map<string, Plugin>();

export async function getPlugin(id: string): Promise<Plugin> {
  if (pluginCache.has(id)) {
    return pluginCache.get(id)!;
  }
  
  const plugin = await pluginRepository.findById(id);
  pluginCache.set(id, plugin);
  
  return plugin;
}
```

### Database Performance Standards
```sql
-- Index requirements for all queries
CREATE INDEX CONCURRENTLY idx_plugins_name_gin ON plugins USING gin(name gin_trgm_ops);
CREATE INDEX CONCURRENTLY idx_plugins_status ON plugins(status) WHERE status != 'deleted';
CREATE INDEX CONCURRENTLY idx_installations_user_org ON installations(user_id, organization_id);

-- Query performance standards
-- All queries must execute in < 100ms for simple lookups
-- Complex queries must execute in < 500ms
-- Bulk operations must handle 1000+ records efficiently

-- Example optimized query
SELECT p.*, i.status as installation_status
FROM plugins p
LEFT JOIN installations i ON p.id = i.plugin_id 
  AND i.user_id = $1 
  AND i.organization_id = $2
WHERE p.status = 'published'
  AND ($3 IS NULL OR p.name ILIKE '%' || $3 || '%')
ORDER BY p.download_count DESC, p.name ASC
LIMIT 20 OFFSET $4;
```

### API Performance Standards
```typescript
// API response time requirements
// - Health checks: < 10ms
// - Simple CRUD: < 100ms
// - Complex queries: < 500ms
// - Bulk operations: < 2000ms

// Rate limiting configuration
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
});

// Response caching
export function cacheResponse(ttl: number = 300) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `cache:${req.method}:${req.originalUrl}`;
    
    redis.get(key).then(cached => {
      if (cached) {
        res.set('X-Cache', 'HIT');
        res.json(JSON.parse(cached));
      } else {
        res.set('X-Cache', 'MISS');
        const originalJson = res.json;
        res.json = function(body) {
          redis.setex(key, ttl, JSON.stringify(body));
          return originalJson.call(this, body);
        };
        next();
      }
    });
  };
}
```

## API Design Standards

### RESTful API Guidelines
```typescript
// URL structure
// GET    /api/v1/plugins          - List plugins
// GET    /api/v1/plugins/:id      - Get specific plugin
// POST   /api/v1/plugins          - Create plugin
// PUT    /api/v1/plugins/:id      - Update plugin
// DELETE /api/v1/plugins/:id      - Delete plugin

// Resource relationships
// GET    /api/v1/plugins/:id/installations    - Get plugin installations
// POST   /api/v1/plugins/:id/install          - Install plugin
// DELETE /api/v1/plugins/:id/install          - Uninstall plugin

// Standard response format
interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    version: string;
    timestamp: string;
  };
}

// Error handling
export class APIError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// Standard error responses
export function handleError(error: Error, req: Request, res: Response, next: NextFunction) {
  if (error instanceof APIError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      },
      meta: {
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }
    });
  } else {
    // Log unexpected errors
    logger.error('Unexpected error', { error, request: req.url });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      },
      meta: {
        version: '1.0.0',
        timestamp: new Date().toISOString()
      }
    });
  }
}
```

### GraphQL Standards
```typescript
// Schema design
type Plugin {
  id: ID!
  name: String!
  description: String
  version: String!
  author: User!
  tags: [String!]!
  installations: [Installation!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Query {
  plugins(
    filter: PluginFilter
    sort: PluginSort
    pagination: PaginationInput
  ): PluginConnection!
  
  plugin(id: ID!): Plugin
}

type Mutation {
  installPlugin(input: InstallPluginInput!): InstallPluginPayload!
  uninstallPlugin(input: UninstallPluginInput!): UninstallPluginPayload!
}

// Input types
input PluginFilter {
  search: String
  tags: [String!]
  status: PluginStatus
  author: ID
}

input PaginationInput {
  first: Int
  after: String
  last: Int
  before: String
}

// Connection pattern for pagination
type PluginConnection {
  edges: [PluginEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type PluginEdge {
  node: Plugin!
  cursor: String!
}
```

## Documentation Standards

### Code Documentation
```typescript
/**
 * @fileoverview Plugin management service for handling plugin lifecycle operations.
 * This service provides methods for installing, uninstalling, and managing plugins
 * across different environments and organizations.
 * 
 * @author Team Platform
 * @version 1.0.0
 * @since 2024-08-01
 */

/**
 * Configuration options for plugin installation.
 */
interface InstallationConfig {
  /** Target environment for installation */
  environment: 'development' | 'staging' | 'production';
  
  /** Custom configuration overrides */
  settings?: Record<string, unknown>;
  
  /** Whether to skip dependency validation */
  skipValidation?: boolean;
  
  /** Installation timeout in milliseconds */
  timeout?: number;
}

/**
 * Service for managing plugin lifecycle operations.
 * 
 * @example Basic usage
 * ```typescript
 * const service = new PluginService(repository, validator);
 * const plugin = await service.install('my-plugin', {
 *   environment: 'production',
 *   settings: { apiKey: 'secret' }
 * });
 * ```
 */
export class PluginService {
  /**
   * Creates a new plugin service instance.
   * 
   * @param repository - Plugin data repository
   * @param validator - Plugin validation service
   */
  constructor(
    private readonly repository: PluginRepository,
    private readonly validator: PluginValidator
  ) {}
  
  /**
   * Installs a plugin with the specified configuration.
   * 
   * This method validates the plugin, checks dependencies, and installs
   * the plugin in the target environment. The installation process is
   * atomic and will rollback on failure.
   * 
   * @param pluginId - Unique plugin identifier
   * @param config - Installation configuration
   * @returns Promise resolving to the installed plugin
   * 
   * @throws {PluginNotFoundError} When the plugin doesn't exist
   * @throws {DependencyConflictError} When dependency validation fails
   * @throws {InstallationError} When installation process fails
   * 
   * @example Install with custom settings
   * ```typescript
   * const plugin = await service.install('monitoring-plugin', {
   *   environment: 'production',
   *   settings: {
   *     alertEndpoint: 'https://alerts.company.com/webhook',
   *     retention: '30d'
   *   }
   * });
   * ```
   */
  public async install(
    pluginId: string,
    config: InstallationConfig
  ): Promise<Plugin> {
    // Implementation details...
  }
}
```

### API Documentation
```yaml
# OpenAPI 3.0 specification
openapi: 3.0.3
info:
  title: Plugin Management API
  description: |
    The Plugin Management API provides endpoints for managing plugins
    in the Internal Developer Portal platform.
    
    ## Authentication
    All endpoints require authentication using Bearer tokens or API keys.
    
    ## Rate Limiting
    API calls are limited to 1000 requests per 15-minute window per IP address.
    
    ## Versioning
    This API uses semantic versioning. Breaking changes will result in
    a new major version.
    
  version: 1.0.0
  contact:
    name: Platform Team
    url: https://docs.portal.company.com
    email: platform-team@company.com

servers:
  - url: https://api.portal.company.com/v1
    description: Production API
  - url: https://staging-api.portal.company.com/v1
    description: Staging API

paths:
  /plugins:
    get:
      summary: List plugins
      description: |
        Retrieves a paginated list of plugins with optional filtering
        and sorting capabilities.
      parameters:
        - name: search
          in: query
          description: Search term to filter plugins by name or description
          schema:
            type: string
            maxLength: 100
        - name: limit
          in: query
          description: Maximum number of plugins to return
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: offset
          in: query
          description: Number of plugins to skip
          schema:
            type: integer
            minimum: 0
            default: 0
      responses:
        '200':
          description: List of plugins retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PluginListResponse'
              examples:
                success:
                  summary: Successful plugin list response
                  value:
                    success: true
                    data:
                      plugins:
                        - id: "plugin-123"
                          name: "Monitoring Plugin"
                          description: "Advanced monitoring capabilities"
                          version: "1.2.3"
                    meta:
                      total: 150
                      page: 1
                      limit: 20
```

## Git and Version Control Standards

### Commit Message Format
```bash
# Format: <type>(<scope>): <subject>
# 
# <body>
# 
# <footer>

# Types: feat, fix, docs, style, refactor, perf, test, chore
# Scope: component, service, api, ui, config, etc.

# Examples:
feat(plugin-registry): add plugin dependency validation

Add comprehensive dependency validation for plugin installations.
This includes checking for version conflicts, circular dependencies,
and missing required dependencies.

Closes #123
Resolves #124

fix(api): handle null values in plugin configuration

Previously, null values in plugin configuration would cause
installation failures. This fix adds proper null checking
and default value handling.

Breaking Change: Plugin configuration schema now requires
explicit null handling for optional fields.

docs(readme): update installation instructions

Update README with latest installation steps and troubleshooting
guide for common setup issues.
```

### Branch Protection Rules
```yaml
# Branch protection configuration
branch_protection:
  main:
    required_reviews: 2
    dismiss_stale_reviews: true
    require_code_owner_reviews: true
    required_status_checks:
      - "ci/tests"
      - "ci/security-scan"
      - "ci/lint"
      - "ci/build"
    enforce_admins: true
    allow_force_pushes: false
    allow_deletions: false

  develop:
    required_reviews: 1
    required_status_checks:
      - "ci/tests"
      - "ci/lint"
    enforce_admins: false

# Pull Request template
pull_request_template: |
  ## Description
  Brief description of the changes in this PR.
  
  ## Type of Change
  - [ ] Bug fix (non-breaking change which fixes an issue)
  - [ ] New feature (non-breaking change which adds functionality)
  - [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
  - [ ] Documentation update
  
  ## How Has This Been Tested?
  - [ ] Unit tests pass
  - [ ] Integration tests pass
  - [ ] Manual testing performed
  
  ## Checklist:
  - [ ] My code follows the style guidelines of this project
  - [ ] I have performed a self-review of my own code
  - [ ] I have commented my code, particularly in hard-to-understand areas
  - [ ] I have made corresponding changes to the documentation
  - [ ] My changes generate no new warnings
  - [ ] I have added tests that prove my fix is effective or that my feature works
  - [ ] New and existing unit tests pass locally with my changes
```

## Deployment Standards

### Container Standards
```dockerfile
# Multi-stage build optimization
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code and build
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Security hardening
RUN apk --no-cache add curl && \
    apk upgrade && \
    rm -rf /var/cache/apk/*

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4400/api/health || exit 1

EXPOSE 4400

CMD ["node", "server.js"]
```

### Kubernetes Standards
```yaml
# Resource limits and requests
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "2Gi"
    cpu: "1000m"

# Security context
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  runAsGroup: 1001
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL

# Health checks
livenessProbe:
  httpGet:
    path: /api/health
    port: 4400
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  successThreshold: 1
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/ready
    port: 4400
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  successThreshold: 1
  failureThreshold: 3

# Pod disruption budget
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: portal-frontend-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: portal-frontend
```

These technical standards provide a comprehensive framework for maintaining high code quality, security, and performance across the enhanced plugin management system. All team members should follow these guidelines to ensure consistency and maintainability of the codebase.