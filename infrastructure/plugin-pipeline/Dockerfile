# Multi-stage Docker build for Plugin Pipeline Orchestrator
# Optimized for production deployment with security hardening

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production --no-audit --no-fund \
    && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Security scanning stage
FROM builder AS security-scanner

# Install Trivy for security scanning
RUN curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin v0.40.0

# Run security scan
RUN trivy fs --security-checks vuln --no-progress --exit-code 0 /app

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies and security tools
RUN apk add --no-cache \
    dumb-init \
    curl \
    tini \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create app user for security
RUN addgroup -g 1000 -S appuser && \
    adduser -S -D -H -u 1000 -h /app -s /sbin/nologin -G appuser -g appuser appuser

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=appuser:appuser /app/dist ./dist
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/package*.json ./

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/cache /app/config /tmp/plugin-builds \
    && chown -R appuser:appuser /app /tmp/plugin-builds \
    && chmod 755 /app/logs /app/cache /app/config /tmp/plugin-builds

# Install Docker CLI for Docker-in-Docker functionality
RUN curl -fsSL https://get.docker.com | sh

# Install kubectl for Kubernetes API access
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

# Install security scanning tools
RUN curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin v0.40.0

# Install TruffleHog for secret scanning
RUN curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh -s -- -b /usr/local/bin

# Set up proper permissions for Docker socket access
RUN addgroup appuser docker || true

# Health check script
COPY --chown=appuser:appuser healthcheck.sh /app/healthcheck.sh
RUN chmod +x /app/healthcheck.sh

# Switch to non-root user
USER appuser

# Expose ports
EXPOSE 8080 8081 9090

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV PORT=8080
ENV HEALTH_PORT=8081
ENV METRICS_PORT=9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /app/healthcheck.sh

# Labels for container metadata
LABEL maintainer="platform-team@example.com" \
      version="1.0.0" \
      description="Plugin Installation Pipeline Orchestrator" \
      org.opencontainers.image.title="plugin-pipeline-orchestrator" \
      org.opencontainers.image.description="Production-ready plugin installation and lifecycle management system" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="Developer Portal Platform Team" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.source="https://github.com/example/plugin-pipeline" \
      org.opencontainers.image.documentation="https://docs.example.com/plugin-pipeline"

# Use tini as init process for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/index.js"]