FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy workflow engine service code
COPY src/services/workflow-engine ./src/services/workflow-engine
COPY src/lib ./src/lib
COPY src/types ./src/types

# Expose port
EXPOSE 6000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:6000/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Start the workflow engine service
CMD ["node", "src/services/workflow-engine/index.js"]