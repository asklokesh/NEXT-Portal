/**
 * Docker Image Builder for Plugin Pipeline
 * 
 * Handles automated Docker image building for plugins with security scanning,
 * multi-stage builds, and optimized image layering
 */

import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { PluginDefinition } from '../types/plugin-types';

const execAsync = promisify(exec);

export interface BuildOptions {
  skipCache?: boolean;
  buildArgs?: { [key: string]: string };
  targetStage?: string;
  platform?: string;
  securityScan?: boolean;
  pushToRegistry?: boolean;
}

export interface ImageInfo {
  imageId: string;
  imageName: string;
  imageTag: string;
  size: number;
  buildTime: number;
  layers: string[];
  securityScanResults?: any;
  buildLogs: string[];
}

export class DockerImageBuilder extends EventEmitter {
  private logger: Logger;
  private registryUrl: string;
  private buildCache: Map<string, ImageInfo> = new Map();

  constructor(logger: Logger, registryUrl: string) {
    super();
    this.logger = logger;
    this.registryUrl = registryUrl;
  }

  /**
   * Build Docker image for a plugin
   */
  async buildPluginImage(
    pluginDefinition: PluginDefinition,
    options: BuildOptions = {}
  ): Promise<ImageInfo> {
    const buildId = this.generateBuildId(pluginDefinition);
    const imageName = this.generateImageName(pluginDefinition);
    const imageTag = this.generateImageTag(pluginDefinition);
    const fullImageName = `${imageName}:${imageTag}`;

    this.logger.info(`Starting Docker build for plugin: ${pluginDefinition.name}`, {
      buildId,
      imageName: fullImageName,
      options
    });

    const startTime = Date.now();
    const buildLogs: string[] = [];

    try {
      // Step 1: Generate Dockerfile
      const dockerfile = await this.generateDockerfile(pluginDefinition);
      const buildContext = await this.prepareBuildContext(pluginDefinition, dockerfile);

      // Step 2: Build the image
      const buildResult = await this.executeBuild(
        buildContext,
        fullImageName,
        options,
        buildLogs
      );

      // Step 3: Security scan (if enabled)
      let securityScanResults;
      if (options.securityScan !== false) {
        securityScanResults = await this.performSecurityScan(fullImageName);
      }

      // Step 4: Push to registry (if enabled)
      if (options.pushToRegistry) {
        await this.pushToRegistry(fullImageName, buildLogs);
      }

      const endTime = Date.now();
      const buildTime = endTime - startTime;

      const imageInfo: ImageInfo = {
        imageId: buildResult.imageId,
        imageName,
        imageTag,
        size: buildResult.size,
        buildTime,
        layers: buildResult.layers,
        securityScanResults,
        buildLogs
      };

      // Cache the result
      this.buildCache.set(this.getCacheKey(pluginDefinition), imageInfo);

      this.logger.info(`Docker build completed for plugin: ${pluginDefinition.name}`, {
        buildId,
        buildTime: `${buildTime}ms`,
        imageSize: `${Math.round(buildResult.size / 1024 / 1024)}MB`
      });

      this.emit('image-built', { pluginDefinition, imageInfo, buildId });
      return imageInfo;

    } catch (error) {
      this.logger.error(`Docker build failed for plugin: ${pluginDefinition.name}`, {
        buildId,
        error: error.message,
        buildLogs
      });

      this.emit('image-build-failed', { pluginDefinition, error, buildId, buildLogs });
      throw error;

    } finally {
      // Clean up build context
      await this.cleanupBuildContext(buildContext);
    }
  }

  /**
   * Generate optimized Dockerfile for plugin
   */
  private async generateDockerfile(pluginDefinition: PluginDefinition): Promise<string> {
    const runtime = pluginDefinition.runtime;
    const nodeVersion = runtime.nodeVersion || '18';
    const isProduction = true;

    let dockerfile = '';

    // Multi-stage build for optimization
    if (runtime.type === 'frontend' || runtime.type === 'fullstack') {
      dockerfile += this.generateFrontendDockerfile(pluginDefinition, nodeVersion);
    }

    if (runtime.type === 'backend' || runtime.type === 'fullstack') {
      dockerfile += this.generateBackendDockerfile(pluginDefinition, nodeVersion);
    }

    // Add security hardening
    dockerfile += this.generateSecurityConfiguration(pluginDefinition);

    // Add health checks
    dockerfile += this.generateHealthCheckConfiguration(pluginDefinition);

    return dockerfile;
  }

  /**
   * Generate frontend-specific Dockerfile sections
   */
  private generateFrontendDockerfile(pluginDefinition: PluginDefinition, nodeVersion: string): string {
    return `
# Build stage for frontend
FROM node:${nodeVersion}-alpine AS frontend-builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git python3 make g++

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN ${pluginDefinition.runtime.buildCommand || 'npm run build'}

# Production stage for frontend
FROM nginx:alpine AS frontend-runtime
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# Create non-root user
RUN addgroup -g 1000 -S nginx && \\
    adduser -S -D -H -u 1000 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Set up proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/run /var/log/nginx

USER 1000

EXPOSE 8080
`;
  }

  /**
   * Generate backend-specific Dockerfile sections
   */
  private generateBackendDockerfile(pluginDefinition: PluginDefinition, nodeVersion: string): string {
    return `
# Build stage for backend
FROM node:${nodeVersion}-alpine AS backend-builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git python3 make g++

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Install all dependencies including dev dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN ${pluginDefinition.runtime.buildCommand || 'npm run build'}

# Production stage for backend
FROM node:${nodeVersion}-alpine AS backend-runtime
WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache dumb-init curl

# Create app user
RUN addgroup -g 1000 -S appuser && \\
    adduser -S -D -H -u 1000 -h /app -s /sbin/nologin -G appuser -g appuser appuser

# Copy built application
COPY --from=backend-builder --chown=appuser:appuser /app/dist ./dist
COPY --from=backend-builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --chown=appuser:appuser package*.json ./

# Set up proper permissions
RUN chown -R appuser:appuser /app

USER 1000

EXPOSE ${pluginDefinition.networking.ports[0]?.port || 3000}

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["${pluginDefinition.runtime.startCommand || 'npm start'}"]
`;
  }

  /**
   * Generate security configuration for Dockerfile
   */
  private generateSecurityConfiguration(pluginDefinition: PluginDefinition): string {
    const security = pluginDefinition.security;
    
    return `
# Security hardening
RUN apk upgrade --no-cache && \\
    rm -rf /var/cache/apk/* && \\
    rm -rf /tmp/* && \\
    rm -rf /var/tmp/*

# Remove unnecessary packages and files
RUN apk del --no-cache wget curl || true

# Set up read-only root filesystem support
RUN mkdir -p /tmp && chmod 1777 /tmp

# Security labels
LABEL security.scan="enabled" \\
      security.policy="hardened" \\
      maintainer="${pluginDefinition.author}"
`;
  }

  /**
   * Generate health check configuration
   */
  private generateHealthCheckConfiguration(pluginDefinition: PluginDefinition): string {
    const healthCheck = pluginDefinition.healthChecks.liveness;
    
    if (healthCheck.type === 'http') {
      const port = healthCheck.port || pluginDefinition.networking.ports[0]?.port || 3000;
      const path = healthCheck.path || '/health';
      
      return `
# Health check
HEALTHCHECK --interval=${healthCheck.periodSeconds}s \\
           --timeout=${healthCheck.timeoutSeconds}s \\
           --start-period=${healthCheck.initialDelaySeconds}s \\
           --retries=${healthCheck.failureThreshold} \\
           CMD curl -f http://localhost:${port}${path} || exit 1
`;
    }
    
    return '';
  }

  /**
   * Prepare build context directory
   */
  private async prepareBuildContext(
    pluginDefinition: PluginDefinition,
    dockerfile: string
  ): Promise<string> {
    const buildContext = path.join('/tmp', `plugin-build-${Date.now()}`);
    await fs.mkdir(buildContext, { recursive: true });

    // Write Dockerfile
    await fs.writeFile(path.join(buildContext, 'Dockerfile'), dockerfile);

    // Write .dockerignore
    const dockerignore = `
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.git
.gitignore
README.md
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
coverage
.nyc_output
.DS_Store
`;
    await fs.writeFile(path.join(buildContext, '.dockerignore'), dockerignore);

    // Generate nginx.conf for frontend
    if (pluginDefinition.runtime.type === 'frontend' || pluginDefinition.runtime.type === 'fullstack') {
      const nginxConf = this.generateNginxConfig(pluginDefinition);
      await fs.writeFile(path.join(buildContext, 'nginx.conf'), nginxConf);
    }

    return buildContext;
  }

  /**
   * Generate nginx configuration for frontend
   */
  private generateNginxConfig(pluginDefinition: PluginDefinition): string {
    return `
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
    
    server {
        listen 8080;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html index.htm;
        
        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\\n";
            add_header Content-Type text/plain;
        }
        
        # Static assets with caching
        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # SPA routing
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        # Security
        location ~ /\\. {
            deny all;
        }
    }
}
`;
  }

  /**
   * Execute the Docker build
   */
  private async executeBuild(
    buildContext: string,
    fullImageName: string,
    options: BuildOptions,
    buildLogs: string[]
  ): Promise<{ imageId: string; size: number; layers: string[] }> {
    let buildCommand = `docker build`;
    
    // Add build options
    if (options.skipCache) {
      buildCommand += ` --no-cache`;
    }
    
    if (options.platform) {
      buildCommand += ` --platform ${options.platform}`;
    }
    
    if (options.targetStage) {
      buildCommand += ` --target ${options.targetStage}`;
    }
    
    // Add build args
    if (options.buildArgs) {
      for (const [key, value] of Object.entries(options.buildArgs)) {
        buildCommand += ` --build-arg ${key}=${value}`;
      }
    }
    
    buildCommand += ` -t ${fullImageName} ${buildContext}`;
    
    this.logger.debug(`Executing build command: ${buildCommand}`);
    
    try {
      const { stdout, stderr } = await execAsync(buildCommand);
      buildLogs.push(stdout);
      if (stderr) buildLogs.push(stderr);
      
      // Get image info
      const inspectResult = await execAsync(`docker inspect ${fullImageName}`);
      const imageData = JSON.parse(inspectResult.stdout)[0];
      
      return {
        imageId: imageData.Id,
        size: imageData.Size,
        layers: imageData.RootFS.Layers || []
      };
      
    } catch (error) {
      buildLogs.push(error.stdout || '');
      buildLogs.push(error.stderr || '');
      throw new Error(`Docker build failed: ${error.message}`);
    }
  }

  /**
   * Perform security scan on built image
   */
  private async performSecurityScan(fullImageName: string): Promise<any> {
    try {
      // Using Trivy for vulnerability scanning
      const scanCommand = `trivy image --format json --no-progress ${fullImageName}`;
      const { stdout } = await execAsync(scanCommand);
      return JSON.parse(stdout);
    } catch (error) {
      this.logger.warn(`Security scan failed for ${fullImageName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Push image to registry
   */
  private async pushToRegistry(fullImageName: string, buildLogs: string[]): Promise<void> {
    const registryImageName = `${this.registryUrl}/${fullImageName}`;
    
    try {
      // Tag for registry
      await execAsync(`docker tag ${fullImageName} ${registryImageName}`);
      buildLogs.push(`Tagged image as ${registryImageName}`);
      
      // Push to registry
      const { stdout, stderr } = await execAsync(`docker push ${registryImageName}`);
      buildLogs.push(stdout);
      if (stderr) buildLogs.push(stderr);
      
      this.logger.info(`Successfully pushed image to registry: ${registryImageName}`);
      
    } catch (error) {
      buildLogs.push(error.stdout || '');
      buildLogs.push(error.stderr || '');
      throw new Error(`Failed to push to registry: ${error.message}`);
    }
  }

  /**
   * Clean up build context
   */
  private async cleanupBuildContext(buildContext: string): Promise<void> {
    try {
      await fs.rmdir(buildContext, { recursive: true });
    } catch (error) {
      this.logger.warn(`Failed to cleanup build context ${buildContext}: ${error.message}`);
    }
  }

  /**
   * Generate unique build ID
   */
  private generateBuildId(pluginDefinition: PluginDefinition): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `build-${pluginDefinition.name}-${timestamp}-${random}`;
  }

  /**
   * Generate image name
   */
  private generateImageName(pluginDefinition: PluginDefinition): string {
    return `plugin-${pluginDefinition.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
  }

  /**
   * Generate image tag
   */
  private generateImageTag(pluginDefinition: PluginDefinition): string {
    return `${pluginDefinition.version}-${Date.now()}`;
  }

  /**
   * Get cache key for plugin
   */
  private getCacheKey(pluginDefinition: PluginDefinition): string {
    return `${pluginDefinition.name}:${pluginDefinition.version}`;
  }

  /**
   * Get cached build result
   */
  getCachedBuild(pluginDefinition: PluginDefinition): ImageInfo | null {
    return this.buildCache.get(this.getCacheKey(pluginDefinition)) || null;
  }

  /**
   * Clear build cache
   */
  clearCache(): void {
    this.buildCache.clear();
  }
}