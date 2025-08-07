# Multi-stage Dockerfile for Backstage IDP Wrapper

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY .npmrc* ./

# Install dependencies (skip prepare script)
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Stage 2: Development dependencies and build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY .npmrc* ./

# Install all dependencies (skip prepare script for CI)
RUN npm ci --ignore-scripts && \
    npm cache clean --force

# Copy source code
COPY . .

# Set build arguments
ARG NEXT_PUBLIC_BACKSTAGE_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_ENVIRONMENT=production

# Generate Prisma client
RUN npx prisma generate

# Build the application
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

# Add non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set production environment
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Set correct permissions
RUN chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000
ENV PORT 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the application
CMD ["node", "server.js"]

# Stage 4: Development environment (optional)
FROM node:20-alpine AS development
WORKDIR /app

# Install development tools
RUN apk add --no-cache git

# Copy package files
COPY package.json package-lock.json* ./
COPY .npmrc* ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose ports
EXPOSE 3000
EXPOSE 6006

# Set development environment
ENV NODE_ENV development
ENV NEXT_TELEMETRY_DISABLED 1

# Development command
CMD ["npm", "run", "dev"]